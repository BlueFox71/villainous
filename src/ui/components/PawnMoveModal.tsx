import type { PlayerState } from '../../engine/types'

interface Props {
  /** Joueur dont le pion peut être déplacé (Maléfique). */
  target: PlayerState
  /** `locationId` = déplacer là ; `null` = ne pas déplacer. */
  onMove: (locationId: string | null) => void
}

/** Roi Stéphane : le joueur qui a joué la Fatalité peut déplacer le pion de la
 *  cible sur n'importe quel lieu, ou choisir de ne pas le déplacer. */
export function PawnMoveModal({ target, onMove }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <h2 className="text-base font-bold text-white">Roi Stéphane</h2>
        <p className="text-xs text-white/60">
          Tu peux déplacer le pion de {target.villainName} sur n'importe quel lieu.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {target.locations.map((loc) => {
            const here = loc.id === target.pawnLocation
            return (
              <button
                key={loc.id}
                onClick={() => onMove(loc.id)}
                className="rounded-lg border border-white/40 px-2 py-2 text-xs text-white hover:bg-white/10"
              >
                {loc.name}
                {here ? ' (ici)' : ''}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => onMove(null)}
          className="self-end rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Ne pas déplacer
        </button>
      </div>
    </div>
  )
}
