// =============================================================================
// Catalogue d'EFFETS jouables exposés par l'éditeur.
//
// On n'expose qu'un sous-ensemble de variantes `Effect` GÉNÉRIQUES, qui se
// résolvent sur le joueur actif / le royaume sans dépendre d'une mécanique propre
// à un vilain (jetons spéciaux, dé, états dédiés…). Chaque entrée décrit ses
// paramètres numériques et sait construire l'objet `Effect` + un résumé lisible.
//
// Ajouter une entrée ici = rendre un nouvel effet disponible dans l'éditeur, à
// condition que le moteur (engine/effects.ts) le gère déjà de façon générique.
// =============================================================================

import type { Effect } from '../../engine/types'

export interface EffectParam {
  key: string
  label: string
  min: number
  max: number
  default: number
}

export interface EffectCatalogEntry {
  /** `type` de l'Effect produit (clé d'identification). */
  key: string
  label: string
  description: string
  params: EffectParam[]
  build: (v: Record<string, number>) => Effect
  summary: (v: Record<string, number>) => string
}

const p = (key: string, label: string, def: number, min = 1, max = 9): EffectParam => ({
  key,
  label,
  min,
  max,
  default: def,
})

export const EFFECT_CATALOG: EffectCatalogEntry[] = [
  {
    key: 'GAIN_POWER',
    label: 'Gagner du pouvoir',
    description: 'Le vilain gagne un nombre fixe de jetons Pouvoir.',
    params: [p('amount', 'Pouvoir gagné', 2)],
    build: (v) => ({ type: 'GAIN_POWER', amount: v.amount }),
    summary: (v) => `Gagnez ${v.amount} pouvoir.`,
  },
  {
    key: 'DRAW_CARDS',
    label: 'Piocher des cartes',
    description: 'Le vilain pioche un nombre de cartes.',
    params: [p('count', 'Cartes piochées', 1, 1, 5)],
    build: (v) => ({ type: 'DRAW_CARDS', count: v.count }),
    summary: (v) => `Piochez ${v.count} carte${v.count > 1 ? 's' : ''}.`,
  },
  {
    key: 'GAIN_POWER_PER_HERO_IN_REALM',
    label: 'Pouvoir par Héros',
    description: 'Gagne du pouvoir pour chaque Héros présent dans le royaume.',
    params: [p('amount', 'Pouvoir par Héros', 1, 1, 5)],
    build: (v) => ({ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: v.amount }),
    summary: (v) => `Gagnez ${v.amount} pouvoir par Héros dans votre royaume.`,
  },
  {
    key: 'GAIN_POWER_PER_ALLY_IN_REALM',
    label: 'Pouvoir par Allié',
    description: 'Gagne du pouvoir pour chaque Allié présent dans le royaume.',
    params: [p('amount', 'Pouvoir par Allié', 1, 1, 5)],
    build: (v) => ({ type: 'GAIN_POWER_PER_ALLY_IN_REALM', amount: v.amount }),
    summary: (v) => `Gagnez ${v.amount} pouvoir par Allié dans votre royaume.`,
  },
  {
    key: 'LOSE_POWER_DRAW',
    label: 'Payer pour piocher',
    description: 'Le vilain perd du pouvoir puis pioche des cartes.',
    params: [p('lose', 'Pouvoir perdu', 1, 0, 5), p('draw', 'Cartes piochées', 2, 1, 5)],
    build: (v) => ({ type: 'LOSE_POWER_DRAW', lose: v.lose, draw: v.draw }),
    summary: (v) => `Perdez ${v.lose} pouvoir, puis piochez ${v.draw} carte${v.draw > 1 ? 's' : ''}.`,
  },
  {
    key: 'DISCARD_HAND_DRAW',
    label: 'Défausser et repiocher',
    description: 'Le vilain défausse toute sa main puis pioche un nombre fixe.',
    params: [p('draw', 'Cartes piochées', 3, 1, 6)],
    build: (v) => ({ type: 'DISCARD_HAND_DRAW', draw: v.draw }),
    summary: (v) => `Défaussez votre main, puis piochez ${v.draw} cartes.`,
  },
]

/** Retrouve l'entrée de catalogue d'un Effect (par son `type`). */
export function catalogEntryOf(effect: Effect): EffectCatalogEntry | undefined {
  return EFFECT_CATALOG.find((e) => e.key === effect.type)
}

/** Extrait les valeurs des paramètres d'un Effect existant (pour ré-édition). */
export function paramsOf(effect: Effect, entry: EffectCatalogEntry): Record<string, number> {
  const rec = effect as unknown as Record<string, number>
  const out: Record<string, number> = {}
  for (const param of entry.params) out[param.key] = rec[param.key] ?? param.default
  return out
}

/** Résumé lisible d'un Effect (pour la liste). */
export function summarizeEffect(effect: Effect): string {
  const entry = catalogEntryOf(effect)
  if (!entry) return effect.type
  return entry.summary(paramsOf(effect, entry))
}
