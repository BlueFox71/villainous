import { describe, it, expect } from 'vitest'
import { chooseAction, chooseReaction } from '../heuristicBot'
import { applyAction } from '../../engine/actions'
import { nextRandom } from '../../engine/rng'
import { createInitialGame } from '../../engine/state'
import { buildDeckInstances } from '../../data/types'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'
import type { GameState } from '../../engine/types'

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    const r = nextRandom(s)
    s = r.state
    return r.value
  }
}

/** Joue une partie ORDI vs ORDI comme le pilote de tour d'App.tsx : à chaque étape, un
 *  joueur NON-actif tente d'abord une réaction (Condition) ; sinon le joueur actif joue
 *  son coup. Renvoie l'état final (WON) ou le dernier état atteint au bout de `cap`. */
function playBotMatch(start: GameState, rand: () => number, cap = 8000): GameState {
  let s = start
  let steps = 0
  while (s.status === 'PLAYING' && steps < cap) {
    let reacted = false
    for (let i = 0; i < s.players.length; i++) {
      if (i === s.activePlayer) continue
      const r = chooseReaction(s, i)
      if (r) {
        s = applyAction(s, r)
        reacted = true
        break
      }
    }
    if (!reacted) s = applyAction(s, chooseAction(s, rand))
    steps++
  }
  return s
}

describe('Partie ordi vs ordi (self-play, calque du pilote App)', () => {
  it('réactions + actions interleavées : la partie converge vers une victoire', () => {
    const s = playBotMatch(twoPlayerGame(5), seededRand(99))
    expect(s.status).toBe('WON')
  })

  it('Bowser (IA) vs Prince Jean (IA) : les DEUX camps se jouent sans exception, jusqu\'au bout', () => {
    const s0 = createInitialGame(
      [
        { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      7,
    )
    let s: GameState = s0
    expect(() => {
      s = playBotMatch(s0, seededRand(7))
    }).not.toThrow()
    expect(s.status).toBe('WON') // Prince Jean (objectif Pouvoir) garantit une fin
  }, 30000)
})
