import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createInitialGame } from '../state'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { resolveEffects } from '../effects'
import { hasReachedObjective, activitePlayableAtHour, effectiveCost, isActionCovered, enlargeCoveredAction } from '../rules'
import { handLimitFor } from '../state'
import { toVillainDef, toCardDefs } from '../../data/customVillain'
import { patchCustomIsabella } from '../../data/villains/customIsabella'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'
import type { CustomVillain } from '../../data/customVillain'

const exported = JSON.parse(readFileSync('assets/custom-exports/custom-isabella.json', 'utf8')) as CustomVillain
const isabella = patchCustomIsabella(exported)
const def = toVillainDef(isabella)
const cardDefs = toCardDefs(isabella)

function game(seed = 7): GameState {
  return createInitialGame(
    [{ villain: def, deckCards: buildDeckInstances(cardDefs, 'villain', 'p0:'), fateCards: buildDeckInstances(cardDefs, 'fate', 'p0f:') }],
    seed,
  )
}
const me = (s: GameState) => s.players[0]
const vil = (id: string) => buildDeckInstances(cardDefs, 'villain', 'p0:').find((c) => c.cardId === id)!
const fate = (id: string) => buildDeckInstances(cardDefs, 'fate', 'p0f:').find((c) => c.cardId === id)!

