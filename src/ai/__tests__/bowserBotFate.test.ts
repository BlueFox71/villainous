import { describe, it, expect } from 'vitest'
import { chooseAction } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState, CardInstance } from '../../engine/types'

function game(seed = 1): GameState {
  return createInitialGame(
    [
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    seed,
  )
}

function fateInst(cardId: string): CardInstance {
  const i = buildDeckInstances(bowserCards, 'fate', 't:').find((c) => c.cardId === cardId)
  if (!i) throw new Error(`carte Fatalité introuvable : ${cardId}`)
  return i
}

describe('bot : Fatalité « Vous avez obtenu une grande étoile ! » contre Bowser', () => {
  it("la choisit quand un Allié de Bowser porte une Étoile (remonte l'Observatoire)", () => {
    const base = game()
    const grand = fateInst('gain-grand-star')
    const alt = fateInst('comete') // Comète farceuse : sans Objet à défausser ici → faible valeur
    const ally: CardInstance = { instanceId: 'a1', cardId: 'dino-piranha', name: 'Dino Piranha', type: 'ally', strength: 2, stars: 1 }
    // C'est au tour de l'adversaire (joueur 1) ; il révèle une Fatalité contre Bowser (joueur 0).
    const s: GameState = {
      ...base,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [grand, alt] },
      players: [
        { ...base.players[0], observatoryStars: 3, pawnLocation: 'galaxies', board: { ...base.players[0].board, galaxies: [ally] } },
        base.players[1],
      ],
    }
    const action = chooseAction(s, () => 0)
    expect(action.type).toBe('RESOLVE_FATE')
    expect(action.type === 'RESOLVE_FATE' && action.instanceId).toBe(grand.instanceId)
  })
})
