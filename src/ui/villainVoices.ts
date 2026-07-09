// Voix d'intro de début de partie. Séquence : voix de MON vilain → « Contre »
// → voix du vilain ADVERSE. Chaque entrée a 4 variantes ; on en tire une au
// hasard. Les fichiers vivent dans `assets/Voix Villainous/`.
import { villainKeyOf, isCustomKey, customVillainOf, VILLAIN_REGISTRY, type VillainKey } from './store/gameStore'
import { useSettingsStore } from './store/settingsStore'

// Glob EAGER des voix en URL (fichiers .wav légers, simples références d'URL —
// l'audio n'est pas chargé tant qu'on ne le joue pas).
const VOICE_FILES = import.meta.glob('/assets/Voix Villainous/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Index par nom de fichier normalisé (minuscule, sans extension, NFC) → URL.
// Absorbe les variations de casse des fichiers (« Capitaine crochet 4 »…).
const BY_NAME: Record<string, string> = {}
for (const [path, url] of Object.entries(VOICE_FILES)) {
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.wav$/i, '')
  BY_NAME[file.toLowerCase().normalize('NFC')] = url
}

// Préfixe de fichier par vilain (le suffixe est « N » de 1 à 4). Distinct du
// libellé d'affichage : les fichiers n'ont pas exactement la même graphie.
const VOICE_PREFIX: Record<VillainKey, string> = {
  princeJohn: 'Prince Jean',
  maleficent: 'Maléfique',
  slenderman: 'Slenderman',
  jafar: 'Jafar',
  reineCoeur: 'La reine de coeur',
  crochet: 'Capitaine Crochet',
  ursula: 'Ursula',
  hades: 'Hadès',
  facilier: 'Docteur Facilier',
  imposteur: "L'imposteur",
  bowser: 'Bowser', // pas (encore) de fichiers de voix → intro silencieuse
  tabbou: 'Tabbou', // pas (encore) de fichiers de voix → intro silencieuse
  mechanteReine: 'La méchante Reine',
  scar: 'Scar',
  yzma: 'Yzma',
  ratigan: 'Ratigan', // pas (encore) de fichiers de voix → intro silencieuse
  sombra: 'Sombra',
  patHibulaire: 'Pat Hibulaire', // pas (encore) de fichiers de voix → intro silencieuse
  gothel: 'La mère Gothel', // 1 seule variante présente (n°2) ; les 3 autres manquent encore
  cruella: "Cruella d'enfer", // 4 variantes présentes
  gaston: 'Gaston', // 4 variantes présentes
  seigneurCles: 'Le Seigneur des clés', // 4 variantes présentes
  madameTremaine: 'Madame de trémaine', // 4 variantes présentes
  oogieBoogie: 'Oogie Boogie', // pas (encore) de fichiers de voix → intro silencieuse
  seigneurTenebres: 'Le Seigneur des Ténèbres', // 4 variantes présentes
  madameMim: 'Madame mim', // 4 variantes présentes
  syndrome: 'Syndrome', // 4 variantes présentes
  lotso: 'Lotso', // 4 variantes présentes
  saSucrerie: 'Sa sucrerie', // 4 variantes présentes
  shereKhan: 'Shere khan', // 4 variantes présentes
  davyJones: 'Davy jones', // 4 variantes présentes
  tamatoa: 'Tamatoa', // 4 variantes présentes
  teamRocket: 'La team rocket', // fichiers « La team rocket N.wav »
  laBonneFee: 'Marraine la bonne fée', // 4 variantes présentes
}

const CONTRE_PREFIX = 'Contre'

/** Préfixe de fichier de voix pour un vilain (par id porté par le PlayerState) :
 *  natif → table `VOICE_PREFIX` ; PERSONNALISÉ → le NOM du vilain (les fichiers
 *  « <Nom> 1.wav »… ajoutés à la main dans `Voix Villainous`). undefined si inconnu. */
function voicePrefixOf(villainId: string): string | undefined {
  if (isCustomKey(villainId)) return customVillainOf(villainId)?.name
  return VOICE_PREFIX[villainKeyOf(villainId)]
}

/** URL d'une variante précise (`<prefix> <n>`), insensible à la casse. */
function urlFor(prefix: string, n: number): string | undefined {
  return BY_NAME[`${prefix} ${n}`.toLowerCase().normalize('NFC')]
}

/** Tire au hasard une des variantes 1..max existantes d'un préfixe. */
function randomVoice(prefix: string, max = 4): string | undefined {
  const urls: string[] = []
  for (let n = 1; n <= max; n++) {
    const u = urlFor(prefix, n)
    if (u) urls.push(u)
  }
  if (urls.length === 0) return undefined
  return urls[Math.floor(Math.random() * urls.length)]
}

