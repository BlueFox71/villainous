// =============================================================================
// Jafar (Aladdin) — plateau (Realm). Vilain officiel « Evil Comes Prepared ».
//
// Source : dossier assets/decks/Jafar/ (images FR) — transcription complète
// dans assets/decks/Jafar/jafar_reference.md.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Palais du Sultan      haut: Jouer · Activer            bas: Vaincre · Fatalité
//   Rues d'Agrabah        haut: Gagner 1 · Fatalité        bas: Défausser · Jouer
//   Oasis                 haut: Activer · Jouer            bas: Gagner 3 · Jouer
//   Caverne aux Merveilles haut: Défausser · Gagner 2      bas: Jouer · Déplacer objet/allié
//   (la Caverne aux Merveilles démarre VERROUILLÉE — voir lockedLocations)
//
// Objectif : au début de votre tour, contrôler le GÉNIE (hypnotisé) et avoir la
// LAMPE MERVEILLEUSE posée au Palais du Sultan.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const jafar: VillainDef = {
  id: 'jafar',
  name: 'Jafar',
  objective: {
    type: 'CONTROL_HERO',
    heroCardId: 'genie',
    itemCardId: 'lampe-merveilleuse',
    itemLocationId: 'palais',
  },
  boardObjective: 'Au début de votre tour, la LAMPE MERVEILLEUSE doit se trouver au Palais du Sultan et le GÉNIE doit être sous HYPNOSE.',
  objectiveDescription:
    'Au début de votre tour, contrôler le Génie (hypnotisé) et avoir la Lampe Merveilleuse au Palais du Sultan.',
  boardImage: '/cards/jafar/board.png',
  pawnImage: '/pion_jafar.png',
  pawnHeightPx: 76,
  backVillainImage: '/cards/jafar/back_villain.png',
  backFateImage: '/cards/jafar/back_fate.png',
  // La Caverne aux Merveilles démarre verrouillée (Cadenas) ; le Scarabée d'Or
  // la déverrouille (UNLOCK_LOCATION).
  lockedLocationsAtStart: ['caverne'],
  locations: [
    {
      id: 'palais',
      name: 'Palais du Sultan',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'rues',
      name: "Rues d'Agrabah",
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'oasis',
      name: 'Oasis',
      actions: [
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'caverne',
      name: 'Caverne aux Merveilles',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
  ],
}
