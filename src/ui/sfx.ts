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
const LIEU_PIRATE_SRC = '/audio/lieu-pirate.mp3' // Sombra : un lieu est piraté (action désactivée)
const LIEU_PIRATE_GAIN = 0.75
const MAL_INTERIEUR_2_SRC = '/audio/mal-interieur-2.mp3' // Michael : passage au Mal Intérieur 2
// Calé sur la « phrase » de Michael (audioGain 0.3 → volume sfxVolume×2×0.3 = sfxVolume×0.6).
const MAL_INTERIEUR_2_GAIN = 0.6
const MAL_INTERIEUR_3_SRC = '/audio/mal-interieur-3.mp3' // Michael : passage au Mal Intérieur 3
const MAL_INTERIEUR_3_GAIN = 0.6
const GARDONS_SRC = '/audio/gardons-le-meilleur.mp3' // Michael : « Gardons le meilleur pour la fin »
const GARDONS_GAIN = 0.6
// Michael : annonce de tour propre au vilain (comme l'ambiance de L'Imposteur), une variante
// par palier de Mal Intérieur (index 0 = niveau 1). Même gain que ses autres sons (0.6).
const MICHAEL_TURN_SRCS = [
  '/audio/a-vous-de-jouer-1-myers.mp3',
  '/audio/a-vous-de-jouer-2-myers.mp3',
  '/audio/a-vous-de-jouer-3-myers.mp3',
]
const MICHAEL_TURN_GAIN = 0.6
const NO_CAN_DO_SRC = '/audio/no-can-do.ogg' // tentative de jouer une carte injouable
const NO_CAN_DO_GAIN = 0.5
const MANA_ADD_SRC = '/audio/mana-crystal-add.ogg' // le joueur gagne ≥1 jeton Pouvoir
const MANA_ADD_GAIN = 0.5
// Pioche : 3 variantes jouées au hasard, une par carte piochée (séquencé).
const DRAW_CARD_SRCS = ['/audio/draw_card_1.ogg', '/audio/draw_card_2.ogg', '/audio/draw_card_3.ogg']
const DRAW_CARD_GAIN = 0.45
const CARD_DRAG_LOOP_SRC = '/audio/card-drag-loop.ogg' // boucle pendant qu'on tient une carte au curseur
const CARD_DRAG_LOOP_GAIN = 0.08 // volume final discret
const CARD_DRAG_FADE_MS = 700 // durée du fondu d'entrée (montée progressive)

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
let lieuPirateBase: HTMLAudioElement | null = null
let malInterieur2Base: HTMLAudioElement | null = null
let malInterieur3Base: HTMLAudioElement | null = null
let gardonsBase: HTMLAudioElement | null = null
let michaelTurnBases: HTMLAudioElement[] = []
let noCanDoBase: HTMLAudioElement | null = null
let manaAddBase: HTMLAudioElement | null = null
let drawCardBases: HTMLAudioElement[] = []
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
  lieuPirateBase = new Audio(LIEU_PIRATE_SRC)
  lieuPirateBase.preload = 'auto'
  malInterieur2Base = new Audio(MAL_INTERIEUR_2_SRC)
  malInterieur2Base.preload = 'auto'
  malInterieur3Base = new Audio(MAL_INTERIEUR_3_SRC)
  malInterieur3Base.preload = 'auto'
  gardonsBase = new Audio(GARDONS_SRC)
  gardonsBase.preload = 'auto'
  michaelTurnBases = MICHAEL_TURN_SRCS.map((s) => {
    const a = new Audio(s)
    a.preload = 'auto'
    return a
  })
  noCanDoBase = new Audio(NO_CAN_DO_SRC)
  noCanDoBase.preload = 'auto'
  manaAddBase = new Audio(MANA_ADD_SRC)
  manaAddBase.preload = 'auto'
  drawCardBases = DRAW_CARD_SRCS.map((s) => {
    const a = new Audio(s)
    a.preload = 'auto'
    return a
  })
}

