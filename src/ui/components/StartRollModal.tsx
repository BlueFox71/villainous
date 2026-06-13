import { useEffect, useRef, useState } from 'react'
import { PRESENTATION_TWEAK } from '../villainArt'
import type { VillainKey } from '../store/gameStore'

interface Props {
  /** Noms des deux joueurs (index 0 = vous, 1 = bot). */
  names: [string, string]
  /** Illustrations de présentation des deux vilains (gauche / droite). */
  images?: [string | undefined, string | undefined]
  /** Clés des deux vilains (gauche / droite) — pour appliquer leur réglage de
   *  présentation (échelle/décalage), comme sur l'écran de choix. */
  villainKeys?: [VillainKey, VillainKey]
  /** Appelé une fois le gagnant déterminé : (indexGagnant, [jet0, jet1]). */
  onResult: (winner: number, rolls: [number, number]) => void
}

const d20 = () => 1 + Math.floor(Math.random() * 20)

/** Un dé affiché (losange façon d20) avec le nombre courant. */
function Die({ value, rolling, win }: { value: number; rolling: boolean; win?: boolean }) {
  return (
    <div
      className={`flex h-24 w-24 items-center justify-center rounded-2xl border-2 text-4xl font-black transition-colors ${
        win
          ? 'border-amber-400 bg-amber-400/15 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.5)]'
          : 'border-white/25 bg-white/5 text-white'
      } ${rolling ? 'animate-pulse' : ''}`}
      style={{ transform: 'rotate(45deg)' }}
    >
      <span style={{ transform: 'rotate(-45deg)' }}>{value}</span>
    </div>
  )
}

/**
 * Jet de 1d20 de début de partie : chaque joueur lance, le plus haut commence.
 * Égalité → relance automatique. Animation puis annonce du gagnant.
 */
export function StartRollModal({ names, images, villainKeys, onResult }: Props) {
  const [dice, setDice] = useState<[number, number]>([1, 1])
  const [rolling, setRolling] = useState(true)
  const [winner, setWinner] = useState<number | null>(null)
  const [tie, setTie] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    let cancelled = false
    const clearAll = () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current.forEach((t) => window.clearInterval(t))
      timers.current = []
    }

    function roll() {
      if (cancelled) return
      setRolling(true)
      setTie(false)
      setWinner(null)
      // Cycle de valeurs aléatoires (~1,6 s).
      const spin = window.setInterval(() => setDice([d20(), d20()]), 70)
      timers.current.push(spin)
      const stop = window.setTimeout(() => {
        window.clearInterval(spin)
        if (cancelled) return
        const a = d20()
        const b = d20()
        setDice([a, b])
        setRolling(false)
        if (a === b) {
          // Égalité → on relance après une courte pause.
          setTie(true)
          timers.current.push(window.setTimeout(roll, 1100))
          return
        }
        const w = a > b ? 0 : 1
        setWinner(w)
        // Laisse le temps de lire l'annonce avant de lancer la partie (~6 s au total
        // avec l'intro animée + le jet, pour accompagner la voix « X contre Y »).
        timers.current.push(window.setTimeout(() => onResult(w, [a, b]), 2800))
      }, 1600)
      timers.current.push(stop)
    }

    // Démarrage différé : laisse l'écran « versus » s'animer (vilains qui glissent,
    // « CONTRE » qui apparaît) avant de lancer le jet de dés.
    timers.current.push(window.setTimeout(roll, 1600))
    return () => {
      cancelled = true
      clearAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/80 p-4"
      style={{ animation: 'versusFadeIn 0.4s ease-out both' }}
    >
      {/* Présentations des deux vilains, ancrées sur les bords (écran « versus »),
          qui glissent depuis l'extérieur à l'ouverture. Le réglage par vilain
          (échelle/décalage) est appliqué comme sur l'écran de choix. */}
      {([0, 1] as const).map((i) => {
        const src = images?.[i]
        if (!src) return null
        const left = i === 0
        const mirror = left ? 1 : -1
        const tweak = villainKeys ? PRESENTATION_TWEAK[villainKeys[i]] : undefined
        const dy = tweak?.versusDyPct ?? tweak?.dyPct ?? 0
        const transform = tweak
          ? `translate(${tweak.dxPct ?? 0}%, ${dy}%) scale(${tweak.scale ?? 1}) scaleX(${mirror})`
          : undefined
        return (
          <div
            key={i}
            className={`pointer-events-none absolute inset-y-0 z-0 hidden md:block ${left ? 'left-0' : 'right-0'}`}
            style={{ animation: `${left ? 'versusSlideL' : 'versusSlideR'} 0.7s ease-out both` }}
          >
            <img
              src={src}
              alt=""
              aria-hidden
              style={transform ? { transform, transformOrigin: 'bottom' } : undefined}
              className={`h-full w-auto max-w-[40vw] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.85)] ${
                left ? 'object-left' : tweak ? 'object-right' : '-scale-x-100 object-right'
              }`}
            />
          </div>
        )
      })}

      <div className="relative z-10 flex flex-col items-center gap-7">
        {/* Vilain 1 — CONTRE — Vilain 2. */}
        <div className="flex items-center justify-center gap-5">
          <span className="max-w-[12rem] truncate text-right text-xl font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            {names[0]}
          </span>
          <span
            className="text-5xl font-black tracking-[0.15em] text-amber-300 [text-shadow:0_3px_14px_rgba(0,0,0,0.95)]"
            style={{ animation: 'versusPop 0.6s ease-out 0.25s both' }}
          >
            CONTRE
          </span>
          <span className="max-w-[12rem] truncate text-left text-xl font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            {names[1]}
          </span>
        </div>

        {/* Panneau « Qui commence ? » (jet de dés), qui monte après l'intro. */}
        <div
          className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-white/15 bg-[#120c22]/85 p-6 backdrop-blur-sm"
          style={{ animation: 'versusRise 0.6s ease-out 0.5s both' }}
        >
          <h2 className="text-lg font-bold text-amber-200">Qui commence ?</h2>
          <div className="flex items-center justify-center gap-8">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <Die value={dice[i]} rolling={rolling} win={winner === i} />
              </div>
            ))}
          </div>
          <p className="h-6 text-center text-sm font-semibold">
            {tie ? (
              <span className="text-sky-300">Égalité — on relance !</span>
            ) : winner !== null ? (
              <span className="text-amber-300">{names[winner]} commence !</span>
            ) : (
              <span className="text-white/40">Lancer en cours…</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
