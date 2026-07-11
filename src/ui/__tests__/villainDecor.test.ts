import { describe, it, expect } from 'vitest'
import { villainDecor, VILLAIN_DECOR, CUSTOM_VILLAIN_DECOR } from '../villainDecor'

describe('villainDecor', () => {
  it('résout un vilain NATIF par sa VillainKey', () => {
    expect(villainDecor('patHibulaire')).toEqual({ kind: 'film' })
    expect(villainDecor('tabbou')).toEqual({ kind: 'underwater' })
  })

  it('résout un vilain PUBLIÉ (custom-…) par son id runtime', () => {
    // Le Flagelleur Mental n'est pas une VillainKey native → il doit être trouvé dans la table custom
    // (et NON rabattu sur un natif faute d'entrée).
    expect(villainDecor('custom-flagelleur-mental')).toEqual({ kind: 'upsideDown' })
    expect(villainDecor('custom-gul-dan')).toEqual({ kind: 'felGate' })
    expect(villainDecor('custom-dio')).toEqual({ kind: 'theWorld' })
    expect(villainDecor('custom-mr-monopoly')).toEqual({ kind: 'monopoly', src: '/animations/monopoly.png' })
  })

  it('renvoie undefined pour une clé inconnue (pas de repli silencieux)', () => {
    expect(villainDecor('custom-inexistant')).toBeUndefined()
    expect(villainDecor('vilainQuiNexistePas')).toBeUndefined()
  })

  it('les tables native et custom ne partagent aucune clé', () => {
    const nativeKeys = Object.keys(VILLAIN_DECOR)
    for (const k of Object.keys(CUSTOM_VILLAIN_DECOR)) expect(nativeKeys).not.toContain(k)
  })
})
