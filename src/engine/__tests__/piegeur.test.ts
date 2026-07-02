// Le Piégeur (Dead by Daylight) — PHASE 1 (cœur). Vérifie le sous-système : placement des
// 4 Survivants FACE CACHÉE (1/lieu) + crochets au setup, couverture (face cachée ne couvre
// pas / révélé couvre), déplacement du pion ADJACENT seulement, fuite en fin de tour (loin
// du pion), perte de vie / élimination sur crochet, et l'objectif (éliminer les 4).
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { enumerateActions } from '../../ai/enumerate'
import { coveredTopActionIdsAt, getLegalMoves, hasReachedObjective, conditionIsTriggered } from '../rules'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState, PlayerState, VillainDef } from '../types'

const villainInstances = buildDeckInstances(facilierCards, 'villain', 'p1:')
const fateInstances = buildDeckInstances(facilierCards, 'fate', 'p1f:')

/** 4 lieux (loc-1..loc-4), chacun 2 actions du haut + 1 du bas — pour tester la couverture. */
const LOCS = [1, 2, 3, 4].map((k) => ({
  id: `loc-${k}`,
  name: `LIEU ${k}`,
  actions: [
    { id: `l${k}-gain`, type: 'GAIN_POWER' as const, label: 'Gagner', row: 'top' as const, amount: 1 },
    { id: `l${k}-play`, type: 'PLAY_CARD' as const, label: 'Jouer', row: 'top' as const },
    { id: `l${k}-fate`, type: 'FATE' as const, label: 'Fatalité', row: 'bottom' as const },
  ],
}))

const piegeurDef: VillainDef = {
  id: 'custom-le-piegeur',
  name: 'Le Piégeur',
  objective: { type: 'PIEGEUR_ELIMINATE_ALL_SURVIVORS' },
  objectiveDescription: 'Éliminer les 4 Survivants.',
  boardImage: '',
  pawnImage: '',
  pawnHeightPx: 56,
  backVillainImage: '',
  backFateImage: '',
  locations: LOCS,
}

/** Les 4 Survivants (paquet « Survivant », hors-deck) tels que produits par le bridge :
 *  type 'hero' + isSurvivor. Placés au setup par le moteur. */
const survivorNames = ['Claudette', 'Dwight', 'Meg', 'Jake']
const survivorInstances: CardInstance[] = survivorNames.map((name, i) => ({
  instanceId: `p0f:survivor-${i}`,
  cardId: `custom-le-piegeur-survivor-${i}`,
  name,
  type: 'hero',
  isSurvivor: true,
}))

/** Partie : joueur 0 = Le Piégeur (avec ses survivants en pioche Fatalité) ; joueur 1 =
 *  adversaire (facilier) pour un jeu à 2 valide. */
function piegeurGame(seed = 7): GameState {
  return createInitialGame(
    [
      { villain: piegeurDef, deckCards: [], fateCards: survivorInstances },
      { villain: facilier, deckCards: villainInstances, fateCards: fateInstances },
    ],
    seed,
  )
}

/** Tous les survivants du joueur 0, tous lieux confondus. */
const survivorsOf = (s: GameState) => Object.values(s.players[0].board).flat().filter((c) => c.isSurvivor)

describe('Le Piégeur — setup', () => {
  it('pose 1 Survivant FACE CACHÉE par lieu (sain, 3 vies) et un crochet sur chaque lieu', () => {
    const s = piegeurGame()
    const p = s.players[0]
    // 4 survivants placés, un par lieu, aucun restant en pile.
    expect(survivorsOf(s)).toHaveLength(4)
    for (const loc of LOCS) {
      const here = (p.board[loc.id] ?? []).filter((c) => c.isSurvivor)
      expect(here).toHaveLength(1)
      expect(here[0].revealed).toBe(false)
      expect(here[0].survivorState).toBe('healthy')
      expect(here[0].survivorLives).toBe(3)
    }
    expect(p.survivorPile ?? []).toHaveLength(0)
    // Un crochet présent sur chaque lieu ; la pioche Fatalité ne contient plus de survivant.
    for (const loc of LOCS) expect(p.hooks?.[loc.id]).toEqual({ present: true, disabledTurns: 0 })
    expect(p.fateDeck.some((c) => c.isSurvivor)).toBe(false)
  })
})

describe('Le Piégeur — couverture des actions', () => {
  it('un Survivant FACE CACHÉE ne recouvre AUCUNE action ; une fois révélé il recouvre la rangée du haut', () => {
    const s = piegeurGame()
    const loc = 'loc-1'
    // Face cachée : aucune action recouverte.
    expect(coveredTopActionIdsAt(s.players[0], loc).size).toBe(0)
    // Révélé : recouvre les 2 actions du haut.
    const revealed: GameState = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              board: {
                ...p.board,
                [loc]: (p.board[loc] ?? []).map((c) => (c.isSurvivor ? { ...c, revealed: true } : c)),
              },
            }
          : p,
      ),
    }
    expect([...coveredTopActionIdsAt(revealed.players[0], loc)].sort()).toEqual(['l1-gain', 'l1-play'])
  })
})

