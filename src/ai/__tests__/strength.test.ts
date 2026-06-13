import { describe, it, expect } from 'vitest'
import { chooseAction as heuristic } from '../heuristicBot'
import { chooseAction as random } from '../randomBot'
import { applyAction } from '../../engine/actions'
import { createInitialGame } from '../../engine/state'
import { nextRandom } from '../../engine/rng'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'
import { buildDeckInstances } from '../../data/types'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import type { GameState } from '../../engine/types'

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    const r = nextRandom(s)
    s = r.state
    return r.value
  }
}

const pjSetup = (p: string) => ({
  villain: princeJohn,
  deckCards: buildDeckInstances(princeJohnCards, 'villain', p),
  fateCards: buildDeckInstances(princeJohnCards, 'fate', p + 'f:'),
})
const malSetup = (p: string) => ({
  villain: maleficent,
  deckCards: buildDeckInstances(maleficentCards, 'villain', p),
  fateCards: buildDeckInstances(maleficentCards, 'fate', p + 'f:'),
})

describe('heuristicBot — force', () => {
  it('domine largement le bot aléatoire (≥ 90 % de victoires)', () => {
    let hWins = 0
    let rWins = 0
    const N = 20
    for (let g = 0; g < N; g++) {
      const rand = seededRand(1000 + g * 7)
      const heuristicIdx = g % 2 // alterne qui commence (neutralise l'avantage 1er joueur)
      let s = twoPlayerGame(g + 1)
      let steps = 0
      while (s.status === 'PLAYING' && steps < 4000) {
        const fn = s.activePlayer === heuristicIdx ? heuristic : random
        s = applyAction(s, fn(s, rand))
        steps++
      }
      if (s.status === 'WON') {
        if (s.winner === heuristicIdx) hWins++
        else rWins++
      }
    }
    expect(hWins).toBeGreaterThanOrEqual(Math.ceil(N * 0.9))
    expect(rWins).toBe(N - hWins) // pas de parties non terminées
  })

  it('les parties Prince Jean vs Maléfique convergent (anti-livelock)', () => {
    // Garde-fou : avant l'éval « consciente de l'objectif », les deux bots se
    // fatalisaient en boucle (Maléfique thésaurisait du pouvoir sans maudire,
    // PJ se retrouvait bloqué par les Héros) → ~1/3 des parties ne finissaient pas.
    let finished = 0
    const N = 10
    for (let g = 0; g < N; g++) {
      const rand = seededRand(500 + g * 13)
      const players =
        g % 2 === 0 ? [malSetup('p0:'), pjSetup('p1:')] : [pjSetup('p0:'), malSetup('p1:')]
      let s: GameState = createInitialGame(players, g + 1)
      let steps = 0
      while (s.status === 'PLAYING' && steps < 3000) {
        s = applyAction(s, heuristic(s, rand))
        steps++
      }
      if (s.status === 'WON') finished++
    }
    expect(finished).toBe(N)
  }, 20000) // 10 parties complètes : test d'intégration, marge de temps généreuse.
})
