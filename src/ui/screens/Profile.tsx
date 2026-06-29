import { useState } from 'react'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { useStatsStore, type VillainStats } from '../store/statsStore'
import { usePlayerStore, GENERIC_AVATAR_COLORS, VILLAIN_AVATAR_COLORS } from '../store/playerStore'
import { villainPortrait } from '../villainArt'
import { VILLAIN_COLOR } from '../villainColors'
import { byRelease } from '../villainOrder'
import { Scroller } from '../components/Scroller'
import { PlayerAvatar, Avatar } from '../components/PlayerAvatar'
import { playProfileHover, playHover } from '../sfx'
import type { GameRecord } from '../store/statsStore'

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

/** Descripteur d'un camp dans l'historique : libellé + avatar (vilain + couleur). */
interface HistorySide {
  label: string
  villain: VillainKey | null
  color: string
}

/** Camp « joueur local » d'un enregistrement : nom + avatar du profil (repli sur le
 *  vilain joué pour les vieux enregistrements sans avatar). */
function humanSide(g: GameRecord): HistorySide {
  return {
    label: g.humanName?.trim() || villainName(g.human),
    villain: (g.humanAvatarVillain !== undefined ? g.humanAvatarVillain : g.human) as VillainKey | null,
    color: g.humanAvatarColor ?? VILLAIN_COLOR[g.human] ?? '#111111',
  }
}

/** Camp adverse : en réseau, nom + avatar du joueur adverse ; en solo (ou vieil
 *  enregistrement), nom + image + couleur du vilain. */
