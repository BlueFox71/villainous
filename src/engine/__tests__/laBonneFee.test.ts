import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { resolveEffects } from '../effects'
import { effectiveStrength, kissAtBallConditionMet, activatableCards } from '../rules'
import { createInitialGame } from '../state'
import { buildDeckInstances } from '../../data/types'
import { laBonneFee } from '../../data/villains/la-bonne-fee'
import { laBonneFeeCards } from '../../data/villains/la-bonne-fee.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { chooseAction, pickBestPendingAction } from '../../ai/heuristicBot'
import type { CardInstance, GameState } from '../types'
import { me, withActive } from './_helpers'

const seededRand = (seed: number): (() => number) => {
  let x = seed >>> 0
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0
    return x / 0xffffffff
  }
}

const lbfGame = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: laBonneFee,
        deckCards: buildDeckInstances(laBonneFeeCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(laBonneFeeCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

const hero = (id: string, cardId: string, strength: number, extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: id, cardId, name: cardId, type: 'hero', strength, ...extra,
})
const item = (id: string, cardId: string, host: string | undefined, extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: id, cardId, name: cardId, type: 'item', attach: 'hero', attachedTo: host, ...extra,
})
const ally = (id: string, cardId: string, strength: number): CardInstance => ({
  instanceId: id, cardId, name: cardId, type: 'ally', strength,
})

// Met en place une Salle de Bal gagnante (Fiona + 2 potions + Prince Charmant).
function winningBallroom(): CardInstance[] {
  return [
    hero('fi', 'fiona', 3),
    item('p1', 'filtre', 'fi', { zeroesHostStrength: false }),
    item('p2', 'heureux', 'fi'),
    ally('pr', 'prince', 3),
  ]
}

describe('La Bonne Fée — transformation (force → 0)', () => {
  it('un Héros portant Meuble/Colombe a une force EFFECTIVE de 0', () => {
    const g = lbfGame()
    const s = withActive(g, {
      board: {
        ...me(g).board,
        marais: [hero('h', 'shrek', 5), item('m', 'meuble', 'h', { zeroesHostStrength: true })],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'h')).toBe(0)
  })

  it('Nettoyage de fond défausse les Héros transformés (et leurs Objets)', () => {
    const g = lbfGame()
    let s = withActive(g, {
      board: {
        ...me(g).board,
        marais: [hero('h', 'shrek', 5), item('m', 'meuble', 'h', { zeroesHostStrength: true })],
        'pomme-empoisonnee': [hero('h2', 'chat', 4)], // non transformé → reste
      },
    })
    s = resolveEffects(s, [{ type: 'DISCARD_TRANSFORMED_HEROES' }], { actorIndex: s.activePlayer })
    const p = me(s)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'h')).toBe(false)
    expect(p.fateDiscard.map((c) => c.cardId)).toContain('shrek')
    expect(p.fateDiscard.map((c) => c.cardId)).toContain('meuble')
    // Le Héros non transformé reste sur le plateau.
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'h2')).toBe(true)
  })
})

describe('La Bonne Fée — objectif KISS_AT_BALL', () => {
  it('réuni quand Prince + Fiona (2 potions) sont au bal, sans Shrek', () => {
    const g = lbfGame()
    const s = withActive(g, { board: { ...me(g).board, 'salle-de-bal': winningBallroom() } })
    expect(kissAtBallConditionMet(s, s.activePlayer)).toBe(true)
  })

  it('non réuni s’il manque une potion', () => {
    const g = lbfGame()
    const s = withActive(g, {
      board: { ...me(g).board, 'salle-de-bal': [hero('fi', 'fiona', 3), item('p1', 'filtre', 'fi'), ally('pr', 'prince', 3)] },
    })
    expect(kissAtBallConditionMet(s, s.activePlayer)).toBe(false)
  })

  it('bloqué tant que Shrek est dans le royaume', () => {
    const g = lbfGame()
    const s = withActive(g, {
      board: {
        ...me(g).board,
        'salle-de-bal': winningBallroom(),
        marais: [hero('sh', 'shrek', 5)],
      },
    })
    expect(kissAtBallConditionMet(s, s.activePlayer)).toBe(false)
  })

  it('« Embrasse-la » est activable et déclenche la victoire quand le bal est prêt', () => {
    let s = applyAction(lbfGame(), { type: 'MOVE', to: 'salle-de-bal' })
    s = withActive(s, {
      power: 2,
      board: {
        ...me(s).board,
        'salle-de-bal': [...winningBallroom(), item('emb', 'embrasser', undefined, { attach: undefined, activatedCost: 0 })],
      },
    })
    expect(activatableCards(s).some((c) => c.cardId === 'embrasser')).toBe(true)
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'emb' })
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('« Embrasse-la » n’est PAS activable si le bal n’est pas prêt', () => {
    let s = applyAction(lbfGame(), { type: 'MOVE', to: 'salle-de-bal' })
    s = withActive(s, {
      power: 2,
      board: {
        ...me(s).board,
        'salle-de-bal': [hero('fi', 'fiona', 3), ally('pr', 'prince', 3), item('emb', 'embrasser', undefined, { attach: undefined, activatedCost: 0 })],
      },
    })
    expect(activatableCards(s).some((c) => c.cardId === 'embrasser')).toBe(false)
    expect(() => applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'emb' })).toThrow()
  })
})

