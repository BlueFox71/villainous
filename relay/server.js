// =============================================================================
// relay/server.js — Relais WebSocket minimal pour le mode multijoueur (LAN).
//
// GAME-AGNOSTIQUE : il ne connaît RIEN au jeu. Il route des « frames » JSON par
// salon (`room`) :
//   { room, t: 'join' }            → enregistre la socket dans le salon
//   { room, t: 'leave' }           → la retire
//   { room, t: 'data', data: ... } → réémet la frame telle quelle aux AUTRES
//                                     membres du salon
//
// Toute la logique de jeu vit dans le navigateur-hôte (cf. MULTIPLAYER_SPEC §3).
// Lancement : `npm run relay` (port 8787 par défaut, ou $PORT).
// =============================================================================

import { WebSocketServer } from 'ws'
import { networkInterfaces } from 'node:os'
import { pathToFileURL } from 'node:url'

/**
 * Démarre le relais sur `port`. Renvoie { wss, close } ; `close()` ferme toutes
 * les sockets et le serveur (utile pour les tests).
 */
export function createRelayServer({ port = 0 } = {}) {
  const wss = new WebSocketServer({ port })
  /** room (string) → Set<WebSocket> des membres. */
  const rooms = new Map()

  const join = (room, ws) => {
    let set = rooms.get(room)
    if (!set) rooms.set(room, (set = new Set()))
    set.add(ws)
    ws._rooms.add(room)
  }
  const leave = (room, ws) => {
    const set = rooms.get(room)
    if (!set) return
    set.delete(ws)
    ws._rooms.delete(room)
    if (set.size === 0) rooms.delete(room)
  }
  /** Réémet `raw` (la frame telle que reçue) aux autres membres du salon. */
  const broadcast = (room, fromWs, raw) => {
    const set = rooms.get(room)
    if (!set) return
    for (const peer of set) {
      if (peer !== fromWs && peer.readyState === peer.OPEN) peer.send(raw)
    }
  }

  wss.on('connection', (ws) => {
    ws._rooms = new Set()
    ws.on('message', (buf) => {
      let frame
      try {
        frame = JSON.parse(buf.toString())
      } catch {
        return // frame illisible : ignorée
      }
      if (!frame || typeof frame.room !== 'string') return
      if (frame.t === 'join') join(frame.room, ws)
      else if (frame.t === 'leave') leave(frame.room, ws)
      else if (frame.t === 'data') broadcast(frame.room, ws, buf.toString())
    })
    ws.on('close', () => {
      for (const room of [...ws._rooms]) leave(room, ws)
    })
  })

  const close = () =>
    new Promise((resolve) => {
      for (const ws of wss.clients) ws.terminate()
      wss.close(() => resolve())
    })

  return { wss, close, get port() { return wss.address()?.port } }
}

/** Adresses IPv4 LAN de cette machine (pour afficher où se connecter). */
function lanAddresses() {
  const out = []
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address)
    }
  }
  return out
}

// Entrée CLI : `node relay/server.js` (ou `npm run relay`).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const port = Number(process.env.PORT) || 8787
  const { wss } = createRelayServer({ port })
  wss.on('listening', () => {
    console.log(`Relais multijoueur en écoute sur le port ${port}.`)
    const addrs = lanAddresses()
    if (addrs.length) {
      console.log('Adresses à communiquer à l’invité (même réseau) :')
      for (const a of addrs) console.log(`  ws://${a}:${port}`)
    }
  })
}
