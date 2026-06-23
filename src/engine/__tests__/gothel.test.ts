import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { hasReachedObjective, conditionIsTriggered, movableCards } from '../rules'
import { performVanquish, resolveEffects, relocateRaiponce } from '../effects'
import { gothel } from '../../data/villains/gothel'
import { gothelCards } from '../../data/villains/gothel.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: gothel,
        deckCards: buildDeckInstances(gothelCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(gothelCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

// Partie 2 joueurs (Gothel en p0, un second Gothel en p1) pour observer le report
// de la pénalité Corona entre la fin du tour de Gothel et le début de son suivant.
const game2 = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: gothel,
        deckCards: buildDeckInstances(gothelCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(gothelCards, 'fate', 'p0f:'),
      },
      {
        villain: gothel,
        deckCards: buildDeckInstances(gothelCards, 'villain', 'p1:'),
        fateCards: buildDeckInstances(gothelCards, 'fate', 'p1f:'),
      },
    ],
    seed,
  )

const raiponceOf = (s: GameState, idx = 0) =>
  Object.entries(s.players[idx].board).find(([, cards]) =>
    cards.some((c) => c.cardId === 'raiponce'),
  )?.[0]

describe('Mère Gothel — mécanique Confiance & Raiponce', () => {
  it('démarre avec 0 Confiance et Raiponce sur la Tour', () => {
    const s = game()
    expect(s.players[0].confiance).toBe(0)
    expect(raiponceOf(s)).toBe('tour')
  })

  it('victoire au seuil de 10 Confiance, pas avant', () => {
    const s = game()
    expect(hasReachedObjective({ ...s, players: [{ ...s.players[0], confiance: 9 }] }, 0)).toBe(false)
    expect(hasReachedObjective({ ...s, players: [{ ...s.players[0], confiance: 10 }] }, 0)).toBe(true)
  })

  it('GAIN_CONFIANCE / LOSE_CONFIANCE ajustent le compteur (plancher 0)', () => {
    const s = game()
    const g = resolveEffects(s, [{ type: 'GAIN_CONFIANCE', amount: 4 }])
    expect(g.players[0].confiance).toBe(4)
    const l = resolveEffects(g, [{ type: 'LOSE_CONFIANCE', amount: 7 }])
    expect(l.players[0].confiance).toBe(0)
  })

  it('Raiponce éliminée revient sur la Tour (jamais défaussée)', () => {
    let s = game()
    // Déplace Raiponce sur la Forêt et pose un Allié assez fort pour l'éliminer.
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    const ally: CardInstance = { instanceId: 'a1', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 5 }
    s = {
      ...s,
      phase: 'ACTION',
      players: [
        {
          ...s.players[0],
          board: { ...s.players[0].board, tour: [], foret: [{ ...rap }, ally] },
        },
      ],
    }
    const after = performVanquish(s, rap.instanceId, ['a1'], false)
    expect(raiponceOf(after)).toBe('tour')
    expect(after.players[0].fateDiscard.some((c) => c.cardId === 'raiponce')).toBe(false)
  })

  it('à la fin du tour de Gothel, Raiponce glisse d’un lieu vers la droite', () => {
    let s = game()
    s = { ...s, phase: 'ACTION' }
    expect(raiponceOf(s)).toBe('tour')
    const after = applyAction(s, { type: 'END_TURN' })
    expect(raiponceOf(after)).toBe('canard-boiteux')
  })

  it('Lanternes (Fatalité) déplace Raiponce sur Corona', () => {
    const fate = buildDeckInstances(gothelCards, 'fate', 'p1f:')
    const lanternes = { ...fate.find((c) => c.cardId === 'lanternes')!, instanceId: 'lant1' }
    const other = { ...fate.find((c) => c.cardId === 'vieillissement')!, instanceId: 'oth1' }
    let s = game2()
    expect(raiponceOf(s, 0)).toBe('tour')
    // Le joueur 1 fatalise Gothel (joueur 0) avec Lanternes.
    s = { ...s, activePlayer: 1, phase: 'ACTION', pendingFate: { target: 0, revealed: [lanternes, other] } }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'lant1' })
    expect(raiponceOf(s, 0)).toBe('corona')
    expect(s.pendingFate ?? null).toBeNull()
  })

  it('Raiponce qui glisse jusqu’à Corona puis y campe au début du tour → −1 Confiance', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    // Raiponce sur la Forêt : la dérive de fin de tour l'amène sur Corona ; en
    // partie mono-joueur, le début du tour suivant (= ce même joueur) applique
    // aussitôt la pénalité « Raiponce sur Corona ».
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 5, board: { ...s.players[0].board, tour: [], foret: [{ ...rap }] } }] }
    const after = applyAction(s, { type: 'END_TURN' })
    expect(raiponceOf(after)).toBe('corona')
    expect(after.players[0].confiance).toBe(4)
  })

  it('Raiponce déjà sur Corona : −1 Confiance au début de chaque tour (plancher 0)', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 0, board: { ...s.players[0].board, tour: [], corona: [{ ...rap }] } }] }
    const after = applyAction(s, { type: 'END_TURN' })
    expect(raiponceOf(after)).toBe('corona') // déjà tout à droite : reste sur place
    expect(after.players[0].confiance).toBe(0) // plancher
  })

  it('report (2 joueurs) : pas de perte quand Raiponce glisse sur Corona en fin de tour', () => {
    let s = game2()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    // Gothel (p0) actif, Raiponce sur la Forêt, 5 Confiance.
    s = {
      ...s,
      phase: 'ACTION',
      activePlayer: 0,
      players: [
        { ...s.players[0], confiance: 5, board: { ...s.players[0].board, tour: [], foret: [{ ...rap }] } },
        s.players[1],
      ],
    }
    // Fin du tour de p0 : Raiponce glisse sur Corona MAIS aucune perte immédiate
    // (c'est au tour de p1 de commencer).
    const afterP0 = applyAction(s, { type: 'END_TURN' })
    expect(raiponceOf(afterP0)).toBe('corona')
    expect(afterP0.players[0].confiance).toBe(5)
    // Fin du tour de p1 → début du tour de Gothel : Raiponce campe sur Corona → −1.
    const backToGothel = applyAction({ ...afterP0, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(backToGothel.activePlayer).toBe(0)
    expect(backToGothel.players[0].confiance).toBe(4)
  })

  it('report (2 joueurs) : Raiponce quittée de Corona avant le tour de Gothel → pas de perte', () => {
    let s = game2()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    s = {
      ...s,
      phase: 'ACTION',
      activePlayer: 0,
      players: [
        { ...s.players[0], confiance: 5, board: { ...s.players[0].board, tour: [], foret: [{ ...rap }] } },
        s.players[1],
      ],
    }
    const afterP0 = applyAction(s, { type: 'END_TURN' })
    expect(raiponceOf(afterP0)).toBe('corona')
    // Pendant le tour de p1, Raiponce est ramenée vers la Tour (ex. Lance-moi ta chevelure).
    const moved = resolveEffects(afterP0, [{ type: 'MOVE_RAIPONCE', to: 'tour' }], { actorIndex: 0 })
    expect(raiponceOf(moved)).toBe('tour')
    // Début du tour de Gothel : Raiponce n'est plus sur Corona → aucune perte.
    const backToGothel = applyAction({ ...moved, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(backToGothel.activePlayer).toBe(0)
    expect(backToGothel.players[0].confiance).toBe(5)
  })

  it('Raiponce ailleurs que Corona en fin de tour : pas de perte', () => {
    let s = game()
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 5 }] }
    const after = applyAction(s, { type: 'END_TURN' }) // tour → canard-boiteux
    expect(raiponceOf(after)).toBe('canard-boiteux')
    expect(after.players[0].confiance).toBe(5)
  })

  it('MOVE_RAIPONCE déplace la tuile (corona, puis d’un cran vers la gauche)', () => {
    const s = game()
    const toCorona = resolveEffects(s, [{ type: 'MOVE_RAIPONCE', to: 'corona' }])
    expect(raiponceOf(toCorona)).toBe('corona')
    const left1 = resolveEffects(toCorona, [{ type: 'MOVE_RAIPONCE', to: 'left', steps: 1 }])
    expect(raiponceOf(left1)).toBe('foret')
  })

  it('GAIN_CONFIANCE_WITH_RAIPONCE : gain seulement si le pion est avec Raiponce (+ bonus Tour)', () => {
    const s = game() // pion et Raiponce sur la Tour au départ
    const g = resolveEffects(s, [{ type: 'GAIN_CONFIANCE_WITH_RAIPONCE', amount: 1, bonusAtTour: 1 }])
    expect(g.players[0].confiance).toBe(2) // 1 + bonus Tour
    // Pion ailleurs que Raiponce → aucun gain.
    const moved = { ...s, players: [{ ...s.players[0], pawnLocation: 'corona' }] }
    const g2 = resolveEffects(moved, [{ type: 'GAIN_CONFIANCE_WITH_RAIPONCE', amount: 1, bonusAtTour: 1 }])
    expect(g2.players[0].confiance).toBe(0)
  })

  it('Poignard : l’Allié porteur qui élimine Raiponce fait gagner 1 Confiance', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    const ally: CardInstance = { instanceId: 'a1', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 5 }
    const poignard: CardInstance = { instanceId: 'pg', cardId: 'poignard', name: 'Poignard', type: 'item', cost: 1, attach: 'ally', attachStrengthBonus: 2, attachedTo: 'a1' }
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], confiance: 0, board: { ...s.players[0].board, tour: [], foret: [{ ...rap }, ally, poignard] } }],
    }
    const after = performVanquish(s, rap.instanceId, ['a1'], false)
    expect(after.players[0].confiance).toBe(1)
    expect(raiponceOf(after)).toBe('tour') // Raiponce revient quand même sur la Tour
  })

  it('VENGEANCE arme le bonus et ouvre un Vanquish à la Tour ; +1 Confiance si la cible ≠ Raiponce', () => {
    let s = game()
    s = resolveEffects({ ...s, phase: 'ACTION' }, [{ type: 'VENGEANCE' }])
    expect(s.players[0].vengeanceConfianceArmed).toBe(true)
    expect(s.actAtLocation).toBe('tour')
    // Élimine un Héros (≠ Raiponce) → +1 Confiance, drapeau consommé.
    const hero: CardInstance = { instanceId: 'h', cardId: 'flynn-rider', name: 'Flynn', type: 'hero', strength: 2 }
    const ally: CardInstance = { instanceId: 'a', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 3 }
    s = { ...s, players: [{ ...s.players[0], confiance: 0, board: { ...s.players[0].board, foret: [hero, ally] } }] }
    const after = performVanquish(s, 'h', ['a'], false)
    expect(after.players[0].confiance).toBe(1)
    expect(after.players[0].vengeanceConfianceArmed).toBe(false)
  })

  it('VENGEANCE : éliminer Raiponce ne donne PAS de Confiance', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    const ally: CardInstance = { instanceId: 'a', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 5 }
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 0, vengeanceConfianceArmed: true, board: { ...s.players[0].board, tour: [], foret: [{ ...rap }, ally] } }] }
    const after = performVanquish(s, rap.instanceId, ['a'], false)
    expect(after.players[0].confiance).toBe(0)
    expect(after.players[0].vengeanceConfianceArmed).toBe(false)
  })

  it('SKIP_RAIPONCE_MOVE empêche la dérive de fin de tour (une fois)', () => {
    let s = game()
    s = resolveEffects({ ...s, phase: 'ACTION' }, [{ type: 'SKIP_RAIPONCE_MOVE' }])
    expect(s.players[0].raiponceSkipMove).toBe(true)
    const after = applyAction(s, { type: 'END_TURN' })
    expect(raiponceOf(after)).toBe('tour') // n'a pas bougé
    expect(after.players[0].raiponceSkipMove).toBe(false) // drapeau consommé
  })

  describe('Lance-moi ta chevelure', () => {
    const HOMEWARD = { type: 'RAIPONCE_HOMEWARD', confianceIfAtTower: 1, maxSteps: 2 } as const
    // Replace Raiponce sur un lieu donné (retire-la de la Tour de départ).
    const withRaiponceAt = (s: GameState, locId: string): GameState => {
      const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
      return { ...s, players: [{ ...s.players[0], confiance: 0, board: { ...s.players[0].board, tour: [], [locId]: [{ ...rap }] } }] }
    }

    it('Raiponce sur la Tour → +1 Confiance, aucun choix', () => {
      const after = resolveEffects(game(), [HOMEWARD])
      expect(after.players[0].confiance).toBe(1)
      expect(after.pendingRaiponceHomeward ?? null).toBeNull()
      expect(raiponceOf(after)).toBe('tour')
    })

    it('Raiponce à 1 lieu de la Tour → déplacement direct (pas de choix)', () => {
      const s = withRaiponceAt(game(), 'canard-boiteux')
      const after = resolveEffects(s, [HOMEWARD])
      expect(after.pendingRaiponceHomeward ?? null).toBeNull()
      expect(raiponceOf(after)).toBe('tour')
      expect(after.players[0].confiance).toBe(0)
    })

    it('Raiponce à ≥2 lieux → choix 1/2 lieux, puis déplacement', () => {
      const s = withRaiponceAt(game(), 'corona')
      const pending = resolveEffects(s, [HOMEWARD])
      expect(pending.pendingRaiponceHomeward?.options).toEqual([
        { steps: 1, locationId: 'foret', locationName: 'Forêt' },
        { steps: 2, locationId: 'canard-boiteux', locationName: 'Le Canard boiteux' },
      ])
      // Choix « 2 lieux » → Raiponce va sur Le Canard boiteux.
      const after = applyAction(pending, { type: 'RESOLVE_RAIPONCE_HOMEWARD', steps: 2 })
      expect(raiponceOf(after)).toBe('canard-boiteux')
      expect(after.pendingRaiponceHomeward ?? null).toBeNull()
    })
  })

  it('Cavaliers du roi éliminent un Héros d’un lieu voisin (comme les Archers Loups)', () => {
    let s = game()
    const hero: CardInstance = { instanceId: 'h', cardId: 'flynn-rider', name: 'Flynn', type: 'hero', strength: 2 }
    const cav: CardInstance = { instanceId: 'c', cardId: 'cavaliers-du-roi', name: 'Cavaliers du roi', type: 'ally', strength: 3, reachesAdjacentVanquish: true }
    // Héros sur la Forêt, Cavaliers sur Corona (lieu voisin).
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], board: { ...s.players[0].board, foret: [hero], corona: [cav] } }] }
    const after = performVanquish(s, 'h', ['c'], false)
    expect((after.players[0].board['foret'] ?? []).some((c) => c.instanceId === 'h')).toBe(false)
  })

  describe('Frères Stabbington', () => {
    const playOnRaiponce = (loc: string): GameState => {
      const s = game()
      const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
      const ally: CardInstance = { instanceId: 'pa', cardId: 'patchy-stabbington', name: 'Patchy Stabbington', type: 'ally', cost: 3, strength: 5, effects: [{ type: 'OFFER_RAIPONCE_TO_TOWER' }] }
      return { ...s, phase: 'ACTION', players: [{ ...s.players[0], power: 5, pawnLocation: loc, hand: [ally], board: { ...s.players[0].board, tour: [], [loc]: [{ ...rap }] } }] }
    }

    it('joué sur le lieu de Raiponce (hors Tour) → propose de la ramener sur la Tour', () => {
      const s = playOnRaiponce('foret')
      const placed = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pa', to: 'foret' })
      expect(placed.pendingRaiponceToTower).toMatchObject({ chooserIndex: 0 })
      const moved = applyAction(placed, { type: 'RESOLVE_RAIPONCE_TO_TOWER', move: true })
      expect(raiponceOf(moved)).toBe('tour')
      expect(moved.pendingRaiponceToTower ?? null).toBeNull()
    })

    it('on peut refuser : Raiponce reste sur place', () => {
      const s = playOnRaiponce('foret')
      const placed = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pa', to: 'foret' })
      const kept = applyAction(placed, { type: 'RESOLVE_RAIPONCE_TO_TOWER', move: false })
      expect(raiponceOf(kept)).toBe('foret')
      expect(kept.pendingRaiponceToTower ?? null).toBeNull()
    })

    it('joué AILLEURS que sur Raiponce → aucun choix', () => {
      let s = game() // Raiponce sur la Tour
      const ally: CardInstance = { instanceId: 'pa', cardId: 'patchy-stabbington', name: 'Patchy', type: 'ally', cost: 3, strength: 5, effects: [{ type: 'OFFER_RAIPONCE_TO_TOWER' }] }
      s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], power: 5, pawnLocation: 'foret', hand: [ally] }] }
      const placed = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'pa', to: 'foret' })
      expect(placed.pendingRaiponceToTower ?? null).toBeNull()
    })
  })

  it('Ce qu’il m’a pris : récupère une carte choisie de la défausse → main', () => {
    let s = game()
    const disc: CardInstance = { instanceId: 'd1', cardId: 'garde-royal', name: 'Garde royal', type: 'ally' }
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], discard: [disc], hand: [] }] }
    const pending = resolveEffects(s, [{ type: 'RECOVER_ANY_FROM_DISCARD', label: 'Ce qu’il m’a pris' }])
    expect(pending.pendingRecover?.candidateIds).toEqual(['d1'])
    const after = applyAction(pending, { type: 'RESOLVE_RECOVER', instanceId: 'd1' })
    expect(after.players[0].hand.some((c) => c.instanceId === 'd1')).toBe(true)
    expect(after.players[0].discard.some((c) => c.instanceId === 'd1')).toBe(false)
    expect(after.pendingRecover ?? null).toBeNull()
  })

  it('Moi j’ai un rêve (Fatalité) fait perdre 1 Confiance à Gothel', () => {
    let s = game()
    const fate: CardInstance = {
      instanceId: 'f-reve', cardId: 'moi-jai-un-reve', name: 'Moi j’ai un rêve', type: 'effect',
      effects: [{ type: 'LOSE_CONFIANCE', amount: 1 }],
    }
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 5 }], pendingFate: { target: 0, revealed: [fate] } }
    const after = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'f-reve' })
    expect(after.players[0].confiance).toBe(4)
    expect(after.players[0].fateDiscard.some((c) => c.cardId === 'moi-jai-un-reve')).toBe(true)
    expect(after.pendingFate ?? null).toBeNull()
  })

  describe('Couronne', () => {
    it('Héros éliminé sur le lieu de la Couronne → +2 Confiance', () => {
      let s = game()
      const hero: CardInstance = { instanceId: 'h', cardId: 'flynn-rider', name: 'Flynn', type: 'hero', strength: 2 }
      const ally: CardInstance = { instanceId: 'a', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 3 }
      const crown: CardInstance = { instanceId: 'cr', cardId: 'couronne-gothel', name: 'Couronne', type: 'item' }
      s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 0, board: { ...s.players[0].board, foret: [hero, ally, crown] } }] }
      const after = performVanquish(s, 'h', ['a'], false)
      expect(after.players[0].confiance).toBe(2)
    })

    it('Héros éliminé sur un AUTRE lieu que la Couronne → pas de bonus', () => {
      let s = game()
      const hero: CardInstance = { instanceId: 'h', cardId: 'flynn-rider', name: 'Flynn', type: 'hero', strength: 2 }
      const ally: CardInstance = { instanceId: 'a', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 3 }
      const crown: CardInstance = { instanceId: 'cr', cardId: 'couronne-gothel', name: 'Couronne', type: 'item' }
      s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 0, board: { ...s.players[0].board, foret: [hero, ally], corona: [crown] } }] }
      const after = performVanquish(s, 'h', ['a'], false)
      expect(after.players[0].confiance).toBe(0)
    })

    it('défausse libre de la Couronne → +1 Confiance, retirée du plateau', () => {
      let s = game()
      const crown: CardInstance = { instanceId: 'cr', cardId: 'couronne-gothel', name: 'Couronne', type: 'item' }
      s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 3, board: { ...s.players[0].board, foret: [crown] } }] }
      const after = applyAction(s, { type: 'SACRIFICE_COURONNE', instanceId: 'cr' })
      expect(after.players[0].confiance).toBe(4)
      expect(Object.values(after.players[0].board).flat().some((c) => c.instanceId === 'cr')).toBe(false)
      expect(after.players[0].discard.some((c) => c.cardId === 'couronne-gothel')).toBe(true)
    })
  })

  describe('Je t’aime bien plus', () => {
    // Place la carte en main + une action « Jouer une carte » au lieu du pion.
    const setup = (pawnLoc: string): GameState => {
      let s = game()
      const card: CardInstance = {
        instanceId: 'jt', cardId: 'je-taime-bien-plus', name: 'Je t’aime bien plus', type: 'effect', cost: 1,
        effects: [{ type: 'GAIN_CONFIANCE_WITH_RAIPONCE', amount: 1, bonusAtTour: 1 }],
      }
      s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], confiance: 0, power: 5, pawnLocation: pawnLoc, hand: [card] }] }
      return s
    }
    // Raiponce démarre sur la Tour. Action « Jouer une carte » : tour=play-card, foret=play-card-bottom.

    it('injouable si le pion n’est pas sur le lieu de Raiponce (throw)', () => {
      const s = setup('foret') // pion en Forêt, Raiponce sur la Tour
      expect(() =>
        applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card-bottom', instanceId: 'jt' }),
      ).toThrow()
    })

    it('jouable sur le lieu de Raiponce → gain de Confiance (+ bonus Tour)', () => {
      const s = setup('tour') // pion ET Raiponce sur la Tour
      const after = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'jt' })
      expect(after.players[0].confiance).toBe(2) // 1 + bonus Tour
    })
  })

  it('Garde royal déplacé : ouvre un déplacement de Héros FACULTATIF départ → arrivée', () => {
    let s = game()
    const ally: CardInstance = { instanceId: 'gr', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 2 }
    const hero: CardInstance = { instanceId: 'h', cardId: 'flynn-rider', name: 'Flynn', type: 'hero', strength: 2 }
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], pawnLocation: 'foret', board: { ...s.players[0].board, foret: [ally, hero] } }],
    }
    // Déplace le Garde royal de Forêt → Corona.
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'gr', to: 'corona' })
    expect((after.players[0].board['corona'] ?? []).some((c) => c.instanceId === 'gr')).toBe(true)
    // Choix facultatif : déplacer le Héros vers le lieu d'arrivée imposé (Corona).
    expect(after.pendingHeroRelocate).toMatchObject({
      forcedLocationId: 'corona',
      optional: true,
      candidateIds: ['h'],
    })
    // Résolution : le Héros suit jusqu'à Corona.
    const moved = applyAction(after, { type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: 'h', to: 'corona' })
    expect((moved.players[0].board['corona'] ?? []).some((c) => c.instanceId === 'h')).toBe(true)
    expect((moved.players[0].board['foret'] ?? []).some((c) => c.instanceId === 'h')).toBe(false)
    expect(moved.pendingHeroRelocate).toBeNull()
  })

  it('Brosse à cheveux déplacée sur le lieu de Raiponce : +1 Confiance', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    const brosse: CardInstance = { instanceId: 'b', cardId: 'brosse-a-cheveux', name: 'Brosse à cheveux', type: 'item' }
    // Raiponce sur Corona ; Brosse + pion sur la Forêt (voisine, action « Déplacer » en bas).
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], confiance: 0, pawnLocation: 'foret', board: { ...s.players[0].board, tour: [], corona: [{ ...rap }], foret: [brosse] } }],
    }
    // Déplacement Forêt → Corona (le lieu de Raiponce) : +1 Confiance.
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'b', to: 'corona' })
    expect((after.players[0].board['corona'] ?? []).some((c) => c.instanceId === 'b')).toBe(true)
    expect(after.players[0].confiance).toBe(1)
  })

  it('Brosse à cheveux déplacée AILLEURS que sur Raiponce : pas de Confiance', () => {
    let s = game()
    const brosse: CardInstance = { instanceId: 'b', cardId: 'brosse-a-cheveux', name: 'Brosse à cheveux', type: 'item' }
    // Raiponce reste sur la Tour ; on déplace la Brosse de Forêt → Corona (sans Raiponce).
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], confiance: 0, pawnLocation: 'foret', board: { ...s.players[0].board, foret: [brosse] } }],
    }
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'b', to: 'corona' })
    expect(after.players[0].confiance).toBe(0)
  })

  it('Garde royal déplacé sans Héros au départ : aucun choix ouvert', () => {
    let s = game()
    const ally: CardInstance = { instanceId: 'gr', cardId: 'garde-royal', name: 'Garde royal', type: 'ally', strength: 2 }
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], pawnLocation: 'foret', board: { ...s.players[0].board, foret: [ally] } }],
    }
    const after = applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: 'gr', to: 'corona' })
    expect(after.pendingHeroRelocate ?? null).toBeNull()
  })
})

