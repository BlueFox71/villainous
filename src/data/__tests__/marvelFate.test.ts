import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { MARVEL_FATE_POOL, MARVEL_FATE_BY_ID, drawMarvelFateAddon, drawSharedMarvelFateAddons } from '../marvelFate'
import { getCardDef } from '../registry'
import { buildDeckInstances } from '../types'
import { ultronCards } from '../published/ultron'

describe('Pool Fatalité Marvel', () => {
  it('11 Héros Fatalité, ids uniques préfixés « marvel- », force définie', () => {
    expect(MARVEL_FATE_POOL.length).toBe(11)
    const ids = new Set<string>()
    for (const c of MARVEL_FATE_POOL) {
      expect(c.deck).toBe('fate')
      expect(c.type).toBe('hero')
      expect(c.id.startsWith('marvel-')).toBe(true)
      expect(typeof c.strength).toBe('number')
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
    }
    expect(ids.size).toBe(11)
  })

  it('toutes les images existent sur le disque', () => {
    for (const c of MARVEL_FATE_POOL) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('résolus par le registre (getCardDef)', () => {
    for (const c of MARVEL_FATE_POOL) {
      expect(getCardDef(c.id)?.name).toBe(c.name)
    }
  })

  it('passifs câblés via champs existants', () => {
    expect(MARVEL_FATE_BY_ID['marvel-vision'].reducesPowerGains).toBe(true)
    expect(MARVEL_FATE_BY_ID['marvel-iron-man'].activateSurcharge).toBe(1)
    expect(MARVEL_FATE_BY_ID['marvel-thor'].mustDefeatFirst).toBe(true)
  })

  it('drawMarvelFateAddon : 5 Héros distincts du pool, instanceId préfixés', () => {
    const addon = drawMarvelFateAddon('p0f:')
    expect(addon.length).toBe(5)
    const cardIds = new Set(addon.map((c) => c.cardId))
    expect(cardIds.size).toBe(5) // distincts
    for (const c of addon) {
      expect(MARVEL_FATE_BY_ID[c.cardId]).toBeDefined()
      expect(c.instanceId.startsWith('p0f:')).toBe(true)
      expect(c.type).toBe('hero')
    }
  })

  it('pool PARTAGÉ entre 2 vilains Marvel : 5+5 Héros SANS doublon', () => {
    // Répété : quel que soit le mélange, aucun Héros n'est donné aux deux joueurs.
    for (let n = 0; n < 30; n++) {
      const [a, b] = drawSharedMarvelFateAddons(['p0f:', 'p1f:'])
      expect(a.length).toBe(5)
      expect(b.length).toBe(5)
      const aIds = new Set(a.map((c) => c.cardId))
      const bIds = new Set(b.map((c) => c.cardId))
      expect(aIds.size).toBe(5)
      expect(bIds.size).toBe(5)
      // Intersection vide : un Héros (ex. Thor) ne peut aller qu'à UN seul.
      for (const id of aIds) expect(bIds.has(id)).toBe(false)
      expect(a.every((c) => c.instanceId.startsWith('p0f:'))).toBe(true)
      expect(b.every((c) => c.instanceId.startsWith('p1f:'))).toBe(true)
    }
  })

  it('pool partagé pour 1 seul vilain Marvel : 5 Héros', () => {
    const [only] = drawSharedMarvelFateAddons(['p1f:'])
    expect(only.length).toBe(5)
    expect(only.every((c) => c.instanceId.startsWith('p1f:'))).toBe(true)
  })

  it('complète la Fatalité d’Ultron de 10 à 15', () => {
    const base = buildDeckInstances(ultronCards, 'fate', 'p0f:')
    expect(base.length).toBe(10)
    const completed = [...base, ...drawMarvelFateAddon('p0f:')]
    expect(completed.length).toBe(15)
  })
})
