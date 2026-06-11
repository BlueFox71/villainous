import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Carte révélée (dernière de la pioche). */
  card: CardInstance
  /** Garder la carte révélée (l'ajouter à la main). */
  onKeep: () => void
  /** Remélanger la pioche et piocher la première carte. */
  onReshuffle: () => void
}

/**
 * Retourne-toi (Slenderman) : montre la dernière carte de la pioche et propose
 * de l'ajouter à la main, ou de remélanger la pioche et piocher la première.
 */
export function DeckPeekModal({ card, onKeep, onReshuffle }: Props) {
  const def = getCardDef(card.cardId)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">Retourne-toi</h2>
        <p className="text-center text-sm text-white/70">
          Dernière carte de votre pioche :
        </p>
        {def?.image ? (
          <img
            src={def.image}
            alt={card.name}
            className="w-40 rounded-lg border border-white/20"
          />
        ) : (
          <div className="flex h-56 w-40 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-center text-sm">
            {card.name}
          </div>
        )}
        <p className="text-center text-sm font-semibold text-amber-200">{card.name}</p>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-purple-950 hover:bg-amber-400"
          >
            Ajouter à ma main
          </button>
          <button
            type="button"
            onClick={onReshuffle}
            className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Mélanger et piocher la 1ʳᵉ carte
          </button>
        </div>
      </div>
    </div>
  )
}
