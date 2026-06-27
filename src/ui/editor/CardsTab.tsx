// Onglet « Cartes » de l'éditeur : galerie des cartes, formulaire d'édition (avec
// illustration auto-adaptée + constructeur d'effets catalogue) et aperçu live.
import { useState } from 'react'
import type { CustomVillain, CustomCard } from '../../data/customVillain'
import { emptyCustomCard } from '../../data/customVillain'
import type { CardType, DeckKind } from '../../data/types'
import type { Effect } from '../../engine/types'
import { Field, TextField, NumberField, ImageField, SelectField } from './fields'
import { CardPreview } from './CardPreview'
import { EFFECT_CATALOG, summarizeEffect } from './effectCatalog'

const VILLAIN_TYPES: { value: CardType; label: string }[] = [
  { value: 'ally', label: 'Allié' },
  { value: 'item', label: 'Objet' },
  { value: 'effect', label: 'Effet' },
  { value: 'condition', label: 'Condition' },
]
const FATE_TYPES: { value: CardType; label: string }[] = [
  { value: 'hero', label: 'Héros' },
  { value: 'item', label: 'Objet' },
  { value: 'effect', label: 'Effet' },
  { value: 'condition', label: 'Condition' },
]

/** Le coût s'applique aux cartes Vilain ; la force aux Alliés/Héros. */
const hasCost = (c: CustomCard) => c.deck === 'villain'
const hasStrength = (c: CustomCard) => c.type === 'ally' || c.type === 'hero'

// --- Constructeur d'effets ---------------------------------------------------

