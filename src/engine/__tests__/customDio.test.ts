// Dio Brando (custom) — flux INTERACTIFS des cartes : chaque carte qui implique un choix
// du joueur ouvre un pending (pas d'auto-pick côté humain), puis se résout par une action.
// On isole les effets via resolveEffect / applyAction sur une partie minimale.
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../types'

const villainInstances = buildDeckInstances(facilierCards, 'villain', 'p0:')
const fateInstances = buildDeckInstances(facilierCards, 'fate', 'p0f:')

const LOC = 'royaume-vaudou'

let n = 0
const card = (type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `c${n++}`,
  cardId: `card-${n}`,
  name: extra.name ?? `carte-${n}`,
  type,
  ...extra,
})

function dioGame(patch: Partial<PlayerState> = {}): GameState {
  const base = createInitialGame(
    [{ villain: facilier, deckCards: villainInstances, fateCards: fateInstances }],
    42,
  )
  // On joue le rôle de Dio : `villain` pilote dioPowerFactor (doublement du Pouvoir).
  return {
    ...base,
    players: base.players.map((p, i) => (i === 0 ? { ...p, villain: 'custom-dio', board: {}, ...patch } : p)),
  }
}

describe('Dio — Vampirisme (DIO_DISCARD_ALLY_GAIN) interactif', () => {
  it('ouvre pendingDioDiscardAlly (pas d’auto-pick) ; la résolution défausse l’Allié choisi et gagne 4', () => {
    const a1 = card('ally', { instanceId: 'a1', name: 'Faible', strength: 1 })
    const a2 = card('ally', { instanceId: 'a2', name: 'Fort', strength: 5 })
    let s = dioGame({ board: { [LOC]: [a1, a2] }, power: 0 })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly?.playerIndex).toBe(0)
    // Le joueur choisit le PLUS FORT (auto-pick aurait pris le plus faible).
    const out = applyAction(s, { type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId: 'a2' })
    expect(out.pendingDioDiscardAlly ?? null).toBeNull()
    expect(out.players[0].board[LOC]?.map((c) => c.instanceId)).toEqual(['a1'])
    expect(out.players[0].discard.some((c) => c.instanceId === 'a2')).toBe(true)
    expect(out.players[0].power).toBe(4)
  })

  it('double le gain (8) si The World est en jeu et Jotaro+Joseph retirés', () => {
    const world = card('ally', { instanceId: 'w', cardId: 'the-world', name: 'The World', strength: 9 })
    const a1 = card('ally', { instanceId: 'a1', name: 'Sbire', strength: 2 })
    let s = dioGame({ board: { [LOC]: [world, a1] }, power: 0, removedFromGame: ['jotaro-kujo', 'joseph-joestar'] })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    const out = applyAction(s, { type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId: 'a1' })
    expect(out.players[0].power).toBe(8)
  })

  it('sans Allié : aucun pending (no-op)', () => {
    let s = dioGame({ board: { [LOC]: [] }, power: 0 })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly ?? null).toBeNull()
    expect(s.players[0].power).toBe(0)
  })
})

describe('Dio — Justice (RECOVER_TYPE_FROM_DISCARD) interactif', () => {
  it('ouvre pendingRecover listant uniquement les Alliés de la défausse', () => {
    const ally = card('ally', { instanceId: 'da', name: 'Allié défaussé' })
    const item = card('item', { instanceId: 'di', name: 'Objet défaussé' })
    let s = dioGame({ discard: [ally, item] })
    s = resolveEffect(s, { type: 'RECOVER_TYPE_FROM_DISCARD', types: ['ally'], label: 'Justice' }, { actorIndex: 0 })
    expect(s.pendingRecover?.label).toBe('Justice')
    expect(new Set(s.pendingRecover?.candidateIds)).toEqual(new Set(['da']))
    const out = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: 'da' })
    expect(out.players[0].hand.some((c) => c.instanceId === 'da')).toBe(true)
  })
})

