// =============================================================================
// Dispatcher du moteur : applyAction(state, action) → nouveau GameState.
//
// UNIQUE point d'entrée pour faire évoluer une partie. Pur : ne mute jamais
// l'état reçu. Toutes les actions s'appliquent au JOUEUR ACTIF. Les coups
// illégaux lèvent une erreur (l'UI ne propose que des coups légaux).
// =============================================================================

import type {
  CardInstance,
  CardType,
  Effect,
  GameAction,
  GameState,
  Location,
  LocationAction,
  LocationId,
  PlayerState,
} from './types'
import { shuffle } from './rng'
import {
  activePlayer,
  annotateShowcaseGain,
  currentLocation,
  drawToLimit,
  findLocation,
  pushDiscardShowcase,
  pushFloatingFx,
  pushRobinSteal,
  pushShowcase,
  revealFate,
  updateActivePlayer,
  updatePlayer,
} from './state'
import { performVanquish, processCurseDiscards, resolveEffects, triggerHeroArrival } from './effects'
import {
  adjacentLocationIds,
  canEndTurn,
  canPlaceAt,
  canPlaceCurseAt,
  conditionIsTriggered,
  effectiveCost,
  effectiveStrength,
  fateTarget,
  hasHeroInRealm,
  hasReachedObjective,
  heroPlacementLocations,
  heroesOf,
  isActionAvailable,
  isActionCovered,
  isLegalMove,
  locationActions,
  locationOfCard,
  requiresAllyTarget,
  teleportTargets,
  transformableGuards,
} from './rules'

/** Nombre de cartes Fatalité révélées par une action Fatalité. */
const FATE_REVEAL = 2

/** Si l'action `action` était RECOUVERTE (top-row sur un lieu avec Héros) ET
 *  qu'elle vient d'être utilisée grâce à Persifleur, consomme le drapeau. */
function consumePersifleur(state: GameState, action: LocationAction): GameState {
  if (!state.persifleurAvailable) return state
  if (action.row !== 'top') return state
  const loc = currentLocation(state)
  if (!loc) return state
  const me = activePlayer(state)
  const heroesHere = (me.board[loc.id] ?? []).filter((c) => c.type === 'hero').length
  if (heroesHere === 0) return state
  return {
    ...state,
    persifleurAvailable: false,
    log: [...state.log, 'Persifleur consommé.'],
  }
}

/** Résout l'effet d'une action de lieu instantanée (hors gestion de tour). */
function resolveLocationAction(state: GameState, action: LocationAction): GameState {
  switch (action.type) {
    case 'GAIN_POWER': {
      // Pénalité passive Robin des Bois : −1 JT (min 0) sur les gains du royaume.
      const gross = action.amount ?? 0
      const penalty = hasHeroInRealm(state, state.activePlayer, 'robin-des-bois') ? 1 : 0
      const amount = Math.max(0, gross - penalty)
      let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power + amount }))
      const note = penalty > 0 ? ' (Robin des Bois : −1)' : ''
      next = {
        ...next,
        log: [
          ...next.log,
          `${activePlayer(next).villainName} gagne ${amount} JT${note} (total : ${activePlayer(next).power}).`,
        ],
      }
      return pushRobinSteal(next, state.activePlayer, gross - amount)
    }
    default:
      throw new Error(`Type d'action non géré : ${action.type}`)
  }
}

function applyMove(state: GameState, to: string): GameState {
  if (!isLegalMove(state, to)) {
    throw new Error(`Déplacement illégal vers « ${to} » (phase ${state.phase}).`)
  }
  const me = activePlayer(state)
  const dest = findLocation(me, to)!
  // Le bonus Disparition (skipNextMove) est consommé qu'il soit utilisé ou non.
  let next: GameState = updateActivePlayer(state, (p) => ({
    ...p,
    pawnLocation: to,
    skipNextMove: false,
  }))
  // Persifleur (C.7) : si le lieu de destination porte un Persifleur, le joueur
  // peut utiliser UNE action recouverte de ce lieu.
  const hasPersifleur = (me.board[to] ?? []).some((c) => c.cardId === 'persifleur')
  next = {
    ...next,
    phase: 'ACTION',
    usedActionIds: [],
    persifleurAvailable: hasPersifleur,
    // Le déplacement de Maléfique referme la fenêtre d'action gratuite de Diablo
    // (« avant que Maléfique ne se déplace »).
    diabloFree: null,
    log: [
      ...next.log,
      `${me.villainName} se déplace vers **${dest.name}**.`,
      ...(hasPersifleur ? ['Persifleur : une action recouverte est jouable ici.'] : []),
    ],
  }
  // Tic Tac (Capitaine Crochet) : si le pion arrive sur le lieu de Tic Tac,
  // Crochet défausse immédiatement toute sa main.
  const ticTacHere = (me.board[to] ?? []).some((c) => c.type === 'hero' && c.cardId === 'tic-tac')
  if (ticTacHere && next.players[state.activePlayer].hand.length > 0) {
    next = updateActivePlayer(next, (p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] }))
    next = { ...next, log: [...next.log, `🐊 Tic Tac ! ${me.villainName} défausse toute sa main.`] }
  }
  // Malédictions Feu Infernal : défaussées si le pion arrive sur leur lieu.
  return processCurseDiscards(next, state.activePlayer, to, 'pawn-moves-here')
}

function applyExecuteAction(state: GameState, actionId: string): GameState {
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)! // garanti par isActionAvailable
  // Inclut les actions accordées par un Objet (Boîte à Crochets → Gagner 1).
  const action = locationActions(state, loc.id).find((a) => a.id === actionId)!
  if (action.type !== 'GAIN_POWER') {
    throw new Error(`EXECUTE_ACTION ne gère pas « ${action.type} ».`)
  }
  let next = resolveLocationAction(state, action)
  next = consumePersifleur(next, action)
  return { ...next, usedActionIds: [...next.usedActionIds, actionId] }
}

/** Joue une carte de la main via une action « Jouer une carte » du lieu courant. */
function applyPlayCard(
  state: GameState,
  actionId: string,
  instanceId: string,
  to?: string,
  attachTo?: string,
  targetHeroId?: string,
  allyInstanceIds?: string[],
  allyMove?: { instanceId: string; to: string },
  shrinkFreeActionId?: string,
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de jouer une carte en phase ${state.phase}.`)
  }
  const loc = currentLocation(state)
  if (!loc) throw new Error('Aucun lieu courant.')

  // L'action « Jouer une carte » doit être disponible sur le LIEU COURANT.
  const action = loc.actions.find((a) => a.id === actionId)
  if (!action || action.type !== 'PLAY_CARD') {
    throw new Error(`« ${actionId} » n'est pas une action « Jouer une carte ».`)
  }
  if (isActionCovered(state, action)) {
    throw new Error(`${action.label} est recouverte par un Héros.`)
  }
  if (state.usedActionIds.includes(actionId)) {
    throw new Error('Cette action a déjà été utilisée ce tour.')
  }

  const me = activePlayer(state)
  const card = me.hand.find((c) => c.instanceId === instanceId)
  if (!card) throw new Error(`Carte « ${instanceId} » absente de la main.`)
  if (card.type === 'condition') {
    throw new Error("Une carte Condition se joue pendant le tour d'un adversaire.")
  }
  // Roi Richard (Fatalité, dans le royaume du joueur actif) : interdit les
  // cartes Événement tant qu'il n'est pas vaincu.
  if (card.type === 'effect' && hasHeroInRealm(state, state.activePlayer, 'roi-richard')) {
    throw new Error('Le Roi Richard empêche le Prince Jean de jouer des cartes Événement.')
  }
  // Lever du jour : interdit de jouer une Page ce tour-ci.
  if (card.cardId === 'page' && me.noPagePlay) {
    throw new Error('Lever du jour : impossible de jouer une Page ce tour-ci.')
  }

  // Coût effectif (Couronne −1, Bâton Magique −1, Épée de Vérité +2 sur curse,
  // Razoul −1 sur Allié). Hypnose : coût = force (effective) du Héros ciblé.
  let cost = effectiveCost(state, card, to)
  if ((card.effects ?? []).some((e) => e.type === 'HYPNOTIZE_HERO')) {
    if (!targetHeroId) throw new Error('Hypnose nécessite un Héros cible.')
    cost = effectiveStrength(state, state.activePlayer, targetHeroId) ?? 0
  }
  if (me.power < cost) {
    throw new Error(`Pas assez de pouvoir (coût ${cost}, disponible ${me.power}).`)
  }

  // Alliés/Objets/Malédictions vont sur le plateau ; Événements (et Conditions
  // côté action) résolvent puis sont défaussés.
  const goesToBoard = card.type === 'ally' || card.type === 'item' || card.type === 'curse'
  let dest: Location | undefined
  let host: CardInstance | undefined

  if (goesToBoard) {
    if (to === undefined) {
      throw new Error(`${card.name} doit être posé sur un lieu (destination manquante).`)
    }
    if (!canPlaceAt(state, to)) {
      throw new Error(`Lieu de destination invalide : « ${to} ».`)
    }
    if (card.playOnlyAt && to !== card.playOnlyAt) {
      throw new Error(`${card.name} ne peut être posé(e) que sur un lieu précis.`)
    }
    if (card.type === 'curse' && !canPlaceCurseAt(state, state.activePlayer, to)) {
      throw new Error(`Aucune Malédiction ne peut être posée ici (Pimprenelle).`)
    }
    // Limite d'exemplaires de cette carte sur un même lieu (Page : max 2).
    if (card.maxAtLocation !== undefined) {
      const here = (me.board[to] ?? []).filter(
        (c) => c.cardId === card.cardId && !c.attachedTo,
      ).length
      if (here >= card.maxAtLocation) {
        throw new Error(`Ce lieu a déjà ${card.maxAtLocation} ${card.name}(s) : maximum atteint.`)
      }
    }
    dest = findLocation(me, to)!
    // Objet « à associer » : il faut un Allié porteur sur le lieu de destination.
    // Un Héros hypnotisé (= Allié sous contrôle) et un arceau sont des porteurs valides.
    if (requiresAllyTarget(card)) {
      const allies = (me.board[to] ?? []).filter(
        (c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized),
      )
      if (allies.length === 0) {
        throw new Error(`Aucun Allié sur ${dest.name} pour y associer ${card.name}.`)
      }
      if (attachTo === undefined) {
        throw new Error(`${card.name} doit être associé à un Allié (cible manquante).`)
      }
      host = allies.find((a) => a.instanceId === attachTo)
      if (!host) {
        throw new Error(`L'Allié cible « ${attachTo} » n'est pas un Allié sur ${dest.name}.`)
      }
    } else if (attachTo !== undefined) {
      throw new Error(`${card.name} ne s'associe pas à un Allié.`)
    }
  } else if (attachTo !== undefined) {
    throw new Error(`${card.name} ne s'associe pas à un Allié.`)
  }

  // Payer le coût, retirer la carte de la main, marquer l'action utilisée.
  let next = updateActivePlayer(state, (p) => ({
    ...p,
    power: p.power - cost,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
  }))
  const where = dest ? ` sur **${dest.name}**` : ''
  const assoc = host ? `, associé à **${host.name}**` : ''
  next = {
    ...next,
    usedActionIds: [...next.usedActionIds, actionId],
    log: [...next.log, `${me.villainName} joue **${card.name}** (coût ${cost})${where}${assoc}.`],
  }

  // Showcase pour Événements/Malédictions : la carte s'affiche en grand. On
  // retient son index pour y annoter le pouvoir gagné par ses effets (« +N JT »).
  // Tendre un Piège est EXCLU ici : son showcase est différé à la fin de sa
  // séquence (après le Vanquish facultatif ou « Terminer »).
  let showcaseIdx = -1
  if ((card.type === 'effect' || card.type === 'curse') && card.cardId !== 'tendre-piege') {
    next = pushShowcase(next, card.cardId, `Joué par ${me.villainName}`, state.activePlayer)
    showcaseIdx = next.showcaseEvents.length - 1
  }
  // Résoudre les effets immédiats (sur le joueur actif), en mesurant le pouvoir gagné.
  const powerBeforeEffects = activePlayer(next).power
  if (card.cardId === 'tendre-piege') {
    // « Vous pouvez déplacer un Allié, PUIS faire une action Éliminer un Héros. »
    // Le déplacement s'applique IMMÉDIATEMENT (si un Allié est choisi). Le Vanquish
    // est FACULTATIF : résolu maintenant si une cible est fournie (compat. bot/tests),
    // sinon laissé en attente (pendingTrapVanquish) pour un choix UI ultérieur.
    if (allyMove) {
      next = resolveEffects(next, [{ type: 'MOVE_ALLY_FREELY' }], { allyMove })
    }
    if (targetHeroId && allyInstanceIds && allyInstanceIds.length > 0) {
      // Chemin atomique (bot/tests) : Vanquish immédiat → showcase tout de suite.
      next = resolveEffects(next, [{ type: 'VANQUISH_HERO', keepAllies: false }], { targetHeroId, allyInstanceIds })
      next = pushShowcase(next, 'tendre-piege', `Joué par ${me.villainName}`, state.activePlayer)
    } else {
      // Chemin interactif : Vanquish facultatif → showcase différé à sa résolution.
      next = { ...next, pendingTrapVanquish: true }
    }
  } else {
    next = resolveEffects(next, card.effects ?? [], { targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId })
  }
  next = annotateShowcaseGain(next, showcaseIdx, activePlayer(next).power - powerBeforeEffects)

  // Pose sur le lieu de destination (Objet associé : lien `attachedTo`), sinon défausse.
  if (goesToBoard && dest) {
    const destId = dest.id
    const placed: CardInstance = host ? { ...card, attachedTo: host.instanceId } : card
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: { ...p.board, [destId]: [...(p.board[destId] ?? []), placed] },
    }))
    // Animation de pose (vol main → lieu). Les Malédictions ont déjà un showcase
    // côté bot et sont volées via `flyHandToBoard` côté humain → on les exclut.
    if (card.type !== 'curse') {
      next = pushFloatingFx(next, {
        kind: 'play-card',
        playerIndex: state.activePlayer,
        locationId: destId,
        cardId: card.cardId,
      })
    }
    // Une Malédiction Sommeil sans Rêves se défausse quand un Allié arrive.
    if (card.type === 'ally') {
      next = processCurseDiscards(next, state.activePlayer, destId, 'ally-played-here')
    }
  } else {
    next = updateActivePlayer(next, (p) => ({ ...p, discard: [...p.discard, card] }))
  }
  return consumePersifleur(next, action)
}

