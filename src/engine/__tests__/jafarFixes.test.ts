import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { sacrificeableCards } from '../rules'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function jafarGame(): GameState {
  return createInitialGame(
    [{ villain: jafar, deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'), fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:') }],
    5,
  )
}

const lampe = (): CardInstance => ({
  instanceId: 'lampe1',
  cardId: 'lampe-merveilleuse',
  name: 'Lampe Merveilleuse',
  type: 'item',
  cost: 4,
  attach: 'location',
  playOnlyAt: 'caverne',
  effects: [{ type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'genie', locationId: 'caverne' }],
})

describe('Jafar — Lampe Merveilleuse : Caverne uniquement', () => {
  it('refuse une pose hors de la Caverne', () => {
    const base = jafarGame()
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p) => ({ ...p, power: 4, pawnLocation: 'rues', hand: [lampe()], lockedLocations: [] })),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'lampe1', to: 'rues' }),
    ).toThrow()
  })

  it('accepte la pose à la Caverne (déverrouillée)', () => {
    const base = jafarGame()
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p) => ({ ...p, power: 4, pawnLocation: 'rues', hand: [lampe()], lockedLocations: [] })),
    }
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'lampe1', to: 'caverne' })
    expect((next.players[0].board['caverne'] ?? []).some((c) => c.cardId === 'lampe-merveilleuse')).toBe(true)
  })
})

describe('Jafar — Sacrifice Nécessaire : objet associé défaussable', () => {
  it('un Objet associé à un Allié est sacrifiable et part seul', () => {
    const base = jafarGame()
    const ally: CardInstance = { instanceId: 'a1', cardId: 'garde-palais', name: 'Garde', type: 'ally', strength: 2 }
    const item: CardInstance = { instanceId: 'cim1', cardId: 'cimeterre', name: 'Cimeterre', type: 'item', attach: 'ally', attachedTo: 'a1' }
    const sac: CardInstance = { instanceId: 'sac1', cardId: 'sacrifice-necessaire', name: 'Sacrifice', type: 'effect', cost: 0, effects: [{ type: 'DISCARD_OWN_FOR_POWER', amount: 3 }] }
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p) => ({ ...p, power: 0, pawnLocation: 'rues', hand: [sac], board: { ...p.board, rues: [ally, item] } })),
    }
    expect(sacrificeableCards(s).some((c) => c.instanceId === 'cim1')).toBe(true)
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'sac1', allyInstanceIds: ['cim1'] })
    const rues = next.players[0].board['rues'] ?? []
    expect(rues.some((c) => c.instanceId === 'cim1')).toBe(false) // l'objet est parti
    expect(rues.some((c) => c.instanceId === 'a1')).toBe(true) // l'allié reste
    expect(next.players[0].power).toBe(3)
  })
})

describe('Slenderman — Mauvaise creepypasta', () => {
  it('ramène le pouvoir de la cible à 2 s’il est supérieur', () => {
    const base = createInitialGame(
      [
        { villain: slenderman, deckCards: buildDeckInstances(slendermanCards, 'villain', 'p0:'), fateCards: buildDeckInstances(slendermanCards, 'fate', 'p0f:') },
        { villain: jafar, deckCards: buildDeckInstances(jafarCards, 'villain', 'p1:'), fateCards: buildDeckInstances(jafarCards, 'fate', 'p1f:') },
      ],
      3,
    )
    const creepy: CardInstance = { instanceId: 'cr1', cardId: 'mauvaise-creepypasta', name: 'Mauvaise creepypasta', type: 'effect' }
    // Jafar (joueur actif, index 1) joue la Fatalité contre Slenderman (cible 0, 7 JT).
    const s: GameState = {
      ...base,
      activePlayer: 1,
      phase: 'ACTION',
      players: base.players.map((p, i) => (i === 0 ? { ...p, power: 7 } : p)),
      pendingFate: { target: 0, revealed: [creepy] },
    }
    const next = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'cr1' })
    expect(next.players[0].power).toBe(2)
  })
})
