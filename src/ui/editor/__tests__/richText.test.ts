import { describe, it, expect } from 'vitest'
import { markupToHtml, cssColorToHex } from '../richText'

// NB : `domToMarkup` dépend du DOM (contenteditable) et n'est pas couvert ici — les
// tests tournent en environnement `node` (pas de jsdom dans le projet). Il est exercé
// à la main dans l'Atelier. On teste ici les conversions PURES sur chaînes.

describe('richText — markupToHtml', () => {
  it('texte simple sans couleur reste littéral (échappé)', () => {
    expect(markupToHtml('Gagnez 2 <pouvoir>')).toBe('Gagnez 2 &lt;pouvoir&gt;')
  })

  it('portion colorée → span', () => {
    expect(markupToHtml('a{c:#ff0000}rouge{/c}b')).toBe('a<span style="color:#ff0000">rouge</span>b')
  })

  it('la couleur conserve les sauts de ligne (pas de <br>)', () => {
    expect(markupToHtml('{c:#00ff00}L1\nL2{/c}')).toBe('<span style="color:#00ff00">L1\nL2</span>')
  })

  it('les marqueurs _italique_ et [jetons] restent littéraux', () => {
    expect(markupToHtml('_a_ [activer]')).toBe('_a_ [activer]')
  })

  it('exemple multi-couleurs multi-lignes', () => {
    const markup = '{c:#9b9e00}Capturez.\n{/c}{c:#590626}Perdez.{/c}'
    expect(markupToHtml(markup)).toBe(
      '<span style="color:#9b9e00">Capturez.\n</span><span style="color:#590626">Perdez.</span>',
    )
  })
})

describe('richText — cssColorToHex', () => {
  it('rgb(...) → #rrggbb', () => {
    expect(cssColorToHex('rgb(255, 0, 128)')).toBe('#ff0080')
  })
  it('#abc → #aabbcc', () => {
    expect(cssColorToHex('#abc')).toBe('#aabbcc')
  })
  it('#AABBCC → minuscule', () => {
    expect(cssColorToHex('#AABBCC')).toBe('#aabbcc')
  })
  it('vide / inconnu → undefined', () => {
    expect(cssColorToHex('')).toBeUndefined()
    expect(cssColorToHex(null)).toBeUndefined()
    expect(cssColorToHex('transparent')).toBeUndefined()
  })
})
