import { useEffect, useState } from 'react'
import { VILLAIN_REGISTRY, useGameStore, type VillainKey } from '../store/gameStore'
import { villainPortrait, villainPresentation, PRESENTATION_TWEAK } from '../villainArt'
import { VILLAIN_COLOR, villainsBackground, DEFAULT_TINT_A, DEFAULT_TINT_B } from '../villainColors'
import { Scroller } from '../components/Scroller'

interface Props {
  /** Le vilain est choisi et la partie démarre (l'écran de jeu prend le relais). */
  onStart: () => void
  /** Revenir au menu principal. */
  onBack: () => void
}

/** Un choix possible : un vilain précis ou « aléatoire ». */
type Choice = VillainKey | 'random'

const KEYS = Object.keys(VILLAIN_REGISTRY) as VillainKey[]

/** Une option sélectionnable (vilain ou « aléatoire »). */
function Option({
  choice,
  selected,
  disabled,
  onPick,
}: {
  choice: Choice
  selected: boolean
  /** Vilain déjà pris par l'autre camp : non sélectionnable (pas de miroir). */
  disabled: boolean
  onPick: () => void
}) {
  const isRandom = choice === 'random'
  const v = isRandom ? null : VILLAIN_REGISTRY[choice]
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      title={disabled ? 'Déjà choisi par l’autre camp' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-white/5 bg-black/40 opacity-40'
          : selected
            ? 'border-amber-400 bg-amber-400/20 ring-2 ring-amber-400'
            : 'border-white/10 bg-black/45 hover:border-white/30 hover:bg-black/60'
      }`}
    >
      {isRandom ? (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-3xl">
          🎲
        </span>
      ) : (
        <img
          src={villainPortrait(choice)}
          alt={v!.def.name}
          className="h-16 w-16 shrink-0 rounded-lg border border-white/15 object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-base font-bold text-amber-200">
          {isRandom ? 'Aléatoire' : v!.def.name}
        </span>
        <span className="truncate text-xs text-white/50">
          {isRandom ? 'Un vilain au hasard' : v!.def.objectiveDescription}
        </span>
      </div>
    </button>
  )
}

/** Colonne de choix pour un camp (toi / adversaire). */
function SidePanel({
  title,
  value,
  taken,
  onPick,
  allowRandom = true,
  readOnly = false,
}: {
  title: string
  value: Choice | null
  /** Vilain réservé par l'autre camp (jamais « random ») : grisé ici. */
  taken: VillainKey | null
  onPick: (c: Choice) => void
  /** Proposer l'option « Aléatoire » (solo) ; masquée en réseau. */
  allowRandom?: boolean
  /** Lecture seule (réseau : le choix de l'adversaire, non modifiable). */
  readOnly?: boolean
}) {
  const options: Choice[] = allowRandom ? ['random', ...KEYS] : KEYS
  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-200">{title}</h2>
      <div className="flex flex-col gap-2">
        {options.map((c) => (
          <Option
            key={c}
            choice={c}
            selected={value === c}
            disabled={readOnly ? value !== c : c === taken}
            onPick={() => { if (!readOnly) onPick(c) }}
          />
        ))}
      </div>
    </section>
  )
}

/** Position/visibilité commune des illustrations latérales (bord + arrière-plan). */
const SIDE_ART_BASE = 'pointer-events-none absolute inset-y-0 z-0 hidden h-full w-auto lg:block'

/** Illustration « mystère » pour le choix « Aléatoire » : un vilain tiré au hasard
 *  rendu en silhouette noire légèrement floutée, avec un « ? » au centre. Le tirage
 *  est figé tant que le composant reste monté. */
function RandomArt({ side }: { side: 'left' | 'right' }) {
  const [key] = useState<VillainKey | null>(() => {
    const withArt = KEYS.filter((k) => villainPresentation(k))
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
          className={`h-full w-auto max-w-[40vw] object-contain brightness-0 blur-[3px] ${
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
  const tweak = choice ? PRESENTATION_TWEAK[choice] : undefined
  const mirror = side === 'right' ? -1 : 1
  const transform = tweak
    ? `translate(${tweak.dxPct ?? 0}%, ${tweak.dyPct ?? 0}%) scale(${tweak.scale ?? 1}) scaleX(${mirror})`
    : undefined
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      style={transform ? { transform, transformOrigin: 'bottom' } : undefined}
      className={`${SIDE_ART_BASE} max-w-[40vw] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] ${
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
  const mode = useGameStore((s) => s.mode)
  const lobby = useGameStore((s) => s.lobby)
  const localPlayerIndex = useGameStore((s) => s.localPlayerIndex)
  const selectVillain = useGameStore((s) => s.selectVillain)
  const launchGame = useGameStore((s) => s.launchGame)
  const leaveNet = useGameStore((s) => s.leaveNet)
  const netStatus = useGameStore((s) => s.netStatus)
  const netLeftNotice = useGameStore((s) => s.netLeftNotice)
  const network = mode !== 'solo'

  // SOLO : choix local des deux camps.
  const [mineSolo, setMineSolo] = useState<Choice | null>(null)
  const [oppSolo, setOppSolo] = useState<Choice | null>(null)

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
  const randomKey = (exclude?: VillainKey): VillainKey => {
    const pool = KEYS.filter((k) => k !== exclude)
    return pool[Math.floor(Math.random() * pool.length)] ?? KEYS[0]
  }

  // Le vilain réservé par un camp (jamais « random ») : interdit à l'autre.
  const takenBy = (c: Choice | null): VillainKey | null => (c && c !== 'random' ? c : null)

  // SOLO : sélections croisées (les deux camps ne peuvent pas jouer le même vilain).
  const pickMineSolo = (c: Choice) => { setMineSolo(c); if (c !== 'random' && oppSolo === c) setOppSolo(null) }
  const pickOppSolo = (c: Choice) => { setOppSolo(c); if (c !== 'random' && mineSolo === c) setMineSolo(null) }
  // RÉSEAU : on ne choisit que SON vilain (pas d'aléatoire).
  const pickMineNet = (c: Choice) => { if (c !== 'random') selectVillain(c) }

  const launchSolo = () => {
    if (!mineSolo || !oppSolo) return
    const playerKey = mineSolo === 'random' ? randomKey(takenBy(oppSolo) ?? undefined) : mineSolo
    const botKey = oppSolo === 'random' ? randomKey(playerKey) : oppSolo
    reset([playerKey, botKey])
    onStart()
  }

  const back = () => { if (network) leaveNet(); onBack() }
  const bothChosen = !!takenBy(mine) && !!takenBy(opp)

  // Fond « teinté par les vilains » : réagit aux choix (toi → gauche, adversaire → droite).
  const pageBackground = villainsBackground(
    (takenBy(mine) && VILLAIN_COLOR[takenBy(mine)!]) || DEFAULT_TINT_A,
    (takenBy(opp) && VILLAIN_COLOR[takenBy(opp)!]) || DEFAULT_TINT_B,
  )

  return (
    <div
      className="villain-bg flex h-screen flex-col bg-[#0a0814] text-white"
      style={{ backgroundImage: pageBackground }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">
          {network ? 'Choix des vilains (en réseau)' : 'Choix des vilains'}
        </h1>
        <button
          type="button"
          onClick={back}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <PresentationArt choice={mine} side="left" />
        <PresentationArt choice={opp} side="right" />
        <Scroller className="relative z-10 h-full">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 pb-32 pt-6 sm:grid-cols-2">
            <SidePanel
              title="Ton vilain"
              value={mine}
              taken={takenBy(opp)}
              allowRandom={!network}
              onPick={network ? pickMineNet : pickMineSolo}
            />
            <SidePanel
              title={network ? 'Adversaire (en direct)' : 'Adversaire'}
              value={opp}
              taken={takenBy(mine)}
              allowRandom={!network}
              readOnly={network}
              onPick={network ? () => {} : pickOppSolo}
            />
          </div>
        </Scroller>
      </main>

      <footer className="relative z-0 -mt-28 flex flex-col items-center gap-2 border-t border-white/10 bg-black/30 px-4 pb-8 pt-28 shadow-[0_-6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md">
        {/* SOLO : choix des deux camps, puis « Lancer la partie ». */}
        {!network && (
          <>
            <span className={`text-xs text-white/40 ${!mineSolo || !oppSolo ? '' : 'invisible'}`}>
              Choisis un vilain (ou « Aléatoire ») pour chaque camp.
            </span>
            <div className="w-72">
              <button type="button" disabled={!mineSolo || !oppSolo} onClick={launchSolo} className="hs-wrapper classique">
                <span className="hs-button classique">
                  <span className="hs-border classique">
                    <span className="hs-text classique">Lancer la partie</span>
                  </span>
                </span>
              </button>
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
              <button type="button" disabled={!bothChosen} onClick={launchGame} className="hs-wrapper classique">
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
    </div>
  )
}
