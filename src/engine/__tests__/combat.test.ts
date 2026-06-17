import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { effectiveStrength } from '../rules'
import type { CardInstance, GameState } from '../types'
import { me, singleGame, withActive } from './_helpers'
import { getCardDef } from '../../data/registry'

// Les fixtures recopient les champs de force passive réels (strengthMod /
// selfStrengthMods / attachStrengthBonus) depuis le registre, pour rester
// synchrones avec la donnée des cartes tout en gardant force/attachedTo libres.
function ally(id: string, cardId: string, strength: number, attachedTo?: string): CardInstance {
  const def = getCardDef(cardId)
  return { instanceId: id, cardId, name: cardId, type: 'ally', strength, attachedTo, strengthMod: def?.strengthMod, selfStrengthMods: def?.selfStrengthMods }
}
function item(id: string, cardId: string, attachedTo?: string): CardInstance {
  return { instanceId: id, cardId, name: cardId, type: 'item', attachStrengthBonus: getCardDef(cardId)?.attachStrengthBonus, attachedTo }
}
function hero(id: string, cardId: string, strength: number, extra: Partial<CardInstance> = {}): CardInstance {
  const def = getCardDef(cardId)
  return { instanceId: id, cardId, name: cardId, type: 'hero', strength, strengthMod: def?.strengthMod, selfStrengthMods: def?.selfStrengthMods, ...extra }
}

describe('E.0 — Objectif data-driven', () => {
  it('POWER_THRESHOLD : victoire quand power ≥ threshold au début du tour', () => {
    // Joueur 0 atteint 20 JT en fin de tour → victoire détectée au début du tour de J0+1.
    // singleGame a 1 joueur donc le tour repasse à lui ; suffit pour le test du dispatch.
    let s = singleGame()
    s = withActive(s, { power: 20, pawnLocation: 'sherwood' })
    s = applyAction(s, { type: 'MOVE', to: 'church' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).toBe('WON')
  })

  it('CURSE_EACH_LOCATION : victoire quand une malédiction est sur chaque lieu', () => {
    const baseSeed = 7
    let s = singleGame(baseSeed)
    const curse = (loc: string): CardInstance => ({
      instanceId: `curse-${loc}`,
      cardId: 'malediction',
      name: 'Malédiction',
      type: 'curse',
    })
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              objective: { type: 'CURSE_EACH_LOCATION' },
              board: {
                sherwood: [curse('sherwood')],
                church: [curse('church')],
                nottingham: [curse('nottingham')],
                jail: [curse('jail')],
              },
            }
          : p,
      ),
    }
    // Force la victoire à se déclencher au début du tour : on bouge + termine.
    s = withActive(s, { pawnLocation: 'sherwood' })
    s = applyAction(s, { type: 'MOVE', to: 'church' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).toBe('WON')
  })

  it('CURSE_EACH_LOCATION : pas de victoire si UN lieu manque', () => {
    let s = singleGame(7)
    const curse = (loc: string): CardInstance => ({
      instanceId: `curse-${loc}`,
      cardId: 'malediction',
      name: 'Malédiction',
      type: 'curse',
    })
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              objective: { type: 'CURSE_EACH_LOCATION' },
              board: {
                sherwood: [curse('sherwood')],
                church: [curse('church')],
                nottingham: [], // manquant
                jail: [curse('jail')],
              },
            }
          : p,
      ),
    }
    s = withActive(s, { pawnLocation: 'sherwood' })
    s = applyAction(s, { type: 'MOVE', to: 'church' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).toBe('PLAYING')
  })
})

