import { createPortal } from 'react-dom'
import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Toutes les cartes dévoilées de la pioche (dans l'ordre de révélation). */
  cards: CardInstance[]
  /** instanceId de la carte ajoutée à la main (les autres sont défaussées). */
  keptInstanceId?: string
  /** Titre affiché (défaut : « Cartes dévoilées »). */
  title?: string
  /** Texte explicatif sous le titre (sinon texte par défaut « Objet trouvé… »). */
  subtitle?: string
  /** Cartes à surligner comme Héros (label « Héros » au lieu de « Défaussée »). */
  heroInstanceIds?: string[]
  /** Ferme le modal (acquittement). */
  onAcknowledge: () => void
}

/**
 * Liste de Fidget (Ratigan) — montre TOUTES les cartes dévoilées de la pioche.
 * La carte gardée (ajoutée à la main) est mise en avant ; les autres sont
 * défaussées. Purement informatif : un bouton « Compris » referme le modal.
 */
export function RevealModal({ cards, keptInstanceId, title = 'Cartes dévoilées', subtitle, heroInstanceIds, onAcknowledge }: Props) {
  const heroSet = new Set(heroInstanceIds ?? [])
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      {/* Jusqu'à une dizaine de cartes dévoilées (Big Baby fouille la pioche Fatalité) : la
          grille défile et le bouton « Compris » reste TOUJOURS accessible (il est hors de la
          zone défilante). */}
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col items-center gap-4 rounded-2xl border border-amber-400/30 bg-[#181206] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">{title}</h2>
        <p className="text-center text-sm text-white/70">
          {subtitle
            ? subtitle
            : keptInstanceId
              ? 'L’Objet trouvé est ajouté à votre main ; les autres cartes dévoilées sont défaussées.'
              : 'Aucun Objet trouvé : toutes les cartes dévoilées sont défaussées.'}
        </p>

        <div className="grid w-full grid-cols-3 justify-items-center gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            const kept = c.instanceId === keptInstanceId
            const isHero = heroSet.has(c.instanceId)
            return (
              <div key={c.instanceId} className="relative flex flex-col items-center gap-1 hover:z-10">
                <span className={`h-4 text-[11px] font-bold ${kept ? 'text-emerald-300' : isHero ? 'text-rose-300' : 'text-white/40'}`}>
                  {kept ? '✓ Dans votre main' : isHero ? '🦸 Héros' : 'Défaussée'}
                </span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-44 w-auto rounded-lg border-2 transition-transform duration-150 ease-out hover:scale-[1.4] ${
                    kept
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50'
                      : isHero
                        ? 'border-rose-400 ring-2 ring-rose-400/40'
                        : 'border-white/15 opacity-70'
                  }`}
                />
                <span className="max-w-[12rem] text-center text-xs font-semibold text-white/80">{c.name}</span>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500"
        >
          Compris
        </button>
      </div>
    </div>,
    document.body,
  )
}
