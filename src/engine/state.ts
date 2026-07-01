// =============================================================================
// Création et utilitaires de l'état de jeu (fonctions pures).
// =============================================================================

import type {
  CardInstance,
  Crewmate,
  FloatingFx,
  GameState,
  Location,
  PlayerState,
  VillainDef,
} from './types'
import { shuffle, nextRandom } from './rng'
import { KEY_COLORS, type KeyColor } from './types'
import { TREASURE_IDS } from './davyJones'

/** Nombre de cartes en main à compléter en fin de tour. */
export const HAND_LIMIT = 4

/** Configuration d'un joueur pour démarrer une partie. */
export interface PlayerSetup {
  villain: VillainDef
  /** Exemplaires du deck Vilain (instanceId déjà uniques entre joueurs). */
  deckCards: CardInstance[]
  /** Exemplaires du deck Fatalité (joué par les adversaires contre ce joueur). */
  fateCards: CardInstance[]
}

/** Copie défensive du plateau pour ne pas partager de référence mutable. */
function cloneLocations(locations: Location[]): Location[] {
  return locations.map((loc) => ({
    ...loc,
    actions: loc.actions.map((a) => ({ ...a })),
    // Face alternative (lieux transformables) : copie profonde pour que la bascule
    // n'affecte pas la définition partagée du vilain.
    altActions: loc.altActions ? loc.altActions.map((a) => ({ ...a })) : undefined,
  }))
}

// --- Accès au joueur actif -------------------------------------------------

/** Le joueur dont c'est le tour. */
export function activePlayer(state: GameState): PlayerState {
  return state.players[state.activePlayer]
}

/** Renvoie un nouvel état où le joueur actif a été transformé par `fn`. */
export function updateActivePlayer(
  state: GameState,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return updatePlayer(state, state.activePlayer, fn)
}

/** Renvoie un nouvel état où le joueur `index` a été transformé par `fn`. */
export function updatePlayer(
  state: GameState,
  index: number,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === index ? fn(p) : p)),
  }
}

/** Pousse un événement showcase (UI cinématique). Pur. `opts` permet de régler
 *  la durée ou le mode « fixe » (mode test, pour caler les positions). */
export function pushShowcase(
  state: GameState,
  cardId: string,
  message: string,
  playerIndex: number = state.activePlayer,
  destination?: { playerIndex: number; locationId: string },
  cardInstanceId?: string,
  opts?: { durationMs?: number; fixed?: boolean },
): GameState {
  return {
    ...state,
    showcaseEvents: [
      ...state.showcaseEvents,
      { cardId, message, playerIndex, destination, cardInstanceId, ...opts },
    ],
  }
}

/** Ajoute un effet flottant à la file (animation UI). Pur. */
export function pushFloatingFx(state: GameState, fx: FloatingFx): GameState {
  return { ...state, floatingFx: [...(state.floatingFx ?? []), fx] }
}

/** Pousse un effet flottant « Robin chipe N Pouvoir » sur la carte Robin des Bois
 *  du royaume de `playerIndex`. No-op si N≤0 ou si Robin n'y est pas. Pur. */
export function pushRobinSteal(state: GameState, playerIndex: number, amount: number): GameState {
  if (amount <= 0) return state
  const p = state.players[playerIndex]
  let loc: string | undefined
  for (const l of p.locations) {
    if ((p.board[l.id] ?? []).some((c) => c.cardId === 'robin-des-bois')) {
      loc = l.id
      break
    }
  }
  if (!loc) return state
  return pushFloatingFx(state, { kind: 'robin-steal', amount, playerIndex, locationId: loc })
}

/** Annote un événement showcase déjà poussé (par index) avec le pouvoir gagné,
 *  pour l'animation « +N JT ». No-op si l'index est invalide ou le gain ≤ 0. */
export function annotateShowcaseGain(
  state: GameState,
  index: number,
  gainedPower: number,
): GameState {
  if (gainedPower <= 0 || index < 0 || index >= state.showcaseEvents.length) return state
  return {
    ...state,
    showcaseEvents: state.showcaseEvents.map((e, i) => (i === index ? { ...e, gainedPower } : e)),
  }
}

