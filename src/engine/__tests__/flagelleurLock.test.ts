import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffects } from '../effects'
import { flagelleurMental, flagelleurMentalCards } from '../../data/published/flagelleurMental'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, Effect, GameState } from '../types'

const FLAYED_EFFECT: Effect = { type: 'FLAYER_FLAYED_UNLOCK', flayedCardId: 'the-flayed', count: 3, locationId: 'monde-envers', willCardId: 'will-byers' }
const flayedInHand = (id: string): CardInstance => ({ instanceId: id, cardId: 'the-flayed', name: 'The Flayed', type: 'ally', cost: 2, strength: 3, effects: [FLAYED_EFFECT] })
const flayedBoard = (id: string): CardInstance => ({ instanceId: id, cardId: 'the-flayed', name: 'The Flayed', type: 'ally', strength: 3 })
const will = (id: string): CardInstance => ({ instanceId: id, cardId: 'will-byers', name: 'Will Byers', type: 'hero', strength: 2 })

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
function setup(board: Record<string, CardInstance[]>, hand: CardInstance[] = []): GameState {
  const base = game()
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({ ...p, power: 5, pawnLocation: 'centre-ville', hand, board: { ...p.board, ...board } })),
  }
}
const locked = (s: GameState) => (s.players[0].lockedLocations ?? []).includes('monde-envers')

describe("Le Flagelleur Mental — verrou du Monde à l'Envers (THE FLAYED / WILL BYERS)", () => {
  it('le Monde à l’Envers démarre verrouillé', () => {
    expect(locked(game())).toBe(true)
  })

  it('poser le 3ᵉ THE FLAYED déverrouille le Monde à l’Envers', () => {
    const s = setup({ 'centre-ville': [flayedBoard('f1'), flayedBoard('f2')] }, [flayedInHand('f3')])
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'f3', to: 'centre-ville' })
    expect(locked(next)).toBe(false)
    expect(next.players[0].flayerGateUnlocked).toBe(true)
  })

  it('poser le 2ᵉ THE FLAYED ne déverrouille pas', () => {
    const s = setup({ 'centre-ville': [flayedBoard('f1')] }, [flayedInHand('f2')])
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'f2', to: 'centre-ville' })
    expect(locked(next)).toBe(true)
    expect(next.players[0].flayerGateUnlocked).toBeFalsy()
  })

  it('WILL BYERS présent : le 3ᵉ FLAYED pose le latch mais ne déverrouille pas', () => {
    const s = setup({ 'centre-ville': [flayedBoard('f1'), flayedBoard('f2'), will('w1')] }, [flayedInHand('f3')])
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'f3', to: 'centre-ville' })
    expect(next.players[0].flayerGateUnlocked).toBe(true)
    expect(locked(next)).toBe(true) // Will maintient le verrou
  })

  it('WILL BYERS (onPlace) verrouille un Monde à l’Envers déjà ouvert', () => {
    const s0 = setup({ 'centre-ville': [] })
    const open: GameState = { ...s0, players: s0.players.map((p) => ({ ...p, flayerGateUnlocked: true, lockedLocations: [] })) }
    const next = resolveEffects(open, [{ type: 'FLAYER_GATE_LOCK', locationId: 'monde-envers' }], { hostInstanceId: 'w1' })
    expect(locked(next)).toBe(true)
  })

  it('WILL BYERS vaincu (onVanquish) redéverrouille si le latch est posé', () => {
    // Latch posé, Will déjà retiré du board, lieu verrouillé → refresh rouvre.
    const s0 = setup({ 'centre-ville': [] })
    const s: GameState = { ...s0, players: s0.players.map((p) => ({ ...p, flayerGateUnlocked: true, lockedLocations: ['monde-envers'] })) }
    const next = resolveEffects(s, [{ type: 'FLAYER_GATE_REFRESH', locationId: 'monde-envers', willCardId: 'will-byers' }], { hostInstanceId: 'w1' })
    expect(locked(next)).toBe(false)
  })

  it('WILL BYERS vaincu SANS latch : le lieu reste verrouillé', () => {
    const s0 = setup({ 'centre-ville': [] })
    const s: GameState = { ...s0, players: s0.players.map((p) => ({ ...p, flayerGateUnlocked: false, lockedLocations: ['monde-envers'] })) }
    const next = resolveEffects(s, [{ type: 'FLAYER_GATE_REFRESH', locationId: 'monde-envers', willCardId: 'will-byers' }], { hostInstanceId: 'w1' })
    expect(locked(next)).toBe(true)
  })

  it('poser le 3ᵉ THE FLAYED via la Condition « Intrus » déverrouille aussi', () => {
    // Régression : jouer un Allié via une Condition (Intrus / Lâcheté…) résout désormais
    // ses effets « à la pose ». Le 3ᵉ THE FLAYED posé gratuitement débloque le lieu.
    const intrus = (id: string): CardInstance => ({
      instanceId: id,
      cardId: 'intrus-dans-le-monde-a-l-envers',
      name: 'Intrus',
      type: 'condition',
      cost: 0,
      trigger: { type: 'opponent-played-ally', requiresOwnAlly: true },
    })
    const base = game()
    const withOpp = createInitialGame(
      [
        { villain: flagelleurMental, deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', 'p0:'), fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', 'p0f:') },
        { villain: flagelleurMental, deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', 'p1:'), fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const hand0 = [intrus('c1'), flayedInHand('f3')]
    const s: GameState = {
      ...withOpp,
      phase: 'ACTION',
      activePlayer: 1,
      activePlayedAllyCount: 1,
      rngState: base.rngState,
      players: withOpp.players.map((p, i) =>
        i === 0
          ? { ...p, hand: hand0, reactableConditionIds: hand0.map((c) => c.instanceId), board: { 'centre-ville': [flayedBoard('f1'), flayedBoard('f2')] } }
          : p,
      ),
    }
    const next = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'c1', allyInstanceId: 'f3', to: 'centre-ville' })
    expect((next.players[0].board['centre-ville'] ?? []).filter((c) => c.cardId === 'the-flayed')).toHaveLength(3)
    expect(next.players[0].flayerGateUnlocked).toBe(true)
    expect(locked(next)).toBe(false)
  })
})