describe('La Bonne Fée — blocages & surcoûts', () => {
  it('Humainement beau empêche d’associer « Héros en Meuble ! » à son hôte', () => {
    let s = applyAction(lbfGame(), { type: 'MOVE', to: 'usine-potions' })
    s = withActive(s, {
      power: 5,
      hand: [{ instanceId: 'm', cardId: 'meuble', name: 'Meuble', type: 'item', cost: 2, attach: 'hero', zeroesHostStrength: true }],
      board: {
        ...me(s).board,
        'usine-potions': [hero('h', 'shrek', 5), item('hb', 'humain', 'h', { protectsHostFromCardIds: ['meuble'] })],
      },
    })
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'm', to: 'usine-potions', attachTo: 'h' }),
    ).toThrow()
  })

  it('Harold & Lillian interdisent de jouer un Objet sur leur lieu', () => {
    let s = applyAction(lbfGame(), { type: 'MOVE', to: 'usine-potions' })
    s = withActive(s, {
      power: 5,
      hand: [{ instanceId: 'bg', cardId: 'baguette', name: 'Baguette', type: 'item', cost: 1 }],
      board: { ...me(s).board, 'usine-potions': [hero('pa', 'parents', 2, { blocksAllItemsHere: true })] },
    })
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'bg', to: 'usine-potions' }),
    ).toThrow()
  })

  it('l’Âne renchérit de 1 le coût d’activation sur son lieu', () => {
    // Salle de Bal : l'action Activer est en BAS (non recouverte par un Héros présent).
    const prince: CardInstance = {
      instanceId: 'pr', cardId: 'prince', name: 'Prince Charmant', type: 'ally', strength: 3,
      activatedCost: 0, activatedEffects: [{ type: 'GAIN_POWER', amount: 2 }],
    }
    const setup = (power: number): GameState => {
      const s = applyAction(lbfGame(), { type: 'MOVE', to: 'salle-de-bal' })
      return withActive(s, {
        power,
        board: { ...me(s).board, 'salle-de-bal': [prince, hero('an', 'ane', 3, { activateCostSurchargeHere: 1 })] },
      })
    }
    // Coût d'activation 0 + 1 (l'Âne) → injouable à 0 Pouvoir.
    expect(() => applyAction(setup(0), { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'pr' })).toThrow()
    // Avec 1 Pouvoir : on paie le surcoût (1), puis Prince gagne 2 → 0 − 1 + 2 = 1.
    const after = applyAction(setup(1), { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'pr' })
    expect(me(after).power).toBe(2)
  })
})

