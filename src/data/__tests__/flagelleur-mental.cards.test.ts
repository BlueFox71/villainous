import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { flagelleurMentalCards } from '../villains/flagelleur-mental.cards'
import { buildDeck } from '../types'

describe('cartes du Flagelleur Mental — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(flagelleurMentalCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(flagelleurMentalCards, 'fate')).toHaveLength(15)
  })

  it('les 6 héros de Hawkins sont des Héros Fatalité', () => {
    for (const id of [
      'mike-wheeler',
      'will-byers',
      'lucas-sinclair',
      'dustin-henderson',
      'onze',
      'max-mayfield',
    ]) {
      const c = flagelleurMentalCards.find((x) => x.id === id)
      expect(c?.deck).toBe('fate')
      expect(c?.type).toBe('hero')
      expect(typeof c?.strength).toBe('number')
    }
  })

  it('ONZE (cible-clé de l’objectif) est un Héros de force 5', () => {
    const onze = flagelleurMentalCards.find((c) => c.id === 'onze')
    expect(onze?.type).toBe('hero')
    expect(onze?.strength).toBe(5)
  })

  it('les cartes de l’objectif (Tunnels + Entrée + Billy) sont dans le deck Méchant', () => {
    for (const id of ['tunnel-de-hawkins', 'entree-du-monde-a-l-envers', 'billy-sous-emprise']) {
      const c = flagelleurMentalCards.find((x) => x.id === id)
      expect(c?.deck).toBe('villain')
    }
    // 5 Tunnels dans le paquet ; l'Entrée est unique.
    expect(flagelleurMentalCards.find((c) => c.id === 'tunnel-de-hawkins')?.copies).toBe(5)
    expect(flagelleurMentalCards.find((c) => c.id === 'entree-du-monde-a-l-envers')?.copies).toBe(1)
  })

  it('THE FLAYED est un Allié en 4 exemplaires (déblocage du 4ᵉ lieu)', () => {
    const c = flagelleurMentalCards.find((x) => x.id === 'the-flayed')
    expect(c?.type).toBe('ally')
    expect(c?.copies).toBe(4)
  })

  it('les Objets « sous emprise » (force 0) s’associent à un Héros', () => {
    const c = flagelleurMentalCards.find((x) => x.id === 'une-nouvelle-personne-sous-emprise')
    expect(c?.type).toBe('item')
    expect(c?.attach).toBe('hero')
    expect(c?.zeroesHostStrength).toBe(true)
  })

  it('les Conditions sont jouables au tour adverse (trigger défini, coût 0)', () => {
    for (const id of ['a-travers-les-yeux-de-will', 'intrus-dans-le-monde-a-l-envers']) {
      const c = flagelleurMentalCards.find((x) => x.id === id)
      expect(c?.type).toBe('condition')
      expect(c?.cost).toBe(0)
      expect(c?.trigger).toBeDefined()
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of flagelleurMentalCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/flagelleur-mental\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of flagelleurMentalCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
