// =============================================================================
// enumerateActions — énumération déterministe de TOUS les coups légaux du joueur
// actif (ou des résolutions de Fatalité / actions gratuites en attente).
//
// Source unique de vérité partagée par les bots : randomBot en choisit un au
// hasard, heuristicBot les score et prend le meilleur. Pure : ne mute jamais
// l'état et n'utilise aucune source d'aléa.
// =============================================================================

import type { CardInstance, GameAction, GameState, PlayerState } from '../engine/types'
import { KEY_COLORS } from '../engine/types'
import { canEnterAuDela, raiponceLocation, titanReachableDests } from '../engine/effects'
import { fateCardPlayable, FREE_PLAY_NO_ACTION_ID } from '../engine/actions'
import { VILLAIN_STRATEGY } from './villainStrategy'
import {
  adjacentLocationIds,
  allyBlockedAt,
  alliesAt,
  canFate,
  canPlaceCurseAt,
  canTakeABite,
  cardNeedsAllyMove,
  cardNeedsHeroTarget,
  cardNeedsSacrificeTarget,
  cardNeedsStarAllyTarget,
  cardNeedsVanquishTarget,
  drainStarAllies,
  activatableCards,
  cauldronBornLocations,
  effectiveCost,
  effectiveStrength,
  getAvailableActions,
  getLegalMoves,
  canCauldronExchange,
  heroPlacementLocations,
  heroesOf,
  locationOfCard,
  lotsoReducibleHeroes,
  maxBrewPoison,
  maxRevealFighters,
  movableCards,
  placementLocations,
  requiresAllyTarget,
  transformableGuards,
  flayerTunnelDiscardableAlliesAt,
  flayerTunnelDiscardsNeededAt,
} from '../engine/rules'

/** cardId des cartes CRUCIALES pour l'objectif du joueur (à NE PAS défausser par le
 *  bot) : les Objets/cartes qui doivent finir dans le royaume. Le Trident et la
 *  Couronne d'Ursula, la carte amassée (Cartes dans le royaume), la Lampe de Jafar… */
export function objectiveCriticalCardIds(p: PlayerState): Set<string> {
  const o = p.objective
  switch (o.type) {
    case 'CARDS_IN_REALM':
      return new Set([o.cardId])
    case 'CONTROL_HERO':
      return new Set([o.itemCardId])
    case 'ITEMS_AT_LOCATION':
      return new Set(o.itemCardIds)
    case 'DEPLETE_OBSERVATORY_AND_CAPTURE': {
      // Bowser : ne pas JETER ses cartes-clés pour cycler la main. Impuissance = SEULE
      // capture de Peach (et seul moyen hors-combat de vaincre un Héros ≤3 : Luigi /
      // Harmonie) ; Te revoilà (rencontre) récupère une carte-clé défaussée ; épuisement
      // d'énergie (puissance-stellaire) draine une Étoile TANT QU'IL EN RESTE ; Bowser Jr.
      // va chercher Peach tant qu'elle n'est ni capturée ni déjà dans le royaume.
      const keep = new Set<string>(['impuissance', 'rencontre'])
      if ((p.observatoryStars ?? 0) > 0) keep.add('puissance-stellaire')
      const peachInRealm = Object.values(p.board)
        .flat()
        .some((c) => c.type === 'hero' && c.cardId === 'peach')
      if (!p.peachCaptured && !peachInRealm) keep.add('bowser-jr')
      return keep
    }
    case 'KILL_FIGHTERS':
      // Tabbou : Halberd (action bonus, pièce maîtresse de tempo) et Destin (dévoiler 3
      // OU +4 Pouvoir, jamais gaspillé) ne se jettent pas pour cycler la main.
      return new Set(['halberd', 'destin'])
    default:
      return new Set<string>()
  }
}

/** Alliés capables d'éliminer un Héros depuis N'IMPORTE QUEL lieu (Team Rocket — Persian :
 *  `reachesAnyLocationVanquish`), hors le lieu du Héros (déjà comptés en local). */
function anyLocReachers(me: PlayerState, heroLocId: string) {
  return me.locations
    .filter((l) => l.id !== heroLocId)
    .flatMap((l) => (me.board[l.id] ?? []).filter((c) => !c.trapped && c.reachesAnyLocationVanquish))
}

/** Pour un Héros Fatalité qui frappe les Alliés de son lieu (Luigi contre Bowser :
 *  il défausse les Alliés de SON lieu et renvoie leurs Étoiles à l'Observatoire), on
 *  restreint les lieux candidats à celui/ceux qui MAXIMISENT le revers : d'abord le
 *  nombre d'Alliés PORTEURS d'Étoile (chaque Étoile remontée = un drain à refaire),
 *  puis le nombre d'Alliés, puis leur force. On ne peut pas s'en remettre à l'éval de
 *  l'état résultant : les Alliés visés y sont DÉJÀ défaussés (donc invisibles), et les
 *  Étoiles remontées ne bougent l'objectif adverse que si un Allié en portait. Renvoie
 *  tous les ex æquo (l'éval tranche) ; ne restreint pas si aucun lieu ne porte d'Allié. */
function bestStarAllyLocations(target: PlayerState, locs: string[]): string[] {
  const score = (locId: string) => {
    const allies = (target.board[locId] ?? []).filter(
      (c) => c.type === 'ally' && !c.isWicket && !c.attachedTo,
    )
    const starCarriers = allies.filter((a) => (a.stars ?? 0) > 0).length
    const strength = allies.reduce((n, a) => n + (a.strength ?? 0), 0)
    return starCarriers * 1000 + allies.length * 50 + strength
  }
  let best = -1
  let out: string[] = []
  for (const l of locs) {
    const s = score(l)
    if (s > best) {
      best = s
      out = [l]
    } else if (s === best) out.push(l)
  }
  return best > 0 ? out : locs
}

/** Tous les coups légaux disponibles dans l'état courant. Toujours non vide tant
 *  que la partie est en cours (END_TURN / MOVE / résolutions sont garantis). */
