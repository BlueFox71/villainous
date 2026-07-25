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
  /** Une rangée de Héros en GRAND (lisibles, côte à côte) avec agrandissement au survol. */
  const row = (heroes: CardInstance[], onClick: (id: string) => void, tone: 'amber' | 'sky') => (
    <div className="flex flex-wrap items-start justify-center gap-3">
      {heroes.map((c) => (
        <button
          key={c.instanceId}
          type="button"
          onClick={() => onClick(c.instanceId)}
          title={getCardDef(c.cardId)?.name ?? c.name}
          className={`relative shrink-0 rounded-lg border p-1 transition hover:z-10 ${
            tone === 'amber'
              ? 'border-amber-400/50 hover:border-amber-300 hover:bg-amber-400/10'
              : 'border-sky-400/50 hover:border-sky-300 hover:bg-sky-400/10'
          }`}
        >
          <img
            src={getCardDef(c.cardId)?.image}
            alt={c.name}
            className="h-56 w-auto rounded transition-transform duration-150 ease-out hover:scale-[1.3]"
          />
        </button>
      ))}
    </div>
  )
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-lg font-bold text-amber-200">Hakuna Matata</h2>
        {successionHeroes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">
              Rejouer un Héros (≤3) de la Succession
            </div>
            {row(successionHeroes, onPlay, 'amber')}
          </div>
        )}
        {realmHeroes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-300/80">
              Déplacer un Héros du royaume (n'importe quel lieu)
            </div>
            {row(realmHeroes, onMove, 'sky')}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
