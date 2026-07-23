import { useEffect, useMemo, useRef, useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { villainPortrait } from '../villainArt'
import { VILLAIN_COLOR, DEFAULT_TINT_A } from '../villainColors'
import { byRelease } from '../villainOrder'
import { plural } from '../../engine/plural'
import { Scroller } from '../components/Scroller'

interface Props {
  /** Revenir au menu principal. */
  onBack: () => void
}

// --- Modèle de données du rapport ------------------------------------------

/** Niveaux d'appréciation (radio), du moins bon au meilleur, avec leur couleur.
 *  La CLÉ est stockée dans le JSON : ne pas la renommer (seul le libellé est libre). */
const RATINGS = [
  { key: 'non-teste', label: 'Non testé', color: '#6b7280' },
  { key: 'a-ameliorer', label: 'À améliorer', color: '#ef4444' },
  { key: 'presque-bien', label: 'Suffisant', color: '#f59e0b' },
  { key: 'satisfaisant', label: 'Satisfaisant', color: '#84cc16' },
  { key: 'complet', label: 'Complet', color: '#22c55e' },
] as const
type RatingKey = (typeof RATINGS)[number]['key']

/** Les deux testeurs (colonnes gauche / droite). */
type Tester = 'jules' | 'alexis'
const TESTER_LABEL: Record<Tester, string> = { jules: 'Testeur Jules', alexis: 'Testeur Alexis' }

/** Les deux côtés testés d'un même vilain. */
const SIDES = ['joueur', 'bot'] as const
type Side = (typeof SIDES)[number]
const SIDE_LABEL: Record<Side, string> = { joueur: 'Joueur', bot: 'Bot' }

/** Une appréciation (un côté d'un testeur pour un vilain). */
interface SideEntry {
  rating: RatingKey
  games: number
  comment: string
  /** Le journal de partie de ce côté a été relu / vérifié. */
  journalChecked: boolean
}
type TesterEntry = Record<Side, SideEntry>
type VillainEntry = Record<Tester, TesterEntry>
interface Report {
  version: number
  villains: Record<string, VillainEntry>
}

const emptySide = (): SideEntry => ({ rating: 'non-teste', games: 0, comment: '', journalChecked: false })

/** Lit l'entrée d'un vilain, en la complétant avec les valeurs par défaut manquantes. */
function entryOf(report: Report, id: string): VillainEntry {
  const v = report.villains[id]
  const tester = (t?: TesterEntry): TesterEntry => ({
    joueur: { ...emptySide(), ...t?.joueur },
    bot: { ...emptySide(), ...t?.bot },
  })
  return { jules: tester(v?.jules), alexis: tester(v?.alexis) }
}

// --- Sous-composants --------------------------------------------------------

/** Compteur « parties testées » : − valeur + (borné à 0). */
function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(0, n))
  return (
    <span className="inline-flex items-center overflow-hidden rounded border border-white/20 bg-white/5">
      <button type="button" onClick={() => set(value - 1)} className="px-1.5 py-0.5 text-white/70 hover:bg-white/10">
        −
      </button>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); set(Number.isNaN(n) ? 0 : n) }}
        className="w-8 bg-transparent text-center text-white/90 outline-none"
      />
      <button type="button" onClick={() => set(value + 1)} className="px-1.5 py-0.5 text-white/70 hover:bg-white/10">
        +
      </button>
    </span>
  )
}

/** Niveaux proposés pour un côté donné : le côté Joueur n'expose pas « À améliorer ». */
const ratingsForSide = (side: Side) => (side === 'joueur' ? RATINGS.filter((r) => r.key !== 'a-ameliorer') : RATINGS)

