// =============================================================================
// Vilains PERSONNALISÉS (créés par le joueur via l'éditeur intégré).
//
// Un CustomVillain est un bundle 100 % SÉRIALISABLE (que des données + des images
// en dataURL) : il vit en IndexedDB, s'exporte/s'importe en .json, et se convertit
// en VillainDef + CardDef[] pour être joué exactement comme un vilain « natif ».
//
// CONTRAINTE : ce fichier reste de la DONNÉE (data/). Il n'importe que des TYPES du
// moteur. La conversion vers les objets de jeu se fait via `toVillainDef` /
// `toCardDefs`, consommés côté UI / store au lancement d'une partie.
// =============================================================================

import type { ObjectiveDef, VillainDef, ActionRow, LocationActionType } from '../engine/types'
import type { CardDef, CardType, DeckKind } from './types'

/** Version du format de sérialisation (incrémentée si le schéma évolue → migrations). */
export const CUSTOM_VILLAIN_FORMAT = 1

/** Préfixe d'id réservé aux vilains personnalisés (évite toute collision avec les
 *  slugs natifs et permet de les reconnaître partout : `custom-<slug>`). */
export const CUSTOM_ID_PREFIX = 'custom-'

/** Dimensions de référence d'une carte (calquées sur les gabarits du générateur). */
export const CARD_W = 1440
export const CARD_H = 2044

/** Couleur du panneau ET du dos des cartes Fatalité : toujours blanc (parchemin
 *  d'origine — le tint en multiply ne modifie alors pas le gabarit). */
export const FATE_CARD_COLOR = '#ffffff'

/** Une action de lieu, côté éditeur (miroir de LocationAction sans `grantedBy`,
 *  qui est un concept runtime). */
export interface CustomAction {
  id: string
  type: LocationActionType
  label: string
  row: ActionRow
  /** Montant de pouvoir gagné (actions GAIN_POWER uniquement). */
  amount?: number
}

/** Position de cadrage d'une image « cover » dans sa zone (façon object-position) :
 *  x/y en % (0 = bord gauche/haut, 50 = centre, 100 = bord droit/bas) + zoom
 *  (1 = remplit la zone en « cover », >1 = agrandi). */
export interface CropPos {
  x: number
  y: number
  /** Facteur de zoom (1 = cover). Optionnel : absent = 1. */
  zoom?: number
}

/** Cadrage par défaut : centré, sans zoom. */
export const CENTER_CROP: CropPos = { x: 50, y: 50, zoom: 1 }

/** Un lieu du plateau, côté éditeur. */
export interface CustomLocation {
  id: string
  name: string
  /** Image du lieu (dataURL) — illustration de fond de la colonne. Optionnelle. */
  image?: string
  /** Cadrage de l'image dans la colonne (left/right + top/bottom). Défaut : centré. */
  imagePos?: CropPos
  actions: CustomAction[]
}

/** Cadrage d'une illustration dans sa zone (recadrage « cover » ajustable). */
export interface ArtTransform {
  /** Échelle relative (1 = remplit la zone en cover). */
  scale: number
  /** Décalage horizontal en % de la zone (−50..50). */
  offsetXPct: number
  /** Décalage vertical en % de la zone. */
  offsetYPct: number
}

const DEFAULT_ART_TRANSFORM: ArtTransform = { scale: 1, offsetXPct: 0, offsetYPct: 0 }

/** Une carte, côté éditeur : une CardDef enrichie des champs de travail (l'illustration
 *  brute uploadée + son cadrage) que l'éditeur conserve pour pouvoir re-générer l'image
 *  finale. `image` (héritée de CardDef) contient l'image de carte BAKÉE (dataURL). */
export interface CustomCard extends CardDef {
  /** Illustration brute fournie par l'utilisateur (dataURL), avant compositing. */
  artImage?: string
  /** Cadrage de l'illustration dans la zone art de la carte. */
  artTransform?: ArtTransform
}

/** Un vilain personnalisé complet. */
export interface CustomVillain {
  formatVersion: number
  /** Id interne stable (`custom-<slug>`), sert de VillainId et de clé de stockage. */
  id: string
  /** Nom affiché. */
  name: string
  /** Difficulté affichée (1–6 étoiles). Cosmétique. */
  stars: number

  // --- Couleurs --------------------------------------------------------------
  /** Couleur thématique : cases du méchant, panneau + dos des cartes Vilain. */
  color: string

