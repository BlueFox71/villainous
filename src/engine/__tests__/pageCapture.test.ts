import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { hasReachedObjective } from '../rules'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function page(id: string): CardInstance {
  return { instanceId: id, cardId: 'page', name: 'Page', type: 'item', attach: 'location' }
}
function hero(id: string): CardInstance {
  return { instanceId: id, cardId: 'enqueteur', name: 'Enquêteur', type: 'hero', strength: 2 }
}

function game(boardForet: CardInstance[]): GameState {
  const base = createInitialGame(
    [
      {
        villain: slenderman,
        deckCards: buildDeckInstances(slendermanCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(slendermanCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({ ...p, board: { ...p.board, foret: boardForet } })),
  }
}

describe('Enquêteur / Enfant Perdu — capture et restitution de Pages', () => {
  it('CAPTURE : associe les Pages du lieu au Héros → elles ne comptent plus dans l’objectif', () => {
    const s = game([page('pg1'), page('pg2'), hero('h1')])
    const next = resolveEffect(s, { type: 'CAPTURE_CARDS_AT_HOST', cardId: 'page' }, {
      actorIndex: 0,
      hostInstanceId: 'h1',
      hostLocationId: 'foret',
    })
    const cell = next.players[0].board['foret']
    expect(cell.filter((c) => c.cardId === 'page' && c.attachedTo === 'h1')).toHaveLength(2)
  })

  it('objectif : une partie avec 8 Pages dont 2 capturées n’est pas atteint', () => {
    // 6 Pages libres + 2 capturées = 8 sur le plateau, mais objectif (8 LIBRES) non atteint.
    const free = [0, 1, 2, 3, 4, 5].map((i) => page(`f${i}`))
    const captured = [page('c0'), page('c1')].map((p) => ({ ...p, attachedTo: 'h1' }))
    const s = game([...free, ...captured, hero('h1')])
    expect(hasReachedObjective(s)).toBe(false)
  })

  it('max=1 (Enfant Perdu) : ne capture qu’une seule Page', () => {
    const s = game([page('pg1'), page('pg2'), hero('h1')])
    const next = resolveEffect(s, { type: 'CAPTURE_CARDS_AT_HOST', cardId: 'page', max: 1 }, {
      actorIndex: 0,
      hostInstanceId: 'h1',
      hostLocationId: 'foret',
    })
    expect(next.players[0].board['foret'].filter((c) => c.attachedTo === 'h1')).toHaveLength(1)
  })

  it('RELEASE : rend les Pages capturées à la main', () => {
    const captured = [page('c0'), page('c1')].map((p) => ({ ...p, attachedTo: 'h1' }))
    const s = game([...captured, hero('h1')])
    const next = resolveEffect(s, { type: 'RELEASE_CAPTURED_TO_HAND', cardId: 'page' }, {
      actorIndex: 0,
      hostInstanceId: 'h1',
      hostLocationId: 'foret',
    })
    expect(next.players[0].hand.filter((c) => c.cardId === 'page')).toHaveLength(2)
    expect(next.players[0].board['foret'].filter((c) => c.cardId === 'page')).toHaveLength(0)
    // Les Pages rendues n’ont plus d’attache.
    expect(next.players[0].hand.every((c) => !c.attachedTo)).toBe(true)
  })
})