export function enumerateActions(state: GameState): GameAction[] {
  const me = state.players[state.activePlayer]

  // Oogie Boogie — lancer de dés en cours : confirmer, ou relancer un dé avec un
  // Dés pipés quand c'est utile (Imposteur raté → on retente d'atteindre 7).
  if (state.pendingDice) {
    const pen = state.pendingDice
    const out: GameAction[] = [{ type: 'RESOLVE_DICE' }]
    if (pen.canReroll && pen.outcome.kind === 'impostor' && pen.total < 7) {
      const dp = state.players[pen.playerIndex].hand.find((c) => c.cardId === 'des-pipes')
      if (dp) {
        const lowIdx: 0 | 1 = pen.dice[0] <= pen.dice[1] ? 0 : 1
        out.push({ type: 'RESOLVE_DICE_REROLL', instanceId: dp.instanceId, dieIndex: lowIdx })
      }
    }
    return out
  }

  // Tabbou — dévoilement : le bot retourne une tuile face cachée (au hasard), ou termine.
  if (state.pendingFighterReveal) {
    const p = state.players[state.pendingFighterReveal.playerIndex]
    const hidden = (p.fighterTiles ?? []).filter((t) => t.state === 'pile')
    // Une seule option de révélation suffit au bot (les dos sont équivalents) + arrêter.
    const out: GameAction[] = []
    if (hidden[0]) out.push({ type: 'RESOLVE_FIGHTER_REVEAL', tileId: hidden[0].id })
    out.push({ type: 'DONE_FIGHTER_REVEAL' })
    return out
  }

  // Tabbou — choix de la couleur de Combattants à tuer : une option par couleur en réserve.
  if (state.pendingFighterKillColor) {
    const p = state.players[state.pendingFighterKillColor.playerIndex]
    const colors = [...new Set((p.fighterTiles ?? []).filter((t) => t.state === 'reserve').map((t) => t.color))]
    return colors.map((color) => ({ type: 'RESOLVE_FIGHTER_KILL_COLOR', color }))
  }

  // Tabbou — Coup Fatal : tuer la tuile de la couleur la MOINS fournie (on garde les
  // grosses couleurs pour Collection/Bowser, qui tuent toute une couleur d'un coup), ou
  // terminer. Toutes les mises à mort valent 1 pour l'objectif → une seule option utile.
  if (state.pendingFighterKillFree) {
    const p = state.players[state.pendingFighterKillFree.playerIndex]
    const reserve = (p.fighterTiles ?? []).filter((t) => t.state === 'reserve')
    const counts = new Map<string, number>()
    reserve.forEach((t) => counts.set(t.color, (counts.get(t.color) ?? 0) + 1))
    const tile = [...reserve].sort((a, b) => (counts.get(a.color) ?? 0) - (counts.get(b.color) ?? 0))[0]
    const out: GameAction[] = []
    if (tile) out.push({ type: 'RESOLVE_FIGHTER_KILL_FREE', tileId: tile.id })
    out.push({ type: 'DONE_FIGHTER_KILL_FREE' })
    return out
  }

  // Tabbou — Destin : dévoiler 3 Combattants OU gagner 4 Pouvoir.
  if (state.pendingDestinChoice) {
    return [
      { type: 'RESOLVE_DESTIN_CHOICE', choice: 'reveal' },
      { type: 'RESOLVE_DESTIN_CHOICE', choice: 'power' },
    ]
  }

  // Oogie Boogie — action de royaume gratuite (Préparation de Noël ≥8) : on réutilise
  // l'énumération normale (pending levé), filtrée aux actions de lieu, + renoncer.
  if (state.pendingFreeRealmAction) {
    const FREE_OK = new Set(['EXECUTE_ACTION', 'PLAY_CARD', 'MOVE_CARD', 'MOVE_HERO', 'VANQUISH', 'ACTIVATE'])
    const opts = enumerateActions({ ...state, pendingFreeRealmAction: null, usedActionIds: [] }).filter((a) => FREE_OK.has(a.type))
    return [...opts, { type: 'SKIP_FREE_REALM_ACTION' }]
  }

  // Diablo (V2) : action gratuite armée → actions Pouvoir du lieu de Diablo, ou décliner.
  if (state.diabloFree) {
    const loc = me.locations.find((l) => l.id === state.diabloFree!.locationId)
    const out: GameAction[] = [{ type: 'DIABLO_SKIP_FREE_ACTION' }]
    if (loc) {
      const heroesHere = (me.board[loc.id] ?? []).some((c) => c.type === 'hero')
      for (const a of loc.actions) {
        if (a.type !== 'GAIN_POWER') continue
        if (a.row === 'top' && heroesHere) continue
        out.push({ type: 'DIABLO_FREE_ACTION', action: { type: 'EXECUTE_ACTION', actionId: a.id } })
      }
    }
    return out
  }

  // Gaston — action gratuite armée (Belle est à moi = Vanquish ; Tous avec moi = Déplacer).
  // On énumère les exécutions possibles (enveloppées dans PERFORM_GRANTED_ACTION) + décliner.
  if (state.grantedAction) {
    const g = state.grantedAction
    const out: GameAction[] = [{ type: 'SKIP_GRANTED_ACTION' }]
    const SID = 'granted-free-action'
    if (g.actionType === 'VANQUISH') {
      for (const loc of me.locations) {
        const cell = me.board[loc.id] ?? []
        const heroes = cell.filter((c) => c.type === 'hero')
        if (heroes.length === 0) continue
        // Tamatoa — Quelque chose qui brille protège tous les Héros de son lieu.
        if (cell.some((c) => c.shieldsHeroesAtLocation && !c.attachedTo)) continue
        const localAllies = cell.filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
        const adjAllies = adjacentLocationIds(state, loc.id).flatMap((adj) =>
          (me.board[adj] ?? []).filter(
            (c) => !c.trapped && (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers'),
          ),
        ).concat(anyLocReachers(me, loc.id))
        for (const h of heroes) {
          if (cell.some((c) => c.cardId === 'deguisement' && c.attachedTo === h.instanceId)) continue
          const heroForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
          if (heroForce === 0) {
            out.push({ type: 'PERFORM_GRANTED_ACTION', action: { type: 'VANQUISH', actionId: SID, heroInstanceId: h.instanceId, allyInstanceIds: [] } })
            continue
          }
          const usable = h.cardId === 'bobby' ? localAllies.filter((a) => a.cardId !== 'archers-loups') : [...localAllies, ...adjAllies]
          if (usable.length === 0) continue
          const allyForce = usable.reduce((n, a) => n + (effectiveStrength(state, state.activePlayer, a.instanceId) ?? 0), 0)
          if (allyForce >= heroForce) {
            out.push({ type: 'PERFORM_GRANTED_ACTION', action: { type: 'VANQUISH', actionId: SID, heroInstanceId: h.instanceId, allyInstanceIds: usable.map((a) => a.instanceId) } })
          }
        }
      }
    } else if (g.actionType === 'MOVE_ITEM_ALLY') {
      for (const { instanceId, from } of movableCards(state)) {
        for (const to of adjacentLocationIds(state, from)) {
          out.push({ type: 'PERFORM_GRANTED_ACTION', action: { type: 'MOVE_CARD', actionId: SID, instanceId, to } })
        }
      }
    } else if (g.actionType === 'PLAY_CARD') {
      // Action « Jouer une carte » gratuite (Taffyta). On se limite aux Alliés
      // abordables posés sur un lieu valide (cas robuste, sans cible/association).
      const zones = placementLocations(state)
      for (const card of me.hand) {
        if (card.type !== 'ally' || (card.cost ?? 0) > me.power) continue
        for (const to of zones) {
          out.push({ type: 'PERFORM_GRANTED_ACTION', action: { type: 'PLAY_CARD', actionId: SID, instanceId: card.instanceId, to } })
        }
      }
    }
    return out
  }

  // Gaston — retrait/replacement d'Obstacles en attente : un coup par lieu éligible,
  // plus « terminer » (le retrait est facultatif ; le replacement aussi par sécurité).
  if (state.pendingObstacle) {
    const pen = state.pendingObstacle
    const tp = state.players[pen.targetIndex]
    const out: GameAction[] = []
    for (const l of tp.locations) {
      const n = tp.obstacles?.[l.id] ?? 0
      if (pen.kind === 'remove') {
        if (n <= 0) continue
        if (pen.sameLocation && pen.lockedLocationId && pen.lockedLocationId !== l.id) continue
        out.push({ type: 'RESOLVE_OBSTACLE', locationId: l.id })
      } else {
        if (n >= 2) continue
        out.push({ type: 'RESOLVE_OBSTACLE', locationId: l.id })
      }
    }
    out.push({ type: 'DONE_OBSTACLE' })
    return out
  }

  // Le Seigneur des clés — choix d'une clé (ramasser sur le lieu du pion, ou reposer
  // une clé possédée) : une option par clé candidate. Le scoring (objectiveScore) tranche
  // — ramasser de préférence une NOUVELLE couleur, reposer de préférence un doublon.
  if (state.pendingKey) {
    const pen = state.pendingKey
    const p = state.players[pen.playerIndex]
    if (pen.kind === 'take') {
      const cands = (p.keys ?? []).filter(
        (k) =>
          k.location !== null && !k.stolenBy &&
          (pen.locationId === undefined || k.location === pen.locationId) &&
          (pen.color === undefined || k.color === pen.color),
      )
      return cands.map((k) => ({ type: 'RESOLVE_KEY', keyId: k.id }))
    }
    // 'lose' : reposer une clé possédée. Avec chooseDest, on choisit aussi le lieu
    // (un lieu < 3 clés) → une option par (clé × lieu éligible).
    const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
    if (pen.chooseDest) {
      const dests = p.locations.map((l) => l.id).filter((lid) => (p.keys ?? []).filter((k) => k.location === lid && !k.stolenBy).length < 3)
      return owned.flatMap((k) => dests.map((lid) => ({ type: 'RESOLVE_KEY' as const, keyId: k.id, locationId: lid })))
    }
    return owned.map((k) => ({ type: 'RESOLVE_KEY', keyId: k.id }))
  }

  // Le Seigneur des clés — choix d'une couleur avant lancer le dé (00:00 / Minuit) :
  // une option par couleur. Le lookahead simule le jet (rng déterministe) et garde
  // la couleur qui rapporte effectivement une clé.
  if (state.pendingKeyColor) {
    return KEY_COLORS.map((color) => ({ type: 'RESOLVE_KEY_COLOR', color }))
  }

  // Le Seigneur des clés — Plaisir ou souffrance : perdre du Pouvoir ou reposer une clé.
  if (state.pendingPlaisir) {
    return [
      { type: 'RESOLVE_PLAISIR', choice: 'power' },
      { type: 'RESOLVE_PLAISIR', choice: 'key' },
    ]
  }

  // Le Seigneur des clés — Sorcellerie / Gévaudan : l'adversaire (chooser) choisit une
  // clé possédée du Seigneur. 'steal' = une option par couleur ; 'return' = couleur × lieu.
  if (state.pendingStealKey) {
    const pen = state.pendingStealKey
    const t = state.players[pen.targetIndex]
    const owned = (t.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
    const seen = new Set<string>()
    const out: GameAction[] = []
    for (const k of owned) {
      if (seen.has(k.color)) continue
      seen.add(k.color)
      if (pen.mode === 'steal') {
        out.push({ type: 'RESOLVE_STEAL_KEY', keyId: k.id })
      } else {
        for (const l of t.locations) out.push({ type: 'RESOLVE_STEAL_KEY', keyId: k.id, locationId: l.id })
      }
    }
    return out
  }

  // Vanquish FACULTATIF en attente (Tendre un Piège / Troupeau de gnous / Uniforme) :
  // éliminer un Héros (sur le lieu imposé le cas échéant), ou terminer sans éliminer.
  // Pour l'Uniforme, l'Allié porteur DOIT figurer parmi les participants.
  if (state.pendingTrapVanquish) {
    const pv = state.pendingTrapVanquish
    const out: GameAction[] = [{ type: 'TRAP_SKIP_VANQUISH' }]
    const locs = pv.locationId ? [pv.locationId] : me.locations.map((l) => l.id)
    for (const locId of locs) {
      const cell = me.board[locId] ?? []
      const localAllies = cell.filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped && !c.attachedTo)
      const adjAllies = adjacentLocationIds(state, locId).flatMap((adj) =>
        (me.board[adj] ?? []).filter(
          (c) => !c.trapped && (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers'),
        ),
      ).concat(anyLocReachers(me, locId))
      const usable = [...localAllies, ...adjAllies]
      // Uniforme : si l'Allié porteur n'est pas disponible ici, ce lieu est inéligible.
      if (pv.requiredAllyInstanceId && !usable.some((a) => a.instanceId === pv.requiredAllyInstanceId)) continue
      for (const h of cell.filter((c) => c.type === 'hero')) {
        const guarded = cell.some((c) => c.cardId === 'deguisement' && c.attachedTo === h.instanceId)
        if (guarded) continue
        out.push({ type: 'TRAP_VANQUISH', heroInstanceId: h.instanceId, allyInstanceIds: usable.map((a) => a.instanceId) })
      }
    }
    return out
  }

  // Par ordre de la Reine ! : transformer 1 ou 2 Cartes Gardes en arceaux.
  // On énumère chaque Carte Garde seule, plus chaque paire (nombre borné : ≤4 Gardes).
  if (state.pendingTransformWickets) {
    const guards = transformableGuards(state, state.pendingTransformWickets.playerIndex)
    const max = state.pendingTransformWickets.max
    const out: GameAction[] = []
    for (let i = 0; i < guards.length; i++) {
      out.push({ type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds: [guards[i].instanceId] })
      if (max >= 2) {
        for (let j = i + 1; j < guards.length; j++) {
          out.push({
            type: 'RESOLVE_TRANSFORM_WICKETS',
            instanceIds: [guards[i].instanceId, guards[j].instanceId],
          })
        }
      }
    }
    return out // `guards` est non vide (pending posé seulement s'il y a des Gardes)
  }

  // Yzma — Beauté endormie (réveil) : choix indépendants (gagner 2 JT, piocher 2,
  // déplacer un Héros voisin). Gagner du Pouvoir et piocher est presque toujours bon
  // pour le bot : on propose donc systématiquement les deux, avec ou sans
  // déplacement de Héros (un coup par Héros du royaume × lieu voisin atteignable).
  if (state.pendingBeautySleep) {
    const out: GameAction[] = [{ type: 'RESOLVE_BEAUTY_SLEEP', gainPower: true, draw: true, heroMove: null }]
    for (const h of heroesOf(state, state.activePlayer)) {
      const from = locationOfCard(me, h.instanceId)
      if (!from) continue
      for (const to of adjacentLocationIds(state, from)) {
        out.push({ type: 'RESOLVE_BEAUTY_SLEEP', gainPower: true, draw: true, heroMove: { heroInstanceId: h.instanceId, to } })
      }
    }
    return out
  }

  // Colère Titanesque / Canne / Suivez-moi ! : choisir un lieu où agir (puis on agit
  // normalement). Suivez-moi ! (viaFollowMe) propose les lieux à Hyène listés ; les
  // autres modes proposent les lieux voisins.
  if (state.pendingGiantAction) {
    const pending = state.pendingGiantAction
    if (pending.viaFollowMe || pending.viaChristmas) {
      return (pending.locations ?? []).map((loc) => ({ type: 'RESOLVE_GIANT_LOCATION', locationId: loc }))
    }
    const p = state.players[pending.playerIndex]
    const order = p.locations.map((l) => l.id)
    const i = order.indexOf(p.pawnLocation ?? '')
    const neighbors = [order[i - 1], order[i + 1]].filter((id): id is string => !!id)
    return neighbors.map((loc) => ({ type: 'RESOLVE_GIANT_LOCATION', locationId: loc }))
  }

  // Préparez-vous au combat ! (Hadès) : un Titan non entravé × lieu atteignable
  // (filtré par ce que l'acteur peut financer si le déplacement est payant).
  if (state.pendingTitanMove) {
    const ptm = state.pendingTitanMove
    const p = state.players[ptm.playerIndex]
    const order = p.locations.map((l) => l.id)
    const out: GameAction[] = []
    for (const id of ptm.titanCandidateIds) {
      const from = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.instanceId === id))?.id
      if (!from) continue
      for (const to of titanReachableDests(state, ptm.playerIndex, id, ptm.maxSteps)) {
        const steps = Math.abs(order.indexOf(to) - order.indexOf(from))
        if (ptm.paid && p.power < (steps >= 2 ? 5 : 2)) continue
        out.push({ type: 'RESOLVE_TITAN_MOVE', titanInstanceId: id, to })
      }
    }
    // Garanti non vide : le pending n'est ouvert que si ≥1 déplacement est finançable.
    return out
  }

  // Héra / Pégase (Hadès, Fatalité) : un choix par Titan candidat (entrave / repousse).
  if (state.pendingTitanSelect) {
    return state.pendingTitanSelect.titanCandidateIds.map((id) => ({ type: 'RESOLVE_TITAN_SELECT', titanInstanceId: id }))
  }

  // Divination (Dr Facilier) : énumère les ordres de résolution possibles des
  // cartes révélées (≤ 3 → ≤ 6 permutations). Le bot choisit le meilleur (ex.
  // résoudre Régner en premier pour gagner).
  if (state.pendingDivination) {
    const ids = state.pendingDivination.cards.map((c) => c.instanceId)
    return permutations(ids).map((order) => ({ type: 'RESOLVE_DIVINATION', topInstanceIds: order }))
  }

  // Tour de passe-passe (Dr Facilier) : une option par carte révélée à garder
  // (take = 1). Le bot score chaque choix.
  if (state.pendingLookTop) {
    const plt = state.pendingLookTop
    return plt.cards.map((c) => ({ type: 'RESOLVE_LOOK_TOP', keepInstanceIds: [c.instanceId] }))
  }

  // Liste de Fidget (Ratigan) : affichage informatif, le bot l'acquitte simplement.
  if (state.pendingReveal) {
    return [{ type: 'ACKNOWLEDGE_REVEAL' }]
  }

  // Sombra — Piratage : une option par action désactivable (le bot score chacune).
  if (state.pendingHack) {
    return state.pendingHack.actionIds.map((id) => ({ type: 'RESOLVE_HACK', actionId: id }))
  }

  // Sombra — Information : garder la pioche (défausser depuis la main) ou défausser
  // les cartes piochées.
  if (state.pendingInformation) {
    return [
      { type: 'RESOLVE_INFORMATION', discardDrawn: false },
      { type: 'RESOLVE_INFORMATION', discardDrawn: true },
    ]
  }

  // La Méchante Reine — « Croque ! » : une option par Héros croquable.
  if (state.pendingTakeABite) {
    return state.pendingTakeABite.candidateIds.map((id) => ({ type: 'RESOLVE_TAKE_A_BITE', heroInstanceId: id }))
  }
  if (state.pendingGrantLove) {
    return state.pendingGrantLove.candidateIds.map((id) => ({ type: 'RESOLVE_GRANT_LOVE', heroInstanceId: id }))
  }

  // La Méchante Reine — Foudre : une option par Ingrédient reproductible.
  if (state.pendingDuplicateIngredient) {
    return state.pendingDuplicateIngredient.candidateIds.map((id) => ({ type: 'RESOLVE_DUPLICATE_INGREDIENT', ingredientInstanceId: id }))
  }

  // La Méchante Reine — Hurlement d'effroi : chaque déplacement possible + décliner.
  if (state.pendingScream) {
    const opts = state.pendingScream.options.map((o) => ({ type: 'RESOLVE_SCREAM' as const, from: o.from, to: o.to }))
    return [...opts, { type: 'RESOLVE_SCREAM' as const }]
  }

  // Si près du but / Charlotte (Dr Facilier) : le bot (adversaire) cherche à
  // remplir la Pile de l'Au-delà de « parasites » → il y place les cartes autorisées
  // et remet les autres (Talisman / Divination) sur la pioche. EXCEPTION : ne JAMAIS
  // y verser « Régner sur la Nouvelle-Orléans » — ce serait offrir la carte de victoire
  // à Facilier (il gagne en la révélant via Divination en détenant le Talisman).
  if (state.pendingFateScry) {
    const cards = state.pendingFateScry.cards
    const gift = (c: { cardId: string }) => c.cardId === 'regner-nouvelle-orleans'
    const toAudelaIds = cards.filter((c) => canEnterAuDela(c) && !gift(c)).map((c) => c.instanceId)
    const deckTopOrder = cards.filter((c) => !canEnterAuDela(c) || gift(c)).map((c) => c.instanceId)
    return [{ type: 'RESOLVE_FATE_SCRY', toAudelaIds, deckTopOrder }]
  }

  // Déplacement de Héros en attente (Apparition, Stratos, Mégara, Hermès…) :
  // un choix par (Héros candidat × destination valide). Résolu via botAct quand
  // le chooseur est le joueur actif (en jeu réel, l'UI/useEffect peut le résoudre avant).
  if (state.pendingHeroRelocate) {
    const phr = state.pendingHeroRelocate
    const tgt = state.players[phr.targetIndex]
    const ids = tgt.locations.map((l) => l.id)
    const locked = new Set(tgt.lockedLocations ?? [])
    const out: GameAction[] = []
    for (const loc of tgt.locations) {
      for (const h of (tgt.board[loc.id] ?? []).filter((c) => c.type === 'hero')) {
        if (phr.candidateIds && !phr.candidateIds.includes(h.instanceId)) continue
        const i = ids.indexOf(loc.id)
        let dests = phr.forcedLocationId !== undefined
          ? [phr.forcedLocationId].filter((id): id is string => !!id && !locked.has(id))
          : phr.forcedDirection !== undefined
          ? [ids[i + phr.forcedDirection]].filter((id): id is string => !!id && !locked.has(id))
          : phr.anyLocation
            ? ids.filter((id) => id !== loc.id && !locked.has(id))
            : [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id && !locked.has(id))
        // Mère Gothel (bot) : sa propre Raiponce (Héros-tuile) ne doit JAMAIS être
        // poussée vers la droite (vers Corona) — elle y campe = −1 Confiance au début
        // du tour. On ne garde donc que les destinations vers la gauche (vers la Tour,
        // qui rapproche de la victoire). Cas typique : Garde royal déplacé vers Corona.
        if (tgt.villain === 'gothel' && h.cardId === 'raiponce') {
          dests = dests.filter((id) => ids.indexOf(id) < i)
        }
        // Davy Jones — La Poursuite : destinations limitées aux lieux portant un Allié.
        if (phr.allowedLocationIds) {
          dests = dests.filter((id) => phr.allowedLocationIds!.includes(id))
        }
        for (const to of dests) out.push({ type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: h.instanceId, to })
      }
    }
    // Poupées vaudou : déplacement facultatif → le bot peut aussi décliner.
    if (phr.optional) out.push({ type: 'SKIP_HERO_RELOCATE' })
    if (out.length > 0) return out
  }

  // Le Piégeur — choix du Survivant (phase 'target') ou du lieu de destination (phase 'dest').
  if (state.pendingPiegeur) {
    const pp = state.pendingPiegeur
    if (pp.phase === 'target') {
      return pp.candidateIds.map((id) => ({ type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId: id }))
    }
    return (pp.destLocs ?? []).map((to) => ({ type: 'RESOLVE_PIEGEUR_DEST', to }))
  }

  // Flèche de Mome Raths : déplacer un Allié de la cible vers n'importe quel lieu
  // non bloqué (un choix par Allié candidat × destination).
  if (state.pendingAllyRelocate) {
    const par = state.pendingAllyRelocate
    const tgt = state.players[par.targetIndex]
    const ids = tgt.locations.map((l) => l.id)
    const locked = new Set(tgt.lockedLocations ?? [])
    const out: GameAction[] = []
    for (const loc of tgt.locations) {
      const li = tgt.locations.findIndex((l) => l.id === loc.id)
      for (const a of (tgt.board[loc.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)) {
        // Stari (adjacentOnly) : destinations restreintes aux lieux voisins.
        const dests = ids.filter((id, i) =>
          id !== loc.id && !locked.has(id) && (!par.adjacentOnly || Math.abs(i - li) === 1),
        )
        for (const to of dests) {
          out.push({ type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: a.instanceId, to })
        }
      }
    }
    // Go ! (facultatif) : on peut s'arrêter avant d'avoir déplacé tous les Alliés.
    if (par.optional) out.push({ type: 'SKIP_ALLY_RELOCATE' })
    if (out.length > 0) return out
  }

  // Team Rocket — un dresseur invoque l'un de ses Pokémon : un choix par candidat.
  if (state.pendingPokemonSummon) {
    return state.pendingPokemonSummon.candidateCardIds.map((cardId) => ({
      type: 'RESOLVE_POKEMON_SUMMON' as const,
      cardId,
    }))
  }

  // Team Rocket — « Oui, la guerre ! » : un choix par Pokémon à coucher.
  if (state.pendingKoPokemon) {
    return state.pendingKoPokemon.candidateIds.map((instanceId) => ({
      type: 'RESOLVE_KO_POKEMON' as const,
      instanceId,
    }))
  }

  // Pat Hibulaire — « Planqués » : un choix par Allié (Bandit) défaussable.
  if (state.pendingFateDiscardAlly) {
    return state.pendingFateDiscardAlly.candidateIds.map((instanceId) => ({
      type: 'RESOLVE_FATE_DISCARD_ALLY' as const,
      instanceId,
    }))
  }

  // Mémoire Verrouillée : choix Pouvoir OU reculer le jeton Pilote.
  if (state.pendingPowerOrRacerBack) {
    return [
      { type: 'RESOLVE_POWER_OR_RACER_BACK', choice: 'power' },
      { type: 'RESOLVE_POWER_OR_RACER_BACK', choice: 'racer' },
    ]
  }

  // Taffyta Crème Brûlée : choix reculer le Pilote de 2 OU action Jouer une carte gratuite.
  if (state.pendingTaffytaChoice) {
    return [
      { type: 'RESOLVE_TAFFYTA_CHOICE', choice: 'racer-back' },
      { type: 'RESOLVE_TAFFYTA_CHOICE', choice: 'play-card' },
    ]
  }

  // Aigre Bill : fouiller la pioche Méchant (bénéfique) ou renoncer.
  if (state.pendingAigreBill) {
    return [
      { type: 'RESOLVE_AIGRE_BILL', dig: true },
      { type: 'RESOLVE_AIGRE_BILL', dig: false },
    ]
  }

  // L'important, c'est de payer : choisir combien de Pouvoir dépenser (1..max).
  if (state.pendingPayRace) {
    const out: GameAction[] = []
    for (let n = 1; n <= state.pendingPayRace.max; n++) out.push({ type: 'RESOLVE_PAY_RACE', amount: n })
    return out
  }

  // Mr. Monopoly — Affaire : choisir combien de maisons poser (1..max).
  if (state.pendingBuyHouses) {
    const out: GameAction[] = []
    for (let n = 1; n <= state.pendingBuyHouses.max; n++) out.push({ type: 'RESOLVE_BUY_HOUSES', amount: n })
    return out
  }

  // Mr. Monopoly — Libéré de prison : envoyer Mr. Monopoly en Prison, ou déplacer un Héros.
  if (state.pendingFreeFromJail) {
    const pj = state.pendingFreeFromJail
    const target = state.players[pj.targetIndex]
    const out: GameAction[] = [{ type: 'RESOLVE_FREE_FROM_JAIL', toPrison: true }]
    const heroes = Object.values(target.board).flat().filter((c) => c.type === 'hero')
    for (const h of heroes) {
      for (const l of target.locations) {
        out.push({ type: 'RESOLVE_FREE_FROM_JAIL', heroInstanceId: h.instanceId, locationId: l.id })
      }
    }
    return out
  }

  // Mr. Monopoly — Reculez de trois cases : choisir le lieu de destination du pion.
  if (state.pendingBackwardMove) {
    const me = state.players[state.pendingBackwardMove.playerIndex]
    return me.locations.map((l) => ({ type: 'RESOLVE_BACKWARD_MOVE', locationId: l.id }))
  }

  // Mr. Monopoly — Canne : choisir l'action empruntée.
  if (state.pendingCanneBorrow) {
    return state.pendingCanneBorrow.options.map((o) => ({ type: 'RESOLVE_CANNE_BORROW', locationId: o.locationId, actionId: o.actionId }))
  }

  // Mr. Monopoly — Carte bancaire / destruction : choisir un lieu (source ou destination).
  if (state.pendingMoveHouses) {
    const pmh = state.pendingMoveHouses
    const mm = state.players[pmh.playerIndex]
    const opp = state.players[pmh.playerIndex === 0 ? 1 : 0]
    const out: GameAction[] = []
    for (const l of opp.locations) {
      const count = mm.houses?.[l.id] ?? 0
      if (pmh.phase === 'from') {
        if (count > 0) out.push({ type: 'RESOLVE_MOVE_HOUSES', locationId: l.id })
      } else {
        // destination : non plein (plafond 5 = hôtel) et différent de la source
        if (count < 5 && l.id !== pmh.from) out.push({ type: 'RESOLVE_MOVE_HOUSES', locationId: l.id })
      }
    }
    return out
  }

  // Princesse Vanellope : le fataliseur recule le pion King Candy de 0 à max.
  if (state.pendingPawnBack) {
    const out: GameAction[] = []
    for (let n = 0; n <= state.pendingPawnBack.max; n++) out.push({ type: 'RESOLVE_PAWN_BACK', amount: n })
    return out
  }

  // Shere Khan — Tout le monde fuit : choisir Activer une capacité OU Éliminer un Héros.
  if (state.pendingActivateOrVanquish) {
    return [
      { type: 'RESOLVE_ACTIVATE_OR_VANQUISH', choice: 'vanquish' },
      { type: 'RESOLVE_ACTIVATE_OR_VANQUISH', choice: 'activate' },
    ]
  }

  // Le Flagelleur Mental — Will sous emprise : choisir le deck à consulter. On n'émet que
  // les options VALIDES (deck non vide ; Fatalité seulement si le +1 Pouvoir est finançable).
  if (state.pendingScryDeckChoice) {
    const p = state.players[state.pendingScryDeckChoice.playerIndex]
    const out: GameAction[] = []
    if (p.deck.length > 0) out.push({ type: 'RESOLVE_SCRY_DECK_CHOICE', deck: 'villain' })
    if (p.fateDeck.length > 0 && p.power >= state.pendingScryDeckChoice.fateExtraCost) {
      out.push({ type: 'RESOLVE_SCRY_DECK_CHOICE', deck: 'fate' })
    }
    // Filet de sécurité : si aucune option valide (ne devrait pas arriver, la jouabilité
    // le garantit), consulter le Méchant (no-op géré par le moteur) pour ne pas bloquer.
    if (out.length === 0) out.push({ type: 'RESOLVE_SCRY_DECK_CHOICE', deck: 'villain' })
    return out
  }

  // Pyramid Head — Pacte de Sang : choisir une carte de la main (dont le type a un
  // équivalent en défausse) à défausser.
  if (state.pendingPacteSang) {
    const typesInDiscard = new Set(me.discard.map((c) => c.type))
    const out = me.hand
      .filter((c) => typesInDiscard.has(c.type))
      .map((c) => ({ type: 'RESOLVE_PACTE_SANG', instanceId: c.instanceId }) as GameAction)
    return out.length > 0 ? out : me.hand.map((c) => ({ type: 'RESOLVE_PACTE_SANG', instanceId: c.instanceId }))
  }

  // Pyramid Head — Cage de l'Expiation : choisir le lieu où déplacer le Héros enfermé.
  if (state.pendingCageMove) {
    const me2 = state.players[state.pendingCageMove.playerIndex]
    let from: string | undefined
    for (const l of me2.locations) if ((me2.board[l.id] ?? []).some((c) => c.instanceId === state.pendingCageMove!.heroInstanceId)) { from = l.id; break }
    return me2.locations.filter((l) => l.id !== from).map((l) => ({ type: 'RESOLVE_CAGE_MOVE', locationId: l.id }))
  }

  // Pyramid Head — Sacrifice Humain : choisir « regarder 3 / garder 1 » ou « gagner 2 ».
  if (state.pendingSacrifice) {
    return [
      { type: 'RESOLVE_SACRIFICE', choice: 'look' },
      { type: 'RESOLVE_SACRIFICE', choice: 'gain' },
    ]
  }

  // Shere Khan — Aie confiance : choisir des cartes de la défausse à récupérer (ou terminer).
  if (state.pendingRecoverToDeck) {
    const chosen = new Set(state.pendingRecoverToDeck.chosen)
    const out: GameAction[] = [{ type: 'RESOLVE_RECOVER_TO_DECK', done: true }]
    for (const c of me.discard) if (!chosen.has(c.instanceId)) out.push({ type: 'RESOLVE_RECOVER_TO_DECK', instanceId: c.instanceId })
    return out
  }

  // Shere Khan — C'est très intéressant : choisir une action restante (ou terminer).
  if (state.pendingInteressant) {
    const done = new Set(state.pendingInteressant.done)
    const out: GameAction[] = [{ type: 'RESOLVE_INTERESSANT', done: true }]
    for (const opt of ['power', 'draw', 'fire'] as const) {
      if (!done.has(opt)) out.push({ type: 'RESOLVE_INTERESSANT', option: opt })
    }
    return out
  }

  // Shere Khan — Kaa : choisir un Objet abordable de la défausse à jouer.
  if (state.pendingKaaPlay) {
    return me.discard
      .filter((c) => c.type === 'item' && (c.cost ?? 0) <= me.power)
      .map((c) => ({ type: 'RESOLVE_KAA_PLAY', instanceId: c.instanceId }))
  }

  // Shere Khan — Le Roi Singe : phase 1 choix du Macaque, phase 2 choix du lieu.
  if (state.pendingMonkeyKing) {
    if (!state.pendingMonkeyKing.macaqueInstanceId) {
      const ids: string[] = []
      for (const loc of me.locations) for (const c of me.board[loc.id] ?? []) if (c.cardId === 'macaques') ids.push(c.instanceId)
      return ids.map((id) => ({ type: 'RESOLVE_MONKEY_KING', macaqueInstanceId: id }))
    }
    return me.locations.map((l) => ({ type: 'RESOLVE_MONKEY_KING', to: l.id }))
  }

  // Shere Khan — Kaa (bouclier) : sacrifier un Objet associé, ou laisser Kaa être défaussé.
  if (state.pendingKaaShield) {
    return [
      ...state.pendingKaaShield.itemInstanceIds.map((id) => ({ type: 'RESOLVE_KAA_SHIELD', itemInstanceId: id } as GameAction)),
      { type: 'RESOLVE_KAA_SHIELD', decline: true },
    ]
  }

  // Davy Jones — poser un jeton Trésor : phase 1 choix du Héros, phase 2 choix du Trésor.
  if (state.pendingPlaceTreasure) {
    if (!state.pendingPlaceTreasure.heroInstanceId) {
      const heroes: GameAction[] = []
      for (const loc of me.locations) for (const c of me.board[loc.id] ?? []) {
        if (c.type === 'hero' && !c.treasure) heroes.push({ type: 'RESOLVE_PLACE_TREASURE', heroInstanceId: c.instanceId })
      }
      return heroes
    }
    return (me.treasureReserve ?? []).map((tid) => ({ type: 'RESOLVE_PLACE_TREASURE', treasureId: tid }))
  }
  // Davy Jones — révéler un jeton Trésor (parmi les candidats).
  if (state.pendingRevealTreasure) {
    return state.pendingRevealTreasure.candidateIds.map((id) => ({ type: 'RESOLVE_REVEAL_TREASURE', heroInstanceId: id }))
  }
  // Davy Jones — Les amis : choisir le Héros source (avec trésor) puis cible.
  if (state.pendingMoveSwapTreasure) {
    const out: GameAction[] = []
    for (const loc of me.locations) for (const c of me.board[loc.id] ?? []) {
      if (c.type !== 'hero') continue
      if (!state.pendingMoveSwapTreasure.fromHeroId) {
        if (c.treasure) out.push({ type: 'RESOLVE_MOVE_SWAP_TREASURE', heroInstanceId: c.instanceId })
      } else if (c.instanceId !== state.pendingMoveSwapTreasure.fromHeroId) {
        out.push({ type: 'RESOLVE_MOVE_SWAP_TREASURE', heroInstanceId: c.instanceId })
      }
    }
    return out
  }
  // Davy Jones — Réveillez le Kraken : défausser un Allié (non associé).
  if (state.pendingWakeKraken) {
    const out: GameAction[] = []
    for (const loc of me.locations) for (const c of me.board[loc.id] ?? []) {
      if (c.type === 'ally' && !c.attachedTo) out.push({ type: 'RESOLVE_WAKE_KRAKEN', allyInstanceId: c.instanceId })
    }
    return out
  }

  // Shere Khan — Jeune et sans défense : choix déplacer un Héros / gagner du Pouvoir.
  if (state.pendingYoung) {
    const py = state.pendingYoung
    if (py.kind === 'choose') {
      return [
        { type: 'RESOLVE_YOUNG', choice: 'gain' },
        { type: 'RESOLVE_YOUNG', choice: 'move' },
      ]
    }
    if (py.kind === 'pick-hero') {
      return Object.values(me.board).flat().filter((c) => c.type === 'hero').map((h) => ({ type: 'RESOLVE_YOUNG', heroInstanceId: h.instanceId }))
    }
    return Object.values(me.board).flat().filter((c) => c.type === 'ally' && !c.attachedTo).map((a) => ({ type: 'RESOLVE_YOUNG', allyInstanceId: a.instanceId }))
  }

  // Shere Khan — À toi de jouer, cousin : jouer l'Allié dévoilé sur un lieu au choix.
  if (state.pendingFreePlayAlly) {
    const locked = new Set(me.lockedLocations ?? [])
    return me.locations
      .filter((l) => !locked.has(l.id))
      .map((l) => ({ type: 'RESOLVE_FREE_PLAY_ALLY', locationId: l.id }))
  }

  // Shere Khan — C'est à moi que vous le direz : remettre (ou non) une Fatalité de la défausse.
  if (state.pendingRecoverFate) {
    const out: GameAction[] = [{ type: 'RESOLVE_RECOVER_FATE' }]
    for (const c of me.fateDiscard) out.push({ type: 'RESOLVE_RECOVER_FATE', instanceId: c.instanceId })
    return out
  }

  // Shere Khan — Lancé sur ses traces : choisir quel Héros éliminer (gratuit).
  if (state.pendingShereKhanDefeat) {
    const heroes = Object.values(me.board).flat().filter((c) => c.type === 'hero')
    // Priorité au Héros-cible (Mowgli) si l'objectif est atteignable (pas de Feu).
    return heroes.map((h) => ({ type: 'RESOLVE_SHERE_KHAN_DEFEAT', heroInstanceId: h.instanceId }))
  }

  // Shere Khan — C'est moi, Shere Khan : choisir quel jeton Feu retirer.
  if (state.pendingRemoveFire) {
    const out: GameAction[] = []
    for (const [locationId, ids] of Object.entries(me.fireTokens ?? {})) {
      for (const actionId of ids) out.push({ type: 'RESOLVE_REMOVE_FIRE', locationId, actionId })
    }
    return out.length > 0 ? out : [{ type: 'RESOLVE_REMOVE_FIRE', locationId: me.locations[0].id, actionId: 'x' }]
  }

  // Shere Khan — pose d'un jeton Feu : choisir l'action à recouvrir. `locationId` (Mowgli)
  // restreint le choix au lieu d'arrivée ; absent (Feu Rouge) = tout le royaume.
  if (state.pendingPlaceFire) {
    const pf = state.pendingPlaceFire
    const tgt = state.players[pf.targetIndex]
    const onFire = tgt.fireTokens ?? {}
    const out: GameAction[] = []
    for (const loc of tgt.locations) {
      if (pf.locationId && loc.id !== pf.locationId) continue
      for (const a of loc.actions) {
        if (!(onFire[loc.id] ?? []).includes(a.id)) out.push({ type: 'RESOLVE_PLACE_FIRE', locationId: loc.id, actionId: a.id })
      }
    }
    return out
  }

  // Le Faisceau : choisir le lieu de rassemblement, puis défausser (ou non) un Cybug.
  if (state.pendingBeacon) {
    const pb = state.pendingBeacon
    if (pb.kind === 'pick-location') {
      return (pb.locationIds ?? []).map((locationId) => ({ type: 'RESOLVE_BEACON', locationId }))
    }
    const out: GameAction[] = [{ type: 'RESOLVE_BEACON', skip: true }]
    for (const id of pb.cybugIds ?? []) out.push({ type: 'RESOLVE_BEACON', cybugInstanceId: id })
    return out
  }

  // Médaille de Vanellope : choisir le Héros puis le lieu où le rejouer (+1 Force).
  if (state.pendingMedal) {
    const pm = state.pendingMedal
    if (pm.kind === 'pick-hero') {
      return (pm.heroIds ?? []).map((heroInstanceId) => ({ type: 'RESOLVE_MEDAL', heroInstanceId }))
    }
    return (pm.locationIds ?? []).map((locationId) => ({ type: 'RESOLVE_MEDAL', locationId }))
  }

  // Lotso — choix d'une cible (réduire un Héros / déplacer vers la Salle des Chenilles).
  if (state.pendingLotsoTarget) {
    const ptl = state.pendingLotsoTarget
    return ptl.candidateIds.map((instanceId) => ({ type: 'RESOLVE_LOTSO_TARGET', instanceId }))
  }
  if (state.pendingEvolveAlly) {
    return state.pendingEvolveAlly.candidateIds.map((instanceId) => ({ type: 'RESOLVE_EVOLVE_ALLY', instanceId }))
  }

  // Lotso — Réinitialisation : choix du lieu où placer Buzz (mode Démo).
  if (state.pendingLotsoBuzzMove) {
    const pl = state.players[state.pendingLotsoBuzzMove.playerIndex]
    return pl.locations.map((l) => ({ type: 'RESOLVE_LOTSO_BUZZ_MOVE', to: l.id }))
  }

  // Lotso — Le Bibliothécaire : réduire un Héros réductible (−1) ou terminer.
  if (state.pendingLotsoBookworm) {
    const out: GameAction[] = [{ type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: null }]
    for (const id of lotsoReducibleHeroes(state, state.pendingLotsoBookworm.playerIndex)) {
      out.push({ type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId: id })
    }
    return out
  }

  // Lotso — Flex : phase 1 (choisir la carte) ou phase 2 (choisir le lieu de destination).
  if (state.pendingLotsoFlex) {
    const pf = state.pendingLotsoFlex
    if (!pf.cardInstanceId) return pf.candidateIds.map((id) => ({ type: 'RESOLVE_LOTSO_FLEX', cardInstanceId: id }))
    const pl = state.players[pf.playerIndex]
    return pl.locations.filter((l) => l.id !== pf.fromLocationId).map((l) => ({ type: 'RESOLVE_LOTSO_FLEX', to: l.id }))
  }

  // Syndrome — « Identification, je vous prie » : déplacer un Allié/Objet vers un lieu
  // portant un Héros. On énumère (carte × lieu-avec-Héros).
  if (state.pendingIdentification) {
    const p = state.players[state.pendingIdentification.playerIndex]
    const heroLocs = p.locations.map((l) => l.id).filter((id) => (p.board[id] ?? []).some((c) => c.type === 'hero'))
    const out: GameAction[] = []
    for (const loc of p.locations) {
      for (const c of (p.board[loc.id] ?? []).filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket)) {
        for (const to of heroLocs.filter((id) => id !== loc.id)) {
          out.push({ type: 'RESOLVE_IDENTIFICATION', cardInstanceId: c.instanceId, to })
        }
      }
    }
    if (out.length > 0) return out
  }

  // Digne Adversaire / Obsession : le Héros révélé doit être JOUÉ ; on choisit le lieu.
  // Tamatoa — Crustacé : placer l'Objet dévoilé sur un lieu (le bot choisit via l'éval ;
  // le Cœur va au Repaire car la jauge objectif le récompense).
  if (state.pendingCrustaceanPlace) {
    const pcp = state.pendingCrustaceanPlace
    const p = state.players[pcp.playerIndex]
    const locked = new Set(p.lockedLocations ?? [])
    return p.locations
      .filter((l) => !locked.has(l.id))
      .map((l) => ({ type: 'RESOLVE_CRUSTACEAN_PLACE', to: l.id }))
  }
  // Dr Facilier — L'étoile du soir : le « chooser » envoie un Allié de la cible dans
  // l'Au-delà (le bot choisit via l'éval ; à défaut, le plus fort est un bon défaut).
  if (state.pendingFateAllyToAuDela) {
    const pa = state.pendingFateAllyToAuDela
    const tgt = state.players[pa.targetIndex]
    const out: GameAction[] = []
    for (const l of tgt.locations) {
      for (const c of tgt.board[l.id] ?? []) {
        if (c.type === 'ally' && !c.attachedTo && !c.isWicket) {
          out.push({ type: 'RESOLVE_FATE_ALLY_TO_AUDELA', allyInstanceId: c.instanceId })
        }
      }
    }
    if (out.length > 0) return out
  }
  // Oogie Boogie — Mettons fin à ce cauchemar : le « chooser » défausse une carte de la main
  // de la cible. Priorité au bot : Imposteur Perce-Oreilles (clé de l'objectif), sinon coût élevé.
  if (state.pendingFateDiscardHand) {
    const pd = state.pendingFateDiscardHand
    const hand = state.players[pd.targetIndex].hand ?? []
    if (hand.length > 0) {
      const ranked = [...hand].sort((a, b) => {
        const score = (c: typeof a) => (c.cardId === 'imposteur-perce-oreilles' ? 100 : 0) + (c.cardId === 'affaire-dans-le-sac' ? 50 : 0) + (c.cost ?? 0)
        return score(b) - score(a)
      })
      return ranked.map((c) => ({ type: 'RESOLVE_FATE_DISCARD_HAND', cardInstanceId: c.instanceId }))
    }
  }
  // Oogie Boogie — Diversion (2ᵉ temps) : défausse un Allié/Objet du lieu d'arrivée.
  // Bot → le plus fort (défaut raisonnable).
  if (state.pendingDiversionDiscard) {
    const pdd = state.pendingDiversionDiscard
    const cell = state.players[pdd.targetIndex].board[pdd.locationId] ?? []
    const cands = cell.filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket)
    if (cands.length > 0) {
      return cands.map((c) => ({ type: 'RESOLVE_DIVERSION_DISCARD', cardInstanceId: c.instanceId }))
    }
  }
  // Hadès — Alignement des planètes : le bot désentrave les Titans entravés les plus avancés
  // qu'il peut financer (1 JT chacun).
  if (state.pendingUntrapTitans) {
    const p = state.players[state.pendingUntrapTitans.playerIndex]
    const order = p.locations.map((l) => l.id)
    const trapped: { id: string; i: number }[] = []
    order.forEach((lid, i) => {
      for (const c of p.board[lid] ?? []) if (c.isTitan && c.trapped) trapped.push({ id: c.instanceId, i })
    })
    trapped.sort((a, b) => b.i - a.i)
    const chosen = trapped.slice(0, p.power).map((t) => t.id)
    return [{ type: 'RESOLVE_UNTRAP_TITANS', instanceIds: chosen }]
  }
  if (state.pendingFetchedHero) {
    const pfh = state.pendingFetchedHero
    const p = state.players[pfh.playerIndex]
    if (pfh.hero.cardId === 'peter-pan') {
      return [{ type: 'RESOLVE_FETCHED_HERO', play: true, to: 'arbre-pendu' }]
    }
    const locked = new Set(p.lockedLocations ?? [])
    return p.locations
      .filter((l) => !locked.has(l.id))
      .map((l) => ({ type: 'RESOLVE_FETCHED_HERO', play: true, to: l.id }))
  }

  // Vol du château (Bowser) : poser l'Allié/Objet dévoilé sur un lieu non verrouillé
  // (ou en main si associable → une seule option sans lieu).
  if (state.pendingCastleTheft) {
    const pct = state.pendingCastleTheft
    if (pct.toHand) return [{ type: 'RESOLVE_CASTLE_THEFT' }]
    const p = state.players[pct.playerIndex]
    const locked = new Set(p.lockedLocations ?? [])
    return p.locations
      .filter((l) => !locked.has(l.id))
      .map((l) => ({ type: 'RESOLVE_CASTLE_THEFT', to: l.id }))
  }

  // Abu/Aladdin/K.O. : une option par carte candidate (Objet à voler / Allié à retirer).
  if (state.pendingFateChoice) {
    const pen = state.pendingFateChoice
    // Défausser une carte de la main adverse (Animaux de la forêt) : l'éval ne distingue
    // pas les cartes en main → on cible la plus précieuse selon le vilain (Miroir >
    // Ingrédient > Croque pour la Méchante Reine). Cf. villainStrategy.valuableHandCards.
    if (pen.kind === 'discard-from-hand') {
      const priority = VILLAIN_STRATEGY[state.players[pen.targetIndex].villain]?.fateTargeting?.valuableHandCards
      if (priority) {
        const cand = new Set(pen.candidateIds)
        const hand = state.players[pen.targetIndex].hand
        for (const cardId of priority) {
          const found = hand.find((c) => c.cardId === cardId && cand.has(c.instanceId))
          if (found) return [{ type: 'RESOLVE_FATE_CHOICE', instanceId: found.instanceId }]
        }
      }
    }
    return pen.candidateIds.map((id) => ({ type: 'RESOLVE_FATE_CHOICE', instanceId: id }))
  }

  // Je ne reviens jamais : le bot conserve l'ordre révélé (réorganisation neutre).
  if (state.pendingFateReorder) {
    return [{ type: 'RESOLVE_FATE_REORDER', orderedIds: state.pendingFateReorder.cards.map((c) => c.instanceId) }]
  }

  // Mère Gothel — Maximus : repositionnement facultatif (Cavaliers du roi, puis Maximus)
  // par le joueur qui pose la Fatalité. Une option par destination voisine + « passer ».
  if (state.pendingMaximus) {
    const pm = state.pendingMaximus
    const tp = state.players[pm.targetIndex]
    const order = tp.locations.map((l) => l.id)
    const locked = new Set(tp.lockedLocations ?? [])
    const adj = (from: string): string[] => {
      const i = order.indexOf(from)
      return [order[i - 1], order[i + 1]].filter((id): id is string => !!id && !locked.has(id))
    }
    if (pm.phase === 'cavaliers') {
      const out: GameAction[] = [{ type: 'RESOLVE_MAXIMUS_CAVALIERS', allyInstanceId: null, to: null }]
      for (const loc of tp.locations) {
        for (const c of tp.board[loc.id] ?? []) {
          if (c.type === 'ally' && c.cardId === 'cavaliers-du-roi') {
            for (const to of adj(loc.id)) out.push({ type: 'RESOLVE_MAXIMUS_CAVALIERS', allyInstanceId: c.instanceId, to })
          }
        }
      }
      return out
    }
    const out: GameAction[] = [{ type: 'RESOLVE_MAXIMUS_MOVE', to: null }]
    const from = tp.locations.find((l) => (tp.board[l.id] ?? []).some((c) => c.instanceId === pm.maximusInstanceId))?.id
    if (from) for (const to of adj(from)) out.push({ type: 'RESOLVE_MAXIMUS_MOVE', to })
    return out
  }

  // Déplacement d'Allié (Pas de Quartier ! / Grand Terrier) : une option par
  // (Allié déplaçable × lieu voisin non bloqué) ; + « passer » si facultatif.
  if (state.pendingAllyMoveBuff) {
    const p = state.players[state.pendingAllyMoveBuff.playerIndex]
    const out: GameAction[] = []
    for (const l of p.locations) {
      for (const c of p.board[l.id] ?? []) {
        if (c.type !== 'ally' || c.attachedTo || c.isWicket) continue
        for (const to of adjacentLocationIds(state, l.id)) {
          out.push({ type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId: c.instanceId, to })
        }
      }
    }
    if (state.pendingAllyMoveBuff.optional) out.push({ type: 'SKIP_ALLY_MOVE_BUFF' })
    return out
  }

  // Déplacement de figurine adverse (Roi Stéphane / Bowser — Anneau étoile) : le
  // chooser éloigne le pion de la cible de ses forces. Sans cette branche, la
  // recherche traitait la carte comme sans effet (cul-de-sac) → jamais jouée.
  // On ne propose QU'UNE destination (la plus perturbatrice : moins d'Alliés/Objets
  // de la cible) pour ne pas démultiplier la recherche — la résolution réelle (UI)
  // a sa propre heuristique. À défaut de destination, on ne déplace pas (null).
  if (state.pendingPawnMove) {
    const tgt = state.players[state.pendingPawnMove.targetIndex]
    const locked = new Set(tgt.lockedLocations ?? [])
    const support = (id: string) =>
      (tgt.board[id] ?? []).filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo).length
    const cands = tgt.locations
      .filter((l) => l.id !== tgt.pawnLocation && !locked.has(l.id))
      .sort((a, b) => support(a.id) - support(b.id))
    return cands.length
      ? [{ type: 'RESOLVE_PAWN_MOVE', locationId: cands[0].id }]
      : [{ type: 'RESOLVE_PAWN_MOVE', locationId: null }]
  }

  // Pas si vite (Sombra) : garder (= faire jouer) la carte la MOINS menaçante (force
  // la plus faible). Sinon Faites-leur peur ! : garder les Héros, défausser le reste.
  if (state.pendingScry) {
    if (state.pendingScry.pasSiVite) {
      const least = [...state.pendingScry.cards].sort((a, b) => (a.strength ?? 0) - (b.strength ?? 0))[0]
      return [{ type: 'RESOLVE_SCRY', topInstanceIds: least ? [least.instanceId] : [] }]
    }
    const heroes = state.pendingScry.cards.filter((c) => c.type === 'hero').map((c) => c.instanceId)
    return [{ type: 'RESOLVE_SCRY', topInstanceIds: heroes }]
  }

  // Fatalité révélée à résoudre : une option par carte révélée (× lieu / héros valides).
  // Yzma — Fatalité spéciale : 4 pioches (une par lieu). L'adversaire choisit une
  // pioche NON VIDE (phase 'deck'), en voit toutes les cartes, puis en joue une sur
  // LE LIEU de cette pioche (phase 'card') ; le reste est remélangé et replacé.
  if (state.pendingYzmaFate) {
    const pending = state.pendingYzmaFate
    const tgt = state.players[pending.targetIndex]
    if (pending.phase === 'deck') {
      const decks = tgt.fateDecks ?? {}
      const out: GameAction[] = []
      for (const loc of tgt.locations) {
        if ((decks[loc.id] ?? []).length > 0) {
          out.push({ type: 'RESOLVE_YZMA_FATE_DECK', locationId: loc.id })
        }
      }
      return out // ≥1 pioche non vide garanti par applyFateYzma (redistribue si besoin)
    }
    // phase 'card' : jouer une des cartes révélées sur le lieu de la pioche choisie.
    // Toutes sont jouables (un Héros est posé sur ce lieu, un Événement résout ses
    // effets). On ne propose pas « aucune carte » : la Fatalité doit frapper.
    return (pending.cards ?? []).map((c) => ({
      type: 'RESOLVE_YZMA_FATE_CARD' as const,
      instanceId: c.instanceId,
    }))
  }

  if (state.pendingFate) {
    const { target, revealed } = state.pendingFate
    // Héros qui AIDENT le vilain ciblé (Flaversham chez Ratigan) : on ne les joue PAS,
    // sauf s'il n'existe aucune autre carte révélée à jouer (la Fatalité doit frapper).
    const avoidPlay = VILLAIN_STRATEGY[state.players[target].villain]?.fateTargeting?.avoidPlayingHeroes
    const isAvoid = (c: { type: string; cardId: string }) =>
      !!avoidPlay && c.type === 'hero' && avoidPlay.includes(c.cardId)
    const hasAlternative = revealed.some((c) => !isAvoid(c))
    const out: GameAction[] = []
    for (const card of revealed) {
      if (isAvoid(card) && hasAlternative) continue
      if (card.type === 'hero') {
        let locs = heroPlacementLocations(state, card, target)
        // Héros qui frappe les Alliés de son lieu (Luigi/Bowser) : le poser là où Bowser
        // a le plus d'Alliés porteurs d'Étoile (revers maximal). Cf. placeHeroOnStarAllies.
        const onStarAllies = VILLAIN_STRATEGY[state.players[target].villain]?.fateTargeting?.placeHeroOnStarAllies
        if (onStarAllies?.includes(card.cardId) && locs.length > 1) {
          locs = bestStarAllyLocations(state.players[target], locs)
        }
        if (locs.length === 0) {
          // Aucun lieu légal → résolution sans cible (l'engine défausse le Héros).
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
        for (const to of locs) out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId, to })
      } else if (
        card.cardId === 'voler-riches' ||
        card.cardId === 'agrandir' ||
        (card.type === 'item' && card.attach === 'hero')
      ) {
        // Épée de Vérité : uniquement sur un Héros SANS autre Objet associé.
        const tgt = state.players[target]
        const targetHeroes = heroesOf(state, target).filter((h) => {
          if (card.cardId !== 'epee-verite') return true
          const loc = Object.keys(tgt.board).find((id) => (tgt.board[id] ?? []).some((c) => c.instanceId === h.instanceId))
          return !loc || !(tgt.board[loc] ?? []).some((c) => c.attachedTo === h.instanceId && c.type === 'item')
        })
        // Provocation (Crochet) : NE PAS l'associer à Peter Pan (ça forcerait Crochet
        // à le vaincre d'abord — donc l'aiderait), ni à Wendy (elle renforce tous les
        // autres Héros, dont les Provocateurs) — sauf s'il n'y a aucun autre Héros.
        let provoTargets = targetHeroes
        if (card.cardId === 'provocation') {
          const good = targetHeroes.filter((h) => h.cardId !== 'peter-pan' && h.cardId !== 'wendy')
          if (good.length > 0) provoTargets = good
        }
        if (provoTargets.length > 0) {
          for (const h of provoTargets) {
            out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId, targetHeroId: h.instanceId })
          }
        } else {
          // Aucun Héros éligible → résolution sans cible (l'engine défausse la carte).
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
      } else if (card.cardId === 'apparence-retrouvee') {
        // Ursula — Apparence Retrouvée : jouable seulement si un Héros (force ≤4)
        // est dans la défausse Fatalité d'Ursula (sinon sans effet → on ne la joue pas).
        const tgt = state.players[target]
        if (tgt.fateDiscard.some((c) => c.type === 'hero' && (c.strength ?? 0) <= 4)) {
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
      } else if (card.cardId === 'en-retard') {
        // Reine de Cœur — En retard ! : jouable seulement si un Héros (force ≤3) est
        // dans la défausse Fatalité de la cible (sinon sans effet).
        const tgt = state.players[target]
        if (tgt.fateDiscard.some((c) => c.type === 'hero' && (c.strength ?? 0) <= 3)) {
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
      } else if (card.cardId === 'majorite') {
        // L'Imposteur — Majorité : jouable seulement s'il y a un Allié/Objet (hors Sabotage)
        // à défausser dans le royaume de la cible.
        if (fateCardPlayable(state, card, target)) {
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
      } else if (card.cardId === 'gurgis-happy-day') {
        // Le Seigneur des Ténèbres — Retour à la vie de Gurki : jouable seulement si la
        // défausse Fatalité de la cible n'est pas vide (sinon rien à remélanger).
        if (state.players[target].fateDiscard.length > 0) {
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
      } else if (card.cardId === 'travail-d-equipe') {
        // Syndrome — Travail d'équipe : jouable seulement si l'AUTRE carte révélée existe
        // et est jouable (« Jouez l'autre carte Fatalité » est obligatoire).
        const other = revealed.find((c) => c.instanceId !== card.instanceId)
        if (other && fateCardPlayable(state, other, target)) {
          out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
        }
      } else {
        out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId })
      }
    }
    // Filet : si aucune option valide (Héros sans lieu jouable), résoudre la 1ʳᵉ.
    if (out.length === 0 && revealed.length > 0) {
      out.push({ type: 'RESOLVE_FATE', instanceId: revealed[0].instanceId })
    }
    // Combo « jouer les deux » (Ray/Dormeur) : la 2ᵉ carte est FACULTATIVE → le bot
    // peut aussi passer (PASS_FATE).
    if (state.pendingFate.optional) out.push({ type: 'PASS_FATE' })
    return out
  }

  // Phase de déplacement : un lieu différent du lieu courant (+ skip si Disparition).
  // Diablo se déplace AVANT le pion (donc ici, en phase MOVE).
  if (state.phase === 'MOVE') {
    // Sa Sucrerie — déplacement sur le circuit en huit : 1 à 4 cases (2–3 si Félix).
    if (me.villain === 'sa-sucrerie') {
      const felix = Object.values(me.board).flat().some((c) => c.type === 'hero' && c.cardId === 'felix-fixe-jr' && !c.hypnotized)
      const min = felix ? 2 : 1
      const max = felix ? 3 : 4
      const out: GameAction[] = []
      for (let s = min; s <= max; s++) out.push({ type: 'MOVE_TRACK', steps: s })
      return out
    }
    const out: GameAction[] = getLegalMoves(state).map((to) => ({ type: 'MOVE', to }))
    if (me.skipNextMove) out.push({ type: 'SKIP_MOVE' })
    // Le Seigneur des Ténèbres — capacité du Chaudron réveillé (AVANT le déplacement) :
    // remplacer un Squelette de Soldat (chaque lieu porteur) par un Soldat Ressuscité
    // de la main. Le pion devra ensuite être déplacé (le drapeau bloque toute répétition).
    if (canCauldronExchange(state)) {
      const soldier = me.hand.find((c) => c.cardId === 'cauldron-born')
      if (soldier) {
        for (const loc of me.locations) {
          const sk = (me.board[loc.id] ?? []).find((c) => c.cardId === 'ancient-soldiers' && c.type === 'item' && !c.attachedTo)
          if (sk) out.push({ type: 'CAULDRON_EXCHANGE', squeletteInstanceId: sk.instanceId, soldierInstanceId: soldier.instanceId })
        }
      }
    }
    for (const loc of me.locations) {
      for (const c of me.board[loc.id] ?? []) {
        if (c.cardId !== 'diablo') continue
        if (state.usedActionIds.includes(`diablo-move:${c.instanceId}`)) continue
        for (const dest of me.locations) {
          if (dest.id === loc.id) continue
          out.push({ type: 'DIABLO_MOVE', instanceId: c.instanceId, to: dest.id })
        }
      }
    }
    return out
  }

  // Phase d'action : END_TURN est toujours possible (garantit la terminaison).
  const out: GameAction[] = [{ type: 'END_TURN' }]

  // Ratigan — Brutes : fenêtre d'action distante FACULTATIVE → on peut y renoncer
  // (sans terminer le tour). Les actions du lieu distant sont énumérées normalement
  // ci-dessous (getAvailableActions respecte actAtLocation).
  if (state.actAtLocation && state.actAtLocationSkippable) {
    out.push({ type: 'SKIP_REMOTE_ACTION' })
  }

  // Mère Gothel — Couronne : capacité gratuite (défausse → 1 Confiance). Le bot ne
  // s'en sert que si ce point le fait GAGNER (sinon il garde l'Objet pour son passif
  // « 2 Confiance par Héros éliminé sur son lieu »).
  if (me.objective.type === 'CONFIANCE_THRESHOLD' && (me.confiance ?? 0) + 1 >= me.objective.threshold) {
    for (const loc of me.locations) {
      for (const c of me.board[loc.id] ?? []) {
        if (c.cardId === 'couronne-gothel') {
          out.push({ type: 'SACRIFICE_COURONNE', instanceId: c.instanceId })
        }
      }
    }
  }

  // Le Seigneur des Ténèbres — RÉVEILLER le Chaudron Noir réclamé via l'action « Activer
  // une capacité » donnée par les Squelettes de Soldats : seulement si cette action est
  // disponible (un Squelettes au lieu du pion), comme pour l'humain.
  if (me.blackCauldron === 'claimed' && getAvailableActions(state).some((a) => a.type === 'ACTIVATE')) {
    out.push({ type: 'ACTIVATE_CAULDRON' })
  }

  // Cruella — Finissez le travail ! : activation gratuite disponible → on propose
  // d'activer chaque capacité finançable, sans dépendre d'un lieu Activer.
  if (me.freeActivate) {
    for (const c of activatableCards(state)) {
      out.push({ type: 'ACTIVATE', actionId: 'free-activate', cardInstanceId: c.instanceId })
    }
  }

  // Cartes jouables sans action « Jouer une carte » (Turbo-Statique, L'important c'est de
  // payer) : à tout moment de la phase ACTION, paient leur coût, ne consomment aucune
  // action. Événement simple → pose directe. Certaines exigent d'être jouées AVANT toute
  // action de lieu (playableOnlyBeforeActions).
  if (state.phase === 'ACTION') {
    const realActionUsed = state.usedActionIds.some((a) => !a.includes(':'))
    for (const card of me.hand) {
      if (!card.playableWithoutAction || card.type !== 'effect') continue
      if (effectiveCost(state, card) > me.power) continue
      if (card.playableOnlyBeforeActions && realActionUsed) continue
      out.push({ type: 'PLAY_CARD', actionId: FREE_PLAY_NO_ACTION_ID, instanceId: card.instanceId })
    }
  }

  for (const action of getAvailableActions(state)) {
    if (action.type === 'GAIN_POWER') {
      out.push({ type: 'EXECUTE_ACTION', actionId: action.id })
    } else if (action.type === 'OBTAIN_KEY') {
      // Le Seigneur des clés : ramasser une clé sur le lieu du pion (ouvre pendingKey).
      out.push({ type: 'OBTAIN_KEY', actionId: action.id })
    } else if (action.type === 'REVEAL_FIGHTER') {
      // Tabbou : dévoiler N tuiles Combattants (1 JT/tuile ; surcoût Kirby ; plafond Link).
      // On propose « 1 » (prudent) et « max » (à fond) ; l'évaluation tranche.
      const max = maxRevealFighters(state)
      const counts = max > 1 ? [1, max] : max === 1 ? [1] : []
      for (const count of counts) out.push({ type: 'EXECUTE_ACTION', actionId: action.id, count })
    } else if (action.type === 'BREW_POISON') {
      // Préparer du Poison convertit N Pouvoir en N Poison : on propose au bot
      // « 1 » (prudent) et « tout convertir » (max). L'évaluation tranche.
      const max = maxBrewPoison(state)
      const counts = max > 1 ? [1, max] : [1]
      for (const count of counts) out.push({ type: 'EXECUTE_ACTION', actionId: action.id, count })
    } else if (action.type === 'PLAY_CARD') {
      const locs = placementLocations(state)
      const richardBlocks = Object.values(me.board).flat().some((c) => c.type === 'hero' && c.blocksVillainEvents)
      for (const card of me.hand) {
        if (card.type === 'condition' || effectiveCost(state, card) > me.power) continue
        if (card.reactiveOnly) continue // Oogie — Dés pipés : se joue en réaction
        if (richardBlocks && card.type === 'effect') continue
        if (cardNeedsAllyMove(card)) continue // Tendre un Piège : combinatoire ignorée ici
        // Madame de Trémaine — Allié « en robe de bal » injouable sans sa version
        // ordinaire en jeu.
        if (card.replacesCardId && !Object.values(me.board).flat().some((c) => c.cardId === card.replacesCardId && !c.attachedTo)) continue
        // Madame de Trémaine — Je ne reviens jamais : inutile si la défausse Fatalité est vide.
        if ((card.effects ?? []).some((e) => e.type === 'RESHUFFLE_FATE_DISCARD') && me.fateDiscard.length === 0) continue
        // Mère Gothel — Je serai la méchante : injouable si Raiponce est déjà sur la Tour
        // (ne resterait que la perte de 1 Confiance).
        if (
          card.type === 'effect' &&
          (card.effects ?? []).some((e) => e.type === 'MOVE_RAIPONCE' && e.to === 'tour') &&
          raiponceLocation(me) === me.locations[0].id
        ) continue
        // J'ai dit « Si » : injouable si la défausse de Méchant est vide.
        if ((card.effects ?? []).some((e) => e.type === 'RESHUFFLE_DISCARD_AND_DRAW') && me.discard.length === 0) continue
        // Syndrome — Identification, je vous prie : inutile sans lieu portant un Héros ou
        // sans Allié/Objet (non associé) à déplacer.
        if (
          (card.effects ?? []).some((e) => e.type === 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION') &&
          (!me.locations.some((l) => (me.board[l.id] ?? []).some((c) => c.type === 'hero')) ||
            !Object.values(me.board).flat().some((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket))
        ) continue
        // Dr Facilier — Divination : sans effet hors du Royaume du vaudou.
        if ((card.effects ?? []).some((e) => e.type === 'DIVINATION') && me.pawnLocation !== 'royaume-vaudou') continue
        // Hadès — Préparez-vous au combat ! : inutile sans Titan non entravé déplaçable (+ Pouvoir).
        {
          const tm = (card.effects ?? []).find((e) => e.type === 'MOVE_TITAN_INTERACTIVE')
          if (
            tm &&
            tm.type === 'MOVE_TITAN_INTERACTIVE' &&
            ((tm.paid && me.power < 2) ||
              !Object.values(me.board)
                .flat()
                .some((c) => c.isTitan && !c.trapped && titanReachableDests(state, state.activePlayer, c.instanceId, tm.maxSteps).length > 0))
          ) continue
        }
        // Reine de Cœur — Par ordre de la Reine ! : inutile sans Carte Garde transformable.
        if ((card.effects ?? []).some((e) => e.type === 'TRANSFORM_GUARDS') && transformableGuards(state, state.activePlayer).length === 0) continue
        // Cruella — J'adore les belles fourrures : inutile sans Tuile Chiots dans le royaume.
        if ((card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_PUPPY_LOCATION') && !(me.puppyTiles ?? []).some((t) => t.state === 'board')) continue
        // Le Seigneur des Ténèbres — Notre heure est venue ! : inutile si le Chaudron n'est
        // pas en sa possession (déjà réveillé, ou pas encore réclamé).
        if ((card.effects ?? []).some((e) => e.type === 'POWER_BLACK_CAULDRON') && me.blackCauldron !== 'claimed') continue
        // Le Seigneur des Ténèbres — Nous avons conclu un marché ! : injouable si aucune
        // option n'est réalisable (défausse vide ET pas d'Épée Magique défaussable pour
        // le Chaudron — Épée absente, Pouvoir insuffisant, ou Chaudron déjà pris).
        {
          const bg = (card.effects ?? []).find((e) => e.type === 'BARGAIN_RESHUFFLE_OR_SWORD')
          if (bg && bg.type === 'BARGAIN_RESHUFFLE_OR_SWORD') {
            const hasSword = Object.values(me.board).flat().some((c) => c.cardId === 'dyrnwyn')
            const canSword = hasSword && me.power >= effectiveCost(state, card) + bg.power && me.blackCauldron === 'set-aside'
            if (me.discard.length === 0 && !canSword) continue
          }
        }
        // C'est votre dernière chance : injouable si NI déplacement NI activation possible.
        if (
          (card.effects ?? []).some((e) => e.type === 'GRANT_FREE_MOVE_OR_ACTIVATE') &&
          movableCards(state).length === 0 &&
          activatableCards(state).length === 0
        ) continue
        // Tabbou — Coup Fatal (KILL_FIGHTERS_FREE, jusqu'à 10 tuiles) : ne pas gaspiller sa
        // capacité. On ne le joue que si ≥10 tuiles sont en réserve, OU si tuer la réserve
        // suffit à atteindre l'objectif (finisher, même avec < 10). Sinon on dévoile d'abord.
        if ((card.effects ?? []).some((e) => e.type === 'KILL_FIGHTERS_FREE')) {
          const tiles = me.fighterTiles ?? []
          const killed = tiles.filter((t) => t.state === 'killed').length
          const reserve = tiles.filter((t) => t.state === 'reserve').length
          const obj = me.objective
          let threshold = obj.type === 'KILL_FIGHTERS' ? obj.threshold : 20
          if (obj.type === 'KILL_FIGHTERS' && obj.raiseHeroCardId !== undefined && obj.raiseTo !== undefined) {
            const raiseHero = Object.values(me.board).flat().some((c) => c.type === 'hero' && c.cardId === obj.raiseHeroCardId)
            if (raiseHero) threshold = obj.raiseTo
          }
          if (reserve < 10 && killed + reserve < threshold) continue
        }
        // Tabbou — Canon Obscur (−1 au coût des Objets sur son lieu) : n'a plus d'intérêt à
        // être posé une fois l'Émissaire débloqué (les Orbes, gros achats d'Objets, sont posés).
        // Restreint à Tabbou : seul lui a `emissaireLocationId`.
        if (card.itemCostReductionHere !== undefined && me.emissaireLocationId !== undefined &&
            !(me.lockedLocations ?? []).includes(me.emissaireLocationId)) continue
        const orPayEffect = (card.effects ?? []).find((x) => x.type === 'DISCARD_ALLY_AT_HOST_OR_PAY')
        if (card.type === 'ally' || card.type === 'item' || card.type === 'curse') {
          if (requiresAllyTarget(card)) {
            for (const to of locs) {
              for (const ally of alliesAt(state, to)) {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, to, attachTo: ally.instanceId })
              }
            }
          } else if (card.type === 'item' && card.attach === 'hero') {
            // Potion de mortalité (Hadès) : Objet associé à un Héros du royaume.
            for (const to of locs) {
              for (const h of (me.board[to] ?? []).filter((c) => c.type === 'hero' && !c.hypnotized)) {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, to, attachTo: h.instanceId })
              }
            }
          } else if ((card.effects ?? []).some((e) => e.type === 'FLAYER_PLACE_TUNNEL')) {
            // Le Flagelleur Mental — Tunnel de Hawkins : posé sur un lieu (jamais le Monde à
            // l'Envers, cf. forbiddenLocations), en défaussant N Alliés (2, +1 si Onze) qui
            // doivent être présents SUR CE MÊME LIEU. On émet UNE option par lieu ayant assez
            // d'Alliés défaussables sur place : défausser les N Alliés les MOINS forts (choix
            // canonique — évite l'explosion combinatoire des sous-ensembles).
            const tEff = (card.effects ?? []).find((e) => e.type === 'FLAYER_PLACE_TUNNEL')!
            if (tEff.type === 'FLAYER_PLACE_TUNNEL') {
              for (const to of locs) {
                if ((card.forbiddenLocations ?? []).includes(to)) continue
                // Billy compte parmi les Alliés requis mais n'est jamais défaussé → on ne
                // défausse que `needed` Alliés (les moins forts) parmi les défaussables.
                const needed = flayerTunnelDiscardsNeededAt(me, to, tEff)
                const here = [...flayerTunnelDiscardableAlliesAt(me, to)].sort(
                  (a, b) => (a.strength ?? 0) - (b.strength ?? 0),
                )
                if (here.length < needed) continue
                const allyIds = here.slice(0, needed).map((a) => a.instanceId)
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, to, allyInstanceIds: allyIds })
              }
            }
          } else if (orPayEffect && orPayEffect.type === 'DISCARD_ALLY_AT_HOST_OR_PAY') {
            // Ratigan — Félicia : à chaque lieu, soit défausser un Allié présent
            // (une option par Allié), soit payer le supplément si finançable. Lieu
            // sans Allié ET supplément inabordable → injouable (option non émise).
            const pay = orPayEffect.power
            const base = effectiveCost(state, card)
            for (const to of locs) {
              const alliesHere = (me.board[to] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
              for (const a of alliesHere) {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, to, allyInstanceIds: [a.instanceId] })
              }
              if (me.power >= base + pay) {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, to })
              }
            }
          } else {
            // Le Seigneur des Ténèbres — Mort-vivant du Chaudron : lieux restreints
            // (Chaudron actif + Anciens Soldats présents).
            // Syndrome — tuile Omnidroïde (v.X9/v.10) : jouable seulement si le royaume
            // a assez de Modifications Majeures ; v.10 doit aller sur Métroville.
            if (card.isOmnidroid && card.omnidroidUpgradeCost) {
              const mods = Object.values(me.board)
                .flat()
                .filter((c) => c.cardId === 'modification-majeure' && c.type === 'item' && !c.attachedTo).length
              if (mods < card.omnidroidUpgradeCost) continue
            }
            const placeLocs =
              card.requiresPoweredCauldron || card.consumesItemCardId ? cauldronBornLocations(me, card) : locs
            for (const to of placeLocs) {
              if (card.type === 'curse' && !canPlaceCurseAt(state, state.activePlayer, to)) continue
              if (card.playOnlyAt && to !== card.playOnlyAt) continue
              if (card.isOmnidroid && card.omnidroidForceLocation && to !== card.omnidroidForceLocation) continue
              // Anastasie/Javotte : pas dans la Salle de Bal (lieux interdits par carte).
              if ((card.forbiddenLocations ?? []).includes(to)) continue
              // Cendrillon en robe de bal : aucun Allié sur la Salle de Bal.
              if (card.type === 'ally' && allyBlockedAt(state, state.activePlayer, to)) continue
              out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, to })
            }
          }
        } else if (cardNeedsVanquishTarget(card)) {
          for (const loc of me.locations) {
            const cell = me.board[loc.id] ?? []
            const heroes = cell.filter((c) => c.type === 'hero')
            const localAllies = cell.filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
            const adjAllies = adjacentLocationIds(state, loc.id).flatMap((adj) =>
              (me.board[adj] ?? []).filter((c) => !c.trapped && (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers')),
            ).concat(anyLocReachers(me, loc.id))
            for (const h of heroes) {
              const guarded = cell.some((c) => c.cardId === 'deguisement' && c.attachedTo === h.instanceId)
              if (guarded) continue
              const usable =
                h.cardId === 'bobby'
                  ? localAllies.filter((a) => a.cardId !== 'archers-loups')
                  : [...localAllies, ...adjAllies]
              if (usable.length === 0) continue
              const heroForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
              const allyForce = usable.reduce((n, a) => n + (effectiveStrength(state, state.activePlayer, a.instanceId) ?? 0), 0)
              if (allyForce >= heroForce) {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, targetHeroId: h.instanceId, allyInstanceIds: usable.map((a) => a.instanceId) })
              }
            }
          }
        } else if (cardNeedsHeroTarget(card)) {
          const maxStrengthEffect = (card.effects ?? []).find((e) => e.type === 'INSTANT_VANQUISH_HERO_LE')
          const maxStrength =
            maxStrengthEffect && maxStrengthEffect.type === 'INSTANT_VANQUISH_HERO_LE'
              ? maxStrengthEffect.maxStrength
              : Infinity
          // Disparition / Ah, je suis un serpent ? : Héros du lieu du pion uniquement.
          const atPawn =
            (card.effects ?? []).some((e) => e.type === 'INSTANT_VANQUISH_HERO_AT_PAWN') ||
            (maxStrengthEffect?.type === 'INSTANT_VANQUISH_HERO_LE' && maxStrengthEffect.atPawn)
          // Hypnose : coût = force du Héros → on n'énumère que les cibles abordables.
          const isHypnose = (card.effects ?? []).some((e) => e.type === 'HYPNOTIZE_HERO')
          // Rapetisser : on ne peut pas rapetisser deux fois → exclure les Héros
          // déjà rapetissés.
          const shrinks = (card.effects ?? []).some(
            (e) => e.type === 'SET_HERO_SIZE' && e.size === 'shrunk',
          )
          // Boop ! (Sombra) : on ne pirate pas un Héros déjà piraté.
          const hacks = (card.effects ?? []).some((e) => e.type === 'HACK_HERO')
          // Sale voleuse ! : cible restreinte à certains cardId (Cendrillon / robe de bal).
          const onlyCardIds =
            maxStrengthEffect?.type === 'INSTANT_VANQUISH_HERO_LE' ? maxStrengthEffect.onlyCardIds : undefined
          const own = atPawn
            ? (me.board[me.pawnLocation ?? ''] ?? []).filter((c) => c.type === 'hero')
            : heroesOf(state, state.activePlayer)
          for (const h of own) {
            const forbidden = new Set(h.forbiddenLocations ?? [])
            if (card.cardId === 'emprisonnement' && forbidden.has('jail')) continue
            if (shrinks && h.heroSize === 'shrunk') continue
            if (hacks && h.abilityHacked) continue
            if (onlyCardIds && !onlyCardIds.includes(h.cardId)) continue
            if ((h.strength ?? 0) > maxStrength) continue
            const hForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
            if (isHypnose && hForce > me.power) continue
            // Banqueroute : coût = Force du Héros → seules les cibles abordables.
            if (card.costEqualsTargetStrength && hForce > me.power) continue
            // Rapetisser sur un Héros NORMAL : une option par action du haut à
            // laisser libre (l'autre est recouverte). Sur un Héros agrandi, Rapetisser
            // le ramène à la normale → pas de choix.
            if (shrinks && !h.heroSize) {
              const loc = me.locations.find((l) =>
                (me.board[l.id] ?? []).some((c) => c.instanceId === h.instanceId),
              )
              for (const t of (loc?.actions ?? []).filter((a) => a.row === 'top')) {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, targetHeroId: h.instanceId, shrinkFreeActionId: t.id })
              }
              continue
            }
            out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, targetHeroId: h.instanceId })
          }
        } else if (cardNeedsSacrificeTarget(card)) {
          // Sacrifice Nécessaire : une option par Allié/Objet (non associé) du royaume.
          for (const loc of me.locations) {
            for (const c of me.board[loc.id] ?? []) {
              if (c.type === 'ally' || c.type === 'item') {
                out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, allyInstanceIds: [c.instanceId] })
              }
            }
          }
        } else if (cardNeedsStarAllyTarget(card)) {
          // Bowser — épuisement d'énergie : une option par Allié pouvant recevoir
          // l'Étoile (sur l'Observatoire). Inutile si l'Observatoire est épuisé.
          if ((me.observatoryStars ?? 0) > 0) {
            for (const a of drainStarAllies(state)) {
              out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, allyInstanceIds: [a.instanceId] })
            }
          }
        } else if ((card.effects ?? []).some((e) => e.type === 'IMPUISSANCE_RESOLVE')) {
          // Bowser — Impuissance : Éliminer un Héros ≤3 (une option/cible) OU
          // capturer Peach (option sans cible, seulement si Peach est en jeu).
          for (const h of heroesOf(state, state.activePlayer)) {
            if ((h.strength ?? 0) <= 3) {
              out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, targetHeroId: h.instanceId })
            }
          }
          const peachPresent = heroesOf(state, state.activePlayer).some((h) => h.cardId === 'peach')
          if (peachPresent && !me.peachCaptured) {
            out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId })
          }
        } else if ((card.effects ?? []).some((e) => e.type === 'PIGKEEPER_RESOLVE')) {
          // Le Seigneur des Ténèbres — On te tient : Éliminer un Héros de force ≤1 (une
          // option/cible) OU chercher Tirelire (option sans cible, si elle est dans la
          // pioche/défausse Fatalité).
          for (const h of heroesOf(state, state.activePlayer)) {
            if ((h.strength ?? 0) <= 1) {
              out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId, targetHeroId: h.instanceId })
            }
          }
          if (me.fateDeck.some((c) => c.cardId === 'hen-wen') || me.fateDiscard.some((c) => c.cardId === 'hen-wen')) {
            out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId })
          }
        } else {
          // Cartes-effets sans intérêt s'il n'y a AUCUN Héros dans le royaume :
          // Téléportation (se rendre sur le lieu d'un Héros), Brouillage (faire les
          // actions recouvertes par un Héros) et Tourbillon (déplacer un Héros). Le
          // bot ne doit pas les jouer à vide.
          // Isabella — une ACTIVITÉ (à `allowedHours`) se joue pour valider l'heure même sans
          // Héros (son 2e effet est alors sans effet) : on ne l'exclut pas pour « pas de Héros ».
          const isActivite = !!(card.allowedHours && card.allowedHours.length > 0)
          const needsHeroPresent = !isActivite && (card.effects ?? []).some(
            (e) =>
              e.type === 'TELEPORT_TO_HERO' ||
              e.type === 'GRANT_USE_COVERED_ACTION' ||
              e.type === 'RELOCATE_OWN_HERO' ||
              e.type === 'RELOCATE_HERO_ADJACENT' ||
              // Douze coups de minuit : élimine tous les Héros → inutile si aucun.
              e.type === 'INSTANT_VANQUISH_ALL_HEROES',
          )
          if (needsHeroPresent && heroesOf(state, state.activePlayer).length === 0) continue
          // Sombra — Skycode (gain par piratage) / Protocole Sombra (détruit les piratages,
          // ou victoire si tous les lieux piratés) : inutiles sans aucun Piratage/IEM ni
          // Héros piraté dans le royaume.
          const needsHackInPlay = (card.effects ?? []).some(
            (e) => e.type === 'GAIN_POWER_PER_HACK' || e.type === 'SOMBRA_PROTOCOL',
          )
          if (
            needsHackInPlay &&
            !Object.values(me.board).flat().some((c) => c.isPiratage || (c.type === 'hero' && c.abilityHacked))
          )
            continue
          // Alignement des planètes (Hadès) : inutile si AUCUN Titan n'est entravé.
          const needsTrappedTitan = (card.effects ?? []).some((e) => e.type === 'UNTRAP_TITANS_PAY')
          if (needsTrappedTitan && !Object.values(me.board).flat().some((c) => c.isTitan && c.trapped)) continue
          // Préparez-vous au combat ! (Hadès) : inutile s'il n'existe aucun Titan
          // non entravé pouvant être déplacé (et finançable si le déplacement est payant).
          const titanMove = (card.effects ?? []).find((e) => e.type === 'MOVE_TITAN_INTERACTIVE')
          if (titanMove && titanMove.type === 'MOVE_TITAN_INTERACTIVE') {
            if (titanMove.paid && me.power < 2) continue
            const hasMovableTitan = Object.values(me.board)
              .flat()
              .some(
                (c) =>
                  c.isTitan &&
                  !c.trapped &&
                  titanReachableDests(state, state.activePlayer, c.instanceId, titanMove.maxSteps).length > 0,
              )
            if (!hasMovableTitan) continue
          }
          // Joyeux non-anniversaire : inutile sans aucun Allié dans le royaume.
          const needsAllyInRealm = (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_ALLY_IN_REALM')
          if (needsAllyInRealm && !Object.values(me.board).flat().some((c) => c.type === 'ally')) continue
          // Magnifiques Taxes / Appât / Tu ressembles à des fruits de mer : inutile sans
          // aucun Héros dans le royaume.
          const needsHeroInRealm = (card.effects ?? []).some(
            (e) =>
              e.type === 'GAIN_POWER_PER_HERO_IN_REALM' ||
              e.type === 'DRAW_PER_HERO_IN_REALM' ||
              e.type === 'DEFEAT_HERO_PAY_STRENGTH' ||
              e.type === 'ADD_MINUS_FORCE_TOKENS',
          )
          if (needsHeroInRealm && !Object.values(me.board).flat().some((c) => c.type === 'hero')) continue
          // Foudre / Manipulation : injouable sans carte à reproduire dans la pile source
          // (Ingrédients pour Foudre, Artéfacts pour Manipulation).
          const dupEffect = (card.effects ?? []).find((e) => e.type === 'DUPLICATE_INGREDIENT')
          if (dupEffect && dupEffect.type === 'DUPLICATE_INGREDIENT') {
            const dupArtifacts = dupEffect.zone === 'artifacts'
            const dupZone = dupArtifacts ? (me.artifacts ?? []) : (me.ingredients ?? [])
            // Khadgar (nullifiesArtifacts) neutralise les Artéfacts → Manipulation inutile.
            const khadgar = dupArtifacts && Object.values(me.board).flat().some((c) => c.type === 'hero' && c.nullifiesArtifacts)
            if (dupZone.length === 0 || khadgar) continue
          }
          // Isabella — Activité : jouable seulement si l'heure courante figure dans allowedHours.
          if (card.allowedHours && card.allowedHours.length > 0 && !card.allowedHours.includes(me.clockHour ?? 0)) continue
          // Actions recouvertes : « Je vais vous broyer les os ! » / Bravo ! → Héros sur le
          // lieu du pion ; Tamatoa — Piégé (`exceptFate`, « n'importe quel Héros ») → Héros
          // n'importe où dans le royaume.
          const covEffect = (card.effects ?? []).find((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN')
          if (covEffect && covEffect.type === 'USE_COVERED_ACTIONS_THIS_TURN') {
            if (covEffect.exceptFate) {
              if (!Object.values(me.board).flat().some((c) => c.type === 'hero')) continue
            } else if (!(me.pawnLocation && (me.board[me.pawnLocation] ?? []).some((c) => c.type === 'hero'))) continue
          }
          // « Croque ! » : inutile si aucun Héros éliminable ici (Poison insuffisant).
          const needsBite = (card.effects ?? []).some((e) => e.type === 'TAKE_A_BITE')
          if (needsBite && !canTakeABite(state)) continue
          // Festin (Scar) : inutile sans Hyène dans le royaume.
          if (card.requiresHyenaInRealm && !Object.values(me.board).flat().some((c) => c.isHyena)) continue
          // Évolution (Team Rocket) : inutile sans Allié dans le royaume.
          if (card.requiresAllyInRealm && !Object.values(me.board).flat().some((c) => c.type === 'ally')) continue
          // Suivez-moi ! (Scar) : injouable sans Hyène sur un autre lieu que le pion.
          if (
            (card.effects ?? []).some((e) => e.type === 'FOLLOW_ME') &&
            !me.locations.some((l) => l.id !== me.pawnLocation && (me.board[l.id] ?? []).some((c) => c.isHyena))
          )
            continue
          // Petit secret (Scar) : injouable sans Héros ni Événement en défausse Fatalité.
          if (
            (card.effects ?? []).some((e) => e.type === 'PLAY_FATE_HERO_FROM_DISCARD') &&
            !me.fateDiscard.some((c) => c.type === 'hero' || c.type === 'effect')
          )
            continue
          // Le chemin qui balance (Yzma) : inutile sans jeton Pouvoir sur Kronk.
          if (
            (card.effects ?? []).some((e) => e.type === 'KRONK_DISCARD_TOKENS') &&
            !Object.values(me.board).flat().some((c) => c.cardId === 'kronk' && (c.kronkPower ?? 0) > 0)
          )
            continue
          // Fausses funérailles (Yzma) / Indigne de moi (Dio) : inutile sans Héros en
          // défausse Fatalité NI Héros retiré du jeu (Jotaro/Joseph, Dio uniquement).
          if (
            (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_FATE_DISCARD_HERO') &&
            !me.fateDiscard.some((c) => c.type === 'hero') &&
            (me.removedFromGame ?? []).length === 0
          )
            continue
          // Beauté endormie (Yzma) : jouable uniquement en PREMIÈRE action du tour.
          if (
            (card.effects ?? []).some((e) => e.type === 'BEAUTY_SLEEP') &&
            state.usedActionIds.some((a) => !a.includes(':'))
          )
            continue
          // « Je t'aime bien plus » (Gothel) : inutile si le pion n'est pas sur le
          // lieu de Raiponce (l'Événement n'aurait aucun effet).
          if (
            card.type === 'effect' &&
            (card.effects ?? []).some((e) => e.type === 'GAIN_CONFIANCE_WITH_RAIPONCE') &&
            raiponceLocation(me) !== me.pawnLocation
          )
            continue
          // Le diable l'emporte (Cruella) : inutile sans carte récupérable en défausse.
          {
            const rec = (card.effects ?? []).find((e) => e.type === 'RECOVER_FROM_DISCARD_CHOICE')
            if (rec && rec.type === 'RECOVER_FROM_DISCARD_CHOICE' && !me.discard.some((c) => rec.types.includes(c.type)))
              continue
          }
          // Dio — Vampirisme / Gul'dan — Drain d'Âme : injouable sans Allié défaussable
          // dans le royaume (associés/arceaux/indéfaussables exclus).
          if (
            (card.effects ?? []).some((e) => e.type === 'DIO_DISCARD_ALLY_DRAW' || e.type === 'DISCARD_ALLY_DRAW') &&
            !Object.values(me.board).flat().some((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket && !c.cannotBeDiscarded)
          )
            continue
          // Finissez le travail ! (Cruella) : inutile sans capacité activable finançable.
          if (
            (card.effects ?? []).some((e) => e.type === 'GRANT_FREE_ACTIVATE') &&
            !Object.values(me.board).flat().some((c) => c.activatedCost !== undefined && c.activatedCost <= me.power)
          )
            continue
          // Le Seigneur des clés — Toute Puissance / C'est moi qui décide / Pierre
          // tombale : inutiles sans clé sur le lieu du pion. 00:00 : inutile sans clé
          // sur le plateau.
          if (
            (card.effects ?? []).some((e) => e.type === 'TAKE_KEY_AT_PAWN' || e.type === 'ROLL_DIE_TAKE_KEY_AT_PAWN') &&
            !(me.keys ?? []).some((k) => k.location === me.pawnLocation && !k.stolenBy)
          )
            continue
          if (
            (card.effects ?? []).some((e) => e.type === 'CHOOSE_COLOR_ROLL_TAKE_KEY' || e.type === 'ROLL_DIE_TAKE_KEY_FROM_BOARD') &&
            !(me.keys ?? []).some((k) => k.location !== null && !k.stolenBy)
          )
            continue
          // Répondez ! (0 Pouvoir sinon) / Trop facile / Plus qu'une minute (« perdez
          // une clé ») : inutiles sans clé possédée.
          if (
            (card.effects ?? []).some(
              (e) => e.type === 'GAIN_POWER_PER_KEY_COLOR' || e.type === 'LOSE_KEY_GAIN_POWER' || e.type === 'LOSE_KEY_DRAW',
            ) &&
            !(me.keys ?? []).some((k) => k.location === null && !k.stolenBy)
          )
            continue
          out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId })
        }
      }
    } else if (action.type === 'DISCARD_CARDS' && me.hand.length > 0) {
      // Le bot peut défausser PLUSIEURS cartes. Pour rester rapide (la recherche
      // explose si on énumère tous les sous-ensembles), on propose : chaque carte
      // seule, chaque « toutes sauf une » (défausser le reste en gardant la
      // meilleure) et « toute la main ». Le lookahead jusqu'à END_TURN évalue la
      // repioche, donc ces options suffisent à cycler une main faible.
      // On NE défausse JAMAIS une carte cruciale pour l'objectif (Trident/Couronne
      // d'Ursula, etc.) : elle doit être posée, pas jetée pour cycler.
      const critical = objectiveCriticalCardIds(me)
      // On préserve aussi les cartes à FORTE valeur stratégique : véhicules (Char
      // d'Hadès, Bateau de Bowser → déplacement gratuit du pion = actions en plus)
      // et Objets qui accordent une action supplémentaire. À poser, pas à jeter.
      const discardable = me.hand.filter(
        (c) => !critical.has(c.cardId) && !c.ridesWithPawn && !c.grantsAction,
      )
      for (const c of discardable) {
        out.push({ type: 'DISCARD_CARDS', actionId: action.id, instanceIds: [c.instanceId] }) // une carte
      }
      // Multi-défausse « si nécessaire » : se débarrasser d'un coup des cartes
      // INJOUABLES ce tour (coût > pouvoir disponible) pour repiocher. Une seule
      // option (bornée) — éviter d'exploser la recherche du bot.
      const dead = discardable.filter((c) => effectiveCost(state, c) > me.power).map((c) => c.instanceId)
      if (dead.length >= 2) {
        out.push({ type: 'DISCARD_CARDS', actionId: action.id, instanceIds: dead })
      }
    } else if (action.type === 'FATE' && canFate(state)) {
      out.push({ type: 'FATE', actionId: action.id })
    } else if (action.type === 'ACTIVATE') {
      // Une option par carte activable. Les capacités exigeant des paramètres
      // (Iago : lieu/objet) échouent à la simulation et sont écartées par le
      // try/catch du lookahead — sans gêner les capacités simples (transformer une
      // Carte Garde en arceau pour la Reine de Cœur, Bowser Jr., Galaxie hantée…).
      for (const c of activatableCards(state)) {
        out.push({ type: 'ACTIVATE', actionId: action.id, cardInstanceId: c.instanceId })
      }
    } else if (action.type === 'MOVE_ITEM_ALLY') {
      for (const { instanceId, from } of movableCards(state)) {
        const moving = (me.board[from] ?? []).find((c) => c.instanceId === instanceId)
        for (const to of adjacentLocationIds(state, from)) {
          // Anastasie/Javotte : pas dans la Salle de Bal (lieux interdits par carte).
          if ((moving?.forbiddenLocations ?? []).includes(to)) continue
          // Cendrillon en robe de bal : un Allié ne peut pas rejoindre la Salle de Bal.
          if (moving?.type === 'ally' && allyBlockedAt(state, state.activePlayer, to)) continue
          out.push({ type: 'MOVE_CARD', actionId: action.id, instanceId, to })
        }
      }
    } else if (action.type === 'MOVE_HERO') {
      // Déplacer un Héros du royaume vers un lieu voisin de sa position. Les
      // destinations illégales (restrictions) sont écartées par le try/catch du
      // lookahead. Utile surtout pour DÉCOUVRIR une action recouverte (le
      // lookahead voit alors l'action redevenue jouable).
      for (const loc of me.locations) {
        const heroes = (me.board[loc.id] ?? []).filter((c) => c.type === 'hero')
        for (const h of heroes) {
          for (const to of adjacentLocationIds(state, loc.id)) {
            out.push({ type: 'MOVE_HERO', actionId: action.id, heroInstanceId: h.instanceId, to })
          }
        }
      }
    } else if (action.type === 'VANQUISH') {
      for (const loc of me.locations) {
        const cell = me.board[loc.id] ?? []
        const heroes = cell.filter((c) => c.type === 'hero')
        if (heroes.length === 0) continue
        // Tamatoa — Quelque chose qui brille protège tous les Héros de son lieu.
        if (cell.some((c) => c.shieldsHeroesAtLocation && !c.attachedTo)) continue
        const localAllies = cell.filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
        const adjAllies = adjacentLocationIds(state, loc.id).flatMap((adj) =>
          (me.board[adj] ?? []).filter((c) => !c.trapped && (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers')),
        ).concat(anyLocReachers(me, loc.id))
        for (const h of heroes) {
          // Team Rocket — un Pokémon déjà COUCHÉ (K.O.) ne se re-vainc pas (il s'attrape).
          if (h.pokemonKO) continue
          const guarded = cell.some((c) => c.cardId === 'deguisement' && c.attachedTo === h.instanceId)
          if (guarded) continue
          const heroForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
          // Madame Mim — Métamorphose de Merlin : vaincue par la Métamorphose Mim
          // correspondante SUR son lieu, SANS force (la correspondance suffit).
          if (h.isMerlinTransformation) {
            const match = localAllies.find((a) => a.transformationTarget === h.cardId)
            if (match) {
              out.push({ type: 'VANQUISH', actionId: action.id, heroInstanceId: h.instanceId, allyInstanceIds: [match.instanceId] })
            }
            continue
          }
          // Héros de force 0 (réduit par Forme de grenouille…) : éliminable SANS Allié.
          if (heroForce === 0) {
            out.push({ type: 'VANQUISH', actionId: action.id, heroInstanceId: h.instanceId, allyInstanceIds: [] })
            continue
          }
          const usable =
            h.cardId === 'bobby'
              ? localAllies.filter((a) => a.cardId !== 'archers-loups')
              : [...localAllies, ...adjAllies]
          if (usable.length === 0) continue
          const allyForce = usable.reduce((n, a) => n + (effectiveStrength(state, state.activePlayer, a.instanceId) ?? 0), 0)
          if (allyForce >= heroForce) {
            out.push({ type: 'VANQUISH', actionId: action.id, heroInstanceId: h.instanceId, allyInstanceIds: usable.map((a) => a.instanceId) })
            // Bowser : proposer AUSSI un sous-ensemble MINIMAL qui priorise les Alliés
            // PORTEURS d'Étoile (les défausser au Vanquish retire l'Étoile du jeu →
            // épuisement verrouillé) tout en préservant les autres Alliés (on complète
            // avec les plus FAIBLES). Option en plus : la recherche tranche via l'éval.
            if (
              me.objective.type === 'DEPLETE_OBSERVATORY_AND_CAPTURE' &&
              usable.length > 1 &&
              usable.some((a) => (a.stars ?? 0) > 0)
            ) {
              const str = (a: CardInstance) => effectiveStrength(state, state.activePlayer, a.instanceId) ?? 0
              const ordered = [...usable].sort((a, b) => {
                const sa = (a.stars ?? 0) > 0 ? 1 : 0
                const sb = (b.stars ?? 0) > 0 ? 1 : 0
                if (sa !== sb) return sb - sa // porteurs d'Étoile d'abord
                return str(a) - str(b) // puis les plus faibles (préserver les gros Alliés)
              })
              const subset: string[] = []
              let acc = 0
              for (const a of ordered) {
                if (acc >= heroForce) break
                subset.push(a.instanceId)
                acc += str(a)
              }
              const carriesStar = subset.some(
                (id) => (usable.find((u) => u.instanceId === id)?.stars ?? 0) > 0,
              )
              if (subset.length < usable.length && carriesStar) {
                out.push({ type: 'VANQUISH', actionId: action.id, heroInstanceId: h.instanceId, allyInstanceIds: subset })
              }
            }
          }
        }
      }
    } else if (action.type === 'CATCH_POKEMON') {
      // Team Rocket — Attraper : prend un Pokémon DÉJÀ COUCHÉ (K.O.) → pile de Captures.
      // Aucun combat ni Allié (le Pokémon a déjà été vaincu via l'action Vaincre).
      for (const cell of Object.values(me.board)) {
        for (const h of cell) {
          if (h.isPokemon && h.pokemonKO) {
            out.push({ type: 'CATCH_POKEMON', actionId: action.id, heroInstanceId: h.instanceId, allyInstanceIds: [] })
          }
        }
      }
    }
  }

  // Défausser un Déguisement (2 JT, à tout moment) pour libérer un futur Vanquish.
  if (me.power >= 2) {
    for (const cards of Object.values(me.board)) {
      for (const c of cards) {
        if (c.cardId === 'deguisement') out.push({ type: 'DISCARD_DEGUISEMENT', instanceId: c.instanceId })
      }
    }
  }

  // Déplacement gratuit du Shérif de Nottingham (1×/tour par Shérif).
  for (const loc of me.locations) {
    for (const c of me.board[loc.id] ?? []) {
      if (c.cardId !== 'sherif-nottingham') continue
      if (state.usedActionIds.includes(`sheriff-move:${c.instanceId}`)) continue
      for (const dest of me.locations) {
        if (dest.id === loc.id) continue
        out.push({ type: 'SHERIFF_MOVE', instanceId: c.instanceId, to: dest.id })
      }
    }
  }
  // (Diablo se déplace en phase MOVE — voir la branche MOVE plus haut.)

  // Véhicule (Char d'Hadès / Bateau de Bowser) : si le pion est sur le lieu de
  // l'Objet et qu'il n'a pas servi ce tour, déplacer figurine + Objet ailleurs.
  if (state.phase === 'ACTION' && me.pawnLocation) {
    for (const c of me.board[me.pawnLocation] ?? []) {
      if (!c.ridesWithPawn) continue
      if (state.usedActionIds.includes(`chariot-move:${c.instanceId}`)) continue
      for (const dest of me.locations) {
        if (dest.id === me.pawnLocation) continue
        out.push({ type: 'CHARIOT_MOVE', instanceId: c.instanceId, to: dest.id })
      }
    }
  }

  // Canne (Dr Facilier) : si le pion est sur le lieu de la Canne et qu'elle n'a
  // pas servi ce tour, ouvrir le choix d'un lieu voisin où agir.
  if (
    state.phase === 'ACTION' &&
    me.pawnLocation &&
    !state.usedActionIds.includes('canne-action') &&
    (me.board[me.pawnLocation] ?? []).some((c) => c.cardId === 'canne')
  ) {
    out.push({ type: 'USE_CANNE' })
  }

  // Canne (Mr. Monopoly) : si le pion est sur la Canne, qu'elle n'a pas servi et qu'il
  // existe au moins un lieu adverse maisonné, ouvrir le choix d'action empruntée.
  if (
    state.phase === 'ACTION' &&
    me.pawnLocation &&
    !state.usedActionIds.includes('canne-action') &&
    (me.board[me.pawnLocation] ?? []).some((c) => c.cardId === 'custom-mr-monopoly-canne') &&
    state.players[state.activePlayer === 0 ? 1 : 0].locations.some((l) => (me.houses?.[l.id] ?? 0) > 0)
  ) {
    out.push({ type: 'USE_CANNE_MONOPOLY' })
  }

  return out
}

/** Permutations d'une liste courte (Divination : ≤ 3 éléments). Cap de sécurité à
 *  4 éléments (24 permutations) pour rester borné. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  if (items.length > 4) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([items[i], ...p])
  }
  return out
}
