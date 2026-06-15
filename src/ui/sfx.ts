// Petits effets sonores (SFX). Volume/sourdine repris des réglages musique.
import { useSettingsStore } from './store/settingsStore'

const CLICK_SRC = '/audio/button-press.ogg'
const CLICK_GAIN = 0.2 // le son est fort à la source : on le garde discret

const HOVER_SRC = '/audio/tiny-button-mouseover.ogg'
const HOVER_GAIN = 0.35
const TINY_PRESS_SRC = '/audio/tiny-button-press.ogg'
const TINY_PRESS_GAIN = 0.25
const BACK_CLICK_SRC = '/audio/back-click.ogg'
const BACK_CLICK_GAIN = 0.4
const PAGE_FLIP_SRC = '/audio/page-flip-back.ogg'
const PAGE_FLIP_GAIN = 0.5
const CARD_HOVER_SRC = '/audio/card-mouseover.ogg'
const CARD_HOVER_GAIN = 0.4
const HERO_HOVER_SRC = '/audio/hero-mouseover.ogg'
const HERO_HOVER_GAIN = 0.4
const HERO_SELECT_SRC = '/audio/hero-select.ogg'
const HERO_SELECT_GAIN = 0.25
const PLAY_HOVER_SRC = '/audio/play-button-mouseover.ogg'
const PLAY_HOVER_GAIN = 0.4
const QUEST_LOG_HOVER_SRC = '/audio/quest-log-mouseover.ogg'
const QUEST_LOG_HOVER_GAIN = 0.22
const BOX_HUB_PRESS_SRC = '/audio/box-hub-press.ogg'
const BOX_HUB_PRESS_GAIN = 0.4
const YOUR_TURN_SRC = '/audio/your-turn.ogg'
const YOUR_TURN_GAIN = 0.5
const END_TURN_SRC = '/audio/end-turn-flip.ogg'
const END_TURN_GAIN = 0.5
const END_TURN_ENABLE_SRC = '/audio/end-turn-enable.ogg'
const END_TURN_ENABLE_GAIN = 0.5
const HISTORY_EVENT_SRC = '/audio/history-event.ogg'
const HISTORY_EVENT_GAIN = 0.4
// Écran de début de partie (jet de dés « Qui commence ? »).
const START_DOWN_SRC = '/audio/start-bar-down.ogg' // apparition du panneau de dés
const START_DOWN_GAIN = 0.5
const START_FILL_SRC = '/audio/start-bar-fill-loop.ogg' // boucle pendant l'animation des dés
const START_FILL_GAIN = 0.45
const START_FLIP_SRC = '/audio/start-bar-flip.ogg' // résultat (gagnant) annoncé
const START_FLIP_GAIN = 0.5
const START_DROP_SRC = '/audio/start-bar-drop.ogg' // l'écran disparaît
const START_DROP_GAIN = 0.5
const VICTORY_JINGLE_SRC = '/audio/victory-screen-start.ogg' // écran de VICTOIRE
const VICTORY_JINGLE_GAIN = 0.8
const DEFEAT_JINGLE_SRC = '/audio/defeat-screen-start.ogg' // écran de DÉFAITE
const DEFEAT_JINGLE_GAIN = 0.8
const VICTORY_BUILDUP_SRC = '/audio/victory-jingle.ogg' // démarre AVEC l'éclat (victoire)
const VICTORY_BUILDUP_GAIN = 0.9
const DEFEAT_BUILDUP_SRC = '/audio/defeat-jingle.ogg' // démarre AVEC l'éclat (défaite)
const DEFEAT_BUILDUP_GAIN = 0.9
const SHATTER_SRC = '/audio/hero-portrait-explode.ogg' // au moment où le plateau explose
const SHATTER_GAIN = 0.7
const CRACK_SRC = '/audio/craquement.mp3' // pendant que les fissures se propagent
const CRACK_GAIN = 0.8

