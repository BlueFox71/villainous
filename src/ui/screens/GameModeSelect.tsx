import { useGameStore } from '../store/gameStore'
import { OptionsButton } from '../components/OptionsButton'
import { playBackClick, playHover, playBoxHubPress } from '../sfx'

interface Props {
  /** Aller au choix des vilains (partie solo). */
  onChooseVillains: () => void
  /** Aller à l'écran de connexion réseau (héberger ou rejoindre). */
  onNetwork: () => void
  /** Revenir au menu principal. */
  onBack: () => void
}

/** Bouton (style « HearthStone »). */
function ModeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); playBoxHubPress(); onClick() }}
      onMouseEnter={playHover}
      className="hs-wrapper classique"
    >
      <span className="hs-button classique">
        <span className="hs-border classique">
          <span className="hs-text classique">{label}</span>
        </span>
      </span>
    </button>
  )
}

/**
 * Choix du mode de partie : en haut une partie SOLO (contre le bot) ; en bas,
 * deux options RÉSEAU (héberger / rejoindre) pour jouer à deux sur le même
 * réseau local.
 */
export function GameModeSelect({ onChooseVillains, onNetwork, onBack }: Props) {
  const startHost = useGameStore((s) => s.startHost)
  const leaveNet = useGameStore((s) => s.leaveNet)

  const solo = () => { leaveNet(); onChooseVillains() }
  const host = () => { startHost(); onNetwork() }
  const join = () => { leaveNet(); onNetwork() }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden text-white">
      {/* Arrière-plan (photo + voile + orbes) fourni par <MenuBackground/> à la racine. */}
      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">Nouvelle partie</h1>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); playBackClick(); onBack() }}
          onMouseEnter={playHover}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
        {/* Bloc SOLO */}
        <section className="flex w-[28rem] max-w-[90vw] flex-col gap-3">
          <h2 className="text-center text-xs uppercase tracking-[0.3em] text-white/40">Contre l’ordinateur</h2>
          <ModeButton label="Partie en solo" onClick={solo} />
        </section>

        <div className="h-px w-[24rem] max-w-[80vw] bg-white/10" />

        {/* Bloc RÉSEAU */}
        <section className="flex w-[28rem] max-w-[90vw] flex-col gap-3">
          <h2 className="text-center text-xs uppercase tracking-[0.3em] text-white/40">À deux, sur le même réseau</h2>
          <ModeButton label="Héberger une partie" onClick={host} />
          <ModeButton label="Rejoindre une partie" onClick={join} />
        </section>
      </main>

      <OptionsButton />
    </div>
  )
}
