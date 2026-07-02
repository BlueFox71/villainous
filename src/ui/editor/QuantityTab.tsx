// Onglet « Quantité » : la PLANCHE du deck. On fixe le nombre d'exemplaires de
// chaque carte jusqu'à remplir 30 cartes Vilain + 15 cartes Fatalité (comme les
// vilains officiels). Tant que la planche n'est pas pleine, on ne peut ni tester ni
// exporter le vilain (cf. VillainEditor).
import type { CustomVillain, CustomCard } from '../../data/customVillain'
import {
  FATE_CARD_COLOR,
  VILLAIN_DECK_SIZE,
  FATE_DECK_SIZE,
  deckCounts,
} from '../../data/customVillain'
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
    <div className="flex flex-col gap-8">
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
