import { useState } from 'react'
import { getCardDef } from '../../data/registry'
import type { CardInstance } from '../../engine/types'

/**
 * Ultron — choix INTERACTIF des Sentinelles à défausser pour compléter une tuile
 * AMÉLIORATION nécessitant une défausse :
 *  - Transformation : 2 Sentinelles quelconques du domaine ;
 *  - Optimisation : 1 Drone de combat portant 2 Alliage impénétrable.
 * On clique les cartes candidates (illustrations) jusqu'à `required`, puis on confirme.
 */
export function UltronUpgradeDiscardModal({
  tileName,
  prompt,
  candidates,
  required,
  onConfirm,
  onCancel,
}: {
  tileName: string
  prompt: string
  candidates: CardInstance[]
  required: number
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}) {
  const [picks, setPicks] = useState<string[]>([])
  const toggle = (id: string) =>
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < required ? [...p, id] : p))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="flex max-w-lg flex-col gap-4 rounded-2xl border border-white/15 bg-[#1a1620] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold text-amber-200">{tileName}</h2>
          <p className="text-xs text-white/55">{prompt}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {candidates.map((c) => {
            const sel = picks.includes(c.instanceId)
            const img = getCardDef(c.cardId)?.image
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                className={`overflow-hidden rounded-lg border-2 transition ${
                  sel ? 'border-amber-300 ring-2 ring-amber-300/50' : 'border-transparent hover:border-white/30'
                }`}
              >
                {img ? (
                  <img src={img} alt={c.name} className="w-24" />
                ) : (
                  <span className="block w-24 p-2 text-xs text-white/80">{c.name}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={picks.length !== required}
            onClick={() => onConfirm(picks)}
            className="rounded-lg border border-amber-300/60 bg-amber-400/20 px-3 py-1.5 text-sm font-bold text-amber-100 transition enabled:hover:bg-amber-400/30 disabled:opacity-40"
          >
            Défausser ({picks.length}/{required})
          </button>
        </div>
      </div>
    </div>
  )
}
