import { describe, it, expect } from 'vitest'
import { performVanquish, resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { hasReachedObjective, effectiveCost, realmRelocateCandidates, activatableCards } from '../rules'
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

  it('Capture : avec PLUSIEURS Héros ≤3, le joueur choisit lequel déplacer', () => {
    const s = withBoard(game(), {
      'big-ben': [hero('h1', 'olivia', 1)],
      'magasin-flaversham': [hero('h2', 'gardes-de-la-reine', 3)],
    })
    // Deux Héros éligibles → on n'agit pas tout seul : un choix est mis en attente.
    const after = resolveEffect(s, { type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }, { actorIndex: 0 })
    expect(after.pendingHeroRelocate?.chooserIndex).toBe(0)
    expect(after.pendingHeroRelocate?.forcedLocationId).toBe('repaire-secret')
    expect(after.pendingHeroRelocate?.candidateIds?.sort()).toEqual(['h1', 'h2'])
    // Aucun Héros n'a encore bougé.
    expect(after.players[0].board['big-ben'].some((c) => c.instanceId === 'h1')).toBe(true)
    // Le joueur choisit h2 → il part au Repaire secret (destination imposée).
    const done = applyAction(after, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'h2', to: 'repaire-secret' })
    expect(done.players[0].board['repaire-secret'].some((c) => c.instanceId === 'h2')).toBe(true)
    expect(done.players[0].board['magasin-flaversham'].some((c) => c.instanceId === 'h2')).toBe(false)
    expect(done.pendingHeroRelocate ?? null).toBeNull()
  })

  it('Capture : la destination est imposée (refuse un autre lieu)', () => {
    const s = withBoard(game(), {
      'big-ben': [hero('h1', 'olivia', 1)],
      'magasin-flaversham': [hero('h2', 'gardes-de-la-reine', 3)],
    })
    const after = resolveEffect(s, { type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }, { actorIndex: 0 })
    expect(() => applyAction(after, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'h1', to: 'big-ben' })).toThrow()
  })

  it('Capture : un Héros ≤3 DÉJÀ sur le Repaire secret n’est pas une cible', () => {
    const s = withBoard(game(), {
      'repaire-secret': [hero('h1', 'olivia', 1)],
      'big-ben': [hero('h2', 'gardes-de-la-reine', 3)],
    })
    // Seul h2 (hors Repaire secret) est éligible ; h1 (déjà sur place) est exclu.
    expect(realmRelocateCandidates(s.players[0], 3, 'repaire-secret').map((c) => c.instanceId)).toEqual(['h2'])
    // Un seul candidat → déplacement direct de h2, sans choix.
    const after = resolveEffect(s, { type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }, { actorIndex: 0 })
    expect(after.pendingHeroRelocate ?? null).toBeNull()
    expect(after.players[0].board['repaire-secret'].some((c) => c.instanceId === 'h2')).toBe(true)
  })

  it('Capture : injouable s’il n’y a aucun Héros ≤3 hors du Repaire secret', () => {
    // Le seul Héros ≤3 est déjà sur le Repaire secret → aucune cible.
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'repaire-secret': [hero('h1', 'olivia', 1)] },
      {
        hand: [{ instanceId: 'cap', cardId: 'capture', name: 'Capture', type: 'effect', cost: 1, effects: [{ type: 'MOVE_REALM_HERO_TO', maxStrength: 3, locationId: 'repaire-secret' }] }],
        power: 3,
        pawnLocation: 'big-ben',
      },
    )
    expect(realmRelocateCandidates(s.players[0], 3, 'repaire-secret')).toHaveLength(0)
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'cap', to: 'big-ben' })).toThrow()
  })

  it('Sournois : en réaction à une Fatalité, l’adversaire ne dévoile qu’1 carte au lieu de 2', () => {
    const base = game()
    const sn: CardInstance = { instanceId: 'sn', cardId: 'sournois', name: 'Sournois', type: 'condition', cost: 0, trigger: { type: 'opponent-fate-targeted-me' } }
    const c1 = hero('f1', 'olivia', 1)
    const c2 = hero('f2', 'basil', 4)
    const s: GameState = {
      ...base,
      activePlayer: 1, // c'est le tour de l'adversaire qui vient de lancer la Fatalité
      phase: 'ACTION',
      activeFateTargets: [0],
      pendingFate: { target: 0, revealed: [c1, c2] },
      players: base.players.map((p, i) => (i === 0 ? { ...p, hand: [sn] } : p)),
    }
    const after = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'sn' })
    // Une seule carte reste jouable contre Ratigan ; l'autre retourne sur sa pioche.
    expect(after.pendingFate?.revealed.map((c) => c.instanceId)).toEqual(['f1'])
    expect(after.players[0].fateDeck[0]?.instanceId).toBe('f2')
    // La Condition est défaussée (jouée).
    expect(after.players[0].discard.some((c) => c.cardId === 'sournois')).toBe(true)
  })

  it('Extravagance : en réaction (adversaire gagne ≥3 JT), choisit un Objet de la défausse → main', () => {
    const base = game()
    const ex: CardInstance = { instanceId: 'ex', cardId: 'extravagance', name: 'Extravagance', type: 'condition', cost: 0, trigger: { type: 'opponent-gained-power-ge', value: 3 }, effects: [{ type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['item'], label: 'Extravagance' }] }
    const it1 = item('o1', 'outils', 2)
    const ev1 = { instanceId: 'e1', cardId: 'capture', name: 'Capture', type: 'effect' as const, cost: 1 }
    const s: GameState = {
      ...base,
      activePlayer: 1,
      phase: 'ACTION',
      activeGainedPower: 3, // l'adversaire a gagné 3 JT ce tour-ci
      players: base.players.map((p, i) => (i === 0 ? { ...p, hand: [ex], discard: [it1, ev1] } : p)),
    }
    // Le choix s'ouvre sur les OBJETS de la défausse uniquement (l'Événement est exclu).
    const opened = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'ex' })
    expect(opened.pendingRecover?.playerIndex).toBe(0)
    expect(opened.pendingRecover?.candidateIds).toEqual(['o1'])
    expect(opened.pendingRecover?.label).toBe('Extravagance')
    // Le joueur choisit l'Objet → il rejoint sa main, quitte la défausse.
    const after = applyAction(opened, { type: 'RESOLVE_RECOVER', instanceId: 'o1' })
    expect(after.players[0].hand.some((c) => c.instanceId === 'o1')).toBe(true)
    expect(after.players[0].discard.some((c) => c.instanceId === 'o1')).toBe(false)
    expect(after.pendingRecover ?? null).toBeNull()
  })

  it('Appel à l’aide : ouvre le choix du lieu puis pose Basil (cherché dans la pioche)', () => {
    const base = game()
    const appel: CardInstance = { instanceId: 'aa', cardId: 'appel-a-l-aide', name: 'Appel à l’aide', type: 'effect' }
    // Basil est dans la pioche Fatalité de Ratigan (deck construit par game()).
    const s: GameState = { ...base, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [appel] } }
    const opened = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'aa' })
    // Le choix du lieu s'ouvre pour le joueur qui a posé la Fatalité (1), cible 0.
    expect(opened.pendingFateHeroPlace?.chooserIndex).toBe(1)
    expect(opened.pendingFateHeroPlace?.targetIndex).toBe(0)
    expect(opened.pendingFateHeroPlace?.mode).toBe('place')
    // Le lieu choisi reçoit Basil ; il quitte la pioche Fatalité.
    const after = applyAction(opened, { type: 'RESOLVE_FATE_HERO_PLACE', locationId: 'big-ben' })
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'basil')).toBe(true)
    expect(after.players[0].fateDeck.some((c) => c.cardId === 'basil')).toBe(false)
    expect(after.pendingFateHeroPlace ?? null).toBeNull()
  })

  it('Appel à l’aide : si Basil est déjà en jeu, le déplace vers le lieu choisi', () => {
    const base = game()
    const appel: CardInstance = { instanceId: 'aa', cardId: 'appel-a-l-aide', name: 'Appel à l’aide', type: 'effect' }
    // Basil déjà posé sur Big Ben ; on retire l'exemplaire de la pioche pour être sûr.
    const withBasil = withBoard(base, { 'big-ben': [hero('b', 'basil', 4)] })
    const s: GameState = {
      ...withBasil,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [appel] },
      players: withBasil.players.map((p, i) => (i === 0 ? { ...p, fateDeck: p.fateDeck.filter((c) => c.cardId !== 'basil') } : p)),
    }
    const opened = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'aa' })
    expect(opened.pendingFateHeroPlace?.mode).toBe('move')
    const after = applyAction(opened, { type: 'RESOLVE_FATE_HERO_PLACE', locationId: 'repaire-secret' })
    expect((after.players[0].board['repaire-secret'] ?? []).some((c) => c.instanceId === 'b')).toBe(true)
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.instanceId === 'b')).toBe(false)
  })

  it('Ballon de fortune : associe au Héros choisi (+2) puis ouvre un déplacement facultatif (n’importe quel lieu)', () => {
    const base = game()
    const ballon: CardInstance = { instanceId: 'bf', cardId: 'ballon-de-fortune', name: 'Ballon de fortune', type: 'item', attach: 'hero', attachStrengthBonus: 2 }
    const withHero = withBoard(base, { 'big-ben': [hero('h1', 'olivia', 1)] })
    const s: GameState = { ...withHero, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [ballon] } }
    const opened = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'bf', targetHeroId: 'h1' })
    // Le Ballon est associé au Héros choisi.
    expect((opened.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'ballon-de-fortune' && c.attachedTo === 'h1')).toBe(true)
    // Déplacement FACULTATIF vers n'importe quel lieu, choisi par le lanceur (1).
    expect(opened.pendingHeroRelocate?.chooserIndex).toBe(1)
    expect(opened.pendingHeroRelocate?.anyLocation).toBe(true)
    expect(opened.pendingHeroRelocate?.optional).toBe(true)
    expect(opened.pendingHeroRelocate?.candidateIds).toEqual(['h1'])
    // Choix d'un lieu → le Héros ET son Ballon s'y déplacent.
    const moved = applyAction(opened, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'h1', to: 'repaire-secret' })
    expect((moved.players[0].board['repaire-secret'] ?? []).some((c) => c.instanceId === 'h1')).toBe(true)
    expect((moved.players[0].board['repaire-secret'] ?? []).some((c) => c.cardId === 'ballon-de-fortune' && c.attachedTo === 'h1')).toBe(true)
    expect(moved.pendingHeroRelocate ?? null).toBeNull()
  })

  it('Ballon de fortune : on peut décliner le déplacement (le Héros reste sur place)', () => {
    const base = game()
    const ballon: CardInstance = { instanceId: 'bf', cardId: 'ballon-de-fortune', name: 'Ballon de fortune', type: 'item', attach: 'hero', attachStrengthBonus: 2 }
    const withHero = withBoard(base, { 'big-ben': [hero('h1', 'olivia', 1)] })
    const s: GameState = { ...withHero, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [ballon] } }
    const opened = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'bf', targetHeroId: 'h1' })
    const skipped = applyAction(opened, { type: 'SKIP_HERO_RELOCATE' })
    expect((skipped.players[0].board['big-ben'] ?? []).some((c) => c.instanceId === 'h1')).toBe(true)
    expect((skipped.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'ballon-de-fortune' && c.attachedTo === 'h1')).toBe(true)
    expect(skipped.pendingHeroRelocate ?? null).toBeNull()
  })

  it('Cloche (TUTOR_CARD_TO_HAND) : prend Félicia dans la pioche', () => {
    const base = game()
    const fel = ally('f', 'felicia', 6)
    const s: GameState = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, deck: [fel, ...p.deck] } : p)) }
    const after = resolveEffect(s, { type: 'TUTOR_CARD_TO_HAND', cardId: 'felicia' }, { actorIndex: 0 })
    expect(after.players[0].hand.some((c) => c.instanceId === 'f')).toBe(true)
    expect(after.players[0].deck.some((c) => c.instanceId === 'f')).toBe(false)
  })

  it('Cloche : inactivable si Félicia est déjà en main', () => {
    const cloche: CardInstance = { instanceId: 'cl', cardId: 'cloche', name: 'Cloche', type: 'item', cost: 1, activatedCost: 0 }
    // Un 2ᵉ Objet activable (Habits royaux) garde l'action « Activer » disponible :
    // ainsi on teste bien le garde-fou de la Cloche (et pas la disparition de l'action).
    const robes: CardInstance = { instanceId: 'hr', cardId: 'habits-royaux', name: 'Habits royaux', type: 'item', cost: 2, activatedCost: 0 }
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'repaire-secret': [cloche, robes] },
      { hand: [ally('f', 'felicia', 6)], power: 3, pawnLocation: 'repaire-secret' },
    )
    // La Cloche est exclue des cartes activables (mais Habits royaux reste activable).
    expect(activatableCards(s).some((c) => c.cardId === 'cloche')).toBe(false)
    expect(activatableCards(s).some((c) => c.cardId === 'habits-royaux')).toBe(true)
    // Tenter d'activer la Cloche est refusé par le garde-fou Félicia.
    expect(() => applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'cl' })).toThrow(/Félicia/)
  })

  it('Cloche : inactivable si Félicia est déjà posée sur un lieu', () => {
    const cloche: CardInstance = { instanceId: 'cl', cardId: 'cloche', name: 'Cloche', type: 'item', cost: 1, activatedCost: 0 }
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'repaire-secret': [cloche], 'big-ben': [ally('f', 'felicia', 6)] },
      { pawnLocation: 'repaire-secret' },
    )
    expect(activatableCards(s).some((c) => c.cardId === 'cloche')).toBe(false)
  })

  it('Cloche : activable si Félicia est dans la pioche', () => {
    const cloche: CardInstance = { instanceId: 'cl', cardId: 'cloche', name: 'Cloche', type: 'item', cost: 1, activatedCost: 0 }
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'repaire-secret': [cloche] },
      { deck: [ally('f', 'felicia', 6)], hand: [], pawnLocation: 'repaire-secret' },
    )
    expect(activatableCards(s).some((c) => c.cardId === 'cloche')).toBe(true)
  })

  it('Liste de Fidget : dévoile jusqu’au 1er Objet → main, le reste → défausse, et montre tout', () => {
    const base = game()
    const ev = { instanceId: 'e1', cardId: 'capture', name: 'capture', type: 'effect' as const, cost: 1 }
    const al = ally('a1', 'brutes', 2)
    const it = item('i1', 'outils', 2)
    const rest = item('i2', 'engrenages', 1)
    // Pioche : Événement, Allié, Objet (cible), puis un autre Objet (intact).
    const s: GameState = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, deck: [ev, al, it, rest], discard: [] } : p)) }
    const after = resolveEffect(s, { type: 'REVEAL_DECK_UNTIL_TYPE', cardType: 'item', title: 'Liste de Fidget' }, { actorIndex: 0 })
    // L'Objet trouvé rejoint la main.
    expect(after.players[0].hand.some((c) => c.instanceId === 'i1')).toBe(true)
    // Les cartes dévoilées avant lui sont défaussées ; le 2e Objet reste en pioche.
    expect(after.players[0].discard.map((c) => c.instanceId).sort()).toEqual(['a1', 'e1'])
    expect(after.players[0].deck.map((c) => c.instanceId)).toEqual(['i2'])
    // Les 3 cartes dévoilées sont montrées (pendingReveal), i1 marquée comme gardée.
    expect(after.pendingReveal?.cards.map((c) => c.instanceId)).toEqual(['e1', 'a1', 'i1'])
    expect(after.pendingReveal?.keptInstanceId).toBe('i1')
    // Acquittement : referme le modal.
    const ack = applyAction(after, { type: 'ACKNOWLEDGE_REVEAL' })
    expect(ack.pendingReveal ?? null).toBeNull()
  })

  it('Liste de Fidget : aucun Objet dans tout le paquet → tout défaussé, rien en main', () => {
    const base = game()
    const ev = { instanceId: 'e1', cardId: 'capture', name: 'capture', type: 'effect' as const, cost: 1 }
    const al = ally('a1', 'brutes', 2)
    const s: GameState = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, deck: [ev, al], discard: [], hand: [] } : p)) }
    const after = resolveEffect(s, { type: 'REVEAL_DECK_UNTIL_TYPE', cardType: 'item' }, { actorIndex: 0 })
    expect(after.players[0].hand).toHaveLength(0)
    expect(after.players[0].deck).toHaveLength(0)
    expect(after.players[0].discard.map((c) => c.instanceId).sort()).toEqual(['a1', 'e1'])
    expect(after.pendingReveal?.keptInstanceId).toBeUndefined()
  })

  it('Basil (DISCARD_ITEM_AT_HOST) : défausse la Reine Robot en priorité', () => {
    const s = withBoard(game(), { 'buckingham-palace': [item('rr', 'reine-robot', 15), item('o', 'outils', 2)] })
    const after = resolveEffect(s, { type: 'DISCARD_ITEM_AT_HOST', preferCardId: 'reine-robot' }, { actorIndex: 0, hostLocationId: 'buckingham-palace' })
    expect(after.players[0].discard.some((c) => c.cardId === 'reine-robot')).toBe(true)
    expect(after.players[0].board['buckingham-palace'].some((c) => c.cardId === 'reine-robot')).toBe(false)
    expect(after.players[0].board['buckingham-palace'].some((c) => c.cardId === 'outils')).toBe(true)
  })

  it('Sabotage : le lanceur choisit l’Objet (≤3) à défausser parmi les lieux à Héros', () => {
    const base = game()
    const sabo: CardInstance = { instanceId: 'sb', cardId: 'sabotage', name: 'Sabotage', type: 'effect' }
    // big-ben : Héros + Outils(2) + Reine Robot(15). magasin : Héros + Engrenages(1).
    // repaire-secret : Cloche(1) SANS Héros (donc exclue).
    const withState = withBoard(base, {
      'big-ben': [hero('h1', 'basil', 4), item('o', 'outils', 2), item('rr', 'reine-robot', 15)],
      'magasin-flaversham': [hero('h2', 'olivia', 1), item('e', 'engrenages', 1)],
      'repaire-secret': [item('cl', 'cloche', 1)],
    })
    const s: GameState = { ...withState, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [sabo] } }
    const opened = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'sb' })
    // Candidats = Objets ≤3 non associés sur un lieu à Héros : Outils et Engrenages.
    // (Reine Robot exclue : coût 15 ; Cloche exclue : lieu sans Héros.)
    expect(opened.pendingFateChoice?.kind).toBe('remove-item')
    expect(opened.pendingFateChoice?.chooserIndex).toBe(1)
    expect((opened.pendingFateChoice?.candidateIds ?? []).sort()).toEqual(['e', 'o'])
    // Le lanceur choisit Engrenages (sur l'autre lieu) → il est défaussé.
    const after = applyAction(opened, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'e' })
    expect(after.players[0].discard.some((c) => c.instanceId === 'e')).toBe(true)
    expect((after.players[0].board['magasin-flaversham'] ?? []).some((c) => c.instanceId === 'e')).toBe(false)
    expect(after.pendingFateChoice ?? null).toBeNull()
  })

  it('Sabotage : sans Objet ≤3 sur un lieu à Héros, la carte est défaussée sans effet', () => {
    const base = game()
    const sabo: CardInstance = { instanceId: 'sb', cardId: 'sabotage', name: 'Sabotage', type: 'effect' }
    // Seul Objet ≤3 (Engrenages) est sur un lieu SANS Héros → aucun candidat.
    const withState = withBoard(base, {
      'big-ben': [hero('h1', 'basil', 4)],
      'magasin-flaversham': [item('e', 'engrenages', 1)],
    })
    const s: GameState = { ...withState, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [sabo] } }
    const after = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'sb' })
    expect(after.pendingFateChoice ?? null).toBeNull()
    expect(after.players[0].fateDiscard.some((c) => c.cardId === 'sabotage')).toBe(true)
  })

  it('Le Grand Génie du Mal : met le choix Piocher/Pouvoir en attente', () => {
    const s = withBoard(game(), {}, { hand: [], power: 5 })
    const after = resolveEffect(s, { type: 'DRAW_OR_GAIN_POWER', draw: 2, power: 2 }, { actorIndex: 0 })
    expect(after.pendingDrawOrGainPower).toEqual({ playerIndex: 0, draw: 2, power: 2 })
  })

  it('Le Grand Génie du Mal : choix « Pouvoir » → gagne 2 JT', () => {
    const s = withBoard(game(), {}, { hand: [item('a', 'x')], deck: [item('d1', 'x')], power: 5 })
    const pending = resolveEffect(s, { type: 'DRAW_OR_GAIN_POWER', draw: 2, power: 2 }, { actorIndex: 0 })
    const after = applyAction(pending, { type: 'RESOLVE_DRAW_OR_GAIN_POWER', choice: 'power' })
    expect(after.players[0].power).toBe(7)
    expect(after.players[0].hand).toHaveLength(1)
    expect(after.pendingDrawOrGainPower ?? null).toBeNull()
  })

  it('Le Grand Génie du Mal : choix « Piocher » → pioche 2 cartes', () => {
    const s = withBoard(game(), {}, { hand: [], deck: [item('d1', 'x'), item('d2', 'y'), item('d3', 'z')], power: 5 })
    const pending = resolveEffect(s, { type: 'DRAW_OR_GAIN_POWER', draw: 2, power: 2 }, { actorIndex: 0 })
    const after = applyAction(pending, { type: 'RESOLVE_DRAW_OR_GAIN_POWER', choice: 'draw' })
    expect(after.players[0].hand).toHaveLength(2)
    expect(after.players[0].power).toBe(5)
    expect(after.pendingDrawOrGainPower ?? null).toBeNull()
  })

  // Félicia : à la pose, défausser un Allié de son lieu OU payer 2 Pouvoir de plus.
  const felicia = (): CardInstance => ({
    instanceId: 'fe', cardId: 'felicia', name: 'Félicia', type: 'ally', strength: 6, cost: 3,
    effects: [{ type: 'DISCARD_ALLY_AT_HOST_OR_PAY', power: 2 }],
  })

  it('Félicia : coût de base inchangé (le +2 est désormais un choix, pas une surcharge)', () => {
    expect(effectiveCost(game(), felicia(), 'big-ben')).toBe(3)
    const s = withBoard(game(), { 'big-ben': [hero('h', 'basil', 4)] })
    expect(effectiveCost(s, felicia(), 'big-ben')).toBe(3)
  })

  it('Félicia : option « défausser un Allié » (coût de base, Allié choisi défaussé)', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [ally('a1', 'brutes', 2)] },
      { hand: [felicia()], power: 3, pawnLocation: 'big-ben' },
    )
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'fe', to: 'big-ben', allyInstanceIds: ['a1'] })
    expect(after.players[0].power).toBe(0) // 3, pas de supplément
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'felicia')).toBe(true)
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.instanceId === 'a1')).toBe(false)
    expect(after.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true)
  })

  it('Félicia : option « payer 2 » sans Allié sur le lieu (coût 3 + 2)', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [] },
      { hand: [felicia()], power: 5, pawnLocation: 'big-ben' },
    )
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'fe', to: 'big-ben' })
    expect(after.players[0].power).toBe(0) // 3 + 2
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'felicia')).toBe(true)
  })

  it('Félicia : injouable si aucun Allié à défausser ET pas les moyens de payer +2', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [] },
      { hand: [felicia()], power: 4, pawnLocation: 'big-ben' },
    )
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'fe', to: 'big-ben' })).toThrow()
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

  it('Habits royaux : activer gagne 2 jetons Pouvoir (réutilisable, coût 0)', () => {
    const robes: CardInstance = { instanceId: 'hr', cardId: 'habits-royaux', name: 'Habits royaux', type: 'item', cost: 2, activatedCost: 0 }
    const s = withBoard(
      { ...game(), phase: 'ACTION' },
      { 'repaire-secret': [robes] },
      { power: 3, pawnLocation: 'repaire-secret' },
    )
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'hr' })
    expect(after.players[0].power).toBe(5) // 3 + 2
    // L'Objet reste en jeu (activation réutilisable les tours suivants).
    expect((after.players[0].board['repaire-secret'] ?? []).some((c) => c.cardId === 'habits-royaux')).toBe(true)
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

