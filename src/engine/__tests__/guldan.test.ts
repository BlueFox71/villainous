import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffects } from '../effects'
import { darkPortalReady, guldanCorruptedCount, effectiveCost } from '../rules'
import { toVillainDef, toCardDefs } from '../../data/customVillain'
import { patchCustomGuldan } from '../../data/villains/customGuldan'
import { objectiveScore } from '../../ai/heuristicBot'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'
import type { CustomVillain } from '../../data/customVillain'

// Charge l'export de l'Atelier, puis SIMULE la version « brute » (visuel seul, sans
// effets — comme le brouillon de l'auteur), et applique le patch de comportement
// EXACTEMENT comme le fait le jeu (registerPublishedVillain / ▶ Tester).
const exported = JSON.parse(readFileSync('assets/custom-exports/custom-gul-dan.json', 'utf8')) as CustomVillain
const raw: CustomVillain = {
  ...exported,
  objective: { type: 'POWER_THRESHOLD', threshold: 20 },
  cards: exported.cards.map((c) => {
    const bare = { ...c }
    delete bare.effects
    delete bare.isArtifact
    delete bare.staysOnLocationOnPlay
    delete bare.strengthMod
    delete bare.attachStrengthBonus
    delete bare.mustDefeatFirst
    delete bare.increasesArtifactCost
    delete bare.blocksCardIds
    return bare
  }),
}
const guldan = patchCustomGuldan(raw)
const def = toVillainDef(guldan)
const cardDefs = toCardDefs(guldan)

function game(seed = 7): GameState {
  return createInitialGame(
    [{ villain: def, deckCards: buildDeckInstances(cardDefs, 'villain', 'p0:'), fateCards: buildDeckInstances(cardDefs, 'fate', 'p0f:') }],
    seed,
  )
}
const me = (s: GameState) => s.players[0]
const setBoard = (s: GameState, locId: string, cards: CardInstance[]): GameState => ({
  ...s,
  players: [{ ...s.players[0], board: { ...s.players[0].board, [locId]: cards } }],
})
const lastLocId = (s: GameState) => me(s).locations[me(s).locations.length - 1].id

