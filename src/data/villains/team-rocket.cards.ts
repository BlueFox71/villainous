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
    evolvesToCardId: 'arbok',
    text: "Les Héros qui se trouvent sur le même lieu qu'Abo ont une force diminuée de 1. (peut s'évoluer en Arbok)",
    image: img('abo.webp'),
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
    image: img('arbok.webp'),
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
    evolvesToCardId: 'smogogo',
    // Réutilise la fenêtre d'action distante de « Brutes » (Ratigan).
    effects: [{ type: 'ALLY_REMOTE_ACTION' }],
    text: "Si vous jouez Smogo sur un lieu où vous ne vous trouvez pas, vous pouvez effectuer une action disponible de ce lieu, en dehors d'une action Fatalité. (peut s'évoluer en Smogogo)",
    image: img('smogo.webp'),
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
    // Comme Smogo, mais « recouverte ou non » → includeCovered (ignore la couverture).
    effects: [{ type: 'ALLY_REMOTE_ACTION', includeCovered: true }],
    text: "Si vous jouez Smogogo sur un lieu où vous ne vous trouvez pas, vous pouvez effectuer 1 action, recouverte ou non, de ce lieu, en dehors d'une action Fatalité.",
    image: img('smogogo.webp'),
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
    evolvesToCardId: 'persian',
    text: "Lors d'une action Éliminer un Héros, Miaouss peut être utilisé pour éliminer un Héros sur son lieu ou sur un lieu voisin. (peut s'évoluer en Persian)",
    image: img('miaouss.webp'),
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
    reachesAnyLocationVanquish: true,
    text: "Lors d'une action Éliminer un Héros, Persian peut être utilisé pour éliminer un Héros sur n'importe quel lieu.",
    image: img('persian.webp'),
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
    // Défausse Fatalité (Dégonflage) : après la Mongolfière (cf. fateRemovalPriority).
    fateRemovalPriority: 3,
    copies: 2,
    text: "Associez cette carte à un Allié, sa force augmente de 1. Si cet Allié doit être défaussé, défaussez cet Objet à la place.",
    image: img('pokeball.webp'),
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
    image: img('griffure.webp'),
  },
  {
    id: 'rose-de-james',
    name: 'rose de James',
    englishName: "James's Rose",
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'ally',
    // Défausse Fatalité (Dégonflage) : en dernier parmi les Objets TR (cf. fateRemovalPriority).
    fateRemovalPriority: 1,
    copies: 2,
    // Déclenche l'action Attraper si l'Allié hôte a éliminé un Héros (géré dans applyVanquish) ;
    // la rose est défaussée avec l'Allié dépensé.
    text: "Associez cet Objet à un Allié. Si cet Allié a été utilisé pour éliminer un Héros, vous pouvez effectuer l'action « Attraper un Pokémon ». Défaussez cette carte ensuite.",
    image: img('rose-de-james.webp'),
  },
  {
    id: 'pokedex-vole',
    name: 'Pokédex volé',
    englishName: 'Stolen Pokédex',
    deck: 'villain',
    type: 'item',
    cost: 2,
    // Défausse Fatalité (Dégonflage) : après la Pokéball (cf. fateRemovalPriority).
    fateRemovalPriority: 2,
    copies: 1,
    // Sursis : tant que le Pokédex est dans le royaume, un Pokémon couché survit UN tour de
    // plus avant d'aller en défausse Fatalité (seuil d'expiration 3 au lieu de 2 ; cf. sweepKoPokemon).
    text: "Allonge d'un tour votre délai pour attraper un Pokémon couché (avant qu'il ne file).",
    image: img('pokedex-vole.webp'),
  },
  {
    id: 'mongolfiere',
    name: 'Mongolfière',
    englishName: 'Meowth Balloon',
    deck: 'villain',
    type: 'item',
    cost: 3,
    ridesWithPawn: true,
    // Défausse Fatalité (Dégonflage / Onix) : cible n°1 (tempo). Tier HAUT (≥5) → retirée
    // AVANT les Alliés dans Onix (cf. fateRemovalPriority, DISCARD_ALLY_OR_ITEM).
    fateRemovalPriority: 10,
    copies: 1,
    text: "Lorsque vous êtes sur le même lieu que la Mongolfière, vous pouvez, une fois par tour, déplacer votre figurine et la Mongolfière vers n'importe quel lieu et y effectuer une action disponible, en dehors d'une action Fatalité.",
    image: img('mongolfiere.webp'),
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
    image: img('jessie.webp'),
  },
  {
    id: 'james',
    name: 'James !',
    englishName: 'James!',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'REVEAL_VILLAIN_UNTIL_TYPE', cardType: 'item', keepOthersOnTop: true }],
    text: "Dévoilez les cartes de votre pioche jusqu'à ce que vous trouviez un Objet. Jouez-le et remettez les autres cartes sur le dessus de votre pioche.",
    image: img('james.webp'),
  },
  {
    id: 'reperage',
    name: 'Repérage',
    englishName: 'Scouting',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 3,
    effects: [{ type: 'REVEAL_OWN_FATE_PLAY_HERO' }],
    text: "Dévoilez les cartes Fatalité jusqu'à ce que vous trouviez un Héros. Jouez-le et défaussez les autres cartes dévoilées.",
    image: img('reperage.webp'),
  },
  {
    id: 'evolution',
    name: 'Évolution',
    englishName: 'Evolution',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    // Injouable sans Allié au royaume (rien à faire évoluer).
    requiresAllyInRealm: true,
    // Fait évoluer un Allié (Abo→Arbok, Smogo→Smogogo, Miaouss→Persian) : choix interactif.
    effects: [{ type: 'EVOLVE_ALLY' }],
    text: "Choisissez un Allié dans votre royaume. S'il peut s'évoluer et que son évolution n'est pas déjà dans votre royaume, défaussez-le, cherchez l'Allié indiqué et jouez-le sur le même lieu.",
    image: img('evolution.webp'),
  },
  {
    id: 'toilettage',
    name: 'Toilettage',
    englishName: 'Grooming',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'SCRY_OWN_FATE_TOP2' }],
    text: "Regardez secrètement les deux premières cartes Fatalité de votre pioche. Défaussez-les ou remettez-les sur le dessus de la pioche dans n'importe quel ordre.",
    image: img('toilettage.webp'),
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
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 3 },
    // « Éliminer un Héros ≥3 » = chez Team Rocket, COUCHER un Pokémon ≥3 (gratuit) → attrapable.
    effects: [{ type: 'KO_POKEMON_GE', minStrength: 3 }],
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il élimine un Héros de force 3 ou plus. Éliminez un Héros de force 3 ou plus.",
    image: img('oui-la-guerre.webp'),
  },
  {
    id: 'mauvais-tour',
    name: 'Pour vous jouer un mauvais tour',
    englishName: 'To Play a Bad Trick',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    trigger: { type: 'opponent-played-fate-hero-le', value: 3 },
    // Effet géré par cardId dans resolveConditionEffect (réutilise la logique Tromperie/Illusion).
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il vous joue un Héros de force 3 ou moins. Dévoilez la première carte Fatalité de sa pioche et jouez-la immédiatement.",
    image: img('mauvais-tour.webp'),
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
    image: img('oh-des-pokemons.webp'),
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
    image: img('sacha.webp'),
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
    image: img('ondine.webp'),
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
    image: img('pierre.webp'),
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
    playWhenRevealed: true,
    text: "Vous devez immédiatement jouer Pikachu dès qu'il est dévoilé. Défaussez les autres cartes Fatalité qui ont été dévoilées.",
    image: img('pikachu.webp'),
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
    image: img('dracaufeu.webp'),
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
    onPlace: [{ type: 'MOVE_OWN_ALLY_ADJACENT' }],
    text: "Vous pouvez déplacer un Allié sur un lieu voisin.",
    image: img('stari.webp'),
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
    image: img('togepi.webp'),
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
    image: img('goupix.webp'),
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
    onPlace: [{ type: 'DISCARD_ALLY_OR_ITEM' }],
    text: "Défaussez un Allié ou un Objet de votre choix.",
    image: img('onix.webp'),
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
    image: img('badge.webp'),
  },
  {
    id: 'on-abandonne-pas',
    name: "On n'abandonne pas ses amis",
    englishName: "We Don't Abandon Our Friends",
    deck: 'fate',
    type: 'effect',
    copies: 2,
    effects: [{ type: 'UNCAPTURE_POKEMON_LE', maxStrength: 3 }],
    text: "Choisissez un Pokémon de force 3 ou moins dans la pile de Captures et remettez-le sur le dessus de la pioche (ne fonctionne qu'une seule fois sur un Pokémon).",
    image: img('on-abandonne-pas.webp'),
  },
  {
    id: 'degonflage',
    name: 'Dégonflage',
    englishName: 'Deflation',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    effects: [{ type: 'DISCARD_ONE_ITEM' }],
    text: "Défaussez un Objet de votre choix.",
    image: img('degonflage.webp'),
  },
]
