// =============================================================================
// La Méchante Reine (Blanche-Neige et les Sept Nains) — plateau (Realm). Vilain
// officiel « Mauvais jusqu'à l'os ». Difficulté 3 étoiles.
//
// Source : dossier assets/decks/Méchante Reine/ (images FR) + wiki Villainous.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Laboratoire       haut: Gagner 1 · Déplacer un Héros   bas: Jouer · Fatalité · Préparer du Poison
//   Forêt             haut: Gagner 2 · Activer              bas: Défausser · Jouer
//   Mine              haut: Jouer · Activer                 bas: Gagner 3 · Jouer
//   Maison des Nains  haut: Défausser · Fatalité            bas: Jouer · Gagner 1   (VERROUILLÉE au départ)
//
// Mécanique spéciale : les INGRÉDIENTS et le POISON.
//  - 4 Ingrédients (Caquet de vieille mégère, Hurlement d'effroi, Noir de nuit,
//    Poussière de momie). La 1ʳᵉ fois que chaque Ingrédient est joué, il va dans
//    la zone INGRÉDIENTS (sous le plateau) au lieu d'être défaussé.
//  - Dès que les 4 Ingrédients différents y sont, la Maison des Nains est
//    déverrouillée.
//  - L'action « Préparer du Poison » et certaines cartes (Trône…) donnent des
//    jetons POISON. « Croque ! » défausse autant de Poison que la force d'un Héros
//    présent pour l'éliminer.
//
// Objectif : faire venir Blanche-Neige (via le Miroir magique) à la Maison des
// Nains, puis l'éliminer (« Croque ! »).
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const mechanteReine: VillainDef = {
  id: 'mechante-reine',
  name: 'La Méchante Reine',
  objective: { type: 'DEFEAT_HERO_AT_LOCATION', heroCardId: 'blanche-neige', locationId: 'maison-des-nains' },
  objectiveDescription:
    'Jouez les 4 Ingrédients pour déverrouiller la Maison des Nains, préparez du ' +
    'Poison, faites venir Blanche-Neige (Miroir magique), puis éliminez-la avec ' +
    '« Croque ! ».',
  boardImage: '/cards/mechante-reine/board.png',
  pawnImage: '/pion_mechante_reine.png',
  pawnHeightPx: 96,
  backVillainImage: '/cards/mechante-reine/back-villain.png',
  backFateImage: '/cards/mechante-reine/back-fate.png',
  lockedLocationsAtStart: ['maison-des-nains'],
  locations: [
    {
      id: 'laboratoire',
      name: 'Laboratoire',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'top', label: 'Déplacer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'brew-poison', type: 'BREW_POISON', row: 'bottom', label: 'Préparer du poison' },
      ],
    },
    {
      id: 'foret',
      name: 'Forêt',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'mine',
      name: 'Mine',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'maison-des-nains',
      name: 'Maison des Nains',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
  ],
}
