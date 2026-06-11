import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { hasReachedObjective } from '../rules'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const hypnose = (): CardInstance => ({
  instanceId: 'hyp1',
  cardId: 'hypnose',
  name: 'Hypnose',
  type: 'effect',
  cost: 0,
  effects: [{ type: 'HYPNOTIZE_HERO' }],
})
const genie = (): CardInstance => ({
  instanceId: 'genie1',
  cardId: 'genie',
  name: 'Génie',
  type: 'hero',
  strength: 6,
})
const lampe = (): CardInstance => ({
  instanceId: 'lampe1',
  cardId: 'lampe-merveilleuse',
  name: 'Lampe Merveilleuse',
  type: 'item',
})

function base(): GameState {
  return createInitialGame(
    [
      {
        villain: jafar,
        deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
}

describe('Jafar — Hypnose', () => {
  it('hypnotise un Héros du royaume et paie sa force', () => {
    const b = base()
    const s: GameState = {
      ...b,
      phase: 'ACTION',
      players: b.players.map((p) => ({
        ...p,
        power: 6,
        pawnLocation: 'rues',
        hand: [hypnose()],
        board: { ...p.board, caverne: [genie()] },
      })),
    }
    const next = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'hyp1',
      targetHeroId: 'genie1',
    })
    const g = (next.players[0].board['caverne'] ?? []).find((c) => c.instanceId === 'genie1')
    expect(g?.hypnotized).toBe(true)
    expect(next.players[0].power).toBe(0) // 6 − force du Génie (6)
  })

  it('objectif CONTROL_HERO atteint : Génie hypnotisé + Lampe au Palais', () => {
    const b = base()
    const won: GameState = {
      ...b,
      players: b.players.map((p) => ({
        ...p,
        board: {
          ...p.board,
          palais: [lampe()],
          caverne: [{ ...genie(), hypnotized: true }],
        },
      })),
    }
    expect(hasReachedObjective(won)).toBe(true)

    // Sans hypnose, l'objectif n'est pas atteint.
    const notYet: GameState = {
      ...b,
      players: b.players.map((p) => ({
        ...p,
        board: { ...p.board, palais: [lampe()], caverne: [genie()] },
      })),
    }
    expect(hasReachedObjective(notYet)).toBe(false)
  })
})
