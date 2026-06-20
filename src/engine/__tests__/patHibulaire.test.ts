import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffects, triggerHeroArrival } from '../effects'
import { hasReachedObjective, isPassiveGoalMet, goalsBlockedByHero, conditionIsTriggered } from '../rules'
import { patHibulaire } from '../../data/villains/patHibulaire'
import { patHibulaireCards } from '../../data/villains/patHibulaire.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState, GoalToken } from '../types'

function game(seed = 9): GameState {
  const g = createInitialGame(
    [
      { villain: patHibulaire, deckCards: buildDeckInstances(patHibulaireCards, 'villain', 'p0:'), fateCards: buildDeckInstances(patHibulaireCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    seed,
  )
  return { ...g, activePlayer: 0 }
}

const ally = (id: string, strength: number): CardInstance => ({ instanceId: id, cardId: 'bandit', name: 'Bandit', type: 'ally', strength })
const item = (id: string): CardInstance => ({ instanceId: id, cardId: 'magot', name: 'Magot', type: 'item' })
const hero = (id: string, cardId: string, strength: number): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'hero', strength })
const vcard = (id: string, cost: number): CardInstance => ({ instanceId: id, cardId: 'une-petite-partie', name: 'carte', type: 'effect', cost })

/** Modifie le joueur 0 (Pat). */
function withP0(base: GameState, patch: Partial<GameState['players'][number]>): GameState {
  return { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, ...patch } : p)) }
}

/** Force des tuiles du joueur 0 + son plateau. */
function withGoals(base: GameState, goals: GoalToken[], board: Record<string, CardInstance[]> = {}): GameState {
  return {
    ...base,
    players: base.players.map((p, i) =>
      i === 0 ? { ...p, goals, board: { ...p.board, ...board } } : p,
    ),
  }
}

describe('Pat Hibulaire — mise en place des tuiles Objectif', () => {
  it('pose 4 tuiles (une par lieu), distinctes, tirées des 5 candidates', () => {
    const p = game().players[0]
    expect(p.goals).toHaveLength(4)
    const locs = p.goals!.map((g) => g.locationId).sort()
    expect(locs).toEqual(['aeroport', 'frontier-town', 'ponton', 'station-service'])
    const kinds = new Set(p.goals!.map((g) => g.kind))
    expect(kinds.size).toBe(4) // toutes distinctes
    for (const g of p.goals!) {
      expect(patHibulaire.goalKinds).toContain(g.kind)
      expect(g.completed).toBe(false)
      expect(g.revealed).toBe(false)
    }
    expect(p.powerSpentThisTurn).toBe(0)
  })

  it('le tirage dépend de la graine (variabilité)', () => {
    const a = game(1).players[0].goals!.map((g) => g.kind).join(',')
    const b = game(7).players[0].goals!.map((g) => g.kind).join(',')
    // Au moins une graine sur deux change l'agencement (non garanti pour TOUTES,
    // mais ces deux-là diffèrent : garde-fou anti « tirage figé »).
    expect(a).not.toBe(b)
  })
})

describe('Pat Hibulaire — Affront (Condition)', () => {
  // Affront se joue au tour de l'adversaire (qui a déplacé une carte) ET seulement
  // s'il y a un Héros de force ≤ 3 dans le royaume de Pat (sinon aucun effet).
  const affront = (): CardInstance =>
    buildDeckInstances(patHibulaireCards, 'villain', 'p0:').find((c) => c.cardId === 'affront')!

  function moveContext(base: GameState): GameState {
    // Adversaire (joueur 1) actif et ayant déplacé une carte ce tour-ci.
    return { ...base, activePlayer: 1, activeMovedCard: true }
  }

  it('non jouable sans aucun Héros sur le plateau', () => {
    const s = moveContext(game())
    expect(conditionIsTriggered(s, affront(), 0)).toBe(false)
  })

  it('non jouable si le seul Héros est de force > 3', () => {
    const s = moveContext(withGoals(game(), [], { 'frontier-town': [hero('h', 'mickey', 5)] }))
    expect(conditionIsTriggered(s, affront(), 0)).toBe(false)
  })

  it('jouable avec un Héros de force ≤ 3 dans le royaume', () => {
    const s = moveContext(withGoals(game(), [], { 'frontier-town': [hero('h', 'donald', 3)] }))
    expect(conditionIsTriggered(s, affront(), 0)).toBe(true)
  })
})

