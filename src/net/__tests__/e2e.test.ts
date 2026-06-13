import { describe, it, expect, beforeAll, afterAll } from 'vitest'
// @ts-expect-error — relais Node en JS pur (hors build TS), pas de typings.
import { createRelayServer } from '../../../relay/server.js'
import { connect } from '../connection'
import { createHostSession, createClientSession, type HostSession, type Session } from '../session'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'
import { getLegalMoves } from '../../engine/rules'
import type { GameState } from '../../engine/types'

// Bout-en-bout : relais RÉEL + connection.ts RÉEL + sessions, câblés comme le
// fait le store (startHost / joinHost). Valide notamment le buffering du JOIN
// envoyé avant l'ouverture de la socket.
let relay: { wss: import('ws').WebSocketServer; close: () => Promise<void>; port: number }
let url: string

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitUntil(cond: () => boolean, ms = 1000) {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timeout')
    await delay(10)
  }
}

beforeAll(async () => {
  relay = createRelayServer({ port: 0 })
  await new Promise((r) => relay.wss.on('listening', r))
  url = `ws://127.0.0.1:${relay.port}`
})
afterAll(async () => { await relay.close() })

describe('multijoueur bout-en-bout (relais réel)', () => {
  it('l\'invité rejoint, reçoit son siège et l\'état converge', async () => {
    const room = 'WXYZ'

    // HÔTE — câblage identique au store.startHost.
    let hostSession: HostSession | null = null
    const hostConn = connect(url, room, {
      onMessage: (m) => {
        if (hostSession) { hostSession.receive(m); return }
        if (m.type === 'JOIN') {
          hostSession = createHostSession({
            transport: { send: hostConn.send },
            initialState: twoPlayerGame(),
            seats: ['human', 'human'],
            hostSeat: 0,
          })
          hostSession.start()
        }
      },
    })
    await waitUntil(() => hostConn !== null) // l'hôte doit être enregistré dans le salon
    await delay(50)

    // INVITÉ — câblage identique au store.joinHost.
    let clientState: GameState | null = null
    let assigned = -1
    let clientSession: Session
    const clientConn = connect(url, room, { onMessage: (m) => clientSession.receive(m) })
    clientSession = createClientSession({
      transport: { send: clientConn.send },
      villainKey: 'maleficent',
      callbacks: { onState: (s) => { clientState = s }, onAssign: (n) => { assigned = n } },
    })

    await waitUntil(() => clientState !== null && assigned >= 0)
    expect(assigned).toBe(1)
    expect(clientState!.activePlayer).toBe(0)

    // L'hôte (siège 0) joue ; l'invité doit converger.
    const dest = getLegalMoves(hostSession!.getState())[0]
    hostSession!.submitLocal({ type: 'MOVE', to: dest })
    await waitUntil(() => clientState!.players[0].pawnLocation === dest)
    expect(clientState!.players[0].pawnLocation).toBe(dest)

    hostConn.close()
    clientConn.close()
  })
})