// Éléments de base préchargés ; on les clone à chaque lecture pour autoriser le
// chevauchement de sons rapprochés.
let base: HTMLAudioElement | null = null
let hoverBase: HTMLAudioElement | null = null
let tinyPressBase: HTMLAudioElement | null = null
let backClickBase: HTMLAudioElement | null = null
let pageFlipBase: HTMLAudioElement | null = null
let cardHoverBase: HTMLAudioElement | null = null
let heroHoverBase: HTMLAudioElement | null = null
let heroSelectBase: HTMLAudioElement | null = null
let playHoverBase: HTMLAudioElement | null = null
let questLogHoverBase: HTMLAudioElement | null = null
let boxHubPressBase: HTMLAudioElement | null = null
let yourTurnBase: HTMLAudioElement | null = null
let endTurnBase: HTMLAudioElement | null = null
let endTurnEnableBase: HTMLAudioElement | null = null
let historyEventBase: HTMLAudioElement | null = null
let startDownBase: HTMLAudioElement | null = null
let startFlipBase: HTMLAudioElement | null = null
let startDropBase: HTMLAudioElement | null = null
let victoryJingleBase: HTMLAudioElement | null = null
let defeatJingleBase: HTMLAudioElement | null = null
let victoryBuildupBase: HTMLAudioElement | null = null
let defeatBuildupBase: HTMLAudioElement | null = null
let shatterBase: HTMLAudioElement | null = null
let crackBase: HTMLAudioElement | null = null
if (typeof Audio !== 'undefined') {
  base = new Audio(CLICK_SRC)
  base.preload = 'auto'
  hoverBase = new Audio(HOVER_SRC)
  hoverBase.preload = 'auto'
  tinyPressBase = new Audio(TINY_PRESS_SRC)
  tinyPressBase.preload = 'auto'
  backClickBase = new Audio(BACK_CLICK_SRC)
  backClickBase.preload = 'auto'
  pageFlipBase = new Audio(PAGE_FLIP_SRC)
  pageFlipBase.preload = 'auto'
  cardHoverBase = new Audio(CARD_HOVER_SRC)
  cardHoverBase.preload = 'auto'
  heroHoverBase = new Audio(HERO_HOVER_SRC)
  heroHoverBase.preload = 'auto'
  heroSelectBase = new Audio(HERO_SELECT_SRC)
  heroSelectBase.preload = 'auto'
  playHoverBase = new Audio(PLAY_HOVER_SRC)
  playHoverBase.preload = 'auto'
  questLogHoverBase = new Audio(QUEST_LOG_HOVER_SRC)
  questLogHoverBase.preload = 'auto'
  boxHubPressBase = new Audio(BOX_HUB_PRESS_SRC)
  boxHubPressBase.preload = 'auto'
  yourTurnBase = new Audio(YOUR_TURN_SRC)
  yourTurnBase.preload = 'auto'
  endTurnBase = new Audio(END_TURN_SRC)
  endTurnBase.preload = 'auto'
  endTurnEnableBase = new Audio(END_TURN_ENABLE_SRC)
  endTurnEnableBase.preload = 'auto'
  historyEventBase = new Audio(HISTORY_EVENT_SRC)
  historyEventBase.preload = 'auto'
  startDownBase = new Audio(START_DOWN_SRC)
  startDownBase.preload = 'auto'
  startFlipBase = new Audio(START_FLIP_SRC)
  startFlipBase.preload = 'auto'
  startDropBase = new Audio(START_DROP_SRC)
  startDropBase.preload = 'auto'
  victoryJingleBase = new Audio(VICTORY_JINGLE_SRC)
  victoryJingleBase.preload = 'auto'
  defeatJingleBase = new Audio(DEFEAT_JINGLE_SRC)
  defeatJingleBase.preload = 'auto'
  victoryBuildupBase = new Audio(VICTORY_BUILDUP_SRC)
  victoryBuildupBase.preload = 'auto'
  defeatBuildupBase = new Audio(DEFEAT_BUILDUP_SRC)
  defeatBuildupBase.preload = 'auto'
  shatterBase = new Audio(SHATTER_SRC)
  shatterBase.preload = 'auto'
  crackBase = new Audio(CRACK_SRC)
  crackBase.preload = 'auto'
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

/** Joue le son de survol (mouseover) d'un bouton (respecte le volume des bruitages). */
export function playHover() {
  if (!hoverBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = hoverBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * HOVER_GAIN
  void a.play().catch(() => {})
}

/** Joue le petit son d'appui de bouton (ex. « Fermer » de la fiche vilain). */
export function playTinyButtonPress() {
  if (!tinyPressBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = tinyPressBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * TINY_PRESS_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de retour (bouton « ← Menu » de l'écran Nouvelle partie). */
export function playBackClick() {
  if (!backClickBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = backClickBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * BACK_CLICK_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de « tourne de page » (Voir toutes les cartes / retour à la fiche). */
export function playPageFlip() {
  if (!pageFlipBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = pageFlipBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * PAGE_FLIP_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de survol d'une carte (galerie « Voir toutes les cartes »). */
export function playCardHover() {
  if (!cardHoverBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = cardHoverBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * CARD_HOVER_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de survol d'un vilain (liste des vilains). */
export function playHeroHover() {
  if (!heroHoverBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = heroHoverBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * HERO_HOVER_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de sélection d'un vilain (clic sur une carte de la liste). */
export function playHeroSelect() {
  if (!heroSelectBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = heroSelectBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * HERO_SELECT_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de survol du bouton « Lancer la partie » (choix des vilains). */
export function playPlayButtonHover() {
  if (!playHoverBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = playHoverBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * PLAY_HOVER_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de survol du bouton « Mon profil » (menu principal). */
export function playProfileHover() {
  if (!questLogHoverBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = questLogHoverBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * QUEST_LOG_HOVER_GAIN
  void a.play().catch(() => {})
}

/** Joue le son d'appui des boutons de mode de partie (« Nouvelle partie »). */
export function playBoxHubPress() {
  if (!boxHubPressBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = boxHubPressBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * BOX_HUB_PRESS_GAIN
  void a.play().catch(() => {})
}

/** Joue le son d'alerte « À vous de jouer » (début du tour du joueur). */
export function playYourTurn() {
  if (!yourTurnBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = yourTurnBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * YOUR_TURN_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de fin de tour (bouton « Fin de tour » en partie). */
export function playEndTurnFlip() {
  if (!endTurnBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = endTurnBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * END_TURN_GAIN
  void a.play().catch(() => {})
}

/** Joue le son d'activation du bouton « Fin de tour » (grisé → utilisable). */
export function playEndTurnEnable() {
  if (!endTurnEnableBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = endTurnEnableBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * END_TURN_ENABLE_GAIN
  void a.play().catch(() => {})
}

/** Joue le son d'ouverture d'une défausse / pile (Vilain, Fatalité, Au-delà). */
export function playHistoryEvent() {
  if (!historyEventBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = historyEventBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * HISTORY_EVENT_GAIN
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

// --- Écran de début de partie (jet de dés) -------------------------------------

/** Joue un bruitage one-shot calé sur le volume des BRUITAGES (sfx). */
function playSfxOneShot(baseEl: HTMLAudioElement | null, gain: number) {
  if (!baseEl) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = baseEl.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * gain
  void a.play().catch(() => {})
}

/** Apparition du panneau de dés (« la barre descend »). */
export function playStartBarDown() {
  playSfxOneShot(startDownBase, START_DOWN_GAIN)
}

/** Annonce du résultat (gagnant) — « flip » de la barre. */
export function playStartBarFlip() {
  playSfxOneShot(startFlipBase, START_FLIP_GAIN)
}

/** L'écran de début disparaît — « drop » de la barre. */
export function playStartBarDrop() {
  playSfxOneShot(startDropBase, START_DROP_GAIN)
}

/** Jingle de l'écran de VICTOIRE. */
export function playVictoryJingle() {
  playSfxOneShot(victoryJingleBase, VICTORY_JINGLE_GAIN)
}

/** Jingle de l'écran de DÉFAITE. */
export function playDefeatJingle() {
  playSfxOneShot(defeatJingleBase, DEFEAT_JINGLE_GAIN)
}

// Musique de « montée » jouée DÈS le début de l'éclat du plateau (sync : sa ~4,9ᵉ
// seconde coïncide avec l'apparition de l'écran de fin). Une seule instance à la
// fois (victoire OU défaite), contrôlable pour pouvoir la couper (retour menu / rejeu).
let endBuildup: HTMLAudioElement | null = null

function startBuildup(base: HTMLAudioElement | null, gain: number) {
  if (!base) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  stopVictoryBuildup()
  const a = base.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * gain
  endBuildup = a
  void a.play().catch(() => {})
}

/** Démarre la musique de montée de VICTOIRE (depuis le début). */
export function startVictoryBuildup() {
  startBuildup(victoryBuildupBase, VICTORY_BUILDUP_GAIN)
}

/** Démarre la musique de montée de DÉFAITE (depuis le début). */
export function startDefeatBuildup() {
  startBuildup(defeatBuildupBase, DEFEAT_BUILDUP_GAIN)
}

/** Coupe la musique de montée en cours (victoire ou défaite ; no-op si arrêtée). */
export function stopVictoryBuildup() {
  if (endBuildup) {
    endBuildup.pause()
    endBuildup = null
  }
}

/** Explosion du plateau (au moment où il vole en éclats). */
export function playShatter() {
  playSfxOneShot(shatterBase, SHATTER_GAIN)
}

/** Craquement, pendant que les fissures se propagent (début de l'animation). */
export function playCrack() {
  playSfxOneShot(crackBase, CRACK_GAIN)
}

// Boucle de « remplissage » pendant l'animation des dés (start/stop contrôlés).
let startFillLoop: HTMLAudioElement | null = null

/** Démarre la boucle sonore pendant l'animation des dés (idempotent). */
export function startStartBarFill() {
  if (typeof Audio === 'undefined') return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  stopStartBarFill()
  startFillLoop = new Audio(START_FILL_SRC)
  startFillLoop.loop = true
  startFillLoop.volume = Math.min(1, sfxVolume) * START_FILL_GAIN
  void startFillLoop.play().catch(() => {})
}

/** Arrête la boucle de « remplissage » (no-op si déjà arrêtée). */
export function stopStartBarFill() {
  if (startFillLoop) {
    startFillLoop.pause()
    startFillLoop = null
  }
}
