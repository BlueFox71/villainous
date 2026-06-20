import { describe, it, expect } from 'vitest'
import { enumerateActions } from '../enumerate'
import { applyAction } from '../../engine/actions'
import { createInitialGame } from '../../engine/state'
import { gothel } from '../../data/villains/gothel'
import { gothelCards } from '../../data/villains/gothel.cards'
import { scar } from '../../data/villains/scar'
import { scarCards } from '../../data/villains/scar.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

// Gothel (bot, p0) face à un adversaire quelconque (p1) — seul le royaume de Gothel
// nous intéresse ici.
function game(): GameState {
  return createInitialGame(
    [
      { villain: gothel, deckCards: buildDeckInstances(gothelCards, 'villain', 'p0:'), fateCards: buildDeckInstances(gothelCards, 'fate', 'p0f:') },
      { villain: scar, deckCards: buildDeckInstances(scarCards, 'villain', 'p1:'), fateCards: buildDeckInstances(scarCards, 'fate', 'p1f:') },
    ],
    7,
  )
}

describe('bot Gothel — Garde royal ne traîne pas Raiponce vers Corona', () => {
  it('n’énumère aucun déplacement de Raiponce vers la droite (Corona)', () => {
    let s = game()
    const ally: CardInstance = { instanceId: 'gr', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 2 }
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    // Pion + Garde royal + Raiponce sur la Forêt ; on déplace le Garde vers Corona.
    s = {
      ...s,
      phase: 'ACTION',
      activePlayer: 0,
      players: [
        { ...s.players[0], pawnLocation: 'foret', board: { ...s.players[0].board, tour: [], foret: [ally, { ...rap }] } },
        s.players[1],
      ],
    }
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'gr', to: 'corona' })
    // Le pending facultatif est bien ouvert, avec Raiponce parmi les candidats.
    expect(after.pendingHeroRelocate?.candidateIds).toContain(rap.instanceId)
    expect(after.pendingHeroRelocate?.forcedLocationId).toBe('corona')
    // Côté bot : AUCUN coup ne pousse Raiponce vers Corona ; seul reste « décliner ».
    const acts = enumerateActions(after)
    const movesRaiponce = acts.filter(
      (a) => a.type === 'RESOLVE_HERO_RELOCATE' && a.heroInstanceId === rap.instanceId,
    )
    expect(movesRaiponce).toHaveLength(0)
    expect(acts.some((a) => a.type === 'SKIP_HERO_RELOCATE')).toBe(true)
  })

  it('autorise un déplacement de Raiponce vers la GAUCHE (Garde royal vers la Tour)', () => {
    let s = game()
    const ally: CardInstance = { instanceId: 'gr', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 2 }
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    // Pion + Garde royal + Raiponce sur la Forêt ; on déplace le Garde vers le Canard
    // boiteux (à gauche, lieu voisin). Raiponce peut suivre (bénéfique pour Gothel).
    s = {
      ...s,
      phase: 'ACTION',
      activePlayer: 0,
      players: [
        { ...s.players[0], pawnLocation: 'foret', board: { ...s.players[0].board, tour: [], foret: [ally, { ...rap }] } },
        s.players[1],
      ],
    }
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'gr', to: 'canard-boiteux' })
    expect(after.pendingHeroRelocate?.forcedLocationId).toBe('canard-boiteux')
    const acts = enumerateActions(after)
    expect(
      acts.some(
        (a) => a.type === 'RESOLVE_HERO_RELOCATE' && a.heroInstanceId === rap.instanceId && a.to === 'canard-boiteux',
      ),
    ).toBe(true)
  })
})
