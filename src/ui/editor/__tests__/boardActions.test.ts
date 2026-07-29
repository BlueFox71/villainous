import { describe, it, expect } from 'vitest'
import { typeOptionsFor, hasFreeLabel } from '../boardActionTypes'

// Actions de plateau de l'Atelier : le type PERSONNALISÉ (icône importée + libellé libre)
// et la préservation des types SPÉCIAUX déjà posés (OBTAIN_KEY…), qui ne doivent jamais être
// écrasés silencieusement par le sélecteur.
describe('actions de plateau — éditeur', () => {
  it('propose le type « Personnalisée » à la création', () => {
    expect(typeOptionsFor('GAIN_POWER').some((o) => o.value === 'CUSTOM')).toBe(true)
  })

  it('préserve un type SPÉCIAL courant (OBTAIN_KEY) dans les options du sélecteur', () => {
    const opts = typeOptionsFor('OBTAIN_KEY')
    const key = opts.find((o) => o.value === 'OBTAIN_KEY')
    expect(key).toBeTruthy()
    // Libellé explicite (pas le brut) pour ne pas clobberer à l'édition.
    expect(key!.label).toMatch(/clé/i)
    // Les types génériques restent proposés à côté.
    expect(opts.some((o) => o.value === 'GAIN_POWER')).toBe(true)
  })

  it('n’ajoute pas de doublon quand le type courant est déjà générique', () => {
    const opts = typeOptionsFor('FATE')
    expect(opts.filter((o) => o.value === 'FATE')).toHaveLength(1)
  })

  it('libellé libre pour les actions personnalisées et spéciales, auto pour les génériques', () => {
    expect(hasFreeLabel('CUSTOM')).toBe(true)
    expect(hasFreeLabel('OBTAIN_KEY')).toBe(true)
    expect(hasFreeLabel('GAIN_POWER')).toBe(false)
    expect(hasFreeLabel('FATE')).toBe(false)
  })
})
