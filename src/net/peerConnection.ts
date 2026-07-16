// =============================================================================
// peerConnection.ts — Transport P2P (WebRTC) via PeerJS, pour jouer EN LIGNE.
//
// Alternative « Internet » au relais WebSocket LAN (connection.ts) : au lieu de
// passer par un relais que l'hôte héberge sur son réseau, on établit un canal de
// données WebRTC DIRECT entre les deux navigateurs. Un broker de signaling public
// (PeerJS cloud) sert UNIQUEMENT à la mise en relation ; ensuite la donnée de jeu
// circule en pair-à-pair. La vérité du jeu ne quitte jamais le navigateur-hôte
// (identique au modèle LAN : hôte autoritaire, cf. MULTIPLAYER_SPEC).
//
// Expose la MÊME interface `Connection` que connection.ts : le store branche l'un
// ou l'autre transport sans rien changer d'autre (session, lobby, UI inchangés).
//
// Le « code de salon » (4 lettres, makeRoomCode) devient l'ID PeerJS de l'hôte,
// préfixé pour éviter les collisions sur le broker public partagé.
//
// Couche : net → engine uniquement (aucun import ui/ ni data/).
// =============================================================================

import type { Connection, ConnectionHandlers } from './connection'
import type { NetMessage } from './messages'

/** Préfixe de namespace sur le broker public : réduit le risque qu'un ID court
 *  entre en collision avec une partie d'un autre utilisateur du même broker. */
const PEER_ID_PREFIX = 'villainous-'

/** ID PeerJS complet dérivé d'un code de salon court (ABCD → villainous-abcd). */
export function peerIdFromCode(code: string): string {
  return PEER_ID_PREFIX + code.toLowerCase()
}

// --- Surface minimale de PeerJS que l'on utilise (injectable pour les tests) ---

/** Sous-ensemble de `peerjs.DataConnection` réellement utilisé. */
export interface DataConnLike {
  send: (data: unknown) => void
  close: () => void
  on: (event: string, cb: (arg?: unknown) => void) => void
}

/** Options d'ouverture d'un canal (sous-ensemble de peerjs). */
export interface DataConnOpts { serialization?: string; reliable?: boolean }

/** Sous-ensemble de `peerjs.Peer` réellement utilisé. */
export interface PeerLike {
  readonly id: string | null
  on: (event: string, cb: (arg?: unknown) => void) => void
  connect: (peerId: string, opts?: DataConnOpts) => DataConnLike
  reconnect: () => void
  destroy: () => void
}

/** Canal fiable + sérialisation JSON : parité exacte avec le transport relais
 *  (qui fait déjà du JSON). Évite les surprises de BinaryPack sur les `undefined`
 *  d'un gros GameState imbriqué, et garantit un ordre de livraison fiable. */
const DATA_CONN_OPTS: DataConnOpts = { serialization: 'json', reliable: true }

/** Fabrique un Peer. `id` fourni côté hôte (ID demandé), absent côté invité
 *  (le broker en attribue un aléatoire, sans importance). */
export type PeerFactory = (id?: string) => PeerLike

/** Valide grossièrement qu'un message reçu ressemble à un NetMessage. */
function asNetMessage(data: unknown): NetMessage | null {
  if (data && typeof data === 'object' && typeof (data as { type?: unknown }).type === 'string') {
    return data as NetMessage
  }
  return null
}

/** Options communes aux deux rôles. */
interface PeerConnectOpts {
  code: string
  handlers?: ConnectionHandlers
  /** Fabrique de Peer (injection de tests). Défaut : PeerJS réel (dynamique). */
  peerFactory: PeerFactory
}

