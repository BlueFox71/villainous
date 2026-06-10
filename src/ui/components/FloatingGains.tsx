import { useEffect } from 'react'

/** Un gain de pouvoir flottant à une position écran (« +N 🪙 »). */
export interface FloatingGain {
  id: number
  amount: number
  /** Centre horizontal (px écran). */
  x: number
  /** Position verticale de départ (px écran). */
  y: number
}

function GainBubble({ gain, onDone }: { gain: FloatingGain; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDone(gain.id), 1100)
    return () => window.clearTimeout(t)
  }, [gain.id, onDone])
  return (
    <div
      className="pointer-events-none fixed z-[58]"
      style={{ left: `${gain.x}px`, top: `${gain.y}px`, animation: 'gainFloat 1.1s ease-out forwards' }}
    >
      <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-lg font-black text-amber-950 shadow-lg ring-2 ring-amber-200">
        +{gain.amount}
        <img src="/jeton_pouvoir.png" alt="" className="h-4 w-4 object-contain" />
      </span>
    </div>
  )
}

/** Overlay des gains de pouvoir flottants (Shérif +1, etc.). Décoratif. */
export function FloatingGains({ gains, onDone }: { gains: FloatingGain[]; onDone: (id: number) => void }) {
  if (gains.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[58]">
      {gains.map((g) => (
        <GainBubble key={g.id} gain={g} onDone={onDone} />
      ))}
    </div>
  )
}
