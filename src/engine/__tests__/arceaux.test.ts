import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const guard = (): CardInstance => ({
  instanceId: 'g1',
  cardId: 'gardes-carreau',
  name: 'Cartes Gardes : Carreau',
  type: 'ally',
  strength: 2,
  activatedCost: 1,
})
const hero = (): CardInstance => ({ instanceId: 'h1', cardId: 'alice', name: 'Alice', type: 'hero', strength: 2 })

function game(): GameState {
  return createInitialGame(
    [{ villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') }],
    13,
  )
}

describe('Reine de Cœur — Cartes Gardes ↔ arceaux', () => {
  it('Activer transforme une Carte Garde en arceau (−1 Pouvoir)', () => {
    const base = game()
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p) => ({ ...p, power: 2, pawnLocation: 'labyrinthe', board: { ...p.board, 'cour-palais': [guard()] } })),
    }
    const next = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'g1' })
    const g = (next.players[0].board['cour-palais'] ?? []).find((c) => c.instanceId === 'g1')
    expect(g?.isWicket).toBe(true)
    expect(next.players[0].power).toBe(1)
    // Re-activer le retransforme en Gardes.
    const back = applyAction(
      { ...next, usedActionIds: [] },
      { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'g1' },
    )
    expect((back.players[0].board['cour-palais'] ?? []).find((c) => c.instanceId === 'g1')?.isWicket).toBe(false)
  })

  it('un arceau ne peut pas être utilisé pour éliminer un Héros', () => {
    const base = game()
    const wicketGuard: CardInstance = { ...guard(), isWicket: true }
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p) => ({ ...p, power: 5, pawnLocation: 'foret-tulgey', board: { ...p.board, 'foret-tulgey': [hero(), wicketGuard] } })),
    }
    expect(() =>
      applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['g1'] }),
    ).toThrow()
  })
})
