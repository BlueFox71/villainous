import { useMemo, useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { villainPortrait } from '../villainArt'
import { playHeroHover, playHover, playHeroSelect } from '../sfx'
import { VILLAIN_GUIDE } from '../villainGuide'
import { villainDecor } from '../villainDecor'
import { villainAnimationList } from '../villainAnimations'
import { VILLAIN_PACKS } from '../villainPacks'
import { useFavoritesStore } from '../store/favoritesStore'
import { useStatsStore } from '../store/statsStore'
import { useIsDesktopApp } from '../store/settingsStore'
import { Scroller } from '../components/Scroller'
import { Stars, VillainDetailModal } from '../components/VillainDetailModal'
import { OptionsButton } from '../components/OptionsButton'

interface Props {
  /** Revenir au menu principal. */
  onBack: () => void
}

/**
 * Liste des vilains disponibles : pour chacun, son portrait, son nom et sa
 * difficulté. Cliquer sur un vilain ouvre sa fiche détaillée (objectif,
 * histoire, conseils pour le jouer / le contrer).
 *
 * Une barre latérale gauche permet de filtrer (recherche par nom, difficulté,
 * origine Disney/Collaborations) et de trier (par sortie, difficulté ou nom).
 */
type Origin = 'Disney' | 'Collaborations'

/** Catégories de vilains, dans leur ordre de SORTIE (les collaborations en dernier). */
const CATEGORIES: { title: Origin; villains: VillainKey[] }[] = [
  { title: 'Disney', villains: ['princeJohn', 'maleficent', 'jafar', 'reineCoeur', 'crochet', 'ursula', 'hades', 'facilier', 'mechanteReine', 'scar', 'yzma', 'ratigan', 'patHibulaire', 'gothel', 'cruella', 'gaston', 'madameTremaine', 'seigneurTenebres', 'madameMim', 'syndrome', 'lotso', 'oogieBoogie', 'saSucrerie', 'shereKhan', 'davyJones', 'tamatoa'] },
  { title: 'Collaborations', villains: ['slenderman', 'imposteur', 'teamRocket', 'bowser', 'sombra', 'seigneurCles', 'dio'] },
]

interface VillainMeta {
  key: VillainKey
  name: string
  difficulty: number
  origin: Origin
  /** Rang de sortie (ordre aplati des catégories : Disney puis Collaborations). */
  release: number
  /** A un décor d'arrière-plan permanent animé (dév). */
  hasDecor: boolean
  /** A au moins une animation de décor temporaire (dév). */
  hasAnim: boolean
}

/** Liste plate de tous les vilains avec leurs métadonnées (construite une fois). */
const ALL_VILLAINS: VillainMeta[] = CATEGORIES.flatMap((cat) =>
  cat.villains.map((key) => ({
    key,
    name: VILLAIN_REGISTRY[key].def.name,
    difficulty: VILLAIN_GUIDE[key].difficulty,
    origin: cat.title,
    hasDecor: villainDecor(key) !== undefined,
    hasAnim: villainAnimationList(key).length > 0,
  })),
).map((v, i) => ({ ...v, release: i }))

/** Vilain « à venir » : membre d'un pack non encore développé (nom seul). */
interface UpcomingMeta {
  name: string
  origin: Origin
  /** Rang de tri : placés APRÈS tous les vilains réels (par ordre de pack). */
  release: number
  /** Portrait éventuel (affiché en noir & blanc sur la carte « à venir »). */
  image?: string
}

/** Portraits des vilains « à venir » qui en ont un (clé = nom exact). */
const UPCOMING_IMAGES: Record<string, string> = {
  'Davy Jones': '/upcoming/davy-jones.png',
  Tamatoa: '/upcoming/tamatoa.png',
  'Sa Sucrerie': '/upcoming/sa-sucrerie.png',
  'Shere Khan': '/upcoming/shere-khan.png',
  Tabbou: '/upcoming/tabbou.jpg',
  'Team Rocket': '/upcoming/team-rocket.png',
}
/** Vilains de COLLABORATION à venir (hors packs officiels, pas encore développés). */
const UPCOMING_COLLAB: string[] = [
  'Grand Councilwoman',
  'La bonne fée',
  'Tabbou',
  'Flagelleur Mental',
  'Malédiction des Madrigal',
  'Pyramid Head',
  'Les Hommes du Pilier',
]

/** Vilains DISNEY à venir hors packs déjà listés. */
const UPCOMING_DISNEY: string[] = [
  'Les sœurs Sanderson',
  'Prince Hans',
  'Ernesto de la Cruz',
]

const UPCOMING: UpcomingMeta[] = [
  // Membres de packs officiels non encore développés.
  ...VILLAIN_PACKS.flatMap((pack, pi) =>
    (pack.otherMembers ?? []).map((name) => ({ name, origin: 'Disney' as Origin, release: 1000 + pi, image: UPCOMING_IMAGES[name] })),
  ),
  // Autres vilains Disney à venir.
  ...UPCOMING_DISNEY.map((name, i) => ({ name, origin: 'Disney' as Origin, release: 1500 + i, image: UPCOMING_IMAGES[name] })),
  // Collaborations à venir.
  ...UPCOMING_COLLAB.map((name, i) => ({ name, origin: 'Collaborations' as Origin, release: 2000 + i, image: UPCOMING_IMAGES[name] })),
]

/** Élément de grille : un vilain réel (cliquable) ou un placeholder « à venir ». */
type GridItem =
  | { kind: 'villain'; name: string; origin: Origin; release: number; difficulty: number; meta: VillainMeta }
  | { kind: 'upcoming'; name: string; origin: Origin; release: number; difficulty: number; image?: string }

const DIFFICULTIES = [1, 2, 3, 4, 5]
const ORIGINS: Origin[] = ['Disney', 'Collaborations']
/** Libellé affiché par origine (la clé `Origin` reste interne au filtre/données). */
const ORIGIN_LABELS: Record<Origin, string> = {
  Disney: 'Disney / Pixar',
  Collaborations: 'Collaborations',
}
type SortKey = 'release' | 'difficulty' | 'name'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'release', label: 'Sortie' },
  { key: 'difficulty', label: 'Difficulté' },
  { key: 'name', label: 'Nom' },
]

