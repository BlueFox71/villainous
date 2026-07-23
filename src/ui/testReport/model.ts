// =============================================================================
// Rapport des tests — modèle de données + persistance PARTAGÉS (sans composant).
//
// Réutilisé par la page « Rapport des tests » (screens/TestReport.tsx) ET par la
// modale de fin de partie (components/GameTestReportModal.tsx). Outil de dév :
// persistance dans `assets/test-report.json` via les endpoints `/__test-report` (GET)
// et `/__save-test-report` (POST) — cf. vite.config.ts.
//
// Fichier SANS composant (types/consts/fns/hook) → séparé des composants pour ne pas
// gêner le Fast Refresh (cf. règle react-refresh/only-export-components).
// =============================================================================

import { useEffect, useSyncExternalStore } from 'react'

/** Niveaux d'appréciation (radio), du moins bon au meilleur, avec leur couleur.
 *  La CLÉ est stockée dans le JSON : ne pas la renommer (seul le libellé est libre). */
export const RATINGS = [
  { key: 'non-teste', label: 'Non testé', color: '#6b7280' },
  { key: 'a-ameliorer', label: 'À améliorer', color: '#ef4444' },
  { key: 'presque-bien', label: 'Suffisant', color: '#f59e0b' },
  { key: 'satisfaisant', label: 'Satisfaisant', color: '#84cc16' },
  { key: 'complet', label: 'Complet', color: '#22c55e' },
] as const
export type RatingKey = (typeof RATINGS)[number]['key']

/** Les deux testeurs. */
export type Tester = 'jules' | 'alexis'
export const TESTER_LABEL: Record<Tester, string> = { jules: 'Testeur Jules', alexis: 'Testeur Alexis' }

/** Les deux côtés testés d'un même vilain. */
export const SIDES = ['joueur', 'bot'] as const
export type Side = (typeof SIDES)[number]
export const SIDE_LABEL: Record<Side, string> = { joueur: 'Joueur', bot: 'Bot' }

/** Une appréciation (un côté d'un testeur pour un vilain). */
export interface SideEntry {
  rating: RatingKey
  games: number
  comment: string
  /** Le journal de partie de ce côté a été relu / vérifié. */
  journalChecked: boolean
}
// Une entrée testeur = ses deux côtés (joueur/bot).
export type TesterEntry = Record<Side, SideEntry>
// Une entrée vilain = les deux testeurs + la liste des cartes VALIDÉES (ids cochés dans le
// panneau « Rapport de tests — Cartes »). La validation est COMMUNE (pas par testeur).
export type VillainEntry = Record<Tester, TesterEntry> & { validatedCards: string[] }
export interface Report {
  version: number
  villains: Record<string, VillainEntry>
}

/** Un vilain affichable, avec sa couleur de méchant (fond). */
export interface Row {
  id: string
  name: string
  portrait: string
  color: string
}

export const emptySide = (): SideEntry => ({ rating: 'non-teste', games: 0, comment: '', journalChecked: false })

/** Lit l'entrée d'un vilain, en la complétant avec les valeurs par défaut manquantes. */
export function entryOf(report: Report, id: string): VillainEntry {
  const v = report.villains[id]
  const tester = (t?: TesterEntry): TesterEntry => ({
    joueur: { ...emptySide(), ...t?.joueur },
    bot: { ...emptySide(), ...t?.bot },
  })
  return { jules: tester(v?.jules), alexis: tester(v?.alexis), validatedCards: v?.validatedCards ?? [] }
}

/** Niveaux proposés pour un côté donné : le côté Joueur n'expose pas « À améliorer ». */
export const ratingsForSide = (side: Side) =>
  side === 'joueur' ? RATINGS.filter((r) => r.key !== 'a-ameliorer') : RATINGS

/** Rang d'un niveau (0 = pire … 4 = meilleur), d'après l'ordre de `RATINGS`. */
export const ratingRank = (key: RatingKey): number => RATINGS.findIndex((r) => r.key === key)