/** Joue le son d'erreur quand on tente de jouer une carte injouable. */
export function playNoCanDo() {
  if (!noCanDoBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = noCanDoBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * NO_CAN_DO_GAIN
  void a.play().catch(() => {})
}

/** Michael Myers — joue le bruitage quand il passe au MAL INTÉRIEUR 2. */
export function playMalInterieur2() {
  if (!malInterieur2Base) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = malInterieur2Base.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * MAL_INTERIEUR_2_GAIN
  void a.play().catch(() => {})
}

/** Michael Myers — joue le bruitage quand il passe au MAL INTÉRIEUR 3. */
export function playMalInterieur3() {
  if (!malInterieur3Base) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = malInterieur3Base.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * MAL_INTERIEUR_3_GAIN
  void a.play().catch(() => {})
}

/** Michael Myers — annonce de tour propre au vilain, selon son palier de Mal Intérieur
 *  (1, 2 ou 3). Remplace le « À vous de jouer » générique quand on incarne Michael. */
export function playMichaelTurn(level: number) {
  const idx = Math.min(3, Math.max(1, level)) - 1
  const src = michaelTurnBases[idx]
  if (!src) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = src.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * MICHAEL_TURN_GAIN
  void a.play().catch(() => {})
}

/** Michael Myers — joue le son quand « Gardons le meilleur pour la fin » est utilisé. */
export function playGardons() {
  if (!gardonsBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = gardonsBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * GARDONS_GAIN
  void a.play().catch(() => {})
}

/** Joue le son de cristal quand le joueur gagne au moins 1 jeton Pouvoir. */
export function playManaAdd() {
  if (!manaAddBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = manaAddBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * MANA_ADD_GAIN
  void a.play().catch(() => {})
}

/** Joue un son de pioche (une variante au hasard) — appelé une fois par carte piochée. */
export function playDrawCard() {
  if (drawCardBases.length === 0) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const base = drawCardBases[Math.floor(Math.random() * drawCardBases.length)]
  const a = base.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * DRAW_CARD_GAIN
  void a.play().catch(() => {})
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

// Boucle « cristal » pendant qu'une carte de la main est tenue au curseur (start/stop).
let cardDragLoop: HTMLAudioElement | null = null
let cardDragFade: ReturnType<typeof setInterval> | null = null

/** Démarre la boucle pendant qu'on tient une carte de la main au curseur (idempotent).
 *  Le son monte PROGRESSIVEMENT jusqu'à son volume final (fondu d'entrée) pour ne pas
 *  démarrer brutalement. */
export function startCardDragLoop() {
  if (typeof Audio === 'undefined') return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  stopCardDragLoop()
  const target = Math.min(1, sfxVolume) * CARD_DRAG_LOOP_GAIN
  const audio = new Audio(CARD_DRAG_LOOP_SRC)
  audio.loop = true
  audio.volume = 0
  cardDragLoop = audio
  void audio.play().catch(() => {})
  // Fondu d'entrée linéaire (≈ CARD_DRAG_FADE_MS) via paliers de 40 ms.
  const step = 40
  const ticks = Math.max(1, Math.round(CARD_DRAG_FADE_MS / step))
  let n = 0
  cardDragFade = setInterval(() => {
    n += 1
    if (cardDragLoop !== audio) return // une autre boucle a pris la main
    audio.volume = Math.min(target, (target * n) / ticks)
    if (n >= ticks && cardDragFade) {
      clearInterval(cardDragFade)
      cardDragFade = null
    }
  }, step)
}

/** Arrête la boucle « carte tenue au curseur » (no-op si déjà arrêtée). */
export function stopCardDragLoop() {
  if (cardDragFade) {
    clearInterval(cardDragFade)
    cardDragFade = null
  }
  if (cardDragLoop) {
    cardDragLoop.pause()
    cardDragLoop = null
  }
}

/** Sombra — joue « Lieu piraté » quand un Piratage désactive une action d'un lieu. */
export function playLieuPirate() {
  if (!lieuPirateBase) return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const a = lieuPirateBase.cloneNode() as HTMLAudioElement
  a.volume = Math.min(1, sfxVolume) * LIEU_PIRATE_GAIN
  void a.play().catch(() => {})
}
