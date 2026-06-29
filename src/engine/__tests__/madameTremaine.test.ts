import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { resolveEffects } from '../effects'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { hasReachedObjective, coveredTopActionIdsAt, movableCards, effectiveCost, allyBlockedAt, activatableCards } from '../rules'
import { madameTremaine } from '../../data/villains/madameTremaine'
import { madameTremaineCards } from '../../data/villains/madameTremaine.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: madameTremaine,
        deckCards: buildDeckInstances(madameTremaineCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

const game2 = (seed = 7): GameState =>
  createInitialGame(
    [
      { villain: madameTremaine, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 'p0:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'p0f:') },
      { villain: { ...madameTremaine, name: 'T2' }, deckCards: buildDeckInstances(madameTremaineCards, 'villain', 'p1:'), fateCards: buildDeckInstances(madameTremaineCards, 'fate', 'p1f:') },
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
const setBoard = (s: GameState, board: Record<string, CardInstance[]>): GameState => ({
  ...s,
  players: [{ ...s.players[0], board: { ...s.players[0].board, ...board } }],
})

describe('Madame de Trémaine — mise en place', () => {
  it('la Salle de Bal démarre verrouillée et l’objectif est MARRY_PRINCE', () => {
    const s = game()
    expect(s.players[0].lockedLocations).toContain('salle-de-bal')
    expect(s.players[0].objective.type).toBe('MARRY_PRINCE')
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Madame de Trémaine — condition de victoire (mariage)', () => {
  const marrySetup = (extraBallroom: CardInstance[] = [], elsewhere: Record<string, CardInstance[]> = {}) =>
    setBoard(game(), {
      'salle-de-bal': [
        card('ball-gown-anastasia', 'ally', { strength: 4 }),
        card('the-prince', 'hero', { strength: 0 }),
        card('cloches-mariage', 'item'),
        ...extraBallroom,
      ],
      ...elsewhere,
    })

  it('victoire avec fille en robe + Prince + Cloches, sans Pantoufle', () => {
    expect(hasReachedObjective(marrySetup(), 0)).toBe(true)
  })

  it('pas de victoire sans le Prince', () => {
    const s = setBoard(game(), {
      'salle-de-bal': [card('ball-gown-drizella', 'ally', { strength: 4 }), card('cloches-mariage', 'item')],
    })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it('pas de victoire si une Pantoufle de Verre est dans le royaume', () => {
    const s = marrySetup([], { chateau: [card('pantoufle-chateau', 'item')] })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it('pas de victoire sans les Cloches de Mariage', () => {
    const s = setBoard(game(), {
      'salle-de-bal': [card('ball-gown-anastasia', 'ally', { strength: 4 }), card('the-prince', 'hero', { strength: 0 })],
    })
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Madame de Trémaine — Objets clés', () => {
  it('Invitation du Roi (pose) : déverrouille la Salle de Bal ET y amène le Prince', () => {
    let s = game()
    s = resolveEffects(
      s,
      [
        { type: 'UNLOCK_LOCATION', locationId: 'salle-de-bal' },
        { type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'the-prince', locationId: 'salle-de-bal' },
      ],
      { actorIndex: 0 },
    )
    expect(s.players[0].lockedLocations ?? []).not.toContain('salle-de-bal')
    expect((s.players[0].board['salle-de-bal'] ?? []).some((c) => c.cardId === 'the-prince')).toBe(true)
  })

  const villItem = (cardId: string) => ({
    ...buildDeckInstances(madameTremaineCards, 'villain', 'p0:').find((c) => c.cardId === cardId)!,
    instanceId: cardId,
  })
  const unlockedActiveAt = (s: GameState): GameState => ({
    ...s,
    phase: 'ACTION',
    players: [{
      ...s.players[0],
      pawnLocation: 'salle-de-bal',
      power: 5,
      lockedLocations: (s.players[0].lockedLocations ?? []).filter((l) => l !== 'salle-de-bal'),
    }],
  })

  it('Invitation du Roi (activée) : examine la pioche Fatalité (scry top 2)', () => {
    let s = unlockedActiveAt(setBoard(game(), { chateau: [villItem('invitation-du-roi')] }))
    expect(activatableCards(s).some((c) => c.instanceId === 'invitation-du-roi')).toBe(true)
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'invitation-du-roi' })
    expect(s.pendingScry?.playerIndex).toBe(0)
    expect((s.pendingScry?.cards.length ?? 0)).toBeGreaterThan(0)
  })

  it('Canne (activée) : retire UNE Pantoufle de Verre ; non activable sans Pantoufle', () => {
    let s = unlockedActiveAt(
      setBoard(game(), { chateau: [villItem('canne-tremaine'), card('pantoufle-chambre', 'item'), card('pantoufle-chateau', 'item')] }),
    )
    expect(activatableCards(s).some((c) => c.instanceId === 'canne-tremaine')).toBe(true)
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'canne-tremaine' })
    expect(Object.values(s.players[0].board).flat().filter((c) => c.cardId === 'pantoufle-chambre' || c.cardId === 'pantoufle-chateau')).toHaveLength(1)
    // Sans Pantoufle restante → non activable.
    const noSlip = unlockedActiveAt(setBoard(game(), { chateau: [villItem('canne-tremaine')] }))
    expect(activatableCards(noSlip).some((c) => c.instanceId === 'canne-tremaine')).toBe(false)
  })

  it('La Clé (activée) : déplace un Héros choisi sur la Chambre de Cendrillon et le piège', () => {
    let s = unlockedActiveAt(setBoard(game(), { chateau: [villItem('la-cle'), card('gus', 'hero', { strength: 1 })] }))
    const heroId = s.players[0].board['chateau'].find((c) => c.cardId === 'gus')!.instanceId
    expect(activatableCards(s).some((c) => c.instanceId === 'la-cle')).toBe(true)
    s = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: 'la-cle' })
    expect(s.pendingHeroRelocate?.forcedLocationId).toBe('chambre-cendrillon')
    s = applyAction(s, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: heroId, to: 'chambre-cendrillon' })
    const h = (s.players[0].board['chambre-cendrillon'] ?? []).find((c) => c.instanceId === heroId)
    expect(h?.trapped).toBe(true)
  })

  it('La Clé (pose) : déplace Cendrillon sur sa Chambre et la piège', () => {
    let s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 2 })] })
    s = resolveEffects(s, [{ type: 'MOVE_NAMED_HERO_TO_AND_TRAP', heroCardId: 'cendrillon', locationId: 'chambre-cendrillon' }], { actorIndex: 0 })
    const cend = (s.players[0].board['chambre-cendrillon'] ?? []).find((c) => c.cardId === 'cendrillon')
    expect(cend).toBeDefined()
    expect(cend!.trapped).toBe(true)
  })

  it('Je ne reviens jamais : remélange la Fatalité puis réordonne le top (ordre choisi sur le dessus)', () => {
    let s = game()
    // Pioche Fatalité contrôlée : 4 cartes connues, défausse vide.
    const a = card('cendrillon', 'hero', { strength: 2 })
    const b = card('gus', 'hero', { strength: 1 })
    const c2 = card('jaq', 'hero', { strength: 1 })
    const d = card('bruno', 'hero', { strength: 3 })
    s = { ...s, players: [{ ...s.players[0], fateDeck: [a, b, c2, d], fateDiscard: [] }] }
    s = resolveEffects(s, [{ type: 'RESHUFFLE_FATE_THEN_REORDER', count: 4 }], { actorIndex: 0 })
    expect(s.pendingFateReorder?.cards).toHaveLength(4)
    // Choisit de mettre 'bruno' (d) sur le dessus, puis le reste.
    const ids = [d.instanceId, a.instanceId, b.instanceId, c2.instanceId]
    s = applyAction(s, { type: 'RESOLVE_FATE_REORDER', orderedIds: ids })
    expect(s.pendingFateReorder ?? null).toBeNull()
    expect(s.players[0].fateDeck.slice(0, 4).map((x) => x.instanceId)).toEqual(ids)
  })

})

