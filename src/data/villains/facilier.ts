// =============================================================================
// Dr Facilier (La Princesse et la Grenouille) — plateau (Realm). Vilain officiel
// « Mauvais jusqu'à l'os ». Difficulté 2 étoiles.
//
// Source : dossier assets/decks/Facilier/ (images FR) + wiki Villainous FR.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Royaume du vaudou   haut: Gagner 1 · Fatalité     bas: Éliminer · Jouer
//   Parade              haut: Gagner 2 · Jouer         bas: Défausser · Déplacer Objet/Allié
//   Chez Tiana          haut: Défausser · Gagner 1     bas: Jouer · Fatalité
//   Bayou               haut: Déplacer Objet/Allié · Jouer   bas: Jouer · Gagner 3
//
// Objectif : jouer le Talisman et « Régner sur la Nouvelle-Orléans », détenir le
// Talisman, puis jouer Divination au Royaume du vaudou pour révéler « Régner sur
// la Nouvelle-Orléans » depuis la Pile de l'Au-delà.
//
// Mécanique spéciale : la PILE DE L'AU-DELÀ. Certaines cartes (Amis de l'au-delà,
// Régner) y vont quand elles sont jouées ; les adversaires y ajoutent des cartes
// via la Fatalité. Divination mélange la pile, en révèle 3 (2 avec Mama Odie) et
// résout leurs effets Au-delà dans l'ordre choisi par Facilier.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const facilier: VillainDef = {
  id: 'facilier',
  name: 'Dr Facilier',
  objective: { type: 'REIGN_NEW_ORLEANS' },
  boardObjective: 'Vous devez détenir le Talisman et parvenir à régner sur la Nouvelle-Orléans.',
  objectiveDescription:
    'Jouez le Talisman et « Régner sur la Nouvelle-Orléans », détenez le Talisman, ' +
    'puis jouez Divination au Royaume du vaudou pour révéler « Régner sur la ' +
    'Nouvelle-Orléans » depuis la Pile de l’Au-delà.',
  boardImage: '/cards/facilier/board.png',
  pawnImage: '/pion_facilier.png',
  pawnHeightPx: 104,
  backVillainImage: '/cards/facilier/back-villain.png',
  backFateImage: '/cards/facilier/back-fate.png',
  locations: [
    {
      id: 'royaume-vaudou',
      name: 'Royaume du vaudou',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'parade',
      name: 'Parade',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'chez-tiana',
      name: 'Chez Tiana',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'bayou',
      name: 'Bayou',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
  ],
}
