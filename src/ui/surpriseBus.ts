// Bus de déclenchement des « surprises » de décor (MODE TEST). Les surprises de
// chaque vilain sont jouées par des timers internes à leur composant décor ; ce bus
// permet à l'outil de test de les déclencher à la demande, par CÔTÉ (le décor du
// joueur est rendu à gauche, l'adversaire à droite). Hors moteur, pure présentation.

import { villainDecor, type VillainDecor } from './villainDecor'
import type { VillainKey } from './store/gameStore'

type Side = 'left' | 'right'

// Kinds de décor qui exposent une SURPRISE déclenchable (mode test). À GARDER EN PHASE avec les
// décors de `components/VillainDecor.tsx` qui appellent `useSurpriseSub`. Sert à (dé)activer le
// bouton « Surprise » de l'outil de test.
const SURPRISE_KINDS = new Set<VillainDecor['kind']>([
  'underworld', 'goldenHair', 'forest', 'grotto', 'voodoo', 'galaxy', 'scar', 'yzma',
  'clockwork', 'cruella', 'tremaine', 'syndrome', 'cyber', 'castleAssault', 'mim',
  'cauldron', 'sunnyside', 'oogie', 'jungle', 'teamRocket', 'flyingDutchman', 'tamatoa',
  'underwater', 'upsideDown', 'rift', 'radiance', 'monopoly', 'atmosfear',
])

/** Vrai si le vilain a une surprise de décor déclenchable (mode test). Accepte une clé NATIVE
 *  (`VillainKey`) OU un id de vilain PUBLIÉ (`custom-…`) — `villainDecor` résout les deux. */
export function villainHasSurprise(villain: VillainKey | string): boolean {
  const decor = villainDecor(villain)
  return !!decor && SURPRISE_KINDS.has(decor.kind)
}

const listeners: Record<Side, Set<() => void>> = { left: new Set(), right: new Set() }

/** Abonne un décor (par côté) au déclencheur de surprise. Renvoie le désabonnement. */
export function onSurprise(side: Side, fn: () => void): () => void {
  listeners[side].add(fn)
  return () => {
    listeners[side].delete(fn)
  }
}

/** Déclenche la surprise du décor du côté donné (joueur = left, adversaire = right). */
export function fireSurprise(side: Side): void {
  for (const fn of [...listeners[side]]) fn()
}
