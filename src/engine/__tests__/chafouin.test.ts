import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
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
  it('ouvre le CHOIX des arceaux (jamais auto) et retransforme ceux désignés', () => {
    const s = reineWith({ 'cour-palais': [wicket('w1')], labyrinthe: [wicket('w2')], 'foret-tulgey': [wicket('w3')] })
    const opened = resolveEffect(s, { type: 'REVERT_WICKETS', max: 2 }, { actorIndex: 0 })
    // Interactif : c'est le FATALISEUR qui désigne les arceaux (ici, joueur unique = 0).
    expect(opened.pendingTransformWickets).toMatchObject({ playerIndex: 0, direction: 'to-guard', max: 2 })
    expect(Object.values(opened.players[0].board).flat().filter((c) => c.isWicket)).toHaveLength(3)
    // Le choix porté sur w1 et w3 : ce sont ceux-là (et pas w2) qui redeviennent Gardes.
    const after = applyAction(opened, { type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds: ['w1', 'w3'] })
    const byId = Object.fromEntries(Object.values(after.players[0].board).flat().map((c) => [c.instanceId, c]))
    expect(byId['w1'].isWicket).toBeFalsy()
    expect(byId['w3'].isWicket).toBeFalsy()
    expect(byId['w2'].isWicket).toBe(true)
    expect(after.pendingTransformWickets ?? null).toBeNull()
  })

  it('plafonne au `max` même si on en désigne davantage', () => {
    const s = reineWith({ 'cour-palais': [wicket('w1')], labyrinthe: [wicket('w2')], 'foret-tulgey': [wicket('w3')] })
    const opened = resolveEffect(s, { type: 'REVERT_WICKETS', max: 2 }, { actorIndex: 0 })
    const after = applyAction(opened, { type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds: ['w1', 'w2', 'w3'] })
    expect(Object.values(after.players[0].board).flat().filter((c) => c.isWicket)).toHaveLength(1)
  })

  it('no-op s’il n’y a aucun arceau (aucun choix ouvert)', () => {
    const s = reineWith({ labyrinthe: [{ instanceId: 'g', cardId: 'gardes-coeur', name: 'G', type: 'ally', strength: 3 }] })
    const after = resolveEffect(s, { type: 'REVERT_WICKETS', max: 2 }, { actorIndex: 0 })
    expect(after.pendingTransformWickets ?? null).toBeNull()
    expect(Object.values(after.players[0].board).flat().some((c) => c.isWicket)).toBe(false)
  })

  it('Chafouin a bien onPlace REVERT_WICKETS et onVanquish TRANSFORM_GUARDS', () => {
    const chaf = buildDeckInstances(reineCoeurCards, 'fate', 'c:').find((c) => c.cardId === 'chafouin')!
    expect(chaf.onPlace?.[0]).toEqual({ type: 'REVERT_WICKETS', max: 2 })
    expect(chaf.onVanquish?.[0]).toEqual({ type: 'TRANSFORM_GUARDS', max: 2 })
  })
})
