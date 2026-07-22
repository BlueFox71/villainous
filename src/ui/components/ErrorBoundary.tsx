import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearSavedGame } from '../store/gamePersistence'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Garde-fou global : capture toute erreur et affiche une page d'erreur avec le message,
 * au lieu d'un écran blanc figé ou d'un crash silencieux. Trois sources :
 *  1. erreurs de RENDU React (getDerivedStateFromError / componentDidCatch) ;
 *  2. erreurs JS globales non capturées (`window.onerror`) ;
 *  3. rejets de promesse non gérés (`unhandledrejection`) — utile pour les flux ASYNC
 *     (sauvegarde / publication d'un vilain…) qu'une error boundary React n'attrape pas.
 * Comme la partie SOLO est reprise depuis `sessionStorage` au chargement, une partie dans un
 * état non rendable (ex. un vilain de brouillon testé puis rechargé) ferait planter l'app à
 * CHAQUE reload : on efface donc la partie sauvegardée sur une erreur de RENDU (pas sur une
 * erreur async, sans rapport avec l'état rendu), et on propose de recharger sur une base saine.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidMount() {
    window.addEventListener('error', this.onWindowError)
    window.addEventListener('unhandledrejection', this.onUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError)
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection)
  }

  /** N'affiche qu'UNE erreur (la première) : les suivantes n'écrasent pas l'écran affiché. */
  private showError = (error: Error) => {
    if (this.state.error) return
    console.error('Erreur capturée par ErrorBoundary :', error)
    this.setState({ error })
  }

  /** Erreur JS globale non capturée. On ignore les erreurs de chargement de RESSOURCE
   *  (img/script/audio en échec) : elles n'ont pas d'objet `error` et ne doivent pas
   *  masquer l'app d'une page d'erreur pour une simple vignette manquante. */
  private onWindowError = (event: ErrorEvent) => {
    const err = event.error instanceof Error ? event.error : event.message ? new Error(event.message) : null
    if (err) this.showError(err)
  }

  /** Rejet de promesse non géré (flux async : sauvegarde/publication…). */
  private onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const err = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : String(reason))
    this.showError(err)
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
        {/* Message d'erreur bien visible (l'intitulé du problème) — encadré, non estompé. */}
        <pre
          style={{
            maxWidth: 620,
            maxHeight: 220,
            overflow: 'auto',
            fontSize: 13,
            lineHeight: 1.4,
            color: '#fca5a5',
            background: '#00000066',
            border: '1px solid #7f1d1d',
            padding: '12px 14px',
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
            textAlign: 'left',
          }}
        >
          {this.state.error.message || String(this.state.error)}
        </pre>
        <p style={{ maxWidth: 460, opacity: 0.8, fontSize: 14 }}>
          Recharge la page pour revenir au menu — tes vilains et ton profil sont conservés.
        </p>
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
