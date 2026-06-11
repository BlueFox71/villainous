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
