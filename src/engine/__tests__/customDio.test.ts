// Dio Brando (custom) — flux INTERACTIFS des cartes : chaque carte qui implique un choix
// du joueur ouvre un pending (pas d'auto-pick côté humain), puis se résout par une action.
// On isole les effets via resolveEffect / applyAction sur une partie minimale.
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { effectiveStrength } from '../rules'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'
import { buildDeckInstances } from '../../data/types'
import { patchCustomDio } from '../../data/villains/customDio'
import type { CustomVillain, CustomCard } from '../../data/customVillain'
import type { CardInstance, GameState, PlayerState } from '../types'

const villainInstances = buildDeckInstances(facilierCards, 'villain', 'p0:')
const fateInstances = buildDeckInstances(facilierCards, 'fate', 'p0f:')

const LOC = 'royaume-vaudou'

let n = 0
const card = (type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `c${n++}`,
  cardId: `card-${n}`,
  name: extra.name ?? `carte-${n}`,
  type,
  ...extra,
})

function dioGame(patch: Partial<PlayerState> = {}): GameState {
  const base = createInitialGame(
    [{ villain: facilier, deckCards: villainInstances, fateCards: fateInstances }],
    42,
  )
  // On joue le rôle de Dio : `villain` pilote dioPowerFactor (doublement du Pouvoir).
  return {
    ...base,
    players: base.players.map((p, i) => (i === 0 ? { ...p, villain: 'custom-dio', board: {}, ...patch } : p)),
  }
}

describe('Dio — défausser un Allié pour gagner du Pouvoir (DIO_DISCARD_ALLY_GAIN, effet générique)', () => {
  it('ouvre pendingDioDiscardAlly (pas d’auto-pick) ; la résolution défausse l’Allié choisi et gagne 4', () => {
    const a1 = card('ally', { instanceId: 'a1', name: 'Faible', strength: 1 })
    const a2 = card('ally', { instanceId: 'a2', name: 'Fort', strength: 5 })
    let s = dioGame({ board: { [LOC]: [a1, a2] }, power: 0 })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly?.playerIndex).toBe(0)
    // Le joueur choisit le PLUS FORT (auto-pick aurait pris le plus faible).
    const out = applyAction(s, { type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId: 'a2' })
    expect(out.pendingDioDiscardAlly ?? null).toBeNull()
    expect(out.players[0].board[LOC]?.map((c) => c.instanceId)).toEqual(['a1'])
    expect(out.players[0].discard.some((c) => c.instanceId === 'a2')).toBe(true)
    expect(out.players[0].power).toBe(4)
  })

  it('double le gain (8) si The World est en jeu et Jotaro+Joseph retirés', () => {
    const world = card('ally', { instanceId: 'w', cardId: 'the-world', name: 'The World', strength: 9 })
    const a1 = card('ally', { instanceId: 'a1', name: 'Sbire', strength: 2 })
    let s = dioGame({ board: { [LOC]: [world, a1] }, power: 0, removedFromGame: ['jotaro-kujo', 'joseph-joestar'] })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    const out = applyAction(s, { type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId: 'a1' })
    expect(out.players[0].power).toBe(8)
  })

  it('sans Allié : aucun pending (no-op)', () => {
    let s = dioGame({ board: { [LOC]: [] }, power: 0 })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_GAIN', amount: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly ?? null).toBeNull()
    expect(s.players[0].power).toBe(0)
  })
})

