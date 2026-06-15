import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { resolveEffects } from '../effects'
import { effectiveStrength, getAvailableActions, maxBrewPoison } from '../rules'
import { buildDeckInstances } from '../../data/types'
import { mechanteReine } from '../../data/villains/mechanteReine'
import { mechanteReineCards, mechanteReineCardById } from '../../data/villains/mechanteReine.cards'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      {
        villain: mechanteReine,
        deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
}

const me = (s: GameState) => s.players[s.activePlayer]

/** Place le pion sur un lieu (phase ACTION) avec main + pouvoir contrôlés. On fixe
 *  directement le pion (sans MOVE) pour pouvoir tester la Maison des Nains même
 *  verrouillée. */
function atLocation(locId: string, hand: CardInstance[], power: number): GameState {
  const s = game()
  return {
    ...s,
    phase: 'ACTION',
    usedActionIds: [],
    players: s.players.map((p, i) =>
      i === s.activePlayer ? { ...p, pawnLocation: locId, hand, power } : p,
    ),
  }
}

function inst(cardId: string, n = 1): CardInstance {
  const c = mechanteReineCardById[cardId]
  return {
    instanceId: `${cardId}#${n}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    effects: c.effects,
    selfStrengthMods: c.selfStrengthMods,
    strengthMod: c.strengthMod,
    mustDefeatFirst: c.mustDefeatFirst,
    forcedFateLocation: c.forcedFateLocation,
    fatePlayBoth: c.fatePlayBoth,
  }
}

function hero(cardId: string, loc: string, n = 1): { card: CardInstance; loc: string } {
  return { card: inst(cardId, n), loc }
}

/** Pose des Héros sur le plateau du joueur actif. */
function withHeroes(s: GameState, heroes: { card: CardInstance; loc: string }[]): GameState {
  const board = { ...me(s).board }
  for (const h of heroes) board[h.loc] = [...(board[h.loc] ?? []), h.card]
  return { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, board } : p)) }
}

describe('La Méchante Reine — Ingrédients & déverrouillage', () => {
  it('jouer les 4 Ingrédients différents les met en zone et déverrouille la Maison des Nains', () => {
    const a = inst('caquet-megere', 1)
    const b = inst('noir-de-nuit', 1)
    const c = inst('poussiere-momie', 1)
    const d = inst('hurlement-effroi', 1)
    let s = atLocation('laboratoire', [a, b, c, d], 10)
    expect(me(s).lockedLocations).toContain('maison-des-nains')
    const play = (st: GameState, id: string) =>
      applyAction({ ...st, usedActionIds: [] }, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: id })
    s = play(s, a.instanceId)
    s = play(s, b.instanceId)
    s = play(s, c.instanceId)
    expect(me(s).ingredients).toHaveLength(3)
    expect(me(s).lockedLocations).toContain('maison-des-nains')
    s = play(s, d.instanceId)
    expect(me(s).ingredients).toHaveLength(4)
    expect(me(s).lockedLocations ?? []).not.toContain('maison-des-nains')
  })

  it('un 2ᵉ exemplaire du même Ingrédient va à la défausse (pas dans la zone)', () => {
    const a = inst('caquet-megere', 1)
    const a2 = inst('caquet-megere', 2)
    let s = atLocation('laboratoire', [a, a2], 10)
    s = applyAction({ ...s, usedActionIds: [] }, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: a.instanceId })
    s = applyAction({ ...s, usedActionIds: [] }, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: a2.instanceId })
    expect(me(s).ingredients).toHaveLength(1)
    expect(me(s).discard.map((c) => c.cardId)).toContain('caquet-megere')
  })
})

describe('La Méchante Reine — Poison & Croque', () => {
  it('« Préparer du poison » convertit N Pouvoir en N Poison (au choix)', () => {
    const s = atLocation('laboratoire', [], 5)
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'brew-poison', count: 3 })
    expect(me(after).poison).toBe(3)
    expect(me(after).power).toBe(2) // 5 − 3 convertis
  })

  it('« Préparer du poison » sans count convertit 1 Pouvoir par défaut', () => {
    const s = atLocation('laboratoire', [], 5)
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'brew-poison' })
    expect(me(after).poison).toBe(1)
    expect(me(after).power).toBe(4)
  })

  it('« Préparer du poison » borne le nombre demandé au Pouvoir disponible', () => {
    const s = atLocation('laboratoire', [], 2)
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'brew-poison', count: 99 })
    expect(me(after).poison).toBe(2)
    expect(me(after).power).toBe(0)
  })

  it('« Préparer du poison » indisponible et refusée sans Pouvoir', () => {
    const s = atLocation('laboratoire', [], 0)
    expect(getAvailableActions(s).some((a) => a.id === 'brew-poison')).toBe(false)
    expect(() => applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'brew-poison' })).toThrow()
  })

  it('Timide : préparer du poison coûte 1 Pouvoir de plus (perdu)', () => {
    // Timide (Héros Fatalité) dans le royaume : N Poison coûtent N+1 Pouvoir.
    let s = atLocation('laboratoire', [], 4)
    s = withHeroes(s, [hero('timide', 'foret')])
    expect(maxBrewPoison(s)).toBe(3) // 4 − 1 (surcoût)
    const after = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'brew-poison', count: 3 })
    expect(me(after).poison).toBe(3)
    expect(me(after).power).toBe(0) // 4 − 3 convertis − 1 (Timide)
  })

  it('Timide : préparer du poison indisponible avec seulement 1 Pouvoir', () => {
    let s = atLocation('laboratoire', [], 1)
    s = withHeroes(s, [hero('timide', 'foret')])
    expect(getAvailableActions(s).some((a) => a.id === 'brew-poison')).toBe(false)
  })

  it('Blanche-Neige (Fatalité) est posée d’office à la Maison des Nains, même verrouillée', () => {
    let s = atLocation('laboratoire', [], 0)
    expect(me(s).lockedLocations).toContain('maison-des-nains')
    s = { ...s, pendingFate: { target: s.activePlayer, revealed: [inst('blanche-neige')] } }
    const after = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'blanche-neige#1' })
    const cottage = after.players[after.activePlayer].board['maison-des-nains'] ?? []
    expect(cottage.some((c) => c.cardId === 'blanche-neige')).toBe(true)
  })

  it('dévoilée par la Fatalité adverse, Blanche-Neige est jouée d’office à la Maison des Nains (pas de choix)', () => {
    // 2 joueurs : J1 lance la Fatalité contre J0 (Méchante Reine). Blanche-Neige en
    // tête du deck Fatalité de J0 → jouée d'office, l'autre carte dévoilée défaussée.
    let s = createInitialGame(
      [
        { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p0:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p0f:') },
        { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p1:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const bn = inst('blanche-neige')
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, fateDeck: [bn, ...p.fateDeck] } : { ...p, pawnLocation: 'laboratoire' },
      ),
    }
    const after = applyAction(s, { type: 'FATE', actionId: 'fate' })
    expect(after.pendingFate ?? null).toBeNull()
    const cottage = after.players[0].board['maison-des-nains'] ?? []
    expect(cottage.some((c) => c.cardId === 'blanche-neige')).toBe(true)
    // Elle n'est PAS sur un lieu fantôme (régression « arbre-pendu »).
    expect(after.players[0].board['arbre-pendu'] ?? []).toHaveLength(0)
  })

  // Combo « jouer les deux » de Dormeur (data-driven fatePlayBoth) — 2 joueurs :
  // J1 lance la Fatalité contre J0 (Méchante Reine), dévoilant Dormeur + Atchoum.
  function fateRevealing(...topCardIds: string[]): GameState {
    let s = createInitialGame(
      [
        { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p0:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p0f:') },
        { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p1:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p1f:') },
      ],
      7,
    )
    const top = topCardIds.map((id) => inst(id))
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, fateDeck: [...top, ...p.fateDeck] } : { ...p, pawnLocation: 'laboratoire' },
      ),
    }
    return applyAction(s, { type: 'FATE', actionId: 'fate' })
  }

  it('Dormeur : dévoilé avec une autre carte, on peut jouer les DEUX (2ᵉ facultative)', () => {
    let s = fateRevealing('dormeur', 'atchoum')
    expect((s.pendingFate?.revealed ?? []).map((c) => c.cardId).sort()).toEqual(['atchoum', 'dormeur'])
    // On joue Dormeur (Héros) sur la Forêt de la cible.
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'dormeur#1', to: 'foret' })
    // La Fatalité se rouvre pour la 2ᵉ carte, marquée FACULTATIVE.
    expect(s.pendingFate?.optional).toBe(true)
    expect((s.pendingFate?.revealed ?? []).map((c) => c.cardId)).toEqual(['atchoum'])
    // On joue aussi Atchoum (sur la Mine).
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'atchoum#1', to: 'mine' })
    expect(s.pendingFate ?? null).toBeNull()
    expect((s.players[0].board['foret'] ?? []).some((c) => c.cardId === 'dormeur')).toBe(true)
    expect((s.players[0].board['mine'] ?? []).some((c) => c.cardId === 'atchoum')).toBe(true)
  })

  it('Dormeur : la 2ᵉ carte est facultative — PASS_FATE la défausse', () => {
    let s = fateRevealing('dormeur', 'atchoum')
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'dormeur#1', to: 'foret' })
    expect(s.pendingFate?.optional).toBe(true)
    s = applyAction(s, { type: 'PASS_FATE' })
    expect(s.pendingFate ?? null).toBeNull()
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'atchoum')).toBe(true)
    expect(Object.values(s.players[0].board).flat().some((c) => c.cardId === 'atchoum')).toBe(false)
  })

  it('Animaux de la forêt : révèle la main de la cible et le poseur choisit la carte à défausser', () => {
    let s = fateRevealing('animaux-foret', 'hurlement-effroi')
    // Animaux de la forêt (Événement) est résolu en jouant la carte ; on garnit
    // d'abord la main de la cible.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, hand: [inst('miroir-magique'), inst('caquet-megere')] } : p,
      ),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'animaux-foret#1' })
    // La main est révélée → choix ouvert (chooser = J1, cible = J0).
    expect(s.pendingFateChoice?.kind).toBe('discard-from-hand')
    expect(s.pendingFateChoice?.chooserIndex).toBe(1)
    expect((s.pendingFateChoice?.candidateIds ?? []).sort()).toEqual(['caquet-megere#1', 'miroir-magique#1'])
    // Le poseur choisit de défausser le Miroir magique.
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'miroir-magique#1' })
    expect(s.pendingFateChoice ?? null).toBeNull()
    expect(s.players[0].hand.some((c) => c.cardId === 'miroir-magique')).toBe(false)
    expect(s.players[0].discard.some((c) => c.cardId === 'miroir-magique')).toBe(true)
    expect(s.players[0].hand.some((c) => c.cardId === 'caquet-megere')).toBe(true)
  })

  it("Premier baiser d'amour : retire 1 Poison, puis le poseur remet un Héros de la défausse Fatalité sur le dessus", () => {
    let s = createInitialGame(
      [
        { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p0:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p0f:') },
        { villain: mechanteReine, deckCards: buildDeckInstances(mechanteReineCards, 'villain', 'p1:'), fateCards: buildDeckInstances(mechanteReineCards, 'fate', 'p1f:') },
      ],
      7,
    )
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, poison: 2, fateDiscard: [inst('grincheux')], fateDeck: [inst('premier-baiser'), inst('hurlement-effroi'), ...p.fateDeck] }
          : { ...p, pawnLocation: 'laboratoire' },
      ),
    }
    s = applyAction(s, { type: 'FATE', actionId: 'fate' })
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'premier-baiser#1' })
    // 1 Poison retiré, puis choix du Héros à remonter (ici seul Grincheux).
    expect(s.players[0].poison).toBe(1)
    expect(s.pendingFateChoice?.kind).toBe('fate-discard-hero-to-top')
    expect(s.pendingFateChoice?.candidateIds).toEqual(['grincheux#1'])
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'grincheux#1' })
    expect(s.pendingFateChoice ?? null).toBeNull()
    expect(s.players[0].fateDeck[0].cardId).toBe('grincheux')
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'grincheux')).toBe(false)
  })

  it("Premier baiser d'amour : sans Poison ni Héros en défausse Fatalité, aucun effet (pas de choix)", () => {
    let s = atLocation('laboratoire', [], 0)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, poison: 0, fateDiscard: p.fateDiscard.filter((c) => c.type !== 'hero') } : p,
      ),
    }
    const after = resolveEffects(s, [{ type: 'LOVES_FIRST_KISS' }], { actorIndex: s.activePlayer })
    expect(after.pendingFateChoice ?? null).toBeNull()
    expect(me(after).poison).toBe(0)
  })

  it('« Croque ! » ouvre un choix, puis dépense le Poison = force et l’élimine ; victoire à la Maison des Nains', () => {
    let s = atLocation('maison-des-nains', [], 0)
    s = withHeroes(s, [hero('blanche-neige', 'maison-des-nains')])
    // Blanche-Neige seule → force 1 ; on donne 1 Poison.
    s = { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, poison: 1 } : p)) }
    s = resolveEffects(s, [{ type: 'TAKE_A_BITE' }], { actorIndex: s.activePlayer })
    expect(s.pendingTakeABite?.candidateIds).toEqual(['blanche-neige#1'])
    const after = applyAction(s, { type: 'RESOLVE_TAKE_A_BITE', heroInstanceId: 'blanche-neige#1' })
    expect(after.status).toBe('WON')
    expect(me(after).poison).toBe(0)
  })

  it('« Croque ! » sans assez de Poison n’ouvre aucun choix', () => {
    let s = atLocation('maison-des-nains', [], 0)
    s = withHeroes(s, [hero('grincheux', 'maison-des-nains')])
    s = { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, poison: 1 } : p)) }
    const after = resolveEffects(s, [{ type: 'TAKE_A_BITE' }], { actorIndex: s.activePlayer })
    // Grincheux seul = force 4 (3 +1) > 1 Poison → aucun candidat.
    expect(after.pendingTakeABite ?? null).toBeNull()
    expect(after.players[after.activePlayer].board['maison-des-nains'].some((c) => c.cardId === 'grincheux')).toBe(true)
  })

  it('« Croque ! » est injouable si aucun Héros éliminable (Poison insuffisant)', () => {
    let s = atLocation('foret', [inst('croque')], 0)
    s = withHeroes(s, [hero('grincheux', 'foret')]) // force ≥ 1, 0 Poison → non éliminable
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'croque#1' }),
    ).toThrow()
  })

  it('« Croque ! » devient jouable et ouvre le choix dès qu’un Héros est éliminable', () => {
    let s = atLocation('foret', [inst('croque')], 0)
    s = withHeroes(s, [hero('grincheux', 'foret')])
    s = { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, poison: 9 } : p)) }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'croque#1' })
    expect(after.pendingTakeABite?.candidateIds).toContain('grincheux#1')
  })
})

describe('La Méchante Reine — Magie noire', () => {
  it('ouvre un choix (pioche + défausse) incluant Objets ET Ingrédients', () => {
    let s = atLocation('foret', [inst('magie-noire')], 5)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer
          ? { ...p, deck: [inst('trone'), inst('caquet-megere')], discard: [inst('ecrin')] }
          : p,
      ),
    }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'magie-noire#1' })
    expect(s.pendingRecover?.label).toBe('Magie noire')
    const ids = s.pendingRecover?.candidateIds ?? []
    expect(ids).toContain('trone#1') // Objet (pioche)
    expect(ids).toContain('caquet-megere#1') // Ingrédient (pioche)
    expect(ids).toContain('ecrin#1') // Objet (défausse)
  })

  it('Jalousie ajoute 1 jeton Poison quand elle est jouée', () => {
    const s = atLocation('foret', [], 0)
    const after = applyAction(s, { type: 'TEST_PLAY_CONDITION', card: inst('jalousie') })
    expect(me(after).poison).toBe(1)
  })

  it('Foudre est injouable tant qu’aucun Ingrédient n’a été joué', () => {
    const s = atLocation('foret', [inst('foudre')], 5)
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' }),
    ).toThrow()
    // Avec un Ingrédient en zone, elle devient jouable.
    const s2 = {
      ...s,
      players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, ingredients: [inst('caquet-megere')] } : p)),
    }
    const after = applyAction(s2, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' })
    expect(after.players[after.activePlayer].discard.some((c) => c.cardId === 'foudre')).toBe(true)
  })

  it('Hurlement d’effroi ouvre un choix puis déplace les Héros ≤ 3 vers un voisin', () => {
    let s = atLocation('foret', [inst('hurlement-effroi')], 5)
    s = withHeroes(s, [hero('atchoum', 'foret')]) // force 2 ≤ 3
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'hurlement-effroi#1' })
    expect(s.pendingScream?.options.length ?? 0).toBeGreaterThan(0)
    const opt = s.pendingScream!.options.find((o) => o.from === 'foret')!
    const after = applyAction(s, { type: 'RESOLVE_SCREAM', from: opt.from, to: opt.to })
    expect(after.pendingScream ?? null).toBeNull()
    expect((after.players[after.activePlayer].board['foret'] ?? []).some((c) => c.cardId === 'atchoum')).toBe(false)
    expect((after.players[after.activePlayer].board[opt.to] ?? []).some((c) => c.cardId === 'atchoum')).toBe(true)
  })

  it('« Je vais vous broyer les os ! » : injouable sans Héros sur le lieu, sinon découvre les actions', () => {
    const s = atLocation('laboratoire', [inst('broyer-os')], 0)
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'broyer-os#1' }),
    ).toThrow()
    let s2 = atLocation('laboratoire', [inst('broyer-os')], 0)
    s2 = withHeroes(s2, [hero('atchoum', 'laboratoire')])
    const after = applyAction(s2, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'broyer-os#1' })
    expect(after.uncoverCoveredActions).toBe(true)
  })

  it('Foudre avec plusieurs Ingrédients ouvre un choix', () => {
    let s = atLocation('foret', [inst('foudre')], 5)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, ingredients: [inst('caquet-megere'), inst('noir-de-nuit')] } : p,
      ),
    }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' })
    expect(s.pendingDuplicateIngredient?.candidateIds).toEqual(['caquet-megere#1', 'noir-de-nuit#1'])
    const after = applyAction(s, { type: 'RESOLVE_DUPLICATE_INGREDIENT', ingredientInstanceId: 'caquet-megere#1' })
    expect(after.pendingDuplicateIngredient ?? null).toBeNull()
  })

  it('Foudre coûte le coût de l’Ingrédient reproduit (Hurlement = 2)', () => {
    let s = atLocation('foret', [inst('foudre')], 5)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, ingredients: [inst('caquet-megere'), inst('hurlement-effroi')] } : p,
      ),
    }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' })
    // Foudre ne coûte rien à la pose : le coût est payé au choix de l'Ingrédient.
    expect(me(s).power).toBe(5)
    const after = applyAction(s, { type: 'RESOLVE_DUPLICATE_INGREDIENT', ingredientInstanceId: 'hurlement-effroi#1' })
    // Hurlement d'effroi coûte 2 → 5 − 2 = 3 (puis Hurlement ouvre éventuellement
    // un choix de déplacement, sans toucher au Pouvoir).
    expect(me(after).power).toBe(3)
  })

  it('Foudre : injouable si aucun Ingrédient joué n’est payable', () => {
    // Un seul Ingrédient en zone (Hurlement, coût 2) et 1 seul Pouvoir.
    let s = atLocation('foret', [inst('foudre')], 1)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, ingredients: [inst('hurlement-effroi')] } : p,
      ),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' }),
    ).toThrow()
  })

  it('Foudre : seuls les Ingrédients payables sont proposés au choix', () => {
    // Caquet (0) et Hurlement (2) en zone, mais seulement 1 Pouvoir → Hurlement exclu.
    let s = atLocation('foret', [inst('foudre')], 1)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, ingredients: [inst('caquet-megere'), inst('hurlement-effroi')] } : p,
      ),
    }
    // Un seul payable → reproduction directe (Caquet, coût 0), sans choix.
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' })
    expect(s.pendingDuplicateIngredient ?? null).toBeNull()
  })

  it('Foudre : annuler remet Foudre en main et libère l’action', () => {
    let s = atLocation('foret', [inst('foudre')], 5)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, ingredients: [inst('caquet-megere'), inst('noir-de-nuit')] } : p,
      ),
    }
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'foudre#1' })
    expect(s.pendingDuplicateIngredient).toBeTruthy()
    const after = applyAction(s, { type: 'CANCEL_DUPLICATE_INGREDIENT' })
    expect(after.pendingDuplicateIngredient ?? null).toBeNull()
    expect(me(after).hand.some((c) => c.cardId === 'foudre')).toBe(true)
    expect(me(after).discard.some((c) => c.cardId === 'foudre')).toBe(false)
    expect(after.usedActionIds).not.toContain('play-card')
  })
})

describe('La Méchante Reine — forces passives des Nains', () => {
  it('Blanche-Neige : +1 par autre Héros du royaume', () => {
    let s = atLocation('mine', [], 0)
    s = withHeroes(s, [
      hero('blanche-neige', 'maison-des-nains'),
      hero('atchoum', 'foret'),
      hero('dormeur', 'mine'),
    ])
    const bn = me(s).board['maison-des-nains'][0]
    // Base 1 + 2 autres Héros = 3.
    expect(effectiveStrength(s, s.activePlayer, bn.instanceId)).toBe(3)
  })

  it('Grincheux : +1 seul sur son lieu, +0 avec un autre Héros', () => {
    let s = atLocation('mine', [], 0)
    s = withHeroes(s, [hero('grincheux', 'mine')])
    const g = me(s).board['mine'][0]
    expect(effectiveStrength(s, s.activePlayer, g.instanceId)).toBe(4)
    s = withHeroes(s, [hero('atchoum', 'mine', 2)])
    expect(effectiveStrength(s, s.activePlayer, g.instanceId)).toBe(3)
  })

  it('Simplet : +1 à tous les AUTRES Héros (pas à lui-même)', () => {
    let s = atLocation('mine', [], 0)
    s = withHeroes(s, [hero('simplet', 'mine'), hero('atchoum', 'mine')])
    const cell = me(s).board['mine']
    const simplet = cell.find((c) => c.cardId === 'simplet')!
    const atchoum = cell.find((c) => c.cardId === 'atchoum')!
    expect(effectiveStrength(s, s.activePlayer, simplet.instanceId)).toBe(3) // pas de bonus sur lui-même
    expect(effectiveStrength(s, s.activePlayer, atchoum.instanceId)).toBe(3) // 2 + 1
  })
})
