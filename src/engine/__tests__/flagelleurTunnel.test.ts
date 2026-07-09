import { describe, it, expect } from 'vitest'
import { applyAction } from '../actions'
import { flayerTunnelDiscardableAllies, flayerTunnelRequiredAllies } from '../rules'
import { enumerateActions } from '../../ai/enumerate'
import { flagelleurMental, flagelleurMentalCards } from '../../data/published/flagelleurMental'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, Effect, GameState } from '../types'

const TUNNEL_EFFECT: Effect = {
  type: 'FLAYER_PLACE_TUNNEL',
  baseAllies: 2,
  surchargeHeroCardId: 'onze',
  tunnelCardId: 'tunnel-de-hawkins',
  rewardAtCount: 3,
  rewardPower: 3,
}
const tunnelInHand = (id: string): CardInstance => ({
  instanceId: id,
  cardId: 'tunnel-de-hawkins',
  name: 'Tunnel de Hawkins',
  type: 'item',
  cost: 2,
  forbiddenLocations: ['monde-envers'],
  effects: [TUNNEL_EFFECT],
})
const tunnelOnBoard = (id: string): CardInstance => ({ instanceId: id, cardId: 'tunnel-de-hawkins', name: 'Tunnel de Hawkins', type: 'item' })
const vignes = (id: string): CardInstance => ({ instanceId: id, cardId: 'vignes', name: 'Vignes', type: 'ally', strength: 1 })
const billy = (id: string): CardInstance => ({ instanceId: id, cardId: 'billy-sous-emprise', name: 'Billy', type: 'ally', strength: 3, cannotDiscardForTunnel: true })
const onze = (id: string): CardInstance => ({ instanceId: id, cardId: 'onze', name: 'Onze', type: 'hero', strength: 5 })

function game(): GameState {
  return createInitialGame(
    [
      {
        villain: flagelleurMental,
        deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', 'p0f:'),
      },
    ],
    7,
  )
}

/** Partie prête à jouer un Tunnel : pion à Centre-ville (action « Jouer une carte »),
 *  `hand` en main, `board` par lieu, `power` fixé. */
function setup(opts: { hand?: CardInstance[]; board?: Record<string, CardInstance[]>; power?: number } = {}): GameState {
  const base = game()
  return {
    ...base,
    phase: 'ACTION',
    players: base.players.map((p) => ({
      ...p,
      power: opts.power ?? 5,
      pawnLocation: 'centre-ville',
      hand: opts.hand ?? [tunnelInHand('tun1')],
      board: { ...p.board, ...(opts.board ?? {}) },
    })),
  }
}

describe('Le Flagelleur Mental — Tunnel de Hawkins (pose + coût en Alliés)', () => {
  it('pose le Tunnel sur le lieu choisi en défaussant 2 Alliés (coût 2 Pouvoir)', () => {
    const s = setup({ board: { 'centre-ville': [vignes('a1'), vignes('a2')] }, power: 5 })
    const next = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'tun1',
      to: 'laboratoire',
      allyInstanceIds: ['a1', 'a2'],
    })
    const lab = next.players[0].board['laboratoire'] ?? []
    expect(lab.some((c) => c.instanceId === 'tun1')).toBe(true)
    // Les 2 Alliés sont partis en défausse ; il en reste 0 sur Centre-ville.
    expect((next.players[0].board['centre-ville'] ?? []).filter((c) => c.type === 'ally')).toHaveLength(0)
    expect(next.players[0].discard.filter((c) => c.cardId === 'vignes')).toHaveLength(2)
    expect(next.players[0].power).toBe(3) // 5 − 2 (coût)
  })

  it('+3 Pouvoir en atteignant 3 Tunnels dans le royaume', () => {
    const s = setup({
      board: {
        'centre-ville': [tunnelOnBoard('t1'), vignes('a1'), vignes('a2')],
        starcourt: [tunnelOnBoard('t2')],
      },
      power: 5,
    })
    const next = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'tun1',
      to: 'laboratoire',
      allyInstanceIds: ['a1', 'a2'],
    })
    // 5 − 2 (coût) + 3 (récompense 3ᵉ Tunnel) = 6.
    expect(next.players[0].power).toBe(6)
  })

  it('pas de bonus en posant le 2ᵉ Tunnel (seuil non atteint)', () => {
    const s = setup({
      board: { 'centre-ville': [tunnelOnBoard('t1'), vignes('a1'), vignes('a2')] },
      power: 5,
    })
    const next = applyAction(s, {
      type: 'PLAY_CARD',
      actionId: 'play-card',
      instanceId: 'tun1',
      to: 'starcourt',
      allyInstanceIds: ['a1', 'a2'],
    })
    expect(next.players[0].power).toBe(3) // 5 − 2, pas de +3
  })

  it('avec ONZE présente, il faut défausser 3 Alliés (2 → refus)', () => {
    const board = { 'centre-ville': [onze('o1'), vignes('a1'), vignes('a2'), vignes('a3')] }
    const s = setup({ board, power: 5 })
    expect(flayerTunnelRequiredAllies(s.players[0], TUNNEL_EFFECT)).toBe(3)
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'tun1', to: 'laboratoire', allyInstanceIds: ['a1', 'a2'] }),
    ).toThrow()
    const ok = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'tun1', to: 'laboratoire', allyInstanceIds: ['a1', 'a2', 'a3'] })
    expect((ok.players[0].board['laboratoire'] ?? []).some((c) => c.instanceId === 'tun1')).toBe(true)
  })

  it('Billy ne peut pas être défaussé pour un Tunnel', () => {
    const s = setup({ board: { 'centre-ville': [billy('b1'), vignes('a1')] } })
    expect(flayerTunnelDiscardableAllies(s.players[0]).some((c) => c.instanceId === 'b1')).toBe(false)
    // Billy + 1 Vignes ne suffit pas (1 seul Allié défaussable) → injouable.
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'tun1', to: 'laboratoire', allyInstanceIds: ['b1', 'a1'] }),
    ).toThrow()
  })

  it('injouable sans assez d’Alliés défaussables', () => {
    const s = setup({ board: { 'centre-ville': [vignes('a1')] } })
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'tun1', to: 'laboratoire', allyInstanceIds: ['a1'] }),
    ).toThrow()
  })

  it('ne peut pas être posé sur le Monde à l’Envers', () => {
    const s0 = setup({ board: { 'centre-ville': [vignes('a1'), vignes('a2')] } })
    // Déverrouille le Monde à l'Envers pour isoler l'interdiction de pose (forbiddenLocations).
    const s: GameState = {
      ...s0,
      players: s0.players.map((p) => ({ ...p, lockedLocations: (p.lockedLocations ?? []).filter((l) => l !== 'monde-envers') })),
    }
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'tun1', to: 'monde-envers', allyInstanceIds: ['a1', 'a2'] }),
    ).toThrow()
  })

  it('le bot énumère la pose du Tunnel (avec Alliés à défausser, hors Monde à l’Envers)', () => {
    const s = setup({ board: { 'centre-ville': [vignes('a1'), vignes('a2')] } })
    const plays = enumerateActions(s).filter(
      (a) => a.type === 'PLAY_CARD' && a.instanceId === 'tun1',
    )
    expect(plays.length).toBeGreaterThan(0)
    expect(plays.every((a) => a.type === 'PLAY_CARD' && (a.allyInstanceIds?.length ?? 0) === 2)).toBe(true)
    expect(plays.some((a) => a.type === 'PLAY_CARD' && a.to === 'monde-envers')).toBe(false)
  })
})