describe('B.1 — Force effective', () => {
  it('Allié seul : force de base inchangée', () => {
    const s0 = singleGame()
    const s = withActive(s0, { board: { ...me(s0).board, church: [ally('a1', 'gardes-rhinoceros', 4)] } })
    expect(effectiveStrength(s, s.activePlayer, 'a1')).toBe(4)
  })

  it('Niquedouille au même lieu : +1 aux autres alliés', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [ally('a1', 'gardes-rhinoceros', 4), ally('niq', 'niquedouille', 2)],
        sherwood: [ally('a2', 'gardes-rhinoceros', 4)],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'a1')).toBe(5)
    expect(effectiveStrength(s, s.activePlayer, 'niq')).toBe(2) // pas de self-buff
    expect(effectiveStrength(s, s.activePlayer, 'a2')).toBe(4) // autre lieu
  })

  it('Arc et Flèches associé : +1 au porteur', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          ally('a1', 'gardes-rhinoceros', 4),
          item('arc', 'arc-fleches', 'a1'),
        ],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'a1')).toBe(5)
  })

  it('Pendard au même lieu : −1 aux autres Alliés (pas aux Héros, pas à lui-même)', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'gardes-rhinoceros', 4),
          ally('pen', 'pendard', 4),
        ],
        sherwood: [ally('a2', 'gardes-rhinoceros', 4)],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'a1')).toBe(3) // autre Allié : −1
    expect(effectiveStrength(s, s.activePlayer, 'pen')).toBe(4) // pas de self-malus
    expect(effectiveStrength(s, s.activePlayer, 'h1')).toBe(3) // Héros non affecté
    expect(effectiveStrength(s, s.activePlayer, 'a2')).toBe(4) // autre lieu
  })

  it('Adam de la Halle : +1 aux autres Héros', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        church: [hero('adam', 'adam-halle', 2), hero('marianne', 'belle-marianne', 3)],
        sherwood: [hero('robin', 'robin-des-bois', 5)],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'adam')).toBe(2) // pas de self-buff
    expect(effectiveStrength(s, s.activePlayer, 'marianne')).toBe(4)
    expect(effectiveStrength(s, s.activePlayer, 'robin')).toBe(6)
  })

  it('Plancher à 0 (Pendard ne fait pas descendre un Allié en négatif)', () => {
    const s0 = singleGame()
    const s = withActive(s0, {
      board: {
        ...me(s0).board,
        // Allié force 0 (cas limite) + Pendard → reste à 0, pas négatif.
        church: [ally('weak', 'gardes-rhinoceros', 0), ally('pen', 'pendard', 4)],
      },
    })
    expect(effectiveStrength(s, s.activePlayer, 'weak')).toBe(0)
  })
})

