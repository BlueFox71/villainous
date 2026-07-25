// =============================================================================
// Fatalité impossible à jouer → « Passer ».
//
// Cas vécu : deux « Agrandir » révélés contre la Reine de Cœur alors qu'elle n'a AUCUN
// Héros dans son royaume. Les deux cartes sont sans effet ; il ne faut donc pas forcer
// un clic (qui les défaussait silencieusement) mais autoriser PASS_FATE, et le journal
// doit dire clairement qu'aucune Fatalité n'a été jouée.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { applyAction, fateCardPlayable, noFateCardPlayable } from '../actions'
import { createInitialGame } from '../state'
import { buildDeckInstances } from '../../data/types'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import type { CardInstance, GameState } from '../types'

/** Prince Jean (joueur 0, actif) fatalise la Reine de Cœur (joueur 1). */
function game(): GameState {
  const g = createInitialGame(
    [
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p0:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p0f:') },
      { villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p1:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p1f:') },
    ],
    4,
  )
  // Royaume de la Reine VIDÉ : plus aucun Héros → Agrandir n'a aucune cible.
  const empty = Object.fromEntries(g.players[1].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return {
    ...g,
    activePlayer: 0,
    phase: 'ACTION',
    players: [g.players[0], { ...g.players[1], board: empty }] as GameState['players'],
  }
}

const agrandir = (id: string): CardInstance =>
  buildDeckInstances(reineCoeurCards, 'fate', 'f:')
    .filter((c) => c.cardId === 'agrandir')
    .map((c) => ({ ...c, instanceId: id }))[0]

describe('Fatalité — aucune carte jouable', () => {
  it('deux Agrandir sans Héros dans le royaume : les deux sont injouables', () => {
    const s: GameState = { ...game(), pendingFate: { target: 1, revealed: [agrandir('a1'), agrandir('a2')] } }
    expect(fateCardPlayable(s, s.pendingFate!.revealed[0], 1)).toBe(false)
    expect(noFateCardPlayable(s)).toBe(true)
  })

  it('PASS_FATE est autorisé, défausse les 2 cartes et le journal le dit', () => {
    const s: GameState = { ...game(), pendingFate: { target: 1, revealed: [agrandir('a1'), agrandir('a2')] } }
    const after = applyAction(s, { type: 'PASS_FATE' })
    expect(after.pendingFate ?? null).toBeNull()
    expect(after.players[1].fateDiscard.filter((c) => c.cardId === 'agrandir')).toHaveLength(2)
    expect(after.log.some((l) => l.includes('n’a pas pu jouer de Fatalité') || l.includes("n'a pas pu jouer de Fatalité"))).toBe(true)
  })

  it('dès qu’UNE carte est jouable, passer est REFUSÉ (il faut la jouer)', () => {
    const base = game()
    const hero: CardInstance = { instanceId: 'h1', cardId: 'alice', name: 'Alice', type: 'hero', strength: 5 }
    const withHero: GameState = {
      ...base,
      players: [
        base.players[0],
        { ...base.players[1], board: { ...base.players[1].board, labyrinthe: [hero] } },
      ] as GameState['players'],
      pendingFate: { target: 1, revealed: [agrandir('a1'), agrandir('a2')] },
    }
    expect(noFateCardPlayable(withHero)).toBe(false)
    expect(() => applyAction(withHero, { type: 'PASS_FATE' })).toThrow(/facultative/)
  })
})
