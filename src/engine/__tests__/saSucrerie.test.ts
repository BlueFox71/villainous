import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import {
  getAvailableActions,
  getLegalMoves,
  placementLocations,
  adjacentLocationIds,
  heroPlacementLocations,
} from '../rules'
import {
  accessibleTrackIndices,
  accessibleActionIds,
  trackMoveRange,
  bugOnVanellope,
  startRace,
  advanceRacer,
  moveKingCandyTrack,
  moveRacerBack,
} from '../kingCandy'
import { saSucrerie } from '../../data/villains/sa-sucrerie'
import { saSucrerieCards } from '../../data/villains/sa-sucrerie.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { chooseAction } from '../../ai/heuristicBot'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: saSucrerie,
        deckCards: buildDeckInstances(saSucrerieCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(saSucrerieCards, 'fate', 'p0f:'),
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

describe('Sa Sucrerie — mise en place du circuit', () => {
  it('le pion démarre à la case Départ/Arrivée (index 0), pas de course', () => {
    const p = game().players[0]
    expect(p.trackPos).toBe(0)
    expect(p.racerPos).toBeNull()
    expect(p.raceActive).toBe(false)
    expect(p.objective.type).toBe('KING_CANDY_RACE')
    // 5 lieux : le circuit (18 actions) + les 4 zones de pose (sans action).
    expect(p.locations).toHaveLength(5)
    expect(p.locations[0].id).toBe('sugar-rush')
    expect(p.locations[0].actions).toHaveLength(18)
    expect(p.locations.slice(1).map((l) => l.id)).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
    expect(p.locations.slice(1).every((l) => l.actions.length === 0)).toBe(true)
  })

  it('aucun déplacement de LIEU n’est légal (déplacement par MOVE_TRACK)', () => {
    expect(getLegalMoves(game())).toEqual([])
  })
})

describe('Sa Sucrerie — 4 zones de pose (cartes)', () => {
  it('on pose dans les 4 zones, jamais sur le circuit', () => {
    expect(placementLocations(game())).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
  })

  it('adjacence linéaire des zones (le circuit n’est jamais voisin d’une zone)', () => {
    const s = game()
    expect(adjacentLocationIds(s, 'zone-1')).toEqual(['zone-2'])
    expect([...adjacentLocationIds(s, 'zone-2')].sort()).toEqual(['zone-1', 'zone-3'])
    expect([...adjacentLocationIds(s, 'zone-3')].sort()).toEqual(['zone-2', 'zone-4'])
    expect(adjacentLocationIds(s, 'zone-4')).toEqual(['zone-3'])
    expect(adjacentLocationIds(s, 'zone-1')).not.toContain('sugar-rush')
  })

  it('un Héros de Fatalité ne peut se poser que dans une zone (pas le circuit)', () => {
    const hero = card('ralph-la-casse', 'hero', { strength: 6 })
    expect(heroPlacementLocations(game(), hero, 0)).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
  })
})

describe('Sa Sucrerie — accès aux 3 actions', () => {
  it('depuis la case 0, accède aux actions 17, 0, 1', () => {
    expect(accessibleTrackIndices(0)).toEqual([17, 0, 1])
  })
  it('depuis la case 5, accède aux actions 4, 5, 6', () => {
    expect(accessibleTrackIndices(5)).toEqual([4, 5, 6])
  })
  it('getAvailableActions est limité aux 3 cases accessibles', () => {
    const base = game()
    const s: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], trackPos: 5 }] }
    const ids = getAvailableActions(s).map((a) => a.id)
    // a4 = Gagner 3 Pouvoir, a5 = Jouer une carte, a6 = Défausser → tous accessibles ; a0 non.
    expect(ids).not.toContain('a0')
    for (const id of ids) expect(['a4', 'a5', 'a6']).toContain(id)
  })
})

describe('Sa Sucrerie — déplacement 1–4', () => {
  it('MOVE_TRACK avance le pion et passe en phase ACTION', () => {
    const s = applyAction(game(), { type: 'MOVE_TRACK', steps: 3 })
    expect(s.players[0].trackPos).toBe(3)
    expect(s.phase).toBe('ACTION')
  })
  it('un déplacement hors 1–4 est rejeté', () => {
    expect(() => applyAction(game(), { type: 'MOVE_TRACK', steps: 5 })).toThrow()
    expect(() => applyAction(game(), { type: 'MOVE_TRACK', steps: 0 })).toThrow()
  })
  it('Félix Fixe Jr. contraint le déplacement à 2–3', () => {
    const base = game()
    const felix = card('felix-fixe-jr', 'hero', { strength: 3 })
    const s: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { 'sugar-rush': [felix] } }],
    }
    expect(trackMoveRange(s.players[0])).toEqual({ min: 2, max: 3 })
    expect(() => applyAction(s, { type: 'MOVE_TRACK', steps: 1 })).toThrow()
    expect(applyAction(s, { type: 'MOVE_TRACK', steps: 2 }).players[0].trackPos).toBe(2)
  })
})

