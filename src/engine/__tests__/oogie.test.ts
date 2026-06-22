import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { effectiveStrength, getLegalMoves } from '../rules'
import { resolveEffects } from '../effects'
import { oogieBoogie } from '../../data/villains/oogie-boogie'
import { oogieBoogieCards } from '../../data/villains/oogie-boogie.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PendingDice } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: oogieBoogie,
        deckCards: buildDeckInstances(oogieBoogieCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(oogieBoogieCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

/** Partie à 2 : 0 = Oogie (cible Fatalité), 1 = adversaire actif. */
const game2 = (seed = 7): GameState =>
  createInitialGame(
    [
      { villain: oogieBoogie, deckCards: buildDeckInstances(oogieBoogieCards, 'villain', 'p0:'), fateCards: buildDeckInstances(oogieBoogieCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    seed,
  )

/** Force un Allié du cardId donné sur un lieu du joueur 0. */
function inst(cardId: string, n = 1): CardInstance {
  const def = oogieBoogieCards.find((c) => c.id === cardId)!
  return {
    instanceId: `${cardId}#x${n}`,
    cardId,
    name: def.name,
    type: def.type,
    cost: def.cost,
    strength: def.strength,
    selfStrengthMods: def.selfStrengthMods,
  }
}

function withBoard(s: GameState, loc: string, cards: CardInstance[]): GameState {
  return { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, [loc]: cards } }, ...s.players.slice(1)] }
}

describe('Oogie Boogie — mise en place', () => {
  it('place Sandy Claws (Perce-Oreilles) à l’Antre et le sort du deck Fatalité', () => {
    const s = game()
    const antre = s.players[0].board['antre'] ?? []
    expect(antre.some((c) => c.cardId === 'perce-oreilles')).toBe(true)
    expect((s.players[0].fateDeck ?? []).some((c) => c.cardId === 'perce-oreilles')).toBe(false)
    expect(s.players[0].impostorsPlaced).toBe(0)
  })
})

describe('Oogie Boogie — synergie du Trio (Am/Stram/Gram)', () => {
  it('+1 force par autre membre du trio présent dans le royaume (royaume entier)', () => {
    let s = game()
    s = withBoard(s, 'ville-halloween', [inst('am'), inst('stram'), inst('gram')])
    const am = s.players[0].board['ville-halloween'][0]
    // base 2 + 2 autres membres = 4
    expect(effectiveStrength(s, 0, am.instanceId)).toBe(4)
    // Un seul membre dans le royaume : pas de bonus.
    let s1 = game()
    s1 = withBoard(s1, 'cimetiere', [inst('stram')])
    const stram = s1.players[0].board['cimetiere'][0]
    expect(effectiveStrength(s1, 0, stram.instanceId)).toBe(2)
  })
})

describe('Oogie Boogie — modificateurs de lancer', () => {
  it('Gram sur le lieu du pion ajoute +1 au lancer', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'ville-halloween' }, ...s.players.slice(1)] }
    s = withBoard(s, 'ville-halloween', [inst('gram')])
    s = resolveEffects(s, [{ type: 'ROLL_IMPOSTOR' }], { actorIndex: 0 })
    expect(s.pendingDice?.modifier).toBe(1)
  })

  it('Salut, Oogie ! retire 2 et est consommé', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], helloOogieTokens: 1 }, ...s.players.slice(1)] }
    s = resolveEffects(s, [{ type: 'ROLL_IMPOSTOR' }], { actorIndex: 0 })
    expect(s.pendingDice?.modifier).toBe(-2)
    expect(s.players[0].helloOogieTokens).toBe(0)
  })
})

/** Arme un pendingDice impostor avec un total donné (dés bidon). */
function armImpostor(s: GameState, total: number): GameState {
  const pen: PendingDice = { playerIndex: 0, dice: [total >= 7 ? 6 : 1, 1], modifier: 0, total, context: 'Imposteur', outcome: { kind: 'impostor' }, canReroll: false }
  return { ...s, pendingDice: pen }
}

