import { describe, it, expect } from 'vitest'
import { createHostSession, createClientSession, canSubmit, type Session } from '../session'
import type { NetMessage, SeatKind } from '../messages'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'
import { getLegalMoves } from '../../engine/rules'
import type { GameState } from '../../engine/types'

const SEATS: SeatKind[] = ['human', 'human']

/**
 * Relie deux sessions en mémoire (façon relais 1v1) : ce que l'hôte envoie
 * arrive à l'invité, et inversement — jamais à l'émetteur. Les sessions sont
 * branchées après coup via `wire`.
 */
function makeLink() {
  let host: Session | null = null
  let client: Session | null = null
  return {
    hostTransport: { send: (m: NetMessage) => client?.receive(m) },
    clientTransport: { send: (m: NetMessage) => host?.receive(m) },
    wire(h: Session, c: Session) { host = h; client = c },
  }
}

describe('session hôte/client (1v1)', () => {
  it('diffuse l\'état initial et attribue son siège à l\'invité', () => {
    const link = makeLink()
    let clientState: GameState | null = null
    let assigned = -1

    const host = createHostSession({
      transport: link.hostTransport,
      initialState: twoPlayerGame(),
      seats: SEATS,
    })
    const client = createClientSession({
      transport: link.clientTransport,
      villainKey: 'maleficent',
      callbacks: { onState: (s) => { clientState = s }, onAssign: (n) => { assigned = n } },
    })
    link.wire(host, client)

    host.start()

    expect(assigned).toBe(1)
    expect(client.localSeat).toBe(1)
    expect(clientState).not.toBeNull()
    expect(clientState!.activePlayer).toBe(0)
  })

  it('rejette une action de l\'invité quand ce n\'est pas son tour', () => {
    const link = makeLink()
    let rejected = ''

    const host = createHostSession({ transport: link.hostTransport, initialState: twoPlayerGame(), seats: SEATS })
    const client = createClientSession({
      transport: link.clientTransport,
      villainKey: 'maleficent',
      callbacks: { onReject: (r) => { rejected = r } },
    })
    link.wire(host, client)
    host.start()

    const before = host.getState()
    // activePlayer = 0 (hôte) → l'invité (siège 1) ne peut pas jouer.
    client.submitLocal({ type: 'MOVE', to: before.players[1].locations[0].id })

    expect(rejected).toBe('pas-ton-tour')
    expect(host.getState()).toBe(before) // état inchangé
  })

  it('applique le coup de l\'hôte et le diffuse à l\'invité', () => {
    const link = makeLink()
    let clientState: GameState | null = null

    const host = createHostSession({ transport: link.hostTransport, initialState: twoPlayerGame(), seats: SEATS })
    const client = createClientSession({
      transport: link.clientTransport,
      villainKey: 'maleficent',
      callbacks: { onState: (s) => { clientState = s } },
    })
    link.wire(host, client)
    host.start()

    const dest = getLegalMoves(host.getState())[0] // lieu légal (≠ position de départ)
    host.submitLocal({ type: 'MOVE', to: dest })

    expect(host.getState().players[0].pawnLocation).toBe(dest)
    // L'invité a convergé vers le même état.
    expect(clientState!.players[0].pawnLocation).toBe(dest)
  })

  it('laisse l\'invité jouer quand c\'est son tour (convergence des deux états)', () => {
    const link = makeLink()
    let clientState: GameState | null = null

    const host = createHostSession({ transport: link.hostTransport, initialState: twoPlayerGame(), seats: SEATS })
    const client = createClientSession({
      transport: link.clientTransport,
      villainKey: 'maleficent',
      callbacks: { onState: (s) => { clientState = s } },
    })
    link.wire(host, client)
    host.start()

    // L'hôte joue son tour : déplacement puis fin de tour → activePlayer devient 1.
    host.submitLocal({ type: 'MOVE', to: getLegalMoves(host.getState())[0] })
    host.submitLocal({ type: 'END_TURN' })
    expect(host.getState().activePlayer).toBe(1)

    // Maintenant l'invité (siège 1) peut jouer ; l'hôte applique et diffuse.
    const dest = getLegalMoves(host.getState())[0] // coups légaux du joueur 1 désormais actif
    client.submitLocal({ type: 'MOVE', to: dest })

    expect(host.getState().players[1].pawnLocation).toBe(dest)
    expect(clientState!.players[1].pawnLocation).toBe(dest)
  })
})

describe('canSubmit', () => {
  it('autorise uniquement le joueur attendu', () => {
    const s = twoPlayerGame() // activePlayer = 0
    expect(canSubmit(s, 0)).toBe(true)
    expect(canSubmit(s, 1)).toBe(false)
  })
})
