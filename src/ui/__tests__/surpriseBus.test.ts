import { describe, it, expect } from 'vitest'
import { villainHasSurprise } from '../surpriseBus'
import { VILLAIN_DECOR } from '../villainDecor'

describe('villainHasSurprise', () => {
  it('vrai pour un vilain dont le décor expose une surprise (natif)', () => {
    expect(villainHasSurprise('scar')).toBe(true) // décor `scar` (éruption)
    expect(villainHasSurprise('ursula')).toBe(true) // décor `grotto` (encre)
    // Thanos : décor `titan`, surprise « LE CLAQUEMENT » (useSurpriseSub).
    expect(villainHasSurprise('thanos')).toBe(true)
    // Jafar : décor `sand`, surprise « l'hypnose du sceptre » (useSurpriseSub).
    expect(villainHasSurprise('jafar')).toBe(true)
    // Pat Hibulaire : décor `film`, surprise « la pellicule casse » (useSurpriseSub).
    expect(villainHasSurprise('patHibulaire')).toBe(true)
    // Prince Jean : décor `goldDust`, surprise « le coffre déborde » (useSurpriseSub).
    expect(villainHasSurprise('princeJohn')).toBe(true)
    // Maléfique : décor `thorns`, surprise « Touchez le fuseau… » (useSurpriseSub).
    expect(villainHasSurprise('maleficent')).toBe(true)
    // L'Imposteur : décor `space`, surprise « sabotage — fusion du réacteur » (useSurpriseSub).
    expect(villainHasSurprise('imposteur')).toBe(true)
    // Reine de Cœur : décor `petals`, surprise « Qu'on lui coupe la tête ! » (useSurpriseSub).
    expect(villainHasSurprise('reineCoeur')).toBe(true)
    // Méchante Reine : décor `evilQueen`, surprise « Miroir, mon beau miroir » (useSurpriseSub).
    expect(villainHasSurprise('mechanteReine')).toBe(true)
    // Capitaine Crochet : décor `water`, surprise « la bordée » (useSurpriseSub).
    expect(villainHasSurprise('crochet')).toBe(true)
    // Sa Sucrerie : décor `candy`, surprise « TURBO ! » (useSurpriseSub).
    expect(villainHasSurprise('saSucrerie')).toBe(true)
    // La Bonne Fée : décor `laBonneFee`, surprise « Holding Out for a Hero » (useSurpriseSub).
    expect(villainHasSurprise('laBonneFee')).toBe(true)
  })

  it('vrai pour un vilain PUBLIÉ (custom-…) dont le décor expose une surprise', () => {
    // Le Flagelleur Mental : décor `upsideDown`, surprise « la créature apparaît » (useSurpriseSub).
    // Régression : `upsideDown` doit figurer dans SURPRISE_KINDS, sinon le bouton ✨ du panneau de test
    // reste grisé pour ce vilain.
    expect(villainHasSurprise('custom-flagelleur-mental')).toBe(true)
    // Mr Monopoly : décor `monopoly`, surprise « la table renversée » (useSurpriseSub).
    expect(villainHasSurprise('custom-mr-monopoly')).toBe(true)
    // Le Seigneur des clés : décor `atmosfear`, surprise « la clé noire » (useSurpriseSub).
    expect(villainHasSurprise('custom-seigneur-cles')).toBe(true)
    // Gul'dan : décor `felGate`, surprise « le Portail des Ténèbres » (useSurpriseSub).
    expect(villainHasSurprise('custom-gul-dan')).toBe(true)
    // Grand Councilwoman : décor `federation`, surprise « le rayon de capture » (useSurpriseSub).
    expect(villainHasSurprise('custom-stitch')).toBe(true)
    // Dio : décor `theWorld`, surprise « ZA WARUDO ! » (l'arrêt du temps, useSurpriseSub).
    expect(villainHasSurprise('custom-dio')).toBe(true)
    // Michael Myers : décor `haddonfield`, surprise « The Shape » (useSurpriseSub).
    expect(villainHasSurprise('custom-michael-meyers')).toBe(true)
    // Ultron : décor `ultronFactory`, surprise « Sokovia s'élève » (useSurpriseSub).
    expect(villainHasSurprise('custom-ultron')).toBe(true)
    // Isabella : décor `graceField`, surprise « la Moisson » (useSurpriseSub).
    expect(villainHasSurprise('custom-isabella')).toBe(true)
  })

  // Depuis « Holding Out for a Hero » (La Bonne Fée), plus AUCUN décor natif n'est sans surprise.
  // Cet invariant remplace l'ancien cas « faux pour un décor SANS surprise » : il attrape l'oubli
  // classique — un décor tout neuf dont le `kind` n'a pas été ajouté à SURPRISE_KINDS, ce qui laisse
  // le bouton ✨ de l'outil de test grisé. Un futur décor volontairement sans surprise devra donc
  // être listé ici en exception.
  it('tous les décors natifs câblés exposent une surprise', () => {
    expect(Object.keys(VILLAIN_DECOR).filter((k) => !villainHasSurprise(k))).toEqual([])
  })

  it('faux pour une clé inconnue (pas de décor)', () => {
    expect(villainHasSurprise('vilainInexistant')).toBe(false)
  })
})
