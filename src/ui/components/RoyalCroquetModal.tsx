import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  revealed: CardInstance[]
  wicketStrength: number
  costSum: number
  won: boolean
  onClose: () => void
}

/** Fenêtre du Coup Royal : montre les 5 cartes révélées et le verdict. */
export function RoyalCroquetModal({ revealed, wicketStrength, costSum, won, onClose }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a0a14] p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-black text-amber-200">Coup Royal</h2>
        <p className="text-center text-sm text-white/70">
          5 cartes révélées — coût total <b className="text-white">{costSum}</b> vs force des arceaux{' '}
          <b className="text-white">{wicketStrength}</b>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {revealed.map((c) => (
            <div key={c.instanceId} className="flex flex-col items-center">
              <img
                src={getCardDef(c.cardId)?.image}
                alt={c.name}
                className="w-24 rounded-lg border border-white/20"
              />
              <span className="mt-1 font-mono text-xs text-white/60">coût {c.cost ?? 0}</span>
            </div>
          ))}
        </div>
        <div
          className={`rounded-xl px-5 py-2 text-lg font-black ${
            won ? 'bg-emerald-600/30 text-emerald-200' : 'bg-red-600/30 text-red-200'
          }`}
        >
          {won ? '🏆 Coup Royal réussi — victoire !' : 'Coup Royal raté — ces 5 cartes sont défaussées.'}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  )
}
