import { describe, it, expect } from 'vitest'
import { chooseAction } from '../randomBot'
import { applyAction } from '../../engine/actions'
import { getLegalMoves } from '../../engine/rules'
import { nextRandom } from '../../engine/rng'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'

/** Générateur aléatoire déterministe pour des tests reproductibles. */
function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    const r = nextRandom(s)
    s = r.state
    return r.value
  }
}

describe('randomBot', () => {
  it('en phase MOVE, renvoie un déplacement légal', () => {
    const s = twoPlayerGame(1)
    const action = chooseAction(s, seededRand(3))
    expect(action.type).toBe('MOVE')
    if (action.type === 'MOVE') {
      expect(getLegalMoves(s)).toContain(action.to)
    }
  })

  it('ne produit que des coups légaux sur une longue partie (aucune exception)', () => {
    const rand = seededRand(12345)
    let s = twoPlayerGame(1)
    let steps = 0
    expect(() => {
      while (s.status === 'PLAYING' && steps < 2000) {
        s = applyAction(s, chooseAction(s, rand))
        steps++
      }
    }).not.toThrow()
  })

  it('un tour de bot finit toujours par passer la main', () => {
    const rand = seededRand(7)
    let s = twoPlayerGame(2)
    const start = s.activePlayer
    let steps = 0
    while (s.activePlayer === start && s.status === 'PLAYING' && steps < 100) {
      s = applyAction(s, chooseAction(s, rand))
      steps++
    }
    expect(s.activePlayer).not.toBe(start)
  })

  it('deux bots progressent au fil du temps (au moins quelques tours sans crash)', () => {
    // Note : depuis B (Combat + effets passifs Roi Richard/Robin/Petit Jean),
    // deux bots PUREMENT aléatoires ne convergent plus dans un temps raisonnable
    // (Robin retire 1 à chaque gain, Petit Jean/Voler aux Riches drainent, etc.).
    // On vérifie qu'au moins 50 tours se sont déroulés sans exception — la légalité
    // est validée par le test précédent.
    const rand = seededRand(999)
    let s = twoPlayerGame(5)
    let steps = 0
    while (s.status === 'PLAYING' && steps < 5000) {
      s = applyAction(s, chooseAction(s, rand))
      steps++
    }
    expect(s.turn).toBeGreaterThan(50)
  })
})
