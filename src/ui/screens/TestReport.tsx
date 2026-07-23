import { useEffect, useMemo, useRef, useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { villainPortrait } from '../villainArt'
import { Scroller } from '../components/Scroller'

interface Props {
  /** Revenir au menu principal. */
  onBack: () => void
}

// --- Modèle de données du rapport ------------------------------------------

/** Niveaux d'appréciation (radio), du moins bon au meilleur, avec leur couleur. */
const RATINGS = [
  { key: 'non-teste', label: 'Non testé', color: '#6b7280' },
  { key: 'a-ameliorer', label: 'À améliorer', color: '#ef4444' },
  { key: 'presque-bien', label: 'Presque bien', color: '#f59e0b' },
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
}
type TesterEntry = Record<Side, SideEntry>
type VillainEntry = Record<Tester, TesterEntry>
interface Report {
  version: number
  villains: Record<string, VillainEntry>
}

const emptySide = (): SideEntry => ({ rating: 'non-teste', games: 0, comment: '' })
const emptyTester = (): TesterEntry => ({ joueur: emptySide(), bot: emptySide() })
const emptyVillain = (): VillainEntry => ({ jules: emptyTester(), alexis: emptyTester() })

/** Lit l'entrée d'un vilain, en la complétant avec les valeurs par défaut manquantes. */
function entryOf(report: Report, id: string): VillainEntry {
  const v = report.villains[id] ?? emptyVillain()
  return {
    jules: { joueur: { ...emptySide(), ...v.jules?.joueur }, bot: { ...emptySide(), ...v.jules?.bot } },
    alexis: { joueur: { ...emptySide(), ...v.alexis?.joueur }, bot: { ...emptySide(), ...v.alexis?.bot } },
  }
}

// --- Sous-composants --------------------------------------------------------

/** Groupe de « radios » colorées pour choisir une appréciation. */
function RatingRadios({ value, onChange }: { value: RatingKey; onChange: (r: RatingKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {RATINGS.map((r) => {
        const selected = r.key === value
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition"
            style={
              selected
                ? { backgroundColor: r.color, borderColor: r.color, color: '#fff' }
                : { borderColor: `${r.color}66`, color: r.color, backgroundColor: `${r.color}1a` }
            }
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

/** Un côté (Joueur ou Bot) : appréciation + nombre de parties + commentaire. */
function SidePanel({
  title,
  entry,
  onPatch,
}: {
  title: string
  entry: SideEntry
  onPatch: (patch: Partial<SideEntry>) => void
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200/80">{title}</span>
      <RatingRadios value={entry.rating} onChange={(rating) => onPatch({ rating })} />
      <label className="flex items-center gap-2 text-[11px] text-white/60">
        Parties testées
        <select
          value={entry.games}
          onChange={(e) => onPatch({ games: Number(e.target.value) })}
          className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/90"
        >
          {Array.from({ length: 51 }, (_, i) => (
            <option key={i} value={i} className="bg-[#15101f]">
              {i}
            </option>
          ))}
        </select>
      </label>
      <input
        type="text"
        value={entry.comment}
        onChange={(e) => onPatch({ comment: e.target.value })}
        placeholder="Commentaire…"
        className="w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/90 placeholder:text-white/30"
      />
    </div>
  )
}

/** Portrait carré du vilain, avec repli « ? » si l'image manque ou ne charge pas. */
function Portrait({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className="flex aspect-square w-28 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-3xl text-white/30">
        ?
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      className="aspect-square w-28 rounded-lg border border-white/15 object-cover"
    />
  )
}

/** Le bloc d'un testeur : ses deux côtés (Joueur / Bot). */
function TesterPanel({
  tester,
  entry,
  onPatch,
}: {
  tester: Tester
  entry: TesterEntry
  onPatch: (side: Side, patch: Partial<SideEntry>) => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <h3 className="text-center text-sm font-bold text-purple-200">{TESTER_LABEL[tester]}</h3>
      <div className="grid grid-cols-2 gap-2">
        {SIDES.map((side) => (
          <SidePanel
            key={side}
            title={SIDE_LABEL[side]}
            entry={entry[side]}
            onPatch={(patch) => onPatch(side, patch)}
          />
        ))}
      </div>
    </div>
  )
}

// --- Écran ------------------------------------------------------------------

/**
 * « Rapport des tests » (outil de dév, masqué dans l'exe). Liste tous les vilains ;
 * pour chacun, un portrait carré au centre encadré par deux blocs de testeur (Jules /
 * Alexis), chacun scindé en un côté Joueur et un côté Bot. Chaque côté porte une
 * appréciation colorée, un nombre de parties testées et un commentaire.
 *
 * Persistance : `assets/test-report.json` (committé → transmis à chaque commit), lu/écrit
 * via les endpoints dev `/__test-report` et `/__save-test-report` (cf. vite.config.ts).
 * Le dossier `assets/` est ignoré du watcher, donc sauvegarder à chaque frappe ne recharge
 * pas la page.
 */
export function TestReport({ onBack }: Props) {
  // Vilains personnalisés : chargés au runtime (comme la galerie).
  const customLoaded = useCustomVillainStore((s) => s.loaded)
  const loadCustom = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => { if (!customLoaded) void loadCustom() }, [customLoaded, loadCustom])

  // Liste plate { id, name, portrait } de TOUS les vilains (natifs + persos), triée par nom.
  const villains = useMemo(() => {
    const nativeKeys = Object.keys(VILLAIN_REGISTRY) as VillainKey[]
    const native = nativeKeys.map((k) => ({
      id: k as string,
      name: VILLAIN_REGISTRY[k].def.name,
      portrait: villainPortrait(k),
    }))
    const custom = customVillains.map((v) => ({
      id: v.id,
      name: v.name,
      portrait: villainPortrait(v.id),
    }))
    return [...native, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [customVillains])

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
          [villainId]: {
            ...cur,
            [tester]: { ...cur[tester], [side]: { ...cur[tester][side], ...sidePatch } },
          },
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
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un vilain…"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/30"
        />
        <span className="text-sm text-white/50">{filtered.length} vilain(s)</span>
        <span
          className={`ml-auto text-sm ${
            saveState === 'error' ? 'text-red-300' : saveState === 'saved' ? 'text-emerald-300' : 'text-white/50'
          }`}
        >
          {saveLabel[saveState]}
        </span>
      </header>

      {report === null ? (
        <div className="flex flex-1 items-center justify-center text-white/50">Chargement du rapport…</div>
      ) : (
        <Scroller className="flex-1">
          <ul className="flex flex-col gap-3 px-4 py-4">
            {filtered.map((v) => {
              const e = entryOf(report, v.id)
              return (
                <li
                  key={v.id}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-3"
                >
                  {/* Gauche : Testeur Jules */}
                  <TesterPanel tester="jules" entry={e.jules} onPatch={(side, p) => patch(v.id, 'jules', side, p)} />

                  {/* Centre : portrait carré + nom */}
                  <div className="flex w-40 flex-col items-center gap-2">
                    <Portrait src={v.portrait} name={v.name} />
                    <span className="text-center text-sm font-bold text-white/90">{v.name}</span>
                  </div>

                  {/* Droite : Testeur Alexis */}
                  <TesterPanel tester="alexis" entry={e.alexis} onPatch={(side, p) => patch(v.id, 'alexis', side, p)} />
                </li>
              )
            })}
          </ul>
        </Scroller>
      )}
    </div>
  )
}