describe('Ratigan — Brutes (action distante facultative)', () => {
  const brutesCard = (): CardInstance => ({
    instanceId: 'br', cardId: 'brutes', name: 'Brutes', type: 'ally', cost: 2, strength: 2,
    effects: [{ type: 'ALLY_REMOTE_ACTION' }],
  })

  it('jouées hors du lieu du pion : ouvre une fenêtre d’action sur leur lieu (hors Fatalité)', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      {},
      { hand: [brutesCard()], power: 5, pawnLocation: 'repaire-secret' },
    )
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'br', to: 'big-ben' })
    expect(after.actAtLocation).toBe('big-ben')
    expect(after.actAtLocationSkippable).toBe(true)
    // L'Allié est bien posé sur Big Ben.
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'brutes')).toBe(true)
  })

  it('l’action distante (Gagner 2) s’exécute puis la fenêtre se referme', () => {
    let s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      {},
      { hand: [brutesCard()], power: 5, pawnLocation: 'repaire-secret' },
    )
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'br', to: 'big-ben' })
    // 5 − 2 (coût) = 3, puis +2 par l'action « Gagner 2 pouvoir » de Big Ben.
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.players[0].power).toBe(5)
    expect(s.actAtLocation ?? null).toBeNull()
  })

  it('peut renoncer à l’action distante (SKIP_REMOTE_ACTION)', () => {
    let s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      {},
      { hand: [brutesCard()], power: 5, pawnLocation: 'repaire-secret' },
    )
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'br', to: 'big-ben' })
    s = applyAction(s, { type: 'SKIP_REMOTE_ACTION' })
    expect(s.actAtLocation ?? null).toBeNull()
    expect(s.players[0].power).toBe(3) // 5 − 2, aucune action distante
  })

  it('jouées sur le lieu du pion : aucune fenêtre distante', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      {},
      { hand: [brutesCard()], power: 5, pawnLocation: 'big-ben' },
    )
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'br', to: 'big-ben' })
    expect(after.actAtLocation ?? null).toBeNull()
  })
})

