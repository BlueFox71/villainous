import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** cardId du Héros à poser/déplacer (Basil). */
  heroCardId: string
  heroName: string
  /** 'place' : le Héros est cherché dans la pioche/défausse ; 'move' : déjà en jeu. */
  mode: 'place' | 'move'
  /** Joueur (Ratigan) dont le royaume reçoit le Héros. */
  target: PlayerState
  onPlace: (locationId: string) => void
}

/** Ratigan — Appel à l'aide : le joueur qui pose la Fatalité choisit le lieu du
 *  royaume de la cible où poser (ou déplacer) le Héros cherché (Basil). */
export function FateHeroPlaceModal({ heroCardId, heroName, mode, target, onPlace }: Props) {
  const def = getCardDef(heroCardId)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <h2 className="text-base font-bold text-white">Appel à l’aide</h2>
        <p className="text-xs text-white/60">
          Choisis le lieu de {target.villainName} où {mode === 'move' ? 'déplacer' : 'faire apparaître'}{' '}
          <b className="text-amber-200">{heroName}</b>.
        </p>
        {def && (
          <div className="flex justify-center">
            <img src={def.image} alt={heroName} className="h-56 w-auto rounded-lg" />
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
