import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction, FREE_PLAY_NO_ACTION_ID, fateCardPlayable } from '../actions'
import {
  getAvailableActions,
  getLegalMoves,
  placementLocations,
  adjacentLocationIds,
  heroPlacementLocations,
  conditionIsTriggered,
  effectiveCost,
} from '../rules'
import {
  accessibleTrackIndices,
  accessibleActionIds,
  trackMoveRange,
  bugOnVanellope,
  startRace,
  advanceRacer,
  advanceRacerByReveal,
  moveKingCandyTrack,
  moveRacerBack,
} from '../kingCandy'
import { performVanquish, resolveEffects } from '../effects'
import { saSucrerie } from '../../data/villains/sa-sucrerie'
import { saSucrerieCards } from '../../data/villains/sa-sucrerie.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { chooseAction } from '../../ai/heuristicBot'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: saSucrerie,
        deckCards: buildDeckInstances(saSucrerieCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(saSucrerieCards, 'fate', 'p0f:'),
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

describe('Sa Sucrerie — mise en place du circuit', () => {
  it('le pion démarre à la case Départ/Arrivée (index 0), pas de course', () => {
    const p = game().players[0]
    expect(p.trackPos).toBe(0)
    expect(p.racerPos).toBeNull()
    expect(p.raceActive).toBe(false)
    expect(p.objective.type).toBe('KING_CANDY_RACE')
    // 5 lieux : le circuit (18 actions) + les 4 zones de pose (sans action).
    expect(p.locations).toHaveLength(5)
    expect(p.locations[0].id).toBe('sugar-rush')
    expect(p.locations[0].actions).toHaveLength(18)
    expect(p.locations.slice(1).map((l) => l.id)).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
    expect(p.locations.slice(1).every((l) => l.actions.length === 0)).toBe(true)
  })

  it('aucun déplacement de LIEU n’est légal (déplacement par MOVE_TRACK)', () => {
    expect(getLegalMoves(game())).toEqual([])
  })
})

describe('Sa Sucrerie — 4 zones de pose (cartes)', () => {
  it('on pose dans les 4 zones, jamais sur le circuit', () => {
    expect(placementLocations(game())).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
  })

  it('adjacence linéaire des zones (le circuit n’est jamais voisin d’une zone)', () => {
    const s = game()
    expect(adjacentLocationIds(s, 'zone-1')).toEqual(['zone-2'])
    expect([...adjacentLocationIds(s, 'zone-2')].sort()).toEqual(['zone-1', 'zone-3'])
    expect([...adjacentLocationIds(s, 'zone-3')].sort()).toEqual(['zone-2', 'zone-4'])
    expect(adjacentLocationIds(s, 'zone-4')).toEqual(['zone-3'])
    expect(adjacentLocationIds(s, 'zone-1')).not.toContain('sugar-rush')
  })

  it('un Héros de Fatalité ne peut se poser que dans une zone (pas le circuit)', () => {
    const hero = card('ralph-la-casse', 'hero', { strength: 6 })
    expect(heroPlacementLocations(game(), hero, 0)).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
  })
})

describe('Sa Sucrerie — accès aux 3 actions', () => {
  it('depuis la case 0, accède aux actions 17, 0, 1', () => {
    expect(accessibleTrackIndices(0)).toEqual([17, 0, 1])
  })
  it('depuis la case 5, accède aux actions 4, 5, 6', () => {
    expect(accessibleTrackIndices(5)).toEqual([4, 5, 6])
  })
  it('getAvailableActions est limité aux 3 cases accessibles', () => {
    const base = game()
    const s: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], trackPos: 5 }] }
    const ids = getAvailableActions(s).map((a) => a.id)
    // a4 = Gagner 3 Pouvoir, a5 = Jouer une carte, a6 = Défausser → tous accessibles ; a0 non.
    expect(ids).not.toContain('a0')
    for (const id of ids) expect(['a4', 'a5', 'a6']).toContain(id)
  })
})

describe('Sa Sucrerie — déplacement 1–4', () => {
  it('MOVE_TRACK avance le pion et passe en phase ACTION', () => {
    const s = applyAction(game(), { type: 'MOVE_TRACK', steps: 3 })
    expect(s.players[0].trackPos).toBe(3)
    expect(s.phase).toBe('ACTION')
  })
  it('un déplacement hors 1–4 est rejeté', () => {
    expect(() => applyAction(game(), { type: 'MOVE_TRACK', steps: 5 })).toThrow()
    expect(() => applyAction(game(), { type: 'MOVE_TRACK', steps: 0 })).toThrow()
  })
  it('Félix Fixe Jr. contraint le déplacement à 2–3', () => {
    const base = game()
    const felix = card('felix-fixe-jr', 'hero', { strength: 3 })
    const s: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { 'sugar-rush': [felix] } }],
    }
    expect(trackMoveRange(s.players[0])).toEqual({ min: 2, max: 3 })
    expect(() => applyAction(s, { type: 'MOVE_TRACK', steps: 1 })).toThrow()
    expect(applyAction(s, { type: 'MOVE_TRACK', steps: 2 }).players[0].trackPos).toBe(2)
  })
})

