import { describe, it, expect } from 'vitest'
import { evaluate } from '../heuristicBot'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

let n = 0
const inst = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `v${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function twoPlayerGame(): GameState {
  const setup = {
    villain: bowser,
    deckCards: buildDeckInstances(bowserCards, 'villain', 'x:'),
    fateCards: buildDeckInstances(bowserCards, 'fate', 'xf:'),
  }
  return createInitialGame([setup, setup], 1)
}

function withP0(patch: Partial<GameState['players'][number]>): GameState {
  const g = twoPlayerGame()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  const p0 = { ...g.players[0], board: empty, ...patch }
  return { ...g, status: 'PLAYING', phase: 'ACTION', activePlayer: 0, players: [p0, g.players[1]] }
}

describe('Bowser — sécurisation des Étoiles (bonus d\'éval, P5)', () => {
  it('une Étoile BANKÉE (retirée du jeu) vaut mieux qu\'une Étoile posée sur un Allié', () => {
    // A : l'Étoile est sur un Allié (drainée mais récupérable par une Fatalité).
    const a = withP0({ observatoryStars: 3, board: undefined as never })
    a.players[0].board = { ...Object.fromEntries(a.players[0].locations.map((l) => [l.id, []])), galaxies: [inst('kamella', 'ally', { strength: 3, stars: 1 })] }
    // B : même Observatoire (3), mais l'Étoile a quitté le jeu → banked = 4−3−0 = 1.
    const b = withP0({ observatoryStars: 3 })
    b.players[0].board = { ...Object.fromEntries(b.players[0].locations.map((l) => [l.id, []])), galaxies: [inst('kamella', 'ally', { strength: 3, stars: 0 })] }
    expect(evaluate(b, 0)).toBeGreaterThan(evaluate(a, 0))
  })
})

describe('Bowser — option Vanquish sélective (porteur d\'Étoile, P5)', () => {
  it('propose un sous-ensemble minimal priorisant l\'Allié porteur d\'Étoile', () => {
    const luma = inst('luma', 'hero', { strength: 2 }) // Héros F2 à vaincre
    const kamella = inst('kamella', 'ally', { strength: 3, stars: 1 }) // porteur d'Étoile, F3 → suffit seul
    const bould = inst('bouldergeist', 'ally', { strength: 4 }) // gros Allié à préserver
    const g = twoPlayerGame()
    const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
    const p0 = {
      ...g.players[0],
      pawnLocation: 'chateau-peach',
      usedActionIds: [],
      board: { ...empty, 'chateau-peach': [luma, kamella, bould] },
    }
    const s: GameState = { ...g, status: 'PLAYING', phase: 'ACTION', activePlayer: 0, players: [p0, g.players[1]] }

    const vanq = enumerateActions(s).filter(
      (a): a is Extract<typeof a, { type: 'VANQUISH' }> => a.type === 'VANQUISH' && a.heroInstanceId === luma.instanceId,
    )
    // Option « tout » (les 2 Alliés) TOUJOURS présente.
    expect(vanq.some((a) => a.allyInstanceIds.length === 2)).toBe(true)
    // Option sélective : le SEUL porteur d'Étoile (kamella), sans le gros Bouldergeist.
    expect(
      vanq.some((a) => a.allyInstanceIds.length === 1 && a.allyInstanceIds[0] === kamella.instanceId),
    ).toBe(true)
  })
})
