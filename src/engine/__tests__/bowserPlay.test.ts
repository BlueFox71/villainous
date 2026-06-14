import { describe, it, expect } from 'vitest'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { getAvailableActions, heroPlacementLocations } from '../rules'
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
  it("épuisement d'énergie draine une Étoile vers un Allié SUR l'Observatoire", () => {
    // La carte se joue depuis Galaxies, mais l'Allié receveur est sur l'Observatoire.
    const { state, card } = withCardInHand(game(), 'puissance-stellaire', {
      pawnLocation: 'galaxies',
      observatoryStars: 4,
    })
    const a = ally('a1')
    const s: GameState = { ...state, players: [{ ...state.players[0], board: { ...state.players[0].board, observatoire: [a] } }] }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: card.instanceId, allyInstanceIds: ['a1'] })
    expect(after.players[0].observatoryStars).toBe(3)
    expect(after.players[0].board.observatoire[0].stars).toBe(1)
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

  it('Vol du château dévoile jusqu’à un Allié, puis on choisit le lieu où le poser', () => {
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
        deck: [evt, ally, ...rest], // dévoile evt (passe), puis ally (trouvé)
      }],
    }
    // 1) Jouer Vol du château ouvre le choix (la carte n'est pas encore posée).
    const revealed = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: decoupage.instanceId })
    expect(revealed.pendingCastleTheft?.found.instanceId).toBe(ally.instanceId)
    expect(revealed.pendingCastleTheft?.revealed.map((c) => c.instanceId)).toEqual([evt.instanceId])
    expect(revealed.players[0].deck[0].instanceId).toBe(evt.instanceId) // remise sur le dessus
    expect(revealed.players[0].board.galaxies.some((c) => c.instanceId === ally.instanceId)).toBe(false)
    // 2) Choisir le lieu → l'Allié y est posé.
    const placed = applyAction(revealed, { type: 'RESOLVE_CASTLE_THEFT', to: 'chateau-peach' })
    expect(placed.pendingCastleTheft ?? null).toBeNull()
    expect(placed.players[0].board['chateau-peach'].some((c) => c.instanceId === ally.instanceId)).toBe(true)
  })

  it('Vol du château avec pioche VIDE : mélange la défausse et y pioche', () => {
    const base = game()
    const me = base.players[0]
    const decoupage = me.deck.find((c) => c.cardId === 'decoupage')!
    const evt = me.deck.find((c) => c.type === 'effect' && c.instanceId !== decoupage.instanceId)!
    const ally = me.deck.find((c) => c.type === 'ally')!
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'galaxies',
        hand: [decoupage],
        deck: [], // pioche Vilain VIDE
        discard: [evt, ally], // tout est dans la défausse
      }],
    }
    const revealed = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: decoupage.instanceId })
    // La défausse a été mélangée dans la pioche : l'Allié qui s'y trouvait est trouvé.
    expect(revealed.pendingCastleTheft).toBeTruthy()
    expect(revealed.pendingCastleTheft!.found.instanceId).toBe(ally.instanceId)
    // L'Événement dévoilé est remis sur le dessus de la pioche (réalimentée).
    expect(revealed.players[0].deck.some((c) => c.instanceId === evt.instanceId)).toBe(true)
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

  it('Peach (Fatalité) ne peut être posée QUE au Château de Peach', () => {
    const base = game()
    const peach = base.players[0].fateDeck.find((c) => c.cardId === 'peach')!
    expect(heroPlacementLocations(base, peach, 0)).toEqual(['chateau-peach'])
  })

  it('Vol du château : un Allié à Étoile (Dino Piranha) posé sur l’Observatoire prend une Étoile', () => {
    const base = game()
    const me = base.players[0]
    const decoupage = me.deck.find((c) => c.cardId === 'decoupage')!
    const dino = me.deck.find((c) => c.cardId === 'dino-piranha')!
    const rest = me.deck.filter((c) => ![decoupage.instanceId, dino.instanceId].includes(c.instanceId))
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'galaxies',
        observatoryStars: 4,
        hand: [decoupage],
        deck: [dino, ...rest], // dévoilé immédiatement (c'est un Allié → trouvé)
      }],
    }
    const revealed = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: decoupage.instanceId })
    expect(revealed.pendingCastleTheft?.found.cardId).toBe('dino-piranha')
    // Posé SUR l'Observatoire → il draine une Étoile vers lui-même.
    const placed = applyAction(revealed, { type: 'RESOLVE_CASTLE_THEFT', to: 'observatoire' })
    const dinoOnBoard = placed.players[0].board.observatoire.find((c) => c.cardId === 'dino-piranha')
    expect(dinoOnBoard?.stars).toBe(1)
    expect(placed.players[0].observatoryStars).toBe(3)
  })

  it('Une Étoile portée par un Allié est PERDUE quand l’Allié est défaussé (Vanquish)', () => {
    const base = game()
    const me = base.players[0]
    const dino = { ...me.deck.find((c) => c.cardId === 'dino-piranha')!, stars: 1 }
    const hero: CardInstance = { instanceId: 'h1', cardId: 'luma', name: 'Luma', type: 'hero', strength: 2 }
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        pawnLocation: 'chateau-peach',
        board: { ...me.board, 'chateau-peach': [hero, dino] },
      }],
    }
    const after = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: [dino.instanceId] })
    const discarded = after.players[0].discard.find((c) => c.cardId === 'dino-piranha')
    expect(discarded).toBeDefined()
    expect(discarded?.stars).toBeUndefined() // compteur réinitialisé à la défausse
  })

  it('Bateau : une action ACCORDÉE par un Objet (Galaxie en verre) ne laisse pas de 2ᵉ action', () => {
    const base = game()
    const me = base.players[0]
    const bateau = [...me.deck, ...me.hand].find((c) => c.cardId === 'bateau')!
    const glass = [...me.deck, ...me.hand].find((c) => c.cardId === 'boule-verre')!
    const a = ally('a1')
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        pawnLocation: 'galaxies',
        observatoryStars: 4,
        deck: me.deck.filter((c) => ![bateau.instanceId, glass.instanceId].includes(c.instanceId)),
        hand: me.hand.filter((c) => ![bateau.instanceId, glass.instanceId].includes(c.instanceId)),
        board: { ...me.board, galaxies: [{ ...bateau }], 'chateau-peach': [{ ...glass }, a] },
      }],
    }
    // 1) Bateau : figurine + Bateau vers Château de Peach (1 action dispo).
    const moved = applyAction(s, { type: 'CHARIOT_MOVE', instanceId: bateau.instanceId, to: 'chateau-peach' })
    // 2) On utilise l'action ACCORDÉE par la Galaxie en verre (déplacer a1).
    const acted = applyAction(moved, { type: 'MOVE_CARD', actionId: `granted:${glass.instanceId}`, instanceId: 'a1', to: 'observatoire' })
    expect(acted.players[0].board.observatoire.some((c) => c.instanceId === 'a1')).toBe(true)
    // 3) Plus aucune action disponible : l'action accordée a bien été consommée.
    expect(getAvailableActions(acted)).toHaveLength(0)
  })

  it('Observatoire verrouillé (0 Étoile) : impossible de déplacer un Allié qui y est posé', () => {
    const base = game()
    const me = base.players[0]
    const a = ally('a1')
    // Observatoire à 1 Étoile + un Allié dessus ; on joue épuisement d'énergie
    // depuis le même lieu → l'Observatoire tombe à 0 et se VERROUILLE.
    // Pion au Château de Bowser (qui possède l'action « Déplacer un Objet/Allié »).
    const stellaire = me.deck.find((c) => c.cardId === 'puissance-stellaire')!
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{
        ...me,
        power: 5,
        pawnLocation: 'chateau-bowser',
        observatoryStars: 1,
        hand: [stellaire],
        deck: me.deck.filter((c) => c.instanceId !== stellaire.instanceId),
        board: { ...me.board, observatoire: [a] },
      }],
    }
    const drained = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: stellaire.instanceId, allyInstanceIds: ['a1'] })
    expect(drained.players[0].observatoryStars).toBe(0)
    expect(drained.players[0].lockedLocations).toContain('observatoire')
    // Tenter de déplacer a1 hors de l'Observatoire verrouillé doit échouer.
    expect(() =>
      applyAction(drained, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'a1', to: 'galaxies' }),
    ).toThrow(/verrouillé/)
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
