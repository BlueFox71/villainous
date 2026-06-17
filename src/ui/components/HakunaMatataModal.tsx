import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Héros de force ≤ 3 de la pile Succession (rejouables). */
  successionHeroes: CardInstance[]
  /** Héros présents dans le royaume (déplaçables). */
  realmHeroes: CardInstance[]
  /** Rejoue le Héros choisi depuis la Succession. */
  onPlay: (instanceId: string) => void
  /** Lance le déplacement du Héros choisi (n'importe quel lieu). */
  onMove: (instanceId: string) => void
}

/**
 * Hakuna Matata (Scar) — choix entre deux options : rejouer un Héros (≤3) de la pile
 * Succession dans le royaume, OU déplacer un Héros déjà présent vers n'importe quel
 * lieu. Le joueur clique le Héros voulu dans la section correspondante.
 */
export function HakunaMatataModal({ successionHeroes, realmHeroes, onPlay, onMove }: Props) {
  const label = (c: CardInstance) => getCardDef(c.cardId)?.name ?? c.name
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-lg font-bold text-amber-200">Hakuna Matata</h2>
        {successionHeroes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">
              Rejouer un Héros (≤3) de la Succession
            </div>
            {successionHeroes.map((c) => (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => onPlay(c.instanceId)}
                className="rounded-lg border border-amber-400/50 px-3 py-2 text-left text-sm font-bold text-amber-100 hover:bg-amber-400/15"
              >
                {label(c)} <span className="text-amber-200/60">(Force {c.strength ?? 0})</span>
              </button>
            ))}
          </div>
        )}
        {realmHeroes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-300/80">
              Déplacer un Héros du royaume (n'importe quel lieu)
            </div>
            {realmHeroes.map((c) => (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => onMove(c.instanceId)}
                className="rounded-lg border border-sky-400/50 px-3 py-2 text-left text-sm font-bold text-sky-100 hover:bg-sky-400/15"
              >
                {label(c)} <span className="text-sky-200/60">(Force {c.strength ?? 0})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
