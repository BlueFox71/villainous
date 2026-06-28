import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore, villainKeyOf, isCustomKey, VILLAIN_REGISTRY, type VillainKey } from './store/gameStore'
import { useTestWinStore } from './store/testWinStore'
import { usePlayerStore } from './store/playerStore'
import { useStatsStore } from './store/statsStore'
import { useIsDesktopApp } from './store/settingsStore'
import { getCardDef } from '../data/registry'
import {
  activatableCards,
  adjacentLocationIds,
  allyBlockedAt,
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
  lotsoReducibleHeroes,
  lotsoToRoomCandidates,
  lotsoHasHeroInRoom,
  maxBrewPoison,
  movableCards,
  dingoSwapOptions,
  playableConditions,
  realmRelocateCandidates,
  sacrificeableCards,
  teleportTargets,
  transformableGuards,
} from '../engine/rules'
import { titanReachableDests } from '../engine/effects'
import { FREE_PLAY_NO_ACTION_ID } from '../engine/actions'
import type { CardInstance, KeyColor, LocationAction, PendingDice, PlayerState, ShowcaseEvent } from '../engine/types'
import { BLUE, RED, accentVars } from './accents'
import { VILLAIN_COLOR, villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from './villainColors'
import { PlayerPanel } from './components/PlayerPanel'
import { Avatar, PlayerAvatar } from './components/PlayerAvatar'
import { Board } from './components/Board'
import { Hand } from './components/Hand'
import { GameLog } from './components/GameLog'
import { OpponentTurnRecap } from './components/OpponentTurnRecap'
import { BoardImage, LOCATIONS_LEFT, PAWN_FIRST_LEFT, PAWN_STEP } from './components/BoardImage'
import { BoardActions, getVillainActionPos } from './components/BoardActions'
import { SUGAR_RUSH_TRACK } from './components/sugarRushTrack'
import { HeroRow } from './components/HeroRow'
import { DeckPiles, AuDelaPile, IngredientsPile, SuccessionPile, ImpostorPile, CapturedPuppiesPile, ClaimedTreasuresPile, CauldronTile, MerlinPiles, MauiPiles, OmnidroidPile, DiscardModal } from './components/DeckPiles'
import { StacksCards } from './components/StacksCards'
import { GoalTilesRow } from './components/GoalTilesRow'
import { FateModal } from './components/FateModal'
import { ChoiceModal } from './components/ChoiceModal'
import { HeroPlacementModal } from './components/HeroPlacementModal'
import { FateObjectPlaceModal } from './components/FateObjectPlaceModal'
import { FateHeroPlaceModal } from './components/FateHeroPlaceModal'
import { PawnMoveModal } from './components/PawnMoveModal'
import { HubertPullModal } from './components/HubertPullModal'
import { DeckPeekModal } from './components/DeckPeekModal'
import { MauvaisCoupModal } from './components/MauvaisCoupModal'
import { SournoisModal } from './components/SournoisModal'
import { MoveAllyItemModal } from './components/MoveAllyItemModal'
import { BanditChainModal } from './components/BanditChainModal'
import { DingoModal } from './components/DingoModal'
import { TypeChoiceModal } from './components/TypeChoiceModal'
import { HeroRelocateModal } from './components/HeroRelocateModal'
import { AllyRelocateModal } from './components/AllyRelocateModal'
import { PokemonSummonModal } from './components/PokemonSummonModal'
import { FateDiscardAllyModal } from './components/FateDiscardAllyModal'
import { CapturePile } from './components/CapturePile'
import { IdentificationModal } from './components/IdentificationModal'
import { EtoileDuSoirModal } from './components/EtoileDuSoirModal'
import { SetThingsRightModal } from './components/SetThingsRightModal'
import { DiversionDiscardModal } from './components/DiversionDiscardModal'
import { UntrapTitansModal } from './components/UntrapTitansModal'
import { LotsoTargetModal } from './components/LotsoTargetModal'
import { LotsoBuzzMoveModal } from './components/LotsoBuzzMoveModal'
import { LotsoBookwormModal } from './components/LotsoBookwormModal'
import { MaximusModal } from './components/MaximusModal'
import { FateReorderModal } from './components/FateReorderModal'
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
import { HakunaMatataModal } from './components/HakunaMatataModal'
import { YzmaFateModal } from './components/YzmaFateModal'
import { YzmaHammerModal } from './components/YzmaHammerModal'
import { YzmaManipulateModal } from './components/YzmaManipulateModal'
import { BeautySleepModal } from './components/BeautySleepModal'
import { TitanMoveModal } from './components/TitanMoveModal'
import { DivinationModal } from './components/DivinationModal'
import { LookTopModal } from './components/LookTopModal'
import { RevealModal } from './components/RevealModal'
import { InformationModal } from './components/InformationModal'
import { TakeABiteModal } from './components/TakeABiteModal'
import { BlackMagicModal } from './components/BlackMagicModal'
import { FateScryModal } from './components/FateScryModal'
import { TitanSelectModal } from './components/TitanSelectModal'
import { StartRollModal } from './components/StartRollModal'
import { MusicPlayer } from './components/MusicPlayer'
import { playKillSound, playTaskComplete, playDeadBody, playEmergencyMeeting, playYourTurn, playEndTurnFlip, playEndTurnEnable, playHover, startVictoryBuildup, startDefeatBuildup, stopVictoryBuildup, playLieuPirate, playNoCanDo, playManaAdd, startCardDragLoop, stopCardDragLoop } from './sfx'
import { playVillainIntro } from './villainVoices'
import { Showcase } from './components/Showcase'
import { TestFateBar } from './components/TestFateBar'
import { TestChecklist } from './components/TestChecklist'
import { VillainPortraitPicker } from './components/VillainPortraitPicker'
import { PortraitEditorModal } from './components/PortraitEditorModal'
import { VillainColorModal } from './components/VillainColorModal'
import { CardPicker } from './components/CardPicker'
import { CardFlights, type CardFlight, type FlightRect } from './components/CardFlights'
import { OpeningDeal, type DealCard, DEAL_FLY_IN } from './components/OpeningDeal'
import { Scroller } from './components/Scroller'
import { FloatingGains, type FloatingGain } from './components/FloatingGains'
import { GameTimer } from './components/GameTimer'
import { TurnSplash } from './components/TurnSplash'
import { BackgroundAnimation } from './components/BackgroundAnimation'
import { VillainDecor } from './components/VillainDecor'
import { villainAnimation } from './villainAnimations'
import { fireSurprise, villainHasSurprise } from './surpriseBus'
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
  /** « Déplacer un Allié/Objet » : on attend le clic sur la carte à déplacer.
   *  `granted` (Gaston — Tous avec moi) : action gratuite armée → dispatch enveloppé. */
  | { kind: 'move-pick'; actionId: string; granted?: boolean }
  /** Carte à déplacer choisie ; on attend le clic sur un lieu voisin. */
  | { kind: 'move-dest'; actionId: string; instanceId: string; from: string; cardName: string; granted?: boolean }
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
      /** Gaston — Belle est à moi : Vanquish gratuit armé → dispatch enveloppé. */
      granted?: boolean
      /** Vanquish facultatif de Tendre un Piège / Uniforme (action déjà appliquée). */
      trap?: boolean
      /** Restreint les Héros ciblables à ce lieu (Troupeau de gnous / Uniforme). */
      vanquishLocationId?: string
      /** Uniforme : Allié porteur OBLIGATOIRE parmi les participants (présélectionné). */
      requiredAllyId?: string
      /** Team Rocket — Attraper : la cible est un Pokémon → CATCH_POKEMON (pile de Captures). */
      catch?: boolean
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
      granted?: boolean
      trap?: boolean
      /** Uniforme : Allié porteur OBLIGATOIRE (présélectionné, non décochable). */
      requiredAllyId?: string
      /** Team Rocket — Attraper : dispatch CATCH_POKEMON au lieu de VANQUISH. */
      catch?: boolean
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
  /** Oogie — Baignoire activée : destination choisie, on coche les Alliés à emmener. */
  | { kind: 'baignoire-pick-allies'; actionId: string; cardInstanceId: string; from: string; to: string; selected: string[] }
  /** Jafar — Sacrifice Nécessaire : choisir l'Allié/Objet du royaume à défausser. */
  | { kind: 'sacrifice-pick'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Bowser — épuisement d'énergie : choisir l'Allié (sur le lieu du pion) qui
   *  reçoit l'Étoile drainée de l'Observatoire. */
  | { kind: 'drain-pick-ally'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Bowser — Impuissance : choix « Capturer Peach » OU « Éliminer un Héros ≤3 ». */
  | { kind: 'impuissance-choice'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Bowser — Impuissance (branche Éliminer) : cliquer le Héros ≤3 à éliminer. */
  | { kind: 'impuissance-pick-hero'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Le Seigneur des Ténèbres — On te tient : choix « chercher Tirelire » OU « éliminer
   *  un Héros de force 1 ». */
  | { kind: 'pigkeeper-choice'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** On te tient (branche Éliminer) : cliquer le Héros de force ≤1 à éliminer. */
  | { kind: 'pigkeeper-pick-hero'; actionId: string; instanceId: string; cardName: string; diablo?: boolean }
  /** Ratigan — pose d'un Objet : on coche directement les Engrenages EN JEU à
   *  défausser (−3 chacun) sur le plateau, coût live, puis on confirme. */
  | {
      kind: 'engrenages-pick'
      diablo?: boolean
      actionId: string
      instanceId: string
      to?: string
      attachTo?: string
      cardName: string
      baseCost: number
      /** instanceIds des Engrenages cochables (non associés, sur le plateau). */
      available: string[]
      /** Engrenages déjà cochés à défausser. */
      selected: string[]
    }
  /** Ratigan — Félicia : à la pose (lieu `to` choisi), choix entre défausser un
   *  Allié de ce lieu OU payer 2 Pouvoir de plus. Ouvert quand les DEUX options
   *  sont possibles. */
  | {
      kind: 'felicia-choice'
      actionId: string
      instanceId: string
      cardName: string
      to: string
      /** instanceIds des Alliés défaussables sur `to`. */
      allies: string[]
      /** Coût de base (pour afficher le total « +2 »). */
      baseCost: number
      diablo?: boolean
    }
  /** Ratigan — Félicia : on attend le clic sur l'Allié de `to` à défausser. */
  | { kind: 'felicia-pick-ally'; actionId: string; instanceId: string; cardName: string; to: string; diablo?: boolean }
  | null

/** Le Seigneur des clés — couleurs du dé (CSS). */
const DIE_COLORS = ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange'] as const
const DIE_HEX: Record<string, string> = { bleu: '#3b82f6', rouge: '#ef4444', vert: '#22c55e', jaune: '#eab308', violet: '#a855f7', orange: '#f97316' }

/** Animation du lancer du dé de couleur : les faces défilent ~1,1 s puis se figent
 *  sur la couleur obtenue. `onDone` est appelé une fois l'animation terminée. */
function DieRollModal({ seq, color, onDone }: { seq: number; color: string; onDone: (seq: number) => void }) {
  const [face, setFace] = useState(0)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    let i = 0
    const spin = setInterval(() => { i += 1; setFace(i % DIE_COLORS.length) }, 95)
    const stop = setTimeout(() => {
      clearInterval(spin)
      setFace(DIE_COLORS.indexOf(color as (typeof DIE_COLORS)[number]))
      setSettled(true)
    }, 1100)
    const finish = setTimeout(() => onDone(seq), 1950)
    return () => { clearInterval(spin); clearTimeout(stop); clearTimeout(finish) }
  }, [color, seq, onDone])
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/80 px-10 py-7 shadow-2xl backdrop-blur-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Dé de couleur</div>
        <div
          className="h-24 w-24 rounded-2xl border-4 border-white/85 transition-[background-color,box-shadow] duration-100"
          style={{
            backgroundColor: DIE_HEX[DIE_COLORS[face]],
            boxShadow: settled ? `0 0 26px 6px ${DIE_HEX[color] ?? '#fff'}` : '0 4px 12px rgba(0,0,0,0.5)',
            transform: settled ? 'scale(1.12)' : 'scale(1)',
          }}
        />
        <div className={`text-lg font-bold capitalize transition-opacity ${settled ? 'text-white opacity-100' : 'text-white/40'}`}>
          {settled ? color : ' '}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Oogie Boogie — un dé à 6 faces : faces RÉELLES du jeu (sprite découpé en
 *  die-1.png … die-6.png), façon dé en os rouge d'Oogie Boogie. */
function D6({ value, rolling, dim }: { value: number; rolling?: boolean; dim?: boolean }) {
  const v = Math.min(6, Math.max(1, value))
  return (
    <img
      src={`/cards/oogie-boogie/die-${v}.png`}
      alt={`Dé : ${v}`}
      draggable={false}
      className={`h-20 w-20 rounded-2xl border-2 border-black/40 object-cover shadow-lg ${rolling ? 'animate-pulse' : ''}`}
      style={{ opacity: dim ? 0.5 : 1 }}
    />
  )
}

/** Oogie Boogie — résolution interactive d'un lancer de 2 dés : affiche le résultat
 *  (avec modificateur Gram / Salut Oogie !), permet de relancer un dé avec un Dés
 *  pipés, puis de valider l'issue. */
function DiceRollModal({
  pending,
  rerollCards,
  onConfirm,
  onReroll,
  onChooseDice,
}: {
  pending: PendingDice
  rerollCards: CardInstance[]
  onConfirm: () => void
  onReroll: (instanceId: string, dieIndex: 0 | 1) => void
  onChooseDice: (dice: [number, number]) => void
}) {
  // Oogie — Affaire dans le sac : le joueur CHOISIT les dés (pas d'animation de lancer).
  const choosing = !!pending.chooseDice
  // Le composant est REMONTÉ (via `key`) à chaque (re)lancer → l'état initial
  // `rolling = true` se réarme tout seul ; on ne fait que figer le résultat à la fin.
  const [rolling, setRolling] = useState(!choosing)
  const [shown, setShown] = useState<[number, number]>(pending.dice)
  // Valeurs choisies par le joueur (Affaire dans le sac) — départ [6, 6].
  const [choice, setChoice] = useState<[number, number]>([6, 6])
  useEffect(() => {
    if (choosing) return
    const spin = setInterval(() => setShown([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 80)
    const stop = setTimeout(() => { clearInterval(spin); setShown(pending.dice); setRolling(false) }, 650)
    return () => { clearInterval(spin); clearTimeout(stop) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const canReroll = pending.canReroll && rerollCards.length > 0 && !rolling
  const impostor = pending.outcome.kind === 'impostor'
  const good = impostor ? pending.total >= 7 : pending.total >= 8
  const def = pending.cardId ? getCardDef(pending.cardId) : undefined
  // Affichage « choix » : total live = dés choisis + modificateur.
  const chosenTotal = choice[0] + choice[1] + pending.modifier
  const chosenGood = impostor ? chosenTotal >= 7 : chosenTotal >= 8
  if (choosing) {
    return createPortal(
      <div className="fixed inset-0 z-[300] flex items-center justify-center gap-5 bg-black/70 px-4 backdrop-blur-sm">
        <div className="flex w-[30rem] max-w-[94vw] flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/80">{pending.context}</div>
          <div className="text-center text-sm text-white/70">Cette fois l'affaire est dans le sac : <b>choisissez le résultat</b> des dés.</div>
          <div className="flex items-center gap-12">
            <D6 value={choice[0]} />
            <D6 value={choice[1]} />
          </div>
          {([0, 1] as const).map((di) => (
            <div key={di} className="flex items-center gap-2">
              <span className="w-12 text-right text-xs text-white/60">Dé {di + 1}</span>
              {[1, 2, 3, 4, 5, 6].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChoice((c) => (di === 0 ? [v, c[1]] : [c[0], v]))}
                  className={`h-8 w-8 rounded-lg border-2 text-sm font-bold transition ${
                    choice[di] === v ? 'border-rose-300 bg-rose-500/30 text-white' : 'border-white/15 text-white/60 hover:border-white/40'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          ))}
          <div className="text-center">
            <div className="text-sm text-white/70">
              {choice[0]} + {choice[1]}
              {pending.modifier !== 0 && (
                <span className={pending.modifier > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {' '}{pending.modifier > 0 ? '+' : ''}{pending.modifier}
                </span>
              )}
            </div>
            <div className={`text-4xl font-black ${chosenGood ? 'text-emerald-300' : 'text-white'}`}>{chosenTotal}</div>
          </div>
          <button
            type="button"
            onClick={() => onChooseDice(choice)}
            className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/30"
          >
            OK
          </button>
        </div>
        {def?.image && (
          <img
            src={def.image}
            alt={def.name}
            className="hidden max-h-[80vh] w-64 max-w-[40vw] rounded-xl border border-white/15 shadow-2xl md:block"
          />
        )}
      </div>,
      document.body,
    )
  }
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center gap-5 bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[28rem] max-w-[94vw] flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/80">{pending.context}</div>
        <div className="flex items-center gap-12">
          <D6 value={shown[0]} rolling={rolling} />
          <D6 value={shown[1]} rolling={rolling} />
        </div>
        {!rolling && (
          <div className="text-center">
            <div className="text-sm text-white/70">
              {pending.dice[0]} + {pending.dice[1]}
              {pending.modifier !== 0 && (
                <span className={pending.modifier > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {' '}{pending.modifier > 0 ? '+' : ''}{pending.modifier}
                </span>
              )}
            </div>
            <div className={`text-4xl font-black ${good ? 'text-emerald-300' : 'text-white'}`}>{pending.total}</div>
            {impostor && (
              <div className={`text-xs font-semibold ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
                {good ? 'Réussite (≥ 7) !' : 'Échec (≤ 6)'}
              </div>
            )}
          </div>
        )}
        {!rolling && (
          <div className="flex w-full flex-col gap-2">
            {canReroll && (
              <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="text-center text-xs font-semibold text-amber-200/80">
                  Vous pouvez tricher en relançant un des deux dés :
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReroll(rerollCards[0].instanceId, 0)}
                    className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
                  >
                    Relancer le dé 1 ({pending.dice[0]})
                  </button>
                  <button
                    type="button"
                    onClick={() => onReroll(rerollCards[0].instanceId, 1)}
                    className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
                  >
                    Relancer le dé 2 ({pending.dice[1]})
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/30"
            >
              OK
            </button>
          </div>
        )}
      </div>
      {/* Carte à l'origine du lancer, affichée à droite pour relire son effet. */}
      {def?.image && (
        <img
          src={def.image}
          alt={def.name}
          className="hidden max-h-[80vh] w-64 max-w-[40vw] rounded-xl border border-white/15 shadow-2xl md:block"
        />
      )}
    </div>,
    document.body,
  )
}

/** Oogie Boogie — affichage auto-dismiss d'un lancer de dés NON interactif (bot,
 *  Conditions) : montre le résultat brièvement puis s'efface. */
function DiceRollToast({
  seq,
  dice,
  total,
  modifier,
  context,
  outcomeText,
  durationMs = 1750,
  onDone,
}: {
  seq: number
  dice: [number, number]
  total: number
  modifier: number
  context: string
  /** Ligne d'effet à afficher sous le total (ex. Joyeux Halloween : gain/vol). */
  outcomeText?: string
  /** Durée avant disparition (défaut 1750 ms). */
  durationMs?: number
  onDone: (seq: number) => void
}) {
  // Remonté (via `key={seq}`) à chaque lancer → état initial `rolling = true`.
  const [rolling, setRolling] = useState(true)
  const [shown, setShown] = useState<[number, number]>(dice)
  useEffect(() => {
    const spin = setInterval(() => setShown([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 80)
    const stop = setTimeout(() => { clearInterval(spin); setShown(dice); setRolling(false) }, 650)
    const finish = setTimeout(() => onDone(seq), durationMs)
    return () => { clearInterval(spin); clearTimeout(stop); clearTimeout(finish) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/80 px-10 py-7 shadow-2xl backdrop-blur-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/70">{context}</div>
        <div className="flex items-center gap-3">
          <D6 value={shown[0]} rolling={rolling} />
          <D6 value={shown[1]} rolling={rolling} />
        </div>
        {!rolling && (
          <div className="text-2xl font-black text-white">
            {dice[0]} + {dice[1]}{modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''} = {total}
          </div>
        )}
        {!rolling && outcomeText && (
          <div className="max-w-xs text-center text-sm font-semibold text-emerald-200">{outcomeText}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Oogie — Qu'est-ce que le Père Noël t'a apporté ? : l'humain défausse autant de
 *  cartes qu'il veut de sa main (clic pour cocher), puis pioche `draw` cartes. */
function ChristmasDiscardModal({
  hand,
  draw,
  onResolve,
}: {
  hand: CardInstance[]
  draw: number
  onResolve: (instanceIds: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-3 overflow-auto rounded-2xl border border-white/15 bg-[#15101f] p-5 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-amber-200">Qu'est-ce que le Père Noël t'a apporté ?</h2>
        <p className="text-center text-sm text-white/70">
          Défausse autant de cartes que tu veux (clique pour cocher), puis pioche {draw}. Tu peux n'en défausser aucune.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {hand.map((c) => {
            const def = getCardDef(c.cardId)
            const on = selected.includes(c.instanceId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => toggle(c.instanceId)}
                className={`rounded-lg border-2 p-1 transition ${on ? 'border-rose-300 ring-2 ring-rose-300' : 'border-white/15 opacity-70 hover:opacity-100'}`}
              >
                <img src={def?.image} alt={c.name} className="h-40 w-auto rounded" />
                <div className="mt-1 text-center text-[11px] text-white/80">{on ? '✗ Défausser' : 'Garder'}</div>
              </button>
            )
          })}
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onResolve(selected)}
            className="rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/30"
          >
            Défausser {selected.length} puis piocher {draw}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Oogie — Préparation de Noël (≥8) : action de royaume gratuite. Affiche les 4 lieux
 *  en colonnes, chacun listant ses actions disponibles (hors Fatalité). Cliquer une
 *  colonne choisit ce lieu : ses actions s'allument alors sur le plateau. */
function ChristmasFreeActionModal({
  player,
  onPick,
}: {
  player: PlayerState
  onPick: (locationId: string) => void
}) {
  // Libellés d'icône par type d'action (pour une lecture rapide).
  const ICON: Record<string, string> = {
    GAIN_POWER: '💰', PLAY_CARD: '🃏', VANQUISH: '⚔️', MOVE_ITEM_ALLY: '↔️',
    DISCARD_CARDS: '🗑️', ACTIVATE: '⚡', MOVE_HERO: '🚶',
  }
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-white/15 bg-[#1a0a24] p-6 text-white">
        <h2 className="text-center text-xl font-black text-emerald-200">Préparation de Noël — action gratuite</h2>
        <p className="text-center text-sm text-white/70">
          Choisissez un lieu : vous y effectuerez UNE action gratuite (hors Fatalité). Ses cases s'allumeront sur le plateau.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {player.locations.map((loc) => {
            const actions = loc.actions.filter((a) => a.type !== 'FATE')
            const locked = (player.lockedLocations ?? []).includes(loc.id)
            return (
              <button
                key={loc.id}
                type="button"
                disabled={locked}
                onClick={() => onPick(loc.id)}
                className={`flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition ${
                  locked ? 'cursor-not-allowed border-white/10 opacity-40' : 'border-emerald-300/40 hover:border-emerald-300 hover:bg-emerald-400/10'
                }`}
              >
                <div className="text-center text-sm font-bold text-emerald-100">{loc.name}</div>
                <ul className="flex flex-col gap-1">
                  {actions.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-xs text-white/85">
                      <span>{ICON[a.type] ?? '•'}</span>
                      <span>{a.label}</span>
                    </li>
                  ))}
                  {actions.length === 0 && <li className="text-xs text-white/40">Aucune action</li>}
                </ul>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Mim — Le Savoir conduit à la Puissance : le joueur (qui pose la Fatalité) choisit
 *  une Métamorphose de Merlin du royaume de Mim, puis un lieu de destination. */
function MerlinMoveModal({
  target,
  candidateIds,
  onResolve,
}: {
  target: PlayerState
  candidateIds: string[]
  onResolve: (merlinInstanceId: string, to: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const merlins = Object.entries(target.board).flatMap(([loc, cards]) =>
    cards.filter((c) => candidateIds.includes(c.instanceId)).map((c) => ({ c, loc })),
  )
  const fromLoc = merlins.find((m) => m.c.instanceId === picked)?.loc
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-3 overflow-auto rounded-2xl border border-white/15 bg-[#120a1c] p-5 text-white shadow-2xl">
        <h2 className="text-center text-lg font-bold text-fuchsia-200">Le Savoir conduit à la Puissance</h2>
        <p className="text-center text-sm text-white/70">
          {picked ? 'Vers quel lieu déplacer cette Métamorphose de Merlin ?' : 'Choisis la Métamorphose de Merlin à déplacer.'}
        </p>
        {!picked ? (
          <div className="flex flex-wrap justify-center gap-3">
            {merlins.map(({ c, loc }) => {
              const def = getCardDef(c.cardId)
              return (
                <button
                  key={c.instanceId}
                  type="button"
                  onClick={() => setPicked(c.instanceId)}
                  className="rounded-lg border-2 border-white/15 p-1 transition hover:border-fuchsia-300"
                >
                  <img src={def?.image} alt={c.name} className="h-40 w-auto rounded" />
                  <div className="mt-1 text-center text-[11px] text-white/70">{target.locations.find((l) => l.id === loc)?.name ?? loc}</div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {target.locations.map((loc) => {
              const disabled = loc.id === fromLoc
              return (
                <button
                  key={loc.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onResolve(picked, loc.id)}
                  className={`rounded-lg border px-2 py-3 text-xs ${disabled ? 'cursor-not-allowed border-white/10 text-white/30' : 'border-fuchsia-300/50 text-white hover:bg-fuchsia-400/20'}`}
                >
                  {loc.name}
                  {disabled && <span className="block text-[10px] text-white/40">(lieu actuel)</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Ratigan — Le Grand Génie du Mal : l'humain choisit entre piocher `draw` cartes
 *  OU gagner `power` jetons Pouvoir. */
function DrawOrGainPowerModal({
  draw,
  power,
  cardId,
  onChoose,
}: {
  draw: number
  power: number
  cardId?: string
  onChoose: (choice: 'draw' | 'power') => void
}) {
  const def = getCardDef(cardId ?? 'grand-genie-du-mal')
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[26rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-amber-200">{def?.name ?? 'Le Grand Génie du Mal'}</h2>
        {def?.image && (
          <img src={def.image} alt={def.name} className="mx-auto w-28 rounded-lg border border-white/15 shadow" />
        )}
        <p className="text-center text-sm text-white/80">Choisis ton effet :</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onChoose('draw')}
            className="flex-1 rounded-lg border border-sky-400/60 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/30"
          >
            Piocher {draw} carte{draw > 1 ? 's' : ''}
          </button>
          <button
            type="button"
            onClick={() => onChoose('power')}
            className="flex-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
          >
            Gagner {power} Pouvoir
          </button>
        </div>
      </div>
    </div>
  )
}

function MoveOrActivateModal({
  canMove,
  canActivate,
  onChoose,
}: {
  canMove: boolean
  canActivate: boolean
  onChoose: (choice: 'move' | 'activate') => void
}) {
  const def = getCardDef('il-y-a-encore-une-chance')
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[26rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-amber-200">{def?.name ?? 'C’est votre dernière chance'}</h2>
        {def?.image && (
          <img src={def.image} alt={def.name} className="mx-auto w-28 rounded-lg border border-white/15 shadow" />
        )}
        <p className="text-center text-sm text-white/80">Choisis l’action gratuite :</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            disabled={!canMove}
            onClick={() => onChoose('move')}
            className="flex-1 rounded-lg border border-sky-400/60 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Déplacer un Objet ou un Allié
          </button>
          <button
            type="button"
            disabled={!canActivate}
            onClick={() => onChoose('activate')}
            className="flex-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Activer une capacité
          </button>
        </div>
      </div>
    </div>
  )
}

/** Le Seigneur des Ténèbres — Montre-moi le Chaudron Magique / Nous avons conclu un
 *  marché : choix « s'emparer du Chaudron » OU « gagner du Pouvoir ». */
function CauldronChoiceModal({
  power,
  onChoose,
}: {
  power: number
  onChoose: (choice: 'cauldron' | 'power') => void
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[26rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-lime-200">Le Chaudron Magique</h2>
        <img
          src="/cards/seigneur-tenebres/cauldron.png"
          alt="Chaudron Magique"
          className="mx-auto h-24 w-auto object-contain drop-shadow"
        />
        <p className="text-center text-sm text-white/80">Que choisis-tu ?</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onChoose('cauldron')}
            className="flex-1 rounded-lg border border-lime-400/60 bg-lime-500/20 px-4 py-2 text-sm font-semibold text-lime-100 hover:bg-lime-500/30"
          >
            🜕 S’emparer du Chaudron
          </button>
          <button
            type="button"
            onClick={() => onChoose('power')}
            className="flex-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
          >
            Gagner {power} Pouvoir
          </button>
        </div>
      </div>
    </div>
  )
}

/** Tamatoa — Pas exactement l'heure de Maui : la 1ʳᵉ carte Maui est dévoilée ; le joueur
 *  choisit de la JOUER (résout son effet) ou de la DÉFAUSSER. */
function MauiChoiceModal({
  card,
  onChoose,
}: {
  card: CardInstance | undefined
  onChoose: (choice: 'play' | 'discard') => void
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[26rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-amber-200">Pas exactement l’heure de Maui</h2>
        {card && (
          <img
            src={`/cards/tamatoa/${card.cardId}.png`}
            alt={card.name}
            className="mx-auto h-48 w-auto rounded-lg object-contain shadow-lg"
          />
        )}
        <p className="text-center text-sm text-white/80">Joues-tu cette carte Maui, ou la défausses-tu ?</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onChoose('play')}
            className="flex-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
          >
            🎴 Jouer
          </button>
          <button
            type="button"
            onClick={() => onChoose('discard')}
            className="flex-1 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20"
          >
            🗑️ Défausser
          </button>
        </div>
      </div>
    </div>
  )
}

/** Le Seigneur des Ténèbres — Nous avons conclu un marché ! : choix « mélanger sa
 *  défausse » OU « payer N Pouvoir pour défausser l'Épée Magique et s'emparer du
 *  Chaudron ». N'apparaît que si les deux options sont possibles. */
function BargainChoiceModal({
  power,
  onChoose,
}: {
  power: number
  onChoose: (choice: 'reshuffle' | 'sword') => void
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[28rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-lime-200">Nous avons conclu un marché !</h2>
        <p className="text-center text-sm text-white/80">Que choisis-tu ?</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onChoose('reshuffle')}
            className="flex-1 rounded-lg border border-sky-400/60 bg-sky-500/20 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-500/30"
          >
            🔀 Mélanger ma défausse dans ma pioche
          </button>
          <button
            type="button"
            onClick={() => onChoose('sword')}
            className="flex-1 rounded-lg border border-lime-400/60 bg-lime-500/20 px-4 py-3 text-sm font-semibold text-lime-100 hover:bg-lime-500/30"
          >
            🜕 Payer {power} Pouvoir : défausser l’Épée Magique et s’emparer du Chaudron
          </button>
        </div>
      </div>
    </div>
  )
}

/** Le Seigneur des Ténèbres — Nous touchons du doigt la victoire : l'humain joue
 *  gratuitement un Objet de sa main (choix de l'Objet puis du lieu). */
function FreeItemPlayModal({
  items,
  locations,
  blockedFor,
  onResolve,
  onSkip,
}: {
  items: CardInstance[]
  locations: { id: string; name: string }[]
  /** cardId → set des lieux interdits (Les Elfes). */
  blockedFor: (cardId: string, locationId: string) => boolean
  onResolve: (instanceId: string, to: string) => void
  onSkip: () => void
}) {
  const [pick, setPick] = useState<string | null>(items.length === 1 ? items[0].instanceId : null)
  const picked = items.find((c) => c.instanceId === pick)
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[30rem] max-w-[94vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-lime-200">Jouez gratuitement un Objet</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {items.map((c) => {
            const def = getCardDef(c.cardId)
            return (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => setPick(c.instanceId)}
                className={`rounded-lg border-2 p-1 transition ${pick === c.instanceId ? 'border-lime-300 ring-2 ring-lime-300' : 'border-white/15 hover:border-white/50'}`}
              >
                {def?.image && <img src={def.image} alt={c.name} className="h-28 w-auto rounded" />}
                <div className="mt-0.5 text-center text-[11px] text-white/70">{c.name}</div>
              </button>
            )
          })}
        </div>
        {picked && (
          <>
            <p className="text-center text-sm text-white/80">Sur quel lieu ?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {locations.map((l) => {
                const blocked = blockedFor(picked.cardId, l.id)
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => onResolve(picked.instanceId, l.id)}
                    className={`rounded-lg border px-2 py-2 text-xs ${blocked ? 'cursor-not-allowed border-white/10 text-white/30' : 'border-white/40 text-white hover:bg-white/10'}`}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onSkip} className="rounded-lg border border-white/30 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
            Renoncer
          </button>
        </div>
      </div>
    </div>
  )
}

/** Mère Gothel — Lance-moi ta chevelure : l'humain choisit de combien de lieux
 *  ramener Raiponce vers la Tour (1 ou 2). */
function RaiponceHomewardModal({
  options,
  onChoose,
}: {
  options: { steps: number; locationId: string; locationName: string }[]
  onChoose: (steps: number) => void
}) {
  const def = getCardDef('lance-moi-ta-chevelure')
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="flex w-[26rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-amber-200">Lance-moi ta chevelure</h2>
        {def?.image && (
          <img src={def.image} alt={def.name} className="mx-auto w-28 rounded-lg border border-white/15 shadow" />
        )}
        <p className="text-center text-sm text-white/80">De combien de lieux ramener Raiponce vers la Tour ?</p>
        <div className="flex justify-center gap-3">
          {options.map((o) => (
            <button
              key={o.steps}
              type="button"
              onClick={() => onChoose(o.steps)}
              className="flex-1 rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30"
            >
              {o.steps} lieu{o.steps > 1 ? 'x' : ''}
              <span className="block text-xs font-normal text-white/60">→ {o.locationName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const BOT_STEP_MS = 700
// Délai avant que le bot ne pose la carte de Vol du château : laisse le joueur
// adverse lire les cartes dévoilées (modale affichée des deux côtés).
const CASTLE_THEFT_READ_MS = 2400

export default function App({ onExit }: { onExit?: () => void } = {}) {
  const state = useGameStore((s) => s.state)
  const move = useGameStore((s) => s.move)
  const moveTrack = useGameStore((s) => s.moveTrack)
  const skipMove = useGameStore((s) => s.skipMove)
  const executeAction = useGameStore((s) => s.executeAction)
  const playCard = useGameStore((s) => s.playCard)
  const discardCards = useGameStore((s) => s.discardCards)
  const moveCard = useGameStore((s) => s.moveCard)
  const moveHero = useGameStore((s) => s.moveHero)
  const setStartingPlayer = useGameStore((s) => s.setStartingPlayer)
  const activate = useGameStore((s) => s.activate)
  const activateCauldron = useGameStore((s) => s.activateCauldron)
  const vanquish = useGameStore((s) => s.vanquish)
  const catchPokemon = useGameStore((s) => s.catchPokemon)
  const discardDeguisement = useGameStore((s) => s.discardDeguisement)
  const sheriffMove = useGameStore((s) => s.sheriffMove)
  const diabloMove = useGameStore((s) => s.diabloMove)
  const diabloFreeAction = useGameStore((s) => s.diabloFreeAction)
  const diabloSkipFreeAction = useGameStore((s) => s.diabloSkipFreeAction)
  const performGrantedAction = useGameStore((s) => s.performGrantedAction)
  const skipGrantedAction = useGameStore((s) => s.skipGrantedAction)
  const resolveObstacle = useGameStore((s) => s.resolveObstacle)
  const doneObstacle = useGameStore((s) => s.doneObstacle)
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
  const resolveDrawOrGainPower = useGameStore((s) => s.resolveDrawOrGainPower)
  const resolvePowerOrRacerBack = useGameStore((s) => s.resolvePowerOrRacerBack)
  const resolveTaffytaChoice = useGameStore((s) => s.resolveTaffytaChoice)
  const resolveAigreBill = useGameStore((s) => s.resolveAigreBill)
  const resolvePayRace = useGameStore((s) => s.resolvePayRace)
  const resolvePawnBack = useGameStore((s) => s.resolvePawnBack)
  const resolveBeacon = useGameStore((s) => s.resolveBeacon)
  const resolveMedal = useGameStore((s) => s.resolveMedal)
  const resolveActivateOrVanquish = useGameStore((s) => s.resolveActivateOrVanquish)
  const resolveRemoveFire = useGameStore((s) => s.resolveRemoveFire)
  const resolveShereKhanDefeat = useGameStore((s) => s.resolveShereKhanDefeat)
  const resolveRecoverFate = useGameStore((s) => s.resolveRecoverFate)
  const resolveFreePlayAlly = useGameStore((s) => s.resolveFreePlayAlly)
  const resolveYoung = useGameStore((s) => s.resolveYoung)
  const resolveRecoverToDeck = useGameStore((s) => s.resolveRecoverToDeck)
  const resolveInteressant = useGameStore((s) => s.resolveInteressant)
  const resolveKaaPlay = useGameStore((s) => s.resolveKaaPlay)
  const resolveMonkeyKing = useGameStore((s) => s.resolveMonkeyKing)
  const resolveKaaShield = useGameStore((s) => s.resolveKaaShield)
  const resolvePlaceTreasure = useGameStore((s) => s.resolvePlaceTreasure)
  const resolveRevealTreasure = useGameStore((s) => s.resolveRevealTreasure)
  const resolveMoveSwapTreasure = useGameStore((s) => s.resolveMoveSwapTreasure)
  const resolveWakeKraken = useGameStore((s) => s.resolveWakeKraken)
  const resolveMoveOrActivate = useGameStore((s) => s.resolveMoveOrActivate)
  const resolveCauldronChoice = useGameStore((s) => s.resolveCauldronChoice)
  const resolveMauiChoice = useGameStore((s) => s.resolveMauiChoice)
  const resolveDioDiscardAlly = useGameStore((s) => s.resolveDioDiscardAlly)
  const resolveDioCream = useGameStore((s) => s.resolveDioCream)
  const resolveDioMuda = useGameStore((s) => s.resolveDioMuda)
  const resolveDioQuest = useGameStore((s) => s.resolveDioQuest)
  const resolveDioSunlight = useGameStore((s) => s.resolveDioSunlight)
  const resolveCrustaceanPlace = useGameStore((s) => s.resolveCrustaceanPlace)
  const resolveFateAllyToAuDela = useGameStore((s) => s.resolveFateAllyToAuDela)
  const resolveFateDiscardHand = useGameStore((s) => s.resolveFateDiscardHand)
  const resolveDiversionDiscard = useGameStore((s) => s.resolveDiversionDiscard)
  const resolveUntrapTitans = useGameStore((s) => s.resolveUntrapTitans)
  const resolveBargainChoice = useGameStore((s) => s.resolveBargainChoice)
  const resolveFreeItemPlay = useGameStore((s) => s.resolveFreeItemPlay)
  const skipFreeItemPlay = useGameStore((s) => s.skipFreeItemPlay)
  const resolveMaximusCavaliers = useGameStore((s) => s.resolveMaximusCavaliers)
  const resolveMaximusMove = useGameStore((s) => s.resolveMaximusMove)
  const resolveFateReorder = useGameStore((s) => s.resolveFateReorder)
  const resolveRaiponceHomeward = useGameStore((s) => s.resolveRaiponceHomeward)
  const resolveRaiponceToTower = useGameStore((s) => s.resolveRaiponceToTower)
  const resolvePuppyAdd = useGameStore((s) => s.resolvePuppyAdd)
  const resolvePuppyReveal = useGameStore((s) => s.resolvePuppyReveal)
  const donePuppyReveal = useGameStore((s) => s.donePuppyReveal)
  const resolveHoraceChoice = useGameStore((s) => s.resolveHoraceChoice)
  const resolvePuppyCapture = useGameStore((s) => s.resolvePuppyCapture)
  const resolveQuelsIdiots = useGameStore((s) => s.resolveQuelsIdiots)
  const resolveQuelsIdiotsPick = useGameStore((s) => s.resolveQuelsIdiotsPick)
  const sacrificeCrown = useGameStore((s) => s.sacrificeCrown)
  const resolveHeroRelocate = useGameStore((s) => s.resolveHeroRelocate)
  const skipHeroRelocate = useGameStore((s) => s.skipHeroRelocate)
  const resolveAllyRelocate = useGameStore((s) => s.resolveAllyRelocate)
  const skipAllyRelocate = useGameStore((s) => s.skipAllyRelocate)
  const resolvePokemonSummon = useGameStore((s) => s.resolvePokemonSummon)
  const resolveKoPokemon = useGameStore((s) => s.resolveKoPokemon)
  const resolveFateDiscardAlly = useGameStore((s) => s.resolveFateDiscardAlly)
  const resolveIdentification = useGameStore((s) => s.resolveIdentification)
  const resolveLotsoTarget = useGameStore((s) => s.resolveLotsoTarget)
  const resolveEvolveAlly = useGameStore((s) => s.resolveEvolveAlly)
  const resolveLotsoBuzzMove = useGameStore((s) => s.resolveLotsoBuzzMove)
  const resolveLotsoBookworm = useGameStore((s) => s.resolveLotsoBookworm)
  const resolveLotsoFlex = useGameStore((s) => s.resolveLotsoFlex)
  const resolveTeleport = useGameStore((s) => s.resolveTeleport)
  const resolveManipulation = useGameStore((s) => s.resolveManipulation)
  const resolveMauvaisCoup = useGameStore((s) => s.resolveMauvaisCoup)
  const resolveSournois = useGameStore((s) => s.resolveSournois)
  const resolveAllyItemMove = useGameStore((s) => s.resolveAllyItemMove)
  const resolveAllyItemMoveAuto = useGameStore((s) => s.resolveAllyItemMoveAuto)
  const resolveBanditChain = useGameStore((s) => s.resolveBanditChain)
  const resolveDingo = useGameStore((s) => s.resolveDingo)
  const dismissRoyalCroquet = useGameStore((s) => s.dismissRoyalCroquet)
  const resolveTransformWickets = useGameStore((s) => s.resolveTransformWickets)
  const resolveScry = useGameStore((s) => s.resolveScry)
  const resolveAllyMoveBuff = useGameStore((s) => s.resolveAllyMoveBuff)
  const skipAllyMoveBuff = useGameStore((s) => s.skipAllyMoveBuff)
  const resolveFateChoice = useGameStore((s) => s.resolveFateChoice)
  const resolveMerlinMove = useGameStore((s) => s.resolveMerlinMove)
  const resolveFetchedHero = useGameStore((s) => s.resolveFetchedHero)
  const resolveCastleTheft = useGameStore((s) => s.resolveCastleTheft)
  const resetGame = useGameStore((s) => s.reset)
  // Renommé sans préfixe « use » : c'est une action du store, pas un hook React
  // (sinon eslint react-hooks la croit appelée hors composant dans le callback).
  const playNeverlandMap = useGameStore((s) => s.useNeverlandMap)
  const resolveRecover = useGameStore((s) => s.resolveRecover)
  const resolveBePrepared = useGameStore((s) => s.resolveBePrepared)
  const resolveFreeHyena = useGameStore((s) => s.resolveFreeHyena)
  const resolveHakunaMatata = useGameStore((s) => s.resolveHakunaMatata)
  const resolveYzmaFateDeck = useGameStore((s) => s.resolveYzmaFateDeck)
  const resolveYzmaFateCard = useGameStore((s) => s.resolveYzmaFateCard)
  const resolveYzmaOwnDeck = useGameStore((s) => s.resolveYzmaOwnDeck)
  const resolveYzmaHammer = useGameStore((s) => s.resolveYzmaHammer)
  const resolveYzmaManipulate = useGameStore((s) => s.resolveYzmaManipulate)
  const resolveFinishJob = useGameStore((s) => s.resolveFinishJob)
  const resolveBeautySleep = useGameStore((s) => s.resolveBeautySleep)
  const resolveReplayEvent = useGameStore((s) => s.resolveReplayEvent)
  const resolveCrewmateKill = useGameStore((s) => s.resolveCrewmateKill)
  const resolveCrewmateSuspect = useGameStore((s) => s.resolveCrewmateSuspect)
  const doneCrewmateSuspect = useGameStore((s) => s.doneCrewmateSuspect)
  const resolveCrewmateMove = useGameStore((s) => s.resolveCrewmateMove)
  const doneCrewmateMove = useGameStore((s) => s.doneCrewmateMove)
  const resolveFateObjectPlace = useGameStore((s) => s.resolveFateObjectPlace)
  const resolveFateHeroPlace = useGameStore((s) => s.resolveFateHeroPlace)
  const resolveGiantLocation = useGameStore((s) => s.resolveGiantLocation)
  const resolveTitanMove = useGameStore((s) => s.resolveTitanMove)
  const resolveTitanSelect = useGameStore((s) => s.resolveTitanSelect)
  const resolveDivination = useGameStore((s) => s.resolveDivination)
  const resolveLookTop = useGameStore((s) => s.resolveLookTop)
  const acknowledgeReveal = useGameStore((s) => s.acknowledgeReveal)
  const resolveHack = useGameStore((s) => s.resolveHack)
  const resolveInformation = useGameStore((s) => s.resolveInformation)
  const resolveDiscardThenDraw = useGameStore((s) => s.resolveDiscardThenDraw)
  const resolveTakeABite = useGameStore((s) => s.resolveTakeABite)
  const resolveDuplicateIngredient = useGameStore((s) => s.resolveDuplicateIngredient)
  const cancelDuplicateIngredient = useGameStore((s) => s.cancelDuplicateIngredient)
  const resolveScream = useGameStore((s) => s.resolveScream)
  const resolveFateScry = useGameStore((s) => s.resolveFateScry)
  const obtainKey = useGameStore((s) => s.obtainKey)
  const resolveKey = useGameStore((s) => s.resolveKey)
  const resolveKeyColor = useGameStore((s) => s.resolveKeyColor)
  const resolveDice = useGameStore((s) => s.resolveDice)
  const resolveDiceReroll = useGameStore((s) => s.resolveDiceReroll)
  const resolveDiceChoice = useGameStore((s) => s.resolveDiceChoice)
  const skipFreeRealmAction = useGameStore((s) => s.skipFreeRealmAction)
  const resolvePlaisir = useGameStore((s) => s.resolvePlaisir)
  const resolveStealKey = useGameStore((s) => s.resolveStealKey)
  // Renommé sans préfixe « use » (action du store, pas un hook React).
  const activateCanne = useGameStore((s) => s.useCanne)
  const chariotMove = useGameStore((s) => s.chariotMove)
  const zaWarudoRelocate = useGameStore((s) => s.zaWarudoRelocate)
  const skipRemoteAction = useGameStore((s) => s.skipRemoteAction)
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
  // Vrai si l'app tourne en exécutable de bureau (réel) OU si la simulation .exe est
  // activée dans les options. Le bouton « Mode test » (outil de dév) est alors masqué.
  const isDesktopApp = useIsDesktopApp()
  // Noms/avatars des joueurs : profil local + lobby réseau (pour l'adversaire).
  const lobby = useGameStore((s) => s.lobby)
  const myProfileName = usePlayerStore((s) => s.name)
  const myAvatarVillain = usePlayerStore((s) => s.avatarVillain)
  const myAvatarColor = usePlayerStore((s) => s.avatarColor)
  const enterTestMode = useGameStore((s) => s.enterTestMode)
  const testInsertCard = useGameStore((s) => s.testInsertCard)
  const testPlaceFate = useGameStore((s) => s.testPlaceFate)
  const testPlayCondition = useGameStore((s) => s.testPlayCondition)
  const testAddToHand = useGameStore((s) => s.testAddToHand)
  const testAddToAuDela = useGameStore((s) => s.testAddToAuDela)
  const testPlayFateCard = useGameStore((s) => s.testPlayFateCard)
  const testShowcase = useGameStore((s) => s.testShowcase)
  const testRefreshTurn = useGameStore((s) => s.testRefreshTurn)

  // --- Statistiques de profil (par vilain joueur) -------------------------
  // `humanVillainKey`/`opponentVillainKey` (sièges 0/1) servent à l'intro voix et au
  // temps de jeu ; l'enregistrement de fin de partie, lui, est relatif au siège LOCAL.
  const recordResult = useStatsStore((s) => s.recordResult)
  const recordGame = useStatsStore((s) => s.recordGame)
  const addPlaytime = useStatsStore((s) => s.addPlaytime)
  const markTestWon = useTestWinStore((s) => s.markWon)
  const humanVillainKey = villainKeyOf(state.players[0].villain)
  const opponentVillainKey = villainKeyOf(state.players[1].villain)
  // Clé de PRÉSENTATION/voix qui PRÉSERVE l'identité d'un vilain personnalisé
  // (villainKeyOf le rabattrait sur un natif). Custom → son id ; natif → sa VillainKey.
  const presKey = (villainId: string): string => (isCustomKey(villainId) ? villainId : villainKeyOf(villainId))

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

  // Voix d'intro : « mon vilain » → « Contre » → « vilain adverse », jouée une
  // seule fois en entrant dans la partie. Le ref évite tout rejeu si les clés
  // (stables sur une partie) déclenchent un nouveau rendu.
  // `introVoiceDone` passe à vrai à la FIN de la voix → l'écran de dés attend.
  const introPlayedRef = useRef(false)
  const [introVoiceDone, setIntroVoiceDone] = useState(false)
  useEffect(() => {
    if (introPlayedRef.current) return
    introPlayedRef.current = true
    playVillainIntro(state.players[0].villain, state.players[1].villain, () => setIntroVoiceDone(true))
  }, [state.players])

  // Victoire/défaite : enregistrée une seule fois quand la partie se termine. Tout
  // est relatif au siège LOCAL (HUMAN/BOT) — correct en solo comme en réseau (où
  // chaque client journalise depuis son point de vue).
  const resultRecordedRef = useRef(false)
  useEffect(() => {
    if (state.status === 'WON' && !resultRecordedRef.current) {
      resultRecordedRef.current = true
      const humanWon = state.winner === HUMAN
      // Vilain PERSONNALISÉ gagné par le joueur : on le marque « test réussi » (débloque
      // le bouton « Terminer » de l'Atelier pour une première publication).
      const humanVillainId = state.players[HUMAN].villain
      if (humanWon && isCustomKey(humanVillainId)) markTestWon(humanVillainId)
      const localKey = villainKeyOf(state.players[HUMAN].villain)
      const oppKey = villainKeyOf(state.players[BOT].villain)
      const oppSeat = lobby?.find((s) => s.seat === BOT)
      const net = gameMode !== 'solo'
      recordResult(localKey, humanWon)
      recordGame({
        human: localKey,
        opponent: oppKey,
        winner: humanWon ? 'human' : 'opponent',
        at: Date.now(),
        mode: gameMode,
        humanName: myProfileName.trim() || undefined,
        humanAvatarVillain: myAvatarVillain,
        humanAvatarColor: myAvatarColor,
        // L'adversaire n'a un nom/avatar « joueur » qu'en réseau ; en solo c'est le bot.
        opponentName: net ? oppSeat?.name : undefined,
        opponentAvatarVillain: net ? oppSeat?.avatarVillain : undefined,
        opponentAvatarColor: net ? oppSeat?.avatarColor : undefined,
      })
    }
  }, [
    state.status, state.winner, state.players, HUMAN, BOT, lobby, gameMode,
    myProfileName, myAvatarVillain, myAvatarColor, recordResult, recordGame, markTestWon,
  ])

  const [mode, setMode] = useState<Mode>(null)
  // Mode test : relance l'animation de décor au clic (boutons 🚢). On choisit le
  // vilain ET le camp (joueur/adversaire) pour tester chaque trajectoire des deux côtés.
  const [debugAnim, setDebugAnim] = useState<{
    seq: number
    villain: VillainKey
    side: 'player' | 'opponent'
  } | null>(null)
  const fireDebugAnim = (villain: VillainKey, side: 'player' | 'opponent') =>
    setDebugAnim((d) => ({ seq: (d?.seq ?? 0) + 1, villain, side }))
  // Mode test : compte à rebours par bouton (clé `côté:type`) avant de jouer l'animation —
  // laisse le temps de regarder le décor. La valeur = secondes restantes (3 → 1), absente = inactif.
  const [animCountdown, setAnimCountdown] = useState<Record<string, number>>({})
  const startAnimCountdown = (key: string, fire: () => void) => {
    if (animCountdown[key] != null) return // déjà en cours
    setAnimCountdown((c) => ({ ...c, [key]: 3 }))
    setTimeout(() => setAnimCountdown((c) => (c[key] != null ? { ...c, [key]: 2 } : c)), 1000)
    setTimeout(() => setAnimCountdown((c) => (c[key] != null ? { ...c, [key]: 1 } : c)), 2000)
    setTimeout(() => {
      setAnimCountdown((c) => {
        const next = { ...c }
        delete next[key]
        return next
      })
      fire()
    }, 3000)
  }
  // Mode test : vilain choisi dans le select pour prévisualiser son animation (n'importe lequel).
  const [testVillain, setTestVillain] = useState<VillainKey>(humanVillainKey)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  // Mère Gothel — Couronne : instanceId en attente de confirmation de défausse (→ 1 Confiance).
  const [crownConfirm, setCrownConfirm] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  // Réseau : confirmation avant de quitter la partie (l'autre joueur sera prévenu).
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  // Intro de début de partie : la séquence « X contre X » + jet de dé se joue
  // TOUJOURS en entrant dans une partie (y compris en mode test ou après un
  // rechargement). En réseau : présentation « versus » SANS jet de dé (v1 :
  // l'hôte commence — activePlayer 0).
  const [startRollDone, setStartRollDone] = useState(false)
  // Distribution d'OUVERTURE : avant le tout premier tour, la main de départ est
  // piochée carte par carte (vol + retournement au centre + son), au lieu d'apparaître
  // d'un bloc. `openingDealDone` débloque le bot, le splash « À vous de jouer » et le
  // chrono une fois la distribution terminée. `dealOverlay` porte les données de
  // l'overlay (cartes + rectangles) ; `dealHiddenIds` masque dans l'éventail les cartes
  // encore en vol (révélées une à une à leur atterrissage).
  const [openingDealDone, setOpeningDealDone] = useState(false)
  const [dealOverlay, setDealOverlay] = useState<{
    key: number
    cards: DealCard[]
    isOpening: boolean
    // Bloque le tour (bot en pause + splash « À vous de jouer » différé) le temps de
    // l'animation. Vrai pour MA pioche (révélation plein écran) et l'ouverture ; faux pour
    // la pioche de l'adversaire (discrète, sur son plateau → ne doit pas figer le jeu).
    blocking: boolean
  } | null>(null)
  const [dealHiddenIds, setDealHiddenIds] = useState<string[]>([])
  const openingStartedRef = useRef(false)
  const dealKeyRef = useRef(0)
  // Affiche « À vous de jouer » (4 s) au début de chaque tour du joueur humain.
  const [showTurnSplash, setShowTurnSplash] = useState(false)
  // L'Imposteur — bandeau « DEAD BODY REPORTED » (Corps découvert), affiché ~2,4 s.
  const [showDeadBody, setShowDeadBody] = useState(false)
  // L'Imposteur — bandeau « EMERGENCY MEETING » (Réunion d'urgence), affiché ~2,4 s.
  const [showEmergency, setShowEmergency] = useState(false)
  const lastHumanTurnRef = useRef<number | null>(null)
  // Minuteur de masquage du splash « À vous de jouer », conservé dans une ref pour qu'un
  // re-rendu quelconque ne l'annule pas (sinon le splash resterait affiché au tour adverse).
  const splashTimerRef = useRef<number | null>(null)
  // Sombra — son « Lieu piraté » : on le joue dès qu'une nouvelle « piraterie »
  // apparaît (action désactivée par un Piratage OU Héros piraté par Boop), tous
  // joueurs confondus. Un compteur suivi par ref évite de le rejouer à chaque rendu.
  const hackCountRef = useRef<number | null>(null)
  // Vilain du joueur local (siège HUMAN), suivi par un ref pour être lu dans des
  // effets sans les faire dépendre de `state.players` (référence changeante).
  const humanVillainKeyRef = useRef<VillainKey | null>(null)
  // Choix de la carte à activer quand plusieurs sont activables (action « Activer »).
  const [activatePick, setActivatePick] = useState<{ actionId: string } | null>(null)
  // Le Seigneur des clés — Sorcellerie : clé choisie (couleur) en attente du lieu où la reposer.
  const [stealKeyId, setStealKeyId] = useState<string | null>(null)
  // Le Seigneur des clés — Plaisir ou souffrance (reposer une clé) : clé choisie en
  // attente du lieu de dépose (< 3 clés).
  const [loseKeyId, setLoseKeyId] = useState<string | null>(null)
  // Glisser-déposer d'une carte de la main vers le plateau : instanceId en cours de glissé.
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  // Message transitoire « pourquoi cette carte est injouable » (saisie d'une carte non
  // jouable). S'efface seul après quelques secondes.
  const [unplayableMsg, setUnplayableMsg] = useState<string | null>(null)
  const unplayableTimer = useRef<number | null>(null)
  // Son « cristal » quand le Pouvoir du joueur humain AUGMENTE (gain ≥1 jeton).
  const prevHumanPowerRef = useRef<number | null>(null)
  const showUnplayable = (reason: string) => {
    setUnplayableMsg(reason)
    playNoCanDo()
    if (unplayableTimer.current) window.clearTimeout(unplayableTimer.current)
    unplayableTimer.current = window.setTimeout(() => setUnplayableMsg(null), 4000)
  }
  // Fantôme suivant le curseur pendant le glissé (clone de la carte). On ne stocke en
  // state que l'instanceId + la position initiale (montage du portail) ; la position LIVE
  // est pilotée en impératif via un ref + une boucle rAF (pas de re-render par pointermove).
  // `pawnSrc` non vide → le fantôme est le PION (déplacement), pas une carte.
  const [dragGhost, setDragGhost] = useState<{ instanceId: string; x: number; y: number; pawnSrc?: string } | null>(null)
  // Vrai pendant qu'on glisse le pion (masque le pion réel ; le fantôme le remplace).
  const [draggingPawn, setDraggingPawn] = useState(false)
  // Lieu survolé pendant le glissé (surbrillance) et lieu où la pose vient d'avoir lieu (pulse).
  const [dragOverLoc, setDragOverLoc] = useState<string | null>(null)
  const [dropPulseLoc, setDropPulseLoc] = useState<string | null>(null)
  const dragInstanceRef = useRef<string | null>(null)
  // Source du glissé en cours : 'play' (carte de la main) ou 'move' (Allié/Objet du plateau).
  const dragKindRef = useRef<'play' | 'move' | 'pawn' | 'hero'>('play')
  const dragGhostElRef = useRef<HTMLImageElement | null>(null)
  const dragTargetRef = useRef({ x: 0, y: 0 }) // position visée (curseur)
  const dragRenderRef = useRef({ x: 0, y: 0 }) // position rendue (rattrape la cible avec inertie)
  const dragRafRef = useRef<number | null>(null)
  // Le Seigneur des clés — animation du lancer de dé. On affiche l'anim tant que le
  // dernier lancer humain n'a pas été « acquitté » (dieDismissSeq). État dérivé (pas
  // d'effet) : `dieAnim` est vrai dès qu'un nouveau lancer arrive et faux après onDone.
  const [dieDismissSeq, setDieDismissSeq] = useState(0)
  const dieAnim = !!state.dieRoll && state.dieRoll.by === HUMAN && state.dieRoll.seq !== dieDismissSeq
  // Oogie Boogie — animation auto-dismiss des lancers de 2 dés NON interactifs (bot,
  // Conditions) : on l'affiche tant que le dernier lancer n'est pas acquitté ET qu'il
  // n'y a pas de résolution interactive en cours pour l'humain.
  const [diceDismissSeq, setDiceDismissSeq] = useState(0)
  const humanDice = !!state.pendingDice && state.pendingDice.playerIndex === HUMAN
  // Toast auto-dismiss : tout lancer NON résolu par la modale interactive (bot, ou
  // Condition de l'humain comme Joyeux Halloween! qui se résout immédiatement sans
  // `pendingDice`). On marque le seq comme acquitté à la confirmation d'un lancer
  // interactif humain (cf. onConfirm) pour ne pas le ré-afficher en toast ensuite.
  const diceAnim = !!state.diceRoll && !humanDice && state.diceRoll.seq !== diceDismissSeq
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
  // MODE TEST : illumine TOUTES les actions des deux plateaux (outil de calage des
  // positions des boutons d'action). Sur le plateau JOUEUR, mode ÉDITION : on clique une
  // pastille pour la sélectionner, puis on ajuste sa position (top/left) en direct.
  const [highlightActions, setHighlightActions] = useState(false)
  // Positions de travail de l'éditeur (clé `locId:actionId` → {x,y} en %).
  const [actionEdit, setActionEdit] = useState<Record<string, { x: number; y: number }>>({})
  // Action sélectionnée dans l'éditeur.
  const [selectedAction, setSelectedAction] = useState<{ key: string; locName: string; label: string } | null>(null)
  // Vilain dont on édite les positions dans le modal (select). Défini à l'ouverture.
  const [editVillain, setEditVillain] = useState<VillainKey>('princeJohn')
  // Message de retour du bouton « Sauvegarder les positions ».
  const [savePosMsg, setSavePosMsg] = useState<string | null>(null)
  // MODE TEST : éditeur de TAILLE DU PION (curseur). `pawnEdit` = vilain édité + taille de
  // travail (px) ; null = éditeur fermé. La taille est prévisualisée en direct sur le plateau.
  const [pawnEdit, setPawnEdit] = useState<{ villain: VillainKey; size: number } | null>(null)
  // Message de retour du bouton « Sauvegarder la taille du pion ».
  const [savePawnMsg, setSavePawnMsg] = useState<string | null>(null)
  // MODE TEST : ouverture de l'éditeur de portrait (collaborateurs uniquement).
  const [portraitEdit, setPortraitEdit] = useState(false)
  // MODE TEST : ouverture de l'éditeur de couleur du méchant (tous les vilains).
  const [colorEdit, setColorEdit] = useState(false)
  // Écrit `pawnHeightPx` dans le fichier du vilain (via l'endpoint dev de Vite).
  const savePawnSize = async () => {
    if (!pawnEdit) return
    setSavePawnMsg('Sauvegarde…')
    try {
      const res = await fetch('/__save-pawn-size', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villain: VILLAIN_REGISTRY[pawnEdit.villain].def.id, size: pawnEdit.size }),
      })
      setSavePawnMsg(res.ok ? '✓ Sauvegardé' : `Échec : ${await res.text()}`)
    } catch {
      setSavePawnMsg('Erreur réseau (serveur de dév requis).')
    }
  }
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
  // Animation de PIOCHE (joueur ET adversaire) : quand de nouvelles cartes apparaissent
  // dans une main, elles sont révélées une à une via l'overlay `OpeningDeal` — vol depuis
  // la pioche → agrandissement au centre → rangement dans l'éventail, un son par carte.
  // Côté JOUEUR : face visible (lisible) ; côté ADVERSAIRE : `faceDown` (on ne voit que
  // le dos). Même mécanique pour la distribution d'ouverture.
  const handIdsRef = useRef<Set<string>>(new Set(state.players[HUMAN].hand.map((c) => c.instanceId)))
  // Construit les trajectoires (specs) pour `cardsToReveal` de `playerIndex` (mesure de la
  // pioche + des cases de l'éventail). `faceDown` (adversaire) → on ne montre que le dos,
  // révélation au centre de SON plateau et plus petite (discrète) ; sinon (joueur) →
  // grande, au centre de l'écran (lisible). Renvoie null si rien à animer.
  const buildDealSpecs = (
    playerIndex: number,
    cardsToReveal: CardInstance[],
    back: string,
    faceDown: boolean,
    holdMs: number,
    cadence: number,
  ): DealCard[] | null => {
    const pileEl = document.querySelector(`[data-deck-pile="${playerIndex}"]`)
    if (cardsToReveal.length === 0 || !back || !pileEl) return null
    // Départ = taille/position RÉELLES de la pioche Vilain (la carte colle au sommet du paquet).
    const pr = (pileEl as HTMLElement).getBoundingClientRect()
    const pile: FlightRect = { left: pr.left, top: pr.top, width: pr.width, height: pr.height }
    // JOUEUR (face visible) → grand agrandissement au centre de l'écran (lisible).
    // ADVERSAIRE (dos) → AUCUN détour par le centre : la carte file directement de la
    // pioche vers sa main (petite, rapide). On ne voit que le dos, rien à lire ; cela
    // évite toute carte qui « resterait » au milieu.
    const screenCenter: FlightRect = (() => {
      const ch = Math.min(window.innerHeight * 0.46, 440)
      const cw = ch / 1.4
      return { left: window.innerWidth / 2 - cw / 2, top: window.innerHeight / 2 - ch / 2, width: cw, height: ch }
    })()
    // Adversaire : taille alignée sur ses dos de main (w-24 ≈ 96 px) → révélation sans à-coup.
    const slotW = faceDown ? 96 : 120
    const slotH = slotW * 1.4
    return cardsToReveal.map((c, k) => {
      const el = document.querySelector(`[data-hand-card="${c.instanceId}"]`)
      const def = getCardDef(c.cardId)
      const r = el ? (el as HTMLElement).getBoundingClientRect() : null
      const slot: FlightRect = r
        ? { left: r.left + r.width / 2 - slotW / 2, top: r.top + r.height / 2 - slotH / 2, width: slotW, height: slotH }
        : pile
      return {
        instanceId: c.instanceId,
        image: faceDown ? back : def?.image ?? back, // adversaire : dos uniquement
        back,
        pile,
        // Adversaire : pas d'arrêt central → le point « central » EST sa case de main.
        center: faceDown ? slot : screenCenter,
        slot,
        faceDown,
        holdMs,
        startDelay: k * cadence,
      }
    })
  }
  // Lance une distribution (mesure au frame suivant, après peinture). Plusieurs « groupes »
  // (joueurs) sont animés SIMULTANÉMENT dans un même overlay (ex. ouverture : ma main au
  // centre + celle du bot sur son plateau). Pour rester EN PHASE quand plusieurs joueurs
  // sont distribués ensemble, on impose un maintien et une cadence COMMUNS (la carte n° k
  // de chacun part au même instant).
  const launchDeal = (
    groups: { playerIndex: number; cards: CardInstance[]; back: string; faceDown: boolean }[],
    opts: { isOpening: boolean; blocking: boolean },
  ) => {
    const raf = requestAnimationFrame(() => {
      // Maintien : JOUEUR (face visible) → 620 ms au centre, le temps de lire ; ADVERSAIRE
      // (dos) → 0 (il file dans sa main sans stationner). La CADENCE est commune (la plus
      // longue) pour que, à l'ouverture, la carte n° k de chacun parte au même instant.
      const groupHold = (g: { faceDown: boolean }) => (g.faceDown ? 0 : 620)
      const cadence = DEAL_FLY_IN + Math.max(...groups.map(groupHold))
      const specs: DealCard[] = []
      for (const g of groups) {
        const s = buildDealSpecs(g.playerIndex, g.cards, g.back, g.faceDown, groupHold(g), cadence)
        if (s) specs.push(...s)
      }
      if (specs.length === 0) {
        if (opts.isOpening) setOpeningDealDone(true)
        return
      }
      setDealHiddenIds(specs.map((s) => s.instanceId))
      setDealOverlay({ key: ++dealKeyRef.current, cards: specs, isOpening: opts.isOpening, blocking: opts.blocking })
    })
    return () => cancelAnimationFrame(raf)
  }
  // Pioche en cours de partie — JOUEUR (face visible).
  useEffect(() => {
    const human = state.players[HUMAN]
    const cur = human.hand.map((c) => c.instanceId)
    const added = cur.filter((id) => !handIdsRef.current.has(id))
    handIdsRef.current = new Set(cur)
    if (added.length === 0) return
    if (testMode) return // mode test : les cartes apparaissent directement, sans animation de pioche
    if (!startRollDone || !openingDealDone) return // l'ouverture est gérée séparément
    const cards = human.hand.filter((c) => added.includes(c.instanceId) && !c.isOmnidroid)
    if (cards.length === 0) return
    return launchDeal([{ playerIndex: HUMAN, cards, back: human.backVillainImage, faceDown: false }], { isOpening: false, blocking: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.players[HUMAN].hand, startRollDone, openingDealDone, testMode])
  // NB : l'adversaire (bot) n'a PAS d'animation de pioche — ses cartes (dos secrets)
  // apparaissent directement dans sa main. L'animation volante pour le bot provoquait un
  // bug récurrent (carte qui restait figée dans sa main) sans réelle valeur (rien à révéler
  // sur un dos). Seules MES pioches sont animées.
  // Distribution d'OUVERTURE (MA main uniquement) : à la fin du jet de dés, ma main de départ
  // (déjà présente dans l'état) est révélée carte par carte au centre. (Sur « Rejouer » App
  // reste monté et `startRollDone` reste vrai → l'intro et cette distribution sont sautées ;
  // une vraie nouvelle partie remonte App.)
  useEffect(() => {
    if (!startRollDone || openingStartedRef.current) return
    openingStartedRef.current = true
    if (testMode) {
      const raf = requestAnimationFrame(() => setOpeningDealDone(true))
      return () => cancelAnimationFrame(raf)
    }
    const human = state.players[HUMAN]
    return launchDeal(
      [{ playerIndex: HUMAN, cards: human.hand.filter((c) => !c.isOmnidroid), back: human.backVillainImage, faceDown: false }],
      { isOpening: true, blocking: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRollDone, testMode])
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

  // Gain de Pouvoir du joueur humain → son « mana_crystal_add ». On compare au Pouvoir
  // précédent ; on ne joue QUE sur une hausse (pas à la dépense ni au montage initial).
  useEffect(() => {
    const cur = state.players[HUMAN]?.power ?? 0
    const prev = prevHumanPowerRef.current
    prevHumanPowerRef.current = cur
    if (prev !== null && cur > prev) playManaAdd()
  }, [state.players, HUMAN])

  // Boucle sonore tant qu'une carte de la MAIN est tenue au curseur (drag 'play').
  // S'arrête dès le lâcher/annulation (draggingCardId repasse à null) ou pour un glissé
  // de plateau (Héros/Allié/Objet, dragKindRef ≠ 'play').
  useEffect(() => {
    if (draggingCardId && dragKindRef.current === 'play') startCardDragLoop()
    else stopCardDragLoop()
  }, [draggingCardId])
  // Sécurité : couper la boucle si le composant est démonté en plein glissé.
  useEffect(() => () => stopCardDragLoop(), [])

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
    if (testMode || !startRollDone || !openingDealDone) return
    if (dealOverlay?.blocking) return // MA pioche plein écran en cours : on patiente
    if (state.status !== 'PLAYING' || state.activePlayer !== HUMAN) return
    if (lastHumanTurnRef.current === state.turn) return
    lastHumanTurnRef.current = state.turn
    setShowTurnSplash(true)
    // Alerte sonore « À vous de jouer » — sauf si on incarne L'Imposteur (qui a
    // sa propre ambiance Among Us).
    if (humanVillainKeyRef.current !== 'imposteur') playYourTurn()
    // Minuteur conservé dans une ref : il n'est PAS annulé par les re-rendus suivants
    // (sinon, à la fin d'un tour rapide, le splash ne se masquerait jamais et resterait
    // affiché pendant le tour adverse). Il n'est ré-armé qu'au prochain tour du joueur.
    if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current)
    splashTimerRef.current = window.setTimeout(() => setShowTurnSplash(false), 4000)
  }, [state.activePlayer, state.turn, state.status, startRollDone, openingDealDone, dealOverlay, testMode, HUMAN])

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

  // --- Récap « tour adverse » ------------------------------------------------
  // Bande O — O — O — O des actions de l'adversaire, figée à la fin de son tour
  // (state.lastTurnEvents). On NE l'ouvre PAS automatiquement : seul le bouton
  // « Récap. tour adverse » l'affiche, à la demande du joueur.
  const [recapOpen, setRecapOpen] = useState(false)
  const lastTurn = state.lastTurnEvents
  // Récap pertinent = celui de l'ADVERSAIRE (pas le récap de nos propres tours).
  const opponentRecap = lastTurn && lastTurn.playerIndex === BOT ? lastTurn : null

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

  // --- MODE TEST : éditeur de positions des actions (n'importe quel vilain) ---------
  // Vilain dont on édite le plateau dans le modal (par défaut celui du joueur).
  const editDef = VILLAIN_REGISTRY[editVillain].def
  // (Ré)initialise les positions de travail depuis ACTION_POS pour un vilain donné.
  const initActionEditFor = (key: VillainKey) => {
    const layout = getVillainActionPos(VILLAIN_REGISTRY[key].def.id) ?? {}
    const flat: Record<string, { x: number; y: number }> = {}
    for (const [lid, acts] of Object.entries(layout))
      for (const [aid, p] of Object.entries(acts)) flat[`${lid}:${aid}`] = { x: p.x, y: p.y }
    setActionEdit(flat)
    setSelectedAction(null)
    setSavePosMsg(null)
  }
  // Ouvre/ferme le modal d'édition (à l'ouverture : cible le vilain du joueur).
  const toggleHighlightActions = () =>
    setHighlightActions((on) => {
      const next = !on
      if (next) {
        const key = villainKeyOf(user.villain)
        setEditVillain(key)
        initActionEditFor(key)
      }
      return next
    })
  // Changement de vilain dans le select du modal.
  const selectEditVillain = (key: VillainKey) => {
    setEditVillain(key)
    initActionEditFor(key)
  }
  // Sélection d'une pastille (clic sur le plateau).
  const handleSelectActionPos = (locationId: string, actionId: string, label: string, locationName: string) =>
    setSelectedAction({ key: `${locationId}:${actionId}`, locName: locationName, label })
  // Modifie une coordonnée de l'action sélectionnée (déplacement en direct).
  const updateActionPos = (axis: 'x' | 'y', value: number) => {
    if (!selectedAction || Number.isNaN(value)) return
    setActionEdit((m) => ({ ...m, [selectedAction.key]: { ...m[selectedAction.key], [axis]: value } }))
  }
  // Déplacement par GLISSER d'une pastille (curseur) → positionne l'action en direct.
  const handleMoveActionPos = (locationId: string, actionId: string, x: number, y: number) =>
    setActionEdit((m) => ({
      ...m,
      [`${locationId}:${actionId}`]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
    }))
  // Construit le bloc `ACTION_POS['<vilain>'] = { … }` (ordre des lieux/actions du vilain édité).
  const buildActionPosBlock = (): string => {
    const tok = (id: string) => (/^[a-zA-Z_$][\w$]*$/.test(id) ? id : `'${id}'`)
    const r = (n: number) => Math.round(n * 10) / 10
    const body = editDef.locations
      .map((loc) => {
        const acts = loc.actions
          .map((a) => {
            const p = actionEdit[`${loc.id}:${a.id}`]
            return p ? `    ${tok(a.id)}: { x: ${r(p.x)}, y: ${r(p.y)} },` : null
          })
          .filter(Boolean)
          .join('\n')
        return `  ${tok(loc.id)}: {\n${acts}\n  },`
      })
      .join('\n')
    return `ACTION_POS['${editDef.id}'] = {\n${body}\n}`
  }
  // Écrit les positions directement dans BoardActions.tsx (via l'endpoint dev de Vite).
  const saveActionPositions = async () => {
    setSavePosMsg('Sauvegarde…')
    try {
      const res = await fetch('/__save-action-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villain: editDef.id, block: buildActionPosBlock() }),
      })
      setSavePosMsg(res.ok ? '✓ Sauvegardé dans BoardActions.tsx' : `Échec : ${await res.text()}`)
    } catch {
      setSavePosMsg('Erreur réseau (serveur de dév requis).')
    }
  }
  // Couleurs des deux vilains en présence (repli sur teintes neutres si inconnue).
  const userColor = VILLAIN_COLOR[user.villain] ?? DEFAULT_TINT_A
  const botColor = VILLAIN_COLOR[bot.villain] ?? DEFAULT_TINT_B
  // Sous-titres + avatars des panneaux : pseudo du joueur local (avec son avatar de
  // profil) ; « Ordinateur » pour un bot (avec la vignette de son vilain) ; nom + avatar
  // du lobby pour un adversaire réseau.
  const oppSeatInfo = lobby?.find((s) => s.seat === BOT)
  const oppIsBot = seats[BOT] === 'bot'
  const userSubLabel = myProfileName.trim() || undefined
  const oppSubLabel = oppIsBot ? 'Ordinateur' : oppSeatInfo?.name?.trim() || 'Adversaire'
  const oppAvatar = oppIsBot ? (
    <Avatar villain={villainKeyOf(bot.villain)} color={botColor} size={36} />
  ) : (
    <Avatar
      villain={(oppSeatInfo?.avatarVillain as VillainKey | null) ?? villainKeyOf(bot.villain)}
      color={oppSeatInfo?.avatarColor ?? botColor}
      size={36}
    />
  )
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
    isHumanTurn && Object.values(user.board).some((cards) => cards.some((c) => c.type === 'hero' && !c.isPrisoner))
  // Roi Richard / Tirelire chez le joueur humain → ses Événements sont injouables.
  const humanEventsBlocked = isHumanTurn && Object.values(user.board).flat().some((c) => c.type === 'hero' && c.blocksVillainEvents)
  // Flora chez le bot → sa main est révélée à l'humain (Flora rend la main publique).
  const botHandRevealed = hasHeroInRealm(state, BOT, 'flora')
  // Conditions jouables par l'humain pendant le tour du bot (D — réaction).
  const humanReactions: CardInstance[] = !isHumanTurn ? playableConditions(state, HUMAN) : []
  // Clé de réaction : le tour + l'ENSEMBLE des Conditions actuellement déclenchables.
  // « Passer » ne verrouille QUE cet ensemble : si une NOUVELLE Condition devient
  // jouable plus tard dans le tour adverse (ex. « Pas si vite ! » dès qu'il lance une
  // Fatalité), la fenêtre de réaction revient au lieu de rester verrouillée.
  const reactionKey = `${turnKey}:${humanReactions.map((c) => c.instanceId).sort().join(',')}`
  const reactionPassed = passedTurnKey === reactionKey
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
    if (!openingDealDone) return // distribution d'ouverture en cours (cartes révélées une à une)
    if (dealOverlay?.blocking) return // MA pioche (plein écran) en cours : on patiente (pas la pioche adverse, discrète)
    // Gaston — retrait/replacement de jetons Obstacle. Bot → retire en priorité les
    // lieux non vidables par un Vanquish (Taverne/Bois) ; replace en dispersant (lieu
    // le plus vide d'abord) ; humain → bandeau de lieux.
    const pob = state.pendingObstacle
    if (pob) {
      if (seats[pob.chooserIndex] === 'bot') {
        const tp = state.players[pob.targetIndex]
        const ids = tp.locations.map((l) => l.id)
        let locId: string | undefined
        if (pob.kind === 'remove') {
          const pref = ['taverne', 'bois', 'maison-belle', 'chateau-bete']
          locId = ids
            .filter((id) => (tp.obstacles?.[id] ?? 0) > 0 && (!pob.sameLocation || !pob.lockedLocationId || pob.lockedLocationId === id))
            .sort((a, b) => (pref.indexOf(a) + 9) % 9 - ((pref.indexOf(b) + 9) % 9))[0]
        } else {
          locId = ids
            .filter((id) => (tp.obstacles?.[id] ?? 0) < 2)
            .sort((a, b) => (tp.obstacles?.[a] ?? 0) - (tp.obstacles?.[b] ?? 0))[0]
        }
        const timer = setTimeout(() => (locId ? resolveObstacle(locId) : doneObstacle()), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Le Seigneur des clés — choix d'une clé (pendingKey). Bot → RAMASSE de préférence
    // une couleur encore absente ; REPOSE de préférence un doublon (pour ne perdre
    // aucune couleur). Humain → bandeau / clic direct sur le plateau.
    const pky = state.pendingKey
    if (pky) {
      if (seats[pky.playerIndex] === 'bot') {
        const p = state.players[pky.playerIndex]
        const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
        let pick: string | undefined
        if (pky.kind === 'take') {
          const ownedColors = new Set(owned.map((k) => k.color))
          const cands = (p.keys ?? []).filter(
            (k) =>
              k.location !== null && !k.stolenBy &&
              (pky.locationId === undefined || k.location === pky.locationId) &&
              (pky.color === undefined || k.color === pky.color),
          )
          pick = (cands.find((k) => !ownedColors.has(k.color)) ?? cands[0])?.id
        } else {
          const count: Record<string, number> = {}
          for (const k of owned) count[k.color] = (count[k.color] ?? 0) + 1
          pick = [...owned].sort((a, b) => count[b.color] - count[a.color])[0]?.id
        }
        if (pick) {
          const id = pick
          // Perte avec choix du lieu (Plaisir) : repose sur un lieu < 3 clés (le lieu
          // du pion si possible, sinon le plus proche) pour le récupérer facilement.
          let dest: string | undefined
          if (pky.kind === 'lose' && pky.chooseDest) {
            const order = p.locations.map((l) => l.id)
            const room = order.filter((lid) => (p.keys ?? []).filter((k) => k.location === lid && !k.stolenBy).length < 3)
            const pawnIdx = order.indexOf(p.pawnLocation ?? order[0])
            dest = room.includes(p.pawnLocation ?? '') ? p.pawnLocation! : [...room].sort((a, b) => Math.abs(order.indexOf(a) - pawnIdx) - Math.abs(order.indexOf(b) - pawnIdx))[0]
          }
          const timer = setTimeout(() => resolveKey(id, dest), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Le Seigneur des clés — choix d'une couleur avant le dé (pendingKeyColor). Bot →
    // vise une couleur manquante de préférence présente sur le plateau. Humain → bandeau.
    const pkc = state.pendingKeyColor
    if (pkc) {
      if (seats[pkc.playerIndex] === 'bot') {
        const COLORS = ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange'] as KeyColor[]
        const p = state.players[pkc.playerIndex]
        const owned = new Set((p.keys ?? []).filter((k) => k.location === null && !k.stolenBy).map((k) => k.color))
        const onBoard = new Set((p.keys ?? []).filter((k) => k.location !== null && !k.stolenBy).map((k) => k.color))
        const needed = COLORS.filter((c) => !owned.has(c))
        const choice = needed.find((c) => onBoard.has(c)) ?? needed[0] ?? COLORS[0]
        const timer = setTimeout(() => resolveKeyColor(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Le Seigneur des clés — Plaisir ou souffrance (pendingPlaisir). Bot → repose une
    // clé s'il a un doublon (couleur préservée), sinon perd du Pouvoir si possible.
    const ppl = state.pendingPlaisir
    if (ppl) {
      if (seats[ppl.playerIndex] === 'bot') {
        const p = state.players[ppl.playerIndex]
        const owned = (p.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
        const count: Record<string, number> = {}
        for (const k of owned) count[k.color] = (count[k.color] ?? 0) + 1
        const hasDuplicate = Object.values(count).some((n) => n >= 2)
        const choice: 'power' | 'key' = hasDuplicate ? 'key' : p.power >= ppl.power ? 'power' : 'key'
        const timer = setTimeout(() => resolvePlaisir(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Le Seigneur des clés — Sorcellerie / Gévaudan (pendingStealKey). Le CHOOSER (adversaire
    // du Seigneur) choisit la clé la plus dommageable (couleur unique), reposée au plus loin
    // du pion pour 'return'. Humain → bandeau ; bot → auto.
    const psk = state.pendingStealKey
    if (psk) {
      if (seats[psk.chooserIndex] === 'bot') {
        const t = state.players[psk.targetIndex]
        const owned = (t.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
        if (owned.length > 0) {
          const count: Record<string, number> = {}
          for (const k of owned) count[k.color] = (count[k.color] ?? 0) + 1
          const victim = [...owned].sort((a, b) => count[a.color] - count[b.color])[0]
          const locs = t.locations.map((l) => l.id)
          const pawnIdx = locs.indexOf(t.pawnLocation ?? locs[0])
          const dest = [...locs].sort((a, b) => Math.abs(locs.indexOf(b) - pawnIdx) - Math.abs(locs.indexOf(a) - pawnIdx))[0]
          const timer = setTimeout(
            () => resolveStealKey(victim.id, psk.mode === 'return' ? dest : undefined),
            BOT_STEP_MS,
          )
          return () => clearTimeout(timer)
        }
      }
      return
    }
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
    // Le Grand Génie du Mal : piocher 2 cartes OU gagner 2 Pouvoir. Bot →
    // heuristique (pioche si la main est courte, < 3 cartes) ; humain → modale.
    const pdgp = state.pendingDrawOrGainPower
    if (pdgp) {
      if (seats[pdgp.playerIndex] === 'bot') {
        const choice = state.players[pdgp.playerIndex].hand.length >= 3 ? 'power' : 'draw'
        const timer = setTimeout(() => resolveDrawOrGainPower(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Mémoire Verrouillée : Pouvoir OU reculer le jeton Pilote. Bot → recule le Pilote
    // s'il est devant King Candy (le freiner), sinon prend le Pouvoir ; humain → modale.
    const pprb = state.pendingPowerOrRacerBack
    if (pprb) {
      if (seats[pprb.playerIndex] === 'bot') {
        const p = state.players[pprb.playerIndex]
        const choice = (p.racerPos ?? 0) > (p.trackPos ?? 0) ? 'racer' : 'power'
        const timer = setTimeout(() => resolvePowerOrRacerBack(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // C'est votre dernière chance : choix action gratuite Déplacer/Activer. Bot →
    // préfère Activer si possible (effet souvent plus fort), sinon Déplacer ; humain → modale.
    const pmoa = state.pendingMoveOrActivate
    if (pmoa) {
      if (seats[pmoa.playerIndex] === 'bot') {
        const choice = activatableCards(state).length > 0 ? 'activate' : 'move'
        const timer = setTimeout(() => resolveMoveOrActivate(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Le Seigneur des Ténèbres : choix Chaudron/Pouvoir. Bot → s'empare du Chaudron
    // (toujours utile tant qu'il ne l'a pas) ; humain → modale.
    const pcc = state.pendingCauldronChoice
    if (pcc) {
      if (seats[pcc.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveCauldronChoice('cauldron'), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Tamatoa : « Pas exactement l'heure de Maui ». Bot → joue la carte Maui dévoilée si
    // elle l'aide (Pouvoir / Force aux Alliés), sinon la défausse ; humain → modale.
    const pmaui = state.pendingMauiChoice
    if (pmaui) {
      if (seats[pmaui.playerIndex] === 'bot') {
        const top = state.players[pmaui.playerIndex].mauiDeck?.[0]
        const beneficial = new Set(['poisson-maui', 'etoile-de-mer-maui', 'tete-de-requin-maui', 'queue-de-requin-maui'])
        const choice = top && beneficial.has(top.cardId) ? 'play' : 'discard'
        const timer = setTimeout(() => resolveMauiChoice(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Dio — Vampirisme : choisir un Allié à défausser. Bot → le plus faible (sacrifice
    // minimal) ; humain → modale.
    const pdda = state.pendingDioDiscardAlly
    if (pdda) {
      if (seats[pdda.playerIndex] === 'bot') {
        const p = state.players[pdda.playerIndex]
        const allies = Object.values(p.board).flat().filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket && !c.cannotBeDiscarded)
        const pick = [...allies].sort((a, b) => (effectiveStrength(state, pdda.playerIndex, a.instanceId) ?? 0) - (effectiveStrength(state, pdda.playerIndex, b.instanceId) ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveDioDiscardAlly(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Dio — CREAM : choisir un Héros à défausser. Bot → le plus fort éligible ; humain → modale.
    const pdc = state.pendingDioCream
    if (pdc) {
      if (seats[pdc.playerIndex] === 'bot') {
        const pick = [...pdc.candidateIds].sort((a, b) => (effectiveStrength(state, pdc.playerIndex, b) ?? 0) - (effectiveStrength(state, pdc.playerIndex, a) ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveDioCream(pick), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Dio — MUDA! : éliminer un Héros (facultatif). Bot → le plus fort ; humain → modale.
    const pdm = state.pendingDioMuda
    if (pdm) {
      if (seats[pdm.playerIndex] === 'bot') {
        const pick = [...pdm.candidateIds].sort((a, b) => (effectiveStrength(state, pdm.playerIndex, b) ?? 0) - (effectiveStrength(state, pdm.playerIndex, a) ?? 0))[0]
        const timer = setTimeout(() => resolveDioMuda(pick), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Dio — Quête vers le paradis : choisir Objet/Événement. Bot → le type le plus nombreux
    // en défausse ; humain → modale.
    const pdq = state.pendingDioQuest
    if (pdq) {
      if (seats[pdq.playerIndex] === 'bot') {
        const disc = state.players[pdq.playerIndex].discard
        const items = disc.filter((c) => c.type === 'item').length
        const effs = disc.filter((c) => c.type === 'effect').length
        const choice: 'item' | 'effect' = items >= effs ? 'item' : 'effect'
        const timer = setTimeout(() => resolveDioQuest(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Dio — Lumière du Soleil (Fatalité) : Dio choisit défausser sa main OU perdre du Pouvoir.
    // Bot → garde sa main s'il a assez de Pouvoir (perd le Pouvoir), sinon défausse ; humain → modale.
    const pds = state.pendingDioSunlight
    if (pds) {
      if (seats[pds.playerIndex] === 'bot') {
        const choice = state.players[pds.playerIndex].power >= pds.lose ? 'lose' : 'discard'
        const timer = setTimeout(() => resolveDioSunlight(choice), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Le Seigneur des Ténèbres : choix « Nous avons conclu un marché ! ». Bot → défausse
    // l'Épée Magique pour s'emparer du Chaudron (haute valeur) ; humain → modale.
    const pbargain = state.pendingBargainChoice
    if (pbargain) {
      if (seats[pbargain.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveBargainChoice('sword'), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Le Seigneur des Ténèbres : jeu gratuit d'un Objet. Bot → joue le 1er Objet sur un
    // lieu non interdit (de préférence sans déjà ce Squelettes) ; humain → modale.
    const pfip = state.pendingFreeItemPlay
    if (pfip) {
      if (seats[pfip.playerIndex] === 'bot') {
        const pl = state.players[pfip.playerIndex]
        const item = pl.hand.find((c) => c.type === 'item')
        const locked = new Set(pl.lockedLocations ?? [])
        const loc = item
          ? pl.locations.find((l) => !locked.has(l.id) && !(pl.board[l.id] ?? []).some((c) => c.type === 'hero' && c.blocksItemPlacement === item.cardId))
          : undefined
        const timer = setTimeout(
          () => (item && loc ? resolveFreeItemPlay(item.instanceId, loc.id) : skipFreeItemPlay()),
          BOT_STEP_MS,
        )
        return () => clearTimeout(timer)
      }
      return
    }
    // Je ne reviens jamais : réorganisation Fatalité. Bot → garde l'ordre ; humain → modale.
    const pfr = state.pendingFateReorder
    if (pfr) {
      if (seats[pfr.playerIndex] === 'bot') {
        const ids = pfr.cards.map((c) => c.instanceId)
        const timer = setTimeout(() => resolveFateReorder(ids), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Lance-moi ta chevelure : choisir de combien de lieux ramener Raiponce vers la
    // Tour. Bot → ramène au plus près de la Tour (nombre de lieux maximal) ; humain → modale.
    const prh = state.pendingRaiponceHomeward
    if (prh) {
      if (seats[prh.chooserIndex] === 'bot') {
        const steps = Math.max(...prh.options.map((o) => o.steps))
        const timer = setTimeout(() => resolveRaiponceHomeward(steps), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Frères Stabbington : ramener Raiponce sur la Tour ? Bot → oui (la Tour la rapproche
    // des gains de Confiance et évite la dérive vers Corona) ; humain → modale.
    const prt = state.pendingRaiponceToTower
    if (prt) {
      if (seats[prt.chooserIndex] === 'bot') {
        const timer = setTimeout(() => resolveRaiponceToTower(true), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Cruella — choisir une Tuile Chiots de la réserve. Bot → la plus grosse valeur
    // (en privilégiant une tuile déjà révélée) ; humain → modale.
    const ppa = state.pendingPuppyAdd
    if (ppa) {
      if (seats[ppa.playerIndex] === 'bot') {
        const tiles = (state.players[ppa.playerIndex].puppyTiles ?? []).filter((t) => ppa.candidateTileIds.includes(t.id))
        const best = [...tiles].sort((a, b) => (Number(b.revealed) - Number(a.revealed)) || (b.value - a.value))[0]
        if (best) {
          const timer = setTimeout(() => resolvePuppyAdd(best.id), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Repéré ! : révéler des Tuiles Chiots de la réserve. Bot → en révèle (jusqu'à
    // remaining) une par une ; humain → clic direct sur les tuiles (faces cachées).
    const ppr = state.pendingPuppyReveal
    if (ppr) {
      if (seats[ppr.playerIndex] === 'bot') {
        const hidden = (state.players[ppr.playerIndex].puppyTiles ?? []).find((t) => t.state === 'reserve' && !t.revealed)
        const timer = setTimeout(() => (hidden ? resolvePuppyReveal(hidden.id) : donePuppyReveal()), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Horace : capturer sur son lieu ou amener une Tuile. Bot → capture (progrès
    // direct vers l'objectif) ; humain → modale.
    const phc = state.pendingHoraceChoice
    if (phc) {
      if (seats[phc.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveHoraceChoice(true), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Capture avec choix : Bot → capture la plus grosse tuile ; humain → modale.
    const ppc = state.pendingPuppyCapture
    if (ppc) {
      if (seats[ppc.playerIndex] === 'bot') {
        const best = (state.players[ppc.playerIndex].puppyTiles ?? [])
          .filter((t) => t.state === 'board' && t.location === ppc.locationId)
          .sort((a, b) => b.value - a.value)[0]
        if (best) {
          const timer = setTimeout(() => resolvePuppyCapture(best.id), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Quels idiots ! : Bot → préfère chercher un Allié (avantage de carte), sinon
    // déplacer ; puis choisit l'Allié le plus fort. Humain → modale / clic.
    const pqi = state.pendingQuelsIdiots
    if (pqi) {
      if (seats[pqi.playerIndex] === 'bot') {
        const pl = state.players[pqi.playerIndex]
        if (pqi.phase === 'choose') {
          const choice = pqi.canTutor ? 'tutor' : 'move'
          const timer = setTimeout(() => resolveQuelsIdiots(choice), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
        const pool = pqi.phase === 'move'
          ? Object.values(pl.board).flat()
          : [...pl.deck, ...pl.discard]
        const cands = (pqi.candidateIds ?? [])
          .map((id) => pool.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        const best = [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        if (best) {
          const timer = setTimeout(() => resolveQuelsIdiotsPick(best.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
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
    // Mauvais Coup : choisir 1 des 2 cartes du dessous à prendre en main, l'autre
    // dessus/dessous. Bot → garde la moins chère (plus jouable) en main et remet
    // l'autre sur le dessous ; humain → modale.
    const pmc = state.pendingMauvaisCoup
    if (pmc) {
      if (seats[pmc.playerIndex] === 'bot') {
        const keep = [...pmc.cards].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0]
        const timer = setTimeout(() => resolveMauvaisCoup(keep.instanceId, 'bottom'), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Sournois : replacer 1 carte de la main sur le dessus/dessous. Bot → remet la
    // plus chère (moins jouable) sur le dessous ; humain → modale.
    const psr = state.pendingSournois
    if (psr) {
      if (seats[psr.playerIndex] === 'bot') {
        const hand = state.players[psr.playerIndex].hand
        const worst = [...hand].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]
        if (worst) {
          const timer = setTimeout(() => resolveSournois(worst.instanceId, 'bottom'), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Cheval : déplacer un Allié/Objet. Bot → délègue à l'heuristique (auto) ;
    // humain → modale (choix carte + lieu, ou ne rien déplacer).
    const paim = state.pendingAllyItemMove
    if (paim) {
      if (seats[paim.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveAllyItemMoveAuto(), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Bandit : enchaîner d'autres Bandits. Bot → n'en enchaîne aucun (il joue ses
    // Bandits un par un via ses actions) ; humain → modale de sélection multiple.
    const pbc = state.pendingBanditChain
    if (pbc) {
      if (seats[pbc.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveBanditChain([]), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Dingo : intervertir/déplacer une tuile Objectif de la cible. Bot (chooser) →
    // 1ᵉʳ coup disponible (perturbation) ; humain → modale.
    const pdg = state.pendingDingo
    if (pdg) {
      if (seats[pdg.chooserIndex] === 'bot') {
        const opt = dingoSwapOptions(state.players[pdg.targetIndex])[0]
        const timer = setTimeout(
          () => (opt ? resolveDingo(opt.from, opt.to) : resolveDingo(null, null)),
          BOT_STEP_MS,
        )
        return () => clearTimeout(timer)
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
    // Oogie — Père Noël : le bot ne défausse rien et pioche (heuristique simple).
    const pDiscDraw = state.pendingDiscardThenDraw
    if (pDiscDraw) {
      if (seats[pDiscDraw.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveDiscardThenDraw([]), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Mim — Le Savoir conduit à la Puissance : le bot (chooser) déplace un Merlin vers
    // un lieu où Mim n'a PAS sa Métamorphose prête (préf. Marais / Forêt).
    const pmm = state.pendingMerlinMove
    if (pmm) {
      if (seats[pmm.chooserIndex] === 'bot') {
        const tgt = state.players[pmm.targetIndex]
        const merlin = Object.values(tgt.board).flat().find((c) => pmm.candidateIds.includes(c.instanceId))
        if (merlin) {
          const fromLoc = tgt.locations.map((l) => l.id).find((id) => (tgt.board[id] ?? []).some((c) => c.instanceId === merlin.instanceId))
          const readyAt = (loc: string) =>
            (tgt.board[loc] ?? []).some((c) => c.isMimTransformation && c.transformationTarget === merlin.cardId)
          const PREF = ['marais', 'the-woods', 'lieu-duel', 'cabane']
          const noReady = tgt.locations.map((l) => l.id).filter((id) => id !== fromLoc && !readyAt(id))
          const dest = PREF.find((id) => noReady.includes(id)) ?? noReady[0] ?? tgt.locations.map((l) => l.id).find((id) => id !== fromLoc) ?? fromLoc!
          const timer = setTimeout(() => resolveMerlinMove(merlin.instanceId, dest), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Soyez prêtes ! (Scar) : le bot reprend en priorité des Alliés (Hyènes/forts
    // d'abord, jusqu'à 2), sinon le meilleur Événement.
    const pbp = state.pendingBePrepared
    if (pbp) {
      if (seats[pbp.playerIndex] === 'bot') {
        const p = state.players[pbp.playerIndex]
        const cands = pbp.candidateIds
          .map((id) => p.discard.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        const allies = cands
          .filter((c) => c.type === 'ally')
          .sort((a, b) => (b.isHyena ? 1 : 0) - (a.isHyena ? 1 : 0) || (b.strength ?? 0) - (a.strength ?? 0))
        const pick = allies[0] ?? cands.find((c) => c.type === 'effect')
        const timer = setTimeout(() => resolveBePrepared(pick ? pick.instanceId : null), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Shenzi (Scar) : le bot joue gratuitement la Hyène la plus forte de sa main.
    const pfh2 = state.pendingFreeHyena
    if (pfh2) {
      if (seats[pfh2.playerIndex] === 'bot') {
        const p = state.players[pfh2.playerIndex]
        const cands = pfh2.candidateIds
          .map((id) => p.hand.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        const pick = [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        const timer = setTimeout(() => resolveFreeHyena(pick ? pick.instanceId : null), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Hakuna Matata (Scar) : le bot préfère DÉPLACER un Héros (ne perd pas de Force
    // de Succession) ; à défaut, rejoue le Héros le plus FAIBLE de la Succession.
    const phm = state.pendingHakunaMatata
    if (phm) {
      if (seats[phm.playerIndex] === 'bot') {
        const p = state.players[phm.playerIndex]
        const byId = (id: string) => Object.values(p.board).flat().find((c) => c.instanceId === id) ?? (p.succession ?? []).find((c) => c.instanceId === id)
        let act: { mode: 'play' | 'move'; instanceId: string } | undefined
        if (phm.realmHeroIds.length > 0) {
          const strongest = [...phm.realmHeroIds].sort((a, b) => ((byId(b)?.strength ?? 0) - (byId(a)?.strength ?? 0)))[0]
          act = { mode: 'move', instanceId: strongest }
        } else if (phm.successionIds.length > 0) {
          const weakest = [...phm.successionIds].sort((a, b) => ((byId(a)?.strength ?? 0) - (byId(b)?.strength ?? 0)))[0]
          act = { mode: 'play', instanceId: weakest }
        }
        if (act) {
          const chosen = act
          const timer = setTimeout(() => resolveHakunaMatata(chosen.mode, chosen.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Yzma (Fatalité) : le bot, quand il CIBLE Yzma, choisit une pioche puis joue le
    // Héros le plus fort (en évitant Kuzco, qui sert l'objectif d'Yzma).
    const pyf = state.pendingYzmaFate
    if (pyf) {
      const pyfOwner = pyf.phase === 'deck' ? (pyf.deckChooserIndex ?? pyf.chooserIndex) : pyf.chooserIndex
      if (seats[pyfOwner] === 'bot') {
        const tgt = state.players[pyf.targetIndex]
        const heroStr = (c: CardInstance) => (c.type === 'hero' && c.cardId !== 'kuzco' ? (c.strength ?? 0) : -1)
        if (pyf.phase === 'deck') {
          const decks = tgt.fateDecks ?? {}
          // Pioche non vide avec le meilleur Héros (hors Kuzco) ; sinon la 1ʳᵉ non vide.
          const nonEmpty = Object.keys(decks).filter((id) => (decks[id] ?? []).length > 0)
          if (nonEmpty.length > 0) {
            const best = [...nonEmpty].sort(
              (a, b) =>
                Math.max(-1, ...(decks[b] ?? []).map(heroStr)) - Math.max(-1, ...(decks[a] ?? []).map(heroStr)),
            )[0]
            const timer = setTimeout(() => resolveYzmaFateDeck(best), BOT_STEP_MS)
            return () => clearTimeout(timer)
          }
        } else if (pyf.phase === 'card') {
          const cards = pyf.cards ?? []
          const best = [...cards].sort((a, b) => heroStr(b) - heroStr(a))[0]
          const pick = best && heroStr(best) >= 0 ? best.instanceId : null
          const timer = setTimeout(() => resolveYzmaFateCard(pick), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Yzma (À l'attaque ! / Marteau) : le bot Yzma choisit la pioche avec le plus de Héros.
    const pyod = state.pendingYzmaOwnDeck
    if (pyod) {
      if (seats[pyod.playerIndex] === 'bot') {
        // Indiscrétion : après avoir regardé (revealCards posé), le bot referme.
        if (pyod.revealCards) {
          const timer = setTimeout(() => resolveYzmaOwnDeck(''), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
        // Marteau : les cartes étant face cachée, le bot en défausse `count` au hasard
        // (ici : les premières de la pioche déjà remélangée).
        if (pyod.hammerPick) {
          const { cards, count } = pyod.hammerPick
          const ids = cards.slice(0, count).map((c) => c.instanceId)
          const timer = setTimeout(() => resolveYzmaHammer(ids), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
        const decks = state.players[pyod.playerIndex].fateDecks ?? {}
        const nonEmpty = Object.keys(decks).filter((id) => (decks[id] ?? []).length > 0)
        if (nonEmpty.length > 0) {
          const best = [...nonEmpty].sort(
            (a, b) =>
              (decks[b] ?? []).filter((c) => c.type === 'hero').length -
              (decks[a] ?? []).filter((c) => c.type === 'hero').length,
          )[0]
          const timer = setTimeout(() => resolveYzmaOwnDeck(best), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Paysan / Attention au groove ! / Pacha (Yzma) : le bot mélange le Héros le plus
    // fort (le cas échéant) dans les pioches les plus petites (comportement auto).
    const pym = state.pendingYzmaManipulate
    if (pym) {
      if (seats[pym.playerIndex] === 'bot') {
        const pl = state.players[pym.playerIndex]
        const decks = pl.fateDecks ?? {}
        const targets = Object.keys(decks)
          .sort((a, b) => (decks[a]?.length ?? 0) - (decks[b]?.length ?? 0))
          .slice(0, Math.max(1, pym.count))
        let heroId: string | null = null
        if (pym.mode === 'hero-to-decks') {
          const hero = pl.fateDiscard
            .filter((c) => pym.heroIds.includes(c.instanceId))
            .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
          heroId = hero?.instanceId ?? null
        }
        const timer = setTimeout(() => resolveYzmaManipulate(heroId, targets), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Finis le travail (Yzma) : le bot déplace son Allié le plus fort vers le lieu du
    // Héros le plus fort.
    const pfj = state.pendingFinishJob
    if (pfj) {
      if (seats[pfj.playerIndex] === 'bot') {
        const pl = state.players[pfj.playerIndex]
        if (!pfj.allyInstanceId) {
          const allies = Object.values(pl.board).flat().filter((c) => c.type === 'ally' && !c.attachedTo)
          const best = [...allies].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
          if (best) {
            const timer = setTimeout(() => resolveFinishJob(best.instanceId, undefined), BOT_STEP_MS)
            return () => clearTimeout(timer)
          }
        } else {
          const heroLocs = pl.locations.filter((l) => (pl.board[l.id] ?? []).some((c) => c.type === 'hero'))
          const best = [...heroLocs].sort(
            (a, b) =>
              Math.max(0, ...(pl.board[b.id] ?? []).filter((c) => c.type === 'hero').map((c) => c.strength ?? 0)) -
              Math.max(0, ...(pl.board[a.id] ?? []).filter((c) => c.type === 'hero').map((c) => c.strength ?? 0)),
          )[0]
          if (best) {
            const timer = setTimeout(() => resolveFinishJob(undefined, best.id), BOT_STEP_MS)
            return () => clearTimeout(timer)
          }
        }
      }
      return
    }
    // Ironie du sort (Yzma) : le bot rejoue l'Événement abordable le plus cher.
    const pre = state.pendingReplayEvent
    if (pre) {
      if (seats[pre.playerIndex] === 'bot') {
        const pl = state.players[pre.playerIndex]
        const cands = pre.candidateIds
          .map((id) => pl.discard.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        const pick = [...cands].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]
        const timer = setTimeout(() => resolveReplayEvent(pick ? pick.instanceId : null), BOT_STEP_MS)
        return () => clearTimeout(timer)
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
    // Appel à l'aide (Ratigan) : le bot (qui pose la Fatalité) vise le lieu de la
    // Reine Robot (pour que Basil la défausse → bascule « Le Rat »), sinon Buckingham.
    const pfhp = state.pendingFateHeroPlace
    if (pfhp) {
      if (seats[pfhp.chooserIndex] === 'bot') {
        const tgt = state.players[pfhp.targetIndex]
        const robotLoc = tgt.locations.find((l) =>
          (tgt.board[l.id] ?? []).some((c) => c.cardId === 'reine-robot' && !c.attachedTo),
        )?.id
        const dest = robotLoc ?? (tgt.locations.some((l) => l.id === 'buckingham-palace') ? 'buckingham-palace' : tgt.locations[0]?.id)
        const timer = setTimeout(() => dest && resolveFateHeroPlace(dest), BOT_STEP_MS)
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
                : pfc.kind === 'play-revealed-fate-hero'
                  ? // Longue vie au roi ! : Scar joue le Héros le plus fort (Force pour
                    // la pile Succession).
                    [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
                  : pfc.kind === 'play-fate-card-from-discard'
                    ? // Petit secret : Héros le plus fort en priorité, sinon un Événement.
                      [...cands].sort(
                        (a, b) =>
                          (b.type === 'hero' ? 1 : 0) - (a.type === 'hero' ? 1 : 0) ||
                          (b.strength ?? 0) - (a.strength ?? 0),
                      )[0]
                    : pfc.kind === 'remove-item'
                      ? // Migraine / Sabotage : défausser l'Objet le plus cher (le plus pénalisant).
                        [...cands].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0]
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
        // Pas si vite (Sombra) : garder (= faire jouer) la carte la moins menaçante.
        // Sinon (Faites-leur peur !) : garder les Héros sur le dessus.
        const keep = psc.pasSiVite
          ? (() => {
              const least = [...psc.cards].sort((a, b) => (a.strength ?? 0) - (b.strength ?? 0))[0]
              return least ? [least.instanceId] : []
            })()
          : psc.cards.filter((c) => c.type === 'hero').map((c) => c.instanceId)
        const timer = setTimeout(() => resolveScry(keep), BOT_STEP_MS)
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
        // Garde jusqu'à `take` cartes les mieux classées (Quelques Dragées : 2).
        const best = [...plt.cards].sort((a, b) => rank(b.cardId) - rank(a.cardId)).slice(0, plt.take)
        const timer = setTimeout(() => resolveLookTop(best.map((c) => c.instanceId)), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Liste de Fidget (Ratigan) : affichage informatif, le bot l'acquitte tout seul.
    const prv = state.pendingReveal
    if (prv) {
      if (seats[prv.playerIndex] === 'bot') {
        const timer = setTimeout(() => acknowledgeReveal(), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Sombra — Piratage : le bot désactive l'action la moins utile (Défausser en
    // priorité, sinon la 1ʳᵉ proposée).
    const phk = state.pendingHack
    if (phk) {
      if (seats[phk.playerIndex] === 'bot') {
        const loc = state.players[phk.playerIndex].locations.find((l) => l.id === phk.locationId)
        const byId = (id: string) => loc?.actions.find((a) => a.id === id)
        const pick =
          phk.actionIds.find((id) => byId(id)?.type === 'DISCARD_CARDS') ?? phk.actionIds[0]
        const timer = setTimeout(() => resolveHack(pick), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Sombra — Information : le bot garde la pioche (net +1) et défausse depuis sa main.
    const pinf = state.pendingInformation
    if (pinf) {
      if (seats[pinf.playerIndex] === 'bot') {
        const timer = setTimeout(() => resolveInformation(false), BOT_STEP_MS)
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
            const cands = phr.forcedLocationId !== undefined
              ? [phr.forcedLocationId].filter((id): id is string => !!id && !locked.has(id))
              : phr.forcedDirection !== undefined
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
    // Flèche de Mome Raths : déplacer un Allié de la cible vers un lieu non bloqué.
    // Bot chooser → 1ᵉʳ Allié + 1ᵉʳ lieu non bloqué ; humain → modale.
    const par = state.pendingAllyRelocate
    if (par) {
      if (seats[par.chooserIndex] === 'bot') {
        const tgt = state.players[par.targetIndex]
        const ids = tgt.locations.map((l) => l.id)
        const locked = new Set(tgt.lockedLocations ?? [])
        for (const loc of tgt.locations) {
          const ally = (tgt.board[loc.id] ?? []).find(
            (c) => c.type === 'ally' && !c.attachedTo,
          )
          if (ally) {
            // Stari (adjacentOnly) : destination restreinte aux lieux voisins.
            const li = ids.indexOf(loc.id)
            const candidates = par.adjacentOnly
              ? ids.filter((_, i) => Math.abs(i - li) === 1)
              : ids.filter((id) => id !== loc.id)
            const to = candidates.find((id) => !locked.has(id))
            if (to) {
              const timer = setTimeout(() => resolveAllyRelocate(ally.instanceId, to), BOT_STEP_MS)
              return () => clearTimeout(timer)
            }
          }
        }
      }
      return
    }
    // Team Rocket — un dresseur invoque un Pokémon : le bot choisit le plus FORT
    // (Pokémon le plus difficile à attraper = le plus pénible pour l'adversaire).
    const pps = state.pendingPokemonSummon
    if (pps) {
      if (seats[pps.chooserIndex] === 'bot') {
        const best = [...pps.candidateCardIds].sort(
          (a, b) => (getCardDef(b)?.strength ?? 0) - (getCardDef(a)?.strength ?? 0),
        )[0]
        const timer = setTimeout(() => resolvePokemonSummon(best), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Team Rocket — « Oui, la guerre ! » : le bot couche le Pokémon le plus FORT
    // (le plus utile à attraper) parmi les candidats.
    const pkp = state.pendingKoPokemon
    if (pkp) {
      if (seats[pkp.chooserIndex] === 'bot') {
        const tgt = state.players[pkp.chooserIndex]
        const cards = Object.values(tgt.board).flat()
        const best = [...pkp.candidateIds].sort(
          (a, b) =>
            (cards.find((c) => c.instanceId === b)?.strength ?? 0) -
            (cards.find((c) => c.instanceId === a)?.strength ?? 0),
        )[0]
        const timer = setTimeout(() => resolveKoPokemon(best), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Pat Hibulaire — « Planqués » : le bot (s'il pose la Fatalité) défausse l'Allié
    // candidat le plus FORT du royaume adverse.
    const pfda = state.pendingFateDiscardAlly
    if (pfda) {
      if (seats[pfda.chooserIndex] === 'bot') {
        const tgt = state.players[pfda.targetIndex]
        const cards = Object.values(tgt.board).flat()
        const best = [...pfda.candidateIds].sort(
          (a, b) =>
            (cards.find((c) => c.instanceId === b)?.strength ?? 0) -
            (cards.find((c) => c.instanceId === a)?.strength ?? 0),
        )[0]
        const timer = setTimeout(() => resolveFateDiscardAlly(best), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Syndrome — Identification, je vous prie : l'acteur déplace un de ses Allié/Objet vers
    // un lieu portant un Héros. Bot → 1ᵉʳ Allié/Objet + 1ᵉʳ lieu-Héros ; humain → modale.
    const pid = state.pendingIdentification
    if (pid) {
      if (seats[pid.playerIndex] === 'bot') {
        const p = state.players[pid.playerIndex]
        const heroLocs = p.locations.map((l) => l.id).filter((id) => (p.board[id] ?? []).some((c) => c.type === 'hero'))
        for (const loc of p.locations) {
          const c = (p.board[loc.id] ?? []).find((x) => (x.type === 'ally' || x.type === 'item') && !x.attachedTo && !x.isWicket)
          if (c) {
            const to = heroLocs.find((id) => id !== loc.id)
            if (to) {
              const timer = setTimeout(() => resolveIdentification(c.instanceId, to), BOT_STEP_MS)
              return () => clearTimeout(timer)
            }
          }
        }
      }
      return
    }
    // Dr Facilier — L'étoile du soir : le « chooser » envoie un Allié de la cible dans
    // l'Au-delà. Bot → le plus fort ; humain → modale (clic direct sur le plateau cible).
    const paud = state.pendingFateAllyToAuDela
    if (paud) {
      if (seats[paud.chooserIndex] === 'bot') {
        const tgt = state.players[paud.targetIndex]
        const allies = tgt.locations.flatMap((l) =>
          (tgt.board[l.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket),
        )
        const pick = [...allies].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveFateAllyToAuDela(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Oogie Boogie — Mettons fin à ce cauchemar : le « chooser » défausse une carte de la
    // main de la cible. Bot → Imposteur en priorité (puis coût élevé) ; humain → modale.
    const pdh = state.pendingFateDiscardHand
    if (pdh) {
      if (seats[pdh.chooserIndex] === 'bot') {
        const hand = state.players[pdh.targetIndex].hand ?? []
        const pick = [...hand].sort((a, b) => {
          const sc = (c: (typeof hand)[number]) => (c.cardId === 'imposteur-perce-oreilles' ? 100 : 0) + (c.cardId === 'affaire-dans-le-sac' ? 50 : 0) + (c.cost ?? 0)
          return sc(b) - sc(a)
        })[0]
        if (pick) {
          const timer = setTimeout(() => resolveFateDiscardHand(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Hadès — Alignement des planètes : désentraver des Titans. Bot → les plus avancés
    // finançables ; humain → modale.
    const put = state.pendingUntrapTitans
    if (put) {
      if (seats[put.playerIndex] === 'bot') {
        const p = state.players[put.playerIndex]
        const order = p.locations.map((l) => l.id)
        const trapped: { id: string; i: number }[] = []
        order.forEach((lid, i) => {
          for (const c of p.board[lid] ?? []) if (c.isTitan && c.trapped) trapped.push({ id: c.instanceId, i })
        })
        trapped.sort((a, b) => b.i - a.i)
        const chosen = trapped.slice(0, p.power).map((t) => t.id)
        const timer = setTimeout(() => resolveUntrapTitans(chosen), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Oogie Boogie — Diversion (2ᵉ temps) : le « chooser » défausse un Allié/Objet du lieu
    // d'arrivée. Bot → le plus fort ; humain → modale.
    const pdd = state.pendingDiversionDiscard
    if (pdd) {
      if (seats[pdd.chooserIndex] === 'bot') {
        const cell = state.players[pdd.targetIndex].board[pdd.locationId] ?? []
        const cands = cell.filter((c) => (c.type === 'ally' || c.type === 'item') && !c.attachedTo && !c.isWicket)
        const pick = [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveDiversionDiscard(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Lotso — choix de cible (réduire / déplacer vers la Salle). Bot → meilleure cible
    // (Héros le plus fort) ; humain → modale.
    const plTarget = state.pendingLotsoTarget
    if (plTarget) {
      if (seats[plTarget.playerIndex] === 'bot') {
        const p = state.players[plTarget.playerIndex]
        const cards = Object.values(p.board).flat().filter((c) => plTarget.candidateIds.includes(c.instanceId))
        const pick = [...cards].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveLotsoTarget(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Team Rocket — Évolution : choix de l'Allié à faire évoluer. Bot → le plus fort
    // (évoluer est bénéfique) ; humain → modale.
    const plEvolve = state.pendingEvolveAlly
    if (plEvolve) {
      if (seats[plEvolve.playerIndex] === 'bot') {
        const p = state.players[plEvolve.playerIndex]
        const cards = Object.values(p.board).flat().filter((c) => plEvolve.candidateIds.includes(c.instanceId))
        const pick = [...cards].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0]
        if (pick) {
          const timer = setTimeout(() => resolveEvolveAlly(pick.instanceId), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Lotso — Réinitialisation : choix du lieu où placer Buzz (mode Démo). Bot → lieu du pion ;
    // humain → modale.
    const plBuzz = state.pendingLotsoBuzzMove
    if (plBuzz) {
      if (seats[plBuzz.playerIndex] === 'bot') {
        const p = state.players[plBuzz.playerIndex]
        const dest = p.pawnLocation ?? p.locations[0]?.id
        if (dest) {
          const timer = setTimeout(() => resolveLotsoBuzzMove(dest), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
      }
      return
    }
    // Lotso — Le Bibliothécaire : répartition des réductions. Bot → réduit le Héros le moins
    // fort (le moins cher à amener à 0), en gardant 2 jetons Pouvoir de réserve ; humain → modale.
    const plBook = state.pendingLotsoBookworm
    if (plBook) {
      if (seats[plBook.playerIndex] === 'bot') {
        const p = state.players[plBook.playerIndex]
        const elig = lotsoReducibleHeroes(state, plBook.playerIndex)
        if (elig.length > 0 && p.power > 2) {
          const pick = elig
            .map((id) => ({ id, s: effectiveStrength(state, plBook.playerIndex, id) ?? 0 }))
            .sort((a, b) => a.s - b.s)[0]
          const timer = setTimeout(() => resolveLotsoBookworm(pick.id), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
        const timer = setTimeout(() => resolveLotsoBookworm(null), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Lotso — Flex : phase 1 (choisir la carte) puis phase 2 (choisir le lieu). Bot →
    // 1er candidat / 1er autre lieu ; humain → modales.
    const plFlex = state.pendingLotsoFlex
    if (plFlex) {
      if (seats[plFlex.playerIndex] === 'bot') {
        if (!plFlex.cardInstanceId) {
          const pick = plFlex.candidateIds[0]
          const timer = setTimeout(() => resolveLotsoFlex({ cardInstanceId: pick }), BOT_STEP_MS)
          return () => clearTimeout(timer)
        }
        const p = state.players[plFlex.playerIndex]
        const dest = p.locations.find((l) => l.id !== plFlex.fromLocationId)?.id
        if (dest) {
          const timer = setTimeout(() => resolveLotsoFlex({ to: dest }), BOT_STEP_MS)
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
        // Défausse facultative (J'allais oublier un détail) : le bot complète juste
        // sa main (ne défausse rien). Sinon (Tyrannie) : défausse `count` cartes.
        const ids = ptd.optional
          ? []
          : hand.slice(0, Math.min(ptd.count, hand.length)).map((c) => c.instanceId)
        const timer = setTimeout(() => resolveTyrannyDiscard(ids), BOT_STEP_MS)
        return () => clearTimeout(timer)
      }
      return
    }
    // Shere Khan — Conditions interactives jouées en RÉACTION (pendant le tour
    // adverse) et dont l'effet ouvre un pending : tant qu'il est ouvert, le tour
    // doit s'interrompre. Bot → auto-résout ; humain → on met le tour adverse en
    // PAUSE — sinon le bot reprenait la main (botAct) et écrasait le pending, faisant
    // « disparaître » la modale avant que le joueur ait pu résoudre l'effet.
    const pint = state.pendingInteressant
    if (pint) {
      if (seats[pint.playerIndex] === 'bot') {
        // C'est très intéressant : le bot prend Pouvoir puis Pioche (toujours utiles),
        // ignore le déplacement de Feu (gain marginal), puis termine.
        const done = new Set(pint.done)
        const opt: 'power' | 'draw' | null = !done.has('power') ? 'power' : !done.has('draw') ? 'draw' : null
        const timer = setTimeout(
          () => (opt ? resolveInteressant({ option: opt }) : resolveInteressant({ done: true })),
          BOT_STEP_MS,
        )
        return () => clearTimeout(timer)
      }
      return
    }
    const prtd = state.pendingRecoverToDeck
    if (prtd) {
      if (seats[prtd.playerIndex] === 'bot') {
        // Aie confiance / Je te le dirai en chantant : le bot récupère ses meilleures
        // cartes de la défausse (force puis coût), jusqu'à `remaining`, puis termine.
        const chosen = new Set(prtd.chosen)
        const cands = state.players[prtd.playerIndex].discard.filter((c) => !chosen.has(c.instanceId))
        const pick =
          prtd.chosen.length < prtd.remaining
            ? [...cands].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0) || (b.cost ?? 0) - (a.cost ?? 0))[0]
            : undefined
        const timer = setTimeout(
          () => (pick ? resolveRecoverToDeck({ instanceId: pick.instanceId }) : resolveRecoverToDeck({ done: true })),
          BOT_STEP_MS,
        )
        return () => clearTimeout(timer)
      }
      return
    }
    // C'est très intéressant (option « déplacer un jeton Feu ») jouée en réaction par
    // l'humain pendant le tour du bot : on met aussi en pause le temps de son choix.
    // (Le bot, lui, résout son propre pendingRemoveFire via sa recherche de tour.)
    if (state.pendingRemoveFire && seats[state.pendingRemoveFire.playerIndex] !== 'bot') return
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
  }, [seats, HUMAN, isBotTurn, startRollDone, openingDealDone, dealOverlay, state, showcaseBusy, botAct, botReact, reactionPassed, testMode, resolveTyrannyDiscard, resolveHeroPlacement, resolvePawnMove, resolveHubertPull, resolveDeckPeek, resolveTypeChoice, resolveDrawOrGainPower, resolvePowerOrRacerBack, resolveMoveOrActivate, resolveCauldronChoice, resolveMauiChoice, resolveDioDiscardAlly, resolveDioCream, resolveDioMuda, resolveDioQuest, resolveDioSunlight, resolveCrustaceanPlace, resolveFateAllyToAuDela, resolveFateDiscardHand, resolveDiversionDiscard, resolveUntrapTitans, resolveBargainChoice, resolveFreeItemPlay, skipFreeItemPlay, resolveFateReorder, resolveRaiponceHomeward, resolveRaiponceToTower, resolvePuppyAdd, resolvePuppyReveal, donePuppyReveal, resolveHoraceChoice, resolvePuppyCapture, resolveQuelsIdiots, resolveQuelsIdiotsPick, resolveHeroRelocate, resolveTeleport, resolveManipulation, resolveMauvaisCoup, resolveSournois, resolveAllyItemMove, resolveAllyItemMoveAuto, resolveBanditChain, resolveDingo, dismissRoyalCroquet, resolveTransformWickets, resolveScry, resolveAllyMoveBuff, resolveFateChoice, resolveFetchedHero, resolveCastleTheft, resolveRecover, resolveBePrepared, resolveFreeHyena, resolveHakunaMatata, resolveYzmaFateDeck, resolveYzmaFateCard, resolveYzmaOwnDeck, resolveYzmaHammer, resolveYzmaManipulate, resolveFinishJob, resolveReplayEvent, resolveCrewmateKill, resolveCrewmateSuspect, doneCrewmateSuspect, resolveCrewmateMove, doneCrewmateMove, resolveFateObjectPlace, resolveFateHeroPlace, resolveDivination, resolveLookTop, acknowledgeReveal, resolveHack, resolveInformation, resolveTakeABite, resolveDuplicateIngredient, cancelDuplicateIngredient, resolveScream, resolveFateScry, skipHeroRelocate, resolveAllyRelocate, resolvePokemonSummon, resolveKoPokemon, resolveFateDiscardAlly, resolveIdentification, resolveLotsoTarget, resolveEvolveAlly, resolveLotsoBuzzMove, resolveLotsoBookworm, resolveLotsoFlex, resolveObstacle, doneObstacle, resolveKey, resolveKeyColor, resolvePlaisir, resolveStealKey, resolveInteressant, resolveRecoverToDeck, resolveDiscardThenDraw, resolveMerlinMove])

  // Sombra — joue « Lieu piraté » dès qu'une nouvelle piraterie apparaît : action
  // désactivée par un Piratage (hackedActionId) OU Héros piraté par Boop (abilityHacked),
  // tous joueurs confondus. Couvre humain ET bot, sans rejouer à chaque rendu.
  useEffect(() => {
    let count = 0
    for (const p of state.players) {
      for (const cards of Object.values(p.board)) {
        for (const c of cards) {
          if (c.isPiratage && c.hackedActionId) count++
          if (c.type === 'hero' && c.abilityHacked) count++
        }
      }
    }
    if (hackCountRef.current !== null && count > hackCountRef.current) playLieuPirate()
    hackCountRef.current = count
  }, [state])

  // Coups légaux / actions : seulement pour le joueur humain et à son tour.
  // Dio — ZA WARUDO! (temps arrêté) : pendant la phase ACTION, le pion peut se déplacer
  // librement vers tout autre lieu (relocalisation gratuite) pour y faire ses actions.
  const zaActive = isHumanTurn && state.phase === 'ACTION' && !!user.zaWarudoActive
  const zaWarudoTargets = zaActive
    ? user.locations.map((l) => l.id).filter((l) => l !== user.pawnLocation)
    : []
  const legalMoves = isHumanTurn ? (zaActive ? zaWarudoTargets : getLegalMoves(state)) : []
  const availableActions = isHumanTurn ? getAvailableActions(state) : []
  const canEnd = isHumanTurn && state.phase === 'ACTION'
  // Glisser-déposer : action « Jouer une carte » utilisable (mode 'play' actif → son
  // actionId ; sinon la 1ʳᵉ action « Jouer » libre du lieu courant). Désactivé pendant
  // un sous-flux (poser/cibler) ou hors du tour humain.
  const dragPlayActionId =
    isHumanTurn && state.phase === 'ACTION' && (!mode || mode.kind === 'play')
      ? mode?.kind === 'play'
        ? mode.actionId
        : availableActions.find((a) => a.type === 'PLAY_CARD')?.id
      : undefined
  // Glisser-déposer : action « Déplacer un Objet ou un Allié » utilisable → les Alliés/
  // Objets déplaçables du plateau deviennent saisissables (drag) vers un lieu voisin,
  // comme une carte de la main. `movableDragIds` = instanceId des cartes déplaçables.
  const dragMoveActionId =
    isHumanTurn && state.phase === 'ACTION' && (!mode || mode.kind === 'move-pick')
      ? mode?.kind === 'move-pick'
        ? mode.actionId
        : availableActions.find((a) => a.type === 'MOVE_ITEM_ALLY')?.id
      : undefined
  const movableDragIds = dragMoveActionId ? movableCards(state).map((m) => m.instanceId) : []
  // Glisser-déposer d'un HÉROS : l'action « Déplacer un Héros » (MOVE_HERO) utilisable
  // → les Héros du royaume deviennent saisissables vers un lieu VOISIN (comme un
  // Allié/Objet), au lieu de l'ancien flux clic-Héros puis clic-destination.
  const dragHeroActionId =
    isHumanTurn && state.phase === 'ACTION' && (!mode || mode.kind === 'move-hero-pick')
      ? mode?.kind === 'move-hero-pick'
        ? mode.actionId
        : availableActions.find((a) => a.type === 'MOVE_HERO')?.id
      : undefined
  // Héros saisissables : ceux d'un lieu NON verrouillé ayant au moins une destination
  // voisine non verrouillée (mêmes conditions que le moteur, cf. applyMoveHero).
  const movableHeroIds: string[] = dragHeroActionId
    ? (() => {
        const locked = new Set(user.lockedLocations ?? [])
        return user.locations.flatMap((l) => {
          if (locked.has(l.id)) return []
          if (adjacentLocationIds(state, l.id).every((d) => locked.has(d))) return []
          return (user.board[l.id] ?? [])
            .filter((c) => c.type === 'hero' && !c.hypnotized)
            .map((c) => c.instanceId)
        })
      })()
    : []

  // Déplacement d'un Héros — lieux de destination à surligner sur la RANGÉE HÉROS (case
  // du haut), plutôt qu'un « poser ici » sur la case du bas. Deux sources :
  //  · flux clic (move-hero-dest) : lieux voisins du Héros choisi ;
  //  · glisser un Héros : lieux voisins du Héros en cours de glissement.
  const heroMoveDestTargets: string[] =
    mode?.kind === 'move-hero-dest'
      ? adjacentLocationIds(state, mode.from)
      : draggingCardId && movableHeroIds.includes(draggingCardId)
        ? adjacentLocationIds(
            state,
            user.locations.find((l) => (user.board[l.id] ?? []).some((c) => c.instanceId === draggingCardId))?.id ?? '',
          )
        : []

  // Yzma — choix d'une pioche Fatalité par clic DIRECT sur le plateau (au lieu d'une
  // modale). Deux flux où le HUMAIN choisit : ses propres cartes (À l'attaque ! /
  // Marteau / Indiscrétion → resolveYzmaOwnDeck, pioches de SON royaume) et la
  // résolution de Fatalité phase « pioche » (resolveYzmaFateDeck, pioches de la CIBLE).
  const fatePileChoiceFor = (seat: number): { pickable: string[]; onPick?: (loc: string) => void } => {
    const own = state.pendingYzmaOwnDeck
    if (own && own.playerIndex === HUMAN && !own.revealCards && !own.hammerPick && seat === HUMAN) {
      const p = state.players[seat]
      const pickable = p.locations.filter((l) => (p.fateDecks?.[l.id] ?? []).length > 0).map((l) => l.id)
      return { pickable, onPick: (loc) => resolveYzmaOwnDeck(loc) }
    }
    const yf = state.pendingYzmaFate
    if (yf && yf.phase === 'deck') {
      const owner = yf.deckChooserIndex ?? yf.chooserIndex
      if (owner === HUMAN && yf.targetIndex === seat) {
        const p = state.players[seat]
        const pickable = p.locations.filter((l) => (p.fateDecks?.[l.id] ?? []).length > 0).map((l) => l.id)
        return { pickable, onPick: (loc) => resolveYzmaFateDeck(loc) }
      }
    }
    return { pickable: [] }
  }
  const userFatePick = fatePileChoiceFor(HUMAN)
  const botFatePick = fatePileChoiceFor(BOT)
  // Bandeau d'instruction (non bloquant) décrivant le choix de pioche en cours.
  const fatePileBanner: string | null = (() => {
    if (userFatePick.pickable.length === 0 && botFatePick.pickable.length === 0) return null
    const own = state.pendingYzmaOwnDeck
    if (own && own.playerIndex === HUMAN && !own.revealCards) {
      return own.mode === 'attack'
        ? 'À l’attaque ! — cliquez la pioche Fatalité à dévoiler (tous ses Héros seront joués sur ce lieu).'
        : own.mode === 'hammer'
          ? 'Marteau — cliquez la pioche Fatalité : 2 cartes au hasard en seront défaussées.'
          : 'Indiscrétion — cliquez la pioche Fatalité à examiner.'
    }
    return 'Fatalité — cliquez la pioche Fatalité d’Yzma à dévoiler (vous y jouerez ensuite une carte).'
  })()

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
  const handleMoveTrack = clearThen(moveTrack)
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
    engrenagesIds?: string[],
  ) => {
    // Action « Jouer une carte » gratuite (Taffyta — grantedAction PLAY_CARD) : on
    // enveloppe la pose dans PERFORM_GRANTED_ACTION (actionId synthétique réservé).
    if (actionId === 'granted-free-action') {
      try {
        performGrantedAction({ type: 'PLAY_CARD', actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId, engrenagesIds })
      } catch { /* coup refusé : le bandeau d'action gratuite reste pour réessayer */ }
      return
    }
    if (isDiablo) {
      try {
        diabloFreeAction({ type: 'PLAY_CARD', actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId, engrenagesIds })
      } catch { /* coup refusé par le moteur : le bandeau Diablo reste pour réessayer */ }
    } else {
      playCard(actionId, instanceId, to, attachTo, targetHeroId, allyInstanceIds, allyMove, shrinkFreeActionId, engrenagesIds)
    }
  }
  // Ratigan — pose d'un Objet : si des Engrenages sont EN JEU, on bascule dans un
  // mode où le joueur coche DIRECTEMENT les Engrenages du plateau à défausser pour
  // réduire le coût (−3 chacun). Sinon, pose directe (avec vol). Cette fonction est
  // responsable de l'état `mode` final (engrenages-pick OU null après la pose).
  const playItemMaybeEngrenages = (
    diablo: boolean | undefined,
    actionId: string,
    instanceId: string,
    to?: string,
    attachTo?: string,
  ) => {
    const card = user.hand.find((c) => c.instanceId === instanceId)
    const available =
      card?.type === 'item'
        ? Object.values(user.board).flat().filter((c) => c.cardId === 'engrenages' && !c.attachedTo)
        : []
    const baseCost = card ? effectiveCost(state, card, to) : 0
    if (card && available.length > 0 && baseCost > 0) {
      setMode({
        kind: 'engrenages-pick',
        diablo,
        actionId,
        instanceId,
        to,
        attachTo,
        cardName: card.name,
        baseCost,
        available: available.map((c) => c.instanceId),
        selected: [],
      })
      return
    }
    if (to) flyHandToBoard(instanceId, to)
    doPlayCard(diablo, actionId, instanceId, to, attachTo)
    setMode(null)
  }
  // Ratigan — coche/décoche un Engrenage du plateau (mode engrenages-pick).
  const handleEngrenagesToggle = (instanceId: string) =>
    setMode((m) => {
      if (m?.kind !== 'engrenages-pick') return m
      const selected = m.selected.includes(instanceId)
        ? m.selected.filter((id) => id !== instanceId)
        : [...m.selected, instanceId]
      return { ...m, selected }
    })
  // Ratigan — confirme la pose de l'Objet en défaussant les Engrenages cochés.
  const handleEngrenagesConfirm = () => {
    if (mode?.kind !== 'engrenages-pick') return
    const cost = Math.max(0, mode.baseCost - 3 * mode.selected.length)
    if (cost > user.power) return
    if (mode.to) flyHandToBoard(mode.instanceId, mode.to)
    doPlayCard(
      mode.diablo,
      mode.actionId,
      mode.instanceId,
      mode.to,
      mode.attachTo,
      undefined,
      undefined,
      undefined,
      undefined,
      mode.selected,
    )
    setMode(null)
  }
  // Ratigan — Félicia : pose effective. `allyId` fourni → défausse cet Allié de son
  // lieu ; absent → on paie 2 Pouvoir de plus (le moteur prélève le supplément).
  const playFelicia = (
    diablo: boolean | undefined,
    actionId: string,
    instanceId: string,
    to: string,
    allyId?: string,
  ) => {
    flyHandToBoard(instanceId, to)
    doPlayCard(diablo, actionId, instanceId, to, undefined, undefined, allyId ? [allyId] : undefined)
    setMode(null)
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
    // Le Seigneur des Ténèbres — On te tient : choix « Chercher Tirelire » / « Éliminer un Héros ».
    if (card.cardId === 'we-got-you-pig-keeper') {
      return setMode({ kind: 'pigkeeper-choice', actionId: mode.actionId, instanceId, cardName: card.name, diablo: mode.diablo })
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
    if (card.cardId === 'mechancete' || card.cardId === 'double-jeu' || card.cardId === 'enfermes') {
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
  // Tendre un Piège / Uniforme — Vanquish facultatif (pendingTrapVanquish) :
  // démarrer ou terminer. Uniforme : l'Allié porteur est obligatoire (présélectionné).
  const handleTrapStartVanquish = () =>
    setMode({
      kind: 'vanquish-pick-hero',
      actionId: '',
      trap: true,
      vanquishLocationId: state.pendingTrapVanquish?.locationId,
      requiredAllyId: state.pendingTrapVanquish?.requiredAllyInstanceId,
    })
  const handleTrapFinish = () => trapSkipVanquish()
  const handleCardPick = (instanceId: string) => {
    // Cruella — Finissez le travail ! : activation gratuite par clic direct sur une
    // carte à capacité activable du royaume.
    if (freeActivateMode) {
      const card = activatableCards(state).find((c) => c.instanceId === instanceId)
      if (card) startActivate('free-activate', card)
      return
    }
    // Cruella — Quels idiots ! (phase déplacer) : clic sur l'Allié à amener.
    if (quelsMovePick) {
      if ((state.pendingQuelsIdiots?.candidateIds ?? []).includes(instanceId)) resolveQuelsIdiotsPick(instanceId)
      return
    }
    // Finis le travail (Yzma) — phase 1 : clic DIRECT sur l'Allié du plateau à
    // déplacer (lève l'ambiguïté entre deux Alliés identiques, ex. deux « Gardes du
    // palais », que la liste ne permettait pas de distinguer).
    const pfj = state.pendingFinishJob
    if (pfj && pfj.playerIndex === HUMAN && !pfj.allyInstanceId) {
      const isAlly = Object.values(user.board).flat().some(
        (c) => c.instanceId === instanceId && c.type === 'ally' && !c.isWicket && !c.attachedTo,
      )
      if (isAlly) resolveFinishJob(instanceId, undefined)
      return
    }
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
    if (mode?.kind === 'felicia-pick-ally') {
      // L'Allié cliqué (sur le lieu de Félicia) est défaussé pour la jouer.
      const here = (user.board[mode.to] ?? []).some(
        (c) => c.instanceId === instanceId && c.type === 'ally' && !c.attachedTo && !c.isWicket,
      )
      if (!here) return
      return playFelicia(mode.diablo, mode.actionId, mode.instanceId, mode.to, instanceId)
    }
    if (mode?.kind === 'impuissance-pick-hero') {
      // Le Héros cliqué (≤3) est éliminé par Impuissance.
      if (!vanquishHeroTargets.includes(instanceId)) return
      doPlayCard(mode.diablo, mode.actionId, mode.instanceId, undefined, undefined, instanceId)
      return setMode(null)
    }
    if (mode?.kind === 'pigkeeper-pick-hero') {
      // Le Héros cliqué (force ≤1) est éliminé par On te tient.
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
    setMode({ kind: 'move-dest', actionId: mode.actionId, instanceId, from, cardName: card?.name ?? '', granted: mode.granted })
  }
  const handlePlace = (to: string) => {
    // Tamatoa — Crustacé : un clic sur un lieu y joue l'Objet dévoilé.
    if (state.pendingCrustaceanPlace?.playerIndex === HUMAN) {
      return resolveCrustaceanPlace(to)
    }
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
      if (mode.granted) {
        // Gaston — Tous avec moi : déplacement gratuit (action synthétique côté moteur).
        performGrantedAction({ type: 'MOVE_CARD', actionId: 'granted-free-action', instanceId: mode.instanceId, to })
      } else {
        moveCard(mode.actionId, mode.instanceId, to)
      }
      return setMode(null)
    }
    if (mode?.kind === 'move-hero-dest') {
      moveHero(mode.actionId, mode.heroInstanceId, to)
      return setMode(null)
    }
    if (mode?.kind !== 'place') return
    // Ratigan — Félicia : à la pose, défausser un Allié de son lieu OU payer 2 de plus.
    const placing = user.hand.find((c) => c.instanceId === mode.instanceId)
    const orPay = placing && (placing.effects ?? []).find((e) => e.type === 'DISCARD_ALLY_AT_HOST_OR_PAY')
    if (placing && orPay && orPay.type === 'DISCARD_ALLY_AT_HOST_OR_PAY') {
      const allies = (user.board[to] ?? [])
        .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
        .map((c) => c.instanceId)
      const baseCost = effectiveCost(state, placing, to)
      const canPay = user.power >= baseCost + orPay.power
      if (allies.length === 0 && !canPay) return // injouable (lieu non proposé en principe)
      if (allies.length > 0 && canPay) {
        return setMode({ kind: 'felicia-choice', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, to, allies, baseCost, diablo: mode.diablo })
      }
      if (allies.length > 0) {
        // Défausse obligatoire (pas les moyens de payer le supplément).
        if (allies.length === 1) return playFelicia(mode.diablo, mode.actionId, mode.instanceId, to, allies[0])
        return setMode({ kind: 'felicia-pick-ally', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, to, diablo: mode.diablo })
      }
      // Paiement obligatoire (aucun Allié à défausser sur ce lieu).
      return playFelicia(mode.diablo, mode.actionId, mode.instanceId, to)
    }
    if (mode.isAttach) {
      const allies = (user.board[to] ?? []).filter(
        (c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized),
      )
      if (allies.length === 0) return // lieu non cliquable en principe
      if (allies.length === 1) {
        // playItemMaybeEngrenages fixe lui-même le mode (engrenages-pick ou null).
        return playItemMaybeEngrenages(mode.diablo, mode.actionId, mode.instanceId, to, allies[0].instanceId)
      }
      // Plusieurs Alliés sur ce lieu : on attend le clic sur la carte de l'Allié.
      return setMode({ kind: 'attach', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, to, diablo: mode.diablo })
    }
    // playItemMaybeEngrenages fixe lui-même le mode (engrenages-pick ou null).
    playItemMaybeEngrenages(mode.diablo, mode.actionId, mode.instanceId, to)
  }
  const handleAttach = (allyInstanceId: string) => {
    if (mode?.kind !== 'attach') return
    // playItemMaybeEngrenages fixe lui-même le mode (engrenages-pick ou null).
    playItemMaybeEngrenages(mode.diablo, mode.actionId, mode.instanceId, mode.to, allyInstanceId)
  }
  // ---- Glisser-déposer : jouer une carte en la déposant sur le plateau. ----
  // `dropLocationId` = lieu sous le curseur au lâcher (null si hors d'un lieu). Les
  // Alliés/Objets « de lieu » exigent un lieu ; les Événements se jouent n'importe où ;
  // les cartes à cible (Héros, association) ouvrent leur sélection habituelle.
  const playByDrag = (instanceId: string, dropLocationId: string | null) => {
    setDraggingCardId(null)
    if (!isHumanTurn) return
    const card = user.hand.find((c) => c.instanceId === instanceId)
    if (!card) return
    // Turbo-Statique : jouée sans action « Jouer une carte » (actionId sentinelle, ne
    // consomme aucune action) même si aucune action de pose n'est disponible.
    const actionId = card.playableWithoutAction ? FREE_PLAY_NO_ACTION_ID : dragPlayActionId
    if (!actionId) return
    // Objet associé à un Héros (Forme de grenouille…) : on choisit le Héros (clic).
    if (card.type === 'item' && card.attach === 'hero') {
      return setMode({ kind: 'item-attach-hero', actionId, instanceId, cardName: card.name })
    }
    // Allié / Objet / Malédiction : se POSE sur un lieu → on utilise le lieu déposé.
    if (card.type === 'ally' || card.type === 'item' || card.type === 'curse') {
      if (!dropLocationId) return // déposé hors d'un lieu : on ignore (carte de lieu)
      if (card.playOnlyAt && dropLocationId !== card.playOnlyAt) return
      // Syndrome — Omnidroïde v.10 : doit être posé sur Métroville (lâcher ailleurs ignoré).
      if (card.omnidroidForceLocation && dropLocationId !== card.omnidroidForceLocation) return
      if ((card.forbiddenLocations ?? []).includes(dropLocationId)) return // Anastasie/Javotte : pas dans la Salle de Bal
      // Le Seigneur des Ténèbres — Mort-vivant du Chaudron : Chaudron actif + lieu portant
      // des Anciens Soldats (sinon dépôt ignoré).
      if (card.requiresPoweredCauldron && user.blackCauldron !== 'powered') return
      if (card.consumesItemCardId && !(user.board[dropLocationId] ?? []).some((c) => c.cardId === card.consumesItemCardId && c.type === 'item' && !c.attachedTo)) return
      if ((user.lockedLocations ?? []).includes(dropLocationId)) return // lieu verrouillé
      // Félicia (défausser un Allié OU payer) : flux complet via le mode 'place'.
      if ((card.effects ?? []).some((e) => e.type === 'DISCARD_ALLY_AT_HOST_OR_PAY')) {
        return setMode({ kind: 'place', actionId, instanceId, cardName: card.name, isAttach: false })
      }
      if (card.type === 'item' && card.attach === 'ally') {
        const allies = (user.board[dropLocationId] ?? []).filter((c) => c.type === 'ally' || (c.type === 'hero' && c.hypnotized))
        if (allies.length === 0) return // aucun hôte sur ce lieu
        if (allies.length === 1) return playItemMaybeEngrenages(undefined, actionId, instanceId, dropLocationId, allies[0].instanceId)
        return setMode({ kind: 'attach', actionId, instanceId, cardName: card.name, to: dropLocationId })
      }
      return playItemMaybeEngrenages(undefined, actionId, instanceId, dropLocationId)
    }
    // Cartes à cible : on ouvre la sélection habituelle (le joueur clique ensuite).
    if (cardNeedsAllyMove(card)) return setMode({ kind: 'trap-pick-ally', actionId, instanceId, cardName: card.name })
    if (cardNeedsVanquishTarget(card)) return setMode({ kind: 'vanquish-pick-hero', actionId, viaCard: { instanceId, cardName: card.name } })
    if (cardNeedsHeroTarget(card)) return setMode({ kind: 'play-pick-hero', actionId, instanceId, cardName: card.name })
    if (cardNeedsSacrificeTarget(card)) {
      if (sacrificeableCards(state).length === 0) return
      return setMode({ kind: 'sacrifice-pick', actionId, instanceId, cardName: card.name })
    }
    if (cardNeedsStarAllyTarget(card)) {
      if ((user.observatoryStars ?? 0) <= 0 || drainStarAllies(state).length === 0) return
      return setMode({ kind: 'drain-pick-ally', actionId, instanceId, cardName: card.name })
    }
    if (card.cardId === 'impuissance') return setMode({ kind: 'impuissance-choice', actionId, instanceId, cardName: card.name })
    if (card.cardId === 'we-got-you-pig-keeper') return setMode({ kind: 'pigkeeper-choice', actionId, instanceId, cardName: card.name })
    // Événement classique : effet immédiat, sans lieu.
    doPlayCard(undefined, actionId, instanceId)
    setMode(null)
  }
  // Glissé d'un Allié/Objet DÉJÀ posé (action « Déplacer un Objet ou un Allié ») : on
  // le déplace vers le lieu lâché s'il est une destination valide (voisin / Roadster /
  // Titan, non verrouillé, non bloqué par Cendrillon en robe de bal). Sinon : annulé.
  const moveByDrag = (instanceId: string, dropLocationId: string | null) => {
    setDraggingCardId(null)
    if (!dragMoveActionId || !isHumanTurn || !dropLocationId) return
    const from = user.locations.map((l) => l.id).find((id) => (user.board[id] ?? []).some((c) => c.instanceId === instanceId))
    if (!from || from === dropLocationId) return
    const card = (user.board[from] ?? []).find((c) => c.instanceId === instanceId)
    if (!card) return
    const dests = card.isTitan
      ? titanReachableDests(state, HUMAN, instanceId, 1)
      : card.cardId === 'roadster'
        ? user.locations.map((l) => l.id)
        : adjacentLocationIds(state, from)
    const locked = new Set(user.lockedLocations ?? [])
    const ok =
      dests.includes(dropLocationId) &&
      !locked.has(dropLocationId) &&
      !(card.forbiddenLocations ?? []).includes(dropLocationId) &&
      !(card.type === 'ally' && allyBlockedAt(state, HUMAN, dropLocationId))
    if (!ok) return // destination invalide → la carte « revient » sur place
    moveCard(dragMoveActionId, instanceId, dropLocationId)
    setMode(null)
  }
  // Glissé d'un HÉROS (action « Déplacer un Héros ») : on le déplace vers le lieu lâché
  // s'il est VOISIN du sien (et non verrouillé de part et d'autre). Sinon : annulé.
  const moveHeroByDrag = (instanceId: string, dropLocationId: string | null) => {
    setDraggingCardId(null)
    if (!dragHeroActionId || !isHumanTurn || !dropLocationId) return
    const from = user.locations.map((l) => l.id).find((id) => (user.board[id] ?? []).some((c) => c.instanceId === instanceId))
    if (!from || from === dropLocationId) return
    const card = (user.board[from] ?? []).find((c) => c.instanceId === instanceId)
    if (!card || card.type !== 'hero') return
    const locked = new Set(user.lockedLocations ?? [])
    if (locked.has(from) || locked.has(dropLocationId)) return
    if (!adjacentLocationIds(state, from).includes(dropLocationId)) return // pas voisin → annulé
    moveHero(dragHeroActionId, instanceId, dropLocationId)
    setMode(null)
  }
  // Lieu sous le curseur (null si hors du plateau du joueur), déduit de la géométrie des pions.
  const locUnderPointer = (x: number, y: number): string | null => {
    // Sa Sucrerie — 4 zones, comme un plateau classique. On les vise de DEUX façons :
    //  1) en lâchant sur une cellule de zone de la grille du bas (data-board-loc) ;
    //  2) en lâchant sur l'IMAGE du circuit (geste classique) : les 4 rectangles dessinés
    //     sont aux positions standard (26,5 / 47,5 / 68,5 / 89,5 %), donc on mappe
    //     l'abscisse → zone, exactement comme les autres plateaux.
    if (user.villain === 'sa-sucrerie') {
      for (const z of ['zone-1', 'zone-2', 'zone-3', 'zone-4']) {
        const r = document.querySelector(`[data-board-loc="${user.villain}:${z}"]`)?.getBoundingClientRect()
        if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z
      }
      const rect = userBoardRef.current?.getBoundingClientRect()
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const xPct = ((x - rect.left) / rect.width) * 100
        const i = Math.round((xPct - PAWN_FIRST_LEFT) / PAWN_STEP)
        if (i >= 0 && i <= 3) return `zone-${i + 1}`
      }
      return null
    }
    // Lâcher sur la RANGÉE HÉROS (rangée du haut, AU-DESSUS de l'image du plateau) : on
    // teste les rectangles des cases Héros (data-hero-cell). Indispensable pour déplacer un
    // Héros en le glissant directement sur la case Héros d'un lieu voisin (sinon le lâcher,
    // trop haut au-dessus du plateau, était rejeté par la logique d'image ci-dessous).
    for (const cell of document.querySelectorAll(`[data-hero-cell^="${user.villain}:"]`)) {
      const r = cell.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const locId = cell.getAttribute('data-hero-cell')!.split(':').slice(1).join(':')
        if (user.locations.some((l) => l.id === locId)) return locId
      }
    }
    const rect = userBoardRef.current?.getBoundingClientRect()
    if (!rect) return null
    // Zone de dépose ÉLARGIE : on tolère une marge autour du plateau (vertical surtout,
    // pour attraper les lâchers un peu hauts/bas) et on CLAMPE l'abscisse à la colonne
    // de lieu la plus proche — n'importe quel lâcher au-dessus du plateau se pose donc
    // sur une case lieu (plus besoin de viser pile la colonne).
    const mx = rect.width * 0.03
    const my = rect.height * 0.1
    if (x < rect.left - mx || x > rect.right + mx || y < rect.top - my || y > rect.bottom + my) return null
    const xPct = ((x - rect.left) / rect.width) * 100
    const raw = Math.round((xPct - PAWN_FIRST_LEFT) / PAWN_STEP)
    const i = Math.max(0, Math.min(user.locations.length - 1, raw))
    return user.locations[i].id
  }
  // La carte glissée se POSE-t-elle sur un lieu (Allié/Objet/Malédiction) ? Sinon (Événement,
  // carte à cible) on ne met pas en surbrillance un lieu précis. Un Allié/Objet DÉPLACÉ
  // depuis le plateau ('move') vise toujours un lieu → surbrillance.
  const draggedIsLocationCard = (instanceId: string): boolean => {
    if (dragKindRef.current === 'move' || dragKindRef.current === 'hero') return true
    const card = user.hand.find((c) => c.instanceId === instanceId)
    return !!card && (card.type === 'ally' || card.type === 'curse' || (card.type === 'item' && card.attach !== 'hero'))
  }
  // Boucle d'animation : le fantôme rattrape le curseur avec une micro-inertie (lerp) et
  // s'incline selon la vitesse horizontale. Pilotée en impératif (style DOM) → aucun
  // re-render React par image, donc parfaitement fluide même si App est volumineux.
  const stepDragGhost = () => {
    const el = dragGhostElRef.current
    if (el) {
      const t = dragTargetRef.current
      const r = dragRenderRef.current
      const k = 0.35 // facteur de rattrapage (1 = instantané, plus bas = plus d'inertie)
      r.x += (t.x - r.x) * k
      r.y += (t.y - r.y) * k
      const tilt = Math.max(-18, Math.min(18, (t.x - r.x) * 0.7))
      el.style.left = `${r.x}px`
      el.style.top = `${r.y}px`
      el.style.transform = `translate(-50%, -50%) rotate(${tilt}deg)`
    }
    dragRafRef.current = requestAnimationFrame(stepDragGhost)
  }
  const stopDragGhost = () => {
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
  }
  // Sécurité : on annule la boucle rAF du fantôme si le composant est démonté en plein glissé.
  useEffect(() => () => {
    if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current)
  }, [])
  // Début du glissé : on affiche le fantôme (clone de la carte) qui suivra le curseur.
  const handleCardDragStart = (instanceId: string, x: number, y: number) => {
    // Source : carte de la main (pose), HÉROS du plateau (déplacement de Héros) ou
    // Allié/Objet du plateau (déplacement classique).
    if (user.hand.some((c) => c.instanceId === instanceId)) {
      dragKindRef.current = 'play'
    } else {
      const onBoard = Object.values(user.board).flat().find((c) => c.instanceId === instanceId)
      dragKindRef.current = onBoard?.type === 'hero' ? 'hero' : 'move'
    }
    dragTargetRef.current = { x, y }
    dragRenderRef.current = { x, y }
    dragInstanceRef.current = instanceId
    setDraggingCardId(instanceId)
    setDragGhost({ instanceId, x, y })
    if (draggedIsLocationCard(instanceId)) setDragOverLoc(locUnderPointer(x, y))
    if (dragRafRef.current == null) dragRafRef.current = requestAnimationFrame(stepDragGhost)
  }
  const handleCardDragMove = (x: number, y: number) => {
    dragTargetRef.current = { x, y } // la boucle rAF se charge du rendu fluide
    const id = dragInstanceRef.current
    if (id && draggedIsLocationCard(id)) setDragOverLoc(locUnderPointer(x, y)) // React bail si inchangé
  }
  // Lâcher : si le curseur est sur le plateau, on joue la carte (lieu déduit de X).
  const handleCardDragDrop = (instanceId: string, x: number, y: number) => {
    stopDragGhost()
    dragInstanceRef.current = null
    setDragGhost(null)
    setDragOverLoc(null)
    const loc = locUnderPointer(x, y)
    const rect = userBoardRef.current?.getBoundingClientRect()
    const overImage = !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    const isKC = user.villain === 'sa-sucrerie'
    // Sa Sucrerie : `loc` couvre déjà les 4 zones (cellule de grille OU rectangle dessiné
    // sur l'image, mappé par l'abscisse). On pose donc dès qu'une zone est visée. Pour les
    // autres : on pose si on est sur l'image OU si `loc` a été déduit (ex. lâcher sur la
    // RANGÉE HÉROS, au-dessus de l'image — nécessaire pour déplacer un Héros au curseur).
    const onBoard = isKC ? loc != null : overImage || loc != null
    if (onBoard) {
      // Petite animation de « pose » sur le lieu visé (pulse), puis on joue/déplace.
      if (loc) {
        setDropPulseLoc(loc)
        window.setTimeout(() => setDropPulseLoc((l) => (l === loc ? null : l)), 450)
      }
      // Héros déplacé ('hero'), Allié/Objet déplacé ('move'), ou carte de la main ('play').
      if (dragKindRef.current === 'hero') moveHeroByDrag(instanceId, loc)
      else if (dragKindRef.current === 'move') moveByDrag(instanceId, loc)
      else playByDrag(instanceId, loc)
    } else {
      setDraggingCardId(null) // lâché hors du plateau : on annule (retour en main / sur place)
    }
  }
  // Annulation explicite (clic droit pendant le glissé) : la carte revient en main.
  const cancelDrag = () => {
    stopDragGhost()
    dragInstanceRef.current = null
    setDragGhost(null)
    setDragOverLoc(null)
    setDraggingCardId(null)
  }
  // ─── Sa Sucrerie — déplacement du pion sur le CIRCUIT EN HUIT par glisser-déposer ───
  // Le pion ne « change pas de lieu » : il avance de 1 à 4 cases (2–3 avec Félix Fixe
  // Jr.). On saisit le pion ; les cases atteignables s'allument ; on le lâche sur l'une
  // d'elles → MOVE_TRACK. (Remplace l'ancienne bannière « avance de N cases ».)
  const userIsKingCandy = user.villain === 'sa-sucrerie'
  const kcMoveRange = (): { min: number; max: number } => {
    const felix = Object.values(user.board)
      .flat()
      .some((c) => c.type === 'hero' && c.cardId === 'felix-fixe-jr' && !c.hypnotized)
    return felix ? { min: 2, max: 3 } : { min: 1, max: 4 }
  }
  // Cases atteignables depuis la position courante : { steps, idx, x, y } (idx = case du
  // circuit, x/y = % sur l'image). Le croisement (a4/a13) ne peut jamais être atteint
  // deux fois dans la même fenêtre (9 cases d'écart) → pas d'ambiguïté.
  const kcReachableCases = (): { steps: number; idx: number; x: number; y: number }[] => {
    if (!userIsKingCandy) return []
    const { min, max } = kcMoveRange()
    const pos = user.trackPos ?? 0
    const out: { steps: number; idx: number; x: number; y: number }[] = []
    for (let s = min; s <= max; s++) {
      const idx = (pos + s) % SUGAR_RUSH_TRACK.length
      out.push({ steps: s, idx, x: SUGAR_RUSH_TRACK[idx].x, y: SUGAR_RUSH_TRACK[idx].y })
    }
    return out
  }
  // Case atteignable la plus proche du curseur (en % de l'image), dans un rayon de ~4 %.
  const trackCaseUnderPointer = (x: number, y: number): { steps: number; idx: number } | null => {
    const rect = userBoardRef.current?.getBoundingClientRect()
    if (!rect) return null
    const xPct = ((x - rect.left) / rect.width) * 100
    const yPct = ((y - rect.top) / rect.height) * 100
    let best: { steps: number; idx: number; d: number } | null = null
    for (const c of kcReachableCases()) {
      const d = Math.hypot(c.x - xPct, c.y - yPct)
      if (d <= 6 && (!best || d < best.d)) best = { steps: c.steps, idx: c.idx, d }
    }
    return best ? { steps: best.steps, idx: best.idx } : null
  }
  const [kcHoverCase, setKcHoverCase] = useState<number | null>(null)

  // ─── Glisser le PION pour se déplacer (remplace le bouton « Choisir »). ───
  // Réutilise la boucle rAF du fantôme + locUnderPointer ; seuls les lieux LÉGAUX
  // (legalMoves) s'allument et acceptent le lâcher.
  const handlePawnDragStart = (x: number, y: number) => {
    dragKindRef.current = 'pawn'
    dragTargetRef.current = { x, y }
    dragRenderRef.current = { x, y }
    setDraggingPawn(true)
    setDragGhost({ instanceId: '', x, y, pawnSrc: user.pawnImage })
    if (userIsKingCandy) setKcHoverCase(trackCaseUnderPointer(x, y)?.idx ?? null)
    else {
      const loc = locUnderPointer(x, y)
      setDragOverLoc(loc && legalMoves.includes(loc) ? loc : null)
    }
    if (dragRafRef.current == null) dragRafRef.current = requestAnimationFrame(stepDragGhost)
  }
  const handlePawnDragMove = (x: number, y: number) => {
    dragTargetRef.current = { x, y } // rendu fluide via la boucle rAF
    if (userIsKingCandy) setKcHoverCase(trackCaseUnderPointer(x, y)?.idx ?? null)
    else {
      const loc = locUnderPointer(x, y)
      setDragOverLoc(loc && legalMoves.includes(loc) ? loc : null)
    }
  }
  const handlePawnDragDrop = (x: number, y: number) => {
    stopDragGhost()
    setDragGhost(null)
    setDragOverLoc(null)
    setDraggingPawn(false)
    setKcHoverCase(null)
    // Sa Sucrerie — lâché sur une case atteignable du circuit → avance d'autant de cases.
    if (userIsKingCandy) {
      const hit = trackCaseUnderPointer(x, y)
      if (hit) handleMoveTrack(hit.steps)
      return
    }
    const loc = locUnderPointer(x, y)
    if (loc && legalMoves.includes(loc)) {
      setDropPulseLoc(loc)
      window.setTimeout(() => setDropPulseLoc((l) => (l === loc ? null : l)), 450)
      // ZA WARUDO! : relocalisation gratuite ; sinon déplacement de tour classique.
      if (zaActive) zaWarudoRelocate(loc)
      else handleMove(loc)
    }
    // Lâché ailleurs (ou sur le lieu courant) : le pion reste sur place.
  }
  const handlePawnDragCancel = () => {
    stopDragGhost()
    setDragGhost(null)
    setDragOverLoc(null)
    setDraggingPawn(false)
    setKcHoverCase(null)
  }
  // Le pion est saisissable seulement quand un vrai déplacement est possible et que
  // le pion est déjà posé (au 1ᵉʳ déplacement, on clique le lieu : pas encore de pion).
  const pawnDraggable =
    isHumanTurn &&
    // Phase MOVE classique, OU phase ACTION pendant ZA WARUDO! (relocalisation libre).
    (state.phase === 'MOVE' || zaActive) &&
    user.pawnLocation != null &&
    // Sa Sucrerie : le pion avance sur le circuit (pas de legalMoves de lieu) → toujours
    // saisissable pendant sa phase MOVE. Autres vilains : au moins un lieu légal.
    (userIsKingCandy || legalMoves.length > 0)
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
      // Défausse facultative : n'importe quel nombre (0 inclus). Sinon : exactement `count`.
      if (tyrannyDiscard.optional || tyrannyPicks.length === tyrannyDiscard.count) {
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
    else if (a.type === 'CATCH_POKEMON')
      setMode((m) =>
        m?.kind === 'vanquish-pick-hero' && m.actionId === a.id ? null : { kind: 'vanquish-pick-hero', actionId: a.id, catch: true },
      )
    else if (a.type === 'ACTIVATE') {
      const cards = activatableCards(state)
      // Le Seigneur des Ténèbres : l'action « Activer » (donnée par les Squelettes de
      // Soldats) sert à RÉVEILLER le Chaudron Magique en sa possession — ce vilain n'a
      // aucune carte à capacité activée.
      if (cards.length === 0 && user.blackCauldron === 'claimed') activateCauldron()
      // Une seule carte activable → on enchaîne directement ; sinon, fenêtre de choix.
      else if (cards.length === 1) startActivate(a.id, cards[0])
      else if (cards.length > 1) setActivatePick({ actionId: a.id })
    }
    else if (a.type === 'OBTAIN_KEY') obtainKey(a.id) // Seigneur des clés → ouvre pendingKey
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
    } else if (card.cardId === 'baignoire' && from) {
      // Oogie — Baignoire : choisir le lieu où la déplacer (les Alliés de son ancien lieu
      // l'y suivront). Réutilise le mode de choix de destination d'Iago.
      setMode({ kind: 'activate-iago-dest', actionId, cardInstanceId: card.instanceId, from })
    } else {
      activate(actionId, card.instanceId)
      setMode(null)
    }
  }
  /** Iago activé : destination choisie → déplace Iago (+ l'Objet pré-choisi). */
  const handleActivateIagoDest = (to: string) => {
    if (mode?.kind !== 'activate-iago-dest') return
    // Oogie — Baignoire : s'il y a des Alliés sur l'ancien lieu, on choisit lesquels
    // emmener (« autant que vous le désirez ») avant de déplacer la Baignoire.
    const card = Object.values(user.board).flat().find((c) => c.instanceId === mode.cardInstanceId)
    if (card?.cardId === 'baignoire') {
      const allies = (user.board[mode.from] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
      if (allies.length > 0) {
        setMode({ kind: 'baignoire-pick-allies', actionId: mode.actionId, cardInstanceId: mode.cardInstanceId, from: mode.from, to, selected: allies.map((a) => a.instanceId) })
        return
      }
      activate(mode.actionId, mode.cardInstanceId, to, undefined, [])
      setMode(null)
      return
    }
    activate(mode.actionId, mode.cardInstanceId, to, mode.itemInstanceId)
    setMode(null)
  }
  /** Baignoire : bascule la sélection d'un Allié à emmener. */
  const toggleBaignoireAlly = (instanceId: string) => {
    if (mode?.kind !== 'baignoire-pick-allies') return
    const selected = mode.selected.includes(instanceId)
      ? mode.selected.filter((id) => id !== instanceId)
      : [...mode.selected, instanceId]
    setMode({ ...mode, selected })
  }
  /** Baignoire : valide la sélection et déplace la Baignoire + Alliés cochés. */
  const confirmBaignoire = () => {
    if (mode?.kind !== 'baignoire-pick-allies') return
    activate(mode.actionId, mode.cardInstanceId, mode.to, undefined, mode.selected)
    setMode(null)
  }
  // Cruella — Finissez le travail ! : tant que l'activation gratuite est disponible
  // (drapeau freeActivate), les cartes à capacité activable du royaume deviennent
  // cliquables (clic direct → activation gratuite). Voir selectableCards / handleCardPick.
  const freeActivateMode = isHumanTurn && !!user.freeActivate && !mode
  // Cruella — Quels idiots ! (phase « déplacer ») : clic direct sur l'Allié du
  // royaume à amener sur le lieu du pion.
  const quelsMovePick =
    state.pendingQuelsIdiots?.playerIndex === HUMAN && state.pendingQuelsIdiots.phase === 'move'
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
    // Team Rocket — Attraper : pas d'étape « choix des Alliés » (le Pokémon est déjà
    // vaincu/couché). On l'attrape directement → pile de Captures.
    if (mode.catch) {
      catchPokemon(mode.actionId, heroInstanceId)
      return setMode(null)
    }
    // Madame Mim — une Métamorphose de Merlin se vainc avec la Métamorphose Mim
    // correspondante, SANS choix d'alliés ni force : on résout directement (pas
    // d'étape « cocher les alliés / Total X/Y »).
    const heroCard = Object.values(user.board).flat().find((c) => c.instanceId === heroInstanceId)
    if (heroCard?.isMerlinTransformation) {
      const loc = user.locations.map((l) => l.id).find((id) => (user.board[id] ?? []).some((c) => c.instanceId === heroInstanceId))
      const mim = loc ? (user.board[loc] ?? []).find((c) => c.isMimTransformation && c.transformationTarget === heroCard.cardId) : undefined
      if (!mim) return // pas la bonne Métamorphose Mim sur le lieu → impossible
      if (mode.viaCard) {
        doPlayCard(mode.diablo, mode.actionId, mode.viaCard.instanceId, undefined, undefined, heroInstanceId, [mim.instanceId], mode.viaCard.allyMove)
      } else if (mode.granted) {
        performGrantedAction({ type: 'VANQUISH', actionId: 'granted-free-action', heroInstanceId, allyInstanceIds: [mim.instanceId] })
      } else {
        doVanquish(mode.diablo, mode.actionId, heroInstanceId, [mim.instanceId])
      }
      return setMode(null)
    }
    // Lotso — Buzz l'Éclair (Gardien) protège SON lieu : aucun Héros qui s'y trouve ne peut
    // être éliminé. On le signale TOUT DE SUITE (son d'erreur + message), avant le choix des
    // Alliés, plutôt que de laisser le moteur refuser à la validation.
    {
      const heroLoc = user.locations
        .map((l) => l.id)
        .find((id) => (user.board[id] ?? []).some((c) => c.instanceId === heroInstanceId))
      if (heroCard?.isBuzz) {
        showUnplayable('Buzz l’Éclair ne peut pas être éliminé.')
        return
      }
      if (!!heroLoc && (user.board[heroLoc] ?? []).some((c) => c.isBuzz && c.buzzMode === 'guardian')) {
        showUnplayable('Buzz l’Éclair (Gardien) protège ce Héros : impossible de l’éliminer.')
        return
      }
    }
    // Héros prioritaire (Citoyens d'Halloween / Prof…) : doit être éliminé AVANT les
    // autres. On le signale tout de suite plutôt que de laisser le moteur refuser.
    {
      const priority = Object.values(user.board).flat().find((c) => c.type === 'hero' && c.mustDefeatFirst)
      if (priority && !heroCard?.mustDefeatFirst) {
        showUnplayable(`Vous devez d’abord éliminer ${priority.name} avant les autres Héros.`)
        return
      }
    }
    setMode({
      kind: 'vanquish-pick-allies',
      actionId: mode.actionId,
      heroInstanceId,
      heroName,
      // Uniforme : l'Allié porteur est présélectionné (obligatoire).
      selected: mode.requiredAllyId ? [mode.requiredAllyId] : [],
      viaCard: mode.viaCard,
      diablo: mode.diablo,
      granted: mode.granted,
      trap: mode.trap,
      requiredAllyId: mode.requiredAllyId,
      catch: mode.catch,
    })
  }
  const handleVanquishToggleAlly = (allyInstanceId: string) =>
    setMode((m) => {
      if (m?.kind !== 'vanquish-pick-allies') return m
      // Uniforme : l'Allié porteur ne peut pas être décoché (participation obligatoire).
      if (m.requiredAllyId === allyInstanceId) return m
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
    } else if (mode.granted) {
      // Gaston — Belle est à moi : Vanquish gratuit (action synthétique côté moteur).
      performGrantedAction({
        type: 'VANQUISH',
        actionId: 'granted-free-action',
        heroInstanceId: mode.heroInstanceId,
        allyInstanceIds: mode.selected,
      })
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
        mode.kind === 'impuissance-pick-hero' ||
        mode.kind === 'pigkeeper-choice' ||
        mode.kind === 'pigkeeper-pick-hero' ||
        mode.kind === 'engrenages-pick' ||
        mode.kind === 'felicia-choice' ||
        mode.kind === 'felicia-pick-ally'
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
  // Défausse facultative (J'allais oublier un détail) : aucun nombre imposé → on
  // peut confirmer même à 0 carte. Sinon (Tyrannie) : exactement `count`.
  const discardRequired = tyrannyDiscard && !tyrannyDiscard.optional ? tyrannyDiscard.count : undefined
  const discardCanConfirm = tyrannyDiscard?.optional
    ? true
    : discardRequired !== undefined
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
    // Tamatoa — Crustacé : pose de l'Objet dévoilé par CLIC sur un lieu (pas de modale).
    state.pendingCrustaceanPlace?.playerIndex === HUMAN
      ? user.locations.map((l) => l.id).filter((id) => !(user.lockedLocations ?? []).includes(id))
      : mode?.kind === 'place'
      ? user.locations
          .map((l) => l.id)
          .filter((id) => {
            // Sa Sucrerie : on pose dans les 4 zones, jamais sur le circuit.
            if (user.villain === 'sa-sucrerie' && id === 'sugar-rush') return false
            // Carte à pose restreinte (Lampe Merveilleuse → Caverne uniquement).
            if (cardInPlay?.playOnlyAt && id !== cardInPlay.playOnlyAt) return false
            // Anastasie/Javotte : pas dans la Salle de Bal (lieux interdits par carte).
            if ((cardInPlay?.forbiddenLocations ?? []).includes(id)) return false
            // Cendrillon en robe de bal : aucun Allié sur la Salle de Bal.
            if (cardInPlay?.type === 'ally' && allyBlockedAt(state, HUMAN, id)) return false
            // Le Seigneur des Ténèbres — Mort-vivant du Chaudron : Chaudron actif + lieu
            // portant des Anciens Soldats.
            if (cardInPlay?.requiresPoweredCauldron && user.blackCauldron !== 'powered') return false
            if (
              cardInPlay?.consumesItemCardId &&
              !(user.board[id] ?? []).some((c) => c.cardId === cardInPlay.consumesItemCardId && c.type === 'item' && !c.attachedTo)
            )
              return false
            // Ratigan — Félicia : injouable sur un lieu où l'on ne peut ni défausser
            // un Allié, ni (faute de Pouvoir) payer le supplément de 2.
            if (cardInPlay) {
              const fel = (cardInPlay.effects ?? []).find((e) => e.type === 'DISCARD_ALLY_AT_HOST_OR_PAY')
              if (fel && fel.type === 'DISCARD_ALLY_AT_HOST_OR_PAY') {
                const hasAlly = (user.board[id] ?? []).some(
                  (c) => c.type === 'ally' && !c.attachedTo && !c.isWicket,
                )
                const canPay = user.power >= effectiveCost(state, cardInPlay, id) + fel.power
                if (!hasAlly && !canPay) return false
              }
            }
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
      : mode?.kind === 'move-dest'
        ? // Un Titan (Hadès) suit ses règles propres : ≤1 lieu, bloqué par Hercule
          // sur SON lieu uniquement. Les autres cartes : lieu voisin classique.
          (() => {
            const moving = (user.board[mode.from] ?? []).find((c) => c.instanceId === mode.instanceId)
            const base = moving?.isTitan
              ? titanReachableDests(state, HUMAN, mode.instanceId, 1)
              : adjacentLocationIds(state, mode.from)
            // Anastasie/Javotte : pas dans la Salle de Bal (lieux interdits par carte).
            const noForbidden = base.filter((id) => !(moving?.forbiddenLocations ?? []).includes(id))
            // Cendrillon en robe de bal : un Allié ne peut pas rejoindre la Salle de Bal.
            return moving?.type === 'ally' ? noForbidden.filter((id) => !allyBlockedAt(state, HUMAN, id)) : noForbidden
          })()
      : mode?.kind === 'activate-iago-dest'
        ? // Oogie — Baignoire : « un AUTRE lieu » (tous les lieux non verrouillés sauf le sien) ;
          // Iago : un lieu VOISIN. On distingue via la carte activée.
          (user.board[mode.from] ?? []).some((c) => c.instanceId === mode.cardInstanceId && c.cardId === 'baignoire')
          ? user.locations.map((l) => l.id).filter((id) => id !== mode.from && !(user.lockedLocations ?? []).includes(id))
          : adjacentLocationIds(state, mode.from)
      : mode?.kind === 'move-hero-dest'
        ? [] // déplacement de Héros : la destination se choisit sur la CASE HÉROS (cf. HeroRow destTargets), pas via « poser ici »
        : mode?.kind === 'trap-pick-dest'
          ? user.locations.map((l) => l.id) // n'importe quel lieu (Tendre un Piège)
          : mode?.kind === 'sheriff-dest'
            ? user.locations
                .map((l) => l.id)
                .filter((id) => (user.board[id] ?? []).every((c) => c.instanceId !== mode.instanceId))
          : mode?.kind === 'diablo-dest'
            ? // Diablo peut RESTER sur son lieu (action gratuite sur place) OU se déplacer :
              // on propose donc TOUS les lieux, lieu actuel inclus.
              user.locations.map((l) => l.id)
            : mode?.kind === 'condition-pick-place'
              ? user.locations.map((l) => l.id) // Lâcheté : n'importe quel lieu
              : []
  const attachLocation = mode?.kind === 'attach' ? mode.to : null
  // Finis le travail (Yzma) — phase 1 : on choisit l'Allié à déplacer par clic
  // direct sur le plateau (pending moteur, pas un `mode` UI).
  const finishJobPickAlly =
    !!state.pendingFinishJob &&
    state.pendingFinishJob.playerIndex === HUMAN &&
    !state.pendingFinishJob.allyInstanceId
  // Mode « cliquer une carte » : déplacement classique OU phase 1 de Tendre un Piège.
  const selectableCards =
    mode?.kind === 'move-pick' ||
    mode?.kind === 'trap-pick-ally' ||
    mode?.kind === 'activate-pick' ||
    mode?.kind === 'sacrifice-pick' ||
    mode?.kind === 'drain-pick-ally' ||
    mode?.kind === 'felicia-pick-ally' ||
    finishJobPickAlly ||
    freeActivateMode ||
    quelsMovePick
  // Liste PRÉCISE des cartes cliquables pour les modes restreints aux Alliés
  // (épuisement d'énergie : Allié sur l'Observatoire ; Tendre un Piège : Allié à
  // déplacer) — sans elle, les Objets seraient à tort surlignés/cliquables.
  const selectableCardIds: string[] | null =
    mode?.kind === 'activate-pick' || freeActivateMode
      ? activatableCards(state).map((c) => c.instanceId)
      : quelsMovePick
      ? state.pendingQuelsIdiots?.candidateIds ?? []
      : mode?.kind === 'drain-pick-ally'
      ? drainStarAllies(state).map((c) => c.instanceId)
      : mode?.kind === 'felicia-pick-ally'
      ? (user.board[mode.to] ?? [])
          .filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
          .map((c) => c.instanceId)
      : mode?.kind === 'trap-pick-ally' || finishJobPickAlly
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
    mode?.kind === 'impuissance-pick-hero' ||
    mode?.kind === 'pigkeeper-pick-hero'
      ? (() => {
          const allHeroes = Object.values(user.board).flatMap((cards) =>
            cards.filter((c) => c.type === 'hero' && !c.isPrisoner),
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
              return allHeroes
                .filter((h) => (h.strength ?? 0) <= limit.maxStrength)
                // Sale voleuse ! : cible restreinte (Cendrillon / robe de bal).
                .filter((h) => !limit.onlyCardIds || limit.onlyCardIds.includes(h.cardId))
                .map((c) => c.instanceId)
            }
            // Sombra — Boop ! : seuls les Héros PAS déjà piratés sont ciblables.
            if (card?.effects?.some((e) => e.type === 'HACK_HERO')) {
              return allHeroes.filter((h) => !h.abilityHacked).map((c) => c.instanceId)
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
          // Méchanceté : héros ≤4 force. Double jeu (Gothel) : héros ≤3.
          // Enfermée (Trémaine) : n'importe quel Héros NON encore piégé.
          if (mode?.kind === 'condition-pick-hero') {
            const cond = user.hand.find((c) => c.instanceId === mode.instanceId)
            if (cond?.cardId === 'enfermes') {
              return allHeroes.filter((h) => !h.trapped).map((c) => c.instanceId)
            }
            const maxStr = cond?.cardId === 'double-jeu' ? 3 : 4
            return allHeroes.filter((h) => (h.strength ?? 0) <= maxStr).map((c) => c.instanceId)
          }
          // Impuissance (branche Éliminer) : Héros ≤3 force.
          if (mode?.kind === 'impuissance-pick-hero') {
            return allHeroes.filter((h) => (h.strength ?? 0) <= 3).map((c) => c.instanceId)
          }
          // On te tient (branche Éliminer) : Héros de force ≤1.
          if (mode?.kind === 'pigkeeper-pick-hero') {
            return allHeroes.filter((h) => (h.strength ?? 0) <= 1).map((c) => c.instanceId)
          }
          // Troupeau de gnous : Vanquish restreint au nouveau lieu du Héros repoussé.
          if (mode?.kind === 'vanquish-pick-hero' && mode.vanquishLocationId) {
            return (user.board[mode.vanquishLocationId] ?? [])
              .filter((c) => c.type === 'hero')
              .map((c) => c.instanceId)
          }
          // Team Rocket — Attraper : seuls les Pokémon DÉJÀ VAINCUS (couchés, K.O.) sont
          // ciblables (on les attrape ; pas de combat).
          if (mode?.kind === 'vanquish-pick-hero' && mode.catch) {
            return allHeroes.filter((h) => h.isPokemon && h.pokemonKO).map((c) => c.instanceId)
          }
          // Vaincre : tous les Héros SAUF les Pokémon déjà couchés (eux s'attrapent).
          if (mode?.kind === 'vanquish-pick-hero') {
            return allHeroes.filter((h) => !h.pokemonKO).map((c) => c.instanceId)
          }
          return allHeroes.map((c) => c.instanceId)
        })()
      : []
  // Capture (Ratigan) : choix du Héros à déplacer PAR CLIC DIRECT sur le plateau
  // (destination imposée → `forcedLocationId`). On surligne les Héros candidats du
  // royaume du joueur ; cliquer en déplace un directement (pas de modal). Les autres
  // cas de pendingHeroRelocate (choix d'un lieu) gardent le modal.
  const relocateHeroTargets: string[] = (() => {
    const phr = state.pendingHeroRelocate
    if (!phr || phr.chooserIndex !== HUMAN || phr.forcedLocationId === undefined) return []
    const heroes = Object.values(user.board)
      .flat()
      .filter((c) => c.type === 'hero')
      .map((c) => c.instanceId)
    return phr.candidateIds ? heroes.filter((id) => phr.candidateIds!.includes(id)) : heroes
  })()

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
          // Alliés « à distance » (donnée `reachesAdjacentVanquish`) : Archers Loups
          // (Prince Jean), Flibustiers (Crochet), Cerbère (Hadès), Cavaliers du roi
          // (Mère Gothel)… peuvent éliminer un Héros d'un lieu VOISIN non bloqué.
          const adjArchers = adjacentLocationIds(state, heroLoc).flatMap((adj) =>
            simulatedAt(adj).filter(
              (c) =>
                (c.reachesAdjacentVanquish || c.cardId === 'archers-loups' || c.cardId === 'flibustiers') &&
                !c.isWicket,
            ),
          )
          // Team Rocket — Persian (reachesAnyLocationVanquish) : utilisable depuis n'importe
          // quel lieu pour éliminer un Héros (hors le lieu du Héros, déjà compté en local).
          const anyReach = user.locations
            .filter((l) => l.id !== heroLoc)
            .flatMap((l) => simulatedAt(l.id).filter((c) => c.type === 'ally' && !c.isWicket && c.reachesAnyLocationVanquish))
          const heroCard = (user.board[heroLoc] ?? []).find(
            (c) => c.instanceId === mode.heroInstanceId,
          )
          const isBobby = heroCard?.cardId === 'bobby'
          // Madame Mim — une Métamorphose de Merlin ne se vainc qu'avec la Métamorphose
          // Mim correspondante (sur son lieu), sans force : on ne propose QUE celle(s)-là.
          const combined = isBobby
            ? localAllies.filter((a) => a.cardId !== 'archers-loups')
            : heroCard?.isMerlinTransformation
              ? localAllies.filter((a) => a.transformationTarget === heroCard.cardId)
              : [...localAllies, ...adjArchers, ...anyReach]
          return combined.map((c) => c.instanceId)
        })()
      : []
  // Ratigan — Engrenages : cartes cochables (du plateau) + sélection + coût live.
  const engrenagesCandidates = mode?.kind === 'engrenages-pick' ? mode.available : []
  const engrenagesSelected = mode?.kind === 'engrenages-pick' ? mode.selected : []
  const engrenagesCost =
    mode?.kind === 'engrenages-pick'
      ? Math.max(0, mode.baseCost - 3 * mode.selected.length)
      : 0
  const vanquishSelected = mode?.kind === 'vanquish-pick-allies' ? mode.selected : []
  const vanquishTotal = vanquishSelected.reduce(
    (n, id) => n + (userStrengths[id] ?? 0),
    0,
  )
  const vanquishNeeded =
    mode?.kind === 'vanquish-pick-allies'
      ? userStrengths[mode.heroInstanceId] ?? 0
      : 0
  // Madame Mim — cible = Métamorphose de Merlin : pas de force requise, il suffit
  // d'avoir sélectionné la Métamorphose Mim correspondante (seule proposée).
  const vanquishHeroIsMerlin =
    mode?.kind === 'vanquish-pick-allies' &&
    Object.values(user.board).flat().find((c) => c.instanceId === mode.heroInstanceId)?.isMerlinTransformation === true

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
      className={`villain-bg isolate flex flex-col bg-[#0a0814] text-white ${
        // Mode test : la zone de jeu remplit l'écran (wrapper h-screen) et la section
        // test vient EN DESSOUS → l'écran défile pour l'atteindre.
        testMode ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'
      }`}
      style={{ backgroundImage: pageBackground, ...accentVars(userColor, botColor) }}
    >
      {/* `isolate` (isolation: isolate) : le conteneur racine crée un contexte
          d'empilement. Son fond (dégradé) se peint tout au fond ; le décor animé en
          z -1 passe JUSTE AU-DESSUS du fond mais DERRIÈRE toute l'UI (flux normal).
          Sans ce contexte, le z -1 remontait au contexte racine et le fond opaque
          du conteneur le recouvrait → invisible. */}
      {/* Décor PERMANENT par vilain : grille calquée sur `main` (mêmes colonnes
          `1fr 13rem 1fr`, mêmes gouttières) mais en `fixed inset-0` → chaque décor
          occupe la LARGEUR de sa colonne `game-board` et TOUTE la hauteur de l'écran.
          `overflow-hidden` clippe le décor à sa colonne. Au plan du fond (z -1),
          derrière l'UI et SOUS les props animés ci-dessous. */}
      <div
        className="pointer-events-none fixed inset-0 grid grid-cols-1 gap-3 px-3 lg:grid-cols-[1fr_13rem_1fr]"
        style={{ zIndex: -1 }}
        aria-hidden
      >
        {/* Chaque décor déborde vers le bord EXTÉRIEUR de l'écran (gauche pour le joueur,
            droite pour l'adversaire) : le débordement étend la colonne par-delà la
            gouttière `px-3` (sur un item de grille étiré, une marge négative AGRANDIT la
            boîte de ce côté) → on ne voit plus le trait qui délimitait le décor. */}
        <div className="relative overflow-hidden" style={{ marginLeft: '-10%' }}>
          <VillainDecor villain={humanVillainKey} side="left" />
        </div>
        <div className="hidden lg:block" />
        <div className="relative overflow-hidden" style={{ marginRight: '-10%' }}>
          <VillainDecor villain={opponentVillainKey} side="right" />
        </div>
      </div>
      {/* Décor animé : juste au-dessus du fond, derrière toute l'UI. Visible là où
          l'UI laisse voir l'arrière-plan / à travers les panneaux translucides. */}
      <BackgroundAnimation
        playerVillain={humanVillainKey}
        opponentVillain={opponentVillainKey}
        debugFire={debugAnim ?? undefined}
      />

      {/* ============================ SECTION TEST ============================
          Outils de dév (mode test) : 3 colonnes (suivi de test · mode test ·
          configuration). EN FLUX, placée EN DESSOUS de la section jeu via `order-last`
          (sections non superposées). */}
      {testMode && (
        <section className="relative z-30 order-last flex shrink-0 flex-col gap-2 border-t border-emerald-500/40 bg-[#0a0814] px-3 py-2">
          <div className="flex flex-row items-start gap-3">
            {/* Colonne 1 : Suivi de test (40%). */}
            <div className="min-w-0 flex-[2]">
              <TestChecklist />
            </div>
            {/* Colonne 2 : Mode test (40%). */}
            <div className="min-w-0 flex-[2] overflow-x-auto">
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
            </div>
            {/* Colonne 3 : Configuration (20%) — changement de plateau · animation · configuration. */}
            <div className="flex min-w-0 flex-[1] flex-col gap-2 text-xs">
              <div className="rounded-lg border border-emerald-400/40 bg-black/60 p-2">
                <div className="mb-1 font-semibold uppercase tracking-wide text-emerald-300/80">Changement de plateau</div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sky-300">Joueur</span>
                    <VillainPortraitPicker
                      value={currentVillains[0]}
                      onChange={(k) => handlePickVillain(0, k)}
                      accent={VILLAIN_COLOR[user.villain]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-red-300">Adversaire</span>
                    <VillainPortraitPicker
                      value={currentVillains[1]}
                      onChange={(k) => handlePickVillain(1, k)}
                      accent={VILLAIN_COLOR[bot.villain]}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-400/40 bg-black/60 p-2">
                <div className="mb-1 font-semibold uppercase tracking-wide text-emerald-300/80">Animation</div>
                {/* Les deux vilains EN JEU (joueur / adversaire) : test direct de leurs
                    animations — « Passage » (traversée) et « Surprise » (décor). */}
                <div className="mb-2 flex flex-col gap-1">
                  {([
                    ['player', 'left', humanVillainKey],
                    ['opponent', 'right', opponentVillainKey],
                  ] as const).map(([sideKey, busSide, vk]) => {
                    const anim = villainAnimation(vk)
                    const hasAnim = !!anim
                    // Animations bi-directionnelles : on propose « bas » (joueur) ET « haut » (adversaire).
                    // `water-cross` n'est bidirectionnel que pour une IMAGE (la vidéo Tic-Tac reste RTL).
                    const twoSidedPaths = new Set(['cross', 'sky-arc', 'drift-spin', 'jet-cross', 'eject-arc'])
                    const twoSided =
                      hasAnim &&
                      (twoSidedPaths.has(anim!.path ?? 'cross') ||
                        (anim!.path === 'water-cross' && !anim!.video))
                    const tempButtons: { label: string; side: 'player' | 'opponent'; key: string }[] = twoSided
                      ? [
                          { label: 'bas', side: 'player', key: `${sideKey}:temp:bas` },
                          { label: 'haut', side: 'opponent', key: `${sideKey}:temp:haut` },
                        ]
                      : [{ label: 'Passage', side: sideKey, key: `${sideKey}:temp` }]
                    const surpKey = `${sideKey}:surprise`
                    const surpCd = animCountdown[surpKey]
                    const hasSurp = villainHasSurprise(vk)
                    return (
                      <div key={sideKey} className="flex items-center gap-1.5">
                        <span className={`w-24 shrink-0 truncate text-xs ${sideKey === 'player' ? 'text-sky-300' : 'text-red-300'}`}>
                          {VILLAIN_REGISTRY[vk].def.name}
                        </span>
                        {tempButtons.map((b) => {
                          const cd = animCountdown[b.key]
                          return (
                            <button
                              key={b.key}
                              onClick={() => startAnimCountdown(b.key, () => fireDebugAnim(vk, b.side))}
                              disabled={!hasAnim || cd != null}
                              title="Rejouer l'animation de passage (traversée) après 3 s"
                              className="rounded border border-white/20 px-2 py-0.5 text-xs text-white/80 enabled:hover:bg-white/10 disabled:opacity-30"
                            >
                              🎬 {b.label}{cd != null ? ` — ${cd}s` : ''}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => startAnimCountdown(surpKey, () => fireSurprise(busSide))}
                          disabled={!hasSurp || surpCd != null}
                          title={hasSurp ? 'Déclencher la surprise du décor après 3 s' : 'Ce vilain n’a pas de surprise'}
                          className="rounded border border-fuchsia-400/50 px-2 py-0.5 text-xs text-fuchsia-200 enabled:hover:bg-fuchsia-500/10 disabled:opacity-30"
                        >
                          ✨ Surprise{surpCd != null ? ` — ${surpCd}s` : ''}
                        </button>
                      </div>
                    )
                  })}
                </div>
                {(() => {
                  const anim = villainAnimation(testVillain)
                  const hasAnim = !!anim
                  const twoSidedPaths = new Set(['cross', 'sky-arc', 'drift-spin', 'jet-cross'])
                  // `water-cross` est bidirectionnel quand c'est une IMAGE (Kronk de Yzma…) ; la vidéo
                  // (Tic-Tac de Crochet) reste toujours RTL → un seul bouton.
                  const twoSided =
                    hasAnim &&
                    (twoSidedPaths.has(anim!.path ?? 'cross') ||
                      (anim!.path === 'water-cross' && !anim!.video))
                  const btn =
                    'rounded px-1.5 py-0.5 text-xs text-white/80 enabled:hover:bg-white/10 disabled:opacity-30'
                  return (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-sm">🚢</span>
                      <VillainPortraitPicker
                        value={testVillain}
                        onChange={(k) => setTestVillain(k)}
                        dim={(k) => !villainAnimation(k)}
                      />
                      {twoSided ? (
                        <>
                          <button onClick={() => fireDebugAnim(testVillain, 'player')} disabled={!hasAnim} title="Côté joueur (bas)" className={btn}>
                            bas
                          </button>
                          <button onClick={() => fireDebugAnim(testVillain, 'opponent')} disabled={!hasAnim} title="Côté adversaire (haut)" className={btn}>
                            haut
                          </button>
                        </>
                      ) : (
                        <button onClick={() => fireDebugAnim(testVillain, 'player')} disabled={!hasAnim} title="Jouer l'animation" className={btn}>
                          jouer
                        </button>
                      )}
                      <span className="mx-1 w-px self-stretch bg-white/20" />
                      <button
                        onClick={() => { setTestEndKind('victory'); setTestShatterSeat('bot') }}
                        title="Aperçu : VICTOIRE (le plateau adverse explose puis l'écran de victoire)"
                        className="rounded border border-amber-400/60 px-2 py-0.5 text-amber-200 hover:bg-amber-500/10"
                      >
                        🏆 Victoire
                      </button>
                      <button
                        onClick={() => { setTestEndKind('defeat'); setTestShatterSeat('user') }}
                        title="Aperçu : DÉFAITE (votre plateau explose puis l'écran de défaite)"
                        className="rounded border border-slate-400/60 px-2 py-0.5 text-slate-200 hover:bg-slate-500/10"
                      >
                        💀 Défaite
                      </button>
                    </div>
                  )
                })()}
              </div>
              <div className="rounded-lg border border-emerald-400/40 bg-black/60 p-2">
                <div className="mb-1 font-semibold uppercase tracking-wide text-emerald-300/80">Configuration</div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    onClick={toggleHighlightActions}
                    title="Illuminer/éditer les positions des actions (plateau joueur)"
                    className={`rounded border px-2 py-0.5 hover:bg-lime-500/10 ${
                      highlightActions ? 'border-lime-400 bg-lime-400/15 text-lime-200' : 'border-lime-400/60 text-lime-200'
                    }`}
                  >
                    💡 Actions
                  </button>
                  <button
                    onClick={() => setPortraitEdit(true)}
                    title="Éditer le portrait d'un vilain collaborateur (cadre + titre)"
                    className={`rounded border px-2 py-0.5 hover:bg-lime-500/10 ${
                      portraitEdit ? 'border-lime-400 bg-lime-400/15 text-lime-200' : 'border-lime-400/60 text-lime-200'
                    }`}
                  >
                    🖼 Portrait
                  </button>
                  <button
                    onClick={() => {
                      const key = villainKeyOf(user.villain)
                      setPawnEdit({ villain: key, size: user.pawnHeightPx })
                      setSavePawnMsg(null)
                    }}
                    title="Régler la taille du pion (plateau joueur)"
                    className={`rounded border px-2 py-0.5 hover:bg-lime-500/10 ${
                      pawnEdit ? 'border-lime-400 bg-lime-400/15 text-lime-200' : 'border-lime-400/60 text-lime-200'
                    }`}
                  >
                    ♟ Pion
                  </button>
                  <button
                    onClick={() => setColorEdit(true)}
                    title="Éditer la couleur d'un vilain (pipette sur le dos de carte)"
                    className={`rounded border px-2 py-0.5 hover:bg-lime-500/10 ${
                      colorEdit ? 'border-lime-400 bg-lime-400/15 text-lime-200' : 'border-lime-400/60 text-lime-200'
                    }`}
                  >
                    🎨 Couleur méchant
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================== SECTION JEU (entête + plateau fusionnés) =====================
          Entête + plateau + barre du bas forment une zone qui REMPLIT l'écran (h-screen) ;
          elle partage le fond animé (décor). En mode test, la section test vient EN
          DESSOUS (l'écran défile). */}
      <div className="flex h-screen shrink-0 flex-col">
      <header className="relative z-30 flex items-center justify-end gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          {/* Bouton « Mode test » : outil de dév, masqué dans l'exe de bureau (joueurs)
              ET une fois en mode test (inutile — le cadre vert signale qu'on y est). */}
          {!isDesktopApp && !testMode && (
            <button
              onClick={() => {
                enterTestMode()
                setTestPicker(null)
                setTestFateError(null)
              }}
              title="Mode test : vide les deux plateaux pour composer une situation"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              🧪 Mode test
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
          {/* Sortir du mode test (relance une partie normale) — à droite du Menu. */}
          {testMode && (
            <button
              onClick={() => { reset(); setTestPicker(null); setTestFateError(null) }}
              title="Sortir du mode test (relance une partie normale)"
              className="rounded-lg border border-emerald-400/60 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/10"
            >
              ✖ Sortir du mode test
            </button>
          )}
        </div>
      </header>

      {/* ============================ SECTION JEU ============================
          3 colonnes : toi (bleu) · journal · bot (rouge). Chacune scrolle en interne.
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
            <div className="stacks-top flex h-24 w-full items-end justify-start gap-3">
              {/* Madame Mim — pioche + défausse des Métamorphoses de Merlin, juste
                  au-dessus de la pioche/défausse Fatalité (même retrait gauche que
                  `fatality-cases` pour rester aligné). Rendu seulement pour Mim. */}
              <div style={{ paddingLeft: '1%', marginBottom: '1%' }}>
                <MerlinPiles player={user} uprightWidth="w-16" />
                <MauiPiles player={user} uprightWidth="w-16" />
              </div>
              {/* Pat Hibulaire — tuiles Objectif, une au-dessus de chaque case Héros. */}
              <GoalTilesRow player={user} own />
            </div>
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
                  relocateTargets={relocateHeroTargets}
                  onRelocatePickHero={(id) => {
                    const phr = state.pendingHeroRelocate
                    if (phr?.forcedLocationId) resolveHeroRelocate(id, phr.forcedLocationId)
                  }}
                  koTargets={
                    state.pendingKoPokemon?.chooserIndex === HUMAN ? state.pendingKoPokemon.candidateIds : []
                  }
                  onKoPickPokemon={resolveKoPokemon}
                  destTargets={heroMoveDestTargets}
                  onDestPick={handlePlace}
                  gameTurn={state.turn}
                  canDiscardDeguisement={isHumanTurn && state.phase === 'ACTION' && user.power >= 2}
                  onDiscardDeguisement={discardDeguisement}
                  hiddenInstanceIds={showcaseHiddenIds}
                  redBlinkInstanceIds={robinBlinkIds}
                  fatePickable={userFatePick.pickable}
                  onFatePick={userFatePick.onPick}
                  offset={false}
                  dragHeroIds={movableHeroIds}
                  draggingInstanceId={draggingCardId}
                  onCardDragStart={handleCardDragStart}
                  onCardDragMove={handleCardDragMove}
                  onCardDragDrop={handleCardDragDrop}
                  onCardDragCancel={cancelDrag}
                />
              </div>
            </div>
          </div>
          {/* Plateau (image). Les deux joueurs sont le Prince Jean pour l'instant.
              Un Héros posé masque la rangée d'actions du haut de son lieu. */}
          <div
            className={`relative rounded-lg transition-shadow ${draggingCardId ? 'ring-2 ring-amber-400/70' : ''}`}
            ref={userBoardRef}
            // Plateau « détruit » : on masque le plateau vivant pour que l'éclat ne
            // laisse pas réapparaître le plateau intact derrière (layout préservé →
            // la mesure du rect par MirrorShatter reste correcte).
            style={userBoardDestroyed ? { visibility: 'hidden' } : undefined}
          >
            <BoardImage player={user} showPawn pawnOutline={`color-mix(in srgb, ${VILLAIN_COLOR[user.villain]}, white 45%)`} imgClassName="border border-[color:var(--pa-line-soft)]" hiddenHeroInstanceIds={showcaseHiddenIds} unmaskHeroLocationId={persifleurLoc} obstacleTargets={state.pendingObstacle && state.pendingObstacle.chooserIndex === HUMAN && state.pendingObstacle.kind === 'remove' ? user.locations.map((l) => l.id).filter((id) => (user.obstacles?.[id] ?? 0) > 0 && (!state.pendingObstacle!.sameLocation || !state.pendingObstacle!.lockedLocationId || state.pendingObstacle!.lockedLocationId === id)) : undefined} onObstacleClick={resolveObstacle} keyPick={state.pendingKey && state.pendingKey.playerIndex === HUMAN && state.pendingKey.kind === 'take' && !dieAnim ? { locationId: state.pendingKey.locationId, color: state.pendingKey.color } : undefined} onKeyClick={resolveKey} crewmateCandidates={state.pendingCrewmateKill?.playerIndex === HUMAN ? state.pendingCrewmateKill.candidateColors : undefined} onCrewmateClick={(color) => { if (state.pendingCrewmateKill?.mode === 'kill') playKillSound(); resolveCrewmateKill(color) }} crewmateSelectVerb={state.pendingCrewmateKill?.mode === 'reassure' ? 'Rassurer' : state.pendingCrewmateKill?.mode === 'kill-normal' ? 'Éliminer' : state.pendingCrewmateKill?.mode === 'move' ? 'Déplacer' : 'Défausser'} pawnDraggable={pawnDraggable} pawnDragging={draggingPawn} pawnHeightOverride={pawnEdit && pawnEdit.villain === villainKeyOf(user.villain) ? pawnEdit.size : undefined} onPawnDragStart={handlePawnDragStart} onPawnDragMove={handlePawnDragMove} onPawnDragDrop={handlePawnDragDrop} onPawnDragCancel={handlePawnDragCancel} />
            <BoardActions
              player={user}
              availableActionIds={availableActions.map((a) => a.id)}
              usedActionIds={isHumanTurn ? state.usedActionIds : []}
              blinkTopAtLocation={persifleurLoc}
              activeLocationId={state.actAtLocation || user.pawnLocation || undefined}
              flashKey={isHumanTurn ? actionFlash : null}
              onActionClick={handleBoardAction}
              hackLocationId={state.pendingHack?.playerIndex === HUMAN ? state.pendingHack.locationId : null}
              hackActionIds={state.pendingHack?.playerIndex === HUMAN ? state.pendingHack.actionIds : undefined}
              onHackPick={resolveHack}
            />
            {/* Sa Sucrerie — pendant sa phase MOVE, les cases ATTEIGNABLES (1–4 en avant)
                clignotent sur le circuit. Deux façons d'y aller : GLISSER le pion dessus,
                ou simplement CLIQUER la case (pour qui préfère le clic). La case survolée
                (au glissé) est mise en évidence. */}
            {isHumanTurn && state.phase === 'MOVE' && userIsKingCandy &&
              kcReachableCases().map((c) => (
                <button
                  key={`kc-reach-${c.idx}`}
                  type="button"
                  onClick={() => handleMoveTrack(c.steps)}
                  onMouseEnter={() => setKcHoverCase(c.idx)}
                  onMouseLeave={() => setKcHoverCase((h) => (h === c.idx ? null : h))}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 hover:scale-110"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    width: '5.4%',
                    aspectRatio: '1',
                    borderColor: kcHoverCase === c.idx ? '#fff' : 'rgba(250,204,21,0.9)',
                    backgroundColor: kcHoverCase === c.idx ? 'rgba(250,204,21,0.55)' : 'rgba(250,204,21,0.18)',
                    boxShadow: kcHoverCase === c.idx ? '0 0 16px 5px rgba(250,204,21,0.85)' : '0 0 9px 2px rgba(250,204,21,0.45)',
                    animation: kcHoverCase === c.idx ? undefined : 'kcReachPulse 1.1s ease-in-out infinite',
                  }}
                  title={`Avancer de ${c.steps} case${c.steps > 1 ? 's' : ''} (clic ou glissé du pion)`}
                />
              ))}
            {/* Le Seigneur des Ténèbres — on RÉVEILLE le Chaudron Magique via l'action
                « Activer une capacité » donnée par les Squelettes de Soldats (clic sur la
                carte/le bouton d'action de leur lieu), pas par un bouton/clic dédié. */}
            {/* Glisser-déposer : surbrillance JAUNE du lieu visé sur l'image, pendant le
                glissé (comme tous les plateaux). Sa Sucrerie : les 4 zones sont aux colonnes
                standard (zone-N → colonne N−1), donc on surligne la même colonne sur le circuit. */}
            {dragOverLoc && (() => {
              const i = userIsKingCandy
                ? Number(dragOverLoc.replace('zone-', '')) - 1
                : user.locations.findIndex((l) => l.id === dragOverLoc)
              if (i < 0) return null
              const locked = (user.lockedLocations ?? []).includes(dragOverLoc)
              return (
                <div
                  className={`pointer-events-none absolute inset-y-0 rounded-lg ring-2 transition-all duration-150 ${locked ? 'bg-red-500/10 ring-red-400/70' : 'bg-amber-300/15 ring-amber-300/80'}`}
                  style={{ left: `${PAWN_FIRST_LEFT + i * PAWN_STEP - PAWN_STEP / 2}%`, width: `${PAWN_STEP}%` }}
                />
              )
            })()}
            {/* Glisser-déposer : petite animation de « pose » au lâcher sur un lieu. */}
            {dropPulseLoc && (() => {
              const i = userIsKingCandy
                ? Number(dropPulseLoc.replace('zone-', '')) - 1
                : user.locations.findIndex((l) => l.id === dropPulseLoc)
              if (i < 0) return null
              return (
                <div
                  className="pointer-events-none absolute inset-y-0 animate-ping rounded-lg ring-4 ring-amber-300/80"
                  style={{ left: `${PAWN_FIRST_LEFT + i * PAWN_STEP - PAWN_STEP / 2}%`, width: `${PAWN_STEP}%` }}
                />
              )
            })()}
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
              <CapturePile player={user} uprightWidth="w-9" />
              <SuccessionPile player={user} uprightWidth="w-14" />
              <ImpostorPile player={user} uprightWidth="w-14" />
              <CapturedPuppiesPile
                player={user}
                uprightWidth="w-9"
                revealMode={state.pendingPuppyReveal?.playerIndex === HUMAN}
                revealRemaining={state.pendingPuppyReveal?.playerIndex === HUMAN ? state.pendingPuppyReveal.remaining : 0}
                onRevealTile={resolvePuppyReveal}
                onDoneReveal={donePuppyReveal}
                addMode={state.pendingPuppyAdd?.playerIndex === HUMAN}
                addCandidates={state.pendingPuppyAdd?.playerIndex === HUMAN ? state.pendingPuppyAdd.candidateTileIds : undefined}
                onAddTile={resolvePuppyAdd}
              />
              <ClaimedTreasuresPile player={user} />
              <CauldronTile player={user} />
              <OmnidroidPile
                player={user}
                canPlay={!!dragPlayActionId || mode?.kind === 'play'}
                onPlay={handlePlayCard}
                onCardDragStart={handleCardDragStart}
                onCardDragMove={handleCardDragMove}
                onCardDragDrop={handleCardDragDrop}
                onCardDragCancel={cancelDrag}
                draggingInstanceId={draggingCardId}
              />
            </div>
            <div className="flex-1">
              {/* Sa Sucrerie — circuit en huit : le déplacement se fait en GLISSANT le pion
                  sur une case atteignable (1–4 en avant, surlignées sur le circuit). Cette
                  barre rappelle la consigne + affiche l'état de la course. */}
              {isHumanTurn && state.phase === 'MOVE' && user.villain === 'sa-sucrerie' && (() => {
                const { min, max } = kcMoveRange()
                return (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-pink-300/40 bg-[#1a0e16]/90 px-4 py-2 shadow-lg">
                    <span className="text-sm font-semibold text-pink-100">
                      🏎️ Glissez le pion — ou cliquez — sur une case surlignée du circuit ({min === max ? `${min}` : `${min}–${max}`} case{max > 1 ? 's' : ''} en avant).
                    </span>
                    {min === 2 && max === 3 && <span className="text-xs text-pink-200/70">(Félix Fixe Jr. : 2–3 cases)</span>}
                    {user.raceActive && (
                      <span className="ml-auto text-xs font-semibold text-amber-200">
                        🏁 Course : toi case {user.trackPos ?? 0} / 18 · Pilote case {user.racerPos ?? 0} / 18
                      </span>
                    )}
                  </div>
                )
              })()}
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
                engrenagesCandidates={engrenagesCandidates}
                engrenagesSelected={engrenagesSelected}
                onEngrenagesToggle={handleEngrenagesToggle}
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
                dragMoveActionId={dragMoveActionId}
                movableDragIds={movableDragIds}
                onCardDragStart={handleCardDragStart}
                onCardDragMove={handleCardDragMove}
                onCardDragDrop={handleCardDragDrop}
                onCardDragCancel={cancelDrag}
                draggingInstanceId={draggingCardId}
                grantedActionIds={availableActions.filter((a) => a.grantedBy).map((a) => a.id)}
                onGrantedAction={handleGrantedAction}
                mapUsable={
                  isHumanTurn &&
                  state.phase === 'ACTION' &&
                  Object.values(user.board).flat().some((c) => c.cardId === 'carte-pays-imaginaire')
                }
                onUseMap={() => setMapModalOpen(true)}
                crownUsable={
                  isHumanTurn &&
                  state.phase === 'ACTION' &&
                  Object.values(user.board).flat().some((c) => c.cardId === 'couronne-gothel')
                }
                onUseCrown={(id) => setCrownConfirm(id)}
              />
            </div>
          </div>
          {finishJobPickAlly && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/70 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <span>
                <b>Finis le travail</b> : clique l'<b>Allié</b> de ton royaume à déplacer (cartes surlignées).
              </span>
            </div>
          )}
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
            mode?.kind === 'impuissance-pick-hero' ||
            mode?.kind === 'pigkeeper-choice' ||
            mode?.kind === 'pigkeeper-pick-hero' ||
            mode?.kind === 'engrenages-pick' ||
            mode?.kind === 'felicia-choice' ||
            mode?.kind === 'felicia-pick-ally') && (
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
                ) : mode.kind === 'pigkeeper-choice' ? (
                  <>
                    <b>On te tient</b> : choisis <b>Chercher Tirelire</b> ou <b>Éliminer un Héros</b> (force 1).
                  </>
                ) : mode.kind === 'pigkeeper-pick-hero' ? (
                  <>
                    <b>On te tient</b> : clique le <b>Héros</b> à éliminer (force 1, rouge).
                  </>
                ) : mode.kind === 'engrenages-pick' ? (
                  <>
                    Pose <b>{mode.cardName}</b> : coche les <b>Engrenages</b> à défausser (−3 chacun, surlignés).
                    Coût :{' '}
                    <b className={engrenagesCost <= user.power ? 'text-emerald-300' : 'text-red-300'}>
                      {engrenagesCost}
                    </b>{' '}
                    / {user.power} JT.
                  </>
                ) : mode.kind === 'felicia-choice' ? (
                  <>
                    <b>Félicia</b> : <b>défausse un Allié</b> de son lieu ou <b>paie 2 Pouvoir</b> de plus (total {mode.baseCost + 2} JT).
                  </>
                ) : mode.kind === 'felicia-pick-ally' ? (
                  <>
                    <b>Félicia</b> : clique l'<b>Allié</b> de son lieu à défausser (surligné).
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
                      vanquishHeroIsMerlin
                        ? vanquishSelected.length === 0
                        : vanquishTotal < vanquishNeeded ||
                          (vanquishSelected.length === 0 &&
                            !(vanquishNeeded === 0 && !mode.viaCard && !mode.trap))
                    }
                    className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    Éliminer
                  </button>
                )}
                {mode.kind === 'engrenages-pick' && (
                  <button
                    onClick={handleEngrenagesConfirm}
                    disabled={engrenagesCost > user.power}
                    className="rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-500 disabled:opacity-40"
                  >
                    Poser{mode.selected.length > 0 ? ` (−${mode.selected.length * 3})` : ''}
                  </button>
                )}
                {mode.kind === 'felicia-choice' && (
                  <>
                    <button
                      onClick={() => {
                        // Défausser un Allié : 1 seul → direct ; sinon, on choisit lequel.
                        if (mode.allies.length === 1) {
                          playFelicia(mode.diablo, mode.actionId, mode.instanceId, mode.to, mode.allies[0])
                        } else {
                          setMode({ kind: 'felicia-pick-ally', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, to: mode.to, diablo: mode.diablo })
                        }
                      }}
                      className="rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-500"
                    >
                      Défausser un Allié
                    </button>
                    <button
                      onClick={() => playFelicia(mode.diablo, mode.actionId, mode.instanceId, mode.to)}
                      className="rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-500"
                    >
                      Payer 2 Pouvoir
                    </button>
                  </>
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
                {mode.kind === 'pigkeeper-choice' && (() => {
                  // On te tient : « Chercher Tirelire » (si Tirelire dans la pioche/défausse
                  // Fatalité) OU « Éliminer un Héros de force 1 » (si un tel Héros est en jeu).
                  const canFetch =
                    user.fateDeck.some((c) => c.cardId === 'hen-wen') || user.fateDiscard.some((c) => c.cardId === 'hen-wen')
                  const canVanquish = Object.values(user.board).flat().some((c) => c.type === 'hero' && (c.strength ?? 0) <= 1)
                  return (
                    <>
                      <button
                        onClick={() => {
                          if (!canFetch) return
                          doPlayCard(mode.diablo, mode.actionId, mode.instanceId)
                          setMode(null)
                        }}
                        disabled={!canFetch}
                        className="rounded bg-fuchsia-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-fuchsia-500 disabled:opacity-40"
                      >
                        Chercher Tirelire
                      </button>
                      <button
                        onClick={() =>
                          setMode({ kind: 'pigkeeper-pick-hero', actionId: mode.actionId, instanceId: mode.instanceId, cardName: mode.cardName, diablo: mode.diablo })
                        }
                        disabled={!canVanquish}
                        className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
                      >
                        Éliminer un Héros (force 1)
                      </button>
                    </>
                  )
                })()}
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
          {/* Gaston — Belle est à moi / Tous avec moi : action gratuite armée. */}
          {state.grantedAction && isHumanTurn && (
            <div className="rounded-lg border border-amber-400/70 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {mode && 'granted' in mode && mode.granted ? (
                <div className="flex items-center justify-between gap-2">
                  <span>🎯 <b>{state.grantedAction.label}</b> — choisis sur le plateau.</span>
                  <button
                    onClick={() => setMode(null)}
                    className="rounded border border-amber-400/60 px-2 py-1 hover:bg-amber-400/10"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>🎯 <b>Gaston</b> : effectuez une action <b>{state.grantedAction.label}</b>.</span>
                  <button
                    onClick={() =>
                      setMode(
                        state.grantedAction!.actionType === 'VANQUISH'
                          ? { kind: 'vanquish-pick-hero', actionId: 'granted-free-action', granted: true }
                          : state.grantedAction!.actionType === 'PLAY_CARD'
                            ? { kind: 'play', actionId: 'granted-free-action' }
                            : { kind: 'move-pick', actionId: 'granted-free-action', granted: true },
                      )
                    }
                    className="rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-500"
                  >
                    {state.grantedAction.label}
                  </button>
                  <button
                    onClick={() => {
                      setMode(null)
                      skipGrantedAction()
                    }}
                    className="rounded border border-amber-400/60 px-2 py-1 hover:bg-amber-400/10"
                  >
                    Passer
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Gaston — retrait/replacement interactif des jetons Obstacle. */}
          {state.pendingObstacle && state.pendingObstacle.chooserIndex === HUMAN && (() => {
            const pen = state.pendingObstacle
            const tp = state.players[pen.targetIndex]
            const eligible = tp.locations.filter((l) => {
              const n = tp.obstacles?.[l.id] ?? 0
              if (pen.kind === 'remove') {
                if (n <= 0) return false
                if (pen.sameLocation && pen.lockedLocationId && pen.lockedLocationId !== l.id) return false
                return true
              }
              return n < 2
            })
            // RETRAIT : on clique directement le jeton Obstacle sur le plateau
            // (surligné en jaune) → pas de boutons de lieu, juste « Terminer ».
            // REPLACEMENT : pas de jeton à cliquer (emplacement vide) → boutons de lieu.
            return (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/70 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <span>🚧 <b>{pen.label}</b> — {pen.kind === 'remove' ? 'cliquez un jeton Obstacle (surligné) sur le plateau.' : 'cliquez un lieu où replacer un Obstacle.'}</span>
                {pen.kind === 'replace' && eligible.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => resolveObstacle(l.id)}
                    className="rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-500"
                  >
                    {l.name} ({tp.obstacles?.[l.id] ?? 0})
                  </button>
                ))}
                <button
                  onClick={doneObstacle}
                  className="rounded border border-amber-400/60 px-2 py-1 hover:bg-amber-400/10"
                >
                  Terminer
                </button>
              </div>
            )
          })()}
          {/* Le Seigneur des clés — choix d'une clé (pendingKey). RAMASSER : on clique
              directement la clé (surlignée) sur le plateau. PERDRE : un bouton par clé
              possédée (couleur), à reposer sur le lieu du pion. */}
          {state.pendingKey && state.pendingKey.playerIndex === HUMAN && !dieAnim && (() => {
            const pen = state.pendingKey
            const KEY_HEX: Record<string, string> = { bleu: '#3b82f6', rouge: '#ef4444', vert: '#22c55e', jaune: '#eab308', violet: '#a855f7', orange: '#f97316' }
            const owned = (user.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
            const keysAt = (lid: string) => (user.keys ?? []).filter((k) => k.location === lid && !k.stolenBy).length
            // Étape 2 (Plaisir, chooseDest) : on a choisi la clé → choisir le lieu (< 3 clés).
            if (pen.kind === 'lose' && pen.chooseDest && loseKeyId) {
              return (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-400/70 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                  <span>🔑 <b>{pen.label}</b> — sur quel lieu reposer la clé ? (lieux comptant moins de 3 clés)</span>
                  {user.locations.filter((l) => keysAt(l.id) < 3).map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { resolveKey(loseKeyId, l.id); setLoseKeyId(null) }}
                      className="rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-500"
                    >
                      {l.name} ({keysAt(l.id)})
                    </button>
                  ))}
                </div>
              )
            }
            return (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-400/70 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                <span>🔑 <b>{pen.label}</b>{pen.kind === 'take' ? ' — cliquez une clé (surlignée) sur le plateau.' : ' — choisissez une clé à reposer :'}</span>
                {pen.kind === 'lose' && owned.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => (pen.chooseDest ? setLoseKeyId(k.id) : resolveKey(k.id))}
                    className="rounded px-2 py-1 font-semibold text-white capitalize hover:brightness-110"
                    style={{ backgroundColor: KEY_HEX[k.color] ?? '#666' }}
                  >
                    {k.color}
                  </button>
                ))}
              </div>
            )
          })()}
          {/* Le Seigneur des clés — choisir une couleur avant de lancer le dé (00:00 / Minuit). */}
          {state.pendingKeyColor && state.pendingKeyColor.playerIndex === HUMAN && (() => {
            const KEY_HEX: Record<string, string> = { bleu: '#3b82f6', rouge: '#ef4444', vert: '#22c55e', jaune: '#eab308', violet: '#a855f7', orange: '#f97316' }
            return (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-400/70 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                <span>🎲 <b>Choisissez une couleur</b>, puis lancez le dé : si le dé affiche cette couleur, vous prenez une clé de cette couleur.</span>
                {(['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange'] as KeyColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => resolveKeyColor(c)}
                    className="rounded px-2 py-1 font-semibold text-white capitalize hover:brightness-110"
                    style={{ backgroundColor: KEY_HEX[c] }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )
          })()}
          {/* Le Seigneur des clés — Plaisir ou souffrance : perdre du Pouvoir ou reposer une clé. */}
          {state.pendingPlaisir && state.pendingPlaisir.playerIndex === HUMAN && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/70 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              <span>⚖️ <b>Plaisir ou souffrance</b> : choisissez votre châtiment.</span>
              <button onClick={() => resolvePlaisir('power')} className="rounded bg-rose-600 px-2 py-1 font-medium text-white hover:bg-rose-500">
                Perdre {state.pendingPlaisir.power} Pouvoir
              </button>
              <button onClick={() => resolvePlaisir('key')} className="rounded border border-rose-400/60 px-2 py-1 text-rose-200 hover:bg-rose-500/10">
                Reposer une clé
              </button>
            </div>
          )}
          {/* Le Seigneur des clés — Sorcellerie / Gévaudan : c'est NOTRE tour et nous
              attaquons le Seigneur adverse → on choisit quelle clé lui prendre (puis,
              pour Sorcellerie, sur quel lieu la reposer). */}
          {state.pendingStealKey && state.pendingStealKey.chooserIndex === HUMAN && (() => {
            const pen = state.pendingStealKey
            const tgt = state.players[pen.targetIndex]
            const KEY_HEX: Record<string, string> = { bleu: '#3b82f6', rouge: '#ef4444', vert: '#22c55e', jaune: '#eab308', violet: '#a855f7', orange: '#f97316' }
            const owned = (tgt.keys ?? []).filter((k) => k.location === null && !k.stolenBy)
            // Étape 1 : choisir la clé (une entrée par couleur distincte). Étape 2
            // (Sorcellerie) : choisir le lieu où reposer la clé déjà sélectionnée.
            const seen = new Set<string>()
            const distinct = owned.filter((k) => (seen.has(k.color) ? false : (seen.add(k.color), true)))
            return (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-400/70 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100">
                {!stealKeyId || pen.mode === 'steal' ? (
                  <>
                    <span>🗝️ <b>{pen.mode === 'steal' ? 'Gévaudan' : 'Sorcellerie'}</b> — choisissez une clé de {tgt.villainName} :</span>
                    {distinct.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => (pen.mode === 'steal' ? resolveStealKey(k.id) : setStealKeyId(k.id))}
                        className="rounded px-2 py-1 font-semibold capitalize text-white hover:brightness-110"
                        style={{ backgroundColor: KEY_HEX[k.color] ?? '#666' }}
                      >
                        {k.color}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <span>🗝️ <b>Sorcellerie</b> — reposez la clé sur quel lieu ?</span>
                    {tgt.locations.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => { resolveStealKey(stealKeyId, l.id); setStealKeyId(null) }}
                        className="rounded bg-fuchsia-600 px-2 py-1 text-white hover:bg-fuchsia-500"
                      >
                        {l.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )
          })()}
          {/* Tendre un Piège : Vanquish facultatif après le déplacement (déjà appliqué). */}
          {isHumanTurn && state.pendingTrapVanquish && !mode && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-400/70 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">
              <span>
                {state.pendingTrapVanquish.source === 'gnous' ? (
                  <>🦬 <b>Troupeau de gnous</b> : tu peux éliminer un Héros sur le nouveau lieu (facultatif).</>
                ) : state.pendingTrapVanquish.source === 'uniforme' ? (
                  <>👮 <b>Uniforme</b> : tu peux éliminer un Héros sur le lieu de l'Allié équipé — qui doit participer (facultatif).</>
                ) : state.pendingTrapVanquish.source === 'duncan' ? (
                  <>🚔 <b>Duncan et Wynnchel</b> : tu peux effectuer une action Éliminer un Héros (facultatif).</>
                ) : state.pendingTrapVanquish.source === 'race-ban' ? (
                  <>🏁 <b>Il lui est défendu de courir</b> : élimine un Héros (les Alliés utilisés ne sont pas défaussés).</>
                ) : (
                  <>🪤 <b>Tendre un Piège</b> : tu peux éliminer un Héros (facultatif).</>
                )}
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
          {/* Ratigan — Brutes : action distante FACULTATIVE sur leur lieu (les
              pastilles d'action de ce lieu, hors Fatalité, sont cliquables sur le
              plateau). Bouton « Passer » pour y renoncer. */}
          {isHumanTurn && state.actAtLocation && state.actAtLocationSkippable && !mode && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/70 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <span>
                💪 <b>Brutes</b> : effectue une action sur{' '}
                <b>{user.locations.find((l) => l.id === state.actAtLocation)?.name ?? 'leur lieu'}</b>{' '}
                (hors Fatalité), ou passe.
              </span>
              <button
                onClick={() => skipRemoteAction()}
                className="rounded border border-amber-400/60 px-2 py-1 text-amber-200 hover:bg-amber-500/10"
              >
                Passer
              </button>
            </div>
          )}
          {/* La main du joueur est désormais ancrée en bas de l'écran (éventail). */}
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
                ⏱ <GameTimer running={state.status === 'PLAYING' && startRollDone && openingDealDone} />
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
          {/* Récap du dernier tour adverse : rouvre la bande O — O — O — O. */}
          {opponentRecap && !recapOpen && isHumanTurn && (
            <button
              type="button"
              onClick={() => setRecapOpen(true)}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-slate-900/70 px-2.5 py-1 text-xs text-amber-100 hover:bg-slate-800/80"
              title={`Revoir ce que ${opponentRecap.villainName} a fait à son tour`}
            >
              <span className="text-base">🔁</span> Récap. tour adverse
            </button>
          )}
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
                    onClick={() => setPassedTurnKey(reactionKey)}
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
              {tyrannyDiscard?.optional && (
                <p className="mb-2 text-center text-[11px] font-medium text-amber-200">
                  {tyrannyDiscard.label ?? 'Défausse'} : défausse autant de cartes que tu veux (ou aucune), puis pioche jusqu’à 4.
                </p>
              )}
              <div className="flex items-center justify-center gap-2">
                {/* La confirmation de défausse est portée par le bouton bleu
                    « Défausser » (qui remplace « Fin de tour »). Ici, seul reste
                    « Annuler » — sauf en défausse obligatoire (Tyrannie / facultative
                    en attente, qui ne passent pas par `mode` et seraient bloquées). */}
                {discardRequired === undefined && !tyrannyDiscard && (
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
            <div className="stacks-top flex h-24 w-full items-end justify-start gap-3">
              {/* Madame Mim — pioche + défausse des Métamorphoses de Merlin (adversaire),
                  alignées sur la pioche/défausse Fatalité (même retrait gauche). */}
              <div style={{ paddingLeft: '1%', marginBottom: '1%' }}>
                <MerlinPiles player={bot} uprightWidth="w-16" />
                <MauiPiles player={bot} uprightWidth="w-16" />
              </div>
              {/* Pat Hibulaire — tuiles Objectif de l'adversaire (dos sauf révélées). */}
              <GoalTilesRow player={bot} />
            </div>
            <div className="fatality-cases flex items-start gap-3" style={{ paddingLeft: '1%' }}>
              <StacksCards player={bot} playerIndex={BOT} />
              <div className="flex-1">
                <HeroRow
                  player={bot}
                  strengths={botStrengths}
                  hiddenInstanceIds={showcaseHiddenIds}
                  redBlinkInstanceIds={robinBlinkIds}
                  fatePickable={botFatePick.pickable}
                  onFatePick={botFatePick.onPick}
                  offset={false}
                  gameTurn={state.turn}
                />
              </div>
            </div>
          </div>
          <div
            className="relative"
            ref={botBoardRef}
            // Idem côté bot : masquer le plateau vivant pendant qu'il est « détruit ».
            style={botBoardDestroyed ? { visibility: 'hidden' } : undefined}
          >
            <BoardImage player={bot} showPawn pawnHeightOverride={pawnEdit && pawnEdit.villain === villainKeyOf(bot.villain) ? pawnEdit.size : undefined} pawnOutline={`color-mix(in srgb, ${VILLAIN_COLOR[bot.villain]}, white 45%)`} imgClassName="border border-[color:var(--po-line-soft)]" hiddenHeroInstanceIds={showcaseHiddenIds} crewmateCandidates={state.pendingCrewmateSuspect?.chooserIndex === HUMAN && state.pendingCrewmateSuspect.targetIndex === BOT ? (bot.crewmates ?? []).filter((c) => !c.discarded && !c.suspect).map((c) => c.color) : undefined} onCrewmateClick={resolveCrewmateSuspect} crewmateSelectVerb="Rendre suspect" />
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
              <CapturePile player={bot} uprightWidth="w-9" />
              <SuccessionPile player={bot} uprightWidth="w-14" />
              <ImpostorPile player={bot} uprightWidth="w-14" />
              <CapturedPuppiesPile player={bot} uprightWidth="w-9" />
              <ClaimedTreasuresPile player={bot} />
              <CauldronTile player={bot} />
              <OmnidroidPile player={bot} />
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
              hand={bot.hand.filter((c) => !c.isOmnidroid)}
              accent={RED}
              hidden={!botHandRevealed}
              backImage={bot.backVillainImage}
              mode="idle"
              power={bot.power}
              attachTargetsAvailable={false}
              blockEvents={false}
              realmHasAllies={false}
              realmHasPuppyTile={false}
              realmHasHeroes={false}
              hasIngredients={false}
              heroAtPawn={false}
              canBite={false}
              realmHasHyena={false}
              hyenaElsewhere={false}
              fateDiscardHasCard={false}
              realActionUsed={false}
              kronkHasPowerToken={false}
              fateDiscardHasHero={false}
              poeticJusticeUsable={false}
              relocateTargetAvailable={false}
              hackTargetAvailable={false}
              pawnWithRaiponce={false}
              recoverFromDiscardAvailable={false}
              hasActivatableCard={false}
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
        <PlayerPanel player={user} accent={BLUE} isActive={state.activePlayer === HUMAN} isWinner={state.winner === HUMAN} subLabel={userSubLabel} avatar={<PlayerAvatar size={36} />} />
        {/* Main du joueur (centre), légèrement relevée. */}
        <div data-hand-zone={HUMAN} className="-translate-y-4">
          <Hand
            hand={user.hand.filter((c) => !c.isOmnidroid)}
            accent={BLUE}
            hidden={false}
            dealManaged
            dealHiddenIds={
              // Cartes masquées car « en vol » dans l'overlay. Ouverture : la main reste
              // masquée dès l'écran « versus » jusqu'à la fin de la distribution (avant la
              // construction de l'overlay → tout masqué, sinon on l'apercevrait derrière
              // l'écran semi-transparent). En cours de partie : seules les cartes de la pioche
              // en cours (`dealHiddenIds`). Mode test → rien.
              testMode
                ? undefined
                : !openingDealDone
                  ? dealOverlay
                    ? dealHiddenIds
                    : user.hand.filter((c) => !c.isOmnidroid).map((c) => c.instanceId)
                  : dealHiddenIds
            }
            backImage={user.backVillainImage}
            mode={handMode}
            power={user.power}
            attachTargetsAvailable={anyAllyOnBoard}
            blockEvents={humanEventsBlocked}
            realmHasAllies={anyAllyOnBoard}
            realmHasPuppyTile={(user.puppyTiles ?? []).some((t) => t.state === 'board')}
            realmHasHeroes={anyHeroOnBoard}
            raceBanPlayable={(anyAllyOnBoard && anyHeroOnBoard) || !!user.raceActive}
            realmHasFire={Object.values(user.fireTokens ?? {}).some((a) => a.length > 0)}
            realmHasFacedownTreasure={user.locations.some((l) => (user.board[l.id] ?? []).some((c) => c.type === 'hero' && c.treasure && !c.treasure.faceUp))}
            bargainPlayable={(() => {
              // Nous avons conclu un marché ! : jouable si défausse non vide OU Épée Magique
              // défaussable pour le Chaudron (Épée présente, Pouvoir suffisant, Chaudron pas pris).
              const card = user.hand.find((c) => (c.effects ?? []).some((e) => e.type === 'BARGAIN_RESHUFFLE_OR_SWORD'))
              const eff = card?.effects?.find((e) => e.type === 'BARGAIN_RESHUFFLE_OR_SWORD')
              if (!card || !eff || eff.type !== 'BARGAIN_RESHUFFLE_OR_SWORD') return true
              const hasSword = Object.values(user.board).flat().some((c) => c.cardId === 'dyrnwyn')
              const canSword = hasSword && user.power >= effectiveCost(state, card) + eff.power && user.blackCauldron === 'set-aside'
              return user.discard.length > 0 || canSword
            })()}
            pigKeeperPlayable={(() => {
              // On te tient : jouable si Tirelire est dans la pioche/défausse Fatalité
              // (à chercher) OU s'il y a un Héros de force ≤1 à éliminer dans le royaume.
              const card = user.hand.find((c) => (c.effects ?? []).some((e) => e.type === 'PIGKEEPER_RESOLVE'))
              if (!card) return true
              const canFetch = user.fateDeck.some((c) => c.cardId === 'hen-wen') || user.fateDiscard.some((c) => c.cardId === 'hen-wen')
              const canVanquish = Object.values(user.board).flat().some((c) => c.type === 'hero' && (c.strength ?? 0) <= 1)
              return canFetch || canVanquish
            })()}
            canTransformGuards={transformableGuards(state, HUMAN).length > 0}
            hasHackInPlay={Object.values(user.board).flat().some((c) => c.isPiratage || (c.type === 'hero' && c.abilityHacked))}
            hasIngredients={(user.ingredients ?? []).some((c) => (c.cost ?? 0) <= user.power)}
            heroAtPawn={!!user.pawnLocation && (user.board[user.pawnLocation] ?? []).some((c) => c.type === 'hero')}
            coveredAtPawn={
              !!user.pawnLocation &&
              ((user.board[user.pawnLocation] ?? []).some((c) => c.type === 'hero') ||
                (user.fireTokens?.[user.pawnLocation] ?? []).length > 0)
            }
            canBite={canTakeABite(state, HUMAN)}
            realmHasHyena={Object.values(user.board).flat().some((c) => c.isHyena)}
            hyenaElsewhere={user.locations.some((l) => l.id !== user.pawnLocation && (user.board[l.id] ?? []).some((c) => c.isHyena))}
            fateDiscardHasCard={user.fateDiscard.some((c) => c.type === 'hero' || c.type === 'effect')}
            realActionUsed={state.usedActionIds.some((a) => !a.includes(':'))}
            kronkHasPowerToken={Object.values(user.board).flat().some((c) => c.cardId === 'kronk' && (c.kronkPower ?? 0) > 0)}
            fateDiscardHasHero={user.fateDiscard.some((c) => c.type === 'hero')}
            poeticJusticeUsable={(() => {
              // Ironie du sort : Allié sur le lieu du pion ET Événement de la défausse
              // abordable après avoir payé Ironie (coût effectif, Bâton Magique inclus).
              if (!user.pawnLocation) return false
              if (!(user.board[user.pawnLocation] ?? []).some((c) => c.type === 'ally')) return false
              const ironie = user.hand.find((c) => (c.effects ?? []).some((e) => e.type === 'POETIC_JUSTICE'))
              const poeticPower = user.power - (ironie ? effectiveCost(state, ironie) : 1)
              return user.discard.some((c) => c.type === 'effect' && (c.cost ?? 0) <= poeticPower)
            })()}
            relocateTargetAvailable={(() => {
              // Capture : au moins un Héros déplaçable hors de la destination imposée.
              const card = user.hand.find((c) => (c.effects ?? []).some((e) => e.type === 'MOVE_REALM_HERO_TO'))
              const eff = card?.effects?.find((e) => e.type === 'MOVE_REALM_HERO_TO')
              if (!eff || eff.type !== 'MOVE_REALM_HERO_TO') return true
              return realmRelocateCandidates(user, eff.maxStrength, eff.locationId).length > 0
            })()}
            hackTargetAvailable={Object.values(user.board).flat().some((c) => c.type === 'hero' && !c.abilityHacked)}
            pawnWithRaiponce={!!user.pawnLocation && (user.board[user.pawnLocation] ?? []).some((c) => c.cardId === 'raiponce')}
            raiponceAtTour={(user.board[user.locations[0].id] ?? []).some((c) => c.cardId === 'raiponce')}
            recoverFromDiscardAvailable={user.discard.some((c) => c.type === 'item' || c.type === 'effect')}
            hasActivatableCard={activatableCards(state).length > 0}
            canRemoveObstacle={
              user.obstacles !== undefined &&
              Object.values(user.obstacles).reduce((n, v) => n + v, 0) > 0 &&
              !Object.values(user.board).flat().some((c) => c.type === 'hero' && c.cardId === 'belle')
            }
            canReplaceObstacle={
              user.obstacles !== undefined &&
              Object.values(user.obstacles).reduce((n, v) => n + v, 0) < user.locations.length * 2
            }
            realmHasMovableCard={Object.values(user.board).flat().some((c) => (c.type === 'ally' || c.type === 'item' || c.type === 'curse') && !c.attachedTo)}
            showMeBeastUsable={Object.values(user.board).flat().some((c) => c.type === 'hero' && (c.cardId === 'la-bete' || c.cardId === 'belle'))}
            keyAtPawn={(user.keys ?? []).some((k) => k.location === user.pawnLocation && !k.stolenBy)}
            pageAtPawn={!!user.pawnLocation && (user.board[user.pawnLocation] ?? []).some((c) => c.cardId === 'page' && !c.attachedTo)}
            pawnLocationId={user.pawnLocation ?? undefined}
            titanMovePlayable={
              // Préparez-vous au combat ! : ≥2 Pouvoir ET un Titan non entravé avec une
              // destination atteignable (sinon la carte n'aurait aucun effet).
              user.power >= 2 &&
              Object.values(user.board)
                .flat()
                .some((c) => c.isTitan && !c.trapped && titanReachableDests(state, HUMAN, c.instanceId, 2).length > 0)
            }
            keysOnBoard={(user.keys ?? []).some((k) => k.location !== null && !k.stolenBy)}
            ownsKey={(user.keys ?? []).some((k) => k.location === null && !k.stolenBy)}
            lotsoToRoomAvailable={lotsoToRoomCandidates(state, HUMAN).length > 0}
            lotsoHeroOutsideRoom={lotsoReducibleHeroes(state, HUMAN, 'not-room').length > 0}
            lotsoHeroInRoom={lotsoHasHeroInRoom(state, HUMAN)}
            realmCardIds={Object.values(user.board).flat().map((c) => c.cardId)}
            fateDiscardNonEmpty={user.fateDiscard.length > 0}
            villainDiscardNonEmpty={user.discard.length > 0}
            costFor={(c) => effectiveCost(state, c)}
            armedConditionIds={humanReactions.map((c) => c.instanceId)}
            forcedHoverId={hoveredReactionId}
            selectedCardId={selectedHandCardId}
            selectedToDiscard={discardSelected}
            requiredDiscardCount={discardRequired}
            layout="fan"
            onPlayCard={handlePlayCard}
            onActivateReaction={(id) => {
              // Clic direct sur une Condition armée dans la main = raccourci du
              // panneau de réaction.
              const c = humanReactions.find((r) => r.instanceId === id)
              if (c) handlePlayReaction(c)
            }}
            onToggleDiscard={handleToggleDiscard}
            onConfirmDiscard={handleConfirmDiscard}
            onCancel={() => setMode(null)}
            dragPlayActionId={dragPlayActionId}
            canFreePlay={isHumanTurn && state.phase === 'ACTION'}
            mustMoveFirst={isHumanTurn && state.phase === 'MOVE'}
            onUnplayable={showUnplayable}
            onCardDragStart={handleCardDragStart}
            onCardDragMove={handleCardDragMove}
            onCardDragDrop={handleCardDragDrop}
            onCardDragCancel={cancelDrag}
            draggingInstanceId={draggingCardId}
          />
        </div>
        {/* Panneau adverse (droite, rouge). */}
        <PlayerPanel player={bot} accent={RED} isActive={state.activePlayer === BOT} isWinner={state.winner === BOT} subLabel={oppSubLabel} avatar={oppAvatar} />
      </div>
      </div>{/* fin zone de jeu (h-screen) */}

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

      {/* Appel à l'aide (Ratigan) : l'humain (qui a posé la Fatalité) choisit le lieu
          où poser/déplacer Basil. */}
      {state.pendingFateHeroPlace && state.pendingFateHeroPlace.chooserIndex === HUMAN && (
        <FateHeroPlaceModal
          heroCardId={state.pendingFateHeroPlace.heroCardId}
          heroName={state.pendingFateHeroPlace.heroName}
          mode={state.pendingFateHeroPlace.mode}
          target={state.players[state.pendingFateHeroPlace.targetIndex]}
          onPlace={resolveFateHeroPlace}
        />
      )}

      {/* Roi Stéphane / Le Satyre / Anneau étoile : l'humain (qui a joué la Fatalité)
          peut déplacer le pion adverse. */}
      {state.pendingPawnMove && state.pendingPawnMove.chooserIndex === HUMAN && (
        <PawnMoveModal
          target={state.players[state.pendingPawnMove.targetIndex]}
          title={state.pendingPawnMove.via}
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

      {/* Mauvais Coup : l'humain garde 1 des 2 cartes du dessous, replace l'autre. */}
      {state.pendingMauvaisCoup && state.pendingMauvaisCoup.playerIndex === HUMAN && (
        <MauvaisCoupModal
          cards={state.pendingMauvaisCoup.cards}
          onResolve={(keepId, placement) => resolveMauvaisCoup(keepId, placement)}
        />
      )}

      {/* Sournois : l'humain replace 1 carte de sa main sur le dessus/dessous. */}
      {state.pendingSournois && state.pendingSournois.playerIndex === HUMAN && (
        <SournoisModal
          hand={user.hand}
          onResolve={(instanceId, placement) => resolveSournois(instanceId, placement)}
        />
      )}

      {/* Cheval : l'humain déplace un Allié/Objet (ou rien). */}
      {state.pendingAllyItemMove && state.pendingAllyItemMove.playerIndex === HUMAN && (
        <MoveAllyItemModal
          player={user}
          onResolve={(instanceId, to) => resolveAllyItemMove(instanceId, to)}
          onSkip={() => resolveAllyItemMove(null, null)}
        />
      )}

      {/* Bandit : l'humain enchaîne d'autres Bandits dans la même action. */}
      {state.pendingBanditChain && state.pendingBanditChain.playerIndex === HUMAN && (
        <BanditChainModal
          bandits={user.hand.filter((c) => c.playMultiplePerAction)}
          power={user.power}
          onResolve={(ids) => resolveBanditChain(ids)}
        />
      )}

      {/* Dingo : l'humain (qui a posé la Fatalité) intervertit/déplace une tuile. */}
      {/* Récap « tour adverse » : bande chronologique des actions de l'adversaire. */}
      {recapOpen && opponentRecap && (
        <OpponentTurnRecap recap={opponentRecap} onClose={() => setRecapOpen(false)} />
      )}

      {state.pendingDingo && state.pendingDingo.chooserIndex === HUMAN && (
        <DingoModal
          target={state.players[state.pendingDingo.targetIndex]}
          onResolve={(from, to) => resolveDingo(from, to)}
          onSkip={() => resolveDingo(null, null)}
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

      {/* Le Grand Génie du Mal : l'humain choisit piocher OU gagner du Pouvoir. */}
      {state.pendingDrawOrGainPower && state.pendingDrawOrGainPower.playerIndex === HUMAN && (
        <DrawOrGainPowerModal
          draw={state.pendingDrawOrGainPower.draw}
          power={state.pendingDrawOrGainPower.power}
          cardId={state.pendingDrawOrGainPower.cardId}
          onChoose={resolveDrawOrGainPower}
        />
      )}

      {/* Sa Sucrerie — Mémoire Verrouillée : l'humain choisit Pouvoir OU reculer le Pilote. */}
      {state.pendingPowerOrRacerBack && state.pendingPowerOrRacerBack.playerIndex === HUMAN && (
        <ChoiceModal
          title="Mémoire Verrouillée"
          prompt="Que choisissez-vous ?"
          options={[
            {
              key: 'power',
              label: `Gagner ${state.pendingPowerOrRacerBack.power} jetons Pouvoir`,
              onSelect: () => resolvePowerOrRacerBack('power'),
            },
            {
              key: 'racer',
              label: `Reculer le jeton Pilote de ${state.pendingPowerOrRacerBack.racerBack} cases`,
              onSelect: () => resolvePowerOrRacerBack('racer'),
            },
          ]}
        />
      )}

      {/* Sa Sucrerie — Taffyta : l'humain choisit reculer le Pilote OU jouer une carte. */}
      {state.pendingTaffytaChoice && state.pendingTaffytaChoice.playerIndex === HUMAN && (
        <ChoiceModal
          title="Taffyta Crème Brûlée"
          prompt="Que choisissez-vous ?"
          options={[
            {
              key: 'racer-back',
              label: 'Reculer le jeton Pilote de 2 cases',
              onSelect: () => resolveTaffytaChoice('racer-back'),
            },
            {
              key: 'play-card',
              label: 'Effectuer une action Jouer une carte',
              onSelect: () => resolveTaffytaChoice('play-card'),
            },
          ]}
        />
      )}

      {/* Sa Sucrerie — Aigre Bill : l'humain choisit de fouiller la pioche ou non. */}
      {state.pendingAigreBill && state.pendingAigreBill.playerIndex === HUMAN && (
        <ChoiceModal
          title="Aigre Bill"
          prompt="Fouiller votre pioche Méchant jusqu'à un Allié ?"
          options={[
            {
              key: 'dig',
              label: 'Fouiller (Allié en main, réordonner le reste)',
              onSelect: () => resolveAigreBill(true),
            },
            {
              key: 'skip',
              label: 'Renoncer',
              onSelect: () => resolveAigreBill(false),
            },
          ]}
        />
      )}

      {/* Message « carte injouable » : pourquoi la carte saisie ne peut pas être jouée.
          Style Hearthstone : texte blanc gras à contour noir, centré au milieu de l'écran. */}
      {unplayableMsg && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center px-6">
          <div
            className="select-none text-center text-3xl font-bold tracking-wide text-white sm:text-4xl"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow:
                '2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 0 8px rgba(0,0,0,0.9), 0 4px 10px rgba(0,0,0,0.8)',
            }}
          >
            {unplayableMsg}
          </div>
        </div>
      )}

      {/* Sa Sucrerie — Médaille de Vanellope : le fataliseur (humain) choisit Héros puis lieu. */}
      {state.pendingMedal && state.pendingMedal.chooserIndex === HUMAN && (() => {
        const pm = state.pendingMedal
        const kcP = state.players[pm.playerIndex]
        if (pm.kind === 'pick-hero') {
          const heroName = (id: string) => kcP.fateDiscard.find((c) => c.instanceId === id)?.name ?? 'Héros'
          return (
            <ChoiceModal
              title="Médaille de Vanellope — Héros"
              prompt="Quel Héros de la défausse Fatalité rejouer (+1 Force) ?"
              options={(pm.heroIds ?? []).map((id) => ({
                key: `medal-h-${id}`,
                label: heroName(id),
                onSelect: () => resolveMedal({ heroInstanceId: id }),
              }))}
            />
          )
        }
        const nameOf = (id: string) => kcP.locations.find((l) => l.id === id)?.name ?? id
        return (
          <ChoiceModal
            title="Médaille de Vanellope — lieu"
            prompt="Sur quel lieu jouer le Héros ?"
            options={(pm.locationIds ?? []).map((id) => ({
              key: `medal-l-${id}`,
              label: nameOf(id),
              onSelect: () => resolveMedal({ locationId: id }),
            }))}
          />
        )
      })()}

      {/* Sa Sucrerie — Le Faisceau : le fataliseur (humain) choisit le lieu puis défausse. */}
      {state.pendingBeacon && state.pendingBeacon.chooserIndex === HUMAN && (() => {
        const pb = state.pendingBeacon
        const kcP = state.players[pb.playerIndex]
        const nameOf = (id: string) => kcP.locations.find((l) => l.id === id)?.name ?? id
        if (pb.kind === 'pick-location') {
          return (
            <ChoiceModal
              title="Le Faisceau — lieu de rassemblement"
              prompt="Sur quel lieu rassembler les Cybugs en Sucre voisins ?"
              options={(pb.locationIds ?? []).map((id) => ({
                key: `beacon-${id}`,
                label: nameOf(id),
                onSelect: () => resolveBeacon({ locationId: id }),
              }))}
            />
          )
        }
        const cybugName = (id: string) =>
          Object.values(kcP.board).flat().find((c) => c.instanceId === id)?.name ?? 'Cybug en Sucre'
        return (
          <ChoiceModal
            title="Le Faisceau — défausser un Cybug ?"
            prompt="Vous pouvez défausser un Cybug en Sucre de ce lieu."
            options={[
              { key: 'beacon-skip', label: 'Ne rien défausser', onSelect: () => resolveBeacon({ skip: true }) },
              ...(pb.cybugIds ?? []).map((id) => ({
                key: `beacon-dis-${id}`,
                label: `Défausser ${cybugName(id)}`,
                onSelect: () => resolveBeacon({ cybugInstanceId: id }),
              })),
            ]}
          />
        )
      })()}

      {/* Sa Sucrerie — Princesse Vanellope : le fataliseur (humain) choisit le recul du pion. */}
      {state.pendingPawnBack && state.pendingPawnBack.chooserIndex === HUMAN && (
        <ChoiceModal
          title="Princesse Vanellope"
          prompt="De combien de cases reculer le pion de Sa Sucrerie ?"
          options={Array.from({ length: state.pendingPawnBack.max + 1 }, (_, i) => i).map((n) => ({
            key: `back-${n}`,
            label: n === 0 ? 'Ne pas reculer' : `Reculer de ${n}`,
            onSelect: () => resolvePawnBack(n),
          }))}
        />
      )}

      {/* Sa Sucrerie — L'important, c'est de payer : l'humain choisit combien dépenser. */}
      {state.pendingPayRace && state.pendingPayRace.playerIndex === HUMAN && (
        <ChoiceModal
          title="L'important, c'est de payer"
          prompt="Combien de jetons Pouvoir dépenser ? (vous avancez d'autant de cases)"
          options={Array.from({ length: state.pendingPayRace.max }, (_, i) => i + 1).map((n) => ({
            key: `pay-${n}`,
            label: `Dépenser ${n} (avancer de ${n})`,
            onSelect: () => resolvePayRace(n),
          }))}
        />
      )}

      {/* Shere Khan — Aie confiance : choisir des cartes de la défausse à remélanger. */}
      {state.pendingRecoverToDeck && state.pendingRecoverToDeck.playerIndex === HUMAN && (() => {
        const prd = state.pendingRecoverToDeck
        const chosen = new Set(prd.chosen)
        const cards = user.discard.filter((c) => !chosen.has(c.instanceId))
        const title =
          user.villain === 'tamatoa'
            ? `Je te le dirai en chantant (${prd.chosen.length}/${prd.remaining})`
            : `Aie confiance (${prd.chosen.length}/${prd.remaining})`
        return (
          <CardChoiceModal
            title={title}
            cards={cards}
            onPick={(card) => resolveRecoverToDeck({ instanceId: card.instanceId })}
            noneLabel="Terminer"
            onNone={() => resolveRecoverToDeck({ done: true })}
            onClose={() => resolveRecoverToDeck({ done: true })}
          />
        )
      })()}

      {/* Shere Khan — C'est très intéressant : une ou plusieurs actions au choix. */}
      {state.pendingInteressant && state.pendingInteressant.playerIndex === HUMAN && (() => {
        const done = new Set(state.pendingInteressant.done)
        const hasFire = Object.values(user.fireTokens ?? {}).some((a) => a.length > 0)
        const opts: { key: string; label: string; onSelect: () => void }[] = [
          { key: 'int-done', label: 'Terminer', onSelect: () => resolveInteressant({ done: true }) },
        ]
        if (!done.has('power')) opts.push({ key: 'int-power', label: 'Gagner 1 jeton Pouvoir', onSelect: () => resolveInteressant({ option: 'power' }) })
        if (!done.has('draw')) opts.push({ key: 'int-draw', label: 'Piocher 1 carte', onSelect: () => resolveInteressant({ option: 'draw' }) })
        if (!done.has('fire') && hasFire) opts.push({ key: 'int-fire', label: 'Déplacer 1 jeton Feu sur une autre action', onSelect: () => resolveInteressant({ option: 'fire' }) })
        return (
          <ChoiceModal
            title="C'est très intéressant"
            prompt="Effectuez une ou plusieurs actions, puis terminez."
            options={opts}
          />
        )
      })()}

      {/* Shere Khan — Kaa : choisir un Objet de la défausse à jouer (et l'associer à Kaa). */}
      {state.pendingKaaPlay && state.pendingKaaPlay.playerIndex === HUMAN && (() => {
        const items = user.discard.filter((c) => c.type === 'item' && (c.cost ?? 0) <= user.power)
        return (
          <ChoiceModal
            title="Kaa"
            prompt="Choisissez un Objet de votre défausse à jouer (vous payez son coût)."
            options={items.map((c) => ({
              key: `kaa-${c.instanceId}`,
              label: `${c.name} (${c.cost ?? 0} JT)`,
              onSelect: () => resolveKaaPlay(c.instanceId),
            }))}
          />
        )
      })()}

      {/* Shere Khan — Le Roi Singe : choisir le Macaque puis son lieu de destination. */}
      {state.pendingMonkeyKing && state.pendingMonkeyKing.playerIndex === HUMAN && (() => {
        const pmk = state.pendingMonkeyKing
        if (!pmk.macaqueInstanceId) {
          const macaques = user.locations.flatMap((l) =>
            (user.board[l.id] ?? [])
              .filter((c) => c.cardId === 'macaques')
              .map((c) => ({ id: c.instanceId, locName: l.name })),
          )
          return (
            <ChoiceModal
              title="Le Roi Singe"
              prompt="Quel groupe de Macaques voulez-vous déplacer ?"
              options={macaques.map((m) => ({
                key: `mk-${m.id}`,
                label: `Macaques (${m.locName})`,
                onSelect: () => resolveMonkeyKing({ macaqueInstanceId: m.id }),
              }))}
            />
          )
        }
        return (
          <ChoiceModal
            title="Le Roi Singe"
            prompt="Vers quel lieu déplacer les Macaques ?"
            options={user.locations.map((l) => ({
              key: `mk-to-${l.id}`,
              label: l.name,
              onSelect: () => resolveMonkeyKing({ to: l.id }),
            }))}
          />
        )
      })()}

      {/* Davy Jones — poser un jeton Trésor : phase 1 le Héros, phase 2 QUEL Trésor (face cachée). */}
      {state.pendingPlaceTreasure && state.pendingPlaceTreasure.playerIndex === HUMAN && (() => {
        const ppt = state.pendingPlaceTreasure
        if (!ppt.heroInstanceId) {
          const heroes = user.locations.flatMap((l) =>
            (user.board[l.id] ?? []).filter((c) => c.type === 'hero' && !c.treasure).map((c) => ({ c, locName: l.name })),
          )
          return (
            <ChoiceModal
              title="Jeton Trésor"
              prompt="Sur quel Héros poser un jeton Trésor (face cachée) ?"
              options={heroes.map(({ c, locName }) => ({
                key: `pt-${c.instanceId}`,
                label: `${c.name} (${locName})`,
                onSelect: () => resolvePlaceTreasure({ heroInstanceId: c.instanceId }),
              }))}
            />
          )
        }
        // Choix « à l'aveugle » : on ne montre que les DOS des jetons de la réserve (vous
        // ne savez pas lequel vous posez tant qu'il n'est pas révélé).
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
              <h2 className="text-center text-lg font-bold text-amber-200">Jeton Trésor</h2>
              <p className="text-center text-sm text-white/70">
                Choisissez un jeton Trésor de la réserve à poser <b>face cachée</b> — vous ignorez lequel.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {(user.treasureReserve ?? []).map((tid, i) => (
                  <button
                    key={`ptt-${tid}`}
                    type="button"
                    onClick={() => resolvePlaceTreasure({ treasureId: tid })}
                    title="Jeton Trésor (face cachée)"
                    className="transition hover:scale-110 hover:brightness-110"
                  >
                    <img
                      src="/cards/davy-jones/treasure-back.png"
                      alt={`Jeton Trésor ${i + 1}`}
                      className="h-16 w-16 object-contain drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Davy Jones — révéler un jeton Trésor sur un Héros. */}
      {state.pendingRevealTreasure && state.pendingRevealTreasure.playerIndex === HUMAN && (() => {
        const prt = state.pendingRevealTreasure
        const all = user.locations.flatMap((l) => (user.board[l.id] ?? []).map((c) => ({ c, locName: l.name })))
        const cands = prt.candidateIds
          .map((id) => all.find((x) => x.c.instanceId === id))
          .filter((x): x is NonNullable<typeof x> => !!x)
        return (
          <ChoiceModal
            title="Révéler un Trésor"
            prompt="Sur quel Héros révéler le jeton Trésor (face cachée) ?"
            options={cands.map(({ c, locName }) => ({
              key: `rt-${c.instanceId}`,
              label: `${c.name} (${locName})`,
              onSelect: () => resolveRevealTreasure(c.instanceId),
            }))}
          />
        )
      })()}

      {/* Davy Jones — Les amis deviennent des ennemis : déplacer/échanger un trésor. */}
      {state.pendingMoveSwapTreasure && state.pendingMoveSwapTreasure.playerIndex === HUMAN && (() => {
        const pms = state.pendingMoveSwapTreasure
        const heroes = user.locations.flatMap((l) =>
          (user.board[l.id] ?? []).filter((c) => c.type === 'hero').map((c) => ({ c, locName: l.name })),
        )
        const phase1 = !pms.fromHeroId
        const opts = heroes
          .filter(({ c }) => (phase1 ? !!c.treasure : c.instanceId !== pms.fromHeroId))
          .map(({ c, locName }) => ({
            key: `ms-${c.instanceId}`,
            label: `${c.name} (${locName})${c.treasure ? ' • trésor' : ''}`,
            onSelect: () => resolveMoveSwapTreasure(c.instanceId),
          }))
        return (
          <ChoiceModal
            title="Les amis deviennent des ennemis"
            prompt={phase1 ? 'Quel Héros possède le trésor à déplacer ?' : 'Vers quel Héros (échange si déjà un trésor) ?'}
            options={opts}
          />
        )
      })()}

      {/* Davy Jones — Réveillez le Kraken ! : défausser un Allié. */}
      {state.pendingWakeKraken && state.pendingWakeKraken.playerIndex === HUMAN && (() => {
        const allies = user.locations.flatMap((l) =>
          (user.board[l.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo).map((c) => ({ c, locName: l.name })),
        )
        return (
          <ChoiceModal
            title="Réveillez le Kraken !"
            prompt="Quel Allié défausser pour réveiller Le Kraken ?"
            options={allies.map(({ c, locName }) => ({
              key: `wk-${c.instanceId}`,
              label: `${c.name} (${locName})`,
              onSelect: () => resolveWakeKraken(c.instanceId),
            }))}
          />
        )
      })()}

      {/* Shere Khan — Kaa (bouclier) : sacrifier un Objet associé pour préserver Kaa, ou non. */}
      {state.pendingKaaShield && state.pendingKaaShield.playerIndex === HUMAN && (() => {
        const pks = state.pendingKaaShield
        const allCards = user.locations.flatMap((l) => user.board[l.id] ?? [])
        const items = pks.itemInstanceIds
          .map((id) => allCards.find((c) => c.instanceId === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
        return (
          <ChoiceModal
            title="Kaa"
            prompt="Kaa serait défaussé. Sacrifier un Objet associé à sa place ?"
            options={[
              ...items.map((c) => ({
                key: `kshield-${c.instanceId}`,
                label: `Défausser ${c.name} (Kaa survit)`,
                onSelect: () => resolveKaaShield({ itemInstanceId: c.instanceId }),
              })),
              { key: 'kshield-none', label: 'Laisser Kaa être défaussé', onSelect: () => resolveKaaShield({ decline: true }) },
            ]}
          />
        )
      })()}

      {/* Shere Khan — Jeune et sans défense : choix (déplacer un Héros / gagner du Pouvoir). */}
      {state.pendingYoung && state.pendingYoung.playerIndex === HUMAN && (() => {
        const py = state.pendingYoung
        if (py.kind === 'choose') {
          const allies = user.locations.flatMap((l) => (user.board[l.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo)).length
          return (
            <ChoiceModal
              title="Jeune et sans défense"
              prompt="Que choisissez-vous ?"
              options={[
                { key: 'y-move', label: 'Déplacer un Héros sur le lieu d’un Allié', onSelect: () => resolveYoung({ choice: 'move' }) },
                { key: 'y-gain', label: `Gagner ${allies} jeton(s) Pouvoir (1 par Allié)`, onSelect: () => resolveYoung({ choice: 'gain' }) },
              ]}
            />
          )
        }
        if (py.kind === 'pick-hero') {
          return (
            <ChoiceModal
              title="Jeune et sans défense — quel Héros ?"
              prompt="Quel Héros déplacer ?"
              options={user.locations.flatMap((l) =>
                (user.board[l.id] ?? []).filter((c) => c.type === 'hero').map((h) => ({
                  key: `yh-${h.instanceId}`,
                  label: `${h.name} (${l.name})`,
                  onSelect: () => resolveYoung({ heroInstanceId: h.instanceId }),
                })),
              )}
            />
          )
        }
        return (
          <ChoiceModal
            title="Jeune et sans défense — vers quel Allié ?"
            prompt="Sur le lieu de quel Allié déplacer le Héros ?"
            options={user.locations.flatMap((l) =>
              (user.board[l.id] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo).map((a) => ({
                key: `ya-${a.instanceId}`,
                label: `${a.name} (${l.name})`,
                onSelect: () => resolveYoung({ allyInstanceId: a.instanceId }),
              })),
            )}
          />
        )
      })()}

      {/* Shere Khan — À toi de jouer, cousin : l'humain choisit où jouer l'Allié dévoilé. */}
      {state.pendingFreePlayAlly && state.pendingFreePlayAlly.playerIndex === HUMAN && (
        <ChoiceModal
          title="À toi de jouer, cousin"
          prompt={`Où jouer ${state.pendingFreePlayAlly.ally.name} (gratuitement) ?`}
          options={user.locations
            .filter((l) => !(user.lockedLocations ?? []).includes(l.id))
            .map((l) => ({ key: `fpa-${l.id}`, label: l.name, onSelect: () => resolveFreePlayAlly(l.id) }))}
        />
      )}

      {/* Shere Khan — C'est à moi que vous le direz : retour facultatif d'une Fatalité. */}
      {state.pendingRecoverFate && state.pendingRecoverFate.playerIndex === HUMAN && (
        <ChoiceModal
          title="C'est à moi que vous le direz"
          prompt="Remettre une carte Fatalité de la défausse dans la pioche ?"
          options={[
            { key: 'rf-skip', label: 'Ne rien remettre', onSelect: () => resolveRecoverFate(undefined) },
            ...user.fateDiscard.map((c) => ({
              key: `rf-${c.instanceId}`,
              label: c.name,
              onSelect: () => resolveRecoverFate(c.instanceId),
            })),
          ]}
        />
      )}

      {/* Shere Khan — Lancé sur ses traces : l'humain choisit quel Héros éliminer. */}
      {state.pendingShereKhanDefeat && state.pendingShereKhanDefeat.playerIndex === HUMAN && (
        <ChoiceModal
          title="Lancé sur ses traces"
          prompt="Quel Héros éliminer ?"
          options={user.locations.flatMap((loc) =>
            (user.board[loc.id] ?? [])
              .filter((c) => c.type === 'hero')
              .map((h) => ({
                key: `skd-${h.instanceId}`,
                label: `${h.name} (${loc.name})`,
                onSelect: () => resolveShereKhanDefeat(h.instanceId),
              })),
          )}
        />
      )}

      {/* Shere Khan — C'est moi, Shere Khan : l'humain choisit quel jeton Feu retirer. */}
      {state.pendingRemoveFire && state.pendingRemoveFire.playerIndex === HUMAN && (
        <ChoiceModal
          title="C'est moi, Shere Khan"
          prompt="Quel jeton Feu retirer ?"
          options={Object.entries(user.fireTokens ?? {}).flatMap(([locId, actionIds]) =>
            actionIds.map((actionId) => {
              const loc = user.locations.find((l) => l.id === locId)
              const actLabel = loc?.actions.find((a) => a.id === actionId)?.label ?? actionId
              return {
                key: `rf-${locId}-${actionId}`,
                label: `${loc?.name ?? locId} — ${actLabel}`,
                onSelect: () => resolveRemoveFire(locId, actionId),
              }
            }),
          )}
        />
      )}

      {/* Shere Khan — Tout le monde fuit : l'humain choisit Activer une capacité OU Éliminer un Héros. */}
      {state.pendingActivateOrVanquish && state.pendingActivateOrVanquish.playerIndex === HUMAN && (
        <ChoiceModal
          title="Tout le monde fuit devant Shere Khan"
          prompt="Quelle action gratuite effectuer ?"
          options={[
            { key: 'vanquish', label: 'Éliminer un Héros', onSelect: () => resolveActivateOrVanquish('vanquish') },
            { key: 'activate', label: 'Activer une capacité', onSelect: () => resolveActivateOrVanquish('activate') },
          ]}
        />
      )}

      {/* C'est votre dernière chance : l'humain choisit Déplacer un Objet/Allié OU Activer. */}
      {state.pendingMoveOrActivate && state.pendingMoveOrActivate.playerIndex === HUMAN && (
        <MoveOrActivateModal
          canMove={movableCards(state).length > 0}
          canActivate={activatableCards(state).length > 0}
          onChoose={resolveMoveOrActivate}
        />
      )}

      {/* Le Seigneur des Ténèbres : l'humain choisit s'emparer du Chaudron OU gagner du Pouvoir. */}
      {state.pendingCauldronChoice && state.pendingCauldronChoice.playerIndex === HUMAN && (
        <CauldronChoiceModal power={state.pendingCauldronChoice.power} onChoose={resolveCauldronChoice} />
      )}
      {state.pendingMauiChoice && state.pendingMauiChoice.playerIndex === HUMAN && (
        <MauiChoiceModal card={state.players[HUMAN].mauiDeck?.[0]} onChoose={resolveMauiChoice} />
      )}

      {/* Dio — Vampirisme : l'humain choisit l'Allié à défausser (gagne 4 JT, doublé si The World). */}
      {state.pendingDioDiscardAlly && state.pendingDioDiscardAlly.playerIndex === HUMAN && (() => {
        const allies = Object.values(user.board).flat().filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket && !c.cannotBeDiscarded)
        return (
          <CardChoiceModal
            title="Vampirisme : défausse un Allié pour gagner du Pouvoir"
            cards={allies}
            onClose={() => allies[0] && resolveDioDiscardAlly(allies[0].instanceId)}
            onPick={(card) => resolveDioDiscardAlly(card.instanceId)}
          />
        )
      })()}

      {/* Dio — CREAM : l'humain choisit le Héros (force < Vanilla Ice) à défausser. */}
      {state.pendingDioCream && state.pendingDioCream.playerIndex === HUMAN && (() => {
        const ids = new Set(state.pendingDioCream.candidateIds)
        const heroes = (user.board[state.pendingDioCream.locationId] ?? []).filter((c) => ids.has(c.instanceId))
        return (
          <CardChoiceModal
            title="CREAM : défausse un Héros plus faible que Vanilla Ice"
            cards={heroes}
            onClose={() => heroes[0] && resolveDioCream(heroes[0].instanceId)}
            onPick={(card) => resolveDioCream(card.instanceId)}
          />
        )
      })()}

      {/* Dio — MUDA! : l'humain peut éliminer un Héros du lieu du pion (facultatif), gagne 5 JT. */}
      {state.pendingDioMuda && state.pendingDioMuda.playerIndex === HUMAN && (() => {
        const ids = new Set(state.pendingDioMuda.candidateIds)
        const heroes = Object.values(user.board).flat().filter((c) => ids.has(c.instanceId))
        return (
          <CardChoiceModal
            title="MUDA ! MUDA ! MUDA ! : élimine un Héros (facultatif)"
            cards={heroes}
            noneLabel="Ne pas éliminer (gagner 5 JT)"
            onNone={() => resolveDioMuda(undefined)}
            onClose={() => resolveDioMuda(undefined)}
            onPick={(card) => resolveDioMuda(card.instanceId)}
          />
        )
      })()}

      {/* Dio — Quête vers le paradis : l'humain choisit le type de carte à récupérer. */}
      {state.pendingDioQuest && state.pendingDioQuest.playerIndex === HUMAN && (
        <ChoiceModal
          title="Quête vers le paradis"
          prompt="Choisis un type de carte : les cartes de ce type parmi les 6 dévoilées rejoignent ta main."
          options={[
            { key: 'quest-item', label: 'Objet', onSelect: () => resolveDioQuest('item') },
            { key: 'quest-effect', label: 'Événement', onSelect: () => resolveDioQuest('effect') },
          ]}
        />
      )}

      {/* Dio — Lumière du Soleil : Dio choisit défausser sa main OU perdre du Pouvoir. */}
      {state.pendingDioSunlight && state.pendingDioSunlight.playerIndex === HUMAN && (
        <ChoiceModal
          title="Lumière du Soleil"
          prompt="DIO doit faire un choix."
          options={[
            { key: 'sun-lose', label: `Perdre ${state.pendingDioSunlight.lose} jetons Pouvoir`, onSelect: () => resolveDioSunlight('lose') },
            { key: 'sun-discard', label: `Défausser toute ma main (${user.hand.length} carte(s))`, onSelect: () => resolveDioSunlight('discard') },
          ]}
        />
      )}
      {state.pendingBargainChoice && state.pendingBargainChoice.playerIndex === HUMAN && (
        <BargainChoiceModal power={state.pendingBargainChoice.power} onChoose={resolveBargainChoice} />
      )}

      {/* Le Seigneur des Ténèbres : l'humain joue gratuitement un Objet de sa main. */}
      {state.pendingFreeItemPlay && state.pendingFreeItemPlay.playerIndex === HUMAN && (
        <FreeItemPlayModal
          items={user.hand.filter((c) => c.type === 'item')}
          locations={user.locations.filter((l) => !(user.lockedLocations ?? []).includes(l.id)).map((l) => ({ id: l.id, name: l.name }))}
          blockedFor={(cardId, locId) => (user.board[locId] ?? []).some((c) => c.type === 'hero' && c.blocksItemPlacement === cardId)}
          onResolve={resolveFreeItemPlay}
          onSkip={skipFreeItemPlay}
        />
      )}

      {/* Je ne reviens jamais : l'humain réordonne le dessus de sa pioche Fatalité. */}
      {state.pendingFateReorder && (state.pendingFateReorder.chooserIndex ?? state.pendingFateReorder.playerIndex) === HUMAN && (
        <FateReorderModal
          cards={state.pendingFateReorder.cards}
          onResolve={resolveFateReorder}
          title={
            state.pendingFateReorder.deck === 'merlin'
              ? 'Pas de Tricherie'
              : state.pendingFateReorder.deck === 'villain'
                ? 'Aigre Bill'
                : state.pendingFateReorder.deck === 'villain-split2'
                  ? 'Niveau Inachevé — 2 dessus, 2 dessous (dans l’ordre)'
                  : undefined
          }
          deckLabel={
            state.pendingFateReorder.deck === 'merlin'
              ? 'de Métamorphoses de Merlin'
              : state.pendingFateReorder.deck === 'villain' || state.pendingFateReorder.deck === 'villain-split2'
                ? 'Méchant'
                : undefined
          }
        />
      )}

      {/* Le Seigneur des clés — animation du lancer de dé de couleur. */}
      {dieAnim && state.dieRoll && (
        <DieRollModal key={state.dieRoll.seq} seq={state.dieRoll.seq} color={state.dieRoll.color} onDone={setDieDismissSeq} />
      )}

      {/* Oogie Boogie — résolution interactive d'un lancer de 2 dés (humain). */}
      {humanDice && state.pendingDice && (
        <DiceRollModal
          key={`pd-${state.diceRoll?.seq ?? 0}`}
          pending={state.pendingDice}
          rerollCards={state.players[HUMAN].hand.filter((c) => c.cardId === 'des-pipes')}
          onConfirm={() => {
            // Acquitte ce seq pour que le toast ne réaffiche pas le lancer après coup.
            if (state.diceRoll) setDiceDismissSeq(state.diceRoll.seq)
            resolveDice()
          }}
          onReroll={resolveDiceReroll}
          onChooseDice={(dice) => {
            if (state.diceRoll) setDiceDismissSeq(state.diceRoll.seq)
            resolveDiceChoice(dice)
          }}
        />
      )}

      {/* Oogie Boogie — animation auto-dismiss d'un lancer non interactif (bot / Condition). */}
      {diceAnim && state.diceRoll && (
        <DiceRollToast
          key={`dt-${state.diceRoll.seq}`}
          seq={state.diceRoll.seq}
          dice={state.diceRoll.dice}
          total={state.diceRoll.total}
          modifier={state.diceRoll.modifier}
          context={state.diceRoll.context}
          // Joyeux Halloween : on laisse le résultat 5 s et on affiche l'effet obtenu.
          durationMs={state.diceRoll.cardId === 'joyeux-halloween' ? 5000 : undefined}
          outcomeText={
            state.diceRoll.cardId === 'joyeux-halloween'
              ? state.diceRoll.total >= 8
                ? `8 ou plus → vous gagnez ${state.diceRoll.total} jetons Pouvoir`
                : '7 ou moins → vous volez 1 jeton Pouvoir à un adversaire'
              : undefined
          }
          onDone={setDiceDismissSeq}
        />
      )}

      {/* Oogie Boogie — Préparation de Noël (≥8) : bandeau d'action gratuite (humain).
          Le joueur effectue une action de lieu normalement (gérée par le moteur) ou renonce. */}
      {state.pendingFreeRealmAction && state.pendingFreeRealmAction.playerIndex === HUMAN && (
        <div className="fixed inset-x-0 top-4 z-[260] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-amber-300/40 bg-[#15101f]/95 px-5 py-2 shadow-2xl">
            <span className="text-sm font-semibold text-amber-100">Préparation de Noël : effectue une action gratuite de ton lieu, ou renonce.</span>
            <button
              type="button"
              onClick={skipFreeRealmAction}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
            >
              Renoncer
            </button>
          </div>
        </div>
      )}

      {/* Glisser-déposer : fantôme du PION qui suit le curseur (déplacement). */}
      {dragGhost?.pawnSrc &&
        createPortal(
          <img
            ref={(el) => {
              dragGhostElRef.current = el
            }}
            src={dragGhost.pawnSrc}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none fixed z-[300] w-auto"
            style={{
              left: dragGhost.x,
              top: dragGhost.y,
              height: `${Math.round(user.pawnHeightPx * 1.3)}px`,
              transform: 'translate(-50%, -50%)',
              willChange: 'left, top, transform',
              filter: `drop-shadow(0 0 2px #fff) drop-shadow(0 0 7px ${VILLAIN_COLOR[user.villain]})`,
            }}
          />,
          document.body,
        )}
      {/* Glisser-déposer : fantôme de la carte qui suit le curseur (main OU plateau). */}
      {dragGhost && !dragGhost.pawnSrc && (() => {
        const inst =
          user.hand.find((c) => c.instanceId === dragGhost.instanceId) ??
          Object.values(user.board).flat().find((c) => c.instanceId === dragGhost.instanceId)
        const src = inst && getCardDef(inst.cardId)?.image
        if (!src) return null
        return createPortal(
          <img
            ref={(el) => {
              dragGhostElRef.current = el
            }}
            src={src}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none fixed z-[300] w-44 rounded-xl border-2 border-amber-300/90 shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
            // Position initiale ; la boucle rAF prend ensuite le relais (style impératif).
            style={{ left: dragGhost.x, top: dragGhost.y, transform: 'translate(-50%, -50%)', willChange: 'left, top, transform' }}
          />,
          document.body,
        )
      })()}

      {/* Lance-moi ta chevelure : l'humain choisit de combien de lieux ramener Raiponce. */}
      {state.pendingRaiponceHomeward && state.pendingRaiponceHomeward.chooserIndex === HUMAN && (
        <RaiponceHomewardModal
          options={state.pendingRaiponceHomeward.options}
          onChoose={resolveRaiponceHomeward}
        />
      )}

      {/* Frères Stabbington : l'humain choisit de ramener Raiponce sur la Tour (ou non). */}
      {state.pendingRaiponceToTower && state.pendingRaiponceToTower.chooserIndex === HUMAN && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="flex w-[24rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
            <h2 className="text-center text-lg font-bold text-fuchsia-200">Frères Stabbington</h2>
            <p className="text-center text-sm text-white/80">Déplacer Raiponce sur la Tour ?</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => resolveRaiponceToTower(true)}
                className="flex-1 rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30"
              >
                Oui, sur la Tour
              </button>
              <button
                type="button"
                onClick={() => resolveRaiponceToTower(false)}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Non, laisser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cruella — le choix d'une Tuile Chiots de la réserve à amener se fait par CLIC
          DIRECT sur les tuiles de la pile Réserve (CapturedPuppiesPile, addMode), pas
          de modale. */}

      {/* Cruella — Horace : choisir capturer sur son lieu OU amener une Tuile. */}
      {state.pendingHoraceChoice && state.pendingHoraceChoice.playerIndex === HUMAN && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="flex w-[26rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
            <h2 className="text-center text-lg font-bold text-rose-200">Horace</h2>
            <p className="text-center text-sm text-white/80">Que veux-tu faire ?</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => resolveHoraceChoice(true)}
                className="flex-1 rounded-lg border border-rose-400/60 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/30"
              >
                Capturer une Tuile ici
              </button>
              <button
                type="button"
                onClick={() => resolveHoraceChoice(false)}
                className="flex-1 rounded-lg border border-rose-400/60 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/30"
              >
                Amener une Tuile (réserve)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cruella — capture avec choix : quelle(s) Tuile Chiots capturer sur le lieu. */}
      {state.pendingPuppyCapture && state.pendingPuppyCapture.playerIndex === HUMAN && (
        <ChoiceModal
          title="Capturer une Tuile Chiots"
          prompt={`Choisis la Tuile à capturer (encore ${state.pendingPuppyCapture.remaining}).`}
          layout="row"
          options={(user.puppyTiles ?? [])
            .filter((t) => t.state === 'board' && t.location === state.pendingPuppyCapture!.locationId)
            .map((t) => {
              const short = t.homeLocation === 'maison-radcliff' ? 'maison' : t.homeLocation
              return {
                key: t.id,
                label: `${t.value} chiots`,
                imageSrc: `/cards/cruella/tuile-${short}-${t.value}.png`,
                onSelect: () => resolvePuppyCapture(t.id),
              }
            })}
        />
      )}

      {/* Cruella — Quels idiots ! (choix de l'option). */}
      {state.pendingQuelsIdiots &&
        state.pendingQuelsIdiots.playerIndex === HUMAN &&
        state.pendingQuelsIdiots.phase === 'choose' && (
          <ChoiceModal
            title="Quels idiots !"
            prompt="Que veux-tu faire ?"
            layout="row"
            options={[
              ...(state.pendingQuelsIdiots.canMove
                ? [{ key: 'move', label: 'Déplacer un Allié', description: 'Amène un Allié sur ton lieu', onSelect: () => resolveQuelsIdiots('move') }]
                : []),
              ...(state.pendingQuelsIdiots.canTutor
                ? [{ key: 'tutor', label: 'Chercher un Allié', description: 'Pioche/défausse → main, puis remélange', onSelect: () => resolveQuelsIdiots('tutor') }]
                : []),
            ]}
          />
        )}

      {/* Cruella — Quels idiots ! (chercher : choix de l'Allié de la pioche/défausse). */}
      {state.pendingQuelsIdiots &&
        state.pendingQuelsIdiots.playerIndex === HUMAN &&
        state.pendingQuelsIdiots.phase === 'tutor' && (
          <ChoiceModal
            title="Quels idiots !"
            prompt="Quel Allié récupérer ?"
            layout="row"
            options={[...user.deck, ...user.discard]
              .filter((c) => (state.pendingQuelsIdiots!.candidateIds ?? []).includes(c.instanceId))
              .map((c) => ({
                key: c.instanceId,
                label: c.name,
                description: `Force ${c.strength ?? '?'}`,
                imageSrc: getCardDef(c.cardId)?.image,
                onSelect: () => resolveQuelsIdiotsPick(c.instanceId),
              }))}
          />
        )}

      {/* Apparition / Vent de panique : l'humain (chooser) déplace un Héros.
          Cas « destination imposée » (Capture) EXCLU : choix par clic direct sur le
          plateau (Héros surlignés en ambre), pas de modal. */}
      {state.pendingHeroRelocate &&
        state.pendingHeroRelocate.chooserIndex === HUMAN &&
        state.pendingHeroRelocate.forcedLocationId === undefined && (
        <HeroRelocateModal
          target={state.players[state.pendingHeroRelocate.targetIndex]}
          anyLocation={state.pendingHeroRelocate.anyLocation}
          candidateIds={state.pendingHeroRelocate.candidateIds}
          forcedDirection={state.pendingHeroRelocate.forcedDirection}
          forcedLocationId={state.pendingHeroRelocate.forcedLocationId}
          optional={state.pendingHeroRelocate.optional}
          allowedLocationIds={state.pendingHeroRelocate.allowedLocationIds}
          onResolve={resolveHeroRelocate}
          onSkip={skipHeroRelocate}
        />
      )}

      {/* Flèche de Mome Raths : l'humain (chooser) déplace un Allié de la cible. */}
      {state.pendingAllyRelocate && state.pendingAllyRelocate.chooserIndex === HUMAN && (
        <AllyRelocateModal
          target={state.players[state.pendingAllyRelocate.targetIndex]}
          onResolve={resolveAllyRelocate}
          title={state.pendingAllyRelocate.title}
          remaining={state.pendingAllyRelocate.remaining ?? 1}
          optional={state.pendingAllyRelocate.optional}
          onSkip={skipAllyRelocate}
          onlyInstanceIds={state.pendingAllyRelocate.onlyInstanceIds}
          adjacentOnly={state.pendingAllyRelocate.adjacentOnly}
        />
      )}

      {/* Team Rocket — un dresseur invoque un Pokémon : l'humain choisit lequel (Stari/Togepi…). */}
      {state.pendingPokemonSummon && state.pendingPokemonSummon.chooserIndex === HUMAN && (
        <PokemonSummonModal
          candidateCardIds={state.pendingPokemonSummon.candidateCardIds}
          onResolve={resolvePokemonSummon}
        />
      )}

      {/* Pat Hibulaire — « Planqués » : l'humain (s'il pose la Fatalité) choisit le Bandit à défausser. */}
      {state.pendingFateDiscardAlly && state.pendingFateDiscardAlly.chooserIndex === HUMAN && (
        <FateDiscardAllyModal
          target={state.players[state.pendingFateDiscardAlly.targetIndex]}
          candidateIds={state.pendingFateDiscardAlly.candidateIds}
          cardName={state.pendingFateDiscardAlly.cardName}
          onResolve={resolveFateDiscardAlly}
        />
      )}

      {/* Syndrome — Identification, je vous prie : l'humain déplace un Allié/Objet vers un lieu avec Héros. */}
      {state.pendingIdentification && state.pendingIdentification.playerIndex === HUMAN && (
        <IdentificationModal
          player={state.players[state.pendingIdentification.playerIndex]}
          onResolve={resolveIdentification}
        />
      )}

      {/* Dr Facilier — L'étoile du soir : c'est MOI qui pose la Fatalité → je choisis l'Allié
          de l'adversaire (Facilier) qui part dans sa Pile de l'Au-delà. */}
      {state.pendingFateAllyToAuDela && state.pendingFateAllyToAuDela.chooserIndex === HUMAN && (
        <EtoileDuSoirModal
          target={state.players[state.pendingFateAllyToAuDela.targetIndex]}
          onResolve={resolveFateAllyToAuDela}
        />
      )}

      {/* Oogie Boogie — Mettons fin à ce cauchemar : c'est MOI qui pose la Fatalité → je
          vois la main d'Oogie et j'en défausse une carte. */}
      {state.pendingFateDiscardHand && state.pendingFateDiscardHand.chooserIndex === HUMAN && (
        <SetThingsRightModal
          target={state.players[state.pendingFateDiscardHand.targetIndex]}
          onResolve={resolveFateDiscardHand}
        />
      )}

      {/* Hadès — Alignement des planètes : je choisis les Titans à désentraver. */}
      {state.pendingUntrapTitans && state.pendingUntrapTitans.playerIndex === HUMAN && (
        <UntrapTitansModal
          player={state.players[state.pendingUntrapTitans.playerIndex]}
          power={state.players[state.pendingUntrapTitans.playerIndex].power}
          onResolve={resolveUntrapTitans}
        />
      )}

      {/* Oogie Boogie — Diversion (2ᵉ temps) : je défausse un Allié/Objet du lieu d'arrivée. */}
      {state.pendingDiversionDiscard && state.pendingDiversionDiscard.chooserIndex === HUMAN && (
        <DiversionDiscardModal
          target={state.players[state.pendingDiversionDiscard.targetIndex]}
          locationId={state.pendingDiversionDiscard.locationId}
          onResolve={resolveDiversionDiscard}
        />
      )}

      {/* Lotso — choix de cible (réduire un Héros / déplacer vers la Salle des Chenilles). */}
      {state.pendingLotsoTarget && state.pendingLotsoTarget.playerIndex === HUMAN && (
        <LotsoTargetModal
          player={state.players[state.pendingLotsoTarget.playerIndex]}
          candidateIds={state.pendingLotsoTarget.candidateIds}
          label={state.pendingLotsoTarget.label}
          onResolve={resolveLotsoTarget}
        />
      )}

      {/* Team Rocket — Évolution : choix de l'Allié à faire évoluer. */}
      {state.pendingEvolveAlly && state.pendingEvolveAlly.playerIndex === HUMAN && (
        <LotsoTargetModal
          player={state.players[state.pendingEvolveAlly.playerIndex]}
          candidateIds={state.pendingEvolveAlly.candidateIds}
          label="Faire évoluer un Allié"
          onResolve={resolveEvolveAlly}
        />
      )}

      {/* Lotso — Réinitialisation : choix du lieu où placer Buzz (mode Démo). */}
      {state.pendingLotsoBuzzMove && state.pendingLotsoBuzzMove.playerIndex === HUMAN && (
        <LotsoBuzzMoveModal
          player={state.players[state.pendingLotsoBuzzMove.playerIndex]}
          onResolve={resolveLotsoBuzzMove}
        />
      )}

      {/* Lotso — Le Bibliothécaire : répartition interactive des réductions de force. */}
      {state.pendingLotsoBookworm && state.pendingLotsoBookworm.playerIndex === HUMAN && (
        <LotsoBookwormModal
          power={state.players[HUMAN].power}
          spent={state.pendingLotsoBookworm.spent}
          candidates={lotsoReducibleHeroes(state, HUMAN).map((id) => {
            const p = state.players[HUMAN]
            const loc = p.locations.find((l) => (p.board[l.id] ?? []).some((c) => c.instanceId === id))
            const c = loc ? (p.board[loc.id] ?? []).find((x) => x.instanceId === id)! : undefined
            return {
              instanceId: id,
              cardId: c?.cardId ?? '',
              name: c?.name ?? '',
              strength: effectiveStrength(state, HUMAN, id) ?? 0,
              locationName: loc?.name ?? '',
            }
          })}
          onReduce={resolveLotsoBookworm}
          onDone={() => resolveLotsoBookworm(null)}
        />
      )}

      {/* Lotso — Flex : phase 1 = choisir le Héros/Buzz à déplacer (LotsoTargetModal). */}
      {state.pendingLotsoFlex && state.pendingLotsoFlex.playerIndex === HUMAN && !state.pendingLotsoFlex.cardInstanceId && (
        <LotsoTargetModal
          player={state.players[HUMAN]}
          candidateIds={state.pendingLotsoFlex.candidateIds}
          label="Flex : quel Héros / Gardien déplacer ?"
          onResolve={(cardInstanceId) => resolveLotsoFlex({ cardInstanceId })}
        />
      )}
      {/* Lotso — Flex : phase 2 = choisir le lieu de destination (≠ lieu de Flex). */}
      {state.pendingLotsoFlex && state.pendingLotsoFlex.playerIndex === HUMAN && state.pendingLotsoFlex.cardInstanceId && (
        <LotsoBuzzMoveModal
          player={state.players[HUMAN]}
          title="Flex : vers quel lieu ?"
          excludeLocationId={state.pendingLotsoFlex.fromLocationId}
          onResolve={(to) => resolveLotsoFlex({ to })}
        />
      )}

      {/* Maximus (Gothel) : l'humain (joueur qui fatalise) repositionne Cavaliers + Maximus. */}
      {state.pendingMaximus && state.pendingMaximus.chooserIndex === HUMAN && (
        <MaximusModal
          target={state.players[state.pendingMaximus.targetIndex]}
          phase={state.pendingMaximus.phase}
          maximusInstanceId={state.pendingMaximus.maximusInstanceId}
          onCavaliers={resolveMaximusCavaliers}
          onMaximus={resolveMaximusMove}
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
        <ScryModal cards={state.pendingScry.cards} onResolve={(ids) => resolveScry(ids)} pasSiVite={state.pendingScry.pasSiVite} />
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

      {/* Te revoilà ! (Bowser) : reprendre N'IMPORTE quelle carte de la défausse →
          on ouvre la modale de défausse (grille défilable), cartes cliquables. */}
      {state.pendingRecover && state.pendingRecover.playerIndex === HUMAN && state.pendingRecover.label === 'Te revoilà !' && (() => {
        const ids = new Set(state.pendingRecover.candidateIds)
        const cards = user.discard.filter((c) => ids.has(c.instanceId))
        return (
          <DiscardModal
            cards={cards}
            label={`Te revoilà ! — reprends une carte de ta défausse`}
            onPick={(instanceId) => resolveRecover(instanceId)}
          />
        )
      })()}

      {/* Opportunisme / Tâche : Téléchargement : reprendre une carte de la défausse. */}
      {state.pendingRecover && state.pendingRecover.playerIndex === HUMAN && state.pendingRecover.label !== 'Magie noire' && state.pendingRecover.label !== 'Te revoilà !' && (() => {
        const ids = new Set(state.pendingRecover.candidateIds)
        const cards = [...user.discard, ...user.deck].filter((c) => ids.has(c.instanceId))
        const title =
          state.pendingRecover.label === 'Tâche : Téléchargement'
            ? 'Téléchargement : reprends une carte de ta défausse'
            : state.pendingRecover.label === 'Extravagance'
              ? 'Extravagance : reprends un Objet de ta défausse'
              : state.pendingRecover.label === 'Terreur'
                ? 'Terreur : reprends un Allié ou un Événement de ta défausse'
                : state.pendingRecover.label === 'Justice'
                  ? 'Justice : reprends un Allié de ta défausse'
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

      {/* Soyez prêtes ! (Scar) : reprendre 1 Événement OU jusqu'à 2 Alliés. */}
      {state.pendingBePrepared && state.pendingBePrepared.playerIndex === HUMAN && (() => {
        const ids = new Set(state.pendingBePrepared.candidateIds)
        const cards = user.discard.filter((c) => ids.has(c.instanceId))
        const title = state.pendingBePrepared.alliesOnly
          ? 'Soyez prêtes ! : reprends un 2ᵉ Allié (ou termine)'
          : 'Soyez prêtes ! : reprends 1 Événement ou jusqu’à 2 Alliés'
        return (
          <CardChoiceModal
            title={title}
            cards={cards}
            noneLabel="Terminer"
            onNone={() => resolveBePrepared(null)}
            onClose={() => resolveBePrepared(null)}
            onPick={(card) => resolveBePrepared(card.instanceId)}
          />
        )
      })()}

      {/* Shenzi (Scar) : jouer gratuitement une Hyène de la main (ou décliner). */}
      {state.pendingFreeHyena && state.pendingFreeHyena.playerIndex === HUMAN && (() => {
        const ids = new Set(state.pendingFreeHyena.candidateIds)
        const cards = user.hand.filter((c) => ids.has(c.instanceId))
        return (
          <CardChoiceModal
            title="Shenzi : joue gratuitement une Hyène (facultatif)"
            cards={cards}
            noneLabel="Ne pas jouer"
            onNone={() => resolveFreeHyena(null)}
            onClose={() => resolveFreeHyena(null)}
            onPick={(card) => resolveFreeHyena(card.instanceId)}
          />
        )
      })()}

      {/* Yzma — bandeau d'instruction pour le choix d'une pioche Fatalité par clic
          (non bloquant : la pioche à dévoiler clignote sur le plateau). */}
      {fatePileBanner && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-xl border border-amber-300/70 bg-[#1a1226]/95 px-4 py-2 text-center text-sm font-bold text-amber-100 shadow-2xl">
          {fatePileBanner}
        </div>
      )}

      {/* Capture (Ratigan) — bandeau d'instruction pour le choix du Héros par clic
          direct (non bloquant : les Héros candidats clignotent en ambre). */}
      {relocateHeroTargets.length > 0 && state.pendingHeroRelocate?.forcedLocationId && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-xl border border-amber-300/70 bg-[#1a1226]/95 px-4 py-2 text-center text-sm font-bold text-amber-100 shadow-2xl">
          Clique le Héros à déplacer vers{' '}
          {user.locations.find((l) => l.id === state.pendingHeroRelocate!.forcedLocationId)?.name ??
            state.pendingHeroRelocate.forcedLocationId}
          .
        </div>
      )}

      {/* Yzma (Fatalité) : la phase « pioche » se fait par clic direct sur la pioche
          du plateau (cf. HeroRow / fatePickable). Ici on ne garde QUE la phase
          « carte » : choisir la carte à jouer parmi celles dévoilées. */}
      {state.pendingYzmaFate && state.pendingYzmaFate.phase === 'card' && state.pendingYzmaFate.chooserIndex === HUMAN && (() => {
        const yf = state.pendingYzmaFate
        return (
          <YzmaFateModal
            target={state.players[yf.targetIndex]}
            phase={yf.phase}
            cards={yf.cards}
            onChooseDeck={(loc) => resolveYzmaFateDeck(loc)}
            onChooseCard={(id) => resolveYzmaFateCard(id)}
          />
        )
      })()}

      {/* Yzma (Ironie du sort) : rejouer un Événement de la défausse. */}
      {state.pendingReplayEvent && state.pendingReplayEvent.playerIndex === HUMAN && (() => {
        const ids = new Set(state.pendingReplayEvent.candidateIds)
        const cards = user.discard.filter((c) => ids.has(c.instanceId))
        return (
          <CardChoiceModal
            title="Ironie du sort : rejouez un Événement (vous en payez le coût)"
            cards={cards}
            noneLabel="Ne rien rejouer"
            onNone={() => resolveReplayEvent(null)}
            onClose={() => resolveReplayEvent(null)}
            onPick={(card) => resolveReplayEvent(card.instanceId)}
          />
        )
      })()}

      {/* Yzma (Finis le travail) : choisir un Allié puis un lieu portant un Héros. */}
      {/* Finis le travail (Yzma) — phase 2 : choix du lieu (à Héros) de destination.
          La phase 1 (choix de l'Allié) se fait par clic direct sur le plateau. */}
      {state.pendingFinishJob && state.pendingFinishJob.playerIndex === HUMAN && state.pendingFinishJob.allyInstanceId && (
        <GiantActionModal
          player={user}
          locations={user.locations.filter((l) => (user.board[l.id] ?? []).some((c) => c.type === 'hero')).map((l) => l.id)}
          title="Finis le travail — lieu de destination"
          subtitle="Choisissez un lieu portant un Héros où déplacer l’Allié."
          onResolve={(loc) => resolveFinishJob(undefined, loc)}
        />
      )}

      {/* Yzma — Beauté endormie : réveil au début du tour (avant déplacement). */}
      {state.pendingBeautySleep && state.pendingBeautySleep.playerIndex === HUMAN && (
        <BeautySleepModal
          player={user}
          onConfirm={(gainPower, draw, heroMove) => resolveBeautySleep(gainPower, draw, heroMove)}
        />
      )}

      {/* Yzma (À l'attaque ! / Marteau / Indiscrétion) : le choix de la pioche se fait
          par clic direct sur le plateau (cf. HeroRow / fatePickable). On garde ici la
          révélation d'Indiscrétion (lecture seule) et le choix FACE CACHÉE du Marteau. */}
      {state.pendingYzmaOwnDeck && state.pendingYzmaOwnDeck.playerIndex === HUMAN &&
        state.pendingYzmaOwnDeck.revealCards && (
          <CardChoiceModal
            title={
              state.pendingYzmaOwnDeck.mode === 'attack'
                ? 'À l’attaque ! : contenu de la pioche'
                : 'Indiscrétion : contenu de la pioche'
            }
            cards={state.pendingYzmaOwnDeck.revealCards}
            onClose={() => resolveYzmaOwnDeck('')}
            onPick={() => resolveYzmaOwnDeck('')}
          />
        )}
      {state.pendingYzmaOwnDeck && state.pendingYzmaOwnDeck.playerIndex === HUMAN &&
        state.pendingYzmaOwnDeck.hammerPick && (() => {
          const hp = state.pendingYzmaOwnDeck.hammerPick!
          return (
            <YzmaHammerModal
              backImage={user.backFateImage}
              locationName={user.locations.find((l) => l.id === hp.locationId)?.name ?? hp.locationId}
              cards={hp.cards}
              count={hp.count}
              onConfirm={(ids) => resolveYzmaHammer(ids)}
            />
          )
        })()}

      {/* Yzma (Paysan / Attention au groove ! / Pacha) : choix interactif (optionnel)
          d'un Héros de la défausse et des pioches à mélanger. */}
      {state.pendingYzmaManipulate && state.pendingYzmaManipulate.playerIndex === HUMAN && (
        <YzmaManipulateModal
          player={user}
          mode={state.pendingYzmaManipulate.mode}
          count={state.pendingYzmaManipulate.count}
          optional={state.pendingYzmaManipulate.optional}
          heroIds={state.pendingYzmaManipulate.heroIds}
          onResolve={(heroId, locs) => resolveYzmaManipulate(heroId, locs)}
        />
      )}

      {/* Hakuna Matata (Scar) : rejouer un Héros de la Succession ou déplacer un Héros. */}
      {state.pendingHakunaMatata && state.pendingHakunaMatata.playerIndex === HUMAN && (() => {
        const phm = state.pendingHakunaMatata
        const succIds = new Set(phm.successionIds)
        const realmIds = new Set(phm.realmHeroIds)
        const successionHeroes = (user.succession ?? []).filter((c) => succIds.has(c.instanceId))
        const realmHeroes = Object.values(user.board).flat().filter((c) => realmIds.has(c.instanceId))
        return (
          <HakunaMatataModal
            successionHeroes={successionHeroes}
            realmHeroes={realmHeroes}
            onPlay={(instanceId) => resolveHakunaMatata('play', instanceId)}
            onMove={(instanceId) => resolveHakunaMatata('move', instanceId)}
          />
        )
      })()}

      {/* Préparation de Noël (≥8) : 4 colonnes (lieux) listant leurs actions dispo. */}
      {state.pendingGiantAction && state.pendingGiantAction.playerIndex === HUMAN && state.pendingGiantAction.viaChristmas && (
        <ChristmasFreeActionModal player={user} onPick={(loc) => resolveGiantLocation(loc)} />
      )}

      {/* Colère Titanesque : choisir un lieu voisin où agir. */}
      {state.pendingGiantAction && state.pendingGiantAction.playerIndex === HUMAN && !state.pendingGiantAction.viaChristmas && (
        <GiantActionModal
          player={user}
          onResolve={(loc) => resolveGiantLocation(loc)}
          locations={
            state.pendingGiantAction.viaFollowMe || state.pendingGiantAction.viaChristmas
              ? state.pendingGiantAction.locations
              : undefined
          }
          title={
            state.pendingGiantAction.viaFollowMe
              ? 'Suivez-moi ! — lieu d’une Hyène'
              : state.pendingGiantAction.viaCanne
                ? 'Canne — lieu voisin'
                : state.pendingGiantAction.viaChristmas
                  ? 'Préparation de Noël — action gratuite'
                  : undefined
          }
          subtitle={
            state.pendingGiantAction.viaFollowMe
              ? 'Choisissez le lieu d’une Hyène (hors votre lieu) : vous y effectuerez une action disponible (hors Fatalité).'
              : state.pendingGiantAction.viaCanne
                ? 'Choisissez un lieu voisin : vous y effectuerez une action disponible (hors Fatalité).'
                : state.pendingGiantAction.viaChristmas
                  ? 'Choisissez n’importe quel lieu : vous y effectuerez une action disponible gratuite (hors Fatalité).'
                  : undefined
          }
        />
      )}

      {/* Oogie — Baignoire : choisir les Alliés à emmener vers la destination. */}
      {mode?.kind === 'baignoire-pick-allies' && (() => {
        const allies = (user.board[mode.from] ?? []).filter((c) => c.type === 'ally' && !c.attachedTo && !c.isWicket)
        const destName = user.locations.find((l) => l.id === mode.to)?.name ?? mode.to
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
            <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a0a24] p-6 text-white">
              <h2 className="text-xl font-black text-emerald-200">Baignoire</h2>
              <p className="text-center text-sm text-white/70">
                Quels Alliés emmener vers <b>{destName}</b> ? (clique pour cocher/décocher — tu peux n’en emmener aucun)
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {allies.map((a) => {
                  const def = getCardDef(a.cardId)
                  const on = mode.selected.includes(a.instanceId)
                  return (
                    <button
                      key={a.instanceId}
                      type="button"
                      onClick={() => toggleBaignoireAlly(a.instanceId)}
                      className={`rounded-lg border-2 p-1 transition ${on ? 'border-emerald-300 ring-2 ring-emerald-300' : 'border-white/15 opacity-60 hover:opacity-100'}`}
                    >
                      <img src={def?.image} alt={a.name} className="h-36 w-auto rounded" />
                      <div className="mt-1 text-center text-[11px] text-white/80">{on ? '✓ Emmener' : 'Laisser'}</div>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={confirmBaignoire}
                className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/30"
              >
                Déplacer la Baignoire ({mode.selected.length} Allié{mode.selected.length > 1 ? 's' : ''})
              </button>
            </div>
          </div>
        )
      })()}

      {/* Mim — Le Savoir conduit à la Puissance : choisir un Merlin + un lieu. */}
      {state.pendingMerlinMove && state.pendingMerlinMove.chooserIndex === HUMAN && (
        <MerlinMoveModal
          target={state.players[state.pendingMerlinMove.targetIndex]}
          candidateIds={state.pendingMerlinMove.candidateIds}
          onResolve={resolveMerlinMove}
        />
      )}

      {/* Oogie — Père Noël : défausse libre (autant que voulu) puis pioche. */}
      {state.pendingDiscardThenDraw && state.pendingDiscardThenDraw.playerIndex === HUMAN && (
        <ChristmasDiscardModal
          hand={user.hand}
          draw={state.pendingDiscardThenDraw.draw}
          onResolve={(ids) => resolveDiscardThenDraw(ids)}
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

      {/* Liste de Fidget (Ratigan) : montre toutes les cartes dévoilées. */}
      {state.pendingReveal && state.pendingReveal.playerIndex === HUMAN && (
        <RevealModal
          cards={state.pendingReveal.cards}
          keptInstanceId={state.pendingReveal.keptInstanceId}
          title={state.pendingReveal.title}
          subtitle={state.pendingReveal.subtitle}
          heroInstanceIds={state.pendingReveal.heroInstanceIds}
          onAcknowledge={acknowledgeReveal}
        />
      )}

      {/* Sombra — Piratage : choix de l'action à désactiver par clic DIRECT sur le
          plateau (les cases concernées clignotent en fuchsia, cf. BoardActions).
          Bandeau d'instruction non bloquant. */}
      {state.pendingHack && state.pendingHack.playerIndex === HUMAN && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-xl border border-fuchsia-300/70 bg-[#1a1226]/95 px-4 py-2 text-center text-sm font-bold text-fuchsia-100 shadow-2xl">
          Piratage de{' '}
          {user.locations.find((l) => l.id === state.pendingHack!.locationId)?.name ??
            state.pendingHack.locationId}
          {' '}: clique l’action à désactiver.
        </div>
      )}

      {/* Tamatoa — Crustacé doté du pouvoir de création : les Objets dévoilés se posent par
          CLIC sur un lieu. Bandeau (non bloquant) montrant les Objets dévoilés, celui à poser
          en surbrillance, pour qu'on voie clairement ce qu'on joue. */}
      {state.pendingCrustaceanPlace && state.pendingCrustaceanPlace.playerIndex === HUMAN && (() => {
        const items = state.pendingCrustaceanPlace.items
        const cur = items[0]
        return (
          <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 flex flex-col items-center gap-2 rounded-xl border border-amber-300/70 bg-[#1a1226]/95 px-4 py-3 text-center text-sm font-bold text-amber-100 shadow-2xl">
            <span>
              Crustacé : posez <span className="text-amber-300">{cur?.name}</span> — cliquez un lieu.
              {items.length > 1 ? ` (${items.length - 1} autre${items.length - 1 > 1 ? 's' : ''} ensuite)` : ''}
            </span>
            <div className="flex items-end justify-center gap-2">
              {items.map((it, i) => {
                const img = getCardDef(it.cardId)?.image
                return img ? (
                  <img
                    key={it.instanceId}
                    src={img}
                    alt={it.name}
                    className={`w-auto rounded-md ${i === 0 ? 'h-28 ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.6)]' : 'h-20 opacity-50 ring-1 ring-white/20'}`}
                  />
                ) : null
              })}
            </div>
          </div>
        )
      })()}

      {/* Sombra — Information : garder la pioche (défausser 2 de la main) ou défausser les cartes piochées. */}
      {state.pendingInformation && state.pendingInformation.playerIndex === HUMAN && (
        <InformationModal
          drawn={user.hand.filter((c) => state.pendingInformation!.drawnIds.includes(c.instanceId))}
          discardCount={state.pendingInformation.discardCount}
          onChoose={resolveInformation}
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

      {/* Mère Gothel — Couronne : confirmer la défausse contre 1 jeton Confiance. */}
      {crownConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="flex w-[24rem] max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/15 bg-[#15101f] p-6 shadow-2xl">
            <h2 className="text-center text-lg font-bold text-pink-200">Couronne</h2>
            {getCardDef('couronne-gothel')?.image && (
              <img src={getCardDef('couronne-gothel')!.image} alt="Couronne" className="mx-auto w-24 rounded-lg border border-white/15 shadow" />
            )}
            <p className="text-center text-sm text-white/80">Défausser la Couronne pour gagner 1 jeton Confiance ?</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => { sacrificeCrown(crownConfirm); setCrownConfirm(null) }}
                className="flex-1 rounded-lg border border-pink-400/60 bg-pink-500/20 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-pink-500/30"
              >
                Défausser → +1 Confiance
              </button>
              <button
                type="button"
                onClick={() => setCrownConfirm(null)}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
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
            : pfc.kind === 'remove-card'
              ? 'Vieillissement : défaussez un Allié ou un Objet (coût ≤ 2)'
            : pfc.kind === 'remove-item'
              ? 'Migraine Atroce : défaussez un Objet'
              : pfc.kind === 'discard-from-hand'
                ? `Animaux de la forêt : main de ${tgt.villainName} — défaussez une carte`
                : pfc.kind === 'fate-discard-hero-to-top'
                  ? `Premier baiser d'amour : un Héros revient sur le dessus de la Fatalité de ${tgt.villainName}`
                  : pfc.kind === 'play-revealed-fate-hero'
                    ? 'Longue vie au roi ! : choisissez le Héros à jouer dans votre royaume'
                    : pfc.kind === 'play-fate-card-from-discard'
                      ? 'Petit secret : choisissez la carte Fatalité à jouer'
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
            villainPresentation(presKey(state.players[HUMAN].villain)),
            villainPresentation(presKey(state.players[BOT].villain)),
          ]}
          villainKeys={[
            presKey(state.players[HUMAN].villain),
            presKey(state.players[BOT].villain),
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
            villainPresentation(presKey(state.players[HUMAN].villain)),
            villainPresentation(presKey(state.players[BOT].villain)),
          ]}
          onDone={() => setStartRollDone(true)}
        />
      )}

      {/* Distribution d'OUVERTURE : la main de départ est piochée carte par carte
          (vol → retournement + agrandissement au centre → rangement dans l'éventail),
          avant le tout premier tour. */}
      {dealOverlay && (
        <OpeningDeal
          key={dealOverlay.key}
          cards={dealOverlay.cards}
          onLanded={(id) => setDealHiddenIds((ids) => ids.filter((x) => x !== id))}
          onComplete={() => {
            const wasOpening = dealOverlay.isOpening
            setDealOverlay(null)
            setDealHiddenIds([])
            if (wasOpening) setOpeningDealDone(true)
          }}
        />
      )}

      {/* Affiche « À vous de jouer » au début du tour du joueur (key = tour → l'anim
          redémarre à chaque tour). */}
      {showTurnSplash && isHumanTurn && (
        <TurnSplash key={state.turn} villainName={user.villainName} image={villainPresentation(presKey(state.players[HUMAN].villain))} />
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

      {/* MODE TEST : cadre vert épais autour de l'écran (repère visuel « on est en
          mode test »). pointer-events-none → ne bloque aucun clic. */}
      {testMode && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] border-[6px] border-emerald-500" />
      )}

      {/* MODE TEST : éditeur de positions des actions — MODAL plein écran (plateau
          agrandi pour plus de précision : pastilles illuminées, draggables). */}
      {testMode && highlightActions && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/92 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-white">
            <span className="font-black text-lime-200">Éditeur de positions</span>
            <select
              value={editVillain}
              onChange={(e) => selectEditVillain(e.target.value as VillainKey)}
              className="rounded border border-white/25 bg-[#1a0a24] px-2 py-1 text-white"
            >
              {(Object.keys(VILLAIN_REGISTRY) as VillainKey[]).map((k) => (
                <option key={k} value={k}>{VILLAIN_REGISTRY[k].def.name}</option>
              ))}
            </select>
            {selectedAction ? (
              <>
                <span className="text-cyan-200">{selectedAction.locName} · <b>{selectedAction.label}</b></span>
                <label className="flex items-center gap-1">left%
                  <input type="number" step={0.5} value={actionEdit[selectedAction.key]?.x ?? 0}
                    onChange={(e) => updateActionPos('x', parseFloat(e.target.value))}
                    className="w-20 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-right" />
                </label>
                <label className="flex items-center gap-1">top%
                  <input type="number" step={0.5} value={actionEdit[selectedAction.key]?.y ?? 0}
                    onChange={(e) => updateActionPos('y', parseFloat(e.target.value))}
                    className="w-20 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-right" />
                </label>
              </>
            ) : (
              <span className="text-white/60">Clique une pastille puis glisse-la (ou ajuste left/top).</span>
            )}
            <button onClick={saveActionPositions}
              className="rounded-lg border border-lime-400/60 px-3 py-1.5 font-semibold text-lime-200 hover:bg-lime-500/15">
              💾 Sauvegarder les positions
            </button>
            {savePosMsg && <span className="text-xs text-lime-300">{savePosMsg}</span>}
            <button onClick={() => setHighlightActions(false)}
              className="ml-auto rounded-lg border border-white/25 px-3 py-1.5 text-white/80 hover:bg-white/10">
              ✕ Fermer
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="relative mx-auto w-full">
              <img src={editDef.boardImage} alt="" className="w-full select-none rounded-lg" draggable={false} />
              <BoardActions
                // Player factice : en mode `highlightAll`, BoardActions n'utilise que
                // `player.villain` (clé ACTION_POS) et `player.locations`.
                player={{ villain: editDef.id, locations: editDef.locations } as unknown as PlayerState}
                availableActionIds={[]}
                usedActionIds={[]}
                onActionClick={noop}
                highlightAll
                editMode
                posOverride={actionEdit}
                selectedKey={selectedAction?.key ?? null}
                onSelectAction={handleSelectActionPos}
                onMoveAction={handleMoveActionPos}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE TEST : éditeur de TAILLE DU PION — panneau flottant avec un curseur (preview
          en direct sur le plateau) et un bouton de sauvegarde (écrit `pawnHeightPx`). */}
      {testMode && pawnEdit && (
        <div className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-lime-400/40 bg-[#120c22]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-sm">
          <span className="font-black text-lime-200">♟ Taille du pion</span>
          <span className="text-cyan-200">{VILLAIN_REGISTRY[pawnEdit.villain].def.name}</span>
          <input
            type="range"
            min={40}
            max={160}
            step={1}
            value={pawnEdit.size}
            onChange={(e) => { setPawnEdit({ ...pawnEdit, size: Number(e.target.value) }); setSavePawnMsg(null) }}
            className="h-2 w-56 cursor-pointer accent-lime-400"
            aria-label="Taille du pion"
          />
          <span className="w-16 text-right font-mono text-white/80">{pawnEdit.size}px</span>
          <button
            onClick={savePawnSize}
            className="rounded-lg border border-lime-400/60 px-3 py-1.5 font-semibold text-lime-200 hover:bg-lime-500/15"
          >
            💾 Sauvegarder
          </button>
          {savePawnMsg && <span className="text-xs text-lime-300">{savePawnMsg}</span>}
          <button
            onClick={() => { setPawnEdit(null); setSavePawnMsg(null) }}
            className="rounded-lg border border-white/25 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            ✕ Fermer
          </button>
        </div>
      )}

      {/* MODE TEST : éditeur de portrait (collaborateurs) — cadre + titre, puis remplacement. */}
      {testMode && portraitEdit && (
        <PortraitEditorModal
          onClose={() => setPortraitEdit(false)}
          initialVillain={villainKeyOf(user.villain)}
        />
      )}

      {/* MODE TEST : éditeur de couleur du méchant (pipette sur le dos de carte). */}
      {testMode && colorEdit && (
        <VillainColorModal
          onClose={() => setColorEdit(false)}
          initialVillain={villainKeyOf(user.villain)}
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
