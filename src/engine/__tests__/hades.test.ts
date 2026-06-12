import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { moveTitanTo } from '../effects'
import { hasReachedObjective, getAvailableActions, effectiveStrength } from '../rules'
import { nextRandom } from '../rng'
import { chooseAction } from '../../ai/heuristicBot'
import { hades } from '../../data/villains/hades'
import { hadesCards } from '../../data/villains/hades.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    const r = nextRandom(s)
    s = r.state
    return r.value
  }
}

const titan = (id: string, cardId: string, strength: number): CardInstance => ({
  instanceId: id, cardId, name: cardId, type: 'ally', strength, isTitan: true,
})
const hero = (id: string, cardId: string, strength: number): CardInstance => ({
  instanceId: id, cardId, name: cardId, type: 'hero', strength,
})

function game(): GameState {
  return createInitialGame(
    [
      { villain: hades, deckCards: buildDeckInstances(hadesCards, 'villain', 'p0:'), fateCards: buildDeckInstances(hadesCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    7,
  )
}

/** État ACTION avec le board d'Hadès (joueur 0) écrasé par `board`, pion sur `pawn`. */
function withBoard(board: Record<string, CardInstance[]>, pawn = 'enfers', power = 10): GameState {
  const base = game()
  return {
    ...base,
    activePlayer: 0,
    phase: 'ACTION',
    players: base.players.map((p, i) =>
      i === 0 ? { ...p, pawnLocation: pawn, power, board: { ...p.board, ...board } } : p,
    ),
  }
}

describe('Hadès — objectif (3 Titans non entravés au Mont Olympe)', () => {
  it('3 Titans non entravés sur le Mont Olympe = objectif atteint', () => {
    const s = withBoard({ 'mont-olympe': [titan('t1', 'lythos', 4), titan('t2', 'pyros', 4), titan('t3', 'arges', 4)] })
    expect(hasReachedObjective(s)).toBe(true)
  })

  it('un Titan entravé ne compte pas', () => {
    const t3 = { ...titan('t3', 'arges', 4), trapped: true }
    const s = withBoard({ 'mont-olympe': [titan('t1', 'lythos', 4), titan('t2', 'pyros', 4), t3] })
    expect(hasReachedObjective(s)).toBe(false)
  })

  it('Titans répartis sur d’autres lieux = pas encore gagné', () => {
    const s = withBoard({
      'mont-olympe': [titan('t1', 'lythos', 4), titan('t2', 'pyros', 4)],
      jardins: [titan('t3', 'arges', 4)],
    })
    expect(hasReachedObjective(s)).toBe(false)
  })
})

describe('Hadès — déplacement des Titans', () => {
  it('l’action « Déplacer un Objet ou un Allié » déplace un Titan GRATUITEMENT', () => {
    const s = withBoard({ enfers: [titan('t1', 'lythos', 4)] }, 'enfers', 5)
    const next = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 't1', to: 'thebes' })
    expect(next.players[0].power).toBe(5) // gratuit (aucun coût en Pouvoir)
    expect((next.players[0].board['thebes'] ?? []).some((c) => c.instanceId === 't1')).toBe(true)
    expect((next.players[0].board['enfers'] ?? []).some((c) => c.instanceId === 't1')).toBe(false)
  })

  it('Argès rend 1 JT à chaque déplacement', () => {
    const s = withBoard({ enfers: [titan('t1', 'arges', 4)] }, 'enfers', 5)
    const next = moveTitanTo(s, 0, 't1', 'thebes', { fireTriggers: true })
    expect(next.players[0].power).toBe(6) // +1 (Argès)
  })

  it('Zeus entrave un Titan qui arrive sur son lieu', () => {
    const s = withBoard({ enfers: [titan('t1', 'lythos', 4)], thebes: [hero('z', 'zeus', 5)] })
    const next = moveTitanTo(s, 0, 't1', 'thebes', { fireTriggers: true })
    const moved = (next.players[0].board['thebes'] ?? []).find((c) => c.instanceId === 't1')
    expect(moved?.trapped).toBe(true)
  })

  it('un Titan entravé ne peut être ni déplacé ni utilisé pour un Vanquish', () => {
    const trapped = { ...titan('t1', 'lythos', 4), trapped: true }
    const hero2 = hero('h', 'wendy', 3)
    const s = withBoard({ enfers: [trapped, hero2] }, 'enfers', 10)
    // Déplacement refusé.
    expect(() =>
      applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 't1', to: 'thebes' }),
    ).toThrow()
    // Vanquish refusé (le Titan entravé ne peut pas participer).
    expect(() =>
      applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h', allyInstanceIds: ['t1'] }),
    ).toThrow()
  })

  it('un Titan entravé voit sa capacité ignorée (aura d’Hydros désactivée)', () => {
    const hydros = (id: string, trapped: boolean): CardInstance => ({
      instanceId: id, cardId: 'hydros', name: 'Hydros', type: 'ally', strength: 3, isTitan: true,
      strengthMod: { target: 'heroes-here', delta: -1 }, trapped,
    })
    const heroCard = hero('h', 'wendy', 4)
    // Hydros NON entravé : le Héros sur son lieu perd 1 de force (4 → 3).
    const s1 = withBoard({ thebes: [heroCard, hydros('hy', false)] })
    expect(effectiveStrength(s1, 0, 'h')).toBe(3)
    // Hydros ENTRAVÉ : son aura est ignorée (force normale 4).
    const s2 = withBoard({ thebes: [heroCard, hydros('hy', true)] })
    expect(effectiveStrength(s2, 0, 'h')).toBe(4)
  })

  it('Hercule empêche un Titan de quitter son lieu', () => {
    const s = withBoard({ enfers: [titan('t1', 'lythos', 4), hero('h', 'hercule', 5)] }, 'enfers', 10)
    expect(() =>
      applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 't1', to: 'thebes' }),
    ).toThrow()
  })

  it('Hercule SUR UN AUTRE lieu ne bloque PAS les Titans (Hercule aux Jardins, Titan aux Enfers)', () => {
    const s = withBoard({ enfers: [titan('t1', 'lythos', 4)], jardins: [hero('h', 'hercule', 5)] }, 'enfers', 10)
    const next = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 't1', to: 'thebes' })
    expect((next.players[0].board['thebes'] ?? []).some((c) => c.instanceId === 't1')).toBe(true)
  })

  it('le Char déplace la figurine + le Char vers n’importe quel lieu', () => {
    const char: CardInstance = { instanceId: 'ch', cardId: 'char', name: 'Char', type: 'item' }
    const s = withBoard({ enfers: [char, titan('t1', 'lythos', 4)] }, 'enfers', 10)
    const next = applyAction(s, { type: 'CHARIOT_MOVE', instanceId: 'ch', to: 'mont-olympe' })
    expect(next.players[0].pawnLocation).toBe('mont-olympe')
    expect((next.players[0].board['mont-olympe'] ?? []).some((c) => c.instanceId === 'ch')).toBe(true)
    // Réutilisable une seule fois par tour.
    expect(() => applyAction(next, { type: 'CHARIOT_MOVE', instanceId: 'ch', to: 'enfers' })).toThrow()
  })

  it('après le Char, on ne peut faire qu’UNE action sur le nouveau lieu (pas la Fatalité)', () => {
    const char: CardInstance = { instanceId: 'ch', cardId: 'char', name: 'Char', type: 'item' }
    const s = withBoard({ enfers: [char] }, 'enfers', 10)
    // Char vers Jardins (4 actions, aucune Fatalité).
    const moved = applyAction(s, { type: 'CHARIOT_MOVE', instanceId: 'ch', to: 'jardins' })
    expect(getAvailableActions(moved).length).toBeGreaterThan(0)
    // On effectue UNE action (Gagner 3).
    const after = applyAction(moved, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(after.players[0].power).toBe(13) // 10 + 3
    // Plus aucune action de lieu disponible (le Char n'en accorde qu'une).
    expect(getAvailableActions(after).length).toBe(0)
  })

  it('le Char ne permet PAS de jouer la Fatalité comme action bonus', () => {
    const char: CardInstance = { instanceId: 'ch', cardId: 'char', name: 'Char', type: 'item' }
    const s = withBoard({ enfers: [char] }, 'enfers', 10)
    // Char vers Mont Olympe (qui a une action Fatalité).
    const moved = applyAction(s, { type: 'CHARIOT_MOVE', instanceId: 'ch', to: 'mont-olympe' })
    expect(getAvailableActions(moved).map((a) => a.type)).not.toContain('FATE')
  })
})

