import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { davyJonesCards } from '../villains/davyJones.cards'
import { buildDeck } from '../types'

describe('cartes de Davy Jones — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(davyJonesCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(davyJonesCards, 'fate')).toHaveLength(15)
  })

  it('répartition par type (Méchant) : 10 Alliés, 1 Objet, 13 Événements, 6 Conditions', () => {
    const villain = buildDeck(davyJonesCards, 'villain')
    const count = (t: string) => villain.filter((c) => c.type === t).length
    expect(count('ally')).toBe(10)
    expect(count('item')).toBe(1)
    expect(count('effect')).toBe(13)
    expect(count('condition')).toBe(6)
  })

  it('répartition par type (Fatalité) : 5 Héros, 1 Objet, 9 Événements', () => {
    const fate = buildDeck(davyJonesCards, 'fate')
    expect(fate.filter((c) => c.type === 'hero')).toHaveLength(5)
    expect(fate.filter((c) => c.type === 'item')).toHaveLength(1)
    expect(fate.filter((c) => c.type === 'effect')).toHaveLength(9)
  })

  it('Clanker accorde une action Éliminer un Héros à son lieu', () => {
    expect(davyJonesCards.find((c) => c.id === 'clanker')?.grantsAction).toEqual({
      type: 'VANQUISH',
      label: 'Éliminer un Héros',
    })
  })

  it('Le Kraken (force 8) survit en éliminant un Héros à trésor révélé ; Maccus a son redirect', () => {
    expect(davyJonesCards.find((c) => c.id === 'le-kraken')?.survivesVanquishWithRevealedTreasure).toBe(true)
    expect(davyJonesCards.find((c) => c.id === 'le-kraken')?.strength).toBe(8)
    expect(davyJonesCards.find((c) => c.id === 'le-second-maccus')?.survivesVanquishByDiscardingAlly).toBe(true)
  })

  it('Jack Sparrow bloque le Vanquish sur son lieu ; Le Black Pearl s’associe à un Héros (+3)', () => {
    expect(davyJonesCards.find((c) => c.id === 'jack-sparrow')?.blocksVanquishHere).toBe(true)
    const bp = davyJonesCards.find((c) => c.id === 'black-pearl-objet')!
    expect(bp.attach).toBe('hero')
    expect(bp.attachStrengthBonus).toBe(3)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of davyJonesCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/davy-jones\/.+\.(png|webp)$/)
      // Cartes Méchant : coût numérique SAUF les Conditions (jouées gratuitement en réaction).
      if (c.deck === 'villain' && c.type !== 'condition') expect(typeof c.cost).toBe('number')
      else if (c.deck === 'fate') expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of davyJonesCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
