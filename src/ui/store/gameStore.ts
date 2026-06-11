// =============================================================================
// Store Zustand — pont entre l'UI et le moteur.
//
// IMPORTANT : ce store ne contient AUCUNE logique de jeu. Il se contente de
// stocker le GameState et de déléguer chaque coup à applyAction() du moteur.
// Toute la règle vit dans engine/. On pourrait remplacer Zustand par autre
// chose sans toucher au moteur.
// =============================================================================

import { create } from 'zustand'
import type { CardInstance, GameAction, GameState, LocationId } from '../../engine/types'
import {
  createInitialGame,
  drawPlayerToLimit,
  pushDiscardShowcase,
  pushShowcase,
  type PlayerSetup,
} from '../../engine/state'
import { applyAction } from '../../engine/actions'
import { chooseAction, chooseReaction } from '../../ai/heuristicBot'
import { buildDeckInstances } from '../../data/types'
import { getCardDef } from '../../data/registry'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'

/** Sélecteur de vilain (clé stable utilisée par l'UI). */
export type VillainKey = 'princeJohn' | 'maleficent' | 'slenderman' | 'jafar' | 'reineCoeur'

export const VILLAIN_REGISTRY = {
  princeJohn: { def: princeJohn, cards: princeJohnCards, label: 'Prince Jean' },
  maleficent: { def: maleficent, cards: maleficentCards, label: 'Maléfique' },
  slenderman: { def: slenderman, cards: slendermanCards, label: 'Slenderman' },
  jafar: { def: jafar, cards: jafarCards, label: 'Jafar' },
  reineCoeur: { def: reineCoeur, cards: reineCoeurCards, label: 'Reine de Cœur' },
} as const

/** Qui est contrôlé par un bot. Concept d'UI : le moteur, lui, ne sait pas qui
 *  joue. Joueur 0 = humain, joueur 1 = bot. */
export const BOTS: boolean[] = [false, true]

/** Types de showcase prévisualisables en mode test (pour caler les positions). */
export type ShowcaseKind = 'card' | 'discard-red' | 'discard-dark' | 'hero'

/** Retrouve la clé de vilain depuis l'id porté par le PlayerState. */
export function villainKeyOf(villainId: string): VillainKey {
  return (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).find(
    (k) => VILLAIN_REGISTRY[k].def.id === villainId,
  ) ?? 'princeJohn'
}

// ⚠️ ÉCHAFAUDAGE DE TEST — temporaire. Passer à `true` pour : main truquée
// (2 Alliés + 2 Objets), 10 JT d'avance, et Dame Gertrude en tête du deck
// Fatalité du bot (tester la restriction de pose D.2).
const DEV_TEST_HAND = false

