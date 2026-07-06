import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'
import { hasReachedObjective, isActionAvailable, maxRevealFighters, effectiveCost, effectiveStrength } from '../rules'
import { tabbou } from '../../data/villains/tabbou'
import { tabbouCards } from '../../data/villains/tabbou.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, FighterColor, FighterTile, GameState } from '../types'

const game = (seed = 42): GameState =>
  createInitialGame(
    [
      {
        villain: tabbou,
        deckCards: buildDeckInstances(tabbouCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(tabbouCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

/** Force la liste des tuiles Combattants du joueur actif. */
function withTiles(s: GameState, tiles: FighterTile[]): GameState {
  return { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, fighterTiles: tiles } : p)) }
}

const tile = (id: string, color: FighterColor, state: FighterTile['state']): FighterTile => ({
  id,
  color,
  art: `/cards/tabbou/tuiles/${id}.png`,
  state,
})

describe('Tabbou — mise en place des tuiles Combattants', () => {
  it('35 tuiles en pioche au départ, Émissaire verrouillé', () => {
    const s = game()
    const p = s.players[0]
    expect(p.fighterTiles).toHaveLength(35)
    expect((p.fighterTiles ?? []).every((t) => t.state === 'pile')).toBe(true)
    // Chaque tuile porte un nom de combattant (Meta Knight, Kirby…). Les tuiles sont
    // mélangées au départ, donc on vérifie la correspondance NOM ↔ ART (pas la position).
    expect((p.fighterTiles ?? []).every((t) => !!t.name && t.name.length > 0)).toBe(true)
    const byArt = (n: number) => (p.fighterTiles ?? []).find((t) => t.art.endsWith(`combattant-${n}.png`))
    expect(byArt(1)?.name).toBe('Meta Knight')
    expect(byArt(35)?.name).toBe('Samus')
    expect(byArt(7)?.name).toBe('Mario')
    expect(p.emissaireLocationId).toBe('emissaire')
    expect(p.lockedLocations ?? []).toContain('emissaire')
  })
})

describe('Tabbou — dévoiler des Combattants (interactif)', () => {
  it('REVEAL_FIGHTERS ouvre le dévoilement, puis le joueur retourne les tuiles choisies', () => {
    let s = withTiles(game(), [
      tile('a', 'vert', 'pile'),
      tile('b', 'rouge', 'pile'),
      tile('c', 'bleu', 'pile'),
    ])
    s = resolveEffect(s, { type: 'REVEAL_FIGHTERS', count: 2 })
    expect(s.pendingFighterReveal).toEqual({ playerIndex: 0, remaining: 2 })
    s = applyAction(s, { type: 'RESOLVE_FIGHTER_REVEAL', tileId: 'a' })
    expect(s.pendingFighterReveal?.remaining).toBe(1)
    s = applyAction(s, { type: 'RESOLVE_FIGHTER_REVEAL', tileId: 'c' })
    expect(s.pendingFighterReveal).toBeNull() // 2 dévoilées → fenêtre fermée
    const tiles = s.players[0].fighterTiles ?? []
    expect(tiles.filter((t) => t.state === 'reserve').map((t) => t.id).sort()).toEqual(['a', 'c'])
    expect(tiles.find((t) => t.id === 'b')?.state).toBe('pile')
  })

  it('le compteur de dévoilement est plafonné par la pioche disponible', () => {
    let s = withTiles(game(), [tile('a', 'vert', 'pile'), tile('b', 'vert', 'pile')])
    s = resolveEffect(s, { type: 'REVEAL_FIGHTERS', count: 5 })
    expect(s.pendingFighterReveal?.remaining).toBe(2)
  })
})

describe('Tabbou — tuer des Combattants par couleur', () => {
  it('KILL_FIGHTERS_COLOR ouvre le choix puis tue toute la couleur', () => {
    let s = withTiles(game(), [
      tile('a', 'vert', 'reserve'),
      tile('b', 'vert', 'reserve'),
      tile('c', 'rouge', 'reserve'),
    ])
    s = resolveEffect(s, { type: 'KILL_FIGHTERS_COLOR' })
    expect(s.pendingFighterKillColor?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_FIGHTER_KILL_COLOR', color: 'vert' })
    const tiles = s.players[0].fighterTiles ?? []
    expect(tiles.filter((t) => t.state === 'killed').map((t) => t.id).sort()).toEqual(['a', 'b'])
    expect(tiles.find((t) => t.id === 'c')?.state).toBe('reserve')
    expect(s.pendingFighterKillColor).toBeNull()
  })
})

describe('Tabbou — objectif KILL_FIGHTERS', () => {
  it('20 tués suffisent ; 30 requis tant que Samus est présente', () => {
    const killed = Array.from({ length: 20 }, (_, i) => tile(`k${i}`, 'gris', 'killed'))
    let s = withTiles(game(), killed)
    expect(hasReachedObjective(s, 0)).toBe(true)

    // Samus dans le royaume → seuil 30 → 20 ne suffit plus.
    const samus: CardInstance = buildDeckInstances(tabbouCards, 'fate', 'x:').find((c) => c.cardId === 'samus')!
    const loc = tabbou.locations[0].id
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, [loc]: [...(p.board[loc] ?? []), samus] } } : p,
      ),
    }
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Tabbou — déblocage de l’Émissaire Subspatial', () => {
  it('3 Orbes sur les 3 lieux non-Émissaire déverrouillent l’Émissaire', () => {
    let s = game()
    const orb = (loc: string): CardInstance => {
      const o = buildDeckInstances(tabbouCards, 'villain', `${loc}:`).find((c) => c.cardId === 'boule-1')!
      return { ...o, instanceId: `orb-${loc}` }
    }
    // Pose un Orbe sur chacun des 3 lieux hors Émissaire.
    const orbLocs = tabbou.locations.map((l) => l.id).filter((id) => id !== 'emissaire')
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, board: { ...p.board, ...Object.fromEntries(orbLocs.map((loc) => [loc, [orb(loc)]])) } }
          : p,
      ),
    }
    expect(s.players[0].lockedLocations ?? []).toContain('emissaire')
    s = resolveEffect(s, { type: 'SUBSPACE_ORB_PLACED' })
    expect(s.players[0].lockedLocations ?? []).not.toContain('emissaire')
  })

  it('poser le 3ᵉ Orbe via PLAY_CARD débloque l’Émissaire (flux de jeu réel)', () => {
    const orb = (id: string): CardInstance => {
      const o = buildDeckInstances(tabbouCards, 'villain', `${id}:`).find((c) => c.cardId === 'boule-1')!
      return { ...o, instanceId: id }
    }
    // 2 Orbes déjà posés (Stade, Halberd) ; le 3ᵉ est en main, pion au Château.
    let s = game()
    s = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              power: 5,
              pawnLocation: 'chateau',
              hand: [orb('orb-main')],
              board: { ...p.board, stade: [orb('orb-stade')], halberd: [orb('orb-halberd')] },
            }
          : p,
      ),
    }
    expect(s.players[0].lockedLocations ?? []).toContain('emissaire')
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'orb-main', to: 'chateau' })
    // L'Orbe est bien posé au Château ET l'Émissaire est débloqué.
    expect((s.players[0].board['chateau'] ?? []).some((c) => c.instanceId === 'orb-main')).toBe(true)
    expect(s.players[0].lockedLocations ?? []).not.toContain('emissaire')
  })
})

