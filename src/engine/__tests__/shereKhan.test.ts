import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { performVanquish, resolveEffects } from '../effects'
import { isActionAvailable } from '../rules'
import { fireCount, placeFire, actionHasFire } from '../shereKhan'
import { shereKhan } from '../../data/villains/shereKhan'
import { shereKhanCards } from '../../data/villains/shereKhan.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { chooseAction } from '../../ai/heuristicBot'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: shereKhan,
        deckCards: buildDeckInstances(shereKhanCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(shereKhanCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

describe('Shere Khan — mise en place', () => {
  it('4 lieux, objectif DEFEAT_HERO_NO_FIRE (Mowgli), aucun jeton Feu au départ', () => {
    const p = game().players[0]
    expect(p.locations.map((l) => l.id)).toEqual(['riviere', 'rocher-conseil', 'ruines-anciennes', 'terres-desolees'])
    expect(p.objective).toEqual({ type: 'DEFEAT_HERO_NO_FIRE', heroCardId: 'mowgli' })
    expect(fireCount(p)).toBe(0)
  })
})

describe('Shere Khan — Jetons Feu', () => {
  it('Mowgli (onPlace) : Shere Khan CHOISIT l’action à recouvrir sur le lieu d’arrivée', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { riviere: [mowgli] } }] }
    // Plusieurs actions libres → on ouvre le choix (pas d'auto-pose), restreint à La Rivière.
    const opened = resolveEffects(s0, [{ type: 'PLACE_FIRE_AT_HOST' }], { actorIndex: 0, hostLocationId: 'riviere' })
    expect(opened.pendingPlaceFire?.chooserIndex).toBe(0)
    expect(opened.pendingPlaceFire?.locationId).toBe('riviere')
    expect(fireCount(opened.players[0])).toBe(0) // rien posé tant qu'on n'a pas choisi
    const actionId = opened.players[0].locations.find((l) => l.id === 'riviere')!.actions[0].id
    const out = applyAction(opened, { type: 'RESOLVE_PLACE_FIRE', locationId: 'riviere', actionId })
    expect(out.pendingPlaceFire ?? null).toBeNull()
    expect(actionHasFire(out.players[0], 'riviere', actionId)).toBe(true)
    expect(fireCount(out.players[0])).toBe(1)
  })

  it('Mowgli (onPlace) : une seule action libre → pose AUTOMATIQUE (pas de choix)', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    let s0: GameState = { ...base, players: [{ ...base.players[0], board: { riviere: [mowgli] } }] }
    const acts = s0.players[0].locations.find((l) => l.id === 'riviere')!.actions
    for (const a of acts.slice(0, -1)) s0 = placeFire(s0, 0, 'riviere', a.id) // ne laisse qu'une action libre
    const lastFree = acts[acts.length - 1].id
    const s = resolveEffects(s0, [{ type: 'PLACE_FIRE_AT_HOST' }], { actorIndex: 0, hostLocationId: 'riviere' })
    expect(s.pendingPlaceFire ?? null).toBeNull() // auto : aucun pending
    expect(actionHasFire(s.players[0], 'riviere', lastFree)).toBe(true)
  })

  it('une action recouverte par un jeton Feu est indisponible', () => {
    const base = game()
    // pion sur La Rivière ; un jeton Feu recouvre l'action « play-card » du lieu.
    let s: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], pawnLocation: 'riviere' }] }
    s = placeFire(s, 0, 'riviere', 'play-card')
    expect(actionHasFire(s.players[0], 'riviere', 'play-card')).toBe(true)
    expect(isActionAvailable(s, 'play-card')).toBe(false)
    // une autre action du lieu reste disponible.
    expect(isActionAvailable(s, 'fate')).toBe(true)
  })

  it('C\'est moi, Shere Khan retire un jeton Feu du lieu du pion', () => {
    const base = game()
    let s: GameState = { ...base, players: [{ ...base.players[0], pawnLocation: 'riviere' }] }
    s = placeFire(s, 0, 'riviere', 'vanquish')
    expect(fireCount(s.players[0])).toBe(1)
    s = resolveEffects(s, [{ type: 'REMOVE_FIRE_AT_PAWN' }], { actorIndex: 0 })
    expect(fireCount(s.players[0])).toBe(0)
  })

  it('Feu Rouge des Hommes : choix INTERACTIF de l’action où poser le jeton Feu', () => {
    const base = game()
    const s0: GameState = { ...base, activePlayer: 0, players: [{ ...base.players[0] }] }
    // L'effet ouvre un pending (pas d'auto-pose) côté fataliseur.
    const opened = resolveEffects(s0, [{ type: 'PLACE_OR_MOVE_FIRE' }], { actorIndex: 0 })
    expect(opened.pendingPlaceFire?.chooserIndex).toBe(0)
    expect(opened.pendingPlaceFire?.targetIndex).toBe(0)
    expect(fireCount(opened.players[0])).toBe(0) // rien posé tant qu'on n'a pas choisi
    // On choisit explicitement « fate » sur La Rivière : le jeton Feu s'y pose.
    const out = applyAction(opened, { type: 'RESOLVE_PLACE_FIRE', locationId: 'riviere', actionId: 'fate' })
    expect(out.pendingPlaceFire ?? null).toBeNull()
    expect(actionHasFire(out.players[0], 'riviere', 'fate')).toBe(true)
    expect(fireCount(out.players[0])).toBe(1)
  })

  it('Macaques (Activer) retire tous les jetons Feu de leur lieu, contre 1 Pouvoir chacun', () => {
    const base = game()
    const mac = { ...buildDeckInstances(shereKhanCards, 'villain', 'mc:').find((d) => d.cardId === 'macaques')!, instanceId: 'mac1' }
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], power: 5, pawnLocation: 'ruines-anciennes', board: { 'ruines-anciennes': [mac] } }],
    }
    s = placeFire(s, 0, 'ruines-anciennes', 'play-card')
    s = placeFire(s, 0, 'ruines-anciennes', 'discard')
    expect(fireCount(s.players[0])).toBe(2)
    // Activer les Macaques sur leur lieu (action 'activate' des Ruines).
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'mac1' })
    expect(fireCount(s.players[0])).toBe(0)
    expect(s.players[0].power).toBe(3) // 5 − 2
    expect(s.players[0].discard.some((c) => c.cardId === 'macaques')).toBe(true)
  })
})

