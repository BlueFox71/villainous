import { useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import type { CardDef } from '../../data/types'
import { Scroller } from './Scroller'

interface Props {
  /** Vilain dont on propose les cartes (Vilain + Fatalité). */
  villain: VillainKey
  /** Position d'ancrage (coin du clic, en pixels écran). */
  x: number
  y: number
  /** Nom du lieu (en-tête). */
  locationName: string
  /** Insère la carte choisie (le picker reste ouvert pour en ajouter d'autres). */
  onPick: (cardId: string) => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  ally: 'Allié',
  item: 'Objet',
  curse: 'Malédiction',
  condition: 'Condition',
  effect: 'Événement',
  hero: 'Héros',
  ingredient: 'Ingrédient',
}

const PANEL_W = 220
const PREVIEW_W = 230

/**
 * Liste déroulante custom pour insérer une carte sur un lieu (mode test). Les
 * cartes sont groupées Vilain / Fatalité ; survoler une ligne affiche l'image
 * de la carte à côté de la liste.
 */
export function CardPicker({ villain, x, y, locationName, onPick, onClose }: Props) {
  const [preview, setPreview] = useState<CardDef | null>(null)
  const cards = VILLAIN_REGISTRY[villain].cards
  const villainCards = cards.filter((c) => c.deck === 'villain').sort((a, b) => a.name.localeCompare(b.name))
  const fateCards = cards.filter((c) => c.deck === 'fate').sort((a, b) => a.name.localeCompare(b.name))

  // L'aperçu se place à droite de la liste, ou à gauche si on est trop près du bord.
  const previewOnLeft = x + PANEL_W + PREVIEW_W + 24 > window.innerWidth
  const left = Math.min(Math.max(8, x), window.innerWidth - PANEL_W - 12)
  const top = Math.min(Math.max(8, y), window.innerHeight - 360)

  const Group = (title: string, list: CardDef[], tint: string) => (
    <div>
      <div className={`sticky top-0 bg-[#0b0a12] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${tint}`}>
        {title}
      </div>
      {list.map((c) => (
        <button
          key={c.id}
          onMouseEnter={() => setPreview(c)}
          onClick={() => onPick(c.id)}
          className="flex w-full items-center gap-1 px-2 py-1 text-left text-[11px] text-white/85 hover:bg-white/10"
        >
          <span className="flex-1 truncate">{c.name}</span>
          <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] text-white/50">
            {TYPE_LABEL[c.type] ?? c.type}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    // Voile transparent : un clic en dehors ferme le picker.
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div
        className="absolute flex items-start gap-2"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {previewOnLeft && preview && (
          <img
            src={preview.image}
            alt={preview.name}
            className="h-80 w-auto rounded-lg border border-white/30 shadow-2xl"
          />
        )}
        <div
          className="flex max-h-[22rem] flex-col overflow-hidden rounded-lg border border-emerald-500/50 bg-[#0b0a12] shadow-2xl"
          style={{ width: PANEL_W }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
            <span className="truncate text-[11px] font-semibold text-emerald-300" title={locationName}>
              Insérer · {locationName}
            </span>
            <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
          </div>
          <Scroller className="min-h-0 flex-1" onMouseLeave={() => setPreview(null)}>
            {Group('Vilain', villainCards, 'text-amber-300/80')}
            {Group('Fatalité', fateCards, 'text-red-300/80')}
          </Scroller>
        </div>
        {!previewOnLeft && preview && (
          <img
            src={preview.image}
            alt={preview.name}
            className="h-80 w-auto rounded-lg border border-white/30 shadow-2xl"
          />
        )}
      </div>
    </div>
  )
}
