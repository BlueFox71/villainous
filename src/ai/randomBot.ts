// =============================================================================
// randomBot — IA « stupide » (V1).
//
// CONTRAINTE ARCHITECTURALE : l'IA est indépendante du moteur. Elle reçoit un
// GameState et renvoie une GameAction légale ; c'est le moteur (applyAction) qui
// l'applique. Le bot ne mute jamais l'état. La source d'aléa est injectable
// (`rand`) pour des tests reproductibles.
//
// Stratégie : choisir uniformément au hasard parmi les coups légaux énumérés
// (enumerateActions, partagé avec heuristicBot). Aucune intelligence.
// =============================================================================

import type { GameAction, GameState } from '../engine/types'
import { playableConditions } from '../engine/rules'
import { enumerateActions } from './enumerate'

type Rand = () => number

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)]
}

/**
 * Renvoie une Condition à jouer en réaction pour le joueur `playerIndex` (non
 * actif), ou null. Pour Lâcheté : sélection aléatoire d'un Allié de la main et
 * d'un lieu chez le bot. La carte est choisie au hasard parmi les jouables.
 */
export function chooseReaction(
  state: GameState,
  playerIndex: number,
  rand: Rand = Math.random,
): GameAction | null {
  const conditions = playableConditions(state, playerIndex)
  if (conditions.length === 0) return null
  const card = pick(conditions, rand)
  if (card.cardId === 'lachete') {
    const me = state.players[playerIndex]
    const allies = me.hand.filter((c) => c.type === 'ally')
    if (allies.length === 0) return null
    const ally = pick(allies, rand)
    const dest = pick(me.locations, rand)
    return {
      type: 'PLAY_CONDITION',
      playerIndex,
      instanceId: card.instanceId,
      allyInstanceId: ally.instanceId,
      to: dest.id,
    }
  }
  if (card.cardId === 'mechancete') {
    // Méchanceté : auto-pick d'un héros ≤4 dans le royaume du bot.
    const heroes = Object.values(state.players[playerIndex].board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 4)
    if (heroes.length === 0) return null
    return {
      type: 'PLAY_CONDITION',
      playerIndex,
      instanceId: card.instanceId,
      allyInstanceId: pick(heroes, rand).instanceId,
    }
  }
  // Avarice, Tyrannie : aucun choix supplémentaire.
  return { type: 'PLAY_CONDITION', playerIndex, instanceId: card.instanceId }
}

/**
 * Renvoie une action légale au hasard pour le joueur actif. Appelée en boucle
 * par le pilote jusqu'à ce qu'elle renvoie END_TURN (qui passe au joueur suivant).
 */
export function chooseAction(state: GameState, rand: Rand = Math.random): GameAction {
  return pick(enumerateActions(state), rand)
}
