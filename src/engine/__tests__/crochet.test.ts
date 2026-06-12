import { describe, it, expect } from 'vitest'
import { performVanquish, resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { effectiveStrength, getAvailableActions } from '../rules'
import { crochet } from '../../data/villains/crochet'
import { crochetCards } from '../../data/villains/crochet.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const peterPan = (id = 'pp'): CardInstance => ({ instanceId: id, cardId: 'peter-pan', name: 'Peter Pan', type: 'hero', strength: 8 })
const ally = (id: string, cardId: string, strength: number): CardInstance => ({ instanceId: id, cardId, name: cardId, type: 'ally', strength })

function game(): GameState {
  return createInitialGame(
    [
      { villain: crochet, deckCards: buildDeckInstances(crochetCards, 'villain', 'p0:'), fateCards: buildDeckInstances(crochetCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    7,
  )
}

/** Place `cards` sur `loc` du joueur actif (Crochet), pion sur `loc`. */
function withBoard(loc: string, cards: CardInstance[]): GameState {
  const base = game()
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: loc, board: { ...p.board, [loc]: cards } } : p)),
  }
}

describe('Capitaine Crochet — decks', () => {
  it('30 cartes Vilain et 15 cartes Fatalité', () => {
    const villain = crochetCards.filter((c) => c.deck === 'villain').reduce((n, c) => n + c.copies, 0)
    const fate = crochetCards.filter((c) => c.deck === 'fate').reduce((n, c) => n + c.copies, 0)
    expect(villain).toBe(30)
    expect(fate).toBe(15)
  })
})

describe('Capitaine Crochet — objectif (vaincre Peter Pan sur le Jolly Roger)', () => {
  it('éliminer Peter Pan sur le Jolly Roger = victoire', () => {
    const s = withBoard('jolly-roger', [peterPan('pp'), ally('a1', 'brute', 4), ally('a2', 'brute', 4)])
    const next = performVanquish(s, 'pp', ['a1', 'a2'], false)
    expect(next.status).toBe('WON')
    expect(next.winner).toBe(0)
  })

  it('éliminer Peter Pan AILLEURS ne gagne pas', () => {
    const s = withBoard('rocher-crane', [peterPan('pp'), ally('a1', 'brute', 4), ally('a2', 'brute', 4)])
    const next = performVanquish(s, 'pp', ['a1', 'a2'], false)
    expect(next.status).toBe('PLAYING')
  })
})

describe('Capitaine Crochet — règles de combat', () => {
  it('Enfants Perdus exigent au moins 2 Alliés', () => {
    const lost: CardInstance = { instanceId: 'lp', cardId: 'enfants-perdus', name: 'Enfants Perdus', type: 'hero', strength: 4 }
    const s = withBoard('jolly-roger', [lost, ally('a1', 'brute', 4)])
    expect(() => performVanquish(s, 'lp', ['a1'], false)).toThrow()
  })

  it('Flibustiers : éliminent un Héros sur un lieu VOISIN non bloqué', () => {
    // Flibustier au Jolly Roger, Héros au Rocher du Crâne (lieux côte à côte).
    const fli = ally('f', 'flibustiers', 2)
    const hero: CardInstance = { instanceId: 'h', cardId: 'wendy', name: 'Wendy', type: 'hero', strength: 2 }
    const base = game()
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p, i) =>
        i === 0
          ? { ...p, pawnLocation: 'jolly-roger', board: { ...p.board, 'jolly-roger': [fli], 'rocher-crane': [hero] } }
          : p,
      ),
    }
    const next = performVanquish(s, 'h', ['f'], false)
    expect(next.players[0].fateDiscard.some((c) => c.cardId === 'wendy')).toBe(true)
  })

  it('Provocation : se associe au Héros choisi via RESOLVE_FATE', () => {
    // Fatalité jouée par le Prince Jean (joueur 1) contre Crochet (joueur 0),
    // qui a Wendy sur le Jolly Roger. Provocation doit s'y attacher.
    const hero: CardInstance = { instanceId: 'h1', cardId: 'wendy', name: 'Wendy', type: 'hero', strength: 3 }
    const taunt: CardInstance = { instanceId: 't', cardId: 'provocation', name: 'Provocation', type: 'item', attach: 'hero' }
    const base = withBoard('jolly-roger', [hero])
    const s: GameState = {
      ...base,
      activePlayer: 1,
      pendingFate: { target: 0, revealed: [taunt] },
    }
    const next = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 't', targetHeroId: 'h1' })
    const placed = (next.players[0].board['jolly-roger'] ?? []).find((c) => c.cardId === 'provocation')
    expect(placed?.attachedTo).toBe('h1')
    expect(next.pendingFate).toBeNull()
  })

  it('Provocation : un Héros provocateur doit être éliminé en premier', () => {
    const taunted: CardInstance = { instanceId: 'h1', cardId: 'wendy', name: 'Wendy', type: 'hero', strength: 3 }
    const other: CardInstance = { instanceId: 'h2', cardId: 'jean', name: 'Jean', type: 'hero', strength: 2 }
    const taunt: CardInstance = { instanceId: 't', cardId: 'provocation', name: 'Provocation', type: 'item', attachedTo: 'h1' }
    const s = withBoard('jolly-roger', [taunted, other, taunt, ally('a1', 'brute', 4)])
    // h2 (non provocateur) ne peut pas être éliminé tant que h1 (provocateur) est là
    expect(() => performVanquish(s, 'h2', ['a1'], false)).toThrow()
  })
})

