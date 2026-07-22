import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { seigneurTenebresCards } from '../villains/seigneurTenebres.cards'
import { seigneurTenebres } from '../villains/seigneurTenebres'
import { buildDeck } from '../types'

describe('cartes du Seigneur des Ténèbres — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(seigneurTenebresCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(seigneurTenebresCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 12 Alliés, 5 Objets, 2 Conditions, 11 Événements', () => {
    const v = seigneurTenebresCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(12)
    expect(count('item')).toBe(5)
    expect(count('condition')).toBe(2)
    expect(count('effect')).toBe(11)
  })

  it('répartition Fatalité : 8 Héros, 1 Objet, 6 Événements', () => {
    const f = seigneurTenebresCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(8)
    expect(count('item')).toBe(1)
    expect(count('effect')).toBe(6)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of seigneurTenebresCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName!.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/seigneur-tenebres\/.+\.(png|webp)$/)
      if (c.deck === 'villain' && c.type !== 'condition') expect(typeof c.cost).toBe('number')
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('objectif : un Mort-vivant du Chaudron sur chaque lieu (4 lieux)', () => {
    expect(seigneurTenebres.objective).toEqual({ type: 'CAULDRON_BORN_EVERYWHERE' })
    expect(seigneurTenebres.locations).toHaveLength(4)
  })

  it('le Soldat Ressuscité exige le Chaudron Magique réveillé', () => {
    const cb = seigneurTenebresCards.find((c) => c.id === 'cauldron-born')!
    expect(cb.requiresPoweredCauldron).toBe(true)
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of seigneurTenebresCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos de cartes existent dans public/', () => {
    for (const path of [seigneurTenebres.boardImage, seigneurTenebres.pawnImage, seigneurTenebres.backVillainImage, seigneurTenebres.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })
})
