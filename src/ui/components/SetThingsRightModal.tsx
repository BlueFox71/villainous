import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cible de la Fatalité (= Oogie Boogie) dont on révèle la main. */
  target: PlayerState
  /** Défausse la carte choisie de la main de la cible. */
  onResolve: (cardInstanceId: string) => void
}

/**
 * Oogie Boogie — « Mettons fin à ce cauchemar » (Fatalité) : la cible révèle sa main ;
 * le joueur qui pose la carte en choisit une à défausser.
 */
export function SetThingsRightModal({ target, onResolve }: Props) {
  const hand = target.hand ?? []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-amber-200">Mettons fin à ce cauchemar</h2>
        <p className="text-center text-sm text-white/70">
          Main de {target.villainName} — choisis une carte à défausser :
        </p>
        <div className="flex flex-wrap justify-center gap-3 py-4">
          {hand.map((c) => (
            <button
              key={c.instanceId}
              type="button"
              onClick={() => onResolve(c.instanceId)}
              title={c.name}
              className="relative rounded-lg"
            >
              <img
                src={getCardDef(c.cardId)?.image}
                alt={c.name}
                className="w-28 rounded-lg border border-white/20 transition-transform duration-150 ease-out hover:z-10 hover:scale-[1.6] hover:border-amber-400"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
