// =============================================================================
// Maléfique — cartes (Deck Vilain de 30 + Deck Fatalité de 15).
//
// Sources : illustrations fournies (public/cards/maleficent/) et wiki officiel
// pour types / coûts / forces / exemplaires :
//   https://disney-villainous.fandom.com/wiki/Maleficent
//
// Composition vérifiée :
//   Vilain (30)  = 10 Alliés + 8 Malédictions + 6 Événements + 2 Objets + 4 Conditions
//   Fatalité (15) = 10 Héros + 3 Objets (Épée de Vérité) + 2 Effets (Il était un Rêve)
//
// NOTE : la plupart des mécaniques sont *uniques à Maléfique* (effets passifs
// des Malédictions, déclenchements de défausse, etc.). Pour E.1, on n'a que la
// data ; les effets sont implémentés au fil des sous-étapes E.2+.
// =============================================================================

import type { CardDef } from '../types'

const img = (file: string) => `/cards/maleficent/${file}`

export const maleficentCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK VILAIN — Alliés (10 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'creature-rieuse',
    name: 'Créature Rieuse',
    englishName: 'Cackling Goon',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 3,
    text: 'La Créature Rieuse gagne +1 Force pour chaque Héros présent sur son lieu.',
    image: img('creature_rieuse.png'),
  },
  {
    id: 'creature-sauvage',
    name: 'Créature Sauvage',
    englishName: 'Savage Goon',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 4,
    copies: 3,
    text: 'Aucune capacité.',
    image: img('creature_sauvage.png'),
  },
  {
    id: 'sinistre-creature',
    name: 'Sinistre Créature',
    englishName: 'Sinister Goon',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 3,
    text: 'La Sinistre Créature gagne +1 Force si une Malédiction est présente sur son lieu.',
    image: img('sinistre_creature.png'),
  },
  {
    id: 'diablo',
    name: 'Diablo',
    englishName: 'Raven',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 1,
    copies: 1,
    text: "Avant que Maléfique ne se déplace, vous pouvez déplacer Diablo sur n'importe quel lieu et effectuer une action disponible de ce lieu. Diablo ne peut pas faire d'action Fatalité.",
    image: img('diablo.png'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Malédictions (8 exemplaires, type 'curse')
  // ----------------------------------------------------------------------
  {
    id: 'foret-ronces',
    name: 'Forêt de Ronces',
    englishName: 'Forest of Thorns',
    deck: 'villain',
    type: 'curse',
    cost: 2,
    copies: 3,
    text: "Les Héros doivent avoir une Force d'au moins 4 pour être joués sur ce lieu. Défaussez cette Malédiction quand un Héros est joué sur ce lieu.",
    image: img('foret_ronces.png'),
    placementRestriction: { type: 'min-hero-strength', value: 4 },
    discardWhen: { type: 'hero-played-here' },
  },
  {
    id: 'feu-infernal',
    name: 'Feu Infernal',
    englishName: 'Green Fire',
    deck: 'villain',
    type: 'curse',
    cost: 3,
    copies: 3,
    text: 'Aucun Héros ne peut être joué sur ce lieu. Défaussez cette Malédiction si Maléfique se déplace sur ce lieu.',
    image: img('feu_infernal.png'),
    placementRestriction: { type: 'no-heroes' },
    discardWhen: { type: 'pawn-moves-here' },
  },
  {
    id: 'sommeil-sans-reves',
    name: 'Sommeil sans Rêves',
    englishName: 'Dreamless Sleep',
    deck: 'villain',
    type: 'curse',
    cost: 3,
    copies: 2,
    // Règle officielle : défaussée uniquement quand un Allié est JOUÉ (posé
    // depuis la main) sur ce lieu — pas quand on y déplace un Allié.
    text: 'Les Héros sur ce lieu perdent 2 en Force. Défaussez cette Malédiction quand un Allié est joué sur ce lieu.',
    image: img('sommeil_sans_reves.png'),
    strengthMod: { target: 'heroes-here', delta: -2 },
    discardWhen: { type: 'ally-played-here' },
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Événements (6 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'apparence-dragon',
    name: 'Apparence de Dragon',
    englishName: 'Dragon Form',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 3,
    text: 'Vaincre un Héros de Force 3 ou moins. Si une action Fatalité vous cible avant votre prochain tour, gagnez 3 Pouvoir.',
    image: img('apparence_dragon.png'),
    effects: [
      { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 },
      { type: 'ARM_DRAGON_FORM_REWARD' },
    ],
  },
  {
    id: 'disparition-maleficent',
    name: 'Disparition',
    englishName: 'Vanish',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: "Au début de votre prochain tour, Maléfique n'est pas obligée de se déplacer.",
    image: img('disparition.png'),
    effects: [{ type: 'GRANT_SKIP_NEXT_MOVE' }],
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Objets (2 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'rouet',
    name: 'Rouet',
    englishName: 'Spinning Wheel',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Si un Héros est vaincu sur ce lieu, gagnez un nombre de Pouvoir égal à la Force du Héros moins 1.',
    image: img('rouet.png'),
  },
  {
    id: 'baton-magique',
    name: 'Bâton Magique',
    englishName: 'Staff',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Si Maléfique est sur ce lieu, le coût pour jouer un Événement ou une Malédiction est réduit de 1 Pouvoir.',
    image: img('baton_magique.png'),
  },

  // ----------------------------------------------------------------------
  // DECK VILAIN — Conditions (4 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'mechancete',
    name: 'Méchanceté',
    englishName: 'Malice',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Pendant le tour d'un adversaire, s'il vainc un Héros de Force 4 ou plus, vous pouvez jouer Méchanceté. Vainquez un Héros de Force 4 ou moins.",
    image: img('mechancete.png'),
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 4 },
  },
  {
    id: 'tyrannie',
    name: 'Tyrannie',
    englishName: 'Tyranny',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: "Pendant le tour d'un adversaire, s'il a 3 Alliés ou plus dans son royaume, vous pouvez jouer Tyrannie. Piochez 3 cartes, puis défaussez-en 3.",
    image: img('tyrannie.png'),
    trigger: { type: 'opponent-allies-in-realm-ge', value: 3 },
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (10 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'gardes-chateau',
    name: 'Gardes du Château',
    englishName: 'Guards',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 3,
    text: 'Pour vaincre les Gardes du Château, vous devez utiliser au moins deux Alliés.',
    image: img('gardes_chateau.png'),
  },
  {
    id: 'aurore',
    name: 'Aurore',
    englishName: 'Aurora',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: "Quand Aurore est jouée, révélez la première carte de la pioche Fatalité de Maléfique. Si c'est un Héros, jouez-le. Sinon, remettez-la sur le dessus de la pioche.",
    image: img('aurore.png'),
    onPlace: [{ type: 'REVEAL_FATE_TOP_PLAY_IF_HERO' }],
  },
  {
    id: 'paquerette',
    name: 'Pâquerette',
    englishName: 'Fauna',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Quand Pâquerette est jouée, vous pouvez défausser Sommeil sans Rêves sur son lieu.',
    image: img('paquerette.png'),
    onPlace: [{ type: 'DISCARD_CARDS_AT_HOST', cardId: 'sommeil-sans-reves' }],
  },
  {
    id: 'flora',
    name: 'Flora',
    englishName: 'Flora',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Quand Flora est jouée, Maléfique doit révéler sa main. Tant que Flora est en jeu, Maléfique joue main révélée.',
    image: img('flora.png'),
  },
  {
    id: 'roi-hubert',
    name: 'Roi Hubert',
    englishName: 'King Hubert',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Quand le Roi Hubert est joué, vous pouvez déplacer un Allié de chaque lieu voisin vers son lieu.',
    image: img('roi_hubert.png'),
    onPlace: [{ type: 'PULL_ALLY_FROM_EACH_ADJACENT' }],
  },
  {
    id: 'roi-stephane',
    name: 'Roi Stéphane',
    englishName: 'King Stefan',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: "Quand le Roi Stéphane est joué, vous pouvez déplacer Maléfique sur n'importe quel lieu.",
    image: img('roi_stephane.png'),
    onPlace: [{ type: 'MOVE_OWNER_PAWN_FORCED' }],
  },
  {
    id: 'pimprenelle',
    name: 'Pimprenelle',
    englishName: 'Merryweather',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Aucune Malédiction ne peut être jouée sur le lieu de Pimprenelle.',
    image: img('pimprenelle.png'),
    placementRestriction: { type: 'no-curses' },
  },
  {
    id: 'prince-philippe',
    name: 'Prince Philippe',
    englishName: 'Prince Phillip',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Quand le Prince Philippe est joué, vous pouvez défausser tous les Alliés de son lieu.',
    image: img('prince_philippe.png'),
    onPlace: [{ type: 'DISCARD_ALLIES_AT_HOST' }],
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets (3 exemplaires, attach: 'hero')
  // ----------------------------------------------------------------------
  {
    id: 'epee-verite',
    name: 'Épée de Vérité',
    englishName: 'Sword of Truth',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 3,
    text: "Quand l'Épée de Vérité est jouée, associez-la à un Héros qui n'a pas d'autre Objet associé. Ce Héros gagne +2 Force. Le coût pour jouer une Malédiction sur ce lieu est augmenté de 2 Pouvoirs.",
    image: img('epee_verite.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (2 exemplaires)
  // ----------------------------------------------------------------------
  {
    id: 'il-etait-un-reve',
    name: 'Il était un Rêve',
    englishName: 'Once Upon a Dream',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: "Défaussez une Malédiction d'un lieu du royaume de Maléfique qui contient un Héros.",
    image: img('il_etait_un_reve.png'),
  },
]

/** Index id → définition, pour retrouver une carte depuis un CardInstance.cardId. */
export const maleficentCardById: Record<string, CardDef> = Object.fromEntries(
  maleficentCards.map((c) => [c.id, c]),
)
