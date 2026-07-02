/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

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
              writeFileSync(dest, Buffer.from(m[1], 'base64'))
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
            writeFileSync(dest, json, 'utf8')
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
 * Plugin DEV uniquement : endpoint POST `/__publish-villain` qui écrit le JSON COMPLET
 * (AVEC images en dataURL) d'un vilain personnalisé dans `src/data/published/<id>.json`.
 * Ces fichiers sont chargés au démarrage de l'app (cf. `src/data/published/load.ts`) → le
 * vilain publié devient disponible pour TOUS les joueurs (après commit + redéploiement).
 * Corps : `{ id, json }`. Absent du build de production (`apply: 'serve'`).
 */
function savePublishedVillainPlugin(): Plugin {
  const PUBLISHED = resolve(process.cwd(), 'src/data/published')
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
            writeFileSync(dest, json, 'utf8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ path: `src/data/published/${safe}.json` }))
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), saveActionPosPlugin(), savePawnSizePlugin(), savePortraitPlugin(), saveVillainColorPlugin(), saveVillainAssetsPlugin(), saveVillainJsonPlugin(), savePublishedVillainPlugin(), villainBackupPlugin(), saveVillainDifficultyPlugin()],
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
