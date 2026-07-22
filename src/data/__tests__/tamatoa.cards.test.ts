import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { tamatoaCards } from '../villains/tamatoa.cards'
import { tamatoa } from '../villains/tamatoa'
import { buildDeck } from '../types'

describe('cartes de Tamatoa — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(tamatoaCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 25 cartes brutes (15 traditionnelles + 10 Maui)', () => {
    expect(buildDeck(tamatoaCards, 'fate')).toHaveLength(25)
  })

  it('10 cartes Maui (isMauiCard), 15 cartes Fatalité traditionnelles', () => {
    const fate = tamatoaCards.filter((c) => c.deck === 'fate')
    const maui = fate.filter((c) => c.isMauiCard).reduce((n, c) => n + c.copies, 0)
    const trad = fate.filter((c) => !c.isMauiCard).reduce((n, c) => n + c.copies, 0)
    expect(maui).toBe(10)
    expect(trad).toBe(15)
  })

  it('répartition Méchant : 7 Alliés, 1 Objet (Hameçon), 18 Événements, 4 Conditions', () => {
    const v = tamatoaCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(7)
    expect(count('item')).toBe(1)
    expect(count('effect')).toBe(18)
    expect(count('condition')).toBe(4)
  })

  it('répartition Fatalité traditionnelle : 3 Héros, 4 Objets, 8 Événements', () => {
    const f = tamatoaCards.filter((c) => c.deck === 'fate' && !c.isMauiCard)
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(3)
    expect(count('item')).toBe(4)
    expect(count('effect')).toBe(8)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of tamatoaCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/tamatoa\/.+\.(png|webp)$/)
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('objectif : Hameçon + Cœur de Te Fiti au Repaire (4 lieux)', () => {
    expect(tamatoa.objective).toEqual({
      type: 'ITEMS_AT_LOCATION',
      itemCardIds: ['hamecon-de-maui', 'coeur-de-te-fiti'],
      locationId: 'repaire-tamatoa',
    })
    expect(tamatoa.locations).toHaveLength(4)
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of tamatoaCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion, dos (Méchant/Fatalité/Maui) existent dans public/', () => {
    for (const path of [tamatoa.boardImage, tamatoa.pawnImage, tamatoa.backVillainImage, tamatoa.backFateImage, tamatoa.mauiDeckBackImage!]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })
})
