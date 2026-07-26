// =============================================================================
// Données de JEU du Seigneur des clés, DÉRIVÉES de son JSON publié (source unique).
//
// Le Seigneur des clés est un vilain de l'Atelier PUBLIÉ (cf. `custom-seigneur-cles.json`) :
// aucun fichier `data/villains/` natif (cf. CLAUDE.md, « Un nouveau vilain — TOUJOURS via
// l'Atelier »). Au runtime, il est chargé et enregistré par `customVillainStore` /
// `registerPublishedVillain`. Ce module n'existe que pour les TESTS moteur/intégrité, qui
// ont besoin du `VillainDef` + `CardDef[]` de façon synchrone : on les reconstruit depuis
// le JSON via `toVillainDef` / `toCardDefs` — la donnée reste ainsi une seule source.
// =============================================================================

import type { CustomVillain } from '../customVillain'
import { toVillainDef, toCardDefs } from '../customVillain'

const SEIGNEUR_CLES_ID = 'custom-seigneur-cles'

// Glob EAGER LOCAL (JSON lus au chargement du module, de façon synchrone) : les tests ont
// besoin du `VillainDef` + `CardDef[]` d'emblée. Volontairement PAS via `load.ts` (dont le
// glob est lazy/asynchrone) — mais comme AUCUN code applicatif n'importe ce fichier (tests
// uniquement), cet `eager` n'entre JAMAIS dans le bundle navigateur.
const mods = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>
const villain = Object.values(mods).find((v): v is CustomVillain => {
  const cv = v as CustomVillain
  return !!cv && cv.id === SEIGNEUR_CLES_ID && Array.isArray(cv.cards)
})
if (!villain) {
  throw new Error(
    `Vilain publié « ${SEIGNEUR_CLES_ID} » introuvable dans src/data/published/. ` +
      'Son JSON a-t-il été supprimé (dépublication) ? Restaure-le pour rejouer ses tests.',
  )
}

export const seigneurCles = toVillainDef(villain)
export const seigneurClesCards = toCardDefs(villain)
