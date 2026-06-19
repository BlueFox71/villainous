import { Jimp } from 'jimp'
const DIR = '_crops/pat/'
for (const id of ['24','25','26','27']){
  const img = await Jimp.read(`${DIR}c${id}.png`)
  const W=img.bitmap.width, H=img.bitmap.height
  // action icon is bottom-center, just above the type banner
  const c = img.clone().crop({x:Math.round(W*0.30),y:Math.round(H*0.78),w:Math.round(W*0.40),h:Math.round(H*0.16)})
  c.resize({w:Math.round(W*0.40)*4,h:Math.round(H*0.16)*4})
  await c.write(`_crops/item${id}.png`)
}
console.log('ok')
