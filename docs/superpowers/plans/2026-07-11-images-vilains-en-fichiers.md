# Externalisation des images des vilains custom — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir toutes les images (et l'audio) des vilains custom publiés du JSON base64 vers des fichiers servis sous `public/cards/custom-<id>/`, pour que le JSON tombe à quelques Ko et que l'ouverture dans l'Atelier soit instantanée.

**Architecture:** Une logique **pure** (`imageExternalize.mjs`) transforme un vilain complet (data-URLs) en `{ villain: <JSON chemins>, files: [...] }`. L'endpoint DEV `/__publish-villain` et un script de migration one-shot l'utilisent pour écrire les fichiers + un JSON « chemins ». Le mécanisme light/full (v1.4.1) devient inutile et est retiré : un seul petit JSON par vilain est chargé au démarrage.

**Tech Stack:** Vite + React 19 + TypeScript + Zustand ; Vitest ; scripts Node `.mjs` (pas de tsx/vite-node dans le repo).

## Global Constraints

- Tout en **français** (commentaires, UI, notes). Copié verbatim du CLAUDE.md.
- Moteur `engine/` reste pur (aucun `Math.random`/`Date.now`/`new Date`) — non concerné ici.
- Avant chaque commit : `npm run test` **et** `npm run lint` passent. Committer directement sur `main` (pas de branche/PR).
- Numérotation `PATCH` (pas de nouveau vilain) : la prochaine entrée `PATCH_NOTES` est **v1.4.3** (dernière poussée = 1.4.1, dernière locale committée = 1.4.2).
- Emplacement des fichiers image : `public/cards/custom-<id>/` (aligné sur les natifs). Chemins référencés en absolu (`/cards/custom-<id>/<nom>.<ext>?v=<updatedAt-ms>`).
- Un champ image accepte **data-URL _ou_ chemin** partout ; on ne casse pas les brouillons locaux (data-URL en IndexedDB).
- Octets écrits **tels quels** (décodage base64 → fichier), aucun ré-encodage.

## Inventaire des champs image (source de vérité : `src/data/published/lighten.ts`)

| Champ JSON                      | Base de nom de fichier      |
|---------------------------------|-----------------------------|
| `cards[].image`                 | `<cardId>`                  |
| `cards[].artImage`              | `<cardId>.art`              |
| `portrait`                      | `portrait`                  |
| `presentation`                  | `presentation`             |
| `portraitRaw`                   | `portrait-raw`              |
| `boardImage`                    | `board`                     |
| `boardArt`                      | `board-art`                 |
| `altBoardImage`                 | `board-alt`                 |
| `pawnImage`                     | `pawn`                      |
| `backVillainImage`              | `back-villain`              |
| `backFateImage`                 | `back-fate`                 |
| `backExtraImage`                | `back-extra`                |
| `backOverlays[i].image`         | `back-overlay-<i>`          |
| `backExtra.overlays[i].image`   | `back-extra-overlay-<i>`    |
| `locations[i].image`            | `loc-<locId>`               |
| `locations[i].alt.image`        | `loc-<locId>.alt`           |
| `locations[i].alt.columnImage`  | `loc-<locId>.alt-col`       |
| `audio`                         | `audio`                     |

L'extension dérive du MIME de la data-URL (`image/png`→`png`, `image/jpeg`→`jpg`, `image/webp`→`webp`, `audio/mpeg`→`mp3`, `audio/wav`→`wav`).

## File Structure