describe('Madame de Trémaine — Piège & Prince', () => {
  it('TRAP_HERO piège un Héros : il perd sa capacité mais CONTINUE de recouvrir les actions', () => {
    let s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 4 })] })
    const heroId = s.players[0].board['chateau'][0].instanceId
    // Avant : Cendrillon recouvre la rangée du haut du Château.
    const before = coveredTopActionIdsAt(s.players[0], 'chateau').size
    expect(before).toBeGreaterThan(0)
    s = resolveEffects(s, [{ type: 'TRAP_HERO' }], { actorIndex: 0, targetHeroId: heroId })
    expect(s.players[0].board['chateau'][0].trapped).toBe(true)
    // Piégé (Enfermé) : il recouvre TOUJOURS la rangée du haut (seule sa capacité est désactivée).
    expect(coveredTopActionIdsAt(s.players[0], 'chateau').size).toBe(before)
  })

  it('le Prince ne recouvre aucune action et est déplaçable', () => {
    let s = setBoard(game(), { chateau: [card('the-prince', 'hero', { strength: 0 })] })
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'chateau' }] }
    expect(coveredTopActionIdsAt(s.players[0], 'chateau').size).toBe(0)
    expect(movableCards(s).some((m) => m.from === 'chateau')).toBe(true)
  })
})