describe('Capitaine Crochet — bonus de force', () => {
  it('Monsieur Mouche +2 sur le Jolly Roger', () => {
    const s = withBoard('jolly-roger', [ally('m', 'monsieur-mouche', 2)])
    expect(effectiveStrength(s, 0, 'm')).toBe(4)
  })
  it('Monsieur Mouche sans bonus ailleurs', () => {
    const s = withBoard('rocher-crane', [ally('m', 'monsieur-mouche', 2)])
    expect(effectiveStrength(s, 0, 'm')).toBe(2)
  })
  it('Sabre d’Abordage +2 à l’Allié associé', () => {
    const sabre: CardInstance = { instanceId: 's', cardId: 'sabre-abordage', name: 'Sabre', type: 'item', attachedTo: 'b' }
    const s = withBoard('jolly-roger', [ally('b', 'boucanier', 2), sabre])
    expect(effectiveStrength(s, 0, 'b')).toBe(4)
  })
  it('Wendy donne +1 aux AUTRES Héros, pas à elle-même', () => {
    const wendy: CardInstance = { instanceId: 'w', cardId: 'wendy', name: 'Wendy', type: 'hero', strength: 3 }
    const jean: CardInstance = { instanceId: 'j', cardId: 'jean', name: 'Jean', type: 'hero', strength: 2 }
    const s = withBoard('jolly-roger', [wendy, jean])
    expect(effectiveStrength(s, 0, 'w')).toBe(3) // Wendy : pas de bonus sur elle
    expect(effectiveStrength(s, 0, 'j')).toBe(3) // Jean : 2 + 1 (Wendy)
  })
  it('Poussière de Fée +2 au Héros associé', () => {
    const pp = peterPan('pp')
    const dust: CardInstance = { instanceId: 'd', cardId: 'poussiere-fee', name: 'Poussière', type: 'item', attachedTo: 'pp' }
    const s = withBoard('jolly-roger', [pp, dust])
    expect(effectiveStrength(s, 0, 'pp')).toBe(10) // 8 + 2
  })
})

describe('Capitaine Crochet — Migraine Atroce', () => {
  const migraine: CardInstance = { instanceId: 'm1', cardId: 'migraine-atroce', name: 'Migraine Atroce', type: 'effect' }
  const other: CardInstance = { instanceId: 'o3', cardId: 'splitting', name: 'X', type: 'effect' }

  it('défausse un Objet du royaume au choix', () => {
    const item: CardInstance = { instanceId: 'it', cardId: 'canon', name: 'Canon', type: 'item' }
    let s = game()
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [migraine, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'jolly-roger': [item] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'm1' })
    expect(s.pendingFateChoice?.kind).toBe('remove-item')
    expect(s.pendingFateChoice?.candidateIds).toEqual(['it'])
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'it' })
    expect((s.players[0].board['jolly-roger'] ?? []).some((c) => c.instanceId === 'it')).toBe(false)
    expect(s.players[0].discard.some((c) => c.cardId === 'canon')).toBe(true)
  })

  it('sans Objet présent, n’ouvre aucun choix (no-op)', () => {
    let s = game()
    s = { ...s, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [migraine, other] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'm1' })
    expect(s.pendingFateChoice ?? null).toBeNull()
  })
})

