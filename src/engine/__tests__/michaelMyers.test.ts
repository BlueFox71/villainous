import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { applyAction } from '../actions'
import { createInitialGame, handLimitFor } from '../state'
import { effectiveCost } from '../rules'
import { enumerateActions } from '../../ai/enumerate'
import type { CardInstance, GameState, VillainDef, LocationId } from '../types'

// --- Fixtures ---------------------------------------------------------------

const LAURIE = 'laurie'

function mkLoc(id: string, extra: { locked?: boolean } = {}) {
  return {
    id,
    name: id,
    lockedAtStart: extra.locked,
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
  locations: [mkLoc('psy'), mkLoc('haddonfield'), mkLoc('maison'), mkLoc('demeure', { locked: true })],
}

// Cartes Vilain (deck)
function weapon(cardId: string, cost: number, onKill: CardInstance['weaponOnKill']): CardInstance {
  return { instanceId: `${cardId}#1`, cardId, name: cardId, type: 'effect', cost, isWeapon: true, weaponOnKill: onKill }
}
const villainCards: CardInstance[] = [
  weapon('tuyau', 2, [{ type: 'GAIN_POWER', amount: 2 }]),
  weapon('couteau', 3, [{ type: 'GRANT_EXTRA_TURN' }]),
  { instanceId: 'assassiner#1', cardId: 'assassiner', name: 'Assassiner', type: 'effect', cost: 2, costEqualsWeaponCost: true, costVariable: true, effects: [{ type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }] },
  { instanceId: 'gardons#1', cardId: 'gardons', name: 'Gardons le meilleur', type: 'effect', cost: 3, requiresMalInterieur: 3, effects: [{ type: 'MICHAEL_KEEP_BEST', locationId: 'demeure' as LocationId }] },
  { instanceId: 'trophee#1', cardId: 'trophee', name: 'Trophée', type: 'effect', cost: 0, effects: [{ type: 'GAIN_POWER_PER_MAL_INTERIEUR', base: 1 }] },
  { instanceId: 'trace#1', cardId: 'trace', name: 'Trace de sang', type: 'item', cost: 0, activatedCost: 0, activatedEffects: [{ type: 'BLOOD_TRACE', power: 2 }] },
  { instanceId: 'armecrime#1', cardId: 'armecrime', name: 'Arme du crime', type: 'effect', cost: 1, effects: [{ type: 'MICHAEL_FETCH_WEAPON_FROM_DECK' }] },
]

// Cartes Fatalité
const fateCards: CardInstance[] = [
  { instanceId: 'laurie#1', cardId: LAURIE, name: 'Laurie Strode', type: 'hero', strength: 4, forcedFateLocation: 'demeure' as LocationId, assassinateSurchargePerOtherHero: 2 },
  { instanceId: 'victim#1', cardId: 'victim', name: 'Victime', type: 'hero', strength: 2 },
  { instanceId: 'victim#2', cardId: 'victim', name: 'Victime', type: 'hero', strength: 2 },
  { instanceId: 'jaime#1', cardId: 'jaime', name: 'Jaime', type: 'hero', strength: 1, disablesEquippedWeapon: true },
  { instanceId: 'souvenir#1', cardId: 'souvenir', name: 'Souvenir', type: 'effect', effects: [{ type: 'LOSE_POWER_PER_MAL_INTERIEUR', base: 1 }] },
]

function game(): GameState {
  return createInitialGame([{ villain: michael, deckCards: villainCards.map((c) => ({ ...c })), fateCards: fateCards.map((c) => ({ ...c })) }], 7)
}

/** État en phase ACTION, pion sur `pawn`, avec un patch sur le joueur actif. */
function setup(pawn: string, patch: Partial<GameState['players'][number]> = {}): GameState {
  const base = game()
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: pawn, usedActionIds: [], ...patch } : p)),
    usedActionIds: [],
  }
}

// --- Tests ------------------------------------------------------------------

