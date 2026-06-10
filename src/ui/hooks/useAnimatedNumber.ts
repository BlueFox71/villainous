import { useEffect, useRef, useState } from 'react'

/**
 * Interpole un nombre cible (`target`) sur `durationMs` millisecondes, en
 * easing simple. Renvoie la valeur courante (entière) à afficher.
 *
 * Utilisation typique : `const shown = useAnimatedNumber(player.power)` —
 * quand `player.power` saute de 0 à 3, le retour défile 0→1→2→3 sur ~400 ms.
 */
export function useAnimatedNumber(target: number, durationMs = 400): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (target === value) return
    fromRef.current = value
    startRef.current = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - (startRef.current ?? now)
      const t = Math.min(1, elapsed / durationMs)
      // easeOutQuad
      const eased = 1 - (1 - t) * (1 - t)
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased)
      setValue(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // On dépend uniquement de `target` : les changements de `value`/`durationMs`
    // ne doivent pas relancer une nouvelle animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return value
}
