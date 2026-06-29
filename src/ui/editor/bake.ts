// Génère et fige (« bake ») toutes les images d'un vilain personnalisé : faces de
// cartes (compositing canvas) + dos Vilain/Fatalité (depuis les couleurs). Le
// résultat est entièrement autosuffisant pour être stocké et JOUÉ tel quel.
import type { CustomVillain } from '../../data/customVillain'
import { FATE_CARD_COLOR } from '../../data/customVillain'
import { renderCardFace, renderCardBack } from './cardRender'
import { renderBoard } from './boardRender'
import { downscaleDataUrl } from './imageUtils'

/** Largeur de stockage des faces (suffisante à l'affichage en jeu, plus légère). */
const FACE_STORE_W = 720
const BACK_STORE_W = 600
const BOARD_STORE_W = 2000

/** Rend toutes les faces de cartes + les dos, et renvoie un CustomVillain prêt à jouer.
 *  `onProgress(done, total)` est appelé après chaque image figée (pour une barre de
 *  chargement). Total = nb de cartes + 3 (dos Vilain, dos Fatalité, plateau). */
export async function bakeVillain(
  v: CustomVillain,
  onProgress?: (done: number, total: number) => void,
): Promise<CustomVillain> {
  const total = v.cards.length + 3
  let done = 0
  const tick = () => onProgress?.(++done, total)
  // Types personnalisés utilisés dans le deck (nom + couleur) → coloration de leurs
  // références dans le texte de règle, comme dans l'éditeur.
  const customTypes = v.cards
    .filter((c) => c.typeLabel && c.typeColor)
    .map((c) => ({ label: c.typeLabel!, color: c.typeColor! }))
  // Séquentiel (et non Promise.all) pour une progression fluide de la barre.
  const cards: typeof v.cards = []
  for (const c of v.cards) {
    const face = await renderCardFace(c, v.color, FATE_CARD_COLOR, {}, customTypes)
    const image = await downscaleDataUrl(face, FACE_STORE_W)
    cards.push({ ...c, image })
    tick()
  }
  // Dos Vilain = couleur thématique ; dos Fatalité = blanc (parchemin d'origine).
  // Les ornements importés (backOverlays) sont superposés aux DEUX dos.
  const backVillainImage = await downscaleDataUrl(
    await renderCardBack(v.color, v.name, { overlays: v.backOverlays }),
    BACK_STORE_W,
  )
  tick()
  const backFateImage = await downscaleDataUrl(
    await renderCardBack(FATE_CARD_COLOR, v.name, { paper: true, overlays: v.backOverlays }),
    BACK_STORE_W,
  )
  tick()
  const boardImage = await downscaleDataUrl(await renderBoard(v), BOARD_STORE_W, 'image/jpeg', 0.9)
  tick()
  return { ...v, cards, backVillainImage, backFateImage, boardImage }
}
