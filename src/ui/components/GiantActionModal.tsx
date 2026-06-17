import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'

interface Props {
  player: PlayerState
  onResolve: (locationId: string) => void
  /** Titre (défaut : Colère Titanesque ; Canne pour le Dr Facilier). */
  title?: string
  /** Sous-titre explicatif. */
  subtitle?: string
  /** Lieux proposés. Par défaut : les lieux voisins du pion. Fourni explicitement
   *  pour Suivez-moi ! (Scar) → les lieux portant une Hyène. */
  locations?: string[]
}

/**
 * Colère Titanesque (Ursula) / Canne (Dr Facilier) — choisir un lieu VOISIN sur
 * lequel effectuer une action. Une fois le lieu choisi, le joueur agit dessus
 * comme s'il y était (le temps d'une action).
 */
export function GiantActionModal({
  player,
  onResolve,
  title = 'Colère Titanesque',
  subtitle = 'Choisissez un lieu voisin (bloqué ou non) : vous y effectuerez ensuite une action.',
  locations,
}: Props) {
  const order = player.locations.map((l) => l.id)
  const i = order.indexOf(player.pawnLocation ?? '')
  const choices = locations ?? ([order[i - 1], order[i + 1]].filter((id): id is string => !!id))

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a0a24] p-6 text-white">
        <h2 className="text-xl font-black text-fuchsia-200">{title}</h2>
        <p className="text-center text-sm text-white/70">{subtitle}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {choices.map((id) => {
            const loc = player.locations.find((l) => l.id === id)
            const blocked = (player.lockedLocations ?? []).includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onResolve(id)}
                className="rounded-lg border border-fuchsia-300/60 px-4 py-2 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-400/20"
              >
                {loc?.name ?? id}
                {blocked && <span className="block text-[10px] text-white/50">(bloqué)</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
