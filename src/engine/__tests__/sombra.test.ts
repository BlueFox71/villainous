import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { getAvailableActions, movableCards, effectiveCost, canFate } from '../rules'
import { createInitialGame } from '../state'
import { sombra } from '../../data/villains/sombra'
import { sombraCards } from '../../data/villains/sombra.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  const g = createInitialGame(
    [
      { villain: sombra, deckCards: buildDeckInstances(sombraCards, 'villain', 'p0:'), fateCards: buildDeckInstances(sombraCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    7,
  )
  return { ...g, activePlayer: 0 }
}

const piratage = (id: string, hackedActionId?: string): CardInstance => ({
  instanceId: id, cardId: 'piratage', name: 'Piratage', type: 'item', cost: 1, isPiratage: true, hackDisablesAction: true, hackedActionId,
})
const iem = (id: string): CardInstance => ({ instanceId: id, cardId: 'iem', name: 'IEM', type: 'item', cost: 3, isPiratage: true })
const item = (id: string, cardId: string): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'item', cost: 1 })

/** Remplace le plateau du joueur 0 (Sombra) + champs optionnels. */
function withBoard(base: GameState, board: Record<string, CardInstance[]>, extra: Partial<GameState['players'][number]> = {}): GameState {
  return {
    ...base,
    players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, ...board }, ...extra } : p)),
  }
}

describe('Sombra — Piratage (hack d’une action)', () => {
  it('une action piratée est retirée des actions disponibles', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { castillo: [piratage('pi', 'gain-power')] },
      { pawnLocation: 'castillo' },
    )
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).not.toContain('gain-power') // désactivée par le Hack
    expect(ids).toContain('play-card-top') // les autres restent jouables
    expect(ids).toContain('discard')
  })

  it('une carte de Piratage ne peut pas être déplacée', () => {
    const s = withBoard({ ...game(), phase: 'ACTION' }, { castillo: [piratage('pi', 'discard'), item('o', 'jeux-de-piste')] }, { pawnLocation: 'castillo' })
    const movable = movableCards(s).map((m) => m.instanceId)
    expect(movable).not.toContain('pi') // Piratage non déplaçable
    expect(movable).toContain('o') // un Objet normal reste déplaçable
  })

  it('jouer un Piratage ouvre le choix de l’action à désactiver, puis la désactive', () => {
    const base = game()
    const pir = piratage('pi')
    delete (pir as { hackedActionId?: string }).hackedActionId
    const s: GameState = {
      ...withBoard({ ...base, phase: 'ACTION', activePlayer: 0 }, {}, { hand: [pir], power: 5, pawnLocation: 'castillo' }),
    }
    const opened = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'pi', to: 'castillo' })
    expect(opened.pendingHack?.locationId).toBe('castillo')
    expect(opened.pendingHack?.actionIds).toContain('gain-power')
    expect((opened.pendingHack?.actionIds.length ?? 0)).toBeGreaterThan(0)
    const done = applyAction(opened, { type: 'RESOLVE_HACK', actionId: 'gain-power' })
    expect(done.pendingHack ?? null).toBeNull()
    const placed = (done.players[0].board['castillo'] ?? []).find((c) => c.instanceId === 'pi')
    expect(placed?.hackedActionId).toBe('gain-power')
  })

  it('un IEM pirate le lieu sans ouvrir de choix de désactivation', () => {
    const s: GameState = withBoard({ ...game(), phase: 'ACTION', activePlayer: 0 }, {}, { hand: [iem('ie')], power: 5, pawnLocation: 'castillo' })
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'ie', to: 'castillo' })
    expect(after.pendingHack ?? null).toBeNull()
    expect((after.players[0].board['castillo'] ?? []).some((c) => c.cardId === 'iem')).toBe(true)
  })
})

