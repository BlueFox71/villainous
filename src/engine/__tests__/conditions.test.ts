import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { conditionIsTriggered, playableConditions } from '../rules'
import type { CardInstance } from '../types'
import { twoPlayerGame } from './_helpers'

/** Helper test : matérialise une condition avec son trigger officiel. */
function condition(id: string, cardId: string): CardInstance {
  const triggers: Record<string, NonNullable<CardInstance['trigger']>> = {
    avarice: { type: 'opponent-power-ge', value: 6 },
    lachete: { type: 'opponent-hand-ge', value: 3, requiresOwnAlly: true },
    tyrannie: { type: 'opponent-allies-in-realm-ge', value: 3 },
    mechancete: { type: 'opponent-vanquished-hero-strength-ge', value: 4 },
  }
  return { instanceId: id, cardId, name: cardId, type: 'condition', trigger: triggers[cardId] }
}

describe('D.1 — PLAY_CONDITION : Avarice', () => {
  it('Trigger : Avarice déclenchée si l’adversaire actif a ≥6 JT', () => {
    let s = twoPlayerGame()
    // Joueur 0 (actif) a 6 JT, joueur 1 a Avarice en main.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, power: 6 }
          : { ...p, hand: [condition('p1:av', 'avarice'), ...p.hand] },
      ),
    }
    expect(conditionIsTriggered(s, s.players[1].hand[0])).toBe(true)
    expect(playableConditions(s, 1).map((c) => c.instanceId)).toContain('p1:av')
  })

  it('Trigger faux si l’adversaire a <6 JT', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, hand: [condition('p1:av', 'avarice')] } : p,
      ),
    }
    expect(playableConditions(s, 1)).toHaveLength(0)
  })

  it('Avarice compte le Pouvoir de l’ADVERSAIRE ACTIF, pas le sien', () => {
    // Régression : le bot (joueur 1, non-actif) a beaucoup de Pouvoir ; l’actif
    // (joueur 0) en a peu. Avarice NE doit PAS être jouable (le seuil porte sur
    // le joueur actif, jamais sur soi-même).
    let s = twoPlayerGame()
    s = {
      ...s,
      activePlayer: 0,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, power: 3 } // adversaire actif < 6
          : { ...p, power: 20, hand: [condition('p1:av', 'avarice')] }, // soi ≥ 6
      ),
    }
    expect(conditionIsTriggered(s, s.players[1].hand[0], 1)).toBe(false)
    expect(playableConditions(s, 1)).toHaveLength(0)
    expect(() =>
      applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:av' }),
    ).toThrow(/non satisfaite/i)
  })

  it('Avarice jouée par le non-actif : +3 JT, carte défaussée, pas de repioche', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, power: 6 }
          : { ...p, power: 1, hand: [condition('p1:av', 'avarice')] },
      ),
    }
    const handBefore = s.players[1].hand.length
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:av' })
    expect(s.players[1].power).toBe(4) // 1 + 3
    expect(s.players[1].hand).toHaveLength(handBefore - 1) // pas de repioche
    expect(s.players[1].discard.map((c) => c.instanceId)).toContain('p1:av')
    // L'actif n'a pas changé (toujours 0).
    expect(s.activePlayer).toBe(0)
  })

  it('Refus si l’actif joue sa propre Condition', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, hand: [condition('p0:av', 'avarice')] } : p,
      ),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'p0:av' }),
    ).toThrow(/adversaire|active/i)
  })

  it('Refus si la condition n’est pas satisfaite', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, hand: [condition('p1:av', 'avarice')] } : p,
      ),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:av' }),
    ).toThrow(/condition/i)
  })

  it('Une Condition PIOCHÉE en cours de tour n’est pas jouable en réaction (instantané du début de tour)', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      activePlayer: 0,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, power: 6 } // déclencheur Avarice satisfait
          : {
              ...p,
              hand: [condition('p1:av1', 'avarice'), condition('p1:av2', 'avarice')],
              // Seule av1 était en main au début du tour ; av2 a été piochée depuis.
              reactableConditionIds: ['p1:av1'],
            },
      ),
    }
    // Seule la Condition de l'instantané est proposée.
    expect(playableConditions(s, 1).map((c) => c.instanceId)).toEqual(['p1:av1'])
    // La piochée est refusée par le moteur…
    expect(() =>
      applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:av2' }),
    ).toThrow(/piochée en cours de tour/i)
    // …celle de l'instantané est jouable.
    expect(() =>
      applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:av1' }),
    ).not.toThrow()
  })

  it('END_TURN fige l’instantané des Conditions réactables de chaque joueur', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, hand: [condition('p1:av', 'avarice'), ...p.hand.filter((c) => c.type !== 'condition')] } : p,
      ),
    }
    const after = applyAction(s, { type: 'END_TURN' })
    // Le joueur 1 avait Avarice en main → elle figure dans son instantané.
    expect(after.players[1].reactableConditionIds).toContain('p1:av')
  })
})

