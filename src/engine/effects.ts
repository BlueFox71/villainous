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

import type { CardInstance, CurseDiscardTrigger, Effect, GameState, LocationId } from './types'
import { activePlayer, findLocation, pushDiscardShowcase, pushFloatingFx, pushRobinSteal, pushShowcase, revealFate, updateActivePlayer, updatePlayer } from './state'
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
  if (allyInstanceIds.length === 0) {
    throw new Error("Sélectionnez au moins un Allié pour éliminer.")
  }
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
    const isArchers = a.cardId === 'archers-loups'
    if (allyLoc !== heroLoc && !(isArchers && adjacents.has(allyLoc))) {
      throw new Error(`${a.name} doit être sur ${heroLocName}${isArchers ? ' ou un lieu voisin' : ''}.`)
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
  const heroForce = effectiveStrength(state, state.activePlayer, heroCard.instanceId) ?? 0
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
  if (!keepAllies) {
    for (const a of allies) {
      const attached = attachedToAllies.filter((o) => o.attachedTo === a.instanceId)
      const arcs = attached.filter((o) => o.cardId === 'arc-fleches')
      if (arcs.length > 0) {
        for (const arc of arcs) {
          removedIds.add(arc.instanceId)
          discardedAllyCards.push(arc)
        }
      } else {
        removedIds.add(a.instanceId)
        discardedAllyCards.push(a)
        for (const o of attached) {
          removedIds.add(o.instanceId)
          discardedAllyCards.push(o)
        }
      }
    }
  }
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
    power: p.power + locked + flechesCount * 2 + rouetBonus,
  }))
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
    ],
  }
  // Showcase « Vanquish » : Héros vaincu + Alliés utilisés + leurs Objets associés
  // (Arc et Flèches, Flèche d'Or) — défaussés, sauf Intimidation qui garde les
  // Alliés. Affiche aussi le gain de combat (« +N 🪙 » : Flèche d'Or +2, Rouet,
  // JT verrouillés rendus).
  const vanquishGain = locked + flechesCount * 2 + rouetBonus
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
  // Effets « à la mort » du Héros (Toby, Belle Marianne — B.3).
  return resolveEffects(next, heroCard.onVanquish ?? [], {
    actorIndex: state.activePlayer,
    hostInstanceId: heroCard.instanceId,
    hostLocationId: heroLoc,
  })
}

/** Résout un effet unique pour un joueur ACTEUR (par défaut : joueur actif). */
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
      let next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [from!]: (p.board[from!] ?? []).filter((c) => c.instanceId !== target),
          [dest]: [...(p.board[dest] ?? []), hero!],
        },
      }))
      next = {
        ...next,
        log: [...next.log, `**${hero.name}** est déplacé(e) sur **${dest}**.`],
      }
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
      const opposite = effect.size === 'shrunk' ? 'enlarged' : 'shrunk'
      // Si le Héros porte la taille opposée → retour à la normale ; sinon `size`.
      const newSize = hero.heroSize === opposite ? undefined : effect.size
      if (newSize === 'shrunk' && hero.cardId === 'loir') {
        return { ...state, log: [...state.log, 'Le Loir ne peut pas rapetisser.'] }
      }
      // Agrandir : on fixe le lieu adjacent recouvert (côté gauche/droite). On
      // privilégie un voisin non déjà entièrement recouvert (coverage non gaspillée).
      let enlargeTargetId: string | undefined
      if (newSize === 'enlarged') {
        const ids = actor.locations.map((l) => l.id)
        const i = ids.indexOf(heroLoc)
        const sides = [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id)
        enlargeTargetId =
          sides.find(
            (id) =>
              !(actor.board[id] ?? []).some(
                (c) => c.type === 'hero' && !c.hypnotized && c.heroSize !== 'shrunk',
              ),
          ) ?? sides[0]
      }
      const next = updatePlayer(state, idx, (p) => ({
        ...p,
        board: {
          ...p.board,
          [heroLoc]: p.board[heroLoc].map((c) =>
            c.instanceId === target ? { ...c, heroSize: newSize, enlargeTargetId } : c,
          ),
        },
      }))
      const verb =
        newSize === 'shrunk' ? 'rapetisse' : newSize === 'enlarged' ? 'agrandit' : 'rend à sa taille normale'
      return { ...next, log: [...next.log, `${actor.villainName} ${verb} **${hero.name}**.`] }
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
        log: [
          ...next.log,
          `${actor.villainName} hypnotise **${hero.name}** : il devient un Allié sous son contrôle.`,
        ],
      }
    }
  }
}

/** Résout une liste d'effets dans l'ordre pour le même contexte. */
export function resolveEffects(
  state: GameState,
  effects: Effect[],
  ctx?: EffectContext,
): GameState {
  return effects.reduce((s, e) => resolveEffect(s, e, ctx), state)
}
