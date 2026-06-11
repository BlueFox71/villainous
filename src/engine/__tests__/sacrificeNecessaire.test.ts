import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { singleGame, me, withActive } from './_helpers'
import type { CardInstance } from '../types'

const ally = (id: string): CardInstance => ({ instanceId: id, cardId: id, name: id, type: 'ally', strength: 2 })
const item = (id: string): CardInstance => ({ instanceId: id, cardId: id, name: id, type: 'item' })

describe('Jafar — Sacrifice Nécessaire (DISCARD_OWN_FOR_POWER)', () => {
  it('défausse l’Allié choisi du royaume et gagne 3 Pouvoir', () => {
    let s = withActive(singleGame(), { power: 0 })
    const loc = me(s).locations[0].id
    s = { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, board: { ...p.board, [loc]: [ally('a1')] } } : p)) }
    s = resolveEffect(s, { type: 'DISCARD_OWN_FOR_POWER', amount: 3 }, { allyInstanceIds: ['a1'] })
    expect(me(s).power).toBe(3)
    expect((me(s).board[loc] ?? []).some((c) => c.instanceId === 'a1')).toBe(false)
    expect(me(s).discard.some((c) => c.instanceId === 'a1')).toBe(true)
  })

  it('un Objet associé à l’Allié sacrifié part aussi en défausse', () => {
    let s = withActive(singleGame(), { power: 0 })
    const loc = me(s).locations[0].id
    const attached: CardInstance = { ...item('obj1'), attachedTo: 'a1' }
    s = { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, board: { ...p.board, [loc]: [ally('a1'), attached] } } : p)) }
    s = resolveEffect(s, { type: 'DISCARD_OWN_FOR_POWER', amount: 3 }, { allyInstanceIds: ['a1'] })
    expect((me(s).board[loc] ?? [])).toHaveLength(0)
    expect(new Set(me(s).discard.map((c) => c.instanceId))).toEqual(new Set(['a1', 'obj1']))
  })
})
