import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Héros croquables (présents sur le lieu du pion, payables avec le Poison). */
  candidates: CardInstance[]
  /** Force effective d'un Héros (= jetons Poison dépensés pour le croquer). */
  forceOf: (instanceId: string) => number
  /** Jetons Poison disponibles (pour l'affichage). */
  poison: number
  onResolve: (heroInstanceId: string) => void
}

/**
 * « Croque ! » (La Méchante Reine) — choisir le Héros à éliminer en défaussant
 * autant de jetons Poison que sa force.
 */
export function TakeABiteModal({ candidates, forceOf, poison, onResolve }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a18] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Croque !</h2>
        <p className="text-center text-sm text-white/70">
          Choisissez le Héros à éliminer. Vous défausserez autant de jetons Poison
          que sa force. <span className="text-fuchsia-200">🧪 {poison} disponible{poison > 1 ? 's' : ''}</span>
        </p>
        <div className="flex flex-wrap items-start justify-center gap-4">
          {candidates.map((c) => {
            const def = getCardDef(c.cardId)
            const cost = forceOf(c.instanceId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => onResolve(c.instanceId)}
                className="flex flex-col items-center gap-1"
              >
                <span className="h-4 text-[11px] font-bold text-fuchsia-300">🧪 {cost}</span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className="h-60 w-auto rounded-lg border-2 border-white/20 transition hover:border-fuchsia-400 hover:ring-2 hover:ring-fuchsia-400/50"
                />
                <span className="max-w-[12rem] text-center text-xs font-semibold text-white/80">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
