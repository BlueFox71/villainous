import { useState } from 'react'
import { VILLAIN_REGISTRY, useGameStore, type VillainKey } from '../store/gameStore'
import { villainPortrait, villainPresentation } from '../villainArt'
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
}: {
  title: string
  value: Choice | null
  /** Vilain réservé par l'autre camp (jamais « random ») : grisé ici. */
  taken: VillainKey | null
  onPick: (c: Choice) => void
}) {
  const options: Choice[] = ['random', ...KEYS]
  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-200">{title}</h2>
      <div className="flex flex-col gap-2">
        {options.map((c) => (
          <Option
            key={c}
            choice={c}
            selected={value === c}
            disabled={c === taken}
            onPick={() => onPick(c)}
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
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`${SIDE_ART_BASE} max-w-[40vw] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] ${
        side === 'left' ? 'left-0 object-left' : 'right-0 object-right -scale-x-100'
      }`}
    />
  )
}

/**
 * Choix des vilains avant de lancer la partie : le joueur choisit SON vilain et
 * celui de l'ADVERSAIRE (bot). Chaque camp peut aussi être laissé « aléatoire ».
 * « Lancer la partie » résout les choix puis réinitialise le moteur avec ce duo.
 */
export function VillainSelect({ onStart, onBack }: Props) {
  const reset = useGameStore((s) => s.reset)
  const [mine, setMine] = useState<Choice | null>(null)
  const [opp, setOpp] = useState<Choice | null>(null)

  /** Tire un vilain au hasard, en excluant éventuellement une clé. */
  const randomKey = (exclude?: VillainKey): VillainKey => {
    const pool = KEYS.filter((k) => k !== exclude)
    return pool[Math.floor(Math.random() * pool.length)] ?? KEYS[0]
  }

  // Le vilain réservé par un camp (jamais « random ») : interdit à l'autre.
  const takenBy = (c: Choice | null): VillainKey | null =>
    c && c !== 'random' ? c : null

  // Choisir un vilain pour un camp annule la sélection adverse si elle entre en
  // conflit (les deux camps ne peuvent pas jouer le même vilain).
  const pickMine = (c: Choice) => {
    setMine(c)
    if (c !== 'random' && opp === c) setOpp(null)
  }
  const pickOpp = (c: Choice) => {
    setOpp(c)
    if (c !== 'random' && mine === c) setMine(null)
  }

  const launch = () => {
    if (!mine || !opp) return
    // Joueur aléatoire : on exclut le choix explicite de l'adversaire (pas de miroir).
    const playerKey = mine === 'random' ? randomKey(takenBy(opp) ?? undefined) : mine
    // Adversaire aléatoire : on évite le miroir (vilain différent du joueur).
    const botKey = opp === 'random' ? randomKey(playerKey) : opp
    reset([playerKey, botKey])
    onStart()
  }

  // Même fond « teinté par les vilains » que la partie en cours : il réagit aux
  // vilains choisis (joueur → coin gauche, adversaire → coin droit ; teinte
  // neutre tant qu'un camp est vide ou « aléatoire »).
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
        <h1 className="text-lg font-bold text-purple-200">Choix des vilains</h1>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      {/* Illustrations ancrées sur les bords EN ARRIÈRE-PLAN ; les listes (z-10)
          repassent en pleine largeur centrée par-dessus, sans être rétrécies. */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <PresentationArt choice={mine} side="left" />
        <PresentationArt choice={opp} side="right" />
        <Scroller className="relative z-10 h-full">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 pb-32 pt-6 sm:grid-cols-2">
            <SidePanel title="Ton vilain" value={mine} taken={takenBy(opp)} onPick={pickMine} />
            <SidePanel title="Adversaire" value={opp} taken={takenBy(mine)} onPick={pickOpp} />
          </div>
        </Scroller>
      </main>

      {/* Footer repris de la barre du bas de la partie (verre dépoli), remonté
          par-dessus le bas de `main`. z-0 : au-dessus des images (bas des
          illustrations estompé derrière le flou) mais SOUS les listes (z-10). */}
      <footer className="relative z-0 -mt-28 flex flex-col items-center gap-2 border-t border-white/10 bg-black/30 px-4 pb-8 pt-28 shadow-[0_-6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md">
        {/* Toujours rendu (invisible quand les 2 camps sont choisis) pour réserver
            sa hauteur : évite un décalage vertical du layout à la 2ᵉ sélection. */}
        <span className={`text-xs text-white/40 ${!mine || !opp ? '' : 'invisible'}`}>
          Choisis un vilain (ou « Aléatoire ») pour chaque camp.
        </span>
        <div className="w-72">
          <button type="button" disabled={!mine || !opp} onClick={launch} className="hs-wrapper classique">
            <span className="hs-button classique">
              <span className="hs-border classique">
                <span className="hs-text classique">Lancer la partie</span>
              </span>
            </span>
          </button>
        </div>
      </footer>
    </div>
  )
}
