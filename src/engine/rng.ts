// =============================================================================
// Générateur pseudo-aléatoire déterministe (mulberry32).
//
// Pourquoi pas Math.random() ? Le moteur doit rester PUR et déterministe : à
// même état + même graine, même résultat. On stocke l'état du PRNG (un simple
// entier 32 bits) dans le GameState et chaque opération aléatoire le fait
// avancer. Indispensable pour des tests reproductibles et, plus tard, pour le
// MCTS qui rejoue des parties.
// =============================================================================

/** Avance l'état et renvoie une valeur dans [0, 1) + le nouvel état. */
export function nextRandom(state: number): { value: number; state: number } {
  let a = state | 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: a }
}

/** Mélange de Fisher-Yates pur : renvoie une nouvelle copie mélangée + le
 *  nouvel état du PRNG (n'altère pas le tableau d'entrée). */
export function shuffle<T>(input: readonly T[], state: number): { result: T[]; state: number } {
  const result = input.slice()
  let s = state
  for (let i = result.length - 1; i > 0; i--) {
    const r = nextRandom(s)
    s = r.state
    const j = Math.floor(r.value * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return { result, state: s }
}
