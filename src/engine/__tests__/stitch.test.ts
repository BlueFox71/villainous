import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { hasReachedObjective, realmRelocateCandidates, coveredTopActionIdsAt } from '../rules'
import { shereKhan } from '../../data/villains/shereKhan'
import { shereKhanCards } from '../../data/villains/shereKhan.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, Location, ObjectiveDef } from '../types'

// --- Lieux synthétiques loc-1..loc-4 (comme Grand Councilwoman) --------------
const A = (id: string, type: Location['actions'][number]['type'], extra = {}) =>
  ({ id, type, label: id, row: 'bottom' as const, ...extra })
const LOCS: Location[] = [
  { id: 'loc-1', name: 'Maison de Lilo', actions: [A('l1-move-item', 'MOVE_ITEM_ALLY'), A('l1-move-hero', 'MOVE_HERO')] },
  { id: 'loc-2', name: 'Restaurant', actions: [A('l2-move-item', 'MOVE_ITEM_ALLY')] },
  { id: 'loc-3', name: 'École de danse', actions: [A('l3-move-item', 'MOVE_ITEM_ALLY')] },
  { id: 'loc-4', name: 'Vaisseau de Gantu', actions: [A('l4-move-item', 'MOVE_ITEM_ALLY')] },
]
const OBJ: ObjectiveDef = { type: 'HERO_CAGED', heroCardId: 'custom-stitch-stitch', itemCardId: 'custom-stitch-cage', locationId: 'loc-4' }

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})
const stitch = (extra: Partial<CardInstance> = {}) =>
  card('custom-stitch-stitch', 'hero', { strength: 5, cannotBeMoved: true, ...extra })
const cage = (extra: Partial<CardInstance> = {}) =>
  card('custom-stitch-cage', 'item', { attach: 'location', cannotBeDiscarded: true, ...extra })