- **Create** `src/data/published/imageExternalize.mjs` — logique pure (path builder + extraction). Aucune I/O.
- **Create** `src/data/published/__tests__/imageExternalize.test.ts` — tests unitaires purs.
- **Create** `scripts/migrate-villain-images.mjs` — migration one-shot (I/O) des JSON publiés + brouillons.
- **Create** `src/data/__tests__/publishedNoDataUrl.test.ts` — intégrité : aucun `data:` dans les JSON publiés + fichiers référencés présents.
- **Modify** `src/ui/editor/CardPreview.tsx` — préférer le composite baké `image` dès qu'il existe.
- **Modify** `vite.config.ts` (`/__publish-villain`) — externaliser via `imageExternalize`, écrire fichiers + JSON chemins.
- **Modify** `src/data/published/load.ts` — un seul glob (retrait light/full).
- **Modify** `src/ui/store/customVillainStore.ts` — retrait `hydrate` + `_light`.
- **Modify** `src/data/customVillain.ts` (`pickFreshestVillains`) — retrait de la logique `_light`.
- **Modify** `src/ui/components/VillainDetailModal.tsx` — retrait du spinner d'hydratation.
- **Modify** `src/ui/screens/VillainEditor.tsx` — retrait de l'appel `hydrate` dans `startEdit`.
- **Modify** `src/ui/Root.tsx` — retrait du préchargement `hydrate`.
- **Delete** `src/data/published/lighten.ts` + dossier `src/data/published/light/`.
- **Modify** `src/data/published/customVillain` types si `_light` y est déclaré (retrait du champ).

---

## Task 1 : Module pur `imageExternalize.mjs`

**Files:**
- Create: `src/data/published/imageExternalize.mjs`
- Test: `src/data/published/__tests__/imageExternalize.test.ts`

**Interfaces:**
- Produces:
  - `externalizeVillainImages(villain: object, opts?: { versionMs?: number }): { villain: object, files: Array<{ path: string, base64: string, mime: string }> }`
    - `villain` : copie profonde où chaque champ image data-URL est remplacé par un chemin `/cards/<id>/<nom>.<ext>?v=<versionMs>`.
    - `files` : un élément par image extraite ; `path` relatif à `public/` (ex. `cards/custom-dio/portrait.png`).
    - Idempotent : un champ déjà en chemin (non `data:`) est laissé intact et ne produit pas de fichier.
  - `IMAGE_FIELD_PLAN` (exporté pour test) : structure décrivant l'inventaire ci-dessus.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/data/published/__tests__/imageExternalize.test.ts
import { describe, it, expect } from 'vitest'
import { externalizeVillainImages } from '../imageExternalize.mjs'

const PNG = 'data:image/png;base64,QUJD' // "ABC"
const JPG = 'data:image/jpeg;base64,REVG' // "DEF"

const villain = () => ({
  id: 'custom-test',
  updatedAt: '2026-07-11T00:00:00.000Z',
  portrait: PNG,
  presentation: JPG,
  boardImage: PNG,
  pawnImage: PNG,
  backVillainImage: PNG,
  backFateImage: PNG,
  boardArt: PNG,
  audio: 'data:audio/mpeg;base64,QQ==',
  locations: [{ id: 'loc-a', image: PNG, alt: { image: JPG, columnImage: PNG } }],
  cards: [
    { id: 'ma-carte', image: PNG, artImage: JPG },
    { id: 'sans-art', image: PNG },
  ],
})

