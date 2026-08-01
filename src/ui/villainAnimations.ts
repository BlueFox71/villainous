import type { VillainKey } from './store/gameStore'

/** Décor animé d'arrière-plan propre à un vilain : un objet/personnage qui
 *  traverse lentement la bande haute de l'écran pendant la partie (purement
 *  décoratif). Data-driven, à la manière de `villainArt.ts` : ajouter un vilain
 *  = une entrée ici + l'image dans `public/animations/`. */
export interface VillainAnimation {
  /** Image dans `public/` (ex. `/animations/bateau_bowser.png`). */
  image?: string
  /** Vidéo en boucle dans `public/` (ex. `/animations/tic_tac.mp4`). Utilisée par la
   *  trajectoire `water-cross` : clip lu en boucle, défilant à l'écran. */
  video?: string
  /** Calque superposé exactement par-dessus `image` (même canevas). Utilisé par la
   *  trajectoire `voodoo` : les yeux des totems, qu'on fait briller (Dr Facilier). */
  overlayImage?: string
  /** Sprite sheet VERTICAL (frames empilées) dans `public/`. Utilisé par `fire-bottom` :
   *  l'animation est jouée image par image en CSS (`steps`). */
  sprite?: string
  /** Nombre de frames du `sprite` (pour le pas d'animation). */
  frames?: number
  /** Filtre CSS de teinte appliqué à l'effet (ex. `fire-bottom` : feu orange → bleu
   *  pour Hadès, → vert pour Scar). */
  tint?: string
  /** Variante : plusieurs images possibles ; une est tirée au hasard à chaque
   *  passage (ex. les 11 couleurs d'équipier éjecté de l'Imposteur). */
  images?: string[]
  /** Hauteur de l'élément en % de la hauteur d'écran (défaut 8 %). */
  heightPct?: number
  /** Position verticale du haut de l'élément, en % de la hauteur d'écran (trajectoires `water-cross`,
   *  défaut 2 %, et `cross`, défaut 1 %). Permet de remonter/descendre la traversée (ex. Davy Jones :
   *  le Kraken traverse au MILIEU de l'écran). */
  topPct?: number
  /** Durée d'une traversée complète, en secondes (défaut 30 s). */
  durationSec?: number
  /** L'image regarde-t-elle vers la GAUCHE au naturel ? Sert à orienter le
   *  vaisseau dans son sens de déplacement (défaut : regarde à droite). */
  facesLeft?: boolean
  /** Trajectoire `cross` : FORCE le sens de traversée quel que soit le camp (au lieu du défaut
   *  « joueur → droite, adversaire → gauche »). `'ltr'` = toujours de gauche à droite, `'rtl'` =
   *  toujours de droite à gauche. Utile pour un prop dont le sens fait partie de la mise en scène
   *  (ex. Kirby qui S'ÉCHAPPE vers la droite sur son étoile). */
  fixedDir?: 'ltr' | 'rtl'
  /** Trajectoire `cross` : laisse une TRAÎNÉE d'étoiles scintillantes DERRIÈRE le prop (côté
   *  opposé au déplacement), dégradées en taille/opacité — le sillage de l'étoile volante de Kirby. */
  starTrail?: boolean
  /** Trajectoire :
   *  - `cross` (défaut) : traversée linéaire (sens selon camp), bande haute par défaut ; `topPct`
 *    permet de descendre la traversée (ex. Davy Jones : le Kraken traverse au milieu de l'écran).
   *  - `sky-arc` : arrive par le milieu-gauche de l'écran et s'élève en arc pour
   *    sortir en haut à droite (≈ 3/4). Trajectoire relative à l'écran, variée à
   *    chaque passage (hauteur d'entrée, point de sortie, amplitude de l'arc).
   *  - `drift-spin` : dérive linéaire (vitesse constante) du haut-gauche vers le
   *    bas-droite, avec rotation lente de l'image (corps éjecté à la Among Us).
   *  - `pages` : pas de trajet ; les `images` apparaissent une à une en fondu à des
   *    endroits aléatoires (hors plateaux), décalées dans le temps (Slenderman).
   *  - `roses` : pas de trajet ; 8 à 12 copies de `image` apparaissent une à une à des
   *    endroits/orientations aléatoires (blanches), puis TOUTES rougissent ~4 s avant
   *    de disparaître en fondu (Reine de Cœur).
   *  - `coins` : pluie d'objets ; chaque objet (image tirée au hasard parmi `images`)
   *    tombe du haut vers le bas de l'écran en tournoyant, position/vitesse au hasard,
   *    sur toute la largeur. Nombre par défaut ~48-66, ou forcé via `count` (Prince
   *    Jean : pièces ; Méchante Reine : pommes empoisonnées).
   *  - `water-cross` : le clip `video` (en boucle, bords adoucis) traverse le HAUT de
   *    l'écran de gauche à droite (Capitaine Crochet : Tic-Tac et ses bulles).
   *  - `rise` : des copies de `image` (ou une teinte tirée parmi `images`) APPARAISSENT EN BAS
   *    de l'écran, montent jusqu'en haut en ondulant, en fondu aux deux extrémités ;
   *    taille/colonne/vitesse au hasard, sur toute la surface (Ursula : bulles). Densité
   *    réglable via `count`, répartition `sides` (deux côtés) ; réutilisable (Hadès : nuée
   *    d'âmes, Scar : braises, Dio : ses symboles de menace).
   *  - `voodoo` : `image` (totems) apparaît en fondu au-dessus du plateau du vilain
   *    (bas si joueur, haut si adversaire) ; `overlayImage` (les yeux) se superpose et
   *    brille fort en violet, puis tout s'assombrit en disparaissant (Dr Facilier).
   *  - `fire-bottom` : une rangée de flammes (sprite `sprite`/`frames` joué en boucle)
   *    apparaît en bas de l'écran sur toute la largeur, tailles/positions/phases au
   *    hasard, en fondu (Hadès, Scar).
   *  - `fade` : `image` apparaît en FONDU à un endroit au hasard, reste visible ~5 s,
   *    puis disparaît en fondu (en grandissant légèrement) — le Chat du Cheshire qui se
   *    matérialise puis s'évapore (Reine de Cœur).
   *  - `paws` : une traînée d'empreintes (`image`, fond transparent → affichée en blanc via
   *    `invert`) s'imprime une à une en travers de la bande haute, de DROITE à GAUCHE (comme la
   *    traversée d'Yzma), marque un temps, puis s'efface une par une — un chien invisible qui
   *    passe dans la neige (Cruella).
   *  - `petals` : des pétales (images tirées au hasard parmi `images`) tombent du haut en VOLETANT
   *    (chute + ondulation latérale + rotation), nimbés d'une LUEUR ROSE, la plupart portant une
   *    petite FLAMME — les pétales de la rose enchantée (Gaston). Densité réglable via `count`.
   *  - `jet-cross` : `image` (un vaisseau) FILE en DIAGONALE — départ en haut, au milieu du plateau
   *    JOUEUR (moitié gauche), arrivée au bord DROIT à mi-hauteur de l'écran — en fondu aux extrémités
   *    (Syndrome : son manta-jet). Trajectoire relative à l'écran (API Web Animations).
   *  - `smoke-field` : pas de trajet ; des bouffées de FUMÉE VERTE (CSS, sans image) apparaissent PARTOUT
   *    sur l'écran (positions au hasard sur toute la surface), gonflent en montant un peu et se fondent,
   *    départs échelonnés → la fumée envahit tout l'écran le temps du passage (Le Seigneur des Ténèbres).
   *    Densité réglable via `count`.
   *  - `overgrowth` : pas de trajet ; la JUNGLE envahit tout l'écran — des LIANES poussent depuis le haut
   *    (elles s'allongent vers le bas) et des FEUILLES éclosent un peu partout (apparition en grandissant),
   *    départs échelonnés, puis tout se dissipe en fondu (Shere Khan). Assets de jungle (liane-1/3/4/5,
   *    feuille) câblés dans le rendu.
   *  - `eject-arc` : `image` est ÉJECTÉE dans le ciel — départ HORS écran en bas à GAUCHE, montée en
   *    arc jusqu'AU-DESSUS de la rangée de Héros adverse (haut de l'écran), en TOURNANT dans le sens
   *    HORAIRE et en rétrécissant (elle s'éloigne) ; à l'arrivée, un ÉCLAT d'étoile à 4 branches (le
   *    *DING* de fin) jaillit pour marquer la fin (Team Rocket : « on s'envole ! »). Nb de tours via
   *    `spinTurns`. Trajectoire relative à l'écran (API Web Animations).
   *  - `stardust` : pas de trajet ; une PLUIE de POUSSIÈRE D'ÉTOILES — des étincelles (CSS, sans image,
   *    teintes or/blanc/bleu/rose) tombent du haut sur toute la largeur en dérivant un peu et en scintillant,
   *    départs échelonnés le temps du passage, puis se fondent (La Bonne Fée). Densité réglable via `count`.
   *  - `drop` : UNE seule image (tirée parmi `images`, une par passage) tombe LENTEMENT et tout droit du
   *    haut vers le bas, à une position horizontale au hasard, en s'inclinant légèrement (Tamatoa : son
   *    hameçon de Maui et Te Fiti). Vitesse via `durationSec`.
   *  - `disco` : pas de trajet ; une TRANSITION plein écran — un voile néon recolore la scène en
   *    TRANSITIONNANT en douceur entre des teintes (`colors`), en fondu d'entrée/sortie (Tamatoa :
   *    « Shiny », la grotte aux trésors sous lumière noire). Teintes via `colors`, durée via `durationSec`.
   *  - `dash-right` : `image` apparaît en FONDU LUMINEUX en haut à GAUCHE (côté joueur ; haut à DROITE,
   *    miroité, côté adversaire), reste ~3 s, puis FILE EN FLÈCHE à l'horizontale (avec léger étirement)
   *    jusqu'à sortir par le bord opposé (Tabbou). Durée totale via `durationSec`.
   *  - `portal-cracks` : TRANSITION plein écran inspirée des portails — d'abord des FISSURES NOIRES se
   *    propagent depuis un centre à travers tout l'écran (la réalité se craquelle), puis des TRAITS
   *    ROUGES lumineux SURGISSENT le long des mêmes fissures (l'énergie du Monde à l'Envers), le tout
   *    sur un voile sombre, avant de se dissiper (Le Flagelleur Mental). Durée via `durationSec`.
   *  - `fel-rain` : la PLUIE DE GANGRÉNÉ — une averse de météores fel tombe EN DIAGONALE sur tout
   *    l'écran (tous inclinés dans le même sens, celui du camp), chacun traînant sa queue, et crève en
   *    une flaque de lumière verte en bas. 100 % CSS, aucun asset (Gul'dan). Densité via `count`,
   *    durée via `durationSec`.
   *  - `dark-embers` : TRANSITION d'ambiance plein écran — tout l'arrière-plan S'ASSOMBRIT (un voile
   *    sombre teinté violet monte puis redescend) tandis que des ÉTINCELLES / braises ROUGE & VIOLET
   *    montent en scintillant un peu partout, puis tout revient à la normale (les Ténèbres de Sumbra
   *    qui effleurent le monde). 100 % CSS. Densité via `count`, durée via `durationSec`.
   *  - `tattoos` : pas de trajet ; des TEXTES (`texts`) s'impriment un à un PARTOUT sur l'écran, à des
   *    positions et inclinaisons au hasard, comme des coups de TAMPON (ils arrivent flous et trop
   *    grands, se posent net, marquent un temps, puis s'effacent). Départs échelonnés → l'écran se
   *    couvre le temps du passage. 100 % texte, aucun asset (Isabella : les matricules tatoués sur la
   *    nuque des enfants). Densité via `count`, taille via `heightPct`, durée via `durationSec`.
   *  - `ashes` : pas de trajet ; LA POUSSIÈRE — des CENDRES (CSS, sans image, teintes GRIS CENDRE et
   *    BRUN terreux, mates : elles ne brillent pas) naissent en bas de l'écran et S'ENVOLENT vers le
   *    haut sur toute la largeur, en tourbillonnant (dérive latérale + rotation), par bouffées
   *    échelonnées, puis se dissipent : les êtres que le Claquement a réduits en poussière (Thanos).
   *    Densité via `count` (la prendre GÉNÉREUSE : c'est un écran enseveli), durée via `durationSec`.
   *  - `beam` : LE RAYON — pas de prop. Un point d'énergie se CHARGE au bord de l'écran (côté du camp :
   *    joueur à gauche, adversaire à droite), puis un TRAIT rouge-blanc file à l'horizontale et traverse
   *    tout l'écran d'un coup ; un flash claque à la bouche, une ONDE DE CHOC s'écarte de part et d'autre
   *    du trait, et des braises soulevées montent en s'éteignant (Ultron). 100 % CSS, aucun asset.
   *    Densité des braises via `count`, durée totale via `durationSec`.
   *  - `sigil` : pas de trajet ; `image` (un SCEAU) apparaît GRAND et CENTRÉ sur l'écran, s'embrase
   *    (halo pulsant derrière, trait incandescent) en crachant des BRAISES qui montent, puis se
   *    dissipe (Pyramid Head : le Halo du Soleil / sceau de Metatron). Densité des braises via
   *    `count`, durée via `durationSec`, taille via `heightPct`. */
  path?:
    | 'cross' | 'sky-arc' | 'drift-spin' | 'pages' | 'roses' | 'coins' | 'water-cross'
    | 'rise' | 'voodoo' | 'fire-bottom' | 'fade' | 'paws' | 'petals' | 'jet-cross' | 'smoke-field'
    | 'overgrowth' | 'eject-arc' | 'stardust' | 'drop' | 'disco' | 'dash-right' | 'portal-cracks'
    | 'dark-embers' | 'fel-rain' | 'sigil' | 'tattoos' | 'ashes' | 'beam'
  /** Tire quelques coups de canon (lueur + fumée à la bouche du canon avant)
   *  pendant le vol. Réservé aux trajectoires `sky-arc`. */
  cannons?: boolean
  /** Souffle un jet de feu vert continu depuis la gueule (dragon). Réservé à
   *  `sky-arc`. */
  fireBreath?: boolean
  /** Sème une traînée de petites plumes derrière l'oiseau (Iago). Réservé à `sky-arc`. */
  feathers?: boolean
  /** Nombre de tours d'image sur tout le trajet (trajectoire `drift-spin`, défaut 1.25). */
  spinTurns?: number
  /** Nombre d'éléments générés. Trajectoire `coins` : objets qui tombent (si absent ~48-66 ;
   *  Méchante Reine : quelques pommes). Trajectoire `rise` : âmes/bulles montantes (si absent
   *  18-30 ; Hadès : nuée d'âmes ; Dio : symboles de menace). */
  count?: number
  /** Trajectoire `rise` : concentre les éléments sur les DEUX CÔTÉS (marges gauche/droite),
   *  en laissant le centre — où s'affichent les plateaux — plus dégagé (Hadès : âmes). */
  sides?: boolean
  /** Trajectoire `rise` : durée de base d'UNE montée (bas → haut), en secondes (défaut 5 s). Chaque
   *  élément tire ensuite jusqu'à +90 % (vitesses variées). Monter cette valeur ralentit la montée
   *  — penser à rallonger `durationSec` en conséquence, sinon le calque est démonté avant la fin
   *  (Dio : ses symboles de menace montent lentement). */
  riseSec?: number
  /** Trajectoire `rise` : rend l'image floue et lui ajoute un halo lumineux derrière (aura
   *  spectrale qui suit l'ondulation) — pour des apparitions fantomatiques (Hadès : âmes). */
  glow?: boolean
  /** Trajectoire `pages` : ajoute un flicker « glitch » (dédoublement chromatique cyan/magenta
   *  par à-coups) à chaque image, pour un rendu piratage (Sombra : crânes de Piratage). */
  glitch?: boolean
  /** Trajectoire `water-cross` avec une IMAGE : l'élément MARCHE (Kronk de Yzma) → ajoute une traînée de
   *  pas au sol + une vibration de course. Sans ça, l'image DÉRIVE simplement (ex. dirigeable de Ratigan). */
  onFoot?: boolean
  /** Trajectoire `water-cross` avec une IMAGE, sans `onFoot` : démarche posée — léger rebond + balancement
   *  subtil (un peu de vibration, sans traînée ni secousse de course) (Madame de Trémaine : ses filles). */
  gait?: boolean
  /** Trajectoire `cross` : RETOURNE l'image verticalement (haut/bas, scaleY(-1)) (Madame Mim). */
  flipVertical?: boolean
  /** Trajectoire `water-cross` avec une IMAGE, sans `onFoot`/`gait` : ajoute des TUYÈRES animées à
   *  l'ARRIÈRE du prop — deux jets bleu-blanc qui vacillent + une longue traînée diffuse. Elles restent
   *  toujours à la poupe (le miroir du sens de marche les emporte avec le prop). Les sorties de
   *  propulseur sont calées sur un prop LARGE à deux réacteurs arrière (Grand Councilwoman : le vaisseau
   *  de Stitch) ; un prop de forme très différente demanderait de les paramétrer. */
  thrust?: boolean
  /** Trajectoire `water-cross` avec une IMAGE : ADOUCIT les bords (masque radial, comme le clip Tic-Tac
   *  de Crochet) → le bord du GIF/image se fond au lieu d'un cadre net (Pat Hibulaire : son steamboat). */
  softEdges?: boolean
  /** Trajectoire `cross` : RETOURNE l'image horizontalement (miroir gauche/droite, scaleX(-1)), en plus
   *  du sens de marche (Madame Mim). */
  flipHorizontal?: boolean
  /** Trajectoire `cross` : ajoute une LÉGÈRE VIBRATION continue à l'image pendant la traversée (Madame Mim). */
  vibrate?: boolean
  /** Trajectoire `cross` : affiche l'image en SILHOUETTE NOIRE (filtre `brightness(0)`) — une masse
   *  sombre dans l'eau (Davy Jones : le Kraken). */
  silhouette?: boolean
  /** Trajectoire `cross` : donne à l'image un mouvement de NAGE (ondulation verticale + léger roulis)
   *  pendant la traversée (Davy Jones : le Kraken qui nage). */
  swim?: boolean
  /** Trajectoire `petals` : couleur (CSS) de la LUEUR autour des pétales (double halo). Défaut : rose de
   *  la rose enchantée (Gaston). Ex. doré pour la fleur magique de Mère Gothel. */
  petalGlow?: string
  /** Trajectoire `petals` : les pétales portent-ils une petite FLAMMÈCHE ? Défaut `true` (rose enflammée
   *  de Gaston). Mettre `false` pour des pétales sans flamme (fleur d'or de Mère Gothel). */
  petalFlame?: boolean
  /** Trajectoire `tattoos` : les textes tamponnés. Ils sont tirés au hasard (avec répétitions si la
   *  liste est plus courte que `count`) — Isabella : les matricules des enfants de Grace Field. */
  texts?: string[]
  /** Trajectoire `disco` : les teintes néon cyclées (voile plein écran + faisceaux). Au moins 3 couleurs
   *  CSS conseillées (Tamatoa : bleu / magenta / cyan). Défaut : les 3 teintes de Tamatoa. */
  colors?: string[]
}

