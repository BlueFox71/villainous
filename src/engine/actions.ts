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
  PeteGoalKind,
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
  syncRatiganObjectiveAll,
  updateActivePlayer,
  updatePlayer,
} from './state'
import { addKronkTokens, canEnterAuDela, holdsTalisman, moveTitanTo, performVanquish, playChosenFateFromDiscard, processCurseDiscards, reformYzmaDecks, reshuffleYzmaIfKuzcoDiscarded, resolveEffect, resolveEffects, titanReachableDests, triggerHeroArrival } from './effects'
import { crewmateEndOfTurn, freeCellAt, placeCrewmateAt } from './crewmates'
import {
  adjacentLocationIds,
  canEndTurn,
  canPlaceAt,
  canPlaceCurseAt,
  canTakeABite,
  conditionIsTriggered,
  effectiveCost,
  effectiveStrength,
  fateTarget,
  goalsBlockedByHero,
  hasHeroInRealm,
  hasReachedObjective,
  heroPlacementLocations,
  heroesOf,
  isActionAvailable,
  isActionCovered,
  isItemFrozen,
  isLegalMove,
  isPassiveGoalMet,
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

/** Résout l'effet d'une action de lieu instantanée (hors gestion de tour).
 *  `count` : nb de Pouvoir à convertir pour « Préparer du Poison » (défaut 1). */
function resolveLocationAction(state: GameState, action: LocationAction, count?: number): GameState {
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
        // Suivi du Pouvoir gagné ce tour-ci (déclencheur Terreur, Dr Facilier).
        activeGainedPower: (next.activeGainedPower ?? 0) + amount,
        log: [
          ...next.log,
          `${activePlayer(next).villainName} gagne ${amount} JT${note} (total : ${activePlayer(next).power}).`,
        ],
      }
      return pushRobinSteal(next, state.activePlayer, gross - amount)
    }
    case 'BREW_POISON': {
      // La Méchante Reine — « Préparer du Poison » : convertit N jetons Pouvoir en
      // N jetons Poison (1:1, N au choix). Timide (Héros Fatalité) fait coûter
      // 1 Pouvoir EN PLUS le fait d'utiliser l'action (perdu, non converti).
      const me = activePlayer(state)
      const surcharge = hasHeroInRealm(state, state.activePlayer, 'timide') ? 1 : 0
      const max = Math.max(0, me.power - surcharge)
      if (max < 1) {
        throw new Error(
          surcharge
            ? 'Timide : « Préparer du Poison » coûte 1 Pouvoir — pas assez pour convertir.'
            : 'Préparer du Poison nécessite au moins 1 jeton Pouvoir à convertir.',
        )
      }
      // Borne le nombre demandé à [1, max].
      const n = Math.max(1, Math.min(count ?? 1, max))
      const spent = n + surcharge
      const next = updateActivePlayer(state, (p) => ({
        ...p,
        power: p.power - spent,
        poison: (p.poison ?? 0) + n,
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `${me.villainName} prépare du Poison (${n} Pouvoir → ${n} Poison${surcharge ? ', −1 JT : Timide' : ''}, total Poison : ${activePlayer(next).poison}).`,
        ],
      }
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
  // Dr Facilier — Ombre du Dr Facilier : si elle est sur le lieu de départ du
  // pion, elle se déplace en même temps que lui (auto).
  const from = me.pawnLocation
  if (from && from !== to) {
    const ombre = (next.players[state.activePlayer].board[from] ?? []).find((c) => c.cardId === 'ombre-facilier')
    if (ombre) {
      const moving = (next.players[state.activePlayer].board[from] ?? []).filter(
        (c) => c.instanceId === ombre.instanceId || c.attachedTo === ombre.instanceId,
      )
      const ids = new Set(moving.map((c) => c.instanceId))
      const fromId = from
      next = updateActivePlayer(next, (p) => ({
        ...p,
        board: {
          ...p.board,
          [fromId]: (p.board[fromId] ?? []).filter((c) => !ids.has(c.instanceId)),
          [to]: [...(p.board[to] ?? []), ...moving],
        },
      }))
      next = { ...next, log: [...next.log, `L'**Ombre du Dr Facilier** suit ${me.villainName} sur **${dest.name}**.`] }
    }
  }
  // Dr Facilier — Louis (Fatalité) : si Facilier arrive sur le lieu de Louis, il
  // place une carte de sa main dans la Pile de l'Au-delà (auto : carte autorisée).
  const louisHere = (next.players[state.activePlayer].board[to] ?? []).some(
    (c) => c.type === 'hero' && c.cardId === 'louis',
  )
  if (louisHere) {
    const pick = next.players[state.activePlayer].hand.find(
      (c) => c.cardId !== 'talisman' && c.cardId !== 'divination-facilier',
    )
    if (pick) {
      next = updateActivePlayer(next, (p) => ({
        ...p,
        hand: p.hand.filter((c) => c.instanceId !== pick.instanceId),
        auDela: [...p.auDela, pick],
      }))
      next = { ...next, log: [...next.log, `Louis : ${me.villainName} place **${pick.name}** de sa main dans la Pile de l'Au-delà.`] }
    }
  }
  // Tic Tac (Capitaine Crochet) : si le pion arrive sur le lieu de Tic Tac,
  // Crochet défausse immédiatement toute sa main.
  const ticTacHere = (me.board[to] ?? []).some((c) => c.type === 'hero' && c.cardId === 'tic-tac')
  if (ticTacHere && next.players[state.activePlayer].hand.length > 0) {
    next = updateActivePlayer(next, (p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] }))
    next = { ...next, log: [...next.log, `🐊 Tic Tac ! ${me.villainName} défausse toute sa main.`] }
  }
  // La Méchante Reine — Puits aux souhaits (Fatalité, associé à un Héros) : elle
  // perd 1 jeton Poison chaque fois qu'elle arrive sur le lieu où il se trouve.
  const puitsHere = (next.players[state.activePlayer].board[to] ?? []).some((c) => c.cardId === 'puits-souhaits')
  if (puitsHere && (next.players[state.activePlayer].poison ?? 0) > 0) {
    next = updateActivePlayer(next, (p) => ({ ...p, poison: (p.poison ?? 0) - 1 }))
    next = { ...next, log: [...next.log, `Puits aux souhaits : ${me.villainName} perd 1 jeton Poison.`] }
  }
  // Malédictions Feu Infernal : défaussées si le pion arrive sur leur lieu.
  return processCurseDiscards(next, state.activePlayer, to, 'pawn-moves-here')
}

function applyExecuteAction(state: GameState, actionId: string, count?: number): GameState {
  if (!isActionAvailable(state, actionId)) {
    throw new Error(`Action indisponible : « ${actionId} ».`)
  }
  const loc = currentLocation(state)! // garanti par isActionAvailable
  // Inclut les actions accordées par un Objet (Boîte à Crochets → Gagner 1).
  const action = locationActions(state, loc.id).find((a) => a.id === actionId)!
  if (action.type !== 'GAIN_POWER' && action.type !== 'BREW_POISON') {
    throw new Error(`EXECUTE_ACTION ne gère pas « ${action.type} ».`)
  }
  let next = resolveLocationAction(state, action, count)
  next = consumePersifleur(next, action)
  next = consumeRepeatAction(next, actionId)
  return { ...next, usedActionIds: [...next.usedActionIds, actionId] }
}

/** La Méchante Reine — Noir de nuit : si l'action `actionId` est REJOUÉE (déjà dans
 *  usedActionIds) et que le drapeau « refaire une action » est armé, on le consomme.
 *  No-op pour tous les autres cas (drapeau jamais posé). */
