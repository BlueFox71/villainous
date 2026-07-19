import { describe, it, expect } from 'vitest'
import type { CardInstance, CombattantVerb, GameState, Location, VillainDef } from '../types'
import { createInitialGame, type PlayerSetup } from '../state'
import {
  alignment,
  captureCombattant,
  applyCombattantVerb,
  resolveCombattantRevenue,
  isLocationControlled,
  conqueredLocationCount,
  controlledLocationCount,
  combattantRevenue,
  garrisonForce,
  syncLocationControl,
} from '../spirits'
import { hasReachedObjective } from '../rules'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'

// --- Fixtures ---------------------------------------------------------------

/** 4 lieux : 2 home (loc-1/loc-2) + 2 conquérables (loc-3 def 3, loc-4 def 5). Les 2
 *  conquérables ont une face alt pour tester la bascule visuelle. */
function locations(): Location[] {
  const acts = (id: string) => [
    { id: `${id}-p`, type: 'PLAY_CARD' as const, label: 'Jouer', row: 'top' as const },
    { id: `${id}-g`, type: 'GAIN_POWER' as const, label: 'Gagner 1', row: 'bottom' as const, amount: 1 },
  ]
  return [
    { id: 'loc-1', name: 'Home A', actions: acts('a') },
    { id: 'loc-2', name: 'Home B', actions: acts('b') },
    { id: 'loc-3', name: 'Rival 3', actions: acts('c'), altName: 'Conquis 3', altActions: acts('c'), version: 'a', defense: 3 },
    { id: 'loc-4', name: 'Rival 4', actions: acts('d'), altName: 'Conquis 4', altActions: acts('d'), version: 'a', defense: 5 },
  ]
}

function combattant(
  id: string,
  sun: number,
  moon: number,
  verb: CombattantVerb,
  magnitude: number,
): CardInstance {
  return {
    instanceId: `comb:${id}`,
    cardId: id,
    name: id.toUpperCase(),
    type: 'hero',
    strength: 3,
    spiritSun: sun,
    spiritMoon: moon,
    combattantVerb: verb,
    combattantMagnitude: magnitude,
  }
}

function ally(id: string, strength: number): CardInstance {
  return { instanceId: `ally:${id}`, cardId: id, name: id, type: 'ally', strength }
}

function villain(): VillainDef {
  return {
    id: 'custom-test-sumbra',
    name: 'Sumbra Test',
    locations: locations(),
    objective: { type: 'SPIRIT_THRESHOLD', threshold: 10, camp: 'moon' },
    objectiveDescription: 'Capturez 10 esprits.',
    boardImage: '',
    pawnImage: '',
    pawnHeightPx: 100,
    backVillainImage: '',
    backFateImage: '',
  }
}

function game(combattants: CardInstance[] = []): GameState {
  const setup: PlayerSetup = {
    villain: villain(),
    deckCards: Array.from({ length: 8 }, (_, i) => ({
      instanceId: `p0:card${i}`,
      cardId: `card${i}`,
      name: `Carte ${i}`,
      type: 'ally',
      strength: 1,
      cost: 1,
    })),
    fateCards: [],
    combattantCards: combattants,
  }
  // Un 2e joueur factice (le moteur attend ≥ 2 joueurs).
  const opp: PlayerSetup = {
    villain: { ...villain(), id: 'custom-test-opp', objective: { type: 'POWER_THRESHOLD', threshold: 20 } },
    deckCards: [{ instanceId: 'p1:c', cardId: 'c', name: 'c', type: 'ally', strength: 1, cost: 1 }],
    fateCards: [],
  }
  return createInitialGame([setup, opp], 12345)
}

/** Place un Allié sur un lieu (mutation directe pour les tests de contrôle). */
function place(state: GameState, playerIndex: number, loc: string, a: CardInstance): GameState {
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, board: { ...p.board, [loc]: [...(p.board[loc] ?? []), a] } } : p,
    ),
  }
}

// --- Tests ------------------------------------------------------------------

