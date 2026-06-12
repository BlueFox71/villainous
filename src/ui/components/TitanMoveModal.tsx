import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'

interface Props {
  player: PlayerState
  /** Ids des Titans déplaçables (pendingTitanMove.titanCandidateIds). */
  candidateIds: string[]
  /** Le déplacement est-il payant (2 JT / 1 lieu, 5 JT / 2 lieux) ? */
  paid: boolean
  /** Portée maximale en nombre de lieux. */
  maxSteps: number
  onResolve: (titanInstanceId: string, to: string) => void
}

/**
 * Préparez-vous au combat ! (Hadès) — choisir un Titan non entravé puis un lieu
 * de destination (1 ou 2 lieux le long du royaume). Le coût (2 ou 5 JT) est
 * affiché et les destinations non finançables sont grisées.
 */
export function TitanMoveModal({ player, candidateIds, paid, maxSteps, onResolve }: Props) {
  const order = player.locations.map((l) => l.id)
  const locOf = (id: string) =>
    player.locations.find((l) => (player.board[l.id] ?? []).some((c) => c.instanceId === id))?.id
  const titans = candidateIds
    .map((id) => {
      const loc = locOf(id)
      const card = loc ? (player.board[loc] ?? []).find((c) => c.instanceId === id) : undefined
      return card && loc ? { card, loc } : undefined
    })
    .filter((x): x is { card: CardInstance; loc: string } => !!x)

  const [selected, setSelected] = useState<string | null>(titans.length === 1 ? titans[0].card.instanceId : null)

  const sel = titans.find((t) => t.card.instanceId === selected)
  // Destinations atteignables pour le Titan sélectionné (≤ maxSteps, le long de la
  // ligne ; Hercule sur le lieu de départ verrouille déjà côté moteur).
  const dests = sel
    ? order
        .map((id, i) => ({ id, steps: Math.abs(i - order.indexOf(sel.loc)) }))
        .filter((d) => d.id !== sel.loc && d.steps <= maxSteps)
    : []
  const costOf = (steps: number) => (paid ? (steps >= 2 ? 5 : 2) : 0)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1626] p-6 text-white">
        <h2 className="text-xl font-black text-sky-200">Déplacer un Titan</h2>
        <p className="text-center text-sm text-white/70">
          {sel
            ? `Vers quel lieu déplacer ${sel.card.name} ?${paid ? ' (2 JT pour 1 lieu, 5 JT pour 2)' : ''}`
            : 'Choisissez un Titan non entravé à déplacer.'}
        </p>

        {!sel && (
          <div className="flex flex-wrap justify-center gap-2">
            {titans.map(({ card, loc }) => (
              <button
                key={card.instanceId}
                type="button"
                onClick={() => setSelected(card.instanceId)}
                className="rounded-lg border border-sky-300/60 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-400/20"
              >
                {card.name}
                <span className="block text-[10px] text-white/50">
                  {player.locations.find((l) => l.id === loc)?.name ?? loc}
                </span>
              </button>
            ))}
          </div>
        )}

        {sel && (
          <div className="flex flex-wrap justify-center gap-2">
            {dests.map((d) => {
              const cost = costOf(d.steps)
              const affordable = !paid || player.power >= cost
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={!affordable}
                  onClick={() => affordable && onResolve(sel.card.instanceId, d.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                    affordable
                      ? 'border-sky-300/60 text-sky-100 hover:bg-sky-400/20'
                      : 'cursor-not-allowed border-white/10 text-white/30'
                  }`}
                >
                  {player.locations.find((l) => l.id === d.id)?.name ?? d.id}
                  {paid && <span className="block text-[10px] text-white/50">{cost} JT</span>}
                </button>
              )
            })}
          </div>
        )}

        {sel && titans.length > 1 && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-xs text-white/50 underline hover:text-white/80"
          >
            ← Choisir un autre Titan
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