/** Construit un exemplaire de carte pour la main/le plateau de test (id unique). */
function devInstance(cardId: string, tag: string): CardInstance {
  const c = princeJohnCards.find((x) => x.id === cardId)!
  return {
    instanceId: `p0:${cardId}#${tag}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    attach: c.attach,
    effects: c.effects,
  }
}

/**
 * Truque l'état initial du joueur humain pour les tests manuels : pouvoir
 * d'avance et main contrôlée. Les lieux démarrent VIDES (et se réinitialisent
 * donc à chaque rechargement) — on pose soi-même les 2 Alliés de la main pour
 * tester l'association multi-allié. À retirer plus tard.
 *
 * Place aussi Dame Gertrude en tête du deck Fatalité du bot (P1) pour tester
 * la restriction de pose (D.2) : la 1ʳᵉ Fatalité lancée contre le bot révèle
 * Dame Gertrude, dont le bouton « La Prison » doit apparaître grisé.
 */
function withDevTestHand(base: GameState): GameState {
  const players = base.players.map((p, i) => {
    if (i === 0) {
      return {
        ...p,
        power: 10,
        hand: [
          devInstance('gardes-rhinoceros', 'h1'), // Allié → Lieu
          devInstance('archers-loups', 'h2'), // Allié → Lieu
          devInstance('arc-fleches', 'h3'), // Objet → Allié
          devInstance('mandat-arret', 'h4'), // Objet → Lieu
        ],
      }
    }
    // Bot : Dame Gertrude tirée en premier par la Fatalité.
    const gertrudeIdx = p.fateDeck.findIndex((c) => c.cardId === 'dame-gertrude')
    if (gertrudeIdx < 0) return p
    const gertrude = p.fateDeck[gertrudeIdx]
    const rest = p.fateDeck.filter((_, idx) => idx !== gertrudeIdx)
    return { ...p, fateDeck: [gertrude, ...rest] }
  })
  return {
    ...base,
    players,
    log: [
      ...base.log,
      '[TEST] Main truquée (2 Alliés + 2 Objets), 10 pouvoir, lieux vides. Dame Gertrude en tête du deck Fatalité du bot.',
    ],
  }
}

const VILLAINS_LS_KEY = 'villainous:lastVillains'

/** Lit les vilains mémorisés (localStorage). Renvoie undefined si invalide. */
function readSavedVillains(): [VillainKey, VillainKey] | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(VILLAINS_LS_KEY)
    if (!raw) return undefined
    const arr = JSON.parse(raw) as unknown
    if (
      Array.isArray(arr) &&
      arr.length === 2 &&
      arr.every((k): k is VillainKey => typeof k === 'string' && k in VILLAIN_REGISTRY)
    ) {
      return arr as [VillainKey, VillainKey]
    }
  } catch { /* ignore */ }
  return undefined
}

/** Mémorise le choix de vilains pour la prochaine session. */
function saveVillains(villains: [VillainKey, VillainKey]) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(VILLAINS_LS_KEY, JSON.stringify(villains)) } catch { /* ignore */ }
}

/**
 * Démarre une nouvelle partie avec les deux vilains choisis. Mémorise le choix
 * en localStorage pour survivre à un rechargement.
 */
function newGame(
  villains: [VillainKey, VillainKey] = readSavedVillains() ?? ['princeJohn', 'maleficent'],
): GameState {
  saveVillains(villains)
  const seed = (Math.random() * 0xffffffff) >>> 0
  const [p0Key, p1Key] = villains
  const p0 = VILLAIN_REGISTRY[p0Key]
  const p1 = VILLAIN_REGISTRY[p1Key]
  const setups: PlayerSetup[] = [
    {
      villain: { ...p0.def, name: `${p0.label} (vous)` },
      deckCards: buildDeckInstances(p0.cards, 'villain', 'p0:'),
      fateCards: buildDeckInstances(p0.cards, 'fate', 'p0f:'),
    },
    {
      villain: { ...p1.def, name: `Bot (${p1.label})` },
      deckCards: buildDeckInstances(p1.cards, 'villain', 'p1:'),
      fateCards: buildDeckInstances(p1.cards, 'fate', 'p1f:'),
    },
  ]
  const base = createInitialGame(setups, seed)
  return DEV_TEST_HAND ? withDevTestHand(base) : base
}

// =============================================================================
// MODE TEST (bac à sable) — édition « live » des deux plateaux. À l'entrée, les
// plateaux sont vidés ; on insère ensuite n'importe quelle carte (Vilain ou
// Fatalité) sur n'importe quel lieu de l'un ou l'autre joueur, et on peut
// s'infliger un Héros (effets « à la pose » + showcase). Les deux camps restent
// visibles avec le même layout qu'en partie.
// =============================================================================

/** Compteur global d'instances de test (insertions / Héros infligés). */
let testFateCounter = 0

/** Fabrique un exemplaire jouable depuis un cardId (recopie les champs de jeu
 *  pour que le moteur soit autosuffisant). Renvoie null si la carte est inconnue. */
function instanceOf(cardId: string, n: number): CardInstance | null {
  const def = getCardDef(cardId)
  if (!def) return null
  return {
    instanceId: `test:${cardId}#${n}`,
    cardId,
    name: def.name,
    type: def.type,
    cost: def.cost,
    strength: def.strength,
    attach: def.attach,
    effects: def.effects,
    onPlace: def.onPlace,
    onVanquish: def.onVanquish,
    forbiddenLocations: def.forbiddenLocations,
    placementRestriction: def.placementRestriction,
    strengthMod: def.strengthMod,
    discardWhen: def.discardWhen,
    trigger: def.trigger,
    maxAtLocation: def.maxAtLocation,
  }
}

