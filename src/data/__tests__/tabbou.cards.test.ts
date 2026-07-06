import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { tabbouCards } from '../villains/tabbou.cards'
import { tabbou } from '../villains/tabbou'
import { buildDeck } from '../types'

describe('cartes de Tabbou — intégrité du paquet', () => {
  it('le deck Vilain totalise 30 cartes', () => {
    expect(buildDeck(tabbouCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(tabbouCards, 'fate')).toHaveLength(15)
  })

  it('6 Héros Fatalité, dont Samus (rehausse l’objectif) et Link (plafonne la révélation)', () => {
    const heroes = tabbouCards.filter((c) => c.deck === 'fate' && c.type === 'hero')
    expect(heroes).toHaveLength(6)
    expect(tabbouCards.find((c) => c.id === 'samus')?.strength).toBe(3)
    expect(tabbouCards.find((c) => c.id === 'link')?.fighterRevealCap).toBe(3)
    expect(tabbouCards.find((c) => c.id === 'kirby')?.fighterRevealSurcharge).toBe(1)
  })

  it('Canon Obscur réduit de 1 le coût des Objets sur son lieu', () => {
    expect(tabbouCards.find((c) => c.id === 'canon-obscure-2')?.itemCostReductionHere).toBe(1)
  })

  it('4 Orbes subspatiaux (déblocage Émissaire) portant l’effet SUBSPACE_ORB_PLACED', () => {
    const orbs = tabbouCards.filter((c) => c.id.startsWith('boule-'))
    expect(orbs).toHaveLength(4)
    for (const o of orbs) {
      expect(o.attach).toBe('location')
      expect((o.effects ?? []).some((e) => e.type === 'SUBSPACE_ORB_PLACED')).toBe(true)
    }
  })

  it('les cartes de mise à mort des Combattants sont présentes', () => {
    expect(tabbouCards.find((c) => c.id === 'collection')?.copies).toBe(3)
    expect((tabbouCards.find((c) => c.id === 'coup-fatal')?.effects ?? [])[0]).toEqual({ type: 'KILL_FIGHTERS_FREE', max: 10 })
    expect((tabbouCards.find((c) => c.id === 'canon-obscure')?.activatedEffects ?? [])[0]).toEqual({ type: 'KILL_FIGHTERS_COLOR' })
  })

  it('le plateau : objectif KILL_FIGHTERS (20 → 30 avec Samus) et Émissaire verrouillé', () => {
    expect(tabbou.objective).toEqual({ type: 'KILL_FIGHTERS', threshold: 20, raiseHeroCardId: 'samus', raiseTo: 30 })
    expect(tabbou.lockedLocationsAtStart).toContain('emissaire')
    expect(tabbou.fighterSetup?.emissaireLocationId).toBe('emissaire')
    expect(tabbou.fighterSetup?.tiles).toHaveLength(35)
    // exactement un lieu porte l'action custom « Dévoiler une tuile Combattant »
    const revealCells = tabbou.locations.flatMap((l) => l.actions).filter((a) => a.type === 'REVEAL_FIGHTER')
    expect(revealCells).toHaveLength(1)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of tabbouCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/tabbou\/.+\.png$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of tabbouCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
    expect(existsSync('public' + tabbou.boardImage)).toBe(true)
    expect(existsSync('public' + tabbou.backVillainImage)).toBe(true)
    expect(existsSync('public' + tabbou.backFateImage)).toBe(true)
    // les 35 arts de tuiles Combattants
    for (const t of tabbou.fighterSetup?.tiles ?? []) {
      expect(existsSync('public' + t.art), `art manquant : ${t.art}`).toBe(true)
    }
  })
})
