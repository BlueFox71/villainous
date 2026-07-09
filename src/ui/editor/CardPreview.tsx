import { useEffect, useState } from 'react'
import type { CustomCard } from '../../data/customVillain'
import { renderCardFace } from './cardRender'
import { useCustomTypesStore } from '../store/customTypesStore'

/** Aperçu d'une carte : rend la face en dataURL (asynchrone, débanché léger). */
export function CardPreview({
  card,
  color,
  fateColor,
  keywordColors = [],
  className,
}: {
  card: CustomCard
  color: string
  fateColor: string
  /** Mots-clés colorés du vilain (label → couleur), colorés comme les types. */
  keywordColors?: { label: string; color: string }[]
  className?: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  // Types personnalisés (bibliothèque globale) → coloration de leurs noms dans le texte.
  const customTypes = useCustomTypesStore((s) => s.types)
  const wordColors = [...customTypes, ...keywordColors]

  // Re-rend dès qu'un champ visuel change. On sérialise les champs pertinents pour
  // une dépendance stable (évite de re-render sur des changements non visuels).
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
    a: card.artImage?.slice(0, 64),
    tr: card.artTransform,
    tl: card.textLayout,
    tb: card.textBoxes,
    st: card.stickers,
    col: color,
    fcol: fateColor,
    ct: customTypes,
    kw: keywordColors,
  })

  // Face DÉJÀ RENDUE, sans art SOURCE à recomposer : on affiche l'image bakée telle quelle
  // (la recomposer via renderCardFace donnerait une carte VIDE). Couvre les vilains migrés
  // (image = chemin/URL depuis public/) MAIS AUSSI le cas où l'art brut `artImage` a été
  // perdu alors que l'image bakée (dataURL) subsiste — sinon la carte s'afficherait vide.
  const preRendered = !card.artImage && !!card.image

  useEffect(() => {
    if (preRendered) return // rien à composer : on affiche card.image directement
    let alive = true
    const handle = setTimeout(() => {
      void renderCardFace(card, color, fateColor, {}, wordColors).then((url) => {
        if (alive) setSrc(url)
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, preRendered])

  const displaySrc = preRendered ? card.image : src

  return (
    <div className={`aspect-[1440/2044] overflow-hidden rounded-xl bg-black/40 ${className ?? ''}`}>
      {displaySrc ? (
        <img src={displaySrc} alt={card.name} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/30">…</div>
      )}
    </div>
  )
}
