import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { hasReachedObjective, ownedKeyColors, holdsBlackKey, effectiveStrength, coveredTopActionIdsAt, getAvailableActions } from '../rules'
import { resolveEffects } from '../effects'
import { seigneurCles } from '../../data/villains/seigneurCles'
import { seigneurClesCards } from '../../data/villains/seigneurCles.cards'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { buildDeckInstances } from '../../data/types'
import { KEY_COLORS } from '../types'
import type { GameState, KeyColor, KeyToken } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: seigneurCles,
        deckCards: buildDeckInstances(seigneurClesCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(seigneurClesCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

const keys = (s: GameState): KeyToken[] => s.players[0].keys ?? []
/** Donne au joueur 0 le jeu de clés indiqué (remplace), tout possédé sauf indication. */
const setKeys = (s: GameState, ks: KeyToken[]): GameState => ({
  ...s,
  players: [{ ...s.players[0], keys: ks }],
})
const ownedOf = (colors: KeyColor[]): KeyToken[] =>
  colors.map((c, i) => ({ id: `k${i}`, color: c, location: null }))

/** Partie à 2 joueurs : 0 = Seigneur (cible Fatalité), 1 = adversaire actif. */
const game2 = (seed = 7): GameState =>
  createInitialGame(
    [
      { villain: seigneurCles, deckCards: buildDeckInstances(seigneurClesCards, 'villain', 'p0:'), fateCards: buildDeckInstances(seigneurClesCards, 'fate', 'p0f:') },
      { villain: princeJohn, deckCards: buildDeckInstances(princeJohnCards, 'villain', 'p1:'), fateCards: buildDeckInstances(princeJohnCards, 'fate', 'p1f:') },
    ],
    seed,
  )

describe('Le Seigneur des clés — Fatalité jouée CONTRE le Seigneur (flux complet)', () => {
  it('Plaisir ou souffrance jouée par l’adversaire résout bien son effet sur le Seigneur', () => {
    let s = game2()
    const plaisir = (s.players[0].fateDeck ?? []).find((c) => c.cardId === 'plaisir-ou-souffrance')!
    expect(plaisir).toBeTruthy()
    // Le Seigneur possède une clé + du Pouvoir → un vrai choix doit s'ouvrir.
    s = {
      ...s,
      activePlayer: 1,
      players: [{ ...s.players[0], keys: [{ id: 'k0', color: 'bleu', location: null }], power: 5 }, s.players[1]],
      pendingFate: { target: 0, chooserIndex: 1, revealed: [plaisir] } as never,
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: plaisir.instanceId })
    // L'effet s'est résolu : choix Plaisir ouvert pour le Seigneur (et non simple défausse).
    expect(s.pendingFate).toBeNull()
    expect(s.pendingPlaisir?.playerIndex).toBe(0)
    expect(s.players[0].fateDiscard.some((c) => c.cardId === 'plaisir-ou-souffrance')).toBe(true)
  })
})

describe('Le Seigneur des clés — mise en place des clés', () => {
  it('place 12 clés (3 par lieu) au démarrage', () => {
    const s = game()
    const onBoard = keys(s).filter((k) => k.location !== null)
    expect(keys(s)).toHaveLength(12)
    expect(onBoard).toHaveLength(12)
    for (const loc of s.players[0].locations) {
      expect(onBoard.filter((k) => k.location === loc.id)).toHaveLength(3)
    }
  })

  it('au moins une clé de chaque couleur est posée', () => {
    const s = game()
    const colors = new Set(keys(s).map((k) => k.color))
    for (const c of KEY_COLORS) expect(colors.has(c)).toBe(true)
  })

  it('ne crée jamais plus de 4 clés d’une même couleur', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = game(seed)
      const count: Record<string, number> = {}
      for (const k of keys(s)) count[k.color] = (count[k.color] ?? 0) + 1
      for (const c of KEY_COLORS) expect(count[c] ?? 0).toBeLessThanOrEqual(4)
    }
  })
})

