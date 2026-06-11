import { describe, it, expect } from 'vitest'
import { handLimitFor, HAND_LIMIT } from '../state'
import type { CardInstance, PlayerState } from '../types'

function player(board: Record<string, CardInstance[]>): PlayerState {
  return { board, locations: [] } as unknown as PlayerState
}

const scarab = (): CardInstance => ({ instanceId: 's1', cardId: 'scarabee-or', name: "Scarabée d'Or", type: 'item' })
const jasmine = (): CardInstance => ({ instanceId: 'j1', cardId: 'jasmine', name: 'Jasmine', type: 'hero', strength: 3 })

describe('handLimitFor — limite de main en fin de tour', () => {
  it('limite par défaut = HAND_LIMIT (4)', () => {
    expect(handLimitFor(player({ a: [] }))).toBe(HAND_LIMIT)
  })

  it('+1 avec le Scarabée d’Or → 5', () => {
    expect(handLimitFor(player({ a: [scarab()] }))).toBe(HAND_LIMIT + 1)
  })

  it('−1 avec Jasmine → 3', () => {
    expect(handLimitFor(player({ a: [jasmine()] }))).toBe(HAND_LIMIT - 1)
  })

  it('Scarabée + Jasmine s’annulent → 4', () => {
    expect(handLimitFor(player({ a: [scarab()], b: [jasmine()] }))).toBe(HAND_LIMIT)
  })
})