describe('Dio — Indigne de moi (GAIN_POWER_PER_FATE_DISCARD_HERO) compte les Héros retirés du jeu', () => {
  it('+1 par Héros en défausse Fatalité ET par Héros retiré du jeu (Jotaro/Joseph)', () => {
    const h1 = card('hero', { instanceId: 'fh1', name: 'Héros défaussé', strength: 2 })
    let s = dioGame({ fateDiscard: [h1], removedFromGame: ['jotaro-kujo', 'joseph-joestar'], power: 0 })
    s = resolveEffect(s, { type: 'GAIN_POWER_PER_FATE_DISCARD_HERO', max: 99 }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(3) // 1 (défausse) + 2 (retirés)
  })

  it('compte les retirés même sans Héros en défausse Fatalité', () => {
    let s = dioGame({ fateDiscard: [], removedFromGame: ['jotaro-kujo'], power: 0 })
    s = resolveEffect(s, { type: 'GAIN_POWER_PER_FATE_DISCARD_HERO', max: 99 }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(1)
  })
})

describe('Dio — Vampirisme (DIO_DISCARD_ALLY_DRAW) interactif', () => {
  it('défausser un Allié du royaume → choix de l’Allié (pendingDioDiscardAlly draw), puis pioche 4', () => {
    const ally = card('ally', { instanceId: 'a1', name: 'Sbire', strength: 2 })
    const deckCards = ['d1', 'd2', 'd3', 'd4'].map((id) => card('effect', { instanceId: id, name: id }))
    let s = dioGame({ board: { [LOC]: [ally] }, deck: deckCards, hand: [] })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_DRAW', count: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly?.draw).toBe(4)
    const out = applyAction(s, { type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId: 'a1' })
    expect(out.pendingDioDiscardAlly ?? null).toBeNull()
    expect(out.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true) // l'Allié défaussé
    expect(out.players[0].hand).toHaveLength(4) // 4 cartes piochées
  })

  it('plusieurs Alliés : on CHOISIT lequel défausser (l’autre reste en jeu)', () => {
    const a1 = card('ally', { instanceId: 'a1', name: 'Faible', strength: 1 })
    const a2 = card('ally', { instanceId: 'a2', name: 'Fort', strength: 5 })
    const deckCards = ['d1', 'd2', 'd3', 'd4'].map((id) => card('effect', { instanceId: id, name: id }))
    let s = dioGame({ board: { [LOC]: [a1, a2] }, deck: deckCards, hand: [] })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_DRAW', count: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly?.playerIndex).toBe(0)
    // Le joueur choisit le PLUS FORT (un auto-pick aurait pris le plus faible) ; l'autre reste.
    const out = applyAction(s, { type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId: 'a2' })
    expect(out.players[0].board[LOC]?.map((c) => c.instanceId)).toEqual(['a1'])
    expect(out.players[0].discard.some((c) => c.instanceId === 'a2')).toBe(true)
    expect(out.players[0].hand).toHaveLength(4)
  })

  it('The World n’est pas un Allié défaussable : aucun pending (no-op)', () => {
    const world = card('ally', { instanceId: 'tw', cardId: 'the-world', name: 'The World', cannotBeDiscarded: true })
    let s = dioGame({ board: { [LOC]: [world] }, deck: [card('effect', { instanceId: 'd1' })], hand: [] })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_DRAW', count: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly ?? null).toBeNull()
  })

  it('sans Allié dans le royaume : aucun pending (no-op)', () => {
    let s = dioGame({ board: { [LOC]: [] }, hand: [] })
    s = resolveEffect(s, { type: 'DIO_DISCARD_ALLY_DRAW', count: 4 }, { actorIndex: 0 })
    expect(s.pendingDioDiscardAlly ?? null).toBeNull()
  })
})

describe('Dio — Justice (RECOVER_TYPE_FROM_DISCARD) interactif', () => {
  it('ouvre pendingRecover listant uniquement les Alliés de la défausse', () => {
    const ally = card('ally', { instanceId: 'da', name: 'Allié défaussé' })
    const item = card('item', { instanceId: 'di', name: 'Objet défaussé' })
    let s = dioGame({ discard: [ally, item] })
    s = resolveEffect(s, { type: 'RECOVER_TYPE_FROM_DISCARD', types: ['ally'], label: 'Justice' }, { actorIndex: 0 })
    expect(s.pendingRecover?.label).toBe('Justice')
    expect(new Set(s.pendingRecover?.candidateIds)).toEqual(new Set(['da']))
    const out = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: 'da' })
    expect(out.players[0].hand.some((c) => c.instanceId === 'da')).toBe(true)
  })
})