function EffectsEditor({
  effects,
  onChange,
}: {
  effects: Effect[]
  onChange: (e: Effect[]) => void
}) {
  const [pickKey, setPickKey] = useState(EFFECT_CATALOG[0].key)
  const [vals, setVals] = useState<Record<string, number>>(
    Object.fromEntries(EFFECT_CATALOG[0].params.map((p) => [p.key, p.default])),
  )
  const entry = EFFECT_CATALOG.find((e) => e.key === pickKey)!

  const selectEntry = (key: string) => {
    setPickKey(key)
    const e = EFFECT_CATALOG.find((x) => x.key === key)!
    setVals(Object.fromEntries(e.params.map((p) => [p.key, p.default])))
  }

  const add = () => onChange([...effects, entry.build(vals)])
  const remove = (i: number) => onChange(effects.filter((_, j) => j !== i))

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Effets à la mise en jeu
      </span>

      {effects.length === 0 ? (
        <p className="text-xs text-white/40">Aucun effet : la carte n’aura aucun impact mécanique.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {effects.map((e, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
            >
              <span className="text-white/80">{summarizeEffect(e)}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-white/40 transition hover:text-red-300"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
        <SelectField
          label="Effet"
          value={pickKey}
          options={EFFECT_CATALOG.map((e) => ({ value: e.key, label: e.label }))}
          onChange={selectEntry}
        />
        {entry.params.map((param) => (
          <NumberField
            key={param.key}
            label={param.label}
            value={vals[param.key]}
            min={param.min}
            max={param.max}
            onChange={(n) => setVals((s) => ({ ...s, [param.key]: n }))}
          />
        ))}
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/25"
        >
          + Ajouter
        </button>
      </div>
      <p className="text-[11px] text-white/35">{entry.description}</p>
    </div>
  )
}

// --- Formulaire d'une carte --------------------------------------------------

function CardForm({
  card,
  color,
  fateColor,
  onChange,
}: {
  card: CustomCard
  color: string
  fateColor: string
  onChange: (c: CustomCard) => void
}) {
  const set = (p: Partial<CustomCard>) => onChange({ ...card, ...p })
  const types = card.deck === 'fate' ? FATE_TYPES : VILLAIN_TYPES

  // Changer de deck : recadre le type sur ceux autorisés.
  const setDeck = (deck: DeckKind) => {
    const allowed = (deck === 'fate' ? FATE_TYPES : VILLAIN_TYPES).map((t) => t.value)
    const type = allowed.includes(card.type) ? card.type : allowed[0]
    set({ deck, type })
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nom" value={card.name} onChange={(name) => set({ name })} />
          <SelectField
            label="Paquet"
            value={card.deck}
            options={[
              { value: 'villain', label: 'Vilain' },
              { value: 'fate', label: 'Fatalité' },
            ]}
            onChange={setDeck}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Type"
            value={card.type}
            options={types}
            onChange={(type) => set({ type })}
          />
          {hasCost(card) && (
            <NumberField
              label="Coût"
              value={card.cost ?? 0}
              min={0}
              max={9}
              onChange={(cost) => set({ cost })}
            />
          )}
          {hasStrength(card) && (
            <NumberField
              label="Force"
              value={card.strength ?? 0}
              min={0}
              max={20}
              onChange={(strength) => set({ strength })}
            />
          )}
          <NumberField
            label="Exemplaires"
            value={card.copies}
            min={1}
            max={6}
            onChange={(copies) => set({ copies })}
          />
        </div>

        <TextField
          label="Texte de la carte"
          value={card.text}
          onChange={(text) => set({ text })}
          textarea
          placeholder="Texte de règle imprimé sur la carte."
        />

        <div className="flex items-end gap-4">
          <ImageField
            label="Illustration"
            value={card.artImage}
            onChange={(artImage) => set({ artImage })}
            aspect="card"
          />
          <div className="flex flex-1 flex-col gap-2">
            <Field label={`Zoom illustration (${Math.round((card.artTransform?.scale ?? 1) * 100)} %)`}>
              <input
                type="range"
                min={50}
                max={250}
                value={(card.artTransform?.scale ?? 1) * 100}
                onChange={(e) =>
                  set({
                    artTransform: {
                      scale: Number(e.target.value) / 100,
                      offsetXPct: card.artTransform?.offsetXPct ?? 0,
                      offsetYPct: card.artTransform?.offsetYPct ?? 0,
                    },
                  })
                }
                className="accent-amber-400"
              />
            </Field>
            <Field label="Décalage vertical">
              <input
                type="range"
                min={-50}
                max={50}
                value={card.artTransform?.offsetYPct ?? 0}
                onChange={(e) =>
                  set({
                    artTransform: {
                      scale: card.artTransform?.scale ?? 1,
                      offsetXPct: card.artTransform?.offsetXPct ?? 0,
                      offsetYPct: Number(e.target.value),
                    },
                  })
                }
                className="accent-amber-400"
              />
            </Field>
            <Field label="Décalage horizontal">
              <input
                type="range"
                min={-50}
                max={50}
                value={card.artTransform?.offsetXPct ?? 0}
                onChange={(e) =>
                  set({
                    artTransform: {
                      scale: card.artTransform?.scale ?? 1,
                      offsetXPct: Number(e.target.value),
                      offsetYPct: card.artTransform?.offsetYPct ?? 0,
                    },
                  })
                }
                className="accent-amber-400"
              />
            </Field>
          </div>
        </div>

        {/* Effets : cartes Vilain uniquement (jouées par le vilain). */}
        {card.deck === 'villain' && (
          <EffectsEditor
            effects={card.effects ?? []}
            onChange={(effects) => set({ effects: effects.length ? effects : undefined })}
          />
        )}
      </div>

      {/* Aperçu live */}
      <div className="w-56 shrink-0">
        <CardPreview card={card} color={color} fateColor={fateColor} />
      </div>
    </div>
  )
}

// --- Onglet ------------------------------------------------------------------

export function CardsTab({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  const [selId, setSelId] = useState<string | null>(draft.cards[0]?.id ?? null)
  const selected = draft.cards.find((c) => c.id === selId) ?? null

  const freeCardId = () => {
    let n = 1
    const taken = new Set(draft.cards.map((c) => c.id))
    while (taken.has(`${draft.id}-c${n}`)) n++
    return `${draft.id}-c${n}`
  }

  const addCard = (deck: DeckKind) => {
    const card = emptyCustomCard(freeCardId(), deck, deck === 'fate' ? 'hero' : 'ally')
    if (deck === 'villain') card.cost = 1
    if (card.type === 'ally' || card.type === 'hero') card.strength = 1
    patch({ cards: [...draft.cards, card] })
    setSelId(card.id)
  }

  const updateCard = (c: CustomCard) =>
    patch({ cards: draft.cards.map((x) => (x.id === c.id ? c : x)) })

  const removeCard = (id: string) => {
    patch({ cards: draft.cards.filter((c) => c.id !== id) })
    if (selId === id) setSelId(null)
  }

  const villainCards = draft.cards.filter((c) => c.deck === 'villain')
  const fateCards = draft.cards.filter((c) => c.deck === 'fate')

  const totalCopies = (cards: CustomCard[]) => cards.reduce((n, c) => n + c.copies, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Galerie */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addCard('villain')}
            className="rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/25"
          >
            + Carte Vilain
          </button>
          <button
            type="button"
            onClick={() => addCard('fate')}
            className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
          >
            + Carte Fatalité
          </button>
          <span className="ml-2 text-xs text-white/40">
            Deck Vilain : {totalCopies(villainCards)} carte(s) · Fatalité : {totalCopies(fateCards)}
          </span>
        </div>

        <CardRow title="Deck Vilain" cards={villainCards} selId={selId} onSelect={setSelId} onRemove={removeCard} color={draft.color} fateColor={draft.fateBackColor} />
        <CardRow title="Deck Fatalité" cards={fateCards} selId={selId} onSelect={setSelId} onRemove={removeCard} color={draft.color} fateColor={draft.fateBackColor} />
      </div>

      {/* Formulaire de la carte sélectionnée */}
      {selected ? (
        <div className="rounded-xl border border-white/15 bg-black/25 p-4">
          <CardForm card={selected} color={draft.color} fateColor={draft.fateBackColor} onChange={updateCard} />
        </div>
      ) : (
        <p className="text-white/50">Sélectionne une carte ou ajoutes-en une pour l’éditer.</p>
      )}
    </div>
  )
}

function CardRow({
  title,
  cards,
  selId,
  onSelect,
  onRemove,
  color,
  fateColor,
}: {
  title: string
  cards: CustomCard[]
  selId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  color: string
  fateColor: string
}) {
  if (cards.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</span>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cards.map((c) => (
          <div key={c.id} className="relative w-28 shrink-0">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`block w-full overflow-hidden rounded-lg border-2 transition ${
                selId === c.id ? 'border-amber-400' : 'border-transparent hover:border-white/30'
              }`}
            >
              <CardPreview card={c} color={color} fateColor={fateColor} />
              <span className="block truncate px-1 py-0.5 text-center text-[11px] text-white/70">
                {c.name} ×{c.copies}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(c.id)}
              className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white/70 transition hover:text-red-300"
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
