import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { madameMimCards } from '../villains/madameMim.cards'
import { madameMim } from '../villains/madameMim'
import { buildDeck } from '../types'

describe('cartes de Madame Mim — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(madameMimCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes (8 traditionnelles + 7 Métamorphoses de Merlin)', () => {
    expect(buildDeck(madameMimCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 8 Métamorphoses (Alliés), 16 Événements, 6 Conditions', () => {
    const v = madameMimCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('ally')).toBe(8)
    expect(count('effect')).toBe(16)
    expect(count('condition')).toBe(6)
    expect(v.filter((c) => c.isMimTransformation).length).toBe(8)
  })

  it('répartition Fatalité : 8 Événements + 7 Métamorphoses de Merlin (Héros)', () => {
    const f = madameMimCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('effect')).toBe(8)
    expect(count('hero')).toBe(7)
    expect(f.filter((c) => c.isMerlinTransformation).length).toBe(7)
  })

  it('chaque Métamorphose Mim cible une Métamorphose de Merlin réelle', () => {
    const merlinIds = new Set(madameMimCards.filter((c) => c.isMerlinTransformation).map((c) => c.id))
    for (const m of madameMimCards.filter((c) => c.isMimTransformation)) {
      expect(typeof m.transformationTarget).toBe('string')
      expect(merlinIds.has(m.transformationTarget!), `cible inconnue : ${m.transformationTarget}`).toBe(true)
      expect(m.grantsAction?.type).toBe('VANQUISH')
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of madameMimCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName!.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/madame-mim\/.+\.png$/)
      if (c.deck === 'villain' && c.type !== 'condition') expect(typeof c.cost).toBe('number')
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
    }
  })

  it('objectif : vaincre les 7 Métamorphoses de Merlin (4 lieux)', () => {
    expect(madameMim.objective).toEqual({ type: 'DEFEAT_ALL_MERLIN' })
    expect(madameMim.locations).toHaveLength(4)
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of madameMimCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos de cartes existent dans public/', () => {
    for (const path of [madameMim.boardImage, madameMim.pawnImage, madameMim.backVillainImage, madameMim.backFateImage]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })
})
