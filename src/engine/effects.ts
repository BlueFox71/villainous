// =============================================================================
// Système d'effets composables.
//
// Chaque carte porte une liste d'Effect (cf. types.ts). Le dispatcher ci-dessous
// sait résoudre chaque type d'effet sur l'état pour un joueur ACTEUR donné.
// Par défaut, l'acteur est le joueur actif (cartes Vilain). Pour les effets
// « à la pose » d'un Héros, l'acteur est la CIBLE de la Fatalité (celui qui
// reçoit le Héros sur son plateau), et le contexte porte aussi l'identifiant
// de la carte hôte (le Héros) et le lieu où il vient d'être posé.
//
// Ajouter un comportement = ajouter un variant à Effect + un `case` ici.
// =============================================================================

import type { CardInstance, Crewmate, CurseDiscardTrigger, DiceOutcome, Effect, GameState, LocationId, PlayerState } from './types'
import { activePlayer, dioPowerFactor, drawPlayerToLimit, findLocation, pushDiscardShowcase, pushFloatingFx, pushRevealShowcase, pushRobinSteal, pushScryDiscardShowcase, pushShowcase, revealFate, syncObservatoryLock, updateActivePlayer, updatePlayer } from './state'
import { neighborLocIds, placeCrewmateAt } from './crewmates'
import { startRace, advanceRacer, advanceRacerByReveal, moveRacerBack, moveKingCandyTrack, vanellopeInstance, cardLocationIds } from './kingCandy'
import { noFireInRealm as shereKhanNoFire, placeFire, removeFire, fireOnLocation, fireFreeActions, listFire } from './shereKhan'
import {
  isDavyJones,
  realmHeroes,
  heroesWithoutTreasure,
  heroesWithFacedownTreasure,
  heroesWithTreasure,
  findHero as findTreasureHero,
  placeFacedownTreasure,
  removeTreasureToReserve,
  revealTreasure,
  TREASURE_NAMES,
} from './davyJones'
import { shuffle, nextRandom, rollD6 } from './rng'
import { KEY_COLORS, type KeyColor } from './types'
import {
  activatableCards,
  adjacentLocationIds,
  belleBlocksRemoval,
  dingoSwapOptions,
  isGlassSlipper,
  movableCards,
  ownedKeyColors,
  effectiveStrength,
  goalsBlockedByHero,
  hasHeroInRealm,
  heroPlacementLocations,
  lotsoReducibleHeroes,
  locationOfCard,
  realmRelocateCandidates,
  teleportTargets,
  totalObstacles,
  transformableGuards,
} from './rules'

/** Contexte de résolution d'un effet : qui en est l'acteur, et le cas échéant
 *  la carte hôte et le lieu hôte (pour les effets « à la pose » d'un Héros). */
export interface EffectContext {
  /** Index du joueur qui SUBIT/PROVOQUE l'effet. Défaut : joueur actif. */
  actorIndex?: number
  /** Carte hôte sur laquelle s'ancrer (Héros qui vient d'être posé, etc.). */
  hostInstanceId?: string
  /** Lieu où se trouve la carte hôte. */
  hostLocationId?: LocationId
  /** Lieu de DESTINATION de la carte en train d'être jouée (son `to`). Permet à un
   *  effet « à la pose » de viser le lieu où la carte atterrit (Mirage : jouer le Héros
   *  sur le même lieu que Mirage). */
  playDestination?: LocationId
  /** Héros ciblé par la carte jouée (Emprisonnement : Héros à déplacer). */
  targetHeroId?: string
  /** Alliés à utiliser pour les effets qui déclenchent un Vanquish (Intimidation). */
  allyInstanceIds?: string[]
  /** Allié à déplacer librement avant un Vanquish (Tendre un Piège). */
  allyMove?: { instanceId: string; to: LocationId }
  /** Reine de Cœur — Agrandir : lieu voisin vers lequel le Héros agrandi pivote
   *  (choisi par le joueur qui pose la Fatalité). Absent = choix auto par le moteur. */
  enlargeToward?: LocationId
  /** Reine de Cœur — Rapetisser : action du haut que le Héros rapetissé laisse
   *  LIBRE (choisie par le joueur). Absent = la 1ʳᵉ action du haut (auto). */
  shrinkFreeActionId?: string
}

// --- Helpers Coéquipiers (L'Imposteur) ---------------------------------------

/** Lieux « périmètre » d'un Imposteur : son lieu de pion + les lieux portant un de
 *  ses Alliés (non associés). Sert aux effets « sur votre lieu ou celui d'un Allié ». */
function crewPeri(p: GameState['players'][number]): Set<string> {
  const allyLocs = p.locations
    .filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo))
    .map((l) => l.id)
  return new Set([p.pawnLocation, ...allyLocs].filter((v): v is string => !!v))
}

/** Remplace les Coéquipiers du joueur `idx` et ajoute une ligne de journal. */
function setCrew(state: GameState, idx: number, crew: Crewmate[], msg: string): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === idx ? { ...p, crewmates: crew } : p)),
    log: [...state.log, `${state.players[idx].villainName} : ${msg}.`],
  }
}

/** Journalise un effet Coéquipier sans changement d'état (cas « rien à faire »). */
function logCrew(state: GameState, idx: number, msg: string): GameState {
  return { ...state, log: [...state.log, `${state.players[idx].villainName} : ${msg}.`] }
}

/** Nombre de Héros présents dans le royaume d'un joueur donné. */
export function countHeroesInRealm(state: GameState, actorIndex?: number): number {
  const idx = actorIndex ?? state.activePlayer
  return Object.values(state.players[idx].board).reduce(
    (n, cards) => n + cards.filter((c) => c.type === 'hero').length,
    0,
  )
}

/** Pénalité passive sur les gains de pouvoir dans le royaume (Robin → −1). */
function realmPowerPenalty(state: GameState, idx: number): number {
  return hasHeroInRealm(state, idx, 'robin-des-bois') ? 1 : 0
}

// --- Oogie Boogie : lancers de dés ------------------------------------------

/** Modificateur appliqué au prochain lancer de `idx` : +1 si Gram est sur le lieu
 *  du pion (capacité de Gram), −2 par jeton « Salut, Oogie ! » (Fatalité). */
export function oogieRollModifier(p: PlayerState): number {
  let mod = 0
  if (p.pawnLocation && (p.board[p.pawnLocation] ?? []).some((c) => c.cardId === 'gram')) mod += 1
  mod -= 2 * (p.helloOogieTokens ?? 0)
  return mod
}

/** Dr Facilier — L'étoile du soir : retire l'Allié `allyInstanceId` du royaume du joueur
 *  `targetIdx` et le place dans sa Pile de l'Au-delà ; ses Objets associés partent en
 *  défausse. Sans effet si l'Allié est introuvable. */
export function placeAllyInAuDela(state: GameState, targetIdx: number, allyInstanceId: string): GameState {
  const target = state.players[targetIdx]
  let loc: LocationId | undefined
  let ally: CardInstance | undefined
  for (const l of target.locations) {
    const found = (target.board[l.id] ?? []).find((c) => c.instanceId === allyInstanceId)
    if (found) {
      ally = found
      loc = l.id
      break
    }
  }
  if (!ally || !loc) return state
  const allyLoc = loc
  const allyCard = ally
  const attached = (target.board[allyLoc] ?? []).filter((c) => c.attachedTo === allyCard.instanceId)
  const removed = new Set([allyCard.instanceId, ...attached.map((c) => c.instanceId)])
  const next = updatePlayer(state, targetIdx, (p) => ({
    ...p,
    board: { ...p.board, [allyLoc]: (p.board[allyLoc] ?? []).filter((c) => !removed.has(c.instanceId)) },
    discard: [...p.discard, ...attached.map((c) => ({ ...c, attachedTo: undefined }))],
    auDela: [...p.auDela, { ...allyCard, attachedTo: undefined }],
  }))
  return {
    ...next,
    log: [...next.log, `L'étoile du soir : **${allyCard.name}** est placé dans la Pile de l'Au-delà de ${target.villainName}.`],
  }
}

/** Lance 2 dés à 6 faces (déterministe). */
function rollTwoDice(rngState: number): { dice: [number, number]; rngState: number } {
  const a = rollD6(rngState)
  const b = rollD6(a.state)
  return { dice: [a.value, b.value], rngState: b.state }
}

/** Total visé quand le résultat est CHOISI (Cette fois l'affaire est dans le sac) :
 *  on prend le meilleur pour l'issue (toujours le succès). */
function controlledDice(outcome: DiceOutcome): [number, number] {
  // 12 satisfait tous les seuils favorables (impostor ≥7, making/merveille/trick ≥8).
  return outcome.kind === 'making-christmas' || outcome.kind === 'merveille' || outcome.kind === 'trick-or-treat' || outcome.kind === 'impostor'
    ? [6, 6]
    : [6, 6]
}

/** Ouvre une fenêtre de lancer de dés : lance (ou prend le résultat choisi si
 *  `bagControlledDice`), applique les modificateurs, consomme les jetons Salut Oogie !,
 *  publie `diceRoll` (animation UI) et arme `pendingDice` (RESOLVE_DICE / reroll). */
export function openDiceRoll(
  state: GameState,
  idx: number,
  context: string,
  outcome: DiceOutcome,
  cardId?: string,
): GameState {
  const controlled = !!state.bagControlledDice
  const r = controlled
    ? { dice: controlledDice(outcome), rngState: state.rngState }
    : rollTwoDice(state.rngState)
  const p0 = state.players[idx]
  const modifier = oogieRollModifier(p0)
  const total = r.dice[0] + r.dice[1] + modifier
  const seq = (state.diceRoll?.seq ?? 0) + 1
  // Consomme les jetons « Salut, Oogie ! » (appliqués à ce lancer).
  let next = updatePlayer({ ...state, rngState: r.rngState }, idx, (p) => ({ ...p, helloOogieTokens: 0 }))
  const canReroll = !controlled && (next.players[idx].hand ?? []).some((c) => c.cardId === 'des-pipes')
  next = {
    ...next,
    diceRoll: { seq, dice: r.dice, total, modifier, by: idx, context, cardId },
    pendingDice: { playerIndex: idx, dice: r.dice, modifier, total, context, cardId, outcome, canReroll, chooseDice: controlled },
  }
  const modStr = modifier !== 0 ? ` (${modifier > 0 ? '+' : ''}${modifier})` : ''
  return {
    ...next,
    log: [...next.log, `${p0.villainName} lance les dés — ${context} : ${r.dice[0]} + ${r.dice[1]}${modStr} = **${total}**.`],
  }
}

/** Pat Hibulaire — déplace les Alliés « followsHeroes » (Grillon) du royaume de
 *  `playerIndex` vers `locationId` (lieu du Héros qui vient d'arriver), avec leurs
 *  Objets associés. « Vous pouvez » résolu automatiquement (toujours bénéfique). */
function moveFollowersToHero(state: GameState, playerIndex: number, locationId: LocationId): GameState {
  let next = state
  const name = state.players[playerIndex].villainName
  for (const l of state.players[playerIndex].locations) {
    if (l.id === locationId) continue
    const followers = (next.players[playerIndex].board[l.id] ?? []).filter(
      (c) => c.type === 'ally' && c.followsHeroes,
    )
    for (const f of followers) {
      const here = next.players[playerIndex].board[l.id] ?? []
      const ids = new Set([
        f.instanceId,
        ...here.filter((c) => c.attachedTo === f.instanceId).map((c) => c.instanceId),
      ])
      const moving = here.filter((c) => ids.has(c.instanceId))
      next = updatePlayer(next, playerIndex, (pl) => ({
        ...pl,
        board: {
          ...pl.board,
          [l.id]: (pl.board[l.id] ?? []).filter((c) => !ids.has(c.instanceId)),
          [locationId]: [...(pl.board[locationId] ?? []), ...moving],
        },
      }))
      next = {
        ...next,
        log: [...next.log, `${name} déplace **${f.name}** vers ${findLocation(next.players[playerIndex], locationId)?.name ?? locationId} (suit le Héros).`],
      }
    }
  }
  return next
}

/**
 * Déclenche les effets « à l'arrivée d'un Héros » sur un lieu d'un joueur :
 * pour chaque Mandat d'Arrêt présent au lieu, +2 JT au propriétaire (C.1).
 * Appelé après chaque pose de Héros (Fatalité, Belle Marianne, Emprisonnement…).
 * Défausse aussi les Malédictions à déclencheur 'hero-played-here'.
 */
export function triggerHeroArrival(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
): GameState {
  const owner = state.players[playerIndex]
  let next = state
  const mandates = (owner.board[locationId] ?? []).filter((c) => c.cardId === 'mandat-arret')
  if (mandates.length > 0) {
    // Robin des Bois : « chaque carte rapporte 1 Pouvoir de moins » → −1 PAR Mandat
    // (chaque Mandat est une carte), plancher 0 par carte.
    const penalty = realmPowerPenalty(state, playerIndex)
    const gain = mandates.length * Math.max(0, 2 - penalty)
    if (gain > 0) {
      next = updatePlayer(next, playerIndex, (p) => ({ ...p, power: p.power + gain }))
      next = {
        ...next,
        log: [
          ...next.log,
          `${owner.villainName} : Mandat d'Arrêt déclenché (×${mandates.length}) → +${gain} JT${penalty ? ' (Robin des Bois : −1/carte)' : ''}.`,
        ],
      }
    }
    // Robin des Bois : animation « −N 🪙 » du pouvoir chipé (−1 par Mandat).
    next = pushRobinSteal(next, playerIndex, mandates.length * penalty)
  }
  // Pat Hibulaire — Grillon : tout Allié « followsHeroes » du royaume suit le Héros
  // qui vient d'arriver (déplacé auto sur son lieu, avec ses Objets associés).
  next = moveFollowersToHero(next, playerIndex, locationId)
  return processCurseDiscards(next, playerIndex, locationId, 'hero-played-here')
}

/** Défausse automatiquement les cartes de `playerIndex` au lieu `locationId`
 *  dont `discardWhen` correspond au `trigger` donné (Malédictions Maléfique). */
export function processCurseDiscards(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
  trigger: CurseDiscardTrigger['type'],
): GameState {
  const cell = state.players[playerIndex].board[locationId] ?? []
  const toDiscard = cell.filter((c) => c.discardWhen?.type === trigger)
  if (toDiscard.length === 0) return state
  const ids = new Set(toDiscard.map((c) => c.instanceId))
  let next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    board: { ...p.board, [locationId]: (p.board[locationId] ?? []).filter((c) => !ids.has(c.instanceId)) },
    discard: [...p.discard, ...toDiscard],
  }))
  next = {
    ...next,
    log: [
      ...next.log,
      ...toDiscard.map((c) => `**${c.name}** se défausse (déclencheur : ${trigger}).`),
    ],
  }
  // Showcase de la Malédiction retirée — toujours montré. Le déclencheur
  // 'hero-played-here' est DÉJÀ couvert par le diff de la pose de Héros
  // (placeFateHeroWithEffects) → on ne le repousse pas ici (sinon doublon).
  if (trigger !== 'hero-played-here') {
    next = pushDiscardShowcase(
      next,
      toDiscard.map((c) => c.cardId),
      toDiscard.length > 1
        ? `${toDiscard.length} Malédictions se défaussent`
        : `${toDiscard[0].name} se défausse`,
      playerIndex,
      'red',
      'bottom',
    )
  }
  return next
}

/** Met à jour une CardInstance posée dans le royaume d'un joueur. */
function patchCard(
  state: GameState,
  playerIndex: number,
  instanceId: string,
  patch: (c: CardInstance) => CardInstance,
): GameState {
  return updatePlayer(state, playerIndex, (p) => ({
    ...p,
    board: Object.fromEntries(
      Object.entries(p.board).map(([locId, cards]) => [
        locId,
        cards.map((c) => (c.instanceId === instanceId ? patch(c) : c)),
      ]),
    ),
  }))
}

/**
 * Cœur du Vanquish (Éliminer un Héros). Utilisé par l'action VANQUISH (alliés
 * défaussés) ET par la carte Intimidation (alliés gardés en jeu). Aucune
 * vérification d'action ; c'est l'appelant qui s'en charge.
 */
/** Mère Gothel — lieu où se trouve Raiponce (Héros-tuile), ou null si absente. */
export function raiponceLocation(p: PlayerState): string | null {
  for (const loc of p.locations) {
    if ((p.board[loc.id] ?? []).some((c) => c.cardId === 'raiponce')) return loc.id
  }
  return null
}

/** Mère Gothel — déplace Raiponce (et ses Objets associés) vers `toLoc`. Pur. No-op
 *  si elle est absente ou déjà sur place. Partagé par MOVE_RAIPONCE et la dérive de
 *  fin de tour. */
export function relocateRaiponce(state: GameState, idx: number, toLoc: string): GameState {
  const p = state.players[idx]
  const from = raiponceLocation(p)
  if (!from || from === toLoc) return state
  const tile = (p.board[from] ?? []).find((c) => c.cardId === 'raiponce')!
  const moveIds = new Set<string>([tile.instanceId])
  for (const c of p.board[from] ?? []) if (c.attachedTo === tile.instanceId) moveIds.add(c.instanceId)
  const moving = (p.board[from] ?? []).filter((c) => moveIds.has(c.instanceId))
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: {
      ...pl.board,
      [from]: (pl.board[from] ?? []).filter((c) => !moveIds.has(c.instanceId)),
      [toLoc]: [...(pl.board[toLoc] ?? []), ...moving],
    },
  }))
  const toName = p.locations.find((l) => l.id === toLoc)?.name ?? toLoc
  const moved = { ...next, log: [...next.log, `Raiponce se déplace vers **${toName}**.`] }
  // Pascal (Fatalité) : si Raiponce arrive sur le lieu de Pascal, elle file aussitôt
  // d'un lieu vers Corona (un seul rebond : la destination n'a pas Pascal).
  const pascalHere = (moved.players[idx].board[toLoc] ?? []).some((c) => c.type === 'hero' && c.cardId === 'pascal')
  if (pascalHere) {
    const order = moved.players[idx].locations.map((l) => l.id)
    const nextLoc = order[Math.min(order.length - 1, order.indexOf(toLoc) + 1)]
    if (nextLoc !== toLoc) {
      return relocateRaiponce(
        { ...moved, log: [...moved.log, 'Pascal repère Raiponce : elle file d’un lieu vers Corona.'] },
        idx,
        nextLoc,
      )
    }
  }
  return moved
}

// ---------------------------------------------------------------------------
// Cruella d'Enfer — helpers Tuiles Chiots.
// ---------------------------------------------------------------------------

/** Un Héros de `cardId` est-il présent sur `locationId` du royaume de `p` ? */
function heroPresent(p: PlayerState, locationId: string, cardId: string): boolean {
  return (p.board[locationId] ?? []).some((c) => c.type === 'hero' && c.cardId === cardId)
}

const locName = (p: PlayerState, id: string) => p.locations.find((l) => l.id === id)?.name ?? id

/** Disperse `cards` (Alliés ou Héros du royaume `idx`) à travers `destLocs` en
 *  round-robin, chaque carte emmenant ses Objets associés. Une carte déjà sur sa
 *  destination ne bouge pas. Utilisé par les Fatalités de Gaston (la Bête, Mrs Samovar). */
function scatterCards(state: GameState, idx: number, cards: CardInstance[], destLocs: LocationId[]): GameState {
  let next = state
  cards.forEach((c, k) => {
    const from = locationOfCard(next.players[idx], c.instanceId)
    if (!from) return
    // Destination toujours DIFFÉRENTE du lieu courant (dispersion réelle).
    const dests = destLocs.filter((d) => d !== from)
    if (dests.length === 0) return
    const dest = dests[k % dests.length]
    const cell = next.players[idx].board[from] ?? []
    const movingIds = new Set([c.instanceId, ...cell.filter((x) => x.attachedTo === c.instanceId).map((x) => x.instanceId)])
    const moving = cell.filter((x) => movingIds.has(x.instanceId))
    next = updatePlayer(next, idx, (p) => ({
      ...p,
      board: {
        ...p.board,
        [from]: (p.board[from] ?? []).filter((x) => !movingIds.has(x.instanceId)),
        [dest]: [...(p.board[dest] ?? []), ...moving],
      },
    }))
  })
  return next
}

// --- Gaston : jetons Obstacle -----------------------------------------------
const OBSTACLE_CAP = 2

/** Modifie de `delta` le compteur d'Obstacles du lieu `locId` (borné 0..cap). */
function setObstacle(state: GameState, idx: number, locId: string, delta: number): GameState {
  return updatePlayer(state, idx, (p) => {
    const cur = p.obstacles?.[locId] ?? 0
    const next = Math.max(0, Math.min(OBSTACLE_CAP, cur + delta))
    return { ...p, obstacles: { ...(p.obstacles ?? {}), [locId]: next } }
  })
}

/** Ordre de RETRAIT auto : d'abord les lieux qu'on ne peut PAS vider en vainquant un
 *  Héros (Taverne, Bois), puis Maison de Belle / Château de la Bête (que Maurice / la
 *  Bête peuvent vider d'un coup au Vanquish — on les garde donc en réserve). */
function obstacleRemovalOrder(p: PlayerState): string[] {
  const pref = ['taverne', 'bois', 'maison-belle', 'chateau-bete']
  const all = p.locations.map((l) => l.id)
  const order = [...pref.filter((id) => all.includes(id)), ...all.filter((id) => !pref.includes(id))]
  return order.filter((id) => (p.obstacles?.[id] ?? 0) > 0)
}

/** Gaston — retire AUTO jusqu'à `max` Obstacles. `sameLocation` : tous depuis un seul
 *  lieu (celui qui en porte le plus). No-op si Belle bloque le retrait ou rien à
 *  retirer. Renvoie l'état et le nombre retiré (heuristique : cf. obstacleRemovalOrder). */
function autoRemoveObstacles(
  state: GameState,
  idx: number,
  max: number,
  sameLocation: boolean,
): { state: GameState; removed: number } {
  const p = state.players[idx]
  if (belleBlocksRemoval(p)) return { state, removed: 0 }
  let next = state
  let removed = 0
  if (sameLocation) {
    // Lieu retenu = celui qui porte le plus d'Obstacles (parmi l'ordre de préférence).
    const loc = obstacleRemovalOrder(p).sort(
      (a, b) => (p.obstacles?.[b] ?? 0) - (p.obstacles?.[a] ?? 0),
    )[0]
    if (!loc) return { state, removed: 0 }
    while (removed < max && (next.players[idx].obstacles?.[loc] ?? 0) > 0) {
      next = setObstacle(next, idx, loc, -1)
      removed++
    }
    return { state: next, removed }
  }
  while (removed < max) {
    const loc = obstacleRemovalOrder(next.players[idx])[0]
    if (!loc) break
    next = setObstacle(next, idx, loc, -1)
    removed++
  }
  return { state: next, removed }
}

/** Gaston (adversaire) — replace AUTO des Obstacles (borné 2/lieu, total 8). `mode` :
 *  'free' (lieux les plus vides d'abord, pour disperser) ; 'each-location' (jusqu'à 1
 *  sur chaque lieu non plein) ; 'fill-location' (remplit à 2 le lieu le plus vide).
 *  Renvoie l'état et le nombre ajouté. */
function autoReplaceObstacles(
  state: GameState,
  idx: number,
  count: number,
  mode: 'free' | 'each-location' | 'fill-location',
): { state: GameState; added: number } {
  let next = state
  let added = 0
  const notFull = () =>
    next.players[idx].locations
      .map((l) => l.id)
      .filter((id) => (next.players[idx].obstacles?.[id] ?? 0) < OBSTACLE_CAP)
  if (mode === 'each-location') {
    for (const id of notFull()) {
      next = setObstacle(next, idx, id, +1)
      added++
    }
    return { state: next, added }
  }
  if (mode === 'fill-location') {
    const loc = notFull().sort(
      (a, b) => (next.players[idx].obstacles?.[a] ?? 0) - (next.players[idx].obstacles?.[b] ?? 0),
    )[0]
    if (loc === undefined) return { state, added: 0 }
    while ((next.players[idx].obstacles?.[loc] ?? 0) < OBSTACLE_CAP) {
      next = setObstacle(next, idx, loc, +1)
      added++
    }
    return { state: next, added }
  }
  // 'free' : ajoute sur le lieu le plus vide, un par un (dispersion maximale).
  while (added < count) {
    const loc = notFull().sort(
      (a, b) => (next.players[idx].obstacles?.[a] ?? 0) - (next.players[idx].obstacles?.[b] ?? 0),
    )[0]
    if (loc === undefined) break
    next = setObstacle(next, idx, loc, +1)
    added++
  }
  return { state: next, added }
}

// --- Le Seigneur des clés : clés + dé ---------------------------------------
const KEY_LABEL: Record<KeyColor, string> = { bleu: 'bleue', rouge: 'rouge', vert: 'verte', jaune: 'jaune', violet: 'violette', orange: 'orange' }

/** Lance le dé de couleur (déterministe via le PRNG). */
export function rollColorDie(rngState: number): { color: KeyColor; rngState: number } {
  const r = nextRandom(rngState)
  return { color: KEY_COLORS[Math.floor(r.value * KEY_COLORS.length)] ?? 'bleu', rngState: r.state }
}

/** Remplace les clés du joueur `idx`. */
function withKeys(state: GameState, idx: number, keys: GameState['players'][number]['keys']): GameState {
  return updatePlayer(state, idx, (p) => ({ ...p, keys }))
}

// ── Madame Mim — Métamorphoses ────────────────────────────────────────────────
/** Lieu du Duel (où trônent les Métamorphoses de Merlin) = 3ᵉ lieu. */
function duelLocId(p: PlayerState): LocationId {
  return p.locations[2]?.id ?? p.locations[0].id
}
/** Localise une Métamorphose de Merlin en jeu (cherche son lieu). */
function findMerlinInRealm(p: PlayerState, instanceId?: string): { loc: LocationId; card: CardInstance } | null {
  for (const l of p.locations) {
    const f = (p.board[l.id] ?? []).find((c) => c.isMerlinTransformation && (!instanceId || c.instanceId === instanceId))
    if (f) return { loc: l.id, card: f }
  }
  return null
}
/** Pose la prochaine Métamorphose de Merlin (dessus de merlinDeck) au Lieu du Duel. */
function placeNextMerlin(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  if ((p.merlinDeck?.length ?? 0) === 0) return state
  const loc = duelLocId(p)
  return updatePlayer(state, idx, (pl) => {
    const [m, ...rest] = pl.merlinDeck ?? []
    return { ...pl, merlinDeck: rest, board: { ...pl.board, [loc]: [...(pl.board[loc] ?? []), m] } }
  })
}
/** Vainc (par effet, pas par Vanquish) une Métamorphose de Merlin en jeu : elle va
 *  dans merlinDiscard et est remplacée au Lieu du Duel. */
function defeatMerlinByEffect(state: GameState, idx: number, instanceId?: string): GameState {
  const found = findMerlinInRealm(state.players[idx], instanceId)
  if (!found) return { ...state, log: [...state.log, `${state.players[idx].villainName} : aucune Métamorphose de Merlin à vaincre.`] }
  let next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: { ...pl.board, [found.loc]: (pl.board[found.loc] ?? []).filter((c) => c.instanceId !== found.card.instanceId) },
    merlinDiscard: [...(pl.merlinDiscard ?? []), found.card],
  }))
  next = { ...next, log: [...next.log, `${state.players[idx].villainName} vainc **${found.card.name}** !`] }
  // On ne pioche une nouvelle Métamorphose de Merlin au Lieu du Duel QUE s'il n'en reste
  // plus aucune en jeu (sinon, on continue avec celles déjà présentes).
  return findMerlinInRealm(next.players[idx]) ? next : placeNextMerlin(next, idx)
}

// ── Nous avons conclu un marché ! (Le Seigneur des Ténèbres) ──────────────────
/** Le Seigneur des Ténèbres — Les Sorcières de Morva : tant qu'elles sont dans le
 *  royaume, il ne peut pas s'emparer du Chaudron Magique (elles le détiennent). */
export function cauldronClaimBlocked(p: PlayerState): boolean {
  return Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'witches-of-morva')
}

/** Option B disponible : l'Épée Magique (dyrnwyn) est dans le royaume, le joueur peut
 *  payer `power` Pouvoir, et le Chaudron est encore « à s'emparer ». */
export function bargainCanSword(p: PlayerState, power: number): boolean {
  const hasSword = Object.values(p.board).flat().some((c) => c.cardId === 'dyrnwyn')
  return hasSword && p.power >= power && p.blackCauldron === 'set-aside'
}
/** Option A : mélange la défausse Vilain du joueur `idx` dans sa pioche Vilain. */
export function bargainReshuffle(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  if (p.discard.length === 0) return state
  const r = shuffle([...p.deck, ...p.discard], state.rngState)
  const next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({ ...pl, deck: r.result, discard: [] }))
  return { ...next, log: [...next.log, `${p.villainName} mélange sa défausse dans sa pioche Vilain.`] }
}
/** Option B : paie `power` Pouvoir, défausse l'Épée Magique (→ défausse Fatalité) et
 *  s'empare du Chaudron Magique. */
export function bargainSword(state: GameState, idx: number, power: number): GameState {
  const p = state.players[idx]
  let loc: LocationId | undefined
  let sword: CardInstance | undefined
  for (const l of p.locations) {
    const found = (p.board[l.id] ?? []).find((c) => c.cardId === 'dyrnwyn')
    if (found) { loc = l.id; sword = found; break }
  }
  if (!sword || !loc) return resolveEffect(state, { type: 'CLAIM_BLACK_CAULDRON' }, { actorIndex: idx })
  let next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    power: Math.max(0, pl.power - power),
    board: { ...pl.board, [loc!]: (pl.board[loc!] ?? []).filter((c) => c.instanceId !== sword!.instanceId) },
    fateDiscard: [...pl.fateDiscard, sword!],
  }))
  next = { ...next, log: [...next.log, `${p.villainName} paie ${power} Pouvoir et défausse l'Épée Magique pour s'emparer du Chaudron Magique.`] }
  return resolveEffect(next, { type: 'CLAIM_BLACK_CAULDRON' }, { actorIndex: idx })
}

/** Pioche `n` cartes Méchant pour `idx` (remélange la défausse au besoin). */
function drawNCards(state: GameState, idx: number, n: number): GameState {
  const p = state.players[idx]
  let deck = p.deck
  let discard = p.discard
  let hand = p.hand
  let s = state.rngState
  let drew = 0
  while (drew < n) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      const r = shuffle(discard, s); deck = r.result; s = r.state; discard = []
    }
    const [top, ...rest] = deck
    deck = rest; hand = [...hand, top]; drew++
  }
  // Conditions piochées pendant le tour d'un ADVERSAIRE (réaction) : on les estampille
  // avec l'instantané des compteurs du tour, pour qu'elles ne réagissent qu'aux
  // événements survenus APRÈS la pioche (cf. conditionIsTriggered).
  if (drew > 0 && idx !== state.activePlayer) {
    const baseline = {
      gainedPower: state.activeGainedPower ?? 0,
      discarded: state.activeDiscardedCount ?? 0,
      playedCards: state.activePlayedCount ?? 0,
      playedItems: state.activePlayedItemCount ?? 0,
      playedAllies: state.activePlayedAllyCount ?? 0,
    }
    const start = hand.length - drew
    hand = hand.map((c, i) =>
      i >= start && c.type === 'condition' && !c.conditionBaseline ? { ...c, conditionBaseline: baseline } : c,
    )
  }
  const next = updatePlayer({ ...state, rngState: s }, idx, (pl) => ({ ...pl, deck, discard, hand }))
  return drew > 0 ? { ...next, activeDrewCard: true } : next
}

// ── Tamatoa — pioche MAUI + Objets-objectif ─────────────────────────────────
/** Localise un Héros par cardId dans le royaume de `idx`. */
function tamatoaFindHero(p: PlayerState, cardId: string): { loc: LocationId; card: CardInstance } | undefined {
  for (const loc of p.locations) {
    const card = (p.board[loc.id] ?? []).find((c) => c.type === 'hero' && c.cardId === cardId)
    if (card) return { loc: loc.id, card }
  }
  return undefined
}

/** Maui (Héros) est-il dans le royaume de `idx` ? */
export function mauiHeroInRealm(p: PlayerState): boolean {
  return Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'maui')
}

/** Dévoile et joue la 1ʳᵉ carte de la pioche MAUI (remélange la défausse Maui si la
 *  pioche est vide). Résout ses effets (Heihei Maui en enchaîne 2 autres). */
export function playTopMauiCard(state: GameState, idx: number): GameState {
  let p = state.players[idx]
  if ((p.mauiDeck ?? []).length === 0) {
    const disc = p.mauiDiscard ?? []
    if (disc.length === 0) return state
    const r = shuffle(disc, state.rngState)
    state = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({ ...pl, mauiDeck: r.result, mauiDiscard: [] }))
    p = state.players[idx]
  }
  const [top, ...rest] = p.mauiDeck ?? []
  if (!top) return state
  let next = updatePlayer(state, idx, (pl) => ({ ...pl, mauiDeck: rest, mauiDiscard: [...(pl.mauiDiscard ?? []), top] }))
  next = { ...next, log: [...next.log, `Pioche Maui : **${top.name}** est dévoilée et jouée.`] }
  return resolveEffects(next, top.effects ?? [], { actorIndex: idx })
}

/** Cherche un exemplaire de `cardId` (Héros/Objet) dans les zones de `idx` (royaume,
 *  main, pioches, défausses, pioche Maui) et le retire de sa zone. Renvoie la carte +
 *  l'état mis à jour, ou null si introuvable. Le placement est fait par l'appelant. */
function fetchCardForTamatoa(state: GameState, idx: number, cardId: string): { state: GameState; card: CardInstance } | null {
  const p = state.players[idx]
  // Déjà en jeu (non associé) → on le RETIRE de sa case (l'appelant le repose).
  for (const loc of p.locations) {
    const found = (p.board[loc.id] ?? []).find((c) => c.cardId === cardId && !c.attachedTo)
    if (found) {
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board: { ...pl.board, [loc.id]: (pl.board[loc.id] ?? []).filter((c) => c.instanceId !== found.instanceId) } }))
      return { state: next, card: found }
    }
  }
  const zones: (keyof PlayerState)[] = ['hand', 'deck', 'discard', 'fateDeck', 'fateDiscard']
  for (const z of zones) {
    const arr = p[z] as CardInstance[] | undefined
    const found = arr?.find((c) => c.cardId === cardId)
    if (found) {
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, [z]: (pl[z] as CardInstance[]).filter((c) => c.instanceId !== found.instanceId) }))
      return { state: next, card: found }
    }
  }
  return null
}

/** Ajoute la Tuile Chiots `tileId` (de la réserve) sur son lieu indiqué. Si Anita
 *  et Roger gardent ce lieu, la tuile retourne dans la réserve (face visible). */
export function addPuppyFromReserve(state: GameState, idx: number, tileId: string): GameState {
  const p = state.players[idx]
  const tile = (p.puppyTiles ?? []).find((t) => t.id === tileId && t.state === 'reserve')
  if (!tile) return state
  const home = tile.homeLocation
  const bounced = heroPresent(p, home, 'anita-et-roger')
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    puppyTiles: (pl.puppyTiles ?? []).map((t) =>
      t.id === tileId
        ? bounced
          ? { ...t, state: 'reserve' as const, revealed: true, location: home }
          : { ...t, state: 'board' as const, revealed: true, location: home }
        : t,
    ),
  }))
  const msg = bounced
    ? `Anita et Roger renvoient une Tuile Chiots (${tile.value}) dans la réserve.`
    : `${p.villainName} amène une Tuile Chiots (${tile.value}) sur **${locName(p, home)}**.`
  return { ...next, log: [...next.log, msg] }
}

/** Capture les Tuiles Chiots `tileIds` (passe leur état à `captured`). Pur. */
export function doCapturePuppies(state: GameState, idx: number, tileIds: string[]): GameState {
  const ids = new Set(tileIds)
  if (ids.size === 0) return state
  const p = state.players[idx]
  const gained = (p.puppyTiles ?? []).filter((t) => ids.has(t.id)).reduce((n, t) => n + t.value, 0)
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    puppyTiles: (pl.puppyTiles ?? []).map((t) => (ids.has(t.id) ? { ...t, state: 'captured' as const } : t)),
  }))
  const total = (next.players[idx].puppyTiles ?? []).filter((t) => t.state === 'captured').reduce((n, t) => n + t.value, 0)
  return {
    ...next,
    log: [...next.log, `${p.villainName} capture ${ids.size} Tuile(s) Chiots (+${gained} Chiots, total ${total}).`],
  }
}

/** Capture jusqu'à `max` Tuiles Chiots posées sur `locationId`. Bloqué si Pongo garde
 *  ce lieu. S'il y a plus de tuiles que `max`, le joueur CHOISIT lesquelles capturer
 *  (pendingPuppyCapture) ; sinon on capture toutes celles présentes. */
export function capturePuppiesAt(state: GameState, idx: number, locationId: string, max: number): GameState {
  const p = state.players[idx]
  if (heroPresent(p, locationId, 'pongo')) {
    return { ...state, log: [...state.log, `Pongo empêche toute capture sur **${locName(p, locationId)}**.`] }
  }
  const onLoc = (p.puppyTiles ?? []).filter((t) => t.state === 'board' && t.location === locationId)
  if (onLoc.length === 0) {
    return { ...state, log: [...state.log, `${p.villainName} : aucune Tuile Chiots à capturer sur **${locName(p, locationId)}**.`] }
  }
  // Assez de place pour toutes → capture directe ; sinon, choix interactif.
  if (onLoc.length <= max) {
    return doCapturePuppies(state, idx, onLoc.map((t) => t.id))
  }
  return {
    ...state,
    pendingPuppyCapture: { playerIndex: idx, locationId, remaining: max },
    log: [...state.log, `${p.villainName} : choisissez ${max} Tuile(s) Chiots à capturer sur **${locName(p, locationId)}**.`],
  }
}

// --- Cruella d'Enfer — Quels idiots ! (déplacer un Allié OU en chercher un) -------

/** Alliés du royaume déplaçables sur le lieu du pion (= pas déjà sur ce lieu). */
export function quelsMoveCandidates(p: PlayerState): CardInstance[] {
  const here = p.pawnLocation
  if (!here) return []
  return p.locations
    .filter((l) => l.id !== here)
    .flatMap((l) => (p.board[l.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket))
}

/** Alliés présents dans la pioche OU la défausse (Quels idiots ! — chercher). */
export function quelsTutorCandidates(p: PlayerState): CardInstance[] {
  return [...p.deck, ...p.discard].filter((c) => c.type === 'ally')
}

/** Déplace l'Allié `allyId` (+ ses Objets associés) sur le lieu du pion. */
export function doQuelsMove(state: GameState, idx: number, allyId: string): GameState {
  const p = state.players[idx]
  const here = p.pawnLocation
  if (!here) return state
  const from = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.instanceId === allyId))?.id
  if (!from || from === here) return state
  const moving = (p.board[from] ?? []).filter((c) => c.instanceId === allyId || c.attachedTo === allyId)
  const ids = new Set(moving.map((c) => c.instanceId))
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: {
      ...pl.board,
      [from]: (pl.board[from] ?? []).filter((c) => !ids.has(c.instanceId)),
      [here]: [...(pl.board[here] ?? []), ...moving],
    },
  }))
  const name = moving.find((c) => c.instanceId === allyId)?.name ?? 'Allié'
  return { ...next, log: [...next.log, `${p.villainName} déplace **${name}** sur **${locName(p, here)}** (Quels idiots !).`] }
}

/** Cherche l'Allié `allyId` (pioche/défausse) → main, puis remélange la pioche. */
export function doQuelsTutor(state: GameState, idx: number, allyId: string): GameState {
  const p = state.players[idx]
  const chosen = [...p.deck, ...p.discard].find((c) => c.instanceId === allyId && c.type === 'ally')
  if (!chosen) return state
  let next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    deck: pl.deck.filter((c) => c.instanceId !== allyId),
    discard: pl.discard.filter((c) => c.instanceId !== allyId),
    hand: [...pl.hand, chosen],
  }))
  const r = shuffle(next.players[idx].deck, next.rngState)
  next = updatePlayer({ ...next, rngState: r.state }, idx, (pl) => ({ ...pl, deck: r.result }))
  return { ...next, log: [...next.log, `${p.villainName} récupère **${chosen.name}** (Quels idiots !) et remélange sa pioche.`] }
}

/** Ouvre la sélection « déplacer un Allié » (auto si un seul candidat). */
export function enterQuelsMove(state: GameState, idx: number): GameState {
  const cands = quelsMoveCandidates(state.players[idx])
  if (cands.length === 1) return doQuelsMove(state, idx, cands[0].instanceId)
  return { ...state, pendingQuelsIdiots: { playerIndex: idx, phase: 'move', candidateIds: cands.map((c) => c.instanceId) } }
}

/** Ouvre la sélection « chercher un Allié » (auto si un seul candidat). */
export function enterQuelsTutor(state: GameState, idx: number): GameState {
  const cands = quelsTutorCandidates(state.players[idx])
  if (cands.length === 1) return doQuelsTutor(state, idx, cands[0].instanceId)
  return { ...state, pendingQuelsIdiots: { playerIndex: idx, phase: 'tutor', candidateIds: cands.map((c) => c.instanceId) } }
}

/** Shere Khan — élimination GRATUITE d'un Héros (Lancé sur ses traces) : pas d'Alliés
 *  requis. Baloo protège (jeton Pouvoir à la place, défaussé à son seuil). Si le Héros
 *  éliminé est la cible de l'objectif et qu'aucun jeton Feu n'est présent → VICTOIRE. */
export function freeEliminateHero(state: GameState, idx: number, heroInstanceId: string): GameState {
  const p = state.players[idx]
  const hero = Object.values(p.board).flat().find((c) => c.instanceId === heroInstanceId)
  if (!hero || hero.type !== 'hero') return state
  const baloo = Object.values(p.board).flat().find((c) => c.type === 'hero' && c.shieldsOtherHeroesUntilTokens !== undefined)
  if (baloo && baloo.instanceId !== heroInstanceId) {
    const cap = baloo.shieldsOtherHeroesUntilTokens!
    const tokens = (baloo.protectionTokens ?? 0) + 1
    if (tokens >= cap) {
      const bl = locationOfCard(p, baloo.instanceId)!
      const nx = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [bl]: (pl.board[bl] ?? []).filter((c) => c.instanceId !== baloo.instanceId) },
        fateDiscard: [...pl.fateDiscard, { ...baloo, protectionTokens: undefined }],
      }))
      return { ...nx, log: [...nx.log, `**Baloo** atteint ${cap} jetons et est défaussé (${hero.name} protégé).`] }
    }
    return { ...patchCard(state, idx, baloo.instanceId, (c) => ({ ...c, protectionTokens: tokens })), log: [...state.log, `**Baloo** protège ${hero.name} (${tokens}/${cap}).`] }
  }
  const loc = locationOfCard(p, heroInstanceId)!
  const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === heroInstanceId)
  const removed = new Set([heroInstanceId, ...attached.map((c) => c.instanceId)])
  let next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: { ...pl.board, [loc]: (pl.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
    fateDiscard: [...pl.fateDiscard, { ...hero, permanentStrengthDelta: undefined }, ...attached.map((c) => ({ ...c, attachedTo: undefined }))],
  }))
  next = { ...next, log: [...next.log, `${p.villainName} élimine **${hero.name}** (Lancé sur ses traces).`] }
  if (p.objective.type === 'DEFEAT_HERO_NO_FIRE' && hero.cardId === p.objective.heroCardId && shereKhanNoFire(next.players[idx])) {
    return { ...next, status: 'WON', winner: idx, log: [...next.log, `🏆 ${p.villainName} élimine ${hero.name} sans aucun jeton Feu — victoire !`] }
  }
  return next
}

export function performVanquish(
  state: GameState,
  heroInstanceId: string,
  allyInstanceIds: string[],
  keepAllies: boolean,
  /** Shere Khan — Kaa : `string` = instanceId de l'Objet sacrifié à la place de Kaa
   *  (Kaa survit) ; `null` = pas de bouclier (Kaa défaussé) ; `undefined` = auto (bot :
   *  sacrifie le 1ᵉʳ Objet bouclier). */
  kaaShield?: string | null,
): GameState {
  // Un Héros de force EFFECTIVE 0 (réduit par Forme de grenouille, Sommeil sans
  // Rêves…) peut être éliminé SANS Allié (la somme des forces alliées, 0, suffit).
  // On ne refuse donc l'absence d'Allié qu'après avoir mesuré la force du Héros.
  const me = activePlayer(state)
  const heroLoc = locationOfCard(me, heroInstanceId)
  if (!heroLoc) {
    throw new Error(`Héros « ${heroInstanceId} » introuvable dans votre royaume.`)
  }
  const heroCard = (me.board[heroLoc] ?? []).find((c) => c.instanceId === heroInstanceId)!
  if (heroCard.type !== 'hero') {
    throw new Error(`${heroCard.name} n'est pas un Héros.`)
  }
  // Oogie Boogie — le Prisonnier (Perce-Oreilles) n'est pas un Héros vaincable : il
  // n'est retiré que par l'objectif (4 Imposteurs → retour de Jack).
  if (heroCard.isPrisoner) {
    throw new Error(`${heroCard.name} (Prisonnier) ne peut pas être éliminé.`)
  }
  const heroLocName = findLocation(me, heroLoc)?.name ?? heroLoc
  const hasDeguisement = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'deguisement' && c.attachedTo === heroCard.instanceId,
  )
  if (hasDeguisement) {
    throw new Error(`${heroCard.name} est invulnérable (Déguisement). Défaussez-le d'abord (2 JT).`)
  }
  // Tamatoa — Quelque chose qui brille : les Héros de son lieu ne peuvent pas être éliminés.
  if ((me.board[heroLoc] ?? []).some((c) => c.shieldsHeroesAtLocation && !c.attachedTo)) {
    throw new Error(`${heroCard.name} est protégé par « Quelque chose qui brille » sur ${heroLocName}.`)
  }
  // Shere Khan — Baloo : tant qu'il est dans le royaume, aucun AUTRE Héros ne peut être
  // éliminé. Chaque tentative pose un jeton Pouvoir sur Baloo (à la place) ; à son seuil,
  // Baloo (et ses jetons) est défaussé. Le Héros visé survit (les Alliés ne sont pas
  // consommés). Protège donc Mowgli jusqu'à ce que Baloo soit retiré.
  const baloo = Object.values(me.board).flat().find(
    (c) => c.type === 'hero' && c.shieldsOtherHeroesUntilTokens !== undefined,
  )
  if (baloo && baloo.instanceId !== heroCard.instanceId) {
    const cap = baloo.shieldsOtherHeroesUntilTokens!
    const tokens = (baloo.protectionTokens ?? 0) + 1
    if (tokens >= cap) {
      const balooLoc = locationOfCard(me, baloo.instanceId)!
      const next = updateActivePlayer(state, (p) => ({
        ...p,
        board: { ...p.board, [balooLoc]: (p.board[balooLoc] ?? []).filter((c) => c.instanceId !== baloo.instanceId) },
        fateDiscard: [...p.fateDiscard, { ...baloo, protectionTokens: undefined }],
      }))
      return { ...next, log: [...next.log, `**Baloo** atteint ${cap} jetons Pouvoir : il est défaussé. (${heroCard.name} était protégé.)`] }
    }
    const next = patchCard(state, state.activePlayer, baloo.instanceId, (c) => ({ ...c, protectionTokens: tokens }))
    return { ...next, log: [...next.log, `**Baloo** protège ${heroCard.name} : un jeton Pouvoir est placé sur Baloo (${tokens}/${cap}).`] }
  }
  const adjacents = new Set(adjacentLocationIds(state, heroLoc))
  const allies: CardInstance[] = []
  for (const allyId of allyInstanceIds) {
    const allyLoc = locationOfCard(me, allyId)
    if (!allyLoc) throw new Error(`Allié « ${allyId} » introuvable.`)
    const a = (me.board[allyLoc] ?? []).find((c) => c.instanceId === allyId)!
    if (a.type !== 'ally') throw new Error(`${a.name} n'est pas un Allié.`)
    if (a.isWicket) throw new Error(`${a.name} est un arceau : inutilisable pour éliminer un Héros.`)
    if (a.trapped) throw new Error(`${a.name} est entravé : il ne peut pas participer à un Vanquish.`)
    // Archers Loups (Prince Jean), Flibustiers (Crochet) et Cerbère (Hadès)
    // éliminent aussi un Héros sur un lieu VOISIN non bloqué (donnée
    // `reachesAdjacentVanquish` ; cardId conservés pour compat héritée).
    const reachesAdjacent = a.reachesAdjacentVanquish || a.cardId === 'archers-loups' || a.cardId === 'flibustiers'
    // Persian (reachesAnyLocationVanquish) : utilisable depuis n'importe quel lieu.
    if (!a.reachesAnyLocationVanquish && allyLoc !== heroLoc && !(reachesAdjacent && adjacents.has(allyLoc))) {
      throw new Error(`${a.name} doit être sur ${heroLocName}${reachesAdjacent ? ' ou un lieu voisin' : ''}.`)
    }
    allies.push(a)
  }
  if (heroCard.cardId === 'bobby' && allies.some((a) => a.cardId === 'archers-loups')) {
    throw new Error("Bobby ne peut pas être éliminé par des Archers Loups.")
  }
  // Gardes du Château : minimum 2 Alliés requis pour les éliminer.
  if (heroCard.cardId === 'gardes-chateau' && allies.length < 2) {
    throw new Error("Pour éliminer les Gardes du Château, il faut au moins 2 Alliés.")
  }
  // Enfants Perdus (Crochet) : minimum 2 Alliés requis pour les éliminer.
  if (heroCard.cardId === 'enfants-perdus' && allies.length < 2) {
    throw new Error("Pour éliminer les Enfants Perdus, il faut au moins 2 Alliés.")
  }
  // Madame Mim — une Métamorphose de Merlin ne peut être vaincue QUE par la/les
  // Métamorphose(s) Mim qui la ciblent (`transformationTarget`). Tous les Alliés
  // engagés doivent donc être des Métamorphoses Mim visant CE Merlin.
  if (heroCard.isMerlinTransformation) {
    if (allies.length === 0 || !allies.every((a) => a.transformationTarget === heroCard.cardId)) {
      throw new Error(`${heroCard.name} ne peut être vaincu que par sa Métamorphose Mim correspondante.`)
    }
  }
  // Provocation (Crochet) : s'il existe un Héros « provocateur » (portant une
  // Provocation) dans le royaume, il faut l'éliminer avant les autres Héros.
  const targetHasTaunt = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'provocation' && c.attachedTo === heroCard.instanceId,
  )
  const aTaunterExists = Object.values(me.board)
    .flat()
    .some((c) => c.cardId === 'provocation' && c.attachedTo)
  if (aTaunterExists && !targetHasTaunt) {
    throw new Error('Vous devez d’abord éliminer un Héros provocateur (Provocation).')
  }
  // Héros prioritaire (Prof / Citoyens d'Halloween / Polnareff–Silver Chariot…) : doit être
  // éliminé AVANT les autres (donnée `mustDefeatFirst`).
  const priorityHero = Object.values(me.board).flat().find((c) => c.type === 'hero' && c.mustDefeatFirst)
  if (priorityHero && !heroCard.mustDefeatFirst) {
    throw new Error(`Vous devez d’abord éliminer ${priorityHero.name} (priorité).`)
  }
  // Yzma — règles de Fatalité spécifiques (gardées sur le vilain Yzma) :
  if (me.villain === 'yzma') {
    // Bucky : Kronk ne peut pas l'éliminer.
    if (heroCard.cardId === 'bucky' && allies.some((a) => a.cardId === 'kronk')) {
      throw new Error('Kronk ne peut pas être utilisé pour éliminer Bucky.')
    }
    // Chaca / Tipo : tant que l'un d'eux est présent, Yzma ne peut éliminer d'autres Héros.
    const blockers = Object.values(me.board)
      .flat()
      .some((c) => c.type === 'hero' && (c.cardId === 'chaca' || c.cardId === 'tipo'))
    if (blockers && heroCard.cardId !== 'chaca' && heroCard.cardId !== 'tipo') {
      throw new Error('Tant que Tipo ou Chaca sont présents, Yzma ne peut pas éliminer d’autres Héros.')
    }
  }
  // Lotso — protections : Buzz l'Éclair (Gardien) protège son lieu ; Rex protégé avec un
  // autre Héros ; Bayonne/Hamm exige ≥2 Alliés ; Buzz démo exige un autre Allié.
  {
    if (heroCard.isBuzz) throw new Error('Buzz l’Éclair ne peut pas être éliminé.')
    if ((me.board[heroLoc] ?? []).some((c) => c.isBuzz && c.buzzMode === 'guardian')) {
      throw new Error('Buzz l’Éclair (Gardien) protège ce lieu : ce Héros ne peut pas être éliminé.')
    }
    const hStr = effectiveStrength(state, state.activePlayer, heroCard.instanceId) ?? 0
    if (
      heroCard.protectedWithOtherHero &&
      hStr > 0 &&
      (me.board[heroLoc] ?? []).some((c) => c.type === 'hero' && c.instanceId !== heroCard.instanceId)
    ) {
      throw new Error(`${heroCard.name} est protégé tant qu'il partage son lieu avec un autre Héros.`)
    }
    if (heroCard.minAlliesToVanquish && hStr > 0 && allies.length < heroCard.minAlliesToVanquish) {
      throw new Error(`Il faut au moins ${heroCard.minAlliesToVanquish} Alliés pour éliminer ${heroCard.name}.`)
    }
    if (allies.some((a) => a.isBuzz && a.buzzMode === 'demo') && allies.length < 2) {
      throw new Error('Buzz en mode démo ne peut éliminer un Héros que si un autre Allié participe aussi.')
    }
  }
  const heroForce = effectiveStrength(state, state.activePlayer, heroCard.instanceId) ?? 0
  const allyForce = allies.reduce(
    (sum, a) => sum + (effectiveStrength(state, state.activePlayer, a.instanceId) ?? 0),
    0,
  )
  // Madame Mim — une Métamorphose de Merlin se vainc avec la BONNE Métamorphose Mim,
  // SANS comparaison de force (la correspondance suffit ; cf. garde-fou plus haut).
  // Les autres Héros : au moins un Allié tant que la force du Héros > 0, et force des
  // Alliés ≥ force du Héros.
  if (!heroCard.isMerlinTransformation) {
    if (allies.length === 0 && heroForce > 0) {
      throw new Error('Sélectionnez au moins un Allié pour éliminer ce Héros.')
    }
    if (allyForce < heroForce) {
      throw new Error(`Force insuffisante (${allyForce} < ${heroForce}).`)
    }
  }
  // Lotso — Vanquish SPÉCIAL : le Héros n'est PAS défaussé. Sa force est réduite à 0
  // (jetons −1) et il RESTE où il est ; si BUZZ EN MODE DÉMO participe, le Héros rejoint
  // la Salle des Chenilles. Les Alliés utilisés sont défaussés — SAUF Buzz démo (jamais
  // défaussé). Retour anticipé (chemin de défaite distinct du Vanquish standard).
  if (me.objective.type === 'LOTSO_GATHER') {
    const idx = state.activePlayer
    const roomId = me.objective.roomId
    const demoBuzz = allies.find((a) => a.isBuzz && a.buzzMode === 'demo')
    const destLoc = demoBuzz ? roomId : heroLoc
    const discardAllies = allies.filter((a) => !a.isBuzz) // Buzz démo n'est pas défaussé
    const discardIds = new Set<string>(discardAllies.map((a) => a.instanceId))
    const attachedToDiscarded = Object.values(me.board).flat().filter((c) => c.attachedTo && discardIds.has(c.attachedTo))
    attachedToDiscarded.forEach((c) => discardIds.add(c.instanceId))
    const discardedCards = [...discardAllies, ...attachedToDiscarded].map((c) => ({ ...c, attachedTo: undefined }))
    // Réduit le Héros à 0 (delta = −sa force effective actuelle) ; il reste en jeu.
    const reduced: CardInstance = {
      ...heroCard,
      permanentStrengthDelta: (heroCard.permanentStrengthDelta ?? 0) - heroForce,
    }
    let next = updateActivePlayer(state, (p) => {
      const board: typeof p.board = {}
      for (const [lid, cards] of Object.entries(p.board)) {
        let cell = cards.filter((c) => !discardIds.has(c.instanceId) && c.instanceId !== heroCard.instanceId)
        if (lid === destLoc) cell = [...cell, reduced]
        board[lid] = cell
      }
      return { ...p, board, discard: [...p.discard, ...discardedCards] }
    })
    next = { ...next, lastVanquishedHeroStrength: heroCard.strength ?? 0 }
    next = pushDiscardShowcase(
      next,
      [heroCard.cardId, ...discardedCards.map((c) => c.cardId)],
      `${me.villainName} neutralise ${heroCard.name}`,
      idx,
      'red',
      'bottom',
    )
    return {
      ...next,
      log: [
        ...next.log,
        `${me.villainName} neutralise **${heroCard.name}** : sa force tombe à 0${demoBuzz ? ' et il rejoint la Salle des Chenilles' : ''} (il reste en jeu).`,
      ],
    }
  }
  // Scar — Bâton de Rafiki : si le Héros visé porte le Bâton, il est défaussé À LA
  // PLACE du Héros, qui survit (les Alliés engagés sont conservés).
  const baton = (me.board[heroLoc] ?? []).find(
    (c) => c.cardId === 'baton-rafiki' && c.attachedTo === heroCard.instanceId,
  )
  if (baton) {
    const saved = updateActivePlayer(state, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? []).filter((c) => c.instanceId !== baton.instanceId),
      },
      fateDiscard: [...p.fateDiscard, { ...baton, attachedTo: undefined }],
    }))
    return {
      ...saved,
      log: [...saved.log, `Bâton de Rafiki protège **${heroCard.name}** : le Bâton est défaussé à sa place.`],
    }
  }
  // Syndrome — Champ de Force : Objet « bouclier » associé au Héros. S'il devrait être
  // éliminé, l'Objet est défaussé À SA PLACE (Fatalité) et le Héros survit.
  const shield = (me.board[heroLoc] ?? []).find(
    (c) => c.shieldHeroFromVanquish && c.attachedTo === heroCard.instanceId,
  )
  if (shield) {
    const saved = updateActivePlayer(state, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? []).filter((c) => c.instanceId !== shield.instanceId),
      },
      fateDiscard: [...p.fateDiscard, { ...shield, attachedTo: undefined }],
    }))
    return {
      ...saved,
      log: [...saved.log, `**${shield.name}** protège **${heroCard.name}** : il est défaussé à sa place.`],
    }
  }
  const usedAllyIds = new Set(allies.map((a) => a.instanceId))
  const attachedToAllies = Object.values(me.board)
    .flat()
    .filter((c) => c.attachedTo && usedAllyIds.has(c.attachedTo))
  const flechesCount = attachedToAllies.filter((c) => c.cardId === 'fleche-or').length
  // Bonus Rouet (Maléfique) : +hero.strength − 1 JT par Rouet sur le lieu du héros.
  const rouetCount = (me.board[heroLoc] ?? []).filter((c) => c.cardId === 'rouet').length
  const rouetBonus = rouetCount * Math.max(0, (heroCard.strength ?? 0) - 1)
  const locked = heroCard.lockedPower ?? 0
  // Cartes côté Vilain effectivement défaussées (Alliés + Objets). Règle Arc et
  // Flèches : si un Allié utilisé porte ≥1 Arc et Flèches, on défausse TOUS les
  // Arcs À LA PLACE de l'Allié — l'Allié (et ses autres Objets, ex. Flèche d'Or)
  // RESTE en jeu. Sinon l'Allié et tous ses Objets associés sont défaussés.
  // Team Rocket — POKÉMON : on ne le défausse PAS quand il est vaincu. Il est COUCHÉ
  // (K.O., `pokemonKO`) et RESTE sur son lieu ; on l'attrape ensuite (action Attraper /
  // rose de James) → pile de Captures. Non attrapé à la fin du tour SUIVANT, il part en
  // défausse Fatalité (cf. sweepKoPokemon, appelé en fin de tour).
  const tiltPokemon = !!heroCard.isPokemon
  const removedIds = new Set<string>(tiltPokemon ? [] : [heroCard.instanceId])
  const discardedAllyCards: CardInstance[] = []
  // Hadès — Hydre : utilisée pour un Vanquish, elle retourne en MAIN au lieu d'être
  // défaussée (ses Objets associés partent quand même en défausse). On la retire du
  // plateau mais on la garde de côté pour la remettre en main.
  const returnedToHand: CardInstance[] = []
  // Le Seigneur des Ténèbres — Crapaud : au lieu d'être défaussé, il est déplacé sur le
  // lieu du pion.
  const relocatedToPawn: CardInstance[] = []
  // Sa Sucrerie — Cybug en Sucre : au lieu d'être défaussé, il RESTE en jeu, gagne +N
  // Force (cumulatif) et sera déplacé sur un lieu au choix (pendingAllyRelocate restreint).
  const cybugSurvivors: { id: string; gain: number }[] = []
  // Hadès — Potion de mortalité : si le Héros vaincu porte une Potion associée, les
  // Titans utilisés pour l'éliminer NE sont PAS défaussés (ils restent en jeu).
  const heroHasPotion = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'potion-mortalite' && c.attachedTo === heroCard.instanceId,
  )
  // Gaston — Lefou : un Vanquish sur SON lieu ne défausse pas les Alliés utilisés ;
  // ils retournent en MAIN (on réutilise le chemin returnToHand de l'Hydre).
  const lefouHere = (me.board[heroLoc] ?? []).some(
    (c) => c.type === 'ally' && c.keepAlliesOnVanquishHere,
  )
  if (!keepAllies) {
    for (const a of allies) {
      // Syndrome — l'Omnidroïde n'est jamais « défaussé » : sa transition (retrait
      // v.X8/v.X9 ou maintien v.10) est gérée après le Vanquish (cf. bloc Omnidroïde).
      if (a.isOmnidroid) continue
      // Dio — The World : indéfaussable. Utilisé pour un Vanquish, il RESTE en jeu
      // (il suit le pion) au lieu d'être défaussé comme un Allié normal.
      if (a.cannotBeDiscarded) continue
      if (a.isTitan && heroHasPotion) continue // Titan préservé par la Potion
      // Yzma — Kronk n'est PAS défaussé quand il sert à éliminer un Héros : il reste
      // sur le lieu (avec ses Objets associés, ex. Couteau).
      if (me.villain === 'yzma' && a.cardId === 'kronk') continue
      // Davy Jones — Le Kraken n'est pas défaussé s'il élimine un Héros à Trésor RÉVÉLÉ.
      if (a.survivesVanquishWithRevealedTreasure && heroCard.treasure?.faceUp) continue
      // Davy Jones — Le Second Maccus : on défausse un AUTRE Allié du royaume à sa place
      // (v1 auto : le plus faible des autres Alliés non engagés). Maccus survit.
      if (a.survivesVanquishByDiscardingAlly) {
        const substitute = Object.values(me.board)
          .flat()
          .filter((c) => c.type === 'ally' && c.instanceId !== a.instanceId && !removedIds.has(c.instanceId) && !usedAllyIds.has(c.instanceId) && !c.attachedTo)
          .sort((x, y) => (x.strength ?? 0) - (y.strength ?? 0))[0]
        if (substitute) {
          removedIds.add(substitute.instanceId)
          discardedAllyCards.push({ ...substitute, stars: undefined })
          for (const o of Object.values(me.board).flat().filter((o) => o.attachedTo === substitute.instanceId)) {
            removedIds.add(o.instanceId)
            discardedAllyCards.push(o)
          }
          continue // Maccus survit
        }
        // Aucun substitut : Maccus est défaussé normalement (suite de la boucle).
      }
      // Sa Sucrerie — Cybug en Sucre : pas défaussé ; reste en jeu, gagnera +N Force et
      // sera déplacé au choix après le Vanquish (cf. bloc cybugSurvivors plus bas).
      if (a.survivesVanquishGain !== undefined) {
        cybugSurvivors.push({ id: a.instanceId, gain: a.survivesVanquishGain })
        continue
      }
      const attached = attachedToAllies.filter((o) => o.attachedTo === a.instanceId)
      // Shere Khan — Kaa : si Kaa devrait être défaussé, le joueur a choisi (kaaShield)
      // soit de sacrifier UN Objet associé à sa place (Kaa survit), soit de laisser Kaa
      // être défaussé (`null`). Bot/auto (undefined) : sacrifie le 1ᵉʳ Objet bouclier.
      if (a.cardId === 'kaa') {
        const shieldItems = attached.filter((o) => o.shieldAllyFromDiscard)
        const chosenId =
          kaaShield === null ? undefined
          : typeof kaaShield === 'string' ? kaaShield
          : shieldItems[0]?.instanceId
        if (chosenId && shieldItems.some((s) => s.instanceId === chosenId)) {
          const item = attached.find((o) => o.instanceId === chosenId)!
          removedIds.add(item.instanceId)
          discardedAllyCards.push(item)
        } else {
          // Kaa défaussé avec tous ses Objets associés.
          removedIds.add(a.instanceId)
          discardedAllyCards.push({ ...a, stars: undefined })
          for (const o of attached) { removedIds.add(o.instanceId); discardedAllyCards.push(o) }
        }
        continue
      }
      // Objets « bouclier » : défaussés À LA PLACE de l'Allié, qui survit (Arc et
      // Flèches : flèches consommées ; Cruella — Tisonnier : shieldAllyFromDiscard).
      const arcs = attached.filter((o) => o.cardId === 'arc-fleches' || o.shieldAllyFromDiscard)
      if (arcs.length > 0) {
        for (const arc of arcs) {
          removedIds.add(arc.instanceId)
          discardedAllyCards.push(arc)
        }
      } else {
        removedIds.add(a.instanceId)
        // Bowser : une Étoile portée par l'Allié est perdue quand il quitte le jeu
        // (défaussé OU repris en main) — on réinitialise toujours son compteur.
        if (a.relocateToPawnOnVanquish && me.pawnLocation) {
          // Crapaud : déplacé sur le lieu du pion au lieu d'être défaussé.
          relocatedToPawn.push({ ...a, attachedTo: undefined, stars: undefined })
        } else if (a.returnToHandOnVanquish || lefouHere) {
          returnedToHand.push({ ...a, attachedTo: undefined, stars: undefined })
        } else {
          discardedAllyCards.push({ ...a, stars: undefined })
        }
        for (const o of attached) {
          removedIds.add(o.instanceId)
          // Yzma — Couteau : revient dans la main quand son Allié est défaussé.
          if (o.cardId === 'couteau') {
            returnedToHand.push({ ...o, attachedTo: undefined })
          } else {
            discardedAllyCards.push(o)
          }
        }
      }
    }
  }
  // Hadès — Nessus : +2 JT si le Héros vaincu a une force ≤ 3 et que Nessus
  // participe au Vanquish.
  const nessusBonus = allies.some((a) => a.cardId === 'nessus') && (heroCard.strength ?? 0) <= 3 ? 2 : 0
  // Scar — Banzaï : s'il RESTE sur le lieu du Héros vaincu, +1 JT par autre Hyène
  // défaussée depuis ce lieu lors de ce Vanquish (Alliés dépensés).
  const banzaiHere = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'banzai' && !removedIds.has(c.instanceId),
  )
  const banzaiBonus = banzaiHere
    ? discardedAllyCards.filter((c) => c.isHyena && c.cardId !== 'banzai').length
    : 0
  // Yzma — Kronk éliminé alors qu'il est devenu un Héros (transformé à 3+ jetons) :
  // il rejoint la défausse MÉCHANT (c'est une carte du deck Vilain) et redevient un
  // Allié normal (jetons et transformation réinitialisés), pas la défausse Fatalité.
  const kronkToVillain = me.villain === 'yzma' && heroCard.cardId === 'kronk'
  const heroDiscarded: CardInstance = kronkToVillain
    ? { ...heroCard, lockedPower: undefined, type: 'ally', kronkPower: undefined, kronkTransformed: undefined }
    : { ...heroCard, lockedPower: undefined }
  // Yzma — objectif : Kronk élimine Kuzco → drapeau de victoire posé.
  const kronkAteKuzco =
    me.villain === 'yzma' && heroCard.cardId === 'kuzco' && allies.some((a) => a.cardId === 'kronk')
  // Ratigan — objectif côté « Le Rat » : éliminer Basil → drapeau de victoire posé.
  const ratiganBeatBasil =
    me.villain === 'ratigan' && me.becameTheRat === true && heroCard.cardId === 'basil'
  // Scar — pile SUCCESSION : Mufasa éliminé y est placé ; tant qu'il y est, les
  // Héros éliminés ensuite y vont aussi (au lieu de la défausse Fatalité).
  const mufasaInPile = (me.succession ?? []).some((c) => c.cardId === 'mufasa')
  const toSuccession =
    me.succession !== undefined && (heroCard.cardId === 'mufasa' || mufasaInPile)
  // Mère Gothel — Raiponce n'est JAMAIS défaussée : éliminée, elle revient sur la
  // Tour (héros toujours présent dans le royaume). On la retire de son lieu puis on
  // la repose sur 'tour', sans la mettre en défausse Fatalité.
  const raiponceReturns = heroCard.cardId === 'raiponce'
  // Madame Mim — Métamorphose de Merlin vaincue : elle va dans `merlinDiscard` (objectif),
  // pas dans la défausse Fatalité, et sera remplacée au Lieu du Duel (cf. plus bas).
  const merlinDefeated = !!heroCard.isMerlinTransformation
  // Dio — Jotaro / Joseph RETIRÉS DU JEU : ils ne vont pas en défausse Fatalité mais dans
  // `removedFromGame` (objectif + déblocage du doublement de Pouvoir de The World).
  const removedFromGameNow = !!heroCard.removedFromGameOnDefeat
  // Mère Gothel — Poignard : si l'Allié qui élimine Raiponce porte un Poignard,
  // Gothel gagne 1 jeton Confiance.
  const poignardKillsRaiponce =
    raiponceReturns && attachedToAllies.some((c) => c.cardId === 'poignard')
  // Mère Gothel — Vengeance : ce Vanquish rapporte 1 Confiance si le Héros éliminé
  // n'est PAS Raiponce. Le drapeau est consommé par ce Vanquish.
  const vengeanceConfiance = !!me.vengeanceConfianceArmed && !raiponceReturns
  // Mère Gothel — Couronne : si un Héros est éliminé sur le lieu d'une Couronne,
  // Gothel gagne 2 Confiance (par Couronne présente sur ce lieu).
  const couronneConfiance =
    (me.board[heroLoc] ?? []).filter((c) => c.cardId === 'couronne-gothel').length * 2
  // Mère Gothel — Flynn Rider vaincu : rend les jetons Confiance qu'il détenait.
  const flynnConfiance = heroCard.cardId === 'flynn-rider' ? heroCard.heldConfiance ?? 0 : 0
  const confGain =
    (poignardKillsRaiponce ? 1 : 0) + (vengeanceConfiance ? 1 : 0) + couronneConfiance + flynnConfiance
  let next = updateActivePlayer(state, (p) => ({
    ...p,
    board: Object.fromEntries(
      Object.entries(p.board).map(([locId, cards]) => [
        locId,
        locId === 'tour' && raiponceReturns
          ? [...cards.filter((c) => !removedIds.has(c.instanceId)), { ...heroCard, lockedPower: undefined, attachedTo: undefined }]
          : locId === p.pawnLocation && relocatedToPawn.length > 0
            ? [...cards.filter((c) => !removedIds.has(c.instanceId)), ...relocatedToPawn]
            // Team Rocket — Pokémon vaincu : il RESTE couché (K.O.) sur son lieu, mais
            // les Alliés/Objets dépensés (dans removedIds) doivent quand même quitter le
            // plateau (sinon ils restent visibles ET se retrouvent en double en défausse).
            : tiltPokemon
              ? cards
                  .filter((c) => !removedIds.has(c.instanceId))
                  .map((c) => (c.instanceId === heroCard.instanceId ? { ...c, pokemonKO: true, koOnTurn: state.turn } : c))
              : cards.filter((c) => !removedIds.has(c.instanceId)),
      ]),
    ),
    fateDiscard:
      raiponceReturns || toSuccession || kronkToVillain || merlinDefeated || removedFromGameNow || tiltPokemon
        ? p.fateDiscard
        : [...p.fateDiscard, heroDiscarded],
    removedFromGame: removedFromGameNow ? [...(p.removedFromGame ?? []), heroCard.cardId] : p.removedFromGame,
    merlinDiscard: merlinDefeated ? [...(p.merlinDiscard ?? []), heroDiscarded] : p.merlinDiscard,
    succession: toSuccession ? [...(p.succession ?? []), heroDiscarded] : p.succession,
    discard: [
      ...(keepAllies ? p.discard : [...p.discard, ...discardedAllyCards]),
      ...(kronkToVillain ? [heroDiscarded] : []),
    ],
    hand: [...p.hand, ...returnedToHand],
    power: p.power + locked + flechesCount * 2 + rouetBonus + nessusBonus + banzaiBonus,
    confiance: confGain > 0 ? (p.confiance ?? 0) + confGain : p.confiance,
    vengeanceConfianceArmed: p.vengeanceConfianceArmed ? false : p.vengeanceConfianceArmed,
    objectiveHeroDefeated: kronkAteKuzco || ratiganBeatBasil ? true : p.objectiveHeroDefeated,
  }))
  if (poignardKillsRaiponce) {
    next = {
      ...next,
      log: [...next.log, `Poignard : ${me.villainName} gagne 1 Confiance (Raiponce éliminée).`],
    }
  }
  if (vengeanceConfiance) {
    next = {
      ...next,
      log: [...next.log, `Vengeance : ${me.villainName} gagne 1 Confiance (Héros éliminé).`],
    }
  }
  if (couronneConfiance > 0) {
    next = {
      ...next,
      log: [...next.log, `Couronne : ${me.villainName} gagne ${couronneConfiance} Confiance (Héros éliminé sur son lieu).`],
    }
  }
  if (banzaiBonus > 0) {
    next = {
      ...next,
      log: [...next.log, `Banzaï : +${banzaiBonus} JT (Hyènes défaussées depuis son lieu).`],
    }
  }
  if (toSuccession) {
    next = {
      ...next,
      log: [...next.log, `**${heroCard.name}** rejoint la pile Succession.`],
    }
  }
  // Dr Facilier — Objets associés au Héros vaincu : le Talisman est RÉCUPÉRÉ
  // (libéré sur le lieu du Héros, donc « détenu » à nouveau) ; la Forme de
  // grenouille est défaussée. (Les Objets associés au Héros ne sont pas dans
  // removedIds : ils restent sur le lieu après le départ du Héros.)
  const heroAttached = (me.board[heroLoc] ?? []).filter((c) => c.attachedTo === heroCard.instanceId)
  const formes = heroAttached.filter((c) => c.cardId === 'forme-grenouille')
  const hasTalisman = heroAttached.some((c) => c.cardId === 'talisman')
  if (hasTalisman || formes.length > 0) {
    const formeIds = new Set(formes.map((c) => c.instanceId))
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? [])
          .filter((c) => !formeIds.has(c.instanceId))
          .map((c) =>
            c.cardId === 'talisman' && c.attachedTo === heroCard.instanceId ? { ...c, attachedTo: undefined } : c,
          ),
      },
      discard: [...p.discard, ...formes.map((c) => ({ ...c, attachedTo: undefined }))],
    }))
    if (hasTalisman) {
      next = { ...next, log: [...next.log, `Le **Talisman** est récupéré sur ${heroLocName}.`] }
    }
  }
  // Syndrome — Télécommande « volée » par ce Héros : à sa mort, elle est LIBÉRÉE (rendue
  // à Syndrome, non associée, sur le lieu) et redevient utilisable.
  if (heroAttached.some((c) => c.cardId === 'telecommande-de-syndrome')) {
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? []).map((c) =>
          c.cardId === 'telecommande-de-syndrome' && c.attachedTo === heroCard.instanceId ? { ...c, attachedTo: undefined } : c,
        ),
      },
    }))
    next = { ...next, log: [...next.log, `La **Télécommande de Syndrome** est récupérée sur ${heroLocName}.`] }
  }
  // Tamatoa — Objets-objectif (Hameçon de Maui / Cœur de Te Fiti) « volés » par ce Héros
  // (Maui / Moana) : à sa mort, ils sont LIBÉRÉS (non associés) sur le lieu, donc à nouveau
  // « détenus » par Tamatoa et déplaçables vers le Repaire.
  if (heroAttached.some((c) => c.cardId === 'hamecon-de-maui' || c.cardId === 'coeur-de-te-fiti')) {
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? []).map((c) =>
          (c.cardId === 'hamecon-de-maui' || c.cardId === 'coeur-de-te-fiti') && c.attachedTo === heroCard.instanceId
            ? { ...c, attachedTo: undefined }
            : c,
        ),
      },
    }))
    next = { ...next, log: [...next.log, `${me.villainName} récupère son Objet sur ${heroLocName}.`] }
  }
  // Davy Jones — Le Black Pearl : à la mort de son Héros hôte, il SE RÉASSOCIE à un autre
  // Héros présent sur ce lieu (s'il y en a un) ; sinon il part en défausse Fatalité.
  const blackPearls = heroAttached.filter((c) => c.reattachOnHostDefeat)
  if (blackPearls.length > 0) {
    const bpIds = new Set(blackPearls.map((c) => c.instanceId))
    const otherHero = (next.players[state.activePlayer].board[heroLoc] ?? []).find(
      (c) => c.type === 'hero' && c.instanceId !== heroCard.instanceId,
    )
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? [])
          .filter((c) => !(bpIds.has(c.instanceId) && !otherHero)) // retiré du plateau si pas de nouvel hôte
          .map((c) => (bpIds.has(c.instanceId) ? { ...c, attachedTo: otherHero!.instanceId } : c)),
      },
      fateDiscard: otherHero ? p.fateDiscard : [...p.fateDiscard, ...blackPearls.map((c) => ({ ...c, attachedTo: undefined }))],
    }))
    next = {
      ...next,
      log: [
        ...next.log,
        otherHero
          ? `**Le Black Pearl** se réassocie à **${otherHero.name}**.`
          : `**Le Black Pearl** part en défausse Fatalité (aucun autre Héros sur ${heroLocName}).`,
      ],
    }
  }
  // Dio — Stand associé au Héros vaincu : il ne va JAMAIS en défausse. Il retourne dans
  // `standPile` (réserve hors deck), prêt à être ré-invoqué si la carte hôte revient.
  const heroStands = heroAttached.filter((c) => c.isStand)
  if (heroStands.length > 0) {
    const standIds = new Set(heroStands.map((c) => c.instanceId))
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: { ...p.board, [heroLoc]: (p.board[heroLoc] ?? []).filter((c) => !standIds.has(c.instanceId)) },
      standPile: [...(p.standPile ?? []), ...heroStands.map((c) => ({ ...c, attachedTo: undefined }))],
    }))
    next = { ...next, log: [...next.log, `Le Stand de **${heroCard.name}** se dissipe (retour à la réserve de Dio).`] }
  }
  // Dio — Jotaro / Joseph retirés du jeu : trace au journal (ils débloquent The World).
  if (removedFromGameNow) {
    next = { ...next, log: [...next.log, `**${heroCard.name}** est RETIRÉ DE LA PARTIE.`] }
  }
  // Mémorise la force du héros pour le trigger Méchanceté (réinitialisé à chaque tour).
  next = { ...next, lastVanquishedHeroStrength: heroCard.strength ?? 0 }
  next = {
    ...next,
    log: [
      ...next.log,
      tiltPokemon
        ? `${me.villainName} met **${heroCard.name}** K.O. (couché) — attrapez-le avant la fin du prochain tour ! (alliés : ${allies.map((a) => a.name).join(', ')})`
        : `${me.villainName} élimine **${heroCard.name}** (alliés : ${allies.map((a) => a.name).join(', ')})${keepAllies ? ' — Intimidation, alliés gardés.' : '.'}`,
      ...(locked > 0
        ? [`${locked} JT verrouillé${locked > 1 ? 's' : ''} restitué${locked > 1 ? 's' : ''} à ${me.villainName}.`]
        : []),
      ...(flechesCount > 0
        ? [`Flèche d'Or : +${flechesCount * 2} JT à ${me.villainName}.`]
        : []),
      ...(rouetBonus > 0
        ? [`Rouet : +${rouetBonus} JT à ${me.villainName}.`]
        : []),
      ...(nessusBonus > 0
        ? [`Nessus : +${nessusBonus} JT à ${me.villainName}.`]
        : []),
      ...(returnedToHand.length > 0
        ? [`**${returnedToHand.map((c) => c.name).join(', ')}** retourne${returnedToHand.length > 1 ? 'nt' : ''} en main (Hydre).`]
        : []),
      ...(raiponceReturns ? ['**Raiponce** n’est pas défaussée : elle revient sur la Tour.'] : []),
    ],
  }
  // Showcase « Vanquish » : Héros vaincu + Alliés utilisés + leurs Objets associés
  // (Arc et Flèches, Flèche d'Or) — défaussés, sauf Intimidation qui garde les
  // Alliés. Affiche aussi le gain de combat (« +N 🪙 » : Flèche d'Or +2, Rouet,
  // JT verrouillés rendus).
  const vanquishGain = locked + flechesCount * 2 + rouetBonus + nessusBonus
  // Cartes montrées = Héros vaincu + ce qui part réellement en défausse côté Vilain
  // (Arc et Flèches à la place de l'Allié, ou Allié + Objets).
  const showcaseCardIds = [heroCard.cardId, ...discardedAllyCards.map((c) => c.cardId)]
  next = pushDiscardShowcase(
    next,
    showcaseCardIds,
    tiltPokemon ? `${me.villainName} met ${heroCard.name} K.O.` : `${me.villainName} élimine ${heroCard.name}`,
    state.activePlayer,
    tiltPokemon ? 'dark' : 'red',
    'bottom',
    vanquishGain > 0 ? { gainedPower: vanquishGain } : undefined,
  )
  const obj = me.objective
  // Davy Jones : RÉCUPÉRER le jeton Trésor RÉVÉLÉ porté par le Héros vaincu (un Trésor face
  // CACHÉE retourne dans la réserve). Victoire à `count` (5) Trésors récupérés.
  if (isDavyJones(me) && heroCard.treasure) {
    if (heroCard.treasure.faceUp) {
      const tid = heroCard.treasure.id
      next = updatePlayer(next, state.activePlayer, (p) => ({ ...p, claimedTreasures: [...(p.claimedTreasures ?? []), tid] }))
      next = { ...next, log: [...next.log, `${me.villainName} récupère **${TREASURE_NAMES[tid] ?? tid}** ! (${(next.players[state.activePlayer].claimedTreasures ?? []).length}/${obj.type === 'CLAIM_ALL_TREASURES' ? obj.count : 5})`] }
      // Le Cœur : à la récupération, perd tout son Pouvoir.
      if (tid === 'le-coeur') {
        next = updatePlayer(next, state.activePlayer, (p) => ({ ...p, power: 0 }))
        next = { ...next, log: [...next.log, `**Le Cœur** : ${me.villainName} perd tous ses jetons Pouvoir.`] }
      }
      const claimed = (next.players[state.activePlayer].claimedTreasures ?? []).length
      const target = obj.type === 'CLAIM_ALL_TREASURES' ? obj.count : 5
      if (claimed >= target) {
        return { ...next, status: 'WON', winner: state.activePlayer, log: [...next.log, `🏆 ${me.villainName} récupère ses ${target} Trésors — victoire !`] }
      }
    } else {
      // Trésor FACE CACHÉE (non révélé) : il n'est PAS récupéré — il retourne dans la
      // réserve des Trésors à récupérer (et pourra être reposé plus tard).
      const tid = heroCard.treasure.id
      next = updatePlayer(next, state.activePlayer, (p) => ({ ...p, treasureReserve: [...(p.treasureReserve ?? []), tid] }))
      next = { ...next, log: [...next.log, `Trésor non révélé : il n'est pas récupéré et retourne dans la réserve.`] }
    }
  }
  // Davy Jones — Hadras : s'il a été défaussé lors de ce Vanquish (utilisé pour vaincre,
  // ou sacrifié comme substitut du Second Maccus), il révèle un jeton Trésor face cachée.
  next = triggerRevealOnAllyDiscard(next, state.activePlayer, discardedAllyCards)
  // Capitaine Crochet : victoire ÉVÉNEMENTIELLE — éliminer Peter Pan sur le
  // Jolly Roger (et nulle part ailleurs).
  if (
    obj.type === 'DEFEAT_HERO_AT_LOCATION' &&
    heroCard.cardId === obj.heroCardId &&
    heroLoc === obj.locationId
  ) {
    return {
      ...next,
      status: 'WON',
      winner: state.activePlayer,
      log: [...next.log, `🏆 ${me.villainName} élimine ${heroCard.name} sur le Jolly Roger et l'emporte !`],
    }
  }
  // Shere Khan : victoire ÉVÉNEMENTIELLE — vaincre Mowgli alors qu'aucun jeton Feu n'est
  // présent dans le royaume (l'état `fireTokens` mesuré APRÈS l'élimination).
  if (
    obj.type === 'DEFEAT_HERO_NO_FIRE' &&
    heroCard.cardId === obj.heroCardId &&
    shereKhanNoFire(next.players[state.activePlayer])
  ) {
    return {
      ...next,
      status: 'WON',
      winner: state.activePlayer,
      log: [...next.log, `🏆 ${me.villainName} élimine ${heroCard.name} sans aucun jeton Feu — victoire !`],
    }
  }
  // Yzma : victoire ÉVÉNEMENTIELLE — Kronk élimine Kuzco.
  if (kronkAteKuzco) {
    return {
      ...next,
      status: 'WON',
      winner: state.activePlayer,
      log: [...next.log, `🏆 ${me.villainName} : Kronk élimine Kuzco — victoire !`],
    }
  }
  // Dr Facilier — Poudre d'illusion : à chaque Héros éliminé sur ce lieu, défausse
  // jusqu'à 2 cartes de la Pile de l'Au-delà (auto : les moins utiles, jamais Régner).
  if ((next.players[state.activePlayer].board[heroLoc] ?? []).some((c) => c.cardId === 'poudre-illusion')) {
    const pile = next.players[state.activePlayer].auDela
    const droppable = [...pile]
      .filter((c) => c.cardId !== 'regner-nouvelle-orleans')
      .sort((a, b) => auDelaKeyPriority(a) - auDelaKeyPriority(b))
      .slice(0, 2)
    if (droppable.length > 0) {
      const dropIds = new Set(droppable.map((c) => c.instanceId))
      next = updateActivePlayer(next, (p) => ({
        ...p,
        auDela: p.auDela.filter((c) => !dropIds.has(c.instanceId)),
        discard: [...p.discard, ...droppable],
      }))
      next = {
        ...next,
        log: [...next.log, `Poudre d'illusion : ${droppable.length} carte${droppable.length > 1 ? 's' : ''} défaussée${droppable.length > 1 ? 's' : ''} de la Pile de l'Au-delà.`],
      }
    }
  }
  // Oogie Boogie — déclencheurs de participation au Vanquish (Alliés déjà défaussés
  // à ce stade si keepAllies = false) :
  //  - Araignées : +1 Pouvoir et +1 carte par Araignée engagée.
  //  - Chauves-souris : récupèrent un Allié de la défausse en main (auto : le plus
  //    fort — l'interactivité fine est différée).
  {
    const spiders = allies.filter((a) => a.cardId === 'araignees').length
    if (spiders > 0) {
      next = resolveEffects(
        next,
        [{ type: 'GAIN_POWER', amount: spiders }, { type: 'DRAW_CARDS', count: spiders }],
        { actorIndex: state.activePlayer },
      )
    }
    if (!keepAllies && allies.some((a) => a.cardId === 'chauves-souris')) {
      const ap = state.activePlayer
      const pool = next.players[ap].discard.filter((c) => c.type === 'ally' && c.cardId !== 'chauves-souris')
      const best = [...pool].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        ?? [...next.players[ap].discard.filter((c) => c.type === 'ally')].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
      if (best) {
        next = updatePlayer(next, ap, (pp) => ({
          ...pp,
          discard: pp.discard.filter((c) => c.instanceId !== best.instanceId),
          hand: [...pp.hand, best],
        }))
        next = { ...next, log: [...next.log, `Chauves-souris : **${best.name}** récupéré de la défausse.`] }
      }
    }
  }
  // Madame Mim — un Merlin vaincu n'est remplacé QUE s'il n'en reste plus AUCUN en jeu :
  // on pose alors la prochaine Métamorphose de Merlin (dessus de la pioche) au Lieu du
  // Duel. Si la pioche est vide, plus rien n'arrive : l'objectif (7 vaincus) est atteint.
  const merlinStillInRealm = Object.values(next.players[state.activePlayer].board).flat().some((c) => c.isMerlinTransformation)
  if (merlinDefeated && !merlinStillInRealm && (next.players[state.activePlayer].merlinDeck?.length ?? 0) > 0) {
    const duel = next.players[state.activePlayer].locations[2]?.id ?? heroLoc
    next = updatePlayer(next, state.activePlayer, (p) => {
      const [nextMerlin, ...rest] = p.merlinDeck ?? []
      return {
        ...p,
        merlinDeck: rest,
        board: { ...p.board, [duel]: [...(p.board[duel] ?? []), nextMerlin] },
      }
    })
    next = {
      ...next,
      log: [...next.log, `Une nouvelle Métamorphose de Merlin (**${next.players[state.activePlayer].board[duel]?.slice(-1)[0]?.name}**) apparaît au Lieu du Duel.`],
    }
  }
  // Syndrome — transition de l'Omnidroïde quand il participe à ce Vanquish :
  //  • v.X8 : retiré du royaume + mélange défausse↦pioche ; v.X9 arrive en main.
  //  • v.X9 : retiré du royaume + cherche la Télécommande (→ main) ; v.10 arrive en main.
  //  • v.10 : N'est PAS retiré (reste sur Métroville).
  const omni = allies.find((a) => a.isOmnidroid)
  if (omni) {
    const ap = next.players[state.activePlayer]
    const omniLoc = locationOfCard(ap, omni.instanceId)
    if (omni.omnidroidStage === 'x8' || omni.omnidroidStage === 'x9') {
      // Retire l'Omnidroïde du plateau.
      if (omniLoc) {
        next = updatePlayer(next, state.activePlayer, (p) => ({
          ...p,
          board: { ...p.board, [omniLoc]: (p.board[omniLoc] ?? []).filter((c) => c.instanceId !== omni.instanceId) },
        }))
      }
      // La version suivante (v.X9 ou v.10) arrive en main depuis la pile.
      const pile = next.players[state.activePlayer].omnidroidPile ?? []
      const [nextTile, ...restPile] = pile
      if (omni.omnidroidStage === 'x8') {
        // Mélange défausse ↦ pioche (sans piocher).
        next = resolveEffect(next, { type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 0 }, { actorIndex: state.activePlayer })
        next = updatePlayer(next, state.activePlayer, (p) => ({
          ...p,
          omnidroidStage: 'x9-hand',
          omnidroidPile: restPile,
          hand: nextTile ? [...p.hand, nextTile] : p.hand,
        }))
        next = { ...next, log: [...next.log, `L'**Omnidroïde v.X8** est retiré (sa défausse est mélangée à sa pioche). L'**Omnidroïde v.X9** est prêt à être construit.`] }
      } else {
        // v.X9 : cherche la Télécommande de Syndrome (pioche/défausse) → main.
        next = updatePlayer(next, state.activePlayer, (p) => {
          const inDeck = p.deck.find((c) => c.cardId === 'telecommande-de-syndrome')
          const inDisc = p.discard.find((c) => c.cardId === 'telecommande-de-syndrome')
          const remote = inDeck ?? inDisc
          return {
            ...p,
            omnidroidStage: 'x10-hand',
            omnidroidPile: restPile,
            deck: remote && inDeck ? p.deck.filter((c) => c.instanceId !== remote.instanceId) : p.deck,
            discard: remote && !inDeck ? p.discard.filter((c) => c.instanceId !== remote.instanceId) : p.discard,
            hand: [...p.hand, ...(nextTile ? [nextTile] : []), ...(remote ? [remote] : [])],
          }
        })
        next = { ...next, log: [...next.log, `L'**Omnidroïde v.X9** est retiré. La **Télécommande de Syndrome** et l'**Omnidroïde v.10** rejoignent la main.`] }
      }
    }
  }
  // Effets « à la mort » du Héros (Toby, Belle Marianne — B.3).
  next = resolveEffects(next, heroCard.onVanquish ?? [], {
    actorIndex: state.activePlayer,
    hostInstanceId: heroCard.instanceId,
    hostLocationId: heroLoc,
  })
  // Sa Sucrerie — Cybug en Sucre : les Cybugs ayant participé ne sont pas défaussés ;
  // ils gagnent +N Force (jeton cumulatif) et sont déplacés sur un lieu au choix.
  if (cybugSurvivors.length > 0) {
    const idx = state.activePlayer
    const gainById = new Map(cybugSurvivors.map((s) => [s.id, s.gain]))
    next = updatePlayer(next, idx, (p) => ({
      ...p,
      board: Object.fromEntries(
        p.locations.map((l) => [
          l.id,
          (p.board[l.id] ?? []).map((c) =>
            gainById.has(c.instanceId)
              ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) + (gainById.get(c.instanceId) ?? 0) }
              : c,
          ),
        ]),
      ),
    }))
    // Y a-t-il un autre lieu non bloqué où déplacer ? Sinon, le Cybug reste sur place.
    const otherLoc = next.players[idx].locations.some(
      (l) => l.id !== heroLoc && !(next.players[idx].lockedLocations ?? []).includes(l.id),
    )
    next = {
      ...next,
      pendingAllyRelocate: otherLoc
        ? {
            chooserIndex: idx,
            targetIndex: idx,
            remaining: cybugSurvivors.length,
            optional: false,
            title: 'Cybug en Sucre',
            onlyInstanceIds: cybugSurvivors.map((s) => s.id),
          }
        : next.pendingAllyRelocate,
      log: [
        ...next.log,
        `**Cybug en Sucre** survit à l'élimination, gagne +1 Force${otherLoc ? ' et se déplace sur un autre lieu' : ''}.`,
      ],
    }
  }
  // Yzma — Kuzco ne reste JAMAIS en défausse Fatalité : s'il vient d'y être
  // éliminé (sans Kronk), il est remélangé avec les 4 pioches, reformées également.
  return reshuffleYzmaIfKuzcoDiscarded(next, state.activePlayer)
}

/** Yzma — Kuzco ne peut JAMAIS rester dans la défausse Fatalité : s'il y atterrit
 *  (éliminé sans Kronk, défaussé par le Marteau…), Kuzco ET toutes les cartes
 *  Fatalité qui NE sont PAS dans la défausse (les 4 pioches) sont mélangés puis
 *  reformés en 4 pioches les plus égales possibles. Le reste de la défausse (hors
 *  Kuzco) y reste. Sans effet si le joueur n'est pas Yzma ou si Kuzco n'y est pas. */
export function reshuffleYzmaIfKuzcoDiscarded(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  if (p.villain !== 'yzma' || !p.fateDecks) return state
  if (!p.fateDiscard.some((c) => c.cardId === 'kuzco')) return state
  const ids = p.locations.map((l) => l.id)
  const kuzco = p.fateDiscard.filter((c) => c.cardId === 'kuzco')
  const restDiscard = p.fateDiscard.filter((c) => c.cardId !== 'kuzco')
  // Pool remélangé : les 4 pioches + Kuzco (les autres cartes restent en défausse).
  const pool = [...Object.values(p.fateDecks).flat(), ...kuzco]
  const sh = shuffle(pool, state.rngState)
  const decks: Record<string, CardInstance[]> = Object.fromEntries(ids.map((id) => [id, []]))
  sh.result.forEach((c, i) => decks[ids[i % ids.length]].push(c))
  return {
    ...updatePlayer(state, idx, (pp) => ({ ...pp, fateDecks: decks, fateDiscard: restDiscard })),
    rngState: sh.state,
    log: [
      ...state.log,
      `Kuzco a été défaussé : Kuzco et les cartes des 4 pioches Fatalité de ${p.villainName} sont mélangés et reformés en 4 pioches.`,
    ],
  }
}

/**
 * Ursula — Pacte : si le Héros `heroId` (lieu `loc`) porte un Pacte dont le lieu
 * lié est `loc`, il est éliminé. Les Pactes vont en défausse Vilain, le Trident
 * éventuellement associé est LIBÉRÉ (Objet libre au même lieu), les autres Objets
 * associés et le Héros vont en défausse Fatalité. Renvoie `state` inchangé (même
 * référence) si aucun Pacte ne se déclenche. */
function checkPacteDefeat(state: GameState, idx: number, heroId: string, loc: LocationId): GameState {
  const p = state.players[idx]
  const cell = p.board[loc] ?? []
  const hero = cell.find((c) => c.instanceId === heroId)
  if (!hero || hero.type !== 'hero') return state
  const attached = cell.filter((c) => c.attachedTo === heroId)
  const pacte = attached.find((c) => c.contractLocationId === loc)
  if (!pacte) return state
  const trident = attached.find((c) => c.cardId === 'trident')
  const released = trident ? [{ ...trident, attachedTo: undefined }] : []
  const removedIds = new Set([heroId, ...attached.map((c) => c.instanceId)])
  const toVillain = attached.filter((c) => c.contractLocationId) // les Pactes
  const toFate = attached.filter((c) => c.cardId !== 'trident' && !c.contractLocationId) // Objets Fatalité associés
  let next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    board: {
      ...pp.board,
      [loc]: [...(pp.board[loc] ?? []).filter((c) => !removedIds.has(c.instanceId)), ...released],
    },
    fateDiscard: [...pp.fateDiscard, { ...hero, lockedPower: undefined }, ...toFate],
    discard: [...pp.discard, ...toVillain],
  }))
  next = {
    ...next,
    lastVanquishedHeroStrength: Math.max(next.lastVanquishedHeroStrength ?? 0, hero.strength ?? 0),
    log: [
      ...next.log,
      `Pacte : **${hero.name}** est éliminé en arrivant sur **${loc}**${trident ? ' — le Trident est libéré !' : ''}.`,
    ],
  }
  // Effets « à la mort » du Héros (cohérence avec performVanquish).
  return resolveEffects(next, hero.onVanquish ?? [], {
    actorIndex: idx,
    hostInstanceId: hero.instanceId,
    hostLocationId: loc,
  })
}

/** Résout un effet unique pour un joueur ACTEUR (par défaut : joueur actif). */
// ============================ Hadès — Titans ================================

/** Lieux où le Titan `titanId` (du joueur `idx`) peut être déplacé : ≤ `maxSteps`
 *  lieux le long de la ligne du royaume (Les Enfers → Mont Olympe). Vide si le
 *  Titan est entravé ou si Hercule est sur son lieu (il verrouille les Titans). */
export function titanReachableDests(
  state: GameState,
  idx: number,
  titanId: string,
  maxSteps: number,
): LocationId[] {
  const p = state.players[idx]
  const order = p.locations.map((l) => l.id)
  const from = locationOfCard(p, titanId)
  if (!from) return []
  const titan = (p.board[from] ?? []).find((c) => c.instanceId === titanId)
  if (!titan?.isTitan || titan.trapped) return []
  if ((p.board[from] ?? []).some((c) => c.type === 'hero' && c.cardId === 'hercule')) return []
  const fi = order.indexOf(from)
  return order.filter((id, i) => id !== from && Math.abs(i - fi) <= maxSteps)
}

/** Déplace un Titan (et ses Objets associés) vers `toLoc` dans le royaume de `idx`.
 *  Gère l'entrave par Zeus à l'arrivée et, si `fireTriggers`, les déclencheurs
 *  « à chaque déplacement » du Titan (Argès, Pyros, Stratos, Lythos — résolus
 *  automatiquement). Ne vérifie NI la portée NI le paiement (à la charge de
 *  l'appelant). */
export function moveTitanTo(
  state: GameState,
  idx: number,
  titanId: string,
  toLoc: LocationId,
  opts: { fireTriggers: boolean },
): GameState {
  const p = state.players[idx]
  const from = locationOfCard(p, titanId)
  if (!from) return state
  const titan = (p.board[from] ?? []).find((c) => c.instanceId === titanId)!
  const movingIds = new Set<string>([
    titanId,
    ...(p.board[from] ?? []).filter((c) => c.attachedTo === titanId).map((c) => c.instanceId),
  ])
  const moving = (p.board[from] ?? []).filter((c) => movingIds.has(c.instanceId))
  let next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    board: {
      ...pp.board,
      [from]: (pp.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [toLoc]: [...(pp.board[toLoc] ?? []), ...moving],
    },
  }))
  const destName = findLocation(next.players[idx], toLoc)?.name ?? toLoc
  next = { ...next, log: [...next.log, `${next.players[idx].villainName} déplace le Titan **${titan.name}** vers **${destName}**.`] }

  // Zeus entrave les Titans qui arrivent sur son lieu (et leur capacité est ignorée).
  if ((next.players[idx].board[toLoc] ?? []).some((c) => c.type === 'hero' && c.cardId === 'zeus')) {
    next = patchCard(next, idx, titanId, (c) => ({ ...c, trapped: true }))
    return { ...next, log: [...next.log, `**${titan.name}** arrive sur le lieu de Zeus : il est entravé (capacité ignorée).`] }
  }
  if (!opts.fireTriggers) return next

  // Déclencheurs « à chaque déplacement » (résolution automatique).
  if (titan.cardId === 'arges') {
    next = resolveEffect(next, { type: 'GAIN_POWER', amount: 1 }, { actorIndex: idx })
  } else if (titan.cardId === 'pyros') {
    const trappedHere = (next.players[idx].board[toLoc] ?? []).find((c) => c.isTitan && c.trapped)
    if (trappedHere) {
      next = patchCard(next, idx, trappedHere.instanceId, (c) => ({ ...c, trapped: false }))
      next = { ...next, log: [...next.log, `Pyros désentrave **${trappedHere.name}**.`] }
    }
  } else if (titan.cardId === 'stratos') {
    // Stratos : choisir un Héros de son lieu de DÉPART ou d'ARRIVÉE et le déplacer
    // vers un lieu voisin (pendingHeroRelocate, choisi par le joueur actif = Hadès).
    const heroes = [
      ...(next.players[idx].board[from] ?? []),
      ...(next.players[idx].board[toLoc] ?? []),
    ].filter((c) => c.type === 'hero')
    if (heroes.length > 0) {
      next = {
        ...next,
        pendingHeroRelocate: {
          chooserIndex: next.activePlayer,
          targetIndex: idx,
          anyLocation: false,
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...next.log, `Stratos : déplacez un Héros de son lieu de départ ou d'arrivée.`],
      }
    }
  } else if (titan.cardId === 'lythos') {
    // Lythos : Vanquish optionnel immédiat sur son lieu d'arrivée (s'il y a un
    // Héros), Lythos pouvant y participer (pendingTrapVanquish réutilisé).
    if ((next.players[idx].board[toLoc] ?? []).some((c) => c.type === 'hero')) {
      next = { ...next, pendingTrapVanquish: { source: 'trap' }, log: [...next.log, `Lythos peut Éliminer un Héros sur ${destName} (facultatif).`] }
    }
  }
  return next
}

/** Le Titan non entravé le plus AVANCÉ (proche du Mont Olympe) du joueur `idx`,
 *  avec son lieu, ou undefined. Sert aux effets Fatalité qui « repoussent » un
 *  Titan (Pégase, De zéro en héros). */
function mostAdvancedTitan(
  state: GameState,
  idx: number,
): { id: string; locIndex: number } | undefined {
  const p = state.players[idx]
  const order = p.locations.map((l) => l.id)
  let best: { id: string; locIndex: number } | undefined
  order.forEach((locId, i) => {
    for (const c of p.board[locId] ?? []) {
      if (c.isTitan && !c.trapped && (!best || i > best.locIndex)) best = { id: c.instanceId, locIndex: i }
    }
  })
  return best
}

/** Pat Hibulaire — déplace une carte (+ Objets associés) de `from` vers `to` dans
 *  le royaume `idx`. Pur. No-op si rien à déplacer. */
export function relocateCard(state: GameState, idx: number, instanceId: string, from: LocationId, to: LocationId): GameState {
  if (from === to) return state
  const cell = state.players[idx].board[from] ?? []
  const ids = new Set([
    instanceId,
    ...cell.filter((c) => c.attachedTo === instanceId).map((c) => c.instanceId),
  ])
  const moving = cell.filter((c) => ids.has(c.instanceId))
  if (moving.length === 0) return state
  return updatePlayer(state, idx, (p) => ({
    ...p,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !ids.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
}

/** Shere Khan (effets Fatalité de déplacement, joués par le FATALISEUR) : lieu de `idx`
 *  avec le MOINS de force d'Alliés (≠ `exclude`), pour y ÉLOIGNER un Héros (Mowgli) des
 *  Alliés que Shere Khan rassemble pour le vaincre. */
function leastAllyForceLocation(p: PlayerState, exclude: LocationId): LocationId | undefined {
  const allyForce = (loc: LocationId) =>
    (p.board[loc] ?? [])
      .filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
      .reduce((n, c) => n + (c.strength ?? 0), 0)
  return p.locations
    .map((l) => l.id)
    .filter((id) => id !== exclude)
    .sort((a, b) => allyForce(a) - allyForce(b))[0]
}

/** Davy Jones — Hadras : quand lui (ou tout Allié `revealTreasureOnDiscard`) part en
 *  défausse, on RÉVÈLE un jeton Trésor face cachée (auto : 1er Héros porteur). No-op si
 *  aucun des Alliés défaussés ne porte le flag (donc sans effet pour les autres vilains). */
function triggerRevealOnAllyDiscard(state: GameState, idx: number, discarded: CardInstance[]): GameState {
  if (!discarded.some((c) => c.revealTreasureOnDiscard)) return state
  const target = heroesWithFacedownTreasure(state.players[idx])[0]
  if (!target) return state
  const next = { ...state, log: [...state.log, `Hadras est défaussé : ${state.players[idx].villainName} révèle un jeton Trésor.`] }
  return revealTreasure(next, idx, target.instanceId)
}

/** Pat Hibulaire — déplacement « malin » d'un Allié ou Objet (Cheval bénéfique pour
 *  Pat / Horace perturbateur joué par l'adversaire), résolu par une heuristique
 *  d'objectif. Renvoie l'état (journalisé) ou un no-op journalisé. */
export function smartMoveAllyOrItem(state: GameState, idx: number, beneficial: boolean): GameState {
  const p = state.players[idx]
  const name = p.villainName
  const label = beneficial ? 'Cheval' : 'Horace'
  const done = (s: GameState, card: CardInstance, to: LocationId): GameState => ({
    ...s,
    log: [...s.log, `${label} : **${card.name}** déplacé vers ${findLocation(p, to)?.name ?? to}.`],
  })
  type Pos = { card: CardInstance; loc: LocationId }
  const allies: Pos[] = []
  const items: Pos[] = []
  for (const l of p.locations) {
    for (const c of p.board[l.id] ?? []) {
      if (c.attachedTo) continue
      if (c.type === 'ally') allies.push({ card: c, loc: l.id })
      else if (c.type === 'item') items.push({ card: c, loc: l.id })
    }
  }
  const counts = (lid: LocationId) => {
    const here = p.board[lid] ?? []
    return { a: here.filter((c) => c.type === 'ally').length, h: here.filter((c) => c.type === 'hero').length }
  }
  const goals = (p.goals ?? []).filter((g) => !g.completed)

  if (beneficial) {
    // 1) Round Up : amener l'Allié le plus fort (d'ailleurs) sur le lieu de la tuile.
    for (const g of goals) {
      if (g.kind !== 'round-up') continue
      const off = allies
        .filter((a) => a.loc !== g.locationId)
        .sort((a, b) => (b.card.strength ?? 0) - (a.card.strength ?? 0))[0]
      if (off) return done(relocateCard(state, idx, off.card.instanceId, off.loc, g.locationId), off.card, g.locationId)
    }
    // 2) Strike It Rich : amener un Objet (d'ailleurs) sur le lieu de la tuile.
    for (const g of goals) {
      if (g.kind !== 'strike-it-rich') continue
      const off = items.find((a) => a.loc !== g.locationId)
      if (off) return done(relocateCard(state, idx, off.card.instanceId, off.loc, g.locationId), off.card, g.locationId)
    }
    // 3) Rule the Realm : combler un lieu déficitaire (Alliés ≤ Héros) avec un Allié
    //    pris d'un lieu en excédent.
    for (const g of goals) {
      if (g.kind !== 'rule-the-realm') continue
      const deficit = p.locations.find((l) => { const c = counts(l.id); return c.a <= c.h })
      if (!deficit) continue
      const donor = allies
        .filter((a) => a.loc !== deficit.id)
        .find((a) => { const c = counts(a.loc); return c.a - 1 > c.h })
      if (donor) return done(relocateCard(state, idx, donor.card.instanceId, donor.loc, deficit.id), donor.card, deficit.id)
    }
    return { ...state, log: [...state.log, `${name} : Cheval — aucun déplacement utile.`] }
  }

  // Perturbateur (Horace) : disperse l'Allié le plus fort du lieu le plus chargé.
  let fromLoc: LocationId | undefined
  let maxAllies = -1
  for (const l of p.locations) {
    const n = counts(l.id).a
    if (n > maxAllies) { maxAllies = n; fromLoc = l.id }
  }
  if (fromLoc && maxAllies > 0) {
    const here = (p.board[fromLoc] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo)
    const strongest = [...here].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
    const to = [...p.locations]
      .filter((l) => l.id !== fromLoc)
      .sort((a, b) => counts(a.id).a - counts(b.id).a)[0]
    if (strongest && to) return done(relocateCard(state, idx, strongest.instanceId, fromLoc, to.id), strongest, to.id)
  }
  const it = items[0]
  if (it) {
    const to = p.locations.find((l) => l.id !== it.loc)
    if (to) return done(relocateCard(state, idx, it.card.instanceId, it.loc, to.id), it.card, to.id)
  }
  return { ...state, log: [...state.log, `${name} : Horace — rien à déplacer.`] }
}

/** Lotso — réduit la force d'un Héros précis (jetons −1) : de `amount`, ou jusqu'à 0 si
 *  `toZero`. Utilisé par l'auto-résolution ET par RESOLVE_LOTSO_TARGET. */
export function lotsoReduceHero(
  state: GameState,
  idx: number,
  instanceId: string,
  amount?: number,
  toZero?: boolean,
): GameState {
  const p = state.players[idx]
  const loc = locationOfCard(p, instanceId)
  if (!loc) return state
  const hero = (p.board[loc] ?? []).find((c) => c.instanceId === instanceId)
  if (!hero || hero.type !== 'hero') return state
  const amt = toZero ? effectiveStrength(state, idx, instanceId) ?? 0 : amount ?? 1
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: { ...pl.board, [loc]: (pl.board[loc] ?? []).map((c) => c.instanceId === instanceId ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) - amt } : c) },
  }))
  return { ...next, log: [...next.log, `${p.villainName} réduit la force de **${hero.name}** de ${amt}.`] }
}

/** Lotso — déplace un Héros (ou la tuile Buzz) précis vers la Salle des Chenilles. */
export function lotsoMoveToRoom(state: GameState, idx: number, instanceId: string): GameState {
  const p = state.players[idx]
  const roomId = p.objective.type === 'LOTSO_GATHER' ? p.objective.roomId : p.locations[0].id
  const from = locationOfCard(p, instanceId)
  if (!from || from === roomId) return state
  const card = (p.board[from] ?? []).find((c) => c.instanceId === instanceId)
  if (!card) return state
  const attached = (p.board[from] ?? []).filter((c) => c.attachedTo === instanceId)
  const ids = new Set([instanceId, ...attached.map((c) => c.instanceId)])
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: { ...pl.board, [from]: (pl.board[from] ?? []).filter((c) => !ids.has(c.instanceId)), [roomId]: [...(pl.board[roomId] ?? []), card, ...attached] },
  }))
  return { ...next, log: [...next.log, `${p.villainName} déplace **${card.name}** sur la Salle des Chenilles.`] }
}

export function resolveEffect(
  state: GameState,
  effect: Effect,
  ctx?: EffectContext,
): GameState {
  const idx = ctx?.actorIndex ?? state.activePlayer
  switch (effect.type) {
    case 'CLAIM_BLACK_CAULDRON': {
      // Le Seigneur des Ténèbres : s'emparer du Chaudron Magique (tuile hors deck). Sans
      // effet s'il est déjà réclamé/réveillé. Passe 'set-aside' → 'claimed'.
      const p = state.players[idx]
      if (p.blackCauldron !== 'set-aside') return state
      // Les Sorcières de Morva le détiennent : impossible de s'en emparer tant qu'elles
      // sont là (à vaincre d'abord).
      if (cauldronClaimBlocked(p)) {
        return { ...state, log: [...state.log, `${p.villainName} ne peut pas s'emparer du Chaudron : Les Sorcières de Morva le détiennent.`] }
      }
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, blackCauldron: 'claimed' }))
      return {
        ...next,
        log: [...next.log, `${p.villainName} s'empare du **Chaudron Magique** (à réveiller pour libérer son Pouvoir).`],
      }
    }
    case 'POWER_BLACK_CAULDRON': {
      // Le Seigneur des Ténèbres — « Notre heure est venue ! » : réveille le Chaudron
      // Magique réclamé (face Pouvoir). Sans effet s'il n'est pas (encore) réclamé.
      const p = state.players[idx]
      if (p.blackCauldron !== 'claimed') return state
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, blackCauldron: 'powered' }))
      return {
        ...next,
        log: [...next.log, `${p.villainName} RÉVEILLE le **Chaudron Magique** : il peut désormais jouer des Soldats Ressuscités.`],
      }
    }
    case 'DORMANT_BLACK_CAULDRON': {
      // Sacrifice de Gurki (Fatalité) : rendort le Chaudron Magique réveillé.
      const p = state.players[idx]
      if (p.blackCauldron !== 'powered') return state
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, blackCauldron: 'claimed' }))
      return {
        ...next,
        log: [...next.log, `Le sacrifice de Gurki RENDORT le **Chaudron Magique** de ${p.villainName}.`],
      }
    }
    case 'DRAW_CARDS': {
      // Pioche `count` cartes (Capturés).
      const p = state.players[idx]
      const next = drawNCards(state, idx, effect.count)
      return { ...next, log: [...next.log, `${p.villainName} pioche ${effect.count} carte${effect.count > 1 ? 's' : ''}.`] }
    }
    // --- Dio Brando : Stands -------------------------------------------------
    case 'FETCH_STAND_ATTACH': {
      // Va chercher le Stand dans standPile et l'associe à la carte hôte qui vient
      // d'entrer en jeu (Héros Joestar via onPlace, ou Allié de Dio via summonsStandCardId).
      const hostId = ctx?.hostInstanceId
      const hostLoc = ctx?.hostLocationId
      if (!hostId || !hostLoc) return state
      const p = state.players[idx]
      const stand = (p.standPile ?? []).find((c) => c.cardId === effect.standCardId)
      if (!stand) return state // déjà en jeu / indisponible : la carte hôte reste sans Stand
      const hostName =
        (p.board[hostLoc] ?? []).find((c) => c.instanceId === hostId)?.name ?? 'son invocateur'
      const placed: CardInstance = { ...stand, attachedTo: hostId }
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        standPile: (pl.standPile ?? []).filter((c) => c.instanceId !== stand.instanceId),
        board: { ...pl.board, [hostLoc]: [...(pl.board[hostLoc] ?? []), placed] },
      }))
      let out = { ...next, log: [...next.log, `Le Stand **${stand.name}** est invoqué et associé à **${hostName}**.`] }
      // Le Stand peut porter un effet immédiat « à l'invocation » (The Fool disperse les
      // Alliés du lieu d'Iggy). On le résout en conservant le contexte de l'hôte.
      if (stand.effects && stand.effects.length > 0) {
        out = resolveEffects(out, stand.effects, { actorIndex: idx, hostInstanceId: hostId, hostLocationId: hostLoc })
      }
      return out
    }
    case 'FETCH_CARD_TO_HAND': {
      // Enya Geil → « La flèche » : cherche la carte (pioche puis défausse Méchant) et
      // l'ajoute à la main. No-op si introuvable.
      const p = state.players[idx]
      const found =
        p.deck.find((c) => c.cardId === effect.cardId) ?? p.discard.find((c) => c.cardId === effect.cardId)
      if (!found) return state
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        deck: pl.deck.filter((c) => c.instanceId !== found.instanceId),
        discard: pl.discard.filter((c) => c.instanceId !== found.instanceId),
        hand: [...pl.hand, found],
      }))
      return { ...next, log: [...next.log, `${p.villainName} va chercher **${found.name}** et l'ajoute à sa main.`] }
    }
    case 'ZA_WARUDO_ACTIVATE': {
      // ZA WARUDO! : arrête le temps pour ce tour. Nécessite The World en jeu ; Star
      // Platinum (Stand de Jotaro) l'empêche. Active la fenêtre de temps arrêté.
      const p = state.players[idx]
      const inPlay = Object.values(p.board).flat()
      if (!inPlay.some((c) => c.cardId === 'the-world')) {
        return { ...state, log: [...state.log, `ZA WARUDO ! échoue : The World n'est pas en jeu.`] }
      }
      if (inPlay.some((c) => c.cardId === 'star-platinum')) {
        return { ...state, log: [...state.log, `ZA WARUDO ! est contré par **Star Platinum** !`] }
      }
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, zaWarudoActive: true, zaWarudoActionsDone: 0 }))
      return {
        ...next,
        log: [
          ...next.log,
          `**ZA WARUDO !** ${p.villainName} arrête le temps : il peut agir sur n'importe quel lieu ce tour (coût croissant).`,
        ],
      }
    }
    case 'DIO_DISCARD_ALLY_GAIN': {
      // Vampirisme : choix INTERACTIF de l'Allié à défausser (The World épargné), gagne
      // `amount` (×2 si The World au pouvoir). Auto-pick réservé au bot (handler UI).
      const p = state.players[idx]
      const candidates: CardInstance[] = []
      for (const loc of p.locations)
        for (const c of p.board[loc.id] ?? [])
          if (c.type === 'ally' && !c.attachedTo && !c.isWicket && !c.cannotBeDiscarded) candidates.push(c)
      if (candidates.length === 0) return { ...state, log: [...state.log, `Vampirisme : aucun Allié à défausser.`] }
      return {
        ...state,
        pendingDioDiscardAlly: { playerIndex: idx, gain: effect.amount },
        log: [...state.log, `Vampirisme : ${p.villainName} choisit un Allié à défausser.`],
      }
    }
    case 'DIO_DISCARD_HAND_GAIN_POWER': {
      // Masque de pierre : défausse TOUTE la main, gagne 1 Pouvoir par carte.
      const p = state.players[idx]
      const n = p.hand.length
      const gain = n * dioPowerFactor(p)
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        discard: [...pl.discard, ...pl.hand],
        hand: [],
        power: pl.power + gain,
      }))
      return { ...next, log: [...next.log, `Masque de pierre : ${p.villainName} défausse ${n} carte(s) et gagne ${gain} JT.`] }
    }
    case 'DIO_DISCARD_ITEM_IN_REALM': {
      // Fondation Speedwagon (Fatalité) : défausse l'Objet non associé le plus précieux du
      // royaume de Dio (The World épargné : indéfaussable).
      const p = state.players[idx]
      let best: { c: CardInstance; loc: LocationId } | undefined
      for (const loc of p.locations)
        for (const c of p.board[loc.id] ?? []) {
          if (c.type === 'item' && !c.attachedTo && !c.cannotBeDiscarded) {
            const v = (c.cost ?? 0) + (c.strength ?? 0)
            if (!best || v > ((best.c.cost ?? 0) + (best.c.strength ?? 0))) best = { c, loc: loc.id }
          }
        }
      if (!best) return { ...state, log: [...state.log, `Fondation Speedwagon : aucun Objet à défausser.`] }
      const bc = best.c, bl = best.loc
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [bl]: (pl.board[bl] ?? []).filter((c) => c.instanceId !== bc.instanceId) },
        discard: [...pl.discard, { ...bc, attachedTo: undefined }],
      }))
      return { ...next, log: [...next.log, `Fondation Speedwagon : **${bc.name}** est défaussé.`] }
    }
    case 'DIO_REDUCE_ALLY_STRENGTH': {
      // Cartomancie (Fatalité) : réduit de `amount` la force de l'Allié le plus fort de Dio.
      const p = state.players[idx]
      let best: { c: CardInstance; loc: LocationId } | undefined
      for (const loc of p.locations)
        for (const c of p.board[loc.id] ?? []) {
          if (c.type === 'ally' && !c.attachedTo && !c.isWicket) {
            const s = effectiveStrength(state, idx, c.instanceId) ?? 0
            if (!best || s > (effectiveStrength(state, idx, best.c.instanceId) ?? 0)) best = { c, loc: loc.id }
          }
        }
      if (!best) return { ...state, log: [...state.log, `Cartomancie : aucun Allié à affaiblir.`] }
      const bid = best.c.instanceId
      const next = patchCard(state, idx, bid, (c) => ({
        ...c,
        permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) - effect.amount,
      }))
      return { ...next, log: [...next.log, `Cartomancie : **${best.c.name}** perd ${effect.amount} de force.`] }
    }
    case 'DIO_SUNLIGHT_CHOICE': {
      // Lumière du Soleil (Fatalité) : DIO choisit ENTRE défausser sa main OU perdre `lose`
      // Pouvoir. Choix INTERACTIF (pendingDioSunlight) ; le bot tranche via le handler UI.
      const p = state.players[idx]
      return {
        ...state,
        pendingDioSunlight: { playerIndex: idx, lose: effect.lose },
        log: [...state.log, `Lumière du Soleil : ${p.villainName} doit choisir (défausser sa main ou perdre ${effect.lose} JT).`],
      }
    }
    case 'DIO_REVEAL_FATE_HEROES_AT_PAWN': {
      // Tu oses t'approcher de moi : dévoile les `count` 1ʳᵉˢ cartes Fatalité ; joue TOUS
      // les Héros révélés sur le lieu du pion (chacun déclenche son Stand), défausse le reste.
      const p = state.players[idx]
      const revealed = p.fateDeck.slice(0, effect.count)
      const rest = p.fateDeck.slice(effect.count)
      if (revealed.length === 0) return { ...state, log: [...state.log, `Tu oses t'approcher : pioche Fatalité vide.`] }
      const heroes = revealed.filter((c) => c.type === 'hero')
      const others = revealed.filter((c) => c.type !== 'hero')
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDeck: rest, fateDiscard: [...pl.fateDiscard, ...others] }))
      for (const h of heroes) next = placeScarHero(next, idx, h)
      return {
        ...next,
        log: [
          ...next.log,
          `Tu oses t'approcher : ${heroes.length} Héros entre${heroes.length > 1 ? 'nt' : ''} sur le lieu de ${p.villainName}, le reste est défaussé.`,
        ],
      }
    }
    case 'DIO_CREAM_DISCARD_HERO': {
      // CREAM (Stand de Vanilla Ice) : choix INTERACTIF d'un Héros de force < celle de
      // Vanilla Ice, présent sur le lieu de Vanilla Ice (bot : le plus fort éligible).
      const loc = ctx?.hostLocationId
      const viId = ctx?.hostInstanceId
      if (!loc || !viId) return state
      const viStr = effectiveStrength(state, idx, viId) ?? 0
      const cell = state.players[idx].board[loc] ?? []
      const targets = cell.filter(
        (c) => c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) < viStr,
      )
      if (targets.length === 0) return state
      return {
        ...state,
        pendingDioCream: { playerIndex: idx, locationId: loc, candidateIds: targets.map((c) => c.instanceId) },
        log: [...state.log, `CREAM : ${state.players[idx].villainName} choisit un Héros à défausser.`],
      }
    }
    case 'DIO_QUEST_FOR_HEAVEN': {
      // Quête vers le paradis : choix INTERACTIF du type (Objet/Événement) à récupérer ;
      // la résolution mélange la défausse, en dévoile 6 et reprend les cartes du type choisi.
      // Bot : le type le plus nombreux en défausse (handler UI).
      const p = state.players[idx]
      return {
        ...state,
        pendingDioQuest: { playerIndex: idx },
        log: [...state.log, `Quête vers le paradis : ${p.villainName} choisit un type de carte (Objet ou Événement).`],
      }
    }
    case 'DIO_MUDA': {
      // MUDA! (Condition) : choix INTERACTIF (facultatif) du Héros à éliminer sur le lieu du
      // pion ; gagne `gain` Pouvoir dans tous les cas. Sans Héros présent → gain direct.
      const p = state.players[idx]
      const loc = p.pawnLocation
      const heroes = loc ? (p.board[loc] ?? []).filter((c) => c.type === 'hero') : []
      if (heroes.length === 0) {
        const gain = effect.gain * dioPowerFactor(p)
        const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: pl.power + gain }))
        return { ...next, log: [...next.log, `MUDA ! MUDA ! MUDA ! : ${p.villainName} gagne ${gain} JT.`] }
      }
      return {
        ...state,
        pendingDioMuda: { playerIndex: idx, gain: effect.gain, candidateIds: heroes.map((c) => c.instanceId) },
        log: [...state.log, `MUDA ! MUDA ! MUDA ! : ${p.villainName} peut éliminer un Héros.`],
      }
    }
    case 'DIO_THE_FOOL_SCATTER': {
      // The Fool (Stand d'Iggy) : disperse les Alliés du lieu d'Iggy vers d'autres lieux.
      // Contrôlé par le fataliseur → auto : répartition tournante sur les autres lieux.
      const loc = ctx?.hostLocationId
      if (!loc) return state
      const p = state.players[idx]
      const movable = (p.board[loc] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo)
      if (movable.length === 0) return state
      const others = p.locations.map((l) => l.id).filter((l) => l !== loc)
      if (others.length === 0) return state
      let out = state
      movable.forEach((ally, i) => {
        const dest = others[i % others.length]
        out = updatePlayer(out, idx, (pl) => {
          const fromCell = (pl.board[loc] ?? []).filter(
            (c) => c.instanceId !== ally.instanceId && c.attachedTo !== ally.instanceId,
          )
          const moved = (pl.board[loc] ?? []).filter(
            (c) => c.instanceId === ally.instanceId || c.attachedTo === ally.instanceId,
          )
          return {
            ...pl,
            board: { ...pl.board, [loc]: fromCell, [dest]: [...(pl.board[dest] ?? []), ...moved] },
          }
        })
      })
      const iggyName = (state.players[idx].board[loc] ?? []).find((c) => c.cardId === 'iggy')?.name ?? 'Iggy'
      return { ...out, log: [...out.log, `**The Fool** disperse les Alliés du lieu de ${iggyName}.`] }
    }
    case 'DISCARD_ANY_THEN_DRAW': {
      // Père Noël : défausse FACULTATIVE d'autant de cartes que voulu, puis pioche.
      // Main vide → on pioche directement (rien à défausser).
      const p = state.players[idx]
      if (p.hand.length === 0) {
        const next = drawNCards(state, idx, effect.draw)
        return { ...next, log: [...next.log, `${p.villainName} (Père Noël) pioche ${effect.draw} carte(s).`] }
      }
      return {
        ...state,
        pendingDiscardThenDraw: { playerIndex: idx, draw: effect.draw },
        log: [...state.log, `${p.villainName} (Père Noël) : défaussez autant de cartes que vous voulez, puis piochez ${effect.draw}.`],
      }
    }
    // --- Sa Sucrerie (King Candy / Sugar Rush) ------------------------------
    // Les effets de circuit/course visent TOUJOURS le joueur King Candy (qu'ils
    // viennent d'une carte Méchant à lui ou d'une Fatalité jouée par un adversaire).
    case 'KING_CANDY_START_RACE': {
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      return kc < 0 ? state : startRace(state, kc)
    }
    case 'KING_CANDY_PLAY_BUG': {
      // Bug associé à Vanellope. Si un Bug y était DÉJÀ (course en cours), le pion ET le
      // jeton Pilote avancent de 2 ; sinon (1ᵉʳ Bug) la course démarre. L'effet se résout
      // APRÈS l'association : on compte les Bugs sur Vanellope (≥2 = il y en avait déjà un).
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const p = state.players[kc]
      const v = vanellopeInstance(p)
      const bugCount = v
        ? Object.values(p.board).flat().filter((c) => c.cardId === 'bug' && c.attachedTo === v.instanceId).length
        : 0
      if (p.raceActive && bugCount >= 2) {
        let next = moveKingCandyTrack(state, kc, 2) // pion +2 (franchissement = victoire géré)
        next = advanceRacer(next, kc, 2) // jeton Pilote +2
        return {
          ...next,
          log: [...next.log, `Un Bug de plus sur Vanellope : ${p.villainName} et le jeton Pilote avancent de 2 cases.`],
        }
      }
      return startRace(state, kc)
    }
    case 'PAY_TO_RACE': {
      // L'important, c'est de payer : dépenser 1 à min(6, Pouvoir) jetons pour avancer le
      // pion d'autant. Choix interactif (pendingPayRace). Sans Pouvoir → aucun effet.
      const p = state.players[idx]
      const max = Math.min(6, p.power)
      if (max < 1) return { ...state, log: [...state.log, `${p.villainName} : aucun Pouvoir à dépenser (L'important, c'est de payer).`] }
      return { ...state, pendingPayRace: { playerIndex: idx, max } }
    }
    case 'KING_CANDY_SPARKLES': {
      // C'est quoi toutes ces étincelles ? : défausse un Bug de Vanellope ; s'il en reste
      // au moins un ensuite, le jeton Pilote avance de 3.
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const p = state.players[kc]
      const v = vanellopeInstance(p)
      if (!v) return state
      const bugs = Object.entries(p.board).flatMap(([loc, cards]) =>
        cards.filter((c) => c.cardId === 'bug' && c.attachedTo === v.instanceId).map((c) => ({ loc, c })),
      )
      if (bugs.length === 0) return { ...state, log: [...state.log, `Étincelles : aucun Bug sur Vanellope.`] }
      const first = bugs[0]
      let next = updatePlayer(state, kc, (pl) => ({
        ...pl,
        board: { ...pl.board, [first.loc]: (pl.board[first.loc] ?? []).filter((c) => c.instanceId !== first.c.instanceId) },
        discard: [...pl.discard, { ...first.c, attachedTo: undefined }],
      }))
      next = { ...next, log: [...next.log, `Étincelles : un Bug de Vanellope est défaussé.`] }
      if (bugs.length - 1 >= 1) {
        next = advanceRacer(next, kc, 3)
      }
      return next
    }
    // --- Shere Khan : Jetons Feu + cartes ----------------------------------
    case 'PLACE_OR_MOVE_FIRE': {
      // Feu Rouge des Hommes (Fatalité) : pose un jeton Feu sur une action LIBRE de Shere
      // Khan (auto : priorité Vaincre/Activer/Jouer, et lieux portant un Héros).
      const p = state.players[idx]
      const free = fireFreeActions(p)
      if (free.length === 0) return state
      const score = (a: { locationId: string; actionId: string }) => {
        const act = p.locations.find((l) => l.id === a.locationId)?.actions.find((x) => x.id === a.actionId)
        const t = act?.type
        const heroHere = (p.board[a.locationId] ?? []).some((c) => c.type === 'hero')
        const base = t === 'VANQUISH' ? 4 : t === 'ACTIVATE' ? 3 : t === 'PLAY_CARD' ? 2 : t === 'FATE' ? 1 : 0
        return base + (heroHere ? 2 : 0)
      }
      const pick = [...free].sort((a, b) => score(b) - score(a))[0]
      return placeFire(state, idx, pick.locationId, pick.actionId)
    }
    case 'PLACE_FIRE_AT_HOST': {
      // Mowgli (onPlace) : pose un jeton Feu sur une action libre de son lieu d'arrivée.
      const loc = ctx?.hostLocationId
      if (!loc) return state
      const p = state.players[idx]
      const onLoc = fireOnLocation(p, loc)
      const acts = (p.locations.find((l) => l.id === loc)?.actions ?? []).filter((a) => !onLoc.includes(a.id))
      if (acts.length === 0) return state
      const pick = acts.find((a) => a.type === 'VANQUISH') ?? acts[0]
      return placeFire(state, idx, loc, pick.id)
    }
    case 'REMOVE_FIRE_AT_PAWN': {
      // C'est moi, Shere Khan : retire un jeton Feu du royaume. S'il y en a plusieurs, le
      // joueur CHOISIT lequel (pendingRemoveFire) ; un seul → retiré directement.
      const p = state.players[idx]
      const fires = listFire(p)
      if (fires.length === 0) return { ...state, log: [...state.log, `${p.villainName} : aucun jeton Feu à retirer.`] }
      if (fires.length === 1) return removeFire(state, idx, fires[0].locationId, fires[0].actionId)
      return { ...state, pendingRemoveFire: { playerIndex: idx } }
    }
    case 'INTERESSANT_CHOICE': {
      // C'est très intéressant (Condition) : le joueur choisit UNE OU PLUSIEURS actions parmi
      // gagner 1 Pouvoir / piocher 1 carte / déplacer 1 jeton Feu (pendingInteressant).
      return { ...state, pendingInteressant: { playerIndex: idx, done: [] } }
    }
    case 'GRANT_FREE_ACTIVATE_OR_VANQUISH': {
      // Tout le monde fuit : action gratuite « Activer » OU « Éliminer un Héros ». Si les
      // DEUX sont possibles → choix interactif (pendingActivateOrVanquish) ; sinon la seule
      // réalisable s'applique ; aucun des deux → sans effet (carte de toute façon injouable).
      const p = state.players[idx]
      const canVanquish = Object.values(p.board).flat().some((c) => c.type === 'hero')
      const canActivate = activatableCards(state).length > 0
      if (canVanquish && canActivate) {
        return { ...state, pendingActivateOrVanquish: { playerIndex: idx } }
      }
      if (canVanquish) return resolveEffect(state, { type: 'GRANT_FREE_ACTION', actionType: 'VANQUISH' }, ctx)
      if (canActivate) return resolveEffect(state, { type: 'GRANT_FREE_ACTIVATE' }, ctx)
      return state
    }
    case 'MOVE_HERO_TO_ALLY_OR_POWER_PER_ALLY': {
      // Jeune et sans défense : déplacer un Héros sur le lieu d'un Allié OU gagner 1 Pouvoir
      // par Allié. Si les DEUX sont possibles (Héros ET Allié présents) → choix interactif
      // (pendingYoung). Sinon la seule option réalisable s'applique.
      const p = state.players[idx]
      const hasHero = Object.values(p.board).flat().some((c) => c.type === 'hero')
      const allies = Object.values(p.board).flat().filter((c) => c.type === 'ally' && !c.attachedTo)
      if (hasHero && allies.length > 0) {
        return { ...state, pendingYoung: { playerIndex: idx, kind: 'choose' } }
      }
      if (allies.length > 0) {
        const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: pl.power + allies.length }))
        return { ...next, log: [...next.log, `${next.players[idx].villainName} (Jeune et sans défense) : +${allies.length} Pouvoir.`] }
      }
      return { ...state, log: [...state.log, `${p.villainName} (Jeune et sans défense) : aucun effet.`] }
    }
    case 'REVEAL_UNTIL_ALLY_PLAY_FREE': {
      // À toi de jouer, cousin : dévoile la pioche Méchant jusqu'à un Allié, le JOUE
      // GRATUITEMENT sur le lieu du choix du joueur (pendingFreePlayAlly), défausse les
      // autres cartes dévoilées. Remélange la défausse si la pioche se vide.
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const total = deck.length + disc.length
      const revealed: CardInstance[] = []
      let ally: CardInstance | undefined
      while (revealed.length < total) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === 'ally') { ally = top; break }
      }
      if (revealed.length === 0) return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (À toi de jouer, cousin).`] }
      const others = ally ? revealed.filter((c) => c.instanceId !== ally!.instanceId) : revealed
      const next = updatePlayer({ ...state, rngState: s }, idx, (p) => ({ ...p, deck, discard: [...disc, ...others] }))
      if (!ally) return { ...next, log: [...next.log, `${actor.villainName} : aucun Allié trouvé, cartes dévoilées défaussées (À toi de jouer, cousin).`] }
      return {
        ...next,
        pendingFreePlayAlly: { playerIndex: idx, ally },
        log: [...next.log, `${actor.villainName} dévoile **${ally.name}** : à jouer gratuitement sur le lieu de votre choix.`],
      }
    }
    case 'DISCARD_FATE_THEN_RECOVER': {
      // C'est à moi que vous le direz : défausse les `count` premières cartes Fatalité,
      // puis on PEUT remettre une carte de la défausse Fatalité dans la pioche (au choix).
      const p = state.players[idx]
      const n = Math.min(effect.count, p.fateDeck.length)
      const moved = p.fateDeck.slice(0, n)
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDeck: pl.fateDeck.slice(n), fateDiscard: [...pl.fateDiscard, ...moved] }))
      next = { ...next, log: [...next.log, `${next.players[idx].villainName} défausse ${n} carte(s) Fatalité.`] }
      if (next.players[idx].fateDiscard.length === 0) return next
      return { ...next, pendingRecoverFate: { playerIndex: idx } }
    }
    case 'DEFEAT_OR_FETCH_HERO': {
      // Lancé sur ses traces : si le Héros-cible est dans le royaume → éliminer un Héros
      // AU CHOIX (gratuit ; Baloo protège, victoire no-fire si c'est Mowgli) ; sinon chercher
      // le Héros et le jouer sur le lieu de SON choix (pendingFetchedHero).
      const p = state.players[idx]
      const hasTarget = Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === effect.heroCardId)
      if (hasTarget) {
        const heroes = Object.values(p.board).flat().filter((c) => c.type === 'hero')
        if (heroes.length === 1) return freeEliminateHero(state, idx, heroes[0].instanceId)
        return { ...state, pendingShereKhanDefeat: { playerIndex: idx } }
      }
      // Recherche du Héros dans la pioche/défausse Fatalité → choix du lieu de pose.
      const di = p.fateDeck.findIndex((c) => c.cardId === effect.heroCardId)
      const fi = di >= 0 ? -1 : p.fateDiscard.findIndex((c) => c.cardId === effect.heroCardId)
      let hero: CardInstance | undefined
      let next = state
      if (di >= 0) {
        hero = p.fateDeck[di]
        next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDeck: pl.fateDeck.filter((_, i) => i !== di) }))
      } else if (fi >= 0) {
        hero = p.fateDiscard[fi]
        next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDiscard: pl.fateDiscard.filter((_, i) => i !== fi) }))
      }
      if (!hero) return { ...state, log: [...state.log, `${p.villainName} : ${effect.heroCardId} introuvable.`] }
      return {
        ...next,
        pendingFetchedHero: { playerIndex: idx, hero, discarded: [] },
        log: [...next.log, `${p.villainName} cherche **${hero.name}** : à jouer sur le lieu de votre choix (Lancé sur ses traces).`],
      }
    }
    case 'RECOVER_CARDS_TO_DECK': {
      // Aie confiance : récupère jusqu'à `count` cartes de la défausse (AU CHOIX) et les
      // remélange dans la pioche. Ouvre un choix interactif (pendingRecoverToDeck).
      const p = state.players[idx]
      if (p.discard.length === 0) return state
      return { ...state, pendingRecoverToDeck: { playerIndex: idx, remaining: Math.min(effect.count, p.discard.length), chosen: [] } }
    }
    case 'WOLF_PACK_DISCARD': {
      // Meute de Loups (onPlace) : défausse un Objet ou une carte Macaques du lieu d'arrivée.
      const loc = ctx?.hostLocationId
      if (!loc) return state
      const p = state.players[idx]
      const target = (p.board[loc] ?? []).find((c) => (c.type === 'item' && !c.attachedTo) || c.cardId === 'macaques')
      if (!target) return { ...state, log: [...state.log, `Meute de Loups : rien à défausser sur ce lieu.`] }
      const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === target.instanceId)
      const removed = new Set([target.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board: { ...pl.board, [loc]: (pl.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) }, discard: [...pl.discard, target, ...attached.map((c) => ({ ...c, attachedTo: undefined }))] }))
      return { ...next, log: [...next.log, `Meute de Loups défausse **${target.name}**.`] }
    }
    case 'BUFF_HEROES_AT_LOCATION': {
      // C'est mon ami (Fatalité) : +`amount` Force à tous les Héros du lieu portant le plus
      // de Héros (auto ; priorité au lieu de Mowgli s'il y est).
      const p = state.players[idx]
      let best: string | undefined
      let bestN = 0
      for (const loc of p.locations) {
        const heroes = (p.board[loc.id] ?? []).filter((c) => c.type === 'hero')
        const hasMowgli = heroes.some((h) => h.cardId === 'mowgli')
        const n = heroes.length + (hasMowgli ? 10 : 0)
        if (n > bestN) { bestN = n; best = loc.id }
      }
      if (!best) return state
      const bestLoc = best
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board: { ...pl.board, [bestLoc]: (pl.board[bestLoc] ?? []).map((c) => (c.type === 'hero' ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) + effect.amount } : c)) } }))
      return { ...next, log: [...next.log, `C'est mon ami : +${effect.amount} Force aux Héros de **${p.locations.find((l) => l.id === bestLoc)?.name}**.`] }
    }
    // --- Davy Jones (Jetons Trésor) ----------------------------------------
    case 'PLACE_TREASURE_FACEDOWN': {
      // Pose un jeton Trésor face cachée sur un Héros sans trésor (choix interactif).
      const p = state.players[idx]
      if ((p.treasureReserve ?? []).length === 0) return { ...state, log: [...state.log, `Aucun jeton Trésor dans la réserve.`] }
      if (heroesWithoutTreasure(p).length === 0) return { ...state, log: [...state.log, `Aucun Héros sans trésor.`] }
      return { ...state, pendingPlaceTreasure: { playerIndex: idx } }
    }
    case 'REVEAL_TREASURE': {
      // Révèle un jeton Trésor face cachée sur un Héros (choix interactif). `atHostLocation`
      // (Bill le Bottier) : seulement les Héros du lieu de la carte porteuse.
      const p = state.players[idx]
      let cands = heroesWithFacedownTreasure(p)
      const hostLoc = ctx?.hostLocationId ?? ctx?.playDestination
      if (effect.atHostLocation && hostLoc) {
        cands = cands.filter((h) => findTreasureHero(p, h.instanceId)?.locationId === hostLoc)
      }
      if (cands.length === 0) return state
      return { ...state, pendingRevealTreasure: { playerIndex: idx, candidateIds: cands.map((c) => c.instanceId) } }
    }
    case 'MOVE_SWAP_TREASURE': {
      // Les amis deviennent des ennemis : déplace/échange un trésor entre Héros (interactif).
      const p = state.players[idx]
      if (heroesWithTreasure(p).length === 0 || realmHeroes(p).length < 2) return state
      return { ...state, pendingMoveSwapTreasure: { playerIndex: idx } }
    }
    case 'CURSE_TREASURE_CYCLE': {
      // Maudit sois-tu, Jack Sparrow (Fatalité, auto côté adversaire) : retire un trésor
      // (priorité aux révélés = annule la progression de Davy) → réserve, puis pose un
      // trésor face cachée sur un Héros sans trésor.
      const dj = state.players.findIndex(isDavyJones)
      if (dj < 0) return state
      let next = state
      const withT = heroesWithTreasure(next.players[dj])
      if (withT.length > 0) {
        const target = withT.find((h) => h.treasure?.faceUp) ?? withT[0]
        next = removeTreasureToReserve(next, dj, target.instanceId)
      }
      const without = heroesWithoutTreasure(next.players[dj])
      if (without.length > 0 && (next.players[dj].treasureReserve ?? []).length > 0) {
        next = placeFacedownTreasure(next, dj, without[0].instanceId)
      }
      return { ...next, log: [...next.log, `Maudit sois-tu, Jack Sparrow : un jeton Trésor est remélangé puis reposé face cachée.`] }
    }
    case 'FETCH_HERO_PLACE_TREASURE': {
      // As-tu peur de la mort ? : dévoile la pioche Fatalité jusqu'à un Héros, défausse les
      // cartes avant lui, le joue sur un lieu au choix (pendingFetchedHero), + trésor face cachée.
      const p = state.players[idx]
      const deck = p.fateDeck
      const hi = deck.findIndex((c) => c.type === 'hero')
      if (hi < 0) return { ...state, log: [...state.log, `As-tu peur de la mort ? : aucun Héros dans la pioche Fatalité.`] }
      const hero = deck[hi]
      const revealed = deck.slice(0, hi)
      const rest = deck.slice(hi + 1)
      const next = updatePlayer(state, idx, (pp) => ({ ...pp, fateDeck: rest, fateDiscard: [...pp.fateDiscard, ...revealed] }))
      return {
        ...next,
        pendingFetchedHero: { playerIndex: idx, hero, discarded: revealed, placeTreasureAfter: true },
        log: [...next.log, `As-tu peur de la mort ? : ${hero.name} est trouvé — choisissez son lieu.`],
      }
    }
    case 'MOVE_ANY_HERO_TO_ALLY': {
      // La Poursuite : déplace n'importe quel Héros vers un lieu où se trouve un ALLIÉ
      // (choix du Héros + lieu via pendingHeroRelocate, destinations = lieux avec Allié).
      const p = state.players[idx]
      const heroes = realmHeroes(p).map((h) => h.hero.instanceId)
      const allyLocs = p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'ally')).map((l) => l.id)
      if (heroes.length === 0 || allyLocs.length === 0) return state
      return {
        ...state,
        pendingHeroRelocate: { chooserIndex: idx, targetIndex: idx, candidateIds: heroes, anyLocation: true, allowedLocationIds: allyLocs },
      }
    }
    case 'WHERE_POINTS':
      // Où ça pointe-t-il ? (Fatalité) — déplacements de Héros : v1 non implémentés (texte seul).
      return state
    case 'WAKE_KRAKEN': {
      // Réveillez le Kraken ! : défausse un Allié (choix) puis joue Le Kraken gratuitement.
      const p = state.players[idx]
      const allies = p.locations.flatMap((l) => (p.board[l.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo))
      const krakenAvail = [...p.deck, ...p.discard].some((c) => c.cardId === 'le-kraken')
      if (allies.length === 0 || !krakenAvail || !p.pawnLocation) return state
      return { ...state, pendingWakeKraken: { playerIndex: idx } }
    }
    case 'CAP_POWER': {
      // L'amour de Calypso (Fatalité) : réduit le Pouvoir de Davy à `max`.
      const dj = state.players.findIndex(isDavyJones)
      if (dj < 0) return state
      if (state.players[dj].power <= effect.max) return state
      const next = updatePlayer(state, dj, (pl) => ({ ...pl, power: effect.max }))
      return { ...next, log: [...next.log, `L'amour de Calypso : le Pouvoir de ${next.players[dj].villainName} tombe à ${effect.max}.`] }
    }
    case 'RECOVER_N_FROM_DISCARD': {
      // Je considère cela comme un non : récupère `count` cartes au choix de la défausse.
      const p = state.players[idx]
      if (p.discard.length === 0) return state
      return {
        ...state,
        pendingRecover: {
          playerIndex: idx,
          candidateIds: p.discard.map((c) => c.instanceId),
          count: Math.min(effect.count, p.discard.length),
          label: 'Je considère cela comme un non : récupérez 2 cartes.',
        },
      }
    }
    case 'WILL_TURNER_DISCARD': {
      // Will Turner (Fatalité, à la pose) : défausse un Allié de force de base ≤ 2 de son lieu.
      const loc = ctx?.hostLocationId
      if (!loc) return state
      const p = state.players[idx]
      // Cible la plus PRÉCIEUSE (guide : « discard his most important Allies ») parmi les
      // Alliés de force ≤ 2 : Bill le Bottier (révèle les Trésors) en priorité ; Hadras en
      // DERNIER (le défausser RÉVÈLERAIT un Trésor → aiderait Davy).
      const WILL_TARGET_VALUE: Record<string, number> = {
        'bill-le-bottier': 5,
        clanker: 4,
        'le-second-maccus': 3,
        'equipage-hollandais': 2,
        hadras: 0,
      }
      const target = (p.board[loc] ?? [])
        .filter((c) => c.type === 'ally' && !c.attachedTo && (c.strength ?? 0) <= 2)
        .sort((a, b) => (WILL_TARGET_VALUE[b.cardId] ?? 1) - (WILL_TARGET_VALUE[a.cardId] ?? 1))[0]
      if (!target) return state
      const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === target.instanceId)
      const removeIds = new Set([target.instanceId, ...attached.map((c) => c.instanceId)])
      let next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [loc]: (pl.board[loc] ?? []).filter((c) => !removeIds.has(c.instanceId)) },
        discard: [...pl.discard, target, ...attached],
      }))
      next = { ...next, log: [...next.log, `Will Turner : **${target.name}** est défaussé.`] }
      // Si l'Allié défaussé est Hadras, il révèle un jeton Trésor.
      return triggerRevealOnAllyDiscard(next, idx, [target])
    }
    case 'VULTURES_MOVE': {
      // Vautours (Fatalité, onPlace) : déplacer un Héros co-localisé (priorité Mowgli) ET
      // les Vautours vers un autre lieu. Auto (fataliseur) : éloigner Mowgli des Alliés de
      // Shere Khan (lieu avec le moins de force d'Alliés) pour casser sa préparation.
      const host = ctx?.hostLocationId
      const vult = ctx?.hostInstanceId
      if (!host || !vult) return state
      const p = state.players[idx]
      const heroes = (p.board[host] ?? []).filter((c) => c.type === 'hero' && c.instanceId !== vult)
      const target = heroes.find((h) => h.cardId === 'mowgli') ?? heroes[0]
      if (!target) return { ...state, log: [...state.log, `Vautours : aucun autre Héros à déplacer.`] }
      const dest = leastAllyForceLocation(p, host)
      if (!dest) return state
      let next = relocateCard(state, idx, target.instanceId, host, dest)
      next = relocateCard(next, idx, vult, host, dest)
      return { ...next, log: [...next.log, `Vautours déplacent **${target.name}** et les Vautours vers ${findLocation(p, dest)?.name}.`] }
    }
    case 'BAGHEERA_SCATTER': {
      // Bagheera (Fatalité, onPlace) : déplacer chaque Héros et Allié de son lieu vers
      // d'autres lieux. Auto (fataliseur) : DISPERSER tout le lieu (round-robin) → sépare
      // Mowgli des Alliés et casse la force réunie de Shere Khan.
      const host = ctx?.hostLocationId
      if (!host) return state
      const p = state.players[idx]
      // Bagheera elle-même (l'hôte) ne se déplace PAS : elle disperse les AUTRES Héros/Alliés.
      const movers = (p.board[host] ?? []).filter(
        (c) => (c.type === 'hero' || c.type === 'ally') && !c.attachedTo && c.instanceId !== ctx?.hostInstanceId,
      )
      const dests = p.locations.map((l) => l.id).filter((id) => id !== host)
      if (movers.length === 0 || dests.length === 0) return state
      let next = state
      movers.forEach((c, i) => {
        next = relocateCard(next, idx, c.instanceId, host, dests[i % dests.length])
      })
      return { ...next, log: [...next.log, `Bagheera disperse les Héros et Alliés de ${findLocation(p, host)?.name}.`] }
    }
    case 'TIGER_BY_THE_TAIL': {
      // Prendre le tigre par la queue (Fatalité) : déplacer un Héros n'importe où (+ option
      // de bouger la figurine de Shere Khan, ignorée — elle l'aiderait). Auto (fataliseur) :
      // éloigner Mowgli (ou le plus fort) des Alliés de Shere Khan.
      const p = state.players[idx]
      const entries: { c: CardInstance; loc: LocationId }[] = []
      for (const loc of p.locations) for (const c of p.board[loc.id] ?? []) if (c.type === 'hero') entries.push({ c, loc: loc.id })
      const pick = entries.find((e) => e.c.cardId === 'mowgli') ?? entries.sort((a, b) => (b.c.strength ?? 0) - (a.c.strength ?? 0))[0]
      if (!pick) return { ...state, log: [...state.log, `Prendre le tigre par la queue : aucun Héros à déplacer.`] }
      const dest = leastAllyForceLocation(p, pick.loc)
      if (!dest) return state
      const next = relocateCard(state, idx, pick.c.instanceId, pick.loc, dest)
      return { ...next, log: [...next.log, `Prendre le tigre par la queue : **${pick.c.name}** est déplacé vers ${findLocation(p, dest)?.name}.`] }
    }
    case 'REVEAL_FATE_PLAY_IF_EVENT': {
      // La Patrouille de la Jungle (Fatalité, onPlace) : dévoile le dessus de la pioche
      // Fatalité ; si c'est un Événement, joue-le ; sinon, le laisse sur la pioche.
      const p = state.players[idx]
      const top = p.fateDeck[0]
      if (!top) return { ...state, log: [...state.log, `La Patrouille de la Jungle : pioche Fatalité vide.`] }
      if (top.type !== 'effect') {
        return { ...state, log: [...state.log, `La Patrouille de la Jungle : **${top.name}** n'est pas un Événement, elle reste sur la pioche.`] }
      }
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDeck: pl.fateDeck.slice(1) }))
      next = { ...next, log: [...next.log, `La Patrouille de la Jungle joue **${top.name}**.`] }
      next = resolveEffects(next, top.effects ?? [], { actorIndex: idx })
      return updatePlayer(next, idx, (pl) => ({ ...pl, fateDiscard: [...pl.fateDiscard, top] }))
    }
    case 'MEDAL_PLAY_FATE_HERO': {
      // Médaille de Vanellope (Fatalité) : le fataliseur choisit un Héros de la défausse
      // Fatalité de Sa Sucrerie et le jouera (+1 Force) sur le lieu de son choix.
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const heroes = state.players[kc].fateDiscard.filter((c) => c.type === 'hero')
      if (heroes.length === 0) return { ...state, log: [...state.log, `Médaille de Vanellope : aucun Héros en défausse Fatalité.`] }
      return {
        ...state,
        pendingMedal: { playerIndex: kc, chooserIndex: state.activePlayer, kind: 'pick-hero', heroIds: heroes.map((c) => c.instanceId) },
        log: [...state.log, `Médaille de Vanellope : ${state.players[state.activePlayer].villainName} choisit un Héros à rejouer (+1 Force).`],
      }
    }
    case 'BEACON_GATHER_CYBUGS': {
      // Le Faisceau (Fatalité) : le fataliseur choisit un lieu (parmi ceux qui portent un
      // Cybug ou dont un voisin en porte) où rassembler les Cybugs voisins. Adjacence
      // calculée sur les ZONES de Sa Sucrerie (pas du fataliseur actif).
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const p = state.players[kc]
      const zones = cardLocationIds(p)
      const isCybug = (c: CardInstance) => c.cardId === 'cybug-en-sucre' && c.type === 'ally' && !c.attachedTo
      const hasCybug = (locId: string) => (p.board[locId] ?? []).some(isCybug)
      const neighbors = (locId: string): string[] => {
        const i = zones.indexOf(locId)
        return i < 0 ? [] : [zones[i - 1], zones[i + 1]].filter((id): id is string => !!id)
      }
      const valid = zones.filter((id) => hasCybug(id) || neighbors(id).some(hasCybug))
      if (valid.length === 0) return state
      return {
        ...state,
        pendingBeacon: { playerIndex: kc, chooserIndex: state.activePlayer, kind: 'pick-location', locationIds: valid },
        log: [...state.log, `Le Faisceau : ${state.players[state.activePlayer].villainName} choisit un lieu où rassembler les Cybugs en Sucre.`],
      }
    }
    case 'NIVEAU_INACHEVE': {
      // Niveau Inachevé (Fatalité) : dévoile les 4 premières cartes de la pioche Méchant ;
      // le fataliseur (activePlayer) en place 2 dessus et 2 dessous, dans l'ordre choisi.
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const top4 = state.players[kc].deck.slice(0, 4)
      if (top4.length === 0) return state
      const next = updatePlayer(state, kc, (pl) => ({ ...pl, deck: pl.deck.slice(top4.length) }))
      return {
        ...next,
        pendingFateReorder: { playerIndex: kc, chooserIndex: state.activePlayer, cards: top4, deck: 'villain-split2' },
        log: [...next.log, `Niveau Inachevé : ${state.players[state.activePlayer].villainName} réorganise le dessus/dessous de la pioche Méchant.`],
      }
    }
    case 'KING_CANDY_PAWN_BACK_CHOICE': {
      // Princesse Vanellope (Fatalité) : le fataliseur (activePlayer) recule le pion King
      // Candy de 0 à min(max, trackPos). Sans recul possible (pion à Départ/Arrivée) → no-op.
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const max = Math.min(effect.max, state.players[kc].trackPos ?? 0)
      if (max < 1) return { ...state, log: [...state.log, `Princesse Vanellope : le pion est déjà à Départ/Arrivée.`] }
      return { ...state, pendingPawnBack: { playerIndex: kc, chooserIndex: state.activePlayer, max } }
    }
    case 'RELOCATE_FATE_TARGET_HERO': {
      // Fatalité (onPlace) : le FATALISEUR (state.activePlayer) peut déplacer le Héros
      // `heroCardId` (Vanellope) du royaume fatalisé (idx) vers le lieu de son choix.
      const me = state.players[idx]
      const target = Object.values(me.board).flat().find((c) => c.type === 'hero' && c.cardId === effect.heroCardId)
      if (!target) return state
      return {
        ...state,
        pendingHeroRelocate: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          candidateIds: [target.instanceId],
          anyLocation: true,
          optional: true,
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} peut déplacer **${target.name}** vers le lieu de son choix.`],
      }
    }
    case 'RACE_BAN': {
      // Il lui est défendu de courir : recule le Pilote de 3 (si course), puis (si Allié
      // ET Héros) ouvre le déplacement libre d'Alliés (vers le lieu d'un Héros), chaîné à
      // un Vanquish facultatif gardant les Alliés.
      let next = state
      const me = next.players[idx]
      if (me.villain === 'sa-sucrerie' && me.raceActive && me.racerPos != null) {
        next = moveRacerBack(next, idx, 3)
      }
      const allies = Object.values(next.players[idx].board)
        .flat()
        .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
      const hasHero = Object.values(next.players[idx].board).flat().some((c) => c.type === 'hero')
      if (allies.length > 0 && hasHero) {
        next = {
          ...next,
          pendingAllyRelocate: {
            chooserIndex: idx,
            targetIndex: idx,
            remaining: allies.length,
            optional: true,
            title: 'Il lui est défendu de courir',
            thenRaceBanVanquish: true,
          },
          log: [...next.log, `${next.players[idx].villainName} : déplacez des Alliés vers un Héros, puis éliminez-le (Alliés conservés).`],
        }
      }
      return next
    }
    case 'KING_CANDY_ADVANCE_RACER_BY_REVEAL': {
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      // Enfin un vrai Kart ! : bonus +1 (Vanellope, au début du tour, utilise +2 par défaut).
      return kc < 0 ? state : advanceRacerByReveal(state, kc, effect.bonus ?? 2)
    }
    case 'KING_CANDY_ADVANCE_RACER': {
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      return kc < 0 ? state : advanceRacer(state, kc, effect.amount)
    }
    case 'KING_CANDY_MOVE_RACER_BACK': {
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      return kc < 0 ? state : moveRacerBack(state, kc, effect.amount)
    }
    case 'KING_CANDY_MOVE_TRACK': {
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      return kc < 0 ? state : moveKingCandyTrack(state, kc, effect.steps)
    }
    case 'KING_CANDY_TURBO': {
      const kc = state.players.findIndex((p) => p.villain === 'sa-sucrerie')
      if (kc < 0) return state
      const next = updatePlayer(state, kc, (p) => ({ ...p, turboUncoverThisTurn: true }))
      return { ...next, log: [...next.log, `Turbo-Statique : ${next.players[kc].villainName} peut utiliser ses 3 actions accessibles ce tour, même recouvertes.`] }
    }
    // --- Syndrome -----------------------------------------------------------
    case 'REVEAL_FATE_HERO_AT_PAWN': {
      // Mirage : dévoile la pioche Fatalité jusqu'au 1er Héros, le joue sur le MÊME LIEU
      // que Mirage (sa destination de pose, `playDestination`), défausse les autres.
      // 15 ans plus tard (Condition, sans destination de pose) : sur le lieu du pion.
      const actor0 = state.players[idx]
      const name = actor0.villainName
      const dest = ctx?.playDestination ?? actor0.pawnLocation ?? actor0.locations[0].id
      // Dévoile UNE carte à la fois et S'ARRÊTE au 1er Héros (ne vide pas la pioche !).
      let deck = actor0.fateDeck
      let disc = actor0.fateDiscard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let hero: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const rr = shuffle(disc, s)
          deck = rr.result
          s = rr.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === 'hero') { hero = top; break }
      }
      const others = revealed.filter((c) => c !== hero)
      let next = updatePlayer({ ...state, rngState: s }, idx, (pl) => ({ ...pl, fateDeck: deck, fateDiscard: disc }))
      if (!hero) {
        // Aucun Héros dans toute la pioche : les cartes dévoilées sont défaussées.
        next = updatePlayer(next, idx, (pl) => ({ ...pl, fateDiscard: [...pl.fateDiscard, ...others] }))
        return { ...next, log: [...next.log, `${name} : aucun Héros dans la pioche Fatalité à dévoiler.`] }
      }
      // Le Héros est joué ; les AUTRES cartes dévoilées (avant lui) vont en défausse.
      next = updatePlayer(next, idx, (pl) => ({
        ...pl,
        fateDiscard: [...pl.fateDiscard, ...others],
        board: { ...pl.board, [dest]: [...(pl.board[dest] ?? []), hero] },
      }))
      next = triggerHeroArrival(next, idx, dest)
      return { ...next, log: [...next.log, `${name} dévoile et joue **${hero.name}** sur **${locName(next.players[idx], dest)}**.`] }
    }
    case 'REVEAL_FATE_HERO_CHOOSE_LOC': {
      // 15 ans plus tard : dévoile la pioche Fatalité jusqu'au 1er Héros ; à JOUER sur le
      // lieu de son choix (pendingFetchedHero), force réduite de `weakenBy`. Autres défaussées.
      const actor0 = state.players[idx]
      let deck = actor0.fateDeck
      let disc = actor0.fateDiscard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let hero: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === 'hero') { hero = top; break }
      }
      const others = revealed.filter((c) => c !== hero)
      let next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: deck, fateDiscard: disc }))
      next = { ...next, rngState: s }
      if (!hero) {
        return {
          ...next,
          players: next.players.map((p, i) => (i === idx ? { ...p, fateDiscard: [...p.fateDiscard, ...others] } : p)),
          log: [...next.log, `${actor0.villainName} : aucun Héros dans la pioche Fatalité (15 ans plus tard).`],
        }
      }
      // On garde la force de BASE intacte et on applique un modificateur PERMANENT (−2) :
      // ainsi force effective ≠ base → l'UI affiche le badge « force modifiée ».
      const weakened =
        effect.weakenBy && effect.weakenBy > 0
          ? { ...hero, permanentStrengthDelta: (hero.permanentStrengthDelta ?? 0) - effect.weakenBy }
          : hero
      return {
        ...next,
        pendingFetchedHero: { playerIndex: idx, hero: weakened, discarded: others },
        log: [
          ...next.log,
          `${actor0.villainName} (15 ans plus tard) dévoile **${hero.name}**${effect.weakenBy ? ` (force −${effect.weakenBy})` : ''} : à jouer sur le lieu de votre choix.`,
        ],
      }
    }
    case 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION': {
      // Identification, je vous prie : CHOIX interactif — déplace un Allié/Objet (non
      // associé) vers un lieu portant ≥1 Héros. On ouvre le pending ; l'humain choisit via
      // la modale, le bot auto-résout (App.tsx / enumerate). Injouable garde-fou en amont.
      const p = state.players[idx]
      const heroLocs = p.locations.map((l) => l.id).filter((id) => (p.board[id] ?? []).some((c) => c.type === 'hero'))
      // L'Omnidroïde (immuneToAllyItemEffects) reste déplaçable : ce flag protège des effets
      // ADVERSES, mais Identification est la propre carte de Syndrome (déplacer son Allié est légitime).
      const movable = Object.values(p.board).flat().some((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket)
      if (heroLocs.length === 0 || !movable) {
        return { ...state, log: [...state.log, `${p.villainName} (Identification) : aucun déplacement possible.`] }
      }
      return {
        ...state,
        pendingIdentification: { playerIndex: idx },
        log: [...state.log, `${p.villainName} (Identification, je vous prie) : choisissez un Allié/Objet à déplacer vers un lieu portant un Héros.`],
      }
    }
    case 'GAIN_POWER_EQUAL_LAST_PLAYED_COST': {
      // Qui est le plus super ? : gagne autant de Pouvoir que le coût de la dernière carte
      // jouée par l'adversaire (0 si elle coûtait 0).
      const amount = state.lastPlayedCardCost ?? 0
      if (amount <= 0) {
        return { ...state, log: [...state.log, `${state.players[idx].villainName} : Qui est le plus super ? — la carte jouée coûtait 0 (aucun Pouvoir gagné).`] }
      }
      return resolveEffect(state, { type: 'GAIN_POWER', amount }, { actorIndex: idx })
    }
    case 'REDUCE_HERO_FORCE_TO_ZERO': {
      // Unité de Confinement : réduit la force d'un Héros à 0 (auto : le plus fort).
      const p = state.players[idx]
      const heroes: { c: CardInstance; loc: LocationId }[] = []
      for (const l of p.locations) for (const c of p.board[l.id] ?? []) if (c.type === 'hero' && !c.forceZeroed) heroes.push({ c, loc: l.id })
      if (heroes.length === 0) return { ...state, log: [...state.log, `${p.villainName} (Unité de Confinement) : aucun Héros à neutraliser.`] }
      const target = heroes.sort((a, b) => (b.c.strength ?? 0) - (a.c.strength ?? 0))[0]
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [target.loc]: (pl.board[target.loc] ?? []).map((c) => (c.instanceId === target.c.instanceId ? { ...c, forceZeroed: true } : c)) },
      }))
      return { ...next, log: [...next.log, `${p.villainName} réduit la force de **${target.c.name}** à 0 (Unité de Confinement).`] }
    }
    case 'DEFEAT_REALM_HERO_AUTO': {
      // Sonde Bio : élimine un Héros du royaume de force ≤ celle du dernier Héros vaincu
      // par l'adversaire (auto : le plus fort éligible). Va en défausse Fatalité.
      const p = state.players[idx]
      const maxStr = effect.useLastVanquishStrength ? state.lastVanquishedHeroStrength ?? Infinity : Infinity
      const heroes: { c: CardInstance; loc: LocationId }[] = []
      for (const l of p.locations) for (const c of p.board[l.id] ?? []) {
        if (c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) <= maxStr) heroes.push({ c, loc: l.id })
      }
      if (heroes.length === 0) return { ...state, log: [...state.log, `${p.villainName} (Sonde Bio) : aucun Héros éligible à éliminer.`] }
      const target = heroes.sort((a, b) => (b.c.strength ?? 0) - (a.c.strength ?? 0))[0]
      const attachedIds = new Set((p.board[target.loc] ?? []).filter((c) => c.attachedTo === target.c.instanceId).map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [target.loc]: (pl.board[target.loc] ?? []).filter((c) => c.instanceId !== target.c.instanceId && !attachedIds.has(c.instanceId)) },
        fateDiscard: [...pl.fateDiscard, { ...target.c, attachedTo: undefined }],
      }))
      return { ...next, log: [...next.log, `${p.villainName} élimine **${target.c.name}** (Sonde Bio).`] }
    }
    case 'DISCARD_VILLAIN_BOARD_EXCEPT': {
      // Alors ça, c'est un truc de dingue ! : défausse tous les Alliés et Objets du
      // royaume, sauf ceux de `exceptCardId` (Champ de Force) et leurs hôtes protégés.
      // L'Omnidroïde est une TUILE hors deck : il n'est PAS défaussé (ne doit pas rejoindre
      // la pioche/défausse Vilain), il reste sur le plateau.
      const p = state.players[idx]
      const protectedHosts = new Set<string>()
      for (const l of p.locations) for (const c of p.board[l.id] ?? []) if (c.cardId === effect.exceptCardId && c.attachedTo) protectedHosts.add(c.attachedTo)
      const removed: CardInstance[] = []
      const board: typeof p.board = {}
      for (const l of p.locations) {
        board[l.id] = (p.board[l.id] ?? []).filter((c) => {
          const keep = c.type === 'hero' || c.immuneToAllyItemEffects || c.cardId === effect.exceptCardId || protectedHosts.has(c.instanceId) || (c.attachedTo && protectedHosts.has(c.attachedTo))
          if (!keep && (c.type === 'ally' || c.type === 'item')) { removed.push({ ...c, attachedTo: undefined }); return false }
          return true
        })
      }
      if (removed.length === 0) return { ...state, log: [...state.log, `${p.villainName} : rien à défausser (Alors ça, c'est un truc de dingue !).`] }
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board, discard: [...pl.discard, ...removed] }))
      return { ...next, log: [...next.log, `Alors ça, c'est un truc de dingue ! : ${removed.length} carte${removed.length > 1 ? 's' : ''} du royaume de ${p.villainName} défaussée${removed.length > 1 ? 's' : ''}.`] }
    }
    case 'DISCARD_ALL_OF_CARDID_IN_REALM': {
      // Violette : défausse toutes les cartes `cardId` du royaume (Énergie au Point Zéro).
      const p = state.players[idx]
      const removed: CardInstance[] = []
      const board: typeof p.board = {}
      for (const l of p.locations) {
        board[l.id] = (p.board[l.id] ?? []).filter((c) => {
          if (c.cardId === effect.cardId) { removed.push({ ...c, attachedTo: undefined }); return false }
          return true
        })
      }
      if (removed.length === 0) return state
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board, discard: [...pl.discard, ...removed] }))
      return { ...next, log: [...next.log, `${removed.length} carte${removed.length > 1 ? 's' : ''} défaussée${removed.length > 1 ? 's' : ''} du royaume de ${p.villainName} (Violette).`] }
    }
    case 'ATTACH_REMOTE_IF_IN_REALM': {
      // Effet commun (Indestructibles + Frozone) : si la Télécommande est dans le royaume
      // (non associée), le Héros qui arrive la « vole » (associée à lui, sur son lieu).
      const host = ctx?.hostInstanceId
      const hostLoc = ctx?.hostLocationId
      if (!host || !hostLoc) return state
      const p = state.players[idx]
      let remote: CardInstance | undefined
      for (const l of p.locations) {
        const c = (p.board[l.id] ?? []).find((x) => x.cardId === 'telecommande-de-syndrome' && !x.attachedTo)
        if (c) { remote = c; break }
      }
      if (!remote) return state
      const heroName = (p.board[hostLoc] ?? []).find((c) => c.instanceId === host)?.name ?? 'Le Héros'
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: Object.fromEntries(
          pl.locations.map((l) => {
            let cards = (pl.board[l.id] ?? []).filter((c) => c.instanceId !== remote!.instanceId)
            if (l.id === hostLoc) cards = [...cards, { ...remote!, attachedTo: host }]
            return [l.id, cards]
          }),
        ),
      }))
      return { ...next, log: [...next.log, `**${heroName}** s'empare de la **Télécommande de Syndrome** (associée à lui) !`] }
    }
    case 'DISCARD_ONE_ALLY_AT_HOST': {
      // Elastigirl : défausse UN Allié (auto : le plus fort) sur le lieu hôte. L'Omnidroïde
      // (immuneToAllyItemEffects) est épargné.
      if (!ctx?.hostLocationId) return state
      const loc = ctx.hostLocationId
      const p = state.players[idx]
      const allies = (p.board[loc] ?? []).filter((c) => c.type === 'ally' && !c.immuneToAllyItemEffects && !c.attachedTo)
      if (allies.length === 0) return state
      const target = [...allies].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
      const attachedIds = new Set((p.board[loc] ?? []).filter((c) => c.attachedTo === target.instanceId).map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [loc]: (pl.board[loc] ?? []).filter((c) => c.instanceId !== target.instanceId && !attachedIds.has(c.instanceId)) },
        discard: [...pl.discard, { ...target, attachedTo: undefined }, ...(p.board[loc] ?? []).filter((c) => attachedIds.has(c.instanceId)).map((c) => ({ ...c, attachedTo: undefined }))],
      }))
      return { ...next, log: [...next.log, `Elastigirl : **${target.name}** est défaussé du royaume de ${p.villainName}.`] }
    }
    case 'MOVE_HERO_TO_HOST': {
      // Flèche : déplace UN Héros (auto : le 1er d'un AUTRE lieu) vers le lieu hôte.
      if (!ctx?.hostLocationId) return state
      const loc = ctx.hostLocationId
      const p = state.players[idx]
      let moved: { c: CardInstance; from: LocationId } | undefined
      for (const l of p.locations) {
        if (l.id === loc) continue
        const h = (p.board[l.id] ?? []).find((c) => c.type === 'hero' && c.instanceId !== ctx?.hostInstanceId)
        if (h) { moved = { c: h, from: l.id }; break }
      }
      if (!moved) return state
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: {
          ...pl.board,
          [moved!.from]: (pl.board[moved!.from] ?? []).filter((c) => c.instanceId !== moved!.c.instanceId),
          [loc]: [...(pl.board[loc] ?? []), moved!.c],
        },
      }))
      return { ...next, log: [...next.log, `Flèche : **${moved.c.name}** est déplacé vers **${locName(next.players[idx], loc)}**.`] }
    }
    case 'REVEAL_HAND': {
      const p = state.players[idx]
      return { ...state, log: [...state.log, `${p.villainName} révèle sa main (Intrusion).`] }
    }
    case 'TARGET_DISCARD_CHOICE': {
      // Monologue : la cible défausse `count` cartes de sa main AU CHOIX. On ouvre la
      // défausse interactive (pendingTyrannyDiscard) ; rien si la main est vide.
      const p = state.players[idx]
      const lbl = effect.label ?? 'Monologue'
      const n = Math.min(effect.count, p.hand.length)
      if (n === 0) return { ...state, log: [...state.log, `${p.villainName} : main vide (${lbl}).`] }
      return {
        ...state,
        pendingTyrannyDiscard: { playerIndex: idx, count: n, label: lbl },
        log: [...state.log, `${p.villainName} doit défausser ${n} carte${n > 1 ? 's' : ''} de sa main (${lbl}).`],
      }
    }
    // --- Lotso (Toy Story 3) ---------------------------------------------------
    case 'LOTSO_REVEAL_HERO': {
      // Big Baby (hors Salle) / Bienvenue à Sunnyside (sur la Salle) : dévoile la pioche
      // Fatalité jusqu'au 1er Héros, le joue, défausse le reste.
      const p0 = state.players[idx]
      const roomId = p0.objective.type === 'LOTSO_GATHER' ? p0.objective.roomId : p0.locations[0].id
      let deck = p0.fateDeck, disc = p0.fateDiscard, s = state.rngState
      const revealed: CardInstance[] = []
      let hero: CardInstance | undefined
      while (true) {
        if (deck.length === 0) { if (disc.length === 0) break; const r = shuffle(disc, s); deck = r.result; s = r.state; disc = [] }
        const [top, ...rest] = deck; deck = rest; revealed.push(top)
        if (top.type === 'hero') { hero = top; break }
      }
      const others = revealed.filter((c) => c !== hero)
      let next = updatePlayer({ ...state, rngState: s }, idx, (pl) => ({ ...pl, fateDeck: deck, fateDiscard: [...disc, ...others] }))
      if (!hero) return { ...next, log: [...next.log, `${p0.villainName} : aucun Héros dans la pioche Fatalité.`] }
      // Bienvenue à Sunnyside : pose FORCÉE sur la Salle des Chenilles.
      if (effect.atRoom) {
        next = updatePlayer(next, idx, (pl) => ({ ...pl, board: { ...pl.board, [roomId]: [...(pl.board[roomId] ?? []), hero!] } }))
        next = triggerHeroArrival(next, idx, roomId)
        return { ...next, log: [...next.log, `${p0.villainName} joue **${hero.name}** sur **${locName(next.players[idx], roomId)}**.`] }
      }
      // Big Baby : le joueur CHOISIT le lieu (n'importe lequel SAUF la Salle des Chenilles).
      // On réutilise pendingHeroPlacement (modale + auto-bot + onPlace via placeFateHeroWithEffects).
      const heroToPlace: CardInstance = { ...hero, forbiddenLocations: [...(hero.forbiddenLocations ?? []), roomId] }
      const validLocs = heroPlacementLocations(next, heroToPlace, idx)
      if (validLocs.length === 0) {
        next = updatePlayer(next, idx, (pl) => ({ ...pl, fateDiscard: [...pl.fateDiscard, hero!] }))
        return { ...next, log: [...next.log, `${p0.villainName} : aucun lieu disponible pour **${hero.name}**.`] }
      }
      return {
        ...next,
        pendingHeroPlacement: { chooserIndex: idx, targetIndex: idx, hero: heroToPlace },
        log: [...next.log, `${p0.villainName} (Big Baby) : choisissez le lieu où jouer **${hero.name}** (hors Salle des Chenilles).`],
      }
    }
    case 'LOTSO_REDUCE': {
      // Réduit la force de Héros via des jetons −1 (permanentStrengthDelta). Rex protégé
      // (avec un autre Héros) n'est pas réductible. Buzz n'est pas un Héros.
      const p1 = state.players[idx]
      const roomId = p1.objective.type === 'LOTSO_GATHER' ? p1.objective.roomId : p1.locations[0].id
      const eligible: { c: CardInstance; loc: LocationId }[] = []
      for (const l of p1.locations) {
        if (effect.scope === 'room' && l.id !== roomId) continue
        if (effect.scope === 'not-room' && l.id === roomId) continue
        if (effect.scope === 'at-pawn' && l.id !== p1.pawnLocation) continue
        for (const c of p1.board[l.id] ?? []) {
          if (c.type !== 'hero') continue
          const str = effectiveStrength(state, idx, c.instanceId) ?? 0
          if (str <= 0) continue
          // Rex protégé : non réductible tant qu'il partage son lieu avec un autre Héros.
          if (c.protectedWithOtherHero && (p1.board[l.id] ?? []).some((x) => x.type === 'hero' && x.instanceId !== c.instanceId)) continue
          eligible.push({ c, loc: l.id })
        }
      }
      if (eligible.length === 0) return { ...state, log: [...state.log, `${p1.villainName} : aucun Héros à réduire.`] }
      // target 'one' : CHOIX interactif du Héros (pending ; auto-résolu pour le bot). Une
      // seule cible → on résout directement ; aucune → no-op (déjà géré).
      if (effect.target === 'one') {
        if (eligible.length === 1) return lotsoReduceHero(state, idx, eligible[0].c.instanceId, effect.amount, effect.toZero)
        return {
          ...state,
          pendingLotsoTarget: {
            playerIndex: idx,
            kind: 'reduce',
            candidateIds: eligible.map((e) => e.c.instanceId),
            amount: effect.amount,
            toZero: effect.toZero,
            label: effect.toZero ? 'Réduire un Héros à 0' : `Réduire un Héros de ${effect.amount ?? 1}`,
          },
          log: [...state.log, `${p1.villainName} : choisissez le Héros à réduire.`],
        }
      }
      // target 'all' : réduit tous les Héros éligibles (pas de choix).
      const roomCount = (p1.board[roomId] ?? []).filter((c) => c.type === 'hero').length
      const ids = new Map(eligible.map((t) => [t.c.instanceId, effect.toZero ? (effectiveStrength(state, idx, t.c.instanceId) ?? 0) : effect.byRoomCount ? roomCount : (effect.amount ?? 1)]))
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).map((c) => ids.has(c.instanceId) ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) - (ids.get(c.instanceId) ?? 0) } : c)])),
      }))
      return { ...next, log: [...next.log, `${p1.villainName} réduit la force de ${eligible.length} Héros.`] }
    }
    case 'LOTSO_BOOKWORM': {
      // Le Bibliothécaire (coût variable) : ouvre la répartition interactive. Le joueur
      // dépensera 1 Pouvoir par −1 de force, ventilés entre les Héros de son choix.
      const pb = state.players[idx]
      if (pb.power < 1 || lotsoReducibleHeroes(state, idx).length === 0) {
        return { ...state, log: [...state.log, `${pb.villainName} (Le Bibliothécaire) : aucune réduction possible.`] }
      }
      return {
        ...state,
        pendingLotsoBookworm: { playerIndex: idx, spent: 0 },
        log: [...state.log, `${pb.villainName} (Le Bibliothécaire) : répartissez vos jetons Pouvoir en réductions de force (−1 par jeton).`],
      }
    }
    case 'LOTSO_MOVE': {
      // Déplacements de Héros (et Buzz) vers/depuis la Salle des Chenilles.
      const p2 = state.players[idx]
      const roomId = p2.objective.type === 'LOTSO_GATHER' ? p2.objective.roomId : p2.locations[0].id
      const otherLocs = p2.locations.map((l) => l.id).filter((id2) => id2 !== roomId)
      const findLocOf = (pl: typeof p2, instId: string) => pl.locations.find((l) => (pl.board[l.id] ?? []).some((c) => c.instanceId === instId))?.id
      const move = (pl: typeof p2, instId: string, to: LocationId) => {
        const from = findLocOf(pl, instId)
        if (!from || from === to) return pl
        const card = (pl.board[from] ?? []).find((c) => c.instanceId === instId)!
        const attached = (pl.board[from] ?? []).filter((c) => c.attachedTo === instId)
        const ids = new Set([instId, ...attached.map((c) => c.instanceId)])
        return { ...pl, board: { ...pl.board, [from]: (pl.board[from] ?? []).filter((c) => !ids.has(c.instanceId)), [to]: [...(pl.board[to] ?? []), card, ...attached] } }
      }
      let next: GameState
      if (effect.scope === 'all-to-room') {
        const heroes = p2.locations.flatMap((l) => l.id === roomId ? [] : (p2.board[l.id] ?? []).filter((c) => c.type === 'hero').map((c) => c.instanceId))
        next = updatePlayer(state, idx, (pl) => heroes.reduce((acc, hid) => move(acc, hid, roomId), pl))
        return { ...next, log: [...next.log, `${p2.villainName} : tous les Héros rejoignent la Salle des Chenilles.`] }
      }
      if (effect.scope === 'to-room') {
        // CHOIX interactif : un Héros HORS Salle, ou la tuile Buzz (si includeBuzz) hors Salle.
        const buzzInRoom = (p2.board[roomId] ?? []).some((c) => c.isBuzz)
        const candidates: string[] = []
        for (const l of otherLocs) for (const c of p2.board[l] ?? []) {
          if (c.type === 'hero') candidates.push(c.instanceId)
          else if (effect.includeBuzz && c.isBuzz && !buzzInRoom) candidates.push(c.instanceId)
        }
        if (candidates.length === 0) return { ...state, log: [...state.log, `${p2.villainName} : rien à déplacer vers la Salle des Chenilles.`] }
        if (candidates.length === 1) return lotsoMoveToRoom(state, idx, candidates[0])
        return {
          ...state,
          pendingLotsoTarget: { playerIndex: idx, kind: 'move-to-room', candidateIds: candidates, label: 'Déplacer un Héros ou Buzz sur la Salle des Chenilles' },
          log: [...state.log, `${p2.villainName} : choisissez qui déplacer sur la Salle des Chenilles.`],
        }
      }
      if (effect.scope === 'from-room') {
        const hero = (p2.board[roomId] ?? []).find((c) => c.type === 'hero')
        if (!hero) return state
        const to = otherLocs[0]
        next = updatePlayer(state, idx, (pl) => move(pl, hero.instanceId, to))
        return { ...next, log: [...next.log, `**${hero.name}** quitte la Salle des Chenilles pour **${locName(next.players[idx], to)}**.`] }
      }
      // from-host (Flex) : déplace un Héros (ou Buzz) du lieu hôte vers un autre lieu.
      const hostLoc = ctx?.playDestination ?? ctx?.hostLocationId ?? p2.pawnLocation
      if (!hostLoc) return state
      const cand = (p2.board[hostLoc] ?? []).find((c) => c.type === 'hero' || (effect.includeBuzz && c.isBuzz))
      if (!cand) return { ...state, log: [...state.log, `${p2.villainName} (Flex) : aucun Héros/Gardien à déplacer.`] }
      const to = p2.locations.map((l) => l.id).find((id2) => id2 !== hostLoc) ?? hostLoc
      next = updatePlayer(state, idx, (pl) => move(pl, cand.instanceId, to))
      return { ...next, log: [...next.log, `${p2.villainName} (Flex) déplace **${cand.name}** vers **${locName(next.players[idx], to)}**.`] }
    }
    case 'LOTSO_FLIP_BUZZ': {
      // Retourne la tuile Buzz (Gardien ↔ Démo) et la déplace.
      const p3 = state.players[idx]
      let buzzLoc: LocationId | undefined
      for (const l of p3.locations) if ((p3.board[l.id] ?? []).some((c) => c.isBuzz)) { buzzLoc = l.id; break }
      if (!buzzLoc) return state
      const guardian = effect.to === 'guardian'
      // Mode Démo (Réinitialisation) : Buzz est retourné SUR PLACE, puis le joueur choisit
      // le lieu (n'importe lequel) où le déplacer en zone basse → pending interactif.
      // Mode Gardien (Mode espagnol, Fatalité adverse) : destination forcée (haut de la Cour).
      const dest = guardian ? (effect.moveTo === 'cour-top' ? 'cour-de-recreation' : buzzLoc) : buzzLoc
      let next = updatePlayer(state, idx, (pl) => {
        const buzz = (pl.board[buzzLoc!] ?? []).find((c) => c.isBuzz)!
        const flipped: CardInstance = { ...buzz, buzzMode: effect.to, cardId: guardian ? 'buzz-l-eclair' : 'buzz-mode-demo', name: guardian ? 'Buzz l’Éclair' : 'Buzz l’Éclair en mode démo', strength: guardian ? 4 : 1 }
        // On retire d'abord l'ancienne tuile de son lieu, PUIS on ajoute la retournée à `dest`
        // (gère le cas dest === buzzLoc sans dupliquer la tuile).
        const stripped = { ...pl.board, [buzzLoc!]: (pl.board[buzzLoc!] ?? []).filter((c) => !c.isBuzz) }
        return { ...pl, board: { ...stripped, [dest]: [...(stripped[dest] ?? []), flipped] } }
      })
      if (guardian) {
        // Mode Espagnol → si Jessie en jeu, +1 à Jessie.
        next = updatePlayer(next, idx, (pl) => ({ ...pl, board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).map((c) => c.cardId === 'jessie' ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) + 1 } : c)])) }))
        return { ...next, log: [...next.log, `Buzz l’Éclair passe en mode Gardien et rejoint **${locName(next.players[idx], dest)}**.`] }
      }
      // Démo : ouvre le choix du lieu de destination (le bot l'auto-résout).
      const buzzInst = (next.players[idx].board[buzzLoc] ?? []).find((c) => c.isBuzz)!
      return {
        ...next,
        pendingLotsoBuzzMove: { playerIndex: idx, buzzInstanceId: buzzInst.instanceId },
        log: [...next.log, `Buzz l’Éclair passe en mode Démo — choisissez le lieu où le placer.`],
      }
    }
    case 'LOTSO_BOOST_NONZERO': {
      // Andy nous cherche : +amount aux Héros dont la force n'est pas 0.
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).map((c) => c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) > 0 ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) + effect.amount } : c)])),
      }))
      return { ...next, log: [...next.log, `Andy nous cherche : +${effect.amount} force aux Héros non réduits à 0.`] }
    }
    case 'LOTSO_RESTORE_HERO': {
      // Jouets de Bonnie : retire les jetons négatifs d'un Héros (le plus réduit).
      const p5 = state.players[idx]
      let best: { c: CardInstance; loc: LocationId } | undefined
      for (const l of p5.locations) for (const c of p5.board[l.id] ?? []) if (c.type === 'hero' && (c.permanentStrengthDelta ?? 0) < 0) { if (!best || (c.permanentStrengthDelta ?? 0) < (best.c.permanentStrengthDelta ?? 0)) best = { c, loc: l.id } }
      if (!best) return state
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board: { ...pl.board, [best!.loc]: (pl.board[best!.loc] ?? []).map((c) => c.instanceId === best!.c.instanceId ? { ...c, permanentStrengthDelta: Math.max(0, c.permanentStrengthDelta ?? 0) } : c) } }))
      return { ...next, log: [...next.log, `Jouets de Bonnie : **${best.c.name}** retrouve sa force.`] }
    }
    case 'LOTSO_DISCARD_ZERO_HERO': {
      // Le Grappin : défausse un Héros de force 0, puis mélange défausse↦pioche Fatalité.
      const p6 = state.players[idx]
      let target: { c: CardInstance; loc: LocationId } | undefined
      for (const l of p6.locations) for (const c of p6.board[l.id] ?? []) if (c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) === 0) { target = { c, loc: l.id }; break }
      if (!target) return { ...state, log: [...state.log, `Le Grappin : aucun Héros de force 0.`] }
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, board: { ...pl.board, [target!.loc]: (pl.board[target!.loc] ?? []).filter((c) => c.instanceId !== target!.c.instanceId) }, fateDiscard: [...pl.fateDiscard, { ...target!.c, permanentStrengthDelta: undefined }] }))
      const sh = shuffle([...next.players[idx].fateDeck, ...next.players[idx].fateDiscard], next.rngState)
      next = updatePlayer({ ...next, rngState: sh.state }, idx, (pl) => ({ ...pl, fateDeck: sh.result, fateDiscard: [] }))
      return { ...next, log: [...next.log, `Le Grappin : **${target.c.name}** (force 0) est renvoyé dans la pioche Fatalité.`] }
    }
    case 'LOTSO_FATE_DISCARD_ALLY': {
      // Jessie / Lotso était son préféré : défausse un Allié de Lotso (le plus fort ; Buzz épargné).
      const p7 = state.players[idx]
      let best: { c: CardInstance; loc: LocationId } | undefined
      for (const l of p7.locations) for (const c of p7.board[l.id] ?? []) if (c.type === 'ally' && !c.isBuzz && !c.attachedTo) { if (!best || (c.strength ?? 0) > (best.c.strength ?? 0)) best = { c, loc: l.id } }
      if (!best) return state
      const attachedIds = new Set((p7.board[best.loc] ?? []).filter((c) => c.attachedTo === best!.c.instanceId).map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, board: { ...pl.board, [best!.loc]: (pl.board[best!.loc] ?? []).filter((c) => c.instanceId !== best!.c.instanceId && !attachedIds.has(c.instanceId)) }, discard: [...pl.discard, { ...best!.c, attachedTo: undefined }] }))
      return { ...next, log: [...next.log, `**${best.c.name}** (Allié de ${p7.villainName}) est défaussé.`] }
    }
    case 'WOODY_RELEASE': {
      // Woody : si le Chapeau de Woody est en jeu, défaussez-le ; puis disperse les Héros
      // de la Salle des Chenilles vers les autres lieux.
      const p8 = state.players[idx]
      const roomId = p8.objective.type === 'LOTSO_GATHER' ? p8.objective.roomId : p8.locations[0].id
      const otherLocs = p8.locations.map((l) => l.id).filter((id2) => id2 !== roomId)
      let next = state
      // Défausse le Chapeau de Woody (Objet) s'il est en jeu.
      next = updatePlayer(next, idx, (pl) => {
        const hat = Object.values(pl.board).flat().find((c) => c.cardId === 'chapeau-de-woody')
        if (!hat) return pl
        return { ...pl, board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).filter((c) => c.instanceId !== hat.instanceId)])), discard: [...pl.discard, hat] }
      })
      // Disperse les Héros de la Salle vers les autres lieux (round-robin).
      next = updatePlayer(next, idx, (pl) => {
        const inRoom = (pl.board[roomId] ?? []).filter((c) => c.type === 'hero')
        if (inRoom.length === 0 || otherLocs.length === 0) return pl
        const board = { ...pl.board, [roomId]: (pl.board[roomId] ?? []).filter((c) => !(c.type === 'hero')) }
        inRoom.forEach((h, k) => { const to = otherLocs[k % otherLocs.length]; board[to] = [...(board[to] ?? []), h] })
        return { ...pl, board }
      })
      return { ...next, log: [...next.log, `**Woody** libère les Héros de la Salle des Chenilles.`] }
    }
    case 'DAISY_LOCKET': {
      // Médaillon de Daisy : si Big Baby en jeu, défaussez-le ; puis mélange défausse↦pioche Fatalité.
      let next = updatePlayer(state, idx, (pl) => {
        const bb = Object.values(pl.board).flat().find((c) => c.cardId === 'big-baby')
        if (!bb) return pl
        return { ...pl, board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).filter((c) => c.instanceId !== bb.instanceId)])), discard: [...pl.discard, bb] }
      })
      const sh = shuffle([...next.players[idx].fateDeck, ...next.players[idx].fateDiscard], next.rngState)
      next = updatePlayer({ ...next, rngState: sh.state }, idx, (pl) => ({ ...pl, fateDeck: sh.result, fateDiscard: [] }))
      return { ...next, log: [...next.log, `Médaillon de Daisy${next.players[idx].discard.some((c) => c.cardId === 'big-baby') ? ' : Big Baby est défaussé' : ''} ; pioche Fatalité mélangée.`] }
    }
    case 'REORDER_FATE_TOP': {
      // Travail d'équipe : le fatalisateur réordonne les `count` premières cartes de la
      // pioche Fatalité de la cible. Auto (simplifié) : Héros d'abord (le plus défavorable
      // pour la cible) ; le reste conserve son ordre.
      const p = state.players[idx]
      if (p.fateDeck.length < 2) return state
      const top = p.fateDeck.slice(0, effect.count)
      const rest = p.fateDeck.slice(effect.count)
      const heroes = top.filter((c) => c.type === 'hero')
      const nonHeroes = top.filter((c) => c.type !== 'hero')
      const reordered = [...heroes, ...nonHeroes, ...rest]
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDeck: reordered }))
      return {
        ...next,
        log: [...next.log, `Travail d'équipe : les ${Math.min(effect.count, top.length)} premières cartes Fatalité de ${p.villainName} sont réordonnées.`],
      }
    }
    case 'FORCE_SKIP_NEXT_MOVE': {
      const p = state.players[idx]
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, skipMoveForcedNextTurn: true }))
      return { ...next, log: [...next.log, `Pas de Capes ! : au prochain tour, ${p.villainName} ne se déplacera pas.`] }
    }
    case 'CLAIM_CAULDRON_OR_POWER': {
      // Montre-moi le Chaudron Magique / Nous avons conclu : choix s'emparer du Chaudron
      // OU gagner du Pouvoir. Si le Chaudron est déjà réclamé/réveillé, le claim n'aurait
      // aucun effet → on gagne directement le Pouvoir (pas de choix à offrir).
      const p = state.players[idx]
      // Déjà réclamé/réveillé, OU les Sorcières de Morva bloquent la prise → le claim
      // n'aurait aucun effet : on gagne directement le Pouvoir (pas de choix à offrir).
      if (p.blackCauldron !== 'set-aside' || cauldronClaimBlocked(p)) {
        return resolveEffect(state, { type: 'GAIN_POWER', amount: effect.power }, { actorIndex: idx })
      }
      return {
        ...state,
        pendingCauldronChoice: { playerIndex: idx, power: effect.power },
        log: [...state.log, `${p.villainName} : s'emparer du Chaudron Magique OU gagner ${effect.power} Pouvoir ?`],
      }
    }
    case 'BARGAIN_RESHUFFLE_OR_SWORD': {
      // Nous avons conclu un marché ! : « mélanger sa défausse Vilain dans sa pioche »
      // OU « payer `power` Pouvoir pour défausser l'Épée Magique de son royaume et
      // s'emparer du Chaudron ». On ne propose le choix que si LES DEUX sont possibles ;
      // sinon on résout directement la seule option réalisable.
      const p = state.players[idx]
      const canReshuffle = p.discard.length > 0
      const canSword = bargainCanSword(p, effect.power)
      if (canReshuffle && canSword) {
        return {
          ...state,
          pendingBargainChoice: { playerIndex: idx, power: effect.power },
          log: [...state.log, `${p.villainName} : mélanger sa défausse OU payer ${effect.power} Pouvoir pour défausser l'Épée Magique et s'emparer du Chaudron ?`],
        }
      }
      if (canSword) return bargainSword(state, idx, effect.power)
      return bargainReshuffle(state, idx)
    }
    case 'GRANT_FREE_ITEM_PLAY': {
      // Nous touchons du doigt la victoire : jouer gratuitement un Objet de sa main. Sans
      // Objet en main (ou aucun lieu non verrouillé), aucun effet.
      const p = state.players[idx]
      const hasItem = p.hand.some((c) => c.type === 'item')
      const hasLoc = p.locations.some((l) => !(p.lockedLocations ?? []).includes(l.id))
      if (!hasItem || !hasLoc) {
        return { ...state, log: [...state.log, `${p.villainName} : aucun Objet à jouer gratuitement.`] }
      }
      return {
        ...state,
        pendingFreeItemPlay: { playerIndex: idx },
        log: [...state.log, `${p.villainName} : jouez gratuitement un Objet de votre main.`],
      }
    }
    case 'RESHUFFLE_FATE_REVEAL_PLAY_BOTH': {
      // Retour à la vie de Gurki (Fatalité) : mélange la défausse Fatalité du joueur dans
      // sa pioche, dévoile 2 cartes Fatalité et permet de les jouer toutes les deux.
      const p = state.players[idx]
      const r = shuffle([...p.fateDeck, ...p.fateDiscard], state.rngState)
      const revealed = r.result.slice(0, 2).map((c) => ({ ...c, fatePlayBoth: true }))
      const deck = r.result.slice(2)
      let next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({ ...pl, fateDeck: deck, fateDiscard: [] }))
      if (revealed.length === 0) {
        return { ...next, log: [...next.log, `Retour à la vie de Gurki : aucune carte Fatalité à dévoiler.`] }
      }
      next = { ...next, pendingFate: { target: idx, revealed } }
      return { ...next, log: [...next.log, `Retour à la vie de Gurki : ${revealed.length} carte(s) Fatalité dévoilée(s), à jouer sur ${p.villainName}.`] }
    }
    case 'GATHER_ALLIES_TO_HOST': {
      // Ritournel (Héros Fatalité) : rassemble tous les Alliés du joueur sur son lieu
      // (avec leurs Objets associés).
      const hostLoc = ctx?.hostLocationId
      if (!hostLoc) return state
      const p = state.players[idx]
      // Alliés (hors lieu hôte) + leurs Objets/Malédictions associés.
      const allyIds = new Set<string>()
      for (const l of p.locations) {
        if (l.id === hostLoc) continue
        for (const c of p.board[l.id] ?? []) {
          if (c.type === 'ally' && !c.attachedTo) allyIds.add(c.instanceId)
        }
      }
      if (allyIds.size === 0) return state
      const movingCards: CardInstance[] = []
      const movingIds = new Set<string>()
      for (const l of p.locations) {
        if (l.id === hostLoc) continue
        for (const c of p.board[l.id] ?? []) {
          if (allyIds.has(c.instanceId) || (c.attachedTo && allyIds.has(c.attachedTo))) {
            movingCards.push(c)
            movingIds.add(c.instanceId)
          }
        }
      }
      const next = updatePlayer(state, idx, (pl) => {
        const board: typeof pl.board = {}
        for (const [lid, cards] of Object.entries(pl.board)) {
          board[lid] = lid === hostLoc ? cards : cards.filter((c) => !movingIds.has(c.instanceId))
        }
        board[hostLoc] = [...(board[hostLoc] ?? []), ...movingCards]
        return { ...pl, board }
      })
      return { ...next, log: [...next.log, `Ritournel attire ${allyIds.size} Allié${allyIds.size > 1 ? 's' : ''} sur **${locName(p, hostLoc)}**.`] }
    }
    case 'GAIN_POWER': {
      // Dio — The World double les gains une fois Jotaro + Joseph retirés du jeu.
      const gained = Math.max(0, effect.amount - realmPowerPenalty(state, idx)) * dioPowerFactor(state.players[idx])
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      const actor = next.players[idx]
      const note = gained < effect.amount ? ' (Robin des Bois : −1)' : ''
      next = {
        ...next,
        // Suivi du Pouvoir gagné par le joueur actif ce tour-ci (déclencheur Terreur).
        activeGainedPower: idx === next.activePlayer ? (next.activeGainedPower ?? 0) + gained : next.activeGainedPower,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT${note} (total : ${actor.power}).`,
        ],
      }
      return pushRobinSteal(next, idx, effect.amount - gained)
    }
    // --- Oogie Boogie -------------------------------------------------------
    case 'ROLL_IMPOSTOR':
      return openDiceRoll(state, idx, 'Imposteur Perce-Oreilles', { kind: 'impostor' }, 'imposteur-perce-oreilles')
    case 'ROLL_MAKING_CHRISTMAS':
      return openDiceRoll(state, idx, 'Préparation de Noël', { kind: 'making-christmas' }, 'preparation-noel')
    case 'ROLL_MERVEILLE': {
      // Effectue d'abord l'élimination (Alliés → défausse ; déclenche les triggers
      // Chauves-souris/Araignées et onVanquish du Héros), puis lance les dés. Le
      // résultat décidera si les Alliés utilisés reviennent en main ou restent en jeu.
      const heroLoc = ctx?.targetHeroId ? locationOfCard(state.players[idx], ctx.targetHeroId) : undefined
      const next = resolveEffects(state, [{ type: 'VANQUISH_HERO', keepAllies: false }], {
        actorIndex: idx,
        targetHeroId: ctx?.targetHeroId,
        allyInstanceIds: ctx?.allyInstanceIds,
      })
      const loc = heroLoc ?? next.players[idx].pawnLocation ?? next.players[idx].locations[0].id
      return openDiceRoll(next, idx, 'Mais quelle merveille !', {
        kind: 'merveille',
        allyInstanceIds: ctx?.allyInstanceIds ?? [],
        locationId: loc,
      }, 'mais-quelle-merveille')
    }
    case 'DISCARD_TOP_FATE_DRAW_PER_HERO': {
      const p = state.players[idx]
      const top = p.fateDeck.slice(0, effect.count)
      const heroes = top.filter((c) => c.type === 'hero').length
      let next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        fateDeck: pp.fateDeck.slice(effect.count),
        fateDiscard: [...pp.fateDiscard, ...top],
      }))
      next = {
        ...next,
        log: [...next.log, `${p.villainName} (Ce sont des vacances) défausse ${top.length} carte(s) Fatalité (${heroes} Héros).`],
      }
      if (heroes > 0) next = drawNCards(next, idx, heroes)
      // Montre les cartes Fatalité dévoilées + le nombre de cartes piochées (les
      // Héros y sont surlignés via heroInstanceIds).
      if (top.length > 0) {
        next = {
          ...next,
          pendingReveal: {
            playerIndex: idx,
            cards: top,
            title: 'Ce sont des vacances',
            subtitle:
              heroes > 0
                ? `${heroes} Héros dévoilé${heroes > 1 ? 's' : ''} → vous piochez ${heroes} carte${heroes > 1 ? 's' : ''}.`
                : 'Aucun Héros dévoilé : vous ne piochez aucune carte.',
            heroInstanceIds: top.filter((c) => c.type === 'hero').map((c) => c.instanceId),
          },
        }
      }
      return next
    }
    case 'JACK_FATE_DISCARD_IMPOSTOR': {
      const before = state.players[idx].impostorsPlaced ?? 0
      const after = Math.max(0, before - 1)
      // Retire aussi la carte du sommet de la pile Perce-Oreilles → défausse.
      const pile = state.players[idx].impostorPile ?? []
      const popped = pile[pile.length - 1]
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        impostorsPlaced: after,
        impostorPile: popped ? pile.slice(0, -1) : pile,
        discard: popped ? [...pp.discard, popped] : pp.discard,
      }))
      return {
        ...next,
        log: [...next.log, `Jack Skellington (Fatalité) : un Imposteur Perce-Oreilles est retiré de la pile (${after}/4).`],
      }
    }
    case 'SALLY_PLACED': {
      const loc = ctx?.hostLocationId
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        pawnLocation: loc ?? p.pawnLocation,
        sallyRestrict: true,
      }))
      const placeName = loc ? findLocation(next.players[idx], loc)?.name ?? loc : '—'
      return {
        ...next,
        log: [...next.log, `Sally : ${next.players[idx].villainName} est déplacé sur **${placeName}** ; désormais il ne peut se déplacer que vers un lieu voisin.`],
      }
    }
    case 'ROLL_TRICK_OR_TREAT': {
      // Condition : résolue immédiatement (pas de fenêtre de relance hors de son
      // propre tour). On publie quand même `diceRoll` pour l'animation.
      const r = rollTwoDice(state.rngState)
      const total = r.dice[0] + r.dice[1]
      const seq = (state.diceRoll?.seq ?? 0) + 1
      let next: GameState = {
        ...state,
        rngState: r.rngState,
        diceRoll: { seq, dice: r.dice, total, modifier: 0, by: idx, context: 'Joyeux Halloween !', cardId: 'joyeux-halloween' },
        log: [...state.log, `${state.players[idx].villainName} lance les dés — Joyeux Halloween ! : ${r.dice[0]} + ${r.dice[1]} = **${total}**.`],
      }
      if (total >= 8) {
        next = resolveEffect(next, { type: 'GAIN_POWER', amount: total }, { actorIndex: idx })
      } else {
        // Vole 1 Pouvoir à l'adversaire actif (celui dont c'est le tour).
        const victim = next.activePlayer === idx ? (idx + 1) % next.players.length : next.activePlayer
        const steal = Math.min(1, next.players[victim].power)
        next = {
          ...next,
          players: next.players.map((pl, i) =>
            i === victim ? { ...pl, power: pl.power - steal } : i === idx ? { ...pl, power: pl.power + steal } : pl,
          ),
          log: [...next.log, `Joyeux Halloween ! (${total}) : ${next.players[idx].villainName} vole ${steal} Pouvoir à ${next.players[victim].villainName}.`],
        }
      }
      return next
    }
    case 'REPLAY_EVENT_BAG': {
      // Cette fois l'affaire est dans le sac : rejoue GRATUITEMENT un Événement de
      // la défausse, avec résultat de dés CHOISI. Candidats = Événements rejouables.
      const p = state.players[idx]
      const candidates = p.discard.filter((c) => c.type === 'effect' && !c.reactiveOnly && (c.effects?.length ?? 0) > 0)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : aucun Événement à rejouer (l'affaire est dans le sac).`] }
      }
      return {
        ...state,
        pendingReplayEvent: { playerIndex: idx, candidateIds: candidates.map((c) => c.instanceId), free: true, bagControlledDice: true },
        log: [...state.log, `${p.villainName} : choisissez un Événement à rejouer (l'affaire est dans le sac).`],
      }
    }
    case 'GAIN_CONFIANCE': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, confiance: (p.confiance ?? 0) + effect.amount }))
      const actor = next.players[idx]
      return {
        ...next,
        log: [...next.log, `${actor.villainName} gagne ${effect.amount} Confiance (total : ${actor.confiance}).`],
      }
    }
    case 'LOSE_CONFIANCE': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, confiance: Math.max(0, (p.confiance ?? 0) - effect.amount) }))
      const actor = next.players[idx]
      return {
        ...next,
        log: [...next.log, `${actor.villainName} perd ${effect.amount} Confiance (total : ${actor.confiance}).`],
      }
    }
    case 'LOSE_CONFIANCE_AT_RAIPONCE': {
      // La Reine et le Roi : Gothel perd `amount` Confiance seulement si ce Héros
      // arrive (onPlace) sur le lieu où se trouve Raiponce.
      const p = state.players[idx]
      if (!ctx?.hostLocationId || ctx.hostLocationId !== raiponceLocation(p)) return state
      const next = updatePlayer(state, idx, (q) => ({ ...q, confiance: Math.max(0, (q.confiance ?? 0) - effect.amount) }))
      const actor = next.players[idx]
      return {
        ...next,
        log: [
          ...next.log,
          `La Reine et le Roi arrivent sur le lieu de Raiponce : ${actor.villainName} perd ${effect.amount} Confiance (total : ${actor.confiance}).`,
        ],
      }
    }
    case 'FATE_DISCARD_RANDOM_HAND': {
      // La Main froide : le propriétaire défausse `amount` carte(s) au hasard de sa
      // main (aléa déterministe via rngState).
      const actor = state.players[idx]
      if (actor.hand.length === 0) {
        return { ...state, log: [...state.log, `La Main froide : ${actor.villainName} n'a aucune carte en main.`] }
      }
      const sh = shuffle(actor.hand, state.rngState)
      const n = Math.min(effect.amount, sh.result.length)
      const dropped = sh.result.slice(0, n)
      const dropIds = new Set(dropped.map((c) => c.instanceId))
      const next = updatePlayer({ ...state, rngState: sh.state }, idx, (p) => ({
        ...p,
        hand: p.hand.filter((c) => !dropIds.has(c.instanceId)),
        discard: [...p.discard, ...dropped],
      }))
      return {
        ...next,
        log: [...next.log, `La Main froide : ${actor.villainName} défausse ${n} carte au hasard de sa main.`],
      }
    }
    case 'FLYNN_TAKE_CONFIANCE': {
      // Flynn Rider : Gothel perd jusqu'à `amount` Confiance, déposés sur Flynn
      // (heldConfiance) ; rendus s'il est vaincu (cf. performVanquish).
      if (!ctx?.hostInstanceId) return state
      const actor = state.players[idx]
      const taken = Math.min(effect.amount, actor.confiance ?? 0)
      const hostId = ctx.hostInstanceId
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        confiance: Math.max(0, (p.confiance ?? 0) - taken),
        board: Object.fromEntries(
          Object.entries(p.board).map(([loc, cards]) => [
            loc,
            cards.map((c) => (c.instanceId === hostId ? { ...c, heldConfiance: taken } : c)),
          ]),
        ),
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `Flynn Rider : ${actor.villainName} perd ${taken} Confiance (déposé${taken > 1 ? 's' : ''} sur Flynn).`,
        ],
      }
    }
    case 'SKIP_RAIPONCE_MOVE': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, raiponceSkipMove: true }))
      return { ...next, log: [...next.log, `${next.players[idx].villainName} : Raiponce ne se déplacera pas ce tour-ci.`] }
    }
    case 'VENGEANCE': {
      // Arme le bonus de Confiance et OFFRE une action « Éliminer un Héros » à la Tour
      // (seul lieu de Gothel avec un Vanquish). Fenêtre « agir à un lieu » facultative
      // (si aucun Héros vincible, le joueur passe). +1 Confiance au Vanquish si la cible
      // n'est pas Raiponce (cf. performVanquish).
      const next = updatePlayer(state, idx, (p) => ({ ...p, vengeanceConfianceArmed: true }))
      return {
        ...next,
        actAtLocation: 'tour',
        actAtLocationSkippable: true,
        log: [...next.log, `${next.players[idx].villainName} (Vengeance) : effectuez une action Éliminer un Héros à la Tour.`],
      }
    }
    case 'MOVE_RAIPONCE': {
      const p = state.players[idx]
      const from = raiponceLocation(p)
      if (!from) return state
      const order = p.locations.map((l) => l.id)
      const i = order.indexOf(from)
      const steps = effect.steps ?? 1
      const target =
        effect.to === 'tour'
          ? order[0]
          : effect.to === 'corona'
            ? order[order.length - 1]
            : effect.to === 'left'
              ? order[Math.max(0, i - steps)]
              : order[Math.min(order.length - 1, i + steps)]
      if (target === from) return state
      return relocateRaiponce(state, idx, target)
    }
    case 'OFFER_RAIPONCE_TO_TOWER':
      // Marqueur (Frères Stabbington) : la résolution réelle a lieu APRÈS le
      // placement de l'Allié, dans applyPlayCard (besoin du lieu d'arrivée).
      return state
    case 'RAIPONCE_HOMEWARD': {
      // Lance-moi ta chevelure : Raiponce sur la Tour → gain de Confiance ; sinon
      // ramène-la de 1 à `maxSteps` lieux vers la Tour (à gauche). Le joueur choisit
      // le nombre de lieux dès qu'il y a ≥ 2 possibilités (pendingRaiponceHomeward).
      const p = state.players[idx]
      const from = raiponceLocation(p)
      if (!from) return state
      const order = p.locations.map((l) => l.id)
      const i = order.indexOf(from)
      if (i <= 0) {
        // Déjà sur la Tour → simple gain de Confiance.
        return resolveEffect(state, { type: 'GAIN_CONFIANCE', amount: effect.confianceIfAtTower }, { actorIndex: idx })
      }
      // Possibilités : de 1 à min(maxSteps, distance à la Tour) lieux vers la gauche.
      const maxPossible = Math.min(effect.maxSteps, i)
      const options = Array.from({ length: maxPossible }, (_, k) => {
        const steps = k + 1
        const destId = order[i - steps]
        return { steps, locationId: destId, locationName: p.locations.find((l) => l.id === destId)?.name ?? destId }
      })
      if (options.length <= 1) {
        // Un seul choix possible → déplacement direct (pas de choix à faire).
        return relocateRaiponce(state, idx, options[0].locationId)
      }
      return {
        ...state,
        pendingRaiponceHomeward: { chooserIndex: idx, options },
        log: [...state.log, `${p.villainName} (Lance-moi ta chevelure) : ramène Raiponce de 1 ou 2 lieux vers la Tour.`],
      }
    }
    // --- Cruella d'Enfer : Tuiles Chiots ------------------------------------
    case 'ADD_PUPPY_FROM_RESERVE': {
      const p = state.players[idx]
      const candidates = (p.puppyTiles ?? []).filter((t) => t.state === 'reserve')
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : réserve de Chiots vide.`] }
      }
      return {
        ...state,
        pendingPuppyAdd: {
          playerIndex: idx,
          candidateTileIds: candidates.map((t) => t.id),
          label: effect.label ?? 'Tuile Chiots',
        },
        log: [...state.log, `${p.villainName} choisit une Tuile Chiots de la réserve (${effect.label ?? 'ajout'}).`],
      }
    }
    case 'CAPTURE_PUPPY_AT_PAWN': {
      const p = state.players[idx]
      if (!p.pawnLocation) return state
      return capturePuppiesAt(state, idx, p.pawnLocation, 1)
    }
    case 'CAPTURE_PUPPY_AT_HOST': {
      if (!ctx?.hostLocationId) return state
      return capturePuppiesAt(state, idx, ctx.hostLocationId, effect.max)
    }
    case 'REVEAL_PUPPY_RESERVE': {
      // Repéré ! : le joueur choisit quelles Tuiles face cachée révéler (jusqu'à
      // `count`). Ouvre pendingPuppyReveal (clic direct sur les tuiles ; bot auto).
      const p = state.players[idx]
      const hidden = (p.puppyTiles ?? []).filter((t) => t.state === 'reserve' && !t.revealed).length
      if (hidden === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : aucune Tuile Chiots face cachée à révéler.`] }
      }
      return {
        ...state,
        pendingPuppyReveal: { playerIndex: idx, remaining: Math.min(effect.count, hidden) },
        log: [...state.log, `${p.villainName} (Repéré !) : révélez jusqu'à ${Math.min(effect.count, hidden)} Tuile(s) Chiots de la réserve.`],
      }
    }
    case 'GAIN_POWER_PER_PUPPY_LOCATION': {
      const p = state.players[idx]
      const locs = new Set((p.puppyTiles ?? []).filter((t) => t.state === 'board').map((t) => t.location))
      return resolveEffect(state, { type: 'GAIN_POWER', amount: locs.size }, { actorIndex: idx })
    }
    case 'UNCAPTURE_PUPPY_TO_RESERVE': {
      const p = state.players[idx]
      const captured = (p.puppyTiles ?? []).filter((t) => t.state === 'captured').sort((a, b) => b.value - a.value)
      const pick = new Set(captured.slice(0, Math.max(0, effect.count)).map((t) => t.id))
      if (pick.size === 0) return { ...state, log: [...state.log, `${p.villainName} : aucune Tuile Chiots capturée à libérer.`] }
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        puppyTiles: (pl.puppyTiles ?? []).map((t) =>
          pick.has(t.id) ? { ...t, state: 'reserve' as const, revealed: true, location: t.homeLocation } : t,
        ),
      }))
      return { ...next, log: [...next.log, `Évasion : ${pick.size} Tuile(s) Chiots capturée(s) repart(ent) dans la réserve.`] }
    }
    case 'RETURN_BOARD_PUPPIES_TO_RESERVE': {
      const p = state.players[idx]
      // Choisit le lieu avec le plus de Chiots posés, en renvoie jusqu'à `max`.
      const byLoc = new Map<string, typeof p.puppyTiles>()
      for (const t of p.puppyTiles ?? []) {
        if (t.state !== 'board') continue
        byLoc.set(t.location, [...(byLoc.get(t.location) ?? []), t])
      }
      let bestLoc: string | null = null
      let bestSum = -1
      for (const [loc, tiles] of byLoc) {
        const sum = (tiles ?? []).reduce((n, t) => n + t.value, 0)
        if (sum > bestSum) { bestSum = sum; bestLoc = loc }
      }
      if (!bestLoc) return { ...state, log: [...state.log, `Nous sommes des labradors : aucune Tuile Chiots posée.`] }
      const pick = new Set((byLoc.get(bestLoc) ?? []).sort((a, b) => b.value - a.value).slice(0, effect.max).map((t) => t.id))
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        puppyTiles: (pl.puppyTiles ?? []).map((t) =>
          pick.has(t.id) ? { ...t, state: 'reserve' as const, revealed: true, location: t.homeLocation } : t,
        ),
      }))
      return { ...next, log: [...next.log, `Nous sommes des labradors : ${pick.size} Tuile(s) Chiots de **${locName(p, bestLoc)}** repart(ent) dans la réserve.`] }
    }
    case 'MOVE_BOARD_PUPPIES_TO_HERO': {
      if (!ctx?.hostLocationId) return state
      const dest = ctx.hostLocationId
      const p = state.players[idx]
      const movable = (p.puppyTiles ?? [])
        .filter((t) => t.state === 'board' && t.location !== dest)
        .sort((a, b) => b.value - a.value)
        .slice(0, Math.max(0, effect.max))
      const pick = new Set(movable.map((t) => t.id))
      if (pick.size === 0) return state
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        puppyTiles: (pl.puppyTiles ?? []).map((t) => (pick.has(t.id) ? { ...t, location: dest } : t)),
      }))
      return { ...next, log: [...next.log, `Sergent Tibs regroupe ${pick.size} Tuile(s) Chiots sur **${locName(p, dest)}**.`] }
    }
    case 'PLACE_CAPTURED_PUPPY_AT_HERO': {
      if (!ctx?.hostLocationId) return state
      const dest = ctx.hostLocationId
      const p = state.players[idx]
      const captured = (p.puppyTiles ?? []).filter((t) => t.state === 'captured').sort((a, b) => b.value - a.value)
      const pick = captured[0]
      if (!pick) return state
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        puppyTiles: (pl.puppyTiles ?? []).map((t) =>
          t.id === pick.id ? { ...t, state: 'board' as const, location: dest, revealed: true } : t,
        ),
      }))
      return { ...next, log: [...next.log, `Perdita libère une Tuile Chiots (${pick.value}) sur **${locName(p, dest)}**.`] }
    }
    case 'GRANT_FREE_ACTIVATE': {
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, freeActivate: true }))
      return { ...next, log: [...next.log, `${state.players[idx].villainName} : une activation gratuite est disponible (Finissez le travail !).`] }
    }
    // --- Gaston : jetons Obstacle --------------------------------------------
    case 'REMOVE_OBSTACLE': {
      const p = state.players[idx]
      const name = p.villainName
      if (belleBlocksRemoval(p)) {
        return { ...state, log: [...state.log, `${name} : Belle est dans le royaume — aucun Obstacle ne peut être retiré.`] }
      }
      if (totalObstacles(p) === 0) {
        return { ...state, log: [...state.log, `${name} : aucun Obstacle à retirer.`] }
      }
      // Choix interactif : le joueur clique le(s) lieu(x) dont retirer un Obstacle
      // (auto-résolu pour le bot via enumerate). « jusqu'à `max` » → facultatif.
      const remaining = effect.sameLocation ? effect.max : Math.min(effect.max, totalObstacles(p))
      return {
        ...state,
        pendingObstacle: {
          // Le retrait est TOUJOURS choisi par l'acteur (Gaston), pas par le joueur
          // actif — important pour « Aussi belle que moi » (Condition jouée en
          // réaction pendant le tour d'un adversaire).
          chooserIndex: idx,
          targetIndex: idx,
          kind: 'remove',
          remaining,
          sameLocation: effect.sameLocation,
          lockedLocationId: null,
          label: effect.sameLocation
            ? `Retirez jusqu’à ${effect.max} Obstacle${effect.max > 1 ? 's' : ''} d’un même lieu`
            : `Retirez jusqu’à ${effect.max} Obstacle${effect.max > 1 ? 's' : ''}`,
        },
        log: [...state.log, `${name} : choisissez où retirer des Obstacles.`],
      }
    }
    case 'REMOVE_OBSTACLES_AT_LOCATION': {
      const name = state.players[idx].villainName
      if (belleBlocksRemoval(state.players[idx])) {
        return { ...state, log: [...state.log, `${name} : Belle empêche le retrait des Obstacles.`] }
      }
      const had = state.players[idx].obstacles?.[effect.locationId] ?? 0
      if (had === 0) return state
      const next = setObstacle(state, idx, effect.locationId, -had)
      return { ...next, log: [...next.log, `${name} retire les ${had} Obstacle${had > 1 ? 's' : ''} de **${locName(next.players[idx], effect.locationId)}**.`] }
    }
    case 'REPLACE_OBSTACLE': {
      const name = state.players[idx].villainName
      const mode = effect.mode ?? 'free'
      // Auto : Sous le charme (auto, suivi d'un autre choix) et 'each-location'
      // (aucun choix — +1 sur CHAQUE lieu non plein).
      if (effect.auto || mode === 'each-location') {
        const { state: next, added } = autoReplaceObstacles(state, idx, effect.count, mode)
        if (added === 0) return { ...state, log: [...state.log, `${name} : tous les Obstacles sont déjà en place.`] }
        return { ...next, log: [...next.log, `${added} Obstacle${added > 1 ? 's' : ''} replacé${added > 1 ? 's' : ''} dans le royaume de ${name} (${totalObstacles(next.players[idx])} au total).`] }
      }
      // Choix interactif : le joueur qui fatalise clique le(s) lieu(x) où replacer
      // un Obstacle (auto-résolu pour le bot via enumerate).
      const freeSlots = state.players[idx].locations.filter(
        (l) => (state.players[idx].obstacles?.[l.id] ?? 0) < OBSTACLE_CAP,
      ).length
      if (freeSlots === 0) return { ...state, log: [...state.log, `${name} : tous les Obstacles sont déjà en place.`] }
      return {
        ...state,
        pendingObstacle: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          kind: 'replace',
          remaining: mode === 'fill-location' ? 1 : effect.count,
          fillLocation: mode === 'fill-location',
          lockedLocationId: null,
          label:
            mode === 'fill-location'
              ? 'Replacez tous les Obstacles d’un même lieu'
              : `Replacez ${effect.count} Obstacle${effect.count > 1 ? 's' : ''}`,
          then: effect.thenDrawOrGain ? { drawOrGain: effect.thenDrawOrGain } : undefined,
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} replace des Obstacles chez ${name}.`],
      }
    }
    case 'GRANT_FREE_ACTION': {
      const name = state.players[idx].villainName
      const label =
        effect.actionType === 'VANQUISH'
          ? 'Éliminer un Héros'
          : effect.actionType === 'PLAY_CARD'
            ? 'Jouer une carte'
            : 'Déplacer un Allié ou un Objet'
      return {
        ...state,
        grantedAction: { playerIndex: idx, actionType: effect.actionType, label },
        log: [...state.log, `${name} : effectuez une action **${label}**.`],
      }
    }
    case 'GRANT_FREE_MOVE_OR_ACTIVATE': {
      // C'est votre dernière chance : une action gratuite au choix (Déplacer / Activer).
      const canMove = movableCards(state).length > 0
      const canActivate = activatableCards(state).length > 0
      if (canMove && canActivate) {
        return { ...state, pendingMoveOrActivate: { playerIndex: idx } }
      }
      if (canMove) return resolveEffect(state, { type: 'GRANT_FREE_ACTION', actionType: 'MOVE_ITEM_ALLY' }, ctx)
      if (canActivate) return resolveEffect(state, { type: 'GRANT_FREE_ACTIVATE' }, ctx)
      return state // ni Objet/Allié à déplacer ni capacité activable (carte injouable)
    }
    case 'SHOW_ME_THE_BEAST': {
      const p = state.players[idx]
      const name = p.villainName
      const hasBeast = Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'la-bete')
      const hasBelle = belleBlocksRemoval(p)
      if (hasBeast && hasBelle) {
        const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: pl.power + 2 }))
        return { ...next, log: [...next.log, `${name} (Montre-moi la Bête !) : la Bête ET Belle sont là → +2 JT.`] }
      }
      if (hasBeast) {
        const { state: next, removed } = autoRemoveObstacles(state, idx, 1, false)
        return { ...next, log: [...next.log, removed > 0 ? `${name} (Montre-moi la Bête !) retire 1 Obstacle.` : `${name} (Montre-moi la Bête !) : aucun Obstacle à retirer.`] }
      }
      if (hasBelle) {
        const { state: next } = autoReplaceObstacles(state, idx, 1, 'free')
        return { ...next, log: [...next.log, `${name} (Montre-moi la Bête !) : Belle est là → 1 Obstacle replacé.`] }
      }
      return { ...state, log: [...state.log, `${name} (Montre-moi la Bête !) : ni la Bête ni Belle dans le royaume.`] }
    }
    case 'REVEAL_FATE_UNTIL_HERO_PLAY': {
      // Gardez-moi en otage : dévoile la pioche Fatalité jusqu'au 1er Héros, le joue
      // sur `locationId`, remélange le reste, puis retire des Obstacles.
      const actor0 = state.players[idx]
      const name = actor0.villainName
      const r = revealFate(actor0, 999, state.rngState)
      // revealFate révèle jusqu'à 999 (= tout) ; on s'arrête au 1er Héros nous-mêmes.
      const deckLeft = [...r.revealed]
      const heroPos = deckLeft.findIndex((c) => c.type === 'hero')
      let next = { ...state, rngState: r.rngState }
      if (heroPos < 0) {
        // Aucun Héros : tout (revealFate a déjà vidé pioche + défausse dans `deckLeft`)
        // retourne dans la pioche, remélangé.
        const back = shuffle(deckLeft, next.rngState)
        next = updatePlayer({ ...next, rngState: back.state }, idx, (p) => ({ ...p, fateDeck: back.result, fateDiscard: [] }))
        return { ...next, log: [...next.log, `${name} (Gardez-moi en otage) : aucun Héros dans la pioche Fatalité.`] }
      }
      const hero = deckLeft[heroPos]
      const others = deckLeft.filter((_, i) => i !== heroPos)
      // Le Héros révélé est posé ; les autres cartes dévoilées + la défausse Fatalité
      // sont remélangées dans la pioche Fatalité.
      const reshuffled = shuffle([...r.player.fateDiscard, ...others], next.rngState)
      next = updatePlayer({ ...next, rngState: reshuffled.state }, idx, (p) => ({
        ...p,
        fateDeck: [...r.player.fateDeck, ...reshuffled.result],
        fateDiscard: [],
        board: { ...p.board, [effect.locationId]: [...(p.board[effect.locationId] ?? []), hero] },
      }))
      next = triggerHeroArrival(next, idx, effect.locationId)
      next = { ...next, log: [...next.log, `${name} (Gardez-moi en otage) joue **${hero.name}** sur **${locName(next.players[idx], effect.locationId)}**.`] }
      // Retrait d'Obstacle INTERACTIF (clic du lieu), comme les autres retraits.
      // Bloqué si Belle est en jeu (ex. si le Héros révélé EST Belle) ou plus d'Obstacle.
      const rm = effect.removeObstacle ?? 0
      const tgt = next.players[idx]
      if (rm > 0 && !belleBlocksRemoval(tgt) && totalObstacles(tgt) > 0) {
        return {
          ...next,
          pendingObstacle: {
            chooserIndex: idx,
            targetIndex: idx,
            kind: 'remove',
            remaining: Math.min(rm, totalObstacles(tgt)),
            lockedLocationId: null,
            label: `Retirez ${rm > 1 ? `${rm} Obstacles` : 'un Obstacle'} (Gardez-moi en otage)`,
          },
          log: [...next.log, `${name} : choisissez où retirer ${rm > 1 ? 'les Obstacles' : 'l’Obstacle'}.`],
        }
      }
      return next
    }
    case 'FATE_PLAY_HERO_FROM_DISCARD': {
      // C'est la fête (Fatalité, joué contre Gaston) : le fatalisateur pose un Héros
      // de la défausse Fatalité de la cible. Auto : le plus fort, sur le lieu le plus
      // vide en Obstacles (où il gêne le plus la progression).
      const target = state.players[idx]
      const heroes = target.fateDiscard.filter((c) => c.type === 'hero')
      if (heroes.length === 0) {
        return { ...state, log: [...state.log, `C'est la fête : aucun Héros dans la défausse Fatalité de ${target.villainName}.`] }
      }
      const hero = [...heroes].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
      const loc = target.locations
        .map((l) => l.id)
        .sort((a, b) => (target.obstacles?.[a] ?? 0) - (target.obstacles?.[b] ?? 0))[0]
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== hero.instanceId),
        board: { ...p.board, [loc]: [...(p.board[loc] ?? []), hero] },
      }))
      next = triggerHeroArrival(next, idx, loc)
      return { ...next, log: [...next.log, `C'est la fête : **${hero.name}** rejoint **${locName(next.players[idx], loc)}** dans le royaume de ${target.villainName}.`] }
    }
    case 'FETCH_FATE_ITEM_TO_HOST': {
      // Maurice (à la pose) : cherche son Invention dans la pioche/défausse Fatalité
      // et l'associe à l'hôte (Maurice), sur son lieu. Auto.
      const host = ctx?.hostInstanceId
      const hostLoc = ctx?.hostLocationId
      if (!host || !hostLoc) return state
      const p = state.players[idx]
      const di = p.fateDeck.findIndex((c) => c.cardId === effect.itemCardId)
      const fi = di < 0 ? p.fateDiscard.findIndex((c) => c.cardId === effect.itemCardId) : -1
      const item = di >= 0 ? p.fateDeck[di] : fi >= 0 ? p.fateDiscard[fi] : undefined
      if (!item) {
        return { ...state, log: [...state.log, `Maurice : son Invention est introuvable (déjà en jeu ou défaussée).`] }
      }
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        fateDeck: di >= 0 ? pl.fateDeck.filter((_, i) => i !== di) : pl.fateDeck,
        fateDiscard: fi >= 0 ? pl.fateDiscard.filter((_, i) => i !== fi) : pl.fateDiscard,
        board: { ...pl.board, [hostLoc]: [...(pl.board[hostLoc] ?? []), { ...item, attachedTo: host }] },
      }))
      return { ...next, log: [...next.log, `Maurice fait apparaître son **${item.name}** sur **${locName(next.players[idx], hostLoc)}** (Alliés −1 ici).`] }
    }
    case 'MOVE_ALLIES_FROM_HOST_AWAY': {
      // La Bête (à la pose / au déplacement) : éloigne les Alliés du lieu de la Bête.
      const hostLoc = ctx?.hostLocationId
      if (!hostLoc) return state
      const p = state.players[idx]
      const allies = (p.board[hostLoc] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo)
      const dests = p.locations
        .map((l) => l.id)
        .filter((id) => id !== hostLoc && !(p.lockedLocations ?? []).includes(id))
      if (allies.length === 0 || dests.length === 0) return state
      const next = scatterCards(state, idx, allies, dests)
      return { ...next, log: [...next.log, `La Bête éloigne ${allies.length} Allié${allies.length > 1 ? 's' : ''} de **${locName(p, hostLoc)}**.`] }
    }
    case 'SCATTER_REALM_HEROES': {
      // Mrs Samovar et Zip (à la pose) : disperse les autres Héros du royaume.
      const p = state.players[idx]
      const heroes = Object.values(p.board)
        .flat()
        .filter((c) => c.type === 'hero' && !c.attachedTo && c.instanceId !== ctx?.hostInstanceId)
      const dests = p.locations.map((l) => l.id).filter((id) => !(p.lockedLocations ?? []).includes(id))
      if (heroes.length === 0 || dests.length === 0) {
        return { ...state, log: [...state.log, `Mrs Samovar et Zip : aucun autre Héros à déplacer.`] }
      }
      const next = scatterCards(state, idx, heroes, dests)
      return { ...next, log: [...next.log, `Mrs Samovar et Zip dispersent ${heroes.length} Héros dans le royaume de ${p.villainName}.`] }
    }
    // --- Le Seigneur des clés : clés + dé ------------------------------------
    case 'TAKE_KEY_AT_PAWN': {
      const p = state.players[idx]
      const loc = p.pawnLocation
      const present = (p.keys ?? []).filter((k) => k.location === loc)
      if (!loc || present.length === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : aucune clé à ramasser ici.`] }
      }
      return {
        ...state,
        pendingKey: { playerIndex: idx, kind: 'take', locationId: loc, label: 'Obtenez une clé sur ce lieu' },
        log: [...state.log, `${p.villainName} : choisissez une clé à ramasser.`],
      }
    }
    case 'ROLL_DIE_TAKE_KEY_AT_PAWN': {
      const roll = rollColorDie(state.rngState)
      const next: GameState = { ...state, rngState: roll.rngState, lastDieColor: roll.color, dieRoll: { seq: (state.dieRoll?.seq ?? 0) + 1, color: roll.color, by: idx } }
      const p = next.players[idx]
      const loc = p.pawnLocation ?? undefined
      const blocked = p.dieBlockedColor === roll.color
      const matches = (p.keys ?? []).filter((k) => k.location !== null && k.location === loc && !k.stolenBy && k.color === roll.color)
      if (matches.length > 0 && !blocked) {
        // Choix interactif : prendre une clé de la couleur tirée, sur le lieu du pion.
        return { ...next, pendingKey: { playerIndex: idx, kind: 'take', color: roll.color, locationId: loc, label: `Dé : ${roll.color} — prenez une clé ${roll.color}` }, log: [...next.log, `Dé : **${roll.color}** — ${p.villainName} peut prendre une clé ${KEY_LABEL[roll.color]} sur son lieu (Pierre tombale).`] }
      }
      return { ...next, log: [...next.log, `Dé : **${roll.color}** — aucune clé ${KEY_LABEL[roll.color]} sur le lieu du pion${blocked ? ' (Baron Samedi bloque cette couleur)' : ''}.`] }
    }
    case 'ROLL_DIE_TAKE_KEY_FROM_BOARD': {
      // Action « Obtenir une clé » : on lance le dé ; la couleur obtenue désigne la
      // clé à prendre — le joueur CHOISIT laquelle (parmi celles de cette couleur,
      // n'importe où sur le plateau).
      const roll = rollColorDie(state.rngState)
      const next: GameState = { ...state, rngState: roll.rngState, lastDieColor: roll.color, dieRoll: { seq: (state.dieRoll?.seq ?? 0) + 1, color: roll.color, by: idx } }
      const p = next.players[idx]
      const blocked = p.dieBlockedColor === roll.color
      const matches = (p.keys ?? []).filter((k) => k.location !== null && !k.stolenBy && k.color === roll.color)
      if (matches.length > 0 && !blocked) {
        return { ...next, pendingKey: { playerIndex: idx, kind: 'take', color: roll.color, label: `Dé : ${roll.color} — prenez une clé ${roll.color}` }, log: [...next.log, `Dé : **${roll.color}** — ${p.villainName} peut prendre une clé ${KEY_LABEL[roll.color]} sur le plateau (Obtenir une clé).`] }
      }
      return { ...next, log: [...next.log, `Dé : **${roll.color}** — aucune clé ${KEY_LABEL[roll.color]} à prendre${blocked ? ' (Baron Samedi bloque cette couleur)' : ''}.`] }
    }
    case 'CHOOSE_COLOR_ROLL_TAKE_KEY': {
      const p = state.players[idx]
      return {
        ...state,
        pendingKeyColor: { playerIndex: idx },
        log: [...state.log, `${p.villainName} (00:00) : choisissez une couleur, puis lancez le dé.`],
      }
    }
    case 'LOSE_KEY_GAIN_POWER':
    case 'LOSE_KEY_DRAW': {
      const p = state.players[idx]
      const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
      const then = effect.type === 'LOSE_KEY_GAIN_POWER' ? { gainPower: effect.power } : { draw: effect.draw }
      if (owned.length === 0) {
        // Pas de clé à perdre : on applique directement le bonus.
        if ('gainPower' in then && then.gainPower) {
          const g = updatePlayer(state, idx, (pl) => ({ ...pl, power: pl.power + then.gainPower! }))
          return { ...g, log: [...g.log, `${p.villainName} : aucune clé à perdre → +${then.gainPower} Pouvoir.`] }
        }
        return { ...drawNCards(state, idx, (then as { draw: number }).draw), log: [...state.log, `${p.villainName} : aucune clé à perdre → pioche.`] }
      }
      return {
        ...state,
        // chooseDest : le joueur choisit AUSSI le lieu où reposer la clé (< 3 clés).
        pendingKey: { playerIndex: idx, kind: 'lose', chooseDest: true, then, label: 'Choisissez une clé à perdre' },
        log: [...state.log, `${p.villainName} : choisissez une clé à perdre.`],
      }
    }
    case 'GAIN_POWER_PER_KEY_COLOR': {
      const p = state.players[idx]
      const n = ownedKeyColors(p).size
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: pl.power + n }))
      return { ...next, log: [...next.log, `${p.villainName} gagne ${n} Pouvoir (1 par couleur de clé possédée).`] }
    }
    case 'DRAW_PER_OPPONENT_DISCARD': {
      const n = state.activeDiscardedCount ?? 0
      if (n === 0) return state
      const next = drawNCards(state, idx, n)
      return { ...next, log: [...next.log, `${state.players[idx].villainName} pioche ${n} carte${n > 1 ? 's' : ''} (Misérable cloporte).`] }
    }
    case 'CAP_OPPONENT_NEXT_TURN': {
      // Peste : plafonne le PROCHAIN tour de l'adversaire actif.
      const opp = state.activePlayer
      const next = updatePlayer(state, opp, (pl) => ({ ...pl, actionsCapNextTurn: effect.actions }))
      return { ...next, log: [...next.log, `Peste : ${state.players[opp].villainName} ne pourra réaliser qu'${effect.actions === 1 ? 'une seule action' : `${effect.actions} actions`} à son prochain tour.`] }
    }
    case 'DISCARD_HAND_DRAW': {
      const p = state.players[idx]
      const handCount = p.hand.length
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, discard: [...pl.discard, ...pl.hand], hand: [] }))
      next = drawNCards(next, idx, effect.draw)
      return { ...next, log: [...next.log, `${p.villainName} défausse ${handCount} carte${handCount > 1 ? 's' : ''} et pioche ${effect.draw} (Manque de temps).`] }
    }
    case 'GRANT_REPEAT_ACTION_NEXT_TURN': {
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, repeatActionNextTurn: true }))
      return { ...next, log: [...next.log, `${state.players[idx].villainName} : au prochain tour, une action pourra être effectuée 2 fois (Carte Temps).`] }
    }
    case 'TARGET_DISCARD_ALL_OF_TYPE': {
      const p = state.players[idx]
      const toDiscard = p.hand.filter((c) => c.type === effect.cardType)
      if (toDiscard.length === 0) return { ...state, log: [...state.log, `${p.villainName} : aucune carte ${effect.cardType} à défausser.`] }
      const ids = new Set(toDiscard.map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, hand: pl.hand.filter((c) => !ids.has(c.instanceId)), discard: [...pl.discard, ...toDiscard] }))
      return { ...next, log: [...next.log, `${p.villainName} défausse ${toDiscard.length} carte(s) Événement (Anne de Chantraine).`] }
    }
    case 'ROLL_DIE_BLOCK_KEY_COLOR': {
      const roll = rollColorDie(state.rngState)
      const next = updatePlayer({ ...state, rngState: roll.rngState, lastDieColor: roll.color }, idx, (pl) => ({ ...pl, dieBlockedColor: roll.color }))
      return { ...next, log: [...next.log, `Baron Samedi (dé : **${roll.color}**) : tant qu'il est présent, ${state.players[idx].villainName} ne peut pas gagner de clé ${KEY_LABEL[roll.color]} au dé.`] }
    }
    case 'STEAL_KEY_TO_HERO': {
      const host = ctx?.hostInstanceId
      const p = state.players[idx]
      const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
      if (!host || owned.length === 0) return { ...state, log: [...state.log, `Gévaudan : aucune clé à voler.`] }
      // Gévaudan vole 2 clés (ou autant que possible). L'adversaire (joueur actif)
      // CHOISIT les clés une par une (interactif côté humain ; auto côté bot).
      const count = Math.min(2, owned.length)
      return {
        ...state,
        pendingStealKey: { chooserIndex: state.activePlayer, targetIndex: idx, mode: 'steal', hostInstanceId: host, count },
        log: [...state.log, `Gévaudan : choisissez ${count > 1 ? `${count} clés` : 'une clé'} à voler à ${p.villainName}.`],
      }
    }
    case 'RETURN_STOLEN_KEYS': {
      const host = ctx?.hostInstanceId
      const p = state.players[idx]
      if (!host || !(p.keys ?? []).some((k) => k.stolenBy === host)) return state
      const next = withKeys(state, idx, (p.keys ?? []).map((k) => (k.stolenBy === host ? { ...k, stolenBy: undefined, location: null } : k)))
      return { ...next, log: [...next.log, `Gévaudan éliminé : ${p.villainName} récupère sa/ses clé(s).`] }
    }
    case 'ROLL_DIE_LOSE_KEYS_COLOR': {
      const roll = rollColorDie(state.rngState)
      // Déclenche l'animation du dé de couleur (comme « Obtenir une clé ») : le lancer
      // est attribué au Seigneur (`idx`), donc l'anim s'affiche pour lui (l'humain qui
      // joue le Seigneur la voit lorsqu'on lui inflige cette Fatalité).
      let next: GameState = {
        ...state,
        rngState: roll.rngState,
        lastDieColor: roll.color,
        dieRoll: { seq: (state.dieRoll?.seq ?? 0) + 1, color: roll.color, by: idx },
      }
      const p = next.players[idx]
      const lost = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy && k.color === roll.color)
      if (lost.length === 0) return { ...next, log: [...next.log, `J'ai affronté mon cauchemar (dé : **${roll.color}**) : ${p.villainName} ne possède aucune clé ${KEY_LABEL[roll.color]}.`] }
      const locs = p.locations.map((l) => l.id)
      const lostIds = new Set(lost.map((k) => k.id))
      let i = 0
      next = withKeys(next, idx, (p.keys ?? []).map((k) => (lostIds.has(k.id) ? { ...k, location: locs[i++ % locs.length] } : k)))
      return { ...next, log: [...next.log, `J'ai affronté mon cauchemar (dé : **${roll.color}**) : ${p.villainName} perd ${lost.length} clé(s) ${KEY_LABEL[roll.color]}.`] }
    }
    case 'RETURN_OWNED_KEY_TO_BOARD': {
      const p = state.players[idx]
      const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
      if (owned.length === 0) return { ...state, log: [...state.log, `Sorcellerie : ${p.villainName} ne possède aucune clé.`] }
      // L'adversaire (joueur actif) CHOISIT la clé puis le lieu où la reposer (interactif
      // côté humain ; auto-résolu côté bot via l'énumération).
      return {
        ...state,
        pendingStealKey: { chooserIndex: state.activePlayer, targetIndex: idx, mode: 'return' },
        log: [...state.log, `Sorcellerie : choisissez une clé de ${p.villainName} et un lieu où la reposer.`],
      }
    }
    case 'REDISTRIBUTE_BOARD_KEYS': {
      const p = state.players[idx]
      const onBoard = (p.keys ?? []).filter((k) => k.location !== null && !k.stolenBy)
      if (onBoard.length === 0) return { ...state, log: [...state.log, `Duel : aucune clé sur le plateau.`] }
      const r = shuffle(onBoard, state.rngState)
      const locs = p.locations.map((l) => l.id)
      const assign = new Map<string, LocationId>()
      r.result.forEach((k, i) => assign.set(k.id, locs[i % locs.length]))
      const next = withKeys({ ...state, rngState: r.state }, idx, (p.keys ?? []).map((k) => (assign.has(k.id) ? { ...k, location: assign.get(k.id)! } : k)))
      return { ...next, log: [...next.log, `Duel : les ${onBoard.length} clés du plateau sont redistribuées aléatoirement.`] }
    }
    case 'PLAISIR_OU_SOUFFRANCE': {
      const p = state.players[idx]
      const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
      // FORCÉ sans clé : perdre du Pouvoir. FORCÉ sans Pouvoir : reposer une clé.
      if (owned.length === 0) {
        const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: Math.max(0, pl.power - effect.power) }))
        return { ...next, log: [...next.log, `Plaisir ou souffrance : ${p.villainName} n'a aucune clé → perd ${effect.power} Pouvoir.`] }
      }
      if (p.power === 0) {
        return {
          ...state,
          pendingKey: { playerIndex: idx, kind: 'lose', chooseDest: true, label: 'Reposez une clé (Plaisir ou souffrance)' },
          log: [...state.log, `Plaisir ou souffrance : ${p.villainName} n'a aucun Pouvoir → il doit reposer une clé.`],
        }
      }
      return {
        ...state,
        pendingPlaisir: { playerIndex: idx, power: effect.power },
        log: [...state.log, `Plaisir ou souffrance : ${p.villainName} doit choisir (perdre ${effect.power} Pouvoir ou reposer une clé).`],
      }
    }
    case 'QUELS_IDIOTS': {
      const p = state.players[idx]
      const canMove = quelsMoveCandidates(p).length > 0
      const canTutor = quelsTutorCandidates(p).length > 0
      if (!canMove && !canTutor) return { ...state, log: [...state.log, `${p.villainName} : aucun Allié à déplacer ni à chercher.`] }
      // Les DEUX options possibles → on demande laquelle (puis l'Allié).
      if (canMove && canTutor) {
        return {
          ...state,
          pendingQuelsIdiots: { playerIndex: idx, phase: 'choose', canMove, canTutor },
          log: [...state.log, `${p.villainName} (Quels idiots !) : déplacer un Allié ou en chercher un ?`],
        }
      }
      return canMove ? enterQuelsMove(state, idx) : enterQuelsTutor(state, idx)
    }
    case 'GAIN_CONFIANCE_WITH_RAIPONCE': {
      const p = state.players[idx]
      const rLoc = raiponceLocation(p)
      if (!rLoc || p.pawnLocation !== rLoc) return state
      const gain = effect.amount + (rLoc === p.locations[0]?.id ? effect.bonusAtTour : 0)
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, confiance: (pl.confiance ?? 0) + gain }))
      const actor = next.players[idx]
      return { ...next, log: [...next.log, `${actor.villainName} gagne ${gain} Confiance (avec Raiponce${rLoc === p.locations[0]?.id ? ' à la Tour' : ''}).`] }
    }
    case 'GAIN_POWER_PER_HERO_IN_REALM': {
      const heroes = countHeroesInRealm(state, idx)
      const gross = heroes * effect.amount * dioPowerFactor(state.players[idx])
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      const actor = next.players[idx]
      const note = gained < gross ? ' (Robin des Bois : −1)' : ''
      next = {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT (${heroes} héros × ${effect.amount})${note} (total : ${actor.power}).`,
        ],
      }
      // Animation « +amount 🪙 » sur CHAQUE Héros du royaume (source du gain).
      for (const cards of Object.values(next.players[idx].board)) {
        for (const c of cards) {
          if (c.type === 'hero') {
            next = pushFloatingFx(next, { kind: 'taxes-gain', amount: effect.amount, playerIndex: idx, instanceId: c.instanceId })
          }
        }
      }
      return pushRobinSteal(next, idx, gross - gained)
    }
    case 'LOSE_POWER_PER_HERO_IN_REALM': {
      // Team Rocket — Togepi : l'acteur (le joueur ciblé par la Fatalité) perd `amount`
      // pouvoir par Héros présent dans son royaume (plancher 0).
      const heroes = countHeroesInRealm(state, idx)
      const loss = Math.min(state.players[idx].power, heroes * effect.amount)
      if (loss <= 0) return state
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power - loss }))
      const actor = next.players[idx]
      return {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} perd ${loss} JT (${heroes} héros × ${effect.amount}) (total : ${actor.power}).`,
        ],
      }
    }
    case 'GAIN_POWER_PER_ALLY_IN_REALM': {
      const allies = Object.values(state.players[idx].board)
        .flat()
        .filter((c) => c.type === 'ally').length
      const gross = allies * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      const actor = next.players[idx]
      return {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT (${allies} allié${allies > 1 ? 's' : ''} × ${effect.amount}) (total : ${actor.power}).`,
        ],
      }
    }
    case 'GAIN_POWER_PER_CARD_AT_PAWN': {
      const actor = state.players[idx]
      const loc = actor.pawnLocation
      const count = loc
        ? (actor.board[loc] ?? []).filter((c) => c.cardId === effect.cardId && !c.attachedTo).length
        : 0
      const gross = count * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      if (gained === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucune carte ici → 0 JT.`] }
      }
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      return {
        ...next,
        log: [
          ...next.log,
          `${next.players[idx].villainName} gagne ${gained} JT (${count} × ${effect.amount}) sur son lieu.`,
        ],
      }
    }
    case 'GRANT_USE_COVERED_ACTION': {
      return {
        ...state,
        persifleurAvailable: true,
        log: [
          ...state.log,
          `${state.players[idx].villainName} : une action recouverte est jouable ce tour-ci (Brouillage).`,
        ],
      }
    }
    case 'USE_COVERED_ACTIONS_THIS_TURN': {
      // Bravo ! Bravo ! (Shere Khan) : `includeFire` lève AUSSI le recouvrement par un jeton
      // Feu ce tour-ci (le joueur choisit ensuite quelle action recouverte effectuer).
      return {
        ...state,
        uncoverCoveredActions: true,
        uncoverFireThisTurn: effect.includeFire ? true : state.uncoverFireThisTurn,
        uncoverExceptFate: effect.exceptFate ? true : state.uncoverExceptFate,
        log: [
          ...state.log,
          effect.includeFire
            ? `${state.players[idx].villainName} : les actions recouvertes (Héros ou jeton Feu) de son lieu sont jouables ce tour-ci (Bravo ! Bravo !).`
            : `${state.players[idx].villainName} : les actions recouvertes par un Héros (hors Fatalité) sont jouables ce tour-ci.`,
        ],
      }
    }
    case 'LOSE_POWER_TO_HOST': {
      // L'acteur perd jusqu'à `amount` JT, transférés en lockedPower sur la carte
      // hôte. Si l'acteur n'a pas assez de pouvoir, on prend ce qu'il reste.
      if (!ctx?.hostInstanceId) {
        throw new Error('LOSE_POWER_TO_HOST nécessite un hostInstanceId dans le contexte.')
      }
      const actor = state.players[idx]
      const taken = Math.min(effect.amount, actor.power)
      if (taken === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} n'a aucun JT à donner.`] }
      }
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power - taken }))
      next = patchCard(next, idx, ctx.hostInstanceId, (c) => ({
        ...c,
        lockedPower: (c.lockedPower ?? 0) + taken,
      }))
      const after = next.players[idx]
      return {
        ...next,
        log: [
          ...next.log,
          `${after.villainName} perd ${taken} JT, transférés sur une carte (total : ${after.power}).`,
        ],
      }
    }
    case 'RESHUFFLE_HOST_INTO_FATE_DECK': {
      // La carte hôte vient d'arriver en fateDiscard (Toby vaincu) : on l'en
      // retire, on la met dans fateDeck, on remélange.
      if (!ctx?.hostInstanceId) {
        throw new Error('RESHUFFLE_HOST_INTO_FATE_DECK nécessite un hostInstanceId.')
      }
      const actor = state.players[idx]
      const card = actor.fateDiscard.find((c) => c.instanceId === ctx.hostInstanceId)
      if (!card) return state // déjà déplacée ou absente
      const r = shuffle([...actor.fateDeck, card], state.rngState)
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== ctx.hostInstanceId),
        fateDeck: r.result,
      }))
      return {
        ...next,
        rngState: r.state,
        log: [...next.log, `**${card.name}** retourne dans la pioche Fatalité (remélangée).`],
      }
    }
    case 'SEARCH_AND_PLACE_HERO': {
      // Cherche un héros de cardId dans fateDeck + fateDiscard de l'acteur, le
      // retire et le pose au lieu hôte. Belle Marianne fait apparaître Robin.
      if (!ctx?.hostLocationId) {
        throw new Error('SEARCH_AND_PLACE_HERO nécessite un hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      const inDeck = actor.fateDeck.find((c) => c.cardId === effect.cardId)
      const inDiscard = inDeck ? undefined : actor.fateDiscard.find((c) => c.cardId === effect.cardId)
      const found = inDeck ?? inDiscard
      if (!found) return state // déjà en jeu / introuvable
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: inDeck ? p.fateDeck.filter((c) => c.instanceId !== found.instanceId) : p.fateDeck,
        fateDiscard: inDiscard ? p.fateDiscard.filter((c) => c.instanceId !== found.instanceId) : p.fateDiscard,
        board: { ...p.board, [loc]: [...(p.board[loc] ?? []), found] },
      }))
      const placeName = findLocation(actor, loc)?.name ?? loc
      next = {
        ...next,
        log: [...next.log, `**${found.name}** apparaît immédiatement sur **${placeName}** !`],
      }
      // Showcase : le Héros invoqué (Robin via Belle Marianne) « vole » vers son
      // lieu, comme un Héros Fatalité. L'UI masque l'exemplaire posé jusqu'à l'arrivée.
      next = pushShowcase(
        next,
        found.cardId,
        `${found.name} apparaît sur ${placeName} !`,
        idx,
        { playerIndex: idx, locationId: loc },
        found.instanceId,
      )
      const scIdx = next.showcaseEvents.length - 1
      // Le héros « apparu » déclenche aussi les Mandats d'Arrêt du lieu (C.1) ; on
      // anime le gain éventuel (« +N 🪙 ») à l'atterrissage du showcase.
      const powerBefore = next.players[idx].power
      next = triggerHeroArrival(next, idx, loc)
      const gain = next.players[idx].power - powerBefore
      if (gain > 0) {
        next = {
          ...next,
          showcaseEvents: next.showcaseEvents.map((e, i) =>
            i === scIdx ? { ...e, landingPowerGain: gain } : e,
          ),
        }
      }
      return next
    }
    case 'MOVE_HERO_TO_LOCATION': {
      if (!ctx?.targetHeroId) {
        throw new Error('MOVE_HERO_TO_LOCATION nécessite un targetHeroId dans le contexte.')
      }
      const target = ctx.targetHeroId
      const dest = effect.locationId
      const actor = state.players[idx]
      // Trouve la carte sur le board de l'acteur.
      let from: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === target)
        if (found) {
          from = loc.id
          hero = found
          break
        }
      }
      if (!hero || !from) throw new Error(`Héros « ${target} » introuvable.`)
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      const forbidden = new Set(hero.forbiddenLocations ?? [])
      if (forbidden.has(dest)) {
        throw new Error(`${hero.name} ne peut pas être déplacé(e) sur ${dest}.`)
      }
      // Le lieu de destination peut aussi refuser le Héros (Feu Infernal, Forêt
      // de Ronces). Note : cette vérification ignore la carte déjà présente
      // car le hero est déjà sur le board (mais à un autre lieu).
      const destCell = (actor.board[dest] ?? []).filter((c) => c.instanceId !== hero!.instanceId)
      for (const c of destCell) {
        const r = c.placementRestriction
        if (!r) continue
        if (r.type === 'no-heroes') {
          throw new Error(`${hero.name} ne peut pas être déplacé(e) sur ${dest} (Malédiction).`)
        }
        if (r.type === 'min-hero-strength' && (hero.strength ?? 0) < r.value) {
          throw new Error(`${hero.name} (force ${hero.strength ?? 0}) trop faible pour ${dest} (≥${r.value}).`)
        }
      }
      if (from === dest) {
        return { ...state, log: [...state.log, `**${hero.name}** est déjà à ${dest}.`] }
      }
      // Le Héros se déplace AVEC ses Objets associés (Pacte, Trident, Objets Fatalité).
      const carried = (actor.board[from] ?? []).filter((c) => c.attachedTo === target)
      const movingIds = new Set([target, ...carried.map((c) => c.instanceId)])
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [from!]: (p.board[from!] ?? []).filter((c) => !movingIds.has(c.instanceId)),
          [dest]: [...(p.board[dest] ?? []), hero!, ...carried],
        },
      }))
      next = {
        ...next,
        log: [...next.log, `**${hero.name}** est déplacé(e) sur **${dest}**.`],
      }
      // Davy Jones — Will Turner : « joué OU déplacé » → défausse un Allié de force ≤ 2 de
      // son NOUVEAU lieu (le cas « joué » est géré par onPlace).
      if (hero.cardId === 'will-turner') {
        next = resolveEffect(next, { type: 'WILL_TURNER_DISCARD' }, { actorIndex: idx, hostLocationId: dest })
      }
      // Ursula — Pacte : le Héros est éliminé s'il arrive sur le lieu de son Pacte.
      const afterPacte = checkPacteDefeat(next, idx, target, dest)
      if (afterPacte !== next) return afterPacte
      // L'arrivée déclenche les Mandats d'Arrêt du lieu (C.1).
      return triggerHeroArrival(next, idx, dest)
    }
    case 'MOVE_ALLY_FREELY': {
      if (!ctx?.allyMove) {
        throw new Error('MOVE_ALLY_FREELY nécessite ctx.allyMove.')
      }
      const { instanceId: aId, to } = ctx.allyMove
      const me = activePlayer(state)
      const from = locationOfCard(me, aId)
      if (!from) throw new Error(`Allié « ${aId} » introuvable.`)
      const card = (me.board[from] ?? []).find((c) => c.instanceId === aId)!
      if (card.type !== 'ally') throw new Error(`${card.name} n'est pas un Allié.`)
      if (from === to) return state
      // Inclut les objets associés (cohérence avec MOVE_CARD).
      const moving = (me.board[from] ?? []).filter(
        (c) => c.instanceId === aId || c.attachedTo === aId,
      )
      const movingIds = new Set(moving.map((c) => c.instanceId))
      const destName = findLocation(me, to)?.name ?? to
      const next = updateActivePlayer(state, (p) => ({
        ...p,
        board: {
          ...p.board,
          [from]: (p.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
          [to]: [...(p.board[to] ?? []), ...moving],
        },
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `${me.villainName} déplace **${card.name}** vers **${destName}** (Tendre un Piège).`,
        ],
      }
    }
    case 'RELOCATE_HERO_ADJACENT': {
      // Apparition : l'acteur déplacera un de ses Héros vers un lieu voisin.
      const actor = state.players[idx]
      const hasHero = Object.values(actor.board).some((cards) => cards.some((c) => c.type === 'hero'))
      if (!hasHero) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros à déplacer (Apparition).`] }
      }
      return {
        ...state,
        pendingHeroRelocate: { chooserIndex: idx, targetIndex: idx },
        log: [...state.log, `${actor.villainName} : déplacez un Héros vers un lieu voisin (Apparition).`],
      }
    }
    case 'TELEPORT_TO_HERO': {
      // Téléportation : le pion ira sur un lieu portant un Héros (sans Lampe de
      // poche). Le choix du lieu est interactif (RESOLVE_TELEPORT).
      const actor = state.players[idx]
      const dests = teleportTargets(actor)
      if (dests.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros accessible (Téléportation).`] }
      }
      return {
        ...state,
        pendingTeleport: { playerIndex: idx },
        log: [...state.log, `${actor.villainName} : choisissez le lieu où vous téléporter (Téléportation).`],
      }
    }
    case 'GRANT_SKIP_NEXT_MOVE': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, skipNextMove: true }))
      return {
        ...next,
        log: [...next.log, `${next.players[idx].villainName} : prochain déplacement non obligatoire.`],
      }
    }
    case 'PEEK_BOTTOM_THEN_CHOOSE': {
      // Retourne-toi : révèle la dernière carte de la pioche de l'acteur et met
      // l'état en attente d'un choix (RESOLVE_DECK_PEEK). Si la pioche est vide,
      // rien à révéler → no-op.
      const actor = state.players[idx]
      if (actor.deck.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche vide, rien à révéler (Retourne-toi).`] }
      }
      const bottom = actor.deck[actor.deck.length - 1]
      return {
        ...state,
        pendingDeckPeek: { playerIndex: idx, card: bottom },
        log: [...state.log, `${actor.villainName} regarde la dernière carte de sa pioche (Retourne-toi).`],
      }
    }
    case 'RESHUFFLE_DISCARD_AND_DRAW': {
      // Perdu dans les bois : défausse + pioche → nouvelle pioche mélangée, puis
      // pioche `count` cartes.
      const actor = state.players[idx]
      const combined = [...actor.deck, ...actor.discard]
      if (combined.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides.`] }
      }
      const r = shuffle(combined, state.rngState)
      const drawn = r.result.slice(0, effect.count)
      const remaining = r.result.slice(effect.count)
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck: remaining,
        discard: [],
        hand: [...p.hand, ...drawn],
      }))
      return {
        ...next,
        rngState: r.state,
        activeDrewCard: drawn.length > 0 ? true : state.activeDrewCard,
        log: [
          ...next.log,
          `${actor.villainName} mélange sa défausse et sa pioche, puis pioche ${drawn.length} carte${drawn.length > 1 ? 's' : ''}.`,
        ],
      }
    }
    case 'RESHUFFLE_FATE_THEN_REORDER': {
      // Je ne reviens jamais : remélange la défausse Fatalité dans la pioche Fatalité,
      // puis le joueur regarde les `count` premières cartes et les replace dans l'ordre
      // de son choix (pendingFateReorder).
      const actor = state.players[idx]
      const combined = [...actor.fateDeck, ...actor.fateDiscard]
      if (combined.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse Fatalité vides.`] }
      }
      const r = shuffle(combined, state.rngState)
      const top = r.result.slice(0, effect.count)
      const rest = r.result.slice(top.length)
      let next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: rest, fateDiscard: [] }))
      next = { ...next, rngState: r.state, log: [...next.log, `${actor.villainName} mélange sa Fatalité et regarde les ${top.length} premières cartes.`] }
      // Une seule carte → rien à réordonner : on la remet sur le dessus.
      if (top.length <= 1) {
        return updatePlayer(next, idx, (p) => ({ ...p, fateDeck: [...top, ...p.fateDeck] }))
      }
      return { ...next, pendingFateReorder: { playerIndex: idx, cards: top } }
    }
    case 'DISCARD_ANY_THEN_REFILL': {
      // J'allais oublier un détail : l'acteur défausse un nombre libre de cartes
      // (choix interactif, 0 inclus) puis complète sa main à `handLimit`. Main vide :
      // rien à défausser → on complète directement (pas de choix à proposer).
      const actor = state.players[idx]
      if (actor.hand.length === 0) {
        const dr = drawPlayerToLimit(actor, state.rngState, effect.handLimit)
        return {
          ...updatePlayer(state, idx, () => dr.player),
          rngState: dr.rngState,
          activeDrewCard: dr.drawn > 0 ? true : state.activeDrewCard,
          log: [...state.log, `${actor.villainName} pioche ${dr.drawn} carte${dr.drawn > 1 ? 's' : ''}${effect.label ? ` (${effect.label})` : ''}.`],
        }
      }
      // Sinon : ouvre la sélection interactive (défausse facultative + complétion).
      return {
        ...state,
        pendingTyrannyDiscard: {
          playerIndex: idx,
          count: 0,
          optional: true,
          drawTo: effect.handLimit,
          label: effect.label,
        },
      }
    }
    case 'CHOOSE_TYPE_REVEAL_DRAW': {
      // Tombée de la nuit : met l'état en attente d'un choix de type (Événement/
      // Objet). La révélation des cartes a lieu à la résolution (RESOLVE_TYPE_CHOICE).
      const actor = state.players[idx]
      if (actor.deck.length === 0 && actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (Tombée de la nuit).`] }
      }
      return {
        ...state,
        pendingTypeChoice: { playerIndex: idx, count: effect.count, types: ['effect', 'item'] },
        log: [...state.log, `${actor.villainName} : choisissez Événement ou Objet (Tombée de la nuit).`],
      }
    }
    case 'REVEAL_UNTIL_TYPE': {
      // Prédiction (Jafar) : choix d'un type, puis on dévoile la pioche jusqu'à en
      // trouver un. La révélation a lieu à la résolution (RESOLVE_TYPE_CHOICE).
      const actor = state.players[idx]
      if (actor.deck.length === 0 && actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (Prédiction).`] }
      }
      return {
        ...state,
        pendingTypeChoice: { playerIndex: idx, count: 0, types: effect.types, untilFound: true, excludePiratage: effect.excludePiratage },
        log: [...state.log, `${actor.villainName} : choisissez un type (Prédiction).`],
      }
    }
    case 'CAPTURE_CARDS_AT_HOST': {
      // À la pose d'un Héros (Enquêteur/Enfant Perdu) : associe jusqu'à `max`
      // cartes `cardId` (Pages) du lieu hôte au Héros — elles sont « capturées »
      // (attachedTo = hôte) et ne comptent plus dans le royaume.
      if (!ctx?.hostInstanceId || !ctx?.hostLocationId) {
        throw new Error('CAPTURE_CARDS_AT_HOST nécessite hostInstanceId + hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const host = ctx.hostInstanceId
      const cell = state.players[idx].board[loc] ?? []
      const candidates = cell.filter((c) => c.cardId === effect.cardId && !c.attachedTo)
      const take = effect.max !== undefined ? candidates.slice(0, effect.max) : candidates
      if (take.length === 0) return state
      const takeIds = new Set(take.map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [loc]: (p.board[loc] ?? []).map((c) =>
            takeIds.has(c.instanceId) ? { ...c, attachedTo: host } : c,
          ),
        },
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `**${take[0].name}** ×${take.length} capturée${take.length > 1 ? 's' : ''} par le Héros.`,
        ],
      }
    }
    case 'RELEASE_CAPTURED_TO_HAND': {
      // À la mort du Héros : les cartes capturées (associées à l'hôte) reviennent
      // dans la MAIN de l'acteur (Slenderman récupère ses Pages).
      if (!ctx?.hostInstanceId || !ctx?.hostLocationId) {
        throw new Error('RELEASE_CAPTURED_TO_HAND nécessite hostInstanceId + hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const host = ctx.hostInstanceId
      const cell = state.players[idx].board[loc] ?? []
      const captured = cell.filter(
        (c) => c.attachedTo === host && (!effect.cardId || c.cardId === effect.cardId),
      )
      if (captured.length === 0) return state
      const ids = new Set(captured.map((c) => c.instanceId))
      const returned = captured.map((c) => ({ ...c, attachedTo: undefined }))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !ids.has(c.instanceId)) },
        hand: [...p.hand, ...returned],
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `${next.players[idx].villainName} récupère ${returned.length} **${returned[0].name}** en main.`,
        ],
      }
    }
    case 'ARM_DRAGON_FORM_REWARD': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, dragonFormReward: true }))
      return {
        ...next,
        log: [
          ...next.log,
          `${next.players[idx].villainName} : Apparence de Dragon — +3 JT si fatalisé avant son prochain tour.`,
        ],
      }
    }
    case 'INSTANT_VANQUISH_HERO_LE': {
      if (!ctx?.targetHeroId) {
        throw new Error('INSTANT_VANQUISH_HERO_LE nécessite un targetHeroId.')
      }
      const target = ctx.targetHeroId
      const actor = state.players[idx]
      let heroLoc: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === target)
        if (found) { heroLoc = loc.id; hero = found; break }
      }
      if (!hero || !heroLoc) throw new Error(`Héros « ${target} » introuvable.`)
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      if ((hero.strength ?? 0) > effect.maxStrength) {
        throw new Error(`${hero.name} (force ${hero.strength}) > ${effect.maxStrength} : non vaincu.`)
      }
      // Sale voleuse ! : cible restreinte à certains Héros (Cendrillon / robe de bal).
      if (effect.onlyCardIds && !effect.onlyCardIds.includes(hero.cardId)) {
        throw new Error(`${hero.name} ne peut pas être visé par cette carte.`)
      }
      // « sur le lieu où vous vous trouvez » (Ah, je suis un serpent ?).
      if (effect.atPawn && heroLoc !== actor.pawnLocation) {
        throw new Error(`${hero.name} n'est pas sur votre lieu.`)
      }
      // Déguisement : refus.
      const hasDeguisement = (actor.board[heroLoc] ?? []).some(
        (c) => c.cardId === 'deguisement' && c.attachedTo === target,
      )
      if (hasDeguisement) {
        throw new Error(`${hero.name} est invulnérable (Déguisement).`)
      }
      const locked = hero.lockedPower ?? 0
      const heroDiscarded: CardInstance = { ...hero, lockedPower: undefined }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [heroLoc!]: (p.board[heroLoc!] ?? []).filter((c) => c.instanceId !== target) },
        fateDiscard: [...p.fateDiscard, heroDiscarded],
        power: p.power + locked,
      }))
      next = {
        ...next,
        lastVanquishedHeroStrength: hero.strength ?? 0,
        log: [
          ...next.log,
          `${actor.villainName} élimine instantanément **${hero.name}** (Apparence de Dragon).`,
          ...(locked > 0
            ? [`${locked} JT verrouillé${locked > 1 ? 's' : ''} restitué${locked > 1 ? 's' : ''}.`]
            : []),
        ],
      }
      // Effets « à la mort » du héros (Toby reshuffle, Belle Marianne → Robin).
      return resolveEffects(next, hero.onVanquish ?? [], {
        actorIndex: idx,
        hostInstanceId: hero.instanceId,
        hostLocationId: heroLoc,
      })
    }
    case 'INSTANT_VANQUISH_ALL_HEROES': {
      // Douze coups de minuit : élimine TOUS les Héros du royaume, sans choix.
      const actor0 = state.players[idx]
      const targets: string[] = []
      for (const loc of actor0.locations) {
        for (const c of actor0.board[loc.id] ?? []) {
          if (c.type === 'hero') targets.push(c.instanceId)
        }
      }
      if (targets.length === 0) return state
      let next = state
      let count = 0
      for (const id of targets) {
        const actor = next.players[idx]
        let heroLoc: LocationId | undefined
        let hero: CardInstance | undefined
        for (const loc of actor.locations) {
          const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === id)
          if (found) { heroLoc = loc.id; hero = found; break }
        }
        if (!hero || !heroLoc || hero.type !== 'hero') continue // déjà parti (onVanquish précédent)
        const locked = hero.lockedPower ?? 0
        const heroDiscarded: CardInstance = { ...hero, lockedPower: undefined }
        const hl = heroLoc
        next = updatePlayer(next, idx, (p) => ({
          ...p,
          board: { ...p.board, [hl]: (p.board[hl] ?? []).filter((c) => c.instanceId !== id) },
          fateDiscard: [...p.fateDiscard, heroDiscarded],
          power: p.power + locked,
        }))
        next = { ...next, lastVanquishedHeroStrength: hero.strength ?? 0 }
        next = resolveEffects(next, hero.onVanquish ?? [], {
          actorIndex: idx,
          hostInstanceId: hero.instanceId,
          hostLocationId: heroLoc,
        })
        count++
      }
      return {
        ...next,
        log: [...next.log, `${state.players[idx].villainName} élimine tous les Héros de son royaume (${count}) — Douze coups de minuit.`],
      }
    }
    case 'FETCH_FATE_ITEMS_TO_REALM': {
      // Douze coups de minuit : ramène toutes les copies de l'Objet (Pantoufle de
      // Verre) — pioche + défausse Fatalité + plateau — et les pose, non associées.
      const actor = state.players[idx]
      const wanted = new Set(effect.cardIds)
      const onBoard: CardInstance[] = []
      for (const loc of actor.locations) {
        for (const c of actor.board[loc.id] ?? []) if (wanted.has(c.cardId)) onBoard.push(c)
      }
      const all = [
        ...actor.fateDeck.filter((c) => wanted.has(c.cardId)),
        ...actor.fateDiscard.filter((c) => wanted.has(c.cardId)),
        ...onBoard,
      ]
      if (all.length === 0) return state
      const ids = new Set(all.map((c) => c.instanceId))
      const dest = effect.locationId ?? actor.pawnLocation ?? actor.locations[0]?.id
      if (!dest) return state
      const placed = all.map((c) => ({ ...c, attachedTo: undefined }))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: p.fateDeck.filter((c) => !ids.has(c.instanceId)),
        fateDiscard: p.fateDiscard.filter((c) => !ids.has(c.instanceId)),
        board: Object.fromEntries(
          p.locations.map((l) => [
            l.id,
            l.id === dest
              ? [...(p.board[l.id] ?? []).filter((c) => !ids.has(c.instanceId)), ...placed]
              : (p.board[l.id] ?? []).filter((c) => !ids.has(c.instanceId)),
          ]),
        ),
      }))
      const name = placed[0]?.name ?? 'Objet'
      return {
        ...next,
        log: [...next.log, `${actor.villainName} cherche et joue ${placed.length} **${name}** sur **${locName(actor, dest)}**.`],
      }
    }
    case 'MOVE_NAMED_HERO_TO_AND_TRAP': {
      // La Clé (pose) : déplace Cendrillon (si présente) vers sa Chambre puis la piège.
      const actor = state.players[idx]
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const f = (actor.board[loc.id] ?? []).find((c) => c.type === 'hero' && c.cardId === effect.heroCardId)
        if (f) { hero = f; break }
      }
      if (!hero) return state
      let next = resolveEffect(state, { type: 'MOVE_HERO_TO_LOCATION', locationId: effect.locationId }, { actorIndex: idx, targetHeroId: hero.instanceId })
      next = resolveEffect(next, { type: 'TRAP_HERO' }, { actorIndex: idx, targetHeroId: hero.instanceId })
      return next
    }
    case 'INSTANT_VANQUISH_HERO_AT_PAWN': {
      if (!ctx?.targetHeroId) {
        throw new Error('INSTANT_VANQUISH_HERO_AT_PAWN nécessite un targetHeroId.')
      }
      const target = ctx.targetHeroId
      const actor = state.players[idx]
      let heroLoc: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === target)
        if (found) { heroLoc = loc.id; hero = found; break }
      }
      if (!hero || !heroLoc) throw new Error(`Héros « ${target} » introuvable.`)
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      if (heroLoc !== actor.pawnLocation) {
        throw new Error(`${hero.name} n'est pas sur votre lieu (Disparition).`)
      }
      const hasDeguisement = (actor.board[heroLoc] ?? []).some(
        (c) => c.cardId === 'deguisement' && c.attachedTo === target,
      )
      if (hasDeguisement) {
        throw new Error(`${hero.name} est invulnérable (Déguisement).`)
      }
      const locked = hero.lockedPower ?? 0
      const heroDiscarded: CardInstance = { ...hero, lockedPower: undefined }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [heroLoc!]: (p.board[heroLoc!] ?? []).filter((c) => c.instanceId !== target) },
        fateDiscard: [...p.fateDiscard, heroDiscarded],
        power: p.power + locked,
      }))
      next = {
        ...next,
        lastVanquishedHeroStrength: hero.strength ?? 0,
        log: [
          ...next.log,
          `${actor.villainName} fait disparaître **${hero.name}** (Disparition).`,
          ...(locked > 0
            ? [`${locked} JT verrouillé${locked > 1 ? 's' : ''} restitué${locked > 1 ? 's' : ''}.`]
            : []),
        ],
      }
      return resolveEffects(next, hero.onVanquish ?? [], {
        actorIndex: idx,
        hostInstanceId: hero.instanceId,
        hostLocationId: heroLoc,
      })
    }
    case 'VANQUISH_HERO': {
      if (!ctx?.targetHeroId) {
        throw new Error('VANQUISH_HERO nécessite un targetHeroId dans le contexte.')
      }
      if (!ctx.allyInstanceIds || ctx.allyInstanceIds.length === 0) {
        throw new Error('VANQUISH_HERO nécessite allyInstanceIds dans le contexte.')
      }
      return performVanquish(state, ctx.targetHeroId, ctx.allyInstanceIds, effect.keepAllies)
    }
    case 'OPTIONAL_FREE_VANQUISH': {
      // Sa Sucrerie — Duncan et Wynnchel (joué OU déplacé) : action « Éliminer un
      // Héros » facultative, à n'importe quel lieu portant un Héros. Sans Héros dans
      // le royaume → aucun effet (on n'ouvre pas une fenêtre vide).
      const hasHero = Object.values(state.players[idx].board)
        .flat()
        .some((c) => c.type === 'hero')
      if (!hasHero) return state
      return {
        ...state,
        pendingTrapVanquish: { source: 'duncan' },
        log: [...state.log, `${state.players[idx].villainName} : vous pouvez effectuer une action Éliminer un Héros (facultatif).`],
      }
    }
    case 'DISCARD_CARDS_AT_HOST': {
      // Sur le lieu hôte, défausse toutes les cartes de cardId donné présentes
      // chez l'acteur — ainsi que leurs Objets associés (cohérence avec MOVE_CARD).
      if (!ctx?.hostLocationId) {
        throw new Error('DISCARD_CARDS_AT_HOST nécessite un hostLocationId dans le contexte.')
      }
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      const cards = actor.board[loc] ?? []
      const targeted = cards.filter((c) => c.cardId === effect.cardId)
      if (targeted.length === 0) return state
      const targetedIds = new Set(targeted.map((c) => c.instanceId))
      const alsoAttached = cards.filter((c) => c.attachedTo && targetedIds.has(c.attachedTo))
      const toDiscard = [...targeted, ...alsoAttached]
      const toDiscardIds = new Set(toDiscard.map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !toDiscardIds.has(c.instanceId)) },
        discard: [...p.discard, ...toDiscard],
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `${targeted[0].name} ×${targeted.length} défaussé${targeted.length > 1 ? 's' : ''} de ce lieu.`,
        ],
      }
    }
    case 'DISCARD_ALLIES_AT_HOST': {
      if (!ctx?.hostLocationId) {
        throw new Error('DISCARD_ALLIES_AT_HOST nécessite un hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      // L'Omnidroïde (tuile) n'est PAS affecté par les effets visant les Alliés/Objets.
      const allies = (actor.board[loc] ?? []).filter((c) => c.type === 'ally' && !c.immuneToAllyItemEffects)
      if (allies.length === 0) return state
      const ids = new Set(allies.map((c) => c.instanceId))
      // Objets associés à ces alliés suivent.
      const attached = (actor.board[loc] ?? []).filter(
        (c) => c.attachedTo && ids.has(c.attachedTo),
      )
      const toDiscardIds = new Set([...ids, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !toDiscardIds.has(c.instanceId)) },
        discard: [...p.discard, ...allies, ...attached],
      }))
      return {
        ...next,
        log: [...next.log, `${allies.length} Allié${allies.length > 1 ? 's' : ''} défaussé${allies.length > 1 ? 's' : ''} (Prince Philippe).`],
      }
    }
    case 'PULL_ALLY_FROM_EACH_ADJACENT': {
      if (!ctx?.hostLocationId) {
        throw new Error('PULL_ALLY_FROM_EACH_ADJACENT nécessite un hostLocationId.')
      }
      const dest = ctx.hostLocationId
      const actor = state.players[idx]
      const adj = adjacentLocationIds(state, dest)
      // « Vous pouvez déplacer un Allié de chaque lieu voisin » : c'est le joueur
      // qui a joué la Fatalité qui choisit (un Allié par lieu voisin, optionnel).
      const anyAlly = adj.some((a) => (actor.board[a] ?? []).some((c) => c.type === 'ally'))
      if (!anyAlly) return state
      return {
        ...state,
        pendingHubertPull: { chooserIndex: state.activePlayer, targetIndex: idx, dest },
        log: [
          ...state.log,
          `Roi Hubert : ${actor.villainName} peut attirer un Allié de chaque lieu voisin.`,
        ],
      }
    }
    case 'MOVE_OWNER_PAWN_FORCED': {
      // « Vous pouvez déplacer Maléfique sur n'importe quel lieu » : le LIEU (ou
      // le fait de ne pas bouger) est choisi par le joueur qui a joué la Fatalité
      // (`state.activePlayer`). On met l'état en attente (RESOLVE_PAWN_MOVE).
      return {
        ...state,
        pendingPawnMove: { chooserIndex: state.activePlayer, targetIndex: idx },
        log: [...state.log, `Roi Stéphane : ${state.players[idx].villainName} peut être déplacé.`],
      }
    }
    case 'MOVE_OWNER_PAWN_IF_AT_PAWN': {
      // Le Satyre : joué (onPlace) sur le lieu du pion du propriétaire → le joueur
      // qui pose la Fatalité (`state.activePlayer`) peut déplacer ce pion n'importe
      // où (pendingPawnMove). Sinon, aucun effet.
      const p = state.players[idx]
      const label = effect.label ?? 'Le Satyre'
      if (!ctx?.hostLocationId || ctx.hostLocationId !== p.pawnLocation) return state
      return {
        ...state,
        pendingPawnMove: { chooserIndex: state.activePlayer, targetIndex: idx, via: label },
        log: [...state.log, `${label} : le pion de ${p.villainName} peut être déplacé sur n'importe quel lieu.`],
      }
    }
    case 'REVEAL_FATE_TOP_PLAY_IF_HERO': {
      if (!ctx?.hostLocationId) {
        throw new Error('REVEAL_FATE_TOP_PLAY_IF_HERO nécessite un hostLocationId.')
      }
      const actor = state.players[idx]
      if (actor.fateDeck.length === 0 && actor.fateDiscard.length === 0) return state
      const r = revealFate(actor, 1, state.rngState)
      const revealed = r.revealed[0]
      if (!revealed) return state
      const revealName = state.players[idx].villainName
      if (revealed.type !== 'hero') {
        // Remettre la carte sur le dessus de la pioche (post-reshuffle).
        const next = updatePlayer(state, idx, () => ({
          ...r.player,
          fateDeck: [revealed, ...r.player.fateDeck],
        }))
        return {
          ...next,
          rngState: r.rngState,
          log: [...next.log, `${revealName} : Fatalité révèle **${revealed.name}** (non-Héros) → remise sur la pioche.`],
        }
      }
      // Héros : le LIEU est choisi par le joueur qui a joué la Fatalité
      // (`state.activePlayer`). On met l'état en attente (pendingHeroPlacement) ;
      // la pose réelle se fait via RESOLVE_HERO_PLACEMENT (UI humain / auto bot).
      let next = updatePlayer(state, idx, () => r.player)
      next = { ...next, rngState: r.rngState }
      const validLocs = heroPlacementLocations(next, revealed, idx)
      if (validLocs.length === 0) {
        // Aucun lieu valide → défausse Fatalité.
        next = updatePlayer(next, idx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, revealed] }))
        return {
          ...next,
          log: [...next.log, `${revealName} : Fatalité révèle **${revealed.name}** mais aucun lieu valide → défaussé.`],
        }
      }
      return {
        ...next,
        pendingHeroPlacement: { chooserIndex: next.activePlayer, targetIndex: idx, hero: revealed },
        log: [...next.log, `${revealName} : Fatalité révèle **${revealed.name}** — à placer.`],
      }
    }
    case 'UNLOCK_LOCATION': {
      // Jafar (Scarabée d'Or) : retire le Cadenas d'un lieu de l'acteur.
      const actor = state.players[idx]
      if (!(actor.lockedLocations ?? []).includes(effect.locationId)) return state
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        lockedLocations: (p.lockedLocations ?? []).filter((l) => l !== effect.locationId),
      }))
      const name = findLocation(actor, effect.locationId)?.name ?? effect.locationId
      return {
        ...next,
        log: [...next.log, `${actor.villainName} déverrouille **${name}** (Scarabée d'Or).`],
      }
    }
    case 'SUMMON_FATE_HERO_TO_OWN_REALM': {
      // Jafar (Lampe Merveilleuse) : cherche le Génie dans SON deck/défausse
      // Fatalité et le pose sur SON board au lieu indiqué.
      const loc = effect.locationId
      const actor = state.players[idx]
      const inDeck = actor.fateDeck.find((c) => c.cardId === effect.heroCardId)
      const inDiscard = inDeck
        ? undefined
        : actor.fateDiscard.find((c) => c.cardId === effect.heroCardId)
      const found = inDeck ?? inDiscard
      if (!found) {
        return {
          ...state,
          log: [...state.log, `${actor.villainName} : ${effect.heroCardId} introuvable dans la Fatalité.`],
        }
      }
      // Respecte le verrou / les restrictions de pose : si le lieu demandé n'est pas
      // valide (ex. Salle de Bal verrouillée → Cendrillon en robe de bal), on prend le
      // premier lieu valide. Aucun lieu valide → le Héros n'est pas invoqué.
      const validLocs = heroPlacementLocations(state, found, idx)
      const placeLoc = validLocs.includes(loc) ? loc : validLocs[0]
      if (placeLoc === undefined) {
        return {
          ...state,
          log: [...state.log, `**${found.name}** ne peut être invoqué (aucun lieu valide).`],
        }
      }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: inDeck ? p.fateDeck.filter((c) => c.instanceId !== found.instanceId) : p.fateDeck,
        fateDiscard: inDiscard
          ? p.fateDiscard.filter((c) => c.instanceId !== found.instanceId)
          : p.fateDiscard,
        board: { ...p.board, [placeLoc]: [...(p.board[placeLoc] ?? []), found] },
      }))
      const placeName = findLocation(actor, placeLoc)?.name ?? placeLoc
      next = {
        ...next,
        log: [...next.log, `**${found.name}** est invoqué sur **${placeName}** !`],
      }
      next = pushShowcase(
        next,
        found.cardId,
        `${found.name} apparaît sur ${placeName} !`,
        idx,
        { playerIndex: idx, locationId: placeLoc },
        found.instanceId,
      )
      return triggerHeroArrival(next, idx, placeLoc)
    }
    case 'MOVE_ALLY_TO_HOST': {
      // Pataud (onPlace) : attire l'Allié `cardId` (Lucifer) sur le lieu hôte du Héros.
      const dest = ctx?.hostLocationId
      if (!dest) return state
      const actor = state.players[idx]
      let fromLoc: LocationId | undefined
      let ally: CardInstance | undefined
      for (const l of actor.locations) {
        const found = (actor.board[l.id] ?? []).find((c) => c.type === 'ally' && c.cardId === effect.cardId)
        if (found) { fromLoc = l.id; ally = found; break }
      }
      if (!ally || !fromLoc || fromLoc === dest) return state // pas en jeu / déjà sur place
      // L'Allié emmène ses Objets associés.
      const moving = (actor.board[fromLoc] ?? []).filter(
        (c) => c.instanceId === ally!.instanceId || c.attachedTo === ally!.instanceId,
      )
      const ids = new Set(moving.map((c) => c.instanceId))
      const fromId = fromLoc
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [fromId]: (p.board[fromId] ?? []).filter((c) => !ids.has(c.instanceId)),
          [dest]: [...(p.board[dest] ?? []), ...moving],
        },
      }))
      const destName = findLocation(actor, dest)?.name ?? dest
      return { ...next, log: [...next.log, `**${ally.name}** est attiré sur **${destName}**.`] }
    }
    case 'MAXIMUS_RELOCATE': {
      // Maximus (onPlace) : le joueur qui pose la Fatalité (state.activePlayer) peut
      // déplacer un Cavaliers du roi puis Maximus. Ouvre pendingMaximus.
      const chooser = state.activePlayer
      const target = idx
      const maximusId = ctx?.hostInstanceId
      if (maximusId === undefined) return state
      const hasCavaliers = Object.values(state.players[target].board)
        .flat()
        .some((c) => c.type === 'ally' && c.cardId === 'cavaliers-du-roi')
      return {
        ...state,
        pendingMaximus: {
          chooserIndex: chooser,
          targetIndex: target,
          maximusInstanceId: maximusId,
          // Sans Cavaliers en jeu, on passe directement au déplacement de Maximus.
          phase: hasCavaliers ? 'cavaliers' : 'maximus',
        },
        log: [...state.log, `**Maximus** : ${state.players[chooser].villainName} peut repositionner les Cavaliers du roi et Maximus.`],
      }
    }
    case 'DISCARD_OWN_FOR_POWER': {
      // Sacrifice Nécessaire : défausse l'Allié/Objet désigné (+ ses Objets
      // associés si c'est un Allié), puis gagne `amount` Pouvoir.
      const targetId = ctx?.allyInstanceIds?.[0]
      if (!targetId) throw new Error('DISCARD_OWN_FOR_POWER nécessite une carte à défausser.')
      const actor = state.players[idx]
      const cardLoc = locationOfCard(actor, targetId)
      if (!cardLoc) throw new Error('Carte à sacrifier absente du royaume.')
      const target = actor.board[cardLoc].find((c) => c.instanceId === targetId)!
      if (target.type !== 'ally' && target.type !== 'item') {
        throw new Error('Seul un Allié ou un Objet peut être sacrifié.')
      }
      // La carte + ses Objets associés (si Allié) partent en défausse.
      const removeIds = new Set<string>([targetId])
      for (const c of actor.board[cardLoc]) {
        if (c.attachedTo === targetId) removeIds.add(c.instanceId)
      }
      const removed = actor.board[cardLoc].filter((c) => removeIds.has(c.instanceId))
      // Jetons verrouillés éventuels restitués au joueur.
      const lockedBack = removed.reduce((n, c) => n + (c.lockedPower ?? 0), 0)
      const gained = Math.max(0, effect.amount - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        power: p.power + gained + lockedBack,
        board: {
          ...p.board,
          [cardLoc]: p.board[cardLoc].filter((c) => !removeIds.has(c.instanceId)),
        },
        discard: [...p.discard, ...removed.map((c) => ({ ...c, lockedPower: undefined, attachedTo: undefined }))],
      }))
      next = {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} sacrifie **${target.name}** → +${gained} JT (Sacrifice Nécessaire).`,
        ],
      }
      // Montre la/les carte(s) défaussée(s).
      next = pushDiscardShowcase(
        next,
        removed.map((c) => c.cardId),
        `${actor.villainName} sacrifie ${target.name}`,
        idx,
        'dark',
        'bottom',
      )
      return next
    }
    case 'ROYAL_CROQUET_ATTEMPT': {
      // Reine de Cœur — Coup Royal.
      const actor = state.players[idx]
      const everyLocHasWicket = actor.locations.every((loc) =>
        (actor.board[loc.id] ?? []).some((c) => c.isWicket),
      )
      if (!everyLocHasWicket) {
        return {
          ...state,
          log: [...state.log, `${actor.villainName} : Coup Royal raté — il faut un arceau sur chaque lieu.`],
        }
      }
      // Force totale des arceaux (modificateurs inclus).
      let wicketStrength = 0
      for (const loc of actor.locations) {
        for (const c of actor.board[loc.id] ?? []) {
          if (c.isWicket) wicketStrength += effectiveStrength(state, idx, c.instanceId) ?? c.strength ?? 0
        }
      }
      // Révéler les 5 premières cartes (remélange la défausse si besoin).
      let deck = actor.deck
      let discard = actor.discard
      let rngState = state.rngState
      if (deck.length < 5 && discard.length > 0) {
        const r = shuffle(discard, rngState)
        deck = [...deck, ...r.result]
        discard = []
        rngState = r.state
      }
      const revealed = deck.slice(0, 5)
      const rest = deck.slice(5)
      const costSum = revealed.reduce((n, c) => n + (c.cost ?? 0), 0)
      const won = costSum < wicketStrength
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck: rest,
        discard: won ? discard : [...discard, ...revealed],
      }))
      next = {
        ...next,
        rngState,
        pendingRoyalCroquet: { playerIndex: idx, revealed, wicketStrength, costSum, won },
        log: [
          ...next.log,
          `${actor.villainName} — Coup Royal : arceaux (force ${wicketStrength}) vs coûts révélés (${costSum}) → ${won ? 'RÉUSSI !' : 'raté'}.`,
        ],
      }
      if (won) {
        next = {
          ...next,
          status: 'WON',
          winner: idx,
          log: [...next.log, `🏆 ${actor.villainName} réussit le Coup Royal et l'emporte !`],
        }
      }
      return next
    }
    case 'SET_HERO_SIZE': {
      // Reine de Cœur — Rapetisser / Agrandir.
      const target = ctx?.targetHeroId
      if (!target) throw new Error('SET_HERO_SIZE nécessite un Héros cible.')
      const actor = state.players[idx]
      const heroLoc = locationOfCard(actor, target)
      if (!heroLoc) throw new Error('Héros introuvable dans le royaume.')
      const hero = actor.board[heroLoc].find((c) => c.instanceId === target)!
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      // On ne peut pas rapetisser deux fois un même Héros (la taille ne « cumule »
      // pas). Sans effet s'il est déjà rapetissé.
      if (effect.size === 'shrunk' && hero.heroSize === 'shrunk') {
        return {
          ...state,
          log: [...state.log, `**${hero.name}** est déjà rapetissé : on ne peut pas le rapetisser deux fois.`],
        }
      }
      const opposite = effect.size === 'shrunk' ? 'enlarged' : 'shrunk'
      // Si le Héros porte la taille opposée → retour à la normale ; sinon `size`.
      const newSize = hero.heroSize === opposite ? undefined : effect.size
      if (newSize === 'shrunk' && hero.cardId === 'loir') {
        return { ...state, log: [...state.log, 'Le Loir ne peut pas rapetisser.'] }
      }
      // Agrandir : on fixe le lieu adjacent recouvert (côté gauche/droite).
      // Si le joueur a choisi un sens (ctx.enlargeToward) et que c'est un voisin
      // valide, on le respecte ; sinon (bot / choix omis) on privilégie un voisin
      // non déjà entièrement recouvert (couverture non gaspillée).
      let enlargeTargetId: string | undefined
      if (newSize === 'enlarged') {
        const ids = actor.locations.map((l) => l.id)
        const i = ids.indexOf(heroLoc)
        const sides = [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id)
        enlargeTargetId =
          (ctx?.enlargeToward && sides.includes(ctx.enlargeToward) ? ctx.enlargeToward : undefined) ??
          sides.find(
            (id) =>
              !(actor.board[id] ?? []).some(
                (c) => c.type === 'hero' && !c.hypnotized && c.heroSize !== 'shrunk',
              ),
          ) ??
          sides[0]
      }
      // Rapetisser : le Héros laisse LIBRE une action du haut (choisie par le
      // joueur via ctx.shrinkFreeActionId) et recouvre l'autre. À défaut (bot /
      // choix omis), on libère la 1ʳᵉ action du haut de son lieu.
      let shrunkFreeActionId: string | undefined
      if (newSize === 'shrunk') {
        const tops = (actor.locations.find((l) => l.id === heroLoc)?.actions ?? []).filter(
          (a) => a.row === 'top',
        )
        shrunkFreeActionId =
          (ctx?.shrinkFreeActionId && tops.some((a) => a.id === ctx.shrinkFreeActionId)
            ? ctx.shrinkFreeActionId
            : undefined) ?? tops[0]?.id
      }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [heroLoc]: p.board[heroLoc].map((c) =>
            c.instanceId === target
              ? { ...c, heroSize: newSize, enlargeTargetId, shrunkFreeActionId }
              : c,
          ),
        },
      }))
      const verb =
        newSize === 'shrunk' ? 'rapetisse' : newSize === 'enlarged' ? 'agrandit' : 'rend à sa taille normale'
      return { ...next, log: [...next.log, `${actor.villainName} ${verb} **${hero.name}**.`] }
    }
    case 'DISCARD_ALLY_AT_HOST': {
      // Clochette : défausse un Allié (et ses Objets associés) sur son lieu.
      const loc = ctx?.hostLocationId
      const p = state.players[idx]
      const ally = loc
        ? (p.board[loc] ?? []).find((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
        : undefined
      if (!loc || !ally) {
        return { ...state, log: [...state.log, 'Clochette : aucun Allié à défausser sur ce lieu.'] }
      }
      const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === ally.instanceId)
      const removed = new Set([ally.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        board: { ...pp.board, [loc]: (pp.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
        discard: [...pp.discard, ally, ...attached],
      }))
      return { ...next, log: [...next.log, `Clochette défausse **${ally.name}**.`] }
    }
    case 'STEAL_ITEM_TO_HERO': {
      // Abu / Aladdin (Fatalité) : l'adversaire (chooser) choisit un Objet du lieu
      // du Héros (et, pour Aladdin, de la main de la cible) à associer au Héros.
      const targetIndex = idx // royaume ciblé (Jafar)
      const tgt = state.players[targetIndex]
      const chooserIndex = (targetIndex + 1) % state.players.length
      const loc = ctx?.hostLocationId
      const locItems = loc ? (tgt.board[loc] ?? []).filter((c) => c.type === 'item' && !c.attachedTo) : []
      const handItems = effect.fromHand ? tgt.hand.filter((c) => c.type === 'item') : []
      const candidateIds = [...locItems, ...handItems].map((c) => c.instanceId)
      if (candidateIds.length === 0 || !ctx?.hostInstanceId) {
        return { ...state, log: [...state.log, `Aucun Objet à voler pour ${ctx?.hostInstanceId ? 'ce Héros' : 'cette carte'}.`] }
      }
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex,
          targetIndex,
          kind: 'steal-item-to-hero',
          hostInstanceId: ctx.hostInstanceId,
          candidateIds,
        },
        log: [...state.log, `${state.players[chooserIndex].villainName} choisit un Objet à voler à ${tgt.villainName}.`],
      }
    }
    case 'DISCARD_TRANSFORMED_HEROES': {
      // La Bonne Fée — Nettoyage de fond : défausse (pile Fatalité) tous les Héros
      // transformés du royaume de l'acteur (portant un Objet `zeroesHostStrength`),
      // avec leurs Objets associés. Auto, sans choix.
      const p0 = state.players[idx]
      let next = state
      const names: string[] = []
      for (const loc of p0.locations) {
        const cell = p0.board[loc.id] ?? []
        const transformed = cell.filter(
          (h) =>
            h.type === 'hero' &&
            cell.some((it) => it.attachedTo === h.instanceId && it.zeroesHostStrength),
        )
        for (const hero of transformed) {
          const c2 = next.players[idx].board[loc.id] ?? []
          const attached = c2.filter((c) => c.attachedTo === hero.instanceId)
          const rm = new Set([hero.instanceId, ...attached.map((c) => c.instanceId)])
          names.push(hero.name)
          next = updatePlayer(next, idx, (pl) => ({
            ...pl,
            board: { ...pl.board, [loc.id]: (pl.board[loc.id] ?? []).filter((c) => !rm.has(c.instanceId)) },
            fateDiscard: [
              ...pl.fateDiscard,
              { ...hero, attachedTo: undefined },
              ...attached.map((c) => ({ ...c, attachedTo: undefined })),
            ],
          }))
        }
      }
      if (names.length === 0) return state
      return { ...next, log: [...next.log, `${p0.villainName} fait le ménage : ${names.join(', ')} défaussé(s).`] }
    }
    case 'CAP_SELF_NEXT_TURN': {
      // La Bonne Fée — On est presque arrivé ? : plafonne le prochain tour de l'acteur.
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, actionsCapNextTurn: effect.actions }))
      return {
        ...next,
        log: [
          ...next.log,
          `On est presque arrivé ? : ${state.players[idx].villainName} ne pourra réaliser que ${effect.actions} actions à son prochain tour.`,
        ],
      }
    }
    case 'DISCARD_ONE_OR_LOSE': {
      // La Bonne Fée — Infiltration : défausser une carte OU perdre `lose` Pouvoir.
      // Auto (malus subi) : on garde la main et on perd le Pouvoir si possible.
      const p = state.players[idx]
      if (p.power >= effect.lose) {
        const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: pl.power - effect.lose }))
        return { ...next, log: [...next.log, `Infiltration : ${p.villainName} perd ${effect.lose} JT (garde sa main).`] }
      }
      if (p.hand.length === 0) {
        const lost = Math.min(p.power, effect.lose)
        const next = updatePlayer(state, idx, (pl) => ({ ...pl, power: Math.max(0, pl.power - effect.lose) }))
        return { ...next, log: [...next.log, `Infiltration : ${p.villainName} perd ${lost} JT (main vide).`] }
      }
      const victim = [...p.hand].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0]
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        hand: pl.hand.filter((c) => c.instanceId !== victim.instanceId),
        discard: [...pl.discard, victim],
      }))
      return { ...next, log: [...next.log, `Infiltration : ${p.villainName} défausse ${victim.name}.`] }
    }
    case 'FETCH_POTION': {
      // La Bonne Fée — Réserve de potions : cherche une Potion (pioche ou défausse) → main.
      // Auto : la potion ABSENTE de la main en priorité (l'objectif en veut 2 différentes),
      // d'abord dans la défausse (pas de mélange), sinon dans la pioche (mélangée ensuite).
      const p = state.players[idx]
      const inHand = new Set(p.hand.filter((c) => c.isPotion).map((c) => c.cardId))
      const pick = (cards: CardInstance[]) =>
        cards.find((c) => c.isPotion && !inHand.has(c.cardId)) ?? cards.find((c) => c.isPotion)
      const fromDiscard = pick(p.discard)
      if (fromDiscard) {
        const next = updatePlayer(state, idx, (pl) => ({
          ...pl,
          discard: pl.discard.filter((c) => c.instanceId !== fromDiscard.instanceId),
          hand: [...pl.hand, fromDiscard],
        }))
        return { ...next, log: [...next.log, `${p.villainName} récupère ${fromDiscard.name} (défausse) → main.`] }
      }
      const fromDeck = pick(p.deck)
      if (fromDeck) {
        const remaining = p.deck.filter((c) => c.instanceId !== fromDeck.instanceId)
        const r = shuffle(remaining, state.rngState)
        const next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({
          ...pl,
          deck: r.result,
          hand: [...pl.hand, fromDeck],
        }))
        return { ...next, log: [...next.log, `${p.villainName} cherche ${fromDeck.name} dans la pioche → main (pioche mélangée).`] }
      }
      return { ...state, log: [...state.log, `${p.villainName} : aucune Potion à récupérer.`] }
    }
    case 'REVEAL_OWN_FATE_PLAY_HERO': {
      // Dévoile le deck Fatalité de l'acteur jusqu'à un Héros, le joue dans SON
      // royaume, défausse les autres cartes dévoilées.
      const actor0 = state.players[idx]
      let deck = actor0.fateDeck
      let disc = actor0.fateDiscard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let hero: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === 'hero') {
          hero = top
          break
        }
      }
      const others = revealed.filter((c) => c !== hero)
      // On retire les cartes dévoilées de la pioche ; les non-Héros et le sort du
      // Héros (joué / défaussé) sont réglés à la résolution (RESOLVE_FETCHED_HERO).
      let next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: deck, fateDiscard: disc }))
      next = { ...next, rngState: s }
      if (!hero) {
        return {
          ...next,
          players: next.players.map((p, i) => (i === idx ? { ...p, fateDiscard: [...p.fateDiscard, ...others] } : p)),
          log: [...next.log, `${actor0.villainName} ne trouve aucun Héros dans son deck Fatalité.`],
        }
      }
      return {
        ...next,
        pendingFetchedHero: { playerIndex: idx, hero, discarded: others },
        log: [
          ...next.log,
          `${actor0.villainName} dévoile **${hero.name}** : à jouer dans son royaume ou à défausser.`,
        ],
      }
    }
    case 'RELOCATE_OWN_HERO': {
      // Monsieur Starkey : si l'acteur a un Héros dans son royaume, ouvre le
      // déplacement d'un Héros vers un lieu voisin (pendingHeroRelocate).
      const actor = state.players[idx]
      const hasHero = Object.values(actor.board).flat().some((c) => c.type === 'hero')
      if (!hasHero) return state
      return {
        ...state,
        pendingHeroRelocate: { chooserIndex: idx, targetIndex: idx, anyLocation: effect.anyLocation },
        log: [
          ...state.log,
          `${actor.villainName} peut déplacer un Héros vers ${effect.anyLocation ? 'un lieu non bloqué' : 'un lieu voisin'}.`,
        ],
      }
    }
    case 'SCRY_OWN_FATE_TOP2': {
      // Faites-leur peur ! : retire les 2 premières cartes Fatalité et ouvre la
      // fenêtre de décision (pendingScry) — défausser ou remettre sur le dessus
      // dans l'ordre choisi (RESOLVE_SCRY).
      const actor = state.players[idx]
      let deck = actor.fateDeck
      let disc = actor.fateDiscard
      let s = state.rngState
      if (deck.length < 2 && disc.length > 0) {
        const r = shuffle(disc, s)
        deck = [...deck, ...r.result]
        s = r.state
        disc = []
      }
      const top = deck.slice(0, 2)
      const rest = deck.slice(top.length)
      if (top.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche Fatalité vide.`] }
      }
      const next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: rest, fateDiscard: disc }))
      return {
        ...next,
        rngState: s,
        pendingScry: { playerIndex: idx, cards: top },
        log: [...next.log, `${actor.villainName} regarde les ${top.length} première(s) carte(s) de sa pioche Fatalité.`],
      }
    }
    case 'MOVE_ALLY_BUFF': {
      // Ouvre la sélection d'un Allié à déplacer vers un lieu voisin non bloqué
      // (+amount force jusqu'à la fin du tour ; amount 0 = simple déplacement).
      // Sans Allié déplaçable (aucun Allié, ou aucun voisin non bloqué), no-op.
      const actor = state.players[idx]
      const src = effect.label ?? 'Pas de Quartier !'
      const buff = effect.amount > 0 ? ` (+${effect.amount} force ce tour-ci)` : ''
      const hasMovable = actor.locations.some(
        (l) =>
          adjacentLocationIds(state, l.id).length > 0 &&
          (actor.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket),
      )
      if (!hasMovable) {
        return { ...state, log: [...state.log, `${src} : aucun Allié déplaçable.`] }
      }
      return {
        ...state,
        pendingAllyMoveBuff: { playerIndex: idx, amount: effect.amount, label: effect.label, optional: effect.optional },
        log: [
          ...state.log,
          `${actor.villainName} (${src}) : déplacez un Allié vers un lieu voisin${buff}.`,
        ],
      }
    }
    case 'GAIN_POWER_PER_CONTRACT': {
      // Ursula — Chaudron : +amount Pouvoir par Pacte dans le royaume.
      const p = state.players[idx]
      const contracts = Object.values(p.board).flat().filter((c) => c.contractLocationId).length
      const gained = contracts * effect.amount
      const next = updatePlayer(state, idx, (pp) => ({ ...pp, power: pp.power + gained }))
      return {
        ...next,
        log: [...next.log, `${p.villainName} gagne ${gained} Pouvoir (Chaudron : ${contracts} Pacte${contracts > 1 ? 's' : ''}).`],
      }
    }
    case 'REVEAL_VILLAIN_UNTIL_CONTRACT': {
      // Divination : dévoile la pioche Vilain jusqu'à un Pacte (carte avec
      // contractLocationId), l'ajoute à la main, défausse les autres dévoilées.
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.contractLocationId) {
          found = top
          break
        }
      }
      const others = revealed.filter((c) => c !== found)
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck,
        discard: [...disc, ...others],
        hand: found ? [...p.hand, found] : p.hand,
      }))
      next = { ...next, rngState: s }
      return {
        ...next,
        log: [...next.log, found ? `${actor.villainName} ajoute un Pacte à sa main (Divination).` : `${actor.villainName} ne trouve aucun Pacte.`],
      }
    }
    case 'SHUFFLE_VILLAIN_DISCARD': {
      // Polochon : mélange la défausse Vilain de l'acteur dans sa pioche Vilain.
      const actor = state.players[idx]
      if (actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : défausse Vilain déjà vide.`] }
      }
      const r = shuffle([...actor.deck, ...actor.discard], state.rngState)
      const next = updatePlayer(state, idx, (p) => ({ ...p, deck: r.result, discard: [] }))
      return { ...next, rngState: r.state, log: [...next.log, `${actor.villainName} mélange sa défausse Vilain dans sa pioche (Polochon).`] }
    }
    case 'EUREKA_ATTACH_ITEM': {
      // Eurêka : associe au Héros hôte le 1er Objet de la défausse Fatalité.
      const host = ctx?.hostInstanceId
      const loc = ctx?.hostLocationId
      const actor = state.players[idx]
      const item = actor.fateDiscard.find((c) => c.type === 'item')
      if (!host || !loc || !item) {
        return { ...state, log: [...state.log, 'Eurêka : aucun Objet dans la défausse Fatalité.'] }
      }
      const equipped: CardInstance = { ...item, attachedTo: host }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== item.instanceId),
        board: { ...p.board, [loc]: [...(p.board[loc] ?? []), equipped] },
      }))
      return { ...next, log: [...next.log, `Eurêka récupère **${item.name}** de la défausse Fatalité.`] }
    }
    case 'STEAL_CONTRACT_TO_HOST': {
      // Sébastien : transfère un Pacte d'un autre Héros vers le Héros hôte.
      const host = ctx?.hostInstanceId
      const actor = state.players[idx]
      const candidates = Object.values(actor.board)
        .flat()
        .filter((c) => c.contractLocationId && c.attachedTo && c.attachedTo !== host)
      if (!host || candidates.length === 0) {
        return { ...state, log: [...state.log, 'Sébastien : aucun Pacte à transférer.'] }
      }
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex: (idx + 1) % state.players.length,
          targetIndex: idx,
          kind: 'steal-item-to-hero',
          hostInstanceId: host,
          candidateIds: candidates.map((c) => c.instanceId),
        },
        log: [...state.log, 'Sébastien : transférez un Pacte sur lui.'],
      }
    }
    case 'MOVE_URSULA_PAWN': {
      // Max : si joué sur le lieu d'Ursula, l'adversaire déplace sa figurine.
      const actor = state.players[idx]
      const loc = ctx?.hostLocationId
      if (!loc || actor.pawnLocation !== loc) return state
      return {
        ...state,
        pendingPawnMove: { chooserIndex: (idx + 1) % state.players.length, targetIndex: idx },
        log: [...state.log, `Max : la figurine d'${actor.villainName} peut être déplacée.`],
      }
    }
    case 'RECOVER_ITEM_OR_EVENT': {
      // Opportunisme : reprend en main un Objet ou un Événement de la défausse Vilain.
      const actor = state.players[idx]
      const candidates = actor.discard.filter((c) => c.type === 'item' || c.type === 'effect')
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Objet/Événement en défausse.`] }
      }
      return {
        ...state,
        pendingRecover: { playerIndex: idx, candidateIds: candidates.map((c) => c.instanceId) },
        log: [...state.log, `${actor.villainName} récupère une carte de sa défausse (Opportunisme).`],
      }
    }
    case 'KILL_CREWMATE': {
      // L'Imposteur — Tuer : défausse un Coéquipier sur le lieu du pion ou le lieu
      // d'un Allié de l'Imposteur. Choix interactif (pendingCrewmateKill) ; les
      // autres Coéquipiers de ce lieu deviennent suspects (à la résolution).
      const actor = state.players[idx]
      const crew = actor.crewmates ?? []
      const allyLocs = actor.locations
        .filter((l) => (actor.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo))
        .map((l) => l.id)
      const targetLocs = new Set<string>(
        [actor.pawnLocation, ...allyLocs].filter((v): v is string => !!v),
      )
      const candidates = crew.filter((c) => !c.discarded && targetLocs.has(c.locationId))
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Coéquipier à défausser (Tuer).`] }
      }
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: candidates.map((c) => c.color), mode: 'kill' },
        log: [...state.log, `${actor.villainName} choisit un Coéquipier à défausser (Tuer).`],
      }
    }
    case 'SKIP_CREWMATE_MOVE': {
      // Porte désactivée : les Coéquipiers de l'Imposteur ne bougeront pas à la
      // fin de ce tour.
      return {
        ...state,
        players: state.players.map((p, i) => (i === idx ? { ...p, crewmatesSkipMove: true } : p)),
        log: [...state.log, `${state.players[idx].villainName} désactive les portes : les Coéquipiers resteront en place.`],
      }
    }
    case 'FALSE_ACCUSATION': {
      // Fausse accusation : le joueur choisit le Coéquipier à défausser (n'importe
      // où) ; tous les autres redeviennent normaux (résolu à la sélection).
      const p = state.players[idx]
      const live = (p.crewmates ?? []).filter((c) => !c.discarded)
      if (live.length === 0) return logCrew(state, idx, 'aucun Coéquipier (Fausse accusation)')
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: live.map((c) => c.color), mode: 'false-accusation' },
        log: [...state.log, `${p.villainName} choisit un Coéquipier à défausser (Fausse accusation).`],
      }
    }
    case 'REASSURE_CREWMATE': {
      // Assurance : le joueur choisit un Coéquipier suspect sur SON lieu OU le lieu
      // d'un Allié → il redevient normal (résolu à la sélection).
      const p = state.players[idx]
      const peri = crewPeri(p)
      // Tout Coéquipier (suspect OU normal) sur votre lieu / celui d'un Allié : il
      // redevient normal (sans effet s'il l'est déjà) et pourra être déplacé.
      const candidates = (p.crewmates ?? []).filter((c) => !c.discarded && peri.has(c.locationId))
      if (candidates.length === 0) return logCrew(state, idx, 'aucun Coéquipier sur votre lieu ou celui d’un Allié (Assurance)')
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: candidates.map((c) => c.color), mode: 'reassure' },
        log: [...state.log, `${p.villainName} choisit un Coéquipier à rassurer (Assurance).`],
      }
    }
    case 'MOVE_CREWMATES_NEIGHBOR': {
      // Lumière désactivée : déplace `count` Coéquipiers (hors sabotage) vers un lieu
      // voisin (le moins occupé).
      const p = state.players[idx]
      const locIds = p.locations.map((l) => l.id)
      const sabLocs = new Set(
        p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.isSabotage && !c.attachedTo)).map((l) => l.id),
      )
      let crew = p.crewmates ?? []
      const movable = crew.filter((c) => !c.discarded && !sabLocs.has(c.locationId)).slice(0, effect.count)
      for (const m of movable) {
        const neighbors = neighborLocIds(locIds, m.locationId)
        if (neighbors.length === 0) continue
        const count = (loc: string) => crew.filter((c) => !c.discarded && c.locationId === loc).length
        const dest = [...neighbors].sort((a, b) => count(a) - count(b))[0]
        crew = placeCrewmateAt(crew, m.color, dest)
      }
      return setCrew(state, idx, crew, 'déplace des Coéquipiers vers un lieu voisin (Lumière désactivée)')
    }
    case 'MOVE_ONE_CREWMATE_NEIGHBOR': {
      // Réparation rapide : déplace UN Coéquipier vers un lieu voisin.
      const p = state.players[idx]
      const locIds = p.locations.map((l) => l.id)
      let crew = p.crewmates ?? []
      const m = crew.find((c) => !c.discarded && neighborLocIds(locIds, c.locationId).length > 0)
      if (!m) return logCrew(state, idx, 'aucun Coéquipier à déplacer (Réparation rapide)')
      const neighbors = neighborLocIds(locIds, m.locationId)
      const count = (loc: string) => crew.filter((c) => !c.discarded && c.locationId === loc).length
      const dest = [...neighbors].sort((a, b) => count(a) - count(b))[0]
      crew = placeCrewmateAt(crew, m.color, dest)
      return setCrew(state, idx, crew, `déplace le Coéquipier ${m.color} (Réparation rapide)`)
    }
    case 'CREWMATES_SUSPECT': {
      // Corps découvert / Tâche visuelle : rend suspects jusqu'à `count` Coéquipiers.
      const p = state.players[idx]
      const peri = crewPeri(p)
      let targets = (p.crewmates ?? []).filter(
        (c) => !c.discarded && !c.suspect && (effect.scope === 'away' ? !peri.has(c.locationId) : true),
      )
      if (effect.count != null) targets = targets.slice(0, effect.count)
      if (targets.length === 0) return logCrew(state, idx, 'aucun Coéquipier à rendre suspect')
      const set = new Set(targets.map((c) => c.color))
      const next = (p.crewmates ?? []).map((c) => (set.has(c.color) ? { ...c, suspect: true } : c))
      return setCrew(state, idx, next, `${set.size} Coéquipier(s) deviennent suspects`)
    }
    case 'CREWMATES_SUSPECT_CHOOSE': {
      // Tâche visuelle : l'adversaire (state.activePlayer) choisit jusqu'à `count`
      // Coéquipiers de l'Imposteur (idx) à rendre suspects.
      const p = state.players[idx]
      const eligible = (p.crewmates ?? []).filter((c) => !c.discarded && !c.suspect)
      if (eligible.length === 0) return logCrew(state, idx, 'aucun Coéquipier à rendre suspect (Tâche visuelle)')
      return {
        ...state,
        pendingCrewmateSuspect: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          remaining: Math.min(effect.count, eligible.length),
        },
        log: [...state.log, `Tâche visuelle : choisissez jusqu'à ${effect.count} Coéquipier(s) à rendre suspects.`],
      }
    }
    case 'SABOTAGE_COUNTDOWN': {
      // Corps découvert : avance le compte à rebours d'un Sabotage présent.
      const p = state.players[idx]
      let touched = false
      const board = Object.fromEntries(
        Object.entries(p.board).map(([loc, cards]) => [
          loc,
          cards.map((c) => {
            if (c.isSabotage && !c.attachedTo) {
              touched = true
              return { ...c, sabotageTurns: Math.max(0, (c.sabotageTurns ?? 0) + effect.amount) }
            }
            return c
          }),
        ]),
      )
      if (!touched) return state
      return {
        ...state,
        players: state.players.map((pp, i) => (i === idx ? { ...pp, board } : pp)),
        log: [...state.log, `Le compte à rebours du Sabotage de ${p.villainName} ${effect.amount >= 0 ? 'avance' : 'recule'} de ${Math.abs(effect.amount)}.`],
      }
    }
    case 'DISCARD_FATE_ITEM': {
      // Communication désactivée : défausse un Objet du royaume issu d'une Fatalité.
      const p = state.players[idx]
      let foundLoc: string | undefined
      let found: CardInstance | undefined
      for (const l of p.locations) {
        for (const c of p.board[l.id] ?? []) {
          if (c.type === 'item' && c.fromFate && !c.attachedTo) {
            foundLoc = l.id
            found = c
            break
          }
        }
        if (found) break
      }
      if (!found || !foundLoc) return logCrew(state, idx, 'aucun Objet de Fatalité à défausser (Communication désactivée)')
      const loc = foundLoc
      const card = found
      return {
        ...state,
        players: state.players.map((pp, i) =>
          i === idx
            ? {
                ...pp,
                board: { ...pp.board, [loc]: (pp.board[loc] ?? []).filter((c) => c.instanceId !== card.instanceId) },
                fateDiscard: [...pp.fateDiscard, card],
              }
            : pp,
        ),
        log: [...state.log, `${p.villainName} défausse **${card.name}** (Communication désactivée).`],
      }
    }
    case 'PLACE_DISCARDED_CREWMATE': {
      // Arrivée tardive : remet un Coéquipier défaussé sur le lieu le plus à gauche
      // ou à droite (auto : à gauche si possible).
      const p = state.players[idx]
      const crew = p.crewmates ?? []
      const dead = crew.find((c) => c.discarded)
      if (!dead) return logCrew(state, idx, 'aucun Coéquipier défaussé à replacer (Arrivée tardive)')
      const locIds = p.locations.map((l) => l.id)
      const dest = locIds[0]
      const next = placeCrewmateAt(crew, dead.color, dest)
      return setCrew(state, idx, next, `replace le Coéquipier ${dead.color} (Arrivée tardive)`)
    }
    case 'KILL_NORMAL_CREWMATE': {
      // Trahison : le joueur choisit un Coéquipier qui ne le suspecte pas (normal)
      // à éliminer (résolu à la sélection).
      const p = state.players[idx]
      const candidates = (p.crewmates ?? []).filter((c) => !c.discarded && !c.suspect)
      if (candidates.length === 0) return logCrew(state, idx, 'aucun Coéquipier normal à éliminer (Trahison)')
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: candidates.map((c) => c.color), mode: 'kill-normal' },
        log: [...state.log, `${p.villainName} choisit un Coéquipier (normal) à éliminer (Trahison).`],
      }
    }
    case 'REASSURE_ANY': {
      // Insidieux : un Coéquipier suspect (n'importe où) redevient normal.
      const p = state.players[idx]
      const crew = p.crewmates ?? []
      const target = crew.find((c) => !c.discarded && c.suspect)
      if (!target) return logCrew(state, idx, 'aucun Coéquipier suspect (Insidieux)')
      const next = crew.map((c) => (c.color === target.color ? { ...c, suspect: false } : c))
      return setCrew(state, idx, next, `un Coéquipier suspect redevient normal (Insidieux)`)
    }
    case 'GATHER_CREWMATES': {
      // Réunion d'urgence : rassemble un maximum de Coéquipiers sur le lieu le plus
      // peuplé (4 cases max).
      const p = state.players[idx]
      const locIds = p.locations.map((l) => l.id)
      let crew = p.crewmates ?? []
      const live = crew.filter((c) => !c.discarded)
      if (live.length === 0) return logCrew(state, idx, 'aucun Coéquipier (Réunion d’urgence)')
      const count = (loc: string) => live.filter((c) => c.locationId === loc).length
      const dest = [...locIds].sort((a, b) => count(b) - count(a))[0]
      for (const c of live) {
        if (c.locationId !== dest) crew = placeCrewmateAt(crew, c.color, dest)
      }
      return setCrew(state, idx, crew, `rassemble les Coéquipiers sur ${p.locations.find((l) => l.id === dest)?.name ?? dest} (Réunion d’urgence)`)
    }
    case 'GIANT_ACTION': {
      // Colère Titanesque : ouvre le choix d'un lieu voisin (bloqué ou non) où le
      // joueur effectuera UNE action.
      const actor = state.players[idx]
      const pawn = actor.pawnLocation
      if (!pawn) return state
      const order = actor.locations.map((l) => l.id)
      const i = order.indexOf(pawn)
      const neighbors = [order[i - 1], order[i + 1]].filter(Boolean)
      if (neighbors.length === 0) return { ...state, log: [...state.log, 'Colère Titanesque : aucun lieu voisin.'] }
      return {
        ...state,
        pendingGiantAction: { playerIndex: idx },
        log: [...state.log, `${actor.villainName} (Colère Titanesque) : choisissez un lieu voisin où agir.`],
      }
    }
    case 'AMES_EN_PERDITION': {
      // Âmes en Perdition : déplace chaque Héros portant un Pacte vers le lieu de
      // son Pacte s'il est voisin non bloqué (ce qui déclenche son élimination).
      const actor = state.players[idx]
      const targets: { id: string; to: string }[] = []
      for (const l of actor.locations) {
        const cell = actor.board[l.id] ?? []
        for (const c of cell) {
          if (c.type !== 'hero') continue
          const pacte = cell.find((x) => x.attachedTo === c.instanceId && x.contractLocationId)
          if (pacte?.contractLocationId && adjacentLocationIds(state, l.id).includes(pacte.contractLocationId)) {
            targets.push({ id: c.instanceId, to: pacte.contractLocationId })
          }
        }
      }
      let next = state
      for (const t of targets) {
        next = resolveEffect(next, { type: 'MOVE_HERO_TO_LOCATION', locationId: t.to }, { actorIndex: idx, targetHeroId: t.id })
      }
      if (targets.length === 0) {
        return { ...next, log: [...next.log, 'Âmes en Perdition : aucun Pacte déclenchable.'] }
      }
      return next
    }
    case 'ARIEL_FREEZE_ITEM': {
      // Ariel : déplace un Objet du royaume sur le lieu d'Ariel et le gèle
      // (priorité au Trident / à la Couronne — les Objets d'objectif).
      const host = ctx?.hostInstanceId
      const aLoc = ctx?.hostLocationId
      const actor = state.players[idx]
      if (!host || !aLoc) return state
      const items: { c: CardInstance; loc: string }[] = []
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.type === 'item' && !c.attachedTo) items.push({ c, loc: l.id })
        }
      }
      if (items.length === 0) {
        return { ...state, log: [...state.log, 'Ariel : aucun Objet à geler.'] }
      }
      const chosen = items.find((x) => x.c.cardId === 'trident' || x.c.cardId === 'couronne') ?? items[0]
      const moved: CardInstance = { ...chosen.c, frozenBy: host }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: Object.fromEntries(
          p.locations.map((l) => {
            let cards = (p.board[l.id] ?? []).filter((c) => c.instanceId !== chosen.c.instanceId)
            if (l.id === aLoc) cards = [...cards, moved]
            return [l.id, cards]
          }),
        ),
      }))
      return {
        ...next,
        log: [...next.log, `Ariel déplace **${chosen.c.name}** sur son lieu et le gèle (Ursula ne peut plus le déplacer).`],
      }
    }
    case 'TOGGLE_URSULA_LOCK': {
      // Ursula : le Cadenas se déplace entre le Palais et le Repaire (un seul
      // bloqué à la fois). On bascule vers l'AUTRE des deux.
      const p = state.players[idx]
      const locked = p.lockedLocations ?? []
      const dest = locked.includes('palais') ? 'repaire' : 'palais'
      const next = updatePlayer(state, idx, (pp) => ({ ...pp, lockedLocations: [dest] }))
      return {
        ...next,
        log: [
          ...next.log,
          `${p.villainName} déplace le Cadenas sur ${dest === 'palais' ? 'le Palais' : "le Repaire d'Ursula"}.`,
        ],
      }
    }
    case 'TRANSFORM_GUARDS': {
      // Par ordre de la Reine ! : ouvre la sélection de 1 ou 2 Cartes Gardes à
      // transformer en arceaux. Sans Carte Garde éligible, l'effet ne fait rien.
      const eligible = transformableGuards(state, idx)
      if (eligible.length === 0) {
        return {
          ...state,
          log: [...state.log, `${state.players[idx].villainName} n'a aucune Carte Garde à transformer.`],
        }
      }
      return {
        ...state,
        pendingTransformWickets: { playerIndex: idx, max: Math.min(effect.max, eligible.length) },
      }
    }
    case 'REVERT_WICKETS': {
      // Le Chafouin (Fatalité) : retransforme jusqu'à `max` arceaux de la cible (idx)
      // en Cartes Gardes. Auto (choix du fataliseur) : un arceau par lieu, pour faire
      // perdre le plus de cases d'objectif possible.
      const p = state.players[idx]
      let reverted = 0
      const board = Object.fromEntries(
        Object.entries(p.board).map(([locId, cards]) => {
          if (reverted >= effect.max) return [locId, cards]
          let done = false
          const next = cards.map((c) => {
            if (!done && c.isWicket && reverted < effect.max) {
              done = true
              reverted++
              return { ...c, isWicket: false }
            }
            return c
          })
          return [locId, next]
        }),
      )
      if (reverted === 0) {
        return { ...state, log: [...state.log, `Le Chafouin : ${p.villainName} n'a aucun arceau à retransformer.`] }
      }
      const next = updatePlayer(state, idx, (pp) => ({ ...pp, board }))
      return {
        ...next,
        log: [...next.log, `Le Chafouin retransforme ${reverted} arceau${reverted > 1 ? 'x' : ''} de ${p.villainName} en Cartes Gardes.`],
      }
    }
    case 'HYPNOTIZE_HERO': {
      // Jafar — Hypnose : le Héros ciblé passe sous le contrôle de l'acteur
      // (marqué `hypnotized`). Il compte désormais comme un Allié.
      const target = ctx?.targetHeroId
      if (!target) throw new Error('HYPNOTIZE_HERO nécessite un Héros cible.')
      const actor = state.players[idx]
      const heroLoc = locationOfCard(actor, target)
      if (!heroLoc) throw new Error('Héros à hypnotiser introuvable dans le royaume.')
      const hero = actor.board[heroLoc].find((c) => c.instanceId === target)!
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      // Hypnotiser un Héros est traité comme « éliminer un Héros » pour les
      // déclencheurs adverses (Obsession, Méchanceté, Crise d'hystérie) : on
      // mémorise la force EFFECTIVE du Héros au moment de l'hypnose.
      const hypnoStrength = effectiveStrength(state, idx, target) ?? hero.strength ?? 0
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [heroLoc]: p.board[heroLoc].map((c) =>
            c.instanceId === target ? { ...c, hypnotized: true } : c,
          ),
        },
      }))
      return {
        ...next,
        lastVanquishedHeroStrength: Math.max(next.lastVanquishedHeroStrength ?? 0, hypnoStrength),
        log: [
          ...next.log,
          `${actor.villainName} hypnotise **${hero.name}** (force ${hypnoStrength}) : il devient un Allié sous son contrôle.`,
        ],
      }
    }
    case 'MOVE_TITAN_INTERACTIVE': {
      // Hadès — Préparez-vous au combat ! : ouvre le choix d'un Titan non entravé
      // (déplaçable) et d'un lieu de destination (pendingTitanMove). Sans Titan
      // déplaçable, l'effet ne fait rien.
      const actor = state.players[idx]
      // Payant : il faut pouvoir financer au moins 1 lieu (2 JT), sinon l'effet ne
      // fait rien (évite un état bloqué sans résolution possible).
      if (effect.paid && actor.power < 2) {
        return { ...state, log: [...state.log, 'Préparez-vous au combat ! : Pouvoir insuffisant pour déplacer un Titan.'] }
      }
      const candidates = Object.values(actor.board)
        .flat()
        .filter((c) => c.isTitan && !c.trapped && titanReachableDests(state, idx, c.instanceId, effect.maxSteps).length > 0)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, 'Préparez-vous au combat ! : aucun Titan déplaçable.'] }
      }
      return {
        ...state,
        pendingTitanMove: {
          playerIndex: idx,
          titanCandidateIds: candidates.map((c) => c.instanceId),
          paid: effect.paid,
          maxSteps: effect.maxSteps,
        },
        log: [...state.log, `${actor.villainName} : choisissez un Titan à déplacer (Préparez-vous au combat !).`],
      }
    }
    case 'UNTRAP_TITANS_PAY': {
      // Alignement des planètes : le joueur CHOISIT quels Titans entravés désentraver
      // (1 JT chacun, max = son Pouvoir). On ouvre le choix (humain via modale ; bot auto :
      // les plus avancés finançables). Sans Titan entravé finançable, aucun effet.
      const actor = state.players[idx]
      const hasAffordable =
        actor.power >= 1 && Object.values(actor.board).flat().some((c) => c.isTitan && c.trapped)
      if (!hasAffordable) {
        return { ...state, log: [...state.log, 'Alignement des planètes : aucun Titan entravé à désentraver (ou Pouvoir insuffisant).'] }
      }
      return { ...state, pendingUntrapTitans: { playerIndex: idx } }
    }
    case 'GAIN_POWER_PER_TYPE_IN_DISCARD': {
      const actor = state.players[idx]
      const n = actor.discard.filter((c) => c.type === effect.cardType).length
      const gross = n * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      next = { ...next, log: [...next.log, `${next.players[idx].villainName} gagne ${gained} JT (${n} carte(s) en défausse).`] }
      return pushRobinSteal(next, idx, gross - gained)
    }
    case 'REDUCE_HERO_STRENGTH_TEMP': {
      // Talon d'Achille : −amount à la force du Héros cible jusqu'à la fin du tour.
      const target = ctx?.targetHeroId
      if (!target) return state
      const actor = state.players[idx]
      const loc = locationOfCard(actor, target)
      if (!loc) return state
      const hero = (actor.board[loc] ?? []).find((c) => c.instanceId === target)
      if (!hero || hero.type !== 'hero') return state
      const next = patchCard(state, idx, target, (c) => ({ ...c, tempStrengthBonus: (c.tempStrengthBonus ?? 0) - effect.amount }))
      return { ...next, log: [...next.log, `**${hero.name}** : force −${effect.amount} jusqu'à la fin du tour (Talon d'Achille).`] }
    }
    // --- Madame de Trémaine ---------------------------------------------------
    case 'TRAP_HERO': {
      // Piège : le Héros choisi est PIÉGÉ (capacité ignorée + ne recouvre plus rien).
      const target = ctx?.targetHeroId
      if (!target) return state
      const actor = state.players[idx]
      const loc = locationOfCard(actor, target)
      if (!loc) return state
      const hero = (actor.board[loc] ?? []).find((c) => c.instanceId === target)
      if (!hero || hero.type !== 'hero') return state
      const next = patchCard(state, idx, target, (c) => ({ ...c, trapped: true }))
      return { ...next, log: [...next.log, `**${hero.name}** est PIÉGÉ : sa capacité est ignorée et il ne recouvre plus d'action.`] }
    }
    case 'REMOVE_GLASS_SLIPPER': {
      // Canne : retire (→ défausse Fatalité) toutes les Pantoufles de Verre du royaume.
      const p = state.players[idx]
      const toRemove: { loc: LocationId; card: CardInstance }[] = []
      for (const l of p.locations) for (const c of p.board[l.id] ?? []) if (isGlassSlipper(c.cardId)) toRemove.push({ loc: l.id, card: c })
      if (toRemove.length === 0) return { ...state, log: [...state.log, `${p.villainName} : aucune Pantoufle de Verre à retirer.`] }
      const ids = new Set(toRemove.map((x) => x.card.instanceId))
      const next = updatePlayer(state, idx, (pl) => {
        const board = { ...pl.board }
        for (const l of pl.locations) board[l.id] = (board[l.id] ?? []).filter((c) => !ids.has(c.instanceId))
        return { ...pl, board, fateDiscard: [...pl.fateDiscard, ...toRemove.map((x) => x.card)] }
      })
      return { ...next, log: [...next.log, `${p.villainName} retire ${toRemove.length} Pantoufle(s) de Verre (Canne).`] }
    }
    case 'TARGET_DISCARD_RANDOM': {
      // Fatalité (Bibbidi-Bobbidi-Boo / Doux Rossignol) : la cible défausse `count`
      // carte(s) au hasard de sa main.
      const p = state.players[idx]
      if (p.hand.length === 0) return { ...state, log: [...state.log, `${p.villainName} : main vide (rien à défausser).`] }
      const r = shuffle(p.hand, state.rngState)
      const discarded = r.result.slice(0, effect.count)
      const keep = new Set(r.result.slice(effect.count).map((c) => c.instanceId))
      const next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({
        ...pl,
        hand: pl.hand.filter((c) => keep.has(c.instanceId)),
        discard: [...pl.discard, ...discarded],
      }))
      return { ...next, log: [...next.log, `${p.villainName} défausse ${discarded.length} carte(s) au hasard.`] }
    }
    case 'RESHUFFLE_FATE_DISCARD': {
      // Je ne reviens jamais sur ma parole : mélange la défausse Fatalité avec la
      // pioche Fatalité pour en former une nouvelle.
      const p = state.players[idx]
      if (p.fateDiscard.length === 0) return { ...state, log: [...state.log, `${p.villainName} : défausse Fatalité vide (rien à remélanger).`] }
      const r = shuffle([...p.fateDeck, ...p.fateDiscard], state.rngState)
      const next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({ ...pl, fateDeck: r.result, fateDiscard: [] }))
      return { ...next, log: [...next.log, `${p.villainName} mélange sa défausse Fatalité dans sa pioche Fatalité (Je ne reviens jamais sur ma parole).`] }
    }
    case 'TRAP_TITANS_AT_BEST_LOCATION': {
      // Éclairs (Fatalité) : entrave tous les Titans du lieu qui en porte le plus
      // (non encore entravés). Résolu sur le royaume de `idx`.
      const actor = state.players[idx]
      let bestLoc: LocationId | undefined
      let bestN = 0
      for (const l of actor.locations) {
        const n = (actor.board[l.id] ?? []).filter((c) => c.isTitan && !c.trapped).length
        if (n > bestN) { bestN = n; bestLoc = l.id }
      }
      if (!bestLoc) return { ...state, log: [...state.log, 'Éclairs : aucun Titan à entraver.'] }
      let next = state
      for (const c of actor.board[bestLoc] ?? []) {
        if (c.isTitan && !c.trapped) next = patchCard(next, idx, c.instanceId, (x) => ({ ...x, trapped: true }))
      }
      const name = findLocation(actor, bestLoc)?.name ?? bestLoc
      return { ...next, log: [...next.log, `Éclairs : ${bestN} Titan(s) entravé(s) sur **${name}**.`] }
    }
    case 'OPEN_TITAN_SELECT': {
      // Héra (entrave) / Pégase (repousse) : le joueur qui a posé la Fatalité
      // (joueur actif) choisit un Titan parmi les candidats (pendingTitanSelect).
      const actor = state.players[idx]
      const candidates = (effect.atHost
        ? (ctx?.hostLocationId ? (actor.board[ctx.hostLocationId] ?? []) : [])
        : Object.values(actor.board).flat()
      ).filter((c) => c.isTitan && !c.trapped)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `Aucun Titan à ${effect.kind === 'trap' ? 'entraver' : 'repousser'}.`] }
      }
      return {
        ...state,
        pendingTitanSelect: {
          playerIndex: idx,
          chooserIndex: state.activePlayer,
          titanCandidateIds: candidates.map((c) => c.instanceId),
          kind: effect.kind,
          pushSteps: effect.pushSteps,
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} choisit un Titan à ${effect.kind === 'trap' ? 'entraver' : 'repousser'}.`],
      }
    }
    case 'PUSH_TITAN_BACK_AUTO': {
      // Pégase (1) / De zéro en héros (2) : repousse le Titan non entravé le plus
      // avancé de `steps` lieux vers Les Enfers (sans déclencher ses capacités).
      const actor = state.players[idx]
      const order = actor.locations.map((l) => l.id)
      const best = mostAdvancedTitan(state, idx)
      if (!best) return { ...state, log: [...state.log, 'Aucun Titan non entravé à repousser.'] }
      const destIdx = Math.max(0, best.locIndex - effect.steps)
      if (destIdx === best.locIndex) return state
      return moveTitanTo(state, idx, best.id, order[destIdx], { fireTriggers: false })
    }
    case 'SEARCH_FATE_HERO_TO_TOP': {
      // Hermès : place Zeus sur le dessus du deck Fatalité de la cible. S'il est
      // déjà dans le royaume, le déplace vers le lieu portant le plus de Titans.
      const actor = state.players[idx]
      const inRealm = Object.values(actor.board).flat().find((c) => c.type === 'hero' && c.cardId === effect.heroCardId)
      if (inRealm) {
        // Zeus déjà en jeu : le joueur qui pose la Fatalité le déplace où il veut.
        return {
          ...state,
          pendingHeroRelocate: {
            chooserIndex: state.activePlayer,
            targetIndex: idx,
            anyLocation: true,
            candidateIds: [inRealm.instanceId],
          },
          log: [...state.log, `${state.players[state.activePlayer].villainName} peut déplacer Zeus (Hermès).`],
        }
      }
      const fromDeck = actor.fateDeck.find((c) => c.cardId === effect.heroCardId)
      const fromDisc = actor.fateDiscard.find((c) => c.cardId === effect.heroCardId)
      const zeus = fromDeck ?? fromDisc
      if (!zeus) return { ...state, log: [...state.log, `Hermès : ${effect.heroCardId} introuvable.`] }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: [zeus, ...p.fateDeck.filter((c) => c.instanceId !== zeus.instanceId)],
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== zeus.instanceId),
      }))
      return { ...next, log: [...next.log, `Hermès place **${zeus.name}** sur le dessus du deck Fatalité.`] }
    }
    case 'MOVE_HERO_FROM_HOST_ANYWHERE': {
      // Mégara (à la pose) : le joueur qui pose la Fatalité déplace un Héros (autre
      // qu'elle) du lieu hôte vers n'importe quel lieu (pendingHeroRelocate).
      const loc = ctx?.hostLocationId
      const host = ctx?.hostInstanceId
      if (!loc) return state
      const actor = state.players[idx]
      const heroes = (actor.board[loc] ?? []).filter((c) => c.type === 'hero' && c.instanceId !== host)
      if (heroes.length === 0) return state
      return {
        ...state,
        pendingHeroRelocate: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          anyLocation: true,
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} peut déplacer un Héros (Mégara).`],
      }
    }
    case 'REVEAL_VILLAIN_UNTIL_TYPE': {
      // Œil des Moires : dévoile la pioche Vilain jusqu'à une carte du type voulu
      // (Allié, Titans inclus), l'ajoute à la main, défausse les autres dévoilées.
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === effect.cardType) {
          found = top
          break
        }
      }
      const others = revealed.filter((c) => c !== found)
      // James (keepOthersOnTop) : les autres dévoilées repartent sur le DESSUS de la
      // pioche (ordre conservé) ; sinon (Œil des Moires) elles sont défaussées.
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck: effect.keepOthersOnTop ? [...others, ...deck] : deck,
        discard: effect.keepOthersOnTop ? disc : [...disc, ...others],
        hand: found ? [...p.hand, found] : p.hand,
      }))
      next = { ...next, rngState: s }
      return {
        ...next,
        log: [...next.log, found ? `${actor.villainName} ajoute **${found.name}** à sa main.` : `${actor.villainName} ne trouve aucune carte du type voulu.`],
      }
    }
    // ===================== Dr Facilier — Pile de l'Au-delà =====================
    case 'DIVINATION': {
      // Divination : seulement au Royaume du vaudou. Mélange la pile, en révèle
      // `count` cartes (2 si Mama Odie est dans le royaume) et ouvre la résolution
      // (pendingDivination) — l'acteur choisit l'ordre.
      const actor = state.players[idx]
      if (actor.pawnLocation !== 'royaume-vaudou') {
        return { ...state, log: [...state.log, `${actor.villainName} : Divination n'a d'effet qu'au Royaume du vaudou.`] }
      }
      if (actor.auDela.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : la Pile de l'Au-delà est vide.`] }
      }
      const hasMamaOdie = Object.values(actor.board).flat().some(
        (c) => c.type === 'hero' && c.cardId === 'mama-odie',
      )
      const count = Math.min(hasMamaOdie ? 2 : effect.count, actor.auDela.length)
      const r = shuffle(actor.auDela, state.rngState)
      const revealed = r.result.slice(0, count)
      const rest = r.result.slice(count)
      let next = updatePlayer(state, idx, (p) => ({ ...p, auDela: rest }))
      next = {
        ...next,
        rngState: r.state,
        pendingDivination: { playerIndex: idx, cards: revealed },
        log: [
          ...next.log,
          `${actor.villainName} joue Divination${hasMamaOdie ? ' (Mama Odie : 2 cartes)' : ''} : ${revealed.length} carte${revealed.length > 1 ? 's' : ''} révélée${revealed.length > 1 ? 's' : ''} de l'Au-delà.`,
        ],
      }
      return next
    }
    case 'FATE_ALLY_TO_AUDELA': {
      // L'étoile du soir : un Allié du royaume de la cible part dans sa Pile de l'Au-delà.
      // S'il y a ≥2 Alliés, le joueur qui pose la Fatalité CHOISIT lequel (pending) ; sinon
      // (0 ou 1 Allié) c'est automatique. Auto (le plus fort) côté bot via App/enumerate.
      const target = state.players[idx]
      const allies: CardInstance[] = []
      for (const loc of target.locations) {
        for (const c of target.board[loc.id] ?? []) {
          if (c.type === 'ally' && !c.attachedTo && !c.isWicket) allies.push(c)
        }
      }
      if (allies.length === 0) {
        return { ...state, log: [...state.log, `L'étoile du soir : aucun Allié à placer dans l'Au-delà.`] }
      }
      if (allies.length >= 2) {
        // Choix interactif (humain via modale ; bot auto). `state.activePlayer` = le joueur
        // qui pose la Fatalité (le « chooser ») ; `idx` = la cible (Facilier).
        return { ...state, pendingFateAllyToAuDela: { chooserIndex: state.activePlayer, targetIndex: idx } }
      }
      return placeAllyInAuDela(state, idx, allies[0].instanceId)
    }
    case 'DIVERSION': {
      // Oogie Boogie — Diversion : le joueur qui pose la Fatalité déplace un Héros de la
      // cible (Oogie) vers un lieu VOISIN, puis défausse un Allié/Objet du lieu d'arrivée
      // (thenDiscardAllyItem). `state.activePlayer` = le « chooser » ; `idx` = la cible.
      const target = state.players[idx]
      const heroes: string[] = []
      for (const loc of target.locations) {
        for (const c of target.board[loc.id] ?? []) {
          if (c.type === 'hero' && !c.attachedTo) heroes.push(c.instanceId)
        }
      }
      if (heroes.length === 0) {
        return { ...state, log: [...state.log, `Diversion : aucun Héros à déplacer chez ${target.villainName}.`] }
      }
      return {
        ...state,
        pendingHeroRelocate: { chooserIndex: state.activePlayer, targetIndex: idx, candidateIds: heroes, thenDiscardAllyItem: true },
        log: [...state.log, `Diversion : déplacez un Héros de ${target.villainName} vers un lieu voisin.`],
      }
    }
    case 'FATE_TOP_DECK_TO_AUDELA': {
      // Si près du but / Charlotte : place les `count` premières cartes de la
      // pioche Vilain de la cible dans sa Pile de l'Au-delà (auto).
      const target = state.players[idx]
      let deck = target.deck
      let disc = target.discard
      let s = state.rngState
      const taken: CardInstance[] = []
      while (taken.length < effect.count) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...others] = deck
        deck = others
        taken.push(top)
      }
      if (taken.length === 0) {
        return { ...state, log: [...state.log, `${target.villainName} : pioche vide, rien à regarder.`] }
      }
      // Le joueur qui a posé la Fatalité (state.activePlayer) regarde ces cartes et
      // choisit lesquelles vont dans l'Au-delà / l'ordre de retour (RESOLVE_FATE_SCRY).
      let next = updatePlayer(state, idx, (p) => ({ ...p, deck, discard: disc }))
      next = {
        ...next,
        rngState: s,
        pendingFateScry: { chooserIndex: state.activePlayer, targetIndex: idx, cards: taken },
        log: [
          ...next.log,
          `${state.players[state.activePlayer].villainName} regarde les ${taken.length} première${taken.length > 1 ? 's' : ''} carte${taken.length > 1 ? 's' : ''} de la pioche de ${target.villainName}.`,
        ],
      }
      return next
    }
    case 'FATE_ITEM_AT_HOST_TO_AUDELA': {
      // Joujou (à la pose) : place un Objet du lieu hôte (hors Talisman) dans la
      // Pile de l'Au-delà de la cible (auto).
      if (!ctx?.hostLocationId) return state
      const loc = ctx.hostLocationId
      const target = state.players[idx]
      // Objet du lieu hôte (hors Talisman). Esprits des masques (Allié + Objet,
      // `alsoItem`) est une cible valide.
      const item = (target.board[loc] ?? []).find(
        (c) => (c.type === 'item' || c.alsoItem) && c.cardId !== 'talisman',
      )
      if (!item) {
        return { ...state, log: [...state.log, `Joujou : aucun Objet à placer dans l'Au-delà.`] }
      }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => c.instanceId !== item.instanceId) },
        auDela: [...p.auDela, { ...item, attachedTo: undefined }],
      }))
      return {
        ...next,
        log: [...next.log, `Joujou : **${item.name}** est placé dans la Pile de l'Au-delà de ${target.villainName}.`],
      }
    }
    case 'FATE_AUDELA_TO_DECK_TOP': {
      // Big Daddy Le Bœuf (à la pose) : retire une carte de la Pile de l'Au-delà
      // (Régner en priorité, pour le différer) et la place sur le dessus de la
      // pioche Vilain de la cible (auto).
      const target = state.players[idx]
      if (target.auDela.length === 0) {
        return { ...state, log: [...state.log, `Big Daddy : la Pile de l'Au-delà est vide.`] }
      }
      const pick = target.auDela.find((c) => c.cardId === 'regner-nouvelle-orleans') ?? target.auDela[0]
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        auDela: p.auDela.filter((c) => c.instanceId !== pick.instanceId),
        deck: [pick, ...p.deck],
      }))
      return {
        ...next,
        log: [...next.log, `Big Daddy : **${pick.name}** quitte la Pile de l'Au-delà pour le dessus de la pioche de ${target.villainName}.`],
      }
    }
    case 'FATE_MOVE_ALL_HEROES_ADJACENT': {
      // Naveen (à la pose) : déplace chaque Héros du royaume de la cible vers un
      // lieu voisin (auto : le premier lieu adjacent non bloqué).
      const target = state.players[idx]
      let next = state
      for (const loc of target.locations) {
        const heroes = (next.players[idx].board[loc.id] ?? []).filter((c) => c.type === 'hero')
        for (const hero of heroes) {
          const adj = adjacentLocationIds(next, loc.id).filter(
            (d) => !(next.players[idx].lockedLocations ?? []).includes(d) && !(hero.forbiddenLocations ?? []).includes(d),
          )
          if (adj.length === 0) continue
          next = resolveEffect(next, { type: 'MOVE_HERO_TO_LOCATION', locationId: adj[0] }, {
            actorIndex: idx,
            targetHeroId: hero.instanceId,
          })
        }
      }
      return next
    }
    case 'LOOK_TOP_DRAW_DISCARD': {
      // Tour de passe-passe : révèle les `look` premières cartes de la pioche et
      // ouvre le choix (pendingLookTop) — le joueur garde `take` carte(s), le reste
      // est défaussé. Le bot résout automatiquement (enumerate + heuristique).
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const seen: CardInstance[] = []
      while (seen.length < effect.look) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...others] = deck
        deck = others
        seen.push(top)
      }
      if (seen.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche vide (Tour de passe-passe).`] }
      }
      let next = updatePlayer(state, idx, (p) => ({ ...p, deck, discard: disc }))
      const ltTitle = effect.title ?? 'Tour de passe-passe'
      next = {
        ...next,
        rngState: s,
        pendingLookTop: { playerIndex: idx, cards: seen, take: Math.min(effect.take, seen.length), title: effect.title },
        log: [...next.log, `${actor.villainName} regarde les ${seen.length} première${seen.length > 1 ? 's' : ''} carte${seen.length > 1 ? 's' : ''} de sa pioche (${ltTitle}).`],
      }
      return next
    }
    case 'RELOCATE_ALLIES': {
      // Sa Sucrerie — Go ! : déplacer jusqu'à `count` Alliés vers n'importe quel lieu.
      // Choix interactif (pendingAllyRelocate, facultatif). Sans Allié déplaçable : no-op
      // (la carte est de toute façon injouable dans ce cas).
      const hasAlly = Object.values(state.players[idx].board)
        .flat()
        .some((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
      if (!hasAlly) return state
      return {
        ...state,
        pendingAllyRelocate: {
          chooserIndex: idx,
          targetIndex: idx,
          remaining: Math.max(1, effect.count),
          optional: true,
          title: effect.title ?? 'Go !',
        },
      }
    }
    case 'REVEAL_DECK_UNTIL_TYPE': {
      // Ratigan — Liste de Fidget : dévoile les cartes du dessus de la pioche une à
      // une jusqu'à trouver une carte du type voulu (Objet). Celle-ci rejoint la
      // main ; les autres cartes dévoilées sont défaussées. On remélange la défausse
      // dans la pioche si elle se vide en cours de route (borné par le nombre total
      // de cartes disponibles pour éviter toute boucle si aucun Objet n'existe).
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const total = deck.length + disc.length
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (revealed.length < total) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === effect.cardType) {
          found = top
          break
        }
      }
      if (revealed.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (Liste de Fidget).`] }
      }
      const others = found ? revealed.filter((c) => c.instanceId !== found!.instanceId) : revealed
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck,
        hand: found ? [...p.hand, found] : p.hand,
        discard: [...disc, ...others],
      }))
      next = {
        ...next,
        rngState: s,
        pendingReveal: {
          playerIndex: idx,
          cards: revealed,
          keptInstanceId: found?.instanceId,
          title: effect.title ?? 'Cartes dévoilées',
        },
        log: [
          ...next.log,
          found
            ? `${actor.villainName} dévoile ${revealed.length} carte${revealed.length > 1 ? 's' : ''} et ajoute **${found.name}** à sa main ; les autres sont défaussées (Liste de Fidget).`
            : `${actor.villainName} dévoile ${revealed.length} carte${revealed.length > 1 ? 's' : ''} : aucun Objet trouvé, tout est défaussé (Liste de Fidget).`,
        ],
      }
      return next
    }
    case 'AIGRE_BILL_DIG': {
      // Sa Sucrerie — Aigre Bill (joué OU déplacé) : choix FACULTATIF de fouiller la
      // pioche Méchant. On n'ouvre le choix que s'il existe un Allié à trouver (pioche
      // + défausse) ; sinon la fouille n'aurait aucun effet.
      const actor = state.players[idx]
      const hasAlly = [...actor.deck, ...actor.discard].some((c) => c.type === 'ally')
      if (!hasAlly) {
        return { ...state, log: [...state.log, `${actor.villainName} (Aigre Bill) : aucun Allié dans la pioche.`] }
      }
      return { ...state, pendingAigreBill: { playerIndex: idx } }
    }
    case 'SOMBRA_PROTOCOL': {
      // Détruit tous les Piratages/IEM du royaume (→ défausse Vilain) et les Héros
      // piratés (Boop attaché → défausse Fatalité, avec leurs Objets associés). Si
      // TOUS les lieux sont piratés au moment du jeu, Sombra gagne.
      const actor = state.players[idx]
      const allHacked = actor.locations.every((l) =>
        (actor.board[l.id] ?? []).some((c) => c.isPiratage),
      )
      const toVillain: CardInstance[] = []
      const toFate: CardInstance[] = []
      const removeIds = new Set<string>()
      for (const l of actor.locations) {
        const cell = actor.board[l.id] ?? []
        for (const c of cell) {
          if (c.isPiratage) {
            removeIds.add(c.instanceId)
            toVillain.push({ ...c, hackedActionId: undefined })
          } else if (c.type === 'hero' && c.abilityHacked) {
            removeIds.add(c.instanceId)
            toFate.push({ ...c, abilityHacked: undefined, lockedPower: undefined })
            for (const a of cell) {
              if (a.attachedTo !== c.instanceId) continue
              removeIds.add(a.instanceId)
              ;(a.cardId === 'boop' ? toVillain : toFate).push({ ...a, attachedTo: undefined })
            }
          }
        }
      }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: Object.fromEntries(
          p.locations.map((l) => [l.id, (p.board[l.id] ?? []).filter((c) => !removeIds.has(c.instanceId))]),
        ),
        discard: [...p.discard, ...toVillain],
        fateDiscard: [...p.fateDiscard, ...toFate],
      }))
      const nPir = toVillain.filter((c) => c.isPiratage).length
      next = {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} exécute le Protocole Sombra : ${nPir} Piratage(s) détruit(s).`,
        ],
      }
      if (allHacked) {
        return {
          ...next,
          status: 'WON',
          winner: idx,
          log: [...next.log, `🏆 Protocole Sombra : tous les lieux étaient piratés — ${actor.villainName} l'emporte !`],
        }
      }
      return next
    }
    case 'GAIN_POWER_PER_HACK': {
      // Skycode : 1 Pouvoir par lieu piraté + 1 par Héros piraté (Boop).
      const actor = state.players[idx]
      const hackedLocs = actor.locations.filter((l) =>
        (actor.board[l.id] ?? []).some((c) => c.isPiratage),
      ).length
      const hackedHeroes = Object.values(actor.board)
        .flat()
        .filter((c) => c.type === 'hero' && c.abilityHacked).length
      const gross = hackedLocs + hackedHeroes
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      return {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT (${hackedLocs} lieu(x) + ${hackedHeroes} Héros piraté(s)) (Skycode).`,
        ],
      }
    }
    case 'LOSE_POWER_PER_PIRATAGE': {
      // Vol de données (Fatalité) : la cible perd 1 Pouvoir par Piratage/IEM en jeu.
      const actor = state.players[idx]
      const n = Object.values(actor.board).flat().filter((c) => c.isPiratage).length
      const lost = Math.min(n, actor.power)
      if (lost === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Piratage en jeu (Vol de données).`] }
      }
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power - lost }))
      return {
        ...next,
        log: [...next.log, `${actor.villainName} perd ${lost} JT (Vol de données : ${n} Piratage/IEM).`],
      }
    }
    case 'HACK_HERO': {
      // Boop ! : annule la capacité du Héros cible (abilityHacked). Katya Volskaya
      // est immunisée (« ne peut pas être piratée »).
      if (!ctx?.targetHeroId) throw new Error('Boop ! nécessite un Héros cible.')
      const actor = state.players[idx]
      const loc = locationOfCard(actor, ctx.targetHeroId)
      if (!loc) return state
      const hero = (actor.board[loc] ?? []).find((c) => c.instanceId === ctx.targetHeroId)
      if (!hero || hero.type !== 'hero') return state
      if (hero.cardId === 'katya-volskaya') {
        return { ...state, log: [...state.log, `**${hero.name}** ne peut pas être piratée (Boop ! sans effet).`] }
      }
      if (hero.abilityHacked) {
        return { ...state, log: [...state.log, `**${hero.name}** est déjà piraté(e).`] }
      }
      const next = patchCard(state, idx, ctx.targetHeroId, (c) => ({ ...c, abilityHacked: true }))
      return {
        ...next,
        log: [...next.log, `${actor.villainName} pirate **${hero.name}** (Boop !) : sa capacité est annulée.`],
      }
    }
    case 'FATE_IMMUNITY': {
      // Invisibilité : l'acteur ne subit pas de Fatalité jusqu'à son prochain tour.
      const next = updatePlayer(state, idx, (p) => ({ ...p, noFate: true }))
      return { ...next, log: [...next.log, `${next.players[idx].villainName} devient invisible : aucune Fatalité jusqu'à son prochain tour.`] }
    }
    case 'GRANT_FREE_PIRATAGE': {
      // Faille : le prochain Piratage joué ce tour est gratuit.
      const next = updatePlayer(state, idx, (p) => ({ ...p, freePiratage: true }))
      return { ...next, log: [...next.log, `${next.players[idx].villainName} : prochain Piratage gratuit (Faille).`] }
    }
    case 'DRAW_THEN_DISCARD': {
      // Information : pioche `draw` cartes (remélange au besoin), puis ouvre un CHOIX
      // (pendingInformation) : défausser `discard` cartes de la main OU défausser les
      // cartes piochées.
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const drawn: CardInstance[] = []
      while (drawn.length < effect.draw) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        drawn.push(top)
      }
      let next = updatePlayer(state, idx, (p) => ({ ...p, deck, discard: disc, hand: [...p.hand, ...drawn] }))
      next = {
        ...next,
        rngState: s,
        pendingInformation:
          drawn.length > 0
            ? { playerIndex: idx, drawnIds: drawn.map((c) => c.instanceId), discardCount: effect.discard }
            : next.pendingInformation,
        log: [...next.log, `${actor.villainName} pioche ${drawn.length} carte(s) (Information).`],
      }
      return next
    }
    case 'TAKE_FROM_AUDELA_TO_HAND': {
      // Désespoir : prend une carte de la Pile de l'Au-delà (carte clé en
      // priorité) et l'ajoute à la main de l'acteur.
      const actor = state.players[idx]
      if (actor.auDela.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : la Pile de l'Au-delà est vide (Désespoir).`] }
      }
      const ranked = [...actor.auDela].sort((a, b) => auDelaKeyPriority(b) - auDelaKeyPriority(a))
      const pick = ranked[0]
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        auDela: p.auDela.filter((c) => c.instanceId !== pick.instanceId),
        hand: [...p.hand, pick],
      }))
      return {
        ...next,
        log: [...next.log, `${actor.villainName} récupère **${pick.name}** de la Pile de l'Au-delà (Désespoir).`],
      }
    }
    case 'RECOVER_TYPE_FROM_DISCARD': {
      // Terreur : le joueur CHOISIT une carte d'un des `types` (Allié/Événement) dans sa
      // défausse à reprendre en main (ouvre pendingRecover ; bot : auto-pick). Réutilise
      // la même mécanique qu'Extravagance.
      const actor = state.players[idx]
      const candidates = actor.discard.filter((c) => effect.types.includes(c.type))
      const label = effect.label ?? 'Récupération'
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : rien à récupérer dans la défausse (${label}).`] }
      }
      return {
        ...state,
        pendingRecover: { playerIndex: idx, candidateIds: candidates.map((c) => c.instanceId), label },
        log: [...state.log, `${actor.villainName} récupère une carte de sa défausse (${label}).`],
      }
    }

    case 'RECOVER_FROM_DISCARD_CHOICE': {
      // Extravagance : le joueur CHOISIT une carte d'un des `types` (Objet) dans sa
      // défausse à reprendre en main (ouvre pendingRecover ; bot : auto-pick).
      const actor = state.players[idx]
      const candidates = actor.discard.filter((c) => effect.types.includes(c.type))
      const label = effect.label ?? 'Récupération'
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : rien à récupérer dans la défausse (${label}).`] }
      }
      return {
        ...state,
        pendingRecover: { playerIndex: idx, candidateIds: candidates.map((c) => c.instanceId), label },
        log: [...state.log, `${actor.villainName} récupère une carte de sa défausse (${label}).`],
      }
    }

    // ----- Bowser : mécanique des Étoiles -----------------------------------
    case 'RETURN_STAR_TO_OBSERVATORY': {
      const actor = state.players[idx]
      // No-op pour un joueur sans Observatoire (pas Bowser).
      if (actor.starLocationId === undefined || actor.observatoryStars === undefined) return state
      // On NE remet QUE des Étoiles actuellement posées sur des Alliés (les seules
      // récupérables). Une Étoile sur un Allié défaussé est hors-jeu et n'existe
      // plus → rien à reprendre. Sans Étoile sur un Allié → la carte ne fait rien.
      // On retire `amount` Étoile(s) en partant du 1ᵉʳ Allié porteur trouvé (côté
      // adversaire/bot : « choisir » l'Allié ; les autres Alliés ne sont pas touchés).
      let remaining = effect.amount
      const board: typeof actor.board = {}
      for (const locId of Object.keys(actor.board)) {
        board[locId] = (actor.board[locId] ?? []).map((c) => {
          if (remaining > 0 && c.type === 'ally' && (c.stars ?? 0) > 0) {
            const take = Math.min(c.stars ?? 0, remaining)
            remaining -= take
            return { ...c, stars: (c.stars ?? 0) - take }
          }
          return c
        })
      }
      const returned = effect.amount - remaining
      if (returned === 0) {
        return {
          ...state,
          log: [...state.log, `${actor.villainName} : aucune Étoile sur un Allié — rien à remettre à l'Observatoire.`],
        }
      }
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({ ...p, observatoryStars: (p.observatoryStars ?? 0) + returned, board }),
      )
      const np = next.players[idx]
      const s = returned > 1 ? 's' : ''
      return {
        ...next,
        log: [...next.log, `${np.villainName} : ${returned} Étoile${s} reprise${s} sur un Allié et remise${s} à l'Observatoire (total : ${np.observatoryStars}).`],
      }
    }
    case 'LOSE_POWER': {
      const actor = state.players[idx]
      const lost = Math.min(actor.power, effect.amount)
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: Math.max(0, p.power - effect.amount) }))
      const np = next.players[idx]
      return { ...next, log: [...next.log, `${np.villainName} perd ${lost} JT (total : ${np.power}).`] }
    }
    case 'DRAIN_STAR_TO_ALLY': {
      const actor = state.players[idx]
      if ((actor.observatoryStars ?? 0) <= 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : l'Observatoire est déjà épuisé, rien à drainer.`] }
      }
      // Harmonie : tant qu'elle est présente, l'Observatoire garde au moins 1 Étoile.
      if (harmonieKeepsLastStar(actor)) {
        return { ...state, log: [...state.log, `Harmonie veille : l'Observatoire doit garder au moins une Étoile.`] }
      }
      // L'Étoile se place sur un Allié situé sur l'OBSERVATOIRE (d'où elle provient).
      const loc = actor.starLocationId
      if (loc == null) return state
      const cell = actor.board[loc] ?? []
      const allyId = ctx?.allyInstanceIds?.[0]
      const target = allyId
        ? cell.find((c) => c.instanceId === allyId && c.type === 'ally')
        : cell.find((c) => c.type === 'ally' && !c.isWicket)
      if (!target) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Allié sur l'Observatoire pour recevoir l'Étoile.`] }
      }
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({
          ...p,
          observatoryStars: (p.observatoryStars ?? 0) - 1,
          board: {
            ...p.board,
            [loc]: (p.board[loc] ?? []).map((c) =>
              c.instanceId === target.instanceId ? { ...c, stars: (c.stars ?? 0) + 1 } : c,
            ),
          },
        }),
      )
      const np = next.players[idx]
      return {
        ...next,
        log: [...next.log, `${np.villainName} draine une Étoile de l'Observatoire vers **${target.name}** (reste ${np.observatoryStars} à l'Observatoire).`],
      }
    }
    case 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY': {
      const actor = state.players[idx]
      const loc = ctx?.hostLocationId
      const hostId = ctx?.hostInstanceId
      // Uniquement si l'Allié hôte est posé SUR l'Observatoire et qu'il y a une Étoile.
      if (loc === undefined || hostId === undefined || loc !== actor.starLocationId) return state
      if ((actor.observatoryStars ?? 0) <= 0) return state
      if (harmonieKeepsLastStar(actor)) {
        return { ...state, log: [...state.log, `Harmonie veille : l'Observatoire garde sa dernière Étoile.`] }
      }
      const host = (actor.board[loc] ?? []).find((c) => c.instanceId === hostId)
      if (!host) return state
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({
          ...p,
          observatoryStars: (p.observatoryStars ?? 0) - 1,
          board: {
            ...p.board,
            [loc]: (p.board[loc] ?? []).map((c) =>
              c.instanceId === hostId ? { ...c, stars: (c.stars ?? 0) + 1 } : c,
            ),
          },
        }),
      )
      const np = next.players[idx]
      return {
        ...next,
        log: [...next.log, `**${host.name}** prend une Étoile de l'Observatoire (reste ${np.observatoryStars}).`],
      }
    }
    case 'DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST': {
      const loc = ctx?.hostLocationId
      if (loc === undefined) return state
      const actor = state.players[idx]
      const cell = actor.board[loc] ?? []
      const allies = cell.filter((c) => c.type === 'ally' && !c.isWicket)
      if (allies.length === 0) return state
      const allyIds = new Set(allies.map((c) => c.instanceId))
      // Objets associés à ces Alliés → défaussés avec eux.
      const attached = cell.filter((c) => c.attachedTo && allyIds.has(c.attachedTo))
      const removed = new Set([...allyIds, ...attached.map((c) => c.instanceId)])
      const starsReturned = allies.reduce((n, c) => n + (c.stars ?? 0), 0)
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({
          ...p,
          board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
          // Les Étoiles portées repartent à l'Observatoire (on les retire des cartes).
          discard: [...p.discard, ...allies.map((c) => ({ ...c, stars: undefined })), ...attached],
          observatoryStars:
            p.observatoryStars !== undefined ? p.observatoryStars + starsReturned : p.observatoryStars,
        }),
      )
      const sr = starsReturned > 1 ? 's' : ''
      const tail =
        starsReturned > 0 ? ` ; ${starsReturned} Étoile${sr} remise${sr} à l'Observatoire` : ''
      return {
        ...next,
        log: [...next.log, `Luigi défausse ${allies.length} Allié${allies.length > 1 ? 's' : ''} de son lieu${tail}.`],
      }
    }
    case 'CAPTURE_PEACH': {
      const actor = state.players[idx]
      let peachLoc: LocationId | undefined
      let peach: CardInstance | undefined
      for (const l of actor.locations) {
        const found = (actor.board[l.id] ?? []).find(
          (c) => c.type === 'hero' && c.cardId === effect.peachCardId,
        )
        if (found) { peachLoc = l.id; peach = found; break }
      }
      if (!peach || !peachLoc) {
        return { ...state, log: [...state.log, `${actor.villainName} : Peach n'est pas en jeu, impossible de la capturer.`] }
      }
      // Peach quitte le plateau (capturée) : elle + ses Objets associés → défausse
      // Fatalité, et le drapeau de capture est posé (condition de victoire).
      const ploc = peachLoc
      const attached = (actor.board[ploc] ?? []).filter((c) => c.attachedTo === peach!.instanceId)
      const removed = new Set([peach.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        peachCaptured: true,
        board: { ...p.board, [ploc]: (p.board[ploc] ?? []).filter((c) => !removed.has(c.instanceId)) },
        fateDiscard: [...p.fateDiscard, { ...peach!, attachedTo: undefined }, ...attached],
      }))
      return { ...next, log: [...next.log, `${next.players[idx].villainName} capture **Peach** !`] }
    }
    case 'IMPUISSANCE_RESOLVE': {
      // Choix de la carte Impuissance : un Héros cible → on l'élimine (≤ maxStrength) ;
      // sinon → on capture Peach.
      if (ctx?.targetHeroId) {
        return resolveEffect(state, { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: effect.maxStrength }, ctx)
      }
      return resolveEffect(state, { type: 'CAPTURE_PEACH', peachCardId: effect.peachCardId }, ctx)
    }
    case 'RECOVER_ANY_FROM_DISCARD': {
      // Te revoilà ! / Ce qu'il m'a pris : reprend en main une carte QUELCONQUE de
      // la défausse (choix). `label` distingue la carte source dans les messages.
      const actor = state.players[idx]
      const label = effect.label ?? 'Te revoilà !'
      if (actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : défausse vide, rien à récupérer.`] }
      }
      return {
        ...state,
        pendingRecover: { playerIndex: idx, candidateIds: actor.discard.map((c) => c.instanceId), label },
        log: [...state.log, `${actor.villainName} récupère une carte de sa défausse (${label}).`],
      }
    }
    case 'REVEAL_UNTIL_PLAY_ALLY_OR_ITEM': {
      // Vol du château : dévoile jusqu'à un Allié/Objet, remet les autres dévoilées
      // sur le dessus de la pioche, PUIS ouvre le choix du lieu (pendingCastleTheft,
      // affiché des deux côtés). La pose effective se fait à la résolution.
      const actor = state.players[idx]
      let deck = [...actor.deck]
      let disc = [...actor.discard]
      let rng = state.rngState
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (!found) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, rng)
          deck = r.result
          rng = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        if (top.type === 'ally' || top.type === 'item') found = top
        else revealed.push(top)
      }
      // On remet les cartes dévoilées (hors `found`) sur le dessus, dans l'ordre.
      const baseNext = updatePlayer({ ...state, rngState: rng }, idx, (p) => ({
        ...p,
        deck: [...revealed, ...deck],
        discard: disc,
      }))
      if (!found) {
        return { ...baseNext, log: [...baseNext.log, `${actor.villainName} : aucun Allié ni Objet trouvé (Vol du château).`] }
      }
      // Objet associé (à un Allié/Héros) : impossible à poser librement → ira en main.
      const toHand = found.attach === 'ally' || found.attach === 'hero'
      return {
        ...baseNext,
        pendingCastleTheft: { playerIndex: idx, found, revealed, toHand },
        log: [
          ...baseNext.log,
          `${actor.villainName} dévoile sa pioche (Vol du château) et trouve **${found.name}**.`,
        ],
      }
    }
    case 'DISCARD_ONE_ITEM': {
      // Comète farceuse (Fatalité) : défausse un Objet (non associé) du royaume cible.
      const actor = state.players[idx]
      let pickLoc: LocationId | undefined
      let pick: CardInstance | undefined
      for (const l of actor.locations) {
        const found = (actor.board[l.id] ?? []).find((c) => c.type === 'item' && !c.attachedTo)
        if (found) { pickLoc = l.id; pick = found; break }
      }
      if (!pick || !pickLoc) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Objet à défausser (Comète farceuse).`] }
      }
      const ploc = pickLoc
      // Objets associés à cet Objet (aucun en pratique) ignorés ; on défausse l'Objet.
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [ploc]: (p.board[ploc] ?? []).filter((c) => c.instanceId !== pick!.instanceId) },
        discard: [...p.discard, pick!],
      }))
      return { ...next, log: [...next.log, `Comète farceuse : **${pick.name}** est défaussé du royaume de ${actor.villainName}.`] }
    }
    case 'DISCARD_ALLY_OR_ITEM': {
      // Onix (Pokémon Fatalité) : défausse un Allié OU un Objet du royaume de la cible.
      // Auto : la carte la plus « précieuse » (force d'un Allié, ou coût d'un Objet) parmi
      // les Alliés/Objets non associés et non immunisés. Les Objets associés à la cible
      // partent avec elle.
      const actor = state.players[idx]
      type Cand = { c: CardInstance; loc: LocationId; value: number }
      const cands: Cand[] = []
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.attachedTo || c.immuneToAllyItemEffects) continue
          if (c.type === 'ally') cands.push({ c, loc: l.id, value: c.strength ?? 0 })
          else if (c.type === 'item') cands.push({ c, loc: l.id, value: c.cost ?? 0 })
        }
      }
      if (cands.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Allié ni Objet à défausser (Onix).`] }
      }
      const target = [...cands].sort((a, b) => b.value - a.value)[0]
      const loc = target.loc
      const attachedIds = new Set((actor.board[loc] ?? []).filter((c) => c.attachedTo === target.c.instanceId).map((c) => c.instanceId))
      const removeIds = new Set<string>([target.c.instanceId, ...attachedIds])
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [loc]: (pl.board[loc] ?? []).filter((c) => !removeIds.has(c.instanceId)) },
        discard: [
          ...pl.discard,
          { ...target.c, attachedTo: undefined },
          ...(actor.board[loc] ?? []).filter((c) => attachedIds.has(c.instanceId)).map((c) => ({ ...c, attachedTo: undefined })),
        ],
      }))
      return { ...next, log: [...next.log, `Onix : **${target.c.name}** est défaussé du royaume de ${actor.villainName}.`] }
    }
    case 'EVOLVE_ALLY': {
      // Évolution : ouvre le choix de l'Allié à faire évoluer. Candidats = Alliés évolutifs
      // (`evolvesToCardId`) du royaume dont l'évolution n'est PAS déjà en jeu.
      const p = state.players[idx]
      const realmCardIds = new Set(Object.values(p.board).flat().map((c) => c.cardId))
      const candidates = Object.values(p.board)
        .flat()
        .filter((c) => c.type === 'ally' && c.evolvesToCardId && !realmCardIds.has(c.evolvesToCardId))
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : aucun Allié évoluable (Évolution).`] }
      }
      return {
        ...state,
        pendingEvolveAlly: { playerIndex: idx, candidateIds: candidates.map((c) => c.instanceId) },
        log: [...state.log, `${p.villainName} : choisissez l'Allié à faire évoluer.`],
      }
    }
    case 'KO_POKEMON_GE': {
      // « Oui, la guerre ! » : couche (K.O.) gratuitement un Pokémon de force ≥ minStrength
      // du royaume — il devient attrapable. Choix INTERACTIF (clic plateau) dès qu'il y a
      // ≥2 candidats ; auto si un seul ; no-op si aucun.
      const p = state.players[idx]
      const candidates: { c: CardInstance; loc: LocationId }[] = []
      for (const l of p.locations) {
        for (const c of p.board[l.id] ?? []) {
          if (c.isPokemon && !c.pokemonKO && (effectiveStrength(state, idx, c.instanceId) ?? 0) >= effect.minStrength) {
            candidates.push({ c, loc: l.id })
          }
        }
      }
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : aucun Pokémon de force ≥${effect.minStrength} à coucher (Oui, la guerre !).`] }
      }
      if (candidates.length >= 2) {
        return {
          ...state,
          pendingKoPokemon: { chooserIndex: idx, candidateIds: candidates.map((x) => x.c.instanceId) },
          log: [...state.log, `${p.villainName} : choisissez le Pokémon à coucher (Oui, la guerre !).`],
        }
      }
      const target = candidates[0]
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: {
          ...pl.board,
          [target.loc]: (pl.board[target.loc] ?? []).map((c) =>
            c.instanceId === target.c.instanceId ? { ...c, pokemonKO: true, koOnTurn: state.turn } : c,
          ),
        },
      }))
      return { ...next, log: [...next.log, `Oui, la guerre ! : **${target.c.name}** est couché (K.O.) — prêt à être attrapé.`] }
    }
    case 'MOVE_OWN_ALLY_ADJACENT': {
      // Stari (à la pose) : « Vous pouvez déplacer un Allié sur un lieu voisin. » Choix
      // INTERACTIF (clic plateau) : on ouvre pendingAllyRelocate (facultatif, restreint aux
      // lieux voisins). No-op s'il n'existe aucun Allié déplaçable vers un lieu voisin libre.
      const p = state.players[idx]
      const locked = new Set(p.lockedLocations ?? [])
      const canMove = p.locations.some((l) => {
        const hasAlly = (p.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
        return hasAlly && adjacentLocationIds(state, l.id).some((to) => !locked.has(to))
      })
      if (!canMove) return state
      return {
        ...state,
        pendingAllyRelocate: {
          chooserIndex: idx,
          targetIndex: idx,
          optional: true,
          adjacentOnly: true,
          title: 'Stari',
        },
      }
    }
    case 'UNCAPTURE_POKEMON_LE': {
      // « On n'abandonne pas ses amis » (Fatalité) : reprend un Pokémon CAPTURÉ de force
      // ≤ maxStrength (auto : le plus fort éligible, revers maximal) et le remet sur le
      // dessus de la pioche Fatalité. Une seule fois par Pokémon (`noReturnFromCapture`).
      const p = state.players[idx]
      const candidates = (p.capturedPokemon ?? []).filter(
        (c) => (c.strength ?? 0) <= effect.maxStrength && !c.noReturnFromCapture,
      )
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : aucun Pokémon capturé de force ≤${effect.maxStrength} à reprendre (On n'abandonne pas ses amis).`] }
      }
      const target = [...candidates].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
      const returned: CardInstance = {
        ...target, noReturnFromCapture: true, pokemonKO: undefined, koOnTurn: undefined, summonedByInstanceId: undefined, attachedTo: undefined,
      }
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        capturedPokemon: (pl.capturedPokemon ?? []).filter((c) => c.instanceId !== target.instanceId),
        fateDeck: [returned, ...pl.fateDeck],
      }))
      return { ...next, log: [...next.log, `On n'abandonne pas ses amis : **${target.name}** quitte la pile de Captures de ${p.villainName} et retourne sur la pioche Fatalité.`] }
    }
    case 'GAIN_POISON': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, poison: (p.poison ?? 0) + effect.amount }))
      const a = next.players[idx]
      return {
        ...next,
        log: [...next.log, `${a.villainName} prépare ${effect.amount} jeton${effect.amount > 1 ? 's' : ''} de Poison (total : ${a.poison}).`],
      }
    }
    case 'GAIN_POWER_PER_LOCATION_WITH_HERO': {
      const actor = state.players[idx]
      const n = actor.locations.filter((l) => (actor.board[l.id] ?? []).some((c) => c.type === 'hero')).length
      const gained = Math.max(0, n * effect.amount - realmPowerPenalty(state, idx))
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      return {
        ...next,
        log: [...next.log, `${next.players[idx].villainName} gagne ${gained} JT (${n} lieu${n > 1 ? 'x' : ''} avec un Héros).`],
      }
    }
    case 'TAKE_A_BITE': {
      // Ouvre le CHOIX du Héros à croquer (pendingTakeABite). Candidats : Héros du
      // lieu du pion, payables avec le Poison, en respectant la priorité Prof.
      const actor = state.players[idx]
      const loc = actor.pawnLocation
      if (!loc) return state
      const heroes = (actor.board[loc] ?? []).filter((c) => c.type === 'hero' && !c.hypnotized)
      if (heroes.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros ici à croquer (Croque !).`] }
      }
      const poison = actor.poison ?? 0
      const priorityExists = Object.values(actor.board).flat().some((c) => c.type === 'hero' && c.mustDefeatFirst)
      const pool = priorityExists ? heroes.filter((h) => h.mustDefeatFirst) : heroes
      if (priorityExists && pool.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : vous devez d’abord éliminer Prof (Croque !).`] }
      }
      const candidates = pool.filter((h) => (effectiveStrength(state, idx, h.instanceId) ?? 0) <= poison)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pas assez de Poison (${poison}) pour croquer un Héros (Croque !).`] }
      }
      return {
        ...state,
        pendingTakeABite: { playerIndex: idx, candidateIds: candidates.map((h) => h.instanceId) },
        log: [...state.log, `${actor.villainName} : choisissez le Héros à croquer.`],
      }
    }
    case 'FETCH_FATE_HERO': {
      const actor = state.players[idx]
      const cottage = effect.locationId ?? ctx?.hostLocationId ?? actor.cottageLocationId ?? 'maison-des-nains'
      const di = actor.fateDeck.findIndex((c) => c.cardId === effect.heroCardId)
      const fi = actor.fateDiscard.findIndex((c) => c.cardId === effect.heroCardId)
      let heroCard: CardInstance | undefined
      let next = state
      if (di >= 0) {
        heroCard = actor.fateDeck[di]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: p.fateDeck.filter((_, i) => i !== di) }))
      } else if (fi >= 0) {
        heroCard = actor.fateDiscard[fi]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDiscard: p.fateDiscard.filter((_, i) => i !== fi) }))
      }
      if (!heroCard) {
        return { ...state, log: [...state.log, `${actor.villainName} : Héros introuvable (Miroir magique).`] }
      }
      const placed = heroCard
      next = updatePlayer(next, idx, (p) => ({
        ...p,
        board: { ...p.board, [cottage]: [...(p.board[cottage] ?? []), placed] },
      }))
      next = triggerHeroArrival(next, idx, cottage)
      return { ...next, log: [...next.log, `Le Miroir magique fait apparaître **${placed.name}** sur **${locName(next.players[idx], cottage)}**.`] }
    }
    case 'MEDAILLON_FETCH_RALPH': {
      // Sa Sucrerie — Médaillon des Héros de Ralph : cherche Ralph la Casse, le pose sur
      // le lieu hôte du Médaillon, lui associe le Médaillon, et arme son onVanquish
      // (à sa mort → chercher Vanellope sur ce lieu, via FETCH_FATE_HERO sans locationId).
      const loc = ctx?.hostLocationId
      const medallionId = ctx?.hostInstanceId
      if (!loc || !medallionId) return state
      const actor = state.players[idx]
      const di = actor.fateDeck.findIndex((c) => c.cardId === 'ralph-la-casse')
      const fi = di >= 0 ? -1 : actor.fateDiscard.findIndex((c) => c.cardId === 'ralph-la-casse')
      let ralph: CardInstance | undefined
      let next = state
      if (di >= 0) {
        ralph = actor.fateDeck[di]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: p.fateDeck.filter((_, i) => i !== di) }))
      } else if (fi >= 0) {
        ralph = actor.fateDiscard[fi]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDiscard: p.fateDiscard.filter((_, i) => i !== fi) }))
      }
      if (!ralph) {
        return { ...state, log: [...state.log, `${actor.villainName} : Ralph la Casse introuvable (Médaillon).`] }
      }
      const ralphPlaced: CardInstance = {
        ...ralph,
        onVanquish: [{ type: 'FETCH_FATE_HERO', heroCardId: 'vanellope-von-schweetz' }],
      }
      next = updatePlayer(next, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [loc]: [
            ...(p.board[loc] ?? []).map((c) =>
              c.instanceId === medallionId ? { ...c, attachedTo: ralphPlaced.instanceId } : c,
            ),
            ralphPlaced,
          ],
        },
      }))
      next = triggerHeroArrival(next, idx, loc)
      return {
        ...next,
        log: [...next.log, `Le **Médaillon des Héros de Ralph** fait venir **Ralph la Casse** sur **${locName(next.players[idx], loc)}**.`],
      }
    }
    case 'PIGKEEPER_RESOLVE': {
      // On te tient, valet de ferme ! : un Héros cible → on l'élimine (≤ maxStrength) ;
      // sinon → on cherche Tirelire (heroCardId) dans la pioche/défausse Fatalité et on
      // la pose sur le lieu de son choix (placement interactif via pendingFetchedHero).
      if (ctx?.targetHeroId) {
        return resolveEffect(state, { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: effect.maxStrength }, ctx)
      }
      const actor = state.players[idx]
      const di = actor.fateDeck.findIndex((c) => c.cardId === effect.heroCardId)
      const fi = di >= 0 ? -1 : actor.fateDiscard.findIndex((c) => c.cardId === effect.heroCardId)
      let hero: CardInstance | undefined
      let next = state
      if (di >= 0) {
        hero = actor.fateDeck[di]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: p.fateDeck.filter((_, i) => i !== di) }))
      } else if (fi >= 0) {
        hero = actor.fateDiscard[fi]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDiscard: p.fateDiscard.filter((_, i) => i !== fi) }))
      }
      if (!hero) return { ...state, log: [...state.log, `${actor.villainName} : Tirelire introuvable.`] }
      return {
        ...next,
        pendingFetchedHero: { playerIndex: idx, hero, discarded: [] },
        log: [...next.log, `${actor.villainName} cherche **${hero.name}** : à poser sur le lieu de votre choix.`],
      }
    }
    // --- Madame Mim ---------------------------------------------------------
    case 'DEFEAT_MERLIN_IN_REALM':
      // J'établis les règles : vainc directement la Métamorphose de Merlin en jeu.
      return defeatMerlinByEffect(state, idx)
    case 'PLACE_MERLIN_AT_DUEL': {
      // Duel de Sorcellerie : pose la prochaine Métamorphose de Merlin au Lieu du Duel.
      const p = state.players[idx]
      if ((p.merlinDeck?.length ?? 0) === 0) {
        return { ...state, log: [...state.log, `${p.villainName} : la pioche de Métamorphoses de Merlin est vide.`] }
      }
      const next = placeNextMerlin(state, idx)
      const placed = next.players[idx].board[duelLocId(next.players[idx])]?.slice(-1)[0]
      return { ...next, log: [...next.log, `Duel de Sorcellerie : **${placed?.name}** apparaît au Lieu du Duel.`] }
    }
    case 'REORDER_MERLIN_DECK_TOP2': {
      // Pas de Tricherie : le joueur regarde les 2 premières Métamorphoses de Merlin et
      // les replace dans l'ordre de son choix sur le dessus (réordonnancement INTERACTIF,
      // réutilise pendingFateReorder avec `deck: 'merlin'`).
      const p = state.players[idx]
      const deck = p.merlinDeck ?? []
      const top = deck.slice(0, 2)
      if (top.length === 0) return { ...state, log: [...state.log, `${p.villainName} : pioche de Métamorphoses de Merlin vide.`] }
      // On retire le dessus regardé ; il sera replacé (réordonné) par RESOLVE_FATE_REORDER.
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, merlinDeck: (pl.merlinDeck ?? []).slice(top.length) }))
      return {
        ...next,
        pendingFateReorder: { playerIndex: idx, cards: top, deck: 'merlin' },
        log: [...next.log, `Pas de Tricherie : ${p.villainName} regarde le dessus de sa pioche de Métamorphoses de Merlin.`],
      }
    }
    case 'MOVE_MERLIN_ANYWHERE': {
      // Le Savoir conduit à la Puissance (Fatalité) : l'adversaire (state.activePlayer)
      // choisit QUELLE Métamorphose de Merlin déplacer ET vers QUEL lieu. On ouvre un
      // pending interactif (humain : modale ; bot : auto-résolu côté UI).
      const p = state.players[idx]
      const merlins = p.locations.flatMap((l) => (p.board[l.id] ?? []).filter((c) => c.isMerlinTransformation))
      if (merlins.length === 0) {
        return { ...state, log: [...state.log, `Le Savoir conduit à la Puissance : aucune Métamorphose de Merlin en jeu.`] }
      }
      return {
        ...state,
        pendingMerlinMove: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          candidateIds: merlins.map((c) => c.instanceId),
        },
        log: [...state.log, `Le Savoir conduit à la Puissance : choisissez une Métamorphose de Merlin et son lieu de destination.`],
      }
    }
    case 'RECYCLE_DEFEATED_MERLIN': {
      // Merlin (Fatalité) : remet une Métamorphose vaincue (au hasard) dans la pioche Merlin.
      const p = state.players[idx]
      const disc = p.merlinDiscard ?? []
      if (disc.length === 0) return { ...state, log: [...state.log, `Merlin : aucune Métamorphose de Merlin vaincue à remettre en jeu.`] }
      const r = nextRandom(state.rngState)
      const pick = Math.floor(r.value * disc.length)
      const card = disc[pick]
      const sh = shuffle([...(p.merlinDeck ?? []), card], r.state)
      const next = updatePlayer({ ...state, rngState: sh.state }, idx, (pl) => ({
        ...pl,
        merlinDiscard: (pl.merlinDiscard ?? []).filter((_, i) => i !== pick),
        merlinDeck: sh.result,
      }))
      return { ...next, log: [...next.log, `Merlin : **${card.name}** est remélangé dans la pioche de Métamorphoses de Merlin.`] }
    }
    case 'SWAP_DUEL_MERLIN': {
      // Archimède (Fatalité) : remplace la Métamorphose de Merlin en jeu par le dessus de
      // la pioche ; la remplacée est remélangée dans la pioche.
      const p = state.players[idx]
      const found = findMerlinInRealm(p)
      if (!found || (p.merlinDeck?.length ?? 0) === 0) {
        return { ...state, log: [...state.log, `Archimède : impossible de remplacer la Métamorphose de Merlin.`] }
      }
      const [top, ...rest] = p.merlinDeck ?? []
      const sh = shuffle([...rest, found.card], state.rngState)
      const next = updatePlayer({ ...state, rngState: sh.state }, idx, (pl) => ({
        ...pl,
        merlinDeck: sh.result,
        board: {
          ...pl.board,
          [found.loc]: [...(pl.board[found.loc] ?? []).filter((c) => c.instanceId !== found.card.instanceId), top],
        },
      }))
      return { ...next, log: [...next.log, `Archimède : **${found.card.name}** est remplacé par **${top.name}** au Lieu du Duel.`] }
    }
    case 'DISCARD_MIM_TRANSFORMATION': {
      // Merlin Microbe (Fatalité) : défausse une Métamorphose Mim (Allié) du royaume (auto :
      // la moins utile = celle dont le Merlin cible n'est plus à vaincre, sinon la 1ʳᵉ).
      const p = state.players[idx]
      const mims = p.locations.flatMap((l) => (p.board[l.id] ?? []).filter((c) => c.isMimTransformation).map((c) => ({ loc: l.id, c })))
      if (mims.length === 0) return { ...state, log: [...state.log, `Merlin Microbe : aucune Métamorphose Mim en jeu.`] }
      const target = mims[0]
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [target.loc]: (pl.board[target.loc] ?? []).filter((c) => c.instanceId !== target.c.instanceId) },
        discard: [...pl.discard, { ...target.c, attachedTo: undefined }],
      }))
      return { ...next, log: [...next.log, `Merlin Microbe : **${target.c.name}** est défaussé du royaume de ${p.villainName}.`] }
    }
    case 'POISON_ON_FATE_TARGETED': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, poisonOnFateTargeted: true }))
      return {
        ...next,
        log: [...next.log, `${next.players[idx].villainName} : chaque Fatalité subie ajoutera 1 Poison (Poussière de momie).`],
      }
    }
    case 'DISCARD_POISON_PER_HERO_IN_REALM': {
      const actor = state.players[idx]
      const n = Object.values(actor.board).flat().filter((c) => c.type === 'hero').length
      const lost = Math.min(n, actor.poison ?? 0)
      if (lost === 0) return state
      const next = updatePlayer(state, idx, (p) => ({ ...p, poison: (p.poison ?? 0) - lost }))
      return { ...next, log: [...next.log, `Joyeux : ${actor.villainName} défausse ${lost} jeton${lost > 1 ? 's' : ''} de Poison.`] }
    }
    case 'DISCARD_FROM_TARGET_HAND': {
      const actor = state.players[idx]
      if (actor.hand.length === 0) {
        return { ...state, log: [...state.log, `Animaux de la forêt : ${actor.villainName} n'a aucune carte en main.`] }
      }
      // La main de la cible est RÉVÉLÉE et le joueur qui a posé la Fatalité
      // (state.activePlayer) y choisit la carte à défausser (RESOLVE_FATE_CHOICE).
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          kind: 'discard-from-hand',
          candidateIds: actor.hand.map((c) => c.instanceId),
        },
        log: [...state.log, `Animaux de la forêt : ${actor.villainName} révèle sa main ; ${state.players[state.activePlayer].villainName} choisit une carte à défausser.`],
      }
    }
    case 'LOVES_FIRST_KISS': {
      const actor = state.players[idx]
      let next = state
      const hadPoison = (actor.poison ?? 0) > 0
      if (hadPoison) {
        next = updatePlayer(next, idx, (p) => ({ ...p, poison: (p.poison ?? 0) - 1 }))
      }
      const heroes = next.players[idx].fateDiscard.filter((c) => c.type === 'hero')
      const poisonLog = hadPoison ? `${actor.villainName} défausse 1 Poison` : `${actor.villainName} n'a aucun Poison`
      if (heroes.length === 0) {
        return { ...next, log: [...next.log, `Premier baiser d'amour : ${poisonLog}.`] }
      }
      // Le joueur qui pose la Fatalité choisit le Héros de la défausse Fatalité à
      // remettre sur le dessus de la pioche Fatalité (RESOLVE_FATE_CHOICE).
      return {
        ...next,
        pendingFateChoice: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          kind: 'fate-discard-hero-to-top',
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...next.log, `Premier baiser d'amour : ${poisonLog} ; ${state.players[state.activePlayer].villainName} choisit un Héros à remettre sur le dessus de la Fatalité.`],
      }
    }
    case 'BLACK_MAGIC_TUTOR': {
      // Magie noire : le joueur CHOISIT un Objet ou un Ingrédient de sa pioche ou de
      // sa défausse à reprendre en main (pendingRecover, recherche pioche+défausse),
      // puis mélange sa pioche (thenShuffle). Sans candidat → simple mélange.
      const actor = state.players[idx]
      const isTarget = (c: CardInstance) => c.type === 'item' || c.type === 'ingredient'
      const candidates = [...actor.deck, ...actor.discard].filter(isTarget)
      if (candidates.length === 0) {
        const r = shuffle(actor.deck, state.rngState)
        const next = updatePlayer(state, idx, (p) => ({ ...p, deck: r.result }))
        return {
          ...next,
          rngState: r.state,
          log: [...next.log, `Magie noire : aucun Objet/Ingrédient disponible ; ${actor.villainName} mélange sa pioche.`],
        }
      }
      return {
        ...state,
        pendingRecover: {
          playerIndex: idx,
          candidateIds: candidates.map((c) => c.instanceId),
          thenShuffle: true,
          label: 'Magie noire',
        },
        log: [...state.log, `Magie noire : ${actor.villainName} choisit un Objet ou un Ingrédient à reprendre.`],
      }
    }
    case 'DUPLICATE_INGREDIENT': {
      const actor = state.players[idx]
      const zone = actor.ingredients ?? []
      if (zone.length === 0) {
        return { ...state, log: [...state.log, `Foudre : aucun Ingrédient déjà joué à reproduire.`] }
      }
      // Le coût de Foudre = coût de l'Ingrédient reproduit : on ne propose (et ne
      // reproduit) que les Ingrédients que le joueur peut PAYER.
      const affordable = zone.filter((c) => (c.cost ?? 0) <= actor.power)
      if (affordable.length === 0) {
        return { ...state, log: [...state.log, `Foudre : pas assez de Pouvoir pour reproduire un Ingrédient.`] }
      }
      // Un seul Ingrédient payable : paiement + reproduction directe. Plusieurs :
      // le joueur CHOISIT lequel (pendingDuplicateIngredient).
      if (affordable.length === 1) {
        const pick = affordable[0]
        const cost = pick.cost ?? 0
        let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power - cost }))
        next = resolveEffects(next, pick.effects ?? [], { actorIndex: idx })
        return { ...next, log: [...next.log, `Foudre reproduit la capacité de **${pick.name}** (coût ${cost}).`] }
      }
      return {
        ...state,
        pendingDuplicateIngredient: { playerIndex: idx, candidateIds: affordable.map((c) => c.instanceId) },
        log: [...state.log, `Foudre : ${actor.villainName} choisit l'Ingrédient à reproduire.`],
      }
    }
    case 'SCREAM_OF_FRIGHT': {
      // Ouvre le CHOIX : pour chaque lieu non bloqué portant ≥ 1 Héros de force ≤ 3,
      // un déplacement possible vers chaque lieu voisin non bloqué.
      const actor = state.players[idx]
      const locked = new Set(actor.lockedLocations ?? [])
      const options: { from: LocationId; to: LocationId }[] = []
      for (const l of actor.locations) {
        if (locked.has(l.id)) continue
        const hasMovable = (actor.board[l.id] ?? []).some(
          (c) => c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) <= 3,
        )
        if (!hasMovable) continue
        for (const d of adjacentLocationIds(state, l.id)) {
          if (!locked.has(d)) options.push({ from: l.id, to: d })
        }
      }
      if (options.length === 0) {
        return { ...state, log: [...state.log, `Hurlement d'effroi : aucun Héros de force ≤ 3 à déplacer.`] }
      }
      return {
        ...state,
        pendingScream: { playerIndex: idx, options },
        log: [...state.log, `Hurlement d'effroi : ${actor.villainName} choisit les Héros à déplacer.`],
      }
    }
    case 'SCRY_OWN_DECK': {
      const actor = state.players[idx]
      if (actor.deck.length < 2) return state
      const top = actor.deck.slice(0, effect.count)
      const rest = actor.deck.slice(effect.count)
      const rank = (c: CardInstance) =>
        c.cardId === 'miroir-magique' ? 5 : c.type === 'ingredient' ? 4 : c.cardId === 'croque' ? 3 : c.type === 'item' ? 2 : 1
      const ordered = [...top].sort((a, b) => rank(b) - rank(a))
      const next = updatePlayer(state, idx, (p) => ({ ...p, deck: [...ordered, ...rest] }))
      return { ...next, log: [...next.log, `Vanité : ${actor.villainName} réorganise le dessus de sa pioche.`] }
    }
    case 'GRANT_REPEAT_ACTION': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, repeatActionAvailable: true }))
      return {
        ...next,
        log: [...next.log, `Noir de nuit : ${next.players[idx].villainName} peut refaire une action de son lieu (hors Fatalité).`],
      }
    }
    case 'DISCARD_HYENA_AT_HOST': {
      // Scar — Sarabi (à la pose) : défausse une Hyène (la plus forte) sur le lieu
      // de Sarabi, avec ses Objets associés.
      const loc = ctx?.hostLocationId
      const p = state.players[idx]
      const hyena = loc
        ? [...(p.board[loc] ?? [])]
            .filter((c) => c.isHyena && !c.attachedTo)
            .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        : undefined
      if (!loc || !hyena) {
        return { ...state, log: [...state.log, 'Sarabi : aucune Hyène à défausser sur ce lieu.'] }
      }
      const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === hyena.instanceId)
      const removed = new Set([hyena.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        board: { ...pp.board, [loc]: (pp.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
        discard: [...pp.discard, hyena, ...attached],
      }))
      return { ...next, log: [...next.log, `Sarabi défausse **${hyena.name}**.`] }
    }
    case 'FATE_MOVE_HERO_TO_SAFEST': {
      // Scar — Nala (à la pose) : le joueur PEUT déplacer un Héros du royaume vers
      // n'importe quel lieu. Il choisit lequel (sauf Nala elle-même) et où
      // (pendingHeroRelocate, anyLocation, facultatif).
      const p = state.players[idx]
      const selfId = ctx?.hostInstanceId
      const heroIds = p.locations.flatMap((l) =>
        (p.board[l.id] ?? [])
          .filter((c) => c.type === 'hero' && c.instanceId !== selfId)
          .map((c) => c.instanceId),
      )
      if (heroIds.length === 0) return state
      return {
        ...state,
        pendingHeroRelocate: {
          chooserIndex: idx,
          targetIndex: idx,
          anyLocation: true,
          candidateIds: heroIds,
          optional: true,
        },
        log: [...state.log, `Nala : vous pouvez déplacer un Héros vers n'importe quel lieu.`],
      }
    }
    case 'GATHER_HYENAS': {
      // Scar — Festin : rassemble toutes les Hyènes du royaume sur le lieu du pion.
      const p = state.players[idx]
      const dest = p.pawnLocation
      if (!dest) return state
      const moving: CardInstance[] = []
      const movingIds = new Set<string>()
      for (const l of p.locations) {
        if (l.id === dest) continue
        for (const c of p.board[l.id] ?? []) {
          if (c.isHyena && !c.attachedTo) {
            moving.push(c)
            movingIds.add(c.instanceId)
            // Objets associés à la Hyène : ils suivent.
            for (const o of p.board[l.id] ?? []) if (o.attachedTo === c.instanceId) { moving.push(o); movingIds.add(o.instanceId) }
          }
        }
      }
      if (moving.length === 0) return state
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        board: Object.fromEntries(
          pp.locations.map((l) => [
            l.id,
            l.id === dest
              ? [...(pp.board[l.id] ?? []), ...moving]
              : (pp.board[l.id] ?? []).filter((c) => !movingIds.has(c.instanceId)),
          ]),
        ),
      }))
      const destName = p.locations.find((l) => l.id === dest)?.name ?? dest
      const nbHyenas = moving.filter((c) => c.isHyena).length
      return { ...next, log: [...next.log, `Festin : ${nbHyenas} Hyène${nbHyenas > 1 ? 's' : ''} rassemblée${nbHyenas > 1 ? 's' : ''} sur ${destName}.`] }
    }
    case 'HAKUNA_MATATA': {
      // Scar — Hakuna Matata (Fatalité) : le joueur choisit AU CHOIX de rejouer un
      // Héros ≤ 3 de la pile Succession, OU de déplacer un Héros du royaume vers
      // n'importe quel lieu (pendingHakunaMatata, RESOLVE_HAKUNA_MATATA).
      const p = state.players[idx]
      const successionIds = (p.succession ?? []).filter((c) => (c.strength ?? 0) <= 3).map((c) => c.instanceId)
      const realmHeroIds = p.locations.flatMap((l) =>
        (p.board[l.id] ?? []).filter((c) => c.type === 'hero').map((c) => c.instanceId),
      )
      if (successionIds.length === 0 && realmHeroIds.length === 0) {
        return { ...state, log: [...state.log, 'Hakuna Matata : aucun Héros éligible.'] }
      }
      return {
        ...state,
        pendingHakunaMatata: { playerIndex: idx, successionIds, realmHeroIds },
        log: [
          ...state.log,
          'Hakuna Matata : rejouez un Héros (≤3) de la Succession, ou déplacez un Héros du royaume.',
        ],
      }
    }
    case 'PLAY_FREE_HYENA': {
      // Scar — Shenzi (post-placement) : le joueur PEUT jouer gratuitement une Hyène
      // de sa main sur le lieu de Shenzi. S'il y a au moins une Hyène en main, on ouvre
      // le choix (pendingFreeHyena) — il choisit laquelle, ou décline.
      if (!ctx?.hostLocationId) return state
      const actor = state.players[idx]
      const candidates = actor.hand.filter((c) => c.isHyena)
      if (candidates.length === 0) return state
      return {
        ...state,
        pendingFreeHyena: {
          playerIndex: idx,
          locationId: ctx.hostLocationId,
          candidateIds: candidates.map((c) => c.instanceId),
        },
        log: [...state.log, `Shenzi : ${actor.villainName} peut jouer gratuitement une Hyène de sa main.`],
      }
    }
    case 'GNOUS_MOVE': {
      // Scar — Troupeau de gnous (post-placement) : s'il y a un Héros sur le lieu, le
      // joueur CHOISIT vers quel lieu voisin le déplacer (pendingHeroRelocate), PUIS
      // peut faire une action Éliminer un Héros sur ce nouveau lieu (chaîné via
      // `thenTrapVanquish`).
      if (!ctx?.hostLocationId) return state
      const loc = ctx.hostLocationId
      const p = state.players[idx]
      const hero = (p.board[loc] ?? []).find((c) => c.type === 'hero')
      if (!hero) return state
      const order = p.locations.map((l) => l.id)
      const i = order.indexOf(loc)
      const locked = new Set(p.lockedLocations ?? [])
      const neighbors = [order[i - 1], order[i + 1]].filter((id) => !!id && !locked.has(id))
      if (neighbors.length === 0) return state
      return {
        ...state,
        pendingHeroRelocate: {
          chooserIndex: idx,
          targetIndex: idx,
          candidateIds: [hero.instanceId],
          thenTrapVanquish: true,
        },
        log: [...state.log, `Troupeau de gnous : déplacez **${hero.name}** vers un lieu voisin.`],
      }
    }
    case 'REVEAL_FATE_PLAY_HERO': {
      // Scar — Longue vie au roi ! : dévoile les `count` premières cartes Fatalité.
      // Toutes passent en défausse Fatalité ; on en rejoue UN Héros dans le royaume.
      // S'il y a plusieurs Héros dévoilés, le joueur CHOISIT lequel (pendingFateChoice
      // `play-revealed-fate-hero`) ; sinon c'est automatique. Le reste reste défaussé.
      const actor = state.players[idx]
      const revealed = actor.fateDeck.slice(0, effect.count)
      const rest = actor.fateDeck.slice(effect.count)
      if (revealed.length === 0) {
        return { ...state, log: [...state.log, 'Longue vie au roi ! : pioche Fatalité vide.'] }
      }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: rest,
        fateDiscard: [...p.fateDiscard, ...revealed],
      }))
      const heroes = revealed.filter((c) => c.type === 'hero')
      if (heroes.length === 0) {
        return { ...next, log: [...next.log, 'Longue vie au roi ! : aucun Héros dévoilé.'] }
      }
      if (heroes.length === 1) {
        const hero = heroes[0]
        next = updatePlayer(next, idx, (p) => ({ ...p, fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== hero.instanceId) }))
        next = placeScarHero(next, idx, hero)
        return { ...next, log: [...next.log, `Longue vie au roi ! : **${hero.name}** entre dans le royaume.`] }
      }
      // Plusieurs Héros dévoilés → le joueur choisit lequel jouer.
      return {
        ...next,
        pendingFateChoice: {
          chooserIndex: idx,
          targetIndex: idx,
          kind: 'play-revealed-fate-hero',
          candidateIds: heroes.map((h) => h.instanceId),
        },
        log: [...next.log, `Longue vie au roi ! : choisissez le Héros à jouer (${heroes.length} dévoilés).`],
      }
    }
    case 'PLAY_FATE_HERO_FROM_DISCARD': {
      // Scar — Petit secret : joue une carte Fatalité (Héros ou Événement) de la
      // défausse Fatalité. S'il y en a plusieurs, le joueur CHOISIT laquelle
      // (pendingFateChoice `play-fate-card-from-discard`) ; sinon c'est automatique.
      const actor = state.players[idx]
      const candidates = actor.fateDiscard.filter((c) => c.type === 'hero' || c.type === 'effect')
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, 'Petit secret : aucune carte Fatalité jouable dans la défausse.'] }
      }
      if (candidates.length === 1) {
        return playChosenFateFromDiscard(state, idx, candidates[0].instanceId)
      }
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex: idx,
          targetIndex: idx,
          kind: 'play-fate-card-from-discard',
          candidateIds: candidates.map((c) => c.instanceId),
        },
        log: [...state.log, `Petit secret : choisissez la carte Fatalité à jouer (${candidates.length} disponibles).`],
      }
    }
    case 'BE_PREPARED': {
      // Scar — Soyez prêtes ! : défausse les 3 premières cartes de la pioche, puis le
      // joueur choisit de reprendre en main 1 Événement OU jusqu'à 2 Alliés de sa
      // défausse (pendingBePrepared, RESOLVE_BE_PREPARED).
      const actor = state.players[idx]
      const discardedTop = actor.deck.slice(0, 3)
      const restDeck = actor.deck.slice(3)
      const newDiscard = [...actor.discard, ...discardedTop]
      const next = updatePlayer(state, idx, (p) => ({ ...p, deck: restDeck, discard: newDiscard }))
      const candidateIds = newDiscard
        .filter((c) => c.type === 'ally' || c.type === 'effect')
        .map((c) => c.instanceId)
      const drawnLog = `Soyez prêtes ! : ${discardedTop.length} carte${discardedTop.length > 1 ? 's' : ''} défaussée${discardedTop.length > 1 ? 's' : ''}.`
      if (candidateIds.length === 0) {
        return { ...next, log: [...next.log, `${drawnLog} (rien à récupérer dans la défausse.)`] }
      }
      return {
        ...next,
        pendingBePrepared: { playerIndex: idx, candidateIds, alliesOnly: false },
        log: [...next.log, `${drawnLog} Choisissez 1 Événement ou jusqu'à 2 Alliés à reprendre.`],
      }
    }
    case 'FOLLOW_ME': {
      // Scar — Suivez-moi ! : choisissez une Hyène hors de votre lieu et effectuez UNE
      // action disponible de SON lieu (hors Fatalité). On ouvre le choix du lieu
      // (pendingGiantAction `viaFollowMe`) puis la fenêtre d'action distante
      // (actAtLocation), exactement comme la Canne du Dr Facilier.
      const actor = state.players[idx]
      const locations = actor.locations
        .filter((l) => l.id !== actor.pawnLocation && (actor.board[l.id] ?? []).some((c) => c.isHyena))
        .map((l) => l.id)
      if (locations.length === 0) {
        return { ...state, log: [...state.log, 'Suivez-moi ! : aucune Hyène hors de votre lieu.'] }
      }
      return {
        ...state,
        pendingGiantAction: { playerIndex: idx, viaFollowMe: true, locations },
        log: [...state.log, `${actor.villainName} (Suivez-moi !) : choisissez le lieu d'une Hyène où agir.`],
      }
    }
    case 'GAIN_POWER_PER_FATE_DISCARD_HERO': {
      // Yzma — Fausses funérailles : +1 JT par Héros dans la défausse Fatalité (plafond).
      const actor = state.players[idx]
      const heroes = actor.fateDiscard.filter((c) => c.type === 'hero').length
      const gain = Math.min(effect.max, heroes) * dioPowerFactor(actor)
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gain }))
      return {
        ...next,
        log: [...next.log, `+${gain} JT (${heroes} Héros en défausse Fatalité).`],
      }
    }
    case 'LOSE_HALF_POWER': {
      // Perd la moitié de ses JT : arrondi supérieur (Yzma — Mauvais levier, défaut)
      // ou inférieur (Pat Hibulaire — Épuisé).
      const actor = state.players[idx]
      const loss = (effect.roundUp ?? true) ? Math.ceil(actor.power / 2) : Math.floor(actor.power / 2)
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: Math.max(0, p.power - loss) }))
      return { ...next, log: [...next.log, `${actor.villainName} perd ${loss} JT (la moitié de son Pouvoir).`] }
    }
    case 'YZMA_OWN_DECK_ACTION': {
      // Yzma — À l'attaque ! / Marteau : choisir l'une de SES pioches Fatalité non vide.
      const actor = state.players[idx]
      const decks = actor.fateDecks ?? {}
      const hasCards = Object.values(decks).some((d) => d.length > 0)
      if (!hasCards) {
        return { ...state, log: [...state.log, 'Aucune pioche Fatalité disponible.'] }
      }
      return {
        ...state,
        pendingYzmaOwnDeck: { playerIndex: idx, mode: effect.mode },
        log: [...state.log, `${actor.villainName} choisit l'une de ses pioches Fatalité.`],
      }
    }
    case 'FIND_KRONK': {
      // Yzma — Bras droit : Kronk rejoint TOUJOURS la main (depuis la pioche, la
      // défausse OU le royaume). S'il est dans le royaume, ses jetons Pouvoir sont
      // défaussés et ses Objets associés rejoignent aussi la main. On le ramène à un
      // Allié « propre » (transformation Héros / jetons / Étoiles réinitialisés).
      const actor = state.players[idx]
      const cleanKronk = (k: CardInstance): CardInstance => ({
        ...k,
        type: 'ally',
        kronkPower: undefined,
        kronkTransformed: undefined,
        stars: undefined,
        lockedPower: undefined,
        heroSize: undefined,
        hypnotized: undefined,
        attachedTo: undefined,
      })
      const inPile = actor.deck.find((c) => c.cardId === 'kronk') ?? actor.discard.find((c) => c.cardId === 'kronk')
      if (inPile) {
        const next = updatePlayer(state, idx, (p) => ({
          ...p,
          deck: p.deck.filter((c) => c.instanceId !== inPile.instanceId),
          discard: p.discard.filter((c) => c.instanceId !== inPile.instanceId),
          hand: [...p.hand, cleanKronk(inPile)],
        }))
        return { ...next, log: [...next.log, 'Bras droit : Kronk rejoint la main.'] }
      }
      // Kronk dans le royaume : on le retire du plateau (avec ses Objets associés) et
      // tout rejoint la main ; les jetons Pouvoir sont défaussés.
      let loc: string | undefined
      let kronk: CardInstance | undefined
      for (const l of actor.locations) {
        const k = (actor.board[l.id] ?? []).find((c) => c.cardId === 'kronk')
        if (k) { loc = l.id; kronk = k; break }
      }
      if (kronk && loc) {
        const kronkId = kronk.instanceId
        const items = (actor.board[loc] ?? []).filter((c) => c.attachedTo === kronkId)
        const removedIds = new Set([kronkId, ...items.map((c) => c.instanceId)])
        const next = updatePlayer(state, idx, (p) => ({
          ...p,
          board: {
            ...p.board,
            [loc!]: (p.board[loc!] ?? []).filter((c) => !removedIds.has(c.instanceId)),
          },
          hand: [...p.hand, cleanKronk(kronk!), ...items.map((c) => ({ ...c, attachedTo: undefined }))],
        }))
        return {
          ...next,
          log: [
            ...next.log,
            `Bras droit : Kronk rejoint la main${items.length ? ' avec ses Objets' : ''} (jetons Pouvoir défaussés).`,
          ],
        }
      }
      return { ...state, log: [...state.log, 'Bras droit : Kronk introuvable.'] }
    }
    case 'KRONK_DISCARD_TOKENS': {
      // Yzma — Le chemin qui balance : retire tous les jetons de Kronk, gagne autant de JT.
      const p = state.players[idx]
      let loc: string | undefined
      let kronk: CardInstance | undefined
      for (const l of p.locations) {
        const k = (p.board[l.id] ?? []).find((c) => c.cardId === 'kronk')
        if (k) { loc = l.id; kronk = k; break }
      }
      const tokens = kronk?.kronkPower ?? 0
      if (!kronk || !loc || tokens === 0) {
        return { ...state, log: [...state.log, 'Le chemin qui balance : aucun jeton sur Kronk.'] }
      }
      const kronkId = kronk.instanceId
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        power: pp.power + tokens,
        board: {
          ...pp.board,
          [loc!]: (pp.board[loc!] ?? []).map((c) => (c.instanceId === kronkId ? { ...c, kronkPower: 0 } : c)),
        },
      }))
      return { ...next, log: [...next.log, `Le chemin qui balance : +${tokens} JT (jetons de Kronk).`] }
    }
    case 'KRONK_ADD_TOKENS_IF_KUZCO': {
      // Yzma — Chemin de la droiture (Fatalité) : 2 jetons sur Kronk si Kuzco présent, sinon 1.
      const p = state.players[idx]
      const kuzcoInRealm = Object.values(p.board).flat().some((c) => c.cardId === 'kuzco')
      return addKronkTokens(state, idx, kuzcoInRealm ? 2 : 1)
    }
    case 'FINISH_THE_JOB': {
      // Yzma — Finis le travail : déplacer un Allié vers un lieu portant un Héros.
      const actor = state.players[idx]
      const hasAlly = Object.values(actor.board).flat().some((c) => c.type === 'ally' && !c.attachedTo)
      const hasHeroLoc = actor.locations.some((l) => (actor.board[l.id] ?? []).some((c) => c.type === 'hero'))
      if (!hasAlly || !hasHeroLoc) {
        return { ...state, log: [...state.log, 'Finis le travail : aucun Allié ou aucun lieu avec Héros.'] }
      }
      return {
        ...state,
        pendingFinishJob: { playerIndex: idx },
        log: [...state.log, 'Finis le travail : déplacez un Allié vers un lieu où se trouve un Héros.'],
      }
    }
    case 'YZMA_HERO_REALM_TO_DECKS': {
      // En fuite : retire un Héros du royaume et le mélange avec les 4 pioches. On vise
      // EN PRIORITÉ le Héros-cible de l'objectif (Kuzco) — le renvoyer dans les pioches
      // est la disruption maximale (Yzma doit le re-trouver) ; sinon le plus fort.
      const p = state.players[idx]
      const targetId = p.objective.type === 'DEFEAT_HERO_WITH_ALLY' ? p.objective.heroCardId : undefined
      let hero: CardInstance | undefined
      let loc: string | undefined
      // 1) En priorité le Héros-cible de l'objectif (Kuzco) s'il est présent.
      if (targetId) {
        for (const l of p.locations) {
          for (const c of p.board[l.id] ?? []) {
            if (c.type === 'hero' && c.cardId === targetId) { hero = c; loc = l.id }
          }
        }
      }
      // 2) Sinon, le Héros le plus fort du royaume.
      if (!hero) {
        for (const l of p.locations) {
          for (const c of p.board[l.id] ?? []) {
            if (c.type === 'hero' && (!hero || (c.strength ?? 0) > (hero.strength ?? 0))) { hero = c; loc = l.id }
          }
        }
      }
      if (!hero || !loc) return { ...state, log: [...state.log, 'En fuite : aucun Héros dans le royaume.'] }
      const removed = hero
      const next0 = updatePlayer(state, idx, (pp) => ({
        ...pp,
        board: { ...pp.board, [loc!]: (pp.board[loc!] ?? []).filter((c) => c.instanceId !== removed.instanceId) },
      }))
      const next = reformYzmaDecks(next0, idx, p.locations.map((l) => l.id), [removed])
      return { ...next, log: [...next.log, `En fuite : **${removed.name}** est mélangé dans les pioches Fatalité.`] }
    }
    case 'YZMA_HERO_DISCARD_TO_DECKS': {
      // Attention au groove ! / Paysan : le contrôleur choisit un Héros de la défausse
      // (« Vous pouvez » = optionnel) et la/les pioche(s) où le mélanger. On ouvre un
      // choix interactif (pendingYzmaManipulate) ; l'UI/le bot le résolvent.
      const p = state.players[idx]
      const heroIds = p.fateDiscard.filter((c) => c.type === 'hero').map((c) => c.instanceId)
      if (heroIds.length === 0) return { ...state, log: [...state.log, 'Aucun Héros dans la défausse Fatalité.'] }
      // Repli auto si une manipulation est DÉJÀ en attente (ex. lot d'À l'attaque !) :
      // on ne peut pas empiler deux choix → on résout celui-ci automatiquement.
      if (state.pendingYzmaManipulate) {
        const hero = p.fateDiscard.filter((c) => c.type === 'hero').sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        const next0 = updatePlayer(state, idx, (pp) => ({ ...pp, fateDiscard: pp.fateDiscard.filter((c) => c.instanceId !== hero.instanceId) }))
        const targets = smallestYzmaDecks(next0.players[idx], effect.count)
        const next = reformYzmaDecks(next0, idx, targets, [hero])
        return { ...next, log: [...next.log, `**${hero.name}** est mélangé dans ${targets.length} pioche(s) Fatalité.`] }
      }
      return {
        ...state,
        pendingYzmaManipulate: { playerIndex: idx, mode: 'hero-to-decks', count: effect.count, optional: !!effect.optional, heroIds },
        log: [...state.log, `${p.villainName} peut mélanger un Héros de la défausse Fatalité dans une pioche.`],
      }
    }
    case 'YZMA_RESHUFFLE_DECKS': {
      // Pacha : le contrôleur choisit `count` pioches à mélanger (« Vous pouvez »).
      const p = state.players[idx]
      if (state.pendingYzmaManipulate) {
        const targets = smallestYzmaDecks(state.players[idx], effect.count)
        const next = reformYzmaDecks(state, idx, targets, [])
        return { ...next, log: [...next.log, `${targets.length} pioches Fatalité sont mélangées et reformées.`] }
      }
      return {
        ...state,
        pendingYzmaManipulate: { playerIndex: idx, mode: 'reshuffle', count: effect.count, optional: !!effect.optional, heroIds: [] },
        log: [...state.log, `${p.villainName} peut mélanger ${effect.count} pioches Fatalité ensemble.`],
      }
    }
    case 'POETIC_JUSTICE': {
      // Yzma — Ironie du sort : avec un Allié sur son lieu, rejouer un Événement de la
      // défausse (en payant son coût).
      const actor = state.players[idx]
      const hasAlly = !!actor.pawnLocation && (actor.board[actor.pawnLocation] ?? []).some((c) => c.type === 'ally')
      if (!hasAlly) {
        return { ...state, log: [...state.log, 'Ironie du sort : aucun Allié sur votre lieu.'] }
      }
      const candidateIds = actor.discard
        .filter((c) => c.type === 'effect' && (c.cost ?? 0) <= actor.power)
        .map((c) => c.instanceId)
      if (candidateIds.length === 0) {
        return { ...state, log: [...state.log, 'Ironie du sort : aucun Événement abordable en défausse.'] }
      }
      return {
        ...state,
        pendingReplayEvent: { playerIndex: idx, candidateIds },
        log: [...state.log, 'Ironie du sort : choisissez un Événement de votre défausse à rejouer.'],
      }
    }
    case 'BEAUTY_SLEEP': {
      // Yzma — Beauté endormie : effet différé au début du prochain tour. La carte
      // étant la « première ET SEULE action » du tour, on pose aussi le verrou
      // soleActionLock (aucune autre action permise ce tour-ci).
      const next = updatePlayer(state, idx, (p) => ({ ...p, beautySleepPending: true, soleActionLock: true }))
      return { ...next, log: [...next.log, 'Beauté endormie : effet armé pour le début de votre prochain tour. (Seule action de ce tour.)'] }
    }
    case 'DRAW_OR_GAIN_POWER': {
      // Ratigan — Le Grand Génie du Mal : le joueur choisit entre piocher `draw`
      // cartes OU gagner `power` JT. On met le choix en attente ; il est résolu par
      // RESOLVE_DRAW_OR_GAIN_POWER (humain → modale, bot → heuristique côté UI).
      return {
        ...state,
        pendingDrawOrGainPower: { playerIndex: idx, draw: effect.draw, power: effect.power },
      }
    }
    case 'POWER_OR_RACER_BACK': {
      // Sa Sucrerie — Mémoire Verrouillée : choix « +`power` Pouvoir » OU « reculer le
      // jeton Pilote de `racerBack` ». Le choix n'est proposé que si reculer le Pilote a
      // un effet réel (course active ET jeton au-delà de Départ/Arrivée). Sinon : on gagne
      // simplement le Pouvoir (l'autre option n'est pas un vrai choix).
      const me = state.players[idx]
      const canBack = me.villain === 'sa-sucrerie' && me.raceActive && me.racerPos != null && me.racerPos > 0
      if (!canBack) {
        return resolveEffect(state, { type: 'GAIN_POWER', amount: effect.power }, ctx)
      }
      return {
        ...state,
        pendingPowerOrRacerBack: { playerIndex: idx, power: effect.power, racerBack: effect.racerBack },
      }
    }
    case 'TAFFYTA_CHOICE': {
      // Sa Sucrerie — Taffyta Crème Brûlée (jouée OU déplacée) : « reculer le Pilote de 2 »
      // OU « effectuer une action Jouer une carte gratuite ». Reculer le Pilote n'a de
      // sens qu'en course (jeton sur le circuit, pas déjà à 0). Jouer une carte n'est
      // possible que si une carte de la main est jouable et abordable.
      const me = state.players[idx]
      const canBack = me.villain === 'sa-sucrerie' && me.raceActive && me.racerPos != null && me.racerPos > 0
      const canPlay = me.hand.some(
        (c) => c.type !== 'condition' && !c.reactiveOnly && (c.cost ?? 0) <= me.power,
      )
      if (canBack && canPlay) {
        return {
          ...state,
          pendingTaffytaChoice: { playerIndex: idx },
          log: [...state.log, `${me.villainName} (Taffyta Crème Brûlée) : recule le Pilote de 2 OU joue une carte.`],
        }
      }
      if (canBack) return resolveEffect(state, { type: 'KING_CANDY_MOVE_RACER_BACK', amount: 2 }, ctx)
      if (canPlay) return resolveEffect(state, { type: 'GRANT_FREE_ACTION', actionType: 'PLAY_CARD' }, ctx)
      return { ...state, log: [...state.log, `${me.villainName} (Taffyta Crème Brûlée) : aucune option disponible.`] }
    }
    case 'MOVE_REALM_HERO_TO': {
      // Ratigan — Capture : déplace un Héros de force ≤ max vers `locationId`. Les
      // Héros déjà sur la destination sont EXCLUS (déplacement sans effet) ; cf.
      // realmRelocateCandidates (partagé avec la jouabilité et l'UI).
      const actor = state.players[idx]
      const candidates = realmRelocateCandidates(actor, effect.maxStrength, effect.locationId)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros de force ≤ ${effect.maxStrength} à déplacer (Capture).`] }
      }
      // Plusieurs Héros éligibles → le joueur CHOISIT lequel déplacer (destination
      // imposée). Un seul → résolution directe (pas de choix à faire).
      if (candidates.length >= 2) {
        return {
          ...state,
          pendingHeroRelocate: {
            chooserIndex: idx,
            targetIndex: idx,
            candidateIds: candidates.map((c) => c.instanceId),
            forcedLocationId: effect.locationId,
          },
          log: [...state.log, `${actor.villainName} : choisis le Héros (force ≤ ${effect.maxStrength}) à déplacer vers le Repaire secret (Capture).`],
        }
      }
      return resolveEffect(
        state,
        { type: 'MOVE_HERO_TO_LOCATION', locationId: effect.locationId },
        { actorIndex: idx, targetHeroId: candidates[0].instanceId },
      )
    }
    case 'RELOCATE_REALM_HERO_ANYWHERE': {
      // Ratigan — Toby (à la pose) : « Vous pouvez déplacer un Héros vers le lieu de
      // votre choix. » Contrairement à Capture (destination imposée), la destination
      // est ici libre, mais Toby NE PEUT PAS se déplacer lui-même : on exclut la carte
      // hôte des candidats (comme Mégara). Déplacement FACULTATIF.
      const actor = state.players[idx]
      const heroes = Object.values(actor.board)
        .flat()
        .filter((c) => c.type === 'hero' && c.instanceId !== ctx?.hostInstanceId)
      if (heroes.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun autre Héros à déplacer (Toby).`] }
      }
      // « Vous » = le joueur qui pose la Fatalité (l'attaquant = activePlayer), comme
      // Mégara — pas le propriétaire du royaume.
      return {
        ...state,
        pendingHeroRelocate: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          anyLocation: true,
          optional: true,
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} peut déplacer un Héros vers le lieu de son choix (Toby).`],
      }
    }
    case 'MOVE_ALLY_FROM_HOST_ADJACENT': {
      // Cruella — Capitaine (Fatalité) : déplace un Allié du lieu de Capitaine vers un
      // lieu voisin. Auto (choix du fataliseur) : on éloigne l'Allié le plus précieux
      // (Jasper > Horace > autre) vers le voisin non bloqué ayant le MOINS de Tuiles
      // Chiots posées (pour le séparer des captures).
      const loc = ctx?.hostLocationId
      if (!loc) return state
      const p = state.players[idx]
      const allies = (p.board[loc] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
      if (allies.length === 0) {
        return { ...state, log: [...state.log, `Capitaine : aucun Allié à déplacer.`] }
      }
      const rank = (c: CardInstance) => (c.cardId === 'jasper' ? 2 : c.cardId === 'horace-cruella' ? 1 : 0)
      const ally = [...allies].sort((a, b) => rank(b) - rank(a))[0]
      const locked = new Set(p.lockedLocations ?? [])
      const adj = adjacentLocationIds(state, loc).filter((id) => !locked.has(id))
      if (adj.length === 0) return state
      const tilesAt = (lid: string) =>
        (p.puppyTiles ?? []).filter((t) => t.location === lid && t.state === 'board').length
      const dest = [...adj].sort((a, b) => tilesAt(a) - tilesAt(b))[0]
      const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === ally.instanceId)
      const moved = new Set([ally.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        board: {
          ...pp.board,
          [loc]: (pp.board[loc] ?? []).filter((c) => !moved.has(c.instanceId)),
          [dest]: [...(pp.board[dest] ?? []), ally, ...attached],
        },
      }))
      const destName = next.players[idx].locations.find((l) => l.id === dest)?.name ?? dest
      return { ...next, log: [...next.log, `Capitaine déplace **${ally.name}** vers **${destName}**.`] }
    }
    case 'TUTOR_CARD_TO_HAND': {
      // Ratigan — Cloche : cherche `cardId` (Félicia) dans la pioche ou la défausse,
      // l'ajoute à la main, puis remélange la pioche.
      const actor = state.players[idx]
      const found = actor.deck.find((c) => c.cardId === effect.cardId) ?? actor.discard.find((c) => c.cardId === effect.cardId)
      if (!found) {
        return { ...state, log: [...state.log, `${actor.villainName} : ${effect.cardId} introuvable (Cloche).`] }
      }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck: p.deck.filter((c) => c.instanceId !== found.instanceId),
        discard: p.discard.filter((c) => c.instanceId !== found.instanceId),
        hand: [...p.hand, found],
      }))
      const r = shuffle(next.players[idx].deck, next.rngState)
      next = updatePlayer(next, idx, (p) => ({ ...p, deck: r.result }))
      return {
        ...next,
        rngState: r.state,
        log: [...next.log, `${actor.villainName} ajoute **${found.name}** à sa main et remélange sa pioche (Cloche).`],
      }
    }
    case 'DISCARD_ITEM_AT_HOST': {
      // Défausse un Objet non associé du lieu hôte (auto : `preferCardId` en priorité,
      // sinon le plus cher). Utilisé par Ratigan/Basil (vise la Reine Robot) et la
      // Méchante Reine/Atchoum (vise le Miroir magique). `excludePiratage` : ignore les
      // cartes de Piratage/IEM (Sombra — Zarya ne détruit qu'un VRAI Objet).
      if (!ctx?.hostLocationId) throw new Error('DISCARD_ITEM_AT_HOST nécessite un hostLocationId.')
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      const items = (actor.board[loc] ?? []).filter(
        (c) => c.type === 'item' && !c.attachedTo && !(effect.excludePiratage && c.isPiratage),
      )
      if (items.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Objet à défausser sur ce lieu.`] }
      }
      const pick =
        (effect.preferCardId ? items.find((c) => c.cardId === effect.preferCardId) : undefined) ??
        items.reduce((a, b) => ((b.cost ?? 0) > (a.cost ?? 0) ? b : a))
      const attached = (actor.board[loc] ?? []).filter((c) => c.attachedTo === pick.instanceId)
      const removeIds = new Set([pick.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removeIds.has(c.instanceId)) },
        discard: [...p.discard, pick, ...attached],
      }))
      return { ...next, log: [...next.log, `**${pick.name}** est défaussé(e) du royaume de ${actor.villainName}.`] }
    }
    case 'DISCARD_ALLY_AT_HOST_OR_PAY': {
      // Ratigan — Félicia (à la pose) : si un Allié a été choisi (ctx.allyInstanceIds),
      // il est défaussé (avec ses Objets associés). Sinon, l'option « payer » a été
      // retenue : le supplément a déjà été prélevé sur le coût → rien à faire ici.
      const loc = ctx?.hostLocationId
      const chosenId = ctx?.allyInstanceIds?.[0]
      if (!loc || !chosenId) return state
      const actor = state.players[idx]
      const ally = (actor.board[loc] ?? []).find((c) => c.instanceId === chosenId && c.type === 'ally')
      if (!ally) return state
      const attached = (actor.board[loc] ?? []).filter((c) => c.attachedTo === ally.instanceId)
      const removeIds = new Set([ally.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removeIds.has(c.instanceId)) },
        discard: [...p.discard, ally, ...attached],
      }))
      return { ...next, log: [...next.log, `Félicia défausse **${ally.name}**.`] }
    }
    case 'ELIMINATE_ALL_HEROES_AT': {
      // Ratigan — Piège ingénieux : élimine tous les Héros du lieu (Vanquish gratuit),
      // restitue le Pouvoir verrouillé, déclenche les effets « à la mort », et pose le
      // drapeau de victoire si Basil tombe côté « Le Rat ».
      const loc = effect.locationId
      const heroIds = (state.players[idx].board[loc] ?? []).filter((c) => c.type === 'hero').map((c) => c.instanceId)
      if (heroIds.length === 0) {
        return { ...state, log: [...state.log, `Piège ingénieux : aucun Héros sur ce lieu.`] }
      }
      let next = state
      const eliminated: string[] = [] // cardIds montrés dans le showcase
      let restituted = 0 // Pouvoir verrouillé restitué (animé « +N 🪙 »)
      for (const heroId of heroIds) {
        const cur = next.players[idx]
        const cell = cur.board[loc] ?? []
        const hero = cell.find((c) => c.instanceId === heroId)
        if (!hero) continue // déjà retiré par un effet « à la mort » précédent
        // Déguisement (Jafar) : Héros invulnérable, ignoré.
        if (cell.some((c) => c.cardId === 'deguisement' && c.attachedTo === heroId)) continue
        const attached = cell.filter((c) => c.attachedTo === heroId)
        const locked = hero.lockedPower ?? 0
        restituted += locked
        eliminated.push(hero.cardId)
        const heroDiscarded: CardInstance = { ...hero, lockedPower: undefined }
        const ratiganBeatBasil = cur.villain === 'ratigan' && cur.becameTheRat === true && hero.cardId === 'basil'
        const removeIds = new Set([heroId, ...attached.map((c) => c.instanceId)])
        next = updatePlayer(next, idx, (p) => ({
          ...p,
          board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removeIds.has(c.instanceId)) },
          fateDiscard: [...p.fateDiscard, heroDiscarded, ...attached],
          power: p.power + locked,
          objectiveHeroDefeated: ratiganBeatBasil ? true : p.objectiveHeroDefeated,
        }))
        next = {
          ...next,
          lastVanquishedHeroStrength: hero.strength ?? 0,
          log: [...next.log, `**${hero.name}** est éliminé(e) par le Piège ingénieux.`],
        }
        next = resolveEffects(next, hero.onVanquish ?? [], {
          actorIndex: idx,
          hostInstanceId: hero.instanceId,
          hostLocationId: loc,
        })
      }
      // Showcase : les Héros piégés « partent » en défausse (comme un Vanquish).
      if (eliminated.length > 0) {
        next = pushDiscardShowcase(
          next,
          eliminated,
          `Piège ingénieux : ${eliminated.length} Héros éliminé${eliminated.length > 1 ? 's' : ''}`,
          idx,
          'red',
          'bottom',
          restituted > 0 ? { gainedPower: restituted } : undefined,
        )
      }
      return next
    }
    case 'ALLY_REMOTE_ACTION': {
      // Ratigan — Brutes : jouées hors du lieu du pion → fenêtre d'action distante
      // (UNE action disponible du lieu, hors Fatalité). Cette fenêtre est ouverte
      // dans actions.ts (playCard) APRÈS placement, car elle manipule l'économie
      // d'actions (actAtLocation / usedBeforeGiant). Ici : simple marqueur no-op.
      return state
    }

    // --- Pat Hibulaire --------------------------------------------------------
    case 'PLAY_A_GAME': {
      // Une Petite Partie ? : révèle les `reveal` premières cartes Méchant, gagne la
      // somme de leur coût (−1 si Oswald présent), puis les défausse. Win Big si ≥ 4.
      const actor = state.players[idx]
      let deck = [...actor.deck]
      let disc = [...actor.discard]
      let rng = state.rngState
      const revealed: CardInstance[] = []
      while (revealed.length < effect.reveal) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, rng)
          deck = r.result
          rng = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
      }
      const sum = revealed.reduce((n, c) => n + (c.cost ?? 0), 0)
      const reduced =
        effect.reducerHeroCardId && hasHeroInRealm(state, idx, effect.reducerHeroCardId) ? 1 : 0
      const gain = Math.max(0, sum - reduced)
      let next = updatePlayer({ ...state, rngState: rng }, idx, (p) => ({
        ...p,
        deck,
        discard: [...disc, ...revealed],
        power: p.power + gain,
      }))
      next = {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} joue Une Petite Partie ? : ${
            revealed.map((c) => c.name).join(', ') || '—'
          } → +${gain} JT${reduced ? ' (Oswald : −1)' : ''}.`,
        ],
      }
      // Showcase « à suspense » : les cartes se dévoilent une à une (1 s), le coût
      // total s'incrémente, scintille, puis le badge +gain JT s'affiche. Durée =
      // (n−1)·1000 (dévoilements) + 700 (scintillement) + 700 (badge) + 1400 (tenue).
      if (revealed.length > 0) {
        const durationMs = Math.max(0, revealed.length - 1) * 1000 + 2800
        next = pushRevealShowcase(
          next,
          revealed[0].cardId,
          revealed.map((c) => c.cardId),
          revealed.map((c) => c.cost ?? 0),
          idx,
          gain,
          `Une Petite Partie ? → +${gain} JT`,
          { durationMs },
        )
      }
      // Win Big : gain ≥ 4 via CETTE Petite Partie, tuile sur le lieu du pion.
      const me = next.players[idx]
      if (gain >= 4 && me.goals && !goalsBlockedByHero(me)) {
        const g = me.goals.find(
          (x) => x.kind === 'win-big' && !x.completed && x.locationId === me.pawnLocation,
        )
        if (g) {
          const goals = me.goals.map((x) => (x === g ? { ...x, completed: true, revealed: true } : x))
          next = updatePlayer(next, idx, (p) => ({ ...p, goals }))
          next = { ...next, log: [...next.log, `${me.villainName} remplit l'objectif **Jackpot** !`] }
          if (goals.every((x) => x.completed)) {
            next = {
              ...next,
              status: 'WON',
              winner: idx,
              log: [...next.log, `🏆 ${me.villainName} a rempli ses 4 objectifs et l'emporte !`],
            }
          }
        }
      }
      return next
    }
    case 'REVEAL_PETE_GOAL': {
      // Révèle (affichage) la première tuile Objectif encore cachée de la cible.
      const actor = state.players[idx]
      if (!actor.goals) return state
      const i = actor.goals.findIndex((g) => !g.revealed)
      if (i < 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : toutes les tuiles Objectif sont déjà révélées.`] }
      }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        goals: p.goals!.map((g, k) => (k === i ? { ...g, revealed: true } : g)),
      }))
      return { ...next, log: [...next.log, `Une tuile Objectif de ${actor.villainName} est révélée.`] }
    }
    case 'DISCARD_ALLY_BY_CARDID': {
      // Planqués : défausse un Allié de `cardId` (Bandit) du royaume de la cible. Choix
      // INTERACTIF si plusieurs candidats — le joueur qui pose la Fatalité (activePlayer)
      // choisit lequel ; un seul → auto ; aucun → no-op.
      const actor = state.players[idx]
      const candidates: { c: CardInstance; loc: LocationId }[] = []
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.type === 'ally' && c.cardId === effect.cardId && !c.attachedTo) {
            candidates.push({ c, loc: l.id })
          }
        }
      }
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun ${effect.cardId} à défausser (Planqués).`] }
      }
      if (candidates.length >= 2) {
        return {
          ...state,
          pendingFateDiscardAlly: {
            chooserIndex: state.activePlayer,
            targetIndex: idx,
            candidateIds: candidates.map((x) => x.c.instanceId),
            cardName: 'Planqués',
          },
          log: [...state.log, `Planqués : choisissez le ${effect.cardId} à défausser du royaume de ${actor.villainName}.`],
        }
      }
      const ll = candidates[0].loc
      const target = candidates[0].c
      const ids = new Set([
        target.instanceId,
        ...(actor.board[ll] ?? []).filter((c) => c.attachedTo === target.instanceId).map((c) => c.instanceId),
      ])
      const removed = (actor.board[ll] ?? []).filter((c) => ids.has(c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [ll]: (p.board[ll] ?? []).filter((c) => !ids.has(c.instanceId)) },
        discard: [...p.discard, ...removed],
      }))
      return { ...next, log: [...next.log, `${actor.villainName} défausse **${target.name}** (Planqués).`] }
    }
    case 'FATE_SCRY_DISCARD_BY_COST': {
      // Assommé Bêtement : dévoile `count` cartes, défausse celles de coût ≥ minCost,
      // remélange les autres et les replace sur le dessus de la pioche de la cible.
      const actor = state.players[idx]
      let deck = [...actor.deck]
      let disc = [...actor.discard]
      let rng = state.rngState
      const revealed: CardInstance[] = []
      while (revealed.length < effect.count) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, rng)
          deck = r.result
          rng = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
      }
      const toDiscard = revealed.filter((c) => (c.cost ?? 0) >= effect.minCost)
      const keep = revealed.filter((c) => (c.cost ?? 0) < effect.minCost)
      const sh = shuffle(keep, rng)
      rng = sh.state
      let next = updatePlayer({ ...state, rngState: rng }, idx, (p) => ({
        ...p,
        deck: [...sh.result, ...deck],
        discard: [...disc, ...toDiscard],
      }))
      next = {
        ...next,
        log: [
          ...next.log,
          `Assommé Bêtement : ${actor.villainName} défausse ${toDiscard.length} carte${toDiscard.length > 1 ? 's' : ''} de coût ≥ ${effect.minCost}.`,
        ],
      }
      // Showcase animé : on dévoile les cartes scrutées, grise celles ≥ seuil (vers
      // la défausse), puis « remélange + repose sur le dessus » les conservées.
      // Durée calée sur la timeline interne du composant (cf. ScryDiscardShowcase).
      if (revealed.length > 0) {
        const durationMs = revealed.length * 450 + 3600
        next = pushScryDiscardShowcase(
          next,
          'assomme-betement',
          revealed.map((c) => c.cardId),
          revealed.map((c) => c.cost ?? 0),
          revealed.map((c) => (c.cost ?? 0) >= effect.minCost),
          idx,
          `Assommé Bêtement : ${toDiscard.length} carte${toDiscard.length > 1 ? 's' : ''} défaussée${toDiscard.length > 1 ? 's' : ''} (coût ≥ ${effect.minCost})`,
          { durationMs },
        )
      }
      return next
    }
    case 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM': {
      // Minnie : défausse l'Allié le plus fort, à défaut l'Objet (non associé) le plus cher.
      // `onlyType` restreint (Sweet Nightingale → ally ; Jaq → item) ; `preferCardIds`
      // privilégie une cible (Jaq → Cloches de Mariage / Canne).
      const actor = state.players[idx]
      const onlyType = effect.onlyType
      const prefer = effect.preferCardIds ?? []
      let pickLoc: LocationId | undefined
      let pick: CardInstance | undefined
      let bestScore = -1
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.attachedTo) continue
          if (onlyType ? c.type !== onlyType : c.type !== 'ally' && c.type !== 'item') continue
          let s = c.type === 'ally' ? 1000 + (c.strength ?? 0) : (c.cost ?? 0)
          if (prefer.includes(c.cardId)) s += 100000
          if (s > bestScore) { bestScore = s; pick = c; pickLoc = l.id }
        }
      }
      if (!pick || !pickLoc) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucune cible à défausser (Fatalité).`] }
      }
      const ll = pickLoc
      const target = pick
      const ids = new Set([
        target.instanceId,
        ...(actor.board[ll] ?? []).filter((c) => c.attachedTo === target.instanceId).map((c) => c.instanceId),
      ])
      const removed = (actor.board[ll] ?? []).filter((c) => ids.has(c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [ll]: (p.board[ll] ?? []).filter((c) => !ids.has(c.instanceId)) },
        discard: [...p.discard, ...removed],
      }))
      return { ...next, log: [...next.log, `Minnie : ${actor.villainName} défausse **${target.name}**.`] }
    }
    case 'UNTRAP_HERO': {
      // Madame de Trémaine — Bibbidi-Bobbidi-Boo : retire le jeton « piégé » d'un Héros
      // du royaume de la cible (il redevient actif). Auto : on libère le Héros piégé le
      // plus fort (le plus gênant une fois redevenu actif). Sans Héros piégé : no-op.
      const actor = state.players[idx]
      let pick: CardInstance | undefined
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.type === 'hero' && c.trapped && (!pick || (c.strength ?? 0) > (pick.strength ?? 0))) pick = c
        }
      }
      if (!pick) {
        return { ...state, log: [...state.log, `Bibbidi-Bobbidi-Boo : aucun Héros piégé à libérer chez ${actor.villainName}.`] }
      }
      const freed = pick
      const next = patchCard(state, idx, freed.instanceId, (c) => ({ ...c, trapped: false }))
      return { ...next, log: [...next.log, `Bibbidi-Bobbidi-Boo : **${freed.name}** n'est plus piégé.`] }
    }
    case 'FATE_MOVE_ITEM_TO_HOST': {
      // Pluto : déplace un Objet (non associé) d'ailleurs vers le lieu hôte.
      if (!ctx?.hostLocationId) return state
      const actor = state.players[idx]
      const host = ctx.hostLocationId
      let from: LocationId | undefined
      let item: CardInstance | undefined
      for (const l of actor.locations) {
        if (l.id === host) continue
        const f = (actor.board[l.id] ?? []).find((c) => c.type === 'item' && !c.attachedTo)
        if (f) { from = l.id; item = f; break }
      }
      if (!from || !item) {
        return { ...state, log: [...state.log, `Pluto : aucun Objet à déplacer.`] }
      }
      const ff = from
      const it = item
      const ids = new Set([
        it.instanceId,
        ...(actor.board[ff] ?? []).filter((c) => c.attachedTo === it.instanceId).map((c) => c.instanceId),
      ])
      const moving = (actor.board[ff] ?? []).filter((c) => ids.has(c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [ff]: (p.board[ff] ?? []).filter((c) => !ids.has(c.instanceId)),
          [host]: [...(p.board[host] ?? []), ...moving],
        },
      }))
      return {
        ...next,
        log: [...next.log, `Pluto : **${it.name}** est déplacé vers ${findLocation(actor, host)?.name ?? host}.`],
      }
    }
    case 'AIR_STRIKE': {
      // Attaque Aérienne : déplace le pion sur le Héros le plus fort et l'élimine
      // (sans Allié), puis plus aucune autre action ce tour-ci.
      const actor = state.players[idx]
      let bestLoc: LocationId | undefined
      let bestHero: CardInstance | undefined
      let best = -1
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.type === 'hero' && (c.strength ?? 0) > best) { best = c.strength ?? 0; bestHero = c; bestLoc = l.id }
        }
      }
      if (!bestLoc || !bestHero) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros à éliminer (Attaque Aérienne).`] }
      }
      const dest = bestLoc
      let next = updatePlayer(state, idx, (p) => ({ ...p, pawnLocation: dest }))
      next = {
        ...next,
        log: [...next.log, `${actor.villainName} fond sur ${findLocation(actor, dest)?.name ?? dest} (Attaque Aérienne).`],
      }
      next = resolveEffect(next, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { actorIndex: idx, targetHeroId: bestHero.instanceId })
      // « Puis votre tour est terminé » : plus aucune autre action ce tour-ci.
      return updatePlayer(next, idx, (p) => ({ ...p, soleActionLock: true }))
    }
    case 'MOVE_ALLY_OR_ITEM_SMART': {
      // Cheval (bénéfique) : déplacement CHOISI par le joueur → ouvre la fenêtre
      // interactive (modale pour l'humain, auto pour le bot via RESOLVE auto). On
      // n'ouvre que s'il y a au moins un Allié/Objet (non associé) déplaçable.
      if (effect.beneficial) {
        const p = state.players[idx]
        const hasMovable = p.locations.some((l) =>
          (p.board[l.id] ?? []).some((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo),
        )
        if (!hasMovable) {
          return { ...state, log: [...state.log, `${p.villainName} : Cheval — aucun Allié ou Objet à déplacer.`] }
        }
        return { ...state, pendingAllyItemMove: { playerIndex: idx, beneficial: true } }
      }
      // Horace (perturbateur, joué par l'adversaire) : choix auto (heuristique).
      return smartMoveAllyOrItem(state, idx, effect.beneficial)
    }
    case 'DRAW_THEN_BOTTOM': {
      // Sournois : pioche `draw` cartes en main, puis le joueur choisit 1 carte de
      // sa main à replacer sur le dessus/dessous de la pioche (RESOLVE_SOURNOIS —
      // modale pour l'humain, auto pour le bot). Choix PRIVÉ : rien au journal sur
      // les cartes piochées/replacées (info cachée à l'adversaire).
      const actor = state.players[idx]
      let deck = [...actor.deck]
      let disc = [...actor.discard]
      let rng = state.rngState
      const drawn: CardInstance[] = []
      while (drawn.length < effect.draw) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, rng)
          deck = r.result
          rng = r.state
          disc = []
        }
        const [t, ...rest] = deck
        deck = rest
        drawn.push(t)
      }
      const hand = [...actor.hand, ...drawn]
      const next = updatePlayer({ ...state, rngState: rng }, idx, (p) => ({ ...p, deck, hand, discard: disc }))
      // Main vide (cas limite) : rien à replacer.
      if (hand.length === 0) return next
      return { ...next, pendingSournois: { playerIndex: idx } }
    }
    case 'FATE_DISTURB_GOAL': {
      // Dingo : le joueur qui pose la Fatalité (`state.activePlayer`) peut intervertir
      // 2 tuiles Objectif voisines (déplacer 1 tuile vers un lieu « libre » = échanger
      // avec une tuile remplie). Interactif (modale humain / auto bot via RESOLVE_DINGO).
      const actor = state.players[idx]
      if (!actor.goals || dingoSwapOptions(actor).length === 0) {
        return { ...state, log: [...state.log, `Dingo : aucune tuile Objectif à perturber.`] }
      }
      return {
        ...state,
        pendingDingo: { chooserIndex: state.activePlayer, targetIndex: idx },
        log: [...state.log, `Dingo : l'adversaire peut intervertir/déplacer une tuile Objectif de ${actor.villainName}.`],
      }
    }

    // ── Tamatoa ────────────────────────────────────────────────────────────
    case 'PLAY_TOP_MAUI':
      return playTopMauiCard(state, idx)
    case 'REVEAL_TOP_MAUI_CHOICE': {
      // Pas exactement l'heure de Maui : dévoile la 1ʳᵉ carte Maui (remélange si besoin),
      // puis le joueur choisit de la JOUER ou de la DÉFAUSSER (pendingMauiChoice).
      let s = state
      let p = s.players[idx]
      if ((p.mauiDeck ?? []).length === 0) {
        const disc = p.mauiDiscard ?? []
        if (disc.length === 0) return { ...s, log: [...s.log, `Pas exactement l'heure de Maui : pioche Maui vide.`] }
        const r = shuffle(disc, s.rngState)
        s = updatePlayer({ ...s, rngState: r.state }, idx, (pl) => ({ ...pl, mauiDeck: r.result, mauiDiscard: [] }))
        p = s.players[idx]
      }
      const top = (p.mauiDeck ?? [])[0]
      if (!top) return s
      return { ...s, pendingMauiChoice: { playerIndex: idx }, log: [...s.log, `Pas exactement l'heure de Maui : **${top.name}** est dévoilée.`] }
    }
    case 'MAUI_CHAIN': {
      // Heihei Maui : la carte est déjà en défausse Maui (jouée) ; on enchaîne `count` autres.
      let next = state
      for (let k = 0; k < effect.count; k++) next = playTopMauiCard(next, idx)
      return next
    }
    case 'CRUSTACEAN_REVEAL': {
      let s = state
      let pp = s.players[idx]
      // Option (stratégie) : remélanger la défausse Fatalité si le Cœur y dort.
      if ((pp.fateDiscard ?? []).some((c) => c.cardId === 'coeur-de-te-fiti')) {
        const r = shuffle([...pp.fateDeck, ...pp.fateDiscard], s.rngState)
        s = updatePlayer({ ...s, rngState: r.state }, idx, (pl) => ({ ...pl, fateDeck: r.result, fateDiscard: [] }))
        s = { ...s, log: [...s.log, `Crustacé : la défausse Fatalité est remélangée.`] }
        pp = s.players[idx]
      }
      const revealed = (pp.fateDeck ?? []).slice(0, effect.reveal)
      const remaining = (pp.fateDeck ?? []).slice(effect.reveal)
      const items = revealed.filter((c) => c.type === 'item')
      const others = revealed.filter((c) => c.type !== 'item')
      s = updatePlayer(s, idx, (pl) => ({ ...pl, fateDeck: remaining, fateDiscard: [...pl.fateDiscard, ...others] }))
      s = { ...s, log: [...s.log, `Crustacé : dévoile ${revealed.length} carte(s) Fatalité (${items.length} Objet(s)).`] }
      // Chaque Objet dévoilé (Cœur de Te Fiti / Quelque chose qui brille) est JOUÉ sur le
      // lieu DU CHOIX du joueur : on ouvre un pending de pose, un Objet à la fois.
      if (items.length === 0) return s
      return { ...s, pendingCrustaceanPlace: { playerIndex: idx, items } }
    }
    case 'DRAW_PER_HERO_IN_REALM': {
      const heroes = Object.values(state.players[idx].board).flat().filter((c) => c.type === 'hero').length
      return heroes > 0 ? drawNCards(state, idx, heroes) : { ...state, log: [...state.log, `Appât : aucun Héros, aucune carte piochée.`] }
    }
    case 'RESHUFFLE_MAUI_DISCARD': {
      const p = state.players[idx]
      if ((p.mauiDiscard ?? []).length === 0) return state
      const r = shuffle([...(p.mauiDeck ?? []), ...(p.mauiDiscard ?? [])], state.rngState)
      const next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({ ...pl, mauiDeck: r.result, mauiDiscard: [] }))
      return { ...next, log: [...next.log, `${p.villainName} remélange la défausse Maui dans la pioche Maui.`] }
    }
    case 'DEFEAT_HERO_PAY_STRENGTH': {
      const p = state.players[idx]
      const prio = (c: CardInstance) => (c.cardId === 'maui' ? 3 : c.cardId === 'moana' ? 2 : 1)
      const shinyAt = (loc: LocationId) => (p.board[loc] ?? []).some((c) => c.shieldsHeroesAtLocation && !c.attachedTo)
      let targetId = ctx?.targetHeroId
      if (!targetId) {
        const cands: { c: CardInstance; loc: LocationId; f: number }[] = []
        for (const loc of p.locations)
          for (const c of p.board[loc.id] ?? [])
            if (c.type === 'hero' && !shinyAt(loc.id)) cands.push({ c, loc: loc.id, f: effectiveStrength(state, idx, c.instanceId) ?? (c.strength ?? 0) })
        const pick = cands.filter((x) => x.f <= p.power).sort((a, b) => prio(b.c) - prio(a.c) || b.f - a.f)[0]
        targetId = pick?.c.instanceId
      }
      if (!targetId) return { ...state, log: [...state.log, `Tu ressembles à des fruits de mer : aucun Héros abordable.`] }
      let heroLoc: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of p.locations) {
        const f = (p.board[loc.id] ?? []).find((c) => c.instanceId === targetId)
        if (f) { heroLoc = loc.id; hero = f; break }
      }
      if (!hero || !heroLoc || hero.type !== 'hero') return state
      if (shinyAt(heroLoc)) return { ...state, log: [...state.log, `${hero.name} est protégé par « Quelque chose qui brille ».`] }
      const cost = effectiveStrength(state, idx, targetId) ?? (hero.strength ?? 0)
      if (p.power < cost) return { ...state, log: [...state.log, `Tu ressembles à des fruits de mer : Pouvoir insuffisant (${cost} requis).`] }
      const hloc = heroLoc, hid = targetId
      let next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        power: pl.power - cost,
        board: {
          ...pl.board,
          [hloc]: (pl.board[hloc] ?? [])
            .map((c) => ((c.cardId === 'hamecon-de-maui' || c.cardId === 'coeur-de-te-fiti') && c.attachedTo === hid ? { ...c, attachedTo: undefined } : c))
            .filter((c) => c.instanceId !== hid),
        },
        fateDiscard: [...pl.fateDiscard, { ...hero!, permanentStrengthDelta: undefined, lockedPower: undefined, attachedTo: undefined }],
      }))
      next = { ...next, lastVanquishedHeroStrength: hero.strength ?? 0, log: [...next.log, `${p.villainName} paie ${cost} Pouvoir et élimine **${hero.name}** (Tu ressembles à des fruits de mer).`] }
      return resolveEffects(next, hero.onVanquish ?? [], { actorIndex: idx, hostInstanceId: hero.instanceId, hostLocationId: heroLoc })
    }
    case 'ADD_MINUS_FORCE_TOKENS': {
      const p = state.players[idx]
      let targetId = ctx?.targetHeroId
      if (!targetId) {
        const heroes = Object.values(p.board).flat().filter((c) => c.type === 'hero')
        targetId = (heroes.find((h) => h.cardId === 'maui') ?? heroes.sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0])?.instanceId
      }
      if (!targetId) return { ...state, log: [...state.log, `Aucun Héros à affaiblir.`] }
      const tid = targetId
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).map((c) => (c.instanceId === tid ? { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) - effect.max } : c))])),
      }))
      return { ...next, log: [...next.log, `${p.villainName} ajoute ${effect.max} jeton(s) Force −1 à un Héros.`] }
    }
    case 'FETCH_MAUI_ATTACH_HOOK': {
      const existing = tamatoaFindHero(state.players[idx], 'maui')
      if (existing) {
        // Maui déjà en jeu : on retire ses jetons Force (positifs/négatifs).
        const mid = existing.card.instanceId
        const next = updatePlayer(state, idx, (pl) => ({
          ...pl,
          board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).map((c) => (c.instanceId === mid ? { ...c, permanentStrengthDelta: 0, tempStrengthBonus: 0 } : c))])),
        }))
        return { ...next, log: [...next.log, `L'heure de Maui : les jetons Force de Maui sont retirés.`] }
      }
      const fm = fetchCardForTamatoa(state, idx, 'maui')
      if (!fm) return { ...state, log: [...state.log, `L'heure de Maui : Maui est introuvable.`] }
      const loc: LocationId = fm.state.players[idx].pawnLocation ?? 'cage-d-os'
      let next = updatePlayer(fm.state, idx, (pl) => ({ ...pl, board: { ...pl.board, [loc]: [...(pl.board[loc] ?? []), fm.card] } }))
      next = { ...next, log: [...next.log, `L'heure de Maui : **Maui** entre en jeu sur ${findLocation(next.players[idx], loc)?.name}.`] }
      // Cherche l'Hameçon et l'associe à Maui.
      const fh = fetchCardForTamatoa(next, idx, 'hamecon-de-maui')
      if (fh) {
        next = updatePlayer(fh.state, idx, (pl) => ({ ...pl, board: { ...pl.board, [loc]: [...(pl.board[loc] ?? []), { ...fh.card, attachedTo: fm.card.instanceId }] } }))
        next = { ...next, log: [...next.log, `L'**Hameçon de Maui** est associé à Maui.`] }
      }
      return next
    }
    case 'MOVE_HERO_OR_ITEM_ADJACENT': {
      // Fuite (Fatalité) : déplace un Héros (priorité Maui/Moana) ou un Objet non associé
      // vers un lieu voisin. Auto : éloigner un Héros-objectif d'une éventuelle préparation.
      const p = state.players[idx]
      let mv: { id: string; loc: LocationId } | undefined
      for (const loc of p.locations) for (const c of p.board[loc.id] ?? []) {
        if ((c.type === 'hero' || (c.type === 'item' && !c.attachedTo)) && !mv) mv = { id: c.instanceId, loc: loc.id }
        if (c.type === 'hero' && (c.cardId === 'maui' || c.cardId === 'moana')) mv = { id: c.instanceId, loc: loc.id }
      }
      if (!mv) return state
      const dest = adjacentLocationIds(state, mv.loc)[0]
      if (!dest) return state
      const next = relocateCard(state, idx, mv.id, mv.loc, dest)
      return { ...next, log: [...next.log, `Fuite : une carte est déplacée vers ${findLocation(next.players[idx], dest)?.name}.`] }
    }
    case 'REORDER_MAUI_TOP': {
      // Mini Maui (Fatalité) : regarde les `count` premières cartes Maui et les réordonne.
      // Auto (fataliseur) : place la plus GÊNANTE pour Tamatoa sur le dessus (jouée au
      // prochain tour). Barème de nuisance (perte de Pouvoir/Allié, dispersion…).
      const harm: Record<string, number> = {
        'cochon-maui': 5, 'lezard-maui': 5, 'coleoptere-maui': 4, 'renne-maui': 4,
        'requin-maui': 4, 'heihei-maui': 3, 'queue-de-requin-maui': 2, 'tete-de-requin-maui': 2,
        'poisson-maui': 1, 'etoile-de-mer-maui': 0,
      }
      const p = state.players[idx]
      const deck = p.mauiDeck ?? []
      const top = deck.slice(0, effect.count).sort((a, b) => (harm[b.cardId] ?? 1) - (harm[a.cardId] ?? 1))
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, mauiDeck: [...top, ...deck.slice(effect.count)] }))
      return { ...next, log: [...next.log, `Mini Maui : le dessus de la pioche Maui est réordonné.`] }
    }
    case 'HEART_FETCH_MOANA': {
      // Cœur de Te Fiti (onPlace) : cherche Moana, la pose sur le lieu du Cœur et lui associe
      // le Cœur (elle le « vole »). Le Cœur sera libéré quand Moana sera vaincue.
      const heartLoc = ctx?.hostLocationId
      const heartId = ctx?.hostInstanceId
      if (!heartLoc || !heartId) return state
      const existing = tamatoaFindHero(state.players[idx], 'moana')
      if (existing) {
        // Moana déjà en jeu : associe le Cœur à elle (déplace le Cœur sur son lieu).
        const next = updatePlayer(state, idx, (pl) => ({
          ...pl,
          board: {
            ...pl.board,
            [heartLoc]: (pl.board[heartLoc] ?? []).filter((c) => c.instanceId !== heartId),
            [existing.loc]: [...(pl.board[existing.loc] ?? []), { ...(state.players[idx].board[heartLoc] ?? []).find((c) => c.instanceId === heartId)!, attachedTo: existing.card.instanceId }],
          },
        }))
        return { ...next, log: [...next.log, `Le Cœur de Te Fiti est associé à Moana.`] }
      }
      const fm = fetchCardForTamatoa(state, idx, 'moana')
      if (!fm) return { ...state, log: [...state.log, `Cœur de Te Fiti : Moana est introuvable (le Cœur reste libre).`] }
      let next = updatePlayer(fm.state, idx, (pl) => ({
        ...pl,
        board: {
          ...pl.board,
          [heartLoc]: [...(pl.board[heartLoc] ?? []), fm.card],
        },
      }))
      // Associe le Cœur (déjà sur heartLoc) à Moana.
      next = updatePlayer(next, idx, (pl) => ({
        ...pl,
        board: { ...pl.board, [heartLoc]: (pl.board[heartLoc] ?? []).map((c) => (c.instanceId === heartId ? { ...c, attachedTo: fm.card.instanceId } : c)) },
      }))
      return { ...next, log: [...next.log, `Cœur de Te Fiti : **Moana** entre en jeu et s'empare du Cœur.`] }
    }
    case 'MOANA_STEAL_HEART': {
      // Moana (onPlace) : si le Cœur de Te Fiti est en jeu (non associé), elle se l'associe.
      const moanaLoc = ctx?.hostLocationId
      const moanaId = ctx?.hostInstanceId
      if (!moanaLoc || !moanaId) return state
      const p = state.players[idx]
      let heartLoc: LocationId | undefined
      let heart: CardInstance | undefined
      for (const loc of p.locations) {
        const h = (p.board[loc.id] ?? []).find((c) => c.cardId === 'coeur-de-te-fiti' && !c.attachedTo)
        if (h) { heartLoc = loc.id; heart = h; break }
      }
      if (!heart || !heartLoc) return state
      const hl = heartLoc, hcard = heart
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: {
          ...pl.board,
          [hl]: (pl.board[hl] ?? []).filter((c) => c.instanceId !== hcard.instanceId),
          [moanaLoc]: [...(pl.board[moanaLoc] ?? []), { ...hcard, attachedTo: moanaId }],
        },
      }))
      return { ...next, log: [...next.log, `Moana s'empare du Cœur de Te Fiti.`] }
    }
    case 'MAUI_FORCE_TOKENS': {
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        board: Object.fromEntries(pl.locations.map((l) => [l.id, (pl.board[l.id] ?? []).map((c) => {
          if (c.type === 'ally' && !c.isWicket) return { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) + effect.allies }
          if (c.type === 'hero') return { ...c, permanentStrengthDelta: (c.permanentStrengthDelta ?? 0) + effect.heroes }
          return c
        })])),
      }))
      return { ...next, log: [...next.log, `Maui : +${effect.allies} Force aux Alliés, +${effect.heroes} aux Héros.`] }
    }
    case 'DISCARD_TOP_DECK': {
      let next = state
      const dump = (deckKey: 'deck' | 'fateDeck', discKey: 'discard' | 'fateDiscard') => {
        const cur = next.players[idx]
        const removed = (cur[deckKey] as CardInstance[]).slice(0, effect.count)
        if (removed.length === 0) return
        next = updatePlayer(next, idx, (pl) => ({ ...pl, [deckKey]: (pl[deckKey] as CardInstance[]).slice(effect.count), [discKey]: [...(pl[discKey] as CardInstance[]), ...removed] }))
      }
      if (effect.whichDeck === 'fate' || effect.whichDeck === 'both') dump('fateDeck', 'fateDiscard')
      if (effect.whichDeck === 'villain' || effect.whichDeck === 'both') dump('deck', 'discard')
      return { ...next, log: [...next.log, `Maui : défausse le dessus de pioche.`] }
    }
    case 'PLAY_TOP_FATE_ON_SELF': {
      // Requin Maui : joue la 1ʳᵉ carte Fatalité sur Tamatoa lui-même (la pose si Héros/Objet,
      // résout si Événement) — comme une mini-Fatalité subie.
      const p = state.players[idx]
      const [top, ...rest] = p.fateDeck ?? []
      if (!top) return state
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, fateDeck: rest }))
      if (top.type === 'hero' || top.type === 'item') {
        const loc: LocationId = next.players[idx].pawnLocation ?? 'cage-d-os'
        next = updatePlayer(next, idx, (pl) => ({ ...pl, board: { ...pl.board, [loc]: [...(pl.board[loc] ?? []), top] } }))
        next = { ...next, log: [...next.log, `Requin Maui : **${top.name}** est joué sur ${findLocation(next.players[idx], loc)?.name}.`] }
        return resolveEffects(next, top.onPlace ?? [], { actorIndex: idx, hostInstanceId: top.instanceId, hostLocationId: loc })
      }
      next = updatePlayer(next, idx, (pl) => ({ ...pl, fateDiscard: [...pl.fateDiscard, top] }))
      next = { ...next, log: [...next.log, `Requin Maui : **${top.name}** est joué.`] }
      return resolveEffects(next, top.effects ?? [], { actorIndex: idx })
    }
    case 'SHUFFLE_REDISTRIBUTE_ALLIES': {
      const p = state.players[idx]
      const allies: CardInstance[] = []
      const board: Record<string, CardInstance[]> = {}
      for (const loc of p.locations) {
        board[loc.id] = []
        for (const c of p.board[loc.id] ?? []) {
          if (c.type === 'ally' && !c.attachedTo && !c.isWicket) allies.push(c)
          else board[loc.id].push(c)
        }
      }
      if (allies.length === 0) return state
      const r = shuffle(allies, state.rngState)
      const locs = p.locations.map((l) => l.id)
      r.result.forEach((a, i) => board[locs[i % locs.length]].push(a))
      const next = updatePlayer({ ...state, rngState: r.state }, idx, (pl) => ({ ...pl, board }))
      return { ...next, log: [...next.log, `Coléoptère Maui : les Alliés sont redistribués au hasard.`] }
    }
    case 'LOSE_POWER_DRAW': {
      const p = state.players[idx]
      let next = updatePlayer(state, idx, (pl) => ({ ...pl, power: Math.max(0, pl.power - effect.lose) }))
      next = drawNCards(next, idx, effect.draw)
      return { ...next, log: [...next.log, `Cochon Maui : ${p.villainName} perd ${effect.lose} Pouvoir et pioche ${effect.draw} cartes.`] }
    }
    case 'DISCARD_ALLY_GAIN_POWER': {
      const p = state.players[idx]
      let best: { c: CardInstance; loc: LocationId } | undefined
      for (const loc of p.locations) for (const c of p.board[loc.id] ?? []) {
        if (c.type === 'ally' && !c.attachedTo && !c.isWicket) {
          if (!best || (c.strength ?? 0) < (best.c.strength ?? 0)) best = { c, loc: loc.id }
        }
      }
      if (!best) return { ...state, log: [...state.log, `Lézard Maui : aucun Allié à défausser.`] }
      const gain = effectiveStrength(state, idx, best.c.instanceId) ?? (best.c.strength ?? 0)
      const bc = best.c, bl = best.loc
      const attached = (p.board[bl] ?? []).filter((c) => c.attachedTo === bc.instanceId)
      const rm = new Set([bc.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        power: pl.power + gain,
        board: { ...pl.board, [bl]: (pl.board[bl] ?? []).filter((c) => !rm.has(c.instanceId)) },
        discard: [...pl.discard, { ...bc, permanentStrengthDelta: undefined }, ...attached.map((c) => ({ ...c, attachedTo: undefined }))],
      }))
      return { ...next, log: [...next.log, `Lézard Maui : **${bc.name}** est défaussé, ${p.villainName} gagne ${gain} Pouvoir.`] }
    }
    case 'REVEAL_HAND_POWER_PER_CONDITION': {
      const p = state.players[idx]
      const conditions = p.hand.filter((c) => c.type === 'condition')
      if (conditions.length === 0) return { ...state, log: [...state.log, `Poisson Maui : aucune Condition en main.`] }
      const ids = new Set(conditions.map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (pl) => ({
        ...pl,
        power: pl.power + conditions.length,
        hand: pl.hand.filter((c) => !ids.has(c.instanceId)),
        discard: [...pl.discard, ...conditions],
      }))
      return { ...next, log: [...next.log, `Poisson Maui : ${p.villainName} gagne ${conditions.length} Pouvoir et défausse ses Conditions.`] }
    }
    case 'OPTIONAL_SKIP_MOVE_NEXT': {
      const next = updatePlayer(state, idx, (pl) => ({ ...pl, tamatoaSkipMoveNext: true }))
      return { ...next, log: [...next.log, `Étoile de mer Maui : au prochain tour, le déplacement sera facultatif.`] }
    }
  }
}

/** Yzma — `count` pioches Fatalité les plus petites (par id de lieu). */
export function smallestYzmaDecks(player: PlayerState, count: number): string[] {
  const decks = player.fateDecks ?? {}
  return Object.keys(decks)
    .sort((a, b) => (decks[a]?.length ?? 0) - (decks[b]?.length ?? 0))
    .slice(0, Math.max(1, count))
}

/** Yzma — reforme les pioches `targetLocs` (les plus égales possibles) à partir de
 *  leurs cartes + `extra`, mélangées. Remplace ces pioches. */
export function reformYzmaDecks(
  state: GameState,
  idx: number,
  targetLocs: string[],
  extra: CardInstance[],
): GameState {
  const p = state.players[idx]
  const decks = p.fateDecks ?? {}
  const pool = [...targetLocs.flatMap((id) => decks[id] ?? []), ...extra]
  const sh = shuffle(pool, state.rngState)
  const result: Record<string, CardInstance[]> = { ...decks }
  targetLocs.forEach((id) => (result[id] = []))
  sh.result.forEach((c, i) => result[targetLocs[i % targetLocs.length]].push(c))
  return { ...updatePlayer(state, idx, (pp) => ({ ...pp, fateDecks: result })), rngState: sh.state }
}

/** Yzma — ajoute `amount` jetons Pouvoir sur Kronk (où qu'il soit dans le royaume).
 *  À 3 jetons ou plus, Kronk « passe au-dessus du plateau » et devient un Héros
 *  (n'est plus utilisable comme Allié). */
export function addKronkTokens(state: GameState, idx: number, amount: number): GameState {
  const p = state.players[idx]
  let loc: string | undefined
  let kronk: CardInstance | undefined
  for (const l of p.locations) {
    const k = (p.board[l.id] ?? []).find((c) => c.cardId === 'kronk' && !c.kronkTransformed)
    if (k) { loc = l.id; kronk = k; break }
  }
  if (!kronk || !loc) return state
  const kronkId = kronk.instanceId
  const tokens = (kronk.kronkPower ?? 0) + amount
  const transformed = tokens >= 3
  const next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    board: {
      ...pp.board,
      [loc!]: (pp.board[loc!] ?? []).map((c) =>
        c.instanceId === kronkId
          ? { ...c, kronkPower: tokens, ...(transformed ? { type: 'hero' as const, kronkTransformed: true } : {}) }
          : c,
      ),
    },
  }))
  return {
    ...next,
    log: [
      ...next.log,
      transformed
        ? 'Kronk atteint 3 jetons : il passe au-dessus du plateau et devient un Héros !'
        : `Kronk gagne ${amount} jeton${amount > 1 ? 's' : ''} Pouvoir (total ${tokens}).`,
    ],
  }
}

/** Scar — pose un Héros (déjà retiré de sa source) dans son royaume, sur le lieu de
 *  son pion, et résout ses effets « à la pose ». */
/** Dio — élimine DIRECTEMENT un Héros (sans Allié : CREAM, MUDA!) du lieu `loc`. Son Stand
 *  associé retourne dans `standPile` ; Jotaro/Joseph sont RETIRÉS DU JEU (removedFromGame),
 *  les autres vont en défausse Fatalité. */
export function dioDiscardHero(state: GameState, idx: number, loc: LocationId, hero: CardInstance): GameState {
  const cell = state.players[idx].board[loc] ?? []
  const attached = cell.filter((c) => c.attachedTo === hero.instanceId)
  const stands = attached.filter((c) => c.isStand)
  const otherAttached = attached.filter((c) => !c.isStand)
  const rm = new Set([hero.instanceId, ...attached.map((c) => c.instanceId)])
  const removedNow = !!hero.removedFromGameOnDefeat
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    board: { ...pl.board, [loc]: (pl.board[loc] ?? []).filter((c) => !rm.has(c.instanceId)) },
    fateDiscard: removedNow
      ? [...pl.fateDiscard, ...otherAttached.map((c) => ({ ...c, attachedTo: undefined }))]
      : [...pl.fateDiscard, { ...hero, attachedTo: undefined }, ...otherAttached.map((c) => ({ ...c, attachedTo: undefined }))],
    removedFromGame: removedNow ? [...(pl.removedFromGame ?? []), hero.cardId] : pl.removedFromGame,
    standPile: [...(pl.standPile ?? []), ...stands.map((c) => ({ ...c, attachedTo: undefined }))],
  }))
  return {
    ...next,
    log: [...next.log, removedNow ? `**${hero.name}** est RETIRÉ DE LA PARTIE.` : `**${hero.name}** est éliminé.`],
  }
}

function placeScarHero(state: GameState, idx: number, hero: CardInstance): GameState {
  const p = state.players[idx]
  const dest = p.pawnLocation ?? p.locations[0]?.id
  if (!dest) return state
  let next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    board: { ...pp.board, [dest]: [...(pp.board[dest] ?? []), hero] },
  }))
  next = resolveEffects(next, hero.onPlace ?? [], {
    actorIndex: idx,
    hostInstanceId: hero.instanceId,
    hostLocationId: dest,
  })
  return next
}

/** Scar — Petit secret : joue la carte Fatalité `instanceId` de la défausse Fatalité
 *  du joueur `idx`. Héros → entre dans le royaume (sur le lieu du pion) ; Événement →
 *  ses effets se re-déclenchent. La carte est retirée de la défausse. */
export function playChosenFateFromDiscard(state: GameState, idx: number, instanceId: string): GameState {
  const p = state.players[idx]
  const card = p.fateDiscard.find((c) => c.instanceId === instanceId)
  if (!card) return state
  let next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    fateDiscard: pp.fateDiscard.filter((c) => c.instanceId !== instanceId),
  }))
  if (card.type === 'hero') {
    next = placeScarHero(next, idx, card)
    return { ...next, log: [...next.log, `Petit secret : **${card.name}** entre dans le royaume.`] }
  }
  // Événement : on rejoue ses effets (au profit du joueur).
  next = resolveEffects(next, card.effects ?? [], { actorIndex: idx })
  return { ...next, log: [...next.log, `Petit secret : **${card.name}** est rejoué.`] }
}

/** Dr Facilier — priorité « carte clé » pour les choix automatiques (Tour de
 *  passe-passe, Désespoir, Terreur) : plus la valeur est haute, plus la carte est
 *  précieuse pour avancer vers l'objectif. */
function auDelaKeyPriority(c: CardInstance): number {
  switch (c.cardId) {
    case 'regner-nouvelle-orleans': return 100
    case 'talisman': return 90
    case 'divination-facilier': return 80
    case 'tour-passe-passe': return 60
    case 'canne': return 50
    case 'poudre-illusion': return 30
    default: return c.type === 'effect' ? 20 : 10
  }
}

/** Dr Facilier — une carte peut-elle entrer dans la Pile de l'Au-delà ? Le
 *  Talisman et Divination en sont explicitement exclus (mention sur la carte). */
export function canEnterAuDela(c: CardInstance): boolean {
  return c.cardId !== 'talisman' && c.cardId !== 'divination-facilier'
}

/** Bowser — Harmonie : tant qu'un Héros « harmonie » est présent dans le royaume,
 *  l'Observatoire doit garder au moins 1 Étoile → vrai s'il n'en reste qu'une (le
 *  drain de la dernière est interdit). No-op si l'Observatoire est déjà bloqué (0). */
function harmonieKeepsLastStar(actor: PlayerState): boolean {
  if ((actor.observatoryStars ?? 0) > 1) return false
  return Object.values(actor.board).some((cards) =>
    cards.some((c) => c.type === 'hero' && c.cardId === 'harmonie'),
  )
}

/** Dr Facilier — vrai si le joueur DÉTIENT le Talisman : un exemplaire de Talisman
 *  posé LIBREMENT (non associé à un Héros) dans son royaume. */
export function holdsTalisman(player: { board: Record<string, CardInstance[]> }): boolean {
  return Object.values(player.board).flat().some(
    (c) => c.cardId === 'talisman' && !c.attachedTo,
  )
}

/** Résout une liste d'effets dans l'ordre pour le même contexte. */
export function resolveEffects(
  state: GameState,
  effects: Effect[],
  ctx?: EffectContext,
): GameState {
  return effects.reduce((s, e) => resolveEffect(s, e, ctx), state)
}
