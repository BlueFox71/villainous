import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { canEndTurn, getAvailableActions, getLegalMoves, hasReachedObjective } from '../rules'
import { princeJohn } from '../../data/villains/princeJohn'
import type { GameState } from '../types'
import { me, singleGame, withActive } from './_helpers'

const newGame = () => singleGame()

/** Raccourci : déplacer, exécuter les actions Gagner Pouvoir, puis finir le tour. */
function playGainTurn(state: GameState, to: string): GameState {
  let s = applyAction(state, { type: 'MOVE', to })
  for (const a of getAvailableActions(s).filter((a) => a.type === 'GAIN_POWER')) {
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: a.id })
  }
  return applyAction(s, { type: 'END_TURN' })
}

describe('état initial', () => {
  it('démarre tour 1, phase MOVE, pion non placé, 0 pouvoir', () => {
    const s = newGame()
    expect(s.turn).toBe(1)
    expect(s.phase).toBe('MOVE')
    expect(s.status).toBe('PLAYING')
    expect(s.players).toHaveLength(1)
    // Le pion démarre sur le lieu le plus à gauche (Forêt de Sherwood).
    expect(me(s).pawnLocation).toBe('sherwood')
    expect(me(s).power).toBe(0)
    expect(me(s).objective).toEqual({ type: 'POWER_THRESHOLD', threshold: 20 })
    expect(me(s).locations).toHaveLength(4)
  })

  it("ne partage pas de référence mutable avec la définition du vilain", () => {
    const s = newGame()
    me(s).locations[0].name = 'MODIFIÉ'
    expect(princeJohn.locations[0].name).toBe('Forêt de Sherwood')
  })
})

describe('déplacement', () => {
  it('au premier tour, 3 déplacements possibles (pas le lieu de départ)', () => {
    const s = newGame()
    expect(getLegalMoves(s)).toHaveLength(3)
    expect(getLegalMoves(s)).not.toContain('sherwood') // lieu de départ
  })

  it('passe en phase ACTION après un déplacement', () => {
    const s = applyAction(newGame(), { type: 'MOVE', to: 'nottingham' })
    expect(s.phase).toBe('ACTION')
    expect(me(s).pawnLocation).toBe('nottingham')
  })

  it('interdit de rester sur le même lieu au tour suivant', () => {
    const s = playGainTurn(newGame(), 'nottingham')
    expect(s.phase).toBe('MOVE')
    expect(getLegalMoves(s)).not.toContain('nottingham')
    expect(getLegalMoves(s)).toHaveLength(3)
  })

  it('lève une erreur sur un déplacement illégal (même lieu)', () => {
    let s = applyAction(newGame(), { type: 'MOVE', to: 'nottingham' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(() => applyAction(s, { type: 'MOVE', to: 'nottingham' })).toThrow()
  })
})

describe('plateau corrigé (valeurs Gain Power)', () => {
  const gain = (locId: string) => {
    let s = newGame()
    // Si le pion démarre déjà sur ce lieu (Sherwood), on s'en éloigne puis on
    // y revient au tour suivant (le déplacement est obligatoire vers un autre lieu).
    if (me(s).pawnLocation === locId) {
      s = applyAction(s, { type: 'MOVE', to: 'jail' })
      s = applyAction(s, { type: 'END_TURN' })
    }
    s = applyAction(s, { type: 'MOVE', to: locId })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    return me(s).power
  }

  it('Forêt de Sherwood = 1', () => expect(gain('sherwood')).toBe(1))
  it('Église du Frère Tuck = 2', () => expect(gain('church')).toBe(2))
  it('Nottingham = 1 (et non 3)', () => expect(gain('nottingham')).toBe(1))
  it('La Prison = 3 (et non 0)', () => expect(gain('jail')).toBe(3))
})

describe('actions de lieu', () => {
  it('les 3 actions prises en charge de la Prison sont disponibles', () => {
    const s = applyAction(newGame(), { type: 'MOVE', to: 'jail' })
    const types = getAvailableActions(s)
      .map((a) => a.type)
      .sort()
    expect(types).toEqual(['DISCARD_CARDS', 'GAIN_POWER', 'PLAY_CARD'])
  })

  it("l'action Gagner Pouvoir ne peut être jouée qu’une fois par tour", () => {
    let s = applyAction(newGame(), { type: 'MOVE', to: 'church' })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(getAvailableActions(s).some((a) => a.id === 'gain-power')).toBe(false)
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })).toThrow()
  })

  it('EXECUTE_ACTION refuse Défausser (passe par DISCARD_CARDS)', () => {
    const s = applyAction(newGame(), { type: 'MOVE', to: 'jail' })
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'discard' })).toThrow()
  })
})

describe('gestion du tour', () => {
  it('on ne peut pas finir le tour avant d’avoir bougé', () => {
    const s = newGame()
    expect(canEndTurn(s)).toBe(false)
    expect(() => applyAction(s, { type: 'END_TURN' })).toThrow()
  })

  it('END_TURN incrémente le tour et repasse en phase MOVE', () => {
    let s = applyAction(newGame(), { type: 'MOVE', to: 'church' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.turn).toBe(2)
    expect(s.phase).toBe('MOVE')
    expect(s.usedActionIds).toHaveLength(0)
  })
})

describe('victoire', () => {
  it('hasReachedObjective devient vrai à 20 pouvoirs', () => {
    expect(hasReachedObjective(withActive(newGame(), { power: 20 }))).toBe(true)
  })

  it('la victoire se déclenche au DÉBUT du tour (après END_TURN)', () => {
    let s: GameState = {
      ...withActive(newGame(), { power: 18, pawnLocation: 'jail' }),
      phase: 'ACTION',
    }
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // 21
    expect(s.status).toBe('PLAYING')
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).toBe('WON')
    expect(me(s).power).toBe(21)
  })

  it('toute action est refusée après la victoire', () => {
    let s: GameState = {
      ...withActive(newGame(), { power: 20, pawnLocation: 'sherwood' }),
      phase: 'ACTION',
    }
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).toBe('WON')
    expect(() => applyAction(s, { type: 'MOVE', to: 'church' })).toThrow()
  })

  it('partie complète : alterner Prison (+3) et Église (+2) finit par gagner', () => {
    let s = newGame()
    const cycle = ['jail', 'church']
    let i = 0
    while (s.status === 'PLAYING' && s.turn < 50) {
      s = playGainTurn(s, cycle[i % cycle.length])
      i++
    }
    expect(s.status).toBe('WON')
    expect(me(s).power).toBeGreaterThanOrEqual(20)
  })
})
