// =============================================================================
// Reine de Cœur (Alice au pays des merveilles) — plateau (Realm). Vilain officiel.
//
// Source : dossier assets/decks/Reine des coeurs/ (images FR) — transcription
// complète dans assets/decks/Reine des coeurs/reine_coeur_reference.md.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Cour intérieure du palais  haut: Défausser · Déplacer objet/allié  bas: Gagner 2 · Jouer
//   Labyrinthe                 haut: Jouer · Activer                   bas: Gagner 3 · Jouer
//   Forêt de Tulgey            haut: Fatalité · Jouer                  bas: Défausser · Vaincre
//   Maison du Lapin Blanc      haut: Jouer · Gagner 1                  bas: Activer · Fatalité
//
// Objectif : placer un arceau (Carte Garde transformée) sur chaque lieu et
// réussir un Coup Royal (mécanique croquet — implémentation à venir).
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const reineCoeur: VillainDef = {
  id: 'reineCoeur',
  name: 'Reine de Cœur',
  objective: { type: 'ROYAL_CROQUET' },
  boardObjective: 'Placez un arceau dans chaque lieu et réussissez un COUP ROYAL.',
  objectiveDescription: 'Placez un arceau dans chaque lieu et réussissez un Coup Royal.',
  boardImage: '/cards/reine-coeur/board.png',
  pawnImage: '/pion_reine_coeur.png',
  pawnHeightPx: 76,
  backVillainImage: '/cards/reine-coeur/back_villain.png',
  backFateImage: '/cards/reine-coeur/back_fate.png',
  locations: [
    {
      id: 'cour-palais',
      name: 'Cour intérieure du palais',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'labyrinthe',
      name: 'Labyrinthe',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'foret-tulgey',
      name: 'Forêt de Tulgey',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
    {
      id: 'maison-lapin',
      name: 'Maison du Lapin Blanc',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
  ],
}
