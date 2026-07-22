import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { scarCards } from '../villains/scar.cards'
import { buildDeck } from '../types'

describe('cartes de Scar — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(scarCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(scarCards, 'fate')).toHaveLength(15)
  })

  it('8 Héros Fatalité, dont Mufasa (force 6, cible de la pile Succession)', () => {
    const heroes = scarCards.filter((c) => c.deck === 'fate' && c.type === 'hero')
    expect(heroes).toHaveLength(8)
    expect(scarCards.find((c) => c.id === 'mufasa')?.strength).toBe(6)
  })

  it('Rafiki doit être éliminé en premier', () => {
    expect(scarCards.find((c) => c.id === 'rafiki')?.mustDefeatFirst).toBe(true)
  })

  it('les Hyènes sont taguées (Hyène affamée ×6 + Banzaï, Ed, Shenzi)', () => {
    const hyenas = scarCards.filter((c) => c.isHyena).map((c) => c.id).sort()
    expect(hyenas).toEqual(['banzai', 'ed', 'hyene-affamee', 'shenzi'])
    expect(scarCards.find((c) => c.id === 'hyene-affamee')?.copies).toBe(6)
  })

  it('Vision confère +3 à un Héros (Objet associé)', () => {
    const v = scarCards.find((c) => c.id === 'vision')
    expect(v?.type).toBe('item')
    expect(v?.attach).toBe('hero')
    expect(v?.attachStrengthBonus).toBe(3)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of scarCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/scar\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of scarCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
