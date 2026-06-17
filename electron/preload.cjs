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
})
