import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Noms des deux joueurs (index 0 = vous, 1 = bot). */
  names: [string, string]
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
export function StartRollModal({ names, onResult }: Props) {
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
      // Cycle de valeurs aléatoires (~1,4 s).
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
        timers.current.push(window.setTimeout(() => onResult(w, [a, b]), 1500))
      }, 1400)
      timers.current.push(stop)
    }

    roll()
    return () => {
      cancelled = true
      clearAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-white/15 bg-[#120c22] p-8 text-white">
        <h2 className="text-xl font-bold text-amber-200">Qui commence ?</h2>
        <p className="text-center text-sm text-white/60">
          Chaque joueur lance un dé à 20 faces — le plus haut score commence.
        </p>
        <div className="flex items-center justify-center gap-8">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <Die value={dice[i]} rolling={rolling} win={winner === i} />
              <span
                className={`max-w-[10rem] truncate text-center text-sm font-semibold ${
                  winner === i ? 'text-amber-200' : 'text-white/70'
                }`}
              >
                {names[i]}
              </span>
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
  )
}
