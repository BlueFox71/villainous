// Registre runtime des positions d'action des vilains PERSONNALISÉS (en % de
// l'image du plateau), tenu hors du composant BoardActions pour respecter la règle
// react-refresh (un fichier de composant n'exporte que des composants).

export type ActionPosMap = Record<string, Record<string, { x: number; y: number }>>

const registry: Record<string, ActionPosMap> = {}

/** Enregistre les positions d'action d'un vilain perso (cf. boardLayout.ts). */
export function registerActionPos(villainId: string, posMap: ActionPosMap): void {
  registry[villainId] = posMap
}

/** Positions d'action d'un vilain perso, ou undefined (vilain natif). */
export function customActionPosFor(villainId: string): ActionPosMap | undefined {
  return registry[villainId]
}
