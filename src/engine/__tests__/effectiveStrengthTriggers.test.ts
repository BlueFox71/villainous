// =============================================================================
// Conditions et force EFFECTIVE.
//
// Cas vécu (Tabbou) : « Surprise ! » se déclenche sur l'élimination d'un Héros de force
// ≤ 3. SAMUS est imprimée Force 3, mais avec la BALLE SMASH associée (+2) elle vaut 5 :
// la Condition ne doit PAS se déclencher (et son effet, qui teste déjà la force effective,
// refuserait de l'éliminer). On mémorise donc la force EFFECTIVE au moment du Vanquish.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { playableConditions, effectiveStrength } from '../rules'
import { buildDeckInstances } from '../../data/types'
import { tabbou } from '../../data/villains/tabbou'
import { tabbouCards } from '../../data/villains/tabbou.cards'
import type { CardInstance, GameState } from '../types'

/** Index du lieu de Tabbou qui porte l'action « Vaincre » (Château). */
const LOC = 1

/** Tabbou (0, ACTIF : il élimine) vs Tabbou (1, qui tient « Surprise ! » en main). */
function game(extraOnHero: CardInstance[] = []): GameState {
  const g = createInitialGame(
    [
      { villain: tabbou, deckCards: buildDeckInstances(tabbouCards, 'villain', 'p0:'), fateCards: buildDeckInstances(tabbouCards, 'fate', 'p0f:') },
      { villain: tabbou, deckCards: buildDeckInstances(tabbouCards, 'villain', 'p1:'), fateCards: buildDeckInstances(tabbouCards, 'fate', 'p1f:') },
    ],
    3,
  )
  const loc = g.players[0].locations[LOC].id
  const samus: CardInstance = { instanceId: 'samus', cardId: 'samus', name: 'Samus', type: 'hero', strength: 3 }
  // Un Allié assez fort pour la vaincre dans les deux cas (force 3 ou 5).
  const ally: CardInstance = { instanceId: 'a1', cardId: 'canon-obscure', name: 'Bowser', type: 'ally', strength: 6 }
  const surprise = buildDeckInstances(tabbouCards, 'villain', 's:').find((c) => c.cardId === 'surprise')!
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return {
    ...g,
    activePlayer: 0,
    phase: 'ACTION',
    usedActionIds: [],
    players: [
      { ...g.players[0], board: { ...empty, [loc]: [samus, ally, ...extraOnHero] }, pawnLocation: loc },
      { ...g.players[1], hand: [{ ...surprise, instanceId: 'surp' }] },
    ] as GameState['players'],
  }
}

/** Objet Fatalité « Balle Smash » (+2 Force) associé à Samus. */
const balleSmash = (): CardInstance => {
  const c = buildDeckInstances(tabbouCards, 'fate', 'bs:').find((x) => x.cardId === 'balle-smash')!
  return { ...c, instanceId: 'bs1', attachedTo: 'samus' }
}

/** Élimine Samus avec l'Allié, puis renvoie l'état. */
function vanquishSamus(s: GameState): GameState {
  const loc = s.players[0].locations[LOC].id
  const action = s.players[0].locations[LOC].actions.find((a) => a.type === 'VANQUISH')!
  return applyAction(
    { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: loc } : p)) as GameState['players'] },
    { type: 'VANQUISH', actionId: action.id, heroInstanceId: 'samus', allyInstanceIds: ['a1'] },
  )
}

describe('Surprise ! — la force RETENUE est la force effective', () => {
  it('Samus SEULE (force 3) : la Condition se déclenche', () => {
    const s = vanquishSamus(game())
    expect(s.lastVanquishedHeroStrength).toBe(3)
    expect(playableConditions(s, 1).map((c) => c.cardId)).toContain('surprise')
  })

  it('Samus + Balle Smash (force 5) : la Condition NE se déclenche PAS', () => {
    const base = game([balleSmash()])
    // Garde-fou de la fixture : la force effective est bien 5 avant l'élimination.
    expect(effectiveStrength(base, 0, 'samus')).toBe(5)
    const s = vanquishSamus(base)
    expect(s.lastVanquishedHeroStrength).toBe(5)
    expect(playableConditions(s, 1).map((c) => c.cardId)).not.toContain('surprise')
  })
})
