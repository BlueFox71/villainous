// =============================================================================
// heuristicBot — IA « recherche de tour » (V3).
//
// Même contrat que randomBot : reçoit un GameState, renvoie une GameAction
// légale ; ne mute jamais l'état. Stratégie : énumérer les coups (enumerate),
// SIMULER chacun via applyAction (pur), puis chercher la meilleure LIGNE de jeu
// sur le RESTE DU TOUR du bot (jusqu'à END_TURN / passage de main) et garder le
// premier coup de cette ligne. Recherche bornée : beam (on n'approfondit que les
// meilleurs enfants par éval immédiate) + budget de nœuds (nombre d'applyAction).
//
// Pourquoi un tour complet et pas l'action adverse ? L'adversaire peut être
// humain ; on optimise donc l'état atteint en FIN de tour du bot. Cela corrige
// le défaut majeur du greedy-par-pas : le choix du LIEU et l'enchaînement des
// actions (poser un Allié puis Vanquish, ou savoir s'arrêter) sont enfin jugés
// sur tout le tour, pas coup par coup.
//
// applyAction est pur : l'utiliser pour le « lookahead » ne mute rien.
// =============================================================================

import type { GameAction, GameState, PlayerState } from '../engine/types'
import { applyAction } from '../engine/actions'
import { playableConditions } from '../engine/rules'
import { enumerateActions } from './enumerate'

type Rand = () => number

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)]
}

