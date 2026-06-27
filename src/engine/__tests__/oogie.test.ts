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

describe('Oogie Boogie — Baignoire', () => {
  it('ne déplace QUE les Alliés choisis (allyInstanceIds)', () => {
    const def = oogieBoogieCards.find((c) => c.id === 'baignoire')!
    const tub: CardInstance = {
      instanceId: 'baignoire#1', cardId: 'baignoire', name: def.name, type: 'item',
      cost: def.cost, attach: def.attach, grantsAction: def.grantsAction, activatedCost: def.activatedCost,
    }
    let s = game()
    s = withBoard(s, 'ville-halloween', [tub, inst('am'), inst('stram')])
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'ville-halloween', power: 0 }, ...s.players.slice(1)] }
    // Active la Baignoire vers le Cimetière en n'emmenant QUE « am ».
    const s1 = applyAction(s, {
      type: 'ACTIVATE', actionId: 'granted:baignoire#1', cardInstanceId: 'baignoire#1',
      to: 'cimetiere', allyInstanceIds: ['am#x1'],
    })
    const cim = s1.players[0].board['cimetiere'] ?? []
    const ville = s1.players[0].board['ville-halloween'] ?? []
    expect(cim.some((c) => c.cardId === 'baignoire')).toBe(true)
    expect(cim.some((c) => c.cardId === 'am')).toBe(true)
    expect(cim.some((c) => c.cardId === 'stram')).toBe(false)
    expect(ville.some((c) => c.cardId === 'stram')).toBe(true)
  })

  it('sans allyInstanceIds → emmène tous les Alliés (bot / défaut)', () => {
    const def = oogieBoogieCards.find((c) => c.id === 'baignoire')!
    const tub: CardInstance = {
      instanceId: 'baignoire#2', cardId: 'baignoire', name: def.name, type: 'item',
      cost: def.cost, attach: def.attach, grantsAction: def.grantsAction, activatedCost: def.activatedCost,
    }
    let s = game()
    s = withBoard(s, 'ville-halloween', [tub, inst('am'), inst('stram')])
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'ville-halloween', power: 0 }, ...s.players.slice(1)] }
    const s1 = applyAction(s, {
      type: 'ACTIVATE', actionId: 'granted:baignoire#2', cardInstanceId: 'baignoire#2', to: 'cimetiere',
    })
    const cim = s1.players[0].board['cimetiere'] ?? []
    expect(cim.filter((c) => c.type === 'ally').length).toBe(2)
  })
})