describe('Le Seigneur des clés — objectif KEYS_ALL_COLORS', () => {
  it('victoire avec 1 clé de chaque couleur possédée', () => {
    const s = setKeys(game(), ownedOf([...KEY_COLORS]))
    expect(ownedKeyColors(s.players[0]).size).toBe(6)
    expect(hasReachedObjective(s, 0)).toBe(true)
  })

  it('pas de victoire s’il manque une couleur', () => {
    const s = setKeys(game(), ownedOf(KEY_COLORS.slice(0, 5)))
    expect(hasReachedObjective(s, 0)).toBe(false)
  })

  it('la Clé Noire bloque la victoire même avec les 6 couleurs', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    s = {
      ...s,
      players: [
        {
          ...s.players[0],
          board: {
            ...s.players[0].board,
            crypte: [
              { instanceId: 'cn', cardId: 'cle-noire', type: 'item', name: 'Clé Noire', cost: 0, copies: 1 } as never,
            ],
          },
        },
      ],
    }
    expect(holdsBlackKey(s.players[0])).toBe(true)
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Le Seigneur des clés — ramassage et perte de clé', () => {
  it('TAKE_KEY_AT_PAWN ouvre un choix de clé, RESOLVE_KEY la ramasse', () => {
    let s = game()
    const pawn = s.players[0].pawnLocation!
    s = resolveEffects(s, [{ type: 'TAKE_KEY_AT_PAWN' }], { actorIndex: 0 })
    expect(s.pendingKey?.kind).toBe('take')
    const target = keys(s).find((k) => k.location === pawn)!
    s = applyAction(s, { type: 'RESOLVE_KEY', keyId: target.id })
    expect(s.pendingKey).toBeNull()
    expect(keys(s).find((k) => k.id === target.id)?.location).toBeNull()
  })

  it('LOSE_KEY_GAIN_POWER repose une clé sur le lieu choisi (< 3 clés) et donne du Pouvoir', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    const power0 = s.players[0].power
    s = resolveEffects(s, [{ type: 'LOSE_KEY_GAIN_POWER', power: 3 }], { actorIndex: 0 })
    expect(s.pendingKey?.kind).toBe('lose')
    expect(s.pendingKey?.chooseDest).toBe(true)
    const lost = keys(s)[0].id
    s = applyAction(s, { type: 'RESOLVE_KEY', keyId: lost, locationId: 'cimetiere' })
    expect(keys(s).find((k) => k.id === lost)?.location).toBe('cimetiere')
    expect(s.players[0].power).toBe(power0 + 3)
  })
})

describe('Le Seigneur des clés — dé de couleur', () => {
  it('CHOOSE_COLOR_ROLL_TAKE_KEY ouvre un choix de couleur puis lance le dé', () => {
    let s = setKeys(game(), [
      { id: 'b0', color: 'bleu', location: 'crypte' },
      ...ownedOf(['rouge']),
    ])
    s = { ...s, players: [{ ...s.players[0], pawnLocation: 'crypte' }] }
    s = resolveEffects(s, [{ type: 'CHOOSE_COLOR_ROLL_TAKE_KEY' }], { actorIndex: 0 })
    expect(s.pendingKeyColor?.playerIndex).toBe(0)
    s = applyAction(s, { type: 'RESOLVE_KEY_COLOR', color: 'bleu' })
    expect(s.pendingKeyColor).toBeNull()
    // Le dé est déterministe : la couleur tirée est mémorisée dans lastDieColor.
    expect(KEY_COLORS).toContain(s.lastDieColor)
  })

  it('ROLL_DIE_TAKE_KEY_FROM_BOARD (Obtenir une clé) ouvre un choix de clé de la couleur du dé', () => {
    // Une clé de CHAQUE couleur posée → la couleur tirée existe forcément sur le plateau.
    let s = setKeys(game(3), KEY_COLORS.map((c, i) => ({ id: `b${i}`, color: c, location: 'cimetiere' })))
    s = resolveEffects(s, [{ type: 'ROLL_DIE_TAKE_KEY_FROM_BOARD' }], { actorIndex: 0 })
    // Le dé est mémorisé (animation) et un choix de clé de cette couleur est ouvert.
    expect(KEY_COLORS).toContain(s.lastDieColor)
    expect(s.dieRoll?.color).toBe(s.lastDieColor)
    expect(s.pendingKey?.kind).toBe('take')
    expect(s.pendingKey?.color).toBe(s.lastDieColor)
    // On prend la clé de cette couleur → elle devient possédée.
    const target = keys(s).find((k) => k.color === s.lastDieColor)!
    s = applyAction(s, { type: 'RESOLVE_KEY', keyId: target.id })
    expect(s.pendingKey).toBeNull()
    expect(keys(s).find((k) => k.id === target.id)?.location).toBeNull()
  })

  it('le résultat du dé est déterministe pour une graine donnée', () => {
    const a = applyAction(
      resolveEffects(game(1), [{ type: 'CHOOSE_COLOR_ROLL_TAKE_KEY' }], { actorIndex: 0 }),
      { type: 'RESOLVE_KEY_COLOR', color: 'bleu' },
    )
    const b = applyAction(
      resolveEffects(game(1), [{ type: 'CHOOSE_COLOR_ROLL_TAKE_KEY' }], { actorIndex: 0 }),
      { type: 'RESOLVE_KEY_COLOR', color: 'bleu' },
    )
    expect(a.lastDieColor).toBe(b.lastDieColor)
  })
})

