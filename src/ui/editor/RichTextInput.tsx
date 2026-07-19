// Champ de texte ENRICHI (contenteditable) pour l'éditeur de cartes : le texte s'affiche
// DÉJÀ coloré (les balises `{c:#…}` du markup deviennent des <span>, jamais visibles) ;
// `_italique_` et `[jetons]` restent littéraux. Le conteneur est en `white-space: pre-wrap`
// (les sauts de ligne sont de simples `\n`). Voir `richText.ts` pour les conversions pures.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { markupToHtml, domToMarkup } from './richText'

/** API impérative exposée au parent (barre de couleur / boutons de jetons partagés). */
export interface RichTextApi {
  /** Colore la sélection courante (ou tout le texte si rien n'est sélectionné). */
  applyColor: (hex: string) => void
  /** Rétablit la couleur par défaut sur la sélection (ou tout le texte). */
  resetColor: () => void
  /** Insère du texte au curseur (jeton d'action, mention…). */
  insertText: (text: string) => void
}

/** Normalise une couleur CSS (`rgb(...)` ou `#rrggbb`) en hex `#rrggbb`, ou null. */
function toHex(c: string | undefined | null): string | null {
  if (!c) return null
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase()
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!m) return null
  const h = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`
}

/** Couleur explicite du texte à la position `node` (remonte jusqu'à `el`), ou null
 *  si aucun ancêtre coloré (⇒ couleur par défaut de la carte). */
function colorAt(node: Node | null, el: HTMLElement): string | null {
  let n: Node | null = node
  while (n && n !== el) {
    if (n.nodeType === 1) {
      const hex = toHex((n as HTMLElement).style?.color)
      if (hex) return hex
    }
    n = n.parentNode
  }
  return null
}

/** Déballe les <span>/<font> colorés d'un fragment (remplace par leurs enfants). */
function unwrapColorSpans(frag: DocumentFragment) {
  frag.querySelectorAll('span, font').forEach((el) => {
    const he = el as HTMLElement
    if (he.style?.color || el.getAttribute('color')) {
      const parent = el.parentNode
      if (!parent) return
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    }
  })
}

export function RichTextInput({
  value,
  onChange,
  onActivate,
  onFocus,
  onSelectionColor,
  placeholder,
  className = '',
  minHeightClass = 'min-h-[5rem]',
  bg = '#ffffff',
  defaultColor = '#1a1a1a',
}: {
  value: string
  onChange: (markup: string) => void
  /** Appelé au focus : enregistre cet éditeur comme éditeur ACTIF (cible de la barre couleur). */
  onActivate?: (api: RichTextApi) => void
  onFocus?: () => void
  /** Appelé quand la sélection change DANS cet éditeur : couleur du texte à la
   *  sélection (hex), ou null si couleur par défaut. Sert à refléter la pastille. */
  onSelectionColor?: (hex: string | null) => void
  placeholder?: string
  className?: string
  minHeightClass?: string
  /** Fond du champ (mime le panneau de la carte : couleur du vilain / blanc pour la Fatalité). */
  bg?: string
  /** Couleur du texte NON coloré (défaut de la carte : doré Méchant / encre Fatalité). */
  defaultColor?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  const onSelColorRef = useRef(onSelectionColor)
  useEffect(() => {
    onSelColorRef.current = onSelectionColor
  }, [onSelectionColor])

  // Synchronise l'innerHTML avec `value` UNIQUEMENT si le DOM en diffère réellement
  // (sinon on réécrirait le contenu à chaque frappe et on perdrait le curseur).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (domToMarkup(el) !== value) el.innerHTML = markupToHtml(value)
  }, [value])

  // Mémorise la sélection tant qu'elle est DANS l'éditeur (pour la restaurer quand la
  // pipette de couleur vole le focus).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onSel = () => {
      const sel = window.getSelection()
      if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0)
        savedRange.current = range.cloneRange()
        // Reflète la couleur du texte à la sélection sur la pastille du parent.
        onSelColorRef.current?.(colorAt(range.startContainer, el))
      }
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const emit = useCallback(() => {
    const el = ref.current
    if (el) onChangeRef.current(domToMarkup(el))
  }, [])

  // Restaure la sélection sauvegardée ; si vide et `selectAllIfEmpty`, cible tout le contenu.
  const restoreSelection = useCallback((selectAllIfEmpty: boolean): Range | null => {
    const el = ref.current
    if (!el) return null
    el.focus()
    const sel = window.getSelection()
    if (!sel) return null
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    let range = sel.rangeCount ? sel.getRangeAt(0) : null
    if (selectAllIfEmpty && (!range || range.collapsed)) {
      range = document.createRange()
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    return range
  }, [])

  // Enrobe la sélection dans un <span> coloré (hex) ou sans couleur (null = couleur par défaut).
  const wrapColor = useCallback(
    (hex: string | null) => {
      const el = ref.current
      const range = restoreSelection(true)
      if (!el || !range || range.collapsed) return
      const frag = range.extractContents()
      unwrapColorSpans(frag) // évite les couleurs imbriquées (re-coloration propre)
      const span = document.createElement('span')
      if (hex) span.style.color = hex
      span.appendChild(frag)
      range.insertNode(span)
      const sel = window.getSelection()
      if (sel) {
        const nr = document.createRange()
        nr.selectNodeContents(span)
        sel.removeAllRanges()
        sel.addRange(nr)
        savedRange.current = nr.cloneRange()
      }
      emit()
    },
    [emit, restoreSelection],
  )

  const api: RichTextApi = useMemo(
    () => ({
      applyColor: (hex) => wrapColor(hex),
      resetColor: () => wrapColor(null),
      insertText: (text) => {
        const el = ref.current
        if (!el) return
        restoreSelection(false)
        document.execCommand('insertText', false, text)
        emit()
      },
    }),
    [wrapColor, restoreSelection, emit],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Entrée → vrai saut de ligne `\n` (au lieu des <div>/<br> du navigateur).
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertText', false, '\n')
    }
  }
  const onPaste = (e: React.ClipboardEvent) => {
    // Collage en texte BRUT (on ne veut pas d'HTML importé dans le champ).
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={() => {
          onActivate?.(api)
          onFocus?.()
        }}
        style={{ backgroundColor: bg, color: defaultColor }}
        className={`rounded-lg border border-black/15 px-3 py-2 text-sm outline-none transition focus:border-amber-400 ${minHeightClass} whitespace-pre-wrap break-words ${className}`}
      />
      {!value && placeholder && (
        <div
          style={{ color: defaultColor }}
          className="pointer-events-none absolute left-3 top-2 text-sm opacity-50"
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}
