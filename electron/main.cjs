// Process principal Electron : empaquette l'app Vite (dist/) en application de
// bureau autonome. Aucun serveur localhost — le contenu est servi via un schéma
// custom « app:// » enregistré comme standard+sécurisé, ce qui permet à
// l'history API de React Router (BrowserRouter) de fonctionner normalement.
const { app, BrowserWindow, protocol, shell, Menu, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// Dossier du build Vite (copié dans les ressources à l'empaquetage).
const DIST = path.join(__dirname, '..', 'dist')

// --- Mode d'affichage persisté (fenêtré / plein écran) ---------------------
// Le choix du joueur est stocké dans userData pour être lu DÈS le lancement (la
// fenêtre native est créée ici, avant tout code du renderer). Premier lancement
// (aucun fichier) → plein écran.
const DISPLAY_MODES = ['windowed', 'fullscreen', 'borderless']
const displayFile = () => path.join(app.getPath('userData'), 'display.json')

function readDisplayMode() {
  try {
    const raw = fs.readFileSync(displayFile(), 'utf8')
    const mode = JSON.parse(raw).mode
    return DISPLAY_MODES.includes(mode) ? mode : null
  } catch {
    return null // fichier absent / illisible → premier lancement
  }
}

function writeDisplayMode(mode) {
  try {
    fs.writeFileSync(displayFile(), JSON.stringify({ mode }), 'utf8')
  } catch {
    /* ignore (écriture impossible) */
  }
}

// Applique le mode à la fenêtre : 'windowed' = fenêtré ; sinon plein écran
// (sous Windows, le plein écran Electron est déjà « sans bordure », donc
// 'fullscreen' et 'borderless' s'y comportent de la même façon).
function applyDisplayMode(win, mode) {
  if (!win) return
  win.setFullScreen(mode !== 'windowed')
}

// Référence à la fenêtre principale (pilotée par les messages IPC du renderer).
let mainWindow = null

// Icône de la fenêtre : en dev on lit la source, en packagé la copie placée dans
// les ressources (cf. extraResources de electron-builder).
const ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(__dirname, 'icon.ico')

// Types MIME explicites : indispensable pour les modules ES (le navigateur
// refuse un <script type="module"> servi en text/plain).
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
}

// app:// doit être déclaré privilégié AVANT app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

function createWindow() {
  // Mode d'affichage choisi par le joueur, ou plein écran au tout premier
  // lancement (qu'on persiste alors pour les suivants).
  let mode = readDisplayMode()
  if (mode == null) {
    mode = 'fullscreen'
    writeDisplayMode(mode)
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    fullscreen: mode !== 'windowed',
    autoHideMenuBar: true,
    backgroundColor: '#0b0b12',
    icon: ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      // Autorise la lecture auto (avec son) de la cinématique d'intro sans geste
      // préalable de l'utilisateur.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  mainWindow = win
  win.setMenuBarVisibility(false)
  win.loadURL('app://local/index.html')

  // Liens externes (cibles _blank) → navigateur système, pas dans l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  // Pas de barre de menu (jeu plein écran fenêtré).
  Menu.setApplicationMenu(null)

  // --- IPC du mode d'affichage (cf. preload.cjs) ---
  // Lecture du mode persisté (repli plein écran si rien d'enregistré).
  ipcMain.handle('display:get', () => readDisplayMode() ?? 'fullscreen')
  // Changement de mode depuis les Options : persiste ET applique à la fenêtre.
  ipcMain.handle('display:set', (_e, mode) => {
    if (!DISPLAY_MODES.includes(mode)) return
    writeDisplayMode(mode)
    applyDisplayMode(mainWindow, mode)
  })
  // Plein écran transitoire (cinématique d'intro) : on N'écrit PAS le fichier.
  ipcMain.handle('display:fullscreen', (_e, on) => {
    if (mainWindow) mainWindow.setFullScreen(!!on)
  })

  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '') rel = '/index.html'

    // Empêche toute remontée hors de dist/ (path traversal).
    let filePath = path.normalize(path.join(DIST, rel))
    if (!filePath.startsWith(DIST)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Fallback SPA : une route inconnue (ex. /partie au rechargement) renvoie
    // index.html, charge à React Router de réafficher le bon écran.
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.join(DIST, 'index.html')
    }

    const data = await fs.promises.readFile(filePath)
    const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    return new Response(data, { headers: { 'content-type': mime } })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
