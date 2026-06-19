// =============================================================================
// Cruella d'Enfer — plateau (Realm). Vilaine officielle (Disney, Les 101 Dalmatiens).
// 4 étoiles : mécanique inédite des TUILES CHIOTS. Cruella amène des Tuiles Chiots
// dans son royaume (depuis une réserve face cachée au-dessus du plateau) puis les
// CAPTURE jusqu'à atteindre au moins 99 Chiots. Victoire au début de son tour.
//
// 12 Tuiles Chiots : 3 par lieu (deux de 11 Chiots, une de 22).
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Maison des Radcliff  haut: Fatalité · Activer        bas: Éliminer · Jouer
//   Campagne             haut: Jouer · Déplacer          bas: Gagner 3 · Jouer
//   Laiterie             haut: Défausser · Gagner 1      bas: Jouer · Fatalité
//   Castel D'Enfer       haut: Déplacer · Activer        bas: Jouer · Gagner 1 · Défausser
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/cruella/${f}`

// 12 Tuiles Chiots : 2×11 + 1×22 par lieu.
const puppyTiles = ['maison-radcliff', 'campagne', 'laiterie', 'castel'].flatMap((loc) => [
  { value: 11, homeLocation: loc },
  { value: 11, homeLocation: loc },
  { value: 22, homeLocation: loc },
])

export const cruella: VillainDef = {
  id: 'cruella',
  name: 'Cruella d’Enfer',
  objective: { type: 'PUPPY_THRESHOLD', threshold: 99 },
  startingPuppyTiles: puppyTiles,
  objectiveDescription:
    'Amenez des Tuiles Chiots dans votre royaume (depuis la réserve), puis CAPTUREZ-les ' +
    'jusqu’à avoir au moins 99 Chiots capturés. Amenez des Chiots en activant Lampe ' +
    'électrique et Horace, ou en jouant Sans cœur et Ici, mes petits ! ; capturez-les en ' +
    'activant Horace et Jasper, et en jouant J’ai payé pour ça. Vous ne pouvez l’emporter ' +
    'qu’au début de votre tour.',
  boardImage: img('board.png'),
  pawnImage: '/pion_cruella.png',
  pawnHeightPx: 104,
  backVillainImage: img('back-fate.png'),
  backFateImage: img('back-villain.png'),
  locations: [
    {
      id: 'maison-radcliff',
      name: 'Maison des Radcliff',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'campagne',
      name: 'Campagne',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'laiterie',
      name: 'Laiterie',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'castel',
      name: 'Castel D’Enfer',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
      ],
    },
  ],
}
