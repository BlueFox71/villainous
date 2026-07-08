// =============================================================================
// LE FLAGELLEUR MENTAL (Mind Flayer — Stranger Things) — plateau (Realm).
// Vilain fan-made (créateur : Jules, univers Stranger Things).
//
// Source : assets/custom-exports/custom-flagelleur-mental.json (données de jeu) ;
// plateau Realm.png de assets/decks/Flagelleur Mental/.
//
// OBJECTIF (réel) : ouvrir le Monde à l'Envers. Poser 3 TUNNELS DE HAWKINS sur
// les 3 premiers lieux, amener ONZE (Eleven, récupérée par BILLY dans la Fatalité)
// sur le lieu de l'ENTRÉE DU MONDE À L'ENVERS, puis ACTIVER l'ENTRÉE → victoire.
// MAX, tant qu'elle est présente, empêche BILLY d'aller chercher ONZE.
//
//
// Disposition (4 lieux, gauche → droite) :
//   Centre-ville de Hawkins  haut: Fatalité · Gagner 2      bas: Jouer · Vaincre · Déplacer héros
//   Starcourt                haut: Jouer · Déplacer obj/allié  bas: Défausser · Fatalité
//   Laboratoire National     haut: Défausser · Jouer        bas: Jouer · Gagner 3
//   Le Monde à l'Envers      (verrouillé au départ)          bas: Jouer · Activer · Gagner 1
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/flagelleur-mental/${f}`

export const flagelleurMental: VillainDef = {
  id: 'flagelleur-mental',
  name: 'Le Flagelleur Mental',
  // Victoire ÉVÉNEMENTIELLE : activer l'ENTRÉE quand ONZE partage son lieu et qu'un
  // TUNNEL est posé sur chacun des 3 premiers lieux (cf. flayerGateConditionMet).
  objective: {
    type: 'FLAYER_GATE',
    gateCardId: 'entree-du-monde-a-l-envers',
    heroCardId: 'onze',
    tunnelCardId: 'tunnel-de-hawkins',
    tunnelLocationCount: 3,
  },
  boardObjective: 'Ouvrez le Monde à l\'Envers.',
  objectiveDescription:
    "Posez 3 TUNNELS DE HAWKINS sur les 3 premiers lieux, amenez ONZE (récupérée " +
    "dans la Fatalité par BILLY SOUS EMPRISE) sur le lieu de l'ENTRÉE DU MONDE À " +
    "L'ENVERS, puis ACTIVEZ l'ENTRÉE pour gagner. Tant que MAX MAYFIELD est " +
    "présente, BILLY ne peut pas aller chercher ONZE.",
  boardImage: img('board.png'),
  pawnImage: '/pion_flagelleur-mental.png',
  pawnHeightPx: 94,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  // Le Monde à l'Envers démarre VERROUILLÉ (déverrouillé par 3 THE FLAYED en jeu).
  lockedLocationsAtStart: ['monde-envers'],
  locations: [
    {
      id: 'centre-ville',
      name: 'Centre-ville de Hawkins',
      actions: [
        { id: 'fate', type: 'FATE', amount: 1, row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'move-hero', type: 'MOVE_HERO', amount: 1, row: 'bottom', label: 'Déplacer un héros' },
      ],
    },
    {
      id: 'starcourt',
      name: 'Starcourt',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'laboratoire',
      name: 'Laboratoire National',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'monde-envers',
      name: "Le Monde à l'Envers",
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer une capacité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
  ],
}