describe('Sumbra/Kilaire — esprits & alignement', () => {
  it('camp moon : capture la valeur 🌑 ; alignement = signe(moon - sun)', () => {
    const g = game()
    const p = g.players[0]
    const sumbraAligned = combattant('x', 1, 4, 'decharge', 3) // moon 4 > sun 1 → aligné
    const killaireAligned = combattant('y', 4, 1, 'decharge', 3) // moon 1 < sun 4 → désaligné
    expect(alignment(p, sumbraAligned)).toBe(1)
    expect(alignment(p, killaireAligned)).toBe(-1)
    // Capture = valeur moon.
    expect((captureCombattant(g, 0, sumbraAligned).players[0].spirits ?? 0)).toBe(4)
    expect((captureCombattant(g, 0, killaireAligned).players[0].spirits ?? 0)).toBe(1)
  })

  it('Décharge : Bonus +N Pouvoir / Malus -N Pouvoir', () => {
    let g = game()
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)) }
    const c = combattant('x', 1, 4, 'decharge', 3)
    expect(applyCombattantVerb(g, 0, c, 1).players[0].power).toBe(8)
    expect(applyCombattantVerb(g, 0, c, -1).players[0].power).toBe(2)
  })

  it('Ferveur : ±N esprits en direct', () => {
    let g = game()
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 5 } : p)) }
    const c = combattant('x', 1, 4, 'ferveur', 2)
    expect(applyCombattantVerb(g, 0, c, 1).players[0].spirits).toBe(7)
    expect(applyCombattantVerb(g, 0, c, -1).players[0].spirits).toBe(3)
  })

  it('Surtension Malus : annule la capture du prochain Combattant', () => {
    let g = game()
    const c = combattant('x', 1, 4, 'surtension', 1)
    g = applyCombattantVerb(g, 0, c, -1) // arme le drapeau
    expect(g.players[0].combattantZeroCaptureNext).toBe(true)
    const next = combattant('y', 1, 4, 'decharge', 2)
    const after = captureCombattant(g, 0, next)
    expect(after.players[0].spirits ?? 0).toBe(0) // capture annulée
    expect(after.players[0].combattantZeroCaptureNext).toBeUndefined() // drapeau consommé
  })

  it('Aubaine : modifie le coût des cartes ce tour (signé)', () => {
    const g = game()
    const c = combattant('x', 1, 4, 'aubaine', 1)
    expect(applyCombattantVerb(g, 0, c, 1).players[0].spiritCostMod).toBe(1)
    expect(applyCombattantVerb(g, 0, c, -1).players[0].spiritCostMod).toBe(-1)
  })

  it('Renfort Malus : défausse N cartes de la main', () => {
    let g = game()
    // Donne 3 cartes en main.
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, hand: p.deck.slice(0, 3), deck: p.deck.slice(3) } : p)) }
    const before = g.players[0].hand.length
    const c = combattant('x', 1, 4, 'renfort', 2)
    const after = applyCombattantVerb(g, 0, c, -1)
    expect(after.players[0].hand.length).toBe(before - 2)
    expect(after.players[0].discard.length).toBe(2)
  })
})

describe('Sumbra/Kilaire — contrôle de lieu', () => {
  it('lieu-home toujours contrôlé ; conquérable contrôlé si garnison ≥ Défense', () => {
    let g = game()
    expect(isLocationControlled(g, 0, 'loc-1')).toBe(true) // home
    expect(isLocationControlled(g, 0, 'loc-3')).toBe(false) // rival, aucune garnison
    // Garnison insuffisante (2 < 3).
    g = place(g, 0, 'loc-3', ally('a1', 2))
    expect(isLocationControlled(g, 0, 'loc-3')).toBe(false)
    // Garnison suffisante (2 + 2 = 4 ≥ 3).
    g = place(g, 0, 'loc-3', ally('a2', 2))
    expect(garrisonForce(g, 0, 'loc-3')).toBe(4)
    expect(isLocationControlled(g, 0, 'loc-3')).toBe(true)
    expect(controlledLocationCount(g, 0)).toBe(3) // 2 home + loc-3
    expect(conqueredLocationCount(g, 0)).toBe(1)
    expect(combattantRevenue(g, 0)).toBe(1)
  })

  it('verrou (locksLocationControl) : contrôle définitif même sans Allié', () => {
    let g = game()
    g = place(g, 0, 'loc-4', { instanceId: 'lock', cardId: 'base', name: 'Base', type: 'item', locksLocationControl: true })
    expect(isLocationControlled(g, 0, 'loc-4')).toBe(true)
  })

  it('syncLocationControl bascule la face (version) quand on prend/perd le contrôle', () => {
    let g = game()
    g = place(g, 0, 'loc-3', ally('a1', 3)) // 3 ≥ 3 → contrôlé
    g = syncLocationControl(g, 0)
    const loc3 = g.players[0].locations.find((l) => l.id === 'loc-3')!
    expect(loc3.version).toBe('b')
    expect(loc3.name).toBe('Conquis 3')
  })
})

describe('Sumbra/Kilaire — revenu & victoire', () => {
  it('revenu 0 à 2 lieux (rien pioché) ; 1 à 3 lieux', () => {
    const deck = [combattant('c1', 1, 4, 'decharge', 3), combattant('c2', 1, 3, 'decharge', 2)]
    let g = game(deck)
    // 2 lieux home → revenu 0.
    const noRevenue = resolveCombattantRevenue(g, 0)
    expect(noRevenue.players[0].spirits ?? 0).toBe(0)
    // Conquiert loc-3 (garnison 3 ≥ 3) → revenu 1.
    g = place(g, 0, 'loc-3', ally('a', 3))
    const rev = resolveCombattantRevenue(g, 0)
    // 1 Combattant pioché : capture sa valeur moon (c1 = 4).
    expect((rev.players[0].spirits ?? 0)).toBeGreaterThanOrEqual(4)
    expect(rev.players[0].combattantDiscard?.length).toBe(1)
  })

  it('victoire quand esprits ≥ seuil', () => {
    let g = game()
    expect(hasReachedObjective(g, 0)).toBe(false)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 10 } : p)) }
    expect(hasReachedObjective(g, 0)).toBe(true)
  })

  it('applyAction (post-action) synchronise le contrôle : la pose bascule la face', () => {
    // (déplacé ci-dessous après le bloc effets pour rester groupé)
    void 0
  })
})

