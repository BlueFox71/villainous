import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearSavedGame } from '../store/gamePersistence'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Garde-fou global : capture toute erreur de rendu (au lieu d'un écran blanc figé).
 * Comme la partie SOLO est reprise depuis `sessionStorage` au chargement, une partie
 * dans un état non rendable (ex. un vilain de brouillon testé puis rechargé) ferait
 * planter l'app à CHAQUE reload. On efface donc la partie sauvegardée dès qu'une erreur
 * survient, et on propose de recharger sur une base saine (menu).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Une partie sauvegardée corrompue/non rendable ne doit pas re-planter au reload.
    try {
      clearSavedGame()
    } catch {
      /* ignore */
    }
    // Trace pour le diagnostic (console navigateur).
    console.error('Erreur de rendu capturée par ErrorBoundary :', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: '#0b0a12',
          color: '#e5e7eb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 40 }}>🕯️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Une erreur est survenue</h1>
        <p style={{ maxWidth: 460, opacity: 0.8, fontSize: 14 }}>
          La partie en cours a été effacée pour éviter que le problème ne se reproduise. Recharge la
          page pour revenir au menu — tes vilains et ton profil sont conservés.
        </p>
        <pre
          style={{
            maxWidth: 560,
            maxHeight: 160,
            overflow: 'auto',
            fontSize: 11,
            opacity: 0.6,
            background: '#00000055',
            padding: 10,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {this.state.error.message}
        </pre>
        <button
          onClick={() => {
            // On repart proprement à la racine.
            window.location.href = '/'
          }}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: '1px solid #6d28d9',
            background: '#7c3aed',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Recharger le jeu
        </button>
      </div>
    )
  }
}
