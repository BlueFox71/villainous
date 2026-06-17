import { describe, it, expect } from 'vitest'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import { activatableCards } from '../rules'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    7,
  )
}

const jr: CardInstance = { instanceId: 'jr1', cardId: 'bowser-jr', name: 'Bowser Jr.', type: 'ally', strength: 2, activatedCost: 3 }
const peach: CardInstance = { instanceId: 'pe1', cardId: 'peach', name: 'Peach', type: 'hero', strength: 2 }

function withBowser(patch: Partial<GameState['players'][number]>): GameState {
  const base = game()
  return {
    ...base,
    activePlayer: 0,
    phase: 'ACTION',
    players: [
      { ...base.players[0], power: 10, board: { ...base.players[0].board, galaxies: [jr] }, ...patch },
      base.players[1],
    ],
  }
}

describe('Bowser Jr. — capacité activée gatée par Peach', () => {
  it('activable tant que Peach n’est ni en jeu ni capturée', () => {
    const s = withBowser({})
    expect(activatableCards(s).some((c) => c.cardId === 'bowser-jr')).toBe(true)
  })

  it('NON activable si Peach est capturée', () => {
    const s = withBowser({ peachCaptured: true })
    expect(activatableCards(s).some((c) => c.cardId === 'bowser-jr')).toBe(false)
  })

  it('NON activable si Peach est en jeu sur le plateau', () => {
    const base = withBowser({})
    const s: GameState = {
      ...base,
      players: [
        { ...base.players[0], board: { ...base.players[0].board, galaxies: [jr], 'chateau-peach': [peach] } },
        base.players[1],
      ],
    }
    expect(activatableCards(s).some((c) => c.cardId === 'bowser-jr')).toBe(false)
  })
})