/** Défausse un ensemble de cartes de la main via une action « Défausser ». */
function applyDiscardCards(
  state: GameState,
  actionId: string,
  instanceIds: string[],
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de défausser en phase ${state.phase}.`)
  }
  const loc = currentLocation(state)
  if (!loc) throw new Error('Aucun lieu courant.')

  const action = loc.actions.find((a) => a.id === actionId)
  if (!action || action.type !== 'DISCARD_CARDS') {
    throw new Error(`« ${actionId} » n'est pas une action « Défausser ».`)
  }
  if (isActionCovered(state, action)) {
    throw new Error(`${action.label} est recouverte par un Héros.`)
  }
  if (state.usedActionIds.includes(actionId)) {
    throw new Error('Cette action a déjà été utilisée ce tour.')
  }
  if (instanceIds.length === 0) {
    throw new Error('Aucune carte sélectionnée à défausser.')
  }

  const me = activePlayer(state)
  const toDiscard = new Set(instanceIds)
  const discarded = me.hand.filter((c) => toDiscard.has(c.instanceId))
  if (discarded.length !== toDiscard.size) {
    throw new Error('Une carte à défausser est absente de la main.')
  }

  const next = updateActivePlayer(state, (p) => ({
    ...p,
    hand: p.hand.filter((c) => !toDiscard.has(c.instanceId)),
    discard: [...p.discard, ...discarded],
  }))
  let consumed = consumePersifleur(next, action)
  consumed = {
    ...consumed,
    usedActionIds: [...consumed.usedActionIds, actionId],
    log: [
      ...consumed.log,
      `${me.villainName} défausse ${discarded.length} carte${discarded.length > 1 ? 's' : ''}.`,
    ],
  }
  // Showcase « défausse volontaire » (foncé + couleur du vilain qui défile) :
  // rend visible ce que l'adversaire jette de sa main (cf. red = retiré par un Héros).
  return pushDiscardShowcase(
    consumed,
    discarded.map((c) => c.cardId),
    `${me.villainName} défausse ${discarded.length} carte${discarded.length > 1 ? 's' : ''}`,
    state.activePlayer,
    'dark',
    'bottom',
  )
}

/**
 * Apparence de Dragon : si `targetIndex` a armé sa récompense, +3 JT + showcase,
 * puis on désarme. No-op sinon. Pur. Appelé par toute action Fatalité ciblant le
 * joueur (FATE en partie, et infliger une Fatalité en MODE TEST).
 */
function consumeDragonFormReward(state: GameState, targetIndex: number): GameState {
  const tgt = state.players[targetIndex]
  if (!tgt.dragonFormReward) return state
  let next = updatePlayer(state, targetIndex, (p) => ({ ...p, power: p.power + 3, dragonFormReward: false }))
  next = {
    ...next,
    log: [...next.log, `**Apparence de Dragon** : ${tgt.villainName} gagne 3 JT (fatalisé).`],
  }
  return pushShowcase(next, 'apparence-dragon', `${tgt.villainName} : +3 JT (Apparence de Dragon)`, targetIndex)
}

/** Lance la Fatalité : révèle FATE_REVEAL cartes du deck Fatalité de la cible. */
function applyFate(state: GameState, actionId: string): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de lancer la Fatalité en phase ${state.phase}.`)
  }
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action Fatalité indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)! // garanti par isActionAvailable
  const action = loc.actions.find((a) => a.id === actionId)!
  if (action.type !== 'FATE') {
    throw new Error(`« ${actionId} » n'est pas une action Fatalité.`)
  }

  const target = fateTarget(state)
  const me = activePlayer(state)
  const tgt = state.players[target]
  if (tgt.fateDeck.length + tgt.fateDiscard.length === 0) {
    throw new Error(`Le deck Fatalité de ${tgt.villainName} est vide.`)
  }

  const r = revealFate(tgt, FATE_REVEAL, state.rngState)
  // Capitaine Crochet : dès qu'il est dévoilé, Peter Pan est joué d'office sur
  // l'Arbre du Pendu (débloqué ou non) et les autres cartes dévoilées sont
  // défaussées — pas de choix de Fatalité.
  const pp = r.revealed.find(
    (c) => tgt.objective.type === 'DEFEAT_HERO_AT_LOCATION' && c.cardId === tgt.objective.heroCardId,
  )
  if (pp) {
    const others = r.revealed.filter((c) => c.instanceId !== pp.instanceId)
    let next = updatePlayer(state, target, () => ({
      ...r.player,
      fateDiscard: [...r.player.fateDiscard, ...others],
    }))
    next = consumeDragonFormReward(next, target)
    next = consumePersifleur(next, action)
    next = {
      ...next,
      rngState: r.rngState,
      usedActionIds: [...next.usedActionIds, actionId],
      pendingFate: null,
      log: [...next.log, `${me.villainName} lance la Fatalité : **${pp.name}** est dévoilé et fonce sur l'Arbre du Pendu !`],
    }
    const arbreName = tgt.locations.find((l) => l.id === 'arbre-pendu')?.name ?? 'Arbre du Pendu'
    return placeFateHeroWithEffects(next, target, state.activePlayer, pp, 'arbre-pendu', arbreName)
  }
  let next = updatePlayer(state, target, () => r.player)
  // Apparence de Dragon : si la cible avait armé sa récompense, +3 JT immédiats.
  next = consumeDragonFormReward(next, target)
  next = consumePersifleur(next, action)
  return {
    ...next,
    rngState: r.rngState,
    usedActionIds: [...next.usedActionIds, actionId],
    pendingFate: { target, revealed: r.revealed },
    log: [
      ...next.log,
      `${me.villainName} lance la Fatalité contre ${tgt.villainName} (révèle ${r.revealed.length} carte${r.revealed.length > 1 ? 's' : ''}).`,
    ],
  }
}

/**
 * Pose un Héros Fatalité sur le lieu `to` du joueur `targetIndex`, joue ses
 * effets « à la pose », déclenche les arrivées (Mandat d'Arrêt, auto-défausses
 * de Malédiction) et émet les showcases : le Héros « vole » côté `playedBy`, et
 * les éventuelles cartes retirées du lieu apparaissent en showcase « défausse »
 * rouge. Helper partagé par la résolution de Fatalité et le MODE TEST. Pur.
 */
export function placeFateHeroWithEffects(
  state: GameState,
  targetIndex: number,
  playedBy: number,
  hero: CardInstance,
  to: LocationId,
  destName: string,
): GameState {
  const targetName = state.players[targetIndex].villainName
  let next = updatePlayer(state, targetIndex, (p) => ({
    ...p,
    board: { ...p.board, [to]: [...(p.board[to] ?? []), hero] },
  }))
  next = {
    ...next,
    log: [
      ...next.log,
      `${targetName} subit **${hero.name}** (force ${hero.strength ?? '?'}) sur **${destName}**.`,
    ],
  }
  // Showcase : le héros qui arrive est affiché en grand côté joueur qui le pose,
  // puis « vole » vers le lieu de destination. L'UI masque l'exemplaire posé.
  next = pushShowcase(
    next,
    hero.cardId,
    `${targetName} subit ${hero.name} sur ${destName}`,
    playedBy,
    { playerIndex: targetIndex, locationId: to },
    hero.instanceId,
  )
  const heroShowcaseIdx = next.showcaseEvents.length - 1
  // Snapshot du lieu AVANT les effets : tout ce qui disparaît ensuite (Alliés
  // défaussés par Prince Philippe, Forêt de Ronces qui s'auto-défausse à
  // l'arrivée d'un Héros…) est montré en showcase « défausse » rouge clignotant.
  const cellBefore = next.players[targetIndex].board[to] ?? []
  next = resolveEffects(next, hero.onPlace ?? [], {
    actorIndex: targetIndex,
    hostInstanceId: hero.instanceId,
    hostLocationId: to,
  })
  // Mandat d'Arrêt (C.1) déclenché APRÈS les onPlace (Frère Tuck a pu les
  // défausser entretemps : « ils ne rapportent plus aucun Pouvoir »). On mesure
  // le pouvoir gagné par le propriétaire pour l'animer (« +N 🪙 ») à l'atterrissage.
  const powerBeforeArrival = next.players[targetIndex].power
  next = triggerHeroArrival(next, targetIndex, to)
  const landingGain = next.players[targetIndex].power - powerBeforeArrival
  if (landingGain > 0) {
    next = {
      ...next,
      showcaseEvents: next.showcaseEvents.map((e, i) =>
        i === heroShowcaseIdx ? { ...e, landingPowerGain: landingGain } : e,
      ),
    }
  }
  const cellAfter = next.players[targetIndex].board[to] ?? []
  const afterIds = new Set(cellAfter.map((c) => c.instanceId))
  const removed = cellBefore.filter(
    (c) => c.instanceId !== hero.instanceId && !afterIds.has(c.instanceId),
  )
  if (removed.length > 0) {
    next = pushDiscardShowcase(
      next,
      removed.map((c) => c.cardId),
      `${hero.name} retire ${removed.length} carte${removed.length > 1 ? 's' : ''} de ${destName}`,
      targetIndex,
      'red',
      'bottom',
    )
  }
  return next
}

/** MODE TEST : inflige un Héros Fatalité au joueur actif sur un lieu choisi,
 *  comme si un adversaire l'avait joué (effets « à la pose » + arrivées +
 *  showcases). Restrictions de pose réelles appliquées (Forêt de Ronces…). */
function applyTestPlaceFate(state: GameState, card: CardInstance, to: LocationId): GameState {
  const idx = state.activePlayer
  const player = state.players[idx]
  const dest = findLocation(player, to)
  if (!dest) throw new Error(`Lieu invalide : « ${to} ».`)
  if (card.type !== 'hero') {
    throw new Error('Le mode test ne sait infliger que des Héros pour l\'instant.')
  }
  if (!heroPlacementLocations(state, card, idx).includes(to)) {
    throw new Error(`${card.name} ne peut pas être posé sur ${dest.name} (lieu interdit ou Malédiction).`)
  }
  // Une Fatalité infligée déclenche la récompense Apparence de Dragon si armée.
  const next = consumeDragonFormReward(state, idx)
  return placeFateHeroWithEffects(next, idx, idx, card, to, dest.name)
}

/**
 * Applique une carte Fatalité non-Héros qui CIBLE un Héros existant chez la
 * cible : Voler aux Riches (verrouille ≤4 JT de la cible sur le Héros) et
 * Déguisement (s'attache au Héros, le rendant invulnérable). Sans Héros à
 * cibler, la carte est défaussée sans effet. Range `chosen` (fateDiscard pour
 * Voler aux Riches, plateau pour Déguisement) ; NE gère PAS les autres cartes
 * révélées ni `pendingFate` (à la charge de l'appelant). Partagé par la
 * résolution de Fatalité (RESOLVE_FATE) et le MODE TEST.
 */
function resolveFateCardOnHero(
  state: GameState,
  targetIndex: number,
  playedByIndex: number,
  chosen: CardInstance,
  targetHeroId: string | undefined,
): GameState {
  const tgt = state.players[targetIndex]
  const playedByName = state.players[playedByIndex].villainName
  const heroes = heroesOf(state, targetIndex)

  // Éligibilité : l'Épée de Vérité ne peut s'attacher qu'à un Héros SANS autre Objet.
  const heroHasItem = (h: CardInstance): boolean => {
    const loc = locationOfCard(tgt, h.instanceId)
    return !!loc && (tgt.board[loc] ?? []).some((c) => c.attachedTo === h.instanceId && c.type === 'item')
  }
  const eligible = chosen.cardId === 'epee-verite' ? heroes.filter((h) => !heroHasItem(h)) : heroes

  if (eligible.length === 0) {
    const verb = chosen.cardId === 'deguisement' ? 'équiper' : 'cibler'
    const next = updatePlayer(state, targetIndex, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen],
    }))
    return {
      ...next,
      log: [...next.log, `**${chosen.name}** défaussée (aucun Héros à ${verb} sur ${tgt.villainName}).`],
    }
  }
  if (!targetHeroId) throw new Error(`${chosen.name} nécessite un Héros cible.`)
  const hero = heroes.find((h) => h.instanceId === targetHeroId)
  if (!hero) throw new Error(`Héros cible « ${targetHeroId} » introuvable chez ${tgt.villainName}.`)

  if (chosen.cardId === 'voler-riches') {
    let next = updatePlayer(state, targetIndex, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen],
    }))
    next = {
      ...next,
      log: [...next.log, `${playedByName} joue **${chosen.name}** sur **${hero.name}**.`],
    }
    // Réutilise LOSE_POWER_TO_HOST : la cible perd ≤4 JT, stockés sur le héros choisi.
    return resolveEffects(next, [{ type: 'LOSE_POWER_TO_HOST', amount: 4 }], {
      actorIndex: targetIndex,
      hostInstanceId: hero.instanceId,
    })
  }

  if (chosen.cardId === 'deguisement') {
    const heroLoc = locationOfCard(tgt, hero.instanceId)
    if (!heroLoc) throw new Error(`Lieu du Héros « ${hero.name} » introuvable.`)
    // Déguisement entre sur le plateau de la cible, attaché au Héros choisi.
    // L'invulnérabilité associée sera utilisée par Vanquish (bloc B).
    const equipped: CardInstance = { ...chosen, attachedTo: hero.instanceId }
    const next = updatePlayer(state, targetIndex, (p) => ({
      ...p,
      board: { ...p.board, [heroLoc]: [...(p.board[heroLoc] ?? []), equipped] },
    }))
    return {
      ...next,
      log: [...next.log, `${playedByName} associe **${chosen.name}** à **${hero.name}**.`],
    }
  }

  if (chosen.cardId === 'lampe-de-poche') {
    const heroLoc = locationOfCard(tgt, hero.instanceId)
    if (!heroLoc) throw new Error(`Lieu du Héros « ${hero.name} » introuvable.`)
    // S'attache au Héros : Slenderman ne peut plus se téléporter vers lui (cf. teleportTargets).
    const equipped: CardInstance = { ...chosen, attachedTo: hero.instanceId }
    const next = updatePlayer(state, targetIndex, (p) => ({
      ...p,
      board: { ...p.board, [heroLoc]: [...(p.board[heroLoc] ?? []), equipped] },
    }))
    return {
      ...next,
      log: [...next.log, `${playedByName} associe **${chosen.name}** à **${hero.name}** (téléportation bloquée).`],
    }
  }

  if (chosen.cardId === 'epee-verite') {
    const heroLoc = locationOfCard(tgt, hero.instanceId)
    if (!heroLoc) throw new Error(`Lieu du Héros « ${hero.name} » introuvable.`)
    // Restriction officielle : un Héros sans autre Objet associé.
    const hasItem = (tgt.board[heroLoc] ?? []).some(
      (c) => c.attachedTo === hero.instanceId && c.type === 'item',
    )
    if (hasItem) throw new Error(`${hero.name} a déjà un Objet associé.`)
    // L'Épée s'attache au Héros : +2 Force (passif) et +2 au coût des Malédictions
    // sur ce lieu (passif) — gérés par effectiveStrength / effectiveCost.
    const equipped: CardInstance = { ...chosen, attachedTo: hero.instanceId }
    const next = updatePlayer(state, targetIndex, (p) => ({
      ...p,
      board: { ...p.board, [heroLoc]: [...(p.board[heroLoc] ?? []), equipped] },
    }))
    return {
      ...next,
      log: [
        ...next.log,
        `${playedByName} associe **${chosen.name}** à **${hero.name}** (+2 Force ; Malédiction +2 sur ce lieu).`,
      ],
    }
  }

  throw new Error(`${chosen.name} n'est pas une carte Fatalité ciblant un Héros.`)
}

