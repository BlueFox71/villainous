import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { lotsoCards } from '../villains/lotso.cards'
import { lotso } from '../villains/lotso'
import { buildDeck } from '../types'

describe('cartes de Lotso — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes (tuile Buzz hors deck)', () => {
    expect(buildDeck(lotsoCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(lotsoCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 5 Alliés, 1 Objet, 17 Événements, 7 Conditions', () => {
    const v = lotsoCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(5) // Big Baby, Tchac, Vulcain, Twitch, Flex
    expect(count('item')).toBe(1) // Chapeau de Woody
    expect(count('effect')).toBe(17)
    expect(count('condition')).toBe(7)
  })

  it('répartition Fatalité : 4 Héros, 11 Événements', () => {
    const f = lotsoCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(4)
    expect(count('effect')).toBe(11)
  })

  it('la tuile Buzz (2 faces) existe hors deck (copies: 0) et est référencée par guardianSetup', () => {
    const buzz = lotsoCards.filter((c) => c.id.startsWith('buzz-'))
    expect(buzz).toHaveLength(2)
    expect(buzz.every((c) => c.copies === 0)).toBe(true)
    expect(lotso.guardianSetup?.cardId).toBe('buzz-l-eclair')
    expect(lotso.guardianSetup?.locationId).toBe('salle-des-chenilles')
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of lotsoCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName!.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.image).toMatch(/^\/cards\/lotso\/.+\.(png|webp)$/)
      if (c.deck === 'villain' && c.type !== 'condition' && c.copies > 0) expect(typeof c.cost).toBe('number')
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('objectif : réunir les 4 Héros à force 0 sur la Salle des Chenilles (4 lieux)', () => {
    expect(lotso.objective).toEqual({
      type: 'LOTSO_GATHER',
      roomId: 'salle-des-chenilles',
      heroCardIds: ['bayonne', 'jessie', 'rex', 'woody'],
    })
    expect(lotso.locations).toHaveLength(4)
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of lotsoCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos existent dans public/', () => {
    for (const path of [lotso.boardImage, lotso.pawnImage, lotso.backVillainImage, lotso.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })
})
