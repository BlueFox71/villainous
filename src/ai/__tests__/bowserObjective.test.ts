import { describe, it, expect } from 'vitest'
import { objectiveScore } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

let n = 0
const hero = (cardId: string, extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `h${n++}`,
  cardId,
  name: cardId,
  type: 'hero',
  strength: 2,
  ...extra,
})

function bowserPlayer(patch: Partial<PlayerState> = {}): PlayerState {
  const g = createInitialGame(
    [{ villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'x:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'xf:') }],
    1,
  )
  return { ...g.players[0], ...patch }
}

describe('Bowser — jauge d\'objectif : quête Peach', () => {
  it('Observatoire plein (4 Étoiles), pas de Peach → progrès nul', () => {
    const p = bowserPlayer({ observatoryStars: 4, peachCaptured: false })
    expect(objectiveScore(p)).toBeCloseTo(0, 5)
  })

  it('Peach PRÉSENTE dans le royaume (non capturée) → palier intermédiaire (0.15)', () => {
    const p = bowserPlayer({ observatoryStars: 4, peachCaptured: false })
    p.board = { ...p.board, 'chateau-peach': [hero('peach')] }
    expect(objectiveScore(p)).toBeCloseTo(0.15, 5)
  })

  it('Peach CAPTURÉE vaut plus que simplement présente', () => {
    const present = bowserPlayer({ observatoryStars: 4, peachCaptured: false })
    present.board = { ...present.board, 'chateau-peach': [hero('peach')] }
    const captured = bowserPlayer({ observatoryStars: 4, peachCaptured: true })
    expect(objectiveScore(captured)).toBeGreaterThan(objectiveScore(present))
    expect(objectiveScore(captured)).toBeCloseTo(0.4, 5)
  })

  it('épuisement complet + Peach capturée = objectif atteint (1.0)', () => {
    const p = bowserPlayer({ observatoryStars: 0, peachCaptured: true })
    expect(objectiveScore(p)).toBeCloseTo(1, 5)
  })
})
