import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { syndromeCards } from '../villains/syndrome.cards'
import { syndrome } from '../villains/syndrome'
import { buildDeck } from '../types'

describe('cartes de Syndrome — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes (tuiles Omnidroïde hors deck)', () => {
    expect(buildDeck(syndromeCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(syndromeCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 9 Alliés, 7 Objets, 4 Événements, 10 Conditions', () => {
    const v = syndromeCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(9) // Mirage 1 + Sécurité 2 + Gardes 3 + Patrouille 3
    expect(count('item')).toBe(7) // Télécommande 1 + Modif Majeure 4 + Énergie 2
    expect(count('effect')).toBe(4) // Identification 2 + Confinement 2
    expect(count('condition')).toBe(10) // Qui 2 + Sonde 2 + 15 ans 3 + Solo 3
  })

  it('répartition Fatalité : 6 Héros, 2 Objets, 7 Événements', () => {
    const f = syndromeCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(6)
    expect(count('item')).toBe(2) // Champ de Force ×2
    expect(count('effect')).toBe(7) // Truc de dingue 1 + Travail 2 + Intrusion 1 + Pas de Capes 2 + Monologue 1
  })

  it('les tuiles Omnidroïde (v.X8/v.X9/v.10 + face détruite) existent hors deck ; setup = 3 stades', () => {
    const tiles = syndromeCards.filter((c) => c.id.startsWith('omnidroide-v-'))
    expect(tiles).toHaveLength(4) // x8, x9, x10 + x10-detruit (face dos)
    expect(tiles.every((c) => c.copies === 0)).toBe(true)
    const ids = syndrome.omnidroidSetup!.stages.map((s) => s.cardId)
    expect(ids).toEqual(['omnidroide-v-x8', 'omnidroide-v-x9', 'omnidroide-v-x10'])
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of syndromeCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName!.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(0)
      expect(c.image).toMatch(/^\/cards\/syndrome\/.+\.png$/)
      // Coût requis pour les cartes Méchant jouables (hors Conditions et tuiles hors deck).
      if (c.deck === 'villain' && c.type !== 'condition' && c.copies > 0) expect(typeof c.cost).toBe('number')
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('objectif : détruire l’Omnidroïde v.10 (4 lieux)', () => {
    expect(syndrome.objective).toEqual({ type: 'DEFEAT_OMNIDROID_V10' })
    expect(syndrome.locations).toHaveLength(4)
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of syndromeCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos de cartes existent dans public/', () => {
    for (const path of [syndrome.boardImage, syndrome.pawnImage, syndrome.backVillainImage, syndrome.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })
})
