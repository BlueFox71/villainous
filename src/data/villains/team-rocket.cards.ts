// =============================================================================
// Team Rocket — cartes (deck Méchant : 30 ; deck Fatalité : 15).
//
// Noms / coûts / forces / textes tirés du tableur « Villainous Template_Jules.ods »
// (onglet Team_Rocket) ; illustrations découpées depuis assets/decks/Team Rocket/.
// Le TEXTE français est la source de vérité.
//
// ÉTAT (phase 1) : données + plateau + câblage. Les `effects` réutilisant l'existant
// sont posés (recover/reveal, attach, auras de force, ridesWithPawn, reachesAdjacent).
// La mécanique inédite (Attraper → pile de Captures, invocation des Pokémon par les
// dresseurs, évolutions, Conditions tour-adverse) est ajoutée aux phases suivantes —
// ces cartes restent pour l'instant en TEXTE seul.
//
// MÉCANIQUE : les Pokémon (deck Fatalité) sont des Héros `isPokemon` ; on les CAPTURE
// (action Attraper) au lieu de les vaincre → pile de Captures. Objectif : 4 dont Pikachu.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/team-rocket/${f}`

export const teamRocketCards: CardDef[] = [
  // ==========================================================================
  // DECK MÉCHANT (30)
  // ==========================================================================

  // --- Alliés (lignée Pokémon de la Team Rocket, évolutifs) -----------------
  {
    id: 'abo',
    name: 'Abo',
    englishName: 'Ekans',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 1,
    strengthMod: { target: 'heroes-here', delta: -1 },
    text: "Les Héros qui se trouvent sur le même lieu qu'Abo ont une force diminuée de 1. (peut s'évoluer en Arbok)",
    image: img('abo.png'),
  },
  {
    id: 'arbok',
    name: 'Arbok',
    englishName: 'Arbok',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    strengthMod: { target: 'heroes-here', delta: -2 },
    text: "Les Héros qui se trouvent sur le même lieu qu'Arbok ont une force diminuée de 2.",
    image: img('arbok.png'),
  },
  {
    id: 'smogo',
    name: 'Smogo',
    englishName: 'Koffing',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 1,
    text: "Si vous jouez Smogo sur un lieu où vous ne vous trouvez pas, vous pouvez effectuer une action disponible de ce lieu, en dehors d'une action Fatalité. (peut s'évoluer en Smogogo)",
    image: img('smogo.png'),
  },
  {
    id: 'smogogo',
    name: 'Smogogo',
    englishName: 'Weezing',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    text: "Si vous jouez Smogogo sur un lieu où vous ne vous trouvez pas, vous pouvez effectuer 1 action, recouverte ou non, de ce lieu, en dehors d'une action Fatalité.",
    image: img('smogogo.png'),
  },
  {
    id: 'miaouss',
    name: 'Miaouss',
    englishName: 'Meowth',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 3,
    copies: 1,
    reachesAdjacentVanquish: true,
    text: "Lors d'une action Éliminer un Héros, Miaouss peut être utilisé pour éliminer un Héros sur son lieu ou sur un lieu voisin. (peut s'évoluer en Persian)",
    image: img('miaouss.png'),
  },
  {
    id: 'persian',
    name: 'Persian',
    englishName: 'Persian',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 4,
    copies: 1,
    // TODO phase 3 : « n'importe quel lieu » (pour l'instant approximé en lieu voisin).
    reachesAdjacentVanquish: true,
    text: "Lors d'une action Éliminer un Héros, Persian peut être utilisé pour éliminer un Héros sur n'importe quel lieu.",
    image: img('persian.png'),
  },

  // --- Objets ----------------------------------------------------------------
  {
    id: 'pokeball',
    name: 'Pokéball',
    englishName: 'Poké Ball',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'ally',
    attachStrengthBonus: 1,
    shieldAllyFromDiscard: true,
    copies: 2,
    text: "Associez cette carte à un Allié, sa force augmente de 1. Si cet Allié doit être défaussé, défaussez cet Objet à la place.",
    image: img('pokeball.png'),
  },
  {
    id: 'griffure',
    name: 'Griffure',
    englishName: 'Scratch',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'hero',
    attachStrengthBonus: -1,
    copies: 2,
    text: "Associez à un Héros, sa force diminue de 1.",
    image: img('griffure.png'),
  },
  {
    id: 'rose-de-james',
    name: 'rose de James',
    englishName: "James's Rose",
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'ally',
    copies: 2,
    // TODO phase 3 : déclenche une action Attraper si l'Allié hôte a éliminé un Héros, puis se défausse.
    text: "Associez cet Objet à un Allié. Si cet Allié a été utilisé pour éliminer un Héros, vous pouvez effectuer l'action « Attraper un Pokémon ». Défaussez cette carte ensuite.",
    image: img('rose-de-james.png'),
  },
  {
    id: 'pokedex-vole',
    name: 'Pokédex volé',
    englishName: 'Stolen Pokédex',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    // TODO phase 3 : étend la portée de l'action Attraper d'un lieu (lieux voisins).
    text: "Allonge d'un lieu votre portée pour attraper un Pokémon.",
    image: img('pokedex-vole.png'),
  },
  {
    id: 'mongolfiere',
    name: 'Mongolfière',
    englishName: 'Meowth Balloon',
    deck: 'villain',
    type: 'item',
    cost: 3,
    ridesWithPawn: true,
    copies: 1,
    text: "Lorsque vous êtes sur le même lieu que la Mongolfière, vous pouvez, une fois par tour, déplacer votre figurine et la Mongolfière vers n'importe quel lieu et y effectuer une action disponible, en dehors d'une action Fatalité.",
    image: img('mongolfiere.png'),
  },

  // --- Événements ------------------------------------------------------------
  {
    id: 'jessie-rocket',
    name: 'Jessie !',
    englishName: 'Jessie!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    effects: [{ type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['ally', 'effect'], label: 'Récupérer un Allié ou un Événement' }],
    text: "Cherchez un Allié ou un Événement dans votre défausse et ajoutez-le à votre main.",
    image: img('jessie.png'),
  },
  {
    id: 'james',
    name: 'James !',
    englishName: 'James!',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'REVEAL_VILLAIN_UNTIL_TYPE', cardType: 'item' }],
    text: "Dévoilez les cartes de votre pioche jusqu'à ce que vous trouviez un Objet. Jouez-le et remettez les autres cartes sur le dessus de votre pioche.",
    image: img('james.png'),
  },
  {
    id: 'reperage',
    name: 'Repérage',
    englishName: 'Scouting',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 3,
    // TODO phase 3 : dévoiler le deck Fatalité jusqu'à un Héros (dresseur), le jouer, défausser le reste.
    text: "Dévoilez les cartes Fatalité jusqu'à ce que vous trouviez un Héros. Jouez-le et défaussez les autres cartes dévoilées.",
    image: img('reperage.png'),
  },
  {
    id: 'evolution',
    name: 'Évolution',
    englishName: 'Evolution',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    // TODO phase 3 : faire évoluer un Allié (Abo→Arbok, Smogo→Smogogo, Miaouss→Persian).
    text: "Choisissez un Allié dans votre royaume. S'il peut s'évoluer et que son évolution n'est pas déjà dans votre royaume, défaussez-le, cherchez l'Allié indiqué et jouez-le sur le même lieu.",
    image: img('evolution.png'),
  },
  {
    id: 'toilettage',
    name: 'Toilettage',
    englishName: 'Grooming',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    // TODO phase 3 : regarder les 2 premières cartes Fatalité de sa pioche (scry).
    text: "Regardez secrètement les deux premières cartes Fatalité de votre pioche. Défaussez-les ou remettez-les sur le dessus de la pioche dans n'importe quel ordre.",
    image: img('toilettage.png'),
  },

  // --- Conditions (jouables pendant le tour d'un adversaire) -----------------
  {
    id: 'oui-la-guerre',
    name: 'Oui, la guerre !',
    englishName: 'Yes, War!',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 1,
    // TODO phase 3 : trigger (adversaire élimine un Héros de force ≥3) → éliminer un Héros de force ≥3.
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il élimine un Héros de force 3 ou plus. Éliminez un Héros de force 3 ou plus.",
    image: img('oui-la-guerre.png'),
  },
  {
    id: 'mauvais-tour',
    name: 'Pour vous jouer un mauvais tour',
    englishName: 'To Play a Bad Trick',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    // TODO phase 3 : trigger (adversaire vous joue un Héros de force ≤3) → dévoiler et jouer sa 1ʳᵉ Fatalité.
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il vous joue un Héros de force 3 ou moins. Dévoilez la première carte Fatalité de sa pioche et jouez-la immédiatement.",
    image: img('mauvais-tour.png'),
  },
  {
    id: 'oh-des-pokemons',
    name: 'Oh des pokémons !',
    englishName: 'Oh, Pokémon!',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 1,
    trigger: { type: 'opponent-allies-in-realm-ge', value: 2 },
    effects: [{ type: 'GAIN_POWER', amount: 3 }],
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il possède au moins 2 Alliés. Gagnez 3 jetons Pouvoir.",
    image: img('oh-des-pokemons.png'),
  },

  // ==========================================================================
  // DECK FATALITÉ (15)
  // ==========================================================================

  // --- Dresseurs (Héros) : chacun invoque son Pokémon -----------------------
  {
    id: 'sacha',
    name: 'Sacha',
    englishName: 'Ash',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    summonsPokemonCardIds: ['pikachu', 'dracaufeu'],
    text: "Cherchez Pikachu ou Dracaufeu et jouez-le immédiatement avec Sacha sur le même lieu. Si ce Pokémon choisi est défaussé, défaussez Sacha.",
    image: img('sacha.png'),
  },
  {
    id: 'ondine',
    name: 'Ondine',
    englishName: 'Misty',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    summonsPokemonCardIds: ['stari', 'togepi'],
    text: "Cherchez Stari ou Togepi et jouez-le immédiatement avec Ondine sur le même lieu. Si ce Pokémon choisi est défaussé, défaussez Ondine.",
    image: img('ondine.png'),
  },
  {
    id: 'pierre',
    name: 'Pierre',
    englishName: 'Brock',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    summonsPokemonCardIds: ['goupix', 'onix'],
    text: "Cherchez Goupix ou Onix et jouez-le immédiatement avec Pierre sur le même lieu. Si ce Pokémon choisi est défaussé, défaussez Pierre.",
    image: img('pierre.png'),
  },

  // --- Pokémon (Héros `isPokemon`, capturés via Attraper) -------------------
  {
    id: 'pikachu',
    name: 'Pikachu',
    englishName: 'Pikachu',
    deck: 'fate',
    type: 'hero',
    isPokemon: true,
    strength: 5,
    copies: 1,
    // TODO phase 2 : « joué dès qu'il est dévoilé » + défausse des autres Fatalités dévoilées.
    text: "Vous devez immédiatement jouer Pikachu dès qu'il est dévoilé. Défaussez les autres cartes Fatalité qui ont été dévoilées.",
    image: img('pikachu.png'),
  },
  {
    id: 'dracaufeu',
    name: 'Dracaufeu',
    englishName: 'Charizard',
    deck: 'fate',
    type: 'hero',
    isPokemon: true,
    strength: 4,
    copies: 1,
    strengthMod: { target: 'heroes-realm', delta: 1, excludeSelf: true, onlyPokemon: true },
    text: "La force de tous les autres Pokémon augmente de 1.",
    image: img('dracaufeu.png'),
  },
  {
    id: 'stari',
    name: 'Stari',
    englishName: 'Staryu',
    deck: 'fate',
    type: 'hero',
    isPokemon: true,
    strength: 3,
    copies: 1,
    // TODO phase 2/3 : déplacer un Allié de la Team Rocket sur un lieu voisin (à la pose).
    text: "Vous pouvez déplacer un Allié sur un lieu voisin.",
    image: img('stari.png'),
  },
  {
    id: 'togepi',
    name: 'Togepi',
    englishName: 'Togepi',
    deck: 'fate',
    type: 'hero',
    isPokemon: true,
    strength: 1,
    copies: 1,
    onPlace: [{ type: 'LOSE_POWER_PER_HERO_IN_REALM', amount: 1 }],
    text: "Retirez 1 Jeton Pouvoir par Héros présent dans votre royaume.",
    image: img('togepi.png'),
  },
  {
    id: 'goupix',
    name: 'Goupix',
    englishName: 'Vulpix',
    deck: 'fate',
    type: 'hero',
    isPokemon: true,
    strength: 2,
    copies: 1,
    strengthMod: { target: 'heroes-here', delta: 1 },
    text: "La force de tous les Héros de ce lieu augmente de 1.",
    image: img('goupix.png'),
  },
  {
    id: 'onix',
    name: 'Onix',
    englishName: 'Onix',
    deck: 'fate',
    type: 'hero',
    isPokemon: true,
    strength: 4,
    copies: 1,
    // TODO phase 2/3 : défausser un Allié ou un Objet de la Team Rocket (à la pose).
    text: "Défaussez un Allié ou un Objet de votre choix.",
    image: img('onix.png'),
  },

  // --- Objets / Événements Fatalité -----------------------------------------
  {
    id: 'badge',
    name: 'Badge',
    englishName: 'Badge',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    attachStrengthBonus: 2,
    copies: 2,
    text: "Associez cet Objet à un Héros ou un Pokémon, sa force augmente de 2.",
    image: img('badge.png'),
  },
  {
    id: 'on-abandonne-pas',
    name: "On n'abandonne pas ses amis",
    englishName: "We Don't Abandon Our Friends",
    deck: 'fate',
    type: 'effect',
    copies: 2,
    // TODO phase 2 : reprend un Pokémon de force ≤3 de la pile de Captures et le remet sur la pioche Fatalité.
    text: "Choisissez un Pokémon de force 3 ou moins dans la pile de Captures et remettez-le sur le dessus de la pioche (ne fonctionne qu'une seule fois sur un Pokémon).",
    image: img('on-abandonne-pas.png'),
  },
  {
    id: 'degonflage',
    name: 'Dégonflage',
    englishName: 'Deflation',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    // TODO phase 3 : défausser un Objet de la Team Rocket.
    text: "Défaussez un Objet de votre choix.",
    image: img('degonflage.png'),
  },
]
