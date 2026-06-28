// =============================================================================
// Géométrie PARTAGÉE du plateau « Realm » (template neutre du générateur).
//
// Tous les plateaux Villainous partagent la même disposition : un panneau Objectif
// à gauche, puis 4 colonnes de lieux, chacune avec une rangée d'actions en HAUT
// (zone Héros, bandeau sombre) et une en BAS (sur l'illustration du lieu).
//
// Les coordonnées ci-dessous sont calées sur le gabarit GIMP de référence
// (cf. assets/editor/export plateau/ : Location Images.png + positions.csv) :
//   - canevas 4452 × 1248 px ;
//   - 4 boîtes de colonne dont les bordures dorées (realm-borders.png) sont
//     alignées EXACTEMENT sur ces rectangles ;
//   - médaillons d'action aux centres relevés dans positions.csv.
// Les positions sont exprimées en % de l'image — ainsi le rendu du plateau ET les
// pastilles cliquables en jeu utilisent les MÊMES coordonnées (cf. customActionPos).
// =============================================================================

import type { ActionRow } from '../../engine/types'

/** Dimensions natives du gabarit Realm (px) — celles des calques d'overlay
 *  (realm-borders / realm-herodark / realm-objective / realm-texture). */
export const BOARD_W = 4455
export const BOARD_H = 1248

/** Panneau Objectif (gauche), en px. La 1re colonne commence à x=730. */
export const OBJ_PANEL = { x0: 0, x1: 687 }

/** Rectangles des 4 colonnes de lieux (px) — bornes INTÉRIEURES des bordures
 *  dorées du gabarit (relevées sur realm-borders.png). */
export const COL_RECTS = [
  { x0: 730, x1: 1629 },
  { x0: 1660, x1: 2559 },
  { x0: 2590, x1: 3489 },
  { x0: 3520, x1: 4419 },
]

/** Boîte de l'illustration de lieu (y, px) : INTÉRIEUR du cadre doré de la colonne
 *  (relevé sur realm-borders.png : bord haut ≈101, bord bas ≈985). */
export const LOC_IMG = { y0: 104, y1: 982 }

/** Bandeau sombre « zone Héros » en haut de chaque colonne (y, px). */
export const HERO_BAND = { y0: 107, y1: 420 }

/** Centre horizontal de chaque colonne (% largeur) — relevé sur realm-borders.png. */
const COL_CENTER_PCT = [26.48, 47.35, 68.23, 89.10]

/** Écart horizontal entre deux médaillons voisins d'une rangée (% largeur). */
const ACTION_PITCH_PCT = 6.7

/** Y des rangées d'action, en % de la hauteur (centres relevés sur le gabarit). */
export const ROW_Y: Record<ActionRow, number> = { top: 19.6, bottom: 67.7 }

/** Y du nom de lieu (% hauteur). */
export const NAME_Y_PCT = 85

export interface XY {
  x: number
  y: number
}

/** Répartit `n` actions autour du centre d'une colonne, à pas constant (% largeur). */
function spreadX(centerPct: number, n: number): number[] {
  if (n <= 1) return [centerPct]
  const span = (n - 1) * ACTION_PITCH_PCT
  return Array.from({ length: n }, (_, i) => centerPct - span / 2 + i * ACTION_PITCH_PCT)
}

/** Centre horizontal d'une colonne par index (% largeur). Au-delà de 4 lieux, réparti. */
function colCenterFor(index: number, total: number): number {
  if (total <= COL_CENTER_PCT.length && index < COL_CENTER_PCT.length) return COL_CENTER_PCT[index]
  // Repli : colonnes réparties entre 22 % et 93 %.
  return 22 + ((93 - 22) * index) / Math.max(1, total - 1)
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
    const center = colCenterFor(i, locations.length)
    const map: Record<string, XY> = {}
    for (const row of ['top', 'bottom'] as ActionRow[]) {
      const inRow = loc.actions.filter((a) => a.row === row)
      const xs = spreadX(center, inRow.length)
      inRow.forEach((a, j) => {
        map[a.id] = { x: xs[j], y: ROW_Y[row] }
      })
    }
    out[loc.id] = map
  })
  return out
}
