// Sa Sucrerie — CIRCUIT EN HUIT. Les 18 cases d'action (a0..a17) suivent le tracé
// du huit, repérées sur board.png (x = largeur, y = hauteur, en %). Le croisement
// central (le jeton « 3 ») est PHYSIQUEMENT unique mais TRAVERSÉ DEUX FOIS par la
// boucle : a4 (1ᵉʳ passage) et a13 (2ᵉ) partagent donc le même point. 17 cellules
// physiques pour 18 indices. Sert au placement des boutons d'action (BoardActions),
// du pion King Candy (à `trackPos`) et du jeton Pilote (à `racerPos`).
//   Boucle GAUCHE : apex (Départ/Arrivée) → arc HAUT → croisement → arc BAS → apex.
//   Boucle DROITE : croisement → arc BAS → apex (« 2 ») → arc HAUT → croisement.
export const SUGAR_RUSH_TRACK: { x: number; y: number }[] = [
  { x: 20, y: 43 }, //  0 Départ/Arrivée (drapeau, apex gauche)
  { x: 26.7, y: 20.8 }, //  1 Fatalité      (arc haut gauche)
  { x: 43.6, y: 21 }, //  2 Défausser
  { x: 51.4, y: 21 }, //  3 Jouer une carte
  { x: 57.8, y: 43.3 }, // 4 Gagner 3 — CROISEMENT (1ᵉʳ passage)
  { x: 64.5, y: 66 }, //  5 Jouer une carte (arc bas droite)
  { x: 72.3, y: 66 }, //  6 Défausser
  { x: 85.5, y: 66 }, //  7 Déplacer un Objet/Allié
  { x: 93.2, y: 62.5 }, // 8 Jouer une carte
  { x: 96, y: 43.4 }, //  9 Gagner 2 (apex droit, « 2 »)
  { x: 89.3, y: 20.8 }, // 10 Fatalité      (arc haut droite)
  { x: 72.4, y: 21 }, // 11 Défausser
  { x: 64.5, y: 20.9 }, // 12 Jouer une carte
  { x: 57.8, y: 43.3 }, // 13 Gagner 3 — CROISEMENT (2ᵉ passage, = case 4)
  { x: 51.5, y: 66 }, // 14 Jouer une carte (arc bas gauche)
  { x: 43.6, y: 66.5 }, // 15 Fatalité
  { x: 30.6, y: 66.5 }, // 16 Vaincre
  { x: 23, y: 62.5 }, // 17 Défausser → reboucle sur 0
]
