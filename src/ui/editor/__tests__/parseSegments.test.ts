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