function opponentSide(g: GameRecord): HistorySide {
  const net = g.mode === 'host' || g.mode === 'client'
  if (net) {
    return {
      label: g.opponentName?.trim() || villainName(g.opponent),
      villain: (g.opponentAvatarVillain !== undefined ? g.opponentAvatarVillain : g.opponent) as VillainKey | null,
      color: g.opponentAvatarColor ?? VILLAIN_COLOR[g.opponent] ?? '#111111',
    }
  }
  return {
    label: villainName(g.opponent),
    villain: g.opponent as VillainKey,
    color: VILLAIN_COLOR[g.opponent] ?? '#111111',
  }
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

/** Une statistique en colonne : grande valeur + libellé discret. `compact` réduit
 *  la taille pour tenir dans les cartes de la grille. */
function Stat({
  label,
  value,
  tone,
  compact,
}: {
  label: string
  value: string
  tone?: string
  compact?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold ${compact ? 'text-lg' : 'text-2xl'} ${tone ?? 'text-white'}`}>
        {value}
      </span>
      <span
        className={`uppercase tracking-wide text-white/40 ${compact ? 'text-[9px]' : 'text-[11px]'}`}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * Écran de profil : édition de l'avatar (vilain + couleur) et du nom du joueur,
 * puis pour chaque vilain le temps de jeu cumulé, les victoires/défaites et le
 * pourcentage de victoire. Données persistées en localStorage (cf. statsStore,
 * playerStore).
 */
export function Profile({ onBack }: Props) {
  const stats = useStatsStore((s) => s.stats)
  const history = useStatsStore((s) => s.history)
  const resetAll = useStatsStore((s) => s.resetAll)
  const [confirmReset, setConfirmReset] = useState(false)
  // Bascule entre l'affichage visuel du profil et son édition (avatar + nom).
  const [editing, setEditing] = useState(false)
  // Vilain survolé dans la grille de choix d'avatar (pour afficher sa couleur en bordure).
  const [hoveredVillain, setHoveredVillain] = useState<VillainKey | null>(null)
  // Pastille de couleur survolée (pour illuminer le(s) vilain(s) associé(s)).
  const [hoveredSwatch, setHoveredSwatch] = useState<string | null>(null)

  // Profil joueur (nom + avatar).
  const name = usePlayerStore((s) => s.name)
  const avatarVillain = usePlayerStore((s) => s.avatarVillain)
  const avatarColor = usePlayerStore((s) => s.avatarColor)
  const setName = usePlayerStore((s) => s.setName)
  const setAvatarVillain = usePlayerStore((s) => s.setAvatarVillain)
  const setAvatarColor = usePlayerStore((s) => s.setAvatarColor)

  // Vilains dans l'ordre de SORTIE (comme la galerie), pour l'avatar et les stats.
  const villains = (Object.entries(VILLAIN_REGISTRY) as [
    VillainKey,
    (typeof VILLAIN_REGISTRY)[VillainKey],
  ][]).sort(([a], [b]) => byRelease(a, b))

  // Couleur thématique du vilain survolé (minuscule, pour matcher les pastilles
  // de la palette qui sont normalisées en minuscules).
  const hoveredColor = hoveredVillain
    ? VILLAIN_COLOR[VILLAIN_REGISTRY[hoveredVillain].def.id]?.toLowerCase()
    : undefined

  // Une pastille de couleur de fond : sélectionnée (anneau blanc), associée au vilain
  // survolé (doré, en miroir), sinon doré au survol direct.
  const renderSwatch = (c: string) => {
    const selected = avatarColor === c
    const associated = hoveredVillain != null && hoveredColor === c
    return (
      <button
        key={c}
        type="button"
        onClick={() => setAvatarColor(c)}
        onMouseEnter={() => {
          setHoveredSwatch(c)
          playHover()
        }}
        onMouseLeave={() => setHoveredSwatch((h) => (h === c ? null : h))}
        aria-label={`Couleur ${c}`}
        aria-pressed={selected}
        style={{ backgroundColor: c }}
        className={`h-8 w-8 rounded-full border transition ${
          selected
            ? 'border-white ring-2 ring-white/80'
            : associated
              ? 'border-amber-400 ring-2 ring-amber-400/70'
              : 'border-white/20 hover:border-amber-400'
        }`}
      />
    )
  }

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
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          {/* Profil : affichage visuel par défaut, édition (avatar + nom) à la demande. */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
            {!editing ? (
              /* AFFICHAGE VISUEL : avatar centré, nom dessous, crayon en badge. */
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative">
                  <PlayerAvatar size={144} />
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    onMouseEnter={playProfileHover}
                    title="Modifier mon profil"
                    aria-label="Modifier mon profil"
                    className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-[#1a1726] text-lg text-amber-200 shadow-lg transition hover:bg-[#262134]"
                  >
                    ✎
                  </button>
                </div>
                <span className="max-w-full truncate text-center text-3xl font-black text-amber-100">
                  {name.trim() || 'Toi'}
                </span>
              </div>
            ) : (
              /* ÉDITION : avatar (aperçu) + contrôles nom / vilain / couleur. */
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* Aperçu de l'avatar + nom saisi. */}
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <PlayerAvatar size={128} />
                  <span className="max-w-[10rem] truncate text-center text-lg font-bold text-amber-100">
                    {name.trim() || 'Toi'}
                  </span>
                </div>

                {/* Contrôles : nom, vilain, couleur. */}
                <div className="flex min-w-0 flex-1 flex-col gap-5">
                  {/* Nom du joueur. */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                      Nom du joueur
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 20))}
                      maxLength={20}
                      placeholder="Ton nom de méchant…"
                      className="w-full max-w-xs rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-300/60 focus:outline-none"
                    />
                  </label>

                  {/* Choix du vilain de l'avatar (grille de portraits). */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                      Vilain
                    </span>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                      {villains.map(([key, v]) => {
                        const selected = avatarVillain === key
                        const color = VILLAIN_COLOR[v.def.id]
                        // Illuminé si survolé directement OU si sa couleur correspond
                        // à la pastille survolée (lien réciproque vilain ↔ pastille).
                        const hovered =
                          hoveredVillain === key ||
                          (hoveredSwatch != null && color?.toLowerCase() === hoveredSwatch)
                        return (
                          <button
                            key={key}
                            type="button"
                            title={v.def.name}
                            onClick={() => setAvatarVillain(key)}
                            onMouseEnter={() => {
                              setHoveredVillain(key)
                              playHover()
                            }}
                            onMouseLeave={() =>
                              setHoveredVillain((h) => (h === key ? null : h))
                            }
                            aria-pressed={selected}
                            style={
                              !selected && hovered && color
                                ? {
                                    backgroundColor: color,
                                    borderColor: `color-mix(in srgb, ${color}, white 40%)`,
                                    boxShadow: `0 0 8px 1px color-mix(in srgb, ${color}, white 25%)`,
                                  }
                                : undefined
                            }
                            className={`overflow-hidden rounded-lg border-2 transition ${
                              selected
                                ? 'border-transparent ring-2 ring-amber-400'
                                : hovered
                                  ? ''
                                  : 'border-white/10'
                            }`}
                          >
                            <img
                              src={villainPortrait(key)}
                              alt={v.def.name}
                              className={`aspect-square w-full object-cover transition-transform duration-150 ${
                                !selected && hovered ? 'scale-90' : ''
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Choix de la couleur de fond : deux groupes (génériques + vilains). */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                        Couleur de fond — génériques
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {GENERIC_AVATAR_COLORS.map(renderSwatch)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                        Couleur de fond — méchants
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {VILLAIN_AVATAR_COLORS.map(renderSwatch)}
                      </div>
                    </div>
                  </div>

                  {/* Fin d'édition : retour à l'affichage visuel. */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      onMouseEnter={playProfileHover}
                      className="rounded-lg border border-amber-300/50 px-4 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
                    >
                      ✓ Terminé
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bandeau de totaux. */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-amber-200">
              Tous vilains confondus
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Parties" value={`${totalGames}`} />
              <Stat label="Victoires" value={`${totals.wins}`} tone="text-emerald-300" />
              <Stat label="Défaites" value={`${totals.losses}`} tone="text-red-300" />
              <Stat label="% victoire" value={`${winRate(totals)}%`} tone="text-amber-300" />
              <Stat label="Temps de jeu" value={formatPlaytime(totals.playtimeMs)} />
            </div>
          </div>

          {/* Stats par vilain : une grille de cartes compactes. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {villains.map(([key, v]) => {
              const s = stats[key] ?? EMPTY
              const games = s.wins + s.losses
              return (
                <div
                  key={key}
                  className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={villainPortrait(key)}
                      alt={v.def.name}
                      className="h-16 w-16 shrink-0 rounded-lg border border-white/15 object-cover"
                    />
                    <h3 className="min-w-0 truncate text-lg font-bold text-amber-200">
                      {v.def.name}
                    </h3>
                  </div>
                  {games === 0 ? (
                    <p className="mt-4 text-sm text-white/40">Aucune partie jouée.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-5 gap-1.5">
                      <Stat label="Parties" value={`${games}`} compact />
                      <Stat label="Vict." value={`${s.wins}`} tone="text-emerald-300" compact />
                      <Stat label="Déf." value={`${s.losses}`} tone="text-red-300" compact />
                      <Stat label="%" value={`${winRate(s)}%`} tone="text-amber-300" compact />
                      <Stat label="Temps" value={formatPlaytime(s.playtimeMs)} compact />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

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
                  const me = humanSide(g)
                  const opp = opponentSide(g)
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      <Avatar villain={me.villain} color={me.color} size={36} />
                      <span className={humanWon ? 'font-semibold text-emerald-300' : 'text-white/80'}>
                        {me.label}
                      </span>
                      <span className="text-white/30">vs</span>
                      <Avatar villain={opp.villain} color={opp.color} size={36} />
                      <span className={!humanWon ? 'font-semibold text-red-300' : 'text-white/80'}>
                        {opp.label}
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
