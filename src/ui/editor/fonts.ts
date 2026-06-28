// Police « Esteban » du gabarit Villainous, partagée par le rendu du plateau ET
// des cartes (canvas). Chargée une seule fois via FontFace ; repli serif sinon.

/** Pile de polices à utiliser dans les `ctx.font` du plateau et des cartes. */
export const EDITOR_FONT = '"Esteban", Georgia, "Times New Roman", serif'

let fontPromise: Promise<void> | null = null

/** Charge la police Esteban une seule fois et l'enregistre pour le canvas. */
export function ensureFonts(): Promise<void> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        if (typeof FontFace === 'undefined' || !('fonts' in document)) return
        const ff = new FontFace('Esteban', "url('/editor/fonts/Esteban-Regular.ttf')")
        await ff.load()
        document.fonts.add(ff)
      } catch {
        /* repli sur la pile serif */
      }
    })()
  }
  return fontPromise
}
