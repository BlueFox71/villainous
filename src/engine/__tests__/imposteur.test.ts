// L'Imposteur — carte Tuer : défausse interactive d'un Coéquipier + suspicion.
import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { moveCrewmatesEndOfTurn, crewmateEndOfTurn } from '../crewmates'
import { hasReachedObjective, coveredTopActionIdsAt, conditionIsTriggered } from '../rules'
import type { Crewmate } from '../types'
import { imposteur } from '../../data/villains/imposteur'
import { imposteurCards } from '../../data/villains/imposteur.cards'
import { buildDeckInstances } from '../../data/types'
import type { GameState } from '../types'

const villainInstances = buildDeckInstances(imposteurCards, 'villain', 'p0:')
const fateInstances = buildDeckInstances(imposteurCards, 'fate', 'p0f:')

function imposteurGame(): GameState {
  return createInitialGame(
    [{ villain: imposteur, deckCards: villainInstances, fateCards: fateInstances }],
    42,
  )
}

describe("L'Imposteur — Tuer", () => {
  it('place les 8 Coéquipiers sur les cases du haut au départ', () => {
    const s = imposteurGame()
    const crew = s.players[0].crewmates ?? []
    expect(crew).toHaveLength(8)
    expect(crew.every((c) => c.row === 'top' && !c.suspect && !c.discarded)).toBe(true)
    // 2 par lieu (pion à electrical).
    expect(crew.filter((c) => c.locationId === 'electrical')).toHaveLength(2)
  })

  it('cible les Coéquipiers du lieu du pion', () => {
    const s = imposteurGame() // pion à electrical
    const out = resolveEffect(s, { type: 'KILL_CREWMATE' }, { actorIndex: 0 })
    const colorsAtElectrical = (s.players[0].crewmates ?? [])
      .filter((c) => c.locationId === 'electrical')
      .map((c) => c.color)
      .sort()
    expect(out.pendingCrewmateKill?.playerIndex).toBe(0)
    expect([...(out.pendingCrewmateKill?.candidateColors ?? [])].sort()).toEqual(colorsAtElectrical)
  })

  it('défausse le Coéquipier choisi ; les autres du lieu deviennent suspects', () => {
    let s = imposteurGame()
    s = resolveEffect(s, { type: 'KILL_CREWMATE' }, { actorIndex: 0 })
    const [victim, other] = s.pendingCrewmateKill!.candidateColors
    s = applyAction(s, { type: 'RESOLVE_CREWMATE_KILL', color: victim })
    const crew = s.players[0].crewmates ?? []
    expect(crew.find((c) => c.color === victim)?.discarded).toBe(true)
    expect(crew.find((c) => c.color === other)?.suspect).toBe(true)
    expect(s.pendingCrewmateKill).toBeNull()
  })

  it("Porte désactivée se joue via l'action « Jouer une carte » accordée par le Coéquipier imposteur", () => {
    let s = imposteurGame()
    const ally = villainInstances.find((c) => c.cardId === 'coequipier-imposteur')!
    const porte = villainInstances.find((c) => c.cardId === 'porte-desactivee')!
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, pawnLocation: 'admin', power: 5, hand: [porte], board: { ...p.board, admin: [ally] }, usedActionIds: [] }
          : p,
      ),
      usedActionIds: [],
    }
    const out = applyAction(s, { type: 'PLAY_CARD', actionId: `granted:${ally.instanceId}`, instanceId: porte.instanceId })
    expect(out.players[0].crewmatesSkipMove).toBe(true)
    expect(out.players[0].discard.some((c) => c.cardId === 'porte-desactivee')).toBe(true)
  })

  it("ne fait rien s'il n'y a aucun Coéquipier ciblable", () => {
    let s = imposteurGame()
    // Vide les Coéquipiers du lieu du pion en les déplaçant ailleurs.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, crewmates: (p.crewmates ?? []).map((c) => ({ ...c, locationId: 'admin' as const })), pawnLocation: 'cafeteria' }
          : p,
      ),
    }
    const out = resolveEffect(s, { type: 'KILL_CREWMATE' }, { actorIndex: 0 })
    expect(out.pendingCrewmateKill ?? null).toBeNull()
  })
})

const LOCS = ['electrical', 'reacteur', 'admin', 'cafeteria'] as const
const colOf = (c: Crewmate) => LOCS.indexOf(c.locationId as (typeof LOCS)[number]) * 2 + c.slot

