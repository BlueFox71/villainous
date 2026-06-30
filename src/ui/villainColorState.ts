// Override RÉACTIF, temporaire, de la couleur thématique d'un vilain (présentation pure).
// `VILLAIN_COLOR` (villainColors.ts) est la couleur de BASE, statique. Certains décors à surprise
// veulent changer la couleur d'un vilain pendant quelques secondes (ex. Tamatoa : la couleur vire au
// magenta le temps de l'animation surprise). Ce module garde la liste des overrides en cours et
// notifie les abonnés (via `useSyncExternalStore`) pour que l'UI se redessine.
//
// Clé = la même que `VILLAIN_COLOR` (la `VillainKey`). Hors moteur, aucune logique de jeu.

import { useSyncExternalStore } from 'react'
import { VILLAIN_COLOR } from './villainColors'

const overrides: Record<string, string> = {}
const subscribers = new Set<() => void>()
let version = 0

/** Pose (ou retire si `color` est null) un override temporaire pour un vilain, puis notifie l'UI. */
export function setVillainColorOverride(villain: string, color: string | null): void {
  if (color == null) {
    if (!(villain in overrides)) return
    delete overrides[villain]
  } else {
    if (overrides[villain] === color) return
    overrides[villain] = color
  }
  version++
  for (const fn of [...subscribers]) fn()
}

/** Couleur effective d'un vilain : l'override en cours s'il existe, sinon la couleur de base. */
export function villainColor(villain: string): string {
  return overrides[villain] ?? VILLAIN_COLOR[villain]
}

/** Abonnement bas niveau (pour `useSyncExternalStore`). */
export function subscribeVillainColor(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

/** Instantané (numéro de version) — change à chaque pose/retrait d'override. */
export function villainColorVersion(): number {
  return version
}

/** Hook : s'abonne aux overrides de couleur. À appeler une fois HAUT dans l'arbre (App) pour que tout
 *  le sous-arbre se redessine quand un override est posé/retiré (les composants enfants lisent ensuite
 *  `villainColor()` à jour). Renvoie la version courante (valeur opaque, juste pour déclencher le rendu). */
export function useVillainColorVersion(): number {
  return useSyncExternalStore(subscribeVillainColor, villainColorVersion)
}
