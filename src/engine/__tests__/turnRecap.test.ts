// Récap « tour adverse » : le moteur enregistre dans `turnEvents` ce que fait le
// joueur actif (icône + détail), puis fige le tout dans `lastTurnEvents` à END_TURN.
import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { princeJohnCardById } from '../../data/villains/princeJohn.cards'
import type { CardInstance, GameState } from '../types'
import { me, singleGame, withActive } from './_helpers'

function inst(cardId: string, n = 1): CardInstance {
  const c = princeJohnCardById[cardId]
  return {
    instanceId: `${cardId}#${n}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    attach: c.attach,
    effects: c.effects,
  }
}

/** Premier lieu/action « Gagner du Pouvoir » accessible (≠ position de départ). */
function findGainPower(s: GameState) {
  const start = me(s).pawnLocation
  for (const loc of me(s).locations) {
    if (loc.id === start) continue
    const a = loc.actions.find((x) => x.type === 'GAIN_POWER')
    if (a) return { locId: loc.id, actionId: a.id, amount: a.amount ?? 0 }
  }
  throw new Error('aucune action Gagner du Pouvoir accessible')
}

describe('récap du tour adverse', () => {
  it('le déplacement du pion n’est PAS enregistré', () => {
    const { locId } = findGainPower(singleGame())
    const s = applyAction(singleGame(), { type: 'MOVE', to: locId })
    expect(s.turnEvents).toEqual([])
  })

  it('un gain de Pouvoir crée une icône gain-power avec le montant', () => {
    let s = singleGame()
    const { locId, actionId, amount } = findGainPower(s)
    s = applyAction(s, { type: 'MOVE', to: locId })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId })
    expect(s.turnEvents).toHaveLength(1)
    expect(s.turnEvents?.[0].kind).toBe('gain-power')
    expect(s.turnEvents?.[0].amount).toBe(amount)
  })

  it('une carte jouée crée une icône play-card (nom + cardId)', () => {
    const ally = inst('gardes-rhinoceros') // coût 3
    let s = applyAction(singleGame(), { type: 'MOVE', to: 'jail' })
    s = withActive(s, { hand: [ally], power: 5 })
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: ally.instanceId, to: 'jail' })
    const ev = s.turnEvents?.find((e) => e.kind === 'play-card')
    expect(ev).toBeDefined()
    expect(ev?.cardId).toBe('gardes-rhinoceros')
    expect(ev?.label).toBe(ally.name)
  })

  it('END_TURN fige turnEvents dans lastTurnEvents et repart à vide', () => {
    let s = singleGame()
    const { locId, actionId } = findGainPower(s)
    s = applyAction(s, { type: 'MOVE', to: locId })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId })
    const endedTurn = s.turn
    const endedPlayer = s.activePlayer
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.lastTurnEvents?.playerIndex).toBe(endedPlayer)
    expect(s.lastTurnEvents?.turn).toBe(endedTurn)
    expect(s.lastTurnEvents?.records).toHaveLength(1)
    expect(s.lastTurnEvents?.records[0].kind).toBe('gain-power')
    expect(s.turnEvents).toEqual([])
  })
})
