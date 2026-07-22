// =============================================================================
// Ursula (La Petite Sirène) — plateau (Realm). Vilain officiel. Difficulté 5★.
//
// Source : dossier assets/decks/Ursula/ (images FR) — transcription complète
// dans assets/decks/Ursula/ursula_reference.md.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Repaire d'Ursula      haut: Gagner 1 · Activer            bas: Déplacer objet/allié · Jouer
//   Navire du Prince Éric haut: Gagner 1 · Jouer              bas: Fatalité · Défausser
//   Rivage                haut: Jouer · Défausser             bas: Gagner 3 · Jouer
//   Palais                haut: Déplacer objet/allié · Fatalité bas: Déplacer un Héros · Gagner 2
//   (le Palais démarre BLOQUÉ ; le Cadenas se déplace entre Palais et Repaire)
//
// Objectif : au début de votre tour, avoir le Trident ET la Couronne au Repaire.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const ursula: VillainDef = {
  id: 'ursula',
  name: 'Ursula',
  objective: {
    type: 'ITEMS_AT_LOCATION',
    itemCardIds: ['trident', 'couronne'],
    locationId: 'repaire',
  },
  boardObjective: 'Au début de votre tour, le TRIDENT et la COURONNE doivent se trouver au repaire d’Ursula.',
  objectiveDescription: 'Au début de votre tour, avoir le Trident et la Couronne au Repaire d’Ursula.',
  boardImage: '/cards/ursula/board.webp',
  pawnImage: '/pion_ursula.png',
  pawnHeightPx: 80,
  backVillainImage: '/cards/ursula/back_villain.webp',
  backFateImage: '/cards/ursula/back_fate.webp',
  // Le Palais démarre bloqué ; le Cadenas se déplace ensuite entre Palais et
  // Repaire (Métamorphose, Grimsby).
  lockedLocationsAtStart: ['palais'],
  locations: [
    {
      id: 'repaire',
      name: "Repaire d'Ursula",
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'navire',
      name: 'Navire du Prince Éric',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'rivage',
      name: 'Rivage',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'palais',
      name: 'Palais',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'bottom', label: 'Déplacer un héros' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
