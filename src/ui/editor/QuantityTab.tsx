// Onglet « Quantité » : la PLANCHE du deck. On fixe le nombre d'exemplaires de
// chaque carte jusqu'à remplir 30 cartes Vilain + 15 cartes Fatalité (comme les
// vilains officiels). Tant que la planche n'est pas pleine, on ne peut ni tester ni
// exporter le vilain (cf. VillainEditor).
import { useEffect, useMemo, useState } from 'react'
import type { CustomVillain, CustomCard } from '../../data/customVillain'
import type { CardDef } from '../../data/types'
import {
  FATE_CARD_COLOR,
  VILLAIN_DECK_SIZE,
  FATE_DECK_SIZE,
  deckCounts,
  toCardDefs,
} from '../../data/customVillain'
import { VILLAIN_REGISTRY, UNRELEASED_VILLAINS } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { villainColor } from '../villainColorState'
import { CardPreview } from './CardPreview'

export function QuantityTab({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  const counts = deckCounts(draft)
  const setCopies = (id: string, copies: number) =>
    patch({ cards: draft.cards.map((c) => (c.id === id ? { ...c, copies: Math.max(0, copies) } : c)) })

  const villain = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  const fate = draft.cards.filter((c) => c.deck === 'fate' && !c.group)
  const extraDecks = draft.extraDecks ?? []
  const groupTotal = (name: string) =>
    draft.cards.filter((c) => c.group === name).reduce((n, c) => n + (c.copies ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
      <p className="text-sm text-white/55">
        Compose ta planche en fixant le nombre d’exemplaires de chaque carte. Le deck doit contenir
        exactement <strong>{VILLAIN_DECK_SIZE} cartes Vilain</strong> et{' '}
        <strong>{FATE_DECK_SIZE} cartes Fatalité</strong>. Tant que la planche n’est pas pleine, le
        vilain ne peut être ni testé ni exporté. Les <strong>paquets personnalisés</strong> sont
        hors-deck : leur quantité est libre.
      </p>

      <DeckSection
        title="Deck Vilain"
        cards={villain}
        total={counts.villain}
        target={VILLAIN_DECK_SIZE}
        color={draft.color}
        fateColor={FATE_CARD_COLOR}
        keywordColors={draft.keywordColors}
        onSetCopies={setCopies}
        emptyHint="Aucune carte Vilain : ajoute-en dans l’onglet « Cartes »."
      />

      <DeckSection
        title="Deck Fatalité"
        cards={fate}
        total={counts.fate}
        target={FATE_DECK_SIZE}
        color={draft.color}
        fateColor={FATE_CARD_COLOR}
        keywordColors={draft.keywordColors}
        onSetCopies={setCopies}
        emptyHint="Aucune carte Fatalité : ajoute-en dans l’onglet « Cartes »."
      />

      {extraDecks.map((name) => (
        <DeckSection
          key={name}
          title={`Paquet perso — ${name}`}
          cards={draft.cards.filter((c) => c.group === name)}
          total={groupTotal(name)}
          color={draft.color}
          fateColor={FATE_CARD_COLOR}
          onSetCopies={setCopies}
          emptyHint="Aucune carte : ajoute-en dans l’onglet « Cartes »."
        />
      ))}
      </div>

      <CostSidebar villainCards={villain} draftId={draft.id} color={draft.color} />
    </div>
  )
}

// Colonnes de l'histogramme : coûts 0 → 5 (la dernière agrège 5 et plus), puis une
// colonne « ? » pour les cartes à coût VARIABLE.
const MAX_BUCKET = 5
const VAR_INDEX = MAX_BUCKET + 1 // index de la colonne « ? »
const BAR_LABELS = ['0', '1', '2', '3', '4', '5+', '?']

/** Colonne d'une carte : « ? » (coût variable) ou son coût plafonné à 5+. */
function costBucket(c: { cost?: number; costVariable?: boolean }): number {
  if (c.costVariable) return VAR_INDEX
  return Math.min(c.cost ?? 0, MAX_BUCKET)
}

/** Histogramme des EXEMPLAIRES (copies) par colonne, sur les cartes du deck Vilain
 *  uniquement (la Fatalité n'a pas de coût). */
function villainCostHistogram(cards: CardDef[]): number[] {
  const h = BAR_LABELS.map(() => 0)
  for (const c of cards) {
    if (c.deck !== 'villain') continue
    h[costBucket(c)] += c.copies ?? 0
  }
  return h
}

/** Coût moyen (en jetons Pouvoir) des cartes du deck Vilain, pondéré par le nombre
 *  d'exemplaires. Les cartes à coût VARIABLE (« ? ») sont exclues (coût inconnu),
 *  ainsi que la Fatalité (sans coût). null si aucune carte à coût fixe. */
function averageVillainCost(cards: CardDef[]): number | null {
  let sum = 0
  let n = 0
  for (const c of cards) {
    if (c.deck !== 'villain' || c.costVariable) continue
    const copies = c.copies ?? 0
    sum += (c.cost ?? 0) * copies
    n += copies
  }
  return n === 0 ? null : sum / n
}

/** Ligne « coût moyen » : libellé + valeur (1 décimale, virgule FR) suivie du
 *  médaillon Pouvoir (l'unité). « — » si aucune carte à coût fixe. */
function AvgCostLine({ avg }: { avg: number | null }) {
  return (
    <div
      className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/70"
      title="Coût moyen en jetons Pouvoir (cartes du deck Vilain à coût fixe ; les coûts « ? » sont exclus)"
    >
      <span>Coût moyen</span>
      <span className="font-bold text-white">
        {avg === null ? '—' : avg.toFixed(1).replace('.', ',')}
      </span>
      <img src="/editor/board/action-gain-power.png" alt="Pouvoir" className="h-4 w-4" />
    </div>
  )
}

/** Un vilain de référence, sélectionnable pour comparer sa courbe de coût. */
interface RefVillain {
  id: string
  name: string
  color: string
  cards: CardDef[]
}

/** Liste des vilains comparables : natifs (hors non sortis) + publiés, triés par nom.
 *  Exclut le vilain en cours d'édition. */
function useVillainList(excludeId: string): RefVillain[] {
  const loaded = useCustomVillainStore((s) => s.loaded)
  const load = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  return useMemo(() => {
    const reg = VILLAIN_REGISTRY as Record<
      string,
      { def: { id: string; name: string }; cards: CardDef[]; label?: string }
    >
    const natives: RefVillain[] = Object.keys(reg)
      .filter((k) => !(UNRELEASED_VILLAINS as string[]).includes(k))
      .map((k) => ({
        id: reg[k].def.id,
        name: reg[k].label ?? reg[k].def.name,
        color: villainColor(reg[k].def.id) ?? '#8b93a7',
        cards: reg[k].cards,
      }))
    const publisheds: RefVillain[] = customVillains
      .filter((v) => v.id !== excludeId && v.published !== false)
      .map((v) => ({ id: v.id, name: v.name, color: v.color, cards: toCardDefs(v) }))
    return [...natives, ...publisheds].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [customVillains, excludeId])
}

/** Barres verticales « cartes par coût », façon courbe de mana. Chaque colonne
 *  montre sa valeur (`format`) ; l'échelle est propre au graphe (max = plus haute
 *  colonne) pour bien lire la forme. */
function CostBars({
  counts,
  color,
  format,
}: {
  counts: number[]
  color: string
  format: (n: number) => string
}) {
  const max = Math.max(1, ...counts)
  const BAR_AREA = 130 // hauteur (px) de la zone de barres

  return (
    <div className="flex items-end gap-1.5" style={{ height: BAR_AREA + 24 }}>
      {counts.map((n, i) => {
        const h = (n / max) * BAR_AREA
        return (
          <div key={i} className="flex flex-1 flex-col items-center">
            <div className="relative w-full" style={{ height: BAR_AREA }}>
              <div className="absolute inset-0 rounded-md border border-white/10 bg-black/40" />
              <div
                className="absolute inset-x-0 bottom-0 rounded-md"
                style={{ height: h, background: `linear-gradient(180deg, ${color}, ${color}cc)` }}
              />
              <span
                className="absolute inset-x-0 text-center text-[11px] font-bold text-white drop-shadow"
                style={{ bottom: h + 3 }}
              >
                {format(n)}
              </span>
            </div>
            <span className="mt-1.5 text-xs font-bold text-white/60">{BAR_LABELS[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Colonne latérale de l'onglet Quantité : la courbe de coût du vilain en cours, et
 *  en dessous celle d'un vilain de comparaison AU CHOIX (natif ou publié). */
function CostSidebar({
  villainCards,
  draftId,
  color,
}: {
  villainCards: CustomCard[]
  draftId: string
  color: string
}) {
  const mine = villainCostHistogram(villainCards as CardDef[])
  const total = mine.reduce((a, b) => a + b, 0)
  const myAvg = averageVillainCost(villainCards as CardDef[])

  const villains = useVillainList(draftId)
  const [selId, setSelId] = useState('ursula') // Ursula par défaut (courbe de coût de référence).
  const selIndex = Math.max(0, villains.findIndex((v) => v.id === selId))
  const selected = villains[selIndex]
  // Passe au vilain précédent / suivant (avec bouclage sur la liste).
  const step = (delta: number) => {
    if (!villains.length) return
    const next = (selIndex + delta + villains.length) % villains.length
    setSelId(villains[next].id)
  }
  const otherHist = selected
    ? villainCostHistogram(selected.cards)
    : BAR_LABELS.map(() => 0)
  const otherTotal = otherHist.reduce((a, b) => a + b, 0)
  const otherAvg = selected ? averageVillainCost(selected.cards) : null

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 self-start rounded-2xl border border-white/10 bg-black/25 p-4 lg:sticky lg:top-4 lg:w-56">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Cartes / coût
          </h3>
          <span className="text-[11px] text-white/40">{total} cartes</span>
        </div>
        <CostBars counts={mine} color={color} format={(n) => String(n)} />
        <AvgCostLine avg={myAvg} />
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Comparer</h3>
          <span className="text-[11px] text-white/40">{otherTotal} cartes</span>
        </div>
        <CostBars
          counts={otherHist}
          color={selected?.color ?? '#8b93a7'}
          format={(n) => String(n)}
        />
        <AvgCostLine avg={otherAvg} />
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Vilain précédent"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-sm font-bold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
          >
            ‹
          </button>
          <select
            value={selected?.id ?? ''}
            onChange={(e) => setSelId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-amber-300/70"
          >
            {villains.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Vilain suivant"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-sm font-bold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
          >
            ›
          </button>
        </div>
      </div>
    </aside>
  )
}

function DeckSection({
  title,
  cards,
  total,
  target,
  color,
  fateColor,
  keywordColors = [],
  onSetCopies,
  emptyHint,
}: {
  title: string
  cards: CustomCard[]
  total: number
  target?: number
  color: string
  fateColor: string
  keywordColors?: { label: string; color: string }[]
  onSetCopies: (id: string, copies: number) => void
  emptyHint: string
}) {
  const full = target !== undefined && total === target
  const over = target !== undefined && total > target
  const badge = target === undefined
    ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
    : full
      ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100'
      : over
        ? 'border-rose-400/60 bg-rose-400/15 text-rose-100'
        : 'border-amber-400/50 bg-amber-400/15 text-amber-100'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-white/70">{title}</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge}`}>
          {target === undefined ? `${total} carte(s)` : `${total} / ${target}`}
          {target !== undefined && (full ? ' ✓' : over ? ' (trop)' : '')}
        </span>
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-white/40">{emptyHint}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-2"
            >
              <CardPreview card={c} color={color} fateColor={fateColor} keywordColors={keywordColors} />
              <span className="truncate text-center text-[11px] text-white/70" title={c.name}>
                {c.name}
              </span>
              <Stepper value={c.copies} onChange={(n) => onSetCopies(c.id, n)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        className="h-7 w-7 rounded-lg border border-white/20 bg-white/5 text-sm font-bold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200 disabled:opacity-30"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-bold text-white">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="h-7 w-7 rounded-lg border border-white/20 bg-white/5 text-sm font-bold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
      >
        +
      </button>
    </div>
  )
}
