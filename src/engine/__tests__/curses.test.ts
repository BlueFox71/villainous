import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { canPlaceCurseAt, effectiveCost, effectiveStrength, heroPlacementLocations, movableCards } from '../rules'
import type { CardInstance, GameState } from '../types'
import { me, singleGame, twoPlayerGame, withActive } from './_helpers'
import { getCardDef } from '../../data/registry'

function curse(id: string, cardId: string, opts: Partial<CardInstance> = {}): CardInstance {
  return { instanceId: id, cardId, name: cardId, type: 'curse', ...opts }
}
function hero(id: string, cardId: string, strength: number, opts: Partial<CardInstance> = {}): CardInstance {
  return { instanceId: id, cardId, name: cardId, type: 'hero', strength, ...opts }
}
describe('E.3 — Restrictions de pose (Malédictions)', () => {
  it('Feu Infernal interdit la pose de tout Héros sur son lieu', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [curse('feu', 'feu-infernal', { placementRestriction: { type: 'no-heroes' } })],
      },
    })
    const robin = hero('p0f:robin', 'robin-des-bois', 5)
    const locs = heroPlacementLocations(s, robin, s.activePlayer)
    expect(locs).not.toContain('church')
    expect(locs).toContain('sherwood')
  })

  it('Forêt de Ronces : seuls les Héros de Force ≥4 peuvent y être posés', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          curse('forest', 'foret-ronces', { placementRestriction: { type: 'min-hero-strength', value: 4 } }),
        ],
      },
    })
    const fort = hero('p0f:fort', 'robin-des-bois', 5)
    const faible = hero('p0f:faible', 'bobby', 2)
    expect(heroPlacementLocations(s, fort, s.activePlayer)).toContain('church')
    expect(heroPlacementLocations(s, faible, s.activePlayer)).not.toContain('church')
  })

  it('Pimprenelle interdit la pose de toute Malédiction sur son lieu', () => {
    // Joueur 0 (actif) à Nottingham, va poser une curse depuis sa main.
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const c: CardInstance = {
      instanceId: 'p0:c1',
      cardId: 'foret-ronces',
      name: 'Forêt de Ronces',
      type: 'curse',
      cost: 0,
    }
    s = withActive(s, {
      power: 5,
      hand: [c],
      board: {
        ...me(s).board,
        // Pimprenelle sur 'church' chez le joueur 0 (peu importe d'où elle vient,
        // ce test isole la règle de pose).
        church: [hero('p0f:pim', 'pimprenelle', 4, { placementRestriction: { type: 'no-curses' } })],
      },
    })
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'p0:c1', to: 'church' }),
    ).toThrow(/Malédiction|Pimprenelle/)
    // Autre lieu OK.
    const ok = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'p0:c1', to: 'sherwood' })
    expect(me(ok).board['sherwood'].find((x) => x.instanceId === 'p0:c1')).toBeDefined()
  })
})

describe('E.4 — Passifs alliés Maléfique', () => {
  function ally(id: string, cardId: string, strength: number): CardInstance {
    const def = getCardDef(cardId)
    return { instanceId: id, cardId, name: cardId, type: 'ally', strength, selfStrengthMods: def?.selfStrengthMods, strengthMod: def?.strengthMod }
  }

  it('Créature Rieuse : +1 Force par Héros sur son lieu', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          ally('rieuse', 'creature-rieuse', 1),
          hero('h1', 'belle-marianne', 3),
          hero('h2', 'robin-des-bois', 5),
        ],
      },
    })
    // 1 (base) + 2 (héros) = 3.
    expect(effectiveStrength(s, s.activePlayer, 'rieuse')).toBe(3)
  })

  it('Sinistre Créature : +1 Force si une Malédiction est présente sur son lieu', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          ally('sin', 'sinistre-creature', 3),
          curse('feu', 'feu-infernal'),
        ],
        sherwood: [ally('sin2', 'sinistre-creature', 3)],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'sin')).toBe(4) // bonus
    expect(effectiveStrength(s, s.activePlayer, 'sin2')).toBe(3) // pas de curse → pas de bonus
  })

  it('Sinistre Créature : bonus +1 même s’il y a plusieurs Malédictions (binaire)', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          ally('sin', 'sinistre-creature', 3),
          curse('c1', 'feu-infernal'),
          curse('c2', 'foret-ronces'),
        ],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'sin')).toBe(4)
  })
})

