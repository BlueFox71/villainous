// =============================================================================
// Store Zustand — pont entre l'UI et le moteur.
//
// IMPORTANT : ce store ne contient AUCUNE logique de jeu. Il se contente de
// stocker le GameState et de déléguer chaque coup à applyAction() du moteur.
// Toute la règle vit dans engine/. On pourrait remplacer Zustand par autre
// chose sans toucher au moteur.
// =============================================================================

import { create } from 'zustand'
import type { CardInstance, FighterColor, GameAction, GameState, KeyColor, LocationId } from '../../engine/types'
import {
  createInitialGame,
  drawPlayerToLimit,
  pushDiscardShowcase,
  pushShowcase,
  type PlayerSetup,
} from '../../engine/state'
import { applyAction } from '../../engine/actions'
import { chooseAction, chooseReaction } from '../../ai/heuristicBot'
import { connect, type Connection, type ConnectionHandlers } from '../../net/connection'
import { connectPeer, createPeerFactory } from '../../net/peerConnection'
import { createClientSession, createHostSession, type ClientSession, type HostSession, type Session } from '../../net/session'
import type { LobbySeat } from '../../net/messages'
import { isTauri, ensureRelay, lanAddresses } from '../../net/desktop'
import { buildDeckInstances } from '../../data/types'
import { drawSharedMarvelFateAddons } from '../../data/marvelFate'
import { getCardDef, registerCustomCardDefs } from '../../data/registry'
import { toVillainDef, toCardDefs, toDeckCardDefs, CUSTOM_ID_PREFIX, type CustomVillain } from '../../data/customVillain'
import { CUSTOM_DIO_ID, patchCustomDio } from '../../data/villains/customDio'
import { CUSTOM_PYRAMID_HEAD_ID, patchCustomPyramidHead } from '../../data/villains/customPyramidHead'
import { CUSTOM_MONOPOLY_ID, patchCustomMonopoly } from '../../data/villains/customMonopoly'
import { CUSTOM_GULDAN_ID, patchCustomGuldan } from '../../data/villains/customGuldan'
import { CUSTOM_ISABELLA_ID, patchCustomIsabella } from '../../data/villains/customIsabella'
import { CUSTOM_PIEGEUR_ID, patchCustomPiegeur } from '../../data/villains/customPiegeur'
import type { VillainDef } from '../../engine/types'
import type { CardDef } from '../../data/types'
import { customActionPositions } from '../editor/boardLayout'
import { registerActionPos } from '../components/customActionPos'
import { VILLAIN_COLOR, VILLAIN_COVER_COLOR } from '../villainColors'
import { usePlayerStore } from './playerStore'
import { loadSavedGame, saveGame, snapshotForSave, reinjectVillainImages, clearSavedGame } from './gamePersistence'
import { TUTORIAL_STEPS } from '../tutorial/steps'
import { princeJohn } from '../../data/villains/princeJohn'
import { princeJohnCards } from '../../data/villains/princeJohn.cards'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { slenderman } from '../../data/villains/slenderman'
import { slendermanCards } from '../../data/villains/slenderman.cards'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { crochet } from '../../data/villains/crochet'
import { crochetCards } from '../../data/villains/crochet.cards'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { hades } from '../../data/villains/hades'
import { hadesCards } from '../../data/villains/hades.cards'
import { facilier } from '../../data/villains/facilier'
import { facilierCards } from '../../data/villains/facilier.cards'
import { imposteur } from '../../data/villains/imposteur'
import { imposteurCards } from '../../data/villains/imposteur.cards'
import { bowser } from '../../data/villains/bowser'
import { bowserCards } from '../../data/villains/bowser.cards'
import { tabbou } from '../../data/villains/tabbou'
import { tabbouCards } from '../../data/villains/tabbou.cards'
import { mechanteReine } from '../../data/villains/mechanteReine'
import { mechanteReineCards } from '../../data/villains/mechanteReine.cards'
import { scar } from '../../data/villains/scar'
import { scarCards } from '../../data/villains/scar.cards'
import { yzma } from '../../data/villains/yzma'
import { yzmaCards } from '../../data/villains/yzma.cards'
import { ratigan } from '../../data/villains/ratigan'
import { ratiganCards } from '../../data/villains/ratigan.cards'
import { sombra } from '../../data/villains/sombra'
import { sombraCards } from '../../data/villains/sombra.cards'
import { patHibulaire } from '../../data/villains/patHibulaire'
import { patHibulaireCards } from '../../data/villains/patHibulaire.cards'
import { gothel } from '../../data/villains/gothel'
import { gothelCards } from '../../data/villains/gothel.cards'
import { cruella } from '../../data/villains/cruella'
import { cruellaCards } from '../../data/villains/cruella.cards'
import { gaston } from '../../data/villains/gaston'
import { gastonCards } from '../../data/villains/gaston.cards'
import { seigneurCles } from '../../data/villains/seigneurCles'
import { seigneurClesCards } from '../../data/villains/seigneurCles.cards'
import { madameTremaine } from '../../data/villains/madameTremaine'
import { madameTremaineCards } from '../../data/villains/madameTremaine.cards'
import { oogieBoogie } from '../../data/villains/oogie-boogie'
import { oogieBoogieCards } from '../../data/villains/oogie-boogie.cards'
import { seigneurTenebres } from '../../data/villains/seigneurTenebres'
import { seigneurTenebresCards } from '../../data/villains/seigneurTenebres.cards'
import { madameMim } from '../../data/villains/madameMim'
import { madameMimCards } from '../../data/villains/madameMim.cards'
import { syndrome } from '../../data/villains/syndrome'
import { syndromeCards } from '../../data/villains/syndrome.cards'
import { lotso } from '../../data/villains/lotso'
import { lotsoCards } from '../../data/villains/lotso.cards'
import { saSucrerie } from '../../data/villains/sa-sucrerie'
import { saSucrerieCards } from '../../data/villains/sa-sucrerie.cards'
import { shereKhan } from '../../data/villains/shereKhan'
import { shereKhanCards } from '../../data/villains/shereKhan.cards'
import { davyJones } from '../../data/villains/davyJones'
import { davyJonesCards } from '../../data/villains/davyJones.cards'
import { tamatoa } from '../../data/villains/tamatoa'
import { tamatoaCards } from '../../data/villains/tamatoa.cards'
import { teamRocket } from '../../data/villains/team-rocket'
import { teamRocketCards } from '../../data/villains/team-rocket.cards'
import { laBonneFee } from '../../data/villains/la-bonne-fee'
import { laBonneFeeCards } from '../../data/villains/la-bonne-fee.cards'
import { thanos } from '../../data/villains/thanos'
import { thanosCards } from '../../data/villains/thanos.cards'
// Le Flagelleur Mental est un vilain de l'Atelier PUBLIÉ (custom-flagelleur-mental) —
// pas de fichier natif : chargé au runtime via customVillainStore (cf. CLAUDE.md).

/** Sélecteur de vilain (clé stable utilisée par l'UI). */
export type VillainKey = 'princeJohn' | 'maleficent' | 'slenderman' | 'jafar' | 'reineCoeur' | 'crochet' | 'ursula' | 'hades' | 'facilier' | 'imposteur' | 'bowser' | 'mechanteReine' | 'scar' | 'yzma' | 'ratigan' | 'sombra' | 'patHibulaire' | 'gothel' | 'cruella' | 'gaston' | 'seigneurCles' | 'madameTremaine' | 'oogieBoogie' | 'seigneurTenebres' | 'madameMim' | 'syndrome' | 'lotso' | 'saSucrerie' | 'shereKhan' | 'davyJones' | 'tamatoa' | 'teamRocket' | 'laBonneFee' | 'tabbou' | 'thanos'

export const VILLAIN_REGISTRY = {
  princeJohn: { def: princeJohn, cards: princeJohnCards, label: 'Prince Jean' },
  maleficent: { def: maleficent, cards: maleficentCards, label: 'Maléfique' },
  slenderman: { def: slenderman, cards: slendermanCards, label: 'Slenderman' },
  jafar: { def: jafar, cards: jafarCards, label: 'Jafar' },
  reineCoeur: { def: reineCoeur, cards: reineCoeurCards, label: 'Reine de Cœur' },
  crochet: { def: crochet, cards: crochetCards, label: 'Capitaine Crochet' },
  ursula: { def: ursula, cards: ursulaCards, label: 'Ursula' },
  hades: { def: hades, cards: hadesCards, label: 'Hadès' },
  facilier: { def: facilier, cards: facilierCards, label: 'Dr Facilier' },
  imposteur: { def: imposteur, cards: imposteurCards, label: "L'Imposteur" },
  bowser: { def: bowser, cards: bowserCards, label: 'Bowser' },
  tabbou: { def: tabbou, cards: tabbouCards, label: 'Tabbou' },
  mechanteReine: { def: mechanteReine, cards: mechanteReineCards, label: 'La Méchante Reine' },
  scar: { def: scar, cards: scarCards, label: 'Scar' },
  yzma: { def: yzma, cards: yzmaCards, label: 'Yzma' },
  ratigan: { def: ratigan, cards: ratiganCards, label: 'Ratigan' },
  sombra: { def: sombra, cards: sombraCards, label: 'Sombra' },
  patHibulaire: { def: patHibulaire, cards: patHibulaireCards, label: 'Pat Hibulaire' },
  gothel: { def: gothel, cards: gothelCards, label: 'Mère Gothel' },
  cruella: { def: cruella, cards: cruellaCards, label: 'Cruella d’Enfer' },
  gaston: { def: gaston, cards: gastonCards, label: 'Gaston' },
  seigneurCles: { def: seigneurCles, cards: seigneurClesCards, label: 'Le Seigneur des clés' },
  madameTremaine: { def: madameTremaine, cards: madameTremaineCards, label: 'Madame de Trémaine' },
  seigneurTenebres: { def: seigneurTenebres, cards: seigneurTenebresCards, label: 'Le Seigneur des Ténèbres' },
  madameMim: { def: madameMim, cards: madameMimCards, label: 'Madame Mim' },
  syndrome: { def: syndrome, cards: syndromeCards, label: 'Syndrome' },
  lotso: { def: lotso, cards: lotsoCards, label: 'Lotso' },
  oogieBoogie: { def: oogieBoogie, cards: oogieBoogieCards, label: 'Oogie Boogie' },
  saSucrerie: { def: saSucrerie, cards: saSucrerieCards, label: 'Sa Sucrerie' },
  shereKhan: { def: shereKhan, cards: shereKhanCards, label: 'Shere Khan' },
  davyJones: { def: davyJones, cards: davyJonesCards, label: 'Davy Jones' },
  tamatoa: { def: tamatoa, cards: tamatoaCards, label: 'Tamatoa' },
  teamRocket: { def: teamRocket, cards: teamRocketCards, label: 'Team Rocket' },
  laBonneFee: { def: laBonneFee, cards: laBonneFeeCards, label: 'Marraine la Bonne Fée' },
  thanos: { def: thanos, cards: thanosCards, label: 'Thanos' },
} as const

/** Vilains « collaboration » (hors univers Disney) — éditables/clonables dans l'Atelier. */
export const COLLAB_VILLAINS: VillainKey[] = [
  'slenderman',
  'imposteur',
  'teamRocket',
  'bowser',
  'sombra',
  'seigneurCles',
  'laBonneFee',
  'tabbou',
]

/** Vilains natifs d'origine MARVEL (catégorie dédiée dans la galerie). */
export const MARVEL_VILLAINS: VillainKey[] = ['thanos']

/** Vilains câblés mais NON encore publiés : masqués aux joueurs (galerie + choix de
 *  partie) tant qu'ils ne sont pas finis. Restent visibles en dév (patron `!isDesktopApp`,
 *  cf. dev-only-ui-gating) pour pouvoir continuer à les tester. Vider la liste = publier. */
export const UNRELEASED_VILLAINS: VillainKey[] = ['thanos']

/** Qui contrôle chaque siège. Concept d'UI : le moteur, lui, ne sait pas qui
 *  joue. 'local' = ce navigateur ; 'remote' = l'autre joueur (réseau, à venir) ;
 *  'bot' = l'IA. Source de vérité pour savoir quels sièges l'autorité auto-joue
 *  (bot) vs attend (local/remote). En solo : ['local', 'bot']. */
export type SeatController = 'local' | 'remote' | 'bot'

/** Configuration des sièges en partie solo (joueur 0 = humain local, 1 = bot). */
const SOLO_SEATS: [SeatController, SeatController] = ['local', 'bot']

/** Mode de partie : 'solo' (vs bot, local) ; 'host'/'client' (réseau). */
export type GameMode = 'solo' | 'host' | 'client'

/** Étape de la connexion réseau (pilote les écrans lobby / choix des vilains).
 *  'waiting' = connecté au relais, en attente de l'autre joueur ; 'lobby' = les
 *  deux présents, choix des vilains en direct ; 'playing' = partie lancée. */
export type NetStatus = 'idle' | 'connecting' | 'waiting' | 'lobby' | 'playing' | 'error'

/** Profil local (nom + avatar) à inscrire dans le lobby réseau ; nom undefined si
 *  non renseigné. */
function myProfile(): { name?: string; avatarVillain: string | null; avatarColor: string } {
  const p = usePlayerStore.getState()
  return { name: p.name.trim() || undefined, avatarVillain: p.avatarVillain, avatarColor: p.avatarColor }
}

/** Diffuse l'état du lobby (choix des vilains) à l'autre joueur. */
function sendLobby(seats: LobbySeat[]) {
  activeConnection?.send({
    type: 'LOBBY',
    seats,
    canStart: seats.every((s) => s.connected && !!s.villainKey),
  })
}

/** Port du relais (cf. relay/server.js) — l'hôte fait tourner `npm run relay`. */
const RELAY_PORT = 8787

/** Session réseau active. Hors de l'état réactif Zustand : c'est un objet à
 *  effets (sockets), pas une donnée sérialisable. `null` en solo. En réseau,
 *  l'hôte applique+diffuse via cette session ; le client envoie ses coups et
 *  reçoit l'état. Le store s'y branche dans submit() / le cycle de vie réseau. */
let activeSession: HostSession | Session | null = null
/** Connexion réseau active (relais). Idem : hors état réactif. */
let activeConnection: Connection | null = null

/** URL du relais. En WEB, l'invité ayant chargé l'app depuis l'hôte,
 *  `location.hostname` pointe déjà sur la machine hôte (override possible). En
 *  .exe (Tauri), `host` est fourni explicitement : 127.0.0.1 pour l'hôte (relais
 *  embarqué local), l'IP saisie pour l'invité. */
