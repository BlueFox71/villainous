// =============================================================================
// Davy Jones — mécanique des JETONS TRÉSOR (helpers purs).
//
// Cinq jetons uniques démarrent mélangés FACE CACHÉE dans `treasureReserve`. Davy
// les pose face cachée sur des Héros (un par Héros), les révèle (face visible =
// effet actif qui le GÊNE), puis récupère le trésor en vainquant un Héros à trésor
// RÉVÉLÉ. Récupérer les 5 = victoire. Aucun aléa ici : la réserve est mélangée à la
// mise en place (state.ts) ; on en pioche/réinsère par les extrémités.
// =============================================================================

import type { CardInstance, GameState, PlayerState } from './types'
import { updatePlayer } from './state'

/** Les 5 jetons Trésor (id stable = id d'image public/cards/davy-jones/treasure-<id>.webp). */
export const TREASURE_IDS = [
  'compas-de-jack',
  'boite-a-musique',
  'la-cle',
  'coffre-au-tresor',
  'le-coeur',
] as const

/** Libellés FR des trésors (journal / UI). */
export const TREASURE_NAMES: Record<string, string> = {
  'compas-de-jack': 'Le Compas de Jack',
  'boite-a-musique': 'La Boîte à Musique',
  'la-cle': 'La Clé',
  'coffre-au-tresor': 'Le Coffre au Trésor',
  'le-coeur': 'Le Cœur',
}

export function isDavyJones(player: PlayerState): boolean {
  return player.villain === 'davy-jones'
}

/** Tous les Héros du royaume d'un joueur, avec leur lieu. */
export function realmHeroes(player: PlayerState): { hero: CardInstance; locationId: string }[] {
  const out: { hero: CardInstance; locationId: string }[] = []
  for (const loc of player.locations) {
    for (const c of player.board[loc.id] ?? []) if (c.type === 'hero') out.push({ hero: c, locationId: loc.id })
  }
  return out
}

/** Héros sans aucun jeton Trésor. */
export function heroesWithoutTreasure(player: PlayerState): CardInstance[] {
  return realmHeroes(player).map((h) => h.hero).filter((h) => !h.treasure)
}

/** Héros portant un trésor FACE CACHÉE (révélables). */
export function heroesWithFacedownTreasure(player: PlayerState): CardInstance[] {
  return realmHeroes(player).map((h) => h.hero).filter((h) => h.treasure && !h.treasure.faceUp)
}

/** Héros portant un trésor (quelconque). */
export function heroesWithTreasure(player: PlayerState): CardInstance[] {
  return realmHeroes(player).map((h) => h.hero).filter((h) => !!h.treasure)
}

/** Localise un Héros (et son lieu) par instanceId. */
export function findHero(player: PlayerState, heroInstanceId: string): { hero: CardInstance; locationId: string } | null {
  for (const loc of player.locations) {
    const h = (player.board[loc.id] ?? []).find((c) => c.instanceId === heroInstanceId)
    if (h) return { hero: h, locationId: loc.id }
  }
  return null
}

/** Met à jour un Héros (par instanceId) sur le plateau du joueur `idx`. */
function mutateHero(state: GameState, idx: number, heroInstanceId: string, fn: (h: CardInstance) => CardInstance): GameState {
  return updatePlayer(state, idx, (p) => {
    const board = { ...p.board }
    for (const locId of Object.keys(board)) {
      const cell = board[locId]
      if (cell.some((c) => c.instanceId === heroInstanceId)) {
        board[locId] = cell.map((c) => (c.instanceId === heroInstanceId ? fn(c) : c))
      }
    }
    return { ...p, board }
  })
}

/** Pose un jeton Trésor FACE CACHÉE sur un Héros sans trésor. `treasureId` choisit lequel
 *  retirer de la réserve (défaut : le 1ᵉʳ — utilisé pour les effets Fatalité automatiques). */
