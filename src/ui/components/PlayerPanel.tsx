import type { ReactNode } from 'react'
import type { PlayerState } from '../../engine/types'
import type { Accent } from '../accents'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { objectiveScore } from '../../ai/heuristicBot'
import { VILLAIN_COLOR } from '../villainColors'
import { PAT_GOAL_INFO } from '../../data/villains/patHibulaire'

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
  /** Vrai si ce panneau est celui du joueur LOCAL (révèle ses tuiles Objectif
   *  cachées — Pat Hibulaire). L'adversaire ne voit que les tuiles révélées. */
  own?: boolean
}

/** En-tête d'un camp : nom + jetons de pouvoir (+ objectif si `showObjective`).
 *  L'objectif lui-même est rendu par `ObjectiveBox`, réutilisable hors panneau. */
export function PlayerPanel({ player, accent, isActive, isWinner, showObjective = true, subLabel, avatar, own = false }: Props) {
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

        {/* Mère Gothel — jetons Confiance (objectif : 10). */}
        {player.confiance !== undefined && (
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-rose-400/30 bg-black/20 px-3 py-3"
            title={`Confiance : ${player.confiance}/10`}
          >
            <span className="-mt-1.5 text-[9px] uppercase tracking-wide text-rose-300/70">Confiance</span>
            <span className="text-2xl font-bold text-rose-200">💗 {player.confiance}</span>
            <span className="text-[10px] text-white/50">{player.confiance}/10</span>
          </div>
        )}

        {/* Cruella d'Enfer — réserve de Tuiles Chiots restante (les Chiots CAPTURÉS sont
            affichés dans la pile dédiée, à côté de la pile Succession/Au-delà). */}
        {player.puppyTiles !== undefined && (() => {
          const captured = player.puppyTiles.filter((t) => t.state === 'captured').reduce((n, t) => n + t.value, 0)
          const reserve = player.puppyTiles.filter((t) => t.state === 'reserve').length
          const onBoard = player.puppyTiles.filter((t) => t.state === 'board').reduce((n, t) => n + t.value, 0)
          return (
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-rose-400/30 bg-black/20 px-3 py-3"
              title={`Réserve : ${reserve} tuiles — posés : ${onBoard} Chiots — capturés : ${captured}/99`}
            >
              <span className="-mt-1.5 text-[9px] uppercase tracking-wide text-rose-300/70">Réserve</span>
              <span className="text-2xl font-bold text-rose-200">🐾 {reserve}</span>
              <span className="text-[10px] text-white/50">tuiles · {captured}/99</span>
            </div>
          )
        })()}

        {/* Case objectif (à droite) — masquable quand rendue ailleurs. */}
        {showObjective && <ObjectiveBox player={player} accent={accent} isWinner={isWinner} own={own} />}
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
  own = false,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  /** Joueur local : révèle ses tuiles Objectif cachées (Pat Hibulaire). */
  own?: boolean
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

      {/* Pat Hibulaire — ses 4 tuiles Objectif (face cachée pour l'adversaire tant
          qu'elles ne sont pas révélées). Le joueur local voit toujours les siennes. */}
      {player.goals && player.goals.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {player.goals.map((g, i) => {
            const show = own || g.revealed
            const locName = player.locations.find((l) => l.id === g.locationId)?.name ?? ''
            return (
              <div
                key={i}
                className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[9px] ${
                  g.completed ? 'bg-amber-400/20 text-amber-100' : 'bg-white/5 text-white/70'
                }`}
                title={show ? PAT_GOAL_INFO[g.kind].text : 'Tuile Objectif face cachée'}
              >
                <span className="truncate">
                  {g.completed ? '✓ ' : ''}
                  {show ? PAT_GOAL_INFO[g.kind].name : '🔒 Objectif caché'}
                </span>
                <span className="shrink-0 text-white/40">{locName}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
