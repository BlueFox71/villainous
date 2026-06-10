// Utilitaires partagés par les tests du moteur (multi-joueurs).
import { createInitialGame } from '../state'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState, PlayerState } from '../types'

/** Partie à 1 joueur (Prince Jean) — pratique pour tester une mécanique isolée. */
export const singleGame = (seed = 12345): GameState =>
  createInitialGame(
    [
      {
        villain: princeJohn,
        deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

/** Partie à 2 joueurs (Prince Jean ×2, placeholder). */
export const twoPlayerGame = (seed = 12345): GameState =>
  createInitialGame(
    [
      {
        villain: { ...princeJohn, name: 'PJ1' },
        deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p0f:'),
      },
      {
        villain: { ...princeJohn, name: 'PJ2' },
        deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'),
        fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:'),
      },
    ],
    seed,
  )

/** Le joueur actif. */
export const me = (s: GameState): PlayerState => s.players[s.activePlayer]

/** Renvoie un nouvel état où le joueur actif reçoit `patch`. */
export function withActive(s: GameState, patch: Partial<PlayerState>): GameState {
  return {
    ...s,
    players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, ...patch } : p)),
  }
}
