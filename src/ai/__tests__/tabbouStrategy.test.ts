import { describe, it, expect } from 'vitest'
import { villainStrategyBonus, villainFateTargetingBonus } from '../villainStrategy'
import { pickRecoverCandidate, objectiveScore } from '../heuristicBot'
import { objectiveCriticalCardIds, enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { tabbou } from '../../data/villains/tabbou'
import { tabbouCards } from '../../data/villains/tabbou.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, FighterTile, GameState, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function game(): GameState {
  return createInitialGame(
    [{ villain: tabbou, deckCards: buildDeckInstances(tabbouCards, 'villain', 'x:'), fateCards: buildDeckInstances(tabbouCards, 'fate', 'xf:') }],
    1,
  )
}
function player(board: Record<string, CardInstance[]> = {}, extra: Partial<PlayerState> = {}): PlayerState {
  const g = game()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...board }, hand: [], ...extra }
}

// Fabrique une petite réserve de tuiles (tués + réserve) pour piloter la phase.
const tile = (id: string, color: FighterTile['color'], state: FighterTile['state']): FighterTile => ({
  id,
  color,
  art: '',
  name: id,
  state,
})

describe('Tabbou — couche stratégie (pour lui)', () => {
  it('valorise ses pièces maîtresses en jeu (Halberd, Bowser, Canon Géant, Ministre, Canon Obscur)', () => {
    expect(villainStrategyBonus(player({ stade: [card('halberd', 'item')] }))).toBe(4)
    expect(villainStrategyBonus(player({ stade: [card('canon-obscure', 'ally', { strength: 3 })] }))).toBe(3)
    expect(villainStrategyBonus(player({ stade: [card('canon-geant', 'item')] }))).toBe(2)
    expect(villainStrategyBonus(player({ stade: [card('ministre', 'ally', { strength: 2 })] }))).toBe(2)
    expect(villainStrategyBonus(player({ stade: [card('canon-obscure-2', 'item')] }))).toBe(1)
  })

  it('veut vaincre en priorité Samus, Link, Kirby, Pikachu (malus tant qu\'ils sont là)', () => {
    expect(villainStrategyBonus(player({ stade: [card('samus', 'hero', { strength: 3 })] }))).toBe(-10)
    expect(villainStrategyBonus(player({ stade: [card('link', 'hero', { strength: 3 })] }))).toBe(-6)
    expect(villainStrategyBonus(player({ stade: [card('kirby', 'hero', { strength: 2 })] }))).toBe(-4)
    expect(villainStrategyBonus(player({ stade: [card('pikachu-tabbou', 'hero', { strength: 2 })] }))).toBe(-3)
  })

  it('ne pénalise pas un Héros PIÉGÉ (capacité neutralisée)', () => {
    expect(villainStrategyBonus(player({ stade: [card('samus', 'hero', { strength: 3, trapped: true })] }))).toBe(0)
  })
})

describe('Tabbou — ciblage Fatalité (contre lui)', () => {
  it('la Balle Smash sur Samus/Link est valorisée, pas sur un autre Héros', () => {
    const samus = card('samus', 'hero', { strength: 3 })
    const ball = card('balle-smash', 'item', { attachedTo: samus.instanceId })
    expect(villainFateTargetingBonus(player({ stade: [samus, ball] }))).toBe(4)

    const meta = card('meta-knight', 'hero', { strength: 4 })
    const ball2 = card('balle-smash', 'item', { attachedTo: meta.instanceId })
    expect(villainFateTargetingBonus(player({ stade: [meta, ball2] }))).toBe(0)
  })
})

describe('Tabbou — cartes non-défaussables', () => {
  it('garde Halberd et Destin (KILL_FIGHTERS)', () => {
    const keep = objectiveCriticalCardIds(player())
    expect(keep.has('halberd')).toBe(true)
    expect(keep.has('destin')).toBe(true)
    expect(keep.has('primides')).toBe(false)
  })
})

