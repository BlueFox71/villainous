import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cartes Gardes éligibles (Allié `gardes-*` non encore arceau, hors lieu du Dodo). */
  guards: CardInstance[]
  /** Nombre maximum de Cartes Gardes transformables (1 ou 2). */
  max: number
  onConfirm: (instanceIds: string[]) => void
}

/**
 * Par ordre de la Reine ! — sélection de 1 ou 2 Cartes Gardes à transformer en
 * arceaux. Sélection multiple (jusqu'à `max`), puis confirmation.
 */
export function TransformWicketsModal({ guards, max, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id)
      if (sel.length >= max) return sel // plafond atteint
      return [...sel, id]
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <div>
          <h2 className="text-lg font-bold text-fuchsia-200">Par ordre de la Reine !</h2>
          <p className="text-sm text-white/70">
            Choisis {max === 1 ? '1 Carte Garde' : `1 ou ${max} Cartes Gardes`} à transformer en
            arceau{max > 1 ? '(x)' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {guards.map((c) => {
            const def = getCardDef(c.cardId)
            const isSel = selected.includes(c.instanceId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                className={`rounded-lg border-2 p-1 transition ${
                  isSel ? 'border-fuchsia-400 ring-2 ring-fuchsia-400' : 'border-white/15 hover:border-white/60'
                }`}
              >
                <img src={def?.image} alt={c.name} className="h-40 w-auto rounded" />
                <div className="mt-1 text-center text-[11px] text-white/80">
                  {c.name}
                  {c.strength !== undefined ? ` — force ${c.strength}` : ''}
                </div>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            selected.length === 0
              ? 'cursor-not-allowed bg-white/10 text-white/40'
              : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500'
          }`}
        >
          Transformer {selected.length > 0 ? `(${selected.length})` : ''}
        </button>
      </div>
    </div>,
    document.body,
  )
}
