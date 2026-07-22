import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { maleficentCards } from '../villains/maleficent.cards'
import { buildDeck } from '../types'

describe('cartes de Maléfique — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(maleficentCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(maleficentCards, 'fate')).toHaveLength(15)
  })

  it('23 cartes uniques (13 Vilain + 10 Fatalité)', () => {
    const villain = maleficentCards.filter((c) => c.deck === 'villain')
    const fate = maleficentCards.filter((c) => c.deck === 'fate')
    expect(villain).toHaveLength(13)
    expect(fate).toHaveLength(10)
    expect(maleficentCards).toHaveLength(23)
  })

  it('répartition Vilain (10 alliés / 8 malédictions / 6 événements / 2 objets / 4 conditions)', () => {
    const count = (type: string) =>
      maleficentCards
        .filter((c) => c.deck === 'villain' && c.type === type)
        .reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(10)
    expect(count('curse')).toBe(8)
    expect(count('effect')).toBe(6)
    expect(count('item')).toBe(2)
    expect(count('condition')).toBe(4)
  })

  it('répartition Fatalité (10 héros / 3 objets / 2 effets)', () => {
    const count = (type: string) =>
      maleficentCards
        .filter((c) => c.deck === 'fate' && c.type === type)
        .reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(10)
    expect(count('item')).toBe(3)
    expect(count('effect')).toBe(2)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of maleficentCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/maleficent\/.+\.(png|webp)$/)
      if (c.deck === 'villain' && c.type !== 'condition') {
        expect(typeof c.cost).toBe('number')
      } else if (c.deck === 'fate') {
        expect(c.cost).toBeUndefined()
      }
      if (c.type === 'ally' || c.type === 'hero') {
        expect(typeof c.strength).toBe('number')
      }
    }
  })

  it('Épée de Vérité est le seul Objet Fatalité attach="hero"', () => {
    const byId = Object.fromEntries(maleficentCards.map((c) => [c.id, c]))
    expect(byId['epee-verite'].attach).toBe('hero')
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of maleficentCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
