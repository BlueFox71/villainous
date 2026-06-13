// Voix d'intro de début de partie. Séquence : voix de MON vilain → « Contre »
// → voix du vilain ADVERSE. Chaque entrée a 4 variantes ; on en tire une au
// hasard. Les fichiers vivent dans `assets/Voix Villainous/`.
import type { VillainKey } from './store/gameStore'
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
}

const CONTRE_PREFIX = 'Contre'

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

/**
 * Joue la séquence d'intro : voix de `myKey`, puis « Contre », puis voix de
 * `oppKey`, enchaînées. Respecte le volume des bruitages (coupé si à zéro).
 */
export function playVillainIntro(myKey: VillainKey, oppKey: VillainKey) {
  if (typeof Audio === 'undefined') return
  const { sfxVolume } = useSettingsStore.getState()
  if (sfxVolume <= 0) return
  // Les voix sont plus marquantes qu'un clic : on les remonte par rapport au
  // canal bruitages (qui est volontairement discret).
  const volume = Math.min(1, sfxVolume * 2)

  const seq = [
    randomVoice(VOICE_PREFIX[myKey]),
    randomVoice(CONTRE_PREFIX),
    randomVoice(VOICE_PREFIX[oppKey]),
  ].filter((u): u is string => !!u)
  if (seq.length === 0) return

  // Coupe une éventuelle séquence précédente.
  if (current) {
    current.pause()
    current = null
  }

  const audio = new Audio()
  audio.volume = volume
  current = audio
  let i = 0
  const playNext = () => {
    if (audio !== current) return // une autre séquence a pris la main
    if (i >= seq.length) {
      current = null
      return
    }
    audio.src = seq[i++]
    void audio.play().catch(() => {})
  }
  audio.addEventListener('ended', playNext)
  playNext()
}
