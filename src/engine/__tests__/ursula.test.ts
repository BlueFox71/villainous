import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { hasReachedObjective } from '../rules'
import { enumerateActions } from '../../ai/enumerate'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      { villain: ursula, deckCards: buildDeckInstances(ursulaCards, 'villain', 'p0:'), fateCards: buildDeckInstances(ursulaCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    9,
  )
}
const item = (id: string, cardId: string): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'item' })

describe('Ursula — decks', () => {
  it('30 cartes Vilain et 15 cartes Fatalité', () => {
    const v = ursulaCards.filter((c) => c.deck === 'villain').reduce((n, c) => n + c.copies, 0)
    const f = ursulaCards.filter((c) => c.deck === 'fate').reduce((n, c) => n + c.copies, 0)
    expect(v).toBe(30)
    expect(f).toBe(15)
  })
})

describe('Ursula — objectif (Trident + Couronne au Repaire)', () => {
  it('atteint quand les deux Objets sont au Repaire', () => {
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, repaire: [item('t', 'trident'), item('c', 'couronne')] } } : p,
      ),
    }
    expect(hasReachedObjective(s)).toBe(true)
  })
  it('non atteint s’il manque un Objet', () => {
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, repaire: [item('t', 'trident')] } } : p)),
    }
    expect(hasReachedObjective(s)).toBe(false)
  })
  it('non atteint si un Objet est associé à un Héros (zone haute)', () => {
    const base = game()
    const trAttached: CardInstance = { ...item('t', 'trident'), attachedTo: 'h' }
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, repaire: [trAttached, item('c', 'couronne')] } } : p,
      ),
    }
    expect(hasReachedObjective(s)).toBe(false)
  })
})

const hero = (id: string, cardId: string, strength: number): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'hero', strength })

describe('Ursula — Pacte (Héros éliminé déplacé sur le lieu du Pacte)', () => {
  it('un Héros déplacé sur le lieu de son Pacte est éliminé', () => {
    const eric = hero('e', 'prince-eric', 4)
    const pacte: CardInstance = { instanceId: 'p', cardId: 'pacte-repaire', name: 'Pacte', type: 'item', attachedTo: 'e', contractLocationId: 'repaire' }
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, navire: [eric, pacte] } } : p)),
    }
    const next = resolveEffect(s, { type: 'MOVE_HERO_TO_LOCATION', locationId: 'repaire' }, { actorIndex: 0, targetHeroId: 'e' })
    expect((next.players[0].board['repaire'] ?? []).some((c) => c.instanceId === 'e')).toBe(false)
    expect(next.players[0].fateDiscard.some((c) => c.cardId === 'prince-eric')).toBe(true)
    expect(next.players[0].discard.some((c) => c.cardId === 'pacte-repaire')).toBe(true)
  })

  it('le Trident est LIBÉRÉ quand le Roi Triton (porteur) est éliminé par un Pacte', () => {
    const triton = hero('t', 'roi-triton', 6)
    const trident: CardInstance = { instanceId: 'tr', cardId: 'trident', name: 'Trident', type: 'item', attachedTo: 't' }
    const pacte: CardInstance = { instanceId: 'p', cardId: 'pacte-repaire', name: 'Pacte', type: 'item', attachedTo: 't', contractLocationId: 'repaire' }
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, navire: [triton, trident, pacte] } } : p)),
    }
    const next = resolveEffect(s, { type: 'MOVE_HERO_TO_LOCATION', locationId: 'repaire' }, { actorIndex: 0, targetHeroId: 't' })
    const repaire = next.players[0].board['repaire'] ?? []
    const freedTrident = repaire.find((c) => c.cardId === 'trident')
    expect(freedTrident).toBeTruthy()
    expect(freedTrident?.attachedTo).toBeUndefined() // libéré (zone basse)
    expect(next.players[0].fateDiscard.some((c) => c.cardId === 'roi-triton')).toBe(true)
  })
})

