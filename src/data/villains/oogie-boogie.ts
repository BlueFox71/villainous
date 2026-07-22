// =============================================================================
// Oogie Boogie — plateau (Realm). Vilain de l'extension « Filled With Fright »
// (L'Étrange Noël de Monsieur Jack, 1993).
//
// Source : assets/decks/Oogie Boogie/ (Plateau.png, faces découpées).
//
// MÉCANIQUE CENTRALE INÉDITE : les DÉS. Oogie lance DEUX dés à six faces
// (somme 2–12) pour résoudre plusieurs cartes (seuils « 7 ou moins / 8 ou plus »).
// Modificateurs : GRAM (+1 si le pion est sur son lieu), Salut Oogie ! (−2 au
// prochain lancer, Fatalité), Dés pipés (relance 1 dé), Cette fois l'affaire est
// dans le sac (choisit le résultat). → implémenté en phase 2.
//
// OBJECTIF : convaincre Jack Skellington de revenir puis le VAINCRE. Oogie joue
// des « Imposteur Perce-Oreilles » (lancer ; ≥7 = succès, posé près de Sandy
// Claws). À 4 imposteurs réussis, Sandy Claws (Prisonnier posé à l'Antre au setup)
// fait apparaître Jack (Héros force 8, sans capacité) à l'Antre et se retire. On
// gagne en VAINQUANT Jack à l'Antre. → mécanique d'objectif implémentée en phase 3.
//
// Disposition (4 lieux, gauche → droite) :
//   Ville d'Halloween   haut: Jouer · Gagner 3        bas: Défausser · Jouer
//   Cabane du Trio      haut: Déplacer objet/allié · Fatalité  bas: Gagner 2 · Jouer
//   Cimetière           haut: Vaincre · Défausser     bas: Jouer · Fatalité
//   Antre d'Oogie Boogie  haut: — (prison de Sandy Claws)  bas: Vaincre · Jouer · Gagner 2
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/oogie-boogie/${f}`

export const oogieBoogie: VillainDef = {
  id: 'oogie-boogie',
  name: 'Oogie Boogie',
  // Jack n'apparaît comme Héros (force 8) à l'Antre que via l'objectif (4 imposteurs) ;
  // il n'y est jamais posé par la Fatalité (où il agit en Événement). Le vaincre à
  // l'Antre déclenche donc la victoire — modèle « éliminer un Héros précis sur un lieu ».
  objective: { type: 'DEFEAT_HERO_AT_LOCATION', heroCardId: 'jack-skellington', locationId: 'antre' },
  boardObjective: 'Vous devez éliminer Jack Skellington.',
  objectiveDescription:
    "Convainquez Jack Skellington de revenir puis VAINQUEZ-le. Jouez des « Imposteur " +
    "Perce-Oreilles » (lancez les dés : 7+ = succès, posé près de Sandy Claws). À 4 " +
    "imposteurs réussis, Jack revient (Héros force 8) à l'Antre d'Oogie Boogie : " +
    "éliminez-le avec vos Alliés.",
  boardImage: img('board.webp'),
  pawnImage: '/pion_oogie-boogie.png',
  pawnHeightPx: 88,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  // Sandy Claws (Perce-Oreilles) est posé à l'Antre dès la mise en place : il ancre
  // la pile d'Imposteurs et fait revenir Jack à 4 imposteurs réussis.
  prisonerSetup: { cardId: 'perce-oreilles', locationId: 'antre' },
  locations: [
    {
      id: 'ville-halloween',
      name: "Ville d'Halloween",
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'top', label: 'Gagner 3 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'cabane-trio',
      name: 'Cabane du Trio',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'cimetiere',
      name: 'Cimetière',
      actions: [
        { id: 'vanquish', type: 'VANQUISH', row: 'top', label: 'Vaincre' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'antre',
      name: "Antre d'Oogie Boogie",
      actions: [
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