describe('Le Seigneur des clés — Plaisir ou souffrance', () => {
  it('choix « power » retire du Pouvoir', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    s = { ...s, players: [{ ...s.players[0], power: 5 }] }
    s = resolveEffects(s, [{ type: 'PLAISIR_OU_SOUFFRANCE', power: 3 }], { actorIndex: 0 })
    expect(s.pendingPlaisir?.power).toBe(3)
    s = applyAction(s, { type: 'RESOLVE_PLAISIR', choice: 'power' })
    expect(s.pendingPlaisir).toBeNull()
    expect(s.players[0].power).toBe(2)
  })

  it('choix « key » : reposer une clé sur un lieu de son choix (< 3 clés)', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    s = { ...s, players: [{ ...s.players[0], power: 5 }] }
    s = resolveEffects(s, [{ type: 'PLAISIR_OU_SOUFFRANCE', power: 3 }], { actorIndex: 0 })
    s = applyAction(s, { type: 'RESOLVE_PLAISIR', choice: 'key' })
    expect(s.pendingKey?.kind).toBe('lose')
    expect(s.pendingKey?.chooseDest).toBe(true)
    const k = keys(s).find((x) => x.location === null)!
    s = applyAction(s, { type: 'RESOLVE_KEY', keyId: k.id, locationId: 'cachot' })
    expect(s.pendingKey).toBeNull()
    expect(keys(s).find((x) => x.id === k.id)?.location).toBe('cachot')
  })

  it('forcé : sans Pouvoir → doit reposer une clé (pas de choix Plaisir)', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    s = { ...s, players: [{ ...s.players[0], power: 0 }] }
    s = resolveEffects(s, [{ type: 'PLAISIR_OU_SOUFFRANCE', power: 3 }], { actorIndex: 0 })
    expect(s.pendingPlaisir).toBeFalsy()
    expect(s.pendingKey?.kind).toBe('lose')
    expect(s.pendingKey?.chooseDest).toBe(true)
  })

  it('forcé : sans clé → perd directement le Pouvoir (pas de choix Plaisir)', () => {
    let s = setKeys(game(), [])
    s = { ...s, players: [{ ...s.players[0], power: 5 }] }
    s = resolveEffects(s, [{ type: 'PLAISIR_OU_SOUFFRANCE', power: 3 }], { actorIndex: 0 })
    expect(s.pendingPlaisir).toBeFalsy()
    expect(s.pendingKey).toBeFalsy()
    expect(s.players[0].power).toBe(2)
  })
})