describe('Dio — CREAM (DIO_CREAM_DISCARD_HERO) interactif', () => {
  it('ouvre pendingDioCream avec les Héros de force < Vanilla Ice ; la résolution défausse le Héros choisi', () => {
    const vi = card('ally', { instanceId: 'vi', name: 'Vanilla Ice', strength: 6 })
    const faible = card('hero', { instanceId: 'h1', name: 'Faible', strength: 2 })
    const fort = card('hero', { instanceId: 'h2', name: 'Trop fort', strength: 7 })
    let s = dioGame({ board: { [LOC]: [vi, faible, fort] } })
    s = resolveEffect(s, { type: 'DIO_CREAM_DISCARD_HERO' }, { actorIndex: 0, hostInstanceId: 'vi', hostLocationId: LOC })
    expect(new Set(s.pendingDioCream?.candidateIds)).toEqual(new Set(['h1'])) // h2 (force 7) inéligible
    const out = applyAction(s, { type: 'RESOLVE_DIO_CREAM', heroInstanceId: 'h1' })
    expect(out.pendingDioCream ?? null).toBeNull()
    expect(out.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
    expect(out.players[0].board[LOC]?.some((c) => c.instanceId === 'h1')).toBe(false)
  })
})

describe('Dio — MUDA! (DIO_MUDA) interactif', () => {
  it('gagne 5 IMMÉDIATEMENT puis ouvre le choix d’élimination ; éliminer le Héros choisi', () => {
    const hero = card('hero', { instanceId: 'h1', name: 'Cible', strength: 3 })
    let s = dioGame({ board: { [LOC]: [hero] }, pawnLocation: LOC, power: 0 })
    s = resolveEffect(s, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    expect(s.players[0].power).toBe(5) // gain inconditionnel, avant tout choix
    expect(s.pendingDioMuda?.candidateIds).toEqual(['h1'])
    const out = applyAction(s, { type: 'RESOLVE_DIO_MUDA', heroInstanceId: 'h1' })
    expect(out.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
    expect(out.players[0].power).toBe(5) // pas de double gain à la résolution
  })

  it('décliner l’élimination garde les 5 déjà gagnés', () => {
    const hero = card('hero', { instanceId: 'h1', name: 'Cible', strength: 3 })
    let s = dioGame({ board: { [LOC]: [hero] }, pawnLocation: LOC, power: 0 })
    s = resolveEffect(s, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    const out = applyAction(s, { type: 'RESOLVE_DIO_MUDA' })
    expect(out.players[0].board[LOC]?.some((c) => c.instanceId === 'h1')).toBe(true)
    expect(out.players[0].power).toBe(5)
  })

  it('sans Héros au lieu du pion : gain direct (pas de pending)', () => {
    let s = dioGame({ board: { [LOC]: [] }, pawnLocation: LOC, power: 0 })
    s = resolveEffect(s, { type: 'DIO_MUDA', gain: 5 }, { actorIndex: 0 })
    expect(s.pendingDioMuda ?? null).toBeNull()
    expect(s.players[0].power).toBe(5)
  })
})

describe('Dio — Quête vers le paradis (DIO_QUEST_FOR_HEAVEN) interactif', () => {
  it('ouvre directement le choix d’un OBJET (non-Stand) de la pioche OU de la défausse → main', () => {
    const i1 = card('item', { instanceId: 'i1', name: 'Masque (pioche)' })
    const i2 = card('item', { instanceId: 'i2', name: 'Objet (défausse)' })
    const standInDeck = card('item', { instanceId: 'st0', name: 'StandX', isStand: true }) // exclu
    const ev = card('effect', { instanceId: 'e1', name: 'Événement' }) // exclu (pas un Objet)
    let s = dioGame({ deck: [i1, standInDeck], discard: [i2, ev], hand: [] })
    s = resolveEffect(s, { type: 'DIO_QUEST_FOR_HEAVEN' }, { actorIndex: 0 })
    // Pas de choix de type intermédiaire : on arrive directement sur le choix de l'Objet.
    expect(s.pendingRecover?.label).toBe('Quête vers le paradis')
    expect(new Set(s.pendingRecover?.candidateIds)).toEqual(new Set(['i1', 'i2']))
    const out = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: 'i2' })
    expect(out.players[0].hand.some((c) => c.instanceId === 'i2')).toBe(true)
    expect(out.pendingRecover ?? null).toBeNull()
  })

  it('aucun Objet en pioche ni défausse : no-op (aucun pending)', () => {
    const ev = card('effect', { instanceId: 'e1', name: 'Événement' })
    let s = dioGame({ deck: [], discard: [ev], hand: [] })
    s = resolveEffect(s, { type: 'DIO_QUEST_FOR_HEAVEN' }, { actorIndex: 0 })
    expect(s.pendingRecover ?? null).toBeNull()
  })
})

describe('Dio — The World en jeu dès le début de la partie', () => {
  it('The World est posé sur le lieu de départ (sorti de la pioche), et n’est plus piochable', () => {
    const dioVillain = { ...facilier, id: 'custom-dio' }
    const world: CardInstance = {
      instanceId: 'tw', cardId: 'the-world', name: 'The World', type: 'ally',
      followsPawn: true, cannotBeDiscarded: true,
    }
    const g = createInitialGame(
      [{ villain: dioVillain, deckCards: [world, ...villainInstances], fateCards: fateInstances }],
      7,
    )
    const startLoc = dioVillain.locations[0].id
    const p = g.players[0]
    expect((p.board[startLoc] ?? []).some((c) => c.cardId === 'the-world')).toBe(true)
    expect([...p.deck, ...p.hand].some((c) => c.cardId === 'the-world')).toBe(false)
  })
})

describe('Dio — Tu oses t’approcher de moi : Héros posés sur le manoir', () => {
  it('pose les Héros révélés sur le 1ᵉʳ lieu (manoir), pas sur le lieu du pion ; défausse le reste', () => {
    const h1 = card('hero', { instanceId: 'fh1', name: 'Héros1', strength: 2 })
    const ev = card('effect', { instanceId: 'fe1', name: 'Événement' })
    const h2 = card('hero', { instanceId: 'fh2', name: 'Héros2', strength: 3 })
    // Pion sur « parade » → on prouve que les Héros vont au MANOIR (1ᵉʳ lieu), pas au pion.
    let s = dioGame({ pawnLocation: 'parade', fateDeck: [h1, ev, h2] })
    s = resolveEffect(s, { type: 'DIO_REVEAL_FATE_HEROES_AT_PAWN', count: 4 }, { actorIndex: 0 })
    const lair = s.players[0].locations[0].id
    const here = s.players[0].board[lair] ?? []
    expect(here.some((c) => c.instanceId === 'fh1')).toBe(true)
    expect(here.some((c) => c.instanceId === 'fh2')).toBe(true)
    expect((s.players[0].board['parade'] ?? []).length).toBe(0) // rien sur le lieu du pion
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'fe1')).toBe(true)
  })
})

