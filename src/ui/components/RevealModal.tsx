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
  /** Ferme le modal (acquittement). */
  onAcknowledge: () => void
}

/**
 * Liste de Fidget (Ratigan) — montre TOUTES les cartes dévoilées de la pioche.
 * La carte gardée (ajoutée à la main) est mise en avant ; les autres sont
 * défaussées. Purement informatif : un bouton « Compris » referme le modal.
 */
export function RevealModal({ cards, keptInstanceId, title = 'Cartes dévoilées', onAcknowledge }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-amber-400/30 bg-[#181206] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">{title}</h2>
        <p className="text-center text-sm text-white/70">
          {keptInstanceId
            ? 'L’Objet trouvé est ajouté à votre main ; les autres cartes dévoilées sont défaussées.'
            : 'Aucun Objet trouvé : toutes les cartes dévoilées sont défaussées.'}
        </p>

        <div className="flex flex-wrap items-start justify-center gap-4">
          {cards.map((c) => {
            const def = getCardDef(c.cardId)
            const kept = c.instanceId === keptInstanceId
            return (
              <div key={c.instanceId} className="flex flex-col items-center gap-1">
                <span className={`h-4 text-[11px] font-bold ${kept ? 'text-emerald-300' : 'text-white/40'}`}>
                  {kept ? '✓ Dans votre main' : 'Défaussée'}
                </span>
                <img
                  src={def?.image}
                  alt={c.name}
                  className={`h-60 w-auto rounded-lg border-2 transition ${
                    kept ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-white/15 opacity-70'
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
