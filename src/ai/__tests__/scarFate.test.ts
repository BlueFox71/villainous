import { describe, it, expect } from 'vitest'
import { fateWouldHelpOpponent } from '../heuristicBot'
import { villainFateTargetingBonus } from '../villainStrategy'
import { createInitialGame } from '../../engine/state'
import { scar } from '../../data/villains/scar'
import { scarCards } from '../../data/villains/scar.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

const card = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

function scarGame(patch: Partial<PlayerState> = {}): GameState {
  const g = createInitialGame(
    [{ villain: scar, deckCards: buildDeckInstances(scarCards, 'villain', 's:'), fateCards: buildDeckInstances(scarCards, 'fate', 'sf:') }],
    1,
  )
  return { ...g, players: [{ ...g.players[0], ...patch }] }
}
function scarWith(board: Record<string, CardInstance[]>): PlayerState {
  const p = scarGame().players[0]
  return { ...p, board: { ...p.board, ...board } }
}

describe('Scar — règle d’évitement (ne pas gifter Mufasa, mais fataliser sinon)', () => {
  it('s’abstient tant que Mufasa n’est NI en jeu NI dans la pile (risque de cadeau)', () => {
    expect(fateWouldHelpOpponent(scarGame(), 0)).toBe(true)
  })

  it('autorise la Fatalité dès que Mufasa est EN JEU (plus de risque de cadeau)', () => {
    const mufasa = card({ cardId: 'mufasa', type: 'hero', strength: 6 })
    const g = scarGame()
    const s: GameState = { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, savane: [mufasa] } }] }
    expect(fateWouldHelpOpponent(s, 0)).toBe(false)
  })

  it('autorise la Fatalité dès que Mufasa est dans la pile Succession', () => {
    const mufasa = card({ cardId: 'mufasa', type: 'hero', strength: 6 })
    expect(fateWouldHelpOpponent(scarGame({ succession: [mufasa] }), 0)).toBe(false)
  })
})

describe('Scar — anti-placement de Zazu sur Mufasa/Simba', () => {
  it('pénalise Zazu posé sur le lieu de Mufasa (sa −2 aiderait Scar)', () => {
    const mufasa = card({ cardId: 'mufasa', type: 'hero', strength: 6 })
    const zazu = card({ cardId: 'zazu', type: 'hero', strength: 2 })
    expect(villainFateTargetingBonus(scarWith({ savane: [mufasa, zazu] }))).toBe(-4)
  })

  it('ne pénalise pas Zazu seul, ni avec un Héros non-cible', () => {
    const zazu = card({ cardId: 'zazu', type: 'hero', strength: 2 })
    expect(villainFateTargetingBonus(scarWith({ savane: [zazu] }))).toBe(0)
    const nala = card({ cardId: 'nala', type: 'hero', strength: 3 })
    expect(villainFateTargetingBonus(scarWith({ gorge: [zazu, nala] }))).toBe(0)
  })
})
