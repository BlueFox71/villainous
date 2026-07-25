import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Cartes proposées : Cartes Gardes éligibles (sens arceau) ou arceaux (sens Garde). */
  guards: CardInstance[]
  /** Nombre maximum de cartes transformables (1 ou 2). */
  max: number
  /** Sens de la transformation. `to-guard` = Le Chafouin retransforme des arceaux en
   *  Cartes Gardes (choix du fataliseur) ; défaut = Cartes Gardes → arceaux. */
  direction?: 'to-wicket' | 'to-guard'
  onConfirm: (instanceIds: string[]) => void
}

/**
 * Sélection de 1 ou 2 cartes à transformer, dans les DEUX sens :
 *  - « Par ordre de la Reine ! » / Chafouin vaincu : Cartes Gardes → arceaux ;
 *  - « Le Chafouin » (à la pose) : arceaux → Cartes Gardes, choisis par le FATALISEUR.
 * Sélection multiple (jusqu'à `max`), puis confirmation.
 */
export function TransformWicketsModal({ guards, max, direction = 'to-wicket', onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const toGuard = direction === 'to-guard'

  const toggle = (id: string) => {
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id)
      if (sel.length >= max) return sel // plafond atteint
      return [...sel, id]
    })
  }

  // Libellés accordés au nombre réellement proposé (jamais de « (x) » affiché).
  const what = toGuard
    ? max === 1 ? '1 arceau' : `1 ou ${max} arceaux`
    : max === 1 ? '1 Carte Garde' : `1 ou ${max} Cartes Gardes`
  const into = toGuard
    ? max === 1 ? 'Carte Garde' : 'Cartes Gardes'
    : max === 1 ? 'arceau' : 'arceaux'

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <div>
          <h2 className="text-lg font-bold text-fuchsia-200">
            {toGuard ? 'Le Chafouin' : 'Par ordre de la Reine !'}
          </h2>
          <p className="text-sm text-white/70">
            Choisis {what} à {toGuard ? 'retransformer' : 'transformer'} en {into}.
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-center gap-3">
          {guards.map((c) => {
            const def = getCardDef(c.cardId)
            const isSel = selected.includes(c.instanceId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                className={`relative shrink-0 rounded-lg border-2 p-1 transition hover:z-10 ${
                  isSel ? 'border-fuchsia-400 ring-2 ring-fuchsia-400' : 'border-white/15 hover:border-white/60'
                }`}
              >
                <img
                  src={def?.image}
                  alt={c.name}
                  className="h-56 w-auto rounded transition-transform duration-150 ease-out hover:scale-[1.3]"
                />
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
          className={`self-center rounded-xl px-4 py-2 text-sm font-bold transition ${
            selected.length === 0
              ? 'cursor-not-allowed bg-white/10 text-white/40'
              : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500'
          }`}
        >
          {toGuard ? 'Retransformer' : 'Transformer'} {selected.length > 0 ? `(${selected.length})` : ''}
        </button>
      </div>
    </div>,
    document.body,
  )
}
