// =============================================================================
// Oogie Boogie — cartes (deck Méchant : 30 ; deck Fatalité : 15).
//
// Noms / coûts / forces / textes / ILLUSTRATIONS tirés des planches du jeu réel
// (faces découpées depuis assets/decks/Oogie Boogie/). Le TEXTE français est la
// source de vérité.
//
// ÉTAT : vilain ENTIÈREMENT JOUABLE (humain + bot). La mécanique des DÉS (2d6) et
// l'objectif (4 imposteurs → retour de Jack → victoire en le vainquant) sont
// implémentés dans le moteur. Les cartes portent soit des `effects` (lancers de
// dés : ROLL_IMPOSTOR, ROLL_MAKING_CHRISTMAS…), soit des champs passifs
// (selfStrengthMods du trio, mustDefeatFirst des Citoyens, attach des Objets),
// soit un comportement câblé en hook moteur par cardId (Chauves-souris/Araignées
// dans performVanquish, Stram dans applyMove, Sally onPlace, Baignoire, Maire,
// Finkelstein, Diversion, Salut Oogie…). « Dés pipés » = type `effect` réactif.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/oogie-boogie/${f}`

export const oogieBoogieCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés (le Trio Am/Stram/Gram = Lock/Shock/Barrel)
  // ----------------------------------------------------------------------
  {
    id: 'gram',
    name: 'Gram',
    englishName: 'Barrel',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    selfStrengthMods: [{ kind: 'per-other-in-set-realm', cardIds: ['am', 'stram', 'gram'], delta: 1 }],
    text: "La force de Gram augmente de 1 pour chaque autre membre du trio dans votre royaume (Am ou Stram). Ajoutez 1 au résultat de vos lancers de dés lorsque votre figurine se trouve sur ce lieu.",
    image: img('gram.webp'),
  },
  {
    id: 'am',
    name: 'Am',
    englishName: 'Lock',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    selfStrengthMods: [{ kind: 'per-other-in-set-realm', cardIds: ['am', 'stram', 'gram'], delta: 1 }],
    text: "La force de Am augmente de 1 pour chaque autre membre du trio dans votre royaume (Stram ou Gram). Jouer des Alliés coûte 1 Jeton Pouvoir de moins.",
    image: img('am.webp'),
  },
  {
    id: 'stram',
    name: 'Stram',
    englishName: 'Shock',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    selfStrengthMods: [{ kind: 'per-other-in-set-realm', cardIds: ['am', 'stram', 'gram'], delta: 1 }],
    text: "La force de Stram augmente de 1 pour chaque autre membre du trio dans votre royaume (Am ou Gram). Piochez 1 carte lorsque vous déplacez votre figurine sur ce lieu.",
    image: img('stram.webp'),
  },
  {
    id: 'chauves-souris',
    name: 'Chauves-souris',
    englishName: 'Bats',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 4,
    text: "Lorsque les Chauves-souris participent à une action Éliminer un Héros, défaussez-les puis choisissez un Allié dans votre défausse et ajoutez-le à votre main.",
    image: img('chauves-souris.webp'),
  },
  {
    id: 'araignees',
    name: 'Araignées',
    englishName: 'Spiders',
    deck: 'villain',
    type: 'ally',
    cost: 0,
    strength: 1,
    copies: 2,
    text: "Lorsque les Araignées participent à une action Éliminer un Héros, gagnez 1 jeton Pouvoir et piochez 1 carte.",
    image: img('araignees.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objet
  // ----------------------------------------------------------------------
  {
    id: 'baignoire',
    name: 'Baignoire',
    englishName: 'Bathtub',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'location',
    copies: 1,
    // Le lieu portant la Baignoire gagne l'action « Activer » ; l'activation (gratuite)
    // déplace la Baignoire vers un autre lieu en y amenant les Alliés de son ancien lieu.
    grantsAction: { type: 'ACTIVATE', label: 'Activer' },
    activatedCost: 0,
    text: "Ce lieu gagne l'action : Activer. Effectuez une action Activer une capacité pour déplacer la Baignoire vers un autre lieu, puis déplacez-y autant d'Alliés que vous le désirez.",
    image: img('baignoire.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Effets (dont la « Tricherie » Dés pipés)
  // ----------------------------------------------------------------------
  {
    id: 'des-pipes',
    name: 'Dés pipés',
    englishName: 'Loaded Dice',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    reactiveOnly: true,
    text: "Vous pouvez jouer cette carte immédiatement après avoir lancé les dés (sans utiliser une action Jouer une carte). Relancez 1 des dés, puis défaussez cette carte.",
    image: img('des-pipes.webp'),
  },
  {
    id: 'preparation-noel',
    name: 'Préparation de Noël',
    englishName: 'Making Christmastime',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    effects: [{ type: 'ROLL_MAKING_CHRISTMAS' }],
    text: "Lancez les dés. Si vous obtenez 7 ou moins, piochez 1 carte. Si vous obtenez 8 ou plus, effectuez n'importe quelle action disponible du royaume, en dehors d'une action Fatalité.",
    image: img('preparation-noel.webp'),
  },
  {
    id: 'mais-quelle-merveille',
    name: 'Mais quelle merveille !',
    englishName: 'What Have We Here?',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    effects: [{ type: 'ROLL_MERVEILLE' }],
    text: "Effectuez une action Éliminer un Héros, puis lancez les dés. Si vous obtenez 7 ou moins, ajoutez les Alliés utilisés à votre main. Si vous obtenez 8 ou plus, ils ne sont pas défaussés et restent sur le lieu où ils se trouvent.",
    image: img('mais-quelle-merveille.webp'),
  },
  {
    id: 'imposteur-perce-oreilles',
    name: 'Imposteur Perce-Oreilles',
    englishName: 'Impostor Sandy Claws',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 6,
    effects: [{ type: 'ROLL_IMPOSTOR' }],
    text: "Lorsque cette carte est jouée, lancez les dés. Si vous obtenez 6 ou moins, défaussez cette carte. Si vous obtenez 7 ou plus, placez-la à côté du Perce-Oreilles. Si Jack Skellington est présent dans le royaume, ajoutez-lui un jeton Force -1 à la place.",
    image: img('imposteur-perce-oreilles.webp'),
  },
  {
    id: 'ce-sont-des-vacances',
    name: 'Ce sont des vacances',
    englishName: "It's a Vacation",
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 1,
    effects: [{ type: 'DISCARD_TOP_FATE_DRAW_PER_HERO', count: 3 }],
    text: "Défaussez les 3 premières cartes Fatalité de votre pioche. Piochez une carte pour chaque Héros défaussé ainsi.",
    image: img('ce-sont-des-vacances.webp'),
  },
  {
    id: 'affaire-dans-le-sac',
    name: "Cette fois l'affaire est dans le sac",
    englishName: 'This Time, We Bagged Him',
    deck: 'villain',
    type: 'effect',
    cost: 5,
    copies: 1,
    effects: [{ type: 'REPLAY_EVENT_BAG' }],
    text: "Choisissez un Événement dans votre défausse et jouez-le gratuitement. S'il vous demande de lancer les dés, choisissez le résultat.",
    image: img('affaire-dans-le-sac.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'joyeux-halloween',
    name: 'Joyeux Halloween !',
    englishName: 'Trick or Treat',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    trigger: { type: 'opponent-gained-power-ge', value: 1 },
    effects: [{ type: 'ROLL_TRICK_OR_TREAT' }],
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il gagne des jetons Pouvoir. Lancez les dés. Si vous obtenez 8 ou plus, gagnez le même montant en jetons Pouvoir. Si vous obtenez 7 ou moins, volez 1 jeton Pouvoir à un adversaire.",
    image: img('joyeux-halloween.webp'),
  },
  {
    id: 'pere-noel-apporte',
    name: "Qu'est-ce que le Père Noël t'a apporté ?",
    englishName: 'What Did Santa Bring You?',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    trigger: { type: 'opponent-played-cards-ge', value: 1 },
    effects: [{ type: 'DISCARD_ANY_THEN_DRAW', draw: 2 }],
    text: "Cette carte est jouable pendant le tour d'un adversaire s'il utilise une action Jouer une carte. Défaussez autant de cartes que vous le désirez de votre main, puis piochez-en 2.",
    image: img('pere-noel-apporte.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros
  // ----------------------------------------------------------------------
  {
    id: 'zero',
    name: 'Zéro',
    englishName: 'Zero',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    // Zéro renforce Jack (+2) mais, en pratique, a peu d'impact (cf. guide) → simple corps.
    fateMalus: 'slow',
    text: 'La force de Jack Skellington augmente de 2.',
    image: img('zero.webp'),
  },
  {
    id: 'docteur-finkelstein',
    name: 'Docteur Finkelstein',
    englishName: 'Doctor Finkelstein',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    onVanquish: [{ type: 'RESHUFFLE_HOST_INTO_FATE_DECK' }],
    // Revient sans cesse (remélangé dans la pioche à sa mort) → nuisance récurrente.
    fateMalus: 'slow2',
    text: 'Si le Docteur Finkelstein est éliminé, placez-le sur le dessus de la pioche de cartes Fatalité puis remélangez-la.',
    image: img('docteur-finkelstein.webp'),
  },
  {
    id: 'sally',
    name: 'Sally',
    englishName: 'Sally',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    onPlace: [{ type: 'SALLY_PLACED' }],
    // Restreint les déplacements d'Oogie (voisins seulement) → l'empêche d'avancer.
    fateMalus: 'block-advance',
    text: "Déplacez Oogie Boogie sur le lieu où vous jouez Sally. Au début de chaque tour, Oogie Boogie ne peut se déplacer que sur un lieu voisin.",
    image: img('sally.webp'),
  },
  {
    // Héros/Événement. Joué via la Fatalité, agit comme un Événement (défausse un
    // Imposteur Perce-Oreilles). Posé via l'effet du Perce-Oreilles (objectif), il
    // devient un Héros force 8 SANS capacité à éliminer à l'Antre. → phase 3.
    id: 'jack-skellington',
    name: 'Jack Skellington',
    englishName: 'Jack Skellington',
    deck: 'fate',
    type: 'hero',
    strength: 8,
    copies: 1,
    // Zéro : « La force de Jack augmente de 2 » — modélisé côté Jack (présence de Zéro).
    selfStrengthMods: [{ kind: 'if-card', cardId: 'zero', scope: 'realm', delta: 2 }],
    text: "Cette carte est un Événement qui permet de défausser un Imposteur Perce-Oreilles. Si cette carte est jouée via l'effet du Perce-Oreilles, elle devient un Héros sans aucune capacité.",
    image: img('jack-skellington.webp'),
  },
  {
    id: 'maire-halloween',
    name: "Le Maire d'Halloween",
    englishName: 'The Mayor of Halloween Town',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    // « jouez-le sur un lieu de votre choix » — interprété ici : posé sur la Ville
    // d'Halloween (lieu par défaut). Réutilise REVEAL_FATE_UNTIL_HERO_PLAY.
    onVanquish: [{ type: 'REVEAL_FATE_UNTIL_HERO_PLAY', locationId: 'ville-halloween' }],
    // Recouvre une action (le vaincre invoque un autre Héros) → simple ralentissement.
    fateMalus: 'slow',
    text: "Si le Maire d'Halloween est éliminé, dévoilez des cartes Fatalité de votre pioche jusqu'à ce que vous trouviez un Héros, puis jouez-le sur un lieu de votre choix.",
    image: img('maire-halloween.webp'),
  },
  {
    id: 'citoyens-halloween',
    name: "Citoyens d'Halloween",
    englishName: 'Citizens of Halloween Town',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 4,
    mustDefeatFirst: true,
    // Doivent être vaincus en premier (défendent Jack) → ralentissent la mise à mort.
    fateMalus: 'slow',
    text: "Oogie Boogie doit éliminer les Citoyens d'Halloween avant les autres Héros du même lieu.",
    image: img('citoyens-halloween.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'mettons-fin-cauchemar',
    name: 'Mettons fin à ce cauchemar',
    englishName: 'Set Things Right',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Oogie Boogie révèle sa main. Choisissez-y une carte et défaussez-la.',
    image: img('mettons-fin-cauchemar.webp'),
  },
  {
    id: 'diversion',
    name: 'Diversion',
    englishName: 'Distraction',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: "Déplacez un Héros sur un lieu voisin, puis défaussez un Allié ou un Objet qui s'y trouve.",
    effects: [{ type: 'DIVERSION' }],
    image: img('diversion.webp'),
  },
  {
    id: 'salut-oogie',
    name: 'Salut, Oogie !',
    englishName: 'Hello, Oogie!',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: "Placez cette carte sous la figurine de Oogie Boogie. La prochaine fois qu'il lance les dés, Oogie Boogie doit retirer 2 au résultat, puis défausser cette carte.",
    image: img('salut-oogie.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Prisonnier (placé à l'Antre au setup)
  // ----------------------------------------------------------------------
  {
    // Prisonnier : ancre la pile d'Imposteurs. Force formelle 0 (jamais vaincu
    // normalement) — placement au setup et règle des 4 imposteurs → phase 3.
    id: 'perce-oreilles',
    name: 'Perce-Oreilles',
    englishName: 'Sandy Claws',
    deck: 'fate',
    type: 'hero',
    strength: 0,
    copies: 1,
    text: "S'il y a 4 cartes Imposteur Perce-Oreilles dans la pile à côté de cette carte, cherchez Jack Skellington et placez-le sur l'Antre d'Oogie Boogie. Puis retirez le Perce-Oreilles du jeu.",
    image: img('perce-oreilles.webp'),
  },
]
