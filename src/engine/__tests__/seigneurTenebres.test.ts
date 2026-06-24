import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { resolveEffects } from '../effects'
import { applyAction } from '../actions'
import { hasReachedObjective, cauldronBornLocations, effectiveStrength, getAvailableActions } from '../rules'
import { enumerateActions } from '../../ai/enumerate'
import { seigneurTenebres } from '../../data/villains/seigneurTenebres'
import { seigneurTenebresCards } from '../../data/villains/seigneurTenebres.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: seigneurTenebres,
        deckCards: buildDeckInstances(seigneurTenebresCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(seigneurTenebresCards, 'fate', 'p0f:'),
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
const setBoard = (s: GameState, board: Record<string, CardInstance[]>): GameState => ({
  ...s,
  players: [{ ...s.players[0], board: { ...s.players[0].board, ...board } }],
})

describe('Le Seigneur des Ténèbres — mise en place', () => {
  it('le Chaudron Noir démarre « mis de côté » et l’objectif est CAULDRON_BORN_EVERYWHERE', () => {
    const s = game()
    expect(s.players[0].blackCauldron).toBe('set-aside')
    expect(s.players[0].objective.type).toBe('CAULDRON_BORN_EVERYWHERE')
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Le Seigneur des Ténèbres — Chaudron Noir', () => {
  it('CLAIM_BLACK_CAULDRON : set-aside → claimed (sans effet si déjà réclamé)', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'CLAIM_BLACK_CAULDRON' }], { actorIndex: 0 })
    expect(s.players[0].blackCauldron).toBe('claimed')
    // déjà réclamé : pas de régression
    s = resolveEffects(s, [{ type: 'CLAIM_BLACK_CAULDRON' }], { actorIndex: 0 })
    expect(s.players[0].blackCauldron).toBe('claimed')
  })

  it('Les Sorcières de Morva en jeu : la prise du Chaudron est bloquée (set-aside conservé)', () => {
    let s = setBoard(game(), { morva: [card('witches-of-morva', 'hero', { strength: 3 })] })
    s = resolveEffects(s, [{ type: 'CLAIM_BLACK_CAULDRON' }], { actorIndex: 0 })
    expect(s.players[0].blackCauldron).toBe('set-aside')
    // Une fois les Sorcières parties, la prise réussit.
    s = setBoard(s, { morva: [] })
    s = resolveEffects(s, [{ type: 'CLAIM_BLACK_CAULDRON' }], { actorIndex: 0 })
    expect(s.players[0].blackCauldron).toBe('claimed')
  })

  it('Montre-moi (Sorcières en jeu, Chaudron à prendre) : gagne le Pouvoir au lieu du Chaudron, sans choix', () => {
    let s = setBoard(game(), { morva: [card('witches-of-morva', 'hero', { strength: 3 })] })
    const p0 = s.players[0].power
    s = resolveEffects(s, [{ type: 'CLAIM_CAULDRON_OR_POWER', power: 3 }], { actorIndex: 0 })
    expect(s.pendingCauldronChoice ?? null).toBeNull()
    expect(s.players[0].blackCauldron).toBe('set-aside')
    expect(s.players[0].power).toBe(p0 + 3)
  })

  it('ACTIVATE_CAULDRON : claimed → powered ; refusé si pas réclamé', () => {
    let s = game()
    s = { ...s, phase: 'ACTION' }
    expect(() => applyAction(s, { type: 'ACTIVATE_CAULDRON' })).toThrow()
    s = resolveEffects(s, [{ type: 'CLAIM_BLACK_CAULDRON' }], { actorIndex: 0 })
    s = applyAction(s, { type: 'ACTIVATE_CAULDRON' })
    expect(s.players[0].blackCauldron).toBe('powered')
  })
})