describe('Pat Hibulaire — conditions des tuiles', () => {
  it('Round Up : Alliés de force ≥ 10 sur le lieu', () => {
    const g: GoalToken = { kind: 'round-up', locationId: 'frontier-town', completed: false, revealed: false }
    const lo = withGoals(game(), [g], { 'frontier-town': [ally('a', 4), ally('b', 3), ally('c', 2)] }) // 9
    expect(isPassiveGoalMet(lo.players[0], g)).toBe(false)
    const hi = withGoals(game(), [g], { 'frontier-town': [ally('a', 4), ally('b', 3), ally('c', 3)] }) // 10
    expect(isPassiveGoalMet(hi.players[0], g)).toBe(true)
  })

  it('Strike It Rich : ≥ 3 Objets non associés sur le lieu', () => {
    const g: GoalToken = { kind: 'strike-it-rich', locationId: 'aeroport', completed: false, revealed: false }
    const s = withGoals(game(), [g], { aeroport: [item('i1'), item('i2'), item('i3')] })
    expect(isPassiveGoalMet(s.players[0], g)).toBe(true)
    const s2 = withGoals(game(), [g], { aeroport: [item('i1'), item('i2')] })
    expect(isPassiveGoalMet(s2.players[0], g)).toBe(false)
  })

  it('Rule the Realm : plus d’Alliés que de Héros sur CHAQUE lieu', () => {
    const g: GoalToken = { kind: 'rule-the-realm', locationId: 'ponton', completed: false, revealed: false }
    // Un lieu avec un Héros non couvert par un Allié → faux.
    const bad = withGoals(game(), [g], { 'frontier-town': [hero('h', 'donald', 3)] })
    expect(isPassiveGoalMet(bad.players[0], g)).toBe(false)
    // Tous les lieux : au moins autant d'Alliés que de Héros, strictement plus.
    const ok = withGoals(game(), [g], {
      'frontier-town': [ally('a', 1)],
      'station-service': [ally('b', 1)],
      aeroport: [ally('c', 1)],
      ponton: [ally('d', 1)],
    })
    expect(isPassiveGoalMet(ok.players[0], g)).toBe(true)
  })
})

