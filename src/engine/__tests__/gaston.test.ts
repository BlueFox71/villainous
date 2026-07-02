import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { hasReachedObjective, totalObstacles, belleBlocksRemoval, effectiveStrength } from '../rules'
import { performVanquish, resolveEffects } from '../effects'
import { gaston } from '../../data/villains/gaston'
import { gastonCards } from '../../data/villains/gaston.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: gaston,
        deckCards: buildDeckInstances(gastonCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(gastonCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

const obs = (s: GameState) => s.players[0].obstacles ?? {}
/** Pose des cartes sur un lieu du joueur 0 (remplace la cellule). */
const setBoard = (s: GameState, locId: string, cards: CardInstance[]): GameState => ({
  ...s,
  players: [{ ...s.players[0], board: { ...s.players[0].board, [locId]: cards } }],
})
const setObstacles = (s: GameState, o: Record<string, number>): GameState => ({
  ...s,
  players: [{ ...s.players[0], obstacles: o }],
})

describe('Gaston — jetons Obstacle & objectif', () => {
  it('démarre avec 8 Obstacles (2 par lieu) et l’objectif REMOVE_ALL_OBSTACLES', () => {
    const s = game()
    expect(totalObstacles(s.players[0])).toBe(8)
    expect(Object.values(obs(s))).toEqual([2, 2, 2, 2])
    expect(s.players[0].objective).toEqual({ type: 'REMOVE_ALL_OBSTACLES' })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it('victoire seulement quand TOUS les Obstacles sont retirés', () => {
    const s = setObstacles(game(), { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 0 })
    expect(hasReachedObjective(s, 0)).toBe(true)
    const one = setObstacles(game(), { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 1 })
    expect(hasReachedObjective(one, 0)).toBe(false)
  })

  it('victoire IMMÉDIATE dès le retrait du dernier Obstacle (et non au début du tour)', () => {
    // Un seul Obstacle restant : le retirer via une action doit déclarer la victoire tout de suite.
    let s = setObstacles(game(), { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 1 })
    expect(s.status).toBe('PLAYING')
    s = resolveEffects(s, [{ type: 'REMOVE_OBSTACLE', max: 1 }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'chateau-bete' })
    expect(totalObstacles(s.players[0])).toBe(0)
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('REMOVE_OBSTACLE ouvre un choix interactif puis retire les Obstacles cliqués', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'REMOVE_OBSTACLE', max: 3 }], { actorIndex: 0 })
    expect(s.pendingObstacle?.kind).toBe('remove')
    expect(s.pendingObstacle?.remaining).toBe(3)
    for (const loc of ['taverne', 'taverne', 'bois']) {
      s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: loc })
    }
    expect(totalObstacles(s.players[0])).toBe(5)
    expect(s.pendingObstacle ?? null).toBeNull() // fermé quand remaining atteint 0
  })

  it('REMOVE_OBSTACLE sameLocation verrouille le retrait sur un seul lieu', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'REMOVE_OBSTACLE', max: 2, sameLocation: true }], { actorIndex: 0 })
    expect(s.pendingObstacle?.sameLocation).toBe(true)
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'bois' })
    expect(s.pendingObstacle?.lockedLocationId).toBe('bois')
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'bois' })
    expect(s.players[0].obstacles?.bois).toBe(0)
    expect(totalObstacles(s.players[0])).toBe(6)
    expect(s.pendingObstacle ?? null).toBeNull() // lieu verrouillé vidé → terminé
  })

  it('DONE_OBSTACLE permet d’arrêter un retrait facultatif', () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'REMOVE_OBSTACLE', max: 3 }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'taverne' })
    s = applyAction(s, { type: 'DONE_OBSTACLE' })
    expect(s.pendingObstacle ?? null).toBeNull()
    expect(totalObstacles(s.players[0])).toBe(7) // 1 seul retiré
  })

  it('Gardez-moi en otage : joue le Héros révélé puis ouvre le retrait INTERACTIF', () => {
    let s = game()
    const bb = buildDeckInstances(gastonCards, 'fate', 'p0f:').find((c) => c.cardId === 'big-ben')!
    s = { ...s, players: [{ ...s.players[0], fateDeck: [bb], fateDiscard: [] }] }
    s = resolveEffects(s, [{ type: 'REVEAL_FATE_UNTIL_HERO_PLAY', locationId: 'chateau-bete', removeObstacle: 1 }], { actorIndex: 0 })
    expect((s.players[0].board['chateau-bete'] ?? []).some((c) => c.cardId === 'big-ben')).toBe(true)
    expect(s.pendingObstacle?.kind).toBe('remove') // retrait à résoudre par clic
    expect(s.pendingObstacle?.remaining).toBe(1)
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'taverne' })
    expect(s.players[0].obstacles?.taverne).toBe(1)
    expect(totalObstacles(s.players[0])).toBe(7)
    expect(s.pendingObstacle ?? null).toBeNull()
  })

  it('Belle dans le royaume BLOQUE tout retrait (aucun pending ouvert)', () => {
    let s = game()
    const belle: CardInstance = { instanceId: 'b', cardId: 'belle', name: 'Belle', type: 'hero', strength: 2 }
    s = setBoard(s, 'maison-belle', [belle])
    expect(belleBlocksRemoval(s.players[0])).toBe(true)
    const after = resolveEffects(s, [{ type: 'REMOVE_OBSTACLE', max: 3 }], { actorIndex: 0 })
    expect(after.pendingObstacle ?? null).toBeNull()
    expect(totalObstacles(after.players[0])).toBe(8) // aucun retrait
  })

  it('REMOVE_OBSTACLES_AT_LOCATION vide un lieu précis (Vanquish Bête / Maurice)', () => {
    const s = game()
    const after = resolveEffects(s, [{ type: 'REMOVE_OBSTACLES_AT_LOCATION', locationId: 'chateau-bete' }], { actorIndex: 0 })
    expect(after.players[0].obstacles?.['chateau-bete']).toBe(0)
    expect(totalObstacles(after.players[0])).toBe(6)
  })

  it('vaincre la Bête retire tous les Obstacles du Château de la Bête', () => {
    let s = game()
    const beast: CardInstance = { instanceId: 'beast', cardId: 'la-bete', name: 'La Bête', type: 'hero', strength: 6, onVanquish: [{ type: 'REMOVE_OBSTACLES_AT_LOCATION', locationId: 'chateau-bete' }] }
    const mob: CardInstance = { instanceId: 'mob', cardId: 'foule-en-colere', name: 'Foule en colère', type: 'ally', strength: 6 }
    s = setBoard({ ...s, phase: 'ACTION' }, 'chateau-bete', [beast, mob])
    const after = performVanquish(s, 'beast', ['mob'], false)
    expect(after.players[0].obstacles?.['chateau-bete']).toBe(0)
  })

  it('REPLACE_OBSTACLE (Fatalité) : choix interactif du lieu, borné à 8', () => {
    let s = setObstacles(game(), { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 0 })
    s = resolveEffects(s, [{ type: 'REPLACE_OBSTACLE', count: 2 }], { actorIndex: 0 })
    expect(s.pendingObstacle?.kind).toBe('replace')
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'taverne' })
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'bois' })
    expect(totalObstacles(s.players[0])).toBe(2)
    expect(s.pendingObstacle ?? null).toBeNull()
    // Tout plein (8) → aucun pending, pas de dépassement.
    const full = resolveEffects(game(), [{ type: 'REPLACE_OBSTACLE', count: 2 }], { actorIndex: 0 })
    expect(full.pendingObstacle ?? null).toBeNull()
    expect(totalObstacles(full.players[0])).toBe(8)
  })

  it('REPLACE_OBSTACLE fill-location (C’est gentil de m’avoir sauvé la vie) : remplit un lieu à 2', () => {
    let s = setObstacles(game(), { 'maison-belle': 0, taverne: 1, bois: 2, 'chateau-bete': 2 })
    s = resolveEffects(s, [{ type: 'REPLACE_OBSTACLE', count: 2, mode: 'fill-location' }], { actorIndex: 0 })
    expect(s.pendingObstacle?.fillLocation).toBe(true)
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'maison-belle' })
    expect(s.players[0].obstacles?.['maison-belle']).toBe(2) // lieu rempli à fond en un clic
    expect(s.pendingObstacle ?? null).toBeNull()
  })

  it('Fatalités REPLACE_OBSTACLE résolues via le FLUX Fatalité (Me masser / C’est toi)', () => {
    const mk = () => createInitialGame(
      [
        { villain: gaston, deckCards: buildDeckInstances(gastonCards, 'villain', 'p0:'), fateCards: buildDeckInstances(gastonCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const fate = buildDeckInstances(gastonCards, 'fate', 'p0f:')
    const masser = fate.find((c) => c.cardId === 'me-masser-les-pieds')!
    const filler = fate.find((c) => c.cardId !== 'me-masser-les-pieds')!
    // « Me masser les pieds » (count 2, libre) : le fataliseur (joueur 1) replace 2 Obstacles.
    let s = mk()
    s = {
      ...s, activePlayer: 1, phase: 'ACTION',
      players: [{ ...s.players[0], obstacles: { 'maison-belle': 0, taverne: 0, bois: 2, 'chateau-bete': 2 } }, s.players[1]],
      pendingFate: { target: 0, revealed: [masser, filler] },
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: masser.instanceId })
    expect(s.pendingObstacle?.kind).toBe('replace')
    expect(s.pendingObstacle?.chooserIndex).toBe(1)
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'maison-belle' })
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'taverne' })
    expect(totalObstacles(s.players[0])).toBe(6) // 4 → 6 (effet bien appliqué, plus de fallback)

    // « C’est toi ! » (each-location, auto) : +1 sur chaque lieu non plein, sans choix.
    const cestToi = fate.find((c) => c.cardId === 'cest-toi')!
    let s2 = mk()
    s2 = {
      ...s2, activePlayer: 1, phase: 'ACTION',
      players: [{ ...s2.players[0], obstacles: { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 0 } }, s2.players[1]],
      pendingFate: { target: 0, revealed: [cestToi, filler] },
    }
    s2 = applyAction(s2, { type: 'RESOLVE_FATE', instanceId: cestToi.instanceId })
    expect(s2.pendingObstacle ?? null).toBeNull() // auto, pas de choix
    expect(totalObstacles(s2.players[0])).toBe(4) // +1 sur chacun des 4 lieux
  })

  it('REPLACE_OBSTACLE auto (Sous le charme) et each-location ne demandent pas de choix', () => {
    const empty = { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 0 }
    const swoon = resolveEffects(setObstacles(game(), empty), [{ type: 'REPLACE_OBSTACLE', count: 1, auto: true }], { actorIndex: 0 })
    expect(swoon.pendingObstacle ?? null).toBeNull()
    expect(totalObstacles(swoon.players[0])).toBe(1)
    const itIsYou = resolveEffects(setObstacles(game(), empty), [{ type: 'REPLACE_OBSTACLE', count: 1, mode: 'each-location' }], { actorIndex: 0 })
    expect(itIsYou.pendingObstacle ?? null).toBeNull()
    expect(totalObstacles(itIsYou.players[0])).toBe(4) // +1 sur chaque lieu
  })

  it('Loups : force +1 par autre Loup dans le royaume', () => {
    let s = game()
    const wolf = (n: number): CardInstance => ({ instanceId: `w${n}`, cardId: 'loups', name: 'Loups', type: 'ally', strength: 1, selfStrengthMods: [{ kind: 'per-other-same-cardId-realm', delta: 1 }] })
    s = setBoard(s, 'taverne', [wolf(1)])
    expect(effectiveStrength(s, 0, 'w1')).toBe(1)
    s = setBoard(s, 'taverne', [wolf(1), wolf(2), wolf(3)])
    expect(effectiveStrength(s, 0, 'w1')).toBe(3) // 1 + 2 autres Loups
  })

  it('Big Ben : +1 aux AUTRES Héros du lieu, pas à lui-même', () => {
    let s = game()
    const bigBen: CardInstance = { instanceId: 'bb', cardId: 'big-ben', name: 'Big Ben', type: 'hero', strength: 2, strengthMod: { target: 'heroes-here', excludeSelf: true, delta: 1 } }
    const belle: CardInstance = { instanceId: 'b', cardId: 'belle', name: 'Belle', type: 'hero', strength: 2 }
    s = setBoard(s, 'bois', [bigBen, belle])
    expect(effectiveStrength(s, 0, 'bb')).toBe(2) // pas de bonus sur lui-même
    expect(effectiveStrength(s, 0, 'b')).toBe(3) // +1 de Big Ben
  })
})

