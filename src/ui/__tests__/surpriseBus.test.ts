import { describe, it, expect } from 'vitest'
import { villainHasSurprise } from '../surpriseBus'

describe('villainHasSurprise', () => {
  it('vrai pour un vilain dont le décor expose une surprise (natif)', () => {
    expect(villainHasSurprise('scar')).toBe(true) // décor `scar` (éruption)
    expect(villainHasSurprise('ursula')).toBe(true) // décor `grotto` (encre)
  })

  it('vrai pour un vilain PUBLIÉ (custom-…) dont le décor expose une surprise', () => {
    // Le Flagelleur Mental : décor `upsideDown`, surprise « la créature apparaît » (useSurpriseSub).
    // Régression : `upsideDown` doit figurer dans SURPRISE_KINDS, sinon le bouton ✨ du panneau de test
    // reste grisé pour ce vilain.
    expect(villainHasSurprise('custom-flagelleur-mental')).toBe(true)
    // Mr Monopoly : décor `monopoly`, surprise « la table renversée » (useSurpriseSub).
    expect(villainHasSurprise('custom-mr-monopoly')).toBe(true)
  })

  it('faux pour un décor SANS surprise', () => {
    expect(villainHasSurprise('princeJohn')).toBe(false) // `goldDust` : pas de surprise
    expect(villainHasSurprise('custom-gul-dan')).toBe(false) // `felGate` : pas de surprise
  })

  it('faux pour une clé inconnue (pas de décor)', () => {
    expect(villainHasSurprise('vilainInexistant')).toBe(false)
  })
})