function relayUrl(host?: string): string {
  const h = host || (typeof location !== 'undefined' ? location.hostname : 'localhost')
  return `ws://${h}:${RELAY_PORT}`
}

/** Code de salon court (4 lettres, sans I/O/0/1 ambigus). */
function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

/** Ferme proprement la session/connexion réseau (sans toucher à l'état Zustand). */
function teardownNet() {
  activeConnection?.close()
  activeConnection = null
  activeSession = null
}

/** L'autre joueur est parti (LEAVE reçu) ou la connexion est tombée : on coupe et
 *  on renseigne l'avis (l'UI l'affichera puis renverra à l'accueil). Si la
 *  connexion a déjà été fermée de NOTRE côté (activeConnection null), on ignore
 *  — c'est nous qui sommes partis. */
function handlePeerGone(
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
  notice: string,
) {
  if (!activeConnection) return
  // Seulement si on était réellement en lobby/partie (sinon c'est un échec de
  // connexion initial → laissé à onError).
  const st = get().netStatus
  if (st !== 'lobby' && st !== 'playing') return
  teardownNet()
  set({ netLeftNotice: notice })
}

/** Types de showcase prévisualisables en mode test (pour caler les positions). */
export type ShowcaseKind = 'card' | 'discard-red' | 'discard-dark' | 'hero'

/** Retrouve la clé de vilain depuis l'id porté par le PlayerState. */
export function villainKeyOf(villainId: string): VillainKey {
  return (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).find(
    (k) => VILLAIN_REGISTRY[k].def.id === villainId,
  ) ?? 'princeJohn'
}

// =============================================================================
// VILAINS PUBLIÉS (« Terminés ») — surcouche RUNTIME.
//
// Un vilain de l'Atelier marqué `published` rejoint la liste/le choix des vilains
// et se joue comme un natif. Comme `VILLAIN_REGISTRY` (statique) et `VillainKey`
// (union littérale) sont figés à la compilation, on tient un registre MUTABLE des
// vilains publiés, indexé par leur id (`custom-…`). Les écrans/lanceur résolvent
// un « clé » via `villainEntry()` qui retombe ici pour les ids custom.
// =============================================================================

/** Entrée résolue d'un vilain (natif ou publié) : tout ce qu'il faut pour jouer/afficher. */
export interface VillainEntry {
  def: VillainDef
  cards: CardDef[]
  label: string
}

/** Registre runtime des vilains publiés (id `custom-…` → entrée + bundle brut). */
const customRegistry: Record<string, { entry: VillainEntry; custom: CustomVillain }> = {}

/** Une clé désigne-t-elle un vilain PERSONNALISÉ (publié) plutôt qu'un natif ? */
export function isCustomKey(key: string): boolean {
  return key.startsWith(CUSTOM_ID_PREFIX)
}

/**
 * Enregistre (ou met à jour) un vilain publié au runtime : cartes (pour
 * `getCardDef`), couleur thématique et positions d'actions du plateau. Idempotent.
 */
export function registerPublishedVillain(custom: CustomVillain): void {
  // Patch de comportement éventuel (custom-dio : Stands/ZA WARUDO! ; custom-pyramid-head :
  // tuiles de Jugement/souffrance/objectif).
  const eff =
    custom.id === CUSTOM_DIO_ID
      ? patchCustomDio(custom)
      : custom.id === CUSTOM_PYRAMID_HEAD_ID
        ? patchCustomPyramidHead(custom)
        : custom.id === CUSTOM_MONOPOLY_ID
          ? patchCustomMonopoly(custom)
          : custom.id === CUSTOM_GULDAN_ID || custom.id.startsWith(`${CUSTOM_GULDAN_ID}-`)
            ? patchCustomGuldan(custom)
            : custom.id === CUSTOM_ISABELLA_ID || custom.id.startsWith(`${CUSTOM_ISABELLA_ID}-`)
              ? patchCustomIsabella(custom)
              : custom.id === CUSTOM_PIEGEUR_ID || custom.id.startsWith(`${CUSTOM_PIEGEUR_ID}-`)
                ? patchCustomPiegeur(custom)
                : custom
  const cards = toCardDefs(eff)
  registerCustomCardDefs(cards)
  VILLAIN_COLOR[eff.id] = eff.color
  // Couleur de recouvrement dédiée (« Mode recouvrement » de l'Atelier) ; sinon on
  // laisse le recouvrement retomber sur la couleur du méchant (coverColorOf).
  if (eff.coverColor) VILLAIN_COVER_COLOR[eff.id] = eff.coverColor
  else delete VILLAIN_COVER_COLOR[eff.id]
  registerActionPos(eff.id, customActionPositions(eff.locations))
  customRegistry[eff.id] = {
    entry: { def: toVillainDef(eff), cards, label: eff.name },
    custom: eff,
  }
}

/** Dépublication : retire un vilain publié du registre runtime → `villainEntry`
 *  ne le résout plus, donc il n'est ni jouable ni proposé/listé. Idempotent. */
export function unregisterPublishedVillain(id: string): void {
  delete customRegistry[id]
  delete VILLAIN_COVER_COLOR[id]
}

/** Résout l'entrée d'un vilain par sa clé (natif ou publié). undefined si inconnu. */
export function villainEntry(key: string): VillainEntry | undefined {
  if (key in VILLAIN_REGISTRY) return VILLAIN_REGISTRY[key as VillainKey]
  return customRegistry[key]?.entry
}

/** Bundle brut d'un vilain publié (pour portrait/présentation/objectif…). */
export function customVillainOf(key: string): CustomVillain | undefined {
  return customRegistry[key]?.custom
}

// ⚠️ ÉCHAFAUDAGE DE TEST — temporaire. Passer à `true` pour : main truquée
// (2 Alliés + 2 Objets), 10 JT d'avance, et Dame Gertrude en tête du deck
// Fatalité du bot (tester la restriction de pose D.2).
const DEV_TEST_HAND = false

/** Construit un exemplaire de carte pour la main/le plateau de test (id unique). */
function devInstance(cardId: string, tag: string): CardInstance {
  const c = princeJohnCards.find((x) => x.id === cardId)!
  return {
    instanceId: `p0:${cardId}#${tag}`,
    cardId,
    name: c.name,
    type: c.type,
    cost: c.cost,
    strength: c.strength,
    attach: c.attach,
    effects: c.effects,
  }
}

/**
 * Truque l'état initial du joueur humain pour les tests manuels : pouvoir
 * d'avance et main contrôlée. Les lieux démarrent VIDES (et se réinitialisent
 * donc à chaque rechargement) — on pose soi-même les 2 Alliés de la main pour
 * tester l'association multi-allié. À retirer plus tard.
 *
 * Place aussi Dame Gertrude en tête du deck Fatalité du bot (P1) pour tester
 * la restriction de pose (D.2) : la 1ʳᵉ Fatalité lancée contre le bot révèle
 * Dame Gertrude, dont le bouton « La Prison » doit apparaître grisé.
 */
function withDevTestHand(base: GameState): GameState {
  const players = base.players.map((p, i) => {
    if (i === 0) {
      return {
        ...p,
        power: 10,
        hand: [
          devInstance('gardes-rhinoceros', 'h1'), // Allié → Lieu
          devInstance('archers-loups', 'h2'), // Allié → Lieu
          devInstance('arc-fleches', 'h3'), // Objet → Allié
          devInstance('mandat-arret', 'h4'), // Objet → Lieu
        ],
      }
    }
    // Bot : Dame Gertrude tirée en premier par la Fatalité.
    const gertrudeIdx = p.fateDeck.findIndex((c) => c.cardId === 'dame-gertrude')
    if (gertrudeIdx < 0) return p
    const gertrude = p.fateDeck[gertrudeIdx]
    const rest = p.fateDeck.filter((_, idx) => idx !== gertrudeIdx)
    return { ...p, fateDeck: [gertrude, ...rest] }
  })
  return {
    ...base,
    players,
    log: [
      ...base.log,
      '[TEST] Main truquée (2 Alliés + 2 Objets), 10 pouvoir, lieux vides. Dame Gertrude en tête du deck Fatalité du bot.',
    ],
  }
}

const VILLAINS_LS_KEY = 'villainous:lastVillains'

/** Lit les vilains mémorisés (localStorage). Renvoie undefined si invalide. */
function readSavedVillains(): [VillainKey, VillainKey] | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(VILLAINS_LS_KEY)
    if (!raw) return undefined
    const arr = JSON.parse(raw) as unknown
    if (
      Array.isArray(arr) &&
      arr.length === 2 &&
      arr.every((k): k is VillainKey => typeof k === 'string' && k in VILLAIN_REGISTRY)
    ) {
      return arr as [VillainKey, VillainKey]
    }
  } catch { /* ignore */ }
  return undefined
}

/** Mémorise le choix de vilains pour la prochaine session. */
function saveVillains(villains: [string, string]) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(VILLAINS_LS_KEY, JSON.stringify(villains)) } catch { /* ignore */ }
}

/** Construit la configuration d'un camp depuis sa clé (vilain natif OU publié).
 *  `deckPrefix`/`fatePrefix` préfixent les instanceId pour distinguer les joueurs.
 *  Les cartes des paquets PERSONNALISÉS (`group`) restent hors-deck (codées à la
 *  main). Repli sur Prince Jean si la clé est inconnue (custom non chargé). */
/** Un vilain est-il d'origine MARVEL (publié via `origin`, ou natif listé dans MARVEL_VILLAINS) ? */
function isMarvelKey(key: string): boolean {
  if (isCustomKey(key)) return customVillainOf(key)?.origin === 'Marvel'
  return (MARVEL_VILLAINS as string[]).includes(key)
}

/** `marvelAddon` : les 5 Héros Marvel (déjà tirés du pool PARTAGÉ, cf. buildGameFromKeys) à
 *  ajouter à la Fatalité si ce vilain est Marvel. Injecté pour garantir l'ABSENCE DE DOUBLON
 *  entre deux vilains Marvel qui s'affrontent. */
function setupForKey(
  key: string,
  deckPrefix: string,
  fatePrefix: string,
  marvelAddon: CardInstance[] = [],
): PlayerSetup {
  if (isCustomKey(key)) {
    const custom = customVillainOf(key)
    if (custom) {
      // CardDef propres (paquets perso exclus + champs éditeur retirés) : buildDeckInstances
      // recopiant désormais TOUS les champs de jeu génériquement, l'entrée doit être nettoyée.
      const mainCards = toDeckCardDefs(custom)
      const fateCards = buildDeckInstances(mainCards, 'fate', fatePrefix)
      return {
        villain: { ...toVillainDef(custom), name: custom.name },
        deckCards: buildDeckInstances(mainCards, 'villain', deckPrefix),
        fateCards: [...fateCards, ...marvelAddon],
      }
    }
  }
  const k = (key in VILLAIN_REGISTRY ? key : 'princeJohn') as VillainKey
  const e = VILLAIN_REGISTRY[k]
  const fateCards = buildDeckInstances(e.cards, 'fate', fatePrefix)
  return {
    villain: { ...e.def, name: e.label },
    deckCards: buildDeckInstances(e.cards, 'villain', deckPrefix),
    fateCards: [...fateCards, ...marvelAddon],
  }
}

/** État initial d'une partie pour deux clés (natives ou publiées). Le pool Fatalité MARVEL
 *  est PARTAGÉ : si les deux vilains sont Marvel, leurs 5+5 Héros sont tirés du même pool sans
 *  doublon (un Héros donné ne va qu'à l'un des deux). */
function buildGameFromKeys(keys: [string, string]): GameState {
  const seed = (Math.random() * 0xffffffff) >>> 0
  const fatePrefixes: [string, string] = ['p0f:', 'p1f:']
  // Un addon Marvel PARTAGÉ (sans doublon) par joueur Marvel, dans l'ordre des joueurs.
  const marvelIdx = keys.map((k, i) => (isMarvelKey(k) ? i : -1)).filter((i) => i >= 0)
  const shared = drawSharedMarvelFateAddons(marvelIdx.map((i) => fatePrefixes[i]))
  const addonFor: [CardInstance[], CardInstance[]] = [[], []]
  marvelIdx.forEach((playerIndex, k) => { addonFor[playerIndex] = shared[k] })
  const setups: PlayerSetup[] = [
    setupForKey(keys[0], 'p0:', fatePrefixes[0], addonFor[0]),
    setupForKey(keys[1], 'p1:', fatePrefixes[1], addonFor[1]),
  ]
  return createInitialGame(setups, seed)
}

/**
 * Démarre une nouvelle partie avec les deux vilains choisis (natifs et/ou publiés).
 * Mémorise le choix en localStorage pour survivre à un rechargement (les ids custom
 * sont rejetés à la relecture → repli sur le duo par défaut).
 */
function newGame(
  villains: [string, string] = readSavedVillains() ?? ['princeJohn', 'maleficent'],
): GameState {
  saveVillains(villains)
  const base = buildGameFromKeys(villains)
  return DEV_TEST_HAND ? withDevTestHand(base) : base
}

/**
 * Partie du TUTORIEL — Prince Jean (joueur) vs Maléfique (bot), avec une mise en
 * place CONTRÔLÉE (non aléatoire) : le tutoriel guide un vrai premier tour, il faut
 * donc que la main de départ soit prévisible pour que chaque étape fonctionne
 * toujours. On force une main pédagogique couvrant les 4 types de cartes Vilain
 * (Allié / Objet / Effet / Condition) et un pouvoir de départ confortable pour que
 * l'étape « jouer une carte » réussisse quel qu'ait été le tirage.
 */
function tutorialGame(): GameState {
  const base = buildGameFromKeys(['princeJohn', 'maleficent'])
  // Un exemplaire de chaque type de carte du Prince Jean, dans l'ordre.
  const WANT = ['gardes-rhinoceros', 'mandat-arret', 'magnifiques-taxes', 'avarice']
  const p0 = base.players[0]
  const pool = [...p0.hand, ...p0.deck] // toutes les instances Vilain disponibles
  const chosen: CardInstance[] = []
  for (const id of WANT) {
    const c = pool.find((x) => x.cardId === id && !chosen.includes(x))
    if (c) chosen.push(c)
  }
  const rest = pool.filter((c) => !chosen.includes(c))
  const players = base.players.map((p, i) =>
    i === 0 ? { ...p, power: 5, hand: chosen, deck: rest } : p,
  )
  return { ...base, players }
}

/**
 * Démarre une partie solo avec un vilain PERSONNALISÉ (joueur 0) contre un vilain
 * natif (bot, joueur 1). Sert l'option « Tester » de l'Atelier : le brouillon
 * fourni n'est pas forcément publié, on l'enregistre donc au runtime avant de jouer.
 */
