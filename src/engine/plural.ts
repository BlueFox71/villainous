// =============================================================================
// Accord en nombre (français) — helper PARTAGÉ (moteur + UI).
//
// Règle du projet : JAMAIS de « (s) » / « (x) » pour le pluriel dans le texte
// AFFICHÉ. On accorde selon le nombre : singulier pour 0 et 1, pluriel dès 2.
// =============================================================================

/**
 * Renvoie la forme accordée d'un mot selon `n` (SANS le nombre lui-même) :
 * singulier si |n| ≤ 1, pluriel sinon. Le pluriel vaut par défaut `singulier + 's'` ;
 * passer `pluralForm` pour les pluriels irréguliers (ex. `plural(n, 'lieu', 'lieux')`).
 *
 *   `${n} ${plural(n, 'carte')}`         → « 1 carte », « 3 cartes »
 *   `${n} ${plural(n, 'lieu', 'lieux')}` → « 1 lieu », « 2 lieux »
 */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return Math.abs(n) > 1 ? pluralForm : singular
}
