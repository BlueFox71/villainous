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
import { migrateCustomVillain, pickFreshestVillains } from '../../data/customVillain'
import { loadBundledVillains, loadFullBundledVillain } from '../../data/published/load'
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
      body: JSON.stringify({ id: v.id, json: JSON.stringify(v, null, 2) }),
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

/** Dépublie la copie EMBARQUÉE (`src/data/published/<id>.json`) SANS la supprimer : le
 *  serveur de dév y écrit `"published": false` (soft-delete réversible, cf. `/__unpublish-villain`).
 *  Best-effort : silencieux hors serveur de dév. */
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
  /** HYDRATE un vilain : si la copie en mémoire est la version ALLÉGÉE embarquée (`_light`),
   *  charge sa version COMPLÈTE (toutes images), la met en mémoire et ré-enregistre ses cartes/
   *  plateau au runtime, puis la renvoie. Sinon (déjà complète, ou brouillon local) renvoie la
   *  copie existante. À appeler AVANT d'ouvrir un vilain dans l'Atelier ou de lancer une partie
   *  avec lui. Idempotent. */
  hydrate: (id: string) => Promise<CustomVillain | undefined>
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
    // Chaque origine passe par migrateCustomVillain : un vilain ancien est normalisé au
    // format courant (défauts des nouveaux champs…) AVANT la fusion par updatedAt.
    const local = (await idbGetAll()).map(migrateCustomVillain)
    const restored = (await listBackups()).map(migrateCustomVillain)
    const bundled = (await loadBundledVillains()).map(migrateCustomVillain)
    const { villains, toPersist } = pickFreshestVillains(local, restored, bundled)
    // (Re)persiste en IndexedDB les versions adoptées depuis le disque (brouillon restauré, ou
    // édition disque plus récente) pour qu'elles redeviennent éditables. On IGNORE les versions
    // ALLÉGÉES embarquées (`_light`) : les persister priverait l'IndexedDB de leurs images. Elles
    // seront HYDRATÉES puis persistées complètes au premier `save` (ouverture dans l'Atelier).
    for (const v of toPersist) if (!v._light) await idbPut(v)
    registerPublished(villains)
    set({ villains, loaded: true })
  },

  save: async (v) => {
    // `updatedAt` STRICTEMENT postérieur à la version actuellement chargée : garantit qu'une
    // édition locale gagne toujours la fusion `pickFreshestVillains` au prochain chargement —
    // même si la copie embarquée (`src/data/published/<id>.json`) portait une date
    // accidentellement dans le FUTUR. C'est le garde-fou contre la « perte récurrente » d'une
    // édition écrasée au rechargement par un JSON embarqué future-daté.
    const prev = get().villains.find((x) => x.id === v.id)
    const prevMs = prev ? Date.parse(prev.updatedAt) : NaN
    const stampMs = Math.max(Date.now(), Number.isFinite(prevMs) ? prevMs + 1 : 0)
    // On retire `_light` (marqueur runtime) : on ne persiste/publie JAMAIS une version allégée —
    // un `save` part toujours d'un vilain COMPLET (l'ouverture dans l'Atelier l'a hydraté).
    const clean = { ...v }
    delete clean._light
    const next = { ...clean, updatedAt: new Date(stampMs).toISOString() }
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
        // JSON INDENTÉ : les fichiers publiés sont committés → un save produit un diff
        // minimal et lisible (le serveur ré-indente aussi par sécurité).
        body: JSON.stringify({ id: next.id, json: JSON.stringify(next, null, 2) }),
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
    void deletePublished(id) // soft-delete du JSON embarqué (published:false) — réversible, non destructif
    unregisterPublishedVillain(id) // retire du registre runtime → plus jouable/listé
    set((s) => ({ villains: [next, ...s.villains.filter((x) => x.id !== id)] }))
  },

  get: (id) => get().villains.find((v) => v.id === id),

  hydrate: async (id) => {
    const cur = get().villains.find((v) => v.id === id)
    // Déjà complet (brouillon local, ou vilain déjà hydraté) : rien à faire.
    if (cur && !cur._light) return cur
    const full = await loadFullBundledVillain(id)
    // Pas de version complète embarquée (id inconnu / vilain purement local) : on garde l'existant.
    if (!full) return cur
    const migrated = migrateCustomVillain(full)
    // Ré-enregistre AVANT le `set` : ainsi le re-render déclenché par `set` lit déjà les cartes/
    // plateau COMPLETS via `villainEntry` (registre runtime), sans une passe intermédiaire vide.
    if (migrated.published) registerPublishedVillain(migrated)
    // Remplace la version allégée par la complète en mémoire.
    set((s) => ({ villains: s.villains.map((v) => (v.id === id ? migrated : v)) }))
    return migrated
  },

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
    // Migre le vilain importé (défauts des nouveaux champs si le .json est ancien) puis
    // réattribue id/dates. migrateCustomVillain pose déjà `formatVersion` au format courant.
    const imported: CustomVillain = {
      ...migrateCustomVillain(parsed),
      id,
      createdAt: parsed.createdAt ?? now,
      updatedAt: now,
    }
    await idbPut(imported)
    void backupToDisk(imported) // filet de sécurité disque (best-effort)
    set((s) => ({ villains: [imported, ...s.villains.filter((x) => x.id !== id)] }))
    return id
  },
}))