function customGame(custom: CustomVillain, opponent: VillainKey): GameState {
  registerPublishedVillain(custom)
  return buildGameFromKeys([custom.id, opponent])
}

// =============================================================================
// MODE TEST (bac à sable) — édition « live » des deux plateaux. À l'entrée, les
// plateaux sont vidés ; on insère ensuite n'importe quelle carte (Vilain ou
// Fatalité) sur n'importe quel lieu de l'un ou l'autre joueur, et on peut
// s'infliger un Héros (effets « à la pose » + showcase). Les deux camps restent
// visibles avec le même layout qu'en partie.
// =============================================================================

/** Compteur global d'instances de test (insertions / Héros infligés). */
let testFateCounter = 0

// Mr. Monopoly — Monotonie : horodatage (temps réel) du début de la partie courante.
// Le moteur reste pur ; c'est ici (couche store/UI) qu'on lit l'horloge et qu'on estampille
// `state.elapsedMs` à chaque action. Réinitialisé quand un état sans `elapsedMs` apparaît
// (nouvelle partie).
let monopolyGameStartMs = 0
function stampElapsed(state: GameState): GameState {
  const now = Date.now()
  if (state.elapsedMs === undefined) monopolyGameStartMs = now
  return { ...state, elapsedMs: now - monopolyGameStartMs }
}

/** Fabrique un exemplaire jouable depuis un cardId (recopie les champs de jeu
 *  pour que le moteur soit autosuffisant). Renvoie null si la carte est inconnue. */
function instanceOf(cardId: string, n: number): CardInstance | null {
  const def = getCardDef(cardId)
  if (!def) return null
  return {
    instanceId: `test:${cardId}#${n}`,
    cardId,
    name: def.name,
    type: def.type,
    cost: def.cost,
    strength: def.strength,
    attach: def.attach,
    attachStrengthBonus: def.attachStrengthBonus,
    effects: def.effects,
    onPlace: def.onPlace,
    onVanquish: def.onVanquish,
    forbiddenLocations: def.forbiddenLocations,
    placementRestriction: def.placementRestriction,
    strengthMod: def.strengthMod,
    selfStrengthMods: def.selfStrengthMods,
    discardWhen: def.discardWhen,
    trigger: def.trigger,
    maxAtLocation: def.maxAtLocation,
    activatedCost: def.activatedCost,
    playOnlyAt: def.playOnlyAt,
    discardAtCrewmates: def.discardAtCrewmates,
    isSabotage: def.isSabotage,
    grantsAction: def.grantsAction,
    contractLocationId: def.contractLocationId,
    isTitan: def.isTitan,
    reachesAdjacentVanquish: def.reachesAdjacentVanquish,
    reachesAnyLocationVanquish: def.reachesAnyLocationVanquish,
    ridesWithPawn: def.ridesWithPawn,
    returnToHandOnVanquish: def.returnToHandOnVanquish,
    auDela: def.auDela,
    goesToAuDelaOnPlay: def.goesToAuDelaOnPlay,
    alsoItem: def.alsoItem,
    mustDefeatFirst: def.mustDefeatFirst,
    forcedFateLocation: def.forcedFateLocation,
    fatePlayBoth: def.fatePlayBoth,
    isHyena: def.isHyena,
    requiresHyenaInRealm: def.requiresHyenaInRealm,
    requiresAllyInRealm: def.requiresAllyInRealm,
    evolvesToCardId: def.evolvesToCardId,
    playWhenRevealed: def.playWhenRevealed,
  }
}

/** Construit l'état d'entrée du mode test : partie neuve (decks/Fatalité valides),
 *  plateaux des DEUX joueurs vidés, phase Action, pouvoir confortable au joueur. */
function buildTestState(current?: GameState): GameState {
  // On REPART des vilains de la partie en cours (s'il y en a une) pour qu'un vilain custom
  // déjà en jeu (ex. Dio) ne disparaisse pas en passant en mode test ; sinon, partie par défaut.
  const keys = current?.players.map((p) => p.villain) as [string, string] | undefined
  const base = newGame(keys)
  const players = base.players.map((p, i) => {
    const cur = current?.players[i]
    return {
      ...p,
      // Le mode test ne doit PAS rebattre les cartes : on conserve la main ET le
      // paquet de la partie en cours (sinon la main changeait à chaque entrée).
      hand: cur?.hand ?? p.hand,
      deck: cur?.deck ?? p.deck,
      board: Object.fromEntries(p.locations.map((l) => [l.id, []])) as GameState['players'][number]['board'],
      power: i === 0 ? 10 : 1,
    }
  })
  return {
    ...base,
    players,
    phase: 'ACTION',
    usedActionIds: [],
    persifleurAvailable: false,
    log: ['[TEST] Mode test : plateaux vidés. Clique « ＋ » sur un lieu pour insérer des cartes.'],
  }
}

