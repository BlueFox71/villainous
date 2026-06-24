import { describe, it, expect } from 'vitest'
import { villainFateTargetingBonus } from '../villainStrategy'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { mechanteReine } from '../../data/villains/mechanteReine'
import { mechanteReineCards } from '../../data/villains/mechanteReine.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

const card = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

function reineGame(): GameState {
  return createInitialGame(
    [
      {
        villain: mechanteReine,
        deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'r:'),
        fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'rf:'),
      },
    ],
    1,
  )
}

describe('Méchante Reine — ciblage Fatalité (engineThreats : le Miroir)', () => {
  it('pénalise la présence du Miroir magique (à défausser via Atchoum)', () => {
    const g = reineGame()
    const miroir = card({ cardId: 'miroir-magique', type: 'item' })
    const p: PlayerState = { ...g.players[0], board: { ...g.players[0].board, mine: [miroir] } }
    expect(villainFateTargetingBonus(p)).toBe(-4)
  })
})

describe('Méchante Reine — Animaux de la forêt vise la carte la plus précieuse', () => {
  it('fait défausser le Miroir en priorité (sur Croque ! et un Événement)', () => {
    const g = reineGame()
    const croque = card({ cardId: 'croque', type: 'effect' })
    const miroir = card({ cardId: 'miroir-magique', type: 'item' })
    const broyer = card({ cardId: 'broyer-os', type: 'effect' })
    const hand = [croque, miroir, broyer]
    const state: GameState = {
      ...g,
      players: [{ ...g.players[0], hand }],
      pendingFateChoice: {
        chooserIndex: 0,
        targetIndex: 0,
        kind: 'discard-from-hand',
        candidateIds: hand.map((c) => c.instanceId),
      },
    }
    const actions = enumerateActions(state)
    expect(actions).toEqual([{ type: 'RESOLVE_FATE_CHOICE', instanceId: miroir.instanceId }])
  })

  it('à défaut de Miroir, fait défausser un Ingrédient avant Croque !', () => {
    const g = reineGame()
    const croque = card({ cardId: 'croque', type: 'effect' })
    const ingredient = card({ cardId: 'noir-de-nuit', type: 'ingredient' })
    const hand = [croque, ingredient]
    const state: GameState = {
      ...g,
      players: [{ ...g.players[0], hand }],
      pendingFateChoice: {
        chooserIndex: 0,
        targetIndex: 0,
        kind: 'discard-from-hand',
        candidateIds: hand.map((c) => c.instanceId),
      },
    }
    const actions = enumerateActions(state)
    expect(actions).toEqual([{ type: 'RESOLVE_FATE_CHOICE', instanceId: ingredient.instanceId }])
  })
})
