import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Launcher } from './Launcher'

// Point d'entrée du LAUNCHER (2e page Vite, cf. launcher.html + vite.config.ts).
// Bundle distinct du jeu : il ne charge que les notes de version, pas le moteur.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Launcher />
  </StrictMode>,
)