describe('externalizeVillainImages', () => {
  it('remplace chaque data-URL par un chemin /cards/<id>/… et liste les fichiers', () => {
    const { villain: out, files } = externalizeVillainImages(villain())
    expect(out.portrait).toBe('/cards/custom-test/portrait.png?v=1783641600000')
    expect(out.presentation).toBe('/cards/custom-test/presentation.jpg?v=1783641600000')
    expect(out.cards[0].image).toBe('/cards/custom-test/ma-carte.png?v=1783641600000')
    expect(out.cards[0].artImage).toBe('/cards/custom-test/ma-carte.art.jpg?v=1783641600000')
    expect(out.cards[1].image).toBe('/cards/custom-test/sans-art.png?v=1783641600000')
    expect(out.locations[0].image).toBe('/cards/custom-test/loc-loc-a.png?v=1783641600000')
    expect(out.locations[0].alt.image).toBe('/cards/custom-test/loc-loc-a.alt.jpg?v=1783641600000')
    expect(out.locations[0].alt.columnImage).toBe('/cards/custom-test/loc-loc-a.alt-col.png?v=1783641600000')
    expect(out.audio).toBe('/cards/custom-test/audio.mp3?v=1783641600000')
    // un fichier par image (7 top + 3 loc + 3 cartes = 13)
    expect(files.length).toBe(13)
    const p = files.find((f) => f.path === 'cards/custom-test/portrait.png')
    expect(p).toEqual({ path: 'cards/custom-test/portrait.png', base64: 'QUJD', mime: 'image/png' })
  })

  it('est idempotent : un champ déjà en chemin est laissé intact, aucun fichier produit', () => {
    const already = { id: 'custom-test', updatedAt: '2026-07-11T00:00:00.000Z',
      portrait: '/cards/custom-test/portrait.png?v=1', cards: [], locations: [] }
    const { villain: out, files } = externalizeVillainImages(already)
    expect(out.portrait).toBe('/cards/custom-test/portrait.png?v=1')
    expect(files.length).toBe(0)
  })

  it('ignore proprement les champs absents', () => {
    const min = { id: 'custom-x', updatedAt: '2026-07-11T00:00:00.000Z', cards: [], locations: [] }
    const { villain: out, files } = externalizeVillainImages(min)
    expect(files.length).toBe(0)
    expect(out.id).toBe('custom-x')
  })
})
```

- [ ] **Step 2: Lancer le test → échec (module absent)**

Run: `npx vitest run src/data/published/__tests__/imageExternalize.test.ts`
Expected: FAIL — `Cannot find module '../imageExternalize.mjs'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

```js
// src/data/published/imageExternalize.mjs
// =============================================================================
// Externalisation des images d'un vilain custom : transforme un vilain COMPLET
// (images en data-URL base64) en un vilain « chemins » + la liste des fichiers à
// écrire sous public/. Fichier PUR (aucune I/O, aucun import) : consommé par
// l'endpoint de publication (vite.config.ts) ET le script de migration.
// =============================================================================

/** MIME → extension de fichier. */
const EXT_BY_MIME = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav',
}

function parseDataUrl(s) {
  if (typeof s !== 'string' || !s.startsWith('data:')) return null
  const m = /^data:([^;]+);base64,(.+)$/s.exec(s)
  return m ? { mime: m[1], base64: m[2] } : null
}

/** Traite UN champ image d'un objet : si data-URL, écrit le fichier et remplace par le chemin. */
function processField(obj, key, base, ctx) {
  const parsed = parseDataUrl(obj[key])
  if (!parsed) return // absent, ou déjà un chemin → idempotent
  const ext = EXT_BY_MIME[parsed.mime] ?? 'bin'
  const filename = `${base}.${ext}`
  const relPath = `cards/${ctx.id}/${filename}`
  ctx.files.push({ path: relPath, base64: parsed.base64, mime: parsed.mime })
  obj[key] = `/cards/${ctx.id}/${filename}?v=${ctx.versionMs}`
}

/**
 * @param {object} villain  Vilain complet (data-URLs).
 * @param {{versionMs?: number}} [opts]  Version pour le cache-bust (défaut : Date.parse(updatedAt)).
 * @returns {{villain: object, files: Array<{path:string, base64:string, mime:string}>}}
 */
export function externalizeVillainImages(villain, opts = {}) {
  const out = JSON.parse(JSON.stringify(villain))
  const versionMs = opts.versionMs ?? Date.parse(out.updatedAt ?? '') || 0
  const ctx = { id: out.id, versionMs, files: [] }

  processField(out, 'portrait', 'portrait', ctx)
  processField(out, 'presentation', 'presentation', ctx)
  processField(out, 'portraitRaw', 'portrait-raw', ctx)
  processField(out, 'boardImage', 'board', ctx)
  processField(out, 'boardArt', 'board-art', ctx)
  processField(out, 'altBoardImage', 'board-alt', ctx)
  processField(out, 'pawnImage', 'pawn', ctx)
  processField(out, 'backVillainImage', 'back-villain', ctx)
  processField(out, 'backFateImage', 'back-fate', ctx)
  processField(out, 'backExtraImage', 'back-extra', ctx)
  processField(out, 'audio', 'audio', ctx)

  if (Array.isArray(out.backOverlays)) {
    out.backOverlays.forEach((o, i) => processField(o, 'image', `back-overlay-${i}`, ctx))
  }
  if (out.backExtra && Array.isArray(out.backExtra.overlays)) {
    out.backExtra.overlays.forEach((o, i) => processField(o, 'image', `back-extra-overlay-${i}`, ctx))
  }
  if (Array.isArray(out.locations)) {
    for (const l of out.locations) {
      processField(l, 'image', `loc-${l.id}`, ctx)
      if (l.alt) {
        processField(l.alt, 'image', `loc-${l.id}.alt`, ctx)
        processField(l.alt, 'columnImage', `loc-${l.id}.alt-col`, ctx)
      }
    }
  }
  if (Array.isArray(out.cards)) {
    for (const c of out.cards) {
      processField(c, 'image', `${c.id}`, ctx)
      processField(c, 'artImage', `${c.id}.art`, ctx)
    }
  }
  return { villain: out, files: ctx.files }
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run src/data/published/__tests__/imageExternalize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/data/published/imageExternalize.mjs src/data/published/__tests__/imageExternalize.test.ts
git commit -m "Externalisation images : module pur imageExternalize + tests"
```

