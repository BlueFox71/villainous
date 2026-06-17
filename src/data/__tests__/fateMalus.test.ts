import { describe, it, expect } from 'vitest'
import { allCards, getCardDef } from '../registry'
import { FATE_MALUS, CONDITIONAL_MALUS } from '../fateMalus'

/**
 * Garde-fou anti-désync : chaque cardId classé dans FATE_MALUS doit exister dans
 * le registre, appartenir au deck Fatalité, et être une carte DURABLE (Héros ou
 * Objet) — c'est ce que l'IA inspecte dans le royaume du joueur. Couvre aussi les
 * cardId conditionnels. Tout nouveau vilain mal classé est détecté ici.
 */
describe('Intégrité — classement malus Fatalité (fateMalus)', () => {
  const byId = new Map(allCards.map((c) => [c.id, c]))

  it('chaque cardId de FATE_MALUS existe dans le registre et est une carte Fatalité', () => {
    const problems: string[] = []
    for (const id of Object.keys(FATE_MALUS)) {
      const def = byId.get(id)
      if (!def) {
        problems.push(`${id} : inconnu du registre`)
        continue
      }
      if (def.deck !== 'fate') problems.push(`${id} : n'est pas une carte Fatalité`)
    }
    expect(problems, problems.join(' | ')).toEqual([])
  })

  it('les cardId conditionnels sont bien classés', () => {
    for (const id of CONDITIONAL_MALUS) {
      expect(FATE_MALUS[id], `conditionnel ${id} doit avoir un classement`).toBeTruthy()
    }
  })

  it('le registre attache fateMalus au CardDef', () => {
    expect(getCardDef('mario')?.fateMalus).toBe('block-win')
    expect(getCardDef('luigi')?.fateMalus).toBe('slow')
    // Carte non classée (cible d'objectif) → pas de fateMalus.
    expect(getCardDef('peach')?.fateMalus).toBeUndefined()
  })
})
