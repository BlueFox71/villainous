import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { DiscardModal } from './DeckPiles'
import { playHistoryEvent } from '../sfx'

/**
 * Team Rocket — PILE DE CAPTURES : les Pokémon attrapés (action Attraper), face
 * visible. Affichée dans les piles secondaires (marge gauche du plateau), au même
 * emplacement que les Ingrédients de la Méchante Reine. Emplacements vides en
 * POINTILLÉS (objectif : 4 dont Pikachu) ; Pikachu cerclé d'ambre. Clic = agrandir.
 */
export function CapturePile({ player, uprightWidth = 'w-14' }: { player: PlayerState; uprightWidth?: string }) {
  const [open, setOpen] = useState(false)
  if (player.capturedPokemon === undefined) return null
  const captured = player.capturedPokemon
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-white">
        Captures {captured.length}/4
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (captured.length > 0) { playHistoryEvent(); setOpen(true) } }}
        className={`grid grid-cols-2 gap-1 ${captured.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        title={captured.length > 0 ? 'Voir les Pokémon capturés' : 'Aucun Pokémon capturé'}
      >
        {captured.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-white/40 bg-white/5`}
              />
            ))
          : captured.map((c) => (
              <img
                key={c.instanceId}
                src={getCardDef(c.cardId)?.image}
                alt={c.name}
                title={c.name}
                className={`${uprightWidth} rounded border-2 transition hover:brightness-110 ${
                  c.cardId === 'pikachu'
                    ? 'border-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.6)]'
                    : 'border-rose-400/70 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                }`}
              />
            ))}
      </button>
      {open && (
        <DiscardModal
          cards={captured}
          label={`Pokémon capturés — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
