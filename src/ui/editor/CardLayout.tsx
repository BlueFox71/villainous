// Éditeur INTERACTIF de la disposition d'une carte : on glisse le bloc de texte et
// les symboles d'action directement sur l'aperçu, et on les redimensionne par une
// poignée. L'aperçu de fond est le rendu RÉEL de la carte (WYSIWYG) ; les zones
// déplaçables sont des « hotspots » transparents superposés.
import { useEffect, useRef, useState } from 'react'
import type { CustomCard, CardSticker, CardShape, TextBox, TextLayout } from '../../data/customVillain'
import { CARD_W, CARD_H, DEFAULT_TEXT_LAYOUT, DEFAULT_STICKER_SIZE, STICKER_SIZE_PRESETS, DEFAULT_SHAPE_SIZE, SHAPE_SIZE_PRESETS, TEXT_SIZE_PRESETS } from '../../data/customVillain'
import type { LocationActionType } from '../../engine/types'
import { renderCardFace, ruleTextBlockHeight, isPreRenderedCard } from './cardRender'
import { ACTION_TOKEN_LIST, ACTION_ICON_FILE, BOARD_ICON_DIR } from './actionIcons'
import { inputClass, Field } from './fields'
import { useCustomTypesStore } from '../store/customTypesStore'

const ASPECT = CARD_W / CARD_H

/** Petit titre de section du formulaire de carte (Illustration / Texte / Symboles). */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/70">{children}</span>
  )
}

/** Texte type d'une carte sans effet, en italique (`_…_`). */
const NO_ABILITY_TEXT = '_Aucune capacité._'

/** Insère `NO_ABILITY_TEXT` (en italique) à la position du curseur d'un textarea,
 *  en remplaçant la sélection éventuelle, puis replace le curseur juste après. */
function insertNoAbility(ta: HTMLTextAreaElement | null, value: string, onChange: (v: string) => void) {
  if (!ta) return
  const start = ta.selectionStart ?? value.length
  const end = ta.selectionEnd ?? value.length
  const next = value.slice(0, start) + NO_ABILITY_TEXT + value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    ta.focus()
    const p = start + NO_ABILITY_TEXT.length
    ta.setSelectionRange(p, p)
  })
}

/** Bouton « Aucune capacité » d'une barre d'outils de texte : insère la mention
 *  `_Aucune capacité._` (en italique) au curseur. */
function NoAbilityButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Insérer « Aucune capacité. » en italique"
      className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
    >
      <em>I</em> Aucune capacité
    </button>
  )
}

