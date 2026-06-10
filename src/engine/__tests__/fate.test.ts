import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { effectiveCost, effectiveStrength, getAvailableActions } from '../rules'
import type { CardInstance, GameState } from '../types'
import { me, singleGame, twoPlayerGame, withActive } from './_helpers'

describe('fondation Fatalité — deck', () => {
  it('chaque joueur a un deck Fatalité de 15 cartes, défausse vide', () => {
    const p = me(singleGame())
    expect(p.fateDeck).toHaveLength(15)
    expect(p.fateDiscard).toHaveLength(0)
    expect(new Set(p.fateDeck.map((c) => c.instanceId)).size).toBe(15)
    expect(p.fateDeck.every((c) => c.instanceId.startsWith('p0f:'))).toBe(true)
  })

  it('le deck Vilain reste à 30, indépendant du deck Fatalité', () => {
    const p = me(singleGame())
    expect(p.deck.length + p.hand.length + p.discard.length).toBe(30)
  })

  it('même graine → même deck Fatalité (déterminisme)', () => {
    expect(me(singleGame(99)).fateDeck).toEqual(me(singleGame(99)).fateDeck)
  })
})

describe('fondation Fatalité — recouvrement par un Héros', () => {
  const hero = (): CardInstance => ({
    instanceId: 'h1',
    cardId: 'robin-des-bois',
    name: 'Robin des Bois',
    type: 'hero',
    strength: 5,
  })

  // Pion à l'Église : rangée HAUT = gain-power + play-card-top ; BAS = play-card-bottom.
  const atChurch = (): GameState => applyAction(singleGame(7), { type: 'MOVE', to: 'church' })
  const withHeroAt = (s: GameState, locId: string): GameState =>
    withActive(s, { board: { ...me(s).board, [locId]: [hero()] } })

  it('sans Héros, les actions du haut et du bas sont disponibles', () => {
    const ids = getAvailableActions(atChurch())
      .map((a) => a.id)
      .sort()
    expect(ids).toEqual(['gain-power', 'move-item-ally', 'play-card-bottom', 'play-card-top'])
  })

  it('un Héros recouvre la rangée HAUT : seules les actions du bas restent', () => {
    const ids = getAvailableActions(withHeroAt(atChurch(), 'church')).map((a) => a.id)
    expect(ids).toContain('play-card-bottom') // bas → jouable
    expect(ids).not.toContain('gain-power') // haut → recouvert
    expect(ids).not.toContain('play-card-top') // haut → recouvert
  })

  it('exécuter une action recouverte est refusé', () => {
    const s = withHeroAt(atChurch(), 'church')
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })).toThrow()
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'x', to: 'church' }),
    ).toThrow()
  })

  it('un Héros sur un AUTRE lieu ne recouvre pas le lieu courant', () => {
    const ids = getAvailableActions(withHeroAt(atChurch(), 'jail')).map((a) => a.id)
    expect(ids).toContain('gain-power')
  })
})

