// =============================================================================
// session.ts — Cerveau du multijoueur 1v1 (orchestration hôte/client).
//
// Modèle : l'HÔTE fait autorité (seul endroit où applyAction est appelé). Les
// deux camps soumettent des actions ; l'hôte valide (whoseInput), applique et
// DIFFUSE le GameState complet. Le client n'applique rien : il remplace son état
// par celui qu'il reçoit (cf. MULTIPLAYER_SPEC §2-§4).
//
// 1v1 sans identité explicite : le relais ne renvoie pas à l'émetteur, donc dans
// un salon à 2, tout message reçu par l'hôte vient forcément de l'invité (le
// siège « distant »), et réciproquement. On en déduit l'émetteur sans le coder.
//
// Agnostique du framework et du transport : on injecte un `Transport` (un simple
// `send`). Le store branchera `connection.send` dessus et routera les messages
// entrants vers `receive`. Testable avec deux transports reliés en mémoire.
// =============================================================================

import type { GameAction, GameState } from '../engine/types'
import { applyAction } from '../engine/actions'
import { whoseInput } from '../engine/turn'
import { playableConditions } from '../engine/rules'
import type { NetMessage, SeatKind } from './messages'

/** Canal d'émission minimal (cf. Connection.send). */
export interface Transport {
  send: (msg: NetMessage) => void
}

export interface SessionCallbacks {
  /** L'état de jeu local doit être remplacé (diffusion reçue côté client, ou
   *  application locale côté hôte). */
  onState?: (state: GameState) => void
  /** Côté client : l'hôte nous a attribué notre siège (= localPlayerIndex). */
  onAssign?: (seat: number) => void
  /** Mise à jour du salon (lobby). */
  onLobby?: (msg: Extract<NetMessage, { type: 'LOBBY' }>) => void
  /** Une demande a été rejetée (coup illégal / pas ton tour). */
  onReject?: (reason: string) => void
  /** Côté hôte : l'invité a rejoint/choisi son vilain. */
  onJoin?: (msg: Extract<NetMessage, { type: 'JOIN' }>) => void
  /** L'autre joueur a quitté volontairement la partie (message LEAVE). */
  onLeave?: () => void
}

/** Le siège `seat` a-t-il le droit de soumettre `action` dans `state` ?
 *  - Coup normal : seul le joueur que le moteur attend (whoseInput) peut agir.
 *  - Réaction : une Condition (Avarice, Lâcheté…) peut être jouée par le joueur
 *    NON-actif `seat`, si elle est réellement déclenchable (playableConditions). */
export function canSubmit(state: GameState, action: GameAction, seat: number): boolean {
  if (action.type === 'PLAY_CONDITION') {
    return (
      action.playerIndex === seat &&
      playableConditions(state, seat).some((c) => c.instanceId === action.instanceId)
    )
  }
  return whoseInput(state) === seat
}

export interface Session {
  /** Soumet une action jouée par CE joueur (local). */
  submitLocal: (action: GameAction) => void
  /** Traite un message reçu du réseau. */
  receive: (msg: NetMessage) => void
  /** Index de siège de ce client (point de vue). */
  readonly localSeat: number
}

export interface HostSession extends Session {
  /** Démarre la partie : attribue son siège à l'invité et diffuse l'état. */
  start: () => void
  /** État autoritaire courant. */
  getState: () => GameState
}

export interface ClientSession extends Session {
  /** Pendant le lobby : annonce (ou retire) son choix de vilain à l'hôte. */
  selectVillain: (villainKey: string | null) => void
}

/**
 * Crée la session HÔTE. `hostSeat` est l'index du joueur hôte (en général 0) ;
 * l'invité occupe l'autre siège. `initialState`/`seats` décrivent la partie déjà
 * construite (via newGame côté store).
 */
export function createHostSession(opts: {
  transport: Transport
  initialState: GameState
  seats: SeatKind[]
  hostSeat?: number
  callbacks?: SessionCallbacks
}): HostSession {
  const { transport, seats, callbacks = {} } = opts
  const localSeat = opts.hostSeat ?? 0
  const remoteSeat = 1 - localSeat
  let state = opts.initialState

  const broadcastState = () => {
    callbacks.onState?.(state)
    transport.send({ type: 'STATE', state, seats })
  }

  /** Tente d'appliquer `action` au nom de `fromSeat`. */
  const submit = (action: GameAction, fromSeat: number) => {
    if (!canSubmit(state, action, fromSeat)) {
      // Le distant est notifié ; pour un coup local illégal on prévient juste l'UI.
      if (fromSeat === remoteSeat) transport.send({ type: 'REJECT', reason: 'pas-ton-tour' })
      else callbacks.onReject?.('pas-ton-tour')
      return
    }
    state = applyAction(state, action)
    broadcastState()
  }

  return {
    localSeat,
    getState: () => state,
    submitLocal: (action) => submit(action, localSeat),
    start: () => {
      transport.send({ type: 'ASSIGN', yourSeat: remoteSeat })
      broadcastState()
    },
    receive: (msg) => {
      // Tout message reçu vient de l'invité (siège distant).
      switch (msg.type) {
        case 'ACTION_REQUEST':
          submit(msg.action, remoteSeat)
          break
        case 'JOIN':
          callbacks.onJoin?.(msg)
          break
        case 'LEAVE':
          callbacks.onLeave?.()
          break
        case 'PASS':
        case 'PING':
          break
        default:
          break
      }
    },
  }
}

/** Crée la session CLIENT (invité). Il n'applique jamais : il envoie ses coups
 *  et adopte l'état diffusé par l'hôte. Le choix du vilain se fait ensuite, en
 *  direct, via selectVillain() (phase lobby). */
export function createClientSession(opts: {
  transport: Transport
  name?: string
  callbacks?: SessionCallbacks
}): ClientSession {
  const { transport, callbacks = {} } = opts
  let localSeat = 1 // valeur par défaut tant que l'ASSIGN n'est pas arrivé

  // Annonce sa présence (sans vilain : le choix vient pendant le lobby).
  transport.send({ type: 'JOIN', name: opts.name })

  return {
    get localSeat() { return localSeat },
    submitLocal: (action) => transport.send({ type: 'ACTION_REQUEST', action }),
    selectVillain: (villainKey) => transport.send({ type: 'SELECT_VILLAIN', villainKey }),
    receive: (msg) => {
      switch (msg.type) {
        case 'STATE':
          callbacks.onState?.(msg.state)
          break
        case 'ASSIGN':
          localSeat = msg.yourSeat
          callbacks.onAssign?.(msg.yourSeat)
          break
        case 'LOBBY':
          callbacks.onLobby?.(msg)
          break
        case 'REJECT':
          callbacks.onReject?.(msg.reason)
          break
        case 'LEAVE':
          callbacks.onLeave?.()
          break
        default:
          break
      }
    },
  }
}
