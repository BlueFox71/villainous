import { describe, it, expect } from 'vitest'
import { evaluate } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

let n = 0
const ally = (extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `a${n++}`,
  cardId: 'kamella',
  name: 'kamella',
  type: 'ally',
  strength: 3,
  ...extra,
})

function twoPlayerGame(): GameState {
  const setup = {
    villain: bowser,
    deckCards: buildDeckInstances(bowserCards, 'villain', 'x:'),
    fateCards: buildDeckInstances(bowserCards, 'fate', 'xf:'),
  }
  return createInitialGame([setup, setup], 1)
}

/** Reconstruit l'état avec le plateau de Bowser (joueur 0) donné + nb d'Étoiles. */
function withBoard(board: Record<string, CardInstance[]>, observatoryStars: number): GameState {
  const g = twoPlayerGame()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  const p0 = { ...g.players[0], board: { ...empty, ...board }, observatoryStars }
  return { ...g, players: [p0, g.players[1]] }
}

describe('Bowser — positionnement anti-Luigi des porteurs d\'Étoile', () => {
  it('un Allié PORTEUR d\'Étoile vaut mieux HORS de l\'Observatoire (Observatoire non verrouillé)', () => {
    const on = withBoard({ observatoire: [ally({ stars: 1 })] }, 2)
    const off = withBoard({ galaxies: [ally({ stars: 1 })] }, 2)
    expect(evaluate(off, 0)).toBeGreaterThan(evaluate(on, 0))
  })

  it('une fois l\'Observatoire VERROUILLÉ (0 Étoile), la position du porteur n\'importe plus', () => {
    const on = withBoard({ observatoire: [ally({ stars: 1 })] }, 0)
    const off = withBoard({ galaxies: [ally({ stars: 1 })] }, 0)
    expect(evaluate(off, 0)).toBeCloseTo(evaluate(on, 0), 5)
  })

  it('un Allié SANS Étoile vaut mieux SUR l\'Observatoire (prêt à drainer)', () => {
    const on = withBoard({ observatoire: [ally({})] }, 2)
    const off = withBoard({ galaxies: [ally({})] }, 2)
    expect(evaluate(on, 0)).toBeGreaterThan(evaluate(off, 0))
  })
})