describe('E.3 — Modificateur de force (Sommeil sans Rêves)', () => {
  it('-2 Force aux Héros sur le même lieu (plancher à 0)', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          curse('sommeil', 'sommeil-sans-reves', { strengthMod: { target: 'heroes-here', delta: -2 } }),
          hero('h1', 'robin-des-bois', 5),
        ],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'h1')).toBe(3)
  })
})

describe('E.6 — Cartes spéciales Maléfique', () => {
  function ally(id: string, cardId: string, strength: number): CardInstance {
    return { instanceId: id, cardId, name: cardId, type: 'ally', strength }
  }
  function item(id: string, cardId: string): CardInstance {
    return { instanceId: id, cardId, name: cardId, type: 'item' }
  }

  it('Bâton Magique : −1 sur Effets et Malédictions (lieu courant)', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const baton = item('baton', 'baton-magique')
    const eff: CardInstance = {
      instanceId: 'eff', cardId: 'magnifiques-taxes', name: 'Eff', type: 'effect', cost: 2,
    }
    const allyCard: CardInstance = {
      instanceId: 'a1', cardId: 'gardes-rhinoceros', name: 'GR', type: 'ally', cost: 3, strength: 4,
    }
    s = withActive(s, { hand: [], board: { ...me(s).board, nottingham: [baton] } })
    // Bâton réduit le coût de l'Événement (de 2 à 1).
    expect(effectiveCost(s, eff)).toBe(1)
    // ... mais pas celui de l'Allié.
    expect(effectiveCost(s, allyCard)).toBe(3)
  })

  it('Rouet : +(force−1) JT quand un Héros est éliminé sur son lieu', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 0,
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'creature-sauvage', 4),
          item('rouet', 'rouet'),
        ],
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    expect(me(s).power).toBe(2) // hero.strength - 1 = 2
  })

  it('Disparition : skipNextMove activé, SKIP_MOVE saute MOVE → ACTION', () => {
    let s = singleGame()
    s = withActive(s, { skipNextMove: true })
    s = applyAction(s, { type: 'SKIP_MOVE' })
    expect(s.phase).toBe('ACTION')
    expect(me(s).skipNextMove).toBe(false)
  })

  it('Disparition : SKIP_MOVE refusé sans le drapeau', () => {
    const s = singleGame()
    expect(() => applyAction(s, { type: 'SKIP_MOVE' })).toThrow()
  })

  it('Apparence de Dragon : INSTANT_VANQUISH_HERO_LE élimine un héros ≤3', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const dragon: CardInstance = {
      instanceId: 'd1',
      cardId: 'apparence-dragon',
      name: 'AD',
      type: 'effect',
      cost: 3,
      effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }],
    }
    s = withActive(s, {
      power: 3,
      hand: [dragon],
      board: { ...me(s).board, church: [hero('h1', 'belle-marianne', 3)] },
    })
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'd1',
      targetHeroId: 'h1',
    })
    expect(me(s).board['church'].find((c) => c.instanceId === 'h1')).toBeUndefined()
    expect(me(s).fateDiscard.find((c) => c.instanceId === 'h1')).toBeDefined()
  })

  it('Apparence de Dragon : refuse un héros > maxStrength', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const dragon: CardInstance = {
      instanceId: 'd1',
      cardId: 'apparence-dragon',
      name: 'AD',
      type: 'effect',
      cost: 3,
      effects: [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }],
    }
    s = withActive(s, {
      power: 3,
      hand: [dragon],
      board: { ...me(s).board, church: [hero('big', 'robin-des-bois', 5)] },
    })
    expect(() =>
      applyAction(s, {
        type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'd1', targetHeroId: 'big',
      }),
    ).toThrow(/force|maxStrength|3/)
  })
})