describe('Tabbou — Bombe du vide (pickRecoverCandidate)', () => {
  it('récupère Halberd avant tout', () => {
    const p = player()
    const cands = [card('collection', 'effect'), card('halberd', 'item'), card('primides', 'ally')]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('halberd')
  })

  it('privilégie une carte de DÉVOILEMENT tant qu\'on n\'a pas assez révélé', () => {
    // Rien de dévoilé/tué (< 20) → phase « dévoiler » : Primides > Collection.
    const p = player({}, { fighterTiles: [] })
    const cands = [card('collection', 'effect'), card('primides', 'ally')]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('primides')
  })

  it('privilégie une carte de MISE À MORT quand assez de tuiles sont disponibles', () => {
    // 25 tuiles en réserve (≥ seuil 20) → phase « tuer » : Collection > Primides.
    const reserve = Array.from({ length: 25 }, (_, i) => tile(`r${i}`, 'gris', 'reserve'))
    const p = player({}, { fighterTiles: reserve })
    const cands = [card('collection', 'effect'), card('primides', 'ally')]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('collection')
  })

  it('le seuil passe à 30 tant que Samus est présente', () => {
    // 25 en réserve mais Samus présente (seuil 30) → encore en phase « dévoiler ».
    const reserve = Array.from({ length: 25 }, (_, i) => tile(`r${i}`, 'gris', 'reserve'))
    const p = player({ stade: [card('samus', 'hero', { strength: 3 })] }, { fighterTiles: reserve })
    const cands = [card('collection', 'effect'), card('primides', 'ally')]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('primides')
  })
})

// Construit un état en phase ACTION, pion sur le Château (action « Jouer une carte »
// disponible en rangée haute), avec `hand` et de quoi payer.
function actionState(hand: CardInstance[], extra: Partial<PlayerState> = {}): GameState {
  const g = game()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  const p0: PlayerState = { ...g.players[0], board: empty, hand, power: 10, pawnLocation: 'chateau', ...extra }
  return { ...g, activePlayer: 0, phase: 'ACTION', usedActionIds: [], players: [p0] as unknown as GameState['players'] }
}
const playable = (s: GameState, id: string) =>
  enumerateActions(s).some((a) => a.type === 'PLAY_CARD' && a.instanceId === id)

const reserveTiles = (n: number, color: FighterTile['color'] = 'gris') =>
  Array.from({ length: n }, (_, i) => tile(`r${i}`, color, 'reserve'))
const killedTiles = (n: number, color: FighterTile['color'] = 'rouge') =>
  Array.from({ length: n }, (_, i) => tile(`k${i}`, color, 'killed'))

describe('Tabbou — Coup Fatal : jouable seulement à ≥10 tuiles (ou en finisher)', () => {
  const coupFatal = () => card('coup-fatal', 'effect', { cost: 5, effects: [{ type: 'KILL_FIGHTERS_FREE', max: 10 }] })

  it('injouable avec < 10 tuiles en réserve (et loin de l\'objectif)', () => {
    const cf = coupFatal()
    expect(playable(actionState([cf], { fighterTiles: reserveTiles(9) }), cf.instanceId)).toBe(false)
  })

  it('jouable dès 10 tuiles en réserve', () => {
    const cf = coupFatal()
    expect(playable(actionState([cf], { fighterTiles: reserveTiles(10) }), cf.instanceId)).toBe(true)
  })

  it('jouable en finisher même avec < 10 (tués + réserve ≥ seuil)', () => {
    const cf = coupFatal()
    const tiles = [...killedTiles(16), ...reserveTiles(5)] // 16 + 5 = 21 ≥ 20
    expect(playable(actionState([cf], { fighterTiles: tiles }), cf.instanceId)).toBe(true)
  })
})

describe('Tabbou — Canon Obscur : ne se pose plus une fois l\'Émissaire débloqué', () => {
  const canon = () => card('canon-obscure-2', 'item', { cost: 2, attach: 'location', itemCostReductionHere: 1 })

  it('jouable tant que l\'Émissaire est verrouillé (phase d\'achat des Orbes)', () => {
    const c = canon()
    expect(playable(actionState([c], { lockedLocations: ['emissaire'] }), c.instanceId)).toBe(true)
  })

  it('injouable une fois l\'Émissaire débloqué', () => {
    const c = canon()
    expect(playable(actionState([c], { lockedLocations: [] }), c.instanceId)).toBe(false)
  })
})

describe('Tabbou — jauge objectif (rappel de forme)', () => {
  it('progresse avec les tués + un quart des tuiles en réserve', () => {
    const tiles = [
      ...Array.from({ length: 10 }, (_, i) => tile(`k${i}`, 'gris', 'killed')),
      ...Array.from({ length: 8 }, (_, i) => tile(`r${i}`, 'rouge', 'reserve')),
    ]
    // (10 + 0.25*8) / 20 = 12/20 = 0.6
    expect(objectiveScore(player({}, { fighterTiles: tiles }))).toBeCloseTo(0.6, 5)
  })
})
