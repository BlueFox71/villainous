import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur dont on déplace un Héros (son royaume). */
  target: PlayerState
  /** Déplace le Héros choisi vers le lieu voisin. */
  onResolve: (heroInstanceId: string, to: string) => void
  /** Tourbillon (Ursula) : autorise N'IMPORTE quel lieu non bloqué. */
  anyLocation?: boolean
  /** Restreint les Héros déplaçables (Stratos, Mégara, Hermès). Absent = tous. */
  candidateIds?: string[]
  /** Poupées vaudou : direction imposée (−1 gauche / +1 droite), 1 lieu. */
  forcedDirection?: number
  /** Déplacement facultatif (« vous pouvez ») : bouton « Passer » disponible. */
  optional?: boolean
  /** Décline le déplacement (si `optional`). */
  onSkip?: () => void
}

/**
 * Apparition / Vent de panique : choisir un Héros du royaume de `target` puis un
 * lieu voisin de sa position (ou n'importe quel lieu non bloqué — Tourbillon).
 * Poupées vaudou (Dr Facilier) : direction imposée + déplacement facultatif.
 */
export function HeroRelocateModal({ target, onResolve, anyLocation = false, candidateIds, forcedDirection, optional, onSkip }: Props) {
  const [heroId, setHeroId] = useState<string | null>(null)
  const ids = target.locations.map((l) => l.id)
  const locked = new Set(target.lockedLocations ?? [])
  const nameOf = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id

  const heroes = target.locations.flatMap((loc) =>
    (target.board[loc.id] ?? [])
      .filter((c) => c.type === 'hero' && (!candidateIds || candidateIds.includes(c.instanceId)))
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )
  const picked = heroes.find((h) => h.id === heroId)
  const adj = picked
    ? forcedDirection !== undefined
      ? [ids[ids.indexOf(picked.from) + forcedDirection]].filter((id): id is string => !!id && !locked.has(id))
      : anyLocation
        ? ids.filter((id) => id !== picked.from && !locked.has(id))
        : (() => {
            const i = ids.indexOf(picked.from)
            return [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id && !locked.has(id))
          })()
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">
          {forcedDirection !== undefined
            ? `Poupées vaudou : déplacer un Héros vers ${forcedDirection < 0 ? 'la gauche' : 'la droite'}`
            : 'Déplacer un Héros vers un lieu voisin'}
        </h2>

        {!picked ? (
          <>
            <p className="text-center text-sm text-white/70">Choisis le Héros à déplacer :</p>
            <div className="flex flex-wrap justify-center gap-2">
              {heroes.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHeroId(h.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
                >
                  <img src={getCardDef(h.cardId)?.image} alt={h.name} className="w-16 rounded" />
                  <span className="text-[11px] text-white/70">{nameOf(h.from)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">
              <b className="text-amber-200">{picked.name}</b> (sur {nameOf(picked.from)}) → clique le
              lieu voisin :
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {adj.map((to) => (
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
              onClick={() => setHeroId(null)}
              className="self-center text-xs text-white/50 hover:text-white/80"
            >
              ← Choisir un autre Héros
            </button>
          </>
        )}

        {optional && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="self-center rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
          >
            Passer (ne pas déplacer)
          </button>
        )}
      </div>
    </div>
  )
}