describe('Sombra — Piratage/IEM ≠ Objet pour SES propres cartes (pas pour l’adversaire)', () => {
  it('Zarya (excludePiratage) détruit un VRAI Objet, jamais un Piratage', () => {
    const s0 = withBoard(game(), { castillo: [piratage('pi'), item('o', 'arme-uzi')] })
    const s = resolveEffect(s0, { type: 'DISCARD_ITEM_AT_HOST', excludePiratage: true }, { actorIndex: 0, hostLocationId: 'castillo' })
    const cell = s.players[0].board['castillo'] ?? []
    expect(cell.some((c) => c.instanceId === 'pi')).toBe(true) // Piratage intact
    expect(cell.some((c) => c.instanceId === 'o')).toBe(false) // Objet détruit
  })

  it('Zarya : avec seulement des Piratages/IEM, aucun Objet à détruire', () => {
    const s0 = withBoard(game(), { castillo: [piratage('pi'), iem('e')] })
    const s = resolveEffect(s0, { type: 'DISCARD_ITEM_AT_HOST', excludePiratage: true }, { actorIndex: 0, hostLocationId: 'castillo' })
    expect((s.players[0].board['castillo'] ?? []).length).toBe(2) // rien retiré
  })

  it('Glitch (REVEAL_UNTIL_TYPE excludePiratage) : « Objet » saute les Piratages/IEM', () => {
    const base = game()
    const obj = item('o', 'arme-uzi')
    const s0: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 0 ? { ...p, deck: [piratage('pi'), iem('e'), obj], discard: [], hand: [] } : p)),
    }
    let s = resolveEffect(s0, { type: 'REVEAL_UNTIL_TYPE', types: ['item', 'effect'], excludePiratage: true }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_TYPE_CHOICE', cardType: 'item' })
    expect(s.players[0].hand.some((c) => c.instanceId === 'o')).toBe(true) // vrai Objet trouvé
    expect(s.players[0].hand.some((c) => c.isPiratage)).toBe(false) // ni Piratage ni IEM en main
  })
})

describe('Sombra — objectif & Protocole Sombra', () => {
  it('Protocole Sombra avec TOUS les lieux piratés = victoire', () => {
    const s = withBoard(game(), {
      castillo: [piratage('p1', 'discard')],
      'los-muertos': [piratage('p2', 'fate')],
      dorado: [iem('p3')],
      lumerico: [piratage('p4', 'gain-power')],
    })
    const after = resolveEffect(s, { type: 'SOMBRA_PROTOCOL' }, { actorIndex: 0 })
    expect(after.status).toBe('WON')
    expect(after.winner).toBe(0)
  })

  it('Protocole Sombra sans tous les lieux piratés : détruit les Piratages, pas de victoire', () => {
    const s = withBoard(game(), {
      castillo: [piratage('p1', 'discard')],
      'los-muertos': [piratage('p2', 'fate')],
    })
    const after = resolveEffect(s, { type: 'SOMBRA_PROTOCOL' }, { actorIndex: 0 })
    expect(after.status).toBe('PLAYING')
    // Les Piratages sont détruits (défausse Vilain) et retirés du plateau.
    expect((after.players[0].board['castillo'] ?? []).some((c) => c.isPiratage)).toBe(false)
    expect(after.players[0].discard.filter((c) => c.isPiratage)).toHaveLength(2)
  })
})

