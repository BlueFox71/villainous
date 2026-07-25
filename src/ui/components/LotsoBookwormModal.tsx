import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getCardDef } from '../../data/registry'

interface Candidate {
  instanceId: string
  cardId: string
  name: string
  /** Force effective restante (≥ 1). */
  strength: number
  /** Nom du lieu où se trouve le Héros. */
  locationName: string
}

interface Props {
  /** Héros encore réductibles (force effective > 0). */
  candidates: Candidate[]
  /** Jetons Pouvoir disponibles. */
  power: number
  /** Total déjà dépensé pour ce Bibliothécaire (répartitions précédentes). */
  spent: number
  /** Applique la répartition composée : pour chaque Héros, le nombre de jetons. */
  onConfirm: (counts: { instanceId: string; count: number }[]) => void
  /** Termine sans (plus) rien dépenser. */
  onDone: () => void
}

/**
 * Lotso — Le Bibliothécaire : « Dépensez autant de jetons Pouvoir que vous voulez. Pour
 * chaque jeton dépensé, ajoutez un jeton Force −1 à un Héros de votre choix. »
 *
 * On COMPOSE la répartition (− / + par Héros, bornée par le Pouvoir restant et par la force
 * restante du Héros) puis on valide en un coup. Avant, chaque clic dépensait 1 jeton
 * immédiatement : on ne choisissait pas la quantité et on ne pouvait pas revenir en arrière.
 */
export function LotsoBookwormModal({ candidates, power, spent, onConfirm, onDone }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const total = Object.values(counts).reduce((n, v) => n + v, 0)
  const left = power - total

  const set = (id: string, delta: number, max: number) =>
    setCounts((c) => {
      const cur = c[id] ?? 0
      // Borné par la force restante du Héros ET par le Pouvoir encore libre.
      const next = Math.max(0, Math.min(cur + delta, cur + left, max))
      return { ...c, [id]: next }
    })

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-pink-200">Le Bibliothécaire</h2>
        <p className="text-center text-sm text-white/70">
          Choisis combien de jetons Pouvoir dépenser : chaque jeton retire <b>1 Force</b> au Héros
          de ton choix. Tu peux répartir entre plusieurs Héros.
        </p>
        <p className="text-center text-sm text-amber-200">
          Pouvoir disponible : <span className="font-bold">{left}</span> sur {power}
          {spent > 0 && (
            <>
              {' '}· déjà dépensé : <span className="font-bold">{spent}</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-start justify-center gap-3">
          {candidates.map((c) => {
            const n = counts[c.instanceId] ?? 0
            return (
              <div
                key={c.instanceId}
                className={`relative flex shrink-0 flex-col items-center gap-1 rounded-lg border-2 p-2 transition ${
                  n > 0 ? 'border-pink-400' : 'border-white/20'
                }`}
              >
                <img
                  src={getCardDef(c.cardId)?.image}
                  alt={c.name}
                  className="h-56 w-auto rounded transition-transform duration-150 ease-out hover:z-10 hover:scale-[1.25]"
                />
                <span className="text-[11px] text-white/70">{c.locationName}</span>
                <span className="text-[11px] font-bold text-white">
                  Force {c.strength}
                  {n > 0 && <span className="text-pink-300"> → {c.strength - n}</span>}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={n === 0}
                    onClick={() => set(c.instanceId, -1, c.strength)}
                    className="h-7 w-7 rounded-full border border-white/30 text-sm font-bold enabled:hover:bg-white/10 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-pink-200">−{n}</span>
                  <button
                    type="button"
                    disabled={left === 0 || n >= c.strength}
                    onClick={() => set(c.instanceId, +1, c.strength)}
                    className="h-7 w-7 rounded-full border border-white/30 text-sm font-bold enabled:hover:bg-white/10 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Ne rien dépenser
          </button>
          <button
            type="button"
            disabled={total === 0}
            onClick={() =>
              onConfirm(
                Object.entries(counts)
                  .filter(([, n]) => n > 0)
                  .map(([instanceId, count]) => ({ instanceId, count })),
              )
            }
            className="rounded-xl bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dépenser {total > 0 ? `${total} ` : ''}
            {total === 1 ? 'jeton' : 'jetons'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
