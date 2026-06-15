import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { countHeroesInRealm, resolveEffects } from '../effects'
import { princeJohnCardById } from '../../data/villains/princeJohn.cards'
import type { CardInstance, GameState } from '../types'
import { me, singleGame, withActive } from './_helpers'

/** Fabrique un exemplaire jouable à partir d'une définition de carte. */
function inst(cardId: string, n = 1): CardInstance {
  const c = princeJohnCardById[cardId]
  return {
    instanceId: `${cardId}#${n}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    attach: c.attach,
    effects: c.effects,
  }
}

/** Pion sur un lieu (phase ACTION) avec une main et un pouvoir contrôlés. */
function atLocation(locId: string, hand: CardInstance[], power: number): GameState {
  const s = applyAction(singleGame(7), { type: 'MOVE', to: locId })
  return withActive(s, { hand, power })
}

/** Ajoute un Héros (Petit Jean, sans effet spécial) au royaume du joueur actif —
 *  utile pour rendre « Magnifiques Taxes » jouable (exige ≥ 1 Héros). */
function withHero(s: GameState, locId: string, n = 1): GameState {
  const c = princeJohnCardById['petit-jean']
  const hero: CardInstance = {
    instanceId: `petit-jean#${n}`,
    cardId: 'petit-jean',
    name: c.name,
    type: 'hero',
    strength: c.strength,
  }
  const board = me(s).board
  return withActive(s, { board: { ...board, [locId]: [...(board[locId] ?? []), hero] } })
}

// `to` par défaut = lieu courant du joueur actif (cas le plus fréquent en test).
const play = (
  s: GameState,
  actionId: string,
  c: CardInstance,
  opts: { to?: string; attachTo?: string } = {},
) =>
  applyAction(s, {
    type: 'PLAY_CARD',
    actionId,
    instanceId: c.instanceId,
    to: opts.to ?? s.players[s.activePlayer].pawnLocation ?? undefined,
    attachTo: opts.attachTo,
  })

describe('jouer une carte', () => {
  it('un Allié est posé sur le lieu et son coût est payé', () => {
    const ally = inst('gardes-rhinoceros') // coût 3
    let s = atLocation('jail', [ally], 5)
    s = play(s, 'play-card', ally)
    expect(me(s).power).toBe(2)
    expect(me(s).hand).toHaveLength(0)
    expect(me(s).board['jail'].map((c) => c.cardId)).toContain('gardes-rhinoceros')
    expect(s.usedActionIds).toContain('play-card')
  })

  it('un Événement est défaussé et ses effets sont résolus', () => {
    const taxes = inst('magnifiques-taxes') // coût 0, +1/héros
    let s = atLocation('jail', [taxes], 0)
    s = withHero(s, 'nottingham') // 1 Héros au royaume → +1 JT
    s = play(s, 'play-card', taxes)
    expect(me(s).discard.map((c) => c.cardId)).toContain('magnifiques-taxes')
    expect(me(s).board['jail']).toHaveLength(0)
    expect(me(s).power).toBe(1)
  })

  it('pouvoir insuffisant : refusé', () => {
    const ally = inst('gardes-rhinoceros') // coût 3
    const s = atLocation('jail', [ally], 2)
    expect(() => play(s, 'play-card', ally)).toThrow()
  })

  it('une Condition ne peut pas être jouée à son propre tour', () => {
    const greed = inst('avarice')
    const s = atLocation('jail', [greed], 5)
    expect(() => play(s, 'play-card', greed)).toThrow()
  })

  it('une action Jouer une carte ne sert qu’une fois par tour', () => {
    const a = inst('magnifiques-taxes', 1)
    const b = inst('magnifiques-taxes', 2)
    let s = atLocation('jail', [a, b], 0)
    s = withHero(s, 'nottingham') // rend « Magnifiques Taxes » jouable
    s = play(s, 'play-card', a)
    expect(() => play(s, 'play-card', b)).toThrow()
  })

  it('jouer via une action qui n’est pas « Jouer une carte » est refusé', () => {
    const a = inst('magnifiques-taxes')
    const s = atLocation('jail', [a], 0)
    expect(() => play(s, 'gain-power', a)).toThrow()
  })

  it("l'Église a deux actions « Jouer une carte » → on peut jouer deux cartes", () => {
    const a = inst('magnifiques-taxes', 1)
    const b = inst('magnifiques-taxes', 2)
    let s = atLocation('church', [a, b], 0)
    s = withHero(s, 'nottingham') // rend « Magnifiques Taxes » jouable
    s = play(s, 'play-card-top', a)
    s = play(s, 'play-card-bottom', b)
    expect(me(s).discard).toHaveLength(2)
  })
})

