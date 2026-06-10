/**
 * Bordure « serpent » : un segment qui parcourt le contour de la case à VITESSE
 * CONSTANTE, avec une traîne en comète.
 *
 * Technique : un `<rect>` arrondi SVG dont on anime le `stroke-dashoffset` — le
 * tiret se déplace le long du PÉRIMÈTRE RÉEL (vitesse uniforme, contrairement à
 * un `conic-gradient` qui mappe l'angle et accélère dans les coins). `pathLength`
 * normalise la longueur du tracé à 100 → réglages indépendants de la taille de
 * la case (pas de mesure DOM). La comète = quelques tirets empilés d'opacité
 * décroissante (`--snake-o` animé, partagé via calc).
 */

/** Longueur normalisée du tracé (via `pathLength`). */
const LEN = 100
/** Nombre de segments de la comète (tête → traîne). */
const SEGMENTS = 9
/** Longueur d'un segment (en unités normalisées). Segments JOINTIFS (bouts plats)
 *  → bande continue dont l'opacité décroît, sans « perles ». */
const SEG_LEN = 2

interface Props {
  /** Couleur de la comète. */
  color?: string
  /** Rayon des coins (px) — à accorder avec le conteneur (rounded-lg = 8). */
  radius?: number
  /** Épaisseur du serpent (px). */
  width?: number
  /** Débord (px) hors du conteneur : place l'anneau à l'EXTÉRIEUR de la case. */
  outset?: number
  /** Durée d'un tour complet (s). */
  durationS?: number
  className?: string
}

/** Surcouche dessinant le serpent lumineux animé (à l'extérieur si `outset`). */
export function SnakeBorder({
  color = '#fbbf24',
  radius = 8,
  width = 4,
  outset = 0,
  durationS = 3,
  className = '',
}: Props) {
  const rx = radius + outset
  return (
    <div className={`pointer-events-none absolute ${className}`} style={{ inset: -outset }}>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {/* Deux serpents diamétralement opposés (décalage d'une demi-longueur). */}
        {[0, LEN / 2].map((head) =>
          Array.from({ length: SEGMENTS }).map((_, i) => (
            <rect
              key={`${head}-${i}`}
              x="0"
              y="0"
              width="100%"
              height="100%"
              rx={rx}
              ry={rx}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeLinecap="butt"
              pathLength={LEN}
              strokeDasharray={`${SEG_LEN} ${LEN - SEG_LEN}`}
              style={{
                // Tête (i=0) pleine, traîne de plus en plus pâle.
                opacity: 1 - i / SEGMENTS,
                // Chaque segment suit le précédent ; tous partagent `--snake-o`.
                strokeDashoffset: `calc(var(--snake-o, 0) + ${i * SEG_LEN + head})`,
                animation: `snakeTravel ${durationS}s linear infinite`,
              }}
            />
          )),
        )}
      </svg>
    </div>
  )
}
