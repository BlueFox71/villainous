# Prompt d'introduction pour Claude Code

Copie-colle le bloc ci-dessous dans Claude Code lors de ton premier message.

---

Salut ! Je veux développer une application web pour jouer au jeu de société **Disney Villainous** (Ravensburger) contre un bot IA. C'est un projet personnel, jouable uniquement par moi ou un proche en local, donc on ignore les questions de droits d'auteur Disney/Ravensburger pour l'usage privé (pas de diffusion publique prévue).

## Contexte du jeu

Villainous est un jeu de cartes asymétrique où chaque joueur incarne un méchant Disney avec :
- Son propre plateau (4 lieux avec actions différentes)
- Son propre deck de cartes (Vilain) + un deck "Destin" joué contre lui par les adversaires
- Son propre objectif de victoire unique (lié à son histoire)

À chaque tour, un joueur : déplace son pion vilain sur un lieu différent, puis exécute les actions disponibles sur ce lieu (gagner des pouvoirs, jouer des cartes, vaincre des héros, piocher, jouer du Destin contre un adversaire, etc.).

## Stack souhaitée

- **Vite + React 19 + TypeScript** (scaffold via `npm create vite@latest`)
- **Tailwind CSS** pour le style
- **Zustand** pour le state management (l'état du jeu sera complexe)
- **Vitest** pour les tests (le moteur de règles doit être testable)
- Pas de backend pour l'instant : tout en local côté navigateur

## Architecture cible

Séparation stricte en couches :

```
src/
├── engine/           # Moteur de jeu pur, AUCUNE dépendance React
│   ├── types.ts      # Types TypeScript (GameState, Card, Action, etc.)
│   ├── state.ts      # Création/manipulation de l'état
│   ├── actions.ts    # Toutes les actions possibles et leur résolution
│   ├── effects.ts    # Système d'effets composables pour les cartes
│   ├── rules.ts      # Validation des coups, détection de victoire
│   └── __tests__/    # Tests Vitest du moteur
├── data/             # Données JSON des vilains et cartes
│   ├── villains/
│   │   ├── princeJohn.ts
│   │   └── ...
│   └── types.ts
├── ai/               # Bots IA, indépendant du moteur
│   ├── randomBot.ts  # Bot stupide (V1)
│   ├── heuristicBot.ts # Bot avec scoring (V2, plus tard)
│   └── mctsBot.ts    # MCTS (V3, plus tard)
├── ui/               # Composants React, consomme l'état via Zustand
│   ├── components/
│   ├── store/
│   └── App.tsx
└── main.tsx
```

**Principe clé** : le moteur ne sait pas qui joue (humain ou bot). L'IA reçoit l'état du jeu et renvoie une action ; le moteur applique l'action et renvoie le nouvel état. Cette séparation est non négociable.

## Modélisation des cartes

**Ne pas hardcoder les effets de cartes.** Utilise un système d'effets typés composables :

```typescript
type Effect =
  | { type: 'GAIN_POWER'; amount: number }
  | { type: 'PLAY_CARD_FREE'; from: 'hand' | 'discard' }
  | { type: 'DRAW'; amount: number }
  | { type: 'MOVE_HERO'; toLocation: LocationId }
  | { type: 'DISCARD'; target: 'self' | 'opponent'; amount: number }
  // ... etc
```

Chaque carte est un objet avec une liste d'effets. Le moteur a un dispatcher unique qui sait exécuter chaque type d'effet. Ajouter un vilain = ajouter des JSON + peut-être 1-2 nouveaux types d'effets, pas réécrire la logique.

## Plan de développement progressif

On va y aller étape par étape. **Important : ne code pas tout d'un coup**. Pour chaque étape, propose-moi le plan, code, lance les tests, montre-moi ce qui marche, puis on passe à la suite.

### Étape 1 : MVP — Le Prince Jean (vilain le plus simple)
- Objectif du Prince Jean : avoir 20 pièces de pouvoir au début de son tour
- 4 lieux avec leurs actions de base (sans cartes pour l'instant)
- Tour de jeu : déplacer + faire les actions du lieu
- Mode 1 joueur humain (pour valider le moteur)
- UI minimaliste mais fonctionnelle

### Étape 2 : Cartes et main
- Système d'effets composables
- Implémentation des cartes du deck Prince Jean
- Action "Piocher" et "Jouer une carte"

### Étape 3 : Premier bot
- `randomBot.ts` : choisit une action légale au hasard
- Mode humain vs bot fonctionnel

### Étape 4 : Deuxième vilain + système de Destin
- Ajouter Maléfique (objectif différent : malédictions sur tous les lieux)
- Implémenter le deck Destin et l'action "Jouer du Destin contre un adversaire"
- Test moteur avec 2 vilains différents

### Étape 5 : Bot heuristique
- `heuristicBot.ts` : système de scoring pondéré par vilain
- Meilleur niveau de jeu

### Étape 6 : Polish UI + autres vilains
- Améliorer le visuel (sans utiliser d'assets Disney officiels)
- Ajouter des vilains supplémentaires un par un

### Étape 7 (optionnelle, ambitieuse) : MCTS
- `mctsBot.ts` : Monte Carlo Tree Search pour un vrai challenge

## Inspirations existantes (ne pas cloner, juste s'inspirer)

- **Ornamus/VillAInous** sur GitHub : implémentation Python d'un bot Villainous avec MCTS. Architecture intéressante à étudier.
- **Waltina Disney Villainous Automa** : règles de bot par vilain conçues par la communauté boardgame, équilibrées et testées. Excellente base pour les heuristiques.
- **Disney Villainous Homebrew Wiki** : documentation exhaustive de toutes les cartes et règles.

## Démarrage

Pour cette première session, on attaque **l'Étape 1 uniquement**. Concrètement :

1. Initialise le projet Vite + React + TS dans le dossier courant
2. Installe les dépendances (Tailwind, Zustand, Vitest)
3. Crée la structure de dossiers ci-dessus
4. Code les types de base du moteur dans `src/engine/types.ts`
5. Code l'état initial du Prince Jean (4 lieux, 0 pouvoir, objectif 20)
6. Code les actions de base ("gagner X pouvoir" selon le lieu)
7. Code la boucle de tour : déplacement + actions
8. Écris quelques tests Vitest pour valider que le moteur fonctionne
9. Code une UI minimaliste : afficher le plateau, le pouvoir actuel, les actions possibles, un bouton "fin de tour"
10. Vérifie qu'on peut jouer une partie complète humain seul jusqu'à 20 pouvoirs

Ne fait que l'étape 1. Si tu as un doute sur les règles exactes du Prince Jean ou autre, demande-moi avant de coder. Quand l'étape 1 marche, on passe à la 2.

C'est parti !

---

# Fin du prompt