/** Proportion de l'objectif atteinte par un joueur (0..1). */
function objectiveScore(p: PlayerState): number {
  switch (p.objective.type) {
    case 'POWER_THRESHOLD':
      return Math.min(p.power, p.objective.threshold) / p.objective.threshold
    case 'CURSE_EACH_LOCATION': {
      const cursed = p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'curse')).length
      return cursed / Math.max(1, p.locations.length)
    }
    case 'CARDS_IN_REALM': {
      const obj = p.objective
      const have = p.locations.reduce(
        (n, l) => n + (p.board[l.id] ?? []).filter((c) => c.cardId === obj.cardId && !c.attachedTo).length,
        0,
      )
      return Math.min(have, obj.count) / obj.count
    }
    case 'CONTROL_HERO': {
      // Gradient par étapes du combo Jafar, pour guider le bot pas à pas :
      // déverrouiller la Caverne → invoquer le Génie (Lampe) → rapprocher la
      // Lampe du Palais → hypnotiser le Génie → Lampe au Palais.
      const obj = p.objective
      const all = Object.values(p.board).flat()
      const caveUnlocked = (p.lockedLocations ?? []).length === 0
      const genieOut = all.some((c) => c.cardId === obj.heroCardId)
      const controls = all.some(
        (c) => c.type === 'hero' && c.cardId === obj.heroCardId && c.hypnotized,
      )
      const itemPlaced = (p.board[obj.itemLocationId] ?? []).some((c) => c.cardId === obj.itemCardId)
      // Proximité de l'Objet (Lampe) vers son lieu cible (Palais) : récompense le
      // fait de la rapprocher tour après tour.
      const locIds = p.locations.map((l) => l.id)
      const targetIdx = locIds.indexOf(obj.itemLocationId)
      let itemIdx = -1
      for (let i = 0; i < locIds.length; i++) {
        if ((p.board[locIds[i]] ?? []).some((c) => c.cardId === obj.itemCardId)) itemIdx = i
      }
      const itemProx =
        itemIdx >= 0 && targetIdx >= 0
          ? 1 - Math.abs(itemIdx - targetIdx) / Math.max(1, locIds.length - 1)
          : 0
      // Paliers précoces fortement récompensés pour que le bot pose le Scarabée
      // d'Or (déverrouillage) puis la Lampe Merveilleuse (Génie) dès que possible,
      // sans aplatir la récompense des étapes finales (hypnose + Lampe au Palais).
      let s = 0
      if (caveUnlocked) s += 0.2
      if (genieOut) s += 0.25
      s += 0.1 * itemProx
      if (controls) s += 0.25
      if (itemPlaced) s += 0.2
      return Math.min(1, s)
    }
    case 'ROYAL_CROQUET':
      // Reine de Cœur : objectif via la carte Coup Royal (mécanique des arceaux
      // pas encore implémentée) → progrès non évalué pour l'instant.
      return 0
    case 'DEFEAT_HERO_AT_LOCATION': {
      const obj = p.objective
      // La Méchante Reine : progression dédiée — jouer les Ingrédients (déverrouille
      // la Maison des Nains), faire venir Blanche-Neige et amasser le Poison pour la
      // croquer. (Détectée via la zone Ingrédients, propre à elle.)
      if (p.ingredients !== undefined) {
        const ing = Math.min(4, p.ingredients.length)
        let s = 0.4 * (ing / 4) // priorité n°1 : réunir les 4 Ingrédients
        let bnLoc: string | undefined
        let otherHeroes = 0
        for (const l of p.locations) {
          for (const c of p.board[l.id] ?? []) {
            if (c.type !== 'hero') continue
            if (c.cardId === obj.heroCardId) bnLoc = l.id
            else otherHeroes++
          }
        }
        if (bnLoc) {
          s += 0.2 // Blanche-Neige en jeu (via le Miroir magique)
          if (bnLoc === obj.locationId) s += 0.2 // à la Maison des Nains
          const need = 1 + otherHeroes // approx. de sa force (+1 par autre Héros)
          s += 0.2 * Math.min(1, (p.poison ?? 0) / need) // Poison suffisant pour croquer
        }
        return Math.min(1, s)
      }
      // Capitaine Crochet : rapprocher le Héros cible (Peter Pan) du lieu cible
      // (Jolly Roger). Le Vanquish final déclenche la victoire (status WON).
      const targetLoc = p.locations.find((l) =>
        (p.board[l.id] ?? []).some((c) => c.type === 'hero' && c.cardId === obj.heroCardId),
      )?.id
      if (!targetLoc) return 0
      return targetLoc === obj.locationId ? 1 : 0.5
    }
    case 'ITEMS_AT_LOCATION': {
      // Ursula : récompense les Objets requis présents dans le royaume, davantage
      // s'ils sont déjà sur le lieu cible (Trident + Couronne au Repaire).
      const obj = p.objective
      const all = Object.values(p.board).flat()
      const cell = p.board[obj.locationId] ?? []
      const inRealm = obj.itemCardIds.filter((id) => all.some((c) => c.cardId === id && !c.attachedTo)).length
      const atLoc = obj.itemCardIds.filter((id) => cell.some((c) => c.cardId === id && !c.attachedTo)).length
      return (inRealm * 0.4 + atLoc * 0.6) / obj.itemCardIds.length
    }
    case 'UNTRAPPED_TITANS_AT_LOCATION': {
      // Hadès : récompense les Titans non entravés, davantage à mesure qu'ils se
      // rapprochent du Mont Olympe (plein score sur le lieu cible). Guide le bot à
      // jouer puis pousser ses Titans vers l'objectif.
      const obj = p.objective
      const order = p.locations.map((l) => l.id)
      const targetIdx = order.indexOf(obj.locationId)
      let score = 0
      for (const l of p.locations) {
        const li = order.indexOf(l.id)
        for (const c of p.board[l.id] ?? []) {
          if (!c.isTitan || c.trapped) continue
          if (l.id === obj.locationId) score += 1
          else score += 0.6 * (targetIdx > 0 ? Math.max(0, 1 - Math.abs(li - targetIdx) / targetIdx) : 0)
        }
      }
      return Math.min(1, score / obj.count)
    }
    case 'REIGN_NEW_ORLEANS': {
      // Dr Facilier : récompense la mise en place de la victoire — détenir le
      // Talisman (libre), avoir Régner dans la Pile de l'Au-delà, disposer de
      // Divination et être au Royaume du vaudou pour la jouer.
      const all = Object.values(p.board).flat()
      let s = 0
      if (all.some((c) => c.cardId === 'talisman' && !c.attachedTo)) s += 0.4
      else if (all.some((c) => c.cardId === 'talisman')) s += 0.2
      if (p.auDela.some((c) => c.cardId === 'regner-nouvelle-orleans')) s += 0.3
      if (p.hand.some((c) => c.cardId === 'divination-facilier')) s += 0.15
      if (p.pawnLocation === 'royaume-vaudou') s += 0.15
      return Math.min(1, s)
    }
    case 'KEEP_SABOTAGE': {
      // L'Imposteur : poser un Sabotage et le TENIR `turns` tours. Poser le Sabotage
      // est déjà une menace forte (base 0.4), qui grandit à chaque tour survécu
      // (compte `sabotageTurns` par carte) jusqu'à la victoire. Permet à l'adversaire
      // d'ANTICIPER (pression de blocage + escalade de Fatalité via la menace).
      const turns = p.objective.turns
      const placed = Object.values(p.board)
        .flat()
        .filter((c) => c.isSabotage && !c.attachedTo)
      if (placed.length === 0) return 0
      const best = Math.max(...placed.map((c) => c.sabotageTurns ?? 0))
      return Math.min(1, 0.4 + 0.6 * (best / Math.max(1, turns)))
    }
    case 'DEPLETE_OBSERVATORY_AND_CAPTURE': {
      // Bowser : récompense l'épuisement de l'Observatoire (moins d'Étoiles =
      // plus proche, base 4) et la capture de Peach. Mario présent plafonne la
      // récompense (victoire impossible tant qu'il est là).
      const obj = p.objective
      const stars = p.observatoryStars ?? 0
      const depletion = stars <= 0 ? 1 : Math.max(0, 1 - stars / 4)
      let s = 0.5 * depletion
      if (p.peachCaptured) s += 0.4
      const blocked = obj.blockerHeroCardId
        ? Object.values(p.board).some((cards) =>
            cards.some((c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId),
          )
        : false
      if (blocked) s = Math.min(s, 0.45)
      return Math.min(1, s)
    }
    case 'SUCCESSION_FORCE': {
      // Scar : tant que Mufasa n'est pas dans la pile Succession, l'objectif est
      // verrouillé (progrès plafonné). Avec lui, on mesure la Force accumulée.
      const obj = p.objective
      const pile = p.succession ?? []
      const force = pile.reduce((n, c) => n + (c.strength ?? 0), 0)
      if (!pile.some((c) => c.cardId === obj.firstHeroCardId)) return 0.15
      return Math.min(1, force / obj.minForce)
    }
    case 'DEFEAT_HERO_WITH_ALLY': {
      // Yzma : objectif atteint si Kronk a éliminé Kuzco. Sinon, progrès estimé selon
      // la présence de Kuzco et de Kronk dans le royaume.
      if (p.objectiveHeroDefeated) return 1
      const obj = p.objective
      const inRealm = (id: string) =>
        Object.values(p.board).flat().some((c) => c.cardId === id)
      const hasHero = inRealm(obj.heroCardId)
      const hasAlly = inRealm(obj.allyCardId)
      if (hasHero && hasAlly) return 0.6
      if (hasHero || hasAlly) return 0.3
      return 0.1
    }
    case 'RATIGAN_DUAL': {
      const obj = p.objective
      const all = Object.values(p.board).flat()
      // La Reine Moustoria à Buckingham Palace bloque la victoire (plafonne le score).
      const blocked = (p.board[obj.locationId] ?? []).some(
        (c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId,
      )
      let s: number
      if (p.becameTheRat) {
        // Côté « Le Rat » : éliminer Basil.
        if (p.objectiveHeroDefeated) return 1
        s = all.some((c) => c.type === 'hero' && c.cardId === obj.altHeroCardId) ? 0.5 : 0.2
      } else {
        // Côté « L'Esprit Supérieur » : faire venir la Reine Robot puis la poster à
        // Buckingham Palace (récompense d'abord sa mise en jeu, puis sa position).
        const atPalace = (p.board[obj.locationId] ?? []).some(
          (c) => c.cardId === obj.itemCardId && !c.attachedTo,
        )
        if (atPalace && !blocked) return 1
        const inRealm = all.some((c) => c.cardId === obj.itemCardId && !c.attachedTo)
        // Sans la Reine Robot en jeu : progrès proportionnel au Pouvoir accumulé
        // vers son coût (15), car la jouer est l'étape clé.
        s = inRealm ? 0.7 : 0.5 * Math.min(1, p.power / 15)
      }
      return blocked ? Math.min(s, 0.45) : Math.min(1, s)
    }
  }
}