describe('Ursula — Trident (invoque le Roi Triton)', () => {
  it('jouer le Trident invoque le Roi Triton et lui associe le Trident', () => {
    const trident: CardInstance = { instanceId: 'tr', cardId: 'trident', name: 'Trident', type: 'item', attach: 'location', cost: 4 }
    let s = game()
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'repaire', hand: [trident], power: 5 } : p)),
    }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'tr', to: 'repaire' })
    const repaire = s.players[0].board['repaire'] ?? []
    const triton = repaire.find((c) => c.cardId === 'roi-triton')
    expect(triton).toBeTruthy()
    expect(repaire.find((c) => c.cardId === 'trident')?.attachedTo).toBe(triton!.instanceId)
    expect(s.players[0].fateDeck.some((c) => c.cardId === 'roi-triton')).toBe(false)
  })
})

describe('Ursula — Chaudron', () => {
  it('gagne 2 Pouvoir par Pacte dans le royaume', () => {
    const p1: CardInstance = { instanceId: 'a', cardId: 'pacte-navire', name: 'Pacte', type: 'item', attachedTo: 'x', contractLocationId: 'navire' }
    const p2: CardInstance = { instanceId: 'b', cardId: 'pacte-rivage', name: 'Pacte', type: 'item', attachedTo: 'y', contractLocationId: 'rivage' }
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((pp, i) => (i === 0 ? { ...pp, power: 0, board: { ...pp.board, navire: [p1], rivage: [p2] } } : pp)),
    }
    const next = resolveEffect(s, { type: 'GAIN_POWER_PER_CONTRACT', amount: 2 }, { actorIndex: 0 })
    expect(next.players[0].power).toBe(4)
  })
})

