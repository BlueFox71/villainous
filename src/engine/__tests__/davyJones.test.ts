import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { performVanquish, resolveEffects } from '../effects'
import { effectiveStrength, allyBlockedAt } from '../rules'
import { placeFacedownTreasure, revealTreasure, TREASURE_IDS } from '../davyJones'
import { davyJones } from '../../data/villains/davyJones'
import { davyJonesCards } from '../../data/villains/davyJones.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { chooseAction } from '../../ai/heuristicBot'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: davyJones,
        deckCards: buildDeckInstances(davyJonesCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(davyJonesCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

describe('Davy Jones — mise en place', () => {
  it('objectif CLAIM_ALL_TREASURES (5), réserve de 5 jetons mélangés, aucun récupéré', () => {
    const p = game().players[0]
    expect(p.objective).toEqual({ type: 'CLAIM_ALL_TREASURES', count: 5 })
    expect(p.treasureReserve).toHaveLength(5)
    expect([...(p.treasureReserve ?? [])].sort()).toEqual([...TREASURE_IDS].sort())
    expect(p.claimedTreasures).toEqual([])
    expect(p.locations.map((l) => l.id)).toEqual([
      'hollandais-volant', 'sous-le-pont', 'quartiers-davy-jones', 'hauts-fonds',
    ])
  })
})

describe('Davy Jones — cycle des Trésors', () => {
  const withHero = (extra: Partial<CardInstance> = {}): GameState => {
    const base = game()
    const hero = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h1', ...extra })
    return { ...base, phase: 'ACTION', players: [{ ...base.players[0], board: { 'hollandais-volant': [hero] } }] }
  }

  it('pose un jeton Trésor FACE CACHÉE (réserve −1) puis le révèle', () => {
    let s = withHero()
    const before = (s.players[0].treasureReserve ?? []).length
    s = placeFacedownTreasure(s, 0, 'h1')
    const hero = s.players[0].board['hollandais-volant'].find((c) => c.instanceId === 'h1')!
    expect(hero.treasure).toBeDefined()
    expect(hero.treasure!.faceUp).toBe(false)
    expect((s.players[0].treasureReserve ?? []).length).toBe(before - 1)
    s = revealTreasure(s, 0, 'h1')
    expect(s.players[0].board['hollandais-volant'].find((c) => c.instanceId === 'h1')!.treasure!.faceUp).toBe(true)
  })

  it('Le Compas de Jack révélé donne +2 Force au Héros', () => {
    let s = withHero()
    // force le 1ᵉʳ jeton de la réserve à être le Compas.
    s = { ...s, players: [{ ...s.players[0], treasureReserve: ['compas-de-jack', ...(s.players[0].treasureReserve ?? [])] }] }
    s = placeFacedownTreasure(s, 0, 'h1')
    expect(effectiveStrength(s, 0, 'h1')).toBe(3) // face cachée : pas de bonus
    s = revealTreasure(s, 0, 'h1')
    expect(effectiveStrength(s, 0, 'h1')).toBe(5) // 3 + 2
  })

  it('La Clé révélée fait défausser la main', () => {
    let s = withHero()
    s = { ...s, players: [{ ...s.players[0], treasureReserve: ['la-cle'], hand: [card('amis-ennemis', 'effect'), card('la-poursuite', 'effect')] }] }
    s = placeFacedownTreasure(s, 0, 'h1')
    s = revealTreasure(s, 0, 'h1')
    expect(s.players[0].hand).toHaveLength(0)
    expect(s.players[0].discard.length).toBe(2)
  })

  it('Le Coffre au Trésor révélé interdit les Alliés sur son lieu', () => {
    let s = withHero({ treasure: { id: 'coffre-au-tresor', faceUp: true } })
    expect(allyBlockedAt(s, 0, 'hollandais-volant')).toBe(true)
    expect(allyBlockedAt(s, 0, 'sous-le-pont')).toBe(false)
    // face cachée : pas de blocage.
    s = withHero({ treasure: { id: 'coffre-au-tresor', faceUp: false } })
    expect(allyBlockedAt(s, 0, 'hollandais-volant')).toBe(false)
  })

  it('vaincre un Héros à trésor RÉVÉLÉ le récupère ; un trésor face cachée retourne en réserve', () => {
    // Révélé → récupéré.
    let s = withHero({ treasure: { id: 'compas-de-jack', faceUp: true } })
    const ally = card('le-kraken', 'ally', { strength: 8, instanceId: 'a1' })
    s = { ...s, players: [{ ...s.players[0], board: { 'hollandais-volant': [s.players[0].board['hollandais-volant'][0], ally] } }] }
    const r = performVanquish(s, 'h1', ['a1'], false)
    expect(r.players[0].claimedTreasures).toContain('compas-de-jack')
    // Face cachée → retourne dans la réserve, pas récupéré.
    let s2 = withHero({ treasure: { id: 'boite-a-musique', faceUp: false } })
    const ally2 = card('le-second-maccus', 'ally', { strength: 3, instanceId: 'a2' })
    s2 = { ...s2, players: [{ ...s2.players[0], board: { 'hollandais-volant': [s2.players[0].board['hollandais-volant'][0], ally2] } }] }
    const r2 = performVanquish(s2, 'h1', ['a2'], false)
    expect(r2.players[0].claimedTreasures ?? []).not.toContain('boite-a-musique')
    expect(r2.players[0].treasureReserve).toContain('boite-a-musique')
  })

  it('récupérer le 5ᵉ Trésor = VICTOIRE', () => {
    let s = withHero({ treasure: { id: 'le-coeur', faceUp: true } })
    const ally = card('le-kraken', 'ally', { strength: 8, instanceId: 'a1' })
    s = {
      ...s,
      players: [{
        ...s.players[0],
        claimedTreasures: ['compas-de-jack', 'la-cle', 'coffre-au-tresor', 'boite-a-musique'],
        board: { 'hollandais-volant': [s.players[0].board['hollandais-volant'][0], ally] },
      }],
    }
    const r = performVanquish(s, 'h1', ['a1'], false)
    expect(r.status).toBe('WON')
    expect(r.winner).toBe(0)
    // Le Cœur : Pouvoir tombe à 0 à la récupération.
    expect(r.players[0].power).toBe(0)
  })

  it('Jack Sparrow bloque l’action Éliminer sur le lieu du pion', () => {
    const base = game()
    const jack = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h1', blocksVanquishHere: true, treasure: { id: 'le-coeur', faceUp: true } })
    const ally = card('le-kraken', 'ally', { strength: 8, instanceId: 'a1' })
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], pawnLocation: 'hollandais-volant', board: { 'hollandais-volant': [jack, ally] } }],
    }
    expect(() => applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['a1'] })).toThrow()
  })
})

