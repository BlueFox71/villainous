import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { alliesCannotMove } from '../rules'
import { createInitialGame } from '../state'
import { madameTremaine } from '../../data/villains/madameTremaine'
import { madameTremaineCards } from '../../data/villains/madameTremaine.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
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

  it('Chante, Rossignol, Chante DÉPLACE un Allié vers n’importe quel lieu (ne le défausse pas)', () => {
    const g = createInitialGame(
      [
        { villain: madameTremaine, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 't:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'tf:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      1,
    )
    const ally = C({ cardId: 'ball-gown-anastasia', type: 'ally', strength: 4 })
    const night: CardInstance = { instanceId: 'sn1', cardId: 'sweet-nightingale', name: 'Chante, Rossignol, Chante', type: 'effect' }
    const other: CardInstance = { instanceId: 'o1', cardId: 'jaq', name: 'X', type: 'effect' }
    let s: GameState = {
      ...g,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [night, other] },
      players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'chambre-cendrillon': [ally] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'sn1' })
    expect(s.pendingAllyRelocate?.chooserIndex).toBe(1)
    expect(s.pendingAllyRelocate?.targetIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: ally.instanceId, to: 'chateau' })
    // Déplacé (PAS défaussé).
    expect(s.players[0].discard.some((c) => c.cardId === 'ball-gown-anastasia')).toBe(false)
    expect((s.players[0].board['chambre-cendrillon'] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(false)
    expect((s.players[0].board['chateau'] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(true)
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
