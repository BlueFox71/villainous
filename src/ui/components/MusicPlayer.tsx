import { useEffect, useRef } from 'react'
import { useGameStore, type VillainKey, villainKeyOf } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { useWindowActive } from '../hooks/useWindowActive'

// La BO source est très forte : on plafonne le gain réel. 100 % du curseur =
// MASTER_GAIN du volume HTML (0..1). Ajuster ici si besoin.
const MASTER_GAIN = 0.3

// Bande-son du tour d'un vilain. `loop` = jouer en boucle (Slenderman) ou une
// seule fois par tour (L'Imposteur — Among Us Tour ne reboucle pas). Vilains
// absents = pas de musique de tour (silence).
const VILLAIN_MUSIC: Partial<Record<VillainKey, { src: string; loop: boolean }>> = {
  slenderman: { src: '/audio/slenderman.mp3', loop: true },
  imposteur: { src: '/audio/among-us-tour.mp3', loop: false },
}

// Alarme one-shot jouée quand un Sabotage (O2 / Réacteur) est posé.
const SABOTAGE_ALARM = '/audio/sabotage-alarm.mp3'

/**
 * Musique d'ambiance EN PARTIE : joue, en boucle, la BO du vilain dont c'est le
 * tour (Slenderman, L'Imposteur…). Déclenche aussi l'alarme « Sabotage » quand
 * l'Imposteur pose un Sabotage. Volume / sourdine depuis les réglages persistants.
 */
/** `enabled` : la musique de tour ne démarre que lorsque l'intro de partie est
 *  passée (jet de dés terminé / splash « À vous de jouer »). Défaut : true. */
export function MusicPlayer({ enabled = true }: { enabled?: boolean }) {
  const villainId = useGameStore((s) => s.state.players[s.state.activePlayer]?.villain)
  const status = useGameStore((s) => s.state.status)
  const players = useGameStore((s) => s.state.players)
  const volume = useSettingsStore((s) => s.musicVolume)
  const muted = useSettingsStore((s) => s.musicMuted)
  const pauseUnfocused = useSettingsStore((s) => s.pauseMusicUnfocused)
  const active = useWindowActive()
  const ref = useRef<HTMLAudioElement>(null)

  const villainKey = villainId ? villainKeyOf(villainId) : null
  const music = villainKey ? VILLAIN_MUSIC[villainKey] : undefined
  const src = music?.src
  const loop = music?.loop ?? false
  const shouldPlay = enabled && status === 'PLAYING' && !!src && !muted && (!pauseUnfocused || active)
  const wasPlaying = useRef(false)

  // Volume (appliqué en continu), plafonné par MASTER_GAIN.
  useEffect(() => {
    if (ref.current) ref.current.volume = (muted ? 0 : volume) * MASTER_GAIN
  }, [volume, muted])

  // Change de piste selon le vilain actif + lecture/pause.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (src && el.getAttribute('src') !== src) {
      el.setAttribute('src', src)
      el.load()
    }
    el.loop = loop
    if (shouldPlay) {
      // Au DÉBUT d'un tour (transition arrêt → lecture), on repart du début — utile
      // pour les musiques non bouclées (Among Us Tour) qui rejouent à chaque tour.
      if (!wasPlaying.current) {
        try { el.currentTime = 0 } catch { /* pas encore chargé */ }
      }
      el.volume = volume * MASTER_GAIN
      // L'autoplay peut être refusé tant que l'utilisateur n'a pas interagi : on
      // ignore l'erreur (la lecture reprendra au prochain rendu après un clic).
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
    wasPlaying.current = shouldPlay
  }, [shouldPlay, volume, src, loop])

  // Alarme « Sabotage » : une seule fois par Sabotage posé. On mémorise les
  // instanceId de Sabotage déjà vus sur les plateaux.
  const seenSabotages = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (status !== 'PLAYING') return
    const onBoard = new Set<string>()
    for (const p of players) {
      for (const cards of Object.values(p.board)) {
        for (const c of cards) if (c.isSabotage && !c.attachedTo) onBoard.add(c.instanceId)
      }
    }
    let isNew = false
    for (const id of onBoard) {
      if (!seenSabotages.current.has(id)) isNew = true
    }
    // Nettoie les Sabotages disparus pour qu'un même slot puisse re-déclencher.
    seenSabotages.current = onBoard
    if (isNew && !muted && (!pauseUnfocused || active)) {
      const alarm = new Audio(SABOTAGE_ALARM)
      alarm.volume = Math.min(1, volume) * MASTER_GAIN * 1.4
      void alarm.play().catch(() => {})
    }
  }, [players, status, muted, volume, pauseUnfocused, active])

  return <audio ref={ref} preload="auto" />
}
