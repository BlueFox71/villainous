# Refonte des messages de Journal — guide

**Objectif : réécrire les messages de Journal de partie de TOUS les vilains** (natifs
et custom) dans un style homogène, data-driven, avec placeholders dynamiques quand
c'est utile.

Ce document est le mode d'emploi opérationnel. La **source de vérité des règles**
reste `CLAUDE.md` (section « Journal de partie ») ; en cas de contradiction, `CLAUDE.md`
prime. Ici on décrit concrètement *comment faire la refonte*, vilain par vilain.

> **Journaux de RÉFÉRENCE (le style à imiter)** : **Le Flagelleur Mental**
> (`custom-flagelleur-mental`) et **Sumbra** (`custom-mrl4fb45`). Lis leur
> `botStrategy.journal` avant d'écrire : format des textes, manière de tourner les
> phrases, placeholders, câblages. **Prince Jean** (`princeJohn.cards.ts`) est le
> modèle **natif** aligné sur ce style.

---

## 1. Rappel express du système

Le message de Journal joué en partie est **une donnée** (`CardInstance.journal`, un
template), pas du code par `cardId`. À la pose/résolution, le moteur remplit les
`{placeholder}` puis logue **cette** ligne à la place de la ligne codée en dur.

- Fichiers moteur : `engine/journalTemplate.ts` (`fillJournal`, `journalLine`,
  `journalLogLine`), `engine/actions.ts` (`applyJournalTemplate` / `buildJournalCtx`),
  rendu dans `ui/…/GameLog`.
- **Opt-in strict** : une carte SANS `journal` garde son log codé en dur (zéro
  régression). La refonte consiste donc à *ajouter/réécrire* le champ `journal`.
- L'icône du bloc est **inférée au rendu** (mots-clés) ; on n'écrit PAS le marqueur
  `⟦ji:…⟧` à la main. Le template = **prose seule**.
- Émission sur : `PLAY_CARD`, `PLAY_CONDITION`, `RESOLVE_FATE` (POV = la **cible** de
  la Fatalité), Choc des Titans, et **émission différée** (`pendingJournal`) pour les
  effets interactifs.

---

## 2. Deux mécanismes selon le type de vilain

### 2a. Vilain CUSTOM (Atelier) — source = `botStrategy.journal`

Le texte vit dans le JSON du vilain, sous `botStrategy.journal` :

```jsonc
"botStrategy": {
  "journal": {
    "villainNotes": { "<cardId>": "texte du message (carte du deck Vilain)" },
    "fateNotes":    { "<cardId>": { "description": "texte (carte Fatalité)" } }
  }
}
```

`toCardDefs` injecte ça sur `CardDef.journal` → `CardInstance.journal` (recopié
génériquement).

**Deux façons d'éditer** (au choix) :
1. **Via l'Atelier** (onglet **Journal**) — c'est la voie « propre » : ça persiste
   naturellement et l'aperçu montre le rendu.
