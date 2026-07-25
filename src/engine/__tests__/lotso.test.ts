import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffects, performVanquish } from '../effects'
import { effectiveStrength, hasReachedObjective, coveredTopActionIdsAt, conditionIsTriggered, heroPlacementLocations, activatableCards, lotsoToRoomCandidates, lotsoReducibleHeroes, lotsoHasHeroInRoom } from '../rules'
import { lotso } from '../../data/villains/lotso'
import { lotsoCards } from '../../data/villains/lotso.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: lotso,
        deckCards: buildDeckInstances(lotsoCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(lotsoCards, 'fate', 'p0f:'),
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

const ROOM = 'salle-des-chenilles'

describe('Lotso — mise en place', () => {
  it('Buzz l’Éclair (Gardien) posé sur la Salle des Chenilles ; objectif LOTSO_GATHER', () => {
    const s = game()
    const room = s.players[0].board[ROOM] ?? []
    const buzz = room.find((c) => c.isBuzz)
    expect(buzz?.buzzMode).toBe('guardian')
    expect(s.players[0].objective.type).toBe('LOTSO_GATHER')
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Lotso — Vanquish spécial & réductions', () => {
  it('éliminer un Héros le réduit à 0 et le LAISSE en place (allié défaussé)', () => {
    const base = game()
    const hero = card('jessie', 'hero', { strength: 3 })
    const ally = card('twitch', 'ally', { strength: 5 })
    // On teste la LOGIQUE d'élimination via performVanquish (le seul Vaincre du plateau est
    // en haut de la Décharge, recouvert par le Héros). Pas de Gardien sur ce lieu.
    const s0 = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [hero, ally] } }],
    } as GameState
    const s = performVanquish(s0, hero.instanceId, [ally.instanceId], false)
    const cell = s.players[0].board[ROOM] ?? []
    // Héros toujours présent, force 0 ; allié défaussé.
    expect(cell.some((c) => c.instanceId === hero.instanceId)).toBe(true)
    expect(effectiveStrength(s, 0, hero.instanceId)).toBe(0)
    expect(cell.some((c) => c.instanceId === ally.instanceId)).toBe(false)
    expect(s.players[0].discard.some((c) => c.instanceId === ally.instanceId)).toBe(true)
    // Pas en défausse Fatalité (il reste en jeu).
    expect(s.players[0].fateDiscard.some((c) => c.instanceId === hero.instanceId)).toBe(false)
  })

  it('Buzz l’Éclair (Gardien) recouvre les actions du haut comme un Héros', () => {
    const base = game()
    const buzz = card('buzz-l-eclair', 'ally', { strength: 4, isBuzz: true, buzzMode: 'guardian' })
    // Sur la Cour de Récréation (haut : Jouer, Défausser), Buzz Gardien recouvre les 2.
    const p = { ...base.players[0], board: { ...base.players[0].board, [ROOM]: [], 'cour-de-recreation': [buzz] } }
    const covered = coveredTopActionIdsAt(p, 'cour-de-recreation')
    expect(covered.has('play-card')).toBe(true)
    expect(covered.has('discard')).toBe(true)
    // En mode démo, il ne recouvre rien.
    const demo = { ...buzz, buzzMode: 'demo' as const }
    const p2 = { ...base.players[0], board: { ...base.players[0].board, [ROOM]: [], 'cour-de-recreation': [demo] } }
    expect(coveredTopActionIdsAt(p2, 'cour-de-recreation').size).toBe(0)
  })

  it('Buzz l’Éclair (Gardien) protège les Héros de son lieu du Vaincre', () => {
    const base = game()
    const buzz = (base.players[0].board[ROOM] ?? []).find((c) => c.isBuzz)!
    const hero = card('jessie', 'hero', { strength: 3 })
    const ally = card('twitch', 'ally', { strength: 5 })
    const s0 = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [buzz, hero, ally] } }],
    } as GameState
    expect(() => performVanquish(s0, hero.instanceId, [ally.instanceId], false)).toThrow(/Gardien/)
  })

  it('Buzz en mode démo : élimine un Héros (+ autre Allié) → force 0 ET déplacé sur la Salle des Chenilles', () => {
    const base = game()
    const demo = card('buzz-mode-demo', 'ally', { strength: 1, isBuzz: true, buzzMode: 'demo' })
    const ally = card('twitch', 'ally', { strength: 5 })
    const hero = card('jessie', 'hero', { strength: 3 })
    // Buzz démo (un autre Allié participe) — on teste la logique via performVanquish.
    // Le Héros est sur un autre lieu et doit rejoindre la Salle des Chenilles.
    const s0 = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [], 'decharge-municipale': [demo, ally, hero] } }],
    } as GameState
    const s = performVanquish(s0, hero.instanceId, [demo.instanceId, ally.instanceId], false)
    // Héros sur la Salle des Chenilles à force 0 ; Buzz démo non défaussé (reste sur place).
    expect((s.players[0].board[ROOM] ?? []).some((c) => c.instanceId === hero.instanceId)).toBe(true)
    expect(effectiveStrength(s, 0, hero.instanceId)).toBe(0)
    expect((s.players[0].board['decharge-municipale'] ?? []).some((c) => c.instanceId === demo.instanceId)).toBe(true)
  })

  it('Enfermés réduit de 1 la force des Héros de la Salle des Chenilles', () => {
    const base = game()
    const hero = card('jessie', 'hero', { strength: 3 })
    const s0 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [hero] } }] } as GameState
    const s = resolveEffects(s0, [{ type: 'LOTSO_REDUCE', scope: 'room', target: 'all', amount: 1 }], { actorIndex: 0 })
    expect(effectiveStrength(s, 0, hero.instanceId)).toBe(2)
  })

  it('Enfermés / Nouveaux jouets : gate « Héros dans la Salle » — Buzz seul ne compte pas', () => {
    const base = game()
    const buzz = (base.players[0].board[ROOM] ?? []).find((c) => c.isBuzz)!
    // Buzz seul dans la Salle → pas de Héros → injouable.
    const sBuzzOnly = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [buzz] } }] } as GameState
    expect(lotsoHasHeroInRoom(sBuzzOnly, 0)).toBe(false)
    // Un Héros dans la Salle → jouable.
    const hero = card('jessie', 'hero', { strength: 3 })
    const sHero = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [buzz, hero] } }] } as GameState
    expect(lotsoHasHeroInRoom(sHero, 0)).toBe(true)
  })

  it('Chapeau de Woody : −1 à tous les Héros sauf Woody', () => {
    const base = game()
    const hat = card('chapeau-de-woody', 'item', { strengthMod: { target: 'heroes-realm', delta: -1, exceptCardId: 'woody' } })
    const woody = card('woody', 'hero', { strength: 1 })
    const rex = card('rex', 'hero', { strength: 1 })
    const s = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, 'decharge-municipale': [hat, woody, rex] } }] } as GameState
    expect(effectiveStrength(s, 0, woody.instanceId)).toBe(1) // Woody épargné
    expect(effectiveStrength(s, 0, rex.instanceId)).toBe(0) // 1 − 1
  })

  it('LOTSO_REDUCE target one : choix interactif du Héros à réduire (−3)', () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('rex', 'hero', { strength: 1 })
    const s0 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, bibliotheque: [h1], 'decharge-municipale': [h2] } }] } as GameState
    // 2 Héros éligibles → ouvre le choix (pas d'auto-résolution).
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_REDUCE', scope: 'all', target: 'one', amount: 3 }], { actorIndex: 0 })
    expect(s1.pendingLotsoTarget?.kind).toBe('reduce')
    expect(s1.pendingLotsoTarget?.candidateIds).toEqual(expect.arrayContaining([h1.instanceId, h2.instanceId]))
    // Le joueur choisit Jessie : sa force passe de 3 à 0.
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_TARGET', instanceId: h1.instanceId })
    expect(s2.pendingLotsoTarget).toBeNull()
    expect(effectiveStrength(s2, 0, h1.instanceId)).toBe(0)
    expect(effectiveStrength(s2, 0, h2.instanceId)).toBe(1) // l'autre intact
  })

  it('Pas l’âge minimum : choix interactif du Héros/Buzz à amener sur la Salle des Chenilles', () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('rex', 'hero', { strength: 1 })
    const s0 = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [], bibliotheque: [h1], 'decharge-municipale': [h2] } }],
    } as GameState
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_MOVE', scope: 'to-room', includeBuzz: true }], { actorIndex: 0 })
    expect(s1.pendingLotsoTarget?.kind).toBe('move-to-room')
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_TARGET', instanceId: h2.instanceId })
    expect((s2.players[0].board[ROOM] ?? []).some((c) => c.instanceId === h2.instanceId)).toBe(true)
  })

  it('Quelque chose se brisa : injouable sans Héros hors de la Salle des Chenilles', () => {
    const base = game()
    const cond = card('quelque-chose-se-brisa', 'condition', {
      trigger: { type: 'opponent-discarded-ge', value: 1 },
      effects: [{ type: 'LOTSO_MOVE', scope: 'all-to-room' }],
    })
    const hero = card('jessie', 'hero', { strength: 3 })
    // Joueur 1 = Lotso (réagit) ; joueur 0 = adversaire actif qui a défaussé.
    const mk = (loc: string) =>
      ({
        ...base,
        activePlayer: 0,
        activeDiscardedCount: 1,
        players: [{ ...base.players[0] }, { ...base.players[0], board: { ...base.players[0].board, [ROOM]: [], [loc]: [hero] } }],
      }) as GameState
    // Héros uniquement DANS la Salle → injouable.
    expect(conditionIsTriggered(mk(ROOM), cond, 1)).toBe(false)
    // Héros HORS de la Salle → jouable.
    expect(conditionIsTriggered(mk('bibliotheque'), cond, 1)).toBe(true)
  })

  it('Big Baby : capacité ACTIVÉE → dévoile jusqu’à un Héros, puis le joueur CHOISIT le lieu (hors Salle)', () => {
    const base = game()
    const bigBaby = card('big-baby', 'ally', { strength: 3, activatedCost: 0 })
    const filler = card('un-seul-moyen-de-sortir', 'item')
    const hero = card('rex', 'hero', { strength: 1 })
    // Figurine sur la Bibliothèque (action Activer en bas) ; Big Baby posé ; pioche = filler, Héros.
    const s0 = {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      players: [{
        ...base.players[0],
        pawnLocation: 'bibliotheque',
        board: { ...base.players[0].board, bibliotheque: [bigBaby] },
        fateDeck: [filler, hero],
        fateDiscard: [],
      }],
    } as GameState
    // Big Baby est bien activable (Héros présent dans la pioche).
    expect(activatableCards(s0).some((c) => c.cardId === 'big-baby')).toBe(true)
    const revealed = applyAction(s0, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: bigBaby.instanceId })
    // Les cartes dévoilées sont d'abord MONTRÉES (modale d'info), Héros surligné, puis on
    // acquitte avant de choisir le lieu.
    expect(revealed.pendingReveal?.cards.map((c) => c.instanceId)).toEqual([filler.instanceId, hero.instanceId])
    expect(revealed.pendingReveal?.heroInstanceIds).toEqual([hero.instanceId])
    const s1 = applyAction(revealed, { type: 'ACKNOWLEDGE_REVEAL' })
    // Héros pas encore posé : choix du lieu ouvert (hors Salle des Chenilles) ; reste défaussé.
    expect(s1.pendingHeroPlacement?.hero.instanceId).toBe(hero.instanceId)
    expect(s1.players[0].fateDiscard.some((c) => c.instanceId === filler.instanceId)).toBe(true)
    expect(heroPlacementLocations(s1, s1.pendingHeroPlacement!.hero, 0)).not.toContain(ROOM)
    const s2 = applyAction(s1, { type: 'RESOLVE_HERO_PLACEMENT', locationId: 'decharge-municipale' })
    expect(s2.pendingHeroPlacement).toBeUndefined()
    expect((s2.players[0].board['decharge-municipale'] ?? []).some((c) => c.instanceId === hero.instanceId)).toBe(true)
  })

  it('Big Baby : NON activable si aucun Héros dans la pioche NI la défausse Fatalité', () => {
    const base = game()
    const bigBaby = card('big-baby', 'ally', { strength: 3, activatedCost: 0 })
    const s0 = {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      players: [{
        ...base.players[0],
        pawnLocation: 'bibliotheque',
        board: { ...base.players[0].board, bibliotheque: [bigBaby] },
        fateDeck: [card('un-seul-moyen-de-sortir', 'item')],
        fateDiscard: [],
      }],
    } as GameState
    expect(activatableCards(s0).some((c) => c.cardId === 'big-baby')).toBe(false)
  })

  it('Réinitialisation : Buzz passe en mode Démo puis le joueur choisit le lieu de destination', () => {
    const base = game()
    const buzz = (base.players[0].board[ROOM] ?? []).find((c) => c.isBuzz)!
    const s0 = {
      ...base,
      players: [{ ...base.players[0], pawnLocation: ROOM }],
    } as GameState
    // Flip Gardien → Démo : Buzz reste sur place ET un choix de lieu s'ouvre.
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_FLIP_BUZZ', to: 'demo', moveTo: 'bottom' }], { actorIndex: 0 })
    expect(s1.pendingLotsoBuzzMove?.playerIndex).toBe(0)
    const flipped = (s1.players[0].board[ROOM] ?? []).find((c) => c.isBuzz)
    expect(flipped?.buzzMode).toBe('demo')
    expect(s1.pendingLotsoBuzzMove?.buzzInstanceId).toBe(flipped?.instanceId)
    // Le joueur choisit la Décharge Municipale.
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_BUZZ_MOVE', to: 'decharge-municipale' })
    expect(s2.pendingLotsoBuzzMove).toBeNull()
    expect((s2.players[0].board[ROOM] ?? []).some((c) => c.isBuzz)).toBe(false)
    expect((s2.players[0].board['decharge-municipale'] ?? []).some((c) => c.instanceId === buzz.instanceId)).toBe(true)
  })

  it('Réinitialisation : choisir le MÊME lieu que Buzz ne duplique PAS la tuile', () => {
    const base = game()
    const s1 = resolveEffects({ ...base, players: [{ ...base.players[0], pawnLocation: ROOM }] } as GameState, [{ type: 'LOTSO_FLIP_BUZZ', to: 'demo', moveTo: 'bottom' }], { actorIndex: 0 })
    // Buzz a été retourné sur place (Salle des Chenilles) ; on choisit ce même lieu.
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_BUZZ_MOVE', to: ROOM })
    expect(s2.pendingLotsoBuzzMove).toBeNull()
    // Une SEULE tuile Buzz dans tout le royaume.
    const allBuzz = s2.players[0].locations.flatMap((l) => (s2.players[0].board[l.id] ?? []).filter((c) => c.isBuzz))
    expect(allBuzz).toHaveLength(1)
    expect((s2.players[0].board[ROOM] ?? []).filter((c) => c.isBuzz)).toHaveLength(1)
  })

  it('Bien le bonjour : injouable sans Héros sur le lieu du pion ; sinon choix interactif (réduction à 0)', () => {
    const base = game()
    const cond = card('bien-le-bonjour', 'condition', {
      trigger: { type: 'opponent-vanquished-hero-strength-ge', value: 2 },
      effects: [{ type: 'LOTSO_REDUCE', scope: 'at-pawn', target: 'one', toZero: true }],
    })
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('bayonne', 'hero', { strength: 2 })
    // Joueur 1 = Lotso (réagit) ; joueur 0 = adversaire actif ayant éliminé un Héros force ≥2.
    const mk = (locOfHeroes: string | null) => {
      const lotsoP = {
        ...base.players[0],
        pawnLocation: 'bibliotheque',
        board: { ...base.players[0].board, [ROOM]: [], bibliotheque: locOfHeroes === 'bibliotheque' ? [h1, h2] : [] },
      }
      return {
        ...base,
        activePlayer: 0,
        lastVanquishedHeroStrength: 3,
        players: [{ ...base.players[0] }, lotsoP],
      } as GameState
    }
    // Aucun Héros sur le lieu du pion (Bibliothèque) → injouable.
    expect(conditionIsTriggered(mk(null), cond, 1)).toBe(false)
    // 2 Héros sur le lieu du pion → jouable.
    expect(conditionIsTriggered(mk('bibliotheque'), cond, 1)).toBe(true)
    // Résolution : 2 candidats → choix interactif (pas d'auto-pick).
    const s1 = resolveEffects(mk('bibliotheque'), cond.effects!, { actorIndex: 1 })
    expect(s1.pendingLotsoTarget?.kind).toBe('reduce')
    expect(s1.pendingLotsoTarget?.candidateIds).toEqual(expect.arrayContaining([h1.instanceId, h2.instanceId]))
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_TARGET', instanceId: h2.instanceId })
    expect(effectiveStrength(s2, 1, h2.instanceId)).toBe(0)
    expect(effectiveStrength(s2, 1, h1.instanceId)).toBe(3) // l'autre intact
  })

  it('Le Bibliothécaire : dépense X Pouvoir RÉPARTIE entre plusieurs Héros (1 jeton = −1 force)', () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('bayonne', 'hero', { strength: 2 })
    const s0 = {
      ...base,
      players: [{
        ...base.players[0],
        power: 5,
        board: { ...base.players[0].board, [ROOM]: [], bibliotheque: [h1], 'decharge-municipale': [h2] },
      }],
    } as GameState
    // Ouvre la répartition (Héros présents + Pouvoir disponible).
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_BOOKWORM' }], { actorIndex: 0 })
    expect(s1.pendingLotsoBookworm?.playerIndex).toBe(0)
    // Exemple : 3 jetons → −2 sur Jessie, −1 sur Bayonne.
    let s = applyAction(s1, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h1.instanceId })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h1.instanceId })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h2.instanceId })
    expect(effectiveStrength(s, 0, h1.instanceId)).toBe(1) // 3 − 2
    expect(effectiveStrength(s, 0, h2.instanceId)).toBe(1) // 2 − 1
    expect(s.players[0].power).toBe(2) // 5 − 3
    expect(s.pendingLotsoBookworm).not.toBeNull()
    // Terminer : ferme le choix sans dépenser plus.
    const sEnd = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: null })
    expect(sEnd.pendingLotsoBookworm).toBeNull()
    expect(sEnd.players[0].power).toBe(2)
  })

  it('Le Bibliothécaire : se ferme tout seul quand le Pouvoir est épuisé', () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 3 })
    const s0 = {
      ...base,
      players: [{ ...base.players[0], power: 1, board: { ...base.players[0].board, [ROOM]: [], bibliotheque: [h1] } }],
    } as GameState
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_BOOKWORM' }], { actorIndex: 0 })
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h1.instanceId })
    expect(s2.players[0].power).toBe(0)
    expect(effectiveStrength(s2, 0, h1.instanceId)).toBe(2)
    expect(s2.pendingLotsoBookworm).toBeNull() // plus de Pouvoir → clos
  })

  it('Pas l’âge minimum : injouable si Buzz dans la Salle et aucun Héros hors de la Salle', () => {
    const base = game()
    const buzz = (base.players[0].board[ROOM] ?? []).find((c) => c.isBuzz)!
    // Buzz dans la Salle, aucun Héros ailleurs → aucun candidat.
    const s0 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [buzz] } }] } as GameState
    expect(lotsoToRoomCandidates(s0, 0)).toHaveLength(0)
    // Un Héros hors de la Salle → candidat (jouable).
    const hero = card('jessie', 'hero', { strength: 3 })
    const s1 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [buzz], bibliotheque: [hero] } }] } as GameState
    expect(lotsoToRoomCandidates(s1, 0)).toEqual([hero.instanceId])
  })

  it('Patrouille de nuit : injouable sans Héros hors de la Salle ; choix interactif sinon', () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('rex', 'hero', { strength: 1 })
    // Aucun Héros hors de la Salle → aucun candidat 'not-room'.
    const sEmpty = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [h1] } }] } as GameState
    expect(lotsoReducibleHeroes(sEmpty, 0, 'not-room')).toHaveLength(0)
    // 2 Héros hors de la Salle → choix interactif.
    const s0 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [], bibliotheque: [h1], 'decharge-municipale': [h2] } }] } as GameState
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_REDUCE', scope: 'not-room', target: 'one', amount: 1 }], { actorIndex: 0 })
    expect(s1.pendingLotsoTarget?.kind).toBe('reduce')
    expect(s1.pendingLotsoTarget?.candidateIds).toEqual(expect.arrayContaining([h1.instanceId, h2.instanceId]))
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_TARGET', instanceId: h1.instanceId })
    expect(effectiveStrength(s2, 0, h1.instanceId)).toBe(2)
  })

  it('Les nouveaux jouets : réduit chaque Héros de la Salle du NOMBRE de Héros présents ; injouable si Salle vide', () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 5 })
    const h2 = card('bayonne', 'hero', { strength: 5 })
    const h3 = card('woody', 'hero', { strength: 5 })
    // 3 Héros dans la Salle → chacun réduit de 3.
    const s0 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [h1, h2, h3] } }] } as GameState
    expect(lotsoHasHeroInRoom(s0, 0)).toBe(true)
    const s1 = resolveEffects(s0, [{ type: 'LOTSO_REDUCE', scope: 'room', target: 'all', byRoomCount: true }], { actorIndex: 0 })
    expect(effectiveStrength(s1, 0, h1.instanceId)).toBe(2)
    expect(effectiveStrength(s1, 0, h2.instanceId)).toBe(2)
    expect(effectiveStrength(s1, 0, h3.instanceId)).toBe(2)
    // Aucun Héros dans la Salle → injouable (gate).
    const sEmpty = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [] } }] } as GameState
    expect(lotsoHasHeroInRoom(sEmpty, 0)).toBe(false)
  })

  it('Parfumé à la fraise : injouable si la défausse Méchant est vide', () => {
    const base = game()
    const cond = card('parfume-a-la-fraise', 'condition', {
      trigger: { type: 'opponent-gained-power-ge', value: 1 },
      effects: [{ type: 'RESHUFFLE_DISCARD_AND_DRAW', count: 0 }],
    })
    const filler = card('un-seul-moyen-de-sortir', 'effect')
    // Joueur 1 = Lotso (réagit) ; joueur 0 = adversaire actif ayant gagné du Pouvoir.
    const mk = (discard: CardInstance[]) =>
      ({
        ...base,
        activePlayer: 0,
        activeGainedPower: 2,
        players: [{ ...base.players[0] }, { ...base.players[0], discard }],
      }) as GameState
    // Défausse vide → injouable.
    expect(conditionIsTriggered(mk([]), cond, 1)).toBe(false)
    // Défausse non vide → jouable.
    expect(conditionIsTriggered(mk([filler]), cond, 1)).toBe(true)
  })

  it('Flex : capacité ACTIVÉE → choix du Héros/Buzz puis du lieu de destination (≠ lieu de Flex)', () => {
    const base = game()
    const flex = card('flex', 'ally', { strength: 2, activatedCost: 0 })
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('rex', 'hero', { strength: 1 })
    // Flex + 2 Héros sur la Décharge ; figurine sur la Bibliothèque (action Activer).
    const s0 = {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      players: [{
        ...base.players[0],
        pawnLocation: 'bibliotheque',
        board: { ...base.players[0].board, [ROOM]: [], 'decharge-municipale': [flex, h1, h2] },
      }],
    } as GameState
    expect(activatableCards(s0).some((c) => c.cardId === 'flex')).toBe(true)
    const s1 = applyAction(s0, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: flex.instanceId })
    // Phase 1 : 2 candidats, pas encore de carte choisie.
    expect(s1.pendingLotsoFlex?.candidateIds).toEqual(expect.arrayContaining([h1.instanceId, h2.instanceId]))
    expect(s1.pendingLotsoFlex?.cardInstanceId).toBeUndefined()
    const s2 = applyAction(s1, { type: 'RESOLVE_LOTSO_FLEX', cardInstanceId: h1.instanceId })
    expect(s2.pendingLotsoFlex?.cardInstanceId).toBe(h1.instanceId)
    // Phase 2 : choix du lieu (Salle des Chenilles).
    const s3 = applyAction(s2, { type: 'RESOLVE_LOTSO_FLEX', to: ROOM })
    expect(s3.pendingLotsoFlex).toBeNull()
    expect((s3.players[0].board[ROOM] ?? []).some((c) => c.instanceId === h1.instanceId)).toBe(true)
    expect((s3.players[0].board['decharge-municipale'] ?? []).some((c) => c.instanceId === h1.instanceId)).toBe(false)
  })

  it('Flex : NON activable si aucun Héros/Buzz sur le lieu de Flex', () => {
    const base = game()
    const flex = card('flex', 'ally', { strength: 2, activatedCost: 0 })
    const s0 = {
      ...base,
      phase: 'ACTION',
      activePlayer: 0,
      players: [{
        ...base.players[0],
        pawnLocation: 'bibliotheque',
        board: { ...base.players[0].board, [ROOM]: [], bibliotheque: [flex] },
      }],
    } as GameState
    expect(activatableCards(s0).some((c) => c.cardId === 'flex')).toBe(false)
  })

  it('objectif atteint : 4 Héros à force 0 sur la Salle des Chenilles + Buzz présent', () => {
    const base = game()
    const buzz = (base.players[0].board[ROOM] ?? []).find((c) => c.isBuzz)!
    const heroes = ['bayonne', 'jessie', 'rex', 'woody'].map((id) => card(id, 'hero', { strength: 2, permanentStrengthDelta: -2 }))
    const s = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: [buzz, ...heroes] } }] } as GameState
    expect(hasReachedObjective(s, 0)).toBe(true)
    // Sans Buzz : non atteint.
    const s2 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, [ROOM]: heroes } }] } as GameState
    expect(hasReachedObjective(s2, 0)).toBe(false)
  })
})

