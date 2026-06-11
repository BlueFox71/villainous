import { describe, it, expect } from 'vitest'
import { allCards } from '../registry'

/**
 * Les cardId doivent être uniques À TRAVERS TOUS les vilains : le registre
 * (getCardDef) indexe par cardId, donc une collision ferait résoudre la carte
 * d'un autre vilain (ex. la Disparition de Maléfique affichée comme celle de
 * Slenderman). Ce test garde l'invariant pour tout futur vilain.
 *
 * On importe `allCards` depuis le registre (et non une liste recopiée) pour que
 * tout nouveau vilain ajouté au registre soit automatiquement couvert ici.
 */
describe('Intégrité globale — unicité des cardId entre vilains', () => {
  it('aucun cardId partagé entre deux vilains', () => {
    const seen = new Map<string, number>()
    for (const c of allCards) seen.set(c.id, (seen.get(c.id) ?? 0) + 1)
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    expect(dups, `cardId en collision : ${dups.join(', ')}`).toEqual([])
  })
})
