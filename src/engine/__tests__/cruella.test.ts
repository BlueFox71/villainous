import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { hasReachedObjective } from '../rules'
import { addPuppyFromReserve, capturePuppiesAt, resolveEffects } from '../effects'
import { cruella } from '../../data/villains/cruella'
import { cruellaCards } from '../../data/villains/cruella.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PuppyTile } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: cruella,
        deckCards: buildDeckInstances(cruellaCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(cruellaCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

const tilesOf = (s: GameState) => s.players[0].puppyTiles ?? []
const captured = (s: GameState) => tilesOf(s).filter((t) => t.state === 'captured').reduce((n, t) => n + t.value, 0)
// Force une tuile dans un état/lieu donné (pour les tests).
const setTile = (s: GameState, id: string, patch: Partial<PuppyTile>): GameState => ({
  ...s,
  players: [{ ...s.players[0], puppyTiles: tilesOf(s).map((t) => (t.id === id ? { ...t, ...patch } : t)) }],
})

describe('Cruella d’Enfer — Tuiles Chiots & objectif', () => {
  it('démarre avec 12 tuiles en réserve, 0 capturé, objectif 99', () => {
    const s = game()
    expect(tilesOf(s)).toHaveLength(12)
    expect(tilesOf(s).every((t) => t.state === 'reserve')).toBe(true)
    expect(captured(s)).toBe(0)
    expect(s.players[0].objective).toEqual({ type: 'PUPPY_THRESHOLD', threshold: 99 })
  })

  it('victoire à 99 Chiots capturés, pas avant', () => {
    const s = game()
    // Capture toutes les tuiles → 176 ≥ 99.
    const all: GameState = { ...s, players: [{ ...s.players[0], puppyTiles: tilesOf(s).map((t) => ({ ...t, state: 'captured' as const })) }] }
    expect(hasReachedObjective(all, 0)).toBe(true)
    // Avec seulement 4 tuiles de 22 = 88 < 99 → pas encore.
    const some: GameState = {
      ...s,
      players: [{ ...s.players[0], puppyTiles: tilesOf(s).map((t) => ({ ...t, state: t.value === 22 ? ('captured' as const) : ('reserve' as const) })) }],
    }
    expect(captured(some)).toBe(88)
    expect(hasReachedObjective(some, 0)).toBe(false)
  })

  it('addPuppyFromReserve pose la tuile sur son lieu indiqué (révélée)', () => {
    const s = game()
    const tile = tilesOf(s).find((t) => t.homeLocation === 'campagne')!
    const after = addPuppyFromReserve(s, 0, tile.id)
    const t2 = (after.players[0].puppyTiles ?? []).find((t) => t.id === tile.id)!
    expect(t2.state).toBe('board')
    expect(t2.location).toBe('campagne')
    expect(t2.revealed).toBe(true)
  })

  it('Anita et Roger renvoient en réserve une tuile ajoutée sur leur lieu', () => {
    let s = game()
    const tile = tilesOf(s).find((t) => t.homeLocation === 'campagne')!
    const anita: CardInstance = { instanceId: 'h', cardId: 'anita-et-roger', name: 'Anita et Roger', type: 'hero', strength: 3 }
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, campagne: [anita] } }] }
    const after = addPuppyFromReserve(s, 0, tile.id)
    const t2 = (after.players[0].puppyTiles ?? []).find((t) => t.id === tile.id)!
    expect(t2.state).toBe('reserve')
    expect(t2.revealed).toBe(true)
  })

  it('capturePuppiesAt capture les tuiles posées (les plus grosses d’abord)', () => {
    let s = game()
    const t11 = tilesOf(s).find((t) => t.homeLocation === 'laiterie' && t.value === 11)!
    const t22 = tilesOf(s).find((t) => t.homeLocation === 'laiterie' && t.value === 22)!
    s = setTile(s, t11.id, { state: 'board', location: 'laiterie', revealed: true })
    s = setTile(s, t22.id, { state: 'board', location: 'laiterie', revealed: true })
    const after = capturePuppiesAt(s, 0, 'laiterie', 1) // capture 1 → la plus grosse (22)
    expect((after.players[0].puppyTiles ?? []).find((t) => t.id === t22.id)!.state).toBe('captured')
    expect((after.players[0].puppyTiles ?? []).find((t) => t.id === t11.id)!.state).toBe('board')
    expect(captured(after)).toBe(22)
  })

  it('Pongo empêche la capture sur son lieu', () => {
    let s = game()
    const t = tilesOf(s).find((t) => t.homeLocation === 'castel')!
    s = setTile(s, t.id, { state: 'board', location: 'castel', revealed: true })
    const pongo: CardInstance = { instanceId: 'p', cardId: 'pongo', name: 'Pongo', type: 'hero', strength: 4 }
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, castel: [pongo] } }] }
    const after = capturePuppiesAt(s, 0, 'castel', 2)
    expect(captured(after)).toBe(0)
  })

  it('ADD_PUPPY_FROM_RESERVE ouvre le choix ; RESOLVE_PUPPY_ADD pose la tuile', () => {
    let s = game()
    s = { ...s, phase: 'ACTION' }
    const pending = resolveEffects(s, [{ type: 'ADD_PUPPY_FROM_RESERVE', label: 'Ici, mes petits !' }])
    expect(pending.pendingPuppyAdd?.candidateTileIds).toHaveLength(12)
    const tileId = pending.pendingPuppyAdd!.candidateTileIds[0]
    const after = applyAction(pending, { type: 'RESOLVE_PUPPY_ADD', tileId })
    expect((after.players[0].puppyTiles ?? []).find((t) => t.id === tileId)!.state).toBe('board')
    expect(after.pendingPuppyAdd ?? null).toBeNull()
  })

  it('J’ai payé pour ça capture une tuile sur le lieu du pion', () => {
    let s = game()
    const t = tilesOf(s).find((t) => t.homeLocation === 'campagne')!
    s = setTile(s, t.id, { state: 'board', location: 'campagne', revealed: true })
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'campagne' }] }
    const after = resolveEffects(s, [{ type: 'CAPTURE_PUPPY_AT_PAWN' }])
    expect(captured(after)).toBe(t.value)
  })

  it('GAIN_POWER_PER_PUPPY_LOCATION : +1 Pouvoir par lieu portant une tuile', () => {
    let s = game()
    const a = tilesOf(s).find((t) => t.homeLocation === 'campagne')!
    const b = tilesOf(s).find((t) => t.homeLocation === 'laiterie')!
    s = setTile(s, a.id, { state: 'board', location: 'campagne' })
    s = setTile(s, b.id, { state: 'board', location: 'laiterie' })
    s = { ...s, players: [{ ...s.players[0], power: 0 }] }
    const after = resolveEffects(s, [{ type: 'GAIN_POWER_PER_PUPPY_LOCATION' }])
    expect(after.players[0].power).toBe(2)
  })

  it('Roadster déplacé emmène jusqu’à 2 tuiles vers son lieu d’arrivée (n’importe où)', () => {
    let s = game()
    const t1 = tilesOf(s).find((t) => t.homeLocation === 'maison-radcliff' && t.value === 11)!
    const t2 = tilesOf(s).find((t) => t.homeLocation === 'maison-radcliff' && t.value === 22)!
    s = setTile(s, t1.id, { state: 'board', location: 'maison-radcliff', revealed: true })
    s = setTile(s, t2.id, { state: 'board', location: 'maison-radcliff', revealed: true })
    const road: CardInstance = { instanceId: 'r', cardId: 'roadster', name: 'Roadster', type: 'item' }
    // Pion sur Campagne (action « Déplacer » dispo) ; Roadster + tuiles sur Maison.
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], pawnLocation: 'campagne', board: { ...s.players[0].board, 'maison-radcliff': [road] } }],
    }
    // Déplacement maison-radcliff → castel (non voisin : Roadster va n'importe où).
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'r', to: 'castel' })
    expect((after.players[0].puppyTiles ?? []).find((t) => t.id === t1.id)!.location).toBe('castel')
    expect((after.players[0].puppyTiles ?? []).find((t) => t.id === t2.id)!.location).toBe('castel')
  })

  it('Quels idiots ! : choix déplacer/chercher, puis choix de l’Allié', () => {
    let s = game()
    const jasper: CardInstance = { instanceId: 'j', cardId: 'jasper', name: 'Jasper', type: 'ally', strength: 4 }
    const horace: CardInstance = { instanceId: 'h', cardId: 'horace-cruella', name: 'Horace', type: 'ally', strength: 3 }
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], pawnLocation: 'campagne', board: { ...s.players[0].board, castel: [jasper] }, deck: [], discard: [horace], hand: [] }],
    }
    // Les deux options sont possibles → choix.
    const pending = resolveEffects(s, [{ type: 'QUELS_IDIOTS' }])
    expect(pending.pendingQuelsIdiots).toMatchObject({ phase: 'choose', canMove: true, canTutor: true })
    // Option « déplacer » (1 seul Allié déplaçable) → Jasper rejoint la Campagne.
    const moved = applyAction(pending, { type: 'RESOLVE_QUELS_IDIOTS', choice: 'move' })
    expect((moved.players[0].board['campagne'] ?? []).some((c) => c.instanceId === 'j')).toBe(true)
    expect(moved.pendingQuelsIdiots ?? null).toBeNull()
    // Option « chercher » (1 seul Allié en défausse) → Horace rejoint la main.
    const tutored = applyAction(pending, { type: 'RESOLVE_QUELS_IDIOTS', choice: 'tutor' })
    expect(tutored.players[0].hand.some((c) => c.instanceId === 'h')).toBe(true)
    expect(tutored.players[0].discard.some((c) => c.instanceId === 'h')).toBe(false)
  })

  it('Finissez le travail ! : activation gratuite, même hors lieu « Activer »', () => {
    let s = game()
    const lampe: CardInstance = { instanceId: 'l', cardId: 'lampe-electrique', name: 'Lampe électrique', type: 'item', activatedCost: 0 }
    // Pion sur la Campagne (PAS de symbole Activer) + drapeau freeActivate posé.
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], power: 3, freeActivate: true, pawnLocation: 'campagne', board: { ...s.players[0].board, campagne: [lampe] } }] }
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'free-activate', cardInstanceId: 'l' })
    expect(after.pendingPuppyAdd).not.toBeNull() // la Lampe a ouvert le choix d'une tuile
    expect(after.players[0].freeActivate ?? false).toBe(false) // drapeau consommé
    expect(after.usedActionIds).toEqual([]) // aucune action de lieu consommée
  })

  it('Horace : si capturer ET amener sont possibles, le joueur choisit', () => {
    let s = game()
    const t = tilesOf(s).find((t) => t.homeLocation === 'castel')!
    s = setTile(s, t.id, { state: 'board', location: 'castel', revealed: true })
    const horace: CardInstance = { instanceId: 'ho', cardId: 'horace-cruella', name: 'Horace', type: 'ally', strength: 3, activatedCost: 0 }
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], power: 5, pawnLocation: 'castel', board: { ...s.players[0].board, castel: [horace] } }] }
    const pending = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'ho' })
    expect(pending.pendingHoraceChoice).toMatchObject({ playerIndex: 0, locationId: 'castel' })
    // Choix « capturer » → la Tuile du lieu est capturée.
    const cap = applyAction(pending, { type: 'RESOLVE_HORACE_CHOICE', capture: true })
    expect(cap.pendingHoraceChoice ?? null).toBeNull()
    expect(captured(cap)).toBe(t.value)
    // Choix « amener » → ouvre le choix d'une Tuile de la réserve.
    const add = applyAction(pending, { type: 'RESOLVE_HORACE_CHOICE', capture: false })
    expect(add.pendingPuppyAdd).not.toBeNull()
  })

  it('Repéré ! ouvre le choix de révélation ; on révèle les tuiles voulues (jusqu’à 2)', () => {
    let s = game()
    s = { ...s, phase: 'ACTION' }
    const pending = resolveEffects(s, [{ type: 'REVEAL_PUPPY_RESERVE', count: 2 }])
    expect(pending.pendingPuppyReveal).toMatchObject({ playerIndex: 0, remaining: 2 })
    const hidden = tilesOf(pending).filter((t) => t.state === 'reserve' && !t.revealed)
    const after1 = applyAction(pending, { type: 'RESOLVE_PUPPY_REVEAL', tileId: hidden[0].id })
    expect((after1.players[0].puppyTiles ?? []).find((t) => t.id === hidden[0].id)!.revealed).toBe(true)
    expect(after1.pendingPuppyReveal?.remaining).toBe(1)
    // On peut s'arrêter avant d'avoir tout révélé (jusqu'à 2).
    const done = applyAction(after1, { type: 'DONE_PUPPY_REVEAL' })
    expect(done.pendingPuppyReveal ?? null).toBeNull()
    expect(tilesOf(done).filter((t) => t.revealed).length).toBe(1)
  })

  it('Évasion (Fatalité) remet une tuile capturée dans la réserve', () => {
    let s = game()
    const t = tilesOf(s).find((t) => t.value === 22)!
    s = setTile(s, t.id, { state: 'captured' })
    expect(captured(s)).toBe(22)
    const after = resolveEffects(s, [{ type: 'UNCAPTURE_PUPPY_TO_RESERVE', count: 1 }])
    expect(captured(after)).toBe(0)
    expect((after.players[0].puppyTiles ?? []).find((t) => t.id === t.id)!.state).toBe('reserve')
  })
})
