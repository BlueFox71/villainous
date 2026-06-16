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
  /** Durée d'une traversée complète, en secondes (défaut 30 s). */
  durationSec?: number
  /** L'image regarde-t-elle vers la GAUCHE au naturel ? Sert à orienter le
   *  vaisseau dans son sens de déplacement (défaut : regarde à droite). */
  facesLeft?: boolean
  /** Trajectoire :
   *  - `cross` (défaut) : traversée linéaire de la bande haute (sens selon camp).
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
   *  - `coins` : pluie de pièces ; chaque pièce (image tirée au hasard parmi `images`)
   *    tombe du haut vers le bas de l'écran en tournoyant, position/taille/vitesse au
   *    hasard, sur toute la largeur (Prince Jean).
   *  - `water-cross` : le clip `video` (en boucle, bords adoucis) traverse le HAUT de
   *    l'écran de gauche à droite (Capitaine Crochet : Tic-Tac et ses bulles).
   *  - `rise` : des copies de `image` montent du bas vers le haut en ondulant et en
   *    s'estompant, taille/colonne/vitesse au hasard, sur toute la surface (Ursula :
   *    bulles). Réutilisable (Hadès : âmes, Scar : braises).
   *  - `voodoo` : `image` (totems) apparaît en fondu au-dessus du plateau du vilain
   *    (bas si joueur, haut si adversaire) ; `overlayImage` (les yeux) se superpose et
   *    brille fort en violet, puis tout s'assombrit en disparaissant (Dr Facilier).
   *  - `fire-bottom` : une rangée de flammes (sprite `sprite`/`frames` joué en boucle)
   *    apparaît en bas de l'écran sur toute la largeur, tailles/positions/phases au
   *    hasard, en fondu (Hadès, Scar).
   *  - `smoke` : des volutes de fumée (procédurales, sans image) montent du bas en
   *    grossissant et en se dissipant, sur toute la largeur (Méchante Reine). */
  path?:
    | 'cross' | 'sky-arc' | 'drift-spin' | 'pages' | 'roses' | 'coins' | 'water-cross'
    | 'rise' | 'voodoo' | 'fire-bottom' | 'smoke'
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
}

export const VILLAIN_ANIMATION: Partial<Record<VillainKey, VillainAnimation>> = {
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
  // Hadès (Hercule) : une rangée de flammes (sprite détouré de fire.gif) surgit en bas
  // de l'écran, tailles/positions/phases au hasard, et flotte le temps d'un passage.
  hades: {
    sprite: '/animations/fire_sprite.png',
    frames: 39,
    heightPct: 32, // hauteur de base d'une flamme (grande ; variée par flamme)
    durationSec: 10, // durée du passage (apparition → maintien → disparition)
    tint: 'hue-rotate(190deg) saturate(1.5)', // feu orange → bleu
    path: 'fire-bottom',
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
  // Méchante Reine (Blanche-Neige) : une fumée violette (procédurale) monte du bas de
  // l'écran ; pendant ce temps, des pommes empoisonnées tombent du ciel (comme les pièces).
  mechanteReine: {
    image: '/animations/apple.png', // pomme empoisonnée qui tombe
    heightPct: 22, // diamètre de base d'une volute (varié par volute)
    durationSec: 12, // durée du passage (fumée qui s'installe puis se dissipe)
    path: 'smoke',
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
  // Reine de Cœur (Alice au pays des merveilles) : 8 à 12 roses BLANCHES apparaissent
  // une à une à des endroits/orientations au hasard, puis toutes rougissent ~4 s avant
  // de disparaître en fondu (« Peignez-moi ces roses en rouge ! »).
  reineCoeur: {
    image: '/animations/rose.png',
    heightPct: 10,
    durationSec: 13, // couvre apparitions (≤ ~5,7 s) + coulure + 4 s + fondu
    path: 'roses',
  },
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

/** Animation de décor d'un vilain (undefined si non défini). */
export function villainAnimation(key: VillainKey): VillainAnimation | undefined {
  return VILLAIN_ANIMATION[key]
}