describe('Sa Sucrerie — course', () => {
  /** Pose Vanellope + un Bug associé sur le circuit. */
  const withBugOnVanellope = (base: GameState, patch: Partial<GameState['players'][number]> = {}): GameState => {
    const v = card('vanellope-von-schweetz', 'hero', { strength: 2 })
    const bug = card('bug', 'item', { attach: 'hero', attachedTo: v.instanceId })
    return {
      ...base,
      players: [{ ...base.players[0], board: { 'sugar-rush': [v, bug] }, ...patch }],
    }
  }

  it('détecte un Bug associé à Vanellope', () => {
    expect(bugOnVanellope(withBugOnVanellope(game()).players[0])).toBe(true)
    expect(bugOnVanellope(game().players[0])).toBe(false)
  })

  it('startRace place pion et jeton Pilote à Départ/Arrivée', () => {
    const s = startRace(withBugOnVanellope(game()), 0)
    expect(s.players[0].trackPos).toBe(0)
    expect(s.players[0].racerPos).toBe(0)
    expect(s.players[0].raceActive).toBe(true)
  })

  it('franchir Départ/Arrivée avec un Bug sur Vanellope = VICTOIRE', () => {
    let s = startRace(withBugOnVanellope(game()), 0)
    // pion à 15, le jeton Pilote loin derrière
    s = { ...s, players: [{ ...s.players[0], trackPos: 15, racerPos: 2 }] }
    s = moveKingCandyTrack(s, 0, 4) // 15 + 4 = 19 ≥ 18 → franchit
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('sans Bug sur Vanellope, franchir la ligne ne gagne pas', () => {
    let s = startRace(game(), 0) // pas de Vanellope/Bug
    s = { ...s, players: [{ ...s.players[0], trackPos: 16 }] }
    s = moveKingCandyTrack(s, 0, 4)
    expect(s.status).not.toBe('WON')
    expect(s.players[0].trackPos).toBe(2) // 20 % 18
  })

  it('le jeton Pilote qui franchit la ligne le premier ARRÊTE la course et rend les Bugs', () => {
    let s = startRace(withBugOnVanellope(game()), 0)
    s = { ...s, players: [{ ...s.players[0], racerPos: 16 }] }
    s = advanceRacer(s, 0, 4) // 16 + 4 = 20 ≥ 18 → le Pilote finit
    expect(s.players[0].raceActive).toBe(false)
    // le Bug est revenu en main, plus associé à Vanellope
    expect(bugOnVanellope(s.players[0])).toBe(false)
    expect(s.players[0].hand.some((c) => c.cardId === 'bug')).toBe(true)
  })

  it('moveRacerBack recule le jeton Pilote (borné à 0)', () => {
    let s = startRace(withBugOnVanellope(game()), 0)
    s = { ...s, players: [{ ...s.players[0], racerPos: 5 }] }
    expect(moveRacerBack(s, 0, 2).players[0].racerPos).toBe(3)
    expect(moveRacerBack(s, 0, 99).players[0].racerPos).toBe(0)
  })
})

describe('Sa Sucrerie — Cybug en Sucre (survit au Vanquish)', () => {
  // On tire l'instance du DECK réel : c'est le seul moyen de vérifier que la carte
  // déclare bien `survivesVanquishGain` (un fixture monté à la main masquerait l'oubli).
  const realCybug = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'cy:')
    const c = deck.find((d) => d.cardId === 'cybug-en-sucre')!
    return { ...c, instanceId: 'cybug1' }
  }

  it('la carte déclare survivesVanquishGain = 1 (sinon l’effet est mort)', () => {
    expect(realCybug().survivesVanquishGain).toBe(1)
  })

  it('en vainquant un Héros : pas défaussé, +1 Force, déplacement au choix ouvert', () => {
    const base = game()
    const cybug = realCybug()
    const hero = card('ralph-la-casse', 'hero', { strength: 2 })
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { 'zone-1': [hero, cybug] } }],
    }
    const s = performVanquish(s0, hero.instanceId, [cybug.instanceId], false)
    // Le Héros est éliminé (plus sur le plateau).
    const onBoard = Object.values(s.players[0].board).flat()
    expect(onBoard.some((c) => c.instanceId === hero.instanceId)).toBe(false)
    // Le Cybug RESTE en jeu (pas dans la défausse Méchant)…
    const survivor = onBoard.find((c) => c.instanceId === cybug.instanceId)
    expect(survivor).toBeDefined()
    expect(s.players[0].discard.some((c) => c.instanceId === cybug.instanceId)).toBe(false)
    // …gagne +1 Force cumulatif…
    expect(survivor!.permanentStrengthDelta).toBe(1)
    // …et ouvre un déplacement RESTREINT au Cybug, dont le LIEU est choisi par le joueur.
    expect(s.pendingAllyRelocate).not.toBeNull()
    expect(s.pendingAllyRelocate!.onlyInstanceIds).toEqual([cybug.instanceId])
    expect(s.pendingAllyRelocate!.targetIndex).toBe(0)
  })

  it('deux Vanquish successifs cumulent la Force (+1, puis +2)', () => {
    const base = game()
    const cybug = realCybug()
    const h1 = card('felix-fixe-jr', 'hero', { strength: 2 })
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { 'zone-1': [h1, cybug] } }],
    }
    const s1 = performVanquish(s0, h1.instanceId, [cybug.instanceId], false)
    const after1 = Object.values(s1.players[0].board).flat().find((c) => c.instanceId === cybug.instanceId)!
    expect(after1.permanentStrengthDelta).toBe(1)
    // 2ᵉ Vanquish (force désormais 2 + 1 = 3, suffit pour un Héros force 3).
    const h2 = card('sergent-calhoun', 'hero', { strength: 3 })
    const s2base: GameState = {
      ...s1,
      pendingAllyRelocate: null,
      players: [{ ...s1.players[0], board: { 'zone-1': [h2, after1] } }],
    }
    const s2 = performVanquish(s2base, h2.instanceId, [after1.instanceId], false)
    const after2 = Object.values(s2.players[0].board).flat().find((c) => c.instanceId === cybug.instanceId)!
    expect(after2.permanentStrengthDelta).toBe(2)
  })
})

describe('Sa Sucrerie — Pilotes (joués OU déplacés → 1 Pouvoir)', () => {
  const realPilotes = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'pi:')
    return { ...deck.find((d) => d.cardId === 'pilotes')!, instanceId: 'pil1' }
  }

  it('la carte porte effectsAlsoOnMove + GAIN_POWER 1', () => {
    const p = realPilotes()
    expect(p.effectsAlsoOnMove).toBe(true)
    expect(p.effects).toEqual([{ type: 'GAIN_POWER', amount: 1 }])
  })

  it('déplacer les Pilotes (a7) rapporte 1 Pouvoir', () => {
    const base = game()
    const pilotes = realPilotes()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 7, power: 0, board: { 'zone-1': [pilotes] } }],
    }
    // a7 = « Déplacer un Objet/Allié » (accessible depuis la case 7).
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'pil1', to: 'zone-2' })
    expect(s.players[0].power).toBe(1)
    expect((s.players[0].board['zone-2'] ?? []).some((c) => c.instanceId === 'pil1')).toBe(true)
  })
})

