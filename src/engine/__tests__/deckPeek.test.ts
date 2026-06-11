import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { singleGame, me, withActive } from './_helpers'
import type { CardInstance } from '../types'

function card(id: string): CardInstance {
  return { instanceId: id, cardId: 'page', name: id, type: 'item' }
}

describe('Retourne-toi — PEEK_BOTTOM_THEN_CHOOSE / RESOLVE_DECK_PEEK', () => {
  it('révèle la dernière carte de la pioche (pendingDeckPeek)', () => {
    const base = withActive(singleGame(), { deck: [card('A'), card('B'), card('C')], hand: [] })
    const next = resolveEffect(base, { type: 'PEEK_BOTTOM_THEN_CHOOSE' })
    expect(next.pendingDeckPeek?.card.instanceId).toBe('C')
  })

  it('keep=true : la carte révélée passe en main, retirée de la pioche', () => {
    let s = withActive(singleGame(), { deck: [card('A'), card('B'), card('C')], hand: [] })
    s = resolveEffect(s, { type: 'PEEK_BOTTOM_THEN_CHOOSE' })
    s = applyAction(s, { type: 'RESOLVE_DECK_PEEK', keep: true })
    expect(me(s).hand.map((c) => c.instanceId)).toContain('C')
    expect(me(s).deck.map((c) => c.instanceId)).not.toContain('C')
    expect(me(s).deck).toHaveLength(2)
    expect(s.pendingDeckPeek).toBeNull()
  })

  it('keep=false : remélange et pioche une carte (main +1, pioche −1)', () => {
    let s = withActive(singleGame(), { deck: [card('A'), card('B'), card('C')], hand: [] })
    s = resolveEffect(s, { type: 'PEEK_BOTTOM_THEN_CHOOSE' })
    s = applyAction(s, { type: 'RESOLVE_DECK_PEEK', keep: false })
    expect(me(s).hand).toHaveLength(1)
    expect(me(s).deck).toHaveLength(2)
    expect(s.pendingDeckPeek).toBeNull()
  })

  it('pioche vide : aucun choix en attente', () => {
    const base = withActive(singleGame(), { deck: [], hand: [] })
    const next = resolveEffect(base, { type: 'PEEK_BOTTOM_THEN_CHOOSE' })
    expect(next.pendingDeckPeek ?? null).toBeNull()
  })
})
