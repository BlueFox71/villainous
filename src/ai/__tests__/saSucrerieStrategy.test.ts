import { describe, it, expect } from 'vitest'
import { objectiveScore } from '../heuristicBot'
import { villainStrategyBonus } from '../villainStrategy'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { saSucrerie } from '../../data/villains/sa-sucrerie'
import { saSucrerieCards } from '../../data/villains/sa-sucrerie.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `c${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function game(): GameState {
  return createInitialGame(
    [{ villain: saSucrerie, deckCards: buildDeckInstances(saSucrerieCards, 'villain', 'x:'), fateCards: buildDeckInstances(saSucrerieCards, 'fate', 'xf:') }],
    1,
  )
}
function player(board: Record<string, CardInstance[]> = {}, over: Partial<PlayerState> = {}): PlayerState {
  const g = game()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: { ...empty, ...empty, ...board }, hand: [], ...over }
}

describe('Sa Sucrerie — couche stratégie (pour lui)', () => {
  it('valorise Duncan & Wynnchel et Aigre Bill en jeu', () => {
    expect(villainStrategyBonus(player({ 'zone-1': [card('duncan-et-wynnchel', 'ally', { strength: 3 })] }))).toBe(2)
    expect(villainStrategyBonus(player({ 'zone-1': [card('aigre-bill', 'ally', { strength: 2 })] }))).toBe(1)
  })
})

describe('Sa Sucrerie — jauge d’objectif : pipeline pré-course', () => {
  it('fouille < Médaillon en main < Ralph en jeu < Ralph + prêt à vaincre < Vanellope < Bug', () => {
    const searching = objectiveScore(player())
    const medal = objectiveScore(player({}, { hand: [card('medaillon-des-heros-de-ralph', 'item')] }))
    const ralphOut = objectiveScore(player({ 'zone-1': [card('ralph-la-casse', 'hero', { strength: 6 })] }))
    const ralphReady = objectiveScore(player({ 'zone-1': [card('ralph-la-casse', 'hero', { strength: 6 }), card('duncan-et-wynnchel', 'ally', { strength: 3 })] }))
    const vanellope = objectiveScore(player({ 'zone-1': [card('vanellope-von-schweetz', 'hero', { strength: 2 })] }))
    const glitched = objectiveScore(
      player({ 'zone-1': [card('vanellope-von-schweetz', 'hero', { strength: 2 })] }, { hand: [card('bug', 'item')] }),
    )
    expect(searching).toBeLessThan(medal)
    expect(medal).toBeLessThan(ralphOut)
    expect(ralphOut).toBeLessThan(ralphReady)
    expect(ralphReady).toBeLessThan(vanellope)
    expect(vanellope).toBeLessThan(glitched)
  })

  it('course active : être devant le jeton Pilote vaut mieux qu’être derrière', () => {
    const ahead = objectiveScore(player({}, { raceActive: true, trackPos: 10, racerPos: 6 }))
    const behind = objectiveScore(player({}, { raceActive: true, trackPos: 6, racerPos: 12 }))
    expect(ahead).toBeGreaterThan(behind)
  })
})

describe('Sa Sucrerie — ciblage Fatalité (contre lui)', () => {
  it('le bot ne joue pas Vanellope (Héros-objectif) en Fatalité si une alternative existe', () => {
    const g = game()
    const vanellope = card('vanellope-von-schweetz', 'hero', { strength: 2 })
    const felix = card('felix-fixe-jr', 'hero', { strength: 3 })
    const s: GameState = { ...g, activePlayer: 0, phase: 'ACTION', pendingFate: { target: 0, revealed: [vanellope, felix] } }
    const actions = enumerateActions(s)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === vanellope.instanceId)).toBe(false)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === felix.instanceId)).toBe(true)
  })
})
