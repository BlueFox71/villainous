// Utilitaires d'images pour l'éditeur : lecture d'un fichier en dataURL et
// redimensionnement « cover » pour limiter le poids stocké en IndexedDB.

/** Lit un File (image) en dataURL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Charge une dataURL/URL en HTMLImageElement (résolu une fois décodée). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = src
  })
}

/** Réencode une image en PNG/JPEG borné à `maxSize` px (côté le plus long), pour
 *  éviter de stocker des originaux de plusieurs Mo en dataURL. Conserve le ratio. */
export async function downscaleDataUrl(
  src: string,
  maxSize = 1024,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92,
): Promise<string> {
  const img = await loadImage(src)
  const { width, height } = img
  const scale = Math.min(1, maxSize / Math.max(width, height))
  if (scale >= 1 && src.length < 1_500_000) return src // déjà raisonnable
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(mime, quality)
}

/** Lit un fichier image et le réduit pour le stockage (helper combiné). */
export async function readImageForStorage(file: File, maxSize = 1024): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  return downscaleDataUrl(dataUrl, maxSize)
}