describe('Sumbra/Kilaire — effets de cartes', () => {
  it('CAPTURE_SPIRITS ajoute des esprits ; FORMATION (fuite) en retire 1 par capture', () => {
    let g = game()
    g = resolveEffect(g, { type: 'CAPTURE_SPIRITS', amount: 3 }, { actorIndex: 0 })
    expect(g.players[0].spirits).toBe(3)
    // Pose une Formation (reducesSpiritCapture) → capture suivante −1.
    g = place(g, 0, 'loc-1', { instanceId: 'form', cardId: 'formation', name: 'Formation', type: 'item', reducesSpiritCapture: true })
    g = resolveEffect(g, { type: 'CAPTURE_SPIRITS', amount: 3 }, { actorIndex: 0 })
    expect(g.players[0].spirits).toBe(3 + 2) // 3 - 1 (fuite) = 2
  })

  it('DRAW_COMBATTANT_BONUS pioche 1 Combattant et force le Bonus', () => {
    // Combattant désaligné pour Sumbra (sun>moon) mais Bonus FORCÉ (Décharge +2 Pouvoir).
    const deck = [combattant('c1', 4, 1, 'decharge', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 1 } : p)) }
    g = resolveEffect(g, { type: 'DRAW_COMBATTANT_BONUS' }, { actorIndex: 0 })
    // Capture moon (1) + Bonus Décharge +2 Pouvoir.
    expect(g.players[0].spirits).toBe(1)
    expect(g.players[0].power).toBe(3)
    expect(g.players[0].combattantDiscard?.length).toBe(1)
  })

  it('CHOC_DES_TITANS capture la somme des deux camps et paie 2 pour le Bonus', () => {
    const deck = [combattant('c1', 1, 4, 'ferveur', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)) }
    g = resolveEffect(g, { type: 'CHOC_DES_TITANS' }, { actorIndex: 0 })
    // Capture somme (1+4=5) + Bonus Ferveur (+2) car ≥2 Pouvoir ; paie 2 Pouvoir.
    expect(g.players[0].spirits).toBe(5 + 2)
    expect(g.players[0].power).toBe(3)
  })

  it('FATE_DRAW_COMBATTANT (COMBATTANT) : pose un Héros + retire les esprits adverses', () => {
    const deck = [combattant('c1', 3, 1, 'decharge', 2)] // camp adverse (sun) = 3
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 5 } : p)) }
    // Fatalité contre le joueur 0 (idx = actor = cible).
    g = resolveEffect(g, { type: 'FATE_DRAW_COMBATTANT', asHero: true }, { actorIndex: 0, playedBy: 1 })
    expect(g.players[0].spirits).toBe(2) // 5 - 3 (sun adverse)
    const pawn = g.players[0].pawnLocation!
    expect((g.players[0].board[pawn] ?? []).some((c) => c.cardId === 'c1' && c.type === 'hero')).toBe(true)
  })

  it('LOSE_SPIRITS_LAST_COMBATTANT both : retire la somme des deux camps du dernier pioché', () => {
    const deck = [combattant('c1', 2, 3, 'decharge', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 8 } : p)) }
    // Pioche d'abord un Combattant (met à jour lastCombattantDrawn) via revenu forcé.
    g = place(g, 0, 'loc-3', ally('a', 3)) // conquiert → revenu 1
    g = resolveEffect(g, { type: 'DRAW_COMBATTANT_BONUS' }, { actorIndex: 0 }) // pioche c1 → last = {2,3}
    const before = g.players[0].spirits ?? 0
    g = resolveEffect(g, { type: 'LOSE_SPIRITS_LAST_COMBATTANT', scope: 'both' }, { actorIndex: 0 })
    expect(g.players[0].spirits).toBe(Math.max(0, before - 5))
  })

  it('applyAction (post-action) synchronise le contrôle : la pose bascule la face', () => {
    // Vérifie l'intégration : après une action, syncLocationControlAll flippe le lieu.
    let g = game()
    // Simule une pose d'Allié suffisante via mutation + une action neutre (END_TURN sur l'autre).
    g = place(g, 0, 'loc-3', ally('a', 4))
    // Une action quelconque du joueur 0 déclenche la synchro.
    const moved = applyAction(g, { type: 'MOVE', to: 'loc-3' })
    const loc3 = moved.players[0].locations.find((l) => l.id === 'loc-3')!
    expect(loc3.version).toBe('b')
  })
})
