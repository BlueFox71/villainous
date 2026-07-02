// Mr. Monopoly — Phase 1 : maisons, loyer, objectif Pouvoir. On joue à 2 joueurs
// (Maléfique de part et d'autre) en forçant la clé `custom-mr-monopoly` sur le joueur 0.
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { getLegalMoves } from '../rules'
import { resolveEffect } from '../effects'
import {
  baseHouseCost,
  buyHouseCost,
  placeableHouses,
  rentAt,
  totalHouses,
  shadowDiscount,
} from '../monopoly'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState, PlayerState, CardInstance } from '../types'

let cn = 0
const card = (type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: extra.instanceId ?? `m${cn++}`,
  cardId: extra.cardId ?? `card-${cn}`,
  name: extra.name ?? 'carte',
  type,
  ...extra,
})

const vil = buildDeckInstances(maleficentCards, 'villain', 'p0:')
const fate = buildDeckInstances(maleficentCards, 'fate', 'p0f:')
const vil1 = buildDeckInstances(maleficentCards, 'villain', 'p1:')
const fate1 = buildDeckInstances(maleficentCards, 'fate', 'p1f:')

/** Partie à 2 joueurs : joueur 0 = Mr. Monopoly (objectif 30 Pouvoir), joueur 1 = adversaire. */
function monoGame(p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}): GameState {
  const base = createInitialGame(
    [
      { villain: maleficent, deckCards: vil, fateCards: fate },
      { villain: maleficent, deckCards: vil1, fateCards: fate1 },
    ],
    1,
  )
  return {
    ...base,
    activePlayer: 0,
    players: base.players.map((p, i) =>
      i === 0
        ? { ...p, villain: 'custom-mr-monopoly', objective: { type: 'POWER_THRESHOLD', threshold: 30 }, houses: {}, ...p0 }
        : { ...p, ...p1 },
    ),
  }
}

describe('Mr. Monopoly — coût des maisons', () => {
  it('coût standard : 2 sur le repaire (lieu le plus à gauche), 1 ailleurs', () => {
    const g = monoGame()
    const opp = g.players[1]
    expect(baseHouseCost(opp, opp.locations[0].id)).toBe(2)
    expect(baseHouseCost(opp, opp.locations[1].id)).toBe(1)
  })

  it("L'Ombre de Monopoly réduit le coût d'ACHAT de 1 (pas le loyer)", () => {
    const g = monoGame()
    const opp = g.players[1]
    const mmPawn = g.players[0].pawnLocation!
    // L'Ombre sur le lieu du pion de Mr. Monopoly.
    const withShadow = monoGame({
      board: { ...g.players[0].board, [mmPawn]: [card('item', { shadowReducesHouseCost: true })] },
    })
    expect(shadowDiscount(withShadow.players[0])).toBe(1)
    // Achat sur le repaire : 2 − 1 = 1 ; loyer reste basé sur 2.
    expect(buyHouseCost(withShadow.players[0], opp, opp.locations[0].id)).toBe(1)
    expect(baseHouseCost(opp, opp.locations[0].id)).toBe(2)
    // Sur un lieu adverse normal (coût 1), L'Ombre rend la maison GRATUITE (1 − 1 = 0).
    expect(buyHouseCost(withShadow.players[0], opp, opp.locations[1].id)).toBe(0)
  })
})

describe('Mr. Monopoly — Officier de police', () => {
  it('joué sur un lieu portant un Héros → l’envoie en Prison', () => {
    // Plateau minimal : action « Jouer une carte » en bas (NON recouverte par le Héros).
    const LOCS = [
      { id: 'loc-1', name: 'Rue', actions: [{ id: 'play-1', type: 'PLAY_CARD' as const, label: 'Jouer une carte', row: 'bottom' as const }] },
      { id: 'loc-4', name: 'Prison', actions: [] },
    ]
    const officier = card('ally', { instanceId: 'off', cardId: 'officier-de-police', name: 'Officier de police', cost: 0, strength: 2, sendsHeroToPrisonOnMove: 'loc-4' })
    const hero = card('hero', { instanceId: 'h', cardId: 'heroX', name: 'Héros', strength: 3 })
    const g = {
      ...monoGame({ power: 5, pawnLocation: 'loc-1', locations: LOCS, hand: [officier], board: { 'loc-1': [hero], 'loc-4': [] } }),
      phase: 'ACTION' as const,
    }
    const s = applyAction(g, { type: 'PLAY_CARD', actionId: 'play-1', instanceId: 'off', to: 'loc-1' })
    expect((s.players[0].board['loc-1'] ?? []).some((c) => c.instanceId === 'off')).toBe(true) // Officier posé
    expect((s.players[0].board['loc-4'] ?? []).some((c) => c.instanceId === 'h')).toBe(true) // Héros en Prison
    expect((s.players[0].board['loc-1'] ?? []).some((c) => c.instanceId === 'h')).toBe(false)
  })
})