function withCrew(s: GameState, crew: Crewmate[], patch: Partial<GameState['players'][number]> = {}): GameState {
  return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, crewmates: crew, ...patch } : p)) }
}

describe("L'Imposteur — déplacement automatique des Coéquipiers", () => {
  it('converge vers un Sabotage (1 case par tour)', () => {
    let s = imposteurGame()
    const sab = villainInstances.find((c) => c.cardId === 'sabotage-o2')!
    s = withCrew(s, [{ color: 'blanc', locationId: 'electrical', row: 'top', slot: 0, suspect: false }], {
      board: { ...s.players[0].board, cafeteria: [sab] }, // sabotage à droite (loc 3)
    })
    const out = moveCrewmatesEndOfTurn(s, 0)
    expect(colOf(out.players[0].crewmates![0])).toBe(1) // une case vers la droite
  })

  it('les Coéquipiers restent sur la rangée du HAUT (jamais en bas)', () => {
    let s = imposteurGame()
    const sab = villainInstances.find((c) => c.cardId === 'sabotage-o2')!
    // 3 Coéquipiers (de la place pour bouger) qui convergent vers le Sabotage.
    s = withCrew(
      s,
      [
        { color: 'blanc', locationId: 'electrical', row: 'top', slot: 0, suspect: true },
        { color: 'bleu', locationId: 'electrical', row: 'top', slot: 1, suspect: true },
        { color: 'noir', locationId: 'reacteur', row: 'top', slot: 0, suspect: true },
      ],
      { board: { ...s.players[0].board, cafeteria: [sab] } },
    )
    for (let i = 0; i < 6; i++) s = crewmateEndOfTurn(s, 0)
    const live = (s.players[0].crewmates ?? []).filter((c) => !c.discarded)
    expect(live.every((c) => c.row === 'top')).toBe(true)
  })

  it('un Coéquipier déjà sur le lieu du Sabotage ne bouge pas', () => {
    let s = imposteurGame()
    const sab = villainInstances.find((c) => c.cardId === 'sabotage-reacteur')!
    s = withCrew(s, [{ color: 'bleu', locationId: 'reacteur', row: 'top', slot: 0, suspect: false }], {
      board: { ...s.players[0].board, reacteur: [sab] },
    })
    const out = moveCrewmatesEndOfTurn(s, 0)
    const c = out.players[0].crewmates![0]
    expect(c.locationId).toBe('reacteur')
    expect(colOf(c)).toBe(2)
  })

  it('« portes désactivées » empêche le déplacement (drapeau consommé)', () => {
    let s = imposteurGame()
    const sab = villainInstances.find((c) => c.cardId === 'sabotage-o2')!
    s = withCrew(s, [{ color: 'blanc', locationId: 'electrical', row: 'top', slot: 0, suspect: false }], {
      board: { ...s.players[0].board, cafeteria: [sab] },
      crewmatesSkipMove: true,
    })
    const out = moveCrewmatesEndOfTurn(s, 0)
    expect(colOf(out.players[0].crewmates![0])).toBe(0) // n'a pas bougé
    expect(out.players[0].crewmatesSkipMove).toBe(false) // drapeau consommé
  })

  it('respecte la capacité : max 2 par case, max 4 par lieu', () => {
    let s = imposteurGame()
    const crew = (s.players[0].crewmates ?? []).map((c) => ({ ...c, suspect: true }))
    s = withCrew(s, crew)
    const out = moveCrewmatesEndOfTurn(s, 0)
    const live = (out.players[0].crewmates ?? []).filter((c) => !c.discarded)
    const perCell = new Map<string, number>()
    const perLoc = new Map<string, number>()
    for (const c of live) {
      const cell = `${colOf(c)}`
      perCell.set(cell, (perCell.get(cell) ?? 0) + 1)
      perLoc.set(c.locationId, (perLoc.get(c.locationId) ?? 0) + 1)
    }
    expect([...perCell.values()].every((n) => n <= 2)).toBe(true)
    expect([...perLoc.values()].every((n) => n <= 4)).toBe(true)
  })
})