/**
 * Pousse un showcase « défausse » : plusieurs cartes retirées montrées côte à
 * côte avant de disparaître (Prince Philippe défausse Alliés + Forêt de Ronces,
 * défausse volontaire de l'adversaire…). Pur. `playerIndex` = propriétaire des
 * cartes (détermine le côté gauche/droit du showcase).
 */
export function pushDiscardShowcase(
  state: GameState,
  cardIds: string[],
  message: string,
  playerIndex: number,
  variant: 'red' | 'dark',
  anchor: 'center' | 'bottom' = 'center',
  opts?: { durationMs?: number; fixed?: boolean; gainedPower?: number },
): GameState {
  if (cardIds.length === 0) return state
  return {
    ...state,
    showcaseEvents: [
      ...state.showcaseEvents,
      { cardId: cardIds[0], message, playerIndex, discard: { cardIds, variant, anchor }, ...opts },
    ],
  }
}

/**
 * Pousse un showcase « révélation à suspense » (Une Petite Partie ?) : on dévoile
 * `cardIds` une à une, un compteur de coût total (`costs`) s'incrémente, puis le
 * gain (`gainedPower`) s'affiche en badge JT. `sourceCardId` doit être une carte
 * valide (utilisé comme repli par les chemins génériques). Pur.
 */
export function pushRevealShowcase(
  state: GameState,
  sourceCardId: string,
  cardIds: string[],
  costs: number[],
  playerIndex: number,
  gainedPower: number,
  message: string,
  opts?: { durationMs?: number },
): GameState {
  if (cardIds.length === 0) return state
  return {
    ...state,
    showcaseEvents: [
      ...state.showcaseEvents,
      {
        cardId: sourceCardId,
        message,
        playerIndex,
        reveal: { cardIds, costs },
        gainedPower: gainedPower > 0 ? gainedPower : undefined,
        ...opts,
      },
    ],
  }
}

/**
 * Pousse un showcase « scrutation + défausse » (Assommé Bêtement) : on dévoile
 * `cardIds`, celles dont `discarded[i]` est vrai (coût ≥ seuil) virent au gris et
 * partent à la défausse, puis les autres sont remélangées (dos) et reposées sur le
 * dessus de la pioche. `playerIndex` = joueur dont on fouille la pioche. Pur.
 */
export function pushScryDiscardShowcase(
  state: GameState,
  sourceCardId: string,
  cardIds: string[],
  costs: number[],
  discarded: boolean[],
  playerIndex: number,
  message: string,
  opts?: { durationMs?: number },
): GameState {
  if (cardIds.length === 0) return state
  return {
    ...state,
    showcaseEvents: [
      ...state.showcaseEvents,
      {
        cardId: sourceCardId,
        message,
        playerIndex,
        reveal: { cardIds, costs, scry: true, discarded },
        ...opts,
      },
    ],
  }
}

/**
 * Révèle les `count` premières cartes du deck Fatalité d'un joueur (les retire
 * de sa pioche), en remélangeant sa défausse Fatalité si la pioche se vide. Pur.
 */
export function revealFate(
  player: PlayerState,
  count: number,
  rngState: number,
): { revealed: CardInstance[]; player: PlayerState; rngState: number } {
  let deck = player.fateDeck
  let discard = player.fateDiscard
  let s = rngState
  const revealed: CardInstance[] = []
  while (revealed.length < count) {
    if (deck.length === 0) {
      if (discard.length === 0) break // plus aucune carte Fatalité
      const r = shuffle(discard, s)
      deck = r.result
      s = r.state
      discard = []
    }
    const [top, ...rest] = deck
    deck = rest
    revealed.push(top)
  }
  return { revealed, player: { ...player, fateDeck: deck, fateDiscard: discard }, rngState: s }
}

/** Retrouve un lieu d'un joueur par son id. */
export function findLocation(player: PlayerState, id: string): Location | undefined {
  return player.locations.find((loc) => loc.id === id)
}