describe('Gaston — garde-fous de jouabilité (cartes sans effet)', () => {
  const play = (s: GameState, cardId: string): GameState => {
    const card = s.players[0].deck.find((c) => c.cardId === cardId) ?? buildDeckInstances(gastonCards, 'villain', 'p0:').find((c) => c.cardId === cardId)!
    const ready: GameState = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], hand: [card], power: 5, pawnLocation: 'taverne' }, ...s.players.slice(1)],
    }
    return applyAction(ready, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, to: undefined })
  }

  it('Montre-moi la Bête : injouable sans la Bête ni Belle', () => {
    const s = setBoard(game(), 'taverne', []) // royaume sans Héros
    expect(() => play(s, 'montre-moi-la-bete')).toThrow()
  })

  it('Montre-moi la Bête : jouable si la Bête est présente (retire 1 Obstacle)', () => {
    let s = setBoard(game(), 'bois', [{ instanceId: 'beast', cardId: 'la-bete', name: 'La Bête', type: 'hero', strength: 6 }])
    s = play(s, 'montre-moi-la-bete')
    expect(totalObstacles(s.players[0])).toBe(7)
  })

  it('Très mauvais caractère : injouable quand Belle bloque le retrait', () => {
    const s = setBoard(game(), 'maison-belle', [{ instanceId: 'b', cardId: 'belle', name: 'Belle', type: 'hero', strength: 2 }])
    expect(() => play(s, 'tres-mauvais-caractere')).toThrow()
  })

  it('Sortez ! : injouable s’il ne reste aucun Obstacle', () => {
    const s = setObstacles(game(), { 'maison-belle': 0, taverne: 0, bois: 0, 'chateau-bete': 0 })
    expect(() => play(s, 'sortez')).toThrow()
  })

  it('Sous le charme : injouable si les 8 Obstacles sont déjà posés', () => {
    expect(() => play(game(), 'sous-le-charme')).toThrow() // 8 Obstacles au départ
  })
})

