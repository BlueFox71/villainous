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

import type { CardInstance, GameAction, GameState, PlayerState } from '../engine/types'
import { applyAction } from '../engine/actions'
import { handLimitFor } from '../engine/state'
import { playableConditions, hasReachedObjective, goalsBlockedByHero } from '../engine/rules'
import { enumerateActions, objectiveCriticalCardIds } from './enumerate'
import { playerMalus } from './fateMalus'
import { villainStrategyBonus, villainFateTargetingBonus, isCaptureTargetHero, VILLAIN_STRATEGY } from './villainStrategy'
import { fireCount } from '../engine/shereKhan'

type Rand = () => number

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)]
}

/**
 * Choix du bot pour un « récupérer une carte de la défausse » (pendingRecover :
 * Te revoilà !, Magie noire…). Renvoie la meilleure carte à reprendre, ou undefined
 * si aucune candidate. Pur (testable) ; appelé par l'auto-résolution du bot (App.tsx).
 *
 * Générique : la carte la plus chère (Magie noire de la Méchante Reine privilégie le
 * Miroir magique puis les Ingrédients). Bowser (Te revoilà !) a ses propres priorités :
 * Impuissance (SEULE capture de Peach), Bowser Jr. (va la chercher), épuisement
 * d'énergie (draine une Étoile tant qu'il en reste), puis ses Alliés.
 */
export function pickRecoverCandidate(p: PlayerState, cands: CardInstance[]): CardInstance | undefined {
  if (cands.length === 0) return undefined
  const rank = (c: CardInstance): number => {
    if (p.objective.type === 'DEPLETE_OBSERVATORY_AND_CAPTURE') {
      const starsLeft = (p.observatoryStars ?? 0) > 0
      const peachInRealm = Object.values(p.board)
        .flat()
        .some((x) => x.type === 'hero' && x.cardId === 'peach')
      if (c.cardId === 'impuissance') return peachInRealm ? 130 : 95 // capture Peach / vainc un Héros ≤3
      if (c.cardId === 'bowser-jr') return !p.peachCaptured && !peachInRealm ? 120 : 40 // va chercher Peach
      if (c.cardId === 'puissance-stellaire') return starsLeft ? 110 : 20 // draine encore une Étoile
      if (c.type === 'ally') return 50 + (c.cost ?? 0)
    }
    if (p.objective.type === 'KILL_FIGHTERS') {
      // Tabbou (Bombe du vide) : Halberd d'abord (moteur de tempo irremplaçable). Ensuite,
      // selon la phase : tant qu'on n'a pas assez dévoilé (tués + réserve < seuil), on
      // récupère de quoi DÉVOILER (Primides, Flèche, Destin) ; sinon de quoi TUER
      // (Collection, Bowser, Coup Fatal).
      const tiles = p.fighterTiles ?? []
      const killed = tiles.filter((t) => t.state === 'killed').length
      const reserve = tiles.filter((t) => t.state === 'reserve').length
      const samus = Object.values(p.board).flat().some((x) => x.type === 'hero' && x.cardId === 'samus')
      const threshold = samus ? 30 : 20
      const needReveal = killed + reserve < threshold
      if (c.cardId === 'halberd') return 130
      const revealCards = new Set(['primides', 'fleche-tabbou', 'destin'])
      const killCards = new Set(['collection', 'canon-obscure', 'coup-fatal'])
      if (needReveal && revealCards.has(c.cardId)) return 100 + (c.cost ?? 0)
      if (!needReveal && killCards.has(c.cardId)) return 100 + (c.cost ?? 0)
      // Cartes de l'autre phase : utiles mais moins prioritaires que celles de la phase courante.
      if (revealCards.has(c.cardId) || killCards.has(c.cardId)) return 60 + (c.cost ?? 0)
      return c.cost ?? 0
    }
    // Générique : Magie noire privilégie le Miroir magique puis les Ingrédients ; sinon coût.
    return c.cardId === 'miroir-magique' ? 100 : c.type === 'ingredient' ? 50 + (c.cost ?? 0) : (c.cost ?? 0)
  }
  return [...cands].sort((a, b) => rank(b) - rank(a))[0]
}

/** Proportion de l'objectif atteinte par un joueur (0..1). Exportée pour l'affichage
 *  de la progression en % côté UI (même jauge que celle qui guide le bot). */
