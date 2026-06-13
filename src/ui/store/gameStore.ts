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
import { connect, type Connection } from '../../net/connection'
import { createClientSession, createHostSession, type ClientSession, type HostSession, type Session } from '../../net/session'
import type { LobbySeat } from '../../net/messages'
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
import { crochet } from '../../data/villains/crochet'
import { crochetCards } from '../../data/villains/crochet.cards'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { hades } from '../../data/villains/hades'
import { hadesCards } from '../../data/villains/hades.cards'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'

/** Sélecteur de vilain (clé stable utilisée par l'UI). */
export type VillainKey = 'princeJohn' | 'maleficent' | 'slenderman' | 'jafar' | 'reineCoeur' | 'crochet' | 'ursula' | 'hades' | 'facilier'

export const VILLAIN_REGISTRY = {
  princeJohn: { def: princeJohn, cards: princeJohnCards, label: 'Prince Jean' },
  maleficent: { def: maleficent, cards: maleficentCards, label: 'Maléfique' },
  slenderman: { def: slenderman, cards: slendermanCards, label: 'Slenderman' },
  jafar: { def: jafar, cards: jafarCards, label: 'Jafar' },
  reineCoeur: { def: reineCoeur, cards: reineCoeurCards, label: 'Reine de Cœur' },
  crochet: { def: crochet, cards: crochetCards, label: 'Capitaine Crochet' },
  ursula: { def: ursula, cards: ursulaCards, label: 'Ursula' },
  hades: { def: hades, cards: hadesCards, label: 'Hadès' },
  facilier: { def: facilier, cards: facilierCards, label: 'Dr Facilier' },
} as const

/** Qui contrôle chaque siège. Concept d'UI : le moteur, lui, ne sait pas qui
 *  joue. 'local' = ce navigateur ; 'remote' = l'autre joueur (réseau, à venir) ;
 *  'bot' = l'IA. Source de vérité pour savoir quels sièges l'autorité auto-joue
 *  (bot) vs attend (local/remote). En solo : ['local', 'bot']. */
export type SeatController = 'local' | 'remote' | 'bot'

/** Configuration des sièges en partie solo (joueur 0 = humain local, 1 = bot). */
const SOLO_SEATS: [SeatController, SeatController] = ['local', 'bot']

/** Mode de partie : 'solo' (vs bot, local) ; 'host'/'client' (réseau). */
export type GameMode = 'solo' | 'host' | 'client'

/** Étape de la connexion réseau (pilote les écrans lobby / choix des vilains).
 *  'waiting' = connecté au relais, en attente de l'autre joueur ; 'lobby' = les
 *  deux présents, choix des vilains en direct ; 'playing' = partie lancée. */
export type NetStatus = 'idle' | 'connecting' | 'waiting' | 'lobby' | 'playing' | 'error'

/** Diffuse l'état du lobby (choix des vilains) à l'autre joueur. */
function sendLobby(seats: LobbySeat[]) {
  activeConnection?.send({
    type: 'LOBBY',
    seats,
    canStart: seats.every((s) => s.connected && !!s.villainKey),
  })
}

/** Port du relais (cf. relay/server.js) — l'hôte fait tourner `npm run relay`. */
const RELAY_PORT = 8787

/** Session réseau active. Hors de l'état réactif Zustand : c'est un objet à
 *  effets (sockets), pas une donnée sérialisable. `null` en solo. En réseau,
 *  l'hôte applique+diffuse via cette session ; le client envoie ses coups et
 *  reçoit l'état. Le store s'y branche dans submit() / le cycle de vie réseau. */
let activeSession: HostSession | Session | null = null
/** Connexion réseau active (relais). Idem : hors état réactif. */
let activeConnection: Connection | null = null

/** URL du relais. L'invité ayant chargé l'app depuis l'hôte, `location.hostname`
 *  pointe déjà sur la machine hôte ; on peut donc déduire l'adresse (override
 *  possible). */
function relayUrl(host?: string): string {
  const h = host || (typeof location !== 'undefined' ? location.hostname : 'localhost')
  return `ws://${h}:${RELAY_PORT}`
}

/** Code de salon court (4 lettres, sans I/O/0/1 ambigus). */
function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

