import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { bowserCards } from '../villains/bowser.cards'
import { buildDeck } from '../types'

describe('cartes de Bowser — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(bowserCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(bowserCards, 'fate')).toHaveLength(15)
  })

  it('5 Héros Fatalité, dont Mario (bloqueur) et Peach (cible de capture)', () => {
    const heroes = bowserCards.filter((c) => c.deck === 'fate' && c.type === 'hero')
    expect(heroes).toHaveLength(5)
    expect(bowserCards.find((c) => c.id === 'mario')?.strength).toBe(4)
    expect(bowserCards.find((c) => c.id === 'peach')?.strength).toBe(2)
  })

  it('Impuissance (seule voie de capture de Peach) est présente ×2', () => {
    const imp = bowserCards.find((c) => c.id === 'impuissance')
    expect(imp?.copies).toBe(2)
    expect(imp?.deck).toBe('villain')
  })

  it('épuisement d\'énergie (drainage des Étoiles) est présent ×4', () => {
    expect(bowserCards.find((c) => c.id === 'puissance-stellaire')?.copies).toBe(4)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of bowserCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/bowser\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of bowserCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