/** Lieu où se trouve le pion du joueur actif, ou undefined si pas encore placé. */
export function currentLocation(state: GameState): Location | undefined {
  const p = activePlayer(state)
  // Ursula — Colère Titanesque : le temps d'UNE action, le joueur agit comme s'il
  // était sur un lieu voisin (actAtLocation).
  const at = state.actAtLocation ?? p.pawnLocation
  return at ? findLocation(p, at) : undefined
}

// --- Pioche ----------------------------------------------------------------

/**
 * Limite de cartes en main en fin de tour pour ce joueur. HAND_LIMIT (4) par
 * défaut, +1 si le Scarabée d'Or (Jafar) est posé dans son royaume, −1 si la
 * Princesse Jasmine (Fatalité) y est présente. Plancher à 1.
 */
export function handLimitFor(player: PlayerState): number {
  const cards = Object.values(player.board).flat()
  const scarab = cards.some((c) => c.cardId === 'scarabee-or') ? 1 : 0
  const jasmine = cards.some((c) => c.type === 'hero' && c.cardId === 'jasmine') ? 1 : 0
  // Dio — Magician Red (Stand de Mohammed Abdul) : Dio pioche 1 carte de moins en fin de tour.
  const magicianRed = cards.some((c) => c.cardId === 'magician-red') ? 1 : 0
  return Math.max(1, HAND_LIMIT + scarab - jasmine - magicianRed)
}

/**
 * Dio Brando — facteur multiplicateur sur les gains de Pouvoir. The World (en jeu)
 * double TOUS les gains de Pouvoir une fois Jotaro ET Joseph retirés du jeu. Renvoie 2
 * dans ce cas, 1 sinon (et toujours 1 pour les autres vilains).
 */
export function dioPowerFactor(player: PlayerState): number {
  if (player.villain !== 'dio' && player.villain !== 'custom-dio') return 1
  const removed = player.removedFromGame ?? []
  const worldInPlay = Object.values(player.board).flat().some((c) => c.cardId === 'the-world')
  return worldInPlay && removed.includes('jotaro-kujo') && removed.includes('joseph-joestar') ? 2 : 1
}

/**
 * Complète la main d'un joueur jusqu'à `limit` (HAND_LIMIT par défaut), en
 * remélangeant sa défausse dans sa pioche si nécessaire. Pur : renvoie le joueur
 * mis à jour + le nouvel état du PRNG + le nombre de cartes piochées.
 */
export function drawPlayerToLimit(
  player: PlayerState,
  rngState: number,
  limit: number = HAND_LIMIT,
): { player: PlayerState; rngState: number; drawn: number } {
  let deck = player.deck
  let hand = player.hand
  let discard = player.discard
  let s = rngState
  let drawn = 0

  // Les tuiles Omnidroïde (Syndrome) sont « à part » : elles ne comptent pas dans la
  // limite de main (elles s'affichent avec les piles secondaires, hors de la main).
  while (hand.filter((c) => !c.isOmnidroid).length < limit) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      const reshuffled = shuffle(discard, s)
      deck = reshuffled.result
      s = reshuffled.state
      discard = []
    }
    const [top, ...rest] = deck
    deck = rest
    hand = [...hand, top]
    drawn++
  }

  return { player: { ...player, deck, hand, discard }, rngState: s, drawn }
}

/** Complète la main du JOUEUR ACTIF jusqu'à sa limite (fin de tour). */
export function drawToLimit(state: GameState): GameState {
  const p = activePlayer(state)
  const result = drawPlayerToLimit(p, state.rngState, handLimitFor(p))
  if (result.drawn === 0) return state
  const next = updateActivePlayer(state, () => result.player)
  return {
    ...next,
    rngState: result.rngState,
    log: [
      ...next.log,
      `${result.player.villainName} pioche ${result.drawn} carte${result.drawn > 1 ? 's' : ''}.`,
    ],
  }
}

// --- Création de la partie -------------------------------------------------

