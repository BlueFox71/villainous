import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffects } from '../effects'
import { hasReachedObjective } from '../rules'
import { madameMim } from '../../data/villains/madameMim'
import { madameMimCards } from '../../data/villains/madameMim.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: madameMim,
        deckCards: buildDeckInstances(madameMimCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(madameMimCards, 'fate', 'p0f:'),
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

describe('Madame Mim — mise en place', () => {
  it('1 Métamorphose de Merlin au Lieu du Duel ; pioche Merlin = 6 ; Fatalité traditionnelle = 8', () => {
    const s = game()
    const p = s.players[0]
    const duel = p.board['lieu-duel'] ?? []
    expect(duel.filter((c) => c.isMerlinTransformation)).toHaveLength(1)
    expect(p.merlinDeck).toHaveLength(6)
    expect(p.fateDeck.every((c) => !c.isMerlinTransformation)).toBe(true)
    expect(p.fateDeck).toHaveLength(8)
    expect(p.objective.type).toBe('DEFEAT_ALL_MERLIN')
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Madame Mim — Métamorphoses & objectif', () => {
  const setup = (merlinDeck: CardInstance[] = []) => {
    const merlin = card('merlin-souris', 'hero', { instanceId: 'ms', strength: 1, isMerlinTransformation: true })
    const mim = card('mim-serpent', 'ally', {
      instanceId: 'mse',
      strength: 1,
      isMimTransformation: true,
      transformationTarget: 'merlin-souris',
      grantsAction: { type: 'VANQUISH', label: 'Éliminer (Mim)' },
    })
    const base = game()
    return {
      merlin,
      mim,
      state: {
        ...base,
        phase: 'ACTION' as const,
        players: [{
          ...base.players[0],
          pawnLocation: 'lieu-duel',
          merlinDeck,
          merlinDiscard: [],
          board: { ...base.players[0].board, 'lieu-duel': [merlin, mim] },
        }],
      } as GameState,
    }
  }

  it('vaincre un Merlin avec sa Métamorphose Mim → merlinDiscard + remplacement au Lieu du Duel', () => {
    const next = card('merlin-lapin', 'hero', { instanceId: 'ml', strength: 2, isMerlinTransformation: true })
    const { state } = setup([next])
    const s = applyAction(state, { type: 'VANQUISH', actionId: 'granted:mse', heroInstanceId: 'ms', allyInstanceIds: ['mse'] })
    const p = s.players[0]
    expect(p.merlinDiscard?.some((c) => c.instanceId === 'ms')).toBe(true)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'ms')).toBe(false)
    // Le Merlin suivant apparaît au Lieu du Duel ; la pioche Merlin se vide.
    expect((p.board['lieu-duel'] ?? []).some((c) => c.instanceId === 'ml')).toBe(true)
    expect(p.merlinDeck).toHaveLength(0)
  })

  it('vaincre un Merlin n’utilise PAS la force : la bonne Mim suffit même si plus faible', () => {
    const base = game()
    const merlin = card('merlin-lapin', 'hero', { instanceId: 'mlp', strength: 4, isMerlinTransformation: true })
    const mim = card('mim-renard', 'ally', {
      instanceId: 'mrf', strength: 1, isMimTransformation: true, transformationTarget: 'merlin-lapin',
      grantsAction: { type: 'VANQUISH', label: 'x' },
    })
    const s0 = {
      ...base,
      phase: 'ACTION' as const,
      players: [{ ...base.players[0], pawnLocation: 'lieu-duel', merlinDeck: [], merlinDiscard: [], board: { ...base.players[0].board, 'lieu-duel': [merlin, mim] } }],
    } as GameState
    const s = applyAction(s0, { type: 'VANQUISH', actionId: 'granted:mrf', heroInstanceId: 'mlp', allyInstanceIds: ['mrf'] })
    // Force Mim (1) < force Merlin (4), mais la correspondance suffit.
    expect(s.players[0].merlinDiscard?.some((c) => c.instanceId === 'mlp')).toBe(true)
  })

  it('pas de nouvelle Métamorphose de Merlin si une autre reste en jeu', () => {
    const base = game()
    const souris = card('merlin-souris', 'hero', { instanceId: 'ms', strength: 1, isMerlinTransformation: true })
    const mim = card('mim-serpent', 'ally', { instanceId: 'mse', strength: 1, isMimTransformation: true, transformationTarget: 'merlin-souris', grantsAction: { type: 'VANQUISH', label: 'x' } })
    const autre = card('merlin-lapin', 'hero', { instanceId: 'ml', strength: 2, isMerlinTransformation: true })
    const fromDeck = card('merlin-tortue', 'hero', { instanceId: 'mt', isMerlinTransformation: true })
    const s0 = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'lieu-duel',
        merlinDeck: [fromDeck],
        merlinDiscard: [],
        board: { ...base.players[0].board, 'lieu-duel': [souris, mim], cabane: [autre] },
      }],
    } as GameState
    const s = applyAction(s0, { type: 'VANQUISH', actionId: 'granted:mse', heroInstanceId: 'ms', allyInstanceIds: ['mse'] })
    // Merlin Lapin reste en jeu → aucune nouvelle Métamorphose piochée (deck intact).
    expect(s.players[0].merlinDeck).toHaveLength(1)
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'mt')).toBe(false)
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'ml')).toBe(true)
  })

  it('une mauvaise Métamorphose Mim ne peut pas vaincre le Merlin', () => {
    const { state } = setup([])
    const wrong = card('mim-crocodile', 'ally', {
      instanceId: 'mcr', strength: 5, isMimTransformation: true, transformationTarget: 'merlin-tortue',
      grantsAction: { type: 'VANQUISH', label: 'x' },
    })
    const s2 = { ...state, players: [{ ...state.players[0], board: { ...state.players[0].board, 'lieu-duel': [state.players[0].board['lieu-duel']![0], wrong] } }] }
    expect(() =>
      applyAction(s2, { type: 'VANQUISH', actionId: 'granted:mcr', heroInstanceId: 'ms', allyInstanceIds: ['mcr'] }),
    ).toThrow(/Métamorphose Mim correspondante/)
  })

  it('J’établis les règles (DEFEAT_MERLIN_IN_REALM) vainc le Merlin du Lieu du Duel + le remplace', () => {
    const next = card('merlin-lapin', 'hero', { instanceId: 'ml', strength: 2, isMerlinTransformation: true })
    const { state, merlin } = setup([next])
    const s = resolveEffects(state, [{ type: 'DEFEAT_MERLIN_IN_REALM' }], { actorIndex: 0 })
    expect(s.players[0].merlinDiscard?.some((c) => c.instanceId === merlin.instanceId)).toBe(true)
    expect((s.players[0].board['lieu-duel'] ?? []).some((c) => c.instanceId === 'ml')).toBe(true)
  })

  it('Merlin Microbe (DISCARD_MIM_TRANSFORMATION) défausse une Métamorphose Mim du royaume', () => {
    const { state, mim } = setup([])
    const s = resolveEffects(state, [{ type: 'DISCARD_MIM_TRANSFORMATION' }], { actorIndex: 0 })
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === mim.instanceId)).toBe(false)
    expect(s.players[0].discard.some((c) => c.instanceId === mim.instanceId)).toBe(true)
  })

  it('Merlin (RECYCLE_DEFEATED_MERLIN) remet une Métamorphose vaincue dans la pioche', () => {
    const base = game()
    const beaten = card('merlin-tortue', 'hero', { instanceId: 'mt', isMerlinTransformation: true })
    const s0 = { ...base, players: [{ ...base.players[0], merlinDeck: [], merlinDiscard: [beaten] }] } as GameState
    const s = resolveEffects(s0, [{ type: 'RECYCLE_DEFEATED_MERLIN' }], { actorIndex: 0 })
    expect(s.players[0].merlinDiscard).toHaveLength(0)
    expect(s.players[0].merlinDeck?.some((c) => c.instanceId === 'mt')).toBe(true)
  })

  it('une Métamorphose de Merlin est un Héros : déplaçable via l’action « Déplacer un héros »', () => {
    const { state } = setup([])
    // Pion à la Cabane (qui a l'action « Déplacer un héros ») ; le Merlin est au Lieu du
    // Duel (voisin). On le déplace vers la Cabane.
    const s0 = { ...state, players: [{ ...state.players[0], pawnLocation: 'cabane' }] } as GameState
    const s = applyAction(s0, { type: 'MOVE_HERO', actionId: 'move-hero', heroInstanceId: 'ms', to: 'cabane' })
    expect((s.players[0].board['cabane'] ?? []).some((c) => c.instanceId === 'ms')).toBe(true)
    expect((s.players[0].board['lieu-duel'] ?? []).some((c) => c.instanceId === 'ms')).toBe(false)
  })

  it('Pas de Tricherie : réordonne (interactif) le dessus de la pioche de Métamorphoses de Merlin', () => {
    const base = game()
    const a = card('merlin-souris', 'hero', { instanceId: 'a', isMerlinTransformation: true })
    const b = card('merlin-lapin', 'hero', { instanceId: 'b', isMerlinTransformation: true })
    const c = card('merlin-tortue', 'hero', { instanceId: 'c', isMerlinTransformation: true })
    const s0 = { ...base, players: [{ ...base.players[0], merlinDeck: [a, b, c] }] } as GameState
    let s = resolveEffects(s0, [{ type: 'REORDER_MERLIN_DECK_TOP2' }], { actorIndex: 0 })
    expect(s.pendingFateReorder?.deck).toBe('merlin')
    expect(s.pendingFateReorder?.cards.map((x) => x.instanceId)).toEqual(['a', 'b'])
    expect(s.players[0].merlinDeck?.map((x) => x.instanceId)).toEqual(['c'])
    // Le joueur remet b en premier (sur le dessus).
    s = applyAction(s, { type: 'RESOLVE_FATE_REORDER', orderedIds: ['b', 'a'] })
    expect(s.players[0].merlinDeck?.map((x) => x.instanceId)).toEqual(['b', 'a', 'c'])
  })

  it('objectif atteint quand les 7 Merlin sont vaincus (pioche vide + aucun en jeu)', () => {
    const base = game()
    const discarded = Array.from({ length: 7 }, (_, i) => card('merlin-' + i, 'hero', { isMerlinTransformation: true }))
    const s = {
      ...base,
      players: [{ ...base.players[0], merlinDeck: [], merlinDiscard: discarded, board: Object.fromEntries(base.players[0].locations.map((l) => [l.id, []])) }],
    } as GameState
    expect(hasReachedObjective(s, 0)).toBe(true)
  })
})