describe('Tabbou — action « Dévoiler une tuile Combattant » (Émissaire, payer N)', () => {
  /** Pion sur l'Émissaire déverrouillé, `power` JT, tuiles données, éventuel Héros Fatalité. */
  const onEmissaire = (tiles: FighterTile[], power: number, realm: CardInstance[] = []): GameState => {
    const base = withTiles(game(), tiles)
    return {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: base.players.map((p, i) =>
        i === 0
          ? { ...p, power, pawnLocation: 'emissaire', lockedLocations: [], board: { ...p.board, emissaire: realm } }
          : p,
      ),
    }
  }
  const fateHero = (cardId: string): CardInstance =>
    buildDeckInstances(tabbouCards, 'fate', `${cardId}:`).find((c) => c.cardId === cardId)!

  it('dévoile N tuiles et dépense N Pouvoir (1 JT = 1 Combattant)', () => {
    const s = onEmissaire([tile('a', 'vert', 'pile'), tile('b', 'rouge', 'pile'), tile('c', 'bleu', 'pile')], 5)
    expect(isActionAvailable(s, 'reveal-fighter')).toBe(true)
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'reveal-fighter', count: 2 })
    expect(after.players[0].power).toBe(3) // 5 − 2
    expect(after.pendingFighterReveal).toEqual({ playerIndex: 0, remaining: 2 })
    let done = applyAction(after, { type: 'RESOLVE_FIGHTER_REVEAL', tileId: 'a' })
    done = applyAction(done, { type: 'RESOLVE_FIGHTER_REVEAL', tileId: 'b' })
    expect(done.pendingFighterReveal).toBeNull()
    expect((done.players[0].fighterTiles ?? []).filter((t) => t.state === 'reserve')).toHaveLength(2)
  })

  it('indisponible sans Pouvoir (chaque tuile coûte 1 JT)', () => {
    const s = onEmissaire([tile('a', 'vert', 'pile')], 0)
    expect(maxRevealFighters(s)).toBe(0)
    expect(isActionAvailable(s, 'reveal-fighter')).toBe(false)
  })

  it('Link plafonne à 3 tuiles par usage (même avec plus de Pouvoir/pioche)', () => {
    const tiles = Array.from({ length: 6 }, (_, i) => tile(`t${i}`, 'gris', 'pile'))
    const s = onEmissaire(tiles, 10, [fateHero('link')])
    expect(maxRevealFighters(s)).toBe(3)
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'reveal-fighter', count: 6 })
    expect(after.pendingFighterReveal?.remaining).toBe(3) // borné à 3 par Link
    expect(after.players[0].power).toBe(7) // 10 − 3
  })

  it('Kirby ajoute un surcoût fixe (dévoiler N coûte N + 1)', () => {
    const s = onEmissaire([tile('a', 'vert', 'pile'), tile('b', 'rouge', 'pile')], 5, [fateHero('kirby')])
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'reveal-fighter', count: 2 })
    expect(after.players[0].power).toBe(2) // 5 − (2 + 1 Kirby)
    expect(after.pendingFighterReveal?.remaining).toBe(2)
  })
})

