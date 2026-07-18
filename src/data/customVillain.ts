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

/** Face ALTERNATIVE (« B ») d'un lieu TRANSFORMABLE : nom / image / actions de
 *  remplacement, activés en jeu par une carte (effet SWITCH_LOCATION_VERSION). Champs
 *  absents = identiques à la face A. `columnImage` = image de colonne bakée (par le
 *  bake) superposée en jeu quand la face B est active. */
export interface CustomLocationAlt {
  name?: string
  image?: string
  imagePos?: CropPos
  actions?: CustomAction[]
  columnImage?: string
}

/** Un lieu du plateau, côté éditeur. */
export interface CustomLocation {
  id: string
  name: string
  /** Image du lieu (dataURL) — illustration de fond de la colonne. Optionnelle. */
  image?: string
  /** Cadrage de l'image dans la colonne (left/right + top/bottom). Défaut : centré. */
  imagePos?: CropPos
  actions: CustomAction[]
  /** Face ALTERNATIVE (« B ») optionnelle : rend le lieu transformable par carte. */
  alt?: CustomLocationAlt
  /** Lieu VERROUILLÉ à la mise en place (voile + cadenas, actions/poses/déplacements
   *  bloqués tant qu'il n'est pas ouvert). Devient `lockedLocationsAtStart` dans le
   *  VillainDef ; un effet `UNLOCK_LOCATION` (porté par une carte) peut le rouvrir.
   *  Absent/false = lieu ouvert. */
  lockedAtStart?: boolean
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

/** Tailles de texte proposées par les boutons de l'éditeur (Petit / Standard). */
export const TEXT_SIZE_PRESETS = { small: 55, standard: 76 } as const

/** Disposition du texte d'une carte NEUVE : centré H (x=50), centré V (y=75, comme
 *  le bouton « Centrer V ») et taille Standard. (Le défaut historique bas/petit ne
 *  sert plus que de repli pour les cartes qui n'ont jamais reçu de disposition.) */
export const NEW_CARD_TEXT_LAYOUT: TextLayout = {
  x: 50,
  y: 75,
  w: DEFAULT_TEXT_LAYOUT.w,
  size: TEXT_SIZE_PRESETS.standard,
}

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
  /** Symbole « Gagner du pouvoir » (GAIN_POWER) : chiffre affiché sur le symbole
   *  (1, 2, 3…). Absent = aucun chiffre. Purement visuel (le montant de jeu de
   *  l'action est réglé à part dans l'onglet Plateau). */
  amount?: number
}

/** Taille par défaut d'un symbole posé (en % de la largeur de carte). */
export const DEFAULT_STICKER_SIZE = 20
/** Tailles proposées pour un symbole d'action posé (« Petit » / « Normal »). */
export const STICKER_SIZE_PRESETS = { small: 16, normal: DEFAULT_STICKER_SIZE } as const

/** Une FORME décorative (« layout ») posée LIBREMENT sur la carte — élément purement
 *  cosmétique, indépendant du texte et des symboles. `x`/`y` = centre en % de la carte ;
 *  `size` = diamètre/côté en % de la largeur ; `color` = couleur de remplissage. Pour
 *  l'instant un seul `kind` : `circle` (rond plein) — l'union est prête à en accueillir d'autres. */
export interface CardShape {
  id: string
  kind: 'circle'
  color: string
  x: number
  y: number
  size: number
}

/** Diamètre par défaut d'une forme posée (en % de la largeur de carte). */
export const DEFAULT_SHAPE_SIZE = 14
/** Tailles proposées pour une forme posée (« Petit » / « Normal »). */
export const SHAPE_SIZE_PRESETS = { small: 10, normal: DEFAULT_SHAPE_SIZE } as const

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
  /** Recoloration de CET ornement importé (teinte façon multiply, relief conservé). Absent =
   *  couleurs d'origine de l'image. */
  tint?: string
}

/** Source de la couleur de fond du 3e dos (paquets personnalisés) : reprendre la
 *  couleur du deck Vilain, celle de la Fatalité (parchemin clair), ou une couleur libre. */
export type ExtraBackColorMode = 'villain' | 'fate' | 'custom'

/** Configuration du DOS des cartes de paquet PERSONNALISÉ (3e dos), affiché seulement
 *  quand le vilain a au moins un paquet perso (`extraDecks`). Plus personnalisable que
 *  les dos Vilain/Fatalité : couleur au choix + recoloration des ornements dorés +
 *  ses propres ornements importés (indépendants des deux autres dos). */
export interface ExtraBack {
  /** Source de la couleur de fond. */
  colorMode: ExtraBackColorMode
  /** Couleur libre (utilisée si `colorMode === 'custom'`). */
  color?: string
  /** Couleur des ornements dorés (cadre + axe + libellé). Absent = or d'origine. */
  ornamentColor?: string
  /** Ornements importés propres à ce dos (indépendants des dos Vilain/Fatalité). */
  overlays?: BackOverlay[]
}

