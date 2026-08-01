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
//   Laboratoire du Pr Chen  haut: Fatalité · Jouer          bas: Gagner 1 · Déplacer héros · Attraper
//   Forêt                   haut: Jouer · Défausser          bas: Gagner 3 · Jouer
//   Centre Pokémon          haut: Jouer · Jouer              bas: Déplacer objet/allié · Fatalité
//   Arène                   haut: Jouer · Gagner 2           bas: Vaincre · Défausser
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
  boardImage: img('board.webp'),
  pawnImage: '/pion_team-rocket.png',
  // Pion redétouré (1732×1732 → 1034×1296) : le sujet passe de 71 % à 94 % de l'image,
  // d'où la hauteur ramenée de 120 à 90 (taille à l'écran inchangée).
  pawnHeightPx: 90,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  locations: [
    {
      id: 'labo',
      name: 'Laboratoire du Professeur Chen',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'bottom', label: 'Déplacer un héros' },
        { id: 'catch', type: 'CATCH_POKEMON', row: 'bottom', label: 'Attraper un Pokémon' },
      ],
    },
    {
      id: 'foret',
      name: 'Forêt',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
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
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'arene',
      name: 'Arène',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
  ],
}
