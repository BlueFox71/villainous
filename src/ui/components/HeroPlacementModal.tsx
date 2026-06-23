import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Héros révélé par Aurore, à placer. */
  hero: CardInstance
  /** Joueur dont le plateau reçoit le Héros (Maléfique). */
  target: PlayerState
  /** Lieux où le Héros peut légalement être posé. */
  validLocations: string[]
  onPlace: (locationId: string) => void
}

/** Choix du lieu pour le Héros révélé par Aurore (placement par le joueur qui a
 *  joué la Fatalité). Les lieux interdits sont grisés. */
export function HeroPlacementModal({ hero, target, validLocations, onPlace }: Props) {
  const def = getCardDef(hero.cardId)
  const valid = new Set(validLocations)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <h2 className="text-base font-bold text-white">Aurore révèle {hero.name}</h2>
        <p className="text-xs text-white/60">
          Choisis où poser ce Héros (force {hero.strength ?? '?'}) chez {target.villainName}.
        </p>
        {def && (
          <div className="flex justify-center">
            <img src={def.image} alt={hero.name} className="h-56 w-auto rounded-lg" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {target.locations
            // Sa Sucrerie : le circuit n'accueille pas de Héros (seulement les 4 zones).
            .filter((loc) => !(target.villain === 'sa-sucrerie' && loc.id === 'sugar-rush'))
            .map((loc) => {
            const ok = valid.has(loc.id)
            return (
              <button
                key={loc.id}
                onClick={() => ok && onPlace(loc.id)}
                disabled={!ok}
                title={ok ? undefined : `${hero.name} ne peut pas y être posé.`}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  ok
                    ? 'border-white/40 text-white hover:bg-white/10'
                    : 'cursor-not-allowed border-white/10 text-white/30'
                }`}
              >
                {loc.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