function makePlayer(
  villain: VillainDef,
  deck: CardInstance[],
  fateDeck: CardInstance[],
  startingPower: number,
): PlayerState {
  return {
    villain: villain.id,
    villainName: villain.name,
    locations: cloneLocations(villain.locations),
    boardImage: villain.boardImage,
    pawnImage: villain.pawnImage,
    pawnHeightPx: villain.pawnHeightPx,
    backVillainImage: villain.backVillainImage,
    backFateImage: villain.backFateImage,
    // Règle de mise en place : le pion démarre sur le lieu le plus à gauche.
    // Le déplacement étant obligatoire vers un lieu différent, ce lieu n'est
    // donc pas jouable au premier tour.
    pawnLocation: villain.locations[0]?.id ?? null,
    power: startingPower,
    objective: villain.objective,
    objectiveDescription: villain.objectiveDescription,
    // Atelier — objectif transformable : on garde la face B en réserve (alt*) pour la
    // bascule via SWITCH_OBJECTIVE. Absent si le vilain n'a pas d'objectif alternatif.
    altObjective: villain.altObjective?.objective,
    altObjectiveDescription: villain.altObjective?.objectiveDescription,
    altBoardImage: villain.altObjective?.boardImage,
    objectiveVersion: villain.altObjective ? 'a' : undefined,
    deck,
    hand: [],
    discard: [],
    board: Object.fromEntries(villain.locations.map((l) => [l.id, []])),
    // Yzma : la pioche Fatalité est répartie en 4 pioches (une par lieu) ; `fateDeck`
    // reste vide. Les autres vilains gardent une seule pioche.
    fateDeck: villain.id === 'yzma' ? [] : fateDeck,
    fateDecks: villain.id === 'yzma' ? splitYzmaFateDecks(villain.locations, fateDeck) : undefined,
    fateDiscard: [],
    lockedLocations: villain.lockedLocationsAtStart
      ? [...villain.lockedLocationsAtStart]
      : undefined,
    auDela: [],
    // Bowser — Étoiles de départ sur l'Observatoire (absent pour les autres).
    observatoryStars: villain.starSetup?.count,
    starLocationId: villain.starSetup?.locationId,
    // L'Imposteur — ses 8 Coéquipiers de départ.
    crewmates: villain.id === 'imposteur' ? initialCrewmates(villain) : undefined,
    // La Méchante Reine — jetons Poison, zone Ingrédients et lieu Maison des Nains.
    poison: villain.id === 'mechante-reine' ? 0 : undefined,
    ingredients: villain.id === 'mechante-reine' ? [] : undefined,
    cottageLocationId: villain.id === 'mechante-reine' ? 'maison-des-nains' : undefined,
    // Scar — pile Succession (vide au départ ; alimentée par les Héros éliminés).
    succession: villain.id === 'scar' ? [] : undefined,
    // Team Rocket — pile de Captures (vide au départ ; affichée dès le début → 0/4).
    capturedPokemon: villain.objective.type === 'CAPTURE_POKEMON' ? [] : undefined,
    // Yzma — objectif (Kronk élimine Kuzco) ; Ratigan — côté « Le Rat » (éliminer
    // Basil) : drapeau initialisé à faux.
    objectiveHeroDefeated:
      villain.id === 'yzma' || villain.id === 'ratigan' ? false : undefined,
    // Ratigan — objectif double : démarre côté « L'Esprit Supérieur ».
    becameTheRat: villain.id === 'ratigan' ? false : undefined,
    // Mère Gothel — compteur de Confiance (objectif). 0 au départ.
    confiance: villain.id === 'gothel' ? 0 : undefined,
    // Cruella d'Enfer — 12 Tuiles Chiots en réserve (face cachée) au départ.
    puppyTiles: villain.startingPuppyTiles
      ? villain.startingPuppyTiles.map((t, k) => ({
          id: `${t.homeLocation}-${t.value}-${k}`,
          value: t.value,
          homeLocation: t.homeLocation,
          location: t.homeLocation,
          state: 'reserve' as const,
          revealed: false,
        }))
      : undefined,
    // Gaston — jetons Obstacle : `startingObstacles` par lieu (2 → 8 au total).
    obstacles:
      villain.startingObstacles !== undefined
        ? Object.fromEntries(villain.locations.map((l) => [l.id, villain.startingObstacles!]))
        : undefined,
    // Le Seigneur des Ténèbres — tuile Chaudron Noir : mise de côté au départ.
    blackCauldron: villain.objective.type === 'CAULDRON_BORN_EVERYWHERE' ? 'set-aside' : undefined,
  }
}

