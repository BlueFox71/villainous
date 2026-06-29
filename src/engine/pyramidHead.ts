// =============================================================================
// Pyramid Head (Silent Hill) — mécanique des TUILES DE JUGEMENT.
//
// Les tuiles occupent les lieux les plus à DROITE (depuis Silent Hill) vers la gauche,
// de façon CONTIGUË : `player.judgmentTiles` (0..N) = nombre de lieux tuilés = les N
// derniers de `player.locations`. Une tuile recouvre les actions du HAUT de son lieu
// (comme un Héros). Objectif : tous les lieux tuilés au début du tour.
//
// - Rites de Jugement (Objet) pose la 1ʳᵉ tuile (Silent Hill, le plus à droite).
// - Propager la souffrance étend d'un cran VERS LA GAUCHE (−1 souffrance).
// - Dissipation (Fatalité) retire la tuile la plus à GAUCHE.
// =============================================================================

import type { PlayerState, LocationId } from './types'

/** Ids des lieux TUILÉS (les `judgmentTiles` derniers de la liste). */
export function tiledLocationIds(p: PlayerState): LocationId[] {
  const n = p.judgmentTiles ?? 0
  if (n <= 0) return []
  return p.locations.slice(Math.max(0, p.locations.length - n)).map((l) => l.id)
}

/** Le lieu `locId` porte-t-il une tuile de Jugement ? */
export function locationHasJudgmentTile(p: PlayerState, locId: LocationId): boolean {
  const n = p.judgmentTiles ?? 0
  if (n <= 0) return false
  const idx = p.locations.findIndex((l) => l.id === locId)
  return idx >= 0 && idx >= p.locations.length - n
}

/** Lieu qui recevrait la PROCHAINE tuile (immédiatement à gauche du bloc), ou `null`
 *  s'il n'y a pas encore de tuile ou si tous les lieux sont déjà tuilés. */
export function nextTileLocationId(p: PlayerState): LocationId | null {
  const n = p.judgmentTiles ?? 0
  if (n <= 0 || n >= p.locations.length) return null
  return p.locations[p.locations.length - n - 1]?.id ?? null
}

/** Maria (Héros Fatalité) bloque la propagation sur SON lieu : vrai si un Héros marqué
 *  `blocksJudgmentTile` se trouve sur `locId`. */
export function judgmentBlockedAt(p: PlayerState, locId: LocationId): boolean {
  return (p.board[locId] ?? []).some((c) => c.type === 'hero' && c.blocksJudgmentTile)
}
