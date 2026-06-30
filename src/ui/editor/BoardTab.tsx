// Onglet « Plateau » de l'éditeur : lieux, actions (type + rangée), images de
// lieux, image de plateau et pion, avec un aperçu schématique du plateau.
import { useEffect, useRef, useState } from 'react'
import type { CustomVillain, CustomLocation, CustomAction, BoardLock } from '../../data/customVillain'
import { DEFAULT_BOARD_LOCK_SIZE } from '../../data/customVillain'
import type { ActionRow, LocationActionType } from '../../engine/types'
import { Field, TextField, NumberField, ImageField, SelectField, inputClass } from './fields'
import { renderBoard } from './boardRender'
import { loadImage } from './imageUtils'
import { BOARD_W, BOARD_H } from './boardLayout'
import { Hotspot } from './CardLayout'
import { PAWN_FIRST_LEFT, PAWN_TOP, LOCATIONS_LEFT, PAWN_STEP } from '../components/BoardImage'

const LOCK_SRC = '/cards/jafar/lock.png'
const BOARD_ASPECT = BOARD_W / BOARD_H
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** État d'un glisser (déplacement ou redimensionnement) d'un cadenas décoratif. */
interface LockDrag {
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  rectW: number
  rectH: number
  ox: number
  oy: number
  osize: number
}

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

/** Identifiant d'action libre au sein d'une liste d'actions (act1, act2…). */
function freeActionId(actions: CustomAction[]): string {
  let n = 1
  const taken = new Set(actions.map((a) => a.id))
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

// --- Éditeur des actions (réutilisé par la face A ET la face B) --------------

function ActionsEditor({ actions, onChange }: { actions: CustomAction[]; onChange: (a: CustomAction[]) => void }) {
  const setAction = (i: number, a: CustomAction) => onChange(actions.map((x, j) => (j === i ? a : x)))
  const addActionToRow = (row: ActionRow) =>
    onChange([
      ...actions,
      { id: freeActionId(actions), type: 'GAIN_POWER', amount: 1, row, label: defaultLabelFor('GAIN_POWER', 1) },
    ])
  const removeAction = (i: number) => onChange(actions.filter((_, j) => j !== i))
  return (
    <div className="flex flex-col gap-3">
      {(['top', 'bottom'] as ActionRow[]).map((row) => {
        const max = row === 'top' ? 2 : 3
        const entries = actions.map((a, i) => ({ a, i })).filter((e) => e.a.row === row)
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
              {entries.length === 0 && <span className="px-1 text-xs text-white/30">Aucune action</span>}
              {entries.map(({ a, i }) => (
                <ActionEditor key={a.id} action={a} onChange={(na) => setAction(i, na)} onRemove={() => removeAction(i)} />
              ))}
            </div>
          </div>
        )
      })}
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
  // Active/désactive la face B (lieu transformable). À l'activation, la face B part
  // d'une copie de la face A (nom/image/actions) que l'utilisateur modifie ensuite.
  const toggleAlt = () =>
    onChange(
      loc.alt
        ? { ...loc, alt: undefined }
        : {
            ...loc,
            alt: {
              name: loc.name,
              image: loc.image,
              imagePos: loc.imagePos,
              actions: loc.actions.map((a) => ({ ...a })),
            },
          },
    )
  const setAlt = (p: Partial<NonNullable<CustomLocation['alt']>>) =>
    onChange({ ...loc, alt: { ...(loc.alt ?? {}), ...p } })

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
          onClick={toggleAlt}
          aria-pressed={!!loc.alt}
          className={`rounded-lg border px-2 py-2 text-xs transition ${
            loc.alt
              ? 'border-sky-400/70 bg-sky-400/20 text-sky-200'
              : 'border-white/15 bg-white/5 text-white/40 hover:text-sky-200'
          }`}
          title={
            loc.alt
              ? 'Face B active — clique pour la retirer. (Une carte avec l’effet « Transformer un lieu » bascule entre face A et B en jeu.)'
              : 'Ajouter une FACE B à ce lieu (nom/image/actions alternatifs, activés par une carte en jeu)'
          }
        >
          {loc.alt ? '⇄ B' : '+ B'}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...loc, lockedAtStart: !loc.lockedAtStart })}
          aria-pressed={loc.lockedAtStart ?? false}
          className={`rounded-lg border px-2 py-2 text-xs transition ${
            loc.lockedAtStart
              ? 'border-amber-400/70 bg-amber-400/20 text-amber-200'
              : 'border-white/15 bg-white/5 text-white/40 hover:text-amber-200'
          }`}
          title={
            loc.lockedAtStart
              ? 'Lieu VERROUILLÉ au départ — clique pour l’ouvrir. (Un effet « Déverrouiller un lieu » sur une carte peut le rouvrir en partie.)'
              : 'Verrouiller ce lieu à la mise en place (voile + cadenas, actions bloquées tant qu’il n’est pas ouvert)'
          }
        >
          {loc.lockedAtStart ? '🔒' : '🔓'}
        </button>
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

      {/* Face A (par défaut). */}
      <ImageField
        label={loc.alt ? 'Image du lieu — Face A' : 'Image du lieu'}
        value={loc.image}
        onChange={(image) => onChange({ ...loc, image })}
        aspect="board"
        crop={{
          pos: loc.imagePos ?? { x: 50, y: 50 },
          onChange: (imagePos) => onChange({ ...loc, imagePos }),
        }}
      />
      <ActionsEditor actions={loc.actions} onChange={(actions) => onChange({ ...loc, actions })} />

      {/* Face B (lieu transformable) : nom / image / actions alternatifs. */}
      {loc.alt && (
        <div className="flex flex-col gap-3 rounded-lg border border-sky-400/30 bg-sky-400/5 p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/80">
            Face B (transformation)
          </span>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Nom (face B)</span>
            <input
              className={inputClass}
              value={(loc.alt.name ?? '').toUpperCase()}
              onChange={(e) => setAlt({ name: e.target.value.toUpperCase() })}
            />
          </label>
          <ImageField
            label="Image du lieu — Face B"
            value={loc.alt.image}
            onChange={(image) => setAlt({ image })}
            aspect="board"
            crop={{
              pos: loc.alt.imagePos ?? { x: 50, y: 50 },
              onChange: (imagePos) => setAlt({ imagePos }),
            }}
          />
          <ActionsEditor actions={loc.alt.actions ?? []} onChange={(actions) => setAlt({ actions })} />
        </div>
      )}
    </div>
  )
}

