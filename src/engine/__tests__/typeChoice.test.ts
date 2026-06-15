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

  it('choix Objet (plusieurs Objets dévoilés) : ouvre un choix de la carte à garder', () => {
    const s = applyAction(setup(), { type: 'RESOLVE_TYPE_CHOICE', cardType: 'item' })
    // 2 Objets dévoilés (I1, I2) → choix interactif (pendingLookTop, take 1).
    expect(s.pendingTypeChoice).toBeNull()
    expect(s.pendingLookTop?.cards.map((x) => x.instanceId)).toEqual(['I1', 'I2'])
    expect(s.pendingLookTop?.take).toBe(1)
    // Les non-Objets dévoilés (E1, A1) sont défaussés ; X reste en pioche.
    expect(new Set(me(s).discard.map((x) => x.instanceId))).toEqual(new Set(['E1', 'A1']))
    expect(me(s).deck.map((x) => x.instanceId)).toEqual(['X'])
    // Le joueur choisit I2 : ajouté à la main, I1 défaussé.
    const after = applyAction(s, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['I2'] })
    expect(me(after).hand.map((x) => x.instanceId)).toEqual(['I2'])
    expect(me(after).discard.map((x) => x.instanceId)).toContain('I1')
    expect(after.pendingLookTop).toBeNull()
  })

  it('choix Événement (un seul dévoilé) : garde directement l’Événement, défausse les autres', () => {
    const s = applyAction(setup(), { type: 'RESOLVE_TYPE_CHOICE', cardType: 'effect' })
    // Un seul Événement dans les 4 dévoilées (E1 ; X est la 5ᵉ) → ajout direct.
    expect(me(s).hand.map((x) => x.instanceId)).toEqual(['E1'])
    expect(new Set(me(s).discard.map((x) => x.instanceId))).toEqual(new Set(['I1', 'A1', 'I2']))
    expect(s.pendingLookTop ?? null).toBeNull()
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
