import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { jafarCards } from '../villains/jafar.cards'
import { buildDeck } from '../types'

describe('cartes de Jafar — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(jafarCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(jafarCards, 'fate')).toHaveLength(15)
  })

  it('la Lampe Merveilleuse invoque le Génie (cœur de l’objectif)', () => {
    const lampe = jafarCards.find((c) => c.id === 'lampe-merveilleuse')
    expect(lampe?.type).toBe('item')
    expect(lampe?.effects).toContainEqual({
      type: 'SUMMON_FATE_HERO_TO_OWN_REALM',
      heroCardId: 'genie',
      locationId: 'caverne',
    })
    expect(jafarCards.some((c) => c.id === 'genie' && c.deck === 'fate')).toBe(true)
  })

  it('le Scarabée d’Or déverrouille la Caverne aux Merveilles', () => {
    const scarabee = jafarCards.find((c) => c.id === 'scarabee-or')
    expect(scarabee?.effects).toContainEqual({ type: 'UNLOCK_LOCATION', locationId: 'caverne' })
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of jafarCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/jafar\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of jafarCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
