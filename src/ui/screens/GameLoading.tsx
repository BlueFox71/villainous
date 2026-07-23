import { useEffect, useRef, useState } from 'react'
import {
  useGameStore,
  villainKeyOf,
  villainEntry,
  VILLAIN_REGISTRY,
  type VillainKey,
} from '../store/gameStore'
import { villainDecor, decorAssets } from '../villainDecor'
import { VILLAIN_COLOR, DEFAULT_TINT_A, DEFAULT_TINT_B } from '../villainColors'

interface Props {
  /** Entrer dans la partie (le décor est préchargé). */
  onReady: () => void
  /** (Repli) revenir au menu. */
  onBack: () => void
}

// Affichage minimum (évite un flash quand tout est déjà en cache) et garde-fou : au-delà de
// SAFETY_MS on entre dans la partie quelle que soit la progression (on ne bloque JAMAIS le joueur
// si un asset ne se charge pas). Délai par vidéo : `loadeddata` peut tarder → on n'attend pas plus.
const MIN_MS = 3000
const SAFETY_MS = 9000
const PER_VIDEO_MS = 4500

// Cadence du carrousel de pions : un pion « saute » dans l'écran, se pose, puis laisse
// place à un autre. HOP_MS = durée de l'animation d'entrée ; SWAP_MS = intervalle entre
// deux pions (> HOP_MS pour laisser le pion se poser une fraction de seconde avant de partir).
const HOP_MS = 520
const SWAP_MS = 720

// Mélange (Fisher-Yates). Purement présentation → `Math.random` autorisé (hors moteur).
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Carrousel de pions du chargement : pioche des pions au hasard dans toute la galerie et
 * les fait « sauter » sur un piédestal lumineux l'un après l'autre. On parcourt un ordre
 * mélangé (aucune répétition immédiate) puis on re-mélange à chaque tour.
 */
function PawnCarousel({ pool, tint }: { pool: string[]; tint: string }) {
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

  const src = pos.order[pos.idx]

  return (
    <div className="relative flex h-44 w-44 items-end justify-center">
      {/* Halo/piédestal lumineux au sol. */}
      <div
        className="absolute bottom-3 h-6 w-28 rounded-[50%] blur-md"
        style={{ background: `radial-gradient(closest-side, ${tint}aa, transparent)` }}
      />
      <img
        key={hopKey}
        src={src}
        alt=""
        draggable={false}
        className="relative h-40 w-40 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]"
        style={{
          animation: `pawnHop ${HOP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both`,
          transformOrigin: 'bottom center',
        }}
      />
    </div>
  )
}

/**
 * Écran de chargement affiché DÈS la validation du choix des vilains, AVANT que le plateau
 * (et donc les décors animés) ne se montent. On y précharge les fichiers d'animation des décors
 * des deux vilains (images + première frame des vidéos) pour absorber le pic de saccade qui,
 * sinon, survient au montage du jeu. Best-effort : on continue même si un asset échoue ou traîne.
 */
