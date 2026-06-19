import { Jimp } from 'jimp'
import { readdirSync, mkdirSync } from 'node:fs'
const DIR = 'assets/decks/Pat Hibulaire/'
const OUT = '_crops/pat/'
mkdirSync(OUT, { recursive: true })
const files = readdirSync(DIR).filter(f=>f.endsWith('.png')).sort()
let idx = 0
const manifest = []
for (const f of files){
  const img = await Jimp.read(DIR+f)
  const W = img.bitmap.width, H = img.bitmap.height
  const id = String(++idx).padStart(2,'0')
  // downscale to max width 640 to keep tokens reasonable
  if (W > 640) img.resize({ w: 640, h: Math.round(H*640/W) })
  await img.write(`${OUT}c${id}.png`)
  manifest.push(`c${id}  ${W}x${H}  ${f}`)
}
console.log(manifest.join('\n'))
