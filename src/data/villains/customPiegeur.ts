// =============================================================================
// Patch de COMPORTEMENT du vilain PERSONNALISÉ « Le Piégeur » (id `custom-le-piegeur`),
// inspiré de Dead by Daylight. Comme customDio / customPyramidHead, l'éditeur ne produit
// que la DONNÉE visuelle des cartes ; ce module rebranche les `effects`/champs de jeu et
// fixe le vrai objectif (PIEGEUR_ELIMINATE_ALL_SURVIVORS).
//
// PHASE 1 (cœur jouable) : les 4 SURVIVANTS (paquet « Survivant ») sont marqués `isSurvivor`
// + typés `hero` (pour qu'ils recouvrent les actions une fois révélés) et sortis du paquet
// (group retiré → construits dans la Fatalité puis extraits/posés FACE CACHÉE au setup, cf.
// createInitialGame). Santé (sain→blessé→critique), vies (crochet), fuite en fin de tour et
// crochets sont gérés par le moteur. Les EFFETS des 23 cartes arrivent en PHASE 2.
// =============================================================================

import type { Effect, ObjectiveDef } from '../../engine/types'
import type { CustomVillain, CustomCard } from '../customVillain'
import { slugify } from '../customVillain'

const e = (...effects: Effect[]) => effects

export const CUSTOM_PIEGEUR_ID = 'custom-le-piegeur'

const PREFIX = 'custom-le-piegeur-'

/** Slug d'une carte (préfixe retiré) ; retombe sur le slug du NOM si l'id est un
 *  placeholder éditeur `custom-le-piegeur-cN`. */
function slugOf(c: CustomCard): string {
  const s = c.id.startsWith(PREFIX) ? c.id.slice(PREFIX.length) : c.id
  return /^c\d+$/.test(s) ? slugify(c.name) : s
}

/** Marqueurs communs aux 4 Survivants : hors-deck (group retiré) + typés Héros (recouvrent
 *  les actions une fois révélés) + `isSurvivor` (extraction/pose au setup par le moteur). */
const SURVIVOR: Partial<CustomCard> = { group: undefined, type: 'hero', isSurvivor: true }

/** Champs de jeu par slug de carte.
 *  Lot 1 (fait) : boucle d'attaque du Piégeur + effets « Lorsque révélé » des Survivants.
 *  Lot 2 (à venir) : cartes Fatalité (soin/décrochage/palette/sabotage/purification/lampe),
 *  conditions (Fermeture/Explosion), génériques (Agitation/Présence perturbante). */
