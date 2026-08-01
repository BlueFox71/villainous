// =============================================================================
// Tamatoa (Vaiana / Moana, Disney) — 2 ★.
//
// MÉCANIQUE INÉDITE : une TROISIÈME pioche, la pioche MAUI (10 « Maui »). Tant que
// Maui (Héros) est en jeu, au début du tour de Tamatoa il DÉVOILE et JOUE la première
// carte de sa pioche Maui (effets variés : bonus/malus/chaos). Il peut aussi en jouer
// une volontairement via « Pas exactement l'heure de Maui ».
//
// OBJECTIF : réunir l'HAMEÇON DE MAUI et le CŒUR DE TE FITI (non associés) sur le
// Repaire de Tamatoa (réutilise le type ITEMS_AT_LOCATION, comme Ursula). L'Hameçon
// vient de la pioche Méchant ; le Cœur se trouve dans la pioche Fatalité (cherché via
// « Crustacé doté du pouvoir de création »). Moana et Maui « volent » ces Objets en se
// les associant : il faut alors les vaincre pour les libérer.
//
// Disposition (4 lieux, gauche → droite ; 2 actions HAUT + 2 BAS par lieu) :
//   Falaises Impossibles : haut Défausser · Jouer      bas Gagner 2 · Jouer
//   Lalotai              : haut Gagner 2 · Jouer        bas Défausser · Déplacer
//   Repaire de Tamatoa   : haut Déplacer · Fatalité     bas Jouer · Gagner 1
//   La Cage d'Os         : haut Gagner 1 · Jouer        bas Fatalité · Vaincre
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/tamatoa/${f}`

export const tamatoa: VillainDef = {
  id: 'tamatoa',
  name: 'Tamatoa',
  objective: {
    type: 'ITEMS_AT_LOCATION',
    itemCardIds: ['hamecon-de-maui', 'coeur-de-te-fiti'],
    locationId: 'repaire-tamatoa',
  },
  boardObjective:
    "Possédez le Cœur de Te Fiti et le Crochet de Maui dans l'Antre de Tamatoa.",
  objectiveDescription:
    "Réunissez l'HAMEÇON DE MAUI et le CŒUR DE TE FITI sur l'Antre de Tamatoa. L'Hameçon " +
    "vient de votre pioche Méchant ; le Cœur de Te Fiti se trouve dans votre pioche Fatalité " +
    "(cherchez-le avec « Crustacé doté du pouvoir de création »). Moana et Maui s'associent " +
    "ces Objets : vainquez-les pour les libérer.",
  boardImage: img('board.webp'),
  pawnImage: '/pion_tamatoa.png',
  // Le pion a été redétouré au plus près (348×450 → 309×275) : le crabe occupe désormais
  // 95 % de l'image contre 58 % avant. Hauteur ramenée de 92 à 56 pour qu'il garde à
  // l'écran exactement la taille d'avant.
  pawnHeightPx: 56,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  // Pioche MAUI : séparée au setup (cf. createInitialGame), affichée à part.
  mauiDeckBackImage: img('back-maui.webp'),
  locations: [
    {
      id: 'falaises-impossibles',
      name: 'Falaises Impossibles',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'lalotai',
      name: 'Lalotai',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'repaire-tamatoa',
      name: 'Antre de Tamatoa',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'cage-d-os',
      name: "La Cage d'Os",
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
  ],
}
