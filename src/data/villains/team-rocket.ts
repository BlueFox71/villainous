// =============================================================================
// Team Rocket — plateau (Realm). Vilain fan-made (Pokémon, série animée).
//
// Source : assets/decks/Team Rocket/ (Realm.png, faces). Règles tirées du tableur
// « Villainous Template_Jules.ods », onglet Team_Rocket.
//
// MÉCANIQUE CENTRALE INÉDITE : ATTRAPER UN POKÉMON. Les Pokémon arrivent par la
// Fatalité (un dresseur-Héros — Sacha/Ondine/Pierre — invoque son Pokémon, posé
// comme un Héros sur le même lieu). L'action « Attraper » (CATCH_POKEMON, icône
// Pokéball) fonctionne comme un Vanquish mais cible un POKÉMON présent : il rejoint
// la PILE DE CAPTURES (PlayerState.capturedPokemon) au lieu de la défausse. L'action
// « Vaincre » (icône nuage-éclair) cible les Héros classiques (les dresseurs).
// → mécanique Attraper + pile de Captures implémentées en phase 2.
//
// OBJECTIF : au début de son tour, avoir au moins 4 Pokémon DONT PIKACHU dans la
// pile de Captures.
//
// Disposition (4 lieux, gauche → droite) :
//   Laboratoire du Pr Chen  haut: Vaincre · Jouer          bas: Gagner 1 · Déplacer objet/allié · Attraper
//   Forêt                   haut: Jouer · Fatalité          bas: Gagner 3 · Jouer
//   Centre Pokémon          haut: Jouer · Jouer             bas: Déplacer objet/allié · Vaincre
//   Arène                   haut: Jouer · Gagner 2          bas: Vaincre · Fatalité
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/team-rocket/${f}`

export const teamRocket: VillainDef = {
  id: 'team-rocket',
  name: 'Team Rocket',
  objective: { type: 'CAPTURE_POKEMON', count: 4, requiredCardId: 'pikachu' },
  boardObjective: 'Vous devez capturer au moins 4 Pokémon dont Pikachu.',
  objectiveDescription:
    "Au début de votre tour, vous devez avoir au moins 4 Pokémon dont PIKACHU dans " +
    "votre pile de Captures. Les Pokémon arrivent par la Fatalité (chaque dresseur " +
    "invoque le sien) ; capturez-les avec l'action « Attraper un Pokémon » (réunissez " +
    "assez de Force d'Alliés pour vaincre le Pokémon : il rejoint vos Captures).",
  boardImage: img('board.png'),
  pawnImage: '/pion_team-rocket.png',
  pawnHeightPx: 120,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  locations: [
    {
      id: 'labo',
      name: 'Laboratoire du Professeur Chen',
      actions: [
        { id: 'vanquish', type: 'VANQUISH', row: 'top', label: 'Vaincre' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'catch', type: 'CATCH_POKEMON', row: 'bottom', label: 'Attraper un Pokémon' },
      ],
    },
    {
      id: 'foret',
      name: 'Forêt',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'centre-pokemon',
      name: 'Centre Pokémon',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
      ],
    },
    {
      id: 'arene',
      name: 'Arène',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
  ],
}