describe('Hadès — entrave interactive (Fatalité)', () => {
  it('RESOLVE_TITAN_SELECT (Héra) entrave le Titan choisi', () => {
    const s0 = withBoard({ thebes: [titan('t1', 'lythos', 4)] })
    const s: GameState = {
      ...s0,
      pendingTitanSelect: { playerIndex: 0, chooserIndex: 0, titanCandidateIds: ['t1'], kind: 'trap' },
    }
    const next = applyAction(s, { type: 'RESOLVE_TITAN_SELECT', titanInstanceId: 't1' })
    const t = (next.players[0].board['thebes'] ?? []).find((c) => c.instanceId === 't1')
    expect(t?.trapped).toBe(true)
    expect(next.pendingTitanSelect).toBeNull()
  })

  it('RESOLVE_TITAN_SELECT (Pégase) repousse le Titan vers Les Enfers', () => {
    const s0 = withBoard({ jardins: [titan('t1', 'lythos', 4)] })
    const s: GameState = {
      ...s0,
      pendingTitanSelect: { playerIndex: 0, chooserIndex: 0, titanCandidateIds: ['t1'], kind: 'push', pushSteps: 1 },
    }
    const next = applyAction(s, { type: 'RESOLVE_TITAN_SELECT', titanInstanceId: 't1' })
    // jardins (index 2) → thèbes (index 1)
    expect((next.players[0].board['thebes'] ?? []).some((c) => c.instanceId === 't1')).toBe(true)
  })
})

