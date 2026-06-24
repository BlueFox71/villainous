import { describe, it, expect } from 'vitest'
import { villainStrategyBonus, villainFateTargetingBonus } from '../villainStrategy'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { shereKhan } from '../../data/villains/shereKhan'
import { shereKhanCards } from '../../data/villains/shereKhan.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `k${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function game(): GameState {
  return createInitialGame(
    [{ villain: shereKhan, deckCards: buildDeckInstances(shereKhanCards, 'villain', 'x:'), fateCards: buildDeckInstances(shereKhanCards, 'fate', 'xf:') }],
    1,
  )
}
function player(board: Record<string, CardInstance[]> = {}): PlayerState {
  const g = game()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...board }, hand: [] }
}

describe('Shere Khan — couche stratégie (pour lui)', () => {
  it('valorise Kaa, le Roi Singe et les Macaques en jeu', () => {
    expect(villainStrategyBonus(player({ riviere: [card('kaa', 'ally', { strength: 2 })] }))).toBe(2)
    expect(villainStrategyBonus(player({ riviere: [card('le-roi-singe', 'ally', { strength: 5 })] }))).toBe(1)
    expect(villainStrategyBonus(player({ riviere: [card('macaques', 'ally', { strength: 2 })] }))).toBe(1)
  })
})

describe('Shere Khan — ciblage Fatalité (contre lui)', () => {
  it('encombre Les Ruines Anciennes (Gagner 3) avec un Héros', () => {
    expect(villainFateTargetingBonus(player({ 'ruines-anciennes': [card('bagheera', 'hero', { strength: 3 })] }))).toBe(4)
    expect(villainFateTargetingBonus(player({ riviere: [card('bagheera', 'hero', { strength: 3 })] }))).toBe(0)
  })

  it('le bot ne joue pas Mowgli (Héros-objectif) en Fatalité si une alternative existe', () => {
    const g = game()
    const mowgli = card('mowgli', 'hero', { strength: 2 })
    const baloo = card('baloo', 'hero', { strength: 4 })
    const s: GameState = { ...g, activePlayer: 0, phase: 'ACTION', pendingFate: { target: 0, revealed: [mowgli, baloo] } }
    const actions = enumerateActions(s)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === mowgli.instanceId)).toBe(false)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === baloo.instanceId)).toBe(true)
  })
})
