/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PlayerState, ShowcaseEvent } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { VILLAIN_COLOR } from '../villainColors'
import { speedScaled } from '../botSpeed'

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
  /** Si vrai, on RETIENT le démarrage d'un nouveau showcase (rien de nouveau n'apparaît).
   *  Sert à attendre la fin du splash « À vous de jouer » avant de dérouler les révélations
   *  Combattant en début de tour. `busy` reste vrai tant qu'il reste des événements en file. */
  hold?: boolean
}

/**
 * Affiche la carte en grand au CENTRE de la colonne du joueur qui l'a jouée
 * (gauche pour l'humain, droite pour le bot). Si la carte a une `destination`
 * (Héros posé via Fatalité), le showcase « vole » vers le lieu cible pendant
 * la phase de fermeture.
 */
export function Showcase({ events, humanIndex, players, onHiddenIdsChange, onCardLanded, onBusyChange, hold = false }: Props) {
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
    if (hold) return // splash « À vous de jouer » en cours : on retient les révélations
    let next = cursor
    while (next < events.length) {
      const ev = events[next]
      // Les cartes jouées par le joueur HUMAIN n'ont pas de showcase (il sait ce
      // qu'il joue) — le showcase de carte n'est utile que pour le côté adverse.
      // Exceptions toujours montrées : les « défausses » (dont le Vanquish) et les
      // Héros qui « volent » vers un lieu (destination).
      const isHumanOwnCard =
        !ev.discard && !ev.destination && !ev.reveal && !ev.forceShow && ev.playerIndex === humanIndex
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
  }, [events, cursor, current, humanIndex, hold])

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
    // La durée est réduite par le multiplicateur de vitesse des bots (ORDI vs ORDI).
    const baseMs = speedScaled(current.durationMs ?? 3000)
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
  // Bordure animée : couleur du vilain ↔ noir (même dégradé pour les deux camps).
  const gradient = `linear-gradient(90deg, ${villainColor}, #000000, ${villainColor}, #000000)`

  // ---- Variante « révélation à suspense » : Une Petite Partie ? — les cartes se
  // dévoilent une à une, le coût total s'incrémente puis scintille, enfin le badge.
  if (current.reveal) {
    const left = isHuman ? '22%' : '78%'
    const backImage = players[current.playerIndex]?.backVillainImage ?? ''
    return (
      <div key="showcase-reveal" className="pointer-events-none fixed inset-0 z-[60]">
        <div
          className="absolute inset-0 bg-black/25 transition-opacity duration-300"
          style={{ opacity: closing ? 0 : 1 }}
        />
        <div
          className="absolute top-1/2 rounded-2xl p-[5px] shadow-2xl"
          style={{
            left,
            transform: `translate(-50%, -50%) scale(${closing ? 0.95 : 1})`,
            opacity: closing ? 0 : 1,
            backgroundImage: gradient,
            backgroundSize: '300% 100%',
            transition: 'transform 300ms ease, opacity 300ms ease',
            animation: `${closing ? '' : 'showcaseIn 300ms ease-out, '}showcaseBorder 2.5s linear infinite`,
          }}
        >
          {current.reveal.scry ? (
            <ScryDiscardShowcase
              cardIds={current.reveal.cardIds}
              costs={current.reveal.costs}
              discarded={current.reveal.discarded ?? current.reveal.cardIds.map(() => false)}
              message={current.message}
              backImage={backImage}
            />
          ) : (
            <RevealShowcase
              cardIds={current.reveal.cardIds}
              costs={current.reveal.costs}
              gainedPower={current.gainedPower ?? 0}
              backImage={backImage}
            />
          )}
        </div>
        <style>{`
          @keyframes showcaseIn { from { transform: translate(-50%, -50%) scale(0.85); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
          @keyframes showcaseBorder { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
        `}</style>
      </div>
    )
  }

  // Position : showcase centré sur la colonne du joueur qui joue (25 %/75 %).
  // En fermeture pour un Héros avec destination connue, on vole vers la case
  // Héros cible via un delta pixel calculé sur le DOM.
  const flying = closing && flyDelta !== null
  const left = isHuman ? '22%' : '78%'
  const scale = flying ? 0.18 : closing ? 0.95 : 1
  const dx = flying ? flyDelta!.dx : 0
  const dy = flying ? flyDelta!.dy : 0
  const opacity = closing && !flying ? 0 : flying ? 0.1 : 1
  // Révélation de Combattant (Sumbra / Kilaire) : `combattantExtras` est TOUJOURS défini pour
  // ces showcases (liste vide s'il n'y a pas d'extra) → sert à distinguer d'une carte normale.
  const isCombattant = current.combattantExtras !== undefined

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
          {/* Combattants (Sumbra / Kilaire) : révélation GROUPÉE en GRILLE (3 par ligne), tous
              affichés d'un coup — le revenu de début de tour ne défile plus un par un. Chaque
              carte porte ses pastilles (esprits / Pouvoir). Les cartes NON-Combattant gardent
              l'image unique en grand. */}
          {isCombattant ? (() => {
            // Liste unifiée : principale (pastilles portées par le showcase) + extras.
            const cards = [
              { cardId: current.cardId, spiritDelta: current.combattantSpiritDelta, powerDelta: current.combattantPowerDelta },
              ...(current.combattantExtras ?? []).map((ex) => ({ cardId: ex.cardId, spiritDelta: ex.spiritDelta, powerDelta: ex.powerDelta })),
            ]
            // Taille adaptée au nombre : 1 → très grande ; 2 → grande ; ≥3 → grille 3 par ligne.
            const n = cards.length
            const imgH = n === 1 ? 'h-[26rem]' : n === 2 ? 'h-80' : 'h-52'
            return (
              <div className="flex flex-wrap items-center justify-center gap-3" style={{ maxWidth: n >= 3 ? '34rem' : undefined }}>
                {cards.map((c, i) => {
                  const cd = getCardDef(c.cardId)
                  if (!cd?.image) return null
                  const sun = cd.spiritSun ?? 0
                  const moon = cd.spiritMoon ?? 0
                  const border = sun > moon ? '#3014ff' : moon > sun ? '#7a002f' : '#9ca3af'
                  return (
                    <div key={`${c.cardId}-${i}`} className="relative" style={{ animation: 'combattantAppear 300ms ease-out both' }}>
                      <img
                        src={cd.image}
                        alt={cd.name}
                        className={`${imgH} w-auto rounded-lg border-4 object-contain`}
                        style={{ aspectRatio: '63 / 88', borderColor: border }}
                      />
                      {c.spiritDelta !== undefined ? <SpiritBadge n={c.spiritDelta} camp={current.combattantCamp} /> : null}
                      {c.powerDelta ? <PowerBadge n={c.powerDelta} /> : null}
                    </div>
                  )
                })}
              </div>
            )
          })() : (
            <img
              src={def.image}
              alt={def.name}
              className="h-[28rem] w-auto rounded-lg object-contain"
              style={{ aspectRatio: '63 / 88' }}
            />
          )}
          {/* Cartes NON-Combattant (Événement/Condition) : pastille « +N JT » au coin de la boîte. */}
          {!isCombattant && current.gainedPower ? (
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
        @keyframes combattantAppear { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}

/** Pastille animée de variation de Pouvoir posée au coin supérieur droit de la carte parente
 *  (le parent doit être `relative`). `n` SIGNÉ : gain → « +N 🪙 » (or), perte → « −N 🪙 » (rouge).
 *  Utilisée sur chaque Combattant révélé dont le Pouvoir varie (⚡ Décharge). */
function PowerBadge({ n }: { n: number }) {
  const gain = n > 0
  return (
    <div
      className="pointer-events-none absolute -right-2 -top-3 z-20"
      style={{ animation: 'powerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both, powerFloat 1.8s ease-in-out 700ms infinite' }}
    >
      <span
        className={`flex items-center gap-1 rounded-full px-3 py-1 text-2xl font-black shadow-lg ring-2 ${
          gain ? 'bg-amber-400 text-amber-950 ring-amber-200' : 'bg-rose-500 text-rose-50 ring-rose-300'
        }`}
      >
        {gain ? `+${n}` : `−${Math.abs(n)}`}
        <img src="/jeton_pouvoir.png" alt="pouvoir" className="h-6 w-6 object-contain drop-shadow" />
      </span>
    </div>
  )
}

/** Pastille animée d'ESPRITS posée au coin supérieur GAUCHE de la carte parente (`relative`).
 *  `n` SIGNÉ : gain → « +N », perte → « −N », suivi de l'emoji du camp du joueur (🌑 Sumbra /
 *  ☀️ Kilaire), sur fond teinté camp (bordeaux moon / bleu sun). */
function SpiritBadge({ n, camp }: { n: number; camp?: 'sun' | 'moon' }) {
  const isSun = camp === 'sun'
  const bg = isSun ? '#3014ff' : '#7a002f'
  const emoji = isSun ? '☀️' : '🌑'
  return (
    <div
      className="pointer-events-none absolute -left-2 -top-3 z-20"
      style={{ animation: 'powerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both, powerFloat 1.8s ease-in-out 700ms infinite' }}
    >
      <span
        className="flex items-center gap-1 rounded-full px-3 py-1 text-2xl font-black text-white shadow-lg ring-2 ring-white/40"
        style={{ backgroundColor: bg }}
      >
        {n >= 0 ? `+${n}` : `−${Math.abs(n)}`}
        <span className="text-xl leading-none drop-shadow">{emoji}</span>
      </span>
    </div>
  )
}

/**
 * Contenu de la révélation « à suspense » (Une Petite Partie ?) : les cartes se
 * dévoilent une à une (1 s d'intervalle, dos avant dévoilement), un compteur de
 * coût total s'incrémente à chaque carte, scintille une fois toutes révélées,
 * puis le badge « +N JT » apparaît. Timeline interne synchronisée avec la durée
 * du showcase (cf. `pushRevealShowcase` côté moteur).
 */
function RevealShowcase({
  cardIds,
  costs,
  gainedPower,
  backImage,
}: {
  cardIds: string[]
  costs: number[]
  gainedPower: number
  backImage: string
}) {
  const n = cardIds.length
  const [revealed, setRevealed] = useState(0)
  const [total, setTotal] = useState(0)
  const [sparkle, setSparkle] = useState(false)
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    const timers: number[] = []
    cardIds.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setRevealed(i + 1)
          setTotal((t) => t + (costs[i] ?? 0))
        }, i * 1000),
      )
    })
    const sparkleAt = Math.max(0, n - 1) * 1000 + 700
    const badgeAt = sparkleAt + 700
    timers.push(window.setTimeout(() => setSparkle(true), sparkleAt))
    timers.push(
      window.setTimeout(() => {
        setSparkle(false)
        setShowBadge(true)
      }, badgeAt),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
    // Monté une fois par showcase (cardIds/costs constants pour cet événement).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-[#0b0a12] p-4">
      {/* Badge « +N JT » (style commun aux autres showcases) une fois le total révélé. */}
      {showBadge && gainedPower > 0 ? (
        <div
          className="pointer-events-none absolute -top-5 right-1 z-20"
          style={{ animation: 'powerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both, powerFloat 1.8s ease-in-out 700ms infinite' }}
        >
          <span className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-2xl font-black text-amber-950 shadow-lg ring-2 ring-amber-200">
            +{gainedPower}
            <img src="/jeton_pouvoir.png" alt="pouvoir" className="h-6 w-6 object-contain drop-shadow" />
          </span>
        </div>
      ) : null}

      {/* Cartes : dos tant que non dévoilée, recto à leur tour. */}
      <div className="flex flex-nowrap items-center justify-center gap-3">
        {cardIds.map((id, i) => {
          const def = getCardDef(id)
          const isUp = i < revealed
          return (
            <div key={`${id}-${i}`} className="relative" style={{ height: 256, aspectRatio: '63 / 88' }}>
              <img
                src={isUp ? def?.image : backImage}
                alt={isUp ? def?.name ?? '' : 'carte cachée'}
                className="h-full w-full rounded-lg object-contain"
                style={isUp ? { animation: 'revealFlip 360ms ease-out both' } : undefined}
              />
              {/* Pastille du coût de la carte, à son dévoilement. */}
              {isUp ? (
                <span
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-2 py-0.5 text-sm font-black text-white shadow ring-2 ring-sky-200"
                  style={{ animation: 'revealCostIn 300ms ease-out both' }}
                >
                  +{costs[i] ?? 0}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Compteur de coût total : s'incrémente à chaque carte, puis scintille. */}
      <div
        className="rounded-xl bg-white/5 px-5 py-1.5 text-center"
        style={sparkle ? { animation: 'revealSparkleBox 700ms ease-in-out 1' } : undefined}
      >
        <span className="text-[11px] uppercase tracking-wide text-white/50">Coût total</span>
        <div
          className="text-3xl font-black text-amber-200"
          style={sparkle ? { animation: 'revealSparkleText 700ms ease-in-out 1' } : undefined}
        >
          {total}
        </div>
      </div>

      <style>{`
        @keyframes revealFlip { from { transform: rotateY(90deg) scale(0.92); opacity: 0; } to { transform: rotateY(0deg) scale(1); opacity: 1; } }
        @keyframes revealCostIn { from { transform: translate(-50%, 6px) scale(0.6); opacity: 0; } to { transform: translate(-50%, 0) scale(1); opacity: 1; } }
        @keyframes revealSparkleBox { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); } 50% { box-shadow: 0 0 20px 5px rgba(251,191,36,0.8); } }
        @keyframes revealSparkleText { 0%,100% { text-shadow: none; transform: scale(1); } 50% { text-shadow: 0 0 16px rgba(251,191,36,0.95); transform: scale(1.28); } }
      `}</style>
    </div>
  )
}

/**
 * Contenu de la « scrutation + défausse » (Assommé Bêtement). Timeline en 4 temps,
 * synchronisée avec la durée du showcase (`n * 450 + 3600` ms côté moteur) :
 *  1) RÉVÈLE les cartes une à une (flip + pastille de coût) ;
 *  2) MARQUE : les cartes de coût ≥ seuil (`discarded`) virent au gris avec un
 *     tampon « Défaussé » qui pulse en rouge ;
 *  3) MÉLANGE : les défaussées tombent (vers la défausse), les conservées se
 *     retournent (dos) et tremblotent (mélange) ;
 *  4) DESSUS : les dos conservés remontent vers la mention « Sur le dessus de la
 *     pioche » avec un léger halo.
 */
function ScryDiscardShowcase({
  cardIds,
  costs,
  discarded,
  message,
  backImage,
}: {
  cardIds: string[]
  costs: number[]
  discarded: boolean[]
  message: string
  backImage: string
}) {
  const n = cardIds.length
  const [revealed, setRevealed] = useState(0)
  // step : 0 = révélation en cours, 1 = marquage défausse, 2 = mélange, 3 = pose sur la pioche.
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers: number[] = []
    cardIds.forEach((_, i) => {
      timers.push(window.setTimeout(() => setRevealed(i + 1), i * 450))
    })
    const markAt = n * 450 + 200
    timers.push(window.setTimeout(() => setStep(1), markAt))
    timers.push(window.setTimeout(() => setStep(2), markAt + 1000))
    timers.push(window.setTimeout(() => setStep(3), markAt + 2000))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // Monté une fois par showcase (props constantes pour cet événement).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const keptCount = discarded.filter((d) => !d).length

  return (
    <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-[#0b0a12] p-4">
      {/* Bandeau « Sur le dessus de la pioche » : apparaît à la dernière étape. */}
      <div
        className="flex items-center gap-2 text-sm font-black uppercase tracking-wide transition-all duration-300"
        style={{
          opacity: step >= 3 ? 1 : 0.35,
          color: step >= 3 ? '#fcd34d' : '#94a3b8',
          transform: step >= 3 ? 'translateY(0)' : 'translateY(4px)',
        }}
      >
        {step >= 3 ? `↑ ${keptCount} carte${keptCount > 1 ? 's' : ''} remise${keptCount > 1 ? 's' : ''} sur le dessus de la pioche` : 'Pioche du Méchant'}
      </div>

      <div className="flex flex-nowrap items-start justify-center gap-3">
        {cardIds.map((id, i) => {
          const def = getCardDef(id)
          const isUp = i < revealed
          const isDiscarded = discarded[i]
          // À partir du mélange : les défaussées tombent, les conservées passent dos.
          const showBack = step >= 2 && !isDiscarded
          const dropping = step >= 2 && isDiscarded
          const lifting = step >= 3 && !isDiscarded
          // Grise dès l'étape « marquage » pour les défaussées.
          const grayed = step >= 1 && isDiscarded
          return (
            <div
              key={`${id}-${i}`}
              className="relative transition-all duration-500"
              style={{
                height: 220,
                aspectRatio: '63 / 88',
                opacity: dropping ? 0 : 1,
                transform: dropping
                  ? 'translateY(48px) scale(0.8) rotate(-6deg)'
                  : lifting
                    ? 'translateY(-18px)'
                    : 'translateY(0)',
              }}
            >
              <img
                src={isUp ? (showBack ? backImage : def?.image) : backImage}
                alt={isUp ? def?.name ?? '' : 'carte cachée'}
                className="h-full w-full rounded-lg object-contain transition-all duration-500"
                style={{
                  filter: grayed ? 'grayscale(1) brightness(0.6)' : 'none',
                  boxShadow: lifting ? '0 0 16px 3px rgba(252,211,77,0.65)' : 'none',
                  animation: isUp && !showBack && i === revealed - 1 ? 'revealFlip 360ms ease-out both' : showBack ? 'scryShuffle 0.6s ease-in-out' : undefined,
                }}
              />
              {/* Pastille du coût (tant que la carte est visible de face). */}
              {isUp && !showBack ? (
                <span
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-sm font-black text-white shadow ring-2 ${grayed ? 'bg-rose-600 ring-rose-300' : 'bg-sky-500 ring-sky-200'}`}
                  style={{ animation: 'revealCostIn 300ms ease-out both' }}
                >
                  {costs[i] ?? 0}
                </span>
              ) : null}
              {/* Tampon « Défaussé » sur les cartes de coût ≥ seuil (étape marquage). */}
              {grayed && !showBack ? (
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 border-rose-400 bg-rose-900/70 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-rose-100"
                  style={{ animation: 'scryStamp 600ms cubic-bezier(0.34,1.56,0.64,1) both' }}
                >
                  Défaussé
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="max-w-[34rem] text-center text-[13px] font-semibold text-white/70">{message}</div>

      <style>{`
        @keyframes scryStamp { 0% { transform: translate(-50%, -50%) rotate(-12deg) scale(2.2); opacity: 0; } 60% { opacity: 1; } 100% { transform: translate(-50%, -50%) rotate(-12deg) scale(1); opacity: 1; } }
        @keyframes scryShuffle { 0% { transform: rotateY(0deg); } 25% { transform: translateX(-6px) rotate(-4deg); } 50% { transform: rotateY(180deg); } 75% { transform: translateX(6px) rotate(4deg); } 100% { transform: translateX(0) rotate(0deg); } }
      `}</style>
    </div>
  )
}
