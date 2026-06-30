import { useEffect, useRef, useState } from 'react'
import { PRESENTATION_TWEAK } from '../villainArt'
import type { VillainKey } from '../store/gameStore'
import {
  playStartBarDown,
  playStartBarFlip,
  playStartBarDrop,
  startStartBarFill,
  stopStartBarFill,
} from '../sfx'

interface Props {
  /** Noms des deux joueurs (index 0 = vous, 1 = bot). */
  names: [string, string]
  /** Illustrations de présentation des deux vilains (gauche / droite). */
  images?: [string | undefined, string | undefined]
  /** Clés des deux vilains (gauche / droite) — pour appliquer leur réglage de
   *  présentation (échelle/décalage), comme sur l'écran de choix. Peut être un id de
   *  vilain personnalisé (sans réglage → présentation par défaut). */
  villainKeys?: [string, string]
  /** Appelé une fois le gagnant déterminé : (indexGagnant, [jet0, jet1]).
   *  Ignoré en mode `versusOnly`. */
  onResult?: (winner: number, rolls: [number, number]) => void
  /** Réseau : présentation « versus » SANS jet de dé (l'hôte commence). On
   *  affiche juste l'écran d'intro puis on appelle `onDone`. */
  versusOnly?: boolean
  /** Appelé en fin d'intro `versusOnly`. */
  onDone?: () => void
  /** Fin de la voix d'intro (« X contre Y ») : tant que c'est `false`, on retarde
   *  l'apparition des dés. `true`/`undefined` = prêt (pas de voix à attendre). */
  voiceDone?: boolean
  /** Plateaux des deux joueurs (gauche / droite) : à la fermeture, chaque portrait
   *  se dirige vers l'extrémité GAUCHE de son plateau. */
  boardRefs?: readonly [React.RefObject<HTMLElement | null>, React.RefObject<HTMLElement | null>]
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
// Délais calés sur la DURÉE des bruitages pour ne pas les couper :
//  - DOWN_MS : laisse jouer « la barre descend » (1,04 s) AVANT les dés + la boucle ;
//  - SPIN_MS : durée du tirage ≈ une boucle de « remplissage » (1,44 s) ;
//  - ANNOUNCE_MS : temps de lecture du gagnant (le « flip » dure 0,45 s) ;
//  - DROP_MS : laisse jouer « la barre tombe » (1,21 s) AVANT de fermer l'écran.
const DOWN_MS = 1100
const SPIN_MS = 1450
const ANNOUNCE_MS = 1800
const DROP_MS = 1250
// Présentation minimale (cas voix coupée/absente : la « fin de voix » arrive tout
// de suite, on garde quand même un minimum d'intro) et garde-fou maximal (si la
// séquence de voix ne signale jamais sa fin, on lance quand même).
const MIN_PRESENT_MS = 1800
const MAX_PRESENT_MS = 7000

/**
 * Jet de 1d20 de début de partie : chaque joueur lance, le plus haut commence.
 * Égalité → relance automatique. Animation puis annonce du gagnant.
 */
export function StartRollModal({ names, images, villainKeys, onResult, versusOnly, onDone, voiceDone, boardRefs }: Props) {
  const [dice, setDice] = useState<[number, number]>([1, 1])
  const [rolling, setRolling] = useState(false)
  const [winner, setWinner] = useState<number | null>(null)
  const [tie, setTie] = useState(false)
  // Le jet de dés n'apparaît qu'APRÈS la présentation des deux joueurs ET la fin
  // de la voix d'intro.
  const [revealRoll, setRevealRoll] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)
  const [maxElapsed, setMaxElapsed] = useState(false)
  // Transition de fermeture : les portraits filent vers l'extrémité gauche de leur
  // plateau et l'écran s'efface (sur la durée du son « drop »).
  const [closing, setClosing] = useState(false)
  const portrait0 = useRef<HTMLDivElement>(null)
  const portrait1 = useRef<HTMLDivElement>(null)
  const portraitRefs = [portrait0, portrait1] as const
  // Décalage (px) à appliquer à chaque portrait pour rejoindre la gauche de son
  // plateau (calculé à la fermeture, une fois les positions mesurées).
  const [exits, setExits] = useState<({ tx: number; ty: number } | null)[]>([null, null])
  const timers = useRef<number[]>([])
  const cancelledRef = useRef(false)
  const startedRef = useRef(false)

