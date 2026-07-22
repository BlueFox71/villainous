import { describe, it, expect } from 'vitest'
import { mergeGameData, type CustomVillain } from '../customVillain'

// mergeGameData ne lit qu'une poignée de champs : on fabrique des stubs minimaux typés en dur.
function villainWith(cards: Array<Record<string, unknown>>): CustomVillain {
  return { id: 'custom-x', updatedAt: '2026-01-01T00:00:00Z', cards } as unknown as CustomVillain
}

describe('mergeGameData — synchro des données de jeu (export allégé → brouillon)', () => {
  it('importe les effets ET le texte depuis l’export allégé', () => {
    const draft = villainWith([{ id: 'c1', text: 'Ancien texte du brouillon.', effects: [] }])
    // Export allégé : nouveau texte + effets développés.
    const light = {
      cards: [{ id: 'c1', text: 'Capturez le nombre d’esprits de votre camp', effects: [{ kind: 'CAPTURE' }] }],
    } as unknown as Partial<CustomVillain>

    const merged = mergeGameData(draft, light)
    const card = (merged.cards as Array<Record<string, unknown>>)[0]
    expect(card.text).toBe('Capturez le nombre d’esprits de votre camp') // texte réécrit par la synchro
    expect(card.effects).toEqual([{ kind: 'CAPTURE' }]) // effets bien importés
  })

  it('ne vide pas le texte du brouillon si l’export n’en fournit pas', () => {
    const draft = villainWith([{ id: 'c1', text: 'Texte conservé.', effects: [] }])
    const light = { cards: [{ id: 'c1', effects: [{ kind: 'X' }] }] } as unknown as Partial<CustomVillain>
    const merged = mergeGameData(draft, light)
    const card = (merged.cards as Array<Record<string, unknown>>)[0]
    expect(card.text).toBe('Texte conservé.')
  })

  it('ne réécrit pas les images de la carte', () => {
    const draft = villainWith([{ id: 'c1', image: 'BAKED', artImage: 'ART', effects: [] }])
    const light = {
      cards: [{ id: 'c1', image: 'STALE', artImage: 'STALE', effects: [{ kind: 'X' }] }],
    } as unknown as Partial<CustomVillain>

    const merged = mergeGameData(draft, light)
    const card = (merged.cards as Array<Record<string, unknown>>)[0]
    expect(card.image).toBe('BAKED')
    expect(card.artImage).toBe('ART')
  })

  it('réinjecte la Défense des lieux (Sumbra/Kilaire : donnée de conquête)', () => {
    const draft = {
      id: 'custom-x',
      updatedAt: '2026-01-01T00:00:00Z',
      cards: [],
      locations: [
        { id: 'loc-1', name: 'A', actions: [] },
        { id: 'loc-3', name: 'B', actions: [], alt: { name: 'B2' } },
      ],
    } as unknown as CustomVillain
    const light = {
      locations: [
        { id: 'loc-1' },
        { id: 'loc-3', defense: 4 },
      ],
    } as unknown as Partial<CustomVillain>

    const merged = mergeGameData(draft, light)
    const locs = merged.locations as Array<Record<string, unknown>>
    expect(locs[0].defense).toBeUndefined() // lieu-home : pas de Défense
    expect(locs[1].defense).toBe(4) // lieu conquérable : Défense réinjectée
  })
})
