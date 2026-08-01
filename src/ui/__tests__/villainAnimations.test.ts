import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { villainAnimationList, VILLAIN_ANIMATION, CUSTOM_VILLAIN_ANIMATION } from '../villainAnimations'

/** Chemin disque d'un asset servi (les `image`/`images` des animations sont des chemins de `public/`). */
const publicPath = (src: string) => `public${src}`

describe('villainAnimations', () => {
  it('résout un vilain PUBLIÉ (custom-…) par son id runtime', () => {
    // Grand Councilwoman : le vaisseau de Stitch traverse le haut de l'écran (comme Kronk chez Yzma).
    const [anim, ...rest] = villainAnimationList('custom-stitch')
    expect(rest).toHaveLength(0)
    expect(anim.path).toBe('water-cross')
    expect(anim.facesLeft).toBe(true) // l'avant du vaisseau pointe à gauche au naturel
  })

  it('Michael Myers : une pluie de couteaux (path `coins` réutilisé)', () => {
    const [anim, ...rest] = villainAnimationList('custom-michael-meyers')
    expect(rest).toHaveLength(0)
    expect(anim.path).toBe('coins')
    // `coins` tire son image dans `images` : une entrée `image` seule ne produirait AUCUN objet.
    expect(anim.images).toEqual(['/animations/couteau_meyers.png'])
  })

  it('Isabella : les matricules s’impriment partout (path `tattoos`, sans aucun asset)', () => {
    const [anim, ...rest] = villainAnimationList('custom-isabella')
    expect(rest).toHaveLength(0)
    expect(anim.path).toBe('tattoos')
    // `tattoos` n'affiche QUE du texte : sans `texts`, le rendu ne produirait aucun matricule.
    expect(anim.texts?.length).toBeGreaterThan(0)
    expect(anim.texts).toContain('63194') // Emma
    expect(anim.image ?? anim.images).toBeUndefined() // 100 % texte : aucune image à charger
  })

  it('Thanos : la poussière monte (path `ashes`, sans aucun asset)', () => {
    const [anim, ...rest] = villainAnimationList('thanos')
    expect(rest).toHaveLength(0)
    expect(anim.path).toBe('ashes')
    // `ashes` est 100 % CSS : la densité fait tout le passage, aucune image n'est chargée.
    expect(anim.count).toBeGreaterThan(0)
    expect(anim.image ?? anim.images).toBeUndefined()
  })

  it('renvoie une liste vide pour une clé sans animation', () => {
    expect(villainAnimationList('custom-inexistant')).toEqual([])
  })

  // Garde-fou : les images d'animation vivent dans `assets/` (sources) et doivent être COPIÉES dans
  // `public/` pour être servies. Sans ce test, un oubli de copie ne se voit qu'en jeu (image cassée).
  it('toutes les images déclarées existent réellement dans public/', () => {
    const all = [...Object.values(VILLAIN_ANIMATION), ...Object.values(CUSTOM_VILLAIN_ANIMATION)]
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
    const files = [...new Set(all.flatMap((a) => [...(a.image ? [a.image] : []), ...(a.images ?? []), ...(a.sprite ? [a.sprite] : []), ...(a.video ? [a.video] : []), ...(a.overlayImage ? [a.overlayImage] : [])]))]
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => !existsSync(publicPath(f)))).toEqual([])
  })
})
