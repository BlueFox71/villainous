import { describe, it, expect } from 'vitest'
import { objectiveScore } from '../heuristicBot'
import { villainStrategyBonus } from '../villainStrategy'
import { createInitialGame } from '../../engine/state'
import { davyJones } from '../../data/villains/davyJones'
import { davyJonesCards } from '../../data/villains/davyJones.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `d${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function player(board: Record<string, CardInstance[]> = {}, over: Partial<PlayerState> = {}): PlayerState {
  const g = createInitialGame(
    [{ villain: davyJones, deckCards: buildDeckInstances(davyJonesCards, 'villain', 'x:'), fateCards: buildDeckInstances(davyJonesCards, 'fate', 'xf:') }],
    1,
  )
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...board }, ...over }
}

describe('Davy Jones — couche stratégie (pour lui)', () => {
  it('valorise Le Kraken, Bill le Bottier, Clanker et l’Équipage en jeu', () => {
    expect(villainStrategyBonus(player({ 'sous-le-pont': [card('le-kraken', 'ally', { strength: 8 })] }))).toBe(3)
    expect(villainStrategyBonus(player({ 'sous-le-pont': [card('bill-le-bottier', 'ally', { strength: 1 })] }))).toBe(2)
    expect(villainStrategyBonus(player({ 'sous-le-pont': [card('clanker', 'ally', { strength: 2 })] }))).toBe(1)
    expect(villainStrategyBonus(player({ 'sous-le-pont': [card('equipage-hollandais', 'ally', { strength: 1 })] }))).toBe(1)
  })
})

describe('Davy Jones — jauge d’objectif (Trésors)', () => {
  it('récupéré > révélé (face visible) > face cachée', () => {
    const heroFaceDown = card('h', 'hero', { strength: 3, treasure: { id: 'la-cle', faceUp: false } })
    const heroFaceUp = card('h', 'hero', { strength: 3, treasure: { id: 'la-cle', faceUp: true } })
    const faceDown = objectiveScore(player({ 'sous-le-pont': [heroFaceDown] }))
    const faceUp = objectiveScore(player({ 'sous-le-pont': [heroFaceUp] }))
    const claimed = objectiveScore(player({}, { claimedTreasures: ['la-cle'] }))
    expect(faceUp).toBeGreaterThan(faceDown)
    expect(claimed).toBeGreaterThan(faceUp)
  })
})
