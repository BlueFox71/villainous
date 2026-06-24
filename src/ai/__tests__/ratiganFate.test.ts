import { describe, it, expect } from 'vitest'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { ratigan } from '../../data/villains/ratigan'
import { ratiganCards } from '../../data/villains/ratigan.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

const hero = (cardId: string, strength: number): CardInstance =>
  ({ instanceId: cardId + ':1', cardId, name: cardId, type: 'hero', strength })

function ratiganFate(revealed: CardInstance[]): GameState {
  const g = createInitialGame(
    [{ villain: ratigan, deckCards: buildDeckInstances(ratiganCards, 'villain', 'r:'), fateCards: buildDeckInstances(ratiganCards, 'fate', 'rf:') }],
    1,
  )
  return { ...g, activePlayer: 0, phase: 'ACTION', pendingFate: { target: 0, revealed } }
}

describe('Ratigan — le bot ne joue pas Flaversham (qui l’aide) s’il a une alternative', () => {
  it('avec une autre carte révélée, aucune option ne joue Flaversham', () => {
    const flav = hero('flaversham', 2)
    const basil = hero('basil', 4)
    const actions = enumerateActions(ratiganFate([flav, basil]))
    const targetsFlav = actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === flav.instanceId)
    const targetsBasil = actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === basil.instanceId)
    expect(targetsFlav).toBe(false) // Flaversham écarté
    expect(targetsBasil).toBe(true) // Basil reste jouable
  })

  it('si Flaversham est la seule carte révélée, il reste jouable (la Fatalité doit frapper)', () => {
    const flav = hero('flaversham', 2)
    const actions = enumerateActions(ratiganFate([flav]))
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === flav.instanceId)).toBe(true)
  })
})
