import type { PlayerState } from '../../engine/types'
import { teleportTargets } from '../../engine/rules'

interface Props {
  /** Joueur qui se téléporte (Slenderman). */
  player: PlayerState
  /** Déplace le pion vers le lieu choisi. */
  onResolve: (to: string) => void
}

/**
 * Téléportation : choisir le lieu (portant un Héros sans Lampe de poche) où
 * déplacer son pion.
 */
export function TeleportModal({ player, onResolve }: Props) {
  const targets = teleportTargets(player)
  const nameOf = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">Téléportation</h2>
        <p className="text-center text-sm text-white/70">
          Déplacez votre pion sur un lieu portant un Héros, puis jouez-y :
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {targets.map((to) => (
            <button
              key={to}
              type="button"
              onClick={() => onResolve(to)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-purple-950 hover:bg-amber-400"
            >
              {nameOf(to)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
