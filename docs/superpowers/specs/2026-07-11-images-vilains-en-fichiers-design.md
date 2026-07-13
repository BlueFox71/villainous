# Externaliser les images des vilains custom en fichiers

**Date :** 2026-07-11
**Statut :** design validé, en attente de plan d'implémentation

## Problème

Les vilains custom stockent **toutes leurs images en base64 (data-URL) dans leur JSON**
(`src/data/published/<id>.json`). Ces fichiers pèsent 18 à 70 Mo. Un chargement à la
demande (light/full, v1.4.1) évite déjà de charger les gros JSON pour les listes, mais
**ouvrir un vilain dans l'Atelier reste lent** : l'hydratation parse le JSON complet
(des dizaines de Mo de base64) d'un coup.

Cause : le base64 dans le JSON empêche le navigateur de charger/mettre en cache les
images individuellement et alourdit le parse.

## Objectif

Sortir **toutes** les images du JSON vers des **fichiers** servis par URL, de sorte que :
- le JSON publié tombe à quelques Ko → ouverture instantanée dans l'Atelier ;
- chaque image se charge paresseusement (`<img src>`) et est mise en cache par le navigateur ;
- on s'aligne sur les vilains **natifs** (leurs cartes vivent déjà dans `public/cards/<vilain>/`).

Point de douleur ciblé (validé) : **ouvrir un vilain dans l'Atelier**.

## Décisions validées

1. **Périmètre** : toutes les images (cartes bakées + art brut, portrait, présentation,
   plateau, plateau-art, plateau-alt, pion, dos, lieux, overlays de dos) **et l'audio**
   (devise) — tout ce qui est base64 lourd.
2. **Emplacement** : `public/cards/custom-<id>/` (aligné sur les natifs, servi par URL en prod).
3. **Migration** : migrer les **6 vilains déjà publiés** maintenant (script one-shot), puis
   **retirer** tout le mécanisme light/full devenu inutile.
4. **Cache-busting** : suffixe `?v=<updatedAt-ms>` sur les chemins (pas de hash dans le nom
   → diffs Git propres).
5. **Mini-vignettes de l'éditeur** : affichent le **composite baké** directement (rapide,
   pas de recomposition) ; seul le **grand aperçu interactif** de la carte sélectionnée se
   recompose en live. (Option (a).)

## Architecture

### Modèle de données

Un champ image accepte **data-URL _ou_ chemin**, partout (`CustomCard`, `CustomVillain`,
lieux, overlays). Convention :

- **Vilain publié** (committé) → champs image = **chemin** `/cards/custom-<id>/<nom>.png?v=<ms>`.
- **Brouillon local** (IndexedDB, app déployée sans backend) → images restent en **data-URL**
  (une image fraîchement uploadée n'est écrite en fichier qu'à la publication, côté DEV).

### Inventaire des fichiers écrits sous `public/cards/custom-<id>/`

Source de vérité des champs lourds : `src/data/published/lighten.ts`.

| Source (champ JSON)            | Fichier                       |
|--------------------------------|-------------------------------|
| `cards[].image`                | `<cardId>.png`                |
| `cards[].artImage`             | `<cardId>.art.png`            |
| `portrait`                     | `portrait.png`                |
| `presentation`                 | `presentation.png`            |
| `portraitRaw`                  | `portrait-raw.png`            |
| `boardImage`                   | `board.png`                   |
| `boardArt`                     | `board-art.png`               |
| `altBoardImage`                | `board-alt.png`               |
| `pawnImage`                    | `pawn.png`                    |
| `backVillainImage`             | `back-villain.png`            |
| `backFateImage`                | `back-fate.png`               |
| `backExtraImage`               | `back-extra.png`              |
| `backOverlays[].image`         | `back-overlay-<i>.png`        |
| `backExtra.overlays[].image`   | `back-extra-overlay-<i>.png`  |
| `locations[].image`            | `loc-<locId>.png`             |
| `locations[].alt.image`        | `loc-<locId>.alt.png`         |
| `locations[].alt.columnImage`  | `loc-<locId>.alt-col.png`     |
| `audio`                        | `audio.<ext>` (mp3/wav)       |

Octets écrits **tels quels** (décodage base64 → fichier), aucun ré-encodage → zéro perte.

### Composants et responsabilités

- **`imageExternalize.ts` (nouveau, pur, Node-safe)** — transforme un vilain complet
  (data-URLs) en `{ villain: <JSON chemins>, files: {relPath → Buffer} }`. Aucune I/O :
  testable isolément. Contient le **constructeur de chemins** (champ → nom de fichier) et
  la logique de remplacement (data-URL → chemin `?v`), en réutilisant l'inventaire de
  `lighten.ts`.
