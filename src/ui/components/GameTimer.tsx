import { useEffect, useRef, useState } from 'react'

/** Chronomètre de partie (format MM:SS). Démarre au premier rendu où `running`
 *  est vrai et se fige dès qu'il repasse à faux (fin de partie) — la durée
 *  affichée correspond donc au temps de jeu écoulé. */
export function GameTimer({ running }: { running: boolean }) {
  const startRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!running) return
    if (startRef.current === null) startRef.current = Date.now()
    const tick = () => setElapsedMs(Date.now() - (startRef.current ?? Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running])

  const total = Math.floor(elapsedMs / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return (
    <span>
      {mm}:{ss}
    </span>
  )
}
