// =============================================================================
// L'Imposteur — phase de fin de tour des COÉQUIPIERS.
//
// Ordre (cf. règles) :
//   1. AVANT le déplacement : défausser chaque Tâche / Sabotage dont le lieu porte
//      assez de Coéquipiers (`discardAtCrewmates`, +1 si le Coéquipier imposteur y
//      est posé).
//   2. Incrémenter le compte à rebours des Sabotages survivants (`sabotageTurns`) —
//      à 3, l'objectif KEEP_SABOTAGE est rempli (vérifié au début du tour suivant).
//   3. Déplacer les Coéquipiers (sauf si « portes désactivées »).
//
// Grille de déplacement : 8 colonnes × 2 rangées (16 cases = les 16 actions).
//   col = indexLieu * 2 + slot (0..7) · row = 0 (haut) | 1 (bas).
// 1 case orthogonale par tour (case pleine → on rejoint une autre case libre
// adjacente ; un Coéquipier ne reste que s'il est totalement bloqué ou déjà à la
// cible). Priorité : SABOTAGE (tous convergent) > TÂCHE (les plus proches d'abord) >
// ÉTALEMENT (TOUS les Coéquipiers vers le lieu le moins occupé).
// =============================================================================

import type { CardInstance, Crewmate, FloatingFx, GameState, PlayerState } from './types'

type Cell = { col: number; row: 0 | 1 }

const COEQUIPIER_IMPOSTEUR = 'coequipier-imposteur'

/** Lieux voisins (gauche/droite) d'un lieu, dans l'ordre des lieux. */
export function neighborLocIds(locIds: string[], locId: string): string[] {
  const i = locIds.indexOf(locId)
  return [locIds[i - 1], locIds[i + 1]].filter((v): v is string => !!v)
}

/** Capacité d'une case : jusqu'à 2 Coéquipiers par case → 4 par lieu (2 cases du
 *  haut). */
export const CELL_CAPACITY = 2

/** Première case du HAUT d'un lieu pouvant accueillir un Coéquipier de plus
 *  (< 2 occupants), ou null si le lieu est plein (4 Coéquipiers). Les Coéquipiers
 *  ne descendent jamais sur la rangée du bas. */
export function freeCellAt(
  crew: Crewmate[],
  locId: string,
): { row: 'top' | 'bottom'; slot: number } | null {
  const count = [0, 0]
  for (const c of crew) if (!c.discarded && c.locationId === locId) count[c.slot]++
  for (const slot of [0, 1]) {
    if (count[slot] < CELL_CAPACITY) return { row: 'top', slot }
  }
  return null
}

/** Déplace le Coéquipier `color` sur le lieu `locId` (1ʳᵉ case libre). Sans effet
 *  si le lieu est plein. Renvoie un nouveau tableau de Coéquipiers. */
export function placeCrewmateAt(crew: Crewmate[], color: string, locId: string): Crewmate[] {
  const others = crew.filter((c) => c.color !== color)
  const cell = freeCellAt(others, locId)
  if (!cell) return crew
  return crew.map((c) =>
    c.color === color ? { ...c, locationId: locId, row: cell.row, slot: cell.slot, discarded: false } : c,
  )
}

/** Phase complète de fin de tour des Coéquipiers du joueur `playerIndex`. Pur. */
export function crewmateEndOfTurn(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex]
  if (!player.crewmates || player.crewmates.length === 0) return state

  let next = state
  next = discardCrowdedTasks(next, playerIndex)
  next = tickSabotages(next, playerIndex)
  next = moveCrewmatesEndOfTurn(next, playerIndex)
  next = applyConduit(next, playerIndex)
  next = applySurveillance(next, playerIndex)
  next = applyMapTrigger(next, playerIndex)
  return next
}

/** Carte (Fatalité) : si l'Imposteur ou un de ses Alliés est sur un lieu portant
 *  une Carte, un Coéquipier (de ce lieu en priorité) le suspecte. */
function applyMapTrigger(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  const mapLocs = p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.cardId === 'carte' && !c.attachedTo))
  if (mapLocs.length === 0) return state
  let crew = p.crewmates ?? []
  let changed = false
  for (const loc of mapLocs) {
    const allyHere = (p.board[loc.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo)
    if (p.pawnLocation !== loc.id && !allyHere) continue
    const target =
      crew.find((c) => !c.discarded && !c.suspect && c.locationId === loc.id) ??
      crew.find((c) => !c.discarded && !c.suspect)
    if (target) {
      crew = crew.map((c) => (c.color === target.color ? { ...c, suspect: true } : c))
      changed = true
    }
  }
  if (!changed) return state
  return {
    ...state,
    players: state.players.map((pp, i) => (i === idx ? { ...pp, crewmates: crew } : pp)),
    log: [...state.log, `Carte : un Coéquipier repère ${p.villainName}.`],
  }
}

/** Conduit : après le déplacement, les Coéquipiers sur le lieu du pion suspectent
 *  l'Imposteur, puis le pion rejoint le lieu du Conduit. */