describe('Madame de Trémaine — Le Prince (Fatalité obligatoire)', () => {
  // Le Prince a `forcedFateLocation: 'salle-de-bal'` → dès qu'il est dévoilé par une
  // Fatalité, il est joué d'office sur la Salle de Bal (verrouillée ou non), l'autre
  // carte est défaussée et il n'y a aucun choix (pas de pendingFate).
  const fateSetup = (): GameState => {
    let s = applyAction(game2(), { type: 'MOVE', to: 'salle-musique' })
    const prince = card('the-prince', 'hero', { strength: 0, forcedFateLocation: 'salle-de-bal' })
    const other = card('lucifer', 'ally', { strength: 2 })
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 1 ? { ...p, fateDeck: [prince, other, ...p.fateDeck] } : p)),
    }
    return applyAction(s, { type: 'FATE', actionId: 'fate' })
  }

  it('le Prince est posé d’office sur la Salle de Bal verrouillée ; l’autre est défaussée, sans choix', () => {
    const before = game2()
    expect(before.players[1].lockedLocations).toContain('salle-de-bal')
    const s = fateSetup()
    expect(s.pendingFate).toBeNull() // aucun choix de Fatalité
    expect((s.players[1].board['salle-de-bal'] ?? []).some((c) => c.cardId === 'the-prince')).toBe(true)
    expect(s.players[1].fateDiscard.some((c) => c.cardId === 'lucifer')).toBe(true)
  })
})

describe('Madame de Trémaine — Sale voleuse ! (cible restreinte)', () => {
  const vanquish = { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3, onlyCardIds: ['cendrillon', 'ball-gown-cinderella'] } as const

  it('élimine Cendrillon', () => {
    let s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 2 })] })
    const heroId = s.players[0].board['chateau'][0].instanceId
    s = resolveEffects(s, [vanquish], { actorIndex: 0, targetHeroId: heroId })
    expect(s.players[0].board['chateau']).toHaveLength(0)
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'cendrillon')).toBe(true)
  })

  it('élimine Cendrillon en robe de bal', () => {
    let s = setBoard(game(), { 'salle-de-bal': [card('ball-gown-cinderella', 'hero', { strength: 2 })] })
    const heroId = s.players[0].board['salle-de-bal'][0].instanceId
    s = resolveEffects(s, [vanquish], { actorIndex: 0, targetHeroId: heroId })
    expect(s.players[0].board['salle-de-bal']).toHaveLength(0)
  })

  it('refuse un autre Héros (force ≤ 3 mais cardId non visé)', () => {
    const s = setBoard(game(), { chateau: [card('gus', 'hero', { strength: 1 })] })
    const heroId = s.players[0].board['chateau'][0].instanceId
    expect(() => resolveEffects(s, [vanquish], { actorIndex: 0, targetHeroId: heroId })).toThrow()
  })
})

