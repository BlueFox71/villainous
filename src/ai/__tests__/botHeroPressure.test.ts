import { describe, it, expect } from 'vitest'
import { evaluate, objectiveScore, chooseAction, trimHandAction } from '../heuristicBot'
import { enumerateActions } from '../enumerate'
import { applyAction } from '../../engine/actions'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { teamRocket } from '../../data/villains/team-rocket'
import { teamRocketCards } from '../../data/villains/team-rocket.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

const bowserSetup = () => ({
  villain: bowser,
  deckCards: buildDeckInstances(bowserCards, 'villain', 'b:'),
  fateCards: buildDeckInstances(bowserCards, 'fate', 'bf:'),
})
const trSetup = () => ({
  villain: teamRocket,
  deckCards: buildDeckInstances(teamRocketCards, 'villain', 't:'),
  fateCards: buildDeckInstances(teamRocketCards, 'fate', 'tf:'),
})

/** Vide le plateau du joueur `idx` puis y applique `board` (+ champs joueur). */
function withBoard(
  g: GameState,
  idx: number,
  board: Record<string, CardInstance[]>,
  extra: Partial<GameState['players'][number]> = {},
): GameState {
  const empty = Object.fromEntries(g.players[idx].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  const p = { ...g.players[idx], board: { ...empty, ...board }, ...extra }
  const players = [...g.players]
  players[idx] = p
  return { ...g, players: players as GameState['players'] }
}

describe('A1 — un Héros qui recouvre mes actions est plus pénalisant (incite à le vaincre)', () => {
  it('à force égale, un Héros ACTIF (recouvre le haut) baisse plus mon éval qu’un Héros hypnotisé (ne recouvre plus)', () => {
    const g = createInitialGame([bowserSetup(), bowserSetup()], 1)
    const active: CardInstance = { instanceId: 'h1', cardId: 'mario', name: 'Mario', type: 'hero', strength: 5 }
    const hypno: CardInstance = { ...active, hypnotized: true }
    const gActive = withBoard(g, 0, { galaxies: [active] }, { observatoryStars: 2 })
    const gHypno = withBoard(g, 0, { galaxies: [hypno] }, { observatoryStars: 2 })
    // Seul diffère le recouvrement (la pénalité de force est identique) → l'actif est pire.
    expect(evaluate(gActive, 0)).toBeLessThan(evaluate(gHypno, 0))
  })
})

describe('B2 — le bot pose Luigi sur le lieu au plus d’Alliés porteurs d’Étoile', () => {
  it('restreint les lieux candidats de Luigi au lieu le plus « chargé » en Étoiles', () => {
    let g = createInitialGame([bowserSetup(), bowserSetup()], 1)
    // Joueur 1 = Bowser ciblé : 2 Alliés porteurs d'Étoile aux Galaxies, un Allié nu au Château.
    const star = (id: string): CardInstance => ({ instanceId: id, cardId: 'kamella', name: 'kamella', type: 'ally', strength: 3, stars: 1 })
    const nu = (id: string): CardInstance => ({ instanceId: id, cardId: 'kamella', name: 'kamella', type: 'ally', strength: 3 })
    g = withBoard(g, 1, { galaxies: [star('s1'), star('s2')], 'chateau-bowser': [nu('n1')] }, { observatoryStars: 2 })
    const luigi: CardInstance = { instanceId: 'lu', cardId: 'luigi', name: 'Luigi', type: 'hero', strength: 3 }
    const state: GameState = { ...g, activePlayer: 0, pendingFate: { target: 1, revealed: [luigi] } }
    const luigiPlacements = enumerateActions(state).filter(
      (a): a is Extract<typeof a, { type: 'RESOLVE_FATE' }> => a.type === 'RESOLVE_FATE' && a.instanceId === 'lu',
    )
    expect(luigiPlacements.length).toBeGreaterThan(0)
    expect(luigiPlacements.every((a) => a.to === 'galaxies')).toBe(true)
  })
})

describe('C2 — la jauge Team Rocket crédite un Pokémon COUCHÉ (prêt à attraper)', () => {
  it('un Pokémon couché non encore capturé fait monter objectiveScore', () => {
    const g = createInitialGame([trSetup(), trSetup()], 1)
    const ko: CardInstance = { instanceId: 'pk', cardId: 'togepi', name: 'Togepi', type: 'hero', isPokemon: true, strength: 1, pokemonKO: true, koOnTurn: g.turn }
    const withKo = withBoard(g, 0, { foret: [ko] })
    const without = withBoard(g, 0, { foret: [] })
    expect(objectiveScore(withKo.players[0])).toBeGreaterThan(objectiveScore(without.players[0]))
  })
})

describe('A — Bowser BANQUE ses Étoiles quand un renvoyeur (Mario) est présent', () => {
  const starAlly = (id: string): CardInstance => ({ instanceId: id, cardId: 'kamella', name: 'kamella', type: 'ally', strength: 3, stars: 1 })
  const mario = (): CardInstance => ({ instanceId: 'm1', cardId: 'mario', name: 'Mario', type: 'hero', strength: 4 })

  it('avec Mario en jeu, une Étoile BANKÉE (Allié sacrifié) vaut mieux qu’une Étoile sur un Allié', () => {
    const g = createInitialGame([bowserSetup(), bowserSetup()], 1)
    // Observatoire à 0 : la seule question est « garder l'Étoile sur l'Allié » vs « l'avoir bankée ».
    const onAlly = withBoard(g, 0, { galaxies: [starAlly('a1')], 'chateau-peach': [mario()] }, { observatoryStars: 0 })
    const banked = withBoard(g, 0, { galaxies: [], 'chateau-peach': [mario()] }, { observatoryStars: 0 })
    expect(evaluate(banked, 0)).toBeGreaterThan(evaluate(onAlly, 0))
  })

  it('l’incitation à banker est PLUS forte avec un renvoyeur que sans', () => {
    const g = createInitialGame([bowserSetup(), bowserSetup()], 1)
    const gapWith =
      evaluate(withBoard(g, 0, { galaxies: [], 'chateau-peach': [mario()] }, { observatoryStars: 0 }), 0) -
      evaluate(withBoard(g, 0, { galaxies: [starAlly('a1')], 'chateau-peach': [mario()] }, { observatoryStars: 0 }), 0)
    const gapWithout =
      evaluate(withBoard(g, 0, { galaxies: [] }, { observatoryStars: 0 }), 0) -
      evaluate(withBoard(g, 0, { galaxies: [starAlly('a1')] }, { observatoryStars: 0 }), 0)
    expect(gapWith).toBeGreaterThan(gapWithout)
  })
})

describe('B — le bot défausse l’excédent de main (au-delà de 4), les moins importantes', () => {
  it('trimHandAction jette l’excédent en gardant les cartes cruciales pour l’objectif', () => {
    const g = createInitialGame([bowserSetup(), bowserSetup()], 1)
    // Main de 6 : impuissance (cruciale Bowser) + Allié fort + 4 Événements faibles.
    const hand: CardInstance[] = [
      { instanceId: 'imp', cardId: 'impuissance', name: 'Impuissance', type: 'effect' },
      { instanceId: 'ally', cardId: 'kamella', name: 'kamella', type: 'ally', strength: 3 },
      { instanceId: 'e1', cardId: 'festival', name: 'Festival', type: 'effect' },
      { instanceId: 'e2', cardId: 'festival2', name: 'Festival', type: 'effect' },
      { instanceId: 'e3', cardId: 'festival3', name: 'Festival', type: 'effect' },
      { instanceId: 'e4', cardId: 'festival4', name: 'Festival', type: 'effect' },
    ]
    const p0 = { ...g.players[0], hand }
    const state: GameState = { ...g, players: [p0, g.players[1]] as GameState['players'], phase: 'ACTION' }
    const trim = trimHandAction(state, 0)
    expect(trim?.type).toBe('DISCARD_HAND_CARDS')
    const ids = (trim as Extract<GameAction, { type: 'DISCARD_HAND_CARDS' }>).instanceIds
    expect(ids).toHaveLength(2) // 6 − limite 4
    expect(ids).not.toContain('imp') // carte cruciale gardée
    expect(ids).not.toContain('ally') // Allié fort gardé
    expect(ids.every((id) => id.startsWith('e'))).toBe(true) // ce sont les Événements faibles
  })

  it('DISCARD_HAND_CARDS retire bien les cartes visées de la main', () => {
    const g = createInitialGame([bowserSetup(), bowserSetup()], 1)
    const hand: CardInstance[] = [
      { instanceId: 'x1', cardId: 'festival', name: 'Festival', type: 'effect' },
      { instanceId: 'x2', cardId: 'festival', name: 'Festival', type: 'effect' },
    ]
    const p0 = { ...g.players[0], hand }
    const state: GameState = { ...g, players: [p0, g.players[1]] as GameState['players'], phase: 'ACTION' }
    const after = applyAction(state, { type: 'DISCARD_HAND_CARDS', instanceIds: ['x1'] })
    expect(after.players[0].hand.map((c) => c.instanceId)).toEqual(['x2'])
    expect(after.players[0].discard.some((c) => c.instanceId === 'x1')).toBe(true)
  })
})

describe('C3 — le bot priorise « On n’abandonne pas ses amis » (reprise d’un Pokémon capturé)', () => {
  it('joue l’Événement de reprise plutôt qu’un Héros quand la cible a un Pokémon capturé ≤3', () => {
    let g = createInitialGame([bowserSetup(), trSetup()], 1)
    // Joueur 1 = Team Rocket avec un Pokémon capturé de force 3 (repris par l'Événement).
    const captured: CardInstance = { instanceId: 'cap', cardId: 'goupix', name: 'Goupix', type: 'hero', isPokemon: true, strength: 3 }
    g = withBoard(g, 1, {}, { capturedPokemon: [captured] })
    const uncapture: CardInstance = {
      instanceId: 'oa', cardId: 'on-abandonne-pas', name: "On n'abandonne pas ses amis", type: 'effect',
      effects: [{ type: 'UNCAPTURE_POKEMON_LE', maxStrength: 3 }],
    }
    const weakHero: CardInstance = { instanceId: 'wh', cardId: 'luigi', name: 'Luigi', type: 'hero', strength: 1 }
    const state: GameState = { ...g, activePlayer: 0, pendingFate: { target: 1, revealed: [uncapture, weakHero] } }
    const action = chooseAction(state, () => 0)
    expect(action.type).toBe('RESOLVE_FATE')
    expect((action as Extract<typeof action, { type: 'RESOLVE_FATE' }>).instanceId).toBe('oa')
  })
})
