import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { ultron, ultronCards } from '../../data/published/ultron'
import { buildDeckInstances } from '../../data/types'
import { applyAction } from '../actions'
import { hasReachedObjective, ultronOptimizeAvailable, ultronUpgradeConditionMet } from '../rules'
import type { CardInstance, GameState, PlayerState } from '../types'

const LOCS = ultron.locations.map((l) => l.id) // loc-1..loc-4
const deck = buildDeckInstances(ultronCards, 'villain', 't:')
const sentries = deck.filter((c) => c.isSentry)
const alloys = deck.filter((c) => c.cardId === 'ultron-alliage-impenetrable')
const droneCombat = () => ({ ...deck.find((c) => c.cardId === 'ultron-drone-de-combat')! })

function ultronGame(): GameState {
  return createInitialGame(
    [{ villain: ultron, deckCards: [...deck], fateCards: buildDeckInstances(ultronCards, 'fate', 'tf:') }],
    999,
  )
}
const active = (s: GameState): PlayerState => s.players[s.activePlayer]
function patch(s: GameState, p: Partial<PlayerState>): GameState {
  return { ...s, players: s.players.map((pl, i) => (i === s.activePlayer ? { ...pl, ...p } : pl)) }
}
function board(s: GameState, b: Record<string, CardInstance[]>): GameState {
  return patch(s, { board: b })
}