describe("L'Imposteur — boucle Sabotage / Tâches", () => {
  const findOnBoard = (s: GameState, cardId: string) =>
    Object.values(s.players[0].board).flat().find((c) => c.cardId === cardId)

  it('défausse une Tâche quand assez de Coéquipiers l’atteignent', () => {
    let s = imposteurGame()
    const task = villainInstances.find((c) => c.cardId === 'tache-electricite')! // seuil 2
    s = withCrew(
      s,
      [
        { color: 'blanc', locationId: 'cafeteria', row: 'top', slot: 0, suspect: false },
        { color: 'bleu', locationId: 'cafeteria', row: 'top', slot: 1, suspect: false },
      ],
      { board: { ...s.players[0].board, cafeteria: [task] } },
    )
    const out = crewmateEndOfTurn(s, 0)
    expect(findOnBoard(out, 'tache-electricite')).toBeUndefined()
    expect(out.players[0].discard.some((c) => c.cardId === 'tache-electricite')).toBe(true)
  })

  it('le Coéquipier imposteur augmente le seuil de défausse de 1', () => {
    let s = imposteurGame()
    const task = villainInstances.find((c) => c.cardId === 'tache-electricite')! // seuil 2 → 3
    const ally = villainInstances.find((c) => c.cardId === 'coequipier-imposteur')!
    s = withCrew(
      s,
      [
        { color: 'blanc', locationId: 'cafeteria', row: 'top', slot: 0, suspect: false },
        { color: 'bleu', locationId: 'cafeteria', row: 'bottom', slot: 1, suspect: false },
      ],
      { board: { ...s.players[0].board, cafeteria: [task, ally] } },
    )
    const out = crewmateEndOfTurn(s, 0)
    // 2 Coéquipiers < seuil 3 → la Tâche survit.
    expect(findOnBoard(out, 'tache-electricite')).toBeDefined()
  })

  it('un Sabotage maintenu 3 tours fait gagner la partie', () => {
    let s = imposteurGame()
    const sab = villainInstances.find((c) => c.cardId === 'sabotage-o2')!
    // 1 seul Coéquipier loin → ne pourra jamais atteindre le seuil 2 du Sabotage.
    s = withCrew(s, [{ color: 'blanc', locationId: 'electrical', row: 'top', slot: 0, suspect: false }], {
      board: { ...s.players[0].board, cafeteria: [sab] },
    })
    s = crewmateEndOfTurn(s, 0)
    s = crewmateEndOfTurn(s, 0)
    expect(hasReachedObjective(s)).toBe(false) // 2 tours
    s = crewmateEndOfTurn(s, 0)
    expect(findOnBoard(s, 'sabotage-o2')?.sabotageTurns).toBe(3)
    expect(hasReachedObjective(s)).toBe(true)
  })

  it('« portes désactivées » : pas de déplacement mais le Sabotage progresse', () => {
    let s = imposteurGame()
    const sab = villainInstances.find((c) => c.cardId === 'sabotage-o2')!
    s = withCrew(s, [{ color: 'blanc', locationId: 'electrical', row: 'top', slot: 0, suspect: false }], {
      board: { ...s.players[0].board, cafeteria: [sab] },
      crewmatesSkipMove: true,
    })
    const out = crewmateEndOfTurn(s, 0)
    expect(colOf(out.players[0].crewmates![0])).toBe(0) // pas de déplacement
    expect(out.players[0].crewmatesSkipMove).toBe(false)
    expect(findOnBoard(out, 'sabotage-o2')?.sabotageTurns).toBe(1) // compte à rebours OK
  })
})

