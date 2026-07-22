// =============================================================================
// Lotso (Toy Story 3, Disney/Pixar) — 4 ★.
// Objectif : réduire la force des 4 Héros (Bayonne/Hamm, Jessie, Rex, Woody) à 0 ET
// les réunir sur la SALLE DES CHENILLES, avec BUZZ L'ÉCLAIR (n'importe quelle face)
// sur ce même lieu (LOTSO_GATHER).
//
// Mécanique : quand Lotso ÉLIMINE un Héros, il n'est PAS défaussé — il RESTE où il est,
// force réduite à 0 (les Alliés utilisés sont défaussés). La capacité d'un Héros à
// force 0 est ignorée. Lotso réduit aussi les Héros via des jetons Force −1 (cartes) et
// les déplace vers la Salle des Chenilles. La tuile BUZZ (Gardien / Mode Démo) débute
// sur la Salle des Chenilles (cf. guardianSetup).
//
// Disposition (4 lieux) :
//   Salle des Chenilles  (objectif) : Défausser · Jouer · Gagner 1   (3 actions, pas de haut)
//   Bibliothèque         haut: Fatalité · Gagner 2   bas: Jouer · Activer une capacité
//   Cour de Récréation   haut: Jouer · Défausser      bas: Fatalité · Gagner 3
//   Décharge Municipale  haut: Jouer · Vaincre        bas: Jouer · Déplacer Objet/Allié
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/lotso/${f}`

export const lotso: VillainDef = {
  id: 'lotso',
  name: 'Lotso',
  objective: {
    type: 'LOTSO_GATHER',
    roomId: 'salle-des-chenilles',
    heroCardIds: ['bayonne', 'jessie', 'rex', 'woody'],
  },
  boardObjective:
    'Vous devez réunir 4 Héros de force 0 et Buzz l’Éclair dans la Salle des Chenilles.',
  objectiveDescription:
    'Faites venir les 4 Héros (Hamm, Jessie, Rex, Woody), réduisez leur force à 0 (en les éliminant — ' +
    'ils restent alors sur place à 0 — ou avec des jetons Force −1) et réunissez-les TOUS sur la Salle ' +
    'des Chenilles, où doit aussi se trouver Buzz l’Éclair (Gardien ou Mode Démo).',
  boardImage: img('board.webp'),
  pawnImage: '/pion_lotso.png',
  pawnHeightPx: 96,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  // Buzz l'Éclair (tuile Gardien à deux faces) débute sur la Salle des Chenilles.
  guardianSetup: { cardId: 'buzz-l-eclair', name: 'Buzz l’Éclair', locationId: 'salle-des-chenilles', strength: 4 },
  locations: [
    {
      id: 'salle-des-chenilles',
      name: 'Salle des Chenilles',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'bibliotheque',
      name: 'Bibliothèque',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
      ],
    },
    {
      id: 'cour-de-recreation',
      name: 'Cour de Récréation',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'decharge-municipale',
      name: 'Décharge Municipale',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'top', label: 'Éliminer un héros' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
  ],
}