// Un vilain peut avoir UNE animation, ou PLUSIEURS (tableau) : dans ce cas le planificateur
// en tire une au hasard à chaque passage.
export const VILLAIN_ANIMATION: Partial<Record<VillainKey, VillainAnimation | VillainAnimation[]>> = {
  // Tabbou : son image d'attaque apparaît en FONDU LUMINEUX en haut à gauche (haut à droite, miroité,
  // côté adversaire), reste 3 s, puis FILE EN FLÈCHE à l'horizontale vers le bord opposé (path `dash-right`).
  tabbou: {
    image: '/animations/tabbou_attack.png',
    heightPct: 11,
    durationSec: 4.2,
    path: 'dash-right',
  },
  // Tamatoa (Vaiana) : transition « Shiny » — la grotte aux trésors baigne dans une LUMIÈRE NOIRE.
  // Toute la scène se recolore en TRANSITIONNANT en douceur entre ses 3 teintes néon (bleu / magenta /
  // cyan) (path `disco`, 5 s). (Son « bling-bling » — pièces, diamants, hameçon de Maui & Te Fiti —
  // tombe, lui, dans la pluie PERMANENTE de son décor.)
  tamatoa: {
    durationSec: 5,
    path: 'disco',
    colors: ['#0001FB', '#FD27FC', '#64D9FE'], // bleu / magenta / cyan (lumière noire de la grotte)
  },
  // Thanos (Marvel) : LA POUSSIÈRE — des cendres GRIS-MARRON naissent en bas de l'écran et s'envolent
  // vers le haut en tourbillonnant, par bouffées, sur toute la largeur : ce qu'il reste de ceux que le
  // Claquement a effacés. 100 % CSS, aucun asset. (Titan, le Gantelet-jauge et le Claquement lui-même
  // sont un DÉCOR PERMANENT — cf. villainDecor.ts, kind `titan`.)
  thanos: {
    durationSec: 9, // couvre les bouffées échelonnées + la dernière montée
    count: 600, // TRÈS dense : le passage doit ensevelir l'écran de poussière
    path: 'ashes',
  },
  // Prince Jean (Robin des Bois) : une pluie de pièces d'or (11 angles découpés de
  // pieces.png) tombe du ciel jusqu'en bas, sur toute la largeur, chacune tournoyant.
  princeJohn: {
    images: [
      '/animations/piece-1.png',
      '/animations/piece-2.png',
      '/animations/piece-3.png',
      '/animations/piece-4.png',
      '/animations/piece-5.png',
      '/animations/piece-6.png',
      '/animations/piece-7.png',
      '/animations/piece-8.png',
      '/animations/piece-9.png',
      '/animations/piece-10.png',
      '/animations/piece-11.png',
    ],
    heightPct: 6, // taille de base d'une pièce (variée par pièce dans le composant)
    durationSec: 9, // couvre l'étalement des chutes (délais + durée de chute)
    path: 'coins',
  },
  // Syndrome (Les Indestructibles) : son MANTA-JET file en DIAGONALE (du haut-milieu du plateau joueur,
  // à gauche, vers le bord droit à mi-hauteur), contrairement au dirigeable de Ratigan qui dérive à
  // l'horizontale. Le nez de l'image pointe déjà vers la droite (sens du vol) → pas de retournement.
  syndrome: {
    image: '/animations/manta_jet.png',
    heightPct: 16, // taille du jet
    durationSec: 6, // une traversée diagonale rapide
    path: 'jet-cross',
  },
  // Le Seigneur des Ténèbres (Le Chaudron Magique) : une nappe de FUMÉE VERTE envahit tout l'écran le
  // temps d'un passage (bouffées qui apparaissent partout, gonflent et se fondent). 100 % CSS.
  seigneurTenebres: {
    durationSec: 9, // le temps que la fumée envahisse tout l'écran puis se dissipe
    path: 'smoke-field',
  },
  // Oogie Boogie (L'Étrange Noël de Monsieur Jack) : le trio Am/Stram/Gram (Lock/Shock/Barrel) traverse
  // l'écran dans leur BAIGNOIRE À PATTES, comme Kronk de Yzma (water-cross à pied, traînée de pas).
  oogieBoogie: {
    image: '/animations/am_stram_gram.png',
    heightPct: 15, // la baignoire et le trio (image carrée 650×650)
    topPct: 3, // hauteur de la traversée
    durationSec: 12, // une traversée complète
    path: 'water-cross',
    gait: true, // la baignoire marche → léger dandinement (rebond + balancement), SANS traînée de pas
  },
  // Sa Sucrerie (Roi Candy — Les Mondes de Ralph) : une PLUIE DE BONBONS (15 gommes/oursons colorés tirés
  // au hasard) tombe du ciel en tournoyant, sur toute la largeur — comme la pluie de pièces de Prince Jean.
  saSucrerie: {
    images: [
      '/animations/bonbon-1.png', '/animations/bonbon-2.png', '/animations/bonbon-3.png',
      '/animations/bonbon-4.png', '/animations/bonbon-5.png', '/animations/bonbon-6.png',
      '/animations/bonbon-7.png', '/animations/bonbon-8.png', '/animations/bonbon-9.png',
      '/animations/bonbon-10.png', '/animations/bonbon-11.png', '/animations/bonbon-12.png',
      '/animations/bonbon-13.png', '/animations/bonbon-14.png', '/animations/bonbon-15.png',
      // Variantes de couleur du nounours (bonbon-11) : jaune / vert / bleu / violet.
      '/animations/bonbon-11-jaune.png', '/animations/bonbon-11-vert.png',
      '/animations/bonbon-11-bleu.png', '/animations/bonbon-11-violet.png',
    ],
    heightPct: 6, // taille de base d'un bonbon (variée par bonbon dans le composant)
    durationSec: 9, // couvre l'étalement des chutes (délais + durée de chute)
    count: 40,
    path: 'coins',
  },
  // Bowser (Super Mario Galaxy) : le bateau pirate volant entre par le milieu-gauche
  // et s'élève en arc dans le ciel jusqu'à sortir en haut à droite, canons tonnants.
  bowser: {
    image: '/animations/bateau_bowser.png',
    heightPct: 12,
    durationSec: 20,
    facesLeft: true,
    path: 'sky-arc',
    cannons: true,
  },
  // Maléfique (La Belle au bois dormant) : le dragon survole l'écran depuis la gauche
  // en crachant un jet de feu vert continu par la gueule.
  maleficent: {
    image: '/animations/dragon.png',
    heightPct: 15,
    durationSec: 18,
    facesLeft: false, // la gueule pointe à droite
    path: 'sky-arc',
    fireBreath: true,
  },
  // Slenderman : ses 8 pages apparaissent une à une en fondu, à des endroits au
  // hasard (hors plateaux), décalées de 0,3 s, chacune visible ~3 s.
  slenderman: {
    images: [
      '/animations/slender-page-1.png',
      '/animations/slender-page-2.png',
      '/animations/slender-page-3.png',
      '/animations/slender-page-4.png',
      '/animations/slender-page-5.png',
      '/animations/slender-page-6.png',
      '/animations/slender-page-7.png',
      '/animations/slender-page-8.png',
    ],
    heightPct: 15,
    durationSec: 6, // couvre la séquence (3 s + 7×0,3 s ≈ 5,1 s) avant démontage
    path: 'pages',
  },
  // Capitaine Crochet (Peter Pan) : le clip de Tic-Tac le crocodile (rides d'eau +
  // bulles qui montent) est lu en boucle, bords adoucis, et traverse le haut de
  // l'écran de gauche à droite.
  crochet: {
    video: '/animations/tic_tac.mp4',
    heightPct: 22, // hauteur du clip (ratio 4:3 conservé)
    durationSec: 9.6, // = durée du clip → une lecture complète pendant la traversée
    path: 'water-cross',
  },
  // Pat Hibulaire (vieux cartoons Mickey) : le STEAMBOAT WILLIE (GIF animé) traverse le HAUT de l'écran
  // en dérivant, comme le Tic-Tac de Crochet / le dirigeable de Ratigan (`water-cross`). Le GIF anime
  // tout seul le bateau (fumée, etc.). (Le décor permanent « vieille pellicule » est dans villainDecor.ts.)
  patHibulaire: {
    image: '/animations/steamboat.gif',
    heightPct: 20, // taille du bateau (GIF 402×336)
    topPct: 3, // hauteur de la traversée
    durationSec: 13, // une traversée complète, dérive tranquille
    path: 'water-cross',
    facesLeft: true, // le bateau regarde à gauche au naturel → miroité dans son sens de marche
    softEdges: true, // bords adoucis (masque radial), comme le clip Tic-Tac
  },
  // Yzma (Kuzco) : Kronk traverse le HAUT de l'écran (les deux camps) en courant, portant le
  // palanquin — même trajectoire que le Tic-Tac de Crochet (`water-cross`, droite → gauche).
  yzma: {
    image: '/animations/yzma_kronk.png',
    heightPct: 16, // silhouette (Kronk + palanquin)
    topPct: 3, // hauteur de la traversée
    durationSec: 12, // une traversée complète
    path: 'water-cross',
    onFoot: true, // Kronk court → traînée de pas + vibration de course
  },
  // Madame de Trémaine (Cendrillon) : ses deux filles, Anastasia et Drizella, défilent en se pavanant
  // dans le HAUT de l'écran (trajectoire `water-cross`). L'image regarde vers la droite (comme Kronk)
  // → pas de `facesLeft` ; retournée selon le sens du camp. Pas d'`onFoot` → dérive douce (léger
  // flottement, sans traînée de pas ni vibration de course).
  madameTremaine: {
    image: '/animations/soeurs_cendrillon.png',
    heightPct: 17, // les deux sœurs (image 580×386)
    topPct: 3, // hauteur de la traversée
    durationSec: 13, // une traversée complète, démarche posée
    path: 'water-cross',
    gait: true, // léger rebond + balancement (un peu de vibration, sans traînée)
  },
  // Ratigan (Basil, détective privé) : son DIRIGEABLE traverse le HAUT de l'écran (même trajectoire que le
  // Tic-Tac de Crochet, `water-cross` droite → gauche), en dérivant simplement (pas à pied).
  ratigan: {
    image: '/animations/dirigeable.png',
    heightPct: 14, // taille du dirigeable (image carrée 250×250)
    topPct: 3, // hauteur de la traversée
    durationSec: 16, // dérive lente et majestueuse
    facesLeft: true, // le nez pointe à gauche (sens du déplacement) → pas de retournement
    path: 'water-cross',
  },
  // Ursula (La Petite Sirène) : un flux de bulles monte du fond vers la surface en
  // ondulant et en s'estompant, sur toute la largeur. Trois teintes (original, bleu,
  // rose) tirées au hasard par bulle.
  ursula: {
    images: [
      '/animations/bulle.png',
      '/animations/bulle-bleu.png',
      '/animations/bulle-rose.png',
    ],
    heightPct: 5, // taille de base d'une bulle (variée par bulle dans le composant)
    durationSec: 15, // couvre l'étalement des montées (délais + durée)
    path: 'rise',
  },
  // Hadès : une nuée d'âmes du Styx (3 sprites tirés au hasard) s'élève du bas vers le
  // haut en ondulant et en s'estompant — concentrée sur les DEUX CÔTÉS (marges gauche/
  // droite) pour encadrer les plateaux sans les noyer. (Le feu bleu reste un décor
  // PERMANENT, cf. villainDecor.ts, kind `fire`.)
  hades: {
    images: [
      '/animations/ame_femme.png',
      '/animations/ame_homme.png',
      '/animations/ame_homme2.png',
    ],
    heightPct: 11, // âmes nettement plus grandes que des bulles
    durationSec: 16, // couvre l'étalement des montées (délais + durée)
    count: 70, // nuée dense
    sides: true, // concentrées sur les deux marges
    glow: true, // âmes floues + halo spectral
    path: 'rise',
  },
  // Scar (Le Roi Lion) : le feu VERT de « Soyez prêtes » envahit le bas de l'écran
  // (même sprite que Hadès, teinté en vert).
  scar: {
    sprite: '/animations/fire_sprite.png',
    frames: 39,
    heightPct: 32,
    durationSec: 10,
    tint: 'hue-rotate(95deg) saturate(1.9)', // feu orange → vert toxique
    path: 'fire-bottom',
  },
  // Méchante Reine (Blanche-Neige) : quelques pommes empoisonnées tombent du ciel en
  // tournoyant (la fumée violette est désormais un décor PERMANENT, cf. villainDecor.ts).
  mechanteReine: {
    images: ['/animations/apple.png'],
    heightPct: 7, // taille d'une pomme
    durationSec: 10, // couvre l'étalement des chutes
    count: 8, // pluie parcimonieuse (≈ une poignée de pommes)
    path: 'coins',
  },
  // Dr Facilier (La Princesse et la Grenouille) : les totems « amis de l'autre côté »
  // apparaissent en fondu au-dessus du plateau ; leurs yeux (calque) s'illuminent fort
  // en violet, puis l'ensemble s'assombrit et disparaît.
  facilier: {
    image: '/animations/amis_dela.png',
    overlayImage: '/animations/amis_dela_yeux.png',
    heightPct: 42, // hauteur de l'ensemble des totems
    durationSec: 8, // apparition → éclats faible/moyen → éclat fort tenu ~3 s → fondu doux
    path: 'voodoo',
  },
  // Reine de Cœur (Alice au pays des merveilles) : DEUX animations (tirées au hasard).
  reineCoeur: [
    // 1) 8 à 12 roses BLANCHES apparaissent une à une à des endroits/orientations au hasard,
    //    puis toutes rougissent ~4 s avant de disparaître en fondu (« Peignez-moi ces roses
    //    en rouge ! »).
    {
      image: '/animations/rose.png',
      heightPct: 10,
      durationSec: 13, // couvre apparitions (≤ ~5,7 s) + coulure + 4 s + fondu
      path: 'roses',
    },
    // 2) le Chat du Cheshire se matérialise en fondu à un endroit au hasard, reste ~5 s,
    //    puis s'évapore (fondu + léger grandissement).
    {
      image: '/animations/cheshire.png',
      heightPct: 20,
      durationSec: 6.5, // fondu d'entrée + ~5 s visibles + fondu de sortie
      path: 'fade',
    },
  ],
  // Jafar (Aladdin) : le perroquet Iago survole l'écran (même trajectoire que le
  // dragon) en semant quelques plumes derrière lui.
  jafar: {
    image: '/animations/iago.png',
    heightPct: 8,
    durationSec: 17,
    facesLeft: true, // Iago regarde à gauche
    path: 'sky-arc',
    feathers: true,
  },
  // La Bonne Fée (Marraine de Shrek) : une PLUIE de poussière d'étoiles tombe du haut sur tout l'écran
  // (étincelles or/blanc/bleu/rose qui scintillent), le temps d'un passage.
  laBonneFee: {
    durationSec: 9,
    path: 'stardust',
    count: 260,
  },
  // Sombra (Overwatch) : ses crânes de Piratage (« BOOP! ») s'affichent un à un en fondu à des
  // endroits au hasard (hors plateaux), comme autant de systèmes compromis, en clignotant d'un
  // glitch chromatique (cyan/magenta). Même trajectoire que les pages de Slenderman (`pages`).
  sombra: {
    images: Array.from({ length: 16 }, () => '/animations/sombra-hack.png'),
    heightPct: 14,
    durationSec: 8, // couvre la séquence (3 s + 15×0,3 s ≈ 7,5 s) avant démontage
    path: 'pages',
    glitch: true,
  },
  // Cruella d'Enfer (Les 101 Dalmatiens) : une traînée d'empreintes de pattes de chiot s'imprime
  // une à une en travers de la bande haute (de droite à gauche, comme la traversée d'Yzma/du Tic-Tac),
  // marque un temps, puis s'efface une par une (un chien invisible qui passe dans la neige).
  cruella: {
    image: '/animations/patte.png',
    heightPct: 6, // taille d'une empreinte
    topPct: 8, // hauteur de la bande de traversée
    durationSec: 11.5, // couvre impression échelonnée + temps de pose + effacement échelonné
    path: 'paws',
  },
  // Gaston (La Belle et la Bête) : les pétales de la ROSE ENCHANTÉE tombent en voletant, nimbés
  // d'une lueur rose, la plupart portant une petite flammèche (3 formes de pétale tirées au hasard).
  gaston: {
    images: ['/animations/petale-1.png', '/animations/petale-2.png', '/animations/petale-3.png'],
    heightPct: 5, // taille de base d'un pétale (variée par pétale dans le composant)
    durationSec: 15, // couvre l'étalement des chutes (délais + chute lente)
    path: 'petals',
  },
  // Mère Gothel (Raiponce) : les pétales de la FLEUR D'OR magique tombent en voletant, nimbés d'une
  // LUEUR DORÉE et SANS flamme (même trajectoire que les pétales de Gaston, variante dorée).
  gothel: {
    images: ['/animations/flower_sans_tige.png'],
    heightPct: 5, // taille de base d'un pétale (variée par pétale dans le composant)
    durationSec: 15, // couvre l'étalement des chutes (délais + chute lente)
    path: 'petals',
    petalGlow: 'rgba(255, 214, 120, 0.9)', // lueur dorée de la fleur magique
    petalFlame: false, // pas de flammèche : ce sont des pétales d'or, pas la rose enflammée
  },
  // Lotso (Toy Story 3) : pluie de FRAISES (Lotso sent la fraise) — elles tombent du haut en tournoyant
  // (trajectoire `coins`, comme les pièces de Prince Jean). (La garderie Sunnyside + l'averse de jouets
  // surprise sont un DÉCOR PERMANENT — cf. SunnysideDecor dans components/VillainDecor.tsx.)
  lotso: {
    images: ['/animations/fraise.png'],
    heightPct: 6, // taille d'une fraise
    durationSec: 10, // couvre l'étalement des chutes
    count: 30, // pluie de fraises
    path: 'coins',
  },
  // (Le duel de sorciers de Madame Mim ET la pluie de cartes surprise sont un DÉCOR PERMANENT —
  // cf. MimDecor dans components/VillainDecor.tsx.)
  // Animation temporaire : Mim transformée en lapin poursuivie par le renard (rabbit_fox_mim) traverse
  // le HAUT de l'écran (trajectoire `cross` : joueur gauche→droite, adversaire droite→gauche).
  madameMim: {
    image: '/animations/rabbit_fox_mim.png',
    heightPct: 14,
    durationSec: 11, // traversée un peu plus rapide
    path: 'cross',
    flipHorizontal: true, // image retournée horizontalement (miroir)
    vibrate: true, // légère vibration pendant le passage
  },
  // Shere Khan (Le Livre de la Jungle) : la JUNGLE envahit tout l'écran — des lianes poussent depuis le
  // haut et des feuilles éclosent partout, puis tout se dissipe. (Le décor permanent de jungle + ses
  // surprises feu/tigre sont, eux, dans villainDecor.ts, kind `jungle`.)
  shereKhan: {
    durationSec: 9, // le temps que la jungle envahisse l'écran (départs échelonnés) puis se dissipe
    path: 'overgrowth',
  },
  // Team Rocket (Pokémon) : le trio est ÉJECTÉ « on s'envole ! » — il jaillit d'en bas à gauche, monte
  // en arc au-dessus des Héros adverses en tournant dans le sens horaire et en rétrécissant, puis un
  // éclat d'étoile (le *DING* de fin d'épisode) marque l'arrivée.
  teamRocket: {
    image: '/animations/team_rocket_cieux.png',
    heightPct: 18, // taille du trio au départ (rétrécit en s'éloignant)
    durationSec: 3.4, // une éjection rapide
    spinTurns: 3, // tours (sens horaire) sur tout le trajet
    path: 'eject-arc',
  },
  // Davy Jones (Pirates des Caraïbes) : le KRAKEN, énorme, traverse le MILIEU de l'écran (path `cross`
  // avec `topPct` pour le descendre au centre). Image très large (640×360) → sa traversée prend tout
  // le cadre. (Le décor permanent « mer démontée » est dans villainDecor.ts, kind `flyingDutchman`.)
  davyJones: {
    image: '/animations/kraken.png',
    heightPct: 150, // gigantesque (×3) — déborde en haut/bas de l'écran
    topPct: -25, // centré verticalement (−25 % + 150 % → milieu de l'écran)
    durationSec: 16, // traversée lente et imposante
    path: 'cross',
    silhouette: true, // masse noire dans l'eau
    swim: true, // ondulation verticale + léger roulis (il nage)
  },
  // L'Imposteur (Among Us) : un équipier éjecté (couleur au hasard) dérive en ligne
  // droite du haut-gauche vers le bas-droite en tournant lentement sur lui-même.
  imposteur: {
    images: [
      '/animations/ejected_blue_dark.png',
      '/animations/ejected_brown.png',
      '/animations/ejected_citron.png',
      '/animations/ejected_cyan.png',
      '/animations/ejected_dark.png',
      '/animations/ejected_green.png',
      '/animations/ejected_orange.png',
      '/animations/ejected_pink.png',
      '/animations/ejected_purple.png',
      '/animations/ejected_white.png',
      '/animations/ejected_yellow.png',
    ],
    heightPct: 9,
    durationSec: 16,
    path: 'drift-spin',
  },
}

