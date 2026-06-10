import { useState } from 'react'
import type { CardDef } from '../../data/types'
import { Scroller } from './Scroller'

interface Props {
  /** Cartes proposées. */
  cards: CardDef[]
  /** cardId sélectionné. */
  value: string
  onChange: (cardId: string) => void
  placeholder?: string
  /** Largeur du bouton (classe Tailwind). */
  widthClass?: string
}

const MENU_W = 176
const PREVIEW_W = 230

/**
 * Liste déroulante de cartes avec aperçu : le bouton montre la sélection
 * courante, et au survol d'une ligne du menu l'image de la carte s'affiche à
 * côté. Le menu est rendu en position `fixed` (ancré sur le bouton) pour ne pas
 * être rogné par le `overflow` des colonnes. Réutilisé pour choisir un Héros ou
 * une Condition à infliger (mode test).
 */
export function CardSelect({ cards, value, onChange, placeholder = 'Choisir…', widthClass = 'w-44' }: Props) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [preview, setPreview] = useState<CardDef | null>(null)
  const selected = cards.find((c) => c.id === value)

  const close = () => {
    setAnchor(null)
    setPreview(null)
  }

  // Aperçu à droite du menu, ou à gauche si on déborderait de l'écran.
  const previewOnLeft = anchor ? anchor.left + MENU_W + PREVIEW_W + 24 > window.innerWidth : false
  const left = anchor ? Math.min(anchor.left, window.innerWidth - MENU_W - 12) : 0
  const top = anchor ? Math.min(anchor.bottom + 4, window.innerHeight - 340) : 0

  return (
    <div className={`relative ${widthClass}`}>
      <button
        type="button"
        onClick={(e) => (anchor ? close() : setAnchor(e.currentTarget.getBoundingClientRect()))}
        className="flex w-full items-center justify-between gap-1 rounded bg-black/40 px-2 py-0.5 text-left text-white"
      >
        <span className="truncate">{selected?.name ?? placeholder}</span>
        <span className="shrink-0 text-white/50">▾</span>
      </button>
      {anchor && (
        // Voile transparent plein écran : clic en dehors → ferme.
        <div className="fixed inset-0 z-[68]" onClick={close}>
          <div
            className="absolute flex items-start gap-2"
            style={{ left, top }}
            onClick={(e) => e.stopPropagation()}
          >
            {previewOnLeft && preview && (
              <img src={preview.image} alt={preview.name} className="h-80 w-auto rounded-lg border border-white/30 shadow-2xl" />
            )}
            <Scroller
              className="max-h-72 rounded-lg border border-emerald-500/50 bg-[#0b0a12] shadow-2xl"
              onMouseLeave={() => setPreview(null)}
              style={{ width: MENU_W }}
            >
              {cards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setPreview(c)}
                  onClick={() => {
                    onChange(c.id)
                    close()
                  }}
                  className={`flex w-full items-center gap-1 px-2 py-1 text-left text-[11px] hover:bg-white/10 ${
                    c.id === value ? 'bg-white/10 text-emerald-200' : 'text-white/85'
                  }`}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.strength !== undefined && (
                    <span className="shrink-0 text-[9px] text-white/50">F{c.strength}</span>
                  )}
                </button>
              ))}
            </Scroller>
            {!previewOnLeft && preview && (
              <img src={preview.image} alt={preview.name} className="h-80 w-auto rounded-lg border border-white/30 shadow-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