// --- Aperçu rendu du plateau (template Realm) -------------------------------

function BoardPreview({
  v,
  onChangeLocks,
}: {
  v: CustomVillain
  onChangeLocks: (locks: BoardLock[]) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [lockAspect, setLockAspect] = useState(1) // hauteur/largeur du cadenas
  const [sel, setSel] = useState<string | null>(null)
  const [previewB, setPreviewB] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<LockDrag | null>(null)
  const locks = v.boardLocks ?? []
  // Y a-t-il une variante à prévisualiser (face B d'un lieu ou objectif alternatif) ?
  const hasVariants = v.locations.some((l) => l.alt) || !!v.altObjective
  const showB = previewB && hasVariants
  // Plateau d'APERÇU : en mode « Face B », on applique la face B des lieux transformables
  // + l'image/texte de l'objectif alternatif, pour voir le plateau APRÈS transformation.
  const previewV: CustomVillain = showB
    ? {
        ...v,
        boardObjective: v.altObjective?.boardObjective ?? v.boardObjective,
        boardArt: v.altObjective?.boardArt ?? v.boardArt,
        portraitPos: v.altObjective?.portraitPos ?? v.portraitPos,
        locations: v.locations.map((l) =>
          l.alt
            ? {
                ...l,
                name: l.alt.name || l.name,
                image: l.alt.image ?? l.image,
                imagePos: l.alt.imagePos ?? l.imagePos,
                actions: l.alt.actions ?? l.actions,
              }
            : l,
        ),
      }
    : v
  // Re-rend quand un champ visuel du plateau change (débanché). Les cadenas
  // décoratifs ne sont PAS bakés ici (skipLocks) : ils sont en overlay live.
  const key = JSON.stringify({
    b: showB,
    c: previewV.color,
    n: previewV.name,
    o: previewV.boardObjective,
    art: previewV.boardArt?.slice(0, 48),
    pp: previewV.portraitPos,
    locs: previewV.locations.map((l) => ({
      n: l.name,
      i: l.image?.slice(0, 48),
      ip: l.imagePos,
      a: l.actions.map((x) => ({ t: x.type, r: x.row, m: x.amount })),
    })),
  })
  useEffect(() => {
    let alive = true
    const h = setTimeout(() => {
      void renderBoard(previewV, { skipLocks: true }).then((url) => alive && setSrc(url))
    }, 300)
    return () => {
      alive = false
      clearTimeout(h)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  // Ratio réel du cadenas (pour dimensionner la poignée de drag).
  useEffect(() => {
    let alive = true
    void loadImage(LOCK_SRC).then((img) => alive && setLockAspect(img.height / img.width)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  // Hauteur du pion en % de la hauteur du plateau (responsive). On calque la
  // proportion du jeu : pawnHeightPx est calibré pour un plateau d'environ 290 px
  // de haut (≈ 1000 px de large pour ce gabarit 4455×1248).
  const PAWN_REF_H = 290
  const pawnPct = (v.pawnHeightPx / PAWN_REF_H) * 100

  const setLock = (id: string, p: Partial<BoardLock>) =>
    onChangeLocks(locks.map((l) => (l.id === id ? { ...l, ...p } : l)))
  const removeLock = (id: string) => {
    onChangeLocks(locks.filter((l) => l.id !== id))
    setSel(null)
  }
  const startDrag = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    const l = locks.find((x) => x.id === id)
    if (!rect || !l) return
    setSel(id)
    dragRef.current = { id, mode, startX: e.clientX, startY: e.clientY, rectW: rect.width, rectH: rect.height, ox: l.x, oy: l.y, osize: l.size }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dxPctW = ((e.clientX - d.startX) / d.rectW) * 100
    const dyPctH = ((e.clientY - d.startY) / d.rectH) * 100
    if (d.mode === 'move') {
      setLock(d.id, { x: clamp(d.ox + dxPctW, 1, 99), y: clamp(d.oy + dyPctH, 1, 99) })
    } else {
      setLock(d.id, { size: clamp(d.osize + (dxPctW + dyPctH) / 2, 2, 40) })
    }
  }
  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerDown={() => setSel(null)}
      className="relative select-none overflow-hidden rounded-xl border border-white/10 bg-black/40"
    >
      {src ? (
        <img src={src} alt="Aperçu du plateau" className="pointer-events-none w-full" />
      ) : (
        <div className="flex h-40 items-center justify-center text-white/30">Génération de l’aperçu…</div>
      )}
      {/* Bascule d'aperçu Face A / Face B (visible seulement s'il y a une variante). */}
      {hasVariants && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPreviewB((b) => !b)}
          className={`absolute right-2 top-2 z-20 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-lg transition ${
            showB
              ? 'border-sky-300/70 bg-sky-500/80 text-white'
              : 'border-white/30 bg-black/60 text-white/80 hover:bg-black/80'
          }`}
          title="Prévisualiser le plateau APRÈS transformation (faces B des lieux + objectif alternatif)"
        >
          {showB ? '👁 Face B' : '👁 Face A'}
        </button>
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
      {/* Lieux VERROUILLÉS : voile + cadenas centré automatique, EXACTEMENT comme en
          jeu (cf. BoardImage), pour visualiser le placement pendant l'édition. */}
      {src &&
        v.locations.map((loc, i) =>
          loc.lockedAtStart ? (
            <div
              key={`lock-${loc.id}`}
              className="pointer-events-none absolute z-[5] flex items-center justify-center rounded-lg bg-black/55 backdrop-grayscale"
              style={{
                left: `${LOCATIONS_LEFT + i * PAWN_STEP}%`,
                top: '8.7%',
                width: '20.1%',
                height: '70.5%',
              }}
              title={`Lieu verrouillé — ${loc.name}`}
            >
              <img src={LOCK_SRC} alt="Lieu verrouillé" className="w-1/5 opacity-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" />
            </div>
          ) : null,
        )}
      {/* Cadenas DÉCORATIFS posés librement : image live (réactive) + poignée de drag. */}
      {src &&
        locks.map((l) => {
          const heightPct = l.size * lockAspect * BOARD_ASPECT
          return (
            <div key={l.id}>
              {/* z-[4] : SOUS le voile noir des lieux verrouillés (z-[5]) — le cadenas
                  déco est au niveau des actions (bakées dans l'image), donc derrière le
                  voile, EXACTEMENT comme en jeu. */}
              <img
                src={LOCK_SRC}
                alt="Cadenas"
                className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.size}%` }}
              />
              <Hotspot
                left={l.x - l.size / 2}
                top={l.y - heightPct / 2}
                width={l.size}
                height={heightPct}
                selected={sel === l.id}
                onDown={(e) => startDrag(e, l.id, 'move')}
                onResize={(e) => startDrag(e, l.id, 'resize')}
                onDelete={() => removeLock(l.id)}
              />
            </div>
          )
        })}
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
  const addBoardLock = () => {
    const locks = draft.boardLocks ?? []
    const taken = new Set(locks.map((l) => l.id))
    let n = 1
    while (taken.has(`blk-${n}`)) n++
    patch({ boardLocks: [...locks, { id: `blk-${n}`, x: 50, y: 40, size: DEFAULT_BOARD_LOCK_SIZE }] })
  }

  return (
    <div className="flex flex-col gap-6">
      <BoardPreview v={draft} onChangeLocks={(boardLocks) => patch({ boardLocks })} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addBoardLock}
          className="rounded-lg border border-amber-300/50 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
        >
          🔒 Ajouter un cadenas
        </button>
        <span className="text-xs text-white/45">
          Cadenas décoratif posé librement : glisse-le pour le placer, la poignée du coin pour le
          redimensionner, la croix pour le retirer. (Indépendant du cadenas automatique des lieux
          verrouillés.)
        </span>
      </div>

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

      <AltObjectiveEditor draft={draft} patch={patch} />
    </div>
  )
}

// --- Objectif alternatif (face B) -------------------------------------------

/** Bloc « Objectif alternatif » : second objectif (image vilain + texte + seuil de
 *  pouvoir) activable en jeu par une carte (effet « Changer d'objectif »), façon
 *  Ratigan. La condition se limite au seuil de Pouvoir (seul type éditable dans
 *  l'Atelier ; l'objectif principal l'est aussi). */
function AltObjectiveEditor({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  const alt = draft.altObjective
  const enable = () =>
    patch({
      altObjective: {
        boardObjective: draft.boardObjective,
        objectiveDescription: draft.objectiveDescription,
        objective: { type: 'POWER_THRESHOLD', threshold: 30 },
        boardArt: draft.boardArt,
        portraitPos: draft.portraitPos,
      },
    })
  const disable = () => patch({ altObjective: undefined, altBoardImage: undefined })
  const setAlt = (p: Partial<NonNullable<CustomVillain['altObjective']>>) =>
    patch({ altObjective: { ...alt!, ...p } })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200/80">
          Objectif alternatif (transformation)
        </span>
        <button
          type="button"
          onClick={alt ? disable : enable}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
            alt
              ? 'border-fuchsia-400/60 bg-fuchsia-400/15 text-fuchsia-100 hover:bg-fuchsia-400/25'
              : 'border-white/15 bg-white/5 text-white/60 hover:text-fuchsia-200'
          }`}
        >
          {alt ? '✓ Activé — retirer' : '+ Ajouter un 2ᵉ objectif'}
        </button>
      </div>
      {!alt ? (
        <span className="text-xs text-white/45">
          Second objectif (image du vilain + texte + seuil de Pouvoir différents) activable par une carte
          portant l’effet « Changer d’objectif » — façon Ratigan. La face active remplace l’ancienne.
        </span>
      ) : (
        <>
          <TextField
            label="Objectif alternatif (texte du plateau)"
            value={alt.boardObjective}
            onChange={(boardObjective) => setAlt({ boardObjective })}
            textarea
            placeholder="Ex. : Éliminez le Héros X."
          />
          <TextField
            label="Description (stratégie)"
            value={alt.objectiveDescription}
            onChange={(objectiveDescription) => setAlt({ objectiveDescription })}
            textarea
          />
          <ImageField
            label="Image du vilain — Objectif B"
            value={alt.boardArt}
            onChange={(boardArt) => setAlt({ boardArt })}
            aspect="portrait"
            crop={{
              pos: alt.portraitPos ?? { x: 50, y: 50 },
              onChange: (portraitPos) => setAlt({ portraitPos }),
            }}
          />
        </>
      )}
    </div>
  )
}
