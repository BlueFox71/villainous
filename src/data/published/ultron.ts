// =============================================================================
// Données de JEU d'Ultron, DÉRIVÉES de son JSON publié (source unique).
//
// Ultron est un vilain de l'Atelier PUBLIÉ (cf. `custom-ultron.json`) : aucun
// fichier `data/villains/` natif (cf. CLAUDE.md, « Un nouveau vilain — TOUJOURS
// via l'Atelier »). Au runtime, il est chargé et enregistré par
// `customVillainStore` / `registerPublishedVillain`. Ce module n'existe que pour
// les TESTS d'intégrité, qui reconstruisent le `VillainDef` + `CardDef[]` de façon
// synchrone via `toVillainDef` / `toCardDefs` — la donnée reste une seule source.
//
// ⚠️ Phase 1 (fondation) : cartes + plateau + objectif « placeholder ». Les
// mécaniques Marvel (tuiles Amélioration, Sentinelles, complément Fatalité Marvel
// à 15, terminologie « Domaine ») arrivent en Phase 2.
// =============================================================================

import cv from './custom-ultron.json'
import { toVillainDef, toCardDefs, type CustomVillain } from '../customVillain'

const villain = cv as unknown as CustomVillain

export const ultron = toVillainDef(villain)
export const ultronCards = toCardDefs(villain)