describe('Mère Gothel — cartes Phase 3b implémentées', () => {
  const fateC = (id: string) => ({ ...buildDeckInstances(gothelCards, 'fate', 'p0f:').find((c) => c.cardId === id)! })
  const villC = (id: string) => ({ ...buildDeckInstances(gothelCards, 'villain', 'p0:').find((c) => c.cardId === id)! })

  it('Pascal : Raiponce arrivant sur son lieu file aussitôt d’un lieu vers Corona', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    s = { ...s, players: [{ ...s.players[0], board: { ...s.players[0].board, tour: [{ ...rap }], foret: [fateC('pascal')] } }] }
    s = relocateRaiponce(s, 0, 'foret') // arrive sur Pascal (Forêt) → rebondit sur Corona
    expect(raiponceOf(s, 0)).toBe('corona')
  })

  it('Ulf : aucun Allié ne peut quitter son lieu', () => {
    let s = game()
    const ally = villC('cavaliers-du-roi')
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'foret', board: { ...s.players[0].board, foret: [ally, fateC('ulf')] } }] }
    expect(movableCards(s).some((m) => m.instanceId === ally.instanceId)).toBe(false)
    expect(() =>
      applyAction(s, { type: 'MOVE_CARD', actionId: 'move-item-ally', instanceId: ally.instanceId, to: 'corona' }),
    ).toThrow(/Ulf/i)
  })

  it('Égocentrisme : réaction qui ramène Raiponce sur la Tour', () => {
    let s = game2()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    const ego = { ...buildDeckInstances(gothelCards, 'villain', 'p0:').find((c) => c.cardId === 'egocentrisme')! }
    s = {
      ...s,
      activePlayer: 1,
      activeMovedCard: true,
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, tour: [], foret: [{ ...rap }] }, hand: [ego] } : p)),
    }
    expect(conditionIsTriggered(s, ego, 0)).toBe(true)
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: ego.instanceId })
    expect(raiponceOf(s, 0)).toBe('tour')
  })

  it('Double jeu : réaction qui élimine un Héros ≤ 3 du royaume', () => {
    let s = game2()
    const hero: CardInstance = { instanceId: 'h3', cardId: 'mini-hero', name: 'Mini', type: 'hero', strength: 2 }
    const dj = { ...buildDeckInstances(gothelCards, 'villain', 'p0:').find((c) => c.cardId === 'double-jeu')! }
    s = {
      ...s,
      activePlayer: 1,
      lastVanquishedHeroStrength: 3,
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, foret: [hero] }, hand: [dj] } : p)),
    }
    expect(conditionIsTriggered(s, dj, 0)).toBe(true)
    s = applyAction(s, { type: 'PLAY_CONDITION', playerIndex: 0, instanceId: dj.instanceId })
    expect((s.players[0].board['foret'] ?? []).some((c) => c.instanceId === 'h3')).toBe(false)
  })

  it('Maximus : repositionne un Cavaliers du roi puis Maximus (lieux voisins)', () => {
    let s = game2()
    s = { ...s, activePlayer: 1 } // joueur 1 fatalise Gothel (joueur 0)
    const cav = { ...villC('cavaliers-du-roi'), instanceId: 'cav1' }
    const max = { ...fateC('maximus'), instanceId: 'max1' }
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, tour: [...(p.board['tour'] ?? []), cav] } } : p)) }
    s = placeFateHeroWithEffects(s, 0, 1, max, 'canard-boiteux', 'Canard boiteux')
    expect(s.pendingMaximus?.phase).toBe('cavaliers')
    // Cavalier : tour → canard-boiteux (voisin).
    s = applyAction(s, { type: 'RESOLVE_MAXIMUS_CAVALIERS', allyInstanceId: 'cav1', to: 'canard-boiteux' })
    expect(s.pendingMaximus?.phase).toBe('maximus')
    expect((s.players[0].board['canard-boiteux'] ?? []).some((c) => c.instanceId === 'cav1')).toBe(true)
    // Maximus : canard-boiteux → foret (voisin).
    s = applyAction(s, { type: 'RESOLVE_MAXIMUS_MOVE', to: 'foret' })
    expect(s.pendingMaximus ?? null).toBeNull()
    expect((s.players[0].board['foret'] ?? []).some((c) => c.instanceId === 'max1')).toBe(true)
  })

  it('Maximus : les deux déplacements sont facultatifs (on peut tout passer)', () => {
    let s = game2()
    s = { ...s, activePlayer: 1 }
    const cav = { ...villC('cavaliers-du-roi'), instanceId: 'cav1' }
    const max = { ...fateC('maximus'), instanceId: 'max1' }
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, tour: [...(p.board['tour'] ?? []), cav] } } : p)) }
    s = placeFateHeroWithEffects(s, 0, 1, max, 'canard-boiteux', 'Canard boiteux')
    s = applyAction(s, { type: 'RESOLVE_MAXIMUS_CAVALIERS', allyInstanceId: null, to: null })
    expect(s.pendingMaximus?.phase).toBe('maximus')
    s = applyAction(s, { type: 'RESOLVE_MAXIMUS_MOVE', to: null })
    expect(s.pendingMaximus ?? null).toBeNull()
    expect((s.players[0].board['canard-boiteux'] ?? []).some((c) => c.instanceId === 'max1')).toBe(true) // Maximus n'a pas bougé
    expect((s.players[0].board['tour'] ?? []).some((c) => c.instanceId === 'cav1')).toBe(true) // Cavalier non plus
  })

  it('Vieillissement (Fatalité) : défausse un Allié/Objet de coût ≤ 2 (choix)', () => {
    const fate1 = buildDeckInstances(gothelCards, 'fate', 'p1f:')
    const v = { ...fate1.find((c) => c.cardId === 'vieillissement')!, instanceId: 'v1' }
    const other = { ...fate1.find((c) => c.cardId === 'lanternes')!, instanceId: 'o1' }
    let s = game2()
    const ally: CardInstance = { instanceId: 'a1', cardId: 'cheap-ally', name: 'A', type: 'ally', cost: 1, strength: 2 }
    s = {
      ...s,
      activePlayer: 1,
      phase: 'ACTION',
      pendingFate: { target: 0, revealed: [v, other] },
      players: s.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, foret: [ally] } } : p)),
    }
    s = applyAction(s, { type: 'RESOLVE_FATE', instanceId: 'v1' })
    expect(s.pendingFateChoice?.kind).toBe('remove-card')
    expect(s.pendingFateChoice?.candidateIds).toContain('a1')
    s = applyAction(s, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'a1' })
    expect(s.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true)
  })
})