describe('Gaston — Sous le charme (Swoon)', () => {
  it('choisit OÙ replacer l’Obstacle, puis le choix gagner Pouvoir / piocher s’ouvre', () => {
    // Il faut de la place pour replacer (sinon la carte serait injouable) : un lieu vide.
    let s = setObstacles(game(), { 'maison-belle': 0, taverne: 2, bois: 2, 'chateau-bete': 2 })
    s = resolveEffects(s, [{ type: 'REPLACE_OBSTACLE', count: 1, thenDrawOrGain: { draw: 3, power: 3 } }], { actorIndex: 0 })
    expect(s.pendingObstacle?.kind).toBe('replace')
    // 1) choix du lieu où replacer
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'maison-belle' })
    expect(s.players[0].obstacles?.['maison-belle']).toBe(1)
    expect(s.pendingObstacle ?? null).toBeNull()
    // 2) le choix gagner Pouvoir / piocher s'ouvre ensuite
    expect(s.pendingDrawOrGainPower).toEqual({ playerIndex: 0, draw: 3, power: 3 })
    const before = s.players[0].power
    s = applyAction(s, { type: 'RESOLVE_DRAW_OR_GAIN_POWER', choice: 'power' })
    expect(s.players[0].power).toBe(before + 3)
    expect(s.pendingDrawOrGainPower ?? null).toBeNull()
  })

  it('choix « piocher » : pioche 3 cartes au lieu du Pouvoir', () => {
    let s = setObstacles(game(), { 'maison-belle': 0, taverne: 2, bois: 2, 'chateau-bete': 2 })
    s = resolveEffects(s, [{ type: 'REPLACE_OBSTACLE', count: 1, thenDrawOrGain: { draw: 3, power: 3 } }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'maison-belle' })
    const handBefore = s.players[0].hand.length
    const powerBefore = s.players[0].power
    s = applyAction(s, { type: 'RESOLVE_DRAW_OR_GAIN_POWER', choice: 'draw' })
    expect(s.players[0].hand.length).toBe(handBefore + 3)
    expect(s.players[0].power).toBe(powerBefore)
  })
})