describe('Sa Sucrerie — Duncan et Wynnchel (joués OU déplacés → Vanquish facultatif)', () => {
  const realDuncan = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'du:')
    return { ...deck.find((d) => d.cardId === 'duncan-et-wynnchel')!, instanceId: 'dun1' }
  }

  it('la carte porte OPTIONAL_FREE_VANQUISH + effectsAlsoOnMove', () => {
    const d = realDuncan()
    expect(d.effects).toEqual([{ type: 'OPTIONAL_FREE_VANQUISH' }])
    expect(d.effectsAlsoOnMove).toBe(true)
  })

  it('déplacer Duncan vers un Héros ouvre une élimination facultative (source duncan)', () => {
    const base = game()
    const duncan = realDuncan()
    const hero = card('ralph-la-casse', 'hero', { strength: 2 })
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 7, board: { 'zone-1': [duncan], 'zone-2': [hero] } }],
    }
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'dun1', to: 'zone-2' })
    expect(s.pendingTrapVanquish).not.toBeNull()
    expect(s.pendingTrapVanquish!.source).toBe('duncan')
    // On peut alors éliminer Ralph (force 2) avec Duncan (force 3) sur zone-2.
    const s2 = applyAction(s, { type: 'TRAP_VANQUISH', heroInstanceId: hero.instanceId, allyInstanceIds: ['dun1'] })
    expect(Object.values(s2.players[0].board).flat().some((c) => c.instanceId === hero.instanceId)).toBe(false)
    expect(s2.pendingTrapVanquish).toBeNull()
  })

  it('sans Héros dans le royaume, aucun Vanquish facultatif ne s’ouvre', () => {
    const base = game()
    const duncan = realDuncan()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 7, board: { 'zone-1': [duncan] } }],
    }
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'dun1', to: 'zone-2' })
    expect(s.pendingTrapVanquish ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Taffyta Crème Brûlée (Pilote −2 OU Jouer une carte)', () => {
  const real = (cardId: string, inst: string): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'ta:')
    return { ...deck.find((d) => d.cardId === cardId)!, instanceId: inst }
  }

  it('la carte porte TAFFYTA_CHOICE + effectsAlsoOnMove', () => {
    const t = real('taffyta-creme-brulee', 'taf1')
    expect(t.effects).toEqual([{ type: 'TAFFYTA_CHOICE' }])
    expect(t.effectsAlsoOnMove).toBe(true)
  })

  // Pose Taffyta sur zone-1 + une carte abordable en main, pion sur la case « Déplacer » (a7).
  const setup = (patch: Partial<GameState['players'][number]>): GameState => {
    const base = game()
    const taffyta = real('taffyta-creme-brulee', 'taf1')
    const pilotes = real('pilotes', 'pil1')
    return {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 7, power: 5, hand: [pilotes], board: { 'zone-1': [taffyta] }, ...patch }],
    }
  }

  it('course active + carte jouable → choix interactif (pending)', () => {
    const s0 = setup({ raceActive: true, racerPos: 6 })
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'taf1', to: 'zone-2' })
    expect(s.pendingTaffytaChoice).not.toBeNull()
    expect(s.pendingTaffytaChoice!.playerIndex).toBe(0)
    // choix « reculer le Pilote de 2 »
    const sBack = applyAction(s, { type: 'RESOLVE_TAFFYTA_CHOICE', choice: 'racer-back' })
    expect(sBack.players[0].racerPos).toBe(4)
    expect(sBack.pendingTaffytaChoice ?? null).toBeNull()
    // choix « jouer une carte » → action gratuite armée
    const sPlay = applyAction(s, { type: 'RESOLVE_TAFFYTA_CHOICE', choice: 'play-card' })
    expect(sPlay.grantedAction?.actionType).toBe('PLAY_CARD')
  })

  it('hors course → pas de choix, action Jouer une carte gratuite armée directement', () => {
    const s0 = setup({ raceActive: false, racerPos: null })
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'taf1', to: 'zone-2' })
    expect(s.pendingTaffytaChoice ?? null).toBeNull()
    expect(s.grantedAction?.actionType).toBe('PLAY_CARD')
  })

  it('l’action Jouer une carte gratuite pose un Allié sans consommer le tour', () => {
    const s0 = setup({ raceActive: false, racerPos: null })
    const s1 = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'taf1', to: 'zone-2' })
    const powerBefore = s1.players[0].power
    const s2 = applyAction(s1, {
      type: 'PERFORM_GRANTED_ACTION',
      action: { type: 'PLAY_CARD', actionId: 'granted-free-action', instanceId: 'pil1', to: 'zone-3' },
    })
    // Pilotes est posé sur zone-3…
    expect((s2.players[0].board['zone-3'] ?? []).some((c) => c.cardId === 'pilotes')).toBe(true)
    // …en payant son coût (1) puis +1 Pouvoir de l'effet de Pilotes → net 0 ici.
    expect(s2.players[0].power).toBe(powerBefore - 1 + 1)
    expect(s2.grantedAction ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Quelques Dragées (révéler 5, garder ≤2 au choix)', () => {
  it('la carte révèle 5 et permet d’en garder jusqu’à 2', () => {
    const dragees = saSucrerieCards.find((c) => c.id === 'quelques-dragees')!
    expect(dragees.effects).toEqual([{ type: 'LOOK_TOP_DRAW_DISCARD', look: 5, take: 2, title: 'Quelques Dragées' }])
  })

  const five = (): CardInstance[] =>
    ['a', 'b', 'c', 'd', 'e'].map((id) => card(id, 'effect', { instanceId: id }))

  it('garder 2 cartes choisies : les autres sont défaussées', () => {
    const base = game()
    const s0: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], hand: [], deck: five(), discard: [] }] }
    const s1 = resolveEffects(s0, [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 5, take: 2, title: 'Quelques Dragées' }], { actorIndex: 0 })
    expect(s1.pendingLookTop?.cards.map((c) => c.instanceId)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(s1.pendingLookTop?.take).toBe(2)
    const s2 = applyAction(s1, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['a', 'c'] })
    expect(s2.players[0].hand.map((c) => c.instanceId).sort()).toEqual(['a', 'c'])
    expect(s2.players[0].discard.map((c) => c.instanceId).sort()).toEqual(['b', 'd', 'e'])
    expect(s2.pendingLookTop ?? null).toBeNull()
  })

  it('on peut en garder moins de 2 (0 ou 1)', () => {
    const base = game()
    const s0: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], hand: [], deck: five(), discard: [] }] }
    const s1 = resolveEffects(s0, [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 5, take: 2, title: 'Quelques Dragées' }], { actorIndex: 0 })
    const s2 = applyAction(s1, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['b'] })
    expect(s2.players[0].hand.map((c) => c.instanceId)).toEqual(['b'])
    expect(s2.players[0].discard.length).toBe(4)
  })

  it('choisir 3 cartes ne garde que les 2 premières (plafond)', () => {
    const base = game()
    const s0: GameState = { ...base, phase: 'ACTION', players: [{ ...base.players[0], hand: [], deck: five(), discard: [] }] }
    const s1 = resolveEffects(s0, [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 5, take: 2, title: 'Quelques Dragées' }], { actorIndex: 0 })
    const s2 = applyAction(s1, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: ['a', 'b', 'c'] })
    expect(s2.players[0].hand.length).toBe(2)
  })
})

describe('Sa Sucrerie — Turbo-Statique (jouable sans action Jouer une carte)', () => {
  const realTurbo = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'tb:')
    return { ...deck.find((d) => d.cardId === 'turbo-statique')!, instanceId: 'turbo1' }
  }

  it('la carte porte playableWithoutAction + KING_CANDY_TURBO', () => {
    const t = realTurbo()
    expect(t.playableWithoutAction).toBe(true)
    expect(t.effects).toEqual([{ type: 'KING_CANDY_TURBO' }])
  })

  it('jouée via la sentinelle : ne consomme aucune action et active le débridage', () => {
    const base = game()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{ ...base.players[0], trackPos: 5, hand: [realTurbo()] }],
    }
    const s = applyAction(s0, { type: 'PLAY_CARD', actionId: FREE_PLAY_NO_ACTION_ID, instanceId: 'turbo1' })
    expect(s.players[0].turboUncoverThisTurn).toBe(true)
    expect(s.players[0].hand.some((c) => c.instanceId === 'turbo1')).toBe(false)
    // aucune action de lieu consommée → on peut encore agir normalement ce tour
    expect(s.usedActionIds).toEqual([])
  })

  it('une carte ordinaire refuse l’actionId sentinelle', () => {
    const base = game()
    const pil = { ...buildDeckInstances(saSucrerieCards, 'villain', 'tb2:').find((d) => d.cardId === 'pilotes')!, instanceId: 'pil1' }
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{ ...base.players[0], hand: [pil] }],
    }
    expect(() => applyAction(s0, { type: 'PLAY_CARD', actionId: FREE_PLAY_NO_ACTION_ID, instanceId: 'pil1' })).toThrow()
  })
})

