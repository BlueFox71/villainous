// Pyramid Head — Phase 1 : tuiles de Jugement, souffrance, objectif, recouvrement.
// On joue sur un vilain à 4 lieux (Maléfique) dont on force la clé `custom-pyramid-head`.
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { resolveEffect, performVanquish } from '../effects'
import { hasReachedObjective, isActionCovered, effectiveStrength } from '../rules'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState, PlayerState, CardInstance } from '../types'

let cn = 0
const card = (type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: extra.instanceId ?? `c${cn++}`,
  cardId: extra.cardId ?? `card-${cn}`,
  name: extra.name ?? 'carte',
  type,
  ...extra,
})

const vil = buildDeckInstances(maleficentCards, 'villain', 'p0:')
const fate = buildDeckInstances(maleficentCards, 'fate', 'p0f:')

function phGame(patch: Partial<PlayerState> = {}): GameState {
  const base = createInitialGame([{ villain: maleficent, deckCards: vil, fateCards: fate }], 1)
  return {
    ...base,
    activePlayer: 0,
    players: base.players.map((p, i) =>
      i === 0 ? { ...p, villain: 'custom-pyramid-head', objective: { type: 'JUDGMENT_TILES_ALL' }, ...patch } : p,
    ),
  }
}

describe('Pyramid Head — tuiles de Jugement & souffrance', () => {
  it('Rites de Jugement pose la 1ʳᵉ tuile (judgmentTiles = 1)', () => {
    const s = resolveEffect(phGame(), { type: 'PYRAMID_PLACE_RITES' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles).toBe(1)
  })

  it('Métatron : GAIN_SOUFFRANCE ajoute une piste de souffrance', () => {
    const s = resolveEffect(phGame({ souffrance: 0 }), { type: 'GAIN_SOUFFRANCE', amount: 1 }, { actorIndex: 0 })
    expect(s.players[0].souffrance).toBe(1)
  })

  it('Propager : −1 souffrance, étend les tuiles vers la gauche (1 → 2)', () => {
    const s = resolveEffect(phGame({ judgmentTiles: 1, souffrance: 1 }), { type: 'PYRAMID_PROPAGATE' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles).toBe(2)
    expect(s.players[0].souffrance).toBe(0)
  })

  it('Propager : no-op sans souffrance', () => {
    const s = resolveEffect(phGame({ judgmentTiles: 1, souffrance: 0 }), { type: 'PYRAMID_PROPAGATE' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles).toBe(1)
  })

  it('Propager : no-op sans tuile de départ', () => {
    const s = resolveEffect(phGame({ judgmentTiles: 0, souffrance: 3 }), { type: 'PYRAMID_PROPAGATE' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles ?? 0).toBe(0)
    expect(s.players[0].souffrance).toBe(3) // rien dépensé
  })

  it('Dissipation : retire une tuile (2 → 1)', () => {
    const s = resolveEffect(phGame({ judgmentTiles: 2 }), { type: 'PYRAMID_REMOVE_TILE' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles).toBe(1)
  })

  it('Dissipation : la 1ʳᵉ tuile (Silent Hill) est INRETIRABLE (1 → 1)', () => {
    const s = resolveEffect(phGame({ judgmentTiles: 1 }), { type: 'PYRAMID_REMOVE_TILE' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles).toBe(1)
  })

  it('objectif : victoire quand TOUS les lieux sont tuilés', () => {
    const n = phGame().players[0].locations.length
    expect(hasReachedObjective(phGame({ judgmentTiles: n }), 0)).toBe(true)
    expect(hasReachedObjective(phGame({ judgmentTiles: n - 1 }), 0)).toBe(false)
  })

  it('une tuile recouvre les actions du HAUT de son lieu (lieu le plus à droite)', () => {
    const base = phGame({ judgmentTiles: 1 })
    const rightmost = base.players[0].locations[base.players[0].locations.length - 1]
    const topAction = rightmost.actions.find((a) => a.row === 'top')!
    const s: GameState = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: rightmost.id } : p)) }
    expect(isActionCovered(s, topAction)).toBe(true)
  })
})

describe('Pyramid Head — Phase 2 (cartes & héros Fatalité)', () => {
  const locId = () => phGame().players[0].locations[0].id
  const rightId = () => { const ls = phGame().players[0].locations; return ls[ls.length - 1].id }

  it('Infirmière : +1 Force par AUTRE Infirmière sur son lieu', () => {
    const L = locId()
    const i1 = card('ally', { instanceId: 'i1', cardId: 'infirmiere', name: 'Infirmière', strength: 1, selfStrengthMods: [{ kind: 'per-other-same-here', delta: 1 }] })
    const i2 = card('ally', { instanceId: 'i2', cardId: 'infirmiere', name: 'Infirmière', strength: 1, selfStrengthMods: [{ kind: 'per-other-same-here', delta: 1 }] })
    const s = phGame({ board: { [L]: [i1, i2] } })
    expect(effectiveStrength(s, 0, 'i1')).toBe(2) // 1 + 1 (l'autre Infirmière)
  })

  it('Métatron : Laura ajoute +1 au coût en Pouvoir', () => {
    const L = locId()
    const laura = card('hero', { instanceId: 'la', cardId: 'laura', name: 'Laura', strength: 4, souffranceSurcharge: true })
    const s = resolveEffect(phGame({ board: { [L]: [laura] }, power: 5, souffrance: 0 }), { type: 'GAIN_SOUFFRANCE', amount: 1 }, { actorIndex: 0 })
    expect(s.players[0].souffrance).toBe(1)
    expect(s.players[0].power).toBe(4) // −1 (Laura)
  })

  it('Métatron : James annule l’effet (aucune souffrance)', () => {
    const L = locId()
    const james = card('hero', { instanceId: 'jm', cardId: 'james', name: 'James', strength: 4, disablesMetatron: true })
    const s = resolveEffect(phGame({ board: { [L]: [james] }, souffrance: 0 }), { type: 'GAIN_SOUFFRANCE', amount: 1 }, { actorIndex: 0 })
    expect(s.players[0].souffrance ?? 0).toBe(0)
  })

  it('Angela (LOSE_SOUFFRANCE) : −1 souffrance', () => {
    const s = resolveEffect(phGame({ souffrance: 2 }), { type: 'LOSE_SOUFFRANCE', amount: 1 }, { actorIndex: 0 })
    expect(s.players[0].souffrance).toBe(1)
  })

  it('Angela : posée par la Fatalité, Pyramid Head perd bien 1 souffrance (onPlace)', () => {
    const angela = card('hero', { instanceId: 'an', cardId: 'angela', name: 'Angela', strength: 3, onPlace: [{ type: 'LOSE_SOUFFRANCE', amount: 1 }] })
    const base = phGame({ souffrance: 2 })
    const loc = base.players[0].locations[0].id
    const s = placeFateHeroWithEffects(base, 0, 0, angela, loc, 'lieu')
    expect(s.players[0].souffrance).toBe(1)
  })

  it('James (DISCARD_REALM_CARD) : défausse Métatron du royaume', () => {
    const L = locId()
    const meta = card('item', { instanceId: 'mt', cardId: 'custom-pyramid-head-metatron', name: 'Métatron' })
    const s = resolveEffect(phGame({ board: { [L]: [meta] } }), { type: 'DISCARD_REALM_CARD', cardId: 'custom-pyramid-head-metatron' }, { actorIndex: 0 })
    expect((s.players[0].board[L] ?? []).some((c) => c.instanceId === 'mt')).toBe(false)
    expect(s.players[0].discard.some((c) => c.instanceId === 'mt')).toBe(true)
  })

  it('Maria bloque la propagation sur son lieu', () => {
    const ls = phGame().players[0].locations
    const nextLeft = ls[ls.length - 2].id // lieu qui recevrait la 2ᵉ tuile
    const maria = card('hero', { instanceId: 'mar', cardId: 'maria', name: 'Maria', strength: 4, blocksJudgmentTile: true })
    const s = resolveEffect(phGame({ judgmentTiles: 1, souffrance: 2, board: { [nextLeft]: [maria] } }), { type: 'PYRAMID_PROPAGATE' }, { actorIndex: 0 })
    expect(s.players[0].judgmentTiles).toBe(1) // bloqué : pas d'extension
    expect(s.players[0].souffrance).toBe(2) // rien dépensé
  })

  it('Pacte de Sang : défausser une carte → récupérer une carte du MÊME type', () => {
    const inHand = card('effect', { instanceId: 'h1', cardId: 'aa', name: 'En main' })
    const same = card('effect', { instanceId: 'd1', cardId: 'bb', name: 'Effet défaussé' })
    const other = card('ally', { instanceId: 'd2', cardId: 'cc', name: 'Allié défaussé' })
    let s = phGame({ hand: [inHand], discard: [same, other] })
    s = resolveEffect(s, { type: 'PACTE_DE_SANG' }, { actorIndex: 0 })
    expect(s.pendingPacteSang?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_PACTE_SANG', instanceId: 'h1' })
    expect(s.players[0].discard.some((c) => c.instanceId === 'h1')).toBe(true) // défaussée
    expect(s.pendingRecover?.label).toBe('Pacte de sang')
    expect(s.pendingRecover?.candidateIds).toEqual(['d1']) // même type (effect), pas l'Allié
    const out = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: 'd1' })
    expect(out.players[0].hand.some((c) => c.instanceId === 'd1')).toBe(true)
  })

  it('Pacte de Sang : no-op si aucun type commun entre la main et la défausse', () => {
    const s = resolveEffect(
      phGame({ hand: [card('effect', { instanceId: 'h1' })], discard: [card('ally', { instanceId: 'd1' })] }),
      { type: 'PACTE_DE_SANG' },
      { actorIndex: 0 },
    )
    expect(s.pendingPacteSang ?? null).toBeNull()
  })

  it('Sacrifice Humain : ouvre le choix ; « gagner » donne 2 Pouvoir', () => {
    let s = resolveEffect(phGame({ power: 0 }), { type: 'SACRIFICE_HUMAIN_CHOICE' }, { actorIndex: 0 })
    expect(s.pendingSacrifice?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_SACRIFICE', choice: 'gain' })
    expect(s.pendingSacrifice ?? null).toBeNull()
    expect(s.players[0].power).toBe(2)
  })

  it('Sacrifice Humain : « regarder » ouvre le choix de la carte à garder (pendingLookTop)', () => {
    const deck = ['a', 'b', 'c', 'd'].map((id) => card('ally', { instanceId: id, name: id }))
    let s = resolveEffect(phGame({ deck }), { type: 'SACRIFICE_HUMAIN_CHOICE' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_SACRIFICE', choice: 'look' })
    expect(s.pendingLookTop).toBeTruthy()
  })

  it('Protection de l’âme : le Héros porteur ne peut pas être éliminé', () => {
    const R = rightId()
    const hero = card('hero', { instanceId: 'h1', cardId: 'cible', name: 'Cible', strength: 1 })
    const prot = card('item', { instanceId: 'pr', cardId: 'protection', name: 'Protection de l’âme', attachedTo: 'h1', shieldsHostFromVanquish: true })
    const ally = card('ally', { instanceId: 'a1', cardId: 'mannequin', name: 'Mannequin', strength: 5 })
    const s = phGame({ board: { [R]: [hero, prot, ally] }, pawnLocation: R })
    expect(() => performVanquish(s, 'h1', ['a1'], false)).toThrow()
  })

  it('Cage : à la pose, déplace le Héros porteur vers le lieu choisi (la cage suit)', () => {
    const ls = phGame().players[0].locations
    const L0 = ls[0].id
    const L1 = ls[1].id
    const hero = card('hero', { instanceId: 'h1', cardId: 'cible', name: 'Cible', strength: 2 })
    const cage = card('item', { instanceId: 'cg', cardId: 'cage', name: 'Cage', attachedTo: 'h1' })
    let s = phGame({ board: { [L0]: [hero, cage] } })
    s = resolveEffect(s, { type: 'CAGE_MOVE_HOST' }, { actorIndex: 0, hostInstanceId: 'cg' })
    expect(s.pendingCageMove?.heroInstanceId).toBe('h1')
    s = applyAction(s, { type: 'RESOLVE_CAGE_MOVE', locationId: L1 })
    expect((s.players[0].board[L1] ?? []).some((c) => c.instanceId === 'h1')).toBe(true)
    expect((s.players[0].board[L1] ?? []).some((c) => c.instanceId === 'cg')).toBe(true)
    expect((s.players[0].board[L0] ?? []).length).toBe(0)
  })

  it('Cage : CAGE_ARM arme la cage (trapArmed)', () => {
    const L0 = phGame().players[0].locations[0].id
    const cage = card('item', { instanceId: 'cg', cardId: 'cage', attachedTo: 'h1' })
    const s = resolveEffect(phGame({ board: { [L0]: [card('hero', { instanceId: 'h1' }), cage] } }), { type: 'CAGE_ARM' }, { actorIndex: 0, hostInstanceId: 'cg' })
    expect((s.players[0].board[L0] ?? []).find((c) => c.instanceId === 'cg')?.trapArmed).toBe(true)
  })

  it('Cage armée : le Héros porteur est éliminé au début du tour suivant', () => {
    const L0 = phGame().players[0].locations[0].id
    const hero = card('hero', { instanceId: 'h1', cardId: 'cible', name: 'Cible', strength: 2 })
    const cage = card('item', { instanceId: 'cg', cardId: 'cage', attachedTo: 'h1', trapArmed: true })
    const base = phGame({ board: { [L0]: [hero, cage] } })
    const s = applyAction({ ...base, phase: 'ACTION', status: 'PLAYING', activePlayer: 0 }, { type: 'END_TURN' })
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'h1')).toBe(false)
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
  })

  it('Cage armée sur Eddie (immuneToCage) : il survit, la cage se brise', () => {
    const L0 = phGame().players[0].locations[0].id
    const eddie = card('hero', { instanceId: 'ed', cardId: 'eddie', name: 'Eddie', immuneToCage: true })
    const cage = card('item', { instanceId: 'cg', cardId: 'cage', attachedTo: 'ed', trapArmed: true })
    const base = phGame({ board: { [L0]: [eddie, cage] } })
    const s = applyAction({ ...base, phase: 'ACTION', status: 'PLAYING', activePlayer: 0 }, { type: 'END_TURN' })
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'ed')).toBe(true)
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'cg')).toBe(false)
  })
})
