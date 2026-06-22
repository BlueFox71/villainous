import { create } from 'zustand'
import type { VillainKey } from './gameStore'

const LS_KEY = 'villainous:favorites'

/** Lit/valide la liste des vilains favoris persistée (clés de vilain). */
function read(): VillainKey[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((k): k is VillainKey => typeof k === 'string') : []
  } catch {
    return []
  }
}

function persist(keys: VillainKey[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(keys))
  } catch {
    /* ignore */
  }
}

interface FavoritesStore {
  /** Vilains marqués comme favoris par le joueur. */
  favorites: VillainKey[]
  /** Ajoute/retire un vilain des favoris. */
  toggleFavorite: (key: VillainKey) => void
}

/** Favoris du joueur (persistants), pour filtrer/mettre en avant des vilains. */
export const useFavoritesStore = create<FavoritesStore>((set) => ({
  favorites: read(),
  toggleFavorite: (key) =>
    set((s) => {
      const favorites = s.favorites.includes(key)
        ? s.favorites.filter((k) => k !== key)
        : [...s.favorites, key]
      persist(favorites)
      return { favorites }
    }),
}))
