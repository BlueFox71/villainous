import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const pacteInst = (): CardInstance =>
  buildDeckInstances(ursulaCards, 'villain', 'pa:').find((c) => c.cardId === 'pacte-navire')!

/** Ursula prête à jouer un Pacte (instanceId 'pa') sur le Roi Triton ('tr') au Rivage. */
function setup(withBigette: boolean): GameState {
  const g = createInitialGame(
    [{ villain: ursula, deckCards: buildDeckInstances(ursulaCards, 'villain', 'u:'), fateCards: buildDeckInstances(ursulaCards, 'fate', 'uf:') }],
    1,
  )
  const pacte = { ...pacteInst(), instanceId: 'pa' }
  const triton: CardInstance = { instanceId: 'tr', cardId: 'roi-triton', name: 'Le Roi Triton', type: 'hero', strength: 6 }
  const rivage: CardInstance[] = [triton]
  if (withBigette) rivage.push({ instanceId: 'bg', cardId: 'bigette', name: 'Bigette Bulbeuse', type: 'item', attach: 'hero', attachedTo: 'tr' })
  return {
    ...g,
    phase: 'ACTION',
    players: [{ ...g.players[0], power: 10, pawnLocation: 'rivage', hand: [pacte], board: { ...g.players[0].board, rivage } }],
  }
}

describe('Bigette Bulbeuse — +3 au coût d’associer un Pacte au Héros porteur', () => {
  it('sans Bigette : le Pacte (coût 2) laisse 8 Pouvoir', () => {
    const s = setup(false)
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pa', to: 'rivage', attachTo: 'tr' })
    expect(after.players[0].power).toBe(8) // 10 − 2
  })

  it('avec Bigette sur le Héros-cible : le Pacte coûte +3 → laisse 5 Pouvoir', () => {
    const s = setup(true)
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pa', to: 'rivage', attachTo: 'tr' })
    expect(after.players[0].power).toBe(5) // 10 − (2 + 3)
  })
})

describe('Roi Triton — +1 au coût d’un Pacte qui le cible', () => {
  it('un Pacte sur le Roi Triton coûte +1 (cumulable avec Bigette)', () => {
    const g = createInitialGame(
      [{ villain: ursula, deckCards: buildDeckInstances(ursulaCards, 'villain', 'u:'), fateCards: buildDeckInstances(ursulaCards, 'fate', 'uf:') }],
      1,
    )
    const pacte = { ...pacteInst(), instanceId: 'pa' }
    // Roi Triton avec sa surcharge réelle (pacteTargetSurcharge: 1).
    const triton: CardInstance = { instanceId: 'tr', cardId: 'roi-triton', name: 'Le Roi Triton', type: 'hero', strength: 6, pacteTargetSurcharge: 1 }
    const base: GameState = {
      ...g,
      phase: 'ACTION',
      players: [{ ...g.players[0], power: 10, pawnLocation: 'rivage', hand: [pacte], board: { ...g.players[0].board, rivage: [triton] } }],
    }
    const after = applyAction(base, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pa', to: 'rivage', attachTo: 'tr' })
    expect(after.players[0].power).toBe(7) // 10 − (2 + 1)
  })
})
