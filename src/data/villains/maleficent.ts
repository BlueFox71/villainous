// =============================================================================
// Maléfique — plateau (Realm).
//
// Source de vérité : wiki officiel Disney Villainous
//   https://disney-villainous.fandom.com/wiki/Maleficent
//   (copie locale : assets/decks/Maléfique/wiki_reference.txt)
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Forbidden Mountains (Montagne Interdite)
//     haut: Déplacer un Allié/Objet · Jouer une carte
//     bas : Gagner 1 Pouvoir       · Fatalité
//
//   Briar Rose's Cottage (Maison dans les Bois)
//     haut: Gagner 2 Pouvoirs      · Déplacer un Allié/Objet
//     bas : Jouer une carte        · Défausser
//
//   The Forest (Forêt)
//     haut: Défausser              · Jouer une carte
//     bas : Gagner 3 Pouvoirs      · Jouer une carte
//
//   King Stefan's Castle (Château du Roi Stéphane)
//     haut: Gagner 1 Pouvoir       · Fatalité
//     bas : Éliminer un Héros      · Jouer une carte
//
// Objectif : avoir au moins une Malédiction sur chacun des 4 lieux au début
// de son tour. Les Malédictions sont posées sur un lieu, ont un effet passif,
// et chacune a sa propre condition de défausse.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const maleficent: VillainDef = {
  id: 'maleficent',
  name: 'Maléfique',
  objective: { type: 'CURSE_EACH_LOCATION' },
  objectiveDescription: 'Avoir au moins une Malédiction sur chacun des 4 lieux au début de son tour.',
  boardImage: '/cards/maleficent/board.png',
  pawnImage: '/pion_maleficent.png',
  pawnHeightPx: 78,
  backVillainImage: '/cards/maleficent/back_villain.png',
  backFateImage: '/cards/maleficent/back_fatality.png',
  locations: [
    {
      id: 'mountains',
      name: 'Montagne Interdite',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'cottage',
      name: 'Maison dans les Bois',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoirs' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'forest',
      name: 'Forêt',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoirs' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'castle',
      name: 'Château du Roi Stéphane',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
  ],
}