describe('Le Piégeur — déplacement adjacent seulement', () => {
  it('depuis loc-1, seul loc-2 est un déplacement légal (pas de saut de lieu)', () => {
    const s = piegeurGame()
    expect(getLegalMoves(s)).toEqual(['loc-2'])
  })
})

describe('Le Piégeur — objectif', () => {
  it('faux au départ (4 survivants) ; vrai quand il n’en reste aucun', () => {
    const s = piegeurGame()
    expect(hasReachedObjective(s, 0)).toBe(false)
    const cleared: GameState = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: Object.fromEntries(LOCS.map((l) => [l.id, []])), survivorPile: [] }
          : p,
      ),
    }
    expect(hasReachedObjective(cleared, 0)).toBe(true)
  })
})

describe('Le Piégeur — fin de tour', () => {
  it('les Survivants (non critiques, non accrochés) FUIENT vers un lieu voisin', () => {
    let s = piegeurGame()
    // Le pion se déplace loc-1 → loc-2 (adjacent), puis fin de tour.
    s = applyAction(s, { type: 'MOVE', to: 'loc-2' })
    s = applyAction(s, { type: 'END_TURN' })
    // Tous les survivants ont fui (répartition déterministe loin du pion en loc-2) :
    // loc-1 vidé, et le total reste 4 (aucune élimination).
    expect(survivorsOf(s)).toHaveLength(4)
    const count = (loc: string) => (s.players[0].board[loc] ?? []).filter((c) => c.isSurvivor).length
    expect(count('loc-1')).toBe(0)
    expect(count('loc-2') + count('loc-3') + count('loc-4')).toBe(4)
  })

  it('un Survivant accroché perd 1 vie en fin de tour du Piégeur ; à 0 vie il est éliminé et son crochet retiré', () => {
    let s = piegeurGame()
    // On accroche le survivant de loc-3 (critique, 1 vie restante, PAS accroché ce tour-ci).
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              board: {
                ...p.board,
                ['loc-3']: (p.board['loc-3'] ?? []).map((c) =>
                  c.isSurvivor
                    ? { ...c, revealed: true, survivorState: 'critical' as const, onHook: true, survivorLives: 1, hookedThisTurn: false }
                    : c,
                ),
              },
            }
          : p,
      ),
    }
    s = applyAction(s, { type: 'MOVE', to: 'loc-2' })
    s = applyAction(s, { type: 'END_TURN' })
    // Le survivant accroché est éliminé (3 restants) et le crochet de loc-3 est retiré.
    expect(survivorsOf(s)).toHaveLength(3)
    expect(s.players[0].hooks?.['loc-3'].present).toBe(false)
  })
})

// --- Lot 1a : boucle d'attaque (effets) -------------------------------------

/** Construit un Survivant contrôlé (pour des configs de test déterministes). */
function survivor(id: string, fields: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: id,
    cardId: `custom-le-piegeur-${id}`,
    name: id,
    type: 'hero',
    isSurvivor: true,
    revealed: false,
    survivorState: 'healthy',
    survivorLives: 3,
    ...fields,
  }
}

/** Partie Piégeur avec un plateau imposé (survivorPile vidée), pion sur `pawn` (loc-1 défaut). */
function gameWith(board: Record<string, CardInstance[]>, pawn = 'loc-1', extra: Partial<PlayerState> = {}): GameState {
  const s = piegeurGame()
  const full = { ...Object.fromEntries(LOCS.map((l) => [l.id, [] as CardInstance[]])), ...board }
  return {
    ...s,
    players: s.players.map((p, i) => (i === 0 ? { ...p, board: full, survivorPile: [], pawnLocation: pawn, ...extra } : p)),
  }
}

const locOf = (s: GameState, id: string) =>
  Object.entries(s.players[0].board).find(([, cards]) => cards.some((c) => c.instanceId === id))?.[0]
const findS = (s: GameState, id: string) => Object.values(s.players[0].board).flat().find((c) => c.instanceId === id)