describe('B.2 — Action Vanquish', () => {
  function ready(): GameState {
    // Pion à Nottingham (action 'vanquish' en rangée basse), un Héros force 3
    // et un Allié force 4 sur Nottingham.
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'gardes-rhinoceros', 4),
        ],
      },
    })
    return s
  }

  it('Vanquish réussi : héros → fateDiscard, allié → discard', () => {
    let s = ready()
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    const p = me(s)
    expect(p.board['nottingham']).toHaveLength(0)
    expect(p.fateDiscard.map((c) => c.instanceId)).toContain('h1')
    expect(p.discard.map((c) => c.instanceId)).toContain('a1')
  })

  it('Vanquish refusé si force insuffisante', () => {
    let s = ready()
    s = withActive(s, {
      board: { ...me(s).board, nottingham: [hero('h1', 'belle-marianne', 5), ally('a1', 'gardes-rhinoceros', 4)] },
    })
    expect(() =>
      applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['a1'] }),
    ).toThrow(/insuffisante|Force/)
  })

  it('On peut viser un héros sur un AUTRE lieu que celui du pion (règle officielle)', () => {
    // Pion à Nottingham (pour avoir l'action Vanquish), héros sur Église,
    // allié sur Église. Vanquish doit réussir : alliés au lieu du HÉROS.
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        church: [hero('h1', 'belle-marianne', 3), ally('a1', 'gardes-rhinoceros', 4)],
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    expect(me(s).board['church']).toHaveLength(0)
  })

  it('Vanquish refusé si l’allié n’est pas sur le lieu du héros', () => {
    let s = ready()
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [hero('h1', 'belle-marianne', 3)],
        church: [ally('a1', 'gardes-rhinoceros', 4)],
      },
    })
    expect(() =>
      applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['a1'] }),
    ).toThrow(/Nottingham|absent/)
  })

  it('Vanquish utilise les forces EFFECTIVES (Niquedouille +1)', () => {
    let s = ready()
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 5),
          ally('a1', 'gardes-rhinoceros', 4),
          ally('niq', 'niquedouille', 2),
        ],
      },
    })
    // Force allié = 4 + 1 (Niquedouille) = 5, Niquedouille = 2 → total 7 ≥ 5.
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1', 'niq'],
    })
    expect(me(s).board['nottingham']).toHaveLength(0)
  })

  it('Arc et Flèches : défaussé À LA PLACE de l’Allié utilisé (l’Allié survit)', () => {
    let s = ready()
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'gardes-rhinoceros', 4),
          { instanceId: 'arc', cardId: 'arc-fleches', name: 'Arc et Flèches', type: 'item', attachedTo: 'a1' },
        ],
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    const p = me(s)
    // L'Allié RESTE sur le plateau ; seul l'Arc et Flèches est défaussé ; le Héros est vaincu.
    expect(p.board['nottingham'].find((c) => c.instanceId === 'a1')).toBeDefined()
    expect(p.board['nottingham'].find((c) => c.instanceId === 'arc')).toBeUndefined()
    expect(p.discard.map((c) => c.instanceId)).toContain('arc')
    expect(p.discard.map((c) => c.instanceId)).not.toContain('a1')
    expect(p.fateDiscard.find((c) => c.instanceId === 'h1')).toBeDefined()
  })

  it('Deux Arc et Flèches : les DEUX sont défaussés à la place de l’Allié (qui survit)', () => {
    let s = ready()
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'gardes-rhinoceros', 4),
          { instanceId: 'arc1', cardId: 'arc-fleches', name: 'Arc et Flèches', type: 'item', attachedTo: 'a1' },
          { instanceId: 'arc2', cardId: 'arc-fleches', name: 'Arc et Flèches', type: 'item', attachedTo: 'a1' },
        ],
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    const p = me(s)
    expect(p.board['nottingham'].find((c) => c.instanceId === 'a1')).toBeDefined()
    expect(p.discard.map((c) => c.instanceId)).toEqual(expect.arrayContaining(['arc1', 'arc2']))
    expect(p.discard.map((c) => c.instanceId)).not.toContain('a1')
  })
})

describe('B.3 — Effets à la mort', () => {
  function ready(extra: Partial<{ heroId: string; heroCardId: string; heroStrength: number; heroLocked: number; onVanquish: NonNullable<CardInstance['onVanquish']> }> = {}) {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const h = hero(extra.heroId ?? 'h1', extra.heroCardId ?? 'petit-jean', extra.heroStrength ?? 3, {
      lockedPower: extra.heroLocked,
      onVanquish: extra.onVanquish,
    })
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [h, ally('a1', 'gardes-rhinoceros', 4)],
      },
    })
    return s
  }

  it('lockedPower restitué au joueur quand le Héros est vaincu (Petit Jean)', () => {
    let s = ready({ heroLocked: 4 })
    const before = me(s).power
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    expect(me(s).power).toBe(before + 4)
    // Et le héros défaussé ne porte plus de lockedPower.
    const inDiscard = me(s).fateDiscard.find((c) => c.instanceId === 'h1')!
    expect(inDiscard.lockedPower).toBeUndefined()
  })

  it('Toby vaincu retourne dans la pioche Fatalité (onVanquish RESHUFFLE)', () => {
    let s = ready({
      heroId: 'toby',
      heroCardId: 'toby',
      heroStrength: 2,
      onVanquish: [{ type: 'RESHUFFLE_HOST_INTO_FATE_DECK' }],
    })
    const fateBefore = me(s).fateDeck.length
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'toby',
      allyInstanceIds: ['a1'],
    })
    const p = me(s)
    expect(p.fateDiscard.find((c) => c.instanceId === 'toby')).toBeUndefined()
    expect(p.fateDeck.find((c) => c.instanceId === 'toby')).toBeDefined()
    expect(p.fateDeck).toHaveLength(fateBefore + 1)
  })

  it('Vanquish refusé si Déguisement attaché ; DISCARD_DEGUISEMENT (2 JT) le retire (B.4)', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 5,
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          { instanceId: 'degu', cardId: 'deguisement', name: 'Déguisement', type: 'item', attachedTo: 'h1' },
          ally('a1', 'gardes-rhinoceros', 4),
        ],
      },
    })
    expect(() =>
      applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['a1'] }),
    ).toThrow(/Déguisement|invulnérable/)
    // Payer 2 JT pour défausser le Déguisement.
    s = applyAction(s, { type: 'DISCARD_DEGUISEMENT', instanceId: 'degu' })
    expect(me(s).power).toBe(3)
    expect(me(s).fateDiscard.map((c) => c.instanceId)).toContain('degu')
    // Maintenant le vanquish passe.
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['a1'] })
    expect(me(s).board['nottingham']).toHaveLength(0)
  })

  it('Belle Marianne vaincue fait apparaître Robin sur son lieu (SEARCH_AND_PLACE_HERO)', () => {
    let s = ready({
      heroId: 'marianne',
      heroCardId: 'belle-marianne',
      heroStrength: 3,
      onVanquish: [{ type: 'SEARCH_AND_PLACE_HERO', cardId: 'robin-des-bois' }],
    })
    // Le deck Fatalité courant contient Robin (singleGame ouvre tout le deck). Ok.
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'marianne',
      allyInstanceIds: ['a1'],
    })
    const placed = me(s).board['nottingham'].find((c) => c.cardId === 'robin-des-bois')
    expect(placed).toBeDefined()
    // Showcase « vol » pour l'apparition de Robin (destination = son lieu).
    const robinEv = s.showcaseEvents.find(
      (e) => e.cardId === 'robin-des-bois' && e.destination?.locationId === 'nottingham',
    )
    expect(robinEv).toBeDefined()
    expect(robinEv?.cardInstanceId).toBe(placed?.instanceId)
  })
})