describe('Hadès — Sans pitié (Condition)', () => {
  it('jouable si l’adversaire a ≥ 6 JT ; pose gratuitement un Titan sur Les Enfers', () => {
    const base = game()
    const sansPitie: CardInstance = {
      instanceId: 'sp', cardId: 'sans-pitie', name: 'Sans pitié', type: 'condition',
      trigger: { type: 'opponent-power-ge', value: 6 },
    }
    const lythos: CardInstance = { instanceId: 'ly', cardId: 'lythos', name: 'Lythos', type: 'ally', strength: 4, isTitan: true, playOnlyAt: 'enfers' }
    const s: GameState = {
      ...base,
      activePlayer: 1, // c'est le tour de l'adversaire
      phase: 'ACTION',
      players: base.players.map((p, i) =>
        i === 0
          ? { ...p, hand: [sansPitie, lythos] }
          : { ...p, power: 6 },
      ),
    }
    const next = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'sp', allyInstanceId: 'ly' })
    expect((next.players[0].board['enfers'] ?? []).some((c) => c.instanceId === 'ly')).toBe(true)
    expect(next.players[0].hand.some((c) => c.instanceId === 'ly')).toBe(false)
  })

  it('non jouable si l’adversaire a moins de 6 JT', () => {
    const base = game()
    const sansPitie: CardInstance = {
      instanceId: 'sp', cardId: 'sans-pitie', name: 'Sans pitié', type: 'condition',
      trigger: { type: 'opponent-power-ge', value: 6 },
    }
    const lythos: CardInstance = { instanceId: 'ly', cardId: 'lythos', name: 'Lythos', type: 'ally', strength: 4, isTitan: true, playOnlyAt: 'enfers' }
    const s: GameState = {
      ...base,
      activePlayer: 1,
      phase: 'ACTION',
      players: base.players.map((p, i) => (i === 0 ? { ...p, hand: [sansPitie, lythos] } : { ...p, power: 5 })),
    }
    expect(() => applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'sp', allyInstanceId: 'ly' })).toThrow()
  })
})

describe('Hadès — robustesse & convergence (bot)', () => {
  it('une partie Hadès vs Hadès pilotée par le bot se termine sans erreur', () => {
    const setup = (p: string) => ({
      villain: hades,
      deckCards: buildDeckInstances(hadesCards, 'villain', p),
      fateCards: buildDeckInstances(hadesCards, 'fate', p + 'f:'),
    })
    let finished = 0
    const N = 6
    for (let g = 0; g < N; g++) {
      const rand = seededRand(700 + g * 11)
      let s: GameState = createInitialGame([setup('p0:'), setup('p1:')], g + 1)
      let steps = 0
      // Le simple fait que la boucle se termine sans exception valide qu'aucun
      // coup énuméré pour Hadès (Titans, Préparez-vous, entrave…) ne plante.
      while (s.status === 'PLAYING' && steps < 4000) {
        s = applyAction(s, chooseAction(s, rand))
        steps++
      }
      if (s.status === 'WON') finished++
    }
    expect(finished).toBeGreaterThanOrEqual(1)
  }, 30000) // 6 parties bot complètes → timeout élargi (> 5 s par défaut).
})
