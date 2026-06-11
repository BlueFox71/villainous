import { useState } from 'react'
import { VILLAIN_REGISTRY, useGameStore, type VillainKey } from '../store/gameStore'
import { villainPortrait } from '../villainArt'
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
  onPick,
}: {
  choice: Choice
  selected: boolean
  onPick: () => void
}) {
  const isRandom = choice === 'random'
  const v = isRandom ? null : VILLAIN_REGISTRY[choice]
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
        selected
          ? 'border-amber-400 bg-amber-400/10 ring-2 ring-amber-400'
          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
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
  onPick,
}: {
  title: string
  value: Choice | null
  onPick: (c: Choice) => void
}) {
  const options: Choice[] = ['random', ...KEYS]
  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-200">{title}</h2>
      <div className="flex flex-col gap-2">
        {options.map((c) => (
          <Option key={c} choice={c} selected={value === c} onPick={() => onPick(c)} />
        ))}
      </div>
    </section>
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

  const launch = () => {
    if (!mine || !opp) return
    const playerKey = mine === 'random' ? randomKey() : mine
    // Adversaire aléatoire : on évite le miroir (vilain différent du joueur).
    const botKey = opp === 'random' ? randomKey(playerKey) : opp
    reset([playerKey, botKey])
    onStart()
  }

  return (
    <div
      className="flex h-screen flex-col text-white"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, #251447 0%, #130c24 45%, #0b0a12 100%)',
      }}
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

      <Scroller element="main" className="min-h-0 flex-1 p-6">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2">
          <SidePanel title="Ton vilain" value={mine} onPick={setMine} />
          <SidePanel title="Adversaire (bot)" value={opp} onPick={setOpp} />
        </div>
      </Scroller>

      <footer className="flex flex-col items-center gap-2 border-t border-white/10 px-4 py-4">
        {(!mine || !opp) && (
          <span className="text-xs text-white/40">
            Choisis un vilain (ou « Aléatoire ») pour chaque camp.
          </span>
        )}
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