---

## Task 2 : Script de migration + intégrité, et RUN de la migration

**Files:**
- Create: `scripts/migrate-villain-images.mjs`
- Create: `src/data/__tests__/publishedNoDataUrl.test.ts`
- Modify (par le run) : `src/data/published/custom-*.json`, `src/data/drafts/custom-*.json`, ajout de `public/cards/custom-*/**`
- Delete (par le run) : `src/data/published/light/**`

**Interfaces:**
- Consumes: `externalizeVillainImages` (Task 1).
- Produces: les JSON publiés/brouillons en **chemins** + les fichiers sous `public/cards/`.

- [ ] **Step 1: Écrire le test d'intégrité (échouera tant que la migration n'est pas lancée)**

```ts
// src/data/__tests__/publishedNoDataUrl.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PUB = resolve(__dirname, '../published')
const PUBLIC = resolve(__dirname, '../../../public')
const files = readdirSync(PUB).filter((f) => f.endsWith('.json') && f.startsWith('custom-'))

describe('JSON publiés : images en fichiers (aucune data-URL)', () => {
  for (const f of files) {
    it(`${f} ne contient aucune data-URL`, () => {
      const raw = readFileSync(resolve(PUB, f), 'utf8')
      expect(raw.includes('data:image')).toBe(false)
      expect(raw.includes('data:audio')).toBe(false)
    })
    it(`${f} : chaque chemin /cards/… référencé existe sous public/`, () => {
      const v = JSON.parse(readFileSync(resolve(PUB, f), 'utf8'))
      const paths = new Set()
      const walk = (o) => {
        if (typeof o === 'string') { const m = /^\/cards\/[^?]+/.exec(o); if (m) paths.add(m[0]); return }
        if (Array.isArray(o)) return o.forEach(walk)
        if (o && typeof o === 'object') return Object.values(o).forEach(walk)
      }
      walk(v)
      for (const p of paths) expect(existsSync(resolve(PUBLIC, p.slice(1)))).toBe(true)
    })
  }
})
```

- [ ] **Step 2: Lancer → échec (les JSON contiennent encore des data-URL)**

Run: `npx vitest run src/data/__tests__/publishedNoDataUrl.test.ts`
Expected: FAIL (`data:image` présent).

- [ ] **Step 3: Écrire le script de migration**

