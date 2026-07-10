// Verrouille la recopie GÉNÉRIQUE de buildDeckInstances (cf. refonte « champ de données
// unique ») : tout champ de JEU d'une CardDef atterrit dans la CardInstance, et les champs
// de PRÉSENTATION / deck-building / éditeur en sont exclus. Le garde-fou de PARITÉ
// CardDef↔CardInstance est, lui, assuré au compile-time (type _GameFieldsOnInstance).

import { describe, it, expect } from 'vitest'
import { buildDeckInstances, type CardDef } from '../types'
import { toDeckCardDefs, type CustomVillain, emptyCustomVillain } from '../customVillain'

/** CardDef minimale d'Allié avec quelques champs de jeu variés à vérifier. */
function allyDef(over: Partial<CardDef> = {}): CardDef {
  return {
    id: 'test-ally',
    name: 'Testeur',
    englishName: 'Tester',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 1,
    text: 'Texte de règle.',
    image: '/cards/test/ally.png',
    isHyena: true, // champ de jeu booléen
    powerOnMove: 2, // champ de jeu numérique
    ...over,
  }
}

describe('buildDeckInstances — recopie générique des champs de jeu', () => {
  it('recopie les champs de JEU (identité + arbitraires) dans la CardInstance', () => {
    const [inst] = buildDeckInstances([allyDef()], 'villain', 'p0:')
    expect(inst.instanceId).toBe('p0:test-ally#1')
    expect(inst.cardId).toBe('test-ally')
    expect(inst.name).toBe('Testeur')
    expect(inst.type).toBe('ally')
    expect(inst.cost).toBe(2)
    expect(inst.strength).toBe(3)
    // Champs de jeu variés, sans liste à maintenir dans buildDeckInstances :
    expect(inst.isHyena).toBe(true)
    expect(inst.powerOnMove).toBe(2)
  })

  it('EXCLUT les champs de présentation / deck-building', () => {
    const [inst] = buildDeckInstances([allyDef()], 'villain')
    const rec = inst as unknown as Record<string, unknown>
    for (const k of ['englishName', 'deck', 'copies', 'text', 'image', 'id', 'costVariable', 'fateMalus']) {
      expect(rec[k], `le champ « ${k} » ne doit pas être recopié`).toBeUndefined()
    }
  })

  it('génère un exemplaire par `copies`, avec des instanceId uniques', () => {
    const insts = buildDeckInstances([allyDef({ copies: 3 })], 'villain', 'p1:')
    expect(insts.map((i) => i.instanceId)).toEqual(['p1:test-ally#1', 'p1:test-ally#2', 'p1:test-ally#3'])
  })

  it("n'inclut que les cartes du deck demandé", () => {
    const cards = [allyDef({ id: 'v1', deck: 'villain' }), allyDef({ id: 'f1', deck: 'fate', type: 'hero' })]
    expect(buildDeckInstances(cards, 'villain').map((i) => i.cardId)).toEqual(['v1'])
    expect(buildDeckInstances(cards, 'fate').map((i) => i.cardId)).toEqual(['f1'])
  })

  it('ne laisse PAS fuiter les champs ÉDITEUR des cartes custom (via toDeckCardDefs)', () => {
    const v: CustomVillain = emptyCustomVillain('2026-01-01T00:00:00.000Z')
    v.cards = [
      {
        id: 'custom-card',
        name: 'Carte perso',
        englishName: '',
        deck: 'villain',
        type: 'ally',
        copies: 1,
        text: '',
        image: '',
        strength: 4,
        // champs ÉDITEUR (propres à l'Atelier), à ne jamais recopier dans une instance :
        artImage: 'data:image/png;base64,AAAA',
        artTransform: { scale: 1, offsetXPct: 0, offsetYPct: 0 },
        typeLabel: 'Sbire',
        typeColor: '#fff',
        textLayout: { x: 50, y: 80, w: 79, size: 50 },
        stickers: [{ id: 's1', type: 'GAIN_POWER', x: 10, y: 10, size: 14 }],
      },
    ]
    const [inst] = buildDeckInstances(toDeckCardDefs(v), 'villain')
    const rec = inst as unknown as Record<string, unknown>
    expect(inst.strength).toBe(4) // le champ de jeu passe
    for (const k of ['artImage', 'artTransform', 'typeLabel', 'typeColor', 'textLayout', 'stickers', 'group']) {
      expect(rec[k], `le champ éditeur « ${k} » ne doit pas fuiter`).toBeUndefined()
    }
  })
})