/**
 * « Il était un Rêve » : défausse une Malédiction d'un lieu de `targetIndex`
 * contenant un Héros (auto-pick : 1ᵉʳ lieu valide). Pousse le showcase de la
 * défausse. Ne touche PAS à la carte elle-même (le caller la défausse). Pur.
 */
function discardCurseFromHeroLocation(state: GameState, targetIndex: number): GameState {
  const target = state.players[targetIndex]
  let from: string | undefined
  let curse: CardInstance | undefined
  for (const loc of target.locations) {
    const cell = target.board[loc.id] ?? []
    if (cell.some((c) => c.type === 'hero')) {
      const found = cell.find((c) => c.type === 'curse')
      if (found) {
        from = loc.id
        curse = found
        break
      }
    }
  }
  if (!from || !curse) {
    return { ...state, log: [...state.log, `Il était un Rêve : aucun lieu avec Héros + Malédiction.`] }
  }
  const removedId = curse.instanceId
  let next = updatePlayer(state, targetIndex, (p) => ({
    ...p,
    board: { ...p.board, [from!]: (p.board[from!] ?? []).filter((c) => c.instanceId !== removedId) },
    discard: [...p.discard, curse!],
  }))
  next = {
    ...next,
    log: [...next.log, `${target.villainName} perd **${curse.name}** sur **${from}** (Il était un Rêve).`],
  }
  return pushDiscardShowcase(next, [curse.cardId], `${curse.name} se défausse`, targetIndex, 'red', 'bottom')
}

/** Résout la Fatalité en attente : joue la carte choisie, défausse l'autre. */
function applyResolveFate(
  state: GameState,
  instanceId: string,
  to?: string,
  targetHeroId?: string,
  enlargeToward?: string,
): GameState {
  const pending = state.pendingFate
  if (!pending) throw new Error('Aucune Fatalité à résoudre.')
  const chosen = pending.revealed.find((c) => c.instanceId === instanceId)
  if (!chosen) throw new Error(`Carte Fatalité « ${instanceId} » non révélée.`)
  const others = pending.revealed.filter((c) => c.instanceId !== instanceId)
  const tgt = state.players[pending.target]

  // Héros : posé sur un lieu du royaume de la CIBLE ; il recouvrira sa rangée haute.
  if (chosen.type === 'hero') {
    // Aucun lieu légal (toutes les cases bloquées, ex. Malédictions no-heroes) → défaussé.
    if (heroPlacementLocations(state, chosen, pending.target).length === 0) {
      const next = updatePlayer(state, pending.target, (p) => ({
        ...p,
        fateDiscard: [...p.fateDiscard, chosen, ...others],
      }))
      return {
        ...next,
        pendingFate: null,
        log: [...next.log, `**${chosen.name}** défaussée (aucun lieu où la poser sur ${tgt.villainName}).`],
      }
    }
    if (to === undefined) throw new Error(`${chosen.name} doit être posé sur un lieu.`)
    const dest = findLocation(tgt, to)
    if (!dest) throw new Error(`Lieu de destination invalide : « ${to} ».`)
    if (!heroPlacementLocations(state, chosen, pending.target).includes(to)) {
      throw new Error(`${chosen.name} ne peut pas être posé sur ${dest.name} (lieu interdit ou Malédiction).`)
    }
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, ...others],
    }))
    next = { ...next, pendingFate: null }
    // Pose + effets + showcases (vol du Héros, défausse rouge). Le showcase de
    // vol est positionné côté joueur qui pose la Fatalité (state.activePlayer).
    return placeFateHeroWithEffects(next, pending.target, state.activePlayer, chosen, to, dest.name)
  }

  // Cartes Fatalité non-Héros ciblant un Héros : Voler aux Riches, Déguisement,
  // Épée de Vérité. Effet partagé avec le MODE TEST (resolveFateCardOnHero) ; on
  // défausse ici l'AUTRE carte révélée et on referme la Fatalité avant de déléguer.
  if (
    chosen.cardId === 'voler-riches' ||
    chosen.cardId === 'deguisement' ||
    chosen.cardId === 'epee-verite' ||
    chosen.cardId === 'lampe-de-poche'
  ) {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, ...others],
    }))
    next = { ...next, pendingFate: null }
    return resolveFateCardOnHero(next, pending.target, state.activePlayer, chosen, targetHeroId)
  }

  // Agrandir (Fatalité, Reine de Cœur) : agrandit un Héros du royaume de la cible
  // (ou rend sa taille normale à un Héros rapetissé). L'effet s'applique au Héros
  // chez la CIBLE (realm owner) → actorIndex = pending.target.
  if (chosen.cardId === 'agrandir') {
    const heroes = heroesOf(state, pending.target)
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    if (heroes.length === 0) {
      return { ...next, log: [...next.log, `**${chosen.name}** défaussée (aucun Héros chez ${tgt.villainName}).`] }
    }
    if (!targetHeroId) throw new Error(`${chosen.name} nécessite un Héros cible.`)
    return resolveEffects(next, chosen.effects ?? [], {
      actorIndex: pending.target,
      targetHeroId,
      enlargeToward,
    })
  }

  if (chosen.cardId === 'il-etait-un-reve') {
    // Défausse une Malédiction d'un lieu de la cible qui contient un Héros.
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    return discardCurseFromHeroLocation(next, pending.target)
  }

  // Mauvaise creepypasta : la réserve de Jetons Pouvoir de la cible retombe à 2
  // si elle en a davantage.
  if (chosen.cardId === 'mauvaise-creepypasta') {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      power: Math.min(p.power, 2),
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    return pushShowcase(
      { ...next, log: [...next.log, `**Mauvaise creepypasta** : ${tgt.villainName} retombe à ${next.players[pending.target].power} JT.`] },
      chosen.cardId,
      `${tgt.villainName} : réserve ramenée à 2 JT`,
      state.activePlayer,
    )
  }

  // Vent de panique : l'adversaire (joueur actif) déplace un Héros du royaume de
  // la cible vers un lieu voisin. Si la cible n'a aucun Héros, simple défausse.
  if (chosen.cardId === 'vent-de-panique') {
    const hasHero = Object.values(tgt.board).some((cards) => cards.some((c) => c.type === 'hero'))
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    if (!hasHero) {
      return { ...next, log: [...next.log, `Vent de panique : aucun Héros chez ${tgt.villainName}.`] }
    }
    return {
      ...next,
      pendingHeroRelocate: { chooserIndex: state.activePlayer, targetIndex: pending.target },
      log: [...next.log, `**Vent de panique** : déplacez un Héros de ${tgt.villainName} vers un lieu voisin.`],
    }
  }

  // Lever du jour : la cible ne pourra pas jouer de Page lors de son prochain tour.
  if (chosen.cardId === 'lever-du-jour') {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      noPagePlay: true,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    return pushShowcase(
      { ...next, log: [...next.log, `**Lever du jour** : ${tgt.villainName} ne pourra pas jouer de Page à son prochain tour.`] },
      chosen.cardId,
      `${tgt.villainName} : pas de Page au prochain tour`,
      state.activePlayer,
    )
  }

  // K.O. (Jafar, Fatalité) : retirer un Allié de force ≤ 3 du royaume de la cible.
  // L'adversaire (joueur actif) choisit lequel (RESOLVE_FATE_CHOICE).
  if (chosen.cardId === 'ko') {
    const candidates = Object.values(tgt.board)
      .flat()
      .filter((c) => c.type === 'ally' && !c.isWicket && !c.attachedTo && (c.strength ?? 0) <= 3)
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    if (candidates.length === 0) {
      return { ...next, log: [...next.log, `**K.O.** : aucun Allié de force ≤ 3 chez ${tgt.villainName}.`] }
    }
    return {
      ...next,
      pendingFateChoice: {
        chooserIndex: state.activePlayer,
        targetIndex: pending.target,
        kind: 'remove-ally',
        candidateIds: candidates.map((c) => c.instanceId),
      },
      log: [...next.log, `**K.O.** : ${state.players[state.activePlayer].villainName} retire un Allié de force ≤ 3 chez ${tgt.villainName}.`],
    }
  }

  // Migraine Atroce (Crochet, Fatalité) : défausser un Objet du royaume (au choix).
  if (chosen.cardId === 'migraine-atroce') {
    const items = Object.values(tgt.board)
      .flat()
      .filter((c) => c.type === 'item')
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    if (items.length === 0) {
      return { ...next, log: [...next.log, `**Migraine Atroce** : aucun Objet à défausser chez ${tgt.villainName}.`] }
    }
    return {
      ...next,
      pendingFateChoice: {
        chooserIndex: state.activePlayer,
        targetIndex: pending.target,
        kind: 'remove-item',
        candidateIds: items.map((c) => c.instanceId),
      },
      log: [...next.log, `**Migraine Atroce** : ${state.players[state.activePlayer].villainName} défausse un Objet de ${tgt.villainName}.`],
    }
  }

  // Trahison (Jafar, Fatalité) : la cible perd immédiatement 2 jetons Pouvoir.
  if (chosen.cardId === 'trahison') {
    const lost = Math.min(2, tgt.power)
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      power: Math.max(0, p.power - 2),
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    return {
      ...next,
      log: [...next.log, `**Trahison** : ${tgt.villainName} perd ${lost} jeton${lost > 1 ? 's' : ''} Pouvoir.`],
    }
  }

  // Chute dans le terrier (Reine de Cœur, Fatalité) : cherchez Alice et jouez-la
  // (le joueur actif choisit le lieu). Si Alice est déjà dans le royaume, retirez
  // plutôt un Allié sur son lieu.
  if (chosen.cardId === 'chute-terrier') {
    let aliceLoc: string | undefined
    for (const l of tgt.locations) {
      if ((tgt.board[l.id] ?? []).some((c) => c.type === 'hero' && c.cardId === 'alice')) aliceLoc = l.id
    }
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    // Alice déjà présente → retirer un Allié sur son lieu (au choix).
    if (aliceLoc) {
      const candidates = (next.players[pending.target].board[aliceLoc] ?? []).filter(
        (c) => c.type === 'ally' && !c.isWicket && !c.attachedTo,
      )
      if (candidates.length === 0) {
        return { ...next, log: [...next.log, `Chute dans le terrier : aucun Allié à retirer sur le lieu d'Alice.`] }
      }
      return {
        ...next,
        pendingFateChoice: {
          chooserIndex: state.activePlayer,
          targetIndex: pending.target,
          kind: 'remove-ally',
          candidateIds: candidates.map((c) => c.instanceId),
        },
        log: [...next.log, `Chute dans le terrier : retirez un Allié sur le lieu d'Alice.`],
      }
    }
    // Sinon : chercher Alice dans la pioche puis la défausse Fatalité.
    const tp = next.players[pending.target]
    const alice = tp.fateDeck.find((c) => c.cardId === 'alice') ?? tp.fateDiscard.find((c) => c.cardId === 'alice')
    if (!alice) {
      return { ...next, log: [...next.log, `Chute dans le terrier : Alice est introuvable.`] }
    }
    next = updatePlayer(next, pending.target, (p) => ({
      ...p,
      fateDeck: p.fateDeck.filter((c) => c.instanceId !== alice.instanceId),
      fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== alice.instanceId),
    }))
    if (heroPlacementLocations(next, alice, pending.target).length === 0) {
      next = updatePlayer(next, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, alice] }))
      return { ...next, log: [...next.log, `Chute dans le terrier : aucun lieu pour Alice → défaussée.`] }
    }
    return {
      ...next,
      pendingHeroPlacement: { chooserIndex: state.activePlayer, targetIndex: pending.target, hero: alice },
      log: [...next.log, `Chute dans le terrier : ${state.players[state.activePlayer].villainName} place Alice.`],
    }
  }

  // Fallback (carte Fatalité non implémentée) : simple défausse.
  const next = updatePlayer(state, pending.target, (p) => ({
    ...p,
    fateDiscard: [...p.fateDiscard, chosen, ...others],
  }))
  return {
    ...next,
    pendingFate: null,
    log: [...next.log, `Fatalité « **${chosen.name}** » jouée sur ${tgt.villainName} (effet à venir).`],
  }
}

/** Déplace un Allié/Objet (et ses Objets associés) vers un lieu voisin via
 *  l'action « Déplacer un Allié/Objet ». */
