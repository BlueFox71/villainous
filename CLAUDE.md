# CLAUDE.md

Guide de travail pour Claude Code sur ce dépôt. Lis-le avant toute modification.

Application web pour jouer à **Disney Villainous** contre un bot, en local. Projet
personnel (pas de diffusion publique). Tout est en **français** : commentaires,
texte des cartes, messages de journal, UI.

## Commandes

```bash
npm run dev        # serveur de dév (Vite)
npm run test       # tous les tests (vitest run) — à lancer avant chaque commit
npm run test:watch # tests en watch
npm run lint       # eslint
npm run build      # tsc -b && vite build (typecheck strict inclus)
```

Avant de committer : `npm run test` **et** `npm run lint` doivent passer.

## Stack

Vite + React 19 + TypeScript + Tailwind + Zustand (UI) ; Vitest (tests). Pas de
backend : tout vit dans le navigateur.

## Architecture en couches (séparation NON négociable)

```
src/
├── engine/   # Moteur PUR. N'importe JAMAIS React, Zustand, l'UI, ni data/.
│   ├── types.ts    # GameState, CardInstance, Effect, GameAction…
│   ├── state.ts    # création/maj d'état (updatePlayer, helpers)
│   ├── actions.ts  # applyAction(state, action) → nouveau state
│   ├── effects.ts  # dispatcher des Effect composables
│   ├── rules.ts    # validité des coups, force/coût effectifs, victoire
│   ├── rng.ts      # PRNG déterministe (état dans GameState.rngState)
│   └── __tests__/
├── data/     # Contenu (vilains + cartes). Présentation + données de jeu.
│   ├── villains/<vilain>.ts        # plateau (VillainDef)
│   ├── villains/<vilain>.cards.ts  # cartes (CardDef[])
│   ├── types.ts                    # CardDef, buildDeck(Instances)
│   └── registry.ts                 # cardId → CardDef (allCards)
├── ai/       # Bots. Reçoivent un GameState, renvoient une GameAction.
└── ui/       # React + Zustand (store/gameStore.ts). Lit data/ pour l'affichage.
```

**Principe clé** : le moteur ne sait pas qui joue (humain ou bot). Fonctions
**pures** : `state + action → nouveau state`. Le `GameState` est **sérialisable**
(que des données, aucune méthode).

- Le moteur n'importe pas `data/`. Les `CardInstance` embarquent leurs champs de
  jeu (type/coût/force/effets) ; la présentation (image, texte) reste dans
  `CardDef`, retrouvée côté UI via `cardId`.
- **Déterminisme** : interdit dans `engine/` → `Math.random()`, `Date.now()`,
  `new Date()`. Toute aléa passe par `engine/rng.ts` et l'état `rngState`.
- Files **append-only** consommées par l'UI : `log`, `showcaseEvents`,
  `floatingFx`. Le moteur n'efface jamais ; l'UI suit son propre curseur.

## Modélisation des cartes — RÈGLE CENTRALE

**Ne pas coder les comportements de cartes en dur par `cardId` dans le moteur.**
Les cartes déclarent des **données** ; le moteur les interprète génériquement.

Ordre de préférence pour donner un comportement à une carte :

1. **Réutiliser un `Effect` existant** avec d'autres paramètres. Un même variant
   sert plusieurs cartes / vilains (ex. `INSTANT_VANQUISH_HERO_LE` sert Apparence
   de Dragon ET « Qu'on leur coupe la tête ! »).
2. **Créer un `Effect` paramétrable** (pas « EffetDeLaCarteX » mais « gagne N par
   carte de type T »…) → 1 variant dans l'union `Effect` (`engine/types.ts`) +
   1 `case` dans `engine/effects.ts`. La prochaine carte similaire le réutilise.
3. Pour la **force passive**, utiliser la donnée plutôt que le moteur :
   - `attachStrengthBonus` (Objet associé : +N à l'hôte).
   - `selfStrengthMods` (bonus conditionnel sur sa propre force : `per-type-here`,
     `if-type-here`, `if-card` scope `location`/`realm`).
   - `strengthMod` (aura sur les autres cartes du lieu/royaume : `heroes-here`,
     `allies-here`, `heroes-realm`).
   `effectiveStrength` (`rules.ts`) est entièrement data-driven : **n'y réintroduis
   pas de `cardId ===`**.
4. **En dernier recours seulement**, un branchement par `cardId` dans le moteur
   (capacités activées très spécifiques, certains effets Fatalité). Si tu y
   recours, demande-toi d'abord si un champ de donnée généralisable existe.

Conséquence visée : **ajouter une carte = éditer `data/` ; rarement le moteur.**

### Anatomie d'une CardDef (`data/types.ts`)
- `id` : slug **kebab-case ASCII**, **unique entre TOUS les vilains** (le registre
  indexe par `cardId`). Garde-fou : `data/__tests__/uniqueIds.test.ts` (alimenté
  par `allCards`, donc tout nouveau vilain est couvert automatiquement).
- Texte FR (`text`) = source de vérité « humaine ». Les `effects` en sont la
  traduction machine, ajoutée au fil de l'eau.
- Si tu ajoutes un champ de jeu à `CardDef`, ajoute-le AUSSI à `CardInstance`
  (`engine/types.ts`) ET à sa recopie dans `buildDeckInstances` (`data/types.ts`).

## Ajouter du contenu — check-lists

**Une carte avec un effet déjà géré** → une entrée `CardDef` (+ image dans
`public/cards/<vilain>/`). Rien d'autre.

**Une carte avec un comportement inédit** → suivre l'ordre de préférence ci-dessus.

**Un nouveau vilain** → 2 fichiers `data/villains/<vilain>.ts` + `.cards.ts`, puis
le câbler dans : `data/registry.ts` (`allCards`), `ui/store/gameStore.ts`
(`VILLAINS`, `VillainKey`), `ui/villainArt.ts`, `ui/villainColors.ts`,
`ui/screens/VillainList.tsx`. Ajouter un test d'intégrité du paquet (cf.
`data/__tests__/*.cards.test.ts` : compte des cartes, champs requis, images).

## Tests

- Vitest, à côté du code (`engine/__tests__/`, `data/__tests__/`).
- Les fixtures construites à la main (helpers `ally`/`item`/`hero` des tests)
  doivent **tirer les champs de force passive du registre** (`getCardDef(cardId)`)
  pour rester synchrones avec la donnée réelle des cartes — ne les hardcode pas.
- Tests d'intégrité par vilain : taille des decks, répartition par type, slug
  ASCII, unicité, existence physique des images.

## Style & workflow

- Avance **par étapes** : propose le plan, code, lance les tests, montre ce qui
  marche, puis enchaîne. Ne code pas tout d'un bloc.
- En cas de doute sur une règle exacte de Villainous, **demande** avant de coder.
- Reste cohérent avec le code alentour (densité de commentaires, nommage, idiomes
  — les unions discriminées avec commentaires explicatifs sont la norme).
- Ne committe que sur demande ; si tu es sur `main`, crée une branche d'abord.
- **Avant chaque commit, ajoute une note de version** en tête de `PATCH_NOTES`
  (`src/ui/patchNotes.ts`) : nouvelle `version` (incrémentée), `date`, `title`
  court et `changes` résumant les modifications en langage joueur (FR).
