import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { gastonCards } from '../villains/gaston.cards'
import { gaston } from '../villains/gaston'
import { buildDeck } from '../types'

describe('cartes de Gaston — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(gastonCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(gastonCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 7 Alliés, 2 Objets, 3 Conditions, 18 Événements', () => {
    const v = gastonCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(7)
    expect(count('item')).toBe(2)
    expect(count('condition')).toBe(3)
    expect(count('effect')).toBe(18)
  })

  it('répartition Fatalité : 6 Héros, 1 Objet, 8 Événements', () => {
    const f = gastonCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(6)
    expect(count('item')).toBe(1)
    expect(count('effect')).toBe(8)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of gastonCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/gaston\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of gastonCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion, dos de cartes et jeton Obstacle existent dans public/', () => {
    for (const path of [gaston.boardImage, gaston.pawnImage, gaston.backVillainImage, gaston.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
    expect(existsSync('public/cards/gaston/obstacle.webp')).toBe(true)
  })

  it('mise en place : 2 Obstacles par lieu (8 au total)', () => {
    expect(gaston.startingObstacles).toBe(2)
    expect(gaston.locations).toHaveLength(4)
  })

  it('objectif : retirer tous les Obstacles', () => {
    expect(gaston.objective).toEqual({ type: 'REMOVE_ALL_OBSTACLES' })
  })
})
