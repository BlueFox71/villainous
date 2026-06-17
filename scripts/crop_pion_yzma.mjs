// Jetable : extrait le pion d'Yzma (figurine violette du milieu) de
// assets/Pions 3.jpg → public/pion_yzma.png (fond blanc + ombre → transparent).
// La figurine est violette translucide avec des reflets clairs INTERNES : un seuil
// global troue ces reflets. On fait donc un remplissage par diffusion depuis les
// bords sur les pixels « clairs/peu saturés » (blanc + ombre grise), ce qui laisse
// intacts les reflets entourés de violet.
import { Jimp } from 'jimp'

// Recadrage de la figurine du milieu (cf. essais visuels).
const SRC = 'assets/Pions 3.jpg'
const EX = { left: 198, top: 108, width: 138, height: 380 }

const img = await Jimp.read(SRC)
img.crop({ x: EX.left, y: EX.top, w: EX.width, h: EX.height })
const { width: W, height: H, data } = img.bitmap

// Pixel « fond » candidat : clair (brillant) ET peu saturé → blanc ou ombre grise.
const isBg = (idx) => {
  const r = data[idx], g = data[idx + 1], b = data[idx + 2]
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max > 140 && max - min < 42
}

// Diffusion 4-voisins depuis tous les pixels du bord.
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
  const x = p % W, y = (p / W) | 0
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
}

// Les pixels atteints (fond extérieur connecté) → transparents.
let minX = W, minY = H, maxX = 0, maxY = 0
for (let p = 0; p < W * H; p++) {
  if (visited[p]) {
    data[p * 4 + 3] = 0
  } else {
    const x = p % W, y = (p / W) | 0
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
}

// Recadrage serré sur la figurine + petite marge.
const pad = 4
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = Math.min(W - x, maxX - minX + 1 + 2 * pad)
const h = Math.min(H - y, maxY - minY + 1 + 2 * pad)
img.crop({ x, y, w, h })
console.log(`bbox=${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)

await img.write('public/pion_yzma.png')
console.log('public/pion_yzma.png OK')
