// =============================================================================
// Règles : coups légaux, actions disponibles, détection de victoire.
// Fonctions pures de lecture — elles ne modifient jamais l'état. Tout est
// évalué pour le JOUEUR ACTIF.
// =============================================================================

import type {
  CardInstance,
  GameState,
  LocationAction,
  LocationActionType,
  LocationId,
  PlayerState,
} from './types'
import { activePlayer, currentLocation } from './state'

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
  'ACTIVATE',
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
  const p = activePlayer(state)
  const locked = new Set(p.lockedLocations ?? [])
  return p.locations
    .filter((loc) => loc.id !== p.pawnLocation && !locked.has(loc.id))
    .map((loc) => loc.id)
}

/** Vrai si un déplacement vers `to` est légal dans l'état courant. */
export function isLegalMove(state: GameState, to: LocationId): boolean {
  return getLegalMoves(state).includes(to)
}

/** Les Héros présents sur un lieu donné du joueur actif. */
export function heroesAt(state: GameState, locationId: LocationId): CardInstance[] {
  return (activePlayer(state).board[locationId] ?? []).filter((c) => c.type === 'hero')
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
  if (action.row !== 'top') return false
  const loc = currentLocation(state)
  if (!loc) return false
  if (state.persifleurAvailable) return false
  // Héros qui recouvrent (les hypnotisés, sous contrôle, ne recouvrent plus).
  const covering = heroesAt(state, loc.id).filter((h) => !h.hypnotized)
  // Héros AGRANDIS d'un lieu voisin qui débordent sur CE lieu : chacun recouvre
  // une action du haut supplémentaire ici (le côté choisi à la pose d'Agrandir).
  const enlargedSpillover = Object.values(activePlayer(state).board)
    .flat()
    .filter(
      (c) =>
        c.type === 'hero' &&
        c.heroSize === 'enlarged' &&
        !c.hypnotized &&
        c.enlargeTargetId === loc.id,
    ).length
  if (covering.length === 0 && enlargedSpillover === 0) return false
  // Un Héros à taille normale OU agrandi sur CE lieu recouvre toute la rangée du haut.
  if (covering.some((h) => h.heroSize !== 'shrunk')) return true
  // Sinon : que des Héros rapetissés ici (et/ou débordement d'un agrandi voisin).
  // Chacun ne recouvre qu'UNE action du haut ; la Reine choisit lesquelles utiliser.
  // On laisse (nbActionsHaut − nbRecouvertes) actions utilisables ; une fois ce
  // quota atteint, le reste du haut est recouvert.
  const topIds = loc.actions.filter((a) => a.row === 'top').map((a) => a.id)
  const usableTop = Math.max(0, topIds.length - covering.length - enlargedSpillover)
  const topUsed = topIds.filter((id) => state.usedActionIds.includes(id)).length
  return topUsed >= usableTop
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
  const loc = currentLocation(state)
  if (!loc) return []
  return locationActions(state, loc.id).filter(
    (a) =>
      isSupportedType(a.type) &&
      !state.usedActionIds.includes(a.id) &&
      !isActionCovered(state, a) &&
      // « Activer » n'est disponible que s'il existe une carte activable.
      (a.type !== 'ACTIVATE' || activatableCards(state).length > 0),
  )
}