/** Construit l'état d'entrée du mode test : partie neuve (decks/Fatalité valides),
 *  plateaux des DEUX joueurs vidés, phase Action, pouvoir confortable au joueur. */
function buildTestState(): GameState {
  const base = newGame()
  const players = base.players.map((p, i) => ({
    ...p,
    board: Object.fromEntries(p.locations.map((l) => [l.id, []])) as GameState['players'][number]['board'],
    power: i === 0 ? 10 : 1,
  }))
  return {
    ...base,
    players,
    phase: 'ACTION',
    usedActionIds: [],
    persifleurAvailable: false,
    log: ['[TEST] Mode test : plateaux vidés. Clique « ＋ » sur un lieu pour insérer des cartes.'],
  }
}

interface GameStore {
  state: GameState
  /** Vrai quand on est en mode test (édition live des deux plateaux, bot figé). */
  testMode: boolean
  /** Entre en mode test (ou le réinitialise) : vide les deux plateaux. */
  enterTestMode: () => void
  /** MODE TEST : insère une carte (par cardId) sur un lieu d'un joueur donné. */
  testInsertCard: (playerIndex: number, locationId: string, cardId: string) => void
  /** MODE TEST : t'inflige un Héros Fatalité (par cardId) sur un lieu donné. */
  testPlaceFate: (cardId: string, to: string) => void
  /** MODE TEST : joue une Condition (par cardId) pour le joueur 0. Pour Lâcheté,
   *  `allyInstanceId`/`to` permettent de choisir l'Allié et le lieu. */
  testPlayCondition: (cardId: string, allyInstanceId?: string, to?: string) => void
  /** MODE TEST : ajoute une carte (par cardId) à la main du joueur 0 — pour
   *  ensuite la jouer normalement (Événements à cibles, Alliés, Objets…). */
  testAddToHand: (cardId: string) => void
  /** MODE TEST : joue une carte Fatalité non-Héros (Voler aux Riches,
   *  Déguisement) CONTRE le joueur 0, sur l'un de ses Héros (`targetHeroId`). */
  testPlayFateCard: (cardId: string, targetHeroId: string) => void
  /** MODE TEST : déclenche un showcase d'aperçu (pour caler les positions).
   *  `opts` : durée en ms / mode « fixe », et `count` = nombre de cartes pour
   *  une défausse. */
  testShowcase: (
    kind: ShowcaseKind,
    playerIndex: number,
    opts?: { durationMs?: number; fixed?: boolean; count?: number },
  ) => void
  /** MODE TEST : reprend la main du joueur 0 (réinitialise actions + repioche)
   *  sans passer la main au bot — pour continuer à jouer après « fin de tour ». */
  testRefreshTurn: () => void
  move: (to: LocationId) => void
  skipMove: () => void
  /** Fixe le joueur qui commence (jet de dé de début de partie) + journalise. */
  setStartingPlayer: (index: number, rolls: [number, number]) => void
  executeAction: (actionId: string) => void
  playCard: (
    actionId: string,
    instanceId: string,
    to?: string,
    attachTo?: string,
    targetHeroId?: string,
    allyInstanceIds?: string[],
    allyMove?: { instanceId: string; to: string },
  ) => void
  discardCards: (actionId: string, instanceIds: string[]) => void
  moveCard: (actionId: string, instanceId: string, to: string) => void
  /** Action « Déplacer un Héros » : déplace un Héros vers un lieu voisin. */
  moveHero: (actionId: string, heroInstanceId: string, to: string) => void
  /** Action « Activer » (Jafar) : déclenche la capacité activée d'une carte. */
  activate: (
    actionId: string,
    cardInstanceId: string,
    to?: string,
    itemInstanceId?: string,
  ) => void
  vanquish: (actionId: string, heroInstanceId: string, allyInstanceIds: string[]) => void
  discardDeguisement: (instanceId: string) => void
  sheriffMove: (instanceId: string, to: string) => void
  diabloMove: (instanceId: string, to: string) => void
  /** Diablo (V2) : exécute l'action gratuite armée au lieu de Diablo. */
  diabloFreeAction: (
    inner: Extract<
      GameAction,
      { type: 'EXECUTE_ACTION' | 'PLAY_CARD' | 'DISCARD_CARDS' | 'MOVE_CARD' | 'VANQUISH' }
    >,
  ) => void
  /** Diablo (V2) : décline l'action gratuite. */
  diabloSkipFreeAction: () => void
  /** Tendre un Piège : action Éliminer un Héros facultative. */
  trapVanquish: (heroInstanceId: string, allyInstanceIds: string[]) => void
  /** Tendre un Piège : termine sans éliminer. */
  trapSkipVanquish: () => void
  playCondition: (
    playerIndex: number,
    instanceId: string,
    allyInstanceId?: string,
    to?: string,
  ) => void
  fate: (actionId: string) => void
  resolveFate: (instanceId: string, to?: string, targetHeroId?: string) => void
  /** Tyrannie : défausse les cartes choisies (résout `pendingTyrannyDiscard`). */
  resolveTyrannyDiscard: (instanceIds: string[]) => void
  /** Aurore : pose le Héros révélé sur le lieu choisi (résout `pendingHeroPlacement`). */
  resolveHeroPlacement: (locationId: string) => void
  /** Roi Stéphane : déplace le pion sur `locationId` (ou `null` = ne pas déplacer). */
  resolvePawnMove: (locationId: string | null) => void
  /** Roi Hubert : attire les Alliés choisis (≤1 par lieu voisin) vers son lieu. */
  resolveHubertPull: (allyInstanceIds: string[]) => void
  /** Retourne-toi : `keep` = garder la carte révélée ; sinon remélanger + piocher. */
  resolveDeckPeek: (keep: boolean) => void
  /** Tombée de la nuit : choisit le type (Événement/Objet) à conserver. */
  resolveTypeChoice: (cardType: import('../../engine/types').CardType) => void
  /** Apparition / Vent de panique : déplace le Héros choisi vers le lieu voisin. */
  resolveHeroRelocate: (heroInstanceId: string, to: string) => void
  /** Téléportation : déplace le pion vers le lieu (portant un Héros) choisi. */
  resolveTeleport: (to: string) => void
  resolveManipulation: (instanceId: string) => void
  dismissRoyalCroquet: () => void
  /** Par ordre de la Reine ! : transforme en arceaux les Cartes Gardes choisies. */
  resolveTransformWickets: (instanceIds: string[]) => void
  endTurn: () => void
  reset: (villains?: [VillainKey, VillainKey]) => void
  /** Fait jouer UN coup au bot, si le joueur actif est un bot. */
  botAct: () => void
  /** Fait jouer une Condition en réaction par un bot non-actif (Avarice,
   *  Lâcheté). Renvoie true si une carte a été jouée, false sinon. */
  botReact: () => boolean
}

