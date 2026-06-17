import { describe, it, expect } from 'vitest'
import { performVanquish, resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { hasReachedObjective, effectiveCost } from '../rules'
import { syncRatiganObjective } from '../state'
import { ratigan } from '../../data/villains/ratigan'
import { ratiganCards } from '../../data/villains/ratigan.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  const g = createInitialGame(
    [
      { villain: ratigan, deckCards: buildDeckInstances(ratiganCards, 'villain', 'p0:'), fateCards: buildDeckInstances(ratiganCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    9,
  )
  return { ...g, activePlayer: 0 }
}

const item = (id: string, cardId: string, cost = 0): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'item', cost })
const hero = (id: string, cardId: string, strength: number): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'hero', strength })
const ally = (id: string, cardId: string, strength: number): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'ally', strength })

/** Remplace le plateau du joueur 0 (Ratigan). */
function withBoard(base: GameState, board: Record<string, CardInstance[]>, extra: Partial<GameState['players'][number]> = {}): GameState {
  return {
    ...base,
    players: base.players.map((p, i) =>
      i === 0 ? { ...p, board: { ...p.board, ...board }, ...extra } : p,
    ),
  }
}

describe('Ratigan — réduction de coût de la Reine Robot', () => {
  const robot = item('rr', 'reine-robot', 15)

  it('coûte 15 par défaut', () => {
    expect(effectiveCost(game(), robot, 'repaire-secret')).toBe(15)
  })

  it('−1 par Outils dans le royaume', () => {
    const s = withBoard(game(), { 'big-ben': [item('o', 'outils', 2)] })
    expect(effectiveCost(s, robot, 'repaire-secret')).toBe(14)
  })

  it('−3 si Flaversham est sur le Repaire secret', () => {
    const s = withBoard(game(), { 'repaire-secret': [hero('f', 'flaversham', 2)] })
    expect(effectiveCost(s, robot, 'repaire-secret')).toBe(12)
  })
})

describe('Ratigan — objectif « L’Esprit Supérieur »', () => {
  it('gagné quand la Reine Robot (non associée) est à Buckingham Palace', () => {
    const s = withBoard(game(), { 'buckingham-palace': [item('rr', 'reine-robot', 15)] })
    expect(hasReachedObjective(s)).toBe(true)
  })

  it('non gagné si la Reine Robot est associée (zone haute)', () => {
    const attached: CardInstance = { ...item('rr', 'reine-robot', 15), attachedTo: 'x' }
    const s = withBoard(game(), { 'buckingham-palace': [attached] })
    expect(hasReachedObjective(s)).toBe(false)
  })

  it('bloqué par la Reine Moustoria à Buckingham Palace', () => {
    const s = withBoard(game(), {
      'buckingham-palace': [item('rr', 'reine-robot', 15), hero('m', 'reine-moustoria', 5)],
    })
    expect(hasReachedObjective(s)).toBe(false)
  })
})

describe('Ratigan — bascule « Le Rat »', () => {
  it('syncRatiganObjective bascule dès que la Reine Robot est dans la défausse', () => {
    const base = game()
    const flipped = syncRatiganObjective({ ...base.players[0], discard: [item('rr', 'reine-robot', 15)] })
    expect(flipped.becameTheRat).toBe(true)
  })

  it('défausser la Reine Robot (Basil infligé) bascule l’objectif IMMÉDIATEMENT', () => {
    const base = game()
    const robot: CardInstance = { instanceId: 'rr', cardId: 'reine-robot', name: 'Reine Robot', type: 'item', cost: 15 }
    const basil: CardInstance = {
      instanceId: 'b', cardId: 'basil', name: 'Basil', type: 'hero', strength: 4,
      onPlace: [{ type: 'DISCARD_ITEM_AT_HOST', preferCardId: 'reine-robot' }],
    }
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'buckingham-palace': [robot] } } : p)),
    }
    // Mode test : on inflige Basil sur le lieu de la Reine Robot (déclenche son onPlace).
    const after = applyAction(s, { type: 'TEST_PLACE_FATE', card: basil, to: 'buckingham-palace' })
    expect(after.players[0].discard.some((c) => c.cardId === 'reine-robot')).toBe(true)
    expect(after.players[0].becameTheRat).toBe(true) // bascule sans attendre le début du tour
  })

  it('côté « Le Rat » : gagné quand Basil a été éliminé (drapeau posé)', () => {
    const s = withBoard(game(), {}, { becameTheRat: true, objectiveHeroDefeated: true })
    expect(hasReachedObjective(s)).toBe(true)
  })

  it('côté « Le Rat » : encore bloqué par la Reine Moustoria à Buckingham', () => {
    const s = withBoard(
      game(),
      { 'buckingham-palace': [hero('m', 'reine-moustoria', 5)] },
      { becameTheRat: true, objectiveHeroDefeated: true },
    )
    expect(hasReachedObjective(s)).toBe(false)
  })

  it('éliminer Basil (côté Le Rat) pose le drapeau de victoire', () => {
    const s = withBoard(
      game(),
      { 'big-ben': [hero('b', 'basil', 4), ally('br', 'brutes', 4)] },
      { becameTheRat: true, pawnLocation: 'big-ben' },
    )
    const after = performVanquish(s, 'b', ['br'], false)
    expect(after.players[0].objectiveHeroDefeated).toBe(true)
  })
})