describe('Le Seigneur des Ténèbres — Soldats Ressuscités', () => {
  const cbCard = () => ({ ...card('cauldron-born', 'ally', { strength: 3, requiresPoweredCauldron: true }), instanceId: 'cb1' })

  it('injouable si le Chaudron Magique n’est pas réveillé', () => {
    const cb = cbCard()
    const s = { ...game(), phase: 'ACTION' as const, players: [{ ...game().players[0], pawnLocation: 'morva', power: 5, hand: [cb], blackCauldron: 'claimed' as const }] }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'cb1', to: 'morva' }),
    ).toThrow(/Chaudron Magique/i)
  })

  it('jouable sur n’importe quel lieu une fois le Chaudron réveillé', () => {
    const cb = cbCard()
    let s = { ...game(), phase: 'ACTION' as const, players: [{ ...game().players[0], pawnLocation: 'morva', power: 5, hand: [cb], blackCauldron: 'powered' as const }] }
    expect(cauldronBornLocations(s.players[0], cb)).toContain('morva')
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'cb1', to: 'morva' })
    expect((s.players[0].board['morva'] ?? []).some((c) => c.cardId === 'cauldron-born')).toBe(true)
  })

  it('« Notre heure est venue ! » réveille le Chaudron en sa possession', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'CLAIM_BLACK_CAULDRON' }], { actorIndex: 0 })
    s = resolveEffects(s, [{ type: 'POWER_BLACK_CAULDRON' }], { actorIndex: 0 })
    expect(s.players[0].blackCauldron).toBe('powered')
  })
})

