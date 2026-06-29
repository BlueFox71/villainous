// =============================================================================
// Vilains PUBLIÉS EMBARQUÉS dans l'app.
//
// Quand un vilain est « Terminé » dans l'Atelier (sur le serveur de dév), son JSON
// COMPLET (avec images en dataURL) est écrit ici, dans ce dossier (cf. l'endpoint
// `/__publish-villain` de vite.config.ts). Ces fichiers sont committés dans le dépôt :
// chargés au démarrage, le vilain devient alors disponible pour TOUS les joueurs (après
// commit + redéploiement), sans backend.
//
// Les JSON sont importés en `?url` (assets séparés, hors bundle JS principal) puis
// récupérés par `fetch` au démarrage.
// =============================================================================

import type { CustomVillain } from '../customVillain'

// Import DIRECT (inliné dans le bundle) de chaque JSON embarqué : pas de fetch runtime ni
// d'URL à résoudre → fiable en dev comme en prod, chez tout le monde après un simple pull.
const mods = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<string, unknown>

/** Charge tous les vilains publiés embarqués (toujours marqués `published`). */
export function loadBundledVillains(): CustomVillain[] {
  const out: CustomVillain[] = []
  for (const v of Object.values(mods)) {
    const cv = v as CustomVillain
    if (cv && typeof cv.id === 'string' && Array.isArray(cv.cards)) out.push({ ...cv, published: true })
  }
  return out
}
