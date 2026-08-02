// Revue des cartes du « Rapport de tests — Cartes » : cycle de la bordure au clic.

import { describe, it, expect } from 'vitest'
import { cardReviewOf, nextCardReview, entryOf, type Report } from '../model'

const report = (validated: string[], rejected: string[]): Report => ({
  version: 1,
  villains: { pj: { jules: {}, alexis: {}, validatedCards: validated, rejectedCards: rejected } as never },
})

describe('Revue d’une carte (bordure de la vignette)', () => {
  it('un clic fait défiler : pas revue → validée (verte) → NON validée (rouge) → pas revue', () => {
    expect(nextCardReview('none')).toBe('ok')
    expect(nextCardReview('ok')).toBe('ko')
    expect(nextCardReview('ko')).toBe('none')
  })

  it('lit l’état depuis les deux listes du rapport', () => {
    const e = entryOf(report(['a'], ['b']), 'pj')
    expect(cardReviewOf(e, 'a')).toBe('ok')
    expect(cardReviewOf(e, 'b')).toBe('ko')
    expect(cardReviewOf(e, 'c')).toBe('none')
  })

  it('un ancien rapport (sans `rejectedCards`) reste lisible : tout est validé ou neutre', () => {
    const legacy = { version: 1, villains: { pj: { validatedCards: ['a'] } } } as unknown as Report
    const e = entryOf(legacy, 'pj')
    expect(e.rejectedCards).toEqual([])
    expect(cardReviewOf(e, 'a')).toBe('ok')
    expect(cardReviewOf(e, 'z')).toBe('none')
  })
})
