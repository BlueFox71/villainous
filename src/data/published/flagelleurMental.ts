// =============================================================================
// Données de JEU du Flagelleur Mental, DÉRIVÉES de son JSON publié (source unique).
//
// Le Flagelleur Mental est un vilain de l'Atelier PUBLIÉ (cf.
// `custom-flagelleur-mental.json`) : aucun fichier `data/villains/` natif (cf.
// CLAUDE.md, « Un nouveau vilain — TOUJOURS via l'Atelier »). Au runtime, il est
// chargé et enregistré par `customVillainStore` / `registerPublishedVillain`.
// Ce module n'existe que pour les TESTS moteur/intégrité, qui ont besoin du
// `VillainDef` + `CardDef[]` de façon synchrone : on les reconstruit depuis le JSON
// via `toVillainDef` / `toCardDefs` — la donnée reste ainsi une seule source.
// =============================================================================

import type { CustomVillain } from '../customVillain'
import { toVillainDef, toCardDefs } from '../customVillain'

const FLAGELLEUR_ID = 'custom-flagelleur-mental'

// Glob EAGER LOCAL (JSON lus au chargement du module, de façon synchrone) : les tests ont
// besoin du `VillainDef` + `CardDef[]` d'emblée. Volontairement PAS via `load.ts` (dont le
// glob est désormais lazy/asynchrone) — mais comme AUCUN code applicatif n'importe ce
// fichier (tests uniquement), cet `eager` n'entre JAMAIS dans le bundle navigateur : le boot
// reste léger. Résolu par le glob (pas un `import` nommé fragile) → message clair si le JSON
// a été supprimé.
const mods = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>
const villain = Object.values(mods).find((v): v is CustomVillain => {
  const cv = v as CustomVillain
  return !!cv && cv.id === FLAGELLEUR_ID && Array.isArray(cv.cards)
})
if (!villain) {
  throw new Error(
    `Vilain publié « ${FLAGELLEUR_ID} » introuvable dans src/data/published/. ` +
      'Son JSON a-t-il été supprimé (dépublication) ? Restaure-le pour rejouer ses tests.',
  )
}

export const flagelleurMental = toVillainDef(villain)
export const flagelleurMentalCards = toCardDefs(villain)