describe('Davy Jones — cartes interactives', () => {
  it('As-tu peur de la mort ? : pendingPlaceTreasure n’est pas requis (héros joué reçoit le tréson auto)', () => {
    // On vérifie surtout que poser un trésor via le pending fonctionne (Ils sont là).
    const base = game()
    const hero = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h1' })
    let s: GameState = { ...base, players: [{ ...base.players[0], board: { 'sous-le-pont': [hero] } }], pendingPlaceTreasure: { playerIndex: 0 } }
    // Phase 1 : choisir le Héros.
    s = applyAction(s, { type: 'RESOLVE_PLACE_TREASURE', heroInstanceId: 'h1' })
    expect(s.pendingPlaceTreasure?.heroInstanceId).toBe('h1')
    // Phase 2 : choisir QUEL Trésor (parmi la réserve).
    const tid = s.players[0].treasureReserve![2]
    s = applyAction(s, { type: 'RESOLVE_PLACE_TREASURE', treasureId: tid })
    const placed = s.players[0].board['sous-le-pont'].find((c) => c.instanceId === 'h1')!.treasure
    expect(placed?.faceUp).toBe(false)
    expect(placed?.id).toBe(tid) // c'est bien le trésor choisi
    expect(s.players[0].treasureReserve).not.toContain(tid)
    expect(s.pendingPlaceTreasure).toBeFalsy()
  })

  it('Will Turner : déplacé, défausse un Allié de force ≤ 2 de son nouveau lieu', () => {
    const base = game()
    const will = card('will-turner', 'hero', { strength: 4, instanceId: 'h1' })
    const weak = card('equipage-hollandais', 'ally', { strength: 1, instanceId: 'a1' })
    let s: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { 'sous-le-pont': [will], 'quartiers-davy-jones': [weak] } }],
    }
    s = resolveEffects(s, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: 'quartiers-davy-jones' }], { actorIndex: 0, targetHeroId: 'h1' })
    expect(s.players[0].board['quartiers-davy-jones'].some((c) => c.instanceId === 'a1')).toBe(false)
    expect(s.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true)
  })

  it('Le Black Pearl : à la mort de son hôte, se réassocie à un autre Héros du lieu', () => {
    const base = game()
    const h1 = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h1' })
    const h2 = card('james-norrington', 'hero', { strength: 4, instanceId: 'h2' })
    const bp = card('black-pearl-objet', 'item', { instanceId: 'bp', attach: 'hero', attachStrengthBonus: 3, reattachOnHostDefeat: true, attachedTo: 'h1' })
    const ally = card('le-kraken', 'ally', { strength: 8, instanceId: 'a1' })
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { 'sous-le-pont': [h1, h2, bp, ally] } }],
    }
    const r = performVanquish(s, 'h1', ['a1'], false)
    const movedBp = r.players[0].board['sous-le-pont'].find((c) => c.instanceId === 'bp')
    expect(movedBp?.attachedTo).toBe('h2')
  })

  it('La Marque Noire : injouable sans trésor face cachée, jouable sinon', () => {
    const base = game()
    const mn = { ...buildDeckInstances(davyJonesCards, 'villain', 'mn:').find((d) => d.cardId === 'la-marque-noire')!, instanceId: 'mn1' }
    // Aucun trésor face cachée → injouable.
    const heroNoTreasure = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h1' })
    const s0: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], power: 5, pawnLocation: 'sous-le-pont', hand: [mn], board: { 'quartiers-davy-jones': [heroNoTreasure] } }] }
    expect(() => applyAction(s0, { type: 'PLAY_CARD', instanceId: 'mn1', actionId: 'play-card' })).toThrow()
    // Un Héros porte un trésor face cachée → jouable (ouvre la révélation).
    const heroFd = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h2', treasure: { id: 'compas-de-jack', faceUp: false } })
    const s1: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], power: 5, pawnLocation: 'sous-le-pont', hand: [{ ...mn, instanceId: 'mn2' }], board: { 'quartiers-davy-jones': [heroFd] } }] }
    const r = applyAction(s1, { type: 'PLAY_CARD', instanceId: 'mn2', actionId: 'play-card' })
    expect(r.pendingRevealTreasure?.candidateIds).toContain('h2')
  })

  it('La Poursuite : injouable si NI Héros NI Allié dans le royaume', () => {
    const base = game()
    const chase = { ...buildDeckInstances(davyJonesCards, 'villain', 'ch:').find((d) => d.cardId === 'la-poursuite')!, instanceId: 'ch1' }
    const s: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], power: 5, pawnLocation: 'sous-le-pont', hand: [chase], board: {} }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', instanceId: 'ch1', actionId: 'play-card' })).toThrow()
  })

  it('Les amis deviennent des ennemis : déplace un trésor d’un Héros vers un autre', () => {
    const base = game()
    const h1 = card('jack-sparrow', 'hero', { strength: 3, instanceId: 'h1', treasure: { id: 'compas-de-jack', faceUp: false } })
    const h2 = card('will-turner', 'hero', { strength: 4, instanceId: 'h2' })
    let s: GameState = { ...base, players: [{ ...base.players[0], board: { 'sous-le-pont': [h1, h2] } }], pendingMoveSwapTreasure: { playerIndex: 0 } }
    s = applyAction(s, { type: 'RESOLVE_MOVE_SWAP_TREASURE', heroInstanceId: 'h1' }) // source
    s = applyAction(s, { type: 'RESOLVE_MOVE_SWAP_TREASURE', heroInstanceId: 'h2' }) // cible
    expect(s.players[0].board['sous-le-pont'].find((c) => c.instanceId === 'h1')!.treasure).toBeUndefined()
    expect(s.players[0].board['sous-le-pont'].find((c) => c.instanceId === 'h2')!.treasure?.id).toBe('compas-de-jack')
  })
})

