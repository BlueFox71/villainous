import { describe, it, expect } from 'vitest'
import { evaluate } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { imposteur } from '../../data/villains/imposteur'
import { imposteurCards } from '../../data/villains/imposteur.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState, CardInstance } from '../../engine/types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p0:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p0f:') },
      { villain: imposteur, deckCards: buildDeckInstances(imposteurCards, 'villain', 'p1:'), fateCards: buildDeckInstances(imposteurCards, 'fate', 'p1f:') },
    ],
    1,
  )
}

const sabotage = (turns: number): CardInstance => ({
  instanceId: 'sab', cardId: 'reacteur-sabotage', name: 'Sabotage', type: 'item', isSabotage: true, sabotageTurns: turns,
})

/** Avec ce Sabotage posé sur le plateau de l'Imposteur (joueur 1), évalue la
 *  position du bot (joueur 0). Plus le Sabotage tient, plus c'est mauvais pour lui. */
function evalWithSabotage(turns: number | null): number {
  const base = game()
  const board = turns === null ? base.players[1].board : { ...base.players[1].board, admin: [sabotage(turns)] }
  const s: GameState = { ...base, players: [base.players[0], { ...base.players[1], board }] }
  return evaluate(s, 0)
}

describe("le bot anticipe la menace de l'Imposteur (Sabotage)", () => {
  it('évalue sa position de plus en plus mauvaise quand le Sabotage approche de la victoire', () => {
    const noSab = evalWithSabotage(null)
    const placed = evalWithSabotage(0)
    const held1 = evalWithSabotage(1)
    const held2 = evalWithSabotage(2)
    // Poser le Sabotage est déjà une menace ; chaque tour tenu aggrave la position du bot.
    expect(placed).toBeLessThan(noSab)
    expect(held1).toBeLessThan(placed)
    expect(held2).toBeLessThan(held1)
  })
})
