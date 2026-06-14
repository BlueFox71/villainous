import { describe, it, expect } from 'vitest'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { getAvailableActions } from '../rules'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [{ villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'p0:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'p0f:') }],
    7,
  )
}
const ally = (id: string): CardInstance => ({ instanceId: id, cardId: 'bouldergeist', name: 'Bouldergeist', type: 'ally', strength: 4 })
const weakHero = (id: string): CardInstance => ({ instanceId: id, cardId: 'luigi', name: 'Luigi', type: 'hero', strength: 3 })
const peach = (id: string): CardInstance => ({ instanceId: id, cardId: 'peach', name: 'Peach', type: 'hero', strength: 2 })

/** Place une carte du deck (par cardId) en main et prépare la phase d'action. */
function withCardInHand(base: GameState, cardId: string, patch: Partial<GameState['players'][0]> = {}): { state: GameState; card: CardInstance } {
  const me = base.players[0]
  const card = me.deck.find((c) => c.cardId === cardId)!
  const state: GameState = {
    ...base,
    phase: 'ACTION',
    usedActionIds: [],
    players: [{ ...me, hand: [card], power: 5, deck: me.deck.filter((c) => c.instanceId !== card.instanceId), ...patch }],
  }
  return { state, card }
}

describe('Bowser — cartes jouées (intégration)', () => {
  it("épuisement d'énergie draine une Étoile vers l'Allié choisi", () => {
    const { state, card } = withCardInHand(game(), 'puissance-stellaire', {
      pawnLocation: 'galaxies',
      observatoryStars: 4,
    })
    const a = ally('a1')
    const s: GameState = { ...state, players: [{ ...state.players[0], board: { ...state.players[0].board, galaxies: [a] } }] }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, allyInstanceIds: ['a1'] })
    expect(after.players[0].observatoryStars).toBe(3)
    expect(after.players[0].board.galaxies[0].stars).toBe(1)
  })

  it('Dino Piranha posé sur l\'Observatoire prend une Étoile', () => {
    const { state, card } = withCardInHand(game(), 'dino-piranha', { pawnLocation: 'observatoire', observatoryStars: 4 })
    const after = applyAction(state, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: card.instanceId, to: 'observatoire' })
    const dino = after.players[0].board.observatoire.find((c) => c.cardId === 'dino-piranha')
    expect(dino?.stars).toBe(1)
    expect(after.players[0].observatoryStars).toBe(3)
  })

  it('Impuissance sans cible capture Peach', () => {
    // Jouée depuis Galaxies (sans Héros) ; Peach est au Château de Peach.
    const { state, card } = withCardInHand(game(), 'impuissance', { pawnLocation: 'galaxies' })
    const s: GameState = { ...state, players: [{ ...state.players[0], board: { ...state.players[0].board, 'chateau-peach': [peach('p1')] } }] }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId })
    expect(after.players[0].peachCaptured).toBe(true)
  })

  it('Galaxie hantée (Activer) ajoute une carte à la main', () => {
    const base = game()
    const me = base.players[0]
    const ghostly = me.deck.find((c) => c.cardId === 'ghostly')!
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'galaxies',
        deck: me.deck.filter((c) => c.instanceId !== ghostly.instanceId),
        hand: [],
        board: { ...me.board, galaxies: [{ ...ghostly }] },
      }],
    }
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: ghostly.instanceId })
    // Ouvre le choix interactif : regarder 4, en garder 1 (résolu ensuite par le joueur/bot).
    expect(after.pendingLookTop?.cards).toHaveLength(4)
    expect(after.pendingLookTop?.take).toBe(1)
  })

  it('Bowser Jr. (Activer, 3 JT) trouve Peach et la joue au Château de Peach', () => {
    const base = game()
    const me = base.players[0]
    const jr = me.deck.find((c) => c.cardId === 'bowser-jr')!
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'galaxies',
        deck: me.deck.filter((c) => c.instanceId !== jr.instanceId),
        board: { ...me.board, galaxies: [{ ...jr }] },
      }],
    }
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: jr.instanceId })
    expect(after.players[0].power).toBe(2) // 5 − 3
    expect(after.players[0].board['chateau-peach'].some((c) => c.cardId === 'peach')).toBe(true)
    expect(after.players[0].fateDeck.some((c) => c.cardId === 'peach')).toBe(false)
  })

  it('Te revoilà ! ouvre la récupération d\'une carte de la défausse', () => {
    const base = game()
    const me = base.players[0]
    const rencontre = me.deck.find((c) => c.cardId === 'rencontre')!
    const discarded = me.deck.find((c) => c.cardId === 'monnaie' || c.instanceId !== rencontre.instanceId)!
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'galaxies',
        hand: [rencontre],
        discard: [discarded],
        deck: me.deck.filter((c) => c.instanceId !== rencontre.instanceId),
      }],
    }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: rencontre.instanceId })
    expect(after.pendingRecover?.candidateIds).toContain(discarded.instanceId)
  })

  it('Vol du château joue le premier Allié/Objet dévoilé sur le lieu du pion', () => {
    const base = game()
    const me = base.players[0]
    const decoupage = me.deck.find((c) => c.cardId === 'decoupage')!
    const evt = me.deck.find((c) => c.type === 'effect' && c.instanceId !== decoupage.instanceId)!
    const ally = me.deck.find((c) => c.type === 'ally')!
    const rest = me.deck.filter((c) => ![decoupage.instanceId, evt.instanceId, ally.instanceId].includes(c.instanceId))
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'galaxies',
        hand: [decoupage],
        deck: [evt, ally, ...rest], // dévoile evt (passe), puis ally (joué)
      }],
    }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: decoupage.instanceId })
    expect(after.players[0].board.galaxies.some((c) => c.instanceId === ally.instanceId)).toBe(true)
    expect(after.players[0].deck[0].instanceId).toBe(evt.instanceId) // remise sur le dessus
  })

  it('Grand Terrier ouvre un déplacement d’Allié FACULTATIF (résolu ou décliné)', () => {
    const { state, card } = withCardInHand(game(), 'grand-terrier', { pawnLocation: 'galaxies', observatoryStars: 4 })
    const a = ally('a1') // posé au Château de Bowser (voisin : Galaxies)
    const s: GameState = { ...state, players: [{ ...state.players[0], board: { ...state.players[0].board, 'chateau-bowser': [a] } }] }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, to: 'galaxies' })
    // Grand Terrier est posé ET un déplacement facultatif (+0 force) est ouvert.
    expect(after.players[0].board.galaxies.some((c) => c.cardId === 'grand-terrier')).toBe(true)
    expect(after.pendingAllyMoveBuff?.optional).toBe(true)
    expect(after.pendingAllyMoveBuff?.amount).toBe(0)
    // Résolution : a1 se déplace vers Galaxies (voisin), sans bonus de force.
    const moved = applyAction(after, { type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId: 'a1', to: 'galaxies' })
    expect(moved.pendingAllyMoveBuff ?? null).toBeNull()
    expect(moved.players[0].board.galaxies.some((c) => c.instanceId === 'a1')).toBe(true)
    // Décliner est autorisé (déplacement facultatif).
    const skipped = applyAction(after, { type: 'SKIP_ALLY_MOVE_BUFF' })
    expect(skipped.pendingAllyMoveBuff ?? null).toBeNull()
    expect(skipped.players[0].board['chateau-bowser'].some((c) => c.instanceId === 'a1')).toBe(true)
  })

  it('Bateau (véhicule, comme le Char) déplace figurine + Bateau et n’accorde qu’une action', () => {
    const base = game()
    const me = base.players[0]
    const bateau = [...me.deck, ...me.hand].find((c) => c.cardId === 'bateau')!
    expect(bateau.ridesWithPawn).toBe(true) // champ recopié depuis la CardDef
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        pawnLocation: 'galaxies',
        observatoryStars: 4,
        deck: me.deck.filter((c) => c.instanceId !== bateau.instanceId),
        hand: me.hand.filter((c) => c.instanceId !== bateau.instanceId),
        board: { ...me.board, galaxies: [{ ...bateau }] },
      }],
    }
    const moved = applyAction(s, { type: 'CHARIOT_MOVE', instanceId: bateau.instanceId, to: 'chateau-peach' })
    expect(moved.players[0].pawnLocation).toBe('chateau-peach')
    expect(moved.players[0].board['chateau-peach'].some((c) => c.instanceId === bateau.instanceId)).toBe(true)
    // Une seule fois par tour.
    expect(() => applyAction(moved, { type: 'CHARIOT_MOVE', instanceId: bateau.instanceId, to: 'galaxies' })).toThrow()
    // Pas d'action Fatalité comme action bonus (le Château de Peach en a une).
    expect(getAvailableActions(moved).map((a) => a.type)).not.toContain('FATE')
  })

  it('Galaxie en verre : l’action accordée « Déplacer un Allié/Objet » déplace bien vers un lieu voisin', () => {
    const base = game()
    const me = base.players[0]
    const glass = [...me.deck, ...me.hand].find((c) => c.cardId === 'boule-verre')!
    const a = ally('a1') // Allié à déplacer, sur le lieu de la Galaxie
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        pawnLocation: 'galaxies',
        observatoryStars: 4,
        deck: me.deck.filter((c) => c.instanceId !== glass.instanceId),
        hand: me.hand.filter((c) => c.instanceId !== glass.instanceId),
        board: { ...me.board, galaxies: [{ ...glass }, a] },
      }],
    }
    // L'action accordée a l'id « granted:<instanceId de la Galaxie> ».
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: `granted:${glass.instanceId}`, instanceId: 'a1', to: 'chateau-bowser' })
    expect(after.players[0].board['chateau-bowser'].some((c) => c.instanceId === 'a1')).toBe(true)
    expect(after.players[0].board.galaxies.some((c) => c.instanceId === 'a1')).toBe(false)
  })

  it('Impuissance avec cible élimine un Héros de force ≤3', () => {
    const { state, card } = withCardInHand(game(), 'impuissance', { pawnLocation: 'galaxies' })
    const h = weakHero('h1')
    const s: GameState = { ...state, players: [{ ...state.players[0], board: { ...state.players[0].board, 'chateau-peach': [h] } }] }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, targetHeroId: 'h1' })
    expect(after.players[0].board['chateau-peach'].some((c) => c.instanceId === 'h1')).toBe(false)
    expect(after.players[0].peachCaptured).toBeFalsy()
  })
})
