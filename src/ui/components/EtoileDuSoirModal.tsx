import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cible de la Fatalité (= Dr Facilier) dont on déplace un Allié dans l'Au-delà. */
  target: PlayerState
  /** Place l'Allié choisi dans la Pile de l'Au-delà de la cible. */
  onResolve: (allyInstanceId: string) => void
}

/**
 * Dr Facilier — « L'étoile du soir » (Fatalité) : le joueur qui pose la carte choisit
 * lequel des Alliés (non associés) du royaume de Facilier part dans sa Pile de l'Au-delà.
 */
export function EtoileDuSoirModal({ target, onResolve }: Props) {
  const nameOf = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id
  const allies = target.locations.flatMap((loc) =>
    (target.board[loc.id] ?? [])
      .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-amber-200">L’étoile du soir</h2>
        <p className="text-center text-sm text-white/70">
          Choisis l’Allié à placer dans la Pile de l’Au-delà de {target.villainName} :
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {allies.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onResolve(a.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
            >
              <img src={getCardDef(a.cardId)?.image} alt={a.name} className="w-20 rounded" />
              <span className="text-[11px] text-white/70">{nameOf(a.from)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
