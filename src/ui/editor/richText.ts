// Conversions PURES entre le MARKUP du texte de carte et le HTML d'un champ enrichi
// (contenteditable). Le markup encode la couleur par des balises `{c:#rrggbb}` … `{/c}`
// (cf. `parseSegments` dans cardRender.ts) et les sauts de ligne par `\n`. Dans le
// champ enrichi, la couleur devient un `<span style="color:…">` (invisible pour
// l'utilisateur : il voit le texte DÉJÀ coloré, pas la balise) ; le reste du texte —
// y compris les marqueurs `_italique_` et les jetons `[activer]` — reste LITTÉRAL.
//
// Le conteneur est en `white-space: pre-wrap`, donc les `\n` sont conservés tels quels
// dans les nœuds texte (pas de `<br>`).

/** Échappe le HTML d'un texte brut (pour l'injecter en innerHTML sans risque). */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** MARKUP → HTML pour le contenteditable : couleurs en `<span>`, `\n` conservés. */
export function markupToHtml(markup: string): string {
  const re = /\{c:(#[0-9a-fA-F]{3,8})\}|\{\/c\}/g
  let html = ''
  let color: string | undefined
  let last = 0
  let m: RegExpExecArray | null
  const emit = (text: string) => {
    if (!text) return
    const esc = escapeHtml(text)
    html += color ? `<span style="color:${color}">${esc}</span>` : esc
  }
  while ((m = re.exec(markup))) {
    emit(markup.slice(last, m.index))
    color = m[1] // undefined pour `{/c}`
    last = re.lastIndex
  }
  emit(markup.slice(last))
  return html
}

/** Normalise une couleur CSS (`rgb(r,g,b)` ou `#abc`/`#aabbcc`) en `#rrggbb` minuscule.
 *  Renvoie `undefined` si la couleur est absente / non reconnue (= couleur par défaut). */
export function cssColorToHex(css: string | undefined | null): string | undefined {
  if (!css) return undefined
  const s = css.trim()
  const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    const h = (n: string) => Math.min(255, Number(n)).toString(16).padStart(2, '0')
    return `#${h(rgb[1])}${h(rgb[2])}${h(rgb[3])}`
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase()
  return undefined
}

/** DOM (contenu d'un contenteditable) → MARKUP. Interprète les `<span>`/`<font>` colorés,
 *  les `<br>` et les blocs (`<div>`/`<p>`, insérés par le navigateur) en sauts de ligne,
 *  et FUSIONNE les portions consécutives de même couleur. */
export function domToMarkup(root: Node): string {
  type Run = { text: string; color?: string }
  const runs: Run[] = []
  const push = (text: string, color?: string) => {
    if (!text) return
    const last = runs[runs.length - 1]
    if (last && last.color === color) last.text += text
    else runs.push({ text, color })
  }
  const endsWithNewline = () => {
    const last = runs[runs.length - 1]
    return !last || last.text.endsWith('\n')
  }
  const walk = (node: Node, color: string | undefined) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        push(child.textContent ?? '', color)
      } else if (child.nodeName === 'BR') {
        push('\n', color)
      } else if (child instanceof HTMLElement) {
        const c = cssColorToHex(child.style?.color || child.getAttribute('color')) ?? color
        const isBlock = /^(DIV|P)$/.test(child.nodeName)
        // Un bloc démarre sur une nouvelle ligne (sauf tout premier / déjà en début de ligne).
        if (isBlock && runs.length && !endsWithNewline()) push('\n', color)
        walk(child, c)
      }
    })
  }
  walk(root, undefined)
  let out = ''
  for (const r of runs) out += r.color ? `{c:${r.color}}${r.text}{/c}` : r.text
  return out
}