describe('Gaston — Aussi belle que moi (Condition)', () => {
  it('Gaston choisit l’Obstacle à retirer même pendant le tour de l’adversaire', () => {
    let s = createInitialGame(
      [
        { villain: gaston, deckCards: buildDeckInstances(gastonCards, 'villain', 'p0:'), fateCards: buildDeckInstances(gastonCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const cond = buildDeckInstances(gastonCards, 'villain', 'p0:').find((c) => c.cardId === 'aussi-belle-que-moi')!
    s = {
      ...s,
      activePlayer: 1, // tour de l'adversaire
      phase: 'ACTION',
      usedActionIds: ['a', 'b', 'c', 'd'], // il a réalisé ≥ 4 actions → déclencheur OK
      players: [{ ...s.players[0], hand: [cond] }, s.players[1]],
    }
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: cond.instanceId })
    expect(s.pendingObstacle?.kind).toBe('remove')
    expect(s.pendingObstacle?.chooserIndex).toBe(0) // Gaston choisit, pas l'adversaire actif
    s = applyAction(s, { type: 'RESOLVE_OBSTACLE', locationId: 'bois' })
    expect(s.players[0].obstacles?.bois).toBe(1)
    expect(totalObstacles(s.players[0])).toBe(7)
    expect(s.pendingObstacle ?? null).toBeNull()
  })
})

describe('Gaston — effets « à la pose » des Héros Fatalité', () => {
  it('Maurice : cherche son Invention dans la pioche Fatalité et l’associe à lui (Alliés −1)', () => {
    let s = game()
    const maurice: CardInstance = { instanceId: 'm', cardId: 'maurice', name: 'Maurice', type: 'hero', strength: 2 }
    const wolf: CardInstance = { instanceId: 'w', cardId: 'loups', name: 'Loups', type: 'ally', strength: 1, selfStrengthMods: [{ kind: 'per-other-same-cardId-realm', delta: 1 }] }
    s = setBoard(s, 'maison-belle', [maurice, wolf])
    const inv = buildDeckInstances(gastonCards, 'fate', 'p0f:').find((c) => c.cardId === 'invention-de-maurice')!
    s = { ...s, players: [{ ...s.players[0], fateDeck: [inv] }] }
    s = resolveEffects(s, [{ type: 'FETCH_FATE_ITEM_TO_HOST', itemCardId: 'invention-de-maurice' }], { actorIndex: 0, hostInstanceId: 'm', hostLocationId: 'maison-belle' })
    const placed = (s.players[0].board['maison-belle'] ?? []).find((c) => c.cardId === 'invention-de-maurice')
    expect(placed?.attachedTo).toBe('m')
    expect(effectiveStrength(s, 0, 'w')).toBe(0) // Loup 1 − 1 (aura Invention)
  })

  it('Maurice (flux complet) : posé via placeFateHeroWithEffects, son Bidule arrive attaché sur son lieu', () => {
    // Reproduit le vrai chemin d'une résolution de Fatalité : la pioche Fatalité
    // contient l'Invention (comme en partie), et Maurice est posé sur un lieu.
    const s = game()
    const maurice = buildDeckInstances(gastonCards, 'fate', 'p0f:').find((c) => c.cardId === 'maurice')!
    const after = placeFateHeroWithEffects(s, 0, 0, maurice, 'maison-belle', 'Maison de Belle')
    const placed = (after.players[0].board['maison-belle'] ?? []).find((c) => c.cardId === 'invention-de-maurice')
    expect(placed).toBeDefined() // le Bidule a bien été cherché et posé
    expect(placed?.attachedTo).toBe(maurice.instanceId) // associé à Maurice, sur son lieu
    // Il n'est plus ni dans la pioche ni dans la défausse Fatalité.
    expect(after.players[0].fateDeck.some((c) => c.cardId === 'invention-de-maurice')).toBe(false)
    expect(after.players[0].fateDiscard.some((c) => c.cardId === 'invention-de-maurice')).toBe(false)
  })

  it('La Bête : éloigne les Alliés de son lieu', () => {
    let s = game()
    const beast: CardInstance = { instanceId: 'beast', cardId: 'la-bete', name: 'La Bête', type: 'hero', strength: 6 }
    const w1: CardInstance = { instanceId: 'w1', cardId: 'loups', name: 'Loups', type: 'ally', strength: 1 }
    const w2: CardInstance = { instanceId: 'w2', cardId: 'loups', name: 'Loups', type: 'ally', strength: 1 }
    s = setBoard(s, 'chateau-bete', [beast, w1, w2])
    s = resolveEffects(s, [{ type: 'MOVE_ALLIES_FROM_HOST_AWAY' }], { actorIndex: 0, hostInstanceId: 'beast', hostLocationId: 'chateau-bete' })
    const ch = s.players[0].board['chateau-bete'] ?? []
    expect(ch.some((c) => c.type === 'ally')).toBe(false) // Alliés partis
    expect(ch.some((c) => c.instanceId === 'beast')).toBe(true) // la Bête reste
    const allAllies = Object.values(s.players[0].board).flat().filter((c) => c.type === 'ally')
    expect(allAllies).toHaveLength(2) // toujours en jeu, ailleurs
  })

  it('Lumière : ouvre le déplacement d’un AUTRE Héros vers n’importe quel lieu', () => {
    let s = game()
    const lum: CardInstance = { instanceId: 'l', cardId: 'lumiere', name: 'Lumière', type: 'hero', strength: 3 }
    const belle: CardInstance = { instanceId: 'h', cardId: 'belle', name: 'Belle', type: 'hero', strength: 2 }
    s = setBoard(s, 'bois', [lum])
    s = setBoard(s, 'taverne', [belle])
    s = resolveEffects(s, [{ type: 'RELOCATE_REALM_HERO_ANYWHERE' }], { actorIndex: 0, hostInstanceId: 'l', hostLocationId: 'bois' })
    expect(s.pendingHeroRelocate?.anyLocation).toBe(true)
    expect(s.pendingHeroRelocate?.candidateIds).toContain('h')
    expect(s.pendingHeroRelocate?.candidateIds).not.toContain('l') // Lumière (hôte) exclue
  })

  const samovarBoard = (s0: GameState) => {
    const mrs: CardInstance = { instanceId: 'mrs', cardId: 'mrs-samovar-et-zip', name: 'Mrs Samovar', type: 'hero', strength: 1 }
    const h1: CardInstance = { instanceId: 'h1', cardId: 'belle', name: 'Belle', type: 'hero', strength: 2 }
    const h2: CardInstance = { instanceId: 'h2', cardId: 'big-ben', name: 'Big Ben', type: 'hero', strength: 2 }
    return setBoard(s0, 'maison-belle', [mrs, h1, h2])
  }
  const locOf = (s0: GameState, id: string) =>
    s0.players[0].locations.map((l) => l.id).find((loc) => (s0.players[0].board[loc] ?? []).some((c) => c.instanceId === id))

  it('Mrs Samovar et Zip : ouvre un déplacement INTERACTIF des autres Héros (au choix, répétable)', () => {
    let s = samovarBoard(game())
    s = resolveEffects(s, [{ type: 'SCATTER_REALM_HEROES' }], { actorIndex: 0, hostInstanceId: 'mrs', hostLocationId: 'maison-belle' })
    // Pending interactif : choix parmi h1/h2 (pas Mrs), n'importe quel lieu, facultatif, répétable.
    expect(s.pendingHeroRelocate?.candidateIds).toEqual(['h1', 'h2'])
    expect(s.pendingHeroRelocate?.anyLocation).toBe(true)
    expect(s.pendingHeroRelocate?.optional).toBe(true)
    expect(s.pendingHeroRelocate?.repeatCandidates).toBe(true)
    // Déplace h1 (où l'on veut) → le pending SE ROUVRE avec seulement h2.
    s = applyAction(s, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'h1', to: 'taverne' })
    expect(locOf(s, 'h1')).toBe('taverne')
    expect(s.pendingHeroRelocate?.candidateIds).toEqual(['h2'])
    // Déplace h2 → plus de candidat → pending fermé. Mrs n'a pas bougé.
    s = applyAction(s, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'h2', to: 'bois' })
    expect(locOf(s, 'h2')).toBe('bois')
    expect(s.pendingHeroRelocate ?? null).toBeNull()
    expect(locOf(s, 'mrs')).toBe('maison-belle')
  })

  it('Mrs Samovar et Zip : facultatif — SKIP referme sans déplacer', () => {
    let s = samovarBoard(game())
    s = resolveEffects(s, [{ type: 'SCATTER_REALM_HEROES' }], { actorIndex: 0, hostInstanceId: 'mrs', hostLocationId: 'maison-belle' })
    s = applyAction(s, { type: 'SKIP_HERO_RELOCATE' })
    expect(s.pendingHeroRelocate ?? null).toBeNull()
    expect(locOf(s, 'h1')).toBe('maison-belle') // rien n'a bougé
    expect(locOf(s, 'h2')).toBe('maison-belle')
  })
})