describe('poser sur n’importe quel lieu (pas seulement le lieu courant)', () => {
  it('un Allié peut être posé sur un AUTRE lieu que celui du pion', () => {
    const ally = inst('gardes-rhinoceros') // coût 3
    let s = atLocation('jail', [ally], 5) // pion sur la Prison
    s = play(s, 'play-card', ally, { to: 'nottingham' })
    expect(me(s).board['nottingham'].map((c) => c.cardId)).toContain('gardes-rhinoceros')
    expect(me(s).board['jail']).toHaveLength(0)
  })

  it('poser sur un lieu inexistant est refusé', () => {
    const ally = inst('gardes-rhinoceros')
    const s = atLocation('jail', [ally], 5)
    expect(() => play(s, 'play-card', ally, { to: 'mordor' })).toThrow()
  })

  it('un Objet à associer se pose sur un lieu distant si l’Allié y est', () => {
    const a = inst('gardes-rhinoceros')
    const o = inst('arc-fleches') // coût 1
    let s = atLocation('jail', [o], 3) // pion sur la Prison
    s = withActive(s, { board: { ...me(s).board, nottingham: [a] } }) // Allié à Nottingham
    s = play(s, 'play-card', o, { to: 'nottingham', attachTo: a.instanceId })
    const placed = me(s).board['nottingham'].find((c) => c.cardId === 'arc-fleches')
    expect(placed?.attachedTo).toBe(a.instanceId)
    expect(me(s).board['jail']).toHaveLength(0)
  })
})

describe('associer un Objet à un Allié', () => {
  const bow = () => inst('arc-fleches') // Objet attach:'ally', coût 1
  const ally = () => inst('gardes-rhinoceros') // Allié

  it('un Objet « à associer » est posé sur le lieu avec un lien attachedTo', () => {
    const a = ally()
    const o = bow()
    let s = atLocation('jail', [o], 3)
    s = withActive(s, { board: { ...me(s).board, jail: [a] } })
    s = play(s, 'play-card', o, { attachTo: a.instanceId })
    const placed = me(s).board['jail'].find((c) => c.cardId === 'arc-fleches')
    expect(placed?.attachedTo).toBe(a.instanceId)
    expect(me(s).power).toBe(2) // 3 - 1
  })

  it('refuse un Objet « à associer » s’il n’y a aucun Allié sur le lieu', () => {
    const o = bow()
    const s = atLocation('jail', [o], 3)
    expect(() => play(s, 'play-card', o)).toThrow()
  })

  it('refuse une cible qui n’est pas un Allié présent sur le lieu', () => {
    const a = ally()
    const o = bow()
    let s = atLocation('jail', [o], 3)
    s = withActive(s, { board: { ...me(s).board, jail: [a] } })
    expect(() => play(s, 'play-card', o, { attachTo: 'inexistant#1' })).toThrow()
  })

  it('refuse une cible pour une carte qui ne s’associe pas', () => {
    const a = ally()
    const s = atLocation('jail', [a], 5)
    expect(() => play(s, 'play-card', a, { attachTo: 'quelqu-un#1' })).toThrow()
  })

  it('un Objet de lieu (Mandat d’Arrêt) se pose sans cible et sans lien', () => {
    const warrant = inst('mandat-arret') // item, attach absent
    let s = atLocation('jail', [warrant], 3)
    s = play(s, 'play-card', warrant)
    const placed = me(s).board['jail'].find((c) => c.cardId === 'mandat-arret')
    expect(placed).toBeDefined()
    expect(placed?.attachedTo).toBeUndefined()
  })
})

describe('déplacer un Allié/Objet (MOVE_CARD)', () => {
  // Pion à l'Église (qui a l'action 'move-item-ally'). Voisins de church : sherwood, nottingham.
  const moveCard = (s: GameState, c: CardInstance, to: string) =>
    applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: c.instanceId, to })

  it('déplace un Allié vers un lieu voisin', () => {
    const a = inst('gardes-rhinoceros')
    let s = atLocation('church', [], 0)
    s = withActive(s, { board: { ...me(s).board, church: [a] } })
    s = moveCard(s, a, 'nottingham')
    expect(me(s).board['church']).toHaveLength(0)
    expect(me(s).board['nottingham'].map((c) => c.instanceId)).toContain(a.instanceId)
  })

  it('refuse un lieu non voisin', () => {
    const a = inst('gardes-rhinoceros')
    let s = atLocation('church', [], 0)
    s = withActive(s, { board: { ...me(s).board, church: [a] } })
    expect(() => moveCard(s, a, 'jail')).toThrow() // jail non adjacent à church
  })

  it('un Objet associé suit son Allié', () => {
    const a = inst('gardes-rhinoceros')
    const bow: CardInstance = { ...inst('arc-fleches'), attachedTo: a.instanceId }
    let s = atLocation('church', [], 0)
    s = withActive(s, { board: { ...me(s).board, church: [a, bow] } })
    s = moveCard(s, a, 'sherwood')
    expect(me(s).board['church']).toHaveLength(0)
    expect(me(s).board['sherwood'].map((c) => c.instanceId).sort()).toEqual(
      [a.instanceId, bow.instanceId].sort(),
    )
  })

  it('refuse de déplacer un Objet associé directement', () => {
    const a = inst('gardes-rhinoceros')
    const bow: CardInstance = { ...inst('arc-fleches'), attachedTo: a.instanceId }
    let s = atLocation('church', [], 0)
    s = withActive(s, { board: { ...me(s).board, church: [a, bow] } })
    expect(() => moveCard(s, bow, 'sherwood')).toThrow()
  })
})

