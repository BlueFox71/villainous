// =============================================================================
// La Bonne Fée (Marraine de Shrek) — plateau (Realm). Vilain fan-made (créateur :
// Jules, univers Shrek).
//
// Source : assets/decks/Maraine la bonne fée/ (Realm.png, faces). Règles tirées du
// tableur « Villainous Template_Jules.ods », onglet La_bonne_fée.
//
// OBJECTIF : « Le Prince Charmant embrasse Fiona sous l'effet de deux potions, au
// bal. » → amener FIONA en Salle de Bal avec ses 2 potions (Filtre d'amour +
// Heureux pour toujours) ET le PRINCE CHARMANT, puis activer « Embrasse-la tout de
// suite ! ». Tant que SHREK est dans le royaume, la victoire est impossible.
//
// Pas d'action Vaincre sur le plateau : elle neutralise les Héros en les
// TRANSFORMANT (Héros en Meuble / en Colombe → force 0) puis en les défaussant
// (« Nettoyage de fond »).
//
// Disposition (4 lieux, gauche → droite) :
//   Marais                 haut: Fatalité · Jouer            bas: Gagner 1 · Défausser
//   La Pomme Empoisonnée   haut: Jouer · Défausser           bas: Gagner 3 · Jouer
//   Usine de Potions       haut: Déplacer objet/allié · Activer   bas: Jouer · Fatalité
//   Salle de Bal           (haut vide)                        bas: Jouer · Activer · Gagner 2
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/la-bonne-fee/${f}`

export const laBonneFee: VillainDef = {
  id: 'la-bonne-fee',
  name: 'Marraine la Bonne Fée',
  objective: {
    type: 'KISS_AT_BALL',
    ballroomId: 'salle-de-bal',
    heroCardId: 'fiona',
    allyCardId: 'prince',
    potionCardIds: ['filtre', 'heureux'],
    blockerHeroCardId: 'shrek',
    winCardId: 'embrasser',
  },
  boardObjective:
    "Le Prince Charmant embrasse Fiona sous l'effet de deux potions, au bal.",
  objectiveDescription:
    "Amenez FIONA dans la Salle de Bal avec ses 2 potions (« Filtre d'amour » + " +
    "« Heureux pour toujours ») et le PRINCE CHARMANT, puis activez « Embrasse-la " +
    "tout de suite ! » pour gagner. Tant que SHREK est présent dans votre royaume, " +
    "la victoire est impossible : transformez-le (Héros en Meuble / en Colombe → " +
    "force 0) puis défaussez-le (« Nettoyage de fond »).",
  boardImage: img('board.webp'),
  pawnImage: '/pion_la-bonne-fee.png',
  pawnHeightPx: 94,
  backVillainImage: img('back-villain.webp'),
  backFateImage: img('back-fate.webp'),
  locations: [
    {
      id: 'marais',
      name: 'Marais',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'pomme-empoisonnee',
      name: 'La Pomme Empoisonnée',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'usine-potions',
      name: 'Usine de Potions Magiques',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'salle-de-bal',
      name: 'Salle de Bal',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
