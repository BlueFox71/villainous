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
import { CUSTOM_VILLAIN_FORMAT, pickFreshestVillains } from '../../data/customVillain'
import { loadBundledVillains } from '../../data/published/load'
import { registerPublishedVillain, unregisterPublishedVillain } from './gameStore'

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

// --- Filet de sécurité disque (serveur de dév uniquement) -------------------
// L'IndexedDB est cloisonnée par origine (navigateur + hôte:port) et effaçable : un
// brouillon peut « disparaître » alors qu'il a bien été sauvegardé. On en écrit donc une
// copie COMPLÈTE sur le disque (`src/data/drafts/<id>.json`, cf. `villainBackupPlugin`
// dans vite.config.ts), partagée entre origines et persistante, pour pouvoir RESTAURER
// tout brouillon absent de l'IndexedDB. Best-effort : silencieux si pas de serveur de dév
// (build de prod), sans jamais bloquer le save.

/** Écrit une copie disque complète du vilain (best-effort). */
async function backupToDisk(v: CustomVillain): Promise<void> {
  try {
    await fetch('/__save-villain-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, json: JSON.stringify(v) }),
    })
  } catch { /* pas de serveur de dév → on ignore */ }
}

/** Supprime la copie disque d'un vilain (best-effort). */
async function deleteBackup(id: string): Promise<void> {
  try {
    await fetch('/__delete-villain-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  } catch { /* pas de serveur de dév → on ignore */ }
}

/** Supprime la copie EMBARQUÉE (`src/data/published/<id>.json`) d'un vilain publié
 *  (dépublication persistée « dans le code »). Best-effort : silencieux hors serveur de dév. */
async function deletePublished(id: string): Promise<void> {
  try {
    await fetch('/__unpublish-villain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  } catch { /* pas de serveur de dév → on ignore */ }
}

/** Lit les brouillons sauvegardés sur disque (best-effort, [] si indisponible). */
async function listBackups(): Promise<CustomVillain[]> {
  try {
    const res = await fetch('/__list-villain-backups')
    if (!res.ok) return []
    const { villains } = (await res.json()) as { villains: unknown[] }
    return villains.filter(isCustomVillain)
  } catch {
    return []
  }
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
  /** Dépublie un vilain : `published=false`, retiré du runtime (plus jouable/listé) ET
   *  du code embarqué (`src/data/published`). Il reste un brouillon éditable dans l'Atelier. */
  unpublish: (id: string) => Promise<void>
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
    // Vilains LOCAUX (IndexedDB de ce navigateur) + brouillons DISQUE (filet de sécurité,
    // cf. backupToDisk) + vilains EMBARQUÉS (committés). `pickFreshestVillains` fusionne les
    // trois par id en gardant la version la PLUS RÉCENTE (updatedAt) : ainsi une édition
    // faite HORS navigateur (Claude Code écrivant le brouillon disque ou le JSON publié)
    // est reprise, alors que l'IndexedDB la masquerait sinon. À updatedAt égal, l'IndexedDB
    // (édition locale) l'emporte.
    const local = await idbGetAll()
    const restored = await listBackups()
    const bundled = loadBundledVillains()
    const { villains, toPersist } = pickFreshestVillains(local, restored, bundled)
    // (Re)persiste en IndexedDB les versions adoptées depuis le disque/embarqué (brouillon
    // restauré, ou édition hors navigateur plus récente) pour qu'elles redeviennent éditables.
    for (const v of toPersist) await idbPut(v)
    registerPublished(villains)
    set({ villains, loaded: true })
  },

  save: async (v) => {
    const next = { ...v, updatedAt: new Date().toISOString() }
    await idbPut(next)
    void backupToDisk(next) // filet de sécurité disque (best-effort, non bloquant)
    if (next.published) {
      registerPublishedVillain(next)
      // Réécrit le JSON EMBARQUÉ (src/data/published/<id>.json) à CHAQUE enregistrement d'un
      // vilain publié — pas seulement via « Publier ». Ainsi tout changement (image en base64
      // comprise, n'importe quel champ) est versionné et apparaît dans « prochain commit ».
      // Best-effort : silencieux hors serveur de dév.
      void fetch('/__publish-villain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: next.id, json: JSON.stringify(next) }),
      }).catch(() => {})
    }
    set((s) => {
      const others = s.villains.filter((x) => x.id !== next.id)
      return { villains: [next, ...others] }
    })
  },

  remove: async (id) => {
    await idbDelete(id)
    void deleteBackup(id) // retire aussi la copie disque (best-effort)
    set((s) => ({ villains: s.villains.filter((x) => x.id !== id) }))
  },

  unpublish: async (id) => {
    const v = get().villains.find((x) => x.id === id)
    if (!v) return
    const next = { ...v, published: false, updatedAt: new Date().toISOString() }
    await idbPut(next) // persiste `published=false` (prime sur le JSON embarqué au chargement)
    void backupToDisk(next) // conserve le brouillon (filet de sécurité disque)
    void deletePublished(id) // retire src/data/published/<id>.json — dépublication « dans le code »
    unregisterPublishedVillain(id) // retire du registre runtime → plus jouable/listé
    set((s) => ({ villains: [next, ...s.villains.filter((x) => x.id !== id)] }))
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
    void backupToDisk(imported) // filet de sécurité disque (best-effort)
    set((s) => ({ villains: [imported, ...s.villains.filter((x) => x.id !== id)] }))
    return id
  },
}))
