import { VILLAIN_REGISTRY, type VillainKey } from './store/gameStore'

/** Portraits dédiés des vilains (illustrations carrées). */
const PORTRAIT: Partial<Record<VillainKey, string>> = {
  princeJohn: '/prince_jean.webp',
  maleficent: '/maleficent.png',
  slenderman: '/slenderman_hd.jpg',
  jafar: '/jafar.png',
  reineCoeur: '/reine_coeur.png',
  crochet: '/crochet.png',
  ursula: '/ursula.png',
  hades: '/hades.png',
  facilier: '/facilier.png',
  imposteur: '/imposteur2_zoom.jpg',
  bowser: '/bowser.png',
  mechanteReine: '/mechante-reine.png',
  scar: '/scar.png',
  yzma: '/yzma.png',
  ratigan: '/ratigan.png',
  sombra: '/sombra.jpg',
  patHibulaire: '/pat-hibulaire.png',
  gothel: '/gothel.png',
  cruella: '/cruella.png',
  gaston: '/gaston.png',
  seigneurCles: '/seigneur-cles.png',
  madameTremaine: '/madame-tremaine.png',
}

/** Portrait d'un vilain, avec repli sur son dos de carte si non défini. */
export function villainPortrait(key: VillainKey): string {
  return PORTRAIT[key] ?? VILLAIN_REGISTRY[key].def.backVillainImage
}

/** Illustrations de présentation « en grand » (corps entier), par vilain. */
const PRESENTATION: Partial<Record<VillainKey, string>> = {
  princeJohn: '/presentations/princeJohn.png',
  maleficent: '/presentations/maleficent.png',
  jafar: '/presentations/jafar.png',
  reineCoeur: '/presentations/reineCoeur.png',
  crochet: '/presentations/crochet.png',
  slenderman: '/presentations/slenderman.png',
  ursula: '/presentations/ursula.png',
  hades: '/presentations/hades.png',
  facilier: '/presentations/facilier.png',
  imposteur: '/presentations/imposteur.png',
  bowser: '/presentations/bowser.png',
  mechanteReine: '/presentations/mechante-reine.png',
  scar: '/presentations/scar.png',
  yzma: '/presentations/yzma.png',
  ratigan: '/presentations/ratigan.png',
  sombra: '/presentations/sombra.png',
  patHibulaire: '/presentations/pat_hibulaire.png',
  gothel: '/presentations/gothel.png',
  cruella: '/presentations/cruella.png',
  gaston: '/presentations/gaston.png',
  seigneurCles: '/presentations/seigneur-cles.png',
  madameTremaine: '/presentations/madame-tremaine.png',
}

/** Illustration de présentation d'un vilain (undefined si non disponible). */
export function villainPresentation(key: VillainKey): string | undefined {
  return PRESENTATION[key]
}

/** Réglage EXCEPTIONNEL de la présentation par vilain (l'illustration de base est
 *  pensée pour remplir la hauteur). `scale` rétrécit, `dxPct`/`dyPct` décalent en
 *  % de la taille de l'image (dx > 0 = vers la droite ; dy > 0 = vers le bas, le
 *  personnage descend sous le bord, derrière le footer). Origine = bas. */
export const PRESENTATION_TWEAK: Partial<
  Record<VillainKey, { scale?: number; dxPct?: number; dyPct?: number; versusDyPct?: number }>
> = {
  // `versusDyPct` : décalage vertical SPÉCIFIQUE à l'écran versus (début de partie),
  // sinon on reprend `dyPct` (écran de choix).
  imposteur: { scale: 0.55, dxPct: 0, dyPct: -5, versusDyPct: -12 },
  // Mère Gothel : illustration légèrement trop grande → on la rétrécit un poil, et
  // un peu trop haute sur l'écran de choix → on la descend légèrement.
  gothel: { scale: 0.9, dyPct: 4 },
  // Le Seigneur des clés : on baisse légèrement sa position (sans le rétrécir).
  seigneurCles: { dyPct: 6 },
}