describe('Sombra — Phase 3 (effets)', () => {
  it('Lynx Seventeen (Fatalité) : un Piratage coûte 1 de plus', () => {
    const base = game()
    const pir: CardInstance = piratage('pi')
    // Sans Lynx : coût de base 1.
    expect(effectiveCost({ ...base, activePlayer: 0 }, pir)).toBe(1)
    // Avec Lynx dans le royaume : +1.
    const s = withBoard({ ...base, activePlayer: 0 }, { castillo: [{ instanceId: 'lx', cardId: 'lynx-seventeen', name: 'Lynx', type: 'hero', strength: 3 }] })
    expect(effectiveCost(s, pir)).toBe(2)
  })

  it('L’Œil empêche de poser un Piratage sur son lieu', () => {
    const s: GameState = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { castillo: [{ instanceId: 'oe', cardId: 'l-oeil', name: 'L’Œil', type: 'hero', strength: 6 }] },
      { hand: [piratage('pi')], power: 5, pawnLocation: 'castillo' },
    )
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'pi', to: 'castillo' })).toThrow()
  })

  it('Boop ! pirate un Héros (capacité annulée) ; Lynx piraté ne surtaxe plus les Piratages', () => {
    const base = game()
    const lynx: CardInstance = { instanceId: 'lx', cardId: 'lynx-seventeen', name: 'Lynx', type: 'hero', strength: 3 }
    const s = withBoard({ ...base, activePlayer: 0 }, { castillo: [lynx] })
    // Lynx actif : Piratage coûte 2.
    expect(effectiveCost(s, piratage('pi'))).toBe(2)
    // Boop pirate Lynx → capacité annulée.
    const after = resolveEffect(s, { type: 'HACK_HERO' }, { actorIndex: 0, targetHeroId: 'lx' })
    const hacked = (after.players[0].board['castillo'] ?? []).find((c) => c.instanceId === 'lx')
    expect(hacked?.abilityHacked).toBe(true)
    // Piratage redevient à 1 (surtaxe Lynx ignorée).
    expect(effectiveCost(after, piratage('pi'))).toBe(1)
  })

  it('Boop ! : injouable s’il n’y a aucun Héros en jeu', () => {
    const boop: CardInstance = { instanceId: 'bp', cardId: 'boop', name: 'Boop', type: 'effect', cost: 2, effects: [{ type: 'HACK_HERO' }] }
    const s = withBoard({ ...game(), phase: 'ACTION', activePlayer: 0 }, {}, { hand: [boop], power: 5, pawnLocation: 'castillo' })
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'bp' })).toThrow(/Héros à pirater/)
  })

  it('Boop ! : injouable si le seul Héros est déjà piraté', () => {
    const boop: CardInstance = { instanceId: 'bp', cardId: 'boop', name: 'Boop', type: 'effect', cost: 2, effects: [{ type: 'HACK_HERO' }] }
    const hacked: CardInstance = { instanceId: 'h', cardId: 'soldat-76', name: 'Soldat', type: 'hero', strength: 4, abilityHacked: true }
    const s = withBoard({ ...game(), phase: 'ACTION', activePlayer: 0 }, { castillo: [hacked] }, { hand: [boop], power: 5, pawnLocation: 'castillo' })
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'bp', targetHeroId: 'h' })).toThrow()
  })

  it('Boop ! : sans effet (no-op) sur un Héros déjà piraté', () => {
    const hacked: CardInstance = { instanceId: 'h', cardId: 'soldat-76', name: 'Soldat', type: 'hero', strength: 4, abilityHacked: true }
    const s = withBoard({ ...game(), activePlayer: 0 }, { castillo: [hacked] })
    const after = resolveEffect(s, { type: 'HACK_HERO' }, { actorIndex: 0, targetHeroId: 'h' })
    expect((after.players[0].board['castillo'] ?? []).find((c) => c.instanceId === 'h')?.abilityHacked).toBe(true)
  })

  it('Boop ! est sans effet sur Katya Volskaya (ne peut pas être piratée)', () => {
    const base = game()
    const katya: CardInstance = { instanceId: 'ka', cardId: 'katya-volskaya', name: 'Katya', type: 'hero', strength: 2 }
    const s = withBoard({ ...base, activePlayer: 0 }, { castillo: [katya] })
    const after = resolveEffect(s, { type: 'HACK_HERO' }, { actorIndex: 0, targetHeroId: 'ka' })
    expect((after.players[0].board['castillo'] ?? []).find((c) => c.instanceId === 'ka')?.abilityHacked).toBeUndefined()
  })

  it('Membres de Los Muertos : Activer cherche Arme Uzi dans la pioche → main', () => {
    const base = game()
    const uzi: CardInstance = { instanceId: 'uz', cardId: 'arme-uzi', name: 'Arme Uzi', type: 'item', cost: 1 }
    const membres: CardInstance = { instanceId: 'mb', cardId: 'membres-los-muertos', name: 'Membres', type: 'ally', strength: 3, cost: 2, activatedCost: 0 }
    const s: GameState = {
      ...withBoard({ ...base, phase: 'ACTION', activePlayer: 0 }, { castillo: [membres] }, { pawnLocation: 'castillo' }),
      players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, castillo: [membres] }, deck: [uzi, ...p.deck], pawnLocation: 'castillo' } : p)),
    }
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'mb' })
    expect(after.players[0].hand.some((c) => c.cardId === 'arme-uzi')).toBe(true)
  })
})