describe('Michael Myers — mise en place', () => {
  it('démarre en Mal Intérieur 1, sans Arme ; LAURIE est dans la pioche Fatalité', () => {
    const s = game()
    const p = s.players[0]
    expect(p.malInterieur).toBe(1)
    expect(p.equippedWeapon).toBeNull()
    expect(p.fateDeck.some((c) => c.cardId === LAURIE)).toBe(true)
    expect((p.reserveHeroes ?? []).some((c) => c.cardId === LAURIE)).toBe(false)
    expect((p.lockedLocations ?? []).includes('demeure')).toBe(true)
  })

  it('LAURIE révélée par Jouez avec la nourriture est posée d’office sur la Demeure', () => {
    // Jouez avec la nourriture (REVEAL_FATE_UNTIL_HERO_CHOICE) : si le Héros révélé est LAURIE,
    // elle va d’office sur la Demeure (forcedFateLocation), sans choix de lieu.
    const base = game()
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p, i) =>
        i === 0
          ? { ...p, pawnLocation: 'psy', fateDeck: [{ ...fateCards[0] }], fateDiscard: [] }
          : p,
      ),
    }
    const next = resolveEffect(s, { type: 'REVEAL_FATE_UNTIL_HERO_CHOICE', mustPlay: true }, { actorIndex: 0 })
    expect((next.players[0].board.demeure ?? []).some((c) => c.cardId === LAURIE)).toBe(true)
    expect(next.pendingFetchedHero ?? null).toBeNull()
  })
})

describe('Michael Myers — Mal Intérieur (paliers)', () => {
  it('monte d’un palier à chaque élimination, plafonné à 3', () => {
    let s = setup('psy', { board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [] } })
    s = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'victim#1' })
    expect(s.players[0].malInterieur).toBe(2)
    // Deux autres kills → plafonné à 3.
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, psy: [{ ...fateCards[2] }] } } : p)) }
    s = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'victim#2' })
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, psy: [{ ...fateCards[3] }] } } : p)) }
    s = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'jaime#1' })
    expect(s.players[0].malInterieur).toBe(3)
  })

  it('niveau 3 → +1 carte en fin de tour ; le coût des cartes N’EST PAS réduit', () => {
    const s = game()
    const p = s.players[0]
    expect(handLimitFor({ ...p, malInterieur: 1 })).toBe(4)
    expect(handLimitFor({ ...p, malInterieur: 2 })).toBe(4) // niveau 2 = aucun bonus
    expect(handLimitFor({ ...p, malInterieur: 3 })).toBe(5)
    // Le coût reste inchangé quel que soit le niveau.
    const card = { instanceId: 'x', cardId: 'x', name: 'x', type: 'effect' as const, cost: 2 }
    expect(effectiveCost(setup('psy', { malInterieur: 3 }), card)).toBe(2)
  })
})

describe('Michael Myers — Armes', () => {
  it('jouer une Arme l’équipe (remplace la précédente, défaussée)', () => {
    const s = setup('psy', { hand: [{ ...villainCards[1] }], power: 5 }) // couteau
    const s1 = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'couteau#1' })
    expect(s1.players[0].equippedWeapon?.cardId).toBe('couteau')
    // Équiper une 2e Arme (tuyau) → couteau défaussé.
    const s2 = setup('psy', { hand: [{ ...villainCards[0] }], power: 5, equippedWeapon: { ...villainCards[1] } })
    const s3 = applyAction(s2, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'tuyau#1' })
    expect(s3.players[0].equippedWeapon?.cardId).toBe('tuyau')
    expect(s3.players[0].discard.some((c) => c.cardId === 'couteau')).toBe(true)
  })

  it('ASSASSINER : coût = coût de l’Arme, tue le Héros du lieu, déclenche l’effet d’Arme', () => {
    const s = setup('psy', {
      hand: [{ ...villainCards[2] }], // assassiner
      power: 5,
      equippedWeapon: { ...villainCards[0] }, // tuyau (coût 2, on-kill +2)
      board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [] },
    })
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'assassiner#1', targetHeroId: 'victim#1' })
    // 5 − 2 (coût = arme) + 2 (Tuyau on-kill) = 5.
    expect(next.players[0].power).toBe(5)
    expect((next.players[0].board.psy ?? []).some((c) => c.instanceId === 'victim#1')).toBe(false)
    expect(next.players[0].malInterieur).toBe(2)
  })

  it('ARMEMENT : ASSASSINER coûte 2 Pouvoir de plus contre le Héros équipé', () => {
    const armement: CardInstance = {
      instanceId: 'armement#1', cardId: 'armement', name: 'Armement', type: 'item', attach: 'hero',
      eventTargetSurcharge: 2, attachedTo: 'victim#1',
    }
    const s = setup('psy', {
      hand: [{ ...villainCards[2] }], // assassiner
      power: 10,
      equippedWeapon: { ...villainCards[0] }, // tuyau (coût 2, on-kill +2)
      board: { psy: [{ ...fateCards[1] }, armement], haddonfield: [], maison: [], demeure: [] },
    })
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'assassiner#1', targetHeroId: 'victim#1' })
    // 10 − 2 (arme) − 2 (Armement) + 2 (Tuyau on-kill) = 8.
    expect(next.players[0].power).toBe(8)
    expect((next.players[0].board.psy ?? []).some((c) => c.instanceId === 'victim#1')).toBe(false)
  })

  it('ASSASSINER est injouable sans Arme équipée', () => {
    const s = setup('psy', { hand: [{ ...villainCards[2] }], power: 5, equippedWeapon: null, board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [] } })
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'assassiner#1', targetHeroId: 'victim#1' })).toThrow()
  })

  it('Jaime Strode désactive l’effet on-kill de l’Arme', () => {
    const s = setup('psy', {
      equippedWeapon: { ...villainCards[0] }, // tuyau on-kill +2
      power: 0,
      board: { psy: [{ ...fateCards[1] }, { ...fateCards[3] }], haddonfield: [], maison: [], demeure: [] }, // victim + jaime
    })
    const next = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'victim#1' })
    // Jaime encore présent → pas de +2 Pouvoir.
    expect(next.players[0].power).toBe(0)
  })
})