// Animations de passage des vilains de l'ATELIER PUBLIÉ (indexées par id `custom-…`, hors de l'union
// native `VillainKey`). Même contenu qu'une entrée `VILLAIN_ANIMATION`.
export const CUSTOM_VILLAIN_ANIMATION: Record<string, VillainAnimation | VillainAnimation[]> = {
  // Pyramid Head (Silent Hill) : le HALO DU SOLEIL (sceau de Metatron) s'embrase au centre de l'écran
  // — halo rouge pulsant derrière le sceau, trait incandescent, et des braises rouges qui montent —
  // puis tout se dissipe (path `sigil`).
  'custom-pyramid-head': {
    image: '/animations/metatron.png',
    heightPct: 62, // hauteur du sceau, en % de la hauteur d'écran
    durationSec: 7,
    count: 44, // braises
    path: 'sigil',
  },
  // Ultron (Marvel) : LE RAYON — l'énergie se charge au bord de l'écran (côté du camp), puis le trait
  // rouge-blanc traverse tout l'écran d'un coup, onde de choc et braises soulevées (path `beam`).
  'custom-ultron': {
    durationSec: 3.4,
    count: 16, // braises soulevées par le tir
    path: 'beam',
  },
  // Michael Myers (Halloween) : une PLUIE DE COUTEAUX de cuisine tombe du ciel en tournoyant sur
  // toute la largeur — son arme, en averse (path `coins`, comme les clés du Seigneur des clés).
  // Une seule image : la variété vient du sens/vitesse de rotation et de la vitesse de chute.
  'custom-michael-meyers': {
    images: ['/animations/couteau_meyers.png'],
    heightPct: 9, // un couteau est plus grand qu'une pièce : la pluie doit rester lisible
    durationSec: 9, // couvre l'étalement des chutes (délais + durée de chute)
    count: 26, // moins dense qu'une pluie de pièces (les lames sont grandes)
    path: 'coins',
  },
  // Le Seigneur des clés : une PLUIE DE CLÉS colorées (6 couleurs) tombe du ciel en tournoyant,
  // sur toute la largeur — comme la pluie de pièces de Prince Jean (path `coins`).
  'custom-seigneur-cles': {
    images: [
      '/cards/custom-seigneur-cles/cle-bleu.webp',
      '/cards/custom-seigneur-cles/cle-jaune.webp',
      '/cards/custom-seigneur-cles/cle-orange.webp',
      '/cards/custom-seigneur-cles/cle-rouge.webp',
      '/cards/custom-seigneur-cles/cle-vert.webp',
      '/cards/custom-seigneur-cles/cle-violet.webp',
    ],
    heightPct: 7, // taille de base d'une clé (variée par clé dans le composant)
    durationSec: 9, // couvre l'étalement des chutes (délais + durée de chute)
    count: 40,
    path: 'coins',
  },
  // Sumbra (Dharkon 🌑) : les TÉNÈBRES effleurent le monde — tout l'arrière-plan s'assombrit (voile
  // sombre violacé) pendant que des étincelles/braises ROUGE & VIOLET montent en scintillant, puis tout
  // revient à la normale (path `dark-embers`, 100 % CSS). Propre à Sumbra (Kilaire a Kirby, ci-dessous).
  'custom-mrl4fb45': {
    durationSec: 12, // transition longue et pesante
    count: 60,
    path: 'dark-embers',
  },
  // Grand Councilwoman (Lilo & Stitch) : le VAISSEAU rouge de Stitch traverse le HAUT de l'écran en
  // dérivant — même trajectoire que Kronk chez Yzma / le dirigeable de Ratigan (`water-cross`), donc
  // dans le sens du camp : joueur de gauche à droite, adversaire de droite à gauche. L'avant du
  // vaisseau pointe à GAUCHE au naturel (`facesLeft`) → il est miroité pour regarder dans son sens
  // de marche. Pas d'`onFoot`/`gait` : il DÉRIVE (léger flottement, comme le dirigeable).
  'custom-stitch': {
    image: '/animations/vaisseau_stitch.png',
    heightPct: 11, // taille du vaisseau (image 360×213)
    topPct: 4, // hauteur de la traversée
    durationSec: 13, // dérive tranquille
    facesLeft: true,
    path: 'water-cross',
    thrust: true, // ses deux réacteurs crachent un jet bleu qui vacille, avec une traînée
  },
  // Dio (JoJo's Bizarre Adventure) : les SYMBOLES DE MENACE (« ゴゴゴゴ », animation) APPARAISSENT EN
  // BAS de l'écran et MONTENT jusqu'en haut, un peu partout sur la largeur, en ondulant (path `rise`,
  // celui des bulles d'Ursula, en `count` copies de la même image) — la menace qui monte avant qu'il
  // agisse. Le gif source (`assets/animations/dio/`) avait un FOND GRIS opaque : il est servi en WEBP
  // ANIMÉ détouré (seul format à la fois animé et à alpha réel — le gif est limité à 1 bit de
  // transparence, donc à des bords en escalier).
  'custom-dio': {
    image: '/animations/menacing-jojo.webp',
    heightPct: 11, // taille de base d'un symbole (variée ×0,45..1,55 par le rendu ; source 220×220)
    count: 22, // ils envahissent tout l'écran (une même image → décodée une seule fois)
    riseSec: 11, // montée LENTE et pesante (11 à ~21 s selon le symbole)
    durationSec: 27, // couvre les départs échelonnés (jusqu'à 5 s) + la montée la plus lente (~21 s)
    path: 'rise',
  },
  // Le Flagelleur Mental (Stranger Things) : le PASSAGE vers le Monde à l'Envers — l'écran se craquelle
  // en fissures noires, puis des traits rouges surgissent le long des fissures (path `portal-cracks`).
  'custom-flagelleur-mental': {
    durationSec: 6.5,
    path: 'portal-cracks',
  },
  // Mr Monopoly : la LOCOMOTIVE (jeton « chemin de fer », silhouette noire) traverse le HAUT de l'écran
  // en dérivant — même trajectoire qu'Yzma/le dirigeable de Ratigan (`water-cross`). Elle regarde à
  // gauche au naturel (cheminée à l'avant) → `facesLeft`, orientée dans son sens de marche selon le camp.
  'custom-mr-monopoly': {
    image: '/animations/monopoly-train.png',
    heightPct: 12, // taille de la locomotive (image 276×251)
    topPct: 3, // hauteur de la traversée (bande haute)
    durationSec: 15, // dérive tranquille sur les rails
    facesLeft: true,
    path: 'water-cross',
  },
  // Gul'dan (Warcraft) : la PLUIE DE GANGRÉNÉ — une averse de météores fel s'abat en diagonale sur
  // tout l'écran (penchés dans le sens du camp) et crève en flaques de lumière en bas. 100 % CSS.
  'custom-gul-dan': {
    count: 38,
    durationSec: 7, // couvre l'étalement des chutes + le dernier impact
    path: 'fel-rain',
  },
  // Isabella (The Promised Neverland) : les MATRICULES s'impriment PARTOUT sur l'écran, un à un,
  // comme autant de coups de tampon — le numéro que chaque enfant porte tatoué sur la nuque, et qui
  // dit ce qu'ils sont vraiment pour elle : du bétail numéroté (path `tattoos`, 100 % texte).
  // Emma, Norman et Ray portent les numéros canoniques ; les autres sont de la même famille.
  'custom-isabella': {
    texts: [
      '63194', '22194', '81194', '16194', '24194', '98718', '35204', '71592',
      '52791', '40614', '19836', '67425', '28903', '84117',
    ],
    heightPct: 2.2, // taille de base d'un matricule (variée par matricule dans le composant)
    count: 42, // densité : le calque est DERRIÈRE l'UI, une bonne moitié tombe sous les plateaux
    durationSec: 11.5, // couvre les impressions échelonnées (≈ 7,4 s) + le dernier effacement (3,4 s)
    path: 'tattoos',
  },
  // Kilaire (Galeem ☀️) UNIQUEMENT : KIRBY s'échappe sur son ÉTOILE VOLANTE (Warp Star) — l'unique
  // rescapé de la lumière de Galeem dans « La Lueur du Monde ». Traversée `cross` SELON LE CAMP :
  // côté JOUEUR de gauche→droite, côté ADVERSAIRE de droite→gauche (image miroitée + sillage du bon
  // côté automatiquement). Image transparente, Kirby orienté à droite au naturel (pas de `facesLeft`).
  // Absent de Sumbra (entrée propre à `custom-killaire`).
  'custom-killaire': {
    image: '/animations/kirby_fly.png',
    heightPct: 8, // petit prop (Kirby + étoile)
    topPct: 6, // un peu sous le bord haut pour rester bien visible
    durationSec: 3, // fuite TRÈS rapide (il détale sur son étoile)
    starTrail: true, // sillage d'étoiles derrière lui (côté opposé au déplacement)
    path: 'cross',
  },
}

/** Liste des animations de décor d'un vilain (vide si aucune). Normalise l'entrée (une seule
 *  animation → tableau d'un élément). Résout une clé NATIVE (`VILLAIN_ANIMATION`) OU un id de vilain
 *  PUBLIÉ `custom-…` (`CUSTOM_VILLAIN_ANIMATION`). */
export function villainAnimationList(key: VillainKey | string): VillainAnimation[] {
  const v = VILLAIN_ANIMATION[key as VillainKey] ?? CUSTOM_VILLAIN_ANIMATION[key]
  return v ? (Array.isArray(v) ? v : [v]) : []
}

/** Première animation de décor d'un vilain (undefined si aucune). Pour les usages qui n'ont
 *  besoin que de savoir s'il en existe une / d'un aperçu (debug). Accepte une clé NATIVE ou un id
 *  PUBLIÉ `custom-…` (les vilains publiés n'ont pas d'animation de passage → undefined). */
export function villainAnimation(key: VillainKey | string): VillainAnimation | undefined {
  return villainAnimationList(key)[0]
}
