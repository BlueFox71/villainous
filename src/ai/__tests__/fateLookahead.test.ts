import { describe, it, expect } from 'vitest'
import { evaluate, lookaheadScore } from '../heuristicBot'
import { applyAction } from '../../engine/actions'
import { createInitialGame } from '../../engine/state'
import { buildDeckInstances } from '../../data/types'
import { laBonneFee } from '../../data/villains/la-bonne-fee'
import { laBonneFeeCards } from '../../data/villains/la-bonne-fee.cards'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import type { GameState } from '../../engine/types'

/**
 * La valeur d'une Fatalité n'apparaît qu'à sa RÉSOLUTION : `FATE` ne fait que dévoiler
 * 2 cartes, donc l'éval statique de l'état obtenu est INCHANGÉE (delta 0). Le pré-tri et
 * le beam élaguaient donc la Fatalité derrière n'importe quel coup à gain immédiat.
 * `lookaheadScore` regarde une résolution plus loin.
 */
describe('IA — la Fatalité est jugée sur sa RÉSOLUTION, pas sur le dévoilement', () => {
  /** La Bonne Fée (bot, joueur 0) au Marais ; Slenderman (joueur 1) a 6 Pages posées
   *  → un Héros posé chez lui lui en fait perdre une (jauge d'objectif en baisse). */
  const scenario = (): GameState => {
    const base = createInitialGame(
      [
        { villain: laBonneFee, deckCards: buildDeckInstances(laBonneFeeCards, 'villain', 'p0:'), fateCards: buildDeckInstances(laBonneFeeCards, 'fate', 'p0f:') },
        { villain: slenderman, deckCards: buildDeckInstances(slendermanCards, 'villain', 'p1:'), fateCards: buildDeckInstances(slendermanCards, 'fate', 'p1f:') },
      ],
      11,
    )
    const pages = base.players[1].deck.filter((c) => c.cardId === 'page').slice(0, 6)
    const locs = base.players[1].locations.map((l) => l.id)
    return {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      players: [
        { ...base.players[0], pawnLocation: 'marais' },
        {
          ...base.players[1],
          deck: base.players[1].deck.filter((c) => !pages.includes(c)),
          board: { ...base.players[1].board, [locs[0]]: pages.slice(0, 3), [locs[1]]: pages.slice(3) },
        },
      ],
    }
  }

  it('l’éval statique ne voit RIEN après le dévoilement, le lookahead voit le gain', () => {
    const s = scenario()
    const before = evaluate(s, 0)
    const afterFate = applyAction(s, { type: 'FATE', actionId: 'fate' })
    // Dévoilement seul : aucun changement de position → même éval.
    expect(evaluate(afterFate, 0)).toBeCloseTo(before, 5)
    // Une résolution plus loin, la Fatalité vaut beaucoup (Page perdue par Slenderman).
    expect(lookaheadScore(afterFate, 0)).toBeGreaterThan(before + 50)
  })

  it('sans choix en attente, le lookahead vaut exactement l’éval statique', () => {
    const s = scenario()
    expect(lookaheadScore(s, 0)).toBeCloseTo(evaluate(s, 0), 5)
  })
})
