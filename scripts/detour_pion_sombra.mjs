// Jetable : détoure la photo de figurine Sombra (fond flou non uni) via IA,
// puis recadre sur la zone opaque et redimensionne au gabarit pion.
// assets/pions/Pion sombra.png → public/pion_sombra.png (fond transparent).
import { removeBackground } from '@imgly/background-removal-node'
import { Jimp } from 'jimp'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'assets/pions/Pion sombra.png'
const OUT = 'public/pion_sombra.png'
const TARGET_H = 520 // hauteur cible (cf. autres pions : hades 552, scar 392)

// 1) Détourage IA → PNG RGBA avec fond transparent.
const buf = readFileSync(SRC)
const blob = new Blob([buf], { type: 'image/png' })
const resBlob = await removeBackground(blob)
const cutBuf = Buffer.from(await resBlob.arrayBuffer())

// 2) Recadrage sur la bbox opaque + redimensionnement.
const img = await Jimp.read(cutBuf)
const { width: W, height: H, data: d } = img.bitmap
let minX = W, minY = H, maxX = 0, maxY = 0
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 24) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
const pad = 4
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = Math.min(W - x, maxX - minX + 1 + 2 * pad)
const h = Math.min(H - y, maxY - minY + 1 + 2 * pad)
console.log(`bbox ${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })
img.resize({ h: TARGET_H })

const outBuf = await img.getBuffer('image/png')
writeFileSync(OUT, outBuf)
const b = readFileSync(OUT)
console.log(`${OUT} ${b.readUInt32BE(16)}x${b.readUInt32BE(20)} ${(b.length / 1024) | 0}Ko`)
