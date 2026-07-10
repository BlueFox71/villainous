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
  (`engine/types.ts`) — c'est tout. `buildDeckInstances` (`data/types.ts`) recopie
  désormais **génériquement** tous les champs de jeu (tout sauf `NON_INSTANCE_CARD_FIELDS`
  : présentation / deck-building / méta), avec un **garde-fou compile-time**
  (`_GameFieldsOnInstance`) : si un champ de `CardDef` manque sur `CardInstance`, `tsc`
  passe au rouge et nomme le champ. Un champ **purement présentation / éditeur** (non lu
  par le moteur) va dans `NON_INSTANCE_CARD_FIELDS` ou dans la liste retirée par
  `toCardDefs` — pas dans `CardInstance`.

## Ajouter du contenu — check-lists

**Une carte avec un effet déjà géré** → une entrée `CardDef` (+ image dans
`public/cards/<vilain>/`). Rien d'autre.

**Une carte avec un comportement inédit** → suivre l'ordre de préférence ci-dessus.

**Un nouveau vilain — TOUJOURS via l'Atelier (source unique).** Un vilain naît et vit
dans l'**Atelier des vilains** (éditeur intégré) sous forme de `CustomVillain` (données +
images, en IndexedDB / `src/data/drafts` / `src/data/published`). C'est la **source unique** :
son plateau, ses cartes et ses effets sont des **données** que le moteur (déjà 100 %
data-driven) interprète. Voir la check-list dédiée ci-dessous.

**⚠️ Ne JAMAIS « porter » un vilain de l'Atelier en vilain natif.** Les fichiers
`data/villains/<vilain>.ts` + `.cards.ts` et le câblage `data/registry.ts` / `gameStore`
(`VILLAINS`, `VillainKey`, `UNRELEASED_VILLAINS`) / `villainArt` / `villainColors` /
`VillainList` sont l'**ancien** modèle : ils créent une **copie divergente** (le vilain natif
et le brouillon Atelier se désynchronisent) et rendent le vilain visible en dev alors qu'il
n'est pas publié. Les vilains natifs **historiques** restent ainsi (ne pas les migrer sans
demande), mais **aucun nouveau vilain** ne doit être natif.

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

## Développer un vilain de l'Atelier — check-list

Quand on te demande de **développer les effets** d'un vilain conçu dans l'Atelier (souvent
via le bouton « 📋 Copier les consignes » de l'éditeur), le vilain **reste un `CustomVillain`**.
Tu enrichis le **moteur** de capacités **génériques** et tu les déclares en **donnée** sur le
JSON du vilain. Tu ne crées **aucun** fichier natif ni câblage (cf. avertissement ci-dessus).

- **Source de vérité = le JSON du vilain.** À lire d'abord : l'export allégé (sans images)
  `assets/custom-exports/<id>.json`. À éditer pour poser les effets : le JSON complet —
  brouillon `src/data/drafts/<id>.json` (non publié) ou embarqué `src/data/published/<id>.json`
  (publié). Le chargement (`pickFreshestVillains`, `customVillainStore`) retient la version la
  plus **récente par `updatedAt`** : quand tu édites un de ces fichiers, **bumpe `updatedAt`**
  pour que l'Atelier reprenne tes changements (sinon l'IndexedDB local les masque). Ne touche
  pas aux images (déjà bakées).
- **Effets = données** (règle centrale inchangée). Réutilise un `Effect` existant ; sinon crée
  un `Effect` **paramétrable générique** (`engine/types.ts` + `engine/effects.ts`), jamais
  branché par id de vilain. Puis :
  - effet **simple** (paramètres numériques, joueur/royaume) → ajoute-le au **catalogue de
    l'éditeur** (`src/ui/editor/effectCatalog.ts`) pour qu'il soit assignable directement dans
    l'Atelier (il persiste alors naturellement) ;
  - effet **complexe** (cibles précises, cartes nommées, interactivité, états dédiés) → non
    exposable dans l'éditeur : déclare-le en donnée dans `effects` sur les cartes du JSON.
