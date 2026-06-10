// =============================================================================
// Prince Jean — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Sources : illustrations fournies (public/cards/prince-jean/) pour le texte FR,
// et wiki officiel pour types / coûts / forces / exemplaires :
//   https://disney-villainous.fandom.com/wiki/Prince_John
//
// Composition vérifiée :
//   Vilain (30) = 10 Alliés + 7 Objets + 9 Événements + 4 Conditions
//   Fatalité (15) = 9 Héros + 3 Effets (Voler aux Riches) + 3 Objets (Déguisement)
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/prince-jean/${file}`

export const princeJohnCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés (10 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'sherif-nottingham',
    name: 'Shérif de Nottingham',
    englishName: 'Sheriff of Nottingham',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 1,
    text: "Vous pouvez déplacer le Shérif de Nottingham vers un autre lieu à chaque tour. Gagnez 1 Pouvoir si au moins un Héros s'y trouve.",
    image: img('sherif_nottingham.png'),
  },
  {
    id: 'gardes-rhinoceros',
    name: 'Gardes Rhinocéros',
    englishName: 'Rhino Guards',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    copies: 3,
    text: 'Aucune capacité.',
    image: img('gardes_rhinoceros.png'),
  },
  {
    id: 'archers-loups',
    name: 'Archers Loups',
    englishName: 'Wolf Archers',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 3,
    text: 'Les Archers Loups peuvent éliminer un Héros sur leur lieu ou sur un lieu voisin.',
    image: img('archers_loups.png'),
  },
  {
    id: 'niquedouille',
    name: 'Niquedouille',
    englishName: 'Nutsy',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'La force des Alliés qui se trouvent sur le même lieu que Niquedouille est augmentée de 1.',
    image: img('niquedouille.png'),
  },
  {
    id: 'pendard',
    name: 'Pendard',
    englishName: 'Trigger',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    text: 'La force des autres Alliés qui se trouvent sur le même lieu que Pendard est réduite de 1.',
    image: img('pendard.png'),
  },
  {
    id: 'persifleur',
    name: 'Persifleur',
    englishName: 'Sir Hiss',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Si vous déplacez votre figurine sur le lieu où se trouve Persifleur, vous pouvez effectuer une action recouverte par un Héros sur ce lieu.',
    image: img('persifleur.png'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets (7 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'mandat-arret',
    name: "Mandat d'Arrêt",
    englishName: 'Warrant',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 3,
    text: "Gagnez 2 Pouvoir à chaque fois qu'un Héros est joué sur ce lieu.",
    image: img('mandat_arret.png'),
  },
  {
    id: 'arc-fleches',
    name: 'Arc et Flèches',
    englishName: 'Bow and Arrows',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'ally',
    copies: 2,
    text: 'Associez cette carte à un Allié. Sa force augmente de 1. Si vous devez défausser cet Allié, défaussez cet Objet à la place.',
    image: img('arc_fleches.png'),
  },
  {
    id: 'fleche-or',
    name: "Flèche d'Or",
    englishName: 'Golden Arrow',
    deck: 'villain',
    type: 'item',
    cost: 0,
    attach: 'ally',
    copies: 1,
    text: 'Associez cette carte à un Allié. Si cet Allié élimine un Héros, gagnez 2 Pouvoir.',
    image: img('fleche_or.png'),
  },
  {
    id: 'couronne-roi-richard',
    name: 'Couronne du Roi Richard',
    englishName: "King Richard's Crown",
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Les cartes vous coûtent 1 Pouvoir de moins quand vous vous trouvez sur ce lieu.',
    image: img('couronne_roi_richard.png'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (9 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'magnifiques-taxes',
    name: 'Magnifiques Taxes',
    englishName: 'Beautiful, Lovely Taxes',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Gagnez 1 Pouvoir par Héros dans votre royaume.',
    image: img('magnifiques_taxes.png'),
    effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }],
  },
  {
    id: 'emprisonnement',
    name: 'Emprisonnement',
    englishName: 'Imprison',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text: 'Déplacez un Héros sur la Prison.',
    image: img('emprisonnement.png'),
    effects: [{ type: 'MOVE_HERO_TO_LOCATION', locationId: 'jail' }],
  },
  {
    id: 'tendre-piege',
    name: 'Tendre un Piège',
    englishName: 'Set a Trap',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: "Vous pouvez déplacer un Allié sur n'importe quel lieu, puis faire une action Éliminer un Héros.",
    image: img('tendre_piege.png'),
    effects: [
      { type: 'MOVE_ALLY_FREELY' },
      { type: 'VANQUISH_HERO', keepAllies: false },
    ],
  },
  {
    id: 'intimidation',
    name: 'Intimidation',
    englishName: 'Intimidation',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 1,
    text: 'Faites une action Éliminer un Héros. Les Alliés utilisés ne sont pas défaussés.',
    image: img('intimidation.png'),
    effects: [{ type: 'VANQUISH_HERO', keepAllies: true }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (4 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'avarice',
    name: 'Avarice',
    englishName: 'Greed',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il possède au moins 6 Pouvoir. Gagnez 3 Pouvoir.",
    image: img('avarice.png'),
    trigger: { type: 'opponent-power-ge', value: 6 },
  },
  {
    id: 'lachete',
    name: 'Lâcheté',
    englishName: 'Cowardice',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il possède au moins 3 cartes en main. Jouez un Allié gratuitement.",
    image: img('lachete.png'),
    trigger: { type: 'opponent-hand-ge', value: 3, requiresOwnAlly: true },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (9 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'robin-des-bois',
    name: 'Robin des Bois',
    englishName: 'Robin Hood',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Les cartes et les actions du royaume du Prince Jean lui rapportent 1 Pouvoir de moins.',
    image: img('robin_des_bois.png'),
  },
  {
    id: 'petit-jean',
    name: 'Petit Jean',
    englishName: 'Little John',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Prenez 4 Pouvoir au Prince Jean et placez-les sur cette carte. Si Petit Jean est éliminé, le Prince Jean récupère ces Pouvoir.',
    image: img('petit_jean.png'),
    // Bloc B (Vanquish) : à l'élimination, restituer lockedPower au PJ.
    onPlace: [{ type: 'LOSE_POWER_TO_HOST', amount: 4 }],
  },
  {
    id: 'roi-richard',
    name: 'Roi Richard',
    englishName: 'King Richard',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Le Prince Jean ne peut plus jouer de cartes Événement.',
    image: img('roi_richard.png'),
  },
  {
    id: 'dame-gertrude',
    name: 'Dame Gertrude',
    englishName: 'Lady Kluck',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text: 'Dame Gertrude ne peut être ni jouée ni déplacée sur la Prison.',
    image: img('dame_gertrude.png'),
    forbiddenLocations: ['jail'],
  },
  {
    id: 'belle-marianne',
    name: 'Belle Marianne',
    englishName: 'Maid Marian',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Dès que Belle Marianne est éliminée, cherchez immédiatement Robin des Bois et placez-le sur le même lieu.',
    image: img('belle_marianne.png'),
    onVanquish: [{ type: 'SEARCH_AND_PLACE_HERO', cardId: 'robin-des-bois' }],
  },
  {
    id: 'frere-tuck',
    name: 'Frère Tuck',
    englishName: 'Friar Tuck',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Défaussez tous les Mandats d'Arrêt sur le lieu où vous jouez Frère Tuck. Ils ne rapportent plus aucun Pouvoir au Prince Jean.",
    image: img('frere_tuck.png'),
    onPlace: [{ type: 'DISCARD_CARDS_AT_HOST', cardId: 'mandat-arret' }],
  },
  {
    id: 'adam-halle',
    name: 'Adam de la Halle',
    englishName: 'Alan-a-Dale',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'La force de tous les autres Héros augmente de 1.',
    image: img('adam_halle.png'),
  },
  {
    id: 'bobby',
    name: 'Bobby',
    englishName: 'Skippy',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Le Prince Jean ne peut pas utiliser d'Archers Loups pour éliminer Bobby.",
    image: img('bobby.png'),
  },
  {
    id: 'toby',
    name: 'Toby',
    englishName: 'Toby',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Toby est éliminé, placez-le dans la pioche de cartes Fatalité et remélangez-la.',
    image: img('toby.png'),
    onVanquish: [{ type: 'RESHUFFLE_HOST_INTO_FATE_DECK' }],
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Effets (3 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'voler-riches',
    name: 'Voler aux Riches',
    englishName: 'Steal from the Rich',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'Retirez jusqu’à 4 Pouvoir au Prince Jean et placez-les sur un Héros au choix. Si ce Héros est éliminé, le Prince Jean récupère ces Pouvoir.',
    image: img('voler_riches.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets (3 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'deguisement',
    name: 'Déguisement',
    englishName: 'Clever Disguise',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 3,
    text: 'Associez cette carte à un Héros. Ce Héros ne peut pas être éliminé. À tout moment, le Prince Jean peut payer 2 Pouvoir pour défausser cette carte.',
    image: img('deguisement.png'),
  },
]

/** Index id → définition, pour retrouver une carte depuis un CardInstance.cardId. */
export const princeJohnCardById: Record<string, CardDef> = Object.fromEntries(
  princeJohnCards.map((c) => [c.id, c]),
)
