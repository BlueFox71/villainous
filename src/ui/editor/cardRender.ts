// =============================================================================
// Rendu d'une carte personnalisée en image (dataURL PNG), par compositing canvas.
//
// On reproduit la disposition des gabarits du générateur officiel (1440×2044) :
//   - illustration en haut (plein cadre, recouverte en bas par le panneau) ;
//   - panneau de texte en bas (ardoise pour le deck Vilain, parchemin clair pour
//     la Fatalité) + cadre doré ;
//   - pastille de COÛT en haut-gauche (cartes Vilain), étoile de FORCE en
//     bas-gauche (Alliés / Héros) ;
//   - nom sur la ligne dorée, type dessous, texte de règle dans le cadre.
//
// Le panneau du deck Vilain est TEINTÉ par la couleur du vilain (multiply clippé),
// ce qui « colore » la carte tout en gardant le cadre doré. La Fatalité garde son
// parchemin clair. Le dos des cartes est généré à partir d'une simple couleur.
// =============================================================================

import type { CustomCard, ArtTransform } from '../../data/customVillain'
import { CARD_W, CARD_H } from '../../data/customVillain'
import type { CardType } from '../../data/types'
import { loadImage } from './imageUtils'
import { EDITOR_FONT, ensureFonts } from './fonts'

const LAYOUT_DIR = '/editor/layout'

/** Géométrie (en pixels image 1440×2044), relevée sur les gabarits. */
const GEO = {
  panelTop: 980,
  nameLineY: 1245,
  nameBaseline: 1212,
  typeY: 1320,
  text: { x: 150, top: 1380, w: 1140, bottom: 1900, lineH: 54, size: 42 },
  cost: { cx: 188, cy: 188, size: 130 },
  strength: { cx: 158, cy: 1885, size: 120 },
} as const

/** Libellé FR du type de carte (affiché sur la carte). */
const TYPE_LABEL: Record<CardType, string> = {
  ally: 'Allié',
  item: 'Objet',
  effect: 'Effet',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
  ingredient: 'Ingrédient',
}

// --- Cache d'images de gabarit ----------------------------------------------

const imgCache = new Map<string, Promise<HTMLImageElement>>()
function asset(name: string): Promise<HTMLImageElement> {
  const src = `${LAYOUT_DIR}/${name}`
  let p = imgCache.get(src)
  if (!p) {
    p = loadImage(src)
    imgCache.set(src, p)
  }
  return p
}

// --- Helpers couleur ---------------------------------------------------------

/** Luminance perçue (0..1) d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0.3
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Couleur de texte lisible (noir/blanc) sur un fond donné. */
function readableOn(hex: string): string {
  return luminance(hex) > 0.55 ? '#1a1410' : '#f4ecd8'
}

// --- Dessin ------------------------------------------------------------------

/** Dessine `img` en mode COVER dans le rectangle, avec ajustement (`transform`). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  transform?: ArtTransform,
) {
  const t = transform ?? { scale: 1, offsetXPct: 0, offsetYPct: 0 }
  const base = Math.max(w / img.width, h / img.height)
  const scale = base * (t.scale || 1)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = x + (w - dw) / 2 + (t.offsetXPct / 100) * w
  const dy = y + (h - dh) / 2 + (t.offsetYPct / 100) * h
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

/** Coupe un texte en lignes tenant dans `maxW`. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

/** Police thématique : Esteban (même topographie que le plateau). */
const FONT = EDITOR_FONT