describe('Gaston — La Rose (Fatalité, chaîne)', () => {
  const game2 = (): GameState =>
    createInitialGame(
      [
        { villain: gaston, deckCards: buildDeckInstances(gastonCards, 'villain', 'p0:'), fateCards: buildDeckInstances(gastonCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      7,
    )

  it('joue l’autre carte révélée, en fait jouer une 2ᵉ (piochée) puis retire 1 Obstacle', () => {
    let s = game2()
    const rose = buildDeckInstances(gastonCards, 'fate', 'p0f:').find((c) => c.cardId === 'la-rose')!
    // Héros « propres » (sans onPlace, ne bloquent pas le retrait) joués dans la cascade.
    const clean = (id: string): CardInstance => ({ instanceId: id, cardId: 'big-ben', name: 'Big Ben', type: 'hero', strength: 2 })
    const other = clean('other')
    const newA = clean('newA')
    const newB = clean('newB')
    // Scénario contrôlé : Prince Jean (joueur 1) fatalise Gaston (joueur 0).
    s = {
      ...s,
      activePlayer: 1,
      players: [
        { ...s.players[0], fateDeck: [newA, newB], fateDiscard: [], board: { 'maison-belle': [], taverne: [], bois: [], 'chateau-bete': [] } },
        s.players[1],
      ],
      pendingFate: { target: 0, revealed: [rose, other] },
    }
    // Joue la Rose → l'autre carte rouverte en Fatalité (non facultative).
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: rose.instanceId })
    expect(s.roseChain?.phase).toBe('play-other')
    expect(s.pendingFate?.revealed.map((c) => c.instanceId)).toEqual(['other'])
    // Résout l'autre carte (placée à la Taverne) → pioche 2 cartes, phase play-new.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'other', to: 'taverne' })
    expect(s.roseChain?.phase).toBe('play-new')
    expect(s.pendingFate?.revealed.length).toBe(2)
    const before = totalObstacles(s.players[0])
    // Joue une des 2 (placée à Bois) → fin de chaîne + 1 Obstacle retiré.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'newA', to: 'bois' })
    expect(s.roseChain ?? null).toBeNull()
    expect(s.pendingFate ?? null).toBeNull()
    expect(totalObstacles(s.players[0])).toBe(before - 1)
    // 2 Héros posés (l'autre carte + une des 2 piochées) ; la 3ᵉ reste en défausse.
    const heroes = Object.values(s.players[0].board).flat().filter((c) => c.type === 'hero')
    expect(heroes).toHaveLength(2)
  })

  it('Belle en jeu : la Rose ne retire aucun Obstacle (retrait bloqué)', () => {
    let s = game2()
    const fateInst = buildDeckInstances(gastonCards, 'fate', 'p0f:')
    const rose = fateInst.find((c) => c.cardId === 'la-rose')!
    const belle = fateInst.find((c) => c.cardId === 'belle')! // sans onPlace ; bloque le retrait
    const newA: CardInstance = { instanceId: 'newA', cardId: 'big-ben', name: 'Big Ben', type: 'hero', strength: 2 }
    s = {
      ...s,
      activePlayer: 1,
      players: [
        { ...s.players[0], fateDeck: [newA], fateDiscard: [], board: { 'maison-belle': [], taverne: [], bois: [], 'chateau-bete': [] } },
        s.players[1],
      ],
      pendingFate: { target: 0, revealed: [rose, belle] },
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: rose.instanceId })
    // Joue Belle (Maison de Belle) → bloque les retraits.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: belle.instanceId, to: 'maison-belle' })
    // play-new : 1 seule carte piochée → la jouer.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'newA', to: 'bois' })
    expect(s.roseChain ?? null).toBeNull()
    expect(totalObstacles(s.players[0])).toBe(8) // Belle bloque → aucun retrait
  })
})

