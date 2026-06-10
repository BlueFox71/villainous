// Jetable : extrait le pion vert (Maléfique), cellule HAUT-milieu de
// assets/pions.jpg → public/pion_maleficent.png (fond blanc → transparent).
import { Jimp } from 'jimp'

const img = await Jimp.read('assets/pions.jpg')
const { width: W, data } = img.bitmap

// Cellule HAUT-milieu (le pion vert).
const X0 = 73, X1 = 147, Y0 = 0, Y1 = 109
const MIN = 5
const rowCount = new Array(Y1 + 1).fill(0)
const colCount = new Array(X1 + 1).fill(0)
// Vert saturé : V > R et V > B (la pointe est très verte).
const isGreen = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  return g > r && g > b && g - Math.max(r, b) > 25
}
for (let y = Y0; y <= Y1; y++) {
  for (let x = X0; x <= X1; x++) {
    if (isGreen((y * W + x) * 4)) {
      rowCount[y]++
      colCount[x]++
    }
  }
}
let minX = X1, minY = Y1, maxX = X0, maxY = Y0
for (let y = Y0; y <= Y1; y++) if (rowCount[y] >= MIN) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
for (let x = X0; x <= X1; x++) if (colCount[x] >= MIN) { minX = Math.min(minX, x); maxX = Math.max(maxX, x) }

const pad = 3
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = maxX - minX + 1 + 2 * pad
const h = maxY - minY + 1 + 2 * pad
console.log(`green bbox=${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })

// On ne garde QUE le vert ; tout le reste → transparent.
const d = img.bitmap.data
for (let i = 0; i < d.length; i += 4) {
  const r = d[i], g = d[i + 1], b = d[i + 2]
  if (!(g > r && g > b && g - Math.max(r, b) > 25)) d[i + 3] = 0
}
await img.write('public/pion_maleficent.png')
console.log('public/pion_maleficent.png OK')
