// =============================================================================
// Système d'effets composables.
//
// Chaque carte porte une liste d'Effect (cf. types.ts). Le dispatcher ci-dessous
// sait résoudre chaque type d'effet sur l'état pour un joueur ACTEUR donné.
// Par défaut, l'acteur est le joueur actif (cartes Vilain). Pour les effets
// « à la pose » d'un Héros, l'acteur est la CIBLE de la Fatalité (celui qui
// reçoit le Héros sur son plateau), et le contexte porte aussi l'identifiant
// de la carte hôte (le Héros) et le lieu où il vient d'être posé.
//
// Ajouter un comportement = ajouter un variant à Effect + un `case` ici.
// =============================================================================

import type { CardInstance, Crewmate, CurseDiscardTrigger, Effect, GameState, LocationId, PlayerState } from './types'
import { activePlayer, findLocation, pushDiscardShowcase, pushFloatingFx, pushRobinSteal, pushShowcase, revealFate, syncObservatoryLock, updateActivePlayer, updatePlayer } from './state'
import { neighborLocIds, placeCrewmateAt } from './crewmates'
import { shuffle } from './rng'
import {
  adjacentLocationIds,
  effectiveStrength,
  hasHeroInRealm,
  heroPlacementLocations,
  locationOfCard,
  teleportTargets,
  transformableGuards,
} from './rules'

/** Contexte de résolution d'un effet : qui en est l'acteur, et le cas échéant
 *  la carte hôte et le lieu hôte (pour les effets « à la pose » d'un Héros). */
export interface EffectContext {
  /** Index du joueur qui SUBIT/PROVOQUE l'effet. Défaut : joueur actif. */
  actorIndex?: number
  /** Carte hôte sur laquelle s'ancrer (Héros qui vient d'être posé, etc.). */
  hostInstanceId?: string
  /** Lieu où se trouve la carte hôte. */
  hostLocationId?: LocationId
  /** Héros ciblé par la carte jouée (Emprisonnement : Héros à déplacer). */
  targetHeroId?: string
  /** Alliés à utiliser pour les effets qui déclenchent un Vanquish (Intimidation). */
  allyInstanceIds?: string[]
  /** Allié à déplacer librement avant un Vanquish (Tendre un Piège). */
  allyMove?: { instanceId: string; to: LocationId }
  /** Reine de Cœur — Agrandir : lieu voisin vers lequel le Héros agrandi pivote
   *  (choisi par le joueur qui pose la Fatalité). Absent = choix auto par le moteur. */
  enlargeToward?: LocationId
  /** Reine de Cœur — Rapetisser : action du haut que le Héros rapetissé laisse
   *  LIBRE (choisie par le joueur). Absent = la 1ʳᵉ action du haut (auto). */
  shrinkFreeActionId?: string
}

// --- Helpers Coéquipiers (L'Imposteur) ---------------------------------------

/** Lieux « périmètre » d'un Imposteur : son lieu de pion + les lieux portant un de
 *  ses Alliés (non associés). Sert aux effets « sur votre lieu ou celui d'un Allié ». */
function crewPeri(p: GameState['players'][number]): Set<string> {
  const allyLocs = p.locations
    .filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo))
    .map((l) => l.id)
  return new Set([p.pawnLocation, ...allyLocs].filter((v): v is string => !!v))
}

/** Remplace les Coéquipiers du joueur `idx` et ajoute une ligne de journal. */
function setCrew(state: GameState, idx: number, crew: Crewmate[], msg: string): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === idx ? { ...p, crewmates: crew } : p)),
    log: [...state.log, `${state.players[idx].villainName} : ${msg}.`],
  }
}

/** Journalise un effet Coéquipier sans changement d'état (cas « rien à faire »). */
function logCrew(state: GameState, idx: number, msg: string): GameState {
  return { ...state, log: [...state.log, `${state.players[idx].villainName} : ${msg}.`] }
}

/** Nombre de Héros présents dans le royaume d'un joueur donné. */
export function countHeroesInRealm(state: GameState, actorIndex?: number): number {
  const idx = actorIndex ?? state.activePlayer
  return Object.values(state.players[idx].board).reduce(
    (n, cards) => n + cards.filter((c) => c.type === 'hero').length,
    0,
  )
}

/** Pénalité passive sur les gains de pouvoir dans le royaume (Robin → −1). */
function realmPowerPenalty(state: GameState, idx: number): number {
  return hasHeroInRealm(state, idx, 'robin-des-bois') ? 1 : 0
}

/**
 * Déclenche les effets « à l'arrivée d'un Héros » sur un lieu d'un joueur :
 * pour chaque Mandat d'Arrêt présent au lieu, +2 JT au propriétaire (C.1).
 * Appelé après chaque pose de Héros (Fatalité, Belle Marianne, Emprisonnement…).
 * Défausse aussi les Malédictions à déclencheur 'hero-played-here'.
 */
export function triggerHeroArrival(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
): GameState {
  const owner = state.players[playerIndex]
  let next = state
  const mandates = (owner.board[locationId] ?? []).filter((c) => c.cardId === 'mandat-arret')
  if (mandates.length > 0) {
    // Robin des Bois : « chaque carte rapporte 1 Pouvoir de moins » → −1 PAR Mandat
    // (chaque Mandat est une carte), plancher 0 par carte.
    const penalty = realmPowerPenalty(state, playerIndex)
    const gain = mandates.length * Math.max(0, 2 - penalty)
    if (gain > 0) {
      next = updatePlayer(next, playerIndex, (p) => ({ ...p, power: p.power + gain }))
      next = {
        ...next,
        log: [
          ...next.log,
          `${owner.villainName} : Mandat d'Arrêt déclenché (×${mandates.length}) → +${gain} JT${penalty ? ' (Robin des Bois : −1/carte)' : ''}.`,
        ],
      }
    }
    // Robin des Bois : animation « −N 🪙 » du pouvoir chipé (−1 par Mandat).
    next = pushRobinSteal(next, playerIndex, mandates.length * penalty)
  }
  return processCurseDiscards(next, playerIndex, locationId, 'hero-played-here')
}

/** Défausse automatiquement les cartes de `playerIndex` au lieu `locationId`
 *  dont `discardWhen` correspond au `trigger` donné (Malédictions Maléfique). */
export function processCurseDiscards(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
  trigger: CurseDiscardTrigger['type'],
): GameState {
  const cell = state.players[playerIndex].board[locationId] ?? []
  const toDiscard = cell.filter((c) => c.discardWhen?.type === trigger)
  if (toDiscard.length === 0) return state
  const ids = new Set(toDiscard.map((c) => c.instanceId))
  let next = updatePlayer(state, playerIndex, (p) => ({
    ...p,
    board: { ...p.board, [locationId]: (p.board[locationId] ?? []).filter((c) => !ids.has(c.instanceId)) },
    discard: [...p.discard, ...toDiscard],
  }))
  next = {
    ...next,
    log: [
      ...next.log,
      ...toDiscard.map((c) => `**${c.name}** se défausse (déclencheur : ${trigger}).`),
    ],
  }
  // Showcase de la Malédiction retirée — toujours montré. Le déclencheur
  // 'hero-played-here' est DÉJÀ couvert par le diff de la pose de Héros
  // (placeFateHeroWithEffects) → on ne le repousse pas ici (sinon doublon).
  if (trigger !== 'hero-played-here') {
    next = pushDiscardShowcase(
      next,
      toDiscard.map((c) => c.cardId),
      toDiscard.length > 1
        ? `${toDiscard.length} Malédictions se défaussent`
        : `${toDiscard[0].name} se défausse`,
      playerIndex,
      'red',
      'bottom',
    )
  }
  return next
}

/** Met à jour une CardInstance posée dans le royaume d'un joueur. */
function patchCard(
  state: GameState,
  playerIndex: number,
  instanceId: string,
  patch: (c: CardInstance) => CardInstance,
): GameState {
  return updatePlayer(state, playerIndex, (p) => ({
    ...p,
    board: Object.fromEntries(
      Object.entries(p.board).map(([locId, cards]) => [
        locId,
        cards.map((c) => (c.instanceId === instanceId ? patch(c) : c)),
      ]),
    ),
  }))
}

/**
 * Cœur du Vanquish (Éliminer un Héros). Utilisé par l'action VANQUISH (alliés
 * défaussés) ET par la carte Intimidation (alliés gardés en jeu). Aucune
 * vérification d'action ; c'est l'appelant qui s'en charge.
 */
export function performVanquish(
  state: GameState,
  heroInstanceId: string,
  allyInstanceIds: string[],
  keepAllies: boolean,
): GameState {
  // Un Héros de force EFFECTIVE 0 (réduit par Forme de grenouille, Sommeil sans
  // Rêves…) peut être éliminé SANS Allié (la somme des forces alliées, 0, suffit).
  // On ne refuse donc l'absence d'Allié qu'après avoir mesuré la force du Héros.
  const me = activePlayer(state)
  const heroLoc = locationOfCard(me, heroInstanceId)
  if (!heroLoc) {
    throw new Error(`Héros « ${heroInstanceId} » introuvable dans votre royaume.`)
  }
  const heroCard = (me.board[heroLoc] ?? []).find((c) => c.instanceId === heroInstanceId)!
  if (heroCard.type !== 'hero') {
    throw new Error(`${heroCard.name} n'est pas un Héros.`)
  }
  const heroLocName = findLocation(me, heroLoc)?.name ?? heroLoc
  const hasDeguisement = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'deguisement' && c.attachedTo === heroCard.instanceId,
  )
  if (hasDeguisement) {
    throw new Error(`${heroCard.name} est invulnérable (Déguisement). Défaussez-le d'abord (2 JT).`)
  }
  const adjacents = new Set(adjacentLocationIds(state, heroLoc))
  const allies: CardInstance[] = []
  for (const allyId of allyInstanceIds) {
    const allyLoc = locationOfCard(me, allyId)
    if (!allyLoc) throw new Error(`Allié « ${allyId} » introuvable.`)
    const a = (me.board[allyLoc] ?? []).find((c) => c.instanceId === allyId)!
    if (a.type !== 'ally') throw new Error(`${a.name} n'est pas un Allié.`)
    if (a.isWicket) throw new Error(`${a.name} est un arceau : inutilisable pour éliminer un Héros.`)
    if (a.trapped) throw new Error(`${a.name} est entravé : il ne peut pas participer à un Vanquish.`)
    // Archers Loups (Prince Jean), Flibustiers (Crochet) et Cerbère (Hadès)
    // éliminent aussi un Héros sur un lieu VOISIN non bloqué (donnée
    // `reachesAdjacentVanquish` ; cardId conservés pour compat héritée).
    const reachesAdjacent = a.reachesAdjacentVanquish || a.cardId === 'archers-loups' || a.cardId === 'flibustiers'
    if (allyLoc !== heroLoc && !(reachesAdjacent && adjacents.has(allyLoc))) {
      throw new Error(`${a.name} doit être sur ${heroLocName}${reachesAdjacent ? ' ou un lieu voisin' : ''}.`)
    }
    allies.push(a)
  }
  if (heroCard.cardId === 'bobby' && allies.some((a) => a.cardId === 'archers-loups')) {
    throw new Error("Bobby ne peut pas être éliminé par des Archers Loups.")
  }
  // Gardes du Château : minimum 2 Alliés requis pour les éliminer.
  if (heroCard.cardId === 'gardes-chateau' && allies.length < 2) {
    throw new Error("Pour éliminer les Gardes du Château, il faut au moins 2 Alliés.")
  }
  // Enfants Perdus (Crochet) : minimum 2 Alliés requis pour les éliminer.
  if (heroCard.cardId === 'enfants-perdus' && allies.length < 2) {
    throw new Error("Pour éliminer les Enfants Perdus, il faut au moins 2 Alliés.")
  }
  // Provocation (Crochet) : s'il existe un Héros « provocateur » (portant une
  // Provocation) dans le royaume, il faut l'éliminer avant les autres Héros.
  const targetHasTaunt = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'provocation' && c.attachedTo === heroCard.instanceId,
  )
  const aTaunterExists = Object.values(me.board)
    .flat()
    .some((c) => c.cardId === 'provocation' && c.attachedTo)
  if (aTaunterExists && !targetHasTaunt) {
    throw new Error('Vous devez d’abord éliminer un Héros provocateur (Provocation).')
  }
  // Prof (La Méchante Reine) : doit être éliminé AVANT les autres Héros.
  const aPriorityHeroExists = Object.values(me.board).flat().some((c) => c.type === 'hero' && c.mustDefeatFirst)
  if (aPriorityHeroExists && !heroCard.mustDefeatFirst) {
    throw new Error('Vous devez d’abord éliminer Prof (priorité).')
  }
  const heroForce = effectiveStrength(state, state.activePlayer, heroCard.instanceId) ?? 0
  // Au moins un Allié reste requis tant que le Héros a une force > 0.
  if (allies.length === 0 && heroForce > 0) {
    throw new Error('Sélectionnez au moins un Allié pour éliminer ce Héros.')
  }
  const allyForce = allies.reduce(
    (sum, a) => sum + (effectiveStrength(state, state.activePlayer, a.instanceId) ?? 0),
    0,
  )
  if (allyForce < heroForce) {
    throw new Error(`Force insuffisante (${allyForce} < ${heroForce}).`)
  }
  const usedAllyIds = new Set(allies.map((a) => a.instanceId))
  const attachedToAllies = Object.values(me.board)
    .flat()
    .filter((c) => c.attachedTo && usedAllyIds.has(c.attachedTo))
  const flechesCount = attachedToAllies.filter((c) => c.cardId === 'fleche-or').length
  // Bonus Rouet (Maléfique) : +hero.strength − 1 JT par Rouet sur le lieu du héros.
  const rouetCount = (me.board[heroLoc] ?? []).filter((c) => c.cardId === 'rouet').length
  const rouetBonus = rouetCount * Math.max(0, (heroCard.strength ?? 0) - 1)
  const locked = heroCard.lockedPower ?? 0
  // Cartes côté Vilain effectivement défaussées (Alliés + Objets). Règle Arc et
  // Flèches : si un Allié utilisé porte ≥1 Arc et Flèches, on défausse TOUS les
  // Arcs À LA PLACE de l'Allié — l'Allié (et ses autres Objets, ex. Flèche d'Or)
  // RESTE en jeu. Sinon l'Allié et tous ses Objets associés sont défaussés.
  const removedIds = new Set<string>([heroCard.instanceId])
  const discardedAllyCards: CardInstance[] = []
  // Hadès — Hydre : utilisée pour un Vanquish, elle retourne en MAIN au lieu d'être
  // défaussée (ses Objets associés partent quand même en défausse). On la retire du
  // plateau mais on la garde de côté pour la remettre en main.
  const returnedToHand: CardInstance[] = []
  // Hadès — Potion de mortalité : si le Héros vaincu porte une Potion associée, les
  // Titans utilisés pour l'éliminer NE sont PAS défaussés (ils restent en jeu).
  const heroHasPotion = (me.board[heroLoc] ?? []).some(
    (c) => c.cardId === 'potion-mortalite' && c.attachedTo === heroCard.instanceId,
  )
  if (!keepAllies) {
    for (const a of allies) {
      if (a.isTitan && heroHasPotion) continue // Titan préservé par la Potion
      const attached = attachedToAllies.filter((o) => o.attachedTo === a.instanceId)
      const arcs = attached.filter((o) => o.cardId === 'arc-fleches')
      if (arcs.length > 0) {
        for (const arc of arcs) {
          removedIds.add(arc.instanceId)
          discardedAllyCards.push(arc)
        }
      } else {
        removedIds.add(a.instanceId)
        // Bowser : une Étoile portée par l'Allié est perdue quand il quitte le jeu
        // (défaussé OU repris en main) — on réinitialise toujours son compteur.
        if (a.returnToHandOnVanquish) {
          returnedToHand.push({ ...a, attachedTo: undefined, stars: undefined })
        } else {
          discardedAllyCards.push({ ...a, stars: undefined })
        }
        for (const o of attached) {
          removedIds.add(o.instanceId)
          discardedAllyCards.push(o)
        }
      }
    }
  }
  // Hadès — Nessus : +2 JT si le Héros vaincu a une force ≤ 3 et que Nessus
  // participe au Vanquish.
  const nessusBonus = allies.some((a) => a.cardId === 'nessus') && (heroCard.strength ?? 0) <= 3 ? 2 : 0
  const heroDiscarded: CardInstance = { ...heroCard, lockedPower: undefined }
  let next = updateActivePlayer(state, (p) => ({
    ...p,
    board: Object.fromEntries(
      Object.entries(p.board).map(([locId, cards]) => [
        locId,
        cards.filter((c) => !removedIds.has(c.instanceId)),
      ]),
    ),
    fateDiscard: [...p.fateDiscard, heroDiscarded],
    discard: keepAllies ? p.discard : [...p.discard, ...discardedAllyCards],
    hand: [...p.hand, ...returnedToHand],
    power: p.power + locked + flechesCount * 2 + rouetBonus + nessusBonus,
  }))
  // Dr Facilier — Objets associés au Héros vaincu : le Talisman est RÉCUPÉRÉ
  // (libéré sur le lieu du Héros, donc « détenu » à nouveau) ; la Forme de
  // grenouille est défaussée. (Les Objets associés au Héros ne sont pas dans
  // removedIds : ils restent sur le lieu après le départ du Héros.)
  const heroAttached = (me.board[heroLoc] ?? []).filter((c) => c.attachedTo === heroCard.instanceId)
  const formes = heroAttached.filter((c) => c.cardId === 'forme-grenouille')
  const hasTalisman = heroAttached.some((c) => c.cardId === 'talisman')
  if (hasTalisman || formes.length > 0) {
    const formeIds = new Set(formes.map((c) => c.instanceId))
    next = updateActivePlayer(next, (p) => ({
      ...p,
      board: {
        ...p.board,
        [heroLoc]: (p.board[heroLoc] ?? [])
          .filter((c) => !formeIds.has(c.instanceId))
          .map((c) =>
            c.cardId === 'talisman' && c.attachedTo === heroCard.instanceId ? { ...c, attachedTo: undefined } : c,
          ),
      },
      discard: [...p.discard, ...formes.map((c) => ({ ...c, attachedTo: undefined }))],
    }))
    if (hasTalisman) {
      next = { ...next, log: [...next.log, `Le **Talisman** est récupéré sur ${heroLocName}.`] }
    }
  }
  // Mémorise la force du héros pour le trigger Méchanceté (réinitialisé à chaque tour).
  next = { ...next, lastVanquishedHeroStrength: heroCard.strength ?? 0 }
  next = {
    ...next,
    log: [
      ...next.log,
      `${me.villainName} élimine **${heroCard.name}** (alliés : ${allies.map((a) => a.name).join(', ')})${keepAllies ? ' — Intimidation, alliés gardés.' : '.'}`,
      ...(locked > 0
        ? [`${locked} JT verrouillé${locked > 1 ? 's' : ''} restitué${locked > 1 ? 's' : ''} à ${me.villainName}.`]
        : []),
      ...(flechesCount > 0
        ? [`Flèche d'Or : +${flechesCount * 2} JT à ${me.villainName}.`]
        : []),
      ...(rouetBonus > 0
        ? [`Rouet : +${rouetBonus} JT à ${me.villainName}.`]
        : []),
      ...(nessusBonus > 0
        ? [`Nessus : +${nessusBonus} JT à ${me.villainName}.`]
        : []),
      ...(returnedToHand.length > 0
        ? [`**${returnedToHand.map((c) => c.name).join(', ')}** retourne${returnedToHand.length > 1 ? 'nt' : ''} en main (Hydre).`]
        : []),
    ],
  }
  // Showcase « Vanquish » : Héros vaincu + Alliés utilisés + leurs Objets associés
  // (Arc et Flèches, Flèche d'Or) — défaussés, sauf Intimidation qui garde les
  // Alliés. Affiche aussi le gain de combat (« +N 🪙 » : Flèche d'Or +2, Rouet,
  // JT verrouillés rendus).
  const vanquishGain = locked + flechesCount * 2 + rouetBonus + nessusBonus
  // Cartes montrées = Héros vaincu + ce qui part réellement en défausse côté Vilain
  // (Arc et Flèches à la place de l'Allié, ou Allié + Objets).
  const showcaseCardIds = [heroCard.cardId, ...discardedAllyCards.map((c) => c.cardId)]
  next = pushDiscardShowcase(
    next,
    showcaseCardIds,
    `${me.villainName} élimine ${heroCard.name}`,
    state.activePlayer,
    'red',
    'bottom',
    vanquishGain > 0 ? { gainedPower: vanquishGain } : undefined,
  )
  // Capitaine Crochet : victoire ÉVÉNEMENTIELLE — éliminer Peter Pan sur le
  // Jolly Roger (et nulle part ailleurs).
  const obj = me.objective
  if (
    obj.type === 'DEFEAT_HERO_AT_LOCATION' &&
    heroCard.cardId === obj.heroCardId &&
    heroLoc === obj.locationId
  ) {
    return {
      ...next,
      status: 'WON',
      winner: state.activePlayer,
      log: [...next.log, `🏆 ${me.villainName} élimine ${heroCard.name} sur le Jolly Roger et l'emporte !`],
    }
  }
  // Dr Facilier — Poudre d'illusion : à chaque Héros éliminé sur ce lieu, défausse
  // jusqu'à 2 cartes de la Pile de l'Au-delà (auto : les moins utiles, jamais Régner).
  if ((next.players[state.activePlayer].board[heroLoc] ?? []).some((c) => c.cardId === 'poudre-illusion')) {
    const pile = next.players[state.activePlayer].auDela
    const droppable = [...pile]
      .filter((c) => c.cardId !== 'regner-nouvelle-orleans')
      .sort((a, b) => auDelaKeyPriority(a) - auDelaKeyPriority(b))
      .slice(0, 2)
    if (droppable.length > 0) {
      const dropIds = new Set(droppable.map((c) => c.instanceId))
      next = updateActivePlayer(next, (p) => ({
        ...p,
        auDela: p.auDela.filter((c) => !dropIds.has(c.instanceId)),
        discard: [...p.discard, ...droppable],
      }))
      next = {
        ...next,
        log: [...next.log, `Poudre d'illusion : ${droppable.length} carte${droppable.length > 1 ? 's' : ''} défaussée${droppable.length > 1 ? 's' : ''} de la Pile de l'Au-delà.`],
      }
    }
  }
  // Effets « à la mort » du Héros (Toby, Belle Marianne — B.3).
  return resolveEffects(next, heroCard.onVanquish ?? [], {
    actorIndex: state.activePlayer,
    hostInstanceId: heroCard.instanceId,
    hostLocationId: heroLoc,
  })
}