function applyMoveCard(
  state: GameState,
  actionId: string,
  instanceId: string,
  to: string,
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de déplacer une carte en phase ${state.phase}.`)
  }
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)! // garanti par isActionAvailable
  const action = loc.actions.find((a) => a.id === actionId)!
  if (action.type !== 'MOVE_ITEM_ALLY') {
    throw new Error(`« ${actionId} » n'est pas une action « Déplacer un Allié/Objet ».`)
  }

  const me = activePlayer(state)
  const from = locationOfCard(me, instanceId)
  if (!from) throw new Error(`Carte « ${instanceId} » absente du plateau.`)
  if ((me.lockedLocations ?? []).includes(from)) {
    throw new Error(`Impossible de déplacer une carte depuis un lieu verrouillé.`)
  }
  const card = me.board[from].find((c) => c.instanceId === instanceId)!
  // Une Malédiction est traitée comme un Objet : elle est déplaçable.
  if (card.type !== 'ally' && card.type !== 'item' && card.type !== 'curse') {
    throw new Error(`Seuls les Alliés, Objets et Malédictions se déplacent (pas ${card.type}).`)
  }
  if (card.attachedTo) {
    throw new Error('Un Objet associé suit son Allié : déplacez l’Allié.')
  }
  if (!adjacentLocationIds(state, from).includes(to)) {
    throw new Error(`Lieu « ${to} » non voisin de « ${from} ».`)
  }

  // La carte + ses Objets associés (si c'est un Allié) se déplacent ensemble.
  const moving = me.board[from].filter(
    (c) => c.instanceId === instanceId || c.attachedTo === instanceId,
  )
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const destName = findLocation(me, to)!.name

  let next = updateActivePlayer(state, (p) => ({
    ...p,
    board: {
      ...p.board,
      [from]: p.board[from].filter((c) => !movingIds.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
  next = consumePersifleur(next, action)
  return {
    ...next,
    usedActionIds: [...next.usedActionIds, actionId],
    activeMovedCard: true, // déclencheur Sombres desseins
    log: [
      ...next.log,
      `${me.villainName} déplace **${card.name}**${moving.length > 1 ? ' (+ associé)' : ''} vers **${destName}**.`,
    ],
  }
}

/**
 * Action de lieu « Déplacer un Héros » : déplace un Héros du royaume du joueur
 * actif vers un lieu VOISIN de celui où il se trouve. Réutilise l'effet
 * MOVE_HERO_TO_LOCATION (restrictions de destination + arrivées) après contrôle
 * de l'adjacence.
 */
function applyMoveHero(
  state: GameState,
  actionId: string,
  heroInstanceId: string,
  to: LocationId,
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de déplacer un Héros en phase ${state.phase}.`)
  }
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)!
  // Inclut l'action accordée par l'Ingénieux Mécanisme (Déplacer un Héros).
  const action = locationActions(state, loc.id).find((a) => a.id === actionId)!
  if (action.type !== 'MOVE_HERO') {
    throw new Error(`« ${actionId} » n'est pas une action « Déplacer un Héros ».`)
  }
  const me = activePlayer(state)
  const from = locationOfCard(me, heroInstanceId)
  if (!from) throw new Error(`Héros « ${heroInstanceId} » introuvable dans votre royaume.`)
  if ((me.lockedLocations ?? []).includes(from)) {
    throw new Error(`Impossible de déplacer un Héros depuis un lieu verrouillé.`)
  }
  const hero = me.board[from].find((c) => c.instanceId === heroInstanceId)!
  if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
  if (!adjacentLocationIds(state, from).includes(to)) {
    throw new Error(`Lieu « ${to} » non voisin de « ${from} ».`)
  }
  let next = resolveEffects(state, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: to }], {
    targetHeroId: heroInstanceId,
  })
  next = consumePersifleur(next, action)
  return { ...next, usedActionIds: [...next.usedActionIds, actionId] }
}

/**
 * Action de lieu « Activer » (Jafar) : déclenche la capacité activée d'un
 * Allié/Objet du royaume (carte avec `activatedCost`). Le coût est prélevé, puis
 * la capacité est dispatchée par cardId.
 *
 *   - Iago : payez 1 Pouvoir, déplacez Iago (et un Objet non associé de son lieu)
 *     vers un lieu voisin non verrouillé.
 */
function applyActivate(
  state: GameState,
  actionId: string,
  cardInstanceId: string,
  to: LocationId | undefined,
  itemInstanceId: string | undefined,
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible d'activer en phase ${state.phase}.`)
  }
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)!
  const action = loc.actions.find((a) => a.id === actionId)!
  if (action.type !== 'ACTIVATE') {
    throw new Error(`« ${actionId} » n'est pas une action « Activer ».`)
  }
  const me = activePlayer(state)
  const cardLoc = locationOfCard(me, cardInstanceId)
  if (!cardLoc) throw new Error(`Carte « ${cardInstanceId} » absente du royaume.`)
  const card = me.board[cardLoc].find((c) => c.instanceId === cardInstanceId)!
  if (card.activatedCost === undefined) {
    throw new Error(`${card.name} n'a pas de capacité activée.`)
  }
  if (me.power < card.activatedCost) {
    throw new Error(`Pouvoir insuffisant pour activer ${card.name}.`)
  }

  if (card.cardId === 'iago') {
    if (!to) throw new Error('Iago : lieu de destination requis.')
    if (!adjacentLocationIds(state, cardLoc).includes(to)) {
      throw new Error(`Lieu « ${to} » non voisin (ou verrouillé) de « ${cardLoc} ».`)
    }
    // Iago + ses Objets associés, et éventuellement un Objet non associé choisi.
    const movingIds = new Set<string>([cardInstanceId])
    for (const c of me.board[cardLoc]) {
      if (c.attachedTo === cardInstanceId) movingIds.add(c.instanceId)
    }
    let itemName = ''
    if (itemInstanceId) {
      const item = me.board[cardLoc].find(
        (c) => c.instanceId === itemInstanceId && c.type === 'item' && !c.attachedTo,
      )
      if (!item) throw new Error('Objet à emmener invalide (non associé, sur le lieu d’Iago).')
      movingIds.add(item.instanceId)
      itemName = ` + **${item.name}**`
    }
    const moving = me.board[cardLoc].filter((c) => movingIds.has(c.instanceId))
    const destName = findLocation(me, to)!.name
    let next = updateActivePlayer(state, (p) => ({
      ...p,
      power: p.power - card.activatedCost!,
      board: {
        ...p.board,
        [cardLoc]: p.board[cardLoc].filter((c) => !movingIds.has(c.instanceId)),
        [to]: [...(p.board[to] ?? []), ...moving],
      },
    }))
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      activeMovedCard: true,
      log: [
        ...next.log,
        `${me.villainName} active **Iago**${itemName} → **${destName}** (−${card.activatedCost} JT).`,
      ],
    }
  }

  if (card.cardId === 'sceptre-serpent') {
    // Payez 1 : cherchez une carte Hypnose dans la défausse et ajoutez-la en main.
    const hypno = me.discard.find((c) => c.cardId === 'hypnose')
    let next = updateActivePlayer(state, (p) => ({
      ...p,
      power: p.power - card.activatedCost!,
      discard: hypno ? p.discard.filter((c) => c.instanceId !== hypno.instanceId) : p.discard,
      hand: hypno ? [...p.hand, hypno] : p.hand,
    }))
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [
        ...next.log,
        hypno
          ? `${me.villainName} active le **Sceptre Serpent** : récupère **${hypno.name}** en main (−${card.activatedCost} JT).`
          : `${me.villainName} active le **Sceptre Serpent** : aucune Hypnose en défausse (−${card.activatedCost} JT).`,
      ],
    }
  }

  if (card.cardId === 'sablier-geant') {
    // Jusqu'à la fin du tour, les Héros du lieu du Sablier ont −2 force.
    let next = updateActivePlayer(state, (p) => ({
      ...p,
      power: p.power - card.activatedCost!,
      board: {
        ...p.board,
        [cardLoc]: p.board[cardLoc].map((c) =>
          c.instanceId === cardInstanceId ? { ...c, activatedThisTurn: true } : c,
        ),
      },
    }))
    next = consumePersifleur(next, action)
    const locName = findLocation(me, cardLoc)!.name
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [
        ...next.log,
        `${me.villainName} active le **Sablier Géant** : Héros de **${locName}** −2 force jusqu'à la fin du tour.`,
      ],
    }
  }

  if (card.cardId.startsWith('gardes-')) {
    // Reine de Cœur : transforme une Carte Garde en arceau, ou la retransforme.
    const toWicket = !card.isWicket
    if (toWicket) {
      // Dodo : interdit de transformer en arceau les Gardes de son lieu.
      const dodoHere = (me.board[cardLoc] ?? []).some(
        (c) => c.type === 'hero' && c.cardId === 'dodo',
      )
      if (dodoHere) throw new Error('Dodo empêche de transformer ces Cartes Gardes en arceau.')
    }
    // Coût : 1, +1 si le Lapin Blanc est dans le royaume (Gardes → arceau seulement).
    const hasLapin = Object.values(me.board)
      .flat()
      .some((c) => c.type === 'hero' && c.cardId === 'lapin-blanc')
    const cost = (card.activatedCost ?? 1) + (toWicket && hasLapin ? 1 : 0)
    if (me.power < cost) {
      throw new Error(`Pouvoir insuffisant (coût ${cost}).`)
    }
    let next = updateActivePlayer(state, (p) => ({
      ...p,
      power: p.power - cost,
      board: {
        ...p.board,
        [cardLoc]: p.board[cardLoc].map((c) =>
          c.instanceId === cardInstanceId ? { ...c, isWicket: toWicket } : c,
        ),
      },
    }))
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [
        ...next.log,
        toWicket
          ? `${me.villainName} transforme **${card.name}** en arceau (−${cost} JT).`
          : `${me.villainName} retransforme un arceau en **${card.name}** (−${cost} JT).`,
      ],
    }
  }

  throw new Error(`Capacité activée non implémentée pour ${card.name}.`)
}

/** Wrapper Action VANQUISH : valide l'action puis exécute le Vanquish standard. */
function applyVanquish(
  state: GameState,
  actionId: string,
  heroInstanceId: string,
  allyInstanceIds: string[],
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible d'éliminer en phase ${state.phase}.`)
  }
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)!
  // Inclut l'action accordée par le Canon (Éliminer un héros).
  const action = locationActions(state, loc.id).find((a) => a.id === actionId)!
  if (action.type !== 'VANQUISH') {
    throw new Error(`« ${actionId} » n'est pas une action « Éliminer ».`)
  }
  let next = performVanquish(state, heroInstanceId, allyInstanceIds, false)
  next = consumePersifleur(next, action)
  return { ...next, usedActionIds: [...next.usedActionIds, actionId] }
}

/** Défausser un Déguisement Fatalité associé à un Héros du plateau du joueur
 *  actif (coût 2 JT, à tout moment durant son tour). */
function applyDiscardDeguisement(state: GameState, instanceId: string): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de défausser un Déguisement en phase ${state.phase}.`)
  }
  const me = activePlayer(state)
  if (me.power < 2) {
    throw new Error('Coût : 2 JT pour défausser le Déguisement.')
  }
  const loc = locationOfCard(me, instanceId)
  if (!loc) throw new Error('Déguisement introuvable sur votre plateau.')
  const card = (me.board[loc] ?? []).find((c) => c.instanceId === instanceId)
  if (!card || card.cardId !== 'deguisement') {
    throw new Error(`« ${instanceId} » n'est pas un Déguisement.`)
  }
  const next = updateActivePlayer(state, (p) => ({
    ...p,
    power: p.power - 2,
    board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => c.instanceId !== instanceId) },
    fateDiscard: [...p.fateDiscard, { ...card, attachedTo: undefined }],
  }))
  return {
    ...next,
    log: [...next.log, `${me.villainName} paie 2 JT pour défausser **${card.name}**.`],
  }
}

/** Une vraie action de LIEU a-t-elle déjà été jouée ce tour ? (Les marqueurs de
 *  déplacement gratuit Diablo/Shérif ne comptent pas comme des actions.) */
function locationActionTaken(state: GameState): boolean {
  return state.usedActionIds.some(
    (id) => !id.startsWith('diablo-move:') && !id.startsWith('sheriff-move:'),
  )
}

/** Déplacement gratuit de Diablo (1×/tour) : autorisé tant que le joueur n'a pas
 *  encore fait sa première action de lieu du tour — donc en phase MOVE, ou en
 *  début de phase ACTION avant toute action. Arme ensuite l'action gratuite (V2). */
