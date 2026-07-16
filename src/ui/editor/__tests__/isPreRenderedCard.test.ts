import { describe, it, expect } from 'vitest'
import { isPreRenderedCard, isExternalImage } from '../cardRender'
import type { CustomCard } from '../../../data/customVillain'

// `renderCardFace` ne dessine l'illustration QUE depuis `artImage` (l'art brut). Une carte
// est donc « pré-rendue » (NON recomposable) uniquement si son `image` est un FICHIER externe
// pré-généré ET qu'elle n'a pas d'art brut (import compressé/migré, ex. Dio : l'illustration est
// fusionnée dans l'image). Un composite en dataURL sans art a, lui, été rendu par l'éditeur à
// partir des seules données (carte sans illustration) → recomposable, pour que toute édition
// rafraîchisse l'aperçu. `bakeVillain` conserve toujours `artImage` : aucun chemin de code
// actuel ne produit un dataURL-sans-art à illustration fusionnée.
const card = (p: Partial<CustomCard>): CustomCard =>
  ({ id: 'x', name: 'X', deck: 'villain', type: 'ally', copies: 1, text: '', ...p }) as CustomCard

describe('isPreRenderedCard', () => {
  it('carte avec art brut (artImage) → recomposable, PAS pré-rendue', () => {
    expect(isPreRenderedCard(card({ artImage: 'data:image/png;base64,AAA', image: 'data:image/png;base64,BBB' }))).toBe(false)
    expect(isPreRenderedCard(card({ artImage: '/cards/x/a.art.png', image: '/cards/x/a.png' }))).toBe(false)
  })

  it('image en dataURL sans art brut → recomposable (rendue par l’éditeur, sans illustration)', () => {
    // Régression corrigée : ces cartes (carte effet/texte bakée) doivent refléter les éditions.
    expect(isPreRenderedCard(card({ image: 'data:image/png;base64,BBB' }))).toBe(false)
  })

  it('image = fichier externe sans art brut → pré-rendue (import compressé/migré, ex. Dio)', () => {
    expect(isPreRenderedCard(card({ image: '/cards/custom-dio/za-warudo.png?v=1' }))).toBe(true)
  })

  it('carte vierge (ni art brut ni image) → PAS pré-rendue (on compose la face)', () => {
    expect(isPreRenderedCard(card({}))).toBe(false)
    expect(isPreRenderedCard(card({ image: '' }))).toBe(false)
  })
})

describe('isExternalImage', () => {
  it('distingue fichier/URL (externe) et dataURL (rendue en direct)', () => {
    expect(isExternalImage('/cards/x/a.png')).toBe(true)
    expect(isExternalImage('https://ex/a.png')).toBe(true)
    expect(isExternalImage('data:image/png;base64,AAAA')).toBe(false)
    expect(isExternalImage('')).toBe(false)
    expect(isExternalImage(undefined)).toBe(false)
  })
})