/** Un côté (Joueur ou Bot) : appréciation colorée + nombre de parties + commentaire. */
function SidePanel({ side, entry, onPatch }: { side: Side; entry: SideEntry; onPatch: (patch: Partial<SideEntry>) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200/80">{SIDE_LABEL[side]}</span>
      <div className="flex flex-wrap gap-1">
        {ratingsForSide(side).map((r) => {
          const on = r.key === entry.rating
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPatch({ rating: r.key })}
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition"
              style={on
                ? { backgroundColor: r.color, borderColor: r.color, color: '#fff' }
                : { borderColor: `${r.color}66`, color: r.color, backgroundColor: `${r.color}1a` }}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <span className="flex items-center gap-2 text-[11px] text-white/60">
        Parties testées
        <Stepper value={entry.games} onChange={(games) => onPatch({ games })} />
      </span>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/60">
        <input
          type="checkbox"
          checked={entry.journalChecked}
          onChange={(e) => onPatch({ journalChecked: e.target.checked })}
          className="h-3.5 w-3.5 accent-emerald-500"
        />
        Journal vérifié
      </label>
      <input
        type="text"
        value={entry.comment}
        onChange={(e) => onPatch({ comment: e.target.value })}
        placeholder="Commentaire…"
        className="w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-xs text-white/90 placeholder:text-white/30"
      />
    </div>
  )
}

/** Un côté (Joueur ou Bot) en LECTURE SEULE : seul le radio sélectionné est affiché ; les
 *  champs (parties / commentaire) deviennent du texte, masqués s'ils ne sont pas remplis. */
function ReadOnlySidePanel({ title, entry }: { title: string; entry: SideEntry }) {
  const rating = RATINGS.find((r) => r.key === entry.rating) ?? RATINGS[0]
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200/80">{title}</span>
      <div className="flex flex-wrap gap-1">
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: rating.color, borderColor: rating.color, color: '#fff' }}
        >
          {rating.label}
        </span>
      </div>
      {entry.games > 0 && (
        <span className="text-[11px] text-white/60">
          {entry.games} {plural(entry.games, 'partie')} {plural(entry.games, 'testée')}
        </span>
      )}
      {entry.journalChecked && <span className="text-[11px] font-semibold text-emerald-300">✓ Journal vérifié</span>}
      {entry.comment.trim() !== '' && (
        <p className="whitespace-pre-wrap rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/80">
          {entry.comment}
        </p>
      )}
    </div>
  )
}

/** Le bloc d'un testeur : ses deux côtés (Joueur / Bot). En lecture seule (`readOnly`),
 *  seul le radio sélectionné et les champs remplis sont montrés (pas d'édition). */
function TesterPanel({
  tester,
  entry,
  onPatch,
  readOnly,
}: {
  tester: Tester
  entry: TesterEntry
  onPatch: (side: Side, patch: Partial<SideEntry>) => void
  readOnly?: boolean
}) {
  return (
    <div className={`grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-black/35 p-3${readOnly ? ' h-full self-stretch' : ''}`}>
      <h3 className="col-span-2 text-center text-sm font-bold text-white">{TESTER_LABEL[tester]}</h3>
      {SIDES.map((side) =>
        readOnly ? (
          <ReadOnlySidePanel key={side} title={SIDE_LABEL[side]} entry={entry[side]} />
        ) : (
          <SidePanel key={side} side={side} entry={entry[side]} onPatch={(patch) => onPatch(side, patch)} />
        ),
      )}
    </div>
  )
}

/** Rang d'un niveau (0 = pire … 4 = meilleur), d'après l'ordre de `RATINGS`. */
const ratingRank = (key: RatingKey): number => RATINGS.findIndex((r) => r.key === key)

/** Niveaux affichés dans les STATS d'un côté : le côté Joueur masque « Non testé » et « À améliorer ». */
const statRatingsForSide = (side: Side) =>
  side === 'joueur' ? RATINGS.filter((r) => r.key !== 'non-teste' && r.key !== 'a-ameliorer') : RATINGS

