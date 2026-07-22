// =============================================================================
// L'Imposteur (Among Us) — plateau (Realm). Collaboration FAN, difficulté 4★.
//
// Source : dossier assets/decks/L'imposteur/ + onglet « L'IMPOSTEUR » du
// classeur Villainous_Template-Alexis_1_1.xlsx.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Electrical   haut: Fatalité · Jouer            bas: Gagner 2 · Activer
//   Réacteur     haut: Déplacer Objet/Allié · Gagner 1   bas: Jouer · Défausser
//   Admin        haut: Jouer · Activer             bas: Jouer · Gagner 3
//   Cafétaria    haut: Gagner 2 · Défausser        bas: Fatalité · Jouer
//
// Objectif : conserver un SABOTAGE (Objet O2 ou Réacteur) posé pendant 3 tours.
//
// MÉCANIQUE CENTRALE (à venir) — les COÉQUIPIERS : 8 pions neutres posés sur les
// 8 actions du HAUT. À la fin du tour ils se déplacent obligatoirement, case par
// case, selon une liste de priorité (sabotage > tâche > suspicion). Un coéquipier
// « suspect » recouvre l'action sous lui ; « normal » il ne recouvre rien. Voir
// l'implémentation moteur (étape suivante).
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const imposteur: VillainDef = {
  id: 'imposteur',
  name: "L'Imposteur",
  objective: { type: 'KEEP_SABOTAGE', turns: 3 },
  boardObjective: 'Saboter le SKELD.',
  objectiveDescription:
    'Jouez un Sabotage (O2 à Admin, Réacteur au Réacteur) et conservez-le posé ' +
    'dans votre royaume pendant 3 tours sans qu’il soit défaussé.',
  boardImage: '/cards/imposteur/board.webp',
  pawnImage: '/pion_imposteur.png',
  pawnHeightPx: 96,
  backVillainImage: '/cards/imposteur/back-villain.webp',
  backFateImage: '/cards/imposteur/back-fate.webp',
  locations: [
    {
      id: 'electrical',
      name: 'Electrical',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
      ],
    },
    {
      id: 'reacteur',
      name: 'Réacteur',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'admin',
      name: 'Admin',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'cafeteria',
      name: 'Cafétaria',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
  ],
}
