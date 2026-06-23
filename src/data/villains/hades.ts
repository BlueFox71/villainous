// =============================================================================
// Hadès (Hercule) — plateau (Realm). Vilain officiel « Wicked to the Core ».
// Difficulté 3 étoiles.
//
// Source : dossier assets/decks/Hadès/ (images FR) + wiki Villainous.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Les Enfers     haut: Jouer · Gagner 2        bas: Éliminer · Déplacer Objet/Allié
//   Thèbes         haut: Gagner 1 · Jouer        bas: Fatalité · Défausser
//   Jardins        haut: Défausser · Jouer       bas: Gagner 3 · Jouer
//   Mont Olympe    haut: Fatalité · Déplacer Objet/Allié   bas: Jouer · Gagner 1
//
// Objectif : avoir au moins 3 Titans NON entravés sur le Mont Olympe au début de
// son tour. Les Titans (Lythos, Hydros, Pyros, Stratos, Argès) sont joués sur Les
// Enfers puis amenés vers le Mont Olympe : GRATUITEMENT (1 lieu voisin) via
// l'action « Déplacer un Objet ou un Allié », ou en PAYANT via « Préparez-vous au
// combat ! » (2 JT pour 1 lieu, 5 JT pour 2). Les Héros (Hercule, Zeus, Héra,
// Éclairs…) peuvent les ENTRAVER en chemin.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const hades: VillainDef = {
  id: 'hades',
  name: 'Hadès',
  objective: {
    type: 'UNTRAPPED_TITANS_AT_LOCATION',
    locationId: 'mont-olympe',
    count: 3,
  },
  boardObjective: 'Au début de votre tour, il doit y avoir au moins trois Titans sur le Mont Olympe.',
  objectiveDescription:
    'Ayez au moins 3 Titans non entravés sur le Mont Olympe au début de votre tour.',
  boardImage: '/cards/hades/board.png',
  pawnImage: '/pion_hades.png',
  pawnHeightPx: 92,
  backVillainImage: '/cards/hades/back_villain.png',
  backFateImage: '/cards/hades/back_fate.png',
  locations: [
    {
      id: 'enfers',
      name: 'Les Enfers',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'thebes',
      name: 'Thèbes',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'jardins',
      name: 'Jardins',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'mont-olympe',
      name: 'Mont Olympe',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
  ],
}
