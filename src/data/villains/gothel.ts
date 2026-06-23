// =============================================================================
// Mère Gothel — plateau (Realm). Vilaine officielle (Disney, Raiponce / Tangled).
// 5 étoiles : mécanique inédite de CONFIANCE (ressource accumulée au-dessus du
// plateau) + le Héros Raiponce, toujours présent dans son royaume sur une tuile.
//
// Source : images FR du dossier assets/decks/Mère Gothel/ (plateau + cartes).
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Tour              haut: Déplacer · Fatalité     bas: Jouer · Éliminer
//   Le Canard boiteux haut: Jouer                   bas: Gagner 3 · Jouer · Défausser
//   Forêt             haut: Jouer                   bas: Gagner 2 · Jouer · Déplacer
//   Corona            haut: Gagner 1 · Défausser     bas: Jouer · Fatalité
//
// OBJECTIF (mécanique CONFIANCE — câblage moteur en Phase 2) : accumuler au moins
// 10 jetons Confiance ; la victoire ne peut survenir QU'AU DÉBUT de son tour.
// NOTE : tant que la ressource Confiance n'est pas branchée dans le moteur, on
// utilise un objectif POWER_THRESHOLD provisoire (seuil 10) pour rester jouable.
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/gothel/${f}`

export const gothel: VillainDef = {
  id: 'gothel',
  name: 'Mère Gothel',
  objective: { type: 'CONFIANCE_THRESHOLD', threshold: 10 },
  // Raiponce : Héros-tuile toujours présent, posé sur la Tour à la mise en place.
  startingHeroTile: { cardId: 'raiponce', name: 'Raiponce', strength: 4, locationId: 'tour' },
  boardObjective: 'Au début de votre tour, vous devez posséder au moins 10 jetons Confiance.',
  objectiveDescription:
    'Accumulez au moins 10 jetons Confiance. Vous gagnez de la Confiance en ' +
    'déplaçant Raiponce sur la Tour, en éliminant des Héros, en déplaçant la ' +
    'Brosse à cheveux, et par d’autres capacités. Vous ne pouvez l’emporter ' +
    'qu’au début de votre tour. Raiponce commence sur la Tour et se déplace d’un ' +
    'lieu vers la droite à la fin de chacun de vos tours ; éliminée, elle revient ' +
    'sur la Tour au lieu d’être défaussée.',
  boardImage: img('board.png'),
  pawnImage: '/pion_gothel.png',
  pawnHeightPx: 100,
  backVillainImage: img('back-fate.png'),
  backFateImage: img('back-villain.png'),
  locations: [
    {
      id: 'tour',
      name: 'Tour',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
    {
      id: 'canard-boiteux',
      name: 'Le Canard boiteux',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'foret',
      name: 'Forêt',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'corona',
      name: 'Corona',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
  ],
}
