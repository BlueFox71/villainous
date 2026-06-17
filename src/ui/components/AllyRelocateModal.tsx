import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur dont on déplace un Allié (son royaume). */
  target: PlayerState
  /** Déplace l'Allié choisi vers le lieu (non bloqué) choisi. */
  onResolve: (allyInstanceId: string, to: string) => void
}

/**
 * Flèche de Mome Raths (Fatalité, Reine de Cœur) : choisir un Allié du royaume de
 * `target` puis n'importe quel lieu non bloqué où le déplacer.
 */
export function AllyRelocateModal({ target, onResolve }: Props) {
  const [allyId, setAllyId] = useState<string | null>(null)
  const ids = target.locations.map((l) => l.id)
  const locked = new Set(target.lockedLocations ?? [])
  const nameOf = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id

  const allies = target.locations.flatMap((loc) =>
    (target.board[loc.id] ?? [])
      .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )
  const picked = allies.find((a) => a.id === allyId)
  const dests = picked ? ids.filter((id) => id !== picked.from && !locked.has(id)) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">
          Flèche de Mome Raths : déplacer un Allié
        </h2>

        {!picked ? (
          <>
            <p className="text-center text-sm text-white/70">Choisis l’Allié à déplacer :</p>
            <div className="flex flex-wrap justify-center gap-2">
              {allies.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAllyId(a.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
                >
                  <img src={getCardDef(a.cardId)?.image} alt={a.name} className="w-16 rounded" />
                  <span className="text-[11px] text-white/70">{nameOf(a.from)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">
              <b className="text-amber-200">{picked.name}</b> (sur {nameOf(picked.from)}) → clique le
              lieu de destination :
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {dests.map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => onResolve(picked.id, to)}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-purple-950 hover:bg-amber-400"
                >
                  {nameOf(to)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAllyId(null)}
              className="self-center text-xs text-white/50 hover:text-white/80"
            >
              ← Choisir un autre Allié
            </button>
          </>
        )}
      </div>
    </div>
  )
}