describe('Ultron — tuiles Amélioration', () => {
  it('objectif ULTRON_AGE_REVEALED, 0 tuile au départ, non gagné', () => {
    const s = ultronGame()
    expect(active(s).objective.type).toBe('ULTRON_AGE_REVEALED')
    expect(active(s).ultronUpgrades ?? 0).toBe(0)
    expect(hasReachedObjective(s)).toBe(false)
  })

  it('Transformation : défausser 2 Sentinelles révèle la 1re tuile', () => {
    const [a, b] = sentries
    let s = board(ultronGame(), { [LOCS[0]]: [{ ...a }, { ...b }] })
    expect(ultronUpgradeConditionMet(s)).toBe(true)
    s = applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE', discard: [a.instanceId, b.instanceId] })
    expect(active(s).ultronUpgrades).toBe(1)
    expect(active(s).ultronUpgradeThisTurn).toBe(true)
    // les 2 Sentinelles sont parties du plateau vers la défausse
    expect((active(s).board[LOCS[0]] ?? []).length).toBe(0)
    expect(active(s).discard.filter((c) => c.isSentry).length).toBe(2)
  })

  it('une seule Amélioration par tour', () => {
    const [a, b, c, d] = sentries
    let s = board(ultronGame(), { [LOCS[0]]: [{ ...a }, { ...b }, { ...c }, { ...d }] })
    s = applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE', discard: [a.instanceId, b.instanceId] })
    expect(() => applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE', discard: [c.instanceId, d.instanceId] })).toThrow()
  })

  it('sans 2 Sentinelles, la condition est fausse et l’action lève', () => {
    const s = board(ultronGame(), { [LOCS[0]]: [{ ...sentries[0] }] })
    expect(ultronUpgradeConditionMet(s)).toBe(false)
    expect(() => applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE', discard: [sentries[0].instanceId] })).toThrow()
  })

  it('Optimisation : défausser un Drone de combat portant 2 Alliage impénétrable', () => {
    const drone = droneCombat()
    const al1 = { ...alloys[0], attachedTo: drone.instanceId }
    const al2 = { ...alloys[1], attachedTo: drone.instanceId }
    let s = patch(ultronGame(), { ultronUpgrades: 1 })
    s = board(s, { [LOCS[0]]: [drone, al1, al2] })
    expect(ultronUpgradeConditionMet(s)).toBe(true)
    s = applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE', discard: [drone.instanceId] })
    expect(active(s).ultronUpgrades).toBe(2)
    // le Drone ET ses 2 Alliages partent à la défausse
    expect((active(s).board[LOCS[0]] ?? []).length).toBe(0)
    expect(active(s).discard.length).toBe(3)
  })

  it('Forme finale : ≥1 Sentinelle sur chaque lieu, sans défausse', () => {
    let s = patch(ultronGame(), { ultronUpgrades: 2 })
    s = board(s, Object.fromEntries(LOCS.map((loc, i) => [loc, [{ ...sentries[i] }]])))
    expect(ultronUpgradeConditionMet(s)).toBe(true)
    s = applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE' })
    expect(active(s).ultronUpgrades).toBe(3)
    // aucune Sentinelle défaussée (Forme finale ne défausse pas)
    expect(active(s).discard.length).toBe(0)
  })

  it('Forme finale : manque une Sentinelle sur un lieu → condition fausse', () => {
    let s = patch(ultronGame(), { ultronUpgrades: 2 })
    s = board(s, Object.fromEntries(LOCS.slice(0, 3).map((loc, i) => [loc, [{ ...sentries[i] }]])))
    expect(ultronUpgradeConditionMet(s)).toBe(false)
  })

  it('L’ère d’Ultron : payer 12 Pouvoir → victoire immédiate', () => {
    let s = patch(ultronGame(), { ultronUpgrades: 3, power: 12 })
    expect(ultronUpgradeConditionMet(s)).toBe(true)
    s = applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE' })
    expect(active(s).ultronUpgrades).toBe(4)
    expect(active(s).power).toBe(0)
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(s.activePlayer)
    expect(hasReachedObjective(s)).toBe(true)
  })

  it('Forme finale (3 tuiles révélées) : +1 Pouvoir au début du tour', () => {
    let s = patch(ultronGame(), { ultronUpgrades: 3, power: 5 })
    s = applyAction(s, { type: 'MOVE', to: LOCS[1] }) // passe la phase de déplacement
    s = applyAction(s, { type: 'END_TURN' }) // → début du tour suivant (solo : même joueur)
    expect(active(s).power).toBe(6)
  })

  it('sans Forme finale (2 tuiles), pas de bonus de Pouvoir en début de tour', () => {
    let s = patch(ultronGame(), { ultronUpgrades: 2, power: 5 })
    s = applyAction(s, { type: 'MOVE', to: LOCS[1] }) // passe la phase de déplacement
    s = applyAction(s, { type: 'END_TURN' })
    expect(active(s).power).toBe(5)
  })

  it('L’ère d’Ultron : moins de 12 Pouvoir → condition fausse et action lève', () => {
    const s = patch(ultronGame(), { ultronUpgrades: 3, power: 11 })
    expect(ultronUpgradeConditionMet(s)).toBe(false)
    expect(() => applyAction(s, { type: 'ULTRON_COMPLETE_UPGRADE' })).toThrow()
  })
})

describe('Ultron — Transformation (passif : reprendre une carte en jouant une Sentinelle)', () => {
  const nonSentries = deck.filter((c) => !c.isSentry && c.type !== 'ally')
  // Prépare une partie : Transformation révélée, une Sentinelle en main, 2 cartes en défausse,
  // du Pouvoir, et le pion sur un lieu à action « Jouer une carte ».
  function setup(opts: { upgrades?: number } = {}): GameState {
    const sentry = { ...sentries[0] }
    const d1 = { ...nonSentries[0] }
    const d2 = { ...nonSentries[1] }
    let s = patch(ultronGame(), {
      ultronUpgrades: opts.upgrades ?? 1,
      power: 20,
      hand: [sentry, { ...sentries[1] }],
      discard: [d1, d2],
      board: {},
    })
    s = applyAction(s, { type: 'MOVE', to: LOCS[3] }) // Complexe Stark : 2 actions « Jouer une carte »
    return s
  }

  it('en jouant une Sentinelle (Transformation révélée), ouvre une reprise FACULTATIVE', () => {
    let s = setup()
    const sentry = active(s).hand.find((c) => c.isSentry)!
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: sentry.instanceId, to: LOCS[3] })
    expect(s.pendingRecover?.label).toBe('Transformation')
    expect(s.pendingRecover?.optional).toBe(true)
    expect(s.pendingRecover?.candidateIds.length).toBe(2)
    expect(active(s).ultronTransfoUsedThisTurn).toBe(true)
  })

  it('reprendre une carte : elle passe de la défausse à la main', () => {
    let s = setup()
    const sentry = active(s).hand.find((c) => c.isSentry)!
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: sentry.instanceId, to: LOCS[3] })
    const target = s.pendingRecover!.candidateIds[0]
    s = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: target })
    expect(s.pendingRecover).toBeNull()
    expect(active(s).hand.some((c) => c.instanceId === target)).toBe(true)
    expect(active(s).discard.some((c) => c.instanceId === target)).toBe(false)
  })

  it('ne rien reprendre (skip) : la défausse reste intacte', () => {
    let s = setup()
    const sentry = active(s).hand.find((c) => c.isSentry)!
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: sentry.instanceId, to: LOCS[3] })
    const discardBefore = active(s).discard.length
    s = applyAction(s, { type: 'RESOLVE_RECOVER' }) // sans instanceId = ne rien reprendre
    expect(s.pendingRecover).toBeNull()
    expect(active(s).discard.length).toBe(discardBefore)
  })

  it('une seule fois par tour : une 2ᵉ Sentinelle ne rouvre pas la reprise', () => {
    let s = setup()
    const s1 = active(s).hand.filter((c) => c.isSentry)
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: s1[0].instanceId, to: LOCS[3] })
    s = applyAction(s, { type: 'RESOLVE_RECOVER' }) // ferme le 1er pending
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play2', instanceId: s1[1].instanceId, to: LOCS[3] })
    expect(s.pendingRecover).toBeNull()
  })

  it('sans Transformation révélée (0 tuile), jouer une Sentinelle ne déclenche rien', () => {
    let s = setup({ upgrades: 0 })
    const sentry = active(s).hand.find((c) => c.isSentry)!
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: sentry.instanceId, to: LOCS[3] })
    expect(s.pendingRecover ?? null).toBeNull()
    expect(active(s).ultronTransfoUsedThisTurn ?? false).toBe(false)
  })
})