describe('Lotso — Bienvenue à Sunnyside : les cartes dévoilées sont MONTRÉES', () => {
  // Le défilé de la pioche Fatalité (jusqu'au 1ᵉʳ Héros) était invisible : seule une ligne
  // de journal en parlait. On réutilise la modale d'info existante (pendingReveal).
  it('affiche les cartes dévoilées, Héros surligné, et le pose sur la Salle des Chenilles', () => {
    const base = game()
    const filler1 = card('un-seul-moyen-de-sortir', 'item')
    const filler2 = card('un-seul-moyen-de-sortir', 'item')
    const hero = card('rex', 'hero', { strength: 1 })
    const s0 = {
      ...base,
      players: [{ ...base.players[0], fateDeck: [filler1, filler2, hero], fateDiscard: [] }],
    } as GameState
    const s = resolveEffects(s0, [{ type: 'LOTSO_REVEAL_HERO', atRoom: true }], {
      actorIndex: 0,
      sourceCardName: 'Bienvenue à Sunnyside',
    })
    // Modale d'info : les 3 cartes dans l'ORDRE de révélation, le Héros identifié.
    expect(s.pendingReveal?.playerIndex).toBe(0)
    expect(s.pendingReveal?.title).toBe('Bienvenue à Sunnyside')
    expect(s.pendingReveal?.cards.map((c) => c.instanceId)).toEqual([
      filler1.instanceId,
      filler2.instanceId,
      hero.instanceId,
    ])
    expect(s.pendingReveal?.heroInstanceIds).toEqual([hero.instanceId])
    // Le Héros est bien posé sur la Salle des Chenilles, les autres défaussées.
    expect((s.players[0].board[ROOM] ?? []).some((c) => c.instanceId === hero.instanceId)).toBe(true)
    expect(s.players[0].fateDiscard.map((c) => c.instanceId)).toEqual([filler1.instanceId, filler2.instanceId])
    // Acquitter referme la modale sans rien changer d'autre.
    const after = applyAction(s, { type: 'ACKNOWLEDGE_REVEAL' })
    expect(after.pendingReveal ?? null).toBeNull()
    expect((after.players[0].board[ROOM] ?? []).some((c) => c.instanceId === hero.instanceId)).toBe(true)
  })

  it('aucun Héros dans la pioche : les cartes dévoilées sont montrées quand même', () => {
    const base = game()
    const filler = card('un-seul-moyen-de-sortir', 'item')
    const s0 = { ...base, players: [{ ...base.players[0], fateDeck: [filler], fateDiscard: [] }] } as GameState
    const s = resolveEffects(s0, [{ type: 'LOTSO_REVEAL_HERO', atRoom: true }], { actorIndex: 0 })
    expect(s.pendingReveal?.cards.map((c) => c.instanceId)).toEqual([filler.instanceId])
    expect(s.pendingReveal?.heroInstanceIds).toEqual([])
  })
})