describe('La Bonne Fée — effets inédits divers', () => {
  it('Réserve de potions récupère une Potion de la défausse → main', () => {
    const g = lbfGame()
    const potion: CardInstance = { instanceId: 'po', cardId: 'filtre', name: 'Filtre', type: 'item', isPotion: true }
    const s = withActive(g, { discard: [potion] })
    const after = resolveEffects(s, [{ type: 'FETCH_POTION' }], { actorIndex: s.activePlayer })
    expect(me(after).hand.some((c) => c.cardId === 'filtre')).toBe(true)
    expect(me(after).discard.some((c) => c.cardId === 'filtre')).toBe(false)
  })

  it('Infiltration : main vide → perte de Pouvoir automatique (cas forcé)', () => {
    const g = lbfGame()
    const s = withActive(g, { power: 5, hand: [] })
    const after = resolveEffects(s, [{ type: 'DISCARD_ONE_OR_LOSE', lose: 3 }], { actorIndex: s.activePlayer })
    expect(me(after).power).toBe(2)
    expect(after.pendingInfiltration ?? null).toBeNull()
  })

  it('Infiltration : main non vide → ouvre le choix interactif (cible)', () => {
    const g = lbfGame()
    const c: CardInstance = { instanceId: 'x', cardId: 'as', name: 'As', type: 'effect', cost: 0 }
    const s = withActive(g, { power: 5, hand: [c] })
    const after = resolveEffects(s, [{ type: 'DISCARD_ONE_OR_LOSE', lose: 3 }], { actorIndex: s.activePlayer })
    expect(after.pendingInfiltration).toEqual({ playerIndex: s.activePlayer, lose: 3 })
  })

  it('Infiltration : choix « perdre du Pouvoir » garde la main', () => {
    const g = lbfGame()
    const c: CardInstance = { instanceId: 'x', cardId: 'as', name: 'As', type: 'effect', cost: 0 }
    const s = withActive(g, { power: 5, hand: [c] })
    const opened = resolveEffects(s, [{ type: 'DISCARD_ONE_OR_LOSE', lose: 3 }], { actorIndex: s.activePlayer })
    const after = applyAction(opened, { type: 'RESOLVE_INFILTRATION', choice: 'lose' })
    expect(me(after).power).toBe(2)
    expect(me(after).hand).toHaveLength(1)
    expect(after.pendingInfiltration ?? null).toBeNull()
  })

  it('Infiltration : choix « défausser une carte » garde le Pouvoir', () => {
    const g = lbfGame()
    const c: CardInstance = { instanceId: 'x', cardId: 'as', name: 'As', type: 'effect', cost: 0 }
    const s = withActive(g, { power: 1, hand: [c] })
    const opened = resolveEffects(s, [{ type: 'DISCARD_ONE_OR_LOSE', lose: 3 }], { actorIndex: s.activePlayer })
    const after = applyAction(opened, { type: 'RESOLVE_INFILTRATION', choice: 'discard', instanceId: 'x' })
    expect(me(after).power).toBe(1)
    expect(me(after).hand).toHaveLength(0)
    expect(me(after).discard.some((d) => d.instanceId === 'x')).toBe(true)
    expect(after.pendingInfiltration ?? null).toBeNull()
  })

  it('Tasses rééchangées (Fatalité) : c’est le fataliseur qui déplace le Héros', () => {
    // 2 joueurs : LBF (cible, p0) avec un Héros ; le Prince Jean (p1) pose la Fatalité.
    let s = createInitialGame(
      [
        {
          villain: laBonneFee,
          deckCards: buildDeckInstances(laBonneFeeCards, 'villain', 'p0:'),
          fateCards: buildDeckInstances(laBonneFeeCards, 'fate', 'p0f:'),
        },
        {
          villain: princeJohn,
          deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'),
          fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:'),
        },
      ],
      7,
    )
    const loc0 = s.players[0].locations[0].id
    s = {
      ...s,
      activePlayer: 1,
      players: [
        { ...s.players[0], board: { ...s.players[0].board, [loc0]: [hero('h', 'shrek', 5)] } },
        s.players[1],
      ],
    }
    const tasses = s.players[0].fateDeck.find((c) => c.cardId === 'tasses')!
    s = { ...s, pendingFate: { target: 0, revealed: [tasses] } as never }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: tasses.instanceId })
    expect(s.pendingHeroRelocate).toMatchObject({ chooserIndex: 1, targetIndex: 0 })
  })

  it('On est presque arrivé ? : plafonne le prochain tour à 2 actions', () => {
    const g = lbfGame()
    const after = resolveEffects(g, [{ type: 'CAP_SELF_NEXT_TURN', actions: 2 }], { actorIndex: g.activePlayer })
    expect(me(after).actionsCapNextTurn).toBe(2)
  })
})

describe('La Bonne Fée — IA', () => {
  it('déplacement de Héros : le bot envoie Fiona en Salle de Bal (aucune action recouverte)', () => {
    let s = createInitialGame(
      [
        { villain: laBonneFee, deckCards: buildDeckInstances(laBonneFeeCards, 'villain', 'p0:'), fateCards: buildDeckInstances(laBonneFeeCards, 'fate', 'p0f:') },
        { villain: { ...princeJohn, name: 'PJ' }, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      7,
    )
    // Fiona à l'Usine de Potions : voisins = La Pomme Empoisonnée (2 actions en haut,
    // recouvertes) et Salle de Bal (rangée du haut vide + lieu de l'objectif).
    s = {
      ...s,
      players: [
        { ...s.players[0], board: { ...s.players[0].board, 'usine-potions': [hero('f', 'fiona', 3)] } },
        s.players[1],
      ],
      pendingHeroRelocate: { chooserIndex: 0, targetIndex: 0 } as never,
    }
    const best = pickBestPendingAction(s, 0)
    expect(best).toMatchObject({ type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'f', to: 'salle-de-bal' })
  })

  it('le bot joue La Bonne Fée sans blocage ni exception sur plusieurs tours', () => {
    let s = createInitialGame(
      [
        { villain: laBonneFee, deckCards: buildDeckInstances(laBonneFeeCards, 'villain', 'p0:'), fateCards: buildDeckInstances(laBonneFeeCards, 'fate', 'p0f:') },
        { villain: { ...princeJohn, name: 'PJ' }, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      42,
    )
    const rand = seededRand(123)
    let steps = 0
    while (s.status === 'PLAYING' && steps < 400) {
      s = applyAction(s, chooseAction(s, rand))
      steps++
    }
    expect(s.turn).toBeGreaterThan(3)
  })
})
