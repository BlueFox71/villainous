// Petits effets sonores (SFX). Volume/sourdine repris des réglages musique.
import { useSettingsStore } from './store/settingsStore'

const CLICK_SRC = '/audio/button-press.ogg'
const CLICK_GAIN = 0.2 // le son est fort à la source : on le garde discret

// Élément de base préchargé ; on le clone à chaque lecture pour autoriser le
// chevauchement de clics rapprochés.
let base: HTMLAudioElement | null = null
if (typeof Audio !== 'undefined') {
  base = new Audio(CLICK_SRC)
  base.preload = 'auto'
}

/** Joue le son de clic de bouton (respecte le volume des bruitages). */
export function playClick() {
  if (!base) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = base.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * CLICK_GAIN
  void a.play().catch(() => {})
}

// Son « Among Us (Kill) » — aligné sur le volume MUSIQUE (comme l'alarme Sabotage).
const MUSIC_MASTER = 0.3

/** Joue un son one-shot calé sur le volume MUSIQUE (respecte la sourdine). */
function playMusicOneShot(src: string, gain: number) {
  if (typeof Audio === 'undefined') return
  const { musicVolume, musicMuted } = useSettingsStore.getState()
  if (musicMuted || musicVolume <= 0) return
  const a = new Audio(src)
  a.volume = Math.min(1, musicVolume) * MUSIC_MASTER * gain
  void a.play().catch(() => {})
}

/** Joue le son de mise à mort (carte Tuer de L'Imposteur), one-shot. */
export function playKillSound() {
  playMusicOneShot('/audio/among-us-kill.mp3', 1.6)
}

/** Joue le son « Task complete » (Tâche neutralisée par les Coéquipiers), one-shot. */
export function playTaskComplete() {
  playMusicOneShot('/audio/task-complete.mp3', 1.6)
}

/** Joue le son « Corps découvert » (Fatalité Corps découvert), one-shot. */
export function playDeadBody() {
  playMusicOneShot('/audio/among-us-corps.mp3', 1.6)
}

/** Joue le son « Emergency meeting » (Fatalité Réunion d'urgence), one-shot. */
export function playEmergencyMeeting() {
  playMusicOneShot('/audio/among-us-emergency.mp3', 1.6)
}
