// =============================================================================
// Symboles d'ACTION (style line-art doré) partagés par le rendu du plateau et des
// cartes. Sur une carte, ils s'insèrent dans le texte via des JETONS (ex.
// « [activer], payez 1 [pouvoir] : … ») que `cardRender` remplace par le symbole.
// =============================================================================

import type { LocationActionType } from '../../engine/types'
import { EDITOR_FONT } from './fonts'

const GOLD = '#c9a14a'

/** Jeton texte (kebab-case ASCII) → type d'action, insérable dans le texte d'une
 *  carte. Plusieurs alias pointent vers la même action pour être tolérant. */
export const ACTION_TOKENS: Record<string, LocationActionType> = {
  activer: 'ACTIVATE',
  pouvoir: 'GAIN_POWER',
  vaincre: 'VANQUISH',
  jouer: 'PLAY_CARD',
  'jouer-carte': 'PLAY_CARD',
  fatalite: 'FATE',
  'deplacer-hero': 'MOVE_HERO',
  'deplacer-heros': 'MOVE_HERO',
  deplacer: 'MOVE_ITEM_ALLY',
  'deplacer-allie': 'MOVE_ITEM_ALLY',
  'deplacer-objet': 'MOVE_ITEM_ALLY',
  defausser: 'DISCARD_CARDS',
}

/** Dossier des médaillons d'action AUTHENTIQUES (PNG du gabarit Realm). */
export const BOARD_ICON_DIR = '/editor/board'

/** Médaillon d'action authentique (PNG, anneau doré inclus) par type d'action.
 *  `GAIN_POWER` est une gemme VIDE (le nombre est imprimé par-dessus côté plateau ;
 *  inline sur une carte, le coût s'écrit en toutes lettres à côté). */
export const ACTION_ICON_FILE: Partial<Record<LocationActionType, string>> = {
  GAIN_POWER: 'action-gain-power.png',
  VANQUISH: 'action-vanquish.png',
  PLAY_CARD: 'action-play-card.png',
  FATE: 'action-fate.png',
  MOVE_HERO: 'action-move-hero.png',
  MOVE_ITEM_ALLY: 'action-move-item-ally.png',
  DISCARD_CARDS: 'action-discard-cards.png',
  ACTIVATE: 'action-activate.png',
}

/** Liste canonique pour la barre d'insertion de l'éditeur (jeton + libellé FR). */
export const ACTION_TOKEN_LIST: { token: string; type: LocationActionType; label: string }[] = [
  { token: 'activer', type: 'ACTIVATE', label: 'Activer' },
  { token: 'pouvoir', type: 'GAIN_POWER', label: 'Pouvoir' },
  { token: 'jouer', type: 'PLAY_CARD', label: 'Jouer une carte' },
  { token: 'vaincre', type: 'VANQUISH', label: 'Vaincre' },
  { token: 'deplacer-hero', type: 'MOVE_HERO', label: 'Déplacer un Héros' },
  { token: 'deplacer', type: 'MOVE_ITEM_ALLY', label: 'Déplacer Objet/Allié' },
  { token: 'fatalite', type: 'FATE', label: 'Fatalité' },
  { token: 'defausser', type: 'DISCARD_CARDS', label: 'Défausser' },
]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, head: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - 0.5), y2 - head * Math.sin(ang - 0.5))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang + 0.5), y2 - head * Math.sin(ang + 0.5))
  ctx.stroke()
}

/**
 * Dessine une icône d'action dorée (line-art) centrée en (cx,cy), taille ~`s`.
 * L'épaisseur du trait est proportionnelle à `s` (utilisable du plateau ~84px aux
 * jetons inline ~50px). Pour `GAIN_POWER`, `amount` imprime le nombre dans la
 * gemme ; laissé indéfini (jeton inline), la gemme reste vide (le coût s'écrit
 * alors en toutes lettres à côté).
 */
export function drawActionIcon(
  ctx: CanvasRenderingContext2D,
  type: LocationActionType,
  cx: number,
  cy: number,
  s: number,
  color: string = GOLD,
  amount?: number,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.5, s * 0.13)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const h = s / 2
  switch (type) {
    case 'GAIN_POWER': {
      // Gemme octogonale (+ nombre optionnel).
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i + Math.PI / 8
        const px = cx + Math.cos(a) * h
        const py = cy + Math.sin(a) * h
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      if (amount !== undefined) {
        ctx.font = `bold ${s * 0.8}px ${EDITOR_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(amount), cx, cy + s * 0.04)
      }
      break
    }
    case 'VANQUISH': {
      // Étoile-explosion à 8 branches.
      ctx.beginPath()
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI / 8) * i
        const rr = i % 2 === 0 ? h : h * 0.45
        const px = cx + Math.cos(a) * rr
        const py = cy + Math.sin(a) * rr
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'PLAY_CARD': {
      // Carte (rectangle arrondi) + chevron vers le haut.
      const cw = s * 0.62
      const ch = s * 0.82
      roundRect(ctx, cx - cw / 2, cy - ch / 2 + s * 0.08, cw, ch, s * 0.07)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.18, cy - ch / 2 - s * 0.04)
      ctx.lineTo(cx, cy - ch / 2 - s * 0.24)
      ctx.lineTo(cx + s * 0.18, cy - ch / 2 - s * 0.04)
      ctx.stroke()
      break
    }
    case 'FATE': {
      // Croissant / lune renversée (Fatalité).
      ctx.beginPath()
      ctx.arc(cx, cy, h, Math.PI * 0.15, Math.PI * 0.85, false)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy - s * 0.18, h * 0.95, Math.PI * 0.2, Math.PI * 0.8, false)
      ctx.stroke()
      break
    }
    case 'MOVE_HERO': {
      arrow(ctx, cx - h * 0.7, cy, cx + h * 0.8, cy, s * 0.3)
      break
    }
    case 'MOVE_ITEM_ALLY': {
      // Double flèche horizontale.
      arrow(ctx, cx, cy, cx + h * 0.9, cy, s * 0.26)
      arrow(ctx, cx, cy, cx - h * 0.9, cy, s * 0.26)
      break
    }
    case 'DISCARD_CARDS': {
      const cw = s * 0.6
      const ch = s * 0.8
      roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, s * 0.06)
      ctx.stroke()
      arrow(ctx, cx, cy - ch * 0.1, cx, cy + ch * 0.55, s * 0.26)
      break
    }
    case 'ACTIVATE': {
      // Soleil : disque + rayons.
      ctx.beginPath()
      ctx.arc(cx, cy, h * 0.45, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * h * 0.62, cy + Math.sin(a) * h * 0.62)
        ctx.lineTo(cx + Math.cos(a) * h, cy + Math.sin(a) * h)
        ctx.stroke()
      }
      break
    }
    default: {
      ctx.beginPath()
      ctx.arc(cx, cy, h * 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}
