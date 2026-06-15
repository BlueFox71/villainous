import { useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { useStatsStore, type VillainStats } from '../store/statsStore'
import { villainPortrait } from '../villainArt'
import { Scroller } from '../components/Scroller'
import { playProfileHover } from '../sfx'

interface Props {
  /** Revenir au menu principal. */
  onBack: () => void
}

const EMPTY: VillainStats = { wins: 0, losses: 0, playtimeMs: 0 }

/** Formate une durée (ms) en « 2h 13min », « 13min » ou « 45s ». */
function formatPlaytime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const totalMin = Math.floor(totalSec / 60)
  const hours = Math.floor(totalMin / 60)
  const min = totalMin % 60
  if (hours > 0) return `${hours}h ${min.toString().padStart(2, '0')}min`
  return `${min}min`
}

/** Pourcentage de victoire (0 si aucune partie). */
function winRate(s: VillainStats): number {
  const games = s.wins + s.losses
  return games === 0 ? 0 : Math.round((s.wins / games) * 100)
}

/** Nom affichable d'un vilain depuis sa clé (repli sur la clé brute). */
function villainName(key: string): string {
  return (VILLAIN_REGISTRY as Record<string, { def: { name: string } }>)[key]?.def.name ?? key
}

/** Date courte (ex. « 11/06 14:32 »). */
function formatDate(at: number): string {
  try {
    return new Date(at).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** Une statistique en colonne : grande valeur + libellé discret. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${tone ?? 'text-white'}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span>
    </div>
  )
}

/**
 * Écran de profil : pour chaque vilain, le temps de jeu cumulé, le nombre de
 * victoires/défaites et le pourcentage de victoire. Données persistées en
 * localStorage (cf. statsStore).
 */
export function Profile({ onBack }: Props) {
  const stats = useStatsStore((s) => s.stats)
  const history = useStatsStore((s) => s.history)
  const resetAll = useStatsStore((s) => s.resetAll)
  const [confirmReset, setConfirmReset] = useState(false)

  const villains = Object.entries(VILLAIN_REGISTRY) as [
    VillainKey,
    (typeof VILLAIN_REGISTRY)[VillainKey],
  ][]

  // Totaux tous vilains confondus.
  const totals = villains.reduce<VillainStats>(
    (acc, [key]) => {
      const s = stats[key] ?? EMPTY
      return {
        wins: acc.wins + s.wins,
        losses: acc.losses + s.losses,
        playtimeMs: acc.playtimeMs + s.playtimeMs,
      }
    },
    { ...EMPTY },
  )
  const totalGames = totals.wins + totals.losses

  return (
    <div className="flex h-screen flex-col bg-[#0b0a12] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="text-lg font-bold text-purple-200">Mon profil</h1>
        <button
          type="button"
          onClick={onBack}
          onMouseEnter={playProfileHover}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </header>

      <Scroller element="main" className="min-h-0 flex-1 p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {/* Bandeau de totaux. */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-amber-200">
              Tous vilains confondus
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Parties" value={`${totalGames}`} />
              <Stat label="Victoires" value={`${totals.wins}`} tone="text-emerald-300" />
              <Stat label="Défaites" value={`${totals.losses}`} tone="text-red-300" />
              <Stat
                label="% victoire"
                value={`${winRate(totals)}%`}
                tone="text-amber-300"
              />
              <Stat label="Temps de jeu" value={formatPlaytime(totals.playtimeMs)} />
            </div>
          </div>

          {/* Une carte par vilain. */}
          {villains.map(([key, v]) => {
            const s = stats[key] ?? EMPTY
            const games = s.wins + s.losses
            return (
              <div
                key={key}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <img
                  src={villainPortrait(key)}
                  alt={v.def.name}
                  className="h-28 w-28 shrink-0 rounded-lg border border-white/15 object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="text-xl font-bold text-amber-200">{v.def.name}</h3>
                  {games === 0 ? (
                    <p className="mt-4 text-sm text-white/40">Aucune partie jouée.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <Stat label="Parties" value={`${games}`} />
                      <Stat label="Victoires" value={`${s.wins}`} tone="text-emerald-300" />
                      <Stat label="Défaites" value={`${s.losses}`} tone="text-red-300" />
                      <Stat label="% victoire" value={`${winRate(s)}%`} tone="text-amber-300" />
                      <Stat label="Temps" value={formatPlaytime(s.playtimeMs)} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Historique des parties. */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-200">
              Historique des parties
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-white/40">Aucune partie terminée pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((g, i) => {
                  const humanWon = g.winner === 'human'
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      <img
                        src={villainPortrait(g.human as VillainKey)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded border border-white/15 object-cover"
                      />
                      <span className={humanWon ? 'font-semibold text-emerald-300' : 'text-white/80'}>
                        {villainName(g.human)}
                      </span>
                      <span className="text-white/30">vs</span>
                      <img
                        src={villainPortrait(g.opponent as VillainKey)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded border border-white/15 object-cover"
                      />
                      <span className={!humanWon ? 'font-semibold text-red-300' : 'text-white/80'}>
                        {villainName(g.opponent)}
                      </span>
                      <span
                        className={`ml-auto shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                          humanWon ? 'bg-emerald-600/30 text-emerald-200' : 'bg-red-600/30 text-red-200'
                        }`}
                      >
                        {humanWon ? '🏆 Victoire' : 'Défaite'}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-white/40">
                        {formatDate(g.at)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Réinitialisation. */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {confirmReset ? (
              <>
                <span className="text-sm text-white/60">Effacer toutes les statistiques ?</span>
                <button
                  type="button"
                  onClick={() => {
                    resetAll()
                    setConfirmReset(false)
                  }}
                  className="rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-400/10"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/60 hover:bg-white/10"
              >
                Réinitialiser les statistiques
              </button>
            )}
          </div>
        </div>
      </Scroller>
    </div>
  )
}