describe('Dio — CREAM (DIO_CREAM_DISCARD_HERO) interactif', () => {
  it('ouvre pendingDioCream avec les Héros de force < Vanilla Ice ; la résolution défausse le Héros choisi', () => {
    const vi = card('ally', { instanceId: 'vi', name: 'Vanilla Ice', strength: 6 })
    const faible = card('hero', { instanceId: 'h1', name: 'Faible', strength: 2 })
    const fort = card('hero', { instanceId: 'h2', name: 'Trop fort', strength: 7 })
    let s = dioGame({ board: { [LOC]: [vi, faible, fort] } })
    s = resolveEffect(s, { type: 'DIO_CREAM_DISCARD_HERO' }, { actorIndex: 0, hostInstanceId: 'vi', hostLocationId: LOC })
    expect(new Set(s.pendingDioCream?.candidateIds)).toEqual(new Set(['h1'])) // h2 (force 7) inéligible
    const out = applyAction(s, { type: 'RESOLVE_DIO_CREAM', heroInstanceId: 'h1' })
    expect(out.pendingDioCream ?? null).toBeNull()
    expect(out.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
    expect(out.players[0].board[LOC]?.some((c) => c.instanceId === 'h1')).toBe(false)
  })
})

describe('Dio — MUDA! (DIO_MUDA) interactif', () => {
  it('ouvre pendingDioMuda ; éliminer le Héros choisi + gagner 5', () => {
    const hero = card('hero', { instanceId: 'h1', name: 'Cible', strength: 3 })
    let s = dioGame({ board: { [LOC]: [hero] }, pawnLocation: LOC, power: 0 })
    s = resolveEffect(s, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    expect(s.pendingDioMuda?.candidateIds).toEqual(['h1'])
    const out = applyAction(s, { type: 'RESOLVE_DIO_MUDA', heroInstanceId: 'h1' })
    expect(out.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
    expect(out.players[0].power).toBe(5)
  })

  it('décliner l’élimination gagne quand même 5', () => {
    const hero = card('hero', { instanceId: 'h1', name: 'Cible', strength: 3 })
    let s = dioGame({ board: { [LOC]: [hero] }, pawnLocation: LOC, power: 0 })
    s = resolveEffect(s, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    const out = applyAction(s, { type: 'RESOLVE_DIO_MUDA' })
    expect(out.players[0].board[LOC]?.some((c) => c.instanceId === 'h1')).toBe(true)
    expect(out.players[0].power).toBe(5)
  })

  it('sans Héros au lieu du pion : gain direct (pas de pending)', () => {
    let s = dioGame({ board: { [LOC]: [] }, pawnLocation: LOC, power: 0 })
    s = resolveEffect(s, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    expect(s.pendingDioMuda ?? null).toBeNull()
    expect(s.players[0].power).toBe(5)
  })
})

describe('Dio — Quête vers le paradis (DIO_QUEST_FOR_HEAVEN) interactif', () => {
  it('ouvre pendingDioQuest ; la résolution récupère les cartes du type choisi', () => {
    const items = [card('item', { instanceId: 'i1' }), card('item', { instanceId: 'i2' })]
    const events = [card('effect', { instanceId: 'e1' }), card('effect', { instanceId: 'e2' })]
    let s = dioGame({ discard: [...items, ...events], hand: [] })
    s = resolveEffect(s, { type: 'DIO_QUEST_FOR_HEAVEN' }, { actorIndex: 0 })
    expect(s.pendingDioQuest?.playerIndex).toBe(0)
    const out = applyAction(s, { type: 'RESOLVE_DIO_QUEST', cardType: 'item' })
    expect(out.pendingDioQuest ?? null).toBeNull()
    // Les 4 cartes tiennent dans les 6 dévoilées : les 2 Objets rejoignent la main.
    expect(out.players[0].hand.filter((c) => c.type === 'item')).toHaveLength(2)
    expect(out.players[0].hand.some((c) => c.type === 'effect')).toBe(false)
  })
})

describe('Dio — Lumière du Soleil (DIO_SUNLIGHT_CHOICE) interactif', () => {
  it('ouvre pendingDioSunlight ; choisir « perdre » retire le Pouvoir', () => {
    let s = dioGame({ hand: [card('effect'), card('effect')], power: 12 })
    s = resolveEffect(s, { type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }, { actorIndex: 0 })
    expect(s.pendingDioSunlight?.lose).toBe(10)
    const out = applyAction(s, { type: 'RESOLVE_DIO_SUNLIGHT', choice: 'lose' })
    expect(out.players[0].power).toBe(2)
    expect(out.players[0].hand).toHaveLength(2)
  })

  it('choisir « défausser » vide la main', () => {
    let s = dioGame({ hand: [card('effect'), card('effect'), card('item')], power: 3 })
    s = resolveEffect(s, { type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }, { actorIndex: 0 })
    const out = applyAction(s, { type: 'RESOLVE_DIO_SUNLIGHT', choice: 'discard' })
    expect(out.players[0].hand).toHaveLength(0)
    expect(out.players[0].discard).toHaveLength(3)
    expect(out.players[0].power).toBe(3)
  })
})
