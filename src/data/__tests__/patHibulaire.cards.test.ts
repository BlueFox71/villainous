import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { patHibulaireCards } from '../villains/patHibulaire.cards'
import { buildDeck } from '../types'

describe('cartes de Pat Hibulaire — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(patHibulaireCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(patHibulaireCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 14 Alliés, 8 Événements, 4 Conditions, 4 Objets', () => {
    const v = patHibulaireCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(14)
    expect(count('effect')).toBe(8)
    expect(count('condition')).toBe(4)
    expect(count('item')).toBe(4)
  })

  it('répartition Fatalité : 8 Héros, 7 Événements', () => {
    const f = patHibulaireCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(8)
    expect(count('effect')).toBe(7)
  })

  it('le Bandit est en 7 exemplaires et Une Petite Partie ? en 4', () => {
    expect(patHibulaireCards.find((c) => c.id === 'bandit')?.copies).toBe(7)
    expect(patHibulaireCards.find((c) => c.id === 'une-petite-partie')?.copies).toBe(4)
  })

  it('les 4 Objets sont verrouillés sur un lieu et confèrent une action', () => {
    const items = patHibulaireCards.filter((c) => c.type === 'item')
    expect(items).toHaveLength(4)
    for (const it of items) {
      expect(it.playOnlyAt, `${it.id} doit avoir playOnlyAt`).toBeTruthy()
      expect(it.grantsAction, `${it.id} doit conférer une action`).toBeTruthy()
    }
    const locs = items.map((c) => c.playOnlyAt).sort()
    expect(locs).toEqual(['aeroport', 'frontier-town', 'ponton', 'station-service'])
  })

  it('Mickey (force 5) bloque, Donald doit être vaincu en premier', () => {
    expect(patHibulaireCards.find((c) => c.id === 'mickey')?.strength).toBe(5)
    expect(patHibulaireCards.find((c) => c.id === 'donald')?.mustDefeatFirst).toBe(true)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of patHibulaireCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/pat-hibulaire\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of patHibulaireCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
