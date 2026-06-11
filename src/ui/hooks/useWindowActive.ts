import { useEffect, useState } from 'react'

/**
 * Vrai tant que l'onglet est visible ET la fenêtre a le focus. Permet de couper
 * la musique quand l'utilisateur passe sur un autre onglet ou une autre fenêtre.
 */
export function useWindowActive(): boolean {
  const [active, setActive] = useState(
    () => typeof document === 'undefined' || (!document.hidden && document.hasFocus()),
  )
  useEffect(() => {
    const update = () => setActive(!document.hidden && document.hasFocus())
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    update()
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
    }
  }, [])
  return active
}