function consumeRepeatAction(state: GameState, actionId: string): GameState {
  const me = activePlayer(state)
  if (!me.repeatActionAvailable || !state.usedActionIds.includes(actionId)) return state
  return {
    ...updateActivePlayer(state, (p) => ({ ...p, repeatActionAvailable: false })),
    log: [...state.log, `Noir de nuit : ${me.villainName} refait une action.`],
  }
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
  engrenagesIds?: string[],
): GameState {
  if (state.phase !== 'ACTION') {
    throw new Error(`Impossible de jouer une carte en phase ${state.phase}.`)
  }
  const loc = currentLocation(state)
  if (!loc) throw new Error('Aucun lieu courant.')

  // L'action « Jouer une carte » doit être disponible sur le LIEU COURANT —
  // imprimée OU accordée par un Objet/Allié (Coéquipier imposteur → « Jouer une
  // carte »), d'où l'usage de locationActions (qui inclut les actions accordées).
  const action = locationActions(state, loc.id).find((a) => a.id === actionId)
  if (!action || action.type !== 'PLAY_CARD') {
    throw new Error(`« ${actionId} » n'est pas une action « Jouer une carte ».`)
  }
  if (isActionCovered(state, action)) {
    throw new Error(`${action.label} est recouverte par un Héros.`)
  }
  // Action déjà utilisée : refusée, SAUF si Noir de nuit autorise une réutilisation.
  if (state.usedActionIds.includes(actionId) && !activePlayer(state).repeatActionAvailable) {
    throw new Error('Cette action a déjà été utilisée ce tour.')
  }

  const me = activePlayer(state)
  const card = me.hand.find((c) => c.instanceId === instanceId)
  if (!card) throw new Error(`Carte « ${instanceId} » absente de la main.`)
  // Pat Hibulaire — une action « Jouer » laissée ouverte par un Bandit ne peut
  // servir qu'à jouer d'autres Bandits (les autres cartes utilisent une autre action).
  if (state.banditChain?.actionId === actionId && !card.playMultiplePerAction) {
    throw new Error('Cette action « Jouer une carte » est réservée à d’autres Bandits ce tour-ci.')
  }
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
  // Joyeux non-anniversaire (gain par Allié) : injouable sans aucun Allié dans le
  // royaume (elle n'aurait aucun effet). Donnée : on teste l'effet, pas le cardId.
  if (
    (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_ALLY_IN_REALM') &&
    !Object.values(me.board).flat().some((c) => c.type === 'ally')
  ) {
    throw new Error('Aucun Allié dans votre royaume : cette carte n’aurait aucun effet.')
  }
  // Magnifiques Taxes (gain par Héros) : injouable sans aucun Héros dans le
  // royaume (elle n'aurait aucun effet). Donnée : on teste l'effet, pas le cardId.
  if (
    (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_HERO_IN_REALM') &&
    !Object.values(me.board).flat().some((c) => c.type === 'hero')
  ) {
    throw new Error('Aucun Héros dans votre royaume : cette carte n’aurait aucun effet.')
  }
  // Foudre (duplique un Ingrédient) : injouable s'il n'y a rien à reproduire ou
  // si aucun Ingrédient joué n'est payable (son coût = celui de l'Ingrédient).
  if ((card.effects ?? []).some((e) => e.type === 'DUPLICATE_INGREDIENT')) {
    const zone = me.ingredients ?? []
    if (zone.length === 0) {
      throw new Error('Aucun Ingrédient joué : Foudre ne peut rien reproduire.')
    }
    // Le coût de Foudre = coût de l'Ingrédient reproduit : il faut pouvoir payer
    // au moins l'un des Ingrédients déjà joués.
    if (!zone.some((c) => (c.cost ?? 0) <= me.power)) {
      throw new Error('Pas assez de Pouvoir pour reproduire un Ingrédient (Foudre).')
    }
  }
  // « Je vais vous broyer les os ! » : injouable s'il n'y a aucun Héros sur le lieu
  // du pion (rien à « découvrir »).
  if (
    (card.effects ?? []).some((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN') &&
    !(me.pawnLocation && (me.board[me.pawnLocation] ?? []).some((c) => c.type === 'hero'))
  ) {
    throw new Error('Aucun Héros sur votre lieu : cette carte n’aurait aucun effet.')
  }
  // « Croque ! » : injouable si aucun Héros du lieu du pion n'est éliminable
  // (assez de Poison pour sa force, priorité Prof respectée).
  if ((card.effects ?? []).some((e) => e.type === 'TAKE_A_BITE') && !canTakeABite(state)) {
    throw new Error('Aucun Héros éliminable ici (pas assez de Poison) : « Croque ! » est injouable.')
  }
  // Scar — Festin : injouable s'il n'y a aucune Hyène dans le royaume (rien à déplacer).
  if (card.requiresHyenaInRealm && !Object.values(me.board).flat().some((c) => c.isHyena)) {
    throw new Error('Aucune Hyène dans votre royaume : cette carte n’aurait aucun effet.')
  }
  // Scar — Suivez-moi ! : injouable s'il n'y a aucune Hyène sur un AUTRE lieu que
  // celui du pion (aucune Hyène à « suivre »).
  if (
    (card.effects ?? []).some((e) => e.type === 'FOLLOW_ME') &&
    !me.locations.some((l) => l.id !== me.pawnLocation && (me.board[l.id] ?? []).some((c) => c.isHyena))
  ) {
    throw new Error('Aucune Hyène sur un autre lieu : « Suivez-moi ! » est injouable.')
  }
  // Yzma — Fausses funérailles : injouable s'il n'y a aucun Héros dans la défausse
  // Fatalité (elle n'aurait aucun effet : 0 jeton gagné).
  if (
    (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_FATE_DISCARD_HERO') &&
    !me.fateDiscard.some((c) => c.type === 'hero')
  ) {
    throw new Error('Aucun Héros dans votre défausse Fatalité : « Fausses funérailles » est injouable.')
  }
  // Yzma — Le chemin qui balance : injouable s'il n'y a aucun jeton Pouvoir sur
  // Kronk (Kronk absent du royaume ou sans jeton) → elle n'aurait aucun effet.
  if (
    (card.effects ?? []).some((e) => e.type === 'KRONK_DISCARD_TOKENS') &&
    !Object.values(me.board).flat().some((c) => c.cardId === 'kronk' && (c.kronkPower ?? 0) > 0)
  ) {
    throw new Error('Aucun jeton Pouvoir sur Kronk : « Le chemin qui balance » est injouable.')
  }
  // Yzma — Beauté endormie : jouable uniquement en PREMIÈRE action du tour (aucune
  // action « réelle » — hors marqueurs « : » — déjà utilisée).
  if (
    (card.effects ?? []).some((e) => e.type === 'BEAUTY_SLEEP') &&
    state.usedActionIds.some((a) => !a.includes(':'))
  ) {
    throw new Error('Beauté endormie ne peut être jouée qu’en première action du tour.')
  }
  // Scar — Petit secret : injouable s'il n'y a aucune carte Fatalité jouable (Héros
  // ou Événement) dans la défausse Fatalité.
  if (
    (card.effects ?? []).some((e) => e.type === 'PLAY_FATE_HERO_FROM_DISCARD') &&
    !me.fateDiscard.some((c) => c.type === 'hero' || c.type === 'effect')
  ) {
    throw new Error('Aucune carte Fatalité jouable dans la défausse : « Petit secret » est injouable.')
  }

  // Coût effectif (Couronne −1, Bâton Magique −1, Épée de Vérité +2 sur curse,
  // Razoul −1 sur Allié). Hypnose : coût = force (effective) du Héros ciblé.
  let cost = effectiveCost(state, card, to)
  if ((card.effects ?? []).some((e) => e.type === 'HYPNOTIZE_HERO')) {
    if (!targetHeroId) throw new Error('Hypnose nécessite un Héros cible.')
    cost = effectiveStrength(state, state.activePlayer, targetHeroId) ?? 0
  }
  // Ratigan — Engrenages : pour jouer un Objet, on peut défausser des Engrenages EN
  // JEU (sur le plateau) — au choix du joueur via `engrenagesIds` — pour réduire son
  // coût de 3 par Engrenage.
  const engrenagesToDiscard: CardInstance[] = []
  if (card.type === 'item' && engrenagesIds && engrenagesIds.length > 0) {
    for (const id of engrenagesIds) {
      let found: CardInstance | undefined
      for (const l of me.locations) {
        const c = (me.board[l.id] ?? []).find(
          (c) => c.instanceId === id && c.cardId === 'engrenages' && !c.attachedTo,
        )
        if (c) { found = c; break }
      }
      if (!found) throw new Error('Engrenages à défausser introuvable sur le plateau.')
      engrenagesToDiscard.push(found)
      cost = Math.max(0, cost - 3)
    }
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
    if (card.type === 'curse' && !canPlaceCurseAt(state, state.activePlayer, to, card)) {
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
    } else if (card.type === 'item' && card.attach === 'hero') {
      // Hadès — Potion de mortalité : Objet Vilain associé à un Héros du royaume.
      const heroes = (me.board[to] ?? []).filter((c) => c.type === 'hero' && !c.hypnotized)
      if (heroes.length === 0) {
        throw new Error(`Aucun Héros sur ${dest.name} pour y associer ${card.name}.`)
      }
      if (attachTo === undefined) {
        throw new Error(`${card.name} doit être associé à un Héros (cible manquante).`)
      }
      host = heroes.find((h) => h.instanceId === attachTo)
      if (!host) {
        throw new Error(`Le Héros cible « ${attachTo} » n'est pas un Héros sur ${dest.name}.`)
      }
    } else if (attachTo !== undefined) {
      throw new Error(`${card.name} ne s'associe pas à un Allié.`)
    }
  } else if (attachTo !== undefined) {
    throw new Error(`${card.name} ne s'associe pas à un Allié.`)
  }

  // Noir de nuit : cette action « Jouer une carte » est-elle une RÉUTILISATION ?
  const reusedPlay = state.usedActionIds.includes(actionId)
  // Payer le coût, retirer la carte de la main, marquer l'action utilisée.
  const engSet = new Set(engrenagesToDiscard.map((c) => c.instanceId))
  let next = updateActivePlayer(state, (p) => ({
    ...p,
    power: p.power - cost,
    // Pat Hibulaire — suivi du Pouvoir dépensé ce tour (tuile Power Play : ≥6).
    powerSpentThisTurn:
      p.powerSpentThisTurn !== undefined ? p.powerSpentThisTurn + cost : undefined,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    // Les Engrenages choisis sont retirés du PLATEAU (tous lieux) et défaussés.
    board:
      engSet.size === 0
        ? p.board
        : Object.fromEntries(
            Object.entries(p.board).map(([loc, cards]) => [loc, cards.filter((c) => !engSet.has(c.instanceId))]),
          ),
    discard: engSet.size === 0 ? p.discard : [...p.discard, ...engrenagesToDiscard],
    repeatActionAvailable: reusedPlay ? false : p.repeatActionAvailable,
  }))
  if (engrenagesToDiscard.length > 0) {
    next = {
      ...next,
      log: [
        ...next.log,
        `${me.villainName} défausse ${engrenagesToDiscard.length} Engrenage${engrenagesToDiscard.length > 1 ? 's' : ''} en jeu (−${engrenagesToDiscard.length * 3} au coût).`,
      ],
    }
  }
  const where = dest ? ` sur **${dest.name}**` : ''
  const assoc = host ? `, associé à **${host.name}**` : ''
  next = {
    ...next,
    usedActionIds: [...next.usedActionIds, actionId],
    log: [...next.log, `${me.villainName} joue **${card.name}** (coût ${cost})${where}${assoc}.`],
  }

  // Ursula — Trident : cherche le Roi Triton, le pose (zone haute) et lui associe
  // le Trident. Si Triton est déjà en jeu, le Trident lui est simplement associé.
  // Le Trident est ainsi « verrouillé » jusqu'à ce que Triton soit éliminé
  // (checkPacteDefeat libère alors le Trident en zone basse).
  if (card.cardId === 'trident' && dest) {
    const ai = state.players[state.activePlayer]
    let tritonLoc: string | undefined
    let triton: CardInstance | undefined
    for (const l of ai.locations) {
      const found = (ai.board[l.id] ?? []).find((c) => c.cardId === 'roi-triton' && c.type === 'hero')
      if (found) {
        tritonLoc = l.id
        triton = found
        break
      }
    }
    if (triton && tritonLoc) {
      const tloc = tritonLoc
      const trident: CardInstance = { ...card, attachedTo: triton.instanceId }
      next = updateActivePlayer(next, (p) => ({
        ...p,
        board: { ...p.board, [tloc]: [...(p.board[tloc] ?? []), trident] },
      }))
      next = { ...next, log: [...next.log, `Le Trident est associé au **Roi Triton**.`] }
      return consumePersifleur(next, action)
    }
    const fromDeck = ai.fateDeck.find((c) => c.cardId === 'roi-triton')
    const t = fromDeck ?? ai.fateDiscard.find((c) => c.cardId === 'roi-triton')
    if (!t) {
      // Roi Triton introuvable : le Trident est posé librement sur le lieu.
      next = updateActivePlayer(next, (p) => ({ ...p, board: { ...p.board, [dest.id]: [...(p.board[dest.id] ?? []), card] } }))
      next = { ...next, log: [...next.log, `Roi Triton introuvable : le Trident est posé sur **${dest.name}**.`] }
      return consumePersifleur(next, action)
    }
    const trident: CardInstance = { ...card, attachedTo: t.instanceId }
    next = updateActivePlayer(next, (p) => ({
      ...p,
      fateDeck: p.fateDeck.filter((c) => c.instanceId !== t.instanceId),
      fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== t.instanceId),
      board: { ...p.board, [dest.id]: [...(p.board[dest.id] ?? []), t, trident] },
    }))
    next = { ...next, log: [...next.log, `Le **Roi Triton** apparaît sur **${dest.name}**, associé au Trident.`] }
    return consumePersifleur(next, action)
  }

  // Showcase pour Événements/Malédictions : la carte s'affiche en grand. On
  // retient son index pour y annoter le pouvoir gagné par ses effets (« +N JT »).
  // Tendre un Piège est EXCLU ici : son showcase est différé à la fin de sa
  // séquence (après le Vanquish facultatif ou « Terminer »).
  let showcaseIdx = -1
  if ((card.type === 'effect' || card.type === 'curse' || card.type === 'ingredient') && card.cardId !== 'tendre-piege') {
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
      next = { ...next, pendingTrapVanquish: { source: 'trap' } }
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
    // Bowser — Dino Piranha / Kamella : effet « à la pose » résolu APRÈS placement
    // (l'Allié doit être sur le board pour recevoir l'Étoile). Le passage générique
    // pré-placement (resolveEffects ci-dessus) est un no-op faute de hostLocationId.
    if (card.type === 'ally' && (card.effects ?? []).some((e) => e.type === 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY')) {
      next = resolveEffects(next, [{ type: 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY' }], {
        actorIndex: state.activePlayer,
        hostInstanceId: placed.instanceId,
        hostLocationId: destId,
      })
    }
    // Scar — Shenzi (jouer une Hyène gratuite) / Troupeau de gnous (déplacer un
    // Héros) : effets « à la pose » nécessitant le lieu, résolus après placement.
    if (card.type === 'ally') {
      const hostEffects = (card.effects ?? []).filter(
        (e) =>
          e.type === 'PLAY_FREE_HYENA' ||
          e.type === 'GNOUS_MOVE' ||
          e.type === 'DISCARD_HERO_AT_HOST' ||
          e.type === 'ALLY_REMOTE_GAIN_POWER',
      )
      if (hostEffects.length > 0) {
        next = resolveEffects(next, hostEffects, {
          actorIndex: state.activePlayer,
          hostInstanceId: placed.instanceId,
          hostLocationId: destId,
        })
      }
    }
  } else if (card.goesToAuDelaOnPlay) {
    // Dr Facilier — Amis de l'au-delà / Régner : l'Événement va dans la Pile de
    // l'Au-delà au lieu de la défausse.
    next = updateActivePlayer(next, (p) => ({ ...p, auDela: [...p.auDela, card] }))
    next = { ...next, log: [...next.log, `**${card.name}** rejoint la Pile de l'Au-delà.`] }
  } else if (
    card.type === 'ingredient' &&
    !(activePlayer(next).ingredients ?? []).some((c) => c.cardId === card.cardId)
  ) {
    // La Méchante Reine — la 1ʳᵉ fois qu'un Ingrédient DIFFÉRENT est joué, il va
    // dans la zone Ingrédients (sous le plateau) au lieu de la défausse. Quand les
    // 4 Ingrédients différents y sont, la Maison des Nains est déverrouillée.
    next = updateActivePlayer(next, (p) => ({ ...p, ingredients: [...(p.ingredients ?? []), card] }))
    const count = activePlayer(next).ingredients?.length ?? 0
    next = { ...next, log: [...next.log, `**${card.name}** rejoint les Ingrédients (${count}/4).`] }
    if (count >= 4) {
      const cottage = activePlayer(next).cottageLocationId
      next = updateActivePlayer(next, (p) => ({
        ...p,
        lockedLocations: (p.lockedLocations ?? []).filter((l) => l !== cottage),
      }))
      next = { ...next, log: [...next.log, `🔓 Les 4 Ingrédients sont réunis : la **Maison des Nains** est déverrouillée !`] }
    }
  } else {
    next = updateActivePlayer(next, (p) => ({ ...p, discard: [...p.discard, card] }))
  }
  // Foudre : si la résolution a ouvert le choix de l'Ingrédient à reproduire, on
  // retient la carte Foudre et l'action pour permettre l'ANNULATION du coup.
  if (next.pendingDuplicateIngredient && next.pendingDuplicateIngredient.foudreInstanceId === undefined) {
    next = {
      ...next,
      pendingDuplicateIngredient: {
        ...next.pendingDuplicateIngredient,
        foudreInstanceId: card.instanceId,
        actionId,
      },
    }
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
  const reusedDiscard = state.usedActionIds.includes(actionId)
  if (reusedDiscard && !activePlayer(state).repeatActionAvailable) {
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
    repeatActionAvailable: reusedDiscard ? false : p.repeatActionAvailable,
  }))
  let consumed = consumePersifleur(next, action)
  consumed = {
    ...consumed,
    usedActionIds: [...consumed.usedActionIds, actionId],
    // Suivi des cartes défaussées ce tour-ci (déclencheur Désespoir, Dr Facilier).
    activeDiscardedCount: (consumed.activeDiscardedCount ?? 0) + discarded.length,
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

/** Déclencheurs « quand la cible subit une Fatalité » :
 *  - Bowser — Bowser Jr. : pioche 1 carte par Bowser Jr. présent.
 *  - La Méchante Reine — Miroir magique : pioche 1 carte par Miroir présent.
 *  - La Méchante Reine — Poussière de momie : +1 jeton Poison tant que le drapeau
 *    `poisonOnFateTargeted` est actif. Thread le rngState via state.rngState. */
function drawOnFateTargeted(state: GameState, targetIndex: number): GameState {
  let next = state
  const tgt0 = next.players[targetIndex]
  const sources =
    Object.values(tgt0.board).flat().filter((c) => c.type === 'ally' && c.cardId === 'bowser-jr').length +
    Object.values(tgt0.board).flat().filter((c) => c.type === 'item' && c.cardId === 'miroir-magique' && !c.attachedTo).length
  if (sources > 0) {
    const r = drawPlayerToLimitN(tgt0, next.rngState, sources)
    if (r.drawn > 0) {
      next = updatePlayer(next, targetIndex, () => r.player)
      next = {
        ...next,
        rngState: r.rngState,
        log: [...next.log, `${tgt0.villainName} pioche ${r.drawn} carte${r.drawn > 1 ? 's' : ''} (ciblé(e) par la Fatalité).`],
      }
    }
  }
  // Poussière de momie : chaque Fatalité subie ajoute 1 jeton Poison.
  if (next.players[targetIndex].poisonOnFateTargeted) {
    next = updatePlayer(next, targetIndex, (p) => ({ ...p, poison: (p.poison ?? 0) + 1 }))
    next = {
      ...next,
      log: [...next.log, `Poussière de momie : ${next.players[targetIndex].villainName} gagne 1 jeton Poison.`],
    }
  }
  return next
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
  // Yzma : Fatalité spéciale (4 pioches). L'adversaire choisit une pioche, voit
  // toutes ses cartes, en joue une sur le lieu, remélange le reste.
  if (tgt.fateDecks) {
    return applyFateYzma(state, target, actionId)
  }
  if (tgt.fateDeck.length + tgt.fateDiscard.length === 0) {
    throw new Error(`Le deck Fatalité de ${tgt.villainName} est vide.`)
  }

  const r = revealFate(tgt, FATE_REVEAL, state.rngState)
  // Héros « joué d'office dès qu'il est dévoilé » (Peter Pan → Arbre du Pendu,
  // Blanche-Neige → Maison des Nains) : data-driven via `forcedFateLocation`. Il
  // est posé immédiatement sur SON lieu (verrouillé ou non) et les autres cartes
  // dévoilées sont défaussées — pas de choix de Fatalité.
  const pp = r.revealed.find((c) => c.type === 'hero' && c.forcedFateLocation)
  if (pp) {
    const forced = pp.forcedFateLocation!
    const forcedName = tgt.locations.find((l) => l.id === forced)?.name ?? forced
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
      activeFateTargets: [...(next.activeFateTargets ?? []), target],
      log: [...next.log, `${me.villainName} lance la Fatalité : **${pp.name}** est dévoilé(e) et joué(e) d'office sur **${forcedName}** !`],
    }
    return placeFateHeroWithEffects(next, target, state.activePlayer, pp, forced, forcedName)
  }
  let next = updatePlayer(state, target, () => r.player)
  next = { ...next, rngState: r.rngState }
  // Apparence de Dragon : si la cible avait armé sa récompense, +3 JT immédiats.
  next = consumeDragonFormReward(next, target)
  next = consumePersifleur(next, action)
  // Bowser Jr. : la cible pioche 1 carte par Bowser Jr. présent (peut remélanger
  // → on a déjà fixé rngState ci-dessus, le helper le fait évoluer).
  next = drawOnFateTargeted(next, target)
  return {
    ...next,
    usedActionIds: [...next.usedActionIds, actionId],
    pendingFate: { target, revealed: r.revealed },
    activeFateTargets: [...(next.activeFateTargets ?? []), target],
    log: [
      ...next.log,
      `${me.villainName} lance la Fatalité contre ${tgt.villainName} (révèle ${r.revealed.length} carte${r.revealed.length > 1 ? 's' : ''}).`,
    ],
  }
}

/** Yzma — redistribue la défausse Fatalité (mélangée) en 4 pioches les plus égales
 *  possibles, indexées par id de lieu. */
function redistributeYzmaFateDecks(
  player: PlayerState,
  rngState: number,
): { decks: Record<string, CardInstance[]>; rngState: number } {
  const ids = player.locations.map((l) => l.id)
  const sh = shuffle(player.fateDiscard, rngState)
  const decks: Record<string, CardInstance[]> = Object.fromEntries(ids.map((id) => [id, []]))
  sh.result.forEach((c, i) => decks[ids[i % ids.length]].push(c))
  return { decks, rngState: sh.state }
}

/** Yzma — lance la Fatalité : ouvre le choix de pioche (par lieu) pour l'adversaire.
 *  Si toutes les pioches sont vides, la défausse est d'abord redistribuée en 4. */
function applyFateYzma(state: GameState, target: number, actionId: string): GameState {
  let next = state
  const tgt0 = next.players[target]
  const decks0 = tgt0.fateDecks ?? {}
  const totalInDecks = Object.values(decks0).reduce((n, d) => n + d.length, 0)
  if (totalInDecks === 0) {
    if (tgt0.fateDiscard.length === 0) {
      throw new Error(`Les pioches Fatalité de ${tgt0.villainName} sont vides.`)
    }
    const r = redistributeYzmaFateDecks(tgt0, next.rngState)
    next = {
      ...updatePlayer(next, target, (p) => ({ ...p, fateDecks: r.decks, fateDiscard: [] })),
      rngState: r.rngState,
      log: [...next.log, `Les pioches Fatalité de ${tgt0.villainName} sont vides : la défausse est mélangée et redistribuée en 4 pioches.`],
    }
  }
  const me = activePlayer(next)
  return {
    ...next,
    usedActionIds: [...next.usedActionIds, actionId],
    activeFateTargets: [...(next.activeFateTargets ?? []), target],
    pendingYzmaFate: { chooserIndex: next.activePlayer, targetIndex: target, phase: 'deck' },
    log: [
      ...next.log,
      `${me.villainName} lance la Fatalité contre ${next.players[target].villainName} : choisissez une pioche (par lieu).`,
    ],
  }
}

/** Yzma (Fatalité) — l'adversaire choisit la pioche d'un lieu : on lui dévoile toutes
 *  ses cartes (tenues dans le pending), puis il en jouera une (RESOLVE_YZMA_FATE_CARD). */
function applyResolveYzmaFateDeck(state: GameState, locationId: LocationId): GameState {
  const pending = state.pendingYzmaFate
  if (!pending || pending.phase !== 'deck') throw new Error('Aucun choix de pioche Fatalité (Yzma) en attente.')
  const tgt = state.players[pending.targetIndex]
  const deck = tgt.fateDecks?.[locationId] ?? []
  if (deck.length === 0) throw new Error('Cette pioche Fatalité est vide : choisissez-en une autre.')
  const next = updatePlayer(state, pending.targetIndex, (p) => ({
    ...p,
    fateDecks: { ...(p.fateDecks ?? {}), [locationId]: [] },
  }))
  const locName = tgt.locations.find((l) => l.id === locationId)?.name ?? locationId
  return {
    ...next,
    pendingYzmaFate: { ...pending, phase: 'card', locationId, cards: deck },
    log: [
      ...next.log,
      `${state.players[pending.chooserIndex].villainName} consulte la pioche Fatalité de **${locName}** (${deck.length} carte${deck.length > 1 ? 's' : ''}).`,
    ],
  }
}

/** Yzma (Fatalité) — l'adversaire joue la carte choisie sur le lieu (ou aucune), et
 *  le reste de la pioche est remélangé puis replacé. */
function applyResolveYzmaFateCard(state: GameState, instanceId: string | null): GameState {
  const pending = state.pendingYzmaFate
  if (!pending || pending.phase !== 'card' || !pending.locationId || !pending.cards) {
    throw new Error('Aucune carte Fatalité (Yzma) à jouer en attente.')
  }
  const { targetIndex, chooserIndex, locationId, cards } = pending
  const tgt = state.players[targetIndex]
  const locName = tgt.locations.find((l) => l.id === locationId)?.name ?? locationId
  const chosen = instanceId ? cards.find((c) => c.instanceId === instanceId) : undefined
  const rest = chosen ? cards.filter((c) => c.instanceId !== chosen.instanceId) : cards
  // Remélange le reste dans la pioche du lieu.
  const sh = shuffle(rest, state.rngState)
  let next: GameState = {
    ...updatePlayer(state, targetIndex, (p) => ({
      ...p,
      fateDecks: { ...(p.fateDecks ?? {}), [locationId]: sh.result },
    })),
    rngState: sh.state,
    pendingYzmaFate: null,
  }
  if (!chosen) {
    return { ...next, log: [...next.log, `Aucune carte jouée : la pioche de **${locName}** est replacée.`] }
  }
  if (chosen.type === 'hero') {
    return placeFateHeroWithEffects(next, targetIndex, chooserIndex, chosen, locationId, locName)
  }
  // Carte Fatalité non-Héros (Événement) : résout ses effets (Phase 3) puis défausse.
  next = resolveEffects(next, chosen.effects ?? [], { actorIndex: targetIndex })
  next = updatePlayer(next, targetIndex, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen] }))
  return { ...next, log: [...next.log, `**${chosen.name}** est jouée sur **${locName}**.`] }
}

/** Yzma — À l'attaque ! / Marteau : agit sur la pioche Fatalité du lieu choisi. */
function applyResolveYzmaOwnDeck(state: GameState, locationId: LocationId): GameState {
  const pending = state.pendingYzmaOwnDeck
  if (!pending) throw new Error('Aucune action de pioche (Yzma) en attente.')
  const idx = pending.playerIndex
  const p = state.players[idx]
  // Indiscrétion (snoop) : 1er appel = dévoile la pioche choisie (montrée au joueur,
  // remélangée pour le replacement) ; 2ᵉ appel (revealCards déjà posé) = referme.
  if (pending.mode === 'snoop') {
    if (pending.revealCards) {
      return { ...state, pendingYzmaOwnDeck: null, log: [...state.log, 'Indiscrétion : pioche replacée.'] }
    }
    const deck0 = p.fateDecks?.[locationId] ?? []
    if (deck0.length === 0) throw new Error('Cette pioche Fatalité est vide : choisissez-en une autre.')
    const sh0 = shuffle(deck0, state.rngState)
    const locName0 = p.locations.find((l) => l.id === locationId)?.name ?? locationId
    return {
      ...updatePlayer(state, idx, (pp) => ({ ...pp, fateDecks: { ...(pp.fateDecks ?? {}), [locationId]: sh0.result } })),
      rngState: sh0.state,
      pendingYzmaOwnDeck: { ...pending, revealCards: deck0 },
      log: [...state.log, `Indiscrétion : ${p.villainName} regarde la pioche de **${locName0}** (${deck0.length} cartes).`],
    }
  }
  // À l'attaque ! : DEUX temps. 1) on dévoile TOUTE la pioche choisie (montrée au
  // joueur, comme Indiscrétion). 2) à la fermeture du modal, on exécute : Héros joués
  // sur ce lieu, Mauvais levier déclenché+défaussé, autres Événements remélangés.
  if (pending.mode === 'attack') {
    if (!pending.revealCards) {
      const deck0 = p.fateDecks?.[locationId] ?? []
      if (deck0.length === 0) throw new Error('Cette pioche Fatalité est vide : choisissez-en une autre.')
      const locName0 = p.locations.find((l) => l.id === locationId)?.name ?? locationId
      const names = deck0.map((c) => `**${c.name}**`).join(', ')
      return {
        ...state,
        pendingYzmaOwnDeck: { ...pending, revealCards: deck0, revealLocationId: locationId },
        log: [
          ...state.log,
          `À l'attaque ! : ${p.villainName} dévoile toute la pioche de **${locName0}** (${deck0.length} carte${deck0.length > 1 ? 's' : ''} : ${names}).`,
        ],
      }
    }
    // 2ᵉ temps : exécuter sur la pioche dévoilée.
    const loc = pending.revealLocationId ?? locationId
    const deck = p.fateDecks?.[loc] ?? []
    const locName = p.locations.find((l) => l.id === loc)?.name ?? loc
    const heroes = deck.filter((c) => c.type === 'hero')
    const revealTriggered = deck.filter((c) => c.cardId === 'mauvais-levier')
    const others = deck.filter((c) => c.type !== 'hero' && c.cardId !== 'mauvais-levier')
    const sh = shuffle(others, state.rngState)
    let next: GameState = {
      ...updatePlayer(state, idx, (pp) => ({ ...pp, fateDecks: { ...(pp.fateDecks ?? {}), [loc]: sh.result } })),
      rngState: sh.state,
      pendingYzmaOwnDeck: null,
    }
    for (const hero of heroes) {
      next = placeFateHeroWithEffects(next, idx, idx, hero, loc, locName)
      if (next.status === 'WON') return next
    }
    for (const c of revealTriggered) {
      next = resolveEffects(next, c.effects ?? [], { actorIndex: idx })
      next = updatePlayer(next, idx, (pp) => ({ ...pp, fateDiscard: [...pp.fateDiscard, c] }))
      next = { ...next, log: [...next.log, `À l'attaque ! : **${c.name}** se déclenche puis est défaussée.`] }
    }
    return {
      ...next,
      log: [...next.log, `À l'attaque ! : ${heroes.length} Héros joué${heroes.length > 1 ? 's' : ''} sur **${locName}**.`],
    }
  }
  const deck = p.fateDecks?.[locationId] ?? []
  if (deck.length === 0) throw new Error('Cette pioche Fatalité est vide : choisissez-en une autre.')
  const locName = p.locations.find((l) => l.id === locationId)?.name ?? locationId
  if (pending.mode === 'hammer') {
    // Le joueur choisit lui-même les 2 cartes à défausser, mais FACE CACHÉE
    // (« au hasard ») : on remélange la pioche et on présente les dos. Le choix porte
    // donc sur des cartes dont l'identité reste cachée (RESOLVE_YZMA_HAMMER).
    const sh = shuffle(deck, state.rngState)
    const count = Math.min(2, sh.result.length)
    return {
      ...updatePlayer(state, idx, (pp) => ({
        ...pp,
        fateDecks: { ...(pp.fateDecks ?? {}), [locationId]: sh.result },
      })),
      rngState: sh.state,
      pendingYzmaOwnDeck: { ...pending, hammerPick: { locationId, cards: sh.result, count } },
      log: [
        ...state.log,
        `Je l'écraserai avec un marteau : ${p.villainName} choisit ${count} carte${count > 1 ? 's' : ''} (face cachée) à défausser de la pioche de **${locName}**.`,
      ],
    }
  }
  throw new Error(`Mode de pioche Yzma non géré : ${pending.mode}.`)
}

/** Yzma — Marteau : défausse les cartes choisies (face cachée) de la pioche. */
function applyResolveYzmaHammer(state: GameState, instanceIds: string[]): GameState {
  const pending = state.pendingYzmaOwnDeck
  if (!pending || !pending.hammerPick) throw new Error('Aucun choix de défausse (Marteau) en attente.')
  const idx = pending.playerIndex
  const p = state.players[idx]
  const { locationId, cards, count } = pending.hammerPick
  if (instanceIds.length !== count) throw new Error(`Marteau : choisissez exactement ${count} carte(s) à défausser.`)
  for (const id of instanceIds) {
    if (!cards.some((c) => c.instanceId === id)) throw new Error('Marteau : carte choisie invalide.')
  }
  const ids = new Set(instanceIds)
  const deck = p.fateDecks?.[locationId] ?? []
  const discarded = deck.filter((c) => ids.has(c.instanceId))
  const rest = deck.filter((c) => !ids.has(c.instanceId))
  const locName = p.locations.find((l) => l.id === locationId)?.name ?? locationId
  const next: GameState = {
    ...updatePlayer(state, idx, (pp) => ({
      ...pp,
      fateDecks: { ...(pp.fateDecks ?? {}), [locationId]: rest },
      fateDiscard: [...pp.fateDiscard, ...discarded],
    })),
    pendingYzmaOwnDeck: null,
  }
  let withLog: GameState = {
    ...next,
    log: [
      ...next.log,
      `Je l'écraserai avec un marteau : ${discarded.length} carte${discarded.length > 1 ? 's' : ''} défaussée${discarded.length > 1 ? 's' : ''} de la pioche de **${locName}** (${discarded.map((c) => c.name).join(', ')}).`,
    ],
  }
  // Mauvais levier défaussé par le marteau : son effet (Yzma perd la moitié de son
  // Pouvoir) se déclenche aussi (comme à la révélation par À l'attaque !).
  for (const c of discarded.filter((c) => c.cardId === 'mauvais-levier')) {
    withLog = resolveEffects(withLog, c.effects ?? [], { actorIndex: idx })
    withLog = { ...withLog, log: [...withLog.log, `Je l'écraserai avec un marteau : **${c.name}** se déclenche en étant défaussée.`] }
  }
  // Si Kuzco vient d'être défaussé, tout est remélangé et reformé en 4 pioches.
  return reshuffleYzmaIfKuzcoDiscarded(withLog, idx)
}

/** Yzma — Paysan / Attention au groove ! / Pacha : mélange (optionnel) un Héros de la
 *  défausse et/ou des pioches choisies, reformées également. */
function applyResolveYzmaManipulate(
  state: GameState,
  heroInstanceId: string | null,
  locationIds: LocationId[],
): GameState {
  const pending = state.pendingYzmaManipulate
  if (!pending) throw new Error('Aucune manipulation de pioches (Yzma) en attente.')
  const idx = pending.playerIndex
  const p = state.players[idx]
  // Refus (« Vous pouvez ») : aucun Héros et aucune pioche choisis.
  if (heroInstanceId === null && locationIds.length === 0) {
    if (!pending.optional) throw new Error('Cette manipulation est obligatoire : choisissez une pioche.')
    return { ...state, pendingYzmaManipulate: null, log: [...state.log, `${p.villainName} renonce à manipuler ses pioches Fatalité.`] }
  }
  if (locationIds.length < 1 || locationIds.length > pending.count) {
    throw new Error(`Choisissez de 1 à ${pending.count} pioche(s) Fatalité.`)
  }
  const ids = p.locations.map((l) => l.id)
  for (const loc of locationIds) {
    if (!ids.includes(loc)) throw new Error('Pioche Fatalité invalide.')
  }
  if (pending.mode === 'hero-to-decks') {
    if (heroInstanceId === null || !pending.heroIds.includes(heroInstanceId)) {
      throw new Error('Choisissez un Héros valide de la défausse Fatalité.')
    }
    const hero = p.fateDiscard.find((c) => c.instanceId === heroInstanceId)
    if (!hero) throw new Error('Héros introuvable dans la défausse Fatalité.')
    const next0 = updatePlayer(state, idx, (pp) => ({
      ...pp,
      fateDiscard: pp.fateDiscard.filter((c) => c.instanceId !== heroInstanceId),
    }))
    const next = reformYzmaDecks(next0, idx, locationIds, [hero])
    return {
      ...next,
      pendingYzmaManipulate: null,
      log: [...next.log, `**${hero.name}** est mélangé dans ${locationIds.length} pioche(s) Fatalité.`],
    }
  }
  // reshuffle (Pacha) : mélange les pioches choisies, reformées également.
  const next = reformYzmaDecks(state, idx, locationIds, [])
  return {
    ...next,
    pendingYzmaManipulate: null,
    log: [...next.log, `${locationIds.length} pioches Fatalité sont mélangées et reformées.`],
  }
}

/** Yzma — Ironie du sort : rejoue l'Événement choisi de la défausse (paie son coût). */
function applyResolveReplayEvent(state: GameState, instanceId: string | null): GameState {
  const pending = state.pendingReplayEvent
  if (!pending) throw new Error('Aucun Événement à rejouer (Ironie du sort) en attente.')
  const idx = pending.playerIndex
  const p = state.players[idx]
  if (instanceId === null) {
    return { ...state, pendingReplayEvent: null, log: [...state.log, 'Ironie du sort : aucun Événement rejoué.'] }
  }
  if (!pending.candidateIds.includes(instanceId)) throw new Error('Événement choisi invalide (Ironie du sort).')
  const ev = p.discard.find((c) => c.instanceId === instanceId)
  if (!ev) throw new Error('Événement introuvable dans la défausse.')
  const cost = ev.cost ?? 0
  if (p.power < cost) throw new Error('Pas assez de Pouvoir pour rejouer cet Événement.')
  let next: GameState = { ...updatePlayer(state, idx, (pp) => ({ ...pp, power: pp.power - cost })), pendingReplayEvent: null }
  next = { ...next, log: [...next.log, `Ironie du sort : **${ev.name}** est rejoué (coût ${cost}).`] }
  next = resolveEffects(next, ev.effects ?? [], { actorIndex: idx })
  return next
}

/** Yzma — Finis le travail : choisir un Allié (phase 1) puis un lieu portant un Héros
 *  (phase 2) ; l'Allié (et ses Objets) y est déplacé. */
function applyResolveFinishJob(state: GameState, allyInstanceId?: string, to?: LocationId): GameState {
  const pending = state.pendingFinishJob
  if (!pending) throw new Error('Aucun déplacement (Finis le travail) en attente.')
  const idx = pending.playerIndex
  const p = state.players[idx]
  if (!pending.allyInstanceId) {
    if (!allyInstanceId) throw new Error('Finis le travail : précisez l’Allié à déplacer.')
    const a = Object.values(p.board).flat().find((c) => c.instanceId === allyInstanceId)
    if (!a || a.type !== 'ally') throw new Error('Finis le travail : Allié invalide.')
    return { ...state, pendingFinishJob: { ...pending, allyInstanceId } }
  }
  if (!to) throw new Error('Finis le travail : précisez le lieu de destination.')
  const allyId = pending.allyInstanceId
  const from = locationOfCard(p, allyId)
  if (!from) throw new Error('Finis le travail : Allié introuvable.')
  if (!(p.board[to] ?? []).some((c) => c.type === 'hero')) {
    throw new Error('Finis le travail : ce lieu ne porte aucun Héros.')
  }
  const moving = (p.board[from] ?? []).filter((c) => c.instanceId === allyId || c.attachedTo === allyId)
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const ally = moving.find((c) => c.instanceId === allyId)!
  const destName = findLocation(p, to)?.name ?? to
  let next: GameState = {
    ...updatePlayer(state, idx, (pp) => ({
      ...pp,
      board: {
        ...pp.board,
        [from]: (pp.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
        [to]: [...(pp.board[to] ?? []), ...moving],
      },
    })),
    pendingFinishJob: null,
    log: [...state.log, `Finis le travail : **${ally.name}** est déplacé vers **${destName}**.`],
  }
  // Kronk gagne un jeton Pouvoir à chaque déplacement.
  if (ally.cardId === 'kronk') next = addKronkTokens(next, idx, 1)
  return next
}

/**
 * Yzma — Beauté endormie (effet différé, début de tour avant déplacement) :
 * applique les choix indépendants — gagner 2 JT, piocher 2 cartes, déplacer un
 * Héros du royaume vers un lieu voisin — puis ferme le pending (le déplacement du
 * pion redevient possible).
 */
function applyResolveBeautySleep(
  state: GameState,
  gainPower: boolean,
  draw: boolean,
  heroMove: { heroInstanceId: string; to: LocationId } | null,
): GameState {
  const pending = state.pendingBeautySleep
  if (!pending) throw new Error('Aucun réveil (Beauté endormie) en attente.')
  const idx = pending.playerIndex
  let next: GameState = state
  // 1) Gain de 2 jetons Pouvoir.
  if (gainPower) {
    next = updatePlayer(next, idx, (p) => ({ ...p, power: p.power + 2 }))
  }
  // 2) Pioche de 2 cartes.
  let drawn = 0
  if (draw) {
    const dr = drawPlayerToLimitN(next.players[idx], next.rngState, 2)
    drawn = dr.drawn
    next = { ...next, rngState: dr.rngState, players: next.players.map((p, i) => (i === idx ? dr.player : p)) }
  }
  // 3) Déplacement d'un Héros du royaume vers un lieu voisin (réutilise
  //    MOVE_HERO_TO_LOCATION : restrictions de destination + arrivées).
  if (heroMove) {
    const p = next.players[idx]
    const from = locationOfCard(p, heroMove.heroInstanceId)
    if (!from) throw new Error('Beauté endormie : Héros introuvable dans votre royaume.')
    const hero = (p.board[from] ?? []).find((c) => c.instanceId === heroMove.heroInstanceId)
    if (!hero || hero.type !== 'hero') throw new Error('Beauté endormie : cible invalide (pas un Héros).')
    if (!adjacentLocationIds(next, from).includes(heroMove.to)) {
      throw new Error(`Beauté endormie : « ${heroMove.to} » n'est pas voisin de « ${from} ».`)
    }
    next = resolveEffects(next, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: heroMove.to }], {
      targetHeroId: heroMove.heroInstanceId,
    })
  }
  const parts: string[] = []
  if (gainPower) parts.push('gagne 2 JT')
  if (draw) parts.push(`pioche ${drawn} carte${drawn > 1 ? 's' : ''}`)
  if (heroMove) parts.push('déplace un Héros')
  const villainName = next.players[idx].villainName
  return {
    ...next,
    pendingBeautySleep: null,
    log: [
      ...next.log,
      parts.length > 0
        ? `Beauté endormie : ${villainName} ${parts.join(', ')}.`
        : `Beauté endormie : ${villainName} ne fait rien de son réveil.`,
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
  // Dr Facilier — déclencheurs « à la pose d'un Héros » (Talisman, Lawrence).
  next = applyFacilierHeroPlayTriggers(next, targetIndex, hero.instanceId, to)
  return next
}

/** Dr Facilier — déclencheurs lorsqu'un Héros est joué dans le royaume de
 *  `targetIndex` (sur `to`) :
 *  - Talisman : s'il est posé LIBREMENT dans le royaume et que le Héros a une force
 *    ≤ 3, on l'associe à ce Héros (il le suit sur son lieu).
 *  - Lawrence : présent dans le royaume, il rejoint le lieu du Héros (auto). */
function applyFacilierHeroPlayTriggers(
  state: GameState,
  targetIndex: number,
  heroInstanceId: string,
  to: LocationId,
): GameState {
  let next = state
  const player = next.players[targetIndex]
  const hero = (player.board[to] ?? []).find((c) => c.instanceId === heroInstanceId)
  if (!hero || hero.type !== 'hero') return next

  // Talisman : associé au Héros joué si force ≤ 3 et Talisman libre dans le royaume.
  if ((hero.strength ?? 0) <= 3) {
    let talisLoc: LocationId | undefined
    let talisman: CardInstance | undefined
    for (const loc of player.locations) {
      const found = (player.board[loc.id] ?? []).find((c) => c.cardId === 'talisman' && !c.attachedTo)
      if (found) { talisLoc = loc.id; talisman = found; break }
    }
    if (talisman && talisLoc) {
      const tl = talisLoc
      const attached: CardInstance = { ...talisman, attachedTo: heroInstanceId }
      next = updatePlayer(next, targetIndex, (p) => ({
        ...p,
        board: {
          ...p.board,
          [tl]: (p.board[tl] ?? []).filter((c) => c.instanceId !== talisman!.instanceId),
          [to]: [...(p.board[to] ?? []).filter((c) => c.instanceId !== talisman!.instanceId), attached],
        },
      }))
      next = { ...next, log: [...next.log, `Le **Talisman** s'associe à **${hero.name}** (force ≤ 3).`] }
    }
  }

  // Lawrence : rejoint le lieu du Héros (avec ses Objets associés).
  let lawLoc: LocationId | undefined
  let lawrence: CardInstance | undefined
  for (const loc of next.players[targetIndex].locations) {
    const found = (next.players[targetIndex].board[loc.id] ?? []).find((c) => c.cardId === 'lawrence')
    if (found) { lawLoc = loc.id; lawrence = found; break }
  }
  if (lawrence && lawLoc && lawLoc !== to) {
    const ll = lawLoc
    const moving = (next.players[targetIndex].board[ll] ?? []).filter(
      (c) => c.instanceId === lawrence!.instanceId || c.attachedTo === lawrence!.instanceId,
    )
    const movingIds = new Set(moving.map((c) => c.instanceId))
    next = updatePlayer(next, targetIndex, (p) => ({
      ...p,
      board: {
        ...p.board,
        [ll]: (p.board[ll] ?? []).filter((c) => !movingIds.has(c.instanceId)),
        [to]: [...(p.board[to] ?? []), ...moving],
      },
    }))
    next = { ...next, log: [...next.log, `**Lawrence** rejoint **${hero.name}**.`] }
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

  // Ballon de fortune (Ratigan, Fatalité) : +2 Force au Héros porteur (attachStrengthBonus),
  // puis on peut le déplacer immédiatement (auto : Buckingham Palace, il emporte le Ballon).
  if (chosen.cardId === 'ballon-de-fortune') {
    const heroLoc = locationOfCard(tgt, hero.instanceId)
    if (!heroLoc) throw new Error(`Lieu du Héros « ${hero.name} » introuvable.`)
    const equipped: CardInstance = { ...chosen, attachedTo: hero.instanceId }
    let next = updatePlayer(state, targetIndex, (p) => ({
      ...p,
      board: { ...p.board, [heroLoc]: [...(p.board[heroLoc] ?? []), equipped] },
    }))
    next = { ...next, log: [...next.log, `${playedByName} associe **${chosen.name}** à **${hero.name}** (+2 Force).`] }
    return resolveEffects(next, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: 'buckingham-palace' }], {
      actorIndex: targetIndex,
      targetHeroId: hero.instanceId,
    })
  }

  // Objets Fatalité « purement associés » à un Héros (attach: 'hero') sans effet
  // spécifique à l'attache : Provocation (ordre d'élimination), Poussière de Fée /
  // Vœu (+force via attachStrengthBonus), Bigette (coût des Pactes), Zirgouflex
  // (Ursula perd 1 JT en arrivant). Leur comportement est lu ailleurs depuis
  // `attachedTo` ; ici on se contente de les associer au Héros choisi.
  if (chosen.type === 'item' && chosen.attach === 'hero') {
    const heroLoc = locationOfCard(tgt, hero.instanceId)
    if (!heroLoc) throw new Error(`Lieu du Héros « ${hero.name} » introuvable.`)
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
/** Une carte Fatalité révélée est-elle JOUABLE sur la cible (sinon elle serait
 *  juste défaussée) ? Sert au combo Ray : on ne rouvre la Fatalité pour la 2ᵉ
 *  carte que si elle peut réellement être jouée. */
function fateCardPlayable(state: GameState, card: CardInstance, target: number): boolean {
  if (card.type === 'hero') return heroPlacementLocations(state, card, target).length > 0
  if (
    card.cardId === 'voler-riches' ||
    card.cardId === 'agrandir' ||
    (card.type === 'item' && card.attach === 'hero')
  ) {
    return Object.values(state.players[target].board)
      .flat()
      .some((c) => c.type === 'hero' && !c.hypnotized)
  }
  // Premier baiser d'amour : sans effet si la cible n'a ni Poison ni Héros dans sa
  // défausse Fatalité.
  if (card.cardId === 'premier-baiser') {
    const tgt = state.players[target]
    return (tgt.poison ?? 0) > 0 || tgt.fateDiscard.some((c) => c.type === 'hero')
  }
  return true
}

/** Résout une Fatalité révélée. Wrapper du combo RAY (Dr Facilier) : si Ray fait
 *  partie des deux cartes dévoilées, après avoir résolu la 1ʳᵉ on PEUT aussi jouer
 *  l'autre (si elle est jouable) — on rouvre alors la Fatalité avec cette carte. */
function applyResolveFate(
  state: GameState,
  instanceId: string,
  to?: string,
  targetHeroId?: string,
  enlargeToward?: string,
): GameState {
  const pending = state.pendingFate
  const revealed = pending?.revealed ?? []
  // Combo « jouer les deux » (data-driven, fatePlayBoth : Ray, Dormeur). On
  // n'active le combo que tant que la Fatalité courante n'est PAS déjà la 2ᵉ carte
  // facultative (sinon on bouclerait).
  const canPlayBoth = revealed.some((c) => c.fatePlayBoth) && !pending?.optional
  const others = revealed.filter((c) => c.instanceId !== instanceId)
  const target = pending?.target ?? -1

  const next = applyResolveFateInner(state, instanceId, to, targetHeroId, enlargeToward)

  // Combo : exactement une autre carte révélée, aucune autre résolution en attente,
  // et cette carte est jouable → on rouvre la Fatalité (2ᵉ carte FACULTATIVE).
  if (
    canPlayBoth &&
    others.length === 1 &&
    next.pendingFate == null &&
    next.status === 'PLAYING' &&
    !next.pendingHeroPlacement &&
    !next.pendingFateChoice &&
    !next.pendingPawnMove &&
    !next.pendingHubertPull &&
    !next.pendingTitanSelect &&
    !next.pendingHeroRelocate &&
    !next.pendingAllyRelocate &&
    !next.pendingFateScry
  ) {
    const other = others[0]
    if (
      fateCardPlayable(next, other, target) &&
      next.players[target].fateDiscard.some((c) => c.instanceId === other.instanceId)
    ) {
      const reopened = updatePlayer(next, target, (p) => ({
        ...p,
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== other.instanceId),
      }))
      return {
        ...reopened,
        // 2ᵉ carte FACULTATIVE : peut être jouée (RESOLVE_FATE) ou passée (PASS_FATE).
        pendingFate: { target, revealed: [other], optional: true },
        log: [...reopened.log, `Vous pouvez aussi jouer **${other.name}** (ou passer).`],
      }
    }
  }
  return next
}

/** Passe la 2ᵉ carte FACULTATIVE d'un combo « jouer les deux » (Ray/Dormeur) :
 *  la carte révélée restante est défaussée sans être jouée. N'est licite que
 *  pour une Fatalité marquée `optional`. */
function applyPassFate(state: GameState): GameState {
  const pending = state.pendingFate
  if (!pending || !pending.optional) {
    throw new Error('Aucune carte Fatalité facultative à passer.')
  }
  const next = updatePlayer(state, pending.target, (p) => ({
    ...p,
    fateDiscard: [...p.fateDiscard, ...pending.revealed],
  }))
  const names = pending.revealed.map((c) => `**${c.name}**`).join(', ')
  return {
    ...next,
    pendingFate: null,
    log: [...next.log, `Carte Fatalité non jouée : ${names} défaussée.`],
  }
}

function applyResolveFateInner(
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
    // Blanche-Neige (forcedFateLocation) : posée d'office sur la Maison des Nains,
    // même verrouillée, quel que soit le choix de l'adversaire.
    if (chosen.forcedFateLocation) {
      const forced = chosen.forcedFateLocation
      let next = updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, ...others] }))
      next = { ...next, pendingFate: null }
      const dest = findLocation(tgt, forced)
      return placeFateHeroWithEffects(next, pending.target, state.activePlayer, chosen, forced, dest?.name ?? forced)
    }
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
  // Épée de Vérité, Lampe de poche, plus tout Objet « purement associé » à un
  // Héros (attach: 'hero' : Provocation, Poussière de Fée, Vœu, Bigette,
  // Zirgouflex…). Effet partagé avec le MODE TEST (resolveFateCardOnHero) ; on
  // défausse ici l'AUTRE carte révélée et on referme la Fatalité avant de déléguer.
  if (
    chosen.cardId === 'voler-riches' ||
    (chosen.type === 'item' && chosen.attach === 'hero')
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

  // Flèche de Mome Raths (Reine de Cœur, Fatalité) : le joueur qui pose la Fatalité
  // déplace un Allié du royaume de la cible vers le lieu (non bloqué) de son choix.
  // Sans Allié déplaçable, simple défausse.
  if (chosen.cardId === 'fleche-mome-raths') {
    const candidates = Object.values(tgt.board)
      .flat()
      .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    if (candidates.length === 0) {
      return { ...next, log: [...next.log, `**Flèche de Mome Raths** : aucun Allié à déplacer chez ${tgt.villainName}.`] }
    }
    return {
      ...next,
      pendingAllyRelocate: { chooserIndex: state.activePlayer, targetIndex: pending.target },
      log: [...next.log, `**Flèche de Mome Raths** : ${state.players[state.activePlayer].villainName} déplace un Allié de ${tgt.villainName}.`],
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

  // Éclairs (Hadès, Fatalité) : entrave tous les Titans d'un lieu (le plus fourni).
  if (chosen.cardId === 'eclairs') {
    let next = updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen, ...others] }))
    next = { ...next, pendingFate: null }
    return resolveEffects(next, [{ type: 'TRAP_TITANS_AT_BEST_LOCATION' }], { actorIndex: pending.target })
  }

  // De zéro en héros (Hadès, Fatalité) : repousse le Titan le plus avancé de 2 lieux.
  if (chosen.cardId === 'de-zero-heros') {
    let next = updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen, ...others] }))
    next = { ...next, pendingFate: null }
    return resolveEffects(next, [{ type: 'PUSH_TITAN_BACK_AUTO', steps: 2 }], { actorIndex: pending.target })
  }

  // Du gospel pur ! (Hadès, Fatalité) : défausse un Allié ou un Objet du royaume
  // de la cible (auto : un Allié non-Titan en priorité, sinon un Objet, sinon un Titan).
  if (chosen.cardId === 'du-gospel-pur') {
    let next = updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen, ...others] }))
    next = { ...next, pendingFate: null }
    const realm = tgt.locations.flatMap((l) => (next.players[pending.target].board[l.id] ?? []).map((c) => ({ c, loc: l.id })))
    const pick =
      realm.find(({ c }) => c.type === 'ally' && !c.isTitan && !c.attachedTo && !c.isWicket) ??
      realm.find(({ c }) => c.type === 'item' && !c.attachedTo) ??
      realm.find(({ c }) => c.type === 'ally' && !c.attachedTo)
    if (!pick) {
      return { ...next, log: [...next.log, `Du gospel pur ! : aucun Allié ni Objet à défausser chez ${tgt.villainName}.`] }
    }
    const attached = (next.players[pending.target].board[pick.loc] ?? []).filter((c) => c.attachedTo === pick.c.instanceId)
    const removed = new Set([pick.c.instanceId, ...attached.map((c) => c.instanceId)])
    next = updatePlayer(next, pending.target, (p) => ({
      ...p,
      board: { ...p.board, [pick.loc]: (p.board[pick.loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
      discard: [...p.discard, pick.c, ...attached],
    }))
    return { ...next, log: [...next.log, `Du gospel pur ! : **${pick.c.name}** est défaussé(e) du royaume de ${tgt.villainName}.`] }
  }

  // Dr Facilier (Fatalité) — L'étoile du soir / Si près du but : Événements qui
  // alimentent la Pile de l'Au-delà de la cible. On résout leurs effets puis on
  // défausse la carte.
  if (chosen.cardId === 'etoile-du-soir' || chosen.cardId === 'si-pres-du-but') {
    let next = updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen, ...others] }))
    next = { ...next, pendingFate: null }
    return resolveEffects(next, chosen.effects ?? [], { actorIndex: pending.target })
  }

  // Bowser (Fatalité) — Événements résolus sur la CIBLE : « Vous avez obtenu une
  // grande étoile ! » (remet une Étoile), « Goinfre » (la cible perd 2 JT) et
  // « Comète farceuse » (défausse un Objet). Effets portés par chosen.effects.
  if (chosen.cardId === 'gain-grand-star' || chosen.cardId === 'monnaie' || chosen.cardId === 'comete') {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    // Showcase : l'Événement Fatalité s'affiche en grand côté joueur qui le pose.
    next = pushShowcase(next, chosen.cardId, `${tgt.villainName} subit ${chosen.name}`, state.activePlayer)
    return resolveEffects(next, chosen.effects ?? [], { actorIndex: pending.target })
  }

  // Bowser (Fatalité) — « Anneau étoile » : le joueur qui pose la Fatalité déplace
  // le pion de Bowser sur le lieu de son choix (réutilise pendingPawnMove).
  if (chosen.cardId === 'anneau') {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = {
      ...next,
      pendingFate: null,
      pendingPawnMove: { chooserIndex: state.activePlayer, targetIndex: pending.target, via: 'Anneau étoile' },
      log: [...next.log, `Anneau étoile : ${state.players[state.activePlayer].villainName} déplace ${tgt.villainName}.`],
    }
    next = pushShowcase(next, chosen.cardId, `${tgt.villainName} subit ${chosen.name}`, state.activePlayer)
    return next
  }

  // La Méchante Reine (Fatalité) — Événements résolus sur la CIBLE : « Animaux de
  // la forêt » (défausse une carte de sa main) et « Premier baiser d'amour »
  // (défausse 1 Poison + un Héros de la défausse Fatalité revient sur le dessus).
  // Scar — Hakuna Matata : Événement Fatalité résolu sur la CIBLE (Scar), comme
  // les Événements de la Méchante Reine ci-dessus.
  if (chosen.cardId === 'animaux-foret' || chosen.cardId === 'premier-baiser' || chosen.cardId === 'hakuna-matata') {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null }
    next = pushShowcase(next, chosen.cardId, `${tgt.villainName} subit ${chosen.name}`, state.activePlayer)
    return resolveEffects(next, chosen.effects ?? [], { actorIndex: pending.target })
  }

  // L'Imposteur — Fatalités ÉVÉNEMENT (manipulent les Coéquipiers de l'Imposteur
  // ciblé). On défausse la carte (et l'autre révélée) puis on résout ses effets
  // sur la CIBLE (actorIndex = pending.target).
  const IMPOSTEUR_FATE_EVENTS: Record<string, import('./types').Effect[]> = {
    'corps-decouvert': [{ type: 'CREWMATES_SUSPECT', scope: 'away' }, { type: 'SABOTAGE_COUNTDOWN', amount: -1 }],
    'tache-visuelle': [{ type: 'CREWMATES_SUSPECT_CHOOSE', count: 3 }],
    'reparation-rapide': [{ type: 'MOVE_ONE_CREWMATE_NEIGHBOR' }],
    'arrivee-tardive': [{ type: 'PLACE_DISCARDED_CREWMATE' }],
    'reunion-d-urgence': [{ type: 'GATHER_CREWMATES' }],
  }
  if (IMPOSTEUR_FATE_EVENTS[chosen.cardId]) {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, chosen, ...others],
    }))
    next = { ...next, pendingFate: null, log: [...next.log, `**${chosen.name}** jouée contre ${tgt.villainName}.`] }
    // Corps découvert : bandeau « DEAD BODY REPORTED » + son côté UI.
    if (chosen.cardId === 'corps-decouvert') {
      next = pushFloatingFx(next, { kind: 'dead-body', playerIndex: pending.target })
    }
    // Réunion d'urgence : bandeau « EMERGENCY MEETING » + son côté UI.
    if (chosen.cardId === 'reunion-d-urgence') {
      next = pushFloatingFx(next, { kind: 'emergency-meeting', playerIndex: pending.target })
    }
    return resolveEffects(next, IMPOSTEUR_FATE_EVENTS[chosen.cardId], { actorIndex: pending.target })
  }

  // Majorité : défausse un Objet ou un Allié du royaume de la cible (hors Sabotage).
  if (chosen.cardId === 'majorite') {
    let next = updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen, ...others] }))
    next = { ...next, pendingFate: null }
    const realm = tgt.locations.flatMap((l) =>
      (next.players[pending.target].board[l.id] ?? []).map((c) => ({ c, loc: l.id })),
    )
    const pick =
      realm.find(({ c }) => c.type === 'ally' && !c.attachedTo) ??
      realm.find(({ c }) => c.type === 'item' && !c.isSabotage && !c.attachedTo)
    if (!pick) {
      return { ...next, log: [...next.log, `**Majorité** : aucun Objet/Allié (hors Sabotage) à défausser chez ${tgt.villainName}.`] }
    }
    const attached = (next.players[pending.target].board[pick.loc] ?? []).filter((c) => c.attachedTo === pick.c.instanceId)
    const removed = new Set([pick.c.instanceId, ...attached.map((c) => c.instanceId)])
    next = updatePlayer(next, pending.target, (p) => ({
      ...p,
      board: { ...p.board, [pick.loc]: (p.board[pick.loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
      discard: [...p.discard, pick.c, ...attached],
    }))
    return { ...next, log: [...next.log, `**Majorité** : **${pick.c.name}** est défaussé(e) du royaume de ${tgt.villainName}.`] }
  }

  // Vidéo de surveillance / Carte : Objets Fatalité associés à un lieu de la CIBLE.
  // Le joueur qui pose la Fatalité CHOISIT le lieu (pendingFateObjectPlace ; auto
  // côté bot). Leurs déclencheurs vivent dans crewmateEndOfTurn.
  if (chosen.cardId === 'video-surveillance' || chosen.cardId === 'carte') {
    let next = updatePlayer(state, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard, ...others],
    }))
    next = {
      ...next,
      pendingFate: null,
      pendingFateObjectPlace: { chooserIndex: state.activePlayer, targetIndex: pending.target, card: chosen },
      log: [...next.log, `${state.players[state.activePlayer].villainName} associe **${chosen.name}** à un lieu de ${tgt.villainName}.`],
    }
    return next
  }

  // Ursula (Fatalité) — Apparence Retrouvée : récupère un Héros de force ≤4 dans la
  // défausse Fatalité d'Ursula et le pose sur le lieu d'Ursula (le plus fort ≤4).
  // Non sélectionnable sans Héros valide (cf. FateModal.playable / enumerate).
  if (chosen.cardId === 'apparence-retrouvee') {
    const tgtP = state.players[pending.target]
    const heroes = tgtP.fateDiscard.filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 4)
    let next: GameState = {
      ...updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, ...others] })),
      pendingFate: null,
    }
    if (heroes.length === 0) {
      next = updatePlayer(next, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen] }))
      return { ...next, log: [...next.log, `Apparence Retrouvée : aucun Héros (force ≤4) dans la défausse Fatalité de ${tgt.villainName}.`] }
    }
    const hero = [...heroes].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
    // Retire le Héros récupéré de la défausse Fatalité ; la carte Apparence y va.
    next = updatePlayer(next, pending.target, (p) => ({
      ...p,
      fateDiscard: [...p.fateDiscard.filter((c) => c.instanceId !== hero.instanceId), chosen],
    }))
    const dest = tgtP.pawnLocation ?? tgtP.locations[0].id
    const destName = findLocation(tgtP, dest)?.name ?? dest
    return placeFateHeroWithEffects(next, pending.target, state.activePlayer, hero, dest, destName)
  }

  // Appel à l'aide (Ratigan, Fatalité) : cherche Basil et le joue sur le lieu de
  // votre choix ; s'il est déjà dans le royaume, déplacez-le. Auto : on vise le lieu
  // de la Reine Robot (pour que Basil la défausse → bascule « Le Rat »), sinon
  // Buckingham Palace. La pose/le déplacement déclenche l'onPlace de Basil.
  if (chosen.cardId === 'appel-a-l-aide') {
    let next: GameState = {
      ...updatePlayer(state, pending.target, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, chosen, ...others] })),
      pendingFate: null,
    }
    const t = next.players[pending.target]
    const robotLoc = t.locations.find((l) =>
      (t.board[l.id] ?? []).some((c) => c.cardId === 'reine-robot' && !c.attachedTo),
    )?.id
    const destId = robotLoc ?? 'buckingham-palace'
    const destName = findLocation(t, destId)?.name ?? destId
    // Basil déjà en jeu ? → on le déplace vers destId, ce qui redéclenche son onPlace.
    let basilLoc: string | undefined
    let basil: CardInstance | undefined
    for (const l of t.locations) {
      const f = (t.board[l.id] ?? []).find((c) => c.cardId === 'basil' && c.type === 'hero')
      if (f) { basilLoc = l.id; basil = f; break }
    }
    if (basil && basilLoc) {
      next = resolveEffects(next, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: destId }], { actorIndex: pending.target, targetHeroId: basil.instanceId })
      return resolveEffects(next, basil.onPlace ?? [], { actorIndex: pending.target, hostInstanceId: basil.instanceId, hostLocationId: destId })
    }
    const found = t.fateDeck.find((c) => c.cardId === 'basil') ?? t.fateDiscard.find((c) => c.cardId === 'basil')
    if (!found) {
      return { ...next, log: [...next.log, `Appel à l'aide : Basil est introuvable.`] }
    }
    next = updatePlayer(next, pending.target, (p) => ({
      ...p,
      fateDeck: p.fateDeck.filter((c) => c.instanceId !== found.instanceId),
      fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== found.instanceId),
    }))
    return placeFateHeroWithEffects(next, pending.target, state.activePlayer, found, destId, destName)
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
  // Inclut les actions ACCORDÉES par un Objet (Bowser : Galaxie en verre → Déplacer
  // un Allié/Objet). Sans locationActions, une action « granted:… » serait introuvable.
  const action = locationActions(state, loc.id).find((a) => a.id === actionId)!
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
  if (isItemFrozen(me, card)) {
    throw new Error(`${card.name} est gelé par Ariel : impossible de le déplacer.`)
  }
  // Hadès — Titan : l'action « Déplacer un Objet ou un Allié » déplace un Titan
  // GRATUITEMENT vers un lieu voisin (comme un Allié), sans coût en Pouvoir.
  // Entravé / verrouillé par Hercule (sur son lieu) = interdit. Le déplacement
  // PAYANT (2 JT / 1 lieu, 5 JT / 2 lieux) est propre à « Préparez-vous au combat ! ».
  if (card.isTitan) {
    if (card.trapped) throw new Error(`${card.name} est entravé : impossible de le déplacer.`)
    if (!titanReachableDests(state, state.activePlayer, instanceId, 1).includes(to)) {
      throw new Error(`${card.name} ne peut pas être déplacé vers « ${to} ».`)
    }
    let next = moveTitanTo(state, state.activePlayer, instanceId, to, { fireTriggers: true })
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      activeMovedCard: true,
    }
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
  next = {
    ...next,
    usedActionIds: [...next.usedActionIds, actionId],
    activeMovedCard: true, // déclencheur Sombres desseins
    log: [
      ...next.log,
      `${me.villainName} déplace **${card.name}**${moving.length > 1 ? ' (+ associé)' : ''} vers **${destName}**.`,
    ],
  }
  // Animation UI : la carte « vole » du lieu de départ vers le lieu d'arrivée.
  next = pushFloatingFx(next, { kind: 'move-card', playerIndex: state.activePlayer, cardId: card.cardId, from, to })
  // Yzma — Kronk gagne 1 jeton Pouvoir à chaque déplacement (devient Héros à 3+).
  if (card.cardId === 'kronk') {
    next = addKronkTokens(next, state.activePlayer, 1)
  }
  // Hadès — Peine : quand elle est déplacée, elle peut emmener un Héros de son
  // lieu de départ avec elle (résolution automatique).
  if (card.cardId === 'peine') {
    const hero = (next.players[state.activePlayer].board[from] ?? []).find((c) => c.type === 'hero')
    if (hero) {
      next = resolveEffects(next, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: to }], { targetHeroId: hero.instanceId })
      next = { ...next, log: [...next.log, `Peine emmène **${hero.name}** avec elle.`] }
    }
  }
  // Dr Facilier — Poupées vaudou : à leur déplacement, on PEUT déplacer un Héros
  // du royaume du même nombre de lieux et dans la même direction (ici 1 lieu,
  // l'action « Déplacer » étant un pas vers un voisin). Choix facultatif.
  if (card.cardId === 'poupees-vaudou') {
    const ap = state.activePlayer
    const order = me.locations.map((l) => l.id)
    const dir = order.indexOf(to) - order.indexOf(from) // −1 (gauche) ou +1 (droite)
    const locked = new Set(next.players[ap].lockedLocations ?? [])
    const candidates: string[] = []
    for (const l of next.players[ap].locations) {
      const destIdx = order.indexOf(l.id) + dir
      if (destIdx < 0 || destIdx >= order.length) continue
      const destId = order[destIdx]
      if (locked.has(destId)) continue
      const destCell = next.players[ap].board[destId] ?? []
      for (const h of next.players[ap].board[l.id] ?? []) {
        if (h.type !== 'hero') continue
        if ((h.forbiddenLocations ?? []).includes(destId)) continue
        // Restrictions du lieu de destination (Feu Infernal, Forêt de Ronces).
        const blocked = destCell.some((c) => {
          const r = c.placementRestriction
          return (
            (r?.type === 'no-heroes') ||
            (r?.type === 'min-hero-strength' && (h.strength ?? 0) < r.value)
          )
        })
        if (!blocked) candidates.push(h.instanceId)
      }
    }
    if (candidates.length > 0) {
      next = {
        ...next,
        pendingHeroRelocate: {
          chooserIndex: ap,
          targetIndex: ap,
          candidateIds: candidates,
          forcedDirection: dir,
          optional: true,
        },
        log: [...next.log, `Poupées vaudou : vous pouvez déplacer un Héros d'un lieu vers ${dir < 0 ? 'la gauche' : 'la droite'}.`],
      }
    }
  }
  return next
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

  if (card.cardId === 'cloche') {
    // Ratigan — Cloche : cherche Félicia (pioche/défausse) → main, remélange la pioche.
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost! }))
    next = resolveEffects(next, [{ type: 'TUTOR_CARD_TO_HAND', cardId: 'felicia' }], { actorIndex: state.activePlayer })
    next = consumePersifleur(next, action)
    return { ...next, usedActionIds: [...next.usedActionIds, actionId] }
  }

  if (card.cardId === 'dirigeable') {
    // Ratigan — Dirigeable : payez 1, déplacez le Dirigeable + 1 Objet/Allié non
    // associé du même lieu vers n'importe quel lieu. Auto : emmène la Reine Robot
    // vers Buckingham Palace si elle est là (saut direct vers l'objectif), sinon le
    // plus précieux Objet/Allié vers le lieu du pion.
    const cell = me.board[cardLoc]
    const companions = cell.filter(
      (c) => c.instanceId !== cardInstanceId && !c.attachedTo && (c.type === 'item' || c.type === 'ally'),
    )
    const robot = companions.find((c) => c.cardId === 'reine-robot')
    const companion =
      robot ??
      (companions.length > 0
        ? companions.reduce((a, b) => ((b.cost ?? 0) + (b.strength ?? 0) > (a.cost ?? 0) + (a.strength ?? 0) ? b : a))
        : undefined)
    const dest = robot ? 'buckingham-palace' : me.pawnLocation ?? cardLoc
    const movingIds = new Set<string>([cardInstanceId])
    for (const c of cell) if (c.attachedTo === cardInstanceId) movingIds.add(c.instanceId)
    if (companion) {
      movingIds.add(companion.instanceId)
      for (const c of cell) if (c.attachedTo === companion.instanceId) movingIds.add(c.instanceId)
    }
    const moving = cell.filter((c) => movingIds.has(c.instanceId))
    let next = updateActivePlayer(state, (p) => ({
      ...p,
      power: p.power - card.activatedCost!,
      board: {
        ...p.board,
        [cardLoc]: p.board[cardLoc].filter((c) => !movingIds.has(c.instanceId)),
        [dest]: [...(p.board[dest] ?? []), ...moving],
      },
    }))
    next = consumePersifleur(next, action)
    const destName = findLocation(me, dest)!.name
    const compName = companion ? ` + **${companion.name}**` : ''
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active le **Dirigeable**${compName} → **${destName}** (−${card.activatedCost} JT).`],
    }
  }

  if (card.cardId === 'piege-ingenieux') {
    // Ratigan — Piège ingénieux : payez 1, amorcez le piège sur son lieu. Il se
    // refermera au début de votre prochain tour (resolveArmedTraps), avant le
    // déplacement, éliminant tous les Héros du lieu, puis sera défaussé.
    let next = updateActivePlayer(state, (p) => ({
      ...p,
      power: p.power - card.activatedCost!,
      board: {
        ...p.board,
        [cardLoc]: p.board[cardLoc].map((c) => (c.instanceId === cardInstanceId ? { ...c, trapArmed: true } : c)),
      },
    }))
    next = consumePersifleur(next, action)
    const locName = findLocation(me, cardLoc)!.name
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [
        ...next.log,
        `${me.villainName} amorce le **Piège ingénieux** sur **${locName}** (−${card.activatedCost} JT) : il se refermera au début de votre prochain tour.`,
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

  if (card.cardId === 'ghostly') {
    // Bowser — Galaxie hantée : regarde les 4 premières cartes de la pioche, en
    // garde 1 (auto : la plus utile), défausse les autres.
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost! }))
    next = resolveEffects(next, [{ type: 'LOOK_TOP_DRAW_DISCARD', look: 4, take: 1 }], { actorIndex: state.activePlayer })
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active **${card.name}** : regarde 4 cartes, en garde 1.`],
    }
  }

  if (card.cardId === 'bowser-jr') {
    // Bowser — Bowser Jr. : paie 3 JT, cherche PEACH dans sa pioche Fatalité et la
    // joue au Château de Peach (pour pouvoir ensuite la capturer via Impuissance).
    // Interdit si Peach est déjà en jeu ou capturée (sinon on la re-poserait).
    const peachInPlay = Object.values(me.board)
      .flat()
      .some((x) => x.type === 'hero' && x.cardId === 'peach')
    if (peachInPlay || me.peachCaptured) {
      throw new Error('Bowser Jr. : Peach est déjà en jeu ou capturée.')
    }
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost! }))
    next = resolveEffects(next, [{ type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'peach', locationId: 'chateau-peach' }], { actorIndex: state.activePlayer })
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active **Bowser Jr.** : cherche Peach (−${card.activatedCost} JT).`],
    }
  }

  // ----- L'Imposteur — capacités activées des Tâches (coût 0) -----
  if (card.cardId === 'tache-electricite') {
    // Gagne 1 JT par carte TÂCHE : ÉLECTRICITÉ posée dans le royaume.
    const n = Object.values(me.board).flat().filter((c) => c.cardId === 'tache-electricite' && !c.attachedTo).length
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power + n }))
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active **Tâche : Électricité** (+${n} JT).`],
    }
  }
  if (card.cardId === 'tache-telechargement') {
    // Le joueur choisit une carte de sa défausse à reprendre, puis mélange le deck
    // (réutilise pendingRecover). Défausse vide → simple mélange.
    let next = consumePersifleur(state, action)
    next = { ...next, usedActionIds: [...next.usedActionIds, actionId] }
    if (me.discard.length === 0) {
      const sh = shuffle(me.deck, next.rngState)
      return {
        ...next,
        rngState: sh.state,
        players: next.players.map((p, i) => (i === state.activePlayer ? { ...p, deck: sh.result } : p)),
        log: [...next.log, `${me.villainName} active **Tâche : Téléchargement** : défausse vide, mélange son deck.`],
      }
    }
    return {
      ...next,
      pendingRecover: {
        playerIndex: state.activePlayer,
        candidateIds: me.discard.map((c) => c.instanceId),
        thenShuffle: true,
        label: 'Tâche : Téléchargement',
      },
      log: [...next.log, `${me.villainName} active **Tâche : Téléchargement** : choisissez une carte de votre défausse.`],
    }
  }
  if (card.cardId === 'tache-station-essence') {
    // Le joueur choisit la carte à défausser (puis pioche). Réutilise la sélection
    // de main (pendingTyrannyDiscard) avec pioche différée. Main vide → simple pioche.
    let next = consumePersifleur(state, action)
    next = { ...next, usedActionIds: [...next.usedActionIds, actionId] }
    if (me.hand.length === 0) {
      const dr = drawPlayerToLimitN(next.players[state.activePlayer], next.rngState, 1)
      return {
        ...next,
        rngState: dr.rngState,
        players: next.players.map((p, i) => (i === state.activePlayer ? dr.player : p)),
        log: [...next.log, `${me.villainName} active **Tâche : Station essence** : main vide, pioche 1 carte.`],
      }
    }
    return {
      ...next,
      pendingTyrannyDiscard: { playerIndex: state.activePlayer, count: 1, thenDraw: 1, label: 'Tâche : Station essence' },
      log: [...next.log, `${me.villainName} active **Tâche : Station essence** : choisissez une carte à défausser.`],
    }
  }
  if (card.cardId === 'tache-course') {
    // Le joueur CHOISIT le Coéquipier à déplacer (mode 'move' → puis choix du lieu
    // voisin via pendingCrewmateMove).
    const live = (me.crewmates ?? []).filter((c) => !c.discarded)
    let next = consumePersifleur(state, action)
    next = { ...next, usedActionIds: [...next.usedActionIds, actionId] }
    if (live.length === 0) {
      return { ...next, log: [...next.log, `${me.villainName} active **Tâche : Course** : aucun Coéquipier à déplacer.`] }
    }
    return {
      ...next,
      pendingCrewmateKill: { playerIndex: state.activePlayer, candidateColors: live.map((c) => c.color), mode: 'move' },
      log: [...next.log, `${me.villainName} active **Tâche : Course** : choisissez un Coéquipier à déplacer.`],
    }
  }

  // ----- La Méchante Reine — capacités activées -----
  if (card.cardId === 'trone') {
    // Trône : ajoute 1 jeton Poison.
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost!, poison: (p.poison ?? 0) + 1 }))
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active le **Trône** : +1 Poison (total : ${activePlayer(next).poison}).`],
    }
  }
  if (card.cardId === 'ecrin') {
    // Écrin : gagne 1 JT par Héros dans la défausse Fatalité (max 3).
    const heroes = me.fateDiscard.filter((c) => c.type === 'hero').length
    const gain = Math.min(3, heroes)
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost! + gain }))
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active l'**Écrin** : +${gain} JT (${heroes} Héros en défausse Fatalité).`],
    }
  }
  if (card.cardId === 'miroir-magique') {
    // Miroir magique : paie 1 JT, fait apparaître Blanche-Neige à la Maison des Nains.
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost! }))
    next = resolveEffects(next, [{ type: 'SUMMON_FATE_HERO_TO_OWN_REALM', heroCardId: 'blanche-neige', locationId: 'maison-des-nains' }], { actorIndex: state.activePlayer })
    next = consumePersifleur(next, action)
    return {
      ...next,
      usedActionIds: [...next.usedActionIds, actionId],
      log: [...next.log, `${me.villainName} active le **Miroir magique** : fait apparaître Blanche-Neige (−${card.activatedCost} JT).`],
    }
  }
  if (card.cardId === 'grimoires-magiques') {
    // Grimoires magiques : regarde les 4 premières cartes de la pioche, en garde 1.
    const top = me.deck.slice(0, 4)
    let next = updateActivePlayer(state, (p) => ({ ...p, power: p.power - card.activatedCost!, deck: p.deck.slice(top.length) }))
    next = consumePersifleur(next, action)
    next = { ...next, usedActionIds: [...next.usedActionIds, actionId] }
    if (top.length === 0) {
      return { ...next, log: [...next.log, `${me.villainName} active les **Grimoires magiques** : pioche vide.`] }
    }
    return {
      ...next,
      pendingLookTop: { playerIndex: state.activePlayer, cards: top, take: 1, title: 'Grimoires magiques' },
      log: [...next.log, `${me.villainName} active les **Grimoires magiques** : regarde ${top.length} cartes, en garde 1.`],
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
    throw new Error("Aucune élimination facultative en attente.")
  }
  const source = state.pendingTrapVanquish.source
  let next = performVanquish(state, heroInstanceId, allyInstanceIds, false)
  // Tendre un Piège : showcase de la carte différé (apparaît une fois la séquence
  // terminée). Troupeau de gnous : la carte a déjà été montrée à sa pose.
  if (source === 'trap') {
    next = pushShowcase(next, 'tendre-piege', `Joué par ${activePlayer(next).villainName}`, next.activePlayer)
  }
  return { ...next, pendingTrapVanquish: null }
}

