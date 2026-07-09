import { describe, it, expect } from 'vitest'
import { pickFreshestVillains, type CustomVillain } from '../customVillain'

// La fonction ne lit que `id` et `updatedAt` : on fabrique des stubs minimaux.
function v(id: string, updatedAt: string, published = false): CustomVillain {
  return { id, updatedAt, published } as unknown as CustomVillain
}

/** Retrouve un vilain par id dans une liste. */
function byId(list: CustomVillain[], id: string): CustomVillain | undefined {
  return list.find((x) => x.id === id)
}

describe('pickFreshestVillains — fusion IndexedDB / disque / embarqué', () => {
  it('à updatedAt égal, la copie IndexedDB (locale) l’emporte et n’est pas re-persistée', () => {
    const local = [v('a', '2026-01-01T00:00:00Z')]
    const restored = [v('a', '2026-01-01T00:00:00Z')]
    const { villains, toPersist } = pickFreshestVillains(local, restored, [])
    expect(villains).toHaveLength(1)
    expect(byId(villains, 'a')).toBe(local[0]) // exactement l'objet IndexedDB
    expect(toPersist).toHaveLength(0)
  })

  it('un brouillon disque STRICTEMENT plus récent remplace l’IndexedDB et est marqué à persister', () => {
    const local = [v('a', '2026-01-01T00:00:00Z')]
    const restored = [v('a', '2026-06-01T00:00:00Z')]
    const { villains, toPersist } = pickFreshestVillains(local, restored, [])
    expect(byId(villains, 'a')).toBe(restored[0])
    expect(toPersist).toEqual([restored[0]])
  })

  it('un brouillon disque d’un id absent de l’IndexedDB est adopté et persisté', () => {
    const restored = [v('b', '2026-01-01T00:00:00Z')]
    const { villains, toPersist } = pickFreshestVillains([], restored, [])
    expect(byId(villains, 'b')).toBe(restored[0])
    expect(toPersist).toEqual([restored[0]])
  })

  it('un embarqué présent UNIQUEMENT là est adopté mais PAS persisté (runtime seul)', () => {
    const bundled = [v('c', '2026-01-01T00:00:00Z', true)]
    const { villains, toPersist } = pickFreshestVillains([], [], bundled)
    expect(byId(villains, 'c')).toBe(bundled[0])
    expect(toPersist).toHaveLength(0)
  })

  it('un embarqué plus récent que l’IndexedDB local le remplace ET est persisté (édition hors navigateur)', () => {
    // Cas migration : vieux brouillon local + JSON publié plus récent → le publié gagne.
    const local = [v('d', '2026-01-01T00:00:00Z', false)]
    const bundled = [v('d', '2026-07-01T00:00:00Z', true)]
    const { villains, toPersist } = pickFreshestVillains(local, [], bundled)
    expect(byId(villains, 'd')).toBe(bundled[0])
    expect(byId(villains, 'd')?.published).toBe(true)
    expect(toPersist).toEqual([bundled[0]])
  })

  it('un embarqué plus ANCIEN que le local ne le remplace pas', () => {
    const local = [v('e', '2026-07-01T00:00:00Z', true)]
    const bundled = [v('e', '2026-01-01T00:00:00Z', true)]
    const { villains, toPersist } = pickFreshestVillains(local, [], bundled)
    expect(byId(villains, 'e')).toBe(local[0])
    expect(toPersist).toHaveLength(0)
  })

  it('trie la sortie du plus récent au plus ancien', () => {
    const local = [v('old', '2026-01-01T00:00:00Z'), v('new', '2026-09-01T00:00:00Z')]
    const { villains } = pickFreshestVillains(local, [], [])
    expect(villains.map((x) => x.id)).toEqual(['new', 'old'])
  })
})