describe('Dio — The Fool (Stand d’Iggy) : −1 à la Force des Alliés du même lieu', () => {
  // The Fool porte une aura passive `strengthMod allies-here -1` (cf. patchCustomDio).
  const fool = (extra: Partial<CardInstance> = {}) =>
    card('item', { instanceId: 'fool', cardId: 'the-fool', name: 'The Fool', isStand: true, strengthMod: { target: 'allies-here', delta: -1 }, ...extra })

  it('réduit de 1 la force des Alliés présents sur SON lieu', () => {
    const iggy = card('hero', { instanceId: 'iggy', cardId: 'iggy', name: 'Iggy', strength: 1 })
    const sbire = card('ally', { instanceId: 'a1', name: 'Sbire', strength: 3 })
    const s = dioGame({ board: { [LOC]: [iggy, fool({ attachedTo: 'iggy' }), sbire] } })
    expect(effectiveStrength(s, 0, 'a1')).toBe(2) // 3 − 1
  })

  it('n’affecte pas les Alliés d’un AUTRE lieu', () => {
    const other = dioGame().players[0].locations[1].id
    const sbire = card('ally', { instanceId: 'a1', name: 'Sbire', strength: 3 })
    const s = dioGame({ board: { [LOC]: [fool()], [other]: [sbire] } })
    expect(effectiveStrength(s, 0, 'a1')).toBe(3)
  })
})