describe('défausser', () => {
  it('défausse les cartes choisies et marque l’action utilisée', () => {
    const a = inst('magnifiques-taxes', 1)
    const b = inst('gardes-rhinoceros', 1)
    let s = atLocation('jail', [a, b], 0)
    s = applyAction(s, { type: 'DISCARD_CARDS', actionId: 'discard', instanceIds: [a.instanceId] })
    expect(me(s).hand.map((c) => c.instanceId)).toEqual([b.instanceId])
    expect(me(s).discard.map((c) => c.cardId)).toContain('magnifiques-taxes')
    expect(s.usedActionIds).toContain('discard')
  })

  it('émet un showcase « défausse » foncé avec les cartes jetées', () => {
    const a = inst('magnifiques-taxes', 1)
    const b = inst('gardes-rhinoceros', 1)
    let s = atLocation('jail', [a, b], 0)
    s = applyAction(s, {
      type: 'DISCARD_CARDS',
      actionId: 'discard',
      instanceIds: [a.instanceId, b.instanceId],
    })
    const ev = s.showcaseEvents.at(-1)
    expect(ev?.discard?.variant).toBe('dark')
    expect(ev?.discard?.cardIds).toEqual(['magnifiques-taxes', 'gardes-rhinoceros'])
    expect(ev?.playerIndex).toBe(s.activePlayer)
  })

  it('refuse une défausse vide', () => {
    const a = inst('magnifiques-taxes')
    const s = atLocation('jail', [a], 0)
    expect(() =>
      applyAction(s, { type: 'DISCARD_CARDS', actionId: 'discard', instanceIds: [] }),
    ).toThrow()
  })

  it('après avoir tout défaussé, END_TURN repioche jusqu’à 4', () => {
    const a = inst('magnifiques-taxes', 1)
    const b = inst('magnifiques-taxes', 2)
    let s = atLocation('jail', [a, b], 0)
    s = applyAction(s, {
      type: 'DISCARD_CARDS',
      actionId: 'discard',
      instanceIds: [a.instanceId, b.instanceId],
    })
    expect(me(s).hand).toHaveLength(0)
    s = applyAction(s, { type: 'END_TURN' })
    expect(me(s).hand).toHaveLength(4)
  })
})

describe('effets composables', () => {
  it('GAIN_POWER_PER_HERO_IN_REALM gagne 1 pouvoir par héros présent', () => {
    const s0 = singleGame()
    // Héros neutre (pas Robin, dont la pénalité réduirait le gain).
    const hero: CardInstance = {
      instanceId: 'h1',
      cardId: 'petit-jean',
      name: 'Petit Jean',
      type: 'hero',
      strength: 5,
    }
    const s = withActive(s0, { board: { ...me(s0).board, jail: [hero] } })
    expect(countHeroesInRealm(s)).toBe(1)
    const after = resolveEffects(s, [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }])
    expect(me(after).power).toBe(me(s).power + 1)
    // Animation : un fx « taxes-gain » par Héros (ici 1).
    const taxesFx = (after.floatingFx ?? []).filter((f) => f.kind === 'taxes-gain')
    expect(taxesFx).toHaveLength(1)
    expect(taxesFx[0].kind === 'taxes-gain' && taxesFx[0].instanceId).toBe('h1')
  })

  it('Robin des Bois : un gain de pouvoir émet un fx « −1 » sur sa carte', () => {
    const s0 = singleGame()
    const robin: CardInstance = {
      instanceId: 'r', cardId: 'robin-des-bois', name: 'Robin', type: 'hero', strength: 5,
    }
    const s = withActive(s0, { board: { ...me(s0).board, sherwood: [robin] } })
    const after = resolveEffects(s, [{ type: 'GAIN_POWER', amount: 3 }])
    expect(me(after).power).toBe(me(s).power + 2) // 3 − 1 (Robin)
    const fx = (after.floatingFx ?? []).at(-1)
    expect(fx?.kind).toBe('robin-steal')
    expect(fx?.amount).toBe(1)
    expect(fx?.locationId).toBe('sherwood')
  })
})
