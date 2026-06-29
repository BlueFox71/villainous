// =============================================================================
// Patch de COMPORTEMENT du vilain PERSONNALISÉ « Mr. Monopoly » (id `custom-mr-monopoly`).
//
// L'éditeur ne produit que la DONNÉE visuelle des cartes. Ce module rebranche les
// `effects`/champs de jeu et fixe l'objectif (POWER_THRESHOLD 30), comme `customDio.ts`
// et `customPyramidHead.ts`.
//
// Mécanique : MAISONS posées sur les lieux du royaume ADVERSE (coût 1, 2 sur le repaire =
// lieu le plus à gauche), plafond 4 = HÔTEL. Quand le pion adverse arrive sur un lieu
// maisonné, Mr. Monopoly encaisse le LOYER (= Σ coût des maisons). But : ≥ 30 Pouvoir.
//
// ⚠️ PHASE 2 en cours : certaines cartes complexes restent « texte seul » (TODO) en
// attendant leur implémentation fidèle (Reculez de 3 cases, Monopoly/Monotonie, Officier,
// Canne, Rénovation, Règles inventées, Libéré de prison, Voiture, Chien, Chaussure).
// =============================================================================

import type { Effect, ObjectiveDef } from '../../engine/types'
import type { CustomVillain, CustomCard } from '../customVillain'
import { slugify } from '../customVillain'

export const CUSTOM_MONOPOLY_ID = 'custom-mr-monopoly'

const PREFIX = 'custom-mr-monopoly-'
const e = (...effects: Effect[]) => effects

/** Slug d'une carte (préfixe retiré) ; retombe sur le slug du NOM si l'id est un
 *  placeholder éditeur `custom-mr-monopoly-cN`. */
function slugOf(c: CustomCard): string {
  const s = c.id.startsWith(PREFIX) ? c.id.slice(PREFIX.length) : c.id
  return /^c\d+$/.test(s) ? slugify(c.name) : s
}

