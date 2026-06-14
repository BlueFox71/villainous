import { describe, it, expect } from 'vitest'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import { resolveEffects } from '../effects'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [{ villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') }],
    7,
  )
}

const ally = (id: string, stars = 0): CardInstance => ({
  instanceId: id,
  cardId: 'dino-piranha',
  name: 'Dino Piranha',
  type: 'ally',
  strength: 2,
  stars: stars || undefined,
})
const peach = (): CardInstance => ({ instanceId: 'h-peach', cardId: 'peach', name: 'Peach', type: 'hero', strength: 2 })

describe('Bowser — effets Étoiles', () => {
  it("RETURN_STAR_TO_OBSERVATORY reprend l'Étoile d'un Allié, incrémente l'Observatoire et resync le verrou", () => {
    const base = game()
    const a = ally('a1', 1) // Allié porteur d'1 Étoile
    // Observatoire épuisé (verrouillé) : reprendre l'Étoile de l'Allié le déverrouille.
    const start: GameState = {
      ...base,
      players: [{
        ...base.players[0],
        observatoryStars: 0,
        lockedLocations: ['observatoire'],
        pawnLocation: 'galaxies',
        board: { ...base.players[0].board, galaxies: [a] },
      }],
    }
    const after = resolveEffects(start, [{ type: 'RETURN_STAR_TO_OBSERVATORY', amount: 1 }])
    expect(after.players[0].observatoryStars).toBe(1)
    expect(after.players[0].board.galaxies[0].stars ?? 0).toBe(0) // retirée de l'Allié
    expect(after.players[0].lockedLocations ?? []).not.toContain('observatoire')
  })

  it("RETURN_STAR_TO_OBSERVATORY ne fait rien si aucun Allié n'a d'Étoile (Étoile hors-jeu)", () => {
    const base = game()
    const a = ally('a1', 0) // Allié sans Étoile
    const start: GameState = {
      ...base,
      players: [{ ...base.players[0], observatoryStars: 0, board: { ...base.players[0].board, galaxies: [a] } }],
    }
    const after = resolveEffects(start, [{ type: 'RETURN_STAR_TO_OBSERVATORY', amount: 1 }])
    expect(after.players[0].observatoryStars).toBe(0) // no-op
  })

  it('LOSE_POWER retire du pouvoir (plancher 0)', () => {
    const base = game()
    const start: GameState = { ...base, players: [{ ...base.players[0], power: 1 }] }
    const after = resolveEffects(start, [{ type: 'LOSE_POWER', amount: 2 }])
    expect(after.players[0].power).toBe(0)
  })

  it("DRAIN_STAR_TO_ALLY déplace une Étoile de l'Observatoire vers un Allié SUR l'Observatoire", () => {
    const base = game()
    const start: GameState = {
      ...base,
      players: [{
        ...base.players[0],
        pawnLocation: 'galaxies',
        observatoryStars: 4,
        board: { ...base.players[0].board, observatoire: [ally('a1')] },
      }],
    }
    const after = resolveEffects(start, [{ type: 'DRAIN_STAR_TO_ALLY' }], { allyInstanceIds: ['a1'] })
    expect(after.players[0].observatoryStars).toBe(3)
    expect(after.players[0].board.observatoire[0].stars).toBe(1)
  })

  it('DRAIN_STAR_TO_ALLY épuise et verrouille quand la dernière Étoile part', () => {
    const base = game()
    const start: GameState = {
      ...base,
      players: [{
        ...base.players[0],
        pawnLocation: 'galaxies',
        observatoryStars: 1,
        board: { ...base.players[0].board, observatoire: [ally('a1')] },
      }],
    }
    const after = resolveEffects(start, [{ type: 'DRAIN_STAR_TO_ALLY' }], { allyInstanceIds: ['a1'] })
    expect(after.players[0].observatoryStars).toBe(0)
    expect(after.players[0].lockedLocations ?? []).toContain('observatoire')
  })

  it('Luigi (DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST) défausse les Alliés et renvoie leurs Étoiles', () => {
    const base = game()
    const start: GameState = {
      ...base,
      players: [{
        ...base.players[0],
        observatoryStars: 0,
        board: { ...base.players[0].board, galaxies: [ally('a1', 2), ally('a2')] },
      }],
    }
    const after = resolveEffects(start, [{ type: 'DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST' }], { hostLocationId: 'galaxies' })
    expect(after.players[0].board.galaxies).toHaveLength(0)
    expect(after.players[0].discard.filter((c) => c.cardId === 'dino-piranha')).toHaveLength(2)
    expect(after.players[0].observatoryStars).toBe(2)
  })

  it('CAPTURE_PEACH pose le drapeau et retire Peach du plateau', () => {
    const base = game()
    const start: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, 'chateau-peach': [peach()] } }],
    }
    const after = resolveEffects(start, [{ type: 'CAPTURE_PEACH', peachCardId: 'peach' }])
    expect(after.players[0].peachCaptured).toBe(true)
    expect(after.players[0].board['chateau-peach']).toHaveLength(0)
    expect(after.players[0].fateDiscard.some((c) => c.cardId === 'peach')).toBe(true)
  })

  it("CAPTURE_PEACH sans Peach en jeu ne pose pas le drapeau", () => {
    const after = resolveEffects(game(), [{ type: 'CAPTURE_PEACH', peachCardId: 'peach' }])
    expect(after.players[0].peachCaptured).toBeFalsy()
  })

  it("Harmonie empêche le drain de la dernière Étoile de l'Observatoire", () => {
    const base = game()
    const harmonie: CardInstance = { instanceId: 'h-harm', cardId: 'harmonie', name: 'Harmonie', type: 'hero', strength: 3 }
    const start: GameState = {
      ...base,
      players: [{
        ...base.players[0],
        pawnLocation: 'galaxies',
        observatoryStars: 1,
        board: { ...base.players[0].board, observatoire: [ally('a1')], 'chateau-peach': [harmonie] },
      }],
    }
    const after = resolveEffects(start, [{ type: 'DRAIN_STAR_TO_ALLY' }], { allyInstanceIds: ['a1'] })
    expect(after.players[0].observatoryStars).toBe(1) // bloqué
    expect(after.players[0].board.observatoire[0].stars).toBeFalsy()
  })

  it("Harmonie ne bloque pas s'il reste plus d'une Étoile", () => {
    const base = game()
    const harmonie: CardInstance = { instanceId: 'h-harm', cardId: 'harmonie', name: 'Harmonie', type: 'hero', strength: 3 }
    const start: GameState = {
      ...base,
      players: [{
        ...base.players[0],
        pawnLocation: 'galaxies',
        observatoryStars: 2,
        board: { ...base.players[0].board, observatoire: [ally('a1')], 'chateau-peach': [harmonie] },
      }],
    }
    const after = resolveEffects(start, [{ type: 'DRAIN_STAR_TO_ALLY' }], { allyInstanceIds: ['a1'] })
    expect(after.players[0].observatoryStars).toBe(1)
    expect(after.players[0].board.observatoire[0].stars).toBe(1)
  })

  it('DISCARD_ONE_ITEM (Comète farceuse) défausse un Objet du royaume', () => {
    const base = game()
    const item: CardInstance = { instanceId: 'i1', cardId: 'bateau', name: 'Bateau', type: 'item' }
    const start: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, galaxies: [item] } }],
    }
    const after = resolveEffects(start, [{ type: 'DISCARD_ONE_ITEM' }])
    expect(after.players[0].board.galaxies).toHaveLength(0)
    expect(after.players[0].discard.some((c) => c.instanceId === 'i1')).toBe(true)
  })
})
