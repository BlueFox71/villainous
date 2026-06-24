import { describe, it, expect } from 'vitest'
import { villainFateTargetingBonus } from '../villainStrategy'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

const card = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

function facilierGame(): GameState {
  return createInitialGame(
    [
      {
        villain: facilier,
        deckCards: buildDeckInstances(facilierCards, 'villain', 'f:'),
        fateCards: buildDeckInstances(facilierCards, 'fate', 'ff:'),
      },
    ],
    1,
  )
}

describe('Facilier — ciblage Fatalité (engineThreats : la Canne)', () => {
  it('pénalise la présence de la Canne (à retirer via Joujou)', () => {
    const g = facilierGame()
    const canne = card({ cardId: 'canne', type: 'item' })
    const p: PlayerState = { ...g.players[0], board: { ...g.players[0].board, parade: [canne] } }
    expect(villainFateTargetingBonus(p)).toBe(-4)
  })
})

describe('Facilier — le bot ne verse jamais « Régner » dans l’Au-delà (Si près du but)', () => {
  it('garde Régner sur la pioche, mais y envoie les parasites', () => {
    const g = facilierGame()
    const regner = card({ cardId: 'regner-nouvelle-orleans', type: 'effect' })
    const amis = card({ cardId: 'amis-au-dela', type: 'effect' })
    const ombres = card({ cardId: 'esprits-ombres', type: 'ally', strength: 3 })
    const state: GameState = {
      ...g,
      pendingFateScry: { chooserIndex: 0, targetIndex: 0, cards: [regner, amis, ombres] },
    }
    const actions = enumerateActions(state)
    expect(actions).toHaveLength(1)
    const a = actions[0]
    if (a.type !== 'RESOLVE_FATE_SCRY') throw new Error('attendu RESOLVE_FATE_SCRY')
    expect(a.toAudelaIds).not.toContain(regner.instanceId) // jamais offrir la victoire
    expect(a.deckTopOrder).toContain(regner.instanceId)
    expect(a.toAudelaIds).toEqual(expect.arrayContaining([amis.instanceId, ombres.instanceId]))
  })
})
