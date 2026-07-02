// Éditeur INTERACTIF de la disposition d'une carte : on glisse le bloc de texte et
// les symboles d'action directement sur l'aperçu, et on les redimensionne par une
// poignée. L'aperçu de fond est le rendu RÉEL de la carte (WYSIWYG) ; les zones
// déplaçables sont des « hotspots » transparents superposés.
import { useEffect, useRef, useState } from 'react'
import type { CustomCard, CardSticker, TextBox } from '../../data/customVillain'
import { CARD_W, CARD_H, DEFAULT_TEXT_LAYOUT, DEFAULT_STICKER_SIZE } from '../../data/customVillain'
import type { LocationActionType } from '../../engine/types'
import { renderCardFace, ruleTextBlockHeight } from './cardRender'
import { ACTION_TOKEN_LIST, ACTION_ICON_FILE, BOARD_ICON_DIR } from './actionIcons'
import { inputClass } from './fields'
import { useCustomTypesStore } from '../store/customTypesStore'

const ASPECT = CARD_W / CARD_H

type Selection = { kind: 'text' } | { kind: 'box'; id: string } | { kind: 'sticker'; id: string } | null
type DragMode = 'move' | 'resize'
interface DragState {
  sel: Exclude<Selection, null>
  mode: DragMode
  startX: number // client px
  startY: number
  rectW: number
  rectH: number
  // valeurs initiales
  ox: number
  oy: number
  ow: number
  osize: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function CardLayoutEditor({
  card,
  color,
  fateColor,
  keywordColors = [],
  onChange,
}: {
  card: CustomCard
  color: string
  fateColor: string
  /** Mots-clés colorés du vilain (label → couleur), colorés comme les types. */
  keywordColors?: { label: string; color: string }[]
  onChange: (c: CustomCard) => void
}) {
  const [bg, setBg] = useState<string | null>(null)
  const [sel, setSel] = useState<Selection>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const customTypes = useCustomTypesStore((s) => s.types)
  const wordColors = [...customTypes, ...keywordColors]

  // Rendu de fond (réel) — débanché pour rester fluide pendant l'édition.
  const key = JSON.stringify({
    n: card.name,
    t: card.type,
    tlbl: card.typeLabel,
    tcol: card.typeColor,
    d: card.deck,
    c: card.cost,
    cv: card.costVariable,
    s: card.strength,
    x: card.text,
    a: card.artImage?.slice(0, 48),
    tr: card.artTransform,
    tl: card.textLayout,
    tb: card.textBoxes,
    st: card.stickers,
    col: color,
    fcol: fateColor,
    ct: customTypes,
    kw: keywordColors,
  })
  useEffect(() => {
    let alive = true
    const h = setTimeout(() => {
      void renderCardFace(card, color, fateColor, {}, wordColors).then((url) => {
        if (alive) setBg(url)
      })
    }, 140)
    return () => {
      alive = false
      clearTimeout(h)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Disposition de texte effective (défaut tant que l'utilisateur n'a rien déplacé).
  const tl = card.textLayout ?? DEFAULT_TEXT_LAYOUT
  // Hauteur du bloc de texte (en % de la hauteur de carte) pour dessiner le hotspot.
  const textHpct = card.text.trim()
    ? (ruleTextBlockHeight(card.text.trim(), (tl.w / 100) * CARD_W, tl.size) / CARD_H) * 100
    : tl.size / CARD_H * 100

  const setTextLayout = (p: Partial<typeof tl>) => onChange({ ...card, textLayout: { ...tl, ...p } })
  const setSticker = (id: string, p: Partial<CardSticker>) =>
    onChange({ ...card, stickers: (card.stickers ?? []).map((s) => (s.id === id ? { ...s, ...p } : s)) })
  const setBox = (id: string, p: Partial<TextBox>) =>
    onChange({ ...card, textBoxes: (card.textBoxes ?? []).map((b) => (b.id === id ? { ...b, ...p } : b)) })

  const addBox = () => {
    const taken = new Set((card.textBoxes ?? []).map((b) => b.id))
    let n = 1
    while (taken.has(`txt-${n}`)) n++
    const id = `txt-${n}`
    const box: TextBox = { id, text: 'Nouveau texte', x: 50, y: 45, w: 50, size: 44 }
    onChange({ ...card, textBoxes: [...(card.textBoxes ?? []), box] })
    setSel({ kind: 'box', id })
  }
  const removeBox = (id: string) => {
    onChange({ ...card, textBoxes: (card.textBoxes ?? []).filter((b) => b.id !== id) })
    setSel(null)
  }
  const boxHpct = (b: TextBox) =>
    b.text.trim() ? (ruleTextBlockHeight(b.text.trim(), (b.w / 100) * CARD_W, b.size) / CARD_H) * 100 : (b.size / CARD_H) * 100

  const addSticker = (type: LocationActionType) => {
    const taken = new Set((card.stickers ?? []).map((s) => s.id))
    let n = 1
    while (taken.has(`stk-${n}`)) n++
    const id = `stk-${n}`
    const stk: CardSticker = { id, type, x: 50, y: 50, size: DEFAULT_STICKER_SIZE }
    onChange({ ...card, stickers: [...(card.stickers ?? []), stk] })
    setSel({ kind: 'sticker', id })
  }
  const removeSticker = (id: string) => {
    onChange({ ...card, stickers: (card.stickers ?? []).filter((s) => s.id !== id) })
    setSel(null)
  }

  // --- Drag ------------------------------------------------------------------
  const startDrag = (e: React.PointerEvent, s: Exclude<Selection, null>, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setSel(s)
    const o =
      s.kind === 'text'
        ? { ox: tl.x, oy: tl.y, ow: tl.w, osize: tl.size }
        : s.kind === 'box'
          ? (() => {
              const b = card.textBoxes?.find((x) => x.id === s.id)
              return { ox: b?.x ?? 50, oy: b?.y ?? 50, ow: b?.w ?? 50, osize: b?.size ?? 44 }
            })()
          : (() => {
              const st = card.stickers?.find((x) => x.id === s.id)
              return { ox: st?.x ?? 50, oy: st?.y ?? 50, ow: 0, osize: st?.size ?? DEFAULT_STICKER_SIZE }
            })()
    dragRef.current = { sel: s, mode, startX: e.clientX, startY: e.clientY, rectW: rect.width, rectH: rect.height, ...o }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dxPctW = ((e.clientX - d.startX) / d.rectW) * 100
    const dyPctH = ((e.clientY - d.startY) / d.rectH) * 100
    if (d.sel.kind === 'text' || d.sel.kind === 'box') {
      const apply = d.sel.kind === 'text' ? setTextLayout : (p: Partial<TextBox>) => setBox((d.sel as { id: string }).id, p)
      if (d.mode === 'move') {
        apply({ x: clamp(d.ox + dxPctW, 4, 96), y: clamp(d.oy + dyPctH, 4, 96) })
      } else {
        // Poignée coin : horizontale → largeur (centrée, ×2), verticale → taille.
        const w = clamp(d.ow + dxPctW * 2, 12, 96)
        const size = clamp(d.osize + (dyPctH / 100) * CARD_H * 0.5, 18, 180)
        apply({ w, size: Math.round(size) })
      }
    } else {
      if (d.mode === 'move') {
        setSticker(d.sel.id, { x: clamp(d.ox + dxPctW, 2, 98), y: clamp(d.oy + dyPctH, 2, 98) })
      } else {
        const delta = ((dxPctW + dyPctH) / 2) * 2
        setSticker(d.sel.id, { size: clamp(d.osize + delta, 4, 60) })
      }
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  // % largeur → % hauteur (un carré en espace carte est plus « haut » en %).
  const sideH = (sizePctW: number) => sizePctW * ASPECT

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerDown={() => setSel(null)}
        className="relative aspect-[1440/2044] w-full select-none overflow-hidden rounded-xl bg-black/40"
      >
        {bg ? (
          <img src={bg} alt={card.name} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30">…</div>
        )}

        {/* Hotspot du TEXTE */}
        {card.text.trim() && (
          <Hotspot
            left={tl.x - tl.w / 2}
            top={tl.y - textHpct / 2}
            width={tl.w}
            height={textHpct}
            selected={sel?.kind === 'text'}
            onDown={(e) => startDrag(e, { kind: 'text' }, 'move')}
            onResize={(e) => startDrag(e, { kind: 'text' }, 'resize')}
          />
        )}

        {/* Hotspots des ZONES DE TEXTE supplémentaires */}
        {(card.textBoxes ?? []).map((b) => (
          <Hotspot
            key={b.id}
            left={b.x - b.w / 2}
            top={b.y - boxHpct(b) / 2}
            width={b.w}
            height={boxHpct(b)}
            selected={sel?.kind === 'box' && sel.id === b.id}
            onDown={(e) => startDrag(e, { kind: 'box', id: b.id }, 'move')}
            onResize={(e) => startDrag(e, { kind: 'box', id: b.id }, 'resize')}
            onDelete={() => removeBox(b.id)}
          />
        ))}

        {/* Hotspots des SYMBOLES posés */}
        {(card.stickers ?? []).map((s) => (
          <Hotspot
            key={s.id}
            left={s.x - s.size / 2}
            top={s.y - sideH(s.size) / 2}
            width={s.size}
            height={sideH(s.size)}
            selected={sel?.kind === 'sticker' && sel.id === s.id}
            onDown={(e) => startDrag(e, { kind: 'sticker', id: s.id }, 'move')}
            onResize={(e) => startDrag(e, { kind: 'sticker', id: s.id }, 'resize')}
            onDelete={() => removeSticker(s.id)}
          />
        ))}
      </div>

      {/* Zones de texte : ajouter + éditer le contenu de la zone sélectionnée */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={addBox}
          className="self-start rounded-lg border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
        >
          + Ajouter une zone de texte
        </button>
        {sel?.kind === 'box' &&
          (() => {
            const box = card.textBoxes?.find((b) => b.id === sel.id)
            if (!box) return null
            return (
              <BoxTextEditor
                key={box.id}
                value={box.text}
                onChange={(text) => setBox(box.id, { text })}
                onDelete={() => removeBox(box.id)}
              />
            )
          })()}
      </div>

      {/* Barre : poser un symbole d'action */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-white/40">Poser un symbole d’action (déplaçable / redimensionnable) :</span>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_TOKEN_LIST.map((a) => (
            <button
              key={a.token}
              type="button"
              onClick={() => addSticker(a.type)}
              title={`Poser : ${a.label}`}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100 transition hover:bg-amber-400/20"
            >
              {ACTION_ICON_FILE[a.type] && (
                <img src={`${BOARD_ICON_DIR}/${ACTION_ICON_FILE[a.type]}`} alt="" className="h-5 w-5 shrink-0 object-contain" />
              )}
              {a.label}
            </button>
          ))}
        </div>
        {card.textLayout && (
          <button
            type="button"
            onClick={() => onChange({ ...card, textLayout: undefined })}
            className="mt-1 self-start text-[11px] text-white/40 underline transition hover:text-amber-200"
          >
            Réinitialiser la position du texte (auto)
          </button>
        )}
        {sel?.kind === 'sticker' && (
          <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-rose-400/20 bg-rose-400/5 px-2 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-200/70">Symbole sélectionné</span>
            <button
              type="button"
              onClick={() => removeSticker(sel.id)}
              className="rounded border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
            >
              Supprimer le symbole
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Édition du contenu d'une zone de texte sélectionnée : textarea + insertion de
 *  jetons d'action au curseur + suppression. */
function BoxTextEditor({
  value,
  onChange,
  onDelete,
}: {
  value: string
  onChange: (v: string) => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // État LOCAL : la frappe reste instantanée même si le rendu de la carte (coûteux)
  // se met à jour avec un léger retard. Le composant est remonté (via `key`) quand on
  // change de zone, ce qui réinitialise `draft` à la bonne valeur.
  const [draft, setDraft] = useState(value)
  const update = (v: string) => {
    setDraft(v)
    onChange(v)
  }
  const insert = (token: string) => {
    const ins = `[${token}]`
    const ta = ref.current
    if (!ta) {
      update(draft + ins)
      return
    }
    const start = ta.selectionStart ?? draft.length
    const end = ta.selectionEnd ?? draft.length
    update(draft.slice(0, start) + ins + draft.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      const p = start + ins.length
      ta.setSelectionRange(p, p)
    })
  }
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-lg border border-sky-400/20 bg-sky-400/5 p-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-200/70">Zone de texte sélectionnée</span>
      <textarea
        ref={ref}
        className={`${inputClass} min-h-[3.5rem] resize-y`}
        value={draft}
        onChange={(e) => update(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        {ACTION_TOKEN_LIST.map((a) => (
          <button
            key={a.token}
            type="button"
            onClick={() => insert(a.token)}
            title={`Insérer [${a.token}]`}
            className="flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[11px] text-amber-100 transition hover:bg-amber-400/20"
          >
            {ACTION_ICON_FILE[a.type] && (
              <img src={`${BOARD_ICON_DIR}/${ACTION_ICON_FILE[a.type]}`} alt="" className="h-4 w-4 shrink-0 object-contain" />
            )}
            {a.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="self-start text-[11px] text-rose-300/80 underline transition hover:text-rose-200"
      >
        Supprimer cette zone de texte
      </button>
    </div>
  )
}

/** Zone déplaçable superposée : cadre en pointillés + poignée de taille (coin
 *  bas-droit) + croix de suppression (symboles). Tout est en % du conteneur. */
export function Hotspot({
  left,
  top,
  width,
  height,
  selected,
  onDown,
  onResize,
  onDelete,
}: {
  left: number
  top: number
  width: number
  height: number
  selected: boolean
  onDown: (e: React.PointerEvent) => void
  onResize: (e: React.PointerEvent) => void
  onDelete?: () => void
}) {
  return (
    <div
      onPointerDown={onDown}
      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
      className={`absolute cursor-move rounded-md border-2 border-dashed ${
        selected
          ? 'border-amber-300 bg-amber-300/10'
          : 'border-transparent bg-transparent hover:border-white/50' // invisible hors sélection, repère au survol
      }`}
    >
      {selected && (
        <>
          <div
            onPointerDown={onResize}
            title="Redimensionner"
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border border-black/50 bg-amber-300"
          />
          {onDelete && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onDelete}
              title="Supprimer ce symbole"
              className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-black/50 bg-rose-400 text-[10px] font-bold text-black"
            >
              ✕
            </button>
          )}
        </>
      )}
    </div>
  )
}
