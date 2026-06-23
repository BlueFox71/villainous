import type { PlayerState } from '../../engine/types'

interface Props {
  player: PlayerState
  onResolve: (to: string) => void
  /** Titre affiché (défaut : Réinitialisation / Buzz). */
  title?: string
  /** Lieu à EXCLURE de la liste (ex. lieu de départ pour Flex). */
  excludeLocationId?: string
}

/**
 * Lotso — choix d'un LIEU de destination. Sert à Réinitialisation (placer Buzz en mode Démo)
 * et à la phase 2 de Flex (déplacer un Héros/Buzz vers n'importe quel autre lieu).
 */
export function LotsoBuzzMoveModal({ player, onResolve, title, excludeLocationId }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-pink-200">{title ?? 'Buzz l’Éclair passe en mode Démo'}</h2>
        <p className="text-center text-sm text-white/70">Choisis le lieu où le placer :</p>
        <div className="flex flex-col gap-2">
          {player.locations.filter((loc) => loc.id !== excludeLocationId).map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => onResolve(loc.id)}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:border-pink-400 hover:bg-white/10"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
