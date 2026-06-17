// =============================================================================
// Ratigan (Basil, détective privé) — plateau (Realm). Vilain officiel. 2 étoiles.
//
// Source : images FR du dossier assets/decks/Ratigan/ (texte recopié fidèlement) +
// wiki Villainous FR.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas). Tous les lieux
// sont interactifs dès le début (aucun verrou).
//
//   Repaire secret        haut: (vide)              bas: Activer · Jouer · Fatalité
//   Magasin de Flaversham  haut: Jouer · Défausser   bas: Gagner 3 · Jouer
//   Big Ben               haut: Gagner 2 · Déplacer  bas: Jouer · Éliminer
//   Buckingham Palace     haut: Fatalité · Jouer     bas: Déplacer · Gagner 1 · Défausser
//
// Objectif DOUBLE (unique à Ratigan, voir ObjectiveDef 'RATIGAN_DUAL') :
//  - Côté « L'Esprit Supérieur » (départ) : jouer la Reine Robot, la déplacer sur
//    Buckingham Palace et y commencer son tour avec elle.
//  - Si la Reine Robot est défaussée (par Basil), la tuile bascule côté « Le Rat » :
//    il faut alors éliminer Basil.
//  - Dans les deux cas, la Reine Moustoria à Buckingham Palace empêche la victoire.
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const ratigan: VillainDef = {
  id: 'ratigan',
  name: 'Ratigan',
  objective: {
    type: 'RATIGAN_DUAL',
    itemCardId: 'reine-robot',
    locationId: 'buckingham-palace',
    altHeroCardId: 'basil',
    blockerHeroCardId: 'reine-moustoria',
  },
  objectiveDescription:
    'Jouez la Reine Robot, déplacez-la sur Buckingham Palace et commencez votre tour ' +
    'avec elle sur ce lieu. Si la Reine Robot est défaussée (par Basil), vous devenez ' +
    '« Le Rat » : vous devez alors éliminer Basil. La Reine Moustoria à Buckingham ' +
    'Palace empêche la victoire. Vous ne pouvez gagner qu’au début de votre tour.',
  boardImage: '/cards/ratigan/board.png',
  pawnImage: '/pion_ratigan.png',
  pawnHeightPx: 110,
  backVillainImage: '/cards/ratigan/back-villain.png',
  backFateImage: '/cards/ratigan/back-fate.png',
  locations: [
    {
      id: 'repaire-secret',
      name: 'Repaire secret',
      // Rangée du HAUT vide (aucune action imprimée) ; tout est en bas.
      actions: [
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'magasin-flaversham',
      name: 'Magasin de jouets de Flaversham',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'big-ben',
      name: 'Big Ben',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
    {
      id: 'buckingham-palace',
      name: 'Buckingham Palace',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
      ],
    },
  ],
}
