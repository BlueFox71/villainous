import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { singleGame, me, withActive } from './_helpers'
import type { CardInstance, CardType } from '../types'

function c(id: string, type: CardType): CardInstance {
  return { instanceId: id, cardId: id, name: id, type }
}

describe('Tombée de la nuit — CHOOSE_TYPE_REVEAL_DRAW / RESOLVE_TYPE_CHOICE', () => {
  function setup() {
    let s = withActive(singleGame(), {
      deck: [c('E1', 'effect'), c('I1', 'item'), c('A1', 'ally'), c('I2', 'item'), c('X', 'effect')],
      discard: [],
      hand: [],
    })
    s = resolveEffect(s, { type: 'CHOOSE_TYPE_REVEAL_DRAW', count: 4 })
    expect(s.pendingTypeChoice?.count).toBe(4)
    return s
  }

  it('choix Objet : garde le 1er Objet des 4 dévoilées, défausse les 3 autres', () => {
    const s = applyAction(setup(), { type: 'RESOLVE_TYPE_CHOICE', cardType: 'item' })
    const p = me(s)
    expect(p.hand.map((x) => x.instanceId)).toEqual(['I1'])
    // Les 3 autres dévoilées (E1, A1, I2) vont en défausse ; X reste en pioche.
    expect(new Set(p.discard.map((x) => x.instanceId))).toEqual(new Set(['E1', 'A1', 'I2']))
    expect(p.deck.map((x) => x.instanceId)).toEqual(['X'])
    expect(s.pendingTypeChoice).toBeNull()
  })

  it('choix Événement : garde le 1er Événement, défausse les autres', () => {
    const s = applyAction(setup(), { type: 'RESOLVE_TYPE_CHOICE', cardType: 'effect' })
    expect(me(s).hand.map((x) => x.instanceId)).toEqual(['E1'])
    expect(new Set(me(s).discard.map((x) => x.instanceId))).toEqual(new Set(['I1', 'A1', 'I2']))
  })

  it('aucun du type choisi : rien en main, les 4 défaussées', () => {
    let s = withActive(singleGame(), {
      deck: [c('A1', 'ally'), c('A2', 'ally'), c('A3', 'ally'), c('A4', 'ally')],
      discard: [],
      hand: [],
    })
    s = resolveEffect(s, { type: 'CHOOSE_TYPE_REVEAL_DRAW', count: 4 })
    s = applyAction(s, { type: 'RESOLVE_TYPE_CHOICE', cardType: 'item' })
    expect(me(s).hand).toHaveLength(0)
    expect(me(s).discard).toHaveLength(4)
  })
})
