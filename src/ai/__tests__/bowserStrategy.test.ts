import { describe, it, expect } from 'vitest'
import { villainStrategyBonus } from '../villainStrategy'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `b${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function game(): GameState {
  return createInitialGame(
    [{ villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'x:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'xf:') }],
    1,
  )
}
function player(board: Record<string, CardInstance[]> = {}): PlayerState {
  const g = game()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...board }, hand: [] }
}

describe('Bowser — couche stratégie (pour lui)', () => {
  it('valorise ses pièces maîtresses en jeu (Bowser Jr., Bateau, Galaxie hantée, draineurs)', () => {
    expect(villainStrategyBonus(player({ galaxies: [card('bowser-jr', 'ally', { strength: 2 })] }))).toBe(4)
    expect(villainStrategyBonus(player({ observatoire: [card('bateau', 'item')] }))).toBe(3)
    expect(villainStrategyBonus(player({ galaxies: [card('ghostly', 'item')] }))).toBe(2)
  })

  it('valorise Kamella/Dino Piranha (moteur draineur), sans bonus de placement fixe', () => {
    // Le positionnement (rassembler/éloigner selon l'Étoile) est géré dans heuristicBot,
    // pas via preferredPlacements → même bonus moteur (2) où qu'ils soient.
    expect(villainStrategyBonus(player({ observatoire: [card('kamella', 'ally', { strength: 3 })] }))).toBe(2)
    expect(villainStrategyBonus(player({ galaxies: [card('dino-piranha', 'ally', { strength: 2 })] }))).toBe(2)
  })

  it('veut vaincre Mario / Harmonie / Luigi (malus tant qu\'ils sont là)', () => {
    expect(villainStrategyBonus(player({ 'chateau-peach': [card('mario', 'hero', { strength: 4 })] }))).toBe(-10)
    expect(villainStrategyBonus(player({ observatoire: [card('harmonie', 'hero', { strength: 3 })] }))).toBe(-8)
    expect(villainStrategyBonus(player({ galaxies: [card('luigi', 'hero', { strength: 3 })] }))).toBe(-4)
  })
})

describe('Bowser — ciblage Fatalité (contre lui)', () => {
  it('le bot ne joue PAS Peach (Héros-cible de Bowser) en Fatalité si une alternative existe', () => {
    const g = game()
    const peach = card('peach', 'hero', { strength: 2 })
    const mario = card('mario', 'hero', { strength: 4 })
    const s: GameState = { ...g, activePlayer: 0, phase: 'ACTION', pendingFate: { target: 0, revealed: [peach, mario] } }
    const actions = enumerateActions(s)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === peach.instanceId)).toBe(false)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === mario.instanceId)).toBe(true)
  })
})