describe('Sa Sucrerie — course', () => {
  /** Pose Vanellope + un Bug associé sur le circuit. */
  const withBugOnVanellope = (base: GameState, patch: Partial<GameState['players'][number]> = {}): GameState => {
    const v = card('vanellope-von-schweetz', 'hero', { strength: 2 })
    const bug = card('bug', 'item', { attach: 'hero', attachedTo: v.instanceId })
    return {
      ...base,
      players: [{ ...base.players[0], board: { 'sugar-rush': [v, bug] }, ...patch }],
    }
  }

  it('détecte un Bug associé à Vanellope', () => {
    expect(bugOnVanellope(withBugOnVanellope(game()).players[0])).toBe(true)
    expect(bugOnVanellope(game().players[0])).toBe(false)
  })

  it('startRace place pion et jeton Pilote à Départ/Arrivée', () => {
    const s = startRace(withBugOnVanellope(game()), 0)
    expect(s.players[0].trackPos).toBe(0)
    expect(s.players[0].racerPos).toBe(0)
    expect(s.players[0].raceActive).toBe(true)
  })

  it('franchir Départ/Arrivée avec un Bug sur Vanellope = VICTOIRE', () => {
    let s = startRace(withBugOnVanellope(game()), 0)
    // pion à 15, le jeton Pilote loin derrière
    s = { ...s, players: [{ ...s.players[0], trackPos: 15, racerPos: 2 }] }
    s = moveKingCandyTrack(s, 0, 4) // 15 + 4 = 19 ≥ 18 → franchit
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('sans Bug sur Vanellope, franchir la ligne ne gagne pas', () => {
    let s = startRace(game(), 0) // pas de Vanellope/Bug
    s = { ...s, players: [{ ...s.players[0], trackPos: 16 }] }
    s = moveKingCandyTrack(s, 0, 4)
    expect(s.status).not.toBe('WON')
    expect(s.players[0].trackPos).toBe(2) // 20 % 18
  })

  it('le jeton Pilote qui franchit la ligne le premier ARRÊTE la course et rend les Bugs', () => {
    let s = startRace(withBugOnVanellope(game()), 0)
    s = { ...s, players: [{ ...s.players[0], racerPos: 16 }] }
    s = advanceRacer(s, 0, 4) // 16 + 4 = 20 ≥ 18 → le Pilote finit
    expect(s.players[0].raceActive).toBe(false)
    // le Bug est revenu en main, plus associé à Vanellope
    expect(bugOnVanellope(s.players[0])).toBe(false)
    expect(s.players[0].hand.some((c) => c.cardId === 'bug')).toBe(true)
  })

  it('moveRacerBack recule le jeton Pilote (borné à 0)', () => {
    let s = startRace(withBugOnVanellope(game()), 0)
    s = { ...s, players: [{ ...s.players[0], racerPos: 5 }] }
    expect(moveRacerBack(s, 0, 2).players[0].racerPos).toBe(3)
    expect(moveRacerBack(s, 0, 99).players[0].racerPos).toBe(0)
  })
})

describe('Sa Sucrerie — partie pilotée par le bot (anti-soft-lock)', () => {
  const seededRand = (seed: number): (() => number) => {
    let x = seed >>> 0
    return () => {
      x = (x * 1664525 + 1013904223) >>> 0
      return x / 0xffffffff
    }
  }
  it('le bot enchaîne MOVE_TRACK → actions → fin de tour sans blocage', () => {
    let s = createInitialGame(
      [
        { villain: saSucrerie, deckCards: buildDeckInstances(saSucrerieCards, 'villain', 'p0:'), fateCards: buildDeckInstances(saSucrerieCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      42,
    )
    const rand = seededRand(123)
    let steps = 0
    let kingCandyMoved = false
    while (s.status === 'PLAYING' && steps < 400) {
      const a = chooseAction(s, rand)
      if (a.type === 'MOVE_TRACK') kingCandyMoved = true
      s = applyAction(s, a)
      steps++
    }
    // Le bot a bien utilisé le déplacement de circuit au moins une fois.
    expect(kingCandyMoved).toBe(true)
    // La partie a progressé (plusieurs tours), sans exception ni blocage.
    expect(s.turn).toBeGreaterThan(3)
  })

  it('Turbo-Statique rend les 3 actions accessibles même recouvertes par le jeton Pilote', () => {
    const base = game()
    // jeton Pilote sur l'action 1 (a1) ; pion en 0 → a1 accessible mais recouvert
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 0, racerPos: 1, raceActive: true }],
    }
    expect(getAvailableActions(s).map((a) => a.id)).not.toContain('a1')
    s = { ...s, players: [{ ...s.players[0], turboUncoverThisTurn: true }] }
    expect(accessibleActionIds(s.players[0]).has('a1')).toBe(true)
    expect(getAvailableActions(s).map((a) => a.id)).toContain('a1')
  })
})