describe('Shere Khan — objectif (vaincre Mowgli sans Feu)', () => {
  const setup = (fire: boolean, withBaloo = false): GameState => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const ally = card('macaques', 'ally', { strength: 2, instanceId: 'a1' })
    const board: GameState['players'][number]['board'] = { riviere: [mowgli, ally] }
    if (withBaloo) board['rocher-conseil'] = [card('baloo', 'hero', { strength: 4, instanceId: 'b1', shieldsOtherHeroesUntilTokens: 3 })]
    let s: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], board }] }
    if (fire) s = placeFire(s, 0, 'terres-desolees', 'play-card')
    return s
  }

  it('vaincre Mowgli SANS jeton Feu = VICTOIRE', () => {
    const s = performVanquish(setup(false), 'm1', ['a1'], false)
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('vaincre Mowgli AVEC un jeton Feu présent ne gagne pas', () => {
    const s = performVanquish(setup(true), 'm1', ['a1'], false)
    expect(s.status).not.toBe('WON')
    // Mowgli est tout de même éliminé (mais pas de victoire).
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'm1')).toBe(false)
  })

  it('Baloo protège Mowgli : la tentative pose un jeton sur Baloo, Mowgli survit', () => {
    const s = performVanquish(setup(false, true), 'm1', ['a1'], false)
    expect(s.status).not.toBe('WON')
    const baloo = Object.values(s.players[0].board).flat().find((c) => c.instanceId === 'b1')
    expect(baloo?.protectionTokens).toBe(1)
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === 'm1')).toBe(true)
  })
})