/** Un graphe (barres horizontales) : répartition des niveaux pour une population de vilains. */
function RatingBars({ counts, total, ratings }: { counts: Record<RatingKey, number>; total: number; ratings: readonly (typeof RATINGS)[number][] }) {
  const max = Math.max(1, ...ratings.map((r) => counts[r.key]))
  return (
    <div className="flex flex-col gap-2">
      {ratings.map((r) => {
        const n = counts[r.key]
        const pct = total === 0 ? 0 : Math.round((n / total) * 100)
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-right text-xs font-semibold" style={{ color: r.color }}>
              {r.label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/5">
              <div
                className="h-full rounded transition-[width]"
                style={{ width: `${(n / max) * 100}%`, backgroundColor: r.color }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-white/80">
              {n} · {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Statistiques globales, SÉPARÉES par côté (Joueur / Bot). Pour chaque vilain, on retient
 * la MEILLEURE appréciation entre les deux testeurs (ex. Non testé vs Assez bien → Assez bien),
 * puis on compte cette valeur par niveau. Un graphe par côté.
 */
function GlobalStats({ report, villains }: { report: Report; villains: Row[] }) {
  const perSide = useMemo(() => {
    const testers = Object.keys(TESTER_LABEL) as Tester[]
    const bySide = {} as Record<Side, { counts: Record<RatingKey, number>; journal: number }>
    for (const s of SIDES) bySide[s] = { counts: Object.fromEntries(RATINGS.map((r) => [r.key, 0])) as Record<RatingKey, number>, journal: 0 }
    for (const v of villains) {
      const e = entryOf(report, v.id)
      for (const s of SIDES) {
        // Meilleure appréciation des deux testeurs pour ce côté.
        const best = testers.reduce<RatingKey>(
          (acc, t) => (ratingRank(e[t][s].rating) > ratingRank(acc) ? e[t][s].rating : acc),
          'non-teste',
        )
        bySide[s].counts[best]++
        // Journal considéré vérifié si AU MOINS un testeur l'a coché.
        if (testers.some((t) => e[t][s].journalChecked)) bySide[s].journal++
      }
    }
    return bySide
  }, [report, villains])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-amber-200">Statistiques globales</h2>
      <p className="mb-4 text-xs text-white/40">
        Meilleure appréciation entre les deux testeurs, pour chacun des {villains.length}{' '}
        {plural(villains.length, 'vilain')}.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {SIDES.map((s) => {
          const journalPct = villains.length === 0 ? 0 : Math.round((perSide[s].journal / villains.length) * 100)
          return (
            <div key={s} className="flex h-full flex-col">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-white/70">{SIDE_LABEL[s]}</h3>
              <RatingBars counts={perSide[s].counts} total={villains.length} ratings={statRatingsForSide(s)} />
              <div className="mt-auto flex items-center gap-3 pt-2">
                <span className="w-24 shrink-0 text-right text-xs font-semibold text-emerald-300">Journal vérifié</span>
                <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/5">
                  <div className="h-full rounded bg-emerald-500 transition-[width]" style={{ width: `${journalPct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-white/80">
                  {perSide[s].journal} · {journalPct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Bascule un chemin d'image raster vers son équivalent `.webp` (conserve un éventuel `?v=…`). */
const toWebp = (url: string): string => url.replace(/\.(png|jpe?g)(\?|$)/i, '.webp$2')

/**
 * Portrait carré du vilain, avec repli « ? » si l'image manque ou ne charge pas.
 * Certains vilains custom gardent en local (IndexedDB) un chemin périmé en `.png`/`.jpg`
 * alors que les fichiers ont migré en `.webp` : si l'image échoue, on réessaie en `.webp`
 * avant d'abandonner.
 */
function Portrait({ src, name }: { src: string; name: string }) {
  // `origin` = la prop suivie ; `current` = l'URL réellement tentée (peut basculer en .webp).
  const [st, setSt] = useState({ origin: src, current: src, broken: false })
  // Réinitialise l'état PENDANT le rendu quand la prop `src` change (pattern React officiel).
  if (st.origin !== src) setSt({ origin: src, current: src, broken: false })
  const onError = () => {
    const webp = toWebp(st.current)
    if (webp !== st.current) setSt((s) => ({ ...s, current: webp }))
    else setSt((s) => ({ ...s, broken: true }))
  }
  if (!src || st.broken) {
    return (
      <div className="flex aspect-square w-28 items-center justify-center rounded-lg border border-white/25 bg-black/30 text-3xl text-white/40">
        ?
      </div>
    )
  }
  return <img src={st.current} alt={name} onError={onError} className="aspect-square w-28 rounded-lg border border-white/25 object-cover" />
}

// --- Écran ------------------------------------------------------------------

/** Un vilain de la liste, avec sa couleur de méchant (fond de ligne). */
interface Row {
  id: string
  name: string
  portrait: string
  color: string
}

/**
 * « Rapport des tests » (outil de dév, masqué dans l'exe). Liste tous les vilains, dans
 * l'ordre de sortie ; chaque ligne prend la COULEUR DU MÉCHANT en fond, avec un portrait
 * carré au centre encadré par deux blocs de testeur (Jules / Alexis), chacun scindé en un
 * côté Joueur et un côté Bot. Chaque côté porte une appréciation colorée, un nombre de
 * parties testées et un commentaire.
 *
 * Persistance : `assets/test-report.json` (committé → transmis à chaque commit), lu/écrit
 * via les endpoints dev `/__test-report` et `/__save-test-report` (cf. vite.config.ts).
 * `assets/` étant ignoré du watcher, sauvegarder à chaque frappe ne recharge pas la page.
 */
export function TestReport({ onBack }: Props) {
  // Vilains personnalisés : chargés au runtime (comme la galerie).
  const customLoaded = useCustomVillainStore((s) => s.loaded)
  const loadCustom = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => { if (!customLoaded) void loadCustom() }, [customLoaded, loadCustom])

  // Liste de TOUS les vilains (natifs + persos), dans l'ORDRE DE SORTIE (comme la « Liste
  // des villains ») : natifs par sortie, puis les customs. Portrait + couleur du méchant
  // lus directement (customs : depuis leur propre bundle, pas via le registre runtime).
  const villains = useMemo<Row[]>(() => {
    const native: Row[] = (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).map((k) => {
      const def = VILLAIN_REGISTRY[k].def
      return { id: k, name: def.name, portrait: villainPortrait(k), color: VILLAIN_COLOR[def.id] ?? DEFAULT_TINT_A }
    })
    const custom: Row[] = customVillains.map((v) => ({
      id: v.id,
      name: v.name,
      portrait: v.portrait ?? v.backVillainImage ?? '',
      color: v.color || DEFAULT_TINT_A,
    }))
    return [...native, ...custom].sort((a, b) => byRelease(a.id, b.id))
  }, [customVillains])

  // Testeur sélectionné (persisté en localStorage) : affiché À GAUCHE et éditable ;
  // l'autre testeur passe À DROITE en lecture seule.
  const [selectedTester, setSelectedTester] = useState<Tester>(() => {
    const saved = localStorage.getItem('test-report:tester')
    return saved === 'jules' || saved === 'alexis' ? saved : 'jules'
  })
  useEffect(() => { localStorage.setItem('test-report:tester', selectedTester) }, [selectedTester])
  const otherTester: Tester = selectedTester === 'jules' ? 'alexis' : 'jules'

  // Rapport chargé depuis le disque.
  const [report, setReport] = useState<Report | null>(null)
  const [query, setQuery] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Chargement initial du rapport.
  useEffect(() => {
    let alive = true
    void fetch('/__test-report')
      .then((r) => (r.ok ? r.json() : { version: 1, villains: {} }))
      .then((data: Report) => { if (alive) setReport({ version: data.version ?? 1, villains: data.villains ?? {} }) })
      .catch(() => { if (alive) setReport({ version: 1, villains: {} }) })
    return () => { alive = false }
  }, [])

  // Sauvegarde différée (débounce) : évite d'écrire le fichier à chaque frappe.
  const scheduleSave = (next: Report) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(() => {
      void fetch('/__save-test-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
        .then((r) => setSaveState(r.ok ? 'saved' : 'error'))
        .catch(() => setSaveState('error'))
    }, 500)
  }

  // Applique un patch sur un côté (testeur + joueur/bot) d'un vilain, puis planifie la sauvegarde.
  const patch = (villainId: string, tester: Tester, side: Side, sidePatch: Partial<SideEntry>) => {
    setReport((prev) => {
      if (!prev) return prev
      const cur = entryOf(prev, villainId)
      const next: Report = {
        ...prev,
        villains: {
          ...prev.villains,
          [villainId]: { ...cur, [tester]: { ...cur[tester], [side]: { ...cur[tester][side], ...sidePatch } } },
        },
      }
      scheduleSave(next)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q === '' ? villains : villains.filter((v) => v.name.toLowerCase().includes(q))
  }, [villains, query])

  const saveLabel: Record<typeof saveState, string> = {
    idle: '',
    saving: '💾 Enregistrement…',
    saved: '✓ Enregistré',
    error: '⚠️ Échec (serveur de dév requis)',
  }

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
        <h1 className="text-lg font-bold uppercase tracking-wide text-amber-200">📋 Rapport des tests</h1>
        <label className="flex items-center gap-2 text-sm text-white/70">
          Testeur
          <select
            value={selectedTester}
            onChange={(e) => setSelectedTester(e.target.value as Tester)}
            className="rounded-lg border border-white/15 bg-[#0b0a12] px-3 py-2 text-sm font-semibold text-white/90"
          >
            <option value="jules">Jules</option>
            <option value="alexis">Alexis</option>
          </select>
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un vilain…"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/30"
        />
        <span className="text-sm text-white/50">{filtered.length} {plural(filtered.length, 'vilain')}</span>
        <span
          className={`ml-auto text-sm ${saveState === 'error' ? 'text-red-300' : saveState === 'saved' ? 'text-emerald-300' : 'text-white/50'}`}
        >
          {saveLabel[saveState]}
        </span>
      </header>

      {report === null ? (
        <div className="flex flex-1 items-center justify-center text-white/50">Chargement du rapport…</div>
      ) : (
        <Scroller className="flex-1">
          <div className="px-4 pt-4">
            <GlobalStats report={report} villains={villains} />
          </div>
          <ul className="flex flex-col gap-3 px-4 py-4">
            {filtered.map((v) => {
              const e = entryOf(report, v.id)
              return (
                <li
                  key={v.id}
                  className="grid grid-cols-[1.6fr_auto_1fr] items-center gap-4 rounded-2xl border p-3"
                  style={{
                    borderColor: `color-mix(in srgb, ${v.color}, white 22%)`,
                    background: `linear-gradient(135deg, ${v.color} 0%, color-mix(in srgb, ${v.color}, black 55%) 100%)`,
                  }}
                >
                  <TesterPanel
                    tester={selectedTester}
                    entry={e[selectedTester]}
                    onPatch={(side, p) => patch(v.id, selectedTester, side, p)}
                  />
                  <div className="flex w-28 flex-col items-center gap-2">
                    <Portrait src={v.portrait} name={v.name} />
                    <span className="text-center text-sm font-bold text-white drop-shadow">{v.name}</span>
                  </div>
                  <TesterPanel
                    tester={otherTester}
                    entry={e[otherTester]}
                    onPatch={(side, p) => patch(v.id, otherTester, side, p)}
                    readOnly
                  />
                </li>
              )
            })}
          </ul>
        </Scroller>
      )}
    </div>
  )
}
