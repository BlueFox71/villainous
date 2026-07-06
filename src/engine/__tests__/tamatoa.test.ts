import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffects, performVanquish, playTopMauiCard } from '../effects'
import { hasReachedObjective, coveredTopActionIdsAt, isActionAvailable } from '../rules'
import { tamatoa } from '../../data/villains/tamatoa'
import { tamatoaCards } from '../../data/villains/tamatoa.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [{ villain: tamatoa, deckCards: buildDeckInstances(tamatoaCards, 'villain', 'p0:'), fateCards: buildDeckInstances(tamatoaCards, 'fate', 'p0f:') }],
    seed,
  )

// Instances Fatalité authentiques (avec onPlace/effects), indexées par cardId.
const fateById = (() => {
  const m: Record<string, CardInstance> = {}
  for (const c of buildDeckInstances(tamatoaCards, 'fate', 'f:')) m[c.cardId] = c
  return m
})()

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

const LAIR = 'repaire-tamatoa'

describe('Tamatoa — mise en place (3 pioches)', () => {
  it('sépare la pioche Fatalité (15) de la pioche Maui (10)', () => {
    const p = game().players[0]
    expect(p.fateDeck).toHaveLength(15)
    expect(p.fateDeck.every((c) => !c.isMauiCard)).toBe(true)
    expect(p.mauiDeck).toHaveLength(10)
    expect((p.mauiDeck ?? []).every((c) => c.isMauiCard)).toBe(true)
    expect(p.objective.type).toBe('ITEMS_AT_LOCATION')
    expect(hasReachedObjective(game(), 0)).toBe(false)
  })
})

describe('Tamatoa — Crustacé doté du pouvoir de création', () => {
  it('dévoile le Cœur (pending), puis le joueur le pose au Repaire ; Moana s’en empare', () => {
    const base = game()
    const heart = { ...fateById['coeur-de-te-fiti'], instanceId: 'heart' }
    const moana = { ...fateById['moana'], instanceId: 'moana' }
    const filler = [card('fuite', 'effect'), card('escape2', 'effect')]
    const s: GameState = { ...base, activePlayer: 0, phase: 'ACTION', players: [{ ...base.players[0], fateDeck: [heart, ...filler, moana] }] }
    const revealed = resolveEffects(s, [{ type: 'CRUSTACEAN_REVEAL', reveal: 4 }], { actorIndex: 0 })
    // Le Cœur est en attente de placement (choix du lieu).
    expect(revealed.pendingCrustaceanPlace?.items.some((c) => c.cardId === 'coeur-de-te-fiti')).toBe(true)
    const out = applyAction(revealed, { type: 'RESOLVE_CRUSTACEAN_PLACE', to: LAIR })
    const lair = out.players[0].board[LAIR] ?? []
    const h = lair.find((c) => c.cardId === 'coeur-de-te-fiti')
    const mo = lair.find((c) => c.cardId === 'moana')
    expect(h).toBeTruthy()
    expect(mo).toBeTruthy()
    expect(h?.attachedTo).toBe(mo?.instanceId) // Moana détient le Cœur
    expect(out.pendingCrustaceanPlace ?? null).toBeNull()
  })
})

describe('Tamatoa — libération de l’Objet à la défaite du gardien', () => {
  it('vaincre Moana libère le Cœur (non associé) sur son lieu', () => {
    const base = game()
    const moana = card('moana', 'hero', { instanceId: 'moana', strength: 4 })
    const heart = card('coeur-de-te-fiti', 'item', { instanceId: 'heart', attachedTo: 'moana' })
    const ally = card('monstre-arboricole', 'ally', { instanceId: 'ally1', strength: 4 })
    const s: GameState = { ...base, players: [{ ...base.players[0], pawnLocation: LAIR, board: { [LAIR]: [moana, heart, ally] } }] }
    const out = performVanquish(s, 'moana', ['ally1'], false)
    const lair = out.players[0].board[LAIR] ?? []
    expect(lair.some((c) => c.instanceId === 'moana')).toBe(false) // Moana vaincue
    const h = lair.find((c) => c.cardId === 'coeur-de-te-fiti')
    expect(h?.attachedTo).toBeUndefined() // Cœur libéré
  })
})

describe('Tamatoa — objectif', () => {
  it('Hameçon + Cœur (non associés) au Repaire → objectif atteint', () => {
    const base = game()
    const s: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { [LAIR]: [card('hamecon-de-maui', 'item'), card('coeur-de-te-fiti', 'item')] } }],
    }
    expect(hasReachedObjective(s, 0)).toBe(true)
    // Un seul des deux → non atteint.
    const s2: GameState = { ...base, players: [{ ...base.players[0], board: { [LAIR]: [card('hamecon-de-maui', 'item')] } }] }
    expect(hasReachedObjective(s2, 0)).toBe(false)
  })
})

