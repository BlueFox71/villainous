// =============================================================================
// Rendu du PLATEAU d'un vilain personnalisé, au plus près du gabarit « Realm » :
// fond coloré + texture ardoise + bandeaux sombres en haut des colonnes (zone des
// Héros) + bordures dorées + boîte Objectif, avec les illustrations de lieux et,
// pour chaque action, un MÉDAILLON ovale (double anneau doré, fond ardoise) portant
// une icône dorée. Les médaillons sont aux MÊMES positions que les zones cliquables
// en jeu (cf. boardLayout.ts).
// =============================================================================

import type { CustomVillain } from '../../data/customVillain'
import type { LocationActionType } from '../../engine/types'
import { loadImage } from './imageUtils'
import { BOARD_W, BOARD_H, OBJ_PANEL, COL_RECTS, NAME_Y_PCT, customActionPositions } from './boardLayout'

const DIR = '/editor/board'
const cache = new Map<string, Promise<HTMLImageElement>>()
function asset(name: string): Promise<HTMLImageElement> {
  const src = `${DIR}/${name}`
  let p = cache.get(src)
  if (!p) {
    p = loadImage(src)
    cache.set(src, p)
  }
  return p
}

const FONT = 'Georgia, "Times New Roman", serif'
const GOLD = '#c9a14a'
const INK = '#f4ecd8'

/** Icône d'action authentique (médaillon double-anneau + symbole) exportée du
 *  gabarit Realm. Chaque PNG contient déjà l'anneau ; on le dessine tel quel à la
 *  position de l'action. `GAIN_POWER` est une gemme VIDE : on superpose le chiffre. */
const ACTION_ICONS: Partial<Record<LocationActionType, string>> = {
  GAIN_POWER: 'action-gain-power.png',
  VANQUISH: 'action-vanquish.png',
  PLAY_CARD: 'action-play-card.png',
  FATE: 'action-fate.png',
  MOVE_HERO: 'action-move-hero.png',
  MOVE_ITEM_ALLY: 'action-move-item-ally.png',
  DISCARD_CARDS: 'action-discard-cards.png',
  ACTIVATE: 'action-activate.png',
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const t = line ? `${line} ${w}` : w
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line)
        line = w
      } else line = t
    }
    if (line) lines.push(line)
  }
  return lines
}

/** Médaillon ovale : fond ardoise + double anneau doré (style Realm). */
function drawMedallion(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(26,24,30,0.92)'
  ctx.fill()
  ctx.lineWidth = 11
  ctx.strokeStyle = GOLD
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx - 26, ry - 22, 0, 0, Math.PI * 2)
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.restore()
}

