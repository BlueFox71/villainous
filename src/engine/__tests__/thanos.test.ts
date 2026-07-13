import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { hasReachedObjective } from '../rules'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import {
  seedStoneIntoOpponent,
  deployThanosAlly,
  retrieveThanosAlly,
  stonesInOpponentRealms,
  opponentsControllingStone,
} from '../thanos'
import { thanos } from '../../data/villains/thanos'
import { thanosCards } from '../../data/villains/thanos.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const ally = (id: string): CardInstance => ({
  instanceId: id, cardId: 'legions-de-thanos', name: 'Légions de Thanos', type: 'ally', cost: 1, strength: 2,
})

function game(): GameState {
  const g = createInitialGame(
    [
      { villain: thanos, deckCards: buildDeckInstances(thanosCards, 'villain', 'p0:'), fateCards: buildDeckInstances(thanosCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    7,
  )
  return { ...g, activePlayer: 0 }
}

const skill = (id: string): CardInstance => ({
  instanceId: id, cardId: id, name: id, type: 'item', isInfinityStone: true,
})

describe('Thanos — mise en place & objectif', () => {
  it('les 6 Pierres sont mises en réserve (hors deck) au setup ; deck jouable = 30', () => {
    const g = game()
    const t = g.players[0]
    expect((t.stoneSupply ?? []).length).toBe(6)
    expect((t.stoneSupply ?? []).every((c) => c.isInfinityStone)).toBe(true)
    expect((t.stoneSkills ?? []).length).toBe(0)
    // Le deck (après la main de départ) + la main + la défausse ne contient plus de Pierre.
    const inDeck = [...t.deck, ...t.hand, ...t.discard]
    expect(inDeck.some((c) => c.isInfinityStone)).toBe(false)
    expect(inDeck.length).toBe(30)
  })

  it('objectif THANOS_STONES avec Adam Warlock comme verrou', () => {
    const g = game()
    expect(g.players[0].objective).toEqual({ type: 'THANOS_STONES', blockerHeroCardId: 'adam-warlock' })
  })

  it('victoire seulement avec 6 Compétences ET sans Adam Warlock dans le royaume', () => {
    const g = game()
    const loc0 = g.players[0].locations[0].id
    const withSkills = (n: number, board: Record<string, CardInstance[]> = {}): GameState => ({
      ...g,
      players: g.players.map((p, i) =>
        i === 0
          ? { ...p, stoneSkills: Array.from({ length: n }, (_, k) => skill(`s${k}`)), board: { ...p.board, ...board } }
          : p,
      ),
    })
    expect(hasReachedObjective(withSkills(5), 0)).toBe(false)
    expect(hasReachedObjective(withSkills(6), 0)).toBe(true)
    // Adam Warlock présent → victoire bloquée même à 6 Pierres.
    const adam: CardInstance = { instanceId: 'adam#1', cardId: 'adam-warlock', name: 'Adam Warlock', type: 'hero', strength: 6 }
    expect(hasReachedObjective(withSkills(6, { [loc0]: [adam] }), 0)).toBe(false)
  })
})

describe('Thanos — mécanique des Pierres (seed / capture)', () => {
  it('seedStoneIntoOpponent pose une Pierre chez l’adversaire (réserve 6→5, non défaussable)', () => {
    const g = game()
    const oppLoc = g.players[1].pawnLocation!
    const { state, seeded, locationId } = seedStoneIntoOpponent(g, 0, 1)
    expect(seeded?.isInfinityStone).toBe(true)
    expect(locationId).toBe(oppLoc)
    expect((state.players[0].stoneSupply ?? []).length).toBe(5)
    const onBoard = state.players[1].board[oppLoc].filter((c) => c.isInfinityStone)
    expect(onBoard).toHaveLength(1)
    expect(onBoard[0].cannotBeDiscarded).toBe(true)
    expect(stonesInOpponentRealms(state, 0)).toHaveLength(1)
    expect(opponentsControllingStone(state, 0)).toBe(1)
  })

  it('s’associe à un Allié adverse présent sur le lieu', () => {
    const g0 = game()
    const oppLoc = g0.players[1].pawnLocation!
    const oppAlly: CardInstance = { instanceId: 'oa#1', cardId: 'x', name: 'Garde', type: 'ally', strength: 3 }
    const g: GameState = {
      ...g0,
      players: g0.players.map((p, i) => (i === 1 ? { ...p, board: { ...p.board, [oppLoc]: [oppAlly] } } : p)),
    }
    const { state } = seedStoneIntoOpponent(g, 0, 1)
    const stone = state.players[1].board[oppLoc].find((c) => c.isInfinityStone)!
    expect(stone.attachedTo).toBe('oa#1')
  })

  it('boucle de capture : déployer un Allié sur la Pierre puis le rapatrier → Compétence', () => {
    const g0 = game()
    const thanosLoc = g0.players[0].locations[0].id
    const oppLoc = g0.players[1].pawnLocation!
    // Un Allié de Thanos sur son plateau + une Pierre chez l'adversaire.
    let g: GameState = {
      ...g0,
      players: g0.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, [thanosLoc]: [ally('a1')] } } : p)),
    }
    g = seedStoneIntoOpponent(g, 0, 1).state
    // Déploiement chez l'adversaire, sur le lieu de la Pierre.
    g = deployThanosAlly(g, 0, 'a1', 1, oppLoc)
    expect((g.players[0].deployedAllies ?? [])).toHaveLength(1)
    expect(g.players[0].board[thanosLoc].some((c) => c.instanceId === 'a1')).toBe(false)
    // Rapatriement → capture.
    const { state, captured } = retrieveThanosAlly(g, 0, 'a1', thanosLoc)
    expect(captured?.isInfinityStone).toBe(true)
    expect((state.players[0].stoneSkills ?? [])).toHaveLength(1)
    expect((state.players[0].deployedAllies ?? [])).toHaveLength(0)
    expect(state.players[0].board[thanosLoc].some((c) => c.instanceId === 'a1')).toBe(true)
    // La Pierre a quitté le domaine adverse.
    expect(stonesInOpponentRealms(state, 0)).toHaveLength(0)
  })

  it('effet THANOS_SEED_STONE : cible l’adversaire de Thanos, joué par Thanos OU en Fatalité', () => {
    const g = game()
    const oppLoc = g.players[1].pawnLocation!
    // Joué par Thanos (actorIndex 0).
    const s1 = resolveEffect(g, { type: 'THANOS_SEED_STONE' }, { actorIndex: 0 })
    expect(s1.players[1].board[oppLoc].some((c) => c.isInfinityStone)).toBe(true)
    // Joué en Fatalité par l'adversaire (actorIndex 1) : cible quand même l'adversaire (pas Thanos).
    const s2 = resolveEffect(g, { type: 'THANOS_SEED_STONE' }, { actorIndex: 1 })
    expect(s2.players[1].board[oppLoc].some((c) => c.isInfinityStone)).toBe(true)
    expect(s2.players[0].board[g.players[0].locations[0].id].some((c) => c.isInfinityStone)).toBe(false)
  })

  it('Un Modeste Prix à Payer : +1 Pouvoir, +1 si l’adversaire détient une Pierre', () => {
    const g = game()
    const base = resolveEffect(g, { type: 'THANOS_MODEST_PRICE' }, { actorIndex: 0 })
    expect(base.players[0].power).toBe(g.players[0].power + 1)
    const withStone = seedStoneIntoOpponent(g, 0, 1).state
    const boosted = resolveEffect(withStone, { type: 'THANOS_MODEST_PRICE' }, { actorIndex: 0 })
    expect(boosted.players[0].power).toBe(withStone.players[0].power + 2)
  })

  it('Nebula : Thanos perd du Pouvoir et Nebula grossit selon ses Compétences', () => {
    const g0 = game()
    const loc0 = g0.players[0].locations[0].id
    const nebula: CardInstance = { instanceId: 'neb#1', cardId: 'nebula', name: 'Nebula', type: 'hero', strength: 3 }
    const g: GameState = {
      ...g0,
      players: g0.players.map((p, i) =>
        i === 0
          ? { ...p, power: 5, stoneSkills: [skill('s1'), skill('s2')], board: { ...p.board, [loc0]: [nebula] } }
          : p,
      ),
    }
    const s = resolveEffect(g, { type: 'THANOS_NEBULA_DRAIN' }, { actorIndex: 0, hostInstanceId: 'neb#1', hostLocationId: loc0 })
    expect(s.players[0].power).toBe(3) // 5 − 2 Pierres
    const neb = s.players[0].board[loc0].find((c) => c.instanceId === 'neb#1')!
    expect(neb.forceTokens).toBe(2)
  })

  it('Quel qu’en Soit le Prix : Thanos défausse 1 carte par Pierre-Compétence', () => {
    const g0 = game()
    const hand = [ally('h1'), ally('h2'), ally('h3')].map((c, i) => ({ ...c, cost: i }))
    const g: GameState = {
      ...g0,
      players: g0.players.map((p, i) =>
        i === 0 ? { ...p, hand, discard: [], stoneSkills: [skill('s1'), skill('s2')] } : p,
      ),
    }
    // Joué en Fatalité par l'adversaire (actorIndex 1) : Thanos (0) défausse 2 cartes.
    const s = resolveEffect(g, { type: 'THANOS_WHATEVER_IT_TAKES' }, { actorIndex: 1 })
    expect(s.players[0].hand).toHaveLength(1)
    expect(s.players[0].discard).toHaveLength(2)
    // Sans Pierre : aucun effet.
    const g2: GameState = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, stoneSkills: [] } : p)) }
    const s2 = resolveEffect(g2, { type: 'THANOS_WHATEVER_IT_TAKES' }, { actorIndex: 1 })
    expect(s2.players[0].hand).toHaveLength(3)
  })

  it('Proxima Minuit : élimine un Héros de force ≤ 3 sur son lieu (pas les ≥ 4)', () => {
    const g0 = game()
    const loc = g0.players[0].locations[1].id
    const weak: CardInstance = { instanceId: 'weak', cardId: 'x', name: 'Faible', type: 'hero', strength: 2 }
    const strong: CardInstance = { instanceId: 'strong', cardId: 'y', name: 'Costaud', type: 'hero', strength: 5 }
    const g: GameState = {
      ...g0,
      players: g0.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, [loc]: [weak, strong] } } : p)),
    }
    const s = resolveEffect(g, { type: 'THANOS_PROXIMA_ELIMINATE' }, { actorIndex: 0, playDestination: loc })
    const cell = s.players[0].board[loc]
    expect(cell.some((c) => c.instanceId === 'weak')).toBe(false)
    expect(cell.some((c) => c.instanceId === 'strong')).toBe(true)
  })

  it('Gamora : élimine un Allié de Thanos sur son lieu et gagne +2 Force', () => {
    const g0 = game()
    const loc = g0.players[0].locations[0].id
    const gamora: CardInstance = { instanceId: 'gam', cardId: 'gamora', name: 'Gamora', type: 'hero', strength: 3 }
    const g: GameState = {
      ...g0,
      players: g0.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, [loc]: [gamora, ally('a1')] } } : p)),
    }
    const s = resolveEffect(g, { type: 'THANOS_GAMORA_ELIMINATE' }, { actorIndex: 0, hostInstanceId: 'gam', hostLocationId: loc })
    expect(s.players[0].board[loc].some((c) => c.instanceId === 'a1')).toBe(false)
    expect(s.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true)
    expect(s.players[0].board[loc].find((c) => c.instanceId === 'gam')?.forceTokens).toBe(2)
  })

  it('Sentence : transfère jusqu’à 2 Alliés sur un lieu à Pierre, +1 Force chacun', () => {
    const g0 = game()
    const tLoc = g0.players[0].locations[0].id
    let g: GameState = {
      ...g0,
      players: g0.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, [tLoc]: [ally('a1'), ally('a2'), ally('a3')] } } : p)),
    }
    g = seedStoneIntoOpponent(g, 0, 1).state
    const s = resolveEffect(g, { type: 'THANOS_TRANSFER_TO_STONE', count: 2 }, { actorIndex: 0 })
    expect((s.players[0].deployedAllies ?? [])).toHaveLength(2)
    expect((s.players[0].deployedAllies ?? []).every((d) => (d.ally.forceTokens ?? 0) === 1)).toBe(true)
  })

  it('Corvus Glaive transféré chez l’adversaire amène une Légion sur le même lieu', () => {
    const g0 = game()
    const tLoc = g0.players[0].locations[0].id
    const oppLoc = g0.players[1].pawnLocation!
    const corvus: CardInstance = { instanceId: 'corv', cardId: 'corvus-glaive', name: 'Corvus Glaive', type: 'ally', strength: 4 }
    const g: GameState = {
      ...g0,
      players: g0.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, [tLoc]: [corvus, ally('leg1')] } } : p)),
    }
    const s = deployThanosAlly(g, 0, 'corv', 1, oppLoc)
    // Corvus + 1 Légion déployés.
    expect((s.players[0].deployedAllies ?? [])).toHaveLength(2)
    expect((s.players[0].deployedAllies ?? []).some((d) => d.ally.cardId === 'legions-de-thanos')).toBe(true)
  })

  it('active une Pierre-Compétence (Pierre du Temps) : pioche + gagne 1 Pouvoir', () => {
    const g0 = game()
    const stone: CardInstance = {
      instanceId: 's-temps', cardId: 'pierre-du-temps', name: 'Pierre du Temps', type: 'item',
      isInfinityStone: true, activatedCost: 0,
      activatedEffects: [{ type: 'DRAW_CARDS', count: 1 }, { type: 'GAIN_POWER', amount: 1 }],
    }
    const g: GameState = {
      ...g0,
      phase: 'ACTION',
      activePlayer: 0,
      usedActionIds: [],
      players: g0.players.map((p, i) =>
        i === 0 ? { ...p, pawnLocation: 'sanctuaire-ii', stoneSkills: [stone], power: 3 } : p,
      ),
    }
    const handBefore = g.players[0].hand.length
    const s = applyAction(g, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 's-temps' })
    expect(s.players[0].power).toBe(4)
    expect(s.players[0].hand.length).toBe(handBefore + 1)
    // La Pierre reste en Compétence.
    expect((s.players[0].stoneSkills ?? []).some((c) => c.instanceId === 's-temps')).toBe(true)
  })

  it('capture via applyAction : DEPLOY puis RETRIEVE (action Déplacer) → Compétence', () => {
    const g0 = game()
    const oppLoc = g0.players[1].pawnLocation!
    // État de jeu : Thanos actif en phase ACTION, pion sur Titan (qui a « Déplacer »),
    // un Allié sur Titan, une Pierre chez l'adversaire.
    let g: GameState = {
      ...g0,
      phase: 'ACTION',
      activePlayer: 0,
      usedActionIds: [],
      players: g0.players.map((p, i) =>
        i === 0 ? { ...p, pawnLocation: 'titan', board: { ...p.board, titan: [ally('a1')] } } : p,
      ),
    }
    g = seedStoneIntoOpponent(g, 0, 1).state
    // Déploiement chez l'adversaire.
    const afterDeploy = applyAction(g, {
      type: 'THANOS_DEPLOY_ALLY', actionId: 'move-item-ally', allyInstanceId: 'a1', oppIndex: 1, oppLocationId: oppLoc,
    })
    expect((afterDeploy.players[0].deployedAllies ?? [])).toHaveLength(1)
    expect(afterDeploy.usedActionIds).toContain('move-item-ally')
    // Rapatriement (action Déplacer de Nulle-Part) → capture.
    const ready: GameState = { ...afterDeploy, pawnLocation: undefined, usedActionIds: [], players: afterDeploy.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'nulle-part' } : p)) }
    const afterRetrieve = applyAction(ready, {
      type: 'THANOS_RETRIEVE_ALLY', actionId: 'move-item-ally', allyInstanceId: 'a1', to: 'titan',
    })
    expect((afterRetrieve.players[0].stoneSkills ?? [])).toHaveLength(1)
    expect((afterRetrieve.players[0].deployedAllies ?? [])).toHaveLength(0)
    expect(afterRetrieve.players[0].board.titan.some((c) => c.instanceId === 'a1')).toBe(true)
  })
})