describe('Sa Sucrerie — Étincelles / Médaille de Vanellope (Fatalité)', () => {
  it('Étincelles : défausse un Bug ; s’il en reste un, le Pilote avance de 3', () => {
    const c = saSucrerieCards.find((d) => d.id === 'cest-quoi-toutes-ces-etincelles-magiques')!
    expect(c.effects).toEqual([{ type: 'KING_CANDY_SPARKLES' }])
    const base = game()
    const v = card('vanellope-von-schweetz', 'hero', { strength: 2, instanceId: 'vlope' })
    const b1 = card('bug', 'item', { attach: 'hero', attachedTo: 'vlope', instanceId: 'b1' })
    const b2 = card('bug', 'item', { attach: 'hero', attachedTo: 'vlope', instanceId: 'b2' })
    // 2 Bugs → après défausse d'un, il en reste 1 → Pilote +3
    const s2bugs: GameState = { ...base, players: [{ ...base.players[0], raceActive: true, racerPos: 4, board: { 'zone-1': [v, b1, b2] } }] }
    const r2 = resolveEffects(s2bugs, [{ type: 'KING_CANDY_SPARKLES' }], { actorIndex: 0 })
    expect(r2.players[0].racerPos).toBe(7) // 4 + 3
    expect(r2.players[0].discard.filter((c) => c.cardId === 'bug').length).toBe(1)
    // 1 Bug → après défausse, 0 restant → pas d'avance
    const s1bug: GameState = { ...base, players: [{ ...base.players[0], raceActive: true, racerPos: 4, board: { 'zone-1': [v, b1] } }] }
    const r1 = resolveEffects(s1bug, [{ type: 'KING_CANDY_SPARKLES' }], { actorIndex: 0 })
    expect(r1.players[0].racerPos).toBe(4)
  })

  it('Médaille : rejoue un Héros de la défausse Fatalité au lieu choisi, +1 Force', () => {
    const c = saSucrerieCards.find((d) => d.id === 'medaille-de-vanellope')!
    expect(c.effects).toEqual([{ type: 'MEDAL_PLAY_FATE_HERO' }])
    const base = game()
    const faceup = { ...buildDeckInstances(saSucrerieCards, 'fate', 'm:').find((d) => d.cardId === 'medaille-de-vanellope')!, instanceId: 'med1' }
    const hero = card('felix-fixe-jr', 'hero', { strength: 3, instanceId: 'h1' })
    const noHero: GameState = { ...base, players: [{ ...base.players[0], fateDiscard: [] }] }
    const withHero: GameState = { ...base, players: [{ ...base.players[0], fateDiscard: [hero] }] }
    expect(fateCardPlayable(noHero, faceup, 0)).toBe(false)
    expect(fateCardPlayable(withHero, faceup, 0)).toBe(true)
    // flux : choisir le Héros puis le lieu
    const s1 = resolveEffects(withHero, [{ type: 'MEDAL_PLAY_FATE_HERO' }], { actorIndex: 0 })
    expect(s1.pendingMedal?.kind).toBe('pick-hero')
    const s2 = applyAction(s1, { type: 'RESOLVE_MEDAL', heroInstanceId: 'h1' })
    expect(s2.pendingMedal?.kind).toBe('pick-location')
    expect(s2.pendingMedal!.locationIds).toContain('zone-1')
    const s3 = applyAction(s2, { type: 'RESOLVE_MEDAL', locationId: 'zone-1' })
    const placed = (s3.players[0].board['zone-1'] ?? []).find((c) => c.instanceId === 'h1')
    expect(placed).toBeDefined()
    expect(placed!.permanentStrengthDelta).toBe(1)
    expect(s3.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(false)
  })
})

describe('Sa Sucrerie — Le Faisceau (Fatalité)', () => {
  const cyb = (id: string): CardInstance => card('cybug-en-sucre', 'ally', { strength: 2, instanceId: id })

  it('porte BEACON_GATHER_CYBUGS et est injouable sans Cybug', () => {
    const c = saSucrerieCards.find((d) => d.id === 'le-faisceau')!
    expect(c.effects).toEqual([{ type: 'BEACON_GATHER_CYBUGS' }])
    const base = game()
    const faisceau = { ...buildDeckInstances(saSucrerieCards, 'fate', 'f:').find((d) => d.cardId === 'le-faisceau')!, instanceId: 'fb1' }
    const noCybug: GameState = { ...base, players: [{ ...base.players[0], board: {} }] }
    const withCybug: GameState = { ...base, players: [{ ...base.players[0], board: { 'zone-1': [cyb('c1')] } }] }
    expect(fateCardPlayable(noCybug, faisceau, 0)).toBe(false)
    expect(fateCardPlayable(withCybug, faisceau, 0)).toBe(true)
  })

  it('rassemble les Cybugs voisins sur le lieu choisi, puis défausse au choix', () => {
    const base = game()
    const s0: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { 'zone-1': [cyb('c1')], 'zone-3': [cyb('c3')] } }],
    }
    const s1 = resolveEffects(s0, [{ type: 'BEACON_GATHER_CYBUGS' }], { actorIndex: 0 })
    expect(s1.pendingBeacon?.kind).toBe('pick-location')
    // zone-2 est valable (ses voisins z1 et z3 portent un Cybug)
    expect(s1.pendingBeacon!.locationIds).toContain('zone-2')
    const s2 = applyAction(s1, { type: 'RESOLVE_BEACON', locationId: 'zone-2' })
    // c1 et c3 sont rassemblés sur zone-2
    expect((s2.players[0].board['zone-2'] ?? []).map((c) => c.instanceId).sort()).toEqual(['c1', 'c3'])
    expect(s2.pendingBeacon?.kind).toBe('discard')
    // on défausse c1
    const s3 = applyAction(s2, { type: 'RESOLVE_BEACON', cybugInstanceId: 'c1' })
    expect(s3.players[0].discard.some((c) => c.instanceId === 'c1')).toBe(true)
    expect((s3.players[0].board['zone-2'] ?? []).some((c) => c.instanceId === 'c1')).toBe(false)
    expect(s3.pendingBeacon ?? null).toBeNull()
  })

  it('on peut ne rien défausser (skip)', () => {
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { 'zone-1': [cyb('c1')] } }] }
    const s1 = resolveEffects(s0, [{ type: 'BEACON_GATHER_CYBUGS' }], { actorIndex: 0 })
    const s2 = applyAction(s1, { type: 'RESOLVE_BEACON', locationId: 'zone-1' })
    const s3 = applyAction(s2, { type: 'RESOLVE_BEACON', skip: true })
    expect(s3.players[0].discard.length).toBe(0)
    expect(s3.pendingBeacon ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Niveau Inachevé / Juste quelques Éguimauves (Fatalité)', () => {
  it('Niveau Inachevé : dévoile 4 → 2 dessus, 2 dessous dans l’ordre choisi', () => {
    const c = saSucrerieCards.find((d) => d.id === 'niveau-inacheve')!
    expect(c.effects).toEqual([{ type: 'NIVEAU_INACHEVE' }])
    const base = game()
    const deck = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => card(id, 'effect', { instanceId: id }))
    const s0: GameState = { ...base, players: [{ ...base.players[0], deck }] }
    const s1 = resolveEffects(s0, [{ type: 'NIVEAU_INACHEVE' }], { actorIndex: 0 })
    expect(s1.pendingFateReorder?.deck).toBe('villain-split2')
    expect(s1.pendingFateReorder!.cards.map((c) => c.instanceId)).toEqual(['a', 'b', 'c', 'd'])
    // ordre choisi : b,a sur le dessus ; d,c sous la pioche ; e,f restent au milieu
    const s2 = applyAction(s1, { type: 'RESOLVE_FATE_REORDER', orderedIds: ['b', 'a', 'd', 'c'] })
    expect(s2.players[0].deck.map((c) => c.instanceId)).toEqual(['b', 'a', 'e', 'f', 'd', 'c'])
  })

  it('Juste quelques Éguimauves : Sa Sucrerie défausse 2 cartes au choix', () => {
    const c = saSucrerieCards.find((d) => d.id === 'juste-quelques-eguimauves')!
    expect(c.effects).toEqual([{ type: 'TARGET_DISCARD_CHOICE', count: 2, label: 'Juste quelques Éguimauves' }])
    const base = game()
    const hand = ['h1', 'h2', 'h3'].map((id) => card(id, 'effect', { instanceId: id }))
    const s0: GameState = { ...base, players: [{ ...base.players[0], hand }] }
    const s = resolveEffects(s0, [{ type: 'TARGET_DISCARD_CHOICE', count: 2, label: 'Juste quelques Éguimauves' }], { actorIndex: 0 })
    expect(s.pendingTyrannyDiscard?.count).toBe(2)
    expect(s.pendingTyrannyDiscard?.playerIndex).toBe(0)
  })
})