/** Termine un Vanquish facultatif (Tendre un Piège / Troupeau de gnous) sans éliminer. */
function applyTrapSkipVanquish(state: GameState): GameState {
  if (!state.pendingTrapVanquish) return state
  const source = state.pendingTrapVanquish.source
  const next =
    source === 'trap'
      ? pushShowcase(state, 'tendre-piege', `Joué par ${activePlayer(state).villainName}`, state.activePlayer)
      : state
  return { ...next, pendingTrapVanquish: null }
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
  if (card.cardId === 'lachete' || card.cardId === 'renforts') {
    // Lâcheté / Besoin de renfort : pose un Allié gratuitement chez le joueur.
    const label = card.name
    if (!allyInstanceId) throw new Error(`${label} : précisez l'Allié à poser.`)
    if (!to) throw new Error(`${label} : précisez le lieu de pose.`)
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
  if (card.cardId === 'ferocite') {
    // Yzma — Férocité : éliminer instantanément un Héros ≤3 du royaume du joueur qui
    // joue la Condition (cible via allyInstanceId, sinon 1ᵉʳ éligible).
    const acting = next.players[playerIndex]
    const heroes = Object.values(acting.board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 3)
    if (heroes.length === 0) {
      return { ...next, log: [...next.log, 'Férocité : aucun Héros éligible (force ≤ 3).'] }
    }
    const target = allyInstanceId ? heroes.find((h) => h.instanceId === allyInstanceId) ?? heroes[0] : heroes[0]
    return resolveEffectsLocal(next, [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }], {
      actorIndex: playerIndex,
      targetHeroId: target.instanceId,
    })
  }
  if (card.cardId === 'affront') {
    // Pat Hibulaire — Affront : éliminer instantanément un Héros ≤3 du royaume du
    // joueur qui joue la Condition (cible via allyInstanceId, sinon 1ᵉʳ éligible).
    const acting = next.players[playerIndex]
    const heroes = Object.values(acting.board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 3)
    if (heroes.length === 0) {
      return { ...next, log: [...next.log, 'Affront : aucun Héros éligible (force ≤ 3).'] }
    }
    const target = allyInstanceId ? heroes.find((h) => h.instanceId === allyInstanceId) ?? heroes[0] : heroes[0]
    return resolveEffectsLocal(next, [{ type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 3 }], {
      actorIndex: playerIndex,
      targetHeroId: target.instanceId,
    })
  }
  if (card.cardId === 'mauvais-coup') {
    // Pat Hibulaire — Mauvais Coup : révèle les 2 dernières cartes de la pioche.
    // Le joueur en garde 1 en main, l'autre repart sur le dessus OU le dessous
    // (RESOLVE_MAUVAIS_COUP — modale pour l'humain, auto pour le bot). Net +1.
    const acting = next.players[playerIndex]
    const taken = acting.deck.slice(-2)
    if (taken.length === 0) {
      return { ...next, log: [...next.log, `${player.villainName} : pioche vide (Mauvais Coup).`] }
    }
    if (taken.length === 1) {
      // Une seule carte disponible : pas de choix possible, on la prend en main.
      next = updatePlayer(next, playerIndex, (p) => ({
        ...p,
        deck: p.deck.slice(0, p.deck.length - 1),
        hand: [...p.hand, taken[0]],
      }))
      return {
        ...next,
        log: [...next.log, `${player.villainName} prend la dernière carte de sa pioche en main (Mauvais Coup).`],
      }
    }
    // 2 cartes : on les retire de la pioche et on ouvre le choix interactif.
    next = updatePlayer(next, playerIndex, (p) => ({
      ...p,
      deck: p.deck.slice(0, p.deck.length - taken.length),
    }))
    return {
      ...next,
      pendingMauvaisCoup: { playerIndex, cards: taken },
      log: [...next.log, `${player.villainName} regarde les 2 cartes du dessous de sa pioche (Mauvais Coup).`],
    }
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
  if (card.cardId === 'arrogance') {
    // Arrogance (Ursula) : pioche 3 cartes Méchant puis en défausse 3 (comme Tyrannie).
    const draw3 = drawPlayerToLimitN(next.players[playerIndex], next.rngState, 3)
    next = {
      ...next,
      rngState: draw3.rngState,
      players: next.players.map((p, i) => (i === playerIndex ? draw3.player : p)),
      log: [...next.log, `${player.villainName} pioche ${draw3.drawn} carte${draw3.drawn > 1 ? 's' : ''} (Arrogance).`],
    }
    if (draw3.drawn > 0) next = pushFloatingFx(next, { kind: 'tyranny-draw', playerIndex, count: draw3.drawn })
    const discardCount = Math.min(3, next.players[playerIndex].hand.length)
    if (discardCount === 0) return next
    return { ...next, pendingTyrannyDiscard: { playerIndex, count: discardCount } }
  }
  if (card.cardId === 'illusion') {
    // Illusion (Ursula) : dévoile la 1ʳᵉ carte Fatalité de l'adversaire et la joue
    // immédiatement contre lui (comme Tromperie).
    const oppIdx = state.activePlayer
    const opp = next.players[oppIdx]
    if (opp.fateDeck.length === 0 && opp.fateDiscard.length === 0) {
      return { ...next, log: [...next.log, 'Illusion : pioche Fatalité adverse vide.'] }
    }
    const r = revealFate(opp, 1, next.rngState)
    next = { ...updatePlayer(next, oppIdx, () => r.player), rngState: r.rngState }
    const revealed = r.revealed[0]
    if (!revealed) return next
    if (revealed.type === 'hero') {
      const locs = heroPlacementLocations(next, revealed, oppIdx)
      if (locs.length === 0) {
        next = updatePlayer(next, oppIdx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, revealed] }))
        return { ...next, log: [...next.log, `Illusion : **${revealed.name}** révélé, aucun lieu valide → défaussé.`] }
      }
      return {
        ...next,
        pendingHeroPlacement: { chooserIndex: playerIndex, targetIndex: oppIdx, hero: revealed },
        log: [...next.log, `${player.villainName} dévoile **${revealed.name}** (Illusion) — à placer chez ${next.players[oppIdx].villainName}.`],
      }
    }
    next = updatePlayer(next, oppIdx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, revealed] }))
    return { ...next, log: [...next.log, `Illusion : **${revealed.name}** (non-Héros) — effet non géré, défaussé.`] }
  }
  if (card.cardId === 'rage') {
    // Rage (Hadès) : déplace un Héros n'importe où dans son royaume (auto : le
    // Héros qui partage le lieu du plus grand nombre de Titans non entravés est
    // éloigné vers le lieu qui en porte le moins — pour dégager la voie des Titans).
    const acting = next.players[playerIndex]
    let bestHero: { id: string; loc: string } | undefined
    let bestTitans = -1
    for (const l of acting.locations) {
      const cell = acting.board[l.id] ?? []
      const titans = cell.filter((c) => c.isTitan && !c.trapped).length
      const hero = cell.find((c) => c.type === 'hero')
      if (hero && titans > bestTitans) { bestTitans = titans; bestHero = { id: hero.instanceId, loc: l.id } }
    }
    if (!bestHero) return { ...next, log: [...next.log, 'Rage : aucun Héros à déplacer.'] }
    let target = bestHero.loc
    let fewest = Number.MAX_SAFE_INTEGER
    for (const l of acting.locations) {
      const titans = (acting.board[l.id] ?? []).filter((c) => c.isTitan && !c.trapped).length
      if (titans < fewest) { fewest = titans; target = l.id }
    }
    if (target === bestHero.loc) return next
    return resolveEffects(next, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: target }], {
      actorIndex: playerIndex,
      targetHeroId: bestHero.id,
    })
  }
  if (card.cardId === 'sans-pitie') {
    // Sans pitié (Hadès) : joue gratuitement un Allié OU un Titan de la main. Un
    // Titan ne peut être posé que sur Les Enfers.
    if (!allyInstanceId) throw new Error('Sans pitié : précisez l’Allié/Titan à poser.')
    const acting = next.players[playerIndex]
    const a = acting.hand.find((c) => c.instanceId === allyInstanceId)
    if (!a) throw new Error(`Carte « ${allyInstanceId} » absente de la main.`)
    if (a.type !== 'ally') throw new Error(`${a.name} n'est pas un Allié.`)
    const dest = a.isTitan ? 'enfers' : to
    if (!dest) throw new Error('Sans pitié : précisez le lieu de pose.')
    if (a.isTitan && dest !== 'enfers') throw new Error('Un Titan ne peut être posé que sur Les Enfers.')
    if (!acting.locations.some((l) => l.id === dest)) throw new Error(`Lieu invalide : « ${dest} ».`)
    next = updatePlayer(next, playerIndex, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== allyInstanceId),
      board: { ...p.board, [dest]: [...(p.board[dest] ?? []), a] },
    }))
    return { ...next, log: [...next.log, `${player.villainName} joue gratuitement **${a.name}** sur **${dest}** (Sans pitié).`] }
  }
  if (card.cardId === 'superiorite') {
    // Yzma — Supériorité : pendant une Fatalité qui la cible (choix de pioche en
    // attente), c'est Yzma qui choisit la pioche à la place de l'adversaire.
    const yf = next.pendingYzmaFate
    if (yf && yf.phase === 'deck' && yf.targetIndex === playerIndex) {
      return {
        ...next,
        pendingYzmaFate: { ...yf, deckChooserIndex: playerIndex },
        log: [...next.log, `${player.villainName} (Supériorité) choisit elle-même la pioche Fatalité.`],
      }
    }
    return next
  }
  if (card.cardId === 'vie-pas-juste') {
    // Scar — La vie n'est pas juste : on trie les cartes Fatalité que l'adversaire
    // s'apprête à jouer CONTRE soi (les cartes révélées). Les gardées restent
    // jouables (pendingFate.revealed), les écartées partent en défausse. Si aucune
    // Fatalité n'est en attente (jouée trop tard), on sonde le dessus de sa pioche.
    const pf = next.pendingFate
    if (pf && pf.target === playerIndex && pf.revealed.length > 0) {
      return {
        ...next,
        pendingFate: { ...pf, revealed: [] },
        pendingScry: { playerIndex, cards: pf.revealed, rerevealFate: true },
        log: [...next.log, `${player.villainName} examine les 2 cartes du dessus de sa pioche Fatalité (La vie n'est pas juste).`],
      }
    }
    return resolveEffectsLocal(next, [{ type: 'SCRY_OWN_FATE_TOP2' }], { actorIndex: playerIndex })
  }
  if (card.cardId === 'trahison-imposteur') {
    // Trahison (L'Imposteur) : élimine un Coéquipier qui ne le suspecte pas.
    return resolveEffectsLocal(next, [{ type: 'KILL_NORMAL_CREWMATE' }], { actorIndex: playerIndex })
  }
  if (card.cardId === 'insidieux') {
    // Insidieux (L'Imposteur) : un Coéquipier suspect redevient normal.
    return resolveEffectsLocal(next, [{ type: 'REASSURE_ANY' }], { actorIndex: playerIndex })
  }
  // Repli générique : Condition « data-driven » qui déclare directement ses effets
  // (sans branchement spécifique ci-dessus). Ex. Festival des éclats d'étoiles →
  // Gagner 3 JT ; Méchante Reine — Jalousie : +1 Poison ; Vanité : réorganise la
  // pioche. Les effets s'appliquent au joueur qui RÉAGIT (playerIndex), pas au
  // joueur actif. Évite de coder chaque Condition simple par cardId.
  if ((card.effects ?? []).length > 0) {
    return resolveEffectsLocal(next, card.effects ?? [], { actorIndex: playerIndex })
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
  const label = pending.label ?? 'Tyrannie'
  const player = state.players[playerIndex]
  const expected = Math.min(count, player.hand.length)
  if (instanceIds.length !== expected) {
    throw new Error(`${label} : il faut défausser exactement ${expected} carte(s).`)
  }
  const idSet = new Set(instanceIds)
  const toDiscard = player.hand.filter((c) => idSet.has(c.instanceId))
  if (toDiscard.length !== instanceIds.length) {
    throw new Error(`${label} : carte à défausser absente de la main.`)
  }
  let next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    hand: p.hand.filter((c) => !idSet.has(c.instanceId)),
    discard: [...p.discard, ...toDiscard],
  }))
  // Tâche : Station essence — pioche après la défausse.
  if (pending.thenDraw && pending.thenDraw > 0) {
    const dr = drawPlayerToLimitN(next.players[playerIndex], next.rngState, pending.thenDraw)
    next = {
      ...next,
      rngState: dr.rngState,
      players: next.players.map((p, i) => (i === playerIndex ? dr.player : p)),
    }
  }
  next = {
    ...next,
    pendingTyrannyDiscard: undefined,
    log: [
      ...next.log,
      `${player.villainName} défausse ${toDiscard.length} carte${toDiscard.length > 1 ? 's' : ''}${pending.thenDraw ? ' et pioche' : ''} (${label}).`,
    ],
  }
  return pushDiscardShowcase(
    next,
    toDiscard.map((c) => c.cardId),
    `${player.villainName} défausse ${toDiscard.length} carte${toDiscard.length > 1 ? 's' : ''} (${label})`,
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
  const via = pending.via ?? 'Roi Stéphane'
  let next: GameState = { ...state, pendingPawnMove: undefined }
  if (locationId === null || locationId === target.pawnLocation) {
    return { ...next, log: [...next.log, `${target.villainName} n'est pas déplacé (${via}).`] }
  }
  if (!findLocation(target, locationId)) throw new Error(`Lieu inconnu : « ${locationId} ».`)
  const destName = findLocation(target, locationId)!.name
  next = updatePlayer(next, targetIndex, (p) => ({ ...p, pawnLocation: locationId }))
  next = {
    ...next,
    log: [...next.log, `${via} déplace ${target.villainName} vers **${destName}**.`],
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
  // Certaines cartes restreignent les Héros déplaçables (Stratos : départ/arrivée ;
  // Mégara : lieu hôte ; Hermès : Zeus).
  if (pending.candidateIds && !pending.candidateIds.includes(heroInstanceId)) {
    throw new Error('Ce Héros n’est pas un choix valide.')
  }
  const from = locationOfCard(target, heroInstanceId)
  if (!from) throw new Error(`Héros « ${heroInstanceId} » introuvable.`)
  const hero = (target.board[from] ?? []).find((c) => c.instanceId === heroInstanceId)
  if (!hero || hero.type !== 'hero') throw new Error('Cible invalide (pas un Héros).')
  // Adjacence dans le royaume de la CIBLE — sauf Tourbillon (anyLocation), qui
  // autorise n'importe quel lieu non bloqué.
  if (pending.anyLocation) {
    const locked = new Set(target.lockedLocations ?? [])
    if (!target.locations.some((l) => l.id === to) || locked.has(to)) {
      throw new Error(`Lieu « ${to} » invalide (doit être non bloqué).`)
    }
  } else {
    const ids = target.locations.map((l) => l.id)
    const i = ids.indexOf(from)
    const adj = [ids[i - 1], ids[i + 1]].filter(Boolean) as string[]
    if (!adj.includes(to)) throw new Error(`Lieu « ${to} » non voisin de « ${from} ».`)
    // Poupées vaudou : la direction est imposée (même sens que les Poupées).
    if (pending.forcedDirection !== undefined && ids.indexOf(to) !== i + pending.forcedDirection) {
      throw new Error('Direction imposée par les Poupées vaudou.')
    }
  }
  const next = resolveEffects(state, [{ type: 'MOVE_HERO_TO_LOCATION', locationId: to }], {
    actorIndex: targetIndex,
    targetHeroId: heroInstanceId,
  })
  // Scar — Troupeau de gnous : après le déplacement, le joueur peut éliminer un Héros
  // sur le nouveau lieu (Vanquish facultatif restreint à `to`).
  if (pending.thenTrapVanquish) {
    return { ...next, pendingHeroRelocate: null, pendingTrapVanquish: { source: 'gnous', locationId: to } }
  }
  return { ...next, pendingHeroRelocate: null }
}

/** Décline un déplacement de Héros facultatif (Poupées vaudou). */
function applySkipHeroRelocate(state: GameState): GameState {
  if (!state.pendingHeroRelocate?.optional) {
    throw new Error('Ce déplacement de Héros est obligatoire.')
  }
  return { ...state, pendingHeroRelocate: null }
}

/**
 * Flèche de Mome Raths : déplace l'Allié choisi (du royaume de la cible) vers le
 * lieu non bloqué choisi, en emmenant ses Objets associés. Le lieu peut être
 * n'importe lequel des lieux non verrouillés de la cible (« lieu de votre choix »).
 */
function applyResolveAllyRelocate(state: GameState, allyInstanceId: string, to: LocationId): GameState {
  const pending = state.pendingAllyRelocate
  if (!pending) throw new Error('Aucun déplacement d’Allié en attente.')
  const { targetIndex } = pending
  const target = state.players[targetIndex]
  const from = locationOfCard(target, allyInstanceId)
  if (!from) throw new Error(`Allié « ${allyInstanceId} » introuvable.`)
  const ally = (target.board[from] ?? []).find((c) => c.instanceId === allyInstanceId)
  if (!ally || ally.type !== 'ally') throw new Error('Cible invalide (pas un Allié).')
  const locked = new Set(target.lockedLocations ?? [])
  if (!target.locations.some((l) => l.id === to) || locked.has(to)) {
    throw new Error(`Lieu « ${to} » invalide (doit être non bloqué).`)
  }
  if (from === to) return { ...state, pendingAllyRelocate: null }
  // L'Allié emmène ses Objets associés (cohérence avec les autres déplacements).
  const moving = (target.board[from] ?? []).filter((c) => c.instanceId === allyInstanceId || c.attachedTo === allyInstanceId)
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const destName = findLocation(target, to)?.name ?? to
  const next = updatePlayer(state, targetIndex, (p) => ({
    ...p,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
  return {
    ...next,
    pendingAllyRelocate: null,
    log: [...next.log, `**Flèche de Mome Raths** : **${ally.name}** est déplacé(e) vers **${destName}**.`],
  }
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
    ingredient: 'Ingrédient',
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
  const matches = revealed.filter((c) => c.type === cardType)
  const nonMatches = revealed.filter((c) => c.type !== cardType)

  // Plusieurs cartes du type choisi : le joueur décide laquelle ajouter à sa main
  // (les autres révélées — du bon type ou non — sont défaussées). On réutilise le
  // mécanisme « regarder / garder » (pendingLookTop, take 1).
  if (matches.length >= 2) {
    let next = updatePlayer(state, playerIndex, (p) => ({
      ...p,
      deck: rest,
      discard: [...discardPile, ...nonMatches],
    }))
    next = {
      ...next,
      rngState,
      pendingTypeChoice: null,
      pendingLookTop: { playerIndex, cards: matches, take: 1, title: 'Tombée de la nuit' },
      log: [
        ...next.log,
        `${player.villainName} dévoile ${revealed.length} cartes : ${matches.length} ${typeLabel} — choisissez celui à garder (Tombée de la nuit).`,
      ],
    }
    if (nonMatches.length > 0) {
      next = pushDiscardShowcase(
        next,
        nonMatches.map((c) => c.cardId),
        `Tombée de la nuit : ${nonMatches.length} carte${nonMatches.length > 1 ? 's' : ''} défaussée${nonMatches.length > 1 ? 's' : ''}`,
        playerIndex,
        'dark',
        'bottom',
      )
    }
    return next
  }

  const toHand = matches[0]
  const others = revealed.filter((c) => c.instanceId !== toHand?.instanceId)
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

  // Scar — La vie n'est pas juste : les gardées retournent sur le DESSUS de la pioche
  // Fatalité (ordre choisi), les écartées sont défaussées. PUIS l'adversaire re-révèle
  // sa Fatalité depuis ce dessus modifié : il pioche donc la gardée + la carte
  // suivante si une a été écartée (tout écarter → il pioche les 2 cartes suivantes).
  if (pending.rerevealFate) {
    let next = updatePlayer(state, idx, (p) => ({
      ...p,
      fateDeck: [...kept, ...p.fateDeck],
      fateDiscard: [...p.fateDiscard, ...discarded],
    }))
    const r = revealFate(next.players[idx], FATE_REVEAL, next.rngState)
    next = { ...updatePlayer(next, idx, () => r.player), rngState: r.rngState }
    const pf = next.pendingFate
    if (r.revealed.length === 0) {
      return {
        ...next,
        pendingScry: null,
        pendingFate: null,
        log: [...next.log, `${player.villainName} : plus aucune carte Fatalité à révéler (La vie n'est pas juste).`],
      }
    }
    return {
      ...next,
      pendingScry: null,
      pendingFate: pf ? { ...pf, revealed: r.revealed } : { target: idx, revealed: r.revealed },
      log: [
        ...next.log,
        `${player.villainName} garde ${kept.length} carte(s) sur le dessus, défausse ${discarded.length} ; l'adversaire re-révèle sa Fatalité (La vie n'est pas juste).`,
      ],
    }
  }

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
      `${player.villainName} (sondage Fatalité) : ${kept.length} carte(s) sur le dessus, ${discarded.length} défaussée(s).`,
    ],
  }
}

/**
 * Mauvais Coup (Pat Hibulaire) : parmi les 2 cartes révélées, `keepInstanceId`
 * rejoint la main ; l'autre repart sur le DESSUS (`top`) ou le DESSOUS (`bottom`)
 * de la pioche.
 */
function applyResolveMauvaisCoup(
  state: GameState,
  keepInstanceId: string,
  otherPlacement: 'top' | 'bottom',
): GameState {
  const pending = state.pendingMauvaisCoup
  if (!pending) throw new Error('Aucun Mauvais Coup en attente.')
  const idx = pending.playerIndex
  const player = state.players[idx]
  const kept = pending.cards.find((c) => c.instanceId === keepInstanceId)
  if (!kept) throw new Error('Carte à garder introuvable (Mauvais Coup).')
  const other = pending.cards.find((c) => c.instanceId !== keepInstanceId)
  if (!other) throw new Error('Autre carte introuvable (Mauvais Coup).')
  // Le dessus de la pioche est l'indice 0, le dessous la fin du tableau.
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    hand: [...p.hand, kept],
    deck: otherPlacement === 'top' ? [other, ...p.deck] : [...p.deck, other],
  }))
  return {
    ...next,
    pendingMauvaisCoup: null,
    log: [
      ...next.log,
      `${player.villainName} prend **${kept.name}** en main et replace l'autre carte sur le ${
        otherPlacement === 'top' ? 'dessus' : 'dessous'
      } de sa pioche (Mauvais Coup).`,
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
  const buff = pending.amount > 0 ? ` (+${pending.amount} force ce tour-ci)` : ''
  return {
    ...next,
    pendingAllyMoveBuff: null,
    log: [...next.log, `${me.villainName} déplace **${ally.name}** vers **${toName}**${buff}.`],
  }
}

/** Décline un déplacement d'Allié FACULTATIF (Grand Terrier). Refusé si le
 *  déplacement en attente n'est pas optionnel (Pas de Quartier ! est obligatoire). */
function applySkipAllyMoveBuff(state: GameState): GameState {
  if (!state.pendingAllyMoveBuff?.optional) {
    throw new Error('Ce déplacement d’Allié est obligatoire.')
  }
  return { ...state, pendingAllyMoveBuff: null }
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

  if (pending.kind === 'discard-from-hand') {
    // Animaux de la forêt : défausse la carte choisie dans la main de la cible.
    const card = tgt.hand.find((c) => c.instanceId === instanceId)
    if (!card) throw new Error('Carte introuvable dans la main.')
    const next = updatePlayer(state, ti, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.instanceId !== instanceId),
      discard: [...p.discard, card],
    }))
    return {
      ...next,
      pendingFateChoice: null,
      log: [...next.log, `Animaux de la forêt : **${card.name}** est défaussée de la main de ${tgt.villainName}.`],
    }
  }

  if (pending.kind === 'fate-discard-hero-to-top') {
    // Premier baiser d'amour : un Héros de la défausse Fatalité revient sur le
    // dessus de la pioche Fatalité de la cible.
    const hero = tgt.fateDiscard.find((c) => c.instanceId === instanceId)
    if (!hero) throw new Error('Héros introuvable dans la défausse Fatalité.')
    const next = updatePlayer(state, ti, (p) => ({
      ...p,
      fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== instanceId),
      fateDeck: [hero, ...p.fateDeck],
    }))
    return {
      ...next,
      pendingFateChoice: null,
      log: [...next.log, `Premier baiser d'amour : **${hero.name}** revient sur le dessus de la pioche Fatalité de ${tgt.villainName}.`],
    }
  }

  if (pending.kind === 'play-fate-card-from-discard') {
    // Scar — Petit secret : joue la carte Fatalité (Héros ou Événement) choisie.
    return playChosenFateFromDiscard({ ...state, pendingFateChoice: null }, pending.chooserIndex, instanceId)
  }

  if (pending.kind === 'play-revealed-fate-hero') {
    // Scar — Longue vie au roi ! : le Héros choisi (déposé dans la défausse Fatalité)
    // est joué dans le royaume sur le lieu du pion ; les autres restent défaussés.
    const hero = tgt.fateDiscard.find((c) => c.instanceId === instanceId)
    if (!hero) throw new Error('Héros dévoilé introuvable dans la défausse Fatalité.')
    const dest = tgt.pawnLocation ?? tgt.locations[0]?.id
    if (!dest) throw new Error('Aucun lieu où jouer le Héros.')
    let next = updatePlayer(state, ti, (p) => ({
      ...p,
      fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== instanceId),
      board: { ...p.board, [dest]: [...(p.board[dest] ?? []), hero] },
    }))
    next = { ...next, pendingFateChoice: null }
    next = resolveEffects(next, hero.onPlace ?? [], { actorIndex: ti, hostInstanceId: hero.instanceId, hostLocationId: dest })
    return {
      ...next,
      log: [...next.log, `Longue vie au roi ! : **${hero.name}** entre dans le royaume.`],
    }
  }

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

