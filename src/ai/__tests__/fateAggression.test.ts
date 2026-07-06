import { describe, it, expect } from 'vitest'
import { chooseAction, evaluate } from '../heuristicBot'
import { enumerateActions } from '../enumerate'
import { playerMalus } from '../fateMalus'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { tabbou } from '../../data/villains/tabbou'
import { tabbouCards } from '../../data/villains/tabbou.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../../engine/types'

function rcVsBowser(): GameState {
  return createInitialGame(
    [
      { villain: reineCoeur, deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'p0f:') },
      { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p1:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p1f:') },
    ],
    7,
  )
}

const mario: CardInstance = { instanceId: 'm1', cardId: 'mario', name: 'Mario', type: 'hero', strength: 4 }
const luigi: CardInstance = { instanceId: 'l1', cardId: 'luigi', name: 'Luigi', type: 'hero', strength: 3 }
const guard = (id: string, wicket = false): CardInstance => ({ instanceId: id, cardId: 'gardes-coeur', name: 'Gardes', type: 'ally', strength: 3, activatedCost: 1, isWicket: wicket })

describe('malus Fatalité — playerMalus', () => {
  it('Mario (block-win) sature le malus à 1', () => {
    const base = rcVsBowser()
    const s: GameState = { ...base, players: [base.players[0], { ...base.players[1], board: { ...base.players[1].board, galaxies: [mario] } }] }
    expect(playerMalus(s, 1)).toBe(1)
  })
  it('un simple ralentisseur (Luigi) donne un malus faible', () => {
    const base = rcVsBowser()
    const s: GameState = { ...base, players: [base.players[0], { ...base.players[1], board: { ...base.players[1].board, galaxies: [luigi] } }] }
    const m = playerMalus(s, 1)
    expect(m).toBeGreaterThan(0)
    expect(m).toBeLessThan(0.3)
  })
  it('Tabbou (KILL_FIGHTERS, aucun blocage dur) : ses ralentisseurs pèsent un peu plus', () => {
    // Deux ralentisseurs slow2 (Link + Kirby) : raw 4 → ×1.3 (Tabbou) / 12 ≈ 0.43,
    // au-dessus du 0.33 non-échelonné → le bot lâche la Fatalité un peu plus tôt.
    const base = createInitialGame(
      [
        { villain: tabbou, deckCards: buildDeckInstances(tabbouCards, 'villain', 'p0:'), fateCards: buildDeckInstances(tabbouCards, 'fate', 'p0f:') },
        { villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p1:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const loc = tabbou.locations[0].id
    const link: CardInstance = { instanceId: 'lk', cardId: 'link', name: 'Link', type: 'hero', strength: 3 }
    const kirby: CardInstance = { instanceId: 'kb', cardId: 'kirby', name: 'Kirby', type: 'hero', strength: 2 }
    const s: GameState = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [loc]: [link, kirby] } }, base.players[1]] }
    const m = playerMalus(s, 0)
    expect(m).toBeGreaterThan(0.4)
    expect(m).toBeLessThan(0.5)
  })
})

describe('évitement de Fatalité (ne pas donner le Héros-clé)', () => {
  it('le bot ne fatalise PAS Bowser tant que Peach n’est ni en jeu ni capturée', () => {
    const base = rcVsBowser()
    // Bot = Reine de Cœur sur la Forêt de Tulgey (action Fatalité), sans autre coup utile.
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: [
        { ...base.players[0], pawnLocation: 'foret-tulgey', hand: [], power: 0, board: {} },
        base.players[1], // Bowser : pas de Peach, pas capturée
      ],
    }
    // La Fatalité EST légale ici (precondition)…
    expect(enumerateActions(s).some((a) => a.type === 'FATE')).toBe(true)
    // …mais le bot l'évite (donnerait Peach à Bowser) → il termine son tour.
    expect(chooseAction(s, () => 0).type).toBe('END_TURN')
  })
})

describe('Reine de Cœur — arceaux (ROYAL_CROQUET)', () => {
  it('le bot peut activer une Carte Garde pour la transformer en arceau', () => {
    const base = rcVsBowser()
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: [
        { ...base.players[0], pawnLocation: 'labyrinthe', power: 5, board: { labyrinthe: [guard('g1')] } },
        base.players[1],
      ],
    }
    const acts = enumerateActions(s)
    expect(acts.some((a) => a.type === 'ACTIVATE' && a.cardInstanceId === 'g1')).toBe(true)
  })
  it('un arceau posé augmente la valeur de la position (objectif évalué)', () => {
    const base = rcVsBowser()
    const withGuard: GameState = { ...base, players: [{ ...base.players[0], board: { labyrinthe: [guard('g1', false)] } }, base.players[1]] }
    const withWicket: GameState = { ...base, players: [{ ...base.players[0], board: { labyrinthe: [guard('g1', true)] } }, base.players[1]] }
    expect(evaluate(withWicket, 0)).toBeGreaterThan(evaluate(withGuard, 0))
  })
})
