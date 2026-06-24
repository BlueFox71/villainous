import { describe, it, expect } from 'vitest'
import { villainStrategyBonus } from '../villainStrategy'
import { playerMalus } from '../fateMalus'
import { createInitialGame } from '../../engine/state'
import { seigneurTenebres } from '../../data/villains/seigneurTenebres'
import { seigneurTenebresCards } from '../../data/villains/seigneurTenebres.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

const hero = (cardId: string, strength: number, extra: Partial<CardInstance> = {}): CardInstance =>
  ({ instanceId: cardId + ':1', cardId, name: cardId, type: 'hero', strength, ...extra })

function game(): GameState {
  return createInitialGame(
    [{ villain: seigneurTenebres, deckCards: buildDeckInstances(seigneurTenebresCards, 'villain', 't:'), fateCards: buildDeckInstances(seigneurTenebresCards, 'fate', 'tf:') }],
    1,
  )
}
function withBoard(board: Record<string, CardInstance[]>, extra: Partial<PlayerState> = {}): PlayerState {
  const g = game()
  return { ...g.players[0], board: { ...g.players[0].board, ...board }, ...extra }
}

describe('Le Seigneur des Ténèbres — couche stratégie (pour lui)', () => {
  it('valorise les Soldats Ancestraux (moteur de couverture)', () => {
    const here = game().players[0].locations[0].id
    expect(villainStrategyBonus(withBoard({ [here]: [{ instanceId: 's', cardId: 'ancient-soldiers', name: 'Soldats', type: 'item' }] }))).toBe(3)
  })

  it('priorise le Vanquish des Sorcières de Morva, Hen Wen, Petit Peuple et Fflewddur Fflam', () => {
    const here = game().players[0].locations[0].id
    expect(villainStrategyBonus(withBoard({ [here]: [hero('witches-of-morva', 3)] }))).toBe(-7)
    expect(villainStrategyBonus(withBoard({ [here]: [hero('hen-wen', 1)] }))).toBe(-6)
    expect(villainStrategyBonus(withBoard({ [here]: [hero('fair-folk', 2)] }))).toBe(-5)
    expect(villainStrategyBonus(withBoard({ [here]: [hero('fflewddur-fflam', 3)] }))).toBe(-5)
  })
})

describe('Le Seigneur des Ténèbres — malus Fatalité conditionnel (contre lui)', () => {
  it('Sorcières de Morva : bloc DUR tant que le Chaudron n’est pas réclamé, simple corps une fois réclamé', () => {
    const here = game().players[0].locations[0].id
    const sBefore: GameState = { ...game(), players: [withBoard({ [here]: [hero('witches-of-morva', 3)] }, { blackCauldron: 'set-aside' })] }
    expect(playerMalus(sBefore, 0)).toBe(1) // block-win saturé
    const sAfter: GameState = { ...game(), players: [withBoard({ [here]: [hero('witches-of-morva', 3)] }, { blackCauldron: 'claimed' })] }
    expect(playerMalus(sAfter, 0)).toBeLessThan(0.2) // slow seul
  })
})
