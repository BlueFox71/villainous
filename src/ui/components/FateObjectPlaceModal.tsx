import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Objet Fatalité à associer (Vidéo de surveillance, Carte). */
  card: CardInstance
  /** Joueur (l'Imposteur) dont le royaume reçoit l'Objet. */
  target: PlayerState
  onPlace: (locationId: string) => void
}

/** Choix du lieu où associer un Objet Fatalité de L'Imposteur (Vidéo de
 *  surveillance / Carte), par le joueur qui pose la Fatalité. */
export function FateObjectPlaceModal({ card, target, onPlace }: Props) {
  const def = getCardDef(card.cardId)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <h2 className="text-base font-bold text-white">{card.name}</h2>
        <p className="text-xs text-white/60">
          Choisis le lieu de {target.villainName} où associer cette carte.
        </p>
        {def && (
          <div className="flex justify-center">
            <img src={def.image} alt={card.name} className="h-56 w-auto rounded-lg" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {target.locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => onPlace(loc.id)}
              className="rounded-lg border border-white/40 px-2 py-2 text-xs text-white hover:bg-white/10"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
