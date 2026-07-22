import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { cruellaCards } from '../villains/cruella.cards'
import { cruella } from '../villains/cruella'
import { buildDeck } from '../types'

describe('cartes de Cruella d’Enfer — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(cruellaCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(cruellaCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 2 Alliés, 6 Objets, 4 Conditions, 18 Événements', () => {
    const v = cruellaCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(2)
    expect(count('item')).toBe(6)
    expect(count('condition')).toBe(4)
    expect(count('effect')).toBe(18)
  })

  it('répartition Fatalité : 7 Héros, 8 Événements', () => {
    const f = cruellaCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(7)
    expect(count('effect')).toBe(8)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of cruellaCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/cruella\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of cruellaCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion, dos de cartes et tuiles Chiots existent dans public/', () => {
    for (const path of [cruella.boardImage, cruella.pawnImage, cruella.backVillainImage, cruella.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
    for (const loc of ['maison', 'campagne', 'laiterie', 'castel']) {
      for (const v of [11, 22]) {
        expect(existsSync(`public/cards/cruella/tuile-${loc}-${v}.webp`), `tuile manquante : ${loc}-${v}`).toBe(true)
      }
    }
    expect(existsSync('public/cards/cruella/tuile-dos.webp')).toBe(true)
  })

  it('12 Tuiles Chiots en réserve (2×11 + 1×22 par lieu)', () => {
    expect(cruella.startingPuppyTiles).toHaveLength(12)
    const total = (cruella.startingPuppyTiles ?? []).reduce((n, t) => n + t.value, 0)
    expect(total).toBe((11 + 11 + 22) * 4) // 176
  })

  it('objectif : capturer au moins 99 Chiots', () => {
    expect(cruella.objective).toEqual({ type: 'PUPPY_THRESHOLD', threshold: 99 })
  })
})
