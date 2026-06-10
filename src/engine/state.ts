// =============================================================================
// Création et utilitaires de l'état de jeu (fonctions pures).
// =============================================================================

import type {
  CardInstance,
  FloatingFx,
  GameState,
  Location,
  PlayerState,
  VillainDef,
} from './types'
import { shuffle } from './rng'

/** Nombre de cartes en main à compléter en fin de tour. */
export const HAND_LIMIT = 4

/** Configuration d'un joueur pour démarrer une partie. */
export interface PlayerSetup {
  villain: VillainDef
  /** Exemplaires du deck Vilain (instanceId déjà uniques entre joueurs). */
  deckCards: CardInstance[]
  /** Exemplaires du deck Fatalité (joué par les adversaires contre ce joueur). */
  fateCards: CardInstance[]
}

/** Copie défensive du plateau pour ne pas partager de référence mutable. */
function cloneLocations(locations: Location[]): Location[] {
  return locations.map((loc) => ({
    ...loc,
    actions: loc.actions.map((a) => ({ ...a })),
  }))
}

// --- Accès au joueur actif -------------------------------------------------

/** Le joueur dont c'est le tour. */
export function activePlayer(state: GameState): PlayerState {
  return state.players[state.activePlayer]
}

/** Renvoie un nouvel état où le joueur actif a été transformé par `fn`. */
export function updateActivePlayer(
  state: GameState,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return updatePlayer(state, state.activePlayer, fn)
}

/** Renvoie un nouvel état où le joueur `index` a été transformé par `fn`. */
export function updatePlayer(
  state: GameState,
  index: number,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === index ? fn(p) : p)),
  }
}

/** Pousse un événement showcase (UI cinématique). Pur. `opts` permet de régler
 *  la durée ou le mode « fixe » (mode test, pour caler les positions). */
export function pushShowcase(
  state: GameState,
  cardId: string,
  message: string,
  playerIndex: number = state.activePlayer,
  destination?: { playerIndex: number; locationId: string },
  cardInstanceId?: string,
  opts?: { durationMs?: number; fixed?: boolean },
): GameState {
  return {
    ...state,
    showcaseEvents: [
      ...state.showcaseEvents,
      { cardId, message, playerIndex, destination, cardInstanceId, ...opts },
    ],
  }
}

/** Ajoute un effet flottant à la file (animation UI). Pur. */
export function pushFloatingFx(state: GameState, fx: FloatingFx): GameState {
  return { ...state, floatingFx: [...(state.floatingFx ?? []), fx] }
}

/** Pousse un effet flottant « Robin chipe N Pouvoir » sur la carte Robin des Bois
 *  du royaume de `playerIndex`. No-op si N≤0 ou si Robin n'y est pas. Pur. */
export function pushRobinSteal(state: GameState, playerIndex: number, amount: number): GameState {
  if (amount <= 0) return state
  const p = state.players[playerIndex]
  let loc: string | undefined
  for (const l of p.locations) {
    if ((p.board[l.id] ?? []).some((c) => c.cardId === 'robin-des-bois')) {
      loc = l.id
      break
    }
  }
  if (!loc) return state
  return pushFloatingFx(state, { kind: 'robin-steal', amount, playerIndex, locationId: loc })
}

/** Annote un événement showcase déjà poussé (par index) avec le pouvoir gagné,
 *  pour l'animation « +N JT ». No-op si l'index est invalide ou le gain ≤ 0. */
export function annotateShowcaseGain(
  state: GameState,
  index: number,
  gainedPower: number,
): GameState {
  if (gainedPower <= 0 || index < 0 || index >= state.showcaseEvents.length) return state
  return {
    ...state,
    showcaseEvents: state.showcaseEvents.map((e, i) => (i === index ? { ...e, gainedPower } : e)),
  }
}

/**
 * Pousse un showcase « défausse » : plusieurs cartes retirées montrées côte à
 * côte avant de disparaître (Prince Philippe défausse Alliés + Forêt de Ronces,
 * défausse volontaire de l'adversaire…). Pur. `playerIndex` = propriétaire des
 * cartes (détermine le côté gauche/droit du showcase).
 */
export function pushDiscardShowcase(
  state: GameState,
  cardIds: string[],
  message: string,
  playerIndex: number,
  variant: 'red' | 'dark',
  anchor: 'center' | 'bottom' = 'center',
  opts?: { durationMs?: number; fixed?: boolean; gainedPower?: number },
): GameState {
  if (cardIds.length === 0) return state
  return {
    ...state,
    showcaseEvents: [
      ...state.showcaseEvents,
      { cardId: cardIds[0], message, playerIndex, discard: { cardIds, variant, anchor }, ...opts },
    ],
  }
}

/**
 * Révèle les `count` premières cartes du deck Fatalité d'un joueur (les retire
 * de sa pioche), en remélangeant sa défausse Fatalité si la pioche se vide. Pur.
 */
