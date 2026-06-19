import type { ReactNode } from 'react'
import type { PlayerState } from '../../engine/types'
import type { Accent } from '../accents'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { objectiveScore } from '../../ai/heuristicBot'
import { VILLAIN_COLOR } from '../villainColors'

interface Props {
  player: PlayerState
  accent: Accent
  isActive: boolean
  isWinner: boolean
  /** Affiche la case objectif dans le panneau (défaut). La passer à `false`
   *  quand l'objectif est rendu ailleurs (cf. `ObjectiveBox`, bande du bas). */
  showObjective?: boolean
  /** Sous-titre affiché après le nom du vilain (« — pseudo » / « — Ordinateur »). */
  subLabel?: string
  /** Vignette ronde à gauche du titre (avatar du joueur / du vilain). */
  avatar?: ReactNode
}

/** En-tête d'un camp : nom + jetons de pouvoir (+ objectif si `showObjective`).
 *  L'objectif lui-même est rendu par `ObjectiveBox`, réutilisable hors panneau. */
export function PlayerPanel({ player, accent, isActive, isWinner, showObjective = true, subLabel, avatar }: Props) {
  const displayedPower = useAnimatedNumber(player.power)
  // Fond teinté à la couleur du méchant (plus marqué quand c'est son tour).
  const color = VILLAIN_COLOR[player.villain]
  return (
    <div
      className={`player rounded-xl border-2 px-4 py-5 shadow-lg backdrop-blur-sm transition-colors ${isActive ? accent.panelActive : accent.panelIdle}`}
      style={
        color
          ? {
              // Contour à la couleur du méchant (éclaircie pour rester visible).
              borderColor: `color-mix(in srgb, ${color}, white ${isActive ? '55%' : '35%'})`,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className={`truncate text-lg font-semibold ${accent.title}`}>
            {player.villainName}
            {subLabel && <span className="font-normal text-white/55"> — {subLabel}</span>}
          </h2>
          {avatar}
        </div>
        {isWinner && <span className="shrink-0 text-lg">🏆</span>}
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        {/* Case jetons de pouvoir (à gauche). Sans l'objectif, elle s'étire. */}
        <div
          className={`flex flex-col items-center justify-center rounded-lg border border-white/15 bg-black/20 px-5 py-3 ${
            showObjective ? '' : 'flex-1'
          }`}
          title="Jetons de pouvoir"
        >
          <span className="-mt-1.5 text-[9px] uppercase tracking-wide text-white/40">Jetons</span>
          <span className="flex items-center gap-1.5 text-3xl font-bold text-amber-100">
            <img src="/jeton_pouvoir.png" alt="" className="h-9 w-9 rounded-full" />
            {displayedPower}
          </span>
        </div>

        {/* La Méchante Reine — jetons Poison + progression des Ingrédients. */}
        {player.poison !== undefined && (
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-fuchsia-400/30 bg-black/20 px-3 py-3"
            title={`Poison : ${player.poison} · Ingrédients : ${player.ingredients?.length ?? 0}/4`}
          >
            <span className="-mt-1.5 text-[9px] uppercase tracking-wide text-fuchsia-300/70">Poison</span>
            <span className="text-2xl font-bold text-fuchsia-200">🧪 {player.poison}</span>
            <span className="text-[10px] text-white/50">Ingrédients {player.ingredients?.length ?? 0}/4</span>
          </div>
        )}

        {/* Case objectif (à droite) — masquable quand rendue ailleurs. */}
        {showObjective && <ObjectiveBox player={player} accent={accent} isWinner={isWinner} />}
      </div>
    </div>
  )
}

/** Case « objectif » d'un camp : barre de progression vers la victoire (même jauge
 *  que celle qui guide le bot, `objectiveScore`). Extraite de `PlayerPanel` pour
 *  pouvoir être affichée séparément (ex. bande du bas). */
export function ObjectiveBox({
  player,
  accent,
  isWinner,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
}) {
  // Progression globale (0..1) → %, même jauge que celle qui guide le bot.
  const pct = Math.round(Math.max(0, Math.min(1, objectiveScore(player))) * 100)
  return (
    <div className="flex flex-1 flex-col justify-center rounded-lg border border-white/15 bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wide text-white/40">Progression</span>
        <span className={`font-mono text-xs font-bold ${isWinner ? 'text-amber-200' : 'text-white/90'}`}>{pct}%</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isWinner ? 'bg-amber-400' : accent.gauge}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Pat Hibulaire — les 4 tuiles Objectif sont désormais rendues au-dessus des
          cases Héros (cf. `GoalTilesRow`), plus dans ce panneau. */}
    </div>
  )
}
