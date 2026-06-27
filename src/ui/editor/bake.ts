// Génère et fige (« bake ») toutes les images d'un vilain personnalisé : faces de
// cartes (compositing canvas) + dos Vilain/Fatalité (depuis les couleurs). Le
// résultat est entièrement autosuffisant pour être stocké et JOUÉ tel quel.
import type { CustomVillain } from '../../data/customVillain'
import { renderCardFace, renderCardBack } from './cardRender'
import { renderBoard } from './boardRender'
import { downscaleDataUrl } from './imageUtils'

/** Largeur de stockage des faces (suffisante à l'affichage en jeu, plus légère). */
const FACE_STORE_W = 720
const BACK_STORE_W = 600
const BOARD_STORE_W = 2000

/** Rend toutes les faces de cartes + les dos, et renvoie un CustomVillain prêt à jouer. */
export async function bakeVillain(v: CustomVillain): Promise<CustomVillain> {
  const cards = await Promise.all(
    v.cards.map(async (c) => {
      const face = await renderCardFace(c, v.color, v.fateBackColor)
      const image = await downscaleDataUrl(face, FACE_STORE_W)
      return { ...c, image }
    }),
  )
  const backVillainImage = await downscaleDataUrl(await renderCardBack(v.villainBackColor, v.name), BACK_STORE_W)
  const backFateImage = await downscaleDataUrl(await renderCardBack(v.fateBackColor, v.name), BACK_STORE_W)
  const boardImage = await downscaleDataUrl(await renderBoard(v), BOARD_STORE_W, 'image/jpeg', 0.9)
  return { ...v, cards, backVillainImage, backFateImage, boardImage }
}
