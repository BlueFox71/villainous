// =============================================================================
// Davy Jones — cartes (Méchant + Fatalité). Pirates des Caraïbes (Disney).
//
// Texte FR = source de vérité (lu sur les planches de assets/decks/Davy Jones/).
// Les `effects` sont la traduction machine, ajoutée au fil de l'eau. La mécanique
// des JETONS TRÉSOR (poser face cachée → révéler → vaincre pour récupérer) est
// gérée par engine/davyJones.ts + les variantes d'Effect dédiées.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/davy-jones/${f}`

export const davyJonesCards: CardDef[] = [
  // --- Alliés ---------------------------------------------------------------
  {
    id: 'equipage-hollandais',
    name: 'L’Équipage du Hollandais Volant',
    englishName: 'The Crew of the Flying Dutchman',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 5,
    // +1 Force par AUTRE lieu où se trouve un Allié.
    selfStrengthMods: [{ kind: 'per-other-location-with-ally', delta: 1 }],
    text:
      "La force de L’ÉQUIPAGE DU HOLLANDAIS VOLANT augmente de 1 pour chaque autre lieu " +
      "où se trouve un Allié.",
    image: img('equipage-hollandais.png'),
  },
  {
    id: 'bill-le-bottier',
    name: 'Bill le Bottier',
    englishName: 'Bootstrap Bill',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 1,
    copies: 1,
    // Joué OU déplacé → on PEUT révéler un jeton Trésor sur un Héros de ce lieu.
    effectsAlsoOnMove: true,
    effects: [{ type: 'REVEAL_TREASURE', atHostLocation: true }],
    text:
      "Lorsque BILL LE BOTTIER est joué ou déplacé vers un nouveau lieu, vous pouvez révéler " +
      "un jeton Trésor sur un Héros de ce nouveau lieu.",
    image: img('bill-le-bottier.png'),
  },
  {
    id: 'clanker',
    name: 'Clanker',
    englishName: 'Clanker',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    // Accorde une action « Éliminer un Héros » à son lieu (rangée bas, jamais recouverte).
    grantsAction: { type: 'VANQUISH', label: 'Éliminer un Héros' },
    text: 'Ce lieu gagne l’action : Éliminer un Héros.',
    image: img('clanker.png'),
  },
  {
    id: 'le-second-maccus',
    name: 'Le Second Maccus',
    englishName: 'First Mate Maccus',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 1,
    // Utilisé pour vaincre → on PEUT défausser un AUTRE Allié du royaume à sa place (il survit).
    survivesVanquishByDiscardingAlly: true,
    text:
      "Lorsque LE SECOND MACCUS est utilisé pour éliminer un Héros, vous pouvez défausser un " +
      "autre Allié de votre royaume à sa place.",
    image: img('le-second-maccus.png'),
  },
  {
    id: 'hadras',
    name: 'Hadras',
    englishName: 'Hadras',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    // Quand HADRAS est défaussé → révélez un jeton Trésor face cachée sur un Héros.
    revealTreasureOnDiscard: true,
    text:
      "Lorsque HADRAS est défaussé, révélez un jeton Trésor face cachée sur un Héros.",
    image: img('hadras.png'),
  },
  {
    id: 'le-kraken',
    name: 'Le Kraken',
    englishName: 'The Kraken',
    deck: 'villain',
    type: 'ally',
    cost: 5,
    strength: 8,
    copies: 1,
    // N'est pas défaussé quand il élimine un Héros porteur d'un Trésor RÉVÉLÉ.
    survivesVanquishWithRevealedTreasure: true,
    text:
      "LE KRAKEN n’est pas défaussé lorsqu’il élimine un Héros avec un jeton Trésor révélé.",
    image: img('le-kraken.png'),
  },

  // --- Objet ----------------------------------------------------------------
  {
    id: 'hollandais-volant-objet',
    name: 'Le Hollandais Volant',
    englishName: 'The Flying Dutchman',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    // v1 : effet « action à distance » non implémenté (texte seul, cf. mémoire).
    text:
      "Si votre figurine se trouve sur ce lieu, vous pouvez effectuer 1 action disponible d’un " +
      "autre lieu où se trouve L’ÉQUIPAGE DU HOLLANDAIS VOLANT, en dehors d’une action Fatalité.",
    image: img('hollandais-volant-objet.png'),
  },

  // --- Événements -----------------------------------------------------------
  {
    id: 'as-tu-peur-mort',
    name: 'As-tu peur de la mort ?',
    englishName: 'Do You Fear Death?',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 4,
    // Dévoile la Fatalité jusqu'à un Héros, le joue sur le lieu choisi, + jeton Trésor face cachée.
    effects: [{ type: 'FETCH_HERO_PLACE_TREASURE' }],
    text:
      "Dévoilez des cartes de la pioche Fatalité jusqu’à ce que vous trouviez un Héros, puis " +
      "défaussez les autres. Jouez-le sur n’importe quel lieu et ajoutez un jeton Trésor face " +
      "cachée sur ce Héros.",
    image: img('as-tu-peur-mort.png'),
  },
  {
    id: 'la-poursuite',
    name: 'La Poursuite',
    englishName: 'The Chase',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    effects: [{ type: 'MOVE_ANY_HERO_TO_ALLY' }],
    text: 'Déplacez n’importe quel Héros vers un lieu où se trouve un Allié.',
    image: img('la-poursuite.png'),
  },
  {
    id: 'amis-ennemis',
    name: 'Les amis deviennent des ennemis',
    englishName: 'Friends Becoming Enemies',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    effects: [{ type: 'MOVE_SWAP_TREASURE' }],
    text:
      "Échangez des jetons Trésor entre 2 Héros ou déplacez un jeton Trésor d’un Héros à un autre.",
    image: img('amis-ennemis.png'),
  },
  {
    id: 'la-marque-noire',
    name: 'La Marque Noire',
    englishName: 'The Black Spot',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'REVEAL_TREASURE' }],
    text: 'Révélez un jeton Trésor face cachée sur un Héros.',
    image: img('la-marque-noire.png'),
  },
  {
    id: 'reveillez-kraken',
    name: 'Réveillez le Kraken !',
    englishName: 'Wake the Kraken!',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'WAKE_KRAKEN' }],
    text:
      "Défaussez un Allié, puis cherchez LE KRAKEN et jouez-le gratuitement sur le lieu où se " +
      "trouve votre figurine.",
    image: img('reveillez-kraken.png'),
  },

  // --- Conditions -----------------------------------------------------------
  {
    id: 'je-considere-non',
    name: 'Je considère cela comme un non',
    englishName: 'I’ll Take That As a "No"',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 3 },
    effects: [{ type: 'RECOVER_N_FROM_DISCARD', count: 2 }],
    text:
      "Cette carte est jouable pendant le tour d’un adversaire s’il élimine un Héros de force 3 " +
      "ou plus. Choisissez 2 cartes dans votre défausse et ajoutez-les à votre main.",
    image: img('je-considere-non.png'),
  },
  {
    id: 'ils-sont-la',
    name: 'Ils sont là',
    englishName: 'They’re Here',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    trigger: { type: 'opponent-discarded-ge', value: 2 },
    effects: [{ type: 'PLACE_TREASURE_FACEDOWN' }],
    text:
      "Cette carte est jouable pendant le tour d’un adversaire s’il se défausse de 2 cartes ou " +
      "plus. Ajoutez un jeton Trésor face cachée sur un Héros qui n’en a pas.",
    image: img('ils-sont-la.png'),
  },
  {
    id: 'wyvern-sexprime',
    name: 'Wyvern s’exprime',
    englishName: 'Wyvern Speaks',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    trigger: { type: 'opponent-played-ally' },
    effects: [{ type: 'DRAW_THEN_DISCARD', draw: 3, discard: 2 }],
    text:
      "Cette carte est jouable pendant le tour d’un adversaire s’il joue un Allié. Piochez 3 " +
      "cartes, puis défaussez 2 cartes de votre main.",
    image: img('wyvern-sexprime.png'),
  },

  // ===========================================================================
  // FATALITÉ
  // ===========================================================================
  {
    id: 'jack-sparrow',
    name: 'Jack Sparrow',
    englishName: 'Jack Sparrow',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    // Tant que le pion de Davy est sur son lieu, Davy ne peut pas faire d'action Éliminer.
    blocksVanquishHere: true,
    text:
      "Si Davy Jones se trouve sur le même lieu que JACK SPARROW, Davy Jones ne peut pas " +
      "effectuer d’action Éliminer un Héros.",
    image: img('jack-sparrow.png'),
  },
  {
    id: 'james-norrington',
    name: 'James Norrington',
    englishName: 'James Norrington',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    // +1 Force par Trésor récupéré ; à sa mort, Davy gagne 2 Pouvoir.
    selfStrengthMods: [{ kind: 'per-claimed-treasure', delta: 1 }],
    onVanquish: [{ type: 'GAIN_POWER', amount: 2 }],
    text:
      "Lorsque Davy Jones récupère un jeton Trésor, la force de JAMES NORRINGTON augmente de 1. " +
      "Lorsque JAMES NORRINGTON est éliminé, Davy Jones gagne 2 jetons Pouvoir.",
    image: img('james-norrington.png'),
  },
  {
    id: 'equipage-black-pearl',
    name: 'L’Équipage du Black Pearl',
    englishName: 'The Crew of the Black Pearl',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    selfStrengthMods: [{ kind: 'per-other-hero-realm', delta: 1 }],
    text: 'Sa force augmente de 1 pour chaque autre Héros en jeu.',
    image: img('equipage-black-pearl.png'),
  },
  {
    id: 'will-turner',
    name: 'Will Turner',
    englishName: 'Will Turner',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    // À sa pose, défausse un Allié de force ≤ 2 de son nouveau lieu (v1 : à la pose).
    onPlace: [{ type: 'WILL_TURNER_DISCARD' }],
    text:
      "Lorsque Will est joué ou déplacé, défaussez un Allié dont la force est inférieure ou " +
      "égale à 2 depuis son nouveau lieu.",
    image: img('will-turner.png'),
  },
  {
    id: 'elizabeth-swann',
    name: 'Élizabeth Swann',
    englishName: 'Elizabeth Swann',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    // +1 Force quand un autre Héros est joué (approx. : +1 par autre Héros en jeu).
    selfStrengthMods: [{ kind: 'per-other-hero-realm', delta: 1 }],
    text: 'Ajoutez-lui un jeton Force +1 lorsqu’un autre Héros est joué.',
    image: img('elizabeth-swann.png'),
  },
  {
    id: 'black-pearl-objet',
    name: 'Le Black Pearl',
    englishName: 'The Black Pearl',
    deck: 'fate',
    type: 'item',
    copies: 1,
    attach: 'hero',
    attachStrengthBonus: 3,
    // À la mort de l'hôte, se réassocie à un autre Héros du lieu (v1 : non réassocié auto).
    reattachOnHostDefeat: true,
    text:
      "Associez cette carte à un Héros. Lorsque ce Héros est éliminé, s’il y a un autre Héros " +
      "sur ce lieu, associez cette carte à ce nouveau Héros.",
    image: img('black-pearl-objet.png'),
  },
  {
    id: 'ou-pointe',
    name: 'Où ça pointe-t-il ?',
    englishName: 'Where Does It Point?',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    effects: [{ type: 'WHERE_POINTS' }],
    text:
      "Vous pouvez déplacer un Héros avec un jeton Trésor vers n’importe quel lieu. Vous pouvez " +
      "déplacer un Héros sans jeton Trésor vers n’importe quel lieu.",
    image: img('ou-pointe.png'),
  },
  {
    id: 'amour-calypso',
    name: 'L’amour de Calypso',
    englishName: 'Calypso’s Love',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    effects: [{ type: 'CAP_POWER', max: 2 }],
    text: 'Réduisez les jetons Pouvoir de Davy Jones à 2.',
    image: img('amour-calypso.png'),
  },
  {
    id: 'maudit-jack',
    name: 'Maudit sois-tu, Jack Sparrow',
    englishName: 'Curse You, Jack Sparrow',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    effects: [{ type: 'CURSE_TREASURE_CYCLE' }],
    text:
      "Retirez un jeton Trésor d’un Héros. Mélangez-le dans la réserve. Ajoutez un jeton Trésor " +
      "face cachée sur un Héros.",
    image: img('maudit-jack.png'),
  },
]