describe('Michael Myers — objectif LAURIE', () => {
  it('éliminer LAURIE déclenche la victoire', () => {
    const s = setup('demeure', { board: { psy: [], haddonfield: [], maison: [], demeure: [{ ...fateCards[0] }] } })
    const next = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'laurie#1' })
    expect(next.status).toBe('WON')
    expect(next.winner).toBe(0)
  })

  it('coût d’ASSASSINER de LAURIE augmente de 2 par autre Héros du royaume', () => {
    const s = setup('demeure', {
      hand: [{ ...villainCards[2] }],
      power: 10,
      equippedWeapon: { ...villainCards[0] }, // coût 2
      board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [{ ...fateCards[0] }] }, // 1 autre Héros
    })
    // coût = 2 (arme) + 2 (1 autre Héros) = 4 → 10 − 4 = 6, puis Tuyau +2 = 8.
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'assassiner#1', targetHeroId: 'laurie#1' })
    expect(next.status).toBe('WON')
    expect(next.players[0].power).toBe(8)
  })
})

describe('Michael Myers — Gardons le meilleur pour la fin', () => {
  it('injouable avant Mal Intérieur 3', () => {
    const s = setup('psy', { hand: [{ ...villainCards[3] }], power: 5, malInterieur: 2 })
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'gardons#1' })).toThrow()
  })

  it('au niveau 3 : déverrouille la Demeure et ouvre l’équipement d’une Arme gratuite', () => {
    const s = setup('psy', {
      hand: [{ ...villainCards[3] }],
      power: 5,
      malInterieur: 3,
      deck: [{ ...villainCards[0] }], // une Arme à équiper
    })
    const next = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'gardons#1' })
    const p = next.players[0]
    expect((p.lockedLocations ?? []).includes('demeure')).toBe(false)
    expect(next.pendingRecover?.equipWeapon).toBe(true)
  })
})

describe('Michael Myers — effets Pouvoir selon Mal Intérieur', () => {
  it('Trophée de chasse : +1 + 1 par palier', () => {
    const s = setup('psy', { power: 0, malInterieur: 3 })
    const next = resolveEffect(s, { type: 'GAIN_POWER_PER_MAL_INTERIEUR', base: 1 }, { actorIndex: 0 })
    expect(next.players[0].power).toBe(4)
  })

  it('Souvenir de Judith : −1 − 1 par palier', () => {
    const s = setup('psy', { power: 10, malInterieur: 2 })
    const next = resolveEffect(s, { type: 'LOSE_POWER_PER_MAL_INTERIEUR', base: 1 }, { actorIndex: 0 })
    expect(next.players[0].power).toBe(7)
  })
})

