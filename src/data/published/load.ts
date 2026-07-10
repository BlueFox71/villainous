// =============================================================================
// Vilains PUBLIÉS EMBARQUÉS dans l'app.
//
// Quand un vilain est « Terminé » dans l'Atelier (sur le serveur de dév), son JSON
// COMPLET (avec images en dataURL) est écrit ici, dans ce dossier (cf. l'endpoint
// `/__publish-villain` de vite.config.ts), ET une version ALLÉGÉE (sans images lourdes,
// cf. `lighten.ts`) dans `light/<id>.json`. Ces fichiers sont committés dans le dépôt :
// chargés au démarrage, le vilain devient disponible pour TOUS les joueurs (après commit
// + redéploiement), sans backend.
//
// CHARGEMENT À LA DEMANDE (perf) : un vilain publié pèse des dizaines de Mo d'images base64,
// or la LISTE / les galeries n'ont besoin que du portrait + de la présentation. On charge
// donc au démarrage la version LÉGÈRE (`light/<id>.json`, ~1–3 Mo au lieu de ~40 Mo), et les
// images lourdes (cartes, plateau, lieux…) seulement par HYDRATATION du `<id>.json` complet,
// quand on ouvre le vilain dans l'Atelier ou qu'on lance une partie avec lui. Les deux jeux de
// chunks sont LAZY (import dynamique) : rien n'est inliné dans le bundle principal.
// =============================================================================

import type { CustomVillain } from '../customVillain'

// Deux globs LAZY distincts :
//  - `lightLoaders` : versions allégées (chargées pour la liste au démarrage) ;
//  - `fullLoaders`  : versions complètes (hydratées à la demande, par id).
// `./*.json` ne matche PAS `./light/*.json` (le `*` ne traverse pas `/`), donc les deux
// ensembles restent disjoints.
const lightLoaders = import.meta.glob('./light/*.json', { import: 'default' }) as Record<
  string,
  () => Promise<unknown>
>
const fullLoaders = import.meta.glob('./*.json', { import: 'default' }) as Record<
  string,
  () => Promise<unknown>
>

function isVillain(v: unknown): v is CustomVillain {
  const cv = v as CustomVillain
  return !!cv && typeof cv.id === 'string' && Array.isArray(cv.cards)
}

/** Charge (dynamiquement, en parallèle) TOUS les vilains embarqués en version LÉGÈRE (sans
 *  images lourdes), en préservant leur VRAI statut de publication (`published: false` =
 *  soft-dépublié) et en les marquant `_light: true` (à hydrater avant édition/jeu). On ne
 *  filtre PAS ici : les consommateurs trient eux-mêmes (`registerPublished` et les galeries
 *  font `if (v.published)`), tandis que l'Atelier garde les dépubliés comme brouillons
 *  ÉDITABLES. Crucial pour la fusion `pickFreshestVillains` : un fichier embarqué plus récent
 *  (même dépublié) peut ainsi « soigner » une copie IndexedDB divergente au lieu d'être
 *  ignoré. Un champ `published` absent (fichiers hérités) vaut publié. */
export async function loadBundledVillains(): Promise<CustomVillain[]> {
  const mods = await Promise.all(Object.values(lightLoaders).map((load) => load()))
  return mods
    .filter(isVillain)
    .map((cv) => ({ ...cv, _light: true, published: cv.published !== false }))
}

/** Charge (dynamiquement) la version COMPLÈTE d'un vilain embarqué par son id — avec toutes
 *  ses images. Sert à l'HYDRATATION (édition dans l'Atelier / lancement de partie), quand la
 *  version légère chargée au démarrage ne suffit plus. `undefined` si le fichier complet est
 *  absent (id inconnu). Le statut de publication est préservé comme pour la version légère. */
export async function loadFullBundledVillain(id: string): Promise<CustomVillain | undefined> {
  const entry = Object.entries(fullLoaders).find(([path]) => path.endsWith(`/${id}.json`))
  if (!entry) return undefined
  const mod = await entry[1]()
  if (!isVillain(mod)) return undefined
  return { ...mod, published: mod.published !== false }
}
