import { create } from 'zustand'

const LS_KEY = 'villainous:settings'

/** Mode d'affichage. En navigateur, 'fullscreen' et 'borderless' utilisent tous
 *  deux l'API Fullscreen (un vrai « borderless » natif relève de l'appli desktop).
 *  Dans l'app de bureau, le pont Electron (`window.villainous`) pilote la fenêtre
 *  native et persiste le choix côté process principal (cf. electron/main.cjs). */
export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless'

/** Événement de mise à jour (electron-updater) relayé par le process principal
 *  au launcher — cf. electron/updater.cjs et src/launcher/Launcher.tsx. */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; payload?: { version?: string } }
  | { type: 'not-available' }
  | { type: 'progress'; payload?: { percent?: number } }
  | { type: 'downloaded'; payload?: { version?: string } }
  | { type: 'error'; payload?: { message?: string } }
  | { type: 'unsupported' }

/** Une actualité affichée par le launcher (en ligne ou repli embarqué). Même forme
 *  que les notes de version, mais `version` et `tags` sont facultatifs (une actu en
 *  ligne peut être un simple message). */
export interface NewsItem {
  version?: string
  date: string
  title: string
  tags?: string[]
  changes: string[]
}

/** Pont exposé par le preload Electron (absent en navigateur de dev). */
declare global {
  interface Window {
    villainous?: {
      getDisplayMode: () => Promise<DisplayMode>
      setDisplayMode: (mode: DisplayMode) => Promise<void>
      setFullscreen: (on: boolean) => Promise<void>
      // --- Launcher (fenêtre d'accueil de l'app de bureau) ---
      /** Démarre la vérification de MAJ ; renvoie le support et la version courante. */
      launcherStart?: () => Promise<{ supported: boolean; version: string }>
      /** Ferme le launcher et ouvre la fenêtre de jeu. */
      launcherPlay?: () => Promise<void>
      /** Redémarre l'app pour installer la MAJ téléchargée. */
      launcherInstall?: () => Promise<void>
      /** Récupère les actualités en ligne (news.json) ; null si indisponible. */
      launcherNews?: () => Promise<NewsItem[] | null>
      /** Quitte l'application depuis le launcher. */
      launcherClose?: () => Promise<void>
      /** Réduit la fenêtre du launcher. */
      launcherMinimize?: () => Promise<void>
      /** Abonne un callback aux événements de MAJ ; renvoie la fonction de désabonnement. */
      onUpdateEvent?: (cb: (e: UpdateEvent) => void) => () => void
    }
  }
}

const DISPLAY_MODES: DisplayMode[] = ['windowed', 'fullscreen', 'borderless']

interface Persisted {
  musicVolume: number // 0..1
  musicMuted: boolean
  /** Volume des bruitages (clics…), 0..1. */
  sfxVolume: number
  /** Couper la musique quand l'app n'est pas au premier plan (autre onglet/fenêtre). */
  pauseMusicUnfocused: boolean
  /** Mode d'affichage choisi par le joueur. */
  displayMode: DisplayMode
  /** Réglage DÉV : forcer le comportement « application de bureau (.exe) » même en
   *  navigateur (masque les outils de dév : Mode test, Banque de sons, etc.). */
  simulateDesktop: boolean
}

function read(): Persisted {
  const fallback: Persisted = {
    musicVolume: 0.5,
    musicMuted: false,
    sfxVolume: 0.3,
    pauseMusicUnfocused: true,
    displayMode: 'windowed',
    simulateDesktop: false,
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return {
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.musicVolume))
          : fallback.musicVolume,
      musicMuted: typeof parsed.musicMuted === 'boolean' ? parsed.musicMuted : fallback.musicMuted,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.sfxVolume))
          : fallback.sfxVolume,
      pauseMusicUnfocused:
        typeof parsed.pauseMusicUnfocused === 'boolean'
          ? parsed.pauseMusicUnfocused
          : fallback.pauseMusicUnfocused,
      displayMode:
        parsed.displayMode && DISPLAY_MODES.includes(parsed.displayMode)
          ? parsed.displayMode
          : fallback.displayMode,
      simulateDesktop:
        typeof parsed.simulateDesktop === 'boolean' ? parsed.simulateDesktop : fallback.simulateDesktop,
    }
  } catch {
    return fallback
  }
}