/** Nombre de lieux du joueur portant au moins une Malédiction. */
function cursedLocationCount(p: PlayerState): number {
  return p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'curse')).length
}

/** Poids de la fonction d'évaluation. Paramétré pour permettre le tuning A/B. */
export type EvalWeights = {
  objective: number // progrès vers l'objectif (terme dominant)
  myPower: number // valeur du pouvoir quand l'objectif EST le pouvoir (× pouvoir, plafonné au seuil)
  oppPower: number
  fuelCap: number // pouvoir « carburant » utile pour un objectif NON-pouvoir (au-delà = inutile). Infinity = pas de plafond.
  fuelPower: number // valeur du pouvoir-carburant (objectif non-pouvoir)
  myAllyStr: number // valeur d'un Allié sur mon plateau (× force)
  // Valeur d'un Héros, CONSCIENTE de l'objectif du joueur sur le plateau duquel il est :
  // un Héros bloque les actions « Gagner pouvoir » (rangée haute) → très gênant pour un
  // joueur-POUVOIR, mais il ne bloque PAS la pose de Malédictions → peu gênant pour Maléfique.
  myHeroVsPower: number // pénalité par force d'un Héros chez moi si MON objectif est le pouvoir
  myHeroVsCurse: number // idem si mon objectif est de maudire
  myHeroFlat: number // pénalité forfaitaire par Héros chez moi
  oppHeroVsPower: number // bonus par force d'un Héros chez l'adversaire si SON objectif est le pouvoir (déni)
  oppHeroVsCurse: number // idem si son objectif est de maudire (peu de déni → faible)
  oppHeroFlat: number // bonus forfaitaire par Héros chez l'adversaire
  cursePerLocation: number // tempo : par LIEU maudit (pas par Malédiction → pas d'incitation à empiler)
  hand: number // valeur d'une carte en main
  handAllyStr: number // potentiel d'un Allié en main (× force)
  oppPawnDisrupt: number // perturbation : déplacer la figurine adverse loin de ses Alliés/Objets (× cartes, plafonné)
  fateThreatFloor: number // part MIN de la valeur des Héros chez l'adversaire quand il n'est PAS menaçant (1 = valeur fixe ; <1 = Fatalité escaladée selon la menace)
}

