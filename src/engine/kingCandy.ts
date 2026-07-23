// =============================================================================
// kingCandy.ts — Sa Sucrerie (King Candy / Sugar Rush)
//
// Mécanique du CIRCUIT EN HUIT, isolée ici pour ne pas disperser la logique dans
// rules/actions/effects. Un seul « lieu » (sugar-rush) dont les 18 actions (a0..a17)
// forment une boucle. Le pion avance de 1 à 4 cases ; il n'accède qu'à 3 actions
// (derrière / dessus / devant). Un jeton Pilote (Vanellope) court contre lui : il
// faut franchir Départ/Arrivée (index 0) AVANT lui, un Bug associé à Vanellope.
// =============================================================================

import type { CardInstance, GameState, PlayerState } from './types'
import { updatePlayer } from './state'
import { plural } from './plural'

export const SUGAR_RUSH_LOC = 'sugar-rush'
/** Les 4 zones de pose (sous le circuit) où vivent les Alliés/Objets/Héros. */
export const SUGAR_RUSH_ZONES = ['zone-1', 'zone-2', 'zone-3', 'zone-4'] as const
export const TRACK_LEN = 18
/** Index de la case Départ/Arrivée. */
export const FINISH_INDEX = 0

/** Ce joueur est-il Sa Sucrerie (circuit en huit) ? */
export function isKingCandy(p: PlayerState): boolean {
  return p.villain === 'sa-sucrerie'
}

/** Le lieu `locId` de ce joueur est-il le CIRCUIT (et non une zone de cartes) ? Le
 *  circuit ne reçoit aucune carte : il est exclu de la pose, de l'adjacence et des
 *  cibles de Fatalité. Seules les 4 zones accueillent Alliés/Objets/Héros. */
export function isTrackLocation(p: PlayerState, locId: string): boolean {
  return isKingCandy(p) && locId === SUGAR_RUSH_LOC
}

/** Ids des lieux de ce joueur où l'on peut POSER des cartes (exclut le circuit). */
export function cardLocationIds(p: PlayerState): string[] {
  return p.locations.map((l) => l.id).filter((id) => !isTrackLocation(p, id))
}

const norm = (i: number): number => ((i % TRACK_LEN) + TRACK_LEN) % TRACK_LEN

/** Indices des 3 actions accessibles depuis `trackPos` : derrière, dessus, devant. */
export function accessibleTrackIndices(trackPos: number): number[] {
  const at = norm(trackPos)
  return [norm(at - 1), at, norm(at + 1)]
}

/** Ids d'action (a0..a17) accessibles depuis la position courante du pion. */
export function accessibleActionIds(p: PlayerState): Set<string> {
  const actions = p.locations[0]?.actions ?? []
  return new Set(
    accessibleTrackIndices(p.trackPos ?? 0)
      .map((i) => actions[i]?.id)
      .filter((id): id is string => !!id),
  )
}

/** Plage de déplacement autorisée : 1–4 normalement, 2–3 si Félix Fixe Jr. est en jeu. */
export function trackMoveRange(p: PlayerState): { min: number; max: number } {
  const felix = Object.values(p.board)
    .flat()
    .some((c) => c.type === 'hero' && c.cardId === 'felix-fixe-jr' && !c.hypnotized)
  return felix ? { min: 2, max: 3 } : { min: 1, max: 4 }
}

/** Vanellope (Héros) présente dans le royaume de King Candy. */
export function vanellopeInstance(p: PlayerState): CardInstance | undefined {
  return Object.values(p.board)
    .flat()
    .find((c) => c.type === 'hero' && c.cardId === 'vanellope-von-schweetz')
}

/** Un Bug (Glitch) est-il associé à Vanellope von Schweetz ? */
export function bugOnVanellope(p: PlayerState): boolean {
  const v = vanellopeInstance(p)
  if (!v) return false
  return Object.values(p.board)
    .flat()
    .some((c) => c.cardId === 'bug' && c.attachedTo === v.instanceId)
}

/** Index de l'action recouverte par le jeton Pilote (ou null hors course). */
export function racerCoveredActionId(p: PlayerState): string | null {
  if (!p.raceActive || p.racerPos == null) return null
  return p.locations[0]?.actions[norm(p.racerPos)]?.id ?? null
}

/** Lance la course : pose pion King Candy ET jeton Pilote sur Départ/Arrivée. */
export function startRace(state: GameState, idx: number): GameState {
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    trackPos: FINISH_INDEX,
    racerPos: FINISH_INDEX,
    raceActive: true,
  }))
  return {
    ...next,
    log: [
      ...next.log,
      `🏁 La course commence ! ${state.players[idx].villainName} et le jeton Pilote de Vanellope s'élancent depuis Départ/Arrivée.`,
    ],
  }
}

/** Le jeton Pilote a franchi Départ/Arrivée AVANT King Candy → course perdue : tous
 *  les Bugs reviennent en main, la course s'arrête, le jeton reste sur sa case. */
