// =============================================================================
// Rendu du PLATEAU d'un vilain personnalisé, au plus près du gabarit « Realm » :
// fond coloré + texture ardoise + bandeaux sombres en haut des colonnes (zone des
// Héros) + bordures dorées + boîte Objectif, avec les illustrations de lieux et,
// pour chaque action, un MÉDAILLON ovale (double anneau doré, fond ardoise) portant
// une icône dorée. Les médaillons sont aux MÊMES positions que les zones cliquables
// en jeu (cf. boardLayout.ts).
// =============================================================================

import type { CustomVillain, CustomLocation } from '../../data/customVillain'
import { loadImage } from './imageUtils'
import { EDITOR_FONT, ensureFonts } from './fonts'
import { drawActionIcon, ACTION_ICON_FILE } from './actionIcons'
import { UI_FONT } from './cardRender'
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
    // 1) Base = couleur du vilain. 2) Texture du disque en MULTIPLY (on garde le grain
    // du gabarit, teinté). 3) Masque à la FORME du disque (destination-in). 4) Léger
    // assombrissement pour garder l'icône dorée lisible.
    octx.fillStyle = color
    octx.fillRect(0, 0, px, px)
    octx.globalCompositeOperation = 'multiply'
    octx.drawImage(fill, 0, 0, px, px)
    octx.globalCompositeOperation = 'destination-in'
    octx.drawImage(fill, 0, 0, px, px)
    octx.globalCompositeOperation = 'source-atop'
    octx.fillStyle = 'rgba(0,0,0,0.34)'
    octx.fillRect(0, 0, px, px)
    octx.globalCompositeOperation = 'source-over'
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Fichier du cadenas (partagé avec l'overlay « lieu verrouillé » en jeu). */
const LOCK_SRC = '/cards/jafar/lock.webp'

/** Rend le plateau complet d'un vilain personnalisé en dataURL PNG.
 *  `skipLocks` : ne bake PAS les cadenas décoratifs (l'éditeur les affiche en
 *  overlay live à la place, pour rester réactif pendant le glisser). */
export async function renderBoard(v: CustomVillain, opts: { skipLocks?: boolean } = {}): Promise<string> {
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
  // Illustration du vilain sur le plateau : UNIQUEMENT l'image de plateau dédiée
  // (boardArt). Ni le portrait carré ni la présentation ne servent ici.
  const villainArt = v.boardArt
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

  // Fond de la boîte Objectif : MÊME teinte que le plateau (couleur du vilain ×
  // texture ardoise). Comme sur les plateaux officiels, le remplissage DÉBORDE
  // légèrement AUTOUR du cadre d'ornements (bbox des pixels dorés de
  // realm-objective.png : x 77→610, y 799→1176) : on l'étend d'une marge constante.
  {
    const M = 25 // débord (px) tout autour du cadre d'ornements
    const fx = 77 - M
    const fy = 799 - M
    const fw = 534 + M * 2
    const fh = 378 + M * 2
    ctx.save()
    roundRect(ctx, fx, fy, fw, fh, 14)
    ctx.clip()
    ctx.fillStyle = v.color
    ctx.fillRect(fx, fy, fw, fh)
    try {
      const tex = await asset('objective-fill.png')
      ctx.globalCompositeOperation = 'multiply'
      ctx.drawImage(tex, fx, fy, fw, fh)
      ctx.globalCompositeOperation = 'source-over'
    } catch { /* sans texture : aplat de couleur */ }
    ctx.restore()
  }

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
    ctx.font = `${s}px ${FONT}`
    while (ctx.measureText(v.name.toUpperCase()).width > pw - 60 && s > 26) {
      s -= 2
      ctx.font = `${s}px ${FONT}`
    }
    ctx.fillText(v.name.toUpperCase(), cx, 56)
  }

  // Intitulé « OBJECTIF DE {nom} » sur deux lignes, AU-DESSUS de la ligne (y≈938).
  {
    const boxW = 507 - 56
    fitFont(ctx, 'OBJECTIF DE', boxW, 34, 22)
    ctx.fillText('OBJECTIF DE', cx, 858)
    const nm = v.name.toUpperCase()
    fitFont(ctx, nm, boxW, 42, 22)
    ctx.fillText(nm, cx, 905)
  }

  if (v.boardObjective.trim()) {
    ctx.fillStyle = '#e8c879' // doré (même or que le titre « OBJECTIF DE »)
    ctx.textBaseline = 'top'
    const boxW = 507 - 56
    let s = 40
    // Même police que le TEXTE DE RÈGLE des cartes (UI_FONT), doré et SANS gras.
    ctx.font = `${s}px ${UI_FONT}`
    let lines = wrap(ctx, v.boardObjective.trim(), boxW)
    while (lines.length * (s + 8) > 196 && s > 24) {
      s -= 2
      ctx.font = `${s}px ${UI_FONT}`
      lines = wrap(ctx, v.boardObjective.trim(), boxW)
    }
    let y = 966 + (v.objectiveTextOffsetY ?? 0)
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
    ctx.fillStyle = '#e8c879' // doré (même or que le nom du vilain / l'objectif)
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 14
    let s = 54
    ctx.font = `${s}px ${FONT}`
    while (ctx.measureText(name).width > r.x1 - r.x0 - 40 && s > 22) {
      s -= 2
      ctx.font = `${s}px ${FONT}`
    }
    ctx.fillText(name, (r.x0 + r.x1) / 2, BOARD_H * (NAME_Y_PCT / 100))
    ctx.shadowBlur = 0
  }

  // 8) Médaillons d'action aux positions canoniques. On privilégie l'icône
  //    AUTHENTIQUE du gabarit (PNG, anneau inclus) ; à défaut, fallback vectoriel.
  const pos = customActionPositions(v.locations)
  const RX = 108
  const RY = 100
  // Disque de fond « Fill #4 » : taille FIXE (indépendante de l'icône) — on ne le
  // rétrécit pas quand on réduit l'icône d'action.
  const DISC = 204
  const ICON = 190 // taille de dessin de l'icône PNG (carrée), en px — rétrécie dans le disque

  // Disque sombre commun à tous les médaillons (gabarit « Fill #4 » teinté en
  // ardoise) : sans lui, l'arrière-plan transparaîtrait à travers l'anneau ajouré.
  const disc = await tintedDisc(asset, DISC, v.color)

  for (const loc of v.locations) {
    for (const a of loc.actions) {
      const p = pos[loc.id]?.[a.id]
      if (!p) continue
      const px = (p.x / 100) * BOARD_W
      const py = (p.y / 100) * BOARD_H
      const file = ACTION_ICON_FILE[a.type]
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
        drawActionIcon(ctx, a.type, px, py, 84, GOLD, a.type === 'GAIN_POWER' ? (a.amount ?? 1) : a.amount)
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

  // 9) Cadenas DÉCORATIFS posés librement (cosmétique). Bakés dans l'image du
  //    plateau → visibles en jeu sans toucher au moteur. L'éditeur peut les sauter
  //    (skipLocks) pour les afficher en overlay live pendant l'édition.
  if (!opts.skipLocks && v.boardLocks?.length) {
    try {
      const lock = await loadImage(LOCK_SRC)
      const aspect = lock.height / lock.width
      for (const l of v.boardLocks) {
        const w = (l.size / 100) * BOARD_W
        const h = w * aspect
        const cxp = (l.x / 100) * BOARD_W
        const cyp = (l.y / 100) * BOARD_H
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.9)'
        ctx.shadowBlur = 18
        ctx.drawImage(lock, cxp - w / 2, cyp - h / 2, w, h)
        ctx.restore()
      }
    } catch { /* cadenas illisible : on l'ignore */ }
  }

  return canvas.toDataURL('image/png')
}

/** Découpe la COLONNE `i` (intérieur des bordures, hauteur pleine) d'un plateau baké
 *  en une image autonome — pour superposer la face B d'un lieu en jeu. Les bordures
 *  dorées (identiques A/B) restent celles du plateau de base : le raccord est invisible. */
async function cropColumn(boardUrl: string, i: number): Promise<string> {
  const img = await loadImage(boardUrl)
  const sx = (COL_RECTS[i].x0 / BOARD_W) * img.width
  const sw = ((COL_RECTS[i].x1 - COL_RECTS[i].x0) / BOARD_W) * img.width
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/** Rend la COLONNE (face B) du lieu d'index `i` : on rend un plateau complet où ce
 *  lieu prend sa face B, puis on en découpe la colonne. Lève si le lieu n'a pas de
 *  face B. */
export async function renderLocationColumnB(v: CustomVillain, i: number): Promise<string> {
  const loc = v.locations[i]
  if (!loc?.alt) throw new Error('lieu sans face B')
  const tempLoc: CustomLocation = {
    ...loc,
    name: loc.alt.name || loc.name,
    image: loc.alt.image ?? loc.image,
    imagePos: loc.alt.imagePos ?? loc.imagePos,
    actions: loc.alt.actions ?? loc.actions,
  }
  const temp: CustomVillain = { ...v, locations: v.locations.map((l, j) => (j === i ? tempLoc : l)) }
  return cropColumn(await renderBoard(temp), i)
}

/** Rend le plateau de la FACE B de l'objectif : image du vilain + texte d'objectif
 *  alternatifs (les colonnes restent en face A — les bascules de lieu sont superposées
 *  par-dessus en jeu). Lève si pas d'objectif alternatif. */
export async function renderAltObjectiveBoard(v: CustomVillain): Promise<string> {
  if (!v.altObjective) throw new Error('pas d’objectif alternatif')
  const temp: CustomVillain = {
    ...v,
    boardObjective: v.altObjective.boardObjective,
    boardArt: v.altObjective.boardArt ?? v.boardArt,
    portraitPos: v.altObjective.portraitPos ?? v.portraitPos,
  }
  return renderBoard(temp)
}
