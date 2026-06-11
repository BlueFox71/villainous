import { describe, it, expect } from 'vitest'
import { chooseAction, evaluate } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState, CardInstance } from '../../engine/types'

function jafarGame(seed = 1): GameState {
  return createInitialGame(
    [
      {
        villain: jafar,
        deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:'),
      },
      {
        villain: princeJohn,
        deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'),
        fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:'),
      },
    ],
    seed,
  )
}

function instanceOf(cardId: string): CardInstance {
  const inst = buildDeckInstances(jafarCards, 'villain', 't:').find((c) => c.cardId === cardId)
  if (!inst) throw new Error(`carte introuvable: ${cardId}`)
  return inst
}

describe('priorité du bot Jafar : Scarabée puis Lampe', () => {
  it('déverrouiller la Caverne augmente fortement l’évaluation', () => {
    const s = jafarGame()
    const locked = evaluate(s, 0)
    const unlocked = evaluate({ ...s, players: s.players.map((p) => ({ ...p, lockedLocations: [] })) }, 0)
    expect(unlocked).toBeGreaterThan(locked)
  })

  it('invoquer le Génie (Lampe posée) augmente encore l’évaluation', () => {
    const s = jafarGame()
    const genie: CardInstance = { instanceId: 'g', cardId: 'genie', name: 'Génie', type: 'hero', strength: 5 }
    const lampe = instanceOf('lampe-merveilleuse')
    const unlocked = evaluate({ ...s, players: s.players.map((p) => ({ ...p, lockedLocations: [] })) }, 0)
    const genieOut = evaluate(
      {
        ...s,
        players: s.players.map((p) => ({
          ...p,
          lockedLocations: [],
          board: { ...p.board, caverne: [genie, lampe] },
        })),
      },
      0,
    )
    expect(genieOut).toBeGreaterThan(unlocked)
  })

  it('joue le Scarabée d’Or plutôt que gagner du pouvoir quand il est en main et payable', () => {
    let s = jafarGame()
    // Phase action, pion à l'Oasis (qui propose Jouer une carte ET Gagner 3 pouvoir),
    // main = Scarabée d'Or uniquement, pouvoir suffisant.
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, pawnLocation: 'oasis', hand: [instanceOf('scarabee-or')], power: 6 }
          : p,
      ),
    }
    const action = chooseAction(s)
    expect(action.type).toBe('PLAY_CARD')
  })
})
