import { describe, it, expect } from 'vitest'
import { mergeGameData, type CustomVillain } from '../customVillain'

// mergeGameData ne lit qu'une poignée de champs : on fabrique des stubs minimaux typés en dur.
function villainWith(cards: Array<Record<string, unknown>>): CustomVillain {
  return { id: 'custom-x', updatedAt: '2026-01-01T00:00:00Z', cards } as unknown as CustomVillain
}

describe('mergeGameData — synchro des données de jeu (export allégé → brouillon)', () => {
  it('importe les effets développés SANS écraser le texte humain édité dans l’Atelier', () => {
    // Brouillon : le joueur a reformulé le texte APRÈS l'export.
    const draft = villainWith([{ id: 'c1', text: 'Capturez 2 esprits.', effects: [] }])
    // Export allégé (instantané plus ancien) : ancien texte + effets développés par Claude.
    const light = {
      cards: [{ id: 'c1', text: 'Capturez le nombre d’esprits de votre camp', effects: [{ kind: 'CAPTURE' }] }],
    } as unknown as Partial<CustomVillain>

    const merged = mergeGameData(draft, light)
    const card = (merged.cards as Array<Record<string, unknown>>)[0]
    expect(card.text).toBe('Capturez 2 esprits.') // texte du joueur préservé
    expect(card.effects).toEqual([{ kind: 'CAPTURE' }]) // effets bien importés
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
})