describe('Tabbou — Flèche jouée en réaction à une Fatalité (dévoilement autorisé)', () => {
  it('RESOLVE_FIGHTER_REVEAL est autorisé même si une Fatalité est en attente', () => {
    // Flèche (Condition réactive) ouvre pendingFighterReveal pendant que la Fatalité
    // adverse est encore en attente (pendingFate) : dévoiler ne doit PAS être bloqué.
    const base = withTiles(game(), [tile('a', 'vert', 'pile'), tile('b', 'rouge', 'pile')])
    const s: GameState = {
      ...base,
      pendingFate: { target: 0, revealed: [] },
      pendingFighterReveal: { playerIndex: 0, remaining: 1 },
    }
    const after = applyAction(s, { type: 'RESOLVE_FIGHTER_REVEAL', tileId: 'a' })
    expect(after.players[0].fighterTiles?.find((t) => t.id === 'a')?.state).toBe('reserve')
    expect(after.pendingFate).not.toBeNull() // la Fatalité reste à résoudre ensuite
  })
})

describe('Tabbou — Mario (défausse de Pouvoir plafonnée à 3)', () => {
  const fate = (cardId: string, inst: string): CardInstance => {
    const c = buildDeckInstances(tabbouCards, 'fate', `${cardId}:`).find((x) => x.cardId === cardId)!
    return { ...c, instanceId: inst }
  }

  it('perd 1 JT par Héros mais au maximum 3 (5 Héros → −3)', () => {
    const base = game()
    const loc = tabbou.locations[0].id
    const heroes = Array.from({ length: 5 }, (_, i) => fate('link', `h${i}`)) // 5 Héros dans le royaume
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, power: 10, board: { ...p.board, [loc]: heroes } } : p,
      ),
    }
    const after = resolveEffect(s, { type: 'LOSE_POWER_PER_HERO_IN_REALM', amount: 1, max: 3 })
    expect(after.players[0].power).toBe(7) // 10 − min(5, 3)
  })
})

