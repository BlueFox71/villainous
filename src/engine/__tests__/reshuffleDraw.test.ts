import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { singleGame, me, withActive } from './_helpers'
import type { CardInstance } from '../types'

function card(id: string): CardInstance {
  return { instanceId: id, cardId: 'page', name: id, type: 'item' }
}

describe('Perdu dans les bois — RESHUFFLE_DISCARD_AND_DRAW', () => {
  it('fusionne défausse + pioche, vide la défausse et pioche 2 cartes', () => {
    const base = withActive(singleGame(), {
      deck: [card('A'), card('B')],
      discard: [card('C'), card('D'), card('E')],
      hand: [],
    })
    const next = resolveEffect(base, { type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 2 })
    const p = me(next)
    expect(p.hand).toHaveLength(2)
    expect(p.discard).toHaveLength(0)
    // 5 cartes au total (2 pioche + 3 défausse) − 2 piochées = 3 en pioche.
    expect(p.deck).toHaveLength(3)
    // Aucune carte perdue : main + pioche couvrent les 5 instances.
    const all = new Set([...p.hand, ...p.deck].map((c) => c.instanceId))
    expect(all).toEqual(new Set(['A', 'B', 'C', 'D', 'E']))
  })

  it('pioche et défausse vides : no-op', () => {
    const base = withActive(singleGame(), { deck: [], discard: [], hand: [] })
    const next = resolveEffect(base, { type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 2 })
    expect(me(next).hand).toHaveLength(0)
  })

  it('moins de cartes que demandé : pioche ce qui est disponible', () => {
    const base = withActive(singleGame(), { deck: [card('A')], discard: [], hand: [] })
    const next = resolveEffect(base, { type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 2 })
    expect(me(next).hand).toHaveLength(1)
    expect(me(next).deck).toHaveLength(0)
  })
})