- **Objectif inédit** → variant de `ObjectiveDef` (`engine/types.ts`) + condition de victoire
  (`engine/rules.ts`), branchés par **type** d'objectif ; renseigne `objective` dans le JSON.
- **Fatalité (malus IA)** → pour un vilain custom, porte la valeur **par carte** (`fateMalus`
  sur le `CardDef` du JSON), **pas** dans `data/fateMalus.ts` (réservé au registre statique
  natif). Le tableau reste à faire valider (voir bloc OBLIGATOIRE ci-dessus).
- **Jauge d'objectif** → dans `objectiveScore` (`ai/heuristicBot.ts`), branche par **type**
  d'objectif ; ou par l'**id custom** (`custom-…`) si vraiment propre à ce vilain (cf.
  `custom-mr-monopoly`, `custom-gul-dan`). `villainStrategy` accepte aussi les ids custom
  (cf. `custom-dio`).
- **Tester / publier** : on teste via « ▶ Tester » dans l'Atelier (un vilain non publié
  n'apparaît **jamais** dans les galeries — c'est voulu) ; l'utilisateur publie via
  « ✓ Terminer ».

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
  (`src/ui/patchNotes.ts`) : nouvelle `version`, `date`, `title` court, des `tags`
  et des `changes` **brefs** en langage joueur (FR).
  - **`tags`** : OBLIGATOIRE, 1 à 4 tags de l'union `PatchTag` (cf. `patchNotes.ts`),
    du plus important au moins important, résumant les domaines touchés (🦹 villain,
    ✨ animation, 📜 liste-villains, 🧪 atelier, 🌐 reseau, 🐛 correctif,
    ⚖️ equilibrage, 🤖 ia, 🎴 cartes, 📐 regles, 🔊 son, 🖥️ interface, 👤 profil).
    `villain` dès qu'un nouveau vilain est introduit ; n'ajoute `cartes` que pour
    les notes **sans** nouveau vilain.
  - **`changes`** : reste **concis** — une phrase courte par point, l'essentiel
    (ce qui change + les noms-clés), **gras** Markdown sur quelques termes. Pas de
    justifications ni de détails techniques.
- **Numérotation `MAJOR.MINOR.PATCH`** (on est en `1.x.y` depuis `1.0.0`) :
  - **MAJOR** : reste à **1**.
  - **MINOR** : **+1 dès qu'un nouveau vilain est créé** ; le PATCH **repart à 0**
    (ex. `1.4.7` + nouveau vilain → `1.5.0`).
  - **PATCH** : **+1 pour toute autre modification** (sans nouveau vilain)
    (ex. `1.5.0` → `1.5.1`).
- **Tant que les commits ne sont pas poussés** (`git log origin/main..main`), ne
  laisse pas s'accumuler une note de version par commit : **fusionne-les en une
  seule entrée** en tête de `PATCH_NOTES` (changes et tags regroupés, doublons
  retirés). Son numéro suit la même règle MINOR/PATCH à partir de la dernière
  entrée **déjà poussée**. Une fois poussé, repars d'une nouvelle entrée au commit
  suivant.
- **Avant chaque commit, range les nouveaux fichiers d'`assets/`.** Si `git status`
  montre des fichiers non rangés à la racine d'`assets/` (ou mal placés), déplace-les
  dans le sous-dossier adapté **— mais demande validation avant de déplacer/supprimer.**
  `assets/` ne contient que des **sources** (l'app ne sert que `public/`), organisées
  par type : `portraits/`, `ui/`, `pions/`, `animations/` (sources de décor/anim),
  `decks/` (par vilain), `presentations/`, `Sounds/`, `Voix Villainous/`.
  ⚠️ Ne déplace pas hors de leur dossier les fichiers lus par `import.meta.glob`
  (cf. `villainVoices.ts`, `SoundTest.tsx`) : `assets/Sounds/**`, les `.wav` et les
  `*phrase*.mp3`/`*Phrase*.mp3` de `assets/Voix Villainous/` doivent y rester (si tu
  les déplaces, mets à jour le glob en conséquence), sinon ça casse le build.
