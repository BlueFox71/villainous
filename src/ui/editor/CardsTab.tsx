// Onglet « Cartes » de l'éditeur : galerie des cartes, formulaire d'édition (avec
// illustration auto-adaptée) et aperçu live. Le comportement mécanique de la carte
// n'est pas saisi ici : on décrit l'effet dans le TEXTE de la carte, puis on le code
// à la main au moment du test (comme un vilain classique).
import { useState } from 'react'
import type { CustomVillain, CustomCard } from '../../data/customVillain'
import { emptyCustomCard, FATE_CARD_COLOR } from '../../data/customVillain'
import type { CardType, DeckKind } from '../../data/types'
import { Field, TextField, NumberField, ImageField, SelectField, ColorField, ResetButton, inputClass } from './fields'
import { CardPreview } from './CardPreview'
import { CardLayoutEditor } from './CardLayout'
import { TYPE_LABEL, TYPE_COLOR } from './cardRender'
import { useCustomTypesStore } from '../store/customTypesStore'

/** Toutes les catégories MÉCANIQUES connues du moteur (libellés FR de référence). */
const ALL_TYPES: { value: CardType; label: string }[] = [
  { value: 'ally', label: TYPE_LABEL.ally },
  { value: 'item', label: TYPE_LABEL.item },
  { value: 'effect', label: TYPE_LABEL.effect },
  { value: 'condition', label: TYPE_LABEL.condition },
  { value: 'hero', label: TYPE_LABEL.hero },
  { value: 'curse', label: TYPE_LABEL.curse },
  { value: 'ingredient', label: TYPE_LABEL.ingredient },
]

/** Le coût s'applique aux cartes Vilain ; la force (de base) aux Alliés/Héros. */
const hasCost = (c: CustomCard) => c.deck === 'villain'
const hasStrength = (c: CustomCard) => c.type === 'ally' || c.type === 'hero'
/** Un Objet peut afficher une FORCE FACULTATIVE et SIGNÉE (+N / −N) : purement
 *  visuel (ex. « +2 Force au Héros porteur »). 0 / vide = pas d'étoile sur la carte. */
const isItem = (c: CustomCard) => c.type === 'item'

// --- Mots-clés colorés (niveau vilain) ---------------------------------------

/** Éditeur de MOTS-CLÉS colorés du vilain : chaque mot listé est coloré (à sa couleur)
 *  partout où il apparaît dans le texte des cartes, comme un nom de type. */
