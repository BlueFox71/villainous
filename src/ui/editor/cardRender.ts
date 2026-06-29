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

import type { CustomCard, ArtTransform, BackOverlay } from '../../data/customVillain'
import { CARD_W, CARD_H } from '../../data/customVillain'
import type { CardType } from '../../data/types'
import { loadImage } from './imageUtils'
import { EDITOR_FONT, ensureFonts } from './fonts'
import type { LocationActionType } from '../../engine/types'
import { ACTION_TOKENS, ACTION_ICON_FILE, BOARD_ICON_DIR, drawActionIcon } from './actionIcons'

const LAYOUT_DIR = '/editor/layout'

/** Géométrie (en pixels image 1440×2044), relevée sur les gabarits. */
const GEO = {
  panelTop: 980,
  nameLineY: 1245,
  nameBaseline: 1192,
  typeY: 2002,
  text: { x: 150, top: 1380, w: 1140, bottom: 1900, lineH: 64, size: 50 },
  cost: { cx: 188, cy: 188, size: 130 },
  strength: { cx: 139, cy: 1900, size: 120 },
} as const

/** Libellé FR du type de carte (affiché sur la carte). */
export const TYPE_LABEL: Record<CardType, string> = {
  ally: 'Allié',
  item: 'Objet',
  effect: 'Événement',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
  ingredient: 'Ingrédient',
}

/** Couleur du libellé de type, calquée sur les cartes officielles Villainous
 *  (Allié rouge, Objet bleu, Effet vert, Condition rose, Héros or). */
export const TYPE_COLOR: Record<CardType, string> = {
  ally: '#e8503a',
  item: '#3aa0e0',
  effect: '#6ec05a',
  condition: '#d96fc0',
  hero: '#e8a93a',
  curse: '#a87fd6',
  ingredient: '#c9a14e',
}

/** Normalise un mot pour la comparaison de type : minuscule, sans accents ni
 *  ponctuation (« Allié, » → « allie »). */