/** Filtre par statut « déjà joué » (d'après l'historique de stats). */
type PlayedFilter = 'all' | 'played' | 'never'
const PLAYED_OPTIONS: { key: PlayedFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'played', label: 'Joués' },
  { key: 'never', label: 'Jamais' },
]

/** Ajoute/retire une valeur d'un Set (renvoie un nouveau Set). */
function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** Filtre développeur tri-état par fonctionnalité. */
type DevFilter = 'all' | 'yes' | 'no'
const DEV_FILTER_OPTIONS: { value: DevFilter; label: string }[] = [
  { value: 'all', label: 'Les deux' },
  { value: 'yes', label: 'Oui' },
  { value: 'no', label: 'Non' },
]
/** Vrai si le vilain passe le filtre tri-état (a la fonctionnalité ou non). */
function matchesDevFilter(filter: DevFilter, has: boolean): boolean {
  return filter === 'all' || (filter === 'yes') === has
}

/** Réglage persistant du nombre de vilains par ligne (2–8). */
const COLUMNS_LS_KEY = 'villainous:villainList:columns'
const COLUMNS_MIN = 2
const COLUMNS_MAX = 8
const COLUMNS_DEFAULT = 5
function readColumns(): number {
  if (typeof localStorage === 'undefined') return COLUMNS_DEFAULT
  const n = Number(localStorage.getItem(COLUMNS_LS_KEY))
  return Number.isInteger(n) && n >= COLUMNS_MIN && n <= COLUMNS_MAX ? n : COLUMNS_DEFAULT
}
function persistColumns(n: number) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COLUMNS_LS_KEY, String(n))
  } catch {
    /* ignore */
  }
}

