// =============================================================================
// Patch de COMPORTEMENT du vilain PERSONNALISÉ « Pyramid Head » (id `custom-pyramid-head`).
//
// L'éditeur ne produit que la DONNÉE visuelle des cartes (texte, coût…). Ce module
// rebranche les `effects`/champs de jeu et fixe le vrai objectif (JUDGMENT_TILES_ALL),
// comme `customDio.ts`.
//
// PHASE 1 (cœur jouable) : tuiles de Jugement (Rites / Propager / Dissipation), souffrance
// (Métatron), + quelques effets réutilisés (Fanatisme, Châtiment des damnés). Les cartes
// restantes (Cage, Jugement Final, Protection de l'âme, héros Fatalité, Pénitence, etc.)
// arrivent en PHASE 2.
// =============================================================================

import type { Effect, ObjectiveDef } from '../../engine/types'
import type { CustomVillain, CustomCard } from '../customVillain'
import { slugify } from '../customVillain'

export const CUSTOM_PYRAMID_HEAD_ID = 'custom-pyramid-head'

const PREFIX = 'custom-pyramid-head-'
const e = (...effects: Effect[]) => effects

/** Slug d'une carte (préfixe retiré) ; retombe sur le slug du NOM si l'id est un
 *  placeholder éditeur `custom-pyramid-head-cN`. */
function slugOf(c: CustomCard): string {
  const s = c.id.startsWith(PREFIX) ? c.id.slice(PREFIX.length) : c.id
  return /^c\d+$/.test(s) ? slugify(c.name) : s
}

/** Champs de jeu par slug de carte. */
const FIELDS: Record<string, Partial<CustomCard>> = {
  // --- Mécanique des tuiles de Jugement -------------------------------------
  // Rites de Jugement : Objet posé à SILENT HILL (lieu le plus à droite, `loc-1`),
  // indéfaussable ; pose la 1ʳᵉ tuile de Jugement.
  'rites-de-jugement': { playOnlyAt: 'loc-1', cannotBeDiscarded: true, effects: e({ type: 'PYRAMID_PLACE_RITES' }) },
  'propager-la-souffrance': { effects: e({ type: 'PYRAMID_PROPAGATE' }) },
  // Métatron : capacité ACTIVÉE — payer 3 Pouvoir pour gagner 1 piste de souffrance.
  metatron: { activatedCost: 3, activatedEffects: e({ type: 'GAIN_SOUFFRANCE', amount: 1 }) },
  // Dissipation (Fatalité) : retire la tuile de Jugement la plus à gauche.
  dissipation: { effects: e({ type: 'PYRAMID_REMOVE_TILE' }) },

  // --- Deck Méchant : effets / alliés ---------------------------------------
  fanatisme: { effects: e({ type: 'DIO_DISCARD_ALLY_DRAW', count: 3 }) },
  'chatiment-des-damnes': { effects: e({ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }) },
  // Jugement Final : éliminer un Héros (réutilise le ciblage interactif INSTANT_VANQUISH ;
  // sans plafond de force).
  'jugement-final': { effects: e({ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 99 }) },
  // Lien mortel : déplacer ses Alliés (jusqu'à 6) vers d'autres lieux (choix interactif).
  'lien-mortel': { effects: e({ type: 'RELOCATE_ALLIES', count: 6, title: 'Lien mortel' }) },
  // Infirmière : +1 Force par AUTRE Infirmière sur son lieu.
  infirmiere: { selfStrengthMods: [{ kind: 'per-other-same-here', delta: 1 }] },
  // Mannequin : son lieu gagne l'action « Activer une capacité ».
  mannequin: { grantsAction: { type: 'ACTIVATE', label: 'Activer une capacité' } },
  // Pénitence forcée (Condition) : réaction à une Fatalité → jouer la 1ʳᵉ carte Fatalité
  // de l'adversaire (cf. branche `penitence-forcee` dans resolveConditionEffect).
  'penitence-forcee': { trigger: { type: 'opponent-fate-targeted-me' } },
  // Alliance inhibée (Condition) : réaction quand l'adversaire élimine un Héros → éliminer
  // un Héros de force ≤ celle éliminée (branche dédiée dans resolveConditionEffect).
  'alliance-inhibee': { trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 } },

  // --- Deck Fatalité --------------------------------------------------------
  // Héros Joestar/Silent Hill : RETIRÉS DU JEU non — passifs propres.
  'james-sunderland': { disablesMetatron: true, onPlace: e({ type: 'DISCARD_REALM_CARD', cardId: 'custom-pyramid-head-metatron' }) },
  maria: { blocksJudgmentTile: true },
  laura: { souffranceSurcharge: true },
  eddie: { immuneToCage: true },
  angela: { onPlace: e({ type: 'LOSE_SOUFFRANCE', amount: 1 }) },
  'farce-de-laura': { effects: e({ type: 'LOSE_POWER', amount: 2 }) },
  redemption: { effects: e({ type: 'DISCARD_OWN_CARDS', count: 2 }) },
  // Protection de l'âme : Objet Fatalité associé à un Héros → il ne peut plus être éliminé.
  'protection-de-l-ame': { attach: 'hero', shieldsHostFromVanquish: true },
}

/** Transforme le vilain custom-pyramid-head en version JOUABLE : champs de jeu + objectif. */
export function patchCustomPyramidHead(v: CustomVillain): CustomVillain {
  const cards: CustomCard[] = v.cards.map((c) => ({ ...c, ...(FIELDS[slugOf(c)] ?? {}) }))
  const objective: ObjectiveDef = { type: 'JUDGMENT_TILES_ALL' }
  return { ...v, objective, cards }
}