describe('D.2 — PLAY_CONDITION : Lâcheté', () => {
  function lachete(id: string): CardInstance {
    return {
      instanceId: id, cardId: 'lachete', name: 'Lâcheté', type: 'condition',
      trigger: { type: 'opponent-hand-ge', value: 3, requiresOwnAlly: true },
    }
  }
  function gardes(id: string): CardInstance {
    return { instanceId: id, cardId: 'gardes-rhinoceros', name: 'Gardes Rhino', type: 'ally', cost: 3, strength: 4 }
  }

  it('Trigger : Lâcheté déclenchée si l’adversaire actif a ≥3 cartes en main', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, hand: [lachete('p1:la'), gardes('p1:g1')] } : p,
      ),
    }
    expect(playableConditions(s, 1).map((c) => c.instanceId)).toContain('p1:la')
    // (l'actif a 4 cartes en main, distribuées par createInitialGame)
  })

  it('Lâcheté pose un Allié gratuitement sur le lieu choisi', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, power: 0, hand: [lachete('p1:la'), gardes('p1:g1')] } : p,
      ),
    }
    s = applyAction(s, {
      type: 'PLAY_CONDITION',
      playerIndex: 1,
      instanceId: 'p1:la',
      allyInstanceId: 'p1:g1',
      to: 'church',
    })
    // Pouvoir inchangé (gratuit), Lâcheté + Gardes retirés de la main, Gardes sur Église.
    expect(s.players[1].power).toBe(0)
    expect(s.players[1].hand.find((c) => c.instanceId === 'p1:la')).toBeUndefined()
    expect(s.players[1].hand.find((c) => c.instanceId === 'p1:g1')).toBeUndefined()
    expect(s.players[1].board['church'].find((c) => c.instanceId === 'p1:g1')).toBeDefined()
    expect(s.players[1].discard.map((c) => c.instanceId)).toContain('p1:la')
  })

  it('Refus si on n’indique pas l’Allié ou le lieu', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, hand: [lachete('p1:la'), gardes('p1:g1')] } : p,
      ),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:la' }),
    ).toThrow(/Allié|lieu/i)
  })
})

