import { describe, it, expect } from 'vitest'
import {
  connectPeer,
  peerIdFromCode,
  type PeerLike,
  type DataConnLike,
  type PeerFactory,
} from '../peerConnection'
import { createHostSession, createClientSession, type Session } from '../session'
import type { NetMessage, SeatKind } from '../messages'
import { twoPlayerGame } from '../../engine/__tests__/_helpers'
import { getLegalMoves } from '../../engine/rules'
import type { GameState } from '../../engine/types'

// =============================================================================
// Faux PeerJS déterministe : un « broker » en mémoire relie les peers par ID, et
// toutes les émissions d'événements passent par une file de tâches vidée à la
// main (drain) — aucun timer, aucun réseau, exécution reproductible.
// =============================================================================

type Task = () => void

/** Mini bus d'événements (façon EventEmitter PeerJS : on/emit). */
class Bus {
  private handlers = new Map<string, Array<(arg?: unknown) => void>>()
  constructor(private queue: Task[]) {}
  on(event: string, cb: (arg?: unknown) => void) {
    const list = this.handlers.get(event) ?? []
    list.push(cb)
    this.handlers.set(event, list)
  }
  /** Émission différée : poussée dans la file, exécutée au drain (les handlers
   *  branchés d'ici là seront présents). */
  emit(event: string, arg?: unknown) {
    this.queue.push(() => {
      for (const cb of this.handlers.get(event) ?? []) cb(arg)
    })
  }
}

class FakeConn implements DataConnLike {
  bus: Bus
  other: FakeConn | null = null
  private closed = false
  constructor(private queue: Task[]) { this.bus = new Bus(queue) }
  send(data: unknown) {
    this.queue.push(() => this.other?.bus.emit('data', data))
  }
  close() {
    if (this.closed) return
    this.closed = true
    this.bus.emit('close')
    if (this.other && !this.other.closed) this.other.close()
  }
  on(event: string, cb: (arg?: unknown) => void) { this.bus.on(event, cb) }
}

/** Registre partagé (le « broker » PeerJS). */
class Broker {
  private peers = new Map<string, FakePeer>()
  queue: Task[] = []
  private n = 0
  register(p: FakePeer): boolean {
    if (p.id && this.peers.has(p.id)) return false
    this.peers.set(p.id!, p)
    return true
  }
  unregister(p: FakePeer) { if (p.id) this.peers.delete(p.id) }
  lookup(id: string): FakePeer | undefined { return this.peers.get(id) }
  nextId(): string { return `guest-${this.n++}` }
  drain() {
    let guard = 0
    while (this.queue.length) {
      if (++guard > 10_000) throw new Error('boucle infinie de tâches')
      this.queue.shift()!()
    }
  }
}

class FakePeer implements PeerLike {
  bus: Bus
  id: string | null
  private destroyed = false
  constructor(id: string | undefined, private broker: Broker) {
    this.bus = new Bus(broker.queue)
    this.id = id ?? broker.nextId()
    const ok = broker.register(this)
    if (!ok) {
      // ID déjà pris → PeerJS émet une erreur 'unavailable-id'.
      this.id = null
      this.bus.emit('error', { type: 'unavailable-id' })
    } else {
      this.bus.emit('open', this.id)
    }
  }
  on(event: string, cb: (arg?: unknown) => void) { this.bus.on(event, cb) }
  connect(peerId: string, _opts?: unknown): DataConnLike {
    void _opts
    const a = new FakeConn(this.broker.queue) // côté invité
    const host = this.broker.lookup(peerId)
    if (!host) {
      this.bus.emit('error', { type: 'peer-unavailable' })
      return a
    }
    const b = new FakeConn(this.broker.queue) // côté hôte
    a.other = b
    b.other = a
    host.bus.emit('connection', b)
    a.bus.emit('open')
    b.bus.emit('open')
    return a
  }
  reconnect() { /* no-op */ }
  destroy() { this.destroyed = true; this.broker.unregister(this) }
}

function makeFactory(broker: Broker): PeerFactory {
  return (id?: string) => new FakePeer(id, broker)
}

const SEATS: SeatKind[] = ['human', 'human']

describe('peerIdFromCode', () => {
  it('préfixe et met en minuscules', () => {
    expect(peerIdFromCode('ABCD')).toBe('villainous-abcd')
    expect(peerIdFromCode('ab2c')).toBe('villainous-ab2c')
  })
})