describe('Gaston — Belle est à moi (action gratuite)', () => {
  it('arme une action gratuite Éliminer un Héros, puis PERFORM_GRANTED_ACTION vainc le Héros', () => {
    let s = game()
    // Met « Belle est à moi » en main, un Héros faible + un Allié fort dans le royaume.
    const card = s.players[0].deck.find((c) => c.cardId === 'belle-est-a-moi')!
    const hero: CardInstance = { instanceId: 'belle', cardId: 'belle', name: 'Belle', type: 'hero', strength: 2 }
    const ally: CardInstance = { instanceId: 'mob', cardId: 'foule-en-colere', name: 'Foule en colère', type: 'ally', strength: 4 }
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], hand: [card], power: 5, pawnLocation: 'taverne', board: { ...s.players[0].board, taverne: [hero, ally] } }],
    }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, to: undefined })
    expect(s.grantedAction?.actionType).toBe('VANQUISH')
    const after = applyAction(s, {
      type: 'PERFORM_GRANTED_ACTION',
      action: { type: 'VANQUISH', actionId: 'granted-free-action', heroInstanceId: 'belle', allyInstanceIds: ['mob'] },
    })
    expect(after.grantedAction ?? null).toBeNull()
    // Belle éliminée (plus dans le royaume).
    expect(Object.values(after.players[0].board).flat().some((c) => c.instanceId === 'belle')).toBe(false)
  })

  it('injouable s’il n’y a aucun Héros dans le royaume', () => {
    let s = game()
    const card = s.players[0].deck.find((c) => c.cardId === 'belle-est-a-moi')!
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], hand: [card], power: 5, pawnLocation: 'taverne', board: { 'maison-belle': [], taverne: [], bois: [], 'chateau-bete': [] } }],
    }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, to: undefined })).toThrow()
  })
})

