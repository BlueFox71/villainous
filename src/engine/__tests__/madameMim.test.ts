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

  it('Le Savoir conduit à la Puissance : choix interactif (Merlin + lieu) puis déplacement', () => {
    const { state, merlin } = setup([])
    const s = resolveEffects(state, [{ type: 'MOVE_MERLIN_ANYWHERE' }], { actorIndex: 0 })
    // Ouvre un pending au lieu de déplacer automatiquement.
    expect(s.pendingMerlinMove?.candidateIds).toContain(merlin.instanceId)
    expect((s.players[0].board['lieu-duel'] ?? []).some((c) => c.instanceId === merlin.instanceId)).toBe(true)
    const s1 = applyAction(s, { type: 'RESOLVE_MERLIN_MOVE', merlinInstanceId: merlin.instanceId, to: 'marais' })
    expect(s1.pendingMerlinMove ?? null).toBeNull()
    expect((s1.players[0].board['marais'] ?? []).some((c) => c.instanceId === merlin.instanceId)).toBe(true)
    expect((s1.players[0].board['lieu-duel'] ?? []).some((c) => c.instanceId === merlin.instanceId)).toBe(false)
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

describe('Bataille d’esprits — pas de modale de choix avant de défausser', () => {
  // La carte dit « Piochez 4 cartes, puis défaussez 4 cartes de votre main » : aucun choix
  // n'est offert, on doit donc enchaîner DIRECTEMENT sur la sélection à défausser. Seule
  // « Information » (Sombra) laisse l'alternative main / cartes piochées (orDiscardDrawn).
  it('pioche 4 puis ouvre directement la défausse de 4 (aucun pendingInformation)', () => {
    const base = game()
    const hand0 = base.players[0].hand.length
    const s = resolveEffects(
      { ...base, activePlayer: 0 },
      [{ type: 'DRAW_THEN_DISCARD', draw: 4, discard: 4 }],
      { actorIndex: 0, sourceCardName: 'Bataille d’esprits' },
    )
    expect(s.pendingInformation ?? null).toBeNull()
    expect(s.players[0].hand.length).toBe(hand0 + 4)
    expect(s.pendingTyrannyDiscard?.count).toBe(4)
    expect(s.pendingTyrannyDiscard?.label).toBe('Bataille d’esprits')
  })

  it('la carte du deck de Mim porte bien l’effet sans l’alternative', () => {
    const eff = madameMimCards.find((c) => c.id === 'bataille-d-esprit')?.effects?.[0]
    expect(eff).toMatchObject({ type: 'DRAW_THEN_DISCARD', draw: 4, discard: 4 })
    expect((eff as { orDiscardDrawn?: boolean }).orDiscardDrawn).toBeUndefined()
  })
})

describe('Madame Mim — victoire IMMÉDIATE à la dernière Métamorphose', () => {
  // Avant : l'objectif n'était constaté qu'au début du tour suivant de Mim → il fallait
  // subir tout le tour de l'adversaire avant que la victoire soit validée.
  /** Mim avec 6 Merlin déjà vaincus, le 7ᵉ au Lieu du Duel avec sa Métamorphose tueuse. */
  const lastMerlin = () => {
    const merlin = card('merlin-souris', 'hero', { instanceId: 'ms', strength: 1, isMerlinTransformation: true })
    const mim = card('mim-serpent', 'ally', {
      instanceId: 'mse', strength: 1, isMimTransformation: true, transformationTarget: 'merlin-souris',
      grantsAction: { type: 'VANQUISH', label: 'Éliminer (Mim)' },
    })
    const base = game()
    const beaten = Array.from({ length: 6 }, (_, i) => card('merlin-b' + i, 'hero', { isMerlinTransformation: true }))
    return {
      state: {
        ...base,
        phase: 'ACTION' as const,
        players: [{
          ...base.players[0],
          pawnLocation: 'lieu-duel',
          merlinDeck: [], // pioche Merlin vide : c'est le DERNIER
          merlinDiscard: beaten,
          board: { ...base.players[0].board, 'lieu-duel': [merlin, mim] },
        }],
      } as GameState,
    }
  }

  it('par VANQUISH : la partie est gagnée sur le champ', () => {
    const { state } = lastMerlin()
    const s = applyAction(state, { type: 'VANQUISH', actionId: 'granted:mse', heroInstanceId: 'ms', allyInstanceIds: ['mse'] })
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('par EFFET (J’établis les règles) : la partie est gagnée sur le champ', () => {
    const { state } = lastMerlin()
    const s = resolveEffects(state, [{ type: 'DEFEAT_MERLIN_IN_REALM' }], { actorIndex: 0 })
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('il en reste une en pioche → PAS de victoire (une nouvelle entre dans le duel)', () => {
    const { state } = lastMerlin()
    const next = card('merlin-lapin', 'hero', { instanceId: 'ml', isMerlinTransformation: true })
    const s0 = { ...state, players: [{ ...state.players[0], merlinDeck: [next] }] } as GameState
    const s = resolveEffects(s0, [{ type: 'DEFEAT_MERLIN_IN_REALM' }], { actorIndex: 0 })
    expect(s.status).toBe('PLAYING')
    expect((s.players[0].board['lieu-duel'] ?? []).some((c) => c.instanceId === 'ml')).toBe(true)
  })
})

describe('Madame Mim — showcase du duel (éliminée + nouvelle arrivante)', () => {
  const duelSetup = (merlinDeck: CardInstance[]) => {
    const merlin = card('merlin-souris', 'hero', { instanceId: 'ms', strength: 1, isMerlinTransformation: true })
    const mim = card('mim-serpent', 'ally', {
      instanceId: 'mse', strength: 1, isMimTransformation: true, transformationTarget: 'merlin-souris',
      grantsAction: { type: 'VANQUISH', label: 'Éliminer (Mim)' },
    })
    const base = game()
    return {
      state: {
        ...base,
        phase: 'ACTION' as const,
        showcaseEvents: [],
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

  it('élimination par EFFET : la Métamorphose vaincue est montrée (comme un Vanquish)', () => {
    const { state } = duelSetup([])
    const s = resolveEffects(state, [{ type: 'DEFEAT_MERLIN_IN_REALM' }], { actorIndex: 0 })
    expect(s.showcaseEvents.some((e) => e.discard?.cardIds.includes('merlin-souris'))).toBe(true)
  })

  it('la NOUVELLE Métamorphose est annoncée au showcase (voie effet ET voie Vanquish)', () => {
    const next = () => card('merlin-lapin', 'hero', { instanceId: 'ml', isMerlinTransformation: true })
    const byEffect = resolveEffects(duelSetup([next()]).state, [{ type: 'DEFEAT_MERLIN_IN_REALM' }], { actorIndex: 0 })
    expect(byEffect.showcaseEvents.some((e) => e.cardId === 'merlin-lapin' && !e.discard)).toBe(true)
    const byVanquish = applyAction(duelSetup([next()]).state, {
      type: 'VANQUISH', actionId: 'granted:mse', heroInstanceId: 'ms', allyInstanceIds: ['mse'],
    })
    expect(byVanquish.showcaseEvents.some((e) => e.cardId === 'merlin-lapin' && !e.discard)).toBe(true)
  })
})

describe('Madame Mim — Le Savoir conduit à la Puissance (Fatalité) : interactif', () => {
  const emptyBoard = (s: GameState) => Object.fromEntries(s.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>

  it('ouvre un choix (Merlin + lieu) puis déplace vers le lieu choisi', () => {
    const base = game()
    const merlin = card('merlin-souris', 'hero', { isMerlinTransformation: true })
    const s = { ...base, players: [{ ...base.players[0], board: { ...emptyBoard(base), 'lieu-duel': [merlin] } }] } as GameState
    const out = resolveEffects(s, [{ type: 'MOVE_MERLIN_ANYWHERE' }], { actorIndex: 0 })
    // N'AUTO-déplace pas : ouvre un pending avec le Merlin comme candidat.
    expect(out.pendingMerlinMove?.candidateIds).toContain(merlin.instanceId)
    expect((out.players[0].board['lieu-duel'] ?? []).some((c) => c.instanceId === merlin.instanceId)).toBe(true)
    // Le joueur choisit Le Marais → déplacement effectif.
    const done = applyAction(out, { type: 'RESOLVE_MERLIN_MOVE', merlinInstanceId: merlin.instanceId, to: 'marais' })
    expect((done.players[0].board['marais'] ?? []).some((c) => c.instanceId === merlin.instanceId)).toBe(true)
    expect((done.players[0].board['lieu-duel'] ?? []).some((c) => c.isMerlinTransformation)).toBe(false)
  })

  it('aucune Métamorphose de Merlin en jeu → aucun pending', () => {
    const base = game()
    const s = { ...base, players: [{ ...base.players[0], board: emptyBoard(base) }] } as GameState
    const out = resolveEffects(s, [{ type: 'MOVE_MERLIN_ANYWHERE' }], { actorIndex: 0 })
    expect(out.pendingMerlinMove ?? null).toBeNull()
  })
})
