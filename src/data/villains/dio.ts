// =============================================================================
// Dio Brando (JoJo's Bizarre Adventure — Stardust Crusaders, collaboration 3★) —
// plateau (Realm).
//
// Texte FR = source de vérité (tableur Villainous_Template, feuille « DIO BRANDO »).
//
// Disposition des 4 lieux (gauche → droite), 2 rangées (haut / bas), lue sur la
// planche assets/decks/Dio brando/Plateau.png :
//
//   Le Manoir   | haut: Fatalité · Gagner 1   | bas: Jouer · Activer
//   Le Caire    | haut: Jouer · Jouer         | bas: Défausser · Gagner 3
//   Singapour   | haut: Défausser · Jouer      | bas: Activer · Fatalité
//   Tokyo       | haut: Déplacer un Héros · Jouer | bas: Éliminer · Gagner 2
//
// OBJECTIF (3★) : retirer du jeu la famille Joestar (Jotaro + Joseph) ET effectuer
// TOUTES les actions hors-Fatalité de son royaume (14 cases) dans un MÊME tour —
// rendu possible par ZA WARUDO!.
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/dio/${f}`

export const dio: VillainDef = {
  id: 'dio',
  name: 'Dio Brando',
  objective: { type: 'DIO_ALL_ACTIONS', joestarCardIds: ['jotaro-kujo', 'joseph-joestar'] },
  boardObjective:
    'Retirez du jeu la famille Joestar (Jotaro et Joseph), puis effectuez toutes les ' +
    'actions de votre royaume (hors Fatalité) au cours d’un même tour.',
  objectiveDescription:
    'Double objectif : (1) éliminer Jotaro Kujo ET Joseph Joestar (qui quittent la ' +
    'partie quand ils sont vaincus) ; (2) effectuer, dans un seul tour, les 14 actions ' +
    'hors-Fatalité des 4 lieux — possible grâce à ZA WARUDO! (qui ouvre les actions de ' +
    'n’importe quel lieu, à un coût croissant).',
  boardImage: img('board.png'),
  // Pion : placeholder Prince Jean en attendant un pion dédié à Dio.
  pawnImage: '/pion_prince_jean.png',
  pawnHeightPx: 56,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  locations: [
    {
      id: 'manoir',
      name: 'Le Manoir',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
      ],
    },
    {
      id: 'le-caire',
      name: 'Le Caire',
      actions: [
        { id: 'play-card-top-1', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-top-2', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'singapour',
      name: 'Singapour',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'tokyo',
      name: 'Tokyo',
      actions: [
        { id: 'move-hero', type: 'MOVE_HERO', row: 'top', label: 'Déplacer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
