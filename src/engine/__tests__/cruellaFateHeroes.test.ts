import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { createInitialGame } from '../state'
import { cruella } from '../../data/villains/cruella'
import { cruellaCards } from '../../data/villains/cruella.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

function cruellaGame(board: Record<string, CardInstance[]>): GameState {
  const g = createInitialGame(
    [{ villain: cruella, deckCards: buildDeckInstances(cruellaCards, 'villain', 'c:'), fateCards: buildDeckInstances(cruellaCards, 'fate', 'cf:') }],
    1,
  )
  return { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, ...board } }] }
}

describe('Cruella — Capitaine déplace un Allié vers un lieu voisin', () => {
  it('éloigne Jasper du lieu de Capitaine vers un voisin', () => {
    const jasper: CardInstance = { instanceId: 'j', cardId: 'jasper', name: 'Jasper', type: 'ally', strength: 4 }
    const s = cruellaGame({ laiterie: [jasper] })
    const after = resolveEffect(s, { type: 'MOVE_ALLY_FROM_HOST_ADJACENT' }, { actorIndex: 0, hostLocationId: 'laiterie' })
    const onLaiterie = (after.players[0].board['laiterie'] ?? []).some((c) => c.cardId === 'jasper')
    const onAdjacent =
      (after.players[0].board['campagne'] ?? []).some((c) => c.cardId === 'jasper') ||
      (after.players[0].board['castel'] ?? []).some((c) => c.cardId === 'jasper')
    expect(onLaiterie).toBe(false)
    expect(onAdjacent).toBe(true)
  })

  it('no-op si aucun Allié sur le lieu de Capitaine', () => {
    const s = cruellaGame({})
    const after = resolveEffect(s, { type: 'MOVE_ALLY_FROM_HOST_ADJACENT' }, { actorIndex: 0, hostLocationId: 'laiterie' })
    expect(after.players[0]).toBeTruthy() // pas de crash
  })

  it('Capitaine/Colonel ont bien leur onPlace', () => {
    const byId = Object.fromEntries(cruellaCards.map((c) => [c.id, c]))
    expect(byId['capitaine'].onPlace?.[0]).toEqual({ type: 'MOVE_ALLY_FROM_HOST_ADJACENT' })
    expect(byId['colonel'].onPlace?.[0]).toEqual({ type: 'RELOCATE_REALM_HERO_ANYWHERE' })
  })
})
