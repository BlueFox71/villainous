import { describe, it, expect } from 'vitest'
import { evaluate } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    7,
  )
}

const ally = (id: string): CardInstance => ({ instanceId: id, cardId: 'bouldergeist', name: 'Bouldergeist', type: 'ally', strength: 4 })

function withBowserBoard(board: Record<string, CardInstance[]>, stars: number): GameState {
  const base = game()
  return {
    ...base,
    players: [{ ...base.players[0], observatoryStars: stars, board }, base.players[1]],
  }
}

describe('Bowser (bot) — privilégie l’Observatoire pour ses Alliés', () => {
  it('un Allié sur l’Observatoire vaut mieux qu’ailleurs tant qu’il reste des Étoiles', () => {
    const atObs = withBowserBoard({ observatoire: [ally('a')] }, 4)
    const elsewhere = withBowserBoard({ 'chateau-bowser': [ally('a')] }, 4)
    expect(evaluate(atObs, 0)).toBeGreaterThan(evaluate(elsewhere, 0))
  })

  it('plus d’Alliés sur l’Observatoire = mieux (jusqu’au plafond)', () => {
    const one = withBowserBoard({ observatoire: [ally('a')] }, 4)
    const two = withBowserBoard({ observatoire: [ally('a'), ally('b')] }, 4)
    expect(evaluate(two, 0)).toBeGreaterThan(evaluate(one, 0))
  })

  it('Observatoire épuisé (0 Étoile) : plus de bonus de positionnement', () => {
    const atObs = withBowserBoard({ observatoire: [ally('a')] }, 0)
    const elsewhere = withBowserBoard({ 'chateau-bowser': [ally('a')] }, 0)
    expect(evaluate(atObs, 0)).toBe(evaluate(elsewhere, 0))
  })
})
