import { describe, it, expect, beforeAll, afterAll } from 'vitest'
// @ts-expect-error — relais Node en JS pur (hors build TS), pas de typings.
import { createRelayServer } from '../../../relay/server.js'
import { connect } from '../connection'
import { createHostSession, createClientSession, type HostSession } from '../session'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'
import { getLegalMoves } from '../../engine/rules'
import type { GameState } from '../../engine/types'
import type { LobbySeat } from '../messages'

// Bout-en-bout : relais RÉEL + connection.ts RÉEL + sessions, câblés comme le
// store (startHost / joinHost / selectVillain / launchGame). Couvre la phase
// lobby (choix des vilains en direct) PUIS le lancement et la convergence.
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
  it('lobby (choix vilains en direct) puis lancement et convergence', async () => {
    const room = 'WXYZ'

    // --- HÔTE : lobby (comme store.startHost) puis lancement (store.launchGame). ---
    const lobby: LobbySeat[] = [
      { seat: 0, villainKey: null, connected: true },
      { seat: 1, villainKey: null, connected: false },
    ]
    let hostSession: HostSession | null = null
    const hostConn = connect(url, room, {
      onMessage: (m) => {
        if (hostSession) { hostSession.receive(m); return }
        if (m.type === 'JOIN') lobby[1].connected = true
        else if (m.type === 'SELECT_VILLAIN') lobby[1].villainKey = m.villainKey
        else return
        hostConn.send({ type: 'LOBBY', seats: lobby, canStart: lobby.every((s) => s.connected && !!s.villainKey) })
      },
    })
    await delay(50) // l'hôte doit être enregistré dans le salon avant le JOIN

    // --- INVITÉ : connexion + session (comme store.joinHost). ---
    let clientState: GameState | null = null
    let assigned = -1
    let clientLobby: LobbySeat[] | null = null
    const clientConn = connect(url, room, { onMessage: (m) => clientSession.receive(m) })
    const clientSession = createClientSession({
      transport: { send: clientConn.send },
      callbacks: {
        onLobby: (m) => { clientLobby = m.seats },
        onState: (s) => { clientState = s },
        onAssign: (n) => { assigned = n },
      },
    })

    // L'invité voit le lobby et choisit son vilain ; l'hôte voit le choix.
    await waitUntil(() => clientLobby !== null)
    clientSession.selectVillain('maleficent')
    await waitUntil(() => lobby[1].villainKey === 'maleficent')
    expect(lobby[1].villainKey).toBe('maleficent')

    // L'hôte choisit puis lance la partie.
    lobby[0].villainKey = 'princeJohn'
    hostSession = createHostSession({
      transport: { send: hostConn.send },
      initialState: twoPlayerGame(),
      seats: ['human', 'human'],
      hostSeat: 0,
    })
    hostSession.start()

    await waitUntil(() => clientState !== null && assigned >= 0)
    expect(assigned).toBe(1)
    expect(clientState!.activePlayer).toBe(0)

    // L'hôte joue ; l'invité converge.
    const dest = getLegalMoves(hostSession.getState())[0]
    hostSession.submitLocal({ type: 'MOVE', to: dest })
    await waitUntil(() => clientState!.players[0].pawnLocation === dest)
    expect(clientState!.players[0].pawnLocation).toBe(dest)

    hostConn.close()
    clientConn.close()
  })
})