describe('B.5 — Archers Loups & Bobby', () => {
  it('Archers Loups peuvent éliminer un héros depuis un lieu voisin', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [hero('h1', 'belle-marianne', 2)],
        jail: [ally('arch', 'archers-loups', 2)], // jail voisin de nottingham
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['arch'],
    })
    expect(me(s).board['nottingham']).toHaveLength(0)
    expect(me(s).board['jail']).toHaveLength(0)
    expect(me(s).discard.map((c) => c.instanceId)).toContain('arch')
  })

  it('Un Allié non-Archers ne peut pas frapper depuis un lieu voisin', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [hero('h1', 'belle-marianne', 2)],
        jail: [ally('a1', 'gardes-rhinoceros', 4)],
      },
    })
    expect(() =>
      applyAction(s, {
        type: 'VANQUISH',
        actionId: 'vanquish',
        heroInstanceId: 'h1',
        allyInstanceIds: ['a1'],
      }),
    ).toThrow(/Nottingham|sur/)
  })

  it('Bobby ne peut pas être éliminé par des Archers Loups', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [hero('bobby', 'bobby', 2), ally('arch', 'archers-loups', 2)],
      },
    })
    expect(() =>
      applyAction(s, {
        type: 'VANQUISH',
        actionId: 'vanquish',
        heroInstanceId: 'bobby',
        allyInstanceIds: ['arch'],
      }),
    ).toThrow(/Bobby|Archers/)
  })

  it('Bobby reste éliminable par un autre Allié', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [hero('bobby', 'bobby', 2), ally('a1', 'gardes-rhinoceros', 4)],
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'bobby',
      allyInstanceIds: ['a1'],
    })
    expect(me(s).board['nottingham']).toHaveLength(0)
  })
})

describe('C.7 — Persifleur', () => {
  it('Bouger sur le lieu de Persifleur permet UNE action recouverte (puis consommée)', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'church' }) // pion ailleurs
    // Persifleur sur Nottingham, et un Héros y est posé : action haute recouverte.
    s = withActive(s, {
      board: {
        ...me(s).board,
        nottingham: [
          ally('hiss', 'persifleur', 2),
          hero('h1', 'belle-marianne', 3),
        ],
      },
    })
    // Termine le tour pour pouvoir bouger librement le tour suivant.
    s = applyAction(s, { type: 'END_TURN' })
    // C'est le tour du même joueur (singleGame = 1 seul joueur).
    s = applyAction(s, { type: 'MOVE', to: 'nottingham' })
    expect(s.persifleurAvailable).toBe(true)
    // L'action 'gain-power' (top-row Nottingham, recouverte) est jouable.
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.persifleurAvailable).toBe(false)
    // Une 2e tentative sur une action recouverte échoue (déjà consommé).
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'fate' })).toThrow()
  })
})

