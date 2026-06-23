import { getCardDef } from '../../data/registry'

interface Candidate {
  instanceId: string
  cardId: string
  name: string
  /** Force effective restante (≥ 1). */
  strength: number
  /** Nom du lieu où se trouve le Héros. */
  locationName: string
}

interface Props {
  /** Héros encore réductibles (force effective > 0). */
  candidates: Candidate[]
  /** Jetons Pouvoir restants à dépenser. */
  power: number
  /** Total déjà dépensé pour ce Bibliothécaire. */
  spent: number
  onReduce: (instanceId: string) => void
  onDone: () => void
}

/**
 * Lotso — Le Bibliothécaire (coût variable) : on clique un Héros pour lui ajouter un jeton
 * Force −1 (coûte 1 jeton Pouvoir). On peut répartir les réductions entre plusieurs Héros,
 * puis « Terminer ». Le bouton de réduction est désactivé si plus de Pouvoir.
 */
export function LotsoBookwormModal({ candidates, power, spent, onReduce, onDone }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-pink-200">Le Bibliothécaire</h2>
        <p className="text-center text-sm text-white/70">
          Clique un Héros pour −1 de force (coûte 1 jeton Pouvoir). Tu peux répartir entre plusieurs Héros.
        </p>
        <p className="text-center text-sm text-amber-200">
          Pouvoir restant : <span className="font-bold">{power}</span> · dépensé : <span className="font-bold">{spent}</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {candidates.map((c) => (
            <button
              key={c.instanceId}
              type="button"
              disabled={power < 1}
              onClick={() => onReduce(c.instanceId)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 enabled:hover:border-pink-400 enabled:hover:bg-white/10 disabled:opacity-40"
            >
              <img src={getCardDef(c.cardId)?.image} alt={c.name} className="w-20 rounded" />
              <span className="text-[11px] text-white/70">{c.locationName}</span>
              <span className="text-[11px] font-bold text-white">Force {c.strength}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onDone}
          className="mx-auto rounded-lg border border-white/30 px-5 py-2 text-sm font-semibold hover:border-pink-400 hover:bg-white/10"
        >
          Terminer
        </button>
      </div>
    </div>
  )
}