describe('Capitaine Crochet — Carte du Pays Imaginaire (capacité)', () => {
  it('se défausse pour jouer gratuitement un Objet de la main', () => {
    const map: CardInstance = { instanceId: 'map1', cardId: 'carte-pays-imaginaire', name: 'Carte du Pays Imaginaire', type: 'item' }
    const canon: CardInstance = { instanceId: 'canon1', cardId: 'canon', name: 'Canon', type: 'item' }
    let s = game()
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, pawnLocation: 'jolly-roger', hand: [canon], board: { ...p.board, 'jolly-roger': [map] } } : p,
      ),
    }
    const next = applyAction(s, { type: 'USE_NEVERLAND_MAP', itemInstanceId: 'canon1', to: 'rocher-crane' })
    // La Carte est défaussée, le Canon est posé gratuitement, la main est vidée.
    expect(next.players[0].discard.some((c) => c.cardId === 'carte-pays-imaginaire')).toBe(true)
    expect((next.players[0].board['rocher-crane'] ?? []).some((c) => c.cardId === 'canon')).toBe(true)
    expect((next.players[0].board['jolly-roger'] ?? []).some((c) => c.cardId === 'carte-pays-imaginaire')).toBe(false)
    expect(next.players[0].hand.some((c) => c.cardId === 'canon')).toBe(false)
    expect(next.players[0].power).toBe(s.players[0].power) // gratuit
  })
})

describe('Capitaine Crochet — Arbre du Pendu', () => {
  it('démarre verrouillé', () => {
    const s = game()
    expect(s.players[0].lockedLocations).toContain('arbre-pendu')
  })
  it('Carte du Pays Imaginaire le déverrouille', () => {
    const s = game()
    const next = resolveEffect(s, { type: 'UNLOCK_LOCATION', locationId: 'arbre-pendu' }, { actorIndex: 0 })
    expect(next.players[0].lockedLocations ?? []).not.toContain('arbre-pendu')
  })
})

const canon = (id = 'c'): CardInstance => ({
  instanceId: id, cardId: 'canon', name: 'Canon', type: 'item',
  grantsAction: { type: 'VANQUISH', label: 'Éliminer un héros (Canon)' },
})
const boite = (id = 'b'): CardInstance => ({
  instanceId: id, cardId: 'boite-crochets', name: 'Boîte à Crochets', type: 'item',
  grantsAction: { type: 'GAIN_POWER', amount: 1, label: 'Gagner 1 (Boîte)' },
})

describe('Capitaine Crochet — actions accordées par un Objet', () => {
  it('le Canon ajoute une action « Éliminer un héros » au lieu', () => {
    const s = withBoard('rocher-crane', [canon('c')])
    const ids = getAvailableActions(s).map((a) => a.id)
    expect(ids).toContain('granted:c')
    expect(getAvailableActions(s).find((a) => a.id === 'granted:c')?.type).toBe('VANQUISH')
  })
  it('la Boîte à Crochets ajoute « Gagner 1 pouvoir » et est exécutable', () => {
    const s = withBoard('rocher-crane', [boite('b')])
    expect(getAvailableActions(s).map((a) => a.id)).toContain('granted:b')
    const before = s.players[0].power
    const next = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'granted:b' })
    expect(next.players[0].power).toBe(before + 1)
  })
  it('un Objet accordant une action ne la donne plus une fois associé', () => {
    const attached: CardInstance = { ...canon('c'), attachedTo: 'x' }
    const s = withBoard('rocher-crane', [attached])
    expect(getAvailableActions(s).map((a) => a.id)).not.toContain('granted:c')
  })
})

