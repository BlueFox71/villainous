import { Jimp } from 'jimp'
import { mkdirSync } from 'node:fs'
const OUT = '_crops/'
mkdirSync(OUT, { recursive: true })
for (let i=0;i<4;i++){
  const img = await Jimp.read(`${OUT}loc${i}.png`)
  const W = img.bitmap.width, H = img.bitmap.height
  const bot = img.clone().crop({ x: 0, y: Math.round(H*0.60), w: W, h: Math.round(H*0.28) })
  bot.resize({ w: W*2, h: Math.round(H*0.28)*2 })
  await bot.write(`${OUT}loc${i}_bot.png`)
}
console.log('done')
