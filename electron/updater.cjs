// Mise à jour automatique (electron-updater) depuis les GitHub Releases PRIVÉES du
// dépôt. Au lancement, le LAUNCHER (cf. electron/main.cjs + src/launcher/) déclenche
// la vérification : l'app compare sa version (package.json) à la dernière release
// publiée ; si une plus récente existe, elle télécharge UNIQUEMENT les blocs modifiés
// (différentiel via le .blockmap). La progression et l'état sont relayés au launcher
// (barre de progression + bouton « Redémarrer et installer »).
//
// Le jeton GitHub LECTURE SEULE vit dans electron/update-config.cjs — un fichier
// GITIGNORÉ (jamais committé) mais EMBARQUÉ dans l'exe à l'empaquetage. S'il est absent
// (build sans jeton), l'auto-update est simplement désactivé : aucun plantage.
const { app } = require('electron')

/** Lit le jeton lecture seule embarqué (null si le fichier n'existe pas). */
function loadToken() {
  try {
    const cfg = require('./update-config.cjs')
    return typeof cfg?.token === 'string' && cfg.token ? cfg.token : null
  } catch {
    return null // fichier absent → auto-update off (dev, ou build sans jeton)
  }
}

let autoUpdaterRef = null

/** Charge (une fois) le module electron-updater ; null s'il est absent. */
function getAutoUpdater() {
  if (autoUpdaterRef) return autoUpdaterRef
  try {
    ;({ autoUpdater: autoUpdaterRef } = require('electron-updater'))
  } catch {
    autoUpdaterRef = null // module absent (ne devrait pas arriver en packagé)
  }
  return autoUpdaterRef
}

/** Vrai si l'auto-update peut fonctionner (packagé + jeton + module présent). */
function isUpdateSupported() {
  if (!app.isPackaged) return false // jamais en dev
  if (!loadToken()) return false // pas de jeton embarqué
  return !!getAutoUpdater()
}

/**
 * Lance la vérification de MAJ et relaie chaque étape via `send(type, payload)` :
 *  'checking' | 'available' {version} | 'not-available' | 'progress' {percent} |
 *  'downloaded' {version} | 'error' {message}.
 * Renvoie false (sans rien faire) si l'update n'est pas supporté (dev / pas de jeton).
 */
function startUpdateCheck(send) {
  if (!isUpdateSupported()) return false
  const token = loadToken()
  const autoUpdater = getAutoUpdater()

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
    return false
  }

  // Réabonnement propre (le launcher peut recharger la page en dév à chaud).
  for (const ev of [
    'checking-for-update',
    'update-available',
    'update-not-available',
    'download-progress',
    'update-downloaded',
    'error',
  ]) {
    autoUpdater.removeAllListeners(ev)
  }

  autoUpdater.on('checking-for-update', () => send('checking'))
  autoUpdater.on('update-available', (info) => send('available', { version: info?.version }))
  autoUpdater.on('update-not-available', () => send('not-available'))
  autoUpdater.on('download-progress', (p) => send('progress', { percent: Math.round(p?.percent ?? 0) }))
  autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info?.version }))
  // On n'interrompt JAMAIS le lancement si la vérification échoue (réseau, quota…).
  autoUpdater.on('error', (e) => send('error', { message: String(e?.message ?? e) }))

  autoUpdater.checkForUpdates().catch((e) => send('error', { message: String(e?.message ?? e) }))
  return true
}

/**
 * Applique la MAJ téléchargée (déclenché par le launcher), façon LAUNCHER CLASSIQUE :
 * installation SILENCIEUSE (aucun assistant visible) et RELANCE automatique de l'app.
 *  - `isSilent = true` → l'installeur NSIS tourne en mode `/S` : il réutilise le dossier
 *    d'installation déjà enregistré (registre `InstallLocation`) et écrase EN PLACE, sans
 *    afficher la moindre fenêtre (ni page de choix de dossier). Fini le « ça réinstalle »
 *    et le « ça revient à l'ancienne version » (nouvelle copie dans un autre dossier).
 *  - `isForceRunAfter = true` → l'app redémarre toute seule une fois la MAJ posée.
 */
function quitAndInstall() {
  const autoUpdater = getAutoUpdater()
  if (!autoUpdater) return
  try {
    autoUpdater.quitAndInstall(true, true)
  } catch {
    /* la MAJ s'installera de toute façon à la fermeture (autoInstallOnAppQuit) */
  }
}

module.exports = { isUpdateSupported, startUpdateCheck, quitAndInstall }
