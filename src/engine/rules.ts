// =============================================================================
// Règles : coups légaux, actions disponibles, détection de victoire.
// Fonctions pures de lecture — elles ne modifient jamais l'état. Tout est
// évalué pour le JOUEUR ACTIF.
// =============================================================================

import type {
  CardInstance,
  GameState,
  GoalToken,
  LocationAction,
  LocationActionType,
  LocationId,
  PlayerState,
} from './types'
import { activePlayer, currentLocation } from './state'
import { isKingCandy, accessibleActionIds, racerCoveredActionId, isTrackLocation } from './kingCandy'
import { actionHasFire as shereKhanFire } from './shereKhan'
import { locationHasJudgmentTile } from './pyramidHead'
import { placeableHouses as monopolyPlaceableHouses, buyHouseCost as monopolyBuyHouseCost } from './monopoly'
import { paletteBlockedLocations } from './piegeur'

/**
 * Types d'actions que le moteur sait actuellement traiter (affichées comme
 * actives dans l'UI). Les autres (Fatalité, Éliminer, Déplacer) sont déjà sur
 * le plateau mais pas encore jouables.
 *
 * GAIN_POWER passe par EXECUTE_ACTION ; PLAY_CARD par PLAY_CARD ; DISCARD_CARDS
 * par DISCARD_CARDS.
 */
export const SUPPORTED_ACTION_TYPES: readonly LocationActionType[] = [
  'GAIN_POWER',
  'PLAY_CARD',
  'DISCARD_CARDS',
  'FATE',
  'MOVE_ITEM_ALLY',
  'MOVE_HERO',
  'VANQUISH',
  'CATCH_POKEMON',
  'REVEAL_FIGHTER',
  'ACTIVATE',
  'BREW_POISON',
  'OBTAIN_KEY',
]

/** Une action est-elle prise en charge par le moteur dans sa version actuelle ? */
export function isSupportedType(type: LocationActionType): boolean {
  return SUPPORTED_ACTION_TYPES.includes(type)
}

/**
 * Lieux où le joueur actif peut se déplacer : un lieu DIFFÉRENT du lieu courant
 * (au premier déplacement, les 4 lieux sont permis).
 */
export function getLegalMoves(state: GameState): LocationId[] {
  if (state.status !== 'PLAYING' || state.phase !== 'MOVE') return []
  // Yzma — Beauté endormie : tant que le réveil n'est pas résolu, le déplacement
  // est bloqué (« avant de vous déplacer… »).
  if (state.pendingBeautySleep) return []
  const p = activePlayer(state)
  // Sa Sucrerie — le pion ne « change pas de lieu » : il avance sur le circuit (action
  // MOVE_TRACK). Aucun déplacement vers une zone de cartes.
  if (isKingCandy(p)) return []
  const locked = new Set(p.lockedLocations ?? [])
  // Oogie Boogie — Sally : tant qu'elle est dans le royaume, le pion ne peut se
  // déplacer que vers un lieu VOISIN de sa position.
  // Le Piégeur (Dead by Daylight) : il ne se déplace QUE d'un lieu par tour → voisin.
  const sallyPresent = Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'sally')
  const isPiegeur = p.objective.type === 'PIEGEUR_ELIMINATE_ALL_SURVIVORS'
  const adjacentOnly = sallyPresent || isPiegeur
  const adj = adjacentOnly && p.pawnLocation ? new Set(adjacentLocationIds(state, p.pawnLocation)) : null
  // Le Piégeur — une PALETTE (Objet Fatalité) bloque son accès au lieu tant qu'elle y est.
  const paletteBlocked = isPiegeur ? paletteBlockedLocations(p) : null
  return p.locations
    .filter(
      (loc) =>
        loc.id !== p.pawnLocation &&
        !locked.has(loc.id) &&
        (!adj || adj.has(loc.id)) &&
        (!paletteBlocked || !paletteBlocked.has(loc.id)),
    )
    .map((loc) => loc.id)
}

/** Vrai si un déplacement vers `to` est légal dans l'état courant. */
export function isLegalMove(state: GameState, to: LocationId): boolean {
  return getLegalMoves(state).includes(to)
}

/** Les Héros présents sur un lieu donné du joueur actif. Exclut le Prisonnier
 *  (Oogie — Perce-Oreilles : n'est pas un Héros au sens du jeu). */
export function heroesAt(state: GameState, locationId: LocationId): CardInstance[] {
  return (activePlayer(state).board[locationId] ?? []).filter((c) => c.type === 'hero' && !c.isPrisoner)
}

/**
 * Une action est-elle RECOUVERTE par un Héros ? Un Héros posé sur un lieu (par
 * la Fatalité d'un adversaire) recouvre sa rangée du HAUT : ces actions
 * deviennent indisponibles. Les rangées du bas restent jouables.
 *
 * Exception : si Persifleur (`persifleurAvailable`) est encore actif, le joueur
 * peut utiliser UNE action recouverte sur le lieu de Persifleur — donc on la
 * considère comme NON recouverte le temps de cette utilisation.
 */
export function isActionCovered(state: GameState, action: LocationAction): boolean {
  // En général seules les actions du HAUT sont recouvertes, MAIS un Héros « coversExtraAction »
  // (Le Seigneur des clés — Hellin) recouvre aussi une action du bas → on ne court-circuite plus.
  const loc = currentLocation(state)
  if (!loc) return false
  // Persifleur : le joueur peut utiliser UNE action recouverte → on les considère
  // toutes jouables le temps de cette utilisation.
  if (state.persifleurAvailable) return false
  // « Je vais vous broyer les os ! » (La Méchante Reine) / Piégé (Tamatoa) : ce tour-ci,
  // les actions recouvertes du lieu deviennent jouables. Exception « Piégé » : les
  // Fatalités recouvertes RESTENT indisponibles (on ne court-circuite pas → calcul normal).
  if (state.uncoverCoveredActions && !(state.uncoverExceptFate && action.type === 'FATE')) return false
  // Sa Sucrerie — le jeton Pilote recouvre l'action où il se trouve (sauf Turbo-Statique
  // ce tour). Les Héros ne recouvrent pas d'action de circuit (placement non positionnel).
  const me = activePlayer(state)
  // Shere Khan — un jeton Feu recouvre une action PRÉCISE (haut ou bas). Bravo ! Bravo !
  // (uncoverFireThisTurn) lève cette couverture ce tour. Les Yeux de Kaa ne lèvent PAS le Feu.
  if (me.villain === 'shere-khan' && !state.uncoverFireThisTurn && shereKhanFire(me, loc.id, action.id)) {
    return true
  }
  // Pyramid Head — une TUILE DE JUGEMENT recouvre les actions du HAUT de son lieu (comme un Héros).
  if (me.villain === 'custom-pyramid-head' && action.row === 'top' && locationHasJudgmentTile(me, loc.id)) {
    return true
  }
  if (isKingCandy(me)) {
    if (me.turboUncoverThisTurn) return false
    return racerCoveredActionId(me) === action.id
  }
  // Yeux de Kaa associé à Kaa sur le lieu du pion : les actions recouvertes par un HÉROS
  // y sont utilisables (le Feu, lui, reste couvert — traité au-dessus).
  if (me.villain === 'shere-khan' && kaaEyesUncoverHeroesAt(me, loc.id)) return false
  // Isabella — SŒUR KRONE : si elle est sur le lieu du pion, Isabella peut utiliser les
  // actions recouvertes par un Héros de ce lieu (approx : toutes, comme les Yeux de Kaa).
  if ((me.board[loc.id] ?? []).some((c) => c.unlocksCoveredActionsHere)) return false
  return coveredTopActionIdsAt(me, loc.id).has(action.id)
}

/** Yeux de Kaa : Kaa porte les Yeux ET se trouve sur `locationId` ET le pion y est aussi
 *  → le joueur peut utiliser les actions recouvertes par un Héros de ce lieu. */
function kaaEyesUncoverHeroesAt(player: PlayerState, locationId: LocationId): boolean {
  if (player.pawnLocation !== locationId) return false
  const cell = player.board[locationId] ?? []
  const kaa = cell.find((c) => c.cardId === 'kaa')
  if (!kaa) return false
  return cell.some((c) => c.cardId === 'yeux-de-kaa' && c.attachedTo === kaa.instanceId)
}

/** Ids des actions du HAUT recouvertes sur un lieu donné, **indépendamment du
 *  pion** (utilisable par l'UI pour le rendu, et par isActionCovered pour le
 *  joueur actif). Règles :
 *   - Héros NORMAL ou AGRANDI sur le lieu → recouvre TOUTE la rangée du haut ;
 *   - Héros RAPETISSÉ → ne recouvre qu'UNE action : celle qu'il NE libère PAS
 *     (`shrunkFreeActionId` ; à défaut on libère la 1ʳᵉ action du haut) ;
 *   - Héros AGRANDI d'un lieu VOISIN → peut recouvrir une action de bord ici
 *     (cf. enlargeCoveredAction).
 *  Les Héros hypnotisés (sous contrôle) ne recouvrent rien. */
export function coveredTopActionIdsAt(player: PlayerState, locationId: LocationId): Set<string> {
  const covered = new Set<string>()
  const loc = player.locations.find((l) => l.id === locationId)
  if (!loc) return covered
  const tops = loc.actions.filter((a) => a.row === 'top')
  const heroesHere = (player.board[locationId] ?? []).filter(
    // Un Héros hypnotisé (contrôlé) ou le Prince (allié de Madame de Trémaine) ne recouvre
    // aucune action. Un Héros PIÉGÉ (jeton Enfermé — Madame de Trémaine) perd sa CAPACITÉ
    // mais reste physiquement présent → il CONTINUE de recouvrir la rangée du haut.
    // Lotso — Buzz l'Éclair en mode GARDIEN recouvre la rangée du haut comme un Héros.
    (c) =>
      // Team Rocket — un Pokémon COUCHÉ (K.O.) ne recouvre plus d'action (il est vaincu).
      // Le Piégeur — un Survivant FACE CACHÉE (non révélé) ne recouvre rien ; une fois
      // révélé, il recouvre la rangée du haut comme un Héros classique.
      (c.type === 'hero' &&
        !c.attachedTo && // Grand Councilwoman — STITCH enfermé (associé à la CAGE) ne recouvre plus rien.
        !c.hypnotized &&
        !c.loved &&
        !c.pokemonKO &&
        c.cardId !== 'the-prince' &&
        (!c.isSurvivor || c.revealed)) ||
      (c.isBuzz && c.buzzMode === 'guardian'),
  )
  for (const h of heroesHere) {
    if (h.heroSize === 'shrunk') {
      const freed = h.shrunkFreeActionId ?? tops[0]?.id
      for (const a of tops) if (a.id !== freed) covered.add(a.id)
    } else {
      for (const a of tops) covered.add(a.id)
    }
  }
  // Tamatoa — Quelque chose qui brille (Objet, non associé) recouvre la rangée du haut
  // comme un Héros.
  if ((player.board[locationId] ?? []).some((c) => c.coversActionsLikeHero && !c.attachedTo)) {
    for (const a of tops) covered.add(a.id)
  }
  // Le Seigneur des clés — Hellin (coversExtraAction) : recouvre AUSSI la 1ʳᵉ action
  // du bas (3 actions recouvertes au lieu de 2).
  if (heroesHere.some((h) => h.coversExtraAction)) {
    const firstBottom = loc.actions.find((a) => a.row === 'bottom')
    if (firstBottom) covered.add(firstBottom.id)
  }
  // Débordement d'un Héros agrandi d'un lieu voisin (action de bord recouverte ici).
  for (const cards of Object.values(player.board)) {
    for (const c of cards) {
      const cov = enlargeCoveredAction(player, c)
      if (cov && cov.locationId === locationId) covered.add(cov.actionId)
    }
  }
  // L'Imposteur — un Coéquipier SUSPECT recouvre l'action du HAUT de sa case
  // (slot 0 = 1ʳᵉ action du haut, slot 1 = 2ᵉ) : elle devient indisponible.
  for (const crew of player.crewmates ?? []) {
    if (crew.discarded || !crew.suspect || crew.locationId !== locationId || crew.row !== 'top') continue
    const a = tops[crew.slot]
    if (a) covered.add(a.id)
  }
  return covered
}

/** Action du haut recouverte chez un lieu VOISIN par un Héros agrandi (Reine de
 *  Cœur — Agrandir). Le Héros « pivote » vers le voisin désigné (`enlargeTargetId`)
 *  et recouvre l'action du haut la plus PROCHE de lui (le bord adjacent) :
 *   - voisin de DROITE  → son action du haut la plus à GAUCHE ;
 *   - voisin de GAUCHE  → son action du haut la plus à DROITE.
 *  Renvoie null si la carte n'est pas un Héros agrandi actif, ou sans voisin valide.
 *  Source unique partagée par le moteur (recouvrement) et l'UI (marquage visuel). */
export function enlargeCoveredAction(
  player: PlayerState,
  hero: CardInstance,
): { locationId: LocationId; actionId: string } | null {
  if (hero.type !== 'hero' || hero.heroSize !== 'enlarged' || hero.hypnotized || hero.loved) return null
  if (!hero.enlargeTargetId) return null
  const heroLoc = locationOfCard(player, hero.instanceId)
  if (!heroLoc) return null
  const ids = player.locations.map((l) => l.id)
  const i = ids.indexOf(heroLoc)
  const targetIdx = ids.indexOf(hero.enlargeTargetId)
  if (i < 0 || targetIdx < 0 || targetIdx === i) return null
  const tops = player.locations[targetIdx].actions.filter((a) => a.row === 'top')
  if (tops.length === 0) return null
  // Voisin de droite (targetIdx > i) → action la plus à gauche (index 0) ;
  // voisin de gauche → action la plus à droite (dernier index).
  const covered = targetIdx > i ? tops[0] : tops[tops.length - 1]
  return { locationId: player.locations[targetIdx].id, actionId: covered.id }
}

/** Actions d'un lieu du joueur actif : actions IMPRIMÉES + actions ACCORDÉES par
 *  des Objets posés sur ce lieu (Capitaine Crochet : Canon → Vaincre, Boîte à
 *  Crochets → Gagner 1, Ingénieux Mécanisme → Déplacer un Héros). Les actions
 *  accordées sont en rangée « bas » → jamais recouvertes par un Héros. */