describe('Gul\'dan — intégrité & mécaniques', () => {
  it('le deck se construit (4 lieux, objectif hors d\'atteinte par le Pouvoir, pile Artéfacts vide 0/4)', () => {
    const s = game()
    expect(me(s).locations.length).toBe(4)
    expect(me(s).objective).toEqual({ type: 'POWER_THRESHOLD', threshold: 999 })
    expect(me(s).artifacts).toEqual([]) // pile affichée dès le départ (0/4)
  })

  it('jauge d\'objectif : SUIT la progression (Artéfacts + lieux corrompus), pas le Pouvoir', () => {
    const s = game()
    // Départ : ~0 (rien de fait) — et surtout PAS bloqué à 0 par le seuil 999.
    expect(objectiveScore(me(s))).toBeCloseTo(0, 5)
    // Du Pouvoir seul ne fait PAS bouger la jauge (victoire par la Porte, pas le Pouvoir).
    const withPower = { ...me(s), power: 50 }
    expect(objectiveScore(withPower)).toBeCloseTo(0, 5)
    // 2 Artéfacts + 2 lieux corrompus → progression à mi-chemin (~0.45).
    const artifact = (i: number): CardInstance => ({ instanceId: `a${i}`, cardId: `c${i}`, name: `A${i}`, type: 'effect', isArtifact: true })
    const half = {
      ...me(s),
      artifacts: [artifact(1), artifact(2)],
      locations: me(s).locations.map((l, i) => (i < 2 ? { ...l, version: 'b' as const } : l)),
    }
    expect(objectiveScore(half)).toBeCloseTo(0.45, 2)
    // 4 Artéfacts + 4 lieux corrompus + pion sur la Porte + OUVERTURE en main → quasi 1 (jamais 1 avant victoire).
    const ouverture: CardInstance = { instanceId: 'ouv', cardId: 'custom-gul-dan-ouverture-de-la-porte-des-tenebres', name: 'Ouverture', type: 'effect', effects: [{ type: 'DARK_PORTAL_WIN' }] }
    const portal = lastLocId(s)
    const near = {
      ...me(s),
      artifacts: [artifact(1), artifact(2), artifact(3), artifact(4)],
      locations: me(s).locations.map((l) => ({ ...l, version: 'b' as const })),
      pawnLocation: portal,
      hand: [ouverture],
    }
    expect(objectiveScore(near)).toBeGreaterThan(0.95)
    expect(objectiveScore(near)).toBeLessThan(1)
  })

  it('jouer un Artéfact le met dans la pile Artéfacts (pas en défausse)', () => {
    let s = game()
    // Lieu doté d'une action « Jouer une carte » libre (aucun Héros dessus au départ).
    const playLocObj = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLocObj.actions.find((a) => a.type === 'PLAY_CARD')!
    const livre = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-livre-de-medivh')!
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 5, pawnLocation: playLocObj.id, hand: [livre] }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: livre.instanceId, to: playLocObj.id })
    expect((me(s).artifacts ?? []).some((c) => c.cardId === 'custom-gul-dan-livre-de-medivh')).toBe(true)
    expect(me(s).discard.some((c) => c.cardId === 'custom-gul-dan-livre-de-medivh')).toBe(false)
  })

  it('Sceptre de Sargeras : jouable SANS Héros (gain 0) → rejoint quand même la pile', () => {
    let s = game()
    const playLocObj = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLocObj.actions.find((a) => a.type === 'PLAY_CARD')!
    const sceptre = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-sceptre-de-sargeras')!
    // Royaume SANS aucun Héros.
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 3, pawnLocation: playLocObj.id, hand: [sceptre] }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: sceptre.instanceId, to: playLocObj.id })
    expect((me(s).artifacts ?? []).some((c) => c.cardId === 'custom-gul-dan-sceptre-de-sargeras')).toBe(true)
    expect(me(s).power).toBe(3) // coût 0, aucun Héros → +0 Pouvoir
  })

  it('Sceptre de Sargeras : +1 Pouvoir par Héros sur le lieu du pion', () => {
    let s = game()
    const pawn = me(s).pawnLocation!
    s = setBoard(s, pawn, [
      { instanceId: 'h1', cardId: 'x', name: 'H1', type: 'hero', strength: 3 },
      { instanceId: 'h2', cardId: 'y', name: 'H2', type: 'hero', strength: 2 },
    ])
    const p0 = me(s).power
    s = resolveEffects(s, [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1, atPawn: true }], { actorIndex: 0 })
    expect(me(s).power).toBe(p0 + 2)
  })

  it('L\'Œil de Dalaran : +1 par Objet/Événement en défausse, plafond 6', () => {
    let s = game()
    const disc: CardInstance[] = Array.from({ length: 8 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'c', name: 'c', type: i % 2 ? 'item' : 'effect' }))
    s = { ...s, players: [{ ...me(s), discard: disc, power: 0 }] }
    s = resolveEffects(s, [{ type: 'GAIN_POWER_PER_TYPE_IN_DISCARD', cardType: 'item', cardTypes: ['item', 'effect'], amount: 1, cap: 6 }], { actorIndex: 0 })
    expect(me(s).power).toBe(6) // 8 cartes, plafonné à 6
  })

  it('Corruption : le lieu joué passe en face B (compté comme corrompu)', () => {
    let s = game()
    const pawn = me(s).pawnLocation!
    expect(guldanCorruptedCount(me(s))).toBe(0)
    s = resolveEffects(s, [{ type: 'SWITCH_LOCATION_VERSION', to: 'b', atPlayedLocation: true }], { actorIndex: 0, playDestination: pawn })
    expect(me(s).locations.find((l) => l.id === pawn)!.version).toBe('b')
    expect(guldanCorruptedCount(me(s))).toBe(1)
  })

  it('la Porte des Ténèbres démarre VERROUILLÉE', () => {
    const s = game()
    const portal = lastLocId(s)
    expect((me(s).lockedLocations ?? []).includes(portal)).toBe(true)
  })

  it('Corruption : reste posée sur le lieu ; 3 lieux corrompus déverrouillent la Porte', () => {
    let s = game()
    const portal = lastLocId(s)
    const nonPortal = me(s).locations.filter((l) => l.id !== portal).map((l) => l.id)
    const corruptions = buildDeckInstances(cardDefs, 'villain', 'p0:').filter((c) => c.cardId === 'custom-gul-dan-corruption')
    // Joue une Corruption sur chacun des 3 lieux hors Porte.
    for (let i = 0; i < 3; i++) {
      const loc = nonPortal[i]
      const playAction = me(s).locations.find((l) => l.id === loc)!.actions.find((a) => a.type === 'PLAY_CARD')
      if (!playAction) throw new Error(`pas d'action Jouer une carte sur ${loc}`)
      const card = corruptions[i]
      s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 9, pawnLocation: loc, hand: [card] }] }
      s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: card.instanceId, to: loc })
      // La Corruption reste posée sur le lieu (pas en défausse).
      expect((me(s).board[loc] ?? []).some((c) => c.cardId === 'custom-gul-dan-corruption')).toBe(true)
      expect(me(s).locations.find((l) => l.id === loc)!.version).toBe('b')
    }
    expect(guldanCorruptedCount(me(s))).toBe(3)
    // La Porte des Ténèbres est désormais déverrouillée.
    expect((me(s).lockedLocations ?? []).includes(portal)).toBe(false)
  })

  it('Corruption : choix LIBRE du lieu (pas forcément celui du pion)', () => {
    let s = game()
    const [locA, locB] = me(s).locations.map((l) => l.id) // loc-1, loc-2
    const playAction = me(s).locations.find((l) => l.id === locA)!.actions.find((a) => a.type === 'PLAY_CARD')!
    const corruption = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-corruption')!
    // Pion sur locA, mais on CHOISIT de corrompre locB.
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 9, pawnLocation: locA, hand: [corruption] }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: corruption.instanceId, to: locB })
    expect(me(s).locations.find((l) => l.id === locB)!.version).toBe('b') // le lieu CHOISI
    expect(me(s).locations.find((l) => l.id === locA)!.version).not.toBe('b') // pas celui du pion
    expect((me(s).board[locB] ?? []).some((c) => c.cardId === 'custom-gul-dan-corruption')).toBe(true)
  })

  it('Corruption : interdit sur un lieu déjà corrompu', () => {
    let s = game()
    const loc = me(s).locations[0].id
    const playAction = me(s).locations.find((l) => l.id === loc)!.actions.find((a) => a.type === 'PLAY_CARD')!
    const [c1, c2] = buildDeckInstances(cardDefs, 'villain', 'p0:').filter((c) => c.cardId === 'custom-gul-dan-corruption')
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 9, pawnLocation: loc, hand: [c1] }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: c1.instanceId, to: loc })
    expect(me(s).locations.find((l) => l.id === loc)!.version).toBe('b')
    // Rejouer une Corruption sur ce même lieu (déjà corrompu) → refusé.
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), hand: [c2] }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: c2.instanceId, to: loc })).toThrow(/corrompu/i)
  })

  it('Porte des Ténèbres : victoire seulement avec les 3 conditions réunies', () => {
    let s = game()
    const portal = lastLocId(s)
    // Aucune condition : pas prêt.
    expect(darkPortalReady(s, 0)).toBe(false)
    // Toutes les conditions : pion sur la Porte, 4 lieux corrompus, 4 Artéfacts joués.
    s = {
      ...s,
      players: [{
        ...me(s),
        pawnLocation: portal,
        artifacts: [
          { instanceId: 'a1', cardId: 'custom-gul-dan-livre-de-medivh', name: 'Livre', type: 'effect', isArtifact: true },
          { instanceId: 'a2', cardId: 'custom-gul-dan-l-il-de-dalaran', name: 'Œil', type: 'effect', isArtifact: true },
          { instanceId: 'a3', cardId: 'custom-gul-dan-sceptre-de-sargeras', name: 'Sceptre', type: 'effect', isArtifact: true },
          { instanceId: 'a4', cardId: 'custom-gul-dan-crane-de-gul-dan', name: 'Crâne', type: 'effect', isArtifact: true },
        ],
        locations: me(s).locations.map((l) => ({ ...l, version: 'b' as const })),
      }],
    }
    expect(darkPortalReady(s, 0)).toBe(true)
    const won = resolveEffects(s, [{ type: 'DARK_PORTAL_WIN' }], { actorIndex: 0 })
    expect(won.status).toBe('WON')
    expect(won.winner).toBe(0)
  })

  it('Membres du Conseil des Ombres : capacité ACTIVÉE (payer 1) → cherche Trait du Chaos', () => {
    let s = game()
    const activateLoc = me(s).locations.find((l) => l.actions.some((a) => a.type === 'ACTIVATE'))!
    const activateAction = activateLoc.actions.find((a) => a.type === 'ACTIVATE')!
    const conseil = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-membres-du-conseil-des-ombres')!
    const trait = buildDeckInstances(cardDefs, 'villain', 'p1:').find((c) => c.cardId === 'custom-gul-dan-trait-du-chaos')!
    // Le Conseil doit être une capacité activée (pas un effet à la pose).
    expect(conseil.activatedCost).toBe(1)
    expect(conseil.effects ?? []).toHaveLength(0)
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 3, pawnLocation: activateLoc.id, deck: [trait], board: { ...me(s).board, [activateLoc.id]: [conseil] } }] }
    s = applyAction(s, { type: 'ACTIVATE', actionId: activateAction.id, cardInstanceId: conseil.instanceId })
    expect(me(s).hand.some((c) => c.cardId === 'custom-gul-dan-trait-du-chaos')).toBe(true) // Trait cherché
    expect(me(s).power).toBe(2) // −1 Pouvoir
  })

  // Prépare l'activation de Magie Gangrené avec 2 cartes (t1, t2) au sommet de la pioche.
  const activateMagie = (): GameState => {
    let s = game()
    const activateLoc = me(s).locations.find((l) => l.actions.some((a) => a.type === 'ACTIVATE'))!
    const activateAction = activateLoc.actions.find((a) => a.type === 'ACTIVATE')!
    const magie = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-magie-gangrene')!
    const top: CardInstance[] = [
      { instanceId: 't1', cardId: 'custom-gul-dan-connexion', name: 'Connexion', type: 'effect' },
      { instanceId: 't2', cardId: 'custom-gul-dan-drain-d-ame', name: 'Drain', type: 'effect' },
    ]
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 3, pawnLocation: activateLoc.id, deck: top, discard: [], hand: [], board: { ...me(s).board, [activateLoc.id]: [magie] } }] }
    return applyAction(s, { type: 'ACTIVATE', actionId: activateAction.id, cardInstanceId: magie.instanceId })
  }

  it('Magie Gangrené : capacité ACTIVÉE gratuite → pioche 2, garde JUSQU\'À 2 (choix interactif)', () => {
    const magie = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-magie-gangrene')!
    // Doit être une capacité activée (gratuite), pas un effet à la pose.
    expect(magie.activatedCost).toBe(0)
    expect(magie.effects ?? []).toHaveLength(0)
    const s = activateMagie()
    expect(s.pendingLookTop).toBeDefined()
    expect(s.pendingLookTop!.cards).toHaveLength(2)
    expect(s.pendingLookTop!.take).toBe(2) // borne haute : on peut en garder 0, 1 ou 2
    expect(me(s).power).toBe(3) // gratuite
  })

  it('Magie Gangrené : garde 1 des 2 (l\'autre en défausse)', () => {
    let s = activateMagie()
    s = applyAction(s, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['t1'] })
    expect(me(s).hand.map((c) => c.instanceId)).toEqual(['t1'])
    expect(me(s).discard.map((c) => c.instanceId)).toEqual(['t2'])
  })

  it('Magie Gangrené : GARDE LES 2 (rien en défausse)', () => {
    let s = activateMagie()
    s = applyAction(s, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['t1', 't2'] })
    expect(me(s).hand.map((c) => c.instanceId).sort()).toEqual(['t1', 't2'])
    expect(me(s).discard).toHaveLength(0)
  })

  it('Magie Gangrené : DÉFAUSSE LES 2 (main vide)', () => {
    let s = activateMagie()
    s = applyAction(s, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [] })
    expect(me(s).hand).toHaveLength(0)
    expect(me(s).discard.map((c) => c.instanceId).sort()).toEqual(['t1', 't2'])
  })

  it('Crâne de Gul\'dan : JOUABLE défausse vide (rejoint la pile) ; récupère un Objet/Événement sinon', () => {
    let s = game()
    const playLocObj = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLocObj.actions.find((a) => a.type === 'PLAY_CARD')!
    const vil = buildDeckInstances(cardDefs, 'villain', 'p0:')
    const crane = vil.find((c) => c.cardId === 'custom-gul-dan-crane-de-gul-dan')!
    // Effet : récupère un Objet OU Événement de la défausse.
    expect(crane.effects).toEqual([{ type: 'RECOVER_TYPE_FROM_DISCARD', types: ['item', 'effect'], label: "Crâne de Gul'dan" }])
    // (a) Défausse VIDE : jouable quand même → rejoint la pile Artéfacts, aucun pending.
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, pawnLocation: playLocObj.id, hand: [crane], discard: [] }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: crane.instanceId, to: playLocObj.id })
    expect((me(s).artifacts ?? []).some((c) => c.cardId === 'custom-gul-dan-crane-de-gul-dan')).toBe(true)
    expect(s.pendingRecover ?? null).toBeNull()
    // (b) Avec un Objet/Événement en défausse : ouvre le choix de récupération.
    const item: CardInstance = { instanceId: 'itm', cardId: 'x', name: 'Objet', type: 'item' }
    const s2 = resolveEffects({ ...game(), players: [{ ...me(game()), discard: [item] }] }, crane.effects!, { actorIndex: 0 })
    expect(s2.pendingRecover?.candidateIds).toEqual(['itm'])
  })

  it('Manipulation : reproduit GRATUITEMENT la capacité d\'un Artéfact (1 candidat → direct)', () => {
    let s = game()
    const pawn = me(s).pawnLocation!
    // Un seul Artéfact dans la pile, avec un effet observable (+1 Pouvoir par Héros au pion).
    const sceptre: CardInstance = {
      instanceId: 'art-sceptre', cardId: 'custom-gul-dan-sceptre-de-sargeras', name: 'Sceptre', type: 'effect',
      isArtifact: true, effects: [{ type: 'GAIN_POWER_PER_HERO_IN_REALM', amount: 1, atPawn: true }],
    }
    s = setBoard(s, pawn, [
      { instanceId: 'h1', cardId: 'x', name: 'H1', type: 'hero', strength: 3 },
      { instanceId: 'h2', cardId: 'y', name: 'H2', type: 'hero', strength: 2 },
    ])
    s = { ...s, players: [{ ...me(s), power: 5, artifacts: [sceptre] }] }
    const p0 = me(s).power
    s = resolveEffects(s, [{ type: 'DUPLICATE_INGREDIENT', zone: 'artifacts', freeDuplication: true }], { actorIndex: 0 })
    expect(s.pendingDuplicateIngredient ?? null).toBeNull() // 1 candidat → reproduction directe
    expect(me(s).power).toBe(p0 + 2) // +2 (2 Héros) ; reproduction GRATUITE (aucun coût prélevé)
  })

  it('Manipulation : plusieurs Artéfacts → choix interactif (pendingDuplicateIngredient zone artifacts)', () => {
    let s = game()
    const a1: CardInstance = { instanceId: 'a1', cardId: 'custom-gul-dan-sceptre-de-sargeras', name: 'Sceptre', type: 'effect', isArtifact: true, effects: [{ type: 'GAIN_POWER', amount: 1 }] }
    const a2: CardInstance = { instanceId: 'a2', cardId: 'custom-gul-dan-livre-de-medivh', name: 'Livre', type: 'effect', isArtifact: true, effects: [{ type: 'GAIN_POWER', amount: 3 }] }
    s = { ...s, players: [{ ...me(s), power: 0, artifacts: [a1, a2] }] }
    s = resolveEffects(s, [{ type: 'DUPLICATE_INGREDIENT', zone: 'artifacts', freeDuplication: true }], { actorIndex: 0 })
    expect(s.pendingDuplicateIngredient?.zone).toBe('artifacts')
    expect(s.pendingDuplicateIngredient?.candidateIds).toEqual(['a1', 'a2'])
    // Choisit le Livre (+3) : reproduction gratuite.
    const after = applyAction(s, { type: 'RESOLVE_DUPLICATE_INGREDIENT', ingredientInstanceId: 'a2' })
    expect(after.pendingDuplicateIngredient ?? null).toBeNull()
    expect(me(after).power).toBe(3)
  })

  it('Manipulation : injouable sans Artéfact joué (rien à reproduire)', () => {
    let s = game()
    const playLocObj = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLocObj.actions.find((a) => a.type === 'PLAY_CARD')!
    const manip = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-manipulation')!
    expect((manip.effects ?? []).some((e) => e.type === 'DUPLICATE_INGREDIENT')).toBe(true)
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 5, pawnLocation: playLocObj.id, hand: [manip], artifacts: [] }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: manip.instanceId, to: playLocObj.id })).toThrow(/Artéfact/i)
  })

  it('Drain d\'Âme : INJOUABLE sans Allié défaussable ; jouable dès qu\'un Allié est dans le royaume', () => {
    let s = game()
    const playLocObj = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLocObj.actions.find((a) => a.type === 'PLAY_CARD')!
    const drain = buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === 'custom-gul-dan-drain-d-ame')!
    // (a) Aucun Allié dans le royaume → injouable (garde-fou moteur).
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, pawnLocation: playLocObj.id, hand: [drain], board: { ...me(s).board, [playLocObj.id]: [] } }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: drain.instanceId, to: playLocObj.id })).toThrow(/Allié à défausser/i)
    // (b) Un Allié posé sur le lieu du pion → jouable : ouvre le choix de défausse (pendingDioDiscardAlly).
    const ally: CardInstance = { instanceId: 'al1', cardId: 'z', name: 'Allié', type: 'ally', strength: 2 }
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, pawnLocation: playLocObj.id, hand: [drain], board: { ...me(s).board, [playLocObj.id]: [ally] } }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: drain.instanceId, to: playLocObj.id })
    expect(s.pendingDioDiscardAlly?.playerIndex).toBe(0)
  })

  it('Medivh (Fatalité) : un Artéfact coûte +2, une carte normale non affectée', () => {
    let s = game()
    const pawn = me(s).pawnLocation!
    s = setBoard(s, pawn, [{ instanceId: 'med', cardId: 'custom-gul-dan-medivh', name: 'Medivh', type: 'hero', strength: 4, increasesArtifactCost: 2 }])
    const vil = buildDeckInstances(cardDefs, 'villain', 'p0:')
    const sceptre = vil.find((c) => c.cardId === 'custom-gul-dan-sceptre-de-sargeras')!
    const connexion = vil.find((c) => c.cardId === 'custom-gul-dan-connexion')!
    expect(effectiveCost(s, sceptre)).toBe((sceptre.cost ?? 0) + 2) // Artéfact : +2
    expect(effectiveCost(s, connexion)).toBe(connexion.cost ?? 0) // non-Artéfact : inchangé
  })

  it('Porte des Ténèbres : manque 1 Artéfact → pas prête, DARK_PORTAL_WIN sans effet', () => {
    let s = game()
    const portal = lastLocId(s)
    s = {
      ...s,
      players: [{
        ...me(s),
        pawnLocation: portal,
        artifacts: [
          { instanceId: 'a1', cardId: 'custom-gul-dan-livre-de-medivh', name: 'Livre', type: 'effect', isArtifact: true },
          { instanceId: 'a2', cardId: 'custom-gul-dan-l-il-de-dalaran', name: 'Œil', type: 'effect', isArtifact: true },
          { instanceId: 'a3', cardId: 'custom-gul-dan-sceptre-de-sargeras', name: 'Sceptre', type: 'effect', isArtifact: true },
        ],
        locations: me(s).locations.map((l) => ({ ...l, version: 'b' as const })),
      }],
    }
    expect(darkPortalReady(s, 0)).toBe(false)
    const res = resolveEffects(s, [{ type: 'DARK_PORTAL_WIN' }], { actorIndex: 0 })
    expect(res.status).not.toBe('WON')
  })
})

