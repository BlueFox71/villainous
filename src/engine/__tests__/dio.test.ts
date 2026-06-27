import { describe, it, expect } from 'vitest'
import { createInitialGame, handLimitFor, dioPowerFactor } from '../state'
import { resolveEffect, performVanquish } from '../effects'
import { applyAction } from '../actions'
import { effectiveStrength, effectiveCost } from '../rules'
import { dio } from '../../data/villains/dio'
import { dioCards } from '../../data/villains/dio.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../types'

describe('Dio Brando — mise en place', () => {
  function game() {
    return createInitialGame(
      [
        {
          villain: dio,
          deckCards: buildDeckInstances(dioCards, 'villain', 'p0:'),
          fateCards: buildDeckInstances(dioCards, 'fate', 'p0f:'),
        },
      ],
      42,
    )
  }

  it('sépare les 7 Stands dans standPile (hors des deux pioches)', () => {
    const s = game()
    const dioP = s.players[0]
    expect(dioP.standPile).toHaveLength(7)
    // Aucun Stand ne reste dans une pioche.
    expect([...dioP.deck, ...dioP.fateDeck].some((c) => c.isStand)).toBe(false)
    // The World, lui, reste bien dans le deck Méchant (il n'a pas isStand).
    expect(dioP.deck.some((c) => c.cardId === 'the-world')).toBe(true)
  })

  it('deck Méchant = 30 − main initiale, deck Fatalité = 15', () => {
    const s = game()
    const dioP = s.players[0]
    // Main initiale de 4 cartes tirée du deck Méchant (30 − 4 = 26).
    expect(dioP.deck.length + dioP.hand.length).toBe(30)
    expect(dioP.fateDeck).toHaveLength(15)
    expect(dioP.removedFromGame).toEqual([])
  })

  /** Place une carte (Héros) sur un lieu du joueur 0 et renvoie le nouvel état. */
  function withCardOnBoard(s: GameState, loc: string, card: CardInstance): GameState {
    const players = s.players.map((p, i) =>
      i !== 0 ? p : { ...p, board: { ...p.board, [loc]: [...(p.board[loc] ?? []), card] } },
    )
    return { ...s, players, activePlayer: 0 }
  }

  it('FETCH_STAND_ATTACH : Star Platinum sort de standPile et renforce Jotaro (1 → 10)', () => {
    const s0 = game()
    const jotaro = s0.players[0].fateDeck.find((c) => c.cardId === 'jotaro-kujo')!
    const s1 = withCardOnBoard(s0, 'manoir', jotaro)
    const s2 = resolveEffect(s1, { type: 'FETCH_STAND_ATTACH', standCardId: 'star-platinum' }, {
      actorIndex: 0,
      hostInstanceId: jotaro.instanceId,
      hostLocationId: 'manoir',
    })
    const dioP = s2.players[0]
    expect(dioP.standPile!.some((c) => c.cardId === 'star-platinum')).toBe(false)
    const stand = (dioP.board['manoir'] ?? []).find((c) => c.cardId === 'star-platinum')
    expect(stand?.attachedTo).toBe(jotaro.instanceId)
    expect(effectiveStrength(s2, 0, jotaro.instanceId)).toBe(10) // 1 + 9
  })

  it('aura Hierophant Green : les cartes de Dio coûtent +1', () => {
    const s0 = game()
    const hiero = s0.players[0].standPile!.find((c) => c.cardId === 'hierophant-green')!
    const host = s0.players[0].fateDeck.find((c) => c.cardId === 'noriaki-kakyoin')!
    const s1 = withCardOnBoard(withCardOnBoard(s0, 'manoir', host), 'manoir', {
      ...hiero,
      attachedTo: host.instanceId,
    })
    const za = dioCards.find((c) => c.id === 'za-warudo')!
    const card: CardInstance = { instanceId: 'za#1', cardId: 'za-warudo', name: za.name, type: 'effect', cost: 1 }
    expect(effectiveCost(s1, card)).toBe(2) // 1 + 1 (Hierophant)
  })

  it('aura Magician Red : limite de main de Dio = 3', () => {
    const s0 = game()
    const magician = s0.players[0].standPile!.find((c) => c.cardId === 'magician-red')!
    const host = s0.players[0].fateDeck.find((c) => c.cardId === 'mohammed-abdul')!
    const s1 = withCardOnBoard(withCardOnBoard(s0, 'tokyo', host), 'tokyo', {
      ...magician,
      attachedTo: host.instanceId,
    })
    expect(handLimitFor(s1.players[0])).toBe(3)
  })

  it('The World : double les gains de Pouvoir une fois Jotaro + Joseph retirés', () => {
    const s0 = game()
    const world = s0.players[0].deck.concat(s0.players[0].hand).find((c) => c.cardId === 'the-world')!
    // The World en jeu + les deux Joestar retirés → facteur 2.
    let s1 = withCardOnBoard(s0, 'tokyo', world)
    s1 = {
      ...s1,
      players: s1.players.map((p, i) =>
        i !== 0 ? p : { ...p, removedFromGame: ['jotaro-kujo', 'joseph-joestar'] },
      ),
    }
    expect(dioPowerFactor(s1.players[0])).toBe(2)
    const before = s1.players[0].power
    const s2 = resolveEffect(s1, { type: 'GAIN_POWER', amount: 3 }, { actorIndex: 0 })
    expect(s2.players[0].power - before).toBe(6) // 3 × 2
  })

  it('The World : pas de doublement tant qu’un seul Joestar est retiré', () => {
    const s0 = game()
    const world = s0.players[0].deck.concat(s0.players[0].hand).find((c) => c.cardId === 'the-world')!
    let s1 = withCardOnBoard(s0, 'tokyo', world)
    s1 = {
      ...s1,
      players: s1.players.map((p, i) => (i !== 0 ? p : { ...p, removedFromGame: ['jotaro-kujo'] })),
    }
    expect(dioPowerFactor(s1.players[0])).toBe(1)
  })

  it('Vanquish de Jotaro : retiré du jeu (pas en défausse), Star Platinum revient en réserve', () => {
    const s0 = game()
    const jotaro = s0.players[0].fateDeck.find((c) => c.cardId === 'jotaro-kujo')!
    const star = s0.players[0].standPile!.find((c) => c.cardId === 'star-platinum')!
    const bigAlly = {
      instanceId: 'ally-strong',
      cardId: 'legion-de-vampire',
      name: 'Légion de vampires',
      type: 'ally' as const,
      strength: 10,
    }
    // Jotaro (1) + Star Platinum (+9) = force 10 ; un Allié force 10 suffit à le vaincre.
    let s1 = withCardOnBoard(s0, 'tokyo', jotaro)
    s1 = withCardOnBoard(s1, 'tokyo', { ...star, attachedTo: jotaro.instanceId })
    s1 = withCardOnBoard(s1, 'tokyo', bigAlly)
    s1 = { ...s1, players: s1.players.map((p, i) => (i !== 0 ? p : { ...p, pawnLocation: 'tokyo' })) }

    const s2 = performVanquish(s1, jotaro.instanceId, [bigAlly.instanceId], false)
    const dioP = s2.players[0]
    const board = Object.values(dioP.board).flat()
    expect(board.some((c) => c.cardId === 'jotaro-kujo')).toBe(false)
    expect(dioP.fateDiscard.some((c) => c.cardId === 'jotaro-kujo')).toBe(false)
    expect(dioP.removedFromGame).toContain('jotaro-kujo')
    // Star Platinum n'est pas défaussé : il retourne dans standPile.
    expect(board.some((c) => c.cardId === 'star-platinum')).toBe(false)
    expect(dioP.standPile!.some((c) => c.cardId === 'star-platinum')).toBe(true)
  })

  it('The World : indéfaussable, RESTE en jeu après avoir servi à un Vanquish', () => {
    const s0 = game()
    const world = s0.players[0].deck.find((c) => c.cardId === 'the-world')!
    const hero: CardInstance = {
      instanceId: 'hero#1', cardId: 'jotaro-kujo', name: 'Jotaro', type: 'hero', strength: 5,
    }
    let s1 = withCardOnBoard(s0, 'tokyo', hero)
    s1 = withCardOnBoard(s1, 'tokyo', { ...world, strength: 9 })
    s1 = { ...s1, players: s1.players.map((p, i) => (i !== 0 ? p : { ...p, pawnLocation: 'tokyo' })) }

    const s2 = performVanquish(s1, hero.instanceId, [world.instanceId], false)
    const dioP = s2.players[0]
    const board = Object.values(dioP.board).flat()
    // The World a vaincu le Héros mais reste sur le plateau (jamais défaussé).
    expect(board.some((c) => c.cardId === 'the-world')).toBe(true)
    expect(dioP.discard.some((c) => c.cardId === 'the-world')).toBe(false)
    expect(dioP.standPile?.some((c) => c.cardId === 'the-world')).toBeFalsy()
  })

  // ---- ZA WARUDO! + victoire -----------------------------------------------
  const theWorld = (): CardInstance => ({
    instanceId: 'tw#1', cardId: 'the-world', name: 'The World', type: 'ally', strength: 9, followsPawn: true,
  })
  const starPlat = (): CardInstance => ({
    instanceId: 'sp#1', cardId: 'star-platinum', name: 'Star Platinum', type: 'item', isStand: true,
  })

  it('ZA WARUDO! : sans The World → échoue ; avec Star Platinum → contré ; sinon actif', () => {
    const s0 = game()
    // Sans The World → pas d'activation.
    expect(resolveEffect(s0, { type: 'ZA_WARUDO_ACTIVATE' }, { actorIndex: 0 }).players[0].zaWarudoActive).toBeFalsy()
    // The World + Star Platinum → contré.
    const sBlocked = withCardOnBoard(withCardOnBoard(s0, 'manoir', theWorld()), 'manoir', starPlat())
    expect(resolveEffect(sBlocked, { type: 'ZA_WARUDO_ACTIVATE' }, { actorIndex: 0 }).players[0].zaWarudoActive).toBeFalsy()
    // The World seul → actif.
    const sOk = withCardOnBoard(s0, 'manoir', theWorld())
    expect(resolveEffect(sOk, { type: 'ZA_WARUDO_ACTIVATE' }, { actorIndex: 0 }).players[0].zaWarudoActive).toBe(true)
  })

  /** Met le joueur 0 en phase ACTION sur `loc`, avec patch du PlayerState. */
  function actionPhase(s: GameState, loc: string, patch: Partial<PlayerState>): GameState {
    return {
      ...s,
      phase: 'ACTION',
      activePlayer: 0,
      usedActionIds: [],
      players: s.players.map((p, i) => (i !== 0 ? p : { ...p, pawnLocation: loc, ...patch })),
    }
  }

  it('ZA WARUDO! : chaque action coûte un Pouvoir croissant et est comptée', () => {
    const s0 = game()
    const s1 = actionPhase(s0, 'le-caire', { zaWarudoActive: true, zaWarudoActionsDone: 0, power: 50 })
    // Gagner 3 au Caire, puis le coût croissant (−1) est prélevé : 50 + 3 − 1 = 52.
    const s2 = applyAction(s1, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s2.players[0].power).toBe(52)
    expect(s2.players[0].zaWarudoActionsDone).toBe(1)
    expect(s2.players[0].dioRealmActionsThisTurn).toContain('le-caire:gain-power')
  })

  it('ZA WARUDO! : la 14ᵉ action hors-Fatalité du tour, Joestar éliminés → VICTOIRE', () => {
    const s0 = game()
    const allKeys = dio.locations.flatMap((l) =>
      l.actions.filter((a) => a.type !== 'FATE').map((a) => `${l.id}:${a.id}`),
    )
    expect(allKeys).toHaveLength(14)
    // 13 des 14 déjà faites ; il manque « manoir:gain-power » qu'on va effectuer.
    const already = allKeys.filter((k) => k !== 'manoir:gain-power')
    const s1 = actionPhase(s0, 'manoir', {
      zaWarudoActive: true,
      zaWarudoActionsDone: 13,
      power: 50,
      removedFromGame: ['jotaro-kujo', 'joseph-joestar'],
      dioRealmActionsThisTurn: already,
    })
    const s2 = applyAction(s1, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s2.status).toBe('WON')
    expect(s2.winner).toBe(0)
  })

  it('ZA WARUDO! : balayage complet mais un Joestar encore en jeu → pas de victoire', () => {
    const s0 = game()
    const allKeys = dio.locations.flatMap((l) =>
      l.actions.filter((a) => a.type !== 'FATE').map((a) => `${l.id}:${a.id}`),
    )
    const already = allKeys.filter((k) => k !== 'manoir:gain-power')
    const s1 = actionPhase(s0, 'manoir', {
      zaWarudoActive: true,
      zaWarudoActionsDone: 13,
      power: 50,
      removedFromGame: ['jotaro-kujo'], // Joseph encore en jeu
      dioRealmActionsThisTurn: already,
    })
    const s2 = applyAction(s1, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s2.status).toBe('PLAYING')
    expect(s2.players[0].dioRealmSweepDone).toBe(true) // balayage fait, mais Joestar manquant
  })

  // ---- Phase 5 : reste des cartes -----------------------------------------
  it('Vampirisme : défausse un Allié et gagne 4 Pouvoir', () => {
    const s0 = game()
    const ally: CardInstance = { instanceId: 'a#1', cardId: 'legion-de-vampire', name: 'Légion', type: 'ally', strength: 3 }
    const s1 = { ...withCardOnBoard(s0, 'manoir', ally), activePlayer: 0 }
    const before = s1.players[0].power
    const s2 = resolveEffect(s1, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    expect(Object.values(s2.players[0].board).flat().some((c) => c.instanceId === 'a#1')).toBe(false)
    expect(s2.players[0].discard.some((c) => c.cardId === 'legion-de-vampire')).toBe(true)
    expect(s2.players[0].power).toBe(before + 4)
  })

  it('Masque de pierre : défausse la main et gagne 1 par carte', () => {
    const s0 = game()
    const handSize = s0.players[0].hand.length
    const before = s0.players[0].power
    const s2 = resolveEffect(s0, { type: 'DIO_DISCARD_HAND_GAIN_POWER' }, { actorIndex: 0 })
    expect(s2.players[0].hand).toHaveLength(0)
    expect(s2.players[0].power).toBe(before + handSize)
  })

  it('Tu oses t’approcher : joue les Héros révélés sur le lieu du pion (Stand inclus)', () => {
    const s0 = game()
    const jotaro = s0.players[0].fateDeck.find((c) => c.cardId === 'jotaro-kujo')!
    const others = s0.players[0].fateDeck.filter((c) => c.cardId !== 'jotaro-kujo')
    // Jotaro en tête de pioche Fatalité, pion au Manoir.
    const s1 = {
      ...s0,
      activePlayer: 0,
      players: s0.players.map((p, i) => (i !== 0 ? p : { ...p, pawnLocation: 'manoir', fateDeck: [jotaro, ...others] })),
    }
    const s2 = resolveEffect(s1, { type: 'DIO_REVEAL_FATE_HEROES_AT_PAWN', count: 4 }, { actorIndex: 0 })
    const manoir = s2.players[0].board['manoir'] ?? []
    expect(manoir.some((c) => c.cardId === 'jotaro-kujo')).toBe(true)
    // Son onPlace a invoqué Star Platinum (associé).
    expect(manoir.some((c) => c.cardId === 'star-platinum' && c.attachedTo === jotaro.instanceId)).toBe(true)
  })

  it('MUDA! : élimine le Héros du lieu du pion et gagne 5 Pouvoir', () => {
    const s0 = game()
    const hero: CardInstance = { instanceId: 'h#1', cardId: 'jean-pierre-polnareff', name: 'Polnareff', type: 'hero', strength: 1 }
    let s1 = withCardOnBoard(s0, 'manoir', hero)
    s1 = { ...s1, activePlayer: 0, players: s1.players.map((p, i) => (i !== 0 ? p : { ...p, pawnLocation: 'manoir' })) }
    const before = s1.players[0].power
    const s2 = resolveEffect(s1, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    expect(Object.values(s2.players[0].board).flat().some((c) => c.instanceId === 'h#1')).toBe(false)
    expect(s2.players[0].power).toBe(before + 5)
  })

  it('La flèche : pioche 4 via « Activer une capacité » (rien à la pose)', () => {
    const s0 = game()
    const fleche: CardInstance = {
      instanceId: 'f#1',
      cardId: 'la-fleche',
      name: 'La flèche',
      type: 'item',
      cost: 1,
      activatedCost: 0,
      activatedEffects: [{ type: 'DRAW_CARDS', count: 4 }],
    }
    let s1 = withCardOnBoard(s0, 'manoir', fleche)
    s1 = {
      ...s1,
      phase: 'ACTION',
      activePlayer: 0,
      usedActionIds: [],
      players: s1.players.map((p, i) => (i !== 0 ? p : { ...p, pawnLocation: 'manoir' })),
    }
    const before = s1.players[0].hand.length
    const s2 = applyAction(s1, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'f#1' })
    expect(s2.players[0].hand.length).toBe(before + 4)
    // La flèche reste en jeu (elle n'est pas défaussée par l'activation).
    expect(Object.values(s2.players[0].board).flat().some((c) => c.cardId === 'la-fleche')).toBe(true)
  })

  it('La flèche / Masque / Justice : effet en activatedEffects, pas en effects (pas de double-déclenchement à la pose)', () => {
    for (const id of ['la-fleche', 'masque-de-pierre', 'justice']) {
      const def = dioCards.find((c) => c.id === id)!
      expect(def.effects, `${id} ne doit pas avoir d'effects (sinon il se déclenche à la pose)`).toBeUndefined()
      expect(def.activatedEffects?.length, `${id} doit avoir des activatedEffects`).toBeGreaterThan(0)
      expect(def.activatedCost).toBeDefined()
    }
  })

  it('Lumière du Soleil : perd 10 Pouvoir s’il peut (garde sa main)', () => {
    const s0 = game()
    const s1 = { ...s0, players: s0.players.map((p, i) => (i !== 0 ? p : { ...p, power: 12 })) }
    const handSize = s1.players[0].hand.length
    const s2 = resolveEffect(s1, { type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }, { actorIndex: 0 })
    expect(s2.players[0].power).toBe(2)
    expect(s2.players[0].hand).toHaveLength(handSize) // main conservée
  })
})