function applyDiabloMove(state: GameState, instanceId: string, to: string): GameState {
  const allowed = state.phase === 'MOVE' || (state.phase === 'ACTION' && !locationActionTaken(state))
  if (!allowed) {
    throw new Error('Diablo se déplace avant ta première action du tour.')
  }
  const me = activePlayer(state)
  const from = locationOfCard(me, instanceId)
  if (!from) throw new Error(`Diablo « ${instanceId} » introuvable.`)
  const card = (me.board[from] ?? []).find((c) => c.instanceId === instanceId)!
  if (card.cardId !== 'diablo') {
    throw new Error(`« ${card.name} » n'est pas Diablo.`)
  }
  if (from === to) throw new Error('Diablo est déjà sur ce lieu.')
  if (!findLocation(me, to)) throw new Error(`Lieu inconnu : « ${to} ».`)
  const usedKey = `diablo-move:${instanceId}`
  if (state.usedActionIds.includes(usedKey)) {
    throw new Error('Diablo a déjà été déplacé ce tour.')
  }
  const moving = (me.board[from] ?? []).filter(
    (c) => c.instanceId === instanceId || c.attachedTo === instanceId,
  )
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const destName = findLocation(me, to)!.name
  const next = updateActivePlayer(state, (p) => ({
    ...p,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
  return {
    ...next,
    usedActionIds: [...next.usedActionIds, usedKey],
    // Arme l'action gratuite (V2) au nouveau lieu de Diablo.
    diabloFree: { instanceId, locationId: to },
    log: [
      ...next.log,
      `${me.villainName} déplace **${card.name}** vers **${destName}** (action gratuite disponible).`,
    ],
  }
}

/**
 * Diablo (V2) : exécute UNE action disponible du lieu où se trouve Diablo, sans
 * déplacer le pion ni consommer les actions du lieu courant. On construit une
 * « vue » de l'état où le pion est temporairement au lieu de Diablo (slots
 * d'actions remis à zéro), on délègue à applyAction (qui valide la disponibilité
 * au bon lieu), puis on restaure le lieu/les slots réels du pion. L'action
 * Fatalité est exclue par le type de l'argument.
 */
function applyDiabloFreeAction(
  state: GameState,
  inner: Extract<
    GameAction,
    { type: 'EXECUTE_ACTION' | 'PLAY_CARD' | 'DISCARD_CARDS' | 'MOVE_CARD' | 'VANQUISH' }
  >,
): GameState {
  const free = state.diabloFree
  if (!free) throw new Error("Aucune action gratuite de Diablo n'est disponible.")
  const realPawn = activePlayer(state).pawnLocation
  const realUsed = state.usedActionIds
  const realPersifleur = state.persifleurAvailable
  const realPhase = state.phase
  // Vue : pion au lieu de Diablo, slots d'actions vierges, phase ACTION.
  let view = updateActivePlayer(state, (p) => ({ ...p, pawnLocation: free.locationId }))
  view = {
    ...view,
    phase: 'ACTION',
    usedActionIds: [],
    persifleurAvailable: false,
    diabloFree: null,
  }
  let after = applyAction(view, inner)
  // Restaure le contexte de tour réel : le pion n'a pas bougé, l'action gratuite
  // ne consomme pas les slots du lieu courant.
  after = updateActivePlayer(after, (p) => ({ ...p, pawnLocation: realPawn }))
  return {
    ...after,
    phase: realPhase,
    usedActionIds: realUsed,
    persifleurAvailable: realPersifleur,
    diabloFree: null,
    log: [...after.log, `(action gratuite de Diablo)`],
  }
}

/** Diablo (V2) : décline l'action gratuite armée. */
function applyDiabloSkipFreeAction(state: GameState): GameState {
  if (!state.diabloFree) return state
  return { ...state, diabloFree: null }
}

/** Tendre un Piège : exécute l'action Éliminer un Héros facultative. */
function applyTrapVanquish(
  state: GameState,
  heroInstanceId: string,
  allyInstanceIds: string[],
): GameState {
  if (!state.pendingTrapVanquish) {
    throw new Error("Aucune élimination de Tendre un Piège en attente.")
  }
  let next = performVanquish(state, heroInstanceId, allyInstanceIds, false)
  // Showcase de la carte différé : il apparaît une fois la séquence terminée.
  next = pushShowcase(next, 'tendre-piege', `Joué par ${activePlayer(next).villainName}`, next.activePlayer)
  return { ...next, pendingTrapVanquish: false }
}

/** Tendre un Piège : termine sans éliminer de Héros. */
function applyTrapSkipVanquish(state: GameState): GameState {
  if (!state.pendingTrapVanquish) return state
  const next = pushShowcase(state, 'tendre-piege', `Joué par ${activePlayer(state).villainName}`, state.activePlayer)
  return { ...next, pendingTrapVanquish: false }
}

/** Déplacement gratuit du Shérif de Nottingham (1×/tour par Shérif), bonus
 *  +1 JT si un Héros se trouve sur la destination. */
function applySheriffMove(state: GameState, instanceId: string, to: string): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de déplacer le Shérif en phase ${state.phase}.`)
  }
  const me = activePlayer(state)
  const from = locationOfCard(me, instanceId)
  if (!from) throw new Error(`Shérif « ${instanceId} » introuvable.`)
  const card = (me.board[from] ?? []).find((c) => c.instanceId === instanceId)!
  if (card.cardId !== 'sherif-nottingham') {
    throw new Error(`« ${card.name} » n'est pas un Shérif de Nottingham.`)
  }
  if (from === to) {
    throw new Error(`${card.name} est déjà sur ce lieu.`)
  }
  if (!findLocation(me, to)) throw new Error(`Lieu inconnu : « ${to} ».`)
  const usedKey = `sheriff-move:${instanceId}`
  if (state.usedActionIds.includes(usedKey)) {
    throw new Error(`${card.name} a déjà été déplacé(e) ce tour.`)
  }
  // Objets associés au Shérif suivent.
  const moving = (me.board[from] ?? []).filter(
    (c) => c.instanceId === instanceId || c.attachedTo === instanceId,
  )
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const heroPresent = (me.board[to] ?? []).some((c) => c.type === 'hero')
  const bonus = heroPresent ? 1 : 0
  const destName = findLocation(me, to)!.name
  const next = updateActivePlayer(state, (p) => ({
    ...p,
    power: p.power + bonus,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
  return {
    ...next,
    usedActionIds: [...next.usedActionIds, usedKey],
    log: [
      ...next.log,
      `${me.villainName} déplace **${card.name}** vers **${destName}**${bonus ? ' (+1 JT, Héros présent)' : ''}.`,
    ],
  }
}

/** Joue une Condition pendant le tour d'un adversaire (Avarice, Lâcheté).
 *  La carte est retirée de la main du joueur et envoyée en défausse. Pas de
 *  repioche (seul l'actif repioche en fin de son tour). */
function applyPlayCondition(
  state: GameState,
  playerIndex: number,
  instanceId: string,
  allyInstanceId?: string,
  to?: string,
  attachTo?: string,
): GameState {
  if (playerIndex === state.activePlayer) {
    throw new Error("Une Condition se joue pendant le tour d'un adversaire.")
  }
  const player = state.players[playerIndex]
  const card = player.hand.find((c) => c.instanceId === instanceId)
  if (!card) throw new Error(`Carte « ${instanceId} » absente de la main.`)
  if (card.type !== 'condition') throw new Error(`${card.name} n'est pas une Condition.`)
  if (!conditionIsTriggered(state, card, playerIndex)) {
    throw new Error(`${card.name} : condition non satisfaite.`)
  }
  // Retire la carte de la main (vers la défausse à la fin, ou via un effet
  // spécifique si la mécanique l'exige plus tard).
  let next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    discard: [...p.discard, card],
  }))
  next = {
    ...next,
    log: [...next.log, `${player.villainName} joue la Condition **${card.name}**.`],
  }
  next = pushShowcase(next, card.cardId, `Réaction de ${player.villainName}`, playerIndex)
  const scIdx = next.showcaseEvents.length - 1

  // Effet par cardId (résolution partagée avec le MODE TEST), en mesurant le gain.
  const powerBefore = next.players[playerIndex].power
  next = resolveConditionEffect(next, playerIndex, card, allyInstanceId, to, attachTo)
  return annotateShowcaseGain(next, scIdx, next.players[playerIndex].power - powerBefore)
}

/**
 * Résout l'EFFET d'une Condition déjà « jouée » (carte en défausse, showcase
 * poussé) pour le joueur `playerIndex`. Séparé d'applyPlayCondition pour être
 * réutilisé par le MODE TEST (qui contourne main / déclencheur / joueur-actif).
 */
function resolveConditionEffect(
  state: GameState,
  playerIndex: number,
  card: CardInstance,
  allyInstanceId?: string,
  to?: string,
  attachTo?: string,
): GameState {
  const player = state.players[playerIndex]
  let next = state
  if (card.cardId === 'avarice') {
    next = updatePlayer(next, playerIndex, (p) => ({ ...p, power: p.power + 3 }))
    return {
      ...next,
      log: [
        ...next.log,
        `${player.villainName} gagne 3 JT (total : ${next.players[playerIndex].power}).`,
      ],
    }
  }
  if (card.cardId === 'lachete') {
    // Lâcheté : pose un Allié gratuitement chez le joueur.
    if (!allyInstanceId) throw new Error('Lâcheté : précisez l\'Allié à poser.')
    if (!to) throw new Error('Lâcheté : précisez le lieu de pose.')
    const acting = next.players[playerIndex]
    const ally = acting.hand.find((c) => c.instanceId === allyInstanceId)
    if (!ally) throw new Error(`Allié « ${allyInstanceId} » absent de la main.`)
    if (ally.type !== 'ally') throw new Error(`${ally.name} n'est pas un Allié.`)
    if (!acting.locations.some((l) => l.id === to)) {
      throw new Error(`Lieu de destination invalide : « ${to} ».`)
    }
    // Associations (Objet→Allié) ne s'appliquent pas ici (on pose un Allié).
    if (attachTo !== undefined) {
      throw new Error(`${ally.name} ne s'associe pas à un Allié.`)
    }
    next = updatePlayer(next, playerIndex, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== allyInstanceId),
      board: { ...p.board, [to]: [...(p.board[to] ?? []), ally] },
    }))
    next = {
      ...next,
      log: [
        ...next.log,
        `${player.villainName} pose gratuitement **${ally.name}** sur **${to}**.`,
      ],
    }
    // Une Malédiction Sommeil sans Rêves se défausse aussi quand un Allié arrive
    // via Lâcheté (cohérence avec la pose normale).
    return processCurseDiscards(next, playerIndex, to, 'ally-played-here')
  }
  if (card.cardId === 'tyrannie') {
    // Tyrannie : pioche 3, PUIS le joueur choisit 3 cartes à défausser. La
    // pioche est immédiate ; la défausse devient une étape interactive en
    // attente (`pendingTyrannyDiscard`) résolue par RESOLVE_TYRANNY_DISCARD
    // (UI pour l'humain, auto pour le bot).
    const draw3 = drawPlayerToLimitN(next.players[playerIndex], next.rngState, 3)
    next = {
      ...next,
      rngState: draw3.rngState,
      players: next.players.map((p, i) => (i === playerIndex ? draw3.player : p)),
      log: [
        ...next.log,
        `${player.villainName} pioche ${draw3.drawn} carte${draw3.drawn > 1 ? 's' : ''} (Tyrannie).`,
      ],
    }
    // Anim : les cartes piochées « affluent » de la pioche vers la main.
    if (draw3.drawn > 0) {
      next = pushFloatingFx(next, { kind: 'tyranny-draw', playerIndex, count: draw3.drawn })
    }
    // Combien défausser : 3, ou moins si la main est plus petite (cas limite).
    const discardCount = Math.min(3, next.players[playerIndex].hand.length)
    if (discardCount === 0) return next
    return { ...next, pendingTyrannyDiscard: { playerIndex, count: discardCount } }
  }
  if (card.cardId === 'mechancete') {
    // Méchanceté : vaincre instantanément un Héros ≤4 force dans le ROYAUME du
    // joueur qui joue la Condition. Le héros cible est fourni par allyInstanceId
    // (réutilisé pour le ciblage héros). Si rien fourni, auto-pick le 1ᵉʳ valide.
    const acting = next.players[playerIndex]
    const heroes = Object.values(acting.board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 4)
    if (heroes.length === 0) {
      return { ...next, log: [...next.log, 'Méchanceté : aucun Héros éligible.'] }
    }
    const target = allyInstanceId
      ? heroes.find((h) => h.instanceId === allyInstanceId) ?? heroes[0]
      : heroes[0]
    return resolveEffectsLocal(next, [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 4 }], {
      actorIndex: playerIndex,
      targetHeroId: target.instanceId,
    })
  }
  if (card.cardId === 'sombres-desseins') {
    // Éliminer instantanément un Héros du royaume du joueur (le plus fort par
    // défaut, ou la cible fournie via allyInstanceId). Sans allié, sans limite.
    const acting = next.players[playerIndex]
    const heroes = Object.values(acting.board).flat().filter((c) => c.type === 'hero')
    if (heroes.length === 0) {
      return { ...next, log: [...next.log, 'Sombres desseins : aucun Héros à éliminer.'] }
    }
    const target = allyInstanceId
      ? heroes.find((h) => h.instanceId === allyInstanceId) ?? heroes[0]
      : [...heroes].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
    return resolveEffectsLocal(next, [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: Number.MAX_SAFE_INTEGER }], {
      actorIndex: playerIndex,
      targetHeroId: target.instanceId,
    })
  }
  if (card.cardId === 'sans-visage') {
    // Récupère une carte de la défausse en main (priorité à une Page, sinon la
    // dernière défaussée).
    const acting = next.players[playerIndex]
    if (acting.discard.length === 0) {
      return { ...next, log: [...next.log, 'Sans visage : défausse vide.'] }
    }
    const pageIdx = acting.discard.findIndex((c) => c.cardId === 'page')
    const pick = pageIdx >= 0 ? acting.discard[pageIdx] : acting.discard[acting.discard.length - 1]
    next = updatePlayer(next, playerIndex, (p) => ({
      ...p,
      discard: p.discard.filter((c) => c.instanceId !== pick.instanceId),
      hand: [...p.hand, pick],
    }))
    return {
      ...next,
      log: [...next.log, `${player.villainName} récupère **${pick.name}** de sa défausse (Sans visage).`],
    }
  }
  if (card.cardId === 'manipulation') {
    // Manipulation (Jafar) : le joueur choisit une carte de sa défausse à reprendre
    // en main (RESOLVE_MANIPULATION). La carte Manipulation vient d'arriver en
    // défausse — on l'exclut du choix (on ne se reprend pas soi-même).
    const acting = next.players[playerIndex]
    const choosable = acting.discard.filter((c) => c.instanceId !== card.instanceId)
    if (choosable.length === 0) {
      return { ...next, log: [...next.log, 'Manipulation : défausse vide.'] }
    }
    return { ...next, pendingManipulation: { playerIndex } }
  }
  if (card.cardId === 'tromperie') {
    // Tromperie (Jafar) : dévoile la 1ʳᵉ carte Fatalité de l'ADVERSAIRE (joueur
    // actif) et la joue immédiatement CONTRE lui. Héros → posé sur son plateau
    // (1ᵉʳ lieu valide) ; non-Héros → non géré pour l'instant (remis en défausse).
    const oppIdx = state.activePlayer
    const opp = next.players[oppIdx]
    if (opp.fateDeck.length === 0 && opp.fateDiscard.length === 0) {
      return { ...next, log: [...next.log, 'Tromperie : pioche Fatalité adverse vide.'] }
    }
    const r = revealFate(opp, 1, next.rngState)
    next = { ...updatePlayer(next, oppIdx, () => r.player), rngState: r.rngState }
    const revealed = r.revealed[0]
    if (!revealed) return next
    if (revealed.type === 'hero') {
      const locs = heroPlacementLocations(next, revealed, oppIdx)
      if (locs.length === 0) {
        next = updatePlayer(next, oppIdx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, revealed] }))
        return { ...next, log: [...next.log, `Tromperie : **${revealed.name}** révélé, aucun lieu valide → défaussé.`] }
      }
      // Le joueur qui a joué Tromperie choisit où poser le Héros (RESOLVE_HERO_PLACEMENT).
      return {
        ...next,
        pendingHeroPlacement: { chooserIndex: playerIndex, targetIndex: oppIdx, hero: revealed },
        log: [
          ...next.log,
          `${player.villainName} dévoile **${revealed.name}** (Tromperie) — à placer chez ${next.players[oppIdx].villainName}.`,
        ],
      }
    }
    next = updatePlayer(next, oppIdx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, revealed] }))
    return {
      ...next,
      log: [...next.log, `Tromperie : **${revealed.name}** (non-Héros) — effet non encore géré, défaussé.`],
    }
  }
  if (card.cardId === 'obsession') {
    // Obsession (Crochet) : dévoile son propre deck Fatalité jusqu'à un Héros et
    // le joue dans son royaume.
    return resolveEffectsLocal(next, [{ type: 'REVEAL_OWN_FATE_PLAY_HERO' }], { actorIndex: playerIndex })
  }
  if (card.cardId === 'ruse') {
    // Ruse (Crochet) : joue gratuitement un Allié de la main (comme Lâcheté).
    if (!allyInstanceId) throw new Error('Ruse : précisez l’Allié à poser.')
    if (!to) throw new Error('Ruse : précisez le lieu de pose.')
    const acting = next.players[playerIndex]
    const a = acting.hand.find((c) => c.instanceId === allyInstanceId)
    if (!a) throw new Error(`Allié « ${allyInstanceId} » absent de la main.`)
    if (a.type !== 'ally') throw new Error(`${a.name} n'est pas un Allié.`)
    if (!acting.locations.some((l) => l.id === to)) throw new Error(`Lieu invalide : « ${to} ».`)
    if (attachTo !== undefined) throw new Error(`${a.name} ne s'associe pas à un Allié.`)
    next = updatePlayer(next, playerIndex, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== allyInstanceId),
      board: { ...p.board, [to]: [...(p.board[to] ?? []), a] },
    }))
    next = { ...next, log: [...next.log, `${player.villainName} joue gratuitement **${a.name}** (Ruse).`] }
    return processCurseDiscards(next, playerIndex, to, 'ally-played-here')
  }
  // Aucune autre Condition pour l'instant.
  return next
}

