// =============================================================================
// Ursula — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Ursula/ — transcription complète
// dans assets/decks/Ursula/ursula_reference.md.
//
// PÉRIMÈTRE. Implémentés : objectif (Trident + Couronne au Repaire), Palais
// bloqué + Cadenas mobile (Métamorphose, Grimsby), Couronne (regarde 2 cartes
// Fatalité), Pactes (Héros éliminé déplacé sur le lieu du Pacte), Trident (via le
// Roi Triton, libéré quand Triton est éliminé), Chaudron (+2/Pacte), Divination,
// Opportunisme, Tourbillon, Flotsam/Jetsam, Âmes en Perdition, Conditions
// (Arrogance, Illusion), Héros Fatalité Polochon, Eurêka, Sébastien, Max, Ariel.
// Colère Titanesque : effectuer une action d'un lieu voisin (le joueur choisit
// le lieu, puis agit dessus comme s'il y était, le temps d'une action).
// SIMPLIFICATIONS (auto vs choix complet) : Eurêka prend le 1er Objet de la
// défausse Fatalité ; Ariel gèle l'Objet « prioritaire » ; Âmes en Perdition
// déplace les Héros « sous Pacte » sur leur lieu (déclenche les Pactes).
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/ursula/${file}`

export const ursulaCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés (2)
  // ----------------------------------------------------------------------
  {
    id: 'flotsam',
    name: 'Flotsam',
    englishName: 'Flotsam',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    text: 'Déplacez un Héros du lieu où se trouve Flotsam vers un lieu voisin non bloqué.',
    image: img('flotsam.png'),
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
  },
  {
    id: 'jetsam',
    name: 'Jetsam',
    englishName: 'Jetsam',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    text: 'Déplacez un Héros du lieu où se trouve Jetsam vers un lieu voisin non bloqué.',
    image: img('jetsam.png'),
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets (9)
  // ----------------------------------------------------------------------
  {
    id: 'pacte-repaire',
    name: 'Pacte',
    englishName: "Binding Contract (Ursula's Lair)",
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'hero',
    copies: 1,
    text: "Associez à un Héros qui n'est pas au Repaire d'Ursula. Ce Héros est éliminé s'il est déplacé sur le Repaire d'Ursula.",
    image: img('pacte-repaire.png'),
    contractLocationId: 'repaire',
  },
  {
    id: 'pacte-palais',
    name: 'Pacte',
    englishName: 'Binding Contract (The Palace)',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'hero',
    copies: 1,
    text: "Associez à un Héros qui n'est pas au Palais. Ce Héros est éliminé s'il est déplacé sur le Palais.",
    image: img('pacte-palais.png'),
    contractLocationId: 'palais',
  },
  {
    id: 'pacte-navire',
    name: 'Pacte',
    englishName: "Binding Contract (Eric's Ship)",
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'hero',
    copies: 2,
    text: "Associez à un Héros qui n'est pas sur le Navire du Prince Éric. Ce Héros est éliminé s'il y est déplacé.",
    image: img('pacte-navire.png'),
    contractLocationId: 'navire',
  },
  {
    id: 'pacte-rivage',
    name: 'Pacte',
    englishName: 'Binding Contract (The Shore)',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'hero',
    copies: 2,
    text: "Associez à un Héros qui n'est pas sur le Rivage. Ce Héros est éliminé s'il est déplacé sur le Rivage.",
    image: img('pacte-rivage.png'),
    contractLocationId: 'rivage',
  },
  {
    id: 'chaudron',
    name: 'Chaudron',
    englishName: 'Cauldron',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'location',
    copies: 1,
    text: 'Gagnez 2 jetons Pouvoir par Pacte dans votre royaume.',
    image: img('chaudron.png'),
    effects: [{ type: 'GAIN_POWER_PER_CONTRACT', amount: 2 }],
  },
  {
    id: 'couronne',
    name: 'Couronne',
    englishName: 'Crown',
    deck: 'villain',
    type: 'item',
    cost: 4,
    attach: 'location',
    copies: 1,
    text: 'Regardez les 2 premières cartes Fatalité de votre pioche. Défaussez-les ou remettez-les sur le dessus dans l’ordre de votre choix.',
    image: img('couronne.png'),
    effects: [{ type: 'SCRY_OWN_FATE_TOP2' }],
  },
  {
    id: 'trident',
    name: 'Trident',
    englishName: 'Trident',
    deck: 'villain',
    type: 'item',
    cost: 4,
    attach: 'location',
    copies: 1,
    text: 'Cherchez le Roi Triton, posez-le en zone haute et associez-lui le Trident. Si vous éliminez le Roi Triton, le Trident revient en zone basse de votre royaume, au même lieu.',
    image: img('trident.png'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (15)
  // ----------------------------------------------------------------------
  {
    id: 'metamorphose',
    name: 'Métamorphose',
    englishName: 'Change Form',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: "Déplacez la tuile Cadenas vers le Repaire d'Ursula ou vers le Palais.",
    image: img('metamorphose.png'),
    effects: [{ type: 'TOGGLE_URSULA_LOCK' }],
  },
  {
    id: 'tourbillon',
    name: 'Tourbillon',
    englishName: 'Whirlpool',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Déplacez un Héros vers n’importe quel lieu non bloqué.',
    image: img('tourbillon.png'),
    effects: [{ type: 'RELOCATE_OWN_HERO', anyLocation: true }],
  },
  {
    id: 'divination',
    name: 'Divination',
    englishName: 'Divination',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Dévoilez votre pioche jusqu’à trouver un Pacte. Ajoutez-le à votre main puis défaussez les autres cartes dévoilées.',
    image: img('divination.png'),
    effects: [{ type: 'REVEAL_VILLAIN_UNTIL_CONTRACT' }],
  },
  {
    id: 'colere-titanesque',
    name: 'Colère Titanesque',
    englishName: 'Grow Giant',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Effectuez une action disponible sur un lieu voisin (bloqué ou non) de celui où vous vous trouvez.',
    image: img('colere-titanesque.png'),
    effects: [{ type: 'GIANT_ACTION' }],
  },
  {
    id: 'opportunisme',
    name: 'Opportunisme',
    englishName: 'Opportunist',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Cherchez un Objet ou un Événement dans votre défausse et ajoutez-le à votre main.',
    image: img('opportunisme.png'),
    effects: [{ type: 'RECOVER_ITEM_OR_EVENT' }],
  },
  {
    id: 'ames-perdition',
    name: 'Âmes en Perdition',
    englishName: 'Poor Unfortunate Souls',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 1,
    text: 'Vous pouvez déplacer chaque Héros vers un lieu voisin non bloqué.',
    image: img('ames-perdition.png'),
    // Version automatique : déplace les Héros « sous Pacte » sur leur lieu de
    // Pacte voisin (déclenche les éliminations). Le repositionnement libre de
    // chaque Héros (au choix) reste à faire.
    effects: [{ type: 'AMES_EN_PERDITION' }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (4)
  // ----------------------------------------------------------------------
  {
    id: 'illusion',
    name: 'Illusion',
    englishName: 'Trickery',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il possède au moins 6 jetons Pouvoir. Dévoilez la 1ʳᵉ carte Fatalité de sa pioche et jouez-la immédiatement.',
    image: img('illusion.png'),
    trigger: { type: 'opponent-power-ge', value: 6 },
  },
  {
    id: 'arrogance',
    name: 'Arrogance',
    englishName: 'Arrogance',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il élimine un Héros de force 4 ou plus. Piochez 3 cartes Méchant puis défaussez-en 3.',
    image: img('arrogance.png'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 4 },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (8)
  // ----------------------------------------------------------------------
  {
    id: 'roi-triton',
    name: 'Le Roi Triton',
    englishName: 'King Triton',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text: 'Les Pactes et Événements ciblant Le Roi Triton coûtent 1 jeton Pouvoir de plus.',
    image: img('roi-triton.png'),
  },
  {
    id: 'prince-eric',
    name: 'Prince Éric',
    englishName: 'Prince Eric',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Déplacez un Héros vers un lieu non bloqué de votre choix.',
    image: img('prince-eric.png'),
  },
  {
    id: 'ariel',
    name: 'Ariel',
    englishName: 'Ariel',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: "Déplacez un Objet sur le lieu où vous jouez Ariel. Ursula ne peut plus déplacer cet Objet tant qu'Ariel n'a pas été éliminée.",
    image: img('ariel.png'),
    onPlace: [{ type: 'ARIEL_FREEZE_ITEM' }],
  },
  {
    id: 'max',
    name: 'Max',
    englishName: 'Max',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Si vous jouez Max sur le lieu où se trouve Ursula, vous pouvez déplacer sa figurine vers n'importe quel lieu non bloqué.",
    image: img('max.png'),
    onPlace: [{ type: 'MOVE_URSULA_PAWN' }],
  },
  {
    id: 'sebastien',
    name: 'Sébastien',
    englishName: 'Sebastian',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Prenez le Pacte d’un autre Héros et associez-le à Sébastien à la place.',
    image: img('sebastien.png'),
    onPlace: [{ type: 'STEAL_CONTRACT_TO_HOST' }],
  },
  {
    id: 'eureka',
    name: 'Eurêka',
    englishName: 'Scuttle',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Cherchez un Objet dans la défausse Fatalité d'Ursula, puis associez-le à Eurêka.",
    image: img('eureka.png'),
    onPlace: [{ type: 'EUREKA_ATTACH_ITEM' }],
  },
  {
    id: 'grimsby',
    name: 'Grimsby',
    englishName: 'Grimsby',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Vous pouvez déplacer la tuile Cadenas sur le Repaire d'Ursula ou sur le Palais.",
    image: img('grimsby.png'),
    onPlace: [{ type: 'TOGGLE_URSULA_LOCK' }],
  },
  {
    id: 'polochon',
    name: 'Polochon',
    englishName: 'Flounder',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: "Mélangez la défausse et la pioche de cartes Méchant d'Ursula.",
    image: img('polochon.png'),
    // À la pose : Ursula (le vilain ciblé) mélange sa défausse Vilain dans sa pioche.
    onPlace: [{ type: 'SHUFFLE_VILLAIN_DISCARD' }],
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets (4)
  // ----------------------------------------------------------------------
  {
    id: 'bigette',
    name: 'Bigette Bulbeuse',
    englishName: 'Dinglehopper',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 2,
    text: 'Associez à un Héros. Associer un Pacte à ce Héros coûte 3 jetons Pouvoir de plus.',
    image: img('bigette.png'),
  },
  {
    id: 'zirgouflex',
    name: 'Zirgouflex',
    englishName: 'Snarfblat',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 2,
    text: "Associez à un Héros. Quand Ursula se déplace sur le lieu de ce Héros, elle perd 1 jeton Pouvoir.",
    image: img('zirgouflex.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Effets (3)
  // ----------------------------------------------------------------------
  {
    id: 'apparence-retrouvee',
    name: 'Apparence Retrouvée',
    englishName: 'Return to Form',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: "Cherchez un Héros de force 4 ou moins dans la défausse Fatalité d'Ursula. Jouez-le immédiatement sur le lieu où se trouve Ursula.",
    image: img('apparence-retrouvee.png'),
  },
]
