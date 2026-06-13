// =============================================================================
// turn.ts — « À qui la main ? »
//
// SOURCE UNIQUE de vérité pour savoir quel joueur le moteur attend à un instant
// donné. Le joueur attendu n'est PAS toujours `activePlayer` :
//   - beaucoup de Fatalités donnent la main au `chooserIndex` (celui qui a joué
//     la Fatalité) pour placer un Héros, déplacer un pion, etc. ;
//   - certains effets désignent un `playerIndex` précis — parfois l'adversaire
//     du joueur actif (ex. le joueur ciblé doit défausser, regarder sa pioche…).
//
// Ce module est PUR (n'importe que les types) et sert à la fois :
//   - à l'UI, pour activer/désactiver l'interaction d'un panneau ;
//   - au réseau (multijoueur), pour autoriser ou rejeter une demande d'action.
// On évite ainsi de redériver ce routage à plusieurs endroits (cf. les ~20
// branchements de pending dans ui/App.tsx, qu'il remplace).
// =============================================================================

import type { GameState } from './types'

/**
 * Index du joueur que le moteur attend pour résoudre un pending BLOQUANT, ou
 * `null` s'il n'y a aucun pending en attente — le tour suit alors son cours
 * normal, piloté par `activePlayer` (cf. {@link whoseInput}).
 *
 * Au plus un pending bloquant est posé à la fois : on renvoie le propriétaire du
 * premier rencontré.
 */
export function pendingOwner(state: GameState): number | null {
  // chooserIndex : la main revient au joueur qui a DÉCLENCHÉ la Fatalité.
  if (state.pendingHeroPlacement) return state.pendingHeroPlacement.chooserIndex
  if (state.pendingPawnMove) return state.pendingPawnMove.chooserIndex
  if (state.pendingHubertPull) return state.pendingHubertPull.chooserIndex
  if (state.pendingHeroRelocate) return state.pendingHeroRelocate.chooserIndex
  if (state.pendingFateChoice) return state.pendingFateChoice.chooserIndex
  if (state.pendingFateScry) return state.pendingFateScry.chooserIndex
  if (state.pendingTitanSelect) return state.pendingTitanSelect.chooserIndex
  // playerIndex : la main revient au joueur explicitement désigné.
  if (state.pendingTyrannyDiscard) return state.pendingTyrannyDiscard.playerIndex
  if (state.pendingDeckPeek) return state.pendingDeckPeek.playerIndex
  if (state.pendingTypeChoice) return state.pendingTypeChoice.playerIndex
  if (state.pendingTeleport) return state.pendingTeleport.playerIndex
  if (state.pendingManipulation) return state.pendingManipulation.playerIndex
  if (state.pendingRoyalCroquet) return state.pendingRoyalCroquet.playerIndex
  if (state.pendingTransformWickets) return state.pendingTransformWickets.playerIndex
  if (state.pendingScry) return state.pendingScry.playerIndex
  if (state.pendingAllyMoveBuff) return state.pendingAllyMoveBuff.playerIndex
  if (state.pendingFetchedHero) return state.pendingFetchedHero.playerIndex
  if (state.pendingRecover) return state.pendingRecover.playerIndex
  if (state.pendingGiantAction) return state.pendingGiantAction.playerIndex
  if (state.pendingTitanMove) return state.pendingTitanMove.playerIndex
  if (state.pendingDivination) return state.pendingDivination.playerIndex
  if (state.pendingLookTop) return state.pendingLookTop.playerIndex
  // pendingFate / diabloFree / pendingTrapVanquish appartiennent TOUJOURS au
  // joueur actif (il vient de jouer la Fatalité / Diablo / le Piège) → pris en
  // charge par le repli sur activePlayer dans whoseInput, pas listés ici.
  return null
}

/**
 * Joueur que le moteur attend MAINTENANT : propriétaire d'un pending bloquant,
 * sinon le joueur actif. Règle d'autorisation unique pour le gating d'input
 * (UI comme réseau) : un joueur ne peut agir que si `whoseInput(state) === ` son
 * propre index.
 */
export function whoseInput(state: GameState): number {
  return pendingOwner(state) ?? state.activePlayer
}