/** Configuration par défaut du 3e dos : reprend la couleur du deck Vilain. */
export const DEFAULT_EXTRA_BACK: ExtraBack = { colorMode: 'villain' }

/** Couleur de fond effective du 3e dos, d'après son mode et la couleur du vilain. */
export function extraBackColor(v: CustomVillain): string {
  const cfg = v.backExtra
  if (!cfg || cfg.colorMode === 'villain') return v.color
  if (cfg.colorMode === 'fate') return FATE_CARD_COLOR
  return cfg.color || v.color
}

/** Une couleur #rrggbb est-elle claire (luminance relative élevée) ? */
function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62
}

/** Le 3e dos doit-il être rendu en « parchemin » clair (mode Fatalité, ou couleur
 *  libre claire) plutôt qu'en ardoise sombre teintée ? */
export function extraBackPaper(v: CustomVillain): boolean {
  const cfg = v.backExtra
  if (!cfg) return false
  if (cfg.colorMode === 'fate') return true
  if (cfg.colorMode === 'custom') return isLightHex(cfg.color || v.color)
  return false
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
  /** Formes décoratives (« layouts », ex. rond plein) posées librement sur la carte. */
  shapes?: CardShape[]
  /** VARIANTE LIÉE (skin) : id de la carte de la BASE dont celle-ci est la copie. Sert à
   *  resynchroniser (retrouver la carte source) et à propager ses mécaniques. Absent = carte
   *  d'un vilain normal (non-variante). */
  baseCardId?: string
  /** VARIANTE LIÉE : true = cette carte DIFFÈRE de la base sur sa présentation (nom / texte /
   *  illustration…), donc la resynchro CONSERVE ces champs. Absent/false = carte « liée » qui
   *  suit intégralement la présentation de la base (seule la couleur de la variante la re-teinte). */
  variantOverride?: boolean
}

/** Un cadenas DÉCORATIF posé librement sur le plateau (en plus du cadenas centré
 *  automatique des lieux verrouillés). Purement cosmétique : baké dans l'image du
 *  plateau. `x`/`y` = centre en % du plateau ; `size` = largeur en % de la largeur
 *  du plateau (la hauteur suit le ratio de l'image). */
export interface BoardLock {
  id: string
  x: number
  y: number
  size: number
}

/** Taille par défaut d'un cadenas posé (en % de la largeur du plateau). */
export const DEFAULT_BOARD_LOCK_SIZE = 6

/** Notes stratégiques sur une carte Fatalité (du point de vue du bot). Toutes
 *  optionnelles : champs libres saisis dans l'onglet « Stratégie BOT » de l'Atelier.
 *  Purement documentaire pour l'instant (affichage + copie) ; à terme, source de
 *  consignes pour l'IA. */
export interface FateStrategyNote {
  /** Description générale de la carte / de son usage. */
  description?: string
  /** Conseil « En tant que joueur qui reçoit cette carte » (subir la Fatalité). */
  asReceiver?: string
  /** Conseil « En tant qu'adverse qui attaque » (infliger la Fatalité). */
  asAttacker?: string
}

/** Une SECTION de consignes (même structure pour les deux onglets stratégie) :
 *  un texte général + des notes par carte Vilain / Fatalité (indexées par `id`). */
export interface StrategySection {
  /** Texte général de la section (objectif / ligne de conduite du bot…). */
  general?: string
  /** Note par carte Vilain (clé = id de carte). */
  villainNotes?: Record<string, string>
  /** Note par carte Fatalité (clé = id de carte). */
  fateNotes?: Record<string, FateStrategyNote>
}

/** Consignes de STRATÉGIE pour le bot, saisies dans l'Atelier. Documentaire pour
 *  l'instant (on gère l'affichage + la copie) ; vouées à nourrir l'IA plus tard.
 *  Deux volets, un par onglet :
 *   - CODAGE CARTES (champs à plat, historiques) : comment chaque carte est codée ;
 *   - BOT ADVERSE (`botPlay`) : comment le bot adverse joue chaque carte. */
export interface BotStrategy {
  /** [Codage Cartes] Comment le bot atteint son objectif (texte libre). */
  howToWin?: string
  /** [Codage Cartes] Description par carte Vilain (clé = id de carte). */
  villainNotes?: Record<string, string>
  /** [Codage Cartes] Notes par carte Fatalité (clé = id de carte). */
  fateNotes?: Record<string, FateStrategyNote>
  /** [Bot adverse] Comment le bot adverse joue (texte général + notes par carte). */
  botPlay?: StrategySection
  /** [Journal] Message écrit dans le Journal de partie quand chaque carte est jouée
   *  (un seul texte par carte : la note Fatalité n'utilise que `description`). */
  journal?: StrategySection
}