/** Vol du château : pose l'Allié/Objet dévoilé (`found`) sur le lieu `to` choisi
 *  (ou en main si associable). Showcase visible des deux côtés via l'animation de
 *  pose. Les cartes dévoilées ont déjà été remises sur le dessus par l'effet. */
function applyResolveCastleTheft(state: GameState, to?: LocationId): GameState {
  const pending = state.pendingCastleTheft
  if (!pending) throw new Error('Aucun Allié/Objet dévoilé en attente (Vol du château).')
  const idx = pending.playerIndex
  const me = state.players[idx]
  const found = pending.found
  let next: GameState = { ...state, pendingCastleTheft: null }
  // Objet associable (à un Allié/Héros) : pas de pose libre → en main.
  if (pending.toHand) {
    next = updatePlayer(next, idx, (p) => ({ ...p, hand: [...p.hand, found] }))
    return { ...next, log: [...next.log, `${me.villainName} ajoute **${found.name}** à sa main (Vol du château).`] }
  }
  const locked = new Set(me.lockedLocations ?? [])
  const dest = to ?? me.pawnLocation ?? me.locations[0].id
  if (!me.locations.some((l) => l.id === dest) || locked.has(dest)) {
    throw new Error(`Lieu de pose invalide pour ${found.name} (Vol du château).`)
  }
  next = updatePlayer(next, idx, (p) => ({
    ...p,
    board: { ...p.board, [dest]: [...(p.board[dest] ?? []), found] },
  }))
  // Animation de pose (vol → lieu), visible des deux côtés.
  next = pushFloatingFx(next, { kind: 'play-card', playerIndex: idx, locationId: dest, cardId: found.cardId })
  const destName = me.locations.find((l) => l.id === dest)?.name ?? dest
  next = { ...next, log: [...next.log, `${me.villainName} joue gratuitement **${found.name}** sur **${destName}** (Vol du château).`] }
  // Bowser : un Allié à effet « Étoile si posé sur l'Observatoire » (Dino Piranha,
  // Kamella) déclenche sa pose d'Étoile comme s'il avait été joué normalement.
  if (found.type === 'ally' && (found.effects ?? []).some((e) => e.type === 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY')) {
    next = resolveEffects(next, [{ type: 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY' }], {
      actorIndex: idx,
      hostInstanceId: found.instanceId,
      hostLocationId: dest,
    })
  }
  if (found.type === 'ally') next = processCurseDiscards(next, idx, dest, 'ally-played-here')
  return next
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

/** Opportunisme (Ursula) : reprend en main la carte choisie de la défausse Vilain. */
function applyResolveRecover(state: GameState, instanceId: string): GameState {
  const pending = state.pendingRecover
  if (!pending) throw new Error('Aucune récupération en attente (Opportunisme).')
  if (!pending.candidateIds.includes(instanceId)) throw new Error('Carte choisie invalide.')
  const idx = pending.playerIndex
  const player = state.players[idx]
  // Recherche dans la défausse PUIS dans la pioche (Magie noire récupère de l'une
  // ou l'autre ; les autres effets ne mettent que des ids de défausse).
  const card = player.discard.find((c) => c.instanceId === instanceId)
    ?? player.deck.find((c) => c.instanceId === instanceId)
  if (!card) throw new Error('Carte introuvable (récupération).')
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    deck: p.deck.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, card],
  }))
  if (pending.thenShuffle) {
    const sh = shuffle(next.players[idx].deck, next.rngState)
    next = {
      ...next,
      rngState: sh.state,
      players: next.players.map((p, i) => (i === idx ? { ...p, deck: sh.result } : p)),
    }
  }
  return {
    ...next,
    pendingRecover: null,
    log: [...next.log, `${player.villainName} reprend **${card.name}**${pending.thenShuffle ? ' et mélange son deck' : ''} (${pending.label ?? 'Opportunisme'}).`],
  }
}