describe('Madame de Trémaine — J’allais oublier un détail (défausse facultative + complétion)', () => {
  const fx = { type: 'DISCARD_ANY_THEN_REFILL', handLimit: 4, label: 'X' } as const

  it('ouvre une défausse FACULTATIVE, puis complète la main à 4', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], hand: s.players[0].hand.slice(0, 2) }] }
    s = resolveEffects(s, [fx], { actorIndex: 0 })
    expect(s.pendingTyrannyDiscard?.optional).toBe(true)
    expect(s.pendingTyrannyDiscard?.drawTo).toBe(4)
    const discardId = s.players[0].hand[0].instanceId
    s = applyAction(s, { type: 'RESOLVE_TYRANNY_DISCARD', instanceIds: [discardId] })
    expect(s.pendingTyrannyDiscard).toBeUndefined()
    expect(s.players[0].hand).toHaveLength(4)
    expect(s.players[0].discard.some((c) => c.instanceId === discardId)).toBe(true)
    expect(s.players[0].hand.some((c) => c.instanceId === discardId)).toBe(false)
  })

  it('défausser 0 carte est permis (la main est tout de même complétée à 4)', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], hand: s.players[0].hand.slice(0, 1) }] }
    s = resolveEffects(s, [fx], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_TYRANNY_DISCARD', instanceIds: [] })
    expect(s.players[0].hand).toHaveLength(4)
  })

  it('main vide : complète directement, sans étape interactive', () => {
    let s = game()
    s = { ...s, players: [{ ...s.players[0], hand: [] }] }
    s = resolveEffects(s, [fx], { actorIndex: 0 })
    expect(s.pendingTyrannyDiscard).toBeUndefined()
    expect(s.players[0].hand).toHaveLength(4)
  })
})

describe('Madame de Trémaine — Douze coups de minuit', () => {
  it('élimine TOUS les Héros du royaume, sans exception', () => {
    let s = setBoard(game(), {
      chateau: [card('cendrillon', 'hero', { strength: 2 }), card('the-prince', 'hero', { strength: 0 })],
      'salle-de-bal': [card('gus', 'hero', { strength: 1 })],
    })
    s = resolveEffects(s, [{ type: 'INSTANT_VANQUISH_ALL_HEROES' }], { actorIndex: 0 })
    expect(Object.values(s.players[0].board).flat().filter((c) => c.type === 'hero')).toHaveLength(0)
    expect(s.players[0].fateDiscard.filter((c) => c.type === 'hero')).toHaveLength(3)
  })

  it('injouable s’il n’y a aucun Héros dans le royaume', () => {
    const minuit = { ...buildDeckInstances(madameTremaineCards, 'villain', 'p0:').find((c) => c.cardId === 'minuit-tremaine')! }
    const s: GameState = {
      ...game(),
      phase: 'ACTION',
      players: [{ ...game().players[0], pawnLocation: 'chambre-cendrillon', power: 5, hand: [minuit], board: {} }],
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: minuit.instanceId }),
    ).toThrow(/injouable/i)
  })

  const minuitFx = [
    { type: 'INSTANT_VANQUISH_ALL_HEROES' },
    { type: 'FETCH_FATE_ITEMS_TO_REALM', cardIds: ['pantoufle-chambre', 'pantoufle-chateau'] },
  ] as const
  const isSlip = (id: string) => id === 'pantoufle-chambre' || id === 'pantoufle-chateau'

  it('ramène les deux Pantoufles de Verre (pioche + défausse Fatalité) après le board-wipe', () => {
    let s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 2 })] })
    s = {
      ...s,
      players: [{
        ...s.players[0],
        pawnLocation: 'chateau',
        fateDeck: [card('pantoufle-chambre', 'item')],
        fateDiscard: [card('pantoufle-chateau', 'item')],
      }],
    }
    s = resolveEffects(s, [...minuitFx], { actorIndex: 0 })
    expect(Object.values(s.players[0].board).flat().filter((c) => c.type === 'hero')).toHaveLength(0)
    const slippers = Object.values(s.players[0].board).flat().filter((c) => isSlip(c.cardId))
    expect(slippers).toHaveLength(2)
  })

  it('récupère une Pantoufle déjà posée sur un lieu + celle de la pioche', () => {
    let s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 2 }), card('pantoufle-chateau', 'item')] })
    s = {
      ...s,
      players: [{ ...s.players[0], pawnLocation: 'chateau', fateDeck: [card('pantoufle-chambre', 'item')] }],
    }
    s = resolveEffects(s, [...minuitFx], { actorIndex: 0 })
    const slippers = Object.values(s.players[0].board).flat().filter((c) => isSlip(c.cardId))
    expect(slippers).toHaveLength(2)
  })
})