describe('E.5 — Héros Maléfique (onPlace)', () => {
  // Faux setup : joueur 0 actif, joueur 1 = "Maléfique" cible de la Fatalité.
  function targetWith(board: Record<string, CardInstance[]>, extraTarget: Partial<{ power: number; pawnLocation: string; locations: { id: string; name: string; actions: never[] }[]; fateDeck: CardInstance[] }> = {}) {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: { ...p.board, ...board },
              ...extraTarget,
            }
          : p,
      ),
    }
    return s
  }

  it('Pâquerette défausse Sommeil sans Rêves de son lieu', () => {
    let s = targetWith({
      church: [curse('sommeil', 'sommeil-sans-reves')],
    })
    const fauna: CardInstance = {
      instanceId: 'p1f:fauna',
      cardId: 'paquerette',
      name: 'Pâquerette',
      type: 'hero',
      strength: 2,
      onPlace: [{ type: 'DISCARD_CARDS_AT_HOST', cardId: 'sommeil-sans-reves' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [fauna, filler, ...p.fateDeck] } : p)),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:fauna', to: 'church' })
    const cell = s.players[1].board['church']
    expect(cell.find((c) => c.cardId === 'sommeil-sans-reves')).toBeUndefined()
    expect(cell.find((c) => c.instanceId === 'p1f:fauna')).toBeDefined()
  })

  it('Prince Philippe défausse tous les Alliés de son lieu', () => {
    const a1: CardInstance = { instanceId: 'p1:a1', cardId: 'creature-sauvage', name: 'CS', type: 'ally', strength: 4 }
    const a2: CardInstance = { instanceId: 'p1:a2', cardId: 'creature-rieuse', name: 'CR', type: 'ally', strength: 1 }
    let s = targetWith({ church: [a1, a2] })
    const philippe: CardInstance = {
      instanceId: 'p1f:ph',
      cardId: 'prince-philippe',
      name: 'Prince Philippe',
      type: 'hero',
      strength: 5,
      onPlace: [{ type: 'DISCARD_ALLIES_AT_HOST' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [philippe, filler, ...p.fateDeck] } : p)),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:ph', to: 'church' })
    const cell = s.players[1].board['church']
    expect(cell.find((c) => c.type === 'ally')).toBeUndefined()
    expect(s.players[1].discard.filter((c) => c.type === 'ally')).toHaveLength(2)
  })

  it('Prince Philippe + Forêt de Ronces : showcase défausse rouge des cartes retirées', () => {
    const a1: CardInstance = { instanceId: 'p1:a1', cardId: 'creature-sauvage', name: 'CS', type: 'ally', strength: 4 }
    const a2: CardInstance = { instanceId: 'p1:a2', cardId: 'creature-rieuse', name: 'CR', type: 'ally', strength: 1 }
    const foret = curse('p1:foret', 'foret-ronces', {
      placementRestriction: { type: 'min-hero-strength', value: 4 },
      discardWhen: { type: 'hero-played-here' },
    })
    let s = targetWith({ church: [a1, a2, foret] })
    const philippe: CardInstance = {
      instanceId: 'p1f:ph',
      cardId: 'prince-philippe',
      name: 'Prince Philippe',
      type: 'hero',
      strength: 5,
      onPlace: [{ type: 'DISCARD_ALLIES_AT_HOST' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [philippe, filler, ...p.fateDeck] } : p)),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:ph', to: 'church' })
    // Le lieu ne contient plus que le Héros.
    const cell = s.players[1].board['church']
    expect(cell.filter((c) => c.type === 'ally')).toHaveLength(0)
    expect(cell.find((c) => c.cardId === 'foret-ronces')).toBeUndefined()
    // Un showcase « défausse » rouge liste les 3 cartes retirées (2 alliés + curse),
    // côté propriétaire (joueur 1), distinct du showcase de pose du Héros.
    const discardEv = s.showcaseEvents.find((e) => e.discard)
    expect(discardEv).toBeDefined()
    expect(discardEv!.discard!.variant).toBe('red')
    expect(discardEv!.playerIndex).toBe(1)
    expect(discardEv!.discard!.cardIds).toHaveLength(3)
    expect(discardEv!.discard!.cardIds).toContain('foret-ronces')
    expect(discardEv!.discard!.cardIds.filter((id) => id === 'creature-sauvage' || id === 'creature-rieuse')).toHaveLength(2)
  })

  it('TEST_PLACE_FATE (mode test) inflige un Héros et déclenche le showcase défausse', () => {
    const s0 = singleGame()
    const a1: CardInstance = { instanceId: 'p0:a1', cardId: 'gardes-rhinoceros', name: 'GR', type: 'ally', strength: 3 }
    const foret = curse('p0:foret', 'foret-ronces', {
      placementRestriction: { type: 'min-hero-strength', value: 4 },
      discardWhen: { type: 'hero-played-here' },
    })
    const s = withActive(s0, { board: { ...me(s0).board, church: [a1, foret] } })
    const philippe: CardInstance = {
      instanceId: 'test:ph',
      cardId: 'prince-philippe',
      name: 'Prince Philippe',
      type: 'hero',
      strength: 5,
      onPlace: [{ type: 'DISCARD_ALLIES_AT_HOST' }],
    }
    const next = applyAction(s, { type: 'TEST_PLACE_FATE', card: philippe, to: 'church' })
    const cell = next.players[0].board['church']
    expect(cell.find((c) => c.instanceId === 'test:ph')).toBeDefined()
    expect(cell.some((c) => c.type === 'ally')).toBe(false)
    expect(cell.find((c) => c.cardId === 'foret-ronces')).toBeUndefined()
    const ev = next.showcaseEvents.find((e) => e.discard)
    expect(ev?.discard?.variant).toBe('red')
    expect(ev?.discard?.cardIds).toContain('foret-ronces')
  })

  it('TEST_PLAY_CONDITION (mode test) joue une Condition en contournant le déclencheur', () => {
    const s0 = singleGame()
    const before = s0.players[0].power
    const avarice: CardInstance = { instanceId: 'test:av', cardId: 'avarice', name: 'Avarice', type: 'condition' }
    const next = applyAction(s0, { type: 'TEST_PLAY_CONDITION', card: avarice })
    expect(next.players[0].power).toBe(before + 3)
    expect(next.showcaseEvents.some((e) => e.cardId === 'avarice')).toBe(true)
  })

  it('Roi Hubert attire un Allié de chaque lieu voisin', () => {
    const a1: CardInstance = { instanceId: 'p1:s1', cardId: 'creature-sauvage', name: 'CS1', type: 'ally', strength: 4 }
    const a2: CardInstance = { instanceId: 'p1:s2', cardId: 'creature-sauvage', name: 'CS2', type: 'ally', strength: 4 }
    // Cible a 1 allié à Sherwood (voisin de Église chez PJ) et 1 à Nottingham (autre voisin de Église).
    let s = targetWith({
      sherwood: [a1],
      nottingham: [a2],
    })
    const hubert: CardInstance = {
      instanceId: 'p1f:hubert',
      cardId: 'roi-hubert',
      name: 'Roi Hubert',
      type: 'hero',
      strength: 3,
      onPlace: [{ type: 'PULL_ALLY_FROM_EACH_ADJACENT' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [hubert, filler, ...p.fateDeck] } : p)),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:hubert', to: 'church' })
    // Le déplacement est AU CHOIX du joueur (pendingHubertPull), pas encore appliqué.
    expect(s.pendingHubertPull).toEqual({ chooserIndex: 0, targetIndex: 1, dest: 'church' })
    expect(s.players[1].board['church'].filter((c) => c.type === 'ally')).toHaveLength(0)
    // Le joueur choisit un Allié de chaque lieu voisin → ils rejoignent Église.
    s = applyAction(s, { type: 'RESOLVE_HUBERT_PULL', allyInstanceIds: ['p1:s1', 'p1:s2'] })
    expect(s.pendingHubertPull).toBeUndefined()
    expect(s.players[1].board['church'].filter((c) => c.type === 'ally')).toHaveLength(2)
    expect(s.players[1].board['sherwood']).toHaveLength(0)
    expect(s.players[1].board['nottingham']).toHaveLength(0)
  })

  it('Roi Hubert : un seul Allié par lieu voisin (refus si deux du même lieu)', () => {
    const a1: CardInstance = { instanceId: 'p1:s1', cardId: 'creature-sauvage', name: 'CS1', type: 'ally', strength: 4 }
    const a2: CardInstance = { instanceId: 'p1:s2', cardId: 'creature-sauvage', name: 'CS2', type: 'ally', strength: 4 }
    let s = targetWith({ sherwood: [a1, a2] })
    const hubert: CardInstance = {
      instanceId: 'p1f:hubert', cardId: 'roi-hubert', name: 'Roi Hubert', type: 'hero', strength: 3,
      onPlace: [{ type: 'PULL_ALLY_FROM_EACH_ADJACENT' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [hubert, filler, ...p.fateDeck] } : p)) }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:hubert', to: 'church' })
    expect(() =>
      applyAction(s, { type: 'RESOLVE_HUBERT_PULL', allyInstanceIds: ['p1:s1', 'p1:s2'] }),
    ).toThrow(/un seul Allié/i)
  })

  it('Roi Stéphane : le déplacement du pion est AU CHOIX du joueur (pendingPawnMove)', () => {
    let s = targetWith({
      jail: [curse('c1', 'feu-infernal', { discardWhen: { type: 'pawn-moves-here' } })],
    })
    const stephane: CardInstance = {
      instanceId: 'p1f:stephane',
      cardId: 'roi-stephane',
      name: 'Roi Stéphane',
      type: 'hero',
      strength: 4,
      onPlace: [{ type: 'MOVE_OWNER_PAWN_FORCED' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, pawnLocation: 'sherwood', fateDeck: [stephane, filler, ...p.fateDeck] } : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:stephane', to: 'church' })
    // Déplacement en attente : c'est le joueur 0 (Fatalité) qui choisit, pion non bougé.
    expect(s.pendingPawnMove).toEqual({ chooserIndex: 0, targetIndex: 1 })
    expect(s.players[1].pawnLocation).toBe('sherwood')
    // Le joueur choisit 'jail' → pion déplacé + Feu Infernal défaussé (pawn-moves-here).
    s = applyAction(s, { type: 'RESOLVE_PAWN_MOVE', locationId: 'jail' })
    expect(s.pendingPawnMove).toBeUndefined()
    expect(s.players[1].pawnLocation).toBe('jail')
    expect(s.players[1].board['jail'].find((c) => c.cardId === 'feu-infernal')).toBeUndefined()
  })

  it('Roi Stéphane : le joueur peut choisir de NE PAS déplacer le pion', () => {
    let s = targetWith({})
    const stephane: CardInstance = {
      instanceId: 'p1f:stephane', cardId: 'roi-stephane', name: 'Roi Stéphane', type: 'hero',
      strength: 4, onPlace: [{ type: 'MOVE_OWNER_PAWN_FORCED' }],
    }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, pawnLocation: 'sherwood', fateDeck: [stephane, filler, ...p.fateDeck] } : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:stephane', to: 'church' })
    s = applyAction(s, { type: 'RESOLVE_PAWN_MOVE', locationId: null })
    expect(s.pendingPawnMove).toBeUndefined()
    expect(s.players[1].pawnLocation).toBe('sherwood')
  })
})