/** Dessine une icône dorée (style line-art) centrée, taille ~`s`. */
function drawIcon(ctx: CanvasRenderingContext2D, type: LocationActionType, cx: number, cy: number, s: number, amount?: number) {
  ctx.save()
  ctx.strokeStyle = GOLD
  ctx.fillStyle = GOLD
  ctx.lineWidth = 13
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const h = s / 2
  switch (type) {
    case 'GAIN_POWER': {
      // Gemme octogonale + nombre.
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
      ctx.font = `bold ${s * 0.8}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(amount ?? 1), cx, cy + s * 0.04)
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
      roundRect(ctx, cx - cw / 2, cy - ch / 2 + s * 0.08, cw, ch, 14)
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
      roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 12)
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

/** Rend le plateau complet d'un vilain personnalisé en dataURL PNG. */
export async function renderBoard(v: CustomVillain): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD_W
  canvas.height = BOARD_H
  const ctx = canvas.getContext('2d')!

  // 1) Couleur de fond.
  ctx.fillStyle = v.color
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  // 2) Texture ardoise (multiply).
  try {
    const tex = await asset('realm-texture.png')
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(tex, 0, 0, BOARD_W, BOARD_H)
    ctx.globalCompositeOperation = 'source-over'
  } catch { /* sans texture */ }

  // 3) Illustrations de lieux (par colonne).
  for (let i = 0; i < v.locations.length && i < COL_RECTS.length; i++) {
    const loc = v.locations[i]
    const r = COL_RECTS[i]
    if (loc.image) {
      try {
        drawCover(ctx, await loadImage(loc.image), r.x0, 0, r.x1 - r.x0, BOARD_H)
      } catch { /* illisible */ }
    }
    const grad = ctx.createLinearGradient(0, BOARD_H * 0.74, 0, BOARD_H)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.78)')
    ctx.fillStyle = grad
    ctx.fillRect(r.x0, BOARD_H * 0.74, r.x1 - r.x0, BOARD_H * 0.26)
  }

  // 4) Bandeaux sombres en haut des colonnes (zone des Héros / rangée du haut).
  try {
    const hd = await asset('realm-herodark.png')
    ctx.globalAlpha = 0.34
    ctx.drawImage(hd, 0, 0, BOARD_W, BOARD_H)
    ctx.globalAlpha = 1
  } catch { /* sans bandeaux */ }

  // 5) Bordures dorées.
  try {
    ctx.drawImage(await asset('realm-borders.png'), 0, 0, BOARD_W, BOARD_H)
  } catch { /* sans bordures */ }

  // 6) Panneau Objectif (gauche).
  const pw = OBJ_PANEL.x1 - OBJ_PANEL.x0
  ctx.fillStyle = 'rgba(0,0,0,0.30)'
  ctx.fillRect(OBJ_PANEL.x0, 0, pw, BOARD_H)
  const villainArt = v.presentation ?? v.portrait
  if (villainArt) {
    try {
      drawCover(ctx, await loadImage(villainArt), OBJ_PANEL.x0 + 30, 110, pw - 60, 600)
    } catch { /* sans illustration */ }
  }
  try {
    ctx.drawImage(await asset('realm-objective.png'), 0, 0, BOARD_W, BOARD_H)
  } catch { /* sans cadre */ }
  const cx = (OBJ_PANEL.x0 + OBJ_PANEL.x1) / 2
  ctx.fillStyle = '#e8c879'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  {
    let s = 58
    ctx.font = `bold ${s}px ${FONT}`
    while (ctx.measureText(v.name.toUpperCase()).width > pw - 60 && s > 26) {
      s -= 2
      ctx.font = `bold ${s}px ${FONT}`
    }
    ctx.fillText(v.name.toUpperCase(), cx, 56)
  }
  ctx.fillStyle = '#e8c879'
  ctx.font = `600 40px ${FONT}`
  ctx.fillText('OBJECTIF', cx, 872)
  if (v.boardObjective.trim()) {
    ctx.fillStyle = INK
    ctx.textBaseline = 'top'
    let s = 34
    ctx.font = `${s}px ${FONT}`
    let lines = wrap(ctx, v.boardObjective.trim(), pw - 90)
    while (lines.length * (s + 8) > 280 && s > 20) {
      s -= 2
      ctx.font = `${s}px ${FONT}`
      lines = wrap(ctx, v.boardObjective.trim(), pw - 90)
    }
    let y = 940
    for (const line of lines) {
      ctx.fillText(line, cx, y)
      y += s + 8
    }
  }

  // 7) Noms de lieux.
  ctx.textBaseline = 'middle'
  for (let i = 0; i < v.locations.length && i < COL_RECTS.length; i++) {
    const loc = v.locations[i]
    const r = COL_RECTS[i]
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 14
    let s = 54
    ctx.font = `bold ${s}px ${FONT}`
    while (ctx.measureText(loc.name).width > r.x1 - r.x0 - 40 && s > 22) {
      s -= 2
      ctx.font = `bold ${s}px ${FONT}`
    }
    ctx.fillText(loc.name, (r.x0 + r.x1) / 2, BOARD_H * (NAME_Y_PCT / 100))
    ctx.shadowBlur = 0
  }

  // 8) Médaillons d'action aux positions canoniques. On privilégie l'icône
  //    AUTHENTIQUE du gabarit (PNG, anneau inclus) ; à défaut, fallback vectoriel.
  const pos = customActionPositions(v.locations)
  const RX = 178
  const RY = 150
  const ICON = 320 // taille de dessin de l'icône PNG (carrée), en px
  for (const loc of v.locations) {
    for (const a of loc.actions) {
      const p = pos[loc.id]?.[a.id]
      if (!p) continue
      const px = (p.x / 100) * BOARD_W
      const py = (p.y / 100) * BOARD_H
      const file = ACTION_ICONS[a.type]
      let drawn = false
      if (file) {
        try {
          ctx.drawImage(await asset(file), px - ICON / 2, py - ICON / 2, ICON, ICON)
          drawn = true
        } catch { /* image illisible → fallback vectoriel */ }
      }
      if (!drawn) {
        drawMedallion(ctx, px, py, RX, RY)
        drawIcon(ctx, a.type, px, py, 124, a.amount)
      }
      // Gemme « Gagner du pouvoir » : le PNG est vide, on imprime le chiffre.
      if (drawn && a.type === 'GAIN_POWER') {
        ctx.save()
        ctx.fillStyle = GOLD
        ctx.font = `bold 118px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(a.amount ?? 1), px, py + 6)
        ctx.restore()
      }
    }
  }

  return canvas.toDataURL('image/png')
}
