import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    5,
  )
}

const fleche: CardInstance = { instanceId: 'fl1', cardId: 'fleche-mome-raths', name: 'Flèche de Mome Raths', type: 'effect' }
const other: CardInstance = { instanceId: 'o1', cardId: 'coup-royal', name: 'X', type: 'effect' }

describe('Reine de Cœur — Flèche de Mome Raths', () => {
  it('ouvre le déplacement d’un Allié (chooser = joueur actif) puis le déplace au lieu choisi', () => {
    const ally: CardInstance = { instanceId: 'g1', cardId: 'gardes-coeur', name: 'Gardes', type: 'ally', strength: 3 }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [fleche, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, labyrinthe: [ally] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'fl1' })
    expect(s.pendingAllyRelocate?.chooserIndex).toBe(1)
    expect(s.pendingAllyRelocate?.targetIndex).toBe(0)
    // Déplacement vers la Cour du Palais.
    s = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'g1', to: 'cour-palais' })
    expect((s.players[0].board['labyrinthe'] ?? []).some((c) => c.instanceId === 'g1')).toBe(false)
    expect((s.players[0].board['cour-palais'] ?? []).some((c) => c.instanceId === 'g1')).toBe(true)
    expect(s.pendingAllyRelocate).toBeNull()
  })

  it('emmène les Objets associés à l’Allié déplacé', () => {
    const ally: CardInstance = { instanceId: 'g1', cardId: 'gardes-coeur', name: 'Gardes', type: 'ally', strength: 3 }
    const item: CardInstance = { instanceId: 'it1', cardId: 'lance', name: 'Lance', type: 'item', attachedTo: 'g1' }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [fleche, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, labyrinthe: [ally, item] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'fl1' })
    s = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'g1', to: 'cour-palais' })
    const dest = s.players[0].board['cour-palais'] ?? []
    expect(dest.some((c) => c.instanceId === 'g1')).toBe(true)
    expect(dest.some((c) => c.instanceId === 'it1')).toBe(true)
  })

  it('sans Allié : simple défausse, aucun pending', () => {
    let s = game()
    s = { ...s, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [fleche, other] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'fl1' })
    expect(s.pendingAllyRelocate).toBeFalsy()
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'fl1')).toBe(true)
  })
})

describe('Reine de Cœur — En retard !', () => {
  const enRetard: CardInstance = { instanceId: 'er1', cardId: 'en-retard', name: 'En retard !', type: 'effect' }
  const filler: CardInstance = { instanceId: 'o2', cardId: 'coup-royal', name: 'X', type: 'effect' }

  it('rejoue un Héros ≤3 de la défausse Fatalité sur le lieu CHOISI', () => {
    const dodo: CardInstance = { instanceId: 'd1', cardId: 'dodo', name: 'Dodo', type: 'hero', strength: 3 }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [enRetard, filler] },
      // En jeu réel, Dodo (copies:1) éliminé est dans la défausse, PAS dans le deck.
      players: s.players.map((p, i) => (i === 0 ? { ...p, fateDeck: p.fateDeck.filter((c) => c.cardId !== 'dodo'), fateDiscard: [dodo] } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'er1' })
    expect(s.pendingFateHeroPlace?.heroCardId).toBe('dodo')
    expect(s.pendingFateHeroPlace?.chooserIndex).toBe(1)
    s = applyAction(s, { type: 'RESOLVE_FATE_HERO_PLACE', locationId: 'cour-palais' })
    expect((s.players[0].board['cour-palais'] ?? []).some((c) => c.cardId === 'dodo')).toBe(true)
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'dodo')).toBe(false)
  })

  it('sans Héros ≤3 dans la défausse Fatalité → aucun effet (carte défaussée)', () => {
    const bigHero: CardInstance = { instanceId: 'a1', cardId: 'alice', name: 'Alice', type: 'hero', strength: 5 }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [enRetard, filler] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, fateDiscard: [bigHero] } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'er1' })
    expect(s.pendingFateHeroPlace ?? null).toBeNull()
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'en-retard')).toBe(true)
    expect((s.players[0].board['cour-palais'] ?? []).some((c) => c.cardId === 'alice')).toBe(false)
  })
})
