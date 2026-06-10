// Jetable : isole le jeton de pouvoir (assets/jeton_powser.jpg) → PNG transparent
// rogné au carré sur le disque, servi depuis public/jeton_pouvoir.png.
import { Jimp } from 'jimp'

const img = await Jimp.read('assets/jeton_powser.jpg')
const { width: W, height: H, data } = img.bitmap

// 1) Fond gris clair + ombre → transparent (gris = peu saturé ET clair). On
//    garde le disque sombre (max < 110) et l'or (saturé).
let minX = W, minY = H, maxX = 0, maxY = 0
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const isBg = mx - mn < 25 && mx > 110
    if (isBg) {
      data[i + 3] = 0 // transparent
    } else {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}

// 2) Carré centré sur le disque (côté = plus grande dimension).
const cx = (minX + maxX) / 2
const cy = (minY + maxY) / 2
const side = Math.max(maxX - minX, maxY - minY) + 2
const x = Math.max(0, Math.round(cx - side / 2))
const y = Math.max(0, Math.round(cy - side / 2))
const w = Math.min(side, W - x)
const h = Math.min(side, H - y)

console.log(`bbox=${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })
await img.write('public/jeton_pouvoir.png')
console.log('public/jeton_pouvoir.png OK')
