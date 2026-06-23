// =============================================================================
// Madame Mim (Merlin l'Enchanteur, Disney) — 1 ★.
// Objectif : vaincre les 7 Métamorphoses de Merlin (DEFEAT_ALL_MERLIN).
// Mécanique : Métamorphoses (cf. madameMim.cards.ts). Deux pioches Fatalité
// (traditionnelle + Merlin) — la séparation est faite par createInitialGame.
//
// Disposition (4 lieux, gauche → droite) — 1 action HAUT + 3 BAS par lieu ; le
// Lieu du Duel a le HAUT vide (la Métamorphose de Merlin « Héros » y trône) :
//   Forêt                haut: Gagner 2          bas: Jouer · Fatalité · Déplacer Objet/Allié
//   Cabane de Madame Mim haut: Jouer             bas: Gagner 2 · Déplacer Objet/Allié · Déplacer un Héros
//   Lieu du Duel         haut: —                 bas: Gagner 1 · Défausser · Fatalité
//   Marais               haut: Jouer             bas: Gagner 1 · Jouer · Défausser
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/madame-mim/${f}`

export const madameMim: VillainDef = {
  id: 'madame-mim',
  name: 'Madame Mim',
  objective: { type: 'DEFEAT_ALL_MERLIN' },
  boardObjective: 'Vous devez éliminer toutes les Métamorphoses de Merlin.',
  objectiveDescription:
    'Vainquez les 7 Métamorphoses de Merlin. Une Métamorphose de Merlin trône au Lieu du Duel ; ' +
    'vainquez-la avec la Métamorphose Mim correspondante (chaque Mim ne vainc qu’un Merlin précis), ' +
    'ou jouez « J’établis les règles ». À chaque Merlin vaincu, un autre apparaît — jusqu’à les avoir tous vaincus.',
  boardImage: img('board.png'),
  pawnImage: '/pion_madame-mim.png',
  pawnHeightPx: 96,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  locations: [
    {
      id: 'the-woods',
      name: 'Forêt',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'cabane',
      name: 'Cabane de Madame Mim',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'bottom', label: 'Déplacer un héros' },
      ],
    },
    {
      id: 'lieu-duel',
      name: 'Lieu du Duel',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'marais',
      name: 'Marais',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
      ],
    },
  ],
}
