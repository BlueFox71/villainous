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
}

/** Portrait d'un vilain, avec repli sur son dos de carte si non défini. */
export function villainPortrait(key: VillainKey): string {
  return PORTRAIT[key] ?? VILLAIN_REGISTRY[key].def.backVillainImage
}
