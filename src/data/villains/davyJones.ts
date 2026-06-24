// =============================================================================
// Davy Jones — plateau (Realm). Vilain Disney (Pirates des Caraïbes), 3★.
//
// Source : assets/decks/Davy Jones/ (Plateau.png, faces découpées des planches).
//
// MÉCANIQUE CENTRALE INÉDITE : les JETONS TRÉSOR. Cinq jetons uniques (Compas de
// Jack, Boîte à Musique, La Clé, Coffre au Trésor, Le Cœur) démarrent mélangés FACE
// CACHÉE dans une réserve. Davy les POSE face cachée sur des Héros (As-tu peur de la
// mort ?, Ils sont là), les RÉVÈLE (Bill le Bottier, Hadras, La Marque Noire) — face
// visible ils le GÊNENT — puis VAINC le Héros pour RÉCUPÉRER définitivement le trésor.
// Un Héros ne porte qu'UN trésor à la fois.
//
// OBJECTIF : récupérer les 5 jetons Trésor (victoire ÉVÉNEMENTIELLE au 5ᵉ Vanquish
// d'un Héros portant un trésor révélé).
//
// Disposition (4 lieux, gauche → droite) ; le haut = rangée recouvrable par un Héros :
//   Le Hollandais Volant     haut: Jouer · Fatalité        bas: Gagner 1 · Vaincre
//   Sous le Pont             haut: Gagner 2 · Jouer         bas: Défausser · Jouer
//   Les Quartiers de D. Jones haut: Déplacer Obj/Allié · Jouer  bas: Jouer · Gagner 3
//   Les Hauts-Fonds          haut: Défausser · Déplacer Obj/Allié  bas: Fatalité · Jouer
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/davy-jones/${f}`

export const davyJones: VillainDef = {
  id: 'davy-jones',
  name: 'Davy Jones',
  // Victoire événementielle : récupérer les 5 jetons Trésor.
  objective: { type: 'CLAIM_ALL_TREASURES', count: 5 },
  boardObjective: 'Vous devez récupérer les 5 jetons Trésor.',
  objectiveDescription:
    "RÉCUPÉREZ les 5 jetons Trésor. Posez-les FACE CACHÉE sur des Héros (As-tu peur de " +
    "la mort ?, Ils sont là), RÉVÉLEZ-les (Bill le Bottier, Hadras, La Marque Noire), " +
    "puis ÉLIMINEZ le Héros qui porte un trésor RÉVÉLÉ pour vous en emparer. Un Héros ne " +
    "porte qu'un trésor à la fois.",
  boardImage: img('board.png'),
  pawnImage: '/pion_davy-jones.png',
  pawnHeightPx: 96,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  locations: [
    {
      id: 'hollandais-volant',
      name: 'Le Hollandais Volant',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un Héros' },
      ],
    },
    {
      id: 'sous-le-pont',
      name: 'Sous le Pont',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'quartiers-davy-jones',
      name: 'Les Quartiers de Davy Jones',
      actions: [
        { id: 'move', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un Objet ou un Allié' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'hauts-fonds',
      name: "Les Hauts-Fonds de l'Île aux Épaves",
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'move', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un Objet ou un Allié' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
  ],
}