describe('connectPeer — canal P2P', () => {
  it('établit le canal, l\'invité reçoit onOpen, les messages circulent sans écho', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    const hostGot: NetMessage[] = []
    const guestGot: NetMessage[] = []
    let hostOpen = false
    let guestOpen = false

    const hostConn = connectPeer('host', {
      code: 'ABCD',
      peerFactory: factory,
      handlers: { onMessage: (m) => hostGot.push(m), onOpen: () => { hostOpen = true } },
    })
    const guestConn = connectPeer('guest', {
      code: 'ABCD',
      peerFactory: factory,
      handlers: { onMessage: (m) => guestGot.push(m), onOpen: () => { guestOpen = true } },
    })
    broker.drain()

    expect(hostOpen).toBe(true)   // hôte prêt (broker lui a donné son ID)
    expect(guestOpen).toBe(true)  // canal vers l'hôte établi

    guestConn.send({ type: 'JOIN', name: 'Bob' })
    hostConn.send({ type: 'ASSIGN', yourSeat: 1 })
    broker.drain()

    expect(hostGot).toEqual([{ type: 'JOIN', name: 'Bob' }])   // reçu de l'invité
    expect(guestGot).toEqual([{ type: 'ASSIGN', yourSeat: 1 }]) // reçu de l'hôte
    // Pas d'écho : chacun ne reçoit que ce que l'AUTRE a envoyé.
  })

  it('met en file les envois faits AVANT l\'ouverture du canal', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    const hostGot: NetMessage[] = []

    connectPeer('host', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onMessage: (m) => hostGot.push(m) },
    })
    const guestConn = connectPeer('guest', { code: 'ABCD', peerFactory: factory })
    // Envoi immédiat, avant tout drain : le canal n'est pas encore ouvert.
    guestConn.send({ type: 'JOIN', name: 'early' })
    broker.drain()

    expect(hostGot).toEqual([{ type: 'JOIN', name: 'early' }])
  })

  it('l\'hôte met aussi en file tant que l\'invité n\'est pas arrivé', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    const guestGot: NetMessage[] = []

    const hostConn = connectPeer('host', { code: 'ABCD', peerFactory: factory })
    // L'hôte envoie AVANT que l'invité existe.
    hostConn.send({ type: 'ASSIGN', yourSeat: 1 })
    broker.drain()
    connectPeer('guest', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onMessage: (m) => guestGot.push(m) },
    })
    broker.drain()

    expect(guestGot).toEqual([{ type: 'ASSIGN', yourSeat: 1 }])
  })

  it('remonte une erreur si l\'ID hôte est déjà pris', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    const errs: unknown[] = []
    connectPeer('host', { code: 'ABCD', peerFactory: factory }) // occupe l'ID
    connectPeer('host', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onError: (e) => errs.push(e) },
    })
    broker.drain()
    expect(errs).toEqual([{ type: 'unavailable-id' }])
  })

  it('remonte une erreur si l\'hôte est introuvable côté invité', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    const errs: unknown[] = []
    connectPeer('guest', {
      code: 'ZZZZ', peerFactory: factory,
      handlers: { onError: (e) => errs.push(e) },
    })
    broker.drain()
    expect(errs).toEqual([{ type: 'peer-unavailable' }])
  })

  it('close() notifie l\'autre camp (onClose)', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    let hostClosed = false
    const hostConn = connectPeer('host', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onClose: () => { hostClosed = true } },
    })
    const guestConn = connectPeer('guest', { code: 'ABCD', peerFactory: factory })
    broker.drain()

    guestConn.close()
    broker.drain()
    expect(hostClosed).toBe(true)
    // Fermer de notre côté ne redéclenche pas notre propre onClose.
    hostConn.close()
  })
})

describe('connectPeer + sessions (bout en bout)', () => {
  it('l\'hôte diffuse ASSIGN + STATE à l\'invité via le canal P2P', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    let clientState: GameState | null = null
    let assigned = -1
    let hostSession: Session | null = null
    let clientSession: Session | null = null

    const hostConn = connectPeer('host', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onMessage: (m) => hostSession?.receive(m) },
    })
    const guestConn = connectPeer('guest', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onMessage: (m) => clientSession?.receive(m) },
    })
    broker.drain()

    hostSession = createHostSession({
      transport: { send: hostConn.send },
      initialState: twoPlayerGame(),
      seats: SEATS,
    })
    clientSession = createClientSession({
      transport: { send: guestConn.send },
      callbacks: {
        onState: (s) => { clientState = s },
        onAssign: (n) => { assigned = n },
      },
    })
    hostSession.start()
    broker.drain()

    expect(assigned).toBe(1)         // l'invité occupe le siège 1
    expect(clientState).not.toBeNull()
  })

  it('une demande de l\'invité parvient à l\'hôte, qui applique et rediffuse', () => {
    const broker = new Broker()
    const factory = makeFactory(broker)
    let clientState: GameState | null = null
    let hostSession: ReturnType<typeof createHostSession> | null = null
    let clientSession: Session | null = null
    let states = 0

    const hostConn = connectPeer('host', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onMessage: (m) => hostSession?.receive(m) },
    })
    const guestConn = connectPeer('guest', {
      code: 'ABCD', peerFactory: factory,
      handlers: { onMessage: (m) => clientSession?.receive(m) },
    })
    broker.drain()

    // Partie dont c'est le tour de l'invité (siège 1) : il peut donc agir.
    const initial: GameState = { ...twoPlayerGame(), activePlayer: 1 }
    hostSession = createHostSession({
      transport: { send: hostConn.send }, initialState: initial, seats: SEATS,
    })
    clientSession = createClientSession({
      transport: { send: guestConn.send },
      callbacks: { onState: (s) => { clientState = s; states++ } },
    })
    hostSession.start()
    broker.drain()
    const afterStart = states

    // getLegalMoves renvoie des ids de lieu ; on en fait une action MOVE.
    const dests = getLegalMoves(hostSession.getState())
    expect(dests.length).toBeGreaterThan(0)
    clientSession.submitLocal({ type: 'MOVE', to: dests[0] }) // demande via le canal P2P
    broker.drain()

    // L'hôte a appliqué et rediffusé un nouvel état à l'invité.
    expect(states).toBe(afterStart + 1)
    expect(clientState).not.toBeNull()
  })
})
