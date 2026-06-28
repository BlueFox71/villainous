// =============================================================================
// Prince Jean (Robin des Bois) — plateau (Realm).
//
// Source de vérité : wiki officiel Disney Villainous
//   https://disney-villainous.fandom.com/wiki/Prince_John
//   (copie locale : assets/decks/Prince Jean/wiki_reference.txt)
//
// Disposition réelle des 4 lieux (de gauche à droite), 2 rangées d'actions
// (haut / bas), chaque rangée listée de gauche à droite :
//
//   Forêt de Sherwood    | haut: Gagner 1 · Défausser   | bas: Jouer · Fatalité
//   Église du Frère Tuck | haut: Gagner 2 · Jouer       | bas: Jouer · Déplacer objet/allié
//   Nottingham           | haut: Fatalité · Gagner 1    | bas: Éliminer · Jouer
//   La Prison            | haut: (vide)                 | bas: Gagner 3 · Jouer · Défausser
//
// ⚠️ Correction vs Étape 1 : Nottingham donne 1 (pas 3) et la Prison donne 3
// (pas 0). La rangée du HAUT de la Prison est vide → meilleur lieu du Prince
// Jean (rien à recouvrir par un héros).
//
// PÉRIMÈTRE ACTUEL : le moteur n'exécute encore que GAIN_POWER (voir
// EXECUTABLE_ACTION_TYPES dans engine/rules.ts). Les autres actions sont déjà
// présentes dans les données pour que les étapes suivantes n'aient qu'à les
// activer, sans retoucher le plateau.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const princeJohn: VillainDef = {
  id: 'princeJohn',
  name: 'Prince Jean',
  objective: { type: 'POWER_THRESHOLD', threshold: 20 },
  boardObjective: 'Au début de votre tour, vous devez posséder au moins 20 jetons Pouvoir.',
  objectiveDescription: 'Avoir 20 points de pouvoir au début de son tour.',
  boardImage: '/cards/prince-jean/board.png',
  pawnImage: '/pion_prince_jean.png',
  pawnHeightPx: 72,
  backVillainImage: '/cards/prince-jean/back_villain.png',
  backFateImage: '/cards/prince-jean/back_fatality.png',
  locations: [
    {
      id: 'sherwood',
      name: 'Forêt de Sherwood',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'church',
      name: 'Église du Frère Tuck',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'nottingham',
      name: 'Nottingham',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'jail',
      name: 'La Prison',
      // Rangée du haut volontairement vide (cf. plateau officiel).
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
  ],
}
