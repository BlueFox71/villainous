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
 *  Les entrées sont éditables EN DIRECT par le panneau « Configuration » de l'écran
 *  de choix des vilains (dév uniquement) : il réécrit ce bloc via l'endpoint
 *  `/__save-presentation-tweak`. Elles restent modifiables à la main. */
export const PRESENTATION_TWEAK: Record<
  string,
  {
    scale?: number
    dxPct?: number
    dyPct?: number
    versusDyPct?: number
    /** Art de côté (choix + versus) : décalage horizontal VERS LE CENTRE. */
    selectDxPct?: number
    /** Art de côté de l'écran de CHOIX : décalage vertical (négatif = vers le haut).
     *  Champ dédié — l'illustration y est posée sur le bas de l'écran, le `dyPct` de
     *  la fiche n'a pas le même point de départ. */
    selectDyPct?: number
  }
> = {
  // `versusDyPct` : décalage vertical SPÉCIFIQUE à l'écran versus (début de partie),
  // sinon on reprend `dyPct` (écran de choix).
  imposteur: { scale: 0.55, dxPct: 0, dyPct: -5, versusDyPct: -12 },
  // Mère Gothel : illustration un peu trop petite et trop haute aux deux endroits
  // (choix ET versus) → on l'agrandit légèrement et on la descend (dyPct/versusDyPct
  // positifs = vers le bas).
  gothel: { scale: 1.05, dyPct: 10, versusDyPct: 8 },
  // Le Seigneur des clés (custom) : on baisse légèrement sa position (sans le rétrécir).
  'custom-seigneur-cles': { dyPct: 6 },
  // Maléfique : nouvelle illustration carrée (1000×1000) — on la remonte pour caler la
  // figure dans le cadre (négatif = vers le haut).
  maleficent: { dyPct: -6 },
  // Pyramid Head (custom) : décalé vers la gauche dans la FICHE (dxPct). Sur l'art de côté
  // (choix + versus), `selectDxPct` est un décalage VERS LE CENTRE (côté joueur = vers la
  // droite, côté adversaire = vers la gauche).
  'custom-pyramid-head': { dxPct: -14, selectDxPct: 15 },
  // Mr. Monopoly (custom) : présentation rétrécie, bien décalée à gauche dans la FICHE ;
  // tirée vers le centre sur l'art de côté.
  'custom-mr-monopoly': { scale: 0.85, dxPct: -30, selectDxPct: 15 },
  // Isabella (custom) : illustration un peu trop grande → légèrement rétrécie.
  'custom-isabella': { scale: 0.9 },
  // >>> PRESENTATION_TWEAK entries (panneau « Configuration ») — nouvelles entrées ici <<<
}

/** Brouillon de réglage manipulé par le panneau « Configuration » (dév) : les trois
 *  champs de `PRESENTATION_TWEAK` qui pilotent l'art de côté de l'écran de choix. */
export interface ArtTweakDraft {
  /** Échelle (1 = taille naturelle) — `scale`, PARTAGÉ avec la fiche et l'écran versus. */
  scale: number
  /** Décalage horizontal VERS LE CENTRE, en % — `selectDxPct`. */
  dx: number
  /** Décalage vertical, en % (négatif = vers le haut) — `selectDyPct`. */
  dy: number
}

/** Réglage ENREGISTRÉ d'un vilain (valeurs neutres s'il n'en a pas). */
export function savedArtTweak(villain: string): ArtTweakDraft {
  const t = PRESENTATION_TWEAK[villain]
  return { scale: t?.scale ?? 1, dx: t?.selectDxPct ?? 0, dy: t?.selectDyPct ?? 0 }
}

/**
 * Ligne `  <clé>: { … },` à réécrire dans `PRESENTATION_TWEAK` (panneau « Configuration »).
 * On PART des champs déjà enregistrés (`dxPct`, `dyPct`, `versusDyPct`… que le panneau ne
 * touche pas) et on n'écrase que les trois réglés ; une valeur neutre RETIRE son champ.
 * Chaîne vide = plus aucun champ, l'entrée est supprimée du fichier.
 */
export function buildArtTweakEntry(villain: string, draft: ArtTweakDraft): string {
  const merged: Record<string, number> = { ...PRESENTATION_TWEAK[villain] }
  const put = (key: string, value: number, neutral: number) => {
    if (value === neutral) delete merged[key]
    else merged[key] = value
  }
  put('scale', Math.round(draft.scale * 100) / 100, 1)
  put('selectDxPct', Math.round(draft.dx), 0)
  put('selectDyPct', Math.round(draft.dy), 0)
  const parts = Object.entries(merged).map(([k, v]) => `${k}: ${v}`)
  if (!parts.length) return ''
  // Clé nue si c'est un identifiant JS valide (vilains natifs), quotée sinon (`custom-…`).
  const key = /^[A-Za-z_$][\w$]*$/.test(villain) ? villain : `'${villain}'`
  return `  ${key}: { ${parts.join(', ')} },`
}