describe('Lotso — Jessie : la défausse d’un Allié est un CHOIX (et facultative)', () => {
  // « Vous pouvez défausser un Allié » : l'effet défaussait d'office l'Allié le plus fort.
  // Or Lotso peut amener Jessie LUI-MÊME (Big Baby) — il doit pouvoir refuser, et choisir.
  const twoAllies = () => {
    const base = game()
    const a1 = card('twitch', 'ally', { strength: 5 })
    const a2 = card('tchac', 'ally', { strength: 2 })
    return {
      a1,
      a2,
      state: {
        ...base,
        activePlayer: 0,
        players: [{ ...base.players[0], board: { ...base.players[0].board, 'decharge-municipale': [a1, a2] } }],
      } as GameState,
    }
  }

  it('ouvre le choix (rien n’est défaussé tant qu’on n’a pas tranché)', () => {
    const { state, a1, a2 } = twoAllies()
    const s = resolveEffects(state, [{ type: 'LOTSO_FATE_DISCARD_ALLY', optional: true }], { actorIndex: 0 })
    expect(s.pendingFateDiscardAlly).toMatchObject({ chooserIndex: 0, targetIndex: 0, optional: true })
    expect(s.pendingFateDiscardAlly?.candidateIds).toEqual([a1.instanceId, a2.instanceId])
    expect(s.players[0].discard).toHaveLength(0)
  })

  it('on peut défausser le PLUS FAIBLE (l’auto-pick prenait le plus fort)', () => {
    const { state, a1, a2 } = twoAllies()
    let s = resolveEffects(state, [{ type: 'LOTSO_FATE_DISCARD_ALLY', optional: true }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_FATE_DISCARD_ALLY', instanceId: a2.instanceId })
    expect(s.players[0].discard.some((c) => c.instanceId === a2.instanceId)).toBe(true)
    expect(Object.values(s.players[0].board).flat().some((c) => c.instanceId === a1.instanceId)).toBe(true)
  })

  it('on peut DÉCLINER : aucun Allié défaussé', () => {
    const { state } = twoAllies()
    let s = resolveEffects(state, [{ type: 'LOTSO_FATE_DISCARD_ALLY', optional: true }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_FATE_DISCARD_ALLY', instanceId: null })
    expect(s.pendingFateDiscardAlly ?? null).toBeNull()
    expect(s.players[0].discard).toHaveLength(0)
    expect(Object.values(s.players[0].board).filter((cs) => cs.some((c) => c.type === 'ally'))).not.toHaveLength(0)
  })

  it('« Lotso était son préféré » (sans « vous pouvez ») : décliner est REFUSÉ', () => {
    const { state } = twoAllies()
    const s = resolveEffects(state, [{ type: 'LOTSO_FATE_DISCARD_ALLY' }], { actorIndex: 0 })
    expect(s.pendingFateDiscardAlly?.optional).toBeUndefined()
    expect(() => applyAction(s, { type: 'RESOLVE_FATE_DISCARD_ALLY', instanceId: null })).toThrow(/devez défausser/)
  })

  it('la donnée de Jessie porte bien le drapeau facultatif', () => {
    const jessie = buildDeckInstances(lotsoCards, 'fate', 'j:').find((c) => c.cardId === 'jessie')!
    expect(jessie.onPlace?.[0]).toEqual({ type: 'LOTSO_FATE_DISCARD_ALLY', optional: true })
  })
})

describe('Lotso — Le Bibliothécaire : la QUANTITÉ de jetons est choisie', () => {
  const withHeroes = () => {
    const base = game()
    const h1 = card('jessie', 'hero', { strength: 3 })
    const h2 = card('woody', 'hero', { strength: 4 })
    return {
      h1,
      h2,
      state: {
        ...base,
        activePlayer: 0,
        players: [{
          ...base.players[0],
          power: 6,
          board: { ...base.players[0].board, 'cour-de-recreation': [h1], 'decharge-municipale': [h2] },
        }],
      } as GameState,
    }
  }

  it('`count` applique plusieurs jetons d’un coup et garde la répartition ouverte', () => {
    const { state, h2 } = withHeroes()
    let s = resolveEffects(state, [{ type: 'LOTSO_BOOKWORM' }], { actorIndex: 0 })
    expect(s.pendingLotsoBookworm).toMatchObject({ playerIndex: 0, spent: 0 })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h2.instanceId, count: 3 })
    expect(effectiveStrength(s, 0, h2.instanceId)).toBe(1) // 4 − 3
    expect(s.players[0].power).toBe(3) // 6 − 3
    expect(s.pendingLotsoBookworm).toMatchObject({ spent: 3 })
  })

  it('répartition entre PLUSIEURS Héros, puis clôture', () => {
    const { state, h1, h2 } = withHeroes()
    let s = resolveEffects(state, [{ type: 'LOTSO_BOOKWORM' }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h1.instanceId, count: 2 })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h2.instanceId, count: 1 })
    expect(effectiveStrength(s, 0, h1.instanceId)).toBe(1)
    expect(effectiveStrength(s, 0, h2.instanceId)).toBe(3)
    expect(s.players[0].power).toBe(3)
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: null })
    expect(s.pendingLotsoBookworm ?? null).toBeNull()
  })

  it('`count` est borné par le Pouvoir restant (pas de dette)', () => {
    const { state, h2 } = withHeroes()
    const poor = { ...state, players: [{ ...state.players[0], power: 2 }] } as GameState
    let s = resolveEffects(poor, [{ type: 'LOTSO_BOOKWORM' }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h2.instanceId, count: 5 })
    expect(s.players[0].power).toBe(0)
    expect(effectiveStrength(s, 0, h2.instanceId)).toBe(2) // 4 − 2 seulement
    expect(s.pendingLotsoBookworm ?? null).toBeNull() // plus de Pouvoir → clos
  })

  it('sans `count`, on retombe sur 1 jeton (comportement du bot)', () => {
    const { state, h2 } = withHeroes()
    let s = resolveEffects(state, [{ type: 'LOTSO_BOOKWORM' }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: h2.instanceId })
    expect(s.players[0].power).toBe(5)
    expect(s.pendingLotsoBookworm).toMatchObject({ spent: 1 })
  })
})
