// =============================================================================
// Slenderman — plateau (Realm). Vilain « fan-made » (hors gamme officielle).
//
// Source : dossier assets/decks/Slenderman/ (Realm.png) + onglet SLENDERMAN du
// classeur Villainous_Template-Alexis_1_1.xlsx.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   La Forêt        haut: Déplacer un Allié/Objet · Gagner 1   bas: Jouer · Fatalité
//   Le Tunnel       haut: Jouer une carte        · Gagner 2    bas: Jouer · Défausser
//   La Mine         haut: Fatalité               · Jouer       bas: Jouer · Gagner 1
//   Maison Perdue   haut: Déplacer un Allié/Objet · Défausser  bas: Jouer · Gagner 2
//
// Objectif : au début de son tour, avoir les 8 Pages dans son royaume (chaque
// Page se pose sur un lieu — au plus 2 par lieu, soit 4 lieux × 2 = 8).
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const slenderman: VillainDef = {
  id: 'slenderman',
  name: 'Slenderman',
  objective: { type: 'CARDS_IN_REALM', cardId: 'page', count: 8 },
  boardObjective: 'Au début de votre tour, vous devez avoir les 8 pages dans votre royaume.',
  objectiveDescription: 'Au début de votre tour, avoir les 8 Pages dans votre royaume.',
  boardImage: '/cards/slenderman/board.png',
  pawnImage: '/pion_slenderman.png',
  pawnHeightPx: 84,
  backVillainImage: '/cards/slenderman/back_villain.png',
  backFateImage: '/cards/slenderman/back_fatality.png',
  locations: [
    {
      id: 'foret',
      name: 'La Forêt',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'tunnel',
      name: 'Le Tunnel',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'mine',
      name: 'La Mine',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'maison-perdue',
      name: 'Maison Perdue',
      actions: [
        { id: 'move-hero', type: 'MOVE_HERO', row: 'top', label: 'Déplacer un héros' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
