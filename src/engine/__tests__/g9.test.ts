import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { createInitialGame } from '../state'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'
import { twoPlayerGame } from './_helpers'

function maleficentGame(seed = 7): GameState {
  return createInitialGame(
    [
      {
        villain: maleficent,
        deckCards: buildDeckInstances(maleficentCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(maleficentCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )
}

describe('G.9 — showcases des effets déclenchés automatiquement', () => {
  it('Aurore : le Héros révélé attend un placement, puis émet le showcase « vol »', () => {
    const hero: CardInstance = {
      instanceId: 'p0f:hero', cardId: 'roi-hubert', name: 'Roi Hubert', type: 'hero', strength: 3,
    }
    let s = maleficentGame()
    // Place un Héros en tête de la pioche Fatalité de Maléfique.
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, fateDeck: [hero, ...p.fateDeck] } : p)) }
    s = resolveEffect(s, { type: 'REVEAL_FATE_TOP_PLAY_IF_HERO' }, { actorIndex: 0, hostLocationId: 'mountains' })
    // Le Héros révélé est EN ATTENTE de placement (pas encore posé, pas de showcase).
    expect(s.pendingHeroPlacement?.hero.instanceId).toBe('p0f:hero')
    expect(s.pendingHeroPlacement?.targetIndex).toBe(0)
    expect(s.players[0].board['mountains']?.some((c) => c.instanceId === 'p0f:hero')).toBeFalsy()
    // Le joueur choisit le lieu → pose + showcase « vol ».
    s = applyAction(s, { type: 'RESOLVE_HERO_PLACEMENT', locationId: 'mountains' })
    expect(s.pendingHeroPlacement).toBeUndefined()
    expect(s.players[0].board['mountains'].some((c) => c.instanceId === 'p0f:hero')).toBe(true)
    const ev = s.showcaseEvents.find((e) => e.cardId === 'roi-hubert' && e.destination)
    expect(ev?.destination).toEqual({ playerIndex: 0, locationId: 'mountains' })
    expect(ev?.cardInstanceId).toBe('p0f:hero')
  })

  it('Apparence de Dragon : la récompense (+3 JT à la Fatalité) émet un showcase', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, dragonFormReward: true } : p)) }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    const dragon = s.showcaseEvents.find((e) => e.cardId === 'apparence-dragon')
    expect(dragon).toBeDefined()
    expect(dragon?.playerIndex).toBe(1)
    // La cible a bien gagné les 3 JT.
    expect(s.players[1].power).toBe(1 + 3) // J1 démarre à 1 JT
  })

  it('Apparence de Dragon : infliger une Fatalité (mode test) déclenche +3 JT si armée', () => {
    let s = maleficentGame()
    const before = s.players[0].power
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, dragonFormReward: true } : p)) }
    const hero: CardInstance = {
      instanceId: 'p0f:h', cardId: 'roi-hubert', name: 'Roi Hubert', type: 'hero', strength: 3,
    }
    s = applyAction(s, { type: 'TEST_PLACE_FATE', card: hero, to: 'mountains' })
    expect(s.players[0].power).toBe(before + 3)
    expect(s.players[0].dragonFormReward).toBeFalsy()
  })
})
