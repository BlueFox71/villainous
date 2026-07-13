import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { thanosCards } from '../villains/thanos.cards'
import { buildDeck } from '../types'

describe('cartes de Thanos — intégrité du paquet', () => {
  it('le deck Méchant totalise 36 cartes brutes (30 jouables + 6 Pierres hors deck)', () => {
    expect(buildDeck(thanosCards, 'villain')).toHaveLength(36)
  })

  it('6 PIERRES D’INFINITÉ (hors deck), donc 30 cartes Méchant jouables', () => {
    const stones = thanosCards.filter((c) => c.isInfinityStone)
    expect(stones.reduce((n, c) => n + c.copies, 0)).toBe(6)
    for (const s of stones) {
      expect(s.type).toBe('item')
      expect(s.deck).toBe('villain')
      expect(s.activatedCost).toBe(0)
    }
    const playable = buildDeck(thanosCards, 'villain').filter((c) => !c.isInfinityStone)
    expect(playable).toHaveLength(30)
  })

  it('le deck Fatalité totalise 10 cartes', () => {
    expect(buildDeck(thanosCards, 'fate')).toHaveLength(10)
  })

  it('répartition Méchant jouable : 10 Alliés, 4 Objets, 16 Événements', () => {
    const v = thanosCards.filter((c) => c.deck === 'villain' && !c.isInfinityStone)
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(10)
    expect(count('item')).toBe(4)
    expect(count('effect')).toBe(16)
  })

  it('répartition Fatalité : 4 Héros, 6 Événements', () => {
    const f = thanosCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(4)
    expect(count('effect')).toBe(6)
  })

  it('Adam Warlock (verrou de victoire) et Drax (2 Alliés) sont bien réglés', () => {
    expect(thanosCards.find((c) => c.id === 'adam-warlock')?.strength).toBe(6)
    expect(thanosCards.find((c) => c.id === 'drax-le-destructeur')?.minAlliesToVanquish).toBe(2)
  })

  it('Le Titan Fou a un coût variable (= force de la cible)', () => {
    const t = thanosCards.find((c) => c.id === 'le-titan-fou')
    expect(t?.costVariable).toBe(true)
    expect(t?.costEqualsTargetStrength).toBe(true)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of thanosCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/thanos\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of thanosCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