describe('Oogie Boogie — Père Noël (défausse libre puis pioche)', () => {
  it('ouvre pendingDiscardThenDraw, défausse les cartes choisies puis pioche', () => {
    let s = game()
    // Main connue : 3 cartes.
    const hand = [inst('chauves-souris', 1), inst('araignees', 2), inst('preparation-noel', 3)]
    s = { ...s, players: [{ ...s.players[0], hand }, ...s.players.slice(1)] }
    s = resolveEffects(s, [{ type: 'DISCARD_ANY_THEN_DRAW', draw: 2 }], { actorIndex: 0 })
    expect(s.pendingDiscardThenDraw?.playerIndex).toBe(0)
    expect(s.pendingDiscardThenDraw?.draw).toBe(2)
    const handBefore = s.players[0].hand.length // 3
    // Défausse 2 cartes choisies, puis pioche 2.
    const s1 = applyAction(s, { type: 'RESOLVE_DISCARD_THEN_DRAW', instanceIds: ['chauves-souris#x1', 'araignees#x2'] })
    expect(s1.pendingDiscardThenDraw ?? null).toBeNull()
    expect(s1.players[0].discard.some((c) => c.instanceId === 'chauves-souris#x1')).toBe(true)
    expect(s1.players[0].discard.some((c) => c.instanceId === 'araignees#x2')).toBe(true)
    // 3 − 2 défaussées + 2 piochées = 3.
    expect(s1.players[0].hand.length).toBe(handBefore - 2 + 2)
  })

  it('défausser aucune carte → pioche quand même', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], hand: [inst('araignees', 9)] }, ...s.players.slice(1)] }
    s = resolveEffects(s, [{ type: 'DISCARD_ANY_THEN_DRAW', draw: 2 }], { actorIndex: 0 })
    const s1 = applyAction(s, { type: 'RESOLVE_DISCARD_THEN_DRAW', instanceIds: [] })
    expect(s1.players[0].hand.length).toBe(1 + 2)
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

  it('un imposteur réussi rejoint la PILE Perce-Oreilles (pas la défausse)', () => {
    let s = game()
    const imp: CardInstance = { instanceId: 'imp1', cardId: 'imposteur-perce-oreilles', name: 'Imposteur Perce-Oreilles', type: 'effect' }
    // En jeu réel la carte jouée est au sommet de la défausse au moment du jet.
    s = { ...s, players: [{ ...s.players[0], discard: [imp] }, ...s.players.slice(1)] }
    s = applyAction(armImpostor(s, 9), { type: 'RESOLVE_DICE' })
    expect(s.players[0].impostorPile?.map((c) => c.instanceId)).toEqual(['imp1'])
    expect(s.players[0].discard.some((c) => c.instanceId === 'imp1')).toBe(false)
    expect(s.players[0].impostorsPlaced).toBe(1)
  })

  it('le 4ᵉ imposteur consomme la pile (→ défausse) en faisant revenir Jack', () => {
    let s = game()
    const piled: CardInstance[] = [0, 1, 2].map((i) => ({ instanceId: `i${i}`, cardId: 'imposteur-perce-oreilles', name: 'Imposteur', type: 'effect' }))
    const imp4: CardInstance = { instanceId: 'i3', cardId: 'imposteur-perce-oreilles', name: 'Imposteur', type: 'effect' }
    s = { ...s, players: [{ ...s.players[0], impostorsPlaced: 3, impostorPile: piled, discard: [imp4] }, ...s.players.slice(1)] }
    s = applyAction(armImpostor(s, 8), { type: 'RESOLVE_DICE' })
    expect(s.players[0].jackReturned).toBe(true)
    expect(s.players[0].impostorPile).toEqual([])
    // Les 4 Imposteurs (3 empilés + le 4ᵉ) sont défaussés une fois Jack de retour.
    expect(s.players[0].discard.filter((c) => c.cardId === 'imposteur-perce-oreilles').length).toBe(4)
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
    // ≥8 : action de royaume gratuite sur N'IMPORTE QUEL lieu (machinerie « géante »).
    expect(s1.pendingGiantAction?.playerIndex).toBe(0)
    expect(s1.pendingGiantAction?.viaChristmas).toBe(true)
    // Tous les lieux sont candidats (pas seulement le lieu du pion).
    expect(s1.pendingGiantAction?.locations?.length).toBe(s.players[0].locations.length)
  })

  it('≥8 → l’action gratuite s’effectue sur un AUTRE lieu (hors Fatalité), sans consommer l’économie d’actions', () => {
    const g = game()
    const pawn0 = g.players[0].locations[0].id
    // Phase ACTION + pion placé (la carte se joue pendant les actions).
    const s: GameState = { ...g, phase: 'ACTION', players: g.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: pawn0 } : p)) }
    const penHigh: PendingDice = { playerIndex: 0, dice: [6, 6], modifier: 0, total: 12, context: 'Noël', outcome: { kind: 'making-christmas' }, canReroll: false }
    let s1 = applyAction({ ...s, pendingDice: penHigh }, { type: 'RESOLVE_DICE' })
    const pawn = s1.players[0].pawnLocation
    // Choisit un lieu DIFFÉRENT du pion : Gagner du pouvoir y est gratuit.
    const other = s1.players[0].locations.find((l) => l.id !== pawn)!
    const gainAction = other.actions.find((a) => a.type === 'GAIN_POWER')!
    const usedBefore = s1.usedActionIds
    s1 = applyAction(s1, { type: 'RESOLVE_GIANT_LOCATION', locationId: other.id })
    expect(s1.actAtLocation).toBe(other.id)
    const power0 = s1.players[0].power
    s1 = applyAction(s1, { type: 'EXECUTE_ACTION', actionId: gainAction.id })
    // Pouvoir gagné, fenêtre refermée et économie d'actions restaurée (action gratuite).
    expect(s1.players[0].power).toBeGreaterThan(power0)
    expect(s1.actAtLocation ?? null).toBeNull()
    expect(s1.usedActionIds).toEqual(usedBefore)
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
    const top3 = (s.players[0].fateDeck ?? []).slice(0, 3)
    s = resolveEffects(s, [{ type: 'DISCARD_TOP_FATE_DRAW_PER_HERO', count: 3 }], { actorIndex: 0 })
    expect(s.players[0].fateDiscard.length).toBe(3)
    expect(s.players[0].hand.length).toBe(before + heroesInTop3)
    // Les 3 cartes dévoilées sont montrées (pendingReveal) avec les Héros surlignés.
    expect(s.pendingReveal?.cards.map((c) => c.instanceId)).toEqual(top3.map((c) => c.instanceId))
    expect(s.pendingReveal?.heroInstanceIds?.length).toBe(heroesInTop3)
  })
})

describe('Oogie Boogie — Affaire dans le sac (dés choisis)', () => {
  it('un lancer contrôlé (bagControlledDice) ouvre un choix de dés', () => {
    let s = game()
    s = { ...s, bagControlledDice: true, players: [{ ...s.players[0], pawnLocation: 'ville-halloween' }, ...s.players.slice(1)] }
    s = resolveEffects(s, [{ type: 'ROLL_IMPOSTOR' }], { actorIndex: 0 })
    expect(s.pendingDice?.chooseDice).toBe(true)
  })

  it('RESOLVE_DICE_CHOICE applique le résultat choisi (impostor réussi)', () => {
    const pen: PendingDice = {
      playerIndex: 0, dice: [6, 6], modifier: 0, total: 12, context: 'Imposteur Perce-Oreilles',
      cardId: 'imposteur-perce-oreilles', outcome: { kind: 'impostor' }, canReroll: false, chooseDice: true,
    }
    let s = game()
    // Imposteur en défausse (sera empilé en cas de réussite).
    s = { ...s, pendingDice: pen, players: [{ ...s.players[0], discard: [inst('imposteur-perce-oreilles', 1)] }, ...s.players.slice(1)] }
    const before = s.players[0].impostorsPlaced ?? 0
    const s1 = applyAction(s, { type: 'RESOLVE_DICE_CHOICE', dice: [4, 4] }) // total 8 ≥ 7 → réussite
    expect(s1.pendingDice ?? null).toBeNull()
    expect(s1.players[0].impostorsPlaced).toBe(before + 1)
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
