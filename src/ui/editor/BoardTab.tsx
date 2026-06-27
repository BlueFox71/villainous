// Onglet « Plateau » de l'éditeur : lieux, actions (type + rangée), images de
// lieux, image de plateau et pion, avec un aperçu schématique du plateau.
import { useEffect, useState } from 'react'
import type { CustomVillain, CustomLocation, CustomAction } from '../../data/customVillain'
import type { ActionRow, LocationActionType } from '../../engine/types'
import { Field, NumberField, ImageField, SelectField, inputClass } from './fields'
import { renderBoard } from './boardRender'

/** Types d'action GÉNÉRIQUES exposés à l'éditeur (tous gérés génériquement par le
 *  moteur, sans mécanique propre à un vilain). On exclut les actions spéciales
 *  (BREW_POISON, OBTAIN_KEY…) qui supposent une mécanique dédiée. */
const ACTION_TYPES: { value: LocationActionType; label: string; defaultLabel: string }[] = [
  { value: 'GAIN_POWER', label: 'Gagner du pouvoir', defaultLabel: 'Gagner du pouvoir' },
  { value: 'PLAY_CARD', label: 'Jouer une carte', defaultLabel: 'Jouer une carte' },
  { value: 'FATE', label: 'Fatalité', defaultLabel: 'Fatalité' },
  { value: 'MOVE_ITEM_ALLY', label: 'Déplacer un objet/allié', defaultLabel: 'Déplacer un objet ou un allié' },
  { value: 'MOVE_HERO', label: 'Déplacer un héros', defaultLabel: 'Déplacer un héros' },
  { value: 'VANQUISH', label: 'Vaincre un héros', defaultLabel: 'Vaincre un héros' },
  { value: 'DISCARD_CARDS', label: 'Défausser', defaultLabel: 'Défausser des cartes' },
  { value: 'ACTIVATE', label: 'Activer une capacité', defaultLabel: 'Activer une capacité' },
]

const ROW_OPTIONS: { value: ActionRow; label: string }[] = [
  { value: 'top', label: 'Haut' },
  { value: 'bottom', label: 'Bas' },
]

/** Libellé par défaut d'une action selon son type (et son montant). */
function defaultLabelFor(type: LocationActionType, amount?: number): string {
  if (type === 'GAIN_POWER') return `Gagner ${amount ?? 1} pouvoir`
  return ACTION_TYPES.find((t) => t.value === type)?.defaultLabel ?? type
}

/** Identifiant d'action libre au sein d'un lieu (act1, act2…). */
function freeActionId(loc: CustomLocation): string {
  let n = 1
  const taken = new Set(loc.actions.map((a) => a.id))
  while (taken.has(`act${n}`)) n++
  return `act${n}`
}

// --- Éditeur d'une action ----------------------------------------------------

function ActionEditor({
  action,
  onChange,
  onRemove,
}: {
  action: CustomAction
  onChange: (a: CustomAction) => void
  onRemove: () => void
}) {
  // Le libellé est dérivé du type par défaut, mais reste éditable manuellement.
  const setType = (type: LocationActionType) =>
    onChange({ ...action, type, label: defaultLabelFor(type, action.amount) })
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <SelectField label="Action" value={action.type} options={ACTION_TYPES} onChange={setType} />
      <SelectField
        label="Rangée"
        value={action.row}
        options={ROW_OPTIONS}
        onChange={(row) => onChange({ ...action, row })}
      />
      {action.type === 'GAIN_POWER' && (
        <NumberField
          label="Montant"
          value={action.amount ?? 1}
          min={1}
          max={9}
          onChange={(amount) => onChange({ ...action, amount, label: defaultLabelFor('GAIN_POWER', amount) })}
        />
      )}
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Libellé</span>
        <input
          className={inputClass}
          value={action.label}
          onChange={(e) => onChange({ ...action, label: e.target.value })}
        />
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs text-white/50 transition hover:border-red-400/60 hover:text-red-300"
        title="Supprimer cette action"
      >
        🗑
      </button>
    </div>
  )
}

// --- Éditeur d'un lieu -------------------------------------------------------

