import { useEffect, useRef } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useWindowActive } from '../hooks/useWindowActive'

// La BO source est forte : on plafonne le gain réel (idem MusicPlayer).
const MASTER_GAIN = 0.3

/**
 * Musique du menu (« Magic Mirror ») jouée en boucle sur les écrans hors-jeu.
 * Volume/sourdine pris des réglages. L'autoplay étant souvent bloqué avant toute
 * interaction, on (re)lance la lecture au premier geste utilisateur.
 */
export function MenuMusicPlayer() {
  const volume = useSettingsStore((s) => s.musicVolume)
  const muted = useSettingsStore((s) => s.musicMuted)
  const pauseUnfocused = useSettingsStore((s) => s.pauseMusicUnfocused)
  const active = useWindowActive()
  const ref = useRef<HTMLAudioElement>(null)

  // Coupée si en sourdine, ou (option) si l'app n'est pas au premier plan.
  const silenced = muted || (pauseUnfocused && !active)

  // Volume appliqué en continu.
  useEffect(() => {
    if (ref.current) ref.current.volume = (muted ? 0 : volume) * MASTER_GAIN
  }, [volume, muted])

  // Lecture selon la sourdine / le focus ; fallback sur le 1er geste si l'autoplay est bloqué.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (silenced) {
      el.pause()
      return
    }
    el.volume = volume * MASTER_GAIN
    const tryPlay = () => el.play().catch(() => {})
    void tryPlay()
    const onGesture = () => {
      void tryPlay()
    }
    document.addEventListener('pointerdown', onGesture, { once: true })
    document.addEventListener('keydown', onGesture, { once: true })
    return () => {
      document.removeEventListener('pointerdown', onGesture)
      document.removeEventListener('keydown', onGesture)
    }
  }, [silenced, volume])

  return <audio ref={ref} src="/audio/magic-mirror-menu.mp4" loop preload="auto" />
}
