import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { sombraCards } from '../villains/sombra.cards'
import { buildDeck } from '../types'

describe('cartes de Sombra — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(sombraCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(sombraCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 10 Objets, 2 Alliés, 15 Événements, 3 Conditions', () => {
    const v = sombraCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('item')).toBe(10)
    expect(count('ally')).toBe(2)
    expect(count('effect')).toBe(15)
    expect(count('condition')).toBe(3)
  })

  it('répartition Fatalité : 6 Héros, 9 Événements', () => {
    const f = sombraCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(6)
    expect(count('effect')).toBe(9)
  })

  it('6 cartes de Piratage (Piratage ×4 + IEM ×2), toutes des Objets', () => {
    const pir = sombraCards.filter((c) => c.isPiratage)
    expect(pir.reduce((n, c) => n + c.copies, 0)).toBe(6)
    for (const c of pir) expect(c.type).toBe('item')
    // Seul le Piratage désactive une action (pas l'IEM).
    expect(sombraCards.find((c) => c.id === 'piratage')?.hackDisablesAction).toBe(true)
    expect(sombraCards.find((c) => c.id === 'iem')?.hackDisablesAction).toBeUndefined()
  })

  it('Protocole Sombra est la carte de victoire (Événement ×2)', () => {
    const p = sombraCards.find((c) => c.id === 'protocole-sombra')
    expect(p?.type).toBe('effect')
    expect(p?.copies).toBe(2)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of sombraCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/sombra\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of sombraCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
