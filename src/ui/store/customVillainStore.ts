// =============================================================================
// Store des VILAINS PERSONNALISÉS (éditeur intégré).
//
// Les vilains persos sont lourds (images en dataURL) : on les persiste en
// IndexedDB plutôt qu'en localStorage. Ce store Zustand garde la liste chargée en
// mémoire et expose le CRUD + l'export/import .json. La conversion vers les objets
// de jeu (VillainDef/CardDef) vit dans data/customVillain.ts.
// =============================================================================

import { create } from 'zustand'
import type { CustomVillain } from '../../data/customVillain'
import { CUSTOM_VILLAIN_FORMAT } from '../../data/customVillain'
import { loadBundledVillains } from '../../data/published/load'
import { registerPublishedVillain } from './gameStore'

/** Enregistre au runtime tous les vilains PUBLIÉS d'une liste (cartes/couleur/
 *  positions d'actions) pour qu'ils soient jouables/affichables comme des natifs. */
function registerPublished(villains: CustomVillain[]): void {
  for (const v of villains) if (v.published) registerPublishedVillain(v)
}

const DB_NAME = 'villainous-editor'
const STORE = 'villains'
const DB_VERSION = 1

/** Ouvre (et crée au besoin) la base IndexedDB. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Exécute une transaction sur l'object store et résout sur sa complétion. */
async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb()
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    let result: T | undefined
    const req = run(store)
    if (req) req.onsuccess = () => (result = req.result)
    t.oncomplete = () => {
      db.close()
      resolve(result)
    }
    t.onerror = () => {
      db.close()
      reject(t.error)
    }
  })
}

async function idbGetAll(): Promise<CustomVillain[]> {
  const all = await tx<CustomVillain[]>('readonly', (s) => s.getAll() as IDBRequest<CustomVillain[]>)
  return all ?? []
}

async function idbPut(v: CustomVillain): Promise<void> {
  await tx('readwrite', (s) => void s.put(v))
}

async function idbDelete(id: string): Promise<void> {
  await tx('readwrite', (s) => void s.delete(id))
}

/** Validation minimale d'un objet importé : structure attendue d'un CustomVillain. */
function isCustomVillain(o: unknown): o is CustomVillain {
  if (!o || typeof o !== 'object') return false
  const v = o as Partial<CustomVillain>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.locations) &&
    Array.isArray(v.cards)
  )
}

interface CustomVillainStore {
  /** Liste des vilains persos chargés depuis IndexedDB. */
  villains: CustomVillain[]
  /** Chargement initial terminé ? */
  loaded: boolean
  /** (Re)charge la liste depuis IndexedDB. */
  load: () => Promise<void>
  /** Crée ou met à jour un vilain (persiste + maj la liste). Renseigne `updatedAt`. */
  save: (v: CustomVillain) => Promise<void>
  /** Supprime un vilain par id. */
  remove: (id: string) => Promise<void>
  /** Récupère un vilain par id (depuis la liste en mémoire). */
  get: (id: string) => CustomVillain | undefined
  /** Exporte un vilain en chaîne JSON formatée. */
  exportJson: (id: string) => string | undefined
  /** Importe un vilain depuis du JSON ; renvoie l'id importé ou lève une erreur. */
  importJson: (text: string) => Promise<string>
}

/** Donne un id libre si `id` est déjà pris (suffixe -2, -3…). */
function freeId(id: string, taken: Set<string>): string {
  if (!taken.has(id)) return id
  for (let n = 2; ; n++) {
    const candidate = `${id}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export const useCustomVillainStore = create<CustomVillainStore>((set, get) => ({
  villains: [],
  loaded: false,

  load: async () => {
    // Vilains LOCAUX (IndexedDB de ce navigateur) + vilains EMBARQUÉS (committés dans
    // l'app, disponibles pour tous). Un vilain local prime sur sa version embarquée de
    // même id (l'auteur garde ses éditions en cours).
    const local = await idbGetAll()
    const bundled = loadBundledVillains()
    const localIds = new Set(local.map((v) => v.id))
    const villains = [...local, ...bundled.filter((b) => !localIds.has(b.id))]
    villains.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    registerPublished(villains)
    set({ villains, loaded: true })
  },

  save: async (v) => {
    const next = { ...v, updatedAt: new Date().toISOString() }
    await idbPut(next)
    if (next.published) registerPublishedVillain(next)
    set((s) => {
      const others = s.villains.filter((x) => x.id !== next.id)
      return { villains: [next, ...others] }
    })
  },

  remove: async (id) => {
    await idbDelete(id)
    set((s) => ({ villains: s.villains.filter((x) => x.id !== id) }))
  },

  get: (id) => get().villains.find((v) => v.id === id),

  exportJson: (id) => {
    const v = get().villains.find((x) => x.id === id)
    return v ? JSON.stringify(v, null, 2) : undefined
  },

  importJson: async (text) => {
    const parsed = JSON.parse(text) as unknown
    if (!isCustomVillain(parsed)) throw new Error('Fichier invalide : ce n’est pas un vilain personnalisé.')
    const taken = new Set(get().villains.map((v) => v.id))
    const id = freeId(parsed.id, taken)
    const now = new Date().toISOString()
    const imported: CustomVillain = {
      ...parsed,
      id,
      formatVersion: CUSTOM_VILLAIN_FORMAT,
      createdAt: parsed.createdAt ?? now,
      updatedAt: now,
    }
    await idbPut(imported)
    set((s) => ({ villains: [imported, ...s.villains.filter((x) => x.id !== id)] }))
    return id
  },
}))
