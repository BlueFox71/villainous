import { describe, it, expect } from 'vitest'
import { isPreRenderedCard } from '../cardRender'
import type { CustomCard } from '../../../data/customVillain'

// `renderCardFace` ne dessine l'illustration QUE depuis `artImage` (l'art brut) : une carte
// sans `artImage` recomposée perd son illustration. `isPreRenderedCard` détecte ce cas pour
// que l'éditeur affiche à la place l'`image` déjà finie (composite baké) plutôt que de la
// recomposer à vide.
const card = (p: Partial<CustomCard>): CustomCard =>
  ({ id: 'x', name: 'X', deck: 'villain', type: 'ally', copies: 1, text: '', ...p }) as CustomCard

describe('isPreRenderedCard', () => {
  it('carte avec art brut (artImage) → recomposable, PAS pré-rendue', () => {
    expect(isPreRenderedCard(card({ artImage: 'data:image/png;base64,AAA', image: 'data:image/png;base64,BBB' }))).toBe(false)
  })

  it('carte bakée sans art brut, image en dataURL (ex. Dio compressé) → pré-rendue', () => {
    // Régression : le composite baké est la seule représentation ; il faut l'afficher tel quel.
    expect(isPreRenderedCard(card({ image: 'data:image/png;base64,BBB' }))).toBe(true)
  })

  it('carte migrée dont l’image est un chemin externe (sans art brut) → pré-rendue', () => {
    expect(isPreRenderedCard(card({ image: '/cards/flagelleur/xxx.png' }))).toBe(true)
  })

  it('carte vierge (ni art brut ni image) → PAS pré-rendue (on compose la face)', () => {
    expect(isPreRenderedCard(card({}))).toBe(false)
  })
})
