// =============================================================================
// spirits.ts — Sumbra / Kilaire (Atelier — « La Lueur du Monde »)
//
// Helpers PURS du système d'ESPRITS, communs aux deux skins (Sumbra 🌑 / Kilaire ☀️).
// Le moteur reste 100 % data-driven : ces fonctions lisent des DONNÉES (objectif
// `SPIRIT_THRESHOLD` avec son `camp`, valeurs `spiritSun`/`spiritMoon` et `combattantVerb`
// des Combattants, `defense` des lieux, Objets `locksLocationControl`) — jamais branché
// par id de vilain.
//
// Vocabulaire :
//  - CAMP : le vilain courant est ☀️ Kilaire (`sun`) ou 🌑 Sumbra (`moon`). Chaque
//    Combattant porte DEUX valeurs d'esprit ; MA valeur = celle de mon camp.
//  - CAPTURE : à la pioche d'un Combattant, on gagne MA valeur d'esprit sur la jauge.
//  - ALIGNEMENT : ma valeur vs la valeur adverse → aligné (Bonus) / désaligné (Malus) /
//    égalité (rien). Décidé À LA PIOCHE.
//  - CONTRÔLE d'un lieu conquérable : garnison (Force des Alliés) ≥ `defense`, ou Objet
//    verrou posé. Pilote le REVENU de Combattants (0/1/2 selon les lieux conquis) et la
//    bascule de face (`version`).
// =============================================================================

import type { CardInstance, GameState, LocationId, PlayerState } from './types'
import { effectiveStrength } from './rules'
import { shuffle } from './rng'

/** Le vilain courant utilise-t-il le système d'esprits ? (objectif SPIRIT_THRESHOLD) */
export function usesSpirits(p: PlayerState): boolean {
  return p.objective.type === 'SPIRIT_THRESHOLD'
}

/** Camp d'esprit du vilain courant : `'sun'` (☀️ Kilaire) ou `'moon'` (🌑 Sumbra).
 *  Par défaut `'moon'` (base Sumbra) hors objectif SPIRIT_THRESHOLD. */
export function spiritCamp(p: PlayerState): 'sun' | 'moon' {
  return p.objective.type === 'SPIRIT_THRESHOLD' ? p.objective.camp : 'moon'
}

/** Valeur d'esprit de MON camp portée par un Combattant (0 si absente). */
export function myCampValue(p: PlayerState, c: CardInstance): number {
  return (spiritCamp(p) === 'sun' ? c.spiritSun : c.spiritMoon) ?? 0
}

/** Valeur d'esprit du camp ADVERSE portée par un Combattant (0 si absente). */
export function otherCampValue(p: PlayerState, c: CardInstance): number {
  return (spiritCamp(p) === 'sun' ? c.spiritMoon : c.spiritSun) ?? 0
}

/** Somme des deux camps (☀️ + 🌑) d'un Combattant. */
export function bothCampsValue(c: CardInstance): number {
  return (c.spiritSun ?? 0) + (c.spiritMoon ?? 0)
}

/** Alignement d'un Combattant vis-à-vis de MON camp : `1` aligné (→ Bonus),
 *  `-1` désaligné (→ Malus), `0` égalité (aucun effet de verbe). */
export function alignment(p: PlayerState, c: CardInstance): -1 | 0 | 1 {
  const d = myCampValue(p, c) - otherCampValue(p, c)
  return d > 0 ? 1 : d < 0 ? -1 : 0
}

/** Pioche 1 Combattant du paquet du joueur (remélange la défausse si le paquet est vide,
 *  via le PRNG partagé). Met à jour `lastCombattantDrawn`. Renvoie le nouvel état + la carte
 *  tirée (ou `undefined` si aucun Combattant disponible). La carte tirée N'est PAS remise en
 *  défausse ici : l'appelant la résout (revenu → défausse ; Fatalité → posée en Héros). Pur. */
export function drawCombattant(
  state: GameState,
  playerIndex: number,
): { state: GameState; card?: CardInstance } {
  const p = state.players[playerIndex]
  let deck = p.combattantDeck ?? []
  let discard = p.combattantDiscard ?? []
  let rng = state.rngState
  if (deck.length === 0) {
    if (discard.length === 0) return { state }
    const sh = shuffle(discard, rng)
    rng = sh.state
    deck = sh.result
    discard = []
  }
  const [card, ...rest] = deck
  const next: GameState = {
    ...state,
    rngState: rng,
    lastCombattantDrawn: { sun: card.spiritSun ?? 0, moon: card.spiritMoon ?? 0 },
    players: state.players.map((pl, i) =>
      i === playerIndex ? { ...pl, combattantDeck: rest, combattantDiscard: discard } : pl,
    ),
  }
  return { state: next, card }
}