describe('Gul\'dan — Fatalités avancées', () => {
  const playLocOf = (s: GameState) => me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
  const vilCard = (id: string) => buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === id)!

  it('Khadgar : un Artéfact posé ne déclenche PAS son effet, mais rejoint la pile', () => {
    let s = game()
    const playLoc = playLocOf(s)
    const otherLoc = me(s).locations.find((l) => l.id !== playLoc.id)!.id
    const playAction = playLoc.actions.find((a) => a.type === 'PLAY_CARD')!
    // Artéfact de test (+5 Pouvoir) ; Khadgar posé AILLEURS (ne recouvre pas la pose).
    const artifact: CardInstance = { instanceId: 'art', cardId: 'custom-gul-dan-sceptre-de-sargeras', name: 'Sceptre', type: 'effect', isArtifact: true, cost: 0, effects: [{ type: 'GAIN_POWER', amount: 5 }] }
    const khadgar: CardInstance = { instanceId: 'kh', cardId: 'custom-gul-dan-khadgar', name: 'Khadgar', type: 'hero', strength: 4, nullifiesArtifacts: true }
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 3, pawnLocation: playLoc.id, hand: [artifact], board: { ...me(s).board, [otherLoc]: [khadgar] } }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: artifact.instanceId, to: playLoc.id })
    expect((me(s).artifacts ?? []).some((c) => c.instanceId === 'art')).toBe(true) // rejoint la pile
    expect(me(s).power).toBe(3) // effet ANNULÉ (pas de +5) ; coût 0
  })

  it('Khadgar : Manipulation devient INJOUABLE (Artéfacts sans effet)', () => {
    let s = game()
    const playLoc = playLocOf(s)
    const otherLoc = me(s).locations.find((l) => l.id !== playLoc.id)!.id
    const playAction = playLoc.actions.find((a) => a.type === 'PLAY_CARD')!
    const manip = vilCard('custom-gul-dan-manipulation')
    const artifact: CardInstance = { instanceId: 'art', cardId: 'custom-gul-dan-sceptre-de-sargeras', name: 'Sceptre', type: 'effect', isArtifact: true, effects: [{ type: 'GAIN_POWER', amount: 1 }] }
    const khadgar: CardInstance = { instanceId: 'kh', cardId: 'custom-gul-dan-khadgar', name: 'Khadgar', type: 'hero', strength: 4, nullifiesArtifacts: true }
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, pawnLocation: playLoc.id, hand: [manip], artifacts: [artifact], board: { ...me(s).board, [otherLoc]: [khadgar] } }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: manip.instanceId, to: playLoc.id })).toThrow(/injouable/i)
  })

  it('Défaite : un seul type présent → défausse directe (pas de choix)', () => {
    let s = game()
    const loc = me(s).locations[0].id
    const items: CardInstance[] = [
      { instanceId: 'i1', cardId: 'x', name: 'Objet1', type: 'item' },
      { instanceId: 'i2', cardId: 'y', name: 'Objet2', type: 'item' },
    ]
    s = setBoard(s, loc, items)
    s = resolveEffects(s, [{ type: 'FATE_DISCARD_TYPE_CHOICE' }], { actorIndex: 0 })
    expect(s.pendingFateDiscardType ?? null).toBeNull() // pas de choix : un seul type
    expect((me(s).board[loc] ?? []).length).toBe(0)
    expect(me(s).discard.map((c) => c.instanceId).sort()).toEqual(['i1', 'i2'])
  })

  it('Défaite : Alliés ET Objets → choix, puis défausse du type choisi seulement', () => {
    let s = game()
    const loc = me(s).locations[0].id
    const cards: CardInstance[] = [
      { instanceId: 'al1', cardId: 'a', name: 'Allié', type: 'ally', strength: 2 },
      { instanceId: 'it1', cardId: 'b', name: 'Objet', type: 'item' },
    ]
    s = setBoard(s, loc, cards)
    s = resolveEffects(s, [{ type: 'FATE_DISCARD_TYPE_CHOICE' }], { actorIndex: 0 })
    expect(s.pendingFateDiscardType).toBeTruthy()
    s = applyAction(s, { type: 'RESOLVE_FATE_DISCARD_TYPE', cardType: 'ally' })
    expect(s.pendingFateDiscardType ?? null).toBeNull()
    expect((me(s).board[loc] ?? []).map((c) => c.instanceId)).toEqual(['it1']) // Objet conservé
    expect(me(s).discard.map((c) => c.instanceId)).toEqual(['al1']) // Allié défaussé
  })

  it('Armée de la Lumière : empêche la corruption de son lieu', () => {
    let s = game()
    const loc = me(s).locations[0].id
    const playAction = me(s).locations.find((l) => l.id === loc)!.actions.find((a) => a.type === 'PLAY_CARD')!
    const armee: CardInstance = { instanceId: 'arm', cardId: 'custom-gul-dan-lumiere-des-naaru', name: 'Armée de la Lumière', type: 'effect', fromFate: true, blocksCorruptionHere: true, fateRemovalPowerCost: 3 }
    const corruption = vilCard('custom-gul-dan-corruption')
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 9, pawnLocation: loc, hand: [corruption], board: { ...me(s).board, [loc]: [armee] } }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: corruption.instanceId, to: loc })).toThrow(/Armée de la Lumière/i)
  })

  it('Armée de la Lumière : défaussable contre 3 Pouvoir', () => {
    let s = game()
    const loc = me(s).locations[0].id
    const armee: CardInstance = { instanceId: 'arm', cardId: 'custom-gul-dan-lumiere-des-naaru', name: 'Armée de la Lumière', type: 'effect', fromFate: true, blocksCorruptionHere: true, fateRemovalPowerCost: 3 }
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 5, board: { ...me(s).board, [loc]: [armee] } }] }
    s = applyAction(s, { type: 'REMOVE_FATE_LOCATION_CARD', instanceId: 'arm' })
    expect(me(s).power).toBe(2) // −3
    expect((me(s).board[loc] ?? []).length).toBe(0)
    expect(me(s).fateDiscard.some((c) => c.instanceId === 'arm')).toBe(true)
  })

  it('Kil\'jaeden : −1 Pouvoir au début du tour ; défaussable seulement à 4 lieux corrompus', () => {
    let s = game()
    const loc = me(s).locations[0].id
    const kil: CardInstance = { instanceId: 'kil', cardId: 'custom-gul-dan-kil-jaeden', name: "Kil'jaeden", type: 'effect', fromFate: true, drainsPowerAtTurnStart: 1, discardWhenAllCorrupted: true }
    // Défausse refusée tant que < 4 lieux corrompus.
    s = { ...s, phase: 'ACTION', players: [{ ...me(s), power: 5, board: { ...me(s).board, [loc]: [kil] } }] }
    expect(() => applyAction(s, { type: 'REMOVE_FATE_LOCATION_CARD', instanceId: 'kil' })).toThrow(/4 lieux corrompus/i)
    // Drain de début de tour (END_TURN en solo → le même joueur redémarre).
    const p0 = me(s).power
    const after = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(me(after).power).toBe(p0 - 1)
  })

  it('Prophète Velen : à la pose, rejoue « Armée de la Lumière » depuis la défausse Fatalité', () => {
    let s = game()
    const armee: CardInstance = { instanceId: 'arm', cardId: 'custom-gul-dan-lumiere-des-naaru', name: 'Armée de la Lumière', type: 'effect', fateAttachesToLocation: true, blocksCorruptionHere: true, fateRemovalPowerCost: 3 }
    s = { ...s, players: [{ ...me(s), fateDiscard: [armee] }] }
    s = resolveEffects(s, [{ type: 'FATE_REPLAY_CARD_FROM_DISCARD', cardId: 'custom-gul-dan-lumiere-des-naaru' }], { actorIndex: 0 })
    expect(s.pendingFateObjectPlace?.card.instanceId).toBe('arm') // rejouée : choix du lieu
    expect(me(s).fateDiscard.some((c) => c.instanceId === 'arm')).toBe(false) // retirée de la défausse
  })
})
