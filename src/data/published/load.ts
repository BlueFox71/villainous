// Vilains PUBLIÉS embarqués (JSON « chemins », quelques Ko). Un seul glob : plus de
// split light/full — les images sont des fichiers servis sous public/cards/.
import type { CustomVillain } from '../customVillain'

const loaders = import.meta.glob('./*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>

function isVillain(v: unknown): v is CustomVillain {
  const cv = v as CustomVillain
  return !!cv && typeof cv.id === 'string' && Array.isArray(cv.cards)
}

/** Charge tous les vilains embarqués (versions complètes « chemins »), en préservant leur
 *  statut de publication (`published: false` = soft-dépublié ; absent = publié). */
export async function loadBundledVillains(): Promise<CustomVillain[]> {
  const mods = await Promise.all(Object.values(loaders).map((load) => load()))
  return mods.filter(isVillain).map((cv) => ({ ...cv, published: cv.published !== false }))
}
