import { useEffect, useMemo, useState } from 'react'
import { VILLAIN_REGISTRY, COLLAB_VILLAINS, MARVEL_VILLAINS, UNRELEASED_VILLAINS, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { villainPortrait } from '../villainArt'
import { playHeroHover, playHover, playHeroSelect } from '../sfx'
import { VILLAIN_GUIDE } from '../villainGuide'
import { villainDecor } from '../villainDecor'
import { villainAnimationList } from '../villainAnimations'
import { villainHasSurprise } from '../surpriseBus'
import { villainCreator } from '../villainPacks'
import { useFavoritesStore } from '../store/favoritesStore'
import { useVillainOrderStore, orderRank } from '../store/villainOrderStore'
import { DISNEY_RELEASE_ORDER, CREATOR_ORDER, VILLAIN_ORIGINS, ORIGIN_LABELS } from '../villainOrder'
import type { VillainOrigin } from '../../data/customVillain'
import { useStatsStore } from '../store/statsStore'
import { useIsDesktopApp } from '../store/settingsStore'
import { Scroller } from '../components/Scroller'
import { Stars, VillainDetailModal } from '../components/VillainDetailModal'
import { OptionsButton } from '../components/OptionsButton'
import { SplitPortrait } from '../components/SplitPortrait'

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
/** Alias local de la taxonomie partagée (cf. `villainOrder.ts`). */
type Origin = VillainOrigin

/** Catégories de vilains, dans leur ordre de SORTIE (les collaborations en dernier).
 *  L'ordre vient de la source de vérité partagée `villainOrder.ts`. */
const CATEGORIES: { title: Origin; villains: VillainKey[] }[] = [
  { title: 'Disney', villains: DISNEY_RELEASE_ORDER },
  { title: 'Marvel', villains: MARVEL_VILLAINS },
  { title: 'Collaborations', villains: COLLAB_VILLAINS },
]

interface VillainMeta {
  /** Clé du vilain : native (VillainKey) ou publiée (id `custom-…`). */
  key: string
  name: string
  difficulty: number
  origin: Origin
  /** Créateur (collaborations) : sépare les sous-sections « Jules » / « Alexis »… */
  creator?: string
  /** Rang de sortie (ordre aplati des catégories : Disney puis Collaborations). */
  release: number
  /** A un décor d'arrière-plan permanent animé (dév). */
  hasDecor: boolean
  /** A au moins une animation de décor de passage (dév). */
  hasAnim: boolean
  /** A une surprise de décor déclenchable (dév). */
  hasSurprise: boolean
  /** Variantes LIÉES (skins) publiées regroupées sous CETTE carte (représentant inclus, en
   *  1ᵉʳ). Défini seulement quand le groupe compte ≥ 2 membres (ex. Sumbra / Kilaire) : un
   *  clic ouvre alors un sélecteur « quelle version ? » avant la fiche. */
  variantKeys?: string[]
}

/** Liste plate de tous les vilains avec leurs métadonnées (construite une fois). */
const ALL_VILLAINS: VillainMeta[] = CATEGORIES.flatMap((cat) =>
  cat.villains.map((key) => ({
    key,
    name: VILLAIN_REGISTRY[key].def.name,
    difficulty: VILLAIN_GUIDE[key].difficulty,
    origin: cat.title,
    creator: villainCreator(key),
    hasDecor: villainDecor(key) !== undefined,
    hasAnim: villainAnimationList(key).length > 0,
    hasSurprise: villainHasSurprise(key),
  })),
).map((v, i) => ({ ...v, release: i }))

/** Élément de grille : un vilain (cliquable). */
type GridItem = { kind: 'villain'; name: string; origin: Origin; release: number; difficulty: number; meta: VillainMeta }

const DIFFICULTIES = [1, 2, 3, 4, 5]
const ORIGINS = VILLAIN_ORIGINS
/** Sous-sections de Collaborations par créateur, dans l'ordre d'affichage souhaité
 *  (`CREATOR_ORDER` partagé). Les créateurs hors liste suivent (ordre alpha) ; les
 *  vilains sans créateur vont dans « Autres ». */
const NO_CREATOR_LABEL = 'Autres'

/** Clé de groupe d'un vilain pour le réordonnage : par origine, et par créateur au
 *  sein des Collaborations (un vilain reste dans la sous-section de son créateur). */
function groupKeyOf(meta: VillainMeta): string {
  return meta.origin === 'Collaborations' ? `collab:${meta.creator ?? NO_CREATOR_LABEL}` : meta.origin
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
  const [selected, setSelected] = useState<string | null>(null)
  // Sélecteur « quelle version ? » ouvert pour une carte fusionnée (variantes liées) : liste
  // des clés du groupe ; choisir une version ouvre sa fiche (process normal).
  const [variantChoice, setVariantChoice] = useState<string[] | null>(null)
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
  const favorites = useFavoritesStore((s) => s.favorites)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  // Ordre personnalisé des vilains (persistant) + mode « Modifier l'ordre ».
  const customOrder = useVillainOrderStore((s) => s.order)
  const setOrder = useVillainOrderStore((s) => s.setOrder)
  const resetOrder = useVillainOrderStore((s) => s.reset)
  const [reorderModeRaw, setReorderModeRaw] = useState(false)
  // Vilain en cours de glisser-déposer (clé) et point d'insertion survolé (cible +
  // côté), pour afficher une barre d'insertion plutôt qu'un surlignage de remplacement.
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [dropSide, setDropSide] = useState<'before' | 'after'>('before')
  const stats = useStatsStore((s) => s.stats)
  const favSet = useMemo(() => new Set(favorites), [favorites])
  const isDesktopApp = useIsDesktopApp()
  // La réorganisation est un outil de dév : neutralisée en mode application (exe réelle
  // ou simulation). On DÉRIVE l'état effectif plutôt que de le synchroniser — ainsi tout
  // le rendu (boutons, glisser-déposer, encadré) redevient inerte dès qu'on simule l'exe.
  const reorderMode = reorderModeRaw && !isDesktopApp
  // Filtres « Développeur » (masqués en exe) : tri-état par fonctionnalité —
  // 'all' (les deux), 'yes' (a la fonctionnalité), 'no' (ne l'a pas).
  const [decorFilter, setDecorFilter] = useState<DevFilter>('all')
  const [animFilter, setAnimFilter] = useState<DevFilter>('all')
  const [surpriseFilter, setSurpriseFilter] = useState<DevFilter>('all')

  // Vilains PUBLIÉS (« Terminés » dans l'Atelier) : ils rejoignent la galerie comme
  // n'importe quel vilain. Placés en fin de leur section d'origine (release élevé).
  const customLoaded = useCustomVillainStore((s) => s.loaded)
  const loadCustom = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => { if (!customLoaded) void loadCustom() }, [customLoaded, loadCustom])
  const publishedMetas = useMemo<VillainMeta[]>(() => {
    const published = customVillains.filter((v) => v.published)
    // Regroupe les variantes LIÉES (skins : même contenu, présentation différente — ex. Sumbra
    // ⟷ Kilaire) sous UNE seule carte. La racine d'un groupe = `variantOf` (la base) ou l'id lui-même.
    const groups = new Map<string, typeof published>()
    for (const v of published) {
      const root = v.variantOf ?? v.id
      const arr = groups.get(root) ?? []
      arr.push(v)
      groups.set(root, arr)
    }
    const metas: VillainMeta[] = []
    let i = 0
    for (const [root, members] of groups) {
      // Représentant = la BASE (id === racine) si elle est publiée, sinon le 1ᵉʳ membre publié.
      const ordered = [...members].sort((a, b) => (a.id === root ? -1 : b.id === root ? 1 : 0))
      const rep = ordered[0]
      const merged = ordered.length > 1
      metas.push({
        key: rep.id,
        // Carte fusionnée : nom combiné (« Sumbra / Kilaire ») ; sinon le nom seul.
        name: merged ? ordered.map((m) => m.name).join(' / ') : rep.name,
        difficulty: rep.stars,
        origin: rep.origin ?? 'Collaborations',
        creator: rep.creator,
        release: 10000 + i++,
        hasDecor: false,
        hasAnim: false,
        hasSurprise: false,
        variantKeys: merged ? ordered.map((m) => m.id) : undefined,
      })
    }
    return metas
  }, [customVillains])

  // Liste filtrée puis triée selon les réglages de la barre latérale.
  const villains = useMemo<GridItem[]>(() => {
    const q = query.trim().toLowerCase()
    const isPlayed = (key: string) => {
      const st = stats[key as VillainKey]
      return !!st && st.wins + st.losses > 0
    }
    const real: GridItem[] = [...ALL_VILLAINS, ...publishedMetas].filter(
      (v) =>
        // Vilains non encore publiés : masqués aux joueurs (mais visibles en dév).
        !(isDesktopApp && (UNRELEASED_VILLAINS as string[]).includes(v.key)) &&
        (q === '' || v.name.toLowerCase().includes(q)) &&
        (difficulties.size === 0 || difficulties.has(v.difficulty)) &&
        (origins.size === 0 || origins.has(v.origin)) &&
        (!onlyFavorites || favSet.has(v.key)) &&
        (playedFilter === 'all' || (playedFilter === 'played') === isPlayed(v.key)) &&
        matchesDevFilter(decorFilter, v.hasDecor) &&
        matchesDevFilter(animFilter, v.hasAnim) &&
        matchesDevFilter(surpriseFilter, v.hasSurprise),
    ).map((v) => ({ kind: 'villain', name: v.name, origin: v.origin, release: v.release, difficulty: v.difficulty, meta: v }))
    const rank = orderRank(customOrder)
    const keyOf = (it: GridItem) => it.meta.key
    return [...real].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr')
      if (sort === 'difficulty') return a.difficulty - b.difficulty || a.release - b.release
      // « Sortie » : ordre personnalisé d'abord (vilains réordonnés à la main),
      // puis ordre de sortie pour les vilains non encore placés.
      return rank(keyOf(a)) - rank(keyOf(b)) || a.release - b.release
    })
  }, [query, difficulties, origins, sort, onlyFavorites, playedFilter, favSet, stats, decorFilter, animFilter, surpriseFilter, publishedMetas, customOrder, isDesktopApp])

  const hasFilters =
    query.trim() !== '' ||
    difficulties.size > 0 ||
    origins.size > 0 ||
    onlyFavorites ||
    playedFilter !== 'all' ||
    decorFilter !== 'all' ||
    animFilter !== 'all' ||
    surpriseFilter !== 'all'
  const resetFilters = () => {
    setQuery('')
    setDifficulties(new Set())
    setOrigins(new Set())
    setOnlyFavorites(false)
    setPlayedFilter('all')
    setDecorFilter('all')
    setAnimFilter('all')
    setSurpriseFilter('all')
  }

  // Entrer/sortir du mode « Modifier l'ordre des villains » : on remet le tri sur
  // « Sortie » (sections) et on efface les filtres pour réordonner sur la vraie galerie.
  const enterReorder = () => {
    resetFilters()
    setSort('release')
    setReorderModeRaw(true)
  }
  const exitReorder = () => {
    setReorderModeRaw(false)
    setDragKey(null)
    setDragOverKey(null)
  }

  // Glisser-déposer : insère le vilain `from` avant ou après le vilain `to` — uniquement
  // au sein du MÊME groupe (origine, et créateur pour les Collaborations), pour conserver
  // les sections (Disney/Pixar · Collaborations) et leurs sous-sections par créateur.
  // Reconstruit l'ordre complet des vilains réels (ordre d'affichage courant) et le persiste.
  const moveVillain = (from: string, to: string, side: 'before' | 'after') => {
    if (from === to) return
    const realItems = villains.filter((v): v is Extract<GridItem, { kind: 'villain' }> => v.kind === 'villain')
    const fromItem = realItems.find((v) => v.meta.key === from)
    const toItem = realItems.find((v) => v.meta.key === to)
    if (!fromItem || !toItem || groupKeyOf(fromItem.meta) !== groupKeyOf(toItem.meta)) return
    const keys = realItems.map((v) => v.meta.key)
    keys.splice(keys.indexOf(from), 1)
    const toIdx = keys.indexOf(to)
    keys.splice(side === 'after' ? toIdx + 1 : toIdx, 0, from)
    setOrder(keys)
  }

  // Place le vilain `from` en DERNIER d'un groupe (liste affichée d'une sous-section) —
  // via la zone de dépôt en fin de grille.
  const dropAtEnd = (from: string, list: GridItem[]) => {
    const last = list
      .filter((v): v is Extract<GridItem, { kind: 'villain' }> => v.kind === 'villain' && v.meta.key !== from)
      .at(-1)
    if (last) moveVillain(from, last.meta.key, 'after')
  }

  // Carte d'un élément de grille : un vilain (cliquable → fiche détaillée).
  const renderCard = (item: GridItem) => {
    const v = item.meta
    // Mode réorganisation : la carte devient une poignée de glisser-déposer (pas de
    // clic vers la fiche, pas de favori). Retour visuel : carte saisie estompée, cible
    // survolée surlignée en vert.
    const isDragging = reorderMode && dragKey === v.key
    const showInsert = reorderMode && dragOverKey === v.key && dragKey !== null && dragKey !== v.key
    return (
      <button
        key={v.key}
        type="button"
        draggable={reorderMode}
        onClick={(e) => {
          e.stopPropagation()
          if (reorderMode) return
          playHeroSelect()
          // Carte fusionnée (variantes liées) → on demande d'abord quelle version voir/jouer.
          if (v.variantKeys && v.variantKeys.length > 1) setVariantChoice(v.variantKeys)
          else setSelected(v.key)
        }}
        onMouseEnter={reorderMode ? undefined : playHeroHover}
        onDragStart={reorderMode ? () => setDragKey(v.key) : undefined}
        onDragEnd={reorderMode ? () => { setDragKey(null); setDragOverKey(null) } : undefined}
        onDragOver={reorderMode ? (e) => {
          e.preventDefault()
          // Côté d'insertion d'après la position horizontale du curseur dans la carte.
          const rect = e.currentTarget.getBoundingClientRect()
          const side: 'before' | 'after' = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
          if (dragOverKey !== v.key) setDragOverKey(v.key)
          if (dropSide !== side) setDropSide(side)
        } : undefined}
        onDrop={reorderMode ? (e) => {
          e.preventDefault()
          if (dragKey) moveVillain(dragKey, v.key, dropSide)
          setDragKey(null)
          setDragOverKey(null)
        } : undefined}
        className={`relative flex flex-col gap-2 rounded-xl border p-3 text-left transition duration-200 ${
          reorderMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:-translate-y-1 hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40'
        } ${
          v.origin === 'Collaborations'
            ? 'border-sky-300/25 bg-sky-400/10 hover:border-sky-300/60 hover:bg-sky-400/20'
            : v.origin === 'Marvel'
              ? 'border-red-400/25 bg-red-500/10 hover:border-red-400/60 hover:bg-red-500/20'
              : 'border-white/10 bg-white/5 hover:border-white/40 hover:bg-white/10'
        } ${isDragging ? 'opacity-30' : ''}`}
      >
        {/* Barre d'insertion verte : indique où le vilain glissé va se poser (avant/après
            cette carte), pour ne pas donner l'impression d'un remplacement. */}
        {showInsert && (
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-1 z-20 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)] ${
              dropSide === 'before' ? '-left-2.5' : '-right-2.5'
            }`}
          />
        )}
        {/* Cœur favori : <span> cliquable (pas un <button> imbriqué) ; stopPropagation
            pour ne pas ouvrir la fiche. Masqué en mode réorganisation. */}
        {!reorderMode && (
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
        )}
        {/* Carte fusionnée (variantes liées) : portrait combiné coupé en DIAGONALE (comme dans
            l'Atelier) — les 2 skins cohabitent, chaque moitié s'étend au survol de son côté. */}
        {v.variantKeys && v.variantKeys.length > 1 ? (
          <div className="overflow-hidden rounded-lg border border-white/15">
            <SplitPortrait
              a={{ image: villainPortrait(v.variantKeys[0]), name: v.name, color: customVillains.find((c) => c.id === v.variantKeys![0])?.color ?? '#000' }}
              b={{ image: villainPortrait(v.variantKeys[1]), name: v.name, color: customVillains.find((c) => c.id === v.variantKeys![1])?.color ?? '#000' }}
            />
          </div>
        ) : (
          <img
            src={villainPortrait(v.key)}
            alt={v.name}
            className="aspect-square w-full rounded-lg border border-white/15 object-cover"
          />
        )}
        <h3 className="text-base font-bold text-amber-200">{v.name}</h3>
        {/* Carte fusionnée (variantes liées) : badge « N versions » (skins au choix). */}
        {v.variantKeys && v.variantKeys.length > 1 && (
          <span className="w-fit rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-100">
            🎭 {v.variantKeys.length} versions
          </span>
        )}
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
  // En mode réorganisation, une zone de dépôt « fin de liste » clôt chaque (sous-)section
  // — identifiée par `groupKey` — pour pouvoir y déposer un vilain en dernier.
  const grid = (list: GridItem[], groupKey?: string) => {
    const endKey = groupKey ? `__end__:${groupKey}` : null
    const overEnd = reorderMode && endKey !== null && dragOverKey === endKey && dragKey !== null
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {list.map(renderCard)}
        {reorderMode && endKey && list.length > 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); if (dragOverKey !== endKey) setDragOverKey(endKey) }}
            onDragLeave={() => { if (dragOverKey === endKey) setDragOverKey(null) }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragKey) dropAtEnd(dragKey, list)
              setDragKey(null)
              setDragOverKey(null)
            }}
            className={`flex min-h-[8rem] items-center justify-center rounded-xl border-2 border-dashed text-center text-xs transition ${
              overEnd
                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                : 'border-white/15 text-white/40'
            }`}
          >
            Déposer ici<br />pour mettre en dernier
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-screen flex-col bg-[#0b0a12] text-white">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Ouvre/ferme le volet des filtres (masqué en mode réorganisation). */}
          {!reorderMode && (
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
          )}
          <h1 className="text-lg font-bold text-purple-200">Liste des villains</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Réorganisation (outil de dév) : masqué en exe ET quand on simule le mode
              application (`!isDesktopApp`). */}
          {!isDesktopApp && (reorderMode ? (
            <button
              type="button"
              onClick={exitReorder}
              onMouseEnter={playHover}
              className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              ✓ Enregistrer
            </button>
          ) : (
            <button
              type="button"
              onClick={enterReorder}
              onMouseEnter={playHover}
              title="Modifier l'ordre des villains"
              className="group flex items-center rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              <span className="text-base leading-none">↕</span>
              <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-[16rem] group-hover:opacity-100">
                Modifier l'ordre des villains
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={onBack}
            onMouseEnter={playHover}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ← Menu
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Barre latérale repliable (bouton « ☰ Filtres ») : l'enveloppe anime sa LARGEUR
            (w-64 ↔ 0) en `overflow-hidden`, le contenu interne reste à largeur fixe pour ne
            pas se déformer pendant la transition. Masquée en mode réorganisation. */}
        {!reorderMode && (
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
                Animation de passage
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
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Animation surprise
                <select
                  value={surpriseFilter}
                  onChange={(e) => setSurpriseFilter(e.target.value as DevFilter)}
                  className="rounded-lg border border-white/15 bg-black px-2 py-1 text-sm text-white focus:border-emerald-300/50 focus:outline-none"
                >
                  {DEV_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-black text-white">{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Compteur de vilains (résultat des filtres) — mis en valeur. */}
          <div className="flex items-center gap-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2">
            <span className="text-3xl font-extrabold leading-none text-amber-300 tabular-nums">
              {villains.length}
            </span>
            <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.15em] text-amber-200/80">
              vilain{villains.length > 1 ? 's' : ''}
              <br />
              affiché{villains.length > 1 ? 's' : ''}
            </span>
          </div>

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
        )}

        {/* Grille des vilains (filtrée + triée). */}
        <Scroller element="main" className="min-h-0 flex-1 p-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            {/* Encadré vert du mode « Modifier l'ordre des villains ». */}
            {reorderMode && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-emerald-200">↕ Modifier l'ordre des villains</span>
                  <span className="text-xs text-emerald-100/70">
                    Glisse un vilain avec la souris pour le déposer à côté d'un autre. Le réordonnage
                    se fait à l'intérieur de chaque section (Disney / Pixar · Collaborations) et,
                    pour les Collaborations, de chaque sous-section de créateur (Jules / Alexis).
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetOrder}
                    onMouseEnter={playHover}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    Réinitialiser l'ordre
                  </button>
                  <button
                    type="button"
                    onClick={exitReorder}
                    onMouseEnter={playHover}
                    className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                  >
                    ✓ Enregistrer
                  </button>
                </div>
              </div>
            )}
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
                    {o === 'Collaborations' ? (
                      // Collaborations : sous-sections par CRÉATEUR (Jules / Alexis…),
                      // les vilains rangés selon leur créateur.
                      (() => {
                        const byCreator = new Map<string, GridItem[]>()
                        for (const v of list) {
                          const c = (v.kind === 'villain' ? v.meta.creator : undefined) ?? NO_CREATOR_LABEL
                          const arr = byCreator.get(c) ?? []
                          arr.push(v)
                          byCreator.set(c, arr)
                        }
                        const creators = [
                          ...CREATOR_ORDER.filter((c) => byCreator.has(c)),
                          ...[...byCreator.keys()]
                            .filter((c) => !CREATOR_ORDER.includes(c))
                            .sort((a, b) => a.localeCompare(b, 'fr')),
                        ]
                        return (
                          <div className="flex flex-col gap-5">
                            {creators.map((c) => (
                              <div key={c}>
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-sky-300/80">
                                  {c}
                                </h3>
                                {grid(byCreator.get(c)!, `collab:${c}`)}
                              </div>
                            ))}
                          </div>
                        )
                      })()
                    ) : (
                      grid(list, o)
                    )}
                  </section>
                )
              })
            ) : (
              grid(villains)
            )}
          </div>
        </Scroller>
      </div>

      {/* Sélecteur « quelle version ? » : variantes liées d'une carte fusionnée. Choisir une
          version ouvre sa fiche détaillée (puis « Jouer » → process normal). */}
      {variantChoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVariantChoice(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#141020] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-center text-lg font-bold text-amber-200">Quelle version ?</h2>
            <p className="mb-4 text-center text-xs text-white/60">
              Ces vilains partagent les mêmes règles — seule la présentation change.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {variantChoice.map((k) => {
                const cv = customVillains.find((x) => x.id === k)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { playHeroSelect(); setVariantChoice(null); setSelected(k) }}
                    onMouseEnter={playHeroHover}
                    className="flex flex-col items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-white/10"
                  >
                    <img
                      src={villainPortrait(k)}
                      alt={cv?.name ?? k}
                      className="aspect-square w-full rounded-lg border border-white/15 object-cover"
                    />
                    <span className="text-sm font-bold text-amber-200">{cv?.name ?? k}</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setVariantChoice(null)}
              onMouseEnter={playHover}
              className="mt-4 w-full rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {selected && (() => {
        // Navigation précédent/suivant entre fiches : on parcourt les vilains RÉELS
        // dans l'ordre d'affichage courant (filtres + tri). Aux extrémités, la flèche
        // correspondante est absente (pas de bouclage).
        const navKeys = villains
          .filter((v): v is Extract<GridItem, { kind: 'villain' }> => v.kind === 'villain')
          .map((v) => v.meta.key)
        const idx = navKeys.indexOf(selected)
        const goTo = (i: number) => { playHeroSelect(); setSelected(navKeys[i]) }
        return (
          <VillainDetailModal
            villain={selected}
            onClose={() => setSelected(null)}
            onPrev={idx > 0 ? () => goTo(idx - 1) : undefined}
            onNext={idx >= 0 && idx < navKeys.length - 1 ? () => goTo(idx + 1) : undefined}
          />
        )
      })()}

      <OptionsButton />
    </div>
  )
}