function applyConduit(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  const conduitLoc = p.locations.find((l) =>
    (p.board[l.id] ?? []).some((c) => c.cardId === 'conduit' && !c.attachedTo),
  )?.id
  if (!conduitLoc) return state
  const pawn = p.pawnLocation
  const crew = (p.crewmates ?? []).map((c) =>
    !c.discarded && c.locationId === pawn ? { ...c, suspect: true } : c,
  )
  return {
    ...state,
    players: state.players.map((pp, i) =>
      i === idx ? { ...pp, crewmates: crew, pawnLocation: conduitLoc } : pp,
    ),
    log: [...state.log, `${p.villainName} emprunte le Conduit et rejoint ${p.locations.find((l) => l.id === conduitLoc)?.name ?? conduitLoc}.`],
  }
}

/** Vidéo de surveillance (Fatalité) : tout Coéquipier présent sur un lieu portant
 *  une caméra (après déplacement) suspecte l'Imposteur. */
function applySurveillance(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  const camLocs = new Set(
    p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.cardId === 'video-surveillance' && !c.attachedTo)).map((l) => l.id),
  )
  if (camLocs.size === 0) return state
  let changed = false
  const crew = (p.crewmates ?? []).map((c) => {
    if (!c.discarded && !c.suspect && camLocs.has(c.locationId)) {
      changed = true
      return { ...c, suspect: true }
    }
    return c
  })
  if (!changed) return state
  return {
    ...state,
    players: state.players.map((pp, i) => (i === idx ? { ...pp, crewmates: crew } : pp)),
    log: [...state.log, `Vidéo de surveillance : des Coéquipiers repèrent ${p.villainName}.`],
  }
}

/** Compte les Coéquipiers (non défaussés) présents sur un lieu donné. */
function crewCountAt(player: PlayerState, locationId: string): number {
  return (player.crewmates ?? []).filter((c) => !c.discarded && c.locationId === locationId).length
}

/** 1. Défausse les Tâches/Sabotages dont le lieu porte assez de Coéquipiers. */
function discardCrowdedTasks(state: GameState, idx: number): GameState {
  const player = state.players[idx]
  const toDiscard: { card: CardInstance; locId: string }[] = []
  for (const loc of player.locations) {
    const cards = player.board[loc.id] ?? []
    const hasImpostorAlly = cards.some((c) => c.cardId === COEQUIPIER_IMPOSTEUR && !c.attachedTo)
    const bonus = hasImpostorAlly ? 1 : 0
    for (const c of cards) {
      if (c.attachedTo || c.discardAtCrewmates == null) continue
      if (crewCountAt(player, loc.id) >= c.discardAtCrewmates + bonus) {
        toDiscard.push({ card: c, locId: loc.id })
      }
    }
  }
  if (toDiscard.length === 0) return state
  const ids = new Set(toDiscard.map((d) => d.card.instanceId))
  const logs = toDiscard.map(
    (d) =>
      `Les Coéquipiers neutralisent **${d.card.name}** sur ${player.locations.find((l) => l.id === d.locId)?.name ?? d.locId}.`,
  )
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === idx
        ? {
            ...p,
            board: Object.fromEntries(
              Object.entries(p.board).map(([loc, cards]) => [
                loc,
                cards.filter((c) => !ids.has(c.instanceId)),
              ]),
            ),
            discard: [...p.discard, ...toDiscard.map((d) => ({ ...d.card, sabotageTurns: undefined }))],
          }
        : p,
    ),
    // Son « Task complete » : une Tâche (pas un Sabotage) neutralisée par l'affluence.
    floatingFx: [
      ...(state.floatingFx ?? []),
      ...toDiscard
        .filter((d) => !d.card.isSabotage)
        .map((d): FloatingFx => ({ kind: 'task-completed', playerIndex: idx, cardId: d.card.cardId })),
    ],
    log: [...state.log, ...logs],
  }
}

/** 2. Incrémente le compte à rebours des Sabotages survivants. */
function tickSabotages(state: GameState, idx: number): GameState {
  const player = state.players[idx]
  let touched = false
  const board = Object.fromEntries(
    Object.entries(player.board).map(([loc, cards]) => [
      loc,
      cards.map((c) => {
        if (c.isSabotage && !c.attachedTo) {
          touched = true
          return { ...c, sabotageTurns: (c.sabotageTurns ?? 0) + 1 }
        }
        return c
      }),
    ]),
  )
  if (!touched) return state
  const turns = Object.values(board)
    .flat()
    .find((c) => c.isSabotage)?.sabotageTurns
  return {
    ...state,
    players: state.players.map((p, i) => (i === idx ? { ...p, board } : p)),
    log: [...state.log, `Sabotage maintenu (${turns} tour${(turns ?? 0) > 1 ? 's' : ''}).`],
  }
}

