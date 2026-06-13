/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PlayerState, ShowcaseEvent } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { VILLAIN_COLOR } from '../villainColors'

// Position du showcase « défausse » par nombre de cartes, calée à la main. `top`
// commun aux deux camps ; `left` (joueur) et `leftBot` (adverse) dissociés. En %
// de la fenêtre. Ajouter/ajuster des entrées au fil des réglages.
const DISCARD_POS: Record<number, { top: number; left: number; leftBot: number }> = {
  1: { top: 51, left: 28, leftBot: 83 },
  2: { top: 51, left: 31, leftBot: 86 },
  3: { top: 47, left: 32, leftBot: 85 },
  4: { top: 46, left: 33, leftBot: 85 },
  5: { top: 45, left: 34, leftBot: 85 },
  6: { top: 45, left: 36, leftBot: 85 },
  7: { top: 46, left: 36, leftBot: 85 },
}
function discardPosition(isHuman: boolean, count: number): { left: string; top: string } {
  // Au-delà de 7 cartes, on reprend la position de 7.
  const p = DISCARD_POS[Math.min(count, 7)] ?? DISCARD_POS[7]
  return { left: `${isHuman ? p.left : p.leftBot}%`, top: `${p.top}%` }
}

interface Props {
  events: ShowcaseEvent[]
  /** Index du joueur humain (positionne à gauche s'il joue). */
  humanIndex: number
  players: PlayerState[]
  /** Notifie l'ensemble des instanceIds de Héros à masquer du plateau : tous ceux
   *  dont le showcase n'a pas encore atterri (courant + en file d'attente). */
  onHiddenIdsChange?: (instanceIds: string[]) => void
  /** Appelé quand un showcase se referme (utile pour les gains à l'atterrissage). */
  onCardLanded?: (ev: ShowcaseEvent) => void
  /** Notifie si un showcase est en cours/à venir dans la file (true) ou si tout
   *  est terminé (false). Sert à attendre la fin des showcases adverses avant de
   *  basculer au tour du joueur (le pilote du bot se met en pause). */
  onBusyChange?: (busy: boolean) => void
}

/**
 * Affiche la carte en grand au CENTRE de la colonne du joueur qui l'a jouée
 * (gauche pour l'humain, droite pour le bot). Si la carte a une `destination`
 * (Héros posé via Fatalité), le showcase « vole » vers le lieu cible pendant
 * la phase de fermeture.
 */
