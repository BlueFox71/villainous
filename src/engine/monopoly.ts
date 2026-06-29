// =============================================================================
// Mr. Monopoly (vilain CUSTOM `custom-mr-monopoly`) — mécanique des MAISONS / LOYER.
//
// Mr. Monopoly pose des MAISONS sur les lieux du royaume ADVERSE. Quand le pion
// adverse arrive sur un lieu maisonné, Mr. Monopoly encaisse un LOYER = coût total
// des maisons de ce lieu (à chaque arrivée). Objectif : ≥ 30 Pouvoir au début du tour.
//
// Le moteur reste PUR : ces helpers ne lisent que l'état. Les maisons sont stockées
// sur l'état de Mr. Monopoly (`houses`), indexées par l'id du lieu adverse (en partie
// à 2 joueurs, le royaume adverse est sans ambiguïté).
// =============================================================================

import type { GameState, PlayerState, LocationId } from './types'

export const CUSTOM_MONOPOLY_ID = 'custom-mr-monopoly'
/** 4 maisons sur un même lieu = un HÔTEL (et plafond : on ne pose pas au-delà). */
export const HOTEL_THRESHOLD = 4

/** Index de l'adversaire de `idx` (partie à 2 joueurs). Le paramètre `_state` n'est pas
 *  utilisé (2 joueurs) mais conservé pour l'homogénéité des appels et une extension future. */
export function opponentIndex(_state: GameState, idx: number): number {
  return idx === 0 ? 1 : 0
}

/** Vrai si `p` est Mr. Monopoly. */
export function isMonopoly(p: PlayerState): boolean {
  return p.villain === CUSTOM_MONOPOLY_ID
}

/** Nombre de maisons posées par Mr. Monopoly sur le lieu adverse `locId`. */
export function houseCount(mm: PlayerState, locId: LocationId): number {
  return mm.houses?.[locId] ?? 0
}

/** Nombre total de maisons posées (tous lieux adverses confondus). */
export function totalHouses(mm: PlayerState): number {
  return Object.values(mm.houses ?? {}).reduce((n, v) => n + v, 0)
}

/** Un lieu est un HÔTEL dès `HOTEL_THRESHOLD` maisons. */
export function isHotel(count: number): boolean {
  return count >= HOTEL_THRESHOLD
}

/** Coût STANDARD d'une maison sur le lieu `locId` du royaume `opp` : 2 sur le repaire
 *  (lieu le plus à gauche = `locations[0]`, où démarre le pion), 1 ailleurs. C'est aussi
 *  la base du LOYER (le loyer ne dépend pas des remises d'achat type L'Ombre). */
export function baseHouseCost(opp: PlayerState, locId: LocationId): number {
  return opp.locations[0]?.id === locId ? 2 : 1
}

/** Vrai si Mr. Monopoly et L'Ombre de Monopoly partagent le lieu du pion (remise −1
 *  sur l'ACHAT d'une maison, jamais sur le loyer). */
export function shadowDiscount(mm: PlayerState): number {
  const loc = mm.pawnLocation
  if (!loc) return 0
  const here = mm.board[loc] ?? []
  return here.some((c) => c.shadowReducesHouseCost) ? 1 : 0
}

/** Coût d'ACHAT d'une maison sur `locId` (coût standard − remise L'Ombre, plancher 0). */
export function buyHouseCost(mm: PlayerState, opp: PlayerState, locId: LocationId): number {
  return Math.max(0, baseHouseCost(opp, locId) - shadowDiscount(mm))
}

/** Vrai si Mr. Monopoly ne peut PAS poser de nouvelle maison du tout (Haut de forme). */
export function housePlacementBlocked(mm: PlayerState): boolean {
  return Object.values(mm.board)
    .flat()
    .some((c) => c.blocksHousePlacement)
}

/** Vrai si Mr. Monopoly ne peut pas poser de maison sur le lieu adverse `locId`
 *  (Chaussure : bloque un lieu choisi, mémorisé sur l'instance du Héros). */
export function locationHouseBlocked(mm: PlayerState, locId: LocationId): boolean {
  return Object.values(mm.board)
    .flat()
    .some((c) => c.blockedHouseLocationId === locId)
}

/** Combien de maisons Mr. Monopoly peut encore poser sur `locId` (plafond hôtel,
 *  blocages Haut de forme / Chaussure). */
export function placeableHouses(mm: PlayerState, locId: LocationId): number {
  if (housePlacementBlocked(mm) || locationHouseBlocked(mm, locId)) return 0
  return Math.max(0, HOTEL_THRESHOLD - houseCount(mm, locId))
}

/** Vrai si le royaume de Mr. Monopoly contient un Héros qui BLOQUE les loyers
 *  (Fer à repasser). */
export function rentBlocked(mm: PlayerState): boolean {
  return Object.values(mm.board)
    .flat()
    .some((c) => c.blocksRent)
}

/** Loyer encaissé quand le pion adverse arrive sur son lieu `locId` : Σ coût standard
 *  des maisons de ce lieu. 0 si bloqué (Fer à repasser) ou aucune maison. */
export function rentAt(mm: PlayerState, opp: PlayerState, locId: LocationId): number {
  if (rentBlocked(mm)) return 0
  return houseCount(mm, locId) * baseHouseCost(opp, locId)
}
