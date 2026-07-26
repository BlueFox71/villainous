// =============================================================================
// Le Seigneur des clés — plateau (Realm). Collaboration (fan), 2 étoiles.
// Mécanique inédite des CLÉS DE COULEUR + DÉ DE COULEUR. 12 clés (parmi 6 couleurs
// — bleu, rouge, vert, jaune, violet, orange) sont réparties sur les 4 lieux à la
// mise en place (3 par lieu, au moins 1 de chaque couleur). Le Seigneur RAMASSE des
// clés (action « Obtenir une clé », cartes, dé) et l'emporte au début de son tour
// dès qu'il possède au moins 1 clé de CHAQUE couleur. Certaines cartes lancent un
// DÉ DE COULEUR (6 faces = 6 couleurs) dont le résultat conditionne l'effet.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//   Crypte         haut: Jouer · Jouer         bas: Gagner 3 · Obtenir une clé
//   Cachot         haut: Jouer · Gagner 1      bas: Jouer · Défausser
//   Cimetière      haut: Défausser · Gagner 1  bas: Jouer · Fatalité
//   Fosse commune  haut: Fatalité              bas: Déplacer Héros · Éliminer un Héros · Gagner 1
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/seigneur-cles/${f}`

export const seigneurCles: VillainDef = {
  id: 'seigneur-cles',
  name: 'Le Seigneur des clés',
  objective: { type: 'KEYS_ALL_COLORS' },
  // 3 clés posées par lieu (12 au total ; ≥1 de chaque couleur garanti à la mise en place).
  startingKeysPerLocation: 3,
  boardObjective: 'Au début de votre tour, vous devez avoir au moins 1 clé de chaque couleur.',
  objectiveDescription:
    'Au début de votre tour, possédez au moins 1 clé de CHAQUE couleur (bleu, rouge, vert, ' +
    'jaune, violet, orange). 12 clés sont réparties sur vos 4 lieux ; ramassez-les avec ' +
    'l’action « Obtenir une clé » (Crypte), Toute Puissance, Pierre Tombale, 00:00… Certaines ' +
    'cartes lancent un dé de couleur. Tant que vous détenez la Clé Noire, vous ne pouvez pas gagner.',
  boardImage: img('board.webp'),
  pawnImage: '/pion_seigneur-cles.png',
  pawnHeightPx: 80,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  locations: [
    {
      id: 'crypte',
      name: 'Crypte',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card-top2', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'obtain-key', type: 'OBTAIN_KEY', row: 'bottom', label: 'Obtenir une clé' },
      ],
    },
    {
      id: 'cachot',
      name: 'Cachot',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
      ],
    },
    {
      id: 'cimetiere',
      name: 'Cimetière',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'fosse-commune',
      name: 'Fosse commune',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'bottom', label: 'Déplacer un héros' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
  ],
}
