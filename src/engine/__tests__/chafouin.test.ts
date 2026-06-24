import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { createInitialGame } from '../state'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const wicket = (id: string): CardInstance =>
  ({ instanceId: id, cardId: 'gardes-coeur', name: 'Cartes Gardes : Cœur', type: 'ally', strength: 3, isWicket: true })

function reineWith(board: Record<string, CardInstance[]>): GameState {
  const g = createInitialGame(
    [{ villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'r:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'rf:') }],
    1,
  )
  return { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, ...board } }] }
}

describe('Le Chafouin — REVERT_WICKETS (retransforme des arceaux en Cartes Gardes)', () => {
  it('retransforme jusqu’à 2 arceaux (un par lieu)', () => {
    const s = reineWith({ 'cour-palais': [wicket('w1')], labyrinthe: [wicket('w2')], 'foret-tulgey': [wicket('w3')] })
    const after = resolveEffect(s, { type: 'REVERT_WICKETS', max: 2 }, { actorIndex: 0 })
    const allCards = Object.values(after.players[0].board).flat()
    const stillWickets = allCards.filter((c) => c.isWicket).length
    expect(stillWickets).toBe(1) // 3 arceaux − 2 retransformés
  })

  it('no-op s’il n’y a aucun arceau', () => {
    const s = reineWith({ labyrinthe: [{ instanceId: 'g', cardId: 'gardes-coeur', name: 'G', type: 'ally', strength: 3 }] })
    const after = resolveEffect(s, { type: 'REVERT_WICKETS', max: 2 }, { actorIndex: 0 })
    expect(Object.values(after.players[0].board).flat().some((c) => c.isWicket)).toBe(false)
  })

  it('Chafouin a bien onPlace REVERT_WICKETS et onVanquish TRANSFORM_GUARDS', () => {
    const chaf = buildDeckInstances(reineCoeurCards, 'fate', 'c:').find((c) => c.cardId === 'chafouin')!
    expect(chaf.onPlace?.[0]).toEqual({ type: 'REVERT_WICKETS', max: 2 })
    expect(chaf.onVanquish?.[0]).toEqual({ type: 'TRANSFORM_GUARDS', max: 2 })
  })
})