describe('Sa Sucrerie — Enfin un vrai Kart ! / Princesse Vanellope (Fatalité)', () => {
  it('Enfin un vrai Kart ! : bonus +1 (et non +2)', () => {
    const c = saSucrerieCards.find((d) => d.id === 'enfin-un-vrai-kart')!
    expect(c.effects).toEqual([{ type: 'KING_CANDY_ADVANCE_RACER_BY_REVEAL', bonus: 1 }])
  })

  it('Enfin un vrai Kart ! est injouable hors course (pas de jeton Pilote)', () => {
    const base = game()
    const kart = { ...buildDeckInstances(saSucrerieCards, 'fate', 'k:').find((d) => d.cardId === 'enfin-un-vrai-kart')!, instanceId: 'k1' }
    const noRace: GameState = { ...base, players: [{ ...base.players[0], raceActive: false, racerPos: null }] }
    const racing: GameState = { ...base, players: [{ ...base.players[0], raceActive: true, racerPos: 3 }] }
    expect(fateCardPlayable(noRace, kart, 0)).toBe(false)
    expect(fateCardPlayable(racing, kart, 0)).toBe(true)
  })

  it('Enfin un vrai Kart ! avance le Pilote de (coût dévoilé + 1)', () => {
    const base = game()
    const top = card('x', 'effect', { cost: 2, instanceId: 'top1' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], raceActive: true, racerPos: 1, deck: [top, card('y', 'effect', { instanceId: 'y1' })] }] }
    const s = advanceRacerByReveal(s0, 0, 1)
    expect(s.players[0].racerPos).toBe(4) // 1 + (2 + 1)
  })

  it('Princesse Vanellope : ouvre le choix de recul (0..min(4, trackPos))', () => {
    const c = saSucrerieCards.find((d) => d.id === 'princesse-vanellope')!
    expect(c.effects).toEqual([{ type: 'KING_CANDY_PAWN_BACK_CHOICE', max: 4 }])
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], trackPos: 6 }] }
    const s = resolveEffects(s0, [{ type: 'KING_CANDY_PAWN_BACK_CHOICE', max: 4 }], { actorIndex: 0 })
    expect(s.pendingPawnBack?.max).toBe(4)
    // recule de 3 → trackPos 3
    expect(applyAction(s, { type: 'RESOLVE_PAWN_BACK', amount: 3 }).players[0].trackPos).toBe(3)
    // choisir 0 → pas de recul
    expect(applyAction(s, { type: 'RESOLVE_PAWN_BACK', amount: 0 }).players[0].trackPos).toBe(6)
  })

  it('Princesse Vanellope : borné par trackPos, et no-op si pion à Départ/Arrivée', () => {
    const base = game()
    const s2: GameState = { ...base, players: [{ ...base.players[0], trackPos: 2 }] }
    expect(resolveEffects(s2, [{ type: 'KING_CANDY_PAWN_BACK_CHOICE', max: 4 }], { actorIndex: 0 }).pendingPawnBack?.max).toBe(2)
    const s0: GameState = { ...base, players: [{ ...base.players[0], trackPos: 0 }] }
    expect(resolveEffects(s0, [{ type: 'KING_CANDY_PAWN_BACK_CHOICE', max: 4 }], { actorIndex: 0 }).pendingPawnBack ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Ralph la Casse / Vanellope / Félix (Fatalité)', () => {
  it('Ralph : déplace Vanellope (onPlace) + l’action Déplacer coûte 1 Pouvoir', () => {
    const c = saSucrerieCards.find((d) => d.id === 'ralph-la-casse')!
    expect(c.onPlace).toEqual([{ type: 'RELOCATE_FATE_TARGET_HERO', heroCardId: 'vanellope-von-schweetz' }])
    expect(c.moveActionSurcharge).toBe(1)
  })

  it('Ralph : déplacer un Allié coûte 1 Pouvoir (et est refusé sans Pouvoir)', () => {
    const base = game()
    const ralph = card('ralph-la-casse', 'hero', { strength: 6, instanceId: 'r1', moveActionSurcharge: 1 })
    const ally = card('pilotes', 'ally', { strength: 1, instanceId: 'a1' })
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], power: 2, trackPos: 7, board: { 'zone-1': [ralph, ally], 'zone-2': [] } }],
    }
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'a1', to: 'zone-2' })
    expect(s.players[0].power).toBe(1) // 2 − 1
    expect((s.players[0].board['zone-2'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true)
    // sans Pouvoir : refusé
    const broke: GameState = { ...s0, players: [{ ...s0.players[0], power: 0 }] }
    expect(() => applyAction(broke, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'a1', to: 'zone-2' })).toThrow()
  })

  it('Félix : déplace Vanellope (onPlace) ; la contrainte 2–3 reste gérée par trackMoveRange', () => {
    const c = saSucrerieCards.find((d) => d.id === 'felix-fixe-jr')!
    expect(c.onPlace).toEqual([{ type: 'RELOCATE_FATE_TARGET_HERO', heroCardId: 'vanellope-von-schweetz' }])
  })

  it('Vanellope : au début du tour avec un Bug, le Pilote avance de (coût dévoilé + 2)', () => {
    const base = game()
    const top = card('quelques-dragees', 'effect', { cost: 1, instanceId: 'top1' })
    const other = card('go', 'effect', { cost: 1, instanceId: 'o1' })
    const s0: GameState = {
      ...base,
      players: [{ ...base.players[0], raceActive: true, racerPos: 3, deck: [top, other] }],
    }
    const s = advanceRacerByReveal(s0, 0)
    expect(s.players[0].racerPos).toBe(6) // 3 + (1 + 2)
    // la carte dévoilée passe SOUS la pioche
    expect(s.players[0].deck[s.players[0].deck.length - 1].instanceId).toBe('top1')
    expect(s.players[0].deck[0].instanceId).toBe('o1')
  })
})

describe('Sa Sucrerie — Sergent Calhoun (Fatalité)', () => {
  it('porte le déplacement de Vanellope (onPlace) + surcoût de jeu +1', () => {
    const c = saSucrerieCards.find((d) => d.id === 'sergent-calhoun')!
    expect(c.onPlace).toEqual([{ type: 'RELOCATE_FATE_TARGET_HERO', heroCardId: 'vanellope-von-schweetz' }])
    expect(c.playCardCostSurcharge).toBe(1)
  })

  it('tant qu’il est dans le royaume, toute carte coûte 1 de plus', () => {
    const base = game()
    const calhoun = card('sergent-calhoun', 'hero', { strength: 4, instanceId: 'cal1', playCardCostSurcharge: 1 })
    const someCard = card('pilotes', 'ally', { cost: 1, instanceId: 'x1' })
    const without: GameState = { ...base, players: [{ ...base.players[0], board: {} }] }
    const withCal: GameState = { ...base, players: [{ ...base.players[0], board: { 'zone-1': [calhoun] } }] }
    expect(effectiveCost(without, someCard)).toBe(1)
    expect(effectiveCost(withCal, someCard)).toBe(2)
  })

  it('onPlace : ouvre le déplacement facultatif de Vanellope (au lieu de son choix)', () => {
    const base = game()
    const vlope = card('vanellope-von-schweetz', 'hero', { strength: 2, instanceId: 'vlope' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], board: { 'zone-1': [vlope] } }] }
    const s = resolveEffects(s0, [{ type: 'RELOCATE_FATE_TARGET_HERO', heroCardId: 'vanellope-von-schweetz' }], { actorIndex: 0 })
    expect(s.pendingHeroRelocate?.candidateIds).toEqual(['vlope'])
    expect(s.pendingHeroRelocate?.anyLocation).toBe(true)
    expect(s.pendingHeroRelocate?.optional).toBe(true)
  })

  it('onPlace sans Vanellope dans le royaume : aucun effet', () => {
    const base = game()
    const s = resolveEffects(base, [{ type: 'RELOCATE_FATE_TARGET_HERO', heroCardId: 'vanellope-von-schweetz' }], { actorIndex: 0 })
    expect(s.pendingHeroRelocate ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Le plus puissant Virus (Condition : avancer de 2)', () => {
  const realVirus = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'lv:')
    return { ...deck.find((d) => d.cardId === 'le-plus-puissant-virus')!, instanceId: 'lv1' }
  }

  it('la carte porte le déclencheur « déplacement d’Allié/Objet » + avance de 2', () => {
    const c = saSucrerieCards.find((d) => d.id === 'le-plus-puissant-virus')!
    expect(c.trigger).toEqual({ type: 'opponent-moved-card' })
    expect(c.effects).toEqual([{ type: 'KING_CANDY_MOVE_TRACK', steps: 2 }])
  })

  it('déclenchée seulement si l’adversaire a déplacé une carte ce tour', () => {
    const base = game()
    expect(conditionIsTriggered({ ...base, activeMovedCard: true }, realVirus(), 0)).toBe(true)
    expect(conditionIsTriggered({ ...base, activeMovedCard: false }, realVirus(), 0)).toBe(false)
  })

  it('l’effet avance le pion de 2 cases', () => {
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], trackPos: 3 }] }
    const s = resolveEffects(s0, [{ type: 'KING_CANDY_MOVE_TRACK', steps: 2 }], { actorIndex: 0 })
    expect(s.players[0].trackPos).toBe(5)
  })
})

