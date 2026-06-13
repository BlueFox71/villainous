import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { facilierCards } from '../villains/facilier.cards'
import { buildDeck } from '../types'

describe('cartes du Dr Facilier — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(facilierCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(facilierCards, 'fate')).toHaveLength(15)
  })

  it('Amis de l’au-delà et Régner vont dans la Pile de l’Au-delà quand joués', () => {
    for (const id of ['amis-au-dela', 'regner-nouvelle-orleans']) {
      expect(facilierCards.find((c) => c.id === id)?.goesToAuDelaOnPlay).toBe(true)
    }
  })

  it('Régner gagne la partie si révélé en détenant le Talisman', () => {
    const regner = facilierCards.find((c) => c.id === 'regner-nouvelle-orleans')
    expect(regner?.auDela).toEqual({ kind: 'win-if-talisman' })
  })

  it('les effets Au-delà sont bien déclarés', () => {
    expect(facilierCards.find((c) => c.id === 'amis-au-dela')?.auDela).toEqual({ kind: 'gain-power-discard', amount: 2 })
    expect(facilierCards.find((c) => c.id === 'esprits-ombres')?.auDela).toEqual({ kind: 'lose-power-discard', amount: 2 })
    expect(facilierCards.find((c) => c.id === 'esprits-masques')?.auDela).toEqual({ kind: 'masks-abort' })
    expect(facilierCards.find((c) => c.id === 'ombre-facilier')?.auDela).toEqual({ kind: 'place-on-location', locationId: 'royaume-vaudou' })
    expect(facilierCards.find((c) => c.id === 'tour-passe-passe')?.auDela).toEqual({ kind: 'scry-draw-discard', look: 3, take: 1 })
  })

  it('Forme de grenouille réduit la force d’un Héros de 2', () => {
    const frog = facilierCards.find((c) => c.id === 'forme-grenouille')
    expect(frog?.type).toBe('item')
    expect(frog?.attach).toBe('hero')
    expect(frog?.attachStrengthBonus).toBe(-2)
  })

  it('compte 9 Héros (Fatalité) avec une force', () => {
    const heroes = facilierCards.filter((c) => c.deck === 'fate' && c.type === 'hero')
    expect(heroes).toHaveLength(9)
    for (const h of heroes) expect(typeof h.strength).toBe('number')
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of facilierCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/facilier\/.+\.png$/)
      // Les cartes Vilain ont un coût (sauf les Conditions, qui n'en ont pas).
      if (c.deck === 'villain' && c.type !== 'condition') expect(typeof c.cost).toBe('number')
      else if (c.deck === 'fate') expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of facilierCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
