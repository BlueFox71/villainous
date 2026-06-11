import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cartes du royaume dont la capacité peut être activée. */
  cards: CardInstance[]
  onPick: (card: CardInstance) => void
  onClose: () => void
}

/** Choix de la carte à activer quand plusieurs portent le symbole « Activer ». */
export function ActivatePickModal({ cards, onPick, onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-purple-200">Activer une capacité</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Annuler
          </button>
        </div>
        <p className="text-sm text-white/60">Quelle carte veux-tu activer ?</p>
        <div className="flex flex-col gap-2">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => onPick(c)}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 text-left transition hover:border-amber-400/60 hover:bg-amber-400/10"
              >
                <img
                  src={def?.image}
                  alt={c.name}
                  className="h-16 w-auto shrink-0 rounded border border-white/15"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="font-bold text-amber-200">{c.name}</span>
                  <span className="text-xs text-white/50">
                    Coût d’activation : {c.activatedCost ?? 0} {(c.activatedCost ?? 0) > 0 ? 'Pouvoir' : '(gratuit)'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