/** Scar — Soyez prêtes ! : reprend en main 1 Événement OU jusqu'à 2 Alliés de la
 *  défausse. `instanceId` null = terminer. Un Événement clôt le choix (exclusif) ;
 *  un 1ᵉʳ Allié rouvre le choix limité aux Alliés (un 2ᵉ possible, ou terminer). */
function applyResolveBePrepared(state: GameState, instanceId: string | null): GameState {
  const pending = state.pendingBePrepared
  if (!pending) throw new Error('Aucune récupération en attente (Soyez prêtes !).')
  const idx = pending.playerIndex
  const player = state.players[idx]
  if (instanceId === null) {
    return { ...state, pendingBePrepared: null, log: [...state.log, `${player.villainName} : récupération terminée (Soyez prêtes !).`] }
  }
  if (!pending.candidateIds.includes(instanceId)) throw new Error('Carte choisie invalide (Soyez prêtes !).')
  const card = player.discard.find((c) => c.instanceId === instanceId)
  if (!card) throw new Error('Carte introuvable dans la défausse (Soyez prêtes !).')
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, card],
  }))
  next = { ...next, log: [...next.log, `${player.villainName} reprend **${card.name}** (Soyez prêtes !).`] }
  // Un Événement est exclusif → fin. Un 2ᵉ Allié (alliesOnly) → fin.
  if (card.type === 'effect' || pending.alliesOnly) {
    return { ...next, pendingBePrepared: null }
  }
  // 1ᵉʳ Allié repris : on peut en reprendre un 2ᵉ s'il en reste.
  const remainingAllies = next.players[idx].discard.filter((c) => c.type === 'ally').map((c) => c.instanceId)
  if (remainingAllies.length === 0) {
    return { ...next, pendingBePrepared: null }
  }
  return {
    ...next,
    pendingBePrepared: { playerIndex: idx, candidateIds: remainingAllies, alliesOnly: true },
  }
}

