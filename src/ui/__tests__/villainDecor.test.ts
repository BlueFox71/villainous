import { describe, it, expect } from 'vitest'
import { villainDecor, decorAssets, VILLAIN_DECOR, CUSTOM_VILLAIN_DECOR } from '../villainDecor'

describe('villainDecor', () => {
  it('résout un vilain NATIF par sa VillainKey', () => {
    expect(villainDecor('patHibulaire')).toEqual({ kind: 'film' })
    expect(villainDecor('tabbou')).toEqual({ kind: 'underwater' })
    // Thanos : Titan et son Gantelet-jauge.
    expect(villainDecor('thanos')).toEqual({ kind: 'titan' })
  })

  it('le décor `sand` (Jafar) est 100 % CSS : aucun asset à précharger', () => {
    // Le sablier ET sa surprise « la tempête de sable » (voile, nappes, bourrasques, dune) sont
    // entièrement dessinés en CSS : une entrée d'asset ici signifierait qu'on y a glissé une image.
    expect(decorAssets({ kind: 'sand' })).toEqual({ images: [], videos: [] })
  })

  it('le décor `titan` (Thanos) déclare le Gantelet à précharger', () => {
    // Seul asset du décor : l'illustration du Gantelet, support de la jauge (ciel, tours brisées,
    // blocs en suspension, cendres et gemmes sont en CSS). Sans préchargement, la jauge apparaîtrait
    // après coup au montage du décor.
    expect(decorAssets({ kind: 'titan' })).toEqual({
      images: ['/animations/gantelet_thanos.webp'],
      videos: [],
    })
  })

  it('résout un vilain PUBLIÉ (custom-…) par son id runtime', () => {
    // Le Flagelleur Mental n'est pas une VillainKey native → il doit être trouvé dans la table custom
    // (et NON rabattu sur un natif faute d'entrée).
    expect(villainDecor('custom-flagelleur-mental')).toEqual({ kind: 'upsideDown' })
    expect(villainDecor('custom-gul-dan')).toEqual({ kind: 'felGate' })
    expect(villainDecor('custom-dio')).toEqual({ kind: 'theWorld' })
    expect(villainDecor('custom-mr-monopoly')).toEqual({ kind: 'monopoly', src: '/animations/monopoly.png' })
    expect(villainDecor('custom-mrl4fb45')).toEqual({ kind: 'rift' })
    // Killaire (skin de Sumbra) : le décor lumineux `radiance`, distinct du `rift` de Sumbra.
    expect(villainDecor('custom-killaire')).toEqual({ kind: 'radiance' })
    expect(villainDecor('custom-pyramid-head')).toEqual({ kind: 'otherworld' })
    expect(villainDecor('custom-stitch')).toEqual({ kind: 'federation' })
    expect(villainDecor('custom-michael-meyers')).toEqual({ kind: 'haddonfield' })
    expect(villainDecor('custom-ultron')).toEqual({ kind: 'ultronFactory' })
    expect(villainDecor('custom-isabella')).toEqual({
      kind: 'graceField',
      home: '/animations/maison_grace_field.webp',
      vida: '/animations/fleur_vida.webp',
    })
  })

  it('le décor `ultronFactory` est 100 % CSS (rien à précharger)', () => {
    expect(decorAssets({ kind: 'ultronFactory' })).toEqual({ images: [], videos: [] })
  })

  it('le décor `graceField` déclare la maison et la fleur Vida à précharger', () => {
    // Les deux seuls assets du décor : la maison (permanente) et la fleur Vida de la surprise
    // « la Moisson » (mur, forêt, pelouse, herbes, lucioles et matricules sont 100 % CSS).
    expect(
      decorAssets({
        kind: 'graceField',
        home: '/animations/maison_grace_field.webp',
        vida: '/animations/fleur_vida.webp',
      }),
    ).toEqual({
      images: ['/animations/maison_grace_field.webp', '/animations/fleur_vida.webp'],
      videos: [],
    })
  })

  it('le décor `haddonfield` déclare la citrouille et la silhouette à précharger', () => {
    // Les deux seuls assets du décor (citrouille permanente + « The Shape ») ; la rue, le
    // lampadaire, la brume et les feuilles sont 100 % CSS.
    expect(decorAssets({ kind: 'haddonfield' })).toEqual({
      images: ['/animations/citrouille_meyers.png', '/animations/silhouette_meyers.png'],
      videos: [],
    })
  })

  it('le décor `federation` déclare la silhouette de Stitch à précharger', () => {
    // Seul asset du décor : Stitch pris dans le rayon de capture (le reste est 100 % CSS).
    expect(decorAssets({ kind: 'federation' })).toEqual({ images: ['/animations/stitch.png'], videos: [] })
  })

  it('le décor `otherworld` déclare ses cages et sa chaîne à précharger', () => {
    expect(decorAssets({ kind: 'otherworld' })).toEqual({
      images: ['/animations/cage-1.png', '/animations/cage-2.png', '/animations/cage-3.png', '/animations/chaine.png'],
      videos: [],
    })
  })

  it('le décor `evilQueen` déclare la pomme ET le masque du miroir à précharger', () => {
    // La pomme (permanente) + le masque de la surprise « Miroir, mon beau miroir » : sans
    // préchargement, le masque apparaîtrait après coup au milieu des flammes. Le miroir lui-même
    // (cadre, glace, flammes, volutes) est 100 % CSS.
    expect(decorAssets(VILLAIN_DECOR.mechanteReine!)).toEqual({
      images: ['/animations/apple.png', '/animations/masque_miroir.webp'],
      videos: ['/animations/smoke.mp4'],
    })
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
