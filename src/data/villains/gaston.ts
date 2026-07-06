// =============================================================================
// Gaston — plateau (Realm). Vilain officiel (Disney, La Belle et la Bête).
// 1 étoile : mécanique inédite des JETONS OBSTACLE. Gaston démarre avec 8 jetons
// Obstacle posés sur son plateau (2 par lieu, sur des emplacements marqués) et doit
// les RETIRER tous. Il les retire via des Effets/Conditions (Très mauvais caractère,
// Aussi belle que moi…), en activant Monsieur D'Arque, ou en vainquant la Bête /
// Maurice. Belle, tant qu'elle est dans le royaume, empêche TOUT retrait. Les cartes
// Fatalité (et Sous le charme) peuvent au contraire REPLACER des Obstacles.
// Victoire au début de son tour quand les 8 Obstacles ont disparu.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Maison de Belle      haut: Éliminer · Jouer        bas: Défausser · Gagner 1
//   Taverne              haut: Activer · Gagner 2       bas: Jouer · Éliminer
//   Bois                 haut: Jouer · Défausser        bas: Fatalité · Gagner 2
//   Château de la Bête   haut: Jouer · Fatalité         bas: Jouer · Gagner 1
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/gaston/${f}`

export const gaston: VillainDef = {
  id: 'gaston',
  name: 'Gaston',
  objective: { type: 'REMOVE_ALL_OBSTACLES' },
  // 8 Obstacles : 2 sur chacun des 4 lieux à la mise en place.
  startingObstacles: 2,
  boardObjective: 'Vous devez retirer les 8 jetons Obstacle de votre royaume.',
  objectiveDescription:
    'Retirez les 8 jetons Obstacle de votre plateau (2 par lieu au départ). Retirez-les ' +
    'avec des Effets/Conditions (Crise de colère, Sortez !, Laissez-moi vous regarder, ' +
    'Digne de moi…), en activant Monsieur D’Arque, ou en vainquant la Bête (retire ceux ' +
    'du Château de la Bête) ou Maurice (ceux de la Maison de Belle). Tant que Belle est dans ' +
    'votre royaume, AUCUN Obstacle ne peut être retiré : il faut d’abord la vaincre. Vous ne ' +
    'pouvez l’emporter qu’au début de votre tour.',
  boardImage: img('board.png'),
  pawnImage: '/pion_gaston.png',
  pawnHeightPx: 104,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  locations: [
    {
      id: 'maison-belle',
      name: 'Maison de Belle',
      actions: [
        { id: 'vanquish', type: 'VANQUISH', row: 'top', label: 'Éliminer un héros' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'taverne',
      name: 'Taverne',
      actions: [
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
    {
      id: 'bois',
      name: 'Forêt',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
    {
      id: 'chateau-bete',
      name: 'Château de la Bête',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
  ],
}
