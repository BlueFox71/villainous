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
  /** Masque le nom sous l'illustration (l'image le porte déjà). Défaut : nom affiché
   *  en petit, sous la carte, pour les mécaniques où l'on cherche une carte précise. */
  imageOnly?: boolean
}

/**
 * Fenêtre générique pour choisir une carte parmi une liste (récupération en défausse,
 * pioche à fouiller…).
 *
 * Disposition unique : une GRILLE d'illustrations assez grandes pour être LISIBLES,
 * côte à côte, avec agrandissement au survol. (Avant : une liste d'une seule colonne
 * avec une vignette de 64 px et un grand titre — on ne pouvait pas lire la carte, alors
 * que c'est justement ce qu'il faut pour choisir.)
 */
export function CardChoiceModal({ title, cards, onPick, onClose, noneLabel, onNone, imageOnly = false }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-purple-200">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Annuler
          </button>
        </div>
        <div className="flex max-h-[74vh] flex-wrap items-start justify-center gap-3 overflow-y-auto p-2">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => onPick(c)}
                title={c.name}
                className="relative shrink-0 hover:z-10"
              >
                <img
                  src={def?.image}
                  alt={c.name}
                  className="h-56 w-auto rounded-lg border border-white/20 transition-transform duration-150 ease-out hover:scale-[1.35] hover:border-amber-400/70"
                />
                {!imageOnly && (
                  <span className="mt-1 block max-w-[10rem] text-center text-xs font-semibold text-amber-200">
                    {c.name}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {noneLabel && onNone && (
          <button
            type="button"
            onClick={onNone}
            className="self-center rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {noneLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
