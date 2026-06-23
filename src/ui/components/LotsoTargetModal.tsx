import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  player: PlayerState
  /** Cibles valides (instanceId) à proposer. */
  candidateIds: string[]
  /** Libellé du choix (ex. « Réduire un Héros de 1 »). */
  label: string
  onResolve: (instanceId: string) => void
}

/**
 * Lotso — choix interactif d'une cible (Héros à réduire, ou Héros/Buzz à déplacer sur la
 * Salle des Chenilles) : on clique la carte voulue parmi les candidats.
 */
export function LotsoTargetModal({ player, candidateIds, label, onResolve }: Props) {
  const nameOf = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id
  const cards = player.locations.flatMap((loc) =>
    (player.board[loc.id] ?? [])
      .filter((c) => candidateIds.includes(c.instanceId))
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-pink-200">{label}</h2>
        <p className="text-center text-sm text-white/70">Clique une cible :</p>
        <div className="flex flex-wrap justify-center gap-2">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onResolve(c.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-pink-400 hover:bg-white/10"
            >
              <img src={getCardDef(c.cardId)?.image} alt={c.name} className="w-20 rounded" />
              <span className="text-[11px] text-white/70">{nameOf(c.from)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