/** Nombre d'Objets Fatalité « Formation » (reducesSpiritCapture) en jeu chez un joueur :
 *  chaque capture rapporte 1 de moins par exemplaire. */
function spiritCaptureLeak(p: PlayerState): number {
  return Object.values(p.board)
    .flat()
    .filter((c) => c.reducesSpiritCapture).length
}

/** CAPTURE `amount` esprits (≥ 0), diminuée de la FUITE éventuelle (« Formation ») : chaque
 *  Formation en jeu retire 1 au gain de CETTE capture (plancher 0 sur le gain, pas de perte
 *  du stock existant). Pur. */
export function captureSpirits(state: GameState, playerIndex: number, amount: number): GameState {
  if (amount <= 0) return state
  const net = Math.max(0, amount - spiritCaptureLeak(state.players[playerIndex]))
  return addSpirits(state, playerIndex, net)
}

/** Ajoute (ou retire, N < 0) des esprits à la jauge d'un joueur, plancher 0. Pur. */
export function addSpirits(state: GameState, playerIndex: number, n: number): GameState {
  if (n === 0) return state
  return {
    ...state,
    players: state.players.map((pl, i) =>
      i === playerIndex ? { ...pl, spirits: Math.max(0, (pl.spirits ?? 0) + n) } : pl,
    ),
  }
}

/** Modifie le Pouvoir d'un joueur (plancher 0). Pur. */
function changePower(state: GameState, idx: number, d: number): GameState {
  if (d === 0) return state
  return {
    ...state,
    players: state.players.map((pl, i) =>
      i === idx ? { ...pl, power: Math.max(0, pl.power + d) } : pl,
    ),
  }
}

/** Défausse les N cartes les moins chères de la main d'un joueur (auto : Renfort Malus,
 *  income passif → on sacrifie le moins utile). Pur. */
function discardCheapestN(state: GameState, idx: number, n: number): GameState {
  const p = state.players[idx]
  if (n <= 0 || p.hand.length === 0) return state
  const order = [...p.hand].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
  const toDiscard = new Set(order.slice(0, n).map((c) => c.instanceId))
  const removed = p.hand.filter((c) => toDiscard.has(c.instanceId))
  return {
    ...state,
    players: state.players.map((pl, i) =>
      i === idx
        ? { ...pl, hand: pl.hand.filter((c) => !toDiscard.has(c.instanceId)), discard: [...pl.discard, ...removed] }
        : pl,
    ),
    log: [...state.log, `${p.villainName} défausse ${removed.length} carte(s) (Renfort désaligné).`],
  }
}

/** Pioche N cartes Vilain vers la main (remélange la défausse si le paquet est vide). Pur. */
function drawVillainCards(state: GameState, idx: number, n: number): GameState {
  let s = state
  for (let k = 0; k < n; k++) {
    const p = s.players[idx]
    let deck = p.deck
    let discard = p.discard
    let rng = s.rngState
    if (deck.length === 0) {
      if (discard.length === 0) break
      const sh = shuffle(discard, rng)
      rng = sh.state
      deck = sh.result
      discard = []
    }
    const [card, ...rest] = deck
    s = {
      ...s,
      rngState: rng,
      players: s.players.map((pl, i) =>
        i === idx ? { ...pl, deck: rest, discard, hand: [...pl.hand, card] } : pl,
      ),
    }
  }
  return s
}

/** 🃏 Renfort Bonus (auto) : récupère la meilleure carte de la défausse (coût ≥ 3) si
 *  elle existe, sinon pioche N cartes Vilain. Pur. */
function renfortBonus(state: GameState, idx: number, n: number): GameState {
  const p = state.players[idx]
  const best = [...p.discard].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]
  if (best && (best.cost ?? 0) >= 3) {
    return {
      ...state,
      players: state.players.map((pl, i) =>
        i === idx
          ? { ...pl, discard: pl.discard.filter((c) => c.instanceId !== best.instanceId), hand: [...pl.hand, best] }
          : pl,
      ),
      log: [...state.log, `${p.villainName} récupère **${best.name}** de sa défausse (Renfort).`],
    }
  }
  return drawVillainCards(state, idx, n)
}