describe('Dio — ZA WARUDO! : agir sur tous les lieux sans déplacer le pion', () => {
  const za = (patch: Partial<PlayerState> = {}) => ({
    ...dioGame({ pawnLocation: 'royaume-vaudou', power: 20, zaWarudoActive: true, ...patch }),
    phase: 'ACTION' as const,
    status: 'PLAYING' as const,
    activePlayer: 0,
    usedActionIds: [],
  })

  it('focalise un autre lieu (actAtLocation) SANS bouger le pion, et autorise la même action à deux lieux', () => {
    let s: GameState = za()
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // lieu du pion
    expect(s.players[0].dioRealmActionsThisTurn).toContain('royaume-vaudou:gain-power')
    s = applyAction(s, { type: 'ZA_WARUDO_RELOCATE', to: 'parade' })
    expect(s.actAtLocation).toBe('parade')
    expect(s.players[0].pawnLocation).toBe('royaume-vaudou') // le pion n'a pas bougé
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // même id, autre lieu
    expect(s.players[0].dioRealmActionsThisTurn).toEqual(
      expect.arrayContaining(['royaume-vaudou:gain-power', 'parade:gain-power']),
    )
  })

  it('interdit de refaire la MÊME action au MÊME lieu', () => {
    let s: GameState = za()
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })).toThrow()
  })

  it('coût croissant : 1ʳᵉ action −1, 2ᵉ action −2', () => {
    let s: GameState = za({ power: 10 })
    const p0 = s.players[0].power
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // +1 (gain) −1 (za)
    expect(s.players[0].power).toBe(p0 + 1 - 1)
    s = applyAction(s, { type: 'ZA_WARUDO_RELOCATE', to: 'parade' })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // +2 (gain) −2 (za)
    expect(s.players[0].power).toBe(p0 + 1 - 1 + 2 - 2)
    expect(s.players[0].zaWarudoActionsDone).toBe(2)
  })

  it('coût croissant PLAFONNÉ à 10 : une action de plus ne coûte jamais > 10', () => {
    // 10 actions déjà faites → la suivante coûterait 11, mais est plafonnée à 10.
    let s: GameState = za({ power: 50, zaWarudoActionsDone: 10 })
    const p0 = s.players[0].power
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' }) // +1 (gain) −10 (plafond)
    expect(s.players[0].power).toBe(p0 + 1 - 10)
    expect(s.players[0].zaWarudoActionsDone).toBe(11)
  })
})

describe('Dio — Lumière du Soleil (DIO_SUNLIGHT_CHOICE) interactif', () => {
  it('ouvre pendingDioSunlight ; choisir « perdre » retire le Pouvoir', () => {
    let s = dioGame({ hand: [card('effect'), card('effect')], power: 12 })
    s = resolveEffect(s, { type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }, { actorIndex: 0 })
    expect(s.pendingDioSunlight?.lose).toBe(10)
    const out = applyAction(s, { type: 'RESOLVE_DIO_SUNLIGHT', choice: 'lose' })
    expect(out.players[0].power).toBe(2)
    expect(out.players[0].hand).toHaveLength(2)
  })

  it('choisir « défausser » vide la main', () => {
    let s = dioGame({ hand: [card('effect'), card('effect'), card('item')], power: 3 })
    s = resolveEffect(s, { type: 'DIO_SUNLIGHT_CHOICE', lose: 10 }, { actorIndex: 0 })
    const out = applyAction(s, { type: 'RESOLVE_DIO_SUNLIGHT', choice: 'discard' })
    expect(out.players[0].hand).toHaveLength(0)
    expect(out.players[0].discard).toHaveLength(3)
    expect(out.players[0].power).toBe(3)
  })
})

