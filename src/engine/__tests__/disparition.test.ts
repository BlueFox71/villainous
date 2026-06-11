import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function hero(id: string, strength = 3): CardInstance {
  return { instanceId: id, cardId: 'enqueteur', name: 'Enquêteur', type: 'hero', strength }
}

function game(pawn: string, boardByLoc: Record<string, CardInstance[]>): GameState {
  const base = createInitialGame(
    [
      {
        villain: slenderman,
        deckCards: buildDeckInstances(slendermanCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(slendermanCards, 'fate', 'p0f:'),
      },
    ],
    9,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      pawnLocation: pawn,
      board: { ...p.board, ...boardByLoc },
    })),
  }
}

describe('Disparition — INSTANT_VANQUISH_HERO_AT_PAWN', () => {
  it('élimine un Héros sur le lieu du pion (quelle que soit sa force)', () => {
    const s = game('foret', { foret: [hero('h1', 6)] })
    const next = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'h1' })
    expect((next.players[0].board['foret'] ?? []).some((c) => c.instanceId === 'h1')).toBe(false)
    expect(next.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
  })

  it('refuse un Héros qui n’est pas sur le lieu du pion', () => {
    const s = game('foret', { mine: [hero('h1')] })
    expect(() =>
      resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'h1' }),
    ).toThrow()
  })
})
