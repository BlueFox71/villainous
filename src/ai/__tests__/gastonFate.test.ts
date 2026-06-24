import { describe, it, expect } from 'vitest'
import { enumerateActions } from '../enumerate'
import { villainStrategyBonus } from '../villainStrategy'
import { createInitialGame } from '../../engine/state'
import { gaston } from '../../data/villains/gaston'
import { gastonCards } from '../../data/villains/gaston.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

const hero = (cardId: string, strength: number, extra: Partial<CardInstance> = {}): CardInstance =>
  ({ instanceId: cardId + ':1', cardId, name: cardId, type: 'hero', strength, ...extra })

function gastonGame(): GameState {
  return createInitialGame(
    [{ villain: gaston, deckCards: buildDeckInstances(gastonCards, 'villain', 'g:'), fateCards: buildDeckInstances(gastonCards, 'fate', 'gf:') }],
    1,
  )
}
function gastonWith(cards: CardInstance[]): PlayerState {
  const g = gastonGame()
  const here = g.players[0].locations[0].id
  return { ...g.players[0], board: { ...g.players[0].board, [here]: cards } }
}

describe('Gaston — le bot ne joue pas Maurice (cadeau : le vaincre retire des Obstacles)', () => {
  it('avec une alternative révélée, aucune option ne joue Maurice', () => {
    const g = gastonGame()
    const maurice = hero('maurice', 2)
    const belle = hero('belle', 2)
    const s: GameState = { ...g, activePlayer: 0, phase: 'ACTION', pendingFate: { target: 0, revealed: [maurice, belle] } }
    const actions = enumerateActions(s)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === maurice.instanceId)).toBe(false)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === belle.instanceId)).toBe(true)
  })
})

describe('Gaston — couche stratégie', () => {
  it('valorise Monsieur D’Arque, pénalise Belle (sauf piégée)', () => {
    expect(villainStrategyBonus(gastonWith([{ instanceId: 'd', cardId: 'monsieur-darque', name: "D'Arque", type: 'ally', strength: 1 }]))).toBe(4)
    expect(villainStrategyBonus(gastonWith([hero('belle', 2)]))).toBe(-8)
    // Belle piégée = neutralisée → plus de pénalité de priorité.
    expect(villainStrategyBonus(gastonWith([hero('belle', 2, { trapped: true })]))).toBe(0)
  })
})
