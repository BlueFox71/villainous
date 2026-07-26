import { describe, it, expect } from 'vitest'
import { chooseAction, chooseReaction, evaluate } from '../heuristicBot'
import { enumerateActions } from '../enumerate'
import { applyAction } from '../../engine/actions'
import { nextRandom } from '../../engine/rng'
import { twoPlayerGame, me, withActive } from '../../engine/__tests__/_helpers'
import type { CardInstance } from '../../engine/types'

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    const r = nextRandom(s)
    s = r.state
    return r.value
  }
}

describe('heuristicBot', () => {
  it('ne produit que des coups légaux sur une longue partie (aucune exception)', () => {
    const rand = seededRand(12345)
    let s = twoPlayerGame(1)
    let steps = 0
    expect(() => {
      while (s.status === 'PLAYING' && steps < 5000) {
        s = applyAction(s, chooseAction(s, rand))
        steps++
      }
    }).not.toThrow()
  })

  it('le bot peut défausser plusieurs cartes injouables d’un coup', () => {
    let s = twoPlayerGame(1)
    const c1: CardInstance = { instanceId: 'p0:x1', cardId: 'magnifiques-taxes', name: 'x', type: 'effect', cost: 2 }
    const c2: CardInstance = { instanceId: 'p0:x2', cardId: 'magnifiques-taxes', name: 'y', type: 'effect', cost: 2 }
    s = withActive(s, { pawnLocation: 'sherwood', power: 0, hand: [c1, c2] })
    s = { ...s, phase: 'ACTION', usedActionIds: [] }
    const acts = enumerateActions(s)
    const multi = acts.find((a) => a.type === 'DISCARD_CARDS' && a.instanceIds.length === 2)
    expect(multi).toBeTruthy()
  })

  it('un tour de bot finit toujours par passer la main', () => {
    const rand = seededRand(7)
    let s = twoPlayerGame(2)
    const start = s.activePlayer
    let steps = 0
    while (s.activePlayer === start && s.status === 'PLAYING' && steps < 200) {
      s = applyAction(s, chooseAction(s, rand))
      steps++
    }
    expect(s.activePlayer).not.toBe(start)
  })

  it('préfère gagner du pouvoir à finir le tour quand rien d’autre n’aide', () => {
    // Main vide, pion à la Prison : seul Gagner 3 pouvoir est utile (pas de
    // Fatalité ici, et Jouer/Défausser sont morts main vide). Le bot doit
    // exécuter l'action Pouvoir plutôt que passer la main.
    let s = applyAction(twoPlayerGame(3), { type: 'MOVE', to: 'nottingham' })
    s = { ...s, phase: 'MOVE', players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'nottingham' } : p)) }
    s = applyAction(s, { type: 'MOVE', to: 'jail' })
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [] } : p)) }
    const action = chooseAction(s, seededRand(1))
    expect(action.type).toBe('EXECUTE_ACTION')
  })

  it('la recherche de tour valorise Fatalité (place un Héros chez l’adversaire)', () => {
    // Pion à Sherwood (Fatalité ET Gagner 1 pouvoir dispo), main vide. La recherche de
    // tour résout le pendingFate et voit le Héros atterrir dans le royaume adverse
    // (pénalisant pour lui) → la Fatalité est jouée DANS le tour. Un greedy 1-ply ne le
    // verrait pas (Fatalité ne change pas l'éval immédiate : elle ne fait que créer un
    // pendingFate). C'est l'apport de la profondeur.
    // NB : les deux actions du lieu étant utilisables dans le même tour, l'ORDRE entre
    // « Gagner 1 » et « Fatalité » est indifférent (mêmes positions finales, donc ex æquo
    // tranché au hasard) — on vérifie donc que la Fatalité est jouée, pas qu'elle passe
    // en premier.
    let s = { ...twoPlayerGame(3), phase: 'MOVE' as const }
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'nottingham' } : p)) }
    s = applyAction(s, { type: 'MOVE', to: 'sherwood' })
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [] } : p)) }
    const rand = seededRand(1)
    const played: string[] = []
    for (let k = 0; k < 6 && s.status === 'PLAYING' && s.activePlayer === 0; k++) {
      const a = chooseAction(s, rand)
      played.push(a.type)
      if (a.type === 'END_TURN') break
      s = applyAction(s, a)
    }
    expect(played).toContain('FATE')
  })

  it('la partie heuristique vs heuristique converge vers une victoire', () => {
    const rand = seededRand(42)
    let s = twoPlayerGame(5)
    let steps = 0
    while (s.status === 'PLAYING' && steps < 6000) {
      s = applyAction(s, chooseAction(s, rand))
      steps++
    }
    expect(s.status).toBe('WON')
  })

  it('joue Avarice en réaction (gain net de pouvoir)', () => {
    let s = twoPlayerGame(8)
    // J0 (actif) a ≥10 JT → Avarice de J1 se déclenche. J1 a Avarice en main.
    const avarice: CardInstance = {
      instanceId: 'p1:av', cardId: 'avarice', name: 'Avarice', type: 'condition',
      trigger: { type: 'opponent-power-ge', value: 10 },
    }
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, power: 12 } : { ...p, hand: [avarice] },
      ),
    }
    const reaction = chooseReaction(s, 1, seededRand(1))
    expect(reaction?.type).toBe('PLAY_CONDITION')
  })

  it('evaluate récompense la victoire et pénalise les héros dans son royaume', () => {
    const s = twoPlayerGame(1)
    const withHero = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: { ...p.board, jail: [{ instanceId: 'h', cardId: 'petit-jean', name: 'h', type: 'hero', strength: 5 } as CardInstance] } }
          : p,
      ),
    }
    expect(evaluate(withHero, 0)).toBeLessThan(evaluate(s, 0))
    // Le total n'a pas d'importance ; on vérifie juste l'ordre.
    void me
  })
})