describe('Gaston — Miroir magique (Fatalité)', () => {
  const game2 = (): GameState =>
    createInitialGame(
      [
        { villain: gaston, deckCards: buildDeckInstances(gastonCards, 'villain', 'p0:'), fateCards: buildDeckInstances(gastonCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      7,
    )

  it('cherche la Bête (pioche), placement au lieu choisi ; le Miroir retourne dans la pioche Fatalité', () => {
    const fate = buildDeckInstances(gastonCards, 'fate', 'p0f:')
    const miroir = { ...fate.find((c) => c.cardId === 'miroir-magique-gaston')!, instanceId: 'mir1' }
    const other = { ...fate.find((c) => c.cardId !== 'miroir-magique-gaston' && c.cardId !== 'la-bete')!, instanceId: 'oth1' }
    let s = game2()
    expect(s.players[0].fateDeck.some((c) => c.cardId === 'la-bete')).toBe(true) // Bête dans la pioche
    s = { ...s, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [miroir, other] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'mir1' })
    // Le Miroir est de retour dans la pioche Fatalité (jamais en défausse).
    expect(s.players[0].fateDeck.some((c) => c.instanceId === 'mir1')).toBe(true)
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'mir1')).toBe(false)
    // Placement de la Bête en attente, lieu au choix du joueur qui fatalise.
    expect(s.pendingFateHeroPlace?.heroCardId).toBe('la-bete')
    expect(s.pendingFateHeroPlace?.chooserIndex).toBe(1)
    // Le joueur choisit la Taverne (n'importe quel lieu).
    s = applyAction(s, { type: 'RESOLVE_FATE_HERO_PLACE', locationId: 'taverne' })
    expect((s.players[0].board['taverne'] ?? []).some((c) => c.cardId === 'la-bete')).toBe(true)
    expect(s.pendingFateHeroPlace ?? null).toBeNull()
  })
})