export function locationActions(state: GameState, locationId: LocationId): LocationAction[] {
  const p = activePlayer(state)
  const loc = p.locations.find((l) => l.id === locationId)
  if (!loc) return []
  const granted = (p.board[locationId] ?? [])
    .filter((c) => c.grantsAction && !c.attachedTo)
    .map(
      (c): LocationAction => ({
        id: `granted:${c.instanceId}`,
        type: c.grantsAction!.type,
        label: c.grantsAction!.label,
        amount: c.grantsAction!.amount,
        row: 'bottom',
        grantedBy: c.instanceId,
      }),
    )
  return [...loc.actions, ...granted]
}

/**
 * Actions exécutables sur le lieu courant : prises en charge, pas encore jouées
 * ce tour-ci, et non recouvertes par un Héros. Vide hors de la phase ACTION.
 */
export function getAvailableActions(state: GameState): LocationAction[] {
  if (state.status !== 'PLAYING' || state.phase !== 'ACTION') return []
  // Yzma — Beauté endormie : verrou « seule action » → plus aucune action ce tour.
  if (activePlayer(state).soleActionLock) return []
  // Le Seigneur des clés — Peste : plafond d'actions ce tour. Au-delà, plus d'action
  // de lieu (on compte les actions de lieu jouées = ids non scopés).
  const cap = activePlayer(state).actionsCap
  if (cap !== undefined && state.usedActionIds.filter((id) => !id.includes(':')).length >= cap) return []
  const loc = currentLocation(state)
  if (!loc) return []
  // La Méchante Reine — Noir de nuit : tant que le drapeau est armé, une action
  // (hors Fatalité) déjà utilisée redevient disponible (réutilisation unique).
  const REPEATABLE = new Set<string>(['GAIN_POWER', 'BREW_POISON', 'PLAY_CARD', 'DISCARD_CARDS'])
  const canRepeat = !!activePlayer(state).repeatActionAvailable
  // Sa Sucrerie — seules les 3 actions accessibles depuis la position du pion (dessus
  // + devant + derrière) sont jouables ce tour.
  const kc = isKingCandy(activePlayer(state))
  const accessible = kc ? accessibleActionIds(activePlayer(state)) : null
  // Dio — ZA WARUDO! (temps arrêté) : la Fatalité est exclue, et chaque action coûte un
  // Pouvoir croissant (1, 2, 3…), PLAFONNÉ à 10 — une action n'est jouable que si Dio peut
  // payer ce coût.
  const za = activePlayer(state).zaWarudoActive
  const zaCost = Math.min(10, (activePlayer(state).zaWarudoActionsDone ?? 0) + 1)
  if (za && activePlayer(state).power < zaCost) return []
  // Pendant ZA WARUDO! le « déjà fait ce tour » se suit PAR LIEU (clé `lieu:action`)
  // via dioRealmActionsThisTurn : chaque action de chaque lieu n'est jouable QU'UNE fois,
  // indépendamment de usedActionIds (qui n'est pas réinitialisé entre les lieux focalisés).
  const zaDone = activePlayer(state).dioRealmActionsThisTurn ?? []
  return locationActions(state, loc.id).filter(
    (a) =>
      isSupportedType(a.type) &&
      // FATE exclue pendant ZA WARUDO! (Dio) et pendant « Reculez de trois cases » (Monopoly).
      (a.type !== 'FATE' || (!za && !state.monopolyNoFate)) &&
      (!accessible || accessible.has(a.id)) &&
      (za
        ? !zaDone.includes(`${loc.id}:${a.id}`)
        : !state.usedActionIds.includes(a.id) ||
          (canRepeat && REPEATABLE.has(a.type)) ||
          // Cruella — Finissez le travail ! : une action Activer gratuite reste possible
          // même si l'action de lieu a déjà servi ce tour.
          (a.type === 'ACTIVATE' && !!activePlayer(state).freeActivate)) &&
      // Smogogo (actAtLocationIgnoreCover) : « recouverte ou non » → la couverture est ignorée.
      (!isActionCovered(state, a) || !!state.actAtLocationIgnoreCover) &&
      // Sombra : une action piratée (recouverte par un Hack) est désactivée.
      !isActionHacked(activePlayer(state), loc.id, a.id) &&
      // « Activer » n'est disponible que s'il existe une carte activable OU, pour le
      // Seigneur des Ténèbres, un Chaudron Magique en sa possession à réveiller (l'action
      // Activer est donnée par les Squelettes de Soldats).
      (a.type !== 'ACTIVATE' || activatableCards(state).length > 0 || activePlayer(state).blackCauldron === 'claimed') &&
      // « Préparer du Poison » indisponible si aucun Pouvoir n'est convertible
      // (0 Pouvoir, ou 1 Pouvoir entièrement absorbé par le surcoût Timide).
      (a.type !== 'BREW_POISON' || maxBrewPoison(state) >= 1) &&
      // Le Seigneur des clés — « Obtenir une clé » (lancer du dé) indisponible si plus
      // aucune clé sur le plateau (le dé n'aurait rien à ramasser).
      (a.type !== 'OBTAIN_KEY' || (activePlayer(state).keys ?? []).some((k) => k.location !== null && !k.stolenBy)) &&
      // Tabbou — « Dévoiler une tuile Combattant » indisponible si l'action n'aurait
      // aucun effet : pioche de tuiles vide, ou pas assez de Pouvoir (1 JT/tuile, surcoût
      // Kirby inclus). Le plafond Link ne rend pas l'action indisponible (≥1 reste possible).
      (a.type !== 'REVEAL_FIGHTER' || maxRevealFighters(state) >= 1),
  )
}

/** Vrai si l'action `actionId` est disponible sur le lieu courant. */
export function isActionAvailable(state: GameState, actionId: string): boolean {
  return getAvailableActions(state).some((a) => a.id === actionId)
}

/** Sombra : l'action `actionId` du lieu `locationId` est-elle PIRATÉE (recouverte
 *  par un Hack) ? Vrai si une carte de Piratage posée sur ce lieu cible cette action
 *  (`hackedActionId`). Tant qu'elle y est, l'action est désactivée. */
export function isActionHacked(p: PlayerState, locationId: LocationId, actionId: string): boolean {
  return (p.board[locationId] ?? []).some((c) => c.isPiratage && c.hackedActionId === actionId)
}

/** Les Alliés du joueur actif présents sur un lieu donné (cibles d'association
 *  possibles pour un Objet « à associer »). Les arceaux (Cartes Gardes
 *  transformées) restent des porteurs valides : la Lance peut s'y associer
 *  (+1 force → arceau plus difficile à franchir au Coup Royal). */
export function alliesAt(state: GameState, locationId: LocationId): CardInstance[] {
  return (activePlayer(state).board[locationId] ?? []).filter((c) => c.type === 'ally')
}

/** Reine de Cœur — Cartes Gardes transformables en arceaux par « Par ordre de la
 *  Reine ! » : Allié `gardes-*` non encore arceau, hors d'un lieu où se trouve le
 *  Dodo (qui interdit cette transformation sur son lieu). */
export function transformableGuards(
  state: GameState,
  playerIndex: number = state.activePlayer,
): CardInstance[] {
  const p = state.players[playerIndex]
  const out: CardInstance[] = []
  for (const loc of p.locations) {
    const cell = p.board[loc.id] ?? []
    if (cell.some((c) => c.type === 'hero' && c.cardId === 'dodo')) continue
    for (const c of cell) {
      if (c.type === 'ally' && c.cardId.startsWith('gardes-') && !c.isWicket) out.push(c)
    }
  }
  return out
}

/**
 * Lieux où le joueur actif peut POSER une carte (Allié/Objet). Règle officielle
 * « Play a Card » : n'importe lequel de ses lieux **non verrouillés** — pas
 * seulement le lieu courant. Le recouvrement par un Héros bloque les ACTIONS
 * d'un lieu, pas la pose d'un Allié dessus. Le Prince Jean n'a aucun verrou, donc
 * ses 4 lieux sont toujours des destinations valides.
 */
export function placementLocations(state: GameState): LocationId[] {
  const p = activePlayer(state)
  const locked = new Set(p.lockedLocations ?? [])
  // Sa Sucrerie : on pose dans les 4 zones, jamais sur le circuit lui-même.
  return p.locations.map((l) => l.id).filter((id) => !locked.has(id) && !isTrackLocation(p, id))
}

/** Vrai si le joueur actif peut poser une carte sur ce lieu. */
export function canPlaceAt(state: GameState, locationId: LocationId): boolean {
  return placementLocations(state).includes(locationId)
}

/** Lieux d'un joueur où Slenderman peut se téléporter : ceux portant au moins un
 *  Héros SANS Lampe de poche associée (Téléportation / Lampe de poche). */
export function teleportTargets(player: PlayerState): LocationId[] {
  return player.locations
    .map((l) => l.id)
    .filter((id) => {
      const cell = player.board[id] ?? []
      const lamped = new Set(
        cell.filter((c) => c.cardId === 'lampe-de-poche' && c.attachedTo).map((c) => c.attachedTo as string),
      )
      return cell.some((c) => c.type === 'hero' && !lamped.has(c.instanceId))
    })
}

/** Lieux voisins (adjacents, ±1 dans l'ordre du plateau) d'un lieu donné.
 *  Les lieux VERROUILLÉS sont exclus : on ne peut rien y déplacer (règle des
 *  lieux verrouillés, Jafar — Caverne aux Merveilles). */
export function adjacentLocationIds(state: GameState, locationId: LocationId): LocationId[] {
  const me = activePlayer(state)
  const ids = me.locations.map((l) => l.id)
  const locked = new Set(me.lockedLocations ?? [])
  const i = ids.indexOf(locationId)
  if (i < 0) return []
  const out: LocationId[] = []
  if (i > 0) out.push(ids[i - 1])
  if (i < ids.length - 1) out.push(ids[i + 1])
  // Sa Sucrerie : le circuit (locations[0]) n'est jamais un voisin de zone — on le
  // retire pour obtenir l'adjacence linéaire z1↔z2↔z3↔z4.
  return out.filter((id) => !locked.has(id) && !isTrackLocation(me, id))
}

/** Lieu où se trouve une carte posée (Allié/Objet/Héros), ou undefined. */
export function locationOfCard(player: PlayerState, instanceId: string): LocationId | undefined {
  for (const loc of player.locations) {
    if ((player.board[loc.id] ?? []).some((c) => c.instanceId === instanceId)) return loc.id
  }
  return undefined
}

/** Cartes du joueur actif déplaçables par « Déplacer un Allié/Objet » : Alliés et
 *  Objets « racine » (un Objet associé suit son Allié, il n'est pas déplacé seul). */
/** Ursula — Ariel : un Objet « gelé » (frozenBy) n'est pas déplaçable par Ursula
 *  tant que le Héros qui l'a gelé (Ariel) est présent dans son royaume. */
export function isItemFrozen(player: PlayerState, card: CardInstance): boolean {
  if (!card.frozenBy) return false
  return Object.values(player.board)
    .flat()
    .some((c) => c.instanceId === card.frozenBy && c.type === 'hero')
}

export function movableCards(state: GameState): { instanceId: string; from: LocationId }[] {
  const me = activePlayer(state)
  const locked = new Set(me.lockedLocations ?? [])
  // Mère Gothel — Ulf : tant qu'il est là, aucun Allié ne peut quitter son lieu.
  const alliesStuck = alliesCannotMove(me)
  const out: { instanceId: string; from: LocationId }[] = []
  for (const loc of me.locations) {
    // Rien ne peut être déplacé DEPUIS un lieu verrouillé.
    if (locked.has(loc.id)) continue
    // Syndrome — Frozone : les Alliés de SON lieu sont immobilisés.
    const frozoneHere = (me.board[loc.id] ?? []).some((c) => c.type === 'hero' && c.blocksAllyMovesHere)
    for (const c of me.board[loc.id] ?? []) {
      if (isItemFrozen(me, c)) continue // Ariel : Objet gelé
      if (c.trapped) continue // Hadès : Titan entravé, non déplaçable
      // Une Malédiction est traitée comme un Objet : elle se déplace aussi. Un
      // Héros hypnotisé (Jafar) compte comme un Allié → déplaçable lui aussi.
      // Héros hypnotisé (Jafar) OU le Prince (Madame de Trémaine) → déplaçable comme un Allié.
      const isControlledAlly = (c.type === 'hero' && (c.hypnotized || c.loved)) || c.cardId === 'the-prince'
      // Sombra : une carte de Piratage ne peut JAMAIS être déplacée.
      if (c.isPiratage) continue
      // Ulf (Gothel) / Frozone (Syndrome) : les Alliés immobilisés (Objets/Malédictions bougent).
      if ((alliesStuck || frozoneHere) && c.type === 'ally') continue
      if (((c.type === 'ally' || c.type === 'item' || c.type === 'curse') && !c.attachedTo) || isControlledAlly) {
        out.push({ instanceId: c.instanceId, from: loc.id })
      }
    }
  }
  return out
}

/** Cartes du joueur actif dont la capacité ACTIVÉE peut être déclenchée :
 *  carte avec `activatedCost`, hors lieu verrouillé, et pouvoir suffisant. */