describe('Tamatoa — Tu ressembles à des fruits de mer', () => {
  it('paie le Pouvoir égal à la force et élimine le Héros (libère son Objet)', () => {
    const base = game()
    const maui = card('maui', 'hero', { instanceId: 'maui', strength: 8 })
    const hook = card('hamecon-de-maui', 'item', { instanceId: 'hook', attachedTo: 'maui' })
    const s: GameState = { ...base, players: [{ ...base.players[0], power: 10, pawnLocation: LAIR, board: { [LAIR]: [maui, hook] } }] }
    const out = resolveEffects(s, [{ type: 'DEFEAT_HERO_PAY_STRENGTH' }], { actorIndex: 0, targetHeroId: 'maui' })
    expect(out.players[0].power).toBe(2) // 10 − 8
    const lair = out.players[0].board[LAIR] ?? []
    expect(lair.some((c) => c.instanceId === 'maui')).toBe(false)
    expect(lair.find((c) => c.cardId === 'hamecon-de-maui')?.attachedTo).toBeUndefined()
  })
})

describe('Tamatoa — Quelque chose qui brille', () => {
  it('protège du Vanquish les Héros de son lieu', () => {
    const base = game()
    const hero = card('moana', 'hero', { instanceId: 'h', strength: 1 })
    const shiny = card('quelque-chose-brillant', 'item', { instanceId: 's', shieldsHeroesAtLocation: true, coversActionsLikeHero: true })
    const ally = card('monstre-poisson', 'ally', { instanceId: 'a', strength: 5 })
    const s: GameState = { ...base, players: [{ ...base.players[0], pawnLocation: LAIR, board: { [LAIR]: [hero, shiny, ally] } }] }
    expect(() => performVanquish(s, 'h', ['a'], false)).toThrow(/brille/i)
  })

  it('recouvre la rangée du haut comme un Héros', () => {
    const base = game()
    const shiny = card('quelque-chose-brillant', 'item', { instanceId: 's', coversActionsLikeHero: true })
    const s: GameState = { ...base, players: [{ ...base.players[0], board: { lalotai: [shiny] } }] }
    const covered = coveredTopActionIdsAt(s.players[0], 'lalotai')
    expect(covered.has('gain-power')).toBe(true)
    expect(covered.has('play-card')).toBe(true)
  })

  it('jouée en Fatalité, ouvre le choix du lieu de pose (pas de défausse silencieuse)', () => {
    // 2 Tamatoas : le fataliseur (joueur 1) pose l'Objet sur le royaume de la cible (0).
    const two = createInitialGame(
      [
        { villain: tamatoa, deckCards: buildDeckInstances(tamatoaCards, 'villain', 'p0:'), fateCards: buildDeckInstances(tamatoaCards, 'fate', 'p0f:') },
        { villain: tamatoa, deckCards: buildDeckInstances(tamatoaCards, 'villain', 'p1:'), fateCards: buildDeckInstances(tamatoaCards, 'fate', 'p1f:') },
      ],
      3,
    )
    const shiny = { ...fateById['quelque-chose-brillant'], instanceId: 'shiny' }
    const other = card('fuite', 'effect', { instanceId: 'o' })
    let s: GameState = { ...two, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [shiny, other] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'shiny' })
    // Le choix du lieu s'ouvre (chooser = fataliseur, cible = joueur 0).
    expect(s.pendingFateObjectPlace?.chooserIndex).toBe(1)
    expect(s.pendingFateObjectPlace?.targetIndex).toBe(0)
    expect(s.pendingFateObjectPlace?.card.cardId).toBe('quelque-chose-brillant')
    // La carte n'a PAS été défaussée en douce.
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'quelque-chose-brillant')).toBe(false)
    // On la pose : elle atterrit sur le lieu choisi du royaume de la cible.
    s = applyAction(s, { type: 'RESOLVE_FATE_OBJECT_PLACE', locationId: LAIR })
    expect((s.players[0].board[LAIR] ?? []).some((c) => c.cardId === 'quelque-chose-brillant')).toBe(true)
    expect(s.pendingFateObjectPlace ?? null).toBeNull()
  })
})

describe('Tamatoa — Mini Maui', () => {
  it('réordonne le dessus de la pioche Maui : la carte la plus gênante remonte', () => {
    const base = game()
    const etoile = card('etoile-de-mer-maui', 'effect', { instanceId: 'e', isMauiCard: true })
    const cochon = card('cochon-maui', 'effect', { instanceId: 'c', isMauiCard: true })
    const other = card('poisson-maui', 'effect', { instanceId: 'o', isMauiCard: true })
    const s: GameState = { ...base, players: [{ ...base.players[0], mauiDeck: [etoile, other, cochon] }] }
    const out = resolveEffects(s, [{ type: 'REORDER_MAUI_TOP', count: 3 }], { actorIndex: 0 })
    expect(out.players[0].mauiDeck?.[0].cardId).toBe('cochon-maui')
  })
})