describe('Le Piégeur — RÉVÉLER (Marque d’éraflure)', () => {
  it('révèle un Survivant du lieu du pion puis le déplace vers un voisin (2 étapes interactives)', () => {
    let s = gameWith({ 'loc-1': [survivor('a')] })
    s = resolveEffect(s, { type: 'PIEGEUR_REVEAL', atPawn: true, thenMove: true }, { actorIndex: 0 })
    expect(s.pendingPiegeur?.phase).toBe('target')
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    expect(findS(s, 'a')?.revealed).toBe(true)
    // Phase 'dest' ouverte : voisins de loc-1 = [loc-2].
    expect(s.pendingPiegeur?.phase).toBe('dest')
    expect(s.pendingPiegeur?.destLocs).toEqual(['loc-2'])
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_DEST', to: 'loc-2' })
    expect(s.pendingPiegeur ?? null).toBeNull()
    expect(locOf(s, 'a')).toBe('loc-2')
  })
})

describe('Le Piégeur — FORCE BRUTE (blesser / critique)', () => {
  it('sain → blessé + déplacement ; blessé → critique (immobile, pas de déplacement)', () => {
    let s = gameWith({ 'loc-1': [survivor('a', { revealed: true })] })
    s = resolveEffect(s, { type: 'PIEGEUR_INJURE' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    expect(findS(s, 'a')?.survivorState).toBe('injured')
    expect(s.pendingPiegeur?.phase).toBe('dest')
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_DEST', to: 'loc-2' })
    expect(locOf(s, 'a')).toBe('loc-2')
    // Re-blesser (déjà blessé) → critique, aucun déplacement (pending clos).
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'loc-2' } : p)) }
    s = resolveEffect(s, { type: 'PIEGEUR_INJURE' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    expect(findS(s, 'a')?.survivorState).toBe('critical')
    expect(s.pendingPiegeur ?? null).toBeNull()
  })

  it('avec PERSONNE N’ÉCHAPPE À LA MORT en jeu, un Survivant sain passe DIRECTEMENT en critique', () => {
    const personne: CardInstance = {
      instanceId: 'personne',
      cardId: 'custom-le-piegeur-personne-n-echappe-a-la-mort',
      name: 'Personne n’échappe',
      type: 'item',
    }
    let s = gameWith({ 'loc-1': [survivor('a', { revealed: true }), personne] })
    s = resolveEffect(s, { type: 'PIEGEUR_INJURE' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    expect(findS(s, 'a')?.survivorState).toBe('critical')
    expect(s.pendingPiegeur ?? null).toBeNull()
  })
})

describe('Le Piégeur — SANCTUAIRE (accrocher) & MEMENTO MORI (achever)', () => {
  it('accroche un Survivant critique du lieu du pion (−1 vie, hookedThisTurn)', () => {
    let s = gameWith({ 'loc-1': [survivor('a', { revealed: true, survivorState: 'critical' })] })
    s = resolveEffect(s, { type: 'PIEGEUR_HOOK' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    const a = findS(s, 'a')
    expect(a?.onHook).toBe(true)
    expect(a?.hookedThisTurn).toBe(true)
    expect(a?.survivorLives).toBe(2)
  })

  it('Memento Mori élimine le DERNIER Survivant (critique, 1 vie) → victoire', () => {
    let s = gameWith({ 'loc-1': [survivor('a', { revealed: true, survivorState: 'critical', survivorLives: 1 })] })
    s = resolveEffect(s, { type: 'PIEGEUR_FINISH' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })
})

describe('Le Piégeur — PUDDING & PIÈGE À OURS', () => {
  it('Pudding : +1 Pouvoir +1 par Survivant éliminé OU révélé', () => {
    // 2 survivants en jeu (donc 2 éliminés), l'un révélé → 1 + 2 + 1 = 4.
    let s = gameWith({ 'loc-1': [survivor('a', { revealed: true }), survivor('b')] }, 'loc-1', { power: 0 })
    s = resolveEffect(s, { type: 'PIEGEUR_PUDDING_POWER' }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(4)
  })

  it('un Survivant déplacé sur un lieu piégé perd un segment + est immobilisé (piège réutilisable)', () => {
    const trap: CardInstance = { instanceId: 'trap', cardId: 'custom-le-piegeur-piege-a-ours', name: 'Piège à ours', type: 'item' }
    let s = gameWith({ 'loc-1': [survivor('a')], 'loc-2': [trap] })
    s = resolveEffect(s, { type: 'PIEGEUR_MOVE_SURVIVOR' }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_DEST', to: 'loc-2' })
    const a = findS(s, 'a')
    expect(locOf(s, 'a')).toBe('loc-2')
    expect(a?.survivorState).toBe('injured')
    expect(a?.trapImmobilizedTurns).toBe(1)
    // Le piège reste en place (réutilisable).
    expect(s.players[0].board['loc-2'].some((c) => c.cardId === 'custom-le-piegeur-piege-a-ours')).toBe(true)
  })
})

describe('Le Piégeur — cartes Fatalité (lot 2)', () => {
  it('PALETTE bloque l’accès du Piégeur au lieu ; il peut payer 2 Pouvoir pour la défausser', () => {
    const palette: CardInstance = { instanceId: 'pal', cardId: 'custom-le-piegeur-palette', name: 'Palette', type: 'item' }
    let s = gameWith({ 'loc-1': [survivor('a')], 'loc-2': [palette] }, 'loc-1', { power: 2 })
    // loc-2 est le seul voisin de loc-1, mais il est bloqué par la Palette.
    expect(getLegalMoves(s)).toEqual([])
    // Le Piégeur paie 2 Pouvoir pour la défausser → loc-2 redevient accessible.
    s = applyAction(s, { type: 'DISCARD_PALETTE', instanceId: 'pal' })
    expect(s.players[0].power).toBe(0)
    expect(getLegalMoves(s)).toEqual(['loc-2'])
  })

  it('PURIFICATION défausse PERSONNE N’ÉCHAPPE À LA MORT du royaume', () => {
    const personne: CardInstance = {
      instanceId: 'personne',
      cardId: 'custom-le-piegeur-personne-n-echappe-a-la-mort',
      name: 'Personne n’échappe',
      type: 'item',
    }
    let s = gameWith({ 'loc-1': [survivor('a'), personne] })
    s = resolveEffect(s, { type: 'PIEGEUR_PURIFY' }, { actorIndex: 0 })
    expect(Object.values(s.players[0].board).flat().some((c) => c.cardId === 'custom-le-piegeur-personne-n-echappe-a-la-mort')).toBe(false)
    expect(s.players[0].discard.some((c) => c.cardId === 'custom-le-piegeur-personne-n-echappe-a-la-mort')).toBe(true)
  })

  it('ADRÉNALINE soigne un Survivant blessé et le fait fuir au plus loin du pion', () => {
    let s = gameWith({ 'loc-1': [survivor('a', { revealed: true, survivorState: 'injured' })] }, 'loc-1')
    s = resolveEffect(s, { type: 'PIEGEUR_ADRENALINE' }, { actorIndex: 0 })
    expect(findS(s, 'a')?.survivorState).toBe('healthy')
    expect(locOf(s, 'a')).toBe('loc-4')
  })
})

describe('Le Piégeur — FERMETURE DE LA TRAPPE (condition)', () => {
  it('se déclenche quand l’adversaire a joué un Événement de coût ≥ 2, pas en dessous', () => {
    const s = piegeurGame()
    const fermeture: CardInstance = {
      instanceId: 'ferm',
      cardId: 'custom-le-piegeur-fermeture-de-la-trappe',
      name: 'Fermeture de la trappe',
      type: 'condition',
      trigger: { type: 'opponent-played-event-cost-ge', value: 2 },
    }
    // Joueur 1 (adversaire) est l'actif ; le Piégeur (joueur 0) réagit.
    const active = { ...s, activePlayer: 1 }
    expect(conditionIsTriggered({ ...active, activePlayedEventMaxCost: 1 }, fermeture, 0)).toBe(false)
    expect(conditionIsTriggered({ ...active, activePlayedEventMaxCost: 2 }, fermeture, 0)).toBe(true)
  })
})

describe('Le Piégeur — le BOT sait résoudre pendingPiegeur (enumerate)', () => {
  it('phase target → une action RESOLVE_PIEGEUR_TARGET par candidat ; phase dest → une RESOLVE_PIEGEUR_DEST par lieu', () => {
    let s = gameWith({ 'loc-1': [survivor('a'), survivor('b')] })
    s = resolveEffect(s, { type: 'PIEGEUR_MOVE_SURVIVOR' }, { actorIndex: 0 })
    const targetActions = enumerateActions(s)
    expect(targetActions).toEqual([
      { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' },
      { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'b' },
    ])
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'a' })
    const destActions = enumerateActions(s)
    expect(destActions).toEqual([{ type: 'RESOLVE_PIEGEUR_DEST', to: 'loc-2' }])
  })
})

describe('Le Piégeur — effet « Lorsque révélé » (MEG fuit au plus loin)', () => {
  it('à la révélation, Meg est déplacée au lieu le plus loin du pion', () => {
    const meg = survivor('meg', { effects: [{ type: 'PIEGEUR_MEG_FLEE' }] })
    let s = gameWith({ 'loc-1': [meg] }, 'loc-1')
    s = resolveEffect(s, { type: 'PIEGEUR_REVEAL', atPawn: false, thenMove: false }, { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: 'meg' })
    expect(findS(s, 'meg')?.revealed).toBe(true)
    // Pion en loc-1 (index 0) → le plus loin = loc-4.
    expect(locOf(s, 'meg')).toBe('loc-4')
  })
})
