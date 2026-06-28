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

/** Disposition LIBRE du texte de règle sur la carte. Coordonnées en % du gabarit
 *  (x/y = centre du bloc, w = largeur du bloc), `size` en px (espace carte
 *  1440×2044). Absent = disposition par défaut (bloc bas centré, taille auto-ajustée). */
export interface TextLayout {
  x: number
  y: number
  w: number
  size: number
}

/** Disposition du texte par défaut (reprend l'ancienne boîte basse centrée). */
export const DEFAULT_TEXT_LAYOUT: TextLayout = { x: 50, y: 80, w: 79, size: 50 }

/** Une zone de texte SUPPLÉMENTAIRE posée librement sur la carte (en plus du texte
 *  principal). Coordonnées en % (x/y = centre, w = largeur), `size` en px carte. */
export interface TextBox {
  id: string
  text: string
  x: number
  y: number
  w: number
  size: number
}

/** Un symbole d'action posé LIBREMENT sur la carte (élément indépendant des jetons
 *  inline). `x`/`y` = centre en % de la carte ; `size` = côté en % de la largeur. */
export interface CardSticker {
  id: string
  type: LocationActionType
  x: number
  y: number
  size: number
}

/** Taille par défaut d'un symbole posé (en % de la largeur de carte). */
export const DEFAULT_STICKER_SIZE = 14

/** Image d'ornement importée, superposée au DOS des cartes (Vilain ET Fatalité),
 *  déplaçable et redimensionnable. `x`/`y` = centre en % du dos ; `size` = largeur en
 *  % de la largeur du dos ; `aspect` = hauteur/largeur de l'image (pour le ratio). */
export interface BackOverlay {
  id: string
  image: string
  x: number
  y: number
  size: number
  aspect: number
}

/** Une carte, côté éditeur : une CardDef enrichie des champs de travail (l'illustration
 *  brute uploadée + son cadrage) que l'éditeur conserve pour pouvoir re-générer l'image
 *  finale. `image` (héritée de CardDef) contient l'image de carte BAKÉE (dataURL). */
export interface CustomCard extends CardDef {
  /** Illustration brute fournie par l'utilisateur (dataURL), avant compositing. */
  artImage?: string
  /** Cadrage de l'illustration dans la zone art de la carte. */
  artTransform?: ArtTransform
  /** Paquet PERSONNALISÉ d'appartenance (nom dans `CustomVillain.extraDecks`). Absent =
   *  carte du paquet Vilain/Fatalité standard (`deck`). Les cartes d'un paquet perso sont
   *  hors-deck (exclues du 30/15 et du mélange) ; `deck` ne sert plus qu'au style visuel. */
  group?: string
  /** Libellé du TYPE affiché sur la carte (ex. « Piratage »). Absent = libellé par
   *  défaut du type mécanique. Le type mécanique (`type`) reste utilisé par le moteur. */
  typeLabel?: string
  /** Couleur du libellé de type. Absent = couleur par défaut du type. */
  typeColor?: string
  /** Disposition libre du texte de règle (position/largeur/taille). Absent = défaut. */
  textLayout?: TextLayout
  /** Zones de texte supplémentaires posées librement (en plus du texte principal). */
  textBoxes?: TextBox[]
  /** Symboles d'action posés librement sur la carte. */
  stickers?: CardSticker[]
}

/** Un vilain personnalisé complet. */
export interface CustomVillain {
  formatVersion: number
  /** Id interne stable (`custom-<slug>`), sert de VillainId et de clé de stockage. */
  id: string
  /** Nom affiché. */
  name: string
  /** Difficulté affichée (1–5 étoiles). Cosmétique. */
  stars: number

  // --- Couleurs --------------------------------------------------------------
  /** Couleur thématique : cases du méchant, panneau + dos des cartes Vilain. */
  color: string

  // --- Images (dataURL) ------------------------------------------------------
  /** Portrait carré du vilain (éventuellement déjà encadré via l'Éditeur de portrait). */
  portrait?: string
  /** Portrait BRUT (sans cadre) conservé pour ré-encadrer proprement sans empiler les
   *  cadres. Absent tant qu'aucun encadrement n'a été appliqué (le brut = `portrait`). */
  portraitRaw?: string
  /** Illustration de présentation (corps entier). */
  presentation?: string
  /** Illustration du vilain affichée sur le PLATEAU (panneau de gauche). Choisie et
   *  cadrée indépendamment du portrait/présentation (façon image de lieu). */
  boardArt?: string
  /** Cadrage de l'illustration du plateau (boardArt) : left/right + top/bottom + zoom.
   *  Défaut : centré. */
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
  /** Ornements importés superposés au dos des cartes (déplaçables/redimensionnables). */
  backOverlays?: BackOverlay[]

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
  /** Paquets PERSONNALISÉS hors Vilain/Fatalité (ex. « Transformation », « Stands »,
   *  « Maui »). Pools « hors-deck » : non mélangés au jeu, mécaniques codées à la main. */
  extraDecks?: string[]

  // --- Publication (« Terminer ») --------------------------------------------
  /** Vrai une fois le vilain « Terminé » : il rejoint alors la liste/le choix des
   *  vilains et se joue comme un vilain natif. Faux/absent = brouillon (Atelier seul). */
  published?: boolean
  /** Nom du créateur (saisi à la publication) — affiché sur sa fiche. */
  creator?: string
  /** Catégorie d'origine choisie à la publication (sections Disney / Collaborations). */
  origin?: VillainOrigin

  // --- Métadonnées -----------------------------------------------------------
  createdAt: string
  updatedAt: string
}

/** Catégorie d'origine d'un vilain publié (miroir des sections de la liste). */
export type VillainOrigin = 'Disney' | 'Collaborations'

/** Tailles de deck imposées (comme les vilains officiels) : la planche doit être
 *  pleine pour pouvoir tester/exporter le vilain. */
export const VILLAIN_DECK_SIZE = 30
export const FATE_DECK_SIZE = 15

/** Total d'exemplaires par paquet STANDARD (somme des `copies`). Les cartes des
 *  paquets personnalisés (`group`) sont hors-deck et ne comptent pas ici. */
export function deckCounts(v: CustomVillain): { villain: number; fate: number } {
  let villain = 0
  let fate = 0
  for (const c of v.cards) {
    if (c.group) continue
    const n = c.copies ?? 0
    if (c.deck === 'fate') fate += n
    else villain += n
  }
  return { villain, fate }
}

/** La planche est-elle complète (30 cartes Vilain + 15 Fatalité) ? */
export function isDeckComplete(v: CustomVillain): boolean {
  const c = deckCounts(v)
  return c.villain === VILLAIN_DECK_SIZE && c.fate === FATE_DECK_SIZE
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
    delete def.group
    delete def.typeLabel
    delete def.typeColor
    delete def.textLayout
    delete def.textBoxes
    delete def.stickers
    return def
  })
}