/** Baseline pour l'A/B : le comportement V3 d'avant tuning — pouvoir valorisé à
 *  plat (× myPower) quel que soit l'objectif, Fatalité fortement valorisée
 *  (oppHeroStr 3). `fuelCap: Infinity` neutralise le mode « carburant ». */
export const BASELINE_WEIGHTS: EvalWeights = {
  objective: 1000,
  myPower: 6,
  oppPower: 5,
  fuelCap: Infinity,
  fuelPower: 6,
  myAllyStr: 2,
  myHeroVsPower: 4,
  myHeroVsCurse: 4,
  myHeroFlat: 0,
  oppHeroVsPower: 3,
  oppHeroVsCurse: 3,
  oppHeroFlat: 0,
  cursePerLocation: 3,
  hand: 1,
  handAllyStr: 0,
  oppPawnDisrupt: 4,
  fateThreatFloor: 1, // baseline : valeur de Fatalité fixe (pas de modulation)
}

/** Poids par défaut (tunés). Pouvoir conscient de l'objectif (Maléfique ne
 *  thésaurise plus) et Fatalité dévaluée (plus de guerre de Fatalité dégénérée). */
export const DEFAULT_WEIGHTS: EvalWeights = {
  objective: 1000,
  myPower: 6,
  oppPower: 5,
  fuelCap: 6,
  fuelPower: 3,
  myAllyStr: 2,
  myHeroVsPower: 4,
  myHeroVsCurse: 1,
  myHeroFlat: 0,
  oppHeroVsPower: 3,
  oppHeroVsCurse: 1,
  oppHeroFlat: 0,
  cursePerLocation: 3,
  hand: 1,
  handAllyStr: 0,
  oppPawnDisrupt: 4,
  // Le bot privilégie SON objectif ; la Fatalité (Héros chez l'adversaire) n'est
  // pleinement valorisée que si l'adversaire est proche de gagner (escalade).
  fateThreatFloor: 0.7,
}

