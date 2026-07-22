import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { imposteurCards } from '../villains/imposteur.cards'
import { buildDeck } from '../types'

describe("cartes de L'Imposteur — intégrité du paquet", () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(imposteurCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(imposteurCards, 'fate')).toHaveLength(15)
  })

  it("le deck Fatalité ne contient aucun Héros", () => {
    expect(imposteurCards.filter((c) => c.deck === 'fate' && c.type === 'hero')).toHaveLength(0)
  })

  it("le Coéquipier imposteur est un Allié de force 1 qui donne l'action « Jouer une carte »", () => {
    const co = imposteurCards.find((c) => c.id === 'coequipier-imposteur')
    expect(co?.type).toBe('ally')
    expect(co?.strength).toBe(1)
    expect(co?.grantsAction).toEqual({ type: 'PLAY_CARD', label: 'Jouer une carte' })
  })

  it('les Sabotages sont restreints à leur lieu', () => {
    expect(imposteurCards.find((c) => c.id === 'sabotage-o2')?.playOnlyAt).toBe('admin')
    expect(imposteurCards.find((c) => c.id === 'sabotage-reacteur')?.playOnlyAt).toBe('reacteur')
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of imposteurCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/imposteur\/.+\.(png|webp)$/)
      // Les cartes Vilain ont un coût (sauf les Conditions, qui n'en ont pas).
      if (c.deck === 'villain' && c.type !== 'condition') expect(typeof c.cost).toBe('number')
      else if (c.deck === 'fate') expect(c.cost).toBeUndefined()
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of imposteurCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
