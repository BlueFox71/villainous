import { useState, type ReactNode } from 'react'
import type { LocationId, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Royaume ciblé (celui de Mère Gothel) où se trouvent les Cavaliers et Maximus. */
  target: PlayerState
  phase: 'cavaliers' | 'maximus'
  maximusInstanceId: string
  /** Phase « cavaliers » : déplace le Cavaliers choisi vers `to`, ou passe (null, null). */
  onCavaliers: (allyInstanceId: string | null, to: LocationId | null) => void
  /** Phase « maximus » : déplace Maximus vers `to`, ou passe (null). */
  onMaximus: (to: LocationId | null) => void
}

/**
 * Mère Gothel — Maximus : le joueur qui pose la Fatalité repositionne (facultatif) une
 * carte Cavaliers du roi vers un lieu voisin, puis Maximus vers un lieu voisin.
 */
export function MaximusModal({ target, phase, maximusInstanceId, onCavaliers, onMaximus }: Props) {
  const [allyId, setAllyId] = useState<string | null>(null)
  const order = target.locations.map((l) => l.id)
  const locked = new Set(target.lockedLocations ?? [])
  const nameOf = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id
  const adjacent = (from: string): string[] => {
    const i = order.indexOf(from)
    return [order[i - 1], order[i + 1]].filter((id): id is string => !!id && !locked.has(id))
  }
  const locationOf = (instanceId: string) =>
    target.locations.find((l) => (target.board[l.id] ?? []).some((c) => c.instanceId === instanceId))?.id

  const wrap = (children: ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">Maximus : repositionnement</h2>
        {children}
      </div>
    </div>
  )

  if (phase === 'cavaliers') {
    const cavaliers = target.locations.flatMap((loc) =>
      (target.board[loc.id] ?? [])
        .filter((c) => c.type === 'ally' && c.cardId === 'cavaliers-du-roi' && !c.attachedTo)
        .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
    )
    const picked = cavaliers.find((a) => a.id === allyId)
    const dests = picked ? adjacent(picked.from) : []
    return wrap(
      !picked ? (
        <>
          <p className="text-center text-sm text-white/70">Déplacer une carte Cavaliers du roi (facultatif) :</p>
          <div className="flex flex-wrap justify-center gap-2">
            {cavaliers.map((a) => (
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
          <button
            type="button"
            onClick={() => onCavaliers(null, null)}
            className="self-center rounded border border-white/25 px-4 py-1.5 text-sm text-white/70 hover:bg-white/10"
          >
            Passer
          </button>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-white/70">
            <b className="text-amber-200">{picked.name}</b> (sur {nameOf(picked.from)}) → lieu voisin :
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {dests.map((to) => (
              <button
                key={to}
                type="button"
                onClick={() => onCavaliers(picked.id, to)}
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
            ← Choisir un autre Cavalier
          </button>
        </>
      ),
    )
  }

  // Phase « maximus » : déplacer Maximus vers un lieu voisin (facultatif).
  const from = locationOf(maximusInstanceId)
  const dests = from ? adjacent(from) : []
  return wrap(
    <>
      <p className="text-center text-sm text-white/70">Déplacer Maximus vers un lieu voisin (facultatif) :</p>
      <div className="flex flex-wrap justify-center gap-2">
        {dests.map((to) => (
          <button
            key={to}
            type="button"
            onClick={() => onMaximus(to)}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-purple-950 hover:bg-amber-400"
          >
            {nameOf(to)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onMaximus(null)}
        className="self-center rounded border border-white/25 px-4 py-1.5 text-sm text-white/70 hover:bg-white/10"
      >
        Passer
      </button>
    </>,
  )
}