/** Soutien de la figurine d'un joueur : nb d'Alliés/Objets « racine » sur le lieu
 *  de son pion (plafonné). Le déplacer ailleurs (Roi Stéphane / Anneau étoile)
 *  le sépare de ses forces — c'est ce que valorise `oppPawnDisrupt`. */
function pawnSupport(p: PlayerState): number {
  const loc = p.pawnLocation
  if (!loc) return 0
  const n = (p.board[loc] ?? []).filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo).length
  return Math.min(n, 3)
}

/** Valeur du pouvoir pour un joueur, consciente de l'objectif. Pour un objectif
 *  de POUVOIR : pouvoir = progrès (plafonné au seuil). Sinon : simple carburant
 *  (utile jusqu'à `fuelCap`, au-delà sans valeur). `mult` = poids du camp. */
function powerValue(p: PlayerState, w: EvalWeights, mult: number): number {
  if (p.objective.type === 'POWER_THRESHOLD') {
    const eff = w.fuelCap === Infinity ? p.power : Math.min(p.power, p.objective.threshold)
    return eff * mult
  }
  return Math.min(p.power, w.fuelCap) * (w.fuelCap === Infinity ? mult : w.fuelPower)
}

/** Évalue la position du joueur `idx` (plus c'est haut, mieux c'est pour lui). */
export function evaluate(state: GameState, idx: number, w: EvalWeights = DEFAULT_WEIGHTS): number {
  if (state.status === 'WON') return state.winner === idx ? 1e9 : -1e9
  const me = state.players[idx]
  const opp = state.players[(idx + 1) % state.players.length]
  let score = 0
  // Progrès vers l'objectif, le sien en positif, celui de l'adversaire en négatif.
  const oppObj = objectiveScore(opp)
  score += objectiveScore(me) * w.objective
  score -= oppObj * w.objective
  // Pouvoir (conscient de l'objectif : carburant plafonné pour un non-pouvoir).
  score += powerValue(me, w, w.myPower)
  score -= powerValue(opp, w, w.oppPower)
  // Gêne d'un Héros selon l'objectif du plateau où il se trouve (cf. EvalWeights).
  const myHeroPerStr = me.objective.type === 'POWER_THRESHOLD' ? w.myHeroVsPower : w.myHeroVsCurse
  const oppHeroPerStr = opp.objective.type === 'POWER_THRESHOLD' ? w.oppHeroVsPower : w.oppHeroVsCurse
  // Présence sur SON plateau : Alliés utiles, Héros (placés par l'adversaire) nuisibles.
  for (const cards of Object.values(me.board)) {
    for (const c of cards) {
      if (c.type === 'ally') score += (c.strength ?? 0) * w.myAllyStr
      else if (c.type === 'hero') score -= (c.strength ?? 0) * myHeroPerStr + w.myHeroFlat
    }
  }
  // Lieux maudits (objectif Maléfique + tempo), comptés PAR LIEU (empiler n'aide pas).
  score += cursedLocationCount(me) * w.cursePerLocation
  // Héros dans le royaume ADVERSE : bon pour le bot (ils gênent l'adversaire). On
  // MODULE leur valeur par la MENACE adverse (sa progression vers la victoire) :
  // faible quand l'adversaire est loin de son but (le bot a intérêt à développer
  // SON objectif plutôt qu'à fataliser), pleine quand il est proche (le bot ralentit
  // l'adversaire). `w.fateThreatFloor` = part minimale gardée même sans menace.
  const fateScale = w.fateThreatFloor + (1 - w.fateThreatFloor) * oppObj
  for (const cards of Object.values(opp.board)) {
    for (const c of cards) {
      if (c.type === 'hero') score += ((c.strength ?? 0) * oppHeroPerStr + w.oppHeroFlat) * fateScale
    }
  }
  // Cartes en main : avantage en cartes + potentiel des Alliés (force jouable).
  score += me.hand.length * w.hand
  for (const c of me.hand) {
    if (c.type === 'ally') score += (c.strength ?? 0) * w.handAllyStr
  }
  // Perturbation : on gagne à éloigner la figurine adverse de ses Alliés/Objets.
  // Si un déplacement de SA figurine est déjà EN ATTENTE et que c'est NOUS qui le
  // contrôlons (Roi Stéphane / Anneau étoile), on anticipe l'éloignement (soutien
  // futur ≈ 0) — sinon la carte qui l'a déclenché paraîtrait « sans effet » (le
  // pion n'étant pas encore déplacé) et la recherche ne la jouerait jamais.
  const ppm = state.pendingPawnMove
  const oppIdx = (idx + 1) % state.players.length
  const oppSupport =
    ppm && ppm.chooserIndex === idx && ppm.targetIndex === oppIdx ? 0 : pawnSupport(opp)
  score -= oppSupport * w.oppPawnDisrupt
  return score
}