describe('Dio — Star Platinum (Stand de Jotaro) contre ZA WARUDO!', () => {
  it('avec The World mais SANS Star Platinum : ZA WARUDO! s’active', () => {
    const world = card('ally', { instanceId: 'tw', cardId: 'the-world', name: 'The World' })
    let s = dioGame({ board: { [LOC]: [world] } })
    s = resolveEffect(s, { type: 'ZA_WARUDO_ACTIVATE' }, { actorIndex: 0 })
    expect(s.players[0].zaWarudoActive).toBe(true)
  })

  it('tant que Star Platinum est en jeu : ZA WARUDO! est contré (pas d’activation)', () => {
    const world = card('ally', { instanceId: 'tw', cardId: 'the-world', name: 'The World' })
    const sp = card('item', { instanceId: 'sp', cardId: 'star-platinum', name: 'Star Platinum', isStand: true })
    let s = dioGame({ board: { [LOC]: [world, sp] } })
    s = resolveEffect(s, { type: 'ZA_WARUDO_ACTIVATE' }, { actorIndex: 0 })
    expect(s.players[0].zaWarudoActive ?? false).toBe(false)
  })
})

describe('Dio — MUDA! joué EN RÉACTION à une Fatalité : la modale est résoluble', () => {
  it('PLAY_CONDITION (MUDA) puis RESOLVE_DIO_MUDA ne sont pas bloqués par la Fatalité en attente', () => {
    const base = createInitialGame(
      [
        { villain: facilier, deckCards: villainInstances, fateCards: fateInstances },
        {
          villain: facilier,
          deckCards: buildDeckInstances(facilierCards, 'villain', 'p1:'),
          fateCards: buildDeckInstances(facilierCards, 'fate', 'p1f:'),
        },
      ],
      42,
    )
    const muda: CardInstance = {
      instanceId: 'muda',
      cardId: 'muda-muda-muda',
      name: 'MUDA ! MUDA ! MUDA !',
      type: 'condition',
      trigger: { type: 'opponent-fate-targeted-me' },
      effects: [{ type: 'DIO_MUDA', gain: 5 }],
    }
    const hero = card('hero', { instanceId: 'h1', name: 'Cible', strength: 3 })
    const f1 = card('hero', { instanceId: 'f1', name: 'Héros Fatalité' })
    const f2 = card('effect', { instanceId: 'f2', name: 'Événement Fatalité' })
    // Tour du BOT (joueur 1) qui vient de cibler Dio (joueur 0) avec une Fatalité :
    // les 2 cartes sont révélées (pendingFate) et activeFateTargets contient Dio.
    const s: GameState = {
      ...base,
      activePlayer: 1,
      phase: 'ACTION',
      status: 'PLAYING',
      activeFateTargets: [0],
      pendingFate: { target: 0, revealed: [f1, f2] },
      players: base.players.map((p, i) =>
        i === 0
          ? { ...p, villain: 'custom-dio', board: { [LOC]: [hero] }, pawnLocation: LOC, hand: [muda], reactableConditionIds: ['muda'], power: 0 }
          : p,
      ),
    }
    // Réaction : MUDA gagne 5 et ouvre le choix d'élimination — la Fatalité du bot reste en attente.
    const afterPlay = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: 'muda' })
    expect(afterPlay.players[0].power).toBe(5)
    expect(afterPlay.pendingDioMuda?.candidateIds).toEqual(['h1'])
    expect(afterPlay.pendingFate).toBeTruthy()
    // RÉGRESSION : résoudre le choix MUDA ne doit PAS lever « Fatalité en attente ».
    const afterMuda = applyAction(afterPlay, { type: 'RESOLVE_DIO_MUDA', heroInstanceId: 'h1' })
    expect(afterMuda.pendingDioMuda ?? null).toBeNull()
    expect(afterMuda.players[0].fateDiscard.some((c) => c.instanceId === 'h1')).toBe(true)
  })
})