type Selection =
  | { kind: 'text' }
  | { kind: 'box'; id: string }
  | { kind: 'sticker'; id: string }
  | { kind: 'shape'; id: string }
  | null
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
  illustration,
  belowPreview,
}: {
  card: CustomCard
  color: string
  fateColor: string
  /** Mots-clés colorés du vilain (label → couleur), colorés comme les types. */
  keywordColors?: { label: string; color: string }[]
  onChange: (c: CustomCard) => void
  /** Section « Illustration » (image + cadrage), rendue en tête de la colonne de
   *  contrôles — l'aperçu interactif reste fixe à côté. */
  illustration?: React.ReactNode
  /** Contenu optionnel affiché SOUS l'aperçu interactif (dans la colonne sticky) —
   *  ex. l'aperçu de la carte de base pour une carte de variante « qui diffère ». */
  belowPreview?: React.ReactNode
}) {
  const [bg, setBg] = useState<string | null>(null)
  const [sel, setSel] = useState<Selection>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const mainTextRef = useRef<HTMLTextAreaElement>(null)
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
    sh: card.shapes,
    col: color,
    fcol: fateColor,
    ct: customTypes,
    kw: keywordColors,
  })
  // Carte PRÉ-RENDUE (sans art brut à recomposer, ex. Dio compressé) : on affiche le composite
  // baké tel quel (dérivé, pas d'état) — le recomposer donnerait une carte sans illustration.
  const preRendered = isPreRenderedCard(card)
  useEffect(() => {
    if (preRendered) return // rien à recomposer : l'arrière-plan dérive de card.image
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
  }, [key, preRendered])
  const displayBg = preRendered ? (card.image ?? null) : bg

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

  // Cible de la barre d'alignement/taille : la zone de texte sélectionnée, sinon le
  // texte principal. Centrer H/V = ramener le CENTRE du bloc à mi-carte (x/y = 50).
  const activeBox = sel?.kind === 'box' ? card.textBoxes?.find((b) => b.id === sel.id) : undefined
  const activeText: TextLayout = activeBox
    ? { x: activeBox.x, y: activeBox.y, w: activeBox.w, size: activeBox.size }
    : tl
  const setActiveText = (p: Partial<TextLayout>) =>
    activeBox ? setBox(activeBox.id, p) : setTextLayout(p)

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

  const setShape = (id: string, p: Partial<CardShape>) =>
    onChange({ ...card, shapes: (card.shapes ?? []).map((s) => (s.id === id ? { ...s, ...p } : s)) })

  // Couleur de la PROCHAINE forme posée (pipette) — par défaut celle du vilain.
  const [shapeColor, setShapeColor] = useState(color)
  const addShape = () => {
    const taken = new Set((card.shapes ?? []).map((s) => s.id))
    let n = 1
    while (taken.has(`shp-${n}`)) n++
    const id = `shp-${n}`
    const shp: CardShape = { id, kind: 'circle', color: shapeColor, x: 50, y: 50, size: DEFAULT_SHAPE_SIZE }
    onChange({ ...card, shapes: [...(card.shapes ?? []), shp] })
    setSel({ kind: 'shape', id })
  }
  const removeShape = (id: string) => {
    onChange({ ...card, shapes: (card.shapes ?? []).filter((s) => s.id !== id) })
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
              // symbole OU forme : même modèle géométrique (centre x/y + taille carrée).
              const el = s.kind === 'sticker' ? card.stickers?.find((x) => x.id === s.id) : card.shapes?.find((x) => x.id === s.id)
              const def = s.kind === 'sticker' ? DEFAULT_STICKER_SIZE : DEFAULT_SHAPE_SIZE
              return { ox: el?.x ?? 50, oy: el?.y ?? 50, ow: 0, osize: el?.size ?? def }
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
      // symbole OU forme : même géométrie ; on route vers le bon setter.
      const applyEl = (p: Partial<CardSticker & CardShape>) =>
        d.sel.kind === 'sticker' ? setSticker((d.sel as { id: string }).id, p) : setShape((d.sel as { id: string }).id, p)
      if (d.mode === 'move') {
        applyEl({ x: clamp(d.ox + dxPctW, 2, 98), y: clamp(d.oy + dyPctH, 2, 98) })
      } else {
        const delta = ((dxPctW + dyPctH) / 2) * 2
        applyEl({ size: clamp(d.osize + delta, 4, 60) })
      }
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  // Déplacement au CLAVIER de l'élément sélectionné (flèches ; Maj = pas plus grand).
  // On ignore les flèches quand le focus est dans un champ de saisie (textarea/input).
  useEffect(() => {
    if (!sel) return
    const onKey = (e: KeyboardEvent) => {
      const dir: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const d = dir[e.key]
      if (!d) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      const step = e.shiftKey ? 2 : 0.5
      const dx = d[0] * step
      const dy = d[1] * step
      if (sel.kind === 'text') {
        const cur = card.textLayout ?? DEFAULT_TEXT_LAYOUT
        onChange({ ...card, textLayout: { ...cur, x: clamp(cur.x + dx, 4, 96), y: clamp(cur.y + dy, 4, 96) } })
      } else if (sel.kind === 'box') {
        onChange({
          ...card,
          textBoxes: (card.textBoxes ?? []).map((b) =>
            b.id === sel.id ? { ...b, x: clamp(b.x + dx, 4, 96), y: clamp(b.y + dy, 4, 96) } : b,
          ),
        })
      } else if (sel.kind === 'sticker') {
        onChange({
          ...card,
          stickers: (card.stickers ?? []).map((s) =>
            s.id === sel.id ? { ...s, x: clamp(s.x + dx, 2, 98), y: clamp(s.y + dy, 2, 98) } : s,
          ),
        })
      } else {
        onChange({
          ...card,
          shapes: (card.shapes ?? []).map((s) =>
            s.id === sel.id ? { ...s, x: clamp(s.x + dx, 2, 98), y: clamp(s.y + dy, 2, 98) } : s,
          ),
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, card, onChange])

  // % largeur → % hauteur (un carré en espace carte est plus « haut » en %).
  const sideH = (sizePctW: number) => sizePctW * ASPECT

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      {/* APERÇU interactif — colonne de droite, reste visible (sticky) pendant l'édition. */}
      <div className="self-start lg:order-2 lg:sticky lg:top-2">
      <div
        ref={containerRef}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerDown={() => setSel(null)}
        className="relative aspect-[1440/2044] w-full select-none overflow-hidden rounded-xl bg-black/40"
      >
        {displayBg ? (
          <img src={displayBg} alt={card.name} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
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

        {/* Hotspots des FORMES posées (layouts) */}
        {(card.shapes ?? []).map((s) => (
          <Hotspot
            key={s.id}
            left={s.x - s.size / 2}
            top={s.y - sideH(s.size) / 2}
            width={s.size}
            height={sideH(s.size)}
            selected={sel?.kind === 'shape' && sel.id === s.id}
            onDown={(e) => startDrag(e, { kind: 'shape', id: s.id }, 'move')}
            onResize={(e) => startDrag(e, { kind: 'shape', id: s.id }, 'resize')}
            onDelete={() => removeShape(s.id)}
          />
        ))}
      </div>
      {belowPreview}
      </div>

      {/* CONTRÔLES — colonne de gauche : Illustration → Texte → Symboles d'action. */}
      <div className="flex min-w-0 flex-col gap-5 lg:order-1">
        {illustration && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Illustration</SectionTitle>
            {illustration}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <SectionTitle>Texte</SectionTitle>
          <Field
            label="Texte de la carte"
            action={<NoAbilityButton onClick={() => insertNoAbility(mainTextRef.current, card.text, (text) => onChange({ ...card, text }))} />}
          >
            <textarea
              ref={mainTextRef}
              className={`${inputClass} min-h-[5rem] resize-y`}
              value={card.text}
              placeholder="Décris l’effet de la carte ici. Le comportement sera codé au moment du test."
              onChange={(e) => onChange({ ...card, text: e.target.value })}
            />
          </Field>

      {/* Barre d'alignement + tailles : agit sur la zone sélectionnée, sinon le texte principal. */}
      {(card.text.trim() || activeBox) && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            {activeBox ? 'Zone de texte sélectionnée' : 'Texte principal'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveText({ x: 50 })}
              title="Centrer horizontalement (bloc au milieu de la carte)"
              className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
            >
              ⇔ Centrer H
            </button>
            <button
              type="button"
              onClick={() => setActiveText({ y: 75 })}
              title="Centrer verticalement dans le panneau de texte (bas de la carte)"
              className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
            >
              ⇕ Centrer V
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-white/40">Taille :</span>
            {([
              { label: 'Petit', size: TEXT_SIZE_PRESETS.small },
              { label: 'Standard', size: TEXT_SIZE_PRESETS.standard },
            ] as const).map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setActiveText({ size: s.size })}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  activeText.size === s.size
                    ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                    : 'border-white/20 bg-white/5 text-white/80 hover:border-amber-300/70 hover:text-amber-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>Symboles d’action</SectionTitle>
      {/* Barre : poser un symbole d'action */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-white/40">Poser un symbole d’action :</span>
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
        {sel?.kind === 'sticker' &&
          (() => {
            const stk = card.stickers?.find((s) => s.id === sel.id)
            if (!stk) return null
            const sizeBtn = (label: string, size: number) => (
              <button
                key={label}
                type="button"
                onClick={() => setSticker(stk.id, { size })}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  stk.size === size
                    ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                    : 'border-white/20 bg-white/5 text-white/80 hover:border-amber-300/70 hover:text-amber-200'
                }`}
              >
                {label}
              </button>
            )
            return (
              <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-rose-400/20 bg-rose-400/5 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-200/70">Symbole sélectionné</span>
                  <button
                    type="button"
                    onClick={() => removeSticker(sel.id)}
                    className="rounded border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                  >
                    Supprimer le symbole
                  </button>
                </div>
                {/* Centrer horizontalement le symbole (x = 50 %). */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSticker(stk.id, { x: 50 })}
                    title="Centrer le symbole horizontalement au milieu de la carte"
                    className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
                  >
                    ⇔ Centrer H
                  </button>
                </div>
                {/* Taille du symbole : Petit / Normal (déplaçable/redimensionnable au drag aussi). */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/40">Taille :</span>
                  {sizeBtn('Petit', STICKER_SIZE_PRESETS.small)}
                  {sizeBtn('Normal', STICKER_SIZE_PRESETS.normal)}
                </div>
                {/* Symbole « Gagner du pouvoir » : chiffre affiché dessus (aucun / 1 / 2 / 3). */}
                {stk.type === 'GAIN_POWER' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-white/40">Chiffre :</span>
                    {([
                      { label: 'Aucun', value: undefined },
                      { label: '1', value: 1 },
                      { label: '2', value: 2 },
                      { label: '3', value: 3 },
                    ] as const).map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => setSticker(stk.id, { amount: o.value })}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                          stk.amount === o.value
                            ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                            : 'border-white/20 bg-white/5 text-white/80 hover:border-amber-300/70 hover:text-amber-200'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
      </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>Layouts</SectionTitle>
      {/* Barre : poser une forme décorative + pipette de couleur de la prochaine forme. */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-white/40">Poser une forme :</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addShape}
            title="Poser : rond plein"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
          >
            <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: shapeColor }} />
            Rond plein
          </button>
          {/* Pipette : couleur de la prochaine forme posée. */}
          <input
            type="color"
            value={shapeColor}
            onChange={(e) => setShapeColor(e.target.value)}
            title="Couleur de la forme"
            className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
          />
        </div>
        {sel?.kind === 'shape' &&
          (() => {
            const shp = card.shapes?.find((s) => s.id === sel.id)
            if (!shp) return null
            const sizeBtn = (label: string, size: number) => (
              <button
                key={label}
                type="button"
                onClick={() => setShape(shp.id, { size })}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  shp.size === size
                    ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                    : 'border-white/20 bg-white/5 text-white/80 hover:border-amber-300/70 hover:text-amber-200'
                }`}
              >
                {label}
              </button>
            )
            return (
              <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/70">Forme sélectionnée</span>
                  <button
                    type="button"
                    onClick={() => removeShape(sel.id)}
                    className="rounded border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                  >
                    Supprimer la forme
                  </button>
                </div>
                {/* Couleur de la forme sélectionnée (pipette). */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/40">Couleur :</span>
                  <input
                    type="color"
                    value={shp.color}
                    onChange={(e) => setShape(shp.id, { color: e.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
                  />
                </div>
                {/* Centrer horizontalement la forme (x = 50 %). */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShape(shp.id, { x: 50 })}
                    title="Centrer la forme horizontalement au milieu de la carte"
                    className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
                  >
                    ⇔ Centrer H
                  </button>
                </div>
                {/* Taille de la forme : Petit / Normal (déplaçable/redimensionnable au drag aussi). */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/40">Taille :</span>
                  {sizeBtn('Petit', SHAPE_SIZE_PRESETS.small)}
                  {sizeBtn('Normal', SHAPE_SIZE_PRESETS.normal)}
                </div>
              </div>
            )
          })()}
      </div>
        </section>
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
      <div className="flex flex-wrap items-center gap-1">
        <NoAbilityButton onClick={() => insertNoAbility(ref.current, draft, update)} />
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