const FIELDS: Record<string, Partial<CustomCard>> = {
  // --- Les 4 Survivants (paquet « Survivant », hors-deck) : effet « Lorsque révélé » ---
  'claudette-morel': { ...SURVIVOR, effects: e({ type: 'PIEGEUR_HEAL' }) },
  'dwight-fairfield': { ...SURVIVOR, effects: e({ type: 'PIEGEUR_UNHOOK' }) },
  'meg-thomas': { ...SURVIVOR, effects: e({ type: 'PIEGEUR_MEG_FLEE' }) },
  'jake-park': { ...SURVIVOR, effects: e({ type: 'PIEGEUR_JAKE_SABOTAGE' }) },

  // --- Deck Vilain : la boucle d'attaque -------------------------------------
  // MARQUE D'ÉRAFLURE (id historique presence-perturbante-ne-coute-plus-que-1) : révèle un
  // Survivant sur le lieu du pion puis le déplace vers un voisin.
  'presence-perturbante-ne-coute-plus-que-1': { effects: e({ type: 'PIEGEUR_REVEAL', atPawn: true, thenMove: true }) },
  'force-brute': { effects: e({ type: 'PIEGEUR_INJURE' }) },
  'sanctuaire-monstrueux': { effects: e({ type: 'PIEGEUR_HOOK' }) },
  'memento-mori': { effects: e({ type: 'PIEGEUR_FINISH' }) },
  'rayon-de-terreur': { effects: e({ type: 'PIEGEUR_MOVE_SURVIVOR' }) },
  'pudding-de-survivants': { effects: e({ type: 'PIEGEUR_PUDDING_POWER' }) },
  // PERSONNE N'ÉCHAPPE À LA MORT : Objet posé sur un lieu (global : FORCE BRUTE → direct critique).
  'personne-n-echappe-a-la-mort': { attach: 'location' },
  // PIÈGE À OURS : Objet posé sur un lieu ; réutilisable (détecté par présence). Déclenche
  // −1 segment + immobilisation à l'entrée d'un Survivant (cf. moveSurvivorWithTrap).
  'piege-a-ours': { attach: 'location' },
  // EXPLOSION D'UN GÉNÉRATEUR (Condition) : réaction quand l'adversaire vainc un Héros
  // (approxime « défausse un Allié pour éliminer un Héros ») → révèle un Survivant.
  'explosion-d-un-generateur': {
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 },
    effects: e({ type: 'PIEGEUR_REVEAL', atPawn: false }),
  },
  // AGITATION : récupère une carte Événement/Objet de la défausse (approx. de « 2 Événements
  // ou 1 Objet » — RECOVER_FROM_DISCARD_CHOICE récupère 1 carte).
  agitation: { effects: e({ type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['effect', 'item'], label: 'Agitation' }) },
  // PRÉSENCE PERTURBANTE : pioche 5, en garde 3, défausse le reste (choix interactif).
  'presence-perturbante': { effects: e({ type: 'LOOK_TOP_DRAW_DISCARD', look: 5, take: 3, title: 'Présence perturbante' }) },

  // --- Deck Fatalité (joué par l'adversaire pour protéger les Survivants) ----
  // CONNAISSANCE EN BOTANIQUE : un Survivant récupère un segment de santé.
  prophylaxie: { effects: e({ type: 'PIEGEUR_HEAL' }) },
  // ADRÉNALINE : un Survivant récupère un segment ET fuit vers un lieu voisin.
  adrenaline: { effects: e({ type: 'PIEGEUR_ADRENALINE' }) },
  // SABOTAGE : désactive un crochet 1 tour OU défausse un piège à ours (comme Jake).
  sabotage: { effects: e({ type: 'PIEGEUR_JAKE_SABOTAGE' }) },
  // MENEUR : décroche un Survivant (→ blessé).
  'montrez-ce-que-vous-savez-faire': { effects: e({ type: 'PIEGEUR_UNHOOK' }) },
  // PALETTE : Objet posé sur un lieu ; bloque l'accès du Piégeur (2 Pouvoir pour la défausser).
  palette: { attach: 'location' },
  // PURIFICATION : défausse PERSONNE N'ÉCHAPPE À LA MORT (main ou royaume du Piégeur).
  purification: { effects: e({ type: 'PIEGEUR_PURIFY' }) },
  // LAMPE TORCHE : le Piégeur reste sur son lieu à son prochain tour (force 1 = résidu, ignorée).
  'lampe-torche': { effects: e({ type: 'FORCE_SKIP_NEXT_MOVE' }) },
  // FERMETURE DE LA TRAPPE (Condition) : réaction quand l'adversaire joue un Événement de
  // coût ≥ 2 → octroie une action « Jouer une carte » gratuite (approx. « Événement gratuit »).
  'fermeture-de-la-trappe': {
    trigger: { type: 'opponent-played-event-cost-ge', value: 2 },
    effects: e({ type: 'GRANT_FREE_ACTION', actionType: 'PLAY_CARD' }),
  },
}

/** Transforme le vilain custom-le-piegeur en version JOUABLE : champs de jeu + objectif. */
export function patchCustomPiegeur(v: CustomVillain): CustomVillain {
  const cards: CustomCard[] = v.cards.map((c) => ({ ...c, ...(FIELDS[slugOf(c)] ?? {}) }))
  const objective: ObjectiveDef = { type: 'PIEGEUR_ELIMINATE_ALL_SURVIVORS' }
  return { ...v, objective, cards }
}
