// =============================================================================
// Capitaine Crochet (Peter Pan) — plateau (Realm). Vilain officiel
// « Evil Comes Prepared ». Difficulté 3 étoiles.
//
// Source : dossier assets/decks/Crochet/ (images FR) — transcription complète
// dans assets/decks/Crochet/crochet_reference.md.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Jolly Roger          haut: Gagner 1 · Défausser          bas: Vaincre · Jouer
//   Rocher du Crâne      haut: Gagner 1 · Jouer              bas: Fatalité · Défausser
//   Lagune aux Sirènes   haut: Jouer · Déplacer objet/allié   bas: Gagner 3 · Jouer
//   Arbre du Pendu       haut: Fatalité · Gagner 2           bas: Déplacer un Héros · Jouer
//   (l'Arbre du Pendu démarre VERROUILLÉ — voir lockedLocationsAtStart)
//
// Objectif : éliminer Peter Pan sur le Jolly Roger (et nulle part ailleurs).
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const crochet: VillainDef = {
  id: 'crochet',
  name: 'Capitaine Crochet',
  objective: {
    type: 'DEFEAT_HERO_AT_LOCATION',
    heroCardId: 'peter-pan',
    locationId: 'jolly-roger',
  },
  objectiveDescription: 'Éliminez Peter Pan sur le Jolly Roger (l’éliminer ailleurs ne compte pas).',
  boardImage: '/cards/crochet/board.png',
  pawnImage: '/pion_crochet.png',
  pawnHeightPx: 80,
  backVillainImage: '/cards/crochet/back_villain.png',
  backFateImage: '/cards/crochet/back_fate.png',
  // L'Arbre du Pendu démarre verrouillé (Cadenas) ; la Carte du Pays Imaginaire
  // le déverrouille (UNLOCK_LOCATION).
  lockedLocationsAtStart: ['arbre-pendu'],
  locations: [
    {
      id: 'jolly-roger',
      name: 'Jolly Roger',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'rocher-crane',
      name: 'Rocher du Crâne',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'lagune-sirenes',
      name: 'Lagune aux Sirènes',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'arbre-pendu',
      name: 'Arbre du Pendu',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'bottom', label: 'Déplacer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
  ],
}
