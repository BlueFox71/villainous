import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { ultron, ultronCards } from '../published/ultron'
import { buildDeck } from '../types'

describe('cartes d’Ultron — intégrité du paquet (Phase 1)', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(ultronCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 10 cartes (complété à 15 par le pool Fatalité Marvel — Phase 2)', () => {
    expect(buildDeck(ultronCards, 'fate')).toHaveLength(10)
  })

  it('les 4 Sentinelles (Drones) sont des Alliés marqués isSentry', () => {
    for (const id of ['ultron-drone-de-combat', 'ultron-drone-aerien', 'ultron-drone-d-assaut', 'ultron-drone-geant']) {
      const c = ultronCards.find((x) => x.id === id)
      expect(c?.deck).toBe('villain')
      expect(c?.type).toBe('ally')
      expect(typeof c?.strength).toBe('number')
      expect(c?.isSentry).toBe(true) // classification Sentinelle (tuiles Amélioration)
    }
    // Seuls les Drones sont des Sentinelles (ni Alkhema ni Jocaste).
    const sentries = ultronCards.filter((c) => c.isSentry).map((c) => c.id)
    expect(sentries.sort()).toEqual(
      ['ultron-drone-aerien', 'ultron-drone-d-assaut', 'ultron-drone-de-combat', 'ultron-drone-geant'].sort(),
    )
  })

  it('DRONE DE COMBAT (Sentinelle de base) : Allié coût 1 / force 2 en 4 exemplaires', () => {
    const c = ultronCards.find((x) => x.id === 'ultron-drone-de-combat')
    expect(c?.cost).toBe(1)
    expect(c?.strength).toBe(2)
    expect(c?.copies).toBe(4)
  })

  it('les 5 Héros Fatalité ont une force numérique et aucun coût', () => {
    for (const id of ['ultron-hank-pym', 'ultron-mockingbird', 'ultron-la-sorciere-rouge', 'ultron-la-guepe', 'ultron-wonder-man']) {
      const c = ultronCards.find((x) => x.id === id)
      expect(c?.type).toBe('hero')
      expect(typeof c?.strength).toBe('number')
      expect(c?.cost).toBeUndefined()
    }
  })

  it('l’objectif est la révélation des 4 tuiles Amélioration (L’ère d’Ultron)', () => {
    expect(ultron.objective).toEqual({ type: 'ULTRON_AGE_REVEALED' })
  })

  it('le plateau a 4 lieux', () => {
    expect(ultron.locations).toHaveLength(4)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of ultronCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/ultron\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined() // les cartes Fatalité n'ont pas de coût
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of ultronCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
    expect(existsSync('public' + ultron.boardImage), 'plateau manquant').toBe(true)
  })
})
