// Dr Facilier — Pile de l'Au-delà : Divination/objectif et Talisman.
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { performVanquish, holdsTalisman, resolveEffect } from '../effects'
import { effectiveStrength } from '../rules'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const villainInstances = buildDeckInstances(facilierCards, 'villain', 'p0:')
const fateInstances = buildDeckInstances(facilierCards, 'fate', 'p0f:')
const inst = (cardId: string, deck = villainInstances): CardInstance =>
  ({ ...deck.find((c) => c.cardId === cardId)! })

/** Partie à 1 joueur (Dr Facilier) pour isoler la mécanique de l'Au-delà. */
function facilierGame(): GameState {
  return createInitialGame(
    [{ villain: facilier, deckCards: villainInstances, fateCards: fateInstances }],
    42,
  )
}

function withActive(s: GameState, patch: Partial<GameState['players'][number]>): GameState {
  return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, ...patch } : p)) }
}

describe('Dr Facilier — Pile de l’Au-delà', () => {
  it('Divination révélant Régner avec le Talisman détenu gagne la partie', () => {
    const regner = inst('regner-nouvelle-orleans')
    const talisman = inst('talisman')
    let s = facilierGame()
    s = withActive(s, {
      pawnLocation: 'royaume-vaudou',
      board: { ...s.players[0].board, bayou: [talisman] }, // Talisman libre = détenu
      auDela: [regner],
    })
    s = { ...s, pendingDivination: { playerIndex: 0, cards: [regner] } }
    const out = applyAction(s, { type: 'RESOLVE_DIVINATION', topInstanceIds: [regner.instanceId] })
    expect(out.status).toBe('WON')
    expect(out.winner).toBe(0)
  })

  it('Régner révélé SANS Talisman retourne dans la Pile de l’Au-delà', () => {
    const regner = inst('regner-nouvelle-orleans')
    let s = facilierGame()
    s = withActive(s, { pawnLocation: 'royaume-vaudou', board: { ...s.players[0].board }, auDela: [regner] })
    s = { ...s, pendingDivination: { playerIndex: 0, cards: [regner] } }
    const out = applyAction(s, { type: 'RESOLVE_DIVINATION', topInstanceIds: [regner.instanceId] })
    expect(out.status).toBe('PLAYING')
    expect(out.players[0].auDela.map((c) => c.cardId)).toContain('regner-nouvelle-orleans')
  })

  it('Terreur : choix INTERACTIF d’un Allié OU d’un Événement de la défausse (pendingRecover)', () => {
    const ally = inst('esprits-ombres') // un Allié quelconque du deck Facilier
    const event = inst('amis-au-dela') // un Événement quelconque
    let s = facilierGame()
    s = withActive(s, { discard: [ally, event] })
    // Terreur ouvre un pendingRecover listant les deux candidats (pas d'auto-pick).
    s = resolveEffect(s, { type: 'RECOVER_TYPE_FROM_DISCARD', types: ['ally', 'effect'], label: 'Terreur' }, { actorIndex: 0 })
    expect(s.pendingRecover?.playerIndex).toBe(0)
    expect(s.pendingRecover?.label).toBe('Terreur')
    expect(new Set(s.pendingRecover?.candidateIds)).toEqual(new Set([ally.instanceId, event.instanceId]))
    // Le joueur choisit l'Événement → il rejoint la main, l'Allié reste en défausse.
    const out = applyAction(s, { type: 'RESOLVE_RECOVER', instanceId: event.instanceId })
    expect(out.pendingRecover ?? null).toBeNull()
    expect(out.players[0].hand.some((c) => c.instanceId === event.instanceId)).toBe(true)
    expect(out.players[0].discard.some((c) => c.instanceId === ally.instanceId)).toBe(true)
  })

  it('JOUER Divination révèle Tour de passe-passe de la pile et déclenche son effet', () => {
    const divination = inst('divination-facilier')
    const tour = inst('tour-passe-passe')
    let s = facilierGame()
    s = withActive(s, {
      pawnLocation: 'royaume-vaudou',
      hand: [divination],
      auDela: [tour], // Tour de passe-passe est dans la Pile de l'Au-delà.
      power: 5,
    })
    s = { ...s, phase: 'ACTION', usedActionIds: [] }
    // On JOUE Divination (action « Jouer une carte » du Royaume du vaudou).
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: divination.instanceId })
    // La pile (1 carte) est révélée → résolution en attente.
    expect(s.pendingDivination?.cards.map((c) => c.cardId)).toEqual(['tour-passe-passe'])
    // On résout : l'effet de Tour de passe-passe se déclenche (choix de la carte).
    s = applyAction(s, { type: 'RESOLVE_DIVINATION', topInstanceIds: [tour.instanceId] })
    expect(s.pendingLookTop).toBeTruthy()
    expect(s.players[0].discard.some((c) => c.cardId === 'tour-passe-passe')).toBe(true)
  })

  it('Divination révélant Tour de passe-passe : choix interactif, puis la Divination reprend', () => {
    const tour = inst('tour-passe-passe')
    const amis = inst('amis-au-dela')
    let s = facilierGame()
    s = withActive(s, { pawnLocation: 'royaume-vaudou', auDela: [] })
    s = { ...s, pendingDivination: { playerIndex: 0, cards: [tour, amis] } }
    // Résout Tour de passe-passe d'abord, Amis ensuite.
    s = applyAction(s, { type: 'RESOLVE_DIVINATION', topInstanceIds: [tour.instanceId, amis.instanceId] })
    // Tour de passe-passe est défaussée ; le choix « garder 1 carte » est ouvert ;
    // la Divination attend Amis de l'au-delà.
    expect(s.players[0].discard.some((c) => c.cardId === 'tour-passe-passe')).toBe(true)
    expect((s.pendingLookTop?.cards.length ?? 0)).toBeGreaterThan(0)
    expect(s.pendingLookTop?.resumeDivination?.cards.map((c) => c.cardId)).toEqual(['amis-au-dela'])
    // On garde une carte → la Divination reprend avec Amis.
    const keep = s.pendingLookTop!.cards[0].instanceId
    s = applyAction(s, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [keep] })
    expect(s.pendingLookTop).toBeNull()
    expect(s.pendingDivination?.cards.map((c) => c.cardId)).toEqual(['amis-au-dela'])
    // Résout Amis (Au-delà : +2 JT puis défausse).
    const powerBefore = s.players[0].power
    s = applyAction(s, { type: 'RESOLVE_DIVINATION', topInstanceIds: [amis.instanceId] })
    expect(s.pendingDivination).toBeNull()
    expect(s.players[0].power).toBe(powerBefore + 2)
    expect(s.players[0].discard.some((c) => c.cardId === 'amis-au-dela')).toBe(true)
  })

  it('Esprits des masques (Au-delà) interrompt et renvoie les autres cartes dans la pile', () => {
    const masque = inst('esprits-masques')
    const amis = inst('amis-au-dela')
    let s = facilierGame()
    s = withActive(s, { pawnLocation: 'royaume-vaudou', auDela: [] })
    s = { ...s, pendingDivination: { playerIndex: 0, cards: [masque, amis] } }
    // On résout le masque EN PREMIER : Amis (non résolu) retourne dans la pile.
    const out = applyAction(s, { type: 'RESOLVE_DIVINATION', topInstanceIds: [masque.instanceId, amis.instanceId] })
    expect(out.players[0].auDela.map((c) => c.cardId)).toEqual(['amis-au-dela'])
    expect(out.players[0].discard.map((c) => c.cardId)).toContain('esprits-masques')
  })

  it('le Talisman s’associe à un Héros de force ≤3 joué, puis est récupéré à sa mort', () => {
    const talisman = inst('talisman')
    const charlotte = inst('charlotte', fateInstances) // Héros force 2
    const ombres = inst('esprits-ombres') // Allié force 3
    let s = facilierGame()
    s = withActive(s, {
      board: { ...s.players[0].board, parade: [ombres], 'royaume-vaudou': [talisman] },
    })
    // Charlotte est jouée (Fatalité) sur Parade : le Talisman doit la rejoindre.
    s = placeFateHeroWithEffects(s, 0, 0, charlotte, 'parade', 'Parade')
    const onParade = s.players[0].board['parade']
    const tal = onParade.find((c) => c.cardId === 'talisman')
    expect(tal?.attachedTo).toBe(charlotte.instanceId)
    expect(holdsTalisman(s.players[0])).toBe(false)

    // Facilier élimine Charlotte (Esprits des ombres, force 3 ≥ 2) → Talisman libéré.
    const after = performVanquish(s, charlotte.instanceId, [ombres.instanceId], false)
    expect(holdsTalisman(after.players[0])).toBe(true)
  })

  it('Tour de passe-passe révèle 3 cartes ; on en garde une, les autres sont défaussées', () => {
    const s = facilierGame()
    const handBefore = s.players[0].hand.length
    const discardBefore = s.players[0].discard.length
    // L'effet révèle les 3 premières cartes et ouvre le choix.
    const revealed = resolveEffect(s, { type: 'LOOK_TOP_DRAW_DISCARD', look: 3, take: 1 }, { actorIndex: 0 })
    expect(revealed.pendingLookTop?.cards).toHaveLength(3)
    const keep = revealed.pendingLookTop!.cards[1].instanceId
    // On garde la 2ᵉ carte : +1 en main, +2 en défausse.
    const out = applyAction(revealed, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [keep] })
    expect(out.pendingLookTop).toBeNull()
    expect(out.players[0].hand).toHaveLength(handBefore + 1)
    expect(out.players[0].discard).toHaveLength(discardBefore + 2)
    expect(out.players[0].hand.some((c) => c.instanceId === keep)).toBe(true)
  })

  it('Forme de grenouille réduit la force d’un Héros, qui peut alors être éliminé sans Allié', () => {
    const charlotte = inst('charlotte', fateInstances) // Héros force 2
    const frog = inst('forme-grenouille') // Objet −2, associé au Héros
    let s = facilierGame()
    const frogAttached = { ...frog, attachedTo: charlotte.instanceId }
    s = withActive(s, {
      board: { ...s.players[0].board, parade: [charlotte, frogAttached] },
    })
    // Force effective de Charlotte : 2 − 2 = 0.
    expect(effectiveStrength(s, 0, charlotte.instanceId)).toBe(0)
    // Élimination SANS aucun Allié (force 0).
    const after = performVanquish(s, charlotte.instanceId, [], false)
    const stillThere = Object.values(after.players[0].board)
      .flat()
      .some((c) => c.instanceId === charlotte.instanceId)
    expect(stillThere).toBe(false)
    expect(after.players[0].fateDiscard.some((c) => c.cardId === 'charlotte')).toBe(true)
  })

  it('jouer Forme de grenouille (action « Jouer ») l’associe au Héros et réduit sa force', () => {
    const charlotte = inst('charlotte', fateInstances) // force 2
    const frog = inst('forme-grenouille')
    let s = facilierGame()
    s = withActive(s, {
      pawnLocation: 'royaume-vaudou',
      board: { ...s.players[0].board, 'royaume-vaudou': [charlotte] },
      hand: [frog],
      power: 5,
    })
    s = { ...s, phase: 'ACTION', usedActionIds: [] }
    s = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: frog.instanceId,
      to: 'royaume-vaudou',
      attachTo: charlotte.instanceId,
    })
    const placed = s.players[0].board['royaume-vaudou'].find((c) => c.cardId === 'forme-grenouille')
    expect(placed?.attachedTo).toBe(charlotte.instanceId)
    expect(effectiveStrength(s, 0, charlotte.instanceId)).toBe(0)
  })

  it('un Héros de force > 0 exige toujours au moins un Allié', () => {
    const charlotte = inst('charlotte', fateInstances) // force 2, non réduite
    let s = facilierGame()
    s = withActive(s, { board: { ...s.players[0].board, parade: [charlotte] } })
    expect(() => performVanquish(s, charlotte.instanceId, [], false)).toThrow()
  })

  it('Poupées vaudou : à leur déplacement, on peut déplacer un Héros dans la même direction', () => {
    const poupees = inst('poupees-vaudou')
    const hero = inst('louis', fateInstances) // Héros sans effet « à la pose »
    let s = facilierGame()
    s = withActive(s, {
      pawnLocation: 'parade',
      board: { ...s.players[0].board, parade: [poupees, hero] },
    })
    s = { ...s, phase: 'ACTION', usedActionIds: [] }
    // Déplace les Poupées vers la DROITE (Parade → Chez Tiana).
    const moved = applyAction(s, {
      type: 'MOVE_CARD',
      actionId: 'move-item-ally',
      instanceId: poupees.instanceId,
      to: 'chez-tiana',
    })
    expect(moved.pendingHeroRelocate?.forcedDirection).toBe(1)
    expect(moved.pendingHeroRelocate?.optional).toBe(true)
    expect(moved.pendingHeroRelocate?.candidateIds).toContain(hero.instanceId)
    // Le Héros se déplace lui aussi d'un lieu vers la droite (Parade → Chez Tiana).
    const out = applyAction(moved, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: hero.instanceId, to: 'chez-tiana' })
    expect(out.pendingHeroRelocate).toBeNull()
    const heroLoc = out.players[0].locations.find((l) =>
      (out.players[0].board[l.id] ?? []).some((c) => c.instanceId === hero.instanceId),
    )?.id
    expect(heroLoc).toBe('chez-tiana')
  })

  it('Si près du but : place les cartes choisies dans l’Au-delà, remet le reste sur la pioche (Talisman protégé)', () => {
    const a = inst('esprits-ombres')
    const b = inst('poupees-vaudou')
    const tal = inst('talisman')
    let s = facilierGame()
    s = withActive(s, { deck: [], auDela: [] })
    s = { ...s, pendingFateScry: { chooserIndex: 0, targetIndex: 0, cards: [a, b, tal] } }
    // On tente d'envoyer a ET le Talisman dans l'Au-delà ; b revient sur la pioche.
    s = applyAction(s, {
      type: 'RESOLVE_FATE_SCRY',
      toAudelaIds: [a.instanceId, tal.instanceId],
      deckTopOrder: [b.instanceId],
    })
    expect(s.pendingFateScry).toBeNull()
    // Seul a rejoint l'Au-delà ; le Talisman est protégé (reste sur la pioche).
    expect(s.players[0].auDela.map((c) => c.cardId)).toEqual(['esprits-ombres'])
    expect(s.players[0].deck.slice(0, 2).map((c) => c.cardId)).toEqual(['poupees-vaudou', 'talisman'])
  })

  it('Joujou peut placer Esprits des masques (Allié + Objet) dans la Pile de l’Au-delà', () => {
    const joujou = inst('joujou', fateInstances)
    const masques = inst('esprits-masques')
    let s = facilierGame()
    s = withActive(s, { board: { ...s.players[0].board, parade: [masques] } })
    s = placeFateHeroWithEffects(s, 0, 0, joujou, 'parade', 'Parade')
    expect(s.players[0].board['parade'].some((c) => c.cardId === 'esprits-masques')).toBe(false)
    expect(s.players[0].auDela.some((c) => c.cardId === 'esprits-masques')).toBe(true)
  })

  it('Ray : si Ray est révélé en Fatalité, on peut aussi jouer l’autre carte', () => {
    const ray = inst('ray', fateInstances) // Héros force 1
    const charlotte = inst('charlotte', fateInstances) // Héros force 2
    let s = facilierGame()
    s = { ...s, pendingFate: { target: 0, revealed: [ray, charlotte] } }
    // On résout Ray d'abord (posé sur la Parade).
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: ray.instanceId, to: 'parade' })
    // La Fatalité se rouvre avec l'autre carte (Charlotte) grâce à Ray.
    expect(s.pendingFate?.revealed.map((c) => c.cardId)).toEqual(['charlotte'])
    // On joue alors Charlotte sur le Bayou.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: charlotte.instanceId, to: 'bayou' })
    expect(s.pendingFate).toBeNull()
    const onBoard = Object.values(s.players[0].board).flat().map((c) => c.cardId)
    expect(onBoard).toContain('ray')
    expect(onBoard).toContain('charlotte')
  })

  it('sans Ray, l’autre carte révélée n’est PAS jouable (défaussée)', () => {
    const naveen = inst('naveen', fateInstances) // Héros force 4 (pas Ray)
    const charlotte = inst('charlotte', fateInstances)
    let s = facilierGame()
    s = { ...s, pendingFate: { target: 0, revealed: [naveen, charlotte] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: naveen.instanceId, to: 'parade' })
    // Pas de Ray → pas de seconde carte ; Charlotte part en défausse Fatalité.
    expect(s.pendingFate).toBeNull()
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'charlotte')).toBe(true)
  })

  it('Canne : permet UNE action (hors Fatalité) sur un lieu voisin, 1×/tour', () => {
    const canne = inst('canne')
    let s = facilierGame()
    s = withActive(s, { pawnLocation: 'parade', board: { ...s.players[0].board, parade: [canne] } })
    s = { ...s, phase: 'ACTION', usedActionIds: [] }
    // Ouvre la Canne → choix du lieu voisin.
    s = applyAction(s, { type: 'USE_CANNE' })
    expect(s.pendingGiantAction?.viaCanne).toBe(true)
    // Agit depuis Chez Tiana (voisin de Parade).
    s = applyAction(s, { type: 'RESOLVE_GIANT_LOCATION', locationId: 'chez-tiana' })
    expect(s.actAtLocation).toBe('chez-tiana')
    // La Fatalité du voisin est exclue.
    expect(() => applyAction(s, { type: 'FATE', actionId: 'fate' })).toThrow()
    // Une action disponible (Gagner 1) est jouable.
    const powerBefore = s.players[0].power
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.players[0].power).toBe(powerBefore + 1)
    expect(s.actAtLocation).toBeFalsy()
    // La Canne ne peut pas resservir ce tour.
    expect(() => applyAction(s, { type: 'USE_CANNE' })).toThrow()
  })

  it('Poupées vaudou : le déplacement du Héros est facultatif (on peut passer)', () => {
    const poupees = inst('poupees-vaudou')
    const hero = inst('louis', fateInstances)
    let s = facilierGame()
    s = withActive(s, {
      pawnLocation: 'parade',
      board: { ...s.players[0].board, parade: [poupees, hero] },
    })
    s = { ...s, phase: 'ACTION', usedActionIds: [] }
    const moved = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: poupees.instanceId, to: 'chez-tiana' })
    const out = applyAction(moved, { type: 'SKIP_HERO_RELOCATE' })
    expect(out.pendingHeroRelocate).toBeNull()
    // Le Héros n'a pas bougé.
    const heroLoc = out.players[0].locations.find((l) =>
      (out.players[0].board[l.id] ?? []).some((c) => c.instanceId === hero.instanceId),
    )?.id
    expect(heroLoc).toBe('parade')
  })
})
