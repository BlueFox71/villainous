// =============================================================================
// Bot Tabbou — les ORBES SUBSPATIAUX ne se jettent plus pour cycler la main.
//
// Journal de partie (Lotso contre Tabbou, 80 tours) : « Tabbou défausse 1 carte (Orbe
// subspatial) » revient QUATRE fois, et l'Émissaire Subspatial n'est jamais débloqué.
// Les Orbes sont pourtant la seule clé de son 4ᵉ lieu (un par lieu, hors Émissaire) :
// tant qu'il est verrouillé, ce sont des cartes CRUCIALES, à poser et non à défausser.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { enumerateActions, objectiveCriticalCardIds } from '../enumerate'
import { trimHandAction } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { buildDeckInstances } from '../../data/types'
import { tabbou } from '../../data/villains/tabbou'
import { tabbouCards } from '../../data/villains/tabbou.cards'
import type { CardInstance, GameAction, GameState } from '../../engine/types'

const orb = (id: string): CardInstance =>
  buildDeckInstances(tabbouCards, 'villain', 'o:')
    .filter((c) => c.cardId.startsWith('boule-'))
    .map((c) => ({ ...c, instanceId: id }))[0]

const filler = (id: string): CardInstance =>
  ({ instanceId: id, cardId: 'coup-fatal', name: 'Coup Fatal', type: 'effect', cost: 9 })

/** Tabbou (joueur 0) avec `hand` en main, pion sur un lieu portant « Défausser ». */
function game(hand: CardInstance[], unlockEmissaire = false): GameState {
  const g = createInitialGame(
    [{ villain: tabbou, deckCards: buildDeckInstances(tabbouCards, 'villain', 'p0:'), fateCards: buildDeckInstances(tabbouCards, 'fate', 'p0f:') }],
    5,
  )
  const p = g.players[0]
  const discardLoc = p.locations.find((l) => l.actions.some((a) => a.type === 'DISCARD_CARDS'))!
  return {
    ...g,
    phase: 'ACTION',
    activePlayer: 0,
    usedActionIds: [],
    players: [
      {
        ...p,
        hand,
        power: 0, // aucune carte jouable : cycler la main est la seule option « utile »
        pawnLocation: discardLoc.id,
        lockedLocations: unlockEmissaire ? [] : p.lockedLocations,
      },
    ] as GameState['players'],
  }
}

const discardedIds = (s: GameState): string[] =>
  enumerateActions(s)
    .filter((a): a is Extract<GameAction, { type: 'DISCARD_CARDS' }> => a.type === 'DISCARD_CARDS')
    .flatMap((a) => a.instanceIds)

describe('bot Tabbou — Orbes subspatiaux préservés', () => {
  it('l’Émissaire est verrouillé au départ et les Orbes sont déclarés CRUCIAUX', () => {
    const s = game([orb('orb1'), filler('f1')])
    const p = s.players[0]
    expect(p.emissaireLocationId).toBeDefined()
    expect(p.lockedLocations ?? []).toContain(p.emissaireLocationId!)
    expect(objectiveCriticalCardIds(p).has('boule-1')).toBe(true)
  })

  it('l’action Défausser ne propose JAMAIS un Orbe (elle propose les autres cartes)', () => {
    const s = game([orb('orb1'), filler('f1')])
    const ids = discardedIds(s)
    expect(ids).toContain('f1')
    expect(ids).not.toContain('orb1')
  })

  it('la défausse de fin de tour (main trop pleine) épargne aussi les Orbes', () => {
    const hand = [orb('orb1'), orb('orb2'), filler('f1'), filler('f2'), filler('f3'), filler('f4')]
    const s = game(hand)
    const trim = trimHandAction(s, 0)
    const ids = (trim as Extract<GameAction, { type: 'DISCARD_HAND_CARDS' }>).instanceIds
    expect(ids).not.toContain('orb1')
    expect(ids).not.toContain('orb2')
  })

  it('une fois l’Émissaire DÉBLOQUÉ, les Orbes redeviennent défaussables (plus rien à ouvrir)', () => {
    const s = game([orb('orb1'), filler('f1')], true)
    expect(objectiveCriticalCardIds(s.players[0]).has('boule-1')).toBe(false)
    expect(discardedIds(s)).toContain('orb1')
  })
})
