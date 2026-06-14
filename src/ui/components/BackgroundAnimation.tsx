import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { villainAnimation } from '../villainAnimations'
import type { VillainKey } from '../store/gameStore'

interface PropAnimProps {
  villain: VillainKey
  /** true = vilain du joueur (part de droite) ; false = adversaire (part de gauche). */
  isPlayer: boolean
  /** Index du camp (0/1) — sert à retrouver sa pile Fatalité (`data-fate-pile`). */
  playerIndex: number
}

/** Un décor de vilain qui passe à l'écran (UN passage). Deux trajectoires :
 *  - `cross` : traversée linéaire de la bande haute (joueur de gauche à droite,
 *    adversaire de droite à gauche), via les keyframes CSS.
 *  - `fate-to-sky` : décolle de la pile Fatalité du camp, s'élève au-dessus de la
 *    case « Tour » et sort par le haut (trajectoire calculée sur les éléments
 *    réels avec l'API Web Animations). */
function VillainProp({ villain, isPlayer, playerIndex }: PropAnimProps) {
  const anim = villainAnimation(villain)
  const ref = useRef<HTMLDivElement>(null)
  const path = anim?.path ?? 'cross'

  // Trajectoire ancrée (fate-to-sky) : calculée après montage sur les rects réels.
  useLayoutEffect(() => {
    if (path !== 'fate-to-sky') return
    const el = ref.current
    if (!el || !anim) return
    const fate = document.querySelector(`[data-fate-pile="${playerIndex}"]`)
    const turn = document.querySelector('[data-turn-indicator]')
    if (!fate || !turn) return
    const fr = fate.getBoundingClientRect()
    const tr = turn.getBoundingClientRect()
    const { width: w, height: h } = el.getBoundingClientRect()
    // Droite passant par le CENTRE de la pile Fatalité et le point « au-dessus de
    // la case Tour ». On l'étend au-delà de l'écran des deux côtés : entrée par
    // le bas (hors écran), sortie par le haut (hors écran). Trajet rectiligne.
    const fx = fr.left + fr.width / 2 // départ : centre pile Fatalité
    const fy = fr.top + fr.height / 2
    const tx = tr.left + tr.width / 2 // visée : juste au-dessus de « Tour »
    const ty = tr.top
    const dy = ty - fy // négatif (Tour est plus haut que la pile)
    const dx = tx - fx
    // x sur la droite pour une ordonnée y donnée (dy ≠ 0 ici : trajet ascendant).
    const xAt = (y: number) => (dy !== 0 ? fx + ((y - fy) * dx) / dy : fx)
    const yStart = window.innerHeight + h // sous le bas de l'écran
    const yEnd = -h // au-dessus du haut de l'écran
    // Coins haut-gauche pour que le centre du vaisseau suive la droite.
    const startX = xAt(yStart) - w / 2
    const startY = yStart - h / 2
    const endX = xAt(yEnd) - w / 2
    const endY = yEnd - h / 2
    const anim2 = el.animate(
      [
        { transform: `translate(${startX}px, ${startY}px)` },
        { transform: `translate(${endX}px, ${endY}px)` },
      ],
      { duration: (anim.durationSec ?? 10) * 1000, easing: 'linear', fill: 'both' },
    )
    return () => anim2.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!anim) return null
  const heightPct = anim.heightPct ?? 8
  const durationSec = anim.durationSec ?? 30

  if (path === 'fate-to-sky') {
    // Sens horizontal du déplacement (pile Fatalité → case Tour) pour orienter
    // l'image ; les rects ne sont pas connus au rendu, donc on se base sur le
    // camp : pile joueur (gauche) → va vers la droite ; adversaire → vers la gauche.
    const movingRight = isPlayer
    const flip = anim.facesLeft ? movingRight : !movingRight
    return (
      <div ref={ref} className="villain-prop villain-prop--free" style={{ height: `${heightPct}vh` }}>
        <img
          src={anim.image}
          alt=""
          className="h-full w-auto select-none"
          style={{ transform: flip ? 'scaleX(-1)' : undefined }}
          draggable={false}
        />
      </div>
    )
  }

  // Trajectoire `cross` : joueur de gauche à droite (LTR) ; adversaire l'inverse.
  const movingLeft = !isPlayer
  const flip = movingLeft ? !anim.facesLeft : !!anim.facesLeft
  return (
    <div
      className="villain-prop"
      style={{
        top: '1%',
        height: `${heightPct}vh`,
        animationName: movingLeft ? 'villainDriftRTL' : 'villainDriftLTR',
        animationDuration: `${durationSec}s`,
      }}
    >
      <img
        src={anim.image}
        alt=""
        className="h-full w-auto select-none opacity-90"
        style={{ transform: flip ? 'scaleX(-1)' : undefined }}
        draggable={false}
      />
    </div>
  )
}

interface Props {
  playerVillain: VillainKey
  opponentVillain: VillainKey
  playerIndex: number
  opponentIndex: number
  /** DEBUG : incrémenter pour forcer un passage immédiat du prop concerné. */
  replayPlayer?: number
  replayOpponent?: number
}

// Fenêtre aléatoire entre deux apparitions spontanées (ms).
const MIN_GAP_MS = 25_000
const MAX_GAP_MS = 70_000
// Marge ajoutée à la durée de traversée avant de démonter le prop.
const CLEANUP_BUFFER_MS = 1_500

/** Couche de décor animé en arrière-plan de la partie. Chaque vilain qui possède
 *  une animation envoie son prop traverser l'écran, à intervalles ALÉATOIRES. Le
 *  prop n'est monté que le temps de son passage. Posée au-dessus des panneaux
 *  mais sans interaction. */
export function BackgroundAnimation({
  playerVillain,
  opponentVillain,
  playerIndex,
  opponentIndex,
  replayPlayer = 0,
  replayOpponent = 0,
}: Props) {
  // `play` non-null = un passage est en cours ; sa valeur sert de clé de remontage
  // pour relancer l'animation depuis le début à chaque déclenchement.
  const [playerPlay, setPlayerPlay] = useState<number | null>(null)
  const [opponentPlay, setOpponentPlay] = useState<number | null>(null)
  const seq = useRef(0)
  const cleanupTimers = useRef<number[]>([])

  // Déclenche un passage du prop d'un côté, puis le démonte après sa traversée.
  const fire = (side: 'player' | 'opponent') => {
    const villain = side === 'player' ? playerVillain : opponentVillain
    const anim = villainAnimation(villain)
    if (!anim) return
    const id = ++seq.current
    const set = side === 'player' ? setPlayerPlay : setOpponentPlay
    set(id)
    const lifeMs = (anim.durationSec ?? 30) * 1000 + CLEANUP_BUFFER_MS
    const t = window.setTimeout(() => set((cur) => (cur === id ? null : cur)), lifeMs)
    cleanupTimers.current.push(t)
  }

  // Planificateur aléatoire : à intervalle variable, on envoie au hasard le prop
  // du joueur OU de l'adversaire (parmi ceux qui possèdent une animation).
  useEffect(() => {
    const sides = (['player', 'opponent'] as const).filter((s) =>
      villainAnimation(s === 'player' ? playerVillain : opponentVillain),
    )
    if (sides.length === 0) return
    let timer: number
    const schedule = () => {
      const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS)
      timer = window.setTimeout(() => {
        fire(sides[Math.floor(Math.random() * sides.length)])
        schedule()
      }, gap)
    }
    schedule()
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerVillain, opponentVillain])

  // DEBUG : un clic sur le bouton incrémente replayX → on force un passage.
  useEffect(() => {
    if (replayPlayer > 0) fire('player')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayPlayer])
  useEffect(() => {
    if (replayOpponent > 0) fire('opponent')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayOpponent])

  // Nettoyage des timers de démontage au démontage du composant.
  useEffect(() => () => cleanupTimers.current.forEach((t) => window.clearTimeout(t)), [])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }} aria-hidden>
      {playerPlay !== null && (
        <VillainProp key={`p-${playerPlay}`} villain={playerVillain} isPlayer playerIndex={playerIndex} />
      )}
      {opponentPlay !== null && (
        <VillainProp key={`o-${opponentPlay}`} villain={opponentVillain} isPlayer={false} playerIndex={opponentIndex} />
      )}
    </div>
  )
}
