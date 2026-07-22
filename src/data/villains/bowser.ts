// =============================================================================
// Bowser — plateau (Realm). Vilain « collab » (hors gamme officielle), thème
// Super Mario Galaxy.
//
// Source : dossier assets/decks/Bowser/ (Realm.png) + feuille « Bowser » du
// classeur Villainous Template_Jules.ods.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Château de Bowser   haut: Jouer · Fatalité          bas: Gagner 1 · Déplacer objet/allié
//   Galaxies            haut: Jouer · Gagner 3          bas: Activer · Défausser
//   Observatoire        haut: Défausser · Jouer         bas: Gagner 2 · Jouer
//   Château de Peach    haut: Jouer · Déplacer un héros bas: Vaincre · Fatalité
//
// Mécanique : l'Observatoire de la Comète démarre avec 4 ÉTOILES. Tant qu'il en
// reste au moins une, ce lieu n'est pas bloqué ; à 0 Étoile, il est verrouillé.
//
// Objectif : au début de son tour, l'Observatoire est épuisé (0 Étoile) ET Peach
// a été capturée (via Impuissance). Tant que Mario est présent, victoire bloquée.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const bowser: VillainDef = {
  id: 'bowser',
  name: 'Bowser',
  objective: { type: 'DEPLETE_OBSERVATORY_AND_CAPTURE', blockerHeroCardId: 'mario' },
  boardObjective: 'Au début de votre tour, vous devez épuiser l’Observatoire de la Comète et capturer Peach.',
  objectiveDescription:
    "Au début de votre tour, épuiser l'Observatoire de la Comète (0 Étoile) et avoir capturé Peach. Impossible tant que Mario est présent.",
  boardImage: '/cards/bowser/board.webp',
  pawnImage: '/pion_bowser.png',
  pawnHeightPx: 84,
  backVillainImage: '/cards/bowser/back_villain.webp',
  backFateImage: '/cards/bowser/back_fatality.webp',
  starSetup: { locationId: 'observatoire', count: 4 },
  locations: [
    {
      id: 'chateau-bowser',
      name: 'Château de Bowser',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'galaxies',
      name: 'Galaxies',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'top', label: 'Gagner 3 pouvoir' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'observatoire',
      name: 'Observatoire de la Comète',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'chateau-peach',
      name: 'Château de Peach',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'top', label: 'Déplacer un héros' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
  ],
}
