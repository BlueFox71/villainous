import { describe, it, expect } from 'vitest'
import { externalizeVillainImages } from '../imageExternalize.mjs'

const PNG = 'data:image/png;base64,QUJD' // "ABC"
const JPG = 'data:image/jpeg;base64,REVG' // "DEF"

const villain = () => ({
  id: 'custom-test',
  updatedAt: '2026-07-11T00:00:00.000Z',
  portrait: PNG,
  presentation: JPG,
  boardImage: PNG,
  pawnImage: PNG,
  backVillainImage: PNG,
  backFateImage: PNG,
  boardArt: PNG,
  audio: 'data:audio/mpeg;base64,QQ==',
  locations: [{ id: 'loc-a', image: PNG, alt: { image: JPG, columnImage: PNG } }],
  cards: [
    { id: 'ma-carte', image: PNG, artImage: JPG },
    { id: 'sans-art', image: PNG },
  ],
})

describe('externalizeVillainImages', () => {
  it('remplace chaque data-URL par un chemin /cards/<id>/… et liste les fichiers', () => {
    const { villain: out, files } = externalizeVillainImages(villain())
    expect(out.portrait).toBe('/cards/custom-test/portrait.png?v=1783728000000')
    expect(out.presentation).toBe('/cards/custom-test/presentation.jpg?v=1783728000000')
    expect(out.cards[0].image).toBe('/cards/custom-test/ma-carte.png?v=1783728000000')
    expect(out.cards[0].artImage).toBe('/cards/custom-test/ma-carte.art.jpg?v=1783728000000')
    expect(out.cards[1].image).toBe('/cards/custom-test/sans-art.png?v=1783728000000')
    expect(out.locations[0].image).toBe('/cards/custom-test/loc-loc-a.png?v=1783728000000')
    expect(out.locations[0].alt.image).toBe('/cards/custom-test/loc-loc-a.alt.jpg?v=1783728000000')
    expect(out.locations[0].alt.columnImage).toBe('/cards/custom-test/loc-loc-a.alt-col.png?v=1783728000000')
    expect(out.audio).toBe('/cards/custom-test/audio.mp3?v=1783728000000')
    // un fichier par image (8 top + 3 loc + 3 cartes = 14)
    expect(files.length).toBe(14)
    const p = files.find((f) => f.path === 'cards/custom-test/portrait.png')
    expect(p).toEqual({ path: 'cards/custom-test/portrait.png', base64: 'QUJD', mime: 'image/png' })
  })

  it('est idempotent : un champ déjà en chemin est laissé intact, aucun fichier produit', () => {
    const already = { id: 'custom-test', updatedAt: '2026-07-11T00:00:00.000Z',
      portrait: '/cards/custom-test/portrait.png?v=1', cards: [], locations: [] }
    const { villain: out, files } = externalizeVillainImages(already)
    expect(out.portrait).toBe('/cards/custom-test/portrait.png?v=1')
    expect(files.length).toBe(0)
  })

  it('ignore proprement les champs absents', () => {
    const min = { id: 'custom-x', updatedAt: '2026-07-11T00:00:00.000Z', cards: [], locations: [] }
    const { villain: out, files } = externalizeVillainImages(min)
    expect(files.length).toBe(0)
    expect(out.id).toBe('custom-x')
  })
})