/** 3. Déplace les Coéquipiers d'une case (sauf « portes désactivées »). Pur. */
export function moveCrewmatesEndOfTurn(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex]
  const crew = player.crewmates
  if (!crew || crew.length === 0) return state

  if (player.crewmatesSkipMove) {
    return {
      ...state,
      players: state.players.map((p, i) =>
        i === playerIndex ? { ...p, crewmatesSkipMove: false } : p,
      ),
      log: [...state.log, `Les Coéquipiers de ${player.villainName} ne se déplacent pas (portes désactivées).`],
    }
  }

  const moved = computeMoved(player)
  if (moved === crew) return state
  return {
    ...state,
    players: state.players.map((p, i) => (i === playerIndex ? { ...p, crewmates: moved } : p)),
    log: [...state.log, `Les Coéquipiers de ${player.villainName} se déplacent.`],
  }
}

function computeMoved(player: PlayerState): Crewmate[] {
  const crew = player.crewmates ?? []
  const locIds = player.locations.map((l) => l.id)
  const N = locIds.length
  const locIndex = (id: string) => locIds.indexOf(id)
  const colOf = (c: Crewmate) => locIndex(c.locationId) * 2 + c.slot

  const distToLoc = (col: number, loc: number) => {
    const lo = loc * 2
    const hi = loc * 2 + 1
    if (col < lo) return lo - col
    if (col > hi) return col - hi
    return 0
  }

  // Mode courant (data-driven : flags isSabotage / discardAtCrewmates).
  let sabotageLoc = -1
  let taskLocs: number[] = []
  for (const l of player.locations) {
    for (const c of player.board[l.id] ?? []) {
      if (c.attachedTo) continue
      if (c.isSabotage) sabotageLoc = locIndex(l.id)
      else if (c.discardAtCrewmates != null) taskLocs.push(locIndex(l.id))
    }
  }
  taskLocs = [...new Set(taskLocs)]

  const live = crew.filter((c) => !c.discarded)
  const countByLoc = new Array<number>(N).fill(0)
  for (const c of live) countByLoc[locIndex(c.locationId)]++

  const targetOf = (c: Crewmate): number | null => {
    const myLoc = locIndex(c.locationId)
    const col = colOf(c)
    if (sabotageLoc >= 0) return myLoc === sabotageLoc ? null : sabotageLoc
    if (taskLocs.length > 0) {
      if (taskLocs.includes(myLoc)) return null
      let best = taskLocs[0]
      let bestD = distToLoc(col, best)
      for (const t of taskLocs) {
        const d = distToLoc(col, t)
        if (d < bestD) {
          bestD = d
          best = t
        }
      }
      return best
    }
    // Étalement (ni Sabotage ni Tâche) : TOUS les Coéquipiers se déplacent vers le
    // lieu le moins occupé (ils doivent tous bouger ; seul celui qui y est déjà reste).
    let best = 0
    for (let l = 1; l < N; l++) if (countByLoc[l] < countByLoc[best]) best = l
    return best === myLoc ? null : best
  }

  // Occupation par case (capacité CELL_CAPACITY = 2 par case).
  const count = new Map<number, number>()
  const inc = (col: number, d: number) => count.set(col, (count.get(col) ?? 0) + d)
  for (const c of live) inc(colOf(c), 1)

  const decided = new Map<string, Cell>()
  const movers = live
    .map((c) => ({ c, target: targetOf(c) }))
    .filter((m): m is { c: Crewmate; target: number } => m.target !== null)
  for (const c of live) if (targetOf(c) === null) decided.set(c.color, { col: colOf(c), row: 0 })

  movers.sort((a, b) => {
    const da = distToLoc(colOf(a.c), a.target)
    const db = distToLoc(colOf(b.c), b.target)
    return da - db || (a.c.color < b.c.color ? -1 : 1)
  })

  const free = (nc: number) => nc >= 0 && nc < N * 2 && (count.get(nc) ?? 0) < CELL_CAPACITY
  for (const { c, target } of movers) {
    const col = colOf(c)
    inc(col, -1) // il quitte sa case
    const sign = col < target * 2 ? 1 : -1
    // Déplacement HORIZONTAL uniquement (1 case/tour, jamais la rangée du bas). On
    // avance vers la cible si la case voisine a de la place ; sinon le Coéquipier
    // DOIT quand même bouger → il rejoint l'autre case libre adjacente ; s'il est
    // totalement bloqué (les deux voisines pleines / hors grille), il reste.
    const toward = col + sign
    const away = col - sign
    const destCol = free(toward) ? toward : free(away) ? away : col
    inc(destCol, 1)
    decided.set(c.color, { col: destCol, row: 0 })
  }

  let changed = false
  const next = crew.map((c) => {
    if (c.discarded) return c
    const cell = decided.get(c.color)
    if (!cell) return c
    const newLoc = locIds[Math.floor(cell.col / 2)]
    const newSlot = cell.col % 2
    const newRow: 'top' | 'bottom' = cell.row === 0 ? 'top' : 'bottom'
    if (c.locationId === newLoc && c.slot === newSlot && c.row === newRow) return c
    changed = true
    return { ...c, locationId: newLoc, slot: newSlot, row: newRow }
  })
  return changed ? next : crew
}