/** Un vilain personnalisé complet. */
export interface CustomVillain {
  formatVersion: number
  /** Id interne stable (`custom-<slug>`), sert de VillainId et de clé de stockage. */
  id: string
  /** Nom affiché. */
  name: string
  /** Devise / réplique emblématique du vilain (courte citation d'ambiance). Cosmétique,
   *  affichée sur la fiche du vilain. Optionnelle. */
  devise?: string
  /** Difficulté affichée (1–5 étoiles). Cosmétique. */
  stars: number

  // --- Couleurs --------------------------------------------------------------
  /** Couleur thématique : cases du méchant, panneau + dos des cartes Vilain. */
  color: string
  /** Couleur du RECOUVREMENT des actions par un Héros (le voile posé sur la rangée du
   *  haut d'un lieu occupé). Absente = on retombe sur `color` (couleur du méchant).
   *  Éditée dans l'onglet Plateau (« Mode recouvrement »). Présentation pure. */
  coverColor?: string
  /** Mots-clés colorés du vilain : chaque mot du TEXTE des cartes correspondant à un
   *  `label` (insensible à la casse/aux accents, singulier/pluriel) est coloré à sa
   *  `color`, comme le sont les noms de type. S'applique à TOUTES les cartes du vilain. */
  keywordColors?: { label: string; color: string }[]

  // --- Images (dataURL) ------------------------------------------------------
  /** Portrait carré du vilain (éventuellement déjà encadré via l'Éditeur de portrait). */
  portrait?: string
  /** Portrait BRUT (sans cadre) conservé pour ré-encadrer proprement sans empiler les
   *  cadres. Absent tant qu'aucun encadrement n'a été appliqué (le brut = `portrait`). */
  portraitRaw?: string
  /** Cadrage du portrait carré (zoom + décalage gauche/droite/haut/bas) appliqué au BRUT
   *  lors de la (ré)génération du portrait via l'Éditeur de portrait. Conservé pour
   *  restaurer les curseurs à la réouverture. Défaut : centré, zoom 1. */
  portraitCrop?: CropPos
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
  /** Fichier audio du vilain (dataURL) — p. ex. thème musical / réplique. Écoutable
   *  depuis l'Atelier (onglet Identité). Optionnel. */
  audio?: string
  /** Gain (volume relatif) appliqué à la réplique `audio` à la lecture (1 = plein volume,
   *  <1 pour atténuer une devise trop forte). Défaut 1. */
  audioGain?: number
  /** Dos de carte Vilain (bakée). */
  backVillainImage?: string
  /** Dos de carte Fatalité (bakée). */
  backFateImage?: string
  /** Ornements importés superposés au dos des cartes (déplaçables/redimensionnables). */
  backOverlays?: BackOverlay[]
  /** Configuration du 3e dos (paquets personnalisés). Absent = pas de dos dédié
   *  (les cartes de paquet perso retombent sur le dos Vilain). */
  backExtra?: ExtraBack
  /** Dos de carte de paquet personnalisé (bakée). Renseigné par le bake quand
   *  `backExtra` existe et qu'au moins un paquet perso est défini. */
  backExtraImage?: string

  // --- Objectif --------------------------------------------------------------
  /** Texte d'objectif tel qu'« imprimé » sur le plateau. */
  boardObjective: string
  /** Décalage vertical du texte d'objectif sur le plateau, en px (espace plateau
   *  1248 de haut) : négatif = vers le haut, positif = vers le bas. Défaut 0. */
  objectiveTextOffsetY?: number
  /** Description longue / stratégique. */
  objectiveDescription: string
  /** Condition de victoire jouable (sous-ensemble réutilisable des ObjectiveDef). */
  objective: ObjectiveDef

  // --- Contenu ---------------------------------------------------------------
  locations: CustomLocation[]
  /** Cadenas décoratifs posés librement sur le plateau (cosmétique, baké dans
   *  l'image du plateau). Absent = aucun. */
  boardLocks?: BoardLock[]
  /** Objectif ALTERNATIF (« face B ») activable par une carte (effet SWITCH_OBJECTIVE) :
   *  image du vilain + texte + condition de victoire de remplacement (façon Ratigan).
   *  Absent = objectif unique. */
  altObjective?: {
    boardObjective: string
    objectiveDescription: string
    objective: ObjectiveDef
    boardArt?: string
    portraitPos?: CropPos
  }
  /** Image de plateau ALTERNATIVE bakée (face B de l'objectif). Renseignée par le bake
   *  quand `altObjective` existe ; échangée avec `boardImage` à la bascule en jeu. */
  altBoardImage?: string
  cards: CustomCard[]
  /** Paquets PERSONNALISÉS hors Vilain/Fatalité (ex. « Transformation », « Stands »,
   *  « Maui »). Pools « hors-deck » : non mélangés au jeu, mécaniques codées à la main. */
  extraDecks?: string[]
  /** Consignes de stratégie pour le bot (onglet « Stratégie BOT »). Documentaire. */
  botStrategy?: BotStrategy

