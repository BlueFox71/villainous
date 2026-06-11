import { create } from 'zustand'

const LS_KEY = 'villainous:settings'

interface Persisted {
  musicVolume: number // 0..1
  musicMuted: boolean
  /** Volume des bruitages (clics…), 0..1. */
  sfxVolume: number
  /** Couper la musique quand l'app n'est pas au premier plan (autre onglet/fenêtre). */
  pauseMusicUnfocused: boolean
}

function read(): Persisted {
  const fallback: Persisted = {
    musicVolume: 0.5,
    musicMuted: false,
    sfxVolume: 0.3,
    pauseMusicUnfocused: true,
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
    }
  } catch {
    return fallback
  }
}

function persist(s: Persisted) {
  if (typeof localStorage === 'undefined') return
  try {
    const { musicVolume, musicMuted, sfxVolume, pauseMusicUnfocused } = s
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ musicVolume, musicMuted, sfxVolume, pauseMusicUnfocused }),
    )
  } catch {
    /* ignore */
  }
}

/** Mode d'affichage. En navigateur, 'fullscreen' et 'borderless' utilisent tous
 *  deux l'API Fullscreen (un vrai « borderless » natif relève de l'appli desktop). */
export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless'

/** Applique le mode d'affichage via l'API Fullscreen (doit être appelé pendant
 *  un geste utilisateur pour entrer en plein écran). */
function applyDisplayMode(mode: DisplayMode) {
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
  /** Mode d'affichage courant (runtime, non persisté : on ne peut pas ré-entrer
   *  en plein écran automatiquement au chargement sans geste utilisateur). */
  displayMode: DisplayMode
  setMusicVolume: (v: number) => void
  toggleMusicMuted: () => void
  setSfxVolume: (v: number) => void
  togglePauseMusicUnfocused: () => void
  setDisplayMode: (mode: DisplayMode) => void
}

/** Réglages du joueur (volume/sourdine/coupure persistés ; affichage en runtime). */
export const useSettingsStore = create<SettingsStore>((set) => ({
  ...read(),
  displayMode: 'windowed',
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
    set(() => {
      applyDisplayMode(mode)
      return { displayMode: mode }
    }),
}))

// Synchronise le réglage si l'utilisateur quitte le plein écran (touche Échap).
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      const cur = useSettingsStore.getState().displayMode
      if (cur !== 'windowed') useSettingsStore.setState({ displayMode: 'windowed' })
    }
  })
}
