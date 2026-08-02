// =============================================================================
// Michael Myers — pilotage du bot CHASSEUR.
//
// Régression d'une partie perdue au tour 40 : le bot n'avait éliminé qu'UN Héros
// (Mal Intérieur bloqué à 2), défaussait ASSASSINER / GARDONS LE MEILLEUR faute de
// les trouver jouables sur l'instant, et passait des tours entiers sans rien faire —
// faire venir une victime était un coup NEUTRE pour l'évaluation, alors que c'est
// son seul carburant.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { objectiveCriticalCardIds, enumerateActions } from '../enumerate'
import { objectiveScore, evaluate, trimHandAction } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState, VillainDef, LocationId } from '../../engine/types'

const LAURIE = 'laurie'

function mkLoc(id: string, locked?: boolean) {
  return {
    id,
    name: id,
    lockedAtStart: locked,
    actions: [
      { id: 'play', type: 'PLAY_CARD' as const, row: 'bottom' as const, label: 'Jouer une carte' },
      { id: 'act', type: 'ACTIVATE' as const, row: 'top' as const, label: 'Activer une capacité' },
    ],
  }
}

const michael: VillainDef = {
  id: 'custom-michael-meyers',
  name: 'Michael',
  objective: { type: 'DEFEAT_NAMED_HERO', heroCardId: LAURIE },
  boardObjective: 'Éliminer LAURIE.',
  objectiveDescription: 'Éliminer LAURIE.',
  boardImage: '',
  pawnImage: '',
  pawnHeightPx: 72,
  backVillainImage: '',
  backFateImage: '',
  lockedLocationsAtStart: ['demeure'],
  locations: [mkLoc('psy'), mkLoc('haddonfield'), mkLoc('maison'), mkLoc('demeure', true)],
}

const weapon: CardInstance = {
  instanceId: 'tuyau#1', cardId: 'tuyau', name: 'Tuyau', type: 'effect', cost: 2,
  isWeapon: true, weaponOnKill: [{ type: 'GAIN_POWER', amount: 2 }],
}
const assassiner: CardInstance = {
  instanceId: 'assassiner#1', cardId: 'assassiner', name: 'Assassiner', type: 'effect', cost: 2,
  costEqualsWeaponCost: true, costVariable: true, effects: [{ type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }],
}
const gardons: CardInstance = {
  instanceId: 'gardons#1', cardId: 'gardons', name: 'Gardons le meilleur', type: 'effect', cost: 3,
  requiresMalInterieur: 3, effects: [{ type: 'MICHAEL_KEEP_BEST', locationId: 'demeure' as LocationId }],
}
const nourriture: CardInstance = {
  instanceId: 'nourriture#1', cardId: 'nourriture', name: 'Jouez avec la nourriture', type: 'effect', cost: 2,
  effects: [{ type: 'REVEAL_FATE_UNTIL_HERO_CHOICE', mustPlay: true }],
}
const armeCrime: CardInstance = {
  instanceId: 'armecrime#1', cardId: 'armecrime', name: 'Arme du crime', type: 'effect', cost: 1,
  effects: [{ type: 'MICHAEL_FETCH_WEAPON_FROM_DECK' }],
}
/** Carte quelconque, sans valeur stratégique (la 1ʳᵉ à défausser). */
const filler = (n: number): CardInstance => ({
  instanceId: `filler#${n}`, cardId: 'trophee', name: 'Trophée', type: 'effect', cost: 0,
})

const victim = (n: number): CardInstance => ({
  instanceId: `victim#${n}`, cardId: 'victim', name: 'Victime', type: 'hero', strength: 2,
})
const laurie: CardInstance = {
  instanceId: 'laurie#1', cardId: LAURIE, name: 'Laurie Strode', type: 'hero', strength: 4,
  forcedFateLocation: 'demeure' as LocationId, assassinateSurchargePerOtherHero: 2,
}

/** Partie Michael (joueur 0) contre Prince Jean (joueur 1). */
function game(patch: Partial<PlayerState> = {}): GameState {
  const base = createInitialGame(
    [
      { villain: michael, deckCards: [assassiner, gardons, nourriture, armeCrime, weapon].map((c) => ({ ...c })), fateCards: [{ ...laurie }, victim(1)] },
      {
        villain: { ...princeJohn, name: 'PJ' },
        deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'),
        fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:'),
      },
    ],
    7,
  )
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'haddonfield', ...patch } : p)),
  }
}

const p0 = (s: GameState) => s.players[0]

