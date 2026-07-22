// Journal data-driven (générique, réutilisable par TOUS les vilains).
//
// Une carte peut déclarer un TEMPLATE de message de journal (`CardInstance.journal`),
// authoré en donnée dans le JSON du vilain (`botStrategy.journal`, recopié sur la carte par
// `toCardDefs` → `buildDeckInstances`). Quand la carte est jouée, le moteur remplace les
// `{placeholder}` par les vraies valeurs calculées à la résolution (esprits gagnés/perdus,
// nom du Héros ciblé…) et logue CETTE ligne à la place de sa ligne codée en dur.
//
// Ce module est PUR (aucun accès data/UI, aucune source d'aléa) : `fillJournal` est une
// simple substitution de chaînes.

/** Dictionnaire de valeurs à injecter dans un template (`{clé}` → valeur). */
export type JournalCtx = Record<string, string | number>

/**
 * Remplace chaque `{clé}` de `template` par `ctx[clé]`. Les clés peuvent contenir des
 * lettres accentuées (`{nomHéros}`). Une clé absente du contexte est laissée TELLE QUELLE
 * (`{clé}`) — ainsi un placeholder oublié se repère à l'œil au lieu de disparaître.
 *
 * Une ligne de template peut porter plusieurs issues séparées par `\n` (carte à choix) :
 * l'appelant choisit la bonne ligne AVANT de remplir (cf. `journalLine`).
 */
export function fillJournal(template: string, ctx: JournalCtx): string {
  return template.replace(/\{([^{}]+)\}/g, (whole, key: string) => {
    const v = ctx[key.trim()]
    return v === undefined || v === null ? whole : String(v)
  })
}

/** Sélectionne la ligne d'index `index` d'un template multi-lignes (une ligne = une issue),
 *  puis la remplit. `index` hors bornes → dernière ligne (garde-fou). */
export function journalLine(template: string, ctx: JournalCtx, index = 0): string {
  const lines = template.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return ''
  const line = lines[Math.min(index, lines.length - 1)]
  return fillJournal(line, ctx)
}

// --- Intégration au Journal de partie (GameLog) -----------------------------------------
//
// Une ligne de journal issue d'un template est FREEFORM (prose de l'auteur) : elle ne
// commence pas par un verbe reconnu par le regroupement par mots-clés de `GameLog`. On la
// balise donc pour forcer un BLOC d'action à part et transporter l'icône à afficher :
//   `<Vilain> ⟦ji:<icon>⟧<texte rempli>`
// `GameLog` détecte `⟦ji:…⟧`, force le bloc top-level, en retire le marqueur, et utilise
// `<icon>` (repli si l'inférence par mots-clés ne trouve rien). `icon` peut être vide.

/** Ouvre le marqueur d'icône ; suivi du nom d'icône puis de `⟧`. */
export const JOURNAL_TAG_OPEN = '⟦ji:'
/** Regex de repérage du marqueur en tête de corps de ligne : capture l'icône puis le texte. */
export const JOURNAL_TAG_RE = /^⟦ji:([^⟧]*)⟧([\s\S]*)$/

/** Construit la ligne de log balisée : `<Vilain> ⟦ji:<icon>⟧<texte>`. `icon` optionnel. */
export function journalLogLine(villainName: string, text: string, icon = ''): string {
  return `${villainName} ${JOURNAL_TAG_OPEN}${icon}⟧${text}`
}
