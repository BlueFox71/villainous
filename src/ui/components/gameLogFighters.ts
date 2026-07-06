// =============================================================================
// Tabbou — consolidation des lignes de journal « Combattants » (dévoilements /
// mises à mort). Helpers PURS extraits de GameLog.tsx (module à part pour ne pas
// gêner le Fast Refresh, qui exige qu'un fichier de composants n'exporte que des
// composants).
// =============================================================================

/** Pluriel de l'adjectif de couleur d'un Combattant (Tabbou). Les couleurs
 *  invariables (magenta, orange, marron, gris) ne prennent pas de « s ». */
const FIGHTER_COLOR_PLURAL: Record<string, string> = {
  magenta: 'magenta', orange: 'orange', rouge: 'rouges', marron: 'marron',
  bleu: 'bleus', violet: 'violets', vert: 'verts', jaune: 'jaunes', gris: 'gris',
}
function agreeColor(color: string, n: number): string {
  return n > 1 ? FIGHTER_COLOR_PLURAL[color] ?? color : color
}
/** Répartition « 1 jaune, 2 gris » d'une liste de couleurs (ordre d'apparition). */
function fighterBreakdown(colors: string[]): string {
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const c of colors) {
    if (!counts.has(c)) order.push(c)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return order.map((c) => `${counts.get(c)} ${agreeColor(c, counts.get(c)!)}`).join(', ')
}

const RE_FIGHTER_REVEAL = /^dévoile un Combattant « (.+?) »\.?$/
const RE_FIGHTER_CF_KILL = /^tue un Combattant « (.+?) » \(Coup Fatal\)\.?$/
const RE_FIGHTER_KILL_COLOR = /^tue (\d+) Combattant\(s\) « (.+?) »\.?$/

/** Une ligne est-elle un dévoilement/mise à mort de Combattant (Tabbou) ? */
export function isFighterOutcomeLine(body: string): boolean {
  return RE_FIGHTER_REVEAL.test(body) || RE_FIGHTER_CF_KILL.test(body) || RE_FIGHTER_KILL_COLOR.test(body)
}
/** Prompt UI de Combattants (dévoilez… / choisissez une couleur… / Coup Fatal : tuez…)
 *  → bruit, masqué du journal. `body` peut débuter par « : » (préfixe vilain retiré). */
export function isFighterPromptLine(body: string): boolean {
  return (
    /^:?\s*dévoilez \d+ tuiles? Combattant/i.test(body) ||
    /^:?\s*choisissez une couleur de Combattants/i.test(body) ||
    /^\(Coup Fatal\) : tuez/i.test(body)
  )
}

/** Fusionne les lignes de dévoilement/mise à mort d'un bloc en un résumé unique :
 *  « dévoile N tuiles Combattant (1 jaune, 1 marron) », « tue N Combattants bleus ». */
export function consolidateFighterDetails(details: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < details.length) {
    if (RE_FIGHTER_REVEAL.test(details[i])) {
      const colors: string[] = []
      while (i < details.length && RE_FIGHTER_REVEAL.test(details[i])) {
        colors.push(details[i].match(RE_FIGHTER_REVEAL)![1])
        i++
      }
      out.push(`dévoile ${colors.length} tuile${colors.length > 1 ? 's' : ''} Combattant (${fighterBreakdown(colors)})`)
      continue
    }
    if (RE_FIGHTER_CF_KILL.test(details[i])) {
      const colors: string[] = []
      while (i < details.length && RE_FIGHTER_CF_KILL.test(details[i])) {
        colors.push(details[i].match(RE_FIGHTER_CF_KILL)![1])
        i++
      }
      out.push(`tue ${colors.length} Combattant${colors.length > 1 ? 's' : ''} (${fighterBreakdown(colors)})`)
      continue
    }
    const km = details[i].match(RE_FIGHTER_KILL_COLOR)
    if (km) {
      const n = Number(km[1])
      out.push(`tue ${n} Combattant${n > 1 ? 's' : ''} ${agreeColor(km[2], n)}`)
      i++
      continue
    }
    out.push(details[i])
    i++
  }
  return out
}
