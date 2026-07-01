// Vitesse d'accélération des bots (UI uniquement, mode ORDI vs ORDI en dev).
// 1 = normal ; 2/3/5 = accéléré. Réduit d'autant la cadence des bots ET la durée
// des animations. Singleton module : partagé entre App (cadence) et Showcase
// (durées) sans prop-drilling ; le bouton de vitesse (App) le met à jour.
let speed = 1

/** Multiplicateur courant (1 = normal). */
export function getBotSpeed(): number {
  return speed
}

/** Change le multiplicateur (appelé par le bouton de vitesse). */
export function setBotSpeed(s: number): void {
  speed = s
}

/** Durée `ms` réduite selon la vitesse courante (arrondie, min 0). */
export function speedScaled(ms: number): number {
  return Math.round(ms / speed)
}
