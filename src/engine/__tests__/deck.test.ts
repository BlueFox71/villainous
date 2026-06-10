import { describe, it, expect } from 'vitest'
import { drawToLimit, HAND_LIMIT } from '../state'
import { applyAction } from '../actions'
import { nextRandom, shuffle } from '../rng'
import type { GameState } from '../types'
import { me, singleGame, withActive } from './_helpers'

describe('PRNG / shuffle', () => {
  it('nextRandom est déterministe et borné dans [0, 1)', () => {
    expect(nextRandom(123)).toEqual(nextRandom(123))
    const { value } = nextRandom(123)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('shuffle : permutation déterministe, entrée non mutée', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const a = shuffle(arr, 7)
    const b = shuffle(arr, 7)
    expect(a.result).toEqual(b.result)
    expect([...a.result].sort((x, y) => x - y)).toEqual(arr)
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('graines différentes → ordres différents', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i)
    expect(shuffle(arr, 1).result).not.toEqual(shuffle(arr, 2).result)
  })
})

describe('distribution initiale', () => {
  it('main = 4, pioche = 26, défausse = 0', () => {
    const p = me(singleGame())
    expect(p.hand).toHaveLength(HAND_LIMIT)
    expect(p.deck).toHaveLength(30 - HAND_LIMIT)
    expect(p.discard).toHaveLength(0)
  })

  it('même graine → même main (déterminisme)', () => {
    expect(me(singleGame(99)).hand).toEqual(me(singleGame(99)).hand)
  })

  it('les 30 exemplaires ont un instanceId unique', () => {
    const p = me(singleGame())
    const all = [...p.deck, ...p.hand, ...p.discard]
    expect(all).toHaveLength(30)
    expect(new Set(all.map((c) => c.instanceId)).size).toBe(30)
  })
})

describe('drawToLimit', () => {
  it('complète la main du joueur actif jusqu’à 4', () => {
    const s0 = singleGame()
    const s1 = withActive(s0, { hand: me(s0).hand.slice(0, 1) })
    expect(me(drawToLimit(s1)).hand).toHaveLength(4)
  })

  it('ne pioche pas si la main est déjà pleine (référence inchangée)', () => {
    const s = singleGame()
    expect(drawToLimit(s)).toBe(s)
  })

  it('remélange la défausse quand la pioche est vide', () => {
    const s0 = singleGame()
    const p = me(s0)
    const s1: GameState = withActive(s0, { deck: [], discard: [...p.deck, ...p.hand], hand: [] })
    const after = me(drawToLimit(s1))
    expect(after.hand).toHaveLength(4)
    expect(after.deck.length + after.hand.length + after.discard.length).toBe(30)
  })
})

describe("fin de tour : pioche jusqu'à 4", () => {
  it('END_TURN complète la main à 4 après avoir « joué » des cartes', () => {
    let s = applyAction(singleGame(), { type: 'MOVE', to: 'jail' })
    const p = me(s)
    s = withActive(s, { discard: p.hand.slice(2), hand: p.hand.slice(0, 2) })
    s = applyAction(s, { type: 'END_TURN' })
    expect(me(s).hand).toHaveLength(4)
  })
})
