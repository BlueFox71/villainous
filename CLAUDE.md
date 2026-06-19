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

### Interactivité par défaut — NON négociable (dès le codage de la carte)

Toute carte qui implique un **choix du joueur** doit être **interactive d'emblée**,
sans attendre une demande : ne JAMAIS résoudre un choix par un auto-pick côté humain.
Sont des choix : *quel* Héros / Allié / Objet cibler, *quel* lieu (pose ou
déplacement, y compris « n'importe quel lieu »), et *si* une action facultative
(« vous pouvez… ») est effectuée ou non.

- Implémente le choix via un état `pendingXXX` + une modale (ou un **clic direct sur
  le plateau** quand c'est plus naturel : Héros, Objet, lieu, pioche…), sur le modèle
  des mécaniques existantes (`pendingFateChoice`, `pendingHeroRelocate` `anyLocation`/
  `optional`, `pendingFateHeroPlace`, `pendingReveal`, `pendingRecover`, clic
  `relocateTargets`/`fatePickable`…). **Réutilise-les** avant d'en créer un nouveau.
- Le **bot auto-résout** ces pending (handler dans `ui/App.tsx` + énumération dans
  `ai/enumerate.ts`) : l'auto-pick reste réservé au bot, jamais imposé à l'humain.
- Une carte est **injouable / non activable** (grisée + garde-fou moteur qui `throw`)
  si elle n'aurait **aucun effet** (aucune cible valide) — cf. `activatableCards`,
  la jouabilité dans `playCard`, et `Hand`/`FateModal`.
- Couvre par des tests le flux interactif (ouverture du pending → résolution).

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

**Classement Fatalité (malus IA) — OBLIGATOIRE pour tout nouveau vilain.** Pour que
le bot module son agressivité Fatalité, chaque vilain a une classification de ses
cartes Fatalité durables (Héros + Objets persistants). En ajoutant un vilain, tu
**proposes un tableau** (carte → effet résumé → catégorie) à l'utilisateur pour
validation, avec les catégories de poids croissant **RALENTIT** (graduable `+`/`++`/
`+++`) < **EMPÊCHE D'AVANCER** < **EMPÊCHE DE GAGNER** ; **NEUTRE** = 0 (typiquement
le Héros-cible de l'objectif). Indique aussi : (a) une éventuelle **règle d'évitement**
— ne pas fataliser si cela donnerait au joueur son Héros-clé encore absent (cf.
Scar/Mufasa, Crochet/Peter Pan, Bowser/Peach…) ; (b) une éventuelle **règle de ciblage**
du bot (ex. ne pas associer un Objet à tel Héros). Reporter le résultat dans la mémoire
projet « villainous-fate-malus ».

**Jauge d'objectif (IA) — OBLIGATOIRE aussi pour tout nouveau vilain.** Le bot évalue
sa progression via `objectiveScore` (`ai/heuristicBot.ts`). En ajoutant un vilain (donc
un nouveau type d'objectif, ou un type existant), tu **proposes à l'utilisateur la jauge
en langage clair** (les paliers/poids, 0→1) et tu **demandes confirmation**, comme pour
les malus. La jauge doit refléter la **vraie proximité de victoire**, pas un compteur
brut (ex. pondérer les étapes finales, tenir compte de la force réunie pour vaincre un
Héros-cible, d'un blocage qui plafonne le score…). Reporter le résultat dans la même
mémoire projet « villainous-fate-malus ».

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
- Ne committe que sur demande. **On committe toujours directement sur `main`** :
  ne crée pas de branche, ne propose pas de PR.
- **Avant chaque commit, ajoute une note de version** en tête de `PATCH_NOTES`
  (`src/ui/patchNotes.ts`) : nouvelle `version` (incrémentée), `date`, `title`
  court et `changes` résumant les modifications en langage joueur (FR).
- **Tant que les commits ne sont pas poussés** (`git log origin/main..main`), ne
  laisse pas s'accumuler une note de version par commit : **fusionne-les en une
  seule entrée** en tête de `PATCH_NOTES` (changes regroupés, doublons retirés).
  Le numéro de cette entrée fusionnée suit la logique de **l'avant-dernière**
  entrée (la première déjà poussée, juste en dessous) : on l'incrémente d'un cran
  (ex. dernière poussée = `0.61` → l'entrée fusionnée devient `0.62`). Une fois
  poussé, repars d'une nouvelle entrée au commit suivant.