describe('Dio — FETCH_STAND_ATTACH : récupère le Stand même DÉFAUSSÉ', () => {
  it('Allié invocateur : Stand dans la défausse Méchant → quand même invoqué et associé', () => {
    const vi = card('ally', { instanceId: 'vi', name: 'Vanilla Ice', strength: 1 })
    const stand = card('item', { instanceId: 'cream', cardId: 'cream', name: 'Cream', isStand: true })
    let s = dioGame({ board: { [LOC]: [vi] }, standPile: [], discard: [stand] })
    s = resolveEffect(s, { type: 'FETCH_STAND_ATTACH', standCardId: 'cream' }, { actorIndex: 0, hostInstanceId: 'vi', hostLocationId: LOC })
    expect((s.players[0].board[LOC] ?? []).some((c) => c.instanceId === 'cream' && c.attachedTo === 'vi')).toBe(true)
    expect(s.players[0].discard.some((c) => c.instanceId === 'cream')).toBe(false)
  })

  it('Héros Joestar : Stand dans la défausse Fatalité → quand même invoqué et associé', () => {
    const pol = card('hero', { instanceId: 'pol', name: 'Polnareff', strength: 4 })
    const sc = card('item', { instanceId: 'sc', cardId: 'silver-chariot', name: 'Silver Chariot', isStand: true })
    let s = dioGame({ board: { [LOC]: [pol] }, standPile: [], fateDiscard: [sc] })
    s = resolveEffect(s, { type: 'FETCH_STAND_ATTACH', standCardId: 'silver-chariot' }, { actorIndex: 0, hostInstanceId: 'pol', hostLocationId: LOC })
    expect((s.players[0].board[LOC] ?? []).some((c) => c.instanceId === 'sc' && c.attachedTo === 'pol')).toBe(true)
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === 'sc')).toBe(false)
  })

  it('priorité à la réserve : si le Stand est dans standPile, la défausse n’est pas touchée', () => {
    const vi = card('ally', { instanceId: 'vi', name: 'Vanilla Ice', strength: 1 })
    const dup = card('item', { instanceId: 'cream-discard', cardId: 'cream', name: 'Cream', isStand: true })
    const inPile = card('item', { instanceId: 'cream-pile', cardId: 'cream', name: 'Cream', isStand: true })
    let s = dioGame({ board: { [LOC]: [vi] }, standPile: [inPile], discard: [dup] })
    s = resolveEffect(s, { type: 'FETCH_STAND_ATTACH', standCardId: 'cream' }, { actorIndex: 0, hostInstanceId: 'vi', hostLocationId: LOC })
    // C'est l'exemplaire de la RÉSERVE qui est invoqué ; celui de la défausse reste en place.
    expect((s.players[0].board[LOC] ?? []).some((c) => c.instanceId === 'cream-pile')).toBe(true)
    expect(s.players[0].discard.some((c) => c.instanceId === 'cream-discard')).toBe(true)
  })

  it('aucun Stand disponible (ni réserve ni défausse) : no-op (déjà en jeu ailleurs)', () => {
    const vi = card('ally', { instanceId: 'vi', name: 'Vanilla Ice', strength: 1 })
    let s = dioGame({ board: { [LOC]: [vi] }, standPile: [], discard: [], fateDiscard: [] })
    s = resolveEffect(s, { type: 'FETCH_STAND_ATTACH', standCardId: 'cream' }, { actorIndex: 0, hostInstanceId: 'vi', hostLocationId: LOC })
    expect((s.players[0].board[LOC] ?? []).some((c) => c.cardId === 'cream')).toBe(false)
  })
})

