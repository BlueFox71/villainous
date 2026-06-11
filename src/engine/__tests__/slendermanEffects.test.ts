import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { teleportTargets, conditionIsTriggered } from '../rules'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function page(id: string): CardInstance {
  return { instanceId: id, cardId: 'page', name: 'Page', type: 'item', attach: 'location' }
}
function hero(id: string, strength = 2): CardInstance {
  return { instanceId: id, cardId: 'enqueteur', name: 'Enquêteur', type: 'hero', strength }
}
function game(patch: (g: GameState) => GameState): GameState {
  const base = createInitialGame(
    [{ villain: slenderman, deckCards: buildDeckInstances(slendermanCards, 'villain', 'p0:'), fateCards: buildDeckInstances(slendermanCards, 'fate', 'p0f:') }],
    5,
  )
  return patch({ ...base, phase: 'ACTION' })
}

describe('Slenderman — effets divers', () => {
  it('Dessin inquiétant : +1 JT par Page sur le lieu du pion', () => {
    const s = game((g) => ({
      ...g,
      players: g.players.map((p) => ({ ...p, pawnLocation: 'foret', power: 0, board: { ...p.board, foret: [page('a'), page('b')] } })),
    }))
    const next = resolveEffect(s, { type: 'GAIN_POWER_PER_CARD_AT_PAWN', cardId: 'page', amount: 1 })
    expect(next.players[0].power).toBe(2)
  })

  it('Téléportation : lieux cibles = ceux avec un Héros sans Lampe de poche', () => {
    const s = game((g) => ({
      ...g,
      players: g.players.map((p) => ({
        ...p,
        board: {
          ...p.board,
          foret: [hero('h1')],
          mine: [hero('h2'), { instanceId: 'lp', cardId: 'lampe-de-poche', name: 'Lampe', type: 'item', attachedTo: 'h2' } as CardInstance],
        },
      })),
    }))
    const t = teleportTargets(s.players[0])
    expect(t).toContain('foret')
    expect(t).not.toContain('mine') // seul Héros est « lampé »
  })

  it('RESOLVE_TELEPORT déplace le pion sur le lieu choisi', () => {
    let s = game((g) => ({
      ...g,
      pendingTeleport: { playerIndex: 0 },
      players: g.players.map((p) => ({ ...p, pawnLocation: 'tunnel', board: { ...p.board, foret: [hero('h1')] } })),
    }))
    s = applyAction(s, { type: 'RESOLVE_TELEPORT', to: 'foret' })
    expect(s.players[0].pawnLocation).toBe('foret')
    expect(s.pendingTeleport).toBeNull()
  })

  it('Sombres desseins : trigger si l’adversaire a déplacé une carte', () => {
    const card: CardInstance = { instanceId: 'sd', cardId: 'sombres-desseins', name: 'Sombres desseins', type: 'condition', trigger: { type: 'opponent-moved-card' } }
    const s = game((g) => ({ ...g, activeMovedCard: true }))
    expect(conditionIsTriggered(s, card, 0)).toBe(true)
    const s2 = game((g) => ({ ...g, activeMovedCard: false }))
    expect(conditionIsTriggered(s2, card, 0)).toBe(false)
  })

  it('Sans visage : trigger si l’adversaire a pioché', () => {
    const card: CardInstance = { instanceId: 'sv', cardId: 'sans-visage', name: 'Sans visage', type: 'condition', trigger: { type: 'opponent-drew-card' } }
    expect(conditionIsTriggered(game((g) => ({ ...g, activeDrewCard: true })), card, 0)).toBe(true)
    expect(conditionIsTriggered(game((g) => ({ ...g, activeDrewCard: false })), card, 0)).toBe(false)
  })
})
