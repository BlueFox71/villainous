// =============================================================================
// messages.ts — Protocole du mode multijoueur (réseau local).
//
// Deux niveaux :
//   1. RelayFrame  — enveloppe « transport » comprise par le relais (routage par
//      salon). Le relais est GAME-AGNOSTIQUE : il ne lit que `room`/`t` et
//      réémet `data` tel quel aux autres membres du salon.
//   2. NetMessage  — protocole « jeu » échangé entre les clients et l'autorité
//      (le navigateur-hôte). Transporté dans `data` d'une RelayFrame `data`.
//
// Couche : net → engine uniquement (jamais d'import de ui/ ni de data/).
// =============================================================================

import type { GameAction, GameState } from '../engine/types'

/** Rôle ABSOLU d'un siège, tel que l'autorité le connaît. Distinct du
 *  `SeatController` du store, qui est RELATIF au point de vue d'un client
 *  ('local'/'remote'/'bot') : chaque client dérive son SeatController depuis
 *  `SeatKind[]` + son propre siège assigné (ASSIGN). */
export type SeatKind = 'human' | 'bot'

/** Une place du salon (vue lobby), avant le départ de la partie. */
export interface LobbySeat {
  seat: number
  villainKey: string | null
  name?: string
  connected: boolean
}

// --- Client → autorité -------------------------------------------------------

/** Demande d'application d'une action de jeu (l'autorité valide puis applique). */
export interface ActionRequest { type: 'ACTION_REQUEST'; action: GameAction }
/** Décline une fenêtre de réaction (Condition) ouverte pour ce joueur. */
export interface PassMsg { type: 'PASS' }
/** Rejoint/annonce sa présence dans le salon avec un choix de vilain. */
export interface JoinMsg { type: 'JOIN'; villainKey: string; name?: string }
/** Quitte la partie. */
export interface LeaveMsg { type: 'LEAVE' }

// --- Autorité → clients ------------------------------------------------------

/** Diffusion de l'état complet après chaque action appliquée. `reaction` ouvre
 *  une fenêtre de réaction OPTIONNELLE pour `playerIndex` (sinon null/absent). */
export interface StateMsg {
  type: 'STATE'
  state: GameState
  seats: SeatKind[]
  reaction?: { playerIndex: number } | null
}
/** État du salon (avant départ) : qui est connecté, quel vilain choisi. */
export interface LobbyMsg { type: 'LOBBY'; seats: LobbySeat[]; canStart: boolean }
/** Attribue à ce client son index de siège (son `localPlayerIndex`). */
export interface AssignMsg { type: 'ASSIGN'; yourSeat: number }
/** Rejette une demande (coup illégal, pas ton tour, salon plein…). */
export interface RejectMsg { type: 'REJECT'; reason: string }

// --- Bidirectionnel ----------------------------------------------------------

/** Battement de cœur (détection de coupure). */
export interface PingMsg { type: 'PING' }
export interface PongMsg { type: 'PONG' }

/** Union de tous les messages « jeu ». */
export type NetMessage =
  | ActionRequest | PassMsg | JoinMsg | LeaveMsg
  | StateMsg | LobbyMsg | AssignMsg | RejectMsg
  | PingMsg | PongMsg

// --- Enveloppe transport (relais) --------------------------------------------

/** Enveloppe routée par le relais. `join`/`leave` (dé)enregistrent la socket
 *  dans un salon ; `data` est réémis tel quel aux AUTRES membres du salon. */
export type RelayFrame =
  | { room: string; t: 'join' }
  | { room: string; t: 'leave' }
  | { room: string; t: 'data'; data: NetMessage }

/** Sérialise une frame pour l'envoi sur le fil. */
export function encodeFrame(frame: RelayFrame): string {
  return JSON.stringify(frame)
}

/** Parse une frame reçue ; renvoie null si le message est invalide. */
export function decodeFrame(raw: string): RelayFrame | null {
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return null
    const f = v as Record<string, unknown>
    if (typeof f.room !== 'string') return null
    if (f.t === 'join' || f.t === 'leave') return { room: f.room, t: f.t }
    if (f.t === 'data' && f.data && typeof f.data === 'object') {
      return { room: f.room, t: 'data', data: f.data as NetMessage }
    }
    return null
  } catch {
    return null
  }
}
