// =============================================================================
// connection.ts — Client de transport (navigateur) vers le relais.
//
// Enveloppe fine au-dessus de WebSocket : envoie une frame `join` à l'ouverture,
// emballe chaque NetMessage sortant dans une frame `data`, déballe les frames
// `data` entrantes. Agnostique du framework (aucun React) → un hook pourra le
// wrapper plus tard (étape 3).
// =============================================================================

import { decodeFrame, encodeFrame, type NetMessage } from './messages'

export interface ConnectionHandlers {
  onMessage?: (msg: NetMessage) => void
  onOpen?: () => void
  onClose?: (info: { code: number; reason: string }) => void
  onError?: (err: unknown) => void
}

export interface Connection {
  readonly room: string
  /** Envoie un message de jeu (ignoré si la socket n'est pas ouverte). */
  send: (msg: NetMessage) => void
  /** Annonce un départ propre puis ferme la socket. */
  close: () => void
}

/** Constructeur de WebSocket (DOM par défaut ; injectable pour les tests). */
export type WebSocketCtor = new (url: string) => WebSocket

/**
 * Ouvre une connexion au relais `url`, dans le salon `room`. Les callbacks
 * `handlers` reçoivent les messages de jeu (déjà déballés) et les événements de
 * cycle de vie.
 */
export function connect(
  url: string,
  room: string,
  handlers: ConnectionHandlers = {},
  WebSocketImpl: WebSocketCtor = WebSocket,
): Connection {
  const ws = new WebSocketImpl(url)
  // File d'attente : les frames émises avant l'ouverture sont gardées puis
  // envoyées à l'ouverture (le JOIN du client part dès la création de la session,
  // souvent avant que la socket soit OPEN).
  const queue: string[] = []
  const rawSend = (s: string) => {
    if (ws.readyState === ws.OPEN) ws.send(s)
    else queue.push(s)
  }

  ws.addEventListener('open', () => {
    ws.send(encodeFrame({ room, t: 'join' })) // toujours en premier (enregistre la socket)
    for (const m of queue.splice(0)) ws.send(m)
    handlers.onOpen?.()
  })
  ws.addEventListener('message', (ev: MessageEvent) => {
    const raw = typeof ev.data === 'string' ? ev.data : String(ev.data)
    const frame = decodeFrame(raw)
    if (frame?.t === 'data') handlers.onMessage?.(frame.data)
  })
  ws.addEventListener('close', (ev: CloseEvent) =>
    handlers.onClose?.({ code: ev.code, reason: ev.reason }),
  )
  ws.addEventListener('error', (err) => handlers.onError?.(err))

  return {
    room,
    send: (msg) => rawSend(encodeFrame({ room, t: 'data', data: msg })),
    close: () => {
      if (ws.readyState === ws.OPEN) ws.send(encodeFrame({ room, t: 'leave' }))
      ws.close()
    },
  }
}
