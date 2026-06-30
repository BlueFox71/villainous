import { describe, it, expect } from 'vitest'
import { ratigan } from '../../data/villains/ratigan'
import { ratiganCards } from '../../data/villains/ratigan.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import { resolveEffects } from '../effects'
import type { GameState, LocationAction } from '../types'

function game(): GameState {
  return createInitialGame(
    [{ villain: ratigan, deckCards: buildDeckInstances(ratiganCards, 'villain', 'p0:'), fateCards: buildDeckInstances(ratiganCards, 'fate', 'p0f:') }],
    7,
  )
}

const A_ACTIONS: LocationAction[] = [{ id: 'gain', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1 pouvoir' }]
const B_ACTIONS: LocationAction[] = [
  { id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' },
  { id: 'vanquish', type: 'VANQUISH', row: 'bottom', label: 'Éliminer un héros' },
]

/** État de départ : le lieu `big-ben` rendu TRANSFORMABLE (face A active, face B en réserve). */
function withTransformable(): GameState {
  const base = game()
  const p = base.players[0]
  return {
    ...base,
    players: [
      {
        ...p,
        locations: p.locations.map((l) =>
          l.id === 'big-ben'
            ? { ...l, name: 'Face A', actions: A_ACTIONS, altName: 'Face B', altActions: B_ACTIONS, version: 'a', bColumnImage: 'b.png' }
            : l,
        ),
      },
    ],
  }
}

const bigBen = (s: GameState) => s.players[0].locations.find((l) => l.id === 'big-ben')!

describe('SWITCH_LOCATION_VERSION — lieux transformables (Atelier)', () => {
  it('bascule A → B : échange name/actions, conserve la face A en réserve, version=b', () => {
    const after = resolveEffects(withTransformable(), [{ type: 'SWITCH_LOCATION_VERSION', locationId: 'big-ben', to: 'b' }])
    const loc = bigBen(after)
    expect(loc.version).toBe('b')
    expect(loc.name).toBe('Face B')
    expect(loc.actions).toEqual(B_ACTIONS)
    // Face A préservée pour pouvoir rebasculer.
    expect(loc.altName).toBe('Face A')
    expect(loc.altActions).toEqual(A_ACTIONS)
    // L'image de colonne B reste attachée (rendue quand version=b).
    expect(loc.bColumnImage).toBe('b.png')
  })

  it("'toggle' fait l'aller-retour A → B → A", () => {
    const toB = resolveEffects(withTransformable(), [{ type: 'SWITCH_LOCATION_VERSION', locationId: 'big-ben', to: 'toggle' }])
    expect(bigBen(toB).version).toBe('b')
    expect(bigBen(toB).name).toBe('Face B')
    const backToA = resolveEffects(toB, [{ type: 'SWITCH_LOCATION_VERSION', locationId: 'big-ben', to: 'toggle' }])
    expect(bigBen(backToA).version).toBe('a')
    expect(bigBen(backToA).name).toBe('Face A')
    expect(bigBen(backToA).actions).toEqual(A_ACTIONS)
  })

  it("'a' quand déjà sur A : no-op (lieu inchangé)", () => {
    const start = withTransformable()
    const after = resolveEffects(start, [{ type: 'SWITCH_LOCATION_VERSION', locationId: 'big-ben', to: 'a' }])
    expect(bigBen(after)).toEqual(bigBen(start))
  })

  it('lieu NON transformable (aucune face B) : no-op', () => {
    const start = game() // lieux natifs Ratigan, sans face alternative
    const after = resolveEffects(start, [{ type: 'SWITCH_LOCATION_VERSION', locationId: 'big-ben', to: 'b' }])
    expect(bigBen(after)).toEqual(bigBen(start))
    expect(bigBen(after).version).toBeUndefined()
  })

  it('ne touche pas les autres lieux', () => {
    const start = withTransformable()
    const after = resolveEffects(start, [{ type: 'SWITCH_LOCATION_VERSION', locationId: 'big-ben', to: 'b' }])
    const others = (s: GameState) => s.players[0].locations.filter((l) => l.id !== 'big-ben')
    expect(others(after)).toEqual(others(start))
  })
})

/** État de départ : objectif TRANSFORMABLE (face A active, face B en réserve). */
function withAltObjective(): GameState {
  const base = game()
  const p = base.players[0]
  return {
    ...base,
    players: [
      {
        ...p,
        objective: { type: 'POWER_THRESHOLD', threshold: 20 },
        objectiveDescription: 'Objectif A',
        altObjective: { type: 'POWER_THRESHOLD', threshold: 30 },
        altObjectiveDescription: 'Objectif B',
        altBoardImage: 'boardB.png',
        boardImage: 'boardA.png',
        objectiveVersion: 'a',
      },
    ],
  }
}

describe('SWITCH_OBJECTIVE — objectif transformable (Atelier)', () => {
  it('bascule A → B : remplace objectif/description/plateau, conserve A en réserve', () => {
    const after = resolveEffects(withAltObjective(), [{ type: 'SWITCH_OBJECTIVE', to: 'b' }])
    const p = after.players[0]
    expect(p.objectiveVersion).toBe('b')
    expect(p.objective).toEqual({ type: 'POWER_THRESHOLD', threshold: 30 })
    expect(p.objectiveDescription).toBe('Objectif B')
    expect(p.boardImage).toBe('boardB.png')
    // Face A préservée pour rebasculer.
    expect(p.altObjective).toEqual({ type: 'POWER_THRESHOLD', threshold: 20 })
    expect(p.altBoardImage).toBe('boardA.png')
  })

  it("'toggle' fait l'aller-retour, plateau inclus", () => {
    const toB = resolveEffects(withAltObjective(), [{ type: 'SWITCH_OBJECTIVE', to: 'toggle' }])
    expect(toB.players[0].boardImage).toBe('boardB.png')
    const back = resolveEffects(toB, [{ type: 'SWITCH_OBJECTIVE', to: 'toggle' }])
    expect(back.players[0].objectiveVersion).toBe('a')
    expect(back.players[0].boardImage).toBe('boardA.png')
    expect(back.players[0].objective).toEqual({ type: 'POWER_THRESHOLD', threshold: 20 })
  })

  it('objectif NON transformable : no-op', () => {
    const start = game()
    const after = resolveEffects(start, [{ type: 'SWITCH_OBJECTIVE', to: 'b' }])
    expect(after.players[0].objective).toEqual(start.players[0].objective)
    expect(after.players[0].objectiveVersion).toBeUndefined()
  })
})