// Lecteur courant, pour pouvoir couper une séquence encore en cours.
let current: HTMLAudioElement | null = null

/** Coupe `audio` en FONDU (volume → 0 sur `ms`) puis le met en pause, au lieu d'un
 *  arrêt net. Sert à ne pas couper brusquement une phrase en cours (remplacée par une
 *  autre, ou interrompue par le début d'une séquence). */
function fadeOutAndStop(audio: HTMLAudioElement, ms = 450): void {
  const start = audio.volume
  if (start <= 0 || audio.paused) { audio.pause(); return }
  const steps = 15
  let i = 0
  const id = setInterval(() => {
    i++
    audio.volume = Math.max(0, start * (1 - i / steps))
    if (i >= steps) { clearInterval(id); audio.pause() }
  }, ms / steps)
}

/** Arrête la piste courante en fondu (jamais d'arrêt net). */
function stopCurrent(): void {
  if (!current) return
  fadeOutAndStop(current)
  current = null
}

/**
 * Joue la séquence d'intro : voix de `myKey`, puis « Contre », puis voix de
 * `oppKey`, enchaînées. Respecte le volume des bruitages (coupé si à zéro).
 */
export function playVillainIntro(myVillainId: string, oppVillainId: string, onDone?: () => void) {
  // `onDone` est appelé quand la séquence est terminée — ou tout de suite si rien
  // n'est joué (audio indisponible, son coupé, aucune voix) — pour que l'appelant
  // puisse enchaîner (ex. faire apparaître les dés APRÈS la voix).
  if (typeof Audio === 'undefined') { onDone?.(); return }
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) { onDone?.(); return }
  // Les voix sont plus marquantes qu'un clic : on les remonte par rapport au
  // canal bruitages (qui est volontairement discret).
  const volume = Math.min(1, sfxVolume * 2)

  const myPrefix = voicePrefixOf(myVillainId)
  const oppPrefix = voicePrefixOf(oppVillainId)
  const seq = [
    myPrefix ? randomVoice(myPrefix) : undefined,
    randomVoice(CONTRE_PREFIX),
    oppPrefix ? randomVoice(oppPrefix) : undefined,
  ].filter((u): u is string => !!u)
  if (seq.length === 0) { onDone?.(); return }

  // Coupe une éventuelle séquence/phrase précédente (en fondu, sauf phrase `noFade`).
  stopCurrent()

  const audio = new Audio()
  audio.volume = volume
  current = audio
  let i = 0
  const playNext = () => {
    if (audio !== current) return // une autre séquence a pris la main
    if (i >= seq.length) {
      current = null
      onDone?.()
      return
    }
    audio.src = seq[i++]
    void audio.play().catch(() => {})
  }
  audio.addEventListener('ended', playNext)
  // Filet : si une piste échoue à se charger/jouer, on passe à la suivante au lieu
  // de bloquer la séquence (et donc l'apparition des dés).
  audio.addEventListener('error', playNext)
  playNext()
}

// --- Phrases de fermeture d'intro -------------------------------------------
// Quand les portraits quittent l'écran (fin de l'intro), un vilain peut « lâcher »
// une phrase. Fichiers .mp3/.m4a dans `assets/Voix Villainous/` (ex. « Scar phrase.mp3 »).
// On capte « phrase » ET « Phrase » (selon la casse du nom de fichier, ex. « Mère
// Gothel Phrase.mp3 ») : le glob de Vite est sensible à la casse.
const PHRASE_FILES = import.meta.glob(
  [
    '/assets/Voix Villainous/*phrase*.mp3',
    '/assets/Voix Villainous/*Phrase*.mp3',
    // Certaines phrases sont fournies en .m4a (AAC), lu nativement par le navigateur.
    '/assets/Voix Villainous/*phrase*.m4a',
    '/assets/Voix Villainous/*Phrase*.m4a',
  ],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>
const PHRASE_BY_NAME: Record<string, string> = {}
for (const [path, url] of Object.entries(PHRASE_FILES)) {
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.(mp3|m4a)$/i, '')
  PHRASE_BY_NAME[file.toLowerCase().normalize('NFC')] = url
}
// Nom de fichier (sans extension) par vilain + gain relatif optionnel (1 = plein
// volume ; <1 pour atténuer une phrase trop forte). Seuls quelques vilains en ont.
// `fadeEndS` : durée (s) du fondu de FIN de la phrase (défaut 0.6). Plus petit = le
// fondu démarre plus près de la fin (Scar : fondu court, presque toute la phrase à plein
// volume).
const PHRASE_FILE: Partial<Record<VillainKey, { file: string; gain?: number; fadeEndS?: number }>> = {
  scar: { file: 'Scar phrase', fadeEndS: 0.3 },
  hades: { file: 'hadès phrase' },
  maleficent: { file: 'Maléfique phrase', gain: 0.7 },
  sombra: { file: 'Sombra phrase', gain: 0.5 },
  ursula: { file: 'Ursula phrase', gain: 0.5 },
  gothel: { file: 'Mère Gothel Phrase' },
  madameTremaine: { file: 'Phrase madame de trémaine' },
  facilier: { file: 'Phrase Dr facilier' },
  syndrome: { file: 'Phrase syndrome' },
  gaston: { file: 'gaston phrase' },
  tabbou: { file: 'Tabbou phrase' },
  bowser: { file: 'Bowser phrase' },
  teamRocket: { file: 'Team Rocket phrase' },
  laBonneFee: { file: 'marraine la bonne fée phrase' },
}
function phraseTrack(key: VillainKey): { url: string; gain: number; fadeEndS: number } | undefined {
  const entry = PHRASE_FILE[key]
  if (!entry) return undefined
  const url = PHRASE_BY_NAME[entry.file.toLowerCase().normalize('NFC')]
  return url ? { url, gain: entry.gain ?? 1, fadeEndS: entry.fadeEndS ?? 0.6 } : undefined
}

