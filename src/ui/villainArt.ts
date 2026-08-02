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
  tabbou: '/tabbou.jpg',
  mechanteReine: '/mechante-reine.png',
  scar: '/scar.png',
  yzma: '/yzma.png',
  ratigan: '/ratigan.png',
  sombra: '/sombra.jpg',
  patHibulaire: '/pat-hibulaire.png',
  gothel: '/gothel.png',
  cruella: '/cruella.png',
  gaston: '/gaston.png',
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
  thanos: '/thanos.png',
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
  tabbou: '/presentations/tabbou.png',
  mechanteReine: '/presentations/mechante-reine.png',
  scar: '/presentations/scar.png',
  yzma: '/presentations/yzma.png',
  ratigan: '/presentations/ratigan.png',
  sombra: '/presentations/sombra.png',
  patHibulaire: '/presentations/pat_hibulaire.png',
  gothel: '/presentations/gothel.png',
  cruella: '/presentations/cruella.png',
  gaston: '/presentations/gaston.png',
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
  thanos: '/presentations/thanos.png',
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
 *  personnage descend sous le bord, derrière le footer). Origine = bas.
 *
 *  TROIS ÉCRANS, TROIS JEUX DE CHAMPS — aucun n'est partagé, car les cadrages n'ont
 *  rien à voir (la fiche pose l'illustration dans un encart, le versus et le choix la
 *  dressent sur un bord d'écran, à des tailles différentes) :
 *   - FICHE (`VillainDetailModal`) : `scale`, `dxPct`, `dyPct`.
 *   - VERSUS (`StartRollModal`) : `versusDxPct`/`versusDyPct`, sinon repli sur les
 *     champs de la fiche.
 *   - CHOIX (`VillainSelect`) : les champs `select…` UNIQUEMENT — ce sont les seuls que
 *     le panneau « Configuration » écrit, et ils ne débordent sur aucun autre écran.
 *
 *  Les entrées `select…` sont éditables EN DIRECT par le panneau « Configuration » de
 *  l'écran de choix des vilains (dév uniquement) : il réécrit ce bloc via l'endpoint
 *  `/__save-presentation-tweak`. Toutes restent modifiables à la main. */
export const PRESENTATION_TWEAK: Record<
  string,
  {
    scale?: number
    dxPct?: number
    dyPct?: number
    /** Écran VERSUS : décalage horizontal VERS LE CENTRE (l'illustration y est collée
     *  à un bord). Sinon repli sur le `dxPct` de la fiche. */
    versusDxPct?: number
    /** Écran VERSUS : décalage vertical. Sinon repli sur le `dyPct` de la fiche. */
    versusDyPct?: number
    /** Écran de CHOIX : échelle (1 = taille naturelle). Champ dédié — l'illustration y
     *  est bien plus grande que dans la fiche, le `scale` de celle-ci n'a pas la même
     *  échelle de départ. */
    selectScale?: number
    /** Écran de CHOIX : décalage horizontal VERS LE CENTRE. */
    selectDxPct?: number
    /** Écran de CHOIX : décalage vertical (négatif = vers le haut). L'illustration y est
     *  posée sur le bas de l'écran, le `dyPct` de la fiche n'a pas le même point de départ. */
    selectDyPct?: number
    /** Écran de CHOIX : INVERSE le miroir. Par défaut le vilain de gauche s'affiche tel
     *  quel et celui de droite est retourné (ils se font face) ; une illustration déjà
     *  tournée vers la gauche a besoin de l'inverse. */
    selectMirror?: boolean
    /** ÉCRAN DE CHARGEMENT : échelle du PION dans le carrousel (1 = hauteur calibrée du
     *  plateau, `pawnHeightPx`). N'affecte QUE cet écran — le pion du plateau garde sa
     *  taille. Rattrape les sources hors-gabarit, qui sautent trop petites ou trop
     *  grosses une fois agrandies pour le chargement. */
    loaderPawnScale?: number
  }
> = {
  // `versusDyPct` : décalage vertical SPÉCIFIQUE à l'écran versus (début de partie),
  // sinon on reprend `dyPct` (fiche).
  imposteur: { scale: 0.55, dxPct: 0, dyPct: -5, versusDyPct: -12, selectScale: 0.57, selectDxPct: 11 },
  // Mère Gothel : illustration un peu trop petite et trop haute dans la fiche et au
  // versus → on l'agrandit légèrement et on la descend (dyPct/versusDyPct positifs =
  // vers le bas).
  gothel: { scale: 1.05, dyPct: 10, versusDyPct: 8, selectScale: 1.12, selectDxPct: 15 },
  // Le Seigneur des clés (custom) : on baisse légèrement sa position (sans le rétrécir).
  'custom-seigneur-cles': { dyPct: 6, selectScale: 1.54, selectDxPct: 9, selectDyPct: 2, selectMirror: true },
  // Maléfique : nouvelle illustration carrée (1000×1000) — on la remonte pour caler la
  // figure dans le cadre (négatif = vers le haut).
  maleficent: { dyPct: -6, selectScale: 1.17, selectDxPct: 25 },
  // Pyramid Head (custom) : décalé vers la gauche dans la FICHE (dxPct) ; tiré vers le
  // centre au versus (`versusDxPct`) comme sur l'écran de choix (`selectDxPct`) — côté
  // joueur = vers la droite, côté adversaire = vers la gauche.
  'custom-pyramid-head': { dxPct: -14, versusDxPct: 15, selectScale: 0.86, selectDxPct: 26, selectDyPct: 28 },
  // Mr. Monopoly (custom) : présentation rétrécie, bien décalée à gauche dans la FICHE ;
  // tirée vers le centre sur les bords d'écran (versus + choix).
  'custom-mr-monopoly': { scale: 0.85, dxPct: -30, versusDxPct: 15, selectScale: 0.6, selectDxPct: 23, selectDyPct: 4 },
  // Isabella (custom) : illustration un peu trop grande → légèrement rétrécie.
  'custom-isabella': { scale: 0.9, selectScale: 0.55, selectDxPct: 13 },
  princeJohn: { selectScale: 1.22, selectDxPct: 10, selectDyPct: 6 },
  bowser: { selectScale: 1.14, selectDxPct: 15, selectDyPct: 8 },
  crochet: { selectScale: 1.24, selectDxPct: 10, selectDyPct: 5, selectMirror: true },
  cruella: { selectScale: 1.13, selectDxPct: 19 },
  davyJones: { selectScale: 1.13, selectDxPct: 15 },
  'custom-dio': { selectScale: 1.26, selectDxPct: 18, selectDyPct: 65 },
  facilier: { selectScale: 1.24, selectDxPct: 17, selectDyPct: 5 },
  gaston: { selectScale: 1.06, selectDxPct: 17 },
  'custom-stitch': { selectScale: 0.72, selectDxPct: 17 },
  'custom-gul-dan': { selectScale: 1.22, selectDxPct: 20, selectDyPct: 26 },
  hades: { selectScale: 1.29, selectDxPct: 9, selectDyPct: 7 },
  jafar: { selectScale: 1.27, selectDxPct: 17, selectDyPct: 7 },
  'custom-killaire': { selectScale: 1.06, selectDxPct: 17 },
  mechanteReine: { selectScale: 1.11, selectDxPct: 21 },
  'custom-flagelleur-mental': { selectScale: 2, selectDxPct: 35, selectDyPct: 11, selectMirror: true },
  seigneurTenebres: { selectScale: 1.08, selectDxPct: 16 },
  lotso: { selectScale: 1.03, selectDxPct: 8, selectDyPct: 5 },
  madameTremaine: { selectScale: 1.15, selectDxPct: 17 },
  madameMim: { selectScale: 1.03, selectDxPct: 20 },
  laBonneFee: { selectScale: 1.13, selectDxPct: 11, selectDyPct: 2 },
  'custom-michael-meyers': { selectScale: 0.66, selectDxPct: 19 },
  oogieBoogie: { selectScale: 1.09, selectDxPct: 13 },
  patHibulaire: { selectScale: 0.96, selectDxPct: 15 },
  ratigan: { selectScale: 1.09, selectDxPct: 19 },
  reineCoeur: { selectScale: 1.18, selectDxPct: 20, selectDyPct: 5, selectMirror: true },
  saSucrerie: { selectScale: 0.96, selectDxPct: 23 },
  scar: { selectScale: 1.04, selectDxPct: 11 },
  shereKhan: { selectScale: 1.03, selectDxPct: 20 },
  slenderman: { selectScale: 0.95, selectDxPct: 15, selectDyPct: 14 },
  sombra: { selectScale: 1.14, selectDxPct: 26, selectDyPct: 4 },
  'custom-mrl4fb45': { selectScale: 0.77, selectDxPct: 23 },
  syndrome: { selectDxPct: 25 },
  tabbou: { selectScale: 1.08, selectDxPct: 20, selectDyPct: 5 },
  tamatoa: { selectScale: 0.95, selectDxPct: 19, selectDyPct: 1 },
  teamRocket: { selectDxPct: 20 },
  thanos: { selectDxPct: 11, selectDyPct: 20 },
  'custom-ultron': { selectDxPct: 28, selectDyPct: 9 },
  ursula: { selectScale: 1.12, selectDxPct: 17, selectDyPct: 5, selectMirror: true },
  yzma: { selectScale: 0.98, selectDxPct: 19, selectDyPct: 2 },
  // >>> PRESENTATION_TWEAK entries (panneau « Configuration ») — nouvelles entrées ici <<<
}

/** Brouillon de réglage manipulé par le panneau « Configuration » (dév) : les champs
 *  de `PRESENTATION_TWEAK` qui pilotent l'art de côté de l'écran de choix. Tous sont
 *  PROPRES à cet écran — le panneau ne touche jamais au cadrage de la fiche ni du versus. */
export interface ArtTweakDraft {
  /** Échelle (1 = taille naturelle) — `selectScale`. */
  scale: number
  /** Décalage horizontal VERS LE CENTRE, en % — `selectDxPct`. */
  dx: number
  /** Décalage vertical, en % (négatif = vers le haut) — `selectDyPct`. */
  dy: number
  /** Retourne l'illustration (inverse le miroir par défaut) — `selectMirror`. */
  mirror: boolean
  /** Échelle du PION sur l'écran de chargement — `loaderPawnScale`. Ne touche ni à l'art
   *  de côté, ni au pion du plateau. */
  pawnScale: number
}

/** Réglage ENREGISTRÉ d'un vilain (valeurs neutres s'il n'en a pas). */
export function savedArtTweak(villain: string): ArtTweakDraft {
  const t = PRESENTATION_TWEAK[villain]
  return {
    scale: t?.selectScale ?? 1,
    dx: t?.selectDxPct ?? 0,
    dy: t?.selectDyPct ?? 0,
    mirror: t?.selectMirror ?? false,
    pawnScale: t?.loaderPawnScale ?? 1,
  }
}

/** Échelle du pion d'un vilain sur l'ÉCRAN DE CHARGEMENT (1 = hauteur calibrée du plateau). */
export function loaderPawnScale(villain: string): number {
  return PRESENTATION_TWEAK[villain]?.loaderPawnScale ?? 1
}

/**
 * Ligne `  <clé>: { … },` à réécrire dans `PRESENTATION_TWEAK` (panneau « Configuration »).
 * On PART des champs déjà enregistrés (`scale`, `dxPct`, `dyPct`, `versus…` — le cadrage de
 * la fiche et du versus, que le panneau ne touche pas) et on n'écrase que les `select…`
 * qu'il règle ; une valeur neutre RETIRE son champ. Chaîne vide = plus aucun champ,
 * l'entrée est supprimée du fichier.
 */
export function buildArtTweakEntry(villain: string, draft: ArtTweakDraft): string {
  const merged: Record<string, number | boolean> = { ...PRESENTATION_TWEAK[villain] }
  const put = (key: string, value: number | boolean, neutral: number | boolean) => {
    if (value === neutral) delete merged[key]
    else merged[key] = value
  }
  put('selectScale', Math.round(draft.scale * 100) / 100, 1)
  put('selectDxPct', Math.round(draft.dx), 0)
  put('selectDyPct', Math.round(draft.dy), 0)
  put('selectMirror', draft.mirror, false)
  put('loaderPawnScale', Math.round(draft.pawnScale * 100) / 100, 1)
  const parts = Object.entries(merged).map(([k, v]) => `${k}: ${v}`)
  if (!parts.length) return ''
  // Clé nue si c'est un identifiant JS valide (vilains natifs), quotée sinon (`custom-…`).
  const key = /^[A-Za-z_$][\w$]*$/.test(villain) ? villain : `'${villain}'`
  return `  ${key}: { ${parts.join(', ')} },`
}