  // À la fermeture : mesure la position de chaque portrait et de son plateau, et
  // calcule le décalage pour amener le portrait sur l'extrémité GAUCHE du plateau
  // (mouvement horizontal ; jamais vers le haut → ty borné à ≥ 0). On applique au
  // FRAME SUIVANT (rAF) pour que l'état initial soit peint d'abord → la transition
  // CSS se joue bien (sinon le navigateur saute directement à la cible).
  useEffect(() => {
    if (!closing) return
    const raf = window.requestAnimationFrame(() => {
      const next: ({ tx: number; ty: number } | null)[] = [null, null]
      for (const i of [0, 1] as const) {
        const p = portraitRefs[i].current
        const b = boardRefs?.[i]?.current
        if (!p || !b) continue
        const pr = p.getBoundingClientRect()
        const br = b.getBoundingClientRect()
        const ax = pr.left + pr.width / 2
        const ay = pr.top + pr.height / 2
        const targetX = br.left + br.width * 0.07
        // Vise la partie HAUTE du plateau (là où est l'illustration du vilain).
        const targetY = br.top + br.height * 0.28
        next[i] = { tx: targetX - ax, ty: Math.max(-300, targetY - ay) }
      }
      setExits(next)
    })
    return () => window.cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  // Cycle de vie : (ré)arme l'annulation au montage, nettoie tout au démontage.
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
      timers.current.forEach((t) => { window.clearTimeout(t); window.clearInterval(t) })
      timers.current = []
      stopStartBarFill()
    }
  }, [])

  // Réseau : pas de jet de dé (l'hôte commence) — on ferme après l'intro.
  useEffect(() => {
    if (!versusOnly) return
    const t = window.setTimeout(() => { if (!cancelledRef.current) onDone?.() }, 2800)
    timers.current.push(t)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versusOnly])

  // Minuteries de présentation : minimum (toujours) + garde-fou maximal.
  useEffect(() => {
    if (versusOnly) return
    const tMin = window.setTimeout(() => setMinElapsed(true), MIN_PRESENT_MS)
    const tMax = window.setTimeout(() => setMaxElapsed(true), MAX_PRESENT_MS)
    timers.current.push(tMin, tMax)
    return () => { window.clearTimeout(tMin); window.clearTimeout(tMax) }
  }, [versusOnly])

  function roll() {
    if (cancelledRef.current) return
    setRolling(true)
    setTie(false)
    setWinner(null)
    // Boucle sonore pendant que les dés tournent.
    startStartBarFill()
    const spin = window.setInterval(() => setDice([d20(), d20()]), 70)
    timers.current.push(spin)
    const stop = window.setTimeout(() => {
      window.clearInterval(spin)
      if (cancelledRef.current) return
      const a = d20()
      const b = d20()
      setDice([a, b])
      setRolling(false)
      stopStartBarFill()
      if (a === b) {
        // Égalité → on annonce (« flip ») puis on relance après une courte pause.
        setTie(true)
        playStartBarFlip()
        timers.current.push(window.setTimeout(roll, 1100))
        return
      }
      const w = a > b ? 0 : 1
      setWinner(w)
      // Son d'annonce du résultat (« flip »).
      playStartBarFlip()
      // Laisse lire l'annonce, PUIS joue « drop » en entier avant de fermer.
      timers.current.push(
        window.setTimeout(() => {
          if (cancelledRef.current) return
          // L'écran s'efface et les portraits rejoignent leur plateau, sur la durée
          // du son « drop », avant de lancer la partie.
          playStartBarDrop()
          setClosing(true)
          timers.current.push(window.setTimeout(() => onResult?.(w, [a, b]), DROP_MS))
        }, ANNOUNCE_MS),
      )
    }, SPIN_MS)
    timers.current.push(stop)
  }

  // Bouton « Passer » : stoppe toute animation/minuterie en cours, tire un résultat
  // définitif (jamais d'égalité) et affiche directement le gagnant, puis enchaîne la
  // fermeture comme la fin normale du lancer.
  function skip() {
    if (cancelledRef.current || versusOnly || winner !== null) return
    timers.current.forEach((t) => { window.clearTimeout(t); window.clearInterval(t) })
    timers.current = []
    stopStartBarFill()
    startedRef.current = true
    let a = d20()
    let b = d20()
    while (a === b) { a = d20(); b = d20() }
    const w = a > b ? 0 : 1
    setRevealRoll(true)
    setRolling(false)
    setTie(false)
    setDice([a, b])
    setWinner(w)
    playStartBarFlip()
    timers.current.push(
      window.setTimeout(() => {
        if (cancelledRef.current) return
        playStartBarDrop()
        setClosing(true)
        timers.current.push(window.setTimeout(() => onResult?.(w, [a, b]), DROP_MS))
      }, ANNOUNCE_MS),
    )
  }

  // Révèle les dés UNE seule fois : on attend la FIN de la voix d'intro adverse
  // (voiceDone) après une présentation minimale ; le garde-fou (maxElapsed) débloque
  // si la voix ne se termine jamais. Le son « la barre descend » joue en entier
  // avant que les dés (+ boucle) démarrent.
  useEffect(() => {
    if (versusOnly || startedRef.current) return
    const voiceReady = voiceDone !== false // undefined / true = rien à attendre
    if (!((minElapsed && voiceReady) || maxElapsed)) return
    startedRef.current = true
    // Différé d'un tick : apparition du panneau (« la barre descend ») puis, une
    // fois ce son joué, lancement des dés.
    const t = window.setTimeout(() => {
      if (cancelledRef.current) return
      playStartBarDown()
      setRevealRoll(true)
      timers.current.push(window.setTimeout(roll, DOWN_MS))
    }, 0)
    timers.current.push(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versusOnly, minElapsed, maxElapsed, voiceDone])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/80 p-4"
      style={{ animation: closing ? `versusFadeOut ${DROP_MS}ms ease-in forwards` : 'versusFadeIn 0.4s ease-out both' }}
    >
      {/* Présentations des deux vilains, ancrées sur les bords (écran « versus »),
          qui glissent depuis l'extérieur à l'ouverture. Le réglage par vilain
          (échelle/décalage) est appliqué comme sur l'écran de choix. */}
      {([0, 1] as const).map((i) => {
        const src = images?.[i]
        if (!src) return null
        const left = i === 0
        const mirror = left ? 1 : -1
        const tweak = villainKeys ? PRESENTATION_TWEAK[villainKeys[i] as VillainKey] : undefined
        const dy = tweak?.versusDyPct ?? tweak?.dyPct ?? 0
        // Art de côté : selectDxPct = décalage VERS LE CENTRE (gauche/joueur → droite,
        // droit/adversaire → gauche). Sinon le dxPct de la fiche.
        const dx = tweak?.selectDxPct != null ? tweak.selectDxPct * (left ? 1 : -1) : (tweak?.dxPct ?? 0)
        const transform = tweak
          ? `translate(${dx}%, ${dy}%) scale(${tweak.scale ?? 1}) scaleX(${mirror})`
          : undefined
        return (
          <div
            key={i}
            ref={portraitRefs[i]}
            className={`pointer-events-none absolute inset-y-0 z-0 hidden md:block ${left ? 'left-0' : 'right-0'}`}
            style={
              closing
                ? {
                    transformOrigin: 'center',
                    transition: `transform ${DROP_MS}ms cubic-bezier(0.4, 0, 0.6, 1)`,
                    transform: exits[i] ? `translate(${exits[i]!.tx}px, ${exits[i]!.ty}px) scale(0.2)` : undefined,
                  }
                : { animation: `${left ? 'versusSlideL' : 'versusSlideR'} 0.7s ease-out both` }
            }
          >
            <img
              src={src}
              alt=""
              aria-hidden
              style={transform ? { transform, transformOrigin: 'bottom' } : undefined}
              className={`villain-fade-bottom h-full w-auto max-w-[40vw] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.85)] ${
                left ? 'object-left' : tweak ? 'object-right' : '-scale-x-100 object-right'
              }`}
            />
          </div>
        )
      })}

      <div
        className="relative z-10 flex flex-col items-center gap-7"
        style={closing ? { animation: `versusPanelDrop ${DROP_MS}ms ease-in forwards` } : undefined}
      >
        {/* Vilain 1 — CONTRE — Vilain 2. */}
        <div className="flex items-center justify-center gap-5">
          <span className="max-w-[12rem] truncate text-right text-xl font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            {names[0]}
          </span>
          <span
            className="text-5xl font-black tracking-[0.15em] text-amber-300 [text-shadow:0_3px_14px_rgba(0,0,0,0.95)]"
            style={{ animation: 'versusPop 0.6s ease-out 0.25s both' }}
          >
            CONTRE
          </span>
          <span className="max-w-[12rem] truncate text-left text-xl font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            {names[1]}
          </span>
        </div>

        {/* Réseau (`versusOnly`) : simple annonce qui monte après l'intro. */}
        {versusOnly && (
          <div
            className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-white/15 bg-[#120c22]/85 p-6 backdrop-blur-sm"
            style={{ animation: 'versusRise 0.6s ease-out 0.5s both' }}
          >
            <h2 className="text-lg font-bold text-amber-200">La partie commence !</h2>
          </div>
        )}

        {/* Solo : le panneau « Qui commence ? » (jet de dés) n'apparaît qu'APRÈS la
            présentation des deux joueurs. */}
        {!versusOnly && revealRoll && (
          <div
            className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-white/15 bg-[#120c22]/85 p-6 backdrop-blur-sm"
            style={{ animation: 'versusRise 0.5s ease-out both' }}
          >
            <h2 className="text-lg font-bold text-amber-200">Qui commence ?</h2>
            <div className="flex items-center justify-center gap-8">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <Die value={dice[i]} rolling={rolling} win={winner === i} />
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
        )}
      </div>

      {/* Bouton « Passer » (bas droite) : saute l'animation des chiffres et affiche
          directement le résultat. Caché en réseau, une fois le gagnant connu ou à la fermeture. */}
      {!versusOnly && !closing && winner === null && (
        <button
          type="button"
          onClick={skip}
          className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Passer
          {/* Icône « lecture suivante » : double flèche vers la droite + barre. */}
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
            <path d="M5 6v12l7-6zM12 6v12l7-6zM19 6h2v12h-2z" />
          </svg>
        </button>
      )}

      <style>{`
        /* Fermeture : l'écran s'efface (sur la durée du son « drop »). Les portraits
           filent vers l'extrémité gauche de leur plateau via une transition calculée
           (cf. exits). Le panneau des dés glisse vers le bas. */
        @keyframes versusFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes versusPanelDrop {
          0% { transform: translateY(0); }
          100% { transform: translateY(54px); }
        }
      `}</style>
    </div>
  )
}
