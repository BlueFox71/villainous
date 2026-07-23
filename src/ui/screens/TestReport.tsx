import { useEffect, useMemo, useState } from 'react'
import { VILLAIN_REGISTRY, villainEntry, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { villainPortrait } from '../villainArt'
import { VILLAIN_COLOR, DEFAULT_TINT_A } from '../villainColors'
import { byRelease } from '../villainOrder'
import { plural } from '../../engine/plural'
import { Scroller } from '../components/Scroller'
import { GameCardReviewModal, type ReviewVillain } from '../components/GameCardReviewModal'
import {
  RATINGS,
  TESTER_LABEL,
  SIDES,
  SIDE_LABEL,
  type RatingKey,
  type Tester,
  type Side,
  type SideEntry,
  type TesterEntry,
  type Report,
  type Row,
  entryOf,
  ratingRank,
  statRatingsForSide,
  otherTesterOf,
  loadSelectedTester,
  saveSelectedTester,
  useTestReport,
  SAVE_LABEL,
} from '../testReport/model'
import { SidePanel, ReadOnlySidePanel, Portrait } from '../testReport/components'

interface Props {
  /** Revenir au menu principal. */
  onBack: () => void
}

/** Nombre de cartes VALIDABLES d'un vilain = cartes des decks Vilain + Fatalité. */
function cardTotalOf(villainId: string): number {
  return (villainEntry(villainId)?.cards ?? []).filter((c) => c.deck === 'villain' || c.deck === 'fate').length
}

/** Jauge circulaire (SVG) affichant un pourcentage : anneau vert proportionnel + % au centre. */
function CircularProgress({ value, size = 52 }: { value: number; size?: number }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const done = value >= 100
  const color = done ? '#22c55e' : value === 0 ? '#6b7280' : '#84cc16'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, value)) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-white text-[13px] font-bold">
        {value}%
      </text>
    </svg>
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
 * la MEILLEURE appréciation entre les deux testeurs, puis on compte cette valeur par niveau.
 */
function GlobalStats({ report, villains }: { report: Report; villains: Row[] }) {
  const perSide = useMemo(() => {
    const testers = Object.keys(TESTER_LABEL) as Tester[]
    const bySide = {} as Record<Side, { counts: Record<RatingKey, number>; journal: number }>
    for (const s of SIDES) bySide[s] = { counts: Object.fromEntries(RATINGS.map((r) => [r.key, 0])) as Record<RatingKey, number>, journal: 0 }
    for (const v of villains) {
      const e = entryOf(report, v.id)
      for (const s of SIDES) {
        const best = testers.reduce<RatingKey>(
          (acc, t) => (ratingRank(e[t][s].rating) > ratingRank(acc) ? e[t][s].rating : acc),
          'non-teste',
        )
        bySide[s].counts[best]++
        if (testers.some((t) => e[t][s].journalChecked)) bySide[s].journal++
      }
    }
    return bySide
  }, [report, villains])

  // Cartes validées, TOUS vilains confondus (jauge globale).
  const cards = useMemo(() => {
    let total = 0
    let validated = 0
    for (const v of villains) {
      const t = cardTotalOf(v.id)
      total += t
      validated += Math.min(entryOf(report, v.id).validatedCards.length, t)
    }
    return { total, validated, pct: total === 0 ? 0 : Math.round((validated / total) * 100) }
  }, [report, villains])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-amber-200">Statistiques globales</h2>
      <p className="mb-4 text-xs text-white/40">
        Meilleure appréciation entre les deux testeurs, pour chacun des {villains.length}{' '}
        {plural(villains.length, 'vilain')}.
      </p>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto]">
        {SIDES.map((s) => {
          const journalPct = villains.length === 0 ? 0 : Math.round((perSide[s].journal / villains.length) * 100)
          return (
            <div key={s} className="flex h-full flex-col">
              <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-white/70">{SIDE_LABEL[s]}</h3>
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
        {/* Jauge globale : % de cartes validées sur l'ensemble des vilains — colonne
            alignée avec Joueur / Bot. */}
        <div className="flex flex-col md:w-32">
          <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-white/70">Cartes</h3>
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <CircularProgress value={cards.pct} size={72} />
            <span className="text-[11px] tabular-nums text-white/70">{cards.validated} / {cards.total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * « Rapport des tests » (outil de dév, masqué dans l'exe). Liste tous les vilains, dans
 * l'ordre de sortie ; chaque ligne prend la COULEUR DU MÉCHANT en fond, avec un portrait
 * carré au centre encadré par le testeur sélectionné (éditable) et l'autre (lecture seule).
 * Chaque côté (Joueur / Bot) porte une appréciation, un nombre de parties, « journal vérifié »
 * et un commentaire. Persistance : `assets/test-report.json` (cf. testReport/shared.tsx).
 */
export function TestReport({ onBack }: Props) {
  // Vilains personnalisés : chargés au runtime (comme la galerie).
  const customLoaded = useCustomVillainStore((s) => s.loaded)
  const loadCustom = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => { if (!customLoaded) void loadCustom() }, [customLoaded, loadCustom])

  // Liste de TOUS les vilains (natifs + persos), dans l'ORDRE DE SORTIE.
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

  // Testeur sélectionné (persisté) : édité À GAUCHE ; l'autre passe À DROITE en lecture seule.
  const [selectedTester, setSelectedTester] = useState<Tester>(loadSelectedTester)
  useEffect(() => { saveSelectedTester(selectedTester) }, [selectedTester])
  const otherTester = otherTesterOf(selectedTester)

  const { report, patch, saveState } = useTestReport()
  const [query, setQuery] = useState('')
  // Vilain dont on édite les cartes validées (modale « Cartes »), ou null (fermée).
  const [reviewVillain, setReviewVillain] = useState<ReviewVillain | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q === '' ? villains : villains.filter((v) => v.name.toLowerCase().includes(q))
  }, [villains, query])

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
          {SAVE_LABEL[saveState]}
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
              // Pourcentage de cartes validées (jauge, commune aux deux côtés).
              const total = cardTotalOf(v.id)
              const validated = e.validatedCards.length
              const pct = total === 0 ? 0 : Math.round((Math.min(validated, total) / total) * 100)
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
                  <div className="flex items-center gap-3">
                    <div className="flex w-28 flex-col items-center gap-2">
                      <Portrait src={v.portrait} name={v.name} />
                      <span className="text-center text-sm font-bold text-white drop-shadow">{v.name}</span>
                    </div>
                    {/* Jauge « cartes validées » : clic → panneau de revue des cartes. */}
                    <button
                      type="button"
                      onClick={() => setReviewVillain({ key: v.id, name: v.name })}
                      title={`Cartes validées : ${Math.min(validated, total)}/${total} — cliquer pour éditer`}
                      className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-black/25 p-2 transition hover:border-emerald-300/70 hover:bg-black/40"
                    >
                      <CircularProgress value={pct} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Cartes</span>
                    </button>
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

      {reviewVillain && (
        <GameCardReviewModal villains={[reviewVillain]} onClose={() => setReviewVillain(null)} />
      )}
    </div>
  )
}