export function revealFate(
  player: PlayerState,
  count: number,
  rngState: number,
): { revealed: CardInstance[]; player: PlayerState; rngState: number } {
  let deck = player.fateDeck
  let discard = player.fateDiscard
  let s = rngState
  const revealed: CardInstance[] = []
  while (revealed.length < count) {
    if (deck.length === 0) {
      if (discard.length === 0) break // plus aucune carte Fatalité
      const r = shuffle(discard, s)
      deck = r.result
      s = r.state
      discard = []
    }
    const [top, ...rest] = deck
    deck = rest
    revealed.push(top)
  }
  return { revealed, player: { ...player, fateDeck: deck, fateDiscard: discard }, rngState: s }
}

/** Retrouve un lieu d'un joueur par son id. */
export function findLocation(player: PlayerState, id: string): Location | undefined {
  return player.locations.find((loc) => loc.id === id)
}

/** Lieu où se trouve le pion du joueur actif, ou undefined si pas encore placé. */
export function currentLocation(state: GameState): Location | undefined {
  const p = activePlayer(state)
  return p.pawnLocation ? findLocation(p, p.pawnLocation) : undefined
}

// --- Pioche ----------------------------------------------------------------

/**
 * Complète la main d'un joueur jusqu'à HAND_LIMIT, en remélangeant sa défausse
 * dans sa pioche si nécessaire. Pur : renvoie le joueur mis à jour + le nouvel
 * état du PRNG + le nombre de cartes piochées.
 */
export function drawPlayerToLimit(
  player: PlayerState,
  rngState: number,
): { player: PlayerState; rngState: number; drawn: number } {
  let deck = player.deck
  let hand = player.hand
  let discard = player.discard
  let s = rngState
  let drawn = 0

  while (hand.length < HAND_LIMIT) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      const reshuffled = shuffle(discard, s)
      deck = reshuffled.result
      s = reshuffled.state
      discard = []
    }
    const [top, ...rest] = deck
    deck = rest
    hand = [...hand, top]
    drawn++
  }

  return { player: { ...player, deck, hand, discard }, rngState: s, drawn }
}

/** Complète la main du JOUEUR ACTIF jusqu'à HAND_LIMIT (fin de tour). */
export function drawToLimit(state: GameState): GameState {
  const result = drawPlayerToLimit(activePlayer(state), state.rngState)
  if (result.drawn === 0) return state
  const next = updateActivePlayer(state, () => result.player)
  return {
    ...next,
    rngState: result.rngState,
    log: [
      ...next.log,
      `${result.player.villainName} pioche ${result.drawn} carte${result.drawn > 1 ? 's' : ''}.`,
    ],
  }
}

// --- Création de la partie -------------------------------------------------

function makePlayer(
  villain: VillainDef,
  deck: CardInstance[],
  fateDeck: CardInstance[],
  startingPower: number,
): PlayerState {
  return {
    villain: villain.id,
    villainName: villain.name,
    locations: cloneLocations(villain.locations),
    boardImage: villain.boardImage,
    pawnImage: villain.pawnImage,
    pawnHeightPx: villain.pawnHeightPx,
    backVillainImage: villain.backVillainImage,
    backFateImage: villain.backFateImage,
    // Règle de mise en place : le pion démarre sur le lieu le plus à gauche.
    // Le déplacement étant obligatoire vers un lieu différent, ce lieu n'est
    // donc pas jouable au premier tour.
    pawnLocation: villain.locations[0]?.id ?? null,
    power: startingPower,
    objective: villain.objective,
    objectiveDescription: villain.objectiveDescription,
    deck,
    hand: [],
    discard: [],
    board: Object.fromEntries(villain.locations.map((l) => [l.id, []])),
    fateDeck,
    fateDiscard: [],
  }
}

/**
 * Construit l'état initial d'une partie. Le deck de chaque joueur est mélangé
 * avec le PRNG partagé (graine `seed`), puis chacun pioche une main de 4 cartes.
 */
export function createInitialGame(setups: PlayerSetup[], seed: number): GameState {
  let rngState = seed >>> 0
  const players: PlayerState[] = []
  const setupLog: string[] = []

  for (let i = 0; i < setups.length; i++) {
    const { villain, deckCards, fateCards } = setups[i]
    const shuffled = shuffle(deckCards, rngState)
    rngState = shuffled.state
    // Le deck Fatalité est aussi mélangé (après le deck Vilain, pour ne pas
    // perturber l'ordre de pioche existant).
    const shuffledFate = shuffle(fateCards, rngState)
    rngState = shuffledFate.state
    // Règle officielle : chaque joueur démarre avec un nombre de JT = position
    // dans l'ordre de tour (1ᵉʳ : 0, 2ᵉ : 1, 3ᵉ : 2…) pour compenser l'avantage
    // de jouer en premier.
    const drawn = drawPlayerToLimit(
      makePlayer(villain, shuffled.result, shuffledFate.result, i),
      rngState,
    )
    rngState = drawn.rngState
    players.push(drawn.player)
    setupLog.push(
      `${villain.name} entre en jeu${i > 0 ? ` (${i} JT de départ)` : ''}.`,
    )
  }

  return {
    players,
    activePlayer: 0,
    turn: 1,
    phase: 'MOVE',
    usedActionIds: [],
    status: 'PLAYING',
    winner: null,
    rngState,
    pendingFate: null,
    persifleurAvailable: false,
    lastVanquishedHeroStrength: undefined,
    showcaseEvents: [],
    floatingFx: [],
    log: ['Début de partie.', ...setupLog],
  }
}
