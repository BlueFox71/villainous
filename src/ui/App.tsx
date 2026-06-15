import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore, villainKeyOf, VILLAIN_REGISTRY, type VillainKey } from './store/gameStore'
import { useStatsStore } from './store/statsStore'
import { getCardDef } from '../data/registry'
import {
  activatableCards,
  adjacentLocationIds,
  canPlaceCurseAt,
  canTakeABite,
  cardNeedsAllyMove,
  cardNeedsHeroTarget,
  cardNeedsSacrificeTarget,
  cardNeedsStarAllyTarget,
  cardNeedsVanquishTarget,
  drainStarAllies,
  effectiveCost,
  effectiveStrength,
  getAvailableActions,
  getLegalMoves,
  hasHeroInRealm,
  heroPlacementLocations,
  maxBrewPoison,
  playableConditions,
  sacrificeableCards,
  teleportTargets,
  transformableGuards,
} from '../engine/rules'
import { titanReachableDests } from '../engine/effects'
import type { CardInstance, LocationAction, ShowcaseEvent } from '../engine/types'
import { BLUE, RED, accentVars } from './accents'
import { VILLAIN_COLOR, villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from './villainColors'
import { PlayerPanel } from './components/PlayerPanel'
import { Board } from './components/Board'
import { Hand } from './components/Hand'
import { GameLog } from './components/GameLog'
import { BoardImage, LOCATIONS_LEFT } from './components/BoardImage'
import { BoardActions } from './components/BoardActions'
import { HeroRow } from './components/HeroRow'
import { DeckPiles, AuDelaPile, IngredientsPile, SuccessionPile } from './components/DeckPiles'
import { StacksCards } from './components/StacksCards'
import { FateModal } from './components/FateModal'
import { ChoiceModal } from './components/ChoiceModal'
import { HeroPlacementModal } from './components/HeroPlacementModal'
import { FateObjectPlaceModal } from './components/FateObjectPlaceModal'
import { PawnMoveModal } from './components/PawnMoveModal'
import { HubertPullModal } from './components/HubertPullModal'
import { DeckPeekModal } from './components/DeckPeekModal'
import { TypeChoiceModal } from './components/TypeChoiceModal'
import { HeroRelocateModal } from './components/HeroRelocateModal'
import { TeleportModal } from './components/TeleportModal'
import { OptionsModal } from './components/OptionsModal'
import { ActivatePickModal } from './components/ActivatePickModal'
import { CardChoiceModal } from './components/CardChoiceModal'
import { RoyalCroquetModal } from './components/RoyalCroquetModal'
import { TransformWicketsModal } from './components/TransformWicketsModal'
import { ScryModal } from './components/ScryModal'
import { AllyMoveBuffModal } from './components/AllyMoveBuffModal'
import { FetchedHeroModal } from './components/FetchedHeroModal'
import { CastleTheftModal } from './components/CastleTheftModal'
import { VictoryModal } from './components/VictoryModal'
import { MirrorShatter } from './components/MirrorShatter'
import { NeverlandMapModal } from './components/NeverlandMapModal'
import { GiantActionModal } from './components/GiantActionModal'
import { TitanMoveModal } from './components/TitanMoveModal'
import { DivinationModal } from './components/DivinationModal'
import { LookTopModal } from './components/LookTopModal'
import { TakeABiteModal } from './components/TakeABiteModal'
import { BlackMagicModal } from './components/BlackMagicModal'
import { FateScryModal } from './components/FateScryModal'
import { TitanSelectModal } from './components/TitanSelectModal'
import { StartRollModal } from './components/StartRollModal'
import { MusicPlayer } from './components/MusicPlayer'
import { playKillSound, playTaskComplete, playDeadBody, playEmergencyMeeting, playYourTurn, playEndTurnFlip, playEndTurnEnable, playHover, startVictoryBuildup, startDefeatBuildup, stopVictoryBuildup } from './sfx'
import { playVillainIntro } from './villainVoices'
import { Showcase } from './components/Showcase'
import { TestFateBar } from './components/TestFateBar'
import { TestChecklist } from './components/TestChecklist'
import { CardPicker } from './components/CardPicker'
import { CardFlights, type CardFlight, type FlightRect } from './components/CardFlights'
import { Scroller } from './components/Scroller'
import { FloatingGains, type FloatingGain } from './components/FloatingGains'
import { GameTimer } from './components/GameTimer'
import { TurnSplash } from './components/TurnSplash'
import { BackgroundAnimation } from './components/BackgroundAnimation'
import { villainPresentation } from './villainArt'

// `diablo: true` sur un mode interactif = l'action en cours est l'action gratuite
// de Diablo (V2) : le dispatch final est encapsulé dans DIABLO_FREE_ACTION au lieu
// d'une action normale du pion. `actionId` porte alors l'id de l'action du LIEU
// DE DIABLO. Le drapeau se propage le long des transitions de mode.
type Mode =
  | { kind: 'play'; actionId: string; diablo?: boolean }
  | { kind: 'discard'; actionId: string; selected: string[] }
  /** Carte choisie ; on attend le clic sur le LIEU de destination. */
  | { kind: 'place'; actionId: string; instanceId: string; cardName: string; isAttach: boolean; diablo?: boolean }
  /** Lieu de destination choisi pour un Objet à associer ; on attend le clic sur l'Allié porteur. */
  | { kind: 'attach'; actionId: string; instanceId: string; cardName: string; to: string; diablo?: boolean }
  /** Objet à associer à un HÉROS (Forme de grenouille, Potion de mortalité) ; on
   *  attend le clic sur le Héros cible (n'importe quel lieu du royaume). */
  | { kind: 'item-attach-hero'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** « Déplacer un Allié/Objet » : on attend le clic sur la carte à déplacer. */
  | { kind: 'move-pick'; actionId: string }
  /** Carte à déplacer choisie ; on attend le clic sur un lieu voisin. */
  | { kind: 'move-dest'; actionId: string; instanceId: string; from: string; cardName: string }
  /** « Déplacer un Héros » : on attend le clic sur le Héros à déplacer. */
  | { kind: 'move-hero-pick'; actionId: string }
  /** Héros choisi ; on attend le clic sur un lieu voisin de sa position. */
  | { kind: 'move-hero-dest'; actionId: string; heroInstanceId: string; from: string; heroName: string }
  /** « Éliminer un Héros » : choix du Héros à cibler. `viaCard` = appel depuis
   *  une carte (Intimidation, Tendre un Piège) au lieu de l'action VANQUISH. */
  | {
      kind: 'vanquish-pick-hero'
      actionId: string
      viaCard?: { instanceId: string; cardName: string; allyMove?: { instanceId: string; to: string } }
      diablo?: boolean
      /** Vanquish facultatif de Tendre un Piège (déplacement déjà appliqué). */
      trap?: boolean
    }
  /** Héros choisi ; on coche les Alliés du lieu, total live, confirme. */
  | {
      kind: 'vanquish-pick-allies'
      actionId: string
      heroInstanceId: string
      heroName: string
      selected: string[]
      viaCard?: { instanceId: string; cardName: string; allyMove?: { instanceId: string; to: string } }
      diablo?: boolean
      trap?: boolean
    }
  /** Carte (ex. Emprisonnement) en attente de la cible Héros adverse. */
  | { kind: 'play-pick-hero'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Rapetisser — après le choix du Héros : choisir l'action du haut à LAISSER LIBRE
   *  (l'autre est recouverte par le Héros rapetissé). */
  | { kind: 'shrink-pick-action'; actionId: string; instanceId: string; cardName: string; heroInstanceId: string; diablo?: boolean }
  /** Tendre un Piège — phase 1 : choisir l'allié à déplacer. */
  | { kind: 'trap-pick-ally'; actionId: string; instanceId: string; cardName: string }
  /** Tendre un Piège — phase 2 : choisir le lieu de destination de l'allié. */
  | {
      kind: 'trap-pick-dest'
      actionId: string
      instanceId: string
      cardName: string
      allyInstanceId: string
      allyName: string
    }
  /** Déplacement gratuit du Shérif : on attend le clic sur le lieu de destination. */
  | { kind: 'sheriff-dest'; instanceId: string }
  /** Déplacement gratuit de Diablo : clic sur le lieu de destination. */
  | { kind: 'diablo-dest'; instanceId: string }
  /** Lâcheté — phase 1 : choisir l'Allié à poser gratuitement (en main). */
  | { kind: 'condition-pick-ally'; instanceId: string }
  /** Lâcheté — phase 2 : Allié choisi, on attend le lieu de pose. */
  | { kind: 'condition-pick-place'; instanceId: string; allyInstanceId: string; cardName: string; allyName: string }
  /** Méchanceté : choisir un Héros (≤4 force) à éliminer dans son royaume. */
  | { kind: 'condition-pick-hero'; instanceId: string }
  /** Jafar — « Activer » : choisir la carte à activer (si plusieurs candidates). */
  | { kind: 'activate-pick'; actionId: string }
  /** Jafar — Iago activé : on attend le clic sur le lieu voisin de destination.
   *  `itemInstanceId` = l'Objet à emmener (déjà choisi), ou undefined (Iago seul). */
  | { kind: 'activate-iago-dest'; actionId: string; cardInstanceId: string; from: string; itemInstanceId?: string }
  /** Jafar — Sacrifice Nécessaire : choisir l'Allié/Objet du royaume à défausser. */
  | { kind: 'sacrifice-pick'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Bowser — épuisement d'énergie : choisir l'Allié (sur le lieu du pion) qui
   *  reçoit l'Étoile drainée de l'Observatoire. */
  | { kind: 'drain-pick-ally'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Bowser — Impuissance : choix « Capturer Peach » OU « Éliminer un Héros ≤3 ». */
  | { kind: 'impuissance-choice'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Bowser — Impuissance (branche Éliminer) : cliquer le Héros ≤3 à éliminer. */
  | { kind: 'impuissance-pick-hero'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  | null

const BOT_STEP_MS = 700
// Délai avant que le bot ne pose la carte de Vol du château : laisse le joueur
// adverse lire les cartes dévoilées (modale affichée des deux côtés).
const CASTLE_THEFT_READ_MS = 2400

export default function App({ onExit }: { onExit?: () => void } = {}) {
  const state = useGameStore((s) => s.state)
  const move = useGameStore((s) => s.move)
  const skipMove = useGameStore((s) => s.skipMove)
  const executeAction = useGameStore((s) => s.executeAction)
  const playCard = useGameStore((s) => s.playCard)
  const discardCards = useGameStore((s) => s.discardCards)
  const moveCard = useGameStore((s) => s.moveCard)
  const moveHero = useGameStore((s) => s.moveHero)
  const setStartingPlayer = useGameStore((s) => s.setStartingPlayer)
  const activate = useGameStore((s) => s.activate)
  const vanquish = useGameStore((s) => s.vanquish)
  const discardDeguisement = useGameStore((s) => s.discardDeguisement)
  const sheriffMove = useGameStore((s) => s.sheriffMove)
  const diabloMove = useGameStore((s) => s.diabloMove)
  const diabloFreeAction = useGameStore((s) => s.diabloFreeAction)
  const diabloSkipFreeAction = useGameStore((s) => s.diabloSkipFreeAction)
  const trapVanquish = useGameStore((s) => s.trapVanquish)
  const trapSkipVanquish = useGameStore((s) => s.trapSkipVanquish)
  const playCondition = useGameStore((s) => s.playCondition)
  const fate = useGameStore((s) => s.fate)
  const resolveFate = useGameStore((s) => s.resolveFate)
  const passFate = useGameStore((s) => s.passFate)
  const resolveTyrannyDiscard = useGameStore((s) => s.resolveTyrannyDiscard)
  const resolveHeroPlacement = useGameStore((s) => s.resolveHeroPlacement)
  const resolvePawnMove = useGameStore((s) => s.resolvePawnMove)
  const resolveHubertPull = useGameStore((s) => s.resolveHubertPull)
  const resolveDeckPeek = useGameStore((s) => s.resolveDeckPeek)
  const resolveTypeChoice = useGameStore((s) => s.resolveTypeChoice)
  const resolveHeroRelocate = useGameStore((s) => s.resolveHeroRelocate)
  const skipHeroRelocate = useGameStore((s) => s.skipHeroRelocate)
  const resolveTeleport = useGameStore((s) => s.resolveTeleport)
  const resolveManipulation = useGameStore((s) => s.resolveManipulation)
  const dismissRoyalCroquet = useGameStore((s) => s.dismissRoyalCroquet)
  const resolveTransformWickets = useGameStore((s) => s.resolveTransformWickets)
  const resolveScry = useGameStore((s) => s.resolveScry)
  const resolveAllyMoveBuff = useGameStore((s) => s.resolveAllyMoveBuff)
  const skipAllyMoveBuff = useGameStore((s) => s.skipAllyMoveBuff)
  const resolveFateChoice = useGameStore((s) => s.resolveFateChoice)
  const resolveFetchedHero = useGameStore((s) => s.resolveFetchedHero)
  const resolveCastleTheft = useGameStore((s) => s.resolveCastleTheft)
  const resetGame = useGameStore((s) => s.reset)
  // Renommé sans préfixe « use » : c'est une action du store, pas un hook React
  // (sinon eslint react-hooks la croit appelée hors composant dans le callback).
  const playNeverlandMap = useGameStore((s) => s.useNeverlandMap)
  const resolveRecover = useGameStore((s) => s.resolveRecover)
  const resolveCrewmateKill = useGameStore((s) => s.resolveCrewmateKill)
  const resolveCrewmateSuspect = useGameStore((s) => s.resolveCrewmateSuspect)
  const doneCrewmateSuspect = useGameStore((s) => s.doneCrewmateSuspect)
  const resolveCrewmateMove = useGameStore((s) => s.resolveCrewmateMove)
  const doneCrewmateMove = useGameStore((s) => s.doneCrewmateMove)
  const resolveFateObjectPlace = useGameStore((s) => s.resolveFateObjectPlace)
  const resolveGiantLocation = useGameStore((s) => s.resolveGiantLocation)
  const resolveTitanMove = useGameStore((s) => s.resolveTitanMove)
  const resolveTitanSelect = useGameStore((s) => s.resolveTitanSelect)
  const resolveDivination = useGameStore((s) => s.resolveDivination)
  const resolveLookTop = useGameStore((s) => s.resolveLookTop)
  const resolveTakeABite = useGameStore((s) => s.resolveTakeABite)
  const resolveDuplicateIngredient = useGameStore((s) => s.resolveDuplicateIngredient)
  const cancelDuplicateIngredient = useGameStore((s) => s.cancelDuplicateIngredient)
  const resolveScream = useGameStore((s) => s.resolveScream)
  const resolveFateScry = useGameStore((s) => s.resolveFateScry)
  // Renommé sans préfixe « use » (action du store, pas un hook React).
  const activateCanne = useGameStore((s) => s.useCanne)
  const chariotMove = useGameStore((s) => s.chariotMove)
  const endTurn = useGameStore((s) => s.endTurn)
  const reset = useGameStore((s) => s.reset)
  const botAct = useGameStore((s) => s.botAct)
  const botReact = useGameStore((s) => s.botReact)
  const quitNet = useGameStore((s) => s.quitNet)
  const leaveNet = useGameStore((s) => s.leaveNet)
  const netLeftNotice = useGameStore((s) => s.netLeftNotice)
  const peerReacting = useGameStore((s) => s.peerReacting)
  const setReacting = useGameStore((s) => s.setReacting)
  // Contrôleur de chaque siège : remplace l'ancien BOTS[]. seats[i] === 'bot'
  // ⇒ l'UI auto-résout/enchaîne ce siège ; sinon c'est un humain (local/remote).
  const seats = useGameStore((s) => s.seats)
  // Point de vue : HUMAN = le joueur incarné par CE navigateur (0 en solo et
  // chez l'hôte, 1 chez l'invité), BOT = l'autre. Relativise tout l'affichage.
  const localPlayerIndex = useGameStore((s) => s.localPlayerIndex)
  const HUMAN = localPlayerIndex
  const BOT = 1 - localPlayerIndex
  const gameMode = useGameStore((s) => s.mode)
  const testMode = useGameStore((s) => s.testMode)
  const enterTestMode = useGameStore((s) => s.enterTestMode)
  const testInsertCard = useGameStore((s) => s.testInsertCard)
  const testPlaceFate = useGameStore((s) => s.testPlaceFate)
  const testPlayCondition = useGameStore((s) => s.testPlayCondition)
  const testAddToHand = useGameStore((s) => s.testAddToHand)
  const testAddToAuDela = useGameStore((s) => s.testAddToAuDela)
  const testPlayFateCard = useGameStore((s) => s.testPlayFateCard)
  const testShowcase = useGameStore((s) => s.testShowcase)
  const testRefreshTurn = useGameStore((s) => s.testRefreshTurn)

  // --- Statistiques de profil (par vilain humain) -------------------------
  // Le joueur humain est toujours le joueur 0 (cf. seats = ['local', 'bot']).
  const recordResult = useStatsStore((s) => s.recordResult)
  const recordGame = useStatsStore((s) => s.recordGame)
  const addPlaytime = useStatsStore((s) => s.addPlaytime)
  const humanVillainKey = villainKeyOf(state.players[0].villain)
  const opponentVillainKey = villainKeyOf(state.players[1].villain)

  // Temps de jeu : on mémorise l'instant d'entrée et on verse la durée écoulée
  // au démontage (retour au menu / fermeture). Un ref suit le vilain courant
  // pour créditer le bon compteur même si la partie change.
  const playStartRef = useRef(0)
  const villainKeyRef = useRef(humanVillainKey)
  // Mise à jour du ref hors rendu (les refs ne se modifient pas pendant le rendu).
  useEffect(() => {
    villainKeyRef.current = humanVillainKey
  }, [humanVillainKey])
  // Suit le vilain du siège local (peut différer du siège 0 en réseau).
  const localVillainKey = villainKeyOf(state.players[HUMAN].villain)
  useEffect(() => {
    humanVillainKeyRef.current = localVillainKey
  }, [localVillainKey])
  useEffect(() => {
    playStartRef.current = Date.now()
    return () => {
      addPlaytime(villainKeyRef.current, Date.now() - playStartRef.current)
    }
  }, [addPlaytime])

  // Voix d'intro : « mon vilain » → « Contre » → « vilain adverse », une seule
  // fois en entrant dans la partie (jamais en mode test). Le ref évite tout
  // rejeu si les clés (stables sur une partie) déclenchent un nouveau rendu.
  // `introVoiceDone` passe à vrai à la FIN de la voix → l'écran de dés attend.
  const introPlayedRef = useRef(false)
  const [introVoiceDone, setIntroVoiceDone] = useState(false)
  useEffect(() => {
    if (testMode || introPlayedRef.current) return
    introPlayedRef.current = true
    playVillainIntro(humanVillainKey, opponentVillainKey, () => setIntroVoiceDone(true))
  }, [testMode, humanVillainKey, opponentVillainKey])

  // Victoire/défaite : enregistrée une seule fois quand la partie se termine.
  const resultRecordedRef = useRef(false)
  useEffect(() => {
    if (state.status === 'WON' && !resultRecordedRef.current) {
      resultRecordedRef.current = true
      const humanWon = state.winner === 0
      recordResult(humanVillainKey, humanWon)
      recordGame({
        human: humanVillainKey,
        opponent: opponentVillainKey,
        winner: humanWon ? 'human' : 'opponent',
        at: Date.now(),
      })
    }
  }, [state.status, state.winner, humanVillainKey, opponentVillainKey, recordResult, recordGame])

  const [mode, setMode] = useState<Mode>(null)
  // Mode test : relance l'animation de décor d'un vilain au clic (boutons 🚢).
  const [debugAnim, setDebugAnim] = useState({ player: 0, opponent: 0 })
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  // Réseau : confirmation avant de quitter la partie (l'autre joueur sera prévenu).
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  // Intro de début de partie. Sautée en mode test. En réseau : présentation
  // « versus » SANS jet de dé (v1 : l'hôte commence — activePlayer 0).
  const [startRollDone, setStartRollDone] = useState(testMode)
  // Affiche « À vous de jouer » (4 s) au début de chaque tour du joueur humain.
  const [showTurnSplash, setShowTurnSplash] = useState(false)
  // L'Imposteur — bandeau « DEAD BODY REPORTED » (Corps découvert), affiché ~2,4 s.
  const [showDeadBody, setShowDeadBody] = useState(false)
  // L'Imposteur — bandeau « EMERGENCY MEETING » (Réunion d'urgence), affiché ~2,4 s.
  const [showEmergency, setShowEmergency] = useState(false)
  const lastHumanTurnRef = useRef<number | null>(null)
  // Vilain du joueur local (siège HUMAN), suivi par un ref pour être lu dans des
  // effets sans les faire dépendre de `state.players` (référence changeante).
  const humanVillainKeyRef = useRef<VillainKey | null>(null)
  // Choix de la carte à activer quand plusieurs sont activables (action « Activer »).
  const [activatePick, setActivatePick] = useState<{ actionId: string } | null>(null)
  // La Méchante Reine — « Préparer du Poison » : sélecteur du nombre de Pouvoir à
  // convertir en Poison (1 → max). `surcharge` = 1 si Timide est en jeu.
  const [brewPick, setBrewPick] = useState<
    { actionId: string; max: number; surcharge: number; count: number } | null
  >(null)
  // Iago : choix de l'Objet à emmener quand plusieurs Objets sont sur son lieu.
  const [iagoItemPick, setIagoItemPick] = useState<
    { actionId: string; cardInstanceId: string; from: string } | null
  >(null)
  // Tyrannie : cartes cochées pour la défausse en attente (état dérivé de
  // `state.pendingTyrannyDiscard`, pas de mode dédié — voir `tyrannyDiscard`).
  const [tyrannyPicks, setTyrannyPicks] = useState<string[]>([])
  // Défausse Tyrannie en attente CÔTÉ HUMAIN (sinon null) : pilote l'UI de
  // sélection directement, sans effet (cf. « you might not need an effect »).
  const tyrannyDiscard =
    state.pendingTyrannyDiscard?.playerIndex === HUMAN ? state.pendingTyrannyDiscard : null
  // MODE TEST : lieu dont la liste déroulante d'insertion est ouverte (+ ancrage).
  const [testPicker, setTestPicker] = useState<
    { playerIndex: number; locationId: string; x: number; y: number } | null
  >(null)
  // MODE TEST : message d'erreur du dernier « Infliger » (pose refusée).
  const [testFateError, setTestFateError] = useState<string | null>(null)
  // MODE TEST : masque le panneau de test (qui décale le layout réel) pour
  // vérifier les positions des showcases dans des conditions réelles.
  const [hideTestBar, setHideTestBar] = useState(false)
  // MODE TEST : aperçu de l'écran de fin (Victoire/Défaite) sans vraie partie
  // gagnée. `humanWon` = VICTOIRE/DÉFAITE ; l'image = winnerKey si victoire, sinon
  // loserKey. `null` = aucun aperçu.
  const [victoryPreview, setVictoryPreview] = useState<
    { humanWon: boolean; winnerKey: VillainKey; loserKey: VillainKey } | null
  >(null)
  // Inflige un Héros en capturant les refus de pose (sinon l'erreur est avalée).
  const handleInflict = (cardId: string, to: string) => {
    try {
      testPlaceFate(cardId, to)
      setTestFateError(null)
    } catch (e) {
      setTestFateError(e instanceof Error ? e.message : String(e))
    }
  }
  // Joue une Condition en mode test, en capturant les erreurs (cibles manquantes…).
  const handleTestCondition = (cardId: string, opts?: { allyInstanceId?: string; to?: string }) => {
    try {
      testPlayCondition(cardId, opts?.allyInstanceId, opts?.to)
      setTestFateError(null)
    } catch (e) {
      setTestFateError(e instanceof Error ? e.message : String(e))
    }
  }
  // Joue une carte Fatalité non-Héros (Voler aux Riches / Déguisement) en mode test.
  const handleTestFateCard = (cardId: string, targetHeroId: string, enlargeToward?: string) => {
    try {
      testPlayFateCard(cardId, targetHeroId, enlargeToward)
      setTestFateError(null)
    } catch (e) {
      setTestFateError(e instanceof Error ? e.message : String(e))
    }
  }
  // Clé du tour (joueur actif × turn) — quand l'humain passe, on stocke la clé
  // courante : ainsi le « pass » devient automatiquement obsolète au changement
  // de tour, sans useEffect/setState.
  const turnKey = `${state.activePlayer}:${state.turn}`
  const [passedTurnKey, setPassedTurnKey] = useState<string | null>(null)
  const reactionPassed = passedTurnKey === turnKey
  // Carte de la main survolée depuis l'extérieur (boutons « Jouer Avarice »…).
  const [hoveredReactionId, setHoveredReactionId] = useState<string | null>(null)
  // instanceId actuellement « en showcase » (à masquer du plateau le temps du vol).
  const [showcaseHiddenIds, setShowcaseHiddenIds] = useState<string[]>([])
  // Vrai tant qu'un showcase est affiché / en attente. Sert à mettre le pilote du
  // bot EN PAUSE : il ne jouera son END_TURN (bascule vers le joueur) qu'une fois
  // les showcases adverses terminés.
  const [showcaseBusy, setShowcaseBusy] = useState(false)
  // Flash one-shot (`lieu:action`) de l'action que le joueur ACTIF (humain OU bot)
  // vient de jouer, pour la visualiser sur son plateau (bouton jaune éphémère).
  const [actionFlash, setActionFlash] = useState<string | null>(null)
  // Cartes en vol (animation pose main → plateau). Purement décoratif.
  const [flights, setFlights] = useState<CardFlight[]>([])
  const flightSeq = useRef(0)
  const removeFlight = (id: number) => setFlights((f) => f.filter((x) => x.id !== id))
  const flyCard = (image: string, from: FlightRect, to: FlightRect) => {
    const id = ++flightSeq.current
    setFlights((f) => [...f, { id, image, from, to }])
  }
  /** Anime la carte `instanceId` de la main vers la case `to` du plateau du joueur.
   *  À appeler AVANT le dispatch (la carte est encore dans la main dans le DOM).
   *  La cible préserve le RATIO de la carte (rétrécissement uniforme, sans écrasement)
   *  et atterrit centrée sur la case. */
  const flyHandToBoard = (instanceId: string, to: string) => {
    const c = user.hand.find((x) => x.instanceId === instanceId)
    const def = c && getCardDef(c.cardId)
    if (!def) return
    const fromEl = document.querySelector(`[data-hand-card="${instanceId}"]`)
    const toEl = document.querySelector(`[data-board-loc="${user.villain}:${to}"]`)
    if (!fromEl || !toEl) return
    const fr = fromEl.getBoundingClientRect()
    const cell = toEl.getBoundingClientRect()
    const from: FlightRect = { left: fr.left, top: fr.top, width: fr.width, height: fr.height }
    const aspect = fr.height / fr.width // ratio de la carte (préservé pendant le vol)
    const tW = Math.min(fr.width, 56) // ≈ taille d'une vignette d'Allié posé (w-14)
    const tH = tW * aspect
    const to2: FlightRect = {
      left: cell.left + cell.width / 2 - tW / 2,
      top: cell.top + cell.height / 2 - tH / 2,
      width: tW,
      height: tH,
    }
    flyCard(def.image, from, to2)
  }
  // Animation de PIOCHE : quand de nouvelles cartes apparaissent dans la main du
  // joueur (fin de tour, Prédiction…), un dos de carte « vole » de la pioche
  // Vilain vers la zone de main, au lieu d'apparaître instantanément.
  const handIdsRef = useRef<Set<string>>(
    new Set(state.players[HUMAN].hand.map((c) => c.instanceId)),
  )
  useEffect(() => {
    const human = state.players[HUMAN]
    const cur = human.hand.map((c) => c.instanceId)
    const added = cur.filter((id) => !handIdsRef.current.has(id))
    handIdsRef.current = new Set(cur)
    if (added.length === 0) return
    const pile = document.querySelector(`[data-deck-pile="${HUMAN}"]`)
    const zone = document.querySelector(`[data-hand-zone="${HUMAN}"]`)
    const back = human.backVillainImage
    if (!pile || !zone || !back) return
    const pr = pile.getBoundingClientRect()
    const zr = zone.getBoundingClientRect()
    const cardW = 60
    const cardH = cardW * 1.4
    const from: FlightRect = {
      left: pr.left + pr.width / 2 - cardW / 2,
      top: pr.top + pr.height / 2 - cardH / 2,
      width: cardW,
      height: cardH,
    }
    added.forEach((_, k) => {
      const spread = added.length > 1 ? (k - (added.length - 1) / 2) * (cardW + 8) : 0
      const to: FlightRect = {
        left: zr.left + zr.width / 2 - cardW / 2 + spread,
        top: zr.top + zr.height / 2 - cardH / 2,
        width: cardW,
        height: cardH,
      }
      window.setTimeout(() => flyCard(back, from, to), k * 110)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.players[HUMAN].hand])
  // Gains de pouvoir flottants (« +N 🪙 »), ex. bonus du Shérif.
  const [gains, setGains] = useState<FloatingGain[]>([])
  const gainSeq = useRef(0)
  const removeGain = (id: number) => setGains((g) => g.filter((x) => x.id !== id))
  const floatGainAt = (amount: number, villainId: string, locId: string) => {
    const el = document.querySelector(`[data-board-loc="${villainId}:${locId}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    setGains((g) => [...g, { id: ++gainSeq.current, amount, x: r.left + r.width / 2, y: r.top + r.height / 2 }])
  }
  // À la fermeture d'un showcase de Héros, animer le gain de pouvoir du
  // propriétaire (Mandat d'Arrêt) sur le lieu d'arrivée — « +N 🪙 ».
  const handleCardLanded = (ev: ShowcaseEvent) => {
    if (ev.landingPowerGain && ev.destination) {
      const owner = state.players[ev.destination.playerIndex]
      floatGainAt(ev.landingPowerGain, owner.villain, ev.destination.locationId)
    }
  }
  // Consomme les effets émis par le moteur (Robin des Bois qui chipe du pouvoir) :
  // pour chaque nouvel fx, fait CLIGNOTER en rouge la carte Robin concernée (~0.8 s).
  const [robinBlinkIds, setRobinBlinkIds] = useState<string[]>([])
  const fxShown = useRef(0)
  useEffect(() => {
    const fx = state.floatingFx ?? []
    if (fx.length < fxShown.current) {
      fxShown.current = fx.length // nouvelle partie : la file a été réinitialisée
      return
    }
    for (let i = fxShown.current; i < fx.length; i++) {
      const e = fx[i]
      if (e.kind === 'task-completed') {
        // L'Imposteur : une Tâche neutralisée par les Coéquipiers → « Task complete ».
        playTaskComplete()
      } else if (e.kind === 'dead-body') {
        // L'Imposteur : Corps découvert → bandeau « DEAD BODY REPORTED » + son.
        playDeadBody()
        setShowDeadBody(true)
        window.setTimeout(() => setShowDeadBody(false), 2400)
      } else if (e.kind === 'emergency-meeting') {
        // L'Imposteur : Réunion d'urgence → bandeau « EMERGENCY MEETING » + son.
        playEmergencyMeeting()
        setShowEmergency(true)
        window.setTimeout(() => setShowEmergency(false), 2400)
      } else if (e.kind === 'robin-steal') {
        const robin = (state.players[e.playerIndex]?.board[e.locationId] ?? []).find(
          (c) => c.cardId === 'robin-des-bois',
        )
        if (!robin) continue
        const id = robin.instanceId
        setRobinBlinkIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
        window.setTimeout(() => setRobinBlinkIds((ids) => ids.filter((x) => x !== id)), 850)
      } else if (e.kind === 'taxes-gain') {
        // « +N 🪙 » flottant ancré sur la carte du Héros (Magnifiques Taxes).
        const el = document.querySelector(`[data-hero-card="${e.instanceId}"]`)
        if (!el) continue
        const r = el.getBoundingClientRect()
        setGains((g) => [
          ...g,
          { id: ++gainSeq.current, amount: e.amount, x: r.left + r.width / 2, y: r.top + r.height / 2 },
        ])
      } else if (e.kind === 'tyranny-draw') {
        // Tyrannie : `count` dos de cartes « affluent » de la pioche Vilain vers
        // la zone de main du joueur (étalés + décalés dans le temps).
        const pile = document.querySelector(`[data-deck-pile="${e.playerIndex}"]`)
        const zone = document.querySelector(`[data-hand-zone="${e.playerIndex}"]`)
        const back = state.players[e.playerIndex]?.backVillainImage
        if (!pile || !zone || !back) continue
        const pr = pile.getBoundingClientRect()
        const zr = zone.getBoundingClientRect()
        const cardW = 60
        const cardH = cardW * 1.4
        const from: FlightRect = {
          left: pr.left + pr.width / 2 - cardW / 2,
          top: pr.top + pr.height / 2 - cardH / 2,
          width: cardW,
          height: cardH,
        }
        for (let k = 0; k < e.count; k++) {
          const spread = e.count > 1 ? (k - (e.count - 1) / 2) * (cardW + 8) : 0
          const to: FlightRect = {
            left: zr.left + zr.width / 2 - cardW / 2 + spread,
            top: zr.top + zr.height / 2 - cardH / 2,
            width: cardW,
            height: cardH,
          }
          window.setTimeout(() => flyCard(back, from, to), k * 110)
        }
      } else if (e.kind === 'play-card') {
        // Pose d'un Allié/Objet : un dos de carte vole de la zone de main du BOT
        // vers le lieu de destination. (L'humain est déjà animé avant le dispatch,
        // avec l'image réelle de la carte — on saute donc HUMAN.)
        if (e.playerIndex === HUMAN) continue
        const player = state.players[e.playerIndex]
        const zone = document.querySelector(`[data-hand-zone="${e.playerIndex}"]`)
        const cell = document.querySelector(`[data-board-loc="${player?.villain}:${e.locationId}"]`)
        const back = player?.backVillainImage
        if (!zone || !cell || !back) continue
        const zr = zone.getBoundingClientRect()
        const cr = cell.getBoundingClientRect()
        const cardW = 56
        const cardH = cardW * 1.4
        const from: FlightRect = {
          left: zr.left + zr.width / 2 - cardW / 2,
          top: zr.top + zr.height / 2 - cardH / 2,
          width: cardW,
          height: cardH,
        }
        const to: FlightRect = {
          left: cr.left + cr.width / 2 - cardW / 2,
          top: cr.top + cr.height / 2 - cardH / 2,
          width: cardW,
          height: cardH,
        }
        flyCard(back, from, to)
      } else if (e.kind === 'move-card') {
        // Déplacement entre lieux : la carte (image réelle) vole du lieu de départ
        // vers le lieu d'arrivée — pour les deux joueurs.
        const player = state.players[e.playerIndex]
        const def = getCardDef(e.cardId)
        const fromCell = document.querySelector(`[data-board-loc="${player?.villain}:${e.from}"]`)
        const toCell = document.querySelector(`[data-board-loc="${player?.villain}:${e.to}"]`)
        if (!def || !fromCell || !toCell) continue
        const fr = fromCell.getBoundingClientRect()
        const tr = toCell.getBoundingClientRect()
        const cardW = 56
        const cardH = cardW * 1.4
        const from: FlightRect = {
          left: fr.left + fr.width / 2 - cardW / 2,
          top: fr.top + fr.height / 2 - cardH / 2,
          width: cardW,
          height: cardH,
        }
        const to: FlightRect = {
          left: tr.left + tr.width / 2 - cardW / 2,
          top: tr.top + tr.height / 2 - cardH / 2,
          width: cardW,
          height: cardH,
        }
        flyCard(def.image, from, to)
      }
    }
    fxShown.current = fx.length
  }, [state.floatingFx, state.players, HUMAN])

  // Visualisation des actions : à chaque nouvelle entrée dans usedActionIds, on
  // fait flasher la pastille de l'action correspondante sur le plateau du joueur
  // ACTIF (humain comme bot) — un même retour visuel pour les deux. On ignore les
  // déplacements gratuits (id préfixé « xxx:instanceId »).
  const prevUsedRef = useRef<string[]>(state.usedActionIds)
  const actionFlashTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const used = state.usedActionIds
    const prev = prevUsedRef.current
    prevUsedRef.current = used
    if (state.status !== 'PLAYING') return
    if (used.length <= prev.length) return // reset de tour ou aucune nouvelle action
    const actionId = used.find((id) => !prev.includes(id) && !id.includes(':'))
    const loc = state.players[state.activePlayer].pawnLocation
    if (!actionId || !loc) return
    setActionFlash(`${loc}:${actionId}`)
    window.clearTimeout(actionFlashTimer.current)
    actionFlashTimer.current = window.setTimeout(() => setActionFlash(null), 550)
  }, [state.usedActionIds, state.activePlayer, state.status, state.players])

  // Affiche « À vous de jouer » (4 s) à chaque NOUVEAU tour du joueur humain.
  useEffect(() => {
    if (testMode || !startRollDone) return
    if (state.status !== 'PLAYING' || state.activePlayer !== HUMAN) return
    if (lastHumanTurnRef.current === state.turn) return
    lastHumanTurnRef.current = state.turn
    setShowTurnSplash(true)
    // Alerte sonore « À vous de jouer » — sauf si on incarne L'Imposteur (qui a
    // sa propre ambiance Among Us).
    if (humanVillainKeyRef.current !== 'imposteur') playYourTurn()
    const t = window.setTimeout(() => setShowTurnSplash(false), 4000)
    return () => window.clearTimeout(t)
  }, [state.activePlayer, state.turn, state.status, startRollDone, testMode, HUMAN])

  // Réseau : prévient l'adversaire quand je prépare une Condition (sélection d'une
  // cible) pour qu'il patiente, et le libère quand je la joue ou l'annule.
  const reactingSentRef = useRef(false)
  useEffect(() => {
    if (gameMode === 'solo') return
    const reacting = !!mode && mode.kind.startsWith('condition-pick')
    if (reacting === reactingSentRef.current) return
    reactingSentRef.current = reacting
    setReacting(reacting, state.players[HUMAN].villainName)
  }, [mode, gameMode, setReacting, state, HUMAN])

  const isBotTurn = state.status === 'PLAYING' && seats[state.activePlayer] === 'bot'
  const isHumanTurn = state.status === 'PLAYING' && state.activePlayer === HUMAN
  // Tour de l'adversaire (bot en solo, ou joueur distant en réseau) : sert au
  // flash d'action sur SON plateau, qui doit aussi apparaître en réseau.
  const isOpponentTurn = state.status === 'PLAYING' && state.activePlayer === BOT

  // Persifleur actif sur un lieu portant un Héros : on révèle (démasque) la rangée
  // du haut et on la fait clignoter tant que le joueur n'a pas choisi une action.
  const persifleurLoc =
    isHumanTurn &&
    state.persifleurAvailable &&
    state.players[HUMAN].pawnLocation &&
    (state.players[HUMAN].board[state.players[HUMAN].pawnLocation!] ?? []).some((c) => c.type === 'hero')
      ? state.players[HUMAN].pawnLocation
      : null

  const user = state.players[HUMAN]
  const bot = state.players[BOT]
  // Couleurs des deux vilains en présence (repli sur teintes neutres si inconnue).
  const userColor = VILLAIN_COLOR[user.villain] ?? DEFAULT_TINT_A
  const botColor = VILLAIN_COLOR[bot.villain] ?? DEFAULT_TINT_B
  // Fond de page teinté (helper partagé avec le choix des vilains).
  const pageBackground = villainsBackground(userColor, botColor)
  // Un Objet « à associer » est jouable s'il existe au moins un Allié quelque part
  // (on peut le poser sur n'importe quel lieu, donc sur celui qui porte l'Allié).
  // Un Héros hypnotisé compte comme un Allié (porteur d'Objet valide).
  const anyAllyOnBoard =
    isHumanTurn &&
    Object.values(user.board).some((cards) =>
      cards.some((c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized)),
    )
  // Au moins un Héros dans le royaume du joueur : « Magnifiques Taxes » l'exige.
  const anyHeroOnBoard =
    isHumanTurn && Object.values(user.board).some((cards) => cards.some((c) => c.type === 'hero'))
  // Roi Richard chez le joueur humain → ses Événements sont injouables.
  const humanEventsBlocked = isHumanTurn && hasHeroInRealm(state, HUMAN, 'roi-richard')
  // Flora chez le bot → sa main est révélée à l'humain (Flora rend la main publique).
  const botHandRevealed = hasHeroInRealm(state, BOT, 'flora')
  // Conditions jouables par l'humain pendant le tour du bot (D — réaction).
  const humanReactions: CardInstance[] = !isHumanTurn ? playableConditions(state, HUMAN) : []
  // Shériffs encore mobiles ce tour (instanceId), pour afficher le bouton inline.
  const sheriffMovable: string[] = isHumanTurn && state.phase === 'ACTION'
    ? Object.values(user.board)
        .flat()
        .filter(
          (c) =>
            c.cardId === 'sherif-nottingham' &&
            !state.usedActionIds.includes(`sheriff-move:${c.instanceId}`),
        )
        .map((c) => c.instanceId)
    : []
  // Véhicule (Char d'Hadès / Bateau de Bowser) : carte « ridesWithPawn » non utilisée
  // sur le lieu du pion (sinon null). On retient son instanceId ET son nom (libellé).
  const chariotInstance =
    isHumanTurn && state.phase === 'ACTION' && user.pawnLocation
      ? (user.board[user.pawnLocation] ?? []).find(
          (c) => c.ridesWithPawn && !state.usedActionIds.includes(`chariot-move:${c.instanceId}`),
        )
      : undefined
  const chariotCard: string | null = chariotInstance?.instanceId ?? null
  const chariotName = chariotInstance?.name ?? 'Char'
  // Canne (Dr Facilier) : disponible si le pion est sur le lieu de la Canne et
  // qu'elle n'a pas servi ce tour.
  const canneAvailable: boolean =
    isHumanTurn &&
    state.phase === 'ACTION' &&
    !!user.pawnLocation &&
    !state.usedActionIds.includes('canne-action') &&
    !state.actAtLocation &&
    (user.board[user.pawnLocation] ?? []).some((c) => c.cardId === 'canne')
  // Diablo encore mobile (UI inline). Règle : « avant que Maléfique ne se
  // déplace » → uniquement en phase MOVE (donc pas le tour où on vient de jouer
  // Diablo, qui se pose en phase ACTION).
  // Diablo déplaçable tant qu'aucune VRAIE action de lieu n'a été faite (phase
  // MOVE, ou début d'ACTION) — les marqueurs de déplacement gratuit ne comptent pas.
  const noLocationActionYet = !state.usedActionIds.some(
    (id) => !id.startsWith('diablo-move:') && !id.startsWith('sheriff-move:'),
  )
  const diabloMovable: string[] =
    isHumanTurn && (state.phase === 'MOVE' || (state.phase === 'ACTION' && noLocationActionYet))
      ? Object.values(user.board)
          .flat()
          .filter(
            (c) =>
              c.cardId === 'diablo' &&
              !state.usedActionIds.includes(`diablo-move:${c.instanceId}`),
          )
          .map((c) => c.instanceId)
      : []

  // Diablo (V2) : action gratuite armée au lieu de Diablo. On surface à l'humain
  // les actions Pouvoir / Jouer une carte / Éliminer (les autres types restent
  // supportés par le moteur). Les actions de la rangée HAUT recouvertes par un
  // Héros sont exclues.
  const diabloFreeLoc =
    isHumanTurn && state.diabloFree
      ? user.locations.find((l) => l.id === state.diabloFree!.locationId)
      : undefined
  const diabloFreeHeroesHere = diabloFreeLoc
    ? (user.board[diabloFreeLoc.id] ?? []).some((c) => c.type === 'hero')
    : false
  const diabloFreeActions: LocationAction[] = diabloFreeLoc
    ? diabloFreeLoc.actions.filter(
        (a) =>
          (a.type === 'GAIN_POWER' || a.type === 'PLAY_CARD' || a.type === 'VANQUISH') &&
          !(a.row === 'top' && diabloFreeHeroesHere),
      )
    : []
  const diabloSubflow = !!(mode && 'diablo' in mode && mode.diablo)

  // Forces effectives par joueur (modificateurs passifs inclus), pré-calculées
  // pour l'affichage des vignettes (alliés + héros).
  const computeStrengths = (playerIndex: number): Record<string, number> => {
    const acc: Record<string, number> = {}
    for (const cards of Object.values(state.players[playerIndex].board)) {
      for (const c of cards) {
        const s = effectiveStrength(state, playerIndex, c.instanceId)
        if (s !== undefined) acc[c.instanceId] = s
      }
    }
    return acc
  }
  const userStrengths = computeStrengths(HUMAN)
  const botStrengths = computeStrengths(BOT)

  // Pilote du bot : un coup toutes les BOT_STEP_MS tant que c'est son tour. En
  // plus, à TOUT instant, on laisse le bot jouer ses Conditions en réaction.
  // Si l'humain a une Condition jouable et n'a pas explicitement passé, on
  // met le bot en PAUSE pour laisser le temps de réagir.
  useEffect(() => {
    if (state.status !== 'PLAYING') return
    if (!startRollDone) return // jet de dé de début de partie en cours
    // Retourne-toi : carte révélée en attente d'un choix. Bot → garde la carte
    // (auto) après un court délai ; humain → modale.
    const pdp = state.pendingDeckPeek
    if (pdp) {
      if (seats[pdp.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveDeckPeek(true), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Tombée de la nuit : choix Événement/Objet. Bot → type présent dans les
    // cartes du dessus (priorité Objet = Pages) ; humain → modale.
    const ptc = state.pendingTypeChoice
    if (ptc) {
      if (seats[ptc.playerIndex] === 'bot') {
        // Prédiction (untilFound) → on scanne toute la pioche ; sinon les `count`
        // premières cartes. On choisit un type proposé qui apparaît, à défaut le 1ᵉʳ.
        const deck = state.players[ptc.playerIndex].deck
        const top = ptc.untilFound ? deck : deck.slice(0, ptc.count)
        const choice = ptc.types.find((t) => top.some((c) => c.type === t)) ?? ptc.types[0]
        const timer = setTimeout(() => resolveTypeChoice(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Manipulation : choisir une carte de la défausse à reprendre. Bot → la
    // dernière défaussée ; humain → modale.
    const pman = state.pendingManipulation
    if (pman) {
      if (seats[pman.playerIndex] === 'bot') {
        const disc = state.players[pman.playerIndex].discard
        const pick = disc[disc.length - 1]
        if (pick) {
          const timer = setTimeout(() => resolveManipulation(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Par ordre de la Reine ! : transformer 1-2 Cartes Gardes en arceaux. Bot →
    // privilégie les Gardes sur un lieu SANS arceau (un arceau par lieu → Coup
    // Royal) ; humain → modale.
    const ptw = state.pendingTransformWickets
    if (ptw) {
      if (seats[ptw.playerIndex] === 'bot') {
        const p = state.players[ptw.playerIndex]
        const guards = transformableGuards(state, ptw.playerIndex)
        const locHasWicket = (id: string) => {
          const loc = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.instanceId === id))
          return loc ? (p.board[loc.id] ?? []).some((c) => c.isWicket) : false
        }
        const sorted = [...guards].sort(
          (a, b) => Number(locHasWicket(a.instanceId)) - Number(locHasWicket(b.instanceId)),
        )
        const ids = sorted.slice(0, ptw.max).map((c) => c.instanceId)
        if (ids.length > 0) {
          const timer = setTimeout(() => resolveTransformWickets(ids), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Digne Adversaire / Obsession : le Héros révélé doit être JOUÉ (le bot choisit
    // le lieu : Peter Pan → Arbre du Pendu ; sinon son lieu courant ou un lieu libre).
    const pfh = state.pendingFetchedHero
    if (pfh) {
      if (seats[pfh.playerIndex] === 'bot') {
        const p = state.players[pfh.playerIndex]
        const locked = new Set(p.lockedLocations ?? [])
        const dest =
          pfh.hero.cardId === 'peter-pan'
            ? 'arbre-pendu'
            : (p.pawnLocation && !locked.has(p.pawnLocation) ? p.pawnLocation : undefined) ??
              p.locations.find((l) => !locked.has(l.id))?.id
        const timer = setTimeout(() => resolveFetchedHero(true, dest), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Vol du château : le bot pose la carte dévoilée (lieu courant si libre, sinon
    // 1ᵉʳ lieu libre ; objet associable → main). Délai allongé pour laisser le
    // joueur lire les cartes dévoilées (affichage des deux côtés).
    const pct = state.pendingCastleTheft
    if (pct) {
      if (seats[pct.playerIndex] === 'bot') {
        const p = state.players[pct.playerIndex]
        const locked = new Set(p.lockedLocations ?? [])
        const dest = pct.toHand
          ? undefined
          : (p.pawnLocation && !locked.has(p.pawnLocation) ? p.pawnLocation : undefined) ??
            p.locations.find((l) => !locked.has(l.id))?.id
        const timer = setTimeout(() => resolveCastleTheft(dest), CASTLE_THEFT_READ_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Opportunisme : le bot reprend la carte la plus chère de sa défausse.
    const prec = state.pendingRecover
    if (prec) {
      if (seats[prec.playerIndex] === 'bot') {
        const p = state.players[prec.playerIndex]
        const pool = [...p.discard, ...p.deck]
        const cands = prec.candidateIds
          .map((id) => pool.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        // Magie noire : le bot privilégie le Miroir magique puis les Ingrédients.
        const rank = (c: typeof cands[number]) =>
          c.cardId === 'miroir-magique' ? 100 : c.type === 'ingredient' ? 50 + (c.cost ?? 0) : (c.cost ?? 0)
        const pick = [...cands].sort((a, b) => rank(b) - rank(a))[0]
        if (pick) {
          const timer = setTimeout(() => resolveRecover(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Tuer (L'Imposteur) : le bot défausse en priorité un Coéquipier SUSPECT (pour
    // libérer une action), sinon le premier candidat.
    const pck = state.pendingCrewmateKill
    if (pck) {
      if (seats[pck.playerIndex] === 'bot') {
        const crew = state.players[pck.playerIndex].crewmates ?? []
        const cands = pck.candidateColors
        const suspect = cands.find((col) => crew.some((c) => c.color === col && c.suspect))
        const pick = suspect ?? cands[0]
        if (pick) {
          const timer = setTimeout(() => {
            if (pck.mode === 'kill') playKillSound()
            resolveCrewmateKill(pick)
          }, BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Tâche visuelle : le bot (s'il joue la Fatalité) rend suspects des Coéquipiers
    // de l'Imposteur, un par un (priorité aux Coéquipiers qui recouvriraient une action).
    const pcs = state.pendingCrewmateSuspect
    if (pcs) {
      if (seats[pcs.chooserIndex] === 'bot') {
        const crew = state.players[pcs.targetIndex].crewmates ?? []
        const pick = crew.find((c) => !c.discarded && !c.suspect)?.color
        const timer = setTimeout(
          () => (pick ? resolveCrewmateSuspect(pick) : doneCrewmateSuspect()),
          BOT_STEP_MS,
        )
        return () => clearTimeout(timer)
      }
      return
    }
    // Assurance (déplacement optionnel) : le bot ne déplace pas (termine).
    const pcm = state.pendingCrewmateMove
    if (pcm) {
      if (seats[pcm.playerIndex] === 'bot') {
        const timer = setTimeout(() => doneCrewmateMove(), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Vidéo de surveillance / Carte : le bot (s'il pose la Fatalité) associe l'Objet
    // au lieu du pion de l'Imposteur (sinon le 1ᵉʳ lieu).
    const pfo = state.pendingFateObjectPlace
    if (pfo) {
      if (seats[pfo.chooserIndex] === 'bot') {
        const tgt = state.players[pfo.targetIndex]
        const dest = tgt.pawnLocation ?? tgt.locations[0]?.id
        const timer = setTimeout(() => dest && resolveFateObjectPlace(dest), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Abu/Aladdin/K.O. : le bot (s'il a joué la Fatalité) choisit la cible — pour
    // K.O. l'Allié le plus fort éligible, sinon le 1ᵉʳ Objet.
    const pfc = state.pendingFateChoice
    if (pfc) {
      if (seats[pfc.chooserIndex] === 'bot') {
        const tgt = state.players[pfc.targetIndex]
        const pool = [...Object.values(tgt.board).flat(), ...tgt.hand, ...tgt.fateDiscard]
        const cands = pfc.candidateIds
          .map((id) => pool.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        // Animaux de la forêt : défausser la carte la plus précieuse de la cible
        // (Miroir magique > Croque ! > Ingrédient > reste).
        const handRank = (c: CardInstance) =>
          c.cardId === 'miroir-magique' ? 4 : c.cardId === 'croque' ? 3 : c.type === 'ingredient' ? 2 : 1
        const pick =
          pfc.kind === 'remove-ally'
            ? [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
            : pfc.kind === 'discard-from-hand'
              ? [...cands].sort((a, b) => handRank(b) - handRank(a))[0]
              : pfc.kind === 'fate-discard-hero-to-top'
                ? // Premier baiser : Blanche-Neige en priorité (la plus perturbante
                  // pour la Méchante Reine), sinon le Héros le plus fort.
                  (cands.find((c) => c.cardId === 'blanche-neige') ??
                    [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0])
                : cands[0]
        if (pick) {
          const timer = setTimeout(() => resolveFateChoice(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Pas de Quartier ! : le bot déplace un Allié vers un lieu voisin (priorité à
    // un lieu portant un Héros, pour préparer un Vanquish).
    const pamb = state.pendingAllyMoveBuff
    if (pamb) {
      if (seats[pamb.playerIndex] === 'bot') {
        const p = state.players[pamb.playerIndex]
        const order = p.locations.map((l) => l.id)
        const locked = new Set(p.lockedLocations ?? [])
        let best: { instanceId: string; to: string } | null = null
        let bestScore = -1
        for (let i = 0; i < order.length; i++) {
          const neighbors = [order[i - 1], order[i + 1]].filter((id): id is string => !!id && !locked.has(id))
          for (const c of p.board[order[i]] ?? []) {
            if (c.type !== 'ally' || c.attachedTo || c.isWicket) continue
            for (const to of neighbors) {
              const score = (p.board[to] ?? []).filter((d) => d.type === 'hero').length * 10 + (c.strength ?? 0)
              if (score > bestScore) {
                bestScore = score
                best = { instanceId: c.instanceId, to }
              }
            }
          }
        }
        if (best) {
          const move = best
          const timer = setTimeout(() => resolveAllyMoveBuff(move.instanceId, move.to), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Faites-leur peur ! : le bot garde les Héros sur le dessus, défausse le reste.
    const psc = state.pendingScry
    if (psc) {
      if (seats[psc.playerIndex] === 'bot') {
        const heroes = psc.cards.filter((c) => c.type === 'hero').map((c) => c.instanceId)
        const timer = setTimeout(() => resolveScry(heroes), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Divination (Dr Facilier) : le bot résout les cartes révélées de l'Au-delà.
    // Ordre : Régner d'abord (victoire potentielle), Esprits des masques en dernier
    // (sinon il renverrait les autres cartes dans la pile).
    const pdiv = state.pendingDivination
    if (pdiv) {
      if (seats[pdiv.playerIndex] === 'bot') {
        const rank = (cardId: string) =>
          cardId === 'regner-nouvelle-orleans' ? 0 : cardId === 'esprits-masques' ? 2 : 1
        const order = [...pdiv.cards]
          .sort((a, b) => rank(a.cardId) - rank(b.cardId))
          .map((c) => c.instanceId)
        const timer = setTimeout(() => resolveDivination(order), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Tour de passe-passe (Dr Facilier) : le bot garde la carte la plus utile.
    const plt = state.pendingLookTop
    if (plt) {
      if (seats[plt.playerIndex] === 'bot') {
        const rank = (cardId: string) =>
          cardId === 'regner-nouvelle-orleans' ? 5 : cardId === 'talisman' ? 4
          : cardId === 'divination-facilier' ? 3 : cardId === 'tour-passe-passe' ? 2 : cardId === 'canne' ? 1 : 0
        const best = [...plt.cards].sort((a, b) => rank(b.cardId) - rank(a.cardId))[0]
        const timer = setTimeout(() => resolveLookTop([best.instanceId]), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // La Méchante Reine — « Croque ! » : le bot croque le Héros-objectif en
    // priorité, sinon le plus fort des candidats.
    const ptab = state.pendingTakeABite
    if (ptab) {
      if (seats[ptab.playerIndex] === 'bot') {
        const owner = state.players[ptab.playerIndex]
        const objId = owner.objective.type === 'DEFEAT_HERO_AT_LOCATION' ? owner.objective.heroCardId : undefined
        const cards = ptab.candidateIds
          .map((id) => Object.values(owner.board).flat().find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        const pick =
          cards.find((c) => c.cardId === objId) ??
          [...cards].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveTakeABite(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // La Méchante Reine — Foudre : le bot reproduit Caquet en priorité, sinon le 1er.
    const pdup = state.pendingDuplicateIngredient
    if (pdup) {
      if (seats[pdup.playerIndex] === 'bot') {
        const pick = pdup.candidateIds.find((id) => id.includes('caquet-megere')) ?? pdup.candidateIds[0]
        if (pick) {
          const timer = setTimeout(() => resolveDuplicateIngredient(pick), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // La Méchante Reine — Hurlement d'effroi : le bot prend le 1er déplacement possible.
    const pscr = state.pendingScream
    if (pscr) {
      if (seats[pscr.playerIndex] === 'bot') {
        const o = pscr.options[0]
        const timer = setTimeout(() => (o ? resolveScream(o.from, o.to) : resolveScream()), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Si près du but / Charlotte (Dr Facilier) : le bot (chooser) remplit la Pile
    // de l'Au-delà avec toutes les cartes autorisées, remet les autres sur la pioche.
    const pfs = state.pendingFateScry
    if (pfs) {
      if (seats[pfs.chooserIndex] === 'bot') {
        const canAudela = (c: { cardId: string }) =>
          c.cardId !== 'talisman' && c.cardId !== 'divination-facilier'
        const toAudelaIds = pfs.cards.filter(canAudela).map((c) => c.instanceId)
        const deckTopOrder = pfs.cards.filter((c) => !canAudela(c)).map((c) => c.instanceId)
        const timer = setTimeout(() => resolveFateScry(toAudelaIds, deckTopOrder), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Coup Royal raté du bot : on ferme la fenêtre pour qu'il poursuive son tour.
    const prc = state.pendingRoyalCroquet
    if (prc) {
      if (seats[prc.playerIndex] === 'bot') {
        const timer = setTimeout(() => dismissRoyalCroquet(), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Téléportation : déplacer le pion sur un lieu portant un Héros. Bot →
    // 1ᵉʳ lieu cible ; humain → modale.
    const pt = state.pendingTeleport
    if (pt) {
      if (seats[pt.playerIndex] === 'bot') {
        const tgts = teleportTargets(state.players[pt.playerIndex])
        if (tgts.length > 0) {
          const timer = setTimeout(() => resolveTeleport(tgts[0]), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Apparition / Vent de panique : déplacer un Héros vers un lieu voisin.
    // Bot chooser → 1ᵉʳ Héros + 1ᵉʳ lieu voisin ; humain → modale.
    const phr = state.pendingHeroRelocate
    if (phr) {
      if (seats[phr.chooserIndex] === 'bot') {
        const tgt = state.players[phr.targetIndex]
        const ids = tgt.locations.map((l) => l.id)
        const locked = new Set(tgt.lockedLocations ?? [])
        for (const loc of tgt.locations) {
          const hero = (tgt.board[loc.id] ?? []).find(
            (c) => c.type === 'hero' && (!phr.candidateIds || phr.candidateIds.includes(c.instanceId)),
          )
          if (hero) {
            const i = ids.indexOf(loc.id)
            const cands = phr.forcedDirection !== undefined
              ? [ids[i + phr.forcedDirection]].filter((id): id is string => !!id && !locked.has(id))
              : phr.anyLocation
                ? ids.filter((id) => id !== loc.id && !locked.has(id))
                : [ids[i - 1], ids[i + 1]].filter((id): id is string => !!id && !locked.has(id))
            const to = cands[0]
            if (to) {
              const timer = setTimeout(() => resolveHeroRelocate(hero.instanceId, to), BOT_STEP_MS)
              return () => clearTimeout(timer)
            }
          }
        }
        // Facultatif (Poupées vaudou) et aucun Héros déplaçable → décliner.
        if (phr.optional) {
          const timer = setTimeout(() => skipHeroRelocate(), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Aurore : Héros révélé à placer. Le bot (s'il a joué la Fatalité) choisit
    // tout seul le 1ᵉʳ lieu valide ; si c'est l'humain, on attend la modale.
    const php = state.pendingHeroPlacement
    if (php) {
      if (seats[php.chooserIndex] === 'bot') {
        const valid = heroPlacementLocations(state, php.hero, php.targetIndex)
        if (valid.length > 0) {
          const timer = setTimeout(() => resolveHeroPlacement(valid[0]), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Roi Stéphane : déplacement de pion à choisir. Bot (s'il a joué la Fatalité)
    // → lieu portant le plus de Malédictions (sinon ne bouge pas) ; humain → modale.
    const ppm = state.pendingPawnMove
    if (ppm) {
      if (seats[ppm.chooserIndex] === 'bot') {
        const tgt = state.players[ppm.targetIndex]
        const locked = new Set(tgt.lockedLocations ?? [])
        const cands = tgt.locations.filter((l) => l.id !== tgt.pawnLocation && !locked.has(l.id))
        // Priorité aux Malédictions (Roi Stéphane), puis éloigner la cible de ses
        // propres Alliés/Objets (perturbation — Anneau étoile contre Bowser…).
        const curses = (loc: string) => (tgt.board[loc] ?? []).filter((c) => c.type === 'curse').length
        const support = (loc: string) =>
          (tgt.board[loc] ?? []).filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo).length
        const dest = cands.length
          ? [...cands].sort((a, b) => curses(b.id) - curses(a.id) || support(a.id) - support(b.id))[0].id
          : null
        const timer = setTimeout(() => resolvePawnMove(dest), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Roi Hubert : attirer un Allié par lieu voisin. Bot (s'il a joué la
    // Fatalité) → 1ᵉʳ Allié de chaque lieu voisin ; humain → modale.
    const phl = state.pendingHubertPull
    if (phl) {
      if (seats[phl.chooserIndex] === 'bot') {
        const tgt = state.players[phl.targetIndex]
        const ids = adjacentLocationIds(state, phl.dest)
          .map((a) => (tgt.board[a] ?? []).find((c) => c.type === 'ally')?.instanceId)
          .filter((x): x is string => !!x)
        const timer = setTimeout(() => resolveHubertPull(ids), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Tyrannie en attente de défausse : priorité absolue. Le bot résout tout
    // seul (auto-pick) après un court délai (laisse jouer le vol de pioche) ;
    // si c'est l'humain, on met tout en pause le temps de sa sélection.
    const ptd = state.pendingTyrannyDiscard
    if (ptd) {
      if (seats[ptd.playerIndex] === 'bot') {
        const hand = state.players[ptd.playerIndex].hand
        const ids = hand.slice(0, Math.min(ptd.count, hand.length)).map((c) => c.instanceId)
        const timer = setTimeout(() => resolveTyrannyDiscard(ids), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Mode test : l'adversaire est masqué, on ne le fait pas réagir/jouer.
    if (testMode) return
    if (isBotTurn) {
      // Attend la fin d'affichage des showcases (Fatalité, défausse, pose de Héros)
      // avant de poursuivre : ainsi le bot ne joue son END_TURN — donc ne bascule
      // au tour du joueur — qu'une fois ses showcases terminés.
      if (showcaseBusy) return
      const humanCanReact = playableConditions(state, HUMAN).length > 0 && !reactionPassed
      if (humanCanReact) return // pause : on attend que l'humain joue ou passe
      const timer = setTimeout(botAct, BOT_STEP_MS)
      return () => clearTimeout(timer)
    }
    // Tour humain : laisse le bot tenter une réaction (Avarice, Lâcheté).
    const timer = setTimeout(botReact, BOT_STEP_MS / 2)
    return () => clearTimeout(timer)
  }, [seats, HUMAN, isBotTurn, startRollDone, state, showcaseBusy, botAct, botReact, reactionPassed, testMode, resolveTyrannyDiscard, resolveHeroPlacement, resolvePawnMove, resolveHubertPull, resolveDeckPeek, resolveTypeChoice, resolveHeroRelocate, resolveTeleport, resolveManipulation, dismissRoyalCroquet, resolveTransformWickets, resolveScry, resolveAllyMoveBuff, resolveFateChoice, resolveFetchedHero, resolveCastleTheft, resolveRecover, resolveCrewmateKill, resolveCrewmateSuspect, doneCrewmateSuspect, resolveCrewmateMove, doneCrewmateMove, resolveFateObjectPlace, resolveDivination, resolveLookTop, resolveTakeABite, resolveDuplicateIngredient, cancelDuplicateIngredient, resolveScream, resolveFateScry, skipHeroRelocate])

  // Coups légaux / actions : seulement pour le joueur humain et à son tour.
  const legalMoves = isHumanTurn ? getLegalMoves(state) : []
  const availableActions = isHumanTurn ? getAvailableActions(state) : []
  const canEnd = isHumanTurn && state.phase === 'ACTION'

  // Son quand le bouton « Fin de tour » passe de grisé (non utilisable) à utilisable.
  const prevCanEndRef = useRef(canEnd)
  useEffect(() => {
    if (!testMode && canEnd && !prevCanEndRef.current) playEndTurnEnable()
    prevCanEndRef.current = canEnd
  }, [canEnd, testMode])

  const clearThen =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      setMode(null)
      fn(...args)
    }
  const handleMove = clearThen(move)
  const handleSkipMove = clearThen(skipMove)
  const handleAction = clearThen(executeAction)
  const handleFate = clearThen(fate)
  const handleEndTurn = clearThen(endTurn)
  // Vilains des deux joueurs (déduits du state) pour pré-remplir le sélecteur.
  // `state.players[i].villain` est l'ID de définition (kebab, ex. 'mechante-reine'),
  // PAS la clé d'UI (ex. 'mechanteReine') : on convertit via villainKeyOf (sinon
  // VILLAIN_REGISTRY[...] est undefined pour les vilains dont l'id ≠ la clé).
  const currentVillains: [VillainKey, VillainKey] = [
    villainKeyOf(state.players[0].villain),
    villainKeyOf(state.players[1].villain),
  ]
  const handlePickVillain = (slot: 0 | 1, key: VillainKey) => {
    const next: [VillainKey, VillainKey] = [...currentVillains]
    next[slot] = key
    reset(next)
  }

  // Dispatch d'une pose / d'une élimination : encapsule dans l'action gratuite
  // de Diablo (V2) si le mode courant le réclame, sinon action normale du pion.
  const doPlayCard = (
    isDiablo: boolean | undefined,
    actionId: string,
    instanceId: string,
    to?: string,
    attachTo?: string,
    targetHeroId?: string,
    allyInstanceIds?: string[],
    allyMove?: { instanceId: string; to: string },
    shrinkFreeActionId?: string,
  ) => {
    if (isDiablo) {
      try {
        diabloFreeAction({ type: 'PLAY_CARD', actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId })
      } catch { /* coup refusé par le moteur : le bandeau Diablo reste pour réessayer */ }
    } else {
      playCard(actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId)
    }
  }
  const doVanquish = (
    isDiablo: boolean | undefined,
    actionId: string,
    heroInstanceId: string,
    allyInstanceIds: string[],
  ) => {
    if (isDiablo) {
      try {
        diabloFreeAction({ type: 'VANQUISH', actionId, heroInstanceId, allyInstanceIds })
      } catch { /* refusé : réessai possible via le bandeau */ }
    } else {
      vanquish(actionId, heroInstanceId, allyInstanceIds)
    }
  }

  const handleSelectPlay = (actionId: string) =>
    setMode((m) => (m?.kind === 'play' && m.actionId === actionId ? null : { kind: 'play', actionId }))
  const handleSelectDiscard = (actionId: string) =>
    setMode((m) =>
      m?.kind === 'discard' && m.actionId === actionId ? null : { kind: 'discard', actionId, selected: [] },
    )
  const handlePlayCard = (instanceId: string) => {
    if (mode?.kind === 'condition-pick-ally') {
      return handleConditionPickAlly(instanceId)
    }
    if (mode?.kind !== 'play') return setMode(null)
    const card = user.hand.find((c) => c.instanceId === instanceId)
    if (!card) return setMode(null)
    // Objet à associer à un HÉROS (Forme de grenouille, Potion de mortalité) :
    // on choisit directement le Héros cible (dans n'importe quel lieu).
    if (card.type === 'item' && card.attach === 'hero') {
      return setMode({ kind: 'item-attach-hero', actionId: mode.actionId, instanceId, cardName: card.name, diablo: mode.diablo })
    }
    if (card.type === 'ally' || card.type === 'item' || card.type === 'curse') {
      // Allié/Objet/Malédiction : on choisit ensuite le LIEU de destination.
      return setMode({
        kind: 'place',
        actionId: mode.actionId,
        instanceId,
        cardName: card.name,
        isAttach: card.type === 'item' && card.attach === 'ally',
        diablo: mode.diablo,
      })
    }
    // Tendre un Piège : 4 phases. D'abord choisir l'allié à déplacer.
    if (cardNeedsAllyMove(card)) {
      return setMode({ kind: 'trap-pick-ally', actionId: mode.actionId, instanceId, cardName: card.name })
    }
    // Carte qui déclenche un Vanquish (Intimidation) : flux vanquish via carte.
    if (cardNeedsVanquishTarget(card)) {
      return setMode({
        kind: 'vanquish-pick-hero',
        actionId: mode.actionId,
        viaCard: { instanceId, cardName: card.name },
        diablo: mode.diablo,
      })
    }
    // Événement nécessitant un Héros cible (Emprisonnement) : passer au pick.
    if (cardNeedsHeroTarget(card)) {
      return setMode({ kind: 'play-pick-hero', actionId: mode.actionId, instanceId, cardName: card.name, diablo: mode.diablo })
    }
    // Sacrifice Nécessaire : choisir un Allié/Objet du royaume à défausser.
    if (cardNeedsSacrificeTarget(card)) {
      if (sacrificeableCards(state).length === 0) return // rien à sacrifier
      return setMode({ kind: 'sacrifice-pick', actionId: mode.actionId, instanceId, cardName: card.name, diablo: mode.diablo })
    }
    // Bowser — épuisement d'énergie : choisir l'Allié (lieu du pion) qui reçoit l'Étoile.
    if (cardNeedsStarAllyTarget(card)) {
      if ((user.observatoryStars ?? 0) <= 0 || drainStarAllies(state).length === 0) return
      return setMode({ kind: 'drain-pick-ally', actionId: mode.actionId, instanceId, cardName: card.name, diablo: mode.diablo })
    }
    // Bowser — Impuissance : ouvrir le choix « Capturer Peach » / « Éliminer un Héros ».
    if (card.cardId === 'impuissance') {
      return setMode({ kind: 'impuissance-choice', actionId: mode.actionId, instanceId, cardName: card.name, diablo: mode.diablo })
    }
    // Événement classique : effet immédiat, pas de destination.
    doPlayCard(mode.diablo, mode.actionId, instanceId)
    setMode(null)
  }
  const handlePlayPickHero = (heroInstanceId: string) => {
    if (mode?.kind !== 'play-pick-hero') return
    const card = user.hand.find((c) => c.instanceId === mode.instanceId)
    const isShrink = card?.effects?.some((e) => e.type === 'SET_HERO_SIZE' && e.size === 'shrunk')
    const hero = Object.values(user.board).flat().find((c) => c.instanceId === heroInstanceId)
    // Rapetisser sur un Héros NORMAL → on demande quelle action du haut laisser
    // libre. (Sur un Héros agrandi, Rapetisser le ramène à la normale : pas de choix.)
    if (isShrink && hero && !hero.heroSize) {
      setMode({ kind: 'shrink-pick-action', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, heroInstanceId, diablo: mode.diablo })
      return
    }
    doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, heroInstanceId)
    setMode(null)
  }
  const handleItemAttachHero = (heroInstanceId: string) => {
    if (mode?.kind !== 'item-attach-hero') return
    // Lieu du Héros ciblé (l'Objet y est posé, associé au Héros).
    let heroLoc: string | null = null
    for (const loc of user.locations) {
      if ((user.board[loc.id] ?? []).some((c) => c.instanceId === heroInstanceId)) {
        heroLoc = loc.id
        break
      }
    }
    if (!heroLoc) return
    flyHandToBoard(mode.instanceId, heroLoc)
    doPlayCard(mode.diablo, mode.actionId, mode.instanceId, heroLoc, heroInstanceId)
    setMode(null)
  }
  const handleShrinkPickAction = (freeActionId: string) => {
    if (mode?.kind !== 'shrink-pick-action') return
    doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, mode.heroInstanceId, undefined, undefined, freeActionId)
    setMode(null)
  }
  // ---- D : Réactions humaines (Conditions) ----
  const handlePlayReaction = (card: CardInstance) => {
    // Conditions à ciblage interactif : on passe par un mode de sélection.
    if (card.cardId === 'lachete' || card.cardId === 'ruse' || card.cardId === 'sans-pitie' || card.cardId === 'renforts') {
      setMode({ kind: 'condition-pick-ally', instanceId: card.instanceId })
      return
    }
    if (card.cardId === 'mechancete') {
      setMode({ kind: 'condition-pick-hero', instanceId: card.instanceId })
      return
    }
    // Toutes les autres Conditions (Avarice, Tyrannie, Tromperie, Manipulation,
    // Sombres desseins, Sans visage…) se résolvent sans ciblage manuel.
    playCondition(HUMAN, card.instanceId)
  }
  const handleConditionPickHero = (heroInstanceId: string) => {
    if (mode?.kind !== 'condition-pick-hero') return
    playCondition(HUMAN, mode.instanceId, heroInstanceId)
    setMode(null)
  }
  const handleConditionPickAlly = (allyInstanceId: string) => {
    if (mode?.kind !== 'condition-pick-ally') return
    const ally = user.hand.find((c) => c.instanceId === allyInstanceId)
    if (!ally || ally.type !== 'ally') return
    // Un Titan ne peut être posé que sur Les Enfers → pas de choix de lieu.
    if (ally.isTitan) {
      playCondition(HUMAN, mode.instanceId, allyInstanceId)
      setMode(null)
      return
    }
    const condCard = user.hand.find((c) => c.instanceId === mode.instanceId)
    setMode({
      kind: 'condition-pick-place',
      instanceId: mode.instanceId,
      allyInstanceId,
      cardName: condCard?.name ?? 'Condition',
      allyName: ally.name,
    })
  }
  const handleConditionPickPlace = (to: string) => {
    if (mode?.kind !== 'condition-pick-place') return
    playCondition(HUMAN, mode.instanceId, mode.allyInstanceId, to)
    setMode(null)
  }

  const handleTrapPickAlly = (allyInstanceId: string, allyName: string) => {
    if (mode?.kind !== 'trap-pick-ally') return
    setMode({
      kind: 'trap-pick-dest',
      actionId: mode.actionId,
      instanceId: mode.instanceId,
      cardName: mode.cardName,
      allyInstanceId,
      allyName,
    })
  }
  const handleSheriffMoveStart = (instanceId: string) =>
    setMode((m) => (m?.kind === 'sheriff-dest' && m.instanceId === instanceId ? null : { kind: 'sheriff-dest', instanceId }))
  const handleSheriffPickDest = (to: string) => {
    if (mode?.kind !== 'sheriff-dest') return
    // Bonus Shérif : +1 JT si un Héros est présent sur la destination → « +1 🪙 ».
    if ((user.board[to] ?? []).some((c) => c.type === 'hero')) floatGainAt(1, user.villain, to)
    sheriffMove(mode.instanceId, to)
    setMode(null)
  }
  const handleDiabloMoveStart = (instanceId: string) =>
    setMode((m) => (m?.kind === 'diablo-dest' && m.instanceId === instanceId ? null : { kind: 'diablo-dest', instanceId }))
  const handleDiabloPickDest = (to: string) => {
    if (mode?.kind !== 'diablo-dest') return
    diabloMove(mode.instanceId, to)
    setMode(null)
  }
  // Diablo (V2) — bandeau d'action gratuite : Pouvoir résout direct ; Jouer une
  // carte / Éliminer entrent dans le flux habituel marqué `diablo` (le dispatch
  // final est encapsulé dans DIABLO_FREE_ACTION).
  const handleDiabloFreeAction = (a: LocationAction) => {
    if (a.type === 'GAIN_POWER') {
      diabloFreeAction({ type: 'EXECUTE_ACTION', actionId: a.id })
      setMode(null)
    } else if (a.type === 'PLAY_CARD') {
      setMode({ kind: 'play', actionId: a.id, diablo: true })
    } else if (a.type === 'VANQUISH') {
      setMode({ kind: 'vanquish-pick-hero', actionId: a.id, diablo: true })
    }
  }
  const handleDiabloSkip = () => {
    setMode(null)
    diabloSkipFreeAction()
  }
  const handleTrapPickDest = (to: string) => {
    if (mode?.kind !== 'trap-pick-dest') return
    // On JOUE la carte tout de suite avec le déplacement seul : l'Allié bouge
    // IMMÉDIATEMENT et l'action « Éliminer un Héros » devient facultative
    // (pendingTrapVanquish → bandeau ci-dessous).
    playCard(mode.actionId, mode.instanceId, undefined, undefined, undefined, undefined, {
      instanceId: mode.allyInstanceId,
      to,
    })
    setMode(null)
  }
  // Tendre un Piège : jouer la carte SANS déplacer d'Allié (déplacement facultatif).
  const handleTrapSkipMove = () => {
    if (mode?.kind !== 'trap-pick-ally') return
    playCard(mode.actionId, mode.instanceId)
    setMode(null)
  }
  // Tendre un Piège — Vanquish facultatif (pendingTrapVanquish) : démarrer ou terminer.
  const handleTrapStartVanquish = () => setMode({ kind: 'vanquish-pick-hero', actionId: '', trap: true })
  const handleTrapFinish = () => trapSkipVanquish()
  const handleCardPick = (instanceId: string) => {
    if (mode?.kind === 'activate-pick') {
      const card = activatableCards(state).find((c) => c.instanceId === instanceId)
      if (card) startActivate(mode.actionId, card)
      return
    }
    if (mode?.kind === 'sacrifice-pick') {
      // La carte cliquée (Allié/Objet du royaume) est sacrifiée pour la carte jouée.
      if (!sacrificeableCards(state).some((c) => c.instanceId === instanceId)) return
      doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, undefined, [instanceId])
      return setMode(null)
    }
    if (mode?.kind === 'drain-pick-ally') {
      // L'Allié cliqué (sur le lieu du pion) reçoit l'Étoile drainée.
      if (!drainStarAllies(state).some((c) => c.instanceId === instanceId)) return
      doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, undefined, [instanceId])
      return setMode(null)
    }
    if (mode?.kind === 'impuissance-pick-hero') {
      // Le Héros cliqué (≤3) est éliminé par Impuissance.
      if (!vanquishHeroTargets.includes(instanceId)) return
      doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, instanceId)
      return setMode(null)
    }
    if (mode?.kind === 'trap-pick-ally') {
      // Phase 1 de Tendre un Piège : on prend un Allié.
      const from = user.locations
        .map((l) => l.id)
        .find((id) => (user.board[id] ?? []).some((c) => c.instanceId === instanceId))
      if (!from) return
      const card = user.board[from].find((c) => c.instanceId === instanceId)
      if (card?.type !== 'ally') return
      return handleTrapPickAlly(instanceId, card.name)
    }
    if (mode?.kind !== 'move-pick') return
    const from = user.locations
      .map((l) => l.id)
      .find((id) => (user.board[id] ?? []).some((c) => c.instanceId === instanceId))
    if (!from) return
    // Rien ne se déplace DEPUIS un lieu verrouillé (Bowser : Observatoire à 0 Étoile).
    if ((user.lockedLocations ?? []).includes(from)) return
    const card = user.board[from].find((c) => c.instanceId === instanceId)
    setMode({ kind: 'move-dest', actionId: mode.actionId, instanceId, from, cardName: card?.name ?? '' })
  }
  const handlePlace = (to: string) => {
    if (mode?.kind === 'condition-pick-place') {
      return handleConditionPickPlace(to)
    }
    if (mode?.kind === 'sheriff-dest') {
      return handleSheriffPickDest(to)
    }
    if (mode?.kind === 'diablo-dest') {
      return handleDiabloPickDest(to)
    }
    if (mode?.kind === 'trap-pick-dest') {
      return handleTrapPickDest(to)
    }
    if (mode?.kind === 'activate-iago-dest') {
      return handleActivateIagoDest(to)
    }
    if (mode?.kind === 'move-dest') {
      moveCard(mode.actionId, mode.instanceId, to)
      return setMode(null)
    }
    if (mode?.kind === 'move-hero-dest') {
      moveHero(mode.actionId, mode.heroInstanceId, to)
      return setMode(null)
    }
    if (mode?.kind !== 'place') return
    if (mode.isAttach) {
      const allies = (user.board[to] ?? []).filter(
        (c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized),
      )
      if (allies.length === 0) return // lieu non cliquable en principe
      if (allies.length === 1) {
        flyHandToBoard(mode.instanceId, to)
        doPlayCard(mode.diablo, mode.actionId, mode.instanceId, to, allies[0].instanceId)
        return setMode(null)
      }
      // Plusieurs Alliés sur ce lieu : on attend le clic sur la carte de l'Allié.
      return setMode({ kind: 'attach', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, to, diablo: mode.diablo })
    }
    flyHandToBoard(mode.instanceId, to)
    doPlayCard(mode.diablo, mode.actionId, mode.instanceId, to)
    setMode(null)
  }
  const handleAttach = (allyInstanceId: string) => {
    if (mode?.kind !== 'attach') return
    flyHandToBoard(mode.instanceId, mode.to)
    doPlayCard(mode.diablo, mode.actionId, mode.instanceId, mode.to, allyInstanceId)
    setMode(null)
  }
  const handleToggleDiscard = (instanceId: string) => {
    // Défausse Tyrannie (état dédié) prioritaire sur le mode défausse normal.
    if (tyrannyDiscard) {
      setTyrannyPicks((picks) =>
        picks.includes(instanceId) ? picks.filter((x) => x !== instanceId) : [...picks, instanceId],
      )
      return
    }
    setMode((m) => {
      if (m?.kind !== 'discard') return m
      const selected = m.selected.includes(instanceId)
        ? m.selected.filter((id) => id !== instanceId)
        : [...m.selected, instanceId]
      return { ...m, selected }
    })
  }
  const handleConfirmDiscard = () => {
    if (tyrannyDiscard) {
      if (tyrannyPicks.length === tyrannyDiscard.count) {
        resolveTyrannyDiscard(tyrannyPicks)
        setTyrannyPicks([])
      }
      return
    }
    if (mode?.kind === 'discard' && mode.selected.length > 0) discardCards(mode.actionId, mode.selected)
    setMode(null)
  }
  // Clic sur un bouton d'action de l'image → traitement selon le type d'action.
  const handleBoardAction = (a: LocationAction) => {
    if (a.type === 'GAIN_POWER') handleAction(a.id)
    else if (a.type === 'BREW_POISON') {
      // Ouvre le sélecteur de quantité (N Pouvoir → N Poison). Timide = +1 perdu.
      const max = maxBrewPoison(state)
      const surcharge = hasHeroInRealm(state, state.activePlayer, 'timide') ? 1 : 0
      if (max >= 1) setBrewPick({ actionId: a.id, max, surcharge, count: 1 })
    }
    else if (a.type === 'PLAY_CARD') handleSelectPlay(a.id)
    else if (a.type === 'DISCARD_CARDS') handleSelectDiscard(a.id)
    else if (a.type === 'FATE') handleFate(a.id)
    else if (a.type === 'MOVE_ITEM_ALLY')
      setMode((m) => (m?.kind === 'move-pick' && m.actionId === a.id ? null : { kind: 'move-pick', actionId: a.id }))
    else if (a.type === 'MOVE_HERO')
      setMode((m) => (m?.kind === 'move-hero-pick' && m.actionId === a.id ? null : { kind: 'move-hero-pick', actionId: a.id }))
    else if (a.type === 'VANQUISH')
      setMode((m) =>
        m?.kind === 'vanquish-pick-hero' && m.actionId === a.id ? null : { kind: 'vanquish-pick-hero', actionId: a.id },
      )
    else if (a.type === 'ACTIVATE') {
      const cards = activatableCards(state)
      // Une seule carte activable → on enchaîne directement ; sinon, on propose
      // une fenêtre de choix.
      if (cards.length === 1) startActivate(a.id, cards[0])
      else if (cards.length > 1) setActivatePick({ actionId: a.id })
    }
  }
  /** Capitaine Crochet : clic sur une carte-Objet qui DONNE une action au lieu
   *  (Canon, Boîte à Crochets, Ingénieux Mécanisme) → déclenche cette action. */
  const handleGrantedAction = (card: CardInstance) => {
    const g = card.grantsAction
    if (!g) return
    handleBoardAction({ id: `granted:${card.instanceId}`, type: g.type, amount: g.amount, label: g.label, row: 'bottom', grantedBy: card.instanceId })
  }
  /** Démarre l'activation d'une carte : Iago → choix du lieu voisin ; autres →
   *  résolution immédiate (capacités sans ciblage). */
  const startActivate = (actionId: string, card: CardInstance) => {
    const from = user.locations
      .map((l) => l.id)
      .find((id) => (user.board[id] ?? []).some((c) => c.instanceId === card.instanceId))
    if (card.cardId === 'iago' && from) {
      const items = (user.board[from] ?? []).filter((c) => c.type === 'item' && !c.attachedTo)
      if (items.length > 1) {
        // Plusieurs Objets sur le lieu d'Iago → on demande lequel emmener.
        setIagoItemPick({ actionId, cardInstanceId: card.instanceId, from })
      } else {
        setMode({
          kind: 'activate-iago-dest',
          actionId,
          cardInstanceId: card.instanceId,
          from,
          itemInstanceId: items[0]?.instanceId,
        })
      }
    } else {
      activate(actionId, card.instanceId)
      setMode(null)
    }
  }
  /** Iago activé : destination choisie → déplace Iago (+ l'Objet pré-choisi). */
  const handleActivateIagoDest = (to: string) => {
    if (mode?.kind !== 'activate-iago-dest') return
    activate(mode.actionId, mode.cardInstanceId, to, mode.itemInstanceId)
    setMode(null)
  }
  const handleMoveHeroPick = (heroInstanceId: string) => {
    if (mode?.kind !== 'move-hero-pick') return
    const from = user.locations
      .map((l) => l.id)
      .find((id) => (user.board[id] ?? []).some((c) => c.instanceId === heroInstanceId))
    if (!from) return
    const hero = (user.board[from] ?? []).find((c) => c.instanceId === heroInstanceId)
    setMode({ kind: 'move-hero-dest', actionId: mode.actionId, heroInstanceId, from, heroName: hero?.name ?? '' })
  }
  const handleVanquishPickHero = (heroInstanceId: string, heroName: string) => {
    if (mode?.kind !== 'vanquish-pick-hero') return
    setMode({
      kind: 'vanquish-pick-allies',
      actionId: mode.actionId,
      heroInstanceId,
      heroName,
      selected: [],
      viaCard: mode.viaCard,
      diablo: mode.diablo,
      trap: mode.trap,
    })
  }
  const handleVanquishToggleAlly = (allyInstanceId: string) =>
    setMode((m) => {
      if (m?.kind !== 'vanquish-pick-allies') return m
      const selected = m.selected.includes(allyInstanceId)
        ? m.selected.filter((id) => id !== allyInstanceId)
        : [...m.selected, allyInstanceId]
      return { ...m, selected }
    })
  const handleVanquishConfirm = () => {
    if (mode?.kind !== 'vanquish-pick-allies') return
    // Un Héros de force EFFECTIVE 0 s'élimine sans Allié (action Éliminer simple ;
    // Intimidation / Tendre un Piège exigent toujours un Allié).
    const needed = userStrengths[mode.heroInstanceId] ?? 0
    const allowNoAlly = needed === 0 && !mode.viaCard && !mode.trap
    if (mode.selected.length === 0 && !allowNoAlly) return
    if (mode.trap) {
      // Vanquish facultatif de Tendre un Piège (déplacement déjà appliqué).
      trapVanquish(mode.heroInstanceId, mode.selected)
    } else if (mode.viaCard) {
      // Vanquish via Intimidation : on JOUE LA CARTE.
      const v = mode.viaCard
      doPlayCard(
        mode.diablo,
        mode.actionId,
        v.instanceId,
        undefined,
        undefined,
        mode.heroInstanceId,
        mode.selected,
        v.allyMove,
      )
    } else {
      doVanquish(mode.diablo, mode.actionId, mode.heroInstanceId, mode.selected)
    }
    setMode(null)
  }
  const noop = () => {}

  // Mode de la main : pendant pose/association on la fige (on clique un lieu/allié, pas une carte).
  const handMode: 'idle' | 'play' | 'discard' | 'condition-ally' =
    tyrannyDiscard
      ? 'discard'
      : isHumanTurn && (mode?.kind === 'play' || mode?.kind === 'discard')
        ? mode.kind
        : mode?.kind === 'condition-pick-ally'
          ? 'condition-ally'
          : 'idle'

  // Carte de la main en cours de sélection (on choisit sa cible/destination) :
  // garde son cadre jaune le temps du sous-flux (poser, associer, cibler…).
  const selectedHandCardId: string | null = !mode
    ? null
    : mode.kind === 'place' ||
        mode.kind === 'attach' ||
        mode.kind === 'play-pick-hero' ||
        mode.kind === 'shrink-pick-action' ||
        mode.kind === 'trap-pick-ally' ||
        mode.kind === 'trap-pick-dest' ||
        mode.kind === 'sacrifice-pick' ||
        mode.kind === 'drain-pick-ally' ||
        mode.kind === 'impuissance-choice' ||
        mode.kind === 'impuissance-pick-hero'
      ? mode.instanceId
      : mode.kind === 'vanquish-pick-hero' || mode.kind === 'vanquish-pick-allies'
        ? mode.viaCard?.instanceId ?? null
        : null

  // Défausse en cours (action « Défausser » OU Tyrannie) : cartes sélectionnées,
  // nombre requis (Tyrannie) et si la confirmation est possible. Sert à la fois
  // à la main (sélection) et à la case d'actions (boutons Défausser/Annuler).
  const discardSelected = tyrannyDiscard
    ? tyrannyPicks
    : mode?.kind === 'discard'
      ? mode.selected
      : []
  const discardRequired = tyrannyDiscard ? tyrannyDiscard.count : undefined
  const discardCanConfirm =
    discardRequired !== undefined
      ? discardSelected.length === discardRequired
      : discardSelected.length > 0

  // Lieux cliquables comme destination (mode « poser ») : pour un Objet à associer,
  // seuls les lieux portant un Allié ; sinon n'importe quel lieu du joueur.
  // Si le mode 'place' concerne une carte spécifique (Allié/Objet/Malédiction),
  // on filtre les lieux où la pose serait illégale (Malédiction empilée /
  // Pimprenelle). Pour les autres cartes, tous les lieux du joueur sont permis.
  const cardInPlay =
    mode?.kind === 'place' ? user.hand.find((c) => c.instanceId === mode.instanceId) : undefined
  const placeTargets: string[] =
    mode?.kind === 'place'
      ? user.locations
          .map((l) => l.id)
          .filter((id) => {
            // Carte à pose restreinte (Lampe Merveilleuse → Caverne uniquement).
            if (cardInPlay?.playOnlyAt && id !== cardInPlay.playOnlyAt) return false
            if (mode.isAttach)
              return (user.board[id] ?? []).some(
                (c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized),
              )
            if (cardInPlay?.type === 'curse') return canPlaceCurseAt(state, HUMAN, id, cardInPlay)
            // Limite d'exemplaires par lieu (Page : max 2 posées librement).
            if (cardInPlay?.maxAtLocation !== undefined) {
              const here = (user.board[id] ?? []).filter(
                (c) => c.cardId === cardInPlay.cardId && !c.attachedTo,
              ).length
              return here < cardInPlay.maxAtLocation
            }
            return true
          })
      : mode?.kind === 'move-dest'
        ? // Un Titan (Hadès) suit ses règles propres : ≤1 lieu, bloqué par Hercule
          // sur SON lieu uniquement. Les autres cartes : lieu voisin classique.
          (user.board[mode.from] ?? []).find((c) => c.instanceId === mode.instanceId)?.isTitan
          ? titanReachableDests(state, HUMAN, mode.instanceId, 1)
          : adjacentLocationIds(state, mode.from)
      : mode?.kind === 'move-hero-dest' || mode?.kind === 'activate-iago-dest'
        ? adjacentLocationIds(state, mode.from)
        : mode?.kind === 'trap-pick-dest'
          ? user.locations.map((l) => l.id) // n'importe quel lieu (Tendre un Piège)
          : mode?.kind === 'sheriff-dest' || mode?.kind === 'diablo-dest'
            ? user.locations
                .map((l) => l.id)
                .filter((id) => (user.board[id] ?? []).every((c) => c.instanceId !== mode.instanceId))
            : mode?.kind === 'condition-pick-place'
              ? user.locations.map((l) => l.id) // Lâcheté : n'importe quel lieu
              : []
  const attachLocation = mode?.kind === 'attach' ? mode.to : null
  // Mode « cliquer une carte » : déplacement classique OU phase 1 de Tendre un Piège.
  const selectableCards =
    mode?.kind === 'move-pick' ||
    mode?.kind === 'trap-pick-ally' ||
    mode?.kind === 'activate-pick' ||
    mode?.kind === 'sacrifice-pick' ||
    mode?.kind === 'drain-pick-ally'
  // Liste PRÉCISE des cartes cliquables pour les modes restreints aux Alliés
  // (épuisement d'énergie : Allié sur l'Observatoire ; Tendre un Piège : Allié à
  // déplacer) — sans elle, les Objets seraient à tort surlignés/cliquables.
  const selectableCardIds: string[] | null =
    mode?.kind === 'drain-pick-ally'
      ? drainStarAllies(state).map((c) => c.instanceId)
      : mode?.kind === 'trap-pick-ally'
        ? Object.values(user.board)
            .flat()
            .filter((c) => c.type === 'ally' && !c.isWicket && !c.attachedTo)
            .map((c) => c.instanceId)
        : null
  // Règle officielle Vanquish : on peut viser N'IMPORTE QUEL Héros du royaume
  // (pas forcément sur le lieu du pion). Les alliés utilisés doivent être au
  // LIEU DU HÉROS choisi (Archers Loups : depuis un lieu voisin).
  const vanquishHeroTargets: string[] =
    mode?.kind === 'vanquish-pick-hero' ||
    mode?.kind === 'play-pick-hero' ||
    mode?.kind === 'condition-pick-hero' ||
    mode?.kind === 'move-hero-pick' ||
    mode?.kind === 'item-attach-hero' ||
    mode?.kind === 'impuissance-pick-hero'
      ? (() => {
          const allHeroes = Object.values(user.board).flatMap((cards) =>
            cards.filter((c) => c.type === 'hero'),
          )
          // Objet associé à un Héros (Forme de grenouille…) : Héros non hypnotisés.
          if (mode?.kind === 'item-attach-hero') {
            return allHeroes.filter((h) => !h.hypnotized).map((c) => c.instanceId)
          }
          // Apparence de Dragon : seuls les Héros ≤ maxStrength sont des cibles.
          if (mode?.kind === 'play-pick-hero') {
            const card = user.hand.find((c) => c.instanceId === mode.instanceId)
            const limit = card?.effects?.find((e) => e.type === 'INSTANT_VANQUISH_HERO_LE')
            if (limit && limit.type === 'INSTANT_VANQUISH_HERO_LE') {
              return allHeroes.filter((h) => (h.strength ?? 0) <= limit.maxStrength).map((c) => c.instanceId)
            }
            // Disparition : seulement les Héros sur le lieu du pion.
            if (card?.effects?.some((e) => e.type === 'INSTANT_VANQUISH_HERO_AT_PAWN')) {
              return (user.board[user.pawnLocation ?? ''] ?? [])
                .filter((c) => c.type === 'hero')
                .map((c) => c.instanceId)
            }
            // Rapetisser : on ne peut pas rapetisser deux fois → exclure les Héros
            // déjà rapetissés.
            if (card?.effects?.some((e) => e.type === 'SET_HERO_SIZE' && e.size === 'shrunk')) {
              return allHeroes.filter((h) => h.heroSize !== 'shrunk').map((c) => c.instanceId)
            }
          }
          // Méchanceté : héros ≤4 force.
          if (mode?.kind === 'condition-pick-hero') {
            return allHeroes.filter((h) => (h.strength ?? 0) <= 4).map((c) => c.instanceId)
          }
          // Impuissance (branche Éliminer) : Héros ≤3 force.
          if (mode?.kind === 'impuissance-pick-hero') {
            return allHeroes.filter((h) => (h.strength ?? 0) <= 3).map((c) => c.instanceId)
          }
          return allHeroes.map((c) => c.instanceId)
        })()
      : []
  // Localisation du héros ciblé (mode pick-allies).
  const heroLoc = (() => {
    if (mode?.kind !== 'vanquish-pick-allies') return null
    for (const loc of user.locations) {
      if ((user.board[loc.id] ?? []).some((c) => c.instanceId === mode.heroInstanceId)) return loc.id
    }
    return null
  })()
  const vanquishAllyCandidates: string[] =
    mode?.kind === 'vanquish-pick-allies' && heroLoc
      ? (() => {
          // Simule l'éventuel déplacement Tendre un Piège pour lister les alliés
          // que l'engine acceptera (l'allié déplacé compte à sa NOUVELLE position).
          const trap = mode.viaCard?.allyMove
          const simulatedAt = (loc: string): CardInstance[] => {
            const here = (user.board[loc] ?? []).filter(
              (c) => !(trap && c.instanceId === trap.instanceId),
            )
            const movedIn =
              trap && trap.to === loc
                ? Object.values(user.board)
                    .flat()
                    .filter((c) => c.instanceId === trap.instanceId)
                : []
            return [...here, ...movedIn]
          }
          // Les arceaux (Cartes Gardes transformées) ne peuvent pas éliminer.
          const localAllies = simulatedAt(heroLoc).filter((c) => c.type === 'ally' && !c.isWicket)
          // Alliés « à distance » : Archers Loups (Prince Jean) et Flibustiers
          // (Crochet) peuvent éliminer un Héros d'un lieu VOISIN non bloqué.
          const adjArchers = adjacentLocationIds(state, heroLoc).flatMap((adj) =>
            simulatedAt(adj).filter(
              (c) => (c.cardId === 'archers-loups' || c.cardId === 'flibustiers') && !c.isWicket,
            ),
          )
          const heroCard = (user.board[heroLoc] ?? []).find(
            (c) => c.instanceId === mode.heroInstanceId,
          )
          const isBobby = heroCard?.cardId === 'bobby'
          const combined = isBobby
            ? localAllies.filter((a) => a.cardId !== 'archers-loups')
            : [...localAllies, ...adjArchers]
          return combined.map((c) => c.instanceId)
        })()
      : []
  const vanquishSelected = mode?.kind === 'vanquish-pick-allies' ? mode.selected : []
  const vanquishTotal = vanquishSelected.reduce(
    (n, id) => n + (userStrengths[id] ?? 0),
    0,
  )
  const vanquishNeeded =
    mode?.kind === 'vanquish-pick-allies'
      ? userStrengths[mode.heroInstanceId] ?? 0
      : 0

  const won = state.status === 'WON'
  // Fin de partie : écran Victoire/Défaite. « Regarder le plateau » le ferme en
  // laissant le plateau inactif (les 2 autres choix restent en haut à droite).
  // `watchBoard` n'a de sens que si `won` ; il est remis à false au redémarrage
  // (replaySameVillains) — seul retour PLAYING en place.
  const [watchBoard, setWatchBoard] = useState(false)
  // Avant l'écran de fin : le plateau du PERDANT se fissure et vole en éclats
  // (« miroir brisé »). `endShatterDone` passe à vrai quand l'animation est finie
  // → l'écran Victoire/Défaite s'affiche alors. Réinitialisé au redémarrage.
  const [endShatterDone, setEndShatterDone] = useState(false)
  // MODE TEST : prévisualise la SÉQUENCE complète de fin (éclat du plateau → écran).
  // `testShatterSeat` = plateau qui éclate ; `testEndKind` = écran à montrer ensuite.
  const [testShatterSeat, setTestShatterSeat] = useState<'user' | 'bot' | null>(null)
  const [testEndKind, setTestEndKind] = useState<'victory' | 'defeat' | null>(null)
  // Conteneurs des plateaux : mesurés pour caler l'animation d'éclat (plein écran).
  const userBoardRef = useRef<HTMLDivElement>(null)
  const botBoardRef = useRef<HTMLDivElement>(null)
  const winnerIndex = won ? state.winner ?? null : null
  const winnerKey = winnerIndex != null ? villainKeyOf(state.players[winnerIndex].villain) : null
  const loserKey =
    winnerIndex != null ? villainKeyOf(state.players[1 - winnerIndex].villain) : null
  // Siège (panneau) du perdant : 'user' (siège HUMAIN) ou 'bot'.
  const loserSeat: 'user' | 'bot' | null =
    winnerIndex == null ? null : 1 - winnerIndex === HUMAN ? 'user' : 'bot'
  // Plateau « détruit » : l'éclat reste affiché (puis son fond sombre) TANT QUE
  // l'écran de fin est là, pour que le plateau n'ait pas l'air intact derrière.
  // — Réel : du moment de la victoire jusqu'à « Regarder le plateau ».
  // — Test : pendant l'éclat, puis pendant l'aperçu de l'écran (perdant = côté opposé
  //   au vainqueur affiché).
  const userBoardDestroyed =
    (won && loserSeat === 'user' && !watchBoard) ||
    testShatterSeat === 'user' ||
    (!!victoryPreview && !victoryPreview.humanWon)
  const botBoardDestroyed =
    (won && loserSeat === 'bot' && !watchBoard) ||
    testShatterSeat === 'bot' ||
    (!!victoryPreview && victoryPreview.humanWon)
  // Une animation/écran de fin est-il en cours (réel OU test) ? Sert à couper la
  // musique de fond du tour (ex. Slenderman) pour laisser place au jingle de fin.
  const endActive = won || testShatterSeat !== null || victoryPreview !== null
  const replaySameVillains = () => {
    setWatchBoard(false)
    setEndShatterDone(false)
    stopVictoryBuildup()
    resetGame([humanVillainKey, opponentVillainKey])
  }
  // Musique de montée jouée au début de l'éclat : victoire OU défaite (réelle/test),
  // synchronisée pour que sa ~4,9ᵉ seconde coïncide avec l'écran de fin.
  const humanWon = winnerIndex === HUMAN
  const startShatterMusic = () => {
    if (humanWon || testEndKind === 'victory') startVictoryBuildup()
    else startDefeatBuildup()
  }

  return (
    <div
      className="villain-bg flex h-screen flex-col overflow-hidden bg-[#0a0814] text-white"
      style={{ backgroundImage: pageBackground, ...accentVars(userColor, botColor) }}
    >
      {/* Décor animé d'arrière-plan : un prop par vilain traverse la bande haute. */}
      <BackgroundAnimation
        playerVillain={humanVillainKey}
        opponentVillain={opponentVillainKey}
        playerIndex={HUMAN}
        opponentIndex={BOT}
        replayPlayer={debugAnim.player}
        replayOpponent={debugAnim.opponent}
      />
      <header className="relative z-30 flex items-center justify-end gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          {testMode && (
            <>
              <span className="text-white/50">Vilains (dev) :</span>
              <label className="flex items-center gap-1">
                <span className="text-sky-300">{user.villainName}</span>
                <select
                  value={currentVillains[0]}
                  onChange={(e) => handlePickVillain(0, e.target.value as VillainKey)}
                  className="rounded bg-black/30 px-1 py-0.5 text-white"
                >
                  {(Object.entries(VILLAIN_REGISTRY) as [VillainKey, { label: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-red-300">{bot.villainName}</span>
                <select
                  value={currentVillains[1]}
                  onChange={(e) => handlePickVillain(1, e.target.value as VillainKey)}
                  className="rounded bg-black/30 px-1 py-0.5 text-white"
                >
                  {(Object.entries(VILLAIN_REGISTRY) as [VillainKey, { label: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button
            onClick={() => {
              enterTestMode()
              setTestPicker(null)
              setTestFateError(null)
            }}
            title="Mode test : vide les deux plateaux pour composer une situation"
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              testMode
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                : 'border-white/20 text-white/80 hover:bg-white/10'
            }`}
          >
            🧪 Mode test
          </button>
          {testMode && (
            <>
              {/* Test : relance l'animation de décor de chaque vilain. */}
              <button
                onClick={() => setDebugAnim((d) => ({ ...d, player: d.player + 1 }))}
                title="Rejouer l'animation de décor du vilain 1 (joueur)"
                className="rounded-lg border border-sky-400/60 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-500/10"
              >
                🚢 Vilain 1
              </button>
              <button
                onClick={() => setDebugAnim((d) => ({ ...d, opponent: d.opponent + 1 }))}
                title="Rejouer l'animation de décor du vilain 2 (adversaire)"
                className="rounded-lg border border-rose-400/60 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10"
              >
                🚢 Vilain 2
              </button>
              {/* Test : SÉQUENCE complète de fin (éclat du plateau perdant → écran). */}
              <button
                onClick={() => { setTestEndKind('victory'); setTestShatterSeat('bot') }}
                title="Aperçu : VICTOIRE (le plateau adverse explose puis l'écran de victoire)"
                className="rounded-lg border border-amber-400/60 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-500/10"
              >
                🏆 Victoire
              </button>
              <button
                onClick={() => { setTestEndKind('defeat'); setTestShatterSeat('user') }}
                title="Aperçu : DÉFAITE (votre plateau explose puis l'écran de défaite)"
                className="rounded-lg border border-slate-400/60 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500/10"
              >
                💀 Défaite
              </button>
            </>
          )}
          {testMode && (
            <button
              onClick={() => setHideTestBar((v) => !v)}
              title="Masquer/afficher le panneau de test (qui décale le layout réel)"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              {hideTestBar ? '👁 Panneau' : '🙈 Panneau'}
            </button>
          )}
          {testMode && (
            <button
              onClick={() => {
                reset()
                setTestPicker(null)
                setTestFateError(null)
              }}
              title="Quitter le mode test (relance une partie normale)"
              className="rounded-lg border border-emerald-400/60 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/10"
            >
              ✖ Quitter le test
            </button>
          )}
          <button
            onClick={() => setShowOptions(true)}
            onMouseEnter={playHover}
            title="Options (musique, volume)"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ⚙ Options
          </button>
          {onExit && (
            <button
              onClick={() => setShowQuitConfirm(true)}
              onMouseEnter={playHover}
              title={gameMode !== 'solo' ? 'Quitter la partie en réseau' : 'Revenir au menu principal'}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              {gameMode !== 'solo' ? '⏻ Quitter' : '☰ Menu'}
            </button>
          )}
        </div>
      </header>

      {/* 3 colonnes : toi (bleu) · journal · bot (rouge). Chacune scrolle en interne.
          En mode test, les deux camps restent visibles (édition live des plateaux). */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_13rem_1fr]">
        {/* ----- Colonne joueur (bleu) ----- */}
        <Scroller element="section" className="game-board min-h-0" options={{ overflow: { x: 'hidden' } }}>
          <div className="flex min-h-full flex-col gap-2">
          {/* Le panneau (nom + jetons + objectif) est déplacé dans la bande du bas
              pour rendre de la hauteur à la colonne (moins de scroll). */}
          {/* Séparateur du haut réduit au minimum (le bloc plateau remonte). */}
          <div aria-hidden className="grow-0" />
          {/* Div du haut, vide pour l'instant (hauteur fixe) — accueillera d'autres
              piles plus tard. En dessous, `fatality-cases` : StacksCards à gauche
              puis les 4 cases Héros. */}
          <div className="w-full">
            <div className="stacks-top flex h-24 w-full justify-start gap-3" />
            <div className="fatality-cases flex items-start gap-3" style={{ paddingLeft: '1%' }}>
              <StacksCards player={user} playerIndex={HUMAN} />
              <div className="flex-1">
                <HeroRow
                  player={user}
                  strengths={userStrengths}
                  vanquishTargets={vanquishHeroTargets}
                  onVanquishPickHero={(id, name) => {
                    if (mode?.kind === 'play-pick-hero') handlePlayPickHero(id)
                    else if (mode?.kind === 'condition-pick-hero') handleConditionPickHero(id)
                    else if (mode?.kind === 'move-hero-pick') handleMoveHeroPick(id)
                    else if (mode?.kind === 'item-attach-hero') handleItemAttachHero(id)
                    else handleVanquishPickHero(id, name)
                  }}
                  canDiscardDeguisement={isHumanTurn && state.phase === 'ACTION' && user.power >= 2}
                  onDiscardDeguisement={discardDeguisement}
                  hiddenInstanceIds={showcaseHiddenIds}
                  redBlinkInstanceIds={robinBlinkIds}
                  offset={false}
                />
              </div>
            </div>
          </div>
          {/* Plateau (image). Les deux joueurs sont le Prince Jean pour l'instant.
              Un Héros posé masque la rangée d'actions du haut de son lieu. */}
          <div className="relative" ref={userBoardRef}>
            <BoardImage player={user} showPawn pawnOutline={`color-mix(in srgb, ${VILLAIN_COLOR[user.villain]}, white 45%)`} imgClassName="border border-[color:var(--pa-line-soft)]" hiddenHeroInstanceIds={showcaseHiddenIds} unmaskHeroLocationId={persifleurLoc} crewmateCandidates={state.pendingCrewmateKill?.playerIndex === HUMAN ? state.pendingCrewmateKill.candidateColors : undefined} onCrewmateClick={(color) => { if (state.pendingCrewmateKill?.mode === 'kill') playKillSound(); resolveCrewmateKill(color) }} crewmateSelectVerb={state.pendingCrewmateKill?.mode === 'reassure' ? 'Rassurer' : state.pendingCrewmateKill?.mode === 'kill-normal' ? 'Éliminer' : state.pendingCrewmateKill?.mode === 'move' ? 'Déplacer' : 'Défausser'} />
            <BoardActions
              player={user}
              availableActionIds={availableActions.map((a) => a.id)}
              usedActionIds={isHumanTurn ? state.usedActionIds : []}
              blinkTopAtLocation={persifleurLoc}
              activeLocationId={state.actAtLocation || user.pawnLocation || undefined}
              flashKey={isHumanTurn ? actionFlash : null}
              onActionClick={handleBoardAction}
            />
            {/* Éclat « miroir brisé » du plateau (fin de partie : perdant ; ou test).
                Reste affiché (fond sombre) tant que l'écran de fin est là. */}
            {userBoardDestroyed && (
              <MirrorShatter
                src={user.boardImage}
                targetRef={userBoardRef}
                onStart={startShatterMusic}
                onDone={() => {
                  if (testShatterSeat === 'user') {
                    // Test « Défaite » : après l'éclat de MON plateau → écran DÉFAITE.
                    setTestShatterSeat(null)
                    setTestEndKind(null)
                    setVictoryPreview({ humanWon: false, winnerKey: opponentVillainKey, loserKey: humanVillainKey })
                  } else setEndShatterDone(true)
                }}
              />
            )}
          </div>
          {/* En dessous de l'image : cartes du méchant. Pioche + défausse Vilain
              sont placées en bas du plateau (voir plus bas). La marge gauche reste
              vide pour aligner les colonnes du plateau avec l'image. */}
          <div className="flex">
            {/* Marge gauche = panneau « Pile Au-delà » du plateau : on y place la
                pile de l'Au-delà (pile secondaire) du Dr Facilier. */}
            <div className="piles-secondaires flex items-start justify-center pt-1" style={{ width: `${LOCATIONS_LEFT}%` }}>
              <AuDelaPile player={user} uprightWidth="w-20" />
              <IngredientsPile player={user} uprightWidth="w-14" />
              <SuccessionPile player={user} uprightWidth="w-14" />
            </div>
            <div className="flex-1">
              <Board
                player={user}
                accent={BLUE}
                showCurrentSnake={state.activePlayer === HUMAN && state.phase === 'ACTION'}
                legalMoves={legalMoves}
                placeTargets={placeTargets}
                attachLocation={attachLocation}
                selectableCards={selectableCards}
                selectableCardIds={selectableCardIds}
                vanquishAllyCandidates={vanquishAllyCandidates}
                vanquishSelected={vanquishSelected}
                onVanquishToggle={handleVanquishToggleAlly}
                sheriffMovable={sheriffMovable}
                onSheriffMoveStart={handleSheriffMoveStart}
                diabloMovable={diabloMovable}
                onDiabloMoveStart={handleDiabloMoveStart}
                highlightPersifleurAt={persifleurLoc}
                canSkipMove={isHumanTurn && state.phase === 'MOVE' && !!user.skipNextMove}
                onSkipMove={handleSkipMove}
                strengths={userStrengths}
                offset={false}
                onLocationInsert={
                  testMode
                    ? (locId, rect) =>
                        setTestPicker({ playerIndex: HUMAN, locationId: locId, x: rect.left, y: rect.bottom + 4 })
                    : undefined
                }
                onMove={handleMove}
                onPlace={handlePlace}
                onAttach={handleAttach}
                onCardPick={handleCardPick}
                grantedActionIds={availableActions.filter((a) => a.grantedBy).map((a) => a.id)}
                onGrantedAction={handleGrantedAction}
                mapUsable={
                  isHumanTurn &&
                  state.phase === 'ACTION' &&
                  Object.values(user.board).flat().some((c) => c.cardId === 'carte-pays-imaginaire')
                }
                onUseMap={() => setMapModalOpen(true)}
              />
            </div>
          </div>
          {(mode?.kind === 'place' ||
            mode?.kind === 'attach' ||
            mode?.kind === 'item-attach-hero' ||
            mode?.kind === 'move-pick' ||
            mode?.kind === 'move-dest' ||
            mode?.kind === 'move-hero-pick' ||
            mode?.kind === 'move-hero-dest' ||
            mode?.kind === 'vanquish-pick-hero' ||
            mode?.kind === 'vanquish-pick-allies' ||
            mode?.kind === 'play-pick-hero' ||
            mode?.kind === 'trap-pick-ally' ||
            mode?.kind === 'trap-pick-dest' ||
            mode?.kind === 'sheriff-dest' ||
            mode?.kind === 'diablo-dest' ||
            mode?.kind === 'condition-pick-ally' ||
            mode?.kind === 'condition-pick-place' ||
            mode?.kind === 'condition-pick-hero' ||
            mode?.kind === 'activate-pick' ||
            mode?.kind === 'activate-iago-dest' ||
            mode?.kind === 'sacrifice-pick' ||
            mode?.kind === 'drain-pick-ally' ||
            mode?.kind === 'impuissance-choice' ||
            mode?.kind === 'impuissance-pick-hero') && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/70 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <span>
                {mode.kind === 'place' ? (
                  <>
                    Pose <b>{mode.cardName}</b> : clique le <b>lieu</b> de destination
                    {mode.isAttach ? ' (lieux avec un allié, surlignés)' : ' (surligné)'}.
                  </>
                ) : mode.kind === 'attach' ? (
                  <>
                    Associer <b>{mode.cardName}</b> : clique l'<b>allié</b> porteur (carte surlignée).
                  </>
                ) : mode.kind === 'item-attach-hero' ? (
                  <>
                    Associer <b>{mode.cardName}</b> : clique le <b>Héros</b> à cibler (surligné en rouge).
                  </>
                ) : mode.kind === 'move-pick' ? (
                  <>
                    Déplacer : clique l'<b>allié ou l'objet</b> à bouger (cartes surlignées).
                  </>
                ) : mode.kind === 'move-dest' ? (
                  <>
                    Déplacer <b>{mode.cardName}</b> : clique un <b>lieu voisin</b> (surligné).
                  </>
                ) : mode.kind === 'move-hero-pick' ? (
                  <>
                    Déplacer un Héros : clique le <b>Héros</b> à déplacer (surligné en rouge).
                  </>
                ) : mode.kind === 'move-hero-dest' ? (
                  <>
                    Déplacer <b>{mode.heroName}</b> : clique un <b>lieu voisin</b> (surligné).
                  </>
                ) : mode.kind === 'vanquish-pick-hero' ? (
                  <>
                    Éliminer : clique le <b>Héros</b> à viser dans ton royaume (surligné en rouge).
                  </>
                ) : mode.kind === 'play-pick-hero' ? (
                  <>
                    <b>{mode.cardName}</b> : clique le <b>Héros</b> à cibler (surligné en rouge).
                  </>
                ) : mode.kind === 'trap-pick-ally' ? (
                  <>
                    <b>{mode.cardName}</b> phase 1 : clique l'<b>Allié</b> à déplacer librement (surligné vert).
                  </>
                ) : mode.kind === 'trap-pick-dest' ? (
                  <>
                    <b>{mode.cardName}</b> phase 2 : clique le <b>lieu</b> de destination pour <b>{mode.allyName}</b> (surligné).
                  </>
                ) : mode.kind === 'sheriff-dest' ? (
                  <>
                    Déplacement <b>Shérif</b> : clique le <b>lieu</b> de destination (n'importe lequel sauf le sien). +1 JT si un Héros y est.
                  </>
                ) : mode.kind === 'diablo-dest' ? (
                  <>
                    Déplacement <b>Diablo</b> : clique le <b>lieu</b> de destination (n'importe lequel sauf le sien).
                  </>
                ) : mode.kind === 'condition-pick-ally' ? (
                  <>
                    <b>{user.hand.find((c) => c.instanceId === mode.instanceId)?.name ?? 'Condition'}</b> : clique un <b>Allié</b> de ta main à poser gratuitement.
                  </>
                ) : mode.kind === 'condition-pick-place' ? (
                  <>
                    <b>{mode.cardName}</b> : pose <b>{mode.allyName}</b> sur un <b>lieu</b> (surligné).
                  </>
                ) : mode.kind === 'condition-pick-hero' ? (
                  <>
                    <b>Méchanceté</b> : clique le <b>Héros</b> à éliminer (≤4 force, rouge).
                  </>
                ) : mode.kind === 'activate-pick' ? (
                  <>
                    <b>Activer</b> : clique la carte à activer (cartes surlignées).
                  </>
                ) : mode.kind === 'activate-iago-dest' ? (
                  <>
                    <b>Iago</b> : clique le <b>lieu voisin</b> de destination (Iago + 1 Objet de son lieu, −1 JT).
                  </>
                ) : mode.kind === 'sacrifice-pick' ? (
                  <>
                    <b>Sacrifice Nécessaire</b> : clique l'<b>Allié ou l'Objet</b> à défausser (+3 JT).
                  </>
                ) : mode.kind === 'drain-pick-ally' ? (
                  <>
                    <b>épuisement d'énergie</b> : clique l'<b>Allié</b> (sur ton lieu) qui reçoit l'Étoile (surligné).
                  </>
                ) : mode.kind === 'impuissance-choice' ? (
                  <>
                    <b>Impuissance</b> : choisis <b>Capturer Peach</b> ou <b>Éliminer un Héros</b> (force ≤ 3).
                  </>
                ) : mode.kind === 'impuissance-pick-hero' ? (
                  <>
                    <b>Impuissance</b> : clique le <b>Héros</b> à éliminer (force ≤ 3, rouge).
                  </>
                ) : (
                  vanquishNeeded === 0 && !mode.viaCard && !mode.trap ? (
                    <>
                      Éliminer <b>{mode.heroName}</b> (force 0) : <b>aucun Allié requis</b>, clique « Éliminer ».
                    </>
                  ) : (
                  <>
                    Éliminer <b>{mode.heroName}</b> (force {vanquishNeeded}) : coche les <b>Alliés</b> à utiliser. Total :{' '}
                    <b className={vanquishTotal >= vanquishNeeded ? 'text-emerald-300' : 'text-red-300'}>
                      {vanquishTotal}
                    </b>{' '}
                    / {vanquishNeeded}.
                  </>
                  )
                )}
              </span>
              <div className="flex items-center gap-2">
                {mode.kind === 'vanquish-pick-allies' && (
                  <button
                    onClick={handleVanquishConfirm}
                    disabled={
                      vanquishTotal < vanquishNeeded ||
                      (vanquishSelected.length === 0 &&
                        !(vanquishNeeded === 0 && !mode.viaCard && !mode.trap))
                    }
                    className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    Éliminer
                  </button>
                )}
                {mode.kind === 'trap-pick-ally' && (
                  <button
                    onClick={handleTrapSkipMove}
                    className="rounded border border-amber-400/60 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/10"
                  >
                    Ne pas déplacer
                  </button>
                )}
                {mode.kind === 'impuissance-choice' && (
                  <>
                    <button
                      onClick={() => {
                        // Capturer Peach (sans cible) : seulement si Peach est en jeu.
                        const peachPresent = Object.values(user.board).flat().some((c) => c.type === 'hero' && c.cardId === 'peach')
                        if (!peachPresent) return
                        doPlayCard(mode.diablo, mode.actionId, mode.instanceId)
                        setMode(null)
                      }}
                      disabled={!Object.values(user.board).flat().some((c) => c.type === 'hero' && c.cardId === 'peach')}
                      className="rounded bg-fuchsia-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-fuchsia-500 disabled:opacity-40"
                    >
                      Capturer Peach
                    </button>
                    <button
                      onClick={() =>
                        setMode({ kind: 'impuissance-pick-hero', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, diablo: mode.diablo })
                      }
                      className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500"
                    >
                      Éliminer un Héros
                    </button>
                  </>
                )}
                <button
                  onClick={() => setMode(null)}
                  className="rounded border border-amber-500/60 px-2 py-1 text-amber-300 hover:bg-amber-500/10"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
          {state.diabloFree && isHumanTurn && (
            <div className="rounded-lg border border-violet-400/70 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
              {diabloSubflow ? (
                <div className="flex items-center justify-between gap-2">
                  <span>
                    🐦 <b>Action gratuite de Diablo</b> en cours — choisis dans ton plateau / ta main.
                  </span>
                  <button
                    onClick={() => setMode(null)}
                    className="rounded border border-violet-400/60 px-2 py-1 hover:bg-violet-400/10"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    🐦 <b>Diablo</b> : action gratuite sur <b>{diabloFreeLoc?.name}</b>.
                  </span>
                  {diabloFreeActions.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleDiabloFreeAction(a)}
                      className="rounded bg-violet-600 px-2 py-1 text-white hover:bg-violet-500"
                    >
                      {a.label}
                    </button>
                  ))}
                  <button
                    onClick={handleDiabloSkip}
                    className="rounded border border-violet-400/60 px-2 py-1 hover:bg-violet-400/10"
                  >
                    Passer
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Tendre un Piège : Vanquish facultatif après le déplacement (déjà appliqué). */}
          {isHumanTurn && state.pendingTrapVanquish && !mode && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-400/70 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">
              <span>
                🪤 <b>Tendre un Piège</b> : tu peux éliminer un Héros (facultatif).
              </span>
              <button
                onClick={handleTrapStartVanquish}
                className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
              >
                Éliminer un Héros
              </button>
              <button
                onClick={handleTrapFinish}
                className="rounded border border-orange-400/60 px-2 py-1 text-orange-200 hover:bg-orange-500/10"
              >
                Terminer
              </button>
            </div>
          )}
          {/* Véhicule (Char d'Hadès / Bateau de Bowser) : déplacer figurine + Objet
              vers n'importe quel lieu (1×/tour). */}
          {chariotCard && !mode && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-400/70 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              <span>
                🏛️ <b>{chariotName}</b> : déplace ta figurine et le {chariotName} vers
              </span>
              {user.locations
                .filter((l) => l.id !== user.pawnLocation)
                .map((l) => (
                  <button
                    key={l.id}
                    onClick={() => chariotMove(chariotCard, l.id)}
                    className="rounded bg-sky-600 px-2 py-1 font-medium text-white hover:bg-sky-500"
                  >
                    {l.name}
                  </button>
                ))}
            </div>
          )}
          {/* Canne (Dr Facilier) : agir sur un lieu voisin (hors Fatalité), 1×/tour. */}
          {canneAvailable && !mode && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-400/70 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100">
              <span>
                🦯 <b>Canne</b> : effectue une action d'un lieu voisin (hors Fatalité).
              </span>
              <button
                onClick={() => activateCanne()}
                className="rounded bg-fuchsia-600 px-2 py-1 font-medium text-white hover:bg-fuchsia-500"
              >
                Utiliser
              </button>
            </div>
          )}
          {/* La main du joueur est désormais ancrée en bas de l'écran (éventail). */}
          {/* Module test (suivi de test + panneau d'injection) : sous la main. */}
          {testMode && !hideTestBar && (
            <>
              <TestChecklist />
              <TestFateBar
                villain={currentVillains[0]}
                locations={user.locations.map((l) => ({ id: l.id, name: l.name }))}
                handAllies={user.hand
                  .filter((c) => c.type === 'ally')
                  .map((c) => ({ instanceId: c.instanceId, name: c.name }))}
                boardHeroes={user.locations.flatMap((l) =>
                  (user.board[l.id] ?? [])
                    .filter((c) => c.type === 'hero')
                    .map((c) => ({ instanceId: c.instanceId, name: c.name, strength: c.strength ?? 0, locationId: l.id })),
                )}
                onInflict={handleInflict}
                onPlayCondition={handleTestCondition}
                onPlayFateCard={handleTestFateCard}
                onAddToHand={testAddToHand}
                onAddToAuDela={testAddToAuDela}
                onShowcase={testShowcase}
                error={testFateError}
              />
            </>
          )}
          {/* Défausse + Pioche Vilain : côte à côte, verticales, poussées en bas
              (remontées de 20 px du bas via mb-5). */}
          <div className="mt-auto mb-5 flex justify-end gap-3 px-2 pt-1">
            <DeckPiles player={user} kind="villain" playerIndex={HUMAN} show="discard" upright uprightWidth="w-28" zoomClass="bottom-0 right-full mr-1" />
            <DeckPiles player={user} kind="villain" playerIndex={HUMAN} show="deck" upright uprightWidth="w-28" />
          </div>
          </div>
        </Scroller>

        {/* ----- Milieu : tour courant + fin de tour, puis journal ----- */}
        <aside className="flex min-h-0 flex-col gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3" data-turn-indicator>
            <div className="mb-2 text-center">
              {won ? (
                <div className="text-lg font-bold text-amber-200">
                  🏆 {state.players[state.winner!].villainName}
                </div>
              ) : (
                // Une « manche » = les deux joueurs ont joué. `state.turn` compte
                // chaque tour-joueur (1,2,3…), d'où la division par 2.
                <div className="text-2xl font-bold tracking-wide text-white">
                  Tour {Math.ceil(state.turn / 2)}
                </div>
              )}
              <div className="mt-0.5 font-mono text-xs text-white/55">
                ⏱ <GameTimer running={state.status === 'PLAYING' && startRollDone} />
              </div>
            </div>
            {handMode === 'discard' ? (
              // Pendant la défausse, le bouton « Fin de tour » est remplacé par un
              // bouton « Défausser » identique mais BLEU (confirme la défausse).
              <button
                type="button"
                onClick={handleConfirmDiscard}
                disabled={!discardCanConfirm}
                className="hs-wrapper bleu"
              >
                <span className="hs-button bleu">
                  <span className="hs-border bleu">
                    <span
                      className="hs-text bleu"
                      style={{ fontSize: '1rem', letterSpacing: '0.5px', whiteSpace: 'nowrap', padding: '0.6rem 0.5rem' }}
                    >
                      Défausser ({discardSelected.length}
                      {discardRequired !== undefined ? `/${discardRequired}` : ''})
                    </span>
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (testMode) { testRefreshTurn(); return }
                  playEndTurnFlip()
                  handleEndTurn()
                }}
                disabled={testMode ? false : !canEnd}
                title={testMode ? 'Mode test : nouveau tour — choisis le lieu de ton pion (phase déplacement), repioche, sans passer la main au bot' : undefined}
                className="hs-wrapper classique"
              >
                <span className="hs-button classique">
                  <span className="hs-border classique">
                    <span className="hs-text classique">
                      {testMode ? 'Nouveau tour (test)' : isBotTurn ? 'Tour adverse' : 'Fin de tour'}
                    </span>
                  </span>
                </span>
              </button>
            )}
          </div>
          {humanReactions.length > 0 && !reactionPassed && !state.pendingTyrannyDiscard && (
            <div className="armed-blink-rose rounded-xl border border-fuchsia-500/60 bg-fuchsia-500/10 p-2 text-xs text-fuchsia-100">
              <div className="mb-1 font-semibold">⚡ Réaction disponible</div>
              {isBotTurn && (
                <div className="mb-1 text-[10px] text-fuchsia-200/80">
                  {bot.villainName} attend ta décision.
                </div>
              )}
              <div className="flex flex-col gap-1">
                {humanReactions.map((c) => (
                  <button
                    key={c.instanceId}
                    onClick={() => handlePlayReaction(c)}
                    onMouseEnter={() => setHoveredReactionId(c.instanceId)}
                    onMouseLeave={() =>
                      setHoveredReactionId((id) => (id === c.instanceId ? null : id))
                    }
                    className="rounded bg-fuchsia-600 px-2 py-1 text-white hover:bg-fuchsia-500"
                  >
                    Jouer {c.name}
                  </button>
                ))}
                {isBotTurn && (
                  <button
                    onClick={() => setPassedTurnKey(turnKey)}
                    className="mt-1 rounded border border-fuchsia-400/40 px-2 py-1 text-fuchsia-200 hover:bg-fuchsia-400/10"
                  >
                    Passer (ne pas réagir)
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="journal min-h-0 flex-1">
            <GameLog
              log={state.log}
              playerNames={state.players.map((p) => p.villainName)}
              playerColors={state.players.map((p) => VILLAIN_COLOR[p.villain])}
            />
          </div>
          {/* Case d'actions : boutons de confirmation/annulation déplacés hors de la
              main. Apparaît pour tout mode actif (jouer une carte, défausser…). En
              défausse, « Fin de tour » reste grisé tant qu'on n'a pas cliqué
              « Défausser » ou « Annuler ». */}
          {handMode !== 'idle' && (
            <div className="actions-case rounded-xl border border-amber-400/60 bg-sky-500/20 p-3">
              {discardRequired !== undefined && (
                <p className="mb-2 text-center text-[11px] font-medium text-amber-200">
                  {tyrannyDiscard?.label ?? 'Tyrannie'} : choisis {discardRequired} carte{discardRequired > 1 ? 's' : ''} à défausser.
                </p>
              )}
              <div className="flex items-center justify-center gap-2">
                {/* La confirmation de défausse est portée par le bouton bleu
                    « Défausser » (qui remplace « Fin de tour »). Ici, seul reste
                    « Annuler » — sauf en défausse obligatoire (Tyrannie). */}
                {discardRequired === undefined && (
                  <button
                    onClick={() => setMode(null)}
                    className="rounded border border-red-500/60 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ----- Colonne bot (rouge) — lecture seule, main cachée. ----- */}
        <Scroller element="section" className="game-board min-h-0" options={{ overflow: { x: 'hidden' } }}>
          <div className="flex min-h-full flex-col gap-2">
          {/* Panneau du bot déplacé dans la bande du bas (cf. colonne joueur). */}
          <div aria-hidden className="grow-0" />
          {/* Même disposition que le joueur (div du haut vide + StacksCards à gauche des 4 cases). */}
          <div className="w-full">
            <div className="stacks-top flex h-24 w-full justify-start gap-3" />
            <div className="fatality-cases flex items-start gap-3" style={{ paddingLeft: '1%' }}>
              <StacksCards player={bot} playerIndex={BOT} />
              <div className="flex-1">
                <HeroRow
                  player={bot}
                  strengths={botStrengths}
                  hiddenInstanceIds={showcaseHiddenIds}
                  redBlinkInstanceIds={robinBlinkIds}
                  offset={false}
                />
              </div>
            </div>
          </div>
          <div className="relative" ref={botBoardRef}>
            <BoardImage player={bot} showPawn pawnOutline={`color-mix(in srgb, ${VILLAIN_COLOR[bot.villain]}, white 45%)`} imgClassName="border border-[color:var(--po-line-soft)]" hiddenHeroInstanceIds={showcaseHiddenIds} crewmateCandidates={state.pendingCrewmateSuspect?.chooserIndex === HUMAN && state.pendingCrewmateSuspect.targetIndex === BOT ? (bot.crewmates ?? []).filter((c) => !c.discarded && !c.suspect).map((c) => c.color) : undefined} onCrewmateClick={resolveCrewmateSuspect} crewmateSelectVerb="Rendre suspect" />
            {/* Aucune pastille d'action affichée pour le bot, SAUF le flash one-shot
                de l'action qu'il vient de jouer (pour visualiser ses coups). */}
            <BoardActions
              player={bot}
              availableActionIds={[]}
              usedActionIds={[]}
              flashKey={isOpponentTurn ? actionFlash : null}
              flashOnly
              onActionClick={noop}
            />
            {/* Éclat « miroir brisé » du plateau (fin de partie : perdant ; ou test).
                Reste affiché (fond sombre) tant que l'écran de fin est là. */}
            {botBoardDestroyed && (
              <MirrorShatter
                src={bot.boardImage}
                targetRef={botBoardRef}
                onStart={startShatterMusic}
                onDone={() => {
                  if (testShatterSeat === 'bot') {
                    // Test « Victoire » : après l'éclat du plateau ADVERSE → écran VICTOIRE.
                    setTestShatterSeat(null)
                    setTestEndKind(null)
                    setVictoryPreview({ humanWon: true, winnerKey: humanVillainKey, loserKey: opponentVillainKey })
                  } else setEndShatterDone(true)
                }}
              />
            )}
          </div>
          <div className="flex">
            {/* Marge gauche = panneau « Pile Au-delà » du plateau (bot). */}
            <div className="piles-secondaires flex items-start justify-center pt-1" style={{ width: `${LOCATIONS_LEFT}%` }}>
              <AuDelaPile player={bot} uprightWidth="w-20" />
              <IngredientsPile player={bot} uprightWidth="w-14" />
              <SuccessionPile player={bot} uprightWidth="w-14" />
            </div>
            <div className="flex-1">
              <Board
                player={bot}
                accent={RED}
                showCurrentSnake={state.activePlayer === BOT && state.phase === 'ACTION'}
                legalMoves={[]}
                placeTargets={[]}
                attachLocation={null}
                selectableCards={false}
                strengths={botStrengths}
                offset={false}
                onLocationInsert={
                  testMode
                    ? (locId, rect) =>
                        setTestPicker({ playerIndex: BOT, locationId: locId, x: rect.left, y: rect.bottom + 4 })
                    : undefined
                }
                onMove={noop}
                onPlace={noop}
                onAttach={noop}
                onCardPick={noop}
              />
            </div>
          </div>
          {/* Bas : main du bot CENTRÉE sous le plateau ; défausse/pioche Vilain en
              absolu à droite (pour ne pas décaler la main). */}
          <div className="relative mt-auto mb-5 flex justify-center px-2 pt-1">
            <div data-hand-zone={BOT}>
            <Hand
              hand={bot.hand}
              accent={RED}
              hidden={!botHandRevealed}
              backImage={bot.backVillainImage}
              mode="idle"
              power={bot.power}
              attachTargetsAvailable={false}
              blockEvents={false}
              realmHasAllies={false}
              realmHasHeroes={false}
              hasIngredients={false}
              heroAtPawn={false}
              canBite={false}
              selectedToDiscard={[]}
              layout="fan"
              cardWidthClass="w-28"
              onPlayCard={noop}
              onToggleDiscard={noop}
              onConfirmDiscard={noop}
              onCancel={noop}
            />
            </div>
            <div className="absolute bottom-0 right-2 flex items-end gap-3">
              <DeckPiles player={bot} kind="villain" playerIndex={BOT} show="discard" upright uprightWidth="w-28" zoomClass="bottom-0 right-full mr-1" />
              <DeckPiles player={bot} kind="villain" playerIndex={BOT} show="deck" upright uprightWidth="w-28" />
            </div>
          </div>
          </div>
        </Scroller>
      </main>

      {/* ----- Bande du bas : panneau joueur · main (éventail) · panneau adverse.
          Les panneaux (nom + jetons + objectif) ont quitté les colonnes des plateaux
          pour leur rendre de la hauteur (moins de scroll), regroupés ici de part et
          d'autre de la main. ----- */}
      <div className="bottom-bar relative z-20 grid shrink-0 items-center gap-3 border-t border-white/10 bg-black/30 px-3 py-1 shadow-[0_-6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md">
        {/* Panneau du joueur (gauche, bleu). */}
        <PlayerPanel player={user} accent={BLUE} isActive={state.activePlayer === HUMAN} isWinner={state.winner === HUMAN} />
        {/* Main du joueur (centre), légèrement relevée. */}
        <div data-hand-zone={HUMAN} className="-translate-y-4">
          <Hand
            hand={user.hand}
            accent={BLUE}
            hidden={false}
            backImage={user.backVillainImage}
            mode={handMode}
            power={user.power}
            attachTargetsAvailable={anyAllyOnBoard}
            blockEvents={humanEventsBlocked}
            realmHasAllies={anyAllyOnBoard}
            realmHasHeroes={anyHeroOnBoard}
            hasIngredients={(user.ingredients ?? []).some((c) => (c.cost ?? 0) <= user.power)}
            heroAtPawn={!!user.pawnLocation && (user.board[user.pawnLocation] ?? []).some((c) => c.type === 'hero')}
            canBite={canTakeABite(state, HUMAN)}
            costFor={(c) => effectiveCost(state, c)}
            armedConditionIds={humanReactions.map((c) => c.instanceId)}
            forcedHoverId={hoveredReactionId}
            selectedCardId={selectedHandCardId}
            selectedToDiscard={discardSelected}
            requiredDiscardCount={discardRequired}
            layout="fan"
            onPlayCard={handlePlayCard}
            onToggleDiscard={handleToggleDiscard}
            onConfirmDiscard={handleConfirmDiscard}
            onCancel={() => setMode(null)}
          />
        </div>
        {/* Panneau adverse (droite, rouge). */}
        <PlayerPanel player={bot} accent={RED} isActive={state.activePlayer === BOT} isWinner={state.winner === BOT} />
      </div>

      {/* Résolution de Fatalité par le joueur humain (le bot résout tout seul). */}
      {state.pendingFate && isHumanTurn && (
        <FateModal
          revealed={state.pendingFate.revealed}
          target={state.players[state.pendingFate.target]}
          onResolve={resolveFate}
          optional={state.pendingFate.optional}
          onPass={passFate}
        />
      )}

      {/* Rapetisser : choix de l'action du haut à laisser libre (modale centrée). */}
      {mode?.kind === 'shrink-pick-action' && (() => {
        const loc = user.locations.find((l) =>
          (user.board[l.id] ?? []).some((c) => c.instanceId === mode.heroInstanceId),
        )
        const tops = loc ? loc.actions.filter((a) => a.row === 'top') : []
        return (
          <ChoiceModal
            title={mode.cardName}
            prompt="Choisis l'action du haut à laisser libre (l'autre sera recouverte par le Héros rapetissé)."
            options={tops.map((a) => ({ key: a.id, label: a.label, onSelect: () => handleShrinkPickAction(a.id) }))}
            onCancel={() => setMode(null)}
          />
        )
      })()}

      {/* Aurore : l'humain (qui a joué la Fatalité) choisit où poser le Héros révélé. */}
      {state.pendingHeroPlacement && state.pendingHeroPlacement.chooserIndex === HUMAN && (
        <HeroPlacementModal
          hero={state.pendingHeroPlacement.hero}
          target={state.players[state.pendingHeroPlacement.targetIndex]}
          validLocations={heroPlacementLocations(
            state,
            state.pendingHeroPlacement.hero,
            state.pendingHeroPlacement.targetIndex,
          )}
          onPlace={resolveHeroPlacement}
        />
      )}

      {/* Vidéo de surveillance / Carte : l'humain (qui pose la Fatalité) choisit le lieu. */}
      {state.pendingFateObjectPlace && state.pendingFateObjectPlace.chooserIndex === HUMAN && (
        <FateObjectPlaceModal
          card={state.pendingFateObjectPlace.card}
          target={state.players[state.pendingFateObjectPlace.targetIndex]}
          onPlace={resolveFateObjectPlace}
        />
      )}

      {/* Roi Stéphane : l'humain (qui a joué la Fatalité) peut déplacer le pion adverse. */}
      {state.pendingPawnMove && state.pendingPawnMove.chooserIndex === HUMAN && (
        <PawnMoveModal
          target={state.players[state.pendingPawnMove.targetIndex]}
          onMove={resolvePawnMove}
        />
      )}

      {/* Roi Hubert : l'humain choisit un Allié par lieu voisin à attirer. */}
      {state.pendingHubertPull && state.pendingHubertPull.chooserIndex === HUMAN && (
        <HubertPullModal
          target={state.players[state.pendingHubertPull.targetIndex]}
          dest={state.pendingHubertPull.dest}
          adjacent={adjacentLocationIds(state, state.pendingHubertPull.dest)}
          onConfirm={resolveHubertPull}
        />
      )}

      {/* Retourne-toi : l'humain voit la dernière carte de sa pioche et choisit. */}
      {state.pendingDeckPeek && state.pendingDeckPeek.playerIndex === HUMAN && (
        <DeckPeekModal
          card={state.pendingDeckPeek.card}
          onKeep={() => resolveDeckPeek(true)}
          onReshuffle={() => resolveDeckPeek(false)}
        />
      )}

      {/* Tombée de la nuit : l'humain choisit Événement ou Objet. */}
      {state.pendingTypeChoice && state.pendingTypeChoice.playerIndex === HUMAN && (
        <TypeChoiceModal
          types={state.pendingTypeChoice.types}
          untilFound={state.pendingTypeChoice.untilFound}
          onChoose={resolveTypeChoice}
        />
      )}

      {/* Apparition / Vent de panique : l'humain (chooser) déplace un Héros. */}
      {state.pendingHeroRelocate && state.pendingHeroRelocate.chooserIndex === HUMAN && (
        <HeroRelocateModal
          target={state.players[state.pendingHeroRelocate.targetIndex]}
          anyLocation={state.pendingHeroRelocate.anyLocation}
          candidateIds={state.pendingHeroRelocate.candidateIds}
          forcedDirection={state.pendingHeroRelocate.forcedDirection}
          optional={state.pendingHeroRelocate.optional}
          onResolve={resolveHeroRelocate}
          onSkip={skipHeroRelocate}
        />
      )}

      {/* Téléportation : l'humain choisit le lieu où se téléporter. */}
      {state.pendingTeleport && state.pendingTeleport.playerIndex === HUMAN && (
        <TeleportModal player={state.players[HUMAN]} onResolve={resolveTeleport} />
      )}

      {/* Musique (tour de Slenderman) + modale Options. Coupée pendant l'animation/
          écran de fin (réel ou test) pour ne pas couvrir le jingle de victoire/défaite. */}
      <MusicPlayer enabled={startRollDone && !endActive} />
      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}

      {/* Coup Royal : révélation des 5 cartes + verdict. */}
      {state.pendingRoyalCroquet && state.pendingRoyalCroquet.playerIndex === HUMAN && (
        <RoyalCroquetModal
          revealed={state.pendingRoyalCroquet.revealed}
          wicketStrength={state.pendingRoyalCroquet.wicketStrength}
          costSum={state.pendingRoyalCroquet.costSum}
          won={state.pendingRoyalCroquet.won}
          onClose={dismissRoyalCroquet}
        />
      )}

      {/* Manipulation : choisir une carte de SA défausse à reprendre en main. */}
      {state.pendingManipulation && state.pendingManipulation.playerIndex === HUMAN && (
        <CardChoiceModal
          title="Manipulation : reprends une carte de ta défausse"
          cards={user.discard}
          onClose={() => {
            // Choix obligatoire : à défaut, on reprend la dernière défaussée.
            const last = user.discard[user.discard.length - 1]
            if (last) resolveManipulation(last.instanceId)
          }}
          onPick={(card) => resolveManipulation(card.instanceId)}
        />
      )}

      {/* Par ordre de la Reine ! : transformer 1 ou 2 Cartes Gardes en arceaux. */}
      {state.pendingTransformWickets && state.pendingTransformWickets.playerIndex === HUMAN && (
        <TransformWicketsModal
          guards={transformableGuards(state, HUMAN)}
          max={state.pendingTransformWickets.max}
          onConfirm={(ids) => resolveTransformWickets(ids)}
        />
      )}

      {/* Faites-leur peur ! : trier les 2 premières cartes Fatalité. */}
      {state.pendingScry && state.pendingScry.playerIndex === HUMAN && (
        <ScryModal cards={state.pendingScry.cards} onResolve={(ids) => resolveScry(ids)} />
      )}

      {/* Magie noire (La Méchante Reine) : choisir un Objet/Ingrédient à reprendre,
          via deux onglets Pioche / Défausse. */}
      {state.pendingRecover && state.pendingRecover.playerIndex === HUMAN && state.pendingRecover.label === 'Magie noire' && (() => {
        const ids = new Set(state.pendingRecover.candidateIds)
        return (
          <BlackMagicModal
            deckCards={user.deck.filter((c) => ids.has(c.instanceId))}
            discardCards={user.discard.filter((c) => ids.has(c.instanceId))}
            onPick={(instanceId) => resolveRecover(instanceId)}
          />
        )
      })()}

      {/* Opportunisme / Tâche : Téléchargement : reprendre une carte de la défausse. */}
      {state.pendingRecover && state.pendingRecover.playerIndex === HUMAN && state.pendingRecover.label !== 'Magie noire' && (() => {
        const ids = new Set(state.pendingRecover.candidateIds)
        const cards = [...user.discard, ...user.deck].filter((c) => ids.has(c.instanceId))
        const title =
          state.pendingRecover.label === 'Tâche : Téléchargement'
            ? 'Téléchargement : reprends une carte de ta défausse'
            : 'Opportunisme : reprends un Objet ou un Événement'
        return (
          <CardChoiceModal
            title={title}
            cards={cards}
            onClose={() => cards[0] && resolveRecover(cards[0].instanceId)}
            onPick={(card) => resolveRecover(card.instanceId)}
          />
        )
      })()}

      {/* Colère Titanesque : choisir un lieu voisin où agir. */}
      {state.pendingGiantAction && state.pendingGiantAction.playerIndex === HUMAN && (
        <GiantActionModal
          player={user}
          onResolve={(loc) => resolveGiantLocation(loc)}
          title={state.pendingGiantAction.viaCanne ? 'Canne — lieu voisin' : undefined}
          subtitle={
            state.pendingGiantAction.viaCanne
              ? 'Choisissez un lieu voisin : vous y effectuerez une action disponible (hors Fatalité).'
              : undefined
          }
        />
      )}

      {/* Préparez-vous au combat ! (Hadès) : choisir un Titan et sa destination. */}
      {state.pendingTitanMove && state.pendingTitanMove.playerIndex === HUMAN && (
        <TitanMoveModal
          player={user}
          candidateIds={state.pendingTitanMove.titanCandidateIds}
          paid={state.pendingTitanMove.paid}
          maxSteps={state.pendingTitanMove.maxSteps}
          onResolve={resolveTitanMove}
        />
      )}

      {/* Héra / Pégase (Fatalité) : le joueur qui pose la Fatalité choisit un Titan. */}
      {state.pendingTitanSelect && state.pendingTitanSelect.chooserIndex === HUMAN && (
        <TitanSelectModal
          owner={state.players[state.pendingTitanSelect.playerIndex]}
          candidateIds={state.pendingTitanSelect.titanCandidateIds}
          kind={state.pendingTitanSelect.kind}
          onResolve={resolveTitanSelect}
        />
      )}

      {/* Divination (Dr Facilier) : résoudre les cartes révélées de l'Au-delà. */}
      {state.pendingDivination && state.pendingDivination.playerIndex === HUMAN && (
        <DivinationModal
          cards={state.pendingDivination.cards}
          onResolve={resolveDivination}
        />
      )}

      {/* Tour de passe-passe (Dr Facilier) : choisir la carte à garder. */}
      {state.pendingLookTop && state.pendingLookTop.playerIndex === HUMAN && (
        <LookTopModal
          cards={state.pendingLookTop.cards}
          take={state.pendingLookTop.take}
          title={state.pendingLookTop.title}
          onResolve={resolveLookTop}
        />
      )}

      {/* Foudre (La Méchante Reine) : choisir l'Ingrédient à reproduire. */}
      {state.pendingDuplicateIngredient && state.pendingDuplicateIngredient.playerIndex === HUMAN && (() => {
        const ids = new Set(state.pendingDuplicateIngredient.candidateIds)
        const cards = (user.ingredients ?? []).filter((c) => ids.has(c.instanceId))
        return (
          <CardChoiceModal
            title="Foudre : choisis l'Ingrédient à reproduire"
            cards={cards}
            onClose={cancelDuplicateIngredient}
            onPick={(card) => resolveDuplicateIngredient(card.instanceId)}
          />
        )
      })()}

      {/* Hurlement d'effroi (La Méchante Reine) : choisir le déplacement de Héros. */}
      {state.pendingScream && state.pendingScream.playerIndex === HUMAN && (() => {
        const locName = (id: string) => user.locations.find((l) => l.id === id)?.name ?? id
        // Regroupe par lieu source pour un affichage clair.
        const fromIds = [...new Set(state.pendingScream.options.map((o) => o.from))]
        return createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
            <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-fuchsia-400/30 bg-[#160a18] p-5 text-white">
              <h2 className="text-lg font-black text-fuchsia-200">Hurlement d'effroi</h2>
              <p className="text-sm text-white/70">
                Déplace les Héros de force ≤ 3 d'un lieu vers un lieu voisin non bloqué.
              </p>
              <div className="flex flex-col gap-2">
                {fromIds.map((fid) => (
                  <div key={fid} className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="mb-1 text-xs font-semibold text-fuchsia-200">Depuis {locName(fid)} →</div>
                    <div className="flex flex-wrap gap-2">
                      {state.pendingScream!.options
                        .filter((o) => o.from === fid)
                        .map((o) => (
                          <button
                            key={o.to}
                            type="button"
                            onClick={() => resolveScream(o.from, o.to)}
                            className="rounded-lg border border-fuchsia-400/50 px-3 py-1 text-sm text-fuchsia-100 hover:bg-fuchsia-500/20"
                          >
                            {locName(o.to)}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => resolveScream()}
                className="self-end rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
              >
                Ne rien déplacer
              </button>
            </div>
          </div>,
          document.body,
        )
      })()}

      {/* « Croque ! » (La Méchante Reine) : choisir le Héros à éliminer. */}
      {state.pendingTakeABite && state.pendingTakeABite.playerIndex === HUMAN && (
        <TakeABiteModal
          candidates={state.pendingTakeABite.candidateIds
            .map((id) => Object.values(user.board).flat().find((c) => c.instanceId === id))
            .filter((c): c is CardInstance => !!c)}
          forceOf={(id) => effectiveStrength(state, HUMAN, id) ?? 0}
          poison={user.poison ?? 0}
          onResolve={resolveTakeABite}
        />
      )}

      {/* Si près du but / Charlotte : le joueur qui a posé la Fatalité trie les cartes. */}
      {state.pendingFateScry && state.pendingFateScry.chooserIndex === HUMAN && (
        <FateScryModal
          targetName={state.players[state.pendingFateScry.targetIndex].villainName}
          cards={state.pendingFateScry.cards}
          onResolve={resolveFateScry}
        />
      )}

      {/* Carte du Pays Imaginaire : défausser pour jouer un Objet gratuitement. */}
      {mapModalOpen && (
        <NeverlandMapModal
          player={user}
          onResolve={(itemInstanceId, to, attachTo) => {
            playNeverlandMap(itemInstanceId, to, attachTo)
            setMapModalOpen(false)
          }}
          onCancel={() => setMapModalOpen(false)}
        />
      )}

      {/* Digne Adversaire / Obsession : jouer (où) ou défausser le Héros dévoilé. */}
      {state.pendingFetchedHero && state.pendingFetchedHero.playerIndex === HUMAN && (
        <FetchedHeroModal
          player={user}
          hero={state.pendingFetchedHero.hero}
          discarded={state.pendingFetchedHero.discarded}
          onResolve={(play, to) => resolveFetchedHero(play, to)}
        />
      )}

      {/* Vol du château : cartes dévoilées + carte à jouer (affiché des DEUX côtés),
          puis le joueur qui l'a jouée choisit le lieu. */}
      {state.pendingCastleTheft && (
        <CastleTheftModal
          player={state.players[state.pendingCastleTheft.playerIndex]}
          found={state.pendingCastleTheft.found}
          revealed={state.pendingCastleTheft.revealed}
          toHand={state.pendingCastleTheft.toHand}
          interactive={state.pendingCastleTheft.playerIndex === HUMAN}
          onResolve={(to) => resolveCastleTheft(to)}
        />
      )}

      {/* Abu/Aladdin (voler un Objet) / K.O. (retirer un Allié) : choix parmi les candidats. */}
      {state.pendingFateChoice && state.pendingFateChoice.chooserIndex === HUMAN && (() => {
        const pfc = state.pendingFateChoice
        const tgt = state.players[pfc.targetIndex]
        const pool = [...Object.values(tgt.board).flat(), ...tgt.hand, ...tgt.fateDiscard]
        const cards = pfc.candidateIds
          .map((id) => pool.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        const title =
          pfc.kind === 'remove-ally'
            ? 'K.O. : retirez un Allié (force ≤ 3)'
            : pfc.kind === 'remove-item'
              ? 'Migraine Atroce : défaussez un Objet'
              : pfc.kind === 'discard-from-hand'
                ? `Animaux de la forêt : main de ${tgt.villainName} — défaussez une carte`
                : pfc.kind === 'fate-discard-hero-to-top'
                  ? `Premier baiser d'amour : un Héros revient sur le dessus de la Fatalité de ${tgt.villainName}`
                  : 'Volez un Objet à associer au Héros'
        return (
          <CardChoiceModal
            title={title}
            cards={cards}
            onClose={() => cards[0] && resolveFateChoice(cards[0].instanceId)}
            onPick={(card) => resolveFateChoice(card.instanceId)}
          />
        )
      })()}

      {/* Pas de Quartier ! : choisir l'Allié à déplacer puis sa destination. */}
      {state.pendingAllyMoveBuff && state.pendingAllyMoveBuff.playerIndex === HUMAN && (
        <AllyMoveBuffModal
          player={user}
          amount={state.pendingAllyMoveBuff.amount}
          label={state.pendingAllyMoveBuff.label}
          optional={state.pendingAllyMoveBuff.optional}
          onResolve={(instanceId, to) => resolveAllyMoveBuff(instanceId, to)}
          onSkip={() => skipAllyMoveBuff()}
        />
      )}

      {/* Iago : choix de l'Objet à emmener (plusieurs Objets sur son lieu). */}
      {iagoItemPick && (
        <CardChoiceModal
          title="Iago : quel objet emmener ?"
          cards={(user.board[iagoItemPick.from] ?? []).filter((c) => c.type === 'item' && !c.attachedTo)}
          noneLabel="Iago seul (aucun objet)"
          onClose={() => setIagoItemPick(null)}
          onNone={() => {
            setMode({
              kind: 'activate-iago-dest',
              actionId: iagoItemPick.actionId,
              cardInstanceId: iagoItemPick.cardInstanceId,
              from: iagoItemPick.from,
            })
            setIagoItemPick(null)
          }}
          onPick={(item) => {
            setMode({
              kind: 'activate-iago-dest',
              actionId: iagoItemPick.actionId,
              cardInstanceId: iagoItemPick.cardInstanceId,
              from: iagoItemPick.from,
              itemInstanceId: item.instanceId,
            })
            setIagoItemPick(null)
          }}
        />
      )}

      {/* Choix de la carte à activer (plusieurs candidates). */}
      {activatePick && (
        <ActivatePickModal
          cards={activatableCards(state)}
          onClose={() => setActivatePick(null)}
          onPick={(card) => {
            const actionId = activatePick.actionId
            setActivatePick(null)
            startActivate(actionId, card)
          }}
        />
      )}

      {/* Jet de dé de début de partie : qui commence (plus haut score). */}
      {!startRollDone && gameMode === 'solo' && (
        <StartRollModal
          names={[state.players[HUMAN].villainName, state.players[BOT].villainName]}
          images={[
            villainPresentation(villainKeyOf(state.players[HUMAN].villain)),
            villainPresentation(villainKeyOf(state.players[BOT].villain)),
          ]}
          villainKeys={[
            villainKeyOf(state.players[HUMAN].villain),
            villainKeyOf(state.players[BOT].villain),
          ]}
          voiceDone={introVoiceDone}
          boardRefs={[userBoardRef, botBoardRef]}
          onResult={(winner, rolls) => {
            setStartingPlayer(winner, rolls)
            setStartRollDone(true)
          }}
        />
      )}

      {/* Réseau : présentation « versus » (sans jet de dé) du point de vue local. */}
      {!startRollDone && gameMode !== 'solo' && (
        <StartRollModal
          versusOnly
          names={[state.players[HUMAN].villainName, state.players[BOT].villainName]}
          images={[
            villainPresentation(villainKeyOf(state.players[HUMAN].villain)),
            villainPresentation(villainKeyOf(state.players[BOT].villain)),
          ]}
          onDone={() => setStartRollDone(true)}
        />
      )}

      {/* Affiche « À vous de jouer » au début du tour du joueur (key = tour → l'anim
          redémarre à chaque tour). */}
      {showTurnSplash && (
        <TurnSplash key={state.turn} villainName={user.villainName} image={villainPresentation(villainKeyOf(state.players[HUMAN].villain))} />
      )}

      {/* Confirmation avant de quitter la partie (solo ou réseau). */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/15 bg-[#140d24] p-6 text-center">
            <h2 className="text-lg font-bold text-amber-200">Quitter la partie ?</h2>
            <p className="text-sm text-white/70">
              {gameMode !== 'solo'
                ? 'L’autre joueur sera prévenu et renvoyé à l’accueil.'
                : 'La partie en cours sera abandonnée et vous reviendrez au menu principal.'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowQuitConfirm(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { setShowQuitConfirm(false); if (gameMode !== 'solo') quitNet(); onExit?.() }}
                className="rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/30"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* La Méchante Reine — « Préparer du Poison » : choisir combien de Pouvoir
          convertir en Poison (1 → max). Timide ajoute 1 Pouvoir perdu. */}
      {brewPick && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/15 bg-[#140d24] p-6 text-center">
            <h2 className="text-lg font-bold text-fuchsia-200">Préparer du Poison</h2>
            <p className="text-sm text-white/70">
              Convertis tes jetons Pouvoir en jetons Poison (1 pour 1).
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setBrewPick((b) => (b ? { ...b, count: Math.max(1, b.count - 1) } : b))}
                disabled={brewPick.count <= 1}
                className="h-10 w-10 rounded-full border border-white/20 text-xl font-bold text-white/80 hover:bg-white/10 disabled:opacity-30"
              >
                −
              </button>
              <div className="flex min-w-[9rem] items-center justify-center gap-1.5 text-lg font-bold">
                <span className="flex items-center gap-1 text-amber-100">
                  <img src="/jeton_pouvoir.png" alt="" className="h-6 w-6 rounded-full" />
                  {brewPick.count}
                </span>
                <span className="px-1 text-white/50">→</span>
                <span className="text-fuchsia-200">🧪 {brewPick.count}</span>
              </div>
              <button
                type="button"
                onClick={() => setBrewPick((b) => (b ? { ...b, count: Math.min(b.max, b.count + 1) } : b))}
                disabled={brewPick.count >= brewPick.max}
                className="h-10 w-10 rounded-full border border-white/20 text-xl font-bold text-white/80 hover:bg-white/10 disabled:opacity-30"
              >
                +
              </button>
            </div>
            {brewPick.surcharge > 0 && (
              <p className="text-xs text-rose-300">
                Timide : utiliser cette action coûte 1 Pouvoir de plus (perdu).
                Total dépensé : {brewPick.count + brewPick.surcharge} Pouvoir.
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setBrewPick(null)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { handleAction(brewPick.actionId, brewPick.count); setBrewPick(null) }}
                className="rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30"
              >
                Préparer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RÉSEAU : l'adversaire prépare une Condition → on bloque le joueur actif. */}
      {peerReacting && !netLeftNotice && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-400/40 bg-[#140d24]/90 px-8 py-6 text-center">
            <span className="text-3xl">⏳</span>
            <p className="text-lg font-bold text-amber-200">{peerReacting} joue une condition !</p>
            <p className="text-sm text-white/60">Patiente le temps qu’il la résolve…</p>
          </div>
        </div>
      )}

      {/* RÉSEAU : l'autre joueur a quitté / la connexion est perdue. */}
      {netLeftNotice && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/15 bg-[#140d24] p-6 text-center">
            <h2 className="text-lg font-bold text-amber-200">Partie interrompue</h2>
            <p className="text-sm text-white/70">{netLeftNotice}</p>
            <button
              type="button"
              onClick={() => { leaveNet(); onExit?.() }}
              className="mx-auto rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Retour à l’accueil
            </button>
          </div>
        </div>
      )}

      {/* L'Imposteur — Corps découvert : bandeau « DEAD BODY REPORTED » fugace. */}
      {showDeadBody && (
        <div
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/80"
          style={{ animation: 'versusFadeIn 0.25s ease-out both' }}
        >
          <img
            src="/dead-body-reported.png"
            alt="Dead body reported"
            className="max-h-[100%] max-w-[100%] object-contain drop-shadow-[0_0_40px_rgba(255,0,0,0.7)]"
          />
        </div>
      )}

      {/* L'Imposteur — Réunion d'urgence : bandeau « EMERGENCY MEETING » PLEINE LARGEUR. */}
      {showEmergency && (
        <div
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/80"
          style={{ animation: 'versusFadeIn 0.25s ease-out both' }}
        >
          <img
            src="/emergency-meeting.png"
            alt="Emergency meeting"
            className="max-h-[55%] max-w-[70%] object-contain drop-shadow-[0_0_40px_rgba(255,0,0,0.7)]"
          />
        </div>
      )}

      {/* Tâche visuelle (humain qui joue la Fatalité) : bandeau de fin de sélection. */}
      {state.pendingCrewmateSuspect && state.pendingCrewmateSuspect.chooserIndex === HUMAN && (
        <div className="fixed inset-x-0 bottom-4 z-[75] flex justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/60 bg-[#120c22]/95 px-4 py-2 text-sm text-amber-100 shadow-lg backdrop-blur-sm">
            Tâche visuelle : clique les Coéquipiers à rendre suspects ({state.pendingCrewmateSuspect.remaining} restant
            {state.pendingCrewmateSuspect.remaining > 1 ? 's' : ''}).
            <button
              type="button"
              onClick={() => doneCrewmateSuspect()}
              className="rounded-lg border border-white/25 px-3 py-1 font-semibold text-white hover:bg-white/10"
            >
              Terminer
            </button>
          </div>
        </div>
      )}

      {/* Assurance / Course (humain) : déplacement optionnel du Coéquipier — prompt
          CENTRÉ et bien visible (sinon masqué par la main en bas). */}
      {state.pendingCrewmateMove && state.pendingCrewmateMove.playerIndex === HUMAN && (
        <div className="fixed inset-0 z-[78] flex items-start justify-center bg-black/40 pt-24">
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-amber-400/80 bg-[#120c22]/95 px-5 py-3 text-base text-amber-100 shadow-2xl backdrop-blur-sm">
            <span>Déplacer le Coéquipier {state.pendingCrewmateMove.color} vers</span>
            {state.pendingCrewmateMove.eligibleLocs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => resolveCrewmateMove(id)}
                className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-1 font-semibold text-white hover:bg-amber-400/30"
              >
                {user.locations.find((l) => l.id === id)?.name ?? id}
              </button>
            ))}
            <button
              type="button"
              onClick={() => doneCrewmateMove()}
              className="rounded-lg border border-white/25 px-3 py-1 font-semibold text-white hover:bg-white/10"
            >
              Ne pas déplacer
            </button>
          </div>
        </div>
      )}

      {/* MODE TEST : liste déroulante d'insertion de cartes sur un lieu. */}
      {testPicker && (
        <CardPicker
          villain={currentVillains[testPicker.playerIndex]}
          x={testPicker.x}
          y={testPicker.y}
          locationName={
            state.players[testPicker.playerIndex].locations.find((l) => l.id === testPicker.locationId)?.name ??
            testPicker.locationId
          }
          onPick={(cardId) => testInsertCard(testPicker.playerIndex, testPicker.locationId, cardId)}
          onClose={() => setTestPicker(null)}
        />
      )}

      {/* Cartes en vol (pose main → plateau). Décoratif. */}
      <CardFlights flights={flights} onDone={removeFlight} />

      {/* Gains de pouvoir flottants (« +N 🪙 »). Décoratif. */}
      <FloatingGains gains={gains} onDone={removeGain} />

      {/* Showcase : carte affichée en grand pour Événements/Conditions/Fatalité. */}
      <Showcase
        events={state.showcaseEvents}
        humanIndex={HUMAN}
        players={state.players}
        onHiddenIdsChange={setShowcaseHiddenIds}
        onCardLanded={handleCardLanded}
        onBusyChange={setShowcaseBusy}
      />

      {/* Fin de partie : écran Victoire/Défaite (après l'éclat du plateau perdant). */}
      {won && winnerKey && loserKey && !watchBoard && endShatterDone && (
        <VictoryModal
          winnerKey={winnerKey}
          loserKey={loserKey}
          humanWon={winnerIndex === HUMAN}
          onWatch={() => { stopVictoryBuildup(); setWatchBoard(true) }}
          onReplay={replaySameVillains}
          onHome={() => { stopVictoryBuildup(); onExit?.() }}
          canReplay={gameMode === 'solo'}
        />
      )}

      {/* MODE TEST : aperçu d'un écran de fin (les trois boutons ferment l'aperçu). */}
      {testMode && victoryPreview && (
        <VictoryModal
          winnerKey={victoryPreview.winnerKey}
          loserKey={victoryPreview.loserKey}
          humanWon={victoryPreview.humanWon}
          onWatch={() => { stopVictoryBuildup(); setVictoryPreview(null) }}
          onReplay={() => { stopVictoryBuildup(); setVictoryPreview(null) }}
          onHome={() => { stopVictoryBuildup(); setVictoryPreview(null) }}
          canReplay={false}
        />
      )}

      {/* Mode « Regarder le plateau » : le plateau reste inactif ; les deux autres
          choix de fin de partie restent accessibles en haut à droite. */}
      {won && watchBoard && (
        <div className="fixed right-4 top-4 z-[78] flex items-center gap-2 rounded-xl border border-white/15 bg-[#120c22]/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <span className="px-1 text-sm font-bold text-amber-200">
            {state.winner === HUMAN ? '🏆 Victoire' : '💀 Défaite'}
          </span>
          {gameMode === 'solo' && (
            <button
              type="button"
              onClick={replaySameVillains}
              className="rounded-lg border border-amber-400/60 bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-100 hover:bg-amber-400/30"
            >
              🔁 Rejouer
            </button>
          )}
          <button
            type="button"
            onClick={() => onExit?.()}
            className="rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            🏠 Accueil
          </button>
        </div>
      )}
    </div>
  )
}
