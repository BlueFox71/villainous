/**
 * Cadre lumineux statique : une bordure colorée entourée de halos flous et d'une
 * lueur de fond. Conçu pour être posé en SURCOUCHE (`absolute inset-0`) d'un
 * conteneur `relative` — il ne dessine QUE le cadre + la lueur, pas de contenu.
 */

interface Props {
  /** Couleur du cadre et de la lueur. */
  color: string
  /** Rayon des coins (px) — à accorder avec le conteneur (ex. rounded-lg = 8). */
  radius?: number
  className?: string
}

export function GlowBorder({ color, radius = 8, className = '' }: Props) {
  const r = radius
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} style={{ borderRadius: r }}>
      {/* Bordure nette. */}
      <div className="absolute inset-0" style={{ borderRadius: r, border: `1.5px solid ${color}` }} />
      {/* Halos : proche + diffus. */}
      <div
        className="absolute inset-0"
        style={{ borderRadius: r, border: `1.5px solid ${color}`, opacity: 0.6, filter: 'blur(1px)' }}
      />
      <div
        className="absolute inset-0"
        style={{ borderRadius: r, border: `2px solid ${color}`, filter: 'blur(4px)' }}
      />
      {/* Lueur de fond, débordant légèrement. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: r,
          filter: 'blur(10px)',
          opacity: 0.3,
          background: `linear-gradient(-30deg, ${color}, transparent, ${color})`,
        }}
      />
    </div>
  )
}
