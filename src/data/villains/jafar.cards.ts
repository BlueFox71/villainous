// =============================================================================
// Jafar — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Jafar/ — transcription complète
// dans assets/decks/Jafar/jafar_reference.md.
//
// PÉRIMÈTRE. Implémentés : Hypnose (contrôle d'un Héros, coût = sa force),
// Lampe Merveilleuse (invocation du Génie), Scarabée d'Or (déverrouillage),
// Iago + Sceptre Serpent (capacités activées), Sacrifice Nécessaire, Prédiction,
// Ah je suis un serpent ? (Vaincre ≤4 sur son lieu), Razoul (Allié −1 sur son
// lieu), Cimeterre/Vœu/Génie+Lampe/Rajah+Jasmine (bonus de force).
// RESTE À FAIRE : Pouvoir de Sorcier (déplacer Héros + Allié), Sablier Géant
// (capacité activée −2 force), Gazeem (recherche à son retrait), Conditions
// Manipulation/Tromperie (effets), capacités des autres Héros Fatalité.
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/jafar/${file}`

export const jafarCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés (6)
  // ----------------------------------------------------------------------
  {
    id: 'garde-palais',
    name: 'Garde du Palais',
    englishName: 'Palace Guard',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 3,
    text: 'Aucune capacité.',
    image: img('garde-palais.webp'),
  },
  {
    id: 'gazeem',
    name: 'Gazeem',
    englishName: 'Gazeem',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Si Gazeem est retiré de votre royaume, cherchez un Objet de votre défausse et ajoutez-le à votre main.',
    image: img('gazeem.webp'),
  },
  {
    id: 'iago',
    name: 'Iago',
    englishName: 'Iago',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 1,
    text: 'Payez 1 jeton Pouvoir : déplacez Iago et un Objet non associé de son lieu vers un lieu voisin non verrouillé.',
    image: img('iago.webp'),
    activatedCost: 1,
  },
  {
    id: 'razoul',
    name: 'Razoul',
    englishName: 'Razoul',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 3,
    copies: 1,
    text: 'Jouer un Allié sur le lieu où se trouve Razoul coûte 1 jeton Pouvoir de moins.',
    image: img('razoul.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets (8)
  // ----------------------------------------------------------------------
  {
    id: 'cimeterre',
    name: 'Cimeterre',
    englishName: 'Scimitar',
    deck: 'villain',
    type: 'item',
    cost: 0,
    attach: 'ally',
    attachStrengthBonus: 1,
    copies: 3,
    text: 'Associez cette carte à un Allié, sa force augmente de 1.',
    image: img('cimeterre.webp'),
  },
  {
    id: 'sceptre-serpent',
    name: 'Sceptre Serpent',
    englishName: 'Snake Staff',
    deck: 'villain',
    type: 'item',
    cost: 2,
    attach: 'location',
    copies: 1,
    text: 'Payez 1 jeton Pouvoir : cherchez une carte Hypnose dans votre défausse et ajoutez-la à votre main.',
    image: img('sceptre-serpent.webp'),
    activatedCost: 1,
  },
  {
    id: 'sablier-geant',
    name: 'Sablier Géant',
    englishName: 'Giant Hourglass',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'location',
    copies: 2,
    text: 'Activer : jusqu’à la fin de votre tour, la force des Héros sur ce lieu est réduite de 2.',
    image: img('sablier-geant.webp'),
    activatedCost: 0,
    strengthMod: { target: 'heroes-here', delta: -2, onlyIfActivatedThisTurn: true },
  },
  {
    id: 'lampe-merveilleuse',
    name: 'Lampe Merveilleuse',
    englishName: 'Magic Lamp',
    deck: 'villain',
    type: 'item',
    cost: 4,
    attach: 'location',
    copies: 1,
    text: 'Placez la Lampe Merveilleuse à la Caverne aux Merveilles. Puis cherchez le Génie dans les cartes Fatalité et placez-le à la Caverne aux Merveilles.',
    image: img('lampe-merveilleuse.webp'),
    playOnlyAt: 'caverne',
    effects: [{ type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'genie', locationId: 'caverne' }],
  },
  {
    id: 'scarabee-or',
    name: "Scarabée d'Or",
    englishName: 'Scarab Pendant',
    deck: 'villain',
    type: 'item',
    cost: 3,
    attach: 'location',
    copies: 1,
    text: 'Retirez la tuile Cadenas de la Caverne aux Merveilles. À la fin de votre tour, piochez une carte supplémentaire.',
    image: img('scarabee-or.webp'),
    effects: [{ type: 'UNLOCK_LOCATION', locationId: 'caverne' }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (12)
  // ----------------------------------------------------------------------
  {
    id: 'hypnose',
    name: 'Hypnose',
    englishName: 'Hypnotize',
    deck: 'villain',
    type: 'effect',
    cost: 0, // coût dynamique = force du Héros cible (géré au moteur, à venir)
    costVariable: true, // pastille « ? »
    copies: 2,
    text: 'Le coût de cette carte est égal à la force du Héros cible. Placez ce Héros dans la rangée du bas de son lieu. Tant qu’il est sous votre contrôle, il devient un Allié de même force ; sa capacité est ignorée.',
    image: img('hypnose.webp'),
    effects: [{ type: 'HYPNOTIZE_HERO' }],
  },
  {
    id: 'prediction',
    name: 'Prédiction',
    englishName: 'Scrying',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Choisissez Objet ou Allié. Révélez les cartes de votre pioche jusqu’à en trouver une de ce type ; ajoutez-la à votre main et défaussez les autres.',
    image: img('prediction.webp'),
    effects: [{ type: 'REVEAL_UNTIL_TYPE', types: ['item', 'ally'] }],
  },
  {
    id: 'sacrifice-necessaire',
    name: 'Sacrifice Nécessaire',
    englishName: 'Necessary Sacrifice',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Défaussez un Allié ou un Objet de votre royaume pour gagner 3 jetons Pouvoir.',
    image: img('sacrifice-necessaire.webp'),
    effects: [{ type: 'DISCARD_OWN_FOR_POWER', amount: 3 }],
  },
  {
    id: 'pouvoir-sorcier',
    name: 'Pouvoir de Sorcier',
    englishName: 'Sorcerous Power',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Déplacez un Héros et un Allié vers n’importe quel(s) lieu(x) non bloqué(s).',
    image: img('pouvoir-sorcier.webp'),
  },
  {
    id: 'ah-serpent',
    name: 'Ah, je suis un serpent ?',
    englishName: 'A Snake Am I?',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Éliminez un Héros de force 4 ou moins sur le lieu où vous vous trouvez.',
    image: img('ah-serpent.webp'),
    effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 4, atPawn: true }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (4)
  // ----------------------------------------------------------------------
  {
    id: 'tromperie',
    name: 'Tromperie',
    englishName: 'Deception',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il possède au moins 2 Objets. Dévoilez la première carte Fatalité de la pioche et jouez-la immédiatement.',
    image: img('tromperie.webp'),
    trigger: { type: 'opponent-items-in-realm-ge', value: 2 },
  },
  {
    id: 'manipulation',
    name: 'Manipulation',
    englishName: 'Manipulation',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il possède au moins 3 Alliés. Ajoutez une carte de votre défausse à votre main.',
    image: img('manipulation.webp'),
    trigger: { type: 'opponent-allies-in-realm-ge', value: 3 },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (7)
  // ----------------------------------------------------------------------
  {
    id: 'abu',
    name: 'Abu',
    englishName: 'Abu',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Prenez un Objet sur le lieu où vous jouez cette carte et associez-le à Abu. Jafar ne peut plus utiliser cet Objet.',
    image: img('abu.webp'),
    onPlace: [{ type: 'STEAL_ITEM_TO_HERO' }],
  },
  {
    id: 'aladdin',
    name: 'Aladdin',
    englishName: 'Aladdin',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Prenez un Objet de la main de Jafar ou sur le lieu où vous jouez cette carte et associez-le à Aladdin. Jafar ne peut plus utiliser cet Objet.',
    image: img('aladdin.webp'),
    onPlace: [{ type: 'STEAL_ITEM_TO_HERO', fromHand: true }],
  },
  {
    id: 'genie',
    name: 'Génie',
    englishName: 'Genie',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text: 'Si le Génie se trouve sur le même lieu que la Lampe Merveilleuse, sa force augmente de 2.',
    image: img('genie.webp'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'lampe-merveilleuse', scope: 'location', delta: 2 }],
  },
  {
    id: 'jasmine',
    name: 'Jasmine',
    englishName: 'Princess Jasmine',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Jafar pioche une carte de moins à la fin de chaque tour.',
    image: img('jasmine.webp'),
  },
  {
    id: 'rajah',
    name: 'Rajah',
    englishName: 'Rajah',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Si la Princesse Jasmine se trouve dans le royaume, la force de Rajah augmente de 2.',
    image: img('rajah.webp'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'jasmine', scope: 'realm', delta: 2 }],
  },
  {
    id: 'sultan',
    name: 'Sultan',
    englishName: 'Sultan',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Jafar ne peut pas utiliser de Garde du Palais pour éliminer le Sultan.',
    image: img('sultan.webp'),
  },
  {
    id: 'tapis-volant',
    name: 'Tapis Volant',
    englishName: 'Carpet',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Jafar doit éliminer le Tapis Volant avant les autres Héros.',
    image: img('tapis-volant.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objet (3)
  // ----------------------------------------------------------------------
  {
    id: 'voeu',
    name: 'Vœu',
    englishName: 'Wish',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    attachStrengthBonus: 2,
    copies: 3,
    text: 'Associez cette carte à un Héros, sa force augmente de 2.',
    image: img('voeu.webp'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (5)
  // ----------------------------------------------------------------------
  {
    id: 'ko',
    name: 'K.O.',
    englishName: 'Crushing Blow',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Retirez un Allié de force 3 ou moins du royaume.',
    image: img('ko.webp'),
  },
  {
    id: 'trahison',
    name: 'Trahison',
    englishName: 'Treachery',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Jafar perd immédiatement 2 jetons Pouvoir.',
    image: img('trahison.webp'),
  },
  {
    id: 'sauvetage',
    name: 'Sauvetage in Extremis',
    englishName: 'Narrow Escape',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Cherchez un Héros dans la défausse de cartes Fatalité et jouez-le immédiatement.',
    image: img('sauvetage.webp'),
  },
]