describe("L'Imposteur — effets de cartes (suspicion / défausse)", () => {
  const setSuspect = (s: GameState, colors: string[]) =>
    withCrew(
      s,
      (s.players[0].crewmates ?? []).map((c) => ({ ...c, suspect: colors.includes(c.color) })),
    )

  it('Fausse accusation : choix interactif, défausse + normalise les autres', () => {
    let s = imposteurGame()
    s = setSuspect(s, ['blanc', 'bleu', 'noir'])
    s = resolveEffect(s, { type: 'FALSE_ACCUSATION' }, { actorIndex: 0 })
    expect(s.pendingCrewmateKill?.mode).toBe('false-accusation')
    // candidats = TOUS les Coéquipiers (n'importe où).
    expect(s.pendingCrewmateKill?.candidateColors).toHaveLength(8)
    s = applyAction(s, { type: 'RESOLVE_CREWMATE_KILL', color: 'noir' })
    const crew = s.players[0].crewmates ?? []
    expect(crew.find((c) => c.color === 'noir')?.discarded).toBe(true)
    expect(crew.filter((c) => !c.discarded).every((c) => !c.suspect)).toBe(true)
  })

  it('Assurance : rend normal un suspect sur le lieu du pion (sans Allié requis)', () => {
    let s = imposteurGame() // pion à electrical (blanc, bleu) — aucun Allié posé
    s = setSuspect(s, ['blanc'])
    s = resolveEffect(s, { type: 'REASSURE_CREWMATE' }, { actorIndex: 0 })
    // blanc est sur electrical = lieu du pion → candidat même sans Allié.
    expect(s.pendingCrewmateKill?.mode).toBe('reassure')
    expect(s.pendingCrewmateKill?.candidateColors).toContain('blanc')
    s = applyAction(s, { type: 'RESOLVE_CREWMATE_KILL', color: 'blanc' })
    const blanc = s.players[0].crewmates!.find((c) => c.color === 'blanc')
    expect(blanc?.suspect).toBe(false)
    expect(blanc?.discarded).toBeFalsy() // rassuré, pas défaussé
  })

  it('Corps découvert : rend suspects les Coéquipiers hors du lieu du pion/allié', () => {
    const s = imposteurGame() // pion electrical
    const out = resolveEffect(s, { type: 'CREWMATES_SUSPECT', scope: 'away' }, { actorIndex: 0 })
    const crew = out.players[0].crewmates ?? []
    expect(crew.filter((c) => c.locationId === 'electrical').every((c) => !c.suspect)).toBe(true)
    expect(crew.filter((c) => c.locationId !== 'electrical').every((c) => c.suspect)).toBe(true)
  })

  it('Tâche visuelle : choix interactif de jusqu’à 3 Coéquipiers à rendre suspects', () => {
    let s = imposteurGame()
    // L'effet ouvre la sélection (chooser = joueur actif).
    s = resolveEffect(s, { type: 'CREWMATES_SUSPECT_CHOOSE', count: 3 }, { actorIndex: 0 })
    expect(s.pendingCrewmateSuspect?.remaining).toBe(3)
    const colors = (s.players[0].crewmates ?? []).slice(0, 3).map((c) => c.color)
    s = applyAction(s, { type: 'RESOLVE_CREWMATE_SUSPECT', color: colors[0] })
    s = applyAction(s, { type: 'RESOLVE_CREWMATE_SUSPECT', color: colors[1] })
    expect(s.pendingCrewmateSuspect?.remaining).toBe(1)
    // Termine avant d'atteindre 3.
    s = applyAction(s, { type: 'DONE_CREWMATE_SUSPECT' })
    expect(s.pendingCrewmateSuspect ?? null).toBeNull()
    const suspects = (s.players[0].crewmates ?? []).filter((c) => c.suspect).map((c) => c.color)
    expect(suspects.sort()).toEqual([colors[0], colors[1]].sort())
  })

  it('Trahison : choix interactif d’un Coéquipier non-suspect à éliminer', () => {
    let s = imposteurGame()
    s = setSuspect(s, ['blanc']) // blanc suspect → exclu des candidats
    s = resolveEffect(s, { type: 'KILL_NORMAL_CREWMATE' }, { actorIndex: 0 })
    expect(s.pendingCrewmateKill?.mode).toBe('kill-normal')
    expect(s.pendingCrewmateKill?.candidateColors).not.toContain('blanc') // pas les suspects
    const victim = s.pendingCrewmateKill!.candidateColors[0]
    s = applyAction(s, { type: 'RESOLVE_CREWMATE_KILL', color: victim })
    const dead = (s.players[0].crewmates ?? []).filter((c) => c.discarded)
    expect(dead).toHaveLength(1)
    expect(dead[0].color).toBe(victim)
  })

  it('un Coéquipier suspect recouvre l’action du haut de sa case (la bloque)', () => {
    let s = imposteurGame()
    s = withCrew(s, [
      { color: 'blanc', locationId: 'electrical', row: 'top', slot: 0, suspect: true },
      { color: 'bleu', locationId: 'electrical', row: 'top', slot: 1, suspect: false },
    ])
    const covered = coveredTopActionIdsAt(s.players[0], 'electrical')
    // electrical top = [fate(slot0), play-card-top(slot1)]
    expect(covered.has('fate')).toBe(true) // slot0 suspect → recouvre
    expect(covered.has('play-card-top')).toBe(false) // slot1 normal → libre
  })

  it('Insidieux : un suspect redevient normal', () => {
    let s = imposteurGame()
    s = setSuspect(s, ['blanc', 'bleu'])
    const out = resolveEffect(s, { type: 'REASSURE_ANY' }, { actorIndex: 0 })
    expect((out.players[0].crewmates ?? []).filter((c) => c.suspect)).toHaveLength(1)
  })

  it("Insidieux n'est jouable que s'il existe un Coéquipier suspect", () => {
    const insidieux = villainInstances.find((c) => c.cardId === 'insidieux')!
    // 2 joueurs pour avoir un adversaire actif qui a joué 2 cartes.
    let s = createInitialGame(
      [
        { villain: imposteur, deckCards: villainInstances, fateCards: fateInstances },
        { villain: imposteur, deckCards: buildDeckInstances(imposteurCards, 'villain', 'p1:'), fateCards: buildDeckInstances(imposteurCards, 'fate', 'p1f:') },
      ],
      9,
    )
    // Joueur 0 réagit pendant le tour du joueur 1 (qui a joué 2 cartes).
    s = { ...s, activePlayer: 1, activePlayedCount: 2, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [insidieux] } : p)) }
    // Aucun suspect → non jouable.
    expect(conditionIsTriggered(s, insidieux, 0)).toBe(false)
    // Un suspect → jouable.
    const s2 = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, crewmates: (p.crewmates ?? []).map((c, k) => (k === 0 ? { ...c, suspect: true } : c)) } : p)) }
    expect(conditionIsTriggered(s2, insidieux, 0)).toBe(true)
  })

  it('Tâche : Station essence — défausse choisie puis pioche (main inchangée en taille)', () => {
    let s = imposteurGame()
    const before = s.players[0].hand.length
    const pick = s.players[0].hand[0]
    s = { ...s, pendingTyrannyDiscard: { playerIndex: 0, count: 1, thenDraw: 1, label: 'Tâche : Station essence' } }
    const out = applyAction(s, { type: 'RESOLVE_TYRANNY_DISCARD', instanceIds: [pick.instanceId] })
    expect(out.players[0].discard.some((c) => c.instanceId === pick.instanceId)).toBe(true)
    expect(out.players[0].hand.some((c) => c.instanceId === pick.instanceId)).toBe(false)
    expect(out.players[0].hand.length).toBe(before) // −1 défaussée +1 piochée
    expect(out.pendingTyrannyDiscard).toBeUndefined()
  })
})

