// =============================================================================
// Allègement d'un vilain publié pour la LISTE / les galeries.
//
// Un vilain publié pèse des dizaines de Mo d'images base64 (cartes, lieux, plateau…),
// or la liste n'a besoin que du portrait + de la présentation. `lightenVillain` retire
// toutes les images LOURDES en gardant les DONNÉES de jeu (cartes/lieux/objectif) et les
// deux images d'affichage (portrait, présentation). Le résultat est écrit dans
// `src/data/published/light/<id>.json` (par le endpoint de publication de vite.config.ts) et
// chargé au démarrage à la place du fichier complet ; les images de cartes/plateau se
// chargent ensuite par HYDRATATION du `<id>.json` complet (édition ou lancement de partie).
//
// Fichier PUR (aucun import) : consommé côté Node (endpoint de publication) comme côté script.
// =============================================================================

type AnyRec = Record<string, unknown>

/** Champs image LOURDS retirés du niveau racine (on conserve `portrait` et `presentation`). */
const HEAVY_TOP_FIELDS = [
  'portraitRaw',
  'boardArt',
  'boardImage',
  'altBoardImage',
  'pawnImage',
  'audio',
  'backVillainImage',
  'backFateImage',
  'backExtraImage',
]

/** Retire une clé `image` (et co.) d'un objet cloné superficiellement. */
function stripImage(o: AnyRec, ...keys: string[]): AnyRec {
  const c = { ...o }
  for (const k of keys) delete c[k]
  return c
}

/** Renvoie une copie ALLÉGÉE d'un vilain publié : données de jeu + portrait/présentation,
 *  sans les images lourdes (cartes, lieux, plateau, pion, dos, audio…). */
export function lightenVillain(full: unknown): AnyRec {
  const v = JSON.parse(JSON.stringify(full)) as AnyRec
  for (const k of HEAVY_TOP_FIELDS) delete v[k]

  if (Array.isArray(v.backOverlays)) {
    v.backOverlays = (v.backOverlays as AnyRec[]).map((o) => stripImage(o, 'image'))
  }
  if (v.backExtra && typeof v.backExtra === 'object') {
    const be = { ...(v.backExtra as AnyRec) }
    if (Array.isArray(be.overlays)) be.overlays = (be.overlays as AnyRec[]).map((o) => stripImage(o, 'image'))
    v.backExtra = be
  }
  if (Array.isArray(v.cards)) {
    v.cards = (v.cards as AnyRec[]).map((c) => stripImage(c, 'image', 'artImage'))
  }
  if (Array.isArray(v.locations)) {
    v.locations = (v.locations as AnyRec[]).map((l) => {
      const ll = stripImage(l, 'image')
      if (ll.alt && typeof ll.alt === 'object') ll.alt = stripImage(ll.alt as AnyRec, 'image', 'columnImage')
      return ll
    })
  }
  return v
}