export function Showcase({ events, humanIndex, players, onHiddenIdsChange, onCardLanded, onBusyChange }: Props) {
  const [cursor, setCursor] = useState(events.length)
  const [current, setCurrent] = useState<ShowcaseEvent | null>(null)
  const [closing, setClosing] = useState(false)
  // Delta pixel (dx, dy) à ajouter au transform pour que le showcase « vole »
  // jusqu'au centre de la case Héros de destination. Calculé au moment où
  // `closing` passe à true et qu'une destination est définie.
  const [flyDelta, setFlyDelta] = useState<{ dx: number; dy: number } | null>(null)

  // Reset si la file rétrécit (nouvelle partie).
  if (events.length < cursor) {
    setCursor(events.length)
    if (current) {
      setCurrent(null)
      setClosing(false)
      setFlyDelta(null)
    }
  }

  // 1) Sortir le prochain événement de la file si rien n'est affiché. On saute
  // les Malédictions jouées par le joueur humain (pas besoin de showcase).
  // useLayoutEffect = exécute AVANT la peinture, pour qu'un héros à masquer
  // ne flashe pas une frame avant d'être caché.
  useLayoutEffect(() => {
    if (current) return
    let next = cursor
    while (next < events.length) {
      const ev = events[next]
      // Les cartes jouées par le joueur HUMAIN n'ont pas de showcase (il sait ce
      // qu'il joue) — le showcase de carte n'est utile que pour le côté adverse.
      // Exceptions toujours montrées : les « défausses » (dont le Vanquish) et les
      // Héros qui « volent » vers un lieu (destination).
      const isHumanOwnCard = !ev.discard && !ev.destination && ev.playerIndex === humanIndex
      if (isHumanOwnCard) {
        next++
        continue
      }
      setCurrent(ev)
      setClosing(false)
      setFlyDelta(null)
      if (next !== cursor) setCursor(next)
      return
    }
    if (next !== cursor) setCursor(next)
  }, [events, cursor, current, humanIndex])

  // 2) Programmer la fermeture quand un événement est affiché.
  // useLayoutEffect pour la NOTIFICATION (cacher la carte avant la peinture),
  // useEffect pour les timers (qui sont indépendants du timing de la peinture).
  // Masque TOUS les Héros dont le showcase n'a pas encore atterri (courant + en
  // file). Les cartes posées sur le plateau (engine) le sont avant que leur
  // showcase ne joue : sans ça, un Héros en file (ex. Robin après une défausse)
  // « flashe » sur le plateau pendant le showcase précédent. `cursor` = nombre
  // d'événements déjà consommés/atterris → events.slice(cursor) sont les pending.
  useLayoutEffect(() => {
    const ids = events.slice(cursor).map((e) => e.cardInstanceId).filter((x): x is string => !!x)
    onHiddenIdsChange?.(ids)
  }, [events, cursor, onHiddenIdsChange])
  useEffect(() => {
    if (!current) return
    // Mode « fixe » (test) : reste affiché jusqu'à fermeture manuelle.
    if (current.fixed) return
    // Défausse : 1 s de moins (montre la/les cartes retirées plus brièvement).
    const baseMs = current.durationMs ?? 3000
    const totalMs = current.discard ? Math.max(1200, baseMs - 1000) : baseMs
    const flightMs = current.destination
      ? Math.min(700, totalMs)
      : current.discard
        ? Math.min(450, totalMs)
        : Math.min(300, totalMs)
    const showMs = Math.max(0, totalMs - flightMs)
    const t1 = window.setTimeout(() => {
      if (current.destination) {
        const dest = current.destination
        const villain = players[dest.playerIndex]?.villain
        const sel = `[data-hero-cell="${villain}:${dest.locationId}"]`
        const el = document.querySelector(sel) as HTMLElement | null
        if (el) {
          const rect = el.getBoundingClientRect()
          const targetX = rect.left + rect.width / 2
          const targetY = rect.top + rect.height / 2
          const restingX = window.innerWidth * (current.playerIndex === humanIndex ? 0.22 : 0.78)
          const restingY = window.innerHeight * 0.5
          setFlyDelta({ dx: targetX - restingX, dy: targetY - restingY })
        }
      } else if (current.discard) {
        // À la fermeture, la boîte « file » vers la pile de défausse du joueur.
        const pile = document.querySelector(`[data-discard-pile="${current.playerIndex}"]`) as HTMLElement | null
        const box = discardBoxRef.current
        if (pile && box) {
          const pr = pile.getBoundingClientRect()
          const br = box.getBoundingClientRect()
          setFlyDelta({
            dx: pr.left + pr.width / 2 - (br.left + br.width / 2),
            dy: pr.top + pr.height / 2 - (br.top + br.height / 2),
          })
        }
      }
      setClosing(true)
    }, showMs)
    const t2 = window.setTimeout(() => {
      onCardLanded?.(current)
      setCurrent(null)
      setCursor((c) => c + 1)
    }, totalMs)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [current, players, humanIndex, onCardLanded])

  // Fermeture manuelle (mode « fixe »).
  const dismiss = () => {
    setClosing(false)
    setFlyDelta(null)
    setCurrent(null)
    setCursor((c) => c + 1)
  }

  // Largeur mesurée de la boîte « défausse » (pour la borner dans la fenêtre et
  // éviter qu'elle déborde du bord quand il y a beaucoup de cartes).
  const discardBoxRef = useRef<HTMLDivElement>(null)
  const [discardBoxW, setDiscardBoxW] = useState(0)
  useLayoutEffect(() => {
    setDiscardBoxW(discardBoxRef.current?.offsetWidth ?? 0)
  }, [current])

  // Un showcase est affiché ou en attente tant que `current` existe OU qu'il reste
  // des événements non consommés dans la file. Notifie le parent pour qu'il puisse
  // attendre la fin (ex. ne basculer au tour du joueur qu'ensuite).
  const busy = current !== null || cursor < events.length
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  if (!current) return null
  const def = getCardDef(current.cardId)
  if (!def) return null

  // ---- Variante « défausse » : plusieurs cartes retirées montrées côte à côte.
  if (current.discard) {
    const { cardIds, variant, anchor = 'center' } = current.discard
    const cards = cardIds.map((id) => getCardDef(id)).filter((d): d is NonNullable<typeof d> => !!d)
    if (cards.length === 0) return null
    const isHumanDiscard = current.playerIndex === humanIndex
    const { left: onSide, top } =
      anchor === 'bottom'
        ? discardPosition(isHumanDiscard, cards.length)
        : { left: isHumanDiscard ? '22%' : '78%', top: '50%' }
    // Centre voulu (px) borné pour rester dans la fenêtre (la boîte est large
    // quand il y a beaucoup de cartes → sinon elle déborde côté adverse).
    const margin = 12
    const half = discardBoxW / 2
    const wantX = (parseFloat(onSide) / 100) * window.innerWidth
    const centerX = discardBoxW
      ? Math.min(Math.max(wantX, half + margin), window.innerWidth - half - margin)
      : wantX
    // À la fermeture : vol vers la pile de défausse (rétrécit + s'estompe).
    const flyingDiscard = closing && flyDelta !== null
    const dDx = flyingDiscard ? flyDelta!.dx : 0
    const dDy = flyingDiscard ? flyDelta!.dy : 0
    const scale = flyingDiscard ? 0.1 : closing ? 0.92 : 1
    const opacity = flyingDiscard ? 0.15 : closing ? 0 : 1
    // Couleur du vilain du camp concerné (défausse foncée).
    const discardVillain = players[current.playerIndex]?.villain
    const discardColor = (discardVillain && VILLAIN_COLOR[discardVillain]) ?? '#334155'
    // Rouge clignotant (retiré par une attaque) vs encadré foncé + couleur du
    // vilain qui défile lentement (défausse volontaire).
    const frame =
      variant === 'red'
        ? {
            background: 'linear-gradient(180deg, #dc2626, #7f1d1d)',
            size: '100% 100%',
            anim: 'discardRedPulse 0.7s ease-in-out infinite',
          }
        : {
            background: `linear-gradient(90deg, #0b0a12, ${discardColor}, #0b0a12, ${discardColor}, #0b0a12)`,
            size: '300% 100%',
            anim: 'discardScroll 6s linear infinite',
          }
    return (
      // `key` distincte de la variante « carte » : empêche React de réutiliser le
      // même DOM entre une défausse et un showcase de carte/héros (sinon le
      // transform en cours « glisse » d'une position à l'autre).
      <div key="showcase-discard" className="pointer-events-none fixed inset-0 z-[60]">
        <div
          ref={discardBoxRef}
          className="absolute w-max -translate-x-1/2 -translate-y-1/2 rounded-2xl p-[5px] shadow-2xl"
          style={{
            left: `${centerX}px`,
            top,
            transform: `translate(-50%, -50%) translate(${dDx}px, ${dDy}px) scale(${scale})`,
            opacity,
            backgroundImage: frame.background,
            backgroundSize: frame.size,
            transition: flyingDiscard
              ? 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1), opacity 450ms ease-out'
              : 'transform 300ms ease, opacity 300ms ease',
            animation: `${closing ? '' : 'showcaseIn 300ms ease-out, '}${frame.anim}`,
          }}
        >
          <div className="relative flex flex-col items-center gap-2 rounded-2xl bg-[#0b0a12] p-3">
            {current.fixed && (
              <button
                onClick={dismiss}
                className="pointer-events-auto absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-black shadow-lg hover:bg-white"
              >
                ✕
              </button>
            )}
            {/* Gain de combat (« +N 🪙 » : Flèche d'Or, Rouet, JT verrouillés rendus). */}
            {current.gainedPower ? (
              <div
                className="pointer-events-none absolute -top-5 right-1 z-20"
                style={{ animation: 'powerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both, powerFloat 1.8s ease-in-out 700ms infinite' }}
              >
                <span className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-2xl font-black text-amber-950 shadow-lg ring-2 ring-amber-200">
                  +{current.gainedPower}
                  <img src="/jeton_pouvoir.png" alt="pouvoir" className="h-6 w-6 object-contain drop-shadow" />
                </span>
              </div>
            ) : null}
            <div className="flex flex-nowrap items-center justify-center gap-2">
              {cards.map((c, i) => (
                <img
                  key={`${c.id}-${i}`}
                  src={c.image}
                  alt={c.name}
                  // Niveaux de gris + léger assombrissement : signale que la/les
                  // carte(s) partent à la défausse (retirées du jeu).
                  className="w-auto rounded-lg object-contain grayscale brightness-75"
                  // ≤2 cartes : grandes (256px). Au-delà, on rétrécit pour tenir
                  // sur une seule ligne (plancher 110px). aspect-ratio fixe → largeur
                  // connue avant chargement (pas de recentrage/décalage de la boîte).
                  style={{
                    height: cards.length <= 2 ? 256 : Math.max(110, Math.floor(520 / cards.length)),
                    aspectRatio: '63 / 88',
                    animation: `discardCardIn 300ms ease-out ${i * 90}ms both`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes showcaseIn { from { transform: translate(-50%, -50%) scale(0.85); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
          @keyframes discardCardIn { from { transform: scale(0.6) translateY(-12px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
          @keyframes discardRedPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.0), 0 0 18px 2px rgba(220,38,38,0.45); filter: brightness(1); } 50% { box-shadow: 0 0 0 4px rgba(248,113,113,0.85), 0 0 36px 8px rgba(220,38,38,0.85); filter: brightness(1.25); } }
          @keyframes discardScroll { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
        `}</style>
      </div>
    )
  }

  const isHuman = current.playerIndex === humanIndex
  const playerVillain = players[current.playerIndex]?.villain
  const villainColor = (playerVillain && VILLAIN_COLOR[playerVillain]) ?? '#ffffff'
  const gradient = isHuman
    ? `linear-gradient(90deg, #38bdf8, #818cf8, ${villainColor}, #38bdf8)`
    : `linear-gradient(90deg, #f87171, #fb923c, ${villainColor}, #f87171)`

  // Position : showcase centré sur la colonne du joueur qui joue (25 %/75 %).
  // En fermeture pour un Héros avec destination connue, on vole vers la case
  // Héros cible via un delta pixel calculé sur le DOM.
  const flying = closing && flyDelta !== null
  const left = isHuman ? '22%' : '78%'
  const scale = flying ? 0.18 : closing ? 0.95 : 1
  const dx = flying ? flyDelta!.dx : 0
  const dy = flying ? flyDelta!.dy : 0
  const opacity = closing && !flying ? 0 : flying ? 0.1 : 1

  return (
    <div key="showcase-card" className="pointer-events-none fixed inset-0 z-[60]">
      {/* Voile sombre — fade-out classique (pas de vol). */}
      <div
        className="absolute inset-0 bg-black/25 transition-opacity duration-300"
        style={{ opacity: closing ? 0 : 1 }}
      />
      <div
        className="absolute top-1/2 rounded-2xl p-[5px] shadow-2xl"
        style={{
          left,
          // translate(-50%, -50%) = centrage ; translate(dx, dy) = vol vers cible.
          transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${scale})`,
          opacity,
          backgroundImage: gradient,
          backgroundSize: '300% 100%',
          transition: flying
            ? 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1), opacity 700ms ease-out'
            : 'transform 300ms ease, opacity 300ms ease',
          animation: `${closing ? '' : 'showcaseIn 300ms ease-out, '}showcaseBorder 2.5s linear infinite`,
        }}
      >
        <div className="relative flex flex-col items-center gap-2 rounded-2xl bg-[#0b0a12] p-3">
          {current.fixed && (
            <button
              onClick={dismiss}
              className="pointer-events-auto absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-black shadow-lg hover:bg-white"
            >
              ✕
            </button>
          )}
          {/* aspect-ratio fixe : la largeur est connue AVANT le chargement de
              l'image → plus de décalage du showcase quand l'image se charge. */}
          <img
            src={def.image}
            alt={def.name}
            className="h-[28rem] w-auto rounded-lg object-contain"
            style={{ aspectRatio: '63 / 88' }}
          />
          {/* Animation « +N JT » quand la carte fait gagner du pouvoir. */}
          {current.gainedPower ? (
            <div
              className="pointer-events-none absolute -top-5 right-1 z-20"
              style={{ animation: 'powerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both, powerFloat 1.8s ease-in-out 700ms infinite' }}
            >
              <span className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-2xl font-black text-amber-950 shadow-lg ring-2 ring-amber-200">
                +{current.gainedPower}
                <img src="/jeton_pouvoir.png" alt="pouvoir" className="h-6 w-6 object-contain drop-shadow" />
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <style>{`
        @keyframes showcaseIn { from { transform: translate(-50%, -50%) scale(0.85); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
        @keyframes showcaseBorder { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
      `}</style>
    </div>
  )
}
