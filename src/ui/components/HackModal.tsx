import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'

interface Props {
  /** Joueur (Sombra) qui pirate. */
  player: PlayerState
  /** Lieu piraté. */
  locationId: string
  /** Ids des actions désactivables (non déjà piratées). */
  actionIds: string[]
  /** Désactive l'action choisie. */
  onResolve: (actionId: string) => void
}

/**
 * Sombra — Piratage : choisir l'action du lieu à DÉSACTIVER (recouverte par un Hack
 * tant que le Piratage y reste). Une option par action désactivable.
 */
export function HackModal({ player, locationId, actionIds, onResolve }: Props) {
  const loc = player.locations.find((l) => l.id === locationId)
  const actions = (loc?.actions ?? []).filter((a) => actionIds.includes(a.id))
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-fuchsia-400/30 bg-[#160a1f] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">Piratage de {loc?.name ?? locationId}</h2>
        <p className="text-center text-sm text-white/70">
          Choisis l’action à désactiver. Elle restera coupée (recouverte par un Hack)
          tant que ce Piratage reste sur le lieu.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onResolve(a.id)}
              className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-600/20 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-600/40"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