describe('Le Seigneur des Ténèbres — victoire', () => {
  it('un Mort-vivant du Chaudron sur CHACUN des 4 lieux → objectif atteint', () => {
    const s = setBoard(game(), {
      morva: [card('cauldron-born', 'ally', { strength: 3 })],
      'royaume-petit-peuple': [card('cauldron-born', 'ally', { strength: 3 })],
      cachots: [card('cauldron-born', 'ally', { strength: 3 })],
      'salle-trone': [card('cauldron-born', 'ally', { strength: 3 })],
    })
    expect(hasReachedObjective(s, 0)).toBe(true)
  })

  it('manquant sur un lieu → objectif NON atteint', () => {
    const s = setBoard(game(), {
      morva: [card('cauldron-born', 'ally', { strength: 3 })],
      'royaume-petit-peuple': [card('cauldron-born', 'ally', { strength: 3 })],
      cachots: [card('cauldron-born', 'ally', { strength: 3 })],
    })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Le Seigneur des Ténèbres — effets branchés', () => {
  it('Capturés : pioche 3 cartes', () => {
    let s = game()
    const before = s.players[0].hand.length
    s = resolveEffects(s, [{ type: 'DRAW_CARDS', count: 3 }], { actorIndex: 0 })
    expect(s.players[0].hand.length).toBe(before + 3)
  })

  it('Sacrifice de Gurki : rendort le Chaudron réveillé (powered → claimed)', () => {
    let s = { ...game(), players: [{ ...game().players[0], blackCauldron: 'powered' as const }] }
    s = resolveEffects(s, [{ type: 'DORMANT_BLACK_CAULDRON' }], { actorIndex: 0 })
    expect(s.players[0].blackCauldron).toBe('claimed')
  })

  it('Taram : +1 force par autre Héros sur son lieu', () => {
    const taram = card('taran', 'hero', { strength: 3, selfStrengthMods: [{ kind: 'per-other-hero-here', delta: 1 }] })
    const s = setBoard(game(), { morva: [taram, card('gurgi', 'hero', { strength: 1 }), card('doli', 'hero', { strength: 2 })] })
    expect(effectiveStrength(s, 0, taram.instanceId)).toBe(5) // 3 + 2 autres Héros
  })

  it('Tirelire (blocksVillainEvents) : interdit de jouer un Événement', () => {
    const event = { ...card('our-hour-has-arrived', 'effect', { cost: 0, effects: [{ type: 'GAIN_POWER', amount: 1 }] }), instanceId: 'ev1' }
    let s = setBoard(game(), { cachots: [card('hen-wen', 'hero', { strength: 1, blocksVillainEvents: true })] })
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'morva', power: 5, hand: [event] }] }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'ev1', to: 'morva' }),
    ).toThrow(/Événement/i)
  })

  it('Squelettes de Soldats : donne l’action « Activer » qui réveille le Chaudron en possession', () => {
    const squelettes = card('ancient-soldiers', 'item', { grantsAction: { type: 'ACTIVATE', label: 'Activer (Squelettes)' } })
    const base = game()
    let s = {
      ...base,
      phase: 'ACTION' as const,
      players: [{ ...base.players[0], pawnLocation: 'morva', blackCauldron: 'claimed' as const, board: { ...base.players[0].board, morva: [squelettes] } }],
    }
    // L'action « Activer » est disponible (Chaudron en possession + Squelettes au lieu).
    expect(getAvailableActions(s).some((a) => a.type === 'ACTIVATE')).toBe(true)
    // Elle réveille le Chaudron (face Pouvoir).
    s = applyAction(s, { type: 'ACTIVATE_CAULDRON' })
    expect(s.players[0].blackCauldron).toBe('powered')
  })

  it('Réveil du Chaudron : pas d’action « Activer » sans Squelettes de Soldats au lieu du pion', () => {
    const base = game()
    const s = { ...base, phase: 'ACTION' as const, players: [{ ...base.players[0], pawnLocation: 'morva', blackCauldron: 'claimed' as const }] }
    expect(getAvailableActions(s).some((a) => a.type === 'ACTIVATE')).toBe(false)
  })

  it('Montre-moi le Chaudron Magique : ouvre le choix Chaudron/Pouvoir, puis « cauldron » s’en empare', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'CLAIM_CAULDRON_OR_POWER', power: 3 }], { actorIndex: 0 })
    expect(s.pendingCauldronChoice).toEqual({ playerIndex: 0, power: 3 })
    s = applyAction(s, { type: 'RESOLVE_CAULDRON_CHOICE', choice: 'cauldron' })
    expect(s.pendingCauldronChoice ?? null).toBeNull()
    expect(s.players[0].blackCauldron).toBe('claimed')
  })

  it('Montre-moi : choix « power » gagne le Pouvoir au lieu du Chaudron', () => {
    let s = game()
    const p0 = s.players[0].power
    s = resolveEffects(s, [{ type: 'CLAIM_CAULDRON_OR_POWER', power: 3 }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_CAULDRON_CHOICE', choice: 'power' })
    expect(s.players[0].blackCauldron).toBe('set-aside')
    expect(s.players[0].power).toBe(p0 + 3)
  })

  it('Montre-moi : si le Chaudron est déjà réclamé, gagne directement le Pouvoir (pas de choix)', () => {
    let s = { ...game(), players: [{ ...game().players[0], blackCauldron: 'claimed' as const }] }
    const p0 = s.players[0].power
    s = resolveEffects(s, [{ type: 'CLAIM_CAULDRON_OR_POWER', power: 3 }], { actorIndex: 0 })
    expect(s.pendingCauldronChoice ?? null).toBeNull()
    expect(s.players[0].power).toBe(p0 + 3)
  })

  // ── Nous avons conclu un marché ! ──────────────────────────────────────────
  const bargainState = () => {
    const hero = card('taran', 'hero', { instanceId: 'h1', strength: 3 })
    const sword = card('dyrnwyn', 'item', { attach: 'hero', attachedTo: 'h1' })
    const base = game()
    return {
      ...base,
      players: [{
        ...base.players[0],
        power: 5,
        deck: [],
        discard: [card('x', 'effect')],
        board: { ...base.players[0].board, morva: [hero, sword] },
        blackCauldron: 'set-aside' as const,
      }],
    }
  }

  it('Nous avons conclu : les deux options possibles → ouvre le choix', () => {
    const s = resolveEffects(bargainState(), [{ type: 'BARGAIN_RESHUFFLE_OR_SWORD', power: 3 }], { actorIndex: 0 })
    expect(s.pendingBargainChoice).toEqual({ playerIndex: 0, power: 3 })
  })

  it('Nous avons conclu : choix « sword » défausse l’Épée Magique, paie 3 et s’empare du Chaudron', () => {
    let s = resolveEffects(bargainState(), [{ type: 'BARGAIN_RESHUFFLE_OR_SWORD', power: 3 }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_BARGAIN_CHOICE', choice: 'sword' })
    expect(s.pendingBargainChoice ?? null).toBeNull()
    expect(s.players[0].blackCauldron).toBe('claimed')
    expect(s.players[0].power).toBe(2) // 5 − 3
    expect(Object.values(s.players[0].board).flat().some((c) => c.cardId === 'dyrnwyn')).toBe(false)
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'dyrnwyn')).toBe(true)
  })

  it('Nous avons conclu : choix « reshuffle » mélange la défausse dans la pioche (Chaudron intact)', () => {
    let s = resolveEffects(bargainState(), [{ type: 'BARGAIN_RESHUFFLE_OR_SWORD', power: 3 }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_BARGAIN_CHOICE', choice: 'reshuffle' })
    expect(s.players[0].discard).toHaveLength(0)
    expect(s.players[0].deck).toHaveLength(1)
    expect(s.players[0].blackCauldron).toBe('set-aside')
    expect(s.players[0].power).toBe(5)
  })

  it('Nous avons conclu : une seule option (pas d’Épée) → mélange auto, sans choix', () => {
    const base = game()
    const s0 = { ...base, players: [{ ...base.players[0], power: 5, deck: [], discard: [card('x', 'effect')], blackCauldron: 'set-aside' as const }] }
    const s = resolveEffects(s0, [{ type: 'BARGAIN_RESHUFFLE_OR_SWORD', power: 3 }], { actorIndex: 0 })
    expect(s.pendingBargainChoice ?? null).toBeNull()
    expect(s.players[0].discard).toHaveLength(0)
  })

  // ── On te tient, valet de ferme ! ──────────────────────────────────────────
  it('On te tient (sans cible) : cherche Tirelire dans la pioche Fatalité → pendingFetchedHero', () => {
    const tirelire = card('hen-wen', 'hero', { strength: 1 })
    const base = game()
    let s = { ...base, players: [{ ...base.players[0], fateDeck: [tirelire], fateDiscard: [] }] }
    s = resolveEffects(s, [{ type: 'PIGKEEPER_RESOLVE', heroCardId: 'hen-wen', maxStrength: 1 }], { actorIndex: 0 })
    expect(s.pendingFetchedHero?.hero.cardId).toBe('hen-wen')
    expect(s.players[0].fateDeck.some((c) => c.cardId === 'hen-wen')).toBe(false)
    // Placement interactif sur le lieu choisi.
    s = applyAction(s, { type: 'RESOLVE_FETCHED_HERO', play: true, to: 'cachots' })
    expect((s.players[0].board['cachots'] ?? []).some((c) => c.cardId === 'hen-wen')).toBe(true)
  })

  it('On te tient (avec cible) : élimine un Héros de force 1 du royaume', () => {
    const faible = card('garde', 'hero', { instanceId: 'g1', strength: 1 })
    const base = game()
    let s = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, morva: [faible] } }] }
    s = resolveEffects(s, [{ type: 'PIGKEEPER_RESOLVE', heroCardId: 'hen-wen', maxStrength: 1 }], { actorIndex: 0, targetHeroId: 'g1' })
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'g1')).toBe(false)
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'g1')).toBe(true)
  })

  it('On te tient : non proposée par l’IA si Tirelire est en jeu et aucun Héros de force 1', () => {
    const pig = { ...card('we-got-you-pig-keeper', 'effect', { cost: 2, effects: [{ type: 'PIGKEEPER_RESOLVE', heroCardId: 'hen-wen', maxStrength: 1 }] }), instanceId: 'pig1' }
    const strong = card('costaud', 'hero', { strength: 5 })
    const base = game()
    // Tirelire EN JEU (pas dans deck/discard) + un Héros de force 5 (pas ≤1).
    // Héros placé sur un AUTRE lieu (cachots) pour ne pas recouvrir l'action « Jouer »
    // du lieu du pion (morva).
    const s = {
      ...base,
      phase: 'ACTION' as const,
      players: [{ ...base.players[0], power: 5, pawnLocation: 'morva', hand: [pig], fateDeck: [], fateDiscard: [], board: { ...base.players[0].board, cachots: [strong] } }],
    }
    const opts = enumerateActions(s)
    expect(opts.some((a) => a.type === 'PLAY_CARD' && a.instanceId === 'pig1')).toBe(false)
    // Avec un Héros de force 1, l'option « éliminer » réapparaît.
    const s2 = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, cachots: [card('faible', 'hero', { instanceId: 'f1', strength: 1 })] } }] }
    expect(enumerateActions(s2).some((a) => a.type === 'PLAY_CARD' && a.instanceId === 'pig1')).toBe(true)
  })

  it('Les Vouivres éliminent un Héros d’un lieu VOISIN (comme les Archers Loups)', () => {
    const heroV = card('garde', 'hero', { instanceId: 'h1', strength: 2 })
    const vouivres = card('gwythaints', 'ally', { instanceId: 'v1', strength: 2, reachesAdjacentVanquish: true })
    const base = game()
    // Pion à « Royaume du Petit Peuple » (a une action Éliminer) ; Vouivres sur « Cachots » (voisin).
    let s = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'royaume-petit-peuple',
        board: { ...base.players[0].board, 'royaume-petit-peuple': [heroV], cachots: [vouivres] },
      }],
    }
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['v1'] })
    expect((s.players[0].board['royaume-petit-peuple'] ?? []).some((c) => c.instanceId === 'h1')).toBe(false)
    expect((s.players[0].board['cachots'] ?? []).some((c) => c.instanceId === 'v1')).toBe(false)
  })

  it('Nous touchons du doigt la victoire : joue gratuitement un Objet de la main sur un lieu', () => {
    const squelettes = { ...card('ancient-soldiers', 'item', { cost: 3 }), instanceId: 'sq1' }
    let s = { ...game(), players: [{ ...game().players[0], hand: [squelettes] }] }
    s = resolveEffects(s, [{ type: 'GRANT_FREE_ITEM_PLAY' }], { actorIndex: 0 })
    expect(s.pendingFreeItemPlay).toEqual({ playerIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_FREE_ITEM_PLAY', instanceId: 'sq1', to: 'morva' })
    expect(s.pendingFreeItemPlay ?? null).toBeNull()
    expect((s.players[0].board['morva'] ?? []).some((c) => c.cardId === 'ancient-soldiers')).toBe(true)
    expect(s.players[0].hand.some((c) => c.instanceId === 'sq1')).toBe(false)
  })

  it('Retour à la vie de Gurki : dévoile 2 cartes Fatalité (pendingFate) à jouer sur le Seigneur', () => {
    const fate = [card('taran', 'hero', { strength: 3 }), card('gurgi', 'hero', { strength: 1 }), card('doli', 'hero', { strength: 2 })]
    let s = { ...game(), players: [{ ...game().players[0], fateDeck: fate, fateDiscard: [] }] }
    s = resolveEffects(s, [{ type: 'RESHUFFLE_FATE_REVEAL_PLAY_BOTH' }], { actorIndex: 0 })
    expect(s.pendingFate?.target).toBe(0)
    expect(s.pendingFate?.revealed).toHaveLength(2)
    expect(s.pendingFate?.revealed.every((c) => c.fatePlayBoth)).toBe(true)
  })

  it('Retour à la vie de Gurki : la carte n’est PAS mélangée, elle rejoint la défausse APRÈS le mélange', () => {
    const gurki = card('gurgis-happy-day', 'effect', { deck: 'fate', effects: [{ type: 'RESHUFFLE_FATE_REVEAL_PLAY_BOTH' }] })
    const otherRevealed = card('taran', 'hero', { strength: 3 })
    const inDiscard = card('doli', 'hero', { strength: 2 })
    const deck = [card('gurgi', 'hero', { strength: 1 }), card('eilonwy', 'hero', { strength: 2 })]
    let s = game()
    s = {
      ...s,
      players: [{ ...s.players[0], fateDeck: deck, fateDiscard: [inDiscard] }],
      pendingFate: { target: 0, revealed: [gurki, otherRevealed] },
      activePlayer: 0,
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: gurki.instanceId })
    const p = s.players[0]
    // Gurki rejoint la défausse, jamais la pioche ni les 2 cartes redévoilées.
    expect(p.fateDiscard.some((c) => c.cardId === 'gurgis-happy-day')).toBe(true)
    expect(p.fateDeck.some((c) => c.instanceId === gurki.instanceId)).toBe(false)
    expect((s.pendingFate?.revealed ?? []).some((c) => c.instanceId === gurki.instanceId)).toBe(false)
    // L'ancienne défausse (doli) a bien été remélangée dans la pioche (deck ou révélée).
    expect(p.fateDiscard.some((c) => c.instanceId === inDiscard.instanceId)).toBe(false)
    // L'autre carte révélée non jouée part en défausse.
    expect(p.fateDiscard.some((c) => c.instanceId === otherRevealed.instanceId)).toBe(true)
  })

  it('Retour à la vie de Gurki : non proposée par l’IA si la défausse Fatalité est vide', () => {
    const gurki = card('gurgis-happy-day', 'effect', { deck: 'fate', effects: [{ type: 'RESHUFFLE_FATE_REVEAL_PLAY_BOTH' }] })
    const other = card('taran', 'hero', { strength: 3 })
    const base = game()
    // Défausse vide → Gurki n'est pas une option (seul l'autre l'est).
    const sEmpty = { ...base, players: [{ ...base.players[0], fateDiscard: [] }], pendingFate: { target: 0, revealed: [gurki, other] }, activePlayer: 0 }
    const optsEmpty = enumerateActions(sEmpty)
    expect(optsEmpty.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === gurki.instanceId)).toBe(false)
    // Défausse non vide → Gurki redevient une option.
    const sFull = { ...base, players: [{ ...base.players[0], fateDiscard: [card('doli', 'hero', { strength: 2 })] }], pendingFate: { target: 0, revealed: [gurki, other] }, activePlayer: 0 }
    const optsFull = enumerateActions(sFull)
    expect(optsFull.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === gurki.instanceId)).toBe(true)
  })
})