describe('Pat Hibulaire — victoire', () => {
  const fourGoals = (completed: boolean): GoalToken[] =>
    (['win-big', 'power-play', 'strike-it-rich', 'round-up'] as const).map((kind, i) => ({
      kind,
      locationId: ['frontier-town', 'station-service', 'aeroport', 'ponton'][i],
      completed,
      revealed: false,
    }))

  it('gagné quand les 4 tuiles sont remplies', () => {
    expect(hasReachedObjective(withGoals(game(), fourGoals(true)))).toBe(true)
  })

  it('pas gagné tant qu’une tuile reste à remplir', () => {
    const goals = fourGoals(true)
    goals[2] = { ...goals[2], completed: false }
    expect(hasReachedObjective(withGoals(game(), goals))).toBe(false)
  })

  it('Mickey présent bloque toute complétion', () => {
    const g: GoalToken = { kind: 'round-up', locationId: 'frontier-town', completed: false, revealed: false }
    const s = withGoals(game(), [g], {
      'frontier-town': [ally('a', 5), ally('b', 5)], // force 10, condition remplie
      ponton: [hero('m', 'mickey', 5)],
    })
    expect(goalsBlockedByHero(s.players[0])).toBe(true)
  })

  it('complétion en début de tour : Round Up rempli → tuile complétée (et victoire si 4ᵉ)', () => {
    // 3 tuiles déjà complétées + Round Up sur Frontier Town avec force 10.
    const goals: GoalToken[] = [
      { kind: 'win-big', locationId: 'station-service', completed: true, revealed: true },
      { kind: 'strike-it-rich', locationId: 'aeroport', completed: true, revealed: true },
      { kind: 'power-play', locationId: 'ponton', completed: true, revealed: true },
      { kind: 'round-up', locationId: 'frontier-town', completed: false, revealed: false },
    ]
    const base = withGoals(game(), goals, { 'frontier-town': [ally('a', 5), ally('b', 5)] })
    // C'est le tour du joueur 1 (Prince Jean) ; il termine → début du tour de Pat.
    const s1: GameState = { ...base, activePlayer: 1, phase: 'ACTION' }
    const after = applyAction(s1, { type: 'END_TURN' })
    expect(after.status).toBe('WON')
    expect(after.winner).toBe(0)
  })

  it('Mickey empêche la complétion de Round Up en début de tour', () => {
    const goals: GoalToken[] = [
      { kind: 'win-big', locationId: 'station-service', completed: true, revealed: true },
      { kind: 'strike-it-rich', locationId: 'aeroport', completed: true, revealed: true },
      { kind: 'power-play', locationId: 'ponton', completed: true, revealed: true },
      { kind: 'round-up', locationId: 'frontier-town', completed: false, revealed: false },
    ]
    const base = withGoals(game(), goals, {
      'frontier-town': [ally('a', 5), ally('b', 5)],
      aeroport: [hero('m', 'mickey', 5)],
    })
    const s1: GameState = { ...base, activePlayer: 1, phase: 'ACTION' }
    const after = applyAction(s1, { type: 'END_TURN' })
    expect(after.status).toBe('PLAYING')
    expect(after.players[0].goals!.find((g) => g.kind === 'round-up')!.completed).toBe(false)
  })
})