```js
// scripts/migrate-villain-images.mjs
// One-shot idempotent : externalise les images des vilains custom (publiés + brouillons)
// vers public/cards/custom-<id>/, réécrit les JSON en chemins, et supprime le dossier
// light/ devenu inutile. Bump updatedAt pour que la version « chemins » supplante toute
// copie IndexedDB base64 (pickFreshestVillains garde la plus récente).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { externalizeVillainImages } from '../src/data/published/imageExternalize.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')
const DIRS = [resolve(ROOT, 'src/data/published'), resolve(ROOT, 'src/data/drafts')]
const NOW = new Date().toISOString()

function writeFiles(files) {
  for (const f of files) {
    const dest = resolve(PUBLIC, f.path)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, Buffer.from(f.base64, 'base64'))
  }
}

for (const dir of DIRS) {
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (!name.startsWith('custom-') || !name.endsWith('.json')) continue
    const path = resolve(dir, name)
    const v = JSON.parse(readFileSync(path, 'utf8'))
    v.updatedAt = NOW // bump : supplante l'IndexedDB base64
    const { villain, files } = externalizeVillainImages(v)
    writeFiles(files)
    writeFileSync(path, JSON.stringify(villain, null, 2))
    console.log(`${dir.split(/[\\/]/).pop()}/${name} : ${files.length} images écrites`)
  }
}

const LIGHT = resolve(ROOT, 'src/data/published/light')
if (existsSync(LIGHT)) { rmSync(LIGHT, { recursive: true, force: true }); console.log('light/ supprimé') }
console.log('Migration terminée.')
```

- [ ] **Step 4: Lancer la migration**

Run: `node scripts/migrate-villain-images.mjs`
Expected: lignes « custom-*.json : N images écrites » + « light/ supprimé ».

- [ ] **Step 5: Vérifier l'intégrité**

Run: `npx vitest run src/data/__tests__/publishedNoDataUrl.test.ts`
Expected: PASS (aucune data-URL ; tous les chemins existent).

- [ ] **Step 6: Vérifier la taille des JSON**

Run: `node -e "const fs=require('fs');for(const f of fs.readdirSync('src/data/published').filter(x=>x.startsWith('custom-')))console.log(f,(fs.statSync('src/data/published/'+f).size/1024).toFixed(0)+' Ko')"`
Expected: chaque JSON ≪ 1 Mo (quelques dizaines de Ko).

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate-villain-images.mjs src/data/__tests__/publishedNoDataUrl.test.ts src/data/published src/data/drafts public/cards
git rm -r --cached src/data/published/light 2>/dev/null; true
git commit -m "Externalisation images : migration des 6 vilains publiés vers public/cards + intégrité"
```

---

## Task 3 : `CardPreview` privilégie le composite baké

**Files:**
- Modify: `src/ui/editor/CardPreview.tsx`
- Test: `src/ui/editor/__tests__/isPreRenderedCard.test.ts` (existant — on n'y touche pas ; il reste valable)

**Interfaces:**
- Consumes: `card.image` (chemin ou data-URL), `card.artImage`.
- Produces: aucune API ; comportement UI (grille rapide).

**Contexte** : après migration, chaque carte a `image` **et** `artImage` (chemins). Dans la grille, on veut afficher le baké **sans recomposer** (sinon 30+ rendus canvas à l'ouverture). Règle plus large que `isPreRenderedCard` : afficher le baké dès que `image` existe.

- [ ] **Step 1: Remplacer le prédicat dans `CardPreview.tsx`**

Remplacer (introduit au commit précédent) :

```tsx
  // Face PRÉ-RENDUE (sans art brut `artImage` à recomposer, mais `image` finie) : c'est déjà
  // la carte terminée — chemin externe (vilains migrés) OU composite baké en dataURL (vilains
  // « compressés » n'embarquant que le composite, ex. Dio). On l'affiche telle quelle : la
  // recomposer via renderCardFace donnerait une carte SANS illustration (cf. isPreRenderedCard).
  const preRendered = isPreRenderedCard(card)
```

par :

```tsx
  // Mini-vignette de grille : on affiche le composite déjà baké `image` DÈS qu'il existe
  // (chemin OU data-URL), SANS recomposer — l'ouverture reste instantanée même si chaque
  // carte a un `artImage`. On ne recompose (renderCardFace) que si aucune `image` bakée
  // n'est disponible (carte en cours de création). La recomposition live reste réservée au
  // grand aperçu (CardLayout).
  const preRendered = !!card.image