function LocationEditor({
  loc,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  loc: CustomLocation
  index: number
  total: number
  onChange: (l: CustomLocation) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const setAction = (i: number, a: CustomAction) =>
    onChange({ ...loc, actions: loc.actions.map((x, j) => (j === i ? a : x)) })
  const addAction = () =>
    onChange({
      ...loc,
      actions: [
        ...loc.actions,
        { id: freeActionId(loc), type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
      ],
    })
  const removeAction = (i: number) =>
    onChange({ ...loc, actions: loc.actions.filter((_, j) => j !== i) })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/15 bg-black/25 p-4">
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Lieu {index + 1}
          </span>
          <input
            className={inputClass}
            value={loc.name}
            onChange={(e) => onChange({ ...loc, name: e.target.value })}
          />
        </label>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs text-white/60 transition enabled:hover:text-amber-200 disabled:opacity-30"
          title="Monter"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs text-white/60 transition enabled:hover:text-amber-200 disabled:opacity-30"
          title="Descendre"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={total <= 1}
          className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs text-white/50 transition enabled:hover:border-red-400/60 enabled:hover:text-red-300 disabled:opacity-30"
          title="Supprimer ce lieu"
        >
          🗑
        </button>
      </div>

      <ImageField
        label="Image du lieu"
        value={loc.image}
        onChange={(image) => onChange({ ...loc, image })}
        aspect="board"
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Actions ({loc.actions.length})
        </span>
        {loc.actions.map((a, i) => (
          <ActionEditor
            key={a.id}
            action={a}
            onChange={(na) => setAction(i, na)}
            onRemove={() => removeAction(i)}
          />
        ))}
        <button
          type="button"
          onClick={addAction}
          className="self-start rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:text-amber-200"
        >
          + Ajouter une action
        </button>
      </div>
    </div>
  )
}

// --- Aperçu rendu du plateau (template Realm) -------------------------------

function BoardPreview({ v }: { v: CustomVillain }) {
  const [src, setSrc] = useState<string | null>(null)
  // Re-rend quand un champ visuel du plateau change (débanché).
  const key = JSON.stringify({
    c: v.color,
    n: v.name,
    o: v.boardObjective,
    art: (v.presentation ?? v.portrait)?.slice(0, 48),
    locs: v.locations.map((l) => ({
      n: l.name,
      i: l.image?.slice(0, 48),
      a: l.actions.map((x) => ({ t: x.type, r: x.row, m: x.amount })),
    })),
  })
  useEffect(() => {
    let alive = true
    const h = setTimeout(() => {
      void renderBoard(v).then((url) => alive && setSrc(url))
    }, 300)
    return () => {
      alive = false
      clearTimeout(h)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      {src ? (
        <img src={src} alt="Aperçu du plateau" className="w-full" />
      ) : (
        <div className="flex h-40 items-center justify-center text-white/30">Génération de l’aperçu…</div>
      )}
    </div>
  )
}

// --- Onglet ------------------------------------------------------------------

export function BoardTab({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  const setLoc = (i: number, l: CustomLocation) =>
    patch({ locations: draft.locations.map((x, j) => (j === i ? l : x)) })
  const addLoc = () => {
    const id = `loc-${Date.now().toString(36)}`
    patch({
      locations: [
        ...draft.locations,
        {
          id,
          name: `Lieu ${draft.locations.length + 1}`,
          actions: [
            { id: 'act1', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' },
            { id: 'act2', type: 'PLAY_CARD', row: 'top', label: 'Jouer une carte' },
            { id: 'act3', type: 'FATE', row: 'bottom', label: 'Fatalité' },
            { id: 'act4', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
          ],
        },
      ],
    })
  }
  const removeLoc = (i: number) => patch({ locations: draft.locations.filter((_, j) => j !== i) })
  const moveLoc = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= draft.locations.length) return
    const next = [...draft.locations]
    ;[next[i], next[j]] = [next[j], next[i]]
    patch({ locations: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <BoardPreview v={draft} />

      <p className="text-xs text-white/45">
        Le plateau est <strong>généré</strong> à partir du gabarit neutre « Realm » : couleur du
        vilain, illustrations de lieux et icônes d’action. Ajoute une image par lieu ci-dessous.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-start gap-4">
          <ImageField
            label="Pion"
            value={draft.pawnImage}
            onChange={(pawnImage) => patch({ pawnImage })}
            aspect="pawn"
          />
          <Field label="Hauteur du pion (px)">
            <input
              type="range"
              min={32}
              max={96}
              value={draft.pawnHeightPx}
              onChange={(e) => patch({ pawnHeightPx: Number(e.target.value) })}
              className="accent-amber-400"
            />
            <span className="text-xs text-white/50">{draft.pawnHeightPx} px</span>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {draft.locations.map((loc, i) => (
          <LocationEditor
            key={loc.id}
            loc={loc}
            index={i}
            total={draft.locations.length}
            onChange={(l) => setLoc(i, l)}
            onRemove={() => removeLoc(i)}
            onMove={(dir) => moveLoc(i, dir)}
          />
        ))}
        <button
          type="button"
          onClick={addLoc}
          className="self-start rounded-xl border border-amber-400/50 bg-amber-400/15 px-4 py-2 font-semibold text-amber-100 transition hover:bg-amber-400/25"
        >
          + Ajouter un lieu
        </button>
      </div>
    </div>
  )
}
