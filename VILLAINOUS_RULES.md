# Règles Villainous — Référence pour le développement

Document de référence à fournir à Claude Code (terminal) en pièce jointe ou via `cat`.

## Règles générales du jeu

### Tour de jeu

À son tour, un joueur fait, dans cet ordre :

1. **Déplacement obligatoire** : déplace son pion vilain sur un lieu **différent** de celui où il se trouve. Si c'est le premier tour, il peut choisir n'importe lequel des 4 lieux.
2. **Actions** : exécute, dans l'ordre qu'il veut, autant d'actions qu'il souhaite parmi celles disponibles sur le lieu. Chaque action ne peut être exécutée qu'une fois par tour.
3. **Pioche** : termine le tour en piochant jusqu'à avoir 4 cartes en main.

### Actions standards des lieux (icônes)

Une action peut être "couverte" par un héros adverse — elle est alors indisponible jusqu'à ce que le héros soit vaincu. Voici les actions classiques :

- **Gain Power (💰)** : gagner X points de pouvoir (souvent 1, 2 ou 3 selon le lieu)
- **Play a Card (🃏)** : jouer une carte de la main en payant son coût en pouvoir
- **Fate (👁️)** : forcer un adversaire à piocher 2 cartes de son deck Destin, on en choisit une à appliquer, l'autre est défaussée
- **Move an Item or Ally (➡️)** : déplacer un objet ou un allié de son plateau d'un lieu à un autre
- **Move a Hero (➡️🦸)** : déplacer un héros adverse d'un lieu à un autre
- **Vanquish (⚔️)** : vaincre un héros en lui infligeant des dégâts égaux ou supérieurs à sa force (somme des forces des alliés présents sur le même lieu)
- **Discard (🗑️)** : défausser X cartes de sa main

### Cartes Vilain (deck du joueur)

- **Allié** : reste en jeu sur un lieu, a une force, peut attaquer/défendre
- **Objet** : effet passif ou permanent, posé sur un lieu
- **Effet** : effet ponctuel, appliqué puis défaussé
- **Condition** : reste en jeu, déclenche un effet quand une condition est remplie

### Cartes Destin (deck contre le joueur)

- **Héros** : posé sur le plateau du vilain par les adversaires, couvre les actions du lieu où il est posé
- **Effet** : effet ponctuel négatif appliqué au vilain
- **Objet** : objet posé sur le plateau du vilain (généralement défavorable)

### Condition de victoire

Chaque vilain a une **condition unique**. Le premier qui la remplit gagne immédiatement.

---

## Prince Jean (Robin des Bois) — Vilain de démarrage

### Objectif de victoire

**Avoir 20 points de pouvoir au début de son tour.**

C'est la condition la plus simple du jeu — c'est pourquoi on commence par lui.

### Plateau : 4 lieux

| # | Lieu | Actions disponibles |
|---|------|---------------------|
| 1 | **Sherwood Forest** | 1 Power, Move Item/Ally, Move Hero, Vanquish |
| 2 | **Friar Tuck's Church** | 2 Power, Play a Card, Fate, Discard |
| 3 | **Nottingham** | 3 Power, Play a Card, Vanquish, Fate |
| 4 | **The Jail** | Play a Card, Move Item/Ally, Move Hero, Discard |

Note : les actions exactes peuvent varier selon les sources, à confirmer avec le matériel officiel ou le wiki Villainous lors de l'implémentation.

### Mécaniques particulières du Prince Jean

- Son objectif l'incite à **accumuler du pouvoir** (action "Gain Power")
- Il a des cartes comme **"Taxes"** qui rapportent du pouvoir
- Ses cartes "Beauty" et autres jouent sur le coût/gain de pouvoir
- Il est sensible aux héros qui couvrent ses lieux à fort gain de pouvoir (Nottingham notamment)
- Les héros principaux du Destin contre lui : Robin Hood, Little John, King Richard, etc.

---

## Étape 1 : Périmètre simplifié

Pour le tout premier MVP, on **simplifie volontairement** :

✅ **Inclus dans l'étape 1** :
- 1 vilain : Prince Jean
- 4 lieux avec actions "Gain Power" uniquement (1, 2, 3, 0 selon le lieu)
- Tour : déplacer + faire la ou les actions du lieu
- Détection de victoire à 20 pouvoirs en début de tour
- 1 joueur humain seul (pas de bot, pas d'adversaire)

❌ **Exclu de l'étape 1** (pour les étapes suivantes) :
- Cartes en main et deck
- Action "Jouer une carte"
- Héros et deck Destin
- Combat / Vanquish
- Autres vilains
- Bot IA

L'objectif est uniquement de valider l'architecture moteur/UI avec quelque chose de minimal qui fonctionne. Une fois qu'on peut cliquer "déplacer → gagner du pouvoir → fin de tour → atteindre 20 → victoire", on enrichit.

---

## Vilains à implémenter ensuite (par ordre de complexité croissante)

1. **Prince Jean** ✓ (objectif numérique simple)
2. **Capitaine Crochet** (objectif : vaincre Peter Pan à Skull Rock — séquentiel)
3. **Maléfique** (objectif : malédiction sur les 4 lieux — état par lieu)
4. **Ursula** (objectif : avoir trident + couronne sur Garden — collection)
5. **Reine de Cœur** (objectif : gagner un tournoi de croquet — combinaison)
6. **Jafar** (objectif : avoir lampe à Genie's Cave + contrôler Genie — interactions complexes)

---

## Ressources externes

- Wiki officiel : https://disney-villainous.fandom.com/wiki/
- Wiki Homebrew (très complet sur les cartes) : https://disney-villainous-homebrew.fandom.com/wiki/
- Code d'inspiration : https://github.com/Ornamus/VillAInous (Python, MCTS)
- Automa Waltina (heuristiques de bot) : https://boardgamegeek.com/thread/3340988
