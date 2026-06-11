import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { singleGame, me, withActive } from './_helpers'
import type { CardInstance, CardType } from '../types'

function c(id: string, type: CardType): CardInstance {
  return { instanceId: id, cardId: id, name: id, type }
}

describe('Jafar — Prédiction (REVEAL_UNTIL_TYPE / RESOLVE_TYPE_CHOICE)', () => {
  it('révèle jusqu’au 1er Objet : le garde, défausse les cartes dévoilées avant', () => {
    let s = withActive(singleGame(), {
      deck: [c('E1', 'effect'), c('A1', 'ally'), c('I1', 'item'), c('I2', 'item')],
      discard: [],
      hand: [],
    })
    s = resolveEffect(s, { type: 'REVEAL_UNTIL_TYPE', types: ['item', 'ally'] })
    expect(s.pendingTypeChoice?.untilFound).toBe(true)
    s = applyAction(s, { type: 'RESOLVE_TYPE_CHOICE', cardType: 'item' })
    const p = me(s)
    // E1 et A1 dévoilées et défaussées ; I1 gardé ; I2 reste en pioche.
    expect(p.hand.map((x) => x.instanceId)).toEqual(['I1'])
    expect(new Set(p.discard.map((x) => x.instanceId))).toEqual(new Set(['E1', 'A1']))
    expect(p.deck.map((x) => x.instanceId)).toEqual(['I2'])
    expect(s.pendingTypeChoice).toBeNull()
  })

  it('choix Allié : garde le 1er Allié rencontré', () => {
    let s = withActive(singleGame(), {
      deck: [c('I1', 'item'), c('A1', 'ally'), c('A2', 'ally')],
      discard: [],
      hand: [],
    })
    s = resolveEffect(s, { type: 'REVEAL_UNTIL_TYPE', types: ['item', 'ally'] })
    s = applyAction(s, { type: 'RESOLVE_TYPE_CHOICE', cardType: 'ally' })
    expect(me(s).hand.map((x) => x.instanceId)).toEqual(['A1'])
    expect(me(s).discard.map((x) => x.instanceId)).toEqual(['I1'])
  })
})