export const useGameStore = create<GameStore>((set) => ({
  state: newGame(),
  testMode: false,
  enterTestMode: () => set({ state: buildTestState(), testMode: true }),
  testInsertCard: (playerIndex, locationId, cardId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      const players = s.state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, board: { ...p.board, [locationId]: [...(p.board[locationId] ?? []), card] } }
          : p,
      )
      return { state: { ...s.state, players } }
    }),
  testPlaceFate: (cardId, to) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLACE_FATE', card, to }) }
    }),
  testPlayCondition: (cardId, allyInstanceId, to) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLAY_CONDITION', card, allyInstanceId, to }) }
    }),
  testAddToHand: (cardId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      const players = s.state.players.map((p, i) => (i === 0 ? { ...p, hand: [...p.hand, card] } : p))
      return { state: { ...s.state, players } }
    }),
  testPlayFateCard: (cardId, targetHeroId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLAY_FATE_CARD', card, targetHeroId }) }
    }),
  testShowcase: (kind, playerIndex, opts) =>
    set((s) => {
      const key = villainKeyOf(s.state.players[playerIndex].villain)
      const cards = VILLAIN_REGISTRY[key].cards
      if (kind === 'card') {
        // Carte simple (Événement/Condition) — on évite une Malédiction (skip humain).
        const c = cards.find((x) => x.deck === 'villain' && x.type !== 'curse') ?? cards[0]
        return { state: pushShowcase(s.state, c.id, 'Aperçu — carte simple', playerIndex, undefined, undefined, opts) }
      }
      if (kind === 'hero') {
        const h = cards.find((x) => x.deck === 'fate' && x.type === 'hero')
        const loc = s.state.players[playerIndex].locations[0]?.id ?? ''
        if (!h) return s
        return {
          state: pushShowcase(s.state, h.id, 'Aperçu — Héros (vol)', playerIndex, { playerIndex, locationId: loc }, `preview#${++testFateCounter}`, opts),
        }
      }
      // Défausse (rouge = retiré par attaque ; foncé = défausse volontaire).
      // On répète le paquet Vilain pour atteindre le nombre de cartes demandé.
      const pool = cards.filter((x) => x.deck === 'villain')
      const count = Math.max(1, opts?.count ?? 3)
      const ids = pool.length === 0 ? [] : Array.from({ length: count }, (_, i) => pool[i % pool.length].id)
      const variant = kind === 'discard-red' ? 'red' : 'dark'
      return { state: pushDiscardShowcase(s.state, ids, 'Aperçu — défausse', playerIndex, variant, 'bottom', opts) }
    }),
  testRefreshTurn: () =>
    set((s) => {
      const drawn = drawPlayerToLimit(s.state.players[0], s.state.rngState)
      // Pion « non placé » + phase MOVE → on peut choisir n'importe lequel des
      // 4 lieux pour ce nouveau tour de test (comme la mise en place).
      const players = s.state.players.map((p, i) =>
        i === 0 ? { ...drawn.player, pawnLocation: null, skipNextMove: false } : p,
      )
      return {
        state: {
          ...s.state,
          players,
          rngState: drawn.rngState,
          activePlayer: 0,
          phase: 'MOVE',
          usedActionIds: [],
          persifleurAvailable: false,
          pendingFate: null,
          diabloFree: null,
          lastVanquishedHeroStrength: undefined,
          log: [...s.state.log, '[TEST] Nouveau tour — choisis le lieu de ton pion.'],
        },
      }
    }),
  setStartingPlayer: (index, rolls) =>
    set((s) => {
      const names = s.state.players.map((p) => p.villainName)
      // Compensation : le joueur qui NE commence PAS démarre avec 1 Pouvoir.
      const players = s.state.players.map((p, i) => ({ ...p, power: i === index ? 0 : 1 }))
      const loser = index === 0 ? 1 : 0
      return {
        state: {
          ...s.state,
          activePlayer: index,
          players,
          log: [
            ...s.state.log,
            `🎲 Jet de dé : ${names[0]} fait ${rolls[0]}, ${names[1]} fait ${rolls[1]} → ${names[index]} commence !`,
            `${names[loser]} commence avec 1 jeton Pouvoir (compensation).`,
          ],
        },
      }
    }),
  move: (to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'MOVE', to }) })),
  skipMove: () =>
    set((s) => ({ state: applyAction(s.state, { type: 'SKIP_MOVE' }) })),
  executeAction: (actionId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'EXECUTE_ACTION', actionId }) })),
  playCard: (actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove) =>
    set((s) => ({
      state: applyAction(s.state, {
        type: 'PLAY_CARD',
        actionId,
        instanceId,
        to,
        attachTo,
        targetHeroId,
        allyInstanceIds,
        allyMove,
      }),
    })),
  discardCards: (actionId, instanceIds) =>
    set((s) => ({ state: applyAction(s.state, { type: 'DISCARD_CARDS', actionId, instanceIds }) })),
  moveCard: (actionId, instanceId, to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'MOVE_CARD', actionId, instanceId, to }) })),
  moveHero: (actionId, heroInstanceId, to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'MOVE_HERO', actionId, heroInstanceId, to }) })),
  activate: (actionId, cardInstanceId, to, itemInstanceId) =>
    set((s) => ({
      state: applyAction(s.state, { type: 'ACTIVATE', actionId, cardInstanceId, to, itemInstanceId }),
    })),
  vanquish: (actionId, heroInstanceId, allyInstanceIds) =>
    set((s) => ({
      state: applyAction(s.state, { type: 'VANQUISH', actionId, heroInstanceId, allyInstanceIds }),
    })),
  discardDeguisement: (instanceId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'DISCARD_DEGUISEMENT', instanceId }) })),
  sheriffMove: (instanceId, to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'SHERIFF_MOVE', instanceId, to }) })),
  diabloMove: (instanceId, to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'DIABLO_MOVE', instanceId, to }) })),
  diabloFreeAction: (inner) =>
    set((s) => ({ state: applyAction(s.state, { type: 'DIABLO_FREE_ACTION', action: inner }) })),
  diabloSkipFreeAction: () =>
    set((s) => ({ state: applyAction(s.state, { type: 'DIABLO_SKIP_FREE_ACTION' }) })),
  trapVanquish: (heroInstanceId, allyInstanceIds) =>
    set((s) => ({ state: applyAction(s.state, { type: 'TRAP_VANQUISH', heroInstanceId, allyInstanceIds }) })),
  trapSkipVanquish: () =>
    set((s) => ({ state: applyAction(s.state, { type: 'TRAP_SKIP_VANQUISH' }) })),
  playCondition: (playerIndex, instanceId, allyInstanceId, to) =>
    set((s) => ({
      state: applyAction(s.state, {
        type: 'PLAY_CONDITION',
        playerIndex,
        instanceId,
        allyInstanceId,
        to,
      }),
    })),
  fate: (actionId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'FATE', actionId }) })),
  resolveFate: (instanceId, to, targetHeroId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_FATE', instanceId, to, targetHeroId }) })),
  resolveTyrannyDiscard: (instanceIds) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_TYRANNY_DISCARD', instanceIds }) })),
  resolveHeroPlacement: (locationId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_HERO_PLACEMENT', locationId }) })),
  resolvePawnMove: (locationId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_PAWN_MOVE', locationId }) })),
  resolveHubertPull: (allyInstanceIds) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_HUBERT_PULL', allyInstanceIds }) })),
  resolveDeckPeek: (keep) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_DECK_PEEK', keep }) })),
  resolveTypeChoice: (cardType) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_TYPE_CHOICE', cardType }) })),
  resolveHeroRelocate: (heroInstanceId, to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId, to }) })),
  resolveTeleport: (to) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_TELEPORT', to }) })),
  resolveManipulation: (instanceId) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_MANIPULATION', instanceId }) })),
  dismissRoyalCroquet: () =>
    set((s) => ({ state: applyAction(s.state, { type: 'DISMISS_ROYAL_CROQUET' }) })),
  resolveTransformWickets: (instanceIds) =>
    set((s) => ({ state: applyAction(s.state, { type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds }) })),
  endTurn: () =>
    set((s) => ({ state: applyAction(s.state, { type: 'END_TURN' }) })),
  reset: (villains) => set({ state: newGame(villains), testMode: false }),
  botAct: () =>
    set((s) => {
      if (s.state.status !== 'PLAYING' || !BOTS[s.state.activePlayer]) return s
      return { state: applyAction(s.state, chooseAction(s.state)) }
    }),
  botReact: () => {
    let played = false
    set((s) => {
      if (s.state.status !== 'PLAYING') return s
      // Pour chaque bot NON-ACTIF, tenter une Condition.
      for (let i = 0; i < s.state.players.length; i++) {
        if (i === s.state.activePlayer) continue
        if (!BOTS[i]) continue
        const reaction = chooseReaction(s.state, i)
        if (reaction) {
          played = true
          return { state: applyAction(s.state, reaction) }
        }
      }
      return s
    })
    return played
  },
}))
