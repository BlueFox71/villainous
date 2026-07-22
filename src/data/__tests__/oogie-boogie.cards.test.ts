import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { oogieBoogieCards } from '../villains/oogie-boogie.cards'
import { buildDeck } from '../types'

describe('cartes d’Oogie Boogie — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(oogieBoogieCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(oogieBoogieCards, 'fate')).toHaveLength(15)
  })

  it('le Trio Am/Stram/Gram est présent (1 exemplaire chacun)', () => {
    for (const id of ['am', 'stram', 'gram']) {
      const c = oogieBoogieCards.find((x) => x.id === id)
      expect(c?.type).toBe('ally')
      expect(c?.copies).toBe(1)
    }
  })

  it('« Imposteur Perce-Oreilles » est présent ×6', () => {
    expect(oogieBoogieCards.find((c) => c.id === 'imposteur-perce-oreilles')?.copies).toBe(6)
  })

  it('les Citoyens d’Halloween (×4) doivent être éliminés en premier', () => {
    const c = oogieBoogieCards.find((x) => x.id === 'citoyens-halloween')
    expect(c?.copies).toBe(4)
    expect(c?.mustDefeatFirst).toBe(true)
  })

  it('Jack Skellington est un Héros force 8 (cible de l’objectif)', () => {
    const jack = oogieBoogieCards.find((c) => c.id === 'jack-skellington')
    expect(jack?.deck).toBe('fate')
    expect(jack?.type).toBe('hero')
    expect(jack?.strength).toBe(8)
  })

  it('Perce-Oreilles (Sandy Claws) est dans le paquet Fatalité', () => {
    expect(oogieBoogieCards.find((c) => c.id === 'perce-oreilles')?.deck).toBe('fate')
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of oogieBoogieCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/oogie-boogie\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of oogieBoogieCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