/**
 * Résout la défausse de Tyrannie en attente : envoie les cartes choisies
 * (`instanceIds`) de la main du joueur en attente vers sa défausse, pousse le
 * showcase « défausse volontaire », puis lève `pendingTyrannyDiscard`.
 */
function applyResolveTyrannyDiscard(state: GameState, instanceIds: string[]): GameState {
  const pending = state.pendingTyrannyDiscard
  if (!pending) throw new Error('Aucune défausse de Tyrannie en attente.')
  const { playerIndex, count } = pending
  const player = state.players[playerIndex]
  const expected = Math.min(count, player.hand.length)
  if (instanceIds.length !== expected) {
    throw new Error(`Tyrannie : il faut défausser exactement ${expected} carte(s).`)
  }
  const idSet = new Set(instanceIds)
  const toDiscard = player.hand.filter((c) => idSet.has(c.instanceId))
  if (toDiscard.length !== instanceIds.length) {
    throw new Error('Tyrannie : carte à défausser absente de la main.')
  }
  let next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    hand: p.hand.filter((c) => !idSet.has(c.instanceId)),
    discard: [...p.discard, ...toDiscard],
  }))
  next = {
    ...next,
    pendingTyrannyDiscard: undefined,
    log: [
      ...next.log,
      `${player.villainName} défausse ${toDiscard.length} carte${toDiscard.length > 1 ? 's' : ''} (Tyrannie).`,
    ],
  }
  return pushDiscardShowcase(
    next,
    toDiscard.map((c) => c.cardId),
    `${player.villainName} défausse ${toDiscard.length} carte${toDiscard.length > 1 ? 's' : ''} (Tyrannie)`,
    playerIndex,
    'dark',
    'bottom',
  )
}

/**
 * Aurore : pose le Héros révélé en attente (`pendingHeroPlacement`) sur le lieu
 * choisi par le joueur qui a joué la Fatalité. Réutilise placeFateHeroWithEffects
 * (showcase « vol », effets à la pose, arrivées). Lève l'état en attente.
 */
function applyResolveHeroPlacement(state: GameState, locationId: LocationId): GameState {
  const pending = state.pendingHeroPlacement
  if (!pending) throw new Error('Aucun placement de Héros en attente.')
  const { chooserIndex, targetIndex, hero } = pending
  if (!heroPlacementLocations(state, hero, targetIndex).includes(locationId)) {
    throw new Error(`${hero.name} ne peut pas être posé sur ce lieu.`)
  }
  const destName = findLocation(state.players[targetIndex], locationId)?.name ?? locationId
  const next = { ...state, pendingHeroPlacement: undefined }
  return placeFateHeroWithEffects(next, targetIndex, chooserIndex, hero, locationId, destName)
}

/**
 * Roi Stéphane : déplace (ou non) le pion de la cible vers `locationId`. `null`
 * ou le lieu courant = on ne déplace pas (l'effet est optionnel). Un vrai
 * déplacement déclenche les Malédictions 'pawn-moves-here' (Feu Infernal).
 */
function applyResolvePawnMove(state: GameState, locationId: LocationId | null): GameState {
  const pending = state.pendingPawnMove
  if (!pending) throw new Error('Aucun déplacement de pion en attente.')
  const { targetIndex } = pending
  const target = state.players[targetIndex]
  let next: GameState = { ...state, pendingPawnMove: undefined }
  if (locationId === null || locationId === target.pawnLocation) {
    return { ...next, log: [...next.log, `${target.villainName} n'est pas déplacé (Roi Stéphane).`] }
  }
  if (!findLocation(target, locationId)) throw new Error(`Lieu inconnu : « ${locationId} ».`)
  const destName = findLocation(target, locationId)!.name
  next = updatePlayer(next, targetIndex, (p) => ({ ...p, pawnLocation: locationId }))
  next = {
    ...next,
    log: [...next.log, `Roi Stéphane déplace ${target.villainName} vers **${destName}**.`],
  }
  return processCurseDiscards(next, targetIndex, locationId, 'pawn-moves-here')
}

/**
 * Roi Hubert : déplace les Alliés choisis (≤1 par lieu voisin du lieu de Hubert)
 * vers ce lieu, sur le plateau de la cible. Les Objets associés suivent.
 */
function applyResolveHubertPull(state: GameState, allyInstanceIds: string[]): GameState {
  const pending = state.pendingHubertPull
  if (!pending) throw new Error('Aucun appel de Roi Hubert en attente.')
  const { targetIndex, dest } = pending
  const target = state.players[targetIndex]
  const adj = new Set(adjacentLocationIds(state, dest))
  const moving: CardInstance[] = []
  const fromSeen = new Set<string>()
  for (const id of allyInstanceIds) {
    const from = locationOfCard(target, id)
    if (!from || !adj.has(from)) throw new Error('Roi Hubert : Allié hors d’un lieu voisin.')
    const ally = (target.board[from] ?? []).find((c) => c.instanceId === id && c.type === 'ally')
    if (!ally) throw new Error('Roi Hubert : Allié introuvable.')
    if (fromSeen.has(from)) throw new Error('Roi Hubert : un seul Allié par lieu voisin.')
    fromSeen.add(from)
    const attached = (target.board[from] ?? []).filter((c) => c.attachedTo === id)
    moving.push(ally, ...attached)
  }
  let next: GameState = { ...state, pendingHubertPull: undefined }
  if (moving.length === 0) {
    return { ...next, log: [...next.log, 'Roi Hubert : aucun Allié déplacé.'] }
  }
  const movingIds = new Set(moving.map((c) => c.instanceId))
  next = updatePlayer(next, targetIndex, (p) => {
    const board: PlayerState['board'] = {}
    for (const [loc, cards] of Object.entries(p.board)) {
      board[loc] = cards.filter((c) => !movingIds.has(c.instanceId))
    }
    board[dest] = [...(board[dest] ?? []), ...moving]
    return { ...p, board }
  })
  const n = fromSeen.size
  return {
    ...next,
    log: [...next.log, `Roi Hubert attire ${n} Allié${n > 1 ? 's' : ''} sur **${dest}**.`],
  }
}

/**
 * Apparition / Vent de panique : déplace le Héros choisi (du royaume de
 * `targetIndex`) vers un lieu VOISIN de sa position. Réutilise l'effet
 * MOVE_HERO_TO_LOCATION (restrictions + arrivées) après contrôle d'adjacence.
 */
function applyResolveHeroRelocate(state: GameState, heroInstanceId: string, to: LocationId): GameState {
  const pending = state.pendingHeroRelocate
  if (!pending) throw new Error('Aucun déplacement de Héros en attente.')
  const { targetIndex } = pending
  const target = state.players[targetIndex]
  const from = locationOfCard(target, heroInstanceId)
  if (!from) throw new Error(`Héros « ${heroInstanceId} » introuvable.`)
  const hero = (target.board[from] ?? []).find((c) => c.instanceId === heroInstanceId)
  if (!hero || hero.type !== 'hero') throw new Error('Cible invalide (pas un Héros).')
  // Adjacence dans le royaume de la CIBLE (pas forcément le joueur actif).
  const ids = target.locations.map((l) => l.id)
  const i = ids.indexOf(from)
  const adj = [ids[i - 1], ids[i + 1]].filter(Boolean) as string[]
  if (!adj.includes(to)) throw new Error(`Lieu « ${to} » non voisin de « ${from} ».`)
  const next = resolveEffects(state, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: to }], {
    actorIndex: targetIndex,
    targetHeroId: heroInstanceId,
  })
  return { ...next, pendingHeroRelocate: null }
}

/**
 * Téléportation : déplace le pion du joueur en attente vers le lieu choisi (qui
 * porte un Héros sans Lampe de poche). Le joueur joue ensuite normalement.
 */
function applyResolveTeleport(state: GameState, to: LocationId): GameState {
  const pending = state.pendingTeleport
  if (!pending) throw new Error('Aucune téléportation en attente.')
  const player = state.players[pending.playerIndex]
  if (!teleportTargets(player).includes(to)) {
    throw new Error(`Téléportation impossible vers « ${to} » (pas de Héros accessible).`)
  }
  const destName = findLocation(player, to)?.name ?? to
  let next = updatePlayer(state, pending.playerIndex, (p) => ({ ...p, pawnLocation: to }))
  next = {
    ...next,
    pendingTeleport: null,
    log: [...next.log, `${player.villainName} se téléporte sur **${destName}** (Téléportation).`],
  }
  // Arrivée du pion : Malédictions 'pawn-moves-here' (générique).
  return processCurseDiscards(next, pending.playerIndex, to, 'pawn-moves-here')
}

/**
 * Retourne-toi : résout le choix sur la carte révélée (`pendingDeckPeek`).
 *   keep = true  → ajoute la dernière carte de la pioche à la main.
 *   keep = false → remélange la pioche, puis pioche la première carte.
 */
function applyResolveDeckPeek(state: GameState, keep: boolean): GameState {
  const pending = state.pendingDeckPeek
  if (!pending) throw new Error('Aucune carte révélée à résoudre (Retourne-toi).')
  const { playerIndex, card } = pending
  const player = state.players[playerIndex]
  if (keep) {
    const next = updatePlayer(state, playerIndex, (p) => ({
      ...p,
      deck: p.deck.filter((c) => c.instanceId !== card.instanceId),
      hand: [...p.hand, card],
    }))
    return {
      ...next,
      pendingDeckPeek: null,
      activeDrewCard: true,
      log: [...next.log, `${player.villainName} ajoute **${card.name}** à sa main (Retourne-toi).`],
    }
  }
  // Remélange la pioche entière puis pioche la première carte.
  const r = shuffle([...player.deck], state.rngState)
  const [top, ...rest] = r.result
  const next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    deck: rest,
    hand: top ? [...p.hand, top] : p.hand,
  }))
  return {
    ...next,
    rngState: r.state,
    pendingDeckPeek: null,
    activeDrewCard: !!top,
    log: [
      ...next.log,
      `${player.villainName} remélange sa pioche${top ? ` et pioche **${top.name}**` : ''} (Retourne-toi).`,
    ],
  }
}

/**
 * Tombée de la nuit : dévoile les `count` premières cartes de la pioche du joueur
 * en attente, ajoute la 1ʳᵉ du type choisi (`cardType`) à sa main et défausse les
 * autres. Si la pioche est trop courte, remélange d'abord la défausse dedans.
 */
function applyResolveTypeChoice(state: GameState, cardType: CardType): GameState {
  const pending = state.pendingTypeChoice
  if (!pending) throw new Error('Aucun choix de type en attente.')
  const { playerIndex, count, untilFound } = pending
  const player = state.players[playerIndex]
  const flavour = untilFound ? 'Prédiction' : 'Tombée de la nuit'
  const TYPE_LABELS: Record<string, string> = {
    item: 'Objet',
    effect: 'Événement',
    ally: 'Allié',
    condition: 'Condition',
    hero: 'Héros',
    curse: 'Malédiction',
  }
  const typeLabel = TYPE_LABELS[cardType] ?? cardType
  let deck = [...player.deck]
  let discardPile = [...player.discard]
  let rngState = state.rngState

  if (untilFound) {
    // Prédiction : dévoiler la pioche JUSQU'À trouver une carte du type choisi.
    // On remélange la défausse si la pioche se vide en cours de route.
    const revealed: CardInstance[] = []
    let found: CardInstance | undefined
    while (true) {
      if (deck.length === 0) {
        if (discardPile.length === 0) break
        const r = shuffle(discardPile, rngState)
        deck = r.result
        discardPile = []
        rngState = r.state
      }
      const [top, ...restDeck] = deck
      deck = restDeck
      if (top.type === cardType) {
        found = top
        break
      }
      revealed.push(top)
    }
    let next = updatePlayer(state, playerIndex, (p) => ({
      ...p,
      deck,
      hand: found ? [...p.hand, found] : p.hand,
      discard: [...discardPile, ...revealed],
    }))
    next = {
      ...next,
      rngState,
      pendingTypeChoice: null,
      activeDrewCard: !!found,
      log: [
        ...next.log,
        found
          ? `${player.villainName} dévoile ${revealed.length + 1} carte${revealed.length + 1 > 1 ? 's' : ''}, garde **${found.name}** (${typeLabel}) et défausse les autres (${flavour}).`
          : `${player.villainName} : aucun ${typeLabel} dans la pioche (${flavour}).`,
      ],
    }
    if (revealed.length > 0) {
      next = pushDiscardShowcase(
        next,
        revealed.map((c) => c.cardId),
        `${flavour} : ${revealed.length} carte${revealed.length > 1 ? 's' : ''} défaussée${revealed.length > 1 ? 's' : ''}`,
        playerIndex,
        'dark',
        'bottom',
      )
    }
    // Montre ensuite la carte ajoutée à la main (après les cartes défaussées).
    if (found) {
      next = pushShowcase(next, found.cardId, `${found.name} ajouté à votre main`, playerIndex)
    }
    return next
  }

  // Pas assez de cartes pour dévoiler `count` : remélanger la défausse dans la pioche.
  if (deck.length < count && discardPile.length > 0) {
    const r = shuffle(discardPile, rngState)
    deck = [...deck, ...r.result]
    discardPile = []
    rngState = r.state
  }
  const revealed = deck.slice(0, count)
  const rest = deck.slice(count)
  const matchIdx = revealed.findIndex((c) => c.type === cardType)
  const toHand = matchIdx >= 0 ? revealed[matchIdx] : undefined
  const others = revealed.filter((_, i) => i !== matchIdx)
  let next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    deck: rest,
    hand: toHand ? [...p.hand, toHand] : p.hand,
    discard: [...discardPile, ...others],
  }))
  next = {
    ...next,
    rngState,
    pendingTypeChoice: null,
    activeDrewCard: !!toHand,
    log: [
      ...next.log,
      toHand
        ? `${player.villainName} dévoile ${revealed.length} cartes, garde **${toHand.name}** (${typeLabel}) et défausse les autres (Tombée de la nuit).`
        : `${player.villainName} dévoile ${revealed.length} cartes : aucun ${typeLabel}, tout est défaussé (Tombée de la nuit).`,
    ],
  }
  // Showcase « défausse » des cartes écartées (visible côté adversaire).
  if (others.length > 0) {
    next = pushDiscardShowcase(
      next,
      others.map((c) => c.cardId),
      `Tombée de la nuit : ${others.length} carte${others.length > 1 ? 's' : ''} défaussée${others.length > 1 ? 's' : ''}`,
      playerIndex,
      'dark',
      'bottom',
    )
  }
  return next
}

