import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Les cartes qui viennent d'être piochées (montrées au joueur). */
  drawn: CardInstance[]
  /** Nombre de cartes à défausser de la main si on garde la pioche. */
  discardCount: number
  /** true = défausser les cartes piochées ; false = défausser depuis la main. */
  onChoose: (discardDrawn: boolean) => void
}

/**
 * Sombra — Information : on vient de piocher des cartes ; le joueur choisit soit de
 * défausser `discardCount` cartes de sa main (il garde la pioche), soit de défausser
 * les cartes piochées.
 */
export function InformationModal({ drawn, discardCount, onChoose }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a1f] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Information</h2>
        <p className="text-center text-sm text-white/70">
          Tu as pioché {drawn.length} carte{drawn.length > 1 ? 's' : ''}. Choisis :
        </p>
        <div className="flex flex-wrap items-start justify-center gap-3">
          {drawn.map((c) => {
            const def = getCardDef(c.cardId)
            return (
              <div key={c.instanceId} className="flex flex-col items-center gap-1">
                <img src={def?.image} alt={c.name} className="h-48 w-auto rounded-lg border-2 border-fuchsia-400/40" />
                <span className="max-w-[10rem] text-center text-xs font-semibold text-white/80">{c.name}</span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => onChoose(false)}
            className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-500"
          >
            Garder la pioche, défausser {discardCount} carte{discardCount > 1 ? 's' : ''} de ma main
          </button>
          <button
            type="button"
            onClick={() => onChoose(true)}
            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Défausser les {drawn.length} cartes piochées
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