describe('Tamatoa — Pas exactement l’heure de Maui (choix jouer/défausser)', () => {
  const pig = () => ({ ...buildDeckInstances(tamatoaCards, 'fate', 'm:').find((c) => c.cardId === 'cochon-maui')!, instanceId: 'pig' })

  it('dévoile la carte (pending), la garde en tête, puis « défausser » n’applique pas l’effet', () => {
    const base = game()
    const s: GameState = { ...base, activePlayer: 0, phase: 'ACTION', players: [{ ...base.players[0], power: 5, mauiDeck: [pig()], mauiDiscard: [] }] }
    const revealed = resolveEffects(s, [{ type: 'REVEAL_TOP_MAUI_CHOICE' }], { actorIndex: 0 })
    expect(revealed.pendingMauiChoice?.playerIndex).toBe(0)
    expect(revealed.players[0].mauiDeck?.[0].cardId).toBe('cochon-maui')
    const out = applyAction(revealed, { type: 'RESOLVE_MAUI_CHOICE', choice: 'discard' })
    expect(out.players[0].power).toBe(5) // effet NON appliqué
    expect((out.players[0].mauiDiscard ?? []).some((c) => c.cardId === 'cochon-maui')).toBe(true)
    expect(out.pendingMauiChoice ?? null).toBeNull()
  })

  it('« jouer » applique l’effet (Cochon : −3 Pouvoir)', () => {
    const base = game()
    const s: GameState = { ...base, activePlayer: 0, phase: 'ACTION', players: [{ ...base.players[0], power: 5, mauiDeck: [pig()], mauiDiscard: [] }] }
    const revealed = resolveEffects(s, [{ type: 'REVEAL_TOP_MAUI_CHOICE' }], { actorIndex: 0 })
    const out = applyAction(revealed, { type: 'RESOLVE_MAUI_CHOICE', choice: 'play' })
    expect(out.players[0].power).toBe(2) // 5 − 3
    expect((out.players[0].mauiDiscard ?? []).some((c) => c.cardId === 'cochon-maui')).toBe(true)
  })
})

describe('Tamatoa — Piégé', () => {
  it('rend jouables les actions recouvertes par un Héros, mais PAS la Fatalité', () => {
    const base = game()
    const hero = card('moana', 'hero', { strength: 4 })
    // Pion à l'Antre (haut : Déplacer Objet/Allié + Fatalité) ; un Héros recouvre le haut.
    const s: GameState = { ...base, activePlayer: 0, phase: 'ACTION', players: [{ ...base.players[0], pawnLocation: LAIR, board: { [LAIR]: [hero] } }] }
    // Sans rien : les 2 actions du haut sont recouvertes.
    expect(isActionAvailable(s, 'fate')).toBe(false)
    expect(isActionAvailable(s, 'move-item-ally')).toBe(false)
    // Piégé (exceptFate) : Fatalité reste indisponible, l'autre action recouverte non.
    const piege = resolveEffects(s, [{ type: 'USE_COVERED_ACTIONS_THIS_TURN', exceptFate: true }], { actorIndex: 0 })
    expect(isActionAvailable(piege, 'fate')).toBe(false)
    expect(isActionAvailable(piege, 'move-item-ally')).toBe(true)
    // Uncover complet (Bravo, sans exceptFate) : la Fatalité deviendrait jouable.
    const allUncover = resolveEffects(s, [{ type: 'USE_COVERED_ACTIONS_THIS_TURN' }], { actorIndex: 0 })
    expect(isActionAvailable(allUncover, 'fate')).toBe(true)
  })

  it('jouable tant qu’un Héros est dans le royaume (même PAS sur le lieu du pion) ; sinon refus', () => {
    const base = game()
    const piege = { ...buildDeckInstances(tamatoaCards, 'villain', 'pg:').find((c) => c.cardId === 'piege-tamatoa')!, instanceId: 'pg1' }
    const heroElsewhere = card('moana', 'hero', { strength: 4 })
    // Pion aux Falaises ; un Héros à La Cage d'Os (autre lieu).
    const withHero: GameState = {
      ...base,
      activePlayer: 0,
      phase: 'ACTION',
      players: [{ ...base.players[0], power: 3, pawnLocation: 'falaises-impossibles', hand: [piege], board: { 'cage-d-os': [heroElsewhere] } }],
    }
    expect(() => applyAction(withHero, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pg1' })).not.toThrow()
    // Aucun Héros : injouable, message « royaume ».
    const noHero: GameState = { ...withHero, players: [{ ...withHero.players[0], board: {} }] }
    expect(() => applyAction(noHero, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pg1' })).toThrow(/royaume/i)
  })
})

describe('Tamatoa — pioche Maui', () => {
  it('PLAY_TOP_MAUI dévoile et joue la 1ʳᵉ carte Maui (Cochon : −3 Pouvoir, pioche 4)', () => {
    const base = game()
    const pig = { ...buildDeckInstances(tamatoaCards, 'fate', 'm:').find((c) => c.cardId === 'cochon-maui')!, instanceId: 'pig' }
    const s: GameState = { ...base, players: [{ ...base.players[0], power: 5, mauiDeck: [pig], mauiDiscard: [] }] }
    const out = playTopMauiCard(s, 0)
    expect(out.players[0].power).toBe(2) // 5 − 3
    expect((out.players[0].mauiDeck ?? []).length).toBe(0)
    expect((out.players[0].mauiDiscard ?? []).some((c) => c.cardId === 'cochon-maui')).toBe(true)
  })
})