function KeywordColorsField({
  value,
  onChange,
}: {
  value: { label: string; color: string }[]
  onChange: (v: { label: string; color: string }[]) => void
}) {
  const [word, setWord] = useState('')
  const [col, setCol] = useState('#e0a53a')
  const list = value ?? []
  const add = () => {
    const w = word.trim()
    if (!w) return
    // Remplace une entrée existante du même mot (insensible à la casse).
    const rest = list.filter((k) => k.label.toLowerCase() !== w.toLowerCase())
    onChange([...rest, { label: w, color: col }])
    setWord('')
  }
  const remove = (label: string) => onChange(list.filter((k) => k.label !== label))
  return (
    <Field label="Mots-clés colorés (toutes les cartes)">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="Mot (ex. Corruption)"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <input
            type="color"
            value={col}
            onChange={(e) => setCol(e.target.value)}
            className="h-8 w-10 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent"
          />
          <button
            type="button"
            onClick={add}
            disabled={!word.trim()}
            className="shrink-0 rounded-lg border border-amber-300/50 px-3 py-1.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-40"
          >
            + Ajouter
          </button>
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {list.map((k) => (
              <span
                key={k.label}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-xs"
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: k.color }} />
                <span style={{ color: k.color }}>{k.label}</span>
                <button
                  type="button"
                  onClick={() => remove(k.label)}
                  className="text-white/40 transition hover:text-rose-300"
                  title="Retirer"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-white/40">
          Un mot par entrée. Toutes ses occurrences (singulier/pluriel, quelle que soit la casse) seront
          colorées dans le texte de <strong>toutes</strong> les cartes du vilain, comme un type.
        </p>
      </div>
    </Field>
  )
}

// --- Formulaire d'une carte --------------------------------------------------

function CardForm({
  card,
  color,
  fateColor,
  keywordColors = [],
  extraDecks,
  onChange,
}: {
  card: CustomCard
  color: string
  fateColor: string
  keywordColors?: { label: string; color: string }[]
  extraDecks: string[]
  onChange: (c: CustomCard) => void
}) {
  const set = (p: Partial<CustomCard>) => onChange({ ...card, ...p })

  // Cadrage de l'illustration : valeur courante (avec défauts) + maj partielle. Le
  // défaut est scale 1 (100 %), décalages 0 — cible des boutons « réinitialiser ».
  const at = card.artTransform ?? { scale: 1, offsetXPct: 0, offsetYPct: 0 }
  const setArt = (p: Partial<typeof at>) => set({ artTransform: { ...at, ...p } })

  // Paquet : Vilain, Fatalité, ou un paquet personnalisé (clé « g:<nom> »). Un paquet
  // perso est hors-deck (group renseigné) ; son `deck` ne sert qu'au STYLE de la carte
  // (Méchant ou Fatalité), choisi librement carte par carte (cf. sélecteur ci-dessous).
  const deckValue = card.group ? `g:${card.group}` : card.deck
  const deckOptions = [
    { value: 'villain', label: 'Vilain' },
    { value: 'fate', label: 'Fatalité' },
    ...extraDecks.map((d) => ({ value: `g:${d}`, label: d })),
  ]
  const onDeckChange = (v: string) => {
    if (v === 'villain') set({ deck: 'villain', group: undefined })
    else if (v === 'fate') set({ deck: 'fate', group: undefined })
    // Paquet perso : on garde le style (deck) actuel de la carte, on ne force plus Vilain.
    else set({ group: v.slice(2) })
  }

  // Bibliothèque de types réutilisables (globale, partagée entre vilains).
  const { types: savedTypes, addType, removeType } = useCustomTypesStore()
  const curTypeColor = card.typeColor ?? TYPE_COLOR[card.type]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Titre TOUJOURS en majuscules (cohérent avec le rendu de la carte). */}
          <TextField label="Nom" value={card.name.toUpperCase()} onChange={(name) => set({ name: name.toUpperCase() })} />
          <SelectField label="Paquet" value={deckValue} options={deckOptions} onChange={onDeckChange} />
        </div>
        {/* Paquet PERSO : on choisit librement le STYLE de la carte (Méchant ou Fatalité)
            — ex. le deck « Stand » contient des cartes des deux styles. */}
        {card.group && (
          <SelectField
            label="Style de carte"
            value={card.deck}
            options={[
              { value: 'villain', label: 'Méchant' },
              { value: 'fate', label: 'Fatalité' },
            ]}
            onChange={(v) => set({ deck: v as DeckKind })}
          />
        )}
        {/* TYPE AFFICHÉ sur la carte : nom libre + couleur (totalement indépendant de
            la catégorie moteur ci-dessous). Permet de créer un type inédit. */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Type (affiché sur la carte)"
            value={card.typeLabel ?? ''}
            onChange={(v) => set({ typeLabel: v.trim() ? v : undefined })}
            placeholder={TYPE_LABEL[card.type]}
          />
          <ColorField
            label="Couleur du type"
            value={curTypeColor}
            onChange={(typeColor) => set({ typeColor })}
          />
        </div>

        {/* Bibliothèque de types : mémoriser le type courant + réutiliser un type enregistré. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!card.typeLabel?.trim()}
              onClick={() => addType(card.typeLabel!.trim(), curTypeColor)}
              title="Enregistrer ce type (nom + couleur) pour le réutiliser partout"
              className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              💾 Mémoriser ce type
            </button>
            {savedTypes.length > 0 && <span className="text-[11px] text-white/40">Types enregistrés :</span>}
          </div>
          {savedTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedTypes.map((t) => (
                <span
                  key={t.label}
                  className="group flex items-center gap-1 rounded-full border border-white/15 bg-black/30 py-0.5 pl-2 pr-1 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => set({ typeLabel: t.label, typeColor: t.color })}
                    title="Appliquer ce type à la carte"
                    className="flex items-center gap-1.5 font-semibold"
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span style={{ color: t.color }}>{t.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeType(t.label)}
                    title="Oublier ce type"
                    className="ml-0.5 rounded px-1 text-white/30 transition hover:text-rose-300"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CATÉGORIE MOTEUR : indépendante du libellé. Sert au moteur (coût/force,
            ciblage Fatalité) et de base au comportement codé à la main. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Catégorie (moteur)"
            value={card.type}
            options={ALL_TYPES}
            // Changer de catégorie réinitialise le type affiché + sa couleur sur les
            // valeurs par défaut de cette catégorie.
            onChange={(type) => set({ type, typeLabel: TYPE_LABEL[type], typeColor: TYPE_COLOR[type] })}
          />
          {hasCost(card) && (
            // Coût avec option « sans coût » : décocher retire la pastille de coût de la
            // carte (`cost: undefined` → le rendu ne dessine pas l'icône).
            <Field label="Coût">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className={`${inputClass} w-16`}
                  value={card.cost ?? 0}
                  min={0}
                  max={9}
                  disabled={card.cost === undefined || !!card.costVariable}
                  onChange={(e) => set({ cost: Number(e.target.value) })}
                />
                <label className="flex cursor-pointer items-center gap-1 text-[11px] text-white/55">
                  <input
                    type="checkbox"
                    className="accent-amber-400"
                    checked={card.cost === undefined}
                    disabled={!!card.costVariable}
                    onChange={(e) => set({ cost: e.target.checked ? undefined : 1 })}
                  />
                  Sans coût
                </label>
                <label className="flex cursor-pointer items-center gap-1 text-[11px] text-white/55" title="Affiche « ? » (coût calculé en jeu, ex. = la Force du Héros ciblé)">
                  <input
                    type="checkbox"
                    className="accent-amber-400"
                    checked={!!card.costVariable}
                    onChange={(e) => set({ costVariable: e.target.checked, cost: e.target.checked ? (card.cost ?? 0) : card.cost })}
                  />
                  Coût variable (?)
                </label>
              </div>
            </Field>
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
          {isItem(card) && (
            <NumberField
              // Force affichée sur l'Objet : signée (+N / −N), facultative. 0 = pas d'étoile.
              label="Force (± , facultatif)"
              value={card.strength ?? 0}
              min={-20}
              max={20}
              onChange={(strength) => set({ strength: strength || undefined })}
            />
          )}
        </div>
        <p className="text-[11px] text-white/40">
          Le <strong>Type affiché</strong> est libre (ex. « Piratage ») et purement visuel. La{' '}
          <strong>Catégorie (moteur)</strong> détermine le comportement de base (coût, force,
          ciblage Fatalité) — choisis celle qui s’en rapproche le plus ; les effets propres au
          nouveau type se codent à la main au moment du test.
        </p>

        <TextField
          label="Texte de la carte"
          value={card.text}
          onChange={(text) => set({ text })}
          textarea
          placeholder="Décris l’effet de la carte ici. Le comportement sera codé au moment du test."
        />

        <div className="flex items-start gap-4">
          <ImageField
            label="Illustration"
            value={card.artImage}
            onChange={(artImage) => set({ artImage })}
            aspect="card"
          />
          <div className="flex flex-1 flex-col gap-2">
            <Field
              label={`Zoom illustration (${Math.round(at.scale * 100)} %)`}
              action={<ResetButton show={at.scale !== 1} onReset={() => setArt({ scale: 1 })} />}
            >
              <input
                type="range"
                min={50}
                max={250}
                value={at.scale * 100}
                onChange={(e) => setArt({ scale: Number(e.target.value) / 100 })}
                className="accent-amber-400"
              />
            </Field>
            <Field
              label="Décalage vertical"
              action={<ResetButton show={at.offsetYPct !== 0} onReset={() => setArt({ offsetYPct: 0 })} />}
            >
              <input
                type="range"
                min={-50}
                max={50}
                value={at.offsetYPct}
                onChange={(e) => setArt({ offsetYPct: Number(e.target.value) })}
                className="accent-amber-400"
              />
            </Field>
            <Field
              label="Décalage horizontal"
              action={<ResetButton show={at.offsetXPct !== 0} onReset={() => setArt({ offsetXPct: 0 })} />}
            >
              <input
                type="range"
                min={-50}
                max={50}
                value={at.offsetXPct}
                onChange={(e) => setArt({ offsetXPct: Number(e.target.value) })}
                className="accent-amber-400"
              />
            </Field>
          </div>
        </div>

      </div>

      {/* Aperçu interactif : glisser le texte et les symboles sur la carte */}
      <div className="w-72 shrink-0">
        <CardLayoutEditor card={card} color={color} fateColor={fateColor} keywordColors={keywordColors} onChange={onChange} />
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

  const addCard = (deck: DeckKind, group?: string) => {
    const card = emptyCustomCard(freeCardId(), deck, deck === 'fate' ? 'hero' : 'ally')
    if (deck === 'villain') card.cost = 1
    if (card.type === 'ally' || card.type === 'hero') card.strength = 1
    if (group) card.group = group
    patch({ cards: [...draft.cards, card] })
    setSelId(card.id)
  }

  const updateCard = (c: CustomCard) =>
    patch({ cards: draft.cards.map((x) => (x.id === c.id ? c : x)) })

  const removeCard = (id: string) => {
    patch({ cards: draft.cards.filter((c) => c.id !== id) })
    if (selId === id) setSelId(null)
  }

  // --- Paquets personnalisés (hors Vilain/Fatalité) --------------------------
  const extraDecks = draft.extraDecks ?? []
  const addExtraDeck = () => {
    const name = prompt('Nom du nouveau paquet (ex. « Transformation », « Stands », « Maui ») :')?.trim()
    if (!name) return
    if (extraDecks.some((d) => d.toLowerCase() === name.toLowerCase())) {
      alert('Un paquet porte déjà ce nom.')
      return
    }
    patch({ extraDecks: [...extraDecks, name] })
  }
  const removeExtraDeck = (name: string) => {
    const inDeck = draft.cards.filter((c) => c.group === name)
    if (
      inDeck.length > 0 &&
      !confirm(`Supprimer le paquet « ${name} » ? Ses ${inDeck.length} carte(s) repasseront dans le deck Vilain.`)
    )
      return
    patch({
      extraDecks: extraDecks.filter((d) => d !== name),
      cards: draft.cards.map((c) => (c.group === name ? { ...c, group: undefined } : c)),
    })
  }

  const villainCards = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  const fateCards = draft.cards.filter((c) => c.deck === 'fate' && !c.group)

  return (
    <div className="flex flex-col gap-6">
      {/* Mots-clés colorés — réglage du vilain, appliqué au texte de toutes ses cartes. */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <KeywordColorsField
          value={draft.keywordColors ?? []}
          onChange={(keywordColors) => patch({ keywordColors })}
        />
      </div>

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
          <button
            type="button"
            onClick={addExtraDeck}
            title="Créer un paquet hors-deck (Transformation, Stands, Maui…)"
            className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20"
          >
            + Paquet perso
          </button>
          <span className="ml-2 text-xs text-white/40">
            Deck Vilain : {villainCards.length} modèle(s) · Fatalité : {fateCards.length} — quantités dans l’onglet « Quantité »
          </span>
        </div>

        <CardRow title="Deck Vilain" cards={villainCards} selId={selId} onSelect={setSelId} onRemove={removeCard} color={draft.color} fateColor={FATE_CARD_COLOR} keywordColors={draft.keywordColors} />
        <CardRow title="Deck Fatalité" cards={fateCards} selId={selId} onSelect={setSelId} onRemove={removeCard} color={draft.color} fateColor={FATE_CARD_COLOR} keywordColors={draft.keywordColors} />

        {/* Paquets personnalisés (hors-deck) */}
        {extraDecks.map((name) => (
          <div key={name} className="flex flex-col gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/80">
                Paquet perso — {name}
              </span>
              <button
                type="button"
                onClick={() => addCard('villain', name)}
                className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
              >
                + Méchant
              </button>
              <button
                type="button"
                onClick={() => addCard('fate', name)}
                className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20"
              >
                + Fatalité
              </button>
              <button
                type="button"
                onClick={() => removeExtraDeck(name)}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/50 transition hover:border-rose-400/60 hover:text-rose-300"
              >
                Supprimer le paquet
              </button>
            </div>
            <CardRow
              cards={draft.cards.filter((c) => c.group === name)}
              selId={selId}
              onSelect={setSelId}
              onRemove={removeCard}
              color={draft.color}
              fateColor={FATE_CARD_COLOR}
              keywordColors={draft.keywordColors}
              emptyHint="Aucune carte : « + Carte » pour en ajouter."
            />
          </div>
        ))}
      </div>

      {/* Formulaire de la carte sélectionnée */}
      {selected ? (
        <div className="rounded-xl border border-white/15 bg-black/25 p-4">
          <CardForm
            card={selected}
            color={draft.color}
            fateColor={FATE_CARD_COLOR}
            keywordColors={draft.keywordColors}
            extraDecks={extraDecks}
            onChange={updateCard}
          />
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
  keywordColors = [],
  emptyHint,
}: {
  title?: string
  cards: CustomCard[]
  selId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  color: string
  fateColor: string
  keywordColors?: { label: string; color: string }[]
  emptyHint?: string
}) {
  if (cards.length === 0) {
    if (emptyHint) return <p className="text-[11px] text-white/40">{emptyHint}</p>
    return null
  }
  return (
    <div className="flex flex-col gap-2">
      {title && <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</span>}
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
              <CardPreview card={c} color={color} fateColor={fateColor} keywordColors={keywordColors} />
              <span className="block truncate px-1 py-0.5 text-center text-[11px] text-white/70">
                {c.name}
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
