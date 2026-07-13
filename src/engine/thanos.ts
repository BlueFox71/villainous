// =============================================================================
// Thanos — mécanique des PIERRES D'INFINITÉ (module PUR, isolé du reste du moteur).
//
// Cycle de vie d'une Pierre :
//   stoneSupply (réserve, hors deck)
//     → seedStoneIntoOpponent : posée comme Objet dans le domaine d'un ADVERSAIRE
//       (sur son lieu, associée à un Allié adverse s'il y en a un), `cannotBeDiscarded`.
//     → l'adversaire peut l'ACTIVER (bas de son plateau) tant qu'elle est chez lui.
//   Capture : Thanos DÉPLOIE un de ses Alliés chez l'adversaire (deployThanosAlly) sur
//     le lieu de la Pierre, puis le RAPATRIE (retrieveThanosAlly) → la Pierre quitte le
//     domaine adverse et devient une COMPÉTENCE (stoneSkills). Victoire à 6 Compétences.
//
// Fonctions pures : (state, …) → nouveau state. Aucun import de data/ ni d'UI.
// =============================================================================

import type { CardInstance, GameState, LocationId, PlayerState } from './types'
import { nextRandom } from './rng'

/** Indices de tous les adversaires d'un joueur (tous les autres sièges). */
export function thanosOpponents(state: GameState, idx: number): number[] {
  return state.players.map((_, i) => i).filter((i) => i !== idx)
}

/** Remplace un joueur (mise à jour immuable). */
function withPlayer(state: GameState, i: number, fn: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: state.players.map((p, k) => (k === i ? fn(p) : p)) }
}

/** Toutes les Pierres actuellement EN JEU dans le domaine d'un adversaire (peu importe
 *  l'association), avec leur porteur. Sert aux comptages (Un Modeste Prix, Nebula…). */
export function stonesInOpponentRealms(
  state: GameState,
  thanosIdx: number,
): { oppIndex: number; locationId: LocationId; stone: CardInstance }[] {
  const out: { oppIndex: number; locationId: LocationId; stone: CardInstance }[] = []
  for (const oppIndex of thanosOpponents(state, thanosIdx)) {
    const opp = state.players[oppIndex]
    for (const [locationId, cards] of Object.entries(opp.board)) {
      for (const stone of cards) if (stone.isInfinityStone) out.push({ oppIndex, locationId, stone })
    }
  }
  return out
}

/** Nombre d'adversaires contrôlant au moins une Pierre (Un Modeste Prix à Payer). */
export function opponentsControllingStone(state: GameState, thanosIdx: number): number {
  const set = new Set<number>()
  for (const s of stonesInOpponentRealms(state, thanosIdx)) set.add(s.oppIndex)
  return set.size
}

/** Nombre de Pierres qu'un adversaire donné contrôle (Nebula, Quel qu'en Soit le Prix). */
export function stonesControlledBy(state: GameState, thanosIdx: number, oppIndex: number): number {
  return stonesInOpponentRealms(state, thanosIdx).filter((s) => s.oppIndex === oppIndex).length
}

/** Met en jeu une Pierre « libre » (réserve) dans le domaine de l'adversaire `oppIndex` :
 *  sur le lieu de son pion, associée à un Allié adverse présent (sinon posée sur le lieu).
 *  No-op (retourne l'état inchangé + `seeded:false`) s'il n'y a plus de Pierre libre. */
export function seedStoneIntoOpponent(
  state: GameState,
  thanosIdx: number,
  oppIndex: number,
): { state: GameState; seeded?: CardInstance; locationId?: LocationId } {
  const supply = state.players[thanosIdx].stoneSupply ?? []
  if (supply.length === 0) return { state }
  const r = nextRandom(state.rngState)
  const pick = Math.min(supply.length - 1, Math.floor(r.value * supply.length))
  const stone = supply[pick]
  const opp = state.players[oppIndex]
  const loc = opp.pawnLocation ?? opp.locations[0]?.id
  if (!loc) return { state }
  // Association : un Allié adverse (non associé, non Thanos) présent sur ce lieu.
  const host = (opp.board[loc] ?? []).find(
    (c) => c.type === 'ally' && !c.attachedTo && !c.thanosAlly,
  )
  const placed: CardInstance = {
    ...stone,
    cannotBeDiscarded: true,
    isInfinityStone: true,
    attachedTo: host?.instanceId,
  }
  let next: GameState = { ...state, rngState: r.state }
  next = withPlayer(next, thanosIdx, (p) => ({
    ...p,
    stoneSupply: (p.stoneSupply ?? []).filter((_, i) => i !== pick),
  }))
  next = withPlayer(next, oppIndex, (p) => ({
    ...p,
    board: { ...p.board, [loc]: [...(p.board[loc] ?? []), placed] },
  }))
  return { state: next, seeded: placed, locationId: loc }
}

