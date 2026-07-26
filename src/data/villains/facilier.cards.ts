// =============================================================================
// Dr Facilier — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Facilier/ (texte = source de vérité)
// + wiki Villainous FR (composition des decks, forces des Héros Fatalité).
//
// MÉCANIQUE CENTRALE — la PILE DE L'AU-DELÀ (PlayerState.auDela). Amis de l'au-delà
// et Régner y vont quand on les joue (`goesToAuDelaOnPlay`). Les adversaires y
// ajoutent des cartes via la Fatalité (L'étoile du soir, Si près du but, Charlotte,
// Joujou). Divination mélange la pile, révèle 3 cartes (2 avec Mama Odie) et résout
// leurs effets `auDela` dans l'ordre choisi par Facilier (pendingDivination).
//
// PÉRIMÈTRE. Implémentés :
//  - Objectif : révéler « Régner sur la Nouvelle-Orléans » via Divination en
//    détenant le Talisman (victoire événementielle, dans RESOLVE_DIVINATION).
//  - Talisman : s'associe automatiquement à un Héros de force ≤3 joué dans le
//    royaume ; revient librement sur le lieu si ce Héros est éliminé. « Détenir le
//    Talisman » = Talisman libre (non associé) dans le royaume.
//  - Effets Au-delà : Amis (gagne 2 + défausse), Régner (victoire/retour), Esprits
//    des ombres (défausse + −2 JT), Ombre (posée au Royaume du vaudou), Tour de
//    passe-passe (regarde 3, garde 1), Esprits des masques (défausse les masques,
//    remet les autres dans la pile et interrompt).
//  - Divination (interactif côté humain via pendingDivination ; auto côté bot).
//  - Forme de grenouille (−2 force au Héros associé), Tiana (+1 au coût de toutes
//    les cartes de Facilier), Mama Odie (Divination ne révèle plus que 2 cartes).
//  - Désespoir / Terreur (Conditions) ; Poudre d'illusion (vide la pile à un
//    Vanquish) ; Lawrence (suit les Héros joués) ; Ombre (suit le pion) ; Louis
//    (Facilier dévoile une carte vers la pile en arrivant sur son lieu).
//  - Poupées vaudou : à leur déplacement, déplacent un Héros au choix du même
//    nombre de lieux dans la même direction (interactif ; facultatif).
//  - Tour de passe-passe : choix interactif de la carte gardée (humain).
//  - Canne : tant que le pion est sur son lieu, effectue UNE action disponible
//    d'un lieu voisin (hors Fatalité), une fois par tour.
//  - Fatalité : L'étoile du soir / Si près du but / Charlotte / Joujou / Big Daddy
//    (alimentent ou vident la pile), Eudora (rejoue une Fatalité à sa mort),
//    Naveen (déplace les Héros), Ray (si révélé, on peut jouer aussi l'autre
//    carte révélée si elle est jouable).
// INTERACTIF côté adversaire :
//  - Si près du but / Charlotte : le joueur qui pose la Fatalité regarde les 3 (ou
//    2) premières cartes de la pioche de Facilier, en place autant qu'il veut
//    (parmi celles autorisées) dans la Pile de l'Au-delà et remet les autres sur le
//    dessus dans l'ordre choisi (pendingFateScry ; auto pour le bot).
// SIMPLIFICATIONS (auto — documentées) :
//  - Les autres choix côté ADVERSAIRE (L'étoile du soir : quel Allié ; Joujou :
//    quel Objet ; Big Daddy : quelle carte sort de la pile) sont résolus
//    AUTOMATIQUEMENT par le moteur (heuristiques), comme les Fatalités d'Hadès.
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/facilier/${file}`

export const facilierCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements liés à la Pile de l'Au-delà
  // ----------------------------------------------------------------------
  {
    id: 'amis-au-dela',
    name: "Amis de l'au-delà",
    englishName: 'Friends on the Other Side',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: "Gagnez 2 jetons Pouvoir, puis placez cette carte dans la Pile de l'Au-delà.\n\nAu-delà : Gagnez 2 jetons Pouvoir, puis défaussez cette carte.",
    effects: [{ type: 'GAIN_POWER', amount: 2 }],
    goesToAuDelaOnPlay: true,
    auDela: { kind: 'gain-power-discard', amount: 2 },
    image: img('amis-au-dela.webp'),
    journal: 'Amis de l’au-delà : gagne {NbJT} JT, puis la carte glisse dans la Pile de l’Au-delà.',
  },
  {
    id: 'divination-facilier',
    name: 'Divination',
    englishName: 'Reading the Cards',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: "Si vous êtes au Royaume du vaudou : mélangez la Pile de l'Au-delà, désignez un adversaire qui en dévoile trois cartes, puis résolvez leurs effets Au-delà dans l'ordre de votre choix.\n\nNe peut pas être placée dans la Pile de l'Au-delà.",
    effects: [{ type: 'DIVINATION', count: 3 }],
    image: img('divination.webp'),
    journal: 'Divination : la Pile de l’Au-delà est mélangée, et ses cartes rendent leur verdict.',
  },
  {
    id: 'regner-nouvelle-orleans',
    name: 'Régner sur la Nouvelle-Orléans',
    englishName: 'Take Over the City',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 1,
    text: "Placez cette carte dans la Pile de l'Au-delà.\n\nAu-delà : Si vous détenez le Talisman, vous gagnez la partie. Sinon, remettez cette carte dans la Pile de l'Au-delà.",
    goesToAuDelaOnPlay: true,
    auDela: { kind: 'win-if-talisman' },
    image: img('regner-nouvelle-orleans.webp'),
    journal: 'Régner sur la Nouvelle-Orléans : la carte rejoint la Pile de l’Au-delà — reste à détenir le Talisman.',
  },
  {
    id: 'tour-passe-passe',
    name: 'Tour de passe-passe',
    englishName: 'Sleight of Hand',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: "Regardez les trois premières cartes de votre pioche. Ajoutez-en une à votre main et défaussez les autres.\n\nAu-delà : Même effet, puis défaussez cette carte.",
    effects: [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 3, take: 1 }],
    auDela: { kind: 'scry-draw-discard', look: 3, take: 1 },
    image: img('tour-passe-passe.webp'),
    journal: 'Tour de passe-passe : trois cartes de la pioche sont vues, une seule est gardée.',
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés
  // ----------------------------------------------------------------------
  {
    id: 'esprits-masques',
    name: 'Esprits des masques',
    englishName: 'Mask Spirits',
    deck: 'villain',
    // Allié + Objet sur la carte ; traité comme Allié (force 2) par le moteur.
    type: 'ally',
    // Allié + Objet : ciblable par les effets « Objet » (Joujou).
    alsoItem: true,
    cost: 0,
    strength: 2,
    copies: 3,
    text: "Aucune capacité.\n\nAu-delà : Défaussez toutes les cartes Esprits des masques dévoilées et remettez les éventuelles autres cartes dans la Pile de l'Au-delà, sans leur appliquer leur effet.",
    auDela: { kind: 'masks-abort' },
    image: img('esprits-masques.webp'),
    journal: 'Les Esprits des masques rejoignent le royaume.',
  },
  {
    id: 'esprits-ombres',
    name: 'Esprits des ombres',
    englishName: 'Shadow Spirits',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 3,
    text: 'Aucune capacité.\n\nAu-delà : Défaussez cette carte ainsi que 2 jetons Pouvoir.',
    auDela: { kind: 'lose-power-discard', amount: 2 },
    image: img('esprits-ombres.webp'),
    journal: 'Les Esprits des ombres rejoignent le royaume.',
  },
  {
    id: 'poupees-vaudou',
    name: 'Poupées vaudou',
    englishName: 'Voodoo Dolls',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 3,
    text: 'Lorsque les Poupées vaudou sont déplacées, vous pouvez déplacer un Héros du même nombre de lieux et dans la même direction.',
    image: img('poupees-vaudou.webp'),
    journal: 'Les Poupées vaudou rejoignent le royaume.',
  },
  {
    id: 'lawrence',
    name: 'Lawrence',
    englishName: 'Lawrence',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    text: "À chaque fois qu'un Héros est joué, vous pouvez déplacer Lawrence sur le même lieu.",
    image: img('lawrence.webp'),
    journal: 'Lawrence rejoint le royaume.',
  },
  {
    id: 'ombre-facilier',
    name: 'Ombre du Dr Facilier',
    englishName: "Dr. Facilier's Shadow",
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    copies: 1,
    text: "Si vous vous trouvez sur le même lieu que votre Ombre avant de vous déplacer, vous pouvez la déplacer en même temps que vous.\n\nAu-delà : Placez l'Ombre du Dr Facilier sur le Royaume du vaudou.",
    auDela: { kind: 'place-on-location', locationId: 'royaume-vaudou' },
    image: img('ombre-facilier.webp'),
    journal: 'L’Ombre du Dr Facilier rejoint le royaume.',
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets
  // ----------------------------------------------------------------------
  {
    id: 'talisman',
    name: 'Talisman',
    englishName: 'Talisman',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: "À chaque fois qu'un Héros de force 3 ou moins est joué, associez-lui cette carte. S'il est éliminé, récupérez le Talisman dans la partie inférieure du plateau, sur ce lieu.\n\nNe peut pas être mis dans la Pile de l'Au-delà.",
    image: img('talisman.webp'),
    journal: 'Talisman : posé sur {nomLieu}, il s’accrochera au prochain Héros de Force 3 ou moins.',
  },
  {
    id: 'canne',
    name: 'Canne',
    englishName: 'Cane',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: "Lorsque vous vous trouvez sur le même lieu que votre Canne, vous pouvez effectuer une action disponible sur un lieu voisin, en dehors d'une action Fatalité.",
    image: img('canne.webp'),
    journal: 'Canne : posée sur {nomLieu}, elle ouvre les actions d’un lieu voisin.',
  },
  {
    id: 'forme-grenouille',
    name: 'Forme de grenouille',
    englishName: 'Frog Form',
    deck: 'villain',
    type: 'item',
    cost: 0,
    // Objet associé à un Héros : −2 à sa force (réutilise attachStrengthBonus).
    attach: 'hero',
    attachStrengthBonus: -2,
    copies: 2,
    text: 'Associez cette carte à un Héros. Sa force est réduite de 2.',
    image: img('forme-grenouille.webp'),
    journal: 'Forme de grenouille : −2 Force pour {nomHéros}.',
  },
  {
    id: 'poudre-illusion',
    name: "Poudre d'illusion",
    englishName: 'Illusion Powder',
    deck: 'villain',
    type: 'item',
    cost: 2,
    copies: 1,
    text: "À chaque fois que vous éliminez un Héros sur ce lieu, vous pouvez choisir une ou deux cartes de votre Pile de l'Au-delà et les défausser.",
    image: img('poudre-illusion.webp'),
    journal: 'Poudre d’illusion : posée sur {nomLieu}, chaque Héros éliminé y videra la Pile de l’Au-delà.',
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'desespoir',
    name: 'Désespoir',
    englishName: 'Despair',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il défausse au moins deux cartes. Choisissez une carte dans la Pile de l'Au-delà et ajoutez-la à votre main.",
    trigger: { type: 'opponent-discarded-ge', value: 2 },
    effects: [{ type: 'TAKE_FROM_AUDELA_TO_HAND' }],
    image: img('desespoir.webp'),
    journal:
      'Désespoir : retour en main de {nomCarte}, tirée de la Pile de l’Au-delà.\n' +
      'Désespoir : une carte de la Pile de l’Au-delà revient en main.',
  },
  {
    id: 'terreur',
    name: 'Terreur',
    englishName: 'Terror',
    deck: 'villain',
    type: 'condition',
    copies: 2,
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il gagne au moins 3 jetons Pouvoir. Choisissez un Allié ou un Événement sur votre défausse et ajoutez-le à votre main.",
    trigger: { type: 'opponent-gained-power-ge', value: 3 },
    effects: [{ type: 'RECOVER_TYPE_FROM_DISCARD', types: ['ally', 'effect'], label: 'Terreur' }],
    image: img('terreur.webp'),
    journal:
      'Terreur : retour en main de {nomCarte}.\n' +
      'Terreur : un Allié ou un Événement revient en main.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'etoile-du-soir',
    name: "L'étoile du soir",
    englishName: 'Evening Star',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: "Choisissez un Allié dans le royaume et placez-le dans la Pile de l'Au-delà.",
    effects: [{ type: 'FATE_ALLY_TO_AUDELA' }],
    image: img('etoile-du-soir.webp'),
    journal: 'L’étoile du soir : un Allié du royaume disparaît dans la Pile de l’Au-delà.',
  },
  {
    id: 'si-pres-du-but',
    name: 'Si près du but',
    englishName: 'So Close',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: "Regardez secrètement les trois premières cartes Méchant de la pioche. Placez-en autant que vous voulez dans la Pile de l'Au-delà et replacez les autres sur la pioche dans l'ordre de votre choix.",
    effects: [{ type: 'FATE_TOP_DECK_TO_AUDELA', count: 3 }],
    image: img('si-pres-du-but.webp'),
    journal: 'Si près du but : les trois premières cartes Méchant sont fouillées, et certaines versées dans la Pile de l’Au-delà.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros
  // ----------------------------------------------------------------------
  {
    id: 'big-daddy',
    name: 'Big Daddy Le Bœuf',
    englishName: 'Big Daddy La Bouff',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: "Vous pouvez choisir une carte de la Pile de l'Au-delà et la placer sur le dessus de la pioche de cartes Méchant du Dr Facilier.",
    onPlace: [{ type: 'FATE_AUDELA_TO_DECK_TOP' }],
    image: img('big-daddy.webp'),
    journal: 'Big Daddy Le Bœuf apparaît : une carte de la Pile de l’Au-delà remonte sur la pioche Méchant.',
  },
  {
    id: 'charlotte',
    name: 'Charlotte',
    englishName: 'Charlotte',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Regardez secrètement les deux premières cartes Méchant de la pioche. Placez-en autant que vous voulez dans la Pile de l'Au-delà et replacez les autres sur la pioche dans l'ordre de votre choix.",
    onPlace: [{ type: 'FATE_TOP_DECK_TO_AUDELA', count: 2 }],
    image: img('charlotte.webp'),
    journal: 'Charlotte apparaît : les deux premières cartes Méchant sont fouillées, et certaines versées dans la Pile de l’Au-delà.',
  },
  {
    id: 'eudora',
    name: 'Eudora',
    englishName: 'Eudora',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Eudora est éliminée, un adversaire, au choix, dévoile et joue la première carte Fatalité de la pioche du Dr Facilier.',
    onVanquish: [{ type: 'REVEAL_FATE_TOP_PLAY_IF_HERO' }],
    image: img('eudora.webp'),
    journal: 'Eudora apparaît : l’éliminer fera jouer la carte Fatalité suivante.',
  },
  {
    id: 'joujou',
    name: 'Joujou',
    englishName: 'Stella',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: "Vous pouvez choisir un Objet sur le lieu où se trouve Joujou et le placer dans la Pile de l'Au-delà.",
    onPlace: [{ type: 'FATE_ITEM_AT_HOST_TO_AUDELA' }],
    image: img('joujou.webp'),
    journal: 'Joujou apparaît : un Objet de son lieu disparaît dans la Pile de l’Au-delà.',
  },
  {
    id: 'louis',
    name: 'Louis',
    englishName: 'Louis',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: "Si le Dr Facilier se déplace sur le lieu où se trouve Louis, il doit dévoiler sa main à un adversaire. Celui-ci y choisit une carte et la place dans la Pile de l'Au-delà.",
    image: img('louis.webp'),
    journal: 'Louis apparaît : arriver sur son lieu fait verser une carte de la main dans la Pile de l’Au-delà.',
  },
  {
    id: 'mama-odie',
    name: 'Mama Odie',
    englishName: 'Mama Odie',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Le Dr Facilier ne dévoile plus que 2 cartes lors d\'une Divination.',
    image: img('mama-odie.webp'),
    journal: 'Mama Odie apparaît : la Divination ne dévoile plus que 2 cartes.',
  },
  {
    id: 'naveen',
    name: 'Naveen',
    englishName: 'Naveen',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Vous pouvez déplacer tous les Héros du royaume sur un lieu voisin.',
    onPlace: [{ type: 'FATE_MOVE_ALL_HEROES_ADJACENT' }],
    image: img('naveen.webp'),
    journal: 'Naveen apparaît : tous les Héros du royaume peuvent gagner un lieu voisin.',
  },
  {
    id: 'ray',
    name: 'Ray',
    englishName: 'Ray',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: "Si Ray fait partie des deux cartes dévoilées lors d'une action Fatalité, vous pouvez les jouer toutes les deux.",
    image: img('ray.webp'),
    fatePlayBoth: true,
    journal: 'Ray apparaît : dévoilé avec une autre carte, les deux peuvent être jouées.',
  },
  {
    id: 'tiana',
    name: 'Tiana',
    englishName: 'Tiana',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Toutes les cartes du Dr Facilier lui coûtent 1 jeton Pouvoir de plus.',
    image: img('tiana.webp'),
    journal: 'Tiana apparaît : toutes les cartes coûtent 1 JT de plus.',
  },
]