describe('Sombra — effets divers', () => {
  it('Skycode : 1 Pouvoir par lieu piraté', () => {
    const s = withBoard(game(), {
      castillo: [piratage('p1', 'discard')],
      dorado: [iem('p2')],
    }, { power: 0 })
    const after = resolveEffect(s, { type: 'GAIN_POWER_PER_HACK' }, { actorIndex: 0 })
    expect(after.players[0].power).toBe(2) // 2 lieux piratés
  })

  it('Vol de données : Sombra perd 1 Pouvoir par Piratage/IEM', () => {
    const s = withBoard(game(), {
      castillo: [piratage('p1', 'discard')],
      'los-muertos': [piratage('p2', 'fate')],
      dorado: [iem('p3')],
    }, { power: 5 })
    const after = resolveEffect(s, { type: 'LOSE_POWER_PER_PIRATAGE' }, { actorIndex: 0 })
    expect(after.players[0].power).toBe(2) // 5 − 3
  })

  it('Faille déverrouille Lumérico', () => {
    const s = withBoard(game(), {}, { lockedLocations: ['lumerico'] })
    const after = resolveEffect(s, { type: 'UNLOCK_LOCATION', locationId: 'lumerico' }, { actorIndex: 0 })
    expect(after.players[0].lockedLocations ?? []).not.toContain('lumerico')
  })

  it('Faille : le prochain Piratage est gratuit (freePiratage → coût 0)', () => {
    const s = withBoard(game(), {}, { freePiratage: true })
    expect(effectiveCost({ ...s, activePlayer: 0 }, piratage('pi'))).toBe(0)
  })

  it('Invisibilité : la cible immunisée ne peut pas être fatalisée (canFate = false)', () => {
    const base = game()
    // Sombra (0) est invisible ; c'est le tour de l'adversaire (1) qui voudrait fataliser.
    const s: GameState = { ...withBoard(base, {}, { noFate: true }), activePlayer: 1, phase: 'ACTION' }
    expect(canFate(s)).toBe(false)
  })

  it('Information : pioche 3 puis ouvre le CHOIX (garder/défausser la pioche)', () => {
    const base = game()
    const hand0 = base.players[0].hand.length
    // `orDiscardDrawn` : propre à Information (seule carte à offrir l'alternative). Sans lui,
    // on enchaîne directement sur la défausse — cf. le test « Bataille d'esprits ».
    const drawn = resolveEffect({ ...base, activePlayer: 0 }, { type: 'DRAW_THEN_DISCARD', draw: 3, discard: 2, orDiscardDrawn: true }, { actorIndex: 0 })
    expect(drawn.players[0].hand.length).toBe(hand0 + 3)
    expect(drawn.pendingInformation?.drawnIds.length).toBe(3)
    expect(drawn.pendingInformation?.discardCount).toBe(2)

    // Option A : garder la pioche → ouvre la défausse de 2 (pendingTyrannyDiscard).
    const keep = applyAction({ ...drawn, phase: 'ACTION', activePlayer: 0 }, { type: 'RESOLVE_INFORMATION', discardDrawn: false })
    expect(keep.pendingInformation ?? null).toBeNull()
    expect(keep.pendingTyrannyDiscard?.count).toBe(2)

    // Option B : défausser les 3 cartes piochées → main revient à son état initial.
    const dump = applyAction({ ...drawn, phase: 'ACTION', activePlayer: 0 }, { type: 'RESOLVE_INFORMATION', discardDrawn: true })
    expect(dump.pendingInformation ?? null).toBeNull()
    expect(dump.players[0].hand.length).toBe(hand0)
    const drawnIds = drawn.pendingInformation!.drawnIds
    expect(dump.players[0].discard.filter((c) => drawnIds.includes(c.instanceId))).toHaveLength(3)
  })

  it('Transducteur : Activer déplace le pion sur le Transducteur et rafraîchit les actions', () => {
    const transd: CardInstance = { instanceId: 'tr', cardId: 'transducteur', name: 'Transducteur', type: 'item', cost: 1, activatedCost: 1 }
    // Pion à Castillo ; Transducteur à Dorado. On a déjà « utilisé » gain-power.
    const s: GameState = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0, usedActionIds: ['gain-power'] },
      { dorado: [transd] },
      { power: 5, pawnLocation: 'castillo' },
    )
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'tr' })
    expect(after.players[0].pawnLocation).toBe('dorado') // déplacé sur le Transducteur
    expect(after.players[0].power).toBe(4) // −1
    const ids = getAvailableActions(after).map((a) => a.id)
    expect(ids).toContain('gain-power') // actions du nouveau lieu fraîches
    expect(ids).not.toContain('fate') // Fatalité bloquée (Dorado n'en a pas, mais principe)
  })

  it('Pas si vite : en réaction, Sombra choisit la carte Fatalité jouée', () => {
    const base = game()
    const c1 = { instanceId: 'f1', cardId: 'soldat-76', name: 'Soldat 76', type: 'hero' as const, strength: 4 }
    const c2 = { instanceId: 'f2', cardId: 'lynx-seventeen', name: 'Lynx', type: 'hero' as const, strength: 3 }
    const psv: CardInstance = { instanceId: 'pv', cardId: 'pas-si-vite', name: 'Pas si vite', type: 'condition', cost: 0, trigger: { type: 'opponent-fate-targeted-me' } }
    const s: GameState = {
      ...base,
      activePlayer: 1,
      phase: 'ACTION',
      activeFateTargets: [0],
      pendingFate: { target: 0, revealed: [c1, c2] },
      players: base.players.map((p, i) => (i === 0 ? { ...p, hand: [psv] } : p)),
    }
    const reacted = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'pv' })
    // Le choix est ouvert pour Sombra (pendingScry pasSiVite) ; pendingFate vidé en attendant.
    expect(reacted.pendingScry?.pasSiVite).toBe(true)
    expect(reacted.pendingScry?.cards.map((c) => c.instanceId).sort()).toEqual(['f1', 'f2'])
    // Sombra choisit Lynx (f2) comme carte jouée ; Soldat 76 est défaussé.
    const done = applyAction(reacted, { type: 'RESOLVE_SCRY', topInstanceIds: ['f2'] })
    expect(done.pendingFate?.revealed.map((c) => c.instanceId)).toEqual(['f2'])
    expect(done.players[0].fateDiscard.some((c) => c.instanceId === 'f1')).toBe(true)
  })

  it('Shutdown : un lieu gelé ne peut pas être piraté', () => {
    const shutdown: CardInstance = { instanceId: 'sd', cardId: 'shutdown', name: 'Shutdown', type: 'effect', fromFate: true }
    const s: GameState = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { castillo: [shutdown] },
      { hand: [piratage('pi')], power: 5, pawnLocation: 'castillo' },
    )
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'pi', to: 'castillo' })).toThrow()
  })
})
