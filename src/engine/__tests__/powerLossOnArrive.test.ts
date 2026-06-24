import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { yzma } from '../../data/villains/yzma'
import { yzmaCards } from '../../data/villains/yzma.cards'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const fateInst = (cards: typeof yzmaCards, cardId: string): CardInstance => {
  const c = buildDeckInstances(cards, 'fate', `${cardId}:`).find((x) => x.cardId === cardId)
  if (!c) throw new Error(`${cardId} introuvable`)
  return c
}

describe('powerLossOnPawnArrive — Chicha (Yzma) & Zirgouflex (Ursula)', () => {
  it('Yzma perd 2 Pouvoir en arrivant sur le lieu de Chicha', () => {
    const g = createInitialGame(
      [{ villain: yzma, deckCards: buildDeckInstances(yzmaCards, 'villain', 'y:'), fateCards: buildDeckInstances(yzmaCards, 'fate', 'yf:') }],
      1,
    )
    const chicha = fateInst(yzmaCards, 'chicha')
    const s: GameState = {
      ...g,
      phase: 'MOVE',
      players: [{ ...g.players[0], power: 10, pawnLocation: 'palais', board: { ...g.players[0].board, 'maison-pacha': [chicha] } }],
    }
    const after = applyAction(s, { type: 'MOVE', to: 'maison-pacha' })
    expect(after.players[0].power).toBe(8) // 10 − 2
  })

  it('la perte est plafonnée au Pouvoir disponible (plancher 0)', () => {
    const g = createInitialGame(
      [{ villain: yzma, deckCards: buildDeckInstances(yzmaCards, 'villain', 'y:'), fateCards: buildDeckInstances(yzmaCards, 'fate', 'yf:') }],
      1,
    )
    const chicha = fateInst(yzmaCards, 'chicha')
    const s: GameState = {
      ...g,
      phase: 'MOVE',
      players: [{ ...g.players[0], power: 1, pawnLocation: 'palais', board: { ...g.players[0].board, 'maison-pacha': [chicha] } }],
    }
    const after = applyAction(s, { type: 'MOVE', to: 'maison-pacha' })
    expect(after.players[0].power).toBe(0)
  })

  it('Ursula perd 1 Pouvoir en arrivant sur le lieu d’un Héros portant Zirgouflex', () => {
    const g = createInitialGame(
      [{ villain: ursula, deckCards: buildDeckInstances(ursulaCards, 'villain', 'u:'), fateCards: buildDeckInstances(ursulaCards, 'fate', 'uf:') }],
      1,
    )
    const triton: CardInstance = { instanceId: 'tr', cardId: 'roi-triton', name: 'Le Roi Triton', type: 'hero', strength: 6 }
    const zirg = { ...fateInst(ursulaCards, 'zirgouflex'), instanceId: 'zg', attachedTo: 'tr' }
    const s: GameState = {
      ...g,
      phase: 'MOVE',
      players: [{ ...g.players[0], power: 5, pawnLocation: 'repaire', board: { ...g.players[0].board, navire: [triton, zirg] } }],
    }
    const after = applyAction(s, { type: 'MOVE', to: 'navire' })
    expect(after.players[0].power).toBe(4) // 5 − 1
  })
})