export function GameLoading({ onReady }: Props) {
  // Vilains figés au montage (le state est déjà initialisé par `reset` / la synchro réseau).
  const [keys] = useState<VillainKey[]>(
    () => useGameStore.getState().state.players.map((p) => villainKeyOf(p.villain)) as VillainKey[],
  )
  const [progress, setProgress] = useState(0)

  // Réservoir de pions du carrousel : toute la galerie native + les pions des 2 vilains en
  // jeu (inclut les customs, absents du registre statique). Figé au montage, dédupliqué.
  const [pawnPool] = useState<string[]>(() => {
    const native = Object.values(VILLAIN_REGISTRY).map((e) => e.def.pawnImage)
    const inPlay = keys.map((k) => villainEntry(k)?.def.pawnImage).filter((s): s is string => !!s)
    return [...new Set([...native, ...inPlay].filter(Boolean))]
  })

  // `onReady` capturé dans une ref : l'effet de préchargement ne tourne qu'une fois et ne doit pas
  // redémarrer si le parent recrée le callback.
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    let cancelled = false
    let entered = false
    const enter = () => {
      if (entered || cancelled) return
      entered = true
      onReadyRef.current()
    }

    // Assets des décors des deux vilains, dédupliqués.
    const decors = keys.map(villainDecor).filter((d): d is NonNullable<typeof d> => !!d)
    const images = [...new Set(decors.flatMap((d) => decorAssets(d).images))]
    const videos = [...new Set(decors.flatMap((d) => decorAssets(d).videos))]
    const total = images.length + videos.length

    const start = performance.now()
    let loaded = 0
    const bump = () => {
      loaded += 1
      if (!cancelled) setProgress(total ? loaded / total : 1)
    }

    // Une image : on résout sur load comme sur erreur (best-effort, jamais bloquant).
    const loadImage = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = img.onerror = () => resolve()
        img.src = src
      })

    // Une vidéo : on amorce le décodage (preload auto) et on attend la première frame
    // (`loadeddata`) — ce qui amortit le démarrage coûteux du décodeur. Plafonné à PER_VIDEO_MS.
    const loadVideo = (src: string) =>
      new Promise<void>((resolve) => {
        const v = document.createElement('video')
        v.preload = 'auto'
        v.muted = true
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          resolve()
        }
        v.onloadeddata = done
        v.onerror = done
        v.src = src
        setTimeout(done, PER_VIDEO_MS)
      })

    const tasks = [
      ...images.map((s) => loadImage(s).then(bump)),
      ...videos.map((s) => loadVideo(s).then(bump)),
    ]

    void Promise.all(tasks).then(async () => {
      const elapsed = performance.now() - start
      if (elapsed < MIN_MS) await new Promise((r) => setTimeout(r, MIN_MS - elapsed))
      enter()
    })

    // Garde-fou : on entre quoi qu'il arrive au bout de SAFETY_MS.
    const safety = setTimeout(enter, SAFETY_MS)
    return () => {
      cancelled = true
      clearTimeout(safety)
    }
  }, [keys])

  const colorOf = (k: VillainKey) => VILLAIN_COLOR[k] ?? DEFAULT_TINT_A
  const pct = Math.round(progress * 100)

  return (
    <div
      className="relative flex h-screen flex-col items-center justify-center gap-10 overflow-hidden text-white"
      style={{
        backgroundImage: `radial-gradient(circle at 30% 40%, ${colorOf(keys[0])}cc, transparent 60%), radial-gradient(circle at 70% 60%, ${colorOf(keys[1]) ?? DEFAULT_TINT_B}cc, transparent 60%), linear-gradient(#0a0814, #0a0814)`,
      }}
    >
      {/* Keyframes du « saut » de pion : arrive du haut, se pose avec un rebond, léger balancement. */}
      <style>{`
        @keyframes pawnHop {
          0%   { opacity: 0; transform: translateY(-46px) scale(0.55) rotate(-14deg); }
          55%  { opacity: 1; transform: translateY(6px)   scale(1.06) rotate(4deg); }
          78%  { transform: translateY(-3px) scale(0.98) rotate(-2deg); }
          100% { opacity: 1; transform: translateY(0)     scale(1)    rotate(0deg); }
        }
      `}</style>

      {/* Logo Villainous (identique à l'accueil). */}
      <img
        src="/titre_villainous.png"
        alt="Disney Villainous"
        draggable={false}
        className="w-[40rem] max-w-[88vw] drop-shadow-[0_6px_24px_rgba(0,0,0,0.95)]"
      />

      {/* Pions qui sautent en boucle pendant le préchargement. */}
      <PawnCarousel pool={pawnPool} tint={colorOf(keys[0])} />

      <div className="flex w-72 flex-col items-center gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200/80">
          Préparation de la partie…
        </p>
        {/* Barre de progression du préchargement des décors. */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-300 transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
