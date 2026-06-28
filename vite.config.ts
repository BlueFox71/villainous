/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), saveActionPosPlugin(), savePawnSizePlugin(), savePortraitPlugin(), saveVillainColorPlugin()],
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
  },
})
