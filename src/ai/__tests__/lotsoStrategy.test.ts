import { describe, it, expect } from 'vitest'
import { objectiveScore } from '../heuristicBot'
import { villainStrategyBonus, villainFateTargetingBonus } from '../villainStrategy'
import { enumerateActions } from '../enumerate'
import { createInitialGame } from '../../engine/state'
import { lotso } from '../../data/villains/lotso'
import { lotsoCards } from '../../data/villains/lotso.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `l${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function lotsoGame(): GameState {
  return createInitialGame(
    [{ villain: lotso, deckCards: buildDeckInstances(lotsoCards, 'villain', 'x:'), fateCards: buildDeckInstances(lotsoCards, 'fate', 'xf:') }],
    1,
  )
}
function lotsoPlayer(board: Record<string, CardInstance[]> = {}, over: Partial<PlayerState> = {}): PlayerState {
  const g = lotsoGame()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  // La Salle démarre avec Buzz (Gardien) : on part d'un plateau VIDE et on remet ce qu'on veut.
  return { ...g.players[0], board: { ...empty, ...board }, hand: [], ...over }
}

const room = 'salle-des-chenilles'
const heroIds = ['bayonne', 'jessie', 'rex', 'woody']
const zeroHero = (id: string) => card(id, 'hero', { strength: 0 })
const buzz = () => card('buzz-l-eclair', 'ally', { strength: 4, isBuzz: true })

describe('Lotso — couche stratégie (pour lui)', () => {
  it('valorise Big Baby, le Chapeau de Woody et Flex en jeu', () => {
    expect(villainStrategyBonus(lotsoPlayer({ [room]: [card('big-baby', 'ally', { strength: 3 })] }))).toBe(3)
    expect(villainStrategyBonus(lotsoPlayer({ [room]: [card('chapeau-de-woody', 'item')] }))).toBe(2)
    expect(villainStrategyBonus(lotsoPlayer({ [room]: [card('flex', 'ally', { strength: 2 })] }))).toBe(1)
  })

  it('jauge objectif : pipeline en jeu → corralé → force 0 ; victoire à 4/4 + Buzz', () => {
    const inPlayElsewhere = objectiveScore(lotsoPlayer({ bibliotheque: [card('woody', 'hero', { strength: 1 })] }))
    const corralled = objectiveScore(lotsoPlayer({ [room]: [card('woody', 'hero', { strength: 1 })] }))
    const reduced = objectiveScore(lotsoPlayer({ [room]: [zeroHero('woody')] }))
    expect(corralled).toBeGreaterThan(inPlayElsewhere)
    expect(reduced).toBeGreaterThan(corralled)
    // Victoire : les 4 Héros à 0 dans la Salle + Buzz.
    const win = objectiveScore(lotsoPlayer({ [room]: [...heroIds.map(zeroHero), buzz()] }))
    expect(win).toBe(1)
    // Sans Buzz : pas encore gagné.
    const noBuzz = objectiveScore(lotsoPlayer({ [room]: heroIds.map(zeroHero) }))
    expect(noBuzz).toBeLessThan(1)
  })
})

describe('Lotso — ciblage Fatalité (contre lui)', () => {
  it('encombre la Bibliothèque ET la Cour de Récréation avec un Héros', () => {
    expect(villainFateTargetingBonus(lotsoPlayer({ bibliotheque: [card('woody', 'hero', { strength: 1 })] }))).toBe(4)
    expect(villainFateTargetingBonus(lotsoPlayer({ 'cour-de-recreation': [card('rex', 'hero', { strength: 1 })] }))).toBe(4)
    expect(villainFateTargetingBonus(lotsoPlayer({ [room]: [card('woody', 'hero', { strength: 1 })] }))).toBe(0)
  })

  it('le bot ne joue pas un Héros-objectif de Lotso en Fatalité si une alternative existe', () => {
    const g = lotsoGame()
    const woody = card('woody', 'hero', { strength: 1 })
    const claw = card('le-grappin', 'effect', { deck: 'fate' })
    const s: GameState = { ...g, activePlayer: 0, phase: 'ACTION', pendingFate: { target: 0, revealed: [woody, claw] } }
    const actions = enumerateActions(s)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === woody.instanceId)).toBe(false)
    expect(actions.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === claw.instanceId)).toBe(true)
  })
})