describe('Capitaine Crochet — Peter Pan auto-placé', () => {
  it('dévoilé par la Fatalité adverse, Peter Pan fonce sur l’Arbre du Pendu (même verrouillé)', () => {
    // J1 (Prince Jean) lance la Fatalité contre Crochet (J0). On force le deck
    // Fatalité de Crochet à révéler Peter Pan en tête.
    let s = game()
    s = { ...s, activePlayer: 1, phase: 'ACTION' as const }
    const pp = peterPan('pp')
    const fateLoc = s.players[1].locations.find((l) => l.actions.some((a) => a.type === 'FATE'))!
    const fateActionId = fateLoc.actions.find((a) => a.type === 'FATE')!.id
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 1
          ? { ...p, pawnLocation: fateLoc.id }
          : { ...p, fateDeck: [pp, ...p.fateDeck] },
      ),
    }
    const next = applyAction(s, { type: 'FATE', actionId: fateActionId })
    expect((next.players[0].board['arbre-pendu'] ?? []).some((c) => c.cardId === 'peter-pan')).toBe(true)
    expect(next.pendingFate ?? null).toBeNull()
  })
})

describe('Capitaine Crochet — Tic Tac', () => {
  it('arriver sur le lieu de Tic Tac défausse toute la main', () => {
    let s = game()
    const tic: CardInstance = { instanceId: 't', cardId: 'tic-tac', name: 'Tic Tac', type: 'hero', strength: 5 }
    const hand: CardInstance[] = [{ instanceId: 'h1', cardId: 'boucanier', name: 'B', type: 'ally', strength: 2 }]
    s = {
      ...s,
      phase: 'MOVE' as const,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, pawnLocation: 'jolly-roger', hand, board: { ...p.board, 'rocher-crane': [tic] } } : p,
      ),
    }
    const next = applyAction(s, { type: 'MOVE', to: 'rocher-crane' })
    expect(next.players[0].hand).toHaveLength(0)
    expect(next.players[0].discard.some((c) => c.cardId === 'boucanier')).toBe(true)
  })
})

