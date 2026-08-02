import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { playableConditions } from '../rules'
import { princeJohnCardById } from '../../data/villains/princeJohn.cards'
import type { CardInstance, GameState } from '../types'
import { twoPlayerGame } from './_helpers'

/** Une Condition « lorsqu'un adversaire défausse au moins N cartes ». */
function discardCondition(id: string, value: number): CardInstance {
  return {
    instanceId: id,
    cardId: 'miserable-cloporte',
    name: 'Misérable cloporte',
    type: 'condition',
    cost: 0,
    trigger: { type: 'opponent-discarded-ge', value },
  }
}

/** Une carte quelconque de la main (Événement de Prince Jean). */
function card(n: number): CardInstance {
  const c = princeJohnCardById['magnifiques-taxes']
  return { instanceId: `x${n}`, cardId: c.id, name: c.name, type: c.type, cost: c.cost, effects: c.effects }
}

/**
 * Le joueur 0 est actif sur son lieu (phase ACTION) avec `hand` en main ; le joueur 1
 * tient une Condition « défausse ≥ value » et peut réagir.
 */
function setup(hand: CardInstance[], value: number, locId = 'jail'): GameState {
  const s = applyAction(twoPlayerGame(7), { type: 'MOVE', to: locId })
  return {
    ...s,
    players: s.players.map((p, i) =>
      i === 0
        ? { ...p, hand, power: 0 }
        : { ...p, hand: [discardCondition('p1:cloporte', value)], reactableConditionIds: ['p1:cloporte'] },
    ),
  }
}

describe('Compteur de défausses du tour (Conditions « défausse ≥ N »)', () => {
  it('l’action de lieu « Défausser » compte les cartes défaussées', () => {
    let s = setup([card(1), card(2)], 2)
    s = applyAction(s, { type: 'DISCARD_CARDS', actionId: 'discard', instanceIds: ['x1', 'x2'] })
    expect(s.activeDiscardedCount).toBe(2)
    expect(playableConditions(s, 1).map((c) => c.instanceId)).toEqual(['p1:cloporte'])
  })

  it('une défausse HORS action de lieu compte aussi (bot qui allège sa main)', () => {
    // Régression : seule l'action « Défausser » alimentait le compteur, si bien qu'une
    // Condition « défausse ≥ 2 » ne réagissait pas aux autres défausses de main.
    let s = setup([card(1), card(2), card(3)], 2)
    s = applyAction(s, { type: 'DISCARD_HAND_CARDS', instanceIds: ['x1', 'x2'] })
    expect(s.activeDiscardedCount).toBe(2)
    expect(playableConditions(s, 1).map((c) => c.instanceId)).toEqual(['p1:cloporte'])
  })

  it('les défausses s’ADDITIONNENT sur le tour (1 puis 1 → seuil de 2 atteint)', () => {
    let s = setup([card(1), card(2)], 2)
    s = applyAction(s, { type: 'DISCARD_HAND_CARDS', instanceIds: ['x1'] })
    expect(playableConditions(s, 1)).toHaveLength(0)
    s = applyAction(s, { type: 'DISCARD_HAND_CARDS', instanceIds: ['x2'] })
    expect(s.activeDiscardedCount).toBe(2)
    expect(playableConditions(s, 1).map((c) => c.instanceId)).toEqual(['p1:cloporte'])
  })

  it('JOUER un Événement n’est pas une défausse (il part en défausse en se résolvant)', () => {
    let s = setup([card(1)], 1)
    // « Magnifiques Taxes » exige un Héros au royaume pour être jouable.
    const pj = princeJohnCardById['petit-jean']
    const hero: CardInstance = { instanceId: 'h1', cardId: pj.id, name: pj.name, type: 'hero', strength: pj.strength }
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, nottingham: [hero] } } : p)) }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'x1', to: 'jail' })
    expect(s.players[0].discard.map((c) => c.instanceId)).toContain('x1')
    expect(s.activeDiscardedCount ?? 0).toBe(0)
    expect(playableConditions(s, 1)).toHaveLength(0)
  })

  it('le compteur repart à zéro au tour suivant', () => {
    let s = setup([card(1), card(2)], 2)
    s = applyAction(s, { type: 'DISCARD_HAND_CARDS', instanceIds: ['x1', 'x2'] })
    expect(s.activeDiscardedCount).toBe(2)
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.activeDiscardedCount).toBe(0)
  })
})