/** Scar — Shenzi : joue gratuitement la Hyène choisie (`instanceId`) de la main sur
 *  le lieu de Shenzi. `instanceId` null = décliner. */
function applyResolveFreeHyena(state: GameState, instanceId: string | null): GameState {
  const pending = state.pendingFreeHyena
  if (!pending) throw new Error('Aucune Hyène gratuite en attente (Shenzi).')
  const idx = pending.playerIndex
  const player = state.players[idx]
  if (instanceId === null) {
    return { ...state, pendingFreeHyena: null, log: [...state.log, `${player.villainName} ne joue pas de Hyène (Shenzi).`] }
  }
  if (!pending.candidateIds.includes(instanceId)) throw new Error('Hyène choisie invalide (Shenzi).')
  const hyena = player.hand.find((c) => c.instanceId === instanceId)
  if (!hyena) throw new Error('Hyène introuvable dans la main (Shenzi).')
  const loc = pending.locationId
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.instanceId !== instanceId),
    board: { ...p.board, [loc]: [...(p.board[loc] ?? []), hyena] },
  }))
  next = { ...next, pendingFreeHyena: null, log: [...next.log, `Shenzi : ${player.villainName} joue gratuitement **${hyena.name}**.`] }
  // Une Malédiction Sommeil sans Rêves se défausse quand un Allié arrive sur le lieu.
  return processCurseDiscards(next, idx, loc, 'ally-played-here')
}

/** Scar — Hakuna Matata : soit `mode: 'play'` rejoue le Héros choisi (≤3) de la pile
 *  Succession dans le royaume (lieu comptant le moins d'Alliés), soit `mode: 'move'`
 *  ouvre le déplacement d'un Héros du royaume vers n'importe quel lieu. */
function applyResolveHakunaMatata(state: GameState, mode: 'play' | 'move', instanceId: string): GameState {
  const pending = state.pendingHakunaMatata
  if (!pending) throw new Error('Aucun Hakuna Matata en attente.')
  const idx = pending.playerIndex
  const p = state.players[idx]
  if (mode === 'play') {
    if (!pending.successionIds.includes(instanceId)) throw new Error('Héros de Succession invalide (Hakuna Matata).')
    const hero = (p.succession ?? []).find((c) => c.instanceId === instanceId)
    if (!hero) throw new Error('Héros introuvable dans la pile Succession.')
    const locked = new Set(p.lockedLocations ?? [])
    const allyCountAt = (locId: string) =>
      (p.board[locId] ?? []).filter((c) => c.type === 'ally' && !c.isWicket).length
    const dest = p.locations.map((l) => l.id).filter((id) => !locked.has(id)).sort((a, b) => allyCountAt(a) - allyCountAt(b))[0]
    if (!dest) throw new Error('Aucun lieu où rejouer le Héros.')
    const next = updatePlayer(state, idx, (pp) => ({
      ...pp,
      succession: (pp.succession ?? []).filter((c) => c.instanceId !== instanceId),
      board: { ...pp.board, [dest]: [...(pp.board[dest] ?? []), hero] },
    }))
    const destName = p.locations.find((l) => l.id === dest)?.name ?? dest
    return {
      ...next,
      pendingHakunaMatata: null,
      log: [...next.log, `Hakuna Matata : **${hero.name}** quitte la pile Succession et revient sur ${destName}.`],
    }
  }
  // mode === 'move' : ouvre le déplacement (n'importe quel lieu) du Héros choisi.
  if (!pending.realmHeroIds.includes(instanceId)) throw new Error('Héros du royaume invalide (Hakuna Matata).')
  return {
    ...state,
    pendingHakunaMatata: null,
    pendingHeroRelocate: { chooserIndex: idx, targetIndex: idx, anyLocation: true, candidateIds: [instanceId] },
    log: [...state.log, 'Hakuna Matata : déplacez le Héros choisi vers n’importe quel lieu.'],
  }
}

/** Tuer (L'Imposteur) : défausse le Coéquipier choisi ; les autres Coéquipiers
 *  (non défaussés) de SON lieu deviennent suspects. */
function applyResolveCrewmateKill(state: GameState, color: string): GameState {
  const pending = state.pendingCrewmateKill
  if (!pending) throw new Error('Aucun Coéquipier à défausser (Tuer).')
  if (!pending.candidateColors.includes(color)) throw new Error('Coéquipier choisi invalide.')
  const idx = pending.playerIndex
  const player = state.players[idx]
  const crew = player.crewmates ?? []
  const victim = crew.find((c) => c.color === color && !c.discarded)
  if (!victim) throw new Error('Coéquipier introuvable.')
  const loc = victim.locationId
  // Tâche : Course — déplace le Coéquipier choisi vers un LIEU VOISIN (≤ 1 d'écart).
  if (pending.mode === 'move') {
    const locIds = player.locations.map((l) => l.id)
    const ci = locIds.indexOf(loc)
    const eligibleLocs = locIds.filter((id, j) => Math.abs(j - ci) === 1 && freeCellAt(crew, id) !== null)
    return {
      ...state,
      pendingCrewmateKill: null,
      pendingCrewmateMove: eligibleLocs.length > 0 ? { playerIndex: idx, color, eligibleLocs } : null,
      log:
        eligibleLocs.length > 0
          ? [...state.log, `${player.villainName} choisit le Coéquipier ${color} (Tâche : Course) — vers quel lieu voisin ?`]
          : [...state.log, `${player.villainName} : aucun lieu voisin libre pour déplacer le Coéquipier ${color}.`],
    }
  }
  // Trahison : élimine simplement le Coéquipier choisi (aucun autre changement).
  if (pending.mode === 'kill-normal') {
    const killed = crew.map((c) => (c.color === color ? { ...c, discarded: true } : c))
    const next = updatePlayer(state, idx, (p) => ({ ...p, crewmates: killed }))
    return {
      ...next,
      pendingCrewmateKill: null,
      log: [...next.log, `${player.villainName} élimine le Coéquipier ${color} (Trahison).`],
    }
  }
  // Assurance : le Coéquipier choisi redevient normal, puis l'Imposteur peut
  // FACULTATIVEMENT le déplacer vers un lieu à ≤ 2 d'écart (s'il y a de la place).
  if (pending.mode === 'reassure') {
    const reassured = crew.map((c) => (c.color === color ? { ...c, suspect: false } : c))
    const next = updatePlayer(state, idx, (p) => ({ ...p, crewmates: reassured }))
    const locIds = player.locations.map((l) => l.id)
    const ci = locIds.indexOf(loc)
    const eligibleLocs = locIds.filter((id, j) => {
      const d = Math.abs(j - ci)
      return d >= 1 && d <= 2 && freeCellAt(reassured, id) !== null
    })
    return {
      ...next,
      pendingCrewmateKill: null,
      pendingCrewmateMove: eligibleLocs.length > 0 ? { playerIndex: idx, color, eligibleLocs } : null,
      log: [...next.log, `${player.villainName} rassure le Coéquipier ${color} (Assurance).`],
    }
  }
  const falseAccusation = pending.mode === 'false-accusation'
  const newCrew = crew.map((c) => {
    if (c.color === color) return { ...c, discarded: true }
    if (c.discarded) return c
    // Fausse accusation : TOUS les autres redeviennent normaux. Tuer : les autres
    // du LIEU de la victime deviennent suspects.
    if (falseAccusation) return { ...c, suspect: false }
    if (c.locationId === loc) return { ...c, suspect: true }
    return c
  })
  const next = updatePlayer(state, idx, (p) => ({ ...p, crewmates: newCrew }))
  const locName = player.locations.find((l) => l.id === loc)?.name ?? loc
  return {
    ...next,
    pendingCrewmateKill: null,
    log: [
      ...next.log,
      falseAccusation
        ? `${player.villainName} défausse le Coéquipier ${color} ; les autres redeviennent normaux (Fausse accusation).`
        : `${player.villainName} défausse le Coéquipier ${color} ; les autres Coéquipiers de ${locName} le suspectent.`,
    ],
  }
}

/** Vidéo de surveillance / Carte : associe l'Objet Fatalité au lieu choisi. */
function applyResolveFateObjectPlace(state: GameState, locationId: LocationId): GameState {
  const pending = state.pendingFateObjectPlace
  if (!pending) throw new Error('Aucun Objet Fatalité à placer.')
  const tgt = state.players[pending.targetIndex]
  if (!tgt.locations.some((l) => l.id === locationId)) throw new Error('Lieu de destination invalide.')
  const next = updatePlayer(state, pending.targetIndex, (p) => ({
    ...p,
    board: { ...p.board, [locationId]: [...(p.board[locationId] ?? []), { ...pending.card, fromFate: true }] },
  }))
  const locName = tgt.locations.find((l) => l.id === locationId)?.name ?? locationId
  return {
    ...next,
    pendingFateObjectPlace: null,
    log: [...next.log, `**${pending.card.name}** est associée à ${locName} (royaume de ${tgt.villainName}).`],
  }
}

/** Assurance (L'Imposteur) : déplace le Coéquipier rassuré vers le lieu choisi. */
function applyResolveCrewmateMove(state: GameState, to: LocationId): GameState {
  const pending = state.pendingCrewmateMove
  if (!pending) throw new Error('Aucun déplacement de Coéquipier en attente (Assurance).')
  if (!pending.eligibleLocs.includes(to)) throw new Error('Lieu de destination invalide (Assurance).')
  const idx = pending.playerIndex
  const player = state.players[idx]
  const crew = placeCrewmateAt(player.crewmates ?? [], pending.color, to)
  const next = updatePlayer(state, idx, (p) => ({ ...p, crewmates: crew }))
  const locName = player.locations.find((l) => l.id === to)?.name ?? to
  return {
    ...next,
    pendingCrewmateMove: null,
    log: [...next.log, `${player.villainName} déplace le Coéquipier ${pending.color} vers ${locName} (Assurance).`],
  }
}

/** Tâche visuelle (L'Imposteur) : rend suspect le Coéquipier `color` choisi par
 *  l'adversaire ; décrémente le compteur (fin auto à 0). */
function applyResolveCrewmateSuspect(state: GameState, color: string): GameState {
  const pending = state.pendingCrewmateSuspect
  if (!pending) throw new Error('Aucune sélection de Coéquipier suspect en attente.')
  const idx = pending.targetIndex
  const player = state.players[idx]
  const crew = player.crewmates ?? []
  const target = crew.find((c) => c.color === color && !c.discarded && !c.suspect)
  if (!target) throw new Error('Coéquipier choisi invalide (déjà suspect / défaussé).')
  const newCrew = crew.map((c) => (c.color === color ? { ...c, suspect: true } : c))
  const next = updatePlayer(state, idx, (p) => ({ ...p, crewmates: newCrew }))
  const remaining = pending.remaining - 1
  // Reste-t-il des Coéquipiers éligibles ?
  const eligibleLeft = newCrew.some((c) => !c.discarded && !c.suspect)
  return {
    ...next,
    pendingCrewmateSuspect: remaining > 0 && eligibleLeft ? { ...pending, remaining } : null,
    log: [...next.log, `${player.villainName} : le Coéquipier ${color} devient suspect (Tâche visuelle).`],
  }
}

/** Colère Titanesque : choisit le lieu voisin (bloqué ou non) où agir. Le joueur
 *  effectue ensuite UNE action normale (résolue via currentLocation = ce lieu). */
function applyResolveGiantLocation(state: GameState, locationId: LocationId): GameState {
  const pending = state.pendingGiantAction
  if (!pending) throw new Error('Aucun choix de lieu (Colère Titanesque) en attente.')
  const p = state.players[pending.playerIndex]
  const order = p.locations.map((l) => l.id)
  const i = order.indexOf(p.pawnLocation ?? '')
  const neighbors = [order[i - 1], order[i + 1]].filter(Boolean) as string[]
  const dest = findLocation(p, locationId)
  if (pending.viaFollowMe) {
    // Scar — Suivez-moi ! : le lieu doit être l'un des lieux à Hyène listés. On ouvre
    // la fenêtre d'action distante (hors Fatalité), sans marqueur (l'Événement est
    // déjà consommé) ; après l'unique action, usedBeforeGiant restaure l'économie.
    if (!(pending.locations ?? []).includes(locationId)) {
      throw new Error(`Lieu « ${locationId} » sans Hyène éligible.`)
    }
    const preserved = state.usedActionIds.filter((a) => a.includes(':'))
    const fateIds = (dest?.actions ?? []).filter((a) => a.type === 'FATE').map((a) => a.id)
    return {
      ...state,
      pendingGiantAction: null,
      actAtLocation: locationId,
      usedActionIds: [...preserved, ...fateIds],
      usedBeforeGiant: state.usedActionIds,
      log: [...state.log, `Suivez-moi ! : ${p.villainName} agit depuis **${dest?.name ?? locationId}** (hors Fatalité).`],
    }
  }
  if (!neighbors.includes(locationId)) throw new Error(`Lieu « ${locationId} » non voisin.`)
  if (pending.viaCanne) {
    // Canne : UNE action disponible du voisin, Fatalité EXCLUE, usage unique/tour.
    // Pendant la fenêtre, on retire les ids d'actions « pleines » (les actions du
    // voisin redeviennent disponibles) et on bloque ses actions Fatalité. Après
    // l'unique action (clearGiant), on restaure l'économie d'actions du lieu réel
    // + le marqueur « canne-action » (réutilisation interdite ce tour).
    const preserved = state.usedActionIds.filter((a) => a.includes(':'))
    const fateIds = (dest?.actions ?? []).filter((a) => a.type === 'FATE').map((a) => a.id)
    return {
      ...state,
      pendingGiantAction: null,
      actAtLocation: locationId,
      usedActionIds: [...preserved, 'canne-action', ...fateIds],
      usedBeforeGiant: [...state.usedActionIds, 'canne-action'],
      log: [...state.log, `Canne : ${p.villainName} agit depuis **${dest?.name ?? locationId}** (hors Fatalité).`],
    }
  }
  return {
    ...state,
    pendingGiantAction: null,
    actAtLocation: locationId,
    usedBeforeGiant: state.usedActionIds,
    log: [...state.log, `Colère Titanesque : ${p.villainName} agit depuis **${dest?.name ?? locationId}**.`],
  }
}

/** Dr Facilier — Canne : ouvre le choix d'un lieu voisin (pendingGiantAction
 *  `viaCanne`). Exige que le pion soit sur le lieu de la Canne et qu'elle n'ait pas
 *  déjà servi ce tour. */
function applyUseCanne(state: GameState): GameState {
  if (state.phase !== 'ACTION') throw new Error(`Impossible d'utiliser la Canne en phase ${state.phase}.`)
  const me = activePlayer(state)
  const loc = me.pawnLocation
  if (!loc) throw new Error('Aucun lieu courant.')
  if (!(me.board[loc] ?? []).some((c) => c.cardId === 'canne')) {
    throw new Error('La Canne n’est pas sur votre lieu.')
  }
  if (state.usedActionIds.includes('canne-action')) {
    throw new Error('La Canne a déjà été utilisée ce tour.')
  }
  const order = me.locations.map((l) => l.id)
  const i = order.indexOf(loc)
  const neighbors = [order[i - 1], order[i + 1]].filter(Boolean) as string[]
  if (neighbors.length === 0) throw new Error('Aucun lieu voisin.')
  return {
    ...state,
    pendingGiantAction: { playerIndex: state.activePlayer, viaCanne: true },
    log: [...state.log, `${me.villainName} utilise la Canne : choisissez un lieu voisin.`],
  }
}

/** Préparez-vous au combat ! (Hadès) : déplace le Titan choisi vers `to` (1 ou 2
 *  lieux) ; le coût (2 JT pour 1 lieu, 5 pour 2) est prélevé si `paid`. */
