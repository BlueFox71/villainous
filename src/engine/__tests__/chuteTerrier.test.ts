import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    5,
  )
}

const chute: CardInstance = { instanceId: 'ch1', cardId: 'chute-terrier', name: 'Chute dans le terrier', type: 'effect' }
const other: CardInstance = { instanceId: 'o1', cardId: 'coup-royal', name: 'X', type: 'effect' }

describe('Reine de Cœur — Chute dans le terrier', () => {
  it('cherche Alice et ouvre son placement (joueur actif choisit le lieu)', () => {
    let s = game()
    s = { ...s, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [chute, other] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'ch1' })
    expect(s.pendingHeroPlacement?.hero.cardId).toBe('alice')
    expect(s.pendingHeroPlacement?.chooserIndex).toBe(1)
    // Alice n'est plus dans la pioche Fatalité de la Reine.
    expect(s.players[0].fateDeck.some((c) => c.cardId === 'alice')).toBe(false)
    // On la pose sur la Cour du Palais.
    s = applyAction(s, { type: 'RESOLVE_HERO_PLACEMENT', locationId: 'cour-palais' })
    expect((s.players[0].board['cour-palais'] ?? []).some((c) => c.cardId === 'alice')).toBe(true)
  })

  it('si Alice est déjà là, propose de retirer un Allié sur son lieu', () => {
    const alice: CardInstance = { instanceId: 'al', cardId: 'alice', name: 'Alice', type: 'hero', strength: 5 }
    const ally: CardInstance = { instanceId: 'g1', cardId: 'gardes-coeur', name: 'Gardes', type: 'ally', strength: 3 }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [chute, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, labyrinthe: [alice, ally] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'ch1' })
    expect(s.pendingFateChoice?.kind).toBe('remove-ally')
    expect(s.pendingFateChoice?.candidateIds).toEqual(['g1'])
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'g1' })
    expect((s.players[0].board['labyrinthe'] ?? []).some((c) => c.instanceId === 'g1')).toBe(false)
  })
})
