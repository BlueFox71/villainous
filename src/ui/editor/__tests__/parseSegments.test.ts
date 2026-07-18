import { describe, it, expect } from 'vitest'
import { parseSegments } from '../cardRender'

describe('parseSegments — marqueur d’italique `_`', () => {
  it('un mot enrobé de `_` est entièrement en italique', () => {
    const { segs, italic } = parseSegments('_italique_')
    expect(segs).toEqual([{ text: 'italique', italic: true }])
    expect(italic).toBe(false) // état refermé
  })

  it('texte normal → segment non italique', () => {
    const { segs, italic } = parseSegments('normal')
    expect(segs).toEqual([{ text: 'normal', italic: false }])
    expect(italic).toBe(false)
  })

  it('italique s’étend sur plusieurs mots via l’état renvoyé', () => {
    // « _deux mots_ » : le premier ouvre, le second ferme.
    const first = parseSegments('_deux', false)
    expect(first.segs).toEqual([{ text: 'deux', italic: true }])
    expect(first.italic).toBe(true)

    const second = parseSegments('mots_', first.italic)
    expect(second.segs).toEqual([{ text: 'mots', italic: true }])
    expect(second.italic).toBe(false)
  })

  it('italique partiel à l’intérieur d’un mot', () => {
    const { segs } = parseSegments('pré_fixe_suite')
    expect(segs).toEqual([
      { text: 'pré', italic: false },
      { text: 'fixe', italic: true },
      { text: 'suite', italic: false },
    ])
  })

  it('coexiste avec les jetons d’action', () => {
    const { segs } = parseSegments('_[activer]_')
    // Le `_` ouvrant puis fermant encadre l'icône ; aucun segment texte visible.
    expect(segs.some((s) => 'icon' in s)).toBe(true)
    expect(segs.filter((s) => 'text' in s)).toEqual([])
  })

  it('un mot fait uniquement de `_` ne produit aucun segment mais bascule l’état', () => {
    const { segs, italic } = parseSegments('_', false)
    expect(segs).toEqual([])
    expect(italic).toBe(true)
  })
})

describe('parseSegments — marqueur de couleur `{c:#…}` … `{/c}`', () => {
  it('colore un mot enrobé de marqueurs', () => {
    const { segs, color } = parseSegments('{c:#ff0000}rouge{/c}')
    expect(segs).toEqual([{ text: 'rouge', italic: false, color: '#ff0000' }])
    expect(color).toBeUndefined() // couleur refermée
  })

  it('la couleur s’étend sur plusieurs mots via l’état renvoyé', () => {
    const first = parseSegments('{c:#00ff00}deux')
    expect(first.segs).toEqual([{ text: 'deux', italic: false, color: '#00ff00' }])
    expect(first.color).toBe('#00ff00')

    const second = parseSegments('mots{/c}', first.italic, first.color)
    expect(second.segs).toEqual([{ text: 'mots', italic: false, color: '#00ff00' }])
    expect(second.color).toBeUndefined()
  })

  it('couleur partielle à l’intérieur d’un mot', () => {
    const { segs } = parseSegments('pré{c:#123456}fixe{/c}suite')
    expect(segs).toEqual([
      { text: 'pré', italic: false },
      { text: 'fixe', italic: false, color: '#123456' },
      { text: 'suite', italic: false },
    ])
  })

  it('couleur et italique se combinent', () => {
    const { segs } = parseSegments('{c:#abcdef}_mot_{/c}')
    expect(segs).toEqual([{ text: 'mot', italic: true, color: '#abcdef' }])
  })
})