// --- Paramètres de la recherche de tour --------------------------------------
// BEAM : combien d'enfants on approfondit par nœud (les meilleurs en éval immédiate).
// NODE_BUDGET : nombre max d'applyAction par décision (garde-fou contre l'explosion).
// TOP_LEVEL : combien de premiers coups on évalue en profondeur (les autres restent
//   jugés sur leur seule éval immédiate). On veut tous les LIEUX en MOVE, donc large.
const BEAM = 4
const NODE_BUDGET = 600
const TOP_LEVEL = 12

type Budget = { n: number }

/** `true` si l'état n'est plus le tour du bot `idx` (fin de partie ou main passée). */
function turnEnded(state: GameState, idx: number): boolean {
  return state.status !== 'PLAYING' || state.activePlayer !== idx
}

/**
 * Meilleure éval de fin de tour atteignable depuis `state` (c'est encore au bot
 * de jouer). Beam search borné par `budget`. Si le budget est épuisé, on retombe
 * sur l'éval statique de la position courante.
 */
function bestTurnScore(state: GameState, idx: number, budget: Budget, w: EvalWeights): number {
  if (budget.n <= 0) return evaluate(state, idx, w)
  const scored: { next: GameState; imm: number }[] = []
  for (const a of enumerateActions(state)) {
    if (budget.n <= 0) break
    let next: GameState
    try {
      next = applyAction(state, a)
    } catch {
      continue
    }
    budget.n--
    scored.push({ next, imm: evaluate(next, idx, w) })
  }
  if (scored.length === 0) return evaluate(state, idx, w)
  scored.sort((x, y) => y.imm - x.imm)
  let best = -Infinity
  const width = Math.min(scored.length, BEAM)
  for (let i = 0; i < width; i++) {
    const { next, imm } = scored[i]
    const v = turnEnded(next, idx) ? imm : bestTurnScore(next, idx, budget, w)
    if (v > best) best = v
  }
  return best
}