describe('Oogie Boogie — Imposteur Perce-Oreilles & objectif', () => {
  it('succès (≥7) incrémente la pile ; échec (≤6) ne fait rien', () => {
    let s = game()
    s = applyAction(armImpostor(s, 9), { type: 'RESOLVE_DICE' })
    expect(s.players[0].impostorsPlaced).toBe(1)
    s = applyAction(armImpostor(s, 5), { type: 'RESOLVE_DICE' })
    expect(s.players[0].impostorsPlaced).toBe(1)
  })

  it('le 4ᵉ imposteur fait revenir Jack à l’Antre et retire Sandy Claws', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], impostorsPlaced: 3 }, ...s.players.slice(1)] }
    s = applyAction(armImpostor(s, 8), { type: 'RESOLVE_DICE' })
    expect(s.players[0].jackReturned).toBe(true)
    const antre = s.players[0].board['antre'] ?? []
    expect(antre.some((c) => c.cardId === 'jack-skellington')).toBe(true)
    expect(antre.some((c) => c.cardId === 'perce-oreilles')).toBe(false)
  })

  it('après le retour de Jack, un imposteur réussi lui colle un jeton Force -1', () => {
    let s = game()
    const jack: CardInstance = { instanceId: 'jack#1', cardId: 'jack-skellington', name: 'Jack Skellington', type: 'hero', strength: 8 }
    s = { ...s, players: [{ ...s.players[0], jackReturned: true, board: { ...s.players[0].board, antre: [jack] } }, ...s.players.slice(1)] }
    s = applyAction(armImpostor(s, 10), { type: 'RESOLVE_DICE' })
    const j = (s.players[0].board['antre'] ?? []).find((c) => c.cardId === 'jack-skellington')!
    expect(j.forceTokens).toBe(-1)
  })
})

describe('Oogie Boogie — relance (Dés pipés)', () => {
  it('relance un dé et défausse le Dés pipés', () => {
    let s = game()
    const dp = inst('des-pipes')
    s = { ...s, players: [{ ...s.players[0], hand: [dp] }, ...s.players.slice(1)] }
    s = { ...s, pendingDice: { playerIndex: 0, dice: [1, 1], modifier: 0, total: 2, context: 'Imposteur', outcome: { kind: 'impostor' }, canReroll: true } }
    s = applyAction(s, { type: 'RESOLVE_DICE_REROLL', instanceId: dp.instanceId, dieIndex: 0 })
    expect(s.players[0].hand.some((c) => c.cardId === 'des-pipes')).toBe(false)
    expect(s.players[0].discard.some((c) => c.cardId === 'des-pipes')).toBe(true)
    expect(s.pendingDice).toBeTruthy()
  })
})

describe('Oogie Boogie — Préparation de Noël', () => {
  it('≤7 → pioche 1 ; ≥8 → action de royaume gratuite', () => {
    const s = game()
    const before = s.players[0].hand.length
    const penLow: PendingDice = { playerIndex: 0, dice: [3, 3], modifier: 0, total: 6, context: 'Noël', outcome: { kind: 'making-christmas' }, canReroll: false }
    let s1 = applyAction({ ...s, pendingDice: penLow }, { type: 'RESOLVE_DICE' })
    expect(s1.players[0].hand.length).toBe(before + 1)
    const penHigh: PendingDice = { playerIndex: 0, dice: [6, 6], modifier: 0, total: 12, context: 'Noël', outcome: { kind: 'making-christmas' }, canReroll: false }
    s1 = applyAction({ ...s, pendingDice: penHigh }, { type: 'RESOLVE_DICE' })
    expect(s1.pendingFreeRealmAction?.playerIndex).toBe(0)
  })
})

describe('Oogie Boogie — Jack joué en Fatalité', () => {
  it('retire 1 Imposteur de la pile au lieu d’être posé', () => {
    let s = game2()
    s = { ...s, players: [{ ...s.players[0], impostorsPlaced: 2 }, s.players[1]] }
    const jack = (s.players[0].fateDeck ?? []).find((c) => c.cardId === 'jack-skellington')!
    s = { ...s, activePlayer: 1, pendingFate: { target: 0, revealed: [jack] } as never }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: jack.instanceId })
    expect(s.players[0].impostorsPlaced).toBe(1)
    expect((s.players[0].board['antre'] ?? []).some((c) => c.cardId === 'jack-skellington')).toBe(false)
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'jack-skellington')).toBe(true)
  })
})

