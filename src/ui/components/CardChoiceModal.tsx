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
  /** Mode « planche d'images » : n'affiche QUE les illustrations (sans nom), en grand,
   *  disposées en grille, avec un agrandissement au survol (ex. Foudre : reproduire un
   *  Ingrédient). */
  imageOnly?: boolean
}

/** Petite fenêtre générique pour choisir une carte parmi une liste. */
export function CardChoiceModal({ title, cards, onPick, onClose, noneLabel, onNone, imageOnly = false }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className={`flex w-full ${imageOnly ? 'max-w-3xl' : 'max-w-md'} flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white`}
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
        {imageOnly ? (
          // Grille d'illustrations seules ; survol = agrandissement (au-dessus des voisines).
          <div className="flex max-h-[74vh] flex-wrap items-center justify-center gap-3 overflow-y-auto p-2">
            {cards.map((c) => {
              const def = getCardDef(c.cardId)
              return (
                <button
                  key={c.instanceId}
                  type="button"
                  onClick={() => onPick(c)}
                  title={c.name}
                  className="relative shrink-0"
                >
                  <img
                    src={def?.image}
                    alt={c.name}
                    className="h-56 w-auto rounded-lg border border-white/20 transition-transform duration-150 ease-out hover:z-10 hover:scale-[1.35] hover:border-amber-400/70"
                  />
                </button>
              )
            })}
          </div>
        ) : (
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
        )}
      </div>
    </div>,
    document.body,
  )
}
