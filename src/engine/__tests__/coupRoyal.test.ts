import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const wicket = (id: string, s: number): CardInstance => ({
  instanceId: id,
  cardId: 'gardes-coeur',
  name: 'Arceau',
  type: 'ally',
  strength: s,
  isWicket: true,
})
const deckCard = (id: string, cost: number): CardInstance => ({
  instanceId: id,
  cardId: 'joyeux-non-anniversaire',
  name: 'X',
  type: 'effect',
  cost,
})

/** Reine de Cœur avec un arceau sur chaque lieu et une pioche contrôlée. */
function setup(wicketStrength: number, deckCosts: number[]): GameState {
  const base = createInitialGame(
    [{ villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') }],
    21,
  )
  const per = wicketStrength / 4
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      deck: deckCosts.map((c, i) => deckCard(`d${i}`, c)),
      board: Object.fromEntries(p.locations.map((l, i) => [l.id, [wicket(`w${i}`, per)]])),
    })),
  }
}

describe('Reine de Cœur — Coup Royal', () => {
  it('réussi : coûts révélés < force des arceaux → victoire', () => {
    const s = setup(12, [0, 0, 1, 1, 0]) // arceaux 12 vs coûts 2
    const next = resolveEffect(s, { type: 'ROYAL_CROQUET_ATTEMPT' }, { actorIndex: 0 })
    expect(next.pendingRoyalCroquet?.won).toBe(true)
    expect(next.status).toBe('WON')
    expect(next.winner).toBe(0)
  })

  it('raté : coûts ≥ force → pas de victoire, 5 cartes défaussées', () => {
    const s = setup(8, [4, 4, 4, 4, 4]) // arceaux 8 vs coûts 20
    const next = resolveEffect(s, { type: 'ROYAL_CROQUET_ATTEMPT' }, { actorIndex: 0 })
    expect(next.pendingRoyalCroquet?.won).toBe(false)
    expect(next.status).toBe('PLAYING')
    expect(next.players[0].discard).toHaveLength(5)
  })

  it('on peut fermer la fenêtre de résultat même après la victoire (partie finie)', () => {
    const s = setup(12, [0, 0, 1, 1, 0])
    const won = resolveEffect(s, { type: 'ROYAL_CROQUET_ATTEMPT' }, { actorIndex: 0 })
    expect(won.status).toBe('WON')
    // DISMISS_ROYAL_CROQUET reste autorisé malgré status WON (ne jette pas).
    const closed = applyAction(won, { type: 'DISMISS_ROYAL_CROQUET' })
    expect(closed.pendingRoyalCroquet ?? null).toBeNull()
    expect(closed.status).toBe('WON') // la partie reste gagnée
  })

  it('sans arceau sur chaque lieu : aucune révélation', () => {
    const s = setup(12, [0, 0, 0, 0, 0])
    // Retire l'arceau d'un lieu.
    const loc0 = s.players[0].locations[0].id
    const s2: GameState = { ...s, players: s.players.map((p) => ({ ...p, board: { ...p.board, [loc0]: [] } })) }
    const next = resolveEffect(s2, { type: 'ROYAL_CROQUET_ATTEMPT' }, { actorIndex: 0 })
    expect(next.pendingRoyalCroquet ?? null).toBeNull()
    expect(next.status).toBe('PLAYING')
  })
})