/**
 * Choisit le premier coup de la meilleure ligne de jeu sur le reste du tour.
 * On simule chaque coup légal, puis on cherche (beam, borné) la meilleure éval
 * de fin de tour qu'il permet d'atteindre. À éval égale, choix aléatoire parmi
 * les ex æquo (déterminisme via `rand`).
 */
export function chooseAction(
  state: GameState,
  rand: Rand = Math.random,
  w: EvalWeights = DEFAULT_WEIGHTS,
): GameAction {
  const idx = state.activePlayer
  const candidates = enumerateActions(state)
  // Pré-tri par éval immédiate : on approfondit en priorité les coups prometteurs.
  const scored: { action: GameAction; next: GameState | null; imm: number }[] = []
  for (const action of candidates) {
    let next: GameState | null
    try {
      next = applyAction(state, action)
    } catch {
      next = null
    }
    scored.push({ action, next, imm: next ? evaluate(next, idx, w) : -Infinity })
  }
  scored.sort((x, y) => y.imm - x.imm)

  const budget: Budget = { n: NODE_BUDGET }
  const top = Math.min(scored.length, TOP_LEVEL)
  let best: GameAction[] = []
  let bestScore = -Infinity
  for (let i = 0; i < scored.length; i++) {
    const { action, next, imm } = scored[i]
    let sc: number
    if (!next) {
      sc = -Infinity
    } else if (i < top && !turnEnded(next, idx)) {
      sc = bestTurnScore(next, idx, budget, w)
    } else {
      sc = imm
    }
    if (sc > bestScore) {
      bestScore = sc
      best = [action]
    } else if (sc === bestScore) {
      best.push(action)
    }
  }
  if (best.length === 0) return { type: 'END_TURN' }
  return pick(best, rand)
}

/** Construit l'action PLAY_CONDITION pour une Condition donnée (cibles auto). */
function buildConditionAction(
  state: GameState,
  playerIndex: number,
  card: PlayerState['hand'][number],
  rand: Rand,
): GameAction | null {
  if (card.cardId === 'lachete' || card.cardId === 'ruse' || card.cardId === 'renforts') {
    // Lâcheté / Ruse / Besoin de renfort : pose gratuitement l'Allié le plus fort.
    const me = state.players[playerIndex]
    const allies = me.hand.filter((c) => c.type === 'ally')
    if (allies.length === 0) return null
    const ally = [...allies].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
    return {
      type: 'PLAY_CONDITION',
      playerIndex,
      instanceId: card.instanceId,
      allyInstanceId: ally.instanceId,
      to: me.locations[0].id,
    }
  }
  if (card.cardId === 'mechancete') {
    const heroes = Object.values(state.players[playerIndex].board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= 4)
    if (heroes.length === 0) return null
    // Héros le plus fort éligible (le plus pénalisant à garder).
    const hero = [...heroes].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
    return { type: 'PLAY_CONDITION', playerIndex, instanceId: card.instanceId, allyInstanceId: hero.instanceId }
  }
  // Avarice, Tyrannie : aucun choix supplémentaire.
  void rand
  return { type: 'PLAY_CONDITION', playerIndex, instanceId: card.instanceId }
}

/**
 * Réaction (Condition) : joue la Condition qui améliore le plus la position du
 * bot, ou null si aucune n'aide (on ne gaspille pas une carte pour rien).
 */
export function chooseReaction(
  state: GameState,
  playerIndex: number,
  rand: Rand = Math.random,
  w: EvalWeights = DEFAULT_WEIGHTS,
): GameAction | null {
  const conditions = playableConditions(state, playerIndex)
  if (conditions.length === 0) return null
  const base = evaluate(state, playerIndex, w)
  let best: GameAction | null = null
  let bestScore = base
  for (const card of conditions) {
    const action = buildConditionAction(state, playerIndex, card, rand)
    if (!action) continue
    let next: GameState
    try {
      next = applyAction(state, action)
    } catch {
      continue
    }
    const sc = evaluate(next, playerIndex, w)
    if (sc > bestScore) {
      bestScore = sc
      best = action
    }
  }
  return best
}