  // --- Publication (« Terminer ») --------------------------------------------
  /** Vrai une fois le vilain « Terminé » : il rejoint alors la liste/le choix des
   *  vilains et se joue comme un vilain natif. Faux/absent = brouillon (Atelier seul). */
  published?: boolean
  /** Nom du créateur (saisi à la publication) — affiché sur sa fiche. */
  creator?: string
  /** Catégorie d'origine choisie à la publication (sections Disney / Collaborations). */
  origin?: VillainOrigin
  /** Vilain FOURNI DIRECTEMENT (données+images données à Claude Code, PAS construit dans
   *  l'Atelier) : il se joue comme un vilain natif/Disney mais N'APPARAÎT PAS dans la liste
   *  éditable de l'Atelier (non modifiable là-bas). Reste un CustomVillain data-driven.
   *  Ex. Ultron. Dio/Gul'dan (créés dans l'Atelier) n'ont pas ce marqueur. */
  atelierHidden?: boolean

  // --- Variante liée (skin) --------------------------------------------------
  /** VARIANTE LIÉE : id du vilain de BASE dont ce vilain est une variante « skin ». La base
   *  reste la SOURCE UNIQUE des mécaniques/structure ; cette variante n'en diffère que par la
   *  PRÉSENTATION (couleur, nom, devise, portrait, présentation, art de plateau, pion, audio,
   *  noms+images des lieux, et une sélection de cartes re-illustrées/re-textées). Absent = vilain
   *  autonome. `syncVariantFromBase` recompose cette variante depuis sa base. */
  variantOf?: string
  /** VARIANTE LIÉE : `updatedAt` de la base au moment de la dernière resynchro. Sert à détecter
   *  qu'une base a évolué depuis (→ proposer / déclencher une resynchro). */
  variantBaseStamp?: string

  // --- Métadonnées -----------------------------------------------------------
  createdAt: string
  updatedAt: string
}

/** Catégorie d'origine d'un vilain publié (miroir des sections de la liste). */
export type VillainOrigin = 'Disney' | 'Marvel' | 'Collaborations'

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

/** Le vilain a-t-il été DÉVELOPPÉ ? Sert à débloquer les onglets stratégie (préremplis
 *  depuis `botStrategy`). Vrai si :
 *   - il est PUBLIÉ (un vilain publié est forcément complet et jouable) ; OU
 *   - au moins une carte porte un comportement encodé en donnée (`effects` / `onPlace` /
 *     `onVanquish` / `activatedEffects`).
 *  Certains vilains ont leur logique branchée dans le moteur par `cardId` (pas de champ
 *  sur les cartes) : le critère « publié » les couvre. */
export function isVillainDeveloped(v: CustomVillain): boolean {
  if (v.published) return true
  return v.cards.some(
    (c) =>
      (c.effects?.length ?? 0) > 0 ||
      (c.onPlace?.length ?? 0) > 0 ||
      (c.onVanquish?.length ?? 0) > 0 ||
      (c.activatedEffects?.length ?? 0) > 0,
  )
}

/** Applique les MIGRATIONS de schéma d'un CustomVillain brut (chargé depuis IndexedDB, le
 *  disque de secours ou l'embarqué) jusqu'à `CUSTOM_VILLAIN_FORMAT`. C'est LE point unique
 *  où un nouveau champ reçoit sa valeur par défaut sur les vilains anciens (« ajouter une
 *  donnée à l'ensemble des vilains, dont ceux de l'Atelier »), ou un champ est renommé.
 *
 *  Chaque palier `N → N+1` est une étape isolée et idempotente. À ce jour : format 1, aucun
 *  palier — seule la normalisation du `formatVersion` s'applique. Quand tu fais évoluer le
 *  schéma : incrémente `CUSTOM_VILLAIN_FORMAT`, ajoute un bloc `if` ci-dessous, ex. :
 *    if ((v.formatVersion ?? 0) < 2) {
 *      v = { ...v, monNouveauChamp: v.monNouveauChamp ?? DEFAUT, formatVersion: 2 }
 *    }
 */
export function migrateCustomVillain(raw: CustomVillain): CustomVillain {
  let v = raw

  // … futurs paliers de migration ici (du plus ancien au plus récent) …

  // Normalisation finale : garantit un formatVersion à jour (les paliers l'ont déjà bumpé ;
  // ce filet couvre un objet sans formatVersion ou déjà à jour sans copie inutile).
  if (v.formatVersion !== CUSTOM_VILLAIN_FORMAT) v = { ...v, formatVersion: CUSTOM_VILLAIN_FORMAT }
  return v
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
    textLayout: { ...NEW_CARD_TEXT_LAYOUT },
  }
}

// --- Conversion vers les objets de jeu --------------------------------------

/** Convertit un CustomVillain en VillainDef consommable par le moteur. Les images
 *  manquantes retombent sur un placeholder neutre pour ne jamais casser le rendu. */