/** Retire un Allié du plateau de Thanos (peu importe le lieu). Renvoie l'Allié détaché
 *  de ses Objets (les Objets associés restent sur le lieu, libérés). */
function pullAllyFromBoard(
  p: PlayerState,
  allyInstanceId: string,
): { player: PlayerState; ally?: CardInstance } {
  for (const [loc, cards] of Object.entries(p.board)) {
    const ally = cards.find((c) => c.instanceId === allyInstanceId && c.type === 'ally')
    if (!ally) continue
    const board = {
      ...p.board,
      [loc]: cards
        .filter((c) => c.instanceId !== allyInstanceId)
        .map((c) => (c.attachedTo === allyInstanceId ? { ...c, attachedTo: undefined } : c)),
    }
    return { player: { ...p, board }, ally }
  }
  return { player: p }
}

/** DÉPLOIE un Allié de Thanos dans le domaine de l'adversaire `oppIndex`, sur `oppLocationId`
 *  (rangée du haut, côté Héros). L'Allié quitte le plateau de Thanos pour `deployedAllies`. */
export function deployThanosAlly(
  state: GameState,
  thanosIdx: number,
  allyInstanceId: string,
  oppIndex: number,
  oppLocationId: LocationId,
): GameState {
  const { player, ally } = pullAllyFromBoard(state.players[thanosIdx], allyInstanceId)
  if (!ally) return state
  let next = withPlayer(state, thanosIdx, () => ({
    ...player,
    deployedAllies: [...(player.deployedAllies ?? []), { ally, oppIndex, oppLocationId }],
  }))
  // Corvus Glaive : transféré chez l'adversaire, amène aussi une carte Légions de Thanos
  // (depuis le plateau de Thanos) sur le même lieu.
  if (ally.cardId === 'corvus-glaive') {
    const legion = next.players[thanosIdx].locations
      .flatMap((l) => next.players[thanosIdx].board[l.id] ?? [])
      .find((c) => c.cardId === 'legions-de-thanos' && c.type === 'ally' && !c.attachedTo)
    if (legion) next = deployThanosAlly(next, thanosIdx, legion.instanceId, oppIndex, oppLocationId)
  }
  return next
}

/** RAPATRIE un Allié déployé vers `toLocationId` (domaine de Thanos). Si une Pierre se
 *  trouve sur le lieu adverse où l'Allié était déployé, elle est CAPTURÉE : elle quitte le
 *  domaine adverse et rejoint les Compétences de Thanos (`stoneSkills`). */
export function retrieveThanosAlly(
  state: GameState,
  thanosIdx: number,
  allyInstanceId: string,
  toLocationId: LocationId,
): { state: GameState; captured?: CardInstance } {
  const thanos = state.players[thanosIdx]
  const dep = (thanos.deployedAllies ?? []).find((d) => d.ally.instanceId === allyInstanceId)
  if (!dep) return { state }

  // Une Pierre présente sur le lieu adverse de déploiement est capturée.
  const opp = state.players[dep.oppIndex]
  const stone = (opp.board[dep.oppLocationId] ?? []).find((c) => c.isInfinityStone)

  let next = state
  if (stone) {
    next = withPlayer(next, dep.oppIndex, (p) => ({
      ...p,
      board: {
        ...p.board,
        // Retire la Pierre ET libère l'Allié adverse qui la portait éventuellement.
        [dep.oppLocationId]: (p.board[dep.oppLocationId] ?? []).filter(
          (c) => c.instanceId !== stone.instanceId,
        ),
      },
    }))
  }
  next = withPlayer(next, thanosIdx, (p) => ({
    ...p,
    deployedAllies: (p.deployedAllies ?? []).filter((d) => d.ally.instanceId !== allyInstanceId),
    board: { ...p.board, [toLocationId]: [...(p.board[toLocationId] ?? []), dep.ally] },
    stoneSkills: stone
      ? [...(p.stoneSkills ?? []), { ...stone, attachedTo: undefined, cannotBeDiscarded: undefined }]
      : p.stoneSkills,
  }))
  return { state: next, captured: stone }
}