describe('Sa Sucrerie — Hors Service (Condition : récupérer en défausse)', () => {
  it('la carte porte le déclencheur (gain ≥2) et la récupération en défausse', () => {
    const c = saSucrerieCards.find((d) => d.id === 'hors-service')!
    expect(c.trigger).toEqual({ type: 'opponent-gained-power-ge', value: 2 })
    expect(c.effects).toEqual([
      { type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['ally', 'item', 'effect', 'condition'], label: 'Hors Service' },
    ])
  })

  it('l’effet ouvre le choix d’une carte de la défausse à reprendre en main', () => {
    const base = game()
    const d1 = card('go', 'effect', { instanceId: 'd1' })
    const d2 = card('pilotes', 'ally', { instanceId: 'd2' })
    const s0: GameState = { ...base, players: [{ ...base.players[0], discard: [d1, d2] }] }
    const s = resolveEffects(s0, [{ type: 'RECOVER_FROM_DISCARD_CHOICE', types: ['ally', 'item', 'effect', 'condition'], label: 'Hors Service' }], { actorIndex: 0 })
    expect(s.pendingRecover?.candidateIds.sort()).toEqual(['d1', 'd2'])
  })

  it('défausse vide : la Condition n’est pas déclenchable', () => {
    const base = game()
    const hors = { ...buildDeckInstances(saSucrerieCards, 'villain', 'hs:').find((d) => d.cardId === 'hors-service')!, instanceId: 'hs1' }
    const s0: GameState = { ...base, players: [{ ...base.players[0], discard: [] }] }
    // sans carte récupérable en défausse → non déclenchable (garde-fou conditionIsTriggered)
    expect(conditionIsTriggered(s0, hors, 0)).toBe(false)
  })
})

describe('Sa Sucrerie — Il lui est défendu de courir', () => {
  it('la carte porte RACE_BAN', () => {
    const c = saSucrerieCards.find((d) => d.id === 'il-lui-est-defendu-de-courir')!
    expect(c.effects).toEqual([{ type: 'RACE_BAN' }])
  })

  it('recule le Pilote de 3 et ouvre le déplacement d’Alliés (chaîné au Vanquish)', () => {
    const base = game()
    const ally = card('pilotes', 'ally', { strength: 2, instanceId: 'a1' })
    const hero = card('felix-fixe-jr', 'hero', { strength: 2, instanceId: 'h1' })
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], raceActive: true, racerPos: 5, board: { 'zone-1': [ally], 'zone-2': [hero] } }],
    }
    const s = resolveEffects(s0, [{ type: 'RACE_BAN' }], { actorIndex: 0 })
    expect(s.players[0].racerPos).toBe(2) // 5 − 3
    expect(s.pendingAllyRelocate?.thenRaceBanVanquish).toBe(true)
    expect(s.pendingAllyRelocate?.optional).toBe(true)
  })

  it('déplacement → Vanquish gardant les Alliés (non défaussés)', () => {
    const base = game()
    const ally = card('pilotes', 'ally', { strength: 2, instanceId: 'a1' })
    const hero = card('felix-fixe-jr', 'hero', { strength: 2, instanceId: 'h1' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], raceActive: false, racerPos: null, board: { 'zone-1': [ally], 'zone-2': [hero] } }],
    }
    s = resolveEffects(s, [{ type: 'RACE_BAN' }], { actorIndex: 0 })
    // déplace l'Allié sur le lieu du Héros (zone-2) → la fenêtre se ferme et ouvre le Vanquish
    s = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'a1', to: 'zone-2' })
    expect(s.pendingTrapVanquish?.source).toBe('race-ban')
    // élimine le Héros avec l'Allié → Héros parti, Allié CONSERVÉ (non défaussé)
    s = applyAction(s, { type: 'TRAP_VANQUISH', heroInstanceId: 'h1', allyInstanceIds: ['a1'] })
    const onBoard = Object.values(s.players[0].board).flat()
    expect(onBoard.some((c) => c.instanceId === 'h1')).toBe(false)
    expect(onBoard.some((c) => c.instanceId === 'a1')).toBe(true)
    expect(s.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(false)
  })

  it('sans Allié ni Héros mais course active : recule seulement le Pilote', () => {
    const base = game()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], raceActive: true, racerPos: 4, board: {} }],
    }
    const s = resolveEffects(s0, [{ type: 'RACE_BAN' }], { actorIndex: 0 })
    expect(s.players[0].racerPos).toBe(1)
    expect(s.pendingAllyRelocate ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — L\'important, c\'est de payer', () => {
  const realPay = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'pr:')
    return { ...deck.find((d) => d.cardId === 'limportant-cest-de-payer')!, instanceId: 'pay1' }
  }

  it('la carte est jouable sans action, seulement avant les actions, + PAY_TO_RACE', () => {
    const c = realPay()
    expect(c.playableWithoutAction).toBe(true)
    expect(c.playableOnlyBeforeActions).toBe(true)
    expect(c.effects).toEqual([{ type: 'PAY_TO_RACE' }])
  })

  it('jouée avec 10 Pouvoir : choix 1 à 6 ; dépenser 4 avance le pion de 4', () => {
    const base = game()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{ ...base.players[0], power: 10, trackPos: 2, hand: [realPay()] }],
    }
    const s1 = applyAction(s0, { type: 'PLAY_CARD', actionId: FREE_PLAY_NO_ACTION_ID, instanceId: 'pay1' })
    expect(s1.pendingPayRace?.max).toBe(6) // plafonné à 6
    const s2 = applyAction(s1, { type: 'RESOLVE_PAY_RACE', amount: 4 })
    expect(s2.players[0].power).toBe(6) // 10 − 4
    expect(s2.players[0].trackPos).toBe(6) // 2 + 4
    expect(s2.pendingPayRace ?? null).toBeNull()
  })

  it('le max est borné par le Pouvoir disponible', () => {
    const base = game()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: [{ ...base.players[0], power: 3, trackPos: 0, hand: [realPay()] }],
    }
    const s1 = applyAction(s0, { type: 'PLAY_CARD', actionId: FREE_PLAY_NO_ACTION_ID, instanceId: 'pay1' })
    expect(s1.pendingPayRace?.max).toBe(3)
  })

  it('injouable après avoir effectué une action de lieu (throw)', () => {
    const base = game()
    const s0: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: ['a9'], // une action de lieu déjà jouée ce tour
      players: [{ ...base.players[0], power: 5, hand: [realPay()] }],
    }
    expect(() => applyAction(s0, { type: 'PLAY_CARD', actionId: FREE_PLAY_NO_ACTION_ID, instanceId: 'pay1' })).toThrow()
  })

  it('sans Pouvoir : l\'effet n\'ouvre aucun choix', () => {
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], power: 0 }] }
    const s = resolveEffects(s0, [{ type: 'PAY_TO_RACE' }], { actorIndex: 0 })
    expect(s.pendingPayRace ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Mémoire Verrouillée (3 Pouvoir OU reculer Pilote 2)', () => {
  const memo = { type: 'POWER_OR_RACER_BACK', power: 3, racerBack: 2 } as const

  it('course active (Pilote > 0) → choix interactif', () => {
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], power: 0, raceActive: true, racerPos: 5 }] }
    const s = resolveEffects(s0, [memo], { actorIndex: 0 })
    expect(s.pendingPowerOrRacerBack).not.toBeNull()
    expect(s.pendingPowerOrRacerBack!.power).toBe(3)
    expect(s.pendingPowerOrRacerBack!.racerBack).toBe(2)
    // choix Pouvoir
    expect(applyAction(s, { type: 'RESOLVE_POWER_OR_RACER_BACK', choice: 'power' }).players[0].power).toBe(3)
    // choix reculer le Pilote
    expect(applyAction(s, { type: 'RESOLVE_POWER_OR_RACER_BACK', choice: 'racer' }).players[0].racerPos).toBe(3)
  })

  it('hors course → gain de 3 Pouvoir directement (pas de choix)', () => {
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], power: 0, raceActive: false, racerPos: null }] }
    const s = resolveEffects(s0, [memo], { actorIndex: 0 })
    expect(s.pendingPowerOrRacerBack ?? null).toBeNull()
    expect(s.players[0].power).toBe(3)
  })

  it('course active mais Pilote sur Départ/Arrivée (0) → gain de 3 (reculer = sans effet)', () => {
    const base = game()
    const s0: GameState = { ...base, players: [{ ...base.players[0], power: 0, raceActive: true, racerPos: 0 }] }
    const s = resolveEffects(s0, [memo], { actorIndex: 0 })
    expect(s.pendingPowerOrRacerBack ?? null).toBeNull()
    expect(s.players[0].power).toBe(3)
  })
})

