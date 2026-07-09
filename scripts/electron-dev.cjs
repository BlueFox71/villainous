// Dév à chaud dans la fenêtre native (`npm run electron:dev`).
// Démarre le serveur Vite (ou réutilise celui déjà lancé), attend qu'il écoute,
// PUIS lance Electron pointant dessus (via ELECTRON_DEV_URL) → HMR directement
// dans la fenêtre Electron. Fermer la fenêtre (ou Ctrl+C) coupe la session (et
// notre Vite, mais jamais un `npm run dev` préexistant). Aucun build requis.
const { spawn } = require('node:child_process')
const net = require('node:net')
const path = require('node:path')

const PORT = 5173
const URL = `http://localhost:${PORT}`

let vite = null    // notre serveur Vite (null si on réutilise un existant)
let electron = null

function cleanup(code) {
  try { if (vite) vite.kill() } catch { /* déjà terminé */ }
  try { if (electron) electron.kill() } catch { /* déjà terminé */ }
  process.exit(code)
}

// Teste une fois si quelque chose écoute déjà sur le port.
function probePort() {
  return new Promise((resolve) => {
    const sock = net.connect(PORT, '127.0.0.1')
    sock.once('connect', () => { sock.destroy(); resolve(true) })
    sock.once('error', () => { sock.destroy(); resolve(false) })
  })
}

// Lance notre propre serveur Vite via Node (pas de .cmd → robuste sous Windows +
// kill propre). On localise le CLI par le package.json (champ `bin`), car Vite 8
// ne l'expose pas via `exports` (require.resolve('vite/bin/vite.js') échoue).
// `--strictPort` : échoue franchement si 5173 est pris plutôt que de dériver.
function startVite() {
  const vitePkgPath = require.resolve('vite/package.json')
  const vitePath = path.join(path.dirname(vitePkgPath), require(vitePkgPath).bin.vite)
  vite = spawn(process.execPath, [vitePath, '--port', String(PORT), '--strictPort'], {
    stdio: 'inherit',
  })
}

// Attend que Vite écoute, puis lance Electron.
function waitForVite(retries) {
  const sock = net.connect(PORT, '127.0.0.1')
  sock.once('connect', () => { sock.destroy(); startElectron() })
  sock.once('error', () => {
    sock.destroy()
    if (retries <= 0) {
      console.error(`Vite injoignable sur ${URL} — abandon.`)
      cleanup(1)
      return
    }
    setTimeout(() => waitForVite(retries - 1), 300)
  })
}

function startElectron() {
  const electronPath = require('electron') // chemin du binaire (contexte Node)
  electron = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_DEV_URL: URL },
  })
  // Fermer la fenêtre Electron termine la session de dév.
  electron.on('exit', (code) => cleanup(code ?? 0))
}

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))

// Réutilise un serveur de dév déjà ouvert (`npm run dev`), sinon démarre le nôtre.
void probePort().then((up) => {
  if (up) {
    console.log(`Serveur Vite déjà actif sur ${URL} — réutilisé (non arrêté à la sortie).`)
    startElectron()
  } else {
    startVite()
    waitForVite(100) // ~30 s d'attente max au démarrage de Vite
  }
})
