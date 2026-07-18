// Mise à jour automatique (electron-updater) depuis les GitHub Releases PRIVÉES du
// dépôt. Au lancement, l'app compare sa version (package.json) à la dernière release
// publiée ; si une plus récente existe, elle télécharge UNIQUEMENT les blocs modifiés
// (différentiel via le .blockmap) puis propose de redémarrer.
//
// Le jeton GitHub LECTURE SEULE vit dans electron/update-config.cjs — un fichier
// GITIGNORÉ (jamais committé) mais EMBARQUÉ dans l'exe à l'empaquetage. S'il est absent
// (build sans jeton), l'auto-update est simplement désactivé : aucun plantage.
const { app, dialog } = require('electron')

/** Lit le jeton lecture seule embarqué (null si le fichier n'existe pas). */
function loadToken() {
  try {
    const cfg = require('./update-config.cjs')
    return typeof cfg?.token === 'string' && cfg.token ? cfg.token : null
  } catch {
    return null // fichier absent → auto-update off (dev, ou build sans jeton)
  }
}

/** Initialise la vérification de mise à jour. À appeler après app.whenReady(). */
function initAutoUpdate() {
  if (!app.isPackaged) return // jamais en dev (npm run electron / electron:dev)
  const token = loadToken()
  if (!token) return // pas de jeton embarqué → rien à faire

  let autoUpdater
  try {
    ;({ autoUpdater } = require('electron-updater'))
  } catch {
    return // module absent (ne devrait pas arriver en packagé)
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Dépôt PRIVÉ : le jeton lecture seule permet de lister et télécharger les releases.
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'BlueFox71',
      repo: 'villainous',
      private: true,
      token,
    })
  } catch {
    return
  }

  // Une MAJ est prête : on propose de redémarrer tout de suite (sinon elle s'appliquera
  // à la prochaine fermeture, cf. autoInstallOnAppQuit).
  autoUpdater.on('update-downloaded', async (info) => {
    const version = info && info.version ? ` (v${info.version})` : ''
    try {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Redémarrer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
        title: 'Mise à jour disponible',
        message: `Une nouvelle version${version} a été téléchargée.`,
        detail: 'Elle sera installée au redémarrage de l’application.',
      })
      if (response === 0) autoUpdater.quitAndInstall()
    } catch {
      /* dialogue impossible : la MAJ s'installera à la fermeture */
    }
  })

  // On n'interrompt JAMAIS le jeu si la vérification échoue (réseau, quota, etc.).
  autoUpdater.on('error', () => {})

  autoUpdater.checkForUpdates().catch(() => {})
}

module.exports = { initAutoUpdate }