function normalizeTypeWord(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

/** Libellés de TYPE (Allié, Objet…) normalisés → couleur du type, pour colorer ces
 *  mots dans le texte de règle comme sur les cartes officielles. */
const TYPE_WORD_COLOR: Record<string, string> = Object.fromEntries(
  (Object.keys(TYPE_LABEL) as CardType[]).map((t) => [normalizeTypeWord(TYPE_LABEL[t]), TYPE_COLOR[t]]),
)

/** Couleur de type d'un mot du texte (« Allié », « Objets »…), ou null si non typé.
 *  Gère le pluriel simple (suffixe « s »). `map` = table normalisée mot→couleur (types
 *  intégrés + types PERSONNALISÉS du vilain, cf. buildTypeColorMap). */
function typeWordColor(raw: string, map: Record<string, string> = TYPE_WORD_COLOR): string | null {
  const w = normalizeTypeWord(raw)
  if (!w) return null
  if (map[w]) return map[w]
  if (w.endsWith('s') && map[w.slice(0, -1)]) return map[w.slice(0, -1)]
  return null
}

/** Construit la table normalisée mot→couleur : types intégrés + types personnalisés
 *  (bibliothèque + type propre de la carte). Permet de colorer dans le texte de règle
 *  les références à un type créé par le joueur (ex. « stand » en violet). */
function buildTypeColorMap(customTypes: { label: string; color: string }[]): Record<string, string> {
  const map: Record<string, string> = { ...TYPE_WORD_COLOR }
  for (const t of customTypes) {
    const w = normalizeTypeWord(t.label)
    if (w && t.color) map[w] = t.color
  }
  return map
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

/** Charge le médaillon d'action AUTHENTIQUE (PNG du gabarit) d'un type d'action,
 *  ou null si ce type n'a pas d'image. Mis en cache. */
function actionIconAsset(type: LocationActionType): Promise<HTMLImageElement> | null {
  const file = ACTION_ICON_FILE[type]
  if (!file) return null
  const src = `${BOARD_ICON_DIR}/${file}`
  let p = imgCache.get(src)
  if (!p) {
    p = loadImage(src)
    imgCache.set(src, p)
  }
  return p
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

/**
 * Recolore l'INTÉRIEUR ardoise d'une pastille de gabarit (coût / force) à la
 * couleur du vilain, en gardant le liseré doré. On remplit la zone « Fill this
 * with any color » #1 / #2 par EXACTEMENT la même ardoise teintée que le panneau
 * (`couleur pleine × back-texture`), pour retrouver le grain de la carte. Les
 * pixels dorés (chauds : rouge nettement > bleu) sont laissés tels quels.
 */
function tintBadgeInterior(
  img: HTMLImageElement,
  color: string,
  tex: HTMLImageElement,
): HTMLCanvasElement {
  const w = img.width
  const h = img.height
  // Ardoise teintée = couleur pleine × texture (même recette que le panneau).
  const slate = document.createElement('canvas')
  slate.width = w
  slate.height = h
  const s = slate.getContext('2d')!
  s.fillStyle = color
  s.fillRect(0, 0, w, h)
  s.globalCompositeOperation = 'multiply'
  s.drawImage(tex, 0, 0, w, h)
  const slateData = s.getImageData(0, 0, w, h).data

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const cx = c.getContext('2d')!
  cx.drawImage(img, 0, 0)
  const data = cx.getImageData(0, 0, w, h)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    // Pixel doré (liseré) : chaud (rouge nettement > bleu) → conservé tel quel.
    if (px[i] - px[i + 2] > 35) continue
    // Pixel d'ardoise : on le remplace par l'ardoise teintée (couleur + grain).
    px[i] = slateData[i]
    px[i + 1] = slateData[i + 1]
    px[i + 2] = slateData[i + 2]
  }
  cx.putImageData(data, 0, 0)
  return c
}

/** Pastille (coût/force) teintée, MISE EN CACHE par (fichier, couleur) : le calcul
 *  pixel par pixel de `tintBadgeInterior` est coûteux, mais ne dépend pas du texte —
 *  on évite ainsi de le refaire à chaque frappe dans l'éditeur. */
const tintedBadgeCache = new Map<string, HTMLCanvasElement>()
async function tintedBadge(file: string, color: string): Promise<HTMLCanvasElement> {
  const key = `${file}|${color}`
  let c = tintedBadgeCache.get(key)
  if (!c) {
    const img = await asset(file)
    const tex = await asset('back-texture.png')
    c = tintBadgeInterior(img, color, tex)
    tintedBadgeCache.set(key, c)
  }
  return c
}

// --- Mise en page du texte de règle avec JETONS d'action inline --------------
//
// Le texte peut contenir des jetons « [activer] », « [pouvoir] »… (cf. ACTION_TOKENS)
// remplacés par le symbole d'action doré dessiné en ligne. On découpe en MOTS
// (séparés par des espaces) ; chaque mot est une suite de SEGMENTS texte/icône, et
// reste insécable au retour à la ligne.

/** Un segment d'un mot : portion de texte, ou icône d'action. */
type Seg = { text: string } | { icon: LocationActionType }
/** Un mot mesuré : ses segments + sa largeur totale (px). */
type Word = { segs: Seg[]; w: number }

/** Découpe un mot (sans espace) en segments texte/icône selon les jetons connus. */
function parseSegments(word: string): Seg[] {
  const segs: Seg[] = []
  const re = /\[([a-z-]+)\]/gi
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(word))) {
    const type = ACTION_TOKENS[m[1].toLowerCase()]
    if (!type) continue // jeton inconnu : laissé en texte brut
    if (m.index > last) segs.push({ text: word.slice(last, m.index) })
    segs.push({ icon: type })
    last = re.lastIndex
  }
  if (last < word.length) segs.push({ text: word.slice(last) })
  return segs.length ? segs : [{ text: word }]
}

/** Mesure puis répartit `text` en lignes tenant dans `maxW`. Les icônes occupent
 *  une largeur carrée `iconW`. Une ligne vide est conservée (paragraphe vide). */
function layoutText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  iconW: number,
  spaceW: number,
): Word[][] {
  const measure = (segs: Seg[]) =>
    segs.reduce((sum, s) => sum + ('icon' in s ? iconW : ctx.measureText(s.text).width), 0)
  const lines: Word[][] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let cur: Word[] = []
    let curW = 0
    for (const raw of words) {
      const segs = parseSegments(raw)
      const w = measure(segs)
      const projected = curW + (cur.length ? spaceW : 0) + w
      if (cur.length && projected > maxW) {
        lines.push(cur)
        cur = []
        curW = 0
      }
      cur.push({ segs, w })
      curW += (cur.length > 1 ? spaceW : 0) + w
    }
    lines.push(cur) // garde les paragraphes vides comme ligne vierge
  }
  return lines
}

/** Largeur affichée d'une ligne (mots + espaces intercalaires). */
function lineWidth(line: Word[], spaceW: number): number {
  return line.reduce((sum, word) => sum + word.w, 0) + Math.max(0, line.length - 1) * spaceW
}