function applyResolveTitanMove(state: GameState, titanInstanceId: string, to: LocationId): GameState {
  const pending = state.pendingTitanMove
  if (!pending) throw new Error('Aucun déplacement de Titan en attente.')
  if (!pending.titanCandidateIds.includes(titanInstanceId)) {
    throw new Error('Ce Titan n’est pas un choix valide.')
  }
  const idx = pending.playerIndex
  const p = state.players[idx]
  const from = locationOfCard(p, titanInstanceId)
  if (!from) throw new Error('Titan introuvable dans le royaume.')
  const reachable = titanReachableDests(state, idx, titanInstanceId, pending.maxSteps)
  if (!reachable.includes(to)) throw new Error(`Le Titan ne peut pas être déplacé vers « ${to} ».`)
  const order = p.locations.map((l) => l.id)
  const steps = Math.abs(order.indexOf(to) - order.indexOf(from))
  const cost = pending.paid ? (steps >= 2 ? 5 : 2) : 0
  if (pending.paid && p.power < cost) throw new Error(`Pouvoir insuffisant (${cost} JT requis).`)
  let next = state
  if (cost > 0) {
    next = updatePlayer(next, idx, (pp) => ({ ...pp, power: pp.power - cost }))
    next = { ...next, log: [...next.log, `${p.villainName} paie ${cost} JT pour déplacer un Titan de ${steps} lieu(x).`] }
  }
  next = moveTitanTo(next, idx, titanInstanceId, to, { fireTriggers: true })
  return { ...next, pendingTitanMove: null }
}

/** Héra / Pégase (Fatalité) : entrave ou repousse le Titan choisi (pendingTitanSelect). */
function applyResolveTitanSelect(state: GameState, titanInstanceId: string): GameState {
  const pending = state.pendingTitanSelect
  if (!pending) throw new Error('Aucune sélection de Titan en attente.')
  if (!pending.titanCandidateIds.includes(titanInstanceId)) {
    throw new Error('Ce Titan n’est pas un choix valide.')
  }
  const idx = pending.playerIndex
  const p = state.players[idx]
  const loc = locationOfCard(p, titanInstanceId)
  if (!loc) return { ...state, pendingTitanSelect: null }
  const titan = (p.board[loc] ?? []).find((c) => c.instanceId === titanInstanceId)!
  if (pending.kind === 'trap') {
    let next = updatePlayer(state, idx, (pp) => ({
      ...pp,
      board: Object.fromEntries(
        Object.entries(pp.board).map(([l, cards]) => [
          l,
          cards.map((c) => (c.instanceId === titanInstanceId ? { ...c, trapped: true } : c)),
        ]),
      ),
    }))
    next = { ...next, log: [...next.log, `**${titan.name}** est entravé.`] }
    return { ...next, pendingTitanSelect: null }
  }
  // push : recule le Titan de `pushSteps` lieux vers Les Enfers (sans déclencheur).
  const order = p.locations.map((l) => l.id)
  const destIdx = Math.max(0, order.indexOf(loc) - (pending.pushSteps ?? 1))
  const next = order[destIdx] === loc ? state : moveTitanTo(state, idx, titanInstanceId, order[destIdx], { fireTriggers: false })
  return { ...next, pendingTitanSelect: null }
}

/** Dr Facilier — Divination : résout les cartes révélées de la Pile de l'Au-delà
 *  (pendingDivination) dans l'ordre `topInstanceIds` choisi par Facilier. Chaque
 *  carte applique son effet `auDela` (cf. AuDelaEffect) ; une carte sans effet est
 *  défaussée. « Régner » donne la victoire si Facilier détient le Talisman ; les
 *  Esprits des masques interrompent la résolution. */
function applyResolveDivination(state: GameState, topInstanceIds: string[]): GameState {
  const pending = state.pendingDivination
  if (!pending) throw new Error('Aucune Divination en attente.')
  const idx = pending.playerIndex
  const byId = new Map(pending.cards.map((c) => [c.instanceId, c]))
  // Ordre de résolution : l'ordre fourni, complété par les cartes manquantes.
  const order = topInstanceIds.filter((id) => byId.has(id))
  for (const c of pending.cards) if (!order.includes(c.instanceId)) order.push(c.instanceId)

  let next: GameState = { ...state, pendingDivination: null }
  for (let i = 0; i < order.length; i++) {
    const card = byId.get(order[i])!
    const auDela = card.auDela
    const name = next.players[idx].villainName
    if (!auDela) {
      next = updatePlayer(next, idx, (p) => ({ ...p, discard: [...p.discard, card] }))
      next = { ...next, log: [...next.log, `Au-delà : **${card.name}** sans effet, défaussée.`] }
      continue
    }
    switch (auDela.kind) {
      case 'gain-power-discard': {
        next = resolveEffect(next, { type: 'GAIN_POWER', amount: auDela.amount }, { actorIndex: idx })
        next = updatePlayer(next, idx, (p) => ({ ...p, discard: [...p.discard, card] }))
        break
      }
      case 'lose-power-discard': {
        const lose = Math.min(auDela.amount, next.players[idx].power)
        next = updatePlayer(next, idx, (p) => ({ ...p, power: p.power - lose, discard: [...p.discard, card] }))
        next = { ...next, log: [...next.log, `Au-delà : **${card.name}** — ${name} perd ${lose} JT et la défausse.`] }
        break
      }
      case 'place-on-location': {
        const loc = auDela.locationId
        const locName = findLocation(next.players[idx], loc)?.name ?? loc
        next = updatePlayer(next, idx, (p) => ({
          ...p,
          board: { ...p.board, [loc]: [...(p.board[loc] ?? []), card] },
        }))
        next = { ...next, log: [...next.log, `Au-delà : **${card.name}** est placé sur **${locName}**.`] }
        break
      }
      case 'scry-draw-discard': {
        // Tour de passe-passe (Au-delà) : MÊME effet que joué — on regarde le dessus
        // de la pioche et le JOUEUR choisit la carte à garder — puis cette carte est
        // défaussée. Comme le choix est interactif, on défausse Tour de passe-passe,
        // on ouvre le choix (pendingLookTop) et on MET EN ATTENTE le reste de la
        // Divination (les cartes non encore résolues), repris après RESOLVE_LOOK_TOP.
        next = updatePlayer(next, idx, (p) => ({ ...p, discard: [...p.discard, card] }))
        next = resolveEffect(next, { type: 'LOOK_TOP_DRAW_DISCARD', look: auDela.look, take: auDela.take }, { actorIndex: idx })
        if (next.pendingLookTop) {
          const remaining = order.slice(i + 1).map((id) => byId.get(id)!)
          next = {
            ...next,
            pendingLookTop: {
              ...next.pendingLookTop,
              resumeDivination: remaining.length > 0 ? { playerIndex: idx, cards: remaining } : undefined,
            },
          }
          return next // interrompt la résolution ; reprise après le choix
        }
        break // pioche vide : pas de choix, on poursuit la Divination
      }
      case 'win-if-talisman': {
        if (holdsTalisman(next.players[idx])) {
          next = updatePlayer(next, idx, (p) => ({ ...p, discard: [...p.discard, card] }))
          return {
            ...next,
            status: 'WON',
            winner: idx,
            log: [...next.log, `🏆 ${name} révèle « Régner sur la Nouvelle-Orléans » en détenant le Talisman et l'emporte !`],
          }
        }
        next = updatePlayer(next, idx, (p) => ({ ...p, auDela: [...p.auDela, card] }))
        next = { ...next, log: [...next.log, `Au-delà : **${card.name}** — pas de Talisman, retourne dans la Pile de l'Au-delà.`] }
        break
      }
      case 'masks-abort': {
        // Défausse TOUTES les cartes Esprits des masques encore non résolues ;
        // remet les AUTRES non résolues dans la pile (sans appliquer leur effet) ;
        // interrompt la Divination.
        const rest = order.slice(i).map((id) => byId.get(id)!)
        const masks = rest.filter((c) => c.cardId === 'esprits-masques')
        const nonMasks = rest.filter((c) => c.cardId !== 'esprits-masques')
        next = updatePlayer(next, idx, (p) => ({
          ...p,
          discard: [...p.discard, ...masks],
          auDela: [...p.auDela, ...nonMasks],
        }))
        return {
          ...next,
          log: [
            ...next.log,
            `Au-delà : Esprits des masques — ${masks.length} défaussée${masks.length > 1 ? 's' : ''}${nonMasks.length ? `, ${nonMasks.length} remise${nonMasks.length > 1 ? 's' : ''} dans l'Au-delà` : ''}. Divination interrompue.`,
          ],
        }
      }
    }
  }
  return next
}

/** Dr Facilier — Tour de passe-passe : garde les cartes choisies (`keepInstanceIds`,
 *  bornées à `take`) en main, défausse les autres cartes révélées (pendingLookTop). */
function applyResolveLookTop(state: GameState, keepInstanceIds: string[]): GameState {
  const pending = state.pendingLookTop
  if (!pending) throw new Error('Aucun Tour de passe-passe en attente.')
  const idx = pending.playerIndex
  const valid = keepInstanceIds.filter((id) => pending.cards.some((c) => c.instanceId === id))
  const keepSet = new Set(valid.slice(0, pending.take))
  const kept = pending.cards.filter((c) => keepSet.has(c.instanceId))
  const dumped = pending.cards.filter((c) => !keepSet.has(c.instanceId))
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    hand: [...p.hand, ...kept],
    discard: [...p.discard, ...dumped],
  }))
  next = {
    ...next,
    pendingLookTop: null,
    activeDrewCard: kept.length > 0 ? true : state.activeDrewCard,
    log: [
      ...next.log,
      `${next.players[idx].villainName} garde **${kept.map((c) => c.name).join(', ') || '—'}** et défausse ${dumped.length} carte${dumped.length > 1 ? 's' : ''} (Tour de passe-passe).`,
    ],
  }
  // Tour de passe-passe révélé en Divination : reprendre la Divination avec les
  // cartes restantes à résoudre.
  if (pending.resumeDivination && pending.resumeDivination.cards.length > 0) {
    next = {
      ...next,
      pendingDivination: { playerIndex: pending.resumeDivination.playerIndex, cards: pending.resumeDivination.cards },
    }
  }
  return next
}

/** La Méchante Reine — « Croque ! » : élimine le Héros choisi en défaussant autant
 *  de Poison que sa force. Victoire si c'est le Héros-objectif sur le bon lieu. */
function applyResolveTakeABite(state: GameState, heroInstanceId: string): GameState {
  const pending = state.pendingTakeABite
  if (!pending) throw new Error('Aucun « Croque ! » en attente.')
  if (!pending.candidateIds.includes(heroInstanceId)) {
    throw new Error('Ce Héros n’est pas une cible valide pour « Croque ! ».')
  }
  const idx = pending.playerIndex
  const actor = state.players[idx]
  const loc = locationOfCard(actor, heroInstanceId)
  if (!loc) throw new Error('Héros introuvable (Croque !).')
  const hero = (actor.board[loc] ?? []).find((c) => c.instanceId === heroInstanceId)!
  const cost = effectiveStrength(state, idx, hero.instanceId) ?? 0
  const heroLocName = findLocation(actor, loc)?.name ?? loc
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    poison: Math.max(0, (p.poison ?? 0) - cost),
    board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => c.instanceId !== hero.instanceId) },
    fateDiscard: [...p.fateDiscard, { ...hero, lockedPower: undefined }],
  }))
  next = {
    ...next,
    pendingTakeABite: null,
    lastVanquishedHeroStrength: hero.strength ?? 0,
    log: [...next.log, `${actor.villainName} défausse ${cost} Poison et CROQUE **${hero.name}** sur ${heroLocName}.`],
  }
  next = pushDiscardShowcase(next, [hero.cardId], `${actor.villainName} croque ${hero.name}`, idx, 'red', 'bottom')
  const obj = actor.objective
  if (obj.type === 'DEFEAT_HERO_AT_LOCATION' && hero.cardId === obj.heroCardId && loc === obj.locationId) {
    return {
      ...next,
      status: 'WON',
      winner: idx,
      log: [...next.log, `🏆 ${actor.villainName} croque ${hero.name} à la Maison des Nains et l'emporte !`],
    }
  }
  return next
}

/** La Méchante Reine — Foudre : reproduit la capacité de l'Ingrédient choisi
 *  (présent dans la zone Ingrédients). */
function applyResolveDuplicateIngredient(state: GameState, ingredientInstanceId: string): GameState {
  const pending = state.pendingDuplicateIngredient
  if (!pending) throw new Error('Aucune Foudre en attente.')
  if (!pending.candidateIds.includes(ingredientInstanceId)) {
    throw new Error('Cet Ingrédient n’est pas un choix valide pour Foudre.')
  }
  const idx = pending.playerIndex
  const ing = (state.players[idx].ingredients ?? []).find((c) => c.instanceId === ingredientInstanceId)
  if (!ing) throw new Error('Ingrédient introuvable (Foudre).')
  // Le coût de Foudre est celui de l'Ingrédient reproduit, payé maintenant.
  const cost = ing.cost ?? 0
  if (state.players[idx].power < cost) {
    throw new Error(`Pas assez de Pouvoir pour reproduire ${ing.name} (coût ${cost}).`)
  }
  let next: GameState = { ...state, pendingDuplicateIngredient: null }
  next = updatePlayer(next, idx, (p) => ({ ...p, power: p.power - cost }))
  next = resolveEffects(next, ing.effects ?? [], { actorIndex: idx })
  return { ...next, log: [...next.log, `Foudre reproduit la capacité de **${ing.name}** (coût ${cost}).`] }
}

/** La Méchante Reine — Hurlement d'effroi : déplace les Héros (force ≤ 3) du lieu
 *  `from` vers le lieu voisin `to`. Sans choix (from/to absents) : on décline. */
function applyResolveScream(state: GameState, from?: LocationId, to?: LocationId): GameState {
  const pending = state.pendingScream
  if (!pending) throw new Error('Aucun Hurlement d’effroi en attente.')
  const idx = pending.playerIndex
  const player = state.players[idx]
  // Décliner : on referme simplement le choix.
  if (!from || !to) {
    return { ...state, pendingScream: null, log: [...state.log, `${player.villainName} ne déplace aucun Héros (Hurlement d'effroi).`] }
  }
  if (!pending.options.some((o) => o.from === from && o.to === to)) {
    throw new Error('Déplacement invalide (Hurlement d’effroi).')
  }
  const movableIds = new Set(
    (player.board[from] ?? [])
      .filter((c) => c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) <= 3)
      .map((c) => c.instanceId),
  )
  const moving = (player.board[from] ?? []).filter(
    (c) => movableIds.has(c.instanceId) || (c.attachedTo && movableIds.has(c.attachedTo)),
  )
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const next = updatePlayer(state, idx, (p) => ({
    ...p,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
  const fromName = findLocation(player, from)?.name ?? from
  const toName = findLocation(player, to)?.name ?? to
  return {
    ...next,
    pendingScream: null,
    log: [...next.log, `Hurlement d'effroi : ${movableIds.size} Héros déplacé${movableIds.size > 1 ? 's' : ''} de ${fromName} vers ${toName}.`],
  }
}

/** La Méchante Reine — Foudre : ANNULE le choix. Foudre revient en main (depuis la
 *  défausse) et l'action « Jouer une carte » redevient disponible. */
function applyCancelDuplicateIngredient(state: GameState): GameState {
  const pending = state.pendingDuplicateIngredient
  if (!pending) throw new Error('Aucune Foudre à annuler.')
  const idx = pending.playerIndex
  const fId = pending.foudreInstanceId
  const actId = pending.actionId
  const player = state.players[idx]
  const foudre = fId ? player.discard.find((c) => c.instanceId === fId) : undefined
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    discard: foudre ? p.discard.filter((c) => c.instanceId !== fId) : p.discard,
    hand: foudre ? [...p.hand, foudre] : p.hand,
  }))
  next = {
    ...next,
    pendingDuplicateIngredient: null,
    usedActionIds: actId ? next.usedActionIds.filter((id) => id !== actId) : next.usedActionIds,
    log: [...next.log, `${player.villainName} annule Foudre.`],
  }
  return next
}

/** Dr Facilier — Si près du but / Charlotte : place `toAudelaIds` (cartes révélées
 *  autorisées) dans la Pile de l'Au-delà de Facilier ; remet les autres
 *  (`deckTopOrder`) sur le dessus de sa pioche, 1ʳᵉ = tout en haut. */
function applyResolveFateScry(
  state: GameState,
  toAudelaIds: string[],
  deckTopOrder: string[],
): GameState {
  const pending = state.pendingFateScry
  if (!pending) throw new Error('Aucune carte Fatalité révélée à trier.')
  const idx = pending.targetIndex
  const byId = new Map(pending.cards.map((c) => [c.instanceId, c]))
  // Vers l'Au-delà : uniquement des cartes révélées AUTORISÉES (hors Talisman /
  // Divination). Tout le reste revient sur la pioche.
  const toPile = toAudelaIds
    .filter((id) => byId.has(id) && canEnterAuDela(byId.get(id)!))
    .map((id) => byId.get(id)!)
  const pileIds = new Set(toPile.map((c) => c.instanceId))
  // Ordre de retour : l'ordre demandé (filtré) puis les cartes non citées, en
  // garantissant que TOUTES les cartes non envoyées dans l'Au-delà reviennent.
  const ordered: CardInstance[] = []
  const used = new Set<string>()
  for (const id of deckTopOrder) {
    const c = byId.get(id)
    if (c && !pileIds.has(id) && !used.has(id)) { ordered.push(c); used.add(id) }
  }
  for (const c of pending.cards) {
    if (!pileIds.has(c.instanceId) && !used.has(c.instanceId)) { ordered.push(c); used.add(c.instanceId) }
  }
  const target = state.players[idx]
  let next = updatePlayer(state, idx, (p) => ({
    ...p,
    deck: [...ordered, ...p.deck],
    auDela: [...p.auDela, ...toPile],
  }))
  next = {
    ...next,
    pendingFateScry: null,
    log: [
      ...next.log,
      toPile.length > 0
        ? `${toPile.length} carte${toPile.length > 1 ? 's' : ''} de la pioche de ${target.villainName} ${toPile.length > 1 ? 'rejoignent' : 'rejoint'} la Pile de l'Au-delà.`
        : `${target.villainName} : aucune carte ne rejoint l'Au-delà.`,
    ],
  }
  return next
}

/** Objet « véhicule » (Hadès — Char ; Bowser — Bateau) : déplace la figurine +
 *  l'Objet vers `to` (1×/tour) et permet d'y effectuer UNE seule action disponible
 *  (hors Fatalité). On réutilise le mécanisme « agir à un lieu » (actAtLocation) :
 *  pendant la fenêtre, seules les actions NON-Fatalité de `to` sont jouables ;
 *  après la 1ʳᵉ action (clearGiant), toutes les actions de `to` sont marquées
 *  utilisées → plus rien à faire ce tour. */