/** Niveaux affichés dans les STATS d'un côté : le côté Joueur masque « Non testé » et « À améliorer ». */
export const statRatingsForSide = (side: Side) =>
  side === 'joueur' ? RATINGS.filter((r) => r.key !== 'non-teste' && r.key !== 'a-ameliorer') : RATINGS

/** Le testeur « autre » que celui donné. */
export const otherTesterOf = (t: Tester): Tester => (t === 'jules' ? 'alexis' : 'jules')

// Testeur sélectionné : persisté (partagé entre la page et la modale de fin de partie).
const TESTER_LS_KEY = 'test-report:tester'
export function loadSelectedTester(): Tester {
  const saved = localStorage.getItem(TESTER_LS_KEY)
  return saved === 'jules' || saved === 'alexis' ? saved : 'jules'
}
export function saveSelectedTester(t: Tester): void {
  localStorage.setItem(TESTER_LS_KEY, t)
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: '💾 Enregistrement…',
  saved: '✓ Enregistré',
  error: '⚠️ Échec (serveur de dév requis)',
}

/**
 * Charge le rapport une fois, expose `patch(villainId, tester, side, patch)` (sauvegarde
 * différée / débouncée) et l'état de sauvegarde. `report` est `null` tant que le chargement
 * initial n'est pas terminé.
 */
// STORE PARTAGÉ (module) : la page « Rapport des tests » ET la modale « Cartes » lisent/
// écrivent le MÊME rapport. Sans ça, chaque `useTestReport()` aurait son propre état et
// une modification dans l'une ne se refléterait pas dans l'autre (ex. jauge de cartes).
let report: Report | null = null
let saveState: SaveState = 'idle'
let loadStarted = false
let version = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
const subscribers = new Set<() => void>()
const emit = () => { version++; for (const fn of [...subscribers]) fn() }

/** Charge le rapport une seule fois (au 1er montage d'un consommateur). */
function ensureLoaded() {
  if (loadStarted) return
  loadStarted = true
  void fetch('/__test-report')
    .then((r) => (r.ok ? r.json() : { version: 1, villains: {} }))
    .then((data: Report) => { report = { version: data.version ?? 1, villains: data.villains ?? {} }; emit() })
    .catch(() => { report = { version: 1, villains: {} }; emit() })
}

/** Sauvegarde différée (débounce) du rapport courant sur le disque. */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveState = 'saving'
  emit()
  saveTimer = setTimeout(() => {
    void fetch('/__save-test-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    })
      .then((r) => { saveState = r.ok ? 'saved' : 'error'; emit() })
      .catch(() => { saveState = 'error'; emit() })
  }, 500)
}

/** Patch d'un côté (testeur + joueur/bot) d'un vilain, puis sauvegarde. */
function patch(villainId: string, tester: Tester, side: Side, sidePatch: Partial<SideEntry>) {
  if (!report) return
  const cur = entryOf(report, villainId)
  report = {
    ...report,
    villains: {
      ...report.villains,
      [villainId]: { ...cur, [tester]: { ...cur[tester], [side]: { ...cur[tester][side], ...sidePatch } } },
    },
  }
  scheduleSave()
  emit()
}

/** (Dé)valide une carte d'un vilain (panneau « Cartes ») — COMMUN aux deux côtés — puis sauvegarde. */
function toggleCard(villainId: string, cardId: string) {
  if (!report) return
  const cur = entryOf(report, villainId)
  const set = new Set(cur.validatedCards)
  if (set.has(cardId)) set.delete(cardId)
  else set.add(cardId)
  report = { ...report, villains: { ...report.villains, [villainId]: { ...cur, validatedCards: [...set] } } }
  scheduleSave()
  emit()
}

/**
 * Accès au rapport PARTAGÉ. Toutes les instances se re-rendent ensemble à chaque
 * modification (patch/toggleCard) ou changement d'état de sauvegarde. `report` est
 * `null` tant que le chargement initial n'est pas terminé.
 */
export function useTestReport() {
  useSyncExternalStore(
    (cb) => { subscribers.add(cb); return () => subscribers.delete(cb) },
    () => version,
  )
  useEffect(() => { ensureLoaded() }, [])
  return { report, patch, toggleCard, saveState }
}
