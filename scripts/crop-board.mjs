import { Jimp } from 'jimp'
import { mkdirSync } from 'node:fs'
const IN = process.argv[2]
const OUT = '_crops/'
mkdirSync(OUT, { recursive: true })
const img = await Jimp.read(IN)
const W = img.bitmap.width, H = img.bitmap.height
console.log('size', W, H)
const startX = Math.round(W * 0.17)
const locW = Math.floor((W - startX) / 4) - 2
for (let i = 0; i < 4; i++) {
  const x = startX + i*locW
  const w = Math.min(locW, W - x - 1)
  const c = img.clone().crop({ x, y: 0, w, h: H-1 })
  await c.write(`${OUT}loc${i}.png`)
}
console.log('done')