describe('Malédiction = Objet : empilable et déplaçable', () => {
  it('canPlaceCurseAt autorise une 2ᵉ Malédiction sur un lieu déjà maudit', () => {
    const s0 = singleGame()
    const s = withActive(s0, { board: { ...me(s0).board, church: [curse('c1', 'feu-infernal')] } })
    expect(canPlaceCurseAt(s, s.activePlayer, 'church')).toBe(true)
  })

  it('Forêt de Ronces / Feu Infernal : posables même sur un lieu portant déjà un Héros (la restriction ne vise que les Héros joués ENSUITE)', () => {
    const s0 = singleGame()
    // Héros faible (force 2 < 4) déjà sur church → la Malédiction reste posable.
    const weak = withActive(s0, { board: { ...me(s0).board, church: [hero('h1', 'aurore', 2)] } })
    expect(canPlaceCurseAt(weak, weak.activePlayer, 'church')).toBe(true)
    // Héros fort (force 5 ≥ 4) → posable aussi.
    const strong = withActive(s0, { board: { ...me(s0).board, church: [hero('h2', 'robin-des-bois', 5)] } })
    expect(canPlaceCurseAt(strong, strong.activePlayer, 'church')).toBe(true)
  })

  it('on peut poser plusieurs Malédictions sur le même lieu (PLAY_CARD)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const c2: CardInstance = { instanceId: 'p0:c2', cardId: 'feu-infernal', name: 'Feu', type: 'curse', cost: 0 }
    s = withActive(s, {
      power: 5,
      hand: [c2],
      board: { ...me(s).board, church: [curse('p0:c1', 'foret-ronces')] },
    })
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'p0:c2', to: 'church' })
    expect(me(s).board['church'].filter((c) => c.type === 'curse')).toHaveLength(2)
  })

  it('une Malédiction est déplaçable comme un Objet (movableCards + MOVE_CARD)', () => {
    // Pion à l'Église (action « Déplacer » dispo) ; une Malédiction y est posée.
    let s = applyAction(singleGame(), { type: 'MOVE', to: 'church' })
    s = withActive(s, { board: { ...me(s).board, church: [curse('c1', 'feu-infernal')] } })
    expect(movableCards(s).some((m) => m.instanceId === 'c1')).toBe(true)
    s = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'c1', to: 'sherwood' })
    expect(me(s).board['church'].find((c) => c.instanceId === 'c1')).toBeUndefined()
    expect(me(s).board['sherwood'].find((c) => c.instanceId === 'c1')).toBeDefined()
  })
})

