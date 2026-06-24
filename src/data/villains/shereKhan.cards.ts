// =============================================================================
// Shere Khan — cartes (Méchant + Fatalité). Le Livre de la Jungle (1967).
// Faces découpées des planches assets/decks/Shere khan/ (Carte méchant.png 8×4,
// Carte fata.png 8×2). Texte FR = source de vérité ; effets ajoutés au fil de l'eau.
//
// Mécanique des JETONS FEU : posés/déplacés par la Fatalité (Feu Rouge des Hommes,
// Mowgli), retirés par les cartes Méchant (C'est moi Shere Khan, Macaques). Ils
// recouvrent une ACTION précise d'un lieu (cf. shereKhan.ts + engine/shereKhan.ts).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/shere-khan/${f}`

export const shereKhanCards: CardDef[] = [
  // --- Alliés ---------------------------------------------------------------
  {
    id: 'kaa',
    name: 'Kaa',
    englishName: 'Kaa',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 2,
    copies: 1,
    // Force +2 par Objet associé (porté par les Objets : Anneaux/Yeux, attachStrengthBonus 2).
    // Bouclier : si Kaa doit être défaussé, on défausse un Objet associé à la place
    // (porté par les Objets : shieldAllyFromDiscard). Capacité activée : jouer un Objet
    // de la défausse en payant son coût (handler dédié par cardId).
    text:
      "La force de KAA augmente de 2 pour chaque Objet qui lui est associé. Si KAA doit être " +
      "défaussé, vous pouvez défausser un Objet qui lui est associé à la place.\n\n" +
      "Activer : choisissez un Objet dans votre défausse et jouez-le en payant son coût.",
    image: img('kaa.png'),
    activatedCost: 0,
  },
  {
    id: 'le-roi-singe',
    name: 'Le Roi Singe',
    englishName: 'King Louie',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 5,
    copies: 1,
    text: 'Activer : déplacez une carte MACAQUES sur n\'importe quel lieu.',
    image: img('le-roi-singe.png'),
    activatedCost: 0,
  },
  {
    id: 'macaques',
    name: 'Macaques',
    englishName: 'Monkeys',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 6,
    text:
      "Activer : payez 1 jeton Pouvoir pour chaque jeton Feu sur ce lieu, puis retirez tous " +
      "les jetons Feu de ce lieu. Défaussez cette carte.",
    image: img('macaques.png'),
    activatedCost: 0,
  },

  // --- Objets ---------------------------------------------------------------
  {
    id: 'anneaux-de-kaa',
    name: 'Anneaux de Kaa',
    englishName: "Kaa's Coils",
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    attach: 'ally',
    attachOnlyCardId: 'kaa',
    attachStrengthBonus: 2,
    shieldAllyFromDiscard: true,
    text:
      "Associez cette carte à KAA. Lorsque KAA est déplacé, vous pouvez déplacer un Héros du " +
      "lieu de départ de KAA vers son lieu d'arrivée.",
    image: img('anneaux-de-kaa.png'),
  },
  {
    id: 'yeux-de-kaa',
    name: 'Yeux de Kaa',
    englishName: "Kaa's Eyes",
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    attach: 'ally',
    attachOnlyCardId: 'kaa',
    attachStrengthBonus: 2,
    shieldAllyFromDiscard: true,
    text:
      "Associez cette carte à KAA. Lorsque votre figurine se trouve sur ce lieu, vous pouvez " +
      "effectuer une action recouverte par un Héros, mais pas par un jeton Feu.",
    image: img('yeux-de-kaa.png'),
  },

  // --- Événements -----------------------------------------------------------
  {
    id: 'tout-le-monde-fuit',
    name: 'Tout le monde fuit devant Shere Khan',
    englishName: 'Everyone Runs From Shere Khan',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Vous pouvez effectuer une action Activer une capacité OU une action Éliminer un Héros.',
    image: img('tout-le-monde-fuit.png'),
    effects: [{ type: 'GRANT_FREE_ACTIVATE_OR_VANQUISH' }],
  },
  {
    id: 'jeune-et-sans-defense',
    name: 'Jeune et sans défense',
    englishName: 'Young and Helpless',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text:
      "Déplacez un Héros sur le même lieu qu'un Allié OU Gagnez 1 jeton Pouvoir pour chaque " +
      "Allié dans votre royaume.",
    image: img('jeune-et-sans-defense.png'),
    effects: [{ type: 'MOVE_HERO_TO_ALLY_OR_POWER_PER_ALLY' }],
  },
  {
    id: 'a-toi-de-jouer-cousin',
    name: 'À toi de jouer, cousin',
    englishName: 'Hey Cuz',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text:
      "Dévoilez les cartes de votre pioche jusqu'à ce que vous trouviez un Allié, jouez-le " +
      "gratuitement et défaussez les autres cartes dévoilées.",
    image: img('a-toi-de-jouer-cousin.png'),
    effects: [{ type: 'REVEAL_UNTIL_ALLY_PLAY_FREE' }],
  },
  {
    id: 'bravo-bravo',
    name: 'Bravo ! Bravo !',
    englishName: 'Bravo! Bravo!',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text:
      "Cette carte est jouable sans effectuer d'action Jouer une carte. Vous pouvez effectuer " +
      "n'importe quelle action recouverte par un Héros ou un jeton Feu sur le lieu où se trouve " +
      "votre figurine.",
    image: img('bravo-bravo.png'),
    effects: [{ type: 'USE_COVERED_ACTIONS_THIS_TURN', includeFire: true }],
    playableWithoutAction: true,
  },
  {
    id: 'cest-a-moi-que-vous-le-direz',
    name: 'C\'est à moi que vous le direz',
    englishName: 'You Will Inform Me First',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text:
      "Défaussez les 3 premières cartes de votre pioche Fatalité. Vous pouvez choisir une carte " +
      "Fatalité dans la défausse et la mélanger dans la pioche.",
    image: img('cest-a-moi-que-vous-le-direz.png'),
    effects: [{ type: 'DISCARD_FATE_THEN_RECOVER', count: 3 }],
  },
  {
    id: 'cest-moi-shere-khan',
    name: 'C\'est moi, Shere Khan',
    englishName: "It's Me, Shere Khan",
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Retirez un jeton Feu sur le lieu où se trouve votre figurine.',
    image: img('cest-moi-shere-khan.png'),
    effects: [{ type: 'REMOVE_FIRE_AT_PAWN' }],
  },
  {
    id: 'lance-sur-ses-traces',
    name: 'Lancé sur ses traces',
    englishName: 'Sure to Pick Up His Trail',
    deck: 'villain',
    type: 'effect',
    cost: 5,
    copies: 2,
    text: "Si MOWGLI est dans votre royaume, éliminez un Héros. Sinon, cherchez MOWGLI et jouez-le.",
    image: img('lance-sur-ses-traces.png'),
    effects: [{ type: 'DEFEAT_OR_FETCH_HERO', heroCardId: 'mowgli' }],
  },

  // --- Conditions -----------------------------------------------------------
  {
    id: 'aie-confiance',
    name: 'Aie confiance',
    englishName: 'Trust in Me',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text:
      "Cette carte est jouable pendant le tour d'un adversaire s'il effectue au moins 3 actions " +
      "durant ce tour. Cherchez 3 cartes dans votre défausse puis remélangez-les dans votre pioche.",
    image: img('aie-confiance.png'),
    trigger: { type: 'opponent-actions-ge', value: 3 },
    effects: [{ type: 'RECOVER_CARDS_TO_DECK', count: 3 }],
  },
  {
    id: 'cest-tres-interessant',
    name: 'C\'est très intéressant… Quelle attrayante nouvelle',
    englishName: 'How Interesting... How Delightful',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text:
      "Cette carte est jouable pendant le tour d'un adversaire s'il effectue une action Jouer une " +
      "carte. Vous pouvez effectuer une ou plusieurs actions parmi les suivantes : gagner 1 jeton " +
      "Pouvoir, piocher 1 carte, déplacer 1 jeton Feu sur une autre action.",
    image: img('cest-tres-interessant.png'),
    trigger: { type: 'opponent-played-cards-ge', value: 1 },
    effects: [{ type: 'INTERESSANT_CHOICE' }],
  },

  // --- Fatalité : Héros -----------------------------------------------------
  {
    id: 'mowgli',
    name: 'Mowgli',
    englishName: 'Mowgli',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Placez un jeton Feu sur le lieu où MOWGLI est joué ou déplacé.',
    image: img('mowgli.png'),
    onPlace: [{ type: 'PLACE_FIRE_AT_HOST' }],
  },
  {
    id: 'la-patrouille-de-la-jungle',
    name: 'La Patrouille de la Jungle',
    englishName: 'The Jungle Patrol',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text:
      "Dévoilez la première carte Fatalité de la pioche. S'il s'agit d'un Événement, jouez-la. " +
      "Sinon, replacez-la sur la pioche.",
    image: img('la-patrouille-de-la-jungle.png'),
    onPlace: [{ type: 'REVEAL_FATE_PLAY_IF_EVENT' }],
  },
  {
    id: 'baloo',
    name: 'Baloo',
    englishName: 'Baloo',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    // Bouclier collectif : quand un AUTRE Héros doit être éliminé, on pose à la place un
    // jeton Pouvoir sur Baloo ; à 3 jetons, Baloo (et ses jetons) est défaussé.
    text:
      "Lorsqu'un autre Héros doit être éliminé, placez un jeton Pouvoir sur BALOO à la place. " +
      "Lorsque BALOO a 3 jetons Pouvoir sur lui, défaussez-le ainsi que ses jetons Pouvoir.",
    image: img('baloo.png'),
    shieldsOtherHeroesUntilTokens: 3,
  },
  {
    id: 'vautours',
    name: 'Vautours',
    englishName: 'Vultures',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text:
      "Vous pouvez choisir un Héros sur le lieu où vous jouez les VAUTOURS. Déplacez ce Héros et " +
      "les VAUTOURS vers un autre lieu.",
    image: img('vautours.png'),
    onPlace: [{ type: 'VULTURES_MOVE' }],
  },
  {
    id: 'bagheera',
    name: 'Bagheera',
    englishName: 'Bagheera',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text:
      "Vous pouvez déplacer chaque Héros et Allié du lieu où vous jouez BAGHEERA vers n'importe " +
      "quel(s) autre(s) lieu(x).",
    image: img('bagheera.png'),
    onPlace: [{ type: 'BAGHEERA_SCATTER' }],
  },
  {
    id: 'meute-de-loups',
    name: 'Meute de Loups',
    englishName: 'Wolf Pack',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 2,
    text:
      "Défaussez un Objet ou une carte MACAQUES sur le lieu où vous jouez la MEUTE DE LOUPS.",
    image: img('meute-de-loups.png'),
    onPlace: [{ type: 'WOLF_PACK_DISCARD' }],
  },

  // --- Fatalité : Événements ------------------------------------------------
  {
    id: 'prendre-le-tigre-par-la-queue',
    name: 'Prendre le tigre par la queue',
    englishName: 'Tiger by the Tail',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text:
      "Vous pouvez déplacer un Héros vers le lieu de votre choix. Vous pouvez déplacer la figurine " +
      "de Shere Khan vers un lieu où se trouve un Héros.",
    image: img('prendre-le-tigre-par-la-queue.png'),
    effects: [{ type: 'TIGER_BY_THE_TAIL' }],
  },
  {
    id: 'cest-mon-ami',
    name: 'C\'est mon ami',
    englishName: "He's My Friend",
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Choisissez un lieu et ajoutez un jeton Force +1 à tous les Héros présents sur ce lieu.',
    image: img('cest-mon-ami.png'),
    effects: [{ type: 'BUFF_HEROES_AT_LOCATION', amount: 1 }],
  },
  {
    id: 'feu-rouge-des-hommes',
    name: 'Feu Rouge des Hommes',
    englishName: "Man's Red Fire",
    deck: 'fate',
    type: 'effect',
    copies: 5,
    text: "Placez un jeton Feu sur une action au choix OU déplacez un jeton Feu sur une autre action.",
    image: img('feu-rouge-des-hommes.png'),
    effects: [{ type: 'PLACE_OR_MOVE_FIRE' }],
  },
]