describe('Ultron — Optimisation (passif : action « Jouer une carte » utilisée comme « Déplacer »)', () => {
  // loc-2 (Chaîne de Fabrication) : action « play » (PLAY_CARD) ; adjacent à loc-1 et loc-3.
  function setup(opts: { upgrades?: number } = {}): GameState {
    let s = patch(ultronGame(), {
      ultronUpgrades: opts.upgrades ?? 2,
      board: { [LOCS[1]]: [{ ...sentries[0] }] },
    })
    s = applyAction(s, { type: 'MOVE', to: LOCS[1] })
    return s
  }

  it('disponibilité : révélée (≥2 tuiles) + un Allié déplaçable', () => {
    expect(ultronOptimizeAvailable(setup())).toBe(true)
    expect(ultronOptimizeAvailable(setup({ upgrades: 1 }))).toBe(false)
  })

  it('déplace un Allié via une action « Jouer », consomme le slot et arme le 1×/tour', () => {
    let s = setup()
    const ally = active(s).board[LOCS[1]][0]
    s = applyAction(s, { type: 'ULTRON_OPTIMIZE_MOVE', actionId: 'play', instanceId: ally.instanceId, to: LOCS[2] })
    expect((active(s).board[LOCS[1]] ?? []).length).toBe(0)
    expect((active(s).board[LOCS[2]] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(true)
    expect(s.usedActionIds).toContain('play')
    expect(active(s).ultronOptimUsedThisTurn).toBe(true)
    // l'action « play » a retrouvé son type d'origine dans les données de lieu
    expect(active(s).locations.find((l) => l.id === LOCS[1])!.actions.find((a) => a.id === 'play')!.type).toBe('PLAY_CARD')
  })

  it('une seule fois par tour : un 2ᵉ Optimisation lève', () => {
    let s = setup()
    const ally = active(s).board[LOCS[1]][0]
    s = applyAction(s, { type: 'ULTRON_OPTIMIZE_MOVE', actionId: 'play', instanceId: ally.instanceId, to: LOCS[2] })
    const ally2 = active(s).board[LOCS[2]][0]
    expect(() => applyAction(s, { type: 'ULTRON_OPTIMIZE_MOVE', actionId: 'play', instanceId: ally2.instanceId, to: LOCS[1] })).toThrow()
  })

  it('sans Optimisation révélée (1 tuile), l’action lève', () => {
    const s = setup({ upgrades: 1 })
    const ally = active(s).board[LOCS[1]][0]
    expect(() => applyAction(s, { type: 'ULTRON_OPTIMIZE_MOVE', actionId: 'play', instanceId: ally.instanceId, to: LOCS[2] })).toThrow()
  })

  it('cibler une action qui n’est pas « Jouer une carte » lève', () => {
    const s = setup()
    const ally = active(s).board[LOCS[1]][0]
    // « gain » (GAIN_POWER) n'est pas une action « Jouer une carte »
    expect(() => applyAction(s, { type: 'ULTRON_OPTIMIZE_MOVE', actionId: 'gain', instanceId: ally.instanceId, to: LOCS[2] })).toThrow()
  })
})