describe('Davy Jones — partie pilotée par le bot (anti-soft-lock)', () => {
  const seededRand = (seed: number): (() => number) => {
    let x = seed >>> 0
    return () => {
      x = (x * 1664525 + 1013904223) >>> 0
      return x / 0xffffffff
    }
  }
  it('le bot joue Davy Jones sans blocage ni exception sur plusieurs tours', () => {
    let s = createInitialGame(
      [
        { villain: davyJones, deckCards: buildDeckInstances(davyJonesCards, 'villain', 'p0:'), fateCards: buildDeckInstances(davyJonesCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      42,
    )
    const rand = seededRand(123)
    let steps = 0
    while (s.status === 'PLAYING' && steps < 400) {
      const a = chooseAction(s, rand)
      s = applyAction(s, a)
      steps++
    }
    expect(s.turn).toBeGreaterThan(3)
  })
})

describe('Davy Jones — Hadras défaussé révèle un jeton Trésor', () => {
  it('Hadras utilisé pour un Vanquish → révèle un Trésor face cachée sur un autre Héros', () => {
    const base = game()
    const victim = card('victime', 'hero', { strength: 2, instanceId: 'vic' })
    const hadras = card('hadras', 'ally', { strength: 2, instanceId: 'had', revealTreasureOnDiscard: true })
    const carrier = card('porteur', 'hero', { strength: 3, instanceId: 'car', treasure: { id: 'compas-de-jack', faceUp: false } })
    const s: GameState = {
      ...base,
      players: [{ ...base.players[0], pawnLocation: 'hollandais-volant', board: { 'hollandais-volant': [victim, hadras], 'sous-le-pont': [carrier] } }],
    }
    const r = performVanquish(s, 'vic', ['had'], false)
    // Hadras est défaussé (utilisé pour vaincre) et a révélé le trésor du porteur.
    expect(r.players[0].discard.some((c) => c.instanceId === 'had')).toBe(true)
    const car = (r.players[0].board['sous-le-pont'] ?? []).find((c) => c.instanceId === 'car')
    expect(car?.treasure?.faceUp).toBe(true)
  })
})

describe('Davy Jones — Will Turner (contre) cible l’Allié le plus précieux', () => {
  it('défausse Bill le Bottier en priorité (et jamais Hadras tant qu’une autre cible existe)', () => {
    const base = game()
    const bill = card('bill-le-bottier', 'ally', { strength: 1, instanceId: 'bill' })
    const hadras = card('hadras', 'ally', { strength: 2, instanceId: 'had', revealTreasureOnDiscard: true })
    const crew = card('equipage-hollandais', 'ally', { strength: 1, instanceId: 'crew' })
    const s: GameState = { ...base, players: [{ ...base.players[0], board: { 'hollandais-volant': [bill, hadras, crew] } }] }
    const r = resolveEffects(s, [{ type: 'WILL_TURNER_DISCARD' }], { actorIndex: 0, hostLocationId: 'hollandais-volant' })
    expect(r.players[0].discard.some((c) => c.instanceId === 'bill')).toBe(true)
    expect((r.players[0].board['hollandais-volant'] ?? []).some((c) => c.instanceId === 'had')).toBe(true)
  })
})