export function VillainList({ onBack }: Props) {
  const [selected, setSelected] = useState<VillainKey | null>(null)
  const [query, setQuery] = useState('')
  const [difficulties, setDifficulties] = useState<Set<number>>(new Set())
  const [origins, setOrigins] = useState<Set<Origin>>(new Set())
  const [sort, setSort] = useState<SortKey>('release')
  // Volet des filtres ouvert/fermé.
  const [filtersOpen, setFiltersOpen] = useState(true)
  // Nombre de vilains par ligne (curseur d'affichage, persisté).
  const [columns, setColumns] = useState(readColumns)
  const changeColumns = (n: number) => {
    setColumns(n)
    persistColumns(n)
  }
  // Filtres « collection » (joueur) : favoris + statut déjà joué.
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [playedFilter, setPlayedFilter] = useState<PlayedFilter>('all')
  // « À venir » : afficher aussi les vilains de packs non encore développés (placeholders).
  const [showUpcoming, setShowUpcoming] = useState(false)
  const favorites = useFavoritesStore((s) => s.favorites)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const stats = useStatsStore((s) => s.stats)
  const favSet = useMemo(() => new Set(favorites), [favorites])
  const isDesktopApp = useIsDesktopApp()
  // Filtres « Développeur » (masqués en exe) : tri-état par fonctionnalité —
  // 'all' (les deux), 'yes' (a la fonctionnalité), 'no' (ne l'a pas).
  const [decorFilter, setDecorFilter] = useState<DevFilter>('all')
  const [animFilter, setAnimFilter] = useState<DevFilter>('all')

  // Liste filtrée puis triée selon les réglages de la barre latérale.
  const villains = useMemo<GridItem[]>(() => {
    const q = query.trim().toLowerCase()
    const isPlayed = (key: VillainKey) => {
      const st = stats[key]
      return !!st && st.wins + st.losses > 0
    }
    const real: GridItem[] = ALL_VILLAINS.filter(
      (v) =>
        (q === '' || v.name.toLowerCase().includes(q)) &&
        (difficulties.size === 0 || difficulties.has(v.difficulty)) &&
        (origins.size === 0 || origins.has(v.origin)) &&
        (!onlyFavorites || favSet.has(v.key)) &&
        (playedFilter === 'all' || (playedFilter === 'played') === isPlayed(v.key)) &&
        matchesDevFilter(decorFilter, v.hasDecor) &&
        matchesDevFilter(animFilter, v.hasAnim),
    ).map((v) => ({ kind: 'villain', name: v.name, origin: v.origin, release: v.release, difficulty: v.difficulty, meta: v }))
    // « À venir » : vilains de packs non développés (filtrés seulement par recherche + origine).
    const upcoming: GridItem[] = showUpcoming
      ? UPCOMING.filter(
          (u) => (q === '' || u.name.toLowerCase().includes(q)) && (origins.size === 0 || origins.has(u.origin)),
        ).map((u) => ({ kind: 'upcoming', name: u.name, origin: u.origin, release: u.release, difficulty: Infinity, image: u.image }))
      : []
    return [...real, ...upcoming].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr')
      if (sort === 'difficulty') return a.difficulty - b.difficulty || a.release - b.release
      return a.release - b.release
    })
  }, [query, difficulties, origins, sort, onlyFavorites, playedFilter, favSet, stats, decorFilter, animFilter, showUpcoming])

  const hasFilters =
    query.trim() !== '' ||
    difficulties.size > 0 ||
    origins.size > 0 ||
    onlyFavorites ||
    playedFilter !== 'all' ||
    showUpcoming ||
    decorFilter !== 'all' ||
    animFilter !== 'all'
  const resetFilters = () => {
    setQuery('')
    setDifficulties(new Set())
    setOrigins(new Set())
    setOnlyFavorites(false)
    setPlayedFilter('all')
    setShowUpcoming(false)
    setDecorFilter('all')
    setAnimFilter('all')
  }

  // Carte d'un élément de grille : vilain réel (cliquable) ou placeholder « à venir »
  // (icône chantier, sans difficulté ni favori, non cliquable → pas de modal).
  const renderCard = (item: GridItem) => {
    if (item.kind === 'upcoming') {
      return (
        <div
          key={`up:${item.name}`}
          className="relative flex flex-col gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3 opacity-75"
        >
          {item.image ? (
            // Portrait en noir & blanc (le vilain n'est pas encore développé).
            <img
              src={item.image}
              alt={item.name}
              className="aspect-square w-full rounded-lg border border-white/10 object-cover grayscale"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-white/10 bg-black/30 text-5xl">
              🚧
            </div>
          )}
          <h3 className="text-base font-bold text-white/60">{item.name}</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/60">🚧 À venir</span>
        </div>
      )
    }
    const v = item.meta
    return (
      <button
        key={v.key}
        type="button"
        onClick={(e) => { e.stopPropagation(); playHeroSelect(); setSelected(v.key) }}
        onMouseEnter={playHeroHover}
        className={`relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40 ${
          v.origin === 'Collaborations'
            ? 'border-sky-300/25 bg-sky-400/10 hover:border-sky-300/60 hover:bg-sky-400/20'
            : 'border-white/10 bg-white/5 hover:border-white/40 hover:bg-white/10'
        }`}
      >
        {/* Cœur favori : <span> cliquable (pas un <button> imbriqué) ; stopPropagation
            pour ne pas ouvrir la fiche. */}
        <span
          role="button"
          aria-label={favSet.has(v.key) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(v.key) }}
          className={`absolute bottom-2 right-2 z-10 cursor-pointer rounded-full px-1.5 text-3xl leading-none drop-shadow ${
            favSet.has(v.key) ? 'text-rose-500' : 'text-white/50 hover:text-rose-400'
          }`}
        >
          {favSet.has(v.key) ? '♥' : '♡'}
        </span>
        <img
          src={villainPortrait(v.key)}
          alt={v.name}
          className="aspect-square w-full rounded-lg border border-white/15 object-cover"
        />
        <h3 className="text-base font-bold text-amber-200">{v.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Difficulté
          </span>
          {/* Cartes étroites (7–8 colonnes) : nombre + 1 étoile au lieu des 5. */}
          {columns >= 7 ? (
            <span
              className="text-sm font-bold leading-none text-amber-400"
              title={`Difficulté ${v.difficulty}/5`}
            >
              {v.difficulty}★
            </span>
          ) : (
            <Stars value={v.difficulty} />
          )}
        </div>
      </button>
    )
  }

  // Grille de cartes pour une liste donnée (colonnes pilotées par le curseur).
  const grid = (list: GridItem[]) => (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {list.map(renderCard)}
    </div>
  )

  return (
    <div className="relative flex h-screen flex-col bg-[#0b0a12] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Ouvre/ferme le volet des filtres. */}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            onMouseEnter={playHover}
            title={filtersOpen ? 'Masquer les filtres' : 'Afficher les filtres'}
            aria-expanded={filtersOpen}
            className={`hidden rounded-lg border px-3 py-1.5 text-sm transition md:block ${
              filtersOpen
                ? 'border-amber-300/50 bg-amber-400/15 text-amber-200'
                : 'border-white/20 text-white/80 hover:bg-white/10'
            }`}
          >
            ☰ Filtres
          </button>
          <h1 className="text-lg font-bold text-purple-200">Liste des villains</h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          onMouseEnter={playHover}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Barre latérale repliable (bouton « ☰ Filtres ») : l'enveloppe anime sa LARGEUR
            (w-64 ↔ 0) en `overflow-hidden`, le contenu interne reste à largeur fixe pour ne
            pas se déformer pendant la transition. */}
        <div
          className={`hidden shrink-0 overflow-hidden border-white/10 transition-[width,border] duration-300 ease-in-out md:block ${
            filtersOpen ? 'w-64 border-r' : 'w-0 border-r-0'
          }`}
        >
        <aside className="flex h-full w-64 flex-col gap-6 overflow-y-auto p-4">
          {/* Affichage : nombre de vilains par ligne. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300/70">
                Par ligne
              </span>
              <span className="text-sm font-semibold text-amber-200">{columns}</span>
            </div>
            <input
              type="range"
              min={COLUMNS_MIN}
              max={COLUMNS_MAX}
              step={1}
              value={columns}
              onChange={(e) => changeColumns(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          {/* Recherche par nom. */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300/70">
              Recherche
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom du vilain…"
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/50 focus:outline-none"
            />
          </div>

          {/* Filtre par difficulté (multi-sélection ; aucune = toutes). */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300/70">
              Difficulté
            </span>
            <div className="flex gap-1">
              {DIFFICULTIES.map((d) => {
                const active = difficulties.has(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulties((p) => toggleInSet(p, d))}
                    onMouseEnter={playHover}
                    className={`flex-1 rounded-lg border px-0 py-1 text-center text-sm font-semibold transition ${
                      active
                        ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                        : 'border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {d}★
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filtre par origine (Disney / Collaborations). */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300/70">
              Origine
            </span>
            <div className="flex flex-col gap-1.5">
              {ORIGINS.map((o) => {
                const active = origins.has(o)
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOrigins((p) => toggleInSet(p, o))}
                    onMouseEnter={playHover}
                    className={`rounded-lg border px-3 py-1.5 text-left text-sm transition ${
                      active
                        ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                        : 'border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {ORIGIN_LABELS[o]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tri (sélection unique). */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300/70">
              Trier par
            </span>
            <div className="flex flex-col gap-1.5">
              {SORTS.map((s) => {
                const active = sort === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    onMouseEnter={playHover}
                    className={`rounded-lg border px-3 py-1.5 text-left text-sm transition ${
                      active
                        ? 'border-purple-300/60 bg-purple-400/20 text-purple-100'
                        : 'border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ma collection : favoris + statut « déjà joué » (d'après l'historique). */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300/70">
              Ma collection
            </span>
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              onMouseEnter={playHover}
              className={`rounded-lg border px-3 py-1.5 text-left text-sm transition ${
                onlyFavorites
                  ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                  : 'border-white/15 text-white/70 hover:bg-white/10'
              }`}
            >
              <span className={onlyFavorites ? 'text-rose-400' : 'text-rose-400/70'}>
                {onlyFavorites ? '♥' : '♡'}
              </span>{' '}
              Favoris uniquement
            </button>
            <div className="flex gap-1">
              {PLAYED_OPTIONS.map((o) => {
                const active = playedFilter === o.key
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setPlayedFilter(o.key)}
                    onMouseEnter={playHover}
                    className={`flex-1 rounded-lg border px-0 py-1 text-center text-sm transition ${
                      active
                        ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                        : 'border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* À venir : afficher aussi les vilains de packs non encore développés (placeholders). */}
          <button
            type="button"
            onClick={() => setShowUpcoming((v) => !v)}
            onMouseEnter={playHover}
            aria-pressed={showUpcoming}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-sm transition ${
              showUpcoming
                ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                : 'border-white/15 text-white/70 hover:bg-white/10'
            }`}
          >
            <span>🚧 Vilains à venir</span>
            <span className={`text-xs ${showUpcoming ? 'text-amber-200/80' : 'text-white/40'}`}>
              {showUpcoming ? 'affichés' : 'masqués'}
            </span>
          </button>

          {/* Section Développeur : suivi du contenu visuel, masquée dans l'exe (joueurs). */}
          {!isDesktopApp && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-white/15 p-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-300/70">
                Développeur
              </span>
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Arrière-plan animé
                <select
                  value={decorFilter}
                  onChange={(e) => setDecorFilter(e.target.value as DevFilter)}
                  className="rounded-lg border border-white/15 bg-black px-2 py-1 text-sm text-white focus:border-emerald-300/50 focus:outline-none"
                >
                  {DEV_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-black text-white">{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Animation temporaire
                <select
                  value={animFilter}
                  onChange={(e) => setAnimFilter(e.target.value as DevFilter)}
                  className="rounded-lg border border-white/15 bg-black px-2 py-1 text-sm text-white focus:border-emerald-300/50 focus:outline-none"
                >
                  {DEV_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-black text-white">{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              onMouseEnter={playHover}
              className="mt-auto rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
            >
              Réinitialiser les filtres
            </button>
          )}
        </aside>
        </div>

        {/* Grille des vilains (filtrée + triée). */}
        <Scroller element="main" className="min-h-0 flex-1 p-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <p className="text-xs text-white/40">
              {villains.length} vilain{villains.length > 1 ? 's' : ''}
            </p>
            {villains.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/40">Aucun vilain ne correspond aux filtres.</p>
            ) : sort === 'release' ? (
              // Tri « Sortie » : on sépare en sections par origine (Disney/Pixar puis Collaborations).
              ORIGINS.map((o) => {
                const list = villains.filter((v) => v.origin === o)
                if (list.length === 0) return null
                return (
                  <section key={o}>
                    <h2 className="mb-3 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-300/80">
                      {ORIGIN_LABELS[o]}
                      <span className="h-px flex-1 bg-white/10" />
                    </h2>
                    {grid(list)}
                  </section>
                )
              })
            ) : (
              grid(villains)
            )}
          </div>
        </Scroller>
      </div>

      {selected && (
        <VillainDetailModal villain={selected} onClose={() => setSelected(null)} />
      )}

      <OptionsButton />
    </div>
  )
}
