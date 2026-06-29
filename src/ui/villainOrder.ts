// =============================================================================
// Ordre de SORTIE des vilains — source de vérité PARTAGÉE.
//
// Sert partout où l'on affiche la liste des vilains (galerie, choix des vilains,
// outils de dév…) pour garder un ordre cohérent : les Disney/Pixar dans leur
// ordre de sortie, puis les Collaborations. Le tableau plat couvre TOUS les
// vilains natifs ; les vilains publiés (custom-…), absents d'ici, se classent
// après (rang naturel).
// =============================================================================

import { COLLAB_VILLAINS, type VillainKey } from './store/gameStore'
import { villainCreator } from './villainPacks'

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
