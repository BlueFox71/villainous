import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import type { GameState } from '../types'
import { twoPlayerGame } from './_helpers'

/** Joue un tour minimal (déplacement + fin de tour) pour le joueur actif. */
const passTurn = (s: GameState, to: string): GameState =>
  applyAction(applyAction(s, { type: 'MOVE', to }), { type: 'END_TURN' })

describe('partie multi-joueurs', () => {
  it('démarre à 2 joueurs, joueur 0 actif', () => {
    const s = twoPlayerGame()
    expect(s.players).toHaveLength(2)
    expect(s.activePlayer).toBe(0)
    expect(s.turn).toBe(1)
    expect(s.players.every((p) => p.hand.length === 4)).toBe(true)
  })

  it('END_TURN passe la main au joueur suivant', () => {
    const s = passTurn(twoPlayerGame(), 'jail')
    expect(s.activePlayer).toBe(1)
    expect(s.turn).toBe(2)
    expect(s.phase).toBe('MOVE')
  })

  it('le tour revient au joueur 0 après un tour complet', () => {
    let s = passTurn(twoPlayerGame(), 'jail') // joueur 0 → 1
    s = passTurn(s, 'church') // joueur 1 → 0
    expect(s.activePlayer).toBe(0)
    expect(s.turn).toBe(3)
  })

  it('une action n’affecte que le joueur actif (isolation)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'jail' })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // joueur 0 : +3
    expect(s.players[0].power).toBe(3)
    // Joueur 1 démarre avec 1 JT (compensation 2ᵉ joueur) — inchangé.
    expect(s.players[1].power).toBe(1)
  })

  it('chaque joueur démarre avec son rang en JT (1ᵉʳ : 0, 2ᵉ : 1)', () => {
    const s = twoPlayerGame()
    expect(s.players[0].power).toBe(0)
    expect(s.players[1].power).toBe(1)
  })

  it('chaque joueur a des instanceId distincts (pas de collision)', () => {
    const s = twoPlayerGame()
    const ids0 = [...s.players[0].deck, ...s.players[0].hand].map((c) => c.instanceId)
    const ids1 = [...s.players[1].deck, ...s.players[1].hand].map((c) => c.instanceId)
    expect(ids0.every((id) => id.startsWith('p0:'))).toBe(true)
    expect(ids1.every((id) => id.startsWith('p1:'))).toBe(true)
    expect(new Set([...ids0, ...ids1]).size).toBe(60)
  })

  it('la victoire revient au joueur qui atteint 20 au début de SON tour', () => {
    let s = twoPlayerGame()
    // Le joueur 1 a déjà 20 pouvoirs.
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, power: 20 } : p)) }
    // Le joueur 0 joue et termine → début du tour du joueur 1 → victoire de 1.
    s = passTurn(s, 'jail')
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(1)
  })
})
