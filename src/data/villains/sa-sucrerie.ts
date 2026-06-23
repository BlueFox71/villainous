import type { VillainDef } from '../../engine/types'

const img = (f: string) => `/cards/sa-sucrerie/${f}`

/**
 * Sa Sucrerie (King Candy / Sugar Rush) — vilain Disney 4★ à la mécanique unique du
 * CIRCUIT EN HUIT. Un seul « lieu » (le Circuit de Sugar Rush) contenant 18 actions
 * disposées en boucle. Le pion avance de 1 à 4 cases par tour (au lieu de changer de
 * lieu) ; il n'a accès qu'à 3 actions à la fois (celle sur laquelle il est + celle
 * juste devant + celle juste derrière). Un jeton Pilote (Vanellope) court contre lui.
 *
 * Les actions marquées top-row (★ dans les règles : Fatalité, Défausser et Jouer une
 * carte des deux groupes « top ») peuvent être recouvertes par un Héros. Le jeton
 * Pilote recouvre lui aussi l'action où il se trouve.
 */
export const saSucrerie: VillainDef = {
  id: 'sa-sucrerie',
  name: 'Sa Sucrerie',
  objective: { type: 'KING_CANDY_RACE' },
  objectiveDescription:
    "Faites entrer Vanellope von Schweetz dans votre royaume (par Fatalité, Filouterie, ou en jouant le Médaillon des Héros de Ralph puis en vainquant Ralph la Casse), puis associez-lui un BUG (Glitch) : la course démarre. Franchissez la case Départ/Arrivée du circuit AVANT le jeton Pilote de Vanellope pour gagner.",
  boardObjective:
    "Atteindre la case Départ/Arrivée alors qu'un Bug est associé à Vanellope von Schweetz.",
  boardImage: img('board.png'),
  pawnImage: '/pion_sa-sucrerie.png',
  pawnHeightPx: 70,
  backVillainImage: img('back-villain.png'),
  backFateImage: img('back-fate.png'),
  // Une seule « location » : le circuit. Ses 18 actions (a0..a17) forment la boucle.
  locations: [
    {
      id: 'sugar-rush',
      name: 'Circuit de Sugar Rush',
      actions: [
        { id: 'a0', type: 'PLAY_CARD', row: 'bottom', label: 'Départ/Arrivée — Jouer une carte' },
        { id: 'a1', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'a2', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'a3', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'a4', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 Pouvoir' },
        { id: 'a5', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'a6', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
        { id: 'a7', type: 'MOVE_ITEM_ALLY', row: 'bottom', label: 'Déplacer un Objet ou un Allié' },
        { id: 'a8', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'a9', type: 'GAIN_POWER', amount: 2, row: 'bottom', label: 'Gagner 2 Pouvoir' },
        { id: 'a10', type: 'FATE', row: 'top', label: 'Fatalité' },
        { id: 'a11', type: 'DISCARD_CARDS', row: 'top', label: 'Défausser des cartes' },
        { id: 'a12', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
        { id: 'a13', type: 'GAIN_POWER', amount: 3, row: 'bottom', label: 'Gagner 3 Pouvoir' },
        { id: 'a14', type: 'PLAY_CARD', row: 'bottom', label: 'Jouer une carte' },
        { id: 'a15', type: 'FATE', row: 'bottom', label: 'Fatalité' },
        { id: 'a16', type: 'VANQUISH', row: 'bottom', label: 'Vaincre' },
        { id: 'a17', type: 'DISCARD_CARDS', row: 'bottom', label: 'Défausser des cartes' },
      ],
    },
    // Les 4 ZONES de pose (sous le circuit) : lieux normaux du royaume où l'on joue
    // Alliés / Objets / Héros. Elles ne portent AUCUNE action (les actions viennent du
    // circuit `sugar-rush`). Disposées en ligne → adjacence z1↔z2↔z3↔z4 pour « Déplacer
    // un Objet/Allié ». Le circuit (locations[0]) est exclu de la pose et de l'adjacence
    // (cf. isTrackLocation, engine/kingCandy.ts).
    { id: 'zone-1', name: 'Zone 1', actions: [] },
    { id: 'zone-2', name: 'Zone 2', actions: [] },
    { id: 'zone-3', name: 'Zone 3', actions: [] },
    { id: 'zone-4', name: 'Zone 4', actions: [] },
  ],
}