describe('Ursula — Divination / Polochon / Opportunisme / Ariel', () => {
  it('Divination ajoute un Pacte à la main et défausse les autres dévoilées', () => {
    const ev: CardInstance = { instanceId: 'e', cardId: 'tourbillon', name: 'Tourbillon', type: 'effect' }
    const pacte: CardInstance = { instanceId: 'p', cardId: 'pacte-navire', name: 'Pacte', type: 'item', contractLocationId: 'navire' }
    const base = game()
    const s: GameState = { ...base, players: base.players.map((pp, i) => (i === 0 ? { ...pp, deck: [ev, pacte], hand: [] } : pp)) }
    const next = resolveEffect(s, { type: 'REVEAL_VILLAIN_UNTIL_CONTRACT' }, { actorIndex: 0 })
    expect(next.players[0].hand.some((c) => c.instanceId === 'p')).toBe(true)
    expect(next.players[0].discard.some((c) => c.instanceId === 'e')).toBe(true)
  })
  it("le bot ne défausse PAS le Trident (carte d'objectif) mais défausse le reste", () => {
    const base = game()
    const me = base.players[0]
    const trident = [...me.deck, ...me.hand].find((c) => c.cardId === 'trident')!
    const junk = [...me.deck, ...me.hand].find((c) => c.cardId === 'tourbillon')!
    const s: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'navire', hand: [trident, junk] } : p)),
    }
    const discards = enumerateActions(s).filter((a) => a.type === 'DISCARD_CARDS')
    // Aucune option ne défausse le Trident…
    expect(discards.every((a) => a.type === 'DISCARD_CARDS' && !a.instanceIds.includes(trident.instanceId))).toBe(true)
    // …mais une carte quelconque reste défaussable.
    expect(discards.some((a) => a.type === 'DISCARD_CARDS' && a.instanceIds.includes(junk.instanceId))).toBe(true)
  })
  it('le bot ne joue pas Tourbillon sans Héros (mais le joue avec un Héros)', () => {
    const base = game()
    const me = base.players[0]
    const tourbillon = [...me.deck, ...me.hand].find((c) => c.cardId === 'tourbillon')!
    const noHero: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      usedActionIds: [],
      players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'repaire', hand: [tourbillon], power: 5 } : p)),
    }
    const playsTourbillon = (s: GameState) =>
      enumerateActions(s).some((a) => a.type === 'PLAY_CARD' && a.instanceId === tourbillon.instanceId)
    expect(playsTourbillon(noHero)).toBe(false)
    // Avec un Héros dans le royaume, Tourbillon redevient jouable (il a une cible).
    const hero: CardInstance = { instanceId: 'h', cardId: 'eric', name: 'Eric', type: 'hero', strength: 3 }
    const withHero: GameState = {
      ...noHero,
      players: noHero.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, navire: [hero] } } : p)),
    }
    expect(playsTourbillon(withHero)).toBe(true)
  })
  it('Apparence Retrouvée récupère un Héros ≤4 de la défausse Fatalité sur le lieu d’Ursula', () => {
    const base = game()
    const apparence = base.players[0].fateDeck.find((c) => c.cardId === 'apparence-retrouvee')!
    const other = base.players[0].fateDeck.find((c) => c.instanceId !== apparence.instanceId)!
    const eric: CardInstance = { instanceId: 'eric', cardId: 'eric', name: 'Eric', type: 'hero', strength: 3 }
    const s: GameState = {
      ...base,
      activePlayer: 1,
      pendingFate: { target: 0, revealed: [apparence, other] },
      players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'repaire', fateDiscard: [eric] } : p)),
    }
    const after = applyAction(s, { type: 'RESOLVE_FATE', instanceId: apparence.instanceId })
    expect((after.players[0].board.repaire ?? []).some((c) => c.instanceId === 'eric')).toBe(true)
    expect(after.players[0].fateDiscard.some((c) => c.instanceId === 'eric')).toBe(false)
  })
  it('le bot ne propose pas Apparence Retrouvée si la défausse Fatalité est vide', () => {
    const base = game()
    const apparence = base.players[0].fateDeck.find((c) => c.cardId === 'apparence-retrouvee')!
    // L'autre carte révélée est un Héros (toujours posable) → la garde de filet ne
    // force pas Apparence Retrouvée.
    const hero: CardInstance = { instanceId: 'h', cardId: 'eric', name: 'Eric', type: 'hero', strength: 3 }
    const s: GameState = {
      ...base,
      activePlayer: 1,
      pendingFate: { target: 0, revealed: [apparence, hero] },
      players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'repaire', fateDiscard: [] } : p)),
    }
    const opts = enumerateActions(s)
    expect(opts.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === apparence.instanceId)).toBe(false)
    // Le Héros, lui, reste jouable.
    expect(opts.some((a) => a.type === 'RESOLVE_FATE' && a.instanceId === hero.instanceId)).toBe(true)
  })
  it('Polochon mélange la défausse Vilain dans la pioche', () => {
    const base = game()
    const x: CardInstance = { instanceId: 'x', cardId: 'tourbillon', name: 'T', type: 'effect' }
    const s: GameState = { ...base, players: base.players.map((pp, i) => (i === 0 ? { ...pp, deck: [], discard: [x] } : pp)) }
    const next = resolveEffect(s, { type: 'SHUFFLE_VILLAIN_DISCARD' }, { actorIndex: 0 })
    expect(next.players[0].discard).toHaveLength(0)
    expect(next.players[0].deck.some((c) => c.instanceId === 'x')).toBe(true)
  })
  it("Polochon est câblé : sa pose (onPlace) mélange bien la défausse Vilain d'Ursula", () => {
    const base = game()
    const x: CardInstance = { instanceId: 'x', cardId: 'tourbillon', name: 'T', type: 'effect' }
    const polochon = buildDeckInstances(ursulaCards, 'fate', 'pol:').find((c) => c.cardId === 'polochon')!
    expect(polochon.onPlace?.some((e) => e.type === 'SHUFFLE_VILLAIN_DISCARD')).toBe(true)
    const s: GameState = { ...base, players: base.players.map((pp, i) => (i === 0 ? { ...pp, deck: [], discard: [x] } : pp)) }
    const dest = base.players[0].locations[0].id
    const next = placeFateHeroWithEffects(s, 0, 1, polochon, dest, 'Lieu')
    expect(next.players[0].discard).toHaveLength(0)
    expect(next.players[0].deck.some((c) => c.instanceId === 'x')).toBe(true)
  })
  it('Opportunisme ouvre le choix puis reprend la carte en main', () => {
    const it1: CardInstance = { instanceId: 'i', cardId: 'chaudron', name: 'Chaudron', type: 'item' }
    const cond: CardInstance = { instanceId: 'c', cardId: 'arrogance', name: 'Arrogance', type: 'condition' }
    const base = game()
    let s: GameState = { ...base, players: base.players.map((pp, i) => (i === 0 ? { ...pp, discard: [it1, cond], hand: [] } : pp)) }
    s = resolveEffect(s, { type: 'RECOVER_ITEM_OR_EVENT' }, { actorIndex: 0 })
    expect(s.pendingRecover?.candidateIds).toEqual(['i']) // la Condition n'est pas éligible
    s = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: 'i' })
    expect(s.players[0].hand.some((c) => c.instanceId === 'i')).toBe(true)
  })
  it('Ariel gèle un Objet : Ursula ne peut plus le déplacer', () => {
    const ariel = hero('ar', 'ariel', 4)
    const trident: CardInstance = { instanceId: 'tr', cardId: 'trident', name: 'Trident', type: 'item' }
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, repaire: [ariel], navire: [trident] } } : p,
      ),
    }
    const next = resolveEffect(s, { type: 'ARIEL_FREEZE_ITEM' }, { actorIndex: 0, hostInstanceId: 'ar', hostLocationId: 'repaire' })
    const moved = (next.players[0].board['repaire'] ?? []).find((c) => c.instanceId === 'tr')
    expect(moved?.frozenBy).toBe('ar')
  })
})

