// =============================================================================
// Thanos (Marvel) — plateau (Realm). Vilain de COLLABORATION Marvel. 5 étoiles.
//
// Source : dossier assets/decks/Thanos/ (Plateau.png + cartes FR). Le TEXTE des cartes
// est la source de vérité ; les `effects` sont ajoutés au fil de l'eau.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Sanctuaire II    haut: Gagner 2 · Activer          bas: Jouer · Défausser
//   Titan            haut: Jouer · Fatalité            bas: Gagner 1 · Déplacer
//   Puits de l'Infini haut: Jouer · Défausser          bas: Jouer · Gagner 3
//   Nulle-Part       haut: Déplacer (SEULE action)     bas: Fatalité · Jouer · Éliminer
//
// Objectif (type 'THANOS_STONES') : CAPTURER les 6 Pierres d'Infinité en Compétences.
// Bloqué tant qu'Adam Warlock (Fatalité) est dans le royaume.
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = '/cards/thanos'

export const thanos: VillainDef = {
  id: 'thanos',
  name: 'Thanos',
  objective: { type: 'THANOS_STONES', blockerHeroCardId: 'adam-warlock' },
  boardObjective: 'Récupérez les 6 Pierres d’Infinité.',
  objectiveDescription:
    'Capturez les 6 PIERRES D’INFINITÉ dans votre zone Compétences. Les Pierres se jouent ' +
    'comme des Objets dans le domaine d’un adversaire (qui peut alors les activer). ' +
    'Transférez un de vos Alliés sur la Pierre puis rapatriez-le dans votre domaine : ' +
    'la Pierre devient une Compétence. Vous ne pouvez pas gagner tant qu’Adam Warlock est ' +
    'présent dans votre royaume.',
  boardImage: `${img}/board.webp`,
  pawnImage: '/pion_thanos.png',
  pawnHeightPx: 112,
  backVillainImage: `${img}/back-villain.webp`,
  backFateImage: `${img}/back-fate.webp`,
  locations: [
    {
      id: 'sanctuaire-ii',
      name: 'Sanctuaire II',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'activate', type: 'ACTIVATE', row: 'top', label: 'Activer une capacité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
    {
      id: 'titan',
      name: 'Titan',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
    {
      id: 'puits-de-l-infini',
      name: 'Puits de l’Infini',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'nulle-part',
      name: 'Nulle-Part',
      actions: [
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
  ],
}
