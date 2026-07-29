// =============================================================================
// Ordre de SORTIE des vilains — source de vérité PARTAGÉE.
//
// Sert partout où l'on affiche la liste des vilains (galerie, choix des vilains,
// outils de dév…) pour garder un ordre cohérent : les Disney/Pixar dans leur
// ordre de sortie, puis les Collaborations. Le tableau plat couvre TOUS les
// vilains natifs ; les vilains publiés (custom-…), absents d'ici, se classent
// après (rang naturel).
// =============================================================================

import { COLLAB_VILLAINS, MARVEL_VILLAINS, customVillainOf, isCustomKey, type VillainKey } from './store/gameStore'
import { villainCreator } from './villainPacks'
import type { VillainOrigin } from '../data/customVillain'

/** Vilains Disney/Pixar dans leur ordre de sortie (les Collaborations suivent). */
export const DISNEY_RELEASE_ORDER: VillainKey[] = [
  'princeJohn', 'maleficent', 'jafar', 'reineCoeur', 'crochet', 'ursula', 'hades',
  'facilier', 'mechanteReine', 'scar', 'yzma', 'ratigan', 'patHibulaire', 'gothel',
  'cruella', 'gaston', 'madameTremaine', 'seigneurTenebres', 'madameMim', 'syndrome',
  'lotso', 'oogieBoogie', 'saSucrerie', 'shereKhan', 'davyJones', 'tamatoa',
]

/** Ordre des créateurs au sein des Collaborations (les autres suivent, ordre alpha). */
export const CREATOR_ORDER = ['Jules', 'Alexis']

/** Rang d'un créateur (les non listés passent après, par ordre alpha à rang égal). */
function creatorRank(creator: string | undefined): number {
  const i = creator ? CREATOR_ORDER.indexOf(creator) : -1
  return i >= 0 ? i : CREATOR_ORDER.length
}

/** Collaborations triées par CRÉATEUR (Jules puis Alexis…), ordre de sortie à créateur égal. */
export const COLLAB_RELEASE_ORDER: VillainKey[] = [...COLLAB_VILLAINS].sort((a, b) => {
  const ca = villainCreator(a), cb = villainCreator(b)
  return creatorRank(ca) - creatorRank(cb) || (ca ?? '').localeCompare(cb ?? '', 'fr')
})

/** Tous les vilains natifs, à plat, dans l'ordre de sortie (Disney puis Collaborations
 *  groupées par créateur). */
export const VILLAIN_RELEASE_ORDER: VillainKey[] = [...DISNEY_RELEASE_ORDER, ...COLLAB_RELEASE_ORDER]

/** Rang de sortie d'une clé de vilain (les inconnues — publiés… — passent après). */
const RELEASE_INDEX = new Map(VILLAIN_RELEASE_ORDER.map((k, i) => [k as string, i]))
export function releaseRank(key: string): number {
  return RELEASE_INDEX.get(key) ?? Number.MAX_SAFE_INTEGER
}

/** Comparateur de tri par ordre de sortie (stable : les inconnus gardent leur ordre relatif). */
export function byRelease(a: string, b: string): number {
  return releaseRank(a) - releaseRank(b)
}

// --- Origine (univers) d'un vilain -----------------------------------------
// Même taxonomie que les sections de la galerie. La règle vit ICI (et non dupliquée
// par écran) pour que la galerie et le choix des vilains ne divergent jamais.

/** Univers affichés, dans l'ordre des sections. */
export const VILLAIN_ORIGINS: VillainOrigin[] = ['Disney', 'Marvel', 'Collaborations']

/** Libellé affiché par origine (la clé reste interne aux données/filtres). */
export const ORIGIN_LABELS: Record<VillainOrigin, string> = {
  Disney: 'Disney / Pixar',
  Marvel: 'Marvel',
  Collaborations: 'Collaborations',
}

/** Univers d'un vilain, natif OU publié. Un vilain publié porte son `origin` (choisi
 *  à la publication) ; un natif se déduit des listes de `gameStore`. Repli sur
 *  « Collaborations » : un publié sans `origin` n'est jamais un Disney officiel. */
export function villainOrigin(key: string): VillainOrigin {
  if (isCustomKey(key)) return customVillainOf(key)?.origin ?? 'Collaborations'
  if ((MARVEL_VILLAINS as string[]).includes(key)) return 'Marvel'
  if ((COLLAB_VILLAINS as string[]).includes(key)) return 'Collaborations'
  return 'Disney'
}
