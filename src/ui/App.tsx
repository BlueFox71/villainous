import { useEffect, useRef, useState } from 'react'
import { BOTS, useGameStore, villainKeyOf, VILLAIN_REGISTRY, type VillainKey } from './store/gameStore'
import { useStatsStore } from './store/statsStore'
import { getCardDef } from '../data/registry'
import {
  activatableCards,
  adjacentLocationIds,
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
  playableConditions,
  sacrificeableCards,
  teleportTargets,
  transformableGuards,
} from '../engine/rules'
import type { CardInstance, LocationAction, ShowcaseEvent } from '../engine/types'
import { BLUE, RED } from './accents'
import { PlayerPanel } from './components/PlayerPanel'
import { Board } from './components/Board'
import { Hand } from './components/Hand'
import { GameLog } from './components/GameLog'
import { BoardImage, LOCATIONS_LEFT } from './components/BoardImage'
import { BoardActions } from './components/BoardActions'
import { HeroRow } from './components/HeroRow'
import { DeckPiles } from './components/DeckPiles'
import { FateModal } from './components/FateModal'
import { ChoiceModal } from './components/ChoiceModal'
import { HeroPlacementModal } from './components/HeroPlacementModal'
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
import { StartRollModal } from './components/StartRollModal'
import { MusicPlayer } from './components/MusicPlayer'
import { Showcase } from './components/Showcase'
import { TestFateBar } from './components/TestFateBar'
import { TestChecklist } from './components/TestChecklist'
import { CardPicker } from './components/CardPicker'
import { CardFlights, type CardFlight, type FlightRect } from './components/CardFlights'
import { Scroller } from './components/Scroller'
import { FloatingGains, type FloatingGain } from './components/FloatingGains'

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
  | null