describe('Ratigan — Uniforme (association + Vanquish facultatif)', () => {
  const uniforme = (): CardInstance => ({
    instanceId: 'u', cardId: 'uniforme', name: 'Uniforme', type: 'item', cost: 2, attach: 'ally', attachStrengthBonus: 2,
  })

  it('arme un Vanquish facultatif (source uniforme) s’il y a un Héros sur le lieu', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [ally('a1', 'brutes', 2), hero('h1', 'basil', 4)] },
      { hand: [uniforme()], power: 2, pawnLocation: 'big-ben' },
    )
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'u', to: 'big-ben', attachTo: 'a1' })
    // L'Uniforme est associé à l'Allié, et un Vanquish facultatif est en attente.
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'uniforme' && c.attachedTo === 'a1')).toBe(true)
    expect(after.pendingTrapVanquish?.source).toBe('uniforme')
    expect(after.pendingTrapVanquish?.locationId).toBe('big-ben')
    expect(after.pendingTrapVanquish?.requiredAllyInstanceId).toBe('a1')
  })

  it('l’Allié équipé (+2) élimine le Héros via TRAP_VANQUISH', () => {
    let s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [ally('a1', 'brutes', 2), hero('h1', 'basil', 4)] },
      { hand: [uniforme()], power: 2, pawnLocation: 'big-ben' },
    )
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'u', to: 'big-ben', attachTo: 'a1' })
    // Allié 2 + Uniforme 2 = 4 ≥ Basil 4.
    s = applyAction(s, { type: 'TRAP_VANQUISH', heroInstanceId: 'h1', allyInstanceIds: ['a1'] })
    expect(s.pendingTrapVanquish).toBeNull()
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
  })

  it('refuse une élimination où l’Allié porteur ne participe pas', () => {
    let s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [ally('a1', 'brutes', 2), ally('a2', 'brutes', 5), hero('h1', 'basil', 4)] },
      { hand: [uniforme()], power: 2, pawnLocation: 'big-ben' },
    )
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'u', to: 'big-ben', attachTo: 'a1' })
    expect(() => applyAction(s, { type: 'TRAP_VANQUISH', heroInstanceId: 'h1', allyInstanceIds: ['a2'] })).toThrow()
  })

  it('TRAP_SKIP_VANQUISH renonce à l’élimination (l’Uniforme reste associé)', () => {
    let s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [ally('a1', 'brutes', 2), hero('h1', 'basil', 4)] },
      { hand: [uniforme()], power: 2, pawnLocation: 'big-ben' },
    )
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'u', to: 'big-ben', attachTo: 'a1' })
    s = applyAction(s, { type: 'TRAP_SKIP_VANQUISH' })
    expect(s.pendingTrapVanquish).toBeNull()
    expect((s.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'uniforme' && c.attachedTo === 'a1')).toBe(true)
    expect((s.players[0].board['big-ben'] ?? []).some((c) => c.type === 'hero')).toBe(true)
  })

  it('sans Héros sur le lieu, aucune élimination n’est armée', () => {
    const s = withBoard(
      { ...game(), phase: 'ACTION', activePlayer: 0 },
      { 'big-ben': [ally('a1', 'brutes', 2)] },
      { hand: [uniforme()], power: 2, pawnLocation: 'big-ben' },
    )
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'u', to: 'big-ben', attachTo: 'a1' })
    expect(after.pendingTrapVanquish ?? null).toBeNull()
    expect((after.players[0].board['big-ben'] ?? []).some((c) => c.cardId === 'uniforme')).toBe(true)
  })
})
