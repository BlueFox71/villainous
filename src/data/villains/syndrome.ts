// =============================================================================
// Syndrome (Les Indestructibles, Disney/Pixar) — 3 ★.
// Objectif : ÉLIMINER l'Omnidroïde v.10 (via la Télécommande activée à son lieu)
// et n'avoir aucun Héros dans son royaume (DEFEAT_OMNIDROID_V10).
//
// Mécanique : l'Omnidroïde (tuile hors deck) progresse v.X8 → v.X9 → v.10 en
// participant à des actions « Éliminer un Héros » et en défaussant des
// MODIFICATIONS MAJEURES. v.X8 débute sur l'Île de Nomanisan (cf. omnidroidSetup,
// résolu par createInitialGame).
//
// Disposition (4 lieux, gauche → droite ; 2 actions HAUT + 2 BAS par lieu) :
//   Maison des Parr    haut: Jouer · Fatalité        bas: Vaincre · Gagner 1
//   Île de Nomanisan   haut: Gagner 2 · Jouer        bas: Défausser · Jouer
//   Base de Syndrome   haut: Jouer · Vaincre         bas: Jouer · Déplacer Objet/Allié
//   Métroville         haut: Défausser · Jouer       bas: Fatalité · Gagner 3
// (Il n'y a PAS d'action « Activer » imprimée : la Télécommande de Syndrome AJOUTE
//  l'action « Activer » au lieu où elle est posée — cf. grantsAction.)
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/syndrome/${f}`

export const syndrome: VillainDef = {
  id: 'syndrome',
  name: 'Syndrome',
  objective: { type: 'DEFEAT_OMNIDROID_V10' },
  boardObjective: 'Vous devez éliminer l’Omnidroïde v.10 et n’avoir aucun Héros dans votre royaume.',
  objectiveDescription:
    'Éliminez l’Omnidroïde v.10 et n’ayez aucun Héros dans votre royaume. Faites participer ' +
    'l’Omnidroïde v.X8 à des actions « Éliminer un Héros » pour le faire évoluer (v.X8 → v.X9 → v.10) ' +
    'en défaussant des Modifications Majeures, jusqu’à le poser sur Métroville. Récupérez la ' +
    'Télécommande de Syndrome, posez-la sur Métroville, puis activez-la (votre pion ET l’Omnidroïde ' +
    'v.10 sur place) pour le détruire.',
  boardImage: img('board.webp'),
  pawnImage: '/pion_syndrome.png',
  pawnHeightPx: 104,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  // L'Omnidroïde v.X8 débute sur l'Île de Nomanisan (le repaire). v.X9 puis v.10
  // forment la pile (jouées en défaussant des Modifications Majeures).
  omnidroidSetup: {
    startLocation: 'ile-nomanisan',
    stages: [
      { cardId: 'omnidroide-v-x8', name: 'Omnidroïde v.X8', strength: 5, stage: 'x8' },
      { cardId: 'omnidroide-v-x9', name: 'Omnidroïde v.X9', strength: 6, stage: 'x9', upgradeCost: 1 },
      {
        cardId: 'omnidroide-v-x10',
        name: 'Omnidroïde v.10',
        strength: 7,
        stage: 'x10',
        upgradeCost: 3,
        forceLocation: 'metroville',
      },
    ],
  },
  locations: [
    {
      id: 'maison-des-parr',
      name: 'Maison des Parr',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'ile-nomanisan',
      name: 'Île de Nomanisan',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'base-syndrome',
      name: 'Base de Syndrome',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'top', label: 'Éliminer un héros' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'metroville',
      name: 'Métroville',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
  ],
}