/** Champs de jeu par slug de carte. */
const FIELDS: Record<string, Partial<CustomCard>> = {
  // --- Deck VILAIN : économie des maisons ----------------------------------
  // Affaire : pose des maisons sur le lieu où se trouve l'adversaire (choix de la quantité).
  affaire: { effects: e({ type: 'MONOPOLY_BUY_HOUSES' }) },
  // Chapeau haut de forme : rejoue l'effet d'une Affaire de la défausse (pose de maisons).
  'chapeau-haut-de-forme': { effects: e({ type: 'MONOPOLY_FETCH_AFFAIRE', affaireCardId: PREFIX + 'affaire' }) },
  // Carte bancaire (Objet) : déplace 2 maisons d'un lieu vers un autre.
  'carte-bancaire': { effects: e({ type: 'MONOPOLY_MOVE_HOUSES', count: 2 }) },
  // Erreur de la banque en votre faveur : +1 Pouvoir par maison (max 5).
  'erreur-de-la-banque-en-votre-faveur': { effects: e({ type: 'MONOPOLY_GAIN_PER_HOUSE', max: 5 }) },
  // Deuxième prix de beauté : récupère une carte de la défausse → main.
  'deuxieme-prix-de-beaute': { effects: e({ type: 'RECOVER_ANY_FROM_DISCARD', label: 'Deuxième prix de beauté' }) },
  // Allez en prison : déplace un Héros à la Prison (loc-4).
  'allez-en-prison': { effects: e({ type: 'MOVE_HERO_TO_LOCATION', locationId: 'loc-4' }) },
  // Banqueroute : élimine un Héros ; coût payé = sa Force (affiché « ? »).
  banqueroute: { effects: e({ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 99 }), costEqualsTargetStrength: true, costVariable: true },
  // L'Ombre de Monopoly (Objet) : remise −1 sur l'achat d'une maison quand le pion la partage.
  'l-ombre-de-monopoly': { shadowReducesHouseCost: true },

  // --- Deck FATALITÉ : passifs branchés (+ malus Fatalité IA) --------------
  // Fer à repasser : bloque tout loyer. Haut de forme : bloque la pose de maisons.
  // Les deux tuent le moteur économique → EMPÊCHE D'AVANCER.
  'fer-a-repasser': { blocksRent: true, fateMalus: 'block-advance' },
  'haut-de-forme': { blocksHousePlacement: true, fateMalus: 'block-advance' },
  // Brouette : cartes/actions/loyers rapportent −1 (taxe omniprésente) → RALENTIT ++.
  brouette: { reducesPowerGains: true, fateMalus: 'slow2' },
  // Dé à coudre : +2 Force à tous les AUTRES Héros (défensif) → RALENTIT.
  'de-a-coudre': { strengthMod: { target: 'heroes-realm', delta: 2, excludeSelf: true }, fateMalus: 'slow' },
  // Bateau : à la pose, défausse une maison → RALENTIT.
  bateau: { onPlace: e({ type: 'MONOPOLY_DESTROY_HOUSE' }), fateMalus: 'slow' },
  // Beaucoup trop de versions : détruit une maison (one-shot, non durable → pas de malus).
  'beaucoup-trop-de-jeux': { effects: e({ type: 'MONOPOLY_DESTROY_HOUSE' }) },
  // Voiture : à la pose, déplace un Héros (one-shot) → NEUTRE.
  voiture: { onPlace: e({ type: 'RELOCATE_ANY_HERO_FATE' }) },
  // Chien : se rapproche du pion à chaque fin de tour → RALENTIT.
  chien: { movesTowardPawnEndOfTurn: true, fateMalus: 'slow' },
  // Rénovation : perd la moitié du Pouvoir (one-shot → pas de malus durable).
  renovation: { effects: e({ type: 'MONOPOLY_LOSE_HALF_POWER', max: 10 }) },
  // Règles inventées : Objet associé → carte ciblant ce Héros +2 (durable) → RALENTIT.
  'regles-inventees': { attach: 'hero', eventTargetSurcharge: 2, fateMalus: 'slow' },
  // Officier de police : Allié (deck Vilain), pas de malus.
  'officier-de-police': { sendsHeroToPrisonOnMove: 'loc-4' },
  // Chaussure : bloque un lieu de pose (durable) → RALENTIT.
  chaussure: { onPlace: e({ type: 'MONOPOLY_BLOCK_LOCATION' }), fateMalus: 'slow' },
  // Libéré de prison : déplacer un Héros n'importe où, ou envoyer Mr. Monopoly en Prison.
  'libere-de-prison': { effects: e({ type: 'MONOPOLY_FREE_FROM_JAIL', prisonLocationId: 'loc-4' }) },
  // Monopoly (Condition) : pendant le tour adverse, s'il a déplacé son pion, pose une
  // maison sur son lieu (paie le coût).
  monopoly: { trigger: { type: 'opponent-moved-pawn' }, effects: e({ type: 'MONOPOLY_ADD_ONE_HOUSE' }) },
  // Reculez de trois cases : déplace le pion n'importe où + 1 action (hors Fatalité) + fin de tour.
  'reculez-de-trois-cases': { effects: e({ type: 'MONOPOLY_BACKWARD_MOVE' }) },
  // Monotonie (Condition) : après ≥ 10 min réelles, rejoue gratuitement une carte de la défausse.
  monotonie: { trigger: { type: 'game-elapsed-ge', ms: 10 * 60 * 1000 }, effects: e({ type: 'MONOPOLY_MONOTONY' }) },
  // Case Départ (Objet) : +1 Pouvoir chaque fois que le pion s'y rend ou le dépasse.
  'case-depart': { powerOnPawnCrossOrLand: 1 },
  // Canne (Objet) : aucune donnée à patcher — le moteur la détecte par son cardId
  // (`custom-mr-monopoly-canne`) : quand le pion la partage, action « Utiliser la Canne »
  // (emprunte une action d'un lieu adverse maisonné, hors Fatalité, + 1 Pouvoir, 1×/tour).
}

/** Transforme le vilain custom-mr-monopoly en version JOUABLE : champs de jeu + objectif. */
export function patchCustomMonopoly(v: CustomVillain): CustomVillain {
  const cards: CustomCard[] = v.cards.map((c) => ({ ...c, ...(FIELDS[slugOf(c)] ?? {}) }))
  const objective: ObjectiveDef = { type: 'POWER_THRESHOLD', threshold: 30 }
  return { ...v, objective, cards }
}