/** 🛡️ Rempart : applique un bonus/malus temporaire de Force à un lieu (ce tour). Auto-cible :
 *  Bonus → le lieu conquérable le plus proche de sa Défense (pour percer/tenir) ; Malus →
 *  un lieu-home (perte de Force sans conséquence, car home toujours contrôlé). Pur. */
function applyRempart(state: GameState, idx: number, delta: number): GameState {
  const p = state.players[idx]
  let target: LocationId | undefined
  if (delta >= 0) {
    // Lieu conquérable non contrôlé, garnison la plus proche de la Défense.
    let bestGap = Infinity
    for (const l of p.locations) {
      if (l.defense === undefined) continue
      const g = garrisonForce(state, idx, l.id)
      if (g >= l.defense) continue
      const gap = l.defense - g
      if (gap < bestGap) { bestGap = gap; target = l.id }
    }
    // Sinon un lieu conquérable déjà tenu (protéger contre la reprise).
    if (!target) target = p.locations.find((l) => l.defense !== undefined)?.id
  } else {
    target = p.locations.find((l) => l.defense === undefined)?.id
  }
  if (!target) target = p.pawnLocation ?? p.locations[0]?.id
  if (!target) return state
  const cur = p.locationTempForce ?? {}
  return {
    ...state,
    players: state.players.map((pl, i) =>
      i === idx
        ? { ...pl, locationTempForce: { ...cur, [target!]: (cur[target!] ?? 0) + delta } }
        : pl,
    ),
  }
}

/** CAPTURE d'un Combattant pioché : ajoute la valeur d'esprit de MON camp à la jauge.
 *  Si `combattantZeroCaptureNext` est armé (🔁 Surtension Malus précédent), la capture est
 *  ANNULÉE (et le drapeau consommé). Pur. */
export function captureCombattant(state: GameState, idx: number, card: CardInstance): GameState {
  const p = state.players[idx]
  if (p.combattantZeroCaptureNext) {
    return {
      ...state,
      players: state.players.map((pl, i) =>
        i === idx ? { ...pl, combattantZeroCaptureNext: undefined } : pl,
      ),
      log: [...state.log, `${p.villainName} — **${card.name}** : capture annulée (Surtension).`],
    }
  }
  const gain = myCampValue(p, card)
  if (gain === 0) return state
  return captureSpirits(state, idx, gain)
}

/** Applique l'effet de VERBE d'un Combattant selon le signe d'alignement (`1` Bonus,
 *  `-1` Malus, `0` rien). Générique (data-driven par `combattantVerb`/`combattantMagnitude`).
 *  Auto-résout les sous-choix (Renfort/Rempart) : ce sont des effets de REVENU passager,
 *  pas des cartes jouées. Pur. */
export function applyCombattantVerb(
  state: GameState,
  idx: number,
  card: CardInstance,
  sign: -1 | 0 | 1,
): GameState {
  const verb = card.combattantVerb
  if (!verb || sign === 0) return state
  const bonus = sign > 0
  const N = card.combattantMagnitude ?? 0
  const p = state.players[idx]
  switch (verb) {
    case 'decharge':
      return changePower(state, idx, bonus ? N : -N)
    case 'ferveur':
      return addSpirits(state, idx, bonus ? N : -N)
    case 'aubaine':
      return {
        ...state,
        players: state.players.map((pl, i) =>
          i === idx ? { ...pl, spiritCostMod: (pl.spiritCostMod ?? 0) + (bonus ? N : -N) } : pl,
        ),
      }
    case 'surtension':
      if (bonus) {
        // Pioche +1 Combattant ce tour (magnitude fixe +1) : le compteur relance la boucle de revenu.
        return {
          ...state,
          players: state.players.map((pl, i) =>
            i === idx ? { ...pl, extraCombattantDrawsThisTurn: (pl.extraCombattantDrawsThisTurn ?? 0) + 1 } : pl,
          ),
        }
      }
      // Malus : le prochain Combattant ne capture aucun esprit de camp.
      return {
        ...state,
        players: state.players.map((pl, i) =>
          i === idx ? { ...pl, combattantZeroCaptureNext: true } : pl,
        ),
      }
    case 'rempart':
      return applyRempart(state, idx, bonus ? N : -N)
    case 'renfort':
      return bonus ? renfortBonus(state, idx, N) : discardCheapestN(state, idx, N)
  }
  void p
  return state
}

