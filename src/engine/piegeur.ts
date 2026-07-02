// =============================================================================
// Le Piégeur (Dead by Daylight) — helpers PURS partagés par effects.ts / actions.ts.
// Les Survivants sont des cartes de type 'hero' (isSurvivor) posées FACE CACHÉE au setup.
// Santé (segments : sain→blessé→critique) et vies (crochet) sont deux jauges distinctes.
// =============================================================================

import type { GameState, PlayerState, CardInstance, LocationId } from './types'

/** cardId de « PERSONNE N'ÉCHAPPE À LA MORT » (Objet global : FORCE BRUTE → direct critique). */
export const PIEGEUR_PERSONNE_ID = 'custom-le-piegeur-personne-n-echappe-a-la-mort'
/** cardId du « PIÈGE À OURS » (Objet posé sur un lieu ; réutilisable). */
export const PIEGEUR_BEAR_TRAP_ID = 'custom-le-piegeur-piege-a-ours'
/** cardId de la « PALETTE » (Objet Fatalité : bloque un lieu au Piégeur ; 2 Pouvoir pour la défausser). */
export const PIEGEUR_PALETTE_ID = 'custom-le-piegeur-palette'

/** Lieux BLOQUÉS au pion du Piégeur par une Palette (Objet non associé présent). */
export function paletteBlockedLocations(p: PlayerState): Set<LocationId> {
  const set = new Set<LocationId>()
  for (const [loc, cards] of Object.entries(p.board)) {
    if (cards.some((c) => c.cardId === PIEGEUR_PALETTE_ID && !c.attachedTo)) set.add(loc)
  }
  return set
}

/** Ce joueur est-il le Piégeur ? */
export function isPiegeur(p: PlayerState): boolean {
  return p.objective.type === 'PIEGEUR_ELIMINATE_ALL_SURVIVORS'
}

/** PERSONNE N'ÉCHAPPE À LA MORT est-elle en jeu (posée sur un lieu) ? */
export function personnePresent(p: PlayerState): boolean {
  return Object.values(p.board).flat().some((c) => c.cardId === PIEGEUR_PERSONNE_ID && !c.attachedTo)
}

/** Tous les Survivants du joueur, tous lieux confondus. */
export function allSurvivors(p: PlayerState): CardInstance[] {
  return Object.values(p.board).flat().filter((c) => c.isSurvivor)
}

/** Plus aucun Survivant (ni sur le plateau, ni en pile) → victoire du Piégeur. */
export function noSurvivorsLeft(p: PlayerState): boolean {
  return allSurvivors(p).length === 0 && (p.survivorPile ?? []).length === 0
}

/** Lieu où se trouve une carte (par instanceId), ou undefined. */
export function locationOfInstance(p: PlayerState, id: string): LocationId | undefined {
  for (const [loc, cards] of Object.entries(p.board)) if (cards.some((c) => c.instanceId === id)) return loc
  return undefined
}

/** Lieux VOISINS (index ±1 dans l'ordre du plateau). */
export function piegeurNeighbors(p: PlayerState, loc: LocationId): LocationId[] {
  const order = p.locations.map((l) => l.id)
  const i = order.indexOf(loc)
  if (i < 0) return []
  return [order[i - 1], order[i + 1]].filter((x): x is LocationId => !!x)
}

/** Lieu le plus LOIN du pion (Meg à la révélation ; départage : le plus à droite). */
export function farthestLocationFromPawn(p: PlayerState): LocationId | undefined {
  const order = p.locations.map((l) => l.id)
  if (order.length === 0) return undefined
  const pawnI = order.indexOf(p.pawnLocation ?? '')
  if (pawnI < 0) return order[order.length - 1]
  let best = order[0]
  let bestD = -1
  order.forEach((id, i) => {
    const d = Math.abs(i - pawnI)
    if (d >= bestD) {
      bestD = d
      best = id
    }
  })
  return best
}

/** État de santé suivant après une blessure. `direct` (PERSONNE N'ÉCHAPPE) → critique direct. */
export function nextHealth(state: CardInstance['survivorState'], direct: boolean): 'injured' | 'critical' {
  if (direct) return 'critical'
  return state === 'healthy' || state === undefined ? 'injured' : 'critical'
}

/** Un PIÈGE À OURS (Objet, non associé) est-il présent sur ce lieu ? */
export function bearTrapAt(p: PlayerState, loc: LocationId): boolean {
  return (p.board[loc] ?? []).some((c) => c.cardId === PIEGEUR_BEAR_TRAP_ID && !c.attachedTo)
}

/**
 * Déplace un Survivant vers `toLoc`. Si le lieu d'arrivée porte un PIÈGE À OURS, le
 * Survivant perd un segment de santé (générique, non affecté par PERSONNE) et est
 * immobilisé 1 tour (saute la prochaine fuite). Le piège RESTE (réutilisable). Pur.
 */
export function moveSurvivorWithTrap(
  state: GameState,
  playerIndex: number,
  survivorId: string,
  toLoc: LocationId,
): GameState {
  const p = state.players[playerIndex]
  const from = locationOfInstance(p, survivorId)
  if (!from || from === toLoc) return state
  const card = (p.board[from] ?? []).find((c) => c.instanceId === survivorId)
  if (!card) return state
  const locName = (id: string) => p.locations.find((l) => l.id === id)?.name ?? id
  const logs = [`**${card.name}** est déplacé vers ${locName(toLoc)}.`]
  let moved: CardInstance = card
  if (bearTrapAt(p, toLoc)) {
    const ns = nextHealth(card.survivorState, false)
    moved = { ...card, survivorState: ns, trapImmobilizedTurns: 1 }
    logs.push(`🪤 **${card.name}** déclenche un Piège à ours sur ${locName(toLoc)} (${ns}, immobilisé 1 tour).`)
  }
  const board = {
    ...p.board,
    [from]: (p.board[from] ?? []).filter((c) => c.instanceId !== survivorId),
    [toLoc]: [...(p.board[toLoc] ?? []), moved],
  }
  const players = state.players.map((pl, i) => (i === playerIndex ? { ...pl, board } : pl))
  return { ...state, players, log: [...state.log, ...logs] }
}
