import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { shereKhanCards } from '../villains/shereKhan.cards'
import { buildDeck } from '../types'

describe('cartes de Shere Khan — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(shereKhanCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(shereKhanCards, 'fate')).toHaveLength(15)
  })

  it('répartition par type (Méchant) : 8 Alliés, 2 Objets, 16 Événements, 4 Conditions', () => {
    const villain = buildDeck(shereKhanCards, 'villain')
    const count = (t: string) => villain.filter((c) => c.type === t).length
    expect(count('ally')).toBe(8)
    expect(count('item')).toBe(2)
    expect(count('effect')).toBe(16)
    expect(count('condition')).toBe(4)
  })

  it('répartition par type (Fatalité) : 7 Héros, 8 Événements', () => {
    const fate = buildDeck(shereKhanCards, 'fate')
    expect(fate.filter((c) => c.type === 'hero')).toHaveLength(7)
    expect(fate.filter((c) => c.type === 'effect')).toHaveLength(8)
  })

  it('Mowgli est le Héros-cible (force 2) et pose un jeton Feu à la pose', () => {
    const m = shereKhanCards.find((c) => c.id === 'mowgli')
    expect(m?.type).toBe('hero')
    expect(m?.strength).toBe(2)
    expect(m?.onPlace).toEqual([{ type: 'PLACE_FIRE_AT_HOST' }])
  })

  it('Baloo protège les autres Héros (bouclier à 3 jetons)', () => {
    expect(shereKhanCards.find((c) => c.id === 'baloo')?.shieldsOtherHeroesUntilTokens).toBe(3)
  })

  it('les Objets de Kaa s’associent à Kaa (+2 Force, bouclier)', () => {
    for (const id of ['anneaux-de-kaa', 'yeux-de-kaa']) {
      const o = shereKhanCards.find((c) => c.id === id)!
      expect(o.type).toBe('item')
      expect(o.attach).toBe('ally')
      expect(o.attachOnlyCardId).toBe('kaa')
      expect(o.attachStrengthBonus).toBe(2)
      expect(o.shieldAllyFromDiscard).toBe(true)
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of shereKhanCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/shere-khan\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of shereKhanCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
