import { describe, it, expect } from 'vitest'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import type { CardInstance, GameState } from '../types'

function game2(): GameState {
  return createInitialGame(
    [
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') },
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p1:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p1f:') },
    ],
    7,
  )
}
const ally = (id: string): CardInstance => ({ instanceId: id, cardId: 'bouldergeist', name: 'Bouldergeist', type: 'ally', strength: 4 })

describe('Bowser — Besoin de renfort (Condition)', () => {
  it("pose un Allié gratuitement quand l'adversaire a ≥3 Alliés", () => {
    const base = game2()
    const p1 = base.players[1]
    const renfort = p1.deck.find((c) => c.cardId === 'renforts')!
    const handAlly = ally('p1-ally')
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      players: [
        // Adversaire actif avec 3 Alliés (déclencheur).
        { ...base.players[0], board: { ...base.players[0].board, galaxies: [ally('a'), ally('b'), ally('c')] } },
        { ...p1, hand: [renfort, handAlly] },
      ],
    }
    const after = applyAction(s, {
      type: 'PLAY_CONDITION',
      playerIndex: 1,
      instanceId: renfort.instanceId,
      allyInstanceId: handAlly.instanceId,
      to: 'chateau-bowser',
    })
    // L'Allié est posé sur le plateau du joueur 1, et n'est plus en main.
    expect(after.players[1].board['chateau-bowser'].some((c) => c.instanceId === 'p1-ally')).toBe(true)
    expect(after.players[1].hand.some((c) => c.instanceId === 'p1-ally')).toBe(false)
  })
})

describe("Bowser — Festival des éclats d'étoiles (Condition)", () => {
  it("fait gagner 3 jetons Pouvoir au joueur qui réagit quand l'adversaire a ≥6 JT", () => {
    const base = game2()
    const p1 = base.players[1]
    const festival = p1.deck.find((c) => c.cardId === 'nuit')!
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      players: [
        { ...base.players[0], power: 6 }, // adversaire actif ≥6 JT (déclencheur)
        { ...p1, power: 2, hand: [festival] },
      ],
    }
    const after = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: festival.instanceId })
    expect(after.players[1].power).toBe(5) // 2 + 3
    expect(after.players[1].hand.some((c) => c.instanceId === festival.instanceId)).toBe(false)
  })
})

describe('Bowser — Bowser Jr. (passif : pioche quand ciblé par la Fatalité)', () => {
  it('la cible pioche 1 carte quand Bowser Jr. est dans son royaume', () => {
    const base = game2()
    const p1 = base.players[1]
    const jr: CardInstance = { instanceId: 'jr1', cardId: 'bowser-jr', name: 'Bowser Jr.', type: 'ally', strength: 2 }
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: [
        { ...base.players[0], pawnLocation: 'chateau-bowser' },
        { ...p1, board: { ...p1.board, galaxies: [jr] } },
      ],
    }
    const before = s.players[1].hand.length
    // Action Fatalité depuis le Château de Bowser (action 'fate').
    const after = applyAction(s, { type: 'FATE', actionId: 'fate' })
    expect(after.players[1].hand.length).toBe(before + 1)
  })
})