/** Types d'action référencés par les jetons présents dans `text`. */
function collectIconTypes(text: string): LocationActionType[] {
  const set = new Set<LocationActionType>()
  const re = /\[([a-z-]+)\]/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const t = ACTION_TOKENS[m[1].toLowerCase()]
    if (t) set.add(t)
  }
  return [...set]
}

/** Police thématique : Esteban (même topographie que le plateau). */
const FONT = EDITOR_FONT

/** Police « système » Arial pour le type et le texte de règle (vraie graisse grasse). */
export const UI_FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

/** Doré de référence : EXACTEMENT celui des chiffres de pouvoir 1/2/3 du gabarit
 *  (`power-N.png`). Utilisé pour le nom + le texte des cartes et le nom au dos. */
const POWER_GOLD = '#ae8955'

/** Encre NOIRE des cartes Fatalité (nom + texte) — sur leur parchemin clair. */
const FATE_INK = '#1a1a1a'

/** Interligne du texte de règle, proportionnel à la taille de police. */
const TEXT_LINE_FACTOR = 1.28
/** Taille d'une icône inline, relative à la taille de police. */
const INLINE_ICON_FACTOR = 1.4

/** Précharge les médaillons d'action (PNG) pour une liste de types. */
async function preloadIcons(types: LocationActionType[]): Promise<Map<LocationActionType, HTMLImageElement>> {
  const map = new Map<LocationActionType, HTMLImageElement>()
  await Promise.all(
    types.map(async (t) => {
      const p = actionIconAsset(t)
      if (!p) return
      try {
        map.set(t, await p)
      } catch {
        /* image illisible → repli vectoriel */
      }
    }),
  )
  return map
}

/** Dessine des lignes mises en page (texte + icônes), chaque ligne centrée
 *  horizontalement sur `centerX`, empilées à partir de `startY`. */
function drawRuleLines(
  ctx: CanvasRenderingContext2D,
  lines: Word[][],
  startY: number,
  centerX: number,
  lineH: number,
  spaceW: number,
  iconW: number,
  gold: string,
  iconImgs: Map<LocationActionType, HTMLImageElement>,
  typeColors: Record<string, string> = TYPE_WORD_COLOR,
) {
  ctx.fillStyle = gold
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let y = startY
  for (const line of lines) {
    let x = centerX - lineWidth(line, spaceW) / 2
    const cy = y + lineH / 2
    for (const word of line) {
      for (const seg of word.segs) {
        if ('icon' in seg) {
          const img = iconImgs.get(seg.icon)
          if (img) ctx.drawImage(img, x, cy - iconW / 2, iconW, iconW)
          else drawActionIcon(ctx, seg.icon, x + iconW / 2, cy, iconW, gold)
          x += iconW
        } else {
          // Mots de type (Allié, Objet, Héros… ET types personnalisés) colorés à la couleur
          // de leur type ; le reste reste doré.
          ctx.fillStyle = typeWordColor(seg.text, typeColors) ?? gold
          ctx.fillText(seg.text, x, cy)
          x += ctx.measureText(seg.text).width
        }
      }
      x += spaceW
    }
    y += lineH
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
}

/** Dessine un bloc de texte (gras doré + jetons inline) centré sur (x,y) en % de la
 *  carte, largeur `w` en %, taille `size` en px. Réutilisé par le texte principal
 *  (mode libre) et par chaque zone de texte supplémentaire. */
function renderTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  L: { x: number; y: number; w: number; size: number },
  gold: string,
  iconImgs: Map<LocationActionType, HTMLImageElement>,
  typeColors: Record<string, string> = TYPE_WORD_COLOR,
) {
  const t = text.trim()
  if (!t) return
  const centerX = (L.x / 100) * CARD_W
  const centerY = (L.y / 100) * CARD_H
  const w = (L.w / 100) * CARD_W
  ctx.font = `bold ${L.size}px ${UI_FONT}`
  const iconW = L.size * INLINE_ICON_FACTOR
  const spaceW = ctx.measureText(' ').width
  const lineH = L.size * TEXT_LINE_FACTOR
  const lines = layoutText(ctx, t, w, iconW, spaceW)
  const startY = centerY - (lines.length * lineH) / 2
  drawRuleLines(ctx, lines, startY, centerX, lineH, spaceW, iconW, gold, iconImgs, typeColors)
}

