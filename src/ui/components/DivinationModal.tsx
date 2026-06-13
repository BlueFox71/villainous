import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Les cartes révélées de la Pile de l'Au-delà (2 ou 3). */
  cards: CardInstance[]
  /** Renvoie l'ordre de résolution choisi (instanceIds). Les cartes non
   *  sélectionnées sont résolues ensuite dans leur ordre d'apparition. */
  onResolve: (topInstanceIds: string[]) => void
}

/**
 * Divination (Dr Facilier) — l'Au-delà a révélé 2 ou 3 cartes. Le joueur clique
 * les cartes dans l'ordre où il veut résoudre leurs effets (ex. « Régner » en
 * premier pour gagner, « Esprits des masques » en dernier).
 */
export function DivinationModal({ cards, onResolve }: Props) {
  const [order, setOrder] = useState<string[]>([])

  const toggle = (id: string) =>
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  // Ordre final : choix explicite + le reste (dans l'ordre révélé).
  const finalOrder = [...order, ...cards.map((c) => c.instanceId).filter((id) => !order.includes(id))]

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a18] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Divination — Pile de l'Au-delà</h2>
        <p className="text-center text-sm text-white/70">
          Cliquez les cartes dans l'ordre où vous voulez résoudre leurs effets Au-delà.
        </p>

        <div className="flex flex-wrap items-start justify-center gap-4">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            const rank = order.indexOf(c.instanceId)
            const picked = rank >= 0
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                className="flex flex-col items-center gap-1"
              >
                <span className="h-4 text-[11px] font-bold text-fuchsia-300">
                  {picked ? `${rank + 1}ᵉ à résoudre` : ''}
                </span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-60 w-auto rounded-lg border-2 transition ${
                    picked ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/50' : 'border-white/20 hover:border-white/50'
                  }`}
                />
                <span className="max-w-[12rem] text-center text-xs font-semibold text-white/80">{c.name}</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOrder([])}
            className="rounded-lg border border-white/25 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => onResolve(finalOrder)}
            className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-500"
          >
            Résoudre
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