/**
 * Ursula — Pacte : si le Héros `heroId` (lieu `loc`) porte un Pacte dont le lieu
 * lié est `loc`, il est éliminé. Les Pactes vont en défausse Vilain, le Trident
 * éventuellement associé est LIBÉRÉ (Objet libre au même lieu), les autres Objets
 * associés et le Héros vont en défausse Fatalité. Renvoie `state` inchangé (même
 * référence) si aucun Pacte ne se déclenche. */
function checkPacteDefeat(state: GameState, idx: number, heroId: string, loc: LocationId): GameState {
  const p = state.players[idx]
  const cell = p.board[loc] ?? []
  const hero = cell.find((c) => c.instanceId === heroId)
  if (!hero || hero.type !== 'hero') return state
  const attached = cell.filter((c) => c.attachedTo === heroId)
  const pacte = attached.find((c) => c.contractLocationId === loc)
  if (!pacte) return state
  const trident = attached.find((c) => c.cardId === 'trident')
  const released = trident ? [{ ...trident, attachedTo: undefined }] : []
  const removedIds = new Set([heroId, ...attached.map((c) => c.instanceId)])
  const toVillain = attached.filter((c) => c.contractLocationId) // les Pactes
  const toFate = attached.filter((c) => c.cardId !== 'trident' && !c.contractLocationId) // Objets Fatalité associés
  let next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    board: {
      ...pp.board,
      [loc]: [...(pp.board[loc] ?? []).filter((c) => !removedIds.has(c.instanceId)), ...released],
    },
    fateDiscard: [...pp.fateDiscard, { ...hero, lockedPower: undefined }, ...toFate],
    discard: [...pp.discard, ...toVillain],
  }))
  next = {
    ...next,
    lastVanquishedHeroStrength: Math.max(next.lastVanquishedHeroStrength ?? 0, hero.strength ?? 0),
    log: [
      ...next.log,
      `Pacte : **${hero.name}** est éliminé en arrivant sur **${loc}**${trident ? ' — le Trident est libéré !' : ''}.`,
    ],
  }
  // Effets « à la mort » du Héros (cohérence avec performVanquish).
  return resolveEffects(next, hero.onVanquish ?? [], {
    actorIndex: idx,
    hostInstanceId: hero.instanceId,
    hostLocationId: loc,
  })
}

/** Résout un effet unique pour un joueur ACTEUR (par défaut : joueur actif). */
// ============================ Hadès — Titans ================================

/** Lieux où le Titan `titanId` (du joueur `idx`) peut être déplacé : ≤ `maxSteps`
 *  lieux le long de la ligne du royaume (Les Enfers → Mont Olympe). Vide si le
 *  Titan est entravé ou si Hercule est sur son lieu (il verrouille les Titans). */
export function titanReachableDests(
  state: GameState,
  idx: number,
  titanId: string,
  maxSteps: number,
): LocationId[] {
  const p = state.players[idx]
  const order = p.locations.map((l) => l.id)
  const from = locationOfCard(p, titanId)
  if (!from) return []
  const titan = (p.board[from] ?? []).find((c) => c.instanceId === titanId)
  if (!titan?.isTitan || titan.trapped) return []
  if ((p.board[from] ?? []).some((c) => c.type === 'hero' && c.cardId === 'hercule')) return []
  const fi = order.indexOf(from)
  return order.filter((id, i) => id !== from && Math.abs(i - fi) <= maxSteps)
}

/** Déplace un Titan (et ses Objets associés) vers `toLoc` dans le royaume de `idx`.
 *  Gère l'entrave par Zeus à l'arrivée et, si `fireTriggers`, les déclencheurs
 *  « à chaque déplacement » du Titan (Argès, Pyros, Stratos, Lythos — résolus
 *  automatiquement). Ne vérifie NI la portée NI le paiement (à la charge de
 *  l'appelant). */
export function moveTitanTo(
  state: GameState,
  idx: number,
  titanId: string,
  toLoc: LocationId,
  opts: { fireTriggers: boolean },
): GameState {
  const p = state.players[idx]
  const from = locationOfCard(p, titanId)
  if (!from) return state
  const titan = (p.board[from] ?? []).find((c) => c.instanceId === titanId)!
  const movingIds = new Set<string>([
    titanId,
    ...(p.board[from] ?? []).filter((c) => c.attachedTo === titanId).map((c) => c.instanceId),
  ])
  const moving = (p.board[from] ?? []).filter((c) => movingIds.has(c.instanceId))
  let next = updatePlayer(state, idx, (pp) => ({
    ...pp,
    board: {
      ...pp.board,
      [from]: (pp.board[from] ?? []).filter((c) => !movingIds.has(c.instanceId)),
      [toLoc]: [...(pp.board[toLoc] ?? []), ...moving],
    },
  }))
  const destName = findLocation(next.players[idx], toLoc)?.name ?? toLoc
  next = { ...next, log: [...next.log, `${next.players[idx].villainName} déplace le Titan **${titan.name}** vers **${destName}**.`] }

  // Zeus entrave les Titans qui arrivent sur son lieu (et leur capacité est ignorée).
  if ((next.players[idx].board[toLoc] ?? []).some((c) => c.type === 'hero' && c.cardId === 'zeus')) {
    next = patchCard(next, idx, titanId, (c) => ({ ...c, trapped: true }))
    return { ...next, log: [...next.log, `**${titan.name}** arrive sur le lieu de Zeus : il est entravé (capacité ignorée).`] }
  }
  if (!opts.fireTriggers) return next

  // Déclencheurs « à chaque déplacement » (résolution automatique).
  if (titan.cardId === 'arges') {
    next = resolveEffect(next, { type: 'GAIN_POWER', amount: 1 }, { actorIndex: idx })
  } else if (titan.cardId === 'pyros') {
    const trappedHere = (next.players[idx].board[toLoc] ?? []).find((c) => c.isTitan && c.trapped)
    if (trappedHere) {
      next = patchCard(next, idx, trappedHere.instanceId, (c) => ({ ...c, trapped: false }))
      next = { ...next, log: [...next.log, `Pyros désentrave **${trappedHere.name}**.`] }
    }
  } else if (titan.cardId === 'stratos') {
    // Stratos : choisir un Héros de son lieu de DÉPART ou d'ARRIVÉE et le déplacer
    // vers un lieu voisin (pendingHeroRelocate, choisi par le joueur actif = Hadès).
    const heroes = [
      ...(next.players[idx].board[from] ?? []),
      ...(next.players[idx].board[toLoc] ?? []),
    ].filter((c) => c.type === 'hero')
    if (heroes.length > 0) {
      next = {
        ...next,
        pendingHeroRelocate: {
          chooserIndex: next.activePlayer,
          targetIndex: idx,
          anyLocation: false,
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...next.log, `Stratos : déplacez un Héros de son lieu de départ ou d'arrivée.`],
      }
    }
  } else if (titan.cardId === 'lythos') {
    // Lythos : Vanquish optionnel immédiat sur son lieu d'arrivée (s'il y a un
    // Héros), Lythos pouvant y participer (pendingTrapVanquish réutilisé).
    if ((next.players[idx].board[toLoc] ?? []).some((c) => c.type === 'hero')) {
      next = { ...next, pendingTrapVanquish: true, log: [...next.log, `Lythos peut Éliminer un Héros sur ${destName} (facultatif).`] }
    }
  }
  return next
}

/** Le Titan non entravé le plus AVANCÉ (proche du Mont Olympe) du joueur `idx`,
 *  avec son lieu, ou undefined. Sert aux effets Fatalité qui « repoussent » un
 *  Titan (Pégase, De zéro en héros). */
function mostAdvancedTitan(
  state: GameState,
  idx: number,
): { id: string; locIndex: number } | undefined {
  const p = state.players[idx]
  const order = p.locations.map((l) => l.id)
  let best: { id: string; locIndex: number } | undefined
  order.forEach((locId, i) => {
    for (const c of p.board[locId] ?? []) {
      if (c.isTitan && !c.trapped && (!best || i > best.locIndex)) best = { id: c.instanceId, locIndex: i }
    }
  })
  return best
}