- **`/__publish-villain` (vite.config.ts, DEV)** — appelle `imageExternalize`, écrit les
  fichiers sous `public/cards/custom-<id>/`, écrit **un seul** JSON « chemins » dans
  `src/data/published/<id>.json`, supprime les fichiers d'images devenues orphelines.
  Ne génère plus de `light/`.
- **`published/load.ts`** — simplifié : un seul `import.meta.glob('./*.json')` charge les
  petits JSON. Suppression de `loadBundledVillains` (light), `loadFullBundledVillain`.
- **`customVillainStore.ts`** — suppression de `hydrate`, du marqueur `_light` et de la
  logique associée. `registerPublished` a les chemins d'emblée.
- **`CardPreview.tsx` (mini-vignettes de grille)** — affiche le composite baké `image` **dès
  qu'il existe** (chemin **ou** data-URL), **sans** recomposer ; ne recompose (via
  `renderCardFace`) que si `image` est absente. C'est une règle **plus large** que
  `isPreRenderedCard` (qui, lui, recompose quand `artImage` existe) : dans la grille on
  privilégie toujours le baké pour l'ouverture rapide. Concrètement, la condition « afficher
  le baké » de `CardPreview` devient `!!card.image` (au lieu de `isPreRenderedCard`).
- **`CardLayout.tsx` (grand aperçu de la carte sélectionnée)** — recompose en live depuis
  `artImage` (chemin géré par `loadImage`, déjà OK) ; sauf carte pré-rendue sans art
  (`isPreRenderedCard`, repli déjà en place). C'est le SEUL endroit qui recompose en live.
- **`VillainDetailModal.tsx`** — suppression du spinner d'hydratation (`_light`) ; les
  images se chargent par `<img>`.
- **`scripts/migrate-villain-images.mjs` (nouveau)** — one-shot idempotent : pour chacun
  des 6 JSON publiés, applique `imageExternalize`, écrit fichiers + JSON chemins, supprime
  `light/`. Rejouable sans dégât.

### Flux de données

**Publication (DEV)** : Atelier « Terminer/Save » → POST `/__publish-villain` avec le
vilain complet (data-URLs) → `imageExternalize` → écriture fichiers `public/cards/custom-<id>/`
+ JSON chemins `src/data/published/<id>.json` → commit → déploiement statique.

**Chargement (prod & dev)** : au démarrage, glob des petits JSON → registre (chemins) →
UI rend `<img src="/cards/custom-<id>/…?v=…">` (lazy + cache navigateur).

**Édition d'un brouillon local (app déployée)** : images en data-URL dans IndexedDB ;
pas d'écriture fichier possible (pas de backend) — publication réservée au DEV.

### Suppressions (retrait light/full)

`src/data/published/light/` (dossier + 6 fichiers), `lighten.ts`, `loadBundledVillains`
(variante light), `loadFullBundledVillain`, `hydrate`, marqueur `_light` et ses usages
(store, `VillainDetailModal`, `VillainEditor.startEdit`, `Root.tsx`).

## Contraintes prod / sans backend

La publication est **DEV-only** (inchangé) : elle écrit fichiers + JSON via les endpoints
vite, puis l'utilisateur committe. L'app déployée sert les fichiers committés par URL et ne
publie pas ; un utilisateur y crée/édite des brouillons **locaux** (data-URL en IndexedDB).

## Gestion d'erreurs

- data-URL illisible à l'externalisation → on **échoue explicitement** la publication de ce
  champ (log clair), on n'écrit pas un vilain à moitié migré.
- Image manquante au runtime (`onerror`) → placeholder « … » (comportement `<img>` actuel).
- Cache-busting : `?v=updatedAt` garantit qu'une image republiée n'est pas servie périmée.

## Tests

- **Unitaires purs** (`imageExternalize`) : data-URL → fichier + chemin ; constructeur de
  chemins (chaque champ → nom attendu) ; **idempotence** (rejouer sur un vilain déjà en
  chemins ne casse rien) ; champs absents/optionnels ignorés proprement.
- **Intégrité** (par vilain publié) : le JSON ne contient **aucun** `data:` ; chaque chemin
  référencé **existe** physiquement sous `public/` (étend les tests d'intégrité existants).
- **Non-régression** : `isPreRenderedCard` couvre chemin **et** data-URL (déjà testé).

## Hors périmètre (YAGNI)

- Conversion de format (WebP…) : on garde les octets d'origine (PNG/mp3), pas de ré-encodage.
- Externalisation des images de brouillons locaux : impossible sans backend, non nécessaire.
- Refonte du bake lui-même.
