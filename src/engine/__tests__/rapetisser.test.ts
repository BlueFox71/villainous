import { describe, it, expect } from 'vitest'
import { getAvailableActions } from '../rules'
import { resolveEffect } from '../effects'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const heroOf = (id: string, size?: 'shrunk' | 'enlarged', cardId = 'alice'): CardInstance => ({
  instanceId: id,
  cardId,
  name: cardId,
  type: 'hero',
  strength: 3,
  heroSize: size,
})

/** Reine de Cœur, pion à la Cour (haut : Défausser / Déplacer), avec un Héros dessus. */
function setup(hero: CardInstance, used: string[] = []): GameState {
  const base = createInitialGame(
    [{ villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') }],
    4,
  )
  return {
    ...base,
    phase: 'ACTION',
    usedActionIds: used,
    players: base.players.map((p) => ({ ...p, pawnLocation: 'cour-palais', board: { ...p.board, 'cour-palais': [hero] } })),
  }
}

describe('Reine de Cœur — Rapetisser (couverture)', () => {
  it('un Héros NORMAL recouvre les 2 actions du haut', () => {
    const ids = getAvailableActions(setup(heroOf('h1'))).map((a) => a.id)
    expect(ids).not.toContain('discard') // haut
    expect(ids).not.toContain('move-item-ally') // haut
    expect(ids).toContain('gain-power') // bas, libre
  })

  it('un Héros RAPETISSÉ laisse les 2 actions du haut disponibles (1 au choix)', () => {
    const ids = getAvailableActions(setup(heroOf('h1', 'shrunk'))).map((a) => a.id)
    expect(ids).toContain('discard')
    expect(ids).toContain('move-item-ally')
  })

  it('après avoir utilisé une action du haut, l’autre est recouverte', () => {
    const ids = getAvailableActions(setup(heroOf('h1', 'shrunk'), ['discard'])).map((a) => a.id)
    expect(ids).not.toContain('move-item-ally')
  })

  it('Rapetisser marque le Héros, mais le Loir ne peut pas rapetisser', () => {
    const s = setup(heroOf('h1'))
    const shrunk = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'shrunk' }, { actorIndex: 0, targetHeroId: 'h1' })
    expect((shrunk.players[0].board['cour-palais'] ?? [])[0].heroSize).toBe('shrunk')

    const sLoir = setup(heroOf('l1', undefined, 'loir'))
    const after = resolveEffect(sLoir, { type: 'SET_HERO_SIZE', size: 'shrunk' }, { actorIndex: 0, targetHeroId: 'l1' })
    expect((after.players[0].board['cour-palais'] ?? [])[0].heroSize).toBeUndefined()
  })
})
