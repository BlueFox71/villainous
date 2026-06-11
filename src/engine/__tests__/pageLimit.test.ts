import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function page(id: string): CardInstance {
  return { instanceId: id, cardId: 'page', name: 'Page', type: 'item', cost: 1, attach: 'location', maxAtLocation: 2 }
}

/** Slenderman, pion sur La Forêt, phase ACTION, pouvoir confortable, une Page en main. */
function game(foret: CardInstance[]): GameState {
  const base = createInitialGame(
    [
      {
        villain: slenderman,
        deckCards: buildDeckInstances(slendermanCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(slendermanCards, 'fate', 'p0f:'),
      },
    ],
    3,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      pawnLocation: 'foret',
      power: 10,
      hand: [page('h1')],
      board: { ...p.board, foret },
    })),
  }
}

describe('Page — maximum 2 par lieu', () => {
  it('refuse la pose d’une 3ᵉ Page sur un lieu qui en a déjà 2', () => {
    const s = game([page('p1'), page('p2')])
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'h1', to: 'foret' }),
    ).toThrow()
  })

  it('autorise la pose quand le lieu a moins de 2 Pages', () => {
    const s = game([page('p1')])
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'h1', to: 'foret' })
    expect((next.players[0].board['foret'] ?? []).filter((c) => c.cardId === 'page')).toHaveLength(2)
  })

  it('les Pages capturées (attachées) ne comptent pas dans la limite', () => {
    const s = game([page('p1'), { ...page('cap'), attachedTo: 'someHero' }])
    // 1 Page libre + 1 capturée → on peut encore poser (libres < 2).
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'h1', to: 'foret' })
    expect((next.players[0].board['foret'] ?? []).filter((c) => c.cardId === 'page' && !c.attachedTo)).toHaveLength(2)
  })
})