describe('Michael Myers — Trace de sang (choix interactif)', () => {
  it('ouvre le choix Pouvoir/Déplacement quand un Héros est présent', () => {
    const s = setup('psy', { power: 0, board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [] } })
    const next = resolveEffect(s, { type: 'BLOOD_TRACE', power: 2 }, { actorIndex: 0 })
    expect(next.pendingBloodTrace?.playerIndex).toBe(0)
    const done = applyAction(next, { type: 'RESOLVE_BLOOD_TRACE', choice: 'power' })
    expect(done.players[0].power).toBe(2)
    expect(done.pendingBloodTrace ?? null).toBeNull()
  })

  it('gagne directement du Pouvoir s’il n’y a aucun Héros', () => {
    const s = setup('psy', { power: 0, board: { psy: [], haddonfield: [], maison: [], demeure: [] } })
    const next = resolveEffect(s, { type: 'BLOOD_TRACE', power: 2 }, { actorIndex: 0 })
    expect(next.players[0].power).toBe(2)
    expect(next.pendingBloodTrace ?? null).toBeNull()
  })
})

describe('Michael Myers — corrections de cartes', () => {
  it('Couteau de cuisine : éliminer un Héros fait REJOUER un tour', () => {
    const s = setup('psy', {
      equippedWeapon: { ...villainCards[1] }, // couteau → GRANT_EXTRA_TURN
      power: 0,
      board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [] },
    })
    const killed = resolveEffect(s, { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }, { targetHeroId: 'victim#1' })
    expect(killed.players[0].extraTurn).toBe(true)
    const after = applyAction(killed, { type: 'END_TURN' })
    expect(after.activePlayer).toBe(0) // même joueur rejoue
    expect(after.players[0].extraTurn).toBeFalsy()
  })

  it('Arme du crime : cherche une Arme dans la PIOCHE et permet de l’équiper', () => {
    const s = setup('psy', {
      hand: [{ ...villainCards[6] }], // arme du crime
      power: 5,
      deck: [{ ...villainCards[0] }], // tuyau (coût 2) dans la pioche
      equippedWeapon: null,
    })
    const s1 = applyAction(s, { type: 'PLAY_CARD', actionId: 'play', instanceId: 'armecrime#1' })
    expect(s1.pendingWeaponFetch?.playerIndex).toBe(0)
    const s2 = applyAction(s1, { type: 'RESOLVE_WEAPON_FETCH', instanceId: 'tuyau#1', equip: true })
    expect(s2.players[0].equippedWeapon?.cardId).toBe('tuyau')
    // 5 − 1 (coût Arme du crime) − 2 (coût du tuyau équipé) = 2.
    expect(s2.players[0].power).toBe(2)
    expect(s2.pendingWeaponFetch ?? null).toBeNull()
  })

  it('Incarnation du mal : mélange la défausse et en révèle 3 (garde en main)', () => {
    const s = setup('psy', {
      discard: [{ ...villainCards[0] }, { ...villainCards[4] }, { ...villainCards[5] }],
    })
    const next = resolveEffect(s, { type: 'SHUFFLE_DISCARD_REVEAL', count: 3 }, { actorIndex: 0 })
    expect(next.pendingLookTop?.cards.length).toBe(3)
    const kept = next.pendingLookTop!.cards[0].instanceId
    const done = applyAction(next, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [kept] })
    expect(done.players[0].hand.some((c) => c.instanceId === kept)).toBe(true)
  })

  it('Lumière mourrante : option « remettre le reste sur le dessus » de la pioche', () => {
    const s = setup('psy', {
      deck: [
        { ...villainCards[2] }, // assassiner (dessus)
        { ...villainCards[3] }, // gardons
        { ...villainCards[4] }, // trophee
        { ...villainCards[5] }, // trace
        { ...villainCards[0] }, // tuyau (bas)
      ],
    })
    const revealed = resolveEffect(s, { type: 'LOOK_BOTTOM_DRAW', count: 4 }, { actorIndex: 0 })
    expect(revealed.pendingLookTop?.offerTopOrDiscard).toBe(true)
    const keep = revealed.pendingLookTop!.cards[0].instanceId
    const done = applyAction(revealed, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [keep], toTop: true })
    // La carte gardée est en main ; les autres sont remises sur le dessus (pas en défausse).
    expect(done.players[0].hand.some((c) => c.instanceId === keep)).toBe(true)
    expect(done.players[0].discard.length).toBe(0)
  })
})

