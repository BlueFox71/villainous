// =============================================================================
// Géométrie PARTAGÉE du plateau « Realm » (template neutre du générateur).
//
// Tous les plateaux Villainous partagent la même disposition : un panneau Objectif
// à gauche, puis 4 colonnes de lieux, chacune avec une rangée d'actions en HAUT et
// une en BAS (2 actions par rangée). Les positions sont exprimées en % de l'image
// (cf. ACTION_POS dans BoardActions) — ainsi le rendu du plateau ET les pastilles
// cliquables en jeu utilisent EXACTEMENT les mêmes coordonnées.
// =============================================================================

import type { ActionRow } from '../../engine/types'

/** Dimensions natives du template Realm. */
export const BOARD_W = 4455
export const BOARD_H = 1248

/** Panneau Objectif (gauche), en px. */
export const OBJ_PANEL = { x0: 8, x1: 700 }

/** Rectangles des 4 colonnes de lieux (px) — fond/illustration de chaque lieu. */
export const COL_RECTS = [
  { x0: 728, x1: 1632 },
  { x0: 1658, x1: 2562 },
  { x0: 2590, x1: 3490 },
  { x0: 3519, x1: 4418 },
]

/** Couples X (gauche/droite) des actions par colonne, en % de la largeur. */
const COL_X: [number, number][] = [
  [22.5, 30.4],
  [43.4, 51.3],
  [64.2, 72.1],
  [85.0, 92.9],
]

/** Y des rangées d'action, en % de la hauteur. */
export const ROW_Y: Record<ActionRow, number> = { top: 20, bottom: 67.3 }

/** Y du nom de lieu (% hauteur). */
export const NAME_Y_PCT = 85

export interface XY {
  x: number
  y: number
}

/** Répartit `n` actions entre les deux X canoniques d'une colonne (% largeur). */
function spreadX([l, r]: [number, number], n: number): number[] {
  if (n <= 1) return [(l + r) / 2]
  if (n === 2) return [l, r]
  return Array.from({ length: n }, (_, i) => l + ((r - l) * i) / (n - 1))
}

/** Couple X d'une colonne par index ; au-delà de 4 lieux, réparti uniformément. */
function colXFor(index: number, total: number): [number, number] {
  if (total <= COL_X.length && index < COL_X.length) return COL_X[index]
  // Repli : colonnes réparties entre 18 % et 99 %.
  const span = (99 - 18) / total
  const center = 18 + span * (index + 0.5)
  return [center - span * 0.22, center + span * 0.22]
}

/**
 * Positions (% image) de chaque action, par lieu → id d'action. Utilisé pour
 * imprimer les icônes ET enregistrer ACTION_POS (pastilles cliquables alignées).
 */
export function customActionPositions(
  locations: { id: string; actions: { id: string; row: ActionRow }[] }[],
): Record<string, Record<string, XY>> {
  const out: Record<string, Record<string, XY>> = {}
  locations.forEach((loc, i) => {
    const pair = colXFor(i, locations.length)
    const map: Record<string, XY> = {}
    for (const row of ['top', 'bottom'] as ActionRow[]) {
      const inRow = loc.actions.filter((a) => a.row === row)
      const xs = spreadX(pair, inRow.length)
      inRow.forEach((a, j) => {
        map[a.id] = { x: xs[j], y: ROW_Y[row] }
      })
    }
    out[loc.id] = map
  })
  return out
}
