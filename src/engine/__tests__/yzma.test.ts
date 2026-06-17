import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { performVanquish, resolveEffects } from '../effects'
import { getAvailableActions, getLegalMoves, canFate } from '../rules'
import { enumerateActions } from '../../ai/enumerate'
import { buildDeckInstances } from '../../data/types'
import { scar } from '../../data/villains/scar'
import { scarCards } from '../../data/villains/scar.cards'
import { yzma } from '../../data/villains/yzma'
import { yzmaCards, yzmaCardById } from '../../data/villains/yzma.cards'
import type { CardInstance, GameState } from '../types'

/** Partie 2 joueurs : Scar (actif, index 0) vs Yzma (cible, index 1). */
function game(): GameState {
  return createInitialGame(
    [
      {
        villain: scar,
        deckCards: buildDeckInstances(scarCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(scarCards, 'fate', 'p0f:'),
      },
      {
        villain: yzma,
        deckCards: buildDeckInstances(yzmaCards, 'villain', 'p1:'),
        fateCards: buildDeckInstances(yzmaCards, 'fate', 'p1f:'),
      },
    ],
    7,
  )
}

function inst(cardId: string, n = 1): CardInstance {
  const c = yzmaCardById[cardId]
  return {
    instanceId: `${cardId}#${n}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    effects: c.effects,
  }
}

describe('Yzma — mise en place des 4 pioches Fatalité', () => {
  it('répartit les 16 cartes Fatalité en 4 pioches (une par lieu), fateDeck vide', () => {
    const s = game()
    const p = s.players[1]
    expect(p.fateDeck.length).toBe(0)
    expect(p.fateDecks).toBeDefined()
    const decks = p.fateDecks!
    expect(Object.keys(decks).sort()).toEqual(['jungle', 'maison-pacha', 'palais', 'poele-mudka'])
    const total = Object.values(decks).reduce((n, d) => n + d.length, 0)
    expect(total).toBe(16)
    // Répartition équitable : chaque pioche a 4 cartes (16 / 4).
    for (const d of Object.values(decks)) expect(d.length).toBe(4)
  })
})

describe('Yzma — Fatalité (choix de pioche puis de carte)', () => {
  /** Place un état avec pendingYzmaFate (phase deck) et des pioches contrôlées. */
  function withYzmaDecks(decks: Record<string, CardInstance[]>): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 0,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, fateDecks: { palais: [], 'maison-pacha': [], jungle: [], 'poele-mudka': [], ...decks }, fateDiscard: [] } : p,
      ),
      pendingYzmaFate: { chooserIndex: 0, targetIndex: 1, phase: 'deck' },
    }
  }

  it('choisir une pioche dévoile toutes ses cartes, puis jouer un Héros le pose sur le lieu', () => {
    const s = withYzmaDecks({ palais: [inst('kuzco'), inst('paysan')] })
    // Choisir la pioche du Palais.
    const afterDeck = applyAction(s, { type: 'RESOLVE_YZMA_FATE_DECK', locationId: 'palais' })
    expect(afterDeck.pendingYzmaFate?.phase).toBe('card')
    expect(afterDeck.pendingYzmaFate?.cards?.map((c) => c.cardId).sort()).toEqual(['kuzco', 'paysan'])
    // Jouer Kuzco → posé sur le Palais d'Yzma ; le reste (Paysan) remélangé dans la pioche.
    const afterCard = applyAction(afterDeck, { type: 'RESOLVE_YZMA_FATE_CARD', instanceId: 'kuzco#1' })
    expect(afterCard.pendingYzmaFate).toBeNull()
    const yz = afterCard.players[1]
    expect((yz.board['palais'] ?? []).some((c) => c.cardId === 'kuzco')).toBe(true)
    expect(yz.fateDecks?.['palais'].map((c) => c.cardId)).toEqual(['paysan'])
  })

  it('on peut ne jouer aucune carte : la pioche est replacée sans perte', () => {
    const s = withYzmaDecks({ jungle: [inst('paysan'), inst('bucky')] })
    const afterDeck = applyAction(s, { type: 'RESOLVE_YZMA_FATE_DECK', locationId: 'jungle' })
    const afterCard = applyAction(afterDeck, { type: 'RESOLVE_YZMA_FATE_CARD', instanceId: null })
    expect(afterCard.pendingYzmaFate).toBeNull()
    expect((afterCard.players[1].fateDecks?.['jungle'] ?? []).map((c) => c.cardId).sort()).toEqual(['bucky', 'paysan'])
  })

  it('une pioche vide ne peut pas être choisie', () => {
    const s = withYzmaDecks({ palais: [inst('kuzco')] })
    expect(() => applyAction(s, { type: 'RESOLVE_YZMA_FATE_DECK', locationId: 'maison-pacha' })).toThrow()
  })

  it("le bot (IA) sait résoudre la Fatalité d'Yzma : choix de pioche puis de carte", () => {
    // Phase 'deck' : seules les pioches NON VIDES sont proposées.
    const s = withYzmaDecks({ palais: [inst('kuzco'), inst('paysan')], jungle: [inst('bucky')] })
    const deckActions = enumerateActions(s)
    expect(deckActions.every((a) => a.type === 'RESOLVE_YZMA_FATE_DECK')).toBe(true)
    const offered = deckActions.map((a) => (a as { locationId: string }).locationId).sort()
    expect(offered).toEqual(['jungle', 'palais'])

    // Phase 'card' : une action par carte révélée, et JAMAIS « aucune carte » (null).
    const afterDeck = applyAction(s, { type: 'RESOLVE_YZMA_FATE_DECK', locationId: 'palais' })
    const cardActions = enumerateActions(afterDeck)
    expect(cardActions.every((a) => a.type === 'RESOLVE_YZMA_FATE_CARD')).toBe(true)
    const ids = cardActions.map((a) => (a as { instanceId: string | null }).instanceId)
    expect(ids).toContain('kuzco#1')
    expect(ids).toContain('paysan#1')
    expect(ids).not.toContain(null)
  })
})

describe('Yzma — Beauté endormie', () => {
  /** Yzma (index 1) active en phase ACTION, pion à la jungle, main + pouvoir donnés. */
  function yzmaReady(hand: CardInstance[], power: number, board: Record<string, CardInstance[]> = {}): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      turn: 2,
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, pawnLocation: 'jungle', hand, power, board: { ...p.board, ...board } } : p,
      ),
    }
  }

  it('jouée en 1re action : arme l’effet différé et verrouille le reste du tour', () => {
    const s = yzmaReady([inst('beaute-endormie')], 5)
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'beaute-endormie#1' })
    expect(after.players[1].beautySleepPending).toBe(true)
    expect(after.players[1].soleActionLock).toBe(true)
    // Verrou « seule action » : plus aucune action de lieu ni Fatalité disponible.
    expect(getAvailableActions(after).length).toBe(0)
    expect(canFate(after)).toBe(false)
    // Toute autre action réelle est refusée.
    expect(() => applyAction(after, { type: 'EXECUTE_ACTION', actionId: 'gain-power' })).toThrow()
  })

  it('refusée si une action réelle a déjà été utilisée ce tour', () => {
    const s = { ...yzmaReady([inst('beaute-endormie')], 5), usedActionIds: ['gain-power'] }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'beaute-endormie#1' }),
    ).toThrow()
  })

  it('au tour suivant : ouvre le réveil (bloque le déplacement) puis applique les choix', () => {
    // Yzma joue la carte, puis le tour passe à Scar, puis revient à Yzma.
    let s = yzmaReady([inst('beaute-endormie')], 3, { palais: [inst('kuzco')] })
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'beaute-endormie#1' })
    s = applyAction(s, { type: 'END_TURN' }) // → Scar (phase MOVE)
    s = applyAction(s, { type: 'MOVE', to: getLegalMoves(s)[0] }) // Scar se déplace
    s = applyAction(s, { type: 'END_TURN' }) // → Yzma (début de tour : réveil)
    expect(s.activePlayer).toBe(1)
    expect(s.pendingBeautySleep).toBeTruthy()
    expect(s.players[1].soleActionLock).toBe(false) // verrou expiré
    // Déplacement bloqué tant que le réveil n'est pas résolu.
    expect(getLegalMoves(s)).toEqual([])
    expect(() => applyAction(s, { type: 'MOVE', to: 'maison-pacha' })).toThrow()
    const powerBefore = s.players[1].power
    const handBefore = s.players[1].hand.length
    // Résout : +2 JT, pioche 2, et déplace Kuzco du Palais vers la Maison de Pacha (voisin).
    const r = applyAction(s, {
      type: 'RESOLVE_BEAUTY_SLEEP',
      gainPower: true,
      draw: true,
      heroMove: { heroInstanceId: 'kuzco#1', to: 'maison-pacha' },
    })
    expect(r.pendingBeautySleep).toBeNull()
    expect(r.players[1].power).toBe(powerBefore + 2)
    expect(r.players[1].hand.length).toBe(handBefore + 2)
    expect((r.players[1].board['palais'] ?? []).some((c) => c.cardId === 'kuzco')).toBe(false)
    expect((r.players[1].board['maison-pacha'] ?? []).some((c) => c.cardId === 'kuzco')).toBe(true)
    // Déplacement de nouveau possible.
    expect(getLegalMoves(r).length).toBeGreaterThan(0)
  })

  it('réveil entièrement décliné : aucun effet, pending fermé', () => {
    let s = yzmaReady([inst('beaute-endormie')], 3)
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'beaute-endormie#1' })
    s = applyAction(s, { type: 'END_TURN' })
    s = applyAction(s, { type: 'MOVE', to: getLegalMoves(s)[0] })
    s = applyAction(s, { type: 'END_TURN' })
    const powerBefore = s.players[1].power
    const r = applyAction(s, { type: 'RESOLVE_BEAUTY_SLEEP', gainPower: false, draw: false, heroMove: null })
    expect(r.pendingBeautySleep).toBeNull()
    expect(r.players[1].power).toBe(powerBefore)
  })
})

describe('Yzma — En fuite vise Kuzco en priorité', () => {
  it('renvoie Kuzco (cible de l’objectif) dans les pioches, même si un Héros plus fort est présent', () => {
    const base = game()
    const kuzco: CardInstance = { instanceId: 'k#1', cardId: 'kuzco', name: 'Kuzco', type: 'hero', strength: 2 }
    const strong: CardInstance = { instanceId: 's#1', cardId: 'paysan', name: 'Paysan', type: 'hero', strength: 9 }
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 1 ? { ...p, board: { ...p.board, palais: [kuzco, strong] } } : p)),
    }
    const after = resolveEffects(s, [{ type: 'YZMA_HERO_REALM_TO_DECKS' }], { actorIndex: 1 })
    const realm = Object.values(after.players[1].board).flat()
    expect(realm.some((c) => c.cardId === 'kuzco')).toBe(false) // Kuzco renvoyé dans les pioches
    expect(realm.some((c) => c.cardId === 'paysan')).toBe(true) // le Héros le plus fort reste
  })

  it('sans Kuzco présent, renvoie le Héros le plus fort', () => {
    const base = game()
    const h1: CardInstance = { instanceId: 'a#1', cardId: 'bucky', name: 'Bucky', type: 'hero', strength: 3 }
    const h2: CardInstance = { instanceId: 'b#1', cardId: 'paysan', name: 'Paysan', type: 'hero', strength: 7 }
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) => (i === 1 ? { ...p, board: { ...p.board, palais: [h1, h2] } } : p)),
    }
    const after = resolveEffects(s, [{ type: 'YZMA_HERO_REALM_TO_DECKS' }], { actorIndex: 1 })
    const realm = Object.values(after.players[1].board).flat()
    expect(realm.some((c) => c.instanceId === 'b#1')).toBe(false) // le plus fort renvoyé
    expect(realm.some((c) => c.instanceId === 'a#1')).toBe(true)
  })
})

describe('Yzma — Le chemin qui balance (jouabilité)', () => {
  /** Yzma active, pion à la jungle, avec un Kronk (kronkPower donné) au Palais. */
  function withKronk(kronkPower: number | undefined, includeKronk = true): GameState {
    const s = game()
    const kronk = { ...inst('kronk'), kronkPower }
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 1
          ? { ...p, pawnLocation: 'jungle', power: 5, hand: [inst('chemin-qui-balance')], board: { ...p.board, palais: includeKronk ? [kronk] : [] } }
          : p,
      ),
    }
  }

  it('injouable si Kronk n’a aucun jeton Pouvoir', () => {
    const s = withKronk(0)
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'chemin-qui-balance#1' }),
    ).toThrow()
  })

  it('injouable si Kronk est absent du royaume', () => {
    const s = withKronk(undefined, false)
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'chemin-qui-balance#1' }),
    ).toThrow()
  })

  it('jouable dès que Kronk porte au moins un jeton : +N JT, jetons retirés', () => {
    const s = withKronk(3)
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'chemin-qui-balance#1' })
    expect(after.players[1].power).toBe(5 + 3)
    const kronk = (after.players[1].board['palais'] ?? []).find((c) => c.cardId === 'kronk')
    expect(kronk?.kronkPower).toBe(0)
  })
})

describe('Yzma — Kronk (jetons, transformation, élimination)', () => {
  /** Yzma active (phase ACTION), pion au Palais, avec un Kronk donné sur la jungle. */
  function withKronkOnBoard(kronk: CardInstance, allies: CardInstance[] = []): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              pawnLocation: 'palais',
              power: 5,
              // Kronk est sur le plateau : il ne doit pas aussi rester dans le deck.
              deck: p.deck.filter((c) => c.cardId !== 'kronk'),
              board: { ...p.board, jungle: [kronk, ...allies] },
            }
          : p,
      ),
    }
  }

  it('déplacer Kronk lui ajoute 1 jeton ; à 3 il devient un Héros', () => {
    // Kronk avec 2 jetons sur la jungle ; on le déplace vers la Maison de Pacha (voisin).
    const kronk = { ...inst('kronk'), kronkPower: 2 }
    const s = withKronkOnBoard(kronk)
    // L'action « Déplacer un objet ou un allié » du Palais.
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'kronk#1', to: 'maison-pacha' })
    const k = Object.values(after.players[1].board).flat().find((c) => c.cardId === 'kronk')!
    expect(k.kronkPower).toBe(3)
    expect(k.type).toBe('hero')
    expect(k.kronkTransformed).toBe(true)
  })

  it('Bras droit : Kronk (devenu Héros) dans le royaume → retiré du plateau et ajouté à la main (Allié propre)', () => {
    const kronk = { ...inst('kronk'), kronkPower: 4, type: 'hero' as const, kronkTransformed: true }
    const couteau = { ...inst('couteau'), attachedTo: 'kronk#1' }
    const s = withKronkOnBoard(kronk, [couteau])
    const after = resolveEffects(s, [{ type: 'FIND_KRONK' }], { actorIndex: 1 })
    // Plus aucun Kronk sur le plateau.
    expect(Object.values(after.players[1].board).flat().some((c) => c.cardId === 'kronk')).toBe(false)
    // Kronk en main, redevenu un Allié propre (sans jetons ni transformation).
    const inHand = after.players[1].hand.find((c) => c.cardId === 'kronk')
    expect(inHand).toBeTruthy()
    expect(inHand?.type).toBe('ally')
    expect(inHand?.kronkPower).toBeUndefined()
    expect(inHand?.kronkTransformed).toBeUndefined()
    // Son Objet associé (Couteau) rejoint aussi la main, détaché.
    const itemInHand = after.players[1].hand.find((c) => c.cardId === 'couteau')
    expect(itemInHand?.attachedTo).toBeUndefined()
  })

  it('Kronk éliminé alors qu’il est un Héros → défausse Méchant (redevient Allié), pas la défausse Fatalité', () => {
    const kronk = { ...inst('kronk'), kronkPower: 3, type: 'hero' as const, kronkTransformed: true }
    // Deux Gardes impériaux (3+3 = 6 ≥ force 6 de Kronk) sur la même case.
    const s = withKronkOnBoard(kronk, [inst('gardes-imperiaux', 1), inst('gardes-imperiaux', 2)])
    const after = performVanquish(s, 'kronk#1', ['gardes-imperiaux#1', 'gardes-imperiaux#2'], false)
    expect(after.players[1].fateDiscard.some((c) => c.cardId === 'kronk')).toBe(false)
    const inVillainDiscard = after.players[1].discard.find((c) => c.cardId === 'kronk')
    expect(inVillainDiscard).toBeTruthy()
    expect(inVillainDiscard?.type).toBe('ally')
    expect(inVillainDiscard?.kronkPower).toBeUndefined()
    expect(inVillainDiscard?.kronkTransformed).toBeUndefined()
  })
})

describe('Yzma — Fausses funérailles (jouabilité)', () => {
  /** Yzma active, pion à la jungle, avec une défausse Fatalité donnée. */
  function withFateDiscard(fateDiscard: CardInstance[]): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      usedActionIds: [],
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, pawnLocation: 'jungle', power: 0, hand: [inst('fausses-funerailles')], fateDiscard } : p,
      ),
    }
  }

  it('injouable si aucun Héros dans la défausse Fatalité', () => {
    const s = withFateDiscard([]) // défausse Fatalité vide → aucun Héros
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'fausses-funerailles#1' }),
    ).toThrow()
  })

  it('jouable avec des Héros : +1 JT par Héros (plafond 5)', () => {
    const s = withFateDiscard([inst('kuzco'), inst('pacha'), inst('chaca')]) // 3 Héros
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'fausses-funerailles#1' })
    expect(after.players[1].power).toBe(3)
  })
})

describe('Yzma — objectif & règles de Vanquish', () => {
  /** Yzma (index 1) active, avec un plateau contrôlé sur le Palais. */
  function yzmaActive(cards: ReturnType<typeof inst>[]): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, board: { ...p.board, palais: cards } } : p,
      ),
    }
  }

  it('Kronk élimine Kuzco → victoire immédiate, et Kronk reste en jeu', () => {
    // Kuzco (7) éliminé par Kronk (6) + Gardes impériaux (3) = 9 ≥ 7.
    const s = yzmaActive([inst('kuzco'), inst('kronk'), inst('gardes-imperiaux')])
    const after = performVanquish(s, 'kuzco#1', ['kronk#1', 'gardes-imperiaux#1'], false)
    expect(after.status).toBe('WON')
    expect(after.winner).toBe(1)
    // Kronk n'est pas défaussé ; les Gardes le sont.
    expect((after.players[1].board['palais'] ?? []).some((c) => c.cardId === 'kronk')).toBe(true)
    expect(after.players[1].discard.some((c) => c.cardId === 'gardes-imperiaux')).toBe(true)
  })

  it('Kuzco éliminé SANS Kronk : pas de victoire, et il est remélangé dans les 4 pioches (jamais en défausse)', () => {
    // Kuzco (7) éliminé par 3 Gardes impériaux (3×3 = 9 ≥ 7), sans Kronk.
    const s = yzmaActive([inst('kuzco'), inst('gardes-imperiaux', 1), inst('gardes-imperiaux', 2), inst('gardes-imperiaux', 3)])
    const after = performVanquish(s, 'kuzco#1', ['gardes-imperiaux#1', 'gardes-imperiaux#2', 'gardes-imperiaux#3'], false)
    expect(after.status).toBe('PLAYING')
    expect(after.players[1].objectiveHeroDefeated).toBe(false)
    // Kuzco n'est PAS dans la défausse Fatalité…
    expect(after.players[1].fateDiscard.some((c) => c.cardId === 'kuzco')).toBe(false)
    // …il est de retour dans l'une des 4 pioches Fatalité.
    const inDecks = Object.values(after.players[1].fateDecks ?? {}).flat().some((c) => c.cardId === 'kuzco')
    expect(inDecks).toBe(true)
  })

  it('Kronk ne peut pas éliminer Bucky', () => {
    const s = yzmaActive([inst('bucky'), inst('kronk'), inst('gardes-imperiaux')])
    expect(() => performVanquish(s, 'bucky#1', ['kronk#1'], false)).toThrow()
  })

  it('Tant que Chaca est présent, Yzma ne peut pas éliminer un autre Héros', () => {
    const s = yzmaActive([inst('chaca'), inst('paysan'), inst('gardes-imperiaux')])
    expect(() => performVanquish(s, 'paysan#1', ['gardes-imperiaux#1'], false)).toThrow()
  })
})

describe('Yzma — manipulation des pioches (À l’attaque ! / Marteau)', () => {
  function yzmaOwnDeck(mode: 'attack' | 'hammer', decks: Record<string, CardInstance[]>): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, fateDecks: { palais: [], 'maison-pacha': [], jungle: [], 'poele-mudka': [], ...decks } } : p,
      ),
      pendingYzmaOwnDeck: { playerIndex: 1, mode },
    }
  }

  it('À l’attaque ! : joue les Héros, Mauvais levier se déclenche+défausse, les autres Événements sont remélangés', () => {
    const s0 = yzmaOwnDeck('attack', { jungle: [inst('kuzco'), inst('mauvais-levier'), inst('en-fuite'), inst('chaca')] })
    // Pouvoir pour observer Mauvais levier (perd la moitié, arrondie au supérieur).
    const s = { ...s0, players: s0.players.map((p, i) => (i === 1 ? { ...p, power: 8 } : p)) }
    // 1er temps : dévoile toute la pioche (modal). 2ᵉ temps : exécution.
    const reveal = applyAction(s, { type: 'RESOLVE_YZMA_OWN_DECK', locationId: 'jungle' })
    expect(reveal.pendingYzmaOwnDeck?.revealCards?.length).toBe(4)
    const after = applyAction(reveal, { type: 'RESOLVE_YZMA_OWN_DECK', locationId: '' })
    const yz = after.players[1]
    // Les Héros sont joués sur ce lieu.
    const onJungle = (yz.board['jungle'] ?? []).map((c) => c.cardId).sort()
    expect(onJungle).toEqual(['chaca', 'kuzco'])
    // Mauvais levier a déclenché (8 → perd 4 → 4) puis est défaussée.
    expect(yz.power).toBe(4)
    expect(yz.fateDiscard.some((c) => c.cardId === 'mauvais-levier')).toBe(true)
    // En fuite (autre Événement) est simplement REMÉLANGÉ dans la pioche, sans déclencher.
    expect(yz.fateDecks?.['jungle']?.map((c) => c.cardId)).toEqual(['en-fuite'])
    expect(after.pendingYzmaOwnDeck).toBeNull()
  })

  it('Je l’écraserai avec un marteau : choix de la pioche puis des cartes (face cachée) à défausser', () => {
    const s = yzmaOwnDeck('hammer', { palais: [inst('paysan'), inst('bucky'), inst('en-fuite')] })
    // 1er temps : choix de la pioche → ouvre la sélection (face cachée) de 2 cartes.
    const mid = applyAction(s, { type: 'RESOLVE_YZMA_OWN_DECK', locationId: 'palais' })
    const hp = mid.pendingYzmaOwnDeck?.hammerPick
    expect(hp).toBeTruthy()
    expect(hp!.count).toBe(2)
    expect(hp!.cards.length).toBe(3)
    // 2ᵉ temps : le joueur choisit 2 cartes (ici les 2 premières de la pioche).
    const picked = (mid.players[1].fateDecks?.['palais'] ?? []).slice(0, 2).map((c) => c.instanceId)
    const after = applyAction(mid, { type: 'RESOLVE_YZMA_HAMMER', instanceIds: picked })
    const yz = after.players[1]
    expect((yz.fateDecks?.['palais'] ?? []).length).toBe(1)
    expect(yz.fateDiscard.length).toBe(2)
    expect(after.pendingYzmaOwnDeck).toBeNull()
  })

  it('Marteau défausse Mauvais levier → son effet se déclenche aussi (Yzma perd la moitié)', () => {
    const s0 = yzmaOwnDeck('hammer', { palais: [inst('mauvais-levier'), inst('bucky')] })
    const s = { ...s0, players: s0.players.map((p, i) => (i === 1 ? { ...p, power: 8 } : p)) }
    const mid = applyAction(s, { type: 'RESOLVE_YZMA_OWN_DECK', locationId: 'palais' })
    // count = min(2, 2) = 2 : on défausse les deux (dont Mauvais levier).
    const ids = (mid.players[1].fateDecks?.['palais'] ?? []).map((c) => c.instanceId)
    const after = applyAction(mid, { type: 'RESOLVE_YZMA_HAMMER', instanceIds: ids })
    const yz = after.players[1]
    expect(yz.power).toBe(4) // Mauvais levier déclenché (8 → 4)
    expect(yz.fateDiscard.some((c) => c.cardId === 'mauvais-levier')).toBe(true)
    expect(after.pendingYzmaOwnDeck).toBeNull()
  })

  it('Marteau défausse Kuzco → Kuzco + les 4 pioches sont remélangés et reformés (la défausse hors Kuzco reste)', () => {
    // Pioche du Palais : Kuzco + Paysan + Bucky. Une autre pioche contient En fuite.
    // La défausse Fatalité contient déjà une carte (Paysan), qui doit y rester.
    const s0 = yzmaOwnDeck('hammer', { palais: [inst('kuzco'), inst('paysan'), inst('bucky')], jungle: [inst('en-fuite')] })
    const s = {
      ...s0,
      players: s0.players.map((p, i) => (i === 1 ? { ...p, fateDiscard: [inst('paysan')] } : p)),
    }
    const mid = applyAction(s, { type: 'RESOLVE_YZMA_OWN_DECK', locationId: 'palais' })
    // On force le choix de Kuzco (au lieu d'un choix « au hasard » côté UI).
    const kuzcoId = (mid.players[1].fateDecks?.['palais'] ?? []).find((c) => c.cardId === 'kuzco')!.instanceId
    const otherId = (mid.players[1].fateDecks?.['palais'] ?? []).find((c) => c.cardId !== 'kuzco')!.instanceId
    const after = applyAction(mid, { type: 'RESOLVE_YZMA_HAMMER', instanceIds: [kuzcoId, otherId] })
    const yz = after.players[1]
    // Kuzco n'est PAS resté en défausse : il a été remélangé dans les pioches.
    expect(yz.fateDiscard.some((c) => c.cardId === 'kuzco')).toBe(false)
    expect(Object.values(yz.fateDecks ?? {}).flat().some((c) => c.cardId === 'kuzco')).toBe(true)
    // La carte non-Kuzco défaussée par le Marteau + la défausse initiale restent en défausse.
    expect(yz.fateDiscard.length).toBe(2)
    // Total reformé = pioches restantes (Bucky + En fuite) + Kuzco = 3 cartes en pioches.
    expect(Object.values(yz.fateDecks ?? {}).flat().length).toBe(3)
  })
})

describe('Yzma — manipulation interactive (Paysan / Pacha)', () => {
  function withManip(
    pending: NonNullable<GameState['pendingYzmaManipulate']>,
    fateDiscard: CardInstance[],
    decks: Record<string, CardInstance[]>,
  ): GameState {
    const s = game()
    return {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 1
          ? { ...p, fateDiscard, fateDecks: { palais: [], 'maison-pacha': [], jungle: [], 'poele-mudka': [], ...decks } }
          : p,
      ),
      pendingYzmaManipulate: pending,
    }
  }

  it('Paysan (« Vous pouvez ») : on peut refuser → rien ne change', () => {
    const paysan = inst('paysan')
    const s = withManip(
      { playerIndex: 1, mode: 'hero-to-decks', count: 1, optional: true, heroIds: [paysan.instanceId] },
      [paysan],
      {},
    )
    const after = applyAction(s, { type: 'RESOLVE_YZMA_MANIPULATE', heroInstanceId: null, locationIds: [] })
    expect(after.pendingYzmaManipulate).toBeNull()
    expect(after.players[1].fateDiscard.map((c) => c.cardId)).toEqual(['paysan'])
  })

  it('Paysan : mélange le Héros choisi dans la pioche choisie', () => {
    const paysan = inst('paysan')
    const s = withManip(
      { playerIndex: 1, mode: 'hero-to-decks', count: 1, optional: true, heroIds: [paysan.instanceId] },
      [paysan],
      { jungle: [inst('bucky')] },
    )
    const after = applyAction(s, {
      type: 'RESOLVE_YZMA_MANIPULATE',
      heroInstanceId: paysan.instanceId,
      locationIds: ['jungle'],
    })
    expect(after.pendingYzmaManipulate).toBeNull()
    expect(after.players[1].fateDiscard.length).toBe(0)
    expect((after.players[1].fateDecks?.['jungle'] ?? []).map((c) => c.cardId).sort()).toEqual(['bucky', 'paysan'])
  })

  it('Manipulation obligatoire : refuser lève une erreur', () => {
    const paysan = inst('paysan')
    const s = withManip(
      { playerIndex: 1, mode: 'hero-to-decks', count: 2, optional: false, heroIds: [paysan.instanceId] },
      [paysan],
      { jungle: [inst('bucky')] },
    )
    expect(() => applyAction(s, { type: 'RESOLVE_YZMA_MANIPULATE', heroInstanceId: null, locationIds: [] })).toThrow()
  })
})

describe('Yzma — effets autonomes', () => {
  it('Fausses funérailles : +1 JT par Héros en défausse Fatalité (plafond 5)', () => {
    const s = game()
    const s2: GameState = {
      ...s,
      activePlayer: 1,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, power: 0, fateDiscard: [inst('paysan'), inst('bucky'), inst('en-fuite')] } : p,
      ),
    }
    const after = resolveEffects(s2, [{ type: 'GAIN_POWER_PER_FATE_DISCARD_HERO', max: 5 }], { actorIndex: 1 })
    // 2 Héros (Paysan, Bucky) → +2 (En fuite est un Événement, pas compté).
    expect(after.players[1].power).toBe(2)
  })

  it('Mauvais levier : Yzma perd la moitié de ses JT (arrondi au supérieur)', () => {
    const s = game()
    const s2: GameState = {
      ...s,
      activePlayer: 1,
      players: s.players.map((p, i) => (i === 1 ? { ...p, power: 5 } : p)),
    }
    const after = resolveEffects(s2, [{ type: 'LOSE_HALF_POWER' }], { actorIndex: 1 })
    expect(after.players[1].power).toBe(2) // 5 - ceil(5/2)=3 → 2
  })

  it('Kronk : 3 jetons Pouvoir le transforment en Héros', () => {
    const s = game()
    const s2: GameState = {
      ...s,
      activePlayer: 1,
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, board: { ...p.board, palais: [inst('kronk'), inst('kuzco')] } } : p,
      ),
    }
    // Kuzco présent → Chemin de la droiture pose 2 jetons par usage. Deux usages → 4 ≥ 3.
    let after = resolveEffects(s2, [{ type: 'KRONK_ADD_TOKENS_IF_KUZCO' }], { actorIndex: 1 })
    after = resolveEffects(after, [{ type: 'KRONK_ADD_TOKENS_IF_KUZCO' }], { actorIndex: 1 })
    const kronk = Object.values(after.players[1].board).flat().find((c) => c.cardId === 'kronk')
    expect(kronk?.kronkTransformed).toBe(true)
    expect(kronk?.type).toBe('hero')
  })

  it('Couteau revient en main quand l’Allié associé est défaussé (Vanquish)', () => {
    const s = game()
    const gardes = inst('gardes-imperiaux')
    const couteau: CardInstance = { ...inst('couteau'), instanceId: 'couteau#1', attachedTo: gardes.instanceId }
    const s2: GameState = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === 1 ? { ...p, board: { ...p.board, palais: [inst('paysan'), gardes, couteau] } } : p,
      ),
    }
    // Paysan (force 2) éliminé par Gardes (3) ; Gardes (porteur du Couteau) défaussé.
    const after = performVanquish(s2, 'paysan#1', ['gardes-imperiaux#1'], false)
    expect(after.players[1].hand.some((c) => c.cardId === 'couteau')).toBe(true)
    expect(after.players[1].discard.some((c) => c.cardId === 'couteau')).toBe(false)
  })
})
