import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { seigneurCles, seigneurClesCards } from '../published/seigneurCles'
import { buildDeck } from '../types'

describe('cartes du Seigneur des clés — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(seigneurClesCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(seigneurClesCards, 'fate')).toHaveLength(15)
  })

  it('répartition Méchant : 3 Conditions, 27 Événements', () => {
    // Depuis la migration du vilain dans l'Atelier (source unique = custom-seigneur-cles.json),
    // le deck Méchant ne contient plus d'Objet : sa composition suit désormais le JSON publié.
    const v = seigneurClesCards.filter((c) => c.deck === 'villain')
    const count = (t: string) => v.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('item')).toBe(0)
    expect(count('condition')).toBe(3)
    expect(count('effect')).toBe(27)
  })

  it('répartition Fatalité : 6 Héros, 1 Objet, 8 Événements', () => {
    const f = seigneurClesCards.filter((c) => c.deck === 'fate')
    const count = (t: string) => f.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(count('hero')).toBe(6)
    expect(count('item')).toBe(1)
    expect(count('effect')).toBe(8)
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of seigneurClesCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/custom-seigneur-cles\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of seigneurClesCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })

  it('plateau, pion et dos de cartes existent dans public/', () => {
    for (const path of [
      seigneurCles.boardImage,
      seigneurCles.pawnImage,
      seigneurCles.backVillainImage,
      seigneurCles.backFateImage,
    ]) {
      expect(existsSync('public' + path), `asset manquant : ${path}`).toBe(true)
    }
  })

  it('mise en place : 3 clés par lieu (12 au total) sur 4 lieux', () => {
    expect(seigneurCles.startingKeysPerLocation).toBe(3)
    expect(seigneurCles.locations).toHaveLength(4)
  })

  it('objectif : posséder une clé de chaque couleur', () => {
    expect(seigneurCles.objective).toEqual({ type: 'KEYS_ALL_COLORS' })
  })

  it('les 6 images de clé (détourées) existent dans public/', () => {
    for (const color of ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange']) {
      expect(existsSync(`public/cards/custom-seigneur-cles/cle-${color}.webp`), `clé manquante : ${color}`).toBe(true)
    }
  })

  it('la Crypte porte une action « Obtenir une clé »', () => {
    const crypte = seigneurCles.locations.find((l) => l.id === 'crypte')
    expect(crypte?.actions.some((a) => a.type === 'OBTAIN_KEY')).toBe(true)
  })

  it('Fosse commune : Fatalité en haut, les 3 autres actions en bas', () => {
    const fosse = seigneurCles.locations.find((l) => l.id === 'fosse-commune')!
    const row = (r: 'top' | 'bottom') => fosse.actions.filter((a) => a.row === r).map((a) => a.type)
    expect(row('top')).toEqual(['FATE'])
    expect(row('bottom')).toEqual(['MOVE_HERO', 'VANQUISH', 'GAIN_POWER'])
  })
})
