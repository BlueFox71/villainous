import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  player: PlayerState
  /** Bonus de force conféré jusqu'à la fin du tour (0 = simple déplacement). */
  amount: number
  /** Titre de la fenêtre (carte source). Défaut : « Pas de Quartier ! ». */
  label?: string
  /** Déplacement facultatif (« vous pouvez ») : affiche un bouton « Ne pas déplacer ». */
  optional?: boolean
  onResolve: (instanceId: string, to: string) => void
  /** Décline le déplacement (uniquement si `optional`). */
  onSkip?: () => void
}

/**
 * Choisir un Allié, puis un lieu voisin non bloqué où le déplacer (il gagne
 * +`amount` force jusqu'à la fin du tour ; `amount` 0 = simple déplacement).
 * Sert Pas de Quartier ! (Crochet, +2) et Grand Terrier (Bowser, +0, facultatif).
 */
export function AllyMoveBuffModal({ player, amount, label, optional = false, onResolve, onSkip }: Props) {
  const [picked, setPicked] = useState<string | null>(null)

  const order = player.locations.map((l) => l.id)
  const locked = new Set(player.lockedLocations ?? [])
  const neighborsOf = (locId: string) => {
    const i = order.indexOf(locId)
    return [order[i - 1], order[i + 1]].filter((id): id is string => !!id && !locked.has(id))
  }
  const locName = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id

  const movable = player.locations.flatMap((l) =>
    (player.board[l.id] ?? [])
      .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket && neighborsOf(l.id).length > 0)
      .map((c) => ({ card: c, loc: l.id })),
  )
  const chosen = movable.find((m) => m.card.instanceId === picked)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1020] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">{label ?? 'Pas de Quartier !'}</h2>
        {!chosen ? (
          <>
            <p className="text-center text-sm text-white/70">
              {amount > 0
                ? `Choisissez l'Allié à déplacer (il gagnera +${amount} force jusqu'à la fin du tour).`
                : "Choisissez l'Allié à déplacer vers un lieu voisin."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {movable.map(({ card, loc }) => {
                const def = getCardDef(card.cardId)
                return (
                  <button
                    key={card.instanceId}
                    type="button"
                    onClick={() => setPicked(card.instanceId)}
                    className="rounded-lg border-2 border-white/15 p-1 transition hover:border-amber-300"
                  >
                    <img src={def?.image} alt={card.name} className="h-44 w-auto rounded" />
                    <div className="mt-1 text-center text-[11px] text-white/80">
                      {card.name}
                      <span className="block text-white/50">{locName(loc)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {optional && onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                Ne pas déplacer
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">
              Déplacer <b className="text-amber-200">{chosen.card.name}</b> vers&nbsp;:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {neighborsOf(chosen.loc).map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => onResolve(chosen.card.instanceId, to)}
                  className="rounded-lg border border-amber-300/60 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/20"
                >
                  {locName(to)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
            >
              ← Changer d'Allié
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
