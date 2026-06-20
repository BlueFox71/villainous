import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { resolveEffects } from '../effects'
import { hasReachedObjective, coveredTopActionIdsAt, movableCards } from '../rules'
import { madameTremaine } from '../../data/villains/madameTremaine'
import { madameTremaineCards } from '../../data/villains/madameTremaine.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: madameTremaine,
        deckCards: buildDeckInstances(madameTremaineCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})
const setBoard = (s: GameState, board: Record<string, CardInstance[]>): GameState => ({
  ...s,
  players: [{ ...s.players[0], board: { ...s.players[0].board, ...board } }],
})

describe('Madame de Trémaine — mise en place', () => {
  it('la Salle de Bal démarre verrouillée et l’objectif est MARRY_PRINCE', () => {
    const s = game()
    expect(s.players[0].lockedLocations).toContain('salle-de-bal')
    expect(s.players[0].objective.type).toBe('MARRY_PRINCE')
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Madame de Trémaine — condition de victoire (mariage)', () => {
  const marrySetup = (extraBallroom: CardInstance[] = [], elsewhere: Record<string, CardInstance[]> = {}) =>
    setBoard(game(), {
      'salle-de-bal': [
        card('ball-gown-anastasia', 'ally', { strength: 4 }),
        card('the-prince', 'hero', { strength: 0 }),
        card('cloches-mariage', 'item'),
        ...extraBallroom,
      ],
      ...elsewhere,
    })

  it('victoire avec fille en robe + Prince + Cloches, sans Pantoufle', () => {
    expect(hasReachedObjective(marrySetup(), 0)).toBe(true)
  })

  it('pas de victoire sans le Prince', () => {
    const s = setBoard(game(), {
      'salle-de-bal': [card('ball-gown-drizella', 'ally', { strength: 4 }), card('cloches-mariage', 'item')],
    })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it('pas de victoire si une Pantoufle de Verre est dans le royaume', () => {
    const s = marrySetup([], { chateau: [card('pantoufle-de-verre', 'item')] })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it('pas de victoire sans les Cloches de Mariage', () => {
    const s = setBoard(game(), {
      'salle-de-bal': [card('ball-gown-anastasia', 'ally', { strength: 4 }), card('the-prince', 'hero', { strength: 0 })],
    })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Madame de Trémaine — Objets clés', () => {
  it('Invitation du Roi déverrouille la Salle de Bal', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'UNLOCK_LOCATION', locationId: 'salle-de-bal' }], { actorIndex: 0 })
    expect(s.players[0].lockedLocations ?? []).not.toContain('salle-de-bal')
  })

  it('la Canne retire toutes les Pantoufles de Verre', () => {
    let s = setBoard(game(), {
      chateau: [card('pantoufle-de-verre', 'item')],
      'chambre-cendrillon': [card('pantoufle-de-verre', 'item')],
    })
    s = resolveEffects(s, [{ type: 'REMOVE_GLASS_SLIPPER' }], { actorIndex: 0 })
    const slippers = Object.values(s.players[0].board).flat().filter((c) => c.cardId === 'pantoufle-de-verre')
    expect(slippers).toHaveLength(0)
  })
})

describe('Madame de Trémaine — Piège & Prince', () => {
  it('TRAP_HERO piège un Héros : il ne recouvre plus d’action', () => {
    let s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 4 })] })
    const heroId = s.players[0].board['chateau'][0].instanceId
    // Avant : Cendrillon recouvre la rangée du haut du Château.
    expect(coveredTopActionIdsAt(s.players[0], 'chateau').size).toBeGreaterThan(0)
    s = resolveEffects(s, [{ type: 'TRAP_HERO' }], { actorIndex: 0, targetHeroId: heroId })
    expect(s.players[0].board['chateau'][0].trapped).toBe(true)
    expect(coveredTopActionIdsAt(s.players[0], 'chateau').size).toBe(0)
  })

  it('le Prince ne recouvre aucune action et est déplaçable', () => {
    let s = setBoard(game(), { chateau: [card('the-prince', 'hero', { strength: 0 })] })
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'chateau' }] }
    expect(coveredTopActionIdsAt(s.players[0], 'chateau').size).toBe(0)
    expect(movableCards(s).some((m) => m.from === 'chateau')).toBe(true)
  })
})