describe('Madame de Trémaine — capacités des Héros Fatalité', () => {
  const fateInst = buildDeckInstances(madameTremaineCards, 'fate', 'p0f:')
  const villInst = buildDeckInstances(madameTremaineCards, 'villain', 'p0:')
  const fateCard = (cardId: string) => ({ ...fateInst.find((c) => c.cardId === cardId)! })
  const villCard = (cardId: string) => ({ ...villInst.find((c) => c.cardId === cardId)! })

  it('Cendrillon : les Événements coûtent 2 jetons de plus', () => {
    const ev = card('x', 'effect', { cost: 2 })
    expect(effectiveCost(game(), ev)).toBe(2) // sans Cendrillon
    const s = setBoard(game(), { chateau: [card('cendrillon', 'hero', { strength: 2 })] })
    expect(effectiveCost(s, ev)).toBe(4) // +2 avec Cendrillon
  })

  it('Cendrillon en robe de bal : aucun Allié ne peut entrer dans la Salle de Bal', () => {
    const s = setBoard(game(), { 'salle-de-bal': [fateCard('ball-gown-cinderella')] })
    expect(allyBlockedAt(s, 0, 'salle-de-bal')).toBe(true)
    expect(allyBlockedAt(s, 0, 'chateau')).toBe(false)
  })

  it('Marraine la Bonne Fée : invoque Cendrillon en robe de bal sur la Salle de Bal si elle est DÉVERROUILLÉE', () => {
    let s = game()
    // Déverrouille la Salle de Bal d'abord.
    s = { ...s, players: [{ ...s.players[0], lockedLocations: (s.players[0].lockedLocations ?? []).filter((l) => l !== 'salle-de-bal') }] }
    s = placeFateHeroWithEffects(s, 0, 0, fateCard('fairy-godmother'), 'chateau', 'Château')
    expect(Object.values(s.players[0].board).flat().some((c) => c.cardId === 'fairy-godmother')).toBe(true)
    expect((s.players[0].board['salle-de-bal'] ?? []).some((c) => c.cardId === 'ball-gown-cinderella')).toBe(true)
  })

  it('Marraine : si la Salle de Bal est VERROUILLÉE, Cendrillon en robe de bal n’y est PAS placée', () => {
    // Salle de Bal verrouillée au départ (lockedLocationsAtStart).
    const s = placeFateHeroWithEffects(game(), 0, 0, fateCard('fairy-godmother'), 'chateau', 'Château')
    const bgc = Object.entries(s.players[0].board).find(([, cards]) => cards.some((c) => c.cardId === 'ball-gown-cinderella'))
    expect(bgc).toBeDefined() // bien invoquée…
    expect(bgc![0]).not.toBe('salle-de-bal') // …mais pas dans la Salle de Bal verrouillée
  })

  it('Pataud : attire Lucifer sur son lieu à la pose', () => {
    let s = setBoard(game(), { chateau: [villCard('lucifer')] })
    s = placeFateHeroWithEffects(s, 0, 0, fateCard('bruno'), 'salle-de-bal', 'Salle de Bal')
    expect((s.players[0].board['chateau'] ?? []).some((c) => c.cardId === 'lucifer')).toBe(false)
    expect((s.players[0].board['salle-de-bal'] ?? []).some((c) => c.cardId === 'lucifer')).toBe(true)
  })

  it('C’est votre dernière chance : les deux possibles → ouvre le choix', () => {
    let s = setBoard(game(), {
      chateau: [card('lucifer', 'ally', { strength: 3 }), card('gizmo', 'item', { activatedCost: 0 })],
    })
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'chateau', power: 5 }] }
    s = resolveEffects(s, [{ type: 'GRANT_FREE_MOVE_OR_ACTIVATE' }], { actorIndex: 0 })
    expect(s.pendingMoveOrActivate).toEqual({ playerIndex: 0 })
    const m = applyAction(s, { type: 'RESOLVE_MOVE_OR_ACTIVATE', choice: 'move' })
    expect(m.pendingMoveOrActivate ?? null).toBeNull()
    expect(m.grantedAction?.actionType).toBe('MOVE_ITEM_ALLY')
    const a = applyAction(s, { type: 'RESOLVE_MOVE_OR_ACTIVATE', choice: 'activate' })
    expect(a.players[0].freeActivate).toBe(true)
  })

  it('C’est votre dernière chance : seul le déplacement est possible → armé directement', () => {
    let s = setBoard(game(), { chateau: [card('lucifer', 'ally', { strength: 3 })] })
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'chateau', power: 5 }] }
    s = resolveEffects(s, [{ type: 'GRANT_FREE_MOVE_OR_ACTIVATE' }], { actorIndex: 0 })
    expect(s.pendingMoveOrActivate ?? null).toBeNull()
    expect(s.grantedAction?.actionType).toBe('MOVE_ITEM_ALLY')
  })

  it('C’est votre dernière chance : seule l’activation est possible → armée directement', () => {
    const hero = card('cendrillon', 'hero', { strength: 2 })
    const item = card('gizmo', 'item', { activatedCost: 0, attachedTo: hero.instanceId })
    let s = setBoard(game(), { chateau: [hero, item] })
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'chateau', power: 5 }] }
    s = resolveEffects(s, [{ type: 'GRANT_FREE_MOVE_OR_ACTIVATE' }], { actorIndex: 0 })
    expect(s.pendingMoveOrActivate ?? null).toBeNull()
    expect(s.players[0].freeActivate).toBe(true)
  })

  it('C’est votre dernière chance : injouable si ni déplacement ni activation', () => {
    const cvdc = villCard('il-y-a-encore-une-chance')
    const s: GameState = {
      ...game(),
      phase: 'ACTION',
      players: [{ ...game().players[0], pawnLocation: 'chambre-cendrillon', power: 5, hand: [cvdc], board: {} }],
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: cvdc.instanceId }),
    ).toThrow(/injouable/i)
  })

  it('J’ai dit « Si » : injouable si la défausse de Méchant est vide', () => {
    const sid = villCard('je-disais-si')
    const base = (discard: CardInstance[]): GameState => ({
      ...game(),
      phase: 'ACTION',
      players: [{ ...game().players[0], pawnLocation: 'chambre-cendrillon', power: 5, hand: [sid], discard }],
    })
    // Défausse vide → garde-fou moteur.
    expect(() =>
      applyAction(base([]), { type: 'PLAY_CARD', actionId: 'play-card', instanceId: sid.instanceId }),
    ).toThrow(/défausse est vide/i)
    // Au moins une carte en défausse → jouable.
    expect(() =>
      applyAction(base([villCard('lucifer')]), { type: 'PLAY_CARD', actionId: 'play-card', instanceId: sid.instanceId }),
    ).not.toThrow()
  })
})

