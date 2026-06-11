import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'

interface Props {
  player: PlayerState
  onResolve: (locationId: string) => void
}

/**
 * Colère Titanesque (Ursula) — choisir un lieu VOISIN (bloqué ou non) sur lequel
 * effectuer une action. Une fois le lieu choisi, le joueur agit dessus comme s'il
 * y était (le temps d'une action).
 */
export function GiantActionModal({ player, onResolve }: Props) {
  const order = player.locations.map((l) => l.id)
  const i = order.indexOf(player.pawnLocation ?? '')
  const neighbors = [order[i - 1], order[i + 1]].filter((id): id is string => !!id)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a0a24] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Colère Titanesque</h2>
        <p className="text-center text-sm text-white/70">
          Choisissez un lieu voisin (bloqué ou non) : vous y effectuerez ensuite une action.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {neighbors.map((id) => {
            const loc = player.locations.find((l) => l.id === id)
            const blocked = (player.lockedLocations ?? []).includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onResolve(id)}
                className="rounded-lg border border-fuchsia-300/60 px-4 py-2 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-400/20"
              >
                {loc?.name ?? id}
                {blocked && <span className="block text-[10px] text-white/50">(bloqué)</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
