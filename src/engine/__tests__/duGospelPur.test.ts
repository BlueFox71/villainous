import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { hades } from '../../data/villains/hades'
import { hadesCards } from '../../data/villains/hades.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

function hadesVsHades(): GameState {
  return createInitialGame(
    [
      { villain: hades, deckCards: buildDeckInstances(hadesCards, 'villain', 'a:'), fateCards: buildDeckInstances(hadesCards, 'fate', 'af:') },
      { villain: { ...hades, name: 'H2' }, deckCards: buildDeckInstances(hadesCards, 'villain', 'b:'), fateCards: buildDeckInstances(hadesCards, 'fate', 'bf:') },
    ],
    1,
  )
}

describe('Hadès — Du gospel pur ! vise le Char en priorité', () => {
  const gospel: CardInstance = { instanceId: 'g1', cardId: 'du-gospel-pur', name: 'Du gospel pur !', type: 'effect' }
  const other: CardInstance = { instanceId: 'o1', cardId: 'x', name: 'X', type: 'effect' }

  it('défausse le Char plutôt qu’un Allié non-Titan présent', () => {
    const char: CardInstance = { instanceId: 'ch', cardId: 'char', name: 'Char', type: 'item' }
    const cerbere: CardInstance = { instanceId: 'ce', cardId: 'cerbere', name: 'Cerbère', type: 'ally', strength: 4 }
    let s = hadesVsHades()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [gospel, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, enfers: [char, cerbere] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'g1' })
    expect(s.players[0].discard.some((c) => c.cardId === 'char')).toBe(true)
    expect((s.players[0].board['enfers'] ?? []).some((c) => c.cardId === 'cerbere')).toBe(true)
  })
})
