import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { activatableCards } from '../rules'
import { flagelleurMental } from '../../data/villains/flagelleur-mental'
import { flagelleurMentalCards } from '../../data/villains/flagelleur-mental.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, Effect, GameState } from '../types'

const FETCH: Effect = { type: 'FLAYER_FETCH_ONZE', heroCardId: 'onze', blockerHeroCardId: 'max-mayfield' }
const billy = (id: string): CardInstance => ({ instanceId: id, cardId: 'billy-sous-emprise', name: 'Billy', type: 'ally', strength: 3, cannotDiscardForTunnel: true, activatedCost: 3, activatedEffects: [FETCH] })
const onze = (id: string): CardInstance => ({ instanceId: id, cardId: 'onze', name: 'Onze', type: 'hero', strength: 5 })
const max = (id: string): CardInstance => ({ instanceId: id, cardId: 'max-mayfield', name: 'Max', type: 'hero', strength: 3 })

function game(): GameState {
  return createInitialGame(
    [
      {
        villain: flagelleurMental,
        deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
}

/** Pion au Monde à l'Envers (déverrouillé) — seul lieu portant l'action ACTIVER. */
function setup(opts: { board?: Record<string, CardInstance[]>; fateDeck?: CardInstance[]; power?: number } = {}): GameState {
  const base = game()
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      power: opts.power ?? 3,
      pawnLocation: 'monde-envers',
      lockedLocations: (p.lockedLocations ?? []).filter((l) => l !== 'monde-envers'),
      fateDeck: opts.fateDeck ?? [onze('od'), ...p.fateDeck.filter((c) => c.cardId !== 'onze')],
      board: { ...p.board, ...(opts.board ?? {}) },
    })),
  }
}

describe('Le Flagelleur Mental — BILLY va chercher ONZE (bloqué par MAX)', () => {
  it('Billy est activable si Onze est dans la Fatalité et Max absente', () => {
    const s = setup({ board: { 'monde-envers': [billy('b1')] } })
    expect(activatableCards(s).some((c) => c.instanceId === 'b1')).toBe(true)
  })

  it('activer Billy pose ONZE sur le lieu de Billy (retirée de la Fatalité, −3 Pouvoir)', () => {
    const s = setup({ board: { 'monde-envers': [billy('b1')] }, power: 3 })
    const next = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'b1' })
    const cell = next.players[0].board['monde-envers'] ?? []
    expect(cell.some((c) => c.cardId === 'onze' && c.type === 'hero')).toBe(true)
    expect(next.players[0].fateDeck.some((c) => c.cardId === 'onze')).toBe(false)
    expect(next.players[0].power).toBe(0)
  })

  it('MAX présente : Billy n’est PAS activable, et l’activation échoue', () => {
    const s = setup({ board: { 'monde-envers': [billy('b1')], 'centre-ville': [max('m1')] } })
    expect(activatableCards(s).some((c) => c.instanceId === 'b1')).toBe(false)
    expect(() => applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'b1' })).toThrow()
  })

  it('ONZE déjà dans le royaume : Billy n’est plus activable', () => {
    const s = setup({ board: { 'monde-envers': [billy('b1'), onze('o1')] } })
    expect(activatableCards(s).some((c) => c.instanceId === 'b1')).toBe(false)
  })

  it('ONZE absente de la Fatalité : Billy n’est pas activable', () => {
    const s = setup({ board: { 'monde-envers': [billy('b1')] }, fateDeck: [] })
    expect(activatableCards(s).some((c) => c.instanceId === 'b1')).toBe(false)
  })
})
