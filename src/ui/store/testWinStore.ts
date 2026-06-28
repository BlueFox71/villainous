import { create } from 'zustand'

// =============================================================================
// Vilains PERSONNALISÉS ayant déjà REMPORTÉ une partie de test (bouton « Tester »).
//
// Condition de publication : un vilain ne peut être « Terminé » (rejoindre la liste)
// que si le joueur a gagné au moins une partie avec lui. On mémorise donc, par id
// (`custom-…`), ceux qui ont décroché une victoire. Persistant (localStorage).
// =============================================================================

const LS_KEY = 'villainous:customTestWins'

/** Lit/valide la liste persistée d'ids de vilains ayant gagné un test. */
function read(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function persist(ids: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

interface TestWinStore {
  /** Ids des vilains custom ayant déjà gagné une partie de test. */
  wonIds: string[]
  /** Marque un vilain comme vainqueur d'une partie de test (idempotent). */
  markWon: (id: string) => void
  /** Ce vilain a-t-il déjà gagné une partie de test ? */
  hasWon: (id: string) => boolean
}

export const useTestWinStore = create<TestWinStore>((set, get) => ({
  wonIds: read(),
  markWon: (id) =>
    set((s) => {
      if (s.wonIds.includes(id)) return s
      const wonIds = [...s.wonIds, id]
      persist(wonIds)
      return { wonIds }
    }),
  hasWon: (id) => get().wonIds.includes(id),
}))