/** Yzma — répartit la pioche Fatalité (déjà mélangée) en 4 pioches, une par lieu,
 *  les plus égales possibles (round-robin). Indexées par id de lieu. */
function splitYzmaFateDecks(
  locations: VillainDef['locations'],
  fateCards: CardInstance[],
): Record<string, CardInstance[]> {
  const ids = locations.map((l) => l.id)
  const decks: Record<string, CardInstance[]> = Object.fromEntries(ids.map((id) => [id, []]))
  fateCards.forEach((c, i) => decks[ids[i % ids.length]].push(c))
  return decks
}

/** Couleurs des 8 Coéquipiers de L'Imposteur, dans l'ordre de placement
 *  (lieu par lieu, gauche → droite sur la rangée du haut). */
const CREW_COLORS = ['blanc', 'bleu', 'noir', 'orange', 'rose', 'vert', 'vert-clair', 'violet']

/** Place les 8 Coéquipiers, un par case de la rangée du HAUT (2 par lieu sur les
 *  4 lieux), tous « normaux » au départ. */
function initialCrewmates(villain: VillainDef): Crewmate[] {
  return villain.locations.slice(0, 4).flatMap((loc, li) =>
    [0, 1].map(
      (slot): Crewmate => ({
        color: CREW_COLORS[li * 2 + slot],
        locationId: loc.id,
        row: 'top',
        slot,
        suspect: false,
      }),
    ),
  )
}

/**
 * Bowser — synchronise le verrou dynamique de l'Observatoire avec son compteur
 * d'Étoiles : le lieu `starLocationId` est VERROUILLÉ tant qu'il a 0 Étoile,
 * déverrouillé dès qu'il en a au moins une (règle « tant qu'il y a une Étoile à
 * l'Observatoire, ce lieu n'est pas bloqué »). Réutilise lockedLocations, donc
 * tout le moteur (déplacement, pose, adjacence, Fatalité) en hérite. No-op pour
 * un joueur sans Étoiles. Renvoie un nouveau PlayerState (immuable).
 */
export function syncObservatoryLock(player: PlayerState): PlayerState {
  const loc = player.starLocationId
  if (loc === undefined || player.observatoryStars === undefined) return player
  const locked = new Set(player.lockedLocations ?? [])
  const shouldLock = player.observatoryStars <= 0
  if (shouldLock === locked.has(loc)) return player // déjà synchronisé
  if (shouldLock) locked.add(loc)
  else locked.delete(loc)
  const next = [...locked]
  return { ...player, lockedLocations: next.length > 0 ? next : undefined }
}

/**
 * Ratigan — bascule sa tuile Objectif côté « Le Rat » dès que la Reine Robot se
 * retrouve dans sa défausse (défaussée par Basil ou autre) : son objectif devient
 * alors « éliminer Basil ». Idempotent (ne rebascule pas) et no-op pour les autres
 * vilains ou tant que la Reine Robot n'est pas défaussée. Renvoie un nouveau
 * PlayerState (immuable).
 */
export function syncRatiganObjective(player: PlayerState): PlayerState {
  if (player.villain !== 'ratigan' || player.becameTheRat) return player
  const onBoard = Object.values(player.board).flat().some((c) => c.cardId === 'reine-robot')
  // La Reine Robot a-t-elle déjà été POSÉE ? (mémorisé tant qu'elle est en jeu).
  const wasInPlay = player.reineRobotWasInPlay || onBoard
  const inDiscard = player.discard.some((c) => c.cardId === 'reine-robot')
  // Bascule UNIQUEMENT si une Reine Robot POSÉE est défaussée (elle quitte le plateau
  // pour la défausse). La défausser depuis la MAIN (jamais posée) ne bascule PAS.
  if (inDiscard && wasInPlay && !onBoard) {
    return {
      ...player,
      becameTheRat: true,
      reineRobotWasInPlay: true,
      objectiveDescription:
        'La Reine Robot a été défaussée : vous êtes devenu « Le Rat ». Vous devez ' +
        'éliminer Basil. La Reine Moustoria à Buckingham Palace empêche la victoire. ' +
        'Vous ne pouvez gagner qu’au début de votre tour.',
    }
  }
  // Sinon, on mémorise simplement qu'elle est (a été) en jeu, pour une défausse future.
  if (wasInPlay && !player.reineRobotWasInPlay) {
    return { ...player, reineRobotWasInPlay: true }
  }
  return player
}