describe('Pat Hibulaire — effets de cartes', () => {
  it('Une Petite Partie ? : gagne la somme des coûts des 2 cartes révélées (puis défausse)', () => {
    const s = withP0(game(), { power: 0, deck: [vcard('d1', 2), vcard('d2', 3), vcard('d3', 1)] })
    const after = resolveEffects(s, [{ type: 'PLAY_A_GAME', reveal: 2 }], { actorIndex: 0 })
    expect(after.players[0].power).toBe(5)
    expect(after.players[0].deck.map((c) => c.instanceId)).toEqual(['d3'])
    expect(after.players[0].discard.map((c) => c.instanceId)).toEqual(['d1', 'd2'])
  })

  it('Oswald : −1 sur le gain d’Une Petite Partie ?', () => {
    const s = withP0(game(), { power: 0, deck: [vcard('d1', 2), vcard('d2', 3)], board: { aeroport: [hero('o', 'oswald', 2)] } })
    const after = resolveEffects(s, [{ type: 'PLAY_A_GAME', reveal: 2, reducerHeroCardId: 'oswald' }], { actorIndex: 0 })
    expect(after.players[0].power).toBe(4) // 5 − 1
  })

  it('Win Big : Une Petite Partie ? à ≥4 sur le lieu de la tuile la complète', () => {
    const goal: GoalToken = { kind: 'win-big', locationId: 'frontier-town', completed: false, revealed: false }
    const s = withP0(game(), { power: 0, pawnLocation: 'frontier-town', deck: [vcard('d1', 2), vcard('d2', 3)], goals: [goal] })
    const after = resolveEffects(s, [{ type: 'PLAY_A_GAME', reveal: 2 }], { actorIndex: 0 })
    expect(after.players[0].goals![0].completed).toBe(true)
  })

  it('Win Big : pas complétée si le gain < 4', () => {
    const goal: GoalToken = { kind: 'win-big', locationId: 'frontier-town', completed: false, revealed: false }
    const s = withP0(game(), { power: 0, pawnLocation: 'frontier-town', deck: [vcard('d1', 1), vcard('d2', 2)], goals: [goal] })
    const after = resolveEffects(s, [{ type: 'PLAY_A_GAME', reveal: 2 }], { actorIndex: 0 })
    expect(after.players[0].goals![0].completed).toBe(false)
  })

  it('Épuisé : perd la moitié arrondie à l’inférieur', () => {
    const s = withP0(game(), { power: 7 })
    const after = resolveEffects(s, [{ type: 'LOSE_HALF_POWER', roundUp: false }], { actorIndex: 0 })
    expect(after.players[0].power).toBe(4) // 7 − floor(3.5)=3
  })

  it('Planqués : défausse un Bandit du royaume', () => {
    const s = withP0(game(), { board: { ponton: [ally('b1', 3), item('i1')] } })
    const after = resolveEffects(s, [{ type: 'DISCARD_ALLY_BY_CARDID', cardId: 'bandit' }], { actorIndex: 0 })
    expect(after.players[0].board.ponton.map((c) => c.instanceId)).toEqual(['i1'])
    expect(after.players[0].discard.some((c) => c.instanceId === 'b1')).toBe(true)
  })

  it('Minnie : défausse l’Allié le plus fort', () => {
    const s = withP0(game(), { board: { ponton: [ally('b1', 2), ally('b2', 5), item('i1')] } })
    const after = resolveEffects(s, [{ type: 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM' }], { actorIndex: 0 })
    expect(after.players[0].discard.some((c) => c.instanceId === 'b2')).toBe(true)
    expect(after.players[0].board.ponton.map((c) => c.instanceId)).toEqual(['b1', 'i1'])
  })

  it('Hors-la-loi : perd jusqu’à 2 JT et révèle une tuile', () => {
    const goal: GoalToken = { kind: 'round-up', locationId: 'ponton', completed: false, revealed: false }
    const s = withP0(game(), { power: 1, goals: [goal] })
    const after = resolveEffects(s, [{ type: 'LOSE_POWER', amount: 2 }, { type: 'REVEAL_PETE_GOAL' }], { actorIndex: 0 })
    expect(after.players[0].power).toBe(0) // plancher 0
    expect(after.players[0].goals![0].revealed).toBe(true)
  })

  it('Assommé Bêtement : défausse les cartes de coût ≥ 2 des 5 révélées, garde les autres sur le dessus', () => {
    const s = withP0(game(), { deck: [vcard('a', 0), vcard('b', 3), vcard('c', 1), vcard('d', 2), vcard('e', 0), vcard('z', 5)] })
    const after = resolveEffects(s, [{ type: 'FATE_SCRY_DISCARD_BY_COST', count: 5, minCost: 2 }], { actorIndex: 0 })
    // b(3) et d(2) défaussés ; a,c,e (coût <2) remélangés sur le dessus ; z reste dessous.
    expect(after.players[0].discard.map((c) => c.instanceId).sort()).toEqual(['b', 'd'])
    expect(after.players[0].deck.map((c) => c.instanceId).slice(-1)).toEqual(['z'])
    expect(after.players[0].deck).toHaveLength(4) // a,c,e + z
    // Showcase animé émis : 5 cartes révélées, variante scry, flags de défausse =
    // (coût ≥ 2), ciblé sur la pioche de p0.
    const ev = after.showcaseEvents.at(-1)!
    expect(ev.reveal?.scry).toBe(true)
    expect(ev.playerIndex).toBe(0)
    expect(ev.reveal?.cardIds).toHaveLength(5)
    expect(ev.reveal?.costs).toEqual([0, 3, 1, 2, 0]) // ordre du dessus de la pioche (a,b,c,d,e)
    expect(ev.reveal?.discarded).toEqual([false, true, false, true, false])
  })

  it('Grillon suit le Héros joué (déplacé sur son lieu)', () => {
    const grillon: CardInstance = { instanceId: 'g', cardId: 'grillon', name: 'Grillon', type: 'ally', strength: 1, followsHeroes: true }
    const s = withP0(game(), { board: { ponton: [grillon], aeroport: [hero('h', 'donald', 3)] } })
    const after = triggerHeroArrival(s, 0, 'aeroport')
    expect(after.players[0].board.ponton).toHaveLength(0)
    expect(after.players[0].board.aeroport.some((c) => c.instanceId === 'g')).toBe(true)
  })
})
