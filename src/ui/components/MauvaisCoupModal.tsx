import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Les 2 cartes révélées du dessous de la pioche (ordre de la pioche). */
  cards: CardInstance[]
  /** Valide : `keepInstanceId` = carte prise en main ; l'autre repart sur le
   *  dessus (`top`) ou le dessous (`bottom`) de la pioche. */
  onResolve: (keepInstanceId: string, otherPlacement: 'top' | 'bottom') => void
}

/**
 * Mauvais Coup (Pat Hibulaire) — regarde les 2 cartes du dessous de la pioche :
 *  - choisis celle à prendre en main (clic sur la carte),
 *  - choisis où replacer l'autre (dessus / dessous) via un sélecteur,
 *  - valide.
 */
export function MauvaisCoupModal({ cards, onResolve }: Props) {
  const [keepId, setKeepId] = useState<string>(cards[0]?.instanceId ?? '')
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')

  const other = cards.find((c) => c.instanceId !== keepId)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1020] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">Mauvais Coup</h2>
        <p className="text-center text-sm text-white/70">
          Les 2 cartes du dessous de votre pioche. Choisissez celle à prendre en main ;
          l'autre repartira sur le dessus ou le dessous de votre pioche.
        </p>

        <div className="flex items-center justify-center gap-4">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            const isKept = c.instanceId === keepId
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => setKeepId(c.instanceId)}
                className="flex flex-col items-center gap-1"
              >
                <span className={`text-[11px] font-bold ${isKept ? 'text-amber-300' : 'text-white/40'}`}>
                  {isKept ? '✋ En main' : '↩ Repart en pioche'}
                </span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-56 w-auto rounded-lg border-2 transition ${
                    isKept ? 'border-amber-300' : 'border-white/15 opacity-60 hover:opacity-90'
                  }`}
                />
              </button>
            )
          })}
        </div>

        {other && (
          <label className="flex items-center gap-2 text-sm text-white/80">
            Replacer <span className="font-bold text-white">{other.name}</span> :
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value as 'top' | 'bottom')}
              className="rounded-lg border border-white/25 bg-[#0b1020] px-2 py-1 text-sm text-white"
            >
              <option value="top">sur le dessus (piochée en premier)</option>
              <option value="bottom">sur le dessous</option>
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={() => onResolve(keepId, placement)}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500"
        >
          Valider
        </button>
      </div>
    </div>,
    document.body,
  )
}