describe('Capitaine Crochet — Clochette / Digne Adversaire / Pas de Quartier', () => {
  it('Clochette (DISCARD_ALLY_AT_HOST) défausse un Allié sur son lieu', () => {
    const s = withBoard('jolly-roger', [{ instanceId: 'a', cardId: 'boucanier', name: 'B', type: 'ally', strength: 2 }])
    const next = resolveEffect(s, { type: 'DISCARD_ALLY_AT_HOST' }, { actorIndex: 0, hostLocationId: 'jolly-roger' })
    expect((next.players[0].board['jolly-roger'] ?? []).some((c) => c.cardId === 'boucanier')).toBe(false)
    expect(next.players[0].discard.some((c) => c.cardId === 'boucanier')).toBe(true)
  })
  it('Digne Adversaire (REVEAL_OWN_FATE_PLAY_HERO) dévoile un Héros à jouer ou défausser', () => {
    const base = game()
    const s = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'jolly-roger' } : p)) }
    const heroesBefore = Object.values(s.players[0].board).flat().filter((c) => c.type === 'hero').length
    const revealed = resolveEffect(s, { type: 'REVEAL_OWN_FATE_PLAY_HERO' }, { actorIndex: 0 })
    expect(revealed.pendingFetchedHero?.playerIndex).toBe(0)
    // On choisit de le jouer sur le Rocher du Crâne.
    const played = applyAction(revealed, { type: 'RESOLVE_FETCHED_HERO', play: true, to: 'rocher-crane' })
    const heroesAfter = Object.values(played.players[0].board).flat().filter((c) => c.type === 'hero').length
    expect(heroesAfter).toBe(heroesBefore + 1)
    expect(played.pendingFetchedHero ?? null).toBeNull()
  })
  it('Digne Adversaire : les AUTRES cartes dévoilées sont défaussées (le Héros est joué)', () => {
    const s = game()
    const revealed = resolveEffect(s, { type: 'REVEAL_OWN_FATE_PLAY_HERO' }, { actorIndex: 0 })
    const others = revealed.pendingFetchedHero!.discarded
    const played = applyAction(revealed, { type: 'RESOLVE_FETCHED_HERO', play: true, to: 'jolly-roger' })
    for (const o of others) {
      expect(played.players[0].fateDiscard.some((c) => c.instanceId === o.instanceId)).toBe(true)
    }
  })
  it('Faites-leur peur ! (SCRY) ouvre le tri des 2 cartes, puis RESOLVE_SCRY ré-ordonne/défausse', () => {
    const w: CardInstance = { instanceId: 'w', cardId: 'wendy', name: 'Wendy', type: 'hero', strength: 3 }
    const j: CardInstance = { instanceId: 'j', cardId: 'jean', name: 'Jean', type: 'hero', strength: 2 }
    let s = game()
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, fateDeck: [w, j, ...p.fateDeck] } : p)) }
    s = resolveEffect(s, { type: 'SCRY_OWN_FATE_TOP2' }, { actorIndex: 0 })
    expect(s.pendingScry?.cards.map((c) => c.instanceId)).toEqual(['w', 'j'])
    // On garde Jean sur le dessus et on défausse Wendy.
    const next = applyAction(s, { type: 'RESOLVE_SCRY', topInstanceIds: ['j'] })
    expect(next.pendingScry ?? null).toBeNull()
    expect(next.players[0].fateDeck[0].instanceId).toBe('j')
    expect(next.players[0].fateDiscard.some((c) => c.instanceId === 'w')).toBe(true)
  })

  it('Faites-leur peur ! : tout défausser (RESOLVE_SCRY vide)', () => {
    const w: CardInstance = { instanceId: 'w', cardId: 'wendy', name: 'Wendy', type: 'hero', strength: 3 }
    const j: CardInstance = { instanceId: 'j', cardId: 'jean', name: 'Jean', type: 'hero', strength: 2 }
    let s = game()
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, fateDeck: [w, j, ...p.fateDeck] } : p)) }
    s = resolveEffect(s, { type: 'SCRY_OWN_FATE_TOP2' }, { actorIndex: 0 })
    const next = applyAction(s, { type: 'RESOLVE_SCRY', topInstanceIds: [] })
    expect(next.players[0].fateDiscard.filter((c) => c.instanceId === 'w' || c.instanceId === 'j')).toHaveLength(2)
    expect(next.players[0].fateDeck.slice(0, 2).map((c) => c.instanceId)).not.toContain('w')
  })

  it('Pas de Quartier (MOVE_ALLY_BUFF) ouvre la sélection, puis déplace l’Allié choisi +2', () => {
    let s = withBoard('jolly-roger', [{ instanceId: 'a', cardId: 'boucanier', name: 'B', type: 'ally', strength: 2 }])
    s = resolveEffect(s, { type: 'MOVE_ALLY_BUFF', amount: 2 }, { actorIndex: 0 })
    expect(s.pendingAllyMoveBuff).toEqual({ playerIndex: 0, amount: 2 })
    // On déplace l'Allié vers le Rocher du Crâne (voisin du Jolly Roger).
    const next = applyAction(s, { type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId: 'a', to: 'rocher-crane' })
    expect(next.pendingAllyMoveBuff ?? null).toBeNull()
    const at = next.players[0].locations.find((l) => (next.players[0].board[l.id] ?? []).some((c) => c.instanceId === 'a'))
    expect(at?.id).toBe('rocher-crane')
    expect(effectiveStrength(next, 0, 'a')).toBe(4)
  })
  it('Pas de Quartier : déplacement vers un lieu non voisin refusé', () => {
    let s = withBoard('jolly-roger', [{ instanceId: 'a', cardId: 'boucanier', name: 'B', type: 'ally', strength: 2 }])
    s = resolveEffect(s, { type: 'MOVE_ALLY_BUFF', amount: 2 }, { actorIndex: 0 })
    // lagune-sirenes n'est pas voisin du jolly-roger.
    expect(() => applyAction(s, { type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId: 'a', to: 'lagune-sirenes' })).toThrow()
  })
})
