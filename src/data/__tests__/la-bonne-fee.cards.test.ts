import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { laBonneFeeCards } from '../villains/la-bonne-fee.cards'
import { buildDeck } from '../types'

describe('cartes de La Bonne Fée — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(laBonneFeeCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(laBonneFeeCards, 'fate')).toHaveLength(15)
  })

  it('les 6 héros de Shrek sont des Héros Fatalité', () => {
    for (const id of ['shrek', 'fiona', 'ane', 'chat', 'parents', 'creatures']) {
      const c = laBonneFeeCards.find((x) => x.id === id)
      expect(c?.deck).toBe('fate')
      expect(c?.type).toBe('hero')
      expect(typeof c?.strength).toBe('number')
    }
  })

  it('Shrek (bloqueur de l’objectif) est un Héros de force 5', () => {
    const shrek = laBonneFeeCards.find((c) => c.id === 'shrek')
    expect(shrek?.type).toBe('hero')
    expect(shrek?.strength).toBe(5)
  })

  it('Fiona (cible de l’objectif) est jouée dès qu’elle est dévoilée', () => {
    const fiona = laBonneFeeCards.find((c) => c.id === 'fiona')
    expect(fiona?.deck).toBe('fate')
    expect(fiona?.playWhenRevealed).toBe(true)
  })

  it('les 2 potions et le Prince Charmant (objectif) sont dans le deck Méchant', () => {
    for (const id of ['filtre', 'heureux', 'prince', 'embrasser']) {
      const c = laBonneFeeCards.find((x) => x.id === id)
      expect(c?.deck).toBe('villain')
    }
    // Les potions s'associent à un Héros (Fiona).
    expect(laBonneFeeCards.find((c) => c.id === 'filtre')?.attach).toBe('hero')
    expect(laBonneFeeCards.find((c) => c.id === 'heureux')?.attach).toBe('hero')
    // Prince Charmant = Allié.
    expect(laBonneFeeCards.find((c) => c.id === 'prince')?.type).toBe('ally')
  })

  it('les transformations (Meuble / Colombe) s’associent à un Héros', () => {
    for (const id of ['meuble', 'colombe']) {
      const c = laBonneFeeCards.find((x) => x.id === id)
      expect(c?.type).toBe('item')
      expect(c?.attach).toBe('hero')
      expect(c?.copies).toBe(3)
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of laBonneFeeCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/la-bonne-fee\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of laBonneFeeCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
