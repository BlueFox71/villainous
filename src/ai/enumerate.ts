// =============================================================================
// enumerateActions — énumération déterministe de TOUS les coups légaux du joueur
// actif (ou des résolutions de Fatalité / actions gratuites en attente).
//
// Source unique de vérité partagée par les bots : randomBot en choisit un au
// hasard, heuristicBot les score et prend le meilleur. Pure : ne mute jamais
// l'état et n'utilise aucune source d'aléa.
// =============================================================================

import type { GameAction, GameState, PlayerState } from '../engine/types'
import { KEY_COLORS } from '../engine/types'
import { canEnterAuDela, raiponceLocation, titanReachableDests } from '../engine/effects'
import {
  adjacentLocationIds,
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
  effectiveCost,
  effectiveStrength,
  getAvailableActions,
  getLegalMoves,
  hasHeroInRealm,
  heroPlacementLocations,
  heroesOf,
  locationOfCard,
  maxBrewPoison,
  movableCards,
  placementLocations,
  requiresAllyTarget,
  transformableGuards,
} from '../engine/rules'

/** cardId des cartes CRUCIALES pour l'objectif du joueur (à NE PAS défausser par le
 *  bot) : les Objets/cartes qui doivent finir dans le royaume. Le Trident et la
 *  Couronne d'Ursula, la carte amassée (Cartes dans le royaume), la Lampe de Jafar… */
function objectiveCriticalCardIds(p: PlayerState): Set<string> {
  const o = p.objective
  switch (o.type) {
    case 'CARDS_IN_REALM':
      return new Set([o.cardId])
    case 'CONTROL_HERO':
      return new Set([o.itemCardId])
    case 'ITEMS_AT_LOCATION':
      return new Set(o.itemCardIds)
    default:
      return new Set<string>()
  }
}

/** Tous les coups légaux disponibles dans l'état courant. Toujours non vide tant
 *  que la partie est en cours (END_TURN / MOVE / résolutions sont garantis). */