2. **Directement dans le JSON** — brouillon `src/data/drafts/custom-<id>.json` (non
   publié) ou embarqué `src/data/published/custom-<id>.json` (publié). Dans ce cas
   **bumpe `updatedAt`** (le chargement retient la version la plus récente par
   `updatedAt` via `pickFreshestVillains`, sinon l'IndexedDB local masque tes
   changements). Ne touche PAS aux images.

   > En pratique : édite le **publié** (quelques Ko, chemins d'images) avec un
   > `updatedAt` postérieur à celui du brouillon — inutile de rouvrir le brouillon
   > disque, qui pèse des dizaines de Mo (images en base64). Préserve la **fin de
   > ligne** du fichier (CRLF pour la plupart) pour garder un diff propre.

### 2b. Vilain NATIF — champ `journal:` sur chaque `CardDef`

Il n'y a pas d'Atelier ni de `botStrategy.journal`. On pose le template
**directement** sur chaque `CardDef` de `src/data/villains/<vilain>.cards.ts` :

```ts
{
  id: 'emprisonnement',
  name: 'Emprisonnement',
  // …
  effects: [{ type: 'MOVE_HERO_TO_LOCATION', locationId: 'jail' }],
  journal: '{nomHéros} est jeté en Prison.',
},
```

Le pipeline générique (`buildDeckInstances`) recopie `journal` sur le `CardInstance`
(`journal` n'est PAS dans `NON_INSTANCE_CARD_FIELDS`). Rien d'autre à câbler côté
deck-building. **Premier vilain natif traité : Prince Jean** (`princeJohn.cards.ts`),
à prendre comme modèle.

> ⚠️ Ne migre PAS un vilain natif en custom (ni l'inverse) pour l'occasion. On ajoute
> juste le champ `journal` là où le vilain vit déjà.

---

## 3. Conventions d'écriture

(reprend `CLAUDE.md` ; les points clés pour la refonte, calés sur les journaux de
référence Flagelleur / Sumbra)

**Format par famille de carte :**
- **Carte du deck Vilain** : `« ‹Nom de la carte› : ‹prédicat de l'effet›. »`
  (préfixe = nom de la carte, comme Flagelleur : « Froid : les Alliés de {nomLieu}
  gagnent +1 Force. »). Prédicat sans sujet vilain redondant.
- **Allié qui entre** : `« ‹Nom› rejoint le royaume. »` (accord pluriel si le nom est
  pluriel : « Les Archers Loups rejoignent… »). Le **« (Force N) »** est toléré ici
  car c'est un **Allié** (« Le Démogorgon (Force 4) rejoint le royaume. »).
- **Héros (Fatalité)** : `« ‹Nom› apparaît : ‹effet résumé›. »` (avec la description
  de l'effet, style Flagelleur « Mike Wheeler apparaît : les autres Héros gagnent +1
  Force. »). Verbe `apparaît` par défaut.
- **Fatalité non-Héros** (Objet/Effet) : `« ‹Nom/Label› : ‹prédicat›. »`.

**Règles transverses :**
- **Forme prédicat**, pas de sujet vilain redondant (le bloc coloré l'identifie).
  Exception : voix narrative (Michael Myers). Un Allié/Héros **nommé** reste sujet.
- **Jamais « (Force x) » sur un Héros** (toléré sur un Allié, voir ci-dessus).
- **POV Fatalité = la cible** (le vilain fatalisé) : `{nomVilain}`/`{NbEspritMoi}`
  désignent la cible.
- **Emoji d'esprit** : écrire **🌑** dans le template ; le moteur l'adapte au camp
  (`campEmoji` → ☀️ pour un skin Lumière). Ne pas coder ☀️/🌑 par vilain.
- **Monnaie** : « JT » (jetons de terreur) est la forme courte usuelle ; « Pouvoir »
  reste acceptable. Rester cohérent à l'intérieur d'un même vilain.
- **Pas de « (s) » / « (x) »** : on accorde selon le nombre (singulier pour 0 et 1,
  pluriel dès 2). ⚠️ Un template est une **chaîne figée** : il ne sait pas accorder.
  Donc **évite un compteur suivi d'un nom** dans le texte (« déchire {n} mandats »
  serait faux pour 0/1). Préfère une formulation sans compteur, ou un `{NbJT}`
  (unité invariable).
- **Multi-lignes = plusieurs issues** d'un choix (une ligne par issue, choisie par
  index — cf. Choc des Titans).

---

## 4. Catalogue des placeholders

Un placeholder n'est fiable que si sa valeur est **connue à l'émission**. Utilise
uniquement ceux de cette liste (ou câble-en un nouveau, §5).

### Génériques (aucun câblage)
| Clé | Valeur |
|---|---|
| `{NbJT}` | Δ Pouvoir (valeur absolue) de l'acteur sur l'action |
| `{NbEspritMoi}` / `{NbEspritAdv}` | Δ esprits (vilains à système d'esprits) |
| `{nomVilain}` / `{nomAdv}` | noms des méchants (POV Fatalité : `{nomVilain}` = cible) |

> `{NbJT}` = variation nette. Fiable pour une carte **coût 0** qui rapporte (sinon la
> valeur inclut le coût — trompeur).

### Via l'action (déjà branchés)
| Clé | Source |
|---|---|
| `{nomLieu}` | `action.to` (lieu de pose) |
| `{nomHéros}` | `action.targetHeroId` |

### Via `journalVars` exposés par un Effect partagé
| Clé | Effect(s) qui l'exposent |
|---|---|
| `{nomHéros}` | `MOVE_HERO_TO_LOCATION`, `performVanquish` (toute élimination), `LOSE_POWER_TO_HOST` (hôte Héros), attache d'Objet Fatalité, Objet associé à un Héros |
| `{nomAllié}` | `MOVE_ALLY_FREELY`, jeu d'Allié gratuit (Lâcheté…), `REVEAL_UNTIL_ALLY_PLAY_FREE`, Objet associé à un Allié |
| `{nomObjet}` | effets qui récupèrent/défaussent un Objet |
| `{nomCarte}` | `RECOVER_ANY_FROM_DISCARD` (différé) |
| `{nomCombattant}` / `{nomCible}` / `{nbAlliés}` | divers (Kilaire/Sombra, Flagelleur…) |

### Interactif / différé
Si un placeholder n'est pas résolu à la pose **et** qu'un choix est ouvert, l'émission
est **différée** (`pendingJournal`) et se fait à la résolution. Les valeurs déjà
résolues sont **accumulées** dans `pendingJournal.vars` → un message à **deux cibles
choisies à deux moments** (ex. Tendre un Piège : `{nomAllié}` puis `{nomHéros}`) garde
bien les deux à l'émission finale.

### Cible FACULTATIVE → template MULTI-LIGNE (repli)
Quand une cible peut **ne pas** être choisie (action « vous pouvez… », ex. l'élimination
de Tendre un Piège), son placeholder risquerait de rester littéral. Écris alors un
template **multi-ligne** : ligne 0 = forme complète (avec le placeholder optionnel),
ligne(s) suivante(s) = repli **sans** ce placeholder. À l'émission, `bestJournalLine`
prend la ligne 0 si tous ses placeholders sont résolus, sinon la 1ʳᵉ ligne suivante
entièrement remplie.

```ts
journal:
  'Tendre un Piège : {nomAllié} se déplace, puis {nomHéros} est éliminé.\n' +
  'Tendre un Piège : {nomAllié} se déplace et tend un piège.',
```

> Ne pas confondre avec le multi-ligne « plusieurs issues » du **Choc des Titans**
> (l'issue est choisie par index via un code dédié) : ici c'est un **repli
> automatique** piloté par « quel placeholder est résolu ».

---

## 5. Câbler un NOUVEAU placeholder

Quand une carte veut nommer une cible qu'aucun placeholder existant ne couvre :

1. Trouve le **point unique** où l'effet connaît la valeur (le handler dans
   `engine/effects.ts` ou `engine/actions.ts`).
2. Ajoute au state renvoyé :
   ```ts
   journalVars: { ...next.journalVars, ['nomXxx']: valeur }
   ```
   C'est inoffensif hors template (`applyAction` vide `journalVars` à chaque action).
3. **Reste générique** : nomme la clé par le *rôle* (`nomHéros`, `nomAllié`…), pas par
   la carte. Un placeholder câblé sur un Effect partagé profite à **tout** vilain qui
   le réutilise.
4. Pour un effet interactif : expose la valeur dans le **handler de résolution** du
   pending (l'émission différée s'en charge).
5. **Teste** l'exposition (voir §7).

---

## 6. Procédure pas-à-pas pour un vilain

1. **Lire les cartes** : natif → `src/data/villains/<vilain>.cards.ts` ; custom →
   `assets/custom-exports/<id>.json` (léger) puis le JSON complet drafts/published.
2. Pour **chaque carte**, écrire le template (§3) :
   - carte du deck Vilain → `journal` (natif) / `villainNotes[cardId]` (custom) ;
   - carte Fatalité → `journal` (natif) / `fateNotes[cardId].description` (custom) ;
   - Héros Fatalité → **`« ‹Nom› surgit. »`**.
3. Ajouter un `{placeholder}` **seulement** si sa valeur est fiable (§4). Sinon rester
   en prose statique.
4. Si un placeholder utile manque → le câbler (§5).
5. **Custom** : bumper `updatedAt` du JSON édité.
6. `npm run test` + `npm run lint` (voir §7).
7. Vérifier en jeu (dev) : jouer la carte, lire la ligne du Journal (bloc coloré,
   icône cohérente, placeholders remplis, pas de `{clé}` résiduel).

---

## 7. Tests

- Émission end-to-end et exposition des `journalVars` : voir
  `src/engine/__tests__/journalTemplate.test.ts` (modèle à copier).
  - un `PLAY_CARD` / `RESOLVE_FATE` émet la ligne balisée avec placeholders remplis ;
  - un Effect partagé expose la bonne clé via `resolveEffect(...)`.
- Un `{clé}` inconnu est laissé **tel quel** dans le rendu (repérage à l'œil) : si tu
  vois `{nomHéros}` en partie, le câblage manque ou la valeur n'était pas connue.

---

## 8. Check-list de suivi

Légende : ✅ refait · ⬜ à faire.

### Custom (11)
| Vilain | État |
|---|---|
| dio | ✅ |
| gul-dan | ✅ |
| isabella | ✅ |
| pyramid-head | ✅ |
| flagelleur-mental | ✅ |
| killaire | ✅ (skin : notes reclés sur les ids suffixés) |
| michael-meyers | ✅ (voix narrative — exception de forme) |
| mrl4fb45 (Sumbra) | ✅ |
| stitch | ✅ |
| mr-monopoly | ⏸ reporté — aucun effet de carte implémenté |
| ultron | ⏸ reporté — Phase 1, aucun effet de carte implémenté |

> **⏸ reporté** : Mr. Monopoly et Ultron n'ont **aucun `effects` sur leurs cartes** (seules
> la mécanique Maisons/Loyer et les tuiles Amélioration existent côté moteur). Écrire leur
> Journal maintenant annoncerait des effets qui n'ont pas lieu, et il faudrait tout reprendre
> quand les effets arriveront. Les anciennes notes générées de Mr. Monopoly restent en place.

> **Skin (variante liée)** : les cartes d'un skin portent l'id `<id base>--<id skin>`. Ses
> notes de Journal doivent être **reclés** sur ces ids (sinon elles sont mortes, cf. Kilaire
> avant cette passe) et reprendre les **noms de cartes du skin** (Ailes de Lumière, Stage…).
> Garde-fou : `data/__tests__/publishedJournal.test.ts` refuse une note orpheline.

### Natif (35)
| Vilain | État |
|---|---|
| prince-jean | ✅ |
| maleficent | ✅ |
| jafar | ✅ |
| ursula | ✅ |
| reine-coeur | ✅ |
| crochet | ✅ |
| mechante-reine, facilier, hades | ✅ (« Le Mal au Cœur ») |
| scar, yzma, ratigan | ✅ (« Prêt à Tout ») |
| cruella, gothel, pat-hibulaire | ✅ (« Sale Temps pour les Gentils ») |
| syndrome, lotso, sa-sucrerie | ✅ (« Toujours Plus Vil ») |
| bowser, davy-jones, gaston, imposteur, la-bonne-fee, madame-mim, madame-tremaine, oogie-boogie, seigneur-tenebres, shere-khan, slenderman, sombra, tabbou, tamatoa, team-rocket, thanos | ⬜ |

> Les vilains natifs restants n'ont **aucun** `journal` aujourd'hui : pour eux la
> refonte part de zéro. Les customs ont d'anciennes notes générées, à **réécrire**
> au nouveau style.

**Cartes volontairement SANS `journal`** : quand l'effet d'une carte n'est **pas
implémenté** par le moteur, on ne lui écrit pas de message (il annoncerait un effet
qui n'a pas lieu) — elle garde son log par défaut « joue **X** (coût N) ». Cas connus :
`pouvoir-sorcier` et `sauvetage` (Jafar), `proces` et `crise-hysterie` (Reine de Cœur).
Elles sont listées en exemption dans `data/__tests__/journalPlaceholders.test.ts` : à
retirer de la liste le jour où l'effet est codé.

## 9. Accord grammatical — un template ne sait pas accorder

Un template est une **chaîne figée** : le nom injecté par `{nomHéros}` / `{nomAllié}` /
`{nomObjet}` peut être **féminin** (Ariel, Alice, la Chenille) ou **pluriel** (Les Archers
Loups, Les Flibustiers, Arc et Flèches). Donc **jamais** de participe passé ni de verbe
conjugué accordé sur un placeholder :

| ✗ à éviter | ✓ tournure neutre |
|---|---|
| `{nomHéros} est éliminé.` | `la fureur emporte {nomHéros}.` |
| `{nomAllié} gagne +1 Force.` | `+1 Force pour {nomAllié}.` |
| `{nomHéros} périra s’il est mené au Palais.` | `mener {nomHéros} au Palais causera sa perte.` |
| `{nomObjet} est arraché du royaume.` | `le royaume perd {nomObjet}.` |

Recettes : mettre le placeholder en **complément** (`emporte {nomHéros}`, `perd {nomObjet}`),
utiliser un **groupe nominal** (`+2 Force pour {nomHéros}`, `retour en main de {nomCarte}`,
`direction {nomLieu} pour {nomAllié}`) ou un **infinitif** (`mener {nomHéros}…`). Vaut aussi
pour le **nombre** : cf. la règle « pas de (s) » de `CLAUDE.md`.
