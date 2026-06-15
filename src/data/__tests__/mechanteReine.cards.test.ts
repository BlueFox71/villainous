import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { mechanteReineCards } from '../villains/mechanteReine.cards'
import { buildDeck } from '../types'

describe('cartes de la Méchante Reine — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(mechanteReineCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(mechanteReineCards, 'fate')).toHaveLength(15)
  })

  it('les 4 Ingrédients différents sont présents (8 exemplaires)', () => {
    const ing = mechanteReineCards.filter((c) => c.type === 'ingredient')
    expect(ing.map((c) => c.id).sort()).toEqual(
      ['caquet-megere', 'hurlement-effroi', 'noir-de-nuit', 'poussiere-momie'].sort(),
    )
    expect(buildDeck(mechanteReineCards, 'villain').filter((c) => c.type === 'ingredient')).toHaveLength(8)
  })

  it('8 Héros Fatalité (les 7 Nains + Blanche-Neige), Blanche-Neige = cible de l’objectif', () => {
    const heroes = mechanteReineCards.filter((c) => c.deck === 'fate' && c.type === 'hero')
    expect(heroes).toHaveLength(8)
    expect(mechanteReineCards.find((c) => c.id === 'blanche-neige')?.strength).toBe(1)
  })

  it('« Croque ! » (élimination par Poison) est présent ×5', () => {
    expect(mechanteReineCards.find((c) => c.id === 'croque')?.copies).toBe(5)
  })

  it('le Miroir magique et les Objets activables portent un coût d’activation', () => {
    for (const id of ['miroir-magique', 'trone', 'ecrin', 'grimoires-magiques']) {
      expect(typeof mechanteReineCards.find((c) => c.id === id)?.activatedCost).toBe('number')
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of mechanteReineCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/mechante-reine\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of mechanteReineCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