export function activatableCards(state: GameState): CardInstance[] {
  const me = activePlayer(state)
  const locked = new Set(me.lockedLocations ?? [])
  const out: CardInstance[] = []
  for (const loc of me.locations) {
    if (locked.has(loc.id)) continue
    for (const c of me.board[loc.id] ?? []) {
      if (c.activatedCost === undefined || c.activatedCost > me.power) continue
      // Isabella — Grand-mère Sarah : capacité « Éliminer un Héros » ; non activable (ne pas
      // payer pour rien) s'il n'y a aucun Héros dans le royaume.
      if (
        (c.activatedEffects ?? []).some((e) => e.type === 'OPTIONAL_FREE_VANQUISH') &&
        !Object.values(me.board).flat().some((x) => x.type === 'hero')
      ) {
        continue
      }
      // Bowser Jr. : sa capacité (chercher Peach et la jouer) n'a de sens que tant
      // que Peach n'est NI en jeu NI déjà capturée.
      if (c.cardId === 'bowser-jr') {
        const peachInPlay = Object.values(me.board)
          .flat()
          .some((x) => x.type === 'hero' && x.cardId === 'peach')
        if (peachInPlay || me.peachCaptured) continue
      }
      // Le Flagelleur Mental — Billy sous emprise : chercher ONZE n'est activable que si
      // MAX est absente, qu'ONZE n'est pas déjà dans le royaume, et qu'elle est disponible
      // dans la pioche/défausse Fatalité.
      if (c.cardId === 'billy-sous-emprise') {
        const inRealm = Object.values(me.board).flat()
        const maxPresent = inRealm.some((x) => x.type === 'hero' && x.cardId === 'max-mayfield')
        const onzeInRealm = inRealm.some((x) => x.type === 'hero' && x.cardId === 'onze')
        const onzeAvailable = [...me.fateDeck, ...me.fateDiscard].some((x) => x.cardId === 'onze')
        if (maxPresent || onzeInRealm || !onzeAvailable) continue
      }
      // Ratigan — Cloche : cherche Félicia dans la pioche/défausse. Inutile (donc non
      // activable) si Félicia est déjà en main ou déjà posée sur un lieu.
      if (c.cardId === 'cloche') {
        const feliciaOut =
          me.hand.some((x) => x.cardId === 'felicia') ||
          Object.values(me.board).flat().some((x) => x.cardId === 'felicia')
        if (feliciaOut) continue
      }
      // Cruella — Téléphone : rejoue un Allié de la défausse. Inutile (non activable)
      // s'il n'y a aucun Allié dans la défausse.
      if (c.cardId === 'telephone' && !me.discard.some((x) => x.type === 'ally')) continue
      // Gaston — Monsieur D'Arque : retire un Obstacle. Inutile (non activable) si
      // Belle bloque le retrait ou s'il ne reste aucun Obstacle.
      if (c.cardId === 'monsieur-darque' && (belleBlocksRemoval(me) || totalObstacles(me) === 0)) continue
      // Reine de Cœur — Montre à gousset : gagne 1 Pouvoir par arceau. Non activable
      // s'il n'y a aucune carte transformée en arceau (isWicket) dans le royaume.
      if (c.cardId === 'montre-gousset' && !Object.values(me.board).flat().some((x) => x.isWicket)) continue
      // Madame de Trémaine — Canne : retire une Pantoufle de Verre. Non activable s'il
      // n'y a aucune Pantoufle dans le royaume.
      if (
        c.cardId === 'canne-tremaine' &&
        !Object.values(me.board).flat().some((x) => isGlassSlipper(x.cardId))
      ) {
        continue
      }
      // Madame de Trémaine — Invitation du Roi : examine la pioche Fatalité. Non
      // activable si pioche ET défausse Fatalité sont vides (rien à regarder).
      if (c.cardId === 'invitation-du-roi' && me.fateDeck.length === 0 && me.fateDiscard.length === 0) continue
      // Madame de Trémaine — La Clé : déplace un Héros vers la Chambre + le piège. Non
      // activable s'il n'y a aucun Héros dans le royaume.
      if (c.cardId === 'la-cle' && !Object.values(me.board).flat().some((x) => x.type === 'hero')) continue
      // Lotso — Big Baby : dévoile la pioche Fatalité jusqu'à un Héros. Non activable s'il
      // n'y a aucun Héros dans la pioche NI la défausse Fatalité (rien à révéler/jouer).
      if (
        c.cardId === 'big-baby' &&
        ![...me.fateDeck, ...me.fateDiscard].some((x) => x.type === 'hero')
      ) {
        continue
      }
      // Lotso — Flex : déplace un Héros/Buzz de SON lieu. Non activable s'il n'y a aucun
      // Héros ni Buzz sur le lieu de Flex (rien à déplacer).
      if (
        c.cardId === 'flex' &&
        !(me.board[loc.id] ?? []).some((x) => x.type === 'hero' || x.isBuzz)
      ) {
        continue
      }
      // Syndrome — Télécommande : activable seulement si l'Omnidroïde v.10 ET la figurine
      // sont sur SON lieu (l'activation détruit le v.10 = objectif).
      if (
        c.cardId === 'telecommande-de-syndrome' &&
        (me.pawnLocation !== loc.id ||
          !(me.board[loc.id] ?? []).some((x) => x.isOmnidroid && x.omnidroidStage === 'x10'))
      ) {
        continue
      }
      // Shere Khan — Macaques : activable seulement s'il y a un jeton Feu sur leur lieu
      // (et le Pouvoir pour le payer). Le Roi Singe : seulement s'il existe une carte
      // Macaques à déplacer. Kaa : seulement avec un Objet abordable en défausse.
      if (c.cardId === 'macaques') {
        const fires = (me.fireTokens?.[loc.id] ?? []).length
        if (fires === 0 || me.power < fires) continue
      }
      if (c.cardId === 'le-roi-singe' && !Object.values(me.board).flat().some((x) => x.cardId === 'macaques')) continue
      if (c.cardId === 'kaa' && !me.discard.some((x) => x.type === 'item' && (x.cost ?? 0) <= me.power)) continue
      // Tabbou — Bowser (et tout Objet/Allié « tuer une couleur ») : inutile (non activable)
      // s'il n'y a aucun Combattant en réserve à tuer.
      if (
        (c.activatedEffects ?? []).some((e) => e.type === 'KILL_FIGHTERS_COLOR') &&
        !(me.fighterTiles ?? []).some((t) => t.state === 'reserve')
      ) {
        continue
      }
      // Dio — Masque de pierre : défausse la main pour du Pouvoir. Inutile si main vide.
      if (c.cardId === 'masque-de-pierre' && me.hand.length === 0) continue
      // Dio — Justice : récupère un Allié de la défausse. Inutile sans Allié en défausse.
      if (c.cardId === 'justice' && !me.discard.some((x) => x.type === 'ally')) continue
      // La Bonne Fée — Embrasse-la : activable seulement quand la victoire est réunie.
      if (c.cardId === 'embrasser' && !kissAtBallConditionMet(state, state.activePlayer)) continue
      // Le Flagelleur Mental — Entrée du Monde à l'Envers : activable (= victoire) seulement
      // quand ONZE partage son lieu et que les premiers lieux sont tunnelisés.
      if (
        c.cardId === 'entree-du-monde-a-l-envers' &&
        !flayerGateConditionMet(state, state.activePlayer)
      ) {
        continue
      }
      // La Bonne Fée — Nettoyage de fond : activable seulement s'il existe un Héros
      // transformé (Objet Meuble/Colombe associé) à défausser.
      if (c.cardId === 'rangement' && !Object.values(me.board).flat().some((x) => x.zeroesHostStrength && x.attachedTo)) continue
      // La Bonne Fée — Les contes de fée : activable seulement s'il y a un Objet ou un
      // Événement dans la défausse à récupérer.
      if (c.cardId === 'contes' && !me.discard.some((x) => x.type === 'item' || x.type === 'effect')) continue
      // La Bonne Fée — Réserve de potions : activable seulement s'il existe une Potion
      // dans la pioche ou la défausse à récupérer.
      if (c.cardId === 'reserve' && ![...me.deck, ...me.discard].some((x) => x.isPotion)) continue
      out.push(c)
    }
  }
  // Thanos — Pierres CAPTURÉES (Compétences, hors board) : activables (coût 0). On saute
  // la Pierre de la Réalité (Vaincre) s'il n'y a aucun Héros à éliminer.
  for (const stone of me.stoneSkills ?? []) {
    if ((stone.activatedCost ?? 0) > me.power) continue
    if (
      (stone.activatedEffects ?? []).some((e) => e.type === 'OPTIONAL_FREE_VANQUISH') &&
      !Object.values(me.board).flat().some((x) => x.type === 'hero')
    ) {
      continue
    }
    out.push(stone)
  }
  return out
}

/** Le Seigneur des Ténèbres — lieux (non verrouillés) où un « Mort-vivant du Chaudron »
 *  peut être joué : le Chaudron Noir doit être ACTIF et le lieu doit porter au moins un
 *  Objet « Anciens Soldats » (qui sera échangé/défaussé). Source unique partagée par le
 *  garde-fou moteur, le grisé UI (lieux jouables) et l'énumération du bot. */
export function cauldronBornLocations(player: PlayerState, card: CardInstance): LocationId[] {
  if (!card.requiresPoweredCauldron) return player.locations.map((l) => l.id)
  if (player.blackCauldron !== 'powered') return []
  const need = card.consumesItemCardId
  const locked = new Set(player.lockedLocations ?? [])
  return player.locations
    .map((l) => l.id)
    .filter((id) => !locked.has(id))
    .filter((id) =>
      need === undefined ||
      (player.board[id] ?? []).some((c) => c.cardId === need && c.type === 'item' && !c.attachedTo),
    )
}

/** Le Seigneur des Ténèbres — un Objet « Squelettes de Soldats » (posé, non associé)
 *  est-il présent quelque part dans le royaume ? */
export function hasLooseAncientSoldiers(player: PlayerState): boolean {
  return Object.values(player.board)
    .flat()
    .some((c) => c.cardId === 'ancient-soldiers' && c.type === 'item' && !c.attachedTo)
}

/** Le Seigneur des Ténèbres — la capacité « échange » du Chaudron RÉVEILLÉ est-elle
 *  disponible pour `playerIndex` ? Conditions : Chaudron actif, phase MOVE (= avant de
 *  déplacer le pion), pas déjà utilisée ce tour, au moins 2 Pouvoir, au moins un
 *  Squelette de Soldat posé, et au moins un Soldat Ressuscité en main. */
export function canCauldronExchange(state: GameState, playerIndex: number = state.activePlayer): boolean {
  const p = state.players[playerIndex]
  if (p.blackCauldron !== 'powered') return false
  if (state.phase !== 'MOVE') return false
  if (p.cauldronExchangeUsedThisTurn) return false
  if (p.power < 2) return false
  return hasLooseAncientSoldiers(p) && p.hand.some((c) => c.cardId === 'cauldron-born')
}

/** Gul'dan — nombre de lieux CORROMPUS (basculés en face B). */
export function guldanCorruptedCount(player: PlayerState): number {
  return player.locations.filter((l) => l.version === 'b').length
}

/** Gul'dan — les 3 conditions de la Porte des Ténèbres sont-elles réunies pour
 *  `playerIndex` ? Pion sur le DERNIER lieu (Porte des Ténèbres), TOUS les lieux
 *  corrompus (face B) et les 4 Artéfacts possédés (joués). Sert au garde-fou de
 *  jouabilité d'OUVERTURE, au grisé UI et à l'effet DARK_PORTAL_WIN. */
export function darkPortalReady(state: GameState, playerIndex: number = state.activePlayer): boolean {
  const p = state.players[playerIndex]
  const locs = p.locations
  if (locs.length === 0) return false
  const onPortal = p.pawnLocation === locs[locs.length - 1].id
  const allCorrupted = locs.every((l) => l.version === 'b')
  const artifacts = (p.artifacts ?? []).length
  return onPortal && allCorrupted && artifacts >= 4
}

/** Joueur ciblé par la Fatalité du joueur actif (en 2 joueurs : l'autre). */
export function fateTarget(state: GameState): number {
  return (state.activePlayer + 1) % state.players.length
}

/** Vrai si un Héros de cardId donné est posé dans le royaume d'un joueur. Utile
 *  pour les effets passifs (Roi Richard interdit les Événements, Robin retire 1
 *  JT aux gains du royaume…). */
export function hasHeroInRealm(state: GameState, playerIndex: number, cardId: string): boolean {
  const p = state.players[playerIndex]
  return Object.values(p.board).some((cards) =>
    cards.some((c) => c.type === 'hero' && c.cardId === cardId),
  )
}

/** La Méchante Reine — « Préparer du Poison » convertit N Pouvoir en N Poison
 *  (1:1). Timide (Héros Fatalité dans le royaume) fait coûter 1 Pouvoir EN PLUS
 *  le simple fait d'utiliser l'action. Renvoie le nombre MAX de Poison
 *  préparables (0 si même 1 conversion est impossible). */
export function maxBrewPoison(state: GameState, playerIndex: number = state.activePlayer): number {
  const p = state.players[playerIndex]
  const surcharge = hasHeroInRealm(state, playerIndex, 'timide') ? 1 : 0
  return Math.max(0, p.power - surcharge)
}

/** Tabbou — « Dévoiler une tuile Combattant » : chaque tuile coûte 1 Pouvoir
 *  (1 JT = 1 Combattant). Kirby ajoute un surcoût fixe par usage (`fighterRevealSurcharge`),
 *  Link plafonne le nombre dévoilable par usage (`fighterRevealCap`, = 3). Renvoie le
 *  nombre MAX de tuiles dévoilables en un usage : min(pioche, plafond Link, Pouvoir
 *  disponible après surcoût). 0 si l'action n'aurait aucun effet. */
export function maxRevealFighters(state: GameState, playerIndex: number = state.activePlayer): number {
  const p = state.players[playerIndex]
  const inRealm = Object.values(p.board).flat()
  const pile = (p.fighterTiles ?? []).filter((t) => t.state === 'pile').length
  if (pile === 0) return 0
  const surcharge = inRealm.reduce((n, c) => n + (c.fighterRevealSurcharge ?? 0), 0)
  const caps = inRealm.map((c) => c.fighterRevealCap).filter((v): v is number => v !== undefined)
  const cap = caps.length > 0 ? Math.min(...caps) : Infinity
  const affordable = Math.max(0, p.power - surcharge) // 1 Pouvoir par tuile
  return Math.max(0, Math.min(pile, cap, affordable))
}

/** La Méchante Reine — « Croque ! » est-il utilisable ? Vrai s'il existe, sur le
 *  lieu du pion, un Héros (non hypnotisé) éliminable : force effective ≤ Poison
 *  disponible, en respectant la priorité Prof (mustDefeatFirst). Mêmes critères
 *  que l'effet TAKE_A_BITE. Sert à interdire de jouer la carte « dans le vide ». */
export function canTakeABite(state: GameState, playerIndex: number = state.activePlayer): boolean {
  const p = state.players[playerIndex]
  const loc = p.pawnLocation
  if (!loc) return false
  const heroes = (p.board[loc] ?? []).filter((c) => c.type === 'hero' && !c.hypnotized && !c.loved)
  if (heroes.length === 0) return false
  const priorityExists = Object.values(p.board).flat().some((c) => c.type === 'hero' && c.mustDefeatFirst)
  const pool = priorityExists ? heroes.filter((h) => h.mustDefeatFirst) : heroes
  const poison = p.poison ?? 0
  return pool.some((h) => (effectiveStrength(state, playerIndex, h.instanceId) ?? 0) <= poison)
}

