import { describe, it, expect } from 'vitest'
import { pendingOwner, whoseInput } from '../turn'
import { twoPlayerGame } from './_helpers'
import type { CardInstance, GameState } from '../types'

// Exemplaire factice minimal (les helpers pending n'inspectent que l'index).
const dummyCard: CardInstance = {
  instanceId: 'x', cardId: 'gardes-rhinoceros', name: 'X', type: 'ally', cost: 0,
}

describe('pendingOwner / whoseInput', () => {
  it('sans pending : la main est au joueur actif', () => {
    const s: GameState = { ...twoPlayerGame(), activePlayer: 1 }
    expect(pendingOwner(s)).toBeNull()
    expect(whoseInput(s)).toBe(1)
  })

  it('pending chooserIndex : la main revient à celui qui a joué la Fatalité, pas à activePlayer', () => {
    const base = twoPlayerGame()
    // Joueur actif = 0, mais le placement de Héros est choisi par chooserIndex = 0
    // contre la cible 1 (cas Aurore depuis le tour du joueur 0).
    const s: GameState = {
      ...base,
      activePlayer: 0,
      pendingHeroPlacement: { chooserIndex: 0, targetIndex: 1, hero: dummyCard },
    }
    expect(pendingOwner(s)).toBe(0)
    expect(whoseInput(s)).toBe(0)
  })

  it('pending playerIndex : peut désigner l\'adversaire du joueur actif', () => {
    const base = twoPlayerGame()
    // Joueur actif = 0 a infligé une Tyrannie au joueur 1 : c'est à 1 de défausser.
    const s: GameState = {
      ...base,
      activePlayer: 0,
      pendingTyrannyDiscard: { playerIndex: 1, count: 2 },
    }
    expect(pendingOwner(s)).toBe(1)
    expect(whoseInput(s)).toBe(1)
  })

  it('reconnaît les pending pilotés par chooserIndex et par playerIndex', () => {
    const base = twoPlayerGame()
    const byChooser: GameState = {
      ...base, activePlayer: 1,
      pendingFateChoice: { chooserIndex: 1, targetIndex: 0, kind: 'remove-ally', candidateIds: [] },
    }
    expect(whoseInput(byChooser)).toBe(1)

    const byPlayer: GameState = {
      ...base, activePlayer: 0,
      pendingDeckPeek: { playerIndex: 1, card: dummyCard },
    }
    expect(whoseInput(byPlayer)).toBe(1)
  })
})