interface GameStore {
  state: GameState
  /** Contrôleur de chaque siège (voir {@link SeatController}). Détermine quels
   *  sièges l'autorité auto-joue (bot) vs attend (local/remote). */
  seats: [SeatController, SeatController]
  /** Index du joueur incarné par CE navigateur (point de vue). Solo : 0.
   *  L'UI s'en sert pour savoir quel plateau est « le mien ». */
  localPlayerIndex: number
  /** Mode de partie courant (solo par défaut). */
  mode: GameMode
  /** Étape de la connexion réseau (écran lobby). */
  netStatus: NetStatus
  /** Code de salon (hôte) à communiquer à l'invité ; null hors hébergement. */
  hostRoom: string | null
  /** App .exe (Tauri) uniquement : adresses IPv4 LAN de l'hôte à communiquer à
   *  l'invité (en web l'invité déduit l'adresse de la page). null sinon. */
  hostAddrs: string[] | null
  /** Dernier message d'erreur réseau (affiché par le lobby). */
  netError: string | null
  /** Message transitoire affiché en toast quand un coup est REFUSÉ par le moteur
   *  (ex. cliquer ailleurs alors qu'un dévoilement de Combattants est en attente).
   *  null sinon ; l'UI l'efface après quelques secondes. */
  actionNotice: string | null
  clearActionNotice: () => void
  /** Renseigné quand l'autre joueur a quitté / la connexion est perdue : l'UI
   *  affiche un avis puis renvoie à l'accueil. null sinon. */
  netLeftNotice: string | null
  /** Nom du vilain de l'autre joueur quand il prépare une Condition (sélection
   *  d'une cible) : l'UI bloque le joueur actif le temps qu'il la joue. null sinon. */
  peerReacting: string | null
  /** Lobby réseau : vilain actuellement SURVOLÉ par l'autre joueur (curseur en
   *  direct, façon sélection de perso). null = pas de survol / hors lobby. */
  peerHover: VillainKey | null
  /** État du lobby (choix des vilains en direct) : seats[0] = hôte, seats[1] =
   *  invité. null hors lobby. */
  lobby: LobbySeat[] | null
  /** Point d'entrée UNIQUE de tout coup de jeu. Solo : applique localement. En
   *  réseau : l'hôte applique+diffuse, le client envoie (via la session). Toutes
   *  les méthodes de jeu y transitent. */
  submit: (action: GameAction) => void
  /** Héberge une partie réseau : ouvre un salon et attend l'invité. Le choix des
   *  vilains se fait ensuite, en direct (phase lobby). */
  startHost: () => void
  /** Rejoint le salon `code` (relais sur `host`, défaut = hôte de la page). */
  joinHost: (code: string, host?: string) => void
  /** Pendant le lobby : choisit (ou retire avec null) SON vilain ; synchronisé. */
  selectVillain: (villainKey: VillainKey | null) => void
  /** Pendant le lobby : signale le vilain que JE survole (ou null) à l'autre joueur,
   *  pour qu'il voie mon curseur en direct. Sans effet hors réseau. */
  setHoverVillain: (villainKey: VillainKey | null) => void
  /** Réseau : signale à l'adversaire que je prépare (`on`=true) ou termine
   *  (`on`=false) une Condition en réaction, pour le bloquer le temps voulu. */
  setReacting: (on: boolean, villainName: string) => void
  /** Hôte uniquement : lance la partie une fois les deux vilains choisis. */
  launchGame: () => void
  /** Quitte volontairement la partie réseau en prévenant l'autre joueur (LEAVE),
   *  puis revient au mode solo. */
  quitNet: () => void
  /** Quitte la partie réseau et revient au mode solo. */
  leaveNet: () => void
  /** Vrai quand on est en mode test (édition live des deux plateaux, bot figé). */
  testMode: boolean
  /** Instantané de la partie AVANT l'entrée en mode test : restauré tel quel à la
   *  sortie pour que le mode test soit NON destructif (main, plateaux et vilains
   *  conservés). `null` hors mode test. */
  preTestState: GameState | null
  /** Entre en mode test (ou le réinitialise) : vide les deux plateaux. */
  enterTestMode: () => void
  /** Sort du mode test : restaure la partie d'avant (instantané) telle quelle. */
  exitTestMode: () => void
  /** REPRISE : ré-injecte les images (plateau/pion/dos) dans l'état repris depuis le
   *  registre runtime — à rappeler une fois les vilains CUSTOM chargés (customVillainStore.load()),
   *  leurs images n'étant pas résolubles à l'init synchrone. Le `set` re-rend aussi les cartes
   *  custom (dont l'image se résout alors via le registre). Idempotent, sans effet hors reprise. */
  hydrateResumedImages: () => void
  /** MODE TEST : insère une carte (par cardId) sur un lieu d'un joueur donné. */
  testInsertCard: (playerIndex: number, locationId: string, cardId: string) => void
  /** MODE TEST : t'inflige un Héros Fatalité (par cardId) sur un lieu donné. */
  testPlaceFate: (cardId: string, to: string) => void
  /** MODE TEST : joue une Condition (par cardId) pour le joueur 0. Pour Lâcheté,
   *  `allyInstanceId`/`to` permettent de choisir l'Allié et le lieu. */
  testPlayCondition: (cardId: string, allyInstanceId?: string, to?: string) => void
  /** MODE TEST : ajoute une carte (par cardId) à la main du joueur 0 — pour
   *  ensuite la jouer normalement (Événements à cibles, Alliés, Objets…). */
  testAddToHand: (cardId: string) => void
  /** MODE TEST (Dr Facilier) : ajoute une carte (par cardId) à la Pile de l'Au-delà
   *  du joueur 0 — pour tester Divination et les effets Au-delà. */
  testAddToAuDela: (cardId: string) => void
  /** MODE TEST : joue une carte Fatalité non-Héros (Voler aux Riches,
   *  Déguisement) CONTRE le joueur 0, sur l'un de ses Héros (`targetHeroId`). */
  testPlayFateCard: (cardId: string, targetHeroId: string, enlargeToward?: string) => void
  /** MODE TEST : déclenche un showcase d'aperçu (pour caler les positions).
   *  `opts` : durée en ms / mode « fixe », et `count` = nombre de cartes pour
   *  une défausse. */
  testShowcase: (
    kind: ShowcaseKind,
    playerIndex: number,
    opts?: { durationMs?: number; fixed?: boolean; count?: number },
  ) => void
  /** MODE TEST : reprend la main du joueur 0 (réinitialise actions + repioche)
   *  sans passer la main au bot — pour continuer à jouer après « fin de tour ». */
  testRefreshTurn: () => void
  move: (to: LocationId) => void
  moveTrack: (steps: number) => void
  skipMove: () => void
  /** Fixe le joueur qui commence (jet de dé de début de partie) + journalise. */
  setStartingPlayer: (index: number, rolls: [number, number]) => void
  executeAction: (actionId: string, count?: number) => void
  playCard: (
    actionId: string,
    instanceId: string,
    to?: string,
    attachTo?: string,
    targetHeroId?: string,
    allyInstanceIds?: string[],
    allyMove?: { instanceId: string; to: string },
    shrinkFreeActionId?: string,
    engrenagesIds?: string[],
  ) => void
  discardCards: (actionId: string, instanceIds: string[]) => void
  moveCard: (actionId: string, instanceId: string, to: string) => void
  /** Thanos — DÉPLOIE un Allié chez un adversaire (capture d'une Pierre) via l'action Déplacer. */
  thanosDeploy: (actionId: string, allyInstanceId: string, oppIndex: number, oppLocationId: string) => void
  /** Thanos — RAPATRIE un Allié déployé vers `to` (capture la Pierre de son lieu). */
  thanosRetrieve: (actionId: string, allyInstanceId: string, to: string) => void
  /** Action « Déplacer un Héros » : déplace un Héros vers un lieu voisin. */
  moveHero: (actionId: string, heroInstanceId: string, to: string) => void
  /** Action « Activer » (Jafar) : déclenche la capacité activée d'une carte. */
  activate: (
    actionId: string,
    cardInstanceId: string,
    to?: string,
    itemInstanceId?: string,
    allyInstanceIds?: string[],
  ) => void
  vanquish: (actionId: string, heroInstanceId: string, allyInstanceIds: string[]) => void
  catchPokemon: (actionId: string, heroInstanceId: string) => void
  /** Le Seigneur des Ténèbres — active le Chaudron Magique réclamé (face Pouvoir). */
  activateCauldron: () => void
  /** Le Seigneur des Ténèbres — capacité du Chaudron réveillé : remplace un Squelette
   *  de Soldat par un Soldat Ressuscité de la main (paie 2 Pouvoir, 1×/tour, avant le déplacement). */
  cauldronExchange: (squeletteInstanceId: string, soldierInstanceId: string) => void
  /** Le Seigneur des Ténèbres — résout le choix « Chaudron OU Pouvoir ». */
  resolveCauldronChoice: (choice: 'cauldron' | 'power') => void
  resolveMauiChoice: (choice: 'play' | 'discard') => void
  /** Dio — Vampirisme : défausse l'Allié choisi pour gagner du Pouvoir. */
  resolveDioDiscardAlly: (allyInstanceId: string) => void
  /** Dio — CREAM : défausse le Héros choisi sur le lieu de Cream. */
  resolveDioCream: (heroInstanceId: string) => void
  /** Dio — MUDA! : élimine le Héros choisi (ou aucun) et gagne du Pouvoir. */
  resolveDioMuda: (heroInstanceId?: string) => void
  /** Dio — Quête vers le paradis : va chercher une carte du type choisi (Objet ou Stand). */
  /** Dio — Lumière du Soleil : défausse la main OU perd du Pouvoir. */
  resolveDioSunlight: (choice: 'discard' | 'lose') => void
  resolvePacteSang: (instanceId: string) => void
  resolveSacrifice: (choice: 'look' | 'gain') => void
  resolveCageMove: (locationId: string) => void
  resolveCrustaceanPlace: (to: string) => void
  /** Dr Facilier — L'étoile du soir : place l'Allié choisi dans l'Au-delà de la cible. */
  resolveFateAllyToAuDela: (allyInstanceId: string) => void
  /** Oogie Boogie — Mettons fin à ce cauchemar : défausse la carte choisie de la main cible. */
  resolveFateDiscardHand: (cardInstanceId: string) => void
  /** Hadès — Alignement des planètes : désentrave les Titans choisis (1 JT chacun). */
  resolveUntrapTitans: (instanceIds: string[]) => void
  /** Oogie Boogie — Diversion : défausse l'Allié/Objet choisi du lieu d'arrivée. */
  resolveDiversionDiscard: (cardInstanceId: string) => void
  /** Le Seigneur des Ténèbres — résout le choix « Nous avons conclu un marché ! ». */
  resolveBargainChoice: (choice: 'reshuffle' | 'sword') => void
  /** Le Seigneur des Ténèbres — joue gratuitement un Objet (Nous touchons du doigt la victoire). */
  resolveFreeItemPlay: (instanceId: string, to: string) => void
  skipFreeItemPlay: () => void
  discardDeguisement: (instanceId: string) => void
  sheriffMove: (instanceId: string, to: string) => void
  diabloMove: (instanceId: string, to: string) => void
  /** Diablo (V2) : exécute l'action gratuite armée au lieu de Diablo. */
  diabloFreeAction: (
    inner: Extract<
      GameAction,
      { type: 'EXECUTE_ACTION' | 'PLAY_CARD' | 'DISCARD_CARDS' | 'MOVE_CARD' | 'VANQUISH' }
    >,
  ) => void
  /** Diablo (V2) : décline l'action gratuite. */
  diabloSkipFreeAction: () => void
  /** Gaston (Belle est à moi / Tous avec moi) : exécute l'action gratuite armée. */
  performGrantedAction: (inner: Extract<GameAction, { type: 'VANQUISH' | 'MOVE_CARD' | 'PLAY_CARD' }>) => void
  /** Gaston : décline l'action gratuite armée. */
  skipGrantedAction: () => void
  /** Gaston : retire/replace un jeton Obstacle sur un lieu (pendingObstacle). */
  resolveObstacle: (locationId: string) => void
  /** Gaston : termine le retrait/replacement d'Obstacles en attente. */
  doneObstacle: () => void
  /** Le Seigneur des clés : action « Obtenir une clé » (ouvre le choix de clé). */
  obtainKey: (actionId: string) => void
  /** Le Seigneur des clés : ramasse / repose la clé choisie (pendingKey). `locationId`
   *  = lieu de dépose (perte avec choix du lieu). */
  resolveKey: (keyId: string, locationId?: LocationId) => void
  /** Le Seigneur des clés : choisit une couleur avant de lancer le dé (pendingKeyColor). */
  resolveKeyColor: (color: KeyColor) => void
  /** Le Seigneur des clés : Plaisir ou souffrance (perdre du Pouvoir ou reposer une clé). */
  resolvePlaisir: (choice: 'power' | 'key') => void
  /** Le Seigneur des clés : Sorcellerie / Gévaudan — l'adversaire choisit la clé (et le lieu). */
  resolveStealKey: (keyId: string, locationId?: LocationId) => void
  /** Tendre un Piège : action Éliminer un Héros facultative. */
  trapVanquish: (heroInstanceId: string, allyInstanceIds: string[]) => void
  /** Tendre un Piège : termine sans éliminer. */
  trapSkipVanquish: () => void
  /** Ratigan — Brutes : renonce à l'action distante facultative. */
  skipRemoteAction: () => void
  playCondition: (
    playerIndex: number,
    instanceId: string,
    allyInstanceId?: string,
    to?: string,
  ) => void
  fate: (actionId: string) => void
  resolveFate: (instanceId: string, to?: string, targetHeroId?: string, enlargeToward?: string) => void
  /** Combo « jouer les deux » (Ray/Dormeur) : passe la 2ᵉ carte facultative. */
  passFate: () => void
  /** Tyrannie : défausse les cartes choisies (résout `pendingTyrannyDiscard`). */
  resolveTyrannyDiscard: (instanceIds: string[]) => void
  /** Aurore : pose le Héros révélé sur le lieu choisi (résout `pendingHeroPlacement`). */
  resolveHeroPlacement: (locationId: string) => void
  /** Roi Stéphane : déplace le pion sur `locationId` (ou `null` = ne pas déplacer). */
  resolvePawnMove: (locationId: string | null) => void
  /** Roi Hubert : attire les Alliés choisis (≤1 par lieu voisin) vers son lieu. */
  resolveHubertPull: (allyInstanceIds: string[]) => void
  /** Retourne-toi : `keep` = garder la carte révélée ; sinon remélanger + piocher. */
  resolveDeckPeek: (keep: boolean) => void
  /** Tombée de la nuit : choisit le type (Événement/Objet) à conserver. */
  resolveTypeChoice: (cardType: import('../../engine/types').CardType) => void
  /** Le Grand Génie du Mal : choisit de piocher (`'draw'`) ou gagner du Pouvoir (`'power'`). */
  resolveDrawOrGainPower: (choice: 'draw' | 'power') => void
  resolveBloodTrace: (choice: 'power' | 'move') => void
  /** Infiltration : la cible perd du Pouvoir (`'lose'`) ou défausse la carte `instanceId`. */
  resolveInfiltration: (payload: { choice: 'lose' } | { choice: 'discard'; instanceId: string }) => void
  resolvePowerOrRacerBack: (choice: 'power' | 'racer') => void
  /** Sa Sucrerie — Taffyta : reculer le Pilote de 2 (`'racer-back'`) ou action Jouer une carte (`'play-card'`). */
  resolveTaffytaChoice: (choice: 'racer-back' | 'play-card') => void
  /** Sa Sucrerie — Aigre Bill : fouiller la pioche Méchant (`true`) ou renoncer (`false`). */
  resolveAigreBill: (dig: boolean) => void
  /** Sa Sucrerie — L'important, c'est de payer : dépenser `amount` Pouvoir → avancer d'autant. */
  resolvePayRace: (amount: number) => void
  /** Mr. Monopoly — Affaire : poser `amount` maisons sur le lieu adverse en attente. */
  resolveBuyHouses: (amount: number) => void
  /** Mr. Monopoly — Carte bancaire / destruction : choisir un lieu (source ou destination). */
  resolveMoveHouses: (locationId: string) => void
  /** Mr. Monopoly — Libéré de prison : déplacer un Héros, ou envoyer Mr. Monopoly en Prison. */
  resolveFreeFromJail: (arg: { heroInstanceId?: string; locationId?: string; toPrison?: boolean }) => void
  /** Mr. Monopoly — Reculez de trois cases : déplacer le pion vers le lieu choisi. */
  resolveBackwardMove: (locationId: string) => void
  /** Sa Sucrerie — Princesse Vanellope : reculer le pion King Candy de `amount` cases (0..max). */
  resolvePawnBack: (amount: number) => void
  /** Sa Sucrerie — Le Faisceau : choisir le lieu de rassemblement, puis défausser/passer. */
  resolveBeacon: (arg: { locationId?: string; cybugInstanceId?: string; skip?: boolean }) => void
  /** Sa Sucrerie — Médaille de Vanellope : choisir le Héros puis le lieu (+1 Force). */
  resolveMedal: (arg: { heroInstanceId?: string; locationId?: string }) => void
  /** Shere Khan — Tout le monde fuit : choisir l'action gratuite (Activer / Vaincre). */
  resolveActivateOrVanquish: (choice: 'activate' | 'vanquish') => void
  /** Le Flagelleur Mental — Will sous emprise : choisir le deck à consulter (Méchant / Fatalité). */
  resolveScryDeckChoice: (deck: 'villain' | 'fate') => void
  /** Shere Khan — C'est moi, Shere Khan : retirer le jeton Feu choisi (lieu + action). */
  resolveRemoveFire: (locationId: string, actionId: string) => void
  /** Shere Khan — Feu Rouge des Hommes : poser le jeton Feu sur l'action choisie. */
  resolvePlaceFire: (locationId: string, actionId: string) => void
  /** Shere Khan — Lancé sur ses traces : éliminer le Héros choisi. */
  resolveShereKhanDefeat: (heroInstanceId: string) => void
  /** Shere Khan — C'est à moi que vous le direz : remettre une Fatalité dans la pioche (ou passer). */
  resolveRecoverFate: (instanceId?: string) => void
  /** Shere Khan — À toi de jouer, cousin : jouer l'Allié dévoilé sur le lieu choisi. */
  resolveFreePlayAlly: (locationId: string) => void
  /** Grand Councilwoman — RAPPORT / CAPITAINE GANTU : jouer gratuitement la carte en attente
   *  (`targetId` = lieu de pose ou instanceId de l'hôte ; absent pour un Événement).
   *  `cancel` = renoncer (la carte part en défausse). */
  resolveFreePlayCard: (targetId?: string, cancel?: boolean) => void
  /** Grand Councilwoman — CAPITAINE GANTU : choisir la carte de la défausse à jouer (ou passer). */
  resolvePickDiscardToPlay: (instanceId?: string) => void
  /** Shere Khan — Jeune et sans défense : choix (move/gain) puis Héros / Allié. */
  resolveYoung: (arg: { choice?: 'move' | 'gain'; heroInstanceId?: string; allyInstanceId?: string }) => void
  /** Shere Khan — Aie confiance : choisir une carte de la défausse à récupérer (ou terminer). */
  resolveRecoverToDeck: (arg: { instanceId?: string; done?: boolean }) => void
  resolveInteressant: (arg: { option?: 'power' | 'draw' | 'fire'; done?: boolean }) => void
  resolveKaaPlay: (instanceId: string) => void
  resolveMonkeyKing: (arg: { macaqueInstanceId?: string; to?: string }) => void
  resolveKaaShield: (arg: { itemInstanceId?: string; decline?: boolean }) => void
  resolvePlaceTreasure: (arg: { heroInstanceId?: string; treasureId?: string }) => void
  resolveRevealTreasure: (heroInstanceId: string) => void
  resolveMoveSwapTreasure: (heroInstanceId: string) => void
  resolveWakeKraken: (allyInstanceId: string) => void
  /** C'est votre dernière chance : choisir l'action gratuite (Déplacer / Activer). */
  resolveMoveOrActivate: (choice: 'move' | 'activate') => void
  /** Maximus (Gothel) : déplacer un Cavaliers du roi (phase 1) puis Maximus (phase 2). */
  resolveMaximusCavaliers: (allyInstanceId: string | null, to: string | null) => void
  resolveMaximusMove: (to: string | null) => void
  /** Je ne reviens jamais (Trémaine) : replace les cartes Fatalité dans l'ordre choisi. */
  resolveFateReorder: (orderedIds: string[]) => void
  /** Lance-moi ta chevelure : ramène Raiponce de `steps` lieux (1 ou 2) vers la Tour. */
  resolveRaiponceHomeward: (steps: number) => void
  /** Frères Stabbington : déplacer (ou non) Raiponce sur la Tour. */
  resolveRaiponceToTower: (move: boolean) => void
  /** Cruella — choisir une Tuile Chiots de la réserve à ajouter sur son lieu indiqué. */
  resolvePuppyAdd: (tileId: string) => void
  /** Cruella — Repéré ! : révéler une Tuile Chiots face cachée de la réserve. */
  resolvePuppyReveal: (tileId: string) => void
  /** Cruella — Repéré ! : terminer la révélation. */
  donePuppyReveal: () => void
  /** Tabbou — Dévoiler : retourne une tuile Combattant face cachée de la grille. */
  resolveFighterReveal: (tileId: string) => void
  /** Tabbou — Dévoiler : arrêter de dévoiler. */
  doneFighterReveal: () => void
  /** Tabbou — Tuer des Combattants : couleur choisie (toute la couleur en réserve). */
  resolveFighterKillColor: (color: FighterColor) => void
  /** Tabbou — Coup Fatal : tuer une tuile Combattant de la réserve. */
  resolveFighterKillFree: (tileId: string) => void
  /** Tabbou — Coup Fatal : arrêter de tuer. */
  doneFighterKillFree: () => void
  /** Tabbou — Destin : dévoiler 3 Combattants OU gagner 4 Pouvoir. */
  resolveDestinChoice: (choice: 'reveal' | 'power') => void
  /** Cruella — Horace : capturer (true) ou amener une Tuile de la réserve (false). */
  resolveHoraceChoice: (capture: boolean) => void
  /** Cruella — choisir une Tuile Chiots à capturer (plusieurs sur le lieu). */
  resolvePuppyCapture: (tileId: string) => void
  /** Cruella — Quels idiots ! : choisir l'option (déplacer / chercher un Allié). */
  resolveQuelsIdiots: (choice: 'move' | 'tutor') => void
  /** Cruella — Quels idiots ! : choisir l'Allié (à déplacer ou à chercher). */
  resolveQuelsIdiotsPick: (instanceId: string) => void
  /** Couronne (Gothel) : défausse l'Objet pour 1 jeton Confiance (capacité gratuite). */
  sacrificeCrown: (instanceId: string) => void
  /** Apparition / Vent de panique : déplace le Héros choisi vers le lieu voisin. */
  resolveHeroRelocate: (heroInstanceId: string, to: string) => void
  /** Décline un déplacement de Héros facultatif (Poupées vaudou). */
  skipHeroRelocate: () => void
  /** Le Piégeur — choisit le Survivant ciblé (phase 'target' de pendingPiegeur). */
  resolvePiegeurTarget: (survivorInstanceId: string) => void
  /** Le Piégeur — choisit le lieu voisin de destination (phase 'dest'). */
  resolvePiegeurDest: (to: string) => void
  /** Le Piégeur — paie 2 Pouvoir pour défausser une Palette. */
  discardPalette: (instanceId: string) => void
  /** Flèche de Mome Raths : déplace l'Allié choisi vers le lieu (non bloqué) choisi. */
  resolveAllyRelocate: (allyInstanceId: string, to: string) => void
  skipAllyRelocate: () => void
  /** Team Rocket — un dresseur invoque le Pokémon choisi. */
  resolvePokemonSummon: (cardId: string) => void
  /** Team Rocket — « Oui, la guerre ! » : couche le Pokémon choisi. */
  resolveKoPokemon: (instanceId: string) => void
  /** Ultron — compléter la prochaine tuile Amélioration (action libre, 1/tour). `discard` =
   *  Sentinelles à défausser selon la tuile (2 pour Transformation, 1 Drone de combat pour
   *  Optimisation ; aucune pour Forme finale / L'ère d'Ultron). */
  completeUltronUpgrade: (discard?: string[]) => void
  /** Ultron — Optimisation : utilise l'action « Jouer une carte » `actionId` du lieu du pion
   *  comme un « Déplacer un Allié/Objet » (déplace `instanceId` vers `to`). */
  ultronOptimizeMove: (actionId: string, instanceId: string, to: string) => void
  /** Pat Hibulaire — « Planqués » : défausse l'Allié choisi. */
  resolveFateDiscardAlly: (instanceId: string) => void
  /** Syndrome — Identification, je vous prie : déplace l'Allié/Objet choisi vers le lieu (avec Héros) choisi. */
  resolveIdentification: (cardInstanceId: string, to: string) => void
  /** Lotso — résout le choix de cible (réduire un Héros / déplacer vers la Salle des Chenilles). */
  resolveLotsoTarget: (instanceId: string) => void
  /** Team Rocket — Évolution : résout le choix de l'Allié à faire évoluer. */
  resolveEvolveAlly: (instanceId: string) => void
  /** Lotso — Réinitialisation : résout le choix du lieu où placer Buzz (mode Démo). */
  resolveLotsoBuzzMove: (to: string) => void
  /** Lotso — Le Bibliothécaire : réduit le Héros choisi (−1) ou termine (null). */
  resolveLotsoBookworm: (heroInstanceId: string | null) => void
  /** Lotso — Flex : choisit la carte à déplacer (cardInstanceId) puis le lieu (to). */
  resolveLotsoFlex: (arg: { cardInstanceId?: string; to?: string }) => void
  /** Téléportation : déplace le pion vers le lieu (portant un Héros) choisi. */
  resolveTeleport: (to: string) => void
  resolveManipulation: (instanceId: string) => void
  /** Mauvais Coup : garde la carte choisie en main, replace l'autre dessus/dessous. */
  resolveMauvaisCoup: (keepInstanceId: string, otherPlacement: 'top' | 'bottom') => void
  /** Sournois : replace la carte choisie de la main sur le dessus/dessous. */
  resolveSournois: (instanceId: string, placement: 'top' | 'bottom') => void
  /** Cheval : déplace l'Allié/Objet choisi vers `to` (null/null = ne rien déplacer). */
  resolveAllyItemMove: (instanceId: string | null, to: string | null) => void
  /** Cheval (bot) : délègue le choix de déplacement à l'heuristique du moteur. */
  resolveAllyItemMoveAuto: () => void
  /** Bandit : enchaîne les Bandits choisis (tableau vide = aucun de plus). */
  resolveBanditChain: (instanceIds: string[]) => void
  /** Dingo : intervertit les tuiles des lieux `from`/`to` (null/null = rien). */
  resolveDingo: (from: string | null, to: string | null) => void
  dismissRoyalCroquet: () => void
  /** Par ordre de la Reine ! : transforme en arceaux les Cartes Gardes choisies. */
  resolveTransformWickets: (instanceIds: string[]) => void
  /** Faites-leur peur ! : remet sur le dessus / défausse les cartes sondées. */
  resolveScry: (topInstanceIds: string[]) => void
  /** Pas de Quartier ! : déplace l'Allié choisi vers un lieu voisin (+force). */
  resolveAllyMoveBuff: (instanceId: string, to: string) => void
  skipAllyMoveBuff: () => void
  /** Abu/Aladdin/K.O. : applique le choix (Objet volé / Allié retiré). */
  resolveFateChoice: (instanceId: string) => void
  /** Mim — Le Savoir conduit à la Puissance : Merlin choisi déplacé vers `to`. */
  resolveMerlinMove: (merlinInstanceId: string, to: string) => void
  /** Digne Adversaire / Obsession : joue (sur `to`) ou défausse le Héros dévoilé. */
  resolveFetchedHero: (play: boolean, to?: string) => void
  resolveCastleTheft: (to?: string) => void
  /** Carte du Pays Imaginaire : défausse-la et joue gratuitement un Objet de la main. */
  useNeverlandMap: (itemInstanceId: string, to: string, attachTo?: string) => void
  /** Opportunisme : reprend en main la carte choisie de la défausse Vilain. */
  resolveRecover: (instanceId?: string) => void
  /** Soyez prêtes ! (Scar) : reprend la carte choisie (null = terminer). */
  resolveBePrepared: (instanceId: string | null) => void
  /** Shenzi (Scar) : joue gratuitement la Hyène choisie (null = décliner). */
  resolveFreeHyena: (instanceId: string | null) => void
  /** Hakuna Matata (Scar) : rejoue un Héros de la Succession (`play`) ou déplace un
   *  Héros du royaume (`move`). */
  resolveHakunaMatata: (mode: 'play' | 'move', instanceId: string) => void
  /** Yzma (Fatalité) : choisit la pioche (par lieu), puis la carte à jouer. */
  resolveYzmaFateDeck: (locationId: string) => void
  resolveYzmaFateCard: (instanceId: string | null) => void
  /** Yzma (À l'attaque ! / Marteau) : choisit la pioche (lieu) sur laquelle agir. */
  resolveYzmaOwnDeck: (locationId: string) => void
  /** Yzma (Marteau) : choisit (face cachée) les cartes à défausser de la pioche. */
  resolveYzmaHammer: (instanceIds: string[]) => void
  /** Yzma (Paysan / Attention au groove ! / Pacha) : Héros (ou null) + pioches à mélanger. */
  resolveYzmaManipulate: (heroInstanceId: string | null, locationIds: string[]) => void
  /** Yzma (Finis le travail) : choisit l'Allié puis le lieu (à Héros) de destination. */
  resolveFinishJob: (allyInstanceId?: string, to?: string) => void
  /** Yzma (Beauté endormie, réveil) : applique les choix indépendants (gagner 2 JT,
   *  piocher 2, déplacer un Héros vers un lieu voisin). */
  resolveBeautySleep: (
    gainPower: boolean,
    draw: boolean,
    heroMove: { heroInstanceId: string; to: string } | null,
  ) => void
  /** Yzma (Ironie du sort) : rejoue l'Événement choisi de la défausse (null = aucun). */
  resolveReplayEvent: (instanceId: string | null) => void
  /** Oogie Boogie : confirme le lancer de dés en cours et applique son issue. */
  resolveDice: () => void
  /** Oogie Boogie : joue un Dés pipés pour relancer le dé `dieIndex` (0/1). */
  resolveDiceReroll: (instanceId: string, dieIndex: 0 | 1) => void
  /** Oogie Boogie — Affaire dans le sac : choisit la valeur des deux dés. */
  resolveDiceChoice: (dice: [number, number]) => void
  /** Oogie Boogie : renonce à l'action de royaume gratuite (Préparation de Noël ≥8). */
  skipFreeRealmAction: () => void
  /** Tuer (L'Imposteur) : défausse le Coéquipier `color` choisi. */
  resolveCrewmateKill: (color: string) => void
  /** Tâche visuelle (L'Imposteur) : rend suspect le Coéquipier `color`. */
  resolveCrewmateSuspect: (color: string) => void
  /** Tâche visuelle : termine la sélection (moins que le max). */
  doneCrewmateSuspect: () => void
  /** Assurance : déplace le Coéquipier rassuré vers `to`. */
  resolveCrewmateMove: (to: string) => void
  /** Assurance : ne pas déplacer (termine). */
  doneCrewmateMove: () => void
  /** Vidéo de surveillance / Carte : associe l'Objet Fatalité au lieu `locationId`. */
  resolveFateObjectPlace: (locationId: string) => void
  resolveFateHeroPlace: (locationId: string) => void
  resolveFateDiscardType: (cardType: import('../../engine/types').CardType) => void
  removeFateLocationCard: (instanceId: string) => void
  /** Colère Titanesque : choisit le lieu voisin où effectuer une action. */
  resolveGiantLocation: (locationId: string) => void
  /** Préparez-vous au combat ! (Hadès) : déplace le Titan choisi vers `to`. */
  resolveTitanMove: (titanInstanceId: string, to: string) => void
  /** Héra / Pégase (Hadès, Fatalité) : entrave ou repousse le Titan choisi. */
  resolveTitanSelect: (titanInstanceId: string) => void
  /** Divination (Dr Facilier) : résout les cartes révélées de l'Au-delà dans
   *  l'ordre `topInstanceIds`. */
  resolveDivination: (topInstanceIds: string[]) => void
  /** Tour de passe-passe (Dr Facilier) : garde `keepInstanceIds` en main. */
  resolveLookTop: (keepInstanceIds: string[], toTop?: boolean) => void
  resolveWeaponFetch: (instanceId?: string, equip?: boolean) => void
  /** Liste de Fidget (Ratigan) : acquitte l'affichage des cartes dévoilées. */
  acknowledgeReveal: () => void
  /** Sombra — Piratage : désactive l'action choisie du lieu piraté. */
  resolveHack: (actionId: string) => void
  /** Sombra — Information : défausser les cartes piochées (true) ou 2 de la main. */
  resolveInformation: (discardDrawn: boolean) => void
  /** Oogie — Père Noël : défausse les cartes choisies puis pioche. */
  resolveDiscardThenDraw: (instanceIds: string[]) => void
  resolveTakeABite: (heroInstanceId: string) => void
  resolveGrantLove: (heroInstanceId: string) => void
  resolveDuplicateIngredient: (ingredientInstanceId: string) => void
  cancelDuplicateIngredient: () => void
  resolveScream: (from?: string, to?: string) => void
  /** Si près du but / Charlotte (Dr Facilier) : place `toAudelaIds` dans l'Au-delà,
   *  remet `deckTopOrder` sur le dessus de la pioche. */
  resolveFateScry: (toAudelaIds: string[], deckTopOrder: string[]) => void
  /** Canne (Dr Facilier) : ouvre le choix d'un lieu voisin où agir. */
  useCanne: () => void
  /** Mr. Monopoly — Canne : ouvre le choix d'une action empruntée à un lieu maisonné adverse. */
  useCanneMonopoly: () => void
  /** Mr. Monopoly — Canne : exécute l'action empruntée choisie. */
  resolveCanneBorrow: (locationId: string, actionId: string) => void
  /** Char (Hadès) : déplace la figurine + le Char vers `to`. */
  chariotMove: (instanceId: string, to: string) => void
  /** Dio — ZA WARUDO! (temps arrêté) : déplace librement le pion vers `to`. */
  zaWarudoRelocate: (to: string) => void
  endTurn: () => void
  /** (Re)démarre une partie solo avec deux clés de vilains (natifs et/ou publiés). */
  reset: (villains?: [string, string]) => void
  /** Tutoriel interactif : étape courante (`null` = pas en tutoriel). Le verrouillage des
   *  actions et l'overlay lisent cet état. */
  tutorial: { stepIndex: number } | null
  /** Démarre le tutoriel guidé (partie solo Prince Jean vs Maléfique, étape 0). */
  startTutorial: () => void
  /** Avance d'une étape de tutoriel (bouton « Suivant » des étapes informatives). */
  tutorialNext: () => void
  /** Quitte le tutoriel (garde la partie en cours, sans plus de verrouillage). */
  endTutorial: () => void
  /** DEV UNIQUEMENT : démarre une partie ORDI vs ORDI (les DEUX sièges en IA) pour
   *  observation/analyse. Non exposé dans le build/exe (garde `import.meta.env.DEV`). */
  startBotMatch: (villains: [string, string]) => void
  /** Démarre une partie solo : vilain PERSONNALISÉ (joueur) vs vilain natif (bot). */
  startCustomGame: (custom: CustomVillain, opponent: VillainKey) => void
  /** Fait jouer UN coup au bot, si le joueur actif est un bot. */
  botAct: () => void
  /** Fait jouer une Condition en réaction par un bot non-actif (Avarice,
   *  Lâcheté). Renvoie true si une carte a été jouée, false sinon. */
  botReact: () => boolean
}

