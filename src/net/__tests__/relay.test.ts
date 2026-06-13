import { describe, it, expect, beforeAll, afterAll } from 'vitest'
// @ts-expect-error — relais Node en JS pur (hors build TS), pas de typings.
import { createRelayServer } from '../../../relay/server.js'
import { connect, type Connection } from '../connection'
import { decodeFrame, type NetMessage } from '../messages'

let relay: { wss: import('ws').WebSocketServer; close: () => Promise<void>; port: number }
let url: string

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Ouvre une connexion et résout quand la socket est ouverte. */
function open(room: string, onMessage?: (m: NetMessage) => void): Promise<Connection> {
  return new Promise((resolve) => {
    const c = connect(url, room, { onMessage, onOpen: () => resolve(c) })
  })
}

beforeAll(async () => {
  relay = createRelayServer({ port: 0 })
  await new Promise((r) => relay.wss.on('listening', r))
  url = `ws://127.0.0.1:${relay.port}`
})

afterAll(async () => {
  await relay.close()
})

describe('relais WebSocket', () => {
  it('réémet un message de jeu aux autres membres du même salon', async () => {
    const received: NetMessage[] = []
    const b = await open('R1', (m) => received.push(m))
    const a = await open('R1')
    await delay(50) // laisse le relais enregistrer les deux « join »

    a.send({ type: 'PING' })
    await delay(50)

    expect(received).toEqual([{ type: 'PING' }])
    // L'émetteur ne se reçoit pas lui-même.
    a.close()
    b.close()
  })

  it("n'envoie rien aux membres d'un autre salon", async () => {
    const r1: NetMessage[] = []
    const r2: NetMessage[] = []
    const a = await open('ROOM-A', (m) => r1.push(m))
    const b = await open('ROOM-B', (m) => r2.push(m))
    await delay(50)

    a.send({ type: 'ASSIGN', yourSeat: 0 })
    await delay(50)

    expect(r1).toEqual([]) // a est seul dans ROOM-A → personne ne reçoit
    expect(r2).toEqual([]) // ROOM-B isolé
    a.close()
    b.close()
  })

  it('transmet un message structuré (ACTION_REQUEST) intact', async () => {
    const received: NetMessage[] = []
    const b = await open('R3', (m) => received.push(m))
    const a = await open('R3')
    await delay(50)

    const msg: NetMessage = { type: 'ACTION_REQUEST', action: { type: 'MOVE', to: 'jail' } }
    a.send(msg)
    await delay(50)

    expect(received[0]).toEqual(msg)
    a.close()
    b.close()
  })
})

describe('decodeFrame', () => {
  it('rejette les frames invalides', () => {
    expect(decodeFrame('pas du json')).toBeNull()
    expect(decodeFrame('{}')).toBeNull()
    expect(decodeFrame(JSON.stringify({ room: 'x', t: 'bidon' }))).toBeNull()
    expect(decodeFrame(JSON.stringify({ t: 'join' }))).toBeNull() // room manquant
  })

  it('accepte les frames valides', () => {
    expect(decodeFrame(JSON.stringify({ room: 'x', t: 'join' }))).toEqual({ room: 'x', t: 'join' })
    const data: NetMessage = { type: 'PING' }
    expect(decodeFrame(JSON.stringify({ room: 'x', t: 'data', data }))).toEqual({ room: 'x', t: 'data', data })
  })
})
