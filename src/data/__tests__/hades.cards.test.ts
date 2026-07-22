import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { hadesCards } from '../villains/hades.cards'
import { buildDeck } from '../types'

describe('cartes d’Hadès — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(hadesCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(hadesCards, 'fate')).toHaveLength(15)
  })

  it('compte 5 Titans, tous joués sur Les Enfers', () => {
    const titans = hadesCards.filter((c) => c.isTitan)
    expect(titans).toHaveLength(5)
    for (const t of titans) {
      expect(t.deck).toBe('villain')
      expect(t.type).toBe('ally')
      expect(t.playOnlyAt).toBe('enfers')
      expect(typeof t.strength).toBe('number')
    }
    expect(titans.map((t) => t.id).sort()).toEqual(['arges', 'hydros', 'lythos', 'pyros', 'stratos'])
  })

  it('Préparez-vous au combat ! déplace un Titan (payant, ≤2 lieux)', () => {
    const prep = hadesCards.find((c) => c.id === 'preparez-combat')
    expect(prep?.effects).toContainEqual({ type: 'MOVE_TITAN_INTERACTIVE', paid: true, maxSteps: 2 })
  })

  it('Cerbère élimine à distance ; l’Hydre revient en main', () => {
    expect(hadesCards.find((c) => c.id === 'cerbere')?.reachesAdjacentVanquish).toBe(true)
    expect(hadesCards.find((c) => c.id === 'hydre')?.returnToHandOnVanquish).toBe(true)
  })

  it('le Médaillon (Fatalité) confère +2 force', () => {
    const med = hadesCards.find((c) => c.id === 'medaillon')
    expect(med?.deck).toBe('fate')
    expect(med?.attach).toBe('hero')
    expect(med?.attachStrengthBonus).toBe(2)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of hadesCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/hades\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of hadesCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})
