// =============================================================================
// Import d'un vilain depuis une feuille Excel au format « Villainous Card Generator »
// (template officiel). Chaque feuille du classeur = un vilain ; chaque ligne = une
// carte. On convertit en CustomVillain ÉDITABLE (cartes seulement ; plateau/objectif
// par défaut, à régler ensuite dans l'Atelier). SheetJS est importé dynamiquement.
//
// Colonnes (0-indexées) : A copies · B nom VO · C nom FR · D coût · E force · F texte
// (effet à la mise en jeu) · G type · H texte d'activation / pouvoir gagné · I coût
// d'activation · K deck (0/Villain, 1/Fate) · L symbole d'action · M « Auto ».
// =============================================================================

import {
  emptyLocation,
  slugify,
  CUSTOM_ID_PREFIX,
  CUSTOM_VILLAIN_FORMAT,
  type CustomVillain,
  type CustomCard,
} from '../../data/customVillain'
import type { CardType } from '../../data/types'

/** Un vilain trouvé dans le classeur, prêt à importer. */
export interface ExcelVillain {
  name: string
  cardCount: number
  villain: CustomVillain
}

const COL = { copies: 0, vo: 1, fr: 2, cost: 3, strength: 4, text: 5, type: 6, activate: 7, activateCost: 8, deck: 10, symbol: 11 }

/** Symbole d'action Excel → jeton inline de l'Atelier. */
const SYMBOL_TOKEN: Record<string, string> = {
  activate: 'activer',
  playcard: 'jouer',
  play: 'jouer',
  move: 'deplacer',
  moveheld: 'deplacer',
  movehero: 'deplacer-hero',
  vanquish: 'vaincre',
  power: 'pouvoir',
  fate: 'fatalite',
  discard: 'defausser',
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim()
}
function intOrU(v: unknown): number | undefined {
  const s = str(v).replace(/^\+/, '')
  if (!s) return undefined
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

/** Type FR (colonne G) → catégorie moteur + libellé affiché si type inédit. */
function mapType(g: string): { type: CardType; typeLabel?: string } {
  const t = g.toLowerCase()
  if (/alli[ée]/.test(t)) return { type: 'ally' }
  if (/objet/.test(t)) return { type: 'item' }
  if (/[ée]v[ée]nement/.test(t)) return { type: 'effect' }
  if (/condition/.test(t)) return { type: 'condition' }
  if (/h[ée]ros/.test(t)) return { type: 'hero' }
  if (/mal[ée]diction/.test(t)) return { type: 'curse' }
  if (/ingr[ée]dient/.test(t)) return { type: 'ingredient' }
  if (/stand/.test(t)) return { type: 'ally', typeLabel: g }
  if (/piratage/.test(t)) return { type: 'effect', typeLabel: g }
  return g ? { type: 'effect', typeLabel: g } : { type: 'effect' }
}

/** Construit le texte de carte (effet + activation + symbole d'action inline). */
function buildText(row: unknown[]): string {
  const f = str(row[COL.text])
  const h = str(row[COL.activate])
  const cost = str(row[COL.activateCost])
  const token = SYMBOL_TOKEN[str(row[COL.symbol]).toLowerCase()]
  let text = f
  if (token === 'pouvoir') {
    text = (text ? text + ' ' : '') + '[pouvoir]'
  } else if (token && h) {
    text = (text ? text + '\n' : '') + `[${token}] ${h}`
  } else if (token) {
    text = (text ? text + '\n' : '') + `[${token}]`
  } else if (h) {
    text = (text ? text + '\n' : '') + h
  }
  if (cost) text = (text ? text + '\n' : '') + `(${cost})`
  return text
}

function parseCards(dataRows: unknown[][], villainSlug: string): CustomCard[] {
  const cards: CustomCard[] = []
  const used = new Set<string>()
  for (const row of dataRows) {
    const name = str(row[COL.fr]) || str(row[COL.vo])
    if (!name) continue
    const deck = /^(1|fate)/i.test(str(row[COL.deck])) ? 'fate' : 'villain'
    const { type, typeLabel } = mapType(str(row[COL.type]))
    const cost = deck === 'villain' ? intOrU(row[COL.cost]) : undefined
    const strength = intOrU(row[COL.strength])
    const base = `${CUSTOM_ID_PREFIX}${villainSlug}-${slugify(name)}`
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    const card: CustomCard = {
      id,
      name: name.toUpperCase(), // nom de carte TOUJOURS en majuscules, quel que soit l'Excel
      englishName: str(row[COL.vo]),
      deck,
      type,
      copies: intOrU(row[COL.copies]) ?? 1,
      text: buildText(row),
      image: '',
      artTransform: { scale: 1, offsetXPct: 0, offsetYPct: 0 },
    }
    if (cost !== undefined) card.cost = cost
    if (strength !== undefined) card.strength = strength
    if (typeLabel) card.typeLabel = typeLabel
    cards.push(card)
  }
  return cards
}

function buildVillain(name: string, cards: CustomCard[], now: string): CustomVillain {
  return {
    formatVersion: CUSTOM_VILLAIN_FORMAT,
    id: `${CUSTOM_ID_PREFIX}${slugify(name)}`,
    name,
    stars: 3,
    color: '#5a2d6b',
    pawnHeightPx: 56,
    boardObjective: '',
    objectiveDescription: '',
    objective: { type: 'POWER_THRESHOLD', threshold: 20 },
    locations: [0, 1, 2, 3].map(emptyLocation),
    cards,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Lit un classeur Excel (template Villainous) et renvoie un vilain importable par
 * feuille. `now` est injecté (le composant fournit la date).
 */
export async function parseExcelVillains(file: File, now: string): Promise<ExcelVillain[]> {
  const XLSX = await import('xlsx')
  // .ods : on lit le fichier ENTIÈREMENT (LibreOffice déclare une plage correcte).
  // .xlsx : ces templates déclarent une plage géante (A1:…1048178) qui ferait
  // exploser sheet_to_json → on borne la lecture (400 lignes suffisent largement).
  const isOds = /\.ods$/i.test(file.name)
  const wb = XLSX.read(await file.arrayBuffer(), isOds ? { type: 'array' } : { type: 'array', sheetRows: 400 })
  const out: ExcelVillain[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })
    if (rows.length < 3) continue
    // Garde-fou : la 2e colonne d'en-tête doit ressembler au template.
    // Garde-fou tolérant : en-têtes variables selon l'auteur (anglais ou français).
    // « Card count » en colonne A est commun aux deux templates (Alexis / Jules).
    const head = rows[0] ?? []
    const isTemplate =
      /card count/i.test(str(head[COL.copies])) ||
      /card name|nom carte/i.test(str(head[COL.fr])) ||
      /card name|nom fichier/i.test(str(head[COL.vo]))
    if (!isTemplate) continue
    // Nom du vilain : cellule A2 si elle ressemble à un nom, sinon le nom de feuille
    // (nettoyé des underscores).
    const a2 = str(rows[1]?.[0])
    const villainName = a2 && !/^\d+$/.test(a2) ? a2 : sheetName.replace(/_/g, ' ').trim()
    const cards = parseCards(rows.slice(2), slugify(villainName))
    if (cards.length === 0) continue
    out.push({ name: villainName, cardCount: cards.length, villain: buildVillain(villainName, cards, now) })
  }
  return out
}