/** État de base avec les 4 lieux custom-stitch, objectif HERO_CAGED, pion sur loc-1. */
function stitchGame(board: Record<string, CardInstance[]> = {}): GameState {
  const base = createInitialGame(
    [
      {
        villain: shereKhan,
        deckCards: buildDeckInstances(shereKhanCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(shereKhanCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
  const p0 = {
    ...base.players[0],
    locations: LOCS,
    board,
    objective: OBJ,
    pawnLocation: 'loc-1',
    deck: [],
    discard: [],
    fateDeck: [],
    fateDiscard: [],
    power: 10,
    lockedLocations: [],
  }
  return { ...base, players: [p0], phase: 'ACTION', usedActionIds: [] }
}

describe('Grand Councilwoman — objectif HERO_CAGED', () => {
  it('victoire : STITCH associé à la CAGE, au Vaisseau de Gantu (loc-4)', () => {
    const c = cage()
    const s = stitch({ attachedTo: c.instanceId })
    const g = stitchGame({ 'loc-4': [c, s] })
    expect(hasReachedObjective(g, 0)).toBe(true)
  })
  it('pas de victoire si STITCH n’est pas associé à la CAGE', () => {
    const c = cage()
    const s = stitch() // non associé
    const g = stitchGame({ 'loc-4': [c, s] })
    expect(hasReachedObjective(g, 0)).toBe(false)
  })
  it('pas de victoire si la CAGE (avec STITCH) n’est pas au Vaisseau de Gantu', () => {
    const c = cage()
    const s = stitch({ attachedTo: c.instanceId })
    const g = stitchGame({ 'loc-1': [c, s] })
    expect(hasReachedObjective(g, 0)).toBe(false)
  })
})

describe('Grand Councilwoman — ENFERMÉ (ATTACH_HERO_TO_ITEM)', () => {
  it('associe STITCH à la CAGE quand ils sont sur le même lieu', () => {
    const c = cage()
    const s = stitch()
    const g = stitchGame({ 'loc-1': [c, s] })
    const out = resolveEffect(g, { type: 'ATTACH_HERO_TO_ITEM', heroCardId: 'custom-stitch-stitch', itemCardId: 'custom-stitch-cage' }, { actorIndex: 0 })
    const sAfter = out.players[0].board['loc-1'].find((x) => x.cardId === 'custom-stitch-stitch')!
    expect(sAfter.attachedTo).toBe(c.instanceId)
  })
  it('sans effet si STITCH et la CAGE ne sont pas co-localisés', () => {
    const c = cage()
    const s = stitch()
    const g = stitchGame({ 'loc-1': [s], 'loc-4': [c] })
    const out = resolveEffect(g, { type: 'ATTACH_HERO_TO_ITEM', heroCardId: 'custom-stitch-stitch', itemCardId: 'custom-stitch-cage' }, { actorIndex: 0 })
    const sAfter = out.players[0].board['loc-1'].find((x) => x.cardId === 'custom-stitch-stitch')!
    expect(sAfter.attachedTo).toBeUndefined()
  })
})

describe('Grand Councilwoman — STITCH immobile et transporté par la CAGE', () => {
  it('STITCH est exclu des candidats de relocalisation de Héros', () => {
    const s = stitch()
    const other = card('autre-heros', 'hero', { strength: 2 })
    const g = stitchGame({ 'loc-1': [s, other] })
    const cands = realmRelocateCandidates(g.players[0], 99, 'loc-2')
    expect(cands.map((c) => c.cardId)).toContain('autre-heros')
    expect(cands.map((c) => c.cardId)).not.toContain('custom-stitch-stitch')
  })
  it('STITCH enfermé (attaché à la CAGE) ne recouvre plus les actions du haut', () => {
    const c = cage()
    const s = stitch({ attachedTo: c.instanceId })
    const g = stitchGame({ 'loc-4': [c, s] })
    // loc-4 (Vaisseau de Gantu) n'a que des actions du bas ici : ajoutons une action du haut.
    const p0 = { ...g.players[0], locations: g.players[0].locations.map((l) => (l.id === 'loc-4' ? { ...l, actions: [{ id: 'l4-top', type: 'GAIN_POWER' as const, label: 'haut', row: 'top' as const, amount: 1 }, ...l.actions] } : l)) }
    const g2 = { ...g, players: [p0] }
    expect(coveredTopActionIdsAt(g2.players[0], 'loc-4').has('l4-top')).toBe(false)
    // Un Héros NON enfermé, lui, recouvrirait bien l'action du haut.
    const free = stitch({ attachedTo: undefined })
    const g3 = { ...g2, players: [{ ...g2.players[0], board: { 'loc-4': [c, free] } }] }
    expect(coveredTopActionIdsAt(g3.players[0], 'loc-4').has('l4-top')).toBe(true)
  })
  it('déplacer la CAGE emmène STITCH (enfermé) avec elle', () => {
    const c = cage()
    const s = stitch({ attachedTo: c.instanceId })
    const g = stitchGame({ 'loc-1': [c, s] })
    const out = applyAction(g, { type: 'MOVE_CARD', actionId: 'l1-move-item', instanceId: c.instanceId, to: 'loc-2' })
    expect(out.players[0].board['loc-1'] ?? []).toHaveLength(0)
    const dest = out.players[0].board['loc-2']
    expect(dest.map((x) => x.cardId).sort()).toEqual(['custom-stitch-cage', 'custom-stitch-stitch'])
  })
})

describe('Grand Councilwoman — STITCH EN VUE / ATTRAPÉ (REVEAL_FATE_UNTIL_HERO_CHOICE)', () => {
  it('STITCH révélé est posé d’office à la Maison de Lilo (forcedFateLocation)', () => {
    const g0 = stitchGame({})
    const filler = card('filler', 'item')
    const stitchInDeck = stitch({ forcedFateLocation: 'loc-1' })
    const g: GameState = { ...g0, players: [{ ...g0.players[0], fateDeck: [filler, stitchInDeck] }] }
    const out = resolveEffect(g, { type: 'REVEAL_FATE_UNTIL_HERO_CHOICE', mustPlay: true }, { actorIndex: 0 })
    expect(out.pendingFetchedHero ?? null).toBeNull() // posé d'office, pas de choix
    expect(out.players[0].board['loc-1'].some((x) => x.cardId === 'custom-stitch-stitch')).toBe(true)
    expect(out.players[0].fateDiscard.some((x) => x.cardId === 'filler')).toBe(true)
  })
  it('un Héros SANS lieu imposé ouvre le choix (pendingFetchedHero) avec mustPlay', () => {
    const g0 = stitchGame({})
    const hero = card('lilo', 'hero', { strength: 4 })
    const g: GameState = { ...g0, players: [{ ...g0.players[0], fateDeck: [hero] }] }
    const out = resolveEffect(g, { type: 'REVEAL_FATE_UNTIL_HERO_CHOICE', mustPlay: true }, { actorIndex: 0 })
    expect(out.pendingFetchedHero?.hero.cardId).toBe('lilo')
    expect(out.pendingFetchedHero?.mustPlay).toBe(true)
  })
})

describe('Grand Councilwoman — RAPPORT (REVEAL_UNTIL_TYPE_PLAY_FREE) + pose gratuite', () => {
  it('dévoile un Objet → pendingFreePlayCard, puis pose au lieu choisi', () => {
    const g0 = stitchGame({})
    const evt = card('un-evenement', 'effect')
    const item = card('custom-stitch-bras-robots', 'item', { attach: 'location' })
    const g: GameState = { ...g0, players: [{ ...g0.players[0], deck: [evt, item] }] }
    const revealed = resolveEffect(g, { type: 'REVEAL_UNTIL_TYPE_PLAY_FREE', cardType: 'item' }, { actorIndex: 0 })
    expect(revealed.pendingFreePlayCard?.card.cardId).toBe('custom-stitch-bras-robots')
    expect(revealed.players[0].discard.some((x) => x.cardId === 'un-evenement')).toBe(true)
    const placed = applyAction(revealed, { type: 'RESOLVE_FREE_PLAY_CARD', targetId: 'loc-2' })
    expect(placed.pendingFreePlayCard ?? null).toBeNull()
    expect(placed.players[0].board['loc-2'].some((x) => x.cardId === 'custom-stitch-bras-robots')).toBe(true)
  })
})

describe('Grand Councilwoman — CAPITAINE GANTU (PLAY_FROM_DISCARD_FREE)', () => {
  it('choisit une carte de la défausse → pose gratuite', () => {
    const g0 = stitchGame({})
    const disc = card('custom-stitch-piqure', 'item', { attach: 'location' })
    const g: GameState = { ...g0, players: [{ ...g0.players[0], discard: [disc] }] }
    const opened = resolveEffect(g, { type: 'PLAY_FROM_DISCARD_FREE' }, { actorIndex: 0 })
    expect(opened.pendingPickDiscardToPlay?.candidateIds).toContain(disc.instanceId)
    const picked = applyAction(opened, { type: 'RESOLVE_PICK_DISCARD_TO_PLAY', instanceId: disc.instanceId })
    expect(picked.pendingFreePlayCard?.card.cardId).toBe('custom-stitch-piqure')
    const placed = applyAction(picked, { type: 'RESOLVE_FREE_PLAY_CARD', targetId: 'loc-3' })
    expect(placed.players[0].board['loc-3'].some((x) => x.cardId === 'custom-stitch-piqure')).toBe(true)
  })
  it('annuler la pose gratuite renvoie la carte en défausse (jamais bloqué)', () => {
    const g0 = stitchGame({})
    const item = card('custom-stitch-bras-robots', 'item', { attach: 'location' })
    const g: GameState = { ...g0, players: [{ ...g0.players[0], pendingFreePlayCard: undefined }] }
    const opened = { ...g, pendingFreePlayCard: { playerIndex: 0, card: item, label: 'Rapport !' } }
    const cancelled = applyAction(opened, { type: 'RESOLVE_FREE_PLAY_CARD', cancel: true })
    expect(cancelled.pendingFreePlayCard ?? null).toBeNull()
    expect(cancelled.players[0].discard.some((x) => x.cardId === 'custom-stitch-bras-robots')).toBe(true)
  })
})

describe('Grand Councilwoman — EN LIBERTÉ (FREE_HERO_OR_RELOCATE)', () => {
  it('libère STITCH de la CAGE s’il est enfermé', () => {
    const c = cage()
    const s = stitch({ attachedTo: c.instanceId })
    const g = stitchGame({ 'loc-4': [c, s] })
    const out = resolveEffect(g, { type: 'FREE_HERO_OR_RELOCATE', heroCardId: 'custom-stitch-stitch' }, { actorIndex: 0 })
    const sAfter = out.players[0].board['loc-4'].find((x) => x.cardId === 'custom-stitch-stitch')!
    expect(sAfter.attachedTo).toBeUndefined()
  })
})

describe('Grand Councilwoman — ALOHA (TRANSFORM_ALLY_OR_RELOCATE)', () => {
  it('transforme Dr Jumba en Héros', () => {
    const jumba = card('custom-stitch-dr-jumba-jookiba', 'ally', { strength: 3 })
    const g = stitchGame({ 'loc-2': [jumba] })
    const out = resolveEffect(g, { type: 'TRANSFORM_ALLY_OR_RELOCATE', allyCardIds: ['custom-stitch-dr-jumba-jookiba', 'custom-stitch-peakley'] }, { actorIndex: 0 })
    const j = out.players[0].board['loc-2'].find((x) => x.cardId === 'custom-stitch-dr-jumba-jookiba')!
    expect(j.type).toBe('hero')
  })
})

describe('Grand Councilwoman — relocalisation de Héros par une Fatalité (acteur ≠ joueur actif)', () => {
  // Reproduit le bug : EN LIBERTÉ / ALOHA jouées PAR l'adversaire (actif) contre GC (cible).
  // L'adjacence doit se calculer dans les lieux de la CIBLE, pas du joueur actif.
  it('ALOHA (option déplacer) déplace un Héros de la cible même si l’acteur n’est pas actif', () => {
    const base = createInitialGame(
      [
        { villain: shereKhan, deckCards: buildDeckInstances(shereKhanCards, 'villain', 'p0:'), fateCards: buildDeckInstances(shereKhanCards, 'fate', 'p0f:') },
        { villain: shereKhan, deckCards: buildDeckInstances(shereKhanCards, 'villain', 'p1:'), fateCards: buildDeckInstances(shereKhanCards, 'fate', 'p1f:') },
      ],
      7,
    )
    // Joueur 1 = Grand Councilwoman (lieux loc-1..loc-4) ; joueur 0 = adversaire ACTIF.
    const gc = { ...base.players[1], locations: LOCS, board: { 'loc-1': [card('cobra', 'hero', { strength: 3 })] }, objective: OBJ }
    const g: GameState = { ...base, activePlayer: 0, players: [base.players[0], gc] }
    // Aucun Dr Jumba/Peakley à transformer → branche « déplacer un Héros voisin ».
    const out = resolveEffect(g, { type: 'TRANSFORM_ALLY_OR_RELOCATE', allyCardIds: ['custom-stitch-dr-jumba-jookiba', 'custom-stitch-peakley'] }, { actorIndex: 1 })
    // Le Héros (Cobra) doit avoir été déplacé de loc-1 vers loc-2 (voisin DANS les lieux de GC).
    expect(out.players[1].board['loc-1'] ?? []).toHaveLength(0)
    expect((out.players[1].board['loc-2'] ?? []).some((c) => c.cardId === 'cobra')).toBe(true)
  })
})

describe('Grand Councilwoman — TUEZ-LE (INSTANT_VANQUISH_HERO_LE, force EFFECTIVE)', () => {
  it('un Héros de base 3 boosté à 5 (Boule de Feu) n’est PAS vaincu par « force ≤ 3 »', () => {
    const h = card('lilo', 'hero', { strength: 3 })
    const boule = card('custom-stitch-boule-de-feu', 'item', { attach: 'hero', attachStrengthBonus: 2, attachedTo: h.instanceId })
    const g = stitchGame({ 'loc-1': [h, boule] })
    expect(() =>
      resolveEffect(g, { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }, { actorIndex: 0, targetHeroId: h.instanceId }),
    ).toThrow()
  })
  it('un Héros de force effective 3 (non boosté) est bien vaincu', () => {
    const h = card('lilo', 'hero', { strength: 3 })
    const g = stitchGame({ 'loc-1': [h] })
    const out = resolveEffect(g, { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }, { actorIndex: 0, targetHeroId: h.instanceId })
    expect((out.players[0].board['loc-1'] ?? []).some((c) => c.instanceId === h.instanceId)).toBe(false)
  })
})

describe('Grand Councilwoman — BOUTEILLE MORDUE (FATE_DISCARD_OR_MOVE_ITEM)', () => {
  it('la CAGE indéfaussable est DÉPLACÉE, jamais défaussée', () => {
    const c = cage()
    const g = stitchGame({ 'loc-1': [c] })
    const out = resolveEffect(g, { type: 'FATE_DISCARD_OR_MOVE_ITEM' }, { actorIndex: 0 })
    expect(out.players[0].discard.some((x) => x.cardId === 'custom-stitch-cage')).toBe(false)
    // La CAGE a bougé vers un lieu voisin (loc-2).
    expect(out.players[0].board['loc-2'].some((x) => x.cardId === 'custom-stitch-cage')).toBe(true)
  })
  it('défausse un Objet ordinaire plutôt que la CAGE', () => {
    const c = cage()
    const item = card('custom-stitch-piqure', 'item', { attach: 'location', cost: 2 })
    const g = stitchGame({ 'loc-1': [c, item] })
    const out = resolveEffect(g, { type: 'FATE_DISCARD_OR_MOVE_ITEM' }, { actorIndex: 0 })
    expect(out.players[0].discard.some((x) => x.cardId === 'custom-stitch-piqure')).toBe(true)
    expect(out.players[0].discard.some((x) => x.cardId === 'custom-stitch-cage')).toBe(false)
  })
})