  // --- Images (dataURL) ------------------------------------------------------
  /** Portrait carré du vilain. */
  portrait?: string
  /** Illustration de présentation (corps entier). */
  presentation?: string
  /** Cadrage du portrait affiché sur le plateau (left/right + top/bottom). Défaut : centré. */
  portraitPos?: CropPos
  /** Image du plateau. */
  boardImage?: string
  /** Pion. */
  pawnImage?: string
  pawnHeightPx: number
  /** Dos de carte Vilain (bakée). */
  backVillainImage?: string
  /** Dos de carte Fatalité (bakée). */
  backFateImage?: string

  // --- Objectif --------------------------------------------------------------
  /** Texte d'objectif tel qu'« imprimé » sur le plateau. */
  boardObjective: string
  /** Description longue / stratégique. */
  objectiveDescription: string
  /** Condition de victoire jouable (sous-ensemble réutilisable des ObjectiveDef). */
  objective: ObjectiveDef

  // --- Contenu ---------------------------------------------------------------
  locations: CustomLocation[]
  cards: CustomCard[]

  // --- Métadonnées -----------------------------------------------------------
  createdAt: string
  updatedAt: string
}

/** Slugifie un nom en identifiant kebab-case ASCII (sans le préfixe custom-). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (diacritiques combinants)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'vilain'
}

/** Crée un id de lieu unique (`<index>` lisible : loc-1…). */
function newLocationId(index: number): string {
  return `loc-${index + 1}`
}

/** Un lieu vierge avec 4 actions par défaut (gabarit classique : Gagner / Jouer /
 *  Fatalité / Déplacer). */
export function emptyLocation(index: number): CustomLocation {
  const id = newLocationId(index)
  return {
    id,
    name: `LIEU ${index + 1}`,
    actions: [
      { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
      { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
      { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
    ],
  }
}

/** Construit un CustomVillain vierge prêt à éditer (4 lieux, aucune carte). */
export function emptyCustomVillain(now: string): CustomVillain {
  const slug = `${Date.now().toString(36)}`
  return {
    formatVersion: CUSTOM_VILLAIN_FORMAT,
    id: `${CUSTOM_ID_PREFIX}${slug}`,
    name: 'Nouveau vilain',
    stars: 3,
    color: '#5a2d6b',
    pawnHeightPx: 56,
    boardObjective: '',
    objectiveDescription: '',
    objective: { type: 'POWER_THRESHOLD', threshold: 20 },
    locations: [0, 1, 2, 3].map(emptyLocation),
    cards: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** Carte vierge (CardDef minimale) pour l'éditeur. */
export function emptyCustomCard(id: string, deck: DeckKind, type: CardType): CustomCard {
  return {
    id,
    name: 'Nouvelle carte',
    englishName: '',
    deck,
    type,
    copies: 1,
    text: '',
    image: '',
    artTransform: { ...DEFAULT_ART_TRANSFORM },
  }
}

// --- Conversion vers les objets de jeu --------------------------------------

/** Convertit un CustomVillain en VillainDef consommable par le moteur. Les images
 *  manquantes retombent sur un placeholder neutre pour ne jamais casser le rendu. */
export function toVillainDef(v: CustomVillain): VillainDef {
  return {
    id: v.id,
    name: v.name,
    objective: v.objective,
    objectiveDescription: v.objectiveDescription,
    boardObjective: v.boardObjective || undefined,
    boardImage: v.boardImage ?? '',
    pawnImage: v.pawnImage ?? '',
    pawnHeightPx: v.pawnHeightPx,
    backVillainImage: v.backVillainImage ?? '',
    backFateImage: v.backFateImage ?? '',
    locations: v.locations.map((l) => ({
      id: l.id,
      name: l.name,
      actions: l.actions.map((a) => ({
        id: a.id,
        type: a.type,
        label: a.label,
        row: a.row,
        amount: a.amount,
      })),
    })),
  }
}

/** Convertit les cartes d'un CustomVillain en CardDef[] (déjà compatibles : on en
 *  retire seulement les champs d'édition propres à l'éditeur). */
export function toCardDefs(v: CustomVillain): CardDef[] {
  return v.cards.map((c) => {
    const def: CustomCard = { ...c }
    delete def.artImage
    delete def.artTransform
    return def
  })
}
