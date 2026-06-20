import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  player: PlayerState
  /** Titre (nom de la carte source). */
  label?: string
  /** Valide le déplacement de `instanceId` vers `to`. */
  onResolve: (instanceId: string, to: string) => void
  /** Ne rien déplacer (l'effet est facultatif). */
  onSkip: () => void
}

/**
 * Cheval (Pat Hibulaire) — déplacement facultatif d'un Allié ou Objet :
 *  1) choisir la carte (Allié/Objet non associé de son royaume),
 *  2) choisir le lieu de destination,
 *  3) valider — ou « Ne rien déplacer ».
 */
export function MoveAllyItemModal({ player, label = 'Cheval', onResolve, onSkip }: Props) {
  const [pickId, setPickId] = useState<string | null>(null)

  // Cartes déplaçables : Alliés et Objets NON associés, par lieu.
  const movable = player.locations.flatMap((l) =>
    (player.board[l.id] ?? [])
      .filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo)
      .map((c) => ({ card: c, locId: l.id, locName: l.name })),
  )
  const picked = movable.find((m) => m.card.instanceId === pickId)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1020] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">{label}</h2>
        <p className="text-center text-sm text-white/70">
          {picked
            ? `Choisissez le lieu où déplacer « ${picked.card.name} ».`
            : 'Vous pouvez déplacer un Allié ou un Objet de votre royaume sur n’importe quel lieu.'}
        </p>

        {/* Étape 1 : choix de la carte. */}
        {!picked && (
          <div className="flex max-h-[55vh] flex-wrap items-end justify-center gap-3 overflow-y-auto">
            {movable.map((m) => {
              const def = getCardDef(m.card.cardId)
              return (
                <button
                  key={m.card.instanceId}
                  type="button"
                  onClick={() => setPickId(m.card.instanceId)}
                  className="flex flex-col items-center gap-1"
                >
                  <img
                    src={def?.image}
                    alt={m.card.name}
                    className="h-40 w-auto rounded-lg border-2 border-white/15 opacity-80 transition hover:opacity-100"
                  />
                  <span className="text-[10px] uppercase tracking-wide text-white/40">{m.locName}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Étape 2 : choix du lieu de destination (hors lieu actuel). */}
        {picked && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {player.locations
                .filter((l) => l.id !== picked.locId)
                .map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onResolve(picked.card.instanceId, l.id)}
                    className="rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/25"
                  >
                    {l.name}
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setPickId(null)}
              className="text-xs text-white/50 underline hover:text-white/80"
            >
              ← Changer de carte
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
        >
          Ne rien déplacer
        </button>
      </div>
    </div>,
    document.body,
  )
}
