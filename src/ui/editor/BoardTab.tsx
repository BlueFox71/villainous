// Onglet « Plateau » de l'éditeur : lieux, actions (type + rangée), images de
// lieux, image de plateau et pion, avec un aperçu schématique du plateau.
import { useEffect, useState } from 'react'
import type { CustomVillain, CustomLocation, CustomAction } from '../../data/customVillain'
import type { ActionRow, LocationActionType } from '../../engine/types'
import { Field, TextField, NumberField, ImageField, SelectField, inputClass } from './fields'
import { renderBoard } from './boardRender'
import { PAWN_FIRST_LEFT, PAWN_TOP } from '../components/BoardImage'

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
  // Le libellé est dérivé automatiquement du type (et du montant pour GAIN_POWER).
  const setType = (type: LocationActionType) =>
    onChange({ ...action, type, label: defaultLabelFor(type, action.amount) })
  return (
    <div className="flex items-end gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <SelectField label="Action" value={action.type} options={ACTION_TYPES} onChange={setType} />
      {action.type === 'GAIN_POWER' && (
        <NumberField
          label="Pouvoir"
          value={action.amount ?? 1}
          min={1}
          max={3}
          onChange={(amount) => onChange({ ...action, amount, label: defaultLabelFor('GAIN_POWER', amount) })}
        />
      )}
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
  onMove,
}: {
  loc: CustomLocation
  index: number
  total: number
  onChange: (l: CustomLocation) => void
  onMove: (dir: -1 | 1) => void
}) {
  const setAction = (i: number, a: CustomAction) =>
    onChange({ ...loc, actions: loc.actions.map((x, j) => (j === i ? a : x)) })
  const addActionToRow = (row: ActionRow) =>
    onChange({
      ...loc,
      actions: [
        ...loc.actions,
        { id: freeActionId(loc), type: 'GAIN_POWER', amount: 1, row, label: defaultLabelFor('GAIN_POWER', 1) },
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
            value={loc.name.toUpperCase()}
            onChange={(e) => onChange({ ...loc, name: e.target.value.toUpperCase() })}
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
      </div>

      <ImageField
        label="Image du lieu"
        value={loc.image}
        onChange={(image) => onChange({ ...loc, image })}
        aspect="board"
        crop={{
          pos: loc.imagePos ?? { x: 50, y: 50 },
          onChange: (imagePos) => onChange({ ...loc, imagePos }),
        }}
      />

      {/* Actions réparties en deux rangées (haut / bas), 2 à 3 par rangée. */}
      <div className="flex flex-col gap-3">
        {(['top', 'bottom'] as ActionRow[]).map((row) => {
          const max = row === 'top' ? 2 : 3
          const entries = loc.actions
            .map((a, i) => ({ a, i }))
            .filter((e) => e.a.row === row)
          return (
            <div key={row} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/15 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  {row === 'top' ? 'Rangée du haut' : 'Rangée du bas'} ({entries.length}/{max})
                </span>
                <button
                  type="button"
                  onClick={() => addActionToRow(row)}
                  disabled={entries.length >= max}
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 transition enabled:hover:text-amber-200 disabled:opacity-30"
                >
                  + Action
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {entries.length === 0 && (
                  <span className="px-1 text-xs text-white/30">Aucune action</span>
                )}
                {entries.map(({ a, i }) => (
                  <ActionEditor
                    key={a.id}
                    action={a}
                    onChange={(na) => setAction(i, na)}
                    onRemove={() => removeAction(i)}
                  />
                ))}
              </div>
            </div>
          )
        })}
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
    art: v.boardArt?.slice(0, 48),
    pp: v.portraitPos,
    locs: v.locations.map((l) => ({
      n: l.name,
      i: l.image?.slice(0, 48),
      ip: l.imagePos,
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
  // Hauteur du pion en % de la hauteur du plateau (responsive). On calque la
  // proportion du jeu : pawnHeightPx est calibré pour un plateau d'environ 290 px
  // de haut (≈ 1000 px de large pour ce gabarit 4455×1248).
  const PAWN_REF_H = 290
  const pawnPct = (v.pawnHeightPx / PAWN_REF_H) * 100
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
      {src ? (
        <img src={src} alt="Aperçu du plateau" className="w-full" />
      ) : (
        <div className="flex h-40 items-center justify-center text-white/30">Génération de l’aperçu…</div>
      )}
      {/* Pion superposé (visualisation) : placé EXACTEMENT comme en jeu (centré sur la
          1re case : PAWN_FIRST_LEFT / PAWN_TOP). */}
      {src && v.pawnImage && (
        <img
          src={v.pawnImage}
          alt="Pion"
          title="Pion (aperçu de placement)"
          className="pointer-events-none absolute w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
          style={{ left: `${PAWN_FIRST_LEFT}%`, top: `${PAWN_TOP}%`, height: `${pawnPct}%` }}
        />
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

      <TextField
        label="Objectif (texte du plateau)"
        value={draft.boardObjective}
        onChange={(boardObjective) => patch({ boardObjective })}
        textarea
        placeholder="Ex. : Atteignez 20 jetons Pouvoir au début de votre tour."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-start gap-4">
          <ImageField
            label="Pion"
            value={draft.pawnImage}
            onChange={(pawnImage) => patch({ pawnImage })}
            aspect="pawn"
            fit="contain"
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

        {/* Illustration du vilain sur le plateau (panneau de gauche) : image dédiée,
            choisie et cadrée comme un lieu. */}
        <ImageField
          label="Image du vilain (plateau)"
          value={draft.boardArt}
          onChange={(boardArt) => patch({ boardArt })}
          aspect="portrait"
          crop={{
            pos: draft.portraitPos ?? { x: 50, y: 50 },
            onChange: (portraitPos) => patch({ portraitPos }),
          }}
        />
      </div>

      <div className="flex flex-col gap-4">
        {draft.locations.map((loc, i) => (
          <LocationEditor
            key={loc.id}
            loc={loc}
            index={i}
            total={draft.locations.length}
            onChange={(l) => setLoc(i, l)}
            onMove={(dir) => moveLoc(i, dir)}
          />
        ))}
      </div>
    </div>
  )
}
