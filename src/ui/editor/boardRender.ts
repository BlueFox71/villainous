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
import { EDITOR_FONT, ensureFonts } from './fonts'
import { BOARD_W, BOARD_H, OBJ_PANEL, COL_RECTS, LOC_IMG, NAME_Y_PCT, customActionPositions } from './boardLayout'

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

// Police « Esteban » du gabarit, utilisée pour TOUTE la typographie du plateau
// (nom du vilain, objectif, noms de lieux). Repli serif si elle ne charge pas.
const FONT = EDITOR_FONT
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

/** Dessine `img` en « cover » dans (x,y,w,h). `posX`/`posY` (0..1) choisissent la
 *  partie visible quand l'image déborde (0 = bord gauche/haut, 0.5 = centre, 1 =
 *  bord droit/bas), à la manière de CSS object-position. `zoom` (≥1) agrandit. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0,
  posX = 0.5,
  posY = 0.5,
  zoom = 1,
) {
  const scale = Math.max(w / img.width, h / img.height) * zoom
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.save()
  if (radius > 0) roundRect(ctx, x, y, w, h, radius)
  else { ctx.beginPath(); ctx.rect(x, y, w, h) }
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) * posX, y + (h - dh) * posY, dw, dh)
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

/** Disque de fond (gabarit « Fill #4 ») teinté à la COULEUR DU VILAIN (légèrement
 *  assombrie pour garder l'icône dorée lisible), prêt à composer sous les anneaux
 *  d'action. Renvoie null si l'image est illisible. */
let discCache: { size: number; color: string; canvas: HTMLCanvasElement } | null = null
async function tintedDisc(
  asset: (name: string) => Promise<HTMLImageElement>,
  size: number,
  color: string,
): Promise<HTMLCanvasElement | null> {
  const px = Math.round(size)
  if (discCache && discCache.size === px && discCache.color === color) return discCache.canvas
  try {
    const fill = await asset('action-fill.png')
    const oc = document.createElement('canvas')
    oc.width = px
    oc.height = px
    const octx = oc.getContext('2d')!
    octx.drawImage(fill, 0, 0, px, px)
    octx.globalCompositeOperation = 'source-in' // ne garde que la forme du disque
    octx.fillStyle = color
    octx.fillRect(0, 0, px, px)
    octx.globalCompositeOperation = 'source-atop' // assombrit la couleur du vilain
    octx.fillStyle = 'rgba(0,0,0,0.34)'
    octx.fillRect(0, 0, px, px)
    discCache = { size: px, color, canvas: oc }
    return oc
  } catch {
    return null
  }
}

