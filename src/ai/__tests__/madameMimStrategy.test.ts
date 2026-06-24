import { describe, it, expect } from 'vitest'
import { objectiveScore } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { madameMim } from '../../data/villains/madameMim'
import { madameMimCards } from '../../data/villains/madameMim.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `m${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})
const merlin = card('merlin-souris', 'hero', { isMerlinTransformation: true })
const killer = () => card('mim-tigre', 'ally', { isMimTransformation: true, transformationTarget: 'merlin-souris' })

function mimPlayer(board: Record<string, CardInstance[]>, hand: CardInstance[] = []): PlayerState {
  const g = createInitialGame(
    [{ villain: madameMim, deckCards: buildDeckInstances(madameMimCards, 'villain', 'x:'), fateCards: buildDeckInstances(madameMimCards, 'fate', 'xf:') }],
    1,
  )
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...board }, hand, merlinDiscard: [] }
}

describe('Madame Mim — jauge d’objectif sensible au positionnement', () => {
  it('Mim tueuse co-localisée (défaite imminente) > en main/ailleurs > absente', () => {
    const here = objectiveScore(mimPlayer({ 'lieu-duel': [merlin, killer()] }))
    const inHand = objectiveScore(mimPlayer({ 'lieu-duel': [merlin] }, [killer()]))
    const elsewhere = objectiveScore(mimPlayer({ 'lieu-duel': [merlin], marais: [killer()] }))
    const none = objectiveScore(mimPlayer({ 'lieu-duel': [merlin] }))
    expect(here).toBeGreaterThan(inHand)
    expect(here).toBeGreaterThan(elsewhere)
    expect(inHand).toBeGreaterThan(none)
    expect(elsewhere).toBeGreaterThan(none)
  })

  it('« machine gun » : des Mim supplémentaires postées au lieu du Merlin augmentent le score', () => {
    const one = objectiveScore(mimPlayer({ 'lieu-duel': [merlin, killer()] }))
    const three = objectiveScore(mimPlayer({ 'lieu-duel': [merlin, killer(), killer(), killer()] }))
    expect(three).toBeGreaterThan(one)
  })

  it('progression : chaque Merlin vaincu (merlinDiscard) augmente le score', () => {
    const p0 = mimPlayer({ 'lieu-duel': [merlin] })
    const p2 = { ...p0, merlinDiscard: [card('merlin-lapin', 'hero'), card('merlin-tortue', 'hero')] }
    expect(objectiveScore(p2)).toBeGreaterThan(objectiveScore(p0))
  })
})
