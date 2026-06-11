import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function hero(id: string): CardInstance {
  return { instanceId: id, cardId: 'enfant-perdu', name: 'Enfant Perdu', type: 'hero', strength: 1 }
}

/** Partie Slenderman, pion sur Maison Perdue, phase ACTION, un Héros sur La Mine. */
function setup(): GameState {
  const base = createInitialGame(
    [
      {
        villain: slenderman,
        deckCards: buildDeckInstances(slendermanCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(slendermanCards, 'fate', 'p0f:'),
      },
    ],
    42,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      pawnLocation: 'maison-perdue',
      board: { ...p.board, mine: [...(p.board['mine'] ?? []), hero('h1')] },
    })),
  }
}

describe('Action « Déplacer un Héros » (Maison Perdue)', () => {
  it('déplace un Héros vers un lieu voisin', () => {
    const s = setup()
    const next = applyAction(s, { type: 'MOVE_HERO', actionId: 'move-hero', heroInstanceId: 'h1', to: 'tunnel' })
    expect((next.players[0].board['mine'] ?? []).some((c) => c.instanceId === 'h1')).toBe(false)
    expect((next.players[0].board['tunnel'] ?? []).some((c) => c.instanceId === 'h1')).toBe(true)
    expect(next.usedActionIds).toContain('move-hero')
  })

  it('refuse un lieu non voisin', () => {
    const s = setup()
    // La Mine (index 2) voisins = Le Tunnel (1) et Maison Perdue (3). La Forêt (0) n'est pas voisine.
    expect(() =>
      applyAction(s, { type: 'MOVE_HERO', actionId: 'move-hero', heroInstanceId: 'h1', to: 'foret' }),
    ).toThrow()
  })
})
