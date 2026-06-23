// =============================================================================
// Le Seigneur des Ténèbres (The Horned King — Taram et le Chaudron magique), 4 ★.
// Mécanique inédite du CHAUDRON NOIR (tuile à deux faces, HORS du deck) :
//   1. Jouer des « Anciens Soldats » (Objets) sur ses lieux.
//   2. S'EMPARER du Chaudron Noir — en jouant « Montrez-moi le Chaudron Noir » ou
//      « Nous avons conclu un marché », ou en VAINQUANT Hen Wen. La tuile passe à
//      côté du portrait (face « Chaudron », inactive).
//   3. ACTIVER le Chaudron (le retourner sur sa face « Pouvoir »).
//   4. Une fois actif, ÉCHANGER ses Anciens Soldats contre des Morts-vivants du
//      Chaudron (« Cauldron Born ») : jouer un Mort-vivant sur un lieu portant des
//      Anciens Soldats (qui sont alors défaussés).
// VICTOIRE : un Mort-vivant du Chaudron sur CHACUN de ses 4 lieux.
//
// Disposition (4 lieux, gauche → droite), 2 rangées (haut / bas) :
//   Morva                  haut: Jouer · Fatalité        bas: Défausser · Gagner 1
//   Royaume du Petit Peuple haut: Jouer · Gagner 3        bas: Jouer · Éliminer
//   Cachots                haut: Jouer · Déplacer obj/allié bas: Fatalité · Gagner 2
//   Salle du Trône         haut: Éliminer · Défausser     bas: Jouer · Déplacer obj/allié
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/seigneur-tenebres/${f}`

export const seigneurTenebres: VillainDef = {
  id: 'seigneur-tenebres',
  name: 'Le Seigneur des Ténèbres',
  objective: { type: 'CAULDRON_BORN_EVERYWHERE' },
  boardObjective: 'Vous devez avoir au moins une carte Soldats Ressuscités sur chaque lieu de votre royaume.',
  objectiveDescription:
    'Placez un Soldat Ressuscité sur CHACUN de vos 4 lieux. Emparez-vous du Chaudron Magique ' +
    '(Montre-moi le Chaudron Magique, Nous avons conclu un marché, ou en vainquant Tirelire) ; ' +
    'RÉVEILLEZ-le (Notre heure est venue !) ; puis jouez des Soldats Ressuscités sur vos lieux — ' +
    'jusqu’à en avoir un partout. Les Squelettes de Soldats donnent à leur lieu l’action « Activer une capacité » (pour réveiller le Chaudron).',
  boardImage: img('board.png'),
  pawnImage: '/pion_seigneur-tenebres.png',
  pawnHeightPx: 96,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  locations: [
    {
      id: 'morva',
      name: 'Morva',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'royaume-petit-peuple',
      name: 'Royaume du Petit Peuple',
      actions: [
        { id: 'play-card-top', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'top', label: 'Gagner 3 pouvoir' },
        { id: 'play-card-bottom', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
      ],
    },
    {
      id: 'cachots',
      name: 'Cachots',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 pouvoir' },
      ],
    },
    {
      id: 'salle-trone',
      name: 'Salle du Trône',
      actions: [
        { id: 'vanquish', type: 'VANQUISH', row: 'top', label: 'Éliminer un héros' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
  ],
}