describe('C.6 — Shérif de Nottingham', () => {
  it('Déplacement gratuit, +1 JT si Héros sur destination', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 0,
      board: {
        ...me(s).board,
        sherwood: [ally('sheriff', 'sherif-nottingham', 3)],
        church: [hero('h1', 'belle-marianne', 3)],
      },
    })
    s = applyAction(s, { type: 'SHERIFF_MOVE', instanceId: 'sheriff', to: 'church' })
    expect(me(s).board['sherwood']).toHaveLength(0)
    expect(me(s).board['church'].find((c) => c.instanceId === 'sheriff')).toBeDefined()
    expect(me(s).power).toBe(1)
  })

  it('Pas de bonus si pas de Héros sur destination, et refuse 2× même tour', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 0,
      board: { ...me(s).board, sherwood: [ally('sheriff', 'sherif-nottingham', 3)] },
    })
    s = applyAction(s, { type: 'SHERIFF_MOVE', instanceId: 'sheriff', to: 'church' })
    expect(me(s).power).toBe(0)
    expect(() =>
      applyAction(s, { type: 'SHERIFF_MOVE', instanceId: 'sheriff', to: 'sherwood' }),
    ).toThrow(/déjà été déplacé/)
  })
})

describe('C.5 — Tendre un Piège', () => {
  it('Déplace un Allié N’importe où, puis Vanquish (héros sur le même nouveau lieu)', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const trap: CardInstance = {
      instanceId: 'trap',
      cardId: 'tendre-piege',
      name: 'Tendre un Piège',
      type: 'effect',
      cost: 1,
      effects: [{ type: 'MOVE_ALLY_FREELY' }, { type: 'VANQUISH_HERO', keepAllies: false }],
    }
    s = withActive(s, {
      power: 1,
      hand: [trap],
      board: {
        ...me(s).board,
        sherwood: [ally('a1', 'gardes-rhinoceros', 4)], // pas voisin de la Prison
        jail: [hero('h1', 'belle-marianne', 3)],
      },
    })
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'trap',
      allyMove: { instanceId: 'a1', to: 'jail' },
      targetHeroId: 'h1',
      allyInstanceIds: ['a1'],
    })
    const p = me(s)
    // Héros et allié défaussés (Vanquish standard, alliés non gardés).
    expect(p.board['jail']).toHaveLength(0)
    expect(p.fateDiscard.find((c) => c.instanceId === 'h1')).toBeDefined()
    expect(p.discard.find((c) => c.instanceId === 'a1')).toBeDefined()
  })

  function trapCard(): CardInstance {
    return {
      instanceId: 'trap', cardId: 'tendre-piege', name: 'Tendre un Piège', type: 'effect', cost: 1,
      effects: [{ type: 'MOVE_ALLY_FREELY' }, { type: 'VANQUISH_HERO', keepAllies: false }],
    }
  }

  it('déplacement IMMÉDIAT + Vanquish FACULTATIF (pendingTrapVanquish puis TRAP_VANQUISH)', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 1,
      hand: [trapCard()],
      board: {
        ...me(s).board,
        sherwood: [ally('a1', 'gardes-rhinoceros', 4)],
        jail: [hero('h1', 'belle-marianne', 3)],
      },
    })
    // Jouer la carte avec le déplacement SEUL → Allié déplacé tout de suite,
    // carte défaussée, et Vanquish laissé en attente (facultatif).
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'trap',
      allyMove: { instanceId: 'a1', to: 'jail' },
    })
    expect(me(s).board['sherwood']).toHaveLength(0)
    expect(me(s).board['jail'].some((c) => c.instanceId === 'a1')).toBe(true)
    expect(s.pendingTrapVanquish?.source).toBe('trap')
    expect(me(s).discard.some((c) => c.instanceId === 'trap')).toBe(true)
    // Éliminer le Héros via l'action facultative.
    s = applyAction(s, { type: 'TRAP_VANQUISH', heroInstanceId: 'h1', allyInstanceIds: ['a1'] })
    expect(s.pendingTrapVanquish).toBeNull()
    expect(me(s).fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
  })

  it('Vanquish facultatif ignoré : TRAP_SKIP_VANQUISH nettoie le drapeau', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 1,
      hand: [trapCard()],
      board: { ...me(s).board, sherwood: [ally('a1', 'gardes-rhinoceros', 4)] },
    })
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'trap',
      allyMove: { instanceId: 'a1', to: 'jail' },
    })
    expect(s.pendingTrapVanquish?.source).toBe('trap')
    s = applyAction(s, { type: 'TRAP_SKIP_VANQUISH' })
    expect(s.pendingTrapVanquish).toBeNull()
    // L'Allié reste déplacé.
    expect(me(s).board['jail'].some((c) => c.instanceId === 'a1')).toBe(true)
  })
})

