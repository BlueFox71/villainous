import { describe, it, expect } from 'vitest'
import { externalizeVillainImages } from '../imageExternalize.mjs'

const PNG = 'data:image/png;base64,QUJD' // "ABC"
const JPG = 'data:image/jpeg;base64,REVG' // "DEF"

const villain = () => ({
  id: 'custom-test',
  updatedAt: '2026-07-11T00:00:00.000Z',
  portrait: PNG,
  presentation: JPG,
  portraitRaw: JPG,
  boardImage: PNG,
  boardArt: PNG,
  altBoardImage: JPG,
  pawnImage: PNG,
  backVillainImage: PNG,
  backFateImage: PNG,
  backExtraImage: JPG,
  audio: 'data:audio/mpeg;base64,QQ==',
  // Empreinte d'éditeur (calculée sur les data-URLs) : ne doit pas suivre dans la copie publiée.
  boardSig: '{"art":"UklGRhilAQBXRUJQVlA4WAoAA#143767"}',
  backOverlays: [{ image: PNG }, { image: JPG }],
  backExtra: { overlays: [{ image: PNG }] },
  locations: [
    {
      id: 'loc-a',
      image: PNG,
      // Icône importée d'une action « Personnalisée » (l'autre action n'en a pas).
      actions: [{ id: 'obtain-key', iconImage: PNG }, { id: 'gain-power' }],
      alt: { image: JPG, columnImage: PNG, actions: [{ id: 'obtain-key', iconImage: JPG }] },
    },
  ],
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
    // Champs utilisés par les vilains publiés (revue Task 1) : portraitRaw,
    // altBoardImage, backExtraImage, backOverlays[i], backExtra.overlays[i].
    expect(out.portraitRaw).toBe('/cards/custom-test/portrait-raw.jpg?v=1783728000000')
    expect(out.altBoardImage).toBe('/cards/custom-test/board-alt.jpg?v=1783728000000')
    expect(out.backExtraImage).toBe('/cards/custom-test/back-extra.jpg?v=1783728000000')
    expect(out.backOverlays[0].image).toBe('/cards/custom-test/back-overlay-0.png?v=1783728000000')
    expect(out.backOverlays[1].image).toBe('/cards/custom-test/back-overlay-1.jpg?v=1783728000000')
    expect(out.backExtra.overlays[0].image).toBe('/cards/custom-test/back-extra-overlay-0.png?v=1783728000000')
    // Icônes d'action importées (face A et face B du lieu).
    expect(out.locations[0].actions[0].iconImage).toBe('/cards/custom-test/loc-loc-a.act-obtain-key.png?v=1783728000000')
    expect(out.locations[0].actions[1].iconImage).toBeUndefined()
    expect(out.locations[0].alt.actions[0].iconImage).toBe('/cards/custom-test/loc-loc-a.alt.act-obtain-key.jpg?v=1783728000000')
    // Empreinte du plateau retirée : périmée hors éditeur, et porteuse de bribes de base64.
    expect(out.boardSig).toBeUndefined()
    // un fichier par image (11 top + 2 backOverlays + 1 backExtra.overlay + 3 loc
    // + 2 icônes d'action + 3 cartes = 22)
    expect(files.length).toBe(22)
    const p = files.find((f) => f.path === 'cards/custom-test/portrait.png')
    expect(p).toEqual({ path: 'cards/custom-test/portrait.png', base64: 'QUJD', mime: 'image/png' })
    // Chaque nouveau champ produit bien un fichier avec le bon path relatif.
    expect(files.find((f) => f.path === 'cards/custom-test/portrait-raw.jpg')).toBeDefined()
    expect(files.find((f) => f.path === 'cards/custom-test/board-alt.jpg')).toBeDefined()
    expect(files.find((f) => f.path === 'cards/custom-test/back-extra.jpg')).toBeDefined()
    expect(files.find((f) => f.path === 'cards/custom-test/back-overlay-0.png')).toBeDefined()
    expect(files.find((f) => f.path === 'cards/custom-test/back-overlay-1.jpg')).toBeDefined()
    expect(files.find((f) => f.path === 'cards/custom-test/back-extra-overlay-0.png')).toBeDefined()
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