function checkRacerFinish(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  if (!p.raceActive || p.racerPos == null || p.racerPos < TRACK_LEN) return state
  const v = vanellopeInstance(p)
  const bugs: CardInstance[] = []
  let next = updatePlayer(state, idx, (pl) => {
    const board = Object.fromEntries(
      pl.locations.map((l) => [
        l.id,
        (pl.board[l.id] ?? []).filter((c) => {
          if (c.cardId === 'bug' && v && c.attachedTo === v.instanceId) {
            bugs.push({ ...c, attachedTo: undefined })
            return false
          }
          return true
        }),
      ]),
    )
    return {
      ...pl,
      board,
      hand: [...pl.hand, ...bugs],
      raceActive: false,
      racerPos: norm(pl.racerPos!),
    }
  })
  next = {
    ...next,
    log: [
      ...next.log,
      `Le jeton Pilote franchit Départ/Arrivée le premier ! La course s'arrête, ${bugs.length} ${plural(bugs.length, 'Bug')} ${plural(bugs.length, 'revient', 'reviennent')} en main de ${p.villainName}.`,
    ],
  }
  return next
}

/** Avance le jeton Pilote de `amount` cases (puis teste s'il a fini la course). */
export function advanceRacer(state: GameState, idx: number, amount: number): GameState {
  const p = state.players[idx]
  if (!p.raceActive || p.racerPos == null || amount <= 0) return state
  let next = updatePlayer(state, idx, (pl) => ({ ...pl, racerPos: (pl.racerPos ?? 0) + amount }))
  next = {
    ...next,
    log: [...next.log, `Le jeton Pilote de Vanellope avance de ${amount} case(s).`],
  }
  return checkRacerFinish(next, idx)
}

/** Vanellope (début de tour) / « Enfin un vrai Kart ! » : dévoile la 1ʳᵉ carte Méchant,
 *  avance le jeton Pilote de (coût + 2), remet la carte sous la pioche. */
export function advanceRacerByReveal(state: GameState, idx: number, bonus = 2): GameState {
  const p = state.players[idx]
  if (!p.raceActive || p.racerPos == null) return state
  if (p.deck.length === 0) return advanceRacer(state, idx, bonus)
  const top = p.deck[0]
  const amount = (top.cost ?? 0) + bonus
  let next = updatePlayer(state, idx, (pl) => ({ ...pl, deck: [...pl.deck.slice(1), pl.deck[0]] }))
  next = {
    ...next,
    log: [...next.log, `Carte dévoilée : **${top.name}** (coût ${top.cost ?? 0}) → jeton Pilote +${amount}.`],
  }
  return advanceRacer(next, idx, amount)
}

/** Recule le jeton Pilote de `amount` (borné à Départ/Arrivée). */
export function moveRacerBack(state: GameState, idx: number, amount: number): GameState {
  const p = state.players[idx]
  if (!p.raceActive || p.racerPos == null || amount <= 0) return state
  const np = Math.max(FINISH_INDEX, p.racerPos - amount)
  if (np === p.racerPos) return state
  const next = updatePlayer(state, idx, (pl) => ({ ...pl, racerPos: np }))
  return { ...next, log: [...next.log, `Le jeton Pilote recule de ${amount} case(s).`] }
}

/** Déplace le pion King Candy de `steps` cases (signé). Pendant une course, franchir
 *  Départ/Arrivée vers l'avant avec un Bug sur Vanellope = VICTOIRE. */
export function moveKingCandyTrack(state: GameState, idx: number, steps: number): GameState {
  const p = state.players[idx]
  if (steps === 0) return state
  const cur = p.trackPos ?? 0
  const raw = cur + steps
  // Victoire : course active, Bug sur Vanellope, et on franchit (ou atteint) Départ/Arrivée
  // vers l'avant (raw boucle au-delà de la longueur du circuit).
  if (steps > 0 && p.raceActive && raw >= TRACK_LEN && bugOnVanellope(p)) {
    const next = updatePlayer(state, idx, (pl) => ({ ...pl, trackPos: norm(raw) }))
    return {
      ...next,
      status: 'WON',
      winner: idx,
      log: [...next.log, `🏆 ${p.villainName} franchit Départ/Arrivée le premier et remporte la course !`],
    }
  }
  const np = steps > 0 ? norm(raw) : Math.max(FINISH_INDEX, raw) // recul : ne reboucle pas en arrière
  const next = updatePlayer(state, idx, (pl) => ({ ...pl, trackPos: np }))
  return {
    ...next,
    log: [
      ...next.log,
      steps > 0
        ? `${p.villainName} avance de ${steps} ${plural(steps, 'case')} sur le circuit.`
        : `${p.villainName} recule de ${-steps} ${plural(-steps, 'case')} sur le circuit.`,
    ],
  }
}
