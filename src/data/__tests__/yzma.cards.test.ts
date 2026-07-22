import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { yzmaCards } from '../villains/yzma.cards'
import { yzma } from '../villains/yzma'

/** Intégrité du paquet d'Yzma (Phase 1 : données ; images vérifiées en Phase 4). */
describe('Yzma — intégrité du paquet', () => {
  const villain = yzmaCards.filter((c) => c.deck === 'villain')
  const fate = yzmaCards.filter((c) => c.deck === 'fate')

  it('compte 30 cartes Méchant et 16 cartes Fatalité', () => {
    const count = (cs: typeof yzmaCards) => cs.reduce((n, c) => n + c.copies, 0)
    expect(count(villain)).toBe(30)
    expect(count(fate)).toBe(16)
  })

  it('répartition Méchant : 4 Alliés, 1 Objet, 21 Événements, 4 Conditions', () => {
    const byType = (t: string) => villain.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(byType('ally')).toBe(4) // Gardes impériaux x3 + Kronk
    expect(byType('item')).toBe(1) // Couteau
    expect(byType('effect')).toBe(21)
    expect(byType('condition')).toBe(4) // Férocité x2 + Supériorité x2
  })

  it('répartition Fatalité : 8 Héros, 8 Événements', () => {
    const byType = (t: string) => fate.filter((c) => c.type === t).reduce((n, c) => n + c.copies, 0)
    expect(byType('hero')).toBe(8) // Paysan x2 + Bucky/Chaca/Chicha/Kuzco/Pacha/Tipo
    expect(byType('effect')).toBe(8)
  })

  it('slugs ASCII kebab-case et uniques', () => {
    const ids = yzmaCards.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('Kuzco (force 7) et Kronk (Allié force 6) présents ; objectif cohérent', () => {
    expect(yzmaCards.find((c) => c.id === 'kuzco')?.strength).toBe(7)
    const kronk = yzmaCards.find((c) => c.id === 'kronk')
    expect(kronk?.type).toBe('ally')
    expect(kronk?.strength).toBe(6)
    expect(yzma.objective).toEqual({ type: 'DEFEAT_HERO_WITH_ALLY', heroCardId: 'kuzco', allyCardId: 'kronk' })
  })

  it('les 4 lieux sont fonctionnels (aucun verrouillé au départ)', () => {
    expect(yzma.locations.map((l) => l.id)).toEqual(['palais', 'maison-pacha', 'jungle', 'poele-mudka'])
    for (const l of yzma.locations) expect(l.actions.length).toBe(4)
  })

  it('chaque illustration référencée existe (cartes + plateau + dos + pion)', () => {
    for (const c of yzmaCards) {
      expect(c.image).toMatch(/^\/cards\/yzma\/.+\.(png|webp)$/)
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
    for (const p of [yzma.boardImage, yzma.backVillainImage, yzma.backFateImage, yzma.pawnImage]) {
      expect(existsSync('public' + p), `asset manquant : ${p}`).toBe(true)
    }
  })
})
