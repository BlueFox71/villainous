// =============================================================================
// Shere Khan — mécanique des JETONS FEU.
//
// Un jeton Feu recouvre une ACTION précise d'un lieu (`fireTokens[locationId]` =
// liste des `actionId` recouverts). Une action recouverte est INDISPONIBLE (comme
// la rangée du haut sous un Héros). Posés/déplacés par la Fatalité, retirés par les
// cartes Méchant. L'objectif (vaincre Mowgli) est bloqué tant qu'il en reste un.
// =============================================================================

import type { GameState, PlayerState } from './types'
import { updatePlayer } from './state'

export function isShereKhan(p: PlayerState | undefined): boolean {
  return p?.villain === 'shere-khan'
}

/** Nombre total de jetons Feu dans le royaume. */
export function fireCount(p: PlayerState): number {
  const f = p.fireTokens
  if (!f) return 0
  return Object.values(f).reduce((n, ids) => n + ids.length, 0)
}

/** Vrai si aucun jeton Feu n'est présent dans le royaume (condition de victoire). */
export function noFireInRealm(p: PlayerState): boolean {
  return fireCount(p) === 0
}

/** Les actionId recouverts par un jeton Feu sur un lieu donné. */
export function fireOnLocation(p: PlayerState, locationId: string): string[] {
  return p.fireTokens?.[locationId] ?? []
}

/** Une action précise est-elle recouverte par un jeton Feu ? */
export function actionHasFire(p: PlayerState, locationId: string, actionId: string): boolean {
  return fireOnLocation(p, locationId).includes(actionId)
}

/** Pose un jeton Feu sur (locationId, actionId), si pas déjà présent. */
export function placeFire(state: GameState, idx: number, locationId: string, actionId: string): GameState {
  const p = state.players[idx]
  const cur = p.fireTokens?.[locationId] ?? []
  if (cur.includes(actionId)) return state
  const next = updatePlayer(state, idx, (pl) => ({
    ...pl,
    fireTokens: { ...(pl.fireTokens ?? {}), [locationId]: [...cur, actionId] },
  }))
  const locName = p.locations.find((l) => l.id === locationId)?.name ?? locationId
  return { ...next, log: [...next.log, `🔥 Un jeton Feu recouvre une action de **${locName}**.`] }
}

/** Retire le jeton Feu de (locationId, actionId). */
export function removeFire(state: GameState, idx: number, locationId: string, actionId: string): GameState {
  const cur = state.players[idx].fireTokens?.[locationId] ?? []
  if (!cur.includes(actionId)) return state
  return updatePlayer(state, idx, (pl) => {
    const rest = (pl.fireTokens?.[locationId] ?? []).filter((a) => a !== actionId)
    const ft = { ...(pl.fireTokens ?? {}) }
    if (rest.length > 0) ft[locationId] = rest
    else delete ft[locationId]
    return { ...pl, fireTokens: ft }
  })
}

/** Retire TOUS les jetons Feu d'un lieu (Macaques). Renvoie le nb retiré + le nouvel état. */
export function removeAllFireOnLocation(
  state: GameState,
  idx: number,
  locationId: string,
): { state: GameState; removed: number } {
  const cur = state.players[idx].fireTokens?.[locationId] ?? []
  if (cur.length === 0) return { state, removed: 0 }
  const next = updatePlayer(state, idx, (pl) => {
    const ft = { ...(pl.fireTokens ?? {}) }
    delete ft[locationId]
    return { ...pl, fireTokens: ft }
  })
  return { state: next, removed: cur.length }
}

/** Liste plate des jetons Feu posés : { locationId, actionId }. */
export function listFire(p: PlayerState): { locationId: string; actionId: string }[] {
  const out: { locationId: string; actionId: string }[] = []
  for (const [locationId, ids] of Object.entries(p.fireTokens ?? {})) {
    for (const actionId of ids) out.push({ locationId, actionId })
  }
  return out
}

/** Toutes les actions (lieu+action) NON encore recouvertes par un jeton Feu — cibles de pose. */
export function fireFreeActions(p: PlayerState): { locationId: string; actionId: string }[] {
  const out: { locationId: string; actionId: string }[] = []
  for (const loc of p.locations) {
    for (const a of loc.actions) {
      if (!actionHasFire(p, loc.id, a.id)) out.push({ locationId: loc.id, actionId: a.id })
    }
  }
  return out
}
