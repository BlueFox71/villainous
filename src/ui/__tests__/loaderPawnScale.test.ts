// Taille du pion sur l'ÉCRAN DE CHARGEMENT (`loaderPawnScale`), réglée par vilain dans le
// panneau « Configuration » puis écrite dans `PRESENTATION_TWEAK`.

import { describe, it, expect } from 'vitest'
import { savedArtTweak, buildArtTweakEntry, loaderPawnScale, PRESENTATION_TWEAK } from '../villainArt'

describe('Taille du pion à l’écran de chargement', () => {
  it('vaut 1 (taille du plateau) tant qu’aucun réglage n’est enregistré', () => {
    expect(loaderPawnScale('vilain-sans-reglage')).toBe(1)
    expect(savedArtTweak('vilain-sans-reglage').pawnScale).toBe(1)
  })

  it('s’écrit dans l’entrée du vilain, à côté des champs de l’illustration', () => {
    const draft = { ...savedArtTweak('princeJohn'), pawnScale: 1.4 }
    expect(buildArtTweakEntry('princeJohn', draft)).toContain('loaderPawnScale: 1.4')
  })

  it('une taille NEUTRE (1) ne laisse aucun champ derrière elle', () => {
    const draft = { ...savedArtTweak('princeJohn'), pawnScale: 1 }
    expect(buildArtTweakEntry('princeJohn', draft)).not.toContain('loaderPawnScale')
  })

  it('n’efface pas le cadrage de l’illustration déjà enregistré', () => {
    const entry = buildArtTweakEntry('princeJohn', { ...savedArtTweak('princeJohn'), pawnScale: 1.4 })
    // Prince Jean a un cadrage `select…` réglé de longue date : il doit survivre.
    expect(entry).toContain('selectScale')
    expect(entry).toContain('selectDxPct')
  })

  it('les valeurs enregistrées à la main sont relues telles quelles', () => {
    // Balaie les entrées réelles : toute valeur posée dans le fichier doit ressortir.
    for (const [key, t] of Object.entries(PRESENTATION_TWEAK)) {
      if (t.loaderPawnScale !== undefined) expect(loaderPawnScale(key)).toBe(t.loaderPawnScale)
    }
  })
})
