import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'

interface Props {
  /** Royaume d'Hadès (où se trouvent les Titans candidats). */
  owner: PlayerState
  candidateIds: string[]
  kind: 'trap' | 'push'
  onResolve: (titanInstanceId: string) => void
}

/**
 * Héra (entraver) / Pégase (repousser) — le joueur qui pose la Fatalité choisit
 * un Titan du royaume d'Hadès.
 */
export function TitanSelectModal({ owner, candidateIds, kind, onResolve }: Props) {
  const titans = candidateIds
    .map((id) => {
      const loc = owner.locations.find((l) => (owner.board[l.id] ?? []).some((c) => c.instanceId === id))
      const card = loc ? (owner.board[loc.id] ?? []).find((c) => c.instanceId === id) : undefined
      return card && loc ? { card, locName: loc.name } : undefined
    })
    .filter((x): x is { card: CardInstance; locName: string } => !!x)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#10162a] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">
          {kind === 'trap' ? 'Entraver un Titan' : 'Repousser un Titan'}
        </h2>
        <p className="text-center text-sm text-white/70">
          {kind === 'trap'
            ? 'Choisissez le Titan à entraver (il ne pourra plus bouger ni compter pour l’objectif).'
            : 'Choisissez le Titan à repousser vers Les Enfers.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {titans.map(({ card, locName }) => (
            <button
              key={card.instanceId}
              type="button"
              onClick={() => onResolve(card.instanceId)}
              className="rounded-lg border border-amber-300/60 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/20"
            >
              {card.name}
              <span className="block text-[10px] text-white/50">{locName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