/** URL de la phrase d'un vilain NATIF si un fichier existe, sinon undefined. Sert à
 *  décider d'afficher (ou non) un bouton « écouter la réplique » (fiche vilain). Les
 *  vilains personnalisés/publiés n'ont pas de phrase → undefined. */
export function villainPhraseUrl(villainId: string): string | undefined {
  if (isCustomKey(villainId)) return undefined
  // `villainId` peut être une VillainKey (fiche vilain) OU un def.id : on résout la clé
  // sans passer par le fallback `princeJohn` de `villainKeyOf` quand c'est déjà une clé.
  const key = (villainId in VILLAIN_REGISTRY ? (villainId as VillainKey) : villainKeyOf(villainId))
  return phraseTrack(key)?.url
}

/** Joue la phrase d'un vilain (si elle existe), p. ex. à sa sélection dans l'écran
 *  de choix. No-op si aucun fichier de phrase, si le son est coupé, ou hors navigateur.
 *  Coupe une éventuelle phrase/voix en cours. */
export function playVillainPhrase(key: VillainKey) {
  if (typeof Audio === 'undefined') return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  const track = phraseTrack(key)
  if (!track) return
  stopCurrent()
  const audio = new Audio()
  const baseVolume = Math.min(1, sfxVolume * 2 * track.gain)
  audio.volume = baseVolume
  audio.src = track.url
  current = audio
  // Fondu en fin de phrase : sur les dernières `fadeEndS` secondes, on baisse le volume
  // jusqu'à 0 pour éviter une coupure sèche. Désactivé si la phrase est remplacée
  // (audio ≠ current → `fadeOutAndStop` gère le fondu d'interruption).
  const FADE_S = track.fadeEndS
  audio.addEventListener('timeupdate', () => {
    if (audio !== current || !isFinite(audio.duration)) return
    const left = audio.duration - audio.currentTime
    if (left < FADE_S) audio.volume = Math.max(0, baseVolume * (left / FADE_S))
  })
  void audio.play().catch(() => {})
}

/**
 * Joue, à la fermeture de l'intro, la phrase de l'ADVERSAIRE (`oppKey`) puis celle
 * de NOTRE vilain (`myKey`), enchaînées. `onDone` est appelé à la fin — ou tout de
 * suite si rien n'est joué (son coupé, aucune phrase) — pour enchaîner la fermeture.
 */
export function playClosingPhrases(myKey: VillainKey, oppKey: VillainKey, onDone?: () => void) {
  if (typeof Audio === 'undefined') { onDone?.(); return }
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) { onDone?.(); return }
  const volume = Math.min(1, sfxVolume * 2)
  // D'abord l'adversaire, puis notre personnage.
  const seq = [phraseTrack(oppKey), phraseTrack(myKey)].filter(
    (t): t is { url: string; gain: number; fadeEndS: number } => !!t,
  )
  if (seq.length === 0) { onDone?.(); return }
  stopCurrent()
  const audio = new Audio()
  current = audio
  let i = 0
  const playNext = () => {
    if (audio !== current) return
    if (i >= seq.length) { current = null; onDone?.(); return }
    const track = seq[i++]
    audio.volume = Math.min(1, volume * track.gain)
    audio.src = track.url
    void audio.play().catch(() => {})
  }
  audio.addEventListener('ended', playNext)
  audio.addEventListener('error', playNext)
  playNext()
}
