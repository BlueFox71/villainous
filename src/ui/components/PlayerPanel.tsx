import type { PlayerState } from '../../engine/types'
import type { Accent } from '../accents'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'

interface Props {
  player: PlayerState
  accent: Accent
  isActive: boolean
  isWinner: boolean
}

/** En-tête d'un camp : nom + jetons de pouvoir + progression d'objectif (selon
 *  son type). Affiche une jauge pour POWER_THRESHOLD, 4 pastilles de lieux
 *  pour CURSE_EACH_LOCATION. */
export function PlayerPanel({ player, accent, isActive, isWinner }: Props) {
  const displayedPower = useAnimatedNumber(player.power)
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${isActive ? accent.panelActive : accent.panelIdle}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={`truncate text-sm font-semibold ${accent.title}`}>{player.villainName}</h2>
        {isWinner && <span className="shrink-0 text-lg">🏆</span>}
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        {/* Case jetons de pouvoir (à gauche). */}
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-white/15 bg-black/20 px-3 py-1"
          title="Jetons de pouvoir"
        >
          <span className="text-[9px] uppercase tracking-wide text-white/40">Jetons</span>
          <span className="flex items-center gap-1.5 text-lg font-bold text-amber-100">
            <img src="/jeton_pouvoir.png" alt="" className="h-5 w-5 rounded-full" />
            {displayedPower}
          </span>
        </div>

        {/* Case objectif (à droite). */}
        <div className="flex flex-1 flex-col justify-center rounded-lg border border-white/15 bg-black/20 px-3 py-1">
          {player.objective.type === 'POWER_THRESHOLD' ? (
            <PowerThresholdProgress
              player={player}
              accent={accent}
              isWinner={isWinner}
              threshold={player.objective.threshold}
            />
          ) : (
            <CurseEachLocationProgress
              player={player}
              accent={accent}
              isWinner={isWinner}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function PowerThresholdProgress({
  player,
  accent,
  isWinner,
  threshold,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  threshold: number
}) {
  const animated = useAnimatedNumber(player.power)
  const pct = Math.min(100, (animated / threshold) * 100)
  return (
    <>
      <div className="mb-1 flex justify-between text-[10px]">
        <span className={accent.accentText}>Objectif</span>
        <span className="font-mono text-white">
          {animated} / {threshold}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isWinner ? 'bg-amber-400' : accent.gauge}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  )
}

function CurseEachLocationProgress({
  player,
  accent,
  isWinner,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
}) {
  const filled = player.locations.map((loc) =>
    (player.board[loc.id] ?? []).some((c) => c.type === 'curse'),
  )
  const done = filled.filter(Boolean).length
  return (
    <>
      <div className="mb-1 flex justify-between text-[10px]">
        <span className={accent.accentText}>Malédictions</span>
        <span className="font-mono text-white">{done} / {filled.length}</span>
      </div>
      <div className="flex gap-1">
        {filled.map((ok, i) => (
          <div
            key={i}
            title={player.locations[i].name}
            className={`h-2 flex-1 rounded-full ${
              ok ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-black/40'
            }`}
          />
        ))}
      </div>
    </>
  )
}