/**
 * Applique syncRatiganObjective à TOUS les joueurs : dès que la Reine Robot d'un
 * Ratigan se retrouve en défausse (Basil, mode test…), sa tuile bascule côté « Le
 * Rat » IMMÉDIATEMENT (sans attendre le début de son tour) — conforme à la carte
 * « Si cette carte est défaussée, retournez votre tuile Objectif ». Journalise la
 * bascule. No-op si rien ne change. Appelé après chaque action (applyAction).
 */
export function syncRatiganObjectiveAll(state: GameState): GameState {
  let next = state
  for (let i = 0; i < next.players.length; i++) {
    const synced = syncRatiganObjective(next.players[i])
    if (synced !== next.players[i]) {
      next = {
        ...next,
        players: next.players.map((p, j) => (j === i ? synced : p)),
        log: [...next.log, `${synced.villainName} devient **Le Rat** : il doit désormais éliminer Basil.`],
      }
    }
  }
  return next
}

/**
 * Construit l'état initial d'une partie. Le deck de chaque joueur est mélangé
 * avec le PRNG partagé (graine `seed`), puis chacun pioche une main de 4 cartes.
 */
export function createInitialGame(setups: PlayerSetup[], seed: number): GameState {
  let rngState = seed >>> 0
  const players: PlayerState[] = []
  const setupLog: string[] = []

  for (let i = 0; i < setups.length; i++) {
    const { villain, deckCards, fateCards } = setups[i]
    const shuffled = shuffle(deckCards, rngState)
    rngState = shuffled.state
    // Le deck Fatalité est aussi mélangé (après le deck Vilain, pour ne pas
    // perturber l'ordre de pioche existant).
    const shuffledFate = shuffle(fateCards, rngState)
    rngState = shuffledFate.state
    // Règle officielle : chaque joueur démarre avec un nombre de JT = position
    // dans l'ordre de tour (1ᵉʳ : 0, 2ᵉ : 1, 3ᵉ : 2…) pour compenser l'avantage
    // de jouer en premier.
    let player = makePlayer(villain, shuffled.result, shuffledFate.result, i)
    // Mère Gothel — pose le Héros-tuile (Raiponce) sur son lieu de départ (la Tour).
    if (villain.startingHeroTile) {
      const t = villain.startingHeroTile
      const tile: CardInstance = {
        instanceId: `p${i}:tile:${t.cardId}`,
        cardId: t.cardId,
        name: t.name,
        type: 'hero',
        strength: t.strength,
      }
      player = {
        ...player,
        board: { ...player.board, [t.locationId]: [...(player.board[t.locationId] ?? []), tile] },
      }
    }
    // Pat Hibulaire — mise en place spéciale : on tire 4 de ses 5 tuiles Objectif
    // (mélange puis on en garde une par lieu, la 5ᵉ reste hors-jeu) et on les pose
    // face cachée, une par lieu.
    if (villain.goalKinds && villain.goalKinds.length > 0) {
      const r = shuffle(villain.goalKinds, rngState)
      rngState = r.state
      const chosen = r.result.slice(0, villain.locations.length)
      player = {
        ...player,
        goals: villain.locations.map((loc, k) => ({
          kind: chosen[k],
          locationId: loc.id,
          completed: false,
          revealed: false,
        })),
        powerSpentThisTurn: 0,
      }
    }
    // Cruella d'Enfer — mélange la réserve de Tuiles Chiots (Repéré ! / les choix de
    // tuile face cachée tirent ainsi un ordre imprévisible).
    if (player.puppyTiles) {
      const r = shuffle(player.puppyTiles, rngState)
      rngState = r.state
      player = { ...player, puppyTiles: r.result }
    }
    // Le Seigneur des clés — génère 12 clés (3/lieu) : une de chaque couleur (≥1 garanti)
    // + le reste tiré au hasard (max 4/couleur), mélangées puis réparties par lieu.
    if (villain.startingKeysPerLocation) {
      const per = villain.startingKeysPerLocation
      const total = villain.locations.length * per
      const counts: Record<KeyColor, number> = { bleu: 0, rouge: 0, vert: 0, jaune: 0, violet: 0, orange: 0 }
      const bag: KeyColor[] = []
      for (const c of KEY_COLORS) { bag.push(c); counts[c]++ } // ≥1 de chaque couleur
      while (bag.length < total) {
        const avail = KEY_COLORS.filter((c) => counts[c] < 4)
        const r = nextRandom(rngState); rngState = r.state
        const c = avail[Math.floor(r.value * avail.length)] ?? avail[0]
        bag.push(c); counts[c]++
      }
      const sh = shuffle(bag, rngState); rngState = sh.state
      const locs = villain.locations.map((l) => l.id)
      player = {
        ...player,
        keys: sh.result.map((color, i) => ({ id: `key-${i}`, color, location: locs[Math.floor(i / per)] })),
      }
    }
    // Davy Jones — RÉSERVE des 5 jetons Trésor, mélangée et FACE CACHÉE au départ.
    if (villain.objective.type === 'CLAIM_ALL_TREASURES') {
      const sh = shuffle([...TREASURE_IDS], rngState); rngState = sh.state
      player = { ...player, treasureReserve: sh.result, claimedTreasures: [] }
    }
    // Oogie Boogie — Prisonnier (Perce-Oreilles / Sandy Claws) posé à l'Antre : on le
    // sort du deck Fatalité et on le place sur son lieu. Il ancre la pile d'Imposteurs.
    if (villain.prisonerSetup) {
      const { cardId, locationId } = villain.prisonerSetup
      const found = player.fateDeck.find((c) => c.cardId === cardId)
      const prisoner = found ? { ...found, isPrisoner: true } : undefined
      if (prisoner) {
        player = {
          ...player,
          fateDeck: player.fateDeck.filter((c) => c.instanceId !== prisoner.instanceId),
          board: { ...player.board, [locationId]: [...(player.board[locationId] ?? []), prisoner] },
          impostorsPlaced: 0,
          impostorPile: [],
        }
      }
    }
    // Madame Mim — sépare la pioche Fatalité : TRADITIONNELLE (8, ce que jouent les
    // adversaires) vs Métamorphoses de Merlin (merlinDeck, 7). Pose 1 Merlin au hasard
    // au Lieu du Duel (3ᵉ lieu) ; les suivants y seront posés à chaque défaite.
    if (villain.objective.type === 'DEFEAT_ALL_MERLIN') {
      const traditional = player.fateDeck.filter((c) => !c.isMerlinTransformation)
      const sh = shuffle(player.fateDeck.filter((c) => c.isMerlinTransformation), rngState)
      rngState = sh.state
      const merlinDeck = [...sh.result]
      const duelLoc = villain.locations[2]?.id ?? villain.locations[0].id
      const first = merlinDeck.shift()
      player = {
        ...player,
        fateDeck: traditional,
        merlinDeck,
        merlinDiscard: [],
        board: first
          ? { ...player.board, [duelLoc]: [...(player.board[duelLoc] ?? []), first] }
          : player.board,
      }
    }
    // Tamatoa — sépare la pioche Fatalité : TRADITIONNELLE (15) vs cartes MAUI (mauiDeck,
    // 10). La pioche Maui est mélangée ; ses cartes sont jouées tant que Maui (Héros) est
    // en jeu (et via « Pas exactement l'heure de Maui »).
    if (villain.id === 'tamatoa') {
      const traditional = player.fateDeck.filter((c) => !c.isMauiCard)
      const sh = shuffle(player.fateDeck.filter((c) => c.isMauiCard), rngState)
      rngState = sh.state
      player = { ...player, fateDeck: traditional, mauiDeck: [...sh.result], mauiDiscard: [] }
    }
    // Dio Brando — sépare les Stands (isStand) des DEUX pioches vers `standPile` (hors deck).
    // Ils n'entrent en jeu que par fetch quand leur carte invocatrice est jouée. The World
    // (Stand SANS isStand) est posé EN JEU dès le début, sur le lieu de départ du pion (il
    // suit le pion et ne peut être défaussé). removedFromGame suit Jotaro/Joseph.
    if (villain.id === 'dio' || villain.id === 'custom-dio') {
      const stands = [...player.deck, ...player.fateDeck].filter((c) => c.isStand)
      let deck = player.deck.filter((c) => !c.isStand)
      let fateDeck = player.fateDeck.filter((c) => !c.isStand)
      let board = player.board
      const world = [...deck, ...fateDeck].find((c) => c.cardId === 'the-world')
      if (world) {
        deck = deck.filter((c) => c.instanceId !== world.instanceId)
        fateDeck = fateDeck.filter((c) => c.instanceId !== world.instanceId)
        const startLoc = villain.locations[0].id
        board = { ...board, [startLoc]: [...(board[startLoc] ?? []), world] }
      }
      player = { ...player, deck, fateDeck, standPile: stands, board, removedFromGame: [] }
    }
    // Syndrome — pose l'Omnidroïde v.X8 sur son lieu de départ ; v.X9 puis v.10 forment
    // la pile (jouées plus tard en défaussant des Modifications Majeures).
    if (villain.omnidroidSetup) {
      const setup = villain.omnidroidSetup
      const make = (s: (typeof setup.stages)[number]): CardInstance => ({
        instanceId: `p${i}:omnidroid:${s.cardId}`,
        cardId: s.cardId,
        name: s.name,
        type: 'ally',
        strength: s.strength,
        isOmnidroid: true,
        // Un Omnidroïde compte comme un OBJET pour les conditions adverses (tout en
        // restant un Allié pour les actions « Éliminer un Héros ») et est immunisé aux
        // effets visant Alliés/Objets.
        alsoItem: true,
        immuneToAllyItemEffects: true,
        omnidroidStage: s.stage,
        omnidroidUpgradeCost: s.upgradeCost,
        omnidroidForceLocation: s.forceLocation,
      })
      const [first, ...rest] = setup.stages
      const start = setup.startLocation
      player = {
        ...player,
        omnidroidStage: first.stage as PlayerState['omnidroidStage'],
        omnidroidPile: rest.map(make),
        board: { ...player.board, [start]: [...(player.board[start] ?? []), make(first)] },
      }
    }
    // Lotso — pose la tuile GARDIEN « Buzz l'Éclair » (deux faces) sur son lieu de départ
    // (Salle des Chenilles), face Gardien.
    if (villain.guardianSetup) {
      const g = villain.guardianSetup
      const buzz: CardInstance = {
        instanceId: `p${i}:guardian:${g.cardId}`,
        cardId: g.cardId,
        name: g.name,
        type: 'ally',
        strength: g.strength,
        isBuzz: true,
        buzzMode: 'guardian',
      }
      player = {
        ...player,
        board: { ...player.board, [g.locationId]: [...(player.board[g.locationId] ?? []), buzz] },
      }
    }
    // Sa Sucrerie (King Candy) — circuit en huit : le pion démarre à la case
    // Départ/Arrivée (index 0), pas de course en cours.
    if (villain.id === 'sa-sucrerie') {
      player = { ...player, trackPos: 0, racerPos: null, raceActive: false }
    }
    const drawn = drawPlayerToLimit(player, rngState)
    rngState = drawn.rngState
    players.push(drawn.player)
    setupLog.push(
      `${villain.name} entre en jeu${i > 0 ? ` (${i} JT de départ)` : ''}.`,
    )
  }

  return {
    players,
    activePlayer: 0,
    turn: 1,
    phase: 'MOVE',
    usedActionIds: [],
    status: 'PLAYING',
    winner: null,
    rngState,
    pendingFate: null,
    persifleurAvailable: false,
    lastVanquishedHeroStrength: undefined,
    showcaseEvents: [],
    floatingFx: [],
    log: ['Début de partie.', ...setupLog],
  }
}
