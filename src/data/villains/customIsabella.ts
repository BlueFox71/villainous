// =============================================================================
// Patch de COMPORTEMENT du vilain PERSONNALISÉ « Isabella » (id `custom-isabella`).
//
// Mécanique HORLOGE (The Promised Neverland) : l'aiguille parcourt 6 heures
// XII → II → IV → VI → VIII → X (index 0..5). Elle démarre à XII et avance d'un cran
// au DÉBUT de chacun des tours d'Isabella (cf. engine/actions applyEndTurn). Les cartes
// ACTIVITÉ ne sont jouables qu'à certaines heures (`allowedHours`) ; jouées à l'heure,
// elles VALIDENT cette heure (VALIDATE_HOUR). VICTOIRE : les 6 heures validées
// (objectif ISABELLA_CLOCK, cf. rules.hasReachedObjective).
//
// ⚠️ PHASE 1 : seuls l'horloge, le verrou par heure, la validation, la victoire et les
// effets NON liés à l'« Amour » sont branchés. La mécanique « Amour » (Héros qui aiment
// Isabella + clauses Amour des Héros Fatalité + RADAR DE POCHE + INCENDIE + Conditions)
// reste en TEXTE SEUL (Phase 2).
// =============================================================================

import type { ObjectiveDef } from '../../engine/types'
import type { CustomVillain, CustomCard } from '../customVillain'

export const CUSTOM_ISABELLA_ID = 'custom-isabella'

const P = 'custom-isabella-'

// Heures de l'horloge, par index : 0=XII, 1=II, 2=IV, 3=VI, 4=VIII, 5=X.
const XII = 0, II = 1, IV = 2, VI = 3, VIII = 4, X = 5

