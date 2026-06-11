import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { getAvailableActions } from '../rules'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const iago = (): CardInstance => ({
  instanceId: 'iago1',
  cardId: 'iago',
  name: 'Iago',
  type: 'ally',
  strength: 1,
  activatedCost: 1,
})
const lampe = (): CardInstance => ({
  instanceId: 'lampe1',
  cardId: 'lampe-merveilleuse',
  name: 'Lampe Merveilleuse',
  type: 'item',
})

/** Partie Jafar, pion au Palais (action « Activer »), Iago + Lampe aux Rues. */
function setup(power = 2): GameState {
  const base = createInitialGame(
    [
      {
        villain: jafar,
        deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:'),
      },
    ],
    42,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      power,
      pawnLocation: 'palais',
      board: { ...p.board, rues: [iago(), lampe()] },
    })),
  }
}

describe('Jafar — Action « Activer » : capacité d’Iago', () => {
  it('déplace Iago + un Objet vers un lieu voisin et coûte 1 Pouvoir', () => {
    const s = setup(2)
    const next = applyAction(s, {
      type: 'ACTIVATE',
      actionId: 'activate',
      cardInstanceId: 'iago1',
      to: 'oasis',
      itemInstanceId: 'lampe1',
    })
    const rues = next.players[0].board['rues'] ?? []
    const oasis = next.players[0].board['oasis'] ?? []
    expect(rues.some((c) => c.instanceId === 'iago1')).toBe(false)
    expect(rues.some((c) => c.instanceId === 'lampe1')).toBe(false)
    expect(oasis.some((c) => c.instanceId === 'iago1')).toBe(true)
    expect(oasis.some((c) => c.instanceId === 'lampe1')).toBe(true)
    expect(next.players[0].power).toBe(1)
    expect(next.usedActionIds).toContain('activate')
  })

  it('refuse un lieu non voisin', () => {
    const s = setup(2)
    expect(() =>
      applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'iago1', to: 'caverne' }),
    ).toThrow()
  })

  it('« Activer » est indisponible sans Pouvoir suffisant', () => {
    const s = setup(0)
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).not.toContain('activate')
  })

  it('« Activer » est disponible avec Iago en jeu et assez de Pouvoir', () => {
    const s = setup(2)
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).toContain('activate')
  })

  it('l’exemplaire d’Iago construit depuis le deck porte bien activatedCost', () => {
    const instances = buildDeckInstances(jafarCards, 'villain', 'p0:')
    const iagoInst = instances.find((c) => c.cardId === 'iago')
    expect(iagoInst?.activatedCost).toBe(1)
  })
})
