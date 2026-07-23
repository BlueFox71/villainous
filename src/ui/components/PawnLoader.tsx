import { useEffect, useState } from 'react'
import { VILLAIN_REGISTRY } from '../store/gameStore'
import { DEFAULT_TINT_A } from '../villainColors'

// Cadence du carrousel : un pion « saute » dans l'écran (HOP_MS), se pose, puis laisse place
// à un autre (SWAP_MS > HOP_MS pour un court temps de pose avant le suivant).
const HOP_MS = 520
const SWAP_MS = 720

// Réservoir par défaut : les pions de tous les vilains natifs (le registre custom n'est pas
// itérable ici ; on peut compléter via la prop `extraPawns`). Calculé une fois au chargement.
const NATIVE_PAWNS: string[] = [
  ...new Set(Object.values(VILLAIN_REGISTRY).map((e) => e.def.pawnImage).filter(Boolean)),
]

// Gabarits : dimensions du pion + du halo au sol.
const SIZES = {
  sm: { box: 'h-24 w-24', img: 'h-20 w-20', halo: 'h-4 w-16' },
  md: { box: 'h-32 w-32', img: 'h-28 w-28', halo: 'h-5 w-24' },
  lg: { box: 'h-44 w-44', img: 'h-40 w-40', halo: 'h-6 w-28' },
} as const

// Mélange (Fisher-Yates). Purement présentation → `Math.random` autorisé (hors moteur).
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Props {
  /** Texte affiché sous les pions (ex. « Chargement des vilains… »). */
  label?: string
  /** Gabarit du pion. Défaut : `md`. */
  size?: keyof typeof SIZES
  /** Teinte du halo au sol (couleur du vilain courant, etc.). Défaut : ambre. */
  tint?: string
  /** Pions à ajouter au réservoir natif (ex. les vilains custom en jeu). */
  extraPawns?: string[]
  className?: string
}

/**
 * Indicateur de chargement maison : des pions de vilains tirés au hasard « sautent » sur un
 * piédestal lumineux l'un après l'autre. Réutilisable partout où un contenu se charge (écran
 * de préparation de partie, liste des vilains de l'Atelier, rapports de dév…).
 */
export function PawnLoader({ label, size = 'md', tint = DEFAULT_TINT_A, extraPawns, className }: Props) {
  const [pool] = useState<string[]>(() =>
    extraPawns?.length ? [...new Set([...NATIVE_PAWNS, ...extraPawns])] : NATIVE_PAWNS,
  )
  // Ordre courant + position, tenus ensemble pour rester synchrones lors du re-mélange de fin de tour.
  const [pos, setPos] = useState<{ order: string[]; idx: number }>(() => ({
    order: shuffled(pool),
    idx: 0,
  }))
  const [hopKey, setHopKey] = useState(0) // remonte l'<img> → rejoue l'animation d'entrée

  useEffect(() => {
    if (pool.length <= 1) return
    const id = setInterval(() => {
      setPos(({ order, idx }) => {
        const next = idx + 1
        if (next < order.length) return { order, idx: next }
        // Fin de tour : on re-mélange, en évitant de reprendre le même pion qu'à l'instant.
        const last = order[idx]
        const reshuffled = shuffled(pool)
        if (reshuffled[0] === last && reshuffled.length > 1) {
          ;[reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]]
        }
        return { order: reshuffled, idx: 0 }
      })
      setHopKey((k) => k + 1)
    }, SWAP_MS)
    return () => clearInterval(id)
  }, [pool])

  const s = SIZES[size]
  const src = pos.order[pos.idx]

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      {/* Keyframes du « saut » : arrive du haut, se pose avec un rebond, léger balancement. */}
      <style>{`
        @keyframes pawnHop {
          0%   { opacity: 0; transform: translateY(-46px) scale(0.55) rotate(-14deg); }
          55%  { opacity: 1; transform: translateY(6px)   scale(1.06) rotate(4deg); }
          78%  { transform: translateY(-3px) scale(0.98) rotate(-2deg); }
          100% { opacity: 1; transform: translateY(0)     scale(1)    rotate(0deg); }
        }
      `}</style>

      <div className={`relative flex items-end justify-center ${s.box}`}>
        {/* Halo/piédestal lumineux au sol. */}
        <div
          className={`absolute bottom-2 rounded-[50%] blur-md ${s.halo}`}
          style={{ background: `radial-gradient(closest-side, ${tint}aa, transparent)` }}
        />
        <img
          key={hopKey}
          src={src}
          alt=""
          draggable={false}
          className={`relative object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)] ${s.img}`}
          style={{
            animation: `pawnHop ${HOP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both`,
            transformOrigin: 'bottom center',
          }}
        />
      </div>

      {label && (
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/80">{label}</p>
      )}
    </div>
  )
}
