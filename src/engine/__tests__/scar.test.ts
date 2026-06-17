import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { performVanquish, resolveEffects } from '../effects'
import { effectiveStrength, hasReachedObjective, getAvailableActions } from '../rules'
import { buildDeckInstances } from '../../data/types'
import { scar } from '../../data/villains/scar'
import { scarCards, scarCardById } from '../../data/villains/scar.cards'
import type { CardInstance, GameState } from '../types'

function game(): GameState {
  return createInitialGame(
    [
      {
        villain: scar,
        deckCards: buildDeckInstances(scarCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(scarCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
}

function inst(cardId: string, n = 1): CardInstance {
  const c = scarCardById[cardId]
  return {
    instanceId: `${cardId}#${n}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    effects: c.effects,
    selfStrengthMods: c.selfStrengthMods,
    isHyena: c.isHyena,
    requiresHyenaInRealm: c.requiresHyenaInRealm,
  }
}

/** Place le pion au Rocher des lions (phase ACTION) avec main + pouvoir contrôlés. */
function atRocher(hand: CardInstance[], power: number): GameState {
  const s = game()
  return {
    ...s,
    phase: 'ACTION',
    usedActionIds: [],
    players: s.players.map((p, i) =>
      i === s.activePlayer ? { ...p, pawnLocation: 'rocher-lions', hand, power } : p,
    ),
  }
}

describe('Scar — Festin (jouabilité)', () => {
  it('Festin est injouable s’il n’y a aucune Hyène dans le royaume', () => {
    const s = atRocher([inst('festin')], 5)
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'festin#1' }),
    ).toThrow()
  })

  it('Festin devient jouable dès qu’une Hyène est dans le royaume', () => {
    let s = atRocher([inst('festin')], 5)
    // Une Hyène affamée posée à la Savane (dans le royaume).
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, board: { ...p.board, savane: [inst('hyene-affamee')] } } : p,
      ),
    }
    const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'festin#1' })
    // Jouée sans erreur (Festin part en défausse ; son effet de déplacement arrive plus tard).
    expect(after.players[after.activePlayer].discard.some((c) => c.cardId === 'festin')).toBe(true)
  })
})

/** Pose des cartes sur le plateau du joueur actif (lieu → cartes). */
function withBoard(cards: { card: CardInstance; loc: string }[]): GameState {
  const s = game()
  const board = { ...s.players[s.activePlayer].board }
  for (const { card, loc } of cards) board[loc] = [...(board[loc] ?? []), card]
  return { ...s, phase: 'ACTION', players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, board } : p)) }
}

describe('Scar — synergies passives', () => {
  it('Hyène affamée : +1 par autre Hyène sur le même lieu', () => {
    const s = withBoard([
      { card: inst('hyene-affamee', 1), loc: 'savane' },
      { card: inst('hyene-affamee', 2), loc: 'savane' },
      { card: inst('banzai'), loc: 'savane' },
    ])
    // Base 1 + 2 autres Hyènes = 3.
    expect(effectiveStrength(s, s.activePlayer, 'hyene-affamee#1')).toBe(3)
  })

  it('Simba (en jeu) plafonne la force des Hyènes à 2', () => {
    const s = withBoard([
      { card: inst('hyene-affamee', 1), loc: 'savane' },
      { card: inst('hyene-affamee', 2), loc: 'savane' },
      { card: inst('hyene-affamee', 3), loc: 'savane' }, // sinon force 3
      { card: inst('simba'), loc: 'gorge' },
    ])
    expect(effectiveStrength(s, s.activePlayer, 'hyene-affamee#1')).toBe(2)
  })
})

describe('Scar — effets de cartes', () => {
  it('Festin (GATHER_HYENAS) rassemble les Hyènes sur le lieu du pion', () => {
    let s = withBoard([
      { card: inst('hyene-affamee', 1), loc: 'savane' },
      { card: inst('banzai'), loc: 'cimetiere-elephants' },
    ])
    s = { ...s, players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, pawnLocation: 'rocher-lions' } : p)) }
    const after = resolveEffects(s, [{ type: 'GATHER_HYENAS' }], { actorIndex: s.activePlayer })
    const rocher = after.players[after.activePlayer].board['rocher-lions'] ?? []
    expect(rocher.filter((c) => c.isHyena).map((c) => c.cardId).sort()).toEqual(['banzai', 'hyene-affamee'])
  })

  it('Sarabi (DISCARD_HYENA_AT_HOST) défausse une Hyène sur son lieu', () => {
    const s = withBoard([{ card: inst('hyene-affamee'), loc: 'gorge' }])
    const after = resolveEffects(s, [{ type: 'DISCARD_HYENA_AT_HOST' }], { actorIndex: s.activePlayer, hostLocationId: 'gorge' })
    const p = after.players[after.activePlayer]
    expect((p.board['gorge'] ?? []).some((c) => c.cardId === 'hyene-affamee')).toBe(false)
    expect(p.discard.some((c) => c.cardId === 'hyene-affamee')).toBe(true)
  })

  it('Hakuna Matata : ouvre le choix, puis rejoue un Héros ≤ 3 de la Succession', () => {
    const s = game()
    const pile = [inst('mufasa'), inst('timon')] // Timon force 2 ≤ 3 ; Mufasa 6 exclu.
    const s2: GameState = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, succession: pile, pawnLocation: 'rocher-lions' } : p,
      ),
    }
    const opened = resolveEffects(s2, [{ type: 'HAKUNA_MATATA' }], { actorIndex: s.activePlayer })
    // Seul Timon (≤3) est rejouable depuis la Succession ; aucun Héros dans le royaume.
    expect(opened.pendingHakunaMatata?.successionIds).toEqual(['timon#1'])
    expect(opened.pendingHakunaMatata?.realmHeroIds).toEqual([])
    const after = applyAction(opened, { type: 'RESOLVE_HAKUNA_MATATA', mode: 'play', instanceId: 'timon#1' })
    const p = after.players[after.activePlayer]
    expect(after.pendingHakunaMatata).toBeNull()
    expect(p.succession?.some((c) => c.cardId === 'timon')).toBe(false)
    expect(Object.values(p.board).flat().some((c) => c.cardId === 'timon')).toBe(true)
  })

  it('Hakuna Matata : mode déplacement ouvre le déplacement d’un Héros du royaume', () => {
    const s = game()
    const s2: GameState = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, board: { ...p.board, savane: [inst('zazu')] }, succession: [] } : p,
      ),
    }
    const opened = resolveEffects(s2, [{ type: 'HAKUNA_MATATA' }], { actorIndex: s.activePlayer })
    expect(opened.pendingHakunaMatata?.realmHeroIds).toEqual(['zazu#1'])
    const after = applyAction(opened, { type: 'RESOLVE_HAKUNA_MATATA', mode: 'move', instanceId: 'zazu#1' })
    // Déplacement ouvert (n'importe quel lieu), restreint à Zazu.
    expect(after.pendingHakunaMatata).toBeNull()
    expect(after.pendingHeroRelocate?.anyLocation).toBe(true)
    expect(after.pendingHeroRelocate?.candidateIds).toEqual(['zazu#1'])
  })
})

describe('Scar — événements (effets auto)', () => {
  it('Soyez prêtes ! défausse 3 cartes puis ouvre le choix ; on peut reprendre 2 Alliés', () => {
    const s = game()
    const deck = [inst('longue-vie-roi'), inst('petit-secret'), inst('soyez-pretes')]
    const discard = [inst('shenzi'), inst('ed'), inst('vie-pas-juste')]
    const s2: GameState = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, deck, discard, hand: [] } : p)),
    }
    const opened = resolveEffects(s2, [{ type: 'BE_PREPARED' }], { actorIndex: s.activePlayer })
    // Pioche vidée (3 cartes défaussées) et choix ouvert sur Alliés + Événements.
    expect(opened.players[opened.activePlayer].deck.length).toBe(0)
    expect(opened.pendingBePrepared?.alliesOnly).toBe(false)
    expect(opened.pendingBePrepared?.candidateIds).toContain('shenzi#1')
    expect(opened.pendingBePrepared?.candidateIds).not.toContain('vie-pas-juste#1') // condition exclue
    // 1er Allié (Shenzi) → rouvre le choix limité aux Alliés.
    const afterFirst = applyAction(opened, { type: 'RESOLVE_BE_PREPARED', instanceId: 'shenzi#1' })
    expect(afterFirst.pendingBePrepared?.alliesOnly).toBe(true)
    expect(afterFirst.pendingBePrepared?.candidateIds).toEqual(['ed#1'])
    // 2e Allié (Ed) → fin.
    const done = applyAction(afterFirst, { type: 'RESOLVE_BE_PREPARED', instanceId: 'ed#1' })
    const p = done.players[done.activePlayer]
    expect(done.pendingBePrepared).toBeNull()
    expect(p.hand.map((c) => c.cardId).sort()).toEqual(['ed', 'shenzi'])
    expect(p.discard.some((c) => c.cardId === 'shenzi' || c.cardId === 'ed')).toBe(false)
  })

  it('Soyez prêtes ! : reprendre un Événement clôt immédiatement le choix', () => {
    const s = game()
    const s2: GameState = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, deck: [], discard: [inst('petit-secret'), inst('shenzi')], hand: [] } : p,
      ),
    }
    const opened = resolveEffects(s2, [{ type: 'BE_PREPARED' }], { actorIndex: s.activePlayer })
    const done = applyAction(opened, { type: 'RESOLVE_BE_PREPARED', instanceId: 'petit-secret#1' })
    expect(done.pendingBePrepared).toBeNull()
    expect(done.players[done.activePlayer].hand.map((c) => c.cardId)).toEqual(['petit-secret'])
  })

  it('La vie n’est pas juste : RESOLVE_SCRY fonctionne même si une Fatalité adverse est en attente', () => {
    // Reproduit la réaction : la Fatalité de l'adversaire est révélée (pendingFate)
    // ET le sondage de la condition est ouvert (pendingScry) en même temps.
    const s = game()
    const base: GameState = {
      ...s,
      pendingFate: { target: s.activePlayer, revealed: [inst('vision')] },
      pendingScry: { playerIndex: s.activePlayer, cards: [inst('mufasa'), inst('zazu')] },
    }
    // Le bouton « Valider » envoie RESOLVE_SCRY : il ne doit PAS être rejeté par la
    // garde pendingFate.
    const after = applyAction(base, { type: 'RESOLVE_SCRY', topInstanceIds: ['mufasa#1'] })
    expect(after.pendingScry).toBeNull()
    // La Fatalité adverse reste à résoudre ensuite.
    expect(after.pendingFate).not.toBeNull()
    // Mufasa conservé sur le dessus, Zazu défaussé.
    expect(after.players[after.activePlayer].fateDeck[0]?.cardId).toBe('mufasa')
    expect(after.players[after.activePlayer].fateDiscard.some((c) => c.cardId === 'zazu')).toBe(true)
  })

  it('La vie n’est pas juste : garder une carte la remet sur le dessus, écarter l’autre la défausse', () => {
    const s = game()
    const base: GameState = {
      ...s,
      pendingFate: { target: s.activePlayer, revealed: [] },
      pendingScry: { playerIndex: s.activePlayer, cards: [inst('mufasa'), inst('zazu')], rerevealFate: true },
    }
    // Garder Mufasa (sur le dessus), écarter Zazu : l'adversaire re-révèle Mufasa + la suivante.
    const after = applyAction(base, { type: 'RESOLVE_SCRY', topInstanceIds: ['mufasa#1'] })
    expect(after.pendingScry).toBeNull()
    expect(after.pendingFate?.revealed.some((c) => c.cardId === 'mufasa')).toBe(true)
    expect(after.players[after.activePlayer].fateDiscard.some((c) => c.cardId === 'zazu')).toBe(true)
  })

  it('La vie n’est pas juste : tout écarter fait re-révéler les 2 cartes suivantes', () => {
    const s = game()
    const base: GameState = {
      ...s,
      pendingFate: { target: s.activePlayer, revealed: [] },
      pendingScry: { playerIndex: s.activePlayer, cards: [inst('mufasa'), inst('zazu')], rerevealFate: true },
    }
    const after = applyAction(base, { type: 'RESOLVE_SCRY', topInstanceIds: [] })
    expect(after.pendingScry).toBeNull()
    const fd = after.players[after.activePlayer].fateDiscard.map((c) => c.cardId)
    expect(fd).toContain('mufasa')
    expect(fd).toContain('zazu')
    // La Fatalité n'est pas annulée : 2 nouvelles cartes (ni Mufasa ni Zazu) sont révélées.
    expect(after.pendingFate?.revealed.length).toBe(2)
    expect(after.pendingFate?.revealed.some((c) => c.cardId === 'mufasa' || c.cardId === 'zazu')).toBe(false)
  })

  it('La vie n’est pas juste (SCRY_OWN_FATE_TOP2) ouvre la décision sur les 2 cartes Fatalité du dessus', () => {
    const s = game()
    const fateDeck = [inst('vision'), inst('mufasa'), inst('zazu')]
    const s2: GameState = {
      ...s,
      players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, fateDeck, fateDiscard: [] } : p)),
    }
    const after = resolveEffects(s2, [{ type: 'SCRY_OWN_FATE_TOP2' }], { actorIndex: s.activePlayer })
    // Les 2 premières cartes sont retirées de la pioche et soumises au choix (pendingScry).
    expect(after.pendingScry?.cards.map((c) => c.cardId)).toEqual(['vision', 'mufasa'])
    expect(after.players[after.activePlayer].fateDeck.map((c) => c.cardId)).toEqual(['zazu'])
  })

  it('Longue vie au roi ! : avec plusieurs Héros, ouvre le choix puis joue celui choisi', () => {
    const s = game()
    const fateDeck = [inst('mufasa'), inst('vision'), inst('nala'), inst('baton-rafiki')]
    const s2: GameState = {
      ...s,
      phase: 'ACTION',
      players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, fateDeck, pawnLocation: 'rocher-lions' } : p)),
    }
    const opened = resolveEffects(s2, [{ type: 'REVEAL_FATE_PLAY_HERO', count: 4 }], { actorIndex: s.activePlayer })
    // Deux Héros dévoilés (Mufasa, Nala) → choix ouvert ; tout est passé en défausse.
    expect(opened.pendingFateChoice?.kind).toBe('play-revealed-fate-hero')
    expect(opened.pendingFateChoice?.candidateIds.sort()).toEqual(['mufasa#1', 'nala#1'])
    // Le joueur choisit Mufasa → il entre dans le royaume, Nala reste défaussée.
    const after = applyAction(opened, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'mufasa#1' })
    const p = after.players[after.activePlayer]
    expect((p.board['rocher-lions'] ?? []).some((c) => c.cardId === 'mufasa')).toBe(true)
    expect(p.fateDiscard.some((c) => c.cardId === 'nala')).toBe(true)
    expect(p.fateDiscard.some((c) => c.cardId === 'mufasa')).toBe(false)
  })

  it('Petit secret est injouable sans Héros ni Événement en défausse Fatalité', () => {
    // Défausse Fatalité vide → injouable.
    const empty = atRocher([inst('petit-secret')], 5)
    expect(() =>
      applyAction(empty, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'petit-secret#1' }),
    ).toThrow()
    // Défausse avec seulement un Objet (Vision) → toujours injouable.
    const onlyItem: GameState = {
      ...empty,
      players: empty.players.map((p, i) => (i === empty.activePlayer ? { ...p, fateDiscard: [inst('vision')] } : p)),
    }
    expect(() =>
      applyAction(onlyItem, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'petit-secret#1' }),
    ).toThrow()
    // Avec un seul Héros → jouable, joué automatiquement.
    const withHero: GameState = {
      ...empty,
      players: empty.players.map((p, i) => (i === empty.activePlayer ? { ...p, fateDiscard: [inst('nala')] } : p)),
    }
    const after = applyAction(withHero, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'petit-secret#1' })
    expect(Object.values(after.players[after.activePlayer].board).flat().some((c) => c.cardId === 'nala')).toBe(true)
  })

  it('Petit secret : plusieurs cartes Fatalité jouables → choix puis jeu de la carte choisie', () => {
    const empty = atRocher([inst('petit-secret')], 5)
    const s: GameState = {
      ...empty,
      players: empty.players.map((p, i) =>
        i === empty.activePlayer ? { ...p, fateDiscard: [inst('nala'), inst('zazu'), inst('vision')] } : p,
      ),
    }
    const opened = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'petit-secret#1' })
    // Choix ouvert sur Héros uniquement (l'Objet Vision est exclu).
    expect(opened.pendingFateChoice?.kind).toBe('play-fate-card-from-discard')
    expect(opened.pendingFateChoice?.candidateIds.sort()).toEqual(['nala#1', 'zazu#1'])
    // Choisir Zazu → il entre dans le royaume, Nala reste défaussée.
    const after = applyAction(opened, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'zazu#1' })
    const p = after.players[after.activePlayer]
    expect(Object.values(p.board).flat().some((c) => c.cardId === 'zazu')).toBe(true)
    expect(p.fateDiscard.some((c) => c.cardId === 'nala')).toBe(true)
  })

  it('Suivez-moi ! est injouable s’il n’y a aucune Hyène sur un autre lieu que le pion', () => {
    // Hyène sur le lieu du pion seulement → injouable.
    let s = atRocher([inst('suivez-moi')], 5)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, board: { ...p.board, 'rocher-lions': [inst('hyene-affamee')] } } : p,
      ),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'suivez-moi#1' }),
    ).toThrow()
    // Hyène sur un autre lieu (Savane) → jouable (ouvre le choix de lieu).
    const s2 = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, board: { savane: [inst('hyene-affamee', 2)] } } : p,
      ),
    }
    const after = applyAction(s2, { type: 'PLAY_CARD', actionId: 'play-card-top', instanceId: 'suivez-moi#1' })
    expect(after.pendingGiantAction?.viaFollowMe).toBe(true)
  })

  it('Suivez-moi ! (FOLLOW_ME) ouvre le choix du lieu d’une Hyène puis la fenêtre d’action distante', () => {
    // Hyène au Cimetière des éléphants, pion ailleurs (Rocher des lions).
    let s = withBoard([{ card: inst('hyene-affamee'), loc: 'cimetiere-elephants' }])
    s = {
      ...s,
      usedActionIds: [],
      players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, pawnLocation: 'rocher-lions', power: 0 } : p)),
    }
    const opened = resolveEffects(s, [{ type: 'FOLLOW_ME' }], { actorIndex: s.activePlayer })
    expect(opened.pendingGiantAction?.viaFollowMe).toBe(true)
    expect(opened.pendingGiantAction?.locations).toEqual(['cimetiere-elephants'])
    // Choisir ce lieu ouvre la fenêtre distante : actAtLocation + actions de ce lieu (hors Fatalité).
    const win = applyAction(opened, { type: 'RESOLVE_GIANT_LOCATION', locationId: 'cimetiere-elephants' })
    expect(win.actAtLocation).toBe('cimetiere-elephants')
    expect(getAvailableActions(win).some((a) => a.type === 'GAIN_POWER')).toBe(true)
  })
})

describe('Scar — Shenzi (Hyène gratuite, choix)', () => {
  it('ouvre le choix de la Hyène gratuite (toutes les Hyènes de la main), puis la pose sur son lieu', () => {
    const s0 = game()
    const s: GameState = {
      ...s0,
      phase: 'ACTION',
      players: s0.players.map((p, i) =>
        i === s0.activePlayer ? { ...p, pawnLocation: 'savane', hand: [inst('banzai'), inst('hyene-affamee')] } : p,
      ),
    }
    const opened = resolveEffects(s, [{ type: 'PLAY_FREE_HYENA' }], {
      actorIndex: s0.activePlayer,
      hostLocationId: 'savane',
    })
    // Banzaï ET Hyène affamée sont des Hyènes éligibles.
    expect(opened.pendingFreeHyena?.candidateIds.sort()).toEqual(['banzai#1', 'hyene-affamee#1'])
    // Choisir Banzaï → posé gratuitement sur le lieu de Shenzi (Savane).
    const after = applyAction(opened, { type: 'RESOLVE_FREE_HYENA', instanceId: 'banzai#1' })
    const p = after.players[after.activePlayer]
    expect((p.board['savane'] ?? []).some((c) => c.cardId === 'banzai')).toBe(true)
    expect(p.hand.some((c) => c.cardId === 'banzai')).toBe(false)
    expect(after.pendingFreeHyena).toBeNull()
  })

  it('Shenzi : on peut décliner (RESOLVE_FREE_HYENA null)', () => {
    const s0 = game()
    const s: GameState = {
      ...s0,
      phase: 'ACTION',
      players: s0.players.map((p, i) =>
        i === s0.activePlayer ? { ...p, pawnLocation: 'savane', hand: [inst('hyene-affamee')] } : p,
      ),
    }
    const opened = resolveEffects(s, [{ type: 'PLAY_FREE_HYENA' }], { actorIndex: s0.activePlayer, hostLocationId: 'savane' })
    const after = applyAction(opened, { type: 'RESOLVE_FREE_HYENA', instanceId: null })
    expect(after.pendingFreeHyena).toBeNull()
    expect(after.players[after.activePlayer].hand.some((c) => c.cardId === 'hyene-affamee')).toBe(true)
  })
})

describe('Scar — Troupeau de gnous (déplacement + Vanquish facultatif)', () => {
  it('ouvre le choix du voisin, puis un Vanquish facultatif sur le nouveau lieu', () => {
    const s0 = game()
    const s: GameState = {
      ...s0,
      phase: 'ACTION',
      usedActionIds: [],
      players: s0.players.map((p, i) =>
        i === s0.activePlayer
          ? {
              ...p,
              pawnLocation: 'cimetiere-elephants',
              power: 5,
              hand: [inst('troupeau-gnous')],
              board: {
                ...p.board,
                // Zazu recouvre la rangée du haut du Cimetière → on joue via le bas.
                'cimetiere-elephants': [inst('zazu')],
                gorge: [inst('hyene-affamee', 1), inst('hyene-affamee', 2)],
              },
            }
          : p,
      ),
    }
    // Jouer Troupeau de gnous au Cimetière (où se trouve Zazu), rangée du bas.
    const played = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card-bottom',
      instanceId: 'troupeau-gnous#1',
      to: 'cimetiere-elephants',
    })
    // Le déplacement du Héros est proposé (restreint à Zazu).
    expect(played.pendingHeroRelocate?.candidateIds).toEqual(['zazu#1'])
    expect(played.pendingHeroRelocate?.thenTrapVanquish).toBe(true)
    // Choisir la Gorge comme nouveau lieu (voisin du Cimetière).
    const moved = applyAction(played, {
      type: 'RESOLVE_HERO_RELOCATE',
      heroInstanceId: 'zazu#1',
      to: 'gorge',
    })
    const pm = moved.players[moved.activePlayer]
    expect((pm.board['gorge'] ?? []).some((c) => c.cardId === 'zazu')).toBe(true)
    expect(moved.pendingTrapVanquish?.source).toBe('gnous')
    expect(moved.pendingTrapVanquish?.locationId).toBe('gorge')
    // Éliminer Zazu sur ce nouveau lieu avec les 2 Hyènes affamées (force 2+2 ≥ 2).
    const done = applyAction(moved, {
      type: 'TRAP_VANQUISH',
      heroInstanceId: 'zazu#1',
      allyInstanceIds: ['hyene-affamee#1', 'hyene-affamee#2'],
    })
    expect(done.pendingTrapVanquish).toBeNull()
    expect(Object.values(done.players[done.activePlayer].board).flat().some((c) => c.cardId === 'zazu')).toBe(false)
  })
})

describe('Scar — Banzaï (passif au Vanquish)', () => {
  it('Banzaï : +1 JT par autre Hyène défaussée depuis son lieu lors d’un Vanquish', () => {
    // Gorge : Zazu (Héros force 2), Banzaï (reste), 2 Hyènes affamées (servent à éliminer).
    const s = withBoard([
      { card: inst('zazu'), loc: 'gorge' },
      { card: inst('banzai'), loc: 'gorge' },
      { card: inst('hyene-affamee', 1), loc: 'gorge' },
      { card: inst('hyene-affamee', 2), loc: 'gorge' },
    ])
    const before = s.players[s.activePlayer].power
    const after = performVanquish(s, 'zazu#1', ['hyene-affamee#1', 'hyene-affamee#2'], false)
    const p = after.players[after.activePlayer]
    // 2 Hyènes affamées défaussées depuis le lieu de Banzaï → +2 JT.
    expect(p.power - before).toBe(2)
    // Banzaï reste en jeu.
    expect((p.board['gorge'] ?? []).some((c) => c.cardId === 'banzai')).toBe(true)
  })
})

describe('Scar — pile Succession & victoire', () => {
  it('Mufasa éliminé rejoint la pile Succession (pas la défausse Fatalité)', () => {
    // Mufasa (force 6) à la Gorge + 2 Hyènes affamées (force 1 + 2 = ... ) — on met
    // un Troupeau (force 3) ×2 pour atteindre 6.
    const s = withBoard([
      { card: inst('mufasa'), loc: 'gorge' },
      { card: inst('troupeau-gnous', 1), loc: 'gorge' },
      { card: inst('troupeau-gnous', 2), loc: 'gorge' },
    ])
    const after = performVanquish(s, 'mufasa#1', ['troupeau-gnous#1', 'troupeau-gnous#2'], false)
    const p = after.players[after.activePlayer]
    expect(p.succession?.some((c) => c.cardId === 'mufasa')).toBe(true)
    expect(p.fateDiscard.some((c) => c.cardId === 'mufasa')).toBe(false)
  })

  it('victoire au début du tour quand Mufasa + ≥ 15 de Force dans la pile', () => {
    // Pile : Mufasa (6) + Simba (5) + Nala (3) + Pumbaa (3) = 17 ≥ 15.
    const s = game()
    const pile = [inst('mufasa'), inst('simba'), inst('nala'), inst('pumbaa')]
    const s2: GameState = {
      ...s,
      players: s.players.map((p, i) => (i === s.activePlayer ? { ...p, succession: pile } : p)),
    }
    expect(hasReachedObjective(s2)).toBe(true)
    // Sans Mufasa, pas de victoire même avec ≥ 15.
    const s3: GameState = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.activePlayer ? { ...p, succession: [inst('simba'), inst('nala'), inst('pumbaa'), inst('rafiki'), inst('sarabi')] } : p,
      ),
    }
    expect(hasReachedObjective(s3)).toBe(false)
  })
})
