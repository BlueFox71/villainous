// =============================================================================
// Yzma (Kuzco, l'empereur mégalo) — plateau (Realm). Vilain officiel. 2 étoiles.
//
// Source : dossier assets/decks/Yzma/ (images FR) + spec utilisateur.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//
//   Palais                 haut: Gagner 2 · Déplacer Objet/Allié   bas: Éliminer · Jouer
//   Maison de Pacha        haut: Jouer · Gagner 1                   bas: Déplacer Objet/Allié · Fatalité
//   Jungle                 haut: Jouer · Défausser                  bas: Gagner 3 · Jouer
//   Poêle à frire de Mudka haut: Gagner 1 · Fatalité                bas: Défausser · Jouer
//
// Aucun lieu verrouillé : tout est fonctionnel dès le début.
//
// Objectif : trouver KUZCO dans l'une de ses quatre pioches Fatalité et le jouer,
// jouer KRONK et le garder, puis l'utiliser pour éliminer KUZCO.
//
// MÉCANIQUE SPÉCIALE (4 pioches Fatalité) : au lieu d'une seule pioche, Yzma a
// QUATRE pioches Fatalité (une par lieu, posée au-dessus du lieu). Quand un
// adversaire la cible avec une Fatalité, il choisit une pioche, regarde toutes ses
// cartes, en joue une sur le lieu correspondant, remélange et replace le reste.
// Lieu à pioche vide = non choisissable. Si toutes sont vides, la défausse Fatalité
// (unique) est remélangée et redistribuée en 4 pioches les plus égales possibles.
// (Implémentée par phases, cf. engine/.)
// =============================================================================

import type { VillainDef } from '../../engine/types'

export const yzma: VillainDef = {
  id: 'yzma',
  name: 'Yzma',
  objective: { type: 'DEFEAT_HERO_WITH_ALLY', heroCardId: 'kuzco', allyCardId: 'kronk' },
  objectiveDescription:
    'Trouvez Kuzco dans l’une de vos quatre pioches Fatalité et jouez-le. Jouez Kronk, ' +
    'gardez-le de votre côté, et utilisez-le pour éliminer Kuzco.',
  boardImage: '/cards/yzma/board.png',
  pawnImage: '/pion_yzma.png',
  pawnHeightPx: 100,
  backVillainImage: '/cards/yzma/back-villain.png',
  backFateImage: '/cards/yzma/back-fate.png',
  locations: [
    {
      id: 'palais',
      name: 'Palais',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'maison-pacha',
      name: 'Maison de Pacha',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
      ],
    },
    {
      id: 'jungle',
      name: 'Jungle',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'poele-mudka',
      name: 'Poêle à frire de Mudka',
      actions: [
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
  ],
}