describe('Mr. Monopoly — Affaire (pose de maisons)', () => {
  it('MONOPOLY_BUY_HOUSES ouvre le choix sur le lieu de l’adversaire', () => {
    const g = monoGame({ power: 5 })
    const oppPawn = g.players[1].pawnLocation!
    const s = resolveEffect(g, { type: 'MONOPOLY_BUY_HOUSES' }, { actorIndex: 0 })
    expect(s.pendingBuyHouses?.locationId).toBe(oppPawn)
    expect(s.pendingBuyHouses?.max).toBeGreaterThanOrEqual(1)
  })

  it('RESOLVE_BUY_HOUSES pose N maisons et débite le Pouvoir', () => {
    const g = monoGame({ power: 5 })
    const oppPawn = g.players[1].pawnLocation! // = repaire (locations[0]) → 2 JT/maison
    const opened = resolveEffect(g, { type: 'MONOPOLY_BUY_HOUSES' }, { actorIndex: 0 })
    const s = applyAction(opened, { type: 'RESOLVE_BUY_HOUSES', amount: 2 })
    expect(s.players[0].houses?.[oppPawn]).toBe(2)
    expect(s.players[0].power).toBe(5 - 2 * 2) // 2 maisons × 2 JT
    expect(s.pendingBuyHouses ?? null).toBeNull()
  })

  it('Affaire : plafonné par le Pouvoir disponible', () => {
    const g = monoGame({ power: 1 }) // repaire = 2 JT/maison → 0 abordable
    // place le pion adverse sur un lieu non-repaire (1 JT/maison)
    const opp = g.players[1]
    const normal = opp.locations[1].id
    const g2 = monoGame({ power: 1 }, { pawnLocation: normal })
    const s = resolveEffect(g2, { type: 'MONOPOLY_BUY_HOUSES' }, { actorIndex: 0 })
    expect(s.pendingBuyHouses?.max).toBe(1)
  })

  it('plafond hôtel : 4 maisons → on peut encore poser la 5ᵉ (hôtel), puis plus rien', () => {
    const g = monoGame()
    const loc = g.players[1].locations[1].id
    expect(placeableHouses(monoGame({ houses: { [loc]: 4 } }).players[0], loc)).toBe(1) // la 5ᵉ = hôtel
    expect(placeableHouses(monoGame({ houses: { [loc]: 5 } }).players[0], loc)).toBe(0) // hôtel atteint
  })
})

describe('Mr. Monopoly — loyer', () => {
  it('encaisse le loyer quand l’adversaire arrive sur un lieu maisonné', () => {
    // L'adversaire (joueur 1) est actif et se déplace.
    const base = monoGame({}, {})
    const oppStart = base.players[1].pawnLocation!
    const g = { ...base, activePlayer: 1, phase: 'MOVE' as const }
    const dest = getLegalMoves(g).find((d) => d !== oppStart)!
    // 2 maisons sur la destination (lieu non-repaire si possible → 1 JT chacune).
    const cost = baseHouseCost(g.players[1], dest)
    const withHouses = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, houses: { [dest]: 2 }, power: 0 } : p)) }
    const after = applyAction(withHouses, { type: 'MOVE', to: dest })
    expect(after.players[0].power).toBe(2 * cost)
  })

  it('Fer à repasser (blocksRent) annule tout loyer', () => {
    const g = monoGame()
    const loc = g.players[1].locations[1].id
    const mm: PlayerState = {
      ...g.players[0],
      houses: { [loc]: 3 },
      board: { ...g.players[0].board, [g.players[0].pawnLocation!]: [card('hero', { blocksRent: true })] },
    }
    expect(rentAt(mm, g.players[1], loc)).toBe(0)
  })

  it('Fer à repasser bloque le LOYER mais PAS les autres gains de Pouvoir (action/cartes)', () => {
    const base = monoGame({ power: 0 })
    const loc0 = base.players[0].locations[0].id
    const withFer = monoGame({
      power: 0,
      board: { ...base.players[0].board, [loc0]: [card('hero', { blocksRent: true })] },
    })
    const s = resolveEffect(withFer, { type: 'GAIN_POWER', amount: 3 }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(3) // GAIN_POWER (action « Gagner du Pouvoir », cartes) intact
  })
})

