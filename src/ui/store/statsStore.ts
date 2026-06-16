import { create } from 'zustand'

const LS_KEY = 'villainous:stats'
const HISTORY_KEY = 'villainous:history'
const HISTORY_MAX = 100

/** Une partie terminée : quel vilain (joueur) contre quel vilain (adversaire) et
 *  qui a gagné. `at` = horodatage (ms). Champs optionnels (profil/réseau) ajoutés
 *  ensuite : absents sur les vieux enregistrements → repli sur le vilain. */
export interface GameRecord {
  /** Clé du vilain du joueur (local). */
  human: string
  /** Clé du vilain de l'adversaire. */
  opponent: string
  /** Vainqueur : le joueur local ou l'adversaire. */
  winner: 'human' | 'opponent'
  at: number
  /** Mode de la partie : 'solo' (vs bot) ou réseau ('host'/'client'). */
  mode?: 'solo' | 'host' | 'client'
  /** Nom + avatar (profil) du joueur local. */
  humanName?: string
  humanAvatarVillain?: string | null
  humanAvatarColor?: string
  /** Nom + avatar de l'adversaire (réseau uniquement ; en solo c'est le bot). */
  opponentName?: string
  opponentAvatarVillain?: string | null
  opponentAvatarColor?: string
}

function readHistory(): GameRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (r): r is GameRecord =>
        !!r &&
        typeof r.human === 'string' &&
        typeof r.opponent === 'string' &&
        (r.winner === 'human' || r.winner === 'opponent') &&
        typeof r.at === 'number',
    )
  } catch {
    return []
  }
}

function persistHistory(h: GameRecord[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
  } catch {
    /* ignore */
  }
}

/** Statistiques cumulées pour un vilain (côté joueur humain). */
export interface VillainStats {
  /** Parties gagnées avec ce vilain. */
  wins: number
  /** Parties perdues avec ce vilain. */
  losses: number
  /** Temps de jeu cumulé avec ce vilain, en millisecondes. */
  playtimeMs: number
}

/** Statistiques indexées par clé de vilain (cf. VILLAIN_REGISTRY). */
type StatsMap = Record<string, VillainStats>

function emptyStats(): VillainStats {
  return { wins: 0, losses: 0, playtimeMs: 0 }
}

/** Lit/valide les stats persistées. Renvoie une map vide si absent/corrompu. */
function read(): StatsMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: StatsMap = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object') {
        const v = val as Partial<VillainStats>
        out[key] = {
          wins: typeof v.wins === 'number' && v.wins >= 0 ? v.wins : 0,
          losses: typeof v.losses === 'number' && v.losses >= 0 ? v.losses : 0,
          playtimeMs:
            typeof v.playtimeMs === 'number' && v.playtimeMs >= 0 ? v.playtimeMs : 0,
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

function persist(s: StatsMap) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

interface StatsStore {
  stats: StatsMap
  /** Historique des parties (plus récentes en premier). */
  history: GameRecord[]
  /** Enregistre une fin de partie (victoire/défaite) pour un vilain. */
  recordResult: (villain: string, won: boolean) => void
  /** Ajoute une partie à l'historique (vilain joueur, adversaire, vainqueur). */
  recordGame: (rec: GameRecord) => void
  /** Ajoute du temps de jeu (ms) au compteur d'un vilain. */
  addPlaytime: (villain: string, ms: number) => void
  /** Remet toutes les statistiques (et l'historique) à zéro. */
  resetAll: () => void
}

/** Statistiques de jeu persistantes par vilain (victoires, défaites, temps). */
export const useStatsStore = create<StatsStore>((set) => ({
  stats: read(),
  history: readHistory(),
  recordGame: (rec) =>
    set((s) => {
      const history = [rec, ...s.history].slice(0, HISTORY_MAX)
      persistHistory(history)
      return { history }
    }),
  recordResult: (villain, won) =>
    set((s) => {
      const cur = s.stats[villain] ?? emptyStats()
      const next: StatsMap = {
        ...s.stats,
        [villain]: {
          ...cur,
          wins: cur.wins + (won ? 1 : 0),
          losses: cur.losses + (won ? 0 : 1),
        },
      }
      persist(next)
      return { stats: next }
    }),
  addPlaytime: (villain, ms) =>
    set((s) => {
      if (ms <= 0) return s
      const cur = s.stats[villain] ?? emptyStats()
      const next: StatsMap = {
        ...s.stats,
        [villain]: { ...cur, playtimeMs: cur.playtimeMs + ms },
      }
      persist(next)
      return { stats: next }
    }),
  resetAll: () =>
    set(() => {
      persist({})
      persistHistory([])
      return { stats: {}, history: [] }
    }),
}))
