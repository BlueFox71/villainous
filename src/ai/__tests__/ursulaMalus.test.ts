import { describe, it, expect } from 'vitest'
import { playerMalus } from '../fateMalus'
import { createInitialGame } from '../../engine/state'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

const card = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

/** GameState à 1 joueur Ursula, avec un plateau injecté (par lieu). */
function ursulaState(board: Record<string, CardInstance[]>): GameState {
  const g = createInitialGame(
    [
      {
        villain: ursula,
        deckCards: buildDeckInstances(ursulaCards, 'villain', 'u:'),
        fateCards: buildDeckInstances(ursulaCards, 'fate', 'uf:'),
      },
    ],
    1,
  )
  return { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, ...board } }] }
}

describe('playerMalus — Ariel/Sébastien conditionnels (Ursula)', () => {
  it('Ariel sature le malus quand un Objet-clé est exposé sur un lieu déverrouillé', () => {
    const ariel = card({ cardId: 'ariel', type: 'hero', strength: 4 })
    const couronne = card({ cardId: 'couronne', type: 'item' })
    // Repaire (déverrouillé) porte la Couronne → Ariel = block-win → malus saturé.
    expect(playerMalus(ursulaState({ navire: [ariel], repaire: [couronne] }), 0)).toBe(1)
  })

  it('Ariel ne vaut qu’un faible malus quand aucun Objet n’est exposé', () => {
    const ariel = card({ cardId: 'ariel', type: 'hero', strength: 4 })
    const m = playerMalus(ursulaState({ navire: [ariel] }), 0)
    expect(m).toBeGreaterThan(0)
    expect(m).toBeLessThan(0.2) // slow seul (≈ 1/12), loin du block-win
  })

  it('Sébastien n’ajoute de malus que si un Pacte est associé à un Héros', () => {
    const seb = card({ cardId: 'sebastien', type: 'hero', strength: 2 })
    const triton = card({ cardId: 'roi-triton', type: 'hero', strength: 6 })
    const pacte = card({ cardId: 'pacte-navire', type: 'item', attachedTo: triton.instanceId })
    const sans = playerMalus(ursulaState({ rivage: [seb], navire: [triton] }), 0)
    const avec = playerMalus(ursulaState({ rivage: [seb], navire: [triton, pacte] }), 0)
    expect(avec).toBeGreaterThan(sans) // le Pacte rend Sébastien gênant
  })
})