describe('Fatalité non plaçable : défausse au lieu de planter', () => {
  function fateWith(p1Patch: (p: GameState['players'][number]) => GameState['players'][number]): GameState {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? p1Patch(p) : p)) }
    return applyAction(s, { type: 'FATE', actionId: 'fate' })
  }

  it('Épée de Vérité : défaussée si tous les Héros ont déjà un Objet (aucun éligible)', () => {
    const heroWithItem = hero('p1:h', 'robin-des-bois', 5)
    const existingItem: CardInstance = { instanceId: 'p1:it', cardId: 'rouet', name: 'Rouet', type: 'item', attachedTo: 'p1:h' }
    const epee: CardInstance = { instanceId: 'p1f:epee', cardId: 'epee-verite', name: 'Épée', type: 'item', attach: 'hero' }
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    const s = fateWith((p) => ({
      ...p,
      board: { ...p.board, church: [heroWithItem, existingItem] },
      fateDeck: [epee, filler, ...p.fateDeck],
    }))
    expect(() => applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:epee' })).not.toThrow()
    const after = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:epee' })
    expect(after.players[1].fateDiscard.find((c) => c.cardId === 'epee-verite')).toBeDefined()
    expect(after.pendingFate).toBeNull()
  })

  it('Héros fatalisé sans lieu légal (toutes les cases no-heroes) : défaussé', () => {
    const gardes = hero('p1f:g', 'gardes-chateau', 3)
    const filler: CardInstance = { instanceId: 'p1f:f', cardId: 'voler-riches', name: 'V', type: 'effect' }
    const s = fateWith((p) => {
      const blocked: Record<string, CardInstance[]> = {}
      for (const loc of p.locations) {
        blocked[loc.id] = [curse(`b-${loc.id}`, 'feu-infernal', { placementRestriction: { type: 'no-heroes' } })]
      }
      return { ...p, board: { ...p.board, ...blocked }, fateDeck: [gardes, filler, ...p.fateDeck] }
    })
    expect(() => applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:g' })).not.toThrow()
    const after = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:g' })
    expect(after.players[1].fateDiscard.find((c) => c.cardId === 'gardes-chateau')).toBeDefined()
    expect(after.pendingFate).toBeNull()
  })
})