/** Ferme proprement la session/connexion réseau (sans toucher à l'état Zustand). */
function teardownNet() {
  activeConnection?.close()
  activeConnection = null
  activeSession = null
}

/** L'autre joueur est parti (LEAVE reçu) ou la connexion est tombée : on coupe et
 *  on renseigne l'avis (l'UI l'affichera puis renverra à l'accueil). Si la
 *  connexion a déjà été fermée de NOTRE côté (activeConnection null), on ignore
 *  — c'est nous qui sommes partis. */
function handlePeerGone(
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
  notice: string,
) {
  if (!activeConnection) return
  // Seulement si on était réellement en lobby/partie (sinon c'est un échec de
  // connexion initial → laissé à onError).
  const st = get().netStatus
  if (st !== 'lobby' && st !== 'playing') return
  teardownNet()
  set({ netLeftNotice: notice })
}

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
      villain: { ...p0.def, name: p0.label },
      deckCards: buildDeckInstances(p0.cards, 'villain', 'p0:'),
      fateCards: buildDeckInstances(p0.cards, 'fate', 'p0f:'),
    },
    {
      villain: { ...p1.def, name: p1.label },
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
    attachStrengthBonus: def.attachStrengthBonus,
    effects: def.effects,
    onPlace: def.onPlace,
    onVanquish: def.onVanquish,
    forbiddenLocations: def.forbiddenLocations,
    placementRestriction: def.placementRestriction,
    strengthMod: def.strengthMod,
    selfStrengthMods: def.selfStrengthMods,
    discardWhen: def.discardWhen,
    trigger: def.trigger,
    maxAtLocation: def.maxAtLocation,
    activatedCost: def.activatedCost,
    playOnlyAt: def.playOnlyAt,
    grantsAction: def.grantsAction,
    contractLocationId: def.contractLocationId,
    isTitan: def.isTitan,
    reachesAdjacentVanquish: def.reachesAdjacentVanquish,
    returnToHandOnVanquish: def.returnToHandOnVanquish,
    auDela: def.auDela,
    goesToAuDelaOnPlay: def.goesToAuDelaOnPlay,
    alsoItem: def.alsoItem,
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
  /** Contrôleur de chaque siège (voir {@link SeatController}). Détermine quels
   *  sièges l'autorité auto-joue (bot) vs attend (local/remote). */
  seats: [SeatController, SeatController]
  /** Index du joueur incarné par CE navigateur (point de vue). Solo : 0.
   *  L'UI s'en sert pour savoir quel plateau est « le mien ». */
  localPlayerIndex: number
  /** Mode de partie courant (solo par défaut). */
  mode: GameMode
  /** Étape de la connexion réseau (écran lobby). */
  netStatus: NetStatus
  /** Code de salon (hôte) à communiquer à l'invité ; null hors hébergement. */
  hostRoom: string | null
  /** Dernier message d'erreur réseau (affiché par le lobby). */
  netError: string | null
  /** Renseigné quand l'autre joueur a quitté / la connexion est perdue : l'UI
   *  affiche un avis puis renvoie à l'accueil. null sinon. */
  netLeftNotice: string | null
  /** État du lobby (choix des vilains en direct) : seats[0] = hôte, seats[1] =
   *  invité. null hors lobby. */
  lobby: LobbySeat[] | null
  /** Point d'entrée UNIQUE de tout coup de jeu. Solo : applique localement. En
   *  réseau : l'hôte applique+diffuse, le client envoie (via la session). Toutes
   *  les méthodes de jeu y transitent. */
  submit: (action: GameAction) => void
  /** Héberge une partie réseau : ouvre un salon et attend l'invité. Le choix des
   *  vilains se fait ensuite, en direct (phase lobby). */
  startHost: () => void
  /** Rejoint le salon `code` (relais sur `host`, défaut = hôte de la page). */
  joinHost: (code: string, host?: string) => void
  /** Pendant le lobby : choisit (ou retire avec null) SON vilain ; synchronisé. */
  selectVillain: (villainKey: VillainKey | null) => void
  /** Hôte uniquement : lance la partie une fois les deux vilains choisis. */
  launchGame: () => void
  /** Quitte volontairement la partie réseau en prévenant l'autre joueur (LEAVE),
   *  puis revient au mode solo. */
  quitNet: () => void
  /** Quitte la partie réseau et revient au mode solo. */
  leaveNet: () => void
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
  /** MODE TEST (Dr Facilier) : ajoute une carte (par cardId) à la Pile de l'Au-delà
   *  du joueur 0 — pour tester Divination et les effets Au-delà. */
  testAddToAuDela: (cardId: string) => void
  /** MODE TEST : joue une carte Fatalité non-Héros (Voler aux Riches,
   *  Déguisement) CONTRE le joueur 0, sur l'un de ses Héros (`targetHeroId`). */
  testPlayFateCard: (cardId: string, targetHeroId: string, enlargeToward?: string) => void
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
    shrinkFreeActionId?: string,
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
  resolveFate: (instanceId: string, to?: string, targetHeroId?: string, enlargeToward?: string) => void
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
  /** Décline un déplacement de Héros facultatif (Poupées vaudou). */
  skipHeroRelocate: () => void
  /** Téléportation : déplace le pion vers le lieu (portant un Héros) choisi. */
  resolveTeleport: (to: string) => void
  resolveManipulation: (instanceId: string) => void
  dismissRoyalCroquet: () => void
  /** Par ordre de la Reine ! : transforme en arceaux les Cartes Gardes choisies. */
  resolveTransformWickets: (instanceIds: string[]) => void
  /** Faites-leur peur ! : remet sur le dessus / défausse les cartes sondées. */
  resolveScry: (topInstanceIds: string[]) => void
  /** Pas de Quartier ! : déplace l'Allié choisi vers un lieu voisin (+force). */
  resolveAllyMoveBuff: (instanceId: string, to: string) => void
  /** Abu/Aladdin/K.O. : applique le choix (Objet volé / Allié retiré). */
  resolveFateChoice: (instanceId: string) => void
  /** Digne Adversaire / Obsession : joue (sur `to`) ou défausse le Héros dévoilé. */
  resolveFetchedHero: (play: boolean, to?: string) => void
  /** Carte du Pays Imaginaire : défausse-la et joue gratuitement un Objet de la main. */
  useNeverlandMap: (itemInstanceId: string, to: string, attachTo?: string) => void
  /** Opportunisme : reprend en main la carte choisie de la défausse Vilain. */
  resolveRecover: (instanceId: string) => void
  /** Colère Titanesque : choisit le lieu voisin où effectuer une action. */
  resolveGiantLocation: (locationId: string) => void
  /** Préparez-vous au combat ! (Hadès) : déplace le Titan choisi vers `to`. */
  resolveTitanMove: (titanInstanceId: string, to: string) => void
  /** Héra / Pégase (Hadès, Fatalité) : entrave ou repousse le Titan choisi. */
  resolveTitanSelect: (titanInstanceId: string) => void
  /** Divination (Dr Facilier) : résout les cartes révélées de l'Au-delà dans
   *  l'ordre `topInstanceIds`. */
  resolveDivination: (topInstanceIds: string[]) => void
  /** Tour de passe-passe (Dr Facilier) : garde `keepInstanceIds` en main. */
  resolveLookTop: (keepInstanceIds: string[]) => void
  /** Si près du but / Charlotte (Dr Facilier) : place `toAudelaIds` dans l'Au-delà,
   *  remet `deckTopOrder` sur le dessus de la pioche. */
  resolveFateScry: (toAudelaIds: string[], deckTopOrder: string[]) => void
  /** Canne (Dr Facilier) : ouvre le choix d'un lieu voisin où agir. */
  useCanne: () => void
  /** Char (Hadès) : déplace la figurine + le Char vers `to`. */
  chariotMove: (instanceId: string, to: string) => void
  endTurn: () => void
  reset: (villains?: [VillainKey, VillainKey]) => void
  /** Fait jouer UN coup au bot, si le joueur actif est un bot. */
  botAct: () => void
  /** Fait jouer une Condition en réaction par un bot non-actif (Avarice,
   *  Lâcheté). Renvoie true si une carte a été jouée, false sinon. */
  botReact: () => boolean
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: newGame(),
  seats: SOLO_SEATS,
  localPlayerIndex: 0,
  mode: 'solo',
  netStatus: 'idle',
  hostRoom: null,
  netError: null,
  netLeftNotice: null,
  lobby: null,
  testMode: false,
  submit: (action) => {
    if (get().mode === 'solo') {
      set((s) => ({ state: applyAction(s.state, action) }))
      return
    }
    // Réseau : l'hôte applique+diffuse, le client envoie. Le store se met à jour
    // via le callback onState de la session (cf. cycle de vie réseau).
    activeSession?.submitLocal(action)
  },
  startHost: () => {
    teardownNet()
    const room = makeRoomCode()
    const conn = connect(relayUrl(), room, {
      onMessage: (msg) => {
        // Partie lancée : tout passe par la session de jeu.
        if (activeSession) { (activeSession as HostSession).receive(msg); return }
        // Phase lobby (côté hôte) : présence de l'invité, son vilain, son départ.
        if (msg.type === 'LEAVE') {
          handlePeerGone(set, get, 'L’autre joueur a quitté la partie.')
          return
        } else if (msg.type === 'JOIN') {
          set((s) => ({
            lobby: s.lobby?.map((x) => (x.seat === 1 ? { ...x, connected: true } : x)) ?? null,
            netStatus: 'lobby',
          }))
        } else if (msg.type === 'SELECT_VILLAIN') {
          set((s) => ({
            lobby: s.lobby?.map((x) => (x.seat === 1 ? { ...x, villainKey: msg.villainKey } : x)) ?? null,
          }))
        } else return
        const lob = get().lobby
        if (lob) sendLobby(lob)
      },
      onOpen: () => set({ netStatus: 'waiting' }),
      onClose: () => handlePeerGone(set, get, 'La connexion avec l’autre joueur a été perdue.'),
      onError: () => set({ netStatus: 'error', netError: 'Erreur réseau (relais injoignable ?).' }),
    })
    activeConnection = conn
    set({
      mode: 'host', localPlayerIndex: 0, seats: ['local', 'remote'],
      hostRoom: room, netStatus: 'connecting', netError: null,
      lobby: [
        { seat: 0, villainKey: null, connected: true },
        { seat: 1, villainKey: null, connected: false },
      ],
    })
  },
  joinHost: (code, host) => {
    teardownNet()
    let session: ClientSession | null = null
    const conn = connect(relayUrl(host), code.toUpperCase(), {
      onMessage: (msg) => session?.receive(msg),
      onOpen: () => set({ netStatus: 'waiting' }),
      onClose: () => handlePeerGone(set, get, 'La connexion avec l’hôte a été perdue.'),
      onError: () => set({ netStatus: 'error', netError: 'Erreur réseau (hôte injoignable ?).' }),
    })
    activeConnection = conn
    session = createClientSession({
      transport: { send: conn.send },
      callbacks: {
        onLobby: (m) => set({ lobby: m.seats, netStatus: 'lobby' }),
        onAssign: (seat) => set({ localPlayerIndex: seat, seats: seat === 0 ? ['local', 'remote'] : ['remote', 'local'] }),
        onState: (state) => set({ state, netStatus: 'playing' }),
        onLeave: () => handlePeerGone(set, get, 'L’autre joueur a quitté la partie.'),
      },
    })
    activeSession = session
    set({ mode: 'client', localPlayerIndex: 1, seats: ['remote', 'local'], netStatus: 'connecting', netError: null, lobby: null })
  },
  selectVillain: (villainKey) => {
    const { mode } = get()
    const mySeat = get().localPlayerIndex
    set((s) => ({ lobby: s.lobby?.map((x) => (x.seat === mySeat ? { ...x, villainKey } : x)) ?? null }))
    if (mode === 'host') {
      const lob = get().lobby
      if (lob) sendLobby(lob)
    } else if (mode === 'client') {
      ;(activeSession as ClientSession | null)?.selectVillain(villainKey)
    }
  },
  launchGame: () => {
    const { mode, lobby } = get()
    if (mode !== 'host' || !lobby) return
    const hostV = lobby[0].villainKey as VillainKey | null
    const clientV = lobby[1].villainKey as VillainKey | null
    if (!hostV || !clientV) return
    const initial = newGame([hostV, clientV])
    const session = createHostSession({
      transport: { send: activeConnection!.send },
      initialState: initial,
      seats: ['human', 'human'],
      hostSeat: 0,
      callbacks: {
        onState: (state) => set({ state }),
        onLeave: () => handlePeerGone(set, get, 'L’autre joueur a quitté la partie.'),
      },
    })
    activeSession = session
    set({ state: initial, netStatus: 'playing' })
    session.start() // diffuse ASSIGN + STATE à l'invité
  },
  quitNet: () => {
    activeConnection?.send({ type: 'LEAVE' }) // prévient l'autre joueur…
    get().leaveNet() // …puis coupe et revient au solo.
  },
  leaveNet: () => {
    teardownNet()
    set({ mode: 'solo', seats: SOLO_SEATS, localPlayerIndex: 0, netStatus: 'idle', hostRoom: null, netError: null, netLeftNotice: null, lobby: null })
  },
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
  testAddToAuDela: (cardId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      const players = s.state.players.map((p, i) => (i === 0 ? { ...p, auDela: [...p.auDela, card] } : p))
      return { state: { ...s.state, players } }
    }),
  testPlayFateCard: (cardId, targetHeroId, enlargeToward) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLAY_FATE_CARD', card, targetHeroId, enlargeToward }) }
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
    get().submit({ type: 'MOVE', to }),
  skipMove: () =>
    get().submit({ type: 'SKIP_MOVE' }),
  executeAction: (actionId) =>
    get().submit({ type: 'EXECUTE_ACTION', actionId }),
  playCard: (actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId) =>
    get().submit({
        type: 'PLAY_CARD',
        actionId,
        instanceId,
        to,
        attachTo,
        targetHeroId,
        allyInstanceIds,
        allyMove,
        shrinkFreeActionId,
      }),
  discardCards: (actionId, instanceIds) =>
    get().submit({ type: 'DISCARD_CARDS', actionId, instanceIds }),
  moveCard: (actionId, instanceId, to) =>
    get().submit({ type: 'MOVE_CARD', actionId, instanceId, to }),
  moveHero: (actionId, heroInstanceId, to) =>
    get().submit({ type: 'MOVE_HERO', actionId, heroInstanceId, to }),
  activate: (actionId, cardInstanceId, to, itemInstanceId) =>
    get().submit({ type: 'ACTIVATE', actionId, cardInstanceId, to, itemInstanceId }),
  vanquish: (actionId, heroInstanceId, allyInstanceIds) =>
    get().submit({ type: 'VANQUISH', actionId, heroInstanceId, allyInstanceIds }),
  discardDeguisement: (instanceId) =>
    get().submit({ type: 'DISCARD_DEGUISEMENT', instanceId }),
  sheriffMove: (instanceId, to) =>
    get().submit({ type: 'SHERIFF_MOVE', instanceId, to }),
  diabloMove: (instanceId, to) =>
    get().submit({ type: 'DIABLO_MOVE', instanceId, to }),
  diabloFreeAction: (inner) =>
    get().submit({ type: 'DIABLO_FREE_ACTION', action: inner }),
  diabloSkipFreeAction: () =>
    get().submit({ type: 'DIABLO_SKIP_FREE_ACTION' }),
  trapVanquish: (heroInstanceId, allyInstanceIds) =>
    get().submit({ type: 'TRAP_VANQUISH', heroInstanceId, allyInstanceIds }),
  trapSkipVanquish: () =>
    get().submit({ type: 'TRAP_SKIP_VANQUISH' }),
  playCondition: (playerIndex, instanceId, allyInstanceId, to) =>
    get().submit({
        type: 'PLAY_CONDITION',
        playerIndex,
        instanceId,
        allyInstanceId,
        to,
      }),
  fate: (actionId) =>
    get().submit({ type: 'FATE', actionId }),
  resolveFate: (instanceId, to, targetHeroId, enlargeToward) =>
    get().submit({ type: 'RESOLVE_FATE', instanceId, to, targetHeroId, enlargeToward }),
  resolveTyrannyDiscard: (instanceIds) =>
    get().submit({ type: 'RESOLVE_TYRANNY_DISCARD', instanceIds }),
  resolveHeroPlacement: (locationId) =>
    get().submit({ type: 'RESOLVE_HERO_PLACEMENT', locationId }),
  resolvePawnMove: (locationId) =>
    get().submit({ type: 'RESOLVE_PAWN_MOVE', locationId }),
  resolveHubertPull: (allyInstanceIds) =>
    get().submit({ type: 'RESOLVE_HUBERT_PULL', allyInstanceIds }),
  resolveDeckPeek: (keep) =>
    get().submit({ type: 'RESOLVE_DECK_PEEK', keep }),
  resolveTypeChoice: (cardType) =>
    get().submit({ type: 'RESOLVE_TYPE_CHOICE', cardType }),
  resolveHeroRelocate: (heroInstanceId, to) =>
    get().submit({ type: 'RESOLVE_HERO_RELOCATE', heroInstanceId, to }),
  skipHeroRelocate: () =>
    get().submit({ type: 'SKIP_HERO_RELOCATE' }),
  resolveTeleport: (to) =>
    get().submit({ type: 'RESOLVE_TELEPORT', to }),
  resolveManipulation: (instanceId) =>
    get().submit({ type: 'RESOLVE_MANIPULATION', instanceId }),
  dismissRoyalCroquet: () =>
    get().submit({ type: 'DISMISS_ROYAL_CROQUET' }),
  resolveTransformWickets: (instanceIds) =>
    get().submit({ type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds }),
  resolveScry: (topInstanceIds) =>
    get().submit({ type: 'RESOLVE_SCRY', topInstanceIds }),
  resolveAllyMoveBuff: (instanceId, to) =>
    get().submit({ type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId, to }),
  resolveFateChoice: (instanceId) =>
    get().submit({ type: 'RESOLVE_FATE_CHOICE', instanceId }),
  resolveFetchedHero: (play, to) =>
    get().submit({ type: 'RESOLVE_FETCHED_HERO', play, to }),
  useNeverlandMap: (itemInstanceId, to, attachTo) =>
    get().submit({ type: 'USE_NEVERLAND_MAP', itemInstanceId, to, attachTo }),
  resolveRecover: (instanceId) =>
    get().submit({ type: 'RESOLVE_RECOVER', instanceId }),
  resolveGiantLocation: (locationId) =>
    get().submit({ type: 'RESOLVE_GIANT_LOCATION', locationId }),
  resolveTitanMove: (titanInstanceId, to) =>
    get().submit({ type: 'RESOLVE_TITAN_MOVE', titanInstanceId, to }),
  resolveTitanSelect: (titanInstanceId) =>
    get().submit({ type: 'RESOLVE_TITAN_SELECT', titanInstanceId }),
  resolveDivination: (topInstanceIds) =>
    get().submit({ type: 'RESOLVE_DIVINATION', topInstanceIds }),
  resolveLookTop: (keepInstanceIds) =>
    get().submit({ type: 'RESOLVE_LOOK_TOP', keepInstanceIds }),
  resolveFateScry: (toAudelaIds, deckTopOrder) =>
    get().submit({ type: 'RESOLVE_FATE_SCRY', toAudelaIds, deckTopOrder }),
  useCanne: () =>
    get().submit({ type: 'USE_CANNE' }),
  chariotMove: (instanceId, to) =>
    get().submit({ type: 'CHARIOT_MOVE', instanceId, to }),
  endTurn: () =>
    get().submit({ type: 'END_TURN' }),
  reset: (villains) => {
    teardownNet()
    set({
      state: newGame(villains), testMode: false, seats: SOLO_SEATS, localPlayerIndex: 0,
      mode: 'solo', netStatus: 'idle', hostRoom: null, netError: null, netLeftNotice: null, lobby: null,
    })
  },
  botAct: () =>
    set((s) => {
      if (s.state.status !== 'PLAYING' || s.seats[s.state.activePlayer] !== 'bot') return s
      return { state: applyAction(s.state, chooseAction(s.state)) }
    }),
  botReact: () => {
    let played = false
    set((s) => {
      if (s.state.status !== 'PLAYING') return s
      // Pour chaque bot NON-ACTIF, tenter une Condition.
      for (let i = 0; i < s.state.players.length; i++) {
        if (i === s.state.activePlayer) continue
        if (s.seats[i] !== 'bot') continue
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
