# Capitaine Crochet — référence (transcription FR + sources web)

Difficulté : 3 étoiles (Disney). Pion : figurine magenta « à boucle » en haut à droite de `assets/pions.jpg`.

## Objectif
**Vous devez éliminer Peter Pan sur le Jolly Roger.** (Vaincre Peter Pan ailleurs ne compte pas.)

## Plateau (4 lieux, gauche → droite) — disposition confirmée par le joueur
- **Jolly Roger** — haut : Gagner 1 Pouvoir · Défausser ; bas : Éliminer un Héros · Jouer une carte
- **Rocher du Crâne** — haut : Gagner 1 Pouvoir · Jouer une carte ; bas : Fatalité · Défausser
- **Lagune aux Sirènes** — haut : Jouer une carte · Déplacer un objet/allié ; bas : Gagner 3 Pouvoir · Jouer une carte
- **Arbre du Pendu** — **VERROUILLÉ au départ** — haut : Fatalité · Gagner 2 Pouvoir ; bas : Déplacer un Héros · Jouer une carte
  - Seul lieu avec « Déplacer un Héros ». Débloqué par **Carte du Pays Imaginaire**.
  - (Aucune action « Activer » sur le plateau de Crochet.)

## Deck Vilain (30)
### Alliés (10)
- **Boucanier** (Swashbuckler) ×3 — coût 1, force 2. Aucune capacité.
- **Flibustiers** (Boarding Party) ×3 — coût 2, force 2. Peuvent éliminer un Héros sur leur lieu OU un lieu voisin non bloqué. (cf. Archers Loups)
- **Brute** (Pirate Brute) ×2 — coût 3, force 4. Aucune capacité.
- **Monsieur Mouche** (Smee) ×1 — coût 2, force 2. +2 force sur le Jolly Roger.
- **Monsieur Starkey** (Mr. Starkey) ×1 — coût 2, force 2. Quand joué : vous pouvez déplacer un Héros de son lieu vers un lieu voisin non bloqué.

### Objets (8)
- **Canon** (Cannon) ×2 — coût 2. Ce lieu gagne l'action : **Vaincre**.
- **Sabre d'Abordage** (Cutlass) ×2 — coût 1. Associez à un Allié, +2 force.
- **Boîte à Crochets** (Hook's Case) ×2 — coût 2. Ce lieu gagne l'action : **Gagner 1 Pouvoir**.
- **Ingénieux Mécanisme** (Ingenious Device) ×1 — coût 2. Ce lieu gagne l'action : **Déplacer un Héros**.
- **Carte du Pays Imaginaire** (Never Land Map) ×1 — coût 4. Retirez la tuile Cadenas de l'Arbre du Pendu. Retirez cette carte de votre royaume pour jouer un Objet de votre main gratuitement.

### Événements / Effets (8)
- **Faites-leur peur !** (Give Them a Scare) ×3 — coût 1. Regardez secrètement les 2 premières cartes Fatalité de votre pioche. Défaussez-les ou remettez-les sur le dessus dans l'ordre de votre choix.
- **Digne Adversaire** (Worthy Opponent) ×3 — coût 0. Gagnez 2 Pouvoir. Puis dévoilez des cartes Fatalité de votre deck jusqu'à trouver un Héros. Jouez-le et défaussez les autres dévoilées.
- **Pas de Quartier !** (Aye, Aye Sir!) ×2 — coût 1. Déplacez un Allié vers un lieu voisin non bloqué ; sa force +2 jusqu'à la fin de votre tour.

### Conditions (4)
- **Ruse** (Cunning) ×2 — jouable pendant le tour d'un adversaire s'il joue un Allié de force ≥4 : jouez gratuitement un Allié de votre main.
- **Obsession** ×2 — jouable pendant le tour d'un adversaire s'il élimine un Héros de force ≥4 : dévoilez des cartes Fatalité de votre deck jusqu'à trouver un Héros, jouez-le, défaussez les autres.

## Deck Fatalité (15)
### Héros (8)
- **Peter Pan** ×1 — force 8. Dès qu'il est dévoilé : jouez-le immédiatement sur l'Arbre du Pendu (débloqué ou non) ; défaussez les autres cartes Fatalité dévoilées.
- **Wendy** ×1 — force 3. La force de tous les AUTRES Héros +1.
- **Jean** (John) ×1 — force 2. Si ≥1 Objet associé à Jean, +1 force.
- **Michel** (Michael) ×1 — force 1. +1 force par lieu occupé par ≥1 Héros (le sien compris).
- **Tic Tac** (Tick Tock) ×1 — force 5. Si Crochet se déplace sur le lieu de Tic Tac, il défausse immédiatement toute sa main.
- **Clochette** (Tinker Bell) ×1 — force 2. Défaussez un Allié sur le lieu où vous jouez Clochette.
- **Enfants Perdus** (Lost Boys) ×2 — force 4. Crochet doit utiliser ≥2 Alliés pour les éliminer.

### Objets (5)
- **Poussière de Fée** (Pixie Dust) ×3 — Associez à un Héros, +2 force.
- **Provocation** (Taunt) ×2 — Associez à un Héros. Crochet doit éliminer les Héros « provocateurs » avant les autres.

### Effets (2)
- **Migraine Atroce** (Splitting Headache) ×2 — Défaussez un Objet de votre choix (du royaume de la cible).

## Mécaniques clés
1. Objectif événementiel : victoire dès qu'on élimine Peter Pan sur le Jolly Roger.
2. Arbre du Pendu verrouillé au départ (UNLOCK_LOCATION via Carte du Pays Imaginaire).
3. Peter Pan : auto-placé sur l'Arbre du Pendu à la révélation, autres Fatalités dévoilées défaussées.
4. Digne Adversaire / Obsession : Crochet pioche dans son PROPRE deck Fatalité jusqu'à un Héros et le joue dans SON royaume (il veut des Héros à vaincre).
5. Objets « ce lieu gagne l'action X » : Canon→Vaincre, Boîte à Crochets→Gagner 1 Pouvoir, Ingénieux Mécanisme→Déplacer un Héros.