export function enumerateActions(state: GameState): GameAction[] {
  const me = state.players[state.activePlayer]

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
        const localAllies = cell.filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
        const adjAllies = adjacentLocationIds(state, loc.id).flatMap((adj) =>
          (me.board[adj] ?? []).filter(
            (c) => !c.trapped && (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers'),
          ),
        )
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
      )
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
    if (pending.viaFollowMe) {
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
  // remplir la Pile de l'Au-delà → il y place toutes les cartes autorisées et
  // remet les autres (Talisman / Divination) sur la pioche.
  if (state.pendingFateScry) {
    const cards = state.pendingFateScry.cards
    const toAudelaIds = cards.filter((c) => canEnterAuDela(c)).map((c) => c.instanceId)
    const deckTopOrder = cards.filter((c) => !canEnterAuDela(c)).map((c) => c.instanceId)
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
        const dests = phr.forcedLocationId !== undefined
          ? [phr.forcedLocationId].filter((id): id is string => !!id && !locked.has(id))
          : phr.forcedDirection !== undefined
          ? [ids[i + phr.forcedDirection]].filter((id): id is string => !!id && !locked.has(id))
          : phr.anyLocation
            ? ids.filter((id) => id !== loc.id && !locked.has(id))
            : [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id && !locked.has(id))
        for (const to of dests) out.push({ type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: h.instanceId, to })
      }
    }
    // Poupées vaudou : déplacement facultatif → le bot peut aussi décliner.
    if (phr.optional) out.push({ type: 'SKIP_HERO_RELOCATE' })
    if (out.length > 0) return out
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
      for (const a of (tgt.board[loc.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)) {
        for (const to of ids.filter((id) => id !== loc.id && !locked.has(id))) {
          out.push({ type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: a.instanceId, to })
        }
      }
    }
    if (out.length > 0) return out
  }

  // Digne Adversaire / Obsession : le Héros révélé doit être JOUÉ ; on choisit le lieu.
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
    return state.pendingFateChoice.candidateIds.map((id) => ({ type: 'RESOLVE_FATE_CHOICE', instanceId: id }))
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
    const out: GameAction[] = []
    for (const card of revealed) {
      if (card.type === 'hero') {
        const locs = heroPlacementLocations(state, card, target)
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
        // à le vaincre d'abord — donc l'aiderait) sauf s'il n'y a aucun autre Héros.
        let provoTargets = targetHeroes
        if (card.cardId === 'provocation') {
          const nonPeter = targetHeroes.filter((h) => h.cardId !== 'peter-pan')
          if (nonPeter.length > 0) provoTargets = nonPeter
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
    const out: GameAction[] = getLegalMoves(state).map((to) => ({ type: 'MOVE', to }))
    if (me.skipNextMove) out.push({ type: 'SKIP_MOVE' })
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

  // Cruella — Finissez le travail ! : activation gratuite disponible → on propose
  // d'activer chaque capacité finançable, sans dépendre d'un lieu Activer.
  if (me.freeActivate) {
    for (const c of activatableCards(state)) {
      out.push({ type: 'ACTIVATE', actionId: 'free-activate', cardInstanceId: c.instanceId })
    }
  }

  for (const action of getAvailableActions(state)) {
    if (action.type === 'GAIN_POWER') {
      out.push({ type: 'EXECUTE_ACTION', actionId: action.id })
    } else if (action.type === 'OBTAIN_KEY') {
      // Le Seigneur des clés : ramasser une clé sur le lieu du pion (ouvre pendingKey).
      out.push({ type: 'OBTAIN_KEY', actionId: action.id })
    } else if (action.type === 'BREW_POISON') {
      // Préparer du Poison convertit N Pouvoir en N Poison : on propose au bot
      // « 1 » (prudent) et « tout convertir » (max). L'évaluation tranche.
      const max = maxBrewPoison(state)
      const counts = max > 1 ? [1, max] : [1]
      for (const count of counts) out.push({ type: 'EXECUTE_ACTION', actionId: action.id, count })
    } else if (action.type === 'PLAY_CARD') {
      const locs = placementLocations(state)
      const richardBlocks = hasHeroInRealm(state, state.activePlayer, 'roi-richard')
      for (const card of me.hand) {
        if (card.type === 'condition' || effectiveCost(state, card) > me.power) continue
        if (richardBlocks && card.type === 'effect') continue
        if (cardNeedsAllyMove(card)) continue // Tendre un Piège : combinatoire ignorée ici
        // Madame de Trémaine — Allié « en robe de bal » injouable sans sa version
        // ordinaire en jeu.
        if (card.replacesCardId && !Object.values(me.board).flat().some((c) => c.cardId === card.replacesCardId && !c.attachedTo)) continue
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
            for (const to of locs) {
              if (card.type === 'curse' && !canPlaceCurseAt(state, state.activePlayer, to, card)) continue
              if (card.playOnlyAt && to !== card.playOnlyAt) continue
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
            )
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
          const own = atPawn
            ? (me.board[me.pawnLocation ?? ''] ?? []).filter((c) => c.type === 'hero')
            : heroesOf(state, state.activePlayer)
          for (const h of own) {
            const forbidden = new Set(h.forbiddenLocations ?? [])
            if (card.cardId === 'emprisonnement' && forbidden.has('jail')) continue
            if (shrinks && h.heroSize === 'shrunk') continue
            if (hacks && h.abilityHacked) continue
            if ((h.strength ?? 0) > maxStrength) continue
            const hForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
            if (isHypnose && hForce > me.power) continue
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
        } else {
          // Cartes-effets sans intérêt s'il n'y a AUCUN Héros dans le royaume :
          // Téléportation (se rendre sur le lieu d'un Héros), Brouillage (faire les
          // actions recouvertes par un Héros) et Tourbillon (déplacer un Héros). Le
          // bot ne doit pas les jouer à vide.
          const needsHeroPresent = (card.effects ?? []).some(
            (e) =>
              e.type === 'TELEPORT_TO_HERO' ||
              e.type === 'GRANT_USE_COVERED_ACTION' ||
              e.type === 'RELOCATE_OWN_HERO',
          )
          if (needsHeroPresent && heroesOf(state, state.activePlayer).length === 0) continue
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
          // Magnifiques Taxes : inutile sans aucun Héros dans le royaume.
          const needsHeroInRealm = (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_HERO_IN_REALM')
          if (needsHeroInRealm && !Object.values(me.board).flat().some((c) => c.type === 'hero')) continue
          // Foudre : injouable sans Ingrédient déjà joué (rien à reproduire).
          const needsIngredient = (card.effects ?? []).some((e) => e.type === 'DUPLICATE_INGREDIENT')
          if (needsIngredient && (me.ingredients ?? []).length === 0) continue
          // « Je vais vous broyer les os ! » : inutile sans Héros sur le lieu du pion.
          const needsHeroHere = (card.effects ?? []).some((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN')
          if (needsHeroHere && !(me.pawnLocation && (me.board[me.pawnLocation] ?? []).some((c) => c.type === 'hero'))) continue
          // « Croque ! » : inutile si aucun Héros éliminable ici (Poison insuffisant).
          const needsBite = (card.effects ?? []).some((e) => e.type === 'TAKE_A_BITE')
          if (needsBite && !canTakeABite(state)) continue
          // Festin (Scar) : inutile sans Hyène dans le royaume.
          if (card.requiresHyenaInRealm && !Object.values(me.board).flat().some((c) => c.isHyena)) continue
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
          // Fausses funérailles (Yzma) : inutile sans Héros en défausse Fatalité.
          if (
            (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_FATE_DISCARD_HERO') &&
            !me.fateDiscard.some((c) => c.type === 'hero')
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
        for (const to of adjacentLocationIds(state, from)) {
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
        const localAllies = cell.filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
        const adjAllies = adjacentLocationIds(state, loc.id).flatMap((adj) =>
          (me.board[adj] ?? []).filter((c) => !c.trapped && (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers')),
        )
        for (const h of heroes) {
          const guarded = cell.some((c) => c.cardId === 'deguisement' && c.attachedTo === h.instanceId)
          if (guarded) continue
          const heroForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
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
