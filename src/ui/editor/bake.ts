// Génère et fige (« bake ») toutes les images d'un vilain personnalisé : faces de
// cartes (compositing canvas) + dos Vilain/Fatalité (depuis les couleurs). Le
// résultat est entièrement autosuffisant pour être stocké et JOUÉ tel quel.
import type { CustomVillain } from '../../data/customVillain'
import { FATE_CARD_COLOR, extraBackColor, extraBackPaper } from '../../data/customVillain'
import { renderCardFace, renderCardBack } from './cardRender'
import { renderBoard, renderLocationColumnB, renderAltObjectiveBoard, boardSignature } from './boardRender'
import { downscaleDataUrl } from './imageUtils'

/** Largeur de stockage des faces (suffisante à l'affichage en jeu, plus légère). */
const FACE_STORE_W = 720
const BACK_STORE_W = 600
const BOARD_STORE_W = 2000
/** Largeur de stockage d'une image de colonne (face B d'un lieu). */
const COLUMN_STORE_W = 520

/** Rend toutes les faces de cartes + les dos, et renvoie un CustomVillain prêt à jouer.
 *  `onProgress(done, total, phase)` est appelé après chaque image figée (pour une barre de
 *  chargement à étapes nommées : « Génération des cartes / des dos / du plateau… »).
 *  Total = nb de cartes + 3 (dos Vilain, dos Fatalité, plateau) + extras. */
export async function bakeVillain(
  v: CustomVillain,
  onProgress?: (done: number, total: number, phase: string) => void,
): Promise<CustomVillain> {
  // 3e dos (paquets perso) : seulement si un dos est configuré ET qu'au moins un
  // paquet personnalisé existe.
  const hasExtraBack = !!v.backExtra && (v.extraDecks?.length ?? 0) > 0
  // +3 : dos Vilain, dos Fatalité, plateau. +1 par lieu transformable (colonne face B).
  // +1 si objectif alternatif (plateau face B). +1 si 3e dos.
  const altLocCount = v.locations.filter((l) => l.alt).length
  const total =
    v.cards.length + 3 + altLocCount + (v.altObjective ? 1 : 0) + (hasExtraBack ? 1 : 0)
  let done = 0
  const tick = (phase: string) => onProgress?.(++done, total, phase)
  // Types personnalisés utilisés dans le deck (nom + couleur) → coloration de leurs
  // références dans le texte de règle, comme dans l'éditeur.
  const customTypes = v.cards
    .filter((c) => c.typeLabel && c.typeColor)
    .map((c) => ({ label: c.typeLabel!, color: c.typeColor! }))
  // Mots-clés colorés du vilain : mêmes canaux que les types (label → couleur).
  const wordColors = [...customTypes, ...(v.keywordColors ?? [])]
  // Une image EXTERNE (chemin/URL servie depuis public/, pas une dataURL) n'est pas
  // reproductible par le renderer : on la CONSERVE telle quelle au lieu de la re-baker
  // (sinon on obtiendrait une carte/plateau vide). Cas des vilains migrés dont les
  // visuels sont des PNG pré-rendus (ex. Flagelleur Mental).
  const isExternal = (img?: string) => !!img && !img.startsWith('data:')
  // Séquentiel (et non Promise.all) pour une progression fluide de la barre.
  const cards: typeof v.cards = []
  for (const c of v.cards) {
    if (isExternal(c.image)) {
      cards.push(c) // image pré-rendue : gardée intacte
      tick('Génération des cartes')
      continue
    }
    const face = await renderCardFace(c, v.color, FATE_CARD_COLOR, {}, wordColors)
    const image = await downscaleDataUrl(face, FACE_STORE_W)
    cards.push({ ...c, image })
    tick('Génération des cartes')
  }
  // Dos Vilain = couleur thématique ; dos Fatalité = blanc (parchemin d'origine).
  // Les ornements importés (backOverlays) sont superposés aux DEUX dos.
  const backVillainImage = isExternal(v.backVillainImage)
    ? v.backVillainImage!
    : await downscaleDataUrl(
        await renderCardBack(v.color, v.name, { overlays: v.backOverlays }),
        BACK_STORE_W,
      )
  tick('Génération des dos')
  const backFateImage = isExternal(v.backFateImage)
    ? v.backFateImage!
    : await downscaleDataUrl(
        await renderCardBack(FATE_CARD_COLOR, v.name, { paper: true, overlays: v.backOverlays }),
        BACK_STORE_W,
      )
  tick('Génération des dos')
  // 3e dos (paquets personnalisés) : couleur au choix (Vilain / Fatalité / libre) +
  // ornements recolorés. Traitement parchemin si mode Fatalité ou couleur libre claire.
  let backExtraImage: string | undefined
  if (hasExtraBack) {
    const cfg = v.backExtra!
    backExtraImage = await downscaleDataUrl(
      await renderCardBack(extraBackColor(v), v.name, {
        paper: extraBackPaper(v),
        overlays: cfg.overlays,
        ornamentColor: cfg.ornamentColor,
      }),
      BACK_STORE_W,
    )
    tick('Génération des dos')
  }
  // Plateau : une fois le vilain publié, `boardImage` est un CHEMIN (fichier sous
  // public/cards/) — la garde `isExternal` le gelait alors DÉFINITIVEMENT et aucune
  // modification du plateau n'apparaissait plus en jeu. On compare donc la signature
  // de ses données à celle du dernier rendu : identique = on garde le fichier,
  // différente = on re-génère. Sans signature mémorisée (vilains publiés avant), on
  // re-génère dès qu'on a de quoi redessiner (illustration ou image de lieu) et on
  // conserve l'image figée sinon.
  const boardSig = boardSignature(v)
  const canRedraw = !!v.boardArt || v.locations.some((l) => l.image)
  const boardFrozen =
    isExternal(v.boardImage) && (v.boardSig === boardSig || (v.boardSig === undefined && !canRedraw))
  const boardImage = boardFrozen
    ? v.boardImage!
    : await downscaleDataUrl(await renderBoard(v), BOARD_STORE_W, 'image/webp', 0.9)
  tick('Génération du plateau')
  // Lieux TRANSFORMABLES : image de colonne bakée pour la face B (superposée en jeu).
  const locations: CustomVillain['locations'] = []
  for (let i = 0; i < v.locations.length; i++) {
    const loc = v.locations[i]
    if (!loc.alt) {
      locations.push(loc)
      continue
    }
    const columnImage = await downscaleDataUrl(await renderLocationColumnB(v, i), COLUMN_STORE_W)
    locations.push({ ...loc, alt: { ...loc.alt, columnImage } })
    tick('Génération des lieux')
  }
  // Objectif ALTERNATIF : plateau de la face B (image vilain + texte alternatifs).
  const altBoardImage = v.altObjective
    ? await downscaleDataUrl(await renderAltObjectiveBoard(v), BOARD_STORE_W, 'image/webp', 0.9)
    : undefined
  if (v.altObjective) tick('Génération du plateau')
  return { ...v, cards, backVillainImage, backFateImage, backExtraImage, boardImage, boardSig, locations, altBoardImage }
}