describe('Madame de Trémaine — cartes re-traduites (effets réels)', () => {
  it('Lucifer : un Héros sur son lieu reçoit un jeton Enfermé (piégé) après une action', () => {
    let s = setBoard(game(), { chateau: [card('lucifer', 'ally', { strength: 3 }), card('cendrillon', 'hero', { strength: 2 })] })
    s = { ...s, phase: 'ACTION' }
    s = applyAction(s, { type: 'END_TURN' }) // la sync post-action piège le Héros co-localisé
    const cend = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'cendrillon')!
    expect(cend.trapped).toBe(true)
  })

  it('Enfermée : réaction « adversaire élimine un Héros » → piège un Héros du royaume', () => {
    let s = game2()
    const enf = card('enfermes', 'condition', { trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 } })
    const hero = card('cendrillon', 'hero', { strength: 2 })
    s = {
      ...s,
      activePlayer: 1,
      lastVanquishedHeroStrength: 3,
      players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [enf], board: { ...p.board, chateau: [hero] } } : p)),
    }
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: enf.instanceId })
    const h = Object.values(s.players[0].board).flat().find((c) => c.instanceId === hero.instanceId)!
    expect(h.trapped).toBe(true)
  })

  it('Enfermée : INJOUABLE si l’adversaire n’a éliminé aucun Héros (value 0 ne doit pas toujours matcher)', () => {
    let s = game2()
    const enf = card('enfermes', 'condition', { trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 0 } })
    const hero = card('cendrillon', 'hero', { strength: 2 })
    s = {
      ...s,
      activePlayer: 1,
      lastVanquishedHeroStrength: undefined, // aucune élimination ce tour-ci
      players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [enf], board: { ...p.board, chateau: [hero] } } : p)),
    }
    expect(() => applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: enf.instanceId })).toThrow()
  })

  it('Plaisanteries douteuses : Fatalité ciblée → le joueur choisit la carte jouée (pendingScry pasSiVite)', () => {
    let s = game2()
    const vf = card('vilaines-farces', 'condition', { trigger: { type: 'opponent-fate-targeted-me' } })
    const f1 = card('cendrillon', 'hero', { strength: 2 })
    const f2 = card('gus', 'hero', { strength: 1 })
    s = {
      ...s,
      activePlayer: 1,
      activeFateTargets: [0],
      pendingFate: { target: 0, revealed: [f1, f2] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [vf] } : p)),
    }
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: vf.instanceId })
    expect(s.pendingScry?.pasSiVite).toBe(true)
    expect(s.pendingScry?.cards).toHaveLength(2)
  })
})

