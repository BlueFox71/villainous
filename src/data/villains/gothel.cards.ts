// =============================================================================
// Mère Gothel — cartes (deck Méchant + deck Fatalité).
//
// Données (coût/force/type) relevées sur les illustrations FR du dossier
// assets/decks/Mère Gothel/. Les `text` sont des descriptions FONCTIONNELLES
// (reformulées), pas le texte imprimé.
//
// Effets : les variantes DÉTERMINISTES (gain/perte de Confiance, déplacement de
// Raiponce, blocage de son déplacement) sont câblées via `effects`. Les effets
// demandant un CHOIX interactif (récupération en défausse, Vanquish déclenché,
// déplacement « 1 ou 2 lieux »…) restent décrits en texte et seront ajoutés en
// Phase 3b (cf. mémoire « villainous-gothel-todo »).
//
// Raiponce : Héros-tuile (copies 0), posée sur la Tour à la mise en place.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/gothel/${f}`

export const gothelCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés (9)
  // ----------------------------------------------------------------------
  {
    id: 'garde-royal',
    name: 'Garde royal',
    englishName: 'Royal Guard',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 5,
    text: 'Allié. Quand il est déplacé, vous pouvez déplacer un Héros de son lieu de départ vers son lieu d’arrivée.',
    image: img('garde-royal.png'),
  },
  {
    id: 'cavaliers-du-roi',
    name: 'Cavaliers du roi',
    englishName: "King's Cavalry",
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 2,
    reachesAdjacentVanquish: true,
    text: 'Allié. Lors d’une action Éliminer un Héros, ils peuvent frapper un Héros de leur lieu ou d’un lieu voisin.',
    image: img('cavaliers-du-roi.png'),
  },
  {
    id: 'patchy-stabbington',
    name: 'Patchy Stabbington',
    englishName: 'Patchy Stabbington',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 5,
    copies: 1,
    text: 'Allié. S’il est joué sur le lieu de Raiponce, vous pouvez la déplacer sur la Tour.',
    effects: [{ type: 'OFFER_RAIPONCE_TO_TOWER' }],
    image: img('patchy-stabbington.png'),
  },
  {
    id: 'sideburns-stabbington',
    name: 'Sideburns Stabbington',
    englishName: 'Sideburns Stabbington',
    deck: 'villain',
    type: 'ally',
    cost: 3,
    strength: 5,
    copies: 1,
    text: 'Allié. S’il est joué sur le lieu de Raiponce, vous pouvez la déplacer sur la Tour.',
    effects: [{ type: 'OFFER_RAIPONCE_TO_TOWER' }],
    image: img('sideburns-stabbington.png'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions (4)
  // ----------------------------------------------------------------------
  {
    id: 'double-jeu',
    name: 'Double jeu',
    englishName: 'Double Cross',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable au tour d’un adversaire qui élimine un Héros de force 3 ou plus : éliminez alors un Héros de force 3 ou moins de votre royaume.',
    trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 3 },
    image: img('double-jeu.png'),
  },
  {
    id: 'egocentrisme',
    name: 'Égocentrisme',
    englishName: 'Self-Centered',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable au tour d’un adversaire qui déplace un Héros ou un Objet : déplacez alors Raiponce sur la Tour.',
    trigger: { type: 'opponent-moved-card' },
    effects: [{ type: 'MOVE_RAIPONCE', to: 'tour' }],
    image: img('egocentrisme.png'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements (14)
  // ----------------------------------------------------------------------
  {
    id: 'ce-quil-ma-pris',
    name: 'Ce qu’il m’a pris',
    englishName: 'What I Have Lost',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Récupérez une carte de votre défausse et ajoutez-la à votre main.',
    effects: [{ type: 'RECOVER_ANY_FROM_DISCARD', label: 'Ce qu’il m’a pris' }],
    image: img('ce-quil-ma-pris.png'),
  },
  {
    id: 'je-serai-la-mechante',
    name: 'Je serai la méchante',
    englishName: "I'll Be the Bad Guy",
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 2,
    text: 'Déplacez Raiponce sur la Tour, puis perdez 1 jeton Confiance.',
    effects: [{ type: 'MOVE_RAIPONCE', to: 'tour' }, { type: 'LOSE_CONFIANCE', amount: 1 }],
    image: img('je-serai-la-mechante.png'),
  },
  {
    id: 'je-taime-bien-plus',
    name: 'Je t’aime bien plus que cela',
    englishName: 'I Love You More',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Si votre pion est sur le lieu de Raiponce, gagnez 1 jeton Confiance (et 1 de plus si c’est la Tour).',
    effects: [{ type: 'GAIN_CONFIANCE_WITH_RAIPONCE', amount: 1, bonusAtTour: 1 }],
    image: img('je-taime-bien-plus.png'),
  },
  {
    id: 'lance-moi-ta-chevelure',
    name: 'Lance-moi ta chevelure',
    englishName: 'Let Down Your Hair',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Si Raiponce est sur la Tour, gagnez 1 jeton Confiance ; sinon déplacez-la de 1 ou 2 lieux vers la Tour.',
    effects: [{ type: 'RAIPONCE_HOMEWARD', confianceIfAtTower: 1, maxSteps: 2 }],
    image: img('lance-moi-ta-chevelure.png'),
  },
  {
    id: 'necoute-que-moi',
    name: 'N’écoute que moi',
    englishName: 'Listen to Me',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Raiponce ne se déplace pas à la fin de ce tour.',
    effects: [{ type: 'SKIP_RAIPONCE_MOVE' }],
    image: img('necoute-que-moi.png'),
  },
  {
    id: 'tromperie-gothel',
    name: 'Tromperie',
    englishName: 'Deception',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Déplacez Raiponce d’un lieu vers Corona, puis gagnez 1 jeton Confiance.',
    effects: [{ type: 'MOVE_RAIPONCE', to: 'right', steps: 1 }, { type: 'GAIN_CONFIANCE', amount: 1 }],
    image: img('tromperie-gothel.png'),
  },
  {
    id: 'vengeance',
    name: 'Vengeance',
    englishName: 'Vengeance',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 2,
    text: 'Effectuez une action Éliminer un Héros ; si un Héros autre que Raiponce est éliminé, gagnez 1 jeton Confiance.',
    effects: [{ type: 'VENGEANCE' }],
    image: img('vengeance.png'),
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets (3)
  // ----------------------------------------------------------------------
  {
    id: 'brosse-a-cheveux',
    name: 'Brosse à cheveux',
    englishName: 'Hairbrush',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Si elle est jouée ou déplacée sur le lieu de Raiponce, gagnez 1 jeton Confiance.',
    effects: [{ type: 'GAIN_CONFIANCE_WITH_RAIPONCE', amount: 1, bonusAtTour: 0 }],
    image: img('brosse-a-cheveux.png'),
  },
  {
    id: 'couronne-gothel',
    name: 'Couronne',
    englishName: 'Crown',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Si un Héros est éliminé sur le lieu de la Couronne, gagnez 2 jetons Confiance. À tout moment de votre tour, vous pouvez la défausser pour gagner 1 jeton Confiance.',
    image: img('couronne-gothel.png'),
  },
  {
    id: 'poignard',
    name: 'Poignard',
    englishName: 'Dagger',
    deck: 'villain',
    type: 'item',
    cost: 1,
    attach: 'ally',
    attachStrengthBonus: 2,
    copies: 1,
    text: 'Associez-le à un Allié : +2 de force. Si cet Allié élimine Raiponce, gagnez 1 jeton Confiance.',
    image: img('poignard.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements (7)
  // ----------------------------------------------------------------------
  {
    id: 'moi-jai-un-reve',
    name: 'Moi j’ai un rêve',
    englishName: 'I’ve Got a Dream',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'Mère Gothel perd 1 jeton Confiance.',
    effects: [{ type: 'LOSE_CONFIANCE', amount: 1 }],
    image: img('moi-jai-un-reve.png'),
  },
  {
    id: 'lanternes',
    name: 'Lanternes',
    englishName: 'Lanterns',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Déplacez Raiponce sur Corona.',
    effects: [{ type: 'MOVE_RAIPONCE', to: 'corona' }],
    image: img('lanternes.png'),
  },
  {
    id: 'vieillissement',
    name: 'Vieillissement',
    englishName: 'Aging',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un Allié ou un Objet de coût 2 ou moins du royaume de Mère Gothel.',
    image: img('vieillissement.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros (7 ; Raiponce sur tuile, hors deck)
  // ----------------------------------------------------------------------
  {
    id: 'flynn-rider',
    name: 'Flynn Rider',
    englishName: 'Flynn Rider',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'À son arrivée, Mère Gothel perd jusqu’à 2 jetons Confiance ; s’il est éliminé, elle en regagne 2. (Effets : Phase 3b.)',
    image: img('flynn-rider.png'),
    onPlace: [{ type: 'FLYNN_TAKE_CONFIANCE', amount: 2 }],
  },
  {
    id: 'la-main-froide',
    name: 'La Main froide',
    englishName: 'The Cold Hand',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'À son arrivée, Mère Gothel défausse une carte au hasard de sa main. (Effet : Phase 3b.)',
    image: img('la-main-froide.png'),
    onPlace: [{ type: 'FATE_DISCARD_RANDOM_HAND', amount: 1 }],
  },
  {
    id: 'la-reine-et-le-roi',
    name: 'La Reine et le Roi',
    englishName: 'The Queen and King',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'À leur arrivée sur le lieu de Raiponce, Mère Gothel perd 1 jeton Confiance. (Effet : Phase 3b.)',
    image: img('la-reine-et-le-roi.png'),
    onPlace: [{ type: 'LOSE_CONFIANCE_AT_RAIPONCE', amount: 1 }],
  },
  {
    id: 'le-satyre',
    name: 'Le Satyre',
    englishName: 'The Satyr',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si vous jouez Le Satyre sur le lieu où se trouve Mère Gothel, vous pouvez la déplacer sur n’importe quel lieu. (Effet : Phase 3b.)',
    image: img('le-satyre.png'),
    onPlace: [{ type: 'MOVE_OWNER_PAWN_IF_AT_PAWN', label: 'Le Satyre' }],
  },
  {
    id: 'maximus',
    name: 'Maximus',
    englishName: 'Maximus',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'À son arrivée, vous pouvez déplacer une carte Cavaliers du roi vers un lieu voisin, puis déplacer Maximus vers un lieu voisin.',
    onPlace: [{ type: 'MAXIMUS_RELOCATE' }],
    image: img('maximus.png'),
  },
  {
    id: 'pascal',
    name: 'Pascal',
    englishName: 'Pascal',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Raiponce est déplacée sur le lieu de Pascal, déplacez-la aussitôt d’un lieu vers Corona.',
    image: img('pascal.png'),
  },
  {
    id: 'ulf',
    name: 'Ulf',
    englishName: 'Ulf',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Tant qu’il est présent, aucun Allié ne peut quitter son lieu.',
    blocksAllyMoves: true,
    image: img('ulf.png'),
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objet (1)
  // ----------------------------------------------------------------------
  {
    id: 'poele-a-frire',
    name: 'Poêle à frire',
    englishName: 'Frying Pan',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    attachStrengthBonus: 1,
    copies: 1,
    text: 'Objet Fatalité associé à un Héros : +1 de force.',
    image: img('poele-a-frire.png'),
  },

  // ----------------------------------------------------------------------
  // HÉROS-TUILE — Raiponce (toujours dans le royaume ; hors deck → copies 0)
  // ----------------------------------------------------------------------
  {
    id: 'raiponce',
    name: 'Raiponce',
    englishName: 'Rapunzel',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 0,
    text: 'Héros imprimé sur une tuile. Commence sur la Tour, se déplace d’un lieu vers Corona à la fin du tour de Mère Gothel, et revient sur la Tour si elle est éliminée (jamais défaussée).',
    image: img('raiponce.png'),
  },
]