function applyChariotMove(state: GameState, instanceId: string, to: string): GameState {
  if (state.phase !== 'ACTION') throw new Error(`Impossible d'utiliser ce véhicule en phase ${state.phase}.`)
  const me = activePlayer(state)
  const from = locationOfCard(me, instanceId)
  if (!from) throw new Error(`Véhicule « ${instanceId} » introuvable.`)
  const card = (me.board[from] ?? []).find((c) => c.instanceId === instanceId)!
  if (!card.ridesWithPawn) throw new Error(`« ${card.name} » n'est pas un véhicule.`)
  if (me.pawnLocation !== from) throw new Error(`Vous devez être sur le lieu du ${card.name} pour l’utiliser.`)
  if (from === to) throw new Error(`Le ${card.name} est déjà sur ce lieu.`)
  const dest = findLocation(me, to)
  if (!dest) throw new Error(`Lieu inconnu : « ${to} ».`)
  const usedKey = `chariot-move:${instanceId}`
  if (state.usedActionIds.includes(usedKey)) throw new Error('Le Char a déjà été utilisé ce tour.')
  const moving = (me.board[from] ?? []).filter(
    (c) => c.instanceId === instanceId || c.attachedTo === instanceId,
  )
  const movingIds = new Set(moving.map((c) => c.instanceId))
  const next = updateActivePlayer(state, (p) => ({
    ...p,
    pawnLocation: to,
    board: {
      ...p.board,
      [from]: (p.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [to]: [...(p.board[to] ?? []), ...moving],
    },
  }))
  const preserved = state.usedActionIds.filter((a) => a.includes(':'))
  const fateIds = dest.actions.filter((a) => a.type === 'FATE').map((a) => a.id)
  const allDestIds = dest.actions.map((a) => a.id)
  // Actions ACCORDÉES par les Objets posés sur `to` (Galaxie en verre → Déplacer
  // un Allié/Objet…) : leur id `granted:<instanceId>` doit AUSSI être consommé
  // après l'unique action, sinon une 2ᵉ action resterait jouable (cf. bug Bateau).
  const grantedDestIds = (next.players[state.activePlayer].board[to] ?? [])
    .filter((c) => c.grantsAction && !c.attachedTo)
    .map((c) => `granted:${c.instanceId}`)
  return {
    ...next,
    // Pendant la fenêtre : Fatalité bloquée, le reste de `to` jouable (une fois).
    usedActionIds: [...preserved, usedKey, ...fateIds],
    actAtLocation: to,
    // Après l'unique action (clearGiant) : toutes les actions de `to` (imprimées
    // ET accordées par des Objets) deviennent utilisées → plus rien ce tour.
    usedBeforeGiant: [...preserved, usedKey, ...allDestIds, ...grantedDestIds],
    log: [
      ...next.log,
      `${me.villainName} déplace sa figurine et le ${card.name} vers **${dest.name}** : une action disponible (hors Fatalité).`,
    ],
  }
}

/** Après une action « géante » (Colère Titanesque) : on efface actAtLocation et on
 *  restaure usedActionIds (cette action d'un lieu voisin ne consomme pas l'économie
 *  d'actions du lieu courant). */
function clearGiant(before: GameState, after: GameState): GameState {
  if (!before.actAtLocation) return after
  return {
    ...after,
    actAtLocation: null,
    usedActionIds: before.usedBeforeGiant ?? after.usedActionIds,
    usedBeforeGiant: null,
  }
}

/**
 * Ratigan — Piège ingénieux : au début du tour du joueur `idx` (avant son
 * déplacement), referme chaque piège amorcé de son royaume — élimine tous les
 * Héros de son lieu — puis défausse la carte. No-op pour les autres vilains / sans
 * piège amorcé. Doit tourner AVANT la vérification de victoire (un piège peut
 * éliminer Basil côté « Le Rat »).
 */
function resolveArmedTraps(state: GameState, idx: number): GameState {
  const player = state.players[idx]
  const armed: { loc: LocationId; instanceId: string; name: string }[] = []
  for (const loc of player.locations) {
    for (const c of player.board[loc.id] ?? []) {
      if (c.trapArmed && c.cardId === 'piege-ingenieux') {
        armed.push({ loc: loc.id, instanceId: c.instanceId, name: c.name })
      }
    }
  }
  let next = state
  for (const trap of armed) {
    next = resolveEffects(next, [{ type: 'ELIMINATE_ALL_HEROES_AT', locationId: trap.loc }], { actorIndex: idx })
    const card = (next.players[idx].board[trap.loc] ?? []).find((c) => c.instanceId === trap.instanceId)
    next = updatePlayer(next, idx, (p) => ({
      ...p,
      board: { ...p.board, [trap.loc]: (p.board[trap.loc] ?? []).filter((c) => c.instanceId !== trap.instanceId) },
      discard: card ? [...p.discard, { ...card, trapArmed: undefined }] : p.discard,
    }))
    next = { ...next, log: [...next.log, `Le **Piège ingénieux** se referme puis est défaussé.`] }
  }
  return next
}

function applyEndTurn(state: GameState): GameState {
  if (!canEndTurn(state)) {
    throw new Error(`Impossible de terminer le tour en phase ${state.phase}.`)
  }
  // Lever du jour : le blocage des Pages du joueur dont le tour se termine est consommé.
  if (state.players[state.activePlayer].noPagePlay) {
    state = updateActivePlayer(state, (p) => ({ ...p, noPagePlay: false }))
  }
  // Fin du tour courant : le joueur actif complète sa main à 4…
  const drawn0 = drawToLimit(state)
  // …puis la phase Coéquipiers (défausse des Tâches/Sabotages encombrés, compte à
  // rebours, déplacement). Sans effet pour les autres vilains.
  const drawn = crewmateEndOfTurn(drawn0, drawn0.activePlayer)
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
    uncoverCoveredActions: false,
    lastVanquishedHeroStrength: undefined,
    diabloFree: null,
    pendingTrapVanquish: null,
    actAtLocation: null,
    usedBeforeGiant: null,
    pendingGiantAction: null,
    pendingTitanMove: null,
    pendingTitanSelect: null,
    pendingDivination: null,
    pendingLookTop: null,
    pendingFateScry: null,
    pendingHeroRelocate: null,
    activeMovedCard: false,
    activeDrewCard: false,
    activeDiscardedCount: 0,
    activeGainedPower: 0,
    activePlayedCount: 0,
    activeFateTargets: [],
    // Effets « jusqu'à la fin de votre tour » du joueur qui termine (Sablier Géant).
    players: drawn.players.map((p, i) =>
      i === drawn.activePlayer
        ? {
            ...p,
            // Noir de nuit : la possibilité de refaire une action expire en fin de tour.
            repeatActionAvailable: false,
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
  // Poussière de momie : le bonus « Poison sur Fatalité subie » expire au début du
  // tour de la Méchante Reine.
  if (started.players[nextIdx].poisonOnFateTargeted) {
    started = updatePlayer(started, nextIdx, (p) => ({ ...p, poisonOnFateTargeted: false }))
  }
  // Le verrou « seule action » de Beauté endormie expire au début du tour suivant.
  if (started.players[nextIdx].soleActionLock) {
    started = updatePlayer(started, nextIdx, (p) => ({ ...p, soleActionLock: false }))
  }
  // Yzma — Beauté endormie : au début de son tour, AVANT le déplacement, ouvre un
  // choix interactif (gagner 2 JT / piocher 2 / déplacer un Héros voisin), chaque
  // option indépendante. Le déplacement reste bloqué tant qu'il n'est pas résolu.
  if (started.players[nextIdx].beautySleepPending) {
    started = {
      ...updatePlayer(started, nextIdx, (p) => ({ ...p, beautySleepPending: false })),
      pendingBeautySleep: { playerIndex: nextIdx },
      log: [
        ...started.log,
        `Beauté endormie : ${started.players[nextIdx].villainName} se réveille — choisissez vos effets avant de vous déplacer.`,
      ],
    }
  }

  // Ratigan — Piège ingénieux : referme les pièges amorcés (avant le déplacement et
  // la victoire — un piège peut éliminer Basil côté « Le Rat »).
  started = resolveArmedTraps(started, nextIdx)

  // Ratigan — la bascule « Le Rat » est désormais immédiate (syncRatiganObjectiveAll
  // après chaque action) ; au pire on resynchronise ici par sécurité avant la victoire.
  started = syncRatiganObjectiveAll(started)

  // Pat Hibulaire — début de son tour : reset du Pouvoir dépensé + complétion des
  // tuiles « début de tour » remplies (peut déclencher la victoire ici).
  started = resolvePeteStartOfTurn(started, nextIdx)
  if (started.status === 'WON') return started

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

/** Pat Hibulaire — libellés FR des tuiles Objectif (journal). */
const PETE_GOAL_LABEL: Record<PeteGoalKind, string> = {
  'win-big': 'Jackpot',
  'power-play': 'Soif de Pouvoir',
  'strike-it-rich': 'Signe de Richesse',
  'round-up': 'Bande Puissante',
  'rule-the-realm': 'Main Basse sur la Ville',
}

/** Pat Hibulaire — marque une tuile Objectif `completed` (révélée), journalise, et
 *  déclare la victoire si les 4 tuiles sont alors remplies. `kindOnly` cible une
 *  seule tuile (par son kind). Pur. */
function completeGoal(state: GameState, idx: number, kind: PeteGoalKind): GameState {
  const p = state.players[idx]
  if (!p.goals) return state
  const goals = p.goals.map((g) =>
    g.kind === kind && !g.completed ? { ...g, completed: true, revealed: true } : g,
  )
  if (goals.every((g, i) => g === p.goals![i])) return state
  let next = updatePlayer(state, idx, (pl) => ({ ...pl, goals }))
  next = {
    ...next,
    log: [...next.log, `${p.villainName} remplit l'objectif **${PETE_GOAL_LABEL[kind]}** !`],
  }
  if (goals.every((g) => g.completed)) {
    return {
      ...next,
      status: 'WON',
      winner: idx,
      log: [...next.log, `🏆 ${p.villainName} a rempli ses 4 objectifs et l'emporte !`],
    }
  }
  return next
}

/** Pat Hibulaire — au début de son tour : remet à zéro le Pouvoir dépensé et
 *  complète les tuiles « début de tour » (Strike It Rich / Round Up / Rule the
 *  Realm) dont la condition est remplie (sauf si Mickey bloque). Pur. No-op pour
 *  les autres vilains. */
function resolvePeteStartOfTurn(state: GameState, idx: number): GameState {
  const p = state.players[idx]
  if (!p.goals) return state
  let next = state
  if (p.powerSpentThisTurn) {
    next = updatePlayer(next, idx, (pl) => ({ ...pl, powerSpentThisTurn: 0 }))
  }
  if (goalsBlockedByHero(next.players[idx])) return next
  for (const g of next.players[idx].goals ?? []) {
    if (!g.completed && isPassiveGoalMet(next.players[idx], g)) {
      next = completeGoal(next, idx, g.kind)
      if (next.status === 'WON') return next
    }
  }
  return next
}

/** Pat Hibulaire — après chaque action : complète la tuile Power Play si ≥6 Pouvoir
 *  ont été dépensés ce tour avec le pion sur le lieu de la tuile (sauf si Mickey
 *  bloque). Win Big est traité dans l'effet d'Une Petite Partie ?. Pur. */
function syncPetePowerPlay(state: GameState): GameState {
  const idx = state.activePlayer
  const p = state.players[idx]
  if (!p.goals || state.status !== 'PLAYING') return state
  if (goalsBlockedByHero(p)) return state
  const goal = p.goals.find(
    (g) => g.kind === 'power-play' && !g.completed && g.locationId === p.pawnLocation,
  )
  if (!goal || (p.powerSpentThisTurn ?? 0) < 6) return state
  return completeGoal(state, idx, 'power-play')
}

/** Applique une action de jeu et renvoie le nouvel état. Pur, déterministe. */
export function applyAction(state: GameState, action: GameAction): GameState {
  // Après chaque action : (1) bascule éventuelle de l'objectif double de Ratigan
  // (Reine Robot défaussée → « Le Rat ») ; (2) Pat Hibulaire — complétion de la
  // tuile Power Play si ≥6 Pouvoir dépensés ce tour sur le bon lieu.
  return syncPetePowerPlay(syncRatiganObjectiveAll(applyActionCore(state, action)))
}

function applyActionCore(state: GameState, action: GameAction): GameState {
  if (state.status !== 'PLAYING') {
    // Le Coup Royal gagnant met fin à la partie : on autorise tout de même la
    // fermeture de sa fenêtre de résultat (sinon elle resterait bloquée).
    if (action.type === 'DISMISS_ROYAL_CROQUET') {
      return { ...state, pendingRoyalCroquet: null }
    }
    throw new Error('La partie est terminée.')
  }
  // Une Fatalité révélée doit être résolue avant tout autre coup — sauf une
  // Condition jouée par le non-actif (réaction « à tout moment ») ET la résolution
  // d'un sondage ouvert PAR cette réaction (Scar — La vie n'est pas juste ouvre
  // pendingScry alors que la Fatalité de l'adversaire est encore en attente).
  if (
    state.pendingFate &&
    action.type !== 'RESOLVE_FATE' &&
    action.type !== 'PASS_FATE' &&
    action.type !== 'PLAY_CONDITION' &&
    action.type !== 'RESOLVE_SCRY'
  ) {
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
  // Mauvais Coup : le choix des 2 cartes du dessous doit être résolu d'abord.
  if (
    state.pendingMauvaisCoup &&
    action.type !== 'RESOLVE_MAUVAIS_COUP' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez une carte à garder (RESOLVE_MAUVAIS_COUP).')
  }
  // Yzma — Beauté endormie (réveil) : à résoudre avant tout autre coup, déplacement
  // du pion compris (« avant de vous déplacer… »).
  if (
    state.pendingBeautySleep &&
    action.type !== 'RESOLVE_BEAUTY_SLEEP' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Résolvez le réveil de Beauté endormie (RESOLVE_BEAUTY_SLEEP).')
  }
  // Déplacement d'Allié (Pas de Quartier ! / Grand Terrier) : à résoudre d'abord
  // (RESOLVE_ALLY_MOVE_BUFF), ou décliner si facultatif (SKIP_ALLY_MOVE_BUFF).
  if (
    state.pendingAllyMoveBuff &&
    action.type !== 'RESOLVE_ALLY_MOVE_BUFF' &&
    action.type !== 'SKIP_ALLY_MOVE_BUFF' &&
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
  if (state.pendingCastleTheft && action.type !== 'RESOLVE_CASTLE_THEFT' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez où poser la carte dévoilée (RESOLVE_CASTLE_THEFT).')
  }
  // Opportunisme : récupérer une carte de la défausse d'abord.
  if (state.pendingBePrepared && action.type !== 'RESOLVE_BE_PREPARED' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez les cartes à reprendre (RESOLVE_BE_PREPARED).')
  }
  if (state.pendingFreeHyena && action.type !== 'RESOLVE_FREE_HYENA' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez la Hyène à jouer gratuitement (RESOLVE_FREE_HYENA).')
  }
  if (state.pendingHakunaMatata && action.type !== 'RESOLVE_HAKUNA_MATATA' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Résolvez Hakuna Matata (RESOLVE_HAKUNA_MATATA).')
  }
  if (state.pendingRecover && action.type !== 'RESOLVE_RECOVER' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Récupérez une carte de votre défausse (RESOLVE_RECOVER).')
  }
  // Tuer (L'Imposteur) : choisir le Coéquipier à défausser d'abord.
  if (
    state.pendingCrewmateKill &&
    action.type !== 'RESOLVE_CREWMATE_KILL' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez le Coéquipier à défausser (RESOLVE_CREWMATE_KILL).')
  }
  // Tâche visuelle (L'Imposteur) : choisir les Coéquipiers à rendre suspects.
  if (
    state.pendingCrewmateSuspect &&
    action.type !== 'RESOLVE_CREWMATE_SUSPECT' &&
    action.type !== 'DONE_CREWMATE_SUSPECT' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez les Coéquipiers à rendre suspects (RESOLVE_CREWMATE_SUSPECT).')
  }
  // Assurance (L'Imposteur) : déplacement optionnel du Coéquipier rassuré.
  if (
    state.pendingCrewmateMove &&
    action.type !== 'RESOLVE_CREWMATE_MOVE' &&
    action.type !== 'DONE_CREWMATE_MOVE' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Déplacez le Coéquipier rassuré ou terminez (Assurance).')
  }
  // Vidéo de surveillance / Carte : choisir le lieu d'association d'abord.
  if (
    state.pendingFateObjectPlace &&
    action.type !== 'RESOLVE_FATE_OBJECT_PLACE' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error("Choisissez le lieu où associer l'Objet (RESOLVE_FATE_OBJECT_PLACE).")
  }
  // Colère Titanesque : choisir le lieu voisin où agir d'abord.
  if (state.pendingGiantAction && action.type !== 'RESOLVE_GIANT_LOCATION' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez le lieu voisin où agir (RESOLVE_GIANT_LOCATION).')
  }
  // Préparez-vous au combat ! (Hadès) : le déplacement du Titan doit être résolu d'abord.
  if (state.pendingTitanMove && action.type !== 'RESOLVE_TITAN_MOVE' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez le Titan à déplacer (RESOLVE_TITAN_MOVE).')
  }
  // Héra / Pégase (Hadès, Fatalité) : la sélection du Titan doit être résolue d'abord.
  if (state.pendingTitanSelect && action.type !== 'RESOLVE_TITAN_SELECT' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez le Titan (RESOLVE_TITAN_SELECT).')
  }
  // Divination (Dr Facilier) : les cartes révélées de l'Au-delà doivent être
  // résolues avant tout autre coup.
  if (state.pendingDivination && action.type !== 'RESOLVE_DIVINATION' && action.type !== 'PLAY_CONDITION') {
    throw new Error("Résolvez les cartes révélées de l'Au-delà (RESOLVE_DIVINATION).")
  }
  // Tour de passe-passe (Dr Facilier) : le choix de la carte gardée doit être
  // résolu avant tout autre coup.
  if (state.pendingLookTop && action.type !== 'RESOLVE_LOOK_TOP' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez la carte à garder (RESOLVE_LOOK_TOP).')
  }
  // La Méchante Reine — « Croque ! » : le choix du Héros à croquer doit être résolu
  // avant tout autre coup.
  if (state.pendingTakeABite && action.type !== 'RESOLVE_TAKE_A_BITE' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Choisissez le Héros à croquer (RESOLVE_TAKE_A_BITE).')
  }
  if (
    state.pendingDuplicateIngredient &&
    action.type !== 'RESOLVE_DUPLICATE_INGREDIENT' &&
    action.type !== 'CANCEL_DUPLICATE_INGREDIENT' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez l’Ingrédient à reproduire (RESOLVE_DUPLICATE_INGREDIENT).')
  }
  if (state.pendingScream && action.type !== 'RESOLVE_SCREAM' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Résolvez Hurlement d’effroi (RESOLVE_SCREAM).')
  }
  // Si près du but / Charlotte (Dr Facilier) : le tri des cartes révélées doit
  // être résolu avant tout autre coup.
  if (state.pendingFateScry && action.type !== 'RESOLVE_FATE_SCRY' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Triez les cartes révélées (RESOLVE_FATE_SCRY).')
  }
  if (
    state.pendingYzmaFate &&
    action.type !== 'RESOLVE_YZMA_FATE_DECK' &&
    action.type !== 'RESOLVE_YZMA_FATE_CARD' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Résolvez la Fatalité d’Yzma (choix de pioche puis de carte).')
  }
  if (
    state.pendingYzmaOwnDeck &&
    action.type !== 'RESOLVE_YZMA_OWN_DECK' &&
    action.type !== 'RESOLVE_YZMA_HAMMER' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Choisissez la pioche Fatalité sur laquelle agir (RESOLVE_YZMA_OWN_DECK).')
  }
  if (
    state.pendingYzmaManipulate &&
    action.type !== 'RESOLVE_YZMA_MANIPULATE' &&
    action.type !== 'PLAY_CONDITION'
  ) {
    throw new Error('Yzma : résolvez la manipulation des pioches Fatalité (RESOLVE_YZMA_MANIPULATE).')
  }
  if (state.pendingFinishJob && action.type !== 'RESOLVE_FINISH_JOB' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Finis le travail : choisissez l’Allié puis le lieu (RESOLVE_FINISH_JOB).')
  }
  if (state.pendingReplayEvent && action.type !== 'RESOLVE_REPLAY_EVENT' && action.type !== 'PLAY_CONDITION') {
    throw new Error('Ironie du sort : choisissez l’Événement à rejouer (RESOLVE_REPLAY_EVENT).')
  }
  switch (action.type) {
    case 'MOVE':
      return applyMove(state, action.to)
    case 'EXECUTE_ACTION':
      return clearGiant(state, applyExecuteAction(state, action.actionId, action.count))
    case 'PLAY_CARD': {
      const r = clearGiant(
        state,
        applyPlayCard(
          state,
          action.actionId,
          action.instanceId,
          action.to,
          action.attachTo,
          action.targetHeroId,
          action.allyInstanceIds,
          action.allyMove,
          action.shrinkFreeActionId,
          action.engrenagesIds,
        ),
      )
      // Compte les cartes jouées ce tour (déclencheur Insidieux de L'Imposteur).
      return { ...r, activePlayedCount: (state.activePlayedCount ?? 0) + 1 }
    }
    case 'DISCARD_CARDS':
      return clearGiant(state, applyDiscardCards(state, action.actionId, action.instanceIds))
    case 'MOVE_CARD':
      return clearGiant(state, applyMoveCard(state, action.actionId, action.instanceId, action.to))
    case 'MOVE_HERO':
      return clearGiant(state, applyMoveHero(state, action.actionId, action.heroInstanceId, action.to))
    case 'ACTIVATE':
      return clearGiant(
        state,
        applyActivate(state, action.actionId, action.cardInstanceId, action.to, action.itemInstanceId),
      )
    case 'FATE':
      return clearGiant(state, applyFate(state, action.actionId))
    case 'RESOLVE_FATE':
      return applyResolveFate(state, action.instanceId, action.to, action.targetHeroId, action.enlargeToward)
    case 'PASS_FATE':
      return applyPassFate(state)
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
    case 'RESOLVE_ALLY_RELOCATE':
      return applyResolveAllyRelocate(state, action.allyInstanceId, action.to)
    case 'SKIP_HERO_RELOCATE':
      return applySkipHeroRelocate(state)
    case 'USE_CANNE':
      return applyUseCanne(state)
    case 'RESOLVE_TELEPORT':
      return applyResolveTeleport(state, action.to)
    case 'RESOLVE_MAUVAIS_COUP':
      return applyResolveMauvaisCoup(state, action.keepInstanceId, action.otherPlacement)
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
    case 'SKIP_ALLY_MOVE_BUFF':
      return applySkipAllyMoveBuff(state)
    case 'RESOLVE_FATE_CHOICE':
      return applyResolveFateChoice(state, action.instanceId)
    case 'RESOLVE_FETCHED_HERO':
      return applyResolveFetchedHero(state, action.play, action.to)
    case 'RESOLVE_CASTLE_THEFT':
      return applyResolveCastleTheft(state, action.to)
    case 'RESOLVE_RECOVER':
      return applyResolveRecover(state, action.instanceId)
    case 'RESOLVE_BE_PREPARED':
      return applyResolveBePrepared(state, action.instanceId)
    case 'RESOLVE_FREE_HYENA':
      return applyResolveFreeHyena(state, action.instanceId)
    case 'RESOLVE_HAKUNA_MATATA':
      return applyResolveHakunaMatata(state, action.mode, action.instanceId)
    case 'RESOLVE_CREWMATE_KILL':
      return applyResolveCrewmateKill(state, action.color)
    case 'RESOLVE_CREWMATE_SUSPECT':
      return applyResolveCrewmateSuspect(state, action.color)
    case 'DONE_CREWMATE_SUSPECT':
      return { ...state, pendingCrewmateSuspect: null }
    case 'RESOLVE_CREWMATE_MOVE':
      return applyResolveCrewmateMove(state, action.to)
    case 'DONE_CREWMATE_MOVE':
      return { ...state, pendingCrewmateMove: null }
    case 'RESOLVE_FATE_OBJECT_PLACE':
      return applyResolveFateObjectPlace(state, action.locationId)
    case 'RESOLVE_GIANT_LOCATION':
      return applyResolveGiantLocation(state, action.locationId)
    case 'RESOLVE_TITAN_MOVE':
      return applyResolveTitanMove(state, action.titanInstanceId, action.to)
    case 'RESOLVE_TITAN_SELECT':
      return applyResolveTitanSelect(state, action.titanInstanceId)
    case 'RESOLVE_DIVINATION':
      return applyResolveDivination(state, action.topInstanceIds)
    case 'RESOLVE_LOOK_TOP':
      return applyResolveLookTop(state, action.keepInstanceIds)
    case 'RESOLVE_TAKE_A_BITE':
      return applyResolveTakeABite(state, action.heroInstanceId)
    case 'RESOLVE_DUPLICATE_INGREDIENT':
      return applyResolveDuplicateIngredient(state, action.ingredientInstanceId)
    case 'CANCEL_DUPLICATE_INGREDIENT':
      return applyCancelDuplicateIngredient(state)
    case 'RESOLVE_SCREAM':
      return applyResolveScream(state, action.from, action.to)
    case 'RESOLVE_FATE_SCRY':
      return applyResolveFateScry(state, action.toAudelaIds, action.deckTopOrder)
    case 'RESOLVE_YZMA_FATE_DECK':
      return applyResolveYzmaFateDeck(state, action.locationId)
    case 'RESOLVE_YZMA_FATE_CARD':
      return applyResolveYzmaFateCard(state, action.instanceId)
    case 'RESOLVE_YZMA_OWN_DECK':
      return applyResolveYzmaOwnDeck(state, action.locationId)
    case 'RESOLVE_YZMA_HAMMER':
      return applyResolveYzmaHammer(state, action.instanceIds)
    case 'RESOLVE_YZMA_MANIPULATE':
      return applyResolveYzmaManipulate(state, action.heroInstanceId, action.locationIds)
    case 'RESOLVE_FINISH_JOB':
      return applyResolveFinishJob(state, action.allyInstanceId, action.to)
    case 'RESOLVE_BEAUTY_SLEEP':
      return applyResolveBeautySleep(state, action.gainPower, action.draw, action.heroMove)
    case 'RESOLVE_REPLAY_EVENT':
      return applyResolveReplayEvent(state, action.instanceId)
    case 'CHARIOT_MOVE':
      return applyChariotMove(state, action.instanceId, action.to)
    case 'USE_NEVERLAND_MAP':
      return applyUseNeverlandMap(state, action.itemInstanceId, action.to, action.attachTo)
    case 'TEST_PLACE_FATE':
      return applyTestPlaceFate(state, action.card, action.to)
    case 'TEST_PLAY_CONDITION':
      return applyTestPlayCondition(state, action.card, action.allyInstanceId, action.to)
    case 'TEST_PLAY_FATE_CARD':
      return applyTestPlayFateCard(state, action.card, action.targetHeroId, action.enlargeToward)
    case 'VANQUISH':
      return clearGiant(state, applyVanquish(state, action.actionId, action.heroInstanceId, action.allyInstanceIds))
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
