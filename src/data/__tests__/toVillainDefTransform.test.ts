import { describe, it, expect } from 'vitest'
import { emptyCustomVillain, toVillainDef } from '../customVillain'

/** Vilain custom minimal avec un lieu transformable (face B) + un objectif alternatif. */
function transformableVillain() {
  const v = emptyCustomVillain('2026-01-01T00:00:00.000Z')
  // Lieu 0 : face B (nom + actions + image de colonne bakée).
  v.locations[0] = {
    ...v.locations[0],
    name: 'FACE A',
    alt: {
      name: 'FACE B',
      actions: [{ id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité' }],
      columnImage: 'colB.png',
    },
  }
  // Objectif alternatif.
  v.altObjective = {
    boardObjective: 'Obj B',
    objectiveDescription: 'Desc B',
    objective: { type: 'POWER_THRESHOLD', threshold: 30 },
  }
  v.altBoardImage = 'boardB.png'
  return v
}

describe('toVillainDef — lieux/objectif transformables', () => {
  it('émet la face B des lieux (altName/altActions/version/bColumnImage)', () => {
    const def = toVillainDef(transformableVillain())
    const loc0 = def.locations[0]
    expect(loc0.name).toBe('FACE A') // face A active au départ
    expect(loc0.version).toBe('a')
    expect(loc0.altName).toBe('FACE B')
    expect(loc0.altActions).toEqual([{ id: 'fate', type: 'FATE', row: 'top', label: 'Fatalité', amount: undefined }])
    expect(loc0.bColumnImage).toBe('colB.png')
  })

  it('un lieu SANS face B n’a pas de champs alt', () => {
    const def = toVillainDef(transformableVillain())
    const loc1 = def.locations[1]
    expect(loc1.altName).toBeUndefined()
    expect(loc1.altActions).toBeUndefined()
    expect(loc1.version).toBeUndefined()
  })

  it('émet l’objectif alternatif (condition + description + plateau baké)', () => {
    const def = toVillainDef(transformableVillain())
    expect(def.altObjective).toEqual({
      objective: { type: 'POWER_THRESHOLD', threshold: 30 },
      objectiveDescription: 'Desc B',
      boardImage: 'boardB.png',
    })
  })

  it('pas d’objectif alternatif → champ absent', () => {
    const v = emptyCustomVillain('2026-01-01T00:00:00.000Z')
    expect(toVillainDef(v).altObjective).toBeUndefined()
  })
})