describe('Sa Sucrerie — Go ! (déplacer jusqu’à 2 Alliés n’importe où)', () => {
  it('la carte ouvre un déplacement de 2 Alliés, facultatif', () => {
    const base = game()
    const a1 = card('pilotes', 'ally', { strength: 1, instanceId: 'a1' })
    const a2 = card('pilotes', 'ally', { strength: 1, instanceId: 'a2' })
    const a3 = card('pilotes', 'ally', { strength: 1, instanceId: 'a3' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { 'zone-1': [a1, a2], 'zone-2': [a3] } }],
    }
    s = resolveEffects(s, [{ type: 'RELOCATE_ALLIES', count: 2, title: 'Go !' }], { actorIndex: 0 })
    expect(s.pendingAllyRelocate?.remaining).toBe(2)
    expect(s.pendingAllyRelocate?.optional).toBe(true)
    // a1 → zone-4 (non voisin : n'importe quel lieu autorisé) ; fenêtre reste ouverte
    s = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'a1', to: 'zone-4' })
    expect((s.players[0].board['zone-4'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true)
    expect(s.pendingAllyRelocate?.remaining).toBe(1)
    // 2ᵉ déplacement → la fenêtre se ferme
    s = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'a3', to: 'zone-1' })
    expect(s.pendingAllyRelocate ?? null).toBeNull()
    expect((s.players[0].board['zone-1'] ?? []).some((c) => c.instanceId === 'a3')).toBe(true)
  })

  it('on peut s’arrêter après un seul déplacement (facultatif)', () => {
    const base = game()
    const a1 = card('pilotes', 'ally', { strength: 1, instanceId: 'a1' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { 'zone-1': [a1] } }],
    }
    s = resolveEffects(s, [{ type: 'RELOCATE_ALLIES', count: 2, title: 'Go !' }], { actorIndex: 0 })
    s = applyAction(s, { type: 'SKIP_ALLY_RELOCATE' })
    expect(s.pendingAllyRelocate ?? null).toBeNull()
  })

  it('sans Allié dans le royaume : aucun déplacement (no-op)', () => {
    const base = game()
    const s = resolveEffects(base, [{ type: 'RELOCATE_ALLIES', count: 2, title: 'Go !' }], { actorIndex: 0 })
    expect(s.pendingAllyRelocate ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — Médaillon des Héros de Ralph', () => {
  const realMedal = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'md:')
    return { ...deck.find((d) => d.cardId === 'medaillon-des-heros-de-ralph')!, instanceId: 'medal1' }
  }

  it('la carte porte MEDAILLON_FETCH_RALPH', () => {
    expect(realMedal().effects).toEqual([{ type: 'MEDAILLON_FETCH_RALPH' }])
  })

  it('à la pose : Ralph arrive sur le lieu et le Médaillon lui est associé', () => {
    const base = game()
    const ralph = card('ralph-la-casse', 'hero', { strength: 1, instanceId: 'ralph' })
    const vlope = card('vanellope-von-schweetz', 'hero', { strength: 2, instanceId: 'vlope' })
    const s0: GameState = {
      ...base,
      players: [{ ...base.players[0], board: { 'zone-1': [realMedal()] }, fateDeck: [ralph, vlope] }],
    }
    const s = resolveEffects(s0, [{ type: 'MEDAILLON_FETCH_RALPH' }], {
      actorIndex: 0,
      hostLocationId: 'zone-1',
      hostInstanceId: 'medal1',
    })
    const zone1 = s.players[0].board['zone-1'] ?? []
    expect(zone1.some((c) => c.instanceId === 'ralph')).toBe(true)
    expect(zone1.find((c) => c.instanceId === 'medal1')?.attachedTo).toBe('ralph')
    expect(s.players[0].fateDeck.some((c) => c.cardId === 'ralph-la-casse')).toBe(false)
  })

  it('Ralph éliminé → Vanellope arrive sur ce lieu (onVanquish)', () => {
    const base = game()
    const ralph = card('ralph-la-casse', 'hero', { strength: 1, instanceId: 'ralph' })
    const vlope = card('vanellope-von-schweetz', 'hero', { strength: 2, instanceId: 'vlope' })
    const ally = card('pilotes', 'ally', { strength: 1, instanceId: 'a1' })
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], board: { 'zone-1': [realMedal(), ally] }, fateDeck: [ralph, vlope] }],
    }
    s = resolveEffects(s, [{ type: 'MEDAILLON_FETCH_RALPH' }], { actorIndex: 0, hostLocationId: 'zone-1', hostInstanceId: 'medal1' })
    // On élimine Ralph (force 1) avec l'Allié 'a1' (force 1) → Vanellope arrive sur zone-1.
    s = performVanquish(s, 'ralph', ['a1'], false)
    const zone1 = s.players[0].board['zone-1'] ?? []
    expect(zone1.some((c) => c.instanceId === 'ralph')).toBe(false)
    expect(zone1.some((c) => c.cardId === 'vanellope-von-schweetz')).toBe(true)
  })
})