describe('C.4 — Intimidation', () => {
  it('Vanquish via Intimidation : héros défaussé, alliés GARDÉS sur le plateau', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const intimidation: CardInstance = {
      instanceId: 'inti',
      cardId: 'intimidation',
      name: 'Intimidation',
      type: 'effect',
      cost: 2,
      effects: [{ type: 'VANQUISH_HERO', keepAllies: true }],
    }
    s = withActive(s, {
      power: 2,
      hand: [intimidation],
      board: {
        ...me(s).board,
        nottingham: [hero('h1', 'belle-marianne', 3), ally('a1', 'gardes-rhinoceros', 4)],
      },
    })
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'inti',
      targetHeroId: 'h1',
      allyInstanceIds: ['a1'],
    })
    const p = me(s)
    // Héros parti, allié toujours sur Nottingham.
    expect(p.board['nottingham'].find((c) => c.instanceId === 'h1')).toBeUndefined()
    expect(p.board['nottingham'].find((c) => c.instanceId === 'a1')).toBeDefined()
    expect(p.discard.find((c) => c.instanceId === 'a1')).toBeUndefined()
    expect(p.fateDiscard.find((c) => c.instanceId === 'h1')).toBeDefined()
  })
})

describe('C.3 — Emprisonnement', () => {
  it('Déplace un Héros choisi vers la Prison + déclenche les Mandats sur place', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const robin: CardInstance = {
      instanceId: 'mar',
      cardId: 'belle-marianne', // héros neutre (pas Robin) pour isoler le +2 du Mandat
      name: 'Belle Marianne',
      type: 'hero',
      strength: 3,
    }
    const mandat: CardInstance = {
      instanceId: 'mandat',
      cardId: 'mandat-arret',
      name: "Mandat d'Arrêt",
      type: 'item',
    }
    const emp: CardInstance = {
      instanceId: 'emp',
      cardId: 'emprisonnement',
      name: 'Emprisonnement',
      type: 'effect',
      cost: 2,
      effects: [{ type: 'MOVE_HERO_TO_LOCATION', locationId: 'jail' }],
    }
    s = withActive(s, {
      power: 2,
      hand: [emp],
      board: {
        ...me(s).board,
        church: [robin],
        jail: [mandat],
      },
    })
    const pBefore = me(s).power
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'emp',
      targetHeroId: 'mar',
    })
    // Le Héros a quitté l'Église et est en Prison.
    expect(me(s).board['church'].find((c) => c.instanceId === 'mar')).toBeUndefined()
    expect(me(s).board['jail'].find((c) => c.instanceId === 'mar')).toBeDefined()
    // Mandat sur Prison → +2 JT (et −2 pour le coût). Solde = pBefore − 2 + 2 = pBefore.
    expect(me(s).power).toBe(pBefore)
  })

  it('Refuse d’emprisonner Dame Gertrude (forbiddenLocations contient jail)', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const gertrude: CardInstance = {
      instanceId: 'gert',
      cardId: 'dame-gertrude',
      name: 'Dame Gertrude',
      type: 'hero',
      strength: 6,
      forbiddenLocations: ['jail'],
    }
    const emp: CardInstance = {
      instanceId: 'emp',
      cardId: 'emprisonnement',
      name: 'Emprisonnement',
      type: 'effect',
      cost: 2,
      effects: [{ type: 'MOVE_HERO_TO_LOCATION', locationId: 'jail' }],
    }
    s = withActive(s, {
      power: 5,
      hand: [emp],
      board: { ...me(s).board, church: [gertrude] },
    })
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'emp', targetHeroId: 'gert' }),
    ).toThrow(/Dame Gertrude|jail/)
  })
})