/** Tous les Héros présents dans le royaume d'un joueur (utile pour Voler aux
 *  Riches et Déguisement — Fatalité non-Héros qui ciblent un Héros adverse). */
export function heroesOf(state: GameState, playerIndex: number): CardInstance[] {
  const p = state.players[playerIndex]
  // Exclut le Prisonnier (Oogie — Perce-Oreilles : pas un Héros au sens du jeu).
  return Object.values(p.board).flatMap((cards) => cards.filter((c) => c.type === 'hero' && !c.isPrisoner))
}

/** Force effective d'un Allié ou d'un Héros présent sur le plateau d'un joueur,
 *  modificateurs passifs inclus :
 *   - Allié : +1 par Niquedouille **autre** sur le même lieu, +1 par Arc et
 *     Flèches qui lui est attaché, −1 par Pendard **autre** sur le même lieu
 *     (Pendard réduit la force des AUTRES Alliés — plancher à 0).
 *   - Héros : +1 par Adam de la Halle **autre** dans le royaume (plancher à 0).
 *  Renvoie undefined si la carte n'est pas trouvée ou n'a pas de force. */
export function effectiveStrength(
  state: GameState,
  playerIndex: number,
  instanceId: string,
): number | undefined {
  const p = state.players[playerIndex]
  const loc = locationOfCard(p, instanceId)
  if (!loc) return undefined
  const cell = p.board[loc] ?? []
  const card = cell.find((c) => c.instanceId === instanceId)
  if (!card || card.strength === undefined) return undefined
  // Syndrome — Unité de Confinement : la force de ce Héros est réduite à 0.
  if (card.forceZeroed) return 0
  // La Bonne Fée — Héros transformé (Meuble / Colombe associé) : force EFFECTIVE 0.
  if (cell.some((c) => c.attachedTo === card.instanceId && c.zeroesHostStrength)) return 0
  // Syndrome — Jack-Jack : sa force devient celle du Héros le plus fort sur son lieu
  // (comparaison sur la force de base, sans récursion).
  if ((card.selfStrengthMods ?? []).some((m) => m.kind === 'match-strongest-hero-here')) {
    const strongest = Math.max(
      card.strength,
      ...cell.filter((c) => c.type === 'hero').map((c) => c.strength ?? 0),
    )
    return Math.max(0, strongest)
  }

  // Bonus de force des Objets associés — donnée réutilisable (attachStrengthBonus
  // porté par l'Objet), pour ne pas coder chaque Objet en dur par cardId : Arc et
  // Flèches / Cimeterre / Lance (+1) sur un Allié, Épée de Vérité / Vœu (+2) sur
  // un Héros. Le Cimeterre sur un Héros hypnotisé (= compté comme Allié) entre
  // naturellement dans cette somme puisqu'il y est associé.
  const attachedStrengthBonus = cell
    .filter((c) => c.attachedTo === card.instanceId)
    .reduce((sum, c) => sum + (c.attachStrengthBonus ?? 0), 0)

  // Synergies conditionnelles de la carte sur SA PROPRE force (Créature Rieuse,
  // Sinistre Créature, Génie, Rajah, Adam de la Halle). Donnée réutilisable :
  // chaque variant est évalué ici, la carte ne porte que ses paramètres.
  const selfMod = (card.selfStrengthMods ?? []).reduce((sum, m) => {
    switch (m.kind) {
      case 'per-type-here':
        return sum + m.delta * cell.filter((c) => c.type === m.cardType).length
      case 'if-type-here':
        return sum + (cell.some((c) => c.type === m.cardType) ? m.delta : 0)
      case 'if-card': {
        const present =
          m.scope === 'location'
            ? cell.some((c) => c.cardId === m.cardId)
            : Object.values(p.board).flat().some((c) => c.cardId === m.cardId)
        return sum + (present ? m.delta : 0)
      }
      case 'per-other-hero-realm': {
        const others = Object.values(p.board)
          .flat()
          .filter((c) => c.type === 'hero' && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'if-alone-here': {
        const otherHeroesHere = cell.some((c) => c.type === 'hero' && c.instanceId !== card.instanceId)
        return sum + (otherHeroesHere ? 0 : m.delta)
      }
      case 'if-attached-item': {
        // Jean (Crochet) : +delta si au moins un Objet lui est associé.
        const hasItem = cell.some((c) => c.type === 'item' && c.attachedTo === card.instanceId)
        return sum + (hasItem ? m.delta : 0)
      }
      case 'per-location-with-hero': {
        // Michel (Crochet) : +delta par lieu du royaume occupé par ≥1 Héros (le sien compris).
        const n = p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'hero')).length
        return sum + m.delta * n
      }
      case 'per-other-hyena-here': {
        const others = cell.filter((c) => c.isHyena && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'per-other-same-cardId-realm': {
        const others = Object.values(p.board)
          .flat()
          .filter((c) => c.cardId === card.cardId && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'per-other-in-set-realm': {
        const others = Object.values(p.board)
          .flat()
          .filter((c) => m.cardIds.includes(c.cardId) && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'per-other-hero-here': {
        const others = cell.filter((c) => c.type === 'hero' && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'if-other-hero-here': {
        // Meta Knight (Tabbou) : bonus FORFAITAIRE dès qu'un autre Héros partage son lieu.
        const hasOther = cell.some((c) => c.type === 'hero' && c.instanceId !== card.instanceId)
        return sum + (hasOther ? m.delta : 0)
      }
      case 'per-other-type-here': {
        const others = cell.filter((c) => c.type === m.cardType && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'per-other-same-here': {
        // Pyramid Head — Infirmière : +delta par AUTRE carte du même cardId sur le lieu.
        const others = cell.filter((c) => c.cardId === card.cardId && c.instanceId !== card.instanceId).length
        return sum + m.delta * others
      }
      case 'per-other-location-with-ally': {
        // Davy Jones — L'Équipage du Hollandais Volant : +delta par AUTRE lieu (≠ le sien)
        // portant au moins un Allié.
        const n = p.locations.filter(
          (l) => l.id !== loc && (p.board[l.id] ?? []).some((c) => c.type === 'ally'),
        ).length
        return sum + m.delta * n
      }
      case 'per-claimed-treasure':
        // Davy Jones — James Norrington : +delta par jeton Trésor déjà récupéré.
        return sum + m.delta * (p.claimedTreasures ?? []).length
      case 'match-strongest-hero-here':
        // Traité en amont (override de la force) ; neutre dans la somme.
        return sum
    }
  }, 0)

  // Davy Jones — Le Compas de Jack (Trésor RÉVÉLÉ sur ce Héros) : +2 Force.
  const treasureBonus = card.treasure?.faceUp && card.treasure.id === 'compas-de-jack' ? 2 : 0

  // Jetons de force permanents posés sur la carte (Oogie : Jack -1 par Imposteur
  // joué après son retour). Peut être négatif ; s'applique Allié comme Héros.
  const forceTokens = card.forceTokens ?? 0

  // Bonus temporaire « jusqu'à la fin du tour » (Capitaine Crochet : Pas de
  // Quartier !). Champ de donnée porté par la carte ; s'applique Allié comme Héros.
  const tempBonus = card.tempStrengthBonus ?? 0
  // Modificateur PERMANENT de force porté par la carte (Syndrome — 15 ans plus tard :
  // −2 sur le Héros joué). On garde la force de BASE intacte pour que l'UI affiche le
  // badge « force modifiée ». S'applique Allié comme Héros.
  const permaDelta = card.permanentStrengthDelta ?? 0

  if (card.type === 'ally') {
    // Aura des cartes du lieu sur les Alliés (Niquedouille +1, Pendard -1) —
    // `excludeSelf` empêche la carte source de s'affecter elle-même.
    const allyAura = cell.reduce((sum, c) => {
      if (c.trapped) return sum // Titan entravé : ses capacités sont ignorées.
      const m = c.strengthMod
      if (m && m.target === 'allies-here' && !(m.excludeSelf && c.instanceId === card.instanceId)) {
        return sum + m.delta
      }
      return sum
    }, 0)
    // Capitaine Crochet — bonus encore codés par cardId (TODO : migrer vers les
    // champs de donnée comme le reste, cf. CLAUDE.md) :
    //  - Sabre d'Abordage : +2 par Sabre associé à cet Allié (→ attachStrengthBonus).
    const sabreBonus = cell.filter(
      (c) => c.cardId === 'sabre-abordage' && c.attachedTo === card.instanceId,
    ).length * 2
    //  - Monsieur Mouche : +2 sur le Jolly Roger.
    const moucheBonus = card.cardId === 'monsieur-mouche' && loc === 'jolly-roger' ? 2 : 0
    const allyTotal = card.strength + attachedStrengthBonus + selfMod + allyAura + sabreBonus + moucheBonus + tempBonus + forceTokens + permaDelta
    // Scar — Simba : tant qu'il est en jeu, la force des Hyènes ne peut dépasser 2.
    const simbaCaps =
      card.isHyena &&
      Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'simba')
    return Math.max(0, simbaCaps ? Math.min(2, allyTotal) : allyTotal)
  }
  if (card.type === 'hero') {
    // Aura des cartes du lieu sur les Héros (Sommeil sans Rêves -2 ; Sablier Géant
    // -2 seulement s'il a été activé ce tour-ci).
    const heroAura = cell.reduce((sum, c) => {
      if (c.trapped) return sum // Titan entravé (Hydros) : capacité ignorée.
      const m = c.strengthMod
      if (m && m.target === 'heroes-here' && !(m.excludeSelf && c.instanceId === card.instanceId)) {
        if (m.onlyIfActivatedThisTurn && !c.activatedThisTurn) return sum
        return sum + m.delta
      }
      return sum
    }, 0)
    // Aura GLOBALE du royaume sur les Héros (Adam de la Halle : +1 à tous les
    // autres Héros) — scanne tout le board, pas seulement le lieu.
    const realmHeroAura = Object.values(p.board)
      .flat()
      .reduce((sum, c) => {
        if (c.trapped) return sum // Titan entravé : capacité ignorée.
        const m = c.strengthMod
        if (
          m &&
          m.target === 'heroes-realm' &&
          !(m.excludeSelf && c.instanceId === card.instanceId) &&
          !(m.exceptCardId && m.exceptCardId === card.cardId) &&
          // Team Rocket — Dracaufeu : aura réservée aux Pokémon (« tous les autres Pokémon »).
          !(m.onlyPokemon && !card.isPokemon)
        ) {
          return sum + m.delta
        }
        return sum
      }, 0)
    // Capitaine Crochet — bonus encore codés par cardId (TODO : migrer, cf. CLAUDE.md) :
    //  - Poussière de Fée : +2 par carte associée à ce Héros (→ attachStrengthBonus).
    const pixieBonus = cell.filter(
      (c) => c.cardId === 'poussiere-fee' && c.attachedTo === card.instanceId,
    ).length * 2
    //  - Wendy / Jean / Michel : MIGRÉS en data (Wendy `strengthMod heroes-realm`,
    //    Jean `selfStrengthMods if-attached-item`, Michel `per-location-with-hero`) →
    //    gérés par `realmHeroAura`/`selfMod` ci-dessus, plus de bonus codé par cardId.
    // Scar — Zazu : -2 aux AUTRES Héros sur SON lieu ; +1 aux Héros des autres lieux.
    let zazuBonus = 0
    if (card.cardId !== 'zazu') {
      const zazuLoc = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.cardId === 'zazu'))?.id
      if (zazuLoc) zazuBonus = zazuLoc === loc ? -2 : 1
    }
    return Math.max(
      0,
      card.strength + attachedStrengthBonus + selfMod + heroAura + realmHeroAura + pixieBonus + zazuBonus + tempBonus + forceTokens + permaDelta + treasureBonus,
    )
  }
  return card.strength
}

/** Lieux où un Héros peut être posé/déplacé chez le joueur `targetIndex` : tous
 *  ses lieux moins ceux interdits par la carte (Dame Gertrude → pas en Prison)
 *  et moins ceux interdits par une restriction présente au lieu (Feu Infernal
 *  → no-heroes ; Forêt de Ronces → min-hero-strength).
 *  À réutiliser pour le déplacement de Héros (Emprisonnement, bloc C). */
export function heroPlacementLocations(
  state: GameState,
  card: CardInstance,
  targetIndex: number,
): LocationId[] {
  const forbidden = new Set(card.forbiddenLocations ?? [])
  const tgt = state.players[targetIndex]
  const locked = new Set(tgt.lockedLocations ?? [])
  return tgt.locations
    .map((l) => l.id)
    // Sa Sucrerie : un Héros de Fatalité se pose dans une zone, jamais sur le circuit.
    .filter((id) => !forbidden.has(id) && !locked.has(id) && !isTrackLocation(tgt, id) && canPlaceHeroAt(state, targetIndex, id, card))
}

/** Vrai si un Héros peut être posé sur le lieu — vérifie les restrictions
 *  imposées par les cartes présentes (Malédictions de Maléfique). */
export function canPlaceHeroAt(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
  hero: CardInstance,
): boolean {
  const heroStrength = hero.strength ?? 0
  const cell = state.players[playerIndex].board[locationId] ?? []
  for (const c of cell) {
    const r = c.placementRestriction
    if (!r) continue
    if (r.type === 'no-heroes') return false
    if (r.type === 'min-hero-strength' && heroStrength < r.value) return false
  }
  return true
}

/** Lotso — Héros du royaume dont la force EFFECTIVE peut encore être réduite par des
 *  jetons −1 : force effective > 0 et pas un Rex protégé (partage son lieu avec un autre
 *  Héros). `scope` restreint les lieux ('room' = Salle des Chenilles, 'not-room' = hors
 *  Salle, 'at-pawn' = lieu du pion, 'all' = partout — défaut). Source partagée : effet
 *  LOTSO_REDUCE / Le Bibliothécaire, garde-fous de jouabilité, énumération bot et résolution.
 *  Renvoie les instanceId. */
export function lotsoReducibleHeroes(
  state: GameState,
  playerIndex: number,
  scope: 'room' | 'not-room' | 'all' | 'at-pawn' = 'all',
): string[] {
  const p = state.players[playerIndex]
  const roomId = p.objective.type === 'LOTSO_GATHER' ? p.objective.roomId : p.locations[0].id
  const out: string[] = []
  for (const l of p.locations) {
    if (scope === 'room' && l.id !== roomId) continue
    if (scope === 'not-room' && l.id === roomId) continue
    if (scope === 'at-pawn' && l.id !== p.pawnLocation) continue
    for (const c of p.board[l.id] ?? []) {
      if (c.type !== 'hero') continue
      if ((effectiveStrength(state, playerIndex, c.instanceId) ?? 0) <= 0) continue
      if (c.protectedWithOtherHero && (p.board[l.id] ?? []).some((x) => x.type === 'hero' && x.instanceId !== c.instanceId)) continue
      out.push(c.instanceId)
    }
  }
  return out
}

/** Lotso — vrai s'il y a au moins un Héros (quelle que soit sa force) sur la Salle des
 *  Chenilles. Sert au garde-fou de « Les nouveaux jouets n'ont pas la moindre chance »
 *  (injouable si aucun Héros dans la Salle). */
export function lotsoHasHeroInRoom(state: GameState, playerIndex: number): boolean {
  const p = state.players[playerIndex]
  const roomId = p.objective.type === 'LOTSO_GATHER' ? p.objective.roomId : p.locations[0].id
  return (p.board[roomId] ?? []).some((c) => c.type === 'hero')
}

/** Lotso — Pas l'âge minimum requis : cartes déplaçables vers la Salle des Chenilles =
 *  les Héros ET la tuile Buzz (Gardien/Démo) situés sur un AUTRE lieu que la Salle (déplacer
 *  ce qui y est déjà n'aurait aucun effet). Source partagée : choix interactif, garde-fou de
 *  jouabilité (la carte est injouable si vide → Buzz déjà dans la Salle et aucun Héros ailleurs). */
export function lotsoToRoomCandidates(state: GameState, playerIndex: number): string[] {
  const p = state.players[playerIndex]
  const roomId = p.objective.type === 'LOTSO_GATHER' ? p.objective.roomId : p.locations[0].id
  const out: string[] = []
  for (const l of p.locations) {
    if (l.id === roomId) continue
    for (const c of p.board[l.id] ?? []) {
      if (c.type === 'hero' || c.isBuzz) out.push(c.instanceId)
    }
  }
  return out
}

/** Madame de Trémaine — les deux Pantoufles de Verre (cartes distinctes : Chambre /
 *  Château). Tant qu'UNE est dans le royaume, le mariage est impossible. */
export const GLASS_SLIPPER_IDS = ['pantoufle-chambre', 'pantoufle-chateau']
export const isGlassSlipper = (cardId: string): boolean => GLASS_SLIPPER_IDS.includes(cardId)

/** Mère Gothel — Ulf / Madame de Trémaine — Marraine la Bonne Fée : vrai si un Héros
 *  NON piégé du royaume immobilise tous les Alliés (un Héros « piégé » voit sa capacité
 *  ignorée → il ne bloque plus). */
export function alliesCannotMove(player: PlayerState): boolean {
  return Object.values(player.board).flat().some((c) => c.type === 'hero' && c.blocksAllyMoves && !c.trapped)
}

/** Vrai si un Allié sur `locationId` ne peut PAS être déplacé : soit Ulf immobilise tout
 *  le royaume (`blocksAllyMoves`), soit un Héros « Frozone » est sur CE lieu
 *  (`blocksAllyMovesHere`). */
export function alliesCannotMoveFrom(player: PlayerState, locationId: LocationId): boolean {
  if (alliesCannotMove(player)) return true
  return (player.board[locationId] ?? []).some((c) => c.type === 'hero' && c.blocksAllyMovesHere && !c.trapped)
}

/** Vrai si AUCUN Allié ne peut être posé/déplacé sur ce lieu chez `playerIndex`,
 *  parce qu'un Héros présent dans son royaume l'interdit (Madame de Trémaine —
 *  Cendrillon en robe de bal : la Salle de Bal). Donnée : `blocksAlliesAtLocation`. */
export function allyBlockedAt(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
): boolean {
  const cell = state.players[playerIndex].board[locationId] ?? []
  // Davy Jones — Le Coffre au Trésor (Trésor révélé sur ce lieu) : aucun Allié jouable ici.
  if (cell.some((c) => c.type === 'hero' && c.treasure?.faceUp && c.treasure.id === 'coffre-au-tresor')) {
    return true
  }
  return Object.values(state.players[playerIndex].board)
    .flat()
    .some((c) => c.type === 'hero' && c.blocksAlliesAtLocation === locationId)
}

/** Vrai si une Malédiction peut être posée sur le lieu : plusieurs Malédictions
 *  peuvent cohabiter ; seule une restriction `no-curses` (Pimprenelle) l'interdit.
 *  Si `card` est fourni et qu'elle restreint les Héros (Forêt de Ronces, Feu
 *  Infernal), on interdit aussi la pose sur un lieu où un Héros présent VIOLERAIT
 *  déjà cette restriction (on ne peut pas faire pousser les Ronces sous un Héros
 *  qui n'aurait pas pu venir s'y poser). */
export function canPlaceCurseAt(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
): boolean {
  // Plusieurs Malédictions peuvent cohabiter sur un même lieu (règle officielle) :
  // on ne bloque que les lieux portant une restriction `no-curses`.
  const cell = state.players[playerIndex].board[locationId] ?? []
  if (cell.some((c) => c.placementRestriction?.type === 'no-curses')) return false
  // La `placementRestriction` d'une Malédiction (Forêt de Ronces → min-force 4 ;
  // Feu Infernal → no-heroes) restreint les HÉROS JOUÉS ENSUITE sur ce lieu — PAS la pose
  // de la Malédiction elle-même : on peut donc la jouer sur un lieu portant déjà un Héros
  // (même non conforme). Cette restriction est appliquée à la pose/au déplacement des Héros
  // (cf. heroPlacementLocations, applyPlayCard Héros, arrivées Fatalité).
  return true
}

/** Le joueur actif peut-il lancer une Fatalité (la cible a-t-elle des cartes) ? */
export function canFate(state: GameState): boolean {
  // Yzma — Beauté endormie : verrou « seule action » → Fatalité indisponible.
  if (activePlayer(state).soleActionLock) return false
  const t = state.players[fateTarget(state)]
  // Sombra — Invisibilité : la cible est immunisée à la Fatalité ce tour.
  if (t.noFate) return false
  return t.fateDeck.length + t.fateDiscard.length > 0
}

/** Vrai si cette carte est un Objet qui doit être associé à un Allié à la pose. */
export function requiresAllyTarget(card: CardInstance): boolean {
  return card.type === 'item' && card.attach === 'ally'
}

/** Vrai si cette carte exige un Héros cible à la pose (Emprisonnement,
 *  Intimidation qui en a aussi besoin d'alliés, Apparence de Dragon). */
export function cardNeedsHeroTarget(card: CardInstance): boolean {
  return (card.effects ?? []).some(
    (e) =>
      e.type === 'MOVE_HERO_TO_LOCATION' ||
      e.type === 'VANQUISH_HERO' ||
      e.type === 'INSTANT_VANQUISH_HERO_LE' ||
      e.type === 'INSTANT_VANQUISH_HERO_AT_PAWN' ||
      e.type === 'HYPNOTIZE_HERO' ||
      e.type === 'SET_HERO_SIZE' ||
      e.type === 'REDUCE_HERO_STRENGTH_TEMP' ||
      e.type === 'HACK_HERO' ||
      e.type === 'TRAP_HERO',
  )
}

/** Vrai si cette carte déclenche un Vanquish (besoin de Héros + Alliés à la pose).
 *  Intimidation, Tendre un Piège. */
export function cardNeedsVanquishTarget(card: CardInstance): boolean {
  // ROLL_MERVEILLE (Oogie — Mais quelle merveille !) commence aussi par un Vanquish.
  return (card.effects ?? []).some((e) => e.type === 'VANQUISH_HERO' || e.type === 'ROLL_MERVEILLE')
}

/** Vrai si cette carte exige de désigner un Allié/Objet du royaume à sacrifier
 *  (Jafar : Sacrifice Nécessaire). */
export function cardNeedsSacrificeTarget(card: CardInstance): boolean {
  return (card.effects ?? []).some((e) => e.type === 'DISCARD_OWN_FOR_POWER')
}

/** Bowser — vrai si cette carte draine une Étoile vers un Allié choisi
 *  (épuisement d'énergie). */
export function cardNeedsStarAllyTarget(card: CardInstance): boolean {
  return (card.effects ?? []).some((e) => e.type === 'DRAIN_STAR_TO_ALLY')
}

/** Bowser — Alliés candidats pour recevoir une Étoile drainée : les Alliés présents
 *  sur l'OBSERVATOIRE de la Comète (`starLocationId`), d'où provient l'Étoile. */
export function drainStarAllies(state: GameState): CardInstance[] {
  const me = activePlayer(state)
  if (me.starLocationId == null) return []
  return (me.board[me.starLocationId] ?? []).filter((c) => c.type === 'ally' && !c.isWicket)
}

/** Alliés et Objets (non associés) du royaume du joueur actif, candidats au
 *  sacrifice (Sacrifice Nécessaire). */
export function sacrificeableCards(state: GameState): CardInstance[] {
  const me = activePlayer(state)
  // Un Allié, OU un Objet (y compris associé à un Allié / Héros hypnotisé).
  return me.locations.flatMap((loc) =>
    (me.board[loc.id] ?? []).filter((c) => c.type === 'ally' || c.type === 'item'),
  )
}

/** Vrai si cette carte demande aussi un Allié à déplacer librement avant le
 *  Vanquish (Tendre un Piège). */
export function cardNeedsAllyMove(card: CardInstance): boolean {
  return (card.effects ?? []).some((e) => e.type === 'MOVE_ALLY_FREELY')
}

/** Trigger d'une Condition : vrai si l'état satisfait à la fois la condition
 *  côté adversaire ET côté joueur. Évalue le `trigger` data-driven de la carte. */
export function conditionIsTriggered(
  state: GameState,
  card: CardInstance,
  playerIndex: number,
): boolean {
  if (card.type !== 'condition' || !card.trigger) return false
  const opp = state.players[state.activePlayer]
  const me = state.players[playerIndex]
  // L'Imposteur — Insidieux (rend un suspect normal) : injouable s'il n'y a aucun
  // Coéquipier suspect (la carte n'aurait aucun effet). Donnée : on teste l'effet.
  if (
    (card.effects ?? []).some((e) => e.type === 'REASSURE_ANY') &&
    !(me.crewmates ?? []).some((c) => !c.discarded && c.suspect)
  ) {
    return false
  }
  // Lotso — Parfumé à la fraise (mélange la défausse Méchant dans la pioche) : injouable
  // si la défausse Méchant est vide (rien à remélanger → aucun effet).
  if (
    (card.effects ?? []).some((e) => e.type === 'RESHUFFLE_DISCARD_AND_DRAW') &&
    me.discard.length === 0
  ) {
    return false
  }
  // Shere Khan — Aie confiance (récupérer des cartes de la défausse → pioche) : injouable
  // si la défausse est vide.
  if ((card.effects ?? []).some((e) => e.type === 'RECOVER_CARDS_TO_DECK') && me.discard.length === 0) {
    return false
  }
  // Madame Mim — J'aime le sport (récupérer une carte de la défausse) : injouable si la
  // défausse ne contient aucune carte récupérable (rien à ajouter en main).
  const recover = (card.effects ?? []).find((e) => e.type === 'RECOVER_FROM_DISCARD_CHOICE')
  if (
    recover &&
    recover.type === 'RECOVER_FROM_DISCARD_CHOICE' &&
    !me.discard.some((c) => recover.types.includes(c.type))
  ) {
    return false
  }
  // Syndrome — Qui est le plus super ? : gagne autant que le coût de la dernière carte
  // jouée. Injouable si cette carte coûtait 0 (aucun Pouvoir à gagner).
  if (
    (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_EQUAL_LAST_PLAYED_COST') &&
    (state.lastPlayedCardCost ?? 0) < 1
  ) {
    return false
  }
  // Lotso — Quelque chose se brisa (déplace tous les Héros sur la Salle des Chenilles) :
  // injouable s'il n'y a aucun Héros HORS de la Salle (rien à y amener).
  if (
    (card.effects ?? []).some((e) => e.type === 'LOTSO_MOVE' && e.scope === 'all-to-room') &&
    me.objective.type === 'LOTSO_GATHER'
  ) {
    const roomId = me.objective.roomId
    const heroOutside = me.locations.some(
      (l) => l.id !== roomId && (me.board[l.id] ?? []).some((c) => c.type === 'hero'),
    )
    if (!heroOutside) return false
  }
  // Lotso — Bien le bonjour à ton enfant ! (réduit à 0 un Héros sur le lieu du pion) :
  // injouable s'il n'y a aucun Héros sur le lieu du pion (la carte serait sans effet).
  if (
    (card.effects ?? []).some((e) => e.type === 'LOTSO_REDUCE' && e.scope === 'at-pawn' && e.toZero) &&
    !(me.board[me.pawnLocation ?? ''] ?? []).some((c) => c.type === 'hero')
  ) {
    return false
  }
  switch (card.trigger.type) {
    case 'opponent-power-ge':
      return opp.power >= card.trigger.value
    case 'opponent-hand-ge':
      return (
        opp.hand.length >= card.trigger.value &&
        (!card.trigger.requiresOwnAlly || me.hand.some((c) => c.type === 'ally'))
      )
    case 'opponent-allies-in-realm-ge': {
      const allies = Object.values(opp.board).flat().filter((c) => c.type === 'ally').length
      return (
        allies >= card.trigger.value &&
        (!card.trigger.requiresOwnAlly || me.hand.some((c) => c.type === 'ally'))
      )
    }
    case 'opponent-items-in-realm-ge': {
      // Les Malédictions de Maléfique comptent comme des Objets ; les cartes `alsoItem`
      // aussi (Syndrome — l'Omnidroïde compte comme un Objet pour les conditions adverses).
      const items = Object.values(opp.board)
        .flat()
        .filter((c) => c.type === 'item' || c.type === 'curse' || c.alsoItem).length
      return items >= card.trigger.value
    }
    case 'opponent-vanquished-hero-strength-ge': {
      // Il faut qu'un Héros ait RÉELLEMENT été éliminé ce tour-ci (sinon undefined) :
      // sans ce garde-fou, `value: 0` (Enfermée) serait toujours vrai (0 ≥ 0).
      const v = state.lastVanquishedHeroStrength
      return v !== undefined && v >= card.trigger.value
    }
    case 'opponent-vanquished-hero-strength-le': {
      const v = state.lastVanquishedHeroStrength
      return v !== undefined && v <= card.trigger.value
    }
    case 'opponent-moved-card': {
      if (!state.activeMovedCard) return false
      // Affront : injouable s'il n'y a aucun Héros éligible (force ≤ N) dans le
      // royaume du joueur — l'effet (éliminer un Héros ≤ N) serait sans objet.
      const maxStr = card.trigger.requiresOwnHeroMaxStrength
      if (maxStr === undefined) return true
      return Object.values(me.board)
        .flat()
        .some((c) => c.type === 'hero' && (c.strength ?? 0) <= maxStr)
    }
    case 'opponent-drew-card':
      return !!state.activeDrewCard
    case 'opponent-discarded-ge':
      // Si la Condition a été piochée en cours de tour adverse, on ne compte que les
      // défausses survenues DEPUIS (instantané `conditionBaseline`).
      return (state.activeDiscardedCount ?? 0) - (card.conditionBaseline?.discarded ?? 0) >= card.trigger.value
    case 'opponent-gained-power-ge':
      return (state.activeGainedPower ?? 0) - (card.conditionBaseline?.gainedPower ?? 0) >= card.trigger.value
    case 'opponent-played-cards-ge':
      return (state.activePlayedCount ?? 0) - (card.conditionBaseline?.playedCards ?? 0) >= card.trigger.value
    case 'opponent-played-cards-le':
      // Michael Myers — Aura effrayante : jouable tant que l'adversaire actif n'a joué
      // qu'AU PLUS `value` cartes ce tour (value 0 = aucune carte jouée jusqu'ici).
      return (state.activePlayedCount ?? 0) <= card.trigger.value
    case 'opponent-actions-ge':
      // « réalise au moins N actions » : on compte les actions de lieu effectuées
      // ce tour par l'adversaire actif (ids non scopés, hors marqueurs internes).
      return state.usedActionIds.filter((id) => !id.includes(':')).length >= card.trigger.value
    case 'opponent-fate-targeted-me':
      return (state.activeFateTargets ?? []).includes(playerIndex)
    case 'opponent-played-item':
      return (state.activePlayedItemCount ?? 0) - (card.conditionBaseline?.playedItems ?? 0) >= card.trigger.value
    case 'opponent-played-ally':
      return (
        (state.activePlayedAllyCount ?? 0) - (card.conditionBaseline?.playedAllies ?? 0) >= 1 &&
        (!card.trigger.requiresOwnAlly || me.hand.some((c) => c.type === 'ally'))
      )
    case 'opponent-played-event-cost-ge':
      // Le Piégeur — Fermeture de la trappe : l'adversaire a joué un Événement de coût ≥ N.
      return (state.activePlayedEventMaxCost ?? 0) >= card.trigger.value
    case 'opponent-played-fate-hero-le': {
      const max = card.trigger.value
      return (state.activeFateHeroesAgainst ?? []).some((e) => e.target === playerIndex && e.strength <= max)
    }
    case 'opponent-moved-pawn': {
      // Mr. Monopoly — Monopoly : jouable une fois que l'adversaire a déplacé son pion,
      // et seulement si une maison peut être posée sur son lieu (plafond/blocage/Pouvoir).
      if (!state.activeMovedPawn) return false
      const loc = opp.pawnLocation
      if (!loc) return false
      return monopolyPlaceableHouses(me, loc) >= 1 && me.power >= monopolyBuyHouseCost(me, opp, loc)
    }
    case 'game-elapsed-ge':
      // Mr. Monopoly — Monotonie : ≥ N ms réelles ET au moins une carte rejouable
      // (hors Condition) dans la défausse (sinon la carte serait sans effet).
      return (state.elapsedMs ?? 0) >= card.trigger.ms && me.discard.some((c) => c.type !== 'condition')
  }
}

/** Liste des Conditions actuellement jouables par `playerIndex` (en main, trigger
 *  satisfait sur l'active player, et `playerIndex` ≠ activePlayer). */
/**
 * Ratigan — Capture (effet MOVE_REALM_HERO_TO) : Héros « déplaçables » vers
 * `destinationId`. Un Héros est éligible s'il est de force ≤ `maxStrength`, situé
 * sur un AUTRE lieu que la destination (déplacer un Héros déjà sur place n'aurait
 * aucun effet), et accepté par la destination (pas de restriction « no-heroes »,
 * force ≥ minimum imposé, lieu non interdit pour ce Héros). Sert à la fois à la
 * jouabilité de la carte, au choix de la cible et à l'affichage UI.
 */
export function realmRelocateCandidates(
  player: PlayerState,
  maxStrength: number,
  destinationId: LocationId,
): CardInstance[] {
  const destCell = player.board[destinationId] ?? []
  if (destCell.some((c) => c.placementRestriction?.type === 'no-heroes')) return []
  const minStr = destCell.reduce(
    (m, c) => (c.placementRestriction?.type === 'min-hero-strength' ? Math.max(m, c.placementRestriction.value) : m),
    0,
  )
  const out: CardInstance[] = []
  for (const loc of player.locations) {
    if (loc.id === destinationId) continue // déjà sur la destination → exclu
    for (const c of player.board[loc.id] ?? []) {
      if (
        c.type === 'hero' &&
        !c.cannotBeMoved &&
        (c.strength ?? 0) <= maxStrength &&
        (c.strength ?? 0) >= minStr &&
        !(c.forbiddenLocations ?? []).includes(destinationId)
      ) {
        out.push(c)
      }
    }
  }
  return out
}

/** Trigger CUMULATIF (compteur du tour : gains de Pouvoir, défausses, cartes/Objets
 *  joués). Pour ces triggers, une Condition piochée en cours de tour (avec un
 *  `conditionBaseline`) peut quand même réagir, mais seulement à ce qui survient APRÈS
 *  sa pioche (cf. conditionIsTriggered, qui soustrait l'instantané). */
export function isCumulativeTrigger(t?: CardInstance['trigger']): boolean {
  return (
    !!t &&
    (t.type === 'opponent-discarded-ge' ||
      t.type === 'opponent-gained-power-ge' ||
      t.type === 'opponent-played-cards-ge' ||
      t.type === 'opponent-played-item')
  )
}

/** Une Condition est-elle « réactable » maintenant ? Soit elle était en main au début
 *  du tour (`reactableConditionIds`), soit elle a été piochée en cours de tour MAIS
 *  porte un trigger cumulatif (elle réagira à ce qui se passe après sa pioche). */
export function conditionIsReactable(
  eligibleIds: string[] | undefined,
  card: CardInstance,
): boolean {
  if (eligibleIds === undefined || eligibleIds.includes(card.instanceId)) return true
  return card.conditionBaseline !== undefined && isCumulativeTrigger(card.trigger)
}

export function playableConditions(state: GameState, playerIndex: number): CardInstance[] {
  if (playerIndex === state.activePlayer) return []
  // Le Seigneur des clés — Élisabeth Bathory : tant qu'elle est dans son royaume,
  // ses Conditions sont inutilisables.
  if (Object.values(state.players[playerIndex].board).flat().some((c) => c.type === 'hero' && c.cardId === 'elisabeth-bathory')) {
    return []
  }
  // Seules les Conditions présentes en main au DÉBUT du tour peuvent réagir (une
  // Condition piochée en cours de tour n'était pas là quand le déclencheur a été
  // satisfait). `reactableConditionIds` absent (1ᵉʳ tour / état de test) = pas de filtre.
  const eligible = state.players[playerIndex].reactableConditionIds
  // Fenêtre de FIN DE TOUR (Aura effrayante) : hors de cette fenêtre, seules les Conditions
  // « en cours de tour » réagissent ; DANS la fenêtre, seules les `reactAtEndOfTurn`.
  const inEndTurnWindow = !!state.endTurnReaction
  return state.players[playerIndex].hand.filter(
    (c) =>
      c.type === 'condition' &&
      !!c.reactAtEndOfTurn === inEndTurnWindow &&
      conditionIsReactable(eligible, c) &&
      conditionIsTriggered(state, c, playerIndex),
  )
}

/**
 * Coût effectif d'une carte pour le joueur actif :
 *   - Couronne du Roi Richard : −1 sur toute carte (lieu courant du pion).
 *   - Bâton Magique : −1 sur Événement/Malédiction (lieu courant).
 *   - Épée de Vérité : +2 sur Malédiction posée sur le LIEU DE DESTINATION
 *     où l'Épée est attachée à un Héros.
 *  Plancher à 0.
 */
export function effectiveCost(
  state: GameState,
  card: CardInstance,
  destination?: LocationId,
): number {
  const base = Math.max(0, card.cost ?? 0)
  let discount = 0
  let surcharge = 0
  const me = activePlayer(state)
  const loc = me.pawnLocation
  if (loc) {
    const cell = me.board[loc] ?? []
    discount += cell.filter((c) => c.cardId === 'couronne-roi-richard').length
    if (card.type === 'effect' || card.type === 'curse') {
      discount += cell.filter((c) => c.cardId === 'baton-magique').length
    }
    // La Bonne Fée — Baguette Magique : les Objets coûtent 1 de moins par Baguette
    // présente sur le lieu du pion.
    if (card.type === 'item') {
      discount += cell.filter((c) => c.cardId === 'baguette').length
      // Tabbou — Canon Obscur : les Objets coûtent N de moins par carte portant
      // `itemCostReductionHere` sur le lieu du pion (data-driven).
      discount += cell.reduce((n, c) => n + (c.itemCostReductionHere ?? 0), 0)
    }
  }
  if (card.type === 'curse' && destination) {
    const destCell = me.board[destination] ?? []
    surcharge += destCell.filter((c) => c.cardId === 'epee-verite').length * 2
  }
  // Jafar — Razoul : jouer un Allié sur le lieu de Razoul coûte 1 de moins.
  if (card.type === 'ally' && destination) {
    const destCell = me.board[destination] ?? []
    if (destCell.some((c) => c.cardId === 'razoul')) discount += 1
  }
  // Hadès — Panique : Objets, Alliés et Titans coûtent 1 de moins par Panique sur
  // leur lieu de destination.
  if ((card.type === 'ally' || card.type === 'item') && destination) {
    const destCell = me.board[destination] ?? []
    discount += destCell.filter((c) => c.cardId === 'panique').length
  }
  // Scar — Ed : jouer une Hyène sur le lieu d'Ed coûte 1 de moins (par Ed présent).
  if (card.isHyena && destination) {
    const destCell = me.board[destination] ?? []
    discount += destCell.filter((c) => c.cardId === 'ed').length
  }
  // Dr Facilier — Tiana (Fatalité) : toutes les cartes de Facilier coûtent 1 de
  // plus par Tiana présente dans son royaume.
  surcharge += Object.values(me.board).flat().filter(
    (c) => c.type === 'hero' && c.cardId === 'tiana',
  ).length
  // Gul'dan — Medivh (Fatalité) : un Artéfact coûte +N par Héros « renchérisseur » présent.
  if (card.isArtifact) {
    surcharge += Object.values(me.board)
      .flat()
      .reduce((n, c) => n + (c.type === 'hero' ? (c.increasesArtifactCost ?? 0) : 0), 0)
  }
  // Sergent Calhoun (Fatalité, Sa Sucrerie) : l'action Jouer une carte coûte +N par carte
  // dotée de `playCardCostSurcharge` présente dans le royaume. Compte TOUTES les cartes
  // (Héros, mais aussi un Objet associé : Dio — Hierophant Green attaché à Kakyoin, +1).
  surcharge += Object.values(me.board)
    .flat()
    .reduce((n, c) => n + (c.playCardCostSurcharge ?? 0), 0)
  // Madame de Trémaine — Cendrillon (Fatalité) : les Événements coûtent 2 de plus
  // tant qu'elle est dans le royaume.
  if (card.type === 'effect' && Object.values(me.board).flat().some(
    (c) => c.type === 'hero' && c.cardId === 'cendrillon',
  )) {
    surcharge += 2
  }
  // Isabella — Héros Fatalité (passifs data-driven). Les Événements coûtent +N (Gilda/Norman
  // NON aimés) ou −N (Norman aimé) ; les Activités (cartes à `allowedHours`) coûtent −N par
  // Héros aimé porteur (Phil aimé).
  {
    const heroesRealm = Object.values(me.board).flat().filter((c) => c.type === 'hero')
    if (card.type === 'effect') {
      // Gilda/Norman (non aimés) : Événements +N (partout dans le royaume).
      surcharge += heroesRealm.filter((h) => !h.loved).reduce((n, h) => n + (h.eventCostSurcharge ?? 0), 0)
      // Norman (aimé) : Événement −N seulement s'il est joué SUR SON LIEU (= lieu du pion).
      const hereHeroes = loc ? (me.board[loc] ?? []).filter((c) => c.type === 'hero') : []
      discount += hereHeroes.filter((h) => h.loved).reduce((n, h) => n + (h.eventCostDiscountWhenLoved ?? 0), 0)
    }
    if (card.allowedHours && card.allowedHours.length > 0) {
      discount += heroesRealm.filter((h) => h.loved).reduce((n, h) => n + (h.activiteCostDiscountWhenLoved ?? 0), 0)
    }
  }
  // Ratigan — Outils : jouer un Objet coûte 1 de moins par Outils dans le royaume.
  if (card.type === 'item') {
    discount += Object.values(me.board)
      .flat()
      .filter((c) => c.cardId === 'outils' && !c.attachedTo).length
  }
  // Oogie Boogie — Am (Lock) : jouer un Allié coûte 1 de moins tant qu'Am est dans le royaume.
  if (card.type === 'ally' && Object.values(me.board).flat().some((c) => c.cardId === 'am' && !c.attachedTo)) {
    discount += 1
  }
  // Sombra — Lynx Seventeen (Fatalité) : Piratages/IEM coûtent 1 de plus par Lynx
  // présent (sa capacité ignorée s'il est piraté par Boop).
  if (card.isPiratage) {
    surcharge += Object.values(me.board)
      .flat()
      .filter((c) => c.type === 'hero' && c.cardId === 'lynx-seventeen' && !c.abilityHacked).length
  }
  // Ratigan — Flaversham (Fatalité) sur le Repaire secret : la Reine Robot coûte
  // 3 de moins.
  if (card.cardId === 'reine-robot') {
    const repaire = me.board['repaire-secret'] ?? []
    if (repaire.some((c) => c.type === 'hero' && c.cardId === 'flaversham')) discount += 3
  }
  // Ratigan — Félicia : le supplément de 2 Pouvoir (« ou payez 2 de plus ») n'est PAS
  // une surcharge automatique : c'est un choix résolu à la pose (applyPlayCard), selon
  // que le joueur défausse un Allié de son lieu ou paie le supplément.
  // Sombra — Faille : le prochain Piratage est gratuit.
  if (card.isPiratage && me.freePiratage) return 0
  return Math.max(0, base - discount + surcharge)
}

/** Cruella d'Enfer — nombre total de Chiots CAPTURÉS (somme des valeurs des Tuiles
 *  Chiots à l'état `captured`). Sert à l'objectif (≥ 99) et à la jauge IA. */
export function capturedPuppies(p: PlayerState): number {
  return (p.puppyTiles ?? []).filter((t) => t.state === 'captured').reduce((n, t) => n + t.value, 0)
}

/** Gaston — nombre total de jetons Obstacle restants sur le plateau (somme par lieu). */
export function totalObstacles(p: PlayerState): number {
  return Object.values(p.obstacles ?? {}).reduce((n, v) => n + v, 0)
}

/** Gaston — Belle, tant qu'elle est présente dans le royaume, empêche tout RETRAIT
 *  d'Obstacle (le retrait par REMOVE_OBSTACLE/Vanquish doit alors être bloqué). */
export function belleBlocksRemoval(p: PlayerState): boolean {
  return Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'belle')
}

/** Le Seigneur des clés — clés POSSÉDÉES (sur aucun lieu et non volées). */
export function ownedKeys(p: PlayerState): { id: string; color: string }[] {
  return (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
}

/** Le Seigneur des clés — ensemble des COULEURS de clé possédées. */
export function ownedKeyColors(p: PlayerState): Set<string> {
  return new Set(ownedKeys(p).map((k) => k.color))
}

/** Le Seigneur des clés — détient-il la Clé Noire (bloque la victoire) ? */
export function holdsBlackKey(p: PlayerState): boolean {
  return Object.values(p.board).flat().some((c) => c.cardId === 'cle-noire')
}

/** La Bonne Fée — les conditions de « Embrasse-la tout de suite ! » sont-elles réunies ?
 *  Prince Charmant (Allié) ET Fiona portant ses 2 potions sont en Salle de Bal, et aucun
 *  Shrek (bloqueur) n'est présent dans le royaume. Sert au garde-fou d'activation ET à
 *  la résolution de la victoire (applyActivate). */
export function kissAtBallConditionMet(
  state: GameState,
  playerIndex: number = state.activePlayer,
): boolean {
  const p = state.players[playerIndex]
  if (p.objective.type !== 'KISS_AT_BALL') return false
  const obj = p.objective
  const all = Object.values(p.board).flat()
  // Shrek présent → victoire impossible.
  if (all.some((c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId)) return false
  const ballroom = p.board[obj.ballroomId] ?? []
  const fiona = ballroom.find((c) => c.type === 'hero' && c.cardId === obj.heroCardId)
  if (!fiona) return false
  // Fiona doit porter ses 2 potions (associées à elle, sur le même lieu).
  const bothPotions = obj.potionCardIds.every((pid) =>
    ballroom.some((c) => c.cardId === pid && c.attachedTo === fiona.instanceId),
  )
  if (!bothPotions) return false
  // Prince Charmant (Allié) présent en Salle de Bal.
  return ballroom.some((c) => c.type === 'ally' && c.cardId === obj.allyCardId)
}

/** Le Flagelleur Mental — les conditions d'activation de l'ENTRÉE DU MONDE À L'ENVERS
 *  (victoire) sont-elles réunies ? L'Entrée (`gateCardId`) est présente dans le royaume,
 *  ONZE (`heroCardId`) partage son lieu, et chacun des `tunnelLocationCount` premiers
 *  lieux porte au moins un TUNNEL (`tunnelCardId`). Sert au garde-fou d'activation ET à
 *  la résolution de la victoire (applyActivateCore). */
export function flayerGateConditionMet(
  state: GameState,
  playerIndex: number = state.activePlayer,
): boolean {
  const p = state.players[playerIndex]
  if (p.objective.type !== 'FLAYER_GATE') return false
  const obj = p.objective
  // L'Entrée doit être posée quelque part dans le royaume (non associée).
  let gateLoc: LocationId | undefined
  for (const loc of p.locations) {
    if ((p.board[loc.id] ?? []).some((c) => c.cardId === obj.gateCardId && !c.attachedTo)) {
      gateLoc = loc.id
      break
    }
  }
  if (!gateLoc) return false
  // ONZE (Héros) sur le lieu de l'Entrée.
  if (!(p.board[gateLoc] ?? []).some((c) => c.type === 'hero' && c.cardId === obj.heroCardId)) {
    return false
  }
  // Chacun des N premiers lieux porte au moins un Tunnel (non associé).
  const firstLocs = p.locations.slice(0, obj.tunnelLocationCount)
  if (firstLocs.length < obj.tunnelLocationCount) return false
  return firstLocs.every((loc) =>
    (p.board[loc.id] ?? []).some((c) => c.cardId === obj.tunnelCardId && !c.attachedTo),
  )
}

/** Le Flagelleur Mental — Alliés DÉFAUSSABLES pour payer un Tunnel de Hawkins, restreints à
 *  UN lieu donné (Alliés non associés, hors arceaux/indéfaussables, et hors Billy
 *  `cannotDiscardForTunnel`) : les Alliés sacrifiés viennent d'un même lieu, où le Tunnel
 *  sera posé. */
export function flayerTunnelDiscardableAlliesAt(p: PlayerState, locationId: string): CardInstance[] {
  return (p.board[locationId] ?? []).filter(
    (c) =>
      c.type === 'ally' &&
      !c.attachedTo &&
      !c.isWicket &&
      !c.cannotBeDiscarded &&
      !c.cannotDiscardForTunnel,
  )
}

/** Le Flagelleur Mental — nombre d'Alliés REQUIS sur le lieu pour poser un Tunnel : la base
 *  de l'effet, +1 par Héros `surchargeHeroCardId` (Onze) présent dans le royaume. C'est le
 *  nombre d'Alliés qui doivent être PRÉSENTS (Billy compris) ; le nombre réellement DÉFAUSSÉ
 *  est donné par `flayerTunnelDiscardsNeededAt` (Billy compte mais n'est jamais défaussé). */
export function flayerTunnelRequiredAllies(
  p: PlayerState,
  effect: { baseAllies: number; surchargeHeroCardId: string },
): number {
  const onzePresent = Object.values(p.board)
    .flat()
    .some((c) => c.type === 'hero' && c.cardId === effect.surchargeHeroCardId)
  return effect.baseAllies + (onzePresent ? 1 : 0)
}

/** Le Flagelleur Mental — nombre d'Alliés à DÉFAUSSER pour poser un Tunnel sur `locationId` :
 *  le nombre requis (`flayerTunnelRequiredAllies`) diminué des Alliés PROTÉGÉS présents sur ce
 *  lieu (Billy `cannotDiscardForTunnel`), qui COMPTENT parmi les Alliés requis mais ne sont
 *  jamais défaussés. Jamais négatif. Ex. Billy + 1 Vignes (requis 2) → 1 seul à défausser. */
export function flayerTunnelDiscardsNeededAt(
  p: PlayerState,
  locationId: string,
  effect: { baseAllies: number; surchargeHeroCardId: string },
): number {
  const required = flayerTunnelRequiredAllies(p, effect)
  const protectedPresent = (p.board[locationId] ?? []).filter(
    (c) => c.type === 'ally' && !c.attachedTo && !c.isWicket && c.cannotDiscardForTunnel,
  ).length
  return Math.max(0, required - protectedPresent)
}

/** Le joueur `playerIndex` (défaut : joueur actif) a-t-il atteint son objectif de
 *  victoire ? Dispatch sur le type d'objectif (POWER_THRESHOLD, CURSE_EACH_LOCATION,
 *  …). Les objectifs déclenchés « à l'instant » (Coup Royal, Vanquish, Divination)
 *  renvoient `false` ici : ils n'ont pas de fenêtre « atteint mais en attente ». */
/** Isabella — une Activité (carte portant `allowedHours`) n'est jouable que si l'heure
 *  courante de l'horloge (`clockHour`) figure dans ses heures autorisées. Les cartes
 *  sans `allowedHours` ne sont pas concernées (toujours « vrai » ici). */
export function activitePlayableAtHour(player: PlayerState, card: CardInstance): boolean {
  if (!card.allowedHours || card.allowedHours.length === 0) return true
  // Incendie : ce tour-ci, AUCUNE Activité (prioritaire, même sur le Radar de poche).
  if (player.incendieActive) return false
  // Radar de poche : ce tour-ci, toute Activité est jouable quelle que soit l'heure.
  if (player.activiteAnyHourThisTurn) return true
  return card.allowedHours.includes(player.clockHour ?? 0)
}

// --- Ultron (Marvel) — tuiles AMÉLIORATION ----------------------------------
/** Nombre total de tuiles Amélioration (Transformation → Optimisation → Forme finale
 *  → L'ère d'Ultron). Révéler la 4ᵉ = victoire. */
export const ULTRON_UPGRADE_COUNT = 4
/** cardId de base servant aux conditions des tuiles. */
export const ULTRON_DRONE_COMBAT = 'ultron-drone-de-combat'
export const ULTRON_ALLIAGE = 'ultron-alliage-impenetrable'

/** Index de la PROCHAINE Amélioration à révéler (0..4 ; 4 = toutes révélées). */
export function ultronNextUpgrade(p: PlayerState): number {
  return p.ultronUpgrades ?? 0
}

/** Sentinelles (Drones) POSÉES dans le domaine (non associées), tous lieux confondus. */
export function ultronSentriesInRealm(p: PlayerState): CardInstance[] {
  return p.locations.flatMap((loc) => (p.board[loc.id] ?? []).filter((c) => c.isSentry && !c.attachedTo))
}

/** Ultron — OPTIMISATION disponible : la 2ᵉ Amélioration est révélée, le passif n'a pas encore
 *  été employé ce tour, et il existe au moins un Allié/Objet/Malédiction DÉPLAÇABLE (non associé)
 *  dans le domaine. Sert à l'UI pour proposer, au clic d'une action « Jouer une carte », de la
 *  transformer en « Déplacer un Allié/Objet ». (Les règles fines de déplacement sont vérifiées
 *  au moment du move.) */
export function ultronOptimizeAvailable(state: GameState, playerIndex: number = state.activePlayer): boolean {
  const p = state.players[playerIndex]
  if (p.objective.type !== 'ULTRON_AGE_REVEALED') return false
  if ((p.ultronUpgrades ?? 0) < 2) return false
  if (p.ultronOptimUsedThisTurn) return false
  return Object.values(p.board)
    .flat()
    .some((c) => (c.type === 'ally' || c.type === 'item' || c.type === 'curse') && !c.attachedTo)
}

/** La condition de la PROCHAINE Amélioration est-elle remplie (indépendamment du choix
 *  précis des cartes à défausser) ? Sert au surlignage UI et à l'IA. Tient compte de la
 *  limite « 1 Amélioration par tour ». */
export function ultronUpgradeConditionMet(state: GameState, playerIndex: number = state.activePlayer): boolean {
  const p = state.players[playerIndex]
  if (p.objective.type !== 'ULTRON_AGE_REVEALED') return false
  if (p.ultronUpgradeThisTurn) return false
  switch (ultronNextUpgrade(p)) {
    case 0: // Transformation : ≥ 2 Sentinelles dans le domaine.
      return ultronSentriesInRealm(p).length >= 2
    case 1: // Optimisation : un DRONE DE COMBAT portant ≥ 2 ALLIAGE IMPÉNÉTRABLE.
      return p.locations.some((loc) => {
        const cards = p.board[loc.id] ?? []
        return cards.some(
          (c) =>
            c.cardId === ULTRON_DRONE_COMBAT &&
            !c.attachedTo &&
            cards.filter((a) => a.attachedTo === c.instanceId && a.cardId === ULTRON_ALLIAGE).length >= 2,
        )
      })
    case 2: // Forme finale : ≥ 1 Sentinelle sur CHAQUE lieu du domaine.
      return p.locations.every((loc) => (p.board[loc.id] ?? []).some((c) => c.isSentry && !c.attachedTo))
    case 3: // L'ère d'Ultron : payer 12 Pouvoir.
      return p.power >= 12
    default:
      return false // toutes révélées
  }
}

export function hasReachedObjective(state: GameState, playerIndex: number = state.activePlayer): boolean {
  const p = state.players[playerIndex]
  switch (p.objective.type) {
    case 'POWER_THRESHOLD':
      return p.power >= p.objective.threshold
    case 'SPIRIT_THRESHOLD':
      // Sumbra / Kilaire — avoir capturé ≥ threshold esprits au début de son tour.
      return (p.spirits ?? 0) >= p.objective.threshold
    case 'ISABELLA_CLOCK':
      // Isabella — les 6 heures (XII, II, IV, VI, VIII, X) ont chacune reçu une Activité.
      return (p.validatedHours ?? []).length >= 6
    case 'CONFIANCE_THRESHOLD':
      return (p.confiance ?? 0) >= p.objective.threshold
    case 'PUPPY_THRESHOLD':
      return capturedPuppies(p) >= p.objective.threshold
    case 'KILL_FIGHTERS': {
      // Tabbou : ≥ threshold Combattants tués (30 tant que Samus est présente).
      const obj = p.objective
      const killed = (p.fighterTiles ?? []).filter((t) => t.state === 'killed').length
      let threshold = obj.threshold
      if (obj.raiseHeroCardId !== undefined && obj.raiseTo !== undefined) {
        const samusPresent = Object.values(p.board).some((cards) =>
          cards.some((c) => c.type === 'hero' && c.cardId === obj.raiseHeroCardId),
        )
        if (samusPresent) threshold = obj.raiseTo
      }
      return killed >= threshold
    }
    case 'CAPTURE_POKEMON': {
      const obj = p.objective
      const pile = p.capturedPokemon ?? []
      return pile.length >= obj.count && pile.some((c) => c.cardId === obj.requiredCardId)
    }
    case 'THANOS_STONES': {
      // Thanos : posséder les 6 Pierres d'Infinité en Compétences. Bloqué tant qu'Adam
      // Warlock (blockerHeroCardId) est présent dans le royaume.
      const obj = p.objective
      if (obj.blockerHeroCardId !== undefined) {
        const blocked = Object.values(p.board).some((cards) =>
          cards.some((c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId),
        )
        if (blocked) return false
      }
      return (p.stoneSkills ?? []).length >= 6
    }
    case 'REMOVE_ALL_OBSTACLES':
      return totalObstacles(p) === 0
    case 'KEYS_ALL_COLORS':
      return ownedKeyColors(p).size >= 6 && !holdsBlackKey(p)
    case 'MARRY_PRINCE': {
      const obj = p.objective
      const ballroom = p.board[obj.ballroomId] ?? []
      const gown = ballroom.some((c) => obj.ballGownCardIds.includes(c.cardId) && c.type === 'ally' && !c.attachedTo)
      const prince = ballroom.some((c) => c.cardId === obj.princeCardId)
      const bells = Object.values(p.board).flat().some((c) => c.cardId === obj.bellsCardId && !c.attachedTo)
      const slipper = Object.values(p.board).flat().some((c) => obj.slipperCardIds.includes(c.cardId))
      return gown && prince && bells && !slipper
    }
    case 'JUDGMENT_TILES_ALL':
      // Pyramid Head : une tuile de Jugement sur CHAQUE lieu (toutes propagées).
      return (p.judgmentTiles ?? 0) >= p.locations.length
    case 'ULTRON_AGE_REVEALED':
      // Ultron : les 4 tuiles Amélioration révélées (la 4ᵉ = L'ère d'Ultron).
      return (p.ultronUpgrades ?? 0) >= ULTRON_UPGRADE_COUNT
    case 'CURSE_EACH_LOCATION':
      return p.locations.every((loc) =>
        (p.board[loc.id] ?? []).some((c) => c.type === 'curse'),
      )
    case 'CARDS_IN_REALM': {
      const obj = p.objective
      const total = p.locations.reduce(
        (n, loc) =>
          n + (p.board[loc.id] ?? []).filter((c) => c.cardId === obj.cardId && !c.attachedTo).length,
        0,
      )
      return total >= obj.count
    }
    case 'CONTROL_HERO': {
      const obj = p.objective
      // Contrôler le Héros visé (Héros hypnotisé présent dans le royaume)…
      const controls = Object.values(p.board).some((cards) =>
        cards.some((c) => c.type === 'hero' && c.cardId === obj.heroCardId && c.hypnotized),
      )
      // …et avoir l'Objet requis posé sur le lieu requis.
      const itemPlaced = (p.board[obj.itemLocationId] ?? []).some(
        (c) => c.cardId === obj.itemCardId,
      )
      return controls && itemPlaced
    }
    case 'ROYAL_CROQUET':
      // Victoire déclenchée par la carte Coup Royal (pas un contrôle passif).
      return false
    case 'KISS_AT_BALL':
      // La Bonne Fée — victoire ÉVÉNEMENTIELLE : déclenchée en activant « Embrasse-la
      // tout de suite ! » (phase moteur ultérieure), pas par un contrôle passif ici.
      return false
    case 'FLAYER_GATE':
      // Le Flagelleur Mental — victoire ÉVÉNEMENTIELLE : déclenchée en activant l'ENTRÉE
      // DU MONDE À L'ENVERS (applyActivateCore), pas par un contrôle passif ici.
      return false
    case 'DEFEAT_HERO_AT_LOCATION':
      // Victoire déclenchée à l'instant du Vanquish (performVanquish), pas ici.
      return false
    case 'DEFEAT_HERO_NO_FIRE':
      // Shere Khan — victoire ÉVÉNEMENTIELLE : vaincre Mowgli sans jeton Feu (performVanquish).
      return false
    case 'DEFEAT_NAMED_HERO':
      // Michael Myers — victoire ÉVÉNEMENTIELLE : éliminer LAURIE (performVanquish).
      return false
    case 'CLAIM_ALL_TREASURES':
      // Davy Jones — victoire ÉVÉNEMENTIELLE : récupérer le 5ᵉ Trésor au Vanquish (performVanquish).
      return false
    case 'DIO_ALL_ACTIONS':
      // Dio — victoire ÉVÉNEMENTIELLE : déclenchée à l'instant où la dernière action
      // hors-Fatalité du royaume est effectuée dans le tour (boucle d'action), Jotaro et
      // Joseph déjà retirés du jeu. `dioRealmSweepDone` matérialise cette fenêtre courte.
      return (
        !!p.dioRealmSweepDone &&
        p.objective.joestarCardIds.every((id) => (p.removedFromGame ?? []).includes(id))
      )
    case 'KING_CANDY_RACE':
      // Sa Sucrerie — victoire ÉVÉNEMENTIELLE : déclenchée quand le pion franchit
      // Départ/Arrivée pendant une course (moveKingCandyTrack), pas en début de tour.
      return false
    case 'ITEMS_AT_LOCATION': {
      const obj = p.objective
      const cell = p.board[obj.locationId] ?? []
      return obj.itemCardIds.every((id) => cell.some((c) => c.cardId === id && !c.attachedTo))
    }
    case 'HERO_CAGED': {
      // Grand Councilwoman : STITCH (heroCardId) associé à la CAGE (itemCardId), et la
      // CAGE se trouve sur locationId (le Vaisseau de Gantu).
      const obj = p.objective
      const cell = p.board[obj.locationId] ?? []
      const cage = cell.find((c) => c.type === 'item' && c.cardId === obj.itemCardId && !c.attachedTo)
      if (!cage) return false
      return cell.some((c) => c.type === 'hero' && c.cardId === obj.heroCardId && c.attachedTo === cage.instanceId)
    }
    case 'UNTRAPPED_TITANS_AT_LOCATION': {
      const obj = p.objective
      const titans = (p.board[obj.locationId] ?? []).filter((c) => c.isTitan && !c.trapped)
      return titans.length >= obj.count
    }
    case 'REIGN_NEW_ORLEANS':
      // Victoire déclenchée pendant la résolution de Divination (révéler Régner en
      // détenant le Talisman), pas par un contrôle passif en début de tour.
      return false
    case 'SOMBRA':
      // Victoire déclenchée par Protocole Sombra quand tous les lieux sont piratés
      // (événementielle), pas par un contrôle passif en début de tour.
      return false
    case 'DEPLETE_OBSERVATORY_AND_CAPTURE': {
      const obj = p.objective
      // Observatoire épuisé (0 Étoile) ET Peach capturée…
      if ((p.observatoryStars ?? 0) > 0) return false
      if (!p.peachCaptured) return false
      // …et aucun Héros « bloqueur » (Mario) présent dans le royaume.
      if (obj.blockerHeroCardId) {
        const blocked = Object.values(p.board).some((cards) =>
          cards.some((c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId),
        )
        if (blocked) return false
      }
      return true
    }
    case 'KEEP_SABOTAGE': {
      // Victoire quand un Sabotage posé a survécu `turns` tours (son compte à
      // rebours `sabotageTurns`, incrémenté en fin de tour, atteint le seuil).
      const turns = p.objective.turns
      return Object.values(p.board)
        .flat()
        .some((c) => c.isSabotage && !c.attachedTo && (c.sabotageTurns ?? 0) >= turns)
    }
    case 'SUCCESSION_FORCE': {
      // Scar : Mufasa doit être dans la pile Succession, et la Force combinée des
      // Héros de la pile doit atteindre le seuil. Vérifié au début de son tour.
      const obj = p.objective
      const pile = p.succession ?? []
      if (!pile.some((c) => c.cardId === obj.firstHeroCardId)) return false
      const force = pile.reduce((n, c) => n + (c.strength ?? 0), 0)
      return force >= obj.minForce
    }
    case 'DEFEAT_HERO_WITH_ALLY':
      // Yzma : drapeau posé au moment où Kronk élimine Kuzco (performVanquish).
      return !!p.objectiveHeroDefeated
    case 'RATIGAN_DUAL': {
      const obj = p.objective
      // La Reine Moustoria à Buckingham Palace empêche la victoire, quel que soit
      // le côté de la tuile Objectif.
      const blocked = (p.board[obj.locationId] ?? []).some(
        (c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId,
      )
      if (blocked) return false
      if (p.becameTheRat) {
        // Côté « Le Rat » : éliminer Basil (drapeau posé au Vanquish).
        return !!p.objectiveHeroDefeated
      }
      // Côté « L'Esprit Supérieur » : la Reine Robot (non associée) doit être à
      // Buckingham Palace au début du tour.
      return (p.board[obj.locationId] ?? []).some(
        (c) => c.cardId === obj.itemCardId && !c.attachedTo,
      )
    }
    case 'COMPLETE_GOAL_TOKENS': {
      // Pat Hibulaire : les 4 tuiles Objectif posées doivent toutes être remplies.
      // La complétion d'une tuile est verrouillée tant que Mickey est présent
      // (géré au moment où la tuile passe à `completed`), donc ce contrôle final
      // se contente de vérifier qu'elles le sont toutes.
      const goals = p.goals ?? []
      return goals.length > 0 && goals.every((g) => g.completed)
    }
    case 'CAULDRON_BORN_EVERYWHERE':
      // Le Seigneur des Ténèbres : un Mort-vivant du Chaudron (Allié non associé)
      // sur CHACUN de ses lieux.
      return p.locations.every((loc) =>
        (p.board[loc.id] ?? []).some((c) => c.cardId === 'cauldron-born' && c.type === 'ally' && !c.attachedTo),
      )
    case 'DEFEAT_ALL_MERLIN':
      // Madame Mim : les 7 Métamorphoses de Merlin sont vaincues — la pioche Merlin est
      // vide ET aucune Métamorphose de Merlin n'est en jeu (toutes en merlinDiscard).
      return (
        (p.merlinDeck?.length ?? 0) === 0 &&
        !Object.values(p.board).flat().some((c) => c.isMerlinTransformation)
      )
    case 'DEFEAT_OMNIDROID_V10':
      // Syndrome : l'Omnidroïde v.10 a été détruit (via la Télécommande) ET aucun Héros
      // ne reste dans le royaume.
      return (
        p.omnidroidStage === 'destroyed' &&
        !Object.values(p.board).flat().some((c) => c.type === 'hero')
      )
    case 'LOTSO_GATHER': {
      // Lotso : les 4 Héros, tous sur la Salle des Chenilles à force EFFECTIVE 0, ET la
      // tuile Buzz (n'importe quelle face) sur ce lieu.
      const room = p.board[p.objective.roomId] ?? []
      const buzzHere = room.some((c) => c.isBuzz)
      if (!buzzHere) return false
      return p.objective.heroCardIds.every((id) => {
        const hero = room.find((c) => c.type === 'hero' && c.cardId === id)
        return !!hero && (effectiveStrength(state, playerIndex, hero.instanceId) ?? 0) === 0
      })
    }
    case 'PIEGEUR_ELIMINATE_ALL_SURVIVORS': {
      // Le Piégeur : victoire quand plus aucun Survivant ne subsiste (ni sur le plateau,
      // ni dans la pile). Vérification passive de repli ; l'élimination du dernier
      // survivant déclenche aussi la victoire (Phase 2, effets d'élimination).
      const onBoard = Object.values(p.board).flat().some((c) => c.isSurvivor)
      const inPile = (p.survivorPile ?? []).length > 0
      return !onBoard && !inPile
    }
  }
}

/** Pat Hibulaire — un Héros « bloqueur » (Mickey) est présent dans le royaume :
 *  aucune tuile Objectif ne peut être complétée tant qu'il est là. */
export function goalsBlockedByHero(p: PlayerState): boolean {
  if (p.objective.type !== 'COMPLETE_GOAL_TOKENS') return false
  const id = p.objective.blockerHeroCardId
  if (!id) return false
  return Object.values(p.board)
    .flat()
    .some((c) => c.type === 'hero' && c.cardId === id)
}

/** Pat Hibulaire — la tuile « début de tour » est-elle remplie dans l'état courant ?
 *  (Strike It Rich / Round Up / Rule the Realm.) Win Big / Power Play sont
 *  ÉVÉNEMENTIELLES (complétées au moment du déclencheur), donc toujours false ici. */
export function isPassiveGoalMet(p: PlayerState, goal: GoalToken): boolean {
  const cell = p.board[goal.locationId] ?? []
  switch (goal.kind) {
    case 'strike-it-rich':
      return cell.filter((c) => c.type === 'item' && !c.attachedTo).length >= 3
    case 'round-up':
      return cell.filter((c) => c.type === 'ally').reduce((n, c) => n + (c.strength ?? 0), 0) >= 10
    case 'rule-the-realm':
      return p.locations.every((l) => {
        const here = p.board[l.id] ?? []
        return (
          here.filter((c) => c.type === 'ally').length >
          here.filter((c) => c.type === 'hero').length
        )
      })
    default:
      return false
  }
}

/** Vrai si le tour courant peut être terminé (on a déjà bougé ce tour). */
export function canEndTurn(state: GameState): boolean {
  return state.status === 'PLAYING' && state.phase === 'ACTION'
}

/**
 * Pat Hibulaire — Dingo : coups possibles. Interversion de 2 tuiles Objectif
 * voisines dont `from` porte une tuile NON remplie. Une tuile REMPLIE compte comme
 * un emplacement « libre » (déplacer la tuile vers ce lieu = échanger avec la tuile
 * remplie, `toCompleted: true`). Sert à la fois à la modale (humain) et à l'auto (bot).
 */
export function dingoSwapOptions(
  player: PlayerState,
): { from: LocationId; to: LocationId; toCompleted: boolean }[] {
  const goals = player.goals ?? []
  const order = player.locations.map((l) => l.id)
  const tileAt = (lid: LocationId) => goals.find((g) => g.locationId === lid)
  const out: { from: LocationId; to: LocationId; toCompleted: boolean }[] = []
  const seen = new Set<string>()
  for (let i = 0; i < order.length; i++) {
    const here = tileAt(order[i])
    if (!here || here.completed) continue // `from` doit porter une tuile NON remplie
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= order.length) continue
      const nb = tileAt(order[j])
      if (!nb) continue
      // Dédoublonne les paires non-remplie ↔ non-remplie (A↔B == B↔A).
      const key = nb.completed ? `${order[i]}>${order[j]}` : [order[i], order[j]].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ from: order[i], to: order[j], toCompleted: !!nb.completed })
    }
  }
  return out
}
