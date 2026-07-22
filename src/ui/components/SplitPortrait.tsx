import { useState } from 'react'

/** Un côté du portrait combiné : son image (facultative → pastille 🎭), son nom et sa couleur. */
export interface SplitSide {
  image?: string
  name: string
  color: string
}

/**
 * Portrait « partagé » de deux vilains liés (une base et sa variante skin), coupé en DIAGONALE
 * (premier en haut-gauche, second en bas-droite) avec un fin trait séparateur. Au survol d'une
 * moitié, ce côté s'étend à toute la case (image complète) ; l'autre s'efface. Utilisé dans la
 * liste de l'Atelier ET dans la Liste des vilains pour représenter le couple en une seule carte.
 */
export function SplitPortrait({ a, b }: { a: SplitSide; b: SplitSide }) {
  const [hover, setHover] = useState<null | 'a' | 'b'>(null)
  // Côté visé d'après la souris, de part et d'autre de la diagonale « / » (coin haut-droit ↔
  // coin bas-gauche = ligne x + y = 1). a = triangle haut-gauche, b = triangle bas-droite.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setHover(x + y < 1 ? 'a' : 'b')
  }
  // Découpe de chaque moitié : triangle par défaut, carré plein pour la moitié survolée
  // (l'autre réduite à néant pour laisser voir l'image complète).
  const EMPTY = 'polygon(0 0, 0 0, 0 0)'
  const FULL = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
  const aClip = hover === 'a' ? FULL : hover === 'b' ? EMPTY : 'polygon(0 0, 100% 0, 0 100%)'
  const bClip = hover === 'b' ? FULL : hover === 'a' ? EMPTY : 'polygon(100% 0, 100% 100%, 0 100%)'
  const half = (s: SplitSide, clip: string) =>
    s.image ? (
      <img src={s.image} alt={s.name} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: clip }} />
    ) : (
      <div
        className="absolute inset-0 flex items-center justify-center text-4xl text-white/30"
        style={{ clipPath: clip, backgroundColor: s.color }}
      >
        🎭
      </div>
    )
  return (
    <div
      className="relative aspect-square w-full overflow-hidden"
      style={{ backgroundColor: a.color }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {half(a, aClip)}
      {half(b, bClip)}
      {/* Trait séparateur diagonal (coin haut-droit ↔ coin bas-gauche), masqué au survol. */}
      {hover === null && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[142%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-white/40" />
      )}
    </div>
  )
}