describe('Tabbou — Meta Knight (+1 forfaitaire si un autre Héros est là)', () => {
  const fate = (cardId: string, inst: string): CardInstance => {
    const c = buildDeckInstances(tabbouCards, 'fate', `${cardId}:`).find((x) => x.cardId === cardId)!
    return { ...c, instanceId: inst }
  }

  it('force 4 seul, 5 avec 1 ou 2 autres Héros (jamais +2)', () => {
    const base = game()
    const loc = tabbou.locations[0].id
    const meta = fate('meta-knight', 'meta')
    const mk = (extra: CardInstance[]): GameState => ({
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, [loc]: [meta, ...extra] } } : p,
      ),
    })
    expect(effectiveStrength(mk([]), 0, 'meta')).toBe(4) // seul
    expect(effectiveStrength(mk([fate('link', 'x1')]), 0, 'meta')).toBe(5) // +1
    expect(effectiveStrength(mk([fate('link', 'x1'), fate('samus', 'x2')]), 0, 'meta')).toBe(5) // toujours +1
  })
})

describe('Tabbou — Canon Obscur (réduction de coût des Objets)', () => {
  it('un Objet coûte 1 de moins tant que le pion est sur le lieu du Canon Obscur', () => {
    const base = game()
    const me = base.players[0]
    const canon = me.deck.find((c) => c.cardId === 'canon-obscure-2')!
    const halberd = me.deck.find((c) => c.cardId === 'halberd')! // Objet coût 3
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, pawnLocation: 'stade', board: { ...p.board, stade: [canon] } } : p,
      ),
    }
    expect(effectiveCost(s, halberd)).toBe(2) // 3 − 1 (Canon Obscur présent)
    // Pion ailleurs → plus de réduction.
    const away = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, pawnLocation: 'chateau' } : p)) }
    expect(effectiveCost(away, halberd)).toBe(3)
  })
})

describe('Tabbou — Canon Géant (capacité activée)', () => {
  it('Activer ouvre le choix « regarder 4, garder 1 » (pendingLookTop)', () => {
    const base = game()
    const me = base.players[0]
    const canon = me.deck.find((c) => c.cardId === 'canon-geant')!
    // Pion et Canon Géant au Stade (seul lieu portant l'action « Activer »).
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: base.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              power: 5,
              pawnLocation: 'stade',
              deck: p.deck.filter((c) => c.instanceId !== canon.instanceId),
              board: { ...p.board, stade: [{ ...canon }] },
            }
          : p,
      ),
    }
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: canon.instanceId })
    expect(after.pendingLookTop?.cards).toHaveLength(4)
    expect(after.pendingLookTop?.take).toBe(1)
    // Le joueur garde une carte : elle rejoint la main, les autres sont défaussées.
    const keep = after.pendingLookTop!.cards[0].instanceId
    const done = applyAction(after, { type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [keep] })
    expect(done.pendingLookTop ?? null).toBeNull()
    expect(done.players[0].hand.some((c) => c.instanceId === keep)).toBe(true)
  })
})

describe('Tabbou — Bowser (Allié à capacité activée : tuer une couleur)', () => {
  it('Activer (payer 1) ouvre le choix de couleur à tuer', () => {
    const base = withTiles(game(), [tile('a', 'vert', 'reserve'), tile('b', 'vert', 'reserve'), tile('c', 'rouge', 'reserve')])
    const bowser = base.players[0].deck.find((c) => c.cardId === 'canon-obscure')!
    const s: GameState = {
      ...base,
      phase: 'ACTION',
      usedActionIds: [],
      players: base.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              power: 5,
              pawnLocation: 'stade',
              deck: p.deck.filter((c) => c.instanceId !== bowser.instanceId),
              board: { ...p.board, stade: [{ ...bowser }] },
            }
          : p,
      ),
    }
    const after = applyAction(s, { type: 'ACTIVATE', actionId: 'activate', cardInstanceId: bowser.instanceId })
    expect(after.players[0].power).toBe(4) // −1 (coût d'activation)
    expect(after.pendingFighterKillColor?.playerIndex).toBe(0)
    // Puis on choisit une couleur : toutes les tuiles de cette couleur en réserve sont tuées.
    const killed = applyAction(after, { type: 'RESOLVE_FIGHTER_KILL_COLOR', color: 'vert' })
    const tiles = killed.players[0].fighterTiles ?? []
    expect(tiles.filter((t) => t.state === 'killed').map((t) => t.id).sort()).toEqual(['a', 'b'])
  })
})