export function toVillainDef(v: CustomVillain): VillainDef {
  const lockedAtStart = v.locations.filter((l) => l.lockedAtStart).map((l) => l.id)
  return {
    id: v.id,
    name: v.name,
    lockedLocationsAtStart: lockedAtStart.length > 0 ? lockedAtStart : undefined,
    objective: v.objective,
    objectiveDescription: v.objectiveDescription,
    boardObjective: v.boardObjective || undefined,
    boardImage: v.boardImage ?? '',
    pawnImage: v.pawnImage ?? '',
    pawnHeightPx: v.pawnHeightPx,
    backVillainImage: v.backVillainImage ?? '',
    backFateImage: v.backFateImage ?? '',
    backExtraImage: v.backExtraImage || undefined,
    altObjective: v.altObjective
      ? {
          objective: v.altObjective.objective,
          objectiveDescription: v.altObjective.objectiveDescription,
          boardImage: v.altBoardImage,
        }
      : undefined,
    locations: v.locations.map((l) => {
      const mapActions = (as: CustomAction[]) =>
        as.map((a) => ({ id: a.id, type: a.type, label: a.label, row: a.row, amount: a.amount }))
      const base = { id: l.id, name: l.name, actions: mapActions(l.actions) }
      // Lieu TRANSFORMABLE : on embarque la face B (name/actions de remplacement) ;
      // la face A reste active au départ (version 'a').
      if (l.alt) {
        return {
          ...base,
          altName: l.alt.name || l.name,
          altActions: mapActions(l.alt.actions ?? l.actions),
          version: 'a' as const,
          bColumnImage: l.alt.columnImage,
        }
      }
      return base
    }),
  }
}

/** Une valeur est-elle une image/audio embarquée (dataURL) non vide ? */
function isDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('data:')
}

/** Champs IMAGE/AUDIO « lourds » d'un CustomVillain, potentiellement ABSENTS d'une copie
 *  allégée (le JSON publié compressé retire notamment les sources brutes `boardArt`/
 *  `portraitRaw`, et une compression peut alléger d'autres visuels). */
const VILLAIN_MEDIA_KEYS: (keyof CustomVillain)[] = [
  'portrait', 'portraitRaw', 'presentation', 'boardArt', 'boardImage', 'altBoardImage',
  'pawnImage', 'audio', 'backVillainImage', 'backFateImage', 'backExtraImage',
]
/** Champs IMAGE d'une carte — dont l'illustration SOURCE brute `artImage` (retirée des
 *  bundles publiés) et l'image bakée `image`. */
const CARD_MEDIA_KEYS: (keyof CustomCard)[] = ['artImage', 'image']

/** Reprend, dans une version ENTRANTE adoptée (plus récente), les images que la version
 *  PRÉCÉDENTE possédait et que l'entrante n'a PAS (dataURL manquante/vide). Empêche qu'une
 *  copie plus récente mais ALLÉGÉE (ex. JSON publié sans art brut) n'ÉCRASE et ne détruise
 *  l'art éditable local. Ne clone (et ne modifie) que si au moins un champ est repris — sinon
 *  renvoie l'objet entrant tel quel (préserve l'identité de référence, utile aux tests). */
function preserveMedia(incoming: CustomVillain, prev: CustomVillain | undefined): CustomVillain {
  if (!prev) return incoming
  let out = incoming
  const ensureClone = () => { if (out === incoming) out = structuredClone(incoming) }
  for (const k of VILLAIN_MEDIA_KEYS) {
    if (!isDataUrl(incoming[k]) && isDataUrl(prev[k])) {
      ensureClone()
      ;(out as unknown as Record<string, unknown>)[k] = prev[k]
    }
  }
  if (Array.isArray(incoming.cards) && Array.isArray(prev.cards)) {
    const prevById = new Map(prev.cards.map((c) => [c.id, c]))
    for (let i = 0; i < incoming.cards.length; i++) {
      const pc = prevById.get(incoming.cards[i].id)
      if (!pc) continue
      for (const k of CARD_MEDIA_KEYS) {
        if (!isDataUrl(incoming.cards[i][k]) && isDataUrl(pc[k])) {
          ensureClone()
          ;(out.cards[i] as unknown as Record<string, unknown>)[k] = pc[k]
          // L'art brut va de pair avec son cadrage : reprends aussi artTransform si absent.
          if (k === 'artImage' && !out.cards[i].artTransform && pc.artTransform) {
            out.cards[i].artTransform = pc.artTransform
          }
        }
      }
    }
  }
  return out
}