describe('Sa Sucrerie — Bug (1ᵉʳ = départ course, suivant = pion + Pilote +2)', () => {
  const withBugs = (n: number, patch: Partial<GameState['players'][number]> = {}): GameState => {
    const base = game()
    const v = card('vanellope-von-schweetz', 'hero', { strength: 2, instanceId: 'vanellope' })
    const bugs = Array.from({ length: n }, (_, i) =>
      card('bug', 'item', { attach: 'hero', attachedTo: 'vanellope', instanceId: `bug${i}` }),
    )
    return { ...base, players: [{ ...base.players[0], board: { 'zone-1': [v, ...bugs] }, ...patch }] }
  }

  it('1ᵉʳ Bug : lance la course (pion + Pilote sur Départ/Arrivée)', () => {
    const s0 = withBugs(1, { raceActive: false, racerPos: null })
    const s = resolveEffects(s0, [{ type: 'KING_CANDY_PLAY_BUG' }], { actorIndex: 0 })
    expect(s.players[0].raceActive).toBe(true)
    expect(s.players[0].trackPos).toBe(0)
    expect(s.players[0].racerPos).toBe(0)
  })

  it('Bug suivant (déjà associé) : pion ET jeton Pilote avancent de 2', () => {
    const s0 = withBugs(2, { raceActive: true, trackPos: 5, racerPos: 3 })
    const s = resolveEffects(s0, [{ type: 'KING_CANDY_PLAY_BUG' }], { actorIndex: 0 })
    expect(s.players[0].trackPos).toBe(7)
    expect(s.players[0].racerPos).toBe(5)
    expect(s.players[0].raceActive).toBe(true) // la course ne redémarre pas
  })
})

describe('Sa Sucrerie — Aigre Bill (fouille facultative + réordonnancement)', () => {
  const realBill = (): CardInstance => {
    const deck = buildDeckInstances(saSucrerieCards, 'villain', 'ab:')
    return { ...deck.find((d) => d.cardId === 'aigre-bill')!, instanceId: 'bill1' }
  }

  it('la carte porte AIGRE_BILL_DIG + effectsAlsoOnMove', () => {
    const b = realBill()
    expect(b.effects).toEqual([{ type: 'AIGRE_BILL_DIG' }])
    expect(b.effectsAlsoOnMove).toBe(true)
  })

  // Aigre Bill sur zone-1, pion sur la case « Déplacer » (a7), pioche contrôlée.
  const setup = (deckCards: CardInstance[]): GameState => {
    const base = game()
    return {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 7, board: { 'zone-1': [realBill()] }, deck: deckCards, discard: [] }],
    }
  }

  const dc = (cardId: string, type: CardInstance['type']): CardInstance => card(cardId, type, { instanceId: cardId })

  it('déplacer Aigre Bill (pioche avec Allié) ouvre le choix de fouille', () => {
    const deckCards = [dc('go', 'effect'), dc('memoire', 'effect'), dc('pil', 'ally'), dc('x', 'effect')]
    const s0 = setup(deckCards)
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'bill1', to: 'zone-2' })
    expect(s.pendingAigreBill).not.toBeNull()
    expect(s.pendingAigreBill!.playerIndex).toBe(0)
  })

  it('fouiller : 1er Allié en main, autres cartes dévoilées à réordonner sur le dessus', () => {
    const deckCards = [dc('go', 'effect'), dc('memoire', 'effect'), dc('pil', 'ally'), dc('x', 'effect')]
    const s0 = setup(deckCards)
    const s1 = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'bill1', to: 'zone-2' })
    const s2 = applyAction(s1, { type: 'RESOLVE_AIGRE_BILL', dig: true })
    // l'Allié 'pil' est en main
    expect(s2.players[0].hand.some((c) => c.instanceId === 'pil')).toBe(true)
    // réorganisation du dessus de la pioche Méchant ouverte avec les 2 autres dévoilées
    expect(s2.pendingFateReorder?.deck).toBe('villain')
    expect(s2.pendingFateReorder!.cards.map((c) => c.instanceId).sort()).toEqual(['go', 'memoire'])
    // on choisit l'ordre : 'memoire' au-dessus, puis 'go', puis le reste ('x')
    const s3 = applyAction(s2, { type: 'RESOLVE_FATE_REORDER', orderedIds: ['memoire', 'go'] })
    expect(s3.players[0].deck.map((c) => c.instanceId)).toEqual(['memoire', 'go', 'x'])
    expect(s3.pendingFateReorder ?? null).toBeNull()
  })

  it('renoncer : la pioche et la main sont inchangées', () => {
    const deckCards = [dc('go', 'effect'), dc('pil', 'ally')]
    const s0 = setup(deckCards)
    const handBefore = s0.players[0].hand.length
    const s1 = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'bill1', to: 'zone-2' })
    const s2 = applyAction(s1, { type: 'RESOLVE_AIGRE_BILL', dig: false })
    expect(s2.players[0].deck.map((c) => c.instanceId)).toEqual(['go', 'pil'])
    expect(s2.players[0].hand.length).toBe(handBefore)
    expect(s2.pendingAigreBill ?? null).toBeNull()
  })

  it('pioche sans aucun Allié → aucun choix de fouille', () => {
    const deckCards = [dc('go', 'effect'), dc('x', 'effect')]
    const s0 = setup(deckCards)
    const s = applyAction(s0, { type: 'MOVE_CARD', actionId: 'a7', instanceId: 'bill1', to: 'zone-2' })
    expect(s.pendingAigreBill ?? null).toBeNull()
  })
})

describe('Sa Sucrerie — partie pilotée par le bot (anti-soft-lock)', () => {
  const seededRand = (seed: number): (() => number) => {
    let x = seed >>> 0
    return () => {
      x = (x * 1664525 + 1013904223) >>> 0
      return x / 0xffffffff
    }
  }
  it('le bot enchaîne MOVE_TRACK → actions → fin de tour sans blocage', () => {
    let s = createInitialGame(
      [
        { villain: saSucrerie, deckCards: buildDeckInstances(saSucrerieCards, 'villain', 'p0:'), fateCards: buildDeckInstances(saSucrerieCards, 'fate', 'p0f:') },
        { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
      ],
      42,
    )
    const rand = seededRand(123)
    let steps = 0
    let kingCandyMoved = false
    while (s.status === 'PLAYING' && steps < 400) {
      const a = chooseAction(s, rand)
      if (a.type === 'MOVE_TRACK') kingCandyMoved = true
      s = applyAction(s, a)
      steps++
    }
    // Le bot a bien utilisé le déplacement de circuit au moins une fois.
    expect(kingCandyMoved).toBe(true)
    // La partie a progressé (plusieurs tours), sans exception ni blocage.
    expect(s.turn).toBeGreaterThan(3)
  })

  it('Turbo-Statique rend les 3 actions accessibles même recouvertes par le jeton Pilote', () => {
    const base = game()
    // jeton Pilote sur l'action 1 (a1) ; pion en 0 → a1 accessible mais recouvert
    let s: GameState = {
      ...base,
      phase: 'ACTION',
      players: [{ ...base.players[0], trackPos: 0, racerPos: 1, raceActive: true }],
    }
    expect(getAvailableActions(s).map((a) => a.id)).not.toContain('a1')
    s = { ...s, players: [{ ...s.players[0], turboUncoverThisTurn: true }] }
    expect(accessibleActionIds(s.players[0]).has('a1')).toBe(true)
    expect(getAvailableActions(s).map((a) => a.id)).toContain('a1')
  })
})