```

Supprimer l'import devenu inutile s'il ne sert plus : garder `renderCardFace`, retirer `isPreRenderedCard` de l'import de `CardPreview.tsx` (il reste utilisé par `CardLayout.tsx`).

- [ ] **Step 2: Vérifier le typecheck + lint**

Run: `npx tsc -b && npm run lint`
Expected: aucune erreur (pas d'import inutilisé).

- [ ] **Step 3: Vérifier que le test existant passe toujours**

Run: `npx vitest run src/ui/editor/__tests__/isPreRenderedCard.test.ts`
Expected: PASS (le helper reste utilisé par CardLayout ; ses tests restent verts).

- [ ] **Step 4: Commit**

```bash
git add src/ui/editor/CardPreview.tsx
git commit -m "Atelier : mini-vignettes affichent le composite baké (ouverture instantanée)"
```

---

## Task 4 : Endpoint `/__publish-villain` — externaliser à la publication

**Files:**
- Modify: `vite.config.ts` (handler `/__publish-villain`, ~lignes 360-470) et l'import en tête.

**Interfaces:**
- Consumes: `externalizeVillainImages` (Task 1).
- Produces: à chaque publication/save d'un vilain publié → fichiers sous `public/cards/custom-<id>/` + JSON chemins dans `src/data/published/<id>.json`.

**Prérequis de lecture** : lire le handler `/__publish-villain` actuel (il parse `{ id, json }`, écrit `FILE = src/data/published/<id>.json`, et régénère `light/<id>.json` via `lightenVillain`).

- [ ] **Step 1: Ajouter l'import en tête de `vite.config.ts`**

À côté de `import { lightenVillain } from './src/data/published/lighten'` (qui sera retiré en Task 5), ajouter :

```ts
import { externalizeVillainImages } from './src/data/published/imageExternalize.mjs'
```

- [ ] **Step 2: Externaliser dans le handler avant d'écrire le JSON**

Dans le handler, remplacer la logique qui écrit `FILE` avec le JSON reçu tel quel par :

```ts
// Le vilain reçu contient les images en data-URL : on les écrit en fichiers sous
// public/cards/custom-<id>/ et on ne persiste dans le JSON que des chemins.
const full = JSON.parse(src) // src = json reçu
const { villain: pathsVillain, files } = externalizeVillainImages(full)
for (const f of files) {
  const dest = resolve(PUBLIC, f.path)
  mkdirSync(dirname(dest), { recursive: true })
  atomicWriteFileSync(dest, Buffer.from(f.base64, 'base64'))
}
atomicWriteFileSync(FILE, JSON.stringify(pathsVillain, null, 2))
```

(`PUBLIC`, `atomicWriteFileSync`, `mkdirSync`, `dirname`, `resolve` sont déjà importés/définis dans `vite.config.ts` — vérifier et compléter les imports `node:fs`/`node:path` si besoin.)

- [ ] **Step 3: Laisser la régénération `light/` en place POUR L'INSTANT**

Ne pas toucher au bloc `lightenVillain` dans ce task : `lightenVillain(pathsVillain)` produit un light valide (il retire les champs lourds ; portrait/présentation sont désormais des chemins courts). Le retrait complet du light se fait en Task 5, pour que l'app reste fonctionnelle après chaque task.

- [ ] **Step 4: Vérifier le build**

Run: `npx tsc -b`
Expected: aucune erreur.

- [ ] **Step 5: Test manuel de publication (facultatif mais recommandé)**

Lancer `npm run dev`, ouvrir un vilain dans l'Atelier, « Enregistrer ». Vérifier que `src/data/published/<id>.json` reste en chemins (pas de data-URL réintroduite) et que les fichiers existent sous `public/cards/`.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts
git commit -m "Atelier : la publication externalise les images en fichiers (public/cards)"
```

---

## Task 5 : Retrait du mécanisme light/full (cutover)

**Files:**
- Modify: `src/data/published/load.ts`
- Modify: `src/ui/store/customVillainStore.ts`
- Modify: `src/data/customVillain.ts` (`pickFreshestVillains`, type `CustomVillain._light`)
- Modify: `src/ui/components/VillainDetailModal.tsx`
- Modify: `src/ui/screens/VillainEditor.tsx`
- Modify: `src/ui/Root.tsx`
- Modify: `vite.config.ts` (retrait de la régénération `light/` + import `lightenVillain`)
- Delete: `src/data/published/lighten.ts`
- Test: mettre à jour `src/data/__tests__/pickFreshestVillains.test.ts`

