// =============================================================================
// enumerateActions — énumération déterministe de TOUS les coups légaux du joueur
// actif (ou des résolutions de Fatalité / actions gratuites en attente).
//
// Source unique de vérité partagée par les bots : randomBot en choisit un au
// hasard, heuristicBot les score et prend le meilleur. Pure : ne mute jamais
// l'état et n'utilise aucune source d'aléa.
// =============================================================================

import type { GameAction, GameState } from '../engine/types'
import { titanReachableDests } from '../engine/effects'
import {
  adjacentLocationIds,
  alliesAt,
  canFate,
  canPlaceCurseAt,
  cardNeedsAllyMove,
  cardNeedsHeroTarget,
  cardNeedsSacrificeTarget,
  cardNeedsVanquishTarget,
  effectiveCost,
  effectiveStrength,
  getAvailableActions,
  getLegalMoves,
  hasHeroInRealm,
  heroPlacementLocations,
  heroesOf,
  movableCards,
  placementLocations,
  requiresAllyTarget,
  transformableGuards,
} from '../engine/rules'

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

  // Colère Titanesque : choisir un lieu voisin où agir (puis on agit normalement).
  if (state.pendingGiantAction) {
    const p = state.players[state.pendingGiantAction.playerIndex]
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
        const dests = phr.anyLocation
          ? ids.filter((id) => id !== loc.id && !locked.has(id))
          : [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id && !locked.has(id))
        for (const to of dests) out.push({ type: 'RESOLVE_HERO_RELOCATE', heroInstanceId: h.instanceId, to })
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

  // Abu/Aladdin/K.O. : une option par carte candidate (Objet à voler / Allié à retirer).
  if (state.pendingFateChoice) {
    return state.pendingFateChoice.candidateIds.map((id) => ({ type: 'RESOLVE_FATE_CHOICE', instanceId: id }))
  }

  // Pas de Quartier ! : une option par (Allié déplaçable × lieu voisin non bloqué).
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
    return out
  }

  // Faites-leur peur ! : garder les Héros sur le dessus, défausser les non-Héros.
  if (state.pendingScry) {
    const heroes = state.pendingScry.cards.filter((c) => c.type === 'hero').map((c) => c.instanceId)
    return [{ type: 'RESOLVE_SCRY', topInstanceIds: heroes }]
  }

  // Fatalité révélée à résoudre : une option par carte révélée (× lieu / héros valides).
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
        if (targetHeroes.length > 0) {
          for (const h of targetHeroes) {
            out.push({ type: 'RESOLVE_FATE', instanceId: card.instanceId, targetHeroId: h.instanceId })
          }
        } else {
          // Aucun Héros éligible → résolution sans cible (l'engine défausse la carte).
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

  for (const action of getAvailableActions(state)) {
    if (action.type === 'GAIN_POWER') {
      out.push({ type: 'EXECUTE_ACTION', actionId: action.id })
    } else if (action.type === 'PLAY_CARD') {
      const locs = placementLocations(state)
      const richardBlocks = hasHeroInRealm(state, state.activePlayer, 'roi-richard')
      for (const card of me.hand) {
        if (card.type === 'condition' || effectiveCost(state, card) > me.power) continue
        if (richardBlocks && card.type === 'effect') continue
        if (cardNeedsAllyMove(card)) continue // Tendre un Piège : combinatoire ignorée ici
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
          } else {
            for (const to of locs) {
              if (card.type === 'curse' && !canPlaceCurseAt(state, state.activePlayer, to)) continue
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
          const own = atPawn
            ? (me.board[me.pawnLocation ?? ''] ?? []).filter((c) => c.type === 'hero')
            : heroesOf(state, state.activePlayer)
          for (const h of own) {
            const forbidden = new Set(h.forbiddenLocations ?? [])
            if (card.cardId === 'emprisonnement' && forbidden.has('jail')) continue
            if (shrinks && h.heroSize === 'shrunk') continue
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
        } else {
          out.push({ type: 'PLAY_CARD', actionId: action.id, instanceId: card.instanceId })
        }
      }
    } else if (action.type === 'DISCARD_CARDS' && me.hand.length > 0) {
      // Une option par carte de la main (défausse d'une seule carte).
      for (const c of me.hand) {
        out.push({ type: 'DISCARD_CARDS', actionId: action.id, instanceIds: [c.instanceId] })
      }
    } else if (action.type === 'FATE' && canFate(state)) {
      out.push({ type: 'FATE', actionId: action.id })
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
          const usable =
            h.cardId === 'bobby'
              ? localAllies.filter((a) => a.cardId !== 'archers-loups')
              : [...localAllies, ...adjAllies]
          if (usable.length === 0) continue
          const heroForce = effectiveStrength(state, state.activePlayer, h.instanceId) ?? 0
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

  // Char (Hadès) : si le pion est sur le lieu du Char et qu'il n'a pas servi ce
  // tour, déplacer figurine + Char vers n'importe quel autre lieu.
  if (state.phase === 'ACTION' && me.pawnLocation) {
    for (const c of me.board[me.pawnLocation] ?? []) {
      if (c.cardId !== 'char') continue
      if (state.usedActionIds.includes(`chariot-move:${c.instanceId}`)) continue
      for (const dest of me.locations) {
        if (dest.id === me.pawnLocation) continue
        out.push({ type: 'CHARIOT_MOVE', instanceId: c.instanceId, to: dest.id })
      }
    }
  }

  return out
}
