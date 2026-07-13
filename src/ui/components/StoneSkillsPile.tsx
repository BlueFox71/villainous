import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { DiscardModal } from './DeckPiles'
import { playHistoryEvent } from '../sfx'

/**
 * Thanos — ZONE COMPÉTENCES : les Pierres d'Infinité CAPTURÉES (rapatriées dans son
 * domaine), face visible. Objectif = les 6. Affichée dans les piles secondaires, au même
 * emplacement que la Pile de Captures. Emplacements vides en pointillés ; clic = agrandir.
 */
export function StoneSkillsPile({ player, uprightWidth = 'w-14' }: { player: PlayerState; uprightWidth?: string }) {
  const [open, setOpen] = useState(false)
  if (player.stoneSkills === undefined) return null
  const skills = player.stoneSkills
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-white">
        Pierres {skills.length}/6
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (skills.length > 0) { playHistoryEvent(); setOpen(true) } }}
        className={`grid grid-cols-3 gap-1 ${skills.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        title={skills.length > 0 ? 'Voir les Pierres capturées' : 'Aucune Pierre capturée'}
      >
        {skills.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-amber-300/50 bg-amber-300/5`}
              />
            ))
          : skills.map((c) => (
              <img
                key={c.instanceId}
                src={getCardDef(c.cardId)?.image}
                alt={c.name}
                title={c.name}
                className={`${uprightWidth} rounded border-2 border-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.6)] transition hover:brightness-110`}
              />
            ))}
      </button>
      {open && (
        <DiscardModal
          cards={skills}
          label={`Pierres d'Infinité capturées — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