/** Fusionne les 3 origines possibles d'un vilain custom — IndexedDB (éditions locales de
 *  ce navigateur), brouillon disque (`src/data/drafts`, filet de sécurité) et embarqué
 *  (`src/data/published`, committé) — par id, en gardant la version la PLUS RÉCENTE
 *  (`updatedAt`). Cela fait reprendre une édition faite HORS navigateur (p. ex. Claude Code
 *  qui écrit le brouillon disque ou le JSON publié en bumpant `updatedAt`), sans laquelle
 *  l'IndexedDB masquerait toute modification de fichier. Règles :
 *   - à `updatedAt` égal, l'existant est conservé (priorité IndexedDB > disque > embarqué) ;
 *   - un id présent UNIQUEMENT dans l'embarqué est adopté mais NON persisté (runtime seul,
 *     comme avant — il se recharge du bundle et suit les mises à jour de l'app) ;
 *   - un brouillon disque d'un id absent de l'IndexedDB, ou une version disque/embarquée
 *     STRICTEMENT plus récente, est adopté ET marqué à (re)persister en IndexedDB pour
 *     redevenir éditable sur cette origine ;
 *   - PROTECTION ANTI-PERTE : quand une version plus récente mais ALLÉGÉE remplace une plus
 *     riche, ses images manquantes (art brut des cartes, `boardArt`, `portraitRaw`…) sont
 *     REPRISES de la version remplacée (cf. `preserveMedia`) — un bundle compressé ne peut
 *     donc plus détruire l'art éditable local.
 *  Renvoie la liste fusionnée (triée du plus récent au plus ancien) + les vilains à persister. */
export function pickFreshestVillains(
  local: CustomVillain[],
  restored: CustomVillain[],
  bundled: CustomVillain[],
): { villains: CustomVillain[]; toPersist: CustomVillain[] } {
  const localById = new Map(local.map((v) => [v.id, v]))
  const newer = (a: CustomVillain, b: CustomVillain): boolean =>
    (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') > 0
  const chosen = new Map<string, CustomVillain>(localById)
  const persistIds = new Set<string>()
  for (const v of restored) {
    const cur = chosen.get(v.id)
    if (!cur || newer(v, cur)) {
      chosen.set(v.id, preserveMedia(v, cur))
      persistIds.add(v.id)
    }
  }
  for (const v of bundled) {
    const cur = chosen.get(v.id)
    if (!cur) {
      chosen.set(v.id, v) // embarqué seul → runtime, non persisté
      continue
    }
    if (newer(v, cur)) {
      chosen.set(v.id, preserveMedia(v, cur))
      persistIds.add(v.id)
    }
  }
  const villains = [...chosen.values()].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  )
  // Ne persiste que ce qui n'est PAS déjà la copie IndexedDB de départ.
  const toPersist = [...persistIds]
    .filter((id) => chosen.get(id) !== localById.get(id))
    .map((id) => chosen.get(id)!)
  return { villains, toPersist }
}

/** Reimporte les DONNEES DE JEU d'un JSON allege (developpe hors app, p. ex. par Claude
 *  Code sur assets/custom-exports/id.json) dans un vilain existant, en CONSERVANT ses
 *  IMAGES et ses metadonnees (published / dev IA / dates). Fusionne l'objectif (+ textes),
 *  les lieux (nom + actions, images gardees) et les cartes PAR ID (tous les champs de jeu,
 *  images gardees). L'appelant bumpe updatedAt en sauvegardant. */
export function mergeGameData(target: CustomVillain, light: Partial<CustomVillain>): CustomVillain {
  const out: CustomVillain = structuredClone(target)
  if (light.objective) out.objective = light.objective
  if (typeof light.boardObjective === 'string') out.boardObjective = light.boardObjective
  if (typeof light.objectiveDescription === 'string') out.objectiveDescription = light.objectiveDescription
  if (light.altObjective && out.altObjective) {
    if (light.altObjective.objective) out.altObjective.objective = light.altObjective.objective
    if (typeof light.altObjective.boardObjective === 'string') out.altObjective.boardObjective = light.altObjective.boardObjective
    if (typeof light.altObjective.objectiveDescription === 'string')
      out.altObjective.objectiveDescription = light.altObjective.objectiveDescription
  }
  if (Array.isArray(light.locations)) {
    const byId = new Map(out.locations.map((l) => [l.id, l]))
    for (const ll of light.locations) {
      const tl = byId.get(ll.id)
      if (!tl) continue
      if (typeof ll.name === 'string') tl.name = ll.name
      if (Array.isArray(ll.actions)) tl.actions = ll.actions
      tl.lockedAtStart = ll.lockedAtStart
      if (ll.alt && tl.alt) {
        if (typeof ll.alt.name === 'string') tl.alt.name = ll.alt.name
        if (Array.isArray(ll.alt.actions)) tl.alt.actions = ll.alt.actions
      }
    }
  }
  if (Array.isArray(light.cards)) {
    const byId = new Map(out.cards.map((c) => [c.id, c]))
    for (const lc of light.cards) {
      const tc = byId.get(lc.id)
      if (!tc) continue
      const copy = { ...lc } as Record<string, unknown>
      delete copy.image
      delete copy.artImage
      Object.assign(tc, copy)
    }
  }
  // Consignes de STRATÉGIE BOT rédigées par Claude Code (préremplissent l'onglet).
  if (light.botStrategy) out.botStrategy = light.botStrategy
  return out
}