**Interfaces:**
- Produces: `loadBundledVillains(): Promise<CustomVillain[]>` (charge les petits JSON complets, sans notion de light). Suppression de `loadFullBundledVillain`, `hydrate`, `_light`.

**Contexte** : après Task 2, les JSON complets sont minuscules (chemins). On peut donc charger le JSON complet directement au démarrage et supprimer tout le light/hydrate.

- [ ] **Step 1: Simplifier `load.ts`**

Remplacer le contenu de `src/data/published/load.ts` par un seul glob des JSON complets :

```ts
// Vilains PUBLIÉS embarqués (JSON « chemins », quelques Ko). Un seul glob : plus de
// split light/full — les images sont des fichiers servis sous public/cards/.
import type { CustomVillain } from '../customVillain'

const loaders = import.meta.glob('./*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>

function isVillain(v: unknown): v is CustomVillain {
  const cv = v as CustomVillain
  return !!cv && typeof cv.id === 'string' && Array.isArray(cv.cards)
}

/** Charge tous les vilains embarqués (versions complètes « chemins »), en préservant leur
 *  statut de publication (`published: false` = soft-dépublié ; absent = publié). */
export async function loadBundledVillains(): Promise<CustomVillain[]> {
  const mods = await Promise.all(Object.values(loaders).map((load) => load()))
  return mods.filter(isVillain).map((cv) => ({ ...cv, published: cv.published !== false }))
}
```

- [ ] **Step 2: Retirer `hydrate` et `_light` de `customVillainStore.ts`**

