/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), saveActionPosPlugin()],
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