/** Résout UN Combattant pioché comme REVENU (capture + effet de verbe aligné/désaligné),
 *  puis le met en défausse Combattant. Journalise l'alignement. Pur. */
export function resolveRevenueCombattant(
  state: GameState,
  idx: number,
  card: CardInstance,
): GameState {
  const p0 = state.players[idx]
  const sign = alignment(p0, card)
  let s = captureCombattant(state, idx, card)
  s = applyCombattantVerb(s, idx, card, sign)
  // Le Combattant pioché part en défausse Combattant (défaussé « en fin de tour »).
  s = {
    ...s,
    players: s.players.map((pl, i) =>
      i === idx ? { ...pl, combattantDiscard: [...(pl.combattantDiscard ?? []), card] } : pl,
    ),
  }
  const tag = sign > 0 ? 'aligné ✓ Bonus' : sign < 0 ? 'désaligné ✗ Malus' : 'égalité'
  return { ...s, log: [...s.log, `${p0.villainName} révèle **${card.name}** (${tag}).`] }
}

/** REVENU de début de tour : pioche et résout `combattantRevenue` Combattants (la boucle
 *  relit le total à chaque tour de boucle → 🔁 Surtension Bonus ajoute une pioche). Borné à
 *  20 pioches par sécurité. Pur. No-op si le revenu est 0 (2 lieux → il faut s'étendre). */
export function resolveCombattantRevenue(state: GameState, idx: number): GameState {
  if (!usesSpirits(state.players[idx])) return state
  let s = state
  let drawn = 0
  const MAX = 20
  while (drawn < combattantRevenue(s, idx) && drawn < MAX) {
    const res = drawCombattant(s, idx)
    if (!res.card) break
    s = resolveRevenueCombattant(res.state, idx, res.card)
    drawn++
  }
  if (drawn > 0) {
    s = { ...s, log: [...s.log, `${state.players[idx].villainName} a pioché ${drawn} Combattant(s) (revenu).`] }
  }
  return s
}

// --- Contrôle de lieu -------------------------------------------------------

/** Un Objet « verrou » (locksLocationControl) est-il posé (non associé) sur ce lieu ? */
function hasControlLock(p: PlayerState, loc: LocationId): boolean {
  return (p.board[loc] ?? []).some((c) => c.locksLocationControl && !c.attachedTo)
}

/** Force de GARNISON d'un lieu = somme des Forces effectives des Alliés présents (non
 *  associés) + bonus temporaire (🛡️ Rempart). Objets et Héros ne comptent pas. */
export function garrisonForce(state: GameState, playerIndex: number, loc: LocationId): number {
  const p = state.players[playerIndex]
  let sum = 0
  for (const c of p.board[loc] ?? []) {
    if (c.type !== 'ally' || c.attachedTo) continue
    sum += effectiveStrength(state, playerIndex, c.instanceId) ?? 0
  }
  return sum + (p.locationTempForce?.[loc] ?? 0)
}

/** Un lieu est-il CONTRÔLÉ ? Lieu-home (sans `defense`) → toujours ; verrou posé →
 *  toujours ; sinon garnison ≥ `defense`. */
export function isLocationControlled(
  state: GameState,
  playerIndex: number,
  loc: LocationId,
): boolean {
  const p = state.players[playerIndex]
  const def = p.locations.find((l) => l.id === loc)
  if (!def) return false
  if (def.defense === undefined) return true // lieu-home
  if (hasControlLock(p, loc)) return true
  return garrisonForce(state, playerIndex, loc) >= def.defense
}

/** Nombre de lieux HOME (sans `defense`) : la base de contrôle non conquise (2 pour Sumbra). */
export function homeLocationCount(p: PlayerState): number {
  return p.locations.filter((l) => l.defense === undefined).length
}

/** Nombre total de lieux contrôlés (home + conquis). */
export function controlledLocationCount(state: GameState, playerIndex: number): number {
  return state.players[playerIndex].locations.filter((l) =>
    isLocationControlled(state, playerIndex, l.id),
  ).length
}

