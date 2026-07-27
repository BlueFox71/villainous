// Catalogue des types d'action de plateau proposés par l'éditeur, et libellés
// associés. Module SANS composant (l'onglet « Plateau » ne doit exporter que des
// composants — cf. react-refresh) : consommé par `BoardTab.tsx` et ses tests.
import type { LocationActionType } from '../../engine/types'

/** Types d'action GÉNÉRIQUES exposés à l'éditeur (tous gérés génériquement par le
 *  moteur, sans mécanique propre à un vilain). On exclut les actions spéciales
 *  (BREW_POISON, OBTAIN_KEY…) qui supposent une mécanique dédiée. */
const ACTION_TYPES: { value: LocationActionType; label: string; defaultLabel: string }[] = [
  { value: 'GAIN_POWER', label: 'Gagner du pouvoir', defaultLabel: 'Gagner du pouvoir' },
  { value: 'PLAY_CARD', label: 'Jouer une carte', defaultLabel: 'Jouer une carte' },
  { value: 'FATE', label: 'Fatalité', defaultLabel: 'Fatalité' },
  { value: 'MOVE_ITEM_ALLY', label: 'Déplacer un objet/allié', defaultLabel: 'Déplacer un objet ou un allié' },
  { value: 'MOVE_HERO', label: 'Déplacer un héros', defaultLabel: 'Déplacer un héros' },
  { value: 'VANQUISH', label: 'Vaincre un héros', defaultLabel: 'Vaincre un héros' },
  { value: 'DISCARD_CARDS', label: 'Défausser', defaultLabel: 'Défausser des cartes' },
  { value: 'ACTIVATE', label: 'Activer une capacité', defaultLabel: 'Activer une capacité' },
  // Action PERSONNALISÉE : aucune mécanique générique (effet « à coder au test »),
  // icône importée + libellé libre décrivant l'effet.
  { value: 'CUSTOM', label: 'Personnalisée (icône + effet décrit)', defaultLabel: 'Action personnalisée' },
]

/** Libellés lisibles des types SPÉCIAUX (mécanique dédiée à un vilain) qui peuvent
 *  déjà exister sur un plateau mais ne sont PAS proposés à la création dans l'éditeur.
 *  On les affiche en clair pour ne pas les écraser silencieusement à l'édition. */
const SPECIAL_TYPE_LABELS: Partial<Record<LocationActionType, string>> = {
  BREW_POISON: 'Préparer du poison (spéciale)',
  OBTAIN_KEY: 'Obtenir une clé (spéciale)',
  CATCH_POKEMON: 'Attraper un Pokémon (spéciale)',
  REVEAL_FIGHTER: 'Dévoiler un combattant (spéciale)',
}

/** Options du sélecteur de type pour UNE action : les types génériques + le type
 *  courant s'il est SPÉCIAL (préservé, non clobberé) avec un libellé explicite. */
export function typeOptionsFor(type: LocationActionType): { value: LocationActionType; label: string }[] {
  const opts = ACTION_TYPES.map((t) => ({ value: t.value, label: t.label }))
  if (!opts.some((o) => o.value === type)) {
    opts.push({ value: type, label: SPECIAL_TYPE_LABELS[type] ?? `${type} (spéciale)` })
  }
  return opts
}

/** Une action porte-t-elle un LIBELLÉ libre éditable ? Vrai pour les actions
 *  personnalisées et les actions spéciales (leur texte n'est pas dérivé d'un type
 *  générique). Les types génériques gardent un libellé auto (dérivé du type). */
export function hasFreeLabel(type: LocationActionType): boolean {
  return type === 'CUSTOM' || !ACTION_TYPES.some((t) => t.value === type)
}

/** Libellé par défaut d'une action selon son type (et son montant). */
export function defaultLabelFor(type: LocationActionType, amount?: number): string {
  if (type === 'GAIN_POWER') return `Gagner ${amount ?? 1} pouvoir`
  return ACTION_TYPES.find((t) => t.value === type)?.defaultLabel ?? type
}