describe('E.3 — Défausse automatique (Curse Discard Triggers)', () => {
  function placeAt(loc: string, cards: CardInstance[]): GameState {
    const s0 = singleGame()
    return withActive(s0, { power: 5, board: { ...me(s0).board, [loc]: cards } })
  }

  it('Sommeil sans Rêves se défausse quand un Allié arrive sur le même lieu', () => {
    let s = placeAt('church', [
      curse('sommeil', 'sommeil-sans-reves', { discardWhen: { type: 'ally-played-here' } }),
    ])
    s = withActive(s, {
      hand: [{ instanceId: 'p0:a', cardId: 'gardes-rhinoceros', name: 'GR', type: 'ally', cost: 3, strength: 4 }],
    })
    // Doit poser l'allié à l'Église → Sommeil disparaît.
    s = applyAction(s, { type: 'MOVE', to: 'nottingham' })
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'p0:a', to: 'church' })
    const cell = me(s).board['church']
    expect(cell.find((c) => c.cardId === 'sommeil-sans-reves')).toBeUndefined()
    expect(cell.find((c) => c.instanceId === 'p0:a')).toBeDefined()
    expect(me(s).discard.find((c) => c.cardId === 'sommeil-sans-reves')).toBeDefined()
    // Un showcase « défausse » de la Malédiction est toujours émis.
    expect(s.showcaseEvents.at(-1)?.discard?.cardIds).toContain('sommeil-sans-reves')
  })

  it('Feu Infernal se défausse quand le pion arrive sur le lieu', () => {
    let s = placeAt('church', [
      curse('feu', 'feu-infernal', { discardWhen: { type: 'pawn-moves-here' } }),
    ])
    // Le pion démarre à Sherwood ; MOVE vers Church → Feu disparaît.
    s = applyAction(s, { type: 'MOVE', to: 'church' })
    expect(me(s).board['church'].find((c) => c.cardId === 'feu-infernal')).toBeUndefined()
    expect(me(s).discard.find((c) => c.cardId === 'feu-infernal')).toBeDefined()
    // Un showcase « défausse » de la Malédiction est toujours émis.
    expect(s.showcaseEvents.at(-1)?.discard?.cardIds).toContain('feu-infernal')
  })

  it('Forêt de Ronces se défausse quand un Héros arrive sur le lieu (via Fatalité)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    // Joueur 1 a une Forêt de Ronces sur Église ; on poste Robin (force 5 → autorisé).
    const robin: CardInstance = {
      instanceId: 'p1f:robin',
      cardId: 'robin-des-bois',
      name: 'Robin',
      type: 'hero',
      strength: 5,
    }
    const otherCard: CardInstance = {
      instanceId: 'p1f:other',
      cardId: 'voler-riches',
      name: 'Voler',
      type: 'effect',
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: {
                ...p.board,
                church: [
                  curse('foret', 'foret-ronces', {
                    placementRestriction: { type: 'min-hero-strength', value: 4 },
                    discardWhen: { type: 'hero-played-here' },
                  }),
                ],
              },
              fateDeck: [robin, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:robin', to: 'church' })
    expect(s.players[1].board['church'].find((c) => c.cardId === 'foret-ronces')).toBeUndefined()
    expect(s.players[1].board['church'].find((c) => c.instanceId === 'p1f:robin')).toBeDefined()
  })
})
