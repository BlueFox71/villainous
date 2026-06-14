import { describe, it, expect } from 'vitest'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame, syncObservatoryLock } from '../state'
import { hasReachedObjective } from '../rules'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [{ villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') }],
    7,
  )
}

const peach = (): CardInstance => ({ instanceId: 'h-peach', cardId: 'peach', name: 'Peach', type: 'hero', strength: 2 })
const mario = (): CardInstance => ({ instanceId: 'h-mario', cardId: 'mario', name: 'Mario', type: 'hero', strength: 4 })

describe('Bowser — Étoiles & objectif', () => {
  it("démarre avec 4 Étoiles à l'Observatoire, lieu non verrouillé", () => {
    const s = game()
    const p = s.players[0]
    expect(p.observatoryStars).toBe(4)
    expect(p.starLocationId).toBe('observatoire')
    expect(p.lockedLocations ?? []).not.toContain('observatoire')
  })

  it("verrouille dynamiquement l'Observatoire à 0 Étoile, le déverrouille dès 1", () => {
    const s = game()
    const depleted = syncObservatoryLock({ ...s.players[0], observatoryStars: 0 })
    expect(depleted.lockedLocations ?? []).toContain('observatoire')
    const refilled = syncObservatoryLock({ ...depleted, observatoryStars: 1 })
    expect(refilled.lockedLocations ?? []).not.toContain('observatoire')
  })

  it('objectif atteint seulement si 0 Étoile + Peach capturée + pas de Mario', () => {
    const base = game()
    // Observatoire épuisé + Peach capturée → victoire.
    const won: GameState = {
      ...base,
      players: [{ ...base.players[0], observatoryStars: 0, peachCaptured: true }],
    }
    expect(hasReachedObjective(won)).toBe(true)

    // Étoiles restantes → pas de victoire.
    expect(
      hasReachedObjective({ ...won, players: [{ ...won.players[0], observatoryStars: 1 }] }),
    ).toBe(false)

    // Peach non capturée → pas de victoire.
    expect(
      hasReachedObjective({ ...won, players: [{ ...won.players[0], peachCaptured: false }] }),
    ).toBe(false)

    // Mario présent → victoire bloquée même si tout le reste est rempli.
    const withMario: GameState = {
      ...won,
      players: [{ ...won.players[0], board: { ...won.players[0].board, 'chateau-peach': [mario()] } }],
    }
    expect(hasReachedObjective(withMario)).toBe(false)
  })

  it('Peach présente sans capture ne suffit pas', () => {
    const base = game()
    const s: GameState = {
      ...base,
      players: [
        {
          ...base.players[0],
          observatoryStars: 0,
          peachCaptured: false,
          board: { ...base.players[0].board, 'chateau-peach': [peach()] },
        },
      ],
    }
    expect(hasReachedObjective(s)).toBe(false)
  })
})