/** Champs de jeu à appliquer par cardId. */
const FIELDS: Record<string, Partial<CustomCard>> = {
  // --- ACTIVITÉS (verrou par heure + VALIDATE_HOUR + bonus) -------------------
  [`${P}test-de-repetition`]: {
    // +1 Pouvoir (le « +1 par Héros aimant » exact est approché par le +1 fixe).
    allowedHours: [II, VIII],
    effects: [{ type: 'VALIDATE_HOUR' }, { type: 'GAIN_POWER', amount: 1 }],
  },
  [`${P}temps-libre`]: {
    // « un Héros vous aime » : approché par un choix libre (au lieu du Héros sur le lieu du pion).
    allowedHours: [XII, IV, VIII],
    effects: [{ type: 'VALIDATE_HOUR' }, { type: 'GRANT_LOVE' }],
  },
  [`${P}diner-en-famille`]: {
    // Valide l'heure, pioche 1, +1 Pouvoir, PUIS un Héros du royaume se met à vous aimer.
    allowedHours: [XII, VI],
    effects: [
      { type: 'VALIDATE_HOUR' },
      { type: 'DRAW_CARDS', count: 1 },
      { type: 'GAIN_POWER', amount: 1 },
      { type: 'GRANT_LOVE' },
    ],
  },
  [`${P}moisson`]: {
    // Valide l'heure. Le bonus « éliminez un Héros qui vous aime ou à la Porte » est différé
    // (l'élimination bloquerait la pose sans Héros ; il faudrait un variant « facultatif »).
    allowedHours: [XII, IV, VIII],
    effects: [{ type: 'VALIDATE_HOUR' }],
  },
  [`${P}laverie`]: {
    // Défaussez au choix puis complétez la main à 4.
    allowedHours: [IV, X],
    effects: [{ type: 'VALIDATE_HOUR' }, { type: 'DISCARD_ANY_THEN_REFILL', handLimit: 4, label: 'Laverie' }],
  },
  [`${P}jouer-a-chat`]: {
    // « déplacez tous les Héros » : approché par le déplacement INTERACTIF d'un Héros vers un
    // lieu voisin AU CHOIX (pendingHeroRelocate).
    allowedHours: [II, VI, VIII, X],
    effects: [{ type: 'VALIDATE_HOUR' }, { type: 'RELOCATE_HERO_ADJACENT' }],
  },

  // --- Autres cartes Vilain --------------------------------------------------
  [`${P}supprimes-de-l-equation`]: {
    effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 99 }], // « Éliminer un Héros »
  },
  [`${P}la-vida`]: {
    // Capacité ACTIVÉE (1 Pouvoir) : cherche MOISSON et l'ajoute à la main (pioche en priorité,
    // sinon défausse — le « choix si un exemplaire dans chaque » est simplifié).
    activatedCost: 1,
    activatedEffects: [{ type: 'FETCH_CARD_TO_HAND', cardId: `${P}moisson` }],
  },
  [`${P}radar-de-poche`]: {
    // Capacité ACTIVÉE (gratuite) : Activités jouables à toute heure ce tour ; en contrepartie,
    // pioche la Fatalité jusqu'à un Héros (joué sur un lieu au choix), défausse le reste.
    activatedCost: 0,
    activatedEffects: [{ type: 'RADAR_POCHE' }],
  },
  [`${P}cloche`]: {
    // Capacité ACTIVÉE (sticker Activer, gratuite) : regarde les 4 premières cartes, en garde 1
    // en main, REMET les autres dans le deck puis le mélange (returnToDeck). Dans
    // activatedEffects (pas effects) pour ne PAS se déclencher à la pose de l'Objet.
    activatedCost: 0,
    activatedEffects: [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 4, take: 1, title: 'Cloche', returnToDeck: true }],
  },
  [`${P}mes-cheries`]: {
    // Approximation : +1 Pouvoir par Héros du ROYAUME (la défausse n'est pas comptée ici).
    effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }],
  },
  [`${P}rapport-journalier`]: {
    // Reprend un Objet OU un Événement de la défausse (le remélange du reste est simplifié).
    effects: [{ type: 'RECOVER_ITEM_OR_EVENT' }],
  },
  [`${P}c-est-le-moment-de-partir`]: {
    // Action gratuite « Activer une capacité » OU un déplacement (approché par move-ou-activer).
    effects: [{ type: 'GRANT_FREE_MOVE_OR_ACTIVATE' }],
  },
  [`${P}ils-savent`]: {
    // Cherche un Objet ou une Activité — approché par « reprendre un Objet/Événement de la défausse ».
    effects: [{ type: 'RECOVER_ITEM_OR_EVENT' }],
  },
  [`${P}tu-as-l-air-un-peu-pale`]: {
    // « ignorez les capacités d'un Héros » : approché par l'AMOUR (le Héros devient un Allié,
    // ses capacités sont annulées). La partie réactive à la Fatalité est simplifiée.
    effects: [{ type: 'GRANT_LOVE' }],
  },
  [`${P}grand-mere-sarah`]: {
    // Capacité ACTIVÉE (2 Pouvoir) : action « Éliminer un Héros » facultative (interactive).
    // « qui vous aime ou à la Porte » approché par « n'importe quel Héros ».
    activatedCost: 2,
    activatedEffects: [{ type: 'OPTIONAL_FREE_VANQUISH' }],
  },
  [`${P}s-ur-krone`]: {
    // Si Isabella est sur son lieu, elle peut utiliser une action recouverte par un Héros de
    // ce lieu. (Le volet « les Héros de son lieu ne sont pas déplaçables par la Fatalité »
    // reste texte seul.)
    unlocksCoveredActionsHere: true,
  },

  // --- CONDITIONS ------------------------------------------------------------
  [`${P}bienveillance`]: {
    // Jouable pendant le tour adverse s'il a ≥ 4 Alliés (approx de « Objets + Alliés ≥ 4 ») ;
    // un Héros de votre choix vous aime.
    trigger: { type: 'opponent-allies-in-realm-ge', value: 4 },
    effects: [{ type: 'GRANT_LOVE' }],
  },
  [`${P}vigilante`]: {
    // Jouable quand l'adversaire déplace son pion (approx de « vers un lieu à Héros ») ;
    // reprend une carte de la défausse vers le deck.
    trigger: { type: 'opponent-moved-pawn' },
    effects: [{ type: 'RECOVER_CARDS_TO_DECK', count: 1 }],
  },

  // --- FATALITÉ --------------------------------------------------------------
  [`${P}maman-est-un-ennemi`]: {
    effects: [{ type: 'UNGRANT_LOVE' }], // un Héros aimé redevient un Héros
  },
  [`${P}evasion`]: {
    // « éliminez un Héros qui vous aime » : approché par « le Héros aimé s'échappe (redevient Héros) ».
    effects: [{ type: 'UNGRANT_LOVE' }],
  },
  [`${P}telephone-a-ficelle`]: {
    // Associé à un Héros ; si Isabella arrive sur ce lieu, −2 Pouvoir.
    attach: 'hero',
    powerPenaltyOnPawnArrive: 2,
  },
  [`${P}paralysie-des-emetteurs`]: {
    // Associé à un Héros ; si Isabella arrive sur ce lieu, elle défausse un Objet.
    attach: 'hero',
    discardItemOnPawnArrive: true,
  },

  // --- HÉROS FATALITÉ (base = tant que NON aimé ; « Amour » = une fois aimé) ---
  [`${P}gilda`]: {
    // Base : vos Événements coûtent +1. Amour : main complétée à 5 en fin de tour.
    eventCostSurcharge: 1,
    drawToAtEndOfTurnWhenLoved: 5,
  },
  [`${P}norman`]: {
    // Base : Événements +2 (approx de « pas d'Événement sur son lieu »). Amour : Événements −1.
    eventCostSurcharge: 2,
    eventCostDiscountWhenLoved: 1,
  },
  [`${P}ray`]: {
    // À la pose : va chercher la Paralysie des émetteurs et l'associe à Ray. (Amour : « défausser
    // dans le deck » — texte seul.)
    onPlace: [{ type: 'FETCH_FATE_ITEM_TO_HOST', itemCardId: `${P}paralysie-des-emetteurs` }],
  },
  [`${P}phil`]: {
    // À la pose : Isabella perd 1 Pouvoir par Héros (approx de « par Héros qui l'aime »).
    // Amour : les Activités coûtent 1 de moins ET Isabella est immunisée à Incendie.
    onPlace: [{ type: 'LOSE_POWER_PER_HERO_IN_REALM', amount: 1 }],
    activiteCostDiscountWhenLoved: 1,
    immuneToIncendieWhenLoved: true,
  },
  [`${P}conny`]: {
    // À la pose : déplacez un Héros vers un lieu voisin. (Amour : « Fatalité subie → piochez »
    // — texte seul.)
    onPlace: [{ type: 'MOVE_HERO_OR_ITEM_ADJACENT' }],
  },
  [`${P}don`]: {
    // Base : arrive AGRANDI (façon Reine de Cœur) → recouvre ses 2 actions du haut + une
    // action du haut d'un lieu voisin. Amour : au début de chaque tour, +1 Pouvoir par
    // Héros qui l'aime.
    bornEnlarged: true,
    powerPerLovedAtTurnStartWhenLoved: 1,
  },
  [`${P}emma`]: {
    // Base : l'action « Activer une capacité » coûte +2 tant qu'Emma n'aime pas Isabella.
    // (Amour « Défausser → piochez tout de suite » : réaction à l'action Défausser, texte seul.)
    activateSurcharge: 2,
  },
  [`${P}incendie`]: {
    effects: [{ type: 'INCENDIE' }], // bloque les Activités à la prochaine heure (sauf Phil aimé)
  },
  // Restent TEXTE SEUL (réactions à des actions cœur — Défausser / subir une Fatalité) : les
  // clauses AMOUR de RAY (« défausser dans le deck »), EMMA (« Défausser → piochez ») et CONNY
  // (« Fatalité subie → piochez »), ainsi que le volet « anti-déplacement Fatalité » de SŒUR KRONE.
}

/** Rebranche les effets/champs de jeu d'Isabella + fixe l'objectif HORLOGE. */
export function patchCustomIsabella(v: CustomVillain): CustomVillain {
  const cards: CustomCard[] = v.cards.map((c) => ({ ...c, ...(FIELDS[c.id] ?? {}) }))
  const objective: ObjectiveDef = { type: 'ISABELLA_CLOCK' }
  const objectiveDescription =
    "Faites tourner l'horloge : jouez au moins une ACTIVITÉ à chacune des 6 heures (XII, II, IV, VI, VIII, X). Les 6 heures validées = victoire."
  return { ...v, objective, objectiveDescription, cards }
}