describe('Mr. Monopoly — Erreur de la banque (gain par maison)', () => {
  it('+1 Pouvoir par maison, plafonné à max', () => {
    const loc = 'loc-1'
    const g = monoGame({ power: 0, houses: { [loc]: 3 } })
    const s = resolveEffect(g, { type: 'MONOPOLY_GAIN_PER_HOUSE', max: 5 }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(3)
    const g2 = monoGame({ power: 0, houses: { a: 4, b: 4 } })
    const s2 = resolveEffect(g2, { type: 'MONOPOLY_GAIN_PER_HOUSE', max: 5 }, { actorIndex: 0 })
    expect(s2.players[0].power).toBe(5) // 8 maisons mais plafonné à 5
  })

  it('Carte bancaire : déplace une maison d’un lieu vers un autre', () => {
    const g = monoGame()
    const a = g.players[1].locations[1].id
    const b = g.players[1].locations[2].id
    const start = monoGame({ houses: { [a]: 2 } })
    const opened = resolveEffect(start, { type: 'MONOPOLY_MOVE_HOUSES', count: 1 }, { actorIndex: 0 })
    expect(opened.pendingMoveHouses?.phase).toBe('from')
    const fromPicked = applyAction(opened, { type: 'RESOLVE_MOVE_HOUSES', locationId: a })
    expect(fromPicked.pendingMoveHouses?.phase).toBe('to')
    const done = applyAction(fromPicked, { type: 'RESOLVE_MOVE_HOUSES', locationId: b })
    expect(done.players[0].houses?.[a]).toBe(1)
    expect(done.players[0].houses?.[b]).toBe(1)
    expect(totalHouses(done.players[0])).toBe(2)
  })
})

describe('Mr. Monopoly — Chapeau, destruction, Brouette', () => {
  it('Chapeau haut de forme : ouvre la pose de maisons si une Affaire est en défausse', () => {
    const g = monoGame({ power: 5, discard: [card('effect', { cardId: 'custom-mr-monopoly-affaire', name: 'Affaire' })] })
    const s = resolveEffect(g, { type: 'MONOPOLY_FETCH_AFFAIRE', affaireCardId: 'custom-mr-monopoly-affaire' }, { actorIndex: 0 })
    expect(s.pendingBuyHouses).toBeTruthy()
  })

  it('Chapeau : sans Affaire en défausse, aucun effet', () => {
    const g = monoGame({ power: 5, discard: [] })
    const s = resolveEffect(g, { type: 'MONOPOLY_FETCH_AFFAIRE', affaireCardId: 'custom-mr-monopoly-affaire' }, { actorIndex: 0 })
    expect(s.pendingBuyHouses ?? null).toBeNull()
  })

  it('MONOPOLY_DESTROY_HOUSE retire une maison (lieu unique)', () => {
    const g = monoGame()
    const loc = g.players[1].locations[1].id
    const start = monoGame({ houses: { [loc]: 2 } })
    const s = resolveEffect(start, { type: 'MONOPOLY_DESTROY_HOUSE' }, { actorIndex: 0 })
    expect(s.players[0].houses?.[loc]).toBe(1)
  })

  it('Chaussure : bloque la pose de maisons UNIQUEMENT quand le pion est sur son lieu', () => {
    const base = monoGame()
    const shoeLoc = base.players[0].locations[1].id
    const oppLoc = base.players[1].locations[1].id
    const shoe = card('hero', { blocksHousesWhenPawnHere: true })
    // Pion AILLEURS que sur la Chaussure → pose possible.
    const away = monoGame({ pawnLocation: base.players[0].locations[0].id, board: { ...base.players[0].board, [shoeLoc]: [shoe] } })
    expect(placeableHouses(away.players[0], oppLoc)).toBeGreaterThan(0)
    // Pion SUR le lieu de la Chaussure → pose bloquée partout.
    const onShoe = monoGame({ pawnLocation: shoeLoc, board: { ...base.players[0].board, [shoeLoc]: [shoe] } })
    expect(placeableHouses(onShoe.players[0], oppLoc)).toBe(0)
  })

  it('Brouette (reducesPowerGains) : chaque gain de Pouvoir est réduit de 1', () => {
    const base = monoGame({ power: 0 })
    const loc0 = base.players[0].locations[0].id
    const withBrouette = monoGame({
      power: 0,
      board: { ...base.players[0].board, [loc0]: [card('hero', { reducesPowerGains: true })] },
    })
    const s = resolveEffect(withBrouette, { type: 'GAIN_POWER', amount: 3 }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(2) // 3 − 1
  })
})

describe('Mr. Monopoly — Case Départ, Reculez, Monotonie', () => {
  it('Case Départ : +1 Pouvoir quand le pion se rend sur son lieu', () => {
    const base = monoGame({ power: 0 })
    const start = base.players[0].pawnLocation!
    const g = { ...base, activePlayer: 0, phase: 'MOVE' as const }
    const dest = getLegalMoves(g).find((d) => d !== start)!
    const withCase = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, [dest]: [card('item', { powerOnPawnCrossOrLand: 1 })] } } : p,
      ),
    }
    const after = applyAction(withCase, { type: 'MOVE', to: dest })
    expect(after.players[0].power).toBe(1)
  })

  it('Reculez de trois cases : déplace le pion + plafonne à 1 action + interdit la Fatalité', () => {
    const g = monoGame()
    const opened = resolveEffect(g, { type: 'MONOPOLY_BACKWARD_MOVE' }, { actorIndex: 0 })
    expect(opened.pendingBackwardMove?.playerIndex).toBe(0)
    const dest = g.players[0].locations[2].id
    const s = applyAction(opened, { type: 'RESOLVE_BACKWARD_MOVE', locationId: dest })
    expect(s.players[0].pawnLocation).toBe(dest)
    expect(s.players[0].actionsCap).toBe(1)
    expect(s.monopolyNoFate).toBe(true)
  })

  it('Monotonie : ouvre le rejeu gratuit d’une carte de la défausse', () => {
    const g = monoGame({ discard: [card('effect', { name: 'Affaire', cardId: 'custom-mr-monopoly-affaire' })] })
    const s = resolveEffect(g, { type: 'MONOPOLY_MONOTONY' }, { actorIndex: 0 })
    expect(s.pendingReplayEvent?.free).toBe(true)
    expect(s.pendingReplayEvent?.playFromDiscard).toBe(true)
  })

  it('Canne : emprunte une action d’un lieu maisonné adverse + 1 Pouvoir', () => {
    const base = monoGame({ power: 0 })
    const canneLoc = base.players[0].pawnLocation!
    const oppLoc = base.players[1].locations[1].id
    const g = {
      ...base,
      phase: 'ACTION' as const,
      activePlayer: 0,
      players: base.players.map((p, i) =>
        i === 0
          ? { ...p, houses: { [oppLoc]: 1 }, board: { ...p.board, [canneLoc]: [card('item', { cardId: 'custom-mr-monopoly-canne' })] } }
          : p,
      ),
    }
    const opened = applyAction(g, { type: 'USE_CANNE_MONOPOLY' })
    expect((opened.pendingCanneBorrow?.options.length ?? 0)).toBeGreaterThanOrEqual(1)
    const opt = opened.pendingCanneBorrow!.options[0]
    const done = applyAction(opened, { type: 'RESOLVE_CANNE_BORROW', locationId: opt.locationId, actionId: opt.actionId })
    expect(done.players[0].power).toBeGreaterThanOrEqual(1) // au moins le +1 garanti
    expect(done.usedActionIds).toContain('canne-action')
  })
})