/** MODE TEST : joue une Condition (déjà construite) pour le joueur actif, en
 *  contournant le déclencheur et la restriction « tour de l'adversaire ».
 *  Auto-résout les cibles (Lâcheté : 1ᵉʳ Allié en main ; Méchanceté : 1ᵉʳ Héros
 *  ≤4 du royaume). Déclenche l'effet + le showcase, comme une vraie réaction. */
function applyTestPlayCondition(
  state: GameState,
  card: CardInstance,
  chosenAllyId?: string,
  chosenTo?: string,
): GameState {
  const idx = state.activePlayer
  const player = state.players[idx]
  if (card.type !== 'condition') throw new Error(`${card.name} n'est pas une Condition.`)
  let allyInstanceId: string | undefined
  let to: string | undefined
  if (card.cardId === 'lachete') {
    // Allié/lieu choisis par l'UI si fournis, sinon auto-sélection (1ᵉʳ Allié, 1ᵉʳ lieu).
    const ally = chosenAllyId
      ? player.hand.find((c) => c.instanceId === chosenAllyId && c.type === 'ally')
      : player.hand.find((c) => c.type === 'ally')
    if (!ally) throw new Error('Lâcheté (test) : ajoute d\'abord un Allié dans ta main.')
    allyInstanceId = ally.instanceId
    to = chosenTo ?? player.locations[0]?.id
  }
  if (card.cardId === 'mechancete') {
    // Héros choisi par l'UI si fourni (et éligible ≤4), sinon le 1ᵉʳ éligible.
    const eligible = Object.values(player.board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 4)
    const hero = chosenAllyId ? eligible.find((c) => c.instanceId === chosenAllyId) ?? eligible[0] : eligible[0]
    if (!hero) throw new Error('Méchanceté (test) : place d\'abord un Héros (force ≤4) dans ton royaume.')
    allyInstanceId = hero.instanceId
  }
  let next = {
    ...state,
    log: [...state.log, `${player.villainName} joue la Condition **${card.name}** (test).`],
  }
  next = pushShowcase(next, card.cardId, `Test : ${player.villainName}`, idx)
  const scIdx = next.showcaseEvents.length - 1
  next = updatePlayer(next, idx, (p) => ({ ...p, discard: [...p.discard, card] }))
  const powerBefore = next.players[idx].power
  next = resolveConditionEffect(next, idx, card, allyInstanceId, to)
  return annotateShowcaseGain(next, scIdx, next.players[idx].power - powerBefore)
}

/**
 * MODE TEST : joue une carte Fatalité non-Héros CONTRE le joueur actif —
 * ciblant l'un de ses Héros (Voler aux Riches, Déguisement, Épée de Vérité) ou
 * sans cible (Il était un Rêve). Réutilise les mêmes helpers qu'en partie, en
 * contournant le tirage/`pendingFate`. Pousse un showcase pour la rendre visible.
 */
function applyTestPlayFateCard(
  state: GameState,
  card: CardInstance,
  targetHeroId?: string,
  enlargeToward?: string,
): GameState {
  const idx = state.activePlayer
  let next = pushShowcase(state, card.cardId, `Test : ${state.players[idx].villainName}`, idx)
  // Une Fatalité infligée déclenche la récompense Apparence de Dragon si armée.
  next = consumeDragonFormReward(next, idx)
  if (card.cardId === 'il-etait-un-reve') {
    return discardCurseFromHeroLocation(next, idx)
  }
  if (card.cardId === 'agrandir') {
    return resolveEffectsLocal(next, card.effects ?? [], { actorIndex: idx, targetHeroId, enlargeToward })
  }
  if (
    card.cardId === 'voler-riches' ||
    card.cardId === 'deguisement' ||
    card.cardId === 'epee-verite'
  ) {
    return resolveFateCardOnHero(next, idx, idx, card, targetHeroId)
  }
  throw new Error(`Le mode test ne sait pas jouer ${card.name}.`)
}

/** Helper interne : appelle resolveEffects. Wrapper pour la clarté. */
function resolveEffectsLocal(
  state: GameState,
  effects: Effect[],
  ctx: { actorIndex: number; targetHeroId?: string; enlargeToward?: string },
): GameState {
  return resolveEffects(state, effects, ctx)
}

/** Pioche N cartes (au lieu de compléter à HAND_LIMIT). Pour Tyrannie. */
function drawPlayerToLimitN(
  player: PlayerState,
  rngState: number,
  n: number,
): { player: PlayerState; rngState: number; drawn: number } {
  let deck = player.deck
  let hand = player.hand
  let discard = player.discard
  let s = rngState
  let drawn = 0
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      const r = shuffle(discard, s)
      deck = r.result
      s = r.state
      discard = []
    }
    const [top, ...rest] = deck
    deck = rest
    hand = [...hand, top]
    drawn++
  }
  return { player: { ...player, deck, hand, discard }, rngState: s, drawn }
}

/** Disparition : passer la phase MOVE sans bouger. Consomme `skipNextMove`. */
function applySkipMove(state: GameState): GameState {
  if (state.status !== 'PLAYING' || state.phase !== 'MOVE') {
    throw new Error(`SKIP_MOVE invalide en phase ${state.phase}.`)
  }
  const me = activePlayer(state)
  if (!me.skipNextMove) {
    throw new Error('Aucune Disparition active.')
  }
  const next = updateActivePlayer(state, (p) => ({ ...p, skipNextMove: false }))
  return {
    ...next,
    phase: 'ACTION',
    usedActionIds: [],
    persifleurAvailable: false,
    log: [...next.log, `${me.villainName} reste sur **${me.pawnLocation}** (Disparition).`],
  }
}

/** Manipulation (Jafar) : reprend en main la carte choisie de la défausse. */
function applyResolveManipulation(state: GameState, instanceId: string): GameState {
  const pending = state.pendingManipulation
  if (!pending) throw new Error('Aucune Manipulation en attente.')
  const idx = pending.playerIndex
  const player = state.players[idx]
  const card = player.discard.find((c) => c.instanceId === instanceId)
  if (!card) throw new Error('Carte introuvable dans la défausse.')
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, card],
  }))
  return {
    ...next,
    pendingManipulation: null,
    log: [...next.log, `${player.villainName} reprend **${card.name}** de sa défausse (Manipulation).`],
  }
}

/** Par ordre de la Reine ! : transforme en arceaux les 1-2 Cartes Gardes choisies
 *  (validées contre les Cartes Gardes éligibles : `gardes-*`, hors lieu du Dodo). */
function applyResolveTransformWickets(state: GameState, instanceIds: string[]): GameState {
  const pending = state.pendingTransformWickets
  if (!pending) throw new Error('Aucune transformation de Cartes Gardes en attente.')
  const idx = pending.playerIndex
  const eligible = new Set(transformableGuards(state, idx).map((c) => c.instanceId))
  const chosen = instanceIds.filter((id) => eligible.has(id)).slice(0, pending.max)
  if (chosen.length === 0) {
    throw new Error('Choisissez au moins 1 Carte Garde à transformer.')
  }
  const chosenSet = new Set(chosen)
  const player = state.players[idx]
  const names = player.locations
    .flatMap((loc) => player.board[loc.id] ?? [])
    .filter((c) => chosenSet.has(c.instanceId))
    .map((c) => c.name)
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    board: Object.fromEntries(
      Object.entries(p.board).map(([loc, cards]) => [
        loc,
        cards.map((c) => (chosenSet.has(c.instanceId) ? { ...c, isWicket: true } : c)),
      ]),
    ),
  }))
  return {
    ...next,
    pendingTransformWickets: null,
    log: [
      ...next.log,
      `${player.villainName} transforme ${names.length === 1 ? '1 Carte Garde' : `${names.length} Cartes Gardes`} en arceau${names.length > 1 ? 'x' : ''} (${names.join(', ')}).`,
    ],
  }
}

/** Faites-leur peur ! : remet `topInstanceIds` (validés) sur le dessus de la
 *  pioche Fatalité dans l'ordre donné (1ʳᵉ = tout en haut), défausse les autres
 *  cartes sondées. */
function applyResolveScry(state: GameState, topInstanceIds: string[]): GameState {
  const pending = state.pendingScry
  if (!pending) throw new Error('Aucune carte Fatalité à trier (Faites-leur peur !).')
  const idx = pending.playerIndex
  const byId = new Map(pending.cards.map((c) => [c.instanceId, c]))
  const kept = topInstanceIds.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
  const keptSet = new Set(kept.map((c) => c.instanceId))
  const discarded = pending.cards.filter((c) => !keptSet.has(c.instanceId))
  const player = state.players[idx]
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    fateDeck: [...kept, ...p.fateDeck],
    fateDiscard: [...p.fateDiscard, ...discarded],
  }))
  return {
    ...next,
    pendingScry: null,
    log: [
      ...next.log,
      `${player.villainName} (Faites-leur peur !) : ${kept.length} carte(s) sur le dessus, ${discarded.length} défaussée(s).`,
    ],
  }
}

/** Pas de Quartier ! : déplace l'Allié choisi vers un lieu voisin non bloqué et
 *  lui donne +force jusqu'à la fin du tour. */
function applyResolveAllyMoveBuff(state: GameState, instanceId: string, to: LocationId): GameState {
  const pending = state.pendingAllyMoveBuff
  if (!pending) throw new Error('Aucun déplacement « Pas de Quartier ! » en attente.')
  const idx = pending.playerIndex
  const me = state.players[idx]
  const from = locationOfCard(me, instanceId)
  if (!from) throw new Error(`Allié « ${instanceId} » introuvable.`)
  const ally = (me.board[from] ?? []).find((c) => c.instanceId === instanceId)
  if (!ally || ally.type !== 'ally' || ally.attachedTo || ally.isWicket) {
    throw new Error('Cible invalide pour « Pas de Quartier ! ».')
  }
  if (!adjacentLocationIds(state, from).includes(to)) {
    throw new Error('Destination invalide (lieu voisin non bloqué requis).')
  }
  const attached = (me.board[from] ?? []).filter((c) => c.attachedTo === instanceId)
  const movedIds = new Set([instanceId, ...attached.map((c) => c.instanceId)])
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !movedIds.has(c.instanceId)),
      [to]: [
        ...(p.board[to] ?? []),
        { ...ally, tempStrengthBonus: (ally.tempStrengthBonus ?? 0) + pending.amount },
        ...attached,
      ],
    },
  }))
  const toName = me.locations.find((l) => l.id === to)?.name ?? to
  return {
    ...next,
    pendingAllyMoveBuff: null,
    log: [...next.log, `${me.villainName} déplace **${ally.name}** vers **${toName}** (+${pending.amount} force ce tour-ci).`],
  }
}

/** Abu/Aladdin (vol d'un Objet → associé au Héros) / K.O. (retrait d'un Allié) :
 *  applique le choix de l'adversaire sur la carte `instanceId`. */
function applyResolveFateChoice(state: GameState, instanceId: string): GameState {
  const pending = state.pendingFateChoice
  if (!pending) throw new Error('Aucun choix de Fatalité en attente.')
  if (!pending.candidateIds.includes(instanceId)) {
    throw new Error('Carte choisie invalide (choix de Fatalité).')
  }
  const ti = pending.targetIndex
  const tgt = state.players[ti]

  if (pending.kind === 'remove-ally') {
    const loc = locationOfCard(tgt, instanceId)
    if (!loc) throw new Error('Allié introuvable.')
    const ally = (tgt.board[loc] ?? []).find((c) => c.instanceId === instanceId)!
    const attached = (tgt.board[loc] ?? []).filter((c) => c.attachedTo === instanceId)
    const removed = new Set([instanceId, ...attached.map((c) => c.instanceId)])
    const next = updatePlayer(state, ti, (p) => ({
      ...p,
      board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
      discard: [...p.discard, ally, ...attached],
    }))
    return {
      ...next,
      pendingFateChoice: null,
      log: [...next.log, `**K.O.** : **${ally.name}** est retiré du royaume de ${tgt.villainName}.`],
    }
  }

  if (pending.kind === 'remove-item') {
    // Migraine Atroce : défausse un Objet du royaume de la cible.
    const loc = locationOfCard(tgt, instanceId)
    if (!loc) throw new Error('Objet introuvable.')
    const item = (tgt.board[loc] ?? []).find((c) => c.instanceId === instanceId)!
    const next = updatePlayer(state, ti, (p) => ({
      ...p,
      board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => c.instanceId !== instanceId) },
      discard: [...p.discard, { ...item, attachedTo: undefined }],
    }))
    return {
      ...next,
      pendingFateChoice: null,
      log: [...next.log, `**Migraine Atroce** : **${item.name}** est défaussé du royaume de ${tgt.villainName}.`],
    }
  }

  // steal-item-to-hero (Abu/Aladdin) : l'Objet (du plateau ou de la main) est
  // associé au Héros et n'est plus utilisable par la cible.
  const host = pending.hostInstanceId!
  const hostLoc = locationOfCard(tgt, host)
  if (!hostLoc) throw new Error('Héros porteur introuvable.')
  const item =
    Object.values(tgt.board).flat().find((c) => c.instanceId === instanceId) ??
    tgt.hand.find((c) => c.instanceId === instanceId)
  if (!item) throw new Error('Objet introuvable.')
  const equipped: CardInstance = { ...item, attachedTo: host }
  const next = updatePlayer(state, ti, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    board: Object.fromEntries(
      p.locations.map((l) => {
        let cards = (p.board[l.id] ?? []).filter((c) => c.instanceId !== instanceId)
        if (l.id === hostLoc) cards = [...cards, equipped]
        return [l.id, cards]
      }),
    ),
  }))
  return {
    ...next,
    pendingFateChoice: null,
    log: [...next.log, `**${item.name}** est volé à ${tgt.villainName} et associé au Héros (inutilisable).`],
  }
}

