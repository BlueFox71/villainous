import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { reineCoeurCards } from '../villains/reineCoeur.cards'
import { buildDeck } from '../types'

describe('cartes de la Reine de Cœur — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(reineCoeurCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(reineCoeurCards, 'fate')).toHaveLength(15)
  })

  it('les 4 enseignes de Cartes Gardes sont présentes', () => {
    for (const suit of ['carreau', 'trefle', 'coeur', 'pique']) {
      const c = reineCoeurCards.find((x) => x.id === `gardes-${suit}`)
      expect(c?.type, suit).toBe('ally')
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of reineCoeurCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/reine-coeur\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of reineCoeurCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
