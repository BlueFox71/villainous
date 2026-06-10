// Jetable : extrait le pion doré (Prince Jean), cellule bas-milieu de
// assets/pions.jpg → public/pion_prince_jean.png (fond blanc → transparent).
import { Jimp } from 'jimp'

const img = await Jimp.read('assets/pions.jpg')
const { width: W, data } = img.bitmap

// Cellule bas-milieu de la grille 3×2.
const X0 = 73, X1 = 147, Y0 = 110, Y1 = 219
const MIN = 5 // pixels dorés min par rangée/colonne pour compter (ignore les résidus épars)
const rowCount = new Array(Y1 + 1).fill(0)
const colCount = new Array(X1 + 1).fill(0)
const isGold = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  return r >= g && g > b && r - b > 40 // doré/brun saturé (exclut blanc, vert, gris)
}
for (let y = Y0; y <= Y1; y++) {
  for (let x = X0; x <= X1; x++) {
    if (isGold((y * W + x) * 4)) {
      rowCount[y]++
      colCount[x]++
    }
  }
}
// bbox = rangées/colonnes ayant assez de doré (le calice, pas les résidus).
let minX = X1, minY = Y1, maxX = X0, maxY = Y0
for (let y = Y0; y <= Y1; y++) if (rowCount[y] >= MIN) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
for (let x = X0; x <= X1; x++) if (colCount[x] >= MIN) { minX = Math.min(minX, x); maxX = Math.max(maxX, x) }

const pad = 3
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = maxX - minX + 1 + 2 * pad
const h = maxY - minY + 1 + 2 * pad
console.log(`gold bbox=${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })

// On ne garde QUE le doré/brun (R ≥ V > B) ; tout le reste (blanc, vert du pion
// voisin, rouge, gris) → transparent.
const d = img.bitmap.data
for (let i = 0; i < d.length; i += 4) {
  const r = d[i], g = d[i + 1], b = d[i + 2]
  if (!(r >= g && g > b)) d[i + 3] = 0
}
await img.write('public/pion_prince_jean.png')
console.log('public/pion_prince_jean.png OK')
