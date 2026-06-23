import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { saSucrerieCards } from '../villains/sa-sucrerie.cards'
import { buildDeck } from '../types'

describe('cartes de Sa Sucrerie (King Candy) — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(saSucrerieCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(saSucrerieCards, 'fate')).toHaveLength(15)
  })

  it('répartition par type (Méchant) : 9 Alliés, 4 Objets, 13 Événements, 4 Conditions', () => {
    const villain = buildDeck(saSucrerieCards, 'villain')
    const count = (t: string) => villain.filter((c) => c.type === t).length
    expect(count('ally')).toBe(9)
    expect(count('item')).toBe(4)
    expect(count('effect')).toBe(13)
    expect(count('condition')).toBe(4)
  })

  it('répartition par type (Fatalité) : 4 Héros, 11 Événements', () => {
    const fate = buildDeck(saSucrerieCards, 'fate')
    expect(fate.filter((c) => c.type === 'hero')).toHaveLength(4)
    expect(fate.filter((c) => c.type === 'effect')).toHaveLength(11)
  })

  it('le Bug (Glitch) s’associe uniquement à Vanellope et lance la course', () => {
    const bug = saSucrerieCards.find((c) => c.id === 'bug')
    expect(bug?.type).toBe('item')
    expect(bug?.attach).toBe('hero')
    expect(bug?.attachOnlyCardId).toBe('vanellope-von-schweetz')
    expect(bug?.copies).toBe(3)
    expect(bug?.effects).toEqual([{ type: 'KING_CANDY_START_RACE' }])
  })

  it('Vanellope von Schweetz est un Héros Fatalité (cible de l’objectif)', () => {
    const v = saSucrerieCards.find((c) => c.id === 'vanellope-von-schweetz')
    expect(v?.deck).toBe('fate')
    expect(v?.type).toBe('hero')
    expect(v?.strength).toBe(2)
  })

  it('Ralph la Casse est un Héros force 6', () => {
    expect(saSucrerieCards.find((c) => c.id === 'ralph-la-casse')?.strength).toBe(6)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of saSucrerieCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/sa-sucrerie\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of saSucrerieCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
