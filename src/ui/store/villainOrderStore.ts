import { create } from 'zustand'

const LS_KEY = 'villainous:villainOrder'

/** Lit/valide l'ordre personnalisé des vilains (liste de clés, natives ou publiées
 *  `custom-…`). Liste vide = ordre par défaut (sortie). */
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

function persist(keys: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(keys))
  } catch {
    /* ignore */
  }
}

interface VillainOrderStore {
  /** Ordre personnalisé des vilains (clés). Vide = ordre de sortie par défaut. */
  order: string[]
  /** Remplace l'ordre personnalisé (et le persiste). */
  setOrder: (keys: string[]) => void
  /** Réinitialise sur l'ordre par défaut (sortie). */
  reset: () => void
}

/** Ordre d'affichage personnalisé des vilains (persistant), modifiable depuis la
 *  galerie via le mode « Modifier l'ordre des villains ». */
export const useVillainOrderStore = create<VillainOrderStore>((set) => ({
  order: read(),
  setOrder: (keys) => {
    persist(keys)
    set({ order: keys })
  },
  reset: () => {
    persist([])
    set({ order: [] })
  },
}))

/**
 * Renvoie un comparateur d'ordre personnalisé : les vilains présents dans `order`
 * suivent ce rang ; les absents (nouveaux vilains, publiés…) gardent leur rang
 * naturel, placés APRÈS les vilains ordonnés. Le tri reste stable par section.
 */
export function orderRank(order: string[]): (key: string) => number {
  const index = new Map(order.map((k, i) => [k, i]))
  return (key) => (index.has(key) ? index.get(key)! : Number.MAX_SAFE_INTEGER)
}
