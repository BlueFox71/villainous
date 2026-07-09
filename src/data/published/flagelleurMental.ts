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

import cv from './custom-flagelleur-mental.json'
import { toVillainDef, toCardDefs, type CustomVillain } from '../customVillain'

const villain = cv as unknown as CustomVillain

export const flagelleurMental = toVillainDef(villain)
export const flagelleurMentalCards = toCardDefs(villain)