describe("Isabella — horloge & activités", () => {
  it("démarre à XII (0), aucune heure validée, objectif ISABELLA_CLOCK", () => {
    const s = game()
    expect(me(s).objective).toEqual({ type: 'ISABELLA_CLOCK' })
    expect(me(s).clockHour).toBe(0)
    expect(me(s).validatedHours).toEqual([])
  })

  it("l'aiguille avance au début de chaque tour d'Isabella (XII → II)", () => {
    let s = game()
    expect(me(s).clockHour).toBe(0) // XII (tour 1)
    s = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(me(s).clockHour).toBe(1) // II (tour 2)
    s = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(me(s).clockHour).toBe(2) // IV (tour 3)
  })

  it("les Activités portent leurs heures autorisées ; verrou par heure", () => {
    const moisson = vil('custom-isabella-moisson')
    expect(moisson.allowedHours).toEqual([0, 2, 4]) // XII, IV, VIII
    const s = game()
    // À XII (0) : jouable. À II (1) : verrouillée.
    expect(activitePlayableAtHour({ ...me(s), clockHour: 0 }, moisson)).toBe(true)
    expect(activitePlayableAtHour({ ...me(s), clockHour: 1 }, moisson)).toBe(false)
  })

  it("jouer une Activité à la bonne heure VALIDE cette heure ; injouable à la mauvaise heure", () => {
    let s = game()
    const playLoc = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLoc.actions.find((a) => a.type === 'PLAY_CARD')!
    const moisson = vil('custom-isabella-moisson')
    // Heure II (1) : MOISSON (XII/IV/VIII) est injouable.
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, clockHour: 1, pawnLocation: playLoc.id, hand: [moisson] }] }
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: moisson.instanceId, to: playLoc.id })).toThrow(/ne peut être jouée/i)
    // Heure XII (0) : jouable → valide l'heure XII.
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, clockHour: 0, validatedHours: [], pawnLocation: playLoc.id, hand: [moisson] }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: moisson.instanceId, to: playLoc.id })
    expect(me(s).validatedHours).toEqual([0])
  })

  it("VALIDATE_HOUR est idempotent (rejouer la même heure ne double pas)", () => {
    let s = game()
    s = { ...s, players: [{ ...me(s), clockHour: 3, validatedHours: [3] }] }
    s = resolveEffects(s, [{ type: 'VALIDATE_HOUR' }], { actorIndex: 0 })
    expect(me(s).validatedHours).toEqual([3])
  })

  it("VICTOIRE IMMÉDIATE dès la validation de la 6e heure (pas au début du tour)", () => {
    let s = game()
    // 5 heures déjà validées, l'aiguille sur la 6e (X = index 5).
    s = { ...s, players: [{ ...me(s), clockHour: 5, validatedHours: [0, 1, 2, 3, 4] }] }
    s = resolveEffects(s, [{ type: 'VALIDATE_HOUR' }], { actorIndex: 0 })
    expect(me(s).validatedHours!.sort()).toEqual([0, 1, 2, 3, 4, 5])
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it("CLOCHE : les cartes non gardées retournent dans le deck (pas la défausse)", () => {
    let s = game()
    const top = [
      { instanceId: 't1', cardId: 'a', name: 'A', type: 'effect' as const },
      { instanceId: 't2', cardId: 'b', name: 'B', type: 'effect' as const },
      { instanceId: 't3', cardId: 'c', name: 'C', type: 'effect' as const },
    ]
    s = { ...s, players: [{ ...me(s), deck: top, discard: [], hand: [] }] }
    s = resolveEffects(s, [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 3, take: 1, title: 'Cloche', returnToDeck: true }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['t1'] })
    expect(me(s).hand.map((c) => c.instanceId)).toEqual(['t1'])
    expect(me(s).discard).toHaveLength(0) // rien en défausse
    expect(me(s).deck.map((c) => c.instanceId).sort()).toEqual(['t2', 't3']) // remises dans le deck
  })

  it("HORLOGE : 1er tour toujours XII, que l'on joue en 1er OU en 2e", () => {
    // Isabella EN 2E : partie à 2 joueurs, un adversaire (Isabella = index 1).
    const advDeck = buildDeckInstances(cardDefs, 'villain', 'p1:')
    const advFate = buildDeckInstances(cardDefs, 'fate', 'p1f:')
    let s = createInitialGame(
      [
        { villain: def, deckCards: buildDeckInstances(cardDefs, 'villain', 'p0:'), fateCards: buildDeckInstances(cardDefs, 'fate', 'p0f:') },
        { villain: def, deckCards: advDeck, fateCards: advFate },
      ],
      7,
    )
    // Joueur 0 joue son 1er tour puis le termine → au tour du joueur 1 (Isabella 2e).
    s = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(s.activePlayer).toBe(1)
    expect(s.players[1].clockHour).toBe(0) // 1er tour d'Isabella (2e) : XII, PAS d'avance
    // Elle termine → joueur 0 → revient à elle (2e tour) : II.
    s = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    s = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(s.activePlayer).toBe(1)
    expect(s.players[1].clockHour).toBe(1) // 2e tour : II
  })

  it("NORMAN (aimé) : Événement −1 seulement sur le lieu de Norman", () => {
    const norman = fate('custom-isabella-norman')
    const event: CardInstance = { instanceId: 'e', cardId: 'x', name: 'Événement', type: 'effect', cost: 2 }
    const base = game()
    const [locA, locB] = me(base).locations.map((l) => l.id)
    // Norman AIMÉ sur locA. Pion sur locA → −1. Pion sur locB → pas de remise.
    const withNorman = { ...me(base), board: { ...me(base).board, [locA]: [{ ...norman, instanceId: 'n1', loved: true }] } }
    expect(effectiveCost({ ...base, players: [{ ...withNorman, pawnLocation: locA }] }, event)).toBe(1)
    expect(effectiveCost({ ...base, players: [{ ...withNorman, pawnLocation: locB }] }, event)).toBe(2)
  })

  it("DON : arrive AGRANDI (façon Reine de Cœur) et recouvre une action d'un lieu voisin", () => {
    const don = fate('custom-isabella-don')
    expect(don.bornEnlarged).toBe(true)
    let s = game()
    const loc = me(s).locations[0].id // loc-1 (voisin : loc-2)
    s = placeFateHeroWithEffects(s, 0, 0, { ...don, instanceId: 'don1' }, loc, 'LA MAISON')
    const placed = (me(s).board[loc] ?? []).find((c) => c.instanceId === 'don1')!
    expect(placed.heroSize).toBe('enlarged')
    expect(placed.enlargeTargetId).toBeDefined() // déborde sur un lieu voisin
    // Il recouvre une action du haut du lieu voisin.
    const cov = enlargeCoveredAction(me(s), placed)
    expect(cov?.locationId).toBe(placed.enlargeTargetId)
  })

  it("VICTOIRE : les 6 heures validées", () => {
    let s = game()
    expect(hasReachedObjective(s, 0)).toBe(false)
    s = { ...s, players: [{ ...me(s), validatedHours: [0, 1, 2, 3, 4, 5] }] }
    expect(hasReachedObjective(s, 0)).toBe(true)
    // 5/6 ne suffit pas.
    s = { ...s, players: [{ ...me(s), validatedHours: [0, 1, 2, 3, 4] }] }
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it("les 6 heures sont couvrables par au moins une Activité", () => {
    const activites = buildDeckInstances(cardDefs, 'villain', 'p0:').filter((c) => c.allowedHours && c.allowedHours.length > 0)
    for (let h = 0; h < 6; h++) {
      expect(activites.some((c) => c.allowedHours!.includes(h))).toBe(true)
    }
  })

  it("SUPPRIMÉS DE L'ÉQUATION : effet Éliminer un Héros branché", () => {
    const supp = vil('custom-isabella-supprimes-de-l-equation')
    expect(supp.effects).toEqual([{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 99 }])
  })

  it("GRAND-MÈRE SARAH : capacité ACTIVÉE (2 Pouvoir) → Éliminer un Héros (interactif)", () => {
    const sarah = vil('custom-isabella-grand-mere-sarah')
    expect(sarah.activatedCost).toBe(2)
    expect(sarah.effects ?? []).toHaveLength(0)
    expect(sarah.activatedEffects).toEqual([{ type: 'OPTIONAL_FREE_VANQUISH' }])
    // Activation : ouvre la fenêtre « Éliminer un Héros » (pendingTrapVanquish) s'il y a un Héros.
    let s = game()
    const loc = me(s).locations.find((l) => l.actions.some((a) => a.type === 'ACTIVATE'))!
    const otherLoc = me(s).locations.find((l) => l.id !== loc.id)!.id
    const activateAction = loc.actions.find((a) => a.type === 'ACTIVATE')!
    // Héros placé AILLEURS (sinon il recouvrirait l'action Activer du lieu de Sarah).
    const hero: CardInstance = { instanceId: 'h1', cardId: 'x', name: 'Emma', type: 'hero', strength: 5 }
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, pawnLocation: loc.id, board: { ...me(s).board, [loc.id]: [{ ...sarah, instanceId: 'sa1' }], [otherLoc]: [hero] } }] }
    s = applyAction(s, { type: 'ACTIVATE', actionId: activateAction.id, cardInstanceId: 'sa1' })
    expect(me(s).power).toBe(3) // −2
    expect(s.pendingTrapVanquish).toBeTruthy() // fenêtre d'élimination ouverte
  })

  it("AMOUR : GRANT_LOVE ouvre le choix d'un Héros ; le Héros choisi devient aimé (Allié)", () => {
    let s = game()
    const pawn = me(s).pawnLocation!
    const heroes: CardInstance[] = [
      { instanceId: 'h1', cardId: 'x', name: 'Emma', type: 'hero', strength: 5 },
      { instanceId: 'h2', cardId: 'y', name: 'Norman', type: 'hero', strength: 5 },
    ]
    s = { ...s, players: [{ ...me(s), board: { ...me(s).board, [pawn]: heroes } }] }
    s = resolveEffects(s, [{ type: 'GRANT_LOVE' }], { actorIndex: 0 })
    expect(s.pendingGrantLove?.candidateIds.sort()).toEqual(['h1', 'h2'])
    s = applyAction(s, { type: 'RESOLVE_GRANT_LOVE', heroInstanceId: 'h1' })
    expect(s.pendingGrantLove ?? null).toBeNull()
    const emma = (me(s).board[pawn] ?? []).find((c) => c.instanceId === 'h1')!
    expect(emma.loved).toBe(true) // devient un Allié (aimé)
    expect((me(s).board[pawn] ?? []).find((c) => c.instanceId === 'h2')!.loved).toBeUndefined()
  })

  it("AMOUR : un Héros aimé ne recouvre plus les actions (traité comme Allié)", () => {
    const s = game()
    const loc = me(s).locations[0].id
    const hero: CardInstance = { instanceId: 'h1', cardId: 'x', name: 'Don', type: 'hero', strength: 4 }
    // Ensemble des Héros qui RECOUVRENT les actions du lieu (même critère que le moteur).
    const covering = (st: GameState) => (me(st).board[loc] ?? []).filter((c) => c.type === 'hero' && !c.loved && !c.hypnotized)
    const withHero = { ...s, players: [{ ...me(s), board: { ...me(s).board, [loc]: [hero] } }] }
    expect(covering(withHero)).toHaveLength(1) // Héros normal → recouvre
    const withLoved = { ...s, players: [{ ...me(s), board: { ...me(s).board, [loc]: [{ ...hero, loved: true }] } }] }
    expect(covering(withLoved)).toHaveLength(0) // Héros aimé → ne recouvre plus (Allié)
  })

  it("AMOUR : GRANT_LOVE sans Héros → no-op (pas de pending)", () => {
    let s = game()
    s = resolveEffects(s, [{ type: 'GRANT_LOVE' }], { actorIndex: 0 })
    expect(s.pendingGrantLove ?? null).toBeNull()
  })

  it("DÎNER EN FAMILLE : accorde l'Amour (GRANT_LOVE dans ses effets)", () => {
    const diner = vil('custom-isabella-diner-en-famille')
    expect(diner.effects?.some((e) => e.type === 'GRANT_LOVE')).toBe(true)
    expect(diner.effects?.some((e) => e.type === 'VALIDATE_HOUR')).toBe(true)
  })

  it("LA VIDA : capacité ACTIVÉE (1 Pouvoir) → cherche MOISSON", () => {
    const lavida = vil('custom-isabella-la-vida')
    expect(lavida.activatedCost).toBe(1)
    expect(lavida.effects ?? []).toHaveLength(0)
    expect(lavida.activatedEffects).toEqual([{ type: 'FETCH_CARD_TO_HAND', cardId: 'custom-isabella-moisson' }])
  })

  it("RADAR DE POCHE : capacité activée → Activités à toute heure + Héros Fatalité tiré", () => {
    const radar = vil('custom-isabella-radar-de-poche')
    expect(radar.activatedCost).toBe(0)
    expect(radar.activatedEffects).toEqual([{ type: 'RADAR_POCHE' }])
    let s = game()
    const nonHero: CardInstance = { instanceId: 'f1', cardId: 'a', name: 'Événement', type: 'effect' }
    const hero: CardInstance = { instanceId: 'f2', cardId: 'custom-isabella-norman', name: 'Norman', type: 'hero', strength: 5 }
    s = { ...s, players: [{ ...me(s), fateDeck: [nonHero, hero], fateDiscard: [] }] }
    s = resolveEffects(s, [{ type: 'RADAR_POCHE' }], { actorIndex: 0 })
    expect(me(s).activiteAnyHourThisTurn).toBe(true) // override d'heure
    expect(s.pendingFateHeroPlace?.heroCardId).toBe('custom-isabella-norman') // Héros à placer
    expect(me(s).fateDiscard.some((c) => c.instanceId === 'f1')).toBe(true) // le reste défaussé
    // Override : une Activité hors heure devient jouable.
    const moisson = vil('custom-isabella-moisson') // XII/IV/VIII
    expect(activitePlayableAtHour({ ...me(s), clockHour: 1 }, moisson)).toBe(true)
  })

  it("JOUER À CHAT : déplacement INTERACTIF d'un Héros vers un lieu voisin (pendingHeroRelocate)", () => {
    const jac = vil('custom-isabella-jouer-a-chat')
    expect(jac.effects?.some((e) => e.type === 'RELOCATE_HERO_ADJACENT')).toBe(true)
    let s = game()
    const loc = me(s).locations[0].id
    const hero: CardInstance = { instanceId: 'h1', cardId: 'x', name: 'Norman', type: 'hero', strength: 5 }
    s = { ...s, players: [{ ...me(s), board: { ...me(s).board, [loc]: [hero] } }] }
    s = resolveEffects(s, [{ type: 'RELOCATE_HERO_ADJACENT' }], { actorIndex: 0 })
    expect(s.pendingHeroRelocate?.chooserIndex).toBe(0) // choix interactif ouvert
  })

  it("Une Activité est jouable à la bonne heure MÊME si son 2e effet n'a pas de cible", () => {
    let s = game()
    const playLoc = me(s).locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const playAction = playLoc.actions.find((a) => a.type === 'PLAY_CARD')!
    const jac = vil('custom-isabella-jouer-a-chat') // II/VI/VIII/X, 2e effet = déplacer un Héros
    // Heure II (1), AUCUN Héros dans le royaume → jouable quand même (valide l'heure).
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, clockHour: 1, validatedHours: [], pawnLocation: playLoc.id, hand: [jac], board: { ...me(s).board, [playLoc.id]: [] } }] }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: playAction.id, instanceId: jac.instanceId, to: playLoc.id })
    expect(me(s).validatedHours).toEqual([1]) // l'heure est validée, pas de blocage
  })

  it("RADAR DE POCHE : après la pose du Héros, action de royaume GRATUITE (jouer une Activité)", () => {
    let s = game()
    const nonHero: CardInstance = { instanceId: 'f1', cardId: 'a', name: 'X', type: 'effect' }
    const hero: CardInstance = { instanceId: 'f2', cardId: 'custom-isabella-norman', name: 'Norman', type: 'hero', strength: 5 }
    s = { ...s, players: [{ ...me(s), fateDeck: [nonHero, hero], fateDiscard: [] }] }
    s = resolveEffects(s, [{ type: 'RADAR_POCHE' }], { actorIndex: 0 })
    expect(s.pendingFateHeroPlace?.thenFreeRealmAction).toBe(true)
    // Après avoir placé le Héros → action gratuite ouverte.
    const dest = me(s).locations[0].id
    s = applyAction(s, { type: 'RESOLVE_FATE_HERO_PLACE', locationId: dest })
    expect(s.pendingFreeRealmAction?.playerIndex).toBe(0)
  })

  it("CLOCHE : capacité ACTIVÉE (gratuite), pas un effet à la pose", () => {
    const cloche = vil('custom-isabella-cloche')
    expect(cloche.activatedCost).toBe(0)
    expect(cloche.effects ?? []).toHaveLength(0)
    expect(cloche.activatedEffects).toEqual([{ type: 'LOOK_TOP_DRAW_DISCARD', look: 4, take: 1, title: 'Cloche', returnToDeck: true }])
  })

  it("MAMAN EST UN ENNEMI : UNGRANT_LOVE libère le Héros aimé le plus fort", () => {
    let s = game()
    const loc = me(s).locations[0].id
    const cards: CardInstance[] = [
      { instanceId: 'l1', cardId: 'x', name: 'Emma', type: 'hero', strength: 5, loved: true },
      { instanceId: 'l2', cardId: 'y', name: 'Conny', type: 'hero', strength: 2, loved: true },
    ]
    s = { ...s, players: [{ ...me(s), board: { ...me(s).board, [loc]: cards } }] }
    s = resolveEffects(s, [{ type: 'UNGRANT_LOVE' }], { actorIndex: 0 })
    const l1 = (me(s).board[loc] ?? []).find((c) => c.instanceId === 'l1')!
    const l2 = (me(s).board[loc] ?? []).find((c) => c.instanceId === 'l2')!
    expect(l1.loved).toBeUndefined() // le plus fort libéré
    expect(l2.loved).toBe(true)
  })

  it("GILDA : Événements +1 tant que NON aimée ; main complétée à 5 une fois AIMÉE", () => {
    const gilda = fate('custom-isabella-gilda')
    const event: CardInstance = { instanceId: 'e', cardId: 'x', name: 'Événement', type: 'effect', cost: 2 }
    const base = game()
    const loc = me(base).locations[0].id
    // Gilda NON aimée : Événement coûte 2 + 1 = 3.
    const s1 = { ...base, players: [{ ...me(base), board: { ...me(base).board, [loc]: [{ ...gilda, instanceId: 'g1' }] } }] }
    expect(effectiveCost(s1, event)).toBe(3)
    // Gilda AIMÉE : plus de surcharge ; limite de main portée à 5.
    const s2 = { ...base, players: [{ ...me(base), board: { ...me(base).board, [loc]: [{ ...gilda, instanceId: 'g1', loved: true }] } }] }
    expect(effectiveCost(s2, event)).toBe(2)
    expect(handLimitFor(me(s2))).toBe(5)
  })

  it("PHIL (aimé) : les Activités coûtent 1 de moins", () => {
    const phil = fate('custom-isabella-phil')
    const moisson = vil('custom-isabella-moisson') // Activité, coût 1
    const base = game()
    const loc = me(base).locations[0].id
    const s = { ...base, players: [{ ...me(base), board: { ...me(base).board, [loc]: [{ ...phil, instanceId: 'p1', loved: true }] } }] }
    expect(effectiveCost(s, moisson)).toBe(Math.max(0, (moisson.cost ?? 0) - 1))
  })

  it("INCENDIE : bloque les Activités à la prochaine heure (Phil aimé = immunité)", () => {
    let s = game()
    // Incendie arme le blocage ; au prochain début de tour il devient actif.
    s = resolveEffects(s, [{ type: 'INCENDIE' }], { actorIndex: 0 })
    expect(me(s).incendiePending).toBe(true)
    s = applyAction({ ...s, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(me(s).incendieActive).toBe(true)
    expect(me(s).incendiePending).toBe(false)
    // Une Activité, même à la bonne heure, est bloquée ce tour.
    const moisson = vil('custom-isabella-moisson')
    expect(activitePlayableAtHour({ ...me(s), clockHour: 0, incendieActive: true }, moisson)).toBe(false)
    // Immunité : avec un Phil AIMÉ, Incendie ne s'arme pas.
    const phil = fate('custom-isabella-phil')
    const loc = me(s).locations[0].id
    let s2 = game()
    s2 = { ...s2, players: [{ ...me(s2), board: { ...me(s2).board, [loc]: [{ ...phil, instanceId: 'ph1', loved: true }] } }] }
    s2 = resolveEffects(s2, [{ type: 'INCENDIE' }], { actorIndex: 0 })
    expect(me(s2).incendiePending).toBeFalsy() // immunisé
  })

  it("EMMA (non aimée) : activer une capacité coûte 2 Pouvoir de plus", () => {
    const emma = fate('custom-isabella-emma')
    expect(emma.activateSurcharge).toBe(2)
    let s = game()
    const loc = me(s).locations.find((l) => l.actions.some((a) => a.type === 'ACTIVATE'))!
    const otherLoc = me(s).locations.find((l) => l.id !== loc.id)!.id
    const activateAction = loc.actions.find((a) => a.type === 'ACTIVATE')!
    const cloche = vil('custom-isabella-cloche') // activatedCost 0
    // Emma placée AILLEURS (surcharge à l'échelle du royaume) ; Cloche sur le lieu du pion.
    s = { ...s, phase: 'ACTION', usedActionIds: [], players: [{ ...me(s), power: 5, pawnLocation: loc.id, deck: [{ instanceId: 'd1', cardId: 'z', name: 'C', type: 'effect' }], board: { ...me(s).board, [loc.id]: [{ ...cloche, instanceId: 'cl1' }], [otherLoc]: [{ ...emma, instanceId: 'em1' }] } }] }
    s = applyAction(s, { type: 'ACTIVATE', actionId: activateAction.id, cardInstanceId: 'cl1' })
    expect(me(s).power).toBe(3) // 5 − 0 (Cloche) − 2 (Emma)
  })

  it("SŒUR KRONE : Isabella peut utiliser une action recouverte sur son lieu", () => {
    const krone = vil('custom-isabella-s-ur-krone')
    expect(krone.unlocksCoveredActionsHere).toBe(true)
    const s = game()
    const loc = me(s).locations[0].id
    const topAction = s.players[0].locations.find((l) => l.id === loc)!.actions.find((a) => a.row === 'top')!
    const hero: CardInstance = { instanceId: 'h1', cardId: 'x', name: 'Norman', type: 'hero', strength: 5 }
    // Héros seul sur le lieu du pion → action du haut recouverte.
    const s1 = { ...s, players: [{ ...me(s), pawnLocation: loc, board: { ...me(s).board, [loc]: [hero] } }] }
    expect(isActionCovered(s1, topAction)).toBe(true)
    // Avec Sœur Krone sur le lieu → l'action recouverte redevient utilisable.
    const s2 = { ...s, players: [{ ...me(s), pawnLocation: loc, board: { ...me(s).board, [loc]: [hero, { ...krone, instanceId: 'kr1' }] } }] }
    expect(isActionCovered(s2, topAction)).toBe(false)
  })

  it("TÉLÉPHONE À FICELLE : Isabella perd 2 Pouvoir en arrivant sur le lieu", () => {
    let s = game()
    const [locA, locB] = me(s).locations.map((l) => l.id)
    const hero: CardInstance = { instanceId: 'h1', cardId: 'x', name: 'Norman', type: 'hero', strength: 5 }
    const phone: CardInstance = { instanceId: 'ph', cardId: 'custom-isabella-telephone-a-ficelle', name: 'Téléphone', type: 'item', attachedTo: 'h1', powerPenaltyOnPawnArrive: 2, fromFate: true }
    s = { ...s, phase: 'MOVE', players: [{ ...me(s), power: 5, pawnLocation: locA, board: { ...me(s).board, [locB]: [hero, phone] } }] }
    s = applyAction(s, { type: 'MOVE', to: locB })
    expect(me(s).power).toBe(3) // −2 à l'arrivée
  })
})