describe('C.2 — Couronne du Roi Richard', () => {
  it('Une Couronne sur le lieu courant retire 1 JT au coût de chaque carte', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const couronne: CardInstance = {
      instanceId: 'couronne',
      cardId: 'couronne-roi-richard',
      name: 'Couronne',
      type: 'item',
    }
    const gardes: CardInstance = {
      instanceId: 'gardes',
      cardId: 'gardes-rhinoceros',
      name: 'Gardes Rhino',
      type: 'ally',
      cost: 3,
      strength: 4,
    }
    s = withActive(s, {
      power: 2, // pas assez sans la Couronne (coût 3) ; assez avec (coût 2).
      hand: [gardes],
      board: { ...me(s).board, nottingham: [couronne] },
    })
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'gardes',
      to: 'nottingham',
    })
    expect(me(s).power).toBe(0) // 2 − 2 (réduit de 1 par Couronne)
    expect(me(s).board['nottingham'].find((c) => c.cardId === 'gardes-rhinoceros')).toBeDefined()
  })

  it('Pas de réduction si la Couronne est sur un AUTRE lieu', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    const couronne: CardInstance = {
      instanceId: 'couronne',
      cardId: 'couronne-roi-richard',
      name: 'Couronne',
      type: 'item',
    }
    const gardes: CardInstance = {
      instanceId: 'gardes',
      cardId: 'gardes-rhinoceros',
      name: 'Gardes Rhino',
      type: 'ally',
      cost: 3,
      strength: 4,
    }
    s = withActive(s, {
      power: 2,
      hand: [gardes],
      board: { ...me(s).board, church: [couronne] },
    })
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'gardes', to: 'nottingham' }),
    ).toThrow(/Pas assez/)
  })
})

describe('B.6 — Flèche d\'Or', () => {
  it('+2 JT par Flèche d’Or portée par un allié utilisé', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 0,
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'gardes-rhinoceros', 4),
          { instanceId: 'fleche', cardId: 'fleche-or', name: "Flèche d'Or", type: 'item', attachedTo: 'a1' },
        ],
      },
    })
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    expect(me(s).power).toBe(2)
    // Showcase Vanquish : Héros + Allié + Objet associé (Flèche d'Or) + gain « +2 ».
    const ev = s.showcaseEvents.at(-1)
    expect(ev?.discard?.cardIds).toEqual(['belle-marianne', 'gardes-rhinoceros', 'fleche-or'])
    expect(ev?.gainedPower).toBe(2)
  })

  it('Pas de bonus Flèche d’Or si l’allié porteur n’est pas utilisé', () => {
    let s = applyAction(singleGame(7), { type: 'MOVE', to: 'nottingham' })
    s = withActive(s, {
      power: 0,
      board: {
        ...me(s).board,
        nottingham: [
          hero('h1', 'belle-marianne', 3),
          ally('a1', 'gardes-rhinoceros', 4),
          ally('a2', 'gardes-rhinoceros', 4),
          { instanceId: 'fleche', cardId: 'fleche-or', name: "Flèche d'Or", type: 'item', attachedTo: 'a2' },
        ],
      },
    })
    // On élimine avec a1 seulement ; a2 (porteur de la Flèche) ne participe pas.
    s = applyAction(s, {
      type: 'VANQUISH',
      actionId: 'vanquish',
      heroInstanceId: 'h1',
      allyInstanceIds: ['a1'],
    })
    expect(me(s).power).toBe(0)
  })
})