describe('Madame de Trémaine — Anastasie/Javotte interdites de Salle de Bal', () => {
  const villInst = buildDeckInstances(madameTremaineCards, 'villain', 'p0:')
  const villCard = (cardId: string) => ({ ...villInst.find((c) => c.cardId === cardId)! })

  it('la donnée porte forbiddenLocations = [salle-de-bal] (et pas la version en robe)', () => {
    expect(villCard('anastasia').forbiddenLocations).toEqual(['salle-de-bal'])
    expect(villCard('drizella').forbiddenLocations).toEqual(['salle-de-bal'])
    expect(villCard('ball-gown-anastasia').forbiddenLocations ?? []).not.toContain('salle-de-bal')
  })

  it('jouer Anastasie sur la Salle de Bal est refusé', () => {
    const ana = villCard('anastasia')
    const s: GameState = {
      ...game(),
      phase: 'ACTION',
      players: [{ ...game().players[0], pawnLocation: 'salle-de-bal', lockedLocations: [], power: 5, hand: [ana] }],
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: ana.instanceId, to: 'salle-de-bal' }),
    ).toThrow(/ne peut pas être joué/i)
  })

  it('déplacer Javotte vers la Salle de Bal est refusé', () => {
    const javotte = { ...villCard('drizella'), instanceId: 'jav#1' }
    let s = setBoard(game(), { chateau: [javotte] })
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'chambre-cendrillon', lockedLocations: [], power: 5 }] }
    expect(() =>
      applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'jav#1', to: 'salle-de-bal' }),
    ).toThrow(/ne peut pas être déplacé/i)
  })

  it('la version EN ROBE DE BAL peut, elle, être jouée sur la Salle de Bal', () => {
    // ball-gown remplace anastasia déjà en jeu (replacesCardId) → on en pose une ailleurs.
    const bga = villCard('ball-gown-anastasia')
    const s: GameState = {
      ...game(),
      phase: 'ACTION',
      players: [
        {
          ...game().players[0],
          pawnLocation: 'salle-de-bal',
          lockedLocations: [],
          power: 5,
          hand: [bga],
          board: { chateau: [{ ...villCard('anastasia'), instanceId: 'ana#1' }] },
        },
      ],
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: bga.instanceId, to: 'salle-de-bal' }),
    ).not.toThrow()
  })
})