describe('Oogie Boogie — victoire (vaincre Jack à l’Antre)', () => {
  it('éliminer Jack à l’Antre déclenche la victoire', () => {
    let s = game()
    const jack: CardInstance = { instanceId: 'jack#1', cardId: 'jack-skellington', name: 'Jack Skellington', type: 'hero', strength: 8 }
    const a1 = { ...inst('chauves-souris', 1), instanceId: 'b1', strength: 5 }
    const a2 = { ...inst('chauves-souris', 2), instanceId: 'b2', strength: 5 }
    s = {
      ...s,
      phase: 'ACTION',
      players: [
        { ...s.players[0], pawnLocation: 'antre', jackReturned: true, board: { ...s.players[0].board, antre: [jack, a1, a2] } },
        ...s.players.slice(1),
      ],
    }
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'jack#1', allyInstanceIds: ['b1', 'b2'] })
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })
})

describe('Oogie Boogie — Sally restreint les déplacements', () => {
  it('avec Sally en jeu, le pion ne peut aller que sur un lieu voisin', () => {
    let s = game()
    const sally: CardInstance = { instanceId: 'sally#1', cardId: 'sally', name: 'Sally', type: 'hero', strength: 3 }
    s = { ...s, phase: 'MOVE', players: [{ ...s.players[0], pawnLocation: 'ville-halloween', board: { ...s.players[0].board, cimetiere: [sally] } }, ...s.players.slice(1)] }
    const moves = getLegalMoves(s)
    expect(moves).toEqual(['cabane-trio']) // seul voisin de la Ville d'Halloween (lieu 0)
  })
})

describe('Oogie Boogie — Ce sont des vacances', () => {
  it('défausse les 3 premières cartes Fatalité et pioche 1 par Héros', () => {
    let s = game()
    const before = s.players[0].hand.length
    const heroesInTop3 = (s.players[0].fateDeck ?? []).slice(0, 3).filter((c) => c.type === 'hero').length
    s = resolveEffects(s, [{ type: 'DISCARD_TOP_FATE_DRAW_PER_HERO', count: 3 }], { actorIndex: 0 })
    expect(s.players[0].fateDiscard.length).toBe(3)
    expect(s.players[0].hand.length).toBe(before + heroesInTop3)
  })
})

describe('Oogie Boogie — Joyeux Halloween ! (Condition)', () => {
  it('rapporte toujours au moins 1 Pouvoir (gain si ≥8, vol si ≤7)', () => {
    let s = game2()
    s = { ...s, activePlayer: 1, players: [{ ...s.players[0], power: 0 }, { ...s.players[1], power: 5 }] }
    const before = s.players[0].power
    s = resolveEffects(s, [{ type: 'ROLL_TRICK_OR_TREAT' }], { actorIndex: 0 })
    expect(s.players[0].power).toBeGreaterThan(before)
  })
})

describe('Oogie Boogie — Mais quelle merveille !', () => {
  it('élimine le Héros visé puis ouvre un lancer de dés', () => {
    let s = game()
    const hero: CardInstance = { instanceId: 'h1', cardId: 'citoyens-halloween', name: 'Citoyen', type: 'hero', strength: 1 }
    const ally = { ...inst('araignees'), instanceId: 'sp1', strength: 2 }
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'cimetiere', board: { ...s.players[0].board, cimetiere: [hero, ally] } }, ...s.players.slice(1)] }
    s = resolveEffects(s, [{ type: 'ROLL_MERVEILLE' }], { actorIndex: 0, targetHeroId: 'h1', allyInstanceIds: ['sp1'] })
    expect((s.players[0].board['cimetiere'] ?? []).some((c) => c.instanceId === 'h1')).toBe(false)
    expect(s.pendingDice?.outcome.kind).toBe('merveille')
  })
})
