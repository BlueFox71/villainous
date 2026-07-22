import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { ratiganCards } from '../villains/ratigan.cards'
import { buildDeck } from '../types'

describe('cartes de Ratigan — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(ratiganCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(ratiganCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 6 Alliés, 4 Conditions, 5 Événements, 15 Objets', () => {
    const v = ratiganCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(6)
    expect(count('condition')).toBe(4)
    expect(count('effect')).toBe(5)
    expect(count('item')).toBe(15)
  })

  it('répartition Fatalité : 10 Héros, 4 Événements, 1 Objet', () => {
    const f = ratiganCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(10)
    expect(count('effect')).toBe(4)
    expect(count('item')).toBe(1)
  })

  it('la Reine Robot coûte 15 et se joue sur le Repaire secret', () => {
    const rr = ratiganCards.find((c) => c.id === 'reine-robot')
    expect(rr?.type).toBe('item')
    expect(rr?.cost).toBe(15)
    expect(rr?.playOnlyAt).toBe('repaire-secret')
  })

  it('les Gardes de la Reine ne se posent que sur Buckingham Palace (×3)', () => {
    const g = ratiganCards.find((c) => c.id === 'gardes-de-la-reine')
    expect(g?.forcedFateLocation).toBe('buckingham-palace')
    expect(g?.copies).toBe(3)
  })

  it('Uniforme confère +2 à un Allié (Objet associé)', () => {
    const u = ratiganCards.find((c) => c.id === 'uniforme')
    expect(u?.attach).toBe('ally')
    expect(u?.attachStrengthBonus).toBe(2)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of ratiganCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/ratigan\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of ratiganCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
