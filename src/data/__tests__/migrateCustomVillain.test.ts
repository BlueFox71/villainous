// Verrouille le mécanisme de MIGRATION de format des vilains custom. À ce jour (format 1)
// il n'y a pas de palier : on vérifie la normalisation du formatVersion et l'idempotence.
// Quand un vrai palier N→N+1 sera ajouté, compléter ce fichier avec un cas dédié.

import { describe, it, expect } from 'vitest'
import { migrateCustomVillain, emptyCustomVillain, CUSTOM_VILLAIN_FORMAT, type CustomVillain } from '../customVillain'

describe('migrateCustomVillain', () => {
  it('pose le formatVersion courant sur un vilain sans version', () => {
    const raw = { ...emptyCustomVillain('2026-01-01T00:00:00.000Z') } as CustomVillain
    // Simule une donnée ancienne sans formatVersion.
    delete (raw as Partial<CustomVillain>).formatVersion
    const out = migrateCustomVillain(raw)
    expect(out.formatVersion).toBe(CUSTOM_VILLAIN_FORMAT)
  })

  it('est idempotent (une 2e passe ne change plus rien)', () => {
    const once = migrateCustomVillain(emptyCustomVillain('2026-01-01T00:00:00.000Z'))
    const twice = migrateCustomVillain(once)
    expect(twice).toEqual(once)
  })

  it('préserve les données de jeu existantes', () => {
    const v = emptyCustomVillain('2026-01-01T00:00:00.000Z')
    v.name = 'Vilain Test'
    v.objective = { type: 'POWER_THRESHOLD', threshold: 15 }
    const out = migrateCustomVillain(v)
    expect(out.name).toBe('Vilain Test')
    expect(out.objective).toEqual({ type: 'POWER_THRESHOLD', threshold: 15 })
  })
})
