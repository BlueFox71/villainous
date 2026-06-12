// Jetable : extrait le pion d'Hadès (figurine BLEUE du milieu) de
// assets/pions 2.jpg → public/pion_hades.png (fond blanc → transparent).
import { Jimp } from 'jimp'

const img = await Jimp.read('assets/pions 2.jpg')
const { width: W, height: H, data } = img.bitmap

// Le pion bleu occupe le tiers central ; on borne la recherche pour éviter les
// pions voisins (violet à gauche, magenta à droite).
const SX0 = 380, SX1 = 850, SY0 = 0, SY1 = H - 1
// Bleu/turquoise saturé : b nettement > r (le blanc a r≈g≈b → exclu).
const isBlue = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  return b - r > 30 && b > 80
}
const rowCount = new Array(H).fill(0)
const colCount = new Array(W).fill(0)
for (let y = SY0; y <= SY1; y++) {
  for (let x = SX0; x <= SX1; x++) {
    if (isBlue((y * W + x) * 4)) { rowCount[y]++; colCount[x]++ }
  }
}
const MIN = 4
let minX = SX1, minY = SY1, maxX = SX0, maxY = SY0
for (let y = SY0; y <= SY1; y++) if (rowCount[y] >= MIN) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
for (let x = SX0; x <= SX1; x++) if (colCount[x] >= MIN) { minX = Math.min(minX, x); maxX = Math.max(maxX, x) }

const pad = 8
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = Math.min(W - x, maxX - minX + 1 + 2 * pad)
const h = Math.min(H - y, maxY - minY + 1 + 2 * pad)
console.log(`blue bbox=${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })

// Fond blanc/gris clair → transparent : pixel peu saturé ET clair.
const d = img.bitmap.data
for (let i = 0; i < d.length; i += 4) {
  const r = d[i], g = d[i + 1], b = d[i + 2]
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max - min < 28 && max > 185) d[i + 3] = 0
}
await img.write('public/pion_hades.png')
console.log('public/pion_hades.png OK')
