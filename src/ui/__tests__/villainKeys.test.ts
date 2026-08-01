import { describe, it, expect } from 'vitest'
import type { GameState } from '../../engine/types'
import { villainKeysOfState } from '../store/gameStore'

/** `PlayerState.villain` porte l'ID du VillainDef ; seul `villain` est lu ici. */
const stateWith = (a: string, b: string) =>
  ({ players: [{ villain: a }, { villain: b }] }) as unknown as GameState

describe('villainKeysOfState — id de VillainDef → clé de registre', () => {
  it('convertit les ids natifs dont l’id diffère de la clé', () => {
    // Régression : sans conversion, `setupForKey` ne reconnaissait pas ces ids et
    // repliait les DEUX joueurs sur le Prince Jean (perte des vilains en mode test).
    expect(villainKeysOfState(stateWith('davy-jones', 'mechante-reine'))).toEqual([
      'davyJones',
      'mechanteReine',
    ])
    expect(villainKeysOfState(stateWith('shere-khan', 'seigneur-tenebres'))).toEqual([
      'shereKhan',
      'seigneurTenebres',
    ])
  })

  it('laisse passer les ids déjà identiques à leur clé', () => {
    expect(villainKeysOfState(stateWith('princeJohn', 'maleficent'))).toEqual([
      'princeJohn',
      'maleficent',
    ])
  })

  it('laisse les ids custom tels quels (déjà des clés)', () => {
    expect(villainKeysOfState(stateWith('custom-dio', 'jafar'))).toEqual(['custom-dio', 'jafar'])
  })
})
