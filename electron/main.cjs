// Process principal Electron : empaquette l'app Vite (dist/) en application de
// bureau autonome. Aucun serveur localhost — le contenu est servi via un schéma
// custom « app:// » enregistré comme standard+sécurisé, ce qui permet à
// l'history API de React Router (BrowserRouter) de fonctionner normalement.
const { app, BrowserWindow, protocol, shell, Menu, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// Dossier du build Vite (copié dans les ressources à l'empaquetage).
const DIST = path.join(__dirname, '..', 'dist')

// Mode dév à chaud (`npm run electron:dev`) : quand cette variable est définie, la
// fenêtre charge le serveur Vite (HMR) au lieu du build figé `app://`. Absent en
// packagé et en `npm run electron` classique → comportement autonome inchangé.
const DEV_URL = process.env.ELECTRON_DEV_URL

// Lancement depuis « Le Grenier » (le launcher multi-projets) : on va DIRECTEMENT au
// jeu, sans repasser par notre propre launcher. Variable d'environnement et non
// argument de ligne de commande : la cible `portable` d'electron-builder est un stub
// qui se décompresse puis relance l'app, et les arguments n'y survivent pas.
const START_DIRECTLY = !!process.env.LANCE_PAR_LE_GRENIER

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

// --- Facteur de zoom d'UI LOCAL (jamais versionné) ------------------------
// Lu depuis userData/uizoom.json ({ "factor": 1.1 }). Ce fichier vit dans les
// données locales de l'app (hors dépôt) : la valeur perso n'est JAMAIS poussée.
// Absent / invalide → 1 (aucun zoom), donc aucun effet pour les autres postes.
// Vrai zoom Chromium (comme Ctrl +) : net, sans flou, avec reflow.
function readZoomFactor() {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'uizoom.json'), 'utf8')).factor
    return typeof f === 'number' && f > 0 ? f : 1
  } catch {
    return 1
  }
}

// Références aux fenêtres (pilotées par les messages IPC du renderer).
let mainWindow = null
let launcherWindow = null

const updater = require('./updater.cjs')

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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4',
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
  // lancement (qu'on persiste alors pour les suivants). En dév à chaud, on force
  // le fenêtré (sans toucher au fichier persisté) : plus pratique pour coder.
  let mode = readDisplayMode()
  if (DEV_URL) {
    mode = 'windowed'
  } else if (mode == null) {
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
  if (DEV_URL) {
    // Dév à chaud : on pointe sur le serveur Vite et on ouvre les DevTools.
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadURL('app://local/index.html')
  }

  // Applique le zoom d'UI local (relu à chaque chargement → modifiable sans rebuild).
  win.webContents.on('did-finish-load', () => {
    const z = readZoomFactor()
    if (z !== 1) win.webContents.setZoomFactor(z)
  })

  // Liens externes (cibles _blank) → navigateur système, pas dans l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// --- LAUNCHER (fenêtre d'accueil affichée AVANT le jeu) ---------------------
// Petite fenêtre sans cadre (façon launcher de jeu) : actualités (notes de
// version), état de la mise à jour automatique, puis bouton « Jouer » qui ouvre
// la fenêtre de jeu. La vérification de MAJ est déclenchée par le launcher lui-même
// (IPC 'launcher:start') pour qu'aucun événement ne soit émis avant qu'il n'écoute.
function createLauncher() {
  const win = new BrowserWindow({
    width: 940,
    height: 580,
    resizable: false,
    frame: false,
    center: true,
    backgroundColor: '#0b0a12',
    icon: ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      // Lecture auto de la vidéo de fond (muette) sans geste utilisateur.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  launcherWindow = win
  win.setMenuBarVisibility(false)
  if (DEV_URL) {
    win.loadURL(`${DEV_URL}/launcher.html`)
  } else {
    win.loadURL('app://local/launcher.html')
  }
  // Liens externes → navigateur système.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('closed', () => {
    if (launcherWindow === win) launcherWindow = null
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

  // --- IPC du LAUNCHER (cf. preload.cjs + src/launcher/) ---
  // Le launcher, une fois monté, déclenche la vérification de MAJ. On relaie les
  // événements vers SA webContents (aucun perdu : il s'est abonné avant d'appeler).
  ipcMain.handle('launcher:start', (e) => {
    const wc = e.sender
    const send = (type, payload) => {
      if (wc && !wc.isDestroyed()) wc.send('update:event', { type, payload })
    }
    const supported = updater.startUpdateCheck(send)
    return { supported, version: app.getVersion() }
  })
  // « Jouer » : ouvre la fenêtre de jeu PUIS ferme le launcher (dans cet ordre pour
  // ne pas déclencher 'window-all-closed' → quit entre les deux).
  ipcMain.handle('launcher:play', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow()
    const l = launcherWindow
    launcherWindow = null
    if (l && !l.isDestroyed()) l.close()
  })
  // « Redémarrer et installer » : applique la MAJ téléchargée.
  ipcMain.handle('launcher:install', () => updater.quitAndInstall())
  // Actualités EN LIGNE (news.json du dépôt) : permet de publier une actu sans
  // republier l'exe. Renvoie null (offline / indisponible) → le launcher retombe
  // sur les notes de version embarquées.
  ipcMain.handle('launcher:news', async () => {
    try {
      return await require('./news.cjs').fetchNews()
    } catch {
      return null
    }
  })
  // Boutons de la barre de titre sans cadre.
  ipcMain.handle('launcher:close', () => app.quit())
  ipcMain.handle('launcher:minimize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w) w.minimize()
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

  // On ouvre d'abord le LAUNCHER (accueil + actus + mise à jour), qui ouvrira la
  // fenêtre de jeu quand le joueur clique « Jouer ». La vérification de MAJ (GitHub
  // Releases privées) est déclenchée par le launcher (IPC 'launcher:start') ; sans
  // effet en dev ou sans jeton embarqué (cf. electron/updater.cjs).
  //
  // SAUF si l'app est lancée depuis « Le Grenier » (le launcher multi-projets, cf.
  // ../le-grenier) : il a déjà fait l'accueil, et c'est LUI qui possède la version
  // installée. Réafficher notre launcher enchaînerait deux écrans d'accueil et, pire,
  // lancerait un second updater sur un dossier qu'il gère déjà.
  if (START_DIRECTLY) createWindow()
  else createLauncher()

  app.on('activate', () => {
    // Rien d'ouvert (macOS) → on repart de l'écran de départ habituel.
    if (BrowserWindow.getAllWindows().length === 0) {
      if (START_DIRECTLY) createWindow()
      else createLauncher()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
