import { useState } from 'react'
import type { CardDef } from '../../data/types'
import { LoadingImage } from './LoadingImage'
import { playCardHover } from '../sfx'

/** Libellé court du type de carte (pour le survol). */
const TYPE_LABEL: Record<string, string> = {
  ally: 'Allié',
  item: 'Objet',
  effect: 'Événement',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
  ingredient: 'Ingrédient',
}

/**
 * Une carte du paquet, avec une pastille « ×N exemplaires ».
 *
 * - `zoom` (défaut `true`) : agrandissement au survol (léger scale + grand visuel centré
 *   à l'écran). Passer `false` pour désactiver tout effet de survol.
 * - `onToggle` : rend la carte SÉLECTIONNABLE — un clic (dé)sélectionne, la carte reçoit
 *   alors une bordure verte.
 */
export function CardThumb({
  card,
  selected,
  onToggle,
  zoom = true,
}: {
  card: CardDef
  selected?: boolean
  onToggle?: () => void
  zoom?: boolean
}) {
  const [hover, setHover] = useState(false)
  const selectable = onToggle !== undefined
  const cursor = selectable ? 'cursor-pointer' : zoom ? 'cursor-zoom-in' : ''
  return (
    <div className="flex flex-col gap-1">
      <figure
        className={`relative m-0 rounded-lg ${zoom ? 'transition-transform duration-150 ease-out hover:scale-[1.04]' : ''} ${cursor} ${
          selected ? 'ring-4 ring-emerald-400' : ''
        }`}
        onMouseEnter={zoom ? () => { playCardHover(); setHover(true) } : undefined}
        onMouseLeave={zoom ? () => setHover(false) : undefined}
        onClick={onToggle}
      >
        <LoadingImage
          src={card.image}
          alt={card.name}
          title={`${card.name} — ${TYPE_LABEL[card.type] ?? card.type}`}
          wrapperClassName="aspect-[1440/2044] w-full rounded-lg border border-white/15"
          className="h-full w-full object-cover"
          spinnerSize="sm"
        />
        <span className="absolute right-1 top-1 z-20 rounded-full border border-white/30 bg-black/80 px-1.5 text-[11px] font-bold text-white">
          ×{card.copies}
        </span>
      </figure>
      {zoom && hover && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-start p-6 pl-[6vw]">
          <div className="flex max-w-[60vw] flex-col items-start gap-2">
            <img
              src={card.image}
              alt={card.name}
              className="max-h-[40vh] w-auto max-w-full rounded-2xl border border-white/25 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Grille d'un paquet (Vilain ou Fatalité) : une vignette par carte unique. Rien n'est
 * rendu si `cards` est vide. Passer `selectedIds` + `onToggle` rend les vignettes
 * sélectionnables (bordure verte au clic).
 */
export function DeckGallery({
  title,
  cards,
  count,
  selectedIds,
  onToggle,
  zoom = true,
}: {
  title: string
  cards: CardDef[]
  count: number
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
  zoom?: boolean
}) {
  if (cards.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
        {title} <span className="font-normal text-white/40">({count} cartes)</span>
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <CardThumb
            key={c.id}
            card={c}
            zoom={zoom}
            selected={selectedIds?.has(c.id)}
            onToggle={onToggle ? () => onToggle(c.id) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
