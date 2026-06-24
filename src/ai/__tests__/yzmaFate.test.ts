import { describe, it, expect } from 'vitest'
import { fateWouldHelpOpponent } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { yzma } from '../../data/villains/yzma'
import { yzmaCards } from '../../data/villains/yzma.cards'
import { crochet } from '../../data/villains/crochet'
import { crochetCards } from '../../data/villains/crochet.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState } from '../../engine/types'

function game(villain: typeof yzma, cards: typeof yzmaCards): GameState {
  return createInitialGame(
    [{ villain, deckCards: buildDeckInstances(cards, 'villain', 'v:'), fateCards: buildDeckInstances(cards, 'fate', 'vf:') }],
    1,
  )
}

describe('Évitement de Fatalité — Yzma vs Crochet', () => {
  it('Yzma : le bot NE s’abstient PAS (Fatalité interactive, il évite Kuzco par l’éval)', () => {
    expect(fateWouldHelpOpponent(game(yzma, yzmaCards), 0)).toBe(false)
  })

  it('Crochet : le bot s’abstient tant que Peter Pan (joué d’office) n’est pas en jeu', () => {
    expect(fateWouldHelpOpponent(game(crochet, crochetCards), 0)).toBe(true)
  })
})