// --- Variantes liées (« skins ») --------------------------------------------
//
// Une VARIANTE est un CustomVillain complet (matérialisé/baké → se branche tel quel sur tout
// le pipeline : registre, sélection, partie) qui reste LIÉ à une base : `syncVariantFromBase`
// recopie de la base toutes les MÉCANIQUES / la STRUCTURE et ne préserve que la PRÉSENTATION
// propre à la variante. Sens de sécurité : le DÉFAUT est « hériter de la base » (partagé) ;
// on énumère seulement ce que la variante possède EN PROPRE — ainsi un futur champ de RÈGLE
// se propage automatiquement (oublier de le partager serait une divergence silencieuse).

/** Champs de PRÉSENTATION d'un vilain que la variante possède en propre (le reste — objectif,
 *  actions, decks… — est hérité de la base). Inclut les DOS de cartes (ornements + images bakées) :
 *  la variante a sa propre couleur, donc ses propres dos et ses propres ornements. */
const VARIANT_OWN_VILLAIN_FIELDS = [
  'name', 'devise', 'color', 'coverColor', 'keywordColors',
  'portrait', 'portraitRaw', 'portraitCrop', 'presentation',
  'boardArt', 'portraitPos', 'boardImage', 'altBoardImage',
  'pawnImage', 'pawnHeightPx', 'audio',
  // Dos de cartes : ornements importés + images bakées (re-générées à la couleur de la variante).
  'backOverlays', 'backVillainImage', 'backFateImage', 'backExtra', 'backExtraImage',
] as const satisfies readonly (keyof CustomVillain)[]

/** Champs de PRÉSENTATION d'une carte que la variante conserve quand la carte est « override »
 *  (le reste — type, coût, force, effets… — vient toujours de la base). */
const VARIANT_OWN_CARD_FIELDS = [
  'name', 'text', 'image', 'artImage', 'artTransform',
  'typeLabel', 'typeColor', 'textLayout', 'textBoxes', 'stickers', 'shapes',
] as const satisfies readonly (keyof CustomCard)[]

/** Id de carte d'une variante : dérivé de l'id de base + l'id de la variante (kebab-case ASCII,
 *  unique entre base et variante — le registre indexe par cardId). */
export function variantCardId(variantId: string, baseCardId: string): string {
  return `${baseCardId}--${variantId}`
}

/** Recompose une VARIANTE depuis sa BASE : part de la base (toutes ses mécaniques/structure)
 *  puis réapplique la présentation PROPRE à la variante (cosmétiques vilain, noms+images des
 *  lieux, présentation des cartes « override »). Idempotent. Renvoie un nouveau CustomVillain.
 *
 *  - Cartes : une par carte de BASE (source de vérité du CONTENU du deck). Chaque carte reçoit
 *    un id de variante (`variantCardId`) + `baseCardId`. Une carte « liée » (non-override) suit
 *    intégralement la présentation de la base ; une carte « override » conserve la sienne.
 *  - Lieux : structure (actions/verrou/existence de la face B) de la base ; nom + image repris de
 *    la variante s'ils y sont définis, sinon hérités — y compris pour la FACE B (nom/image/cadrage
 *    propres à la variante ; ses actions restent celles de la base).
 *  - Les IMAGES bakées (cartes re-teintées à la couleur de la variante, portrait…) sont produites
 *    à part par l'étape de « bake » côté UI : cette fonction ne fait que la fusion des DONNÉES. */
export function syncVariantFromBase(base: CustomVillain, variant: CustomVillain): CustomVillain {
  const out: CustomVillain = structuredClone(base)

  // Méta : identité / publication / dates restent celles de la variante.
  out.id = variant.id
  out.formatVersion = variant.formatVersion ?? base.formatVersion
  out.createdAt = variant.createdAt
  out.updatedAt = variant.updatedAt
  out.published = variant.published
  out.creator = variant.creator
  out.origin = variant.origin
  out.atelierHidden = variant.atelierHidden
  out.variantOf = base.id
  out.variantBaseStamp = base.updatedAt

  // Présentation vilain : la variante gagne quand le champ est défini chez elle.
  for (const k of VARIANT_OWN_VILLAIN_FIELDS) {
    const val = (variant as unknown as Record<string, unknown>)[k]
    if (val !== undefined) (out as unknown as Record<string, unknown>)[k] = structuredClone(val)
  }

  // Lieux : structure de la base, nom + image de la variante s'ils sont définis.
  const varLocById = new Map((variant.locations ?? []).map((l) => [l.id, l]))
  out.locations = base.locations.map((bl) => {
    const vl = varLocById.get(bl.id)
    const loc = structuredClone(bl)
    if (vl?.name !== undefined) loc.name = vl.name
    if (vl?.image !== undefined) loc.image = vl.image
    if (vl?.imagePos !== undefined) loc.imagePos = structuredClone(vl.imagePos)
    // Face B : la STRUCTURE (existence + actions) vient de la base ; la variante n'en possède que
    // la PRÉSENTATION (nom + image + cadrage), réappliquée ici comme pour la face A.
    if (loc.alt) {
      if (vl?.alt?.name !== undefined) loc.alt.name = vl.alt.name
      if (vl?.alt?.image !== undefined) loc.alt.image = vl.alt.image
      if (vl?.alt?.imagePos !== undefined) loc.alt.imagePos = structuredClone(vl.alt.imagePos)
    }
    return loc
  })

  // Cartes : une par carte de base ; présentation conservée pour les cartes « override ».
  const varByBaseId = new Map((variant.cards ?? []).map((c) => [c.baseCardId ?? c.id, c]))
  out.cards = base.cards.map((bc) => {
    const vc = varByBaseId.get(bc.id)
    const card = structuredClone(bc) as CustomCard
    card.id = vc?.id ?? variantCardId(variant.id, bc.id)
    card.baseCardId = bc.id
    card.variantOverride = vc?.variantOverride || undefined
    if (vc?.variantOverride) {
      for (const k of VARIANT_OWN_CARD_FIELDS) {
        const val = (vc as unknown as Record<string, unknown>)[k]
        if (val !== undefined) (card as unknown as Record<string, unknown>)[k] = structuredClone(val)
      }
    }
    return card
  })

  return out
}

