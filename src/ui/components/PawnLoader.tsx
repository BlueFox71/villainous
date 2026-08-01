import { useEffect, useState } from 'react'
import { VILLAIN_REGISTRY } from '../store/gameStore'
import { DEFAULT_TINT_A } from '../villainColors'

// Cadence du carrousel : un pion « saute » dans l'écran (HOP_MS), se pose, puis laisse place
// à un autre (SWAP_MS > HOP_MS pour un court temps de pose avant le suivant).
const HOP_MS = 520
const SWAP_MS = 720

/** Un pion du carrousel : son image + sa hauteur CALIBRÉE (celle du plateau). */
export interface LoaderPawn {
  src: string
  /** `VillainDef.pawnHeightPx` — les pions ont des proportions très différentes. */
  heightPx: number
}

/**
 * Réservoir par défaut : les pions de tous les vilains natifs (le registre custom n'est pas
 * itérable ici ; on peut compléter via la prop `extraPawns`). Calculé une fois au chargement.
 * On garde la hauteur calibrée de chaque vilain : les sources sont de tailles très variables
 * (45×106 pour Maléfique, 1024×1024 pour Bowser) et seul `pawnHeightPx` donne l'échelle juste.
 */
const NATIVE_PAWNS: LoaderPawn[] = dedupe(
  Object.values(VILLAIN_REGISTRY).map((e) => ({
    src: e.def.pawnImage,
    heightPx: e.def.pawnHeightPx,
  })),
)

/** Dédoublonne par image (deux vilains peuvent partager un pion) et écarte les entrées vides. */
function dedupe(pawns: LoaderPawn[]): LoaderPawn[] {
  const by = new Map<string, LoaderPawn>()
  for (const p of pawns) if (p.src && p.heightPx > 0 && !by.has(p.src)) by.set(p.src, p)
  return [...by.values()]
}

// Gabarits : la BOÎTE est fixe (pas de saut de mise en page) et `scale` multiplie la hauteur
// calibrée du pion. On reste proche de l'échelle du plateau (~70→120 px) : au-delà, les petites
// sources (Prince Jean 64×79, Maléfique 45×106) sont agrandies et deviennent floues.
const SIZES = {
  sm: { box: 'h-24 w-24', scale: 0.75 },
  md: { box: 'h-32 w-32', scale: 1 },
  lg: { box: 'h-44 w-44', scale: 1.3 },
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
  extraPawns?: LoaderPawn[]
  className?: string
}

/**
 * Indicateur de chargement maison : des pions de vilains tirés au hasard « sautent » sur un
 * piédestal lumineux l'un après l'autre. Réutilisable partout où un contenu se charge (écran
 * de préparation de partie, liste des vilains de l'Atelier, rapports de dév…).
 */
export function PawnLoader({ label, size = 'md', tint = DEFAULT_TINT_A, extraPawns, className }: Props) {
  const [pool] = useState<LoaderPawn[]>(() =>
    extraPawns?.length ? dedupe([...NATIVE_PAWNS, ...extraPawns]) : NATIVE_PAWNS,
  )
  // Ordre courant + position, tenus ensemble pour rester synchrones lors du re-mélange de fin de tour.
  const [pos, setPos] = useState<{ order: LoaderPawn[]; idx: number }>(() => ({
    order: shuffled(pool),
    idx: 0,
  }))
  const [hopKey, setHopKey] = useState(0) // remonte l'<img> → rejoue l'animation d'entrée
  // Largeur RENDUE du pion courant, mesurée au chargement de l'image : le halo au sol s'y ajuste
  // (un socle fin comme Maléfique et un socle large comme Ratigan n'ont pas la même emprise).
  const [pawnW, setPawnW] = useState(0)

  useEffect(() => {
    if (pool.length <= 1) return
    const id = setInterval(() => {
      setPos(({ order, idx }) => {
        const next = idx + 1
        if (next < order.length) return { order, idx: next }
        // Fin de tour : on re-mélange, en évitant de reprendre le même pion qu'à l'instant.
        const last = order[idx]
        const reshuffled = shuffled(pool)
        if (reshuffled[0].src === last.src && reshuffled.length > 1) {
          ;[reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]]
        }
        return { order: reshuffled, idx: 0 }
      })
      setHopKey((k) => k + 1)
    }, SWAP_MS)
    return () => clearInterval(id)
  }, [pool])

  const s = SIZES[size]
  const pawn = pos.order[pos.idx]
  const h = Math.round(pawn.heightPx * s.scale)
  const haloW = Math.round(Math.max(28, pawnW * 1.15))

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
        {/* Halo/piédestal lumineux au sol, calé sur la largeur réelle du pion posé. */}
        <div
          className="absolute bottom-2 h-5 rounded-[50%] blur-md transition-[width] duration-200"
          style={{ width: haloW, background: `radial-gradient(closest-side, ${tint}aa, transparent)` }}
        />
        <img
          key={hopKey}
          src={pawn.src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            setPawnW(img.naturalHeight ? (img.naturalWidth / img.naturalHeight) * h : 0)
          }}
          className="relative w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]"
          style={{
            height: h,
            maxWidth: '100%',
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