describe('Shere Khan — cartes interactives', () => {
  it('C\'est moi, Shere Khan : plusieurs jetons Feu → choix interactif du jeton à retirer', () => {
    const base = game()
    let s: GameState = { ...base, players: [{ ...base.players[0], pawnLocation: 'riviere' }] }
    s = placeFire(s, 0, 'riviere', 'vanquish')
    s = placeFire(s, 0, 'rocher-conseil', 'fate')
    s = resolveEffects(s, [{ type: 'REMOVE_FIRE_AT_PAWN' }], { actorIndex: 0 })
    expect(s.pendingRemoveFire?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_REMOVE_FIRE', locationId: 'rocher-conseil', actionId: 'fate' })
    expect(actionHasFire(s.players[0], 'rocher-conseil', 'fate')).toBe(false)
    expect(fireCount(s.players[0])).toBe(1)
  })

  it('Tout le monde fuit : Héros + capacité activable → choix Activer/Vaincre', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const kaa = { ...buildDeckInstances(shereKhanCards, 'villain', 'k:').find((d) => d.cardId === 'kaa')!, instanceId: 'kaa1' }
    // Kaa activable : un Objet abordable en défausse.
    const obj = card('anneaux-de-kaa', 'item', { cost: 1, instanceId: 'o1' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], power: 5, board: { riviere: [mowgli], 'rocher-conseil': [kaa] }, discard: [obj] }] }
    const s = resolveEffects(s0, [{ type: 'GRANT_FREE_ACTIVATE_OR_VANQUISH' }], { actorIndex: 0 })
    expect(s.pendingActivateOrVanquish?.playerIndex).toBe(0)
  })

  it('Lancé sur ses traces : Mowgli absent → on le cherche et on choisit le lieu', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], fateDeck: [mowgli], pawnLocation: 'riviere' }] }
    const s = resolveEffects(s0, [{ type: 'DEFEAT_OR_FETCH_HERO', heroCardId: 'mowgli' }], { actorIndex: 0 })
    expect(s.pendingFetchedHero?.hero.cardId).toBe('mowgli')
  })

  it('Jeune et sans défense : Héros + Allié → choix interactif', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const ally = card('macaques', 'ally', { strength: 2, instanceId: 'a1' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { riviere: [mowgli], 'rocher-conseil': [ally] } }] }
    const s = resolveEffects(s0, [{ type: 'MOVE_HERO_TO_ALLY_OR_POWER_PER_ALLY' }], { actorIndex: 0 })
    expect(s.pendingYoung?.kind).toBe('choose')
    // choix « gagner » → +1 Pouvoir par Allié (1 ici).
    const g = applyAction({ ...s, players: [{ ...s.players[0], power: 0 }] }, { type: 'RESOLVE_YOUNG', choice: 'gain' })
    expect(g.players[0].power).toBe(1)
  })

  it('Jeune et sans défense : injouable si NI Héros NI Allié dans le royaume', () => {
    const base = game()
    const jeune = buildDeckInstances(shereKhanCards, 'villain', 'j:').find((d) => d.cardId === 'jeune-et-sans-defense')!
    const loc = base.players[0].locations.find((l) => l.actions.some((a) => a.type === 'PLAY_CARD'))!
    const actionId = loc.actions.find((a) => a.type === 'PLAY_CARD')!.id
    // Royaume VIDE → la carte n'aurait aucun effet : le moteur refuse de la jouer.
    const empty: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: loc.id, power: 5, hand: [jeune] } : p)),
    }
    expect(() => applyAction(empty, { type: 'PLAY_CARD', actionId, instanceId: jeune.instanceId })).toThrow()
    // Avec un Allié dans le royaume → jouable (gagne 1 Pouvoir par Allié, sans Héros à déplacer).
    const ally = card('macaques', 'ally', { strength: 2, instanceId: 'a1' })
    const withAlly: GameState = {
      ...empty,
      players: empty.players.map((p, i) => (i === 0 ? { ...p, board: { [loc.id]: [ally] } } : p)),
    }
    expect(() => applyAction(withAlly, { type: 'PLAY_CARD', actionId, instanceId: jeune.instanceId })).not.toThrow()
  })

  it('C\'est très intéressant : choix multi-action (Pouvoir / piocher / Feu)', () => {
    const base = game()
    let s: GameState = { ...base, players: [{ ...base.players[0], power: 0 }] }
    s = resolveEffects(s, [{ type: 'INTERESSANT_CHOICE' }], { actorIndex: 0 })
    expect(s.pendingInteressant?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_INTERESSANT', option: 'power' })
    expect(s.players[0].power).toBe(1)
    expect(s.pendingInteressant?.done).toContain('power')
    // « power » déjà fait → choisir à nouveau « power » est sans effet (terminé en réalité).
    s = applyAction(s, { type: 'RESOLVE_INTERESSANT', done: true })
    expect(s.pendingInteressant).toBeFalsy()
  })

  it('Kaa (Activer) : choix interactif de l\'Objet de la défausse à jouer', () => {
    const base = game()
    const kaa = { ...buildDeckInstances(shereKhanCards, 'villain', 'k:').find((d) => d.cardId === 'kaa')!, instanceId: 'kaa1' }
    const obj = card('anneaux-de-kaa', 'item', { cost: 1, instanceId: 'o1' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], power: 3, pawnLocation: 'ruines-anciennes', board: { 'ruines-anciennes': [kaa] }, discard: [obj] }],
    }
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'kaa1' })
    expect(s.pendingKaaPlay?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_KAA_PLAY', instanceId: 'o1' })
    expect(s.pendingKaaPlay).toBeFalsy()
    expect(s.players[0].discard.some((c) => c.instanceId === 'o1')).toBe(false)
    const placed = (s.players[0].board['ruines-anciennes'] ?? []).find((c) => c.instanceId === 'o1')
    expect(placed?.attachedTo).toBe('kaa1')
    expect(s.players[0].power).toBe(2) // 3 − 1
  })

  it('Le Roi Singe (Activer) : choix du Macaque (auto si unique) puis du lieu', () => {
    const base = game()
    const lrs = { ...buildDeckInstances(shereKhanCards, 'villain', 'l:').find((d) => d.cardId === 'le-roi-singe')!, instanceId: 'lrs1' }
    const mac = card('macaques', 'ally', { instanceId: 'mac1' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], power: 3, pawnLocation: 'ruines-anciennes', board: { 'ruines-anciennes': [lrs, mac] } }],
    }
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'lrs1' })
    expect(s.pendingMonkeyKing?.macaqueInstanceId).toBe('mac1') // unique → pré-choisi
    s = applyAction(s, { type: 'RESOLVE_MONKEY_KING', to: 'riviere' })
    expect(s.pendingMonkeyKing).toBeFalsy()
    expect((s.players[0].board['riviere'] ?? []).some((c) => c.instanceId === 'mac1')).toBe(true)
  })

  it('Kaa (bouclier) : sacrifier un Objet préserve Kaa ; refuser le défausse', () => {
    const base = game()
    const hero = card('vautours', 'hero', { strength: 2, instanceId: 'h1' })
    const kaa = card('kaa', 'ally', { strength: 2, instanceId: 'kaa1' })
    const ring = card('anneaux-de-kaa', 'item', { instanceId: 'o1', attachedTo: 'kaa1', shieldAllyFromDiscard: true })
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { riviere: [hero, kaa, ring] } }] }
    // Sacrifier l'Objet : Kaa survit, l'Objet est défaussé.
    const keep = performVanquish(s0, 'h1', ['kaa1'], false, 'o1')
    expect(Object.values(keep.players[0].board).flat().some((c) => c.instanceId === 'kaa1')).toBe(true)
    expect(keep.players[0].discard.some((c) => c.instanceId === 'o1')).toBe(true)
    // Refuser (null) : Kaa est défaussé (avec son Objet).
    const drop = performVanquish(s0, 'h1', ['kaa1'], false, null)
    expect(Object.values(drop.players[0].board).flat().some((c) => c.instanceId === 'kaa1')).toBe(false)
    expect(drop.players[0].discard.some((c) => c.instanceId === 'kaa1')).toBe(true)
  })

  it('Kaa (bouclier) : un Vanquish avec Kaa porteur d\'Objet ouvre pendingKaaShield', () => {
    const base = game()
    const hero = card('vautours', 'hero', { strength: 2, instanceId: 'h1' })
    const kaa = card('kaa', 'ally', { strength: 2, instanceId: 'kaa1' })
    const ring = card('anneaux-de-kaa', 'item', { instanceId: 'o1', attachedTo: 'kaa1', shieldAllyFromDiscard: true })
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], pawnLocation: 'riviere', board: { riviere: [hero, kaa, ring] } }],
    }
    const out = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h1', allyInstanceIds: ['kaa1'] })
    expect(out.pendingKaaShield?.itemInstanceIds).toEqual(['o1'])
    // Le Vanquish n'est pas encore résolu (Héros toujours là).
    expect(Object.values(out.players[0].board).flat().some((c) => c.instanceId === 'h1')).toBe(true)
    const done = applyAction(out, { type: 'RESOLVE_KAA_SHIELD', itemInstanceId: 'o1' })
    expect(Object.values(done.players[0].board).flat().some((c) => c.instanceId === 'h1')).toBe(false) // Héros vaincu
    expect(Object.values(done.players[0].board).flat().some((c) => c.instanceId === 'kaa1')).toBe(true) // Kaa préservé
  })

  it('Anneaux de Kaa : déplacer Kaa propose de déplacer un Héros (départ → arrivée)', () => {
    const base = game()
    const hero = card('vautours', 'hero', { strength: 2, instanceId: 'h1' })
    const kaa = card('kaa', 'ally', { strength: 2, instanceId: 'kaa1' })
    const ring = card('anneaux-de-kaa', 'item', { instanceId: 'o1', attachedTo: 'kaa1' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], pawnLocation: 'rocher-conseil', board: { 'rocher-conseil': [kaa, ring, hero] } }],
    }
    s = applyAction(s, { type: 'MOVE_CARD', actionId: 'move', instanceId: 'kaa1', to: 'ruines-anciennes' })
    expect(s.pendingHeroRelocate?.forcedLocationId).toBe('ruines-anciennes')
    expect(s.pendingHeroRelocate?.candidateIds).toContain('h1')
  })
})