export function objectiveScore(p: PlayerState): number {
  switch (p.objective.type) {
    case 'ISABELLA_CLOCK':
      // Isabella — proximité = heures validées / 6 (jauge simple ; tuning fin en Phase 2).
      return (p.validatedHours ?? []).length / 6
    case 'ULTRON_AGE_REVEALED': {
      // Ultron — proximité = tuiles Amélioration révélées / 4 (jauge de 1re passe ; tuning
      // fin à l'étape IA). Petit crédit pour les Sentinelles en jeu (matière à compléter la
      // prochaine tuile), plafonné pour ne jamais atteindre 1 avant la 4ᵉ révélation.
      const done = p.ultronUpgrades ?? 0
      if (done >= 4) return 1
      const sentries = p.locations.reduce(
        (n, loc) => n + (p.board[loc.id] ?? []).filter((c) => c.isSentry && !c.attachedTo).length,
        0,
      )
      return done / 4 + (Math.min(sentries, 4) / 4) * 0.15
    }
    case 'THANOS_STONES': {
      // Thanos — proximité = Pierres CAPTURÉES en Compétences / 6 (poids 0,9). Petit crédit
      // pour les Alliés disponibles dans le royaume (matière à capturer les Pierres
      // restantes). Bloqué tant qu'Adam Warlock est présent : plafond à 0,9 (et 0,85 même
      // avec les 6 Pierres tant qu'il n'est pas vaincu). Jamais 1 avant la victoire réelle.
      const obj = p.objective
      const captured = (p.stoneSkills ?? []).length
      const adamPresent =
        obj.blockerHeroCardId !== undefined &&
        Object.values(p.board).some((cards) =>
          cards.some((c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId),
        )
      if (captured >= 6) return adamPresent ? 0.85 : 1
      const allies = Object.values(p.board)
        .flat()
        .filter((c) => c.type === 'ally' && !c.attachedTo && !c.thanosAlly).length
      let s = 0.9 * (captured / 6) + (Math.min(allies, 4) / 4) * 0.05
      if (adamPresent) s = Math.min(s, 0.9)
      return Math.min(0.95, s)
    }
    case 'POWER_THRESHOLD': {
      const threshold = p.objective.threshold
      const base = Math.min(p.power, threshold) / threshold
      // Mr. Monopoly : le Pouvoir SEUL fait foi pour la victoire (≥ threshold au début du
      // tour). Mais poser des maisons COÛTE du Pouvoir maintenant pour un loyer FUTUR : sans
      // crédit, le bot fuirait cet investissement (baisse de Pouvoir). On ajoute donc un
      // petit bonus pour le parc de maisons installé (plafonné, jamais 1 tant que le Pouvoir
      // réel n'atteint pas le seuil) afin que le bot bâtisse son moteur de loyer.
      if (p.villain === 'custom-mr-monopoly' && p.power < threshold) {
        const houses = Object.values(p.houses ?? {}).reduce((n, v) => n + v, 0)
        return Math.min(0.95, base + (Math.min(houses, 8) / 8) * 0.2)
      }
      // Gul'dan : la victoire ne passe PAS par le Pouvoir (seuil 999 factice) mais par la
      // Porte des Ténèbres. Vraie proximité = 4 Artéfacts + 4 lieux corrompus (poids forts,
      // symétriques) ; dernière ligne droite quand les deux sont complets : pion sur la Porte
      // et OUVERTURE disponible. Jamais 1 tant que la partie n'est pas gagnée.
      if (p.villain === 'custom-gul-dan') {
        const artifacts = Math.min((p.artifacts ?? []).length, 4)
        const corrupted = p.locations.filter((l) => l.version === 'b').length
        const portalId = p.locations[p.locations.length - 1]?.id
        const onPortal = !!portalId && p.pawnLocation === portalId
        const hasOuverture = [...p.hand, ...p.deck, ...p.discard].some((c) =>
          (c.effects ?? []).some((e) => e.type === 'DARK_PORTAL_WIN'),
        )
        let s = 0.45 * (artifacts / 4) + 0.45 * (Math.min(corrupted, 4) / 4)
        if (artifacts === 4 && corrupted >= 4) {
          if (onPortal) s += 0.06
          if (hasOuverture) s += 0.04
        }
        return Math.min(0.99, s)
      }
      return base
    }
    case 'CAPTURE_POKEMON': {
      // Team Rocket : capturer `count` Pokémon dont Pikachu. Progression = Pokémon
      // capturés / objectif ; sans Pikachu la victoire est impossible → plafonné.
      // Gradient de boucle Repérage→Vaincre→Attraper : un Pokémon COUCHÉ (K.O., vaincu
      // mais pas encore attrapé) vaut un demi-Pokémon capturé — récompense l'étape
      // « Vaincre » et fait de l'« Attraper » un vrai finisseur (sinon le bot ne « voit »
      // le progrès qu'au tout dernier pas et hésite à coucher un Pokémon).
      const obj = p.objective
      const pile = p.capturedPokemon ?? []
      const hasRequired = pile.some((c) => c.cardId === obj.requiredCardId)
      const koReady = Object.values(p.board)
        .flat()
        .filter((c) => c.isPokemon && c.pokemonKO).length
      const s = Math.min(pile.length + 0.5 * koReady, obj.count) / obj.count
      return hasRequired ? s : Math.min(s, 0.85)
    }
    case 'KILL_FIGHTERS': {
      // Tabbou : ≥ threshold Combattants tués (30 tant que Samus est là). Crédit
      // partiel pour les tuiles DÉVOILÉES (réserve) : elles sont à portée d'une carte
      // de mise à mort, donc valent 0,25 chacune (récompense « dévoiler puis tuer »).
      const obj = p.objective
      const tiles = p.fighterTiles ?? []
      const killed = tiles.filter((t) => t.state === 'killed').length
      const reserve = tiles.filter((t) => t.state === 'reserve').length
      let threshold = obj.threshold
      if (obj.raiseHeroCardId !== undefined && obj.raiseTo !== undefined) {
        const samusPresent = Object.values(p.board)
          .flat()
          .some((c) => c.type === 'hero' && c.cardId === obj.raiseHeroCardId)
        if (samusPresent) threshold = obj.raiseTo
      }
      return Math.min(1, (killed + 0.25 * reserve) / threshold)
    }
    case 'KING_CANDY_RACE': {
      // Sa Sucrerie : avant la course, jalonner l'arrivée de Vanellope dans le royaume
      // puis l'attache d'un Bug. Pendant la course, refléter la VRAIE proximité : la
      // position sur le circuit ET l'avance sur le jeton Pilote (en retard = plafonné).
      const all = Object.values(p.board).flat()
      const vanellope = all.find((c) => c.type === 'hero' && c.cardId === 'vanellope-von-schweetz')
      const bugOnV = !!vanellope && all.some((c) => c.cardId === 'bug' && c.attachedTo === vanellope.instanceId)
      if (p.raceActive && p.racerPos != null) {
        const TRACK = 18
        const progress = Math.min(1, (p.trackPos ?? 0) / TRACK)
        const lead = (p.trackPos ?? 0) - p.racerPos // > 0 = devant le jeton Pilote
        let s = 0.5 + 0.45 * progress
        if (lead < 0) s = Math.min(s, 0.6) // en retard sur le Pilote : plafonné
        else s += Math.min(0.05, 0.01 * lead)
        return Math.min(0.99, s)
      }
      // Avant la course : pipeline du guide — trouver le Médaillon des Héros de Ralph →
      // sortir Ralph → le vaincre (→ Vanellope arrive) → l'« glitcher » (Bug) → la course
      // démarre. On récompense chaque palier pour donner un gradient AVANT que Vanellope
      // soit en jeu (sinon le bot ne « voit » pas l'intérêt de chercher le Médaillon).
      if (vanellope) {
        let s = 0.35
        if (bugOnV || p.hand.some((c) => c.cardId === 'bug')) s += 0.1 // prêt à lancer la course
        return Math.min(0.45, s)
      }
      const ralph = all.find((c) => c.type === 'hero' && c.cardId === 'ralph-la-casse')
      const haveMedal = [...p.hand, ...all].some((c) => c.cardId === 'medaillon-des-heros-de-ralph')
      if (ralph) {
        // Ralph en jeu = passerelle vers Vanellope (le vaincre la fait entrer). Bonus si on
        // est PRÊT à le vaincre (Duncan & Wynnchel, ou assez de force d'Alliés sur son lieu).
        let s = 0.22
        const ralphLoc = Object.entries(p.board).find(([, cs]) => cs.some((c) => c.instanceId === ralph.instanceId))?.[0]
        const allyForce = ralphLoc
          ? (p.board[ralphLoc] ?? []).filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped).reduce((n, c) => n + (c.strength ?? 0), 0)
          : 0
        const dw = all.some((c) => c.cardId === 'duncan-et-wynnchel')
        if (dw || allyForce >= (ralph.strength ?? 6)) s += 0.1
        return s
      }
      // Pas encore Ralph : avoir le Médaillon en main/jeu (la clé) > simplement fouiller.
      return haveMedal ? 0.12 : 0.04
    }
    case 'CLAIM_ALL_TREASURES': {
      // Davy Jones : récupérer 5 Trésors. Progression = Trésors récupérés (poids fort) +
      // crédit partiel pour les Trésors POSÉS sur des Héros (révélés = plus proches du
      // Vanquish que face cachée).
      const claimed = (p.claimedTreasures ?? []).length
      const heroes = Object.values(p.board).flat().filter((c) => c.type === 'hero')
      const faceUp = heroes.filter((h) => h.treasure?.faceUp).length
      const faceDown = heroes.filter((h) => h.treasure && !h.treasure.faceUp).length
      const s = claimed * 0.17 + faceUp * 0.05 + faceDown * 0.02
      return Math.min(0.99, s)
    }
    case 'DIO_ALL_ACTIONS': {
      // Dio Brando : objectif DOUBLE et endgame. (1) Retirer du jeu Jotaro + Joseph ;
      // (2) balayer les 14 actions hors-Fatalité du royaume EN UN TOUR via ZA WARUDO! (coût
      // 1+2+…+14 = 105 Pouvoir, divisé de moitié par le doublement de The World). La vraie
      // proximité dépend donc surtout de : Joestar retirés, The World en jeu, carburant, et
      // l'ABSENCE de Star Platinum (qui interdit ZA WARUDO).
      const obj = p.objective
      const removed = (p.removedFromGame ?? []).filter((id) => obj.joestarCardIds.includes(id)).length
      const joestarPart = removed / obj.joestarCardIds.length // 0, 0.5, 1
      const inPlay = Object.values(p.board).flat()
      const worldOut = inPlay.some((c) => c.cardId === 'the-world')
      const starPlat = inPlay.some((c) => c.cardId === 'star-platinum') // bloque ZA WARUDO!
      const hasZaWarudo = [...p.hand, ...p.deck, ...p.discard].some((c) => c.cardId === 'za-warudo')
      const fuel = Math.min(1, p.power / 105)
      let s = 0.45 * joestarPart + (worldOut ? 0.15 : 0) + 0.25 * fuel + (hasZaWarudo ? 0.05 : 0)
      // Tant que les DEUX Joestar ne sont pas retirés, la 2ᵉ moitié de l'objectif est hors
      // d'atteinte → plafond.
      if (removed < obj.joestarCardIds.length) s = Math.min(s, 0.7)
      // Star Platinum en jeu → ZA WARUDO! impossible → victoire bloquée (plafond bas).
      if (starPlat) s = Math.min(s, 0.5)
      return Math.min(0.95, Math.max(0, s))
    }
    case 'DEFEAT_HERO_NO_FIRE': {
      // Shere Khan : faire venir Mowgli (0.5), retirer les jetons Feu (jusqu'à +0.3),
      // réunir la force pour le vaincre. Plafonné tant que Baloo (bouclier) est présent.
      const obj = p.objective
      const all = Object.values(p.board).flat()
      const mowgli = all.find((c) => c.type === 'hero' && c.cardId === obj.heroCardId)
      if (!mowgli) {
        const canFetch = p.hand.some((c) => (c.effects ?? []).some((e) => e.type === 'DEFEAT_OR_FETCH_HERO'))
        return canFetch ? 0.2 : 0.1
      }
      const fire = fireCount(p)
      const baloo = all.some((c) => c.type === 'hero' && c.shieldsOtherHeroesUntilTokens !== undefined)
      const mowgliLoc = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.instanceId === mowgli.instanceId))?.id
      const allyForce = mowgliLoc
        ? (p.board[mowgliLoc] ?? []).filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped).reduce((n, c) => n + (c.strength ?? 0), 0)
        : 0
      const ready = Math.min(1, allyForce / Math.max(1, (mowgli.strength ?? 2) + (mowgli.permanentStrengthDelta ?? 0)))
      let s = 0.5 + (fire === 0 ? 0.3 : Math.max(0, 0.25 - 0.05 * fire)) + 0.15 * ready
      if (baloo) s = Math.min(s, 0.6)
      return Math.min(0.97, s)
    }
    case 'JUDGMENT_TILES_ALL':
      // Pyramid Head : proportion de lieux tuilés (Phase 1 — jauge à affiner avec l'IA).
      return (p.judgmentTiles ?? 0) / Math.max(1, p.locations.length)
    case 'CURSE_EACH_LOCATION': {
      const cursed = p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.type === 'curse')).length
      return cursed / Math.max(1, p.locations.length)
    }
    case 'KEYS_ALL_COLORS': {
      // Le Seigneur des clés : proportion des 6 couleurs possédées. Plafonné si la
      // Clé Noire est dans son royaume (bloque la victoire → priorité à s'en défaire).
      const owned = new Set((p.keys ?? []).filter((k) => k.location === null && !k.stolenBy).map((k) => k.color))
      const blackKey = Object.values(p.board).flat().some((c) => c.cardId === 'cle-noire')
      if (owned.size >= 6 && !blackKey) return 1
      let s = owned.size / 6
      if (blackKey) s = Math.min(s, 0.5)
      return Math.min(0.99, s)
    }
    case 'MARRY_PRINCE': {
      // Madame de Trémaine : progression vers le mariage. Paliers cumulés : Salle de
      // Bal déverrouillée, fille en robe au bal, Prince au bal, Cloches en jeu, aucune
      // Pantoufle de Verre. La proximité réelle dépend du dernier verrou manquant.
      const obj = p.objective
      const ballroom = p.board[obj.ballroomId] ?? []
      const all = Object.values(p.board).flat()
      const unlocked = !(p.lockedLocations ?? []).includes(obj.ballroomId)
      const gownAtBall = ballroom.some((c) => obj.ballGownCardIds.includes(c.cardId) && c.type === 'ally' && !c.attachedTo)
      const princeAtBall = ballroom.some((c) => c.cardId === obj.princeCardId)
      const bells = all.some((c) => c.cardId === obj.bellsCardId && !c.attachedTo)
      const slipper = all.some((c) => obj.slipperCardIds.includes(c.cardId))
      if (unlocked && gownAtBall && princeAtBall && bells && !slipper) return 1
      // Pondère les jalons ; la Pantoufle de Verre plafonne (il faut d'abord la retirer).
      let s = 0
      if (unlocked) s += 0.2
      if (bells) s += 0.2
      if (gownAtBall) s += 0.3
      if (princeAtBall) s += 0.25
      if (slipper) s = Math.min(s, 0.6)
      return Math.min(0.99, s)
    }
    case 'KISS_AT_BALL': {
      // La Bonne Fée : amener Fiona (avec ses 2 potions) + le Prince Charmant en
      // Salle de Bal, sans Shrek dans le royaume. Jauge validée avec l'utilisateur :
      // Fiona en jeu .2 + Fiona au bal .2 + .15/potion (max .3) + Prince au bal .2 ;
      // =1 quand tout est prêt ; plafond .5 tant que Shrek (bloqueur) est présent.
      const obj = p.objective
      const all = Object.values(p.board).flat()
      const ballroom = p.board[obj.ballroomId] ?? []
      const shrekPresent = all.some((c) => c.type === 'hero' && c.cardId === obj.blockerHeroCardId)
      const fiona = all.find((c) => c.type === 'hero' && c.cardId === obj.heroCardId)
      const fionaAtBall = !!fiona && ballroom.some((c) => c.instanceId === fiona.instanceId)
      const potionsOnFiona = fiona
        ? obj.potionCardIds.filter((pid) =>
            all.some((c) => c.cardId === pid && c.attachedTo === fiona.instanceId),
          ).length
        : 0
      const princeAtBall = ballroom.some((c) => c.cardId === obj.allyCardId && c.type === 'ally')
      if (!shrekPresent && fionaAtBall && potionsOnFiona >= 2 && princeAtBall) return 1
      let s = 0
      if (fiona) s += 0.2
      if (fionaAtBall) s += 0.2
      s += 0.15 * Math.min(2, potionsOnFiona)
      if (princeAtBall) s += 0.2
      if (shrekPresent) s = Math.min(s, 0.5)
      return Math.min(0.95, s)
    }
    case 'FLAYER_GATE': {
      // Le Flagelleur Mental : poser un TUNNEL sur chacun des N premiers lieux, poser
      // l'ENTRÉE, amener ONZE sur son lieu, puis activer. Jauge validée : .12/lieu
      // tunnelisé (max .36) + .12 Entrée posée + .08 Billy en jeu (l'enabler du fetch)
      // + .20 Onze dans le royaume + .24 Onze sur le lieu de l'Entrée ; =1 quand tout
      // est prêt ; plafond .55 tant que MAX est présente ET Onze pas encore récupérée
      // (la voie de victoire est gelée).
      const obj = p.objective
      const all = Object.values(p.board).flat()
      let gateLoc: string | undefined
      for (const loc of p.locations) {
        if ((p.board[loc.id] ?? []).some((c) => c.cardId === obj.gateCardId && !c.attachedTo)) {
          gateLoc = loc.id
          break
        }
      }
      const firstLocs = p.locations.slice(0, obj.tunnelLocationCount)
      const tunneled = firstLocs.filter((loc) =>
        (p.board[loc.id] ?? []).some((c) => c.cardId === obj.tunnelCardId && !c.attachedTo),
      ).length
      const onzeInRealm = all.some((c) => c.type === 'hero' && c.cardId === obj.heroCardId)
      const onzeOnGate = !!gateLoc && (p.board[gateLoc] ?? []).some((c) => c.type === 'hero' && c.cardId === obj.heroCardId)
      if (gateLoc && onzeOnGate && tunneled >= obj.tunnelLocationCount) return 1
      let s = 0.12 * tunneled
      if (gateLoc) s += 0.12
      if (all.some((c) => c.cardId === 'billy-sous-emprise')) s += 0.08
      if (onzeInRealm) s += 0.2
      if (onzeOnGate) s += 0.24
      const maxPresent = all.some((c) => c.type === 'hero' && c.cardId === 'max-mayfield')
      if (maxPresent && !onzeInRealm) s = Math.min(s, 0.55)
      return Math.min(0.97, s)
    }
    case 'REMOVE_ALL_OBSTACLES': {
      // Gaston : proportion d'Obstacles RETIRÉS (8 au départ). Si Belle est dans le
      // royaume, elle bloque TOUT retrait : on plafonne la jauge pour pousser le bot
      // à la vaincre avant de pouvoir progresser de nouveau.
      const start = Math.max(1, p.locations.length * 2)
      const remaining = Object.values(p.obstacles ?? {}).reduce((n, v) => n + v, 0)
      if (remaining === 0) return 1
      let s = (start - remaining) / start
      const belle = Object.values(p.board).flat().some((c) => c.type === 'hero' && c.cardId === 'belle')
      if (belle) s = Math.min(s, 0.5)
      return Math.min(0.99, s)
    }
    case 'SOMBRA': {
      // 0,85 × (lieux piratés / 4) ; +0,15 quand les 4 lieux sont piratés ET que
      // Protocole Sombra est en main (prêt à déclencher la victoire).
      const total = Math.max(1, p.locations.length)
      const hacked = p.locations.filter((l) => (p.board[l.id] ?? []).some((c) => c.isPiratage)).length
      let s = 0.85 * (hacked / total)
      if (hacked >= total && p.hand.some((c) => c.cardId === 'protocole-sombra')) s += 0.15
      return Math.min(1, s)
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
    case 'ROYAL_CROQUET': {
      // Reine de Cœur : un arceau dans CHAQUE lieu (puis Coup Royal, qui déclenche
      // la victoire et qu'on capte via status WON). Par lieu : un arceau vaut 1, une
      // Carte Garde encore non transformée vaut 0.5 (étape intermédiaire) → le bot
      // pose ses Gardes puis les transforme en arceaux.
      const score = p.locations.reduce((acc, l) => {
        const cell = p.board[l.id] ?? []
        if (cell.some((c) => c.isWicket)) return acc + 1
        if (cell.some((c) => c.type === 'ally' && c.cardId.startsWith('gardes-'))) return acc + 0.5
        return acc
      }, 0)
      return Math.min(1, score / Math.max(1, p.locations.length))
    }
    case 'DEFEAT_HERO_AT_LOCATION': {
      const obj = p.objective
      // Oogie Boogie : faire revenir Jack via les Imposteurs (0→4), PUIS réunir assez
      // d'Alliés à l'Antre pour le vaincre. Réunir les 4 imposteurs ≈ 60 % du chemin
      // (Jack revient), le vaincre ≈ les 40 % restants (force 8 + Zéro + jetons -1).
      if (p.villain === 'oogie-boogie') {
        if (!p.jackReturned) return 0.6 * Math.min(4, p.impostorsPlaced ?? 0) / 4
        const jackLoc = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.cardId === 'jack-skellington'))?.id
        if (!jackLoc) return 0.6
        const jack = (p.board[jackLoc] ?? []).find((c) => c.cardId === 'jack-skellington')!
        const zero = Object.values(p.board).flat().some((c) => c.cardId === 'zero')
        const jackForce = Math.max(0, (jack.strength ?? 8) + (jack.forceTokens ?? 0) + (zero ? 2 : 0))
        const allyForce = (p.board[jackLoc] ?? [])
          .filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
          .reduce((n, c) => n + (c.strength ?? 0), 0)
        const readiness = Math.min(1, allyForce / Math.max(1, jackForce))
        return Math.min(1, 0.6 + 0.4 * readiness)
      }
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
      // Capitaine Crochet : faire venir Peter Pan (via Fatalité), le rapprocher du
      // Jolly Roger, et réunir assez d'Alliés pour le vaincre. Jauge graduée :
      // base (présent) + proximité du lieu cible + capacité à le vaincre (force
      // d'Alliés sur son lieu ÷ sa force). Le Vanquish final déclenche la victoire.
      const heroLocId = p.locations.find((l) =>
        (p.board[l.id] ?? []).some((c) => c.type === 'hero' && c.cardId === obj.heroCardId),
      )?.id
      if (!heroLocId) return 0 // Peter Pan pas encore en jeu
      const hero = (p.board[heroLocId] ?? []).find((c) => c.type === 'hero' && c.cardId === obj.heroCardId)!
      const ids = p.locations.map((l) => l.id)
      const dist = Math.abs(ids.indexOf(heroLocId) - ids.indexOf(obj.locationId))
      const prox = ids.length > 1 ? 1 - dist / (ids.length - 1) : 1
      const allyForce = (p.board[heroLocId] ?? [])
        .filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
        .reduce((n, c) => n + (c.strength ?? 0), 0)
      const readiness = Math.min(1, allyForce / Math.max(1, hero.strength ?? 1))
      return Math.min(1, 0.4 + 0.3 * prox + 0.3 * readiness)
    }
    case 'ITEMS_AT_LOCATION': {
      // Ursula : récompense les Objets requis présents dans le royaume, davantage
      // s'ils sont déjà sur le lieu cible (Trident + Couronne au Repaire).
      const obj = p.objective
      const all = Object.values(p.board).flat()
      const cell = p.board[obj.locationId] ?? []
      const inRealm = obj.itemCardIds.filter((id) => all.some((c) => c.cardId === id && !c.attachedTo)).length
      const atLoc = obj.itemCardIds.filter((id) => cell.some((c) => c.cardId === id && !c.attachedTo)).length
      // Tamatoa : un Objet-objectif ASSOCIÉ (Hameçon/Cœur « volé » par Maui/Moana) compte
      // pour un progrès PARTIEL — il suffit de vaincre le gardien pour le libérer. (Sans
      // effet pour Ursula, dont le Trident/la Couronne ne sont jamais associés.)
      const attached = obj.itemCardIds.filter((id) => all.some((c) => c.cardId === id && c.attachedTo)).length
      return (inRealm * 0.4 + atLoc * 0.6 + attached * 0.25) / obj.itemCardIds.length
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
      // L'Imposteur : poser un Sabotage et le TENIR `turns` tours. Un Sabotage (comme
      // une Tâche) est défaussé dès que son lieu porte assez de Coéquipiers : la VRAIE
      // proximité de victoire dépend donc aussi du nombre de Coéquipiers encore VIVANTS
      // (peu = une fenêtre de Sabotage s'ouvre) et de combien le SUSPECTENT (un suspect
      // recouvre une action du haut → tour moins productif). On encode ces deux leviers :
      //  - côté JEU : pousse le bot Imposteur à éliminer les Coéquipiers tôt ;
      //  - côté CONTRE : Arrivée tardive (ranime un Coéquipier → +vivants) et les
      //    Fatalités de suspicion (Corps découvert, Tâche visuelle, Carte, Caméra) font
      //    BAISSER ce score → le fataliseur les valorise (cf. mémoire « fate-malus »).
      const turns = p.objective.turns
      const crew = p.crewmates ?? []
      const live = crew.filter((c) => !c.discarded)
      const liveN = live.length
      const totalN = crew.length || 8
      const suspectN = live.filter((c) => c.suspect).length
      // Suspicion : pénalité LÉGÈRE (≤ 0.1) — la suspicion « n'est pas si grave », mais
      // chaque suspect recouvre une action → progression un peu plus lente.
      const suspectPenalty = liveN > 0 ? 0.1 * (suspectN / liveN) : 0
      const placed = Object.values(p.board)
        .flat()
        .filter((c) => c.isSabotage && !c.attachedTo)
      if (placed.length === 0) {
        // Pas encore de Sabotage : gradient « éliminer les Coéquipiers tôt », plafonné
        // SOUS 0.4 pour que POSER un Sabotage reste toujours prioritaire à une élimination.
        return Math.max(0, 0.3 * (1 - liveN / totalN) - suspectPenalty)
      }
      // Sabotage posé : base 0.4, escalade à chaque tour survécu (compte `sabotageTurns`).
      const best = Math.max(...placed.map((c) => c.sabotageTurns ?? 0))
      return Math.max(0, Math.min(1, 0.4 + 0.6 * (best / Math.max(1, turns)) - suspectPenalty))
    }
    case 'DEPLETE_OBSERVATORY_AND_CAPTURE': {
      // Bowser : récompense l'épuisement de l'Observatoire (moins d'Étoiles =
      // plus proche, base 4) et la capture de Peach. Mario présent plafonne la
      // récompense (victoire impossible tant qu'il est là).
      const obj = p.objective
      const stars = p.observatoryStars ?? 0
      const depletion = stars <= 0 ? 1 : Math.max(0, 1 - stars / 4)
      // Peach capturée vaut 0.4 ; les Étoiles complètent le reste (0.6) → 1.0 quand
      // l'Observatoire est à 0 ET Peach capturée. Gradient intermédiaire : Peach
      // simplement PRÉSENTE dans le royaume (prête pour l'Impuissance) vaut déjà une
      // fraction — sinon le plan « chercher Peach (Bowser Jr.) → la capturer » n'aurait
      // aucun palier et resterait hors de portée de la recherche.
      let s = 0.6 * depletion
      if (p.peachCaptured) s += 0.4
      else if (
        Object.values(p.board).some((cards) =>
          cards.some((c) => c.type === 'hero' && isCaptureTargetHero(p.villain, c.cardId)),
        )
      )
        s += 0.15
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
      // Localise Kuzco (cible) et Kronk (Allié). « Prêt » = même lieu ET Kronk assez
      // fort pour l'éliminer (force brute — approximation pour une jauge).
      let kuzco: CardInstance | undefined
      let kuzcoLoc: string | undefined
      let kronk: CardInstance | undefined
      let kronkLoc: string | undefined
      for (const l of p.locations) {
        for (const c of p.board[l.id] ?? []) {
          if (c.cardId === obj.heroCardId) { kuzco = c; kuzcoLoc = l.id }
          else if (c.cardId === obj.allyCardId) { kronk = c; kronkLoc = l.id }
        }
      }
      if (kuzco && kronk) {
        const ready = kuzcoLoc === kronkLoc && (kronk.strength ?? 0) >= (kuzco.strength ?? 0)
        return ready ? 0.85 : 0.5
      }
      if (kuzco || kronk) return 0.3
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
        // Côté « Le Rat » : éliminer Basil. Gradué par la capacité à le vaincre
        // (force d'Alliés réunie sur son lieu ÷ sa force), comme Crochet/Yzma.
        if (p.objectiveHeroDefeated) return 1
        let basil: CardInstance | undefined
        let basilLoc: string | undefined
        for (const l of p.locations) {
          for (const c of p.board[l.id] ?? []) {
            if (c.type === 'hero' && c.cardId === obj.altHeroCardId) { basil = c; basilLoc = l.id }
          }
        }
        if (!basil || !basilLoc) {
          s = 0.2 // Basil pas encore en jeu
        } else {
          const allyForce = (p.board[basilLoc] ?? [])
            .filter((c) => c.type === 'ally' && !c.isWicket && !c.trapped)
            .reduce((n, c) => n + (c.strength ?? 0), 0)
          const readiness = Math.min(1, allyForce / Math.max(1, basil.strength ?? 1))
          s = 0.4 + 0.4 * readiness // présent 0.4 → prêt à le vaincre 0.8
        }
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
    case 'COMPLETE_GOAL_TOKENS': {
      // Pat Hibulaire : moyenne sur les 4 tuiles. Une tuile remplie = 1 ; sinon
      // sa proximité ∈ [0, 0.95] (plafonnée pour rester sous une tuile complétée).
      const goals = p.goals ?? []
      if (goals.length === 0) return 0
      const cap = (x: number) => Math.min(0.95, x)
      let score = 0
      for (const g of goals) {
        if (g.completed) { score += 1; continue }
        const cell = p.board[g.locationId] ?? []
        switch (g.kind) {
          case 'round-up': {
            // Alliés de force totale ≥ 10 sur le lieu.
            const force = cell
              .filter((c) => c.type === 'ally')
              .reduce((n, c) => n + (c.strength ?? 0), 0)
            score += cap(force / 10)
            break
          }
          case 'strike-it-rich': {
            // ≥ 3 Objets (non associés) sur le lieu.
            const items = cell.filter((c) => c.type === 'item' && !c.attachedTo).length
            score += cap(items / 3)
            break
          }
          case 'rule-the-realm': {
            // Plus d'Alliés que de Héros sur CHAQUE lieu du royaume.
            const ok = p.locations.filter((l) => {
              const here = p.board[l.id] ?? []
              const allies = here.filter((c) => c.type === 'ally').length
              const heroes = here.filter((c) => c.type === 'hero').length
              return allies > heroes
            }).length
            score += cap(ok / p.locations.length)
            break
          }
          // Win Big / Power Play : déclenchées en une seule action → binaires.
          case 'win-big':
          case 'power-play':
            break
        }
      }
      // Mickey (Héros bloqueur) présent : AUCUNE tuile ne peut être complétée tant
      // qu'il est là → la vraie proximité de victoire s'effondre. On plafonne la
      // jauge (comme un objectif « Vaincre un Héros » bloqué) pour que le bot voie
      // la valeur de POSER Mickey en Fatalité (gros déni) et, jouant Pat, la priorité
      // de l'éliminer. Sans ça, 3 tuiles « remplies » donnaient ~0,9 malgré le blocage.
      const raw = score / goals.length
      return goalsBlockedByHero(p) ? Math.min(0.4, raw) : raw
    }
    case 'CONFIANCE_THRESHOLD':
      // Jauge linéaire : la Confiance est directement le compteur de victoire.
      return Math.min(p.confiance ?? 0, p.objective.threshold) / p.objective.threshold
    case 'PUPPY_THRESHOLD': {
      // Cruella — jauge surtout pilotée par les Chiots CAPTURÉS (le compteur de
      // victoire), avec un petit crédit pour les Tuiles déjà POSÉES (à portée de
      // capture) afin d'encourager à amener des Chiots avant de les capturer.
      const tiles = p.puppyTiles ?? []
      const captured = tiles.filter((t) => t.state === 'captured').reduce((n, t) => n + t.value, 0)
      const onBoard = tiles.filter((t) => t.state === 'board').reduce((n, t) => n + t.value, 0)
      const thr = p.objective.threshold
      return Math.min(1, (captured + 0.25 * onBoard) / thr)
    }
    case 'CAULDRON_BORN_EVERYWHERE': {
      // Le Seigneur des Ténèbres : la victoire = un Mort-vivant du Chaudron par lieu.
      // Pilotée surtout par ce compte, mais on crédite les étapes préalables (poser des
      // Anciens Soldats, s'emparer du Chaudron, l'activer) pour guider tout le parcours.
      const total = Math.max(1, p.locations.length)
      const born = p.locations.filter((l) =>
        (p.board[l.id] ?? []).some((c) => c.cardId === 'cauldron-born' && c.type === 'ally' && !c.attachedTo),
      ).length
      if (born >= total) return 1
      const soldiers = p.locations.filter((l) =>
        (p.board[l.id] ?? []).some((c) => c.cardId === 'ancient-soldiers' && c.type === 'item' && !c.attachedTo),
      ).length
      let s = 0.6 * (born / total) + 0.15 * (soldiers / total)
      if (p.blackCauldron === 'claimed') s += 0.1
      if (p.blackCauldron === 'powered') s += 0.15
      return Math.min(0.99, s)
    }
    case 'DEFEAT_ALL_MERLIN': {
      // Madame Mim : proportion des 7 Métamorphoses de Merlin vaincues (merlinDiscard),
      // + bonus de POSITIONNEMENT — une défaite n'est possible que si la Métamorphose Mim
      // tueuse est SUR LE MÊME LIEU que le Merlin. On valorise donc fortement la
      // co-localisation (défaite imminente, « machine gun ») > simple disponibilité
      // ailleurs/en main. Conséquence : côté Mim le bot rassemble Mim et Merlin (Cabane) ;
      // côté Fatalité adverse, l'éval valorise d'ÉLOIGNER le Merlin de sa tueuse
      // (Le Savoir conduit à la Puissance) ou de DÉFAUSSER cette tueuse (Merlin Microbe).
      const TOTAL = 7
      const defeated = p.merlinDiscard?.length ?? 0
      if (defeated >= TOTAL) return 1
      // Localiser le Merlin actuellement en jeu (au Lieu du Duel sauf déplacement Fatalité).
      let merlinLoc: string | undefined
      let current: CardInstance | undefined
      for (const [loc, cards] of Object.entries(p.board)) {
        const m = cards.find((c) => c.isMerlinTransformation)
        if (m) {
          merlinLoc = loc
          current = m
          break
        }
      }
      let bonus = 0
      if (current && merlinLoc) {
        const killerHere = (p.board[merlinLoc] ?? []).some(
          (c) => c.isMimTransformation && c.transformationTarget === current!.cardId,
        )
        const killerReady = [...Object.values(p.board).flat(), ...p.hand].some(
          (c) => c.isMimTransformation && c.transformationTarget === current!.cardId,
        )
        bonus = killerHere ? 0.12 : killerReady ? 0.05 : 0
        // Staging « machine gun » : d'autres Métamorphoses Mim déjà postées au lieu du
        // Merlin enchaîneront les défaites (chaque Mim donne sa propre action Éliminer).
        const stagedKillers = (p.board[merlinLoc] ?? []).filter((c) => c.isMimTransformation).length
        bonus += 0.02 * Math.min(3, Math.max(0, stagedKillers - 1))
      }
      return Math.min(0.99, defeated / TOTAL + bonus)
    }
    case 'DEFEAT_OMNIDROID_V10': {
      // Syndrome : progression v.X8 → v.X9 → v.10 → détruit, modulée par la présence de
      // la Télécommande et l'absence de Héros (l'objectif exige un royaume sans Héros).
      const stage = p.omnidroidStage
      const heroCount = Object.values(p.board).flat().filter((c) => c.type === 'hero').length
      if (stage === 'destroyed') {
        // Victoire = v.10 détruit ET royaume sans Héros. Chaque Héros restant = un Vanquish
        // à faire → on s'éloigne légèrement de la victoire (et l'adversaire a intérêt à
        // l'engorger de Héros, cf. guide « bog him down »).
        return heroCount === 0 ? 1 : Math.max(0.85, 0.96 - 0.03 * heroCount)
      }
      const base: Record<string, number> = { x8: 0.1, 'x9-hand': 0.25, x9: 0.4, 'x10-hand': 0.6, x10: 0.8 }
      let s = base[stage ?? 'x8'] ?? 0.1
      if (stage === 'x10') {
        // Télécommande PRÊTE = sur le MÊME lieu que l'Omnidroïde v.10 (Métroville,
        // activation imminente) > simplement disponible (main/jeu) > absente.
        let v10Loc: string | undefined
        for (const [loc, cards] of Object.entries(p.board)) {
          if (cards.some((c) => c.cardId === 'omnidroide-v-x10')) {
            v10Loc = loc
            break
          }
        }
        const remoteWithV10 = !!v10Loc && (p.board[v10Loc] ?? []).some((c) => c.cardId === 'telecommande-de-syndrome')
        const remoteReady = [...p.hand, ...Object.values(p.board).flat()].some((c) => c.cardId === 'telecommande-de-syndrome')
        s = remoteWithV10 ? 0.93 : remoteReady ? 0.86 : 0.8
        // « Save the Day » : tous les Héros doivent être éliminés AVANT la victoire.
        s -= Math.min(0.1, 0.025 * heroCount)
      }
      return Math.min(0.99, Math.max(0, s))
    }
    case 'LOTSO_GATHER': {
      // Lotso : pipeline en 3 phases (cf. guide) — (1) faire VENIR les 4 Héros en jeu,
      // (2) les CORRALER sur la Salle des Chenilles, (3) réduire leur force à 0. Victoire
      // quand les 4 sont dans la Salle à force 0 avec Buzz. On récompense chaque palier
      // (gradient continu) — sans ça, un Héros en jeu non réduit ne vaudrait RIEN tout en
      // étant pénalisé par le terme générique « Héros dans mon royaume » (alors qu'ici
      // c'est une CIBLE d'objectif). Force effective approximée (base + jetons − Chapeau).
      const obj = p.objective
      const room = p.board[obj.roomId] ?? []
      const all = Object.values(p.board).flat()
      const hat = all.some((c) => c.cardId === 'chapeau-de-woody')
      const eff = (c: { strength?: number; permanentStrengthDelta?: number; cardId: string }) =>
        Math.max(0, (c.strength ?? 0) + (c.permanentStrengthDelta ?? 0) + (hat && c.cardId !== 'woody' ? -1 : 0))
      const buzzHere = room.some((c) => c.isBuzz)
      let s = 0
      let doneInRoom = 0
      for (const id of obj.heroCardIds) {
        const h = all.find((c) => c.type === 'hero' && c.cardId === id)
        if (!h) continue // pas encore en jeu
        s += 0.04 // phase 1 : présent dans le royaume
        const inRoom = room.some((c) => c.instanceId === h.instanceId)
        if (inRoom) s += 0.04 // phase 2 : corralé sur la Salle des Chenilles
        if (eff(h) === 0) {
          s += inRoom ? 0.1 : 0.03 // phase 3 : force 0 (surtout s'il est déjà dans la Salle)
          if (inRoom) doneInRoom++
        }
      }
      if (buzzHere) s += 0.08
      if (doneInRoom === obj.heroCardIds.length && buzzHere) return 1
      return Math.min(0.99, s)
    }
    case 'PIEGEUR_ELIMINATE_ALL_SURVIVORS': {
      // Le Piégeur : proximité = fraction des 4 Survivants éliminés + progression graduée
      // sur les vivants (révélé < blessé < critique < accroché < vies perdues). Jauge de
      // Phase 1 (tuning fin en Phase 3). Poids par état/étape, plafonné < 1 par survivant.
      const TOTAL = 4
      const living = [...Object.values(p.board).flat().filter((c) => c.isSurvivor), ...(p.survivorPile ?? [])]
      const eliminated = Math.max(0, TOTAL - living.length)
      let s = eliminated
      for (const c of living) {
        let prog = c.revealed ? 0.1 : 0
        if (c.survivorState === 'injured') prog = Math.max(prog, 0.35)
        else if (c.survivorState === 'critical') prog = Math.max(prog, 0.55)
        if (c.onHook) prog = Math.max(prog, 0.7 + ((3 - (c.survivorLives ?? 3)) / 3) * 0.25)
        s += Math.min(0.95, prog)
      }
      const score = s / TOTAL
      return eliminated >= TOTAL ? 1 : Math.min(0.99, score)
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
  myCoveredAction: number // pénalité par action de la rangée HAUTE recouverte par un Héros sur MON plateau (au-delà de la pénalité de force : incite à dégager les gêneurs)
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
  myCoveredAction: 0, // baseline : on n'évaluait pas le recouvrement de ses propres actions
}

/** Poids par défaut (tunés). Pouvoir conscient de l'objectif (Maléfique ne
 *  thésaurise plus) et Fatalité dévaluée (plus de guerre de Fatalité dégénérée). */
export const DEFAULT_WEIGHTS: EvalWeights = {
  objective: 1000,
  myPower: 6,
  oppPower: 5,
  fuelCap: 6,
  fuelPower: 3,
  // Au-delà du carburant plafonné (6), chaque JT vaut une miette (0,5) : sans effet
  // sur les vrais choix (objectif ×1000, Allié ×2…), mais suffisant pour que « banker
  // du pouvoir » batte toujours « ne rien faire ». Supprime les tours vides d'un
  // objectif non-pouvoir (Team Rocket au plafond passait des tours à idler faute de
  // gain valorisé) et oriente la figurine vers un lieu « Gagner » quand rien de mieux
  // n'est jouable — ce pouvoir accumulé finance ensuite les gros tours (Repérage, James…).
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
  // Un Héros qui recouvre les actions de la rangée HAUTE d'un de MES lieux me freine
  // (drainer/jouer/gagner y devient indisponible) au-delà de sa seule force. Petit
  // poids : incite à dégager les gêneurs (surtout pour un objectif non-Pouvoir, où la
  // pénalité de force seule — ×1 — ne suffit pas à motiver le Vanquish) sans pousser à
  // gaspiller des Alliés (le coût d'un Allié sacrifié, ×2, reste devant).
  myCoveredAction: 2,
  // Le bot privilégie SON objectif ; la Fatalité (Héros chez l'adversaire) n'est
  // pleinement valorisée que si la MENACE réelle est haute (progrès − malus). Plancher
  // bas : quand l'adversaire est déjà bien bloqué (menace ~0), le bot lâche presque
  // la Fatalité et se concentre sur son objectif (cf. mémoire « villainous-fate-malus »).
  fateThreatFloor: 0.25,
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

/** Plafond de carburant EFFECTIF, conscient de l'objectif. La plupart des objectifs
 *  non-pouvoir se contentent de `w.fuelCap` (au-delà, le pouvoir ne sert à rien). Mais
 *  certains DÉPENSENT le pouvoir par grosses rafales en un seul tour → un plafond bas
 *  les fait « idler » dès qu'ils l'atteignent (Team Rocket au plafond passait des tours
 *  vides). On relève donc le plafond pour ces objectifs afin qu'ils BANKENT de quoi
 *  financer un gros tour (Team Rocket : Repérage 3 + James 2 + Allié 2 + … ≈ 10). Reste
 *  BORNÉ (pas de résidu illimité → aucune thésaurisation ni livelock). */
function fuelCapFor(p: PlayerState, w: EvalWeights): number {
  if (w.fuelCap === Infinity) return Infinity
  if (p.objective.type === 'CAPTURE_POKEMON') return Math.max(w.fuelCap, 10)
  return w.fuelCap
}

/** Valeur du pouvoir pour un joueur, consciente de l'objectif. Pour un objectif
 *  de POUVOIR : pouvoir = progrès (plafonné au seuil). Sinon : simple carburant
 *  (utile jusqu'au plafond effectif, au-delà sans valeur). `mult` = poids du camp. */
function powerValue(p: PlayerState, w: EvalWeights, mult: number): number {
  if (p.objective.type === 'POWER_THRESHOLD') {
    const eff = w.fuelCap === Infinity ? p.power : Math.min(p.power, p.objective.threshold)
    return eff * mult
  }
  const cap = fuelCapFor(p, w)
  return Math.min(p.power, cap) * (cap === Infinity ? mult : w.fuelPower)
}

/** Évalue la position du joueur `idx` (plus c'est haut, mieux c'est pour lui). */
export function evaluate(state: GameState, idx: number, w: EvalWeights = DEFAULT_WEIGHTS): number {
  if (state.status === 'WON') return state.winner === idx ? 1e9 : -1e9
  const me = state.players[idx]
  const oppIdx = (idx + 1) % state.players.length
  const opp = state.players[oppIdx]
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
      // Un Héros-CIBLE de capture (Peach chez Bowser) présent dans mon royaume est un
      // ATOUT, pas une gêne → pas de pénalité (le gradient est porté par objectiveScore).
      // Idem pour un SURVIVANT du Piégeur : c'est une CIBLE à éliminer, pas une menace
      // (sa progression révélé/blessé/critique/accroché est portée par objectiveScore).
      else if (c.type === 'hero' && !isCaptureTargetHero(me.villain, c.cardId) && !c.isSurvivor)
        score -= (c.strength ?? 0) * myHeroPerStr + w.myHeroFlat
    }
  }
  // Actions de la rangée HAUTE recouvertes par des Héros sur MON plateau : chaque action
  // indisponible me freine (drainer une Étoile, Jouer, Gagner…). Au-delà de la pénalité de
  // force du Héros — décisive pour un objectif non-Pouvoir où cette pénalité seule (×1) ne
  // motive pas assez le Vanquish (cf. Bowser qui hésitait à dégager Mario & co.).
  // Approximation LÉGÈRE de `coveredTopActionIdsAt` (pas le scan agrandissement/coéquipiers,
  // rares) : `evaluate` est dans la boucle chaude de la recherche → on reste en O(cartes).
  if (w.myCoveredAction) {
    let covered = 0
    for (const loc of me.locations) {
      const cards = me.board[loc.id]
      if (!cards || cards.length === 0) continue
      const coveringHero = cards.some(
        (c) =>
          (c.type === 'hero' && !c.hypnotized && !c.pokemonKO && c.cardId !== 'the-prince') ||
          (c.isBuzz && c.buzzMode === 'guardian') ||
          (c.coversActionsLikeHero && !c.attachedTo),
      )
      if (coveringHero) {
        for (const a of loc.actions) if (a.row === 'top') covered++
      }
    }
    score -= covered * w.myCoveredAction
  }
  // Lieux maudits (objectif Maléfique + tempo), comptés PAR LIEU (empiler n'aide pas).
  score += cursedLocationCount(me) * w.cursePerLocation
  // Couche « stratégie bot » : conseils de jeu propres au vilain (placements
  // préférés, Héros à vaincre en priorité, cartes-moteurs). Cf. villainStrategy.ts.
  score += villainStrategyBonus(me)
  // Le Piégeur — bonus POSITIONNEL : le pion sur un lieu portant un Survivant sur lequel il
  // peut agir (face cachée → révéler ; révélé → blesser ; critique + crochet actif →
  // accrocher) le rapproche d'une action d'attaque. Petit poids (le gradient d'élimination
  // reste porté par objectiveScore) pour que le bot aille CHASSER plutôt qu'errer.
  if (me.objective.type === 'PIEGEUR_ELIMINATE_ALL_SURVIVORS' && me.pawnLocation) {
    const here = me.board[me.pawnLocation] ?? []
    const hookOk = !!me.hooks?.[me.pawnLocation]?.present && me.hooks[me.pawnLocation].disabledTurns === 0
    let posBonus = 0
    for (const c of here) {
      if (!c.isSurvivor) continue
      if (!c.revealed) posBonus += 2
      else if (c.survivorState === 'critical') posBonus += hookOk ? 4 : 2
      else posBonus += 3
    }
    score += Math.min(posBonus, 8)
  }
  // Bowser — positionnement des Alliés autour de l'Observatoire. Tant qu'il RESTE des
  // Étoiles, l'Observatoire n'est PAS verrouillé → Luigi peut y débarquer et défausser
  // TOUS les Alliés du lieu (renvoyant leurs Étoiles à l'Observatoire). D'où deux
  // consignes opposées selon que l'Allié a déjà drainé une Étoile ou non :
  //  - Allié SANS Étoile : le rassembler SUR l'Observatoire (prêt à drainer — épuisement
  //    d'énergie exige un Allié présent ; Dino Piranha/Kamella y drainent à la pose).
  //  - Allié PORTEUR d'Étoile : l'ÉLOIGNER de l'Observatoire (à l'abri du piège de Luigi).
  // Une fois l'Observatoire à 0 (verrouillé), ce lieu et ses Alliés sont protégés → on
  // n'applique plus ces consignes (bloc entier sauté).
  // Un « renvoyeur d'Étoile » présent dans MON royaume (Mario/Harmonie à la pose, Luigi
  // sur ses Alliés) va remettre à l'Observatoire toute Étoile posée sur un Allié → tant
  // qu'il est là, une Étoile sur un Allié n'est PAS sûre : seule une Étoile BANKÉE
  // (retirée du jeu au Vanquish) constitue un progrès verrouillé. C'est LA clé pour
  // clôturer contre la boucle de renvoi (cf. parties qui n'aboutissaient jamais).
  const starReturnerPresent =
    me.objective.type === 'DEPLETE_OBSERVATORY_AND_CAPTURE' &&
    Object.values(me.board)
      .flat()
      .some((c) => c.type === 'hero' && (c.cardId === 'mario' || c.cardId === 'harmonie' || c.cardId === 'luigi'))
  if (me.objective.type === 'DEPLETE_OBSERVATORY_AND_CAPTURE' && (me.observatoryStars ?? 0) > 0 && me.starLocationId) {
    let readyToDrain = 0 // Alliés sans Étoile sur l'Observatoire
    let starCarriersSafe = 0 // Alliés porteurs d'Étoile hors de l'Observatoire
    for (const [locId, cards] of Object.entries(me.board)) {
      for (const c of cards) {
        if (c.type !== 'ally' || c.isWicket || c.attachedTo) continue
        const hasStar = (c.stars ?? 0) > 0
        if (locId === me.starLocationId) {
          if (!hasStar) readyToDrain++
        } else if (hasStar) {
          starCarriersSafe++
        }
      }
    }
    score += Math.min(readyToDrain, 3) * 4
    // Le « positionnement sûr » d'un porteur d'Étoile est une illusion tant qu'un renvoyeur
    // est là (il la reprendra où qu'elle soit) → on n'en récompense la mise à l'abri que
    // SANS renvoyeur ; avec renvoyeur, c'est le banking (ci-dessous) qui prime.
    if (!starReturnerPresent) score += Math.min(starCarriersSafe, 3) * 3
  }
  // Bowser — sécurisation des Étoiles. Une Étoile posée sur un Allié est drainée (elle
  // compte déjà pour l'objectif) mais reste RÉCUPÉRABLE : une Fatalité (grande étoile,
  // Luigi, Mario) peut la renvoyer à l'Observatoire. Une Étoile DÉFAUSSÉE avec l'Allié
  // (au Vanquish) quitte définitivement le jeu → épuisement verrouillé. On récompense les
  // Étoiles ainsi retirées du jeu pour qu'à Vanquish égal le bot préfère y consacrer un
  // Allié PORTEUR d'Étoile — FORTEMENT quand un renvoyeur est présent (banker devient la
  // SEULE façon de progresser : sacrifier le porteur, idéalement EN vainquant le renvoyeur).
  if (me.objective.type === 'DEPLETE_OBSERVATORY_AND_CAPTURE') {
    const TOTAL_STARS = 4 // l'Observatoire de la Comète démarre à 4 (VillainDef.starSetup)
    const starsOnAllies = Object.values(me.board)
      .flat()
      .reduce((n, c) => n + (c.type === 'ally' ? c.stars ?? 0 : 0), 0)
    const banked = Math.max(0, TOTAL_STARS - (me.observatoryStars ?? 0) - starsOnAllies)
    // Sans renvoyeur : poids modéré (une Étoile sur Allié est presque aussi bien). Avec
    // renvoyeur : poids fort (> coût d'un Allié sacrifié, myAllyStr×force) → le bot sacrifie
    // ses porteurs d'Étoile pour verrouiller, plutôt que de les garder à portée du renvoi.
    score += banked * (starReturnerPresent ? 12 : 6)
  }
  // Héros dans le royaume ADVERSE : bon pour le bot (ils gênent l'adversaire). On
  // MODULE leur valeur par la MENACE RÉELLE adverse = progrès objectif − malus déjà
  // subi (Fatalités durables dans son royaume : Mario, etc.). Si l'adversaire est
  // déjà bien bloqué (malus élevé), la menace tombe → le bot ne s'acharne plus en
  // Fatalité et développe SON objectif. `w.fateThreatFloor` = part minimale gardée.
  const oppThreat = Math.max(0, oppObj - playerMalus(state, oppIdx))
  const fateScale = w.fateThreatFloor + (1 - w.fateThreatFloor) * oppThreat
  for (const cards of Object.values(opp.board)) {
    for (const c of cards) {
      // Un Héros-cible de capture dans le royaume adverse (Peach chez un Bowser
      // adverse) l'AIDE : ce n'est pas un « déni » à valoriser (sa menace accrue est
      // déjà portée en négatif par l'objectiveScore adverse ci-dessus).
      if (c.type === 'hero' && !isCaptureTargetHero(opp.villain, c.cardId))
        score += ((c.strength ?? 0) * oppHeroPerStr + w.oppHeroFlat) * fateScale
    }
  }
  // Ciblage Fatalité propre au vilain adverse : Déguisement sur le bon Héros, Pouvoir
  // volé sur le bon porteur (départage les cibles, que le terme objectif ne distingue
  // pas). Modulé par la menace, comme les autres termes de Fatalité. Cf. villainStrategy.
  score += villainFateTargetingBonus(opp) * fateScale
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
 * Vrai si fataliser l'adversaire `oppIdx` LUI rendrait service en faisant entrer
 * en jeu le Héros-clé (cible de son objectif) qu'il doit éliminer/capturer/contrôler
 * mais qui est encore absent — car cette cible vit dans SA pioche Fatalité. Tant
 * que c'est vrai, le bot s'abstient de fataliser (cf. mémoire « villainous-fate-malus »).
 * Piloté par le type d'objectif, donc générique pour tout futur vilain similaire.
 */
export function fateWouldHelpOpponent(state: GameState, oppIdx: number): boolean {
  const opp = state.players[oppIdx]
  const inRealm = (cardId: string) =>
    Object.values(opp.board).some((cards) => cards.some((c) => c.cardId === cardId))
  const obj = opp.objective
  switch (obj.type) {
    case 'DEFEAT_HERO_AT_LOCATION': // Crochet/Peter Pan ; Méchante Reine/Blanche-Neige
      // Ces Héros-clés sont JOUÉS D'OFFICE dès qu'ils sont dévoilés (forcedFateLocation) :
      // fataliser pendant qu'ils sont encore en pioche risque vraiment de les gifter.
      return !inRealm(obj.heroCardId)
    case 'DEFEAT_HERO_WITH_ALLY':
      // Yzma/Kuzco : sa Fatalité est INTERACTIVE (le fataliseur choisit la pioche ET la
      // carte parmi 4 pioches) → il peut éviter de jouer Kuzco, et l'éval du bot l'évite
      // déjà (jouer Kuzco augmente la jauge d'Yzma ; le lookahead ne fatalise pas si ça
      // se retourne contre lui). On NE s'abstient donc PAS (cf. guide : « fatalisez Yzma
      // pour scruter ses pioches » et y jouer les enfants / En fuite / Chemin de la droiture).
      return false
    case 'DEPLETE_OBSERVATORY_AND_CAPTURE': // Bowser/Peach (ni en jeu ni capturée)
      return !opp.peachCaptured && !inRealm('peach')
    case 'SUCCESSION_FORCE': {
      // Scar/Mufasa : risque de « cadeau » seulement tant que Mufasa peut encore
      // SORTIR de la pioche Fatalité. Une fois qu'il est EN JEU (royaume) ou déjà dans
      // la pile Succession, le fataliser ne le gifte plus → le bot peut/doit fataliser
      // (cf. guide : envoyer des Héros avant que la pile ne démarre).
      const mufasaInSucc = (opp.succession ?? []).some((c) => c.cardId === obj.firstHeroCardId)
      return !inRealm(obj.firstHeroCardId) && !mufasaInSucc
    }
    default:
      return false
  }
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
  let candidates = enumerateActions(state)

  // Anti-victoire : si l'adversaire a DÉJÀ atteint son objectif (il gagnera au
  // début de son prochain tour), le bot doit le fataliser CE tour-ci si possible.
  // On restreint alors les coups à : (1) une action Fatalité disponible tout de
  // suite, sinon (2) un déplacement qui rend une Fatalité possible ce tour. La
  // recherche de tour choisit ensuite la meilleure option de ce sous-ensemble.
  const oppIdx = (idx + 1) % state.players.length
  // « Proche de gagner » : l'adversaire n'a pas ENCORE atteint son objectif mais
  // sa jauge est très haute, il n'est pas déjà bien gêné par mes Fatalités durables,
  // et JE suis en retard sur lui. Dans ce cas le bot privilégie la Fatalité CE tour
  // (sinon il finit par se laisser dépasser) — sauf s'il est devant/à égalité, où il
  // vaut mieux courir à sa propre victoire que de perdre un tour à fataliser.
  const oppNearWin =
    objectiveScore(state.players[oppIdx]) >= 0.9 &&
    playerMalus(state, oppIdx) < 0.5 &&
    objectiveScore(state.players[idx]) < objectiveScore(state.players[oppIdx])
  if (fateWouldHelpOpponent(state, oppIdx)) {
    // Évitement : fataliser donnerait à l'adversaire son Héros-clé encore absent
    // (Mufasa/Scar, Peter Pan/Crochet, Peach/Bowser, Blanche-Neige/Méch. Reine,
    // Kuzco/Yzma) → le bot ne fatalise pas tant que ce Héros n'est pas déjà en jeu.
    candidates = candidates.filter((a) => a.type !== 'FATE')
  } else if (hasReachedObjective(state, oppIdx) || oppNearWin) {
    // Anti-victoire : si l'adversaire a DÉJÀ atteint son objectif (il gagnera au
    // début de son prochain tour) OU s'il en est très proche (oppNearWin), le bot
    // doit le fataliser CE tour-ci si possible. On restreint alors les coups à :
    // (1) une action Fatalité disponible tout de suite, sinon (2) un déplacement qui
    // rend une Fatalité possible ce tour. La recherche de tour choisit ensuite la
    // meilleure option de ce sous-ensemble.
    const fatesNow = candidates.filter((a) => a.type === 'FATE')
    if (fatesNow.length > 0) {
      candidates = fatesNow
    } else {
      const movesToFate = candidates.filter((a) => {
        if (a.type !== 'MOVE') return false
        try {
          return enumerateActions(applyAction(state, a)).some((b) => b.type === 'FATE')
        } catch {
          return false
        }
      })
      if (movesToFate.length > 0) candidates = movesToFate
    }
  }

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
  const chosen = best.length === 0 ? { type: 'END_TURN' as const } : pick(best, rand)
  // Anti-thésaurisation : si le bot en a fini pour ce tour (END_TURN) mais garde une main
  // au-delà de sa limite (pioches en cours de tour non jouées — Galaxie hantée, Bowser Jr.
  // fatalisé…), il défausse d'abord l'excédent (les cartes les moins importantes) au lieu de
  // l'empiler. Bot only (l'humain choisit lui-même) → géré ici, pas dans le moteur.
  if (chosen.type === 'END_TURN' && state.phase === 'ACTION') {
    const trim = trimHandAction(state, idx)
    if (trim) return trim
  }
  return chosen
}

/** Coup de défausse de l'EXCÉDENT de main du bot (au-delà de sa limite), ou null si
 *  la main tient dans la limite. Jette les cartes les MOINS importantes : les cartes
 *  cruciales pour l'objectif sont gardées en dernier (poids énorme), puis on privilégie
 *  les moteurs (enginePieces), les gros Alliés et les Objets chers. Exporté pour les tests. */
export function trimHandAction(state: GameState, idx: number): GameAction | null {
  const me = state.players[idx]
  const excess = me.hand.length - handLimitFor(me)
  if (excess <= 0) return null
  const critical = objectiveCriticalCardIds(me)
  const engine = VILLAIN_STRATEGY[me.villain]?.enginePieces
  const keepValue = (c: CardInstance): number => {
    if (critical.has(c.cardId)) return 100_000
    let v = (engine?.[c.cardId] ?? 0) * 10
    if (c.type === 'ally') v += (c.strength ?? 0) * 2
    else if (c.type === 'item') v += c.cost ?? 0
    else v += 1 // Événements / Conditions : valeur de base faible
    return v
  }
  const toDiscard = [...me.hand]
    .sort((a, b) => keepValue(a) - keepValue(b)) // moins importantes d'abord
    .slice(0, excess)
    .map((c) => c.instanceId)
  return { type: 'DISCARD_HAND_CARDS', instanceIds: toDiscard }
}

/** Construit l'action PLAY_CONDITION pour une Condition donnée (cibles auto). */
function buildConditionAction(
  state: GameState,
  playerIndex: number,
  card: PlayerState['hand'][number],
  rand: Rand,
): GameAction | null {
  if (card.cardId === 'lachete' || card.cardId === 'ruse' || card.cardId === 'renforts' || card.cardId === 'intrus-dans-le-monde-a-l-envers') {
    // Lâcheté / Ruse / Renfort / Intrus : pose gratuitement l'Allié le plus fort.
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
  if (card.cardId === 'mechancete' || card.cardId === 'ferocite' || card.cardId === 'affront') {
    // Vaincre un Héros : Méchanceté ≤4, Férocité/Affront ≤3. Cible le plus fort éligible.
    const maxStr = card.cardId === 'mechancete' ? 4 : 3
    const heroes = Object.values(state.players[playerIndex].board)
      .flat()
      .filter((c) => c.type === 'hero' && (c.strength ?? 0) <= maxStr)
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
