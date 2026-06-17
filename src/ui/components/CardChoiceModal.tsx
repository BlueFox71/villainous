import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  title: string
  cards: CardInstance[]
  onPick: (card: CardInstance) => void
  onClose: () => void
  /** Bouton optionnel « aucun » (ex. Iago seul, sans objet). */
  noneLabel?: string
  onNone?: () => void
}

/** Petite fenêtre générique pour choisir une carte parmi une liste. */
export function CardChoiceModal({ title, cards, onPick, onClose, noneLabel, onNone }: Props) {
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
          <h2 className="text-lg font-bold text-purple-200">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Annuler
          </button>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
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
                <span className="font-bold text-amber-200">{c.name}</span>
              </button>
            )
          })}
          {noneLabel && onNone && (
            <button
              type="button"
              onClick={onNone}
              className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              {noneLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