// Reprise éventuelle d'une partie SOLO sauvegardée (sessionStorage) : survit au
// rechargement de la page, se vide à la fermeture de l'onglet. Absente / d'une version
// obsolète / corrompue → partie neuve (loadSavedGame renvoie undefined). Les vilains
// custom référencés par l'état repris sont ré-enregistrés au runtime au démarrage
// (customVillainStore.load() déclenché dans Root) pour retrouver leurs cartes/images.
const restoredGame = loadSavedGame()
// Ré-injecte les images retirées à la sauvegarde depuis le registre runtime. Au démarrage,
// seuls les vilains NATIFS sont résolubles (VILLAIN_REGISTRY statique) ; les CUSTOM le
// seront après customVillainStore.load() → `hydrateResumedImages`, appelé par Root.
const resumeDefOf = (id: string) => villainEntry(id)?.def
// Garde-fou : une sauvegarde corrompue ou non ré-injectable ne doit jamais faire échouer
// l'import du store (écran blanc). En cas d'échec, on repart d'une partie neuve et on
// efface la sauvegarde fautive.
let restoredState: GameState | undefined
let restoredPreTest: GameState | null = null
try {
  restoredState = restoredGame ? reinjectVillainImages(restoredGame.state, resumeDefOf) : undefined
  restoredPreTest = restoredGame?.preTestState
    ? reinjectVillainImages(restoredGame.preTestState, resumeDefOf)
    : null
} catch {
  restoredState = undefined
  restoredPreTest = null
  clearSavedGame()
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: restoredState ?? newGame(),
  seats: restoredGame?.seats ?? SOLO_SEATS,
  localPlayerIndex: restoredGame?.localPlayerIndex ?? 0,
  mode: 'solo', // on ne reprend que le solo (snapshotForSave ne persiste que le solo)
  netStatus: 'idle',
  hostRoom: null,
  hostAddrs: null,
  netError: null,
  actionNotice: null,
  clearActionNotice: () => set({ actionNotice: null }),
  netLeftNotice: null,
  peerReacting: null,
  peerHover: null,
  lobby: null,
  testMode: restoredGame?.testMode ?? false,
  preTestState: restoredPreTest,
  tutorial: null,
  submit: (action) => {
    if (get().mode === 'solo') {
      // Tutoriel : on VERROUILLE le jeu sur l'action attendue par l'étape courante. Une
      // étape informative (ou une action non autorisée) refuse le coup avec un message doux.
      const tut = get().tutorial
      if (tut) {
        const step = TUTORIAL_STEPS[tut.stepIndex]
        const blocked = step && (step.info || (step.gate ? !step.gate(action, get().state) : true))
        if (blocked) {
          set({ actionNotice: step?.blockHint ?? 'Suis le tutoriel 🙂' })
          return
        }
      }
      // Un coup refusé (moteur qui `throw`) ne modifie pas l'état (applyAction est pur) :
      // au lieu de laisser l'erreur remonter (crash), on affiche son message en toast
      // (ex. « Dévoilez des Combattants ou terminez… » quand on clique ailleurs).
      try {
        set((s) => ({ state: applyAction(stampElapsed(s.state), action), actionNotice: null }))
      } catch (e) {
        set({ actionNotice: (e as Error)?.message ?? 'Coup impossible.' })
        return
      }
      // Tutoriel : avance à l'étape suivante si l'action attendue a été appliquée.
      const tut2 = get().tutorial
      if (tut2) {
        const step = TUTORIAL_STEPS[tut2.stepIndex]
        if (step?.advanceOn?.(action)) {
          set({ tutorial: { stepIndex: Math.min(TUTORIAL_STEPS.length - 1, tut2.stepIndex + 1) } })
        }
      }
      return
    }
    // Réseau : l'hôte applique+diffuse, le client envoie. Le store se met à jour
    // via le callback onState de la session (cf. cycle de vie réseau).
    activeSession?.submitLocal(action)
  },
  startHost: async () => {
    teardownNet()
    const room = makeRoomCode()
    set({
      mode: 'host', localPlayerIndex: 0, seats: ['local', 'remote'],
      hostRoom: room, hostAddrs: null, netStatus: 'connecting', netError: null,
      lobby: [
        { seat: 0, villainKey: null, ...myProfile(), connected: true },
        { seat: 1, villainKey: null, connected: false },
      ],
    })
    // Handlers de la connexion hôte (identiques quel que soit le transport) :
    // phase lobby (présence/vilain/survol/départ de l'invité), puis tout passe par
    // la session une fois la partie lancée.
    const handlers: ConnectionHandlers = {
      onMessage: (msg) => {
        // Partie lancée : tout passe par la session de jeu.
        if (activeSession) { (activeSession as HostSession).receive(msg); return }
        // Phase lobby (côté hôte) : présence de l'invité, son vilain, son départ.
        if (msg.type === 'LEAVE') {
          handlePeerGone(set, get, 'L’autre joueur a quitté la partie.')
          return
        } else if (msg.type === 'JOIN') {
          set((s) => ({
            lobby: s.lobby?.map((x) =>
              x.seat === 1
                ? { ...x, connected: true, name: msg.name, avatarVillain: msg.avatarVillain, avatarColor: msg.avatarColor }
                : x,
            ) ?? null,
            netStatus: 'lobby',
          }))
        } else if (msg.type === 'SELECT_VILLAIN') {
          set((s) => ({
            lobby: s.lobby?.map((x) => (x.seat === 1 ? { ...x, villainKey: msg.villainKey } : x)) ?? null,
          }))
        } else if (msg.type === 'HOVER_VILLAIN') {
          // Survol éphémère de l'invité : simple reflet visuel, pas de rediffusion.
          set({ peerHover: (msg.villainKey as VillainKey | null) ?? null })
          return
        } else return
        const lob = get().lobby
        if (lob) sendLobby(lob)
      },
      onOpen: () => set({ netStatus: 'waiting' }),
      onClose: () => handlePeerGone(set, get, 'La connexion avec l’autre joueur a été perdue.'),
      onError: () => set({ netStatus: 'error', netError: 'Erreur réseau (mise en relation impossible).' }),
    }
    // .exe Tauri : relais LAN embarqué (jeu sur le même réseau, hors-ligne) —
    // `location.hostname` vaut `tauri.localhost`, d'où 127.0.0.1 + IP LAN affichée.
    // Ailleurs (web/Electron) : canal P2P WebRTC via broker public → fonctionne en
    // LAN **et** sur Internet, l'invité n'a besoin que du code court.
    if (isTauri()) {
      try {
        await ensureRelay()
        lanAddresses().then((addrs) => set({ hostAddrs: addrs })).catch(() => {})
      } catch {
        set({ netStatus: 'error', netError: 'Impossible de démarrer le serveur de liaison.' })
        return
      }
      activeConnection = connect(relayUrl('127.0.0.1'), room, handlers)
    } else {
      try {
        const peerFactory = await createPeerFactory()
        activeConnection = connectPeer('host', { code: room, peerFactory, handlers })
      } catch {
        set({ netStatus: 'error', netError: 'Impossible d’initialiser la connexion en ligne.' })
        return
      }
    }
  },
  joinHost: async (code, host) => {
    teardownNet()
    let session: ClientSession | null = null
    const handlers: ConnectionHandlers = {
      onMessage: (msg) => session?.receive(msg),
      onOpen: () => set({ netStatus: 'waiting' }),
      onClose: () => handlePeerGone(set, get, 'La connexion avec l’hôte a été perdue.'),
      onError: () => set({ netStatus: 'error', netError: 'Erreur réseau (hôte injoignable ?).' }),
    }
    // Même dualité que startHost : relais LAN en .exe Tauri, sinon canal P2P (code).
    if (isTauri()) {
      activeConnection = connect(relayUrl(host), code.toUpperCase(), handlers)
    } else {
      try {
        const peerFactory = await createPeerFactory()
        activeConnection = connectPeer('guest', { code, peerFactory, handlers })
      } catch {
        set({ netStatus: 'error', netError: 'Impossible d’initialiser la connexion en ligne.' })
        return
      }
    }
    session = createClientSession({
      transport: { send: activeConnection.send },
      ...myProfile(),
      callbacks: {
        onLobby: (m) => set({ lobby: m.seats, netStatus: 'lobby' }),
        onAssign: (seat) => set({ localPlayerIndex: seat, seats: seat === 0 ? ['local', 'remote'] : ['remote', 'local'] }),
        onState: (state) => set({ state, netStatus: 'playing' }),
        onLeave: () => handlePeerGone(set, get, 'L’autre joueur a quitté la partie.'),
        onReacting: (m) => set({ peerReacting: m.reacting ? (m.villainName ?? '') : null }),
        onHover: (m) => set({ peerHover: (m.villainKey as VillainKey | null) ?? null }),
      },
    })
    activeSession = session
    set({ mode: 'client', localPlayerIndex: 1, seats: ['remote', 'local'], netStatus: 'connecting', netError: null, lobby: null })
  },
  setReacting: (on, villainName) => {
    activeConnection?.send({ type: 'REACTING', reacting: on, villainName })
  },
  setHoverVillain: (villainKey) => {
    // Réseau uniquement : on diffuse directement à l'autre joueur (non autoritaire).
    if (get().mode === 'solo') return
    activeConnection?.send({ type: 'HOVER_VILLAIN', villainKey })
  },
  selectVillain: (villainKey) => {
    const { mode } = get()
    const mySeat = get().localPlayerIndex
    set((s) => ({ lobby: s.lobby?.map((x) => (x.seat === mySeat ? { ...x, villainKey } : x)) ?? null }))
    if (mode === 'host') {
      const lob = get().lobby
      if (lob) sendLobby(lob)
    } else if (mode === 'client') {
      ;(activeSession as ClientSession | null)?.selectVillain(villainKey)
    }
  },
  launchGame: () => {
    const { mode, lobby } = get()
    if (mode !== 'host' || !lobby) return
    const hostV = lobby[0].villainKey as VillainKey | null
    const clientV = lobby[1].villainKey as VillainKey | null
    if (!hostV || !clientV) return
    const initial = newGame([hostV, clientV])
    const session = createHostSession({
      transport: { send: activeConnection!.send },
      initialState: initial,
      seats: ['human', 'human'],
      hostSeat: 0,
      callbacks: {
        onState: (state) => set({ state }),
        onLeave: () => handlePeerGone(set, get, 'L’autre joueur a quitté la partie.'),
        onReacting: (m) => set({ peerReacting: m.reacting ? (m.villainName ?? '') : null }),
      },
    })
    activeSession = session
    set({ state: initial, netStatus: 'playing' })
    session.start() // diffuse ASSIGN + STATE à l'invité
  },
  quitNet: () => {
    activeConnection?.send({ type: 'LEAVE' }) // prévient l'autre joueur…
    get().leaveNet() // …puis coupe et revient au solo.
  },
  leaveNet: () => {
    teardownNet()
    set({ mode: 'solo', seats: SOLO_SEATS, localPlayerIndex: 0, netStatus: 'idle', hostRoom: null, hostAddrs: null, netError: null, netLeftNotice: null, peerReacting: null, peerHover: null, lobby: null })
  },
  enterTestMode: () =>
    set((s) => ({
      // On mémorise la partie AVANT le test (sauf si on est DÉJÀ en test : on garde
      // alors l'instantané d'origine pour pouvoir revenir à la vraie partie).
      preTestState: s.testMode ? s.preTestState : s.state,
      state: buildTestState(s.state),
      testMode: true,
    })),
  exitTestMode: () =>
    set((s) => {
      // Restaure la partie d'avant telle quelle (main, plateaux, vilains conservés).
      // Repli défensif : si aucun instantané, on relance avec les vilains courants.
      const restored = s.preTestState ?? newGame(s.state.players.map((p) => p.villain) as [string, string])
      return { state: restored, testMode: false, preTestState: null }
    }),
  testInsertCard: (playerIndex, locationId, cardId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      const players = s.state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, board: { ...p.board, [locationId]: [...(p.board[locationId] ?? []), card] } }
          : p,
      )
      return { state: { ...s.state, players } }
    }),
  testPlaceFate: (cardId, to) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLACE_FATE', card, to }) }
    }),
  testPlayCondition: (cardId, allyInstanceId, to) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLAY_CONDITION', card, allyInstanceId, to }) }
    }),
  testAddToHand: (cardId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      const players = s.state.players.map((p, i) => (i === 0 ? { ...p, hand: [...p.hand, card] } : p))
      return { state: { ...s.state, players } }
    }),
  testAddToAuDela: (cardId) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      const players = s.state.players.map((p, i) => (i === 0 ? { ...p, auDela: [...p.auDela, card] } : p))
      return { state: { ...s.state, players } }
    }),
  testPlayFateCard: (cardId, targetHeroId, enlargeToward) =>
    set((s) => {
      const card = instanceOf(cardId, ++testFateCounter)
      if (!card) return s
      return { state: applyAction(s.state, { type: 'TEST_PLAY_FATE_CARD', card, targetHeroId, enlargeToward }) }
    }),
  testShowcase: (kind, playerIndex, opts) =>
    set((s) => {
      const key = villainKeyOf(s.state.players[playerIndex].villain)
      const cards = VILLAIN_REGISTRY[key].cards
      if (kind === 'card') {
        // Carte simple (Événement/Condition) — on évite une Malédiction (skip humain).
        const c = cards.find((x) => x.deck === 'villain' && x.type !== 'curse') ?? cards[0]
        return { state: pushShowcase(s.state, c.id, 'Aperçu — carte simple', playerIndex, undefined, undefined, opts) }
      }
      if (kind === 'hero') {
        const h = cards.find((x) => x.deck === 'fate' && x.type === 'hero')
        const loc = s.state.players[playerIndex].locations[0]?.id ?? ''
        if (!h) return s
        return {
          state: pushShowcase(s.state, h.id, 'Aperçu — Héros (vol)', playerIndex, { playerIndex, locationId: loc }, `preview#${++testFateCounter}`, opts),
        }
      }
      // Défausse (rouge = retiré par attaque ; foncé = défausse volontaire).
      // On répète le paquet Vilain pour atteindre le nombre de cartes demandé.
      const pool = cards.filter((x) => x.deck === 'villain')
      const count = Math.max(1, opts?.count ?? 3)
      const ids = pool.length === 0 ? [] : Array.from({ length: count }, (_, i) => pool[i % pool.length].id)
      const variant = kind === 'discard-red' ? 'red' : 'dark'
      return { state: pushDiscardShowcase(s.state, ids, 'Aperçu — défausse', playerIndex, variant, 'bottom', opts) }
    }),
  testRefreshTurn: () =>
    set((s) => {
      const drawn = drawPlayerToLimit(s.state.players[0], s.state.rngState)
      // Pion « non placé » + phase MOVE → on peut choisir n'importe lequel des
      // 4 lieux pour ce nouveau tour de test (comme la mise en place).
      const players = s.state.players.map((p, i) =>
        i === 0 ? { ...drawn.player, pawnLocation: null, skipNextMove: false } : p,
      )
      return {
        state: {
          ...s.state,
          players,
          rngState: drawn.rngState,
          activePlayer: 0,
          phase: 'MOVE',
          usedActionIds: [],
          persifleurAvailable: false,
          pendingFate: null,
          diabloFree: null,
          lastVanquishedHeroStrength: undefined,
          log: [...s.state.log, '[TEST] Nouveau tour — choisis le lieu de ton pion.'],
        },
      }
    }),
  setStartingPlayer: (index, rolls) =>
    set((s) => {
      const names = s.state.players.map((p) => p.villainName)
      // Compensation : le joueur qui NE commence PAS démarre avec 1 Pouvoir.
      const players = s.state.players.map((p, i) => ({ ...p, power: i === index ? 0 : 1 }))
      return {
        state: {
          ...s.state,
          activePlayer: index,
          players,
          log: [
            ...s.state.log,
            `🎲 Jet de dé : ${names[0]} fait ${rolls[0]}, ${names[1]} fait ${rolls[1]} → ${names[index]} commence !`,
          ],
        },
      }
    }),
  move: (to) =>
    get().submit({ type: 'MOVE', to }),
  moveTrack: (steps) =>
    get().submit({ type: 'MOVE_TRACK', steps }),
  skipMove: () =>
    get().submit({ type: 'SKIP_MOVE' }),
  executeAction: (actionId, count) =>
    get().submit({ type: 'EXECUTE_ACTION', actionId, count }),
  playCard: (actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId, engrenagesIds) =>
    get().submit({
        type: 'PLAY_CARD',
        actionId,
        instanceId,
        to,
        attachTo,
        targetHeroId,
        allyInstanceIds,
        allyMove,
        shrinkFreeActionId,
        engrenagesIds,
      }),
  discardCards: (actionId, instanceIds) =>
    get().submit({ type: 'DISCARD_CARDS', actionId, instanceIds }),
  moveCard: (actionId, instanceId, to) =>
    get().submit({ type: 'MOVE_CARD', actionId, instanceId, to }),
  thanosDeploy: (actionId, allyInstanceId, oppIndex, oppLocationId) =>
    get().submit({ type: 'THANOS_DEPLOY_ALLY', actionId, allyInstanceId, oppIndex, oppLocationId }),
  thanosRetrieve: (actionId, allyInstanceId, to) =>
    get().submit({ type: 'THANOS_RETRIEVE_ALLY', actionId, allyInstanceId, to }),
  moveHero: (actionId, heroInstanceId, to) =>
    get().submit({ type: 'MOVE_HERO', actionId, heroInstanceId, to }),
  activate: (actionId, cardInstanceId, to, itemInstanceId, allyInstanceIds) =>
    get().submit({ type: 'ACTIVATE', actionId, cardInstanceId, to, itemInstanceId, allyInstanceIds }),
  vanquish: (actionId, heroInstanceId, allyInstanceIds) =>
    get().submit({ type: 'VANQUISH', actionId, heroInstanceId, allyInstanceIds }),
  catchPokemon: (actionId, heroInstanceId) =>
    get().submit({ type: 'CATCH_POKEMON', actionId, heroInstanceId, allyInstanceIds: [] }),
  activateCauldron: () => get().submit({ type: 'ACTIVATE_CAULDRON' }),
  cauldronExchange: (squeletteInstanceId, soldierInstanceId) => get().submit({ type: 'CAULDRON_EXCHANGE', squeletteInstanceId, soldierInstanceId }),
  resolveCauldronChoice: (choice: 'cauldron' | 'power') => get().submit({ type: 'RESOLVE_CAULDRON_CHOICE', choice }),
  resolveMauiChoice: (choice: 'play' | 'discard') => get().submit({ type: 'RESOLVE_MAUI_CHOICE', choice }),
  resolveDioDiscardAlly: (allyInstanceId) => get().submit({ type: 'RESOLVE_DIO_DISCARD_ALLY', allyInstanceId }),
  resolveDioCream: (heroInstanceId) => get().submit({ type: 'RESOLVE_DIO_CREAM', heroInstanceId }),
  resolveDioMuda: (heroInstanceId) => get().submit({ type: 'RESOLVE_DIO_MUDA', heroInstanceId }),
  resolveDioSunlight: (choice) => get().submit({ type: 'RESOLVE_DIO_SUNLIGHT', choice }),
  resolvePacteSang: (instanceId) => get().submit({ type: 'RESOLVE_PACTE_SANG', instanceId }),
  resolveSacrifice: (choice) => get().submit({ type: 'RESOLVE_SACRIFICE', choice }),
  resolveCageMove: (locationId) => get().submit({ type: 'RESOLVE_CAGE_MOVE', locationId }),
  resolveCrustaceanPlace: (to: string) => get().submit({ type: 'RESOLVE_CRUSTACEAN_PLACE', to }),
  resolveFateAllyToAuDela: (allyInstanceId: string) => get().submit({ type: 'RESOLVE_FATE_ALLY_TO_AUDELA', allyInstanceId }),
  resolveFateDiscardHand: (cardInstanceId: string) => get().submit({ type: 'RESOLVE_FATE_DISCARD_HAND', cardInstanceId }),
  resolveUntrapTitans: (instanceIds: string[]) => get().submit({ type: 'RESOLVE_UNTRAP_TITANS', instanceIds }),
  resolveDiversionDiscard: (cardInstanceId: string) => get().submit({ type: 'RESOLVE_DIVERSION_DISCARD', cardInstanceId }),
  resolveBargainChoice: (choice: 'reshuffle' | 'sword') => get().submit({ type: 'RESOLVE_BARGAIN_CHOICE', choice }),
  resolveFreeItemPlay: (instanceId: string, to: string) => get().submit({ type: 'RESOLVE_FREE_ITEM_PLAY', instanceId, to }),
  skipFreeItemPlay: () => get().submit({ type: 'SKIP_FREE_ITEM_PLAY' }),
  discardDeguisement: (instanceId) =>
    get().submit({ type: 'DISCARD_DEGUISEMENT', instanceId }),
  sheriffMove: (instanceId, to) =>
    get().submit({ type: 'SHERIFF_MOVE', instanceId, to }),
  diabloMove: (instanceId, to) =>
    get().submit({ type: 'DIABLO_MOVE', instanceId, to }),
  diabloFreeAction: (inner) =>
    get().submit({ type: 'DIABLO_FREE_ACTION', action: inner }),
  diabloSkipFreeAction: () =>
    get().submit({ type: 'DIABLO_SKIP_FREE_ACTION' }),
  performGrantedAction: (inner) =>
    get().submit({ type: 'PERFORM_GRANTED_ACTION', action: inner }),
  skipGrantedAction: () =>
    get().submit({ type: 'SKIP_GRANTED_ACTION' }),
  resolveObstacle: (locationId) =>
    get().submit({ type: 'RESOLVE_OBSTACLE', locationId }),
  doneObstacle: () =>
    get().submit({ type: 'DONE_OBSTACLE' }),
  obtainKey: (actionId) =>
    get().submit({ type: 'OBTAIN_KEY', actionId }),
  resolveKey: (keyId, locationId) =>
    get().submit({ type: 'RESOLVE_KEY', keyId, locationId }),
  resolveKeyColor: (color) =>
    get().submit({ type: 'RESOLVE_KEY_COLOR', color }),
  resolvePlaisir: (choice) =>
    get().submit({ type: 'RESOLVE_PLAISIR', choice }),
  resolveStealKey: (keyId, locationId) =>
    get().submit({ type: 'RESOLVE_STEAL_KEY', keyId, locationId }),
  trapVanquish: (heroInstanceId, allyInstanceIds) =>
    get().submit({ type: 'TRAP_VANQUISH', heroInstanceId, allyInstanceIds }),
  trapSkipVanquish: () =>
    get().submit({ type: 'TRAP_SKIP_VANQUISH' }),
  skipRemoteAction: () =>
    get().submit({ type: 'SKIP_REMOTE_ACTION' }),
  playCondition: (playerIndex, instanceId, allyInstanceId, to) =>
    get().submit({
        type: 'PLAY_CONDITION',
        playerIndex,
        instanceId,
        allyInstanceId,
        to,
      }),
  fate: (actionId) =>
    get().submit({ type: 'FATE', actionId }),
  resolveFate: (instanceId, to, targetHeroId, enlargeToward) =>
    get().submit({ type: 'RESOLVE_FATE', instanceId, to, targetHeroId, enlargeToward }),
  passFate: () => get().submit({ type: 'PASS_FATE' }),
  resolveTyrannyDiscard: (instanceIds) =>
    get().submit({ type: 'RESOLVE_TYRANNY_DISCARD', instanceIds }),
  resolveHeroPlacement: (locationId) =>
    get().submit({ type: 'RESOLVE_HERO_PLACEMENT', locationId }),
  resolvePawnMove: (locationId) =>
    get().submit({ type: 'RESOLVE_PAWN_MOVE', locationId }),
  resolveHubertPull: (allyInstanceIds) =>
    get().submit({ type: 'RESOLVE_HUBERT_PULL', allyInstanceIds }),
  resolveDeckPeek: (keep) =>
    get().submit({ type: 'RESOLVE_DECK_PEEK', keep }),
  resolveTypeChoice: (cardType) =>
    get().submit({ type: 'RESOLVE_TYPE_CHOICE', cardType }),
  resolveDrawOrGainPower: (choice) =>
    get().submit({ type: 'RESOLVE_DRAW_OR_GAIN_POWER', choice }),
  resolveBloodTrace: (choice) => get().submit({ type: 'RESOLVE_BLOOD_TRACE', choice }),
  resolveInfiltration: (payload) =>
    get().submit({ type: 'RESOLVE_INFILTRATION', ...payload }),
  resolvePowerOrRacerBack: (choice) =>
    get().submit({ type: 'RESOLVE_POWER_OR_RACER_BACK', choice }),
  resolveTaffytaChoice: (choice) =>
    get().submit({ type: 'RESOLVE_TAFFYTA_CHOICE', choice }),
  resolveAigreBill: (dig) =>
    get().submit({ type: 'RESOLVE_AIGRE_BILL', dig }),
  resolvePayRace: (amount) =>
    get().submit({ type: 'RESOLVE_PAY_RACE', amount }),
  resolveBuyHouses: (amount) =>
    get().submit({ type: 'RESOLVE_BUY_HOUSES', amount }),
  resolveMoveHouses: (locationId) =>
    get().submit({ type: 'RESOLVE_MOVE_HOUSES', locationId }),
  resolveFreeFromJail: (arg) =>
    get().submit({ type: 'RESOLVE_FREE_FROM_JAIL', ...arg }),
  resolveBackwardMove: (locationId) =>
    get().submit({ type: 'RESOLVE_BACKWARD_MOVE', locationId }),
  resolvePawnBack: (amount) =>
    get().submit({ type: 'RESOLVE_PAWN_BACK', amount }),
  resolveBeacon: (arg) =>
    get().submit({ type: 'RESOLVE_BEACON', ...arg }),
  resolveMedal: (arg) =>
    get().submit({ type: 'RESOLVE_MEDAL', ...arg }),
  resolveActivateOrVanquish: (choice) =>
    get().submit({ type: 'RESOLVE_ACTIVATE_OR_VANQUISH', choice }),
  resolveScryDeckChoice: (deck) =>
    get().submit({ type: 'RESOLVE_SCRY_DECK_CHOICE', deck }),
  resolveRemoveFire: (locationId, actionId) =>
    get().submit({ type: 'RESOLVE_REMOVE_FIRE', locationId, actionId }),
  resolvePlaceFire: (locationId, actionId) =>
    get().submit({ type: 'RESOLVE_PLACE_FIRE', locationId, actionId }),
  resolveShereKhanDefeat: (heroInstanceId) =>
    get().submit({ type: 'RESOLVE_SHERE_KHAN_DEFEAT', heroInstanceId }),
  resolveRecoverFate: (instanceId) =>
    get().submit({ type: 'RESOLVE_RECOVER_FATE', instanceId }),
  resolveFreePlayAlly: (locationId) =>
    get().submit({ type: 'RESOLVE_FREE_PLAY_ALLY', locationId }),
  resolveFreePlayCard: (targetId, cancel) =>
    get().submit({ type: 'RESOLVE_FREE_PLAY_CARD', targetId, cancel }),
  resolvePickDiscardToPlay: (instanceId) =>
    get().submit({ type: 'RESOLVE_PICK_DISCARD_TO_PLAY', instanceId }),
  resolveYoung: (arg) =>
    get().submit({ type: 'RESOLVE_YOUNG', ...arg }),
  resolveRecoverToDeck: (arg) =>
    get().submit({ type: 'RESOLVE_RECOVER_TO_DECK', ...arg }),
  resolveInteressant: (arg) =>
    get().submit({ type: 'RESOLVE_INTERESSANT', ...arg }),
  resolveKaaPlay: (instanceId) =>
    get().submit({ type: 'RESOLVE_KAA_PLAY', instanceId }),
  resolveMonkeyKing: (arg) =>
    get().submit({ type: 'RESOLVE_MONKEY_KING', ...arg }),
  resolveKaaShield: (arg) =>
    get().submit({ type: 'RESOLVE_KAA_SHIELD', ...arg }),
  resolvePlaceTreasure: (arg) =>
    get().submit({ type: 'RESOLVE_PLACE_TREASURE', ...arg }),
  resolveRevealTreasure: (heroInstanceId) =>
    get().submit({ type: 'RESOLVE_REVEAL_TREASURE', heroInstanceId }),
  resolveMoveSwapTreasure: (heroInstanceId) =>
    get().submit({ type: 'RESOLVE_MOVE_SWAP_TREASURE', heroInstanceId }),
  resolveWakeKraken: (allyInstanceId) =>
    get().submit({ type: 'RESOLVE_WAKE_KRAKEN', allyInstanceId }),
  resolveMoveOrActivate: (choice) =>
    get().submit({ type: 'RESOLVE_MOVE_OR_ACTIVATE', choice }),
  resolveMaximusCavaliers: (allyInstanceId, to) =>
    get().submit({ type: 'RESOLVE_MAXIMUS_CAVALIERS', allyInstanceId, to }),
  resolveMaximusMove: (to) =>
    get().submit({ type: 'RESOLVE_MAXIMUS_MOVE', to }),
  resolveFateReorder: (orderedIds) =>
    get().submit({ type: 'RESOLVE_FATE_REORDER', orderedIds }),
  resolveRaiponceHomeward: (steps) =>
    get().submit({ type: 'RESOLVE_RAIPONCE_HOMEWARD', steps }),
  resolveRaiponceToTower: (move) =>
    get().submit({ type: 'RESOLVE_RAIPONCE_TO_TOWER', move }),
  resolvePuppyAdd: (tileId) =>
    get().submit({ type: 'RESOLVE_PUPPY_ADD', tileId }),
  resolvePuppyReveal: (tileId) =>
    get().submit({ type: 'RESOLVE_PUPPY_REVEAL', tileId }),
  donePuppyReveal: () =>
    get().submit({ type: 'DONE_PUPPY_REVEAL' }),
  resolveFighterReveal: (tileId) =>
    get().submit({ type: 'RESOLVE_FIGHTER_REVEAL', tileId }),
  doneFighterReveal: () =>
    get().submit({ type: 'DONE_FIGHTER_REVEAL' }),
  resolveFighterKillColor: (color) =>
    get().submit({ type: 'RESOLVE_FIGHTER_KILL_COLOR', color }),
  resolveFighterKillFree: (tileId) =>
    get().submit({ type: 'RESOLVE_FIGHTER_KILL_FREE', tileId }),
  doneFighterKillFree: () =>
    get().submit({ type: 'DONE_FIGHTER_KILL_FREE' }),
  resolveDestinChoice: (choice) =>
    get().submit({ type: 'RESOLVE_DESTIN_CHOICE', choice }),
  resolveHoraceChoice: (capture) =>
    get().submit({ type: 'RESOLVE_HORACE_CHOICE', capture }),
  resolvePuppyCapture: (tileId) =>
    get().submit({ type: 'RESOLVE_PUPPY_CAPTURE', tileId }),
  resolveQuelsIdiots: (choice) =>
    get().submit({ type: 'RESOLVE_QUELS_IDIOTS', choice }),
  resolveQuelsIdiotsPick: (instanceId) =>
    get().submit({ type: 'RESOLVE_QUELS_IDIOTS_PICK', instanceId }),
  sacrificeCrown: (instanceId) =>
    get().submit({ type: 'SACRIFICE_COURONNE', instanceId }),
  resolveHeroRelocate: (heroInstanceId, to) =>
    get().submit({ type: 'RESOLVE_HERO_RELOCATE', heroInstanceId, to }),
  skipHeroRelocate: () =>
    get().submit({ type: 'SKIP_HERO_RELOCATE' }),
  resolvePiegeurTarget: (survivorInstanceId) =>
    get().submit({ type: 'RESOLVE_PIEGEUR_TARGET', survivorInstanceId }),
  resolvePiegeurDest: (to) => get().submit({ type: 'RESOLVE_PIEGEUR_DEST', to }),
  discardPalette: (instanceId) => get().submit({ type: 'DISCARD_PALETTE', instanceId }),
  resolveAllyRelocate: (allyInstanceId, to) =>
    get().submit({ type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId, to }),
  skipAllyRelocate: () => get().submit({ type: 'SKIP_ALLY_RELOCATE' }),
  resolvePokemonSummon: (cardId) => get().submit({ type: 'RESOLVE_POKEMON_SUMMON', cardId }),
  resolveKoPokemon: (instanceId) => get().submit({ type: 'RESOLVE_KO_POKEMON', instanceId }),
  completeUltronUpgrade: (discard) => get().submit({ type: 'ULTRON_COMPLETE_UPGRADE', discard }),
  ultronOptimizeMove: (actionId, instanceId, to) =>
    get().submit({ type: 'ULTRON_OPTIMIZE_MOVE', actionId, instanceId, to }),
  resolveFateDiscardAlly: (instanceId) => get().submit({ type: 'RESOLVE_FATE_DISCARD_ALLY', instanceId }),
  resolveIdentification: (cardInstanceId, to) =>
    get().submit({ type: 'RESOLVE_IDENTIFICATION', cardInstanceId, to }),
  resolveLotsoTarget: (instanceId) => get().submit({ type: 'RESOLVE_LOTSO_TARGET', instanceId }),
  resolveEvolveAlly: (instanceId) => get().submit({ type: 'RESOLVE_EVOLVE_ALLY', instanceId }),
  resolveLotsoBuzzMove: (to) => get().submit({ type: 'RESOLVE_LOTSO_BUZZ_MOVE', to }),
  resolveLotsoBookworm: (heroInstanceId) => get().submit({ type: 'RESOLVE_LOTSO_BOOKWORM', heroInstanceId }),
  resolveLotsoFlex: (arg) => get().submit({ type: 'RESOLVE_LOTSO_FLEX', ...arg }),
  resolveTeleport: (to) =>
    get().submit({ type: 'RESOLVE_TELEPORT', to }),
  resolveManipulation: (instanceId) =>
    get().submit({ type: 'RESOLVE_MANIPULATION', instanceId }),
  resolveMauvaisCoup: (keepInstanceId, otherPlacement) =>
    get().submit({ type: 'RESOLVE_MAUVAIS_COUP', keepInstanceId, otherPlacement }),
  resolveSournois: (instanceId, placement) =>
    get().submit({ type: 'RESOLVE_SOURNOIS', instanceId, placement }),
  resolveAllyItemMove: (instanceId, to) =>
    get().submit({ type: 'RESOLVE_ALLY_ITEM_MOVE', instanceId, to }),
  resolveAllyItemMoveAuto: () =>
    get().submit({ type: 'RESOLVE_ALLY_ITEM_MOVE', instanceId: null, to: null, auto: true }),
  resolveBanditChain: (instanceIds) =>
    get().submit({ type: 'RESOLVE_BANDIT_CHAIN', instanceIds }),
  resolveDingo: (from, to) =>
    get().submit({ type: 'RESOLVE_DINGO', from, to }),
  dismissRoyalCroquet: () =>
    get().submit({ type: 'DISMISS_ROYAL_CROQUET' }),
  resolveTransformWickets: (instanceIds) =>
    get().submit({ type: 'RESOLVE_TRANSFORM_WICKETS', instanceIds }),
  resolveScry: (topInstanceIds) =>
    get().submit({ type: 'RESOLVE_SCRY', topInstanceIds }),
  resolveAllyMoveBuff: (instanceId, to) =>
    get().submit({ type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId, to }),
  skipAllyMoveBuff: () =>
    get().submit({ type: 'SKIP_ALLY_MOVE_BUFF' }),
  resolveFateChoice: (instanceId) =>
    get().submit({ type: 'RESOLVE_FATE_CHOICE', instanceId }),
  resolveMerlinMove: (merlinInstanceId, to) =>
    get().submit({ type: 'RESOLVE_MERLIN_MOVE', merlinInstanceId, to }),
  resolveFetchedHero: (play, to) =>
    get().submit({ type: 'RESOLVE_FETCHED_HERO', play, to }),
  resolveCastleTheft: (to) =>
    get().submit({ type: 'RESOLVE_CASTLE_THEFT', to }),
  useNeverlandMap: (itemInstanceId, to, attachTo) =>
    get().submit({ type: 'USE_NEVERLAND_MAP', itemInstanceId, to, attachTo }),
  resolveRecover: (instanceId) =>
    get().submit({ type: 'RESOLVE_RECOVER', instanceId }),
  resolveBePrepared: (instanceId) =>
    get().submit({ type: 'RESOLVE_BE_PREPARED', instanceId }),
  resolveFreeHyena: (instanceId) =>
    get().submit({ type: 'RESOLVE_FREE_HYENA', instanceId }),
  resolveHakunaMatata: (mode, instanceId) =>
    get().submit({ type: 'RESOLVE_HAKUNA_MATATA', mode, instanceId }),
  resolveYzmaFateDeck: (locationId) =>
    get().submit({ type: 'RESOLVE_YZMA_FATE_DECK', locationId }),
  resolveYzmaFateCard: (instanceId) =>
    get().submit({ type: 'RESOLVE_YZMA_FATE_CARD', instanceId }),
  resolveYzmaOwnDeck: (locationId) =>
    get().submit({ type: 'RESOLVE_YZMA_OWN_DECK', locationId }),
  resolveYzmaHammer: (instanceIds) =>
    get().submit({ type: 'RESOLVE_YZMA_HAMMER', instanceIds }),
  resolveYzmaManipulate: (heroInstanceId, locationIds) =>
    get().submit({ type: 'RESOLVE_YZMA_MANIPULATE', heroInstanceId, locationIds }),
  resolveFinishJob: (allyInstanceId, to) =>
    get().submit({ type: 'RESOLVE_FINISH_JOB', allyInstanceId, to }),
  resolveBeautySleep: (gainPower, draw, heroMove) =>
    get().submit({ type: 'RESOLVE_BEAUTY_SLEEP', gainPower, draw, heroMove }),
  resolveReplayEvent: (instanceId) =>
    get().submit({ type: 'RESOLVE_REPLAY_EVENT', instanceId }),
  resolveDice: () => get().submit({ type: 'RESOLVE_DICE' }),
  resolveDiceReroll: (instanceId, dieIndex) =>
    get().submit({ type: 'RESOLVE_DICE_REROLL', instanceId, dieIndex }),
  resolveDiceChoice: (dice) => get().submit({ type: 'RESOLVE_DICE_CHOICE', dice }),
  skipFreeRealmAction: () => get().submit({ type: 'SKIP_FREE_REALM_ACTION' }),
  resolveCrewmateKill: (color) =>
    get().submit({ type: 'RESOLVE_CREWMATE_KILL', color }),
  resolveCrewmateSuspect: (color) =>
    get().submit({ type: 'RESOLVE_CREWMATE_SUSPECT', color }),
  doneCrewmateSuspect: () =>
    get().submit({ type: 'DONE_CREWMATE_SUSPECT' }),
  resolveCrewmateMove: (to) =>
    get().submit({ type: 'RESOLVE_CREWMATE_MOVE', to }),
  doneCrewmateMove: () =>
    get().submit({ type: 'DONE_CREWMATE_MOVE' }),
  resolveFateObjectPlace: (locationId) =>
    get().submit({ type: 'RESOLVE_FATE_OBJECT_PLACE', locationId }),
  resolveFateHeroPlace: (locationId) =>
    get().submit({ type: 'RESOLVE_FATE_HERO_PLACE', locationId }),
  resolveFateDiscardType: (cardType) =>
    get().submit({ type: 'RESOLVE_FATE_DISCARD_TYPE', cardType }),
  removeFateLocationCard: (instanceId) =>
    get().submit({ type: 'REMOVE_FATE_LOCATION_CARD', instanceId }),
  resolveGiantLocation: (locationId) =>
    get().submit({ type: 'RESOLVE_GIANT_LOCATION', locationId }),
  resolveTitanMove: (titanInstanceId, to) =>
    get().submit({ type: 'RESOLVE_TITAN_MOVE', titanInstanceId, to }),
  resolveTitanSelect: (titanInstanceId) =>
    get().submit({ type: 'RESOLVE_TITAN_SELECT', titanInstanceId }),
  resolveDivination: (topInstanceIds) =>
    get().submit({ type: 'RESOLVE_DIVINATION', topInstanceIds }),
  resolveLookTop: (keepInstanceIds, toTop) =>
    get().submit({ type: 'RESOLVE_LOOK_TOP', keepInstanceIds, toTop }),
  resolveWeaponFetch: (instanceId, equip) =>
    get().submit({ type: 'RESOLVE_WEAPON_FETCH', instanceId, equip }),
  acknowledgeReveal: () => get().submit({ type: 'ACKNOWLEDGE_REVEAL' }),
  resolveHack: (actionId) => get().submit({ type: 'RESOLVE_HACK', actionId }),
  resolveInformation: (discardDrawn) => get().submit({ type: 'RESOLVE_INFORMATION', discardDrawn }),
  resolveDiscardThenDraw: (instanceIds) => get().submit({ type: 'RESOLVE_DISCARD_THEN_DRAW', instanceIds }),
  resolveTakeABite: (heroInstanceId) =>
    get().submit({ type: 'RESOLVE_TAKE_A_BITE', heroInstanceId }),
  resolveGrantLove: (heroInstanceId) =>
    get().submit({ type: 'RESOLVE_GRANT_LOVE', heroInstanceId }),
  resolveDuplicateIngredient: (ingredientInstanceId) =>
    get().submit({ type: 'RESOLVE_DUPLICATE_INGREDIENT', ingredientInstanceId }),
  cancelDuplicateIngredient: () => get().submit({ type: 'CANCEL_DUPLICATE_INGREDIENT' }),
  resolveScream: (from, to) => get().submit({ type: 'RESOLVE_SCREAM', from, to }),
  resolveFateScry: (toAudelaIds, deckTopOrder) =>
    get().submit({ type: 'RESOLVE_FATE_SCRY', toAudelaIds, deckTopOrder }),
  useCanne: () =>
    get().submit({ type: 'USE_CANNE' }),
  useCanneMonopoly: () =>
    get().submit({ type: 'USE_CANNE_MONOPOLY' }),
  resolveCanneBorrow: (locationId, actionId) =>
    get().submit({ type: 'RESOLVE_CANNE_BORROW', locationId, actionId }),
  chariotMove: (instanceId, to) =>
    get().submit({ type: 'CHARIOT_MOVE', instanceId, to }),
  zaWarudoRelocate: (to) =>
    get().submit({ type: 'ZA_WARUDO_RELOCATE', to }),
  endTurn: () =>
    get().submit({ type: 'END_TURN' }),
  hydrateResumedImages: () =>
    set((s) => ({
      state: reinjectVillainImages(s.state, resumeDefOf),
      preTestState: s.preTestState ? reinjectVillainImages(s.preTestState, resumeDefOf) : null,
    })),
  reset: (villains) => {
    teardownNet()
    set({
      state: newGame(villains), testMode: false, seats: SOLO_SEATS, localPlayerIndex: 0,
      mode: 'solo', netStatus: 'idle', hostRoom: null, hostAddrs: null, netError: null, netLeftNotice: null, peerReacting: null, lobby: null,
      tutorial: null,
    })
  },
  startTutorial: () => {
    teardownNet()
    set({
      state: tutorialGame(),
      tutorial: { stepIndex: 0 },
      testMode: false, seats: SOLO_SEATS, localPlayerIndex: 0,
      mode: 'solo', netStatus: 'idle', hostRoom: null, hostAddrs: null, netError: null, netLeftNotice: null, peerReacting: null, lobby: null,
    })
  },
  tutorialNext: () =>
    set((s) => (s.tutorial ? { tutorial: { stepIndex: Math.min(TUTORIAL_STEPS.length - 1, s.tutorial.stepIndex + 1) } } : {})),
  endTutorial: () => set({ tutorial: null }),
  startCustomGame: (custom, opponent) => {
    teardownNet()
    set({
      state: customGame(custom, opponent), testMode: false, seats: SOLO_SEATS, localPlayerIndex: 0,
      mode: 'solo', netStatus: 'idle', hostRoom: null, hostAddrs: null, netError: null, netLeftNotice: null, peerReacting: null, lobby: null,
    })
  },
  // DEV : partie ordi vs ordi — identique à `reset` mais les DEUX sièges sont des bots
  // (le pilote de tour d'App.tsx auto-joue alors les deux camps en alternance). On reste
  // en `mode: 'solo'` (point de vue local 0) : on observe la partie se dérouler.
  startBotMatch: (villains) => {
    teardownNet()
    set({
      state: newGame(villains), testMode: false, seats: ['bot', 'bot'], localPlayerIndex: 0,
      mode: 'solo', netStatus: 'idle', hostRoom: null, hostAddrs: null, netError: null, netLeftNotice: null, peerReacting: null, lobby: null,
    })
  },
  botAct: () =>
    set((s) => {
      if (s.state.status !== 'PLAYING' || s.seats[s.state.activePlayer] !== 'bot') return s
      return { state: applyAction(s.state, chooseAction(s.state)) }
    }),
  botReact: () => {
    let played = false
    set((s) => {
      if (s.state.status !== 'PLAYING') return s
      // Pour chaque bot NON-ACTIF, tenter une Condition.
      for (let i = 0; i < s.state.players.length; i++) {
        if (i === s.state.activePlayer) continue
        if (s.seats[i] !== 'bot') continue
        const reaction = chooseReaction(s.state, i)
        if (reaction) {
          played = true
          return { state: applyAction(s.state, reaction) }
        }
      }
      return s
    })
    return played
  },
}))

// PERSISTANCE : à chaque changement du store, on écrit l'instantané sérialisable de la
// partie (UNIQUEMENT en solo, cf. snapshotForSave). Le GameState n'embarque aucune image
// → écriture sessionStorage légère. Ainsi un rechargement reprend la partie à l'identique ;
// la fermeture de l'onglet la vide (sessionStorage), et le retour au menu l'efface
// explicitement (clearSavedGame dans Root).
useGameStore.subscribe((s) => {
  const snap = snapshotForSave(s)
  if (snap) saveGame(snap)
})