describe('Le Seigneur des clés — Souffre douleur (force réduite à 0)', () => {
  it('réduit la force effective d’un Héros à 0 (éliminable sans Allié)', () => {
    let s = game()
    const hero = { instanceId: 'h1', cardId: 'belle', type: 'hero', name: 'Héros', strength: 4, copies: 1 } as never
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, crypte: [hero] } }] }
    expect(effectiveStrength(s, 0, 'h1')).toBe(4)
    s = resolveEffects(s, [{ type: 'REDUCE_HERO_STRENGTH_PERM', amount: 99 }], { actorIndex: 0, targetHeroId: 'h1' })
    expect(effectiveStrength(s, 0, 'h1')).toBe(0)
  })

  it('la réduction est DÉFINITIVE : elle survit à la fin du tour', () => {
    let s = game2()
    const hero = { instanceId: 'h1', cardId: 'belle', type: 'hero', name: 'Héros', strength: 4, copies: 1 } as never
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], board: { ...s.players[0].board, crypte: [hero] } }, s.players[1]],
    }
    s = resolveEffects(s, [{ type: 'REDUCE_HERO_STRENGTH_PERM', amount: 99 }], { actorIndex: 0, targetHeroId: 'h1' })
    expect(effectiveStrength(s, 0, 'h1')).toBe(0)
    s = applyAction(s, { type: 'END_TURN' })
    expect(effectiveStrength(s, 0, 'h1')).toBe(0)
    // …et même un bonus de force ultérieur ne la relève pas (« réduite à 0 »).
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, crypte: [{ ...s.players[0].board.crypte![0], forceTokens: 3 }] } }, s.players[1]] }
    expect(effectiveStrength(s, 0, 'h1')).toBe(0)
  })

  it('le Journal annonce une réduction définitive (sans mention « fin du tour »)', () => {
    let s = game()
    const hero = { instanceId: 'h1', cardId: 'belle', type: 'hero', name: 'Gévaudan', strength: 4, copies: 1 } as never
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, crypte: [hero] } }] }
    s = resolveEffects(s, [{ type: 'REDUCE_HERO_STRENGTH_PERM', amount: 99 }], { actorIndex: 0, targetHeroId: 'h1' })
    const line = s.log[s.log.length - 1]
    expect(line).toContain('force réduite à 0 définitivement')
    expect(line).not.toContain('fin du tour')
    expect(line).not.toContain('Talon d’Achille')
    expect(line).not.toContain("Talon d'Achille")
  })
})

describe('Le Seigneur des clés — Carte Temps (refaire une action)', () => {
  /** Partie en phase ACTION, pion à la Crypte, l'action `used` déjà jouée ce tour. */
  const atCrypte = (used: string, flags: Partial<GameState['players'][number]> = {}): GameState => {
    const s = game()
    return {
      ...s,
      phase: 'ACTION',
      usedActionIds: [used],
      players: [{ ...s.players[0], pawnLocation: 'crypte', ...flags }],
    }
  }

  it('sans le drapeau, une action déjà jouée reste indisponible', () => {
    const ids = getAvailableActions(atCrypte('obtain-key')).map((a) => a.id)
    expect(ids).not.toContain('obtain-key')
  })

  it('Carte Temps rend « Obtenir une clé » de nouveau disponible', () => {
    const ids = getAvailableActions(atCrypte('obtain-key', { repeatActionAvailable: true })).map((a) => a.id)
    expect(ids).toContain('obtain-key')
  })

  it('Noir de nuit (exceptFate) ne rend PAS la Fatalité rejouable, mais bien les autres', () => {
    const s = game()
    const base: GameState = {
      ...s,
      phase: 'ACTION',
      usedActionIds: ['fate', 'play-card'],
      players: [{ ...s.players[0], pawnLocation: 'cimetiere', repeatActionAvailable: true, repeatActionNoFate: true }],
    }
    const ids = getAvailableActions(base).map((a) => a.id)
    expect(ids).not.toContain('fate')
    expect(ids).toContain('play-card')
  })

  it('le drapeau se consomme sur la SECONDE utilisation (une seule répétition)', () => {
    let s = atCrypte('gain-power', { repeatActionAvailable: true, power: 0 })
    s = applyAction(s, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })
    expect(s.players[0].repeatActionAvailable).toBe(false)
    expect(getAvailableActions(s).map((a) => a.id)).not.toContain('gain-power')
    expect(s.log.some((l) => /refait une action de son lieu/.test(l))).toBe(true)
  })
})

