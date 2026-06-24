import { describe, it, expect } from 'vitest'
import { villainStrategyBonus } from '../villainStrategy'
import { createInitialGame } from '../../engine/state'
import { patHibulaire } from '../../data/villains/patHibulaire'
import { patHibulaireCards } from '../../data/villains/patHibulaire.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

const card = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

function peteWith(cards: CardInstance[]): PlayerState {
  const g = createInitialGame(
    [{ villain: patHibulaire, deckCards: buildDeckInstances(patHibulaireCards, 'villain', 'p:'), fateCards: buildDeckInstances(patHibulaireCards, 'fate', 'pf:') }],
    1,
  )
  const p = g.players[0]
  const here = p.locations[0].id
  return { ...p, board: { ...p.board, [here]: cards } }
}

describe('Pat Hibulaire — couche stratégie (villainStrategyBonus)', () => {
  it('valorise Steamboat Willie et Vieux Tacot (moteurs d’actions)', () => {
    expect(villainStrategyBonus(peteWith([card({ cardId: 'steamboat-willie', type: 'item' })]))).toBe(3)
    expect(villainStrategyBonus(peteWith([card({ cardId: 'vieux-tacot', type: 'item' })]))).toBe(3)
  })

  it('pénalise fortement Mickey (bloque tout objectif) et Donald sur son plateau', () => {
    expect(villainStrategyBonus(peteWith([card({ cardId: 'mickey', type: 'hero', strength: 5 })]))).toBe(-8)
    expect(villainStrategyBonus(peteWith([card({ cardId: 'donald', type: 'hero', strength: 3 })]))).toBe(-5)
  })
})
