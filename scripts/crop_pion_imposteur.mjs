// Jetable : détoure le pion de L'Imposteur (crewmate rouge Among Us) depuis
// assets/pion imposteur.jpg → public/pion_imposteur.png.
//
// Le fond est blanc uniforme et le personnage est entièrement cerné d'un contour
// noir épais : on remplit la transparence DEPUIS LES BORDS (flood-fill) sur les
// pixels clairs, ce qui enlève le fond extérieur tout en préservant les reflets
// blancs ENFERMÉS dans le hublot.
import { Jimp } from 'jimp'

const img = await Jimp.read('assets/pion imposteur.jpg')
const { width: W, height: H, data } = img.bitmap

// Pixel « fond » = très clair et peu saturé (blanc/gris très clair).
const isBg = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max > 200 && max - min < 30
}

// Flood-fill BFS depuis tous les pixels de bordure qui sont du fond.
const visited = new Uint8Array(W * H)
const stack = []
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const p = y * W + x
  if (visited[p]) return
  if (!isBg(p * 4)) return
  visited[p] = 1
  stack.push(p)
}
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
while (stack.length) {
  const p = stack.pop()
  const x = p % W, y = (p - x) / W
  data[p * 4 + 3] = 0 // transparent
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
}

// Recadre sur la bbox des pixels encore opaques (+ marge).
let minX = W, minY = H, maxX = 0, maxY = 0
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] !== 0) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
}
const pad = 12
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = Math.min(W - x, maxX - minX + 1 + 2 * pad)
const h = Math.min(H - y, maxY - minY + 1 + 2 * pad)
console.log(`bbox=${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })

await img.write('public/pion_imposteur.png')
console.log('public/pion_imposteur.png OK')