describe('Michael Myers — le bot ne propose jamais de coup refusé (anti-blocage)', () => {
  it('n’énumère pas ASSASSINER sans Arme équipée', () => {
    const s = setup('psy', {
      hand: [{ ...villainCards[2] }], // assassiner
      power: 9,
      equippedWeapon: null,
      board: { psy: [{ ...fateCards[1] }], haddonfield: [], maison: [], demeure: [] },
    })
    const acts = enumerateActions(s)
    expect(acts.some((a) => a.type === 'PLAY_CARD' && a.instanceId === 'assassiner#1')).toBe(false)
  })

  it('n’énumère pas ASSASSINER si le coût dépasse le Pouvoir', () => {
    const s = setup('demeure', {
      hand: [{ ...villainCards[2] }],
      power: 1, // arme coût 2 → inabordable
      equippedWeapon: { ...villainCards[0] },
      board: { psy: [], haddonfield: [], maison: [], demeure: [{ ...fateCards[0] }] },
    })
    const acts = enumerateActions(s)
    expect(acts.some((a) => a.type === 'PLAY_CARD' && a.instanceId === 'assassiner#1')).toBe(false)
  })

  it('n’énumère pas Gardons le meilleur avant Mal Intérieur 3', () => {
    const s = setup('psy', { hand: [{ ...villainCards[3] }], power: 9, malInterieur: 2 })
    const acts = enumerateActions(s)
    expect(acts.some((a) => a.type === 'PLAY_CARD' && a.instanceId === 'gardons#1')).toBe(false)
  })
})

describe('Michael Myers — Aura effrayante (réaction de fin de tour)', () => {
  const aura = (id: string): CardInstance => ({
    instanceId: id,
    cardId: 'aura',
    name: 'Aura effrayante',
    type: 'condition',
    trigger: { type: 'opponent-played-cards-le', value: 0 },
    reactAtEndOfTurn: true,
    effects: [{ type: 'GRANT_FREE_PLAY_NEXT_TURN' }],
  })

  function twoPlayer(): GameState {
    const base = createInitialGame(
      [
        { villain: michael, deckCards: villainCards.map((c) => ({ ...c, instanceId: 'a-' + c.instanceId })), fateCards: fateCards.map((c) => ({ ...c, instanceId: 'af-' + c.instanceId })) },
        { villain: michael, deckCards: villainCards.map((c) => ({ ...c, instanceId: 'b-' + c.instanceId })), fateCards: fateCards.map((c) => ({ ...c, instanceId: 'bf-' + c.instanceId })) },
      ],
      7,
    )
    return {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      activePlayedCount: 0,
      players: base.players.map((p, i) => ({ ...p, pawnLocation: 'psy', reactableConditionIds: undefined, hand: i === 1 ? [aura('aura#1')] : [] })),
    }
  }

  it('met le tour en pause à la fin du tour adverse (0 carte jouée), puis avance après réaction', () => {
    const s = twoPlayer()
    // Le joueur 0 termine sans avoir joué de carte → fenêtre de réaction ouverte.
    const paused = applyAction(s, { type: 'END_TURN' })
    expect(paused.endTurnReaction?.endingPlayer).toBe(0)
    expect(paused.activePlayer).toBe(0) // pas encore avancé
    // Le joueur 1 (Michael) réagit avec Aura.
    const reacted = applyAction(paused, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'aura#1' })
    expect(reacted.players[1].freePlayCardNextTurn).toBe(true)
    // Nouvel END_TURN → la main passe au joueur 1, qui reçoit son action gratuite au tour suivant.
    const advanced = applyAction(reacted, { type: 'END_TURN' })
    expect(advanced.activePlayer).toBe(1)
    expect(advanced.endTurnReaction ?? null).toBeNull()
    expect(advanced.grantedAction?.actionType).toBe('PLAY_CARD')
  })

  it('n’ouvre PAS la fenêtre si l’adversaire a joué une carte', () => {
    const s = { ...twoPlayer(), activePlayedCount: 1 }
    const next = applyAction(s, { type: 'END_TURN' })
    expect(next.endTurnReaction ?? null).toBeNull()
    expect(next.activePlayer).toBe(1) // avance directement
  })

  it('Aura n’est PAS jouable en cours de tour (hors fenêtre de fin de tour)', () => {
    const s = twoPlayer()
    expect(() => applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 1, instanceId: 'aura#1' })).toThrow()
  })
})

describe('Michael Myers — Obsession', () => {
  it('bloque la Fatalité adverse (noFate) et survit au tour intermédiaire', () => {
    const s = setup('psy')
    const next = resolveEffect(s, { type: 'OBSESSION_BLOCK_FATE' }, { actorIndex: 0 })
    expect(next.players[0].noFate).toBe(true)
    expect(next.players[0].noFateSkipReset).toBe(true)
  })
})