function persist(s: Persisted) {
  if (typeof localStorage === 'undefined') return
  try {
    const { musicVolume, musicMuted, sfxVolume, pauseMusicUnfocused, displayMode, simulateDesktop } = s
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ musicVolume, musicMuted, sfxVolume, pauseMusicUnfocused, displayMode, simulateDesktop }),
    )
  } catch {
    /* ignore */
  }
}

/** Applique le mode d'affichage en NAVIGATEUR via l'API Fullscreen (doit être
 *  appelé pendant un geste utilisateur pour entrer en plein écran). Dans l'app
 *  de bureau, c'est le pont Electron qui pilote la fenêtre native (voir
 *  `setDisplayMode`). */
function applyBrowserDisplayMode(mode: DisplayMode) {
  if (typeof document === 'undefined') return
  try {
    if (mode === 'windowed') {
      if (document.fullscreenElement) void document.exitFullscreen()
    } else if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen()
    }
  } catch {
    /* ignore (API indisponible / refusée) */
  }
}

interface SettingsStore extends Persisted {
  setMusicVolume: (v: number) => void
  toggleMusicMuted: () => void
  setSfxVolume: (v: number) => void
  togglePauseMusicUnfocused: () => void
  setDisplayMode: (mode: DisplayMode) => void
  /** Active/désactive la simulation du mode application de bureau (.exe). */
  toggleSimulateDesktop: () => void
}

/** Réglages du joueur (volume/sourdine/affichage persistés). */
export const useSettingsStore = create<SettingsStore>((set) => ({
  ...read(),
  setMusicVolume: (v) =>
    set((s) => {
      const musicVolume = Math.min(1, Math.max(0, v))
      const next: Persisted = { ...s, musicVolume, musicMuted: musicVolume === 0 }
      persist(next)
      return next
    }),
  toggleMusicMuted: () =>
    set((s) => {
      const next: Persisted = { ...s, musicMuted: !s.musicMuted }
      persist(next)
      return next
    }),
  setSfxVolume: (v) =>
    set((s) => {
      const next: Persisted = { ...s, sfxVolume: Math.min(1, Math.max(0, v)) }
      persist(next)
      return next
    }),
  togglePauseMusicUnfocused: () =>
    set((s) => {
      const next: Persisted = { ...s, pauseMusicUnfocused: !s.pauseMusicUnfocused }
      persist(next)
      return next
    }),
  setDisplayMode: (mode) =>
    set((s) => {
      // App de bureau : le process principal pilote la fenêtre native et persiste
      // le choix. Navigateur : repli sur l'API Fullscreen.
      if (typeof window !== 'undefined' && window.villainous) {
        void window.villainous.setDisplayMode(mode)
      } else {
        applyBrowserDisplayMode(mode)
      }
      const next: Persisted = { ...s, displayMode: mode }
      persist(next)
      return next
    }),
  toggleSimulateDesktop: () =>
    set((s) => {
      const next: Persisted = { ...s, simulateDesktop: !s.simulateDesktop }
      persist(next)
      return next
    }),
}))

/** Vrai si l'app tourne RÉELLEMENT en exécutable de bureau (pont Electron
 *  `window.villainous`, ou coquille Tauri) — faux au navigateur. */
export function isRealDesktopApp(): boolean {
  return typeof window !== 'undefined' && (!!window.villainous || '__TAURI_INTERNALS__' in window)
}

/** Hook réactif : vrai si on est en application de bureau RÉELLE ou si le joueur a
 *  activé la simulation (.exe) dans les options. Les éléments réservés au dév
 *  (Mode test, Banque de sons, case couleur…) se masquent quand c'est vrai. */
export function useIsDesktopApp(): boolean {
  return useSettingsStore((s) => s.simulateDesktop) || isRealDesktopApp()
}

// Synchronise le réglage si l'utilisateur quitte le plein écran (touche Échap)
// EN NAVIGATEUR. Dans l'app de bureau, le plein écran natif n'émet pas cet
// événement DOM (le mode reste donc celui choisi par le joueur).
if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.villainous)) {
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      const cur = useSettingsStore.getState().displayMode
      if (cur !== 'windowed') useSettingsStore.setState({ displayMode: 'windowed' })
    }
  })
}
