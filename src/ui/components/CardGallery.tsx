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

/** Bordure d'une vignette selon sa revue : validée (verte) ou NON validée (rouge). */
const REVIEW_RING = { ok: 'ring-4 ring-emerald-400', ko: 'ring-4 ring-red-500' } as const
const REVIEW_HINT = { ok: 'validée', ko: 'NON validée' } as const

/**
 * Une carte du paquet, avec une pastille « ×N exemplaires ».
 *
 * - `zoom` (défaut `true`) : agrandissement au survol (léger scale + grand visuel centré
 *   à l'écran). Passer `false` pour désactiver tout effet de survol.
 * - `onToggle` : rend la carte CLIQUABLE — chaque clic fait défiler sa revue (neutre →
 *   verte → rouge → neutre), l'état courant étant donné par `review`.
 */
export function CardThumb({
  card,
  review,
  onToggle,
  zoom = true,
}: {
  card: CardDef
  review?: 'ok' | 'ko'
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
          review ? REVIEW_RING[review] : ''
        }`}
        onMouseEnter={zoom ? () => { playCardHover(); setHover(true) } : undefined}
        onMouseLeave={zoom ? () => setHover(false) : undefined}
        onClick={onToggle}
      >
        <LoadingImage
          src={card.image}
          alt={card.name}
          title={`${card.name} — ${TYPE_LABEL[card.type] ?? card.type}${review ? ` (${REVIEW_HINT[review]})` : ''}`}
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
 * rendu si `cards` est vide. Passer `onToggle` rend les vignettes cliquables ;
 * `validatedIds` / `rejectedIds` donnent la bordure (verte / rouge) de chacune.
 */
export function DeckGallery({
  title,
  cards,
  count,
  validatedIds,
  rejectedIds,
  onToggle,
  zoom = true,
}: {
  title: string
  cards: CardDef[]
  count: number
  validatedIds?: Set<string>
  rejectedIds?: Set<string>
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
            review={validatedIds?.has(c.id) ? 'ok' : rejectedIds?.has(c.id) ? 'ko' : undefined}
            onToggle={onToggle ? () => onToggle(c.id) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