describe('Dio (custom) — câblage de Star Platinum via patchCustomDio', () => {
  const mkVillain = (cards: CustomCard[]): CustomVillain => ({
    formatVersion: 1,
    id: 'custom-dio',
    name: 'Dio',
    stars: 3,
    color: '#000000',
    pawnHeightPx: 56,
    boardObjective: '',
    objectiveDescription: '',
    objective: { type: 'POWER_THRESHOLD', threshold: 20 },
    locations: [],
    cards,
    createdAt: '',
    updatedAt: '',
  })
  const mkCard = (id: string, name: string, extra: Partial<CustomCard> = {}): CustomCard => ({
    id,
    name,
    englishName: '',
    deck: 'fate',
    type: 'hero',
    copies: 1,
    text: '',
    image: '',
    ...extra,
  })

  it('Jotaro invoque Star Platinum à la pose (onPlace FETCH_STAND_ATTACH)', () => {
    const v = mkVillain([mkCard('custom-dio-jotaro-kujo', 'JOTARO KUJO')])
    const jotaro = patchCustomDio(v).cards.find((c) => c.id === 'jotaro-kujo')
    expect(jotaro?.removedFromGameOnDefeat).toBe(true)
    expect(
      jotaro?.onPlace?.some((ef) => ef.type === 'FETCH_STAND_ATTACH' && ef.standCardId === 'star-platinum'),
    ).toBe(true)
  })

  it('Jotaro & Joseph : joués d’office à la révélation (playWhenRevealed)', () => {
    const v = mkVillain([
      mkCard('custom-dio-jotaro-kujo', 'JOTARO KUJO'),
      mkCard('custom-dio-joseph-joestar', 'JOSEPH JOESTAR'),
    ])
    const cards = patchCustomDio(v).cards
    expect(cards.find((c) => c.id === 'jotaro-kujo')?.playWhenRevealed).toBe(true)
    expect(cards.find((c) => c.id === 'joseph-joestar')?.playWhenRevealed).toBe(true)
  })

  it('Star Platinum = Stand +8 associé à un Héros, sorti du paquet « Stand »', () => {
    const v = mkVillain([mkCard('custom-dio-star-platinum', 'STAR PLATINUM', { type: 'item', group: 'Stand', deck: 'villain' })])
    const sp = patchCustomDio(v).cards.find((c) => c.id === 'star-platinum')
    expect(sp?.isStand).toBe(true)
    expect(sp?.attach).toBe('hero')
    expect(sp?.attachStrengthBonus).toBe(8)
    expect(sp?.group).toBeUndefined()
  })

  it('The Fool : Stand +4 à Iggy + aura −1 aux Alliés du lieu (plus de dispersion)', () => {
    const v = mkVillain([mkCard('custom-dio-the-fool', 'THE FOOL', { type: 'item', group: 'Stand', deck: 'villain' })])
    const fool = patchCustomDio(v).cards.find((c) => c.id === 'the-fool')
    expect(fool?.attachStrengthBonus).toBe(4)
    expect(fool?.strengthMod).toEqual({ target: 'allies-here', delta: -1 })
    expect(fool?.effects).toBeUndefined()
  })

  it('carte ajoutée via l’éditeur (id « custom-dio-cN ») : résolution par le NOM', () => {
    const v = mkVillain([mkCard('custom-dio-c7', 'STAR PLATINUM', { type: 'item', group: 'Stand', deck: 'villain' })])
    const sp = patchCustomDio(v).cards.find((c) => c.id === 'star-platinum')
    expect(sp?.isStand).toBe(true)
    expect(sp?.attachStrengthBonus).toBe(8)
  })
})