const BOT_STEP_MS = 700
const HUMAN = 0
const BOT = 1

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
  const resolveTyrannyDiscard = useGameStore((s) => s.resolveTyrannyDiscard)
  const resolveHeroPlacement = useGameStore((s) => s.resolveHeroPlacement)
  const resolvePawnMove = useGameStore((s) => s.resolvePawnMove)
  const resolveHubertPull = useGameStore((s) => s.resolveHubertPull)
  const resolveDeckPeek = useGameStore((s) => s.resolveDeckPeek)
  const resolveTypeChoice = useGameStore((s) => s.resolveTypeChoice)
  const resolveHeroRelocate = useGameStore((s) => s.resolveHeroRelocate)
  const resolveTeleport = useGameStore((s) => s.resolveTeleport)
  const resolveManipulation = useGameStore((s) => s.resolveManipulation)
  const dismissRoyalCroquet = useGameStore((s) => s.dismissRoyalCroquet)
  const resolveTransformWickets = useGameStore((s) => s.resolveTransformWickets)
  const endTurn = useGameStore((s) => s.endTurn)
  const reset = useGameStore((s) => s.reset)
  const botAct = useGameStore((s) => s.botAct)
  const botReact = useGameStore((s) => s.botReact)
  const testMode = useGameStore((s) => s.testMode)
  const enterTestMode = useGameStore((s) => s.enterTestMode)
  const testInsertCard = useGameStore((s) => s.testInsertCard)
  const testPlaceFate = useGameStore((s) => s.testPlaceFate)
  const testPlayCondition = useGameStore((s) => s.testPlayCondition)
  const testAddToHand = useGameStore((s) => s.testAddToHand)
  const testPlayFateCard = useGameStore((s) => s.testPlayFateCard)
  const testShowcase = useGameStore((s) => s.testShowcase)
  const testRefreshTurn = useGameStore((s) => s.testRefreshTurn)

  // --- Statistiques de profil (par vilain humain) -------------------------
  // Le joueur humain est toujours le joueur 0 (cf. BOTS = [false, true]).
  const recordResult = useStatsStore((s) => s.recordResult)
  const recordGame = useStatsStore((s) => s.recordGame)
  const addPlaytime = useStatsStore((s) => s.addPlaytime)
  const humanVillainKey = villainKeyOf(state.players[0].villain)
  const opponentVillainKey = villainKeyOf(state.players[1].villain)

  // Temps de jeu : on mémorise l'instant d'entrée et on verse la durée écoulée
  // au démontage (retour au menu / fermeture). Un ref suit le vilain courant
  // pour créditer le bon compteur même si la partie change.
  const playStartRef = useRef(Date.now())
  const villainKeyRef = useRef(humanVillainKey)
  villainKeyRef.current = humanVillainKey
  useEffect(() => {
    return () => {
      addPlaytime(villainKeyRef.current, Date.now() - playStartRef.current)
    }
  }, [addPlaytime])

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
  const [showOptions, setShowOptions] = useState(false)
  // Jet de dé de début de partie (qui commence). Sauté en mode test.
  const [startRollDone, setStartRollDone] = useState(testMode)
  // Choix de la carte à activer quand plusieurs sont activables (action « Activer »).
  const [activatePick, setActivatePick] = useState<{ actionId: string } | null>(null)
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
      if (e.kind === 'robin-steal') {
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
      }
    }
    fxShown.current = fx.length
  }, [state.floatingFx, state.players])

  const isBotTurn = state.status === 'PLAYING' && BOTS[state.activePlayer]
  const isHumanTurn = state.status === 'PLAYING' && state.activePlayer === HUMAN

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
  // Un Objet « à associer » est jouable s'il existe au moins un Allié quelque part
  // (on peut le poser sur n'importe quel lieu, donc sur celui qui porte l'Allié).
  // Un Héros hypnotisé compte comme un Allié (porteur d'Objet valide).
  const anyAllyOnBoard =
    isHumanTurn &&
    Object.values(user.board).some((cards) =>
      cards.some((c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized)),
    )
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
      if (BOTS[pdp.playerIndex]) {
        const timer = setTimeout(() => resolveDeckPeek(true), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Tombée de la nuit : choix Événement/Objet. Bot → type présent dans les
    // cartes du dessus (priorité Objet = Pages) ; humain → modale.
    const ptc = state.pendingTypeChoice
    if (ptc) {
      if (BOTS[ptc.playerIndex]) {
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
      if (BOTS[pman.playerIndex]) {
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
      if (BOTS[ptw.playerIndex]) {
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
    // Coup Royal raté du bot : on ferme la fenêtre pour qu'il poursuive son tour.
    const prc = state.pendingRoyalCroquet
    if (prc) {
      if (BOTS[prc.playerIndex]) {
        const timer = setTimeout(() => dismissRoyalCroquet(), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Téléportation : déplacer le pion sur un lieu portant un Héros. Bot →
    // 1ᵉʳ lieu cible ; humain → modale.
    const pt = state.pendingTeleport
    if (pt) {
      if (BOTS[pt.playerIndex]) {
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
      if (BOTS[phr.chooserIndex]) {
        const tgt = state.players[phr.targetIndex]
        const ids = tgt.locations.map((l) => l.id)
        for (const loc of tgt.locations) {
          const hero = (tgt.board[loc.id] ?? []).find((c) => c.type === 'hero')
          if (hero) {
            const i = ids.indexOf(loc.id)
            const to = ids[i - 1] ?? ids[i + 1]
            if (to) {
              const timer = setTimeout(() => resolveHeroRelocate(hero.instanceId, to), BOT_STEP_MS)
              return () => clearTimeout(timer)
            }
          }
        }
      }
      return
    }
    // Aurore : Héros révélé à placer. Le bot (s'il a joué la Fatalité) choisit
    // tout seul le 1ᵉʳ lieu valide ; si c'est l'humain, on attend la modale.
    const php = state.pendingHeroPlacement
    if (php) {
      if (BOTS[php.chooserIndex]) {
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
      if (BOTS[ppm.chooserIndex]) {
        const tgt = state.players[ppm.targetIndex]
        const cands = tgt.locations.filter((l) => l.id !== tgt.pawnLocation)
        const score = (loc: string) => (tgt.board[loc] ?? []).filter((c) => c.type === 'curse').length
        const dest = cands.length ? [...cands].sort((a, b) => score(b.id) - score(a.id))[0].id : null
        const timer = setTimeout(() => resolvePawnMove(dest), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Roi Hubert : attirer un Allié par lieu voisin. Bot (s'il a joué la
    // Fatalité) → 1ᵉʳ Allié de chaque lieu voisin ; humain → modale.
    const phl = state.pendingHubertPull
    if (phl) {
      if (BOTS[phl.chooserIndex]) {
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
      if (BOTS[ptd.playerIndex]) {
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
      const humanCanReact = playableConditions(state, HUMAN).length > 0 && !reactionPassed
      if (humanCanReact) return // pause : on attend que l'humain joue ou passe
      const timer = setTimeout(botAct, BOT_STEP_MS)
      return () => clearTimeout(timer)
    }
    // Tour humain : laisse le bot tenter une réaction (Avarice, Lâcheté).
    const timer = setTimeout(botReact, BOT_STEP_MS / 2)
    return () => clearTimeout(timer)
  }, [isBotTurn, startRollDone, state, botAct, botReact, reactionPassed, testMode, resolveTyrannyDiscard, resolveHeroPlacement, resolvePawnMove, resolveHubertPull, resolveDeckPeek, resolveTypeChoice, resolveHeroRelocate, resolveTeleport, resolveManipulation, dismissRoyalCroquet, resolveTransformWickets])

  // Coups légaux / actions : seulement pour le joueur humain et à son tour.
  const legalMoves = isHumanTurn ? getLegalMoves(state) : []
  const availableActions = isHumanTurn ? getAvailableActions(state) : []
  const canEnd = isHumanTurn && state.phase === 'ACTION'

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
  const handleReset = clearThen(reset)
  // Vilains des deux joueurs (déduits du state) pour pré-remplir le sélecteur.
  const currentVillains: [VillainKey, VillainKey] = [
    state.players[0]?.villain as VillainKey,
    state.players[1]?.villain as VillainKey,
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
  const handleShrinkPickAction = (freeActionId: string) => {
    if (mode?.kind !== 'shrink-pick-action') return
    doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, mode.heroInstanceId, undefined, undefined, freeActionId)
    setMode(null)
  }
  // ---- D : Réactions humaines (Conditions) ----
  const handlePlayReaction = (card: CardInstance) => {
    // Conditions à ciblage interactif : on passe par un mode de sélection.
    if (card.cardId === 'lachete' || card.cardId === 'ruse') {
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
    if (mode?.kind !== 'vanquish-pick-allies' || mode.selected.length === 0) return
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
            if (cardInPlay?.type === 'curse') return canPlaceCurseAt(state, HUMAN, id)
            // Limite d'exemplaires par lieu (Page : max 2 posées librement).
            if (cardInPlay?.maxAtLocation !== undefined) {
              const here = (user.board[id] ?? []).filter(
                (c) => c.cardId === cardInPlay.cardId && !c.attachedTo,
              ).length
              return here < cardInPlay.maxAtLocation
            }
            return true
          })
      : mode?.kind === 'move-dest' || mode?.kind === 'move-hero-dest' || mode?.kind === 'activate-iago-dest'
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
    mode?.kind === 'sacrifice-pick'
  // Règle officielle Vanquish : on peut viser N'IMPORTE QUEL Héros du royaume
  // (pas forcément sur le lieu du pion). Les alliés utilisés doivent être au
  // LIEU DU HÉROS choisi (Archers Loups : depuis un lieu voisin).
  const vanquishHeroTargets: string[] =
    mode?.kind === 'vanquish-pick-hero' ||
    mode?.kind === 'play-pick-hero' ||
    mode?.kind === 'condition-pick-hero' ||
    mode?.kind === 'move-hero-pick'
      ? (() => {
          const allHeroes = Object.values(user.board).flatMap((cards) =>
            cards.filter((c) => c.type === 'hero'),
          )
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
          const adjArchers = adjacentLocationIds(state, heroLoc).flatMap((adj) =>
            simulatedAt(adj).filter((c) => c.cardId === 'archers-loups' && !c.isWicket),
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
  const turnLabel = won
    ? `🏆 ${state.players[state.winner!].villainName} gagne !`
    : isBotTurn
      ? `${bot.villainName} joue…`
      : state.phase === 'MOVE'
        ? 'À toi : déplace ton pion sur un lieu différent (« Choisir »)'
        : 'À toi : agis, joue des cartes, puis finis ton tour'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0a12] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <h1 className="text-lg font-bold text-purple-200">Disney Villainous</h1>
        <p className="text-sm text-white/70">
          Tour {state.turn} · <span className={won ? 'text-amber-300' : 'text-white'}>{turnLabel}</span>
        </p>
        <div className="flex items-center gap-2 text-xs">
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
            🧪 Test
          </button>
          {testMode && (
            <button
              onClick={() => setHideTestBar((v) => !v)}
              title="Masquer/afficher le panneau de test (qui décale le layout réel)"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              {hideTestBar ? '👁 Panneau' : '🙈 Panneau'}
            </button>
          )}
          <button
            onClick={() => handleReset()}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Nouvelle partie
          </button>
          <button
            onClick={() => setShowOptions(true)}
            title="Options (musique, volume)"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            ⚙ Options
          </button>
          {onExit && (
            <button
              onClick={onExit}
              title="Revenir au menu principal"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              ☰ Menu
            </button>
          )}
        </div>
      </header>

      {/* 3 colonnes : toi (bleu) · journal · bot (rouge). Chacune scrolle en interne.
          En mode test, les deux camps restent visibles (édition live des plateaux). */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_15rem_1fr]">
        {/* ----- Colonne joueur (bleu) ----- */}
        <Scroller element="section" className="min-h-0">
          <div className="flex flex-col gap-2">
          <PlayerPanel player={user} accent={BLUE} isActive={state.activePlayer === HUMAN} isWinner={state.winner === HUMAN} />
          {/* Au-dessus de l'image : pioche/défausse FATALITÉ (marge gauche) + cases Héros. */}
          <div className="flex">
            <div className="flex items-end justify-center" style={{ width: `${LOCATIONS_LEFT}%` }}>
              <DeckPiles player={user} kind="fate" />
            </div>
            <div className="flex-1">
              <HeroRow
                player={user}
                strengths={userStrengths}
                vanquishTargets={vanquishHeroTargets}
                onVanquishPickHero={(id, name) => {
                  if (mode?.kind === 'play-pick-hero') handlePlayPickHero(id)
                  else if (mode?.kind === 'condition-pick-hero') handleConditionPickHero(id)
                  else if (mode?.kind === 'move-hero-pick') handleMoveHeroPick(id)
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
          {/* Plateau (image). Les deux joueurs sont le Prince Jean pour l'instant.
              Un Héros posé masque la rangée d'actions du haut de son lieu. */}
          <div className="relative">
            <BoardImage player={user} showPawn pawnOutline={BLUE.ringColor} imgClassName="border border-sky-900/60" hiddenHeroInstanceIds={showcaseHiddenIds} unmaskHeroLocationId={persifleurLoc} />
            <BoardActions
              player={user}
              availableActionIds={availableActions.map((a) => a.id)}
              usedActionIds={isHumanTurn ? state.usedActionIds : []}
              blinkTopAtLocation={persifleurLoc}
              onActionClick={handleBoardAction}
            />
          </div>
          {/* En dessous de l'image : pioche/défausse VILAIN (marge gauche) + cartes du méchant. */}
          <div className="flex">
            <div className="flex items-start justify-center" style={{ width: `${LOCATIONS_LEFT}%` }}>
              <DeckPiles player={user} kind="villain" playerIndex={HUMAN} />
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
              />
            </div>
          </div>
          {(mode?.kind === 'place' ||
            mode?.kind === 'attach' ||
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
            mode?.kind === 'sacrifice-pick') && (
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
                    <b>Lâcheté</b> : clique un <b>Allié</b> de ta main à poser gratuitement.
                  </>
                ) : mode.kind === 'condition-pick-place' ? (
                  <>
                    <b>Lâcheté</b> : pose <b>{mode.allyName}</b> sur un <b>lieu</b> (surligné).
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
                ) : (
                  <>
                    Éliminer <b>{mode.heroName}</b> (force {vanquishNeeded}) : coche les <b>Alliés</b> à utiliser. Total :{' '}
                    <b className={vanquishTotal >= vanquishNeeded ? 'text-emerald-300' : 'text-red-300'}>
                      {vanquishTotal}
                    </b>{' '}
                    / {vanquishNeeded}.
                  </>
                )}
              </span>
              <div className="flex items-center gap-2">
                {mode.kind === 'vanquish-pick-allies' && (
                  <button
                    onClick={handleVanquishConfirm}
                    disabled={vanquishSelected.length === 0 || vanquishTotal < vanquishNeeded}
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
                onShowcase={testShowcase}
                error={testFateError}
              />
            </>
          )}
          </div>
        </Scroller>

        {/* ----- Milieu : tour courant + fin de tour, puis journal ----- */}
        <aside className="flex min-h-0 flex-col gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-center gap-3 text-sm font-semibold">
              <span className={state.activePlayer === HUMAN && !won ? 'text-sky-300' : 'invisible'}>◀</span>
              <span className="truncate text-white">
                {won
                  ? `🏆 ${state.players[state.winner!].villainName}`
                  : state.players[state.activePlayer].villainName}
              </span>
              <span className={state.activePlayer === BOT && !won ? 'text-red-300' : 'invisible'}>▶</span>
            </div>
            <button
              type="button"
              onClick={testMode ? () => testRefreshTurn() : handleEndTurn}
              disabled={testMode ? false : !canEnd}
              title={testMode ? 'Mode test : nouveau tour — choisis le lieu de ton pion (phase déplacement), repioche, sans passer la main au bot' : undefined}
              className="hs-wrapper classique"
            >
              <span className="hs-button classique">
                <span className="hs-border classique">
                  <span className="hs-text classique">
                    {testMode ? 'Nouveau tour (test)' : 'Fin de tour'}
                  </span>
                </span>
              </span>
            </button>
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
          <div className="min-h-0 flex-1">
            <GameLog log={state.log} playerNames={state.players.map((p) => p.villainName)} />
          </div>
        </aside>

        {/* ----- Colonne bot (rouge) — lecture seule, main cachée. ----- */}
        <Scroller element="section" className="min-h-0">
          <div className="flex flex-col gap-2">
          <PlayerPanel player={bot} accent={RED} isActive={state.activePlayer === BOT} isWinner={state.winner === BOT} />
          <div className="flex">
            <div className="flex items-end justify-center" style={{ width: `${LOCATIONS_LEFT}%` }}>
              <DeckPiles player={bot} kind="fate" />
            </div>
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
          <div className="relative">
            <BoardImage player={bot} showPawn pawnOutline={RED.ringColor} imgClassName="border border-red-900/60" hiddenHeroInstanceIds={showcaseHiddenIds} />
          </div>
          <div className="flex">
            <div className="flex items-start justify-center" style={{ width: `${LOCATIONS_LEFT}%` }}>
              <DeckPiles player={bot} kind="villain" playerIndex={BOT} />
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
            selectedToDiscard={[]}
            onPlayCard={noop}
            onToggleDiscard={noop}
            onConfirmDiscard={noop}
            onCancel={noop}
          />
          </div>
          </div>
        </Scroller>
      </main>

      {/* ----- Main du joueur : éventail ancré en bas (style jeu de cartes en ligne). ----- */}
      <div
        data-hand-zone={HUMAN}
        className="relative z-20 shrink-0 border-t border-white/10 bg-gradient-to-t from-black/60 to-transparent"
      >
        <Hand
          hand={user.hand}
          accent={BLUE}
          hidden={false}
          backImage={user.backVillainImage}
          mode={handMode}
          power={user.power}
          attachTargetsAvailable={anyAllyOnBoard}
          blockEvents={humanEventsBlocked}
          costFor={(c) => effectiveCost(state, c)}
          armedConditionIds={humanReactions.map((c) => c.instanceId)}
          forcedHoverId={hoveredReactionId}
          selectedToDiscard={tyrannyDiscard ? tyrannyPicks : mode?.kind === 'discard' ? mode.selected : []}
          requiredDiscardCount={tyrannyDiscard ? tyrannyDiscard.count : undefined}
          layout="fan"
          onPlayCard={handlePlayCard}
          onToggleDiscard={handleToggleDiscard}
          onConfirmDiscard={handleConfirmDiscard}
          onCancel={() => setMode(null)}
        />
      </div>

      {/* Résolution de Fatalité par le joueur humain (le bot résout tout seul). */}
      {state.pendingFate && isHumanTurn && (
        <FateModal
          revealed={state.pendingFate.revealed}
          target={state.players[state.pendingFate.target]}
          onResolve={resolveFate}
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
          onResolve={resolveHeroRelocate}
        />
      )}

      {/* Téléportation : l'humain choisit le lieu où se téléporter. */}
      {state.pendingTeleport && state.pendingTeleport.playerIndex === HUMAN && (
        <TeleportModal player={state.players[HUMAN]} onResolve={resolveTeleport} />
      )}

      {/* Musique (tour de Slenderman) + modale Options. */}
      <MusicPlayer />
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
      {!startRollDone && (
        <StartRollModal
          names={[state.players[HUMAN].villainName, state.players[BOT].villainName]}
          onResult={(winner, rolls) => {
            setStartingPlayer(winner, rolls)
            setStartRollDone(true)
          }}
        />
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
      />
    </div>
  )
}
