import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FlightRect } from './CardFlights'
import { playDrawCard } from '../sfx'

// Durées (ms) du vol vers le centre et du rangement. Le maintien (`holdMs`) et le
// décalage de départ (`startDelay`) sont propres à chaque carte (cf. DealCard).
export const DEAL_FLY_IN = 460
export const DEAL_FLY_OUT = 380

/** Une carte à distribuer, entièrement auto-suffisante : trajectoire (pioche → centre
 *  → éventail), sens (face/dos), maintien et décalage de départ. Permet de mélanger dans
 *  un même overlay des cartes de joueurs différents (centres et tailles distincts) qui
 *  s'animent simultanément. */
export interface DealCard {
  instanceId: string
  /** Illustration montrée (face de la carte pour le joueur ; dos pour l'adversaire). */
  image: string
  /** Dos de carte (face cachée, et face « arrière » du retournement). */
  back: string
  /** Départ : sommet de la pioche Vilain. */
  pile: FlightRect
  /** Point d'agrandissement (centre écran pour le joueur, centre du plateau pour le bot). */
  center: FlightRect
  /** Arrivée : la case de la carte dans l'éventail. */
  slot: FlightRect
  /** Adversaire : on ne montre que le DOS (pas de retournement vers la face). */
  faceDown: boolean
  /** Maintien (ms) au centre (court si dos : rien à lire). */
  holdMs: number
  /** Décalage de départ (ms) pour séquencer la distribution. */
  startDelay: number
}

interface Props {
  cards: DealCard[]
  /** Appelé quand une carte atteint l'éventail (→ révéler la vraie carte). */
  onLanded: (instanceId: string) => void
  /** Appelé une fois toutes les cartes distribuées. */
  onComplete: () => void
}

type Phase = 'wait' | 'in' | 'hold' | 'out' | 'gone'

/** Une carte distribuée : pioche → centre (retournement + agrandissement) → maintien
 *  → rangement dans l'éventail. Purement décoratif. */
function DealtCard({ card, onLanded, z }: { card: DealCard; onLanded: (instanceId: string) => void; z: number }) {
  const [phase, setPhase] = useState<Phase>('wait')
  const { startDelay, holdMs } = card
  useEffect(() => {
    const timers: number[] = []
    timers.push(
      window.setTimeout(() => {
        setPhase('in')
        playDrawCard() // un son de pioche (variante au hasard) par carte
      }, startDelay),
    )
    if (card.faceDown) {
      // Adversaire (dos) : aucune mise en valeur — il file dans sa main puis se révèle
      // aussitôt arrivé (pas de maintien ni de « rangement » qui laisserait un dos posé
      // devant l'éventail). `center` vaut déjà sa case (pas de détour).
      timers.push(
        window.setTimeout(() => {
          setPhase('gone')
          onLanded(card.instanceId)
        }, startDelay + DEAL_FLY_IN),
      )
    } else {
      timers.push(window.setTimeout(() => setPhase('hold'), startDelay + DEAL_FLY_IN))
      timers.push(window.setTimeout(() => setPhase('out'), startDelay + DEAL_FLY_IN + holdMs))
      timers.push(
        window.setTimeout(() => {
          setPhase('gone')
          onLanded(card.instanceId)
        }, startDelay + DEAL_FLY_IN + holdMs + DEAL_FLY_OUT),
      )
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'gone') return null

  // Rectangle (écran) selon le temps en cours.
  const rect = phase === 'wait' ? card.pile : phase === 'out' ? card.slot : card.center
  // Durée de transition de position selon la phase (0 hors vol).
  const posMs = phase === 'in' ? DEAL_FLY_IN : phase === 'out' ? DEAL_FLY_OUT : 0
  // Retournement : dos (180°) tant qu'on attend, face (0°) dès l'arrivée au centre.
  // En `faceDown` (adversaire), on reste sur le dos en permanence.
  const flipped = card.faceDown || phase === 'wait'
  const flipMs = !card.faceDown && phase === 'in' ? DEAL_FLY_IN : 0
  const atCenter = phase === 'in' || phase === 'hold'

  return (
    <div
      className="pointer-events-none fixed"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        perspective: '1200px',
        // z-index DÉCROISSANT selon l'ordre de distribution : la 1ʳᵉ carte sortie reste
        // AU PREMIER PLAN, les suivantes passent derrière (elles forment la « pile » qui
        // se range). Sans ça, l'ordre du DOM mettait les dernières cartes devant.
        zIndex: z,
        transition: `left ${posMs}ms cubic-bezier(0.33,0,0.2,1), top ${posMs}ms cubic-bezier(0.33,0,0.2,1), width ${posMs}ms ease, height ${posMs}ms ease`,
      }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
          transition: `transform ${flipMs}ms cubic-bezier(0.33,0,0.2,1)`,
        }}
      >
        {/* Face (illustration de la carte). */}
        <img
          src={card.image}
          alt=""
          className="absolute inset-0 h-full w-full rounded-xl object-contain"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            // Halo doré uniquement pour la révélation FACE visible (joueur) ; jamais pour un dos.
            boxShadow: atCenter && !card.faceDown
              ? '0 18px 60px rgba(0,0,0,0.7), 0 0 30px rgba(251,191,36,0.45)'
              : '0 8px 24px rgba(0,0,0,0.6)',
          }}
        />
        {/* Dos (face cachée avant le retournement). */}
        <img
          src={card.back}
          alt=""
          className="absolute inset-0 h-full w-full rounded-xl object-contain"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * Animation de PIOCHE / distribution : chaque carte vole de sa pioche vers son point
 * d'agrandissement (centre de l'écran pour le joueur, centre de son plateau pour
 * l'adversaire) en se retournant (sauf `faceDown`), y est maintenue le temps d'être lue,
 * puis va se ranger dans l'éventail. Un son de pioche accompagne chaque carte. Overlay
 * purement décoratif : l'état du jeu contient déjà les mains ; ce composant ne fait que
 * les révéler. Des cartes de joueurs différents peuvent y coexister et s'animer en parallèle.
 */
export function OpeningDeal({ cards, onLanded, onComplete }: Props) {
  useEffect(() => {
    if (cards.length === 0) {
      onComplete()
      return
    }
    const total = cards.reduce(
      (m, c) => Math.max(m, c.startDelay + DEAL_FLY_IN + c.holdMs + DEAL_FLY_OUT),
      0,
    )
    const t = window.setTimeout(onComplete, total + 80)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rendu via PORTAIL sur <body> : l'overlay est sinon imbriqué dans le conteneur
  // racine de l'app (`isolate` → contexte d'empilement) ET dans la colonne défilable
  // (`Scroller`/OverlayScrollbars, qui crée aussi son contexte). Dans ces contextes,
  // un z-index élevé ne suffisait pas : au DÉCOLLAGE, la carte « sortait de derrière »
  // la pioche Vilain. En portant l'overlay sur <body>, son z-index est évalué à la
  // RACINE → garanti au-dessus de la pioche (et de toute l'UI de jeu).
  return createPortal(
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 78 }}>
      {cards.map((c, i) => (
        // 1ʳᵉ carte = z le plus élevé (premier plan) ; on décroît ensuite. Base 80
        // (> l'overlay 78) pour rester au-dessus du reste en cas de repli.
        <DealtCard key={c.instanceId} card={c} onLanded={onLanded} z={80 + (cards.length - i)} />
      ))}
    </div>,
    document.body,
  )
}