describe('Ratigan — effets de cartes (2b)', () => {
  it('Engrenages EN JEU : défaussés (au choix) pour réduire le coût de la Reine Robot (−3 chacun)', () => {
    const base = game()
    const rr: CardInstance = { instanceId: 'rr', cardId: 'reine-robot', name: 'Reine Robot', type: 'item', cost: 15, playOnlyAt: 'repaire-secret' }
    const e1 = item('e1', 'engrenages', 1)
    const e2 = item('e2', 'engrenages', 1)
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      usedActionIds: [],
      players: base.players.map((p, i) =>
        // 2 Engrenages posés sur le plateau (Big Ben), Reine Robot en main, 9 Pouvoir.
        i === 0
          ? { ...p, pawnLocation: 'repaire-secret', power: 9, hand: [rr], board: { ...p.board, 'big-ben': [e1, e2] } }
          : p,
      ),
    }
    const after = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'rr',
      to: 'repaire-secret',
      engrenagesIds: ['e1', 'e2'],
    })
    expect(after.players[0].board['repaire-secret'].some((c) => c.cardId === 'reine-robot')).toBe(true)
    expect(after.players[0].power).toBe(0) // 15 − 2×3 (Engrenages) = 9, payé intégralement
    // Les Engrenages sont retirés du PLATEAU et envoyés en défausse.
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'engrenages')).toBe(false)
    expect(after.players[0].discard.filter((c) => c.cardId === 'engrenages')).toHaveLength(2)
  })

  it('Capture : déplace un Héros ≤3 vers le Repaire secret', () => {
    const s = withBoard(game(), { 'big-ben': [hero('h', 'olivia', 1)] })
    const after = resolveEffect(s, { type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }, { actorIndex: 0 })
    expect(after.players[0].board['repaire-secret'].some((c) => c.instanceId === 'h')).toBe(true)
    expect(after.players[0].board['big-ben'].some((c) => c.instanceId === 'h')).toBe(false)
  })

  it('Capture : un Héros de force > 3 n’est pas déplacé', () => {
    const s = withBoard(game(), { 'big-ben': [hero('h', 'basil', 4)] })
    const after = resolveEffect(s, { type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }, { actorIndex: 0 })
    expect(after.players[0].board['big-ben'].some((c) => c.instanceId === 'h')).toBe(true)
  })

  it('Cloche (TUTOR_CARD_TO_HAND) : prend Félicia dans la pioche', () => {
    const base = game()
    const fel = ally('f', 'felicia', 6)
    const s: GameState = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, deck: [fel, ...p.deck] } : p)) }
    const after = resolveEffect(s, { type: 'TUTOR_CARD_TO_HAND', cardId: 'felicia' }, { actorIndex: 0 })
    expect(after.players[0].hand.some((c) => c.instanceId === 'f')).toBe(true)
    expect(after.players[0].deck.some((c) => c.instanceId === 'f')).toBe(false)
  })

  it('Basil (DISCARD_ITEM_AT_HOST) : défausse la Reine Robot en priorité', () => {
    const s = withBoard(game(), { 'buckingham-palace': [item('rr', 'reine-robot', 15), item('o', 'outils', 2)] })
    const after = resolveEffect(s, { type: 'DISCARD_ITEM_AT_HOST', preferCardId: 'reine-robot' }, { actorIndex: 0, hostLocationId: 'buckingham-palace' })
    expect(after.players[0].discard.some((c) => c.cardId === 'reine-robot')).toBe(true)
    expect(after.players[0].board['buckingham-palace'].some((c) => c.cardId === 'reine-robot')).toBe(false)
    expect(after.players[0].board['buckingham-palace'].some((c) => c.cardId === 'outils')).toBe(true)
  })

  it('Sabotage : défausse un Objet ≤3 sur un lieu avec Héros, épargne la Reine Robot (15)', () => {
    const s = withBoard(game(), { 'big-ben': [hero('h', 'basil', 4), item('o', 'outils', 2), item('rr', 'reine-robot', 15)] })
    const after = resolveEffect(s, { type: 'DISCARD_REALM_ITEM_LE_COST', maxCost: 3 }, { actorIndex: 0 })
    expect(after.players[0].discard.some((c) => c.cardId === 'outils')).toBe(true)
    expect(after.players[0].board['big-ben'].some((c) => c.cardId === 'reine-robot')).toBe(true)
  })

  it('Le Grand Génie du Mal : gagne 2 JT si la main est fournie', () => {
    const s = withBoard(game(), {}, { hand: [item('a', 'x'), item('b', 'y'), item('c', 'z')], power: 5 })
    const after = resolveEffect(s, { type: 'DRAW_OR_GAIN_POWER', draw: 2, power: 2 }, { actorIndex: 0 })
    expect(after.players[0].power).toBe(7)
  })

  it('Le Grand Génie du Mal : pioche 2 cartes si la main est courte', () => {
    const s = withBoard(game(), {}, { hand: [], deck: [item('d1', 'x'), item('d2', 'y'), item('d3', 'z')], power: 5 })
    const after = resolveEffect(s, { type: 'DRAW_OR_GAIN_POWER', draw: 2, power: 2 }, { actorIndex: 0 })
    expect(after.players[0].hand).toHaveLength(2)
    expect(after.players[0].power).toBe(5)
  })

  it('Félicia : coûte +2 sans Héros sur la destination, coût normal avec un Héros', () => {
    const card: CardInstance = { ...ally('fe', 'felicia', 6), cost: 3 }
    expect(effectiveCost(game(), card, 'big-ben')).toBe(5)
    const s = withBoard(game(), { 'big-ben': [hero('h', 'basil', 4)] })
    expect(effectiveCost(s, card, 'big-ben')).toBe(3)
  })

  it('Félicia (DISCARD_HERO_AT_HOST) : défausse le Héros le plus fort de son lieu', () => {
    const s = withBoard(game(), { 'big-ben': [hero('h1', 'olivia', 1), hero('h2', 'basil', 4)] })
    const after = resolveEffect(s, { type: 'DISCARD_HERO_AT_HOST' }, { actorIndex: 0, hostLocationId: 'big-ben' })
    expect(after.players[0].fateDiscard.some((c) => c.instanceId === 'h2')).toBe(true)
    expect(after.players[0].board['big-ben'].some((c) => c.instanceId === 'h2')).toBe(false)
    expect(after.players[0].board['big-ben'].some((c) => c.instanceId === 'h1')).toBe(true)
  })

  it('Piège ingénieux (ELIMINATE_ALL_HEROES_AT) : élimine tous les Héros du lieu', () => {
    const s = withBoard(game(), { 'big-ben': [hero('h1', 'olivia', 1), hero('h2', 'gardes-de-la-reine', 5)] })
    const after = resolveEffect(s, { type: 'ELIMINATE_ALL_HEROES_AT', locationId: 'big-ben' }, { actorIndex: 0 })
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.type === 'hero')).toBe(false)
    expect(after.players[0].fateDiscard.filter((c) => c.type === 'hero')).toHaveLength(2)
  })

  it('Piège ingénieux : élimine Basil côté « Le Rat » et pose le drapeau de victoire', () => {
    const s = withBoard(game(), { 'big-ben': [hero('b', 'basil', 4)] }, { becameTheRat: true })
    const after = resolveEffect(s, { type: 'ELIMINATE_ALL_HEROES_AT', locationId: 'big-ben' }, { actorIndex: 0 })
    expect(after.players[0].objectiveHeroDefeated).toBe(true)
  })

  it('Piège ingénieux : amorcé via Activer, se referme au début du tour suivant', () => {
    const base = game()
    const trap: CardInstance = { instanceId: 'pi', cardId: 'piege-ingenieux', name: 'Piège ingénieux', type: 'item', cost: 3, activatedCost: 1, trapArmed: true }
    // Piège amorcé sur Big Ben avec un Héros ; on simule le passage au tour de Ratigan.
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      activePlayer: 1, // c'est le tour de l'adversaire ; EndTurn rendra la main à Ratigan (0)
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, 'big-ben': [trap, hero('h', 'olivia', 1)] } } : p,
      ),
    }
    const after = applyAction(s, { type: 'END_TURN' })
    expect(after.activePlayer).toBe(0)
    // Le piège a éliminé le Héros puis a été défaussé.
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'piege-ingenieux')).toBe(false)
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.type === 'hero')).toBe(false)
    expect(after.players[0].discard.some((c) => c.cardId === 'piege-ingenieux')).toBe(true)
  })
})