/** Règle `ctx.font` (police Esteban) à la plus grande taille ≤ `start` (et ≥ `min`)
 *  telle que `text` tienne dans `maxW`. Renvoie la taille retenue. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  start: number,
  min: number,
  weight = '',
): number {
  let s = start
  ctx.font = `${weight}${s}px ${FONT}`
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 2
    ctx.font = `${weight}${s}px ${FONT}`
  }
  return s
}

/** Médaillon ovale : fond ardoise + double anneau doré (style Realm). */
function drawMedallion(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(26,24,30,0.92)'
  ctx.fill()
  ctx.lineWidth = Math.max(4, rx * 0.062)
  ctx.strokeStyle = GOLD
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx - rx * 0.15, ry - ry * 0.15, 0, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(2, rx * 0.028)
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
  await ensureFonts()
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

  // 3) Illustrations de lieux : confinées à la BOÎTE de la colonne (sous le bord
  //    haut, au-dessus du nom), coins arrondis pour épouser la bordure dorée.
  const imgH = LOC_IMG.y1 - LOC_IMG.y0
  for (let i = 0; i < v.locations.length && i < COL_RECTS.length; i++) {
    const loc = v.locations[i]
    const r = COL_RECTS[i]
    if (loc.image) {
      try {
        const px = (loc.imagePos?.x ?? 50) / 100
        const py = (loc.imagePos?.y ?? 50) / 100
        const z = loc.imagePos?.zoom ?? 1
        drawCover(ctx, await loadImage(loc.image), r.x0, LOC_IMG.y0, r.x1 - r.x0, imgH, 36, px, py, z)
      } catch { /* illisible */ }
    }
    // Léger assombrissement en bas de l'illustration (lisibilité du nom).
    const grad = ctx.createLinearGradient(0, LOC_IMG.y1 - imgH * 0.28, 0, LOC_IMG.y1)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.72)')
    ctx.save()
    roundRect(ctx, r.x0, LOC_IMG.y0, r.x1 - r.x0, imgH, 36)
    ctx.clip()
    ctx.fillStyle = grad
    ctx.fillRect(r.x0, LOC_IMG.y1 - imgH * 0.28, r.x1 - r.x0, imgH * 0.28)
    ctx.restore()
  }

  // 4) Bandeaux sombres en haut des colonnes (zone des Héros / rangée du haut).
  //    Le PNG est noir opaque ; on l'applique en semi-transparence pour laisser
  //    transparaître l'illustration assombrie (look « zone Héros » du gabarit).
  try {
    const hd = await asset('realm-herodark.png')
    ctx.globalAlpha = 0.5
    ctx.drawImage(hd, 0, 0, BOARD_W, BOARD_H)
    ctx.globalAlpha = 1
  } catch { /* sans bandeaux */ }

  // 5) Bordures dorées.
  try {
    ctx.drawImage(await asset('realm-borders.png'), 0, 0, BOARD_W, BOARD_H)
  } catch { /* sans bordures */ }

  // 6) Panneau Objectif (gauche).
  const pw = OBJ_PANEL.x1 - OBJ_PANEL.x0
  const cx = (OBJ_PANEL.x0 + OBJ_PANEL.x1) / 2

  // Portrait du vilain : PLEINE HAUTEUR, un peu plus étroit que le panneau pour ne
  //  pas serrer le bord droit (la 1re colonne commence à x=730).
  const PORTRAIT_W = 697
  const villainArt = v.presentation ?? v.portrait
  if (villainArt) {
    try {
      const px = (v.portraitPos?.x ?? 50) / 100
      const py = (v.portraitPos?.y ?? 50) / 100
      const z = v.portraitPos?.zoom ?? 1
      drawCover(ctx, await loadImage(villainArt), 0, 0, PORTRAIT_W, BOARD_H, 0, px, py, z)
    } catch { /* sans illustration */ }
  }

  // Dégradé sombre en haut (lisibilité du nom du vilain par-dessus le portrait).
  {
    const g = ctx.createLinearGradient(0, 0, 0, 230)
    g.addColorStop(0, 'rgba(0,0,0,0.62)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, PORTRAIT_W, 230)
  }

  // Fond sombre de la boîte Objectif (intérieur du cadre doré) : lisibilité du
  // texte par-dessus le portrait.
  ctx.save()
  roundRect(ctx, 90, 812, 507, 352, 10)
  ctx.fillStyle = 'rgba(16,14,20,0.78)'
  ctx.fill()
  ctx.restore()

  // Cadre doré de l'objectif + ligne de séparation (calques du gabarit).
  try {
    ctx.drawImage(await asset('realm-objective.png'), 0, 0, BOARD_W, BOARD_H)
  } catch { /* sans cadre */ }
  try {
    ctx.drawImage(await asset('realm-objective-line.png'), 0, 0, BOARD_W, BOARD_H)
  } catch { /* sans ligne */ }

  ctx.fillStyle = '#e8c879'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Nom du vilain (bandeau du haut).
  {
    let s = 58
    ctx.font = `bold ${s}px ${FONT}`
    while (ctx.measureText(v.name.toUpperCase()).width > pw - 60 && s > 26) {
      s -= 2
      ctx.font = `bold ${s}px ${FONT}`
    }
    ctx.fillText(v.name.toUpperCase(), cx, 56)
  }

  // Intitulé « OBJECTIF DE {nom} » sur deux lignes, AU-DESSUS de la ligne (y≈938).
  {
    const boxW = 507 - 56
    fitFont(ctx, 'OBJECTIF DE', boxW, 34, 22, '600 ')
    ctx.fillText('OBJECTIF DE', cx, 858)
    const nm = v.name.toUpperCase()
    fitFont(ctx, nm, boxW, 42, 22, 'bold ')
    ctx.fillText(nm, cx, 905)
  }

  if (v.boardObjective.trim()) {
    ctx.fillStyle = INK
    ctx.textBaseline = 'top'
    const boxW = 507 - 56
    let s = 32
    ctx.font = `${s}px ${FONT}`
    let lines = wrap(ctx, v.boardObjective.trim(), boxW)
    while (lines.length * (s + 8) > 196 && s > 18) {
      s -= 2
      ctx.font = `${s}px ${FONT}`
      lines = wrap(ctx, v.boardObjective.trim(), boxW)
    }
    let y = 966
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
    const name = loc.name.toUpperCase()
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 14
    let s = 54
    ctx.font = `bold ${s}px ${FONT}`
    while (ctx.measureText(name).width > r.x1 - r.x0 - 40 && s > 22) {
      s -= 2
      ctx.font = `bold ${s}px ${FONT}`
    }
    ctx.fillText(name, (r.x0 + r.x1) / 2, BOARD_H * (NAME_Y_PCT / 100))
    ctx.shadowBlur = 0
  }

  // 8) Médaillons d'action aux positions canoniques. On privilégie l'icône
  //    AUTHENTIQUE du gabarit (PNG, anneau inclus) ; à défaut, fallback vectoriel.
  const pos = customActionPositions(v.locations)
  const RX = 108
  const RY = 100
  const ICON = 210 // taille de dessin de l'icône PNG (carrée), en px — calée sur le gabarit
  const DISC = ICON * 0.97 // disque de fond, juste à l'intérieur de l'anneau doré

  // Disque sombre commun à tous les médaillons (gabarit « Fill #4 » teinté en
  // ardoise) : sans lui, l'arrière-plan transparaîtrait à travers l'anneau ajouré.
  const disc = await tintedDisc(asset, DISC, v.color)

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
          const ring = await asset(file)
          if (disc) ctx.drawImage(disc, px - DISC / 2, py - DISC / 2, DISC, DISC)
          ctx.drawImage(ring, px - ICON / 2, py - ICON / 2, ICON, ICON)
          drawn = true
        } catch { /* image illisible → fallback vectoriel */ }
      }
      if (!drawn) {
        drawMedallion(ctx, px, py, RX, RY)
        drawIcon(ctx, a.type, px, py, 84, a.amount)
      }
      // Gemme « Gagner du pouvoir » : le PNG est vide, on imprime le montant —
      // via les chiffres dorés du gabarit (1/2/3), sinon en typo dorée.
      if (drawn && a.type === 'GAIN_POWER') {
        const amt = a.amount ?? 1
        let printed = false
        if (amt >= 1 && amt <= 3) {
          try {
            const num = await asset(`power-${amt}.png`)
            const h = ICON * 0.42
            const w = (num.width * h) / num.height
            ctx.drawImage(num, px - w / 2, py - h / 2, w, h)
            printed = true
          } catch { /* image illisible → typo */ }
        }
        if (!printed) {
          ctx.save()
          ctx.fillStyle = GOLD
          ctx.font = `bold 78px ${FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(amt), px, py + 6)
          ctx.restore()
        }
      }
    }
  }

  return canvas.toDataURL('image/png')
}
