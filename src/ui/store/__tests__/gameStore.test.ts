import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../gameStore'
import { getLegalMoves } from '../../../engine/rules'

// Le store fonctionne hors React (Zustand vanilla). On vérifie que l'entonnoir
// submit() préserve le comportement solo : un coup applique bien localement.
describe('gameStore — entonnoir submit (solo)', () => {
  beforeEach(() => {
    useGameStore.getState().reset(['princeJohn', 'maleficent'])
  })

  it('démarre en mode solo, joueur local 0', () => {
    const s = useGameStore.getState()
    expect(s.mode).toBe('solo')
    expect(s.localPlayerIndex).toBe(0)
    expect(s.seats).toEqual(['local', 'bot'])
  })

  it('une méthode de jeu applique le coup localement (via submit)', () => {
    const dest = getLegalMoves(useGameStore.getState().state)[0]
    useGameStore.getState().move(dest)
    expect(useGameStore.getState().state.players[0].pawnLocation).toBe(dest)
  })

  it('submit applique directement une action en solo', () => {
    const before = useGameStore.getState().state
    const dest = getLegalMoves(before)[0]
    useGameStore.getState().submit({ type: 'MOVE', to: dest })
    expect(useGameStore.getState().state.players[0].pawnLocation).toBe(dest)
    expect(useGameStore.getState().state).not.toBe(before) // nouvel état (immuable)
  })
})