/**
 * Ouvre une connexion P2P dans le rôle indiqué et renvoie une `Connection`
 * identique à celle du relais (room/send/close + handlers).
 *
 * - `host`  : demande l'ID `villainous-<code>` au broker et attend que l'invité
 *   s'y connecte. Les envois faits avant l'arrivée de l'invité sont mis en file.
 * - `guest` : se connecte à l'ID de l'hôte. Les envois faits avant l'ouverture du
 *   canal (le JOIN de la session part immédiatement) sont mis en file.
 */
export function connectPeer(role: 'host' | 'guest', opts: PeerConnectOpts): Connection {
  const { code, handlers = {}, peerFactory } = opts
  const room = code.toUpperCase()

  // Canal de données actif (null tant qu'il n'est pas établi) + file d'attente des
  // messages émis avant l'ouverture (repris à l'ouverture).
  let conn: DataConnLike | null = null
  let opened = false
  const queue: NetMessage[] = []
  let closedByUs = false

  const flush = () => {
    if (!conn || !opened) return
    for (const m of queue.splice(0)) conn.send(m)
  }

  /** Branche les événements d'un canal de données (commun hôte/invité). */
  const bindConn = (c: DataConnLike, fireOpen: boolean) => {
    conn = c
    c.on('open', () => {
      opened = true
      flush()
      if (fireOpen) handlers.onOpen?.()
    })
    c.on('data', (d) => {
      const msg = asNetMessage(d)
      if (msg) handlers.onMessage?.(msg)
    })
    c.on('close', () => {
      if (closedByUs) return
      handlers.onClose?.({ code: 0, reason: 'peer-closed' })
    })
    c.on('error', (err) => handlers.onError?.(err))
  }

  const peer: PeerLike = role === 'host' ? peerFactory(peerIdFromCode(room)) : peerFactory()

  peer.on('error', (err) => {
    // 'unavailable-id' (hôte : code déjà pris) / 'peer-unavailable' (invité : hôte
    // introuvable) / 'network'… : on remonte tel quel, le store affiche le message.
    handlers.onError?.(err)
  })
  // Le broker peut lâcher la connexion de signaling sans casser le canal P2P déjà
  // établi : on tente une reconnexion silencieuse (sans notifier).
  peer.on('disconnected', () => {
    if (!closedByUs) {
      try { peer.reconnect() } catch { /* ignore */ }
    }
  })

  if (role === 'host') {
    // L'hôte est « prêt » dès que le broker lui a attribué son ID (il peut alors
    // recevoir l'invité). Le canal s'ouvrira à l'arrivée de l'invité.
    peer.on('open', () => handlers.onOpen?.())
    peer.on('connection', (c) => {
      // 1v1 : on ne retient que le PREMIER invité ; on ignore d'éventuels canaux
      // supplémentaires (le lobby n'accepte qu'un adversaire).
      if (conn) {
        try { (c as DataConnLike).close() } catch { /* ignore */ }
        return
      }
      // Le canal entrant peut déjà être ouvert : on ne redéclenche pas onOpen
      // (déjà fait au 'open' du peer côté hôte).
      bindConn(c as DataConnLike, false)
    })
  } else {
    // L'invité se connecte à l'hôte dès que son propre peer est prêt.
    peer.on('open', () => {
      const c = peer.connect(peerIdFromCode(room), DATA_CONN_OPTS)
      bindConn(c, true) // onOpen quand le canal vers l'hôte est établi
    })
  }

  return {
    room,
    send: (msg: NetMessage) => {
      if (conn && opened) conn.send(msg)
      else queue.push(msg)
    },
    close: () => {
      closedByUs = true
      try { conn?.close() } catch { /* ignore */ }
      try { peer.destroy() } catch { /* ignore */ }
    },
  }
}

/**
 * Charge PeerJS dynamiquement et renvoie une `PeerFactory` prête à l'emploi.
 * Séparé de connectPeer() pour rester injectable/testable sans réseau.
 */
export async function createPeerFactory(): Promise<PeerFactory> {
  const { Peer } = await import('peerjs')
  return (id?: string) => new Peer(id as string) as unknown as PeerLike
}
