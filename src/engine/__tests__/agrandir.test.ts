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

/** Reine de Cœur, un Héros posé sur `loc`. Lieux : cour-palais ↔ labyrinthe ↔
 *  foret-tulgey ↔ maison-lapin. */
function setup(loc: string, hero: CardInstance, pawn = loc, used: string[] = []): GameState {
  const base = createInitialGame(
    [{ villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') }],
    4,
  )
  return {
    ...base,
    phase: 'ACTION',
    usedActionIds: used,
    players: base.players.map((p) => ({ ...p, pawnLocation: pawn, board: { ...p.board, [loc]: [hero] } })),
  }
}

describe('Reine de Cœur — Agrandir (couverture)', () => {
  it('Agrandir fixe la taille « enlarged » et un lieu adjacent recouvert', () => {
    const s = setup('cour-palais', heroOf('h1'))
    const after = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'enlarged' }, { actorIndex: 0, targetHeroId: 'h1' })
    const hero = (after.players[0].board['cour-palais'] ?? [])[0]
    expect(hero.heroSize).toBe('enlarged')
    // Seul voisin de la Cour du Palais → débordement sur le Labyrinthe.
    expect(hero.enlargeTargetId).toBe('labyrinthe')
  })

  it('un Héros agrandi recouvre les 2 actions du haut de SON lieu', () => {
    let s = setup('cour-palais', heroOf('h1'))
    s = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'enlarged' }, { actorIndex: 0, targetHeroId: 'h1' })
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).not.toContain('discard')
    expect(ids).not.toContain('move-item-ally')
    expect(ids).toContain('gain-power') // bas, libre
  })

  it('un Héros agrandi recouvre UNE action du haut d’un lieu voisin (au choix)', () => {
    // Héros agrandi au Labyrinthe → déborde sur la Cour du Palais (voisin). Pion
    // à la Cour, sans Héros : ses 2 actions du haut (Défausser / Déplacer)
    // restent disponibles, mais une seule utilisable (la 2ᵉ est recouverte après
    // usage de la 1ʳᵉ). On choisit la Cour car ses 2 actions du haut sont
    // inconditionnelles (à l'inverse d'« Activer », conditionnée à une carte).
    let s = setup('labyrinthe', heroOf('h1'))
    s = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'enlarged' }, { actorIndex: 0, targetHeroId: 'h1' })
    expect((s.players[0].board['labyrinthe'] ?? [])[0].enlargeTargetId).toBe('cour-palais')
    s = { ...s, players: s.players.map((p) => ({ ...p, pawnLocation: 'cour-palais' })) }
    const free = getAvailableActions(s).map((a) => a.id)
    expect(free).toContain('discard')
    expect(free).toContain('move-item-ally')
    // Après usage d’une action du haut, l’autre est recouverte.
    const after = getAvailableActions({ ...s, usedActionIds: ['discard'] }).map((a) => a.id)
    expect(after).not.toContain('move-item-ally')
  })

  it('un lieu voisin SANS Héros agrandi adjacent n’est pas affecté', () => {
    // Héros agrandi à la Cour (déborde sur Labyrinthe). Pion à Forêt Tulgey
    // (voisin du Labyrinthe mais PAS de la Cour) → aucune action recouverte.
    let s = setup('cour-palais', heroOf('h1'))
    s = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'enlarged' }, { actorIndex: 0, targetHeroId: 'h1' })
    s = { ...s, players: s.players.map((p) => ({ ...p, pawnLocation: 'foret-tulgey' })) }
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).toContain('fate')
    expect(ids).toContain('play-card')
  })

  it('Agrandir sur un Héros rapetissé le ramène à sa taille normale', () => {
    const s = setup('cour-palais', heroOf('h1', 'shrunk'))
    const after = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'enlarged' }, { actorIndex: 0, targetHeroId: 'h1' })
    const hero = (after.players[0].board['cour-palais'] ?? [])[0]
    expect(hero.heroSize).toBeUndefined()
    expect(hero.enlargeTargetId).toBeUndefined()
  })

  it('un Héros agrandi puis HYPNOTISÉ ne recouvre plus rien (voisin compris)', () => {
    let s = setup('labyrinthe', heroOf('h1'))
    s = resolveEffect(s, { type: 'SET_HERO_SIZE', size: 'enlarged' }, { actorIndex: 0, targetHeroId: 'h1' })
    s = {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        pawnLocation: 'cour-palais',
        board: { ...p.board, labyrinthe: (p.board['labyrinthe'] ?? []).map((c) => ({ ...c, hypnotized: true })) },
      })),
    }
    // Débordement annulé : les 2 actions du haut de la Cour restent libres.
    const after = getAvailableActions({ ...s, usedActionIds: ['discard'] }).map((a) => a.id)
    expect(after).toContain('move-item-ally')
  })
})
