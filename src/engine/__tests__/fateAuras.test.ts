import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { effectiveStrength } from '../rules'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { crochet } from '../../data/villains/crochet'
import { crochetCards } from '../../data/villains/crochet.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

function gameWith(
  villain: typeof reineCoeur,
  cards: typeof reineCoeurCards,
  board: Record<string, CardInstance[]>,
): GameState {
  const g = createInitialGame(
    [{ villain, deckCards: buildDeckInstances(cards, 'villain', 'v:'), fateCards: buildDeckInstances(cards, 'fate', 'vf:') }],
    1,
  )
  return { ...g, players: [{ ...g.players[0], board: { ...g.players[0].board, ...board } }] }
}

const inst = (cards: typeof reineCoeurCards, deck: 'villain' | 'fate', cardId: string): CardInstance => {
  const built = buildDeckInstances(cards, deck, `${cardId}:`).find((c) => c.cardId === cardId)
  if (!built) throw new Error(`carte ${cardId} introuvable`)
  return built
}

describe('Auras de Héros Fatalité nouvellement codées', () => {
  it('Chapelier Fou + Lièvre de Mars : +2 mutuel (F5 chacun)', () => {
    const chap = inst(reineCoeurCards, 'fate', 'chapelier-fou')
    const lievre = inst(reineCoeurCards, 'fate', 'lievre-mars')
    const s = gameWith(reineCoeur, reineCoeurCards, { labyrinthe: [chap, lievre] })
    expect(effectiveStrength(s, 0, chap.instanceId)).toBe(5) // 3 + 2
    expect(effectiveStrength(s, 0, lievre.instanceId)).toBe(5) // 3 + 2
  })

  it('Chapelier Fou seul reste à F3', () => {
    const chap = inst(reineCoeurCards, 'fate', 'chapelier-fou')
    const s = gameWith(reineCoeur, reineCoeurCards, { labyrinthe: [chap] })
    expect(effectiveStrength(s, 0, chap.instanceId)).toBe(3)
  })

  it('La Chenille : −1 aux Alliés de son lieu', () => {
    const chenille = inst(reineCoeurCards, 'fate', 'chenille')
    const garde = inst(reineCoeurCards, 'villain', 'gardes-coeur') // F3
    const s = gameWith(reineCoeur, reineCoeurCards, { labyrinthe: [chenille, garde] })
    expect(effectiveStrength(s, 0, garde.instanceId)).toBe(2) // 3 − 1
  })

  it('Wendy (Crochet) : +1 aux autres Héros, pas à elle-même', () => {
    const wendy = inst(crochetCards, 'fate', 'wendy')
    const jean = inst(crochetCards, 'fate', 'jean') // F2
    const s = gameWith(crochet, crochetCards, { 'jolly-roger': [wendy, jean] })
    expect(effectiveStrength(s, 0, jean.instanceId)).toBe(3) // 2 + 1 (Wendy)
    expect(effectiveStrength(s, 0, wendy.instanceId)).toBe(3) // inchangée (excludeSelf)
  })

  it('Jean (Crochet) : +1 si un Objet lui est associé', () => {
    const jean = inst(crochetCards, 'fate', 'jean') // F2
    const sans = gameWith(crochet, crochetCards, { 'jolly-roger': [jean] })
    expect(effectiveStrength(sans, 0, jean.instanceId)).toBe(2)
    const dust = { ...inst(crochetCards, 'fate', 'poussiere-fee'), attachedTo: jean.instanceId }
    const avec = gameWith(crochet, crochetCards, { 'jolly-roger': [jean, dust] })
    expect(effectiveStrength(avec, 0, jean.instanceId)).toBe(5) // 2 + 2 (Poussière) + 1 (Jean)
  })

  it('Michel (Crochet) : +1 par lieu occupé par un Héros (le sien compris)', () => {
    const michel = inst(crochetCards, 'fate', 'michel') // F1
    const jean = inst(crochetCards, 'fate', 'jean')
    // Michel seul sur 1 lieu → 1 + 1 = 2.
    const un = gameWith(crochet, crochetCards, { 'jolly-roger': [michel] })
    expect(effectiveStrength(un, 0, michel.instanceId)).toBe(2)
    // Michel + un autre Héros sur un 2ᵉ lieu → 2 lieux à Héros → 1 + 2 = 3.
    const deux = gameWith(crochet, crochetCards, { 'jolly-roger': [michel], 'rocher-crane': [jean] })
    expect(effectiveStrength(deux, 0, michel.instanceId)).toBe(3)
  })
})
