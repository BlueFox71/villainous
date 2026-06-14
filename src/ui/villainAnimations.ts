import type { VillainKey } from './store/gameStore'

/** Décor animé d'arrière-plan propre à un vilain : un objet/personnage qui
 *  traverse lentement la bande haute de l'écran pendant la partie (purement
 *  décoratif). Data-driven, à la manière de `villainArt.ts` : ajouter un vilain
 *  = une entrée ici + l'image dans `public/animations/`. */
export interface VillainAnimation {
  /** Image dans `public/` (ex. `/animations/bateau_bowser.png`). */
  image: string
  /** Hauteur de l'élément en % de la hauteur d'écran (défaut 8 %). */
  heightPct?: number
  /** Durée d'une traversée complète, en secondes (défaut 30 s). */
  durationSec?: number
  /** L'image regarde-t-elle vers la GAUCHE au naturel ? Sert à orienter le
   *  vaisseau dans son sens de déplacement (défaut : regarde à droite). */
  facesLeft?: boolean
  /** Trajectoire :
   *  - `cross` (défaut) : traversée linéaire de la bande haute (sens selon camp).
   *  - `fate-to-sky` : part de la pile Fatalité du camp, monte au-dessus de la
   *    case « Tour » et sort par le haut de l'écran (ancré aux éléments réels). */
  path?: 'cross' | 'fate-to-sky'
}

export const VILLAIN_ANIMATION: Partial<Record<VillainKey, VillainAnimation>> = {
  // Bowser (Super Mario Galaxy) : le bateau pirate volant décolle de la pile
  // Fatalité et s'élève dans le ciel jusqu'à sortir de l'écran.
  bowser: { image: '/animations/bateau_bowser.png', heightPct: 12, durationSec: 20, facesLeft: true, path: 'fate-to-sky' },
}

/** Animation de décor d'un vilain (undefined si non défini). */
export function villainAnimation(key: VillainKey): VillainAnimation | undefined {
  return VILLAIN_ANIMATION[key]
}
