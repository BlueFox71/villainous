import { useEffect, useState } from 'react'
import type { CustomCard } from '../../data/customVillain'
import { renderCardFace } from './cardRender'
import { useCustomTypesStore } from '../store/customTypesStore'

/** Aperçu d'une carte : rend la face en dataURL (asynchrone, débanché léger). */
export function CardPreview({
  card,
  color,
  fateColor,
  className,
}: {
  card: CustomCard
  color: string
  fateColor: string
  className?: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  // Types personnalisés (bibliothèque globale) → coloration de leurs noms dans le texte.
  const customTypes = useCustomTypesStore((s) => s.types)

  // Re-rend dès qu'un champ visuel change. On sérialise les champs pertinents pour
  // une dépendance stable (évite de re-render sur des changements non visuels).
  const key = JSON.stringify({
    n: card.name,
    t: card.type,
    tlbl: card.typeLabel,
    tcol: card.typeColor,
    d: card.deck,
    c: card.cost,
    s: card.strength,
    x: card.text,
    a: card.artImage?.slice(0, 64),
    tr: card.artTransform,
    tl: card.textLayout,
    tb: card.textBoxes,
    st: card.stickers,
    col: color,
    fcol: fateColor,
    ct: customTypes,
  })

  useEffect(() => {
    let alive = true
    const handle = setTimeout(() => {
      void renderCardFace(card, color, fateColor, {}, customTypes).then((url) => {
        if (alive) setSrc(url)
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div className={`aspect-[1440/2044] overflow-hidden rounded-xl bg-black/40 ${className ?? ''}`}>
      {src ? (
        <img src={src} alt={card.name} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/30">…</div>
      )}
    </div>
  )
}
