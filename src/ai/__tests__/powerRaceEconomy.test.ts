// =============================================================================
// Économie « course au Pouvoir » (cf. PowerRaceEconomy dans heuristicBot).
//
// Contexte du correctif : pour un vilain dont le Pouvoir EST le compteur de victoire,
// 1 JT vaut `objective / seuil + myPower` points (Prince Jean : 56). Les termes de
// plateau étant à l'échelle unité (Allié Force 4 = 8 pts), TOUTE carte payante était
// dominée : le bot thésaurisait, ne posait ni Allié ni Mandat d'Arrêt, n'éliminait
// jamais, et laissait les Héros s'accumuler. On vérifie ici le comportement rétabli.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { chooseAction, evaluate, objectiveScore, DEFAULT_WEIGHTS } from '../heuristicBot'
import { applyAction } from '../../engine/actions'
import { nextRandom } from '../../engine/rng'
import { createInitialGame } from '../../engine/state'
import { buildDeckInstances } from '../../data/types'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import type { CardInstance, GameState, PlayerState } from '../../engine/types'

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    const r = nextRandom(s)
    s = r.state
    return r.value
  }
}

// Les fixtures sont tirées des VRAIES cartes (coût/force/champs passifs inclus) : elles
// restent ainsi synchrones avec la donnée du deck.
const ALL_PJ = [
  ...buildDeckInstances(princeJohnCards, 'villain', 'x:'),
  ...buildDeckInstances(princeJohnCards, 'fate', 'xf:'),
]
function card(cardId: string, instanceId = `t:${cardId}`): CardInstance {
  const found = ALL_PJ.find((c) => c.cardId === cardId)
  if (!found) throw new Error(`carte inconnue : ${cardId}`)
  return { ...found, instanceId }
}

/** Partie Prince Jean (p0, à qui c'est le tour) vs Maléfique (p1). */
function game(seed = 5): GameState {
  return createInitialGame(
    [
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p0:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p0f:') },
      { villain: maleficent, deckCards: buildDeckInstances(maleficentCards, 'villain', 'p1:'), fateCards: buildDeckInstances(maleficentCards, 'fate', 'p1f:') },
    ],
    seed,
  )
}

/** Prépare un tour de Prince Jean : pion posé, main imposée, plateau imposé. */
function pjTurn(patch: Partial<PlayerState>, board: Record<string, CardInstance[]> = {}): GameState {
  const g = game()
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  const p0: PlayerState = { ...g.players[0], board: { ...empty, ...board }, ...patch }
  return {
    ...g,
    activePlayer: 0,
    phase: 'ACTION',
    usedActionIds: [],
    players: [p0, g.players[1]] as GameState['players'],
  }
}

/** Joue le tour du bot jusqu'au bout (passage de main) et renvoie l'état atteint. */
function playOutTurn(s: GameState, seed = 1): GameState {
  const rand = seededRand(seed)
  let steps = 0
  while (s.status === 'PLAYING' && s.activePlayer === 0 && steps < 60) {
    s = applyAction(s, chooseAction(s, rand))
    steps++
  }
  return s
}

const onBoard = (s: GameState, cardId: string): boolean =>
  Object.values(s.players[0].board).flat().some((c) => c.cardId === cardId)

