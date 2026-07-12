import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur qui a dévoilé (et va jouer/défausser) le Héros. */
  player: PlayerState
  hero: CardInstance
  /** Autres cartes dévoilées, qui seront défaussées (montrées pour information). */
  discarded: CardInstance[]
  onResolve: (play: boolean, to?: string) => void
  /** Le Héros DOIT être joué (STITCH EN VUE : « Jouez-le ») → pas d'option « Défausser ».
   *  Sans ce flag (ATTRAPÉ : « Jouez-le ou défaussez-le »), un bouton « Défausser » s'affiche. */
  mustPlay?: boolean
}

/**
 * Digne Adversaire / Obsession — un Héros a été dévoilé : le jouer dans son
 * royaume (choix du lieu ; Peter Pan → Arbre du Pendu d'office) ou le défausser.
 * Les autres cartes dévoilées (défaussées) sont affichées.
 */
export function FetchedHeroModal({ player, hero, discarded, onResolve, mustPlay }: Props) {
  const def = getCardDef(hero.cardId)
  const isPeterPan = hero.cardId === 'peter-pan'
  const locked = new Set(player.lockedLocations ?? [])
  const destinations = isPeterPan
    ? player.locations.filter((l) => l.id === 'arbre-pendu')
    : player.locations.filter((l) => !locked.has(l.id))

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b0a12] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">Héros dévoilé — à jouer dans votre royaume</h2>
        <div className="flex items-end gap-4">
          <div className="flex flex-col items-center">
            <img src={def?.image} alt={hero.name} className="h-56 w-auto rounded-lg border-2 border-amber-300" />
            <span className="mt-1 text-sm font-bold">{hero.name} (force {hero.strength ?? '?'})</span>
          </div>
          {discarded.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-white/50">Défaussées :</span>
              <div className="flex gap-1">
                {discarded.map((c) => (
                  <img
                    key={c.instanceId}
                    src={getCardDef(c.cardId)?.image}
                    alt={c.name}
                    title={c.name}
                    className="h-24 w-auto rounded border border-white/15 opacity-70"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-sm text-white/70">
            {isPeterPan ? 'Peter Pan fonce sur l’Arbre du Pendu.' : 'Sur quel lieu le poser ?'}
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {destinations.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onResolve(true, l.id)}
                className="rounded-lg border border-emerald-300/60 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-400/20"
              >
                {l.name}
              </button>
            ))}
          </div>
          {!mustPlay && (
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="mt-1 rounded-lg border border-rose-300/60 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-400/20"
            >
              Défausser le Héros
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
