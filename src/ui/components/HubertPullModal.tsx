import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur dont les Alliés sont déplacés (Maléfique). */
  target: PlayerState
  /** Lieu de Roi Hubert (destination). */
  dest: string
  /** Lieux voisins de `dest`. */
  adjacent: string[]
  /** `allyInstanceIds` = un Allié choisi par lieu voisin (au plus). */
  onConfirm: (allyInstanceIds: string[]) => void
}

/** Roi Hubert : le joueur choisit UN Allié (au plus) par lieu voisin à attirer
 *  vers le lieu de Hubert. Facultatif (on peut ne rien choisir pour un lieu). */
export function HubertPullModal({ target, dest, adjacent, onConfirm }: Props) {
  // picks[locationId] = instanceId de l'Allié choisi pour ce lieu (ou absent).
  const [picks, setPicks] = useState<Record<string, string | undefined>>({})
  const locName = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id
  const alliesAt = (loc: string) =>
    (target.board[loc] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo)

  const rows = adjacent.filter((loc) => alliesAt(loc).length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-white/20 bg-[#0b0a12] p-4">
        <h2 className="text-base font-bold text-white">Roi Hubert</h2>
        <p className="text-xs text-white/60">
          Attire un Allié (au plus) de chaque lieu voisin vers <b>{locName(dest)}</b>. Clique pour
          (dé)sélectionner — facultatif.
        </p>
        {rows.map((loc) => (
          <div key={loc} className="rounded-lg border border-white/10 p-2">
            <div className="mb-1 text-[11px] font-semibold text-white/70">{locName(loc)}</div>
            <div className="flex flex-wrap gap-2">
              {alliesAt(loc).map((a) => {
                const def = getCardDef(a.cardId)
                const sel = picks[loc] === a.instanceId
                return (
                  <button
                    key={a.instanceId}
                    onClick={() => setPicks((p) => ({ ...p, [loc]: sel ? undefined : a.instanceId }))}
                    className={`flex flex-col items-center rounded-lg border p-1 text-[10px] ${
                      sel ? 'border-amber-300 bg-amber-300/10 text-white' : 'border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <img src={def?.image} alt={a.name} className="mb-0.5 w-12 rounded" />
                    {a.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <button
          onClick={() => onConfirm(Object.values(picks).filter((x): x is string => !!x))}
          className="self-end rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Valider
        </button>
      </div>
    </div>
  )
}