describe('Mère Gothel — Je serai la méchante (injouable si Raiponce sur la Tour)', () => {
  const jsm = (): CardInstance => ({
    instanceId: 'jsm',
    cardId: 'je-serai-la-mechante',
    name: 'Je serai la méchante',
    type: 'effect',
    cost: 0,
    effects: [{ type: 'MOVE_RAIPONCE', to: 'tour' }, { type: 'LOSE_CONFIANCE', amount: 1 }],
  })

  it('injouable si Raiponce est déjà sur la Tour', () => {
    let s = game()
    s = { ...s, phase: 'ACTION', players: [{ ...s.players[0], pawnLocation: 'tour', hand: [jsm()] }] }
    expect(raiponceOf(s, 0)).toBe('tour')
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'jsm' })).toThrow(/Tour/i)
  })

  it('jouable si Raiponce n’est pas sur la Tour', () => {
    let s = game()
    const rap = Object.values(s.players[0].board).flat().find((c) => c.cardId === 'raiponce')!
    s = {
      ...s,
      phase: 'ACTION',
      players: [{ ...s.players[0], pawnLocation: 'tour', hand: [jsm()], board: { ...s.players[0].board, tour: [], foret: [{ ...rap }] } }],
    }
    expect(raiponceOf(s, 0)).toBe('foret')
    expect(() => applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'jsm' })).not.toThrow()
  })
})
