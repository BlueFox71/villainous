import { describe, it, expect } from 'vitest'
import { objectiveCriticalCardIds } from '../enumerate'
import { pickRecoverCandidate } from '../heuristicBot'
import { createInitialGame } from '../../engine/state'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

let n = 0
const inst = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `i${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

function bowserPlayer(patch: Partial<PlayerState> = {}): PlayerState {
  const g = createInitialGame(
    [{ villain: bowser, deckCards: buildDeckInstances(bowserCards, 'villain', 'x:'), fateCards: buildDeckInstances(bowserCards, 'fate', 'xf:') }],
    1,
  )
  const empty = Object.fromEntries(g.players[0].locations.map((l) => [l.id, []])) as Record<string, CardInstance[]>
  return { ...g.players[0], board: empty, ...patch }
}

describe('Bowser — protection des cartes-clés à la défausse (P4a)', () => {
  it('protège Impuissance, Te revoilà, Bowser Jr. et épuisement (Étoiles restantes)', () => {
    const keep = objectiveCriticalCardIds(bowserPlayer({ observatoryStars: 3, peachCaptured: false }))
    expect(keep.has('impuissance')).toBe(true)
    expect(keep.has('rencontre')).toBe(true) // Te revoilà !
    expect(keep.has('puissance-stellaire')).toBe(true) // épuisement d'énergie
    expect(keep.has('bowser-jr')).toBe(true)
  })

  it('ne protège plus épuisement une fois l\'Observatoire vidé (0 Étoile)', () => {
    const keep = objectiveCriticalCardIds(bowserPlayer({ observatoryStars: 0, peachCaptured: false }))
    expect(keep.has('puissance-stellaire')).toBe(false)
    expect(keep.has('impuissance')).toBe(true) // encore utile (vaincre un Héros ≤3)
  })

  it('ne protège plus Bowser Jr. une fois Peach déjà dans le royaume', () => {
    const p = bowserPlayer({ observatoryStars: 2 })
    p.board = { ...p.board, 'chateau-peach': [inst('peach', 'hero', { strength: 2 })] }
    expect(objectiveCriticalCardIds(p).has('bowser-jr')).toBe(false)
  })
})

describe('Bowser — récupération (Te revoilà !) : pickRecoverCandidate (P4b)', () => {
  it('récupère Impuissance en priorité quand Peach est dans le royaume', () => {
    const p = bowserPlayer({ observatoryStars: 0 })
    p.board = { ...p.board, 'chateau-peach': [inst('peach', 'hero', { strength: 2 })] }
    const cands = [inst('kamella', 'ally', { cost: 2 }), inst('impuissance', 'effect', { cost: 3 }), inst('decoupage', 'effect', { cost: 1 })]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('impuissance')
  })

  it('récupère Bowser Jr. (chercher Peach) quand Peach absente et non capturée', () => {
    const p = bowserPlayer({ observatoryStars: 0, peachCaptured: false })
    const cands = [inst('kamella', 'ally', { cost: 2 }), inst('bowser-jr', 'ally', { cost: 2 }), inst('decoupage', 'effect', { cost: 1 })]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('bowser-jr')
  })

  it('récupère épuisement d\'énergie tant qu\'il reste des Étoiles', () => {
    const p = bowserPlayer({ observatoryStars: 3, peachCaptured: true })
    const cands = [inst('decoupage', 'effect', { cost: 1 }), inst('puissance-stellaire', 'effect', { cost: 2 })]
    expect(pickRecoverCandidate(p, cands)?.cardId).toBe('puissance-stellaire')
  })

  it('reste générique pour un autre vilain (la carte la plus chère)', () => {
    const p = bowserPlayer() // villain bowser mais objectif forcé autre ci-dessous
    const other: PlayerState = { ...p, objective: { type: 'POWER_THRESHOLD', threshold: 20 } }
    const cands = [inst('a', 'effect', { cost: 1 }), inst('b', 'item', { cost: 4 }), inst('c', 'ally', { cost: 2 })]
    expect(pickRecoverCandidate(other, cands)?.cardId).toBe('b')
  })
})
