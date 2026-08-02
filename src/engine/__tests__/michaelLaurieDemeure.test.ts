// =============================================================================
// Michael Myers — LAURIE STRODE reste à la Demeure des Strode.
//
// Règle : la Demeure doit être DÉVERROUILLÉE (Gardons le meilleur pour la fin,
// Mal Intérieur 3) pour aller y assassiner LAURIE. Elle est posée d'office sur ce
// lieu « bloqué ou non » : si on pouvait l'en sortir, tout le palier Mal Intérieur
// deviendrait facultatif (le bot gagnait ainsi en 8 tours via Trace de sang).
//
// On teste sur le JSON PUBLIÉ (ce qui est réellement livré), pas sur une fixture.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyAction } from '../actions'
import { createInitialGame, type PlayerSetup } from '../state'
import { toVillainDef, toDeckCardDefs, type CustomVillain } from '../../data/customVillain'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, LocationId } from '../types'

const LAURIE = 'custom-michael-meyers-laurie-strode'
const DEMEURE = 'loc-4'

function michael(): CustomVillain {
  const p = resolve(__dirname, '../../data/published/custom-michael-meyers.json')
  return JSON.parse(readFileSync(p, 'utf8')) as CustomVillain
}

/** Partie solo Michael, LAURIE posée sur la Demeure (encore verrouillée), pion ailleurs. */
function gameWithLaurieHome(): { state: GameState; laurie: CardInstance } {
  const v = michael()
  const cards = toDeckCardDefs(v)
  const setup: PlayerSetup = {
    villain: { ...toVillainDef(v), name: v.name },
    deckCards: buildDeckInstances(cards, 'villain', 'p0:'),
    fateCards: buildDeckInstances(cards, 'fate', 'p0f:'),
  }
  const base = createInitialGame([setup], 7)
  const hero = base.players[0].fateDeck.find((c) => c.cardId === LAURIE)!
  const state: GameState = {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      pawnLocation: 'loc-3',
      board: { ...p.board, [DEMEURE]: [hero] },
      fateDeck: p.fateDeck.filter((c) => c.instanceId !== hero.instanceId),
    })),
  }
  return { state, laurie: hero }
}

describe('Michael Myers — la Demeure doit être déverrouillée pour atteindre LAURIE', () => {
  it('LAURIE est immobile et posée d’office sur la Demeure (donnée du vilain publié)', () => {
    const card = michael().cards.find((c) => c.id === LAURIE)!
    expect(card.cannotBeMoved).toBe(true)
    expect(card.forcedFateLocation).toBe(DEMEURE)
  })

  it('la Demeure est verrouillée au départ', () => {
    const { state } = gameWithLaurieHome()
    expect(state.players[0].lockedLocations ?? []).toContain(DEMEURE)
  })

  it('aucun effet « déplacez un Héros » ne peut la sortir de la Demeure', () => {
    const { state, laurie } = gameWithLaurieHome()
    // Chemin Trace de sang / Apparition / Vent de panique (pendingHeroRelocate) : c'est
    // celui par lequel le bot s'échappait, l'action de lieu étant déjà verrouillée.
    const pending: GameState = {
      ...state,
      pendingHeroRelocate: { chooserIndex: 0, targetIndex: 0, anyLocation: true },
    }
    expect(() =>
      applyAction(pending, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: laurie.instanceId, to: 'loc-3' as LocationId }),
    ).toThrow(/ne peut pas être déplacé/i)
  })

  it('elle n’est jamais proposée comme cible de déplacement', () => {
    const { state, laurie } = gameWithLaurieHome()
    const relocatable = Object.values(state.players[0].board)
      .flat()
      .filter((c) => c.type === 'hero' && !c.cannotBeMoved)
    expect(relocatable.map((c) => c.instanceId)).not.toContain(laurie.instanceId)
  })
})
