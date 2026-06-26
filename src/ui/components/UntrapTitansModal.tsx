import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur (Hadès) qui désentrave ses Titans. */
  player: PlayerState
  /** Pouvoir disponible = nombre max de Titans désentravables (1 JT chacun). */
  power: number
  /** Désentrave les Titans choisis (peut être vide = aucun). */
  onResolve: (instanceIds: string[]) => void
}

/**
 * Hadès — « Alignement des planètes » : choisir 1 ou plusieurs Titans ENTRAVÉS à
 * désentraver (1 Jeton Pouvoir chacun, dans la limite du Pouvoir disponible).
 */
export function UntrapTitansModal({ player, power, onResolve }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const trapped = player.locations.flatMap((loc) =>
    (player.board[loc.id] ?? [])
      .filter((c) => c.isTitan && c.trapped)
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.name })),
  )
  const toggle = (id: string) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id)
      if (s.length >= power) return s // plafonné par le Pouvoir
      return [...s, id]
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-amber-200">Alignement des planètes</h2>
        <p className="text-center text-sm text-white/70">
          Choisis les Titans à désentraver (1 Pouvoir chacun — {power} disponible{power > 1 ? 's' : ''}) :
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {trapped.map((t) => {
            const on = selected.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  on ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400' : 'border-white/20 hover:bg-white/10'
                }`}
              >
                <img src={getCardDef(t.cardId)?.image} alt={t.name} className="w-16 rounded" />
                <span className="text-[11px] text-white/70">{t.from}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onResolve(selected)}
            disabled={selected.length === 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-purple-950 enabled:hover:bg-amber-400 disabled:opacity-40"
          >
            Désentraver {selected.length > 0 ? `${selected.length} (−${selected.length} JT)` : ''}
          </button>
          <button
            type="button"
            onClick={() => onResolve([])}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Aucun
          </button>
        </div>
      </div>
    </div>
  )
}
