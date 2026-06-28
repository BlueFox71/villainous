import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur dont on défausse un Allié (son royaume). */
  target: PlayerState
  /** Alliés candidats (instanceId) — p. ex. plusieurs Bandits. */
  candidateIds: string[]
  /** Libellé de la carte Fatalité (ex. « Planqués »). */
  cardName: string
  onResolve: (instanceId: string) => void
}

/**
 * Pat Hibulaire — « Planqués » (et cartes similaires) : le joueur qui pose la Fatalité
 * choisit quel Allié défausser du royaume adverse. Comme plusieurs candidats peuvent
 * être identiques (Bandits), on affiche le lieu de chacun pour les distinguer.
 */
export function FateDiscardAllyModal({ target, candidateIds, cardName, onResolve }: Props) {
  const nameOf = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id
  const cands = target.locations.flatMap((loc) =>
    (target.board[loc.id] ?? [])
      .filter((c) => candidateIds.includes(c.instanceId))
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">
          {cardName} : quel Allié défausser ?
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {cands.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onResolve(a.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
            >
              <img src={getCardDef(a.cardId)?.image} alt={a.name} className="w-16 rounded" />
              <span className="text-[11px] text-white/70">{nameOf(a.from)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