describe("L'Imposteur — Majorité (Fatalité) : choix interactif de la carte à défausser", () => {
  it('ouvre le choix (Allié OU Objet, hors Sabotage) puis défausse celle choisie', () => {
    const two = createInitialGame(
      [
        { villain: imposteur, deckCards: buildDeckInstances(imposteurCards, 'villain', 'p0:'), fateCards: buildDeckInstances(imposteurCards, 'fate', 'p0f:') },
        { villain: imposteur, deckCards: buildDeckInstances(imposteurCards, 'villain', 'p1:'), fateCards: buildDeckInstances(imposteurCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const majorite = { ...fateInstances.find((c) => c.cardId === 'majorite')!, instanceId: 'maj' }
    const other = { ...fateInstances.find((c) => c.cardId !== 'majorite')!, instanceId: 'oth' }
    const ally = { instanceId: 'ally1', cardId: 'coequipier-imposteur', name: 'Coéquipier', type: 'ally' as const, strength: 2 }
    const item = { instanceId: 'item1', cardId: 'sabotage', name: 'Sabotage', type: 'item' as const, isSabotage: true }
    const loc = two.players[0].locations[0].id
    let s: GameState = {
      ...two,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [majorite, other] },
      players: two.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, [loc]: [ally, item] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'maj' })
    // Le Sabotage n'est PAS candidat ; l'Allié l'est. Choix ouvert (chooser = joueur 1).
    expect(s.pendingFateChoice?.kind).toBe('remove-card')
    expect(s.pendingFateChoice?.candidateIds).toEqual(['ally1'])
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'ally1' })
    expect((s.players[0].board[loc] ?? []).some((c) => c.instanceId === 'ally1')).toBe(false)
    expect(s.players[0].discard.some((c) => c.instanceId === 'ally1')).toBe(true)
    expect(s.pendingFateChoice ?? null).toBeNull()
  })
})
