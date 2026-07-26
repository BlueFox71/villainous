// =============================================================================
// Ratigan — cartes (deck Méchant de 30 + deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Ratigan/ (texte recopié fidèlement) +
// wiki Villainous FR. Le TEXTE est la source de vérité.
// STATUT : toutes les cartes sont implémentées (coûts via Engrenages/Outils/
// Flaversham, activations Cloche/Dirigeable/Piège ingénieux/Habits royaux, objectif
// double Reine Robot / Le Rat, réactions Sournois/Extravagance). Aucune « texte seul ».
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/ratigan/${f}`

export const ratiganCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés
  // ----------------------------------------------------------------------
  {
    id: 'brutes',
    name: 'Brutes',
    englishName: 'Thugs',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 3,
    text: 'Si vous jouez les Brutes sur un lieu où vous ne vous trouvez pas, vous pouvez effectuer 1 action disponible de ce lieu, en dehors d’une action Fatalité.',
    image: img('brutes.webp'),
    effects: [{ type: 'ALLY_REMOTE_ACTION' }],
    journal: 'Les Brutes rejoignent le royaume — et prêtent leur lieu, le temps d’une action.',
  },
  {
    id: 'bartholomee',
    name: 'Bartholomée',
    englishName: 'Bartholomew',
    deck: 'villain',
    type: 'ally',
    cost: 0,
    strength: 1,
    copies: 1,
    text: 'Aucune capacité.',
    image: img('bartholomee.webp'),
    journal: 'Bartholomée rejoint le royaume.',
  },
  {
    id: 'felicia',
    name: 'Félicia',
    englishName: 'Felicia',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 6,
    copies: 1,
    text: 'Lorsque vous jouez Félicia, défaussez un Allié de son lieu ou payez 2 jetons Pouvoir supplémentaires.',
    image: img('felicia.webp'),
    effects: [{ type: 'DISCARD_ALLY_AT_HOST_OR_PAY', power: 2 }],
    journal:
      'Félicia rejoint le royaume et croque {nomAllié}.\n' +
      'Félicia rejoint le royaume, 2 JT de plus payés.',
  },
  {
    id: 'fidget',
    name: 'Fidget',
    englishName: 'Fidget',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 3,
    copies: 1,
    text: 'Trouvez Flaversham et jouez-le sur le Magasin de jouets de Flaversham.',
    image: img('fidget.webp'),
    effects: [{ type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'flaversham', locationId: 'magasin-flaversham' }],
    journal: 'Fidget rejoint le royaume et traîne Flaversham jusqu’à son magasin.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements
  // ----------------------------------------------------------------------
  {
    id: 'capture',
    name: 'Capture',
    englishName: 'Capture',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Déplacez un Héros de force 3 ou moins sur le Repaire secret.',
    image: img('capture.webp'),
    effects: [{ type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }],
    journal:
      'Capture : {nomHéros} est emmené au Repaire secret.\n' +
      'Capture : le Repaire secret attend son prisonnier.',
  },
  {
    id: 'grand-genie-du-mal',
    name: 'Le Grand Génie du Mal',
    englishName: "The World's Greatest Criminal Mind",
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Piochez 2 cartes ou gagnez 2 jetons Pouvoir.',
    image: img('grand-genie-du-mal.webp'),
    effects: [{ type: 'DRAW_OR_GAIN_POWER', draw: 2, power: 2 }],
    journal: 'Le Grand Génie du Mal : deux cartes piochées, ou 2 JT empochés.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'extravagance',
    name: 'Extravagance',
    englishName: 'Extravagance',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il gagne au moins 3 jetons Pouvoir. Ajoutez un Objet de votre défausse à votre main.',
    image: img('extravagance.webp'),
    trigger: { type: 'opponent-gained-power-ge', value: 3 },
    effects: [{ type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['item'], label: 'Extravagance' }],
    journal:
      'Extravagance : retour en main de {nomCarte}.\n' +
      'Extravagance : un Objet revient de la défausse en main.',
  },
  {
    id: 'sournois',
    name: 'Sournois',
    englishName: 'Sneaky',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il cible avec une action Fatalité. Il ne dévoile qu’une carte Fatalité au lieu de deux.',
    image: img('sournois.webp'),
    trigger: { type: 'opponent-fate-targeted-me' },
    journal: 'Sournois : l’adversaire ne dévoilera qu’une seule carte Fatalité.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets
  // ----------------------------------------------------------------------
  {
    id: 'engrenages',
    name: 'Engrenages',
    englishName: 'Gears',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 5,
    text: 'Vous pouvez défausser Engrenages pour réduire le coût d’un Objet de 3.',
    image: img('engrenages.webp'),
    journal: 'Engrenages : posés sur {nomLieu}, ils allégeront le coût d’un Objet de 3 JT.',
  },
  {
    id: 'piege-ingenieux',
    name: 'Piège ingénieux',
    englishName: 'Ingenious Trap',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 2,
    text: 'Activer : payez 1 jeton Pouvoir. Au prochain tour, avant de déplacer votre figurine, éliminez tous les Héros sur ce lieu, puis défaussez cette carte.',
    image: img('piege-ingenieux.webp'),
    activatedCost: 1,
    journal: 'Piège ingénieux : armé sur {nomLieu}, il éliminera tous les Héros présents au prochain tour.',
  },
  {
    id: 'uniforme',
    name: 'Uniforme',
    englishName: 'Uniform',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 2,
    attach: 'ally',
    attachStrengthBonus: 2,
    text: 'Associez cette carte à un Allié, sa force augmente de 2. Puis vous pouvez effectuer une action Éliminer un Héros ; cet Allié doit y participer.',
    image: img('uniforme.webp'),
    journal: 'Uniforme : +2 Force pour {nomAllié}, prêt à en finir tout de suite.',
  },
  {
    id: 'cloche',
    name: 'Cloche',
    englishName: 'Bell',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Activer : cherchez Félicia dans votre pioche ou votre défausse et ajoutez-la à votre main. Puis remélangez votre pioche.',
    image: img('cloche.webp'),
    activatedCost: 0,
    journal: 'Cloche : posée sur {nomLieu}, elle appellera Félicia.',
  },
  {
    id: 'dirigeable',
    name: 'Dirigeable',
    englishName: 'Dirigible',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Activer : payez 1 jeton Pouvoir. Déplacez le Dirigeable et 1 Objet ou 1 Allié non associé qui se trouve sur le même lieu vers n’importe quel lieu.',
    image: img('dirigeable.webp'),
    activatedCost: 1,
    journal: 'Dirigeable : amarré sur {nomLieu}, il emmènera un Objet ou un Allié n’importe où.',
  },
  {
    id: 'habits-royaux',
    name: 'Habits royaux',
    englishName: 'Royal Robes',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'Activer : gagnez 2 jetons Pouvoir.',
    image: img('habits-royaux.webp'),
    activatedCost: 0,
    journal: 'Habits royaux : taillés sur {nomLieu}, ils rapporteront 2 JT.',
  },
  {
    id: 'liste-de-fidget',
    name: 'Liste de Fidget',
    englishName: "Fidget's List",
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Dévoilez les cartes de votre pioche jusqu’à ce que vous trouviez un Objet. Ajoutez-le à votre main et défaussez les autres cartes dévoilées.',
    image: img('liste-de-fidget.webp'),
    effects: [{ type: 'REVEAL_DECK_UNTIL_TYPE', cardType: 'item', title: 'Liste de Fidget' }],
    journal: 'Liste de Fidget : la pioche est dévoilée jusqu’à un Objet, gardé en main.',
  },
  {
    id: 'outils',
    name: 'Outils',
    englishName: 'Tools',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: 'Jouer un Objet coûte 1 jeton Pouvoir de moins.',
    image: img('outils.webp'),
    journal: 'Outils : posés sur {nomLieu}, ils font baisser le coût des Objets de 1 JT.',
  },
  {
    id: 'reine-robot',
    name: 'Reine Robot',
    englishName: 'Robot Queen',
    deck: 'villain',
    type: 'item',
    cost: 15,
    copies: 1,
    playOnlyAt: 'repaire-secret',
    text: 'Jouez la Reine Robot sur le Repaire secret. Si cette carte est défaussée, retournez votre tuile Objectif sur la face Le Rat.',
    image: img('reine-robot.webp'),
    journal: 'Reine Robot : la machine est assemblée au Repaire secret.',
  },

  // ======================================================================
  // DECK FATALITÉ — Héros
  // ======================================================================
  {
    id: 'gardes-de-la-reine',
    name: 'Gardes de la Reine',
    englishName: "Queen's Guards",
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 3,
    forcedFateLocation: 'buckingham-palace',
    text: 'Les Gardes de la Reine ne peuvent être joués que sur Buckingham Palace.',
    image: img('gardes-de-la-reine.webp'),
    journal: 'Les Gardes de la Reine apparaissent à Buckingham Palace.',
  },
  {
    id: 'basil',
    name: 'Basil',
    englishName: 'Basil',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Vous pouvez défausser un Objet qui se trouve sur le lieu où Basil est joué ou déplacé.',
    image: img('basil.webp'),
    onPlace: [{ type: 'DISCARD_ITEM_AT_HOST', preferCardId: 'reine-robot' }],
    journal:
      'Basil apparaît : le royaume perd {nomObjet}.\n' +
      'Basil apparaît : aucun Objet à saisir sur son lieu.',
  },
  {
    id: 'dr-dawson',
    name: 'Dr. Dawson',
    englishName: 'Dr. Dawson',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Basil se trouve dans le royaume, la force de Dr. Dawson augmente de 2.',
    image: img('dr-dawson.webp'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'basil', scope: 'realm', delta: 2 }],
    journal: 'Le Dr. Dawson apparaît : +2 Force tant que Basil est dans le royaume.',
  },
  {
    id: 'flaversham',
    name: 'Flaversham',
    englishName: 'Hiram Flaversham',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Flaversham se trouve sur le Repaire secret, jouer la Reine Robot coûte 3 jetons Pouvoir de moins.',
    image: img('flaversham.webp'),
    journal: 'Flaversham apparaît : au Repaire secret, il fait baisser le coût de la Reine Robot de 3 JT.',
  },
  {
    id: 'mrs-judson',
    name: 'Mrs. Judson',
    englishName: 'Mrs. Judson',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Ratigan perd jusqu’à 2 jetons Pouvoir.',
    image: img('mrs-judson.webp'),
    onPlace: [{ type: 'LOSE_POWER', amount: 2 }],
    journal: 'Mrs. Judson apparaît : jusqu’à 2 JT s’envolent.',
  },
  {
    id: 'olivia',
    name: 'Olivia',
    englishName: 'Olivia Flaversham',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Si Olivia est éliminée, un adversaire, au choix, dévoile et joue la première carte Fatalité de la pioche de Ratigan.',
    image: img('olivia.webp'),
    onVanquish: [{ type: 'REVEAL_FATE_TOP_PLAY_IF_HERO' }],
    journal: 'Olivia apparaît : l’éliminer fera jouer la carte Fatalité suivante.',
  },
  {
    id: 'reine-moustoria',
    name: 'Reine Moustoria',
    englishName: 'Queen Mousetoria',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Ratigan ne peut pas gagner si la Reine Moustoria est à Buckingham Palace, même si son objectif est d’éliminer Basil.',
    image: img('reine-moustoria.webp'),
    journal: 'La Reine Moustoria apparaît : tant qu’elle tient Buckingham Palace, aucune victoire possible.',
  },
  {
    id: 'toby-ratigan',
    name: 'Toby',
    englishName: 'Toby',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text: 'Vous pouvez déplacer un Héros vers le lieu de votre choix.',
    image: img('toby.webp'),
    onPlace: [{ type: 'RELOCATE_REALM_HERO_ANYWHERE' }],
    journal:
      'Toby apparaît : il emmène {nomHéros} jusqu’à {nomLieu}.\n' +
      'Toby apparaît.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'appel-a-l-aide',
    name: 'Appel à l’aide',
    englishName: 'Call for Help',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Cherchez Basil et jouez-le sur le lieu de votre choix. Si Basil est déjà dans le royaume, déplacez-le vers n’importe quel lieu.',
    image: img('appel-a-l-aide.webp'),
    journal: 'Appel à l’aide : Basil accourt, ou change de lieu s’il est déjà là.',
  },
  {
    id: 'sabotage',
    name: 'Sabotage',
    englishName: 'Sabotage',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Choisissez un lieu où se trouve au moins un Héros et défaussez-y un Objet coûtant 3 ou moins.',
    image: img('sabotage.webp'),
    journal:
      'Sabotage : le royaume perd {nomObjet}.\n' +
      'Sabotage : aucun Objet à saboter.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objet
  // ----------------------------------------------------------------------
  {
    id: 'ballon-de-fortune',
    name: 'Ballon de fortune',
    englishName: 'Makeshift Balloon',
    deck: 'fate',
    type: 'item',
    copies: 1,
    attach: 'hero',
    attachStrengthBonus: 2,
    text: 'Associez cette carte à un Héros, sa force augmente de 2 et vous pouvez immédiatement le déplacer vers un lieu de votre choix.',
    image: img('ballon-de-fortune.webp'),
    journal: 'Ballon de fortune : +2 Force pour {nomHéros}, aussitôt emporté ailleurs.',
  },
]
