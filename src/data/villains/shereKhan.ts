// =============================================================================
// Shere Khan — plateau (Realm). Vilain Disney (Le Livre de la Jungle, 1967).
//
// Source : assets/decks/Shere khan/ (Plateau.png, faces découpées des planches).
//
// MÉCANIQUE CENTRALE INÉDITE : les JETONS FEU. Ils recouvrent des ACTIONS précises
// des lieux (pas la rangée entière) et empêchent de les utiliser, comme un Héros
// recouvre la rangée du haut. Ils sont POSÉS/DÉPLACÉS par la Fatalité (Feu Rouge des
// Hommes ; Mowgli en pose un sur son lieu) et RETIRÉS par les cartes Méchant
// (C'est moi Shere Khan, Macaques, C'est très intéressant…). État : `fireTokens`.
//
// OBJECTIF : VAINCRE Mowgli alors qu'AUCUN jeton Feu n'est présent dans son royaume.
// Mowgli (Héros force 2) arrive par Fatalité, par tromperie (Aie confiance…), ou via
// « Lancé sur ses traces » (qui le cherche puis sert aussi à le vaincre). Il pose un
// jeton Feu en arrivant → il faut d'abord nettoyer le royaume avant de l'éliminer.
// Victoire ÉVÉNEMENTIELLE (au Vanquish de Mowgli, si `fireTokens` vide).
//
// Disposition (4 lieux, gauche → droite) ; le haut = rangée recouvrable par un Héros :
//   La Rivière          haut: Défausser            bas: Fatalité · Jouer · Vaincre
//   Le Rocher du Conseil haut: Fatalité            bas: Jouer · Gagner 1 · Déplacer
//   Les Ruines Anciennes haut: Gagner 3            bas: Jouer · Activer · Défausser
//   Les Terres Désolées  haut: Activer · Jouer     bas: Gagner 2 · Jouer
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/shere-khan/${f}`

export const shereKhan: VillainDef = {
  id: 'shere-khan',
  name: 'Shere Khan',
  // Victoire événementielle : vaincre Mowgli sans aucun jeton Feu dans le royaume.
  objective: { type: 'DEFEAT_HERO_NO_FIRE', heroCardId: 'mowgli' },
  boardObjective: 'Retirez tous les jetons Feu de votre royaume puis éliminez MOWGLI.',
  objectiveDescription:
    "VAINQUEZ Mowgli alors qu'AUCUN jeton Feu n'est présent dans votre royaume. " +
    "Faites venir Mowgli (Fatalité, tromperie, ou « Lancé sur ses traces ») — il pose un " +
    "jeton Feu en arrivant. Retirez tous les jetons Feu (C'est moi Shere Khan, Macaques) " +
    "AVANT de l'éliminer.",
  boardImage: img('board.webp'),
  pawnImage: '/pion_shere-khan.png',
  pawnHeightPx: 92,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  locations: [
    {
      id: 'riviere',
      name: 'La Rivière',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un Héros' },
      ],
    },
    {
      id: 'rocher-conseil',
      name: 'Le Rocher du Conseil',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'move', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un Objet ou un Allié' },
      ],
    },
    {
      id: 'ruines-anciennes',
      name: 'Les Ruines Anciennes',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'top', label: 'Gagner 3 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
      ],
    },
    {
      id: 'terres-desolees',
      name: 'Les Terres Désolées',
      actions: [
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
  ],
}
