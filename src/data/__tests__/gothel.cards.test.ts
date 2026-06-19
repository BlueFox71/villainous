import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { gothelCards } from '../villains/gothel.cards'
import { gothel } from '../villains/gothel'
import { buildDeck } from '../types'

describe('cartes de Mère Gothel — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(gothelCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes (Raiponce exclue : tuile, hors deck)', () => {
    expect(buildDeck(gothelCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 3 Objets, 9 Alliés, 14 Événements, 4 Conditions', () => {
    const v = gothelCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('item')).toBe(3)
    expect(count('ally')).toBe(9)
    expect(count('effect')).toBe(14)
    expect(count('condition')).toBe(4)
  })

  it('répartition Fatalité (deck) : 7 Héros, 7 Événements, 1 Objet', () => {
    const f = gothelCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(7) // hors Raiponce (copies 0)
    expect(count('effect')).toBe(7)
    expect(count('item')).toBe(1)
  })

  it('Raiponce est un Héros-tuile hors deck (copies 0)', () => {
    const r = gothelCards.find((c) => c.id === 'raiponce')
    expect(r?.type).toBe('hero')
    expect(r?.copies).toBe(0)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of gothelCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      // Raiponce (tuile) est le seul cas à 0 exemplaire.
      if (c.id === 'raiponce') expect(c.copies).toBe(0)
      else expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/gothel\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of gothelCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos de cartes existent dans public/', () => {
    for (const path of [gothel.boardImage, gothel.pawnImage, gothel.backVillainImage, gothel.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })

  it('Cavaliers du roi atteignent un lieu voisin ; Poêle (+1) et Poignard (+2) sont des Objets associés', () => {
    expect(gothelCards.find((c) => c.id === 'cavaliers-du-roi')?.reachesAdjacentVanquish).toBe(true)
    const poele = gothelCards.find((c) => c.id === 'poele-a-frire')
    expect(poele?.attach).toBe('hero')
    expect(poele?.attachStrengthBonus).toBe(1)
    const poignard = gothelCards.find((c) => c.id === 'poignard')
    expect(poignard?.attach).toBe('ally')
    expect(poignard?.attachStrengthBonus).toBe(2)
  })
})
