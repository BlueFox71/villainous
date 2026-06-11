import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: jafar, deckCards: buildDeckInstances(jafarCards, 'villain', 'p0:'), fateCards: buildDeckInstances(jafarCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    3,
  )
}

describe('Jafar — Hypnose comptée comme « éliminer un Héros »', () => {
  it('hypnotiser un Héros mémorise sa force pour les déclencheurs adverses', () => {
    const genie: CardInstance = { instanceId: 'g', cardId: 'genie', name: 'Génie', type: 'hero', strength: 6 }
    let s = game()
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, palais: [genie] } } : p)),
    }
    const next = resolveEffect(s, { type: 'HYPNOTIZE_HERO' }, { actorIndex: 0, targetHeroId: 'g' })
    expect(next.players[0].board['palais'][0].hypnotized).toBe(true)
    // ≥ 4 → Obsession / Méchanceté / Crise d'hystérie peuvent se déclencher.
    expect(next.lastVanquishedHeroStrength).toBeGreaterThanOrEqual(6)
  })
})

describe('Jafar — K.O. (retirer un Allié ≤ 3 au choix)', () => {
  it('ouvre le choix puis retire l’Allié sélectionné', () => {
    const a1: CardInstance = { instanceId: 'a1', cardId: 'garde-palais', name: 'Garde', type: 'ally', strength: 2 }
    const a2: CardInstance = { instanceId: 'a2', cardId: 'garde-palais', name: 'Garde', type: 'ally', strength: 2 }
    const ko: CardInstance = { instanceId: 'ko1', cardId: 'ko', name: 'K.O.', type: 'effect' }
    const other: CardInstance = { instanceId: 'o1', cardId: 'trahison', name: 'Trahison', type: 'effect' }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [ko, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, palais: [a1, a2] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'ko1' })
    expect(s.pendingFateChoice?.kind).toBe('remove-ally')
    expect(s.pendingFateChoice?.candidateIds.sort()).toEqual(['a1', 'a2'])
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'a1' })
    expect(s.pendingFateChoice ?? null).toBeNull()
    const palais = s.players[0].board['palais'] ?? []
    expect(palais.some((c) => c.instanceId === 'a1')).toBe(false)
    expect(palais.some((c) => c.instanceId === 'a2')).toBe(true)
    expect(s.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true)
  })
})

describe('Jafar — Trahison (perd 2 Pouvoir)', () => {
  it('retire 2 jetons Pouvoir à la cible', () => {
    const tr: CardInstance = { instanceId: 'tr1', cardId: 'trahison', name: 'Trahison', type: 'effect' }
    const other: CardInstance = { instanceId: 'o2', cardId: 'ko', name: 'K.O.', type: 'effect' }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [tr, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'tr1' })
    expect(s.players[0].power).toBe(3)
    expect(s.pendingFate ?? null).toBeNull()
  })
})

describe('Jafar — Abu (voler un Objet au choix)', () => {
  it('ouvre le choix puis associe l’Objet choisi au Héros', () => {
    const abu: CardInstance = { instanceId: 'abu1', cardId: 'abu', name: 'Abu', type: 'hero', strength: 2 }
    const item1: CardInstance = { instanceId: 'i1', cardId: 'cimeterre', name: 'Cimeterre', type: 'item' }
    const item2: CardInstance = { instanceId: 'i2', cardId: 'cimeterre', name: 'Cimeterre', type: 'item' }
    let s = game()
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, oasis: [abu, item1, item2] } } : p)),
    }
    // Abu vient d'être posé chez Jafar (actorIndex = royaume ciblé = 0).
    s = resolveEffect(s, { type: 'STEAL_ITEM_TO_HERO' }, { actorIndex: 0, hostInstanceId: 'abu1', hostLocationId: 'oasis' })
    expect(s.pendingFateChoice?.kind).toBe('steal-item-to-hero')
    expect(s.pendingFateChoice?.candidateIds.sort()).toEqual(['i1', 'i2'])
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'i1' })
    const oasis = s.players[0].board['oasis'] ?? []
    expect(oasis.find((c) => c.instanceId === 'i1')?.attachedTo).toBe('abu1')
    expect(s.pendingFateChoice ?? null).toBeNull()
  })
})
