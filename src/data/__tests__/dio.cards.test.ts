import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { dioCards } from '../villains/dio.cards'
import { dio } from '../villains/dio'
import { buildDeck } from '../types'

describe('cartes de Dio Brando — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes (hors Stands)', () => {
    // The World y est inclus (Stand mais SANS isStand) ; Cream/Justice (isStand) sont exclus.
    expect(buildDeck(dioCards, 'villain').filter((c) => !c.isStand)).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes (hors Stands)', () => {
    expect(buildDeck(dioCards, 'fate').filter((c) => !c.isStand)).toHaveLength(15)
  })

  it('7 Stands HORS deck (isStand)', () => {
    const stands = dioCards.filter((c) => c.isStand)
    expect(stands.reduce((n, c) => n + c.copies, 0)).toBe(7)
    // Tous associables (à un Allié ou un Héros) et porteurs d'un bonus de force.
    for (const s of stands) {
      expect(s.attach === 'ally' || s.attach === 'hero').toBe(true)
      expect(typeof s.attachStrengthBonus).toBe('number')
    }
    // The World n'est PAS un Stand hors-deck (il vit dans le deck Méchant).
    expect(dioCards.find((c) => c.id === 'the-world')!.isStand).toBeUndefined()
  })

  it('répartition Méchant (hors Stands) : 5 Alliés, 3 Objets, 20 Événements, 2 Conditions', () => {
    const v = dioCards.filter((c) => c.deck === 'villain' && !c.isStand)
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(5) // The World, Vanilla Ice, Enya Geil, 2× Légion de vampires
    expect(count('item')).toBe(3) // Masque de pierre, 2× La flèche
    expect(count('effect')).toBe(20) // ZA WARUDO ×5, Tu oses ×4, JOTARO ×2, Vampirisme ×2, Soif ×2, Indigne ×2, Quête ×3
    expect(count('condition')).toBe(2) // MUDA ×2
  })

  it('répartition Fatalité (hors Stands) : 6 Héros, 9 Événements', () => {
    const f = dioCards.filter((c) => c.deck === 'fate' && !c.isStand)
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(6)
    expect(count('effect')).toBe(9)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of dioCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/dio\/.+\.png$/)
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('objectif : retirer Jotaro + Joseph et balayer le royaume (4 lieux)', () => {
    expect(dio.objective).toEqual({
      type: 'DIO_ALL_ACTIONS',
      joestarCardIds: ['jotaro-kujo', 'joseph-joestar'],
    })
    expect(dio.locations).toHaveLength(4)
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of dioCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion, dos (Méchant/Fatalité) existent dans public/', () => {
    for (const path of [dio.boardImage, dio.pawnImage, dio.backVillainImage, dio.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })
})
