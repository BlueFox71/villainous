import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { madameTremaineCards } from '../villains/madameTremaine.cards'
import { madameTremaine } from '../villains/madameTremaine'
import { buildDeck } from '../types'

describe('cartes de Madame de Trémaine — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(madameTremaineCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(madameTremaineCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 5 Alliés, 4 Objets, 6 Conditions, 15 Événements', () => {
    const v = madameTremaineCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(5)
    expect(count('item')).toBe(4)
    expect(count('condition')).toBe(6)
    expect(count('effect')).toBe(15)
  })

  it('répartition Fatalité : 7 Héros (Prince compris), 2 Objets, 6 Événements', () => {
    const f = madameTremaineCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(7)
    expect(count('item')).toBe(2)
    expect(count('effect')).toBe(6)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of madameTremaineCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/madame-tremaine\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of madameTremaineCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos de cartes existent dans public/', () => {
    for (const path of [
      madameTremaine.boardImage,
      madameTremaine.pawnImage,
      madameTremaine.backVillainImage,
      madameTremaine.backFateImage,
    ]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })

  it('objectif MARRY_PRINCE et Salle de Bal verrouillée au départ', () => {
    expect(madameTremaine.objective.type).toBe('MARRY_PRINCE')
    expect(madameTremaine.lockedLocationsAtStart).toContain('salle-de-bal')
    expect(madameTremaine.locations).toHaveLength(4)
  })

  it('les Alliés « en robe de bal » déclarent leur version ordinaire à remplacer', () => {
    const bgA = madameTremaineCards.find((c) => c.id === 'ball-gown-anastasia')
    const bgD = madameTremaineCards.find((c) => c.id === 'ball-gown-drizella')
    expect(bgA?.replacesCardId).toBe('anastasia')
    expect(bgD?.replacesCardId).toBe('drizella')
  })
})
