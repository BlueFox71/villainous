/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, renameSync, readdirSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { externalizeVillainImages } from './src/data/published/imageExternalize.mjs'

/**
 * Écriture ATOMIQUE : écrit dans un fichier temporaire voisin puis `rename` sur la
 * destination (opération atomique au sein d'un même système de fichiers). Un lecteur (git,
 * le watcher, une relecture) ne voit jamais un fichier à moitié écrit, et deux écritures
 * concurrentes ne s'entrelacent pas dans le même fichier. Le `.tmp` est suffixé par le PID
 * pour éviter toute collision entre écritures simultanées vers la même cible.
 */
function atomicWriteFileSync(dest: string, data: string | Buffer): void {
  const tmp = `${dest}.${process.pid}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, dest)
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-action-pos` qui réécrit le bloc
 * `ACTION_POS['<vilain>'] = { … }` de `src/ui/components/BoardActions.tsx` depuis
 * l'éditeur de positions du mode test (corps : `{ villain, block }`). Absent du build
 * de production (`apply: 'serve'`).
 */
function saveActionPosPlugin(): Plugin {
  const FILE = resolve(process.cwd(), 'src/ui/components/BoardActions.tsx')
  return {
    name: 'save-action-pos',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-action-pos', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { villain, block } = JSON.parse(body) as { villain: string; block: string }
            if (typeof villain !== 'string' || typeof block !== 'string') throw new Error('payload invalide')
            let src = readFileSync(FILE, 'utf8')
            const esc = villain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(`ACTION_POS\\['${esc}'\\] = \\{[\\s\\S]*?\\n\\}`)
            if (re.test(src)) src = src.replace(re, block)
            else src = src.replace('\ninterface Props {', `\n${block}\n\ninterface Props {`)
            writeFileSync(FILE, src, 'utf8')
            res.statusCode = 200
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-blocked-overlay` qui réécrit le bloc
 * `BLOCKED_OVERLAY['<vilain>'] = { … }` de `src/ui/components/BoardImage.tsx` depuis
 * l'éditeur de positions du mode test (corps : `{ villain, block }`, `villain` = id du
 * VillainDef). Absent du build de production (`apply: 'serve'`).
 */
function saveBlockedOverlayPlugin(): Plugin {
  const FILE = resolve(process.cwd(), 'src/ui/components/BoardImage.tsx')
  const MARKER = '// >>> BLOCKED_OVERLAY entries (éditeur de positions) — ne pas éditer à la main <<<'
  return {
    name: 'save-blocked-overlay',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-blocked-overlay', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { villain, block } = JSON.parse(body) as { villain: string; block: string }
            if (typeof villain !== 'string' || typeof block !== 'string') throw new Error('payload invalide')
            let src = readFileSync(FILE, 'utf8')
            const esc = villain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(`BLOCKED_OVERLAY\\['${esc}'\\] = \\{[\\s\\S]*?\\n\\}`)
            if (re.test(src)) src = src.replace(re, block)
            else if (src.includes(MARKER)) src = src.replace(MARKER, `${MARKER}\n${block}`)
            else throw new Error('marqueur BLOCKED_OVERLAY introuvable')
            writeFileSync(FILE, src, 'utf8')
            res.statusCode = 200
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-pawn-size` qui réécrit la ligne
 * `pawnHeightPx: <n>,` du fichier `src/data/villains/<vilain>.ts` depuis l'éditeur
 * de pion du mode test (corps : `{ villain, size }`, où `villain` = id du VillainDef).
 * On localise le fichier en cherchant celui qui déclare `id: '<villain>'` ET un
 * `pawnHeightPx:`. Absent du build de production (`apply: 'serve'`).
 */
function savePawnSizePlugin(): Plugin {
  const DIR = resolve(process.cwd(), 'src/data/villains')
  return {
    name: 'save-pawn-size',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-pawn-size', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { villain, size } = JSON.parse(body) as { villain: string; size: number }
            if (typeof villain !== 'string' || typeof size !== 'number' || !Number.isFinite(size))
              throw new Error('payload invalide')
            const px = Math.round(size)
            // Fichiers de définition de vilain (on exclut les `.cards.ts`).
            const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.cards.ts'))
            const esc = villain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const idRe = new RegExp(`id:\\s*['"]${esc}['"]`)
            const target = files.find((f) => {
              const src = readFileSync(join(DIR, f), 'utf8')
              return idRe.test(src) && /pawnHeightPx:\s*\d+/.test(src)
            })
            if (!target) throw new Error(`vilain « ${villain} » introuvable`)
            const path = join(DIR, target)
            const src = readFileSync(path, 'utf8')
            writeFileSync(path, src.replace(/pawnHeightPx:\s*\d+/, `pawnHeightPx: ${px}`), 'utf8')
            res.statusCode = 200
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-portrait` qui écrit un portrait
 * composé (canvas → data URL) dans le fichier servi correspondant sous `public/`
 * (corps : `{ path, dataUrl }`, où `path` est le chemin public, ex. `/bowser.png`).
 * Sert l'éditeur de portrait du mode test. Absent du build de production.
 */
function savePortraitPlugin(): Plugin {
  const PUBLIC = resolve(process.cwd(), 'public')
  return {
    name: 'save-portrait',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-portrait', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { path: pubPath, dataUrl } = JSON.parse(body) as { path: string; dataUrl: string }
            if (typeof pubPath !== 'string' || typeof dataUrl !== 'string') throw new Error('payload invalide')
            // Normalise le chemin public et empêche toute sortie de `public/`.
            const rel = pubPath.replace(/^\/+/, '').split(/[?#]/)[0]
            if (!rel || rel.includes('..')) throw new Error('chemin invalide')
            const dest = resolve(PUBLIC, rel)
            if (!dest.startsWith(PUBLIC)) throw new Error('chemin hors public/')
            const m = /^data:[^;]+;base64,(.+)$/s.exec(dataUrl)
            if (!m) throw new Error('data URL invalide')
            // Conserve une copie du portrait BRUT (avant 1er encadrement) sous
            // `public/portraits-raw/<rel>` : l'éditeur ré-encadre toujours à partir de
            // cette image, sans empiler les cadres. Ne l'écrase jamais une fois créée.
            const rawDest = resolve(PUBLIC, 'portraits-raw', rel)
            if (rawDest.startsWith(PUBLIC) && !existsSync(rawDest) && existsSync(dest)) {
              mkdirSync(dirname(rawDest), { recursive: true })
              copyFileSync(dest, rawDest)
            }
            writeFileSync(dest, Buffer.from(m[1], 'base64'))
            res.statusCode = 200
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-villain-color` qui réécrit la (ou
 * les) entrée(s) de `VILLAIN_COLOR` dans `src/ui/villainColors.ts` pour un vilain
 * (corps : `{ keys: string[], color }`, `keys` = id du vilain + clé registre).
 * Sert l'éditeur de couleur du mode test. Absent du build de production.
 */
function saveVillainColorPlugin(): Plugin {
  const FILE = resolve(process.cwd(), 'src/ui/villainColors.ts')
  return {
    name: 'save-villain-color',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-villain-color', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { keys, color } = JSON.parse(body) as { keys: string[]; color: string }
            if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string'))
              throw new Error('clés invalides')
            if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))
              throw new Error('couleur invalide')
            let src = readFileSync(FILE, 'utf8')
            let changed = false
            for (const key of keys) {
              const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              // La clé est écrite quotée (kebab-case) ou nue (camelCase).
              const re = new RegExp(`((?:'${esc}'|"${esc}"|${esc})\\s*:\\s*)'#[0-9A-Fa-f]{3,8}'`)
              if (re.test(src)) { src = src.replace(re, `$1'${color}'`); changed = true }
            }
            if (!changed) throw new Error(`vilain « ${keys.join(', ')} » introuvable`)
            writeFileSync(FILE, src, 'utf8')
            res.statusCode = 200
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-villain-assets` qui écrit les images
 * d'un vilain personnalisé (« Terminé » dans l'Atelier) dans les dossiers SOURCES
 * `assets/` — comme les vilains natifs (corps : `{ files: [{ path, dataUrl }] }`, où
 * `path` est relatif à `assets/`, ex. `decks/Mon Vilain/Plateau.png`). Crée les
 * dossiers au besoin. Absent du build de production (`apply: 'serve'`).
 */
function saveVillainAssetsPlugin(): Plugin {
  const ASSETS = resolve(process.cwd(), 'assets')
  return {
    name: 'save-villain-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-villain-assets', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { files } = JSON.parse(body) as { files: { path: string; dataUrl: string }[] }
            if (!Array.isArray(files)) throw new Error('payload invalide')
            let written = 0
            for (const f of files) {
              if (typeof f?.path !== 'string' || typeof f?.dataUrl !== 'string') continue
              const rel = f.path.replace(/^\/+/, '')
              if (!rel || rel.includes('..')) throw new Error(`chemin invalide : ${f.path}`)
              const dest = resolve(ASSETS, rel)
              if (!dest.startsWith(ASSETS)) throw new Error('chemin hors assets/')
              const m = /^data:[^;]+;base64,(.+)$/s.exec(f.dataUrl)
              if (!m) continue
              mkdirSync(dirname(dest), { recursive: true })
              atomicWriteFileSync(dest, Buffer.from(m[1], 'base64'))
              written++
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ written }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-villain-json` qui écrit le JSON
 * (allégé, sans images) d'un vilain personnalisé dans `assets/custom-exports/<id>.json`
 * — pour pouvoir le relire/transmettre facilement (corps : `{ id, json }`). Absent du
 * build de production (`apply: 'serve'`).
 */
function saveVillainJsonPlugin(): Plugin {
  const ASSETS = resolve(process.cwd(), 'assets')
  return {
    name: 'save-villain-json',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-villain-json', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { id, json } = JSON.parse(body) as { id: string; json: string }
            if (typeof id !== 'string' || typeof json !== 'string') throw new Error('payload invalide')
            const safe = id.replace(/[^a-z0-9_-]+/gi, '-')
            const rel = `custom-exports/${safe}.json`
            const dest = resolve(ASSETS, rel)
            if (!dest.startsWith(ASSETS)) throw new Error('chemin hors assets/')
            mkdirSync(dirname(dest), { recursive: true })
            atomicWriteFileSync(dest, json)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ path: `assets/${rel}` }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint GET `/__read-villain-json?id=<id>` qui relit le JSON
 * allégé (`assets/custom-exports/<id>.json`) écrit par `/__save-villain-json`. Sert à
 * RÉIMPORTER dans l'Atelier les données de jeu développées par Claude Code sur ce fichier.
 * Renvoie `{ json }` (chaîne) ou 404. Absent du build de production (`apply: 'serve'`).
 */
function readVillainJsonPlugin(): Plugin {
  const ASSETS = resolve(process.cwd(), 'assets')
  return {
    name: 'read-villain-json',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__read-villain-json', (req, res) => {
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const id = url.searchParams.get('id') ?? ''
          const safe = id.replace(/[^a-z0-9_-]+/gi, '-')
          const src = resolve(ASSETS, `custom-exports/${safe}.json`)
          if (!src.startsWith(ASSETS)) throw new Error('chemin hors assets/')
          if (!existsSync(src)) { res.statusCode = 404; res.end('introuvable'); return }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ json: readFileSync(src, 'utf8') }))
        } catch (e) {
          res.statusCode = 400
          res.end(String((e as Error)?.message ?? e))
        }
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__publish-villain` qui écrit le JSON « chemins »
 * (images externalisées en fichiers sous `public/cards/custom-<id>/`) d'un vilain personnalisé
 * dans `src/data/published/<id>.json`. Ces fichiers sont chargés au démarrage de l'app (cf.
 * `src/data/published/load.ts`) → le vilain publié devient disponible pour TOUS les joueurs
 * (après commit + redéploiement). Corps : `{ id, json }`. Absent du build de production
 * (`apply: 'serve'`).
 */
function savePublishedVillainPlugin(): Plugin {
  const PUBLISHED = resolve(process.cwd(), 'src/data/published')
  const PUBLIC = resolve(process.cwd(), 'public')

  return {
    name: 'publish-villain',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__publish-villain', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { id, json } = JSON.parse(body) as { id: string; json: string }
            if (typeof id !== 'string' || typeof json !== 'string') throw new Error('payload invalide')
            const safe = id.replace(/[^a-z0-9_-]+/gi, '-')
            const dest = resolve(PUBLISHED, `${safe}.json`)
            if (!dest.startsWith(PUBLISHED)) throw new Error('chemin hors src/data/published/')
            mkdirSync(PUBLISHED, { recursive: true })
            // Le vilain reçu contient ses images en data-URL : on les écrit en fichiers sous
            // public/cards/<id>/ (externalisation idempotente) et on ne persiste dans le JSON
            // committé que des chemins — les fichiers publiés restent légers et lisibles en diff.
            let parsed: Record<string, unknown>
            try { parsed = JSON.parse(json) as Record<string, unknown> } catch { throw new Error('JSON invalide') }
            const { villain: pathsVillain, files } = externalizeVillainImages(parsed)
            for (const f of files) {
              const fileDest = resolve(PUBLIC, f.path)
              if (!fileDest.startsWith(PUBLIC)) throw new Error('chemin image hors public/')
              mkdirSync(dirname(fileDest), { recursive: true })
              atomicWriteFileSync(fileDest, Buffer.from(f.base64, 'base64'))
            }
            atomicWriteFileSync(dest, JSON.stringify(pathsVillain, null, 2))
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ path: `src/data/published/${safe}.json` }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
      // DÉPUBLICATION NON DESTRUCTIVE : au lieu de SUPPRIMER le JSON embarqué
      // `src/data/published/<id>.json` (corps `{ id }`), on y écrit `"published": false`.
      // Le fichier reste committé (diff d'une ligne, réversible en re-publiant) et le
      // chargement l'ignore (cf. `loadBundledVillains`), donc le vilain n'est plus proposé.
      // Évite les suppressions git surprises et ne casse aucun import dérivé du glob.
      server.middlewares.use('/__unpublish-villain', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body) as { id: string }
            if (typeof id !== 'string') throw new Error('payload invalide')
            const safe = id.replace(/[^a-z0-9_-]+/gi, '-')
            const dest = resolve(PUBLISHED, `${safe}.json`)
            if (!dest.startsWith(PUBLISHED)) throw new Error('chemin hors src/data/published/')
            const found = existsSync(dest)
            if (found) {
              const parsed = JSON.parse(readFileSync(dest, 'utf8')) as Record<string, unknown>
              parsed.published = false
              atomicWriteFileSync(dest, JSON.stringify(parsed, null, 2))
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ unpublished: found, path: `src/data/published/${safe}.json` }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : FILET DE SÉCURITÉ des brouillons de l'Atelier. Les vilains
 * persos vivent dans l'IndexedDB du navigateur (cf. `customVillainStore`), qui est
 * cloisonnée par origine (navigateur + hôte:port) et volatile (effaçable). Pour ne plus
 * jamais perdre un brouillon, on en écrit AUSSI une copie COMPLÈTE (avec images) sur le
 * disque, dans `src/data/drafts/<id>.json`. Ces fichiers, partagés entre toutes les
 * origines et persistants, servent à RESTAURER un brouillon absent de l'IndexedDB (autre
 * port/navigateur, ou base effacée). Ils ne sont PAS committés (cf. .gitignore) et ne
 * marquent pas le vilain comme publié.
 *   - POST `/__save-villain-backup`   corps `{ id, json }`  → écrit le fichier
 *   - POST `/__delete-villain-backup` corps `{ id }`        → supprime le fichier
 *   - GET  `/__list-villain-backups`                        → `{ villains: CustomVillain[] }`
 * Absents du build de production (`apply: 'serve'`).
 */
function villainBackupPlugin(): Plugin {
  const DRAFTS = resolve(process.cwd(), 'src/data/drafts')
  /** Chemin disque sûr pour un id (id assaini, confiné à DRAFTS). */
  const draftPath = (id: string): string => {
    const safe = id.replace(/[^a-z0-9_-]+/gi, '-')
    const dest = resolve(DRAFTS, `${safe}.json`)
    if (!dest.startsWith(DRAFTS)) throw new Error('chemin hors src/data/drafts/')
    return dest
  }
  /** Lit le corps JSON d'une requête POST. */
  const readBody = (req: import('node:http').IncomingMessage): Promise<string> =>
    new Promise((res) => {
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => res(body))
    })
  return {
    name: 'villain-backup',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-villain-backup', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        void readBody(req).then((body) => {
          try {
            const { id, json } = JSON.parse(body) as { id: string; json: string }
            if (typeof id !== 'string' || typeof json !== 'string') throw new Error('payload invalide')
            const dest = draftPath(id)
            mkdirSync(DRAFTS, { recursive: true })
            atomicWriteFileSync(dest, json)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
      server.middlewares.use('/__delete-villain-backup', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        void readBody(req).then((body) => {
          try {
            const { id } = JSON.parse(body) as { id: string }
            if (typeof id !== 'string') throw new Error('payload invalide')
            const dest = draftPath(id)
            if (existsSync(dest)) rmSync(dest)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
      server.middlewares.use('/__list-villain-backups', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end('GET only'); return }
        try {
          const villains: unknown[] = []
          if (existsSync(DRAFTS)) {
            for (const f of readdirSync(DRAFTS)) {
              if (!f.endsWith('.json')) continue
              try { villains.push(JSON.parse(readFileSync(join(DRAFTS, f), 'utf8'))) } catch { /* fichier illisible → ignoré */ }
            }
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ villains }))
        } catch (e) {
          res.statusCode = 400
          res.end(String((e as Error)?.message ?? e))
        }
      })
      // GARDE-FOU ANTI-PERTE : avant que le chargement n'ÉCRASE une version existante en
      // IndexedDB (adoption d'une version disque/embarquée plus récente), le client envoie
      // ici la version REMPLACÉE. On l'archive dans un sous-dossier `_snapshots/` (une copie
      // « précédente » par id, réécrite à chaque fois) — HORS de portée de `list-villain-backups`
      // (qui ne lit que la racine), donc jamais restaurée automatiquement, mais récupérable à
      // la main si la fusion perdait quelque chose. Corps : `{ id, json }`.
      server.middlewares.use('/__snapshot-villain', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        void readBody(req).then((body) => {
          try {
            const { id, json } = JSON.parse(body) as { id: string; json: string }
            if (typeof id !== 'string' || typeof json !== 'string') throw new Error('payload invalide')
            const safe = id.replace(/[^a-z0-9_-]+/gi, '-')
            const dir = resolve(DRAFTS, '_snapshots')
            const dest = resolve(dir, `${safe}.json`)
            if (!dest.startsWith(dir)) throw new Error('chemin hors _snapshots/')
            mkdirSync(dir, { recursive: true })
            writeFileSync(dest, json, 'utf8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : endpoint POST `/__save-villain-difficulty` qui réécrit la
 * difficulté (`difficulty: <n>`) d'un vilain natif dans `src/ui/villainGuide.ts`
 * (corps : `{ villain, difficulty }`, où `villain` = clé registre camelCase). On
 * localise le bloc `<villain>: { difficulty: … }`. Absent du build de prod.
 */
function saveVillainDifficultyPlugin(): Plugin {
  const FILE = resolve(process.cwd(), 'src/ui/villainGuide.ts')
  return {
    name: 'save-villain-difficulty',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-villain-difficulty', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { villain, difficulty } = JSON.parse(body) as { villain: string; difficulty: number }
            if (typeof villain !== 'string') throw new Error('vilain invalide')
            if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
              throw new Error('difficulté invalide (1–5)')
            let src = readFileSync(FILE, 'utf8')
            const esc = villain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            // Bloc `<villain>: { difficulty: <n>` — la difficulté est le 1er champ.
            const re = new RegExp(`(\\b${esc}:\\s*\\{\\s*difficulty:\\s*)\\d+`)
            if (!re.test(src)) throw new Error(`vilain « ${villain} » introuvable`)
            src = src.replace(re, `$1${difficulty}`)
            writeFileSync(FILE, src, 'utf8')
            res.statusCode = 200
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

/**
 * Plugin DEV uniquement : outil « prochain commit » de l'Atelier.
 *  - GET  `/__git-changes` : liste les fichiers modifiés (`git status`) avec l'état
 *    STAGÉ (inclus au prochain commit) ou non.
 *  - POST `/__git-stage` (corps `{ file, staged }`) : bascule le staging d'un fichier
 *    (`git add` / `git restore --staged`). Absent du build de production (`apply: 'serve'`).
 */
function gitStagingPlugin(): Plugin {
  const ROOT = process.cwd()
  const git = (args: string[]): string =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  // Périmètre : UNIQUEMENT les fichiers produits par l'Atelier / les vilains enregistrés
  // (données + assets). Les autres changements du dépôt (code, tests…) sont ignorés ici.
  const VILLAIN_PREFIXES = [
    'src/data/published/',
    'src/data/drafts/',
    'assets/custom-exports/',
    'assets/decks/',
    'assets/portraits/',
    'assets/pions/',
    'assets/presentations/',
    'assets/animations/',
    'public/cards/',
    'public/portraits-raw/',
    'public/presentations/',
    'public/animations/',
  ]
  const isVillainFile = (p: string): boolean => VILLAIN_PREFIXES.some((pre) => p.startsWith(pre))
  /** Parse `git status --porcelain=v1` en { staged, path } (chemins non échappés),
   *  restreint aux fichiers de vilains. */
  const listChanges = (): Array<{ path: string; staged: boolean; status: string }> => {
    const out = git(['-c', 'core.quotePath=false', 'status', '--porcelain=v1'])
    const rows: Array<{ path: string; staged: boolean; status: string }> = []
    for (const line of out.split('\n')) {
      if (!line) continue
      const x = line[0] // index (stagé) ; y = arbre de travail
      const rest = line.slice(3)
      // Renommage « old -> new » : on garde le chemin de destination.
      const path = rest.includes(' -> ') ? rest.slice(rest.indexOf(' -> ') + 4) : rest
      if (!isVillainFile(path)) continue // hors périmètre vilains
      const staged = x !== ' ' && x !== '?'
      rows.push({ path, staged, status: line.slice(0, 2) })
    }
    // Ordre stable : non stagés d'abord (à décider), puis stagés ; alpha au sein de chaque groupe.
    return rows.sort((a, b) => Number(a.staged) - Number(b.staged) || a.path.localeCompare(b.path))
  }
  const readBody = (req: import('node:http').IncomingMessage): Promise<string> =>
    new Promise((res) => {
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => res(body))
    })
  return {
    name: 'git-staging',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__git-changes', (_req, res) => {
        try {
          const changes = listChanges()
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ changes }))
        } catch (e) {
          res.statusCode = 500
          res.end(String((e as Error)?.message ?? e))
        }
      })
      // Coche TOUT par défaut : stage l'ensemble des fichiers de vilains modifiés.
      // Appelé une fois à l'ouverture du panneau (les décochages manuels ultérieurs
      // ne repassent pas par ici → ils sont préservés jusqu'à la prochaine ouverture).
      server.middlewares.use('/__git-stage-all', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        try {
          const files = listChanges().map((c) => c.path)
          if (files.length) git(['add', '-A', '--', ...files])
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, staged: files.length }))
        } catch (e) {
          res.statusCode = 500
          res.end(String((e as Error)?.message ?? e))
        }
      })
      server.middlewares.use('/__git-stage', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        void readBody(req).then((body) => {
          try {
            const { file, staged } = JSON.parse(body) as { file: string; staged: boolean }
            if (typeof file !== 'string' || !file || file.includes('\0')) throw new Error('fichier invalide')
            if (staged) git(['add', '-A', '--', file])
            else git(['restore', '--staged', '--', file])
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(String((e as Error)?.message ?? e))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), saveActionPosPlugin(), saveBlockedOverlayPlugin(), savePawnSizePlugin(), savePortraitPlugin(), saveVillainColorPlugin(), saveVillainAssetsPlugin(), saveVillainJsonPlugin(), readVillainJsonPlugin(), savePublishedVillainPlugin(), villainBackupPlugin(), saveVillainDifficultyPlugin(), gitStagingPlugin()],
  server: {
    // Expose le serveur de dév sur le réseau local (0.0.0.0) pour que l'invité
    // puisse ouvrir l'app depuis l'IP de l'hôte (http://<ip-hôte>:5173) — requis
    // pour le mode « Jouer en réseau ».
    host: true,
    watch: {
      // `assets/` contient des milliers d'images de decks (sources hors runtime,
      // les images servies vivent dans `public/`). Sous Windows, certaines sont
      // verrouillées et faisaient planter le watcher (EBUSY). On l'ignore.
      // Idem pour le générateur de cartes (outil hors-app) dont les exports PNG
      // sont parfois verrouillés par un autre programme.
      ignored: ['**/assets/**', '**/Villainous Card Generator*/**'],
    },
  },
  test: {
    // Le moteur est pur (aucune dépendance navigateur) → environnement node.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Les tests de self-play des bots (centaines de recherches complètes de tour)
    // sont lourds et frôlaient le défaut de 5 s sous charge parallèle → flaky. Marge
    // confortable pour fiabiliser la suite (n'affecte pas la logique).
    testTimeout: 20000,
  },
})
