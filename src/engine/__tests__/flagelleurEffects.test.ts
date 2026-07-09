import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffects } from '../effects'
import { playableConditions } from '../rules'
import { flagelleurMental, flagelleurMentalCards } from '../../data/published/flagelleurMental'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const demo = (id: string): CardInstance => ({ instanceId: id, cardId: 'demogorgon', name: 'Démogorgon', type: 'ally', strength: 4, powerOnMove: 1 })
const vignes = (id: string): CardInstance => ({ instanceId: id, cardId: 'vignes', name: 'Vignes', type: 'ally', strength: 1 })
const froid = (id: string): CardInstance => ({ instanceId: id, cardId: 'froid', name: 'Froid', type: 'item' })

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
function setup(board: Record<string, CardInstance[]>, pawn = 'starcourt'): GameState {
  const base = game()
  return { ...base, phase: 'ACTION', players: base.players.map((p) => ({ ...p, power: 3, pawnLocation: pawn, board: { ...p.board, ...board } })) }
}

describe('Le Flagelleur Mental — effets 2e (Démogorgon / Chaleur / Will sous emprise)', () => {
  it('DÉMOGORGON : +1 Pouvoir à chaque déplacement', () => {
    const s = setup({ starcourt: [demo('d1')] }, 'starcourt')
    const next = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'd1', to: 'laboratoire' })
    expect((next.players[0].board['laboratoire'] ?? []).some((c) => c.instanceId === 'd1')).toBe(true)
    expect(next.players[0].power).toBe(4) // 3 + 1
  })

  it('CHALEUR : le fataliseur défausse un ALLIÉ (pas un Objet)', () => {
    const s = setup({ 'centre-ville': [vignes('a1'), froid('i1')] })
    const next = resolveEffects(s, [{ type: 'DISCARD_ALLY_OR_ITEM', onlyType: 'ally', cardName: 'Chaleur' }])
    // L'unique Allié est défaussé ; l'Objet reste.
    const cell = next.players[0].board['centre-ville'] ?? []
    expect(cell.some((c) => c.cardId === 'vignes')).toBe(false)
    expect(cell.some((c) => c.cardId === 'froid')).toBe(true)
    expect(next.players[0].discard.some((c) => c.cardId === 'vignes')).toBe(true)
  })

  it('CHALEUR : avec 2 Alliés, ouvre le choix (Objet exclu des candidats)', () => {
    const s = setup({ 'centre-ville': [vignes('a1'), vignes('a2'), froid('i1')] })
    const next = resolveEffects(s, [{ type: 'DISCARD_ALLY_OR_ITEM', onlyType: 'ally', cardName: 'Chaleur' }])
    const pend = next.pendingFateDiscardAlly
    expect(pend).toBeTruthy()
    expect(pend?.candidateIds.sort()).toEqual(['a1', 'a2'])
  })

  it('WILL SOUS EMPRISE : ouvre la réorganisation interactive du deck Méchant (4 cartes)', () => {
    const s = setup({})
    const before = s.players[0].deck.length
    const next = resolveEffects(s, [{ type: 'FLAYER_WILL_SCRY', count: 4 }])
    expect(next.pendingFateReorder?.deck).toBe('villain')
    expect(next.pendingFateReorder?.cards).toHaveLength(4)
    expect(next.players[0].deck.length).toBe(before - 4)
  })
})

const intrus = (id: string): CardInstance => ({
  instanceId: id,
  cardId: 'intrus-dans-le-monde-a-l-envers',
  name: 'Intrus',
  type: 'condition',
  cost: 0,
  trigger: { type: 'opponent-played-ally', requiresOwnAlly: true },
})

/** Jeu à 2 joueurs (le Flagelleur en position 0), l'adversaire (1) actif ayant joué un Allié. */
function twoPlayer(hand0: CardInstance[]): GameState {
  const mk = (prefix: string) => ({
    villain: flagelleurMental,
    deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', prefix),
    fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', prefix + 'f:'),
  })
  const base = createInitialGame([mk('p0:'), mk('p1:')], 7)
  return {
    ...base,
    phase: 'ACTION',
    activePlayer: 1,
    activePlayedAllyCount: 1,
    players: base.players.map((p, i) =>
      i === 0
        ? { ...p, hand: hand0, reactableConditionIds: hand0.map((c) => c.instanceId), board: {} }
        : p,
    ),
  }
}

describe('Le Flagelleur Mental — INTRUS DANS LE MONDE À L’ENVERS (condition)', () => {
  it('jouable seulement si le Flagelleur a un Allié en main', () => {
    const withAlly = twoPlayer([intrus('c1'), vignes('a1')])
    expect(playableConditions(withAlly, 0).some((c) => c.instanceId === 'c1')).toBe(true)
    const noAlly = twoPlayer([intrus('c1')])
    expect(playableConditions(noAlly, 0).some((c) => c.instanceId === 'c1')).toBe(false)
  })

  it('pose l’Allié gratuitement PUIS pioche une carte', () => {
    const s = twoPlayer([intrus('c1'), vignes('a1')])
    const deckBefore = s.players[0].deck.length
    const next = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'c1', allyInstanceId: 'a1', to: 'centre-ville' })
    // Vignes posée gratuitement sur le lieu choisi.
    expect((next.players[0].board['centre-ville'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true)
    // Intrus est partie en défausse ; une carte a été piochée (deck −1).
    expect(next.players[0].discard.some((c) => c.cardId === 'intrus-dans-le-monde-a-l-envers')).toBe(true)
    expect(next.players[0].deck.length).toBe(deckBefore - 1)
  })
})
