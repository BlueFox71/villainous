import { describe, it, expect } from 'vitest'
import { consolidateFighterDetails } from '../gameLogFighters'

describe('GameLog — consolidation des Combattants (Tabbou)', () => {
  it('fusionne les dévoilements en un résumé avec répartition par couleur', () => {
    expect(
      consolidateFighterDetails([
        'dévoile un Combattant « jaune ».',
        'dévoile un Combattant « marron ».',
      ]),
    ).toEqual(['dévoile 2 tuiles Combattant (1 jaune, 1 marron)'])
  })

  it('regroupe les couleurs identiques et accorde le pluriel', () => {
    expect(
      consolidateFighterDetails([
        'dévoile un Combattant « magenta ».',
        'dévoile un Combattant « rouge ».',
        'dévoile un Combattant « gris ».',
      ]),
    ).toEqual(['dévoile 3 tuiles Combattant (1 magenta, 1 rouge, 1 gris)'])
    expect(consolidateFighterDetails(['dévoile un Combattant « vert ».', 'dévoile un Combattant « vert ».'])).toEqual([
      'dévoile 2 tuiles Combattant (2 verts)',
    ])
  })

  it('reformate une mise à mort par couleur (Collection) avec accord', () => {
    expect(consolidateFighterDetails(['tue 2 Combattant(s) « bleu ».'])).toEqual(['tue 2 Combattants bleus'])
    expect(consolidateFighterDetails(['tue 1 Combattant(s) « gris ».'])).toEqual(['tue 1 Combattant gris'])
  })

  it('fusionne les mises à mort Coup Fatal (tuile par tuile) en un résumé', () => {
    expect(
      consolidateFighterDetails([
        'tue un Combattant « bleu » (Coup Fatal).',
        'tue un Combattant « rouge » (Coup Fatal).',
      ]),
    ).toEqual(['tue 2 Combattants (1 bleu, 1 rouge)'])
  })

  it('laisse intactes les lignes non liées aux Combattants', () => {
    expect(consolidateFighterDetails(['gagne 2 JT.'])).toEqual(['gagne 2 JT.'])
  })
})
