import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Les autres Bandit encore en main (jouables en chaîne). */
  bandits: CardInstance[]
  /** Pouvoir disponible (déjà amputé du 1ᵉʳ Bandit joué). */
  power: number
  /** Valide : joue les Bandit choisis (tableau vide = aucun de plus). */
  onResolve: (instanceIds: string[]) => void
}

/**
 * Bandit (Pat Hibulaire) — après avoir joué un Bandit, on peut en enchaîner
 * d'autres dans la même action (chacun paie son coût). Sélection multiple, bornée
 * par le Pouvoir disponible.
 */
export function BanditChainModal({ bandits, power, onResolve }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalCost = bandits
    .filter((b) => selected.has(b.instanceId))
    .reduce((n, b) => n + (b.cost ?? 0), 0)

  const toggle = (b: CardInstance) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(b.instanceId)) n.delete(b.instanceId)
      else n.add(b.instanceId)
      return n
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1020] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">Bandit</h2>
        <p className="text-center text-sm text-white/70">
          Vous pouvez jouer d’autres Bandit dans la même action (chacun paie son coût).
          Pouvoir disponible : <span className="font-bold text-amber-200">{power}</span>.
        </p>

        <div className="flex max-h-[55vh] flex-wrap items-center justify-center gap-3 overflow-y-auto">
          {bandits.map((b) => {
            const def = getCardDef(b.cardId)
            const isSel = selected.has(b.instanceId)
            const cost = b.cost ?? 0
            // Désactivé si, non sélectionné, l'ajouter dépasserait le Pouvoir.
            const wouldExceed = !isSel && totalCost + cost > power
            return (
              <button
                key={b.instanceId}
                type="button"
                disabled={wouldExceed}
                onClick={() => toggle(b)}
                className="flex flex-col items-center gap-1 disabled:cursor-not-allowed"
              >
                <span className={`text-[11px] font-bold ${isSel ? 'text-amber-300' : 'text-white/30'}`}>
                  {isSel ? '✔ Joué' : `coût ${cost}`}
                </span>
                <img
                  src={def?.image}
                  alt={b.name}
                  className={`h-44 w-auto rounded-lg border-2 transition ${
                    isSel
                      ? 'border-amber-300'
                      : wouldExceed
                        ? 'border-white/10 opacity-30'
                        : 'border-white/15 opacity-70 hover:opacity-100'
                  }`}
                />
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onResolve([])}
            className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
          >
            Aucun de plus
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onResolve([...selected])}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-40"
          >
            Jouer {selected.size > 0 ? `${selected.size} Bandit${selected.size > 1 ? 's' : ''} (−${totalCost})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
