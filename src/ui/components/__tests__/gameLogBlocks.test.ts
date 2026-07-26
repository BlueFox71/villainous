import { describe, it, expect } from 'vitest'
import { groupLog } from '../gameLogBlocks'

const NAMES = ['Le Seigneur des clés', 'Hadès']

describe('GameLog — découpage en blocs', () => {
  it('« Obtenir une clé » fait son propre bloc (dé + ramassage), avec le jeton de clé', () => {
    const blocks = groupLog(
      [
        'Le Seigneur des clés se déplace vers **Crypte**.',
        'Le Seigneur des clés gagne 3 JT (total : 4).',
        'Dé : **rouge** — Le Seigneur des clés peut prendre une clé rouge sur le plateau (Obtenir une clé).',
        'Le Seigneur des clés ramasse une clé rouge.',
      ],
      NAMES,
    )
    // 3 blocs : déplacement, gain de Pouvoir, clé — le gain ne « mange » plus la clé.
    expect(blocks).toHaveLength(3)
    const key = blocks[2]
    expect(key.type).toBe('action')
    if (key.type !== 'action') return
    expect(key.playerIndex).toBe(0)
    expect(key.head).toMatch(/^Dé : \*\*rouge\*\*/)
    expect(key.details).toEqual(['ramasse une clé rouge.'])
    expect(key.keyImage).toBe('/cards/seigneur-cles/cle-rouge.webp')
  })

  it('une clé reposée (accord féminin) fait aussi son bloc', () => {
    const blocks = groupLog(
      [
        'Le Seigneur des clés gagne 1 JT (total : 5).',
        'Le Seigneur des clés repose une clé bleue sur **Cachot**.',
      ],
      NAMES,
    )
    expect(blocks).toHaveLength(2)
    const key = blocks[1]
    if (key.type !== 'action') throw new Error('bloc action attendu')
    expect(key.keyImage).toBe('/cards/seigneur-cles/cle-bleu.webp')
  })

  it('un Héros déplacé (« rejoint ») garde son bloc à part', () => {
    const blocks = groupLog(
      ['Le Seigneur des clés gagne 1 JT (total : 2).', '**Élisabeth Bathory** rejoint **Fosse commune**.'],
      NAMES,
    )
    expect(blocks).toHaveLength(2)
    const move = blocks[1]
    if (move.type !== 'action') throw new Error('bloc action attendu')
    expect(move.head).toContain('rejoint')
    expect(move.keyImage).toBeUndefined()
  })
})
