import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Scroller } from '../components/Scroller'

// Glob PARESSEUX de tous les sons sources rangés dans `assets/Sounds`.
// `query: '?url'` → chaque entrée est une fonction `() => Promise<url>` ; Vite
// sert le fichier en dev et l'émet au build au moment où on le demande (on
// n'embarque donc rien tant qu'un son n'est pas joué). Page d'outillage : on
// lit directement les sources `assets/` plutôt que d'en dupliquer 2600+ copies
// dans `public/`.
const SOUND_MODULES = import.meta.glob('/assets/Sounds/**/*.{ogg,mp3,wav,m4a}', {
  query: '?url',
  import: 'default',
}) as Record<string, () => Promise<string>>

const PREFIX = '/assets/Sounds/'

interface SoundEntry {
  /** Chemin complet (clé du glob), sert d'identifiant. */
  path: string
  /** Chemin relatif sous `Sounds/` (affiché). */
  rel: string
  /** Première composante du chemin = catégorie. */
  category: string
  /** Nom de fichier seul. */
  name: string
  /** Chargeur paresseux de l'URL. */
  load: () => Promise<string>
}

/** Toutes les entrées, triées par chemin (donc groupées par catégorie). */
const ALL: SoundEntry[] = Object.entries(SOUND_MODULES)
  .map(([path, load]) => {
    const rel = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path
    const slash = rel.indexOf('/')
    return {
      path,
      rel,
      category: slash >= 0 ? rel.slice(0, slash) : '(racine)',
      name: rel.slice(rel.lastIndexOf('/') + 1),
      load,
    }
  })
  .sort((a, b) => a.path.localeCompare(b.path))

const CATEGORIES = Array.from(new Set(ALL.map((s) => s.category))).sort()

interface Props {
  onBack: () => void
}

/**
 * Page d'outillage : parcourir et écouter TOUS les sons du dossier `assets/Sounds`.
 * Recherche + filtre par catégorie, lecture au clic, navigation précédent/suivant
 * et lecture automatique enchaînée pour défiler la liste entière.
 */
export function SoundTest({ onBack }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [volume, setVolume] = useState(0.7)
  const [autoplay, setAutoplay] = useState(false)
  // Chemin du son en cours de lecture (null = aucun).
  const [current, setCurrent] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Crée l'élément audio à la première demande (jamais pendant le rendu).
  const getAudio = useCallback(() => {
    if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio()
    return audioRef.current
  }, [])

  // Liste filtrée (recherche insensible à la casse sur le chemin relatif + catégorie).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL.filter((s) => {
      if (category !== 'all' && s.category !== category) return false
      if (q && !s.rel.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, category])

  // Garde le volume de l'élément audio synchronisé.
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  // Joue le son d'INDEX `i` dans la liste filtrée courante.
  const playIndex = useCallback(
    async (i: number) => {
      const entry = filtered[i]
      const audio = getAudio()
      if (!entry || !audio) return
      setCurrent(entry.path)
      const url = await entry.load()
      audio.src = url
      audio.volume = volume
      void audio.play().catch(() => {})
    },
    [filtered, getAudio, volume],
  )

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setCurrent(null)
  }, [])

  // Index du son courant dans la liste filtrée (-1 si absent du filtre actuel).
  const currentIndex = current ? filtered.findIndex((s) => s.path === current) : -1

  function step(delta: number) {
    const base = currentIndex >= 0 ? currentIndex : -1
    const next = base + delta
    if (next >= 0 && next < filtered.length) void playIndex(next)
  }

  // Fin de lecture : enchaîne sur le suivant si la lecture auto est activée.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => {
      if (!autoplay) return
      const idx = current ? filtered.findIndex((s) => s.path === current) : -1
      const next = idx + 1
      if (next < filtered.length) void playIndex(next)
      else setCurrent(null)
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [autoplay, current, filtered, playIndex])

  // Arrête tout en quittant la page.
  useEffect(() => () => stop(), [stop])

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0b0a12] text-white">
      {/* En-tête */}
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-black/40 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
        >
          ← Retour
        </button>
        <h1 className="text-lg font-bold uppercase tracking-wide text-amber-200">
          🔊 Banque de sons
        </h1>
        <span className="text-sm text-white/50">
          {filtered.length} / {ALL.length} sons
        </span>
      </header>

      {/* Barre d'outils : recherche, catégorie, volume, lecture auto */}
      <div className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-black/20 px-6 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="w-56 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm placeholder:text-white/30 focus:border-amber-300/60 focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm focus:border-amber-300/60 focus:outline-none"
        >
          <option value="all">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            title="Précédent"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            title="Stop"
          >
            ⏹
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            title="Suivant"
          >
            ⏭
          </button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
          />
          Lecture auto
        </label>

        <label className="flex items-center gap-2 text-sm text-white/70">
          🔈
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-32 accent-amber-400"
          />
        </label>
      </div>

      {/* Liste défilable, séparée par catégorie */}
      <Scroller className="flex-1">
        <ul className="flex flex-col px-6 py-4">
          {filtered.map((s, i) => {
            const isCurrent = s.path === current
            // Affiche un entête de catégorie quand elle change.
            const showHeader = i === 0 || filtered[i - 1].category !== s.category
            return (
              <li key={s.path}>
                {showHeader && (
                  <div className="mt-4 mb-1 text-xs font-bold uppercase tracking-wider text-amber-300/70 first:mt-0">
                    {s.category}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void playIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    isCurrent ? 'bg-amber-400/20 text-amber-100' : 'text-white/75 hover:bg-white/5'
                  }`}
                >
                  <span className="w-6 shrink-0 text-center text-xs text-white/30">
                    {isCurrent ? '▶' : '♪'}
                  </span>
                  <span className="truncate">{s.rel.slice(s.category.length + 1) || s.name}</span>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-white/40">Aucun son trouvé.</li>
          )}
        </ul>
      </Scroller>
    </div>
  )
}
