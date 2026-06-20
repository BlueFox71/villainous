import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** La main complète du joueur après la pioche de Sournois. */
  hand: CardInstance[]
  /** Valide : `instanceId` = carte à replacer ; `placement` = dessus / dessous. */
  onResolve: (instanceId: string, placement: 'top' | 'bottom') => void
}

/**
 * Sournois (Pat Hibulaire) — après avoir pioché 2 cartes : choisissez 1 carte de
 * votre main à replacer sur le dessus ou le dessous de votre pioche (choix privé).
 */
export function SournoisModal({ hand, onResolve }: Props) {
  const [pickId, setPickId] = useState<string>(hand[0]?.instanceId ?? '')
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1020] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">Sournois</h2>
        <p className="text-center text-sm text-white/70">
          Choisissez 1 carte de votre main à replacer sur le dessus ou le dessous de votre pioche.
        </p>

        <div className="flex max-h-[55vh] flex-wrap items-center justify-center gap-3 overflow-y-auto">
          {hand.map((c) => {
            const def = getCardDef(c.cardId)
            const isPicked = c.instanceId === pickId
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => setPickId(c.instanceId)}
                className="flex flex-col items-center gap-1"
              >
                <span className={`text-[11px] font-bold ${isPicked ? 'text-amber-300' : 'text-white/30'}`}>
                  {isPicked ? '↩ À replacer' : ''}
                </span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-44 w-auto rounded-lg border-2 transition ${
                    isPicked ? 'border-amber-300' : 'border-white/15 opacity-60 hover:opacity-90'
                  }`}
                />
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 text-sm text-white/80">
          Replacer sur le :
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value as 'top' | 'bottom')}
            className="rounded-lg border border-white/25 bg-[#0b1020] px-2 py-1 text-sm text-white"
          >
            <option value="top">dessus (piochée en premier)</option>
            <option value="bottom">dessous</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => onResolve(pickId, placement)}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500"
        >
          Valider
        </button>
      </div>
    </div>,
    document.body,
  )
}
