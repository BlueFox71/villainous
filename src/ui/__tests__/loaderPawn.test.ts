// Pion de l'ÉCRAN DE CHARGEMENT réglé par vilain (taille `loaderPawnScale` et image dédiée
// `loaderPawnImage`) dans le panneau « Configuration », puis écrit dans `PRESENTATION_TWEAK`.

import { describe, it, expect } from 'vitest'
import {
  savedArtTweak,
  buildArtTweakEntry,
  loaderPawnScale,
  loaderPawnImage,
  loaderPawnImagePath,
  PRESENTATION_TWEAK,
} from '../villainArt'

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

describe('Image du pion à l’écran de chargement', () => {
  it('sans pion dédié, rien n’est renvoyé (l’appelant garde celui du plateau)', () => {
    expect(loaderPawnImage('vilain-sans-pion-dedie')).toBeUndefined()
    expect(savedArtTweak('vilain-sans-pion-dedie').pawnImage).toBe(false)
  })

  it('le drapeau suffit : le chemin du fichier suit la convention de nommage', () => {
    expect(loaderPawnImagePath('princeJohn')).toBe('/pions-chargement/princeJohn.png')
    expect(loaderPawnImagePath('custom-michael-meyers')).toBe('/pions-chargement/custom-michael-meyers.png')
  })

  it('s’écrit en drapeau dans l’entrée du vilain, et disparaît si on revient au plateau', () => {
    const base = savedArtTweak('princeJohn')
    expect(buildArtTweakEntry('princeJohn', { ...base, pawnImage: true })).toContain('loaderPawnImage: true')
    expect(buildArtTweakEntry('princeJohn', { ...base, pawnImage: false })).not.toContain('loaderPawnImage')
  })

  it('toute entrée réelle qui porte le drapeau expose bien son chemin', () => {
    for (const [key, t] of Object.entries(PRESENTATION_TWEAK)) {
      expect(loaderPawnImage(key)).toBe(t.loaderPawnImage ? loaderPawnImagePath(key) : undefined)
    }
  })
})