/** Hauteur (px, espace carte) du bloc de texte de règle pour une largeur et une
 *  taille données — utilisé par l'éditeur pour dimensionner la zone de drag. */
export function ruleTextBlockHeight(text: string, wPx: number, sizePx: number): number {
  const t = text.trim()
  if (!t) return 0
  const c = document.createElement('canvas').getContext('2d')!
  c.font = `bold ${sizePx}px ${UI_FONT}`
  const iconW = sizePx * INLINE_ICON_FACTOR
  const spaceW = c.measureText(' ').width
  const lines = layoutText(c, t, wPx, iconW, spaceW)
  return lines.length * sizePx * TEXT_LINE_FACTOR
}

/** Écrit un nombre centré dans une pastille. */
function drawBadgeNumber(
  ctx: CanvasRenderingContext2D,
  value: number | string,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  // Esteban n'a qu'une graisse Regular (le canvas ne synthétise pas `bold` pour
  // une police web) : on épaissit le chiffre par un strokeText de même couleur,
  // pour qu'il soit aussi gras que les numéraux-images 1/2/3 du gabarit.
  ctx.save()
  ctx.font = `${size}px ${FONT}`
  ctx.textAlign = 'center'
  // `textBaseline='middle'` tombe à côté du centre visuel avec Esteban : on
  // centre le chiffre sur ses VRAIES métriques de glyphe (même position que les
  // numéraux-images 1/2/3).
  ctx.textBaseline = 'alphabetic'
  const s = String(value)
  const mt = ctx.measureText(s)
  const baselineY = cy + (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 6
  ctx.fillText(s, cx, baselineY)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.lineWidth = Math.max(2, size * 0.045)
  ctx.strokeStyle = color
  ctx.lineJoin = 'round'
  ctx.strokeText(s, cx, baselineY)
  ctx.restore()
}

/**
 * Imprime un nombre dans le style des NUMÉRAUX DU PLATEAU : on réutilise les
 * images dorées `power-1/2/3.png` du gabarit Realm pour 1–3 (strictement les mêmes
 * chiffres que sur le plateau), et un repli en fonte dorée au-delà. Réservé aux
 * pastilles à FOND SOMBRE (coût + force Vilain), où l'or reste lisible.
 */
async function drawBoardNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  cx: number,
  cy: number,
  size: number,
  // `signed` : préfixe explicitement le « + » des valeurs positives (Force d'un Objet,
  // qui est un modificateur). On bascule alors en fonte (les numéraux-images n'ont pas
  // de signe). Le « − » des négatifs est déjà rendu par `String(value)`.
  signed = false,
) {
  if (!signed && value >= 1 && value <= 3) {
    try {
      const num = await asset(`power-${value}.png`)
      const h = size * 0.78
      const w = (num.width * h) / num.height
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 6
      ctx.drawImage(num, cx - w / 2, cy - h / 2, w, h)
      ctx.restore()
      return
    } catch {
      /* image illisible → repli fonte dorée */
    }
  }
  drawBadgeNumber(ctx, signed && value > 0 ? `+${value}` : value, cx, cy, size, '#cda14e')
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
  opts: { skipText?: boolean; skipStickers?: boolean } = {},
  customTypes: { label: string; color: string }[] = [],
): Promise<string> {
  await ensureFonts()
  // Couleurs des mots de type dans le texte de règle : types intégrés + types perso
  // (bibliothèque) + type propre de la carte (pour colorer ses propres références).
  const typeColors = buildTypeColorMap([
    ...customTypes,
    ...(card.typeLabel && card.typeColor ? [{ label: card.typeLabel, color: card.typeColor }] : []),
  ])
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

  // 2) Panneau d'habillage, clippé à la forme du gabarit (deck).
  const deck = await asset(isFate ? 'FateDeck.png' : 'VillainDeck.png')
  {
    const off = document.createElement('canvas')
    off.width = CARD_W
    off.height = CARD_H
    const o = off.getContext('2d')!
    if (isFate) {
      // Fatalité : on garde le parchemin clair du gabarit, teinté par sa couleur.
      o.drawImage(deck, 0, 0, CARD_W, CARD_H)
      o.globalCompositeOperation = 'multiply'
      o.globalAlpha = 0.78
      o.fillStyle = panelColor
      o.fillRect(0, 0, CARD_W, CARD_H)
      o.globalAlpha = 1
    } else {
      // Vilain : MÊME recette que le dos (couleur pleine × texture ardoise), pour
      // que la teinte du panneau corresponde EXACTEMENT au dos de carte.
      o.fillStyle = panelColor
      o.fillRect(0, 0, CARD_W, CARD_H)
      o.globalCompositeOperation = 'multiply'
      o.drawImage(await asset('back-texture.png'), 0, 0, CARD_W, CARD_H)
    }
    o.globalCompositeOperation = 'destination-in'
    o.drawImage(deck, 0, 0, CARD_W, CARD_H)
    ctx.drawImage(off, 0, 0)
  }

  // 2b) Ornements dorés (cadre + axe), redessinés PAR-DESSUS sans teinte : la
  //     couleur du vilain ne doit colorer que le panneau, jamais l'or du gabarit.
  try {
    const orn = await asset('front-ornaments.png')
    ctx.drawImage(orn, 0, 0, CARD_W, CARD_H)
  } catch {
    /* pas de couche d'ornements : le cadre teinté du gabarit reste visible */
  }

  // 3) Nom (centré, ajusté pour tenir en largeur) : DORÉ (chiffres 1/2/3) sur une carte
  //    Vilain, NOIR sur une carte Fatalité (parchemin clair).
  ctx.fillStyle = isFate ? FATE_INK : POWER_GOLD
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  let nameSize = 90
  ctx.font = `${nameSize}px ${FONT}`
  const maxNameW = CARD_W - 320
  while (ctx.measureText(card.name).width > maxNameW && nameSize > 46) {
    nameSize -= 2
    ctx.font = `${nameSize}px ${FONT}`
  }
  ctx.fillText(card.name, CARD_W / 2, GEO.nameBaseline)

  // 4) Type EN BAS, en Arial gras : libellé et couleur personnalisables (sinon
  //    valeurs par défaut du type mécanique).
  ctx.save()
  ctx.font = `bold 66px ${UI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = card.typeColor || TYPE_COLOR[card.type]
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 5
  ctx.fillText(card.typeLabel || TYPE_LABEL[card.type], CARD_W / 2, GEO.typeY)
  ctx.restore()

  // 5) Texte de règle : DORÉ, en Arial gras. Les jetons « [activer] »… deviennent
  //    des symboles d'action inline. Deux modes : disposition LIBRE (card.textLayout :
  //    position/largeur/taille fixées par l'utilisateur) ou AUTO (boîte basse centrée,
  //    taille auto-ajustée). Le préchargement couvre jetons inline + symboles posés.
  const gold = isFate ? FATE_INK : POWER_GOLD
  if (!opts.skipText) {
    // Précharge les médaillons d'action référencés (texte principal + zones + posés).
    const iconTypes = new Set<LocationActionType>()
    for (const t of collectIconTypes(card.text)) iconTypes.add(t)
    for (const b of card.textBoxes ?? []) for (const t of collectIconTypes(b.text)) iconTypes.add(t)
    for (const s of card.stickers ?? []) iconTypes.add(s.type)
    const iconImgs = await preloadIcons([...iconTypes])

    // Texte principal : disposition LIBRE (card.textLayout) ou AUTO (boîte basse).
    if (card.text.trim()) {
      if (card.textLayout) {
        renderTextBlock(ctx, card.text, card.textLayout, gold, iconImgs, typeColors)
      } else {
        const text = card.text.trim()
        const avail = GEO.text.bottom - GEO.text.top
        let size = GEO.text.size
        let lineH = GEO.text.lineH
        for (;;) {
          ctx.font = `bold ${size}px ${UI_FONT}`
          const iconW = size * INLINE_ICON_FACTOR
          const spaceW = ctx.measureText(' ').width
          const lines = layoutText(ctx, text, GEO.text.w, iconW, spaceW)
          const totalH = lines.length * lineH
          if (totalH <= avail || size <= 26) {
            const startY = GEO.text.top + Math.max(0, (avail - totalH) / 2)
            drawRuleLines(ctx, lines, startY, CARD_W / 2, lineH, spaceW, iconW, gold, iconImgs, typeColors)
            break
          }
          size -= 2
          lineH -= 2
        }
      }
    }

    // Zones de texte SUPPLÉMENTAIRES (toujours en disposition libre).
    for (const box of card.textBoxes ?? []) {
      renderTextBlock(ctx, box.text, box, gold, iconImgs, typeColors)
    }
  }

  // 5b) Symboles d'action POSÉS librement (éléments indépendants).
  if (!opts.skipStickers && card.stickers?.length) {
    const imgs = await preloadIcons([...new Set(card.stickers.map((s) => s.type))])
    for (const st of card.stickers) {
      const side = (st.size / 100) * CARD_W
      const cx = (st.x / 100) * CARD_W
      const cy = (st.y / 100) * CARD_H
      const img = imgs.get(st.type)
      if (img) ctx.drawImage(img, cx - side / 2, cy - side / 2, side, side)
      else drawActionIcon(ctx, st.type, cx, cy, side, gold)
    }
  }

  // 6) Pastille de COÛT (cartes Vilain uniquement) — intérieur teinté à la couleur
  //    du vilain (zone « Fill #1 »), liseré doré conservé ; numéraux dorés du plateau.
  if (!isFate && card.cost !== undefined) {
    ctx.drawImage(await tintedBadge('VillainCost.png', panelColor), 0, 0, CARD_W, CARD_H)
    await drawBoardNumber(ctx, card.cost, GEO.cost.cx, GEO.cost.cy, GEO.cost.size)
  }

  // 7) Étoile de FORCE (Alliés / Héros) — numéraux DORÉS du plateau dans les deux
  //    decks. Vilain : intérieur teinté à la couleur du vilain (zone « Fill #2 »),
  //    liseré doré conservé. Fatalité : étoile claire d'origine conservée.
  //    Les Objets peuvent AUSSI afficher une étoile : facultative (seulement si une
  //    valeur ≠ 0 est saisie) et SIGNÉE (+N / −N), car c'est un modificateur de force.
  const isStrengthBearer = card.type === 'ally' || card.type === 'hero'
  const showStrength = isStrengthBearer
    ? card.strength !== undefined
    : card.type === 'item' && !!card.strength
  if (showStrength) {
    const str = await asset(isFate ? 'FateStrength.png' : 'VillainStrength.png')
    if (isFate) {
      ctx.drawImage(str, 0, 0, CARD_W, CARD_H)
    } else {
      ctx.drawImage(await tintedBadge('VillainStrength.png', panelColor), 0, 0, CARD_W, CARD_H)
    }
    await drawBoardNumber(ctx, card.strength ?? 0, GEO.strength.cx, GEO.strength.cy, GEO.strength.size, !isStrengthBearer)
  }

  return canvas.toDataURL('image/png')
}

/**
 * Génère un DOS de carte à partir du template officiel « Card Back » (calques
 * extraits) tinté par une couleur : remplissage couleur → texture ardoise en
 * MULTIPLY → ornements dorés (cadre + axe) → libellé centré en bas.
 *
 * `opts.paper` : dos « parchemin clair » (Fatalité), pour accorder le dos à la
 * teinte CLAIRE du recto Fatalité plutôt qu'à l'ardoise sombre du deck Vilain.
 * On n'applique alors la texture qu'en grain léger pour ne pas griser le fond.
 */
export async function renderCardBack(
  color: string,
  label: string,
  opts: { paper?: boolean; overlays?: BackOverlay[] } = {},
): Promise<string> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!

  // 1) Remplissage de la couleur choisie (calque « Fill this with any color »).
  ctx.fillStyle = color
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // 2) Texture ardoise en multiply (calque « Background Multiplier »). Sur un dos
  //    « parchemin » (clair), on l'atténue fortement pour garder un fond clair
  //    accordé au recto Fatalité ; sinon, multiply plein (tint façon ardoise).
  try {
    const tex = await asset('back-texture.png')
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = opts.paper ? 0.14 : 1
    ctx.drawImage(tex, 0, 0, CARD_W, CARD_H)
    ctx.globalAlpha = 1
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
    // Même doré que les chiffres de pouvoir 1/2/3 du gabarit.
    ctx.fillStyle = POWER_GOLD
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = 70
    ctx.font = `${size}px ${FONT}`
    const maxW = CARD_W - 360
    const text = label.toUpperCase()
    while (ctx.measureText(text).width > maxW && size > 32) {
      size -= 2
      ctx.font = `${size}px ${FONT}`
    }
    ctx.fillText(text, CARD_W / 2, CARD_H - 70)
  }

  // 5) Ornements IMPORTÉS (images superposées, déplaçables/redimensionnables).
  for (const ov of opts.overlays ?? []) {
    try {
      const img = await loadImage(ov.image)
      const w = (ov.size / 100) * CARD_W
      const h = w * (ov.aspect || img.height / img.width)
      ctx.drawImage(img, (ov.x / 100) * CARD_W - w / 2, (ov.y / 100) * CARD_H - h / 2, w, h)
    } catch {
      /* image illisible : on l'ignore */
    }
  }
  return canvas.toDataURL('image/png')
}
