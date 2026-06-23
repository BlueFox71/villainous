// =============================================================================
// Sombra (Overwatch) — plateau (Realm). Vilain de COLLABORATION. 2 étoiles.
//
// Source : feuille « Sombra » de Villainous_Template-Alexis_1_1.xlsx + images du
// dossier assets/decks/Sombra/. Le TEXTE est la source de vérité ; les `effects`
// sont ajoutés au fil de l'eau (mécaniques Piratage, verrou Lumérico, objectif).
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Castillo     haut: Jouer · Gagner 1     bas: Défausser · Activer
//   Los Muertos  haut: Gagner 1 · Déplacer  bas: Jouer · Fatalité
//   Dorado       haut: Défausser · Jouer    bas: Gagner 3 · Jouer
//   Lumérico     haut: Fatalité · Activer   bas: Déplacer un Héros · Gagner 2
//   (Lumérico est VERROUILLÉ au départ — débloqué par la carte FAILLE.)
//
// Objectif (type 'SOMBRA') : poser une carte de Piratage sur CHAQUE lieu (Lumérico
// compris) PUIS jouer Protocole Sombra (victoire événementielle).
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = '/cards/sombra'

export const sombra: VillainDef = {
  id: 'sombra',
  name: 'Sombra',
  objective: { type: 'SOMBRA', winCardId: 'protocole-sombra' },
  boardObjective: 'Placez un piratage sur chaque lieu et effectuer le protocole Sombra',
  objectiveDescription:
    'Piratez les quatre lieux : posez une carte de Piratage sur chacun d’eux ' +
    '(Lumérico compris, débloqué par Faille) puis jouez Protocole Sombra pour ' +
    'l’emporter. Une carte de Piratage ne peut pas être déplacée et désactive une ' +
    'action du lieu tant qu’elle y reste.',
  boardImage: `${img}/board.png`,
  pawnImage: '/pion_sombra.png',
  pawnHeightPx: 80,
  backVillainImage: `${img}/back-villain.png`,
  backFateImage: `${img}/back-fate.png`,
  // Lumérico est inaccessible tant que FAILLE n'a pas été jouée.
  lockedLocationsAtStart: ['lumerico'],
  locations: [
    {
      id: 'castillo',
      name: 'Castillo',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer' },
      ],
    },
    {
      id: 'los-muertos',
      name: 'Los Muertos',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'dorado',
      name: 'Dorado',
      actions: [
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'lumerico',
      name: 'Lumérico',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer' },
        { id: 'move-hero', type: 'MOVE_HERO', row: 'bottom', label: 'Déplacer un héros' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
  ],
}