describe('vilain-Pouvoir — il investit enfin son Pouvoir dans son plateau', () => {
  it('pose un Mandat d’Arrêt (moteur de Pouvoir à 1 JT) au lieu de thésauriser', () => {
    // Avant le correctif : −56 pts pour 1 JT dépensé contre +3 pts d'`enginePieces`
    // → la carte n'était JAMAIS jouée (0 sur 5 parties de self-play).
    const s = pjTurn({ pawnLocation: 'church', power: 3, hand: [card('mandat-arret')] })
    expect(onBoard(playOutTurn(s), 'mandat-arret')).toBe(true)
  })

  it('achète du muscle quand un Héros occupe son royaume', () => {
    const s = pjTurn(
      { pawnLocation: 'church', power: 4, hand: [card('gardes-rhinoceros')] },
      { church: [card('toby', 'h:toby')] },
    )
    expect(onBoard(playOutTurn(s), 'gardes-rhinoceros')).toBe(true)
  })

  it('s’en abstient quand son royaume est dégagé (sans Héros à déloger, la Force ne sert à rien)', () => {
    const s = pjTurn({ pawnLocation: 'church', power: 4, hand: [card('gardes-rhinoceros')] })
    const after = playOutTurn(s)
    expect(onBoard(after, 'gardes-rhinoceros')).toBe(false)
    expect(after.players[0].power).toBeGreaterThan(4) // il a encaissé plutôt que dépensé
  })

  it('discipline finale : à 18 JT sur 20, il ne dépense plus (il file gagner)', () => {
    // Héros à Nottingham (et non à l'Église) : le « Gagner 2 » de l'Église reste
    // disponible, donc encaisser est bien une option — c'est celle qu'il doit prendre.
    const s = pjTurn(
      { pawnLocation: 'church', power: 18, hand: [card('gardes-rhinoceros')] },
      { nottingham: [card('toby', 'h:toby')] },
    )
    const after = playOutTurn(s)
    expect(onBoard(after, 'gardes-rhinoceros')).toBe(false)
    expect(after.players[0].power).toBeGreaterThanOrEqual(20)
  })
})

describe('vilain-Pouvoir — la gêne des Héros est libellée en Pouvoir', () => {
  it('un Héros PRIORITAIRE (Robin des Bois) coûte plus d’1 JT de plus qu’un Héros de même force', () => {
    // Sans ce libellé, `priorityVanquish: 10` valait 10 points, soit 0,18 JT : le bot
    // n'aurait jamais échangé des Alliés contre son élimination.
    const robin = card('robin-des-bois', 'h:robin')
    const plain = { ...card('petit-jean', 'h:plain'), onPlace: undefined } // même force 5, sans capacité
    const withRobin = pjTurn({ power: 6 }, { sherwood: [robin] })
    const withPlain = pjTurn({ power: 6 }, { sherwood: [plain] })
    const gap = evaluate(withPlain, 0) - evaluate(withRobin, 0)
    const onePower = DEFAULT_WEIGHTS.objective / 20 + DEFAULT_WEIGHTS.myPower
    expect(gap).toBeGreaterThan(onePower)
  })

  it('un Héros qui recouvre une action « Gagner » pèse plus que sur un lieu sans revenu', () => {
    // La Prison n'a pas de rangée haute (son « Gagner 3 » est intouchable) ; l'Église
    // perd 2 JT/tour. À Héros identique, l'Église doit être la position la plus pénalisante.
    const atChurch = pjTurn({ power: 6 }, { church: [card('toby', 'h:toby')] })
    const atJail = pjTurn({ power: 6 }, { jail: [card('toby', 'h:toby')] })
    expect(evaluate(atChurch, 0)).toBeLessThan(evaluate(atJail, 0))
  })
})

describe('garde-fous du modèle', () => {
  it('la jauge d’objectif (affichée à l’UI) reste honnête : un plateau garni ne la fait pas monter', () => {
    const bare = pjTurn({ power: 6 })
    const stocked = pjTurn({ power: 6 }, { church: [card('gardes-rhinoceros'), card('mandat-arret')] })
    expect(objectiveScore(stocked.players[0])).toBe(objectiveScore(bare.players[0]))
  })

  it('un vilain NON-Pouvoir (Maléfique) est totalement insensible au modèle', () => {
    const g = game()
    const s: GameState = { ...g, activePlayer: 1 }
    const off = { ...DEFAULT_WEIGHTS, powerRace: null }
    expect(evaluate(s, 1, DEFAULT_WEIGHTS)).toBe(evaluate(s, 1, off))
  })
})
