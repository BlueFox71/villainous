import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { useWindowActive } from '../hooks/useWindowActive'

// La BO source est très forte : on plafonne le gain réel. 100 % du curseur =
// MASTER_GAIN du volume HTML (0..1). Ajuster ici si besoin.
const MASTER_GAIN = 0.3

/**
 * Joue la bande-son « Slender: The Arrival » (en boucle) tant que c'est le tour
 * de Slenderman. Le volume / la sourdine viennent des réglages persistants.
 * Rendu dans l'écran de jeu : la musique s'arrête en quittant la partie.
 */
export function MusicPlayer() {
  const villain = useGameStore((s) => s.state.players[s.state.activePlayer]?.villain)
  const status = useGameStore((s) => s.state.status)
  const volume = useSettingsStore((s) => s.musicVolume)
  const muted = useSettingsStore((s) => s.musicMuted)
  const pauseUnfocused = useSettingsStore((s) => s.pauseMusicUnfocused)
  const active = useWindowActive()
  const ref = useRef<HTMLAudioElement>(null)

  const shouldPlay =
    status === 'PLAYING' &&
    villain === 'slenderman' &&
    !muted &&
    (!pauseUnfocused || active)

  // Volume (appliqué en continu), plafonné par MASTER_GAIN.
  useEffect(() => {
    if (ref.current) ref.current.volume = (muted ? 0 : volume) * MASTER_GAIN
  }, [volume, muted])

  // Lecture / pause selon le tour courant.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (shouldPlay) {
      el.volume = volume * MASTER_GAIN
      // L'autoplay peut être refusé tant que l'utilisateur n'a pas interagi : on
      // ignore l'erreur (la lecture reprendra au prochain rendu après un clic).
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [shouldPlay, volume])

  return <audio ref={ref} src="/audio/slenderman.mp3" loop preload="auto" />
}