describe('action Fatalité (B)', () => {
  const heroCard: CardInstance = {
    instanceId: 'p1f:robin#1',
    cardId: 'robin-des-bois',
    name: 'Robin des Bois',
    type: 'hero',
    strength: 5,
  }
  const otherCard: CardInstance = {
    instanceId: 'p1f:voler#1',
    cardId: 'voler-riches',
    name: 'Voler aux Riches',
    type: 'effect',
  }

  // Joueur 0 à Nottingham (action 'fate' en rangée haute), deck Fatalité du
  // joueur 1 truqué pour révéler [héros, non-héros] de façon déterministe.
  function fateReady(): GameState {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, fateDeck: [heroCard, otherCard, ...p.fateDeck] } : p,
      ),
    }
    return applyAction(s, { type: 'FATE', actionId: 'fate' })
  }

  it('FATE révèle 2 cartes du deck Fatalité adverse et arme pendingFate', () => {
    const s = fateReady()
    expect(s.pendingFate?.target).toBe(1)
    expect(s.pendingFate?.revealed.map((c) => c.instanceId)).toEqual(['p1f:robin#1', 'p1f:voler#1'])
    expect(s.usedActionIds).toContain('fate')
  })

  it('tant qu’une Fatalité est en attente, les autres coups sont refusés', () => {
    const s = fateReady()
    expect(() => applyAction(s, { type: 'END_TURN' })).toThrow()
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })).toThrow()
  })

  it('RESOLVE_FATE pose le Héros sur le lieu adverse choisi et défausse l’autre', () => {
    let s = fateReady()
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:robin#1', to: 'church' })
    expect(s.pendingFate).toBeNull()
    expect(s.players[1].board['church'].map((c) => c.instanceId)).toContain('p1f:robin#1')
    expect(s.players[1].fateDiscard.map((c) => c.instanceId)).toContain('p1f:voler#1')
  })

  it('RESOLVE_FATE d’une carte non-Héros la défausse (effet géré plus tard)', () => {
    let s = fateReady()
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:voler#1' })
    expect(s.pendingFate).toBeNull()
    const discardIds = s.players[1].fateDiscard.map((c) => c.instanceId)
    expect(discardIds).toContain('p1f:voler#1')
    expect(discardIds).toContain('p1f:robin#1') // l'autre aussi
    // rien posé sur le plateau
    expect(Object.values(s.players[1].board).flat()).toHaveLength(0)
  })

  it('un Héros sans onPlace ne change pas le pouvoir de la cible (plomberie D.1)', () => {
    let s = fateReady()
    const tgtPowerBefore = s.players[1].power
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:robin#1', to: 'church' })
    expect(s.players[1].power).toBe(tgtPowerBefore)
  })

  it('les effets onPlace d’un Héros s’appliquent à la CIBLE (plomberie D.1)', () => {
    // Truque le héros révélé pour porter un onPlace GAIN_POWER : on attend que
    // la cible (joueur 1) reçoive le pouvoir, pas le joueur actif (joueur 0).
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const hero: CardInstance = {
      instanceId: 'p1f:test-hero',
      cardId: 'test-hero',
      name: 'Héros Test',
      type: 'hero',
      strength: 1,
      onPlace: [{ type: 'GAIN_POWER', amount: 3 }],
    }
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [hero, otherCard, ...p.fateDeck] } : p)),
    }
    const p0Before = s.players[0].power
    const p1Before = s.players[1].power
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:test-hero', to: 'church' })
    expect(s.players[0].power).toBe(p0Before) // joueur actif inchangé
    expect(s.players[1].power).toBe(p1Before + 3) // CIBLE reçoit le bonus
  })

  it('Petit Jean prélève 4 JT à la cible et les stocke en lockedPower (D.3)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const petitJean: CardInstance = {
      instanceId: 'p1f:petit-jean#1',
      cardId: 'petit-jean',
      name: 'Petit Jean',
      type: 'hero',
      strength: 5,
      onPlace: [{ type: 'LOSE_POWER_TO_HOST', amount: 4 }],
    }
    // Cible (joueur 1) reçoit 10 JT pour qu'on puisse en perdre 4.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, power: 10, fateDeck: [petitJean, otherCard, ...p.fateDeck] } : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:petit-jean#1', to: 'church' })
    expect(s.players[1].power).toBe(6) // 10 − 4
    const pj = s.players[1].board['church'].find((c) => c.instanceId === 'p1f:petit-jean#1')!
    expect(pj.lockedPower).toBe(4)
  })

  it('LOSE_POWER_TO_HOST plafonné au pouvoir disponible (D.3)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const petitJean: CardInstance = {
      instanceId: 'p1f:petit-jean#1',
      cardId: 'petit-jean',
      name: 'Petit Jean',
      type: 'hero',
      strength: 5,
      onPlace: [{ type: 'LOSE_POWER_TO_HOST', amount: 4 }],
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, power: 2, fateDeck: [petitJean, otherCard, ...p.fateDeck] } : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:petit-jean#1', to: 'church' })
    expect(s.players[1].power).toBe(0)
    const pj = s.players[1].board['church'].find((c) => c.instanceId === 'p1f:petit-jean#1')!
    expect(pj.lockedPower).toBe(2)
  })

  it('Frère Tuck défausse tous les Mandats du lieu de pose (D.3)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const tuck: CardInstance = {
      instanceId: 'p1f:tuck#1',
      cardId: 'frere-tuck',
      name: 'Frère Tuck',
      type: 'hero',
      strength: 3,
      onPlace: [{ type: 'DISCARD_CARDS_AT_HOST', cardId: 'mandat-arret' }],
    }
    const mandat = (tag: string): CardInstance => ({
      instanceId: `p1:mandat#${tag}`,
      cardId: 'mandat-arret',
      name: "Mandat d'Arrêt",
      type: 'item',
      cost: 1,
    })
    // Cible (joueur 1) a 2 Mandats à Sherwood, 1 Mandat à l'Église.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: {
                ...p.board,
                sherwood: [mandat('a'), mandat('b')],
                church: [mandat('c')],
              },
              fateDeck: [tuck, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    // Pose Frère Tuck à Sherwood → les 2 Mandats de Sherwood disparaissent,
    // celui de l'Église reste.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:tuck#1', to: 'sherwood' })
    const sherwood = s.players[1].board['sherwood']
    expect(sherwood.filter((c) => c.cardId === 'mandat-arret')).toHaveLength(0)
    expect(sherwood.find((c) => c.cardId === 'frere-tuck')).toBeDefined()
    expect(s.players[1].board['church'].filter((c) => c.cardId === 'mandat-arret')).toHaveLength(1)
    // Les Mandats défaussés sont dans la défausse vilain de la cible.
    expect(s.players[1].discard.filter((c) => c.cardId === 'mandat-arret')).toHaveLength(2)
  })

  it('un Héros avec forbiddenLocations ne peut être posé sur ces lieux (D.2)', () => {
    // Truque le révélé pour avoir Dame Gertrude (forbidden = ['jail']).
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const gertrude: CardInstance = {
      instanceId: 'p1f:gertrude',
      cardId: 'dame-gertrude',
      name: 'Dame Gertrude',
      type: 'hero',
      strength: 6,
      forbiddenLocations: ['jail'],
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, fateDeck: [gertrude, otherCard, ...p.fateDeck] } : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    expect(() =>
      applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:gertrude', to: 'jail' }),
    ).toThrow(/Prison|Dame Gertrude/)
    // Tous les autres lieux acceptent.
    const ok = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:gertrude', to: 'church' })
    expect(ok.players[1].board['church'].map((c) => c.instanceId)).toContain('p1f:gertrude')
  })

  it('Roi Richard dans le royaume interdit les Événements (D.4)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const richard: CardInstance = {
      instanceId: 'p0:richard#1',
      cardId: 'roi-richard',
      name: 'Roi Richard',
      type: 'hero',
      strength: 5,
    }
    const taxes: CardInstance = {
      instanceId: 'p0:taxes#1',
      cardId: 'magnifiques-taxes',
      name: 'Magnifiques Taxes',
      type: 'effect',
      cost: 0,
      effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }],
    }
    // Joueur actif (0) a Roi Richard sur son plateau, et une carte Événement en main.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: { ...p.board, jail: [richard] }, hand: [taxes, ...p.hand] }
          : p,
      ),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'p0:taxes#1' }),
    ).toThrow(/Roi Richard/)
  })

  it('Robin des Bois retire 1 JT aux gains d’action GAIN_POWER (D.4)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'church' }) // Gagner 2
    const robin: CardInstance = {
      instanceId: 'p0:robin#1',
      cardId: 'robin-des-bois',
      name: 'Robin des Bois',
      type: 'hero',
      strength: 5,
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, jail: [robin] } } : p,
      ),
    }
    const p0Before = s.players[0].power
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.players[0].power).toBe(p0Before + 1) // 2 − 1 (Robin)
  })

  it('Robin retire 1 JT à un effet GAIN_POWER de carte aussi (D.4)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const robin: CardInstance = {
      instanceId: 'p0:robin#1',
      cardId: 'robin-des-bois',
      name: 'Robin des Bois',
      type: 'hero',
      strength: 5,
    }
    const taxes: CardInstance = {
      instanceId: 'p0:taxes#1',
      cardId: 'magnifiques-taxes',
      name: 'Magnifiques Taxes',
      type: 'effect',
      cost: 0,
      effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1 }],
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: { ...p.board, jail: [robin] }, hand: [taxes, ...p.hand] }
          : p,
      ),
    }
    const p0Before = s.players[0].power
    // 1 héros (Robin) × 1 = 1, − 1 (Robin) = 0.
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'p0:taxes#1' })
    expect(s.players[0].power).toBe(p0Before)
  })

  it('Voler aux Riches verrouille ≤4 JT sur un Héros cible (D.5)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const heroOnTarget: CardInstance = {
      instanceId: 'p1f:hero-on-board',
      cardId: 'belle-marianne',
      name: 'Belle Marianne',
      type: 'hero',
      strength: 3,
    }
    const voler: CardInstance = {
      instanceId: 'p1f:voler#1',
      cardId: 'voler-riches',
      name: 'Voler aux Riches',
      type: 'effect',
    }
    // Cible (joueur 1) : 10 JT, un Héros déjà sur son plateau à l'Église.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              power: 10,
              board: { ...p.board, church: [heroOnTarget] },
              fateDeck: [voler, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, {
      type: 'RESOLVE_FATE',
      instanceId: 'p1f:voler#1',
      targetHeroId: 'p1f:hero-on-board',
    })
    expect(s.players[1].power).toBe(6) // 10 − 4
    const hero = s.players[1].board['church'].find((c) => c.instanceId === 'p1f:hero-on-board')!
    expect(hero.lockedPower).toBe(4)
    // La carte Voler aux Riches finit dans la défausse Fatalité de la cible.
    expect(s.players[1].fateDiscard.map((c) => c.instanceId)).toContain('p1f:voler#1')
  })

  it('Mandat d’Arrêt : +2 JT à la cible quand un Héros arrive sur ce lieu (C.1)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const marianne: CardInstance = {
      instanceId: 'p1f:marianne#1',
      cardId: 'belle-marianne',
      name: 'Belle Marianne',
      type: 'hero',
      strength: 3,
    }
    const mandat: CardInstance = {
      instanceId: 'p1:mandat#1',
      cardId: 'mandat-arret',
      name: "Mandat d'Arrêt",
      type: 'item',
    }
    // Cible (joueur 1) a un Mandat à l'Église ; le joueur 0 fatalise pour y poser un Héros.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: { ...p.board, church: [mandat] },
              fateDeck: [marianne, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    const p1Before = s.players[1].power
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:marianne#1', to: 'church' })
    expect(s.players[1].power).toBe(p1Before + 2)
    // Le showcase du Héros porte le gain à animer (« +N 🪙 ») à l'atterrissage.
    const heroEv = s.showcaseEvents.find(
      (e) => e.cardId === 'belle-marianne' && e.destination?.locationId === 'church',
    )
    expect(heroEv?.landingPowerGain).toBe(2)
  })

  it('Mandat d’Arrêt : Robin des Bois réduit le gain à +1 (−1 par carte, C.1)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const marianne: CardInstance = {
      instanceId: 'p1f:marianne#1', cardId: 'belle-marianne', name: 'Belle Marianne', type: 'hero', strength: 3,
    }
    const mandat: CardInstance = {
      instanceId: 'p1:mandat#1', cardId: 'mandat-arret', name: "Mandat d'Arrêt", type: 'item',
    }
    const robin: CardInstance = {
      instanceId: 'p1f:robin#1', cardId: 'robin-des-bois', name: 'Robin', type: 'hero', strength: 5,
    }
    // J1 a Robin (dans son royaume, Sherwood) + un Mandat à l'Église.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: { ...p.board, church: [mandat], sherwood: [robin] },
              fateDeck: [marianne, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    const p1Before = s.players[1].power
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:marianne#1', to: 'church' })
    expect(s.players[1].power).toBe(p1Before + 1) // +2 Mandat − 1 (Robin)
    const heroEv = s.showcaseEvents.find(
      (e) => e.cardId === 'belle-marianne' && e.destination?.locationId === 'church',
    )
    expect(heroEv?.landingPowerGain).toBe(1)
  })

  it('Frère Tuck défausse le Mandat AVANT qu’il rapporte (C.1 + D.3)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const tuck: CardInstance = {
      instanceId: 'p1f:tuck#1',
      cardId: 'frere-tuck',
      name: 'Frère Tuck',
      type: 'hero',
      strength: 3,
      onPlace: [{ type: 'DISCARD_CARDS_AT_HOST', cardId: 'mandat-arret' }],
    }
    const mandat: CardInstance = {
      instanceId: 'p1:mandat#1',
      cardId: 'mandat-arret',
      name: "Mandat d'Arrêt",
      type: 'item',
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: { ...p.board, church: [mandat] },
              fateDeck: [tuck, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    const p1Before = s.players[1].power
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:tuck#1', to: 'church' })
    // Mandat défaussé par onPlace de Tuck → pas de gain de JT.
    expect(s.players[1].power).toBe(p1Before)
  })

  it('Voler aux Riches sans Héros cible → défaussée sans effet (D.5)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const voler: CardInstance = {
      instanceId: 'p1f:voler#1',
      cardId: 'voler-riches',
      name: 'Voler aux Riches',
      type: 'effect',
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, power: 10, fateDeck: [voler, otherCard, ...p.fateDeck] } : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:voler#1' })
    expect(s.players[1].power).toBe(10) // inchangé
    expect(s.players[1].fateDiscard.map((c) => c.instanceId)).toContain('p1f:voler#1')
  })

  it('Déguisement s’associe au Héros choisi (D.5)', () => {
    let s = applyAction(twoPlayerGame(), { type: 'MOVE', to: 'nottingham' })
    const heroOnTarget: CardInstance = {
      instanceId: 'p1f:hero-on-board',
      cardId: 'belle-marianne',
      name: 'Belle Marianne',
      type: 'hero',
      strength: 3,
    }
    const degu: CardInstance = {
      instanceId: 'p1f:degu#1',
      cardId: 'deguisement',
      name: 'Déguisement',
      type: 'item',
      attach: 'hero',
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              board: { ...p.board, sherwood: [heroOnTarget] },
              fateDeck: [degu, otherCard, ...p.fateDeck],
            }
          : p,
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, {
      type: 'RESOLVE_FATE',
      instanceId: 'p1f:degu#1',
      targetHeroId: 'p1f:hero-on-board',
    })
    const sherwood = s.players[1].board['sherwood']
    const equipped = sherwood.find((c) => c.instanceId === 'p1f:degu#1')
    expect(equipped).toBeDefined()
    expect(equipped!.attachedTo).toBe('p1f:hero-on-board')
  })

  it('MODE TEST : Voler aux Riches verrouille ≤4 JT sur un Héros du joueur actif', () => {
    let s = twoPlayerGame()
    const hero: CardInstance = {
      instanceId: 'h-test',
      cardId: 'belle-marianne',
      name: 'Belle Marianne',
      type: 'hero',
      strength: 3,
    }
    // Joueur actif (0) : un Héros à Nottingham + 6 JT (la cible du Vol = lui-même).
    s = withActive(s, { power: 6, board: { ...me(s).board, nottingham: [hero] } })
    const voler: CardInstance = {
      instanceId: 'test:voler-riches#1',
      cardId: 'voler-riches',
      name: 'Voler aux Riches',
      type: 'effect',
    }
    s = applyAction(s, { type: 'TEST_PLAY_FATE_CARD', card: voler, targetHeroId: 'h-test' })
    expect(me(s).power).toBe(2) // 6 − 4
    const h = me(s).board['nottingham'].find((c) => c.instanceId === 'h-test')!
    expect(h.lockedPower).toBe(4)
    expect(me(s).fateDiscard.map((c) => c.instanceId)).toContain('test:voler-riches#1')
  })

  it('MODE TEST : Déguisement s’associe à un Héros du joueur actif', () => {
    let s = twoPlayerGame()
    const hero: CardInstance = {
      instanceId: 'h-test',
      cardId: 'belle-marianne',
      name: 'Belle Marianne',
      type: 'hero',
      strength: 3,
    }
    s = withActive(s, { board: { ...me(s).board, nottingham: [hero] } })
    const degu: CardInstance = {
      instanceId: 'test:deguisement#1',
      cardId: 'deguisement',
      name: 'Déguisement',
      type: 'item',
      attach: 'hero',
    }
    s = applyAction(s, { type: 'TEST_PLAY_FATE_CARD', card: degu, targetHeroId: 'h-test' })
    const placed = me(s).board['nottingham'].find((c) => c.instanceId === 'test:deguisement#1')!
    expect(placed.attachedTo).toBe('h-test')
  })

  it('MODE TEST : Épée de Vérité s’associe à un Héros (+2 Force, Malédiction +2 sur le lieu)', () => {
    let s = twoPlayerGame()
    const hero: CardInstance = {
      instanceId: 'h-test', cardId: 'belle-marianne', name: 'Belle Marianne', type: 'hero', strength: 3,
    }
    s = withActive(s, { board: { ...me(s).board, nottingham: [hero] } })
    const idx = s.activePlayer
    const epee: CardInstance = {
      instanceId: 'test:epee#1', cardId: 'epee-verite', name: 'Épée de Vérité', type: 'item', attach: 'hero',
    }
    s = applyAction(s, { type: 'TEST_PLAY_FATE_CARD', card: epee, targetHeroId: 'h-test' })
    const placed = me(s).board['nottingham'].find((c) => c.instanceId === 'test:epee#1')!
    expect(placed.attachedTo).toBe('h-test')
    expect(effectiveStrength(s, idx, 'h-test')).toBe(5) // 3 + 2
    const curse: CardInstance = { instanceId: 'cu', cardId: 'feu-infernal', name: 'Feu', type: 'curse', cost: 1 }
    expect(effectiveCost(s, curse, 'nottingham')).toBe(3) // 1 + 2
  })

  it('MODE TEST : Il était un Rêve défausse une Malédiction d’un lieu avec Héros (+ showcase)', () => {
    let s = twoPlayerGame()
    const hero: CardInstance = { instanceId: 'h-test', cardId: 'belle-marianne', name: 'h', type: 'hero', strength: 3 }
    const curse: CardInstance = { instanceId: 'cu', cardId: 'feu-infernal', name: 'Feu Infernal', type: 'curse' }
    s = withActive(s, { board: { ...me(s).board, nottingham: [hero, curse] } })
    const reve: CardInstance = {
      instanceId: 'test:reve#1', cardId: 'il-etait-un-reve', name: 'Il était un Rêve', type: 'effect',
    }
    s = applyAction(s, { type: 'TEST_PLAY_FATE_CARD', card: reve, targetHeroId: 'h-test' })
    expect(me(s).board['nottingham'].find((c) => c.instanceId === 'cu')).toBeUndefined()
    expect(me(s).discard.map((c) => c.cardId)).toContain('feu-infernal')
    expect(s.showcaseEvents.at(-1)?.discard?.cardIds).toContain('feu-infernal')
  })

  it('intégration : un Héros posé par Fatalité recouvre le lieu de la cible à son tour', () => {
    let s = fateReady()
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'p1f:robin#1', to: 'church' })
    s = applyAction(s, { type: 'END_TURN' }) // → tour du joueur 1
    expect(s.activePlayer).toBe(1)
    s = applyAction(s, { type: 'MOVE', to: 'church' })
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).toContain('play-card-bottom') // bas → jouable
    expect(ids).not.toContain('gain-power') // haut → recouvert
    expect(ids).not.toContain('play-card-top') // haut → recouvert
  })
})