describe('Shere Khan — partie pilotée par le bot (anti-soft-lock)', () => {
  const seededRand = (seed: number): (() => number) => {
    let x = seed >>> 0
    return () => {
      x = (x * 1664525 + 1013904223) >>> 0
      return x / 0xffffffff
    }
  }
  it('le bot joue Shere Khan sans blocage ni exception sur plusieurs tours', () => {
    let s = createInitialGame(
      [
        { villain: shereKhan, deckCards: buildDeckInstances(shereKhanCards, 'villain', 'p0:'), fateCards: buildDeckInstances(shereKhanCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      42,
    )
    const rand = seededRand(123)
    let steps = 0
    while (s.status === 'PLAYING' && steps < 400) {
      const a = chooseAction(s, rand)
      s = applyAction(s, a)
      steps++
    }
    expect(s.turn).toBeGreaterThan(3)
  })
})

describe('Shere Khan — effets Fatalité de déplacement (auto, gênent Shere Khan)', () => {
  it('Vautours : éloignent Mowgli (+ les Vautours) vers le lieu sans Allié', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const vult = card('vautours', 'hero', { strength: 1, instanceId: 'v1' })
    const ally = card('macaques', 'ally', { strength: 2, instanceId: 'a1' })
    // Mowgli + Vautours + un Allié sur La Rivière ; les Ruines sont vides (sans Allié).
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { riviere: [mowgli, vult, ally] } }] }
    const s = resolveEffects(s0, [{ type: 'VULTURES_MOVE' }], { actorIndex: 0, hostLocationId: 'riviere', hostInstanceId: 'v1' })
    const riv = s.players[0].board['riviere'] ?? []
    expect(riv.some((c) => c.instanceId === 'm1')).toBe(false) // Mowgli parti
    expect(riv.some((c) => c.instanceId === 'a1')).toBe(true) // l'Allié reste
    // Mowgli ET les Vautours sont sur le MÊME lieu (un autre que La Rivière).
    const dest = s.players[0].locations.map((l) => l.id).find((id) => (s.players[0].board[id] ?? []).some((c) => c.instanceId === 'm1'))
    expect((s.players[0].board[dest!] ?? []).some((c) => c.instanceId === 'v1')).toBe(true)
  })

  it('Bagheera : disperse Héros et Alliés de son lieu (Mowgli n’est plus avec l’Allié)', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const a1 = card('macaques', 'ally', { strength: 2, instanceId: 'a1' })
    const a2 = card('macaques', 'ally', { strength: 2, instanceId: 'a2' })
    const bag = card('bagheera', 'hero', { strength: 3, instanceId: 'b1' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { riviere: [mowgli, a1, a2, bag] } }] }
    const s = resolveEffects(s0, [{ type: 'BAGHEERA_SCATTER' }], { actorIndex: 0, hostLocationId: 'riviere' })
    expect((s.players[0].board['riviere'] ?? []).length).toBe(0) // tout dispersé
    // Les 4 cartes sont réparties (au moins 2 lieux occupés).
    const occupied = s.players[0].locations.filter((l) => (s.players[0].board[l.id] ?? []).length > 0).length
    expect(occupied).toBeGreaterThanOrEqual(2)
  })

  it('Prendre le tigre par la queue : éloigne Mowgli des Alliés de Shere Khan', () => {
    const base = game()
    const mowgli = card('mowgli', 'hero', { strength: 2, instanceId: 'm1' })
    const ally = card('macaques', 'ally', { strength: 2, instanceId: 'a1' })
    // Mowgli avec l'Allié sur Le Rocher ; les autres lieux sans Allié.
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { 'rocher-conseil': [mowgli, ally] } }] }
    const s = resolveEffects(s0, [{ type: 'TIGER_BY_THE_TAIL' }], { actorIndex: 0 })
    expect((s.players[0].board['rocher-conseil'] ?? []).some((c) => c.instanceId === 'm1')).toBe(false)
    expect((s.players[0].board['rocher-conseil'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true)
  })

  it('La Patrouille de la Jungle : joue le dessus de la pioche Fatalité si c’est un Événement', () => {
    const base = game()
    const event = card('feu-rouge-des-hommes', 'effect', { effects: [{ type: 'GAIN_POWER', amount: 0 }] })
    const heroTop = card('mowgli', 'hero', { strength: 2 })
    // Cas Événement : il est joué (retiré de la pioche → défausse).
    const sEvent: GameState = { ...base, players: [{ ...base.players[0], fateDeck: [event], fateDiscard: [] }] }
    const r1 = resolveEffects(sEvent, [{ type: 'REVEAL_FATE_PLAY_IF_EVENT' }], { actorIndex: 0 })
    expect(r1.players[0].fateDeck.some((c) => c.instanceId === event.instanceId)).toBe(false)
    expect(r1.players[0].fateDiscard.some((c) => c.instanceId === event.instanceId)).toBe(true)
    // Cas Héros : laissé sur la pioche.
    const sHero: GameState = { ...base, players: [{ ...base.players[0], fateDeck: [heroTop], fateDiscard: [] }] }
    const r2 = resolveEffects(sHero, [{ type: 'REVEAL_FATE_PLAY_IF_EVENT' }], { actorIndex: 0 })
    expect(r2.players[0].fateDeck[0]?.instanceId).toBe(heroTop.instanceId)
  })
})