/** Écrit un nombre centré dans une pastille. */
function drawBadgeNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save()
  ctx.font = `bold ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 6
  ctx.fillText(String(value), cx, cy)
  ctx.restore()
}

/**
 * Rend la FACE d'une carte personnalisée en dataURL PNG.
 * @param card  la carte (texte, type, coût, force, illustration brute).
 * @param color couleur thématique du vilain (teinte le panneau des cartes Vilain).
 */
export async function renderCardFace(
  card: CustomCard,
  villainColor: string,
  fateColor: string,
): Promise<string> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!
  const isFate = card.deck === 'fate'
  // Le panneau (Vilain comme Fatalité) est TEINTÉ par sa couleur (cf. calques
  // « Fill this with any color » du gabarit Card).
  const panelColor = isFate ? fateColor : villainColor

  // 1) Fond + illustration (cover sur tout le cadre ; le bas sera recouvert).
  ctx.fillStyle = '#2a2a2e'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  if (card.artImage) {
    try {
      const art = await loadImage(card.artImage)
      drawCover(ctx, art, 0, 0, CARD_W, CARD_H, card.artTransform)
    } catch {
      /* illustration illisible : on garde le fond uni */
    }
  }

  // 2) Panneau d'habillage (deck) teinté : multiply de la couleur, clippé au panneau.
  const deck = await asset(isFate ? 'FateDeck.png' : 'VillainDeck.png')
  {
    const off = document.createElement('canvas')
    off.width = CARD_W
    off.height = CARD_H
    const o = off.getContext('2d')!
    o.drawImage(deck, 0, 0, CARD_W, CARD_H)
    o.globalCompositeOperation = 'multiply'
    o.globalAlpha = 0.78
    o.fillStyle = panelColor
    o.fillRect(0, 0, CARD_W, CARD_H)
    o.globalAlpha = 1
    o.globalCompositeOperation = 'destination-in'
    o.drawImage(deck, 0, 0, CARD_W, CARD_H)
    ctx.drawImage(off, 0, 0)
  }

  // Couleur de texte selon la clarté du panneau.
  const ink = readableOn(panelColor)

  // 3) Nom (centré, ajusté pour tenir en largeur).
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  let nameSize = 78
  ctx.font = `bold ${nameSize}px ${FONT}`
  const maxNameW = CARD_W - 320
  while (ctx.measureText(card.name).width > maxNameW && nameSize > 40) {
    nameSize -= 2
    ctx.font = `bold ${nameSize}px ${FONT}`
  }
  ctx.fillText(card.name, CARD_W / 2, GEO.nameBaseline)

  // 4) Type (petites capitales dorées, plus sombre sur panneau clair).
  ctx.font = `600 38px ${FONT}`
  ctx.fillStyle = luminance(panelColor) > 0.55 ? '#7a5a1e' : '#d8b864'
  ctx.fillText(TYPE_LABEL[card.type].toUpperCase(), CARD_W / 2, GEO.typeY)

  // 5) Texte de règle (centré, multi-lignes).
  if (card.text.trim()) {
    let size = GEO.text.size
    let lineH = GEO.text.lineH
    ctx.fillStyle = ink
    ctx.textBaseline = 'top'
    // Réduit la police si le texte déborde verticalement.
    for (;;) {
      ctx.font = `${size}px ${FONT}`
      const lines = wrapLines(ctx, card.text.trim(), GEO.text.w)
      const totalH = lines.length * lineH
      if (totalH <= GEO.text.bottom - GEO.text.top || size <= 26) {
        let y = GEO.text.top + Math.max(0, (GEO.text.bottom - GEO.text.top - totalH) / 2)
        for (const line of lines) {
          ctx.fillText(line, CARD_W / 2, y)
          y += lineH
        }
        break
      }
      size -= 2
      lineH -= 2
    }
  }

  // 6) Pastille de COÛT (cartes Vilain uniquement).
  if (!isFate && card.cost !== undefined) {
    const cost = await asset('VillainCost.png')
    ctx.drawImage(cost, 0, 0, CARD_W, CARD_H)
    drawBadgeNumber(ctx, card.cost, GEO.cost.cx, GEO.cost.cy, GEO.cost.size, '#f4ecd8')
  }

  // 7) Étoile de FORCE (Alliés / Héros).
  if (card.strength !== undefined && (card.type === 'ally' || card.type === 'hero')) {
    const str = await asset(isFate ? 'FateStrength.png' : 'VillainStrength.png')
    ctx.drawImage(str, 0, 0, CARD_W, CARD_H)
    drawBadgeNumber(ctx, card.strength, GEO.strength.cx, GEO.strength.cy, GEO.strength.size, ink)
  }

  return canvas.toDataURL('image/png')
}

/**
 * Génère un DOS de carte à partir du template officiel « Card Back » (calques
 * extraits) tinté par une couleur : remplissage couleur → texture ardoise en
 * MULTIPLY → ornements dorés (cadre + axe) → libellé centré en bas.
 */
export async function renderCardBack(color: string, label: string): Promise<string> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!

  // 1) Remplissage de la couleur choisie (calque « Fill this with any color »).
  ctx.fillStyle = color
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // 2) Texture ardoise en multiply (calque « Background Multiplier »).
  try {
    const tex = await asset('back-texture.png')
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(tex, 0, 0, CARD_W, CARD_H)
    ctx.globalCompositeOperation = 'source-over'
  } catch {
    /* pas de texture : on garde l'aplat */
  }

  // 3) Ornements dorés (cadre + axe central).
  try {
    const orn = await asset('back-ornaments.png')
    ctx.drawImage(orn, 0, 0, CARD_W, CARD_H)
  } catch {
    /* pas d'ornements */
  }

  // 4) Libellé centré dans le bandeau bas (emplacement du « Villain Name »).
  if (label) {
    ctx.fillStyle = '#d8b864'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = 70
    ctx.font = `600 ${size}px ${FONT}`
    const maxW = CARD_W - 360
    const text = label.toUpperCase()
    while (ctx.measureText(text).width > maxW && size > 32) {
      size -= 2
      ctx.font = `600 ${size}px ${FONT}`
    }
    ctx.fillText(text, CARD_W / 2, CARD_H - 70)
  }
  return canvas.toDataURL('image/png')
}
