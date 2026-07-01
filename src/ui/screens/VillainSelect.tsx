import { useEffect, useMemo, useState } from 'react'
import { VILLAIN_REGISTRY, villainEntry, isCustomKey, useGameStore, type VillainKey } from '../store/gameStore'
import { useCustomVillainStore } from '../store/customVillainStore'
import { usePlayerStore } from '../store/playerStore'
import { useIsDesktopApp } from '../store/settingsStore'
import { villainPortrait, villainPresentation, PRESENTATION_TWEAK } from '../villainArt'
import { byRelease } from '../villainOrder'
import { VILLAIN_COLOR, villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from '../villainColors'
import { Scroller } from '../components/Scroller'
import { OptionsButton } from '../components/OptionsButton'
import { playHeroSelect, playPlayButtonHover, playBackClick, playHover, playHeroHover } from '../sfx'
import { playVillainPhrase } from '../villainVoices'

interface Props {
  /** Le vilain est choisi et la partie démarre (l'écran de jeu prend le relais). */
  onStart: () => void
  /** Revenir au menu principal. */
  onBack: () => void
}

/** Un choix possible : un vilain précis (clé native OU id `custom-…` d'un vilain
 *  publié) ou « aléatoire ». */
type Choice = string | 'random'

/** Camp en cours d'attribution (solo). */
type Side = 'mine' | 'opp'

/** Clés des vilains natifs (statiques), dans l'ordre de SORTIE (comme la galerie).
 *  Les vilains publiés s'y ajoutent au runtime (après, façon nouveautés). */
const BUILTIN_KEYS = (Object.keys(VILLAIN_REGISTRY) as VillainKey[]).sort(byRelease)

/** Apparence d'un camp (toi / adversaire). */
const SIDE_STYLE: Record<Side, { label: string; badge: string; ring: string; text: string }> = {
  mine: { label: 'Toi', badge: 'bg-amber-400 text-black', ring: 'ring-amber-400', text: 'text-amber-200' },
  opp: { label: 'Adversaire', badge: 'bg-purple-400 text-black', ring: 'ring-purple-400', text: 'text-purple-200' },
}

/** Une tuile de la grille : portrait (ou 🎲) avec les pastilles des camps qui l'ont
 *  choisie. Cliquer assigne au camp actif (géré par le parent). */
function Tile({
  choice,
  mineIs,
  oppIs,
  mineLabel,
  oppLabel,
  oppHovering = false,
  disabled,
  onPick,
  onHoverEnter,
}: {
  choice: Choice
  mineIs: boolean
  oppIs: boolean
  /** Libellé du camp « toi » (nom du joueur). */
  mineLabel: string
  /** Libellé du camp adversaire (nom de l'autre joueur en réseau). */
  oppLabel: string
  /** Réseau : l'adversaire SURVOLE cette tuile (curseur en direct, pas encore choisi). */
  oppHovering?: boolean
  /** Réservée par l'autre camp en réseau : non sélectionnable (pas de miroir). */
  disabled: boolean
  onPick: () => void
  /** Survol local de la tuile (pour diffuser mon curseur en réseau). */
  onHoverEnter?: () => void
}) {
  const isRandom = choice === 'random'
  const v = isRandom ? null : villainEntry(choice)
  // Anneau de la tuile : amber si à toi, violet si à l'adversaire (toi prioritaire).
  const ring = mineIs ? SIDE_STYLE.mine.ring : oppIs ? SIDE_STYLE.opp.ring : ''
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) { playHeroSelect(); onPick() } }}
      onMouseEnter={() => { if (!disabled) { playHeroHover(); onHoverEnter?.() } }}
      disabled={disabled}
      aria-pressed={mineIs || oppIs}
      title={disabled ? 'Déjà choisi par l’autre camp' : isRandom ? 'Un vilain au hasard' : v?.def.objectiveDescription}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
        disabled
          ? 'cursor-not-allowed border-white/5 bg-black/40 opacity-40'
          : ring
            ? `border-transparent bg-black/45 ring-2 ${ring}`
            : 'border-white/10 bg-black/45 hover:border-white/30 hover:bg-black/60'
      }`}
    >
      {isRandom ? (
        <span className="flex aspect-square w-full items-center justify-center bg-white/5 text-4xl">🎲</span>
      ) : (
        <img src={villainPortrait(choice)} alt={v?.def.name} className="aspect-square w-full object-cover" />
      )}
      <span className="px-2 py-1.5 text-center text-xs font-bold leading-tight text-amber-100">
        {isRandom ? 'Aléatoire' : v?.def.name}
      </span>
      {/* Pastilles des camps ayant choisi cette tuile (random peut être les deux). */}
      <div className="pointer-events-none absolute left-1 top-1 flex flex-col gap-1">
        {mineIs && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${SIDE_STYLE.mine.badge}`}>
            {mineLabel}
          </span>
        )}
        {oppIs && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${SIDE_STYLE.opp.badge}`}>
            {oppLabel}
          </span>
        )}
      </div>
      {/* Curseur de l'adversaire (survol en direct, réseau) : liseré pointillé + œil. */}
      {oppHovering && (
        <>
          <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl border-2 border-dashed border-purple-300/90" />
          <span className="pointer-events-none absolute right-1 top-1 rounded bg-purple-400/90 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">
            👀 Adv
          </span>
        </>
      )}
    </button>
  )
}

/** Carte récapitulant le choix d'un camp (au-dessus de la grille). En solo elle est
 *  cliquable pour rendre ce camp « actif » (les clics sur la grille l'alimentent). */
function SlotCard({
  side,
  value,
  active,
  clickable,
  hint,
  label,
  onActivate,
}: {
  side: Side
  value: Choice | null
  active: boolean
  clickable: boolean
  /** Texte sous le slot (ex. « en direct » en réseau). */
  hint?: string
  /** Libellé du camp (remplace le libellé par défaut, ex. nom du joueur en solo). */
  label?: string
  onActivate: () => void
}) {
  const style = SIDE_STYLE[side]
  const sideLabel = label ?? style.label
  const isRandom = value === 'random'
  const v = value && value !== 'random' ? villainEntry(value) : null
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={(e) => { e.stopPropagation(); if (clickable) { playHeroSelect(); onActivate() } }}
      onMouseEnter={() => { if (clickable) playHover() }}
      className={`flex flex-1 items-center gap-3 rounded-xl border p-3 text-left transition ${
        active ? `border-transparent bg-white/5 ring-2 ${style.ring}` : 'border-white/10 bg-black/40'
      } ${clickable ? 'hover:bg-white/10' : 'cursor-default'}`}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/5">
        {isRandom ? (
          <span className="text-2xl">🎲</span>
        ) : v ? (
          <img src={villainPortrait(value as string)} alt={v.def.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl text-white/30">?</span>
        )}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
          {sideLabel}
          {active && <span className={`inline-block h-2 w-2 rounded-full ${side === 'mine' ? 'bg-amber-400' : 'bg-purple-400'}`} />}
        </span>
        <span className={`truncate text-base font-bold ${value ? style.text : 'text-white/30'}`}>
          {isRandom ? 'Aléatoire' : v ? v.def.name : 'À choisir'}
        </span>
        {hint && <span className="truncate text-[11px] text-white/40">{hint}</span>}
      </div>
    </button>
  )
}

/** Position/visibilité commune des illustrations latérales (bord + arrière-plan). */
const SIDE_ART_BASE = 'pointer-events-none absolute inset-y-0 z-0 hidden h-full w-auto lg:block'

/** Illustration « mystère » pour le choix « Aléatoire » : un vilain tiré au hasard
 *  rendu en silhouette noire légèrement floutée, avec un « ? » au centre. Le tirage
 *  est figé tant que le composant reste monté. */
function RandomArt({ side }: { side: 'left' | 'right' }) {
  const [key] = useState<VillainKey | null>(() => {
    const withArt = BUILTIN_KEYS.filter((k) => villainPresentation(k))
    return withArt[Math.floor(Math.random() * withArt.length)] ?? null
  })
  const src = key ? villainPresentation(key) : undefined
  if (!src) return null
  // Même réglage de taille/position que la présentation réelle (ex. Imposteur).
  const tweak = key ? PRESENTATION_TWEAK[key] : undefined
  const mirror = side === 'right' ? -1 : 1
  const transform = tweak
    ? `translate(${tweak.dxPct ?? 0}%, ${tweak.dyPct ?? 0}%) scale(${tweak.scale ?? 1}) scaleX(${mirror})`
    : undefined
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-0 hidden lg:block ${
        side === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      <div className="relative h-full">
        {/* Silhouette noire, légèrement floutée. */}
        <img
          src={src}
          alt=""
          aria-hidden
          style={transform ? { transform, transformOrigin: 'bottom' } : undefined}
          className={`villain-fade-bottom h-full w-auto max-w-[40vw] object-contain brightness-0 blur-[3px] ${
            side === 'left' ? 'object-left' : 'object-right'
          }`}
        />
        {/* « ? » au centre de la silhouette. */}
        <span className="absolute inset-0 flex items-center justify-center text-[11rem] font-black leading-none text-white/85 [text-shadow:0_4px_24px_rgba(0,0,0,0.85)]">
          ?
        </span>
      </div>
    </div>
  )
}

/** Illustration « en grand » du vilain choisi, ancrée sur un bord EN ARRIÈRE-PLAN
 *  (z-0, plein hauteur) pour décorer le côté sans perturber le layout des listes.
 *  « Aléatoire » → illustration mystère ; rien tant qu'aucun camp n'est choisi. */
function PresentationArt({ choice, side }: { choice: Choice | null; side: 'left' | 'right' }) {
  if (choice === 'random') return <RandomArt side={side} />
  const src = choice ? villainPresentation(choice) : undefined
  if (!src) return null
  // Réglage exceptionnel par vilain (échelle + décalage). Quand présent, on pilote
  // la transform en inline (mirror inclus) au lieu de la classe -scale-x-100.
  const tweak = choice ? PRESENTATION_TWEAK[choice as VillainKey] : undefined
  const mirror = side === 'right' ? -1 : 1
  // Art de côté : `selectDxPct` = décalage VERS LE CENTRE (côté gauche/joueur → vers la
  // droite ; côté droit/adversaire → vers la gauche). Sinon le `dxPct` de la fiche.
  const dx = tweak
    ? tweak.selectDxPct != null
      ? tweak.selectDxPct * (side === 'left' ? 1 : -1)
      : tweak.dxPct ?? 0
    : 0
  const transform = tweak
    ? `translate(${dx}%, ${tweak.dyPct ?? 0}%) scale(${tweak.scale ?? 1}) scaleX(${mirror})`
    : undefined
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      style={transform ? { transform, transformOrigin: 'bottom' } : undefined}
      className={`villain-fade-bottom ${SIDE_ART_BASE} max-w-[40vw] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] ${
        side === 'left' ? 'left-0 object-left' : tweak ? 'right-0 object-right' : 'right-0 object-right -scale-x-100'
      }`}
    />
  )
}

/**
 * Choix des vilains avant la partie.
 *  - SOLO : le joueur choisit SON vilain ET celui du bot (chacun pouvant être
 *    « aléatoire »). « Lancer la partie » réinitialise le moteur avec ce duo.
 *  - RÉSEAU : chacun ne choisit que SON vilain, en DIRECT (l'autre voit le choix
 *    en temps réel) ; un vilain pris par l'autre est grisé (pas de doublon).
 *    L'hôte lance la partie une fois les deux vilains choisis.
 */
export function VillainSelect({ onStart, onBack }: Props) {
  const reset = useGameStore((s) => s.reset)
  const startBotMatch = useGameStore((s) => s.startBotMatch)
  const mode = useGameStore((s) => s.mode)
  const lobby = useGameStore((s) => s.lobby)
  const localPlayerIndex = useGameStore((s) => s.localPlayerIndex)
  const selectVillain = useGameStore((s) => s.selectVillain)
  const setHoverVillain = useGameStore((s) => s.setHoverVillain)
  const peerHover = useGameStore((s) => s.peerHover)
  const launchGame = useGameStore((s) => s.launchGame)
  const leaveNet = useGameStore((s) => s.leaveNet)
  const quitNet = useGameStore((s) => s.quitNet)
  const netStatus = useGameStore((s) => s.netStatus)
  const netLeftNotice = useGameStore((s) => s.netLeftNotice)
  const network = mode !== 'solo'

  // Vilains PUBLIÉS (« Terminés » dans l'Atelier) : ils rejoignent la grille en SOLO.
  // (Exclus en réseau : l'autre joueur ne possède pas ces vilains chez lui.)
  const customLoaded = useCustomVillainStore((s) => s.loaded)
  const loadCustom = useCustomVillainStore((s) => s.load)
  const customVillains = useCustomVillainStore((s) => s.villains)
  useEffect(() => { if (!customLoaded) void loadCustom() }, [customLoaded, loadCustom])
  const publishedKeys = useMemo(
    () => customVillains.filter((v) => v.published).map((v) => v.id),
    [customVillains],
  )
  // Toutes les clés sélectionnables (natives + publiées en solo).
  const allKeys = useMemo<string[]>(
    () => (network ? [...BUILTIN_KEYS] : [...BUILTIN_KEYS, ...publishedKeys]),
    [network, publishedKeys],
  )

  // Libellé du camp « toi » : nom du joueur (profil), en solo comme en réseau.
  const playerName = usePlayerStore((s) => s.name)
  const mineLabel = playerName.trim() || SIDE_STYLE.mine.label
  // Libellé de l'adversaire : en réseau, son nom vient du lobby (siège opposé) ;
  // en solo c'est le bot, on garde « Adversaire ».
  const oppName = network ? (lobby?.find((s) => s.seat === 1 - localPlayerIndex)?.name ?? '').trim() : ''
  const oppLabel = oppName || SIDE_STYLE.opp.label

  // DEV UNIQUEMENT : mode ORDI vs ORDI (les deux camps en IA) pour observer/analyser.
  // Gardé par `!isDesktopApp` → absent de l'exe ET de la simulation « mode application ».
  const devBuild = !useIsDesktopApp()
  const [aiVsAi, setAiVsAi] = useState(false)

  // SOLO : choix local des deux camps + camp actif (alimenté par les clics grille).
  const [mineSolo, setMineSolo] = useState<Choice | null>(null)
  const [oppSolo, setOppSolo] = useState<Choice | null>(null)
  // Camp actif : `null` = aucun (clic grille sans effet ; choisis un camp via sa carte).
  const [activeSide, setActiveSide] = useState<Side | null>('mine')

  // RÉSEAU : choix dérivés du lobby (synchronisés en direct).
  const seatVillain = (i: number) => (lobby?.find((s) => s.seat === i)?.villainKey ?? null) as Choice | null
  const mine = network ? seatVillain(localPlayerIndex) : mineSolo
  const opp = network ? seatVillain(1 - localPlayerIndex) : oppSolo

  // En réseau, dès que l'hôte lance, on entre dans la partie.
  useEffect(() => {
    if (network && netStatus === 'playing') onStart()
  }, [network, netStatus, onStart])

  // Si l'autre joueur quitte pendant le choix des vilains : retour au menu.
  useEffect(() => {
    if (network && netLeftNotice) { leaveNet(); onBack() }
  }, [network, netLeftNotice, leaveNet, onBack])

  /** Tire un vilain au hasard, en excluant éventuellement une clé. */
  const randomKey = (exclude?: string): string => {
    const pool = allKeys.filter((k) => k !== exclude)
    return pool[Math.floor(Math.random() * pool.length)] ?? allKeys[0]
  }

  // Le vilain réservé par un camp (jamais « random ») : interdit à l'autre.
  const takenBy = (c: Choice | null): string | null => (c && c !== 'random' ? c : null)

  // Joue la réplique d'un vilain choisi (uniquement les natifs : pas de voix custom).
  const playPhrase = (key: string) => { if (!isCustomKey(key)) playVillainPhrase(key as VillainKey) }

  // Affecte un vilain à un camp (avec anti-miroir : on le retire à l'autre s'il l'avait).
  const assignSide = (c: Choice, side: Side) => {
    if (side === 'mine') {
      setMineSolo(c)
      if (c !== 'random' && oppSolo === c) setOppSolo(null)
    } else {
      setOppSolo(c)
      if (c !== 'random' && mineSolo === c) setMineSolo(null)
    }
  }

  // SOLO : 1er clic = TON vilain, 2e clic = le BOT (auto-bascule sur le camp encore
  // vide). Quand les DEUX deviennent choisis, plus aucun camp n'est actif (`null`) :
  // pour changer un vilain, on clique d'abord sa carte « Toi » / « Adversaire ».
  const pickSolo = (c: Choice) => {
    if (!activeSide) return // aucun camp actif : choisis-en un via sa carte d'abord
    if (c !== 'random') playPhrase(c) // phrase du vilain choisi (Scar, Maléfique…)
    // Le camp actif avait-il DÉJÀ un vilain ? Si oui, on est en train de le MODIFIER :
    // on garde ce camp actif (pas de désélection) pour pouvoir le changer en série.
    const editingChosen = !!(activeSide === 'mine' ? mineSolo : oppSolo)
    // Valeur de l'AUTRE camp après ce clic (l'anti-miroir peut le vider s'il avait `c`).
    const otherVal = activeSide === 'mine' ? oppSolo : mineSolo
    const otherStillChosen = !!otherVal && !(c !== 'random' && otherVal === c)
    assignSide(c, activeSide)
    // Modification d'un camp déjà choisi → on reste sur ce camp. Sinon (premier choix
    // de ce camp) : bascule sur l'autre s'il est vide, sinon plus aucun camp actif.
    if (editingChosen) return
    setActiveSide(otherStillChosen ? null : activeSide === 'mine' ? 'opp' : 'mine')
  }

  // RÉSEAU : on ne choisit que SON vilain. « Aléatoire » est résolu sur-le-champ en
  // un vilain disponible (on exclut celui pris par l'adversaire) puis confirmé.
  const pickMineNet = (c: Choice) => {
    const key = c === 'random' ? randomKey(takenBy(opp) ?? undefined) : c
    playPhrase(key) // phrase du vilain choisi (Scar, Maléfique…)
    selectVillain(key as VillainKey)
  }
  const pickTile = network ? pickMineNet : pickSolo

  // Tuiles de la grille : « Aléatoire » d'abord, puis tous les vilains (natifs + publiés en solo).
  const tiles: Choice[] = ['random', ...allKeys]

  const launchSolo = () => {
    if (!mineSolo || !oppSolo) return
    const playerKey = mineSolo === 'random' ? randomKey(takenBy(oppSolo) ?? undefined) : mineSolo
    const botKey = oppSolo === 'random' ? randomKey(playerKey) : oppSolo
    // DEV : ORDI vs ORDI → les deux sièges sont des bots (partie auto-jouée à observer).
    if (devBuild && aiVsAi) startBotMatch([playerKey, botKey])
    else reset([playerKey, botKey])
    onStart()
  }

  // Quitter le choix : en réseau on PRÉVIENT l'autre (LEAVE) pour qu'il revienne
  // aussi à l'accueil (le relais ne notifie pas les départs de lui-même).
  const back = () => { if (network) quitNet(); onBack() }
  const bothChosen = !!takenBy(mine) && !!takenBy(opp)

  // Fond « teinté par les vilains » : réagit aux choix (toi → gauche, adversaire → droite).
  const pageBackground = villainsBackground(
    (takenBy(mine) && VILLAIN_COLOR[takenBy(mine)!]) || DEFAULT_TINT_A,
    (takenBy(opp) && VILLAIN_COLOR[takenBy(opp)!]) || DEFAULT_TINT_B,
  )

  return (
    <div
      className="villain-bg relative flex h-screen flex-col bg-[#0a0814] text-white"
      style={{ backgroundImage: pageBackground }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">
          {network ? 'Choix des vilains (en réseau)' : 'Choix des vilains'}
        </h1>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); playBackClick(); back() }}
          onMouseEnter={playHover}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <PresentationArt choice={mine} side="left" />
        <PresentationArt choice={opp} side="right" />
        <Scroller className="relative z-10 h-full">
          <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 pb-32 pt-6">
            {/* Récap des deux camps : en solo, cliquer un slot le rend actif. */}
            <div className="flex gap-3">
              <SlotCard
                side="mine"
                value={mine}
                active={!network && activeSide === 'mine'}
                clickable={!network}
                hint={network ? undefined : 'Clique la grille pour choisir'}
                label={mineLabel}
                onActivate={() => setActiveSide('mine')}
              />
              <SlotCard
                side="opp"
                value={opp}
                active={!network && activeSide === 'opp'}
                clickable={!network}
                hint={network ? 'en direct' : undefined}
                label={oppLabel}
                onActivate={() => setActiveSide('opp')}
              />
            </div>

            {/* Grille partagée de tous les vilains (façon sélection de perso). En
                réseau, on diffuse mon survol et on affiche le curseur de l'adversaire. */}
            <div
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
              onMouseLeave={() => { if (network) setHoverVillain(null) }}
            >
              {tiles.map((c) => (
                <Tile
                  key={c}
                  choice={c}
                  mineIs={mine === c}
                  oppIs={opp === c}
                  mineLabel={mineLabel}
                  oppLabel={oppLabel}
                  oppHovering={network && peerHover === c}
                  // Réseau : le vilain pris par l'adversaire est verrouillé (pas de miroir).
                  disabled={network ? c !== mine && c === opp : false}
                  onPick={() => pickTile(c)}
                  onHoverEnter={network ? () => setHoverVillain(c === 'random' ? null : (c as VillainKey)) : undefined}
                />
              ))}
            </div>
          </div>
        </Scroller>
      </main>

      <footer className="relative z-0 -mt-28 flex flex-col items-center gap-2 border-t border-white/10 bg-black/30 px-4 pb-8 pt-28 shadow-[0_-6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md">
        {/* SOLO : 1er clic = ton vilain, 2e clic = le bot, puis « Lancer la partie ». */}
        {!network && (
          <>
            <span className={`text-xs text-white/40 ${!mineSolo || !oppSolo ? '' : 'invisible'}`}>
              {!mineSolo ? 'Clic 1 : choisis ton vilain.' : 'Clic 2 : choisis le vilain du bot.'}
            </span>
            {/* DEV : bascule ORDI vs ORDI (absente du build/exe). Bouton vert dont
                l'état actif/inactif (plein vs. estompé) reflète l'activation. */}
            {devBuild && (
              <button
                type="button"
                onClick={() => setAiVsAi((v) => !v)}
                onMouseEnter={playPlayButtonHover}
                aria-pressed={aiVsAi}
                title={aiVsAi ? 'Mode ORDI vs ORDI activé — clic pour désactiver' : 'Activer le mode ORDI vs ORDI (les deux camps en IA)'}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  aiVsAi
                    ? 'border-emerald-300 bg-emerald-500 text-emerald-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:bg-emerald-400'
                    : 'border-emerald-500/40 bg-emerald-900/30 text-emerald-300/60 opacity-70 hover:opacity-100 hover:bg-emerald-800/40'
                }`}
              >
                🤖 Entre Ordis
              </button>
            )}
            <div className="w-72">
              {/* Variante « vert » quand le mode ORDI vs ORDI (dev) est actif — le libellé reste « Lancer la partie ». */}
              {(() => { const v = devBuild && aiVsAi ? 'vert' : 'classique'; return (
              <button type="button" disabled={!mineSolo || !oppSolo} onClick={(e) => { e.stopPropagation(); playHeroSelect(); launchSolo() }} onMouseEnter={playPlayButtonHover} className={`hs-wrapper ${v}`}>
                <span className={`hs-button ${v}`}>
                  <span className={`hs-border ${v}`}>
                    <span className={`hs-text ${v}`}>Lancer la partie</span>
                  </span>
                </span>
              </button>
              ) })()}
            </div>
          </>
        )}

        {/* RÉSEAU — HÔTE : lance la partie quand les deux vilains sont choisis. */}
        {network && mode === 'host' && (
          <>
            <span className={`text-xs text-white/40 ${!bothChosen ? '' : 'invisible'}`}>
              {!takenBy(mine) ? 'Choisis ton vilain.' : 'En attente du choix de l’adversaire…'}
            </span>
            <div className="w-72">
              <button type="button" disabled={!bothChosen} onClick={(e) => { e.stopPropagation(); playHeroSelect(); launchGame() }} onMouseEnter={playPlayButtonHover} className="hs-wrapper classique">
                <span className="hs-button classique">
                  <span className="hs-border classique">
                    <span className="hs-text classique">Lancer la partie</span>
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        {/* RÉSEAU — INVITÉ : attend que l'hôte lance. */}
        {network && mode === 'client' && (
          <span className="text-sm text-white/60">
            {!takenBy(mine) ? 'Choisis ton vilain.' : '⏳ En attente que l’hôte lance la partie…'}
          </span>
        )}
      </footer>

      <OptionsButton />
    </div>
  )
}
