import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { alliesCannotMove } from '../rules'
import { createInitialGame } from '../state'
import { madameTremaine } from '../../data/villains/madameTremaine'
import { madameTremaineCards } from '../../data/villains/madameTremaine.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../types'

const C = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

function tremaine(board: Record<string, CardInstance[]>): GameState {
  const g = createInitialGame(
    [{ villain: madameTremaine, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 't:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'tf:') }],
    1,
  )
  return { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, ...board } }] }
}

describe('Madame de Trémaine — cartes Fatalité codées', () => {
  it('Jaq défausse un Objet, en priorité les Cloches de Mariage', () => {
    const g = createInitialGame([{ villain: madameTremaine, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 't:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'tf:') }], 1)
    const l = g.players[0].locations[0].id
    const cloches = C({ cardId: 'cloches-mariage', type: 'item', cost: 3 })
    const invitation = C({ cardId: 'invitation-du-roi', type: 'item', cost: 3 })
    const s: GameState = { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, [l]: [cloches, invitation] } }] }
    const after = resolveEffect(s, { type: 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM', onlyType: 'item', preferCardIds: ['cloches-mariage', 'canne-tremaine'] }, { actorIndex: 0 })
    expect(after.players[0].discard.some((c) => c.cardId === 'cloches-mariage')).toBe(true)
    expect((after.players[0].board[l] ?? []).some((c) => c.cardId === 'invitation-du-roi')).toBe(true)
  })

  it('Sweet Nightingale défausse l’Allié le plus fort (pas un Objet)', () => {
    const g = createInitialGame([{ villain: madameTremaine, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 't:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'tf:') }], 1)
    const l = g.players[0].locations[0].id
    const gown = C({ cardId: 'ball-gown-anastasia', type: 'ally', strength: 4 })
    const item = C({ cardId: 'cloches-mariage', type: 'item', cost: 3 })
    const s: GameState = { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, [l]: [gown, item] } }] }
    const after = resolveEffect(s, { type: 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM', onlyType: 'ally' }, { actorIndex: 0 })
    expect(after.players[0].discard.some((c) => c.cardId === 'ball-gown-anastasia')).toBe(true)
    expect((after.players[0].board[l] ?? []).some((c) => c.cardId === 'cloches-mariage')).toBe(true) // Objet épargné
  })

  it('Bibbidi-Bobbidi-Boo libère un Héros piégé', () => {
    const g = createInitialGame([{ villain: madameTremaine, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 't:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'tf:') }], 1)
    const l = g.players[0].locations[0].id
    const cendrillon = C({ cardId: 'cendrillon', type: 'hero', strength: 2, trapped: true })
    const s: GameState = { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, [l]: [cendrillon] } }] }
    const after = resolveEffect(s, { type: 'UNTRAP_HERO' }, { actorIndex: 0 })
    expect((after.players[0].board[l] ?? []).find((c) => c.cardId === 'cendrillon')?.trapped).toBeFalsy()
  })

  it('Marraine la Bonne Fée gèle les déplacements d’Alliés (sauf si piégée)', () => {
    const fg = C({ cardId: 'fairy-godmother', type: 'hero', strength: 4, blocksAllyMoves: true })
    const active: PlayerState = tremaine({}).players[0]
    const here = active.locations[0].id
    const withFg: PlayerState = { ...active, board: { ...active.board, [here]: [fg] } }
    expect(alliesCannotMove(withFg)).toBe(true)
    const trappedFg: PlayerState = { ...active, board: { ...active.board, [here]: [{ ...fg, trapped: true }] } }
    expect(alliesCannotMove(trappedFg)).toBe(false) // piégée → ne bloque plus
  })
})
