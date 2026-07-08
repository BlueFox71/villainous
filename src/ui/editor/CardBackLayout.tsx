// Éditeur INTERACTIF du DOS de carte : on importe des images d'ornement et on les
// glisse / redimensionne directement sur l'aperçu réel du dos (Vilain). Les ornements
// sont superposés aux DEUX dos (Vilain + Fatalité) au moment du bake.
import { useEffect, useRef, useState } from 'react'
import type { BackOverlay } from '../../data/customVillain'
import { CARD_W, CARD_H } from '../../data/customVillain'
import { renderCardBack } from './cardRender'
import { readImageForStorage, loadImage } from './imageUtils'
import { Hotspot } from './CardLayout'

const ASPECT = CARD_W / CARD_H
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface DragState {
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

export function CardBackLayout({
  color,
  name,
  overlays,
  onChange,
  ornamentColor,
  paper,
}: {
  color: string
  name: string
  overlays: BackOverlay[]
  onChange: (overlays: BackOverlay[]) => void
  /** Recoloration des ornements dorés (3e dos). Absent = or d'origine. */
  ornamentColor?: string
  /** Rendu « parchemin » clair (comme la Fatalité). */
  paper?: boolean
}) {
  const [bg, setBg] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Aperçu réel du dos (avec ornements), débanché pour rester fluide pendant l'édition.
  const key = JSON.stringify({ color, name, overlays, ornamentColor, paper })
  useEffect(() => {
    let alive = true
    const h = setTimeout(() => {
      void renderCardBack(color, name, { overlays, ornamentColor, paper }).then((url) => { if (alive) setBg(url) })
    }, 140)
    return () => { alive = false; clearTimeout(h) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setOverlay = (id: string, p: Partial<BackOverlay>) =>
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...p } : o)))
  const removeOverlay = (id: string) => {
    onChange(overlays.filter((o) => o.id !== id))
    setSel(null)
  }

  const onPick = async (file: File | undefined) => {
    if (!file) return
    const image = await readImageForStorage(file, 1024)
    const img = await loadImage(image).catch(() => null)
    const aspect = img ? img.height / img.width : 1
    const taken = new Set(overlays.map((o) => o.id))
    let n = 1
    while (taken.has(`ovl-${n}`)) n++
    const id = `ovl-${n}`
    onChange([...overlays, { id, image, x: 50, y: 50, size: 50, aspect }])
    setSel(id)
  }

  // --- Drag ------------------------------------------------------------------
  const startDrag = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    const o = overlays.find((x) => x.id === id)
    if (!rect || !o) return
    setSel(id)
    dragRef.current = { id, mode, startX: e.clientX, startY: e.clientY, rectW: rect.width, rectH: rect.height, ox: o.x, oy: o.y, osize: o.size }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dxPctW = ((e.clientX - d.startX) / d.rectW) * 100
    const dyPctH = ((e.clientY - d.startY) / d.rectH) * 100
    if (d.mode === 'move') {
      setOverlay(d.id, { x: clamp(d.ox + dxPctW, 2, 98), y: clamp(d.oy + dyPctH, 2, 98) })
    } else {
      const delta = ((dxPctW + dyPctH) / 2) * 2
      setOverlay(d.id, { size: clamp(d.osize + delta, 5, 200) })
    }
  }
  const endDrag = () => { dragRef.current = null }

  // Ornement sélectionné : cible du curseur de zoom (même plage que la poignée : 5–100).
  const selOverlay = overlays.find((o) => o.id === sel)

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerDown={() => setSel(null)}
        className="relative aspect-[1440/2044] w-48 select-none overflow-hidden rounded-xl bg-black/40"
      >
        {bg ? (
          <img src={bg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30">…</div>
        )}
        {overlays.map((o) => {
          const heightPct = o.size * o.aspect * ASPECT
          return (
            <Hotspot
              key={o.id}
              left={o.x - o.size / 2}
              top={o.y - heightPct / 2}
              width={o.size}
              height={heightPct}
              selected={sel === o.id}
              onDown={(e) => startDrag(e, o.id, 'move')}
              onResize={(e) => startDrag(e, o.id, 'resize')}
              onDelete={() => removeOverlay(o.id)}
            />
          )
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="self-start rounded-lg border border-amber-300/50 px-3 py-1.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10"
      >
        🖼 Importer un ornement (dos)
      </button>

      {/* Curseur de zoom de l'ornement SÉLECTIONNÉ (agrandir / rétrécir). */}
      {selOverlay && (
        <label className="flex items-center gap-3 text-xs text-white/50">
          <span className="shrink-0 font-semibold uppercase tracking-wide">🔍 Zoom ornement</span>
          <input
            type="range"
            min={5}
            max={200}
            value={selOverlay.size}
            onChange={(e) => setOverlay(selOverlay.id, { size: Number(e.target.value) })}
            className="flex-1 accent-amber-400"
          />
        </label>
      )}

      <p className="text-[11px] text-white/40">
        Glisse l’ornement pour le placer, la poignée du coin pour le redimensionner, la croix pour le
        retirer. Les ornements s’appliquent aux dos Vilain <strong>et</strong> Fatalité.
      </p>
    </div>
  )
}
