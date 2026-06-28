import { VILLAIN_REGISTRY, isCustomKey, customVillainOf, type VillainKey } from './store/gameStore'

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
  oogieBoogie: '/oogie-boogie.png',
  seigneurTenebres: '/seigneur-tenebres.png',
  madameMim: '/madame-mim.png',
  syndrome: '/syndrome.png',
  lotso: '/lotso.png',
  saSucrerie: '/sa-sucrerie.png',
  shereKhan: '/shere-khan.png',
  davyJones: '/davy-jones.png',
  tamatoa: '/tamatoa.png',
  teamRocket: '/team-rocket.png',
  laBonneFee: '/la-bonne-fee.png',
}

/** Portrait d'un vilain, avec repli sur son dos de carte si non défini. Les vilains
 *  PUBLIÉS (clé `custom-…`) fournissent leur portrait via leur bundle (dataURL). */
export function villainPortrait(key: string): string {
  if (isCustomKey(key)) {
    const c = customVillainOf(key)
    return c?.portrait ?? c?.backVillainImage ?? ''
  }
  return PORTRAIT[key as VillainKey] ?? VILLAIN_REGISTRY[key as VillainKey].def.backVillainImage
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
  oogieBoogie: '/presentations/oogie-boogie.png',
  seigneurTenebres: '/presentations/seigneur-tenebres.png',
  madameMim: '/presentations/madame-mim.png',
  syndrome: '/presentations/syndrome.png',
  lotso: '/presentations/lotso.png',
  saSucrerie: '/presentations/sa-sucrerie.png',
  shereKhan: '/presentations/shere-khan.png',
  davyJones: '/presentations/davy-jones.png',
  tamatoa: '/presentations/tamatoa.png',
  teamRocket: '/presentations/team-rocket.png',
  laBonneFee: '/presentations/la-bonne-fee.png',
}

/** Illustration de présentation d'un vilain (undefined si non disponible). Les
 *  vilains PUBLIÉS retombent sur leur illustration de présentation (dataURL). */
export function villainPresentation(key: string): string | undefined {
  if (isCustomKey(key)) return customVillainOf(key)?.presentation
  return PRESENTATION[key as VillainKey]
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
  // un peu trop haute sur l'écran de choix → on la descend légèrement. Sur l'écran
  // versus, en revanche, elle est trop BASSE → on la remonte (versusDyPct négatif).
  gothel: { scale: 0.9, dyPct: 4, versusDyPct: -6 },
  // Le Seigneur des clés : on baisse légèrement sa position (sans le rétrécir).
  seigneurCles: { dyPct: 6 },
  // Maléfique : nouvelle illustration carrée (1000×1000) — on la remonte pour caler la
  // figure dans le cadre (négatif = vers le haut).
  maleficent: { dyPct: -6 },
}