describe('Ursula — Colère Titanesque (action d’un lieu voisin)', () => {
  it('ouvre le choix du lieu voisin, puis exécute une action depuis ce lieu', () => {
    let s = game()
    s = { ...s, phase: 'ACTION', players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'repaire', power: 0 } : p)) }
    s = resolveEffect(s, { type: 'GIANT_ACTION' }, { actorIndex: 0 })
    expect(s.pendingGiantAction?.playerIndex).toBe(0)
    // Choisir le Navire (voisin du Repaire).
    s = applyAction(s, { type: 'RESOLVE_GIANT_LOCATION', locationId: 'navire' })
    expect(s.actAtLocation).toBe('navire')
    // Exécuter « Gagner 1 pouvoir » du Navire.
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.players[0].power).toBe(1)
    expect(s.actAtLocation ?? null).toBeNull() // l'action « géante » est consommée
    expect(s.usedActionIds).toEqual([]) // n'a pas consommé l'économie d'actions du Repaire
  })
})

describe('Ursula — Cadenas mobile (Métamorphose)', () => {
  it('le Palais démarre bloqué', () => {
    expect(game().players[0].lockedLocations).toContain('palais')
  })
  it('TOGGLE_URSULA_LOCK ouvre un CHOIX ; RESOLVE_URSULA_LOCK déplace vers le lieu non bloqué', () => {
    let s = game()
    // Ouvre le choix : le Palais est bloqué → destination proposée = Repaire (non bloqué).
    s = resolveEffect(s, { type: 'TOGGLE_URSULA_LOCK' }, { actorIndex: 0 })
    expect(s.pendingUrsulaLock).toMatchObject({ playerIndex: 0, chooserIndex: 0, dest: 'repaire' })
    expect(s.players[0].lockedLocations).toEqual(['palais']) // rien tant que non résolu
    // On déplace → le Cadenas passe sur le Repaire.
    s = applyAction(s, { type: 'RESOLVE_URSULA_LOCK', move: true })
    expect(s.pendingUrsulaLock).toBeFalsy()
    expect(s.players[0].lockedLocations).toEqual(['repaire'])
    // Nouveau choix (dest = Palais) puis « passer » → inchangé.
    s = resolveEffect(s, { type: 'TOGGLE_URSULA_LOCK' }, { actorIndex: 0 })
    expect(s.pendingUrsulaLock?.dest).toBe('palais')
    s = applyAction(s, { type: 'RESOLVE_URSULA_LOCK', move: false })
    expect(s.players[0].lockedLocations).toEqual(['repaire'])
  })
})
