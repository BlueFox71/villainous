import { describe, it, expect } from 'vitest'
import { objectiveScore } from '../heuristicBot'
import { villainStrategyBonus, villainFateTargetingBonus } from '../villainStrategy'
import { createInitialGame } from '../../engine/state'
import { syndrome } from '../../data/villains/syndrome'
import { syndromeCards } from '../../data/villains/syndrome.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `s${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function syndromePlayer(over: Partial<PlayerState> = {}, board: Record<string, CardInstance[]> = {}): PlayerState {
  const g = createInitialGame(
    [{ villain: syndrome, deckCards: buildDeckInstances(syndromeCards, 'villain', 'x:'), fateCards: buildDeckInstances(syndromeCards, 'fate', 'xf:') }],
    1,
  )
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...board }, hand: [], ...over }
}

describe('Syndrome — couche stratégie (pour lui)', () => {
  it('valorise les Modifications Majeures posées et la Télécommande en jeu', () => {
    expect(villainStrategyBonus(syndromePlayer({}, { metroville: [card('modification-majeure', 'item')] }))).toBe(2)
    expect(villainStrategyBonus(syndromePlayer({}, { metroville: [card('telecommande-de-syndrome', 'item')] }))).toBe(3)
  })
})

describe('Syndrome — ciblage Fatalité (contre lui) : encombrer la Base', () => {
  it('un Héros posé sur la Base de Syndrome vaut un bonus, ailleurs non', () => {
    expect(villainFateTargetingBonus(syndromePlayer({}, { 'base-syndrome': [card('frozone', 'hero', { strength: 3 })] }))).toBe(4)
    expect(villainFateTargetingBonus(syndromePlayer({}, { 'maison-des-parr': [card('frozone', 'hero', { strength: 3 })] }))).toBe(0)
  })
})

describe('Syndrome — jauge d’objectif', () => {
  const v10 = () => card('omnidroide-v-x10', 'ally', { strength: 7 })
  const remote = () => card('telecommande-de-syndrome', 'item')
  const hero = () => card('m-indestructible', 'hero', { strength: 6 })

  it('Télécommande co-localisée avec la v.10 > en main > absente', () => {
    const withV10 = objectiveScore(syndromePlayer({ omnidroidStage: 'x10' }, { metroville: [v10(), remote()] }))
    const inHand = objectiveScore(syndromePlayer({ omnidroidStage: 'x10', hand: [remote()] }, { metroville: [v10()] }))
    const none = objectiveScore(syndromePlayer({ omnidroidStage: 'x10' }, { metroville: [v10()] }))
    expect(withV10).toBeGreaterThan(inHand)
    expect(inHand).toBeGreaterThan(none)
  })

  it('« Save the Day » : des Héros dans le royaume font baisser le score (x10 et détruit)', () => {
    const clean = objectiveScore(syndromePlayer({ omnidroidStage: 'x10' }, { metroville: [v10(), remote()] }))
    const bogged = objectiveScore(syndromePlayer({ omnidroidStage: 'x10' }, { metroville: [v10(), remote()], 'base-syndrome': [hero(), hero()] }))
    expect(bogged).toBeLessThan(clean)

    const destroyedClean = objectiveScore(syndromePlayer({ omnidroidStage: 'destroyed' }))
    const destroyedBogged = objectiveScore(syndromePlayer({ omnidroidStage: 'destroyed' }, { 'base-syndrome': [hero(), hero()] }))
    expect(destroyedClean).toBe(1)
    expect(destroyedBogged).toBeLessThan(1)
  })
})
