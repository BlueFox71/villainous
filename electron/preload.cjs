// Pont sécurisé renderer ↔ process principal (contextIsolation activé).
// Expose un petit objet `window.villainous` permettant à l'UI de lire/écrire le
// mode d'affichage (persisté côté main dans userData) et de piloter le plein
// écran natif de la fenêtre — ce que l'API Fullscreen du navigateur ne peut pas
// faire de façon fiable au lancement (sans geste utilisateur).
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('villainous', {
  /** Mode d'affichage actuellement persisté ('windowed' | 'fullscreen' | 'borderless'). */
  getDisplayMode: () => ipcRenderer.invoke('display:get'),
  /** Définit ET persiste le mode d'affichage, et l'applique à la fenêtre. */
  setDisplayMode: (mode) => ipcRenderer.invoke('display:set', mode),
  /** Plein écran transitoire (NON persisté) — utilisé pour la cinématique d'intro. */
  setFullscreen: (on) => ipcRenderer.invoke('display:fullscreen', on),

  // --- Launcher (fenêtre d'accueil de l'app de bureau, cf. src/launcher/) ---
  /** Démarre la vérification de MAJ ; renvoie { supported, version }. */
  launcherStart: () => ipcRenderer.invoke('launcher:start'),
  /** Ferme le launcher et ouvre la fenêtre de jeu. */
  launcherPlay: () => ipcRenderer.invoke('launcher:play'),
  /** Redémarre l'app pour installer la MAJ téléchargée. */
  launcherInstall: () => ipcRenderer.invoke('launcher:install'),
  /** Récupère les actualités en ligne (news.json) ; null si indisponible. */
  launcherNews: () => ipcRenderer.invoke('launcher:news'),
  /** Quitte l'application depuis le launcher. */
  launcherClose: () => ipcRenderer.invoke('launcher:close'),
  /** Réduit la fenêtre du launcher. */
  launcherMinimize: () => ipcRenderer.invoke('launcher:minimize'),
  /** Abonne un callback aux événements de MAJ ; renvoie la fonction de désabonnement. */
  onUpdateEvent: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update:event', handler)
    return () => ipcRenderer.removeListener('update:event', handler)
  },
})
