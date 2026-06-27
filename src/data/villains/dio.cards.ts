// =============================================================================
// Dio Brando — cartes : Méchant (30) + Fatalité (15) + Stands HORS deck (7).
//
// Texte FR = source de vérité (tableur Villainous_Template, feuille « DIO BRANDO »).
//
// Les STANDS (isStand) ne sont dans AUCUN deck : createInitialGame les déplace dans
// `standPile`. Ils n'entrent en jeu que par fetch quand leur carte invocatrice est
// jouée, et sont alors ASSOCIÉS à elle (bonus de force via `attachStrengthBonus`,
// plus une aura passive). SEUL « The World » est un Stand vivant dans le deck Méchant
// (il n'a donc PAS `isStand` ; il suit le pion et est indéfaussable).
//
// PÉRIMÈTRE : les comportements complexes (fetch des Stands, ZA WARUDO!, The World,
// Fatalité auto-ciblantes…) sont câblés dans les phases dédiées. Ici : la donnée
// structurelle (type/coût/force/association) et le texte. Les `effects`/`onPlace`
// sont ajoutés au fil des phases.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/dio/${f}`

export const dioCards: CardDef[] = [
  // ============================ DECK MÉCHANT (30) ============================

  // --- Événements -----------------------------------------------------------
  {
    id: 'za-warudo',
    name: 'ZA WARUDO !',
    englishName: 'The World!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 5,
    text:
      'ZA WARUDO ! est jouable sans action « Jouer une carte » et doit être jouée juste ' +
      'après avoir déplacé votre pion. Pendant ce tour, vous pouvez faire les actions de ' +
      'n’importe quel lieu (hors action Fatalité), mais faire une action coûte 1 jeton ' +
      'Pouvoir, plus 1 par action supplémentaire. Nécessite d’avoir votre Stand dans votre royaume.',
    image: img('za-warudo.png'),
    // Jouable sans action « Jouer une carte », uniquement après le déplacement et avant
    // toute action de lieu. Active le temps arrêté (ZA_WARUDO_ACTIVATE) : ensuite, le pion
    // se déplace librement (ZA_WARUDO_RELOCATE) et chaque action coûte un Pouvoir croissant.
    playableWithoutAction: true,
    playableOnlyBeforeActions: true,
    effects: [{ type: 'ZA_WARUDO_ACTIVATE' }],
  },
  {
    id: 'tu-oses-tapprocher',
    name: 'Tu oses t’approcher de moi',
    englishName: 'You Dare Approach Me',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 4,
    text:
      'Dévoilez les quatre premières cartes Fatalité. Jouez les Héros sur le lieu où se ' +
      'trouve Dio, puis défaussez les autres cartes dévoilées.',
    image: img('tu-oses-tapprocher.png'),
    effects: [{ type: 'DIO_REVEAL_FATE_HEROES_AT_PAWN', count: 4 }],
  },
  {
    id: 'jotaro',
    name: 'JOTARO !',
    englishName: 'JOTARO!',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Pendant votre tour, effectuez les actions recouvertes par les Héros.',
    image: img('jotaro.png'),
    effects: [{ type: 'USE_COVERED_ACTIONS_THIS_TURN', exceptFate: true }],
  },
  {
    id: 'vampirisme',
    name: 'Vampirisme',
    englishName: 'Vampirism',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Défaussez un Allié pour gagner 4 jetons Pouvoir.',
    image: img('vampirisme.png'),
    effects: [{ type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }],
  },
  {
    id: 'soif-de-sang',
    name: 'Soif de sang',
    englishName: 'Bloodlust',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Gagnez 1 jeton Pouvoir par Héros dans votre royaume.',
    image: img('soif-de-sang.png'),
    effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }],
  },
  {
    id: 'indigne-de-moi',
    name: 'Indigne de moi',
    englishName: 'Beneath Me',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Gagnez 1 jeton Pouvoir par Héros dans la défausse Fatalité.',
    image: img('indigne-de-moi.png'),
    effects: [{ type: 'GAIN_POWER_PER_FATE_DISCARD_HERO', max: 99 }],
  },
  {
    id: 'quete-vers-le-paradis',
    name: 'Quête vers le paradis',
    englishName: 'Quest for Heaven',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text:
      'Choisissez un type de carte entre Objet ou Événement, puis mélangez la défausse et ' +
      'piochez les 6 premières cartes : ajoutez les cartes de ce type à votre main et ' +
      'laissez les autres dans la défausse.',
    image: img('quete-vers-le-paradis.png'),
    effects: [{ type: 'DIO_QUEST_FOR_HEAVEN' }],
  },

  // --- Condition ------------------------------------------------------------
  {
    id: 'muda-muda-muda',
    name: 'MUDA ! MUDA ! MUDA !',
    englishName: 'USELESS! USELESS! USELESS!',
    deck: 'villain',
    type: 'condition',
    cost: 2,
    copies: 2,
    text:
      'Jouable pendant le tour d’un adversaire si celui-ci vous cible avec une action ' +
      'Fatalité. Vous pouvez éliminer un Héros sur le lieu où vous vous trouvez et gagner ' +
      '5 jetons Pouvoir.',
    image: img('muda-muda-muda.png'),
    trigger: { type: 'opponent-fate-targeted-me' },
    effects: [{ type: 'DIO_MUDA', gain: 5 }],
  },

  // --- Objets ---------------------------------------------------------------
  {
    id: 'masque-de-pierre',
    name: 'Masque de pierre',
    englishName: 'Stone Mask',
    deck: 'villain',
    type: 'item',
    cost: 0,
    copies: 1,
    text: 'Défaussez votre main pour gagner 1 jeton Pouvoir par carte défaussée.',
    image: img('masque-de-pierre.png'),
    // Porte le symbole « Activer » (capacité activée, sans coût en Pouvoir) : l'effet ne
    // se déclenche QU'À l'activation (pas à la pose).
    activatedCost: 0,
    activatedEffects: [{ type: 'DIO_DISCARD_HAND_GAIN_POWER' }],
  },
  {
    id: 'la-fleche',
    name: 'La flèche',
    englishName: 'The Arrow',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 2,
    text: 'Piochez 4 cartes.',
    image: img('la-fleche.png'),
    // Capacité activée (comme Masque de pierre) : on joue l'Objet (coût 1), puis on
    // l'« Active » pour piocher 4 — l'effet ne se déclenche pas à la pose.
    activatedCost: 0,
    activatedEffects: [{ type: 'DRAW_CARDS', count: 4 }],
  },

  // --- Stand dans le deck Méchant -------------------------------------------
  {
    id: 'the-world',
    name: 'The World',
    englishName: 'The World',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 9,
    copies: 1,
    text:
      'Cette carte suit toujours votre pion et ne peut être défaussée. Lorsque Jotaro et ' +
      'Joseph ont été retirés du jeu, toutes les cartes et actions qui rapportent des ' +
      'jetons Pouvoir vous en procurent le double.',
    image: img('the-world.png'),
    // Stand vivant DANS le deck (pas dans standPile) : il suit le pion et est indéfaussable.
    followsPawn: true,
    cannotBeDiscarded: true,
  },

  // --- Alliés ---------------------------------------------------------------
  {
    id: 'vanilla-ice',
    name: 'Vanilla Ice',
    englishName: 'Vanilla Ice',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 1,
    copies: 1,
    text: 'Lorsque Vanilla Ice est joué, allez chercher CREAM et associez-le-lui.',
    image: img('vanilla-ice.png'),
    summonsStandCardId: 'cream',
  },
  {
    id: 'enya-geil',
    name: 'Enya Geil',
    englishName: 'Enya the Hag',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 1,
    copies: 1,
    text:
      'Lorsque Enya Geil est jouée, allez chercher JUSTICE et associez-le-lui. Allez ' +
      'chercher la carte « La flèche » et ajoutez-la à votre main.',
    image: img('enya-geil.png'),
    summonsStandCardId: 'justice',
    effects: [{ type: 'FETCH_CARD_TO_HAND', cardId: 'la-fleche' }],
  },
  {
    id: 'legion-de-vampire',
    name: 'Légion de vampires',
    englishName: 'Vampire Legion',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 3,
    copies: 2,
    text: 'Aucune capacité.',
    image: img('legion-de-vampire.png'),
  },

  // ============================ DECK FATALITÉ (15) ===========================

  // --- Héros (la famille Joestar + les Stardust Crusaders) ------------------
  {
    id: 'jotaro-kujo',
    name: 'Jotaro Kujo',
    englishName: 'Jotaro Kujo',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text:
      'Lorsque Jotaro est joué, allez chercher STAR PLATINUM et associez-le-lui. Si Jotaro ' +
      'est éliminé, il est retiré de la partie.',
    image: img('jotaro-kujo.png'),
    onPlace: [{ type: 'FETCH_STAND_ATTACH', standCardId: 'star-platinum' }],
    removedFromGameOnDefeat: true,
  },
  {
    id: 'joseph-joestar',
    name: 'Joseph Joestar',
    englishName: 'Joseph Joestar',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text:
      'Tant que Joseph est présent, la main de Dio est révélée. Si Joseph est éliminé, il ' +
      'est retiré de la partie.',
    image: img('joseph-joestar.png'),
    removedFromGameOnDefeat: true,
  },
  {
    id: 'jean-pierre-polnareff',
    name: 'Jean-Pierre Polnareff',
    englishName: 'Jean Pierre Polnareff',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Lorsque Jean-Pierre Polnareff est joué, allez chercher SILVER CHARIOT et associez-le-lui.',
    image: img('jean-pierre-polnareff.png'),
    onPlace: [{ type: 'FETCH_STAND_ATTACH', standCardId: 'silver-chariot' }],
    // Silver Chariot (toujours associé) : « Vous devez éliminer Polnareff avant les autres Héros. »
    mustDefeatFirst: true,
  },
  {
    id: 'noriaki-kakyoin',
    name: 'Noriaki Kakyoin',
    englishName: 'Noriaki Kakyoin',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Lorsque Kakyoin est joué, allez chercher HIEROPHANT GREEN et associez-le-lui.',
    image: img('noriaki-kakyoin.png'),
    onPlace: [{ type: 'FETCH_STAND_ATTACH', standCardId: 'hierophant-green' }],
  },
  {
    id: 'mohammed-abdul',
    name: 'Mohammed Abdul',
    englishName: 'Muhammad Avdol',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Lorsque Mohammed Abdul est joué, allez chercher MAGICIAN RED et associez-le-lui.',
    image: img('mohammed-abdul.png'),
    onPlace: [{ type: 'FETCH_STAND_ATTACH', standCardId: 'magician-red' }],
  },
  {
    id: 'iggy',
    name: 'Iggy',
    englishName: 'Iggy',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    text: 'Lorsque Iggy est joué, allez chercher THE FOOL et associez-le-lui.',
    image: img('iggy.png'),
    onPlace: [{ type: 'FETCH_STAND_ATTACH', standCardId: 'the-fool' }],
  },

  // --- Événements Fatalité (ciblent Dio lui-même) ---------------------------
  {
    id: 'hermit-purple',
    name: 'Hermit Purple',
    englishName: 'Hermit Purple',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Dio révèle sa main et défausse 3 cartes.',
    image: img('hermit-purple.png'),
    effects: [{ type: 'TARGET_DISCARD_CHOICE', count: 3, label: 'Hermit Purple' }],
  },
  {
    id: 'cartomancie',
    name: 'Cartomancie',
    englishName: 'Cartomancy',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Réduit la force d’un Allié de 2.',
    image: img('cartomancie.png'),
    effects: [{ type: 'DIO_REDUCE_ALLY_STRENGTH', amount: 2 }],
  },
  {
    id: 'fondation-speedwagon',
    name: 'Fondation Speedwagon',
    englishName: 'Speedwagon Foundation',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Objet.',
    image: img('fondation-speedwagon.png'),
    effects: [{ type: 'DIO_DISCARD_ITEM_IN_REALM' }],
  },
  {
    id: 'ora-ora-ora',
    name: 'ORA ! ORA ! ORA !',
    englishName: 'ORA! ORA! ORA!',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Perdez 4 jetons Pouvoir.',
    image: img('ora-ora-ora.png'),
    effects: [{ type: 'LOSE_POWER', amount: 4 }],
  },
  {
    id: 'lumiere-du-soleil',
    name: 'Lumière du Soleil',
    englishName: 'Sunlight',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Dio doit choisir entre défausser sa main ou perdre 10 jetons Pouvoir.',
    image: img('lumiere-du-soleil.png'),
    effects: [{ type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }],
  },

  // ============================ STANDS (hors deck, 7) ========================
  // Associés par fetch à leur carte invocatrice (bonus de force + aura passive).

  // -- Stands « Méchant » (associés à des Alliés de Dio) --
  {
    id: 'cream',
    name: 'CREAM',
    englishName: 'Cream',
    deck: 'villain',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'ally',
    attachStrengthBonus: 6,
    text: 'Défaussez un Héros de force inférieure à Vanilla Ice sur son lieu.',
    image: img('cream.png'),
    // Effet « à l'invocation » (résolu par FETCH_STAND_ATTACH, hôte = Vanilla Ice).
    effects: [{ type: 'DIO_CREAM_DISCARD_HERO' }],
  },
  {
    id: 'justice',
    name: 'Justice',
    englishName: 'Justice',
    deck: 'villain',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'ally',
    attachStrengthBonus: 2,
    text: 'Allez chercher un Allié dans votre défausse et ajoutez-le à votre main.',
    image: img('justice.png'),
    // Porte le symbole « Activer » : l'effet est activé (pas déclenché à l'invocation du Stand).
    activatedCost: 0,
    activatedEffects: [{ type: 'DIO_RECOVER_ALLY_FROM_DISCARD' }],
  },

  // -- Stands « Fatalité » (associés aux Héros Joestar pour les renforcer) --
  {
    id: 'star-platinum',
    name: 'Star Platinum',
    englishName: 'Star Platinum',
    deck: 'fate',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'hero',
    attachStrengthBonus: 9,
    text: 'Tant que Star Platinum est présent, ZA WARUDO ! ne peut pas être utilisée.',
    image: img('star-platinum.png'),
  },
  {
    id: 'silver-chariot',
    name: 'Silver Chariot',
    englishName: 'Silver Chariot',
    deck: 'fate',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'hero',
    attachStrengthBonus: 4,
    text: 'Vous devez éliminer Polnareff avant les autres Héros.',
    image: img('silver-chariot.png'),
  },
  {
    id: 'hierophant-green',
    name: 'Hierophant Green',
    englishName: 'Hierophant Green',
    deck: 'fate',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'hero',
    attachStrengthBonus: 4,
    text: 'Tant que Hierophant Green est présent, vos cartes coûtent un jeton Pouvoir supplémentaire.',
    image: img('hierophant-green.png'),
    // Aura : +1 au coût de toute carte de Dio tant que ce Stand est dans son royaume.
    playCardCostSurcharge: 1,
  },
  {
    id: 'magician-red',
    name: 'Magician Red',
    englishName: 'Magician’s Red',
    deck: 'fate',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'hero',
    attachStrengthBonus: 4,
    text: 'Tant que Magician Red est présent, Dio pioche une carte de moins en fin de tour ou via les Événements.',
    image: img('magician-red.png'),
  },
  {
    id: 'the-fool',
    name: 'The Fool',
    englishName: 'The Fool',
    deck: 'fate',
    type: 'item',
    copies: 1,
    isStand: true,
    attach: 'hero',
    attachStrengthBonus: 4,
    text: 'Déplacez les Alliés sur le lieu d’Iggy vers n’importe quel autre lieu.',
    image: img('the-fool.png'),
    // Effet « à l'invocation » (résolu par FETCH_STAND_ATTACH) : disperse les Alliés de Dio
    // présents sur le lieu d'Iggy.
    effects: [{ type: 'DIO_THE_FOOL_SCATTER' }],
  },
]
