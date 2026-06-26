import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur (Syndrome) qui déplace un de ses Alliés/Objets. */
  player: PlayerState
  /** Déplace la carte choisie vers le lieu (portant un Héros) choisi. */
  onResolve: (cardInstanceId: string, to: string) => void
}

/**
 * Syndrome — « Identification, je vous prie » : choisir un Allié OU un Objet (non
 * associé) du royaume, puis n'importe quel lieu portant au moins un Héros où le déplacer.
 */
export function IdentificationModal({ player, onResolve }: Props) {
  const [cardId, setCardId] = useState<string | null>(null)
  const nameOf = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id

  // Alliés + Objets non associés (un arceau reste un Allié, mais ici exclu pour rester simple).
  // L'Omnidroïde/Télécommande (immuneToAllyItemEffects) RESTENT déplaçables : le flag ne
  // bloque que les effets adverses, pas la propre carte de Syndrome.
  const movables = player.locations.flatMap((loc) =>
    (player.board[loc.id] ?? [])
      .filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket)
      .map((c) => ({ id: c.instanceId, cardId: c.cardId, name: c.name, from: loc.id })),
  )
  // Lieux portant au moins un Héros.
  const heroLocs = player.locations
    .map((l) => l.id)
    .filter((id) => (player.board[id] ?? []).some((c) => c.type === 'hero'))
  const picked = movables.find((m) => m.id === cardId)
  const dests = picked ? heroLocs.filter((id) => id !== picked.from) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-amber-200">
          Identification, je vous prie
        </h2>

        {!picked ? (
          <>
            <p className="text-center text-sm text-white/70">
              Choisis l’Allié ou l’Objet à déplacer :
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {movables.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCardId(m.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
                >
                  <img src={getCardDef(m.cardId)?.image} alt={m.name} className="w-16 rounded" />
                  <span className="text-[11px] text-white/70">{nameOf(m.from)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">
              <b className="text-amber-200">{picked.name}</b> (sur {nameOf(picked.from)}) → clique le
              lieu (avec un Héros) de destination :
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
              {dests.length === 0 && (
                <p className="text-center text-xs text-white/50">
                  Aucun autre lieu avec un Héros — choisis une autre carte.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCardId(null)}
              className="self-center text-xs text-white/50 hover:text-white/80"
            >
              ← Choisir une autre carte
            </button>
          </>
        )}
      </div>
    </div>
  )
}
