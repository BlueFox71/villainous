// =============================================================================
// Récap « tour adverse » : une bande chronologique O — O — O — O des actions
// jouées par l'adversaire pendant son tour (cf. GameState.lastTurnEvents). Chaque
// action est une icône (gabarit officiel) + un libellé ; le survol détaille
// l'effet (lignes de log produites) et montre la/les carte(s) concernée(s).
// =============================================================================
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TurnEvent, TurnEventKind, TurnRecap } from '../../engine/types'
import { getCardDef } from '../../data/registry'

/** Icône (public/actions/) et libellé par défaut de chaque catégorie d'action. */
const KIND_META: Record<TurnEventKind, { icon: string; fallback: string }> = {
  'play-card': { icon: '/actions/play-card.png', fallback: 'Jouer une carte' },
  fate: { icon: '/actions/fate.png', fallback: 'Fatalité' },
  discard: { icon: '/actions/discard.png', fallback: 'Défausser' },
  vanquish: { icon: '/actions/vanquish.png', fallback: 'Vaincre' },
  'move-hero': { icon: '/actions/move-hero.png', fallback: 'Déplacer un Héros' },
  'move-ally': { icon: '/actions/move-ally.png', fallback: 'Déplacer' },
  'gain-power': { icon: '/actions/power.png', fallback: 'Gagner du Pouvoir' },
  activate: { icon: '/actions/activate.png', fallback: 'Activer' },
}

/** Image du chiffre de Pouvoir gagné (1/2/3) ; au-delà on affiche le nombre en texte. */
const POWER_DIGIT: Record<number, string> = { 1: '/actions/1.png', 2: '/actions/2.png', 3: '/actions/3.png' }

function EventToken({ ev }: { ev: TurnEvent }) {
  // Position du tooltip : on capture le rectangle de l'icône au survol et on rend
  // le tooltip en `position: fixed` via un portal → il ÉCHAPPE à l'overflow de la
  // bande (qui sinon le rognerait) et s'affiche par-dessus tout.
  const anchorRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const meta = KIND_META[ev.kind]
  // Libellé sous l'icône : déplacements → « Carte → Lieu » ; sinon le label brut.
  const sub =
    ev.toLocationName && ev.label
      ? `${ev.label} → ${ev.toLocationName}`
      : ev.label ?? meta.fallback
  // Cartes à montrer dans le tooltip (carte principale + secondaires éventuelles).
  const cardIds = [ev.cardId, ...(ev.cardIds ?? [])].filter(Boolean) as string[]

  const show = () => setRect(anchorRef.current?.getBoundingClientRect() ?? null)
  const hide = () => setRect(null)

  return (
    <div
      ref={anchorRef}
      className="flex w-24 shrink-0 cursor-help flex-col items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <img src={meta.icon} alt={meta.fallback} className="h-16 w-16 object-contain drop-shadow" />
        {ev.kind === 'gain-power' && ev.amount !== undefined && (
          POWER_DIGIT[ev.amount] ? (
            <img src={POWER_DIGIT[ev.amount]} alt={`${ev.amount}`} className="absolute h-7 w-7 object-contain" />
          ) : (
            <span className="absolute text-lg font-bold text-amber-200">{ev.amount}</span>
          )
        )}
      </div>
      <span className="mt-1 line-clamp-2 text-center text-[11px] leading-tight text-amber-100/90">{sub}</span>

      {rect &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] w-64 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-slate-900/95 p-3 text-left shadow-2xl"
            style={{ left: rect.left + rect.width / 2, top: rect.bottom + 8 }}
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">{meta.fallback}</div>
            {cardIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {cardIds.map((id, i) => {
                  const def = getCardDef(id)
                  return def?.image ? (
                    <img key={`${id}-${i}`} src={def.image} alt={def.name} className="h-28 w-auto rounded border border-white/15" />
                  ) : null
                })}
              </div>
            )}
            {ev.detail.length > 0 ? (
              <ul className="space-y-0.5 text-[11px] leading-snug text-slate-200">
                {ev.detail.map((line, i) => (
                  <li key={i}>{stripMarkup(line)}</li>
                ))}
              </ul>
            ) : (
              <div className="text-[11px] italic text-slate-400">{sub}</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

/** Retire le **gras** Markdown des lignes de log pour l'affichage en tooltip. */
function stripMarkup(s: string): string {
  return s.replace(/\*\*/g, '')
}

export function OpponentTurnRecap({
  recap,
  onClose,
}: {
  recap: TurnRecap
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-x-0 top-16 z-[60] flex justify-center px-4"
      // Clic sur le fond (hors panneau) = fermeture.
      onClick={onClose}
    >
      <div
        className="pointer-events-auto max-w-[92vw] rounded-2xl border border-amber-400/40 bg-slate-950/95 px-5 py-4 shadow-2xl backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-6">
          <div className="text-sm font-semibold text-amber-200">
            Tour de {recap.villainName} — ce qu'il a fait
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Fermer ✕
          </button>
        </div>
        {recap.records.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            {recap.villainName} a passé son tour sans action notable.
          </div>
        ) : (
          <div className="flex items-start gap-1 overflow-x-auto pb-1">
            {recap.records.map((ev, i) => (
              <div key={i} className="flex items-start">
                {i > 0 && <div className="mt-7 px-1 text-2xl leading-none text-amber-400/50">—</div>}
                <EventToken ev={ev} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
