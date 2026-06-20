import { describe, it, expect } from 'vitest'
import { chooseAction } from '../heuristicBot'
import { applyAction } from '../../engine/actions'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState } from '../../engine/types'

function game(seed = 1): GameState {
  return createInitialGame(
    [
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    seed,
  )
}

describe('bot : fatalise systématiquement quand l’adversaire a atteint son objectif', () => {
  it('phase ACTION, Fatalité disponible → le bot lance la Fatalité', () => {
    const base = game()
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: [
        // Bot (Bowser) sur le Château de Bowser (qui porte une action Fatalité).
        { ...base.players[0], pawnLocation: 'chateau-bowser' },
        // Adversaire (Prince Jean) a DÉJÀ atteint son objectif (20 JT → gagnera au début de son tour).
        { ...base.players[1], power: 20 },
      ],
    }
    const action = chooseAction(s, () => 0)
    expect(action.type).toBe('FATE')
  })

  it('phase MOVE → le bot se déplace vers un lieu permettant la Fatalité', () => {
    const base = game()
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'MOVE',
      usedActionIds: [],
      players: [
        { ...base.players[0], pawnLocation: 'observatoire' },
        { ...base.players[1], power: 20 },
      ],
    }
    const action = chooseAction(s, () => 0)
    expect(action.type).toBe('MOVE')
    // Le déplacement choisi débouche bien sur une Fatalité possible ce tour.
    const after = applyAction(s, action)
    expect(enumerateActions(after).some((a) => a.type === 'FATE')).toBe(true)
  })

  it('adversaire TRÈS proche (jauge ≥ 0,9) et bot en retard → le bot fatalise', () => {
    const base = game()
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: [
        { ...base.players[0], pawnLocation: 'chateau-bowser' },
        // Prince Jean à 18/20 JT (0,9) : pas encore gagnant, mais imminent.
        { ...base.players[1], power: 18 },
      ],
    }
    const action = chooseAction(s, () => 0)
    expect(action.type).toBe('FATE')
  })

  it('si l’adversaire n’a PAS atteint son objectif, le bot n’est pas forcé de fataliser', () => {
    const base = game()
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: [
        { ...base.players[0], pawnLocation: 'chateau-bowser' },
        { ...base.players[1], power: 3 }, // loin de l'objectif
      ],
    }
    // On ne force rien : chooseAction renvoie une action légale quelconque (pas de crash).
    const action = chooseAction(s, () => 0)
    expect(action).toBeTruthy()
  })
})
