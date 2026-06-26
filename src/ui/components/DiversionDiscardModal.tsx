import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cible de la Fatalité (= Oogie Boogie). */
  target: PlayerState
  /** Lieu d'arrivée du Héros déplacé (où l'on défausse un Allié/Objet). */
  locationId: string
  /** Défausse l'Allié/Objet choisi. */
  onResolve: (cardInstanceId: string) => void
}

/**
 * Oogie Boogie — « Diversion » (Fatalité, 2ᵉ temps) : après avoir déplacé un Héros, le
 * joueur qui pose la carte défausse un Allié ou un Objet (non associé) du lieu d'arrivée.
 */
export function DiversionDiscardModal({ target, locationId, onResolve }: Props) {
  const locName = target.locations.find((l) => l.id === locationId)?.name ?? locationId
  const cards = (target.board[locationId] ?? []).filter(
    (c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket,
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-amber-200">Diversion</h2>
        <p className="text-center text-sm text-white/70">
          Défausse un Allié ou un Objet de {locName} ({target.villainName}) :
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {cards.map((c) => (
            <button
              key={c.instanceId}
              type="button"
              onClick={() => onResolve(c.instanceId)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
            >
              <img src={getCardDef(c.cardId)?.image} alt={c.name} className="w-20 rounded" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
