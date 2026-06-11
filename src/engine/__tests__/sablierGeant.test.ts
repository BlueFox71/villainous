import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { effectiveStrength } from '../rules'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const sablier = (): CardInstance => ({
  instanceId: 'sab1',
  cardId: 'sablier-geant',
  name: 'Sablier Géant',
  type: 'item',
  activatedCost: 0,
})
const hero = (): CardInstance => ({ instanceId: 'h1', cardId: 'aladdin', name: 'Aladdin', type: 'hero', strength: 4 })

/** Jafar, pion au Palais (action « Activer » libre), Sablier + Héros (force 4)
 *  aux Rues (« ce lieu » = celui du Sablier, pas celui du pion). */
function setup(): GameState {
  const base = createInitialGame(
    [{ villain: jafar, deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'), fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:') }],
    9,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({ ...p, pawnLocation: 'palais', board: { ...p.board, rues: [sablier(), hero()] } })),
  }
}

describe('Jafar — Sablier Géant (capacité activée)', () => {
  it('réduit de 2 la force des Héros du lieu après activation', () => {
    const s = setup()
    expect(effectiveStrength(s, 0, 'h1')).toBe(4)
    const next = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'sab1' })
    expect(effectiveStrength(next, 0, 'h1')).toBe(2)
    expect(next.usedActionIds).toContain('activate')
  })

  it('l’effet expire à la fin du tour', () => {
    const s = setup()
    const activated = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'sab1' })
    const ended = applyAction(activated, { type: 'END_TURN' })
    const sab = (ended.players[0].board['palais'] ?? []).find((c) => c.instanceId === 'sab1')
    expect(sab?.activatedThisTurn).toBeFalsy()
    expect(effectiveStrength(ended, 0, 'h1')).toBe(4)
  })
})