/** Nombre de lieux CONQUIS (contrôlés au-delà des lieux-home). 0/1/2 pour Sumbra. */
export function conqueredLocationCount(state: GameState, playerIndex: number): number {
  return Math.max(
    0,
    controlledLocationCount(state, playerIndex) - homeLocationCount(state.players[playerIndex]),
  )
}

/** Revenu de Combattants à piocher ce tour = lieux conquis (0/1/2) + bonus permanents
 *  (Objets « Emplacement d'un Combattant ») + bonus de ce tour (🔁 Surtension, « Combattant
 *  volé »…). */
export function combattantRevenue(state: GameState, playerIndex: number): number {
  const p = state.players[playerIndex]
  // Bonus PERMANENT : dérivé des Objets « Emplacement d'un Combattant » posés (data-driven).
  const permanent = Object.values(p.board)
    .flat()
    .reduce((n, c) => n + (c.combattantRevenueBonus ?? 0), 0)
  return (
    conqueredLocationCount(state, playerIndex) +
    permanent +
    (p.extraCombattantDrawsThisTurn ?? 0)
  )
}

/** Estimation de la garnison d'un lieu à partir du SEUL PlayerState (sans GameState) :
 *  Force imprimée + jetons + deltas + bonus des Objets associés + Rempart. Approximation
 *  suffisante pour la jauge IA et l'affichage (n'applique pas les auras conditionnelles). */
function garrisonForceFromPlayer(p: PlayerState, loc: LocationId): number {
  const cards = p.board[loc] ?? []
  let sum = 0
  for (const c of cards) {
    if (c.type !== 'ally' || c.attachedTo) continue
    let f = (c.strength ?? 0) + (c.forceTokens ?? 0) + (c.tempStrengthBonus ?? 0) + (c.permanentStrengthDelta ?? 0)
    for (const it of cards) if (it.attachedTo === c.instanceId) f += it.attachStrengthBonus ?? 0
    sum += Math.max(0, f)
  }
  return sum + (p.locationTempForce?.[loc] ?? 0)
}

/** Nombre de lieux CONQUIS estimé depuis le seul PlayerState (0/1/2). */
export function conqueredCountFromPlayer(p: PlayerState): number {
  let n = 0
  for (const l of p.locations) {
    if (l.defense === undefined) continue // lieu-home
    const locked = (p.board[l.id] ?? []).some((c) => c.locksLocationControl && !c.attachedTo)
    if (locked || garrisonForceFromPlayer(p, l.id) >= l.defense) n++
  }
  return n
}

/** Synchronise la FACE visuelle (`version`) des lieux conquérables avec l'état de
 *  contrôle et journalise conquêtes / pertes. Face A (main) = non contrôlé (rival),
 *  face B (alt) = contrôlé. Idempotent. Pur. No-op hors Sumbra/Kilaire. À appeler après
 *  toute action modifiant la garnison. */
export function syncLocationControl(state: GameState, playerIndex: number): GameState {
  const p = state.players[playerIndex]
  if (!usesSpirits(p)) return state
  const logs: string[] = []
  let changed = false
  const locations = p.locations.map((loc) => {
    // Seuls les lieux conquérables ET transformables basculent visuellement.
    if (loc.defense === undefined || loc.altName === undefined) return loc
    const controlled = isLocationControlled(state, playerIndex, loc.id)
    const target: 'a' | 'b' = controlled ? 'b' : 'a'
    if ((loc.version ?? 'a') === target) return loc
    changed = true
    logs.push(
      controlled
        ? `${p.villainName} prend le contrôle de **${loc.altName}** !`
        : `${p.villainName} perd le contrôle de **${loc.name}** (repasse rival).`,
    )
    return {
      ...loc,
      name: loc.altName ?? loc.name,
      actions: loc.altActions ?? loc.actions,
      altName: loc.name,
      altActions: loc.actions,
      version: target,
    }
  })
  if (!changed) return state
  return {
    ...state,
    players: state.players.map((pl, i) => (i === playerIndex ? { ...pl, locations } : pl)),
    log: [...state.log, ...logs],
  }
}

/** Applique {@link syncLocationControl} à TOUS les joueurs (après chaque action). */
export function syncLocationControlAll(state: GameState): GameState {
  let next = state
  for (let i = 0; i < next.players.length; i++) {
    next = syncLocationControl(next, i)
  }
  return next
}