/** Digne Adversaire / Obsession : joue le Héros dévoilé sur le lieu choisi (Peter
 *  Pan → Arbre du Pendu) ou le défausse ; défausse toujours les autres dévoilées. */
function applyResolveFetchedHero(state: GameState, play: boolean, to?: LocationId): GameState {
  const pending = state.pendingFetchedHero
  if (!pending) throw new Error('Aucun Héros dévoilé en attente.')
  const idx = pending.playerIndex
  const me = state.players[idx]
  // Les autres cartes dévoilées partent toujours en défausse Fatalité.
  let next = updatePlayer(state, idx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, ...pending.discarded] }))
  next = { ...next, pendingFetchedHero: null }
  if (!play) {
    next = updatePlayer(next, idx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, pending.hero] }))
    return { ...next, log: [...next.log, `${me.villainName} défausse **${pending.hero.name}**.`] }
  }
  const isPeterPan = pending.hero.cardId === 'peter-pan'
  const dest = isPeterPan ? 'arbre-pendu' : to ?? me.pawnLocation ?? me.locations[0].id
  const locked = new Set(me.lockedLocations ?? [])
  if (!isPeterPan && (!me.locations.some((l) => l.id === dest) || locked.has(dest))) {
    throw new Error(`Lieu de pose invalide pour ${pending.hero.name}.`)
  }
  const destName = me.locations.find((l) => l.id === dest)?.name ?? dest
  return placeFateHeroWithEffects(next, idx, idx, pending.hero, dest, destName)
}

/** Carte du Pays Imaginaire : à tout moment du tour, défaussez-la (du royaume)
 *  pour jouer GRATUITEMENT un Objet de la main. */
function applyUseNeverlandMap(
  state: GameState,
  itemInstanceId: string,
  to: LocationId,
  attachTo?: string,
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible d'utiliser la Carte du Pays Imaginaire en phase ${state.phase}.`)
  }
  const me = activePlayer(state)
  // Localiser la Carte du Pays Imaginaire dans le royaume.
  let mapId: string | undefined
  let mapLoc: string | undefined
  for (const l of me.locations) {
    const found = (me.board[l.id] ?? []).find((c) => c.cardId === 'carte-pays-imaginaire')
    if (found) {
      mapId = found.instanceId
      mapLoc = l.id
      break
    }
  }
  if (!mapId || !mapLoc) throw new Error('Carte du Pays Imaginaire absente de votre royaume.')
  const mapCard = (me.board[mapLoc] ?? []).find((c) => c.instanceId === mapId)!
  const item = me.hand.find((c) => c.instanceId === itemInstanceId)
  if (!item || item.type !== 'item') throw new Error('Objet à jouer introuvable dans la main.')
  if (!me.locations.some((l) => l.id === to)) throw new Error(`Lieu invalide : « ${to} ».`)
  if ((me.lockedLocations ?? []).includes(to)) throw new Error('Lieu verrouillé.')
  if (item.playOnlyAt && item.playOnlyAt !== to) {
    throw new Error(`${item.name} ne peut être posé qu'à un lieu précis.`)
  }
  const needsTarget = item.attach === 'ally' || item.attach === 'hero'
  if (needsTarget) {
    const host = (me.board[to] ?? []).find((c) => c.instanceId === attachTo)
    const ok =
      host &&
      ((item.attach === 'ally' && host.type === 'ally' && !host.isWicket) ||
        (item.attach === 'hero' && host.type === 'hero'))
    if (!ok) throw new Error(`${item.name} doit être associé à une carte valide sur ${to}.`)
  }
  const placed: CardInstance = needsTarget ? { ...item, attachedTo: attachTo } : item
  // Retire la Carte du Pays Imaginaire (→ défausse) et pose l'Objet sur `to`.
  let next = updateActivePlayer(state, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== itemInstanceId),
    discard: [...p.discard, { ...mapCard, attachedTo: undefined }],
    board: Object.fromEntries(
      p.locations.map((l) => {
        let cards = (p.board[l.id] ?? []).filter((c) => c.instanceId !== mapId)
        if (l.id === to) cards = [...cards, placed]
        return [l.id, cards]
      }),
    ),
  }))
  next = {
    ...next,
    log: [...next.log, `${me.villainName} défausse la Carte du Pays Imaginaire et joue **${item.name}** gratuitement.`],
  }
  // Effets immédiats de l'Objet (ex. déverrouillage), s'il y en a.
  return resolveEffects(next, item.effects ?? [], { actorIndex: state.activePlayer, hostLocationId: to })
}

function applyEndTurn(state: GameState): GameState {
  if (!canEndTurn(state)) {
    throw new Error(`Impossible de terminer le tour en phase ${state.phase}.`)
  }
  // Lever du jour : le blocage des Pages du joueur dont le tour se termine est consommé.
  if (state.players[state.activePlayer].noPagePlay) {
    state = updateActivePlayer(state, (p) => ({ ...p, noPagePlay: false }))
  }
  // Fin du tour courant : le joueur actif complète sa main à 4.
  const drawn = drawToLimit(state)
  const endedName = drawn.players[drawn.activePlayer].villainName
  const nextIdx = (drawn.activePlayer + 1) % drawn.players.length

  // Le tour du joueur suivant commence. Si la récompense Apparence de Dragon
  // de ce joueur n'a pas été déclenchée, elle expire à présent.
  let started: GameState = {
    ...drawn,
    activePlayer: nextIdx,
    turn: drawn.turn + 1,
    phase: 'MOVE',
    usedActionIds: [],
    persifleurAvailable: false,
    lastVanquishedHeroStrength: undefined,
    diabloFree: null,
    pendingTrapVanquish: false,
    activeMovedCard: false,
    activeDrewCard: false,
    // Effets « jusqu'à la fin de votre tour » du joueur qui termine (Sablier Géant).
    players: drawn.players.map((p, i) =>
      i === drawn.activePlayer
        ? {
            ...p,
            board: Object.fromEntries(
              Object.entries(p.board).map(([loc, cards]) => [
                loc,
                cards.map((c) =>
                  c.activatedThisTurn || c.tempStrengthBonus
                    ? { ...c, activatedThisTurn: false, tempStrengthBonus: undefined }
                    : c,
                ),
              ]),
            ),
          }
        : p,
    ),
    log: [...drawn.log, `Fin du tour de ${endedName}.`],
  }
  if (started.players[nextIdx].dragonFormReward) {
    started = updatePlayer(started, nextIdx, (p) => ({ ...p, dragonFormReward: false }))
  }

  // La victoire se vérifie « au début du tour » du nouveau joueur actif.
  if (hasReachedObjective(started)) {
    const w = started.players[nextIdx]
    return {
      ...started,
      status: 'WON',
      winner: nextIdx,
      log: [...started.log, `🏆 ${w.villainName} l'emporte avec ${w.power} JT !`],
    }
  }
  return started
}

/** Applique une action de jeu et renvoie le nouvel état. Pur, déterministe. */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.status !== 'PLAYING') {
    // Le Coup Royal gagnant met fin à la partie : on autorise tout de même la
    // fermeture de sa fenêtre de résultat (sinon elle resterait bloquée).
    if (action.type === 'DISMISS_ROYAL_CROQUET') {
      return { ...state, pendingRoyalCroquet: null }
    }
    throw new Error('La partie est terminée.')
  }
  // Une Fatalité révélée doit être résolue avant tout autre coup — sauf une
  // Condition jouée par le non-actif (réaction « à tout moment »).
  if (state.pendingFate && action.type !== 'RESOLVE_FATE' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Une Fatalité est en attente de résolution (RESOLVE_FATE).')
  }
  // Retourne-toi : une carte révélée doit être résolue avant tout autre coup
  // (sauf une Condition jouée en réaction par le non-actif).
  if (state.pendingDeckPeek && action.type !== 'RESOLVE_DECK_PEEK' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Une carte est révélée et attend un choix (RESOLVE_DECK_PEEK).')
  }
  // Tombée de la nuit : un choix de type est en attente.
  if (state.pendingTypeChoice && action.type !== 'RESOLVE_TYPE_CHOICE' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Un choix de type est en attente (RESOLVE_TYPE_CHOICE).')
  }
  // Par ordre de la Reine ! : la sélection de Cartes Gardes à transformer en
  // arceaux doit être résolue avant tout autre coup.
  if (
    state.pendingTransformWickets &&
    action.type !== 'RESOLVE_TRANSFORM_WICKETS' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez les Cartes Gardes à transformer (RESOLVE_TRANSFORM_WICKETS).')
  }
  // Faites-leur peur ! : le tri des 2 cartes Fatalité doit être résolu d'abord.
  if (state.pendingScry && action.type !== 'RESOLVE_SCRY' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Triez les cartes Fatalité révélées (RESOLVE_SCRY).')
  }
  // Pas de Quartier ! : le déplacement de l'Allié doit être résolu d'abord.
  if (
    state.pendingAllyMoveBuff &&
    action.type !== 'RESOLVE_ALLY_MOVE_BUFF' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez l’Allié à déplacer (RESOLVE_ALLY_MOVE_BUFF).')
  }
  // Abu/Aladdin/K.O. : le choix (Objet volé / Allié retiré) doit être résolu d'abord.
  if (state.pendingFateChoice && action.type !== 'RESOLVE_FATE_CHOICE' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Résolvez le choix de la carte Fatalité (RESOLVE_FATE_CHOICE).')
  }
  // Digne Adversaire / Obsession : jouer ou défausser le Héros dévoilé d'abord.
  if (state.pendingFetchedHero && action.type !== 'RESOLVE_FETCHED_HERO' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Jouez ou défaussez le Héros dévoilé (RESOLVE_FETCHED_HERO).')
  }
  switch (action.type) {
    case 'MOVE':
      return applyMove(state, action.to)
    case 'EXECUTE_ACTION':
      return applyExecuteAction(state, action.actionId)
    case 'PLAY_CARD':
      return applyPlayCard(
        state,
        action.actionId,
        action.instanceId,
        action.to,
        action.attachTo,
        action.targetHeroId,
        action.allyInstanceIds,
        action.allyMove,
        action.shrinkFreeActionId,
      )
    case 'DISCARD_CARDS':
      return applyDiscardCards(state, action.actionId, action.instanceIds)
    case 'MOVE_CARD':
      return applyMoveCard(state, action.actionId, action.instanceId, action.to)
    case 'MOVE_HERO':
      return applyMoveHero(state, action.actionId, action.heroInstanceId, action.to)
    case 'ACTIVATE':
      return applyActivate(
        state,
        action.actionId,
        action.cardInstanceId,
        action.to,
        action.itemInstanceId,
      )
    case 'FATE':
      return applyFate(state, action.actionId)
    case 'RESOLVE_FATE':
      return applyResolveFate(state, action.instanceId, action.to, action.targetHeroId, action.enlargeToward)
    case 'RESOLVE_TYRANNY_DISCARD':
      return applyResolveTyrannyDiscard(state, action.instanceIds)
    case 'RESOLVE_HERO_PLACEMENT':
      return applyResolveHeroPlacement(state, action.locationId)
    case 'RESOLVE_PAWN_MOVE':
      return applyResolvePawnMove(state, action.locationId)
    case 'RESOLVE_HUBERT_PULL':
      return applyResolveHubertPull(state, action.allyInstanceIds)
    case 'RESOLVE_DECK_PEEK':
      return applyResolveDeckPeek(state, action.keep)
    case 'RESOLVE_TYPE_CHOICE':
      return applyResolveTypeChoice(state, action.cardType)
    case 'RESOLVE_HERO_RELOCATE':
      return applyResolveHeroRelocate(state, action.heroInstanceId, action.to)
    case 'RESOLVE_TELEPORT':
      return applyResolveTeleport(state, action.to)
    case 'RESOLVE_MANIPULATION':
      return applyResolveManipulation(state, action.instanceId)
    case 'DISMISS_ROYAL_CROQUET':
      return { ...state, pendingRoyalCroquet: null }
    case 'RESOLVE_TRANSFORM_WICKETS':
      return applyResolveTransformWickets(state, action.instanceIds)
    case 'RESOLVE_SCRY':
      return applyResolveScry(state, action.topInstanceIds)
    case 'RESOLVE_ALLY_MOVE_BUFF':
      return applyResolveAllyMoveBuff(state, action.instanceId, action.to)
    case 'RESOLVE_FATE_CHOICE':
      return applyResolveFateChoice(state, action.instanceId)
    case 'RESOLVE_FETCHED_HERO':
      return applyResolveFetchedHero(state, action.play, action.to)
    case 'USE_NEVERLAND_MAP':
      return applyUseNeverlandMap(state, action.itemInstanceId, action.to, action.attachTo)
    case 'TEST_PLACE_FATE':
      return applyTestPlaceFate(state, action.card, action.to)
    case 'TEST_PLAY_CONDITION':
      return applyTestPlayCondition(state, action.card, action.allyInstanceId, action.to)
    case 'TEST_PLAY_FATE_CARD':
      return applyTestPlayFateCard(state, action.card, action.targetHeroId, action.enlargeToward)
    case 'VANQUISH':
      return applyVanquish(state, action.actionId, action.heroInstanceId, action.allyInstanceIds)
    case 'DISCARD_DEGUISEMENT':
      return applyDiscardDeguisement(state, action.instanceId)
    case 'SKIP_MOVE':
      return applySkipMove(state)
    case 'SHERIFF_MOVE':
      return applySheriffMove(state, action.instanceId, action.to)
    case 'DIABLO_MOVE':
      return applyDiabloMove(state, action.instanceId, action.to)
    case 'DIABLO_FREE_ACTION':
      return applyDiabloFreeAction(state, action.action)
    case 'DIABLO_SKIP_FREE_ACTION':
      return applyDiabloSkipFreeAction(state)
    case 'TRAP_VANQUISH':
      return applyTrapVanquish(state, action.heroInstanceId, action.allyInstanceIds)
    case 'TRAP_SKIP_VANQUISH':
      return applyTrapSkipVanquish(state)
    case 'PLAY_CONDITION':
      return applyPlayCondition(
        state,
        action.playerIndex,
        action.instanceId,
        action.allyInstanceId,
        action.to,
        action.attachTo,
      )
    case 'END_TURN':
      return applyEndTurn(state)
  }
}
