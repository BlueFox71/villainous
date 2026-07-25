import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur dont on défausse un Allié (son royaume). */
  target: PlayerState
  /** Alliés candidats (instanceId) — p. ex. plusieurs Bandits. */
  candidateIds: string[]
  /** Libellé de la carte Fatalité (ex. « Planqués »). */
  cardName: string
  /** « Vous POUVEZ défausser un Allié » (Jessie) : propose un bouton pour DÉCLINER. */
  optional?: boolean
  onResolve: (instanceId: string) => void
  onDecline?: () => void
}

/**
 * Pat Hibulaire — « Planqués », Lotso — Jessie / « Lotso était son préféré » : celui qui
 * JOUE la carte choisit quel Allié défausser. Comme plusieurs candidats peuvent être
 * identiques (Bandits), on affiche le lieu de chacun pour les distinguer. Quand l'effet est
 * FACULTATIF (« vous pouvez »), un bouton permet de ne rien défausser — cas de Jessie
 * amenée par Big Baby, où c'est Lotso lui-même qui sacrifierait un de ses Alliés.
 */
export function FateDiscardAllyModal({ target, candidateIds, cardName, optional = false, onResolve, onDecline }: Props) {
  const nameOf = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id
  const cands = target.locations.flatMap((loc) =>
    (target.board[loc.id] ?? [])
      .filter((c) => candidateIds.includes(c.instanceId))
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">
          {cardName} : quel Allié défausser ?
        </h2>
        <div className="flex flex-wrap items-start justify-center gap-3">
          {cands.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onResolve(a.id)}
              className="relative flex shrink-0 flex-col items-center gap-1 rounded-lg border border-white/20 p-2 transition hover:z-10 hover:border-amber-400 hover:bg-white/10"
            >
              <img
                src={getCardDef(a.cardId)?.image}
                alt={a.name}
                className="h-56 w-auto rounded transition-transform duration-150 ease-out hover:scale-[1.3]"
              />
              <span className="text-[11px] text-white/70">{nameOf(a.from)}</span>
            </button>
          ))}
        </div>
        {optional && onDecline && (
          <button
            type="button"
            onClick={onDecline}
            className="mx-auto rounded-xl border border-white/30 px-5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Ne défausser aucun Allié
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
