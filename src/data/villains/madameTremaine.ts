// =============================================================================
// Madame de Trémaine — plateau (Realm). Disney (Cendrillon, 1950), 4 étoiles.
// Mécanique de VICTOIRE inédite : MARIER une de ses filles (Anastasia ou Drizella)
// au Prince. Pour cela : déverrouiller la Salle de Bal (Invitation du Roi), amener
// une fille EN ROBE DE BAL (Anastasia/Drizella en robe — qui remplacent leur version
// ordinaire) ET le Prince dans la Salle de Bal, puis faire sonner les Cloches de
// Mariage SANS aucune Pantoufle de Verre dans le royaume. Les Pantoufles ne se
// retirent qu'avec la Canne de Madame de Trémaine ; les Héros gênants se Piègent ou
// se vainquent (Petite voleuse ! / Minuit).
//
// Disposition (4 lieux, gauche → droite) :
//   Chambre de Cendrillon  haut: Jouer · Déplacer    bas: Défausser · Gagner 3
//   Salle de Musique       haut: Fatalité · Gagner 2 bas: Jouer · Jouer
//   Le Château             haut: Jouer · Défausser    bas: Fatalité · Gagner 1
//   La Salle de Bal (verrouillée) haut: —             bas: Activer · Jouer · Déplacer
// =============================================================================

import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/madame-tremaine/${f}`

export const madameTremaine: VillainDef = {
  id: 'madame-tremaine',
  name: 'Madame de Trémaine',
  objective: {
    type: 'MARRY_PRINCE',
    ballroomId: 'salle-de-bal',
    ballGownCardIds: ['ball-gown-anastasia', 'ball-gown-drizella'],
    princeCardId: 'the-prince',
    bellsCardId: 'cloches-mariage',
    slipperCardIds: ['pantoufle-chambre', 'pantoufle-chateau'],
  },
  boardObjective: 'Vous devez réunir une de vos filles en robe de bal et le Prince sur la salle de bal, puis activer les cloches du mariage.',
  objectiveDescription:
    'MARIEZ Anastasia ou Drizella au Prince. Déverrouillez la Salle de Bal (Invitation du Roi), ' +
    'amenez-y une fille EN ROBE DE BAL (qui remplace sa version ordinaire déjà en jeu) AVEC le Prince, ' +
    'puis jouez les Cloches de Mariage alors qu’AUCUNE Pantoufle de Verre n’est dans votre royaume. ' +
    'Les Pantoufles ne se retirent qu’avec la Canne ; Piégez ou vainquez les Héros gênants (Petite voleuse !, Minuit).',
  boardImage: img('board.png'),
  pawnImage: '/pion_madame-tremaine.png',
  pawnHeightPx: 92,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  // La Salle de Bal démarre VERROUILLÉE (Invitation du Roi la déverrouille).
  lockedLocationsAtStart: ['salle-de-bal'],
  locations: [
    {
      id: 'chambre-cendrillon',
      name: 'Chambre de Cendrillon',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'top', label: 'Déplacer un objet ou un allié' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 pouvoir' },
      ],
    },
    {
      id: 'salle-musique',
      name: 'Salle de Musique',
      actions: [
        { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2 pouvoir' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'play-card2', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
      ],
    },
    {
      id: 'chateau',
      name: 'Le Château',
      actions: [
        { id: 'play-card', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'discard', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'fate', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'gain-power', type: 'GAIN_POWER', amount: 1, row: 'bottom', label: 'Gagner 1 pouvoir' },
      ],
    },
    {
      id: 'salle-de-bal',
      name: 'La Salle de Bal',
      actions: [
        { id: 'activate', type: 'ACTIVATE', row: 'bottom', label: 'Activer' },
        { id: 'play-card', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'move-item-ally', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un objet ou un allié' },
      ],
    },
  ],
}