export function resolveEffect(
  state: GameState,
  effect: Effect,
  ctx?: EffectContext,
): GameState {
  const idx = ctx?.actorIndex ?? state.activePlayer
  switch (effect.type) {
    case 'GAIN_POWER': {
      const gained = Math.max(0, effect.amount - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      const actor = next.players[idx]
      const note = gained < effect.amount ? ' (Robin des Bois : −1)' : ''
      next = {
        ...next,
        // Suivi du Pouvoir gagné par le joueur actif ce tour-ci (déclencheur Terreur).
        activeGainedPower: idx === next.activePlayer ? (next.activeGainedPower ?? 0) + gained : next.activeGainedPower,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT${note} (total : ${actor.power}).`,
        ],
      }
      return pushRobinSteal(next, idx, effect.amount - gained)
    }
    case 'GAIN_POWER_PER_HERO_IN_REALM': {
      const heroes = countHeroesInRealm(state, idx)
      const gross = heroes * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      const actor = next.players[idx]
      const note = gained < gross ? ' (Robin des Bois : −1)' : ''
      next = {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT (${heroes} héros × ${effect.amount})${note} (total : ${actor.power}).`,
        ],
      }
      // Animation « +amount 🪙 » sur CHAQUE Héros du royaume (source du gain).
      for (const cards of Object.values(next.players[idx].board)) {
        for (const c of cards) {
          if (c.type === 'hero') {
            next = pushFloatingFx(next, { kind: 'taxes-gain', amount: effect.amount, playerIndex: idx, instanceId: c.instanceId })
          }
        }
      }
      return pushRobinSteal(next, idx, gross - gained)
    }
    case 'GAIN_POWER_PER_ALLY_IN_REALM': {
      const allies = Object.values(state.players[idx].board)
        .flat()
        .filter((c) => c.type === 'ally').length
      const gross = allies * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      const actor = next.players[idx]
      return {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} gagne ${gained} JT (${allies} allié${allies > 1 ? 's' : ''} × ${effect.amount}) (total : ${actor.power}).`,
        ],
      }
    }
    case 'GAIN_POWER_PER_CARD_AT_PAWN': {
      const actor = state.players[idx]
      const loc = actor.pawnLocation
      const count = loc
        ? (actor.board[loc] ?? []).filter((c) => c.cardId === effect.cardId && !c.attachedTo).length
        : 0
      const gross = count * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      if (gained === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucune carte ici → 0 JT.`] }
      }
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      return {
        ...next,
        log: [
          ...next.log,
          `${next.players[idx].villainName} gagne ${gained} JT (${count} × ${effect.amount}) sur son lieu.`,
        ],
      }
    }
    case 'GRANT_USE_COVERED_ACTION': {
      return {
        ...state,
        persifleurAvailable: true,
        log: [
          ...state.log,
          `${state.players[idx].villainName} : une action recouverte est jouable ce tour-ci (Brouillage).`,
        ],
      }
    }
    case 'USE_COVERED_ACTIONS_THIS_TURN': {
      return {
        ...state,
        uncoverCoveredActions: true,
        log: [
          ...state.log,
          `${state.players[idx].villainName} : les actions recouvertes par un Héros sont jouables ce tour-ci (Je vais vous broyer les os !).`,
        ],
      }
    }
    case 'LOSE_POWER_TO_HOST': {
      // L'acteur perd jusqu'à `amount` JT, transférés en lockedPower sur la carte
      // hôte. Si l'acteur n'a pas assez de pouvoir, on prend ce qu'il reste.
      if (!ctx?.hostInstanceId) {
        throw new Error('LOSE_POWER_TO_HOST nécessite un hostInstanceId dans le contexte.')
      }
      const actor = state.players[idx]
      const taken = Math.min(effect.amount, actor.power)
      if (taken === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} n'a aucun JT à donner.`] }
      }
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power - taken }))
      next = patchCard(next, idx, ctx.hostInstanceId, (c) => ({
        ...c,
        lockedPower: (c.lockedPower ?? 0) + taken,
      }))
      const after = next.players[idx]
      return {
        ...next,
        log: [
          ...next.log,
          `${after.villainName} perd ${taken} JT, transférés sur une carte (total : ${after.power}).`,
        ],
      }
    }
    case 'RESHUFFLE_HOST_INTO_FATE_DECK': {
      // La carte hôte vient d'arriver en fateDiscard (Toby vaincu) : on l'en
      // retire, on la met dans fateDeck, on remélange.
      if (!ctx?.hostInstanceId) {
        throw new Error('RESHUFFLE_HOST_INTO_FATE_DECK nécessite un hostInstanceId.')
      }
      const actor = state.players[idx]
      const card = actor.fateDiscard.find((c) => c.instanceId === ctx.hostInstanceId)
      if (!card) return state // déjà déplacée ou absente
      const r = shuffle([...actor.fateDeck, card], state.rngState)
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== ctx.hostInstanceId),
        fateDeck: r.result,
      }))
      return {
        ...next,
        rngState: r.state,
        log: [...next.log, `**${card.name}** retourne dans la pioche Fatalité (remélangée).`],
      }
    }
    case 'SEARCH_AND_PLACE_HERO': {
      // Cherche un héros de cardId dans fateDeck + fateDiscard de l'acteur, le
      // retire et le pose au lieu hôte. Belle Marianne fait apparaître Robin.
      if (!ctx?.hostLocationId) {
        throw new Error('SEARCH_AND_PLACE_HERO nécessite un hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      const inDeck = actor.fateDeck.find((c) => c.cardId === effect.cardId)
      const inDiscard = inDeck ? undefined : actor.fateDiscard.find((c) => c.cardId === effect.cardId)
      const found = inDeck ?? inDiscard
      if (!found) return state // déjà en jeu / introuvable
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: inDeck ? p.fateDeck.filter((c) => c.instanceId !== found.instanceId) : p.fateDeck,
        fateDiscard: inDiscard ? p.fateDiscard.filter((c) => c.instanceId !== found.instanceId) : p.fateDiscard,
        board: { ...p.board, [loc]: [...(p.board[loc] ?? []), found] },
      }))
      const placeName = findLocation(actor, loc)?.name ?? loc
      next = {
        ...next,
        log: [...next.log, `**${found.name}** apparaît immédiatement sur **${placeName}** !`],
      }
      // Showcase : le Héros invoqué (Robin via Belle Marianne) « vole » vers son
      // lieu, comme un Héros Fatalité. L'UI masque l'exemplaire posé jusqu'à l'arrivée.
      next = pushShowcase(
        next,
        found.cardId,
        `${found.name} apparaît sur ${placeName} !`,
        idx,
        { playerIndex: idx, locationId: loc },
        found.instanceId,
      )
      const scIdx = next.showcaseEvents.length - 1
      // Le héros « apparu » déclenche aussi les Mandats d'Arrêt du lieu (C.1) ; on
      // anime le gain éventuel (« +N 🪙 ») à l'atterrissage du showcase.
      const powerBefore = next.players[idx].power
      next = triggerHeroArrival(next, idx, loc)
      const gain = next.players[idx].power - powerBefore
      if (gain > 0) {
        next = {
          ...next,
          showcaseEvents: next.showcaseEvents.map((e, i) =>
            i === scIdx ? { ...e, landingPowerGain: gain } : e,
          ),
        }
      }
      return next
    }
    case 'MOVE_HERO_TO_LOCATION': {
      if (!ctx?.targetHeroId) {
        throw new Error('MOVE_HERO_TO_LOCATION nécessite un targetHeroId dans le contexte.')
      }
      const target = ctx.targetHeroId
      const dest = effect.locationId
      const actor = state.players[idx]
      // Trouve la carte sur le board de l'acteur.
      let from: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === target)
        if (found) {
          from = loc.id
          hero = found
          break
        }
      }
      if (!hero || !from) throw new Error(`Héros « ${target} » introuvable.`)
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      const forbidden = new Set(hero.forbiddenLocations ?? [])
      if (forbidden.has(dest)) {
        throw new Error(`${hero.name} ne peut pas être déplacé(e) sur ${dest}.`)
      }
      // Le lieu de destination peut aussi refuser le Héros (Feu Infernal, Forêt
      // de Ronces). Note : cette vérification ignore la carte déjà présente
      // car le hero est déjà sur le board (mais à un autre lieu).
      const destCell = (actor.board[dest] ?? []).filter((c) => c.instanceId !== hero!.instanceId)
      for (const c of destCell) {
        const r = c.placementRestriction
        if (!r) continue
        if (r.type === 'no-heroes') {
          throw new Error(`${hero.name} ne peut pas être déplacé(e) sur ${dest} (Malédiction).`)
        }
        if (r.type === 'min-hero-strength' && (hero.strength ?? 0) < r.value) {
          throw new Error(`${hero.name} (force ${hero.strength ?? 0}) trop faible pour ${dest} (≥${r.value}).`)
        }
      }
      if (from === dest) {
        return { ...state, log: [...state.log, `**${hero.name}** est déjà à ${dest}.`] }
      }
      // Le Héros se déplace AVEC ses Objets associés (Pacte, Trident, Objets Fatalité).
      const carried = (actor.board[from] ?? []).filter((c) => c.attachedTo === target)
      const movingIds = new Set([target, ...carried.map((c) => c.instanceId)])
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [from!]: (p.board[from!] ?? []).filter((c) => !movingIds.has(c.instanceId)),
          [dest]: [...(p.board[dest] ?? []), hero!, ...carried],
        },
      }))
      next = {
        ...next,
        log: [...next.log, `**${hero.name}** est déplacé(e) sur **${dest}**.`],
      }
      // Ursula — Pacte : le Héros est éliminé s'il arrive sur le lieu de son Pacte.
      const afterPacte = checkPacteDefeat(next, idx, target, dest)
      if (afterPacte !== next) return afterPacte
      // L'arrivée déclenche les Mandats d'Arrêt du lieu (C.1).
      return triggerHeroArrival(next, idx, dest)
    }
    case 'MOVE_ALLY_FREELY': {
      if (!ctx?.allyMove) {
        throw new Error('MOVE_ALLY_FREELY nécessite ctx.allyMove.')
      }
      const { instanceId: aId, to } = ctx.allyMove
      const me = activePlayer(state)
      const from = locationOfCard(me, aId)
      if (!from) throw new Error(`Allié « ${aId} » introuvable.`)
      const card = (me.board[from] ?? []).find((c) => c.instanceId === aId)!
      if (card.type !== 'ally') throw new Error(`${card.name} n'est pas un Allié.`)
      if (from === to) return state
      // Inclut les objets associés (cohérence avec MOVE_CARD).
      const moving = (me.board[from] ?? []).filter(
        (c) => c.instanceId === aId || c.attachedTo === aId,
      )
      const movingIds = new Set(moving.map((c) => c.instanceId))
      const destName = findLocation(me, to)?.name ?? to
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
        log: [
          ...next.log,
          `${me.villainName} déplace **${card.name}** vers **${destName}** (Tendre un Piège).`,
        ],
      }
    }
    case 'RELOCATE_HERO_ADJACENT': {
      // Apparition : l'acteur déplacera un de ses Héros vers un lieu voisin.
      const actor = state.players[idx]
      const hasHero = Object.values(actor.board).some((cards) => cards.some((c) => c.type === 'hero'))
      if (!hasHero) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros à déplacer (Apparition).`] }
      }
      return {
        ...state,
        pendingHeroRelocate: { chooserIndex: idx, targetIndex: idx },
        log: [...state.log, `${actor.villainName} : déplacez un Héros vers un lieu voisin (Apparition).`],
      }
    }
    case 'TELEPORT_TO_HERO': {
      // Téléportation : le pion ira sur un lieu portant un Héros (sans Lampe de
      // poche). Le choix du lieu est interactif (RESOLVE_TELEPORT).
      const actor = state.players[idx]
      const dests = teleportTargets(actor)
      if (dests.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros accessible (Téléportation).`] }
      }
      return {
        ...state,
        pendingTeleport: { playerIndex: idx },
        log: [...state.log, `${actor.villainName} : choisissez le lieu où vous téléporter (Téléportation).`],
      }
    }
    case 'GRANT_SKIP_NEXT_MOVE': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, skipNextMove: true }))
      return {
        ...next,
        log: [...next.log, `${next.players[idx].villainName} : prochain déplacement non obligatoire.`],
      }
    }
    case 'PEEK_BOTTOM_THEN_CHOOSE': {
      // Retourne-toi : révèle la dernière carte de la pioche de l'acteur et met
      // l'état en attente d'un choix (RESOLVE_DECK_PEEK). Si la pioche est vide,
      // rien à révéler → no-op.
      const actor = state.players[idx]
      if (actor.deck.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche vide, rien à révéler (Retourne-toi).`] }
      }
      const bottom = actor.deck[actor.deck.length - 1]
      return {
        ...state,
        pendingDeckPeek: { playerIndex: idx, card: bottom },
        log: [...state.log, `${actor.villainName} regarde la dernière carte de sa pioche (Retourne-toi).`],
      }
    }
    case 'RESHUFFLE_DISCARD_AND_DRAW': {
      // Perdu dans les bois : défausse + pioche → nouvelle pioche mélangée, puis
      // pioche `count` cartes.
      const actor = state.players[idx]
      const combined = [...actor.deck, ...actor.discard]
      if (combined.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (Perdu dans les bois).`] }
      }
      const r = shuffle(combined, state.rngState)
      const drawn = r.result.slice(0, effect.count)
      const remaining = r.result.slice(effect.count)
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck: remaining,
        discard: [],
        hand: [...p.hand, ...drawn],
      }))
      return {
        ...next,
        rngState: r.state,
        activeDrewCard: drawn.length > 0 ? true : state.activeDrewCard,
        log: [
          ...next.log,
          `${actor.villainName} mélange sa défausse et sa pioche, puis pioche ${drawn.length} carte${drawn.length > 1 ? 's' : ''} (Perdu dans les bois).`,
        ],
      }
    }
    case 'CHOOSE_TYPE_REVEAL_DRAW': {
      // Tombée de la nuit : met l'état en attente d'un choix de type (Événement/
      // Objet). La révélation des cartes a lieu à la résolution (RESOLVE_TYPE_CHOICE).
      const actor = state.players[idx]
      if (actor.deck.length === 0 && actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (Tombée de la nuit).`] }
      }
      return {
        ...state,
        pendingTypeChoice: { playerIndex: idx, count: effect.count, types: ['effect', 'item'] },
        log: [...state.log, `${actor.villainName} : choisissez Événement ou Objet (Tombée de la nuit).`],
      }
    }
    case 'REVEAL_UNTIL_TYPE': {
      // Prédiction (Jafar) : choix d'un type, puis on dévoile la pioche jusqu'à en
      // trouver un. La révélation a lieu à la résolution (RESOLVE_TYPE_CHOICE).
      const actor = state.players[idx]
      if (actor.deck.length === 0 && actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche et défausse vides (Prédiction).`] }
      }
      return {
        ...state,
        pendingTypeChoice: { playerIndex: idx, count: 0, types: effect.types, untilFound: true },
        log: [...state.log, `${actor.villainName} : choisissez un type (Prédiction).`],
      }
    }
    case 'CAPTURE_CARDS_AT_HOST': {
      // À la pose d'un Héros (Enquêteur/Enfant Perdu) : associe jusqu'à `max`
      // cartes `cardId` (Pages) du lieu hôte au Héros — elles sont « capturées »
      // (attachedTo = hôte) et ne comptent plus dans le royaume.
      if (!ctx?.hostInstanceId || !ctx?.hostLocationId) {
        throw new Error('CAPTURE_CARDS_AT_HOST nécessite hostInstanceId + hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const host = ctx.hostInstanceId
      const cell = state.players[idx].board[loc] ?? []
      const candidates = cell.filter((c) => c.cardId === effect.cardId && !c.attachedTo)
      const take = effect.max !== undefined ? candidates.slice(0, effect.max) : candidates
      if (take.length === 0) return state
      const takeIds = new Set(take.map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [loc]: (p.board[loc] ?? []).map((c) =>
            takeIds.has(c.instanceId) ? { ...c, attachedTo: host } : c,
          ),
        },
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `**${take[0].name}** ×${take.length} capturée${take.length > 1 ? 's' : ''} par le Héros.`,
        ],
      }
    }
    case 'RELEASE_CAPTURED_TO_HAND': {
      // À la mort du Héros : les cartes capturées (associées à l'hôte) reviennent
      // dans la MAIN de l'acteur (Slenderman récupère ses Pages).
      if (!ctx?.hostInstanceId || !ctx?.hostLocationId) {
        throw new Error('RELEASE_CAPTURED_TO_HAND nécessite hostInstanceId + hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const host = ctx.hostInstanceId
      const cell = state.players[idx].board[loc] ?? []
      const captured = cell.filter(
        (c) => c.attachedTo === host && (!effect.cardId || c.cardId === effect.cardId),
      )
      if (captured.length === 0) return state
      const ids = new Set(captured.map((c) => c.instanceId))
      const returned = captured.map((c) => ({ ...c, attachedTo: undefined }))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !ids.has(c.instanceId)) },
        hand: [...p.hand, ...returned],
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `${next.players[idx].villainName} récupère ${returned.length} **${returned[0].name}** en main.`,
        ],
      }
    }
    case 'ARM_DRAGON_FORM_REWARD': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, dragonFormReward: true }))
      return {
        ...next,
        log: [
          ...next.log,
          `${next.players[idx].villainName} : Apparence de Dragon — +3 JT si fatalisé avant son prochain tour.`,
        ],
      }
    }
    case 'INSTANT_VANQUISH_HERO_LE': {
      if (!ctx?.targetHeroId) {
        throw new Error('INSTANT_VANQUISH_HERO_LE nécessite un targetHeroId.')
      }
      const target = ctx.targetHeroId
      const actor = state.players[idx]
      let heroLoc: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === target)
        if (found) { heroLoc = loc.id; hero = found; break }
      }
      if (!hero || !heroLoc) throw new Error(`Héros « ${target} » introuvable.`)
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      if ((hero.strength ?? 0) > effect.maxStrength) {
        throw new Error(`${hero.name} (force ${hero.strength}) > ${effect.maxStrength} : non vaincu.`)
      }
      // « sur le lieu où vous vous trouvez » (Ah, je suis un serpent ?).
      if (effect.atPawn && heroLoc !== actor.pawnLocation) {
        throw new Error(`${hero.name} n'est pas sur votre lieu.`)
      }
      // Déguisement : refus.
      const hasDeguisement = (actor.board[heroLoc] ?? []).some(
        (c) => c.cardId === 'deguisement' && c.attachedTo === target,
      )
      if (hasDeguisement) {
        throw new Error(`${hero.name} est invulnérable (Déguisement).`)
      }
      const locked = hero.lockedPower ?? 0
      const heroDiscarded: CardInstance = { ...hero, lockedPower: undefined }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [heroLoc!]: (p.board[heroLoc!] ?? []).filter((c) => c.instanceId !== target) },
        fateDiscard: [...p.fateDiscard, heroDiscarded],
        power: p.power + locked,
      }))
      next = {
        ...next,
        lastVanquishedHeroStrength: hero.strength ?? 0,
        log: [
          ...next.log,
          `${actor.villainName} élimine instantanément **${hero.name}** (Apparence de Dragon).`,
          ...(locked > 0
            ? [`${locked} JT verrouillé${locked > 1 ? 's' : ''} restitué${locked > 1 ? 's' : ''}.`]
            : []),
        ],
      }
      // Effets « à la mort » du héros (Toby reshuffle, Belle Marianne → Robin).
      return resolveEffects(next, hero.onVanquish ?? [], {
        actorIndex: idx,
        hostInstanceId: hero.instanceId,
        hostLocationId: heroLoc,
      })
    }
    case 'INSTANT_VANQUISH_HERO_AT_PAWN': {
      if (!ctx?.targetHeroId) {
        throw new Error('INSTANT_VANQUISH_HERO_AT_PAWN nécessite un targetHeroId.')
      }
      const target = ctx.targetHeroId
      const actor = state.players[idx]
      let heroLoc: LocationId | undefined
      let hero: CardInstance | undefined
      for (const loc of actor.locations) {
        const found = (actor.board[loc.id] ?? []).find((c) => c.instanceId === target)
        if (found) { heroLoc = loc.id; hero = found; break }
      }
      if (!hero || !heroLoc) throw new Error(`Héros « ${target} » introuvable.`)
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      if (heroLoc !== actor.pawnLocation) {
        throw new Error(`${hero.name} n'est pas sur votre lieu (Disparition).`)
      }
      const hasDeguisement = (actor.board[heroLoc] ?? []).some(
        (c) => c.cardId === 'deguisement' && c.attachedTo === target,
      )
      if (hasDeguisement) {
        throw new Error(`${hero.name} est invulnérable (Déguisement).`)
      }
      const locked = hero.lockedPower ?? 0
      const heroDiscarded: CardInstance = { ...hero, lockedPower: undefined }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [heroLoc!]: (p.board[heroLoc!] ?? []).filter((c) => c.instanceId !== target) },
        fateDiscard: [...p.fateDiscard, heroDiscarded],
        power: p.power + locked,
      }))
      next = {
        ...next,
        lastVanquishedHeroStrength: hero.strength ?? 0,
        log: [
          ...next.log,
          `${actor.villainName} fait disparaître **${hero.name}** (Disparition).`,
          ...(locked > 0
            ? [`${locked} JT verrouillé${locked > 1 ? 's' : ''} restitué${locked > 1 ? 's' : ''}.`]
            : []),
        ],
      }
      return resolveEffects(next, hero.onVanquish ?? [], {
        actorIndex: idx,
        hostInstanceId: hero.instanceId,
        hostLocationId: heroLoc,
      })
    }
    case 'VANQUISH_HERO': {
      if (!ctx?.targetHeroId) {
        throw new Error('VANQUISH_HERO nécessite un targetHeroId dans le contexte.')
      }
      if (!ctx.allyInstanceIds || ctx.allyInstanceIds.length === 0) {
        throw new Error('VANQUISH_HERO nécessite allyInstanceIds dans le contexte.')
      }
      return performVanquish(state, ctx.targetHeroId, ctx.allyInstanceIds, effect.keepAllies)
    }
    case 'DISCARD_CARDS_AT_HOST': {
      // Sur le lieu hôte, défausse toutes les cartes de cardId donné présentes
      // chez l'acteur — ainsi que leurs Objets associés (cohérence avec MOVE_CARD).
      if (!ctx?.hostLocationId) {
        throw new Error('DISCARD_CARDS_AT_HOST nécessite un hostLocationId dans le contexte.')
      }
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      const cards = actor.board[loc] ?? []
      const targeted = cards.filter((c) => c.cardId === effect.cardId)
      if (targeted.length === 0) return state
      const targetedIds = new Set(targeted.map((c) => c.instanceId))
      const alsoAttached = cards.filter((c) => c.attachedTo && targetedIds.has(c.attachedTo))
      const toDiscard = [...targeted, ...alsoAttached]
      const toDiscardIds = new Set(toDiscard.map((c) => c.instanceId))
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !toDiscardIds.has(c.instanceId)) },
        discard: [...p.discard, ...toDiscard],
      }))
      return {
        ...next,
        log: [
          ...next.log,
          `${targeted[0].name} ×${targeted.length} défaussé${targeted.length > 1 ? 's' : ''} de ce lieu.`,
        ],
      }
    }
    case 'DISCARD_ALLIES_AT_HOST': {
      if (!ctx?.hostLocationId) {
        throw new Error('DISCARD_ALLIES_AT_HOST nécessite un hostLocationId.')
      }
      const loc = ctx.hostLocationId
      const actor = state.players[idx]
      const allies = (actor.board[loc] ?? []).filter((c) => c.type === 'ally')
      if (allies.length === 0) return state
      const ids = new Set(allies.map((c) => c.instanceId))
      // Objets associés à ces alliés suivent.
      const attached = (actor.board[loc] ?? []).filter(
        (c) => c.attachedTo && ids.has(c.attachedTo),
      )
      const toDiscardIds = new Set([...ids, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !toDiscardIds.has(c.instanceId)) },
        discard: [...p.discard, ...allies, ...attached],
      }))
      return {
        ...next,
        log: [...next.log, `${allies.length} Allié${allies.length > 1 ? 's' : ''} défaussé${allies.length > 1 ? 's' : ''} (Prince Philippe).`],
      }
    }
    case 'PULL_ALLY_FROM_EACH_ADJACENT': {
      if (!ctx?.hostLocationId) {
        throw new Error('PULL_ALLY_FROM_EACH_ADJACENT nécessite un hostLocationId.')
      }
      const dest = ctx.hostLocationId
      const actor = state.players[idx]
      const adj = adjacentLocationIds(state, dest)
      // « Vous pouvez déplacer un Allié de chaque lieu voisin » : c'est le joueur
      // qui a joué la Fatalité qui choisit (un Allié par lieu voisin, optionnel).
      const anyAlly = adj.some((a) => (actor.board[a] ?? []).some((c) => c.type === 'ally'))
      if (!anyAlly) return state
      return {
        ...state,
        pendingHubertPull: { chooserIndex: state.activePlayer, targetIndex: idx, dest },
        log: [
          ...state.log,
          `Roi Hubert : ${actor.villainName} peut attirer un Allié de chaque lieu voisin.`,
        ],
      }
    }
    case 'MOVE_OWNER_PAWN_FORCED': {
      // « Vous pouvez déplacer Maléfique sur n'importe quel lieu » : le LIEU (ou
      // le fait de ne pas bouger) est choisi par le joueur qui a joué la Fatalité
      // (`state.activePlayer`). On met l'état en attente (RESOLVE_PAWN_MOVE).
      return {
        ...state,
        pendingPawnMove: { chooserIndex: state.activePlayer, targetIndex: idx },
        log: [...state.log, `Roi Stéphane : ${state.players[idx].villainName} peut être déplacé.`],
      }
    }
    case 'REVEAL_FATE_TOP_PLAY_IF_HERO': {
      if (!ctx?.hostLocationId) {
        throw new Error('REVEAL_FATE_TOP_PLAY_IF_HERO nécessite un hostLocationId.')
      }
      const actor = state.players[idx]
      if (actor.fateDeck.length === 0 && actor.fateDiscard.length === 0) return state
      const r = revealFate(actor, 1, state.rngState)
      const revealed = r.revealed[0]
      if (!revealed) return state
      if (revealed.type !== 'hero') {
        // Remettre la carte sur le dessus de la pioche (post-reshuffle).
        const next = updatePlayer(state, idx, () => ({
          ...r.player,
          fateDeck: [revealed, ...r.player.fateDeck],
        }))
        return {
          ...next,
          rngState: r.rngState,
          log: [...next.log, `Aurore révèle **${revealed.name}** (non-Héros) → remise sur la pioche.`],
        }
      }
      // Héros : le LIEU est choisi par le joueur qui a joué la Fatalité
      // (`state.activePlayer`). On met l'état en attente (pendingHeroPlacement) ;
      // la pose réelle se fait via RESOLVE_HERO_PLACEMENT (UI humain / auto bot).
      let next = updatePlayer(state, idx, () => r.player)
      next = { ...next, rngState: r.rngState }
      const validLocs = heroPlacementLocations(next, revealed, idx)
      if (validLocs.length === 0) {
        // Aucun lieu valide → défausse Fatalité.
        next = updatePlayer(next, idx, (p) => ({ ...p, fateDiscard: [...p.fateDiscard, revealed] }))
        return {
          ...next,
          log: [...next.log, `Aurore révèle **${revealed.name}** mais aucun lieu valide → défaussé.`],
        }
      }
      return {
        ...next,
        pendingHeroPlacement: { chooserIndex: next.activePlayer, targetIndex: idx, hero: revealed },
        log: [...next.log, `Aurore révèle **${revealed.name}** — à placer.`],
      }
    }
    case 'UNLOCK_LOCATION': {
      // Jafar (Scarabée d'Or) : retire le Cadenas d'un lieu de l'acteur.
      const actor = state.players[idx]
      if (!(actor.lockedLocations ?? []).includes(effect.locationId)) return state
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        lockedLocations: (p.lockedLocations ?? []).filter((l) => l !== effect.locationId),
      }))
      const name = findLocation(actor, effect.locationId)?.name ?? effect.locationId
      return {
        ...next,
        log: [...next.log, `${actor.villainName} déverrouille **${name}** (Scarabée d'Or).`],
      }
    }
    case 'SUMMON_FATE_HERO_TO_OWN_REALM': {
      // Jafar (Lampe Merveilleuse) : cherche le Génie dans SON deck/défausse
      // Fatalité et le pose sur SON board au lieu indiqué.
      const loc = effect.locationId
      const actor = state.players[idx]
      const inDeck = actor.fateDeck.find((c) => c.cardId === effect.heroCardId)
      const inDiscard = inDeck
        ? undefined
        : actor.fateDiscard.find((c) => c.cardId === effect.heroCardId)
      const found = inDeck ?? inDiscard
      if (!found) {
        return {
          ...state,
          log: [...state.log, `${actor.villainName} : ${effect.heroCardId} introuvable dans la Fatalité.`],
        }
      }
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: inDeck ? p.fateDeck.filter((c) => c.instanceId !== found.instanceId) : p.fateDeck,
        fateDiscard: inDiscard
          ? p.fateDiscard.filter((c) => c.instanceId !== found.instanceId)
          : p.fateDiscard,
        board: { ...p.board, [loc]: [...(p.board[loc] ?? []), found] },
      }))
      const placeName = findLocation(actor, loc)?.name ?? loc
      next = {
        ...next,
        log: [...next.log, `**${found.name}** est invoqué sur **${placeName}** !`],
      }
      next = pushShowcase(
        next,
        found.cardId,
        `${found.name} apparaît sur ${placeName} !`,
        idx,
        { playerIndex: idx, locationId: loc },
        found.instanceId,
      )
      return triggerHeroArrival(next, idx, loc)
    }
    case 'DISCARD_OWN_FOR_POWER': {
      // Sacrifice Nécessaire : défausse l'Allié/Objet désigné (+ ses Objets
      // associés si c'est un Allié), puis gagne `amount` Pouvoir.
      const targetId = ctx?.allyInstanceIds?.[0]
      if (!targetId) throw new Error('DISCARD_OWN_FOR_POWER nécessite une carte à défausser.')
      const actor = state.players[idx]
      const cardLoc = locationOfCard(actor, targetId)
      if (!cardLoc) throw new Error('Carte à sacrifier absente du royaume.')
      const target = actor.board[cardLoc].find((c) => c.instanceId === targetId)!
      if (target.type !== 'ally' && target.type !== 'item') {
        throw new Error('Seul un Allié ou un Objet peut être sacrifié.')
      }
      // La carte + ses Objets associés (si Allié) partent en défausse.
      const removeIds = new Set<string>([targetId])
      for (const c of actor.board[cardLoc]) {
        if (c.attachedTo === targetId) removeIds.add(c.instanceId)
      }
      const removed = actor.board[cardLoc].filter((c) => removeIds.has(c.instanceId))
      // Jetons verrouillés éventuels restitués au joueur.
      const lockedBack = removed.reduce((n, c) => n + (c.lockedPower ?? 0), 0)
      const gained = Math.max(0, effect.amount - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        power: p.power + gained + lockedBack,
        board: {
          ...p.board,
          [cardLoc]: p.board[cardLoc].filter((c) => !removeIds.has(c.instanceId)),
        },
        discard: [...p.discard, ...removed.map((c) => ({ ...c, lockedPower: undefined, attachedTo: undefined }))],
      }))
      next = {
        ...next,
        log: [
          ...next.log,
          `${actor.villainName} sacrifie **${target.name}** → +${gained} JT (Sacrifice Nécessaire).`,
        ],
      }
      // Montre la/les carte(s) défaussée(s).
      next = pushDiscardShowcase(
        next,
        removed.map((c) => c.cardId),
        `${actor.villainName} sacrifie ${target.name}`,
        idx,
        'dark',
        'bottom',
      )
      return next
    }
    case 'ROYAL_CROQUET_ATTEMPT': {
      // Reine de Cœur — Coup Royal.
      const actor = state.players[idx]
      const everyLocHasWicket = actor.locations.every((loc) =>
        (actor.board[loc.id] ?? []).some((c) => c.isWicket),
      )
      if (!everyLocHasWicket) {
        return {
          ...state,
          log: [...state.log, `${actor.villainName} : Coup Royal raté — il faut un arceau sur chaque lieu.`],
        }
      }
      // Force totale des arceaux (modificateurs inclus).
      let wicketStrength = 0
      for (const loc of actor.locations) {
        for (const c of actor.board[loc.id] ?? []) {
          if (c.isWicket) wicketStrength += effectiveStrength(state, idx, c.instanceId) ?? c.strength ?? 0
        }
      }
      // Révéler les 5 premières cartes (remélange la défausse si besoin).
      let deck = actor.deck
      let discard = actor.discard
      let rngState = state.rngState
      if (deck.length < 5 && discard.length > 0) {
        const r = shuffle(discard, rngState)
        deck = [...deck, ...r.result]
        discard = []
        rngState = r.state
      }
      const revealed = deck.slice(0, 5)
      const rest = deck.slice(5)
      const costSum = revealed.reduce((n, c) => n + (c.cost ?? 0), 0)
      const won = costSum < wicketStrength
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck: rest,
        discard: won ? discard : [...discard, ...revealed],
      }))
      next = {
        ...next,
        rngState,
        pendingRoyalCroquet: { playerIndex: idx, revealed, wicketStrength, costSum, won },
        log: [
          ...next.log,
          `${actor.villainName} — Coup Royal : arceaux (force ${wicketStrength}) vs coûts révélés (${costSum}) → ${won ? 'RÉUSSI !' : 'raté'}.`,
        ],
      }
      if (won) {
        next = {
          ...next,
          status: 'WON',
          winner: idx,
          log: [...next.log, `🏆 ${actor.villainName} réussit le Coup Royal et l'emporte !`],
        }
      }
      return next
    }
    case 'SET_HERO_SIZE': {
      // Reine de Cœur — Rapetisser / Agrandir.
      const target = ctx?.targetHeroId
      if (!target) throw new Error('SET_HERO_SIZE nécessite un Héros cible.')
      const actor = state.players[idx]
      const heroLoc = locationOfCard(actor, target)
      if (!heroLoc) throw new Error('Héros introuvable dans le royaume.')
      const hero = actor.board[heroLoc].find((c) => c.instanceId === target)!
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      // On ne peut pas rapetisser deux fois un même Héros (la taille ne « cumule »
      // pas). Sans effet s'il est déjà rapetissé.
      if (effect.size === 'shrunk' && hero.heroSize === 'shrunk') {
        return {
          ...state,
          log: [...state.log, `**${hero.name}** est déjà rapetissé : on ne peut pas le rapetisser deux fois.`],
        }
      }
      const opposite = effect.size === 'shrunk' ? 'enlarged' : 'shrunk'
      // Si le Héros porte la taille opposée → retour à la normale ; sinon `size`.
      const newSize = hero.heroSize === opposite ? undefined : effect.size
      if (newSize === 'shrunk' && hero.cardId === 'loir') {
        return { ...state, log: [...state.log, 'Le Loir ne peut pas rapetisser.'] }
      }
      // Agrandir : on fixe le lieu adjacent recouvert (côté gauche/droite).
      // Si le joueur a choisi un sens (ctx.enlargeToward) et que c'est un voisin
      // valide, on le respecte ; sinon (bot / choix omis) on privilégie un voisin
      // non déjà entièrement recouvert (couverture non gaspillée).
      let enlargeTargetId: string | undefined
      if (newSize === 'enlarged') {
        const ids = actor.locations.map((l) => l.id)
        const i = ids.indexOf(heroLoc)
        const sides = [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id)
        enlargeTargetId =
          (ctx?.enlargeToward && sides.includes(ctx.enlargeToward) ? ctx.enlargeToward : undefined) ??
          sides.find(
            (id) =>
              !(actor.board[id] ?? []).some(
                (c) => c.type === 'hero' && !c.hypnotized && c.heroSize !== 'shrunk',
              ),
          ) ??
          sides[0]
      }
      // Rapetisser : le Héros laisse LIBRE une action du haut (choisie par le
      // joueur via ctx.shrinkFreeActionId) et recouvre l'autre. À défaut (bot /
      // choix omis), on libère la 1ʳᵉ action du haut de son lieu.
      let shrunkFreeActionId: string | undefined
      if (newSize === 'shrunk') {
        const tops = (actor.locations.find((l) => l.id === heroLoc)?.actions ?? []).filter(
          (a) => a.row === 'top',
        )
        shrunkFreeActionId =
          (ctx?.shrinkFreeActionId && tops.some((a) => a.id === ctx.shrinkFreeActionId)
            ? ctx.shrinkFreeActionId
            : undefined) ?? tops[0]?.id
      }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [heroLoc]: p.board[heroLoc].map((c) =>
            c.instanceId === target
              ? { ...c, heroSize: newSize, enlargeTargetId, shrunkFreeActionId }
              : c,
          ),
        },
      }))
      const verb =
        newSize === 'shrunk' ? 'rapetisse' : newSize === 'enlarged' ? 'agrandit' : 'rend à sa taille normale'
      return { ...next, log: [...next.log, `${actor.villainName} ${verb} **${hero.name}**.`] }
    }
    case 'DISCARD_ALLY_AT_HOST': {
      // Clochette : défausse un Allié (et ses Objets associés) sur son lieu.
      const loc = ctx?.hostLocationId
      const p = state.players[idx]
      const ally = loc
        ? (p.board[loc] ?? []).find((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
        : undefined
      if (!loc || !ally) {
        return { ...state, log: [...state.log, 'Clochette : aucun Allié à défausser sur ce lieu.'] }
      }
      const attached = (p.board[loc] ?? []).filter((c) => c.attachedTo === ally.instanceId)
      const removed = new Set([ally.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (pp) => ({
        ...pp,
        board: { ...pp.board, [loc]: (pp.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
        discard: [...pp.discard, ally, ...attached],
      }))
      return { ...next, log: [...next.log, `Clochette défausse **${ally.name}**.`] }
    }
    case 'STEAL_ITEM_TO_HERO': {
      // Abu / Aladdin (Fatalité) : l'adversaire (chooser) choisit un Objet du lieu
      // du Héros (et, pour Aladdin, de la main de la cible) à associer au Héros.
      const targetIndex = idx // royaume ciblé (Jafar)
      const tgt = state.players[targetIndex]
      const chooserIndex = (targetIndex + 1) % state.players.length
      const loc = ctx?.hostLocationId
      const locItems = loc ? (tgt.board[loc] ?? []).filter((c) => c.type === 'item' && !c.attachedTo) : []
      const handItems = effect.fromHand ? tgt.hand.filter((c) => c.type === 'item') : []
      const candidateIds = [...locItems, ...handItems].map((c) => c.instanceId)
      if (candidateIds.length === 0 || !ctx?.hostInstanceId) {
        return { ...state, log: [...state.log, `Aucun Objet à voler pour ${ctx?.hostInstanceId ? 'ce Héros' : 'cette carte'}.`] }
      }
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex,
          targetIndex,
          kind: 'steal-item-to-hero',
          hostInstanceId: ctx.hostInstanceId,
          candidateIds,
        },
        log: [...state.log, `${state.players[chooserIndex].villainName} choisit un Objet à voler à ${tgt.villainName}.`],
      }
    }
    case 'REVEAL_OWN_FATE_PLAY_HERO': {
      // Dévoile le deck Fatalité de l'acteur jusqu'à un Héros, le joue dans SON
      // royaume, défausse les autres cartes dévoilées.
      const actor0 = state.players[idx]
      let deck = actor0.fateDeck
      let disc = actor0.fateDiscard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let hero: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === 'hero') {
          hero = top
          break
        }
      }
      const others = revealed.filter((c) => c !== hero)
      // On retire les cartes dévoilées de la pioche ; les non-Héros et le sort du
      // Héros (joué / défaussé) sont réglés à la résolution (RESOLVE_FETCHED_HERO).
      let next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: deck, fateDiscard: disc }))
      next = { ...next, rngState: s }
      if (!hero) {
        return {
          ...next,
          players: next.players.map((p, i) => (i === idx ? { ...p, fateDiscard: [...p.fateDiscard, ...others] } : p)),
          log: [...next.log, `${actor0.villainName} ne trouve aucun Héros dans son deck Fatalité.`],
        }
      }
      return {
        ...next,
        pendingFetchedHero: { playerIndex: idx, hero, discarded: others },
        log: [
          ...next.log,
          `${actor0.villainName} dévoile **${hero.name}** : à jouer dans son royaume ou à défausser.`,
        ],
      }
    }
    case 'RELOCATE_OWN_HERO': {
      // Monsieur Starkey : si l'acteur a un Héros dans son royaume, ouvre le
      // déplacement d'un Héros vers un lieu voisin (pendingHeroRelocate).
      const actor = state.players[idx]
      const hasHero = Object.values(actor.board).flat().some((c) => c.type === 'hero')
      if (!hasHero) return state
      return {
        ...state,
        pendingHeroRelocate: { chooserIndex: idx, targetIndex: idx, anyLocation: effect.anyLocation },
        log: [
          ...state.log,
          `${actor.villainName} peut déplacer un Héros vers ${effect.anyLocation ? 'un lieu non bloqué' : 'un lieu voisin'}.`,
        ],
      }
    }
    case 'SCRY_OWN_FATE_TOP2': {
      // Faites-leur peur ! : retire les 2 premières cartes Fatalité et ouvre la
      // fenêtre de décision (pendingScry) — défausser ou remettre sur le dessus
      // dans l'ordre choisi (RESOLVE_SCRY).
      const actor = state.players[idx]
      let deck = actor.fateDeck
      let disc = actor.fateDiscard
      let s = state.rngState
      if (deck.length < 2 && disc.length > 0) {
        const r = shuffle(disc, s)
        deck = [...deck, ...r.result]
        s = r.state
        disc = []
      }
      const top = deck.slice(0, 2)
      const rest = deck.slice(top.length)
      if (top.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche Fatalité vide (Faites-leur peur !).`] }
      }
      const next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: rest, fateDiscard: disc }))
      return {
        ...next,
        rngState: s,
        pendingScry: { playerIndex: idx, cards: top },
        log: [...next.log, `${actor.villainName} regarde les ${top.length} première(s) carte(s) de sa pioche Fatalité (Faites-leur peur !).`],
      }
    }
    case 'MOVE_ALLY_BUFF': {
      // Ouvre la sélection d'un Allié à déplacer vers un lieu voisin non bloqué
      // (+amount force jusqu'à la fin du tour ; amount 0 = simple déplacement).
      // Sans Allié déplaçable (aucun Allié, ou aucun voisin non bloqué), no-op.
      const actor = state.players[idx]
      const src = effect.label ?? 'Pas de Quartier !'
      const buff = effect.amount > 0 ? ` (+${effect.amount} force ce tour-ci)` : ''
      const hasMovable = actor.locations.some(
        (l) =>
          adjacentLocationIds(state, l.id).length > 0 &&
          (actor.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket),
      )
      if (!hasMovable) {
        return { ...state, log: [...state.log, `${src} : aucun Allié déplaçable.`] }
      }
      return {
        ...state,
        pendingAllyMoveBuff: { playerIndex: idx, amount: effect.amount, label: effect.label, optional: effect.optional },
        log: [
          ...state.log,
          `${actor.villainName} (${src}) : déplacez un Allié vers un lieu voisin${buff}.`,
        ],
      }
    }
    case 'GAIN_POWER_PER_CONTRACT': {
      // Ursula — Chaudron : +amount Pouvoir par Pacte dans le royaume.
      const p = state.players[idx]
      const contracts = Object.values(p.board).flat().filter((c) => c.contractLocationId).length
      const gained = contracts * effect.amount
      const next = updatePlayer(state, idx, (pp) => ({ ...pp, power: pp.power + gained }))
      return {
        ...next,
        log: [...next.log, `${p.villainName} gagne ${gained} Pouvoir (Chaudron : ${contracts} Pacte${contracts > 1 ? 's' : ''}).`],
      }
    }
    case 'REVEAL_VILLAIN_UNTIL_CONTRACT': {
      // Divination : dévoile la pioche Vilain jusqu'à un Pacte (carte avec
      // contractLocationId), l'ajoute à la main, défausse les autres dévoilées.
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.contractLocationId) {
          found = top
          break
        }
      }
      const others = revealed.filter((c) => c !== found)
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck,
        discard: [...disc, ...others],
        hand: found ? [...p.hand, found] : p.hand,
      }))
      next = { ...next, rngState: s }
      return {
        ...next,
        log: [...next.log, found ? `${actor.villainName} ajoute un Pacte à sa main (Divination).` : `${actor.villainName} ne trouve aucun Pacte.`],
      }
    }
    case 'SHUFFLE_VILLAIN_DISCARD': {
      // Polochon : mélange la défausse Vilain de l'acteur dans sa pioche Vilain.
      const actor = state.players[idx]
      if (actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : défausse Vilain déjà vide.`] }
      }
      const r = shuffle([...actor.deck, ...actor.discard], state.rngState)
      const next = updatePlayer(state, idx, (p) => ({ ...p, deck: r.result, discard: [] }))
      return { ...next, rngState: r.state, log: [...next.log, `${actor.villainName} mélange sa défausse Vilain dans sa pioche (Polochon).`] }
    }
    case 'EUREKA_ATTACH_ITEM': {
      // Eurêka : associe au Héros hôte le 1er Objet de la défausse Fatalité.
      const host = ctx?.hostInstanceId
      const loc = ctx?.hostLocationId
      const actor = state.players[idx]
      const item = actor.fateDiscard.find((c) => c.type === 'item')
      if (!host || !loc || !item) {
        return { ...state, log: [...state.log, 'Eurêka : aucun Objet dans la défausse Fatalité.'] }
      }
      const equipped: CardInstance = { ...item, attachedTo: host }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== item.instanceId),
        board: { ...p.board, [loc]: [...(p.board[loc] ?? []), equipped] },
      }))
      return { ...next, log: [...next.log, `Eurêka récupère **${item.name}** de la défausse Fatalité.`] }
    }
    case 'STEAL_CONTRACT_TO_HOST': {
      // Sébastien : transfère un Pacte d'un autre Héros vers le Héros hôte.
      const host = ctx?.hostInstanceId
      const actor = state.players[idx]
      const candidates = Object.values(actor.board)
        .flat()
        .filter((c) => c.contractLocationId && c.attachedTo && c.attachedTo !== host)
      if (!host || candidates.length === 0) {
        return { ...state, log: [...state.log, 'Sébastien : aucun Pacte à transférer.'] }
      }
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex: (idx + 1) % state.players.length,
          targetIndex: idx,
          kind: 'steal-item-to-hero',
          hostInstanceId: host,
          candidateIds: candidates.map((c) => c.instanceId),
        },
        log: [...state.log, 'Sébastien : transférez un Pacte sur lui.'],
      }
    }
    case 'MOVE_URSULA_PAWN': {
      // Max : si joué sur le lieu d'Ursula, l'adversaire déplace sa figurine.
      const actor = state.players[idx]
      const loc = ctx?.hostLocationId
      if (!loc || actor.pawnLocation !== loc) return state
      return {
        ...state,
        pendingPawnMove: { chooserIndex: (idx + 1) % state.players.length, targetIndex: idx },
        log: [...state.log, `Max : la figurine d'${actor.villainName} peut être déplacée.`],
      }
    }
    case 'RECOVER_ITEM_OR_EVENT': {
      // Opportunisme : reprend en main un Objet ou un Événement de la défausse Vilain.
      const actor = state.players[idx]
      const candidates = actor.discard.filter((c) => c.type === 'item' || c.type === 'effect')
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Objet/Événement en défausse.`] }
      }
      return {
        ...state,
        pendingRecover: { playerIndex: idx, candidateIds: candidates.map((c) => c.instanceId) },
        log: [...state.log, `${actor.villainName} récupère une carte de sa défausse (Opportunisme).`],
      }
    }
    case 'KILL_CREWMATE': {
      // L'Imposteur — Tuer : défausse un Coéquipier sur le lieu du pion ou le lieu
      // d'un Allié de l'Imposteur. Choix interactif (pendingCrewmateKill) ; les
      // autres Coéquipiers de ce lieu deviennent suspects (à la résolution).
      const actor = state.players[idx]
      const crew = actor.crewmates ?? []
      const allyLocs = actor.locations
        .filter((l) => (actor.board[l.id] ?? []).some((c) => c.type === 'ally' && !c.attachedTo))
        .map((l) => l.id)
      const targetLocs = new Set<string>(
        [actor.pawnLocation, ...allyLocs].filter((v): v is string => !!v),
      )
      const candidates = crew.filter((c) => !c.discarded && targetLocs.has(c.locationId))
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Coéquipier à défausser (Tuer).`] }
      }
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: candidates.map((c) => c.color), mode: 'kill' },
        log: [...state.log, `${actor.villainName} choisit un Coéquipier à défausser (Tuer).`],
      }
    }
    case 'SKIP_CREWMATE_MOVE': {
      // Porte désactivée : les Coéquipiers de l'Imposteur ne bougeront pas à la
      // fin de ce tour.
      return {
        ...state,
        players: state.players.map((p, i) => (i === idx ? { ...p, crewmatesSkipMove: true } : p)),
        log: [...state.log, `${state.players[idx].villainName} désactive les portes : les Coéquipiers resteront en place.`],
      }
    }
    case 'FALSE_ACCUSATION': {
      // Fausse accusation : le joueur choisit le Coéquipier à défausser (n'importe
      // où) ; tous les autres redeviennent normaux (résolu à la sélection).
      const p = state.players[idx]
      const live = (p.crewmates ?? []).filter((c) => !c.discarded)
      if (live.length === 0) return logCrew(state, idx, 'aucun Coéquipier (Fausse accusation)')
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: live.map((c) => c.color), mode: 'false-accusation' },
        log: [...state.log, `${p.villainName} choisit un Coéquipier à défausser (Fausse accusation).`],
      }
    }
    case 'REASSURE_CREWMATE': {
      // Assurance : le joueur choisit un Coéquipier suspect sur SON lieu OU le lieu
      // d'un Allié → il redevient normal (résolu à la sélection).
      const p = state.players[idx]
      const peri = crewPeri(p)
      // Tout Coéquipier (suspect OU normal) sur votre lieu / celui d'un Allié : il
      // redevient normal (sans effet s'il l'est déjà) et pourra être déplacé.
      const candidates = (p.crewmates ?? []).filter((c) => !c.discarded && peri.has(c.locationId))
      if (candidates.length === 0) return logCrew(state, idx, 'aucun Coéquipier sur votre lieu ou celui d’un Allié (Assurance)')
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: candidates.map((c) => c.color), mode: 'reassure' },
        log: [...state.log, `${p.villainName} choisit un Coéquipier à rassurer (Assurance).`],
      }
    }
    case 'MOVE_CREWMATES_NEIGHBOR': {
      // Lumière désactivée : déplace `count` Coéquipiers (hors sabotage) vers un lieu
      // voisin (le moins occupé).
      const p = state.players[idx]
      const locIds = p.locations.map((l) => l.id)
      const sabLocs = new Set(
        p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.isSabotage && !c.attachedTo)).map((l) => l.id),
      )
      let crew = p.crewmates ?? []
      const movable = crew.filter((c) => !c.discarded && !sabLocs.has(c.locationId)).slice(0, effect.count)
      for (const m of movable) {
        const neighbors = neighborLocIds(locIds, m.locationId)
        if (neighbors.length === 0) continue
        const count = (loc: string) => crew.filter((c) => !c.discarded && c.locationId === loc).length
        const dest = [...neighbors].sort((a, b) => count(a) - count(b))[0]
        crew = placeCrewmateAt(crew, m.color, dest)
      }
      return setCrew(state, idx, crew, 'déplace des Coéquipiers vers un lieu voisin (Lumière désactivée)')
    }
    case 'MOVE_ONE_CREWMATE_NEIGHBOR': {
      // Réparation rapide : déplace UN Coéquipier vers un lieu voisin.
      const p = state.players[idx]
      const locIds = p.locations.map((l) => l.id)
      let crew = p.crewmates ?? []
      const m = crew.find((c) => !c.discarded && neighborLocIds(locIds, c.locationId).length > 0)
      if (!m) return logCrew(state, idx, 'aucun Coéquipier à déplacer (Réparation rapide)')
      const neighbors = neighborLocIds(locIds, m.locationId)
      const count = (loc: string) => crew.filter((c) => !c.discarded && c.locationId === loc).length
      const dest = [...neighbors].sort((a, b) => count(a) - count(b))[0]
      crew = placeCrewmateAt(crew, m.color, dest)
      return setCrew(state, idx, crew, `déplace le Coéquipier ${m.color} (Réparation rapide)`)
    }
    case 'CREWMATES_SUSPECT': {
      // Corps découvert / Tâche visuelle : rend suspects jusqu'à `count` Coéquipiers.
      const p = state.players[idx]
      const peri = crewPeri(p)
      let targets = (p.crewmates ?? []).filter(
        (c) => !c.discarded && !c.suspect && (effect.scope === 'away' ? !peri.has(c.locationId) : true),
      )
      if (effect.count != null) targets = targets.slice(0, effect.count)
      if (targets.length === 0) return logCrew(state, idx, 'aucun Coéquipier à rendre suspect')
      const set = new Set(targets.map((c) => c.color))
      const next = (p.crewmates ?? []).map((c) => (set.has(c.color) ? { ...c, suspect: true } : c))
      return setCrew(state, idx, next, `${set.size} Coéquipier(s) deviennent suspects`)
    }
    case 'CREWMATES_SUSPECT_CHOOSE': {
      // Tâche visuelle : l'adversaire (state.activePlayer) choisit jusqu'à `count`
      // Coéquipiers de l'Imposteur (idx) à rendre suspects.
      const p = state.players[idx]
      const eligible = (p.crewmates ?? []).filter((c) => !c.discarded && !c.suspect)
      if (eligible.length === 0) return logCrew(state, idx, 'aucun Coéquipier à rendre suspect (Tâche visuelle)')
      return {
        ...state,
        pendingCrewmateSuspect: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          remaining: Math.min(effect.count, eligible.length),
        },
        log: [...state.log, `Tâche visuelle : choisissez jusqu'à ${effect.count} Coéquipier(s) à rendre suspects.`],
      }
    }
    case 'SABOTAGE_COUNTDOWN': {
      // Corps découvert : avance le compte à rebours d'un Sabotage présent.
      const p = state.players[idx]
      let touched = false
      const board = Object.fromEntries(
        Object.entries(p.board).map(([loc, cards]) => [
          loc,
          cards.map((c) => {
            if (c.isSabotage && !c.attachedTo) {
              touched = true
              return { ...c, sabotageTurns: Math.max(0, (c.sabotageTurns ?? 0) + effect.amount) }
            }
            return c
          }),
        ]),
      )
      if (!touched) return state
      return {
        ...state,
        players: state.players.map((pp, i) => (i === idx ? { ...pp, board } : pp)),
        log: [...state.log, `Le compte à rebours du Sabotage de ${p.villainName} ${effect.amount >= 0 ? 'avance' : 'recule'} de ${Math.abs(effect.amount)}.`],
      }
    }
    case 'DISCARD_FATE_ITEM': {
      // Communication désactivée : défausse un Objet du royaume issu d'une Fatalité.
      const p = state.players[idx]
      let foundLoc: string | undefined
      let found: CardInstance | undefined
      for (const l of p.locations) {
        for (const c of p.board[l.id] ?? []) {
          if (c.type === 'item' && c.fromFate && !c.attachedTo) {
            foundLoc = l.id
            found = c
            break
          }
        }
        if (found) break
      }
      if (!found || !foundLoc) return logCrew(state, idx, 'aucun Objet de Fatalité à défausser (Communication désactivée)')
      const loc = foundLoc
      const card = found
      return {
        ...state,
        players: state.players.map((pp, i) =>
          i === idx
            ? {
                ...pp,
                board: { ...pp.board, [loc]: (pp.board[loc] ?? []).filter((c) => c.instanceId !== card.instanceId) },
                fateDiscard: [...pp.fateDiscard, card],
              }
            : pp,
        ),
        log: [...state.log, `${p.villainName} défausse **${card.name}** (Communication désactivée).`],
      }
    }
    case 'PLACE_DISCARDED_CREWMATE': {
      // Arrivée tardive : remet un Coéquipier défaussé sur le lieu le plus à gauche
      // ou à droite (auto : à gauche si possible).
      const p = state.players[idx]
      const crew = p.crewmates ?? []
      const dead = crew.find((c) => c.discarded)
      if (!dead) return logCrew(state, idx, 'aucun Coéquipier défaussé à replacer (Arrivée tardive)')
      const locIds = p.locations.map((l) => l.id)
      const dest = locIds[0]
      const next = placeCrewmateAt(crew, dead.color, dest)
      return setCrew(state, idx, next, `replace le Coéquipier ${dead.color} (Arrivée tardive)`)
    }
    case 'KILL_NORMAL_CREWMATE': {
      // Trahison : le joueur choisit un Coéquipier qui ne le suspecte pas (normal)
      // à éliminer (résolu à la sélection).
      const p = state.players[idx]
      const candidates = (p.crewmates ?? []).filter((c) => !c.discarded && !c.suspect)
      if (candidates.length === 0) return logCrew(state, idx, 'aucun Coéquipier normal à éliminer (Trahison)')
      return {
        ...state,
        pendingCrewmateKill: { playerIndex: idx, candidateColors: candidates.map((c) => c.color), mode: 'kill-normal' },
        log: [...state.log, `${p.villainName} choisit un Coéquipier (normal) à éliminer (Trahison).`],
      }
    }
    case 'REASSURE_ANY': {
      // Insidieux : un Coéquipier suspect (n'importe où) redevient normal.
      const p = state.players[idx]
      const crew = p.crewmates ?? []
      const target = crew.find((c) => !c.discarded && c.suspect)
      if (!target) return logCrew(state, idx, 'aucun Coéquipier suspect (Insidieux)')
      const next = crew.map((c) => (c.color === target.color ? { ...c, suspect: false } : c))
      return setCrew(state, idx, next, `un Coéquipier suspect redevient normal (Insidieux)`)
    }
    case 'GATHER_CREWMATES': {
      // Réunion d'urgence : rassemble un maximum de Coéquipiers sur le lieu le plus
      // peuplé (4 cases max).
      const p = state.players[idx]
      const locIds = p.locations.map((l) => l.id)
      let crew = p.crewmates ?? []
      const live = crew.filter((c) => !c.discarded)
      if (live.length === 0) return logCrew(state, idx, 'aucun Coéquipier (Réunion d’urgence)')
      const count = (loc: string) => live.filter((c) => c.locationId === loc).length
      const dest = [...locIds].sort((a, b) => count(b) - count(a))[0]
      for (const c of live) {
        if (c.locationId !== dest) crew = placeCrewmateAt(crew, c.color, dest)
      }
      return setCrew(state, idx, crew, `rassemble les Coéquipiers sur ${p.locations.find((l) => l.id === dest)?.name ?? dest} (Réunion d’urgence)`)
    }
    case 'GIANT_ACTION': {
      // Colère Titanesque : ouvre le choix d'un lieu voisin (bloqué ou non) où le
      // joueur effectuera UNE action.
      const actor = state.players[idx]
      const pawn = actor.pawnLocation
      if (!pawn) return state
      const order = actor.locations.map((l) => l.id)
      const i = order.indexOf(pawn)
      const neighbors = [order[i - 1], order[i + 1]].filter(Boolean)
      if (neighbors.length === 0) return { ...state, log: [...state.log, 'Colère Titanesque : aucun lieu voisin.'] }
      return {
        ...state,
        pendingGiantAction: { playerIndex: idx },
        log: [...state.log, `${actor.villainName} (Colère Titanesque) : choisissez un lieu voisin où agir.`],
      }
    }
    case 'AMES_EN_PERDITION': {
      // Âmes en Perdition : déplace chaque Héros portant un Pacte vers le lieu de
      // son Pacte s'il est voisin non bloqué (ce qui déclenche son élimination).
      const actor = state.players[idx]
      const targets: { id: string; to: string }[] = []
      for (const l of actor.locations) {
        const cell = actor.board[l.id] ?? []
        for (const c of cell) {
          if (c.type !== 'hero') continue
          const pacte = cell.find((x) => x.attachedTo === c.instanceId && x.contractLocationId)
          if (pacte?.contractLocationId && adjacentLocationIds(state, l.id).includes(pacte.contractLocationId)) {
            targets.push({ id: c.instanceId, to: pacte.contractLocationId })
          }
        }
      }
      let next = state
      for (const t of targets) {
        next = resolveEffect(next, { type: 'MOVE_HERO_TO_LOCATION', locationId: t.to }, { actorIndex: idx, targetHeroId: t.id })
      }
      if (targets.length === 0) {
        return { ...next, log: [...next.log, 'Âmes en Perdition : aucun Pacte déclenchable.'] }
      }
      return next
    }
    case 'ARIEL_FREEZE_ITEM': {
      // Ariel : déplace un Objet du royaume sur le lieu d'Ariel et le gèle
      // (priorité au Trident / à la Couronne — les Objets d'objectif).
      const host = ctx?.hostInstanceId
      const aLoc = ctx?.hostLocationId
      const actor = state.players[idx]
      if (!host || !aLoc) return state
      const items: { c: CardInstance; loc: string }[] = []
      for (const l of actor.locations) {
        for (const c of actor.board[l.id] ?? []) {
          if (c.type === 'item' && !c.attachedTo) items.push({ c, loc: l.id })
        }
      }
      if (items.length === 0) {
        return { ...state, log: [...state.log, 'Ariel : aucun Objet à geler.'] }
      }
      const chosen = items.find((x) => x.c.cardId === 'trident' || x.c.cardId === 'couronne') ?? items[0]
      const moved: CardInstance = { ...chosen.c, frozenBy: host }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: Object.fromEntries(
          p.locations.map((l) => {
            let cards = (p.board[l.id] ?? []).filter((c) => c.instanceId !== chosen.c.instanceId)
            if (l.id === aLoc) cards = [...cards, moved]
            return [l.id, cards]
          }),
        ),
      }))
      return {
        ...next,
        log: [...next.log, `Ariel déplace **${chosen.c.name}** sur son lieu et le gèle (Ursula ne peut plus le déplacer).`],
      }
    }
    case 'TOGGLE_URSULA_LOCK': {
      // Ursula : le Cadenas se déplace entre le Palais et le Repaire (un seul
      // bloqué à la fois). On bascule vers l'AUTRE des deux.
      const p = state.players[idx]
      const locked = p.lockedLocations ?? []
      const dest = locked.includes('palais') ? 'repaire' : 'palais'
      const next = updatePlayer(state, idx, (pp) => ({ ...pp, lockedLocations: [dest] }))
      return {
        ...next,
        log: [
          ...next.log,
          `${p.villainName} déplace le Cadenas sur ${dest === 'palais' ? 'le Palais' : "le Repaire d'Ursula"}.`,
        ],
      }
    }
    case 'TRANSFORM_GUARDS': {
      // Par ordre de la Reine ! : ouvre la sélection de 1 ou 2 Cartes Gardes à
      // transformer en arceaux. Sans Carte Garde éligible, l'effet ne fait rien.
      const eligible = transformableGuards(state, idx)
      if (eligible.length === 0) {
        return {
          ...state,
          log: [...state.log, `${state.players[idx].villainName} n'a aucune Carte Garde à transformer.`],
        }
      }
      return {
        ...state,
        pendingTransformWickets: { playerIndex: idx, max: Math.min(effect.max, eligible.length) },
      }
    }
    case 'HYPNOTIZE_HERO': {
      // Jafar — Hypnose : le Héros ciblé passe sous le contrôle de l'acteur
      // (marqué `hypnotized`). Il compte désormais comme un Allié.
      const target = ctx?.targetHeroId
      if (!target) throw new Error('HYPNOTIZE_HERO nécessite un Héros cible.')
      const actor = state.players[idx]
      const heroLoc = locationOfCard(actor, target)
      if (!heroLoc) throw new Error('Héros à hypnotiser introuvable dans le royaume.')
      const hero = actor.board[heroLoc].find((c) => c.instanceId === target)!
      if (hero.type !== 'hero') throw new Error(`${hero.name} n'est pas un Héros.`)
      // Hypnotiser un Héros est traité comme « éliminer un Héros » pour les
      // déclencheurs adverses (Obsession, Méchanceté, Crise d'hystérie) : on
      // mémorise la force EFFECTIVE du Héros au moment de l'hypnose.
      const hypnoStrength = effectiveStrength(state, idx, target) ?? hero.strength ?? 0
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [heroLoc]: p.board[heroLoc].map((c) =>
            c.instanceId === target ? { ...c, hypnotized: true } : c,
          ),
        },
      }))
      return {
        ...next,
        lastVanquishedHeroStrength: Math.max(next.lastVanquishedHeroStrength ?? 0, hypnoStrength),
        log: [
          ...next.log,
          `${actor.villainName} hypnotise **${hero.name}** (force ${hypnoStrength}) : il devient un Allié sous son contrôle.`,
        ],
      }
    }
    case 'MOVE_TITAN_INTERACTIVE': {
      // Hadès — Préparez-vous au combat ! : ouvre le choix d'un Titan non entravé
      // (déplaçable) et d'un lieu de destination (pendingTitanMove). Sans Titan
      // déplaçable, l'effet ne fait rien.
      const actor = state.players[idx]
      // Payant : il faut pouvoir financer au moins 1 lieu (2 JT), sinon l'effet ne
      // fait rien (évite un état bloqué sans résolution possible).
      if (effect.paid && actor.power < 2) {
        return { ...state, log: [...state.log, 'Préparez-vous au combat ! : Pouvoir insuffisant pour déplacer un Titan.'] }
      }
      const candidates = Object.values(actor.board)
        .flat()
        .filter((c) => c.isTitan && !c.trapped && titanReachableDests(state, idx, c.instanceId, effect.maxSteps).length > 0)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, 'Préparez-vous au combat ! : aucun Titan déplaçable.'] }
      }
      return {
        ...state,
        pendingTitanMove: {
          playerIndex: idx,
          titanCandidateIds: candidates.map((c) => c.instanceId),
          paid: effect.paid,
          maxSteps: effect.maxSteps,
        },
        log: [...state.log, `${actor.villainName} : choisissez un Titan à déplacer (Préparez-vous au combat !).`],
      }
    }
    case 'UNTRAP_TITANS_PAY': {
      // Alignement des planètes : désentrave les Titans entravés que l'acteur peut
      // se payer (1 JT chacun), des plus avancés vers Les Enfers.
      const actor = state.players[idx]
      const order = actor.locations.map((l) => l.id)
      const trapped: { id: string; name: string; i: number }[] = []
      order.forEach((locId, i) => {
        for (const c of actor.board[locId] ?? []) if (c.isTitan && c.trapped) trapped.push({ id: c.instanceId, name: c.name, i })
      })
      trapped.sort((a, b) => b.i - a.i) // les plus avancés d'abord
      const affordable = trapped.slice(0, actor.power)
      if (affordable.length === 0) {
        return { ...state, log: [...state.log, 'Alignement des planètes : aucun Titan entravé à désentraver (ou Pouvoir insuffisant).'] }
      }
      let next = state
      for (const t of affordable) next = patchCard(next, idx, t.id, (c) => ({ ...c, trapped: false }))
      next = updatePlayer(next, idx, (p) => ({ ...p, power: p.power - affordable.length }))
      return {
        ...next,
        log: [...next.log, `${actor.villainName} désentrave ${affordable.length} Titan(s) (−${affordable.length} JT) : ${affordable.map((t) => t.name).join(', ')}.`],
      }
    }
    case 'GAIN_POWER_PER_TYPE_IN_DISCARD': {
      const actor = state.players[idx]
      const n = actor.discard.filter((c) => c.type === effect.cardType).length
      const gross = n * effect.amount
      const gained = Math.max(0, gross - realmPowerPenalty(state, idx))
      let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      next = { ...next, log: [...next.log, `${next.players[idx].villainName} gagne ${gained} JT (${n} carte(s) en défausse).`] }
      return pushRobinSteal(next, idx, gross - gained)
    }
    case 'REDUCE_HERO_STRENGTH_TEMP': {
      // Talon d'Achille : −amount à la force du Héros cible jusqu'à la fin du tour.
      const target = ctx?.targetHeroId
      if (!target) return state
      const actor = state.players[idx]
      const loc = locationOfCard(actor, target)
      if (!loc) return state
      const hero = (actor.board[loc] ?? []).find((c) => c.instanceId === target)
      if (!hero || hero.type !== 'hero') return state
      const next = patchCard(state, idx, target, (c) => ({ ...c, tempStrengthBonus: (c.tempStrengthBonus ?? 0) - effect.amount }))
      return { ...next, log: [...next.log, `**${hero.name}** : force −${effect.amount} jusqu'à la fin du tour (Talon d'Achille).`] }
    }
    case 'TRAP_TITANS_AT_BEST_LOCATION': {
      // Éclairs (Fatalité) : entrave tous les Titans du lieu qui en porte le plus
      // (non encore entravés). Résolu sur le royaume de `idx`.
      const actor = state.players[idx]
      let bestLoc: LocationId | undefined
      let bestN = 0
      for (const l of actor.locations) {
        const n = (actor.board[l.id] ?? []).filter((c) => c.isTitan && !c.trapped).length
        if (n > bestN) { bestN = n; bestLoc = l.id }
      }
      if (!bestLoc) return { ...state, log: [...state.log, 'Éclairs : aucun Titan à entraver.'] }
      let next = state
      for (const c of actor.board[bestLoc] ?? []) {
        if (c.isTitan && !c.trapped) next = patchCard(next, idx, c.instanceId, (x) => ({ ...x, trapped: true }))
      }
      const name = findLocation(actor, bestLoc)?.name ?? bestLoc
      return { ...next, log: [...next.log, `Éclairs : ${bestN} Titan(s) entravé(s) sur **${name}**.`] }
    }
    case 'OPEN_TITAN_SELECT': {
      // Héra (entrave) / Pégase (repousse) : le joueur qui a posé la Fatalité
      // (joueur actif) choisit un Titan parmi les candidats (pendingTitanSelect).
      const actor = state.players[idx]
      const candidates = (effect.atHost
        ? (ctx?.hostLocationId ? (actor.board[ctx.hostLocationId] ?? []) : [])
        : Object.values(actor.board).flat()
      ).filter((c) => c.isTitan && !c.trapped)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `Aucun Titan à ${effect.kind === 'trap' ? 'entraver' : 'repousser'}.`] }
      }
      return {
        ...state,
        pendingTitanSelect: {
          playerIndex: idx,
          chooserIndex: state.activePlayer,
          titanCandidateIds: candidates.map((c) => c.instanceId),
          kind: effect.kind,
          pushSteps: effect.pushSteps,
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} choisit un Titan à ${effect.kind === 'trap' ? 'entraver' : 'repousser'}.`],
      }
    }
    case 'PUSH_TITAN_BACK_AUTO': {
      // Pégase (1) / De zéro en héros (2) : repousse le Titan non entravé le plus
      // avancé de `steps` lieux vers Les Enfers (sans déclencher ses capacités).
      const actor = state.players[idx]
      const order = actor.locations.map((l) => l.id)
      const best = mostAdvancedTitan(state, idx)
      if (!best) return { ...state, log: [...state.log, 'Aucun Titan non entravé à repousser.'] }
      const destIdx = Math.max(0, best.locIndex - effect.steps)
      if (destIdx === best.locIndex) return state
      return moveTitanTo(state, idx, best.id, order[destIdx], { fireTriggers: false })
    }
    case 'SEARCH_FATE_HERO_TO_TOP': {
      // Hermès : place Zeus sur le dessus du deck Fatalité de la cible. S'il est
      // déjà dans le royaume, le déplace vers le lieu portant le plus de Titans.
      const actor = state.players[idx]
      const inRealm = Object.values(actor.board).flat().find((c) => c.type === 'hero' && c.cardId === effect.heroCardId)
      if (inRealm) {
        // Zeus déjà en jeu : le joueur qui pose la Fatalité le déplace où il veut.
        return {
          ...state,
          pendingHeroRelocate: {
            chooserIndex: state.activePlayer,
            targetIndex: idx,
            anyLocation: true,
            candidateIds: [inRealm.instanceId],
          },
          log: [...state.log, `${state.players[state.activePlayer].villainName} peut déplacer Zeus (Hermès).`],
        }
      }
      const fromDeck = actor.fateDeck.find((c) => c.cardId === effect.heroCardId)
      const fromDisc = actor.fateDiscard.find((c) => c.cardId === effect.heroCardId)
      const zeus = fromDeck ?? fromDisc
      if (!zeus) return { ...state, log: [...state.log, `Hermès : ${effect.heroCardId} introuvable.`] }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        fateDeck: [zeus, ...p.fateDeck.filter((c) => c.instanceId !== zeus.instanceId)],
        fateDiscard: p.fateDiscard.filter((c) => c.instanceId !== zeus.instanceId),
      }))
      return { ...next, log: [...next.log, `Hermès place **${zeus.name}** sur le dessus du deck Fatalité.`] }
    }
    case 'MOVE_HERO_FROM_HOST_ANYWHERE': {
      // Mégara (à la pose) : le joueur qui pose la Fatalité déplace un Héros (autre
      // qu'elle) du lieu hôte vers n'importe quel lieu (pendingHeroRelocate).
      const loc = ctx?.hostLocationId
      const host = ctx?.hostInstanceId
      if (!loc) return state
      const actor = state.players[idx]
      const heroes = (actor.board[loc] ?? []).filter((c) => c.type === 'hero' && c.instanceId !== host)
      if (heroes.length === 0) return state
      return {
        ...state,
        pendingHeroRelocate: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          anyLocation: true,
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...state.log, `${state.players[state.activePlayer].villainName} peut déplacer un Héros (Mégara).`],
      }
    }
    case 'REVEAL_VILLAIN_UNTIL_TYPE': {
      // Œil des Moires : dévoile la pioche Vilain jusqu'à une carte du type voulu
      // (Allié, Titans inclus), l'ajoute à la main, défausse les autres dévoilées.
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (true) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        revealed.push(top)
        if (top.type === effect.cardType) {
          found = top
          break
        }
      }
      const others = revealed.filter((c) => c !== found)
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        deck,
        discard: [...disc, ...others],
        hand: found ? [...p.hand, found] : p.hand,
      }))
      next = { ...next, rngState: s }
      return {
        ...next,
        log: [...next.log, found ? `${actor.villainName} ajoute **${found.name}** à sa main (Œil des Moires).` : `${actor.villainName} ne trouve aucun Allié (Œil des Moires).`],
      }
    }
    // ===================== Dr Facilier — Pile de l'Au-delà =====================
    case 'DIVINATION': {
      // Divination : seulement au Royaume du vaudou. Mélange la pile, en révèle
      // `count` cartes (2 si Mama Odie est dans le royaume) et ouvre la résolution
      // (pendingDivination) — l'acteur choisit l'ordre.
      const actor = state.players[idx]
      if (actor.pawnLocation !== 'royaume-vaudou') {
        return { ...state, log: [...state.log, `${actor.villainName} : Divination n'a d'effet qu'au Royaume du vaudou.`] }
      }
      if (actor.auDela.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : la Pile de l'Au-delà est vide.`] }
      }
      const hasMamaOdie = Object.values(actor.board).flat().some(
        (c) => c.type === 'hero' && c.cardId === 'mama-odie',
      )
      const count = Math.min(hasMamaOdie ? 2 : effect.count, actor.auDela.length)
      const r = shuffle(actor.auDela, state.rngState)
      const revealed = r.result.slice(0, count)
      const rest = r.result.slice(count)
      let next = updatePlayer(state, idx, (p) => ({ ...p, auDela: rest }))
      next = {
        ...next,
        rngState: r.state,
        pendingDivination: { playerIndex: idx, cards: revealed },
        log: [
          ...next.log,
          `${actor.villainName} joue Divination${hasMamaOdie ? ' (Mama Odie : 2 cartes)' : ''} : ${revealed.length} carte${revealed.length > 1 ? 's' : ''} révélée${revealed.length > 1 ? 's' : ''} de l'Au-delà.`,
        ],
      }
      return next
    }
    case 'FATE_ALLY_TO_AUDELA': {
      // L'étoile du soir : place l'Allié le plus FORT du royaume de la cible dans
      // sa Pile de l'Au-delà (auto). Ses Objets associés partent en défausse.
      const target = state.players[idx]
      let bestLoc: LocationId | undefined
      let best: CardInstance | undefined
      for (const loc of target.locations) {
        for (const c of target.board[loc.id] ?? []) {
          if (c.type === 'ally' && !c.attachedTo && !c.isWicket && (!best || (c.strength ?? 0) > (best.strength ?? 0))) {
            best = c
            bestLoc = loc.id
          }
        }
      }
      if (!best || !bestLoc) {
        return { ...state, log: [...state.log, `L'étoile du soir : aucun Allié à placer dans l'Au-delà.`] }
      }
      const ally = best
      const loc = bestLoc
      const attached = (target.board[loc] ?? []).filter((c) => c.attachedTo === ally.instanceId)
      const removed = new Set([ally.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
        discard: [...p.discard, ...attached.map((c) => ({ ...c, attachedTo: undefined }))],
        auDela: [...p.auDela, { ...ally, attachedTo: undefined }],
      }))
      return {
        ...next,
        log: [...next.log, `L'étoile du soir : **${ally.name}** est placé dans la Pile de l'Au-delà de ${target.villainName}.`],
      }
    }
    case 'FATE_TOP_DECK_TO_AUDELA': {
      // Si près du but / Charlotte : place les `count` premières cartes de la
      // pioche Vilain de la cible dans sa Pile de l'Au-delà (auto).
      const target = state.players[idx]
      let deck = target.deck
      let disc = target.discard
      let s = state.rngState
      const taken: CardInstance[] = []
      while (taken.length < effect.count) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...others] = deck
        deck = others
        taken.push(top)
      }
      if (taken.length === 0) {
        return { ...state, log: [...state.log, `${target.villainName} : pioche vide, rien à regarder.`] }
      }
      // Le joueur qui a posé la Fatalité (state.activePlayer) regarde ces cartes et
      // choisit lesquelles vont dans l'Au-delà / l'ordre de retour (RESOLVE_FATE_SCRY).
      let next = updatePlayer(state, idx, (p) => ({ ...p, deck, discard: disc }))
      next = {
        ...next,
        rngState: s,
        pendingFateScry: { chooserIndex: state.activePlayer, targetIndex: idx, cards: taken },
        log: [
          ...next.log,
          `${state.players[state.activePlayer].villainName} regarde les ${taken.length} première${taken.length > 1 ? 's' : ''} carte${taken.length > 1 ? 's' : ''} de la pioche de ${target.villainName}.`,
        ],
      }
      return next
    }
    case 'FATE_ITEM_AT_HOST_TO_AUDELA': {
      // Joujou (à la pose) : place un Objet du lieu hôte (hors Talisman) dans la
      // Pile de l'Au-delà de la cible (auto).
      if (!ctx?.hostLocationId) return state
      const loc = ctx.hostLocationId
      const target = state.players[idx]
      // Objet du lieu hôte (hors Talisman). Esprits des masques (Allié + Objet,
      // `alsoItem`) est une cible valide.
      const item = (target.board[loc] ?? []).find(
        (c) => (c.type === 'item' || c.alsoItem) && c.cardId !== 'talisman',
      )
      if (!item) {
        return { ...state, log: [...state.log, `Joujou : aucun Objet à placer dans l'Au-delà.`] }
      }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => c.instanceId !== item.instanceId) },
        auDela: [...p.auDela, { ...item, attachedTo: undefined }],
      }))
      return {
        ...next,
        log: [...next.log, `Joujou : **${item.name}** est placé dans la Pile de l'Au-delà de ${target.villainName}.`],
      }
    }
    case 'FATE_AUDELA_TO_DECK_TOP': {
      // Big Daddy Le Bœuf (à la pose) : retire une carte de la Pile de l'Au-delà
      // (Régner en priorité, pour le différer) et la place sur le dessus de la
      // pioche Vilain de la cible (auto).
      const target = state.players[idx]
      if (target.auDela.length === 0) {
        return { ...state, log: [...state.log, `Big Daddy : la Pile de l'Au-delà est vide.`] }
      }
      const pick = target.auDela.find((c) => c.cardId === 'regner-nouvelle-orleans') ?? target.auDela[0]
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        auDela: p.auDela.filter((c) => c.instanceId !== pick.instanceId),
        deck: [pick, ...p.deck],
      }))
      return {
        ...next,
        log: [...next.log, `Big Daddy : **${pick.name}** quitte la Pile de l'Au-delà pour le dessus de la pioche de ${target.villainName}.`],
      }
    }
    case 'FATE_MOVE_ALL_HEROES_ADJACENT': {
      // Naveen (à la pose) : déplace chaque Héros du royaume de la cible vers un
      // lieu voisin (auto : le premier lieu adjacent non bloqué).
      const target = state.players[idx]
      let next = state
      for (const loc of target.locations) {
        const heroes = (next.players[idx].board[loc.id] ?? []).filter((c) => c.type === 'hero')
        for (const hero of heroes) {
          const adj = adjacentLocationIds(next, loc.id).filter(
            (d) => !(next.players[idx].lockedLocations ?? []).includes(d) && !(hero.forbiddenLocations ?? []).includes(d),
          )
          if (adj.length === 0) continue
          next = resolveEffect(next, { type: 'MOVE_HERO_TO_LOCATION', locationId: adj[0] }, {
            actorIndex: idx,
            targetHeroId: hero.instanceId,
          })
        }
      }
      return next
    }
    case 'LOOK_TOP_DRAW_DISCARD': {
      // Tour de passe-passe : révèle les `look` premières cartes de la pioche et
      // ouvre le choix (pendingLookTop) — le joueur garde `take` carte(s), le reste
      // est défaussé. Le bot résout automatiquement (enumerate + heuristique).
      const actor = state.players[idx]
      let deck = actor.deck
      let disc = actor.discard
      let s = state.rngState
      const seen: CardInstance[] = []
      while (seen.length < effect.look) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, s)
          deck = r.result
          s = r.state
          disc = []
        }
        const [top, ...others] = deck
        deck = others
        seen.push(top)
      }
      if (seen.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pioche vide (Tour de passe-passe).`] }
      }
      let next = updatePlayer(state, idx, (p) => ({ ...p, deck, discard: disc }))
      next = {
        ...next,
        rngState: s,
        pendingLookTop: { playerIndex: idx, cards: seen, take: Math.min(effect.take, seen.length) },
        log: [...next.log, `${actor.villainName} regarde les ${seen.length} première${seen.length > 1 ? 's' : ''} carte${seen.length > 1 ? 's' : ''} de sa pioche (Tour de passe-passe).`],
      }
      return next
    }
    case 'TAKE_FROM_AUDELA_TO_HAND': {
      // Désespoir : prend une carte de la Pile de l'Au-delà (carte clé en
      // priorité) et l'ajoute à la main de l'acteur.
      const actor = state.players[idx]
      if (actor.auDela.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : la Pile de l'Au-delà est vide (Désespoir).`] }
      }
      const ranked = [...actor.auDela].sort((a, b) => auDelaKeyPriority(b) - auDelaKeyPriority(a))
      const pick = ranked[0]
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        auDela: p.auDela.filter((c) => c.instanceId !== pick.instanceId),
        hand: [...p.hand, pick],
      }))
      return {
        ...next,
        log: [...next.log, `${actor.villainName} récupère **${pick.name}** de la Pile de l'Au-delà (Désespoir).`],
      }
    }
    case 'RECOVER_TYPE_FROM_DISCARD': {
      // Terreur : récupère une carte d'un des `types` dans la défausse (Événement
      // en priorité, sinon carte clé) et l'ajoute à la main de l'acteur.
      const actor = state.players[idx]
      const candidates = actor.discard.filter((c) => effect.types.includes(c.type))
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : rien à récupérer dans la défausse (Terreur).`] }
      }
      const ranked = [...candidates].sort((a, b) => auDelaKeyPriority(b) - auDelaKeyPriority(a))
      const pick = ranked[0]
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        discard: p.discard.filter((c) => c.instanceId !== pick.instanceId),
        hand: [...p.hand, pick],
      }))
      return {
        ...next,
        log: [...next.log, `${actor.villainName} récupère **${pick.name}** de sa défausse (Terreur).`],
      }
    }

    // ----- Bowser : mécanique des Étoiles -----------------------------------
    case 'RETURN_STAR_TO_OBSERVATORY': {
      const actor = state.players[idx]
      // No-op pour un joueur sans Observatoire (pas Bowser).
      if (actor.starLocationId === undefined || actor.observatoryStars === undefined) return state
      // On NE remet QUE des Étoiles actuellement posées sur des Alliés (les seules
      // récupérables). Une Étoile sur un Allié défaussé est hors-jeu et n'existe
      // plus → rien à reprendre. Sans Étoile sur un Allié → la carte ne fait rien.
      // On retire `amount` Étoile(s) en partant du 1ᵉʳ Allié porteur trouvé (côté
      // adversaire/bot : « choisir » l'Allié ; les autres Alliés ne sont pas touchés).
      let remaining = effect.amount
      const board: typeof actor.board = {}
      for (const locId of Object.keys(actor.board)) {
        board[locId] = (actor.board[locId] ?? []).map((c) => {
          if (remaining > 0 && c.type === 'ally' && (c.stars ?? 0) > 0) {
            const take = Math.min(c.stars ?? 0, remaining)
            remaining -= take
            return { ...c, stars: (c.stars ?? 0) - take }
          }
          return c
        })
      }
      const returned = effect.amount - remaining
      if (returned === 0) {
        return {
          ...state,
          log: [...state.log, `${actor.villainName} : aucune Étoile sur un Allié — rien à remettre à l'Observatoire.`],
        }
      }
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({ ...p, observatoryStars: (p.observatoryStars ?? 0) + returned, board }),
      )
      const np = next.players[idx]
      const s = returned > 1 ? 's' : ''
      return {
        ...next,
        log: [...next.log, `${np.villainName} : ${returned} Étoile${s} reprise${s} sur un Allié et remise${s} à l'Observatoire (total : ${np.observatoryStars}).`],
      }
    }
    case 'LOSE_POWER': {
      const actor = state.players[idx]
      const lost = Math.min(actor.power, effect.amount)
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: Math.max(0, p.power - effect.amount) }))
      const np = next.players[idx]
      return { ...next, log: [...next.log, `${np.villainName} perd ${lost} JT (total : ${np.power}).`] }
    }
    case 'DRAIN_STAR_TO_ALLY': {
      const actor = state.players[idx]
      if ((actor.observatoryStars ?? 0) <= 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : l'Observatoire est déjà épuisé, rien à drainer.`] }
      }
      // Harmonie : tant qu'elle est présente, l'Observatoire garde au moins 1 Étoile.
      if (harmonieKeepsLastStar(actor)) {
        return { ...state, log: [...state.log, `Harmonie veille : l'Observatoire doit garder au moins une Étoile.`] }
      }
      // L'Étoile se place sur un Allié situé sur l'OBSERVATOIRE (d'où elle provient).
      const loc = actor.starLocationId
      if (loc == null) return state
      const cell = actor.board[loc] ?? []
      const allyId = ctx?.allyInstanceIds?.[0]
      const target = allyId
        ? cell.find((c) => c.instanceId === allyId && c.type === 'ally')
        : cell.find((c) => c.type === 'ally' && !c.isWicket)
      if (!target) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Allié sur l'Observatoire pour recevoir l'Étoile.`] }
      }
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({
          ...p,
          observatoryStars: (p.observatoryStars ?? 0) - 1,
          board: {
            ...p.board,
            [loc]: (p.board[loc] ?? []).map((c) =>
              c.instanceId === target.instanceId ? { ...c, stars: (c.stars ?? 0) + 1 } : c,
            ),
          },
        }),
      )
      const np = next.players[idx]
      return {
        ...next,
        log: [...next.log, `${np.villainName} draine une Étoile de l'Observatoire vers **${target.name}** (reste ${np.observatoryStars} à l'Observatoire).`],
      }
    }
    case 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY': {
      const actor = state.players[idx]
      const loc = ctx?.hostLocationId
      const hostId = ctx?.hostInstanceId
      // Uniquement si l'Allié hôte est posé SUR l'Observatoire et qu'il y a une Étoile.
      if (loc === undefined || hostId === undefined || loc !== actor.starLocationId) return state
      if ((actor.observatoryStars ?? 0) <= 0) return state
      if (harmonieKeepsLastStar(actor)) {
        return { ...state, log: [...state.log, `Harmonie veille : l'Observatoire garde sa dernière Étoile.`] }
      }
      const host = (actor.board[loc] ?? []).find((c) => c.instanceId === hostId)
      if (!host) return state
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({
          ...p,
          observatoryStars: (p.observatoryStars ?? 0) - 1,
          board: {
            ...p.board,
            [loc]: (p.board[loc] ?? []).map((c) =>
              c.instanceId === hostId ? { ...c, stars: (c.stars ?? 0) + 1 } : c,
            ),
          },
        }),
      )
      const np = next.players[idx]
      return {
        ...next,
        log: [...next.log, `**${host.name}** prend une Étoile de l'Observatoire (reste ${np.observatoryStars}).`],
      }
    }
    case 'DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST': {
      const loc = ctx?.hostLocationId
      if (loc === undefined) return state
      const actor = state.players[idx]
      const cell = actor.board[loc] ?? []
      const allies = cell.filter((c) => c.type === 'ally' && !c.isWicket)
      if (allies.length === 0) return state
      const allyIds = new Set(allies.map((c) => c.instanceId))
      // Objets associés à ces Alliés → défaussés avec eux.
      const attached = cell.filter((c) => c.attachedTo && allyIds.has(c.attachedTo))
      const removed = new Set([...allyIds, ...attached.map((c) => c.instanceId)])
      const starsReturned = allies.reduce((n, c) => n + (c.stars ?? 0), 0)
      const next = updatePlayer(state, idx, (p) =>
        syncObservatoryLock({
          ...p,
          board: { ...p.board, [loc]: (p.board[loc] ?? []).filter((c) => !removed.has(c.instanceId)) },
          // Les Étoiles portées repartent à l'Observatoire (on les retire des cartes).
          discard: [...p.discard, ...allies.map((c) => ({ ...c, stars: undefined })), ...attached],
          observatoryStars:
            p.observatoryStars !== undefined ? p.observatoryStars + starsReturned : p.observatoryStars,
        }),
      )
      const sr = starsReturned > 1 ? 's' : ''
      const tail =
        starsReturned > 0 ? ` ; ${starsReturned} Étoile${sr} remise${sr} à l'Observatoire` : ''
      return {
        ...next,
        log: [...next.log, `Luigi défausse ${allies.length} Allié${allies.length > 1 ? 's' : ''} de son lieu${tail}.`],
      }
    }
    case 'CAPTURE_PEACH': {
      const actor = state.players[idx]
      let peachLoc: LocationId | undefined
      let peach: CardInstance | undefined
      for (const l of actor.locations) {
        const found = (actor.board[l.id] ?? []).find(
          (c) => c.type === 'hero' && c.cardId === effect.peachCardId,
        )
        if (found) { peachLoc = l.id; peach = found; break }
      }
      if (!peach || !peachLoc) {
        return { ...state, log: [...state.log, `${actor.villainName} : Peach n'est pas en jeu, impossible de la capturer.`] }
      }
      // Peach quitte le plateau (capturée) : elle + ses Objets associés → défausse
      // Fatalité, et le drapeau de capture est posé (condition de victoire).
      const ploc = peachLoc
      const attached = (actor.board[ploc] ?? []).filter((c) => c.attachedTo === peach!.instanceId)
      const removed = new Set([peach.instanceId, ...attached.map((c) => c.instanceId)])
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        peachCaptured: true,
        board: { ...p.board, [ploc]: (p.board[ploc] ?? []).filter((c) => !removed.has(c.instanceId)) },
        fateDiscard: [...p.fateDiscard, { ...peach!, attachedTo: undefined }, ...attached],
      }))
      return { ...next, log: [...next.log, `${next.players[idx].villainName} capture **Peach** !`] }
    }
    case 'IMPUISSANCE_RESOLVE': {
      // Choix de la carte Impuissance : un Héros cible → on l'élimine (≤ maxStrength) ;
      // sinon → on capture Peach.
      if (ctx?.targetHeroId) {
        return resolveEffect(state, { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: effect.maxStrength }, ctx)
      }
      return resolveEffect(state, { type: 'CAPTURE_PEACH', peachCardId: effect.peachCardId }, ctx)
    }
    case 'RECOVER_ANY_FROM_DISCARD': {
      // Te revoilà ! : reprend en main une carte QUELCONQUE de la défausse (choix).
      const actor = state.players[idx]
      if (actor.discard.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : défausse vide, rien à récupérer.`] }
      }
      return {
        ...state,
        pendingRecover: { playerIndex: idx, candidateIds: actor.discard.map((c) => c.instanceId) },
        log: [...state.log, `${actor.villainName} récupère une carte de sa défausse (Te revoilà !).`],
      }
    }
    case 'REVEAL_UNTIL_PLAY_ALLY_OR_ITEM': {
      // Vol du château : dévoile jusqu'à un Allié/Objet, remet les autres dévoilées
      // sur le dessus de la pioche, PUIS ouvre le choix du lieu (pendingCastleTheft,
      // affiché des deux côtés). La pose effective se fait à la résolution.
      const actor = state.players[idx]
      let deck = [...actor.deck]
      let disc = [...actor.discard]
      let rng = state.rngState
      const revealed: CardInstance[] = []
      let found: CardInstance | undefined
      while (!found) {
        if (deck.length === 0) {
          if (disc.length === 0) break
          const r = shuffle(disc, rng)
          deck = r.result
          rng = r.state
          disc = []
        }
        const [top, ...rest] = deck
        deck = rest
        if (top.type === 'ally' || top.type === 'item') found = top
        else revealed.push(top)
      }
      // On remet les cartes dévoilées (hors `found`) sur le dessus, dans l'ordre.
      const baseNext = updatePlayer({ ...state, rngState: rng }, idx, (p) => ({
        ...p,
        deck: [...revealed, ...deck],
        discard: disc,
      }))
      if (!found) {
        return { ...baseNext, log: [...baseNext.log, `${actor.villainName} : aucun Allié ni Objet trouvé (Vol du château).`] }
      }
      // Objet associé (à un Allié/Héros) : impossible à poser librement → ira en main.
      const toHand = found.attach === 'ally' || found.attach === 'hero'
      return {
        ...baseNext,
        pendingCastleTheft: { playerIndex: idx, found, revealed, toHand },
        log: [
          ...baseNext.log,
          `${actor.villainName} dévoile sa pioche (Vol du château) et trouve **${found.name}**.`,
        ],
      }
    }
    case 'DISCARD_ONE_ITEM': {
      // Comète farceuse (Fatalité) : défausse un Objet (non associé) du royaume cible.
      const actor = state.players[idx]
      let pickLoc: LocationId | undefined
      let pick: CardInstance | undefined
      for (const l of actor.locations) {
        const found = (actor.board[l.id] ?? []).find((c) => c.type === 'item' && !c.attachedTo)
        if (found) { pickLoc = l.id; pick = found; break }
      }
      if (!pick || !pickLoc) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Objet à défausser (Comète farceuse).`] }
      }
      const ploc = pickLoc
      // Objets associés à cet Objet (aucun en pratique) ignorés ; on défausse l'Objet.
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: { ...p.board, [ploc]: (p.board[ploc] ?? []).filter((c) => c.instanceId !== pick!.instanceId) },
        discard: [...p.discard, pick!],
      }))
      return { ...next, log: [...next.log, `Comète farceuse : **${pick.name}** est défaussé du royaume de ${actor.villainName}.`] }
    }
    case 'GAIN_POISON': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, poison: (p.poison ?? 0) + effect.amount }))
      const a = next.players[idx]
      return {
        ...next,
        log: [...next.log, `${a.villainName} prépare ${effect.amount} jeton${effect.amount > 1 ? 's' : ''} de Poison (total : ${a.poison}).`],
      }
    }
    case 'GAIN_POWER_PER_LOCATION_WITH_HERO': {
      const actor = state.players[idx]
      const n = actor.locations.filter((l) => (actor.board[l.id] ?? []).some((c) => c.type === 'hero')).length
      const gained = Math.max(0, n * effect.amount - realmPowerPenalty(state, idx))
      const next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power + gained }))
      return {
        ...next,
        log: [...next.log, `${next.players[idx].villainName} gagne ${gained} JT (${n} lieu${n > 1 ? 'x' : ''} avec un Héros).`],
      }
    }
    case 'TAKE_A_BITE': {
      // Ouvre le CHOIX du Héros à croquer (pendingTakeABite). Candidats : Héros du
      // lieu du pion, payables avec le Poison, en respectant la priorité Prof.
      const actor = state.players[idx]
      const loc = actor.pawnLocation
      if (!loc) return state
      const heroes = (actor.board[loc] ?? []).filter((c) => c.type === 'hero' && !c.hypnotized)
      if (heroes.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : aucun Héros ici à croquer (Croque !).`] }
      }
      const poison = actor.poison ?? 0
      const priorityExists = Object.values(actor.board).flat().some((c) => c.type === 'hero' && c.mustDefeatFirst)
      const pool = priorityExists ? heroes.filter((h) => h.mustDefeatFirst) : heroes
      if (priorityExists && pool.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : vous devez d’abord éliminer Prof (Croque !).`] }
      }
      const candidates = pool.filter((h) => (effectiveStrength(state, idx, h.instanceId) ?? 0) <= poison)
      if (candidates.length === 0) {
        return { ...state, log: [...state.log, `${actor.villainName} : pas assez de Poison (${poison}) pour croquer un Héros (Croque !).`] }
      }
      return {
        ...state,
        pendingTakeABite: { playerIndex: idx, candidateIds: candidates.map((h) => h.instanceId) },
        log: [...state.log, `${actor.villainName} : choisissez le Héros à croquer.`],
      }
    }
    case 'FETCH_FATE_HERO': {
      const actor = state.players[idx]
      const cottage = actor.cottageLocationId ?? 'maison-des-nains'
      const di = actor.fateDeck.findIndex((c) => c.cardId === effect.heroCardId)
      const fi = actor.fateDiscard.findIndex((c) => c.cardId === effect.heroCardId)
      let heroCard: CardInstance | undefined
      let next = state
      if (di >= 0) {
        heroCard = actor.fateDeck[di]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDeck: p.fateDeck.filter((_, i) => i !== di) }))
      } else if (fi >= 0) {
        heroCard = actor.fateDiscard[fi]
        next = updatePlayer(state, idx, (p) => ({ ...p, fateDiscard: p.fateDiscard.filter((_, i) => i !== fi) }))
      }
      if (!heroCard) {
        return { ...state, log: [...state.log, `${actor.villainName} : Héros introuvable (Miroir magique).`] }
      }
      const placed = heroCard
      next = updatePlayer(next, idx, (p) => ({
        ...p,
        board: { ...p.board, [cottage]: [...(p.board[cottage] ?? []), placed] },
      }))
      return { ...next, log: [...next.log, `Le Miroir magique fait apparaître **${placed.name}** à la Maison des Nains.`] }
    }
    case 'POISON_ON_FATE_TARGETED': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, poisonOnFateTargeted: true }))
      return {
        ...next,
        log: [...next.log, `${next.players[idx].villainName} : chaque Fatalité subie ajoutera 1 Poison (Poussière de momie).`],
      }
    }
    case 'DISCARD_POISON_PER_HERO_IN_REALM': {
      const actor = state.players[idx]
      const n = Object.values(actor.board).flat().filter((c) => c.type === 'hero').length
      const lost = Math.min(n, actor.poison ?? 0)
      if (lost === 0) return state
      const next = updatePlayer(state, idx, (p) => ({ ...p, poison: (p.poison ?? 0) - lost }))
      return { ...next, log: [...next.log, `Joyeux : ${actor.villainName} défausse ${lost} jeton${lost > 1 ? 's' : ''} de Poison.`] }
    }
    case 'DISCARD_FROM_TARGET_HAND': {
      const actor = state.players[idx]
      if (actor.hand.length === 0) {
        return { ...state, log: [...state.log, `Animaux de la forêt : ${actor.villainName} n'a aucune carte en main.`] }
      }
      // La main de la cible est RÉVÉLÉE et le joueur qui a posé la Fatalité
      // (state.activePlayer) y choisit la carte à défausser (RESOLVE_FATE_CHOICE).
      return {
        ...state,
        pendingFateChoice: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          kind: 'discard-from-hand',
          candidateIds: actor.hand.map((c) => c.instanceId),
        },
        log: [...state.log, `Animaux de la forêt : ${actor.villainName} révèle sa main ; ${state.players[state.activePlayer].villainName} choisit une carte à défausser.`],
      }
    }
    case 'LOVES_FIRST_KISS': {
      const actor = state.players[idx]
      let next = state
      const hadPoison = (actor.poison ?? 0) > 0
      if (hadPoison) {
        next = updatePlayer(next, idx, (p) => ({ ...p, poison: (p.poison ?? 0) - 1 }))
      }
      const heroes = next.players[idx].fateDiscard.filter((c) => c.type === 'hero')
      const poisonLog = hadPoison ? `${actor.villainName} défausse 1 Poison` : `${actor.villainName} n'a aucun Poison`
      if (heroes.length === 0) {
        return { ...next, log: [...next.log, `Premier baiser d'amour : ${poisonLog}.`] }
      }
      // Le joueur qui pose la Fatalité choisit le Héros de la défausse Fatalité à
      // remettre sur le dessus de la pioche Fatalité (RESOLVE_FATE_CHOICE).
      return {
        ...next,
        pendingFateChoice: {
          chooserIndex: state.activePlayer,
          targetIndex: idx,
          kind: 'fate-discard-hero-to-top',
          candidateIds: heroes.map((c) => c.instanceId),
        },
        log: [...next.log, `Premier baiser d'amour : ${poisonLog} ; ${state.players[state.activePlayer].villainName} choisit un Héros à remettre sur le dessus de la Fatalité.`],
      }
    }
    case 'BLACK_MAGIC_TUTOR': {
      // Magie noire : le joueur CHOISIT un Objet ou un Ingrédient de sa pioche ou de
      // sa défausse à reprendre en main (pendingRecover, recherche pioche+défausse),
      // puis mélange sa pioche (thenShuffle). Sans candidat → simple mélange.
      const actor = state.players[idx]
      const isTarget = (c: CardInstance) => c.type === 'item' || c.type === 'ingredient'
      const candidates = [...actor.deck, ...actor.discard].filter(isTarget)
      if (candidates.length === 0) {
        const r = shuffle(actor.deck, state.rngState)
        const next = updatePlayer(state, idx, (p) => ({ ...p, deck: r.result }))
        return {
          ...next,
          rngState: r.state,
          log: [...next.log, `Magie noire : aucun Objet/Ingrédient disponible ; ${actor.villainName} mélange sa pioche.`],
        }
      }
      return {
        ...state,
        pendingRecover: {
          playerIndex: idx,
          candidateIds: candidates.map((c) => c.instanceId),
          thenShuffle: true,
          label: 'Magie noire',
        },
        log: [...state.log, `Magie noire : ${actor.villainName} choisit un Objet ou un Ingrédient à reprendre.`],
      }
    }
    case 'DUPLICATE_INGREDIENT': {
      const actor = state.players[idx]
      const zone = actor.ingredients ?? []
      if (zone.length === 0) {
        return { ...state, log: [...state.log, `Foudre : aucun Ingrédient déjà joué à reproduire.`] }
      }
      // Le coût de Foudre = coût de l'Ingrédient reproduit : on ne propose (et ne
      // reproduit) que les Ingrédients que le joueur peut PAYER.
      const affordable = zone.filter((c) => (c.cost ?? 0) <= actor.power)
      if (affordable.length === 0) {
        return { ...state, log: [...state.log, `Foudre : pas assez de Pouvoir pour reproduire un Ingrédient.`] }
      }
      // Un seul Ingrédient payable : paiement + reproduction directe. Plusieurs :
      // le joueur CHOISIT lequel (pendingDuplicateIngredient).
      if (affordable.length === 1) {
        const pick = affordable[0]
        const cost = pick.cost ?? 0
        let next = updatePlayer(state, idx, (p) => ({ ...p, power: p.power - cost }))
        next = resolveEffects(next, pick.effects ?? [], { actorIndex: idx })
        return { ...next, log: [...next.log, `Foudre reproduit la capacité de **${pick.name}** (coût ${cost}).`] }
      }
      return {
        ...state,
        pendingDuplicateIngredient: { playerIndex: idx, candidateIds: affordable.map((c) => c.instanceId) },
        log: [...state.log, `Foudre : ${actor.villainName} choisit l'Ingrédient à reproduire.`],
      }
    }
    case 'SCREAM_OF_FRIGHT': {
      // Ouvre le CHOIX : pour chaque lieu non bloqué portant ≥ 1 Héros de force ≤ 3,
      // un déplacement possible vers chaque lieu voisin non bloqué.
      const actor = state.players[idx]
      const locked = new Set(actor.lockedLocations ?? [])
      const options: { from: LocationId; to: LocationId }[] = []
      for (const l of actor.locations) {
        if (locked.has(l.id)) continue
        const hasMovable = (actor.board[l.id] ?? []).some(
          (c) => c.type === 'hero' && (effectiveStrength(state, idx, c.instanceId) ?? 0) <= 3,
        )
        if (!hasMovable) continue
        for (const d of adjacentLocationIds(state, l.id)) {
          if (!locked.has(d)) options.push({ from: l.id, to: d })
        }
      }
      if (options.length === 0) {
        return { ...state, log: [...state.log, `Hurlement d'effroi : aucun Héros de force ≤ 3 à déplacer.`] }
      }
      return {
        ...state,
        pendingScream: { playerIndex: idx, options },
        log: [...state.log, `Hurlement d'effroi : ${actor.villainName} choisit les Héros à déplacer.`],
      }
    }
    case 'SCRY_OWN_DECK': {
      const actor = state.players[idx]
      if (actor.deck.length < 2) return state
      const top = actor.deck.slice(0, effect.count)
      const rest = actor.deck.slice(effect.count)
      const rank = (c: CardInstance) =>
        c.cardId === 'miroir-magique' ? 5 : c.type === 'ingredient' ? 4 : c.cardId === 'croque' ? 3 : c.type === 'item' ? 2 : 1
      const ordered = [...top].sort((a, b) => rank(b) - rank(a))
      const next = updatePlayer(state, idx, (p) => ({ ...p, deck: [...ordered, ...rest] }))
      return { ...next, log: [...next.log, `Vanité : ${actor.villainName} réorganise le dessus de sa pioche.`] }
    }
    case 'GRANT_REPEAT_ACTION': {
      const next = updatePlayer(state, idx, (p) => ({ ...p, repeatActionAvailable: true }))
      return {
        ...next,
        log: [...next.log, `Noir de nuit : ${next.players[idx].villainName} peut refaire une action de son lieu (hors Fatalité).`],
      }
    }
  }
}

