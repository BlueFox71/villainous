// =============================================================================
// Scar (Le Roi Lion) — plateau (Realm). Vilain officiel. Difficulté 4 étoiles.
//
// Source : dossier assets/decks/Scar/ (images FR) + wiki Villainous FR.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Rocher des lions     haut: Gagner 2 · Jouer            bas: Jouer · Déplacer Objet/Allié
//   Savane               haut: Jouer · Fatalité            bas: Défausser · Gagner 1
//   Cimetière d'éléphants haut: Défausser · Jouer          bas: Jouer · Gagner 3
//   Gorge                haut: Déplacer Objet/Allié · Jouer bas: Éliminer · Fatalité
//
// Aucun lieu verrouillé : tout est interactif dès le début.
//
// Objectif : trouver et éliminer Mufasa (placé dans la pile SUCCESSION), puis y
// accumuler d'autres Héros pour atteindre une Force combinée ≥ 15. Victoire au
// début de son tour.
//
// Mécanique spéciale : la PILE SUCCESSION (placée comme la Pile de l'Au-delà de
// Dr Facilier). Quand Mufasa est éliminé, il y est placé ; tant qu'il y est, les
// Héros éliminés ensuite y sont aussi placés. Leur Force combinée détermine
// l'objectif. (Alimentation par les Vanquish : implémentée à l'étape suivante.)
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const scar: VillainDef = {
  id: 'scar',
  name: 'Scar',
  objective: { type: 'SUCCESSION_FORCE', firstHeroCardId: 'mufasa', minForce: 15 },
  boardObjective: 'Au début de votre tour, il doit y avoir au moins 15 points de force dans votre pile Succession.',
  objectiveDescription:
    'Trouvez et éliminez Mufasa, qui rejoint la pile Succession, puis éliminez ' +
    'd’autres Héros pour atteindre une Force combinée d’au moins 15 dans cette pile. ' +
    'Vous ne pouvez gagner qu’au début de votre tour.',
  boardImage: '/cards/scar/board.webp',
  pawnImage: '/pion_scar.png',
  pawnHeightPx: 100,
  backVillainImage: '/cards/scar/back-villain.webp',
  backFateImage: '/cards/scar/back-fate.webp',
  locations: [
    {
      id: 'rocher-lions',
      name: 'Rocher des lions',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'savane',
      name: 'Savane',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'cimetiere-elephants',
      name: 'Cimetière d’éléphants',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'gorge',
      name: 'Gorge',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
  ],
}
