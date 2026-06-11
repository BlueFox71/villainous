// =============================================================================
// Slenderman — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Source : onglet SLENDERMAN de Villainous_Template-Alexis_1_1.xlsx + images
// du dossier assets/decks/Slenderman/.
//
// Composition :
//   Vilain (30)   = Page ×8 + 10 Événements/Conditions ×2
//   Fatalité (15) = Mauvaise creepypasta ×3, Enfant Perdu ×2, Enquêteur ×1,
//                   Lampe de poche ×3, Lever du jour ×3, Vent de panique ×3
//
// ⚠️ PÉRIMÈTRE « base jouable » : seuls les effets déjà gérés par le moteur sont
// câblés (Observation → déplacement non obligatoire). Les mécaniques uniques de
// Slenderman (téléportation + action, manipulation de pioche, gain par page,
// limite de 2 Pages par lieu, héros récupérateurs de Pages, etc.) ne sont pas
// encore implémentées : ces cartes se jouent pour leur coût sans effet spécial.
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/slenderman/${file}`

export const slendermanCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Page (Objet, ×8 — cœur de l'objectif)
  // ----------------------------------------------------------------------
  {
    id: 'page',
    name: 'Page',
    englishName: 'Page',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'location',
    copies: 8,
    text: 'Associez cet Objet à un lieu qui a moins de 2 pages.',
    image: img('page.png'),
    maxAtLocation: 2,
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (×2 chacun)
  // ----------------------------------------------------------------------
  {
    id: 'teleportation',
    name: 'Téléportation',
    englishName: 'Teleportation',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Déplacez-vous sur le lieu où se trouve un Héros, et effectuez une des actions disponibles.',
    image: img('teleportation.png'),
    effects: [{ type: 'TELEPORT_TO_HERO' }],
  },
  {
    id: 'observation',
    name: 'Observation',
    englishName: 'Observation',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: "Slenderman n'est pas obligé de se déplacer au prochain tour.",
    image: img('observation.png'),
    effects: [{ type: 'GRANT_SKIP_NEXT_MOVE' }],
  },
  {
    id: 'brouillage',
    name: 'Brouillage',
    englishName: 'Jamming',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Effectuez les actions recouvertes par un Héros.',
    image: img('brouillage.png'),
    effects: [{ type: 'GRANT_USE_COVERED_ACTION' }],
  },
  {
    id: 'disparition',
    name: 'Disparition',
    englishName: 'Vanishing',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Éliminer un Héros sur le lieu où vous êtes.',
    image: img('disparition.png'),
    effects: [{ type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }],
  },
  {
    id: 'dessin-inquietant',
    name: 'Dessin inquiétant',
    englishName: 'Disturbing Drawing',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Gagnez 1 Jeton Pouvoir par page sur le lieu où vous êtes.',
    image: img('dessin_inquietant.png'),
    effects: [{ type: 'GAIN_POWER_PER_CARD_AT_PAWN', cardId: 'page', amount: 1 }],
  },
  {
    id: 'apparition',
    name: 'Apparition',
    englishName: 'Apparition',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Déplacez un Héros vers un lieu voisin.',
    image: img('apparition.png'),
    effects: [{ type: 'RELOCATE_HERO_ADJACENT' }],
  },
  {
    id: 'tombee-de-la-nuit',
    name: 'Tombée de la nuit',
    englishName: 'Nightfall',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Choisissez entre Événement ou Objet. Dévoilez les 4 premières cartes de votre pioche et ajoutez celle de ce type à votre main et défaussez les autres.',
    image: img('tombee_de_la_nuit.png'),
    effects: [{ type: 'CHOOSE_TYPE_REVEAL_DRAW', count: 4 }],
  },
  {
    id: 'retourne-toi',
    name: 'Retourne-toi',
    englishName: 'Turn Around',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Regardez la dernière carte de votre pioche et ajoutez-la à votre main. Sinon mélangez votre deck et piochez la première carte de votre pioche.',
    image: img('retourne_toi.png'),
    effects: [{ type: 'PEEK_BOTTOM_THEN_CHOOSE' }],
  },
  {
    id: 'perdu-dans-les-bois',
    name: 'Perdu dans les bois',
    englishName: 'Lost in the Woods',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: "Mélangez votre défausse et votre pioche afin d'en former une nouvelle puis, piochez 2 cartes.",
    image: img('perdu_dans_les_bois.png'),
    effects: [{ type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 2 }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (×2 chacune)
  // ----------------------------------------------------------------------
  {
    id: 'sombres-desseins',
    name: 'Sombres desseins',
    englishName: 'Dark Designs',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il déplace un Allié ou un Objet. Éliminer un Héros.",
    image: img('sombres_desseins.png'),
    trigger: { type: 'opponent-moved-card' },
  },
  {
    id: 'sans-visage',
    name: 'Sans visage',
    englishName: 'Faceless',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il pioche au moins une carte avant la fin de son tour. Choisissez une carte de votre défausse et ajoutez-la à votre main.",
    image: img('sans_visage.png'),
    trigger: { type: 'opponent-drew-card' },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événement (×3)
  // ----------------------------------------------------------------------
  {
    id: 'mauvaise-creepypasta',
    name: 'Mauvaise creepypasta',
    englishName: 'Bad Creepypasta',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'Votre réserve de Jetons Pouvoir passe à 2 si vous en avez plus.',
    image: img('mauvaise_creepypasta.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros
  // ----------------------------------------------------------------------
  {
    id: 'enfant-perdu',
    name: 'Enfant Perdu',
    englishName: 'Lost Child',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 2,
    text: "Si une page se trouve sur le lieu où est joué l'Enfant Perdu, associez-le lui. S'il est éliminé, récupérez la page dans votre main.",
    image: img('enfant_perdu.png'),
    onPlace: [{ type: 'CAPTURE_CARDS_AT_HOST', cardId: 'page', max: 1 }],
    onVanquish: [{ type: 'RELEASE_CAPTURED_TO_HAND', cardId: 'page' }],
  },
  {
    id: 'enqueteur',
    name: 'Enquêteur',
    englishName: 'Investigator',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Si une page se trouve sur le lieu où se trouve l'Enquêteur, associez-le lui. S'il est éliminé, récupérez les pages dans votre main. L'Enquêteur peut avoir plusieurs pages sur lui.",
    image: img('enqueteur.png'),
    onPlace: [{ type: 'CAPTURE_CARDS_AT_HOST', cardId: 'page' }],
    onVanquish: [{ type: 'RELEASE_CAPTURED_TO_HAND', cardId: 'page' }],
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objet (×3)
  // ----------------------------------------------------------------------
  {
    id: 'lampe-de-poche',
    name: 'Lampe de poche',
    englishName: 'Flashlight',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 3,
    text: 'Associez cette carte à un Héros, Slenderman ne peut plus se téléporter vers ce Héros.',
    image: img('lampe_de_poche.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (×3 chacun)
  // ----------------------------------------------------------------------
  {
    id: 'lever-du-jour',
    name: 'Lever du jour',
    englishName: 'Daybreak',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: "Slenderman ne pourra pas jouer de page au prochain tour sauf s'il joue la carte Tombée de la nuit immédiatement.",
    image: img('lever_du_jour.png'),
  },
  {
    id: 'vent-de-panique',
    name: 'Vent de panique',
    englishName: 'Wind of Panic',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'Déplacez un Héros vers un lieu voisin.',
    image: img('vent_de_panique.png'),
  },
]

/** Index id → définition (pour retrouver une carte depuis un CardInstance.cardId). */
export const slendermanCardById: Record<string, CardDef> = Object.fromEntries(
  slendermanCards.map((c) => [c.id, c]),
)