/** Vrai si l'action `actionId` est disponible sur le lieu courant. */
export function isActionAvailable(state: GameState, actionId: string): boolean {
  return getAvailableActions(state).some((a) => a.id === actionId)
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
  return p.locations.map((l) => l.id).filter((id) => !locked.has(id))
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
  return out.filter((id) => !locked.has(id))
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
  const out: { instanceId: string; from: LocationId }[] = []
  for (const loc of me.locations) {
    // Rien ne peut être déplacé DEPUIS un lieu verrouillé.
    if (locked.has(loc.id)) continue
    for (const c of me.board[loc.id] ?? []) {
      if (isItemFrozen(me, c)) continue // Ariel : Objet gelé
      // Une Malédiction est traitée comme un Objet : elle se déplace aussi. Un
      // Héros hypnotisé (Jafar) compte comme un Allié → déplaçable lui aussi.
      const isControlledAlly = c.type === 'hero' && c.hypnotized
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
      if (c.activatedCost !== undefined && c.activatedCost <= me.power) out.push(c)
    }
  }
  return out
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

/** Tous les Héros présents dans le royaume d'un joueur (utile pour Voler aux
 *  Riches et Déguisement — Fatalité non-Héros qui ciblent un Héros adverse). */
export function heroesOf(state: GameState, playerIndex: number): CardInstance[] {
  const p = state.players[playerIndex]
  return Object.values(p.board).flatMap((cards) => cards.filter((c) => c.type === 'hero'))
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
    }
  }, 0)

  // Bonus temporaire « jusqu'à la fin du tour » (Capitaine Crochet : Pas de
  // Quartier !). Champ de donnée porté par la carte ; s'applique Allié comme Héros.
  const tempBonus = card.tempStrengthBonus ?? 0

  if (card.type === 'ally') {
    // Aura des cartes du lieu sur les Alliés (Niquedouille +1, Pendard -1) —
    // `excludeSelf` empêche la carte source de s'affecter elle-même.
    const allyAura = cell.reduce((sum, c) => {
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
    return Math.max(0, card.strength + attachedStrengthBonus + selfMod + allyAura + sabreBonus + moucheBonus + tempBonus)
  }
  if (card.type === 'hero') {
    // Aura des cartes du lieu sur les Héros (Sommeil sans Rêves -2 ; Sablier Géant
    // -2 seulement s'il a été activé ce tour-ci).
    const heroAura = cell.reduce((sum, c) => {
      const m = c.strengthMod
      if (m && m.target === 'heroes-here') {
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
        const m = c.strengthMod
        if (m && m.target === 'heroes-realm' && !(m.excludeSelf && c.instanceId === card.instanceId)) {
          return sum + m.delta
        }
        return sum
      }, 0)
    // Capitaine Crochet — bonus encore codés par cardId (TODO : migrer, cf. CLAUDE.md) :
    //  - Poussière de Fée : +2 par carte associée à ce Héros (→ attachStrengthBonus).
    const pixieBonus = cell.filter(
      (c) => c.cardId === 'poussiere-fee' && c.attachedTo === card.instanceId,
    ).length * 2
    //  - Wendy : +1 à tous les AUTRES Héros du royaume (→ strengthMod heroes-realm).
    const wendyBonus =
      card.cardId !== 'wendy' && heroesOf(state, playerIndex).some((h) => h.cardId === 'wendy') ? 1 : 0
    //  - Jean : +1 si au moins un Objet lui est associé.
    const jeanBonus =
      card.cardId === 'jean' &&
      cell.some((c) => c.type === 'item' && c.attachedTo === card.instanceId)
        ? 1
        : 0
    //  - Michel : +1 par lieu du royaume occupé par au moins un Héros (le sien compris).
    const michelBonus =
      card.cardId === 'michel'
        ? p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'hero')).length
        : 0
    return Math.max(
      0,
      card.strength + attachedStrengthBonus + selfMod + heroAura + realmHeroAura + pixieBonus + wendyBonus + jeanBonus + michelBonus + tempBonus,
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
  const locked = new Set(state.players[targetIndex].lockedLocations ?? [])
  return state.players[targetIndex].locations
    .map((l) => l.id)
    .filter((id) => !forbidden.has(id) && !locked.has(id) && canPlaceHeroAt(state, targetIndex, id, card))
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

/** Vrai si une Malédiction peut être posée sur le lieu : plusieurs Malédictions
 *  peuvent cohabiter ; seule une restriction `no-curses` (Pimprenelle) l'interdit. */
export function canPlaceCurseAt(
  state: GameState,
  playerIndex: number,
  locationId: LocationId,
): boolean {
  // Plusieurs Malédictions peuvent cohabiter sur un même lieu (règle officielle) :
  // on ne bloque que les lieux portant une restriction `no-curses`.
  const cell = state.players[playerIndex].board[locationId] ?? []
  if (cell.some((c) => c.placementRestriction?.type === 'no-curses')) return false
  return true
}

/** Le joueur actif peut-il lancer une Fatalité (la cible a-t-elle des cartes) ? */
export function canFate(state: GameState): boolean {
  const t = state.players[fateTarget(state)]
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
      e.type === 'SET_HERO_SIZE',
  )
}

/** Vrai si cette carte déclenche un Vanquish (besoin de Héros + Alliés à la pose).
 *  Intimidation, Tendre un Piège. */
export function cardNeedsVanquishTarget(card: CardInstance): boolean {
  return (card.effects ?? []).some((e) => e.type === 'VANQUISH_HERO')
}

/** Vrai si cette carte exige de désigner un Allié/Objet du royaume à sacrifier
 *  (Jafar : Sacrifice Nécessaire). */
export function cardNeedsSacrificeTarget(card: CardInstance): boolean {
  return (card.effects ?? []).some((e) => e.type === 'DISCARD_OWN_FOR_POWER')
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
      // Les Malédictions de Maléfique comptent comme des Objets.
      const items = Object.values(opp.board)
        .flat()
        .filter((c) => c.type === 'item' || c.type === 'curse').length
      return items >= card.trigger.value
    }
    case 'opponent-vanquished-hero-strength-ge':
      return (state.lastVanquishedHeroStrength ?? 0) >= card.trigger.value
    case 'opponent-moved-card':
      return !!state.activeMovedCard
    case 'opponent-drew-card':
      return !!state.activeDrewCard
  }
}

/** Liste des Conditions actuellement jouables par `playerIndex` (en main, trigger
 *  satisfait sur l'active player, et `playerIndex` ≠ activePlayer). */
export function playableConditions(state: GameState, playerIndex: number): CardInstance[] {
  if (playerIndex === state.activePlayer) return []
  return state.players[playerIndex].hand.filter(
    (c) => c.type === 'condition' && conditionIsTriggered(state, c, playerIndex),
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
  return Math.max(0, base - discount + surcharge)
}

/** Le joueur actif a-t-il atteint son objectif de victoire ? Dispatch sur le
 *  type d'objectif (POWER_THRESHOLD, CURSE_EACH_LOCATION, …). */
export function hasReachedObjective(state: GameState): boolean {
  const p = activePlayer(state)
  switch (p.objective.type) {
    case 'POWER_THRESHOLD':
      return p.power >= p.objective.threshold
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
    case 'DEFEAT_HERO_AT_LOCATION':
      // Victoire déclenchée à l'instant du Vanquish (performVanquish), pas ici.
      return false
    case 'ITEMS_AT_LOCATION': {
      const obj = p.objective
      const cell = p.board[obj.locationId] ?? []
      return obj.itemCardIds.every((id) => cell.some((c) => c.cardId === id && !c.attachedTo))
    }
  }
}

/** Vrai si le tour courant peut être terminé (on a déjà bougé ce tour). */
export function canEndTurn(state: GameState): boolean {
  return state.status === 'PLAYING' && state.phase === 'ACTION'
}
