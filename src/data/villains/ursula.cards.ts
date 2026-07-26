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
    image: img('flotsam.webp'),
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
    journal:
      'Flotsam rejoint le royaume et repousse {nomHéros} vers {nomLieu}.\n' +
      'Flotsam rejoint le royaume.',
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
    image: img('jetsam.webp'),
    effects: [{ type: 'RELOCATE_OWN_HERO' }],
    journal:
      'Jetsam rejoint le royaume et repousse {nomHéros} vers {nomLieu}.\n' +
      'Jetsam rejoint le royaume.',
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
    image: img('pacte-repaire.webp'),
    contractLocationId: 'repaire',
    journal: 'Pacte : mener {nomHéros} au Repaire d’Ursula causera sa perte.',
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
    image: img('pacte-palais.webp'),
    contractLocationId: 'palais',
    journal: 'Pacte : mener {nomHéros} au Palais causera sa perte.',
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
    image: img('pacte-navire.webp'),
    contractLocationId: 'navire',
    journal: 'Pacte : mener {nomHéros} sur le Navire du Prince Éric causera sa perte.',
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
    image: img('pacte-rivage.webp'),
    contractLocationId: 'rivage',
    journal: 'Pacte : mener {nomHéros} sur le Rivage causera sa perte.',
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
    image: img('chaudron.webp'),
    effects: [{ type: 'GAIN_POWER_PER_CONTRACT', amount: 2 }],
    journal: 'Chaudron : chaque Pacte du royaume rapporte 2 JT.',
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
    image: img('couronne.webp'),
    effects: [{ type: 'SCRY_OWN_FATE_TOP2' }],
    journal: 'Couronne : les 2 premières cartes Fatalité sont examinées.',
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
    image: img('trident.webp'),
    journal: 'Trident : le Roi Triton est convoqué, le Trident rivé entre ses mains.',
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
    image: img('metamorphose.webp'),
    effects: [{ type: 'TOGGLE_URSULA_LOCK' }],
    journal: 'Métamorphose : le Cadenas glisse entre le Repaire et le Palais.',
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
    image: img('tourbillon.webp'),
    effects: [{ type: 'RELOCATE_OWN_HERO', anyLocation: true }],
    journal:
      'Tourbillon : les eaux emportent {nomHéros} vers {nomLieu}.\n' +
      'Tourbillon : les eaux tourbillonnent en vain.',
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
    image: img('divination.webp'),
    effects: [{ type: 'REVEAL_VILLAIN_UNTIL_CONTRACT' }],
    journal: 'Divination : la pioche est dévoilée jusqu’à trouver un Pacte.',
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
    image: img('colere-titanesque.webp'),
    effects: [{ type: 'GIANT_ACTION' }],
    journal: 'Colère Titanesque : une action d’un lieu voisin est effectuée.',
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
    image: img('opportunisme.webp'),
    effects: [{ type: 'RECOVER_ITEM_OR_EVENT' }],
    journal:
      'Opportunisme : retour en main de {nomCarte}.\n' +
      'Opportunisme : une carte revient de la défausse en main.',
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
    image: img('ames-perdition.webp'),
    // Version automatique : déplace les Héros « sous Pacte » sur leur lieu de
    // Pacte voisin (déclenche les éliminations). Le repositionnement libre de
    // chaque Héros (au choix) reste à faire.
    effects: [{ type: 'AMES_EN_PERDITION' }],
    journal: 'Âmes en Perdition : les Héros sous Pacte sont attirés vers leur perte.',
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
    image: img('illusion.webp'),
    trigger: { type: 'opponent-power-ge', value: 6 },
    journal: 'Illusion : la première carte Fatalité de {nomAdv} lui est jouée aussitôt.',
  },
  {
    id: 'arrogance',
    name: 'Arrogance',
    englishName: 'Arrogance',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il élimine un Héros de force 4 ou plus. Piochez 3 cartes Méchant puis défaussez-en 3.',
    image: img('arrogance.webp'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 4 },
    journal: 'Arrogance : pioche 3 cartes, puis en défausse 3.',
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
    image: img('roi-triton.webp'),
    pacteTargetSurcharge: 1,
    journal: 'Le Roi Triton apparaît : les Pactes et Événements qui le visent coûtent 1 JT de plus.',
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
    image: img('prince-eric.webp'),
    journal: 'Le Prince Éric apparaît.',
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
    image: img('ariel.webp'),
    onPlace: [{ type: 'ARIEL_FREEZE_ITEM' }],
    journal: 'Ariel apparaît : un Objet de son lieu est gelé jusqu’à son élimination.',
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
    image: img('max.webp'),
    onPlace: [{ type: 'MOVE_URSULA_PAWN' }],
    journal: 'Max apparaît : sur le lieu d’Ursula, il en chasse la figurine.',
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
    image: img('sebastien.webp'),
    onPlace: [{ type: 'STEAL_CONTRACT_TO_HOST' }],
    journal: 'Sébastien apparaît : il s’accapare le Pacte d’un autre Héros.',
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
    image: img('eureka.webp'),
    onPlace: [{ type: 'EUREKA_ATTACH_ITEM' }],
    journal: 'Eurêka apparaît : un Objet de la défausse Fatalité lui est associé.',
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
    image: img('grimsby.webp'),
    onPlace: [{ type: 'TOGGLE_URSULA_LOCK' }],
    journal: 'Grimsby apparaît : le Cadenas peut glisser entre le Repaire et le Palais.',
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
    image: img('polochon.webp'),
    // À la pose : Ursula (le vilain ciblé) mélange sa défausse Vilain dans sa pioche.
    onPlace: [{ type: 'SHUFFLE_VILLAIN_DISCARD' }],
    journal: 'Polochon apparaît : la défausse Méchant est remélangée dans la pioche.',
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
    image: img('bigette.webp'),
    journal: 'Bigette Bulbeuse : associer un Pacte à {nomHéros} coûte 3 JT de plus.',
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
    image: img('zirgouflex.webp'),
    powerLossOnPawnArrive: 1,
    journal: 'Zirgouflex : arriver sur le lieu de {nomHéros} coûtera 1 JT.',
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
    image: img('apparence-retrouvee.webp'),
    journal:
      'Apparence Retrouvée : un Héros de Force 4 ou moins revient de la défausse Fatalité sur le lieu de la figurine.',
  },
]
