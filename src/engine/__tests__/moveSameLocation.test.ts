// =============================================================================
// Déplacement « sur place » (destination = lieu de départ) : ne doit JAMAIS dupliquer.
//
// Les capacités qui visent « n'importe quel lieu » (Le Roi Singe, Roadster) ou « tout lieu
// portant un Héros » (Finis le travail) autorisent la destination = lieu de départ. Le
// plateau doit alors rester inchangé. Écrire `{ ...board, [from]: filtré, [to]: [...] }`
// réécrivait la même clé depuis le tableau d'ORIGINE → la carte était DUPLIQUÉE, et le
// nombre de copies DOUBLAIT à chaque activation (1024 Macaques observés en self-play).
// D'où `boardWithMove` (engine/state.ts), utilisé par ces trois handlers.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { createInitialGame } from '../state'
import { buildDeckInstances } from '../../data/types'
import { shereKhan } from '../../data/villains/shereKhan'
import { shereKhanCards } from '../../data/villains/shereKhan.cards'
import { cruella } from '../../data/villains/cruella'
import { cruellaCards } from '../../data/villains/cruella.cards'
import { yzma } from '../../data/villains/yzma'
import { yzmaCards } from '../../data/villains/yzma.cards'
import type { CardDef } from '../../data/types'
import type { CardInstance, GameState, VillainDef } from '../types'

function solo(villain: VillainDef, cards: CardDef[]): GameState {
  return createInitialGame(
    [{ villain, deckCards: buildDeckInstances(cards, 'villain', 'p0:'), fateCards: buildDeckInstances(cards, 'fate', 'p0f:') }],
    3,
  )
}

/** Nombre de cartes portant ce `cardId` sur tout le plateau du joueur 0. */
const countOnBoard = (s: GameState, cardId: string): number =>
  Object.values(s.players[0].board).flat().filter((c) => c.cardId === cardId).length

describe('déplacement sur place — aucune duplication', () => {
  it('Le Roi Singe : déplacer un Macaque vers SON lieu laisse un seul Macaque', () => {
    const base = solo(shereKhan, shereKhanCards)
    const loc = base.players[0].locations[0].id
    const macaque: CardInstance = { instanceId: 'm1', cardId: 'macaques', name: 'Macaques', type: 'ally', strength: 2, cost: 1 }
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { ...base.players[0].board, [loc]: [macaque] } }] as GameState['players'],
      pendingMonkeyKing: { playerIndex: 0, macaqueInstanceId: 'm1' },
    }
    // Deux activations de suite sur le même lieu : sans le correctif, on passait à 2 puis 4.
    s = applyAction(s, { type: 'RESOLVE_MONKEY_KING', to: loc })
    expect(countOnBoard(s, 'macaques')).toBe(1)
    s = { ...s, pendingMonkeyKing: { playerIndex: 0, macaqueInstanceId: 'm1' } }
    s = applyAction(s, { type: 'RESOLVE_MONKEY_KING', to: loc })
    expect(countOnBoard(s, 'macaques')).toBe(1)
  })

  it('Roadster (« n’importe quel lieu ») : le déplacer sur son propre lieu ne le duplique pas', () => {
    const base = solo(cruella, cruellaCards)
    const p = base.players[0]
    const loc = p.locations[1].id
    const roadster: CardInstance = { instanceId: 'r1', cardId: 'roadster', name: 'Roadster', type: 'item', cost: 2 }
    const moveAction = p.locations
      .flatMap((l) => (l.id === loc ? l.actions : []))
      .find((a) => a.type === 'MOVE_ITEM_ALLY')
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...p, pawnLocation: loc, board: { ...p.board, [loc]: [roadster] } }] as GameState['players'],
    }
    // Certains lieux n'ont pas l'action « Déplacer » : on ne teste que si elle existe ici.
    if (!moveAction) return
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: moveAction.id, instanceId: 'r1', to: loc })
    expect(countOnBoard(s, 'roadster')).toBe(1)
  })

  it('Finis le travail : viser le lieu de l’Allié lui-même ne le duplique pas', () => {
    const base = solo(yzma, yzmaCards)
    const p = base.players[0]
    const loc = p.locations[0].id
    const kronk: CardInstance = { instanceId: 'k1', cardId: 'kronk', name: 'Kronk', type: 'ally', strength: 3, cost: 3 }
    const hero: CardInstance = { instanceId: 'h1', cardId: 'kuzco', name: 'Kuzco', type: 'hero', strength: 2 }
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...p, board: { ...p.board, [loc]: [kronk, hero] } }] as GameState['players'],
      pendingFinishJob: { playerIndex: 0, allyInstanceId: 'k1' },
    }
    const s = applyAction(s0, { type: 'RESOLVE_FINISH_JOB', to: loc })
    expect(countOnBoard(s, 'kronk')).toBe(1)
  })
})
