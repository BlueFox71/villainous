// =============================================================================
// Bibliothèque GLOBALE de types de carte personnalisés (nom + couleur), partagée
// entre tous les vilains persos. Petite donnée → persistée en localStorage. Permet
// de réutiliser un type créé sans resaisir son nom ni sa couleur.
// =============================================================================

import { create } from 'zustand'

export interface CustomType {
  label: string
  color: string
}

const KEY = 'villainous-custom-types'

function load(): CustomType[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (t): t is CustomType =>
        !!t && typeof (t as CustomType).label === 'string' && typeof (t as CustomType).color === 'string',
    )
  } catch {
    return []
  }
}

function persist(list: CustomType[]) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* quota / mode privé : on garde au moins l'état mémoire */
  }
}

interface CustomTypesStore {
  types: CustomType[]
  /** Mémorise un type (unique par nom, insensible à la casse ; remonte en tête). */
  addType: (label: string, color: string) => void
  /** Oublie un type par son nom. */
  removeType: (label: string) => void
}

export const useCustomTypesStore = create<CustomTypesStore>((set, get) => ({
  types: load(),

  addType: (label, color) => {
    const l = label.trim()
    if (!l) return
    const others = get().types.filter((t) => t.label.toLowerCase() !== l.toLowerCase())
    const next = [{ label: l, color }, ...others]
    persist(next)
    set({ types: next })
  },

  removeType: (label) => {
    const next = get().types.filter((t) => t.label.toLowerCase() !== label.toLowerCase())
    persist(next)
    set({ types: next })
  },
}))
