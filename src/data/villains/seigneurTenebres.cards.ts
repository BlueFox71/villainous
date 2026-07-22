// =============================================================================
// Le Seigneur des Ténèbres — cartes (deck Méchant : 30 ; deck Fatalité : 15).
//
// Mécanique CHAUDRON NOIR : Anciens Soldats (Objets posés sur les lieux) →
// s'emparer du Chaudron (Montrez-moi le Chaudron Noir / Nous avons conclu un
// marché / vaincre Hen Wen) → l'ACTIVER → jouer des Morts-vivants du Chaudron
// (Cauldron Born) sur les lieux portant des Anciens Soldats (qui sont défaussés).
// Victoire : un Mort-vivant du Chaudron sur chaque lieu.
//
// ⚠️ Certaines cartes n'ont pas encore d'effet machine (texte seul) : leur effet
// réel reste à brancher (cf. mémoire « villainous-tenebres-todo »).
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/seigneur-tenebres/${f}`

export const seigneurTenebresCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets (Anciens Soldats ×5)
  // ----------------------------------------------------------------------
  {
    id: 'ancient-soldiers',
    name: 'Squelettes de Soldats',
    englishName: 'Ancient Soldiers',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 5,
    grantsAction: { type: 'ACTIVATE', label: 'Activer une capacité (Squelettes de Soldats)' },
    text: 'Ce lieu gagne l’action « Activer une capacité » (sert à réveiller le Chaudron Magique en votre possession). Échangez-les contre des Soldats Ressuscités une fois le Chaudron réveillé.',
    image: img('ancient-soldiers.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés (Morts-vivants ×5, Sbires ×3, Gwythaints ×2, Creeper, Chien)
  // ----------------------------------------------------------------------
  {
    id: 'cauldron-born',
    name: 'Soldats Ressuscités',
    englishName: 'Cauldron Born',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 5,
    // Jouable UNIQUEMENT quand le Chaudron Magique est réveillé (face Pouvoir) ET sur un
    // lieu portant un Objet « Squelettes de Soldats », que l'on défausse pour le jouer
    // (échange, à la manière d'Anastasie « en robe de bal »).
    requiresPoweredCauldron: true,
    consumesItemCardId: 'ancient-soldiers',
    survivesVanquishInPlace: true,
    text: 'Vous ne pouvez jouer cette carte que si le Chaudron Magique est réveillé, en défaussant un Objet « Squelettes de Soldats » de son lieu. Les Soldats Ressuscités ne sont pas défaussés lorsqu’ils participent à une action Éliminer un Héros — ils restent en jeu, l’armée immortelle du Seigneur des Ténèbres.',
    image: img('cauldron-born.webp'),
  },
  {
    id: 'horned-king-henchmen',
    name: 'Sbires du Seigneur des Ténèbres',
    englishName: "Horned King's Henchmen",
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 3,
    text: 'Gardes du Seigneur des Ténèbres.',
    image: img('horned-king-henchmen.webp'),
  },
  {
    id: 'gwythaints',
    name: 'Les Vouivres',
    englishName: 'Gwythaints',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 2,
    reachesAdjacentVanquish: true,
    text: 'Lors d’une action Éliminer un Héros, Les Vouivres peuvent être utilisées pour éliminer un Héros sur leur lieu OU sur un lieu voisin.',
    image: img('gwythaints.webp'),
  },
  {
    id: 'creeper',
    name: 'Crapaud',
    englishName: 'Creeper',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 1,
    copies: 1,
    relocateToPawnOnVanquish: true,
    text: 'Lorsque Crapaud participe à une action Éliminer un Héros, déplacez-le sur le lieu de votre figurine au lieu de le défausser.',
    image: img('creeper.webp'),
  },
  {
    id: 'guard-dog',
    name: 'Chien de garde',
    englishName: 'Guard Dog',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Garde les Cachots du Seigneur des Ténèbres.',
    image: img('guard-dog.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions (Only Moments Away ×2)
  // ----------------------------------------------------------------------
  {
    id: 'only-moments-away-victory',
    name: 'Nous touchons du doigt la victoire',
    englishName: 'Only Moments Away From Victory',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il joue un Objet. Jouez gratuitement un Objet de votre main.',
    trigger: { type: 'opponent-played-item', value: 1 },
    effects: [{ type: 'GRANT_FREE_ITEM_PLAY' }],
    image: img('only-moments-away-victory.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements (Our Hour ×2, Show Me ×2, Visions ×2,
  //   We Got You ×2, We Have Made a Bargain ×2, Captured! ×1)
  // ----------------------------------------------------------------------
  {
    id: 'our-hour-has-arrived',
    name: 'Notre heure est venue !',
    englishName: 'Our Hour Has Arrived',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    // Jouable seulement si le Chaudron Magique est en possession (réclamé) : le réveille.
    text: 'Vous ne pouvez jouer cette carte que si vous possédez le Chaudron Magique. Réveillez-le (face Pouvoir) : vous pouvez désormais jouer des Soldats Ressuscités.',
    effects: [{ type: 'POWER_BLACK_CAULDRON' }],
    image: img('our-hour-has-arrived.webp'),
  },
  {
    id: 'show-me-black-cauldron',
    name: 'Montre-moi le Chaudron Magique !',
    englishName: 'Show Me the Black Cauldron',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Emparez-vous du Chaudron Magique (placez la tuile à côté de votre portrait) OU gagnez 3 jetons Pouvoir.',
    effects: [{ type: 'CLAIM_CAULDRON_OR_POWER', power: 3 }],
    image: img('show-me-black-cauldron.webp'),
  },
  {
    id: 'we-have-made-bargain',
    name: 'Nous avons conclu un marché !',
    englishName: 'We Have Made a Bargain',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Mélangez votre défausse et votre pioche OU payez 3 jetons Pouvoir supplémentaires pour défausser l’Épée Magique de votre royaume et vous emparer du Chaudron Magique.',
    effects: [{ type: 'BARGAIN_RESHUFFLE_OR_SWORD', power: 3 }],
    image: img('we-have-made-bargain.webp'),
  },
  {
    id: 'we-got-you-pig-keeper',
    name: 'On te tient, valet de ferme !',
    englishName: 'We Got You Now, Pig Keeper',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Cherchez Tirelire et jouez-la sur le lieu de votre choix, OU éliminez un Héros de force 1.',
    // Choix interactif à la pose (cf. UI / enumerate) : chercher Tirelire (hen-wen) OU
    // éliminer un Héros de force ≤ 1. Injouable si Tirelire est déjà en jeu ET qu'aucun
    // Héros de force 1 n'est dans le royaume.
    effects: [{ type: 'PIGKEEPER_RESOLVE', heroCardId: 'hen-wen', maxStrength: 1 }],
    image: img('we-got-you-pig-keeper.webp'),
  },
  {
    id: 'visions',
    name: 'Visions',
    englishName: 'Visions',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Gagnez 1 jeton Pouvoir par Héros dans votre royaume.',
    // Injouable sans Héros au royaume (aucun effet) : garde-fou moteur (actions.ts),
    // grisage en main (Hand.tsx) et exclusion IA (enumerate.ts) gèrent déjà cet effet.
    effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }],
    image: img('visions.webp'),
  },
  {
    id: 'captured-hk',
    name: 'Capturés',
    englishName: 'Captured!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 1,
    text: 'Piochez 3 cartes.',
    effects: [{ type: 'DRAW_CARDS', count: 3 }],
    image: img('captured-hk.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (8)
  // ----------------------------------------------------------------------
  {
    id: 'taran',
    name: 'Taram',
    englishName: 'Taran',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    selfStrengthMods: [{ kind: 'per-other-hero-here', delta: 1 }],
    text: 'La force de Taram augmente de 1 pour chaque autre Héros présent sur son lieu.',
    image: img('taran.webp'),
  },
  {
    id: 'princess-eilonwy',
    name: 'Princesse Éloïse',
    englishName: 'Princess Eilonwy',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    strengthMod: { target: 'heroes-here', excludeSelf: true, delta: 1 },
    text: 'La force de tous les autres Héros présents sur ce lieu augmente de 1.',
    image: img('princess-eilonwy.webp'),
  },
  {
    id: 'fflewddur-fflam',
    name: 'Ritournel',
    englishName: 'Fflewddur Fflam',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    onPlace: [{ type: 'GATHER_ALLIES_TO_HOST' }],
    text: 'Quand Ritournel est joué, déplacez tous les Alliés vers son lieu.',
    image: img('fflewddur-fflam.webp'),
  },
  {
    id: 'witches-of-morva',
    name: 'Les Sorcières de Morva',
    englishName: 'The Witches of Morva',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Tant que Les Sorcières de Morva sont dans le royaume, le Seigneur des Ténèbres ne peut pas s’emparer du Chaudron Magique (elles le détiennent).',
    image: img('witches-of-morva.webp'),
  },
  {
    id: 'doli',
    name: 'Ronchon',
    englishName: 'Doli',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    onPlace: [{ type: 'SCATTER_REALM_HEROES' }],
    text: 'Quand Ronchon est joué, vous pouvez déplacer chaque Héros vers n’importe quel(s) lieu(x).',
    image: img('doli.webp'),
  },
  {
    id: 'fair-folk',
    name: 'Les Elfes',
    englishName: 'Fair Folk',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    blocksItemPlacement: 'ancient-soldiers',
    text: 'Les Squelettes de Soldats ne peuvent pas être joués sur le lieu où se trouvent les Elfes.',
    image: img('fair-folk.webp'),
  },
  {
    id: 'gurgi',
    name: 'Gurki',
    englishName: 'Gurgi',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    onVanquish: [{ type: 'RESHUFFLE_HOST_INTO_FATE_DECK' }],
    text: 'Quand Gurki est éliminé, il est remélangé dans la pioche Fatalité.',
    image: img('gurgi.webp'),
  },
  {
    id: 'hen-wen',
    name: 'Tirelire',
    englishName: 'Hen Wen',
    deck: 'fate',
    type: 'hero',
    strength: 1,
    copies: 1,
    // Vaincre Tirelire permet de s'emparer du Chaudron Magique (elle révèle son secret).
    blocksVillainEvents: true,
    onVanquish: [{ type: 'CLAIM_BLACK_CAULDRON' }],
    text: 'La truie oraculaire. Tant qu’elle est en jeu, le Seigneur des Ténèbres ne peut plus jouer d’Événement. S’il la vainc, il s’empare du Chaudron Magique.',
    image: img('hen-wen.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objet (Dyrnwyn)
  // ----------------------------------------------------------------------
  {
    id: 'dyrnwyn',
    name: 'L’Épée Magique',
    englishName: 'Dyrnwyn',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    attachStrengthBonus: 2,
    copies: 1,
    text: 'Associez l’Épée Magique à un Héros. Sa force augmente de 2.',
    image: img('dyrnwyn.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (I Believe in You ×2, Reunited ×2,
  //   Gurgi's Happy Day ×1, Gurgi's Sacrifice ×1)  — effets « texte seul » (à brancher)
  // ----------------------------------------------------------------------
  {
    id: 'i-believe-in-you',
    name: 'Moi j’ai confiance en toi',
    englishName: 'I Believe in You',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Le Seigneur des Ténèbres défausse toutes les cartes de sa main puis pioche 3 cartes.',
    effects: [{ type: 'DISCARD_HAND_DRAW', draw: 3 }],
    image: img('i-believe-in-you.webp'),
  },
  {
    id: 'reunited',
    name: 'Retrouvailles',
    englishName: 'Reunited',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Choisissez un Héros dans la défausse de cartes Fatalité et jouez-le sur n’importe quel lieu.',
    effects: [{ type: 'FATE_PLAY_HERO_FROM_DISCARD' }],
    image: img('reunited.webp'),
  },
  {
    id: 'gurgis-happy-day',
    name: 'Retour à la vie de Gurki',
    englishName: "Gurgi's Happy Day",
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Mélangez la défausse et la pioche de cartes Fatalité, puis dévoilez 2 cartes Fatalité et jouez-les toutes les deux.',
    effects: [{ type: 'RESHUFFLE_FATE_REVEAL_PLAY_BOTH' }],
    image: img('gurgis-happy-day.webp'),
  },
  {
    id: 'gurgis-sacrifice',
    name: 'Sacrifice de Gurki',
    englishName: "Gurgi's Sacrifice",
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Si le Chaudron Magique est réveillé, Gurki se sacrifie pour le rendormir.',
    effects: [{ type: 'DORMANT_BLACK_CAULDRON' }],
    image: img('gurgis-sacrifice.webp'),
  },
]
