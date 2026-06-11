import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { conditionIsTriggered } from '../rules'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const tromperie = (): CardInstance => ({
  instanceId: 'tromp1',
  cardId: 'tromperie',
  name: 'Tromperie',
  type: 'condition',
  cost: 0,
  trigger: { type: 'opponent-items-in-realm-ge', value: 2 },
})
const curse = (id: string): CardInstance => ({ instanceId: id, cardId: 'feu-infernal', name: 'Feu Infernal', type: 'curse' })
const hero = (id: string): CardInstance => ({ instanceId: id, cardId: 'flora', name: 'Flora', type: 'hero', strength: 2 })

/** Partie Jafar (p0) vs Maléfique (p1) ; c'est le tour de Maléfique. */
function setup(): GameState {
  const base = createInitialGame(
    [
      { villain: jafar, deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'), fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:') },
      { villain: maleficent, deckCards: buildDeckInstances(maleficentCards, 'villain', 'p1:'), fateCards: buildDeckInstances(maleficentCards, 'fate', 'p1f:') },
    ],
    11,
  )
  return {
    ...base,
    activePlayer: 1,
    phase: 'ACTION',
    players: base.players.map((p, i) => {
      if (i === 0) return { ...p, hand: [tromperie()] }
      // Maléfique : 2 Malédictions (comptent comme Objets) + un Héros en tête de Fatalité.
      const locs = p.locations.map((l) => l.id)
      return {
        ...p,
        board: { ...p.board, [locs[0]]: [curse('c1')], [locs[1]]: [curse('c2')] },
        fateDeck: [hero('h1'), ...p.fateDeck],
      }
    }),
  }
}

describe('Jafar — Tromperie', () => {
  it('les Malédictions comptent comme Objets → déclencheur satisfait', () => {
    const s = setup()
    expect(conditionIsTriggered(s, tromperie(), 0)).toBe(true)
  })

  it('révèle le Héros adverse et laisse Jafar choisir où le poser', () => {
    const s = setup()
    const next = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'tromp1' })
    // Placement en attente : Jafar (chooser) choisit le lieu chez Maléfique (target).
    expect(next.pendingHeroPlacement?.chooserIndex).toBe(0)
    expect(next.pendingHeroPlacement?.targetIndex).toBe(1)
    expect(next.pendingHeroPlacement?.hero.instanceId).toBe('h1')
    // La carte Tromperie est partie en défausse de Jafar.
    expect(next.players[0].discard.some((c) => c.cardId === 'tromperie')).toBe(true)
    // Après résolution, le Héros est posé sur le lieu choisi (chez Maléfique).
    const to = next.players[1].locations[2].id
    const done = applyAction(next, { type: 'RESOLVE_HERO_PLACEMENT', locationId: to })
    expect((done.players[1].board[to] ?? []).some((c) => c.instanceId === 'h1')).toBe(true)
  })
})