describe('Michael Myers — cartes-clés jamais défaussées', () => {
  it('protège ASSASSINER, GARDONS et l’invocation de victimes', () => {
    const keep = objectiveCriticalCardIds(p0(game()))
    expect(keep.has('assassiner')).toBe(true) // injouable sans Héros sur place, mais c'est la victoire
    expect(keep.has('gardons')).toBe(true) // exemplaire unique, déverrouille la Demeure
    expect(keep.has('nourriture')).toBe(true) // carburant du Mal Intérieur
    expect(keep.has('tuyau')).toBe(true) // aucune Arme équipée
    expect(keep.has('armecrime')).toBe(true) // va chercher une Arme
    expect(keep.has('trophee')).toBe(false)
  })

  it('une fois l’Arme équipée, les cartes d’Arme redeviennent défaussables', () => {
    const keep = objectiveCriticalCardIds(p0(game({ equippedWeapon: { ...weapon } })))
    expect(keep.has('tuyau')).toBe(false)
    expect(keep.has('armecrime')).toBe(false)
    expect(keep.has('assassiner')).toBe(true) // toujours protégée
  })

  it('au Mal Intérieur 3, l’invocation de victimes n’est plus protégée (elle renchérit le coup final)', () => {
    const keep = objectiveCriticalCardIds(p0(game({ malInterieur: 3 })))
    expect(keep.has('nourriture')).toBe(false)
    expect(keep.has('gardons')).toBe(true)
  })

  it('l’excédent de main jette le remplissage, jamais ASSASSINER', () => {
    const hand = [assassiner, filler(1), filler(2), filler(3), filler(4), filler(5)]
    const s = game({ hand: hand.map((c) => ({ ...c })) })
    const trim = trimHandAction(s, 0)
    expect(trim?.type).toBe('DISCARD_HAND_CARDS')
    const ids = (trim as { instanceIds: string[] }).instanceIds
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).not.toContain('assassiner#1')
  })
})

describe('Michael Myers — les Héros de son royaume sont du CARBURANT', () => {
  it('la jauge MONTE quand une victime est dans le royaume (palier suivant à portée)', () => {
    const empty = objectiveScore(p0(game({ malInterieur: 2, equippedWeapon: { ...weapon } })))
    const withPrey = objectiveScore(
      p0(game({ malInterieur: 2, equippedWeapon: { ...weapon }, board: { haddonfield: [victim(1)] } })),
    )
    expect(withPrey).toBeGreaterThan(empty)
  })

  it('la jauge ne bouge plus au palier maximal (une victime de plus ne sert pas la montée)', () => {
    const a = objectiveScore(p0(game({ malInterieur: 3, equippedWeapon: { ...weapon } })))
    const b = objectiveScore(
      p0(game({ malInterieur: 3, equippedWeapon: { ...weapon }, board: { haddonfield: [victim(1)] } })),
    )
    expect(b).toBe(a)
  })

  it('l’évaluation ne pénalise PAS un Héros chez Michael (faire venir une victime est un gain)', () => {
    const before = evaluate(game({ malInterieur: 2, equippedWeapon: { ...weapon } }), 0)
    const after = evaluate(
      game({ malInterieur: 2, equippedWeapon: { ...weapon }, board: { haddonfield: [victim(1)] } }),
      0,
    )
    expect(after).toBeGreaterThan(before)
  })

  it('le pion préfère le lieu où se trouve la victime (bonus de chasse)', () => {
    const board = { haddonfield: [victim(1)] }
    const onPrey = evaluate(game({ malInterieur: 2, equippedWeapon: { ...weapon }, board, pawnLocation: 'haddonfield' }), 0)
    const elsewhere = evaluate(game({ malInterieur: 2, equippedWeapon: { ...weapon }, board, pawnLocation: 'psy' }), 0)
    expect(onPrey).toBeGreaterThan(elsewhere)
  })

  it('le choix d’Arme (Arme du crime) est ÉNUMÉRÉ : la recherche voit la ligne « s’équiper »', () => {
    // Régression : sans cette énumération, la ligne « jouer Arme du crime » butait sur un
    // choix non résolu et s'évaluait SANS l'Arme → le bot ne s'armait jamais et restait
    // des dizaines de tours sans pouvoir assassiner qui que ce soit.
    const s = game({ power: 5, deck: [{ ...weapon }] })
    const withPending: GameState = { ...s, pendingWeaponFetch: { playerIndex: 0, candidateIds: [weapon.instanceId] } }
    const acts = enumerateActions(withPending)
    expect(acts.every((a) => a.type === 'RESOLVE_WEAPON_FETCH')).toBe(true)
    expect(acts.some((a) => a.type === 'RESOLVE_WEAPON_FETCH' && a.equip === true)).toBe(true)
    expect(acts.some((a) => a.type === 'RESOLVE_WEAPON_FETCH' && !a.equip)).toBe(true)
  })

  it('sans le Pouvoir requis, seule l’option « prendre en main » est proposée', () => {
    const s = game({ power: 0, deck: [{ ...weapon }] })
    const acts = enumerateActions({ ...s, pendingWeaponFetch: { playerIndex: 0, candidateIds: [weapon.instanceId] } })
    expect(acts.some((a) => a.type === 'RESOLVE_WEAPON_FETCH' && a.equip === true)).toBe(false)
    expect(acts).toHaveLength(1)
  })

  it('LAURIE injoignable (Demeure verrouillée) : la jauge reste plafonnée mais valorise une autre victime', () => {
    const locked = { lockedLocations: ['demeure'], malInterieur: 2, equippedWeapon: { ...weapon } }
    const alone = objectiveScore(p0(game({ ...locked, board: { demeure: [{ ...laurie }] } })))
    const withPrey = objectiveScore(p0(game({ ...locked, board: { demeure: [{ ...laurie }], haddonfield: [victim(1)] } })))
    expect(withPrey).toBeGreaterThan(alone)
    expect(withPrey).toBeLessThanOrEqual(0.65)
  })
})