describe('E.7 — Conditions Maléfique (Tyrannie, Méchanceté)', () => {
  function tyrannie(id: string): CardInstance {
    return {
      instanceId: id, cardId: 'tyrannie', name: 'Tyrannie', type: 'condition',
      trigger: { type: 'opponent-allies-in-realm-ge', value: 3 },
    }
  }
  function mech(id: string): CardInstance {
    return {
      instanceId: id, cardId: 'mechancete', name: 'Méchanceté', type: 'condition',
      trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 4 },
    }
  }
  function ally(id: string, cardId = 'gardes-rhinoceros'): CardInstance {
    return { instanceId: id, cardId, name: cardId, type: 'ally', cost: 3, strength: 4 }
  }
  function hero(id: string, strength: number, cardId = 'belle-marianne'): CardInstance {
    return { instanceId: id, cardId, name: cardId, type: 'hero', strength }
  }

  it('Tyrannie : trigger si l’adversaire a ≥3 Alliés', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: { ...p.board, jail: [ally('a1'), ally('a2'), ally('a3')] } }
          : { ...p, hand: [tyrannie('p1:t')] },
      ),
    }
    expect(playableConditions(s, 1).map((c) => c.cardId)).toContain('tyrannie')
  })

  it('Avarice : le showcase de la carte porte le gain de pouvoir (+3) pour l’anim', () => {
    let s = twoPlayerGame()
    const avarice: CardInstance = {
      instanceId: 'p1:av', cardId: 'avarice', name: 'Avarice', type: 'condition',
      trigger: { type: 'opponent-power-ge', value: 10 },
    }
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, power: 12 } : { ...p, hand: [avarice] })),
    }
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:av' })
    const ev = s.showcaseEvents.find((e) => e.cardId === 'avarice')
    expect(ev?.gainedPower).toBe(3)
  })

  // Met en place une partie où J1 a Tyrannie en main et J0 a ≥3 Alliés (trigger).
  function tyrannieReady() {
    let s = twoPlayerGame()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: { ...p.board, jail: [ally('a1'), ally('a2'), ally('a3')] } }
          : { ...p, hand: [tyrannie('p1:t')] },
      ),
    }
    return s
  }

  it('Tyrannie : pioche, émet « tyranny-draw » et met la défausse EN ATTENTE (sans défausser)', () => {
    let s = tyrannieReady()
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:t' })
    // Pioche animée émise.
    const draw = (s.floatingFx ?? []).find((f) => f.kind === 'tyranny-draw')
    expect(draw?.kind === 'tyranny-draw' && draw.playerIndex).toBe(1)
    expect(draw?.kind === 'tyranny-draw' && draw.count).toBeGreaterThan(0)
    // Défausse en attente, pas encore résolue.
    expect(s.pendingTyrannyDiscard?.playerIndex).toBe(1)
    expect(s.pendingTyrannyDiscard?.count).toBeGreaterThan(0)
    expect(s.showcaseEvents.some((e) => e.discard)).toBe(false)
  })

  it('Tyrannie : RESOLVE_TYRANNY_DISCARD défausse les cartes choisies, showcase foncé, lève le pending', () => {
    let s = tyrannieReady()
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'p1:t' })
    const count = s.pendingTyrannyDiscard!.count
    const hand = s.players[1].hand
    const chosen = hand.slice(0, count).map((c) => c.instanceId)
    const discardBefore = s.players[1].discard.length
    // Un mauvais nombre de cartes est refusé.
    expect(() =>
      applyAction(s, { type: 'RESOLVE_TYRANNY_DISCARD', instanceIds: chosen.slice(0, count - 1) }),
    ).toThrow(/exactement/i)
    s = applyAction(s, { type: 'RESOLVE_TYRANNY_DISCARD', instanceIds: chosen })
    expect(s.pendingTyrannyDiscard).toBeUndefined()
    expect(s.players[1].hand.length).toBe(hand.length - count)
    expect(s.players[1].discard.length).toBe(discardBefore + count)
    const ev = s.showcaseEvents.at(-1)
    expect(ev?.discard?.variant).toBe('dark')
    expect(ev?.playerIndex).toBe(1)
    expect(ev?.discard?.cardIds.length).toBe(count)
  })

  it('Méchanceté : trigger après que l’actif a vaincu un héros ≥4', () => {
    // Joueur 0 (actif) à Nottingham. Pose un Héros force 4 et un Allié force 5,
    // puis exécute le Vanquish — Méchanceté de J1 devient jouable.
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              board: {
                ...p.board,
                nottingham: [hero('h1', 4), ally('a1', 'creature-sauvage')],
              },
            }
          : { ...p, hand: [mech('p1:m')] },
      ),
    }
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    expect(s.lastVanquishedHeroStrength).toBe(4)
    expect(playableConditions(s, 1).map((c) => c.cardId)).toContain('mechancete')
  })

  it('Méchanceté : élimine un héros ≤4 du royaume du joueur réactif', () => {
    let s = twoPlayerGame()
    s = {
      ...s,
      lastVanquishedHeroStrength: 5,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              hand: [mech('p1:m')],
              board: { ...p.board, sherwood: [hero('p1f:bad', 3, 'roi-hubert')] },
            }
          : p,
      ),
    }
    s = applyAction(s, {
      type: 'PLAY_CONDITION',
      playerIndex: 1,
      instanceId: 'p1:m',
      allyInstanceId: 'p1f:bad',
    })
    expect(s.players[1].board['sherwood'].find((c) => c.instanceId === 'p1f:bad')).toBeUndefined()
    expect(s.players[1].fateDiscard.find((c) => c.instanceId === 'p1f:bad')).toBeDefined()
  })

  it('MODE TEST : Méchanceté élimine le Héros CHOISI parmi plusieurs éligibles (≤4)', () => {
    let s = twoPlayerGame()
    // Joueur actif (0) a deux Héros ≤4 dans son royaume.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              board: {
                ...p.board,
                nottingham: [hero('hA', 3, 'roi-hubert')],
                jail: [hero('hB', 4, 'roi-hubert')],
              },
            }
          : p,
      ),
    }
    // On choisit explicitement hB (le 2ᵉ Héros) via allyInstanceId.
    s = applyAction(s, { type: 'TEST_PLAY_CONDITION', card: mech('m'), allyInstanceId: 'hB' })
    const heroes = Object.values(s.players[0].board)
      .flat()
      .filter((c) => c.type === 'hero')
      .map((c) => c.instanceId)
    expect(heroes).toContain('hA') // non choisi → reste
    expect(heroes).not.toContain('hB') // choisi → vaincu
  })
})
