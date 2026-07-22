import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { princeJohnCards } from '../villains/princeJohn.cards'
import { buildDeck } from '../types'

describe('cartes du Prince Jean — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(princeJohnCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(princeJohnCards, 'fate')).toHaveLength(15)
  })

  it('27 cartes uniques (16 Vilain + 11 Fatalité)', () => {
    const villain = princeJohnCards.filter((c) => c.deck === 'villain')
    const fate = princeJohnCards.filter((c) => c.deck === 'fate')
    expect(villain).toHaveLength(16)
    expect(fate).toHaveLength(11)
    expect(princeJohnCards).toHaveLength(27)
  })

  it('répartition Vilain conforme au wiki (10 alliés / 7 objets / 9 événements / 4 conditions)', () => {
    const count = (type: string) =>
      princeJohnCards
        .filter((c) => c.deck === 'villain' && c.type === type)
        .reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(10)
    expect(count('item')).toBe(7)
    expect(count('effect')).toBe(9)
    expect(count('condition')).toBe(4)
  })

  it('répartition Fatalité conforme au wiki (9 héros / 3 effets / 3 objets)', () => {
    const count = (type: string) =>
      princeJohnCards
        .filter((c) => c.deck === 'fate' && c.type === type)
        .reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(9)
    expect(count('effect')).toBe(3)
    expect(count('item')).toBe(3)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of princeJohnCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/) // slug ASCII
      expect(ids.has(c.id)).toBe(false) // id unique
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/prince-jean\/.+\.(png|webp)$/)
      // Cartes Vilain : coût défini ; cartes Fatalité : pas de coût.
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      // Alliés et Héros ont une force.
      if (c.type === 'ally' || c.type === 'hero') {
        expect(typeof c.strength).toBe('number')
      }
    }
  })

  it('le champ attach n’est porté que par des Objets, avec les bonnes cibles', () => {
    const byId = Object.fromEntries(princeJohnCards.map((c) => [c.id, c]))
    // Objets « à associer ».
    expect(byId['arc-fleches'].attach).toBe('ally')
    expect(byId['fleche-or'].attach).toBe('ally')
    expect(byId['deguisement'].attach).toBe('hero')
    // Objets de lieu : pas de cible d'association.
    expect(byId['mandat-arret'].attach).toBeUndefined()
    expect(byId['couronne-roi-richard'].attach).toBeUndefined()
    // attach ne concerne que les Objets.
    for (const c of princeJohnCards) {
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of princeJohnCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
