import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { effectiveStrength, alliesAt, transformableGuards } from '../rules'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const guard = (id: string, isWicket = false): CardInstance => ({
  instanceId: id,
  cardId: 'gardes-coeur',
  name: 'Gardes Cœur',
  type: 'ally',
  strength: 3,
  isWicket: isWicket || undefined,
})

const lance = (id: string, attachedTo?: string): CardInstance => ({
  instanceId: id,
  cardId: 'lance',
  name: 'Lance',
  type: 'item',
  attachedTo,
})

/** Reine de Cœur, plateau peuplé sur cour-palais. */
function setup(cards: CardInstance[]): GameState {
  const base = createInitialGame(
    [{ villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') }],
    4,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({ ...p, pawnLocation: 'cour-palais', board: { ...p.board, 'cour-palais': cards } })),
  }
}

describe('Reine de Cœur — Lance', () => {
  it('la Lance ajoute +1 à la force d’un Allié', () => {
    const s = setup([guard('g1'), lance('l1', 'g1')])
    expect(effectiveStrength(s, 0, 'g1')).toBe(4) // 3 + 1
  })

  it('la Lance peut s’associer à un arceau et augmente sa force', () => {
    const s = setup([guard('g1', true), lance('l1', 'g1')])
    // L'arceau reste une cible d'association valide.
    expect(alliesAt(s, 'cour-palais').some((c) => c.instanceId === 'g1')).toBe(true)
    // Et la Lance booste sa force (utile au Coup Royal).
    expect(effectiveStrength(s, 0, 'g1')).toBe(4)
  })
})

describe('Reine de Cœur — Par ordre de la Reine !', () => {
  it('TRANSFORM_GUARDS ouvre la sélection s’il existe des Cartes Gardes', () => {
    const s = setup([guard('g1'), guard('g2')])
    const after = resolveEffect(s, { type: 'TRANSFORM_GUARDS', max: 2 }, { actorIndex: 0 })
    expect(after.pendingTransformWickets).toEqual({ playerIndex: 0, max: 2 })
  })

  it('sans Carte Garde éligible, l’effet ne fait rien', () => {
    const s = setup([guard('g1', true)]) // déjà un arceau
    const after = resolveEffect(s, { type: 'TRANSFORM_GUARDS', max: 2 }, { actorIndex: 0 })
    expect(after.pendingTransformWickets ?? null).toBeNull()
  })

  it('RESOLVE_TRANSFORM_WICKETS transforme les Cartes Gardes choisies en arceaux', () => {
    let s = setup([guard('g1'), guard('g2')])
    s = { ...s, pendingTransformWickets: { playerIndex: 0, max: 2 } }
    s = applyAction(s, { type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds: ['g1', 'g2'] })
    const cell = s.players[0].board['cour-palais'] ?? []
    expect(cell.find((c) => c.instanceId === 'g1')?.isWicket).toBe(true)
    expect(cell.find((c) => c.instanceId === 'g2')?.isWicket).toBe(true)
    expect(s.pendingTransformWickets ?? null).toBeNull()
  })

  it('le maximum (2) borne le nombre de transformations', () => {
    let s = setup([guard('g1'), guard('g2'), guard('g3')])
    s = { ...s, pendingTransformWickets: { playerIndex: 0, max: 2 } }
    s = applyAction(s, { type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds: ['g1', 'g2', 'g3'] })
    const wickets = (s.players[0].board['cour-palais'] ?? []).filter((c) => c.isWicket)
    expect(wickets).toHaveLength(2)
  })

  it('le Dodo empêche de transformer les Cartes Gardes de SON lieu', () => {
    const dodo: CardInstance = { instanceId: 'd', cardId: 'dodo', name: 'Dodo', type: 'hero', strength: 4 }
    const s = setup([guard('g1'), dodo])
    expect(transformableGuards(s, 0)).toHaveLength(0)
    const after = resolveEffect(s, { type: 'TRANSFORM_GUARDS', max: 2 }, { actorIndex: 0 })
    expect(after.pendingTransformWickets ?? null).toBeNull()
  })

  it('jouer la carte met le jeu en attente, et bloque les autres coups', () => {
    let s = setup([guard('g1')])
    // Carte en main + pouvoir, pion sur un lieu avec « Jouer une carte ».
    const card: CardInstance = buildDeckInstances(reineCoeurCards, 'villain', 't:').find((c) => c.cardId === 'par-ordre-reine')!
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [card], power: 5 } : p)) }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, to: 'cour-palais' })
    expect(s.pendingTransformWickets?.playerIndex).toBe(0)
    // Un autre coup est refusé tant que la sélection n'est pas résolue.
    expect(() => applyAction(s, { type: 'END_TURN' })).toThrow()
  })
})