export function placeFacedownTreasure(state: GameState, idx: number, heroInstanceId: string, treasureId?: string): GameState {
  const p = state.players[idx]
  const reserve = p.treasureReserve ?? []
  if (reserve.length === 0) return state
  const id = treasureId && reserve.includes(treasureId) ? treasureId : reserve[0]
  let next = updatePlayer(state, idx, (pp) => ({ ...pp, treasureReserve: (pp.treasureReserve ?? []).filter((t) => t !== id) }))
  next = mutateHero(next, idx, heroInstanceId, (h) => ({ ...h, treasure: { id, faceUp: false } }))
  return next
}

/** Révèle (face visible) le trésor d'un Héros. Applique l'effet « à la révélation »
 *  (La Clé : défausser la main). Renvoie l'état mis à jour. */
export function revealTreasure(state: GameState, idx: number, heroInstanceId: string): GameState {
  const found = findHero(state.players[idx], heroInstanceId)
  if (!found || !found.hero.treasure || found.hero.treasure.faceUp) return state
  const treasureId = found.hero.treasure.id
  let next = mutateHero(state, idx, heroInstanceId, (h) => ({ ...h, treasure: { id: h.treasure!.id, faceUp: true } }))
  next = {
    ...next,
    log: [...next.log, `${next.players[idx].villainName} révèle **${TREASURE_NAMES[treasureId] ?? treasureId}** sur **${found.hero.name}**.`],
  }
  // La Clé : à la révélation, le propriétaire défausse sa main.
  if (treasureId === 'la-cle') {
    next = updatePlayer(next, idx, (p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] }))
    next = { ...next, log: [...next.log, `**La Clé** : ${next.players[idx].villainName} défausse sa main.`] }
  }
  return next
}

/** Retire le trésor d'un Héros et le remet dans la réserve (Maudit sois-tu, Jack Sparrow). */
export function removeTreasureToReserve(state: GameState, idx: number, heroInstanceId: string): GameState {
  const found = findHero(state.players[idx], heroInstanceId)
  if (!found || !found.hero.treasure) return state
  const id = found.hero.treasure.id
  let next = mutateHero(state, idx, heroInstanceId, (h) => ({ ...h, treasure: undefined }))
  next = updatePlayer(next, idx, (p) => ({ ...p, treasureReserve: [...(p.treasureReserve ?? []), id] }))
  return next
}

/** Déplace le trésor du Héros `fromId` vers le Héros `toId`. Si `toId` porte déjà un
 *  trésor, on ÉCHANGE les deux (Les amis deviennent des ennemis). */
export function moveOrSwapTreasure(state: GameState, idx: number, fromId: string, toId: string): GameState {
  const p = state.players[idx]
  const from = findHero(p, fromId)
  const to = findHero(p, toId)
  if (!from || !to || !from.hero.treasure) return state
  const fromT = from.hero.treasure
  const toT = to.hero.treasure
  let next = mutateHero(state, idx, fromId, (h) => ({ ...h, treasure: toT }))
  next = mutateHero(next, idx, toId, (h) => ({ ...h, treasure: fromT }))
  return next
}

/** Bonus de force conféré par le trésor RÉVÉLÉ porté par un Héros (Compas de Jack : +2). */
export function treasureStrengthBonus(hero: CardInstance): number {
  if (hero.treasure?.faceUp && hero.treasure.id === 'compas-de-jack') return 2
  return 0
}

/** Y a-t-il, sur `locationId`, un Héros portant un Coffre au Trésor RÉVÉLÉ (interdit la
 *  pose d'Alliés sur ce lieu) ? */
export function chestBlocksAlliesAt(player: PlayerState, locationId: string): boolean {
  return (player.board[locationId] ?? []).some(
    (c) => c.type === 'hero' && c.treasure?.faceUp && c.treasure.id === 'coffre-au-tresor',
  )
}

/** Le Héros `hero` est-il protégé du Kraken (Boîte à Musique révélée) ? */
export function musicBoxBlocksKraken(hero: CardInstance): boolean {
  return hero.treasure?.faceUp === true && hero.treasure.id === 'boite-a-musique'
}