describe('Le Seigneur des clés — un choix de clé bloque les autres actions', () => {
  it('tant que la clé n’est pas ramassée, aucune autre action du lieu n’est disponible', () => {
    // Une clé de CHAQUE couleur sur le plateau : le jet de dé trouve forcément une cible.
    const onBoard: KeyToken[] = KEY_COLORS.map((c, i) => ({ id: `k${i}`, color: c, location: 'crypte' }))
    const s = setKeys(game(), onBoard)
    const atCrypte: GameState = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], pawnLocation: 'crypte' }],
    }
    // Avant : les actions de la Crypte sont disponibles.
    expect(getAvailableActions(atCrypte).length).toBeGreaterThan(0)
    // L'action « Obtenir une clé » ouvre le choix (jet de couleur) → tout est gelé.
    const picking = applyAction(atCrypte, { type: 'OBTAIN_KEY', actionId: 'obtain-key' })
    expect(picking.pendingKey?.kind).toBe('take')
    expect(getAvailableActions(picking)).toEqual([])
    // Une fois la clé prise, le tour reprend son cours.
    const pick = (picking.players[0].keys ?? []).find((k) => k.color === picking.pendingKey!.color)!
    const done = applyAction(picking, { type: 'RESOLVE_KEY', keyId: pick.id })
    expect(done.pendingKey ?? null).toBeNull()
    expect(getAvailableActions(done).length).toBeGreaterThan(0)
  })
})

describe('Le Seigneur des clés — Hellin (bloque 3 actions au lieu de 2)', () => {
  it('recouvre la rangée du haut ET la 1ʳᵉ action du bas du Cachot', () => {
    let s = game()
    const hellin = { instanceId: 'h1', cardId: 'hellin', type: 'hero', name: 'Hellin', strength: 2, copies: 1, coversExtraAction: true } as never
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, cachot: [hellin] } }] }
    const covered = coveredTopActionIdsAt(s.players[0], 'cachot')
    expect([...covered].sort()).toEqual(['gain-power', 'play-card-bottom', 'play-card-top'])
    // …et un Héros ordinaire ne recouvre que les 2 actions du haut.
    const ordinaire = { ...(hellin as unknown as Record<string, unknown>), coversExtraAction: undefined } as never
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, cachot: [ordinaire] } }] }
    expect([...coveredTopActionIdsAt(s.players[0], 'cachot')].sort()).toEqual(['gain-power', 'play-card-top'])
  })
})

describe('Le Seigneur des clés — Sorcellerie & Gévaudan (choix de l’adversaire)', () => {
  it('Sorcellerie ouvre un choix de clé, RESOLVE_STEAL_KEY la repose sur le lieu choisi', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    s = resolveEffects(s, [{ type: 'RETURN_OWNED_KEY_TO_BOARD' }], { actorIndex: 0 })
    expect(s.pendingStealKey?.mode).toBe('return')
    const target = keys(s).find((k) => k.location === null)!
    s = applyAction(s, { type: 'RESOLVE_STEAL_KEY', keyId: target.id, locationId: 'cimetiere' })
    expect(s.pendingStealKey).toBeNull()
    expect(keys(s).find((k) => k.id === target.id)?.location).toBe('cimetiere')
  })

  it('Gévaudan (STEAL_KEY_TO_HERO) vole 2 clés, choisies une par une', () => {
    let s = setKeys(game(), ownedOf([...KEY_COLORS]))
    s = resolveEffects(s, [{ type: 'STEAL_KEY_TO_HERO' }], { actorIndex: 0, hostInstanceId: 'gv1' })
    expect(s.pendingStealKey?.mode).toBe('steal')
    expect(s.pendingStealKey?.count).toBe(2)
    // 1ʳᵉ clé volée → le pending reste ouvert pour la 2ᵉ.
    const k1 = keys(s).find((k) => k.location === null)!
    s = applyAction(s, { type: 'RESOLVE_STEAL_KEY', keyId: k1.id })
    expect(s.pendingStealKey?.count).toBe(1)
    // 2ᵉ clé volée → terminé.
    const k2 = keys(s).find((k) => k.location === null && !k.stolenBy)!
    s = applyAction(s, { type: 'RESOLVE_STEAL_KEY', keyId: k2.id })
    expect(s.pendingStealKey).toBeNull()
    expect(keys(s).filter((k) => k.stolenBy === 'gv1')).toHaveLength(2)
    // Deux couleurs volées → 4 couleurs possédées restantes.
    expect(ownedKeyColors(s.players[0]).size).toBe(4)
  })
})
