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

const urls = import.meta.glob('./*.json', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

/** Charge tous les vilains publiés embarqués (toujours marqués `published`). */
export async function loadBundledVillains(): Promise<CustomVillain[]> {
  const out: CustomVillain[] = []
  await Promise.all(
    Object.values(urls).map(async (url) => {
      try {
        const v = (await (await fetch(url)).json()) as CustomVillain
        if (v && typeof v.id === 'string' && Array.isArray(v.cards)) out.push({ ...v, published: true })
      } catch {
        /* JSON illisible → ignoré (ne casse pas le chargement des autres) */
      }
    }),
  )
  return out
}
