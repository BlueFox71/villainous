import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

/** Partie solo Maléfique (suffisant pour tester Diablo). Phase MOVE, pion sur
 *  'mountains' (locations[0]). */
function maleficentGame(seed = 7): GameState {
  return createInitialGame(
    [
      {
        villain: maleficent,
        deckCards: buildDeckInstances(maleficentCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(maleficentCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )
}

const diablo = (id = 'd1'): CardInstance => ({
  instanceId: id,
  cardId: 'diablo',
  name: 'Diablo',
  type: 'ally',
  cost: 3,
  strength: 1,
})

/** Diablo posé sur `diabloAt`, pouvoir donné. On reste en phase MOVE (pion sur
 *  'mountains') : c'est là que Diablo peut se déplacer. */
function setup(diabloAt = 'mountains', power = 0): GameState {
  const s = maleficentGame()
  return {
    ...s,
    players: s.players.map((p, i) =>
      i === 0
        ? { ...p, power, board: { ...p.board, [diabloAt]: [...(p.board[diabloAt] ?? []), diablo()] } }
        : p,
    ),
  }
}

describe('Diablo V2 — action gratuite après déplacement', () => {
  it('Diablo : déplaçable en phase ACTION tant qu’aucune action de lieu n’a été faite, refusé après', () => {
    let s = setup()
    s = applyAction(s, { type: 'MOVE', to: 'forest' }) // pion bouge → phase ACTION, aucune action encore
    // Avant la 1ʳᵉ action de lieu : autorisé.
    const moved = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'castle' })
    expect(moved.diabloFree).toEqual({ instanceId: 'd1', locationId: 'castle' })
    // Après une vraie action de lieu (gagner du pouvoir à la Forêt) : refusé.
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(() => applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'castle' })).toThrow()
  })

  it('DIABLO_MOVE (phase MOVE) arme une action gratuite au nouveau lieu', () => {
    let s = setup()
    s = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'forest' })
    expect(s.diabloFree).toEqual({ instanceId: 'd1', locationId: 'forest' })
    expect(s.players[0].board['forest'].some((c) => c.instanceId === 'd1')).toBe(true)
  })

  it('DIABLO_FREE_ACTION exécute un GAIN_POWER au lieu de Diablo sans toucher le pion', () => {
    let s = setup('mountains', 0)
    s = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'forest' })
    // Forêt : Gagner 3 pouvoirs (bas).
    s = applyAction(s, {
      type: 'DIABLO_FREE_ACTION',
      action: { type: 'EXECUTE_ACTION', actionId: 'gain-power' },
    })
    expect(s.players[0].power).toBe(3)
    expect(s.players[0].pawnLocation).toBe('mountains') // pion non bougé
    expect(s.diabloFree).toBeNull()
    // L'action gratuite n'a pas consommé de slot : après avoir bougé le pion à
    // la Maison, on peut encore y gagner 2 pouvoirs.
    s = applyAction(s, { type: 'MOVE', to: 'cottage' })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.players[0].power).toBe(5) // 3 (Diablo, Forêt) + 2 (pion, Maison)
  })

  it('DIABLO_FREE_ACTION refuse une action recouverte par un Héros', () => {
    let s = setup('mountains', 0)
    // Héros sur le Château → recouvre la rangée HAUT (dont gain-power +1).
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              board: {
                ...p.board,
                castle: [{ instanceId: 'h1', cardId: 'roi-hubert', name: 'h', type: 'hero', strength: 3 }],
              },
            }
          : p,
      ),
    }
    s = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'castle' })
    expect(() =>
      applyAction(s, {
        type: 'DIABLO_FREE_ACTION',
        action: { type: 'EXECUTE_ACTION', actionId: 'gain-power' },
      }),
    ).toThrow()
  })

  it('DIABLO_SKIP_FREE_ACTION décline et nettoie le drapeau', () => {
    let s = setup()
    s = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'forest' })
    s = applyAction(s, { type: 'DIABLO_SKIP_FREE_ACTION' })
    expect(s.diabloFree).toBeNull()
  })

  it('Diablo qui arrive sur Sommeil sans Rêves ne le défausse PAS (déplacement ≠ joué)', () => {
    let s = setup('mountains', 0)
    const curse: CardInstance = {
      instanceId: 'c1', cardId: 'sommeil-sans-reves', name: 'Sommeil sans Rêves', type: 'curse',
      discardWhen: { type: 'ally-played-here' },
    }
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, forest: [curse] } } : p)) }
    s = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'forest' })
    const cell = s.players[0].board['forest']
    // La Malédiction reste : seul « jouer » un Allié depuis la main la défausse.
    expect(cell.find((c) => c.cardId === 'sommeil-sans-reves')).toBeDefined()
    expect(cell.find((c) => c.instanceId === 'd1')).toBeDefined()
  })

  it('déplacer le pion referme la fenêtre d’action gratuite', () => {
    let s = setup()
    s = applyAction(s, { type: 'DIABLO_MOVE', instanceId: 'd1', to: 'forest' })
    expect(s.diabloFree).not.toBeNull()
    s = applyAction(s, { type: 'MOVE', to: 'cottage' })
    expect(s.diabloFree).toBeNull()
  })
})