/** Crée une VARIANTE liée VIERGE à partir d'une base : toutes les cartes « liées » (aucune
 *  override), cosmétiques initialement identiques à la base (à personnaliser ensuite dans
 *  l'Atelier). `id` doit être libre (préfixe custom-). */
export function createVariant(base: CustomVillain, id: string, name: string, now: string): CustomVillain {
  const seed: CustomVillain = {
    ...structuredClone(base),
    id,
    name,
    // Cartes vidées : la sync les régénère à partir de la base avec des ids de VARIANTE
    // (sinon le seed porterait les ids de base). Cosmétiques/lieux hérités via le clone.
    cards: [],
    variantOf: base.id,
    published: false,
    atelierHidden: false,
    creator: undefined,
    createdAt: now,
    updatedAt: now,
  }
  return syncVariantFromBase(base, seed)
}

/** État de synchronisation d'un vilain vis-à-vis d'une éventuelle base :
 *  - `independent` : ce n'est pas une variante (aucun `variantOf`) ;
 *  - `orphan` : c'est une variante mais sa base est introuvable (elle reste jouable telle
 *    quelle, mais ne peut plus être resynchronisée) ;
 *  - `stale` : la base a été modifiée depuis la dernière resynchro (`base.updatedAt` postérieur
 *    à `variantBaseStamp`) → une resynchro (données + rebake) est à proposer ;
 *  - `synced` : la variante est à jour avec sa base. */
export type VariantSyncState = 'independent' | 'orphan' | 'stale' | 'synced'

/** Calcule l'état de synchronisation d'un vilain donné, sa base étant fournie (ou non). */
export function variantSyncState(v: CustomVillain, base: CustomVillain | undefined): VariantSyncState {
  if (!v.variantOf) return 'independent'
  if (!base) return 'orphan'
  const stamp = v.variantBaseStamp ?? ''
  return (base.updatedAt ?? '').localeCompare(stamp) > 0 ? 'stale' : 'synced'
}

/** Retrouve la BASE d'une variante dans une liste de vilains (undefined si pas une variante,
 *  ou base absente). */
export function findVariantBase(v: CustomVillain, all: CustomVillain[]): CustomVillain | undefined {
  return v.variantOf ? all.find((x) => x.id === v.variantOf) : undefined
}

/** Toutes les variantes LIÉES à une base donnée (par `variantOf`). */
export function variantsOf(baseId: string, all: CustomVillain[]): CustomVillain[] {
  return all.filter((x) => x.variantOf === baseId)
}

/** Convertit les cartes d'un CustomVillain en CardDef[] (déjà compatibles : on en
 *  retire seulement les champs d'édition propres à l'éditeur). SEUL point de nettoyage
 *  des champs éditeur : toute conversion vers le jeu passe par ici. */
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
    delete def.shapes
    delete def.baseCardId
    delete def.variantOverride
    // Les Conditions sont GRATUITES (coût 0). L'éditeur n'expose pas de champ coût pour
    // elles et l'export omet parfois le `0` (sérialisé comme « vide ») : on le rétablit ici
    // pour garder un coût numérique cohérent (cf. intégrité : toute carte Méchant a un coût).
    if (def.deck === 'villain' && def.type === 'condition' && def.cost === undefined) {
      def.cost = 0
    }
    return def
  })
}

/** Cartes des paquets STANDARD (hors paquets personnalisés `group`) en CardDef[] propres
 *  (champs éditeur retirés), prêtes pour `buildDeckInstances`. On filtre les paquets perso
 *  AVANT le nettoyage (qui efface justement `group`). */
export function toDeckCardDefs(v: CustomVillain): CardDef[] {
  return toCardDefs({ ...v, cards: v.cards.filter((c) => !c.group) })
}
