// Jetable : extrait le 2e pion (casque doré = Thanos) de assets/pions/Pions 10.jpg,
// détoure le fond blanc via IA, recadre et redimensionne → public/pion_thanos.png.
import { removeBackground } from '@imgly/background-removal-node'
import { Jimp } from 'jimp'
import { readFileSync, writeFileSync } from 'node:fs'

const OUT = 'public/pion_thanos.png'
const TARGET_H = 520

// 1) Découpe la colonne du 2e pion (segmentation : x≈201..365, +marge).
const full = await Jimp.read('assets/pions/Pions 10.jpg')
full.crop({ x: 192, y: 0, w: 182, h: full.bitmap.height })
const cropBuf = await full.getBuffer('image/png')

// 2) Détourage IA (fond blanc → transparent).
const blob = new Blob([cropBuf], { type: 'image/png' })
const resBlob = await removeBackground(blob)
const cutBuf = Buffer.from(await resBlob.arrayBuffer())

// 3) Recadrage sur la bbox opaque + redimensionnement.
const img = await Jimp.read(cutBuf)
const { width: W, height: H, data: d } = img.bitmap
let minX = W, minY = H, maxX = 0, maxY = 0
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (d[(y * W + x) * 4 + 3] > 24) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
const pad = 4
const x = Math.max(0, minX - pad)
const y = Math.max(0, minY - pad)
const w = Math.min(W - x, maxX - minX + 1 + 2 * pad)
const h = Math.min(H - y, maxY - minY + 1 + 2 * pad)
console.log(`bbox ${minX},${minY}..${maxX},${maxY} → crop ${x},${y} ${w}x${h}`)
img.crop({ x, y, w, h })
img.resize({ h: TARGET_H })

writeFileSync(OUT, await img.getBuffer('image/png'))
const b = readFileSync(OUT)
console.log(`${OUT} ${b.readUInt32BE(16)}x${b.readUInt32BE(20)} ${(b.length / 1024) | 0}Ko`)