/** Dr Facilier — priorité « carte clé » pour les choix automatiques (Tour de
 *  passe-passe, Désespoir, Terreur) : plus la valeur est haute, plus la carte est
 *  précieuse pour avancer vers l'objectif. */
function auDelaKeyPriority(c: CardInstance): number {
  switch (c.cardId) {
    case 'regner-nouvelle-orleans': return 100
    case 'talisman': return 90
    case 'divination-facilier': return 80
    case 'tour-passe-passe': return 60
    case 'canne': return 50
    case 'poudre-illusion': return 30
    default: return c.type === 'effect' ? 20 : 10
  }
}

/** Dr Facilier — une carte peut-elle entrer dans la Pile de l'Au-delà ? Le
 *  Talisman et Divination en sont explicitement exclus (mention sur la carte). */
export function canEnterAuDela(c: CardInstance): boolean {
  return c.cardId !== 'talisman' && c.cardId !== 'divination-facilier'
}

/** Bowser — Harmonie : tant qu'un Héros « harmonie » est présent dans le royaume,
 *  l'Observatoire doit garder au moins 1 Étoile → vrai s'il n'en reste qu'une (le
 *  drain de la dernière est interdit). No-op si l'Observatoire est déjà bloqué (0). */
function harmonieKeepsLastStar(actor: PlayerState): boolean {
  if ((actor.observatoryStars ?? 0) > 1) return false
  return Object.values(actor.board).some((cards) =>
    cards.some((c) => c.type === 'hero' && c.cardId === 'harmonie'),
  )
}

/** Dr Facilier — vrai si le joueur DÉTIENT le Talisman : un exemplaire de Talisman
 *  posé LIBREMENT (non associé à un Héros) dans son royaume. */
export function holdsTalisman(player: { board: Record<string, CardInstance[]> }): boolean {
  return Object.values(player.board).flat().some(
    (c) => c.cardId === 'talisman' && !c.attachedTo,
  )
}

/** Résout une liste d'effets dans l'ordre pour le même contexte. */
export function resolveEffects(
  state: GameState,
  effects: Effect[],
  ctx?: EffectContext,
): GameState {
  return effects.reduce((s, e) => resolveEffect(s, e, ctx), state)
}
