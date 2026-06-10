# Villainous — Feuille de route / Reste à faire

> État au 27/05/2026. Mis à jour au fil des sessions.

## ✅ Fait

- **Étape 1 — MVP Prince Jean** : plateau (4 lieux, actions Gain Power), tour
  (déplacement obligatoire → actions → fin), victoire à 20 pouvoirs au début du tour.
- **Étape 2 — Cartes & main** : pioche/main/défausse, PRNG déterministe
  (`engine/rng.ts`), **système d'effets composables** (`engine/effects.ts`), actions
  **Jouer une carte** et **Défausser**.
- **Refactor multi-joueurs** : `GameState = { players[], activePlayer, … }`, le moteur
  agit sur le joueur actif, la main passe d'un joueur à l'autre, victoire du bon joueur.
- **Étape 3 — Bot** : `ai/randomBot.ts` (coup légal au hasard), le J2 est un bot qui
  joue seul, **main adverse cachée**.
- Données complètes du **Prince Jean** : 27 cartes (texte FR + méta) + plateau, vérifiées
  sur le wiki officiel. 57 tests, build vert.

---

## 🔜 Reste à faire (par priorité)

### 1. Polish UI *(en cours — session du 27/05)*
- Thème visuel cohérent, hiérarchie, espacement, cartes/panneaux plus soignés.
- Gérer la taille du plateau-image (très haut). Log lisible/repliable.
- Responsive. (Ré-évaluer quand le 2ᵉ vilain et la Fatalité seront là.)

### 2. 2ᵉ vilain réel
- Produire la data d'un 2ᵉ vilain (plateau + ~45 cartes) via le pipeline rodé
  (voir mémoire `villainous-asset-pipeline`). Candidats : **Capitaine Crochet** ou
  **Maléfique**. Remplace le Prince Jean placeholder du bot.
- Objectif de victoire **non numérique** : généraliser la condition de victoire
  (aujourd'hui = seuil de pouvoir) en une fonction par vilain.

### 3. Deck Fatalité *(débloque énormément)*
- Action **Fatalité** : forcer un adversaire à piocher 2 cartes Destin, en appliquer 1.
- **Héros** posés sur les plateaux adverses, qui **recouvrent la rangée du haut** des lieux
  (couverture d'actions — la position top/bottom est déjà modélisée).
- Cartes Fatalité du Prince Jean : Voler aux Riches, Déguisement, + les 9 héros.

### 4. Combat & effets de cartes en attente
Tous ces effets attendent les héros/le combat ; à implémenter après la Fatalité :
- **Vanquish** (Éliminer) : somme des forces des alliés ≥ force du héros.
- **Déplacer** un héros / un allié-objet (actions de lieu + cartes).
- Effets de cartes Prince Jean restants :
  - *Magnifiques Taxes* (+1/héros — effet déjà branché, 0 sans héros), *Mandat d'Arrêt*
    (+2 quand un héros est joué ici), *Couronne du Roi Richard* (coût −1 sur le lieu —
    nécessite un modèle de **modificateurs passifs**).
  - *Archers Loups* (vanquish à distance), *Tendre un Piège*, *Intimidation*, *Flèche d'Or*,
    *Arc et Flèches* (attachements à un allié), *Niquedouille* (+1 force alliés),
    *Pendard* (−1 force héros), *Persifleur* (utiliser une action recouverte).
  - *Emprisonnement* (déplacer un héros sur la Prison).
  - **Conditions** *Avarice* / *Lâcheté* : jouables pendant le tour d'un adversaire
    (mécanisme de réaction inter-tour à ajouter).
- Attachements (Objet/Déguisement/Flèches sur un allié ou un héros) : modèle commun.

### 5. Bots plus malins
- **heuristicBot** : scoring pondéré par vilain (s'inspirer de l'Automa Waltina).
- (Optionnel) **mctsBot** : Monte Carlo Tree Search — le PRNG déterministe est déjà prêt
  pour rejouer des parties.

### 6. Autres vilains (un par un)
Ordre de complexité : Crochet → Maléfique → Ursula → Reine de Cœur → Jafar.

---

## 🐞 Dettes / TODO ponctuels
- **Lâcheté** : vérifier l'icône exacte de la condition de déclenchement (texte mis avec un
  `// TODO` dans `princeJohn.cards.ts`).
- Le bot joue encore le **Prince Jean placeholder** (deux Prince Jean) tant que le 2ᵉ vilain
  n'existe pas.
- `assets/decks/` contient 17 autres vilains en noms de hash (non traités).

---

## 🧱 Repères d'architecture (à respecter)
- `engine/` : pur, **aucune** dépendance React/UI/data. `applyAction(state, action) → state`.
- `ai/` : reçoit l'état, renvoie une action ; ne mute jamais l'état.
- `data/` : définitions de cartes/vilains ; recopiées en `CardInstance` pour que le moteur
  reste autosuffisant.
- `ui/` : consomme le moteur via Zustand ; aucune règle de jeu dans l'UI.
- Effets de cartes = **système composable** (`Effect` + dispatcher) : ajouter un effet =
  un variant + un `case`, jamais de logique hardcodée éparpillée.
