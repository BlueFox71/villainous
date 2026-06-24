import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { mechanteReine } from '../../data/villains/mechanteReine'
import { mechanteReineCards, mechanteReineCardById } from '../../data/villains/mechanteReine.cards'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'a:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'af:') },
      { villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'b:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'bf:') },
    ],
    1,
  )
}

describe('Méchante Reine — Atchoum défausse un Objet (le Miroir) sur son lieu', () => {
  it('défausse le Miroir magique présent là où Atchoum est joué', () => {
    const atchoum: CardInstance = { instanceId: 'at#1', cardId: 'atchoum', name: 'Atchoum', type: 'hero', strength: 2, onPlace: mechanteReineCardById['atchoum'].onPlace }
    const miroir: CardInstance = { instanceId: 'mi', cardId: 'miroir-magique', name: 'Miroir magique', type: 'item' }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [atchoum] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, mine: [miroir] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'at#1', to: 'mine' })
    expect((s.players[0].board['mine'] ?? []).some((c) => c.cardId === 'miroir-magique')).toBe(false)
    expect(s.players[0].discard.some((c) => c.cardId === 'miroir-magique')).toBe(true)
    expect((s.players[0].board['mine'] ?? []).some((c) => c.cardId === 'atchoum')).toBe(true)
  })

  it('sans Objet sur son lieu, Atchoum ne défausse rien (no-op)', () => {
    const atchoum: CardInstance = { instanceId: 'at#2', cardId: 'atchoum', name: 'Atchoum', type: 'hero', strength: 2, onPlace: mechanteReineCardById['atchoum'].onPlace }
    let s = game()
    s = { ...s, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [atchoum] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'at#2', to: 'mine' })
    expect((s.players[0].board['mine'] ?? []).some((c) => c.cardId === 'atchoum')).toBe(true)
  })
})
