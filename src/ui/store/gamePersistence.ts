// =============================================================================
// SAUVEGARDE / REPRISE de la partie en cours (solo).
//
// Le GameState est SÉRIALISABLE par contrat du moteur (que des données, aucune
// méthode, aucune image) : on peut donc l'écrire tel quel et le relire au démarrage
// pour reprendre EXACTEMENT la partie après un rechargement de page.
//
// Stockage = `sessionStorage` (et non localStorage) : il SURVIT au rechargement
// (même onglet) mais se VIDE à la fermeture de l'onglet — exactement la sémantique
// voulue (« je recharge → je reprends ; je ferme l'onglet → partie oubliée »). On
// l'efface aussi explicitement au retour au menu (cf. `clearSavedGame`).
//
// Les fonctions prennent un `Storage` INJECTABLE (défaut : sessionStorage si dispo)
// pour rester testables en environnement `node` (sans API navigateur).
// =============================================================================

import type { GameState, VillainDef } from '../../engine/types'
import type { GameMode, SeatController } from './gameStore'

/** Version du format de sauvegarde. À INCRÉMENTER dès que la forme du GameState (ou
 *  du contexte ci-dessous) change de façon incompatible : une sauvegarde d'une version
 *  antérieure est alors JETÉE (partie neuve) au lieu de faire crasher la reprise. */
export const SAVE_VERSION = 1

/** Clé de stockage de la partie sauvegardée. */
export const SAVE_KEY = 'villainous:savedGame'

/** Instantané complet nécessaire pour reprendre la partie : l'état moteur + le contexte
 *  UI minimal (mode, sièges, point de vue, mode test et son instantané d'avant). */
export interface SavedGame {
  v: number
  mode: GameMode
  seats: [SeatController, SeatController]
  localPlayerIndex: number
  testMode: boolean
  preTestState: GameState | null
  state: GameState
}

/** Sous-ensemble sérialisable d'un store de jeu (ce qu'on lit pour construire l'instantané). */
export interface SaveableSlice {
  mode: GameMode
  seats: [SeatController, SeatController]
  localPlayerIndex: number
  testMode: boolean
  preTestState: GameState | null
  state: GameState
}

/** API minimale d'un stockage clé/valeur (sous-ensemble de Storage). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Stockage par défaut : sessionStorage s'il existe (navigateur), sinon null (node/SSR). */
function defaultStorage(): StorageLike | null {
  return typeof sessionStorage !== 'undefined' ? sessionStorage : null
}

/** Construit l'instantané à sauvegarder — UNIQUEMENT en solo. En réseau (`host`/`client`)
 *  on ne persiste pas : l'hôte est autoritaire et le pair est parti après un reload, une
 *  reprise depuis le stockage local désynchroniserait la partie. Renvoie null si non-solo. */
export function snapshotForSave(s: SaveableSlice): SaveableSlice | null {
  if (s.mode !== 'solo') return null
  return {
    mode: s.mode,
    seats: s.seats,
    localPlayerIndex: s.localPlayerIndex,
    testMode: s.testMode,
    preTestState: s.preTestState,
    state: s.state,
  }
}

/** Remplace récursivement toute chaîne « dataURL » (`data:…`, images base64 lourdes)
 *  par une chaîne vide, en renvoyant une COPIE (n'altère pas l'entrée). Les URLs de
 *  fichier natives (`/boards/x.png`) sont conservées (légères). Générique : indépendant
 *  de la forme du GameState → un futur champ image est allégé automatiquement. */
export function stripDataUrls<T>(value: T): T {
  if (typeof value === 'string') return (value.startsWith('data:') ? '' : value) as T
  if (Array.isArray(value)) return value.map((v) => stripDataUrls(v)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripDataUrls(v)
    return out as T
  }
  return value
}

/** Ré-injecte les images (retirées à la sauvegarde par `stripDataUrls`) dans un état repris,
 *  depuis le def de chaque vilain (registre runtime, résolu via `defOf`). Les images de plateau
 *  respectent la bascule d'objectif (`objectiveVersion`) — le moteur échange boardImage↔altBoardImage.
 *  Vilain introuvable (supprimé depuis) → joueur laissé tel quel (placeholders, pas de crash). */
export function reinjectVillainImages(
  state: GameState,
  defOf: (villainId: string) => VillainDef | undefined,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      const def = defOf(p.villain)
      if (!def) return p
      const faceB = p.objectiveVersion === 'b'
      const altBoard = def.altObjective?.boardImage
      const byId = new Map(def.locations.map((l) => [l.id, l]))
      return {
        ...p,
        boardImage: faceB ? (altBoard ?? def.boardImage) : def.boardImage,
        altBoardImage: faceB ? def.boardImage : altBoard,
        pawnImage: def.pawnImage,
        backVillainImage: def.backVillainImage,
        backFateImage: def.backFateImage,
        backExtraImage: def.backExtraImage,
        locations: p.locations.map((l) => {
          const dl = byId.get(l.id)
          return dl?.bColumnImage !== undefined ? { ...l, bColumnImage: dl.bColumnImage } : l
        }),
      }
    }),
  }
}

/** Écrit la partie (best-effort : silencieux si pas de stockage ou quota plein). Les images
 *  base64 sont RETIRÉES de l'état avant écriture (statiques, re-dérivables du registre à la
 *  reprise) : sauvegarde légère (~centaines de Ko) et sûre côté quota. */
export function saveGame(snap: SaveableSlice, store: StorageLike | null = defaultStorage()): void {
  if (!store) return
  try {
    const light: SavedGame = {
      v: SAVE_VERSION,
      ...snap,
      state: stripDataUrls(snap.state),
      preTestState: snap.preTestState ? stripDataUrls(snap.preTestState) : null,
    }
    store.setItem(SAVE_KEY, JSON.stringify(light))
  } catch {
    /* pas de stockage / quota dépassé → on abandonne silencieusement */
  }
}

/** Relit la partie sauvegardée. Renvoie undefined si absente, corrompue, d'une version
 *  obsolète, ou sans état de partie valide (dans tous ces cas → partie neuve). */
export function loadSavedGame(store: StorageLike | null = defaultStorage()): SavedGame | undefined {
  if (!store) return undefined
  try {
    const raw = store.getItem(SAVE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<SavedGame>
    // Schéma obsolète : on jette (évite un crash de reprise après mise à jour de l'app).
    if (parsed?.v !== SAVE_VERSION) return undefined
    // Garde-fou de forme minimal : un GameState a toujours un tableau `players`.
    if (!parsed.state || !Array.isArray((parsed.state as GameState).players)) return undefined
    return parsed as SavedGame
  } catch {
    return undefined
  }
}

/** Efface la partie sauvegardée (retour au menu, best-effort). */
export function clearSavedGame(store: StorageLike | null = defaultStorage()): void {
  if (!store) return
  try {
    store.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}
