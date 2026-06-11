import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { slendermanCards } from '../villains/slenderman.cards'
import { buildDeck } from '../types'

describe('cartes de Slenderman — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(slendermanCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(slendermanCards, 'fate')).toHaveLength(15)
  })

  it('8 Pages (objectif)', () => {
    const page = slendermanCards.find((c) => c.id === 'page')
    expect(page?.copies).toBe(8)
    expect(page?.type).toBe('item')
    expect(page?.attach).toBe('location')
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of slendermanCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/slenderman\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of slendermanCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
