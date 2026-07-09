import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { activatableCards, flayerGateConditionMet } from '../rules'
import { objectiveScore } from '../../ai/heuristicBot'
import { flagelleurMental, flagelleurMentalCards } from '../../data/published/flagelleurMental'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const entree = (): CardInstance => ({
  instanceId: 'e1',
  cardId: 'entree-du-monde-a-l-envers',
  name: "Entrée du Monde à l'Envers",
  type: 'item',
  activatedCost: 0,
})
const onze = (): CardInstance => ({ instanceId: 'o1', cardId: 'onze', name: 'Onze', type: 'hero', strength: 5 })
const tunnel = (i: number): CardInstance => ({
  instanceId: `t${i}`,
  cardId: 'tunnel-de-hawkins',
  name: 'Tunnel de Hawkins',
  type: 'item',
})

function game(): GameState {
  return createInitialGame(
    [
      {
        villain: flagelleurMental,
        deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
}

/** État « prêt à gagner » : pion au Monde à l'Envers (déverrouillé), Entrée + Onze sur
 *  Centre-ville, un Tunnel sur chacun des 3 premiers lieux. `withOnze` = poser Onze ou non. */
function readyState(withOnze = true): GameState {
  const base = game()
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      pawnLocation: 'monde-envers',
      lockedLocations: (p.lockedLocations ?? []).filter((l) => l !== 'monde-envers'),
      board: {
        ...p.board,
        'centre-ville': [tunnel(1), entree(), ...(withOnze ? [onze()] : [])],
        starcourt: [tunnel(2)],
        laboratoire: [tunnel(3)],
      },
    })),
  }
}

describe("Le Flagelleur Mental — victoire par l'Entrée du Monde à l'Envers (FLAYER_GATE)", () => {
  it("l'objectif du vilain est bien FLAYER_GATE", () => {
    expect(flagelleurMental.objective.type).toBe('FLAYER_GATE')
  })

  it('activer l\'Entrée avec Onze sur son lieu + 3 lieux tunnelisés = victoire', () => {
    const s = readyState(true)
    expect(flayerGateConditionMet(s, 0)).toBe(true)
    expect(activatableCards(s).some((c) => c.instanceId === 'e1')).toBe(true)
    const next = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'e1' })
    expect(next.status).toBe('WON')
    expect(next.winner).toBe(0)
  })

  it("sans Onze sur le lieu de l'Entrée, l'Entrée n'est pas activable et l'activation échoue", () => {
    const s = readyState(false)
    expect(flayerGateConditionMet(s, 0)).toBe(false)
    expect(activatableCards(s).some((c) => c.instanceId === 'e1')).toBe(false)
    expect(() =>
      applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'e1' }),
    ).toThrow()
  })

  it("un lieu non tunnelisé (parmi les 3 premiers) empêche la victoire", () => {
    const s = readyState(true)
    // Retire le Tunnel de Starcourt.
    const broken: GameState = {
      ...s,
      players: s.players.map((p) => ({ ...p, board: { ...p.board, starcourt: [] } })),
    }
    expect(flayerGateConditionMet(broken, 0)).toBe(false)
  })

  it('jauge d\'objectif : 0 au départ, ~1 quand tout est prêt', () => {
    const s = game()
    expect(objectiveScore(s.players[0])).toBeCloseTo(0, 5)
    expect(objectiveScore(readyState(true).players[0])).toBe(1)
  })

  it('jauge plafonnée à 0,55 si MAX est présente et Onze pas encore récupérée', () => {
    const s = readyState(false)
    const withMax: GameState = {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        board: {
          ...p.board,
          laboratoire: [tunnel(3), { instanceId: 'm1', cardId: 'max-mayfield', name: 'Max', type: 'hero', strength: 3 }],
        },
      })),
    }
    expect(objectiveScore(withMax.players[0])).toBeLessThanOrEqual(0.55)
  })
})