- Supprimer la méthode `hydrate` (déclaration dans l'interface + implémentation, ~lignes 158-163 et 260-274).
- Dans `load` : remplacer la ligne `for (const v of toPersist) if (!v._light) await idbPut(v)` par `for (const v of toPersist) await idbPut(v)`.
- Retirer l'import `loadFullBundledVillain` (garder `loadBundledVillains`).
- Dans `save`, supprimer `delete clean._light` (le champ n'existe plus).

- [ ] **Step 3: Retirer `_light` de `pickFreshestVillains` + type**

- Dans `src/data/customVillain.ts` : supprimer le champ `_light?: boolean` du type `CustomVillain`.
- `pickFreshestVillains` ne référence pas `_light` directement (le filtrage était dans le store) ; vérifier et retirer toute mention. La fonction reste inchangée sur la logique `updatedAt`.

- [ ] **Step 4: Mettre à jour `pickFreshestVillains.test.ts`**

Retirer les cas qui asservissent au marqueur `_light` (le champ n'existe plus). Conserver les cas « la version la plus récente par updatedAt gagne ; à égalité, l'IndexedDB local gagne ». Exécuter le fichier pour cadrer les attentes :

Run: `npx vitest run src/data/__tests__/pickFreshestVillains.test.ts`
Expected: PASS après ajustement.

- [ ] **Step 5: Simplifier `VillainDetailModal.tsx`**

- Supprimer `hydrate`, l'`useEffect` d'hydratation, `imagesReady` (dérivé de `_light`) et le spinner conditionnel : `villainEntry(villain)` a désormais toutes les images (chemins) d'emblée ; les `<img>` chargent paresseusement.
- Remplacer l'usage de `imagesReady` par un affichage direct des galeries.

- [ ] **Step 6: Simplifier `VillainEditor.startEdit`**

Remplacer :

```tsx
    setOpening(v.id)
    try {
      const full = await hydrate(v.id)
      setDraft(structuredClone(full ?? v))
```

par :

```tsx
    // Plus d'hydratation : le vilain listé est déjà complet (JSON « chemins »).
    setDraft(structuredClone(v))
```

et retirer `opening`/`setOpening` s'ils ne servent plus qu'à ça (sinon les garder inertes), et retirer `hydrate` de la déstructuration `useCustomVillainStore()`.

- [ ] **Step 7: Retirer le préchargement `hydrate` de `Root.tsx`**

Supprimer (Root.tsx ~lignes 206-207) :

```tsx
      const { hydrate } = useCustomVillainStore.getState()
      await Promise.all(customs.map((id) => hydrate(id)))
```

(Conserver `useGameStore.getState().hydrateResumedImages()` s'il existe et concerne autre chose que les vilains custom — le vérifier ; sinon l'adapter.)

- [ ] **Step 8: Retirer la régénération `light/` de `vite.config.ts` + supprimer `lighten.ts`**

- Dans `/__publish-villain` : supprimer le bloc qui appelle `lightenVillain` et écrit `light/<id>.json`, ainsi que toute autre référence au dossier `LIGHT`.
- Supprimer l'import `import { lightenVillain } from './src/data/published/lighten'`.
- `git rm src/data/published/lighten.ts`.

- [ ] **Step 9: Build + suite complète + lint**

Run: `npx tsc -b && npm run test && npm run lint`
Expected: build OK ; tests verts (hors flake connu `strength.test.ts`, à reconfirmer en isolation si besoin) ; lint OK.

- [ ] **Step 10: Test de fumée dans l'app**

Lancer `npm run dev` : la liste des vilains s'affiche ; **ouvrir Dio dans l'Atelier** → images de cartes présentes et **ouverture instantanée** ; lancer une partie contre un vilain custom → cartes/plateau OK.

- [ ] **Step 11: Note de version + commit**

Ajouter en tête de `PATCH_NOTES` (`src/ui/patchNotes.ts`) l'entrée **v1.4.3** :

```ts
  {
    version: '1.4.3',
    date: '2026-07-11',
    title: 'Vilains custom plus légers',
    tags: ['atelier', 'interface'],
    changes: [
      "Les **images des vilains** sont désormais des **fichiers** (plus de gros JSON) : l'**Atelier s'ouvre instantanément** et les images se chargent à la volée.",
    ],
  },
```

```bash
git add -A
git commit -m "v1.4.3 : images des vilains custom en fichiers, retrait du light/full"
```

---

## Self-Review

**Spec coverage :**
- Modèle données (chemins publiés / data-URL brouillons) → Tasks 1, 2. ✓
- Emplacement `public/cards/custom-<id>/` → Task 1 (path builder), 2 (run), 4 (endpoint). ✓
- Inventaire exhaustif des champs → Task 1 (table + code). ✓
- Cache-bust `?v=updatedAt` → Task 1. ✓
- Migration des 6 + retrait light/full → Task 2 (migration), Task 5 (cutover). ✓
- Mini-vignettes = baké (option a), grand aperçu = live → Task 3 (CardPreview), CardLayout inchangé (déjà live + repli isPreRenderedCard). ✓
- Externalisation à la publication → Task 4. ✓
- Contraintes prod/no-backend (publish DEV-only, brouillons data-URL) → inchangé, respecté par la migration ciblant published/drafts et l'endpoint DEV. ✓
- Tests (purs + intégrité) → Task 1, 2. ✓
- Audio externalisé → Task 1 (champ `audio`). ✓

**Placeholder scan :** aucun TODO/TBD ; code fourni pour chaque étape de logique.

**Type consistency :** `externalizeVillainImages(villain, opts) → {villain, files:[{path,base64,mime}]}` cohérent entre Task 1 (def), Task 2 (script) et Task 4 (endpoint). `loadBundledVillains` conserve sa signature ; `loadFullBundledVillain`/`hydrate`/`_light` retirés partout (Task 5).

**Points de vigilance à l'exécution :**
- Task 2 bumpe `updatedAt` (NOW) → suppose que ce jour ≥ dates existantes ; sinon ajuster pour garantir la supériorité sur l'IndexedDB.
- `atomicWriteFileSync`/`PUBLIC` doivent exister dans `vite.config.ts` (Task 4) — sinon réutiliser `writeFileSync` + la constante du fichier.
- Vérifier que `hydrateResumedImages` (Root.tsx) est indépendant des vilains custom avant de retirer le bloc `hydrate` (Task 7).
